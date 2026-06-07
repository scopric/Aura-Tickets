-- MIGRATION: 00000000000008_user_tracking_system.sql
-- Objetivo: Telemetria de comportamento, historico de navegacao, logins e controle de sessoes

-- 1. CRIAR TABELA DE ATIVIDADES DO USUÁRIO
CREATE TABLE IF NOT EXISTS public.user_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- Null para visitantes anonimos
  session_id TEXT NOT NULL, -- UUID de sessao temporaria gerado no browser
  event_type TEXT NOT NULL, -- 'session_start', 'page_view', 'login', 'logout', 'add_to_cart', 'purchase', 'session_end'
  path TEXT, -- Path navegada, ex: '/event/ev-123'
  metadata JSONB DEFAULT '{}'::jsonb, -- Informacoes adicionais (device, browser, event_id, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. CRIAR ÍNDICES PARA ALTA PERFORMANCE EM AGREGADOS E FILTROS DO ADMIN
CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON public.user_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_session_id ON public.user_activities(session_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_event_type ON public.user_activities(event_type);
CREATE INDEX IF NOT EXISTS idx_user_activities_created_at ON public.user_activities(created_at DESC);

-- 3. CONFIGURAR SEGURANÇA ROW LEVEL SECURITY (RLS)
ALTER TABLE public.user_activities ENABLE ROW LEVEL SECURITY;

-- 3.1. Permitir que qualquer visitante anonimo ou usuario logado insira logs de tracking (Necessario para telemetria de rede)
DROP POLICY IF EXISTS "Anyone can insert tracking activity" ON public.user_activities;
CREATE POLICY "Anyone can insert tracking activity" ON public.user_activities
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- 3.2. Permitir que os Administradores leiam todos os logs comportamentais do sistema
DROP POLICY IF EXISTS "Admins can view all tracking activities" ON public.user_activities;
CREATE POLICY "Admins can view all tracking activities" ON public.user_activities
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- 3.3. Permitir que os proprios usuarios leiam seus logs comportamentais
DROP POLICY IF EXISTS "Users can view own tracking activities" ON public.user_activities;
CREATE POLICY "Users can view own tracking activities" ON public.user_activities
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
