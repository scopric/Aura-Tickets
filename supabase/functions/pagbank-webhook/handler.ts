// Webhook do PagBank: confirma o pagamento de um pedido Pix (fatia 3).
//
// PUBLICAR SEM LOGIN DE USUÁRIO: `supabase functions deploy pagbank-webhook --no-verify-jwt` (o PagBank não manda JWT).
// A única autenticação é a assinatura: x-authenticity-token = sha256 hex de "<PAGBANK_TOKEN>-<corpo exato>" (doc "Confirmar
// autenticidade da notificação"), calculada sobre os BYTES recebidos (sem decodificar antes). Sem ela ou errada: 401 e nada é
// consultado. Faltou PAGBANK_TOKEN, PAGBANK_BASE_URL, SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY: 503 (nunca aceita sem conferir).
//
// A assinatura é conferida ANTES de olhar o formato. Notificação pós-transação (form notificationCode=...) ou corpo que não é JSON:
// 200 e ignora SE vier assinada; sem assinatura recebe 401 como qualquer outra.
// pendente: confirmar no primeiro webhook real do sandbox se a notificação pós-transação vem assinada (se não vier e o PagBank
// reenviar após 401, ela entra em laço de reenvio: aí responder 200 ao form antes da assinatura, já que ele não processa nada).
//
// O corpo só fornece o id ORDE_; valor, order_id (reference_id), charge e paid_at vêm da CONSULTA GET /orders/{id}.
// pendente: confirmar no primeiro webhook real do sandbox. O exemplo da doc de autenticidade mostra corpo com id CHAR_ (cobrança),
// não ORDE_. Hoje id CHAR_ é ignorado com log (nenhum pagamento é confirmado). A doc de GET /charges/{id} não traz link nem id do
// pedido (no sandbox, a charge DENTRO do pedido tem metadata.ps_order_id; não verificado em GET /charges): por isso não foi implementado.
//
// Desfechos de confirmar_pedido_pago (contrato no cabeçalho de docs/sql/20261101_pagbank_base.sql):
//   pago, ja_pago -> 200 | estorno, valor_divergente -> cancela a charge (ver estornar) e 200; falha -> 502 (PagBank reenvia)
//   conflito, nao_encontrado -> NÃO estorna, alerta e 200 (reconciliação manual) | erro da RPC -> 500 + alerta.
//
// Estorno SEM chave de idempotência: o PagBank queima a chave na 1ª tentativa mesmo quando ela falha (sandbox, 08/10/2026: 400 e,
// na repetição com a mesma chave, 409 idempotency_key_in_use), então uma chave fixa travaria o estorno para sempre. A proteção
// contra estorno em dobro é o ESTADO: só cancela charge PAID com refunded < paid; charge que já saiu de PAID não chama a RPC; se o
// cancelamento falhar, relê o pedido e, se a charge já não está PAID ou já foi toda estornada, é sucesso.
// ponytail: dois webhooks simultâneos podem pedir o cancelamento juntos; o segundo leva erro do PagBank, relê e vira sucesso.
//
// ALERTAS: toda linha começa com `ALERTA_PAGBANK <codigo> <id curto>` (filtrar nos logs da função por ALERTA_PAGBANK).
//   CONSULTA_FALHOU      GET /orders falhou (502, PagBank reenvia). Ação: só se repetir; ver status do PagBank.
//   CHARGE_INVALIDA      charge PAID sem id/valor/paid_at válidos (502). Ação: abrir o pedido no painel PagBank.
//   VARIAS_PAID          mais de uma charge PAID no pedido (200, nada feito). Ação: reconciliar e estornar à mão a excedente.
//   RPC_ERRO             confirmar_pedido_pago lançou (500). Ação: dinheiro pode ter entrado sem desfecho; ver logs do banco.
//   ESTORNO_FALHOU       cancelamento falhou e a charge segue PAID (502, PagBank reenvia). Ação: se repetir, estornar no painel.
//   ESTORNO_STATUS       cancelamento falhou e a charge saiu de PAID por outro motivo (disputa/chargeback; 200, sem repetir). Ação: reconciliar à mão.
//   CONFLITO             o ORDE_ já é de outro pedido (200). Ação: conferir os dois pedidos antes de estornar à mão.
//   NAO_ENCONTRADO       reference_id sem pedido no banco (200). Ação: investigar; estornar à mão se não houver pedido.
//   RETORNO_DESCONHECIDO a RPC devolveu algo fora do contrato (200, sem estorno). Ação: conferir a versão da função no banco.
// pendente: decisão do Ricardo (canal de alerta): hoje só o log da função; e-mail ou tabela no admin ficam para depois.
//
// Testes: cd supabase && deno test --allow-env functions/pagbank-webhook/handler_test.ts
import { mascarar } from '../_shared/pagbank.ts'

