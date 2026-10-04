// Aceite do produtor ao enviar o evento para aprovação (desenho 5; Decisão 148, item 6), gravado pelo servidor:
// versão e hash do texto final montado aqui (textoAceite: nome do evento, variantes de classificação e de bebida),
// classificação lida do evento gravado, "tem bebida" calculado pelos ingressos (ticket_types.inclui_bebida), IP e
// navegador, e aceito_em = hora do banco. Nada disso vem do navegador.
// Chamada: POST { event_id } com o JWT do dono do evento. Tabela evento_aceites e aceite_evento_versao() em
// docs/sql/20261009_f1a_tipo_evento.sql: publicar esta função só DEPOIS de aplicar esse SQL.
// Não reaproveita a record-access: ela pula o registro quando houve acesso no último minuto.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'
import { corsHeaders } from '../_shared/cors.ts'
import { clientIp } from '../_shared/ip.ts'
import { mfaOk } from '../_shared/mfa.ts'
import { ACEITE_VERSAO, textoAceite } from '../_shared/tipoEvento.ts'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function sha256(texto: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto)))
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
    if (req.method !== 'POST') return json(405, { error: 'Método não permitido' })

    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!token) return json(401, { error: 'Não autenticado' })
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const { data: { user }, error: userError } = await admin.auth.getUser(token)
    if (userError || !user) return json(401, { error: 'Não autenticado' })
    if (!(await mfaOk(req))) return json(403, { error: 'Confirme o código de verificação em duas etapas' })

    let body: Record<string, unknown> = {}
    try { body = await req.json() } catch { /* sem body */ }
    const eventId = body.event_id
    if (typeof eventId !== 'string' || !UUID_RE.test(eventId)) return json(400, { error: 'event_id inválido' })

    const { data: evento, error: eventoError } = await admin.from('events')
      .select('id, producer_id, title, category, classificacao').eq('id', eventId).maybeSingle()
    if (eventoError) return json(500, { error: 'Não foi possível ler o evento' })
    if (!evento || evento.producer_id !== user.id) return json(404, { error: 'Evento não encontrado' })
    if (!evento.classificacao && evento.category !== 'esporte') {
      return json(422, { error: 'Escolha a classificação etária antes do aceite' })
    }

    const { data: versao, error: versaoError } = await admin.rpc('aceite_evento_versao')
    if (versaoError) return json(500, { error: 'Não foi possível ler a versão do aceite' })
    if (versao !== ACEITE_VERSAO) return json(409, { error: 'Texto do aceite desatualizado; recarregue a página' })

    const { data: bebida, error: bebidaError } = await admin.from('ticket_types')
      .select('id').eq('event_id', eventId).eq('inclui_bebida', true).limit(1)
    if (bebidaError) return json(500, { error: 'Não foi possível ler os ingressos' })

    const temBebida = (bebida ?? []).length > 0
    const texto = textoAceite({ titulo: evento.title, formato: evento.category, classificacao: evento.classificacao, temBebida })
    const { ip, forwarded_for } = clientIp(req.headers)
    const textoHash = await sha256(texto)
    // nova tentativa em sequência (o duplo clique é barrado na tela): mesmo texto do mesmo evento, deste produtor, nos
    // últimos 5 minutos devolve o aceite anterior
    const { data: recente, error: recenteError } = await admin.from('evento_aceites').select('id, aceito_em, texto_hash')
      .eq('event_id', eventId).eq('producer_id', user.id).eq('texto_hash', textoHash)
      .gte('aceito_em', new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .order('aceito_em', { ascending: false }).limit(1)
    if (recenteError) return json(500, { error: 'Não foi possível conferir o aceite anterior' })
    const classificacao = evento.category === 'esporte' ? null : evento.classificacao
    if (recente && recente.length > 0) {
      return json(200, { ok: true, ...recente[0], versao, classificacao, tem_bebida: temBebida })
    }
    // limite: 20 aceites novos por produtor por hora (a tabela é prova e não se apaga: nada de inflá-la em laço)
    const { count, error: contarError } = await admin.from('evento_aceites').select('id', { count: 'exact', head: true })
      .eq('producer_id', user.id).gte('aceito_em', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    if (contarError) return json(500, { error: 'Não foi possível conferir o limite de aceites' })
    if ((count ?? 0) >= 20) return json(429, { error: 'Muitas tentativas. Tente novamente mais tarde.' })
    const linha = {
      event_id: eventId, producer_id: user.id, versao, texto, texto_hash: textoHash,
      // esporte não é classificado (variante 2b do texto): nada de classificação contraditória no registro
      classificacao, tem_bebida: temBebida,
      ip, forwarded_for, user_agent: (req.headers.get('user-agent') ?? '').slice(0, 300),
    }
    const { data: gravado, error: gravarError } = await admin.from('evento_aceites').insert(linha)
      .select('id, aceito_em, texto_hash').single()
    if (gravarError) {
      console.error('[aceite-evento]', eventId, gravarError.message)
      return json(500, { error: 'Não foi possível registrar o aceite' })
    }
    return json(200, { ok: true, ...gravado, versao, classificacao: linha.classificacao, tem_bebida: linha.tem_bebida })
  } catch (e) {
    console.error('[aceite-evento]', e instanceof Error ? e.message : e)
    return json(500, { error: 'Erro inesperado' })
  }
})
