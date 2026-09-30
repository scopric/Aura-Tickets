-- =========================================================================
-- MIGRAÇÃO 03: ONBOARDING, LGPD, CONSENTIMENTOS E CAMPOS DE AQUISIÇÃO
-- Data: 2026-05-24
-- =========================================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- 1. NOVAS COLUNAS NA TABELA profiles
-- =========================================================================

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'cpf' 
  CHECK (document_type IN ('cpf', 'cnpj'));

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS document_number TEXT;

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS how_did_you_hear TEXT;

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS referral_source TEXT;

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0;

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS accepted_terms_at TIMESTAMPTZ;

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS accepted_privacy_at TIMESTAMPTZ;

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN DEFAULT false;

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS data_sharing_consent BOOLEAN DEFAULT false;

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS utm_source TEXT;

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS utm_medium TEXT;

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT;

-- =========================================================================
-- 2. NOVA TABELA: user_consents (versionamento LGPD)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (
    consent_type IN (
      'terms', 
      'privacy', 
      'marketing', 
      'analytics', 
      'cookies_necessary', 
      'cookies_analytics', 
      'cookies_marketing', 
      'cookies_preferences'
    )
  ),
  granted BOOLEAN NOT NULL DEFAULT false,
  version TEXT NOT NULL DEFAULT '1.0',
  ip_address INET,
  user_agent TEXT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_user_consents_user_id ON public.user_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_consents_type ON public.user_consents(consent_type);

-- RLS
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem próprios consentimentos" 
  ON public.user_consents 
  FOR SELECT 
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Usuários inserem próprios consentimentos" 
  ON public.user_consents 
  FOR INSERT 
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Usuários atualizam próprios consentimentos" 
  ON public.user_consents 
  FOR UPDATE 
  USING ((SELECT auth.uid()) = user_id);

-- =========================================================================
-- 3. NOVA TABELA: onboarding_logs
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.onboarding_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  completed_at TIMESTAMPTZ,
  skipped BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_logs_user_id ON public.onboarding_logs(user_id);

ALTER TABLE public.onboarding_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem próprios logs de onboarding" 
  ON public.onboarding_logs 
  FOR SELECT 
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Usuários inserem próprios logs de onboarding" 
  ON public.onboarding_logs 
  FOR INSERT 
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Usuários atualizam próprios logs de onboarding" 
  ON public.onboarding_logs 
  FOR UPDATE 
  USING ((SELECT auth.uid()) = user_id);

-- =========================================================================
-- 4. TRIGGER: atualizar timestamps de consentimento
-- =========================================================================

CREATE OR REPLACE FUNCTION public.handle_consent_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.accepted_terms_at IS NULL AND NEW.accepted_terms_at IS NOT NULL THEN
    NEW.accepted_terms_at = NOW();
  END IF;
  IF OLD.accepted_privacy_at IS NULL AND NEW.accepted_privacy_at IS NOT NULL THEN
    NEW.accepted_privacy_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_profiles_consent_timestamp ON public.profiles;
CREATE TRIGGER tr_profiles_consent_timestamp
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_consent_timestamp();

-- =========================================================================
-- 5. TRIGGER: updated_at para user_consents
-- =========================================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_user_consents_updated_at ON public.user_consents;
CREATE TRIGGER tr_user_consents_updated_at
  BEFORE UPDATE ON public.user_consents
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- =========================================================================
-- 6. FUNÇÃO: registrar consentimentos padrão no cadastro
-- =========================================================================

CREATE OR REPLACE FUNCTION public.register_default_consents(
  p_user_id UUID,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  -- Termos (obrigatório)
  INSERT INTO public.user_consents (user_id, consent_type, granted, version, ip_address, user_agent)
  VALUES (p_user_id, 'terms', true, '1.0', p_ip_address, p_user_agent)
  ON CONFLICT DO NOTHING;

  -- Privacidade (obrigatório)
  INSERT INTO public.user_consents (user_id, consent_type, granted, version, ip_address, user_agent)
  VALUES (p_user_id, 'privacy', true, '1.0', p_ip_address, p_user_agent)
  ON CONFLICT DO NOTHING;

  -- Cookies necessários (sempre true)
  INSERT INTO public.user_consents (user_id, consent_type, granted, version, ip_address, user_agent)
  VALUES (p_user_id, 'cookies_necessary', true, '1.0', p_ip_address, p_user_agent)
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- 7. ATUALIZAR TRIGGER handle_new_user para incluir novos campos
-- =========================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    email, 
    full_name, 
    avatar_url, 
    role,
    phone,
    document_type,
    document_number,
    how_did_you_hear,
    referral_source,
    accepted_terms_at,
    accepted_privacy_at,
    marketing_consent,
    data_sharing_consent,
    onboarding_completed,
    onboarding_step
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'document_type', 'cpf'),
    NEW.raw_user_meta_data->>'document_number',
    NEW.raw_user_meta_data->>'how_did_you_hear',
    NEW.raw_user_meta_data->>'referral_source',
    CASE WHEN (NEW.raw_user_meta_data->>'accepted_terms')::boolean THEN NOW() ELSE NULL END,
    CASE WHEN (NEW.raw_user_meta_data->>'accepted_privacy')::boolean THEN NOW() ELSE NULL END,
    COALESCE((NEW.raw_user_meta_data->>'marketing_consent')::boolean, false),
    COALESCE((NEW.raw_user_meta_data->>'data_sharing_consent')::boolean, false),
    false,
    0
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url,
    role = EXCLUDED.role,
    phone = EXCLUDED.phone,
    document_type = EXCLUDED.document_type,
    document_number = EXCLUDED.document_number,
    how_did_you_hear = EXCLUDED.how_did_you_hear,
    referral_source = EXCLUDED.referral_source,
    accepted_terms_at = EXCLUDED.accepted_terms_at,
    accepted_privacy_at = EXCLUDED.accepted_privacy_at,
    marketing_consent = EXCLUDED.marketing_consent,
    data_sharing_consent = EXCLUDED.data_sharing_consent,
    updated_at = NOW();

  -- Registrar consentimentos padrão
  PERFORM public.register_default_consents(NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recriar trigger para usar função atualizada
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
