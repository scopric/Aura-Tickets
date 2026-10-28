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
// Assim a chave de idempotência `<order.id>-<hash(cpf|telefone)>` devolve o MESMO pedido nas repetições. O Pix vence em
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
  /** `acao` = ação do reCAPTCHA v3 (padrão 'pagbank_checkout' no Pix; o cartão usa 'pagbank_cartao') */
  captcha: (token: string, ip: string | null, acao?: string) => Promise<boolean>
  /** Pedido do usuário `userId`; pedido de outro ou inexistente = null (e nada mais é consultado); erro de banco lança */
  carregar: (orderId: string, userId: string) => Promise<Pedido | null>
  /** update ... where id and status='pending' and gateway_payment_id is null; true se gravou */
  gravar: (orderId: string, pagbankId: string) => Promise<boolean>
  /** Limite por chave (cartão: pedido, IP, 3DS): devolve a resposta de recusa (429 igual à do Pix; outro status = tabela de limite falhou) ou null */
  limitarChave: (req: Request, prefixo: string, chave: string, max: number) => Promise<Response | null>
  /** Trava do cartão ANTES de cobrar: update orders set gateway_payment_id='CARTAO-'||id where id and status='pending' and gateway_payment_id is null; true se travou */
  trava: (orderId: string) => Promise<boolean>
  /** Solta a trava: set gateway_payment_id=null where gateway_payment_id='CARTAO-'||id */
  destravar: (orderId: string) => Promise<void>
  /** Troca a trava pelo ORDE_ real (e grava payment_method='credit_card'): where gateway_payment_id='CARTAO-'||id; true se trocou */
  trocar: (orderId: string, pagbankId: string) => Promise<boolean>
  pagbank: (caminho: string, init: { method: 'GET' | 'POST'; body?: unknown; idempotencia?: string }) => Promise<Record<string, unknown>>
  agora: () => Date
  esperar: (ms: number) => Promise<void>
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ORDE_RE = /^ORDE_[0-9A-Fa-f-]+$/
const EM_ANDAMENTO = 'Já existe um pagamento em andamento para este pedido.'
const MSG_INCERTO = 'Não conseguimos confirmar o pagamento. Aguarde alguns minutos e confira Meus ingressos antes de tentar de novo.'
export const MAX_CORPO = 4096
const HOSTS = ORIGENS.map(o => new URL(o).hostname)
// os interruptores de teste (RECAPTCHA_ALLOW_LOCALHOST aqui e PAGBANK_WEBHOOK_SEM_ASSINATURA no webhook) morrem sozinhos no dia do lançamento
export const ATE_LANCAMENTO = Date.parse('2026-10-16T00:00:00-03:00')

