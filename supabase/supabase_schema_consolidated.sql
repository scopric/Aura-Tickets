-- SCRIPT DE CONSOLIDAÇÃO DO SCHEMA DO SUPABASE - AURA TICKETS
-- Este script limpa tabelas anteriores e reconstrói o banco de dados com chaves estrangeiras,
-- triggers automáticos, RLS habilitadas e total compatibilidade com a tipagem TypeScript do app.

-- =========================================================================
-- 0. LIMPEZA SEGURA DO BANCO DE DADOS EXISTENTE (ORDEM DE DEPENDÊNCIA REVERSA)
-- =========================================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_updated_at();

-- Tabelas auxiliares, CRM, cardápio, post-event e equipe
DROP TABLE IF EXISTS public.issued_certificates CASCADE;
DROP TABLE IF EXISTS public.certificates CASCADE;
DROP TABLE IF EXISTS public.producer_tasks CASCADE;
DROP TABLE IF EXISTS public.partners CASCADE;
DROP TABLE IF EXISTS public.team_members CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.interest_lists CASCADE;
DROP TABLE IF EXISTS public.event_reviews CASCADE;
DROP TABLE IF EXISTS public.check_ins CASCADE;
DROP TABLE IF EXISTS public.affiliates CASCADE;
DROP TABLE IF EXISTS public.coupons CASCADE;
DROP TABLE IF EXISTS public.withdrawals CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.table_members CASCADE;
DROP TABLE IF EXISTS public.collective_tables CASCADE;
DROP TABLE IF EXISTS public.menu_order_items CASCADE;
DROP TABLE IF EXISTS public.menu_orders CASCADE;
DROP TABLE IF EXISTS public.menu_items CASCADE;
DROP TABLE IF EXISTS public.crm_tasks CASCADE;
DROP TABLE IF EXISTS public.crm_interactions CASCADE;
DROP TABLE IF EXISTS public.crm_leads CASCADE;
DROP TABLE IF EXISTS public.pipeline_stages CASCADE;

-- Tabelas principais (Vendas, Ingressos, Eventos e Perfis)
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.tickets CASCADE;
DROP TABLE IF EXISTS public.order_items CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.ticket_types CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.producer_profiles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Tabelas legadas de migrações anteriores (caso existam)
DROP TABLE IF EXISTS public.ticket_order_items CASCADE;
DROP TABLE IF EXISTS public.ticket_orders CASCADE;

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- 1. ESTRUTURA CORE: PERFIS E EVENTOS (ALINHADOS COM O FRONTEND)
-- =========================================================================

-- Tabela: profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  cpf TEXT,
  avatar_url TEXT,
  bio TEXT,
  city TEXT,
  birth_date DATE,
  instagram TEXT,
  tiktok TEXT,
  linkedin TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'customer', 'producer', 'admin')),
  stripe_customer_id TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela: producer_profiles (dados adicionais do produtor)
CREATE TABLE public.producer_profiles (
  id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  cnpj TEXT NOT NULL UNIQUE,
  stripe_account_id TEXT,
  woovi_account_id TEXT,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela: events (eventos)
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subtitle TEXT,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  short_description TEXT,
  cover_image TEXT,
  image_url TEXT,
  gallery JSONB NOT NULL DEFAULT '[]',
  category TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  venue_name TEXT,
  venue_address TEXT,
  venue_city TEXT,
  venue_state TEXT,
  venue_zip TEXT,
  venue_lat NUMERIC,
  venue_lng NUMERIC,
  date DATE,
  time TIME,
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled', 'ended')),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'unlisted', 'password')),
  password TEXT,
  capacity INTEGER,
  branding JSONB NOT NULL DEFAULT '{}',
  settings JSONB NOT NULL DEFAULT '{}',
  meta_title TEXT,
  meta_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela: ticket_types (tipos de ingresso)
CREATE TABLE public.ticket_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  capacity INTEGER,
  quantity_total INTEGER NOT NULL DEFAULT 0,
  sold INTEGER NOT NULL DEFAULT 0,
  quantity_sold INTEGER NOT NULL DEFAULT 0,
  min_per_order INTEGER NOT NULL DEFAULT 1,
  max_per_order INTEGER,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  sale_start TIMESTAMPTZ,
  sale_end TIMESTAMPTZ,
  perks JSONB NOT NULL DEFAULT '[]',
  perks_array TEXT[] NOT NULL DEFAULT '{}',
  type TEXT NOT NULL DEFAULT 'individual' CHECK (type IN ('individual', 'vip', 'coletiva', 'mesa')),
  sort_order INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- 2. VENDAS, CHECKOUT E INGRESSOS (ALINHADOS COM O TYPESCRIPT DO FRONTEND)
-- =========================================================================

-- Tabela: orders (compras/pedidos)
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  event_id UUID NOT NULL REFERENCES public.events(id),
  coupon_id UUID, -- será referenciado após a criação da tabela coupons
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  discount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  service_fee NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  processing_fee NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  total NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
  payment_method TEXT CHECK (payment_method IN ('pix', 'credit_card', 'boleto')),
  payment_gateway TEXT,
  gateway_payment_id TEXT,
  customer_name TEXT,
  customer_email TEXT,
  customer_cpf TEXT,
  customer_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela: order_items (itens de compra)
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  ticket_type_id UUID NOT NULL REFERENCES public.ticket_types(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela: tickets (ingressos gerados e ativos)
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID REFERENCES public.order_items(id),
  order_id UUID NOT NULL REFERENCES public.orders(id),
  ticket_type_id UUID NOT NULL REFERENCES public.ticket_types(id),
  event_id UUID NOT NULL REFERENCES public.events(id),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  buyer_cpf TEXT,
  qr_code TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'cancelled', 'refunded', 'transferred')),
  price_paid NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  checked_in_at TIMESTAMPTZ,
  checked_in_by UUID REFERENCES public.profiles(id),
  transferred_to UUID REFERENCES public.profiles(id),
  transfer_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela: payments (pagamentos efetuados)
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id),
  gateway TEXT NOT NULL CHECK (gateway IN ('stripe', 'woovi', 'pagseguro')),
  gateway_payment_id TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
  split_data JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- 3. CRM E LEADS