export type Deps = {
  env: (k: string) => string
  pagbank: (caminho: string, init: { method: 'GET' | 'POST'; body?: unknown; idempotencia?: string }) => Promise<Record<string, unknown>>
  /** rpc('confirmar_pedido_pago', args) com service role; erro do banco lança */
  confirmar: (args: Record<string, unknown>) => Promise<string>
  log: (msg: string) => void
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ORDE_RE = /^ORDE_[0-9A-Fa-f-]{36}$/
const CHAR_RE = /^CHAR_[0-9A-Fa-f-]{36}$/
const MAX_CORPO = 64 * 1024
const OBRIGATORIAS = ['PAGBANK_TOKEN', 'PAGBANK_BASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']

const ok = (s = 200) => new Response(JSON.stringify({ ok: s < 300 }), { status: s, headers: { 'Content-Type': 'application/json' } })
const curto = (id: string) => id.slice(0, 13)

/** Lê o corpo em BYTES, parando em MAX_CORPO; null = passou do teto. */
async function lerCorpo(req: Request): Promise<Uint8Array | null> {
  if (Number(req.headers.get('content-length') ?? 0) > MAX_CORPO) return null
  const leitor = req.body?.getReader()
  if (!leitor) return new Uint8Array()
  const partes: Uint8Array[] = []
  let n = 0
  for (;;) {
    const { done, value } = await leitor.read()
    if (done) break
    n += value.length
    if (n > MAX_CORPO) { await leitor.cancel(); return null }
    partes.push(value)
  }
  const tudo = new Uint8Array(n)
  let p = 0
  for (const x of partes) { tudo.set(x, p); p += x.length }
  return tudo
}

/** sha256 hex de "<token>-" seguido dos bytes exatos do corpo. */
export async function assinatura(token: string, corpo: Uint8Array | string): Promise<string> {
  const b = typeof corpo === 'string' ? new TextEncoder().encode(corpo) : corpo
  const pre = new TextEncoder().encode(`${token}-`)
  const tudo = new Uint8Array(pre.length + b.length)
  tudo.set(pre); tudo.set(b, pre.length)
  const h = await crypto.subtle.digest('SHA-256', tudo)
  return [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, '0')).join('')
}

/** Comparação em tempo constante (o tamanho, 64 hex, não é segredo). */
function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

type Charge = { id?: string; status?: string; paid_at?: string; amount?: { summary?: { paid?: number; refunded?: number } } }
const chargesDe = (p: Record<string, unknown>) => (Array.isArray(p.charges) ? p.charges : []) as Charge[]

