// Cria o pedido Pix no PagBank para um pedido 'pending' do próprio usuário e devolve o QR.
//
// Chamada: POST com o JWT do usuário { order_id, captcha_token, customer: { tax_id, phone? } }.
// Nunca confia em valor do cliente: o total, os itens e o prazo vêm do banco (reservar_ingressos).
// Composição do total no banco: total = subtotal − discount + service_fee (+ processing_fee, hoje 0). Itens em order_items
// (unit_price × quantity somam o subtotal); a taxa de serviço vai como item "Taxa de serviço"; com desconto os itens
// colapsam num só item "Ingressos" para a soma bater com o total.
// O CPF (tax_id) vai só ao PagBank: não é gravado nem logado.
// Segredos por env: PAGBANK_TOKEN, PAGBANK_BASE_URL, PAGBANK_ACCOUNT_ID, RECAPTCHA_SECRET (+ opcionais RECAPTCHA_MIN_SCORE,
// PAGBANK_CUSTODIA_DIAS_APOS_EVENTO). Faltou um obrigatório: 503, nunca segue sem a proteção.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'
import { corsHeaders } from '../_shared/cors.ts'
import { limitarPorIp } from '../_shared/email.ts'
import { clientIp } from '../_shared/ip.ts'
import {
  ACCO_RE, calcularExpiracao, calcularLiberacao, mascarar, montarSplit, pagbankFetch, reaisParaCentavos, validarCpf,
  type PagbankCfg,
} from '../_shared/pagbank.ts'

export type Pedido = {
  id: string; user_id: string; status: string; reservado_ate: string | null
  total: number; subtotal: number; discount: number; service_fee: number; processing_fee: number
  customer_name: string | null; customer_email: string | null; gateway_payment_id: string | null
  evento: { producer_id: string; start_date: string; end_date: string | null }
  itens: { nome: string; quantity: number; unit_price: number }[]
  payout_account_id: string | null
}
export type Deps = {
  env: (k: string) => string
  limitar: (req: Request) => Promise<Response | null>
  autenticar: (token: string) => Promise<{ id: string; email: string | null } | null>
  captcha: (token: string, ip: string | null) => Promise<boolean>
  carregar: (orderId: string) => Promise<Pedido | null>
  /** update ... where id and status='pending' and gateway_payment_id is null; true se gravou */
  gravar: (orderId: string, pagbankId: string) => Promise<boolean>
  pagbank: (caminho: string, init: { method: 'GET' | 'POST'; body?: unknown; idempotencia?: string }) => Promise<Record<string, unknown>>
  agora: () => Date
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_CORPO = 4096

/** Verifica o reCAPTCHA v3 no Google. Falha fechada: sem segredo, erro de rede ou timeout = false. */
export async function verificarRecaptcha(
  token: string, ip: string | null, env: (k: string) => string, fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  const secret = env('RECAPTCHA_SECRET')
  if (!secret || !token) return false
  const minimo = Number(env('RECAPTCHA_MIN_SCORE') || '0.5')
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 5000)
  try {
    const corpo = new URLSearchParams({ secret, response: token })
    if (ip) corpo.set('remoteip', ip)
    const r = await fetchFn('https://www.google.com/recaptcha/api/siteverify', { method: 'POST', body: corpo, signal: ctl.signal })
    if (!r.ok) return false
    const j = await r.json()
    return j.success === true && j.action === 'pagbank_checkout' && typeof j.score === 'number' && j.score >= (Number.isFinite(minimo) ? minimo : 0.5)
  } catch {
    return false
  } finally {
    clearTimeout(t)
  }
}

function itensDoPedido(p: Pedido, totalCentavos: number) {
  const itens = p.itens.map((i, n) => ({
    reference_id: `${p.id}-${n + 1}`, name: i.nome.slice(0, 100), quantity: i.quantity, unit_amount: reaisParaCentavos(i.unit_price),
  }))
  const soma = itens.reduce((s, i) => s + i.quantity * i.unit_amount, 0)
  if (itens.every(i => Number.isInteger(i.unit_amount) && i.quantity > 0) && itens.length) {
    if (soma === totalCentavos) return itens
    if (soma < totalCentavos) return [...itens, { reference_id: `${p.id}-taxa`, name: 'Taxa de serviço', quantity: 1, unit_amount: totalCentavos - soma }]
  }
  // desconto (soma > total) ou item estranho: um item só, valor = total do banco
  return [{ reference_id: `${p.id}-1`, name: 'Ingressos', quantity: 1, unit_amount: totalCentavos }]
}

