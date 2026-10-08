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
//
// Testes (precisa de --allow-env porque _shared/email.ts lê env no topo):
//   cd supabase && deno test --allow-env functions/_shared/pagbank_test.ts functions/pagbank-criar-pedido/handler_test.ts
//
// reCAPTCHA v3: CADA tentativa (inclusive depois de erro 5xx) exige um `captcha_token` NOVO; o Google recusa token repetido.
// O front (fatia 4) tem de chamar grecaptcha.execute('...', { action: 'pagbank_checkout' }) de novo a cada clique em pagar.
//
// Corpo estável: o corpo enviado ao PagBank só depende do pedido (banco), do CPF/telefone e de reservado_ate, nunca do relógio.
// Assim a chave de idempotência `<order.id>:<hash(cpf|telefone)>` devolve o MESMO pedido nas repetições. O Pix vence em
// reservado_ate − 15 s; a reserva é de 10 min em `reservar_ingressos` (se ela mudar, mudar aqui junto): dá no máximo 9m45s.
// Dependências do corpo fora da reserva: e-mail do login (quando customer_email é nulo), env PAGBANK_CUSTODIA_DIAS_APOS_EVENTO e
// payout_account_id do produtor. Mudar qualquer uma no meio de um pedido gera 409 IDEMPOTENCY_CONFLICT (vira 409 genérico "refaça a reserva").
// CPF diferente = chave nova = outra cobrança (a fatia 3 trata o pagamento órfão pelo reference_id).
import { corsHeaders, ORIGENS } from '../_shared/cors.ts'
import { clientIp } from '../_shared/ip.ts'
import { validarEmail } from '../_shared/validar.ts'
import {
  ACCO_RE, calcularExpiracao, calcularLiberacao, chaveIdempotencia, mascarar, montarSplit, PagbankErro, reaisParaCentavos, validarCpf,
  type PagbankCfg,
} from '../_shared/pagbank.ts'

export type Pedido = {
  id: string; user_id: string; status: string; reservado_ate: string | null
  total: number; subtotal: number; discount: number; service_fee: number; processing_fee: number
  customer_name: string | null; customer_email: string | null; gateway_payment_id: string | null
  evento: { producer_id: string; start_date: string; end_date: string | null }
  itens: { id?: string; ticket_type_id?: string; nome: string; quantity: number; unit_price: number }[]
  payout_account_id: string | null
}
export type Deps = {
  env: (k: string) => string
  /** Limite por usuário (20 a cada 10 min), chamado DEPOIS do login */
  limitar: (req: Request, userId: string) => Promise<Response | null>
  autenticar: (token: string) => Promise<{ id: string; email: string | null } | null>
  captcha: (token: string, ip: string | null) => Promise<boolean>
  /** Pedido do usuário `userId`; pedido de outro ou inexistente = null (e nada mais é consultado); erro de banco lança */
  carregar: (orderId: string, userId: string) => Promise<Pedido | null>
  /** update ... where id and status='pending' and gateway_payment_id is null; true se gravou */
  gravar: (orderId: string, pagbankId: string) => Promise<boolean>
  pagbank: (caminho: string, init: { method: 'GET' | 'POST'; body?: unknown; idempotencia?: string }) => Promise<Record<string, unknown>>
  agora: () => Date
  esperar: (ms: number) => Promise<void>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_CORPO = 4096
const HOSTS = ORIGENS.map(o => new URL(o).hostname)

/** Lê o corpo parando em MAX_CORPO bytes; null = passou do teto. Confere Content-Length antes de ler. */
async function lerCorpo(req: Request): Promise<string | null> {
  const cl = Number(req.headers.get('content-length') ?? 0)
  if (cl > MAX_CORPO) return null
  const leitor = req.body?.getReader()
  if (!leitor) return ''
  const dec = new TextDecoder()
  let texto = ''
  let n = 0
  for (;;) {
    const { done, value } = await leitor.read()
    if (done) break
    n += value.length
    if (n > MAX_CORPO) { await leitor.cancel(); return null }
    texto += dec.decode(value, { stream: true })
  }
  return texto + dec.decode()
}

/** Verifica o reCAPTCHA v3 no Google. Falha fechada: sem segredo, erro de rede ou timeout = false. */
export async function verificarRecaptcha(
  token: string, ip: string | null, env: (k: string) => string, fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  const secret = env('RECAPTCHA_SECRET')
  if (!secret || !token) return false
  // faixa [0.3, 0.9]; fora dela (0, negativo, NaN, vazio) vale 0.5: nunca vira bypass
  const cru = Number(env('RECAPTCHA_MIN_SCORE') || '0.5')
  const minimo = cru >= 0.3 && cru <= 0.9 ? cru : 0.5
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 5000)
  try {
    const corpo = new URLSearchParams({ secret, response: token })
    if (ip) corpo.set('remoteip', ip)
    const r = await fetchFn('https://www.google.com/recaptcha/api/siteverify', { method: 'POST', body: corpo, signal: ctl.signal })
    if (!r.ok) return false
    const j = await r.json()
    return j.success === true && j.action === 'pagbank_checkout' && (HOSTS.includes(String(j.hostname)) || (env('RECAPTCHA_ALLOW_LOCALHOST') === '1' && j.hostname === 'localhost')) // localhost só em desenvolvimento
       && typeof j.score === 'number' && j.score >= minimo
  } catch {
    return false
  } finally {
    clearTimeout(t)
  }
}

