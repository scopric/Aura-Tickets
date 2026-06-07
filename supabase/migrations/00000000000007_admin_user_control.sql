-- MIGRATION: 00000000000007_admin_user_control.sql
-- Objetivo: Suporte a controle de e-mails/autorização de logins, precificação customizada de planos e ferramentas adicionais individuais.

-- 1. ADICIONAR COLUNA DE AUTORIZAÇÃO EM PROFILES
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS is_authorized BOOLEAN NOT NULL DEFAULT true;

-- Definir como true para todos os usuários existentes para evitar lockout após migration
UPDATE public.profiles SET is_authorized = true;

-- 2. ATUALIZAR CONSTRAINT DE ROLE EM PROFILES PARA SUPORTAR 'editor'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('user', 'customer', 'producer', 'admin', 'editor'));

-- 3. ADICIONAR PREÇO CUSTOMIZADO EM PRODUCER_SUBSCRIPTIONS
ALTER TABLE public.producer_subscriptions
  ADD COLUMN IF NOT EXISTS custom_price NUMERIC(10,2) DEFAULT NULL;

-- 4. CRIAR TABELA DE FUNCIONALIDADES CUSTOMIZADAS POR USUÁRIO (FEATURES ADICIONAIS COM EXPIRAÇÃO)
CREATE TABLE IF NOT EXISTS public.user_custom_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, feature_key)
);

-- 5. ATUALIZAR TRIGGER DE NOVO USUÁRIO PARA TRATAR A AUTORIZAÇÃO DE PRODUTORES/ADMINS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role, is_authorized)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    CASE 
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'user') IN ('producer', 'admin') THEN false -- Produtores e admins precisam de aprovação inicial
      ELSE true -- Compradores comuns são aprovados automaticamente
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. HABILITAR E CONFIGURAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.user_custom_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producer_subscriptions ENABLE ROW LEVEL SECURITY;

-- 6.1 Políticas para user_custom_features
DROP POLICY IF EXISTS "Admins control custom features" ON public.user_custom_features;
CREATE POLICY "Admins control custom features" ON public.user_custom_features
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users read own custom features" ON public.user_custom_features;
CREATE POLICY "Users read own custom features" ON public.user_custom_features
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 6.2 Políticas para producer_subscriptions (Admins gerenciam e Produtor lê o seu)
DROP POLICY IF EXISTS "Admins control all subscriptions" ON public.producer_subscriptions;
CREATE POLICY "Admins control all subscriptions" ON public.producer_subscriptions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Producers read own subscription" ON public.producer_subscriptions;
CREATE POLICY "Producers read own subscription" ON public.producer_subscriptions
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = producer_id);