export async function handler(req: Request, d: Deps): Promise<Response> {
  const cors = corsHeaders(req)
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  const indisponivel = () => json(503, { error: 'Pagamento indisponível no momento. Tente de novo em instantes.' })
  const naoEncontrado = () => json(404, { error: 'Pedido não encontrado.' })
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'Método não permitido' })

  const cfg: PagbankCfg = { baseUrl: d.env('PAGBANK_BASE_URL'), token: d.env('PAGBANK_TOKEN') }
  const plataformaId = d.env('PAGBANK_ACCOUNT_ID')
  if (!cfg.baseUrl || !cfg.token || !ACCO_RE.test(plataformaId) || !d.env('RECAPTCHA_SECRET')) {
    console.error('[pagbank-criar-pedido] configuração incompleta')
    return indisponivel()
  }
  const log = (...a: unknown[]) => console.error('[pagbank-criar-pedido]', mascarar(a.map(String).join(' '), cfg.token))

  const limitado = await d.limitar(req)
  if (limitado) return limitado

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'Não autenticado' })
  const user = await d.autenticar(token)
  if (!user) return json(401, { error: 'Não autenticado' })

  // corpo com teto: lê no máximo MAX_CORPO+1 caracteres úteis
  const bruto = await req.text()
  if (bruto.length > MAX_CORPO) return json(413, { error: 'Requisição grande demais.' })
  let b: Record<string, unknown>
  try { b = JSON.parse(bruto) } catch { return json(400, { error: 'Dados inválidos.' }) }
  const cliente = (b?.customer ?? {}) as Record<string, unknown>
  if (typeof b?.order_id !== 'string' || !UUID_RE.test(b.order_id)) return json(400, { error: 'Dados inválidos.' })
  if (typeof b.captcha_token !== 'string' || !b.captcha_token) return json(400, { error: 'Não foi possível validar a segurança do pagamento.' })
  if (!validarCpf(cliente.tax_id)) return json(400, { error: 'CPF inválido.' })
  const cpf = (cliente.tax_id as string).replace(/\D/g, '')

  if (!(await d.captcha(b.captcha_token, clientIp(req.headers).ip))) {
    return json(400, { error: 'Não foi possível validar a segurança do pagamento. Recarregue a página e tente de novo.' })
  }

  const pedido = await d.carregar(b.order_id)
  if (!pedido || pedido.user_id !== user.id) return naoEncontrado()
  if (pedido.status !== 'pending') return json(409, { error: 'Este pedido não está mais aguardando pagamento.' })
  const agora = d.agora()
  const reservaAte = pedido.reservado_ate ? new Date(pedido.reservado_ate) : null
  if (!reservaAte || !(reservaAte.getTime() - agora.getTime() >= 60_000)) {
    return json(409, { error: 'Reserva expirada. Volte ao evento e escolha os ingressos de novo.' })
  }

  // Resposta única ao cliente: só order_id, pix_copia_e_cola e expira_em. O QR é desenhado pela tela a partir do copia-e-cola
  // (o link PNG/BASE64 do PagBank exige o token e carrega o id do QR; não é repassado)
  const resposta = async (o: Record<string, unknown>) => {
    const c = ((o.charges as Record<string, unknown>[] | undefined) ?? [])[0]
    const pix = (c?.payment_method as { pix?: { expiration_date?: string } } | undefined)?.pix
    const texto = (c?.qr_code as { text?: string } | undefined)?.text
    if (o.reference_id !== pedido.id || !texto || !pix?.expiration_date) throw new Error('resposta do PagBank sem os campos esperados')
    const expira = new Date(pix.expiration_date)
    if (!(expira.getTime() > d.agora().getTime())) return json(409, { error: 'O Pix deste pedido expirou. Volte ao evento e faça a reserva de novo.' })
    return json(200, { order_id: pedido.id, pix_copia_e_cola: texto, expira_em: expira.toISOString() })
  }
  const existente = async (id: string) => resposta(await d.pagbank(`/orders/${encodeURIComponent(id)}`, { method: 'GET' }))

  try {
    if (pedido.gateway_payment_id) return await existente(pedido.gateway_payment_id)

    const totalCentavos = reaisParaCentavos(pedido.total)
    if (!Number.isInteger(totalCentavos) || totalCentavos <= 0) return json(409, { error: 'Este pedido não precisa de pagamento.' })

    const taxa = reaisParaCentavos(Number(pedido.service_fee) + Number(pedido.processing_fee))
    const dias = Number(d.env('PAGBANK_CUSTODIA_DIAS_APOS_EVENTO') || '7') // pendente: decisão do Ricardo (regra de repasse ao produtor)
    const fim = new Date(pedido.evento.end_date ?? pedido.evento.start_date)
    const splits = Number.isFinite(dias) && !isNaN(fim.getTime())
      ? montarSplit({ totalCentavos, taxaCentavos: taxa, plataformaId, produtorId: pedido.payout_account_id, liberarEm: calcularLiberacao(fim, dias, agora) })
      : null
    if (!splits) log('pedido', pedido.id, 'sem split (produtor sem conta PagBank válida ou taxa fora da faixa): todo o valor cai na conta da Evokaa')

    const fone = String(cliente.phone ?? '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')
    const telefone = /^\d{10,11}$/.test(fone) ? [{ country: '55', area: fone.slice(0, 2), number: fone.slice(2), type: fone.length === 11 ? 'MOBILE' : 'LANDLINE' }] : undefined
    const corpo = {
      reference_id: pedido.id,
      customer: {
        name: (pedido.customer_name || 'Cliente Evokaa').slice(0, 100),
        email: pedido.customer_email || user.email,
        tax_id: cpf,
        ...(telefone ? { phones: telefone } : {}),
      },
      items: itensDoPedido(pedido, totalCentavos),
      charges: [{
        reference_id: pedido.id,
        description: 'Ingressos Evokaa',
        amount: { value: totalCentavos, currency: 'BRL' },
        payment_method: { type: 'PIX', pix: { expiration_date: calcularExpiracao(reservaAte, agora) } },
        ...(splits ? { splits } : {}),
      }],
      notification_urls: [`${d.env('SUPABASE_URL')}/functions/v1/pagbank-webhook`],
    }
    const criado = await d.pagbank('/orders', { method: 'POST', body: corpo, idempotencia: pedido.id })
    if (typeof criado.id !== 'string' || !/^ORDE_[0-9A-Fa-f-]+$/.test(criado.id)) throw new Error('PagBank sem id de pedido')
    if (!(await d.gravar(pedido.id, criado.id))) {
      // outra requisição ganhou a corrida: devolve o pedido que já está gravado (mesma chave de idempotência = mesmo pedido no PagBank)
      const atual = await d.carregar(pedido.id)
      if (!atual?.gateway_payment_id) throw new Error('gravação recusada e pedido sem gateway_payment_id')
      return await existente(atual.gateway_payment_id)
    }
    return await resposta(criado)
  } catch (e) {
    log('pedido', pedido.id, e instanceof Error ? e.message : e)
    return json(502, { error: 'Não foi possível gerar o Pix agora. Tente de novo em instantes.' })
  }
}

