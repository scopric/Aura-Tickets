-- ========================================================
-- AURA TICKETS — Tabela de Logs de E-mail
-- Execute este script no SQL Editor do Supabase para
-- habilitar o rastreamento e auditoria de e-mails.
-- ========================================================

-- Criar tabela de logs de email
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  email_type TEXT NOT NULL,
  recipient TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'sent',
  resend_id TEXT,
  error_message TEXT
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Admins can view email logs" ON public.email_logs;

-- Criar política para admins visualizarem logs de e-mail
CREATE POLICY "Admins can view email logs" 
  ON public.email_logs FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Comentários da tabela para documentação do Supabase
COMMENT ON TABLE public.email_logs IS 'Tabela que armazena o log de e-mails transacionais enviados para evitar duplicidade e auditoria.';