/** Lê o corpo parando em MAX_CORPO bytes; null = passou do teto. Confere Content-Length antes de ler. */
export async function lerCorpo(req: Request): Promise<string | null> {
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
  token: string, ip: string | null, env: (k: string) => string, fetchFn: typeof fetch = fetch, acao = 'pagbank_checkout',
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
    if (!r.ok) { console.error('[pagbank-criar-pedido] recaptcha: Google respondeu HTTP', r.status); return false }
    const j = await r.json()
    // localhost só em desenvolvimento (RECAPTCHA_ALLOW_LOCALHOST=1 e PagBank no sandbox; em produção real não passa): o app roda em app.localhost e o painel em alpha.localhost
    const dev = env('RECAPTCHA_ALLOW_LOCALHOST') === '1' && env('PAGBANK_BASE_URL').trim().replace(/\/+$/, '') === 'https://sandbox.api.pagseguro.com' && Date.now() < ATE_LANCAMENTO && ['localhost', 'app.localhost', 'alpha.localhost'].includes(String(j.hostname))
    const ok = j.success === true && j.action === acao && (HOSTS.includes(String(j.hostname)) || dev)
       && typeof j.score === 'number' && j.score >= minimo
    // diagnóstico: só campos que o Google devolve (nenhum segredo nem token)
    if (ok && dev && !HOSTS.includes(String(j.hostname))) console.error('[pagbank-criar-pedido] ALERTA_PAGBANK RECAPTCHA_LOCALHOST token de localhost aceito (desligar RECAPTCHA_ALLOW_LOCALHOST depois do teste)')
    if (!ok) console.error('[pagbank-criar-pedido] recaptcha recusado', JSON.stringify({ success: j.success, erros: j['error-codes'], host: j.hostname, acao: j.action, score: j.score }))
    return ok
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
  // ramo do cartão (corpo traz `cartao`): valida o formato; o cartão cifrado (`encrypted`) nunca é logado nem devolvido
  let cartao: { encrypted: string; three_ds_id: string; holder_name: string } | null = null
  if (b.cartao !== undefined) {
    const c = (b.cartao ?? {}) as Record<string, unknown>
    const nome = typeof c.holder_name === 'string' ? c.holder_name.trim() : ''
    if (typeof c.encrypted !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(c.encrypted) || c.encrypted.length < 200 || c.encrypted.length > 600
      || typeof c.three_ds_id !== 'string' || !/^3DS_[0-9A-Fa-f-]{36}$/.test(c.three_ds_id) || !/^[\p{L} '.-]{2,60}$/u.test(nome)) {
      return json(400, { error: 'Dados do cartão inválidos.' })
    }
    cartao = { encrypted: c.encrypted, three_ds_id: c.three_ds_id, holder_name: nome }
    // limites próprios do cartão (além do por usuário): por pedido (5) e por IP (15) em 10 min
    const lp = await d.limitarChave(req, 'pagbank-cartao-pedido:', b.order_id, 5)
    if (lp) return lp
    const lip = await d.limitarChave(req, 'pagbank-cartao-ip:', clientIp(req.headers).ip ?? '', 15)
    if (lip) return lip
  }

  if (!(await d.captcha(b.captcha_token, clientIp(req.headers).ip, cartao ? 'pagbank_cartao' : 'pagbank_checkout'))) {
    return json(400, { error: 'Não foi possível validar a segurança do pagamento. Recarregue a página e tente de novo.' })
  }

  // Resposta única ao cliente: só order_id, pix_copia_e_cola e expira_em. O QR é desenhado pela tela a partir do copia-e-cola
  // (o link PNG/BASE64 do PagBank exige o token e carrega o id do QR; não é repassado)
  const resposta = async (pedido: Pedido, o: Record<string, unknown>) => {
    const c = ((o.charges as Record<string, unknown>[] | undefined) ?? [])[0]
    if ((c?.payment_method as { type?: string } | undefined)?.type === 'CREDIT_CARD') return json(409, { error: EM_ANDAMENTO })
    const pix = (c?.payment_method as { pix?: { expiration_date?: string } } | undefined)?.pix
    const texto = (c?.qr_code as { text?: string } | undefined)?.text
    if (o.reference_id !== pedido.id || !texto || !pix?.expiration_date) throw new Error('resposta do PagBank sem os campos esperados')
    const expira = new Date(pix.expiration_date)
    if (!(expira.getTime() > d.agora().getTime())) return json(409, { error: 'O Pix deste pedido expirou. Volte ao evento e faça a reserva de novo.' })
    return json(200, { order_id: pedido.id, pix_copia_e_cola: texto, expira_em: expira.toISOString() })
  }
  // Cartão, lista fechada de status do charge: PAID = 'pago'; AUTHORIZED/IN_ANALYSIS/WAITING = 'processando'; o resto (DECLINED,
  // CANCELED, desconhecido) = recusado (402, sem gravar e com a trava solta); null = resposta ilegível (resultado incerto).
  // Quem confirma o pedido no banco é o pagbank-webhook, nunca esta função.
  const statusCartao = (pedido: Pedido, o: Record<string, unknown>) => {
    const c = ((o.charges as Record<string, unknown>[] | undefined) ?? [])[0]
    if (o.reference_id !== pedido.id || typeof c?.status !== 'string') return null
    if (c.status === 'PAID') return 'pago'
    return ['AUTHORIZED', 'IN_ANALYSIS', 'WAITING'].includes(c.status) ? 'processando' : 'recusado'
  }
  const respCartao = (st: 'pago' | 'processando' | 'recusado') => st === 'recusado'
    ? json(402, { error: 'Cartão recusado pelo banco. Confira os dados ou tente outro cartão.' })
    : json(200, { ok: true, status: st })
  // log do erro do cartão: SÓ status, code e parameter_name (nunca a mensagem inteira); valor igual a trecho do cartão cifrado/3DS vira ***
  const resumoPb = (e: unknown) => {
    if (!(e instanceof PagbankErro)) return e instanceof Error ? e.name : 'erro'
    const ruim = (t: string) => t.length >= 12 && !!cartao && (cartao.encrypted.includes(t) || cartao.three_ds_id.includes(t))
    const m = [...e.message.matchAll(/code=(\S{1,60}) param=(\S{1,60})/g)]
    return `status=${e.status} ` + m.map(x => `code=${ruim(x[1]) ? '***' : x[1]} param=${ruim(x[2]) ? '***' : x[2]}`).join('; ')
  }
  // Cobrança do cartão com a trava já tomada. Falha DEFINITIVA sem cobrança = solta a trava (pode tentar de novo); resultado INCERTO
  // (timeout, 5xx, rede, resposta ilegível) = MANTÉM a trava: a reserva vence em 10 min e o webhook paga o pedido se a cobrança existiu.
  const cobrarCartao = async (pedido: Pedido, corpo: unknown, idem: string, total: number, userId: string) => {
    const alerta = (m: string) => console.error('[pagbank-criar-pedido] ALERTA_PAGBANK', mascarar(`${m} pedido=${pedido.id.slice(0, 8)}`, cfg.token))
    const liberar = () => d.destravar(pedido.id).catch(() => alerta('CARTAO_TRAVA_NAO_LIBERADA'))
    const incerto = () => { alerta('CARTAO_RESULTADO_INCERTO'); return json(502, { error: MSG_INCERTO }) }
    let criado: Record<string, unknown>
    try {
      try {
        criado = await d.pagbank('/orders', { method: 'POST', body: corpo, idempotencia: idem })
      } catch (e) {
        if (!(e instanceof PagbankErro) || e.status < 500) throw e
        await d.esperar(1500)
        criado = await d.pagbank('/orders', { method: 'POST', body: corpo, idempotencia: idem })
      }
    } catch (e) {
      log('cartão: erro do PagBank', resumoPb(e))
      if (!(e instanceof PagbankErro) || e.status >= 500) return incerto()
      await liberar()
      if (e.status === 400 && /AUTHENTICATION_METHOD/i.test(e.message)) return json(409, { error: 'A verificação do cartão não confere com o valor do pedido. Tente de novo.' })
      if (e.status === 409 && e.message.includes('IDEMPOTENCY_CONFLICT')) return json(409, { error: 'Não foi possível processar o cartão. Tente de novo.' })
      return json(502, { error: 'Não foi possível processar o cartão agora. Tente de novo em instantes.' })
    }
    const st = statusCartao(pedido, criado)
    if (!st || typeof criado.id !== 'string' || !ORDE_RE.test(criado.id)) return incerto()
    if (st === 'recusado') { await liberar(); return respCartao(st) }
    let trocou: boolean
    try { trocou = await d.trocar(pedido.id, criado.id) } catch { alerta('CARTAO_TROCA_FALHOU'); return respCartao(st) } // o webhook ainda paga pelo reference_id
    if (trocou) return respCartao(st)
    // a trava não está mais lá: ou o webhook já gravou ESTE pedido, ou há outra cobrança
    const atual = await d.carregar(pedido.id, userId).catch(() => null)
    if (atual?.gateway_payment_id === criado.id) return respCartao(st)
    alerta('CARTAO_COBRANCA_DUPLICADA')
    const ch = (criado.charges as { id?: unknown; status?: string }[])[0]
    if ((ch.status === 'PAID' || ch.status === 'AUTHORIZED') && typeof ch.id === 'string' && /^CHAR_[0-9A-Fa-f-]+$/.test(ch.id)) {
      await d.pagbank(`/charges/${ch.id}/cancel`, { method: 'POST', body: { amount: { value: total } } }).catch(() => alerta('CARTAO_CANCELAMENTO_FALHOU'))
    }
    return json(409, { error: EM_ANDAMENTO })
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
    const existente = async (id: string) => {
      // valor provisório da trava do cartão ('CARTAO-<pedido>') ou qualquer coisa que não seja ORDE_: nunca vai ao PagBank
      if (!ORDE_RE.test(id)) return json(409, { error: EM_ANDAMENTO })
      const o = await d.pagbank(`/orders/${encodeURIComponent(id)}`, { method: 'GET' })
      if (!cartao) return resposta(pedido, o)
      const tipo = (((o.charges as Record<string, unknown>[] | undefined) ?? [])[0]?.payment_method as { type?: string } | undefined)?.type
      if (tipo !== 'CREDIT_CARD') return json(409, { error: EM_ANDAMENTO })
      const st = statusCartao(pedido, o)
      if (!st) throw new Error('resposta do PagBank sem os campos esperados')
      return respCartao(st)
    }
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
        payment_method: cartao
          ? {
            type: 'CREDIT_CARD', installments: 1, capture: true, soft_descriptor: 'EVOKAA',
            card: { encrypted: cartao.encrypted, store: false }, holder: { name: cartao.holder_name, tax_id: cpf },
            authentication_method: { type: 'THREEDS', id: cartao.three_ds_id },
          }
          : { type: 'PIX', pix: { expiration_date: calcularExpiracao(reservaAte) } },
        ...(splits ? { splits } : {}),
      }],
      notification_urls: [`${d.env('SUPABASE_URL')}/functions/v1/pagbank-webhook`],
    }
    // cartão: chave = HMAC(pedido | 3DS | cpf); NUNCA o cartão cifrado (cada cifragem muda e daria 409) nem o telefone
    const idem = await chaveIdempotencia(pedido.id, cpf, cartao ? cartao.three_ds_id : /^\d{10,11}$/.test(fone) ? fone : '', cfg.token)
    if (cartao) {
      // 3DS de uso único: segunda vez = 409; tabela de limite falhou = fecha (503)
      const l3 = await d.limitarChave(req, 'pagbank-3ds:', cartao.three_ds_id, 1)
      if (l3) return l3.status === 429 ? json(409, { error: 'A verificação do cartão já foi usada. Tente de novo.' }) : indisponivel()
      // trava atômica ANTES de cobrar: 0 linhas = outro pagamento em andamento ou já feito
      if (!(await d.trava(pedido.id))) return json(409, { error: EM_ANDAMENTO })
      return await cobrarCartao(pedido, corpo, idem, totalCentavos, user.id)
    }
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
    if (!cartao && e instanceof PagbankErro && e.status === 409 && e.message.includes('IDEMPOTENCY_CONFLICT')) {
      log('conflito de idempotência', e.message)
      return json(409, { error: 'Não foi possível gerar o Pix para este pedido. Refaça a reserva e tente de novo.' })
    }
    log('pedido', b.order_id, cartao ? resumoPb(e) : e instanceof Error ? e.message : e)
    return json(502, { error: cartao ? 'Não foi possível processar o cartão agora. Tente de novo em instantes.' : 'Não foi possível gerar o Pix agora. Tente de novo em instantes.' })
  }
}