export async function handler(req: Request, d: Deps): Promise<Response> {
  if (req.method !== 'POST') return ok(405)
  const token = d.env('PAGBANK_TOKEN').trim()
  if (OBRIGATORIAS.some(k => !d.env(k).trim())) { d.log('pagbank-webhook: configuração ausente'); return ok(503) }
  // prefixo fora do mascarar: o id curto (8 hex do pedido ou ORDE_ curto) não é dado pessoal e seria apagado pela regra de 8+ dígitos
  const alerta = (cod: string, id: string, extra = '') => d.log(`ALERTA_PAGBANK ${cod} ${id}${extra ? ' ' + mascarar(extra, token) : ''}`)

  const bytes = await lerCorpo(req)
  if (bytes === null) return ok(413)
  const recebida = (req.headers.get('x-authenticity-token') ?? '').trim().toLowerCase()
  if (!recebida || !iguais(await assinatura(token, bytes), recebida)) { d.log('pagbank-webhook: assinatura ausente ou inválida'); return ok(401) }
  const corpo = new TextDecoder().decode(bytes)

  let j: Record<string, unknown>
  try { j = JSON.parse(corpo) } catch {
    const tipo = new URLSearchParams(corpo).get('notificationType')
    d.log(`pagbank-webhook: ignorado (não é JSON; notificationType=${String(tipo).slice(0, 20).replace(/[^\w]/g, '')})`)
    return ok()
  }
  const id = typeof j?.id === 'string' ? j.id : ''
  if (!ORDE_RE.test(id)) { d.log(`pagbank-webhook: ignorado (id não é ORDE_${CHAR_RE.test(id) ? '; veio CHAR_' : ''})`); return ok() }

  let pedido: Record<string, unknown>
  try { pedido = await d.pagbank(`/orders/${id}`, { method: 'GET' }) } catch (e) {
    alerta('CONSULTA_FALHOU', curto(id), e instanceof Error ? e.message : 'erro')
    return ok(502)
  }
  const ref = pedido.reference_id
  if (pedido.id !== id || typeof ref !== 'string' || !UUID_RE.test(ref)) { d.log(`pagbank-webhook: ignorado ${curto(id)} (reference_id não é pedido Evokaa)`); return ok() }
  const pid = ref.slice(0, 8)

  const charges = chargesDe(pedido)
  const pagas = charges.filter(x => x?.status === 'PAID')
  if (pagas.length > 1) { alerta('VARIAS_PAID', pid, `${pagas.length} charges PAID em ${curto(id)}`); return ok() }
  const c = pagas[0]
  if (!c) { d.log(`pagbank-webhook: ${curto(id)} sem charge PAID (${charges.map(x => String(x?.status).slice(0, 12)).join(',')}), nada a fazer`); return ok() }
  const pago = c.amount?.summary?.paid
  const estornado = c.amount?.summary?.refunded ?? 0
  if (typeof c.id !== 'string' || !CHAR_RE.test(c.id) || !Number.isInteger(pago) || pago! <= 0 || !Number.isInteger(estornado) || estornado < 0 ||
    typeof c.paid_at !== 'string' || isNaN(Date.parse(c.paid_at))) {
    alerta('CHARGE_INVALIDA', pid, curto(id))
    return ok(502)
  }
  const cid = c.id

  let res: string
  try {
    res = await d.confirmar({ p_order_id: ref, p_gateway_payment_id: id, p_valor_pago_centavos: pago, p_event_id: `${cid}:PAID:${c.paid_at}`, p_pago_em: c.paid_at })
  } catch (e) {
    alerta('RPC_ERRO', pid, `${curto(cid)} ${e instanceof Error ? e.message.slice(0, 200) : 'erro'}`)
    return ok(500)
  }

  if (res === 'pago' || res === 'ja_pago') { d.log(`pagbank-webhook: pedido ${pid} ${res}`); return ok() }
  if (res === 'estorno' || res === 'valor_divergente') {
    const falta = pago! - estornado
    if (falta <= 0) { d.log(`pagbank-webhook: pedido ${pid} ${res}: ${curto(cid)} já estornada`); return ok() }
    try {
      await d.pagbank(`/charges/${cid}/cancel`, { method: 'POST', body: { amount: { value: falta } } })
    } catch (e) {
      // pode ter sido cancelada por outra tentativa: relê o estado antes de alarmar
      try {
        const de = chargesDe(await d.pagbank(`/orders/${id}`, { method: 'GET' })).find(x => x?.id === cid)
        const s = de?.amount?.summary
        if (de && (de.status === 'CANCELED' || (s?.refunded ?? 0) >= (s?.paid ?? Infinity))) {
          d.log(`pagbank-webhook: pedido ${pid} ${res}: ${curto(cid)} já estornada (${String(de.status).slice(0, 12)})`)
          return ok()
        }
        // saiu de PAID por outro motivo (disputa, chargeback...): o dinheiro NÃO voltou ao cliente; alerta e 200 (nada a repetir)
        if (de && de.status !== 'PAID') {
          alerta('ESTORNO_STATUS', pid, `${res} ${curto(cid)} status ${String(de.status).slice(0, 16)}, reconciliar à mão`)
          return ok()
        }
      } catch { /* releitura falhou: cai no alerta */ }
      alerta('ESTORNO_FALHOU', pid, `${res} ${curto(cid)} ${e instanceof Error ? e.message : 'erro'}`)
      return ok(502)
    }
    d.log(`pagbank-webhook: pedido ${pid} ${res}: estornado ${curto(cid)} ${falta} centavos`)
    return ok()
  }
  alerta(res === 'conflito' ? 'CONFLITO' : res === 'nao_encontrado' ? 'NAO_ENCONTRADO' : 'RETORNO_DESCONHECIDO', pid, `${curto(cid)} sem estorno, reconciliar à mão`)
  return ok()
}
