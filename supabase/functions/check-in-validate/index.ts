// Check-in na portaria: valida o QR do ingresso e marca como usado.
//
// Chamada: POST com o JWT de quem opera a portaria (supabase.functions.invoke('check-in-validate')),
// corpo { qrCode, eventId }. Quem registra o check-in é sempre o dono do token (checked_in_by).
// Pode operar: o produtor do evento, membro aceito da equipe dele com papel admin ou editor
// (team_members) ou admin da plataforma com manage_tickets (gf_admin_can: admin só com 2FA e o código).
// Conta com 2FA: só com o código.
// Dois formatos de código: o QR dinâmico "E1.<id>.<código>" (muda a cada 30 s; vale a janela atual ±1, ~90 s; Decisão 211) e o UUID fixo
// de antes (tickets.qr_code), que só vale enquanto o ingresso não passou a usar o dinâmico (tickets.qr_dinamico_desde) e QR_FIXO_ACEITO estiver ligado.
// Respostas: 200 { valid, message, ... } (inclusive "já utilizado"); 404 ingresso não encontrado ou código inválido/vencido;
// 400 corpo inválido; 401 sem login; 403 sem permissão ou sem o código do 2FA; 429 leituras demais.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'
import { corsHeaders } from '../_shared/cors.ts'
import { lerQr, verificar } from '../_shared/ingressoCodigo.ts'
import { adminCan, mfaOk } from '../_shared/mfa.ts'

// Quando o Ricardo decidir, false = só o QR dinâmico entra (o UUID fixo deixa de valer para todos os ingressos).
const QR_FIXO_ACEITO = true
const MSG_FIXO = 'Este código fixo não vale mais. Peça para o participante abrir o QR no app.'
const MSG_VENCIDO = 'Código inválido ou vencido. Peça para atualizar o QR na tela do celular.'