-- =========================================================================

-- Tabela: pipeline_stages (etapas do funil de vendas do CRM)
CREATE TABLE public.pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES public.profiles(id),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela: crm_leads (leads do CRM)
CREATE TABLE public.crm_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES public.profiles(id),
  stage_id UUID REFERENCES public.pipeline_stages(id),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  source TEXT NOT NULL DEFAULT 'organic',
  score INTEGER NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  potential_value NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  tags TEXT[] NOT NULL DEFAULT '{}',
  event_interest TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela: crm_interactions (interações com leads)
CREATE TABLE public.crm_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('message', 'call', 'email', 'note', 'meeting')),
  content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela: crm_tasks (tarefas do CRM)
CREATE TABLE public.crm_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date TIMESTAMPTZ,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- 4. CARDÁPIO E COMANDA DIGITAL
-- =========================================================================

-- Tabela: menu_items (itens de consumo de eventos)
CREATE TABLE public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  producer_id UUID NOT NULL REFERENCES public.profiles(id),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  category TEXT NOT NULL DEFAULT 'bebida' CHECK (category IN ('bebida', 'comida', 'combo', 'merch', 'servico')),
  image_url TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  stock INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela: menu_orders (pedidos de cardápio)
CREATE TABLE public.menu_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'delivered', 'cancelled')),
  pickup_time TIMESTAMPTZ,
  total NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  qr_code TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela: menu_order_items (itens do pedido do cardápio)
CREATE TABLE public.menu_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_order_id UUID NOT NULL REFERENCES public.menu_orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL
);

-- =========================================================================
-- 5. MESA COLETIVA (MATCHMAKING)
-- =========================================================================

-- Tabela: collective_tables (mesas coletivas em eventos)
CREATE TABLE public.collective_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  ticket_type_id UUID REFERENCES public.ticket_types(id),
  name TEXT NOT NULL,
  theme TEXT,
  capacity INTEGER NOT NULL DEFAULT 6,
  compatibility_score NUMERIC(3,1),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'full', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela: table_members (membros das mesas coletivas)
CREATE TABLE public.table_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES public.collective_tables(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  vibe TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  matchmaking_answers JSONB NOT NULL DEFAULT '{}',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- 6. FINANCEIRO E CARTEIRA
-- =========================================================================

-- Tabela: transactions (movimentações financeiras)
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES public.profiles(id),
  event_id UUID REFERENCES public.events(id),
  order_id UUID REFERENCES public.orders(id),
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'withdrawal', 'refund', 'fee')),
  amount NUMERIC(10,2) NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela: withdrawals (solicitações de saques/PIX)
CREATE TABLE public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES public.profiles(id),
  amount NUMERIC(10,2) NOT NULL,
  pix_key TEXT,
  bank_account JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- =========================================================================
-- 7. CUPONS E AFILIADOS
-- =========================================================================

