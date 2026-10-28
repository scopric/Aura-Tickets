// Prepara o pagamento por cartão: devolve a chave pública do cartão, a sessão do 3DS e o total (do banco, em centavos).
//
// Chamada: POST com o JWT do usuário { order_id, captcha_token }. Mesmas checagens do Pix (pedido do usuário, 'pending', reserva viva).
// reCAPTCHA v3 com a ação `pagbank_cartao` (cada chamada exige token NOVO). Nunca loga token, session, public_key nem corpo.
// Quem cobra é `pagbank-criar-pedido` (ramo `cartao`); o 3DS é preso ao valor, por isso o total vem daqui.
//
// Testes: cd supabase && deno test --allow-env functions/pagbank-cartao-preparar/handler_test.ts
import { corsHeaders } from '../_shared/cors.ts'
import { clientIp } from '../_shared/ip.ts'
import { mascarar, reaisParaCentavos, type PagbankCfg } from '../_shared/pagbank.ts'
import { lerCorpo, UUID_RE, type Pedido } from '../pagbank-criar-pedido/handler.ts'

export type Deps = {
  env: (k: string) => string
  limitar: (req: Request, userId: string) => Promise<Response | null>
  autenticar: (token: string) => Promise<{ id: string; email: string | null } | null>
  /** Limite por chave (pedido, IP): devolve a recusa (429 igual à do Pix) ou null */
  limitarChave: (req: Request, prefixo: string, chave: string, max: number) => Promise<Response | null>
  captcha: (token: string, ip: string | null, acao: string) => Promise<boolean>
  carregar: (orderId: string, userId: string) => Promise<Pedido | null>
  /** Chamada à API do PagBank (baseUrl/caminho já resolvidos por quem implementa) */
  pagbank: (caminho: string, init: { method: 'GET' | 'POST'; body?: unknown }) => Promise<Record<string, unknown>>
  /** POST no host do SDK 3DS (checkout-sdk/sessions) */
  sdk: (baseUrl: string, caminho: string, body: unknown) => Promise<Record<string, unknown>>
  agora: () => Date
}

/** Host do SDK 3DS pela base da API; null = base desconhecida (falha fechado). */
export function hostSdk(baseUrl: string): { host: string; ambiente: 'SANDBOX' | 'PROD' } | null {
  const b = baseUrl.trim().replace(/\/+$/, '')
  if (b === 'https://sandbox.api.pagseguro.com') return { host: 'https://sandbox.sdk.pagseguro.com', ambiente: 'SANDBOX' }
  // NÃO VERIFICADO: o host de produção do SDK (https://sdk.pagseguro.com) não foi testado nem confirmado na documentação
  if (b === 'https://api.pagseguro.com') return { host: 'https://sdk.pagseguro.com', ambiente: 'PROD' }
  return null
}

export async function handler(req: Request, d: Deps): Promise<Response> {
  const cors = corsHeaders(req)
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  const indisponivel = () => json(503, { error: 'Pagamento indisponível no momento. Tente de novo em instantes.' })
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'Método não permitido' })

  const cfg: PagbankCfg = { baseUrl: d.env('PAGBANK_BASE_URL'), token: d.env('PAGBANK_TOKEN') }
  const sdk = hostSdk(cfg.baseUrl)
  if (!cfg.baseUrl || !cfg.token || !d.env('RECAPTCHA_SECRET') || !sdk) {
    console.error('[pagbank-cartao-preparar] configuração incompleta ou ambiente desconhecido')
    return indisponivel()
  }
  const log = (...a: unknown[]) => console.error('[pagbank-cartao-preparar]', mascarar(a.map(String).join(' '), cfg.token))

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'Não autenticado' })
  const user = await d.autenticar(token)
  if (!user) return json(401, { error: 'Não autenticado' })

  const limitado = await d.limitar(req, user.id)
  if (limitado) return limitado

  const bruto = await lerCorpo(req)
  if (bruto === null) return json(413, { error: 'Requisição grande demais.' })
  let b: Record<string, unknown>
  try { b = JSON.parse(bruto) } catch { return json(400, { error: 'Dados inválidos.' }) }
  if (typeof b?.order_id !== 'string' || !UUID_RE.test(b.order_id)) return json(400, { error: 'Dados inválidos.' })
  if (typeof b.captcha_token !== 'string' || !b.captcha_token) return json(400, { error: 'Não foi possível validar a segurança do pagamento.' })
  // limites próprios do cartão (além do por usuário): por pedido (5) e por IP (15) em 10 min
  const lp = await d.limitarChave(req, 'pagbank-cartao-pedido:', b.order_id, 5)
  if (lp) return lp
  const lip = await d.limitarChave(req, 'pagbank-cartao-ip:', clientIp(req.headers).ip ?? '', 15)
  if (lip) return lip
  if (!(await d.captcha(b.captcha_token, clientIp(req.headers).ip, 'pagbank_cartao'))) {
    return json(400, { error: 'Não foi possível validar a segurança do pagamento. Recarregue a página e tente de novo.' })
  }

  try {
    const pedido = await d.carregar(b.order_id, user.id)
    if (!pedido || pedido.user_id !== user.id) return json(404, { error: 'Pedido não encontrado.' })
    if (pedido.status !== 'pending') return json(409, { error: 'Este pedido não está mais aguardando pagamento.' })
    const reservaAte = pedido.reservado_ate ? new Date(pedido.reservado_ate) : null
    if (!reservaAte || !(reservaAte.getTime() - d.agora().getTime() >= 60_000)) {
      return json(409, { error: 'Reserva expirada. Volte ao evento e escolha os ingressos de novo.' })
    }
    const total = reaisParaCentavos(pedido.total)
    if (!Number.isInteger(total) || total <= 0) return json(409, { error: 'Este pedido não precisa de pagamento.' })

    const chave = await d.pagbank('/public-keys/card', { method: 'GET' })
    const sessao = await d.sdk(sdk.host, '/checkout-sdk/sessions', {})
    if (typeof chave.public_key !== 'string' || !chave.public_key || typeof sessao.session !== 'string' || !sessao.session) {
      throw new Error('PagBank sem public_key ou session')
    }
    return json(200, { public_key: chave.public_key, session: sessao.session, total_centavos: total, ambiente: sdk.ambiente })
  } catch (e) {
    log('pedido', b.order_id, e instanceof Error ? e.message : e)
    return json(502, { error: 'Não foi possível preparar o pagamento por cartão agora. Tente de novo em instantes.' })
  }
}
