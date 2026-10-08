// Webhook do PagBank: confirma o pagamento de um pedido Pix (fatia 3).
//
// PUBLICAR SEM LOGIN DE USUÁRIO: `supabase functions deploy pagbank-webhook --no-verify-jwt` (o PagBank não manda JWT).
// A única autenticação é a assinatura: x-authenticity-token = sha256 hex de "<PAGBANK_TOKEN>-<corpo exato>" (doc "Confirmar
// autenticidade da notificação"). Sem ela ou errada: 401 e nada é consultado. Sem PAGBANK_TOKEN: 503 (nunca aceita sem conferir).
//
// O corpo só fornece o id ORDE_; valor, order_id (reference_id), charge e paid_at vêm da CONSULTA GET /orders/{id}.
// Desfechos de confirmar_pedido_pago (contrato no cabeçalho de docs/sql/20261101_pagbank_base.sql):
//   pago, ja_pago -> 200 | estorno, valor_divergente -> cancela a charge no PagBank (valor pago inteiro; com split o PagBank
//   debita cada recebedor na proporção) e 200; falha no cancelamento -> 502 (PagBank reenvia) |
//   conflito, nao_encontrado -> NÃO estorna, alerta e 200 (reconciliação manual) | erro da RPC -> 500 + alerta.
// Notificação pós-transação (form notificationCode=...) e corpo que não é JSON: 200 e ignora (fora do escopo desta fatia).
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

const ok = (s = 200) => new Response(JSON.stringify({ ok: s < 300 }), { status: s, headers: { 'Content-Type': 'application/json' } })
const curto = (id: string) => id.slice(0, 13)

/** Lê o corpo como texto uma única vez, parando em MAX_CORPO bytes; null = passou do teto. */
async function lerCorpo(req: Request): Promise<string | null> {
  if (Number(req.headers.get('content-length') ?? 0) > MAX_CORPO) return null
  const leitor = req.body?.getReader()
  if (!leitor) return ''
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
  return new TextDecoder().decode(tudo)
}

export async function assinatura(token: string, corpo: string): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${token}-${corpo}`))
  return [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, '0')).join('')
}

/** Comparação em tempo constante (o tamanho, 64 hex, não é segredo). */
function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

type Charge = { id?: string; status?: string; paid_at?: string; amount?: { summary?: { paid?: number } } }

export async function handler(req: Request, d: Deps): Promise<Response> {
  if (req.method !== 'POST') return ok(405)
  const token = d.env('PAGBANK_TOKEN')
  if (!token || !d.env('PAGBANK_BASE_URL')) { d.log('pagbank-webhook: PAGBANK_TOKEN/PAGBANK_BASE_URL ausente'); return ok(503) }

  const corpo = await lerCorpo(req)
  if (corpo === null) return ok(413)
  const recebida = (req.headers.get('x-authenticity-token') ?? '').trim().toLowerCase()
  if (!recebida || !iguais(await assinatura(token, corpo), recebida)) { d.log('pagbank-webhook: assinatura ausente ou inválida'); return ok(401) }

  let j: Record<string, unknown>
  try { j = JSON.parse(corpo) } catch {
    const tipo = new URLSearchParams(corpo).get('notificationType')
    d.log(`pagbank-webhook: ignorado (não é JSON; notificationType=${String(tipo).slice(0, 20).replace(/[^\w]/g, '')})`)
    return ok()
  }
  const id = typeof j?.id === 'string' ? j.id : ''
  if (!ORDE_RE.test(id)) { d.log('pagbank-webhook: ignorado (id não é ORDE_)'); return ok() }

  let pedido: Record<string, unknown>
  try { pedido = await d.pagbank(`/orders/${id}`, { method: 'GET' }) } catch (e) {
    d.log(mascarar(`pagbank-webhook: consulta ${curto(id)} falhou: ${e instanceof Error ? e.message : 'erro'}`, token))
    return ok(502)
  }
  const ref = pedido.reference_id
  if (pedido.id !== id || typeof ref !== 'string' || !UUID_RE.test(ref)) { d.log(`pagbank-webhook: ignorado ${curto(id)} (reference_id não é pedido Evokaa)`); return ok() }

  const charges = (Array.isArray(pedido.charges) ? pedido.charges : []) as Charge[]
  const c = charges.find(x => x?.status === 'PAID')
  if (!c) { d.log(`pagbank-webhook: ${curto(id)} sem charge PAID (${charges.map(x => String(x?.status).slice(0, 12)).join(',')}), nada a fazer`); return ok() }
  const pago = c.amount?.summary?.paid
  if (typeof c.id !== 'string' || !CHAR_RE.test(c.id) || !Number.isInteger(pago) || pago! <= 0 || typeof c.paid_at !== 'string' || isNaN(Date.parse(c.paid_at))) {
    d.log(`pagbank-webhook: ALERTA ${curto(id)} charge PAID com campos inválidos; reconciliar`)
    return ok(502)
  }

  const pid = ref.slice(0, 8)
  let res: string
  try {
    res = await d.confirmar({ p_order_id: ref, p_gateway_payment_id: id, p_valor_pago_centavos: pago, p_event_id: `${c.id}:PAID:${c.paid_at}`, p_pago_em: c.paid_at })
  } catch (e) {
    d.log(mascarar(`pagbank-webhook: ALERTA pedido ${pid} ${curto(c.id)}: erro na RPC (${e instanceof Error ? e.message.slice(0, 200) : 'erro'}); dinheiro pode ter entrado sem desfecho`, token))
    return ok(500)
  }

  if (res === 'pago' || res === 'ja_pago') { d.log(`pagbank-webhook: pedido ${pid} ${res}`); return ok() }
  if (res === 'estorno' || res === 'valor_divergente') {
    try {
      await d.pagbank(`/charges/${c.id}/cancel`, { method: 'POST', body: { amount: { value: pago } }, idempotencia: `estorno:${c.id}` })
    } catch (e) {
      d.log(mascarar(`pagbank-webhook: ALERTA pedido ${pid} ${res}: estorno de ${curto(c.id)} falhou (${e instanceof Error ? e.message : 'erro'})`, token))
      return ok(502)
    }
    d.log(`pagbank-webhook: pedido ${pid} ${res}: estornado ${curto(c.id)} ${pago} centavos`)
    return ok()
  }
  // conflito, nao_encontrado ou retorno desconhecido: não estornar (o dinheiro pode ser de outro pedido)
  d.log(`pagbank-webhook: ALERTA pedido ${pid} ${String(res).slice(0, 30)} ${curto(c.id)}: sem estorno, reconciliar à mão`)
  return ok()
}