-- Tabela: coupons (cupons de desconto de eventos)
CREATE TABLE public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES public.profiles(id),
  event_id UUID REFERENCES public.events(id),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent', 'fixed')),
  discount_value NUMERIC(10,2) NOT NULL,
  max_uses INTEGER,
  uses INTEGER NOT NULL DEFAULT 0,
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Adicionar chave estrangeira de coupons na tabela orders
ALTER TABLE public.orders ADD CONSTRAINT fk_orders_coupon FOREIGN KEY (coupon_id) REFERENCES public.coupons(id);

-- Tabela: affiliates (afiliados promotores)
CREATE TABLE public.affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES public.profiles(id),
  event_id UUID REFERENCES public.events(id),
  affiliate_user_id UUID NOT NULL REFERENCES public.profiles(id),
  commission_percent NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  sales INTEGER NOT NULL DEFAULT 0,
  total_earned NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- 8. CHECK-IN, AVALIAÇÕES E EQUIPE
-- =========================================================================

-- Tabela: check_ins (controle de entrada presencial)
CREATE TABLE public.check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  checked_in_by UUID REFERENCES public.profiles(id),
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela: event_reviews (avaliações pós-evento)
CREATE TABLE public.event_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- Tabela: interest_lists (listas de interesse/pré-venda)
CREATE TABLE public.interest_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  ticket_type_id UUID REFERENCES public.ticket_types(id),
  notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- Tabela: team_members (equipe do produtor)
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES public.profiles(id),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);

-- Tabela: producer_tasks (tarefas de staff do produtor)
CREATE TABLE public.producer_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES public.profiles(id),
  event_id UUID REFERENCES public.events(id),
  assigned_to UUID REFERENCES public.profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela: partners (parceiros/patrocinadores)
CREATE TABLE public.partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES public.profiles(id),
  name TEXT NOT NULL,
  type TEXT,
  contact TEXT,
  logo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- 9. CERTIFICADOS
-- =========================================================================

-- Tabela: certificates (certificados de participação em eventos)
CREATE TABLE public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id),
  template JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela: issued_certificates (certificados emitidos aos usuários)
CREATE TABLE public.issued_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id UUID NOT NULL REFERENCES public.certificates(id),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  code TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT
);

-- =========================================================================
-- 10. NOTIFICAÇÕES E CHAT INTERNO
-- =========================================================================

-- Tabela: notifications (mensagens push/alertas da plataforma)
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  title TEXT NOT NULL,
  body TEXT,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'sale', 'reminder', 'promo', 'system')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela: messages (chat interno produtor/lead)
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id),
  recipient_id UUID NOT NULL REFERENCES public.profiles(id),
  lead_id UUID REFERENCES public.crm_leads(id),
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- 11. CONFIGURAÇÕES GERAIS E INSCRIÇÕES/PLANOS
-- =========================================================================

-- Tabela: platform_settings (configurações do painel admin)
CREATE TABLE public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  updated_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela: feedback (bugs/sugestões reportadas)
CREATE TABLE public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  type TEXT NOT NULL DEFAULT 'bug' CHECK (type IN ('bug', 'feature', 'other')),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela: producer_subscriptions (planos de assinatura dos produtores)
CREATE TABLE public.producer_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES public.profiles(id) UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- =========================================================================
-- 12. TRIGGERS E FUNÇÕES AUXILIARES
-- =========================================================================

-- Função para atualizar automaticamente o campo updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Associação dos Triggers de updated_at para as tabelas principais
CREATE TRIGGER tr_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER tr_producer_profiles_updated_at
  BEFORE UPDATE ON public.producer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER tr_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER tr_ticket_types_updated_at
  BEFORE UPDATE ON public.ticket_types
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER tr_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER tr_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER tr_crm_leads_updated_at
  BEFORE UPDATE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Trigger: Criar profile automático ao registrar na autenticação
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- 12.1 VIEW MATERIALIZADA E TRIGGERS DE ATUALIZAÇÃO (CONSOLIDAÇÃO FINANCEIRA)
-- =========================================================================

-- View Materializada: event_summary
CREATE MATERIALIZED VIEW public.event_summary AS
SELECT 
  e.id AS event_id,
  e.producer_id,
  COALESCE(SUM(oi.quantity), 0) AS tickets_sold,
  COALESCE(SUM(o.total), 0.00) AS total_revenue,
  COUNT(DISTINCT o.user_id) AS unique_buyers,
  MAX(o.created_at) AS last_sale_at
FROM public.events e
LEFT JOIN public.orders o ON o.event_id = e.id AND o.status = 'paid'
LEFT JOIN public.order_items oi ON oi.order_id = o.id
GROUP BY e.id, e.producer_id;

-- Índice UNIQUE obrigatório para REFRESH CONCURRENTLY
CREATE UNIQUE INDEX idx_event_summary_event_id ON public.event_summary(event_id);

