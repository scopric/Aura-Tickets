import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Headers padrão para CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Tratar requisição OPTIONS (CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Validar e parsear o Payload do Trigger do Banco
    const payload = await req.json()
    console.log('[SupportAlert] Payload recebido:', JSON.stringify(payload))

    // O webhook do Supabase envia o evento com type e record
    const { type, table, record } = payload

    if (type !== 'INSERT' || table !== 'support_messages') {
      return new Response(JSON.stringify({ message: 'Apenas inserts de mensagens sao processados' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    // Se o remetente for um agente, não envia alerta no WhatsApp
    if (record.sender_type === 'agent') {
      return new Response(JSON.stringify({ message: 'Ignorado: mensagem enviada pelo agente de suporte' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    // 2. Conectar ao Supabase localmente para buscar detalhes da sessão
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Buscar informações da sessão e do usuário (se houver)
    const { data: session, error: sessionError } = await supabase
      .from('support_sessions')
      .select(`
        *,
        user:user_id (
          email,
          full_name
        )
      `)
      .eq('id', record.session_id)
      .single()

    if (sessionError || !session) {
      console.error('[SupportAlert] Erro ao buscar dados da sessao:', sessionError)
      throw new Error('Sessao de suporte nao encontrada')
    }

    // Se a sessão já estiver sendo atendida por um agente e o agente respondeu recentemente,
    // opcionalmente podemos decidir não apitar no WhatsApp. Mas para segurança, sempre apitaremos
    // se o status for 'open' (aguardando na fila) para evitar spam se já estiver em atendimento.
    if (session.status !== 'open') {
      return new Response(JSON.stringify({ message: 'Ignorado: atendimento ja atribuido a um agente' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    // 3. Carregar e Validar Variáveis de Configuração do WhatsApp
    const whatsappApiUrl = Deno.env.get('WHATSAPP_API_URL')
    const whatsappApiToken = Deno.env.get('WHATSAPP_API_TOKEN')
    const whatsappInstance = Deno.env.get('WHATSAPP_INSTANCE')
    const whatsappAdminNumber = Deno.env.get('WHATSAPP_ADMIN_NUMBER')

    if (!whatsappApiUrl || !whatsappApiToken || !whatsappAdminNumber) {
      console.warn('[SupportAlert] Variaveis do WhatsApp nao configuradas no painel do Supabase.')
      return new Response(JSON.stringify({ error: 'Configuracoes de WhatsApp ausentes no ambiente' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      })
    }

    // 4. Montar a Mensagem Formatada para o WhatsApp
    const clientName = session.user?.full_name || record.sender_name || 'Visitante Anônimo'
    const clientContact = session.user?.email ? `(${session.user.email})` : `(Visitante #${session.visitor_id.substring(0, 8)})`
    
    const messageText = `💬 *Novo Suporte na Fila — Evokaa*\n\n` +
      `👤 *Cliente:* ${clientName} ${clientContact}\n` +
      `✉️ *Mensagem:* "${record.content}"\n\n` +
      `👉 *Responder Cliente:* https://evokaa.events/admin/support?session=${session.id}`

    // 5. Enviar para a API de WhatsApp (Exemplo: Evolution API)
    // Suporta Evolution API por padrão na rota `/message/sendText`
    const isEvolutionAPI = whatsappApiUrl.includes('evolution') || !whatsappApiUrl.includes('z-api')
    let endpoint = ''
    let headers: Record<string, string> = { 'Content-Type': 'application/json' }
    let body = {}

    if (isEvolutionAPI) {
      // Formato Evolution API
      endpoint = `${whatsappApiUrl.replace(/\/$/, '')}/message/sendText/${whatsappInstance}`
      headers['apikey'] = whatsappApiToken
      body = {
        number: whatsappAdminNumber,
        options: {
          delay: 1000,
          presence: "composing",
          linkPreview: true
        },
        textMessage: {
          text: messageText
        }
      }
    } else {
      // Formato Z-API (caso configurado Z-API)
      endpoint = `${whatsappApiUrl.replace(/\/$/, '')}/instances/${whatsappInstance}/token/${whatsappApiToken}/send-text`
      headers['client-token'] = whatsappApiToken
      body = {
        phone: whatsappAdminNumber,
        message: messageText
      }
    }

    console.log(`[SupportAlert] Enviando request para: ${endpoint}`)
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    })

    const responseData = await response.text()
    console.log('[SupportAlert] Resposta da API de WhatsApp:', responseData)

    if (!response.ok) {
      throw new Error(`Erro na API de WhatsApp: ${response.status} - ${responseData}`)
    }

    return new Response(JSON.stringify({ success: true, message: 'Alerta enviado com sucesso' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error: any) {
    console.error('[SupportAlert] Erro na Edge Function:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
