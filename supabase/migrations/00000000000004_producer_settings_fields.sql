-- Migration: Adiciona campos extras para configurações do produtor
-- Executar no SQL Editor do Supabase

-- Adicionar campos ao perfil base
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS website TEXT;

-- Adicionar campos ao producer_profiles
ALTER TABLE public.producer_profiles
  ADD COLUMN IF NOT EXISTS notification_settings JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS bank_account JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pix_key TEXT,
  ADD COLUMN IF NOT EXISTS api_key TEXT,
  ADD COLUMN IF NOT EXISTS webhook_url TEXT;

-- Atualizar a função de updated_at se não existir
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at em producer_profiles
DROP TRIGGER IF EXISTS producer_profiles_updated_at ON public.producer_profiles;
CREATE TRIGGER producer_profiles_updated_at
  BEFORE UPDATE ON public.producer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
