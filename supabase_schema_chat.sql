-- Schema da tabela de mensagens (Chat)
-- Execute no SQL Editor do Supabase

-- Tabela de mensagens entre participantes e produtores
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'producer')),
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_messages_event_id ON public.messages(event_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);

-- RLS: habilitar
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Política: usuários podem ver mensagens dos eventos que participam (via tickets)
-- ou que são produtores do evento
CREATE POLICY "Ver mensagens do evento"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    -- É produtor do evento
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = messages.event_id
      AND e.producer_id = auth.uid()
    )
    -- Ou tem ticket para o evento
    OR EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.event_id = messages.event_id
      AND t.user_id = auth.uid()
    )
    -- Ou é o remetente
    OR sender_id = auth.uid()
  );

-- Política: qualquer usuário autenticado pode enviar mensagens
-- (a lógica de permissão é validada no frontend/hook)
CREATE POLICY "Enviar mensagens"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid());

-- Política: só o remetente pode editar (marcar como lida não é update, é trigger)
CREATE POLICY "Atualizar mensagens proprias"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid());

-- Função para notificar via Realtime quando nova mensagem chega
-- O Supabase Realtime já notifica automaticamente inserts na tabela
-- Basta habilitar no dashboard: Database → Replication → messages

-- View para contar mensagens não lidas por evento e usuário
CREATE OR REPLACE VIEW public.unread_messages_count AS
SELECT
  event_id,
  sender_id,
  COUNT(*) as unread_count
FROM public.messages
WHERE read_at IS NULL
GROUP BY event_id, sender_id;