function itensDoPedido(p: Pedido, totalCentavos: number) {
  // ordem fixa (o banco não garante ordem): por id, depois ticket_type_id, depois preço; senão o corpo mudaria e a mesma chave daria 409
  const ordenados = [...p.itens].sort((a, b) =>
    (a.id ?? '').localeCompare(b.id ?? '') || (a.ticket_type_id ?? '').localeCompare(b.ticket_type_id ?? '') || a.unit_price - b.unit_price)
  const itens = ordenados.map((i, n) => ({
    reference_id: i.id ?? `${p.id}-${n + 1}`, name: i.nome.slice(0, 100), quantity: i.quantity, unit_amount: reaisParaCentavos(i.unit_price),
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

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'Não autenticado' })
  const user = await d.autenticar(token)
  if (!user) return json(401, { error: 'Não autenticado' })

  // limite por usuário só depois do login: anônimo não grava linha nem consome cota
  const limitado = await d.limitar(req, user.id)
  if (limitado) return limitado

  const bruto = await lerCorpo(req)
  if (bruto === null) return json(413, { error: 'Requisição grande demais.' })
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

  // Resposta única ao cliente: só order_id, pix_copia_e_cola e expira_em. O QR é desenhado pela tela a partir do copia-e-cola
  // (o link PNG/BASE64 do PagBank exige o token e carrega o id do QR; não é repassado)
  const resposta = async (pedido: Pedido, o: Record<string, unknown>) => {
    const c = ((o.charges as Record<string, unknown>[] | undefined) ?? [])[0]
    const pix = (c?.payment_method as { pix?: { expiration_date?: string } } | undefined)?.pix
    const texto = (c?.qr_code as { text?: string } | undefined)?.text
    if (o.reference_id !== pedido.id || !texto || !pix?.expiration_date) throw new Error('resposta do PagBank sem os campos esperados')
    const expira = new Date(pix.expiration_date)
    if (!(expira.getTime() > d.agora().getTime())) return json(409, { error: 'O Pix deste pedido expirou. Volte ao evento e faça a reserva de novo.' })
    return json(200, { order_id: pedido.id, pix_copia_e_cola: texto, expira_em: expira.toISOString() })
  }
  try {
    const pedido = await d.carregar(b.order_id, user.id)
    if (!pedido || pedido.user_id !== user.id) return naoEncontrado()
    if (pedido.status !== 'pending') return json(409, { error: 'Este pedido não está mais aguardando pagamento.' })
    const agora = d.agora()
    const reservaAte = pedido.reservado_ate ? new Date(pedido.reservado_ate) : null
    if (!reservaAte || !(reservaAte.getTime() - agora.getTime() >= 60_000)) {
      return json(409, { error: 'Reserva expirada. Volte ao evento e escolha os ingressos de novo.' })
    }
    if (!pedido.gateway_payment_id && !validarEmail(pedido.customer_email || user.email)) {
      return json(400, { error: 'Sua conta não tem e-mail cadastrado. Cadastre um e-mail no perfil para pagar.' })
    }
    const existente = async (id: string) => resposta(pedido, await d.pagbank(`/orders/${encodeURIComponent(id)}`, { method: 'GET' }))
    if (pedido.gateway_payment_id) return await existente(pedido.gateway_payment_id)

    const totalCentavos = reaisParaCentavos(pedido.total)
    if (!Number.isInteger(totalCentavos) || totalCentavos <= 0) return json(409, { error: 'Este pedido não precisa de pagamento.' })

    const taxa = reaisParaCentavos(Number(pedido.service_fee) + Number(pedido.processing_fee))
    const dias = Number(d.env('PAGBANK_CUSTODIA_DIAS_APOS_EVENTO') || '7') // pendente: decisão do Ricardo (regra de repasse ao produtor)
    const fim = new Date(pedido.evento.end_date ?? pedido.evento.start_date)
    // evento além de reservado_ate + 364 dias: a custódia liberaria ANTES do evento, então sem split
    // pendente: decisão do Ricardo (regra de repasse)
    const alemDoTeto = fim.getTime() + dias * 86_400_000 > reservaAte.getTime() + 364 * 86_400_000
    if (alemDoTeto) log('pedido', pedido.id, 'split omitido: evento além do teto de custódia')
    const splits = Number.isFinite(dias) && !isNaN(fim.getTime()) && !alemDoTeto
      ? montarSplit({ totalCentavos, taxaCentavos: taxa, plataformaId, produtorId: pedido.payout_account_id, liberarEm: calcularLiberacao(fim, dias, reservaAte) })
      : null
    if (!splits && !alemDoTeto) log('pedido', pedido.id, 'sem split (produtor sem conta PagBank válida ou taxa fora da faixa): todo o valor cai na conta da Evokaa')

    const fone = String(cliente.phone ?? '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')
    const telefone = /^\d{10,11}$/.test(fone) ? [{ country: '55', area: fone.slice(0, 2), number: fone.slice(2), type: fone.length === 11 ? 'MOBILE' : 'LANDLINE' }] : undefined
    const corpo = {
      reference_id: pedido.id,
      customer: {
        name: (pedido.customer_name || 'Cliente Evokaa').slice(0, 100),
        email: validarEmail(pedido.customer_email || user.email),
        tax_id: cpf,
        ...(telefone ? { phones: telefone } : {}),
      },
      items: itensDoPedido(pedido, totalCentavos),
      charges: [{
        reference_id: pedido.id,
        description: 'Ingressos Evokaa',
        amount: { value: totalCentavos, currency: 'BRL' },
        payment_method: { type: 'PIX', pix: { expiration_date: calcularExpiracao(reservaAte) } },
        ...(splits ? { splits } : {}),
      }],
      notification_urls: [`${d.env('SUPABASE_URL')}/functions/v1/pagbank-webhook`],
    }
    const idem = await chaveIdempotencia(pedido.id, cpf, /^\d{10,11}$/.test(fone) ? fone : '', cfg.token)
    let criado: Record<string, unknown>
    try {
      criado = await d.pagbank('/orders', { method: 'POST', body: corpo, idempotencia: idem })
    } catch (e) {
      if (!(e instanceof PagbankErro) || e.status < 500) throw e
      // 5xx (inclui o 500 vazio de repetição imediata): UMA nova tentativa com a MESMA chave e o MESMO corpo
      await d.esperar(1500)
      criado = await d.pagbank('/orders', { method: 'POST', body: corpo, idempotencia: idem })
    }
    if (typeof criado.id !== 'string' || !/^ORDE_[0-9A-Fa-f-]+$/.test(criado.id)) throw new Error('PagBank sem id de pedido')
    if (!(await d.gravar(pedido.id, criado.id))) {
      // outra requisição ganhou a corrida: devolve o pedido que já está gravado (mesma chave de idempotência = mesmo pedido no PagBank)
      const atual = await d.carregar(pedido.id, user.id)
      if (!atual?.gateway_payment_id) throw new Error('gravação recusada e pedido sem gateway_payment_id')
      return await existente(atual.gateway_payment_id)
    }
    return await resposta(pedido, criado)
  } catch (e) {
    if (e instanceof PagbankErro && e.status === 409 && e.message.includes('IDEMPOTENCY_CONFLICT')) {
      log('conflito de idempotência', e.message)
      return json(409, { error: 'Não foi possível gerar o Pix para este pedido. Refaça a reserva e tente de novo.' })
    }
    log('pedido', b.order_id, e instanceof Error ? e.message : e)
    return json(502, { error: 'Não foi possível gerar o Pix agora. Tente de novo em instantes.' })
  }
}
