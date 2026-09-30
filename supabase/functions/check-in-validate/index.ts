// Check-in na portaria: valida o QR do ingresso e marca como usado.
//
// Chamada: POST com o JWT de quem opera a portaria (supabase.functions.invoke('check-in-validate')),
// corpo { qrCode, eventId }. Quem registra o check-in é sempre o dono do token (checked_in_by).
// Pode operar: o produtor do evento, membro aceito da equipe dele com papel admin ou editor
// (team_members) ou admin da plataforma com manage_tickets. Conta com 2FA: só com o código.
// Respostas: 200 { valid, message, ... } (inclusive "já utilizado"); 404 ingresso não encontrado;
// 400 corpo inválido; 401 sem login; 403 sem permissão ou sem o código do 2FA.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'
import { corsHeaders } from '../_shared/cors.ts'
import { mfaOk } from '../_shared/mfa.ts'

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
      .in('role', ['admin', 'editor']).not('accepted_at', 'is', null).limit(1)
    if (membroError) return falhou('equipe', membroError.message)
    pode = !!membro?.length
  }
  if (!pode) {
    const { data: perfil, error: perfilError } = await admin.from('profiles').select('role, admin_permissions').eq('id', user.id).maybeSingle()
    if (perfilError) return falhou('perfil', perfilError.message)
    const perms: string[] = perfil?.admin_permissions ?? []
    // mesma regra do gf_admin_can('manage_tickets') no banco
    pode = perfil?.role === 'admin' && (perms.includes('super_admin') || perms.includes('manage_tickets'))
  }
  if (!pode) return json(403, { error: 'Você não tem permissão para fazer check-in neste evento.' })

  const { data: ticket, error: ticketError } = await admin.from('tickets')
    .select('id, user_id, status, checked_in_at, buyer_name, ticket_types(name)')
    .eq('qr_code', qrCode).eq('event_id', eventId).maybeSingle()
  if (ticketError) return falhou('ingresso', ticketError.message)
  if (!ticket) return json(404, { valid: false, message: 'Ingresso não encontrado ou inválido para este evento' })

  if (ticket.status === 'used') {
    return json(200, { valid: false, message: 'Ingresso já foi utilizado!', checkedInAt: ticket.checked_in_at, buyerName: ticket.buyer_name })
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
  if (!marcado) return json(200, { valid: false, message: 'Ingresso já foi utilizado!' })

  const { error: logError } = await admin.from('check_ins')
    .insert({ event_id: eventId, ticket_id: ticket.id, user_id: ticket.user_id, checked_in_by: user.id, checked_in_at: agora })
  if (logError) console.error('[check-in-validate] registro em check_ins:', logError.message)

  const tipo = ticket.ticket_types as unknown as { name?: string } | null
  return json(200, { valid: true, message: 'Check-in realizado com sucesso!', buyerName: ticket.buyer_name, ticketType: tipo?.name })
})