// ponytail: contadores em memória por instância da função (primeira barreira contra palpite em série; 40 bits por janela já tornam isso inviável).
// Se virar problema real, mover para o banco. Cada mapa guarda { n, desde } por chave.
// Por operador conta toda leitura; por ingresso conta só FALHA (leitura válida não gasta o limite: a portaria legítima nunca se bloqueia).
const OPERADOR_POR_MIN = 120, INGRESSO_POR_MIN = 10, JANELA_MS = 60_000
const operadores = new Map<string, { n: number; desde: number }>()
const ingressos = new Map<string, { n: number; desde: number }>()
function dentro(mapa: Map<string, { n: number; desde: number }>, chave: string, limite: number): boolean {
  const agora = Date.now()
  if (mapa.size > 5000) for (const [k, v] of mapa) if (agora - v.desde > JANELA_MS) mapa.delete(k)
  const v = mapa.get(chave)
  if (!v || agora - v.desde > JANELA_MS) { mapa.set(chave, { n: 1, desde: agora }); return true }
  return ++v.n <= limite
}
const bloqueado = (mapa: Map<string, { n: number; desde: number }>, chave: string, limite: number) => {
  const v = mapa.get(chave)
  return !!v && Date.now() - v.desde <= JANELA_MS && v.n >= limite
}
function anotarFalha(mapa: Map<string, { n: number; desde: number }>, chave: string) {
  const agora = Date.now()
  const v = mapa.get(chave)
  if (!v || agora - v.desde > JANELA_MS) mapa.set(chave, { n: 1, desde: agora })
  else v.n++
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'Método não permitido' })

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'Faça login para fazer o check-in.' })

  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return json(401, { error: 'Faça login para fazer o check-in.' })
  if (!(await mfaOk(req))) return json(403, { error: 'Confirme o código do 2FA (saia e entre de novo).' })
  if (!dentro(operadores, user.id, OPERADOR_POR_MIN)) return json(429, { error: 'Muitas leituras seguidas. Espere um instante.' })

  let qrCode = '', eventId = ''
  try {
    const b = await req.json()
    qrCode = typeof b?.qrCode === 'string' ? b.qrCode.trim() : ''
    eventId = typeof b?.eventId === 'string' ? b.eventId : ''
  } catch {
    // corpo inválido cai no 400 abaixo
  }
  if (!qrCode || qrCode.length > 100 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId)) return json(400, { error: 'Informe o código do ingresso e o evento.' })

  // Quem pode operar a portaria deste evento
  // Falha do banco vira "tente de novo" (500), nunca "sem permissão" ou "não encontrado"
  const falhou = (etapa: string, msg: string) => {
    console.error(`[check-in-validate] ${etapa}:`, msg)
    return json(500, { error: 'Não foi possível conferir agora. Tente de novo.' })
  }
  const { data: evento, error: eventoError } = await admin.from('events').select('producer_id').eq('id', eventId).maybeSingle()
  if (eventoError) return falhou('evento', eventoError.message)
  if (!evento) return json(404, { valid: false, message: 'Evento não encontrado.' })
  let pode = evento.producer_id === user.id
  if (!pode) {
    const { data: membro, error: membroError } = await admin.from('team_members').select('id')
      .eq('producer_id', evento.producer_id).eq('user_id', user.id)
      .in('role', ['admin', 'editor']).not('accepted_at', 'is', null).is('blocked_at', null).limit(1)
    if (membroError) return falhou('equipe', membroError.message)
    pode = !!membro?.length
  }
  if (!pode) {
    // admin da plataforma: o banco decide (exige 2FA com o código, Decisão 99)
    const r = await adminCan(req, 'manage_tickets')
    if (r === null) return falhou('admin', 'gf_admin_can')
    pode = r
  }
  if (!pode) return json(403, { error: 'Você não tem permissão para fazer check-in neste evento.' })

  // QR dinâmico (E1.<id>.<código>) busca pelo id; o UUID fixo busca por qr_code.
  // O limite por ingresso é por EVENTO + ingresso: quem não opera este evento (já barrado acima) nunca gasta o limite da portaria legítima.
  const dinamico = lerQr(qrCode)
  const chaveIng = dinamico ? `${eventId}:${dinamico.ticketId}` : ''
  if (dinamico && bloqueado(ingressos, chaveIng, INGRESSO_POR_MIN)) return json(429, { error: 'Muitas leituras deste ingresso. Espere um instante.' })
  const consulta = admin.from('tickets')
    // '*' de propósito: se o SQL 20261031c ainda não foi aplicado, qr_dinamico_desde vem undefined e o QR fixo segue valendo como hoje (a função
    // não devolve o registro). Com colunas nomeadas, a coluna ausente derrubaria o check-in de todo mundo com 500.
    .select('*, ticket_types(name)')
    .eq('event_id', eventId)
  const { data: ticket, error: ticketError } = await (dinamico ? consulta.eq('id', dinamico.ticketId) : consulta.eq('qr_code', qrCode)).maybeSingle()
  if (ticketError) return falhou('ingresso', ticketError.message)
  // Mesma resposta para ingresso que não existe, de outro evento ou com código errado/vencido: nada de oráculo.
  if (dinamico) {
    if (!ticket) { anotarFalha(ingressos, chaveIng); return json(404, { valid: false, message: MSG_VENCIDO }) }
    const segredo = Deno.env.get('INGRESSO_SEGREDO') ?? ''
    if (segredo.length < 32) return falhou('segredo', 'INGRESSO_SEGREDO ausente ou curto')
    if (!(await verificar(segredo, ticket.id, ticket.transfer_count, dinamico.codigo, Date.now()))) {
      anotarFalha(ingressos, chaveIng)
      console.warn('[check-in-validate] código dinâmico inválido', { operador: user.id, ingresso: ticket.id }) // nunca o código
      return json(404, { valid: false, message: MSG_VENCIDO })
    }
    ingressos.delete(chaveIng) // código certo: zera as falhas deste ingresso
  } else {
    if (!ticket) return json(404, { valid: false, message: 'Ingresso não encontrado ou inválido para este evento' })
    // QR fixo: vale só até o dono abrir o dinâmico (e só enquanto o Ricardo mantiver QR_FIXO_ACEITO)
    if (!QR_FIXO_ACEITO || ticket.qr_dinamico_desde) return json(200, { valid: false, message: MSG_FIXO })
  }

  if (ticket.status === 'used') {
    return json(200, { valid: false, message: 'Ingresso já foi utilizado.', checkedInAt: ticket.checked_in_at, buyerName: ticket.buyer_name })
  }
  if (ticket.status !== 'active') {
    return json(200, { valid: false, message: `Ingresso indisponível (Status: ${ticket.status})` })
  }

  // "where status = active": duas leituras ao mesmo tempo não fazem check-in duplo
  const agora = new Date().toISOString()
  const { data: marcado, error: updateError } = await admin.from('tickets')
    .update({ status: 'used', checked_in_at: agora, checked_in_by: user.id })
    .eq('id', ticket.id).eq('status', 'active')
    .select('id').maybeSingle()
  if (updateError) return falhou('update', updateError.message)
  if (!marcado) return json(200, { valid: false, message: 'Ingresso já foi utilizado.' })

  const { error: logError } = await admin.from('check_ins')
    .insert({ event_id: eventId, ticket_id: ticket.id, user_id: ticket.user_id, checked_in_by: user.id, checked_in_at: agora })
  if (logError) console.error('[check-in-validate] registro em check_ins:', logError.message)

  const tipo = ticket.ticket_types as unknown as { name?: string } | null
  return json(200, { valid: true, message: 'Check-in realizado com sucesso.', buyerName: ticket.buyer_name, ticketType: tipo?.name })
})
