-- ============================================================
-- EVOKAA PLATFORM — Chat de Suporte Interno (estilo tawk.to)
-- Migração SQL para criação das tabelas e RLS seguro
-- ============================================================

-- 1. Criação da tabela de Sessões de Suporte
CREATE TABLE IF NOT EXISTS public.support_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id UUID NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'closed')),
  assigned_agent_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Criação da tabela de Mensagens de Suporte
CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.support_sessions(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('visitor', 'agent')),
  sender_id TEXT NOT NULL, -- UUID de user se for agent, ou visitor_id se for visitor
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_support_sessions_visitor ON public.support_sessions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_support_sessions_status ON public.support_sessions(status);
CREATE INDEX IF NOT EXISTS idx_support_messages_session ON public.support_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_created ON public.support_messages(created_at);

-- 4. Trigger para auto-atualizar updated_at em support_sessions
DROP TRIGGER IF EXISTS support_sessions_updated_at ON public.support_sessions;
CREATE TRIGGER support_sessions_updated_at BEFORE UPDATE ON public.support_sessions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5. Habilitar RLS (Row Level Security)
ALTER TABLE public.support_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- 6. Políticas de RLS para support_sessions
DROP POLICY IF EXISTS "Qualquer um pode iniciar uma sessao de suporte" ON public.support_sessions;
CREATE POLICY "Qualquer um pode iniciar uma sessao de suporte" ON public.support_sessions
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Leitura de sessoes de suporte" ON public.support_sessions;
CREATE POLICY "Leitura de sessoes de suporte" ON public.support_sessions
  FOR SELECT TO anon, authenticated
  USING (
    -- Admin tem acesso total
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    -- O próprio usuário logado é dono
    OR auth.uid() = user_id
    -- O visitante possui o x-visitor-id correspondente no header HTTP
    OR (nullif(current_setting('request.headers', true)::json->>'x-visitor-id', ''))::uuid = visitor_id
  );

DROP POLICY IF EXISTS "Atualizacao de sessoes de suporte" ON public.support_sessions;
CREATE POLICY "Atualizacao de sessoes de suporte" ON public.support_sessions
  FOR UPDATE TO anon, authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    OR auth.uid() = user_id
    OR (nullif(current_setting('request.headers', true)::json->>'x-visitor-id', ''))::uuid = visitor_id
  );

-- 7. Políticas de RLS para support_messages
DROP POLICY IF EXISTS "Visitante ou Admin podem enviar mensagens" ON public.support_messages;
CREATE POLICY "Visitante ou Admin podem enviar mensagens" ON public.support_messages
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    -- Admin pode enviar mensagens de suporte
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    -- Visitante pode enviar mensagens apenas para sua própria sessão ativa
    OR EXISTS (
      SELECT 1 FROM public.support_sessions
      WHERE id = session_id
      AND (
        visitor_id = (nullif(current_setting('request.headers', true)::json->>'x-visitor-id', ''))::uuid
        OR user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Leitura de mensagens da sessao" ON public.support_messages;
CREATE POLICY "Leitura de mensagens da sessao" ON public.support_messages
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.support_sessions
      WHERE id = session_id
      AND (
        visitor_id = (nullif(current_setting('request.headers', true)::json->>'x-visitor-id', ''))::uuid
        OR user_id = auth.uid()
      )
    )
  );

-- 8. Ativar Realtime no Supabase para support_messages
-- Nota: a publicação supabase_realtime é padrão do Supabase
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_sessions;
  END IF;
END $$;
