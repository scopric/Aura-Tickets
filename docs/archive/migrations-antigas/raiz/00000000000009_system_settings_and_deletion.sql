-- MIGRATION: 00000000000009_system_settings_and_deletion.sql
-- Objetivo: Persistência de configurações gerais e segurança LGPD para exclusão de perfis.

-- 1. CRIAR TABELA DE CONFIGURAÇÕES DO SISTEMA
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- 2. POLÍTICAS RLS PARA SYSTEM_SETTINGS
-- 2.1 Admins têm controle total (Insert, Select, Update, Delete)
DROP POLICY IF EXISTS "Admins control all settings" ON public.system_settings;
CREATE POLICY "Admins control all settings" ON public.system_settings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- 2.2 Usuários comuns e visitantes podem ler apenas chaves não sensíveis
DROP POLICY IF EXISTS "Anyone can read public settings" ON public.system_settings;
CREATE POLICY "Anyone can read public settings" ON public.system_settings
  FOR SELECT TO anon, authenticated
  USING (key IN ('general', 'moderation'));

-- 3. POLÍTICA DE DELEÇÃO DE PERFIL EM PROFILES (LGPD)
-- Permite que o próprio usuário delete seu registro de profile
-- Devido à restrição ON DELETE CASCADE definida no banco, todos os dados vinculados serão excluídos
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
CREATE POLICY "Users can delete own profile" ON public.profiles
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = id);
