-- ============================================================
-- EVOKAA PLATFORM — Gatilho de Alerta de Suporte (Webhook)
-- Registro do Trigger SQL para chamar a Edge Function
-- ============================================================

-- Habilita a extensão de requisições HTTP caso não esteja ativa
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- Função do Trigger que faz o disparo HTTP assíncrono para a Edge Function
CREATE OR REPLACE FUNCTION public.trg_send_support_alert()
RETURNS TRIGGER AS $$
DECLARE
  v_payload JSONB;
  v_supabase_url TEXT;
  v_service_key TEXT;
  v_request_id BIGINT;
BEGIN
  -- Apenas dispara para mensagens enviadas por visitantes
  IF NEW.sender_type = 'visitor' THEN
    
    -- Monta o payload padronizado de webhook
    v_payload := jsonb_build_object(
      'type', 'INSERT',
      'table', 'support_messages',
      'schema', 'public',
      'record', row_to_json(NEW)
    );

    -- Tenta obter a chave da API do Supabase a partir das configurações locais
    -- Se estiver rodando localmente no Supabase CLI ou na Nuvem, o Postgres
    -- possui variáveis de ambiente do projeto configuradas.
    -- Nota: A URL 'http://localhost:54321/functions/v1/send-support-alert' funciona 
    -- internamente no Supabase Cloud e também no Supabase CLI local.
    
    SELECT net.http_post(
      url := 'http://localhost:54321/functions/v1/send-support-alert',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', coalesce(
          current_setting('app.settings.supabase_anon_key', true),
          -- Fallback para chave vazia caso não encontre (o Kong interno costuma ignorar apikey de requests locais)
          ''
        )
      ),
      body := v_payload
    ) INTO v_request_id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criação do Trigger na tabela support_messages
DROP TRIGGER IF EXISTS on_support_message_created ON public.support_messages;
CREATE TRIGGER on_support_message_created
  AFTER INSERT ON public.support_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_send_support_alert();

-- ============================================================
-- 💡 NOTA PARA PRODUÇÃO (ALTERNATIVA VIA DASHBOARD)
-- ============================================================
-- Se preferir gerenciar os Webhooks visualmente pelo Painel do Supabase:
-- 1. Acesse o Dashboard do Supabase -> Database -> Webhooks.
-- 2. Clique em "Create a new Webhook".
-- 3. Nome: "send_support_alert_webhook".
-- 4. Tabela: "support_messages".
-- 5. Eventos: marque apenas "Insert".
-- 6. Tipo de Destino: selecione "Supabase Edge Function".
-- 7. Edge Function: selecione "send-support-alert".
-- 8. Salve o webhook.
-- ============================================================