if (import.meta.main) {
  const env = (k: string) => Deno.env.get(k) ?? ''
  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))
  const cfg = () => ({ baseUrl: env('PAGBANK_BASE_URL'), token: env('PAGBANK_TOKEN') })
  Deno.serve(req => handler(req, {
    env,
    limitar: (r) => limitarPorIp(r, admin, (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders(r), 'Content-Type': 'application/json' } }), 'pagbank-pedido:'),
    autenticar: async (t) => {
      const { data: { user }, error } = await admin.auth.getUser(t)
      return error || !user ? null : { id: user.id, email: user.email ?? null }
    },
    captcha: (t, ip) => verificarRecaptcha(t, ip, env),
    carregar: async (id) => {
      const { data: o, error } = await admin.from('orders')
        .select('id,user_id,status,reservado_ate,total,subtotal,discount,service_fee,processing_fee,customer_name,customer_email,gateway_payment_id,events(producer_id,start_date,end_date),order_items(quantity,unit_price,ticket_types(name))')
        .eq('id', id).maybeSingle()
      if (error) throw new Error(`leitura do pedido: ${error.message}`)
      if (!o) return null
      const ev = (Array.isArray(o.events) ? o.events[0] : o.events) as Pedido['evento']
      const { data: pp } = await admin.from('producer_profiles').select('payout_account_id').eq('id', ev.producer_id).maybeSingle()
      return {
        ...o, evento: ev, payout_account_id: pp?.payout_account_id ?? null,
        itens: ((o.order_items ?? []) as { quantity: number; unit_price: number; ticket_types: { name: string } | { name: string }[] | null }[]).map(i => ({
          nome: (Array.isArray(i.ticket_types) ? i.ticket_types[0]?.name : i.ticket_types?.name) ?? 'Ingresso', quantity: i.quantity, unit_price: i.unit_price,
        })),
      } as Pedido
    },
    gravar: async (id, pagbankId) => {
      const { data, error } = await admin.from('orders')
        .update({ payment_gateway: 'pagbank', payment_method: 'pix', gateway_payment_id: pagbankId })
        .eq('id', id).eq('status', 'pending').is('gateway_payment_id', null).select('id')
      if (error) throw new Error(`gravação do pedido: ${error.message}`)
      return (data?.length ?? 0) > 0
    },
    pagbank: (caminho, init) => pagbankFetch(cfg(), caminho, init),
    agora: () => new Date(),
  }))
}