-- Função para atualizar a view materializada
CREATE OR REPLACE FUNCTION public.refresh_event_summary()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.event_summary;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Triggers de Refresh Concorrente
CREATE TRIGGER tr_refresh_event_summary_orders
  AFTER INSERT OR UPDATE OR DELETE ON public.orders
  FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_event_summary();

-- =========================================================================
-- 13. ÍNDICES DE DESEMPENHO (OTIMIZAÇÃO DE QUERIES NO FRONTEND)
-- =========================================================================
CREATE INDEX idx_events_producer ON public.events(producer_id);
CREATE INDEX idx_events_status ON public.events(status);
CREATE INDEX idx_events_date ON public.events(date);
CREATE INDEX idx_events_slug ON public.events(slug);
CREATE INDEX idx_ticket_types_event ON public.ticket_types(event_id);
CREATE INDEX idx_orders_user ON public.orders(user_id);
CREATE INDEX idx_orders_event ON public.orders(event_id);
CREATE INDEX idx_tickets_user ON public.tickets(user_id);
CREATE INDEX idx_tickets_event ON public.tickets(event_id);
CREATE INDEX idx_crm_leads_producer ON public.crm_leads(producer_id);

-- =========================================================================
-- 14. ROW LEVEL SECURITY (RLS) E POLÍTICAS BÁSICAS
-- =========================================================================

-- Habilitar RLS em todas as tabelas principais e de controle
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 14.1 Políticas para Profiles
CREATE POLICY "Leitura pública de perfis" ON public.profiles 
  FOR SELECT USING (true);

CREATE POLICY "Usuários modificam próprio perfil" ON public.profiles 
  FOR UPDATE USING ((SELECT auth.uid()) = id) 
  WITH CHECK ((SELECT auth.uid()) = id);

-- 14.2 Políticas para Producer Profiles
CREATE POLICY "Leitura pública de perfis de produtor" ON public.producer_profiles 
  FOR SELECT USING (true);

CREATE POLICY "Produtores gerenciam próprio perfil" ON public.producer_profiles 
  FOR ALL USING ((SELECT auth.uid()) = id) 
  WITH CHECK ((SELECT auth.uid()) = id);

-- 14.3 Políticas para Events
CREATE POLICY "Eventos públicos ou do produtor" ON public.events 
  FOR SELECT USING (status = 'published' OR (SELECT auth.uid()) = producer_id);

CREATE POLICY "Produtores gerenciam próprios eventos" ON public.events 
  FOR ALL USING ((SELECT auth.uid()) = producer_id) 
  WITH CHECK ((SELECT auth.uid()) = producer_id);

-- 14.4 Políticas para Ticket Types (Corrigido Parentetização e Desempenho)
CREATE POLICY "Ingressos visíveis ao público ou ao produtor" ON public.ticket_types 
  FOR SELECT USING (
    (is_active = true AND EXISTS (
      SELECT 1 FROM public.events WHERE id = event_id AND status = 'published'
    )) OR EXISTS (
      SELECT 1 FROM public.events WHERE id = event_id AND producer_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Produtores gerenciam ingressos dos próprios eventos" ON public.ticket_types 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.events WHERE id = event_id AND producer_id = (SELECT auth.uid())
    )
  );

-- 14.5 Políticas para Orders (Compras)
CREATE POLICY "Usuários leem próprias compras" ON public.orders 
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Produtores leem compras dos próprios eventos" ON public.orders 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.events WHERE id = event_id AND producer_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Usuários criam próprias compras" ON public.orders 
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

-- 14.6 Políticas para Order Items
CREATE POLICY "Usuários leem próprios itens de compras" ON public.order_items 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders WHERE id = order_id AND user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Produtores leem itens de compras dos seus eventos" ON public.order_items 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders WHERE id = order_id AND EXISTS (
        SELECT 1 FROM public.events WHERE id = event_id AND producer_id = (SELECT auth.uid())
      )
    )
  );

-- 14.7 Políticas para Tickets (Ingressos Emitidos)
CREATE POLICY "Usuários leem seus ingressos" ON public.tickets 
  FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Produtores leem ingressos dos próprios eventos" ON public.tickets 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.events WHERE id = event_id AND producer_id = (SELECT auth.uid())
    )
  );

-- 14.8 Políticas para Payments
CREATE POLICY "Usuários veem próprios pagamentos" ON public.payments 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders WHERE id = order_id AND user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Produtores veem pagamentos dos seus eventos" ON public.payments 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders WHERE id = order_id AND EXISTS (
        SELECT 1 FROM public.events WHERE id = event_id AND producer_id = (SELECT auth.uid())
      )
    )
  );
