-- =========================================================================
-- 1. APROVAÇÃO DE EVENTOS
-- =========================================================================
ALTER TABLE public.events 
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- =========================================================================
-- 2. CARROSSEL DE DESTAQUES
-- =========================================================================
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS featured_carousel BOOLEAN NOT NULL DEFAULT false;

-- =========================================================================
-- 3. RBAC DE EQUIPE ADMINISTRATIVA
-- =========================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS admin_permissions TEXT[] NOT NULL DEFAULT '{}';

-- =========================================================================
-- 4. SISTEMA DE NEWSLETTER
-- =========================================================================
-- Campanhas criadas/enviadas
CREATE TABLE IF NOT EXISTS public.newsletters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent')),
  sent_at TIMESTAMPTZ,
  recipient_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Subscribers da Newsletter (garante consistência caso não exista)
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- 5. SEGURANÇA E ROW LEVEL SECURITY (RLS)
-- =========================================================================
-- Habilitar RLS nas tabelas de Newsletter
ALTER TABLE public.newsletters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- 5.1 Políticas para public.newsletters
DROP POLICY IF EXISTS "Apenas admins leem e gerenciam campanhas" ON public.newsletters;
CREATE POLICY "Apenas admins leem e gerenciam campanhas" ON public.newsletters
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- 5.2 Políticas para public.newsletter_subscribers
DROP POLICY IF EXISTS "Apenas admins gerenciam subscribers" ON public.newsletter_subscribers;
CREATE POLICY "Apenas admins gerenciam subscribers" ON public.newsletter_subscribers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Qualquer pessoa pode se inscrever" ON public.newsletter_subscribers;
CREATE POLICY "Qualquer pessoa pode se inscrever" ON public.newsletter_subscribers
  FOR INSERT WITH CHECK (true);

-- 5.3 Atualização de Políticas de Eventos para contemplar aprovação
DROP POLICY IF EXISTS "Eventos públicos ou do produtor" ON public.events;
CREATE POLICY "Eventos públicos ou do produtor" ON public.events 
  FOR SELECT USING (
    (status = 'published' AND approval_status = 'approved') 
    OR (SELECT auth.uid()) = producer_id
  );

DROP POLICY IF EXISTS "Admins gerenciam todos os eventos" ON public.events;
CREATE POLICY "Admins gerenciam todos os eventos" ON public.events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );
