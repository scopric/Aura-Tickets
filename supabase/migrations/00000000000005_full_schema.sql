-- ============================================================
-- Migration: Schema Completo Aura Tickets (30 tabelas)
-- Baseado no Documento D5 — Supabase Specdrive
-- Adaptado para compatibilidade com tabelas existentes
-- ============================================================

-- ============================================================
-- 1. TABELAS PRINCIPAIS (P0 — Core do produto)
-- ============================================================

-- 1.1 profiles (usuários) — já existe, garantir colunas
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

-- 1.2 producer_profiles — já existe, garantir campos do D5
ALTER TABLE public.producer_profiles
  ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
  ADD COLUMN IF NOT EXISTS balance DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_earnings DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS withdrawal_method JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS branding JSONB DEFAULT '{}';

-- 1.3 events — já existe, garantir campos
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS short_description TEXT,
  ADD COLUMN IF NOT EXISTS venue_state TEXT,
  ADD COLUMN IF NOT EXISTS venue_zip TEXT,
  ADD COLUMN IF NOT EXISTS venue_lat DECIMAL(10,8),
  ADD COLUMN IF NOT EXISTS venue_lng DECIMAL(11,8),
  ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS branding JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS meta_title TEXT,
  ADD COLUMN IF NOT EXISTS meta_description TEXT;

-- Garantir unique no slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
CREATE INDEX IF NOT EXISTS idx_events_venue_city ON events(venue_city);
CREATE INDEX IF NOT EXISTS idx_events_visibility ON events(visibility);

-- 1.4 ticket_types — já existe, garantir campos
ALTER TABLE public.ticket_types
  ADD COLUMN IF NOT EXISTS quantity_total INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity_sold INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_per_order INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_per_order INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS perks JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 1.5 orders — já existe, garantir campos
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS coupon_id UUID,
  ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_fee DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processing_fee DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS payment_gateway TEXT,
  ADD COLUMN IF NOT EXISTS gateway_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_email TEXT,
  ADD COLUMN IF NOT EXISTS customer_cpf TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT;

-- 1.6 order_items — já existe, garantir campos
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2) DEFAULT 0;

-- 1.7 tickets — já existe, garantir campos
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS ticket_type_id UUID,
  ADD COLUMN IF NOT EXISTS event_id UUID,
  ADD COLUMN IF NOT EXISTS order_id UUID,
  ADD COLUMN IF NOT EXISTS buyer_name TEXT,
  ADD COLUMN IF NOT EXISTS buyer_email TEXT,
  ADD COLUMN IF NOT EXISTS buyer_cpf TEXT,
  ADD COLUMN IF NOT EXISTS qr_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS price_paid DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checked_in_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS transfer_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_tickets_event ON tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_order ON tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_tickets_qr ON tickets(qr_code);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);

-- ============================================================
-- 2. TABELAS NOVAS (P0 — Core)
-- ============================================================

-- 2.1 payments
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  gateway TEXT NOT NULL CHECK (gateway IN ('stripe', 'woovi', 'pagseguro')),
  gateway_payment_id TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
  split_data JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_gateway ON payments(gateway_payment_id);

-- 2.2 coupons
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed')),
  value DECIMAL(10,2) NOT NULL,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  min_order_value DECIMAL(10,2),
  applicable_ticket_types UUID[],
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupons_code_event ON coupons(code, event_id);
CREATE INDEX IF NOT EXISTS idx_coupons_event ON coupons(event_id);

-- 2.3 check_ins
CREATE TABLE IF NOT EXISTS public.check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id),
  event_id UUID NOT NULL REFERENCES events(id),
  operator_id UUID REFERENCES profiles(id),
  method TEXT DEFAULT 'qr_scan' CHECK (method IN ('qr_scan', 'manual', 'list')),
  device_info TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_check_ins_event ON check_ins(event_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_ticket ON check_ins(ticket_id);

-- 2.4 seating_maps
CREATE TABLE IF NOT EXISTS public.seating_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Principal',
  config JSONB NOT NULL DEFAULT '{"elements": [], "background": null}',
  environments JSONB DEFAULT '[{"id": "default", "name": "Principal", "seats": []}]',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_seating_maps_event ON seating_maps(event_id);

-- ============================================================
-- Migration: Schema Completo Aura Tickets (30 tabelas)
-- Baseado no Documento D5 — Supabase Specdrive
-- Adaptado para compatibilidade com tabelas existentes
-- ============================================================

-- ============================================================
-- 1. TABELAS PRINCIPAIS (P0 — Core do produto)
-- ============================================================

-- 1.1 profiles (usuários) — já existe, garantir colunas
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

-- 1.2 producer_profiles — já existe, garantir campos do D5
ALTER TABLE public.producer_profiles
  ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
  ADD COLUMN IF NOT EXISTS balance DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_earnings DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS withdrawal_method JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS branding JSONB DEFAULT '{}';

-- 1.3 events — já existe, garantir campos
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS short_description TEXT,
  ADD COLUMN IF NOT EXISTS venue_state TEXT,
  ADD COLUMN IF NOT EXISTS venue_zip TEXT,
  ADD COLUMN IF NOT EXISTS venue_lat DECIMAL(10,8),
  ADD COLUMN IF NOT EXISTS venue_lng DECIMAL(11,8),
  ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS branding JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS meta_title TEXT,
  ADD COLUMN IF NOT EXISTS meta_description TEXT;

-- Garantir unique no slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
CREATE INDEX IF NOT EXISTS idx_events_venue_city ON events(venue_city);
CREATE INDEX IF NOT EXISTS idx_events_visibility ON events(visibility);

-- 1.4 ticket_types — já existe, garantir campos
ALTER TABLE public.ticket_types
  ADD COLUMN IF NOT EXISTS quantity_total INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity_sold INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_per_order INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_per_order INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS perks JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 1.5 orders — já existe, garantir campos
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS coupon_id UUID,
  ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_fee DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processing_fee DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS payment_gateway TEXT,
  ADD COLUMN IF NOT EXISTS gateway_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_email TEXT,
  ADD COLUMN IF NOT EXISTS customer_cpf TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT;

-- 1.6 order_items — já existe, garantir campos
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2) DEFAULT 0;

-- 1.7 tickets — já existe, garantir campos
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS ticket_type_id UUID,
  ADD COLUMN IF NOT EXISTS event_id UUID,
  ADD COLUMN IF NOT EXISTS order_id UUID,
  ADD COLUMN IF NOT EXISTS buyer_name TEXT,
  ADD COLUMN IF NOT EXISTS buyer_email TEXT,
  ADD COLUMN IF NOT EXISTS buyer_cpf TEXT,
  ADD COLUMN IF NOT EXISTS qr_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS price_paid DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checked_in_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS transfer_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_tickets_event ON tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_order ON tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_tickets_qr ON tickets(qr_code);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);

-- ============================================================
-- 2. TABELAS NOVAS (P0 — Core)
-- ============================================================

-- 2.1 payments
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  gateway TEXT NOT NULL CHECK (gateway IN ('stripe', 'woovi', 'pagseguro')),
  gateway_payment_id TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
  split_data JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_gateway ON payments(gateway_payment_id);

-- 2.2 coupons
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed')),
  value DECIMAL(10,2) NOT NULL,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  min_order_value DECIMAL(10,2),
  applicable_ticket_types UUID[],
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupons_code_event ON coupons(code, event_id);
CREATE INDEX IF NOT EXISTS idx_coupons_event ON coupons(event_id);

-- 2.3 check_ins
CREATE TABLE IF NOT EXISTS public.check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id),
  event_id UUID NOT NULL REFERENCES events(id),
  operator_id UUID REFERENCES profiles(id),
  method TEXT DEFAULT 'qr_scan' CHECK (method IN ('qr_scan', 'manual', 'list')),
  device_info TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_check_ins_event ON check_ins(event_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_ticket ON check_ins(ticket_id);

-- 2.4 seating_maps
CREATE TABLE IF NOT EXISTS public.seating_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Principal',
  config JSONB NOT NULL DEFAULT '{"elements": [], "background": null}',
  environments JSONB DEFAULT '[{"id": "default", "name": "Principal", "seats": []}]',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_seating_maps_event ON seating_maps(event_id);


-- ============================================================
-- 3. TABELAS P1 (MVP Completo)
-- ============================================================

-- 3.1 tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assignee_id UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_event ON tasks(event_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);

-- 3.2 customers (CRM)
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id),
  user_id UUID REFERENCES profiles(id),
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  tags TEXT[],
  notes TEXT,
  total_spent DECIMAL(10,2) DEFAULT 0,
  events_attended INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customers_event ON customers(event_id);
CREATE INDEX IF NOT EXISTS idx_customers_user ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

-- 3.3 communications
CREATE TABLE IF NOT EXISTS public.communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id),
  type TEXT NOT NULL CHECK (type IN ('email', 'sms', 'push')),
  segment TEXT,
  subject TEXT,
  content TEXT,
  sent_count INTEGER DEFAULT 0,
  open_count INTEGER DEFAULT 0,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_communications_event ON communications(event_id);

-- 3.4 certificates
CREATE TABLE IF NOT EXISTS public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id),
  user_id UUID NOT NULL REFERENCES profiles(id),
  template_id UUID,
  data JSONB DEFAULT '{}',
  pdf_url TEXT,
  issued_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_certificates_event ON certificates(event_id);
CREATE INDEX IF NOT EXISTS idx_certificates_user ON certificates(user_id);

-- 3.5 certificate_templates
CREATE TABLE IF NOT EXISTS public.certificate_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES profiles(id),
  name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_certificate_templates_producer ON certificate_templates(producer_id);

-- 3.6 producer_balances
CREATE TABLE IF NOT EXISTS public.producer_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES profiles(id),
  available DECIMAL(10,2) DEFAULT 0,
  pending DECIMAL(10,2) DEFAULT 0,
  withdrawn DECIMAL(10,2) DEFAULT 0,
  total_earned DECIMAL(10,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_producer_balances_producer ON producer_balances(producer_id);

-- 3.7 withdrawals
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES profiles(id),
  amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  method TEXT,
  bank_info JSONB DEFAULT '{}',
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_withdrawals_producer ON withdrawals(producer_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);

-- 3.8 notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

-- 3.9 platform_settings
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_platform_settings_key ON platform_settings(key);

-- ============================================================
-- 4. TABELAS P2 (Features avançadas)
-- ============================================================

-- 4.1 event_images
CREATE TABLE IF NOT EXISTS public.event_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_event_images_event ON event_images(event_id);

-- 4.2 seating_reservations
CREATE TABLE IF NOT EXISTS public.seating_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seating_map_id UUID NOT NULL REFERENCES seating_maps(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES tickets(id),
  seat_id TEXT NOT NULL,
  seat_label TEXT,
  status TEXT DEFAULT 'reserved' CHECK (status IN ('reserved', 'occupied', 'released')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_seating_reservations_map ON seating_reservations(seating_map_id);
CREATE INDEX IF NOT EXISTS idx_seating_reservations_ticket ON seating_reservations(ticket_id);

-- 4.3 timeline_events
CREATE TABLE IF NOT EXISTS public.timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_timeline_events_event ON timeline_events(event_id);

-- 4.4 interest_list
CREATE TABLE IF NOT EXISTS public.interest_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_interest_list_event ON interest_list(event_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_interest_list_event_email ON interest_list(event_id, email);

-- 4.5 affiliates
CREATE TABLE IF NOT EXISTS public.affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES profiles(id),
  event_id UUID REFERENCES events(id),
  code TEXT NOT NULL UNIQUE,
  name TEXT,
  email TEXT,
  commission_rate DECIMAL(5,2) DEFAULT 10.00,
  total_sales DECIMAL(10,2) DEFAULT 0,
  total_earned DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_affiliates_producer ON affiliates(producer_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_event ON affiliates(event_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_code ON affiliates(code);

-- 4.6 affiliate_conversions
CREATE TABLE IF NOT EXISTS public.affiliate_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id),
  order_id UUID NOT NULL REFERENCES orders(id),
  commission_amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_affiliate ON affiliate_conversions(affiliate_id);

-- 4.7 ticket_transfers
CREATE TABLE IF NOT EXISTS public.ticket_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id),
  from_user_id UUID REFERENCES profiles(id),
  to_user_id UUID REFERENCES profiles(id),
  to_email TEXT,
  to_name TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ticket_transfers_ticket ON ticket_transfers(ticket_id);

-- 4.8 faq_items
CREATE TABLE IF NOT EXISTS public.faq_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_faq_items_event ON faq_items(event_id);

-- 4.9 crm_activities
CREATE TABLE IF NOT EXISTS public.crm_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  event_id UUID REFERENCES events(id),
  type TEXT NOT NULL CHECK (type IN ('note', 'call', 'email', 'purchase', 'checkin', 'transfer')),
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_activities_customer ON crm_activities(customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_event ON crm_activities(event_id);


-- ============================================================
-- 5. TRIGGERS E FUNCTIONS
-- ============================================================

-- 5.1 Trigger: Criar perfil após signup (já pode existir)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.producer_profiles (id, company_name, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Minha Empresa'),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remover trigger antigo se existir e recriar
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5.2 Trigger: updated_at automático
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar a todas as tabelas com updated_at
DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

DROP TRIGGER IF EXISTS producer_profiles_updated_at ON producer_profiles;
CREATE TRIGGER producer_profiles_updated_at BEFORE UPDATE ON producer_profiles
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

DROP TRIGGER IF EXISTS events_updated_at ON events;
CREATE TRIGGER events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

DROP TRIGGER IF EXISTS ticket_types_updated_at ON ticket_types;
CREATE TRIGGER ticket_types_updated_at BEFORE UPDATE ON ticket_types
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

DROP TRIGGER IF EXISTS orders_updated_at ON orders;
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

DROP TRIGGER IF EXISTS tickets_updated_at ON tickets;
CREATE TRIGGER tickets_updated_at BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

DROP TRIGGER IF EXISTS payments_updated_at ON payments;
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

DROP TRIGGER IF EXISTS seating_maps_updated_at ON seating_maps;
CREATE TRIGGER seating_maps_updated_at BEFORE UPDATE ON seating_maps
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

DROP TRIGGER IF EXISTS tasks_updated_at ON tasks;
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

DROP TRIGGER IF EXISTS producer_balances_updated_at ON producer_balances;
CREATE TRIGGER producer_balances_updated_at BEFORE UPDATE ON producer_balances
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

DROP TRIGGER IF EXISTS seating_reservations_updated_at ON seating_reservations;
CREATE TRIGGER seating_reservations_updated_at BEFORE UPDATE ON seating_reservations
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- 5.3 Trigger: Incrementar tickets vendidos
CREATE OR REPLACE FUNCTION public.increment_ticket_sold()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ticket_types
  SET quantity_sold = quantity_sold + 1
  WHERE id = NEW.ticket_type_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_ticket_created ON tickets;
CREATE TRIGGER on_ticket_created
  AFTER INSERT ON tickets
  FOR EACH ROW EXECUTE FUNCTION public.increment_ticket_sold();

-- 5.4 Function: Validar cupom
CREATE OR REPLACE FUNCTION public.validate_coupon(
  p_code TEXT,
  p_event_id UUID,
  p_order_total DECIMAL
) RETURNS TABLE (
  valid BOOLEAN,
  coupon_id UUID,
  discount DECIMAL,
  message TEXT
) AS $$
DECLARE
  v_coupon RECORD;
BEGIN
  SELECT * INTO v_coupon FROM coupons
  WHERE code = p_code AND event_id = p_event_id AND is_active = TRUE;

  IF v_coupon IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 0::DECIMAL, 'Cupom inválido'::TEXT;
    RETURN;
  END IF;

  IF v_coupon.valid_until < NOW() THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 0::DECIMAL, 'Cupom expirado'::TEXT;
    RETURN;
  END IF;

  IF v_coupon.max_uses IS NOT NULL AND v_coupon.used_count >= v_coupon.max_uses THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 0::DECIMAL, 'Limite de usos atingido'::TEXT;
    RETURN;
  END IF;

  IF v_coupon.min_order_value IS NOT NULL AND p_order_total < v_coupon.min_order_value THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 0::DECIMAL,
      'Valor mínimo de ' || v_coupon.min_order_value || ' não atingido'::TEXT;
    RETURN;
  END IF;

  IF v_coupon.type = 'percentage' THEN
    RETURN QUERY SELECT TRUE, v_coupon.id, (p_order_total * v_coupon.value / 100),
      'Desconto aplicado'::TEXT;
  ELSE
    RETURN QUERY SELECT TRUE, v_coupon.id, LEAST(v_coupon.value, p_order_total),
      'Desconto aplicado'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 5.5 View Materializada: Resumo do Evento
DROP MATERIALIZED VIEW IF EXISTS event_summary;
CREATE MATERIALIZED VIEW event_summary AS
SELECT
  e.id as event_id,
  e.producer_id,
  e.title,
  e.status,
  COUNT(DISTINCT t.id) as total_tickets_sold,
  COALESCE(SUM(o.total), 0) as total_revenue,
  COUNT(DISTINCT o.user_id) as unique_buyers,
  MAX(o.created_at) as last_sale_at
FROM events e
LEFT JOIN orders o ON o.event_id = e.id AND o.status = 'paid'
LEFT JOIN tickets t ON t.event_id = e.id AND t.status = 'active'
GROUP BY e.id, e.producer_id, e.title, e.status;

CREATE UNIQUE INDEX idx_event_summary_event ON event_summary(event_id);
CREATE INDEX idx_event_summary_producer ON event_summary(producer_id);
CREATE INDEX idx_event_summary_status ON event_summary(status);

-- Function para refresh concurrent
CREATE OR REPLACE FUNCTION refresh_event_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY event_summary;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- 6.1 profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
CREATE POLICY "Admins can read all profiles" ON profiles
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- 6.2 producer_profiles
ALTER TABLE producer_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Producers can manage own profile" ON producer_profiles;
CREATE POLICY "Producers can manage own profile" ON producer_profiles
  FOR ALL USING (auth.uid() = id);

-- 6.3 events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Events are publicly readable when published" ON events;
CREATE POLICY "Events are publicly readable when published" ON events
  FOR SELECT USING (status = 'published' OR auth.uid() = producer_id);

DROP POLICY IF EXISTS "Producers can CRUD own events" ON events;
CREATE POLICY "Producers can CRUD own events" ON events
  FOR ALL USING (auth.uid() = producer_id);

DROP POLICY IF EXISTS "Admins can manage all events" ON events;
CREATE POLICY "Admins can manage all events" ON events
  FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- 6.4 ticket_types
ALTER TABLE ticket_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ticket types readable by event owner and public" ON ticket_types;
CREATE POLICY "Ticket types readable by event owner and public" ON ticket_types
  FOR SELECT USING (
    is_active = TRUE AND
    EXISTS (SELECT 1 FROM events WHERE id = event_id AND status = 'published')
    OR EXISTS (SELECT 1 FROM events WHERE id = event_id AND producer_id = auth.uid())
  );

DROP POLICY IF EXISTS "Producers can manage own ticket types" ON ticket_types;
CREATE POLICY "Producers can manage own ticket types" ON ticket_types
  FOR ALL USING (EXISTS (
    SELECT 1 FROM events WHERE id = event_id AND producer_id = auth.uid()
  ));

-- 6.5 tickets
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own tickets" ON tickets;
CREATE POLICY "Users can view own tickets" ON tickets
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Producers can view event tickets" ON tickets;
CREATE POLICY "Producers can view event tickets" ON tickets
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM events WHERE id = event_id AND producer_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Admins can manage all tickets" ON tickets;
CREATE POLICY "Admins can manage all tickets" ON tickets
  FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- 6.6 orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own orders" ON orders;
CREATE POLICY "Users can view own orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Producers can view event orders" ON orders;
CREATE POLICY "Producers can view event orders" ON orders
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM events WHERE id = event_id AND producer_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Admins can manage all orders" ON orders;
CREATE POLICY "Admins can manage all orders" ON orders
  FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- 6.7 order_items
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own order items" ON order_items;
CREATE POLICY "Users can view own order items" ON order_items
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM orders WHERE id = order_id AND user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Producers can view event order items" ON order_items;
CREATE POLICY "Producers can view event order items" ON order_items
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM orders o JOIN events e ON o.event_id = e.id
    WHERE o.id = order_id AND e.producer_id = auth.uid()
  ));

-- 6.8 payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payments" ON payments;
CREATE POLICY "Users can view own payments" ON payments
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM orders WHERE id = order_id AND user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Admins can view all payments" ON payments;
CREATE POLICY "Admins can view all payments" ON payments
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- 6.9 coupons
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Coupons readable by event owner and public" ON coupons;
CREATE POLICY "Coupons readable by event owner and public" ON coupons
  FOR SELECT USING (
    is_active = TRUE AND
    EXISTS (SELECT 1 FROM events WHERE id = event_id AND status = 'published')
    OR EXISTS (SELECT 1 FROM events WHERE id = event_id AND producer_id = auth.uid())
  );

DROP POLICY IF EXISTS "Producers can manage own coupons" ON coupons;
CREATE POLICY "Producers can manage own coupons" ON coupons
  FOR ALL USING (EXISTS (
    SELECT 1 FROM events WHERE id = event_id AND producer_id = auth.uid()
  ));

-- 6.10 check_ins
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Producers can manage event check-ins" ON check_ins;
CREATE POLICY "Producers can manage event check-ins" ON check_ins
  FOR ALL USING (EXISTS (
    SELECT 1 FROM events WHERE id = event_id AND producer_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can view own check-ins" ON check_ins;
CREATE POLICY "Users can view own check-ins" ON check_ins
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM tickets WHERE id = ticket_id AND user_id = auth.uid()
  ));

-- 6.11 seating_maps
ALTER TABLE seating_maps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Seating maps readable by event owner and public" ON seating_maps;
CREATE POLICY "Seating maps readable by event owner and public" ON seating_maps
  FOR SELECT USING (
    is_active = TRUE AND
    EXISTS (SELECT 1 FROM events WHERE id = event_id AND status = 'published')
    OR EXISTS (SELECT 1 FROM events WHERE id = event_id AND producer_id = auth.uid())
  );

DROP POLICY IF EXISTS "Producers can manage own seating maps" ON seating_maps;
CREATE POLICY "Producers can manage own seating maps" ON seating_maps
  FOR ALL USING (EXISTS (
    SELECT 1 FROM events WHERE id = event_id AND producer_id = auth.uid()
  ));

-- 6.12 tasks
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Producers can manage event tasks" ON tasks;
CREATE POLICY "Producers can manage event tasks" ON tasks
  FOR ALL USING (EXISTS (
    SELECT 1 FROM events WHERE id = event_id AND producer_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Assignees can view own tasks" ON tasks;
CREATE POLICY "Assignees can view own tasks" ON tasks
  FOR SELECT USING (assignee_id = auth.uid());

-- 6.13 customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Producers can manage event customers" ON customers;
CREATE POLICY "Producers can manage event customers" ON customers
  FOR ALL USING (EXISTS (
    SELECT 1 FROM events WHERE id = event_id AND producer_id = auth.uid()
  ));

-- 6.14 communications
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Producers can manage event communications" ON communications;
CREATE POLICY "Producers can manage event communications" ON communications
  FOR ALL USING (EXISTS (
    SELECT 1 FROM events WHERE id = event_id AND producer_id = auth.uid()
  ));

-- 6.15 certificates
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own certificates" ON certificates;
CREATE POLICY "Users can view own certificates" ON certificates
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Producers can manage event certificates" ON certificates;
CREATE POLICY "Producers can manage event certificates" ON certificates
  FOR ALL USING (EXISTS (
    SELECT 1 FROM events WHERE id = event_id AND producer_id = auth.uid()
  ));

-- 6.16 certificate_templates
ALTER TABLE certificate_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Producers can manage own certificate templates" ON certificate_templates;
CREATE POLICY "Producers can manage own certificate templates" ON certificate_templates
  FOR ALL USING (producer_id = auth.uid());

-- 6.17 producer_balances
ALTER TABLE producer_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Producers can view own balance" ON producer_balances;
CREATE POLICY "Producers can view own balance" ON producer_balances
  FOR SELECT USING (producer_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all balances" ON producer_balances;
CREATE POLICY "Admins can manage all balances" ON producer_balances
  FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- 6.18 withdrawals
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Producers can view own withdrawals" ON withdrawals;
CREATE POLICY "Producers can view own withdrawals" ON withdrawals
  FOR SELECT USING (producer_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all withdrawals" ON withdrawals;
CREATE POLICY "Admins can manage all withdrawals" ON withdrawals
  FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- 6.19 notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own notifications" ON notifications;
CREATE POLICY "Users can manage own notifications" ON notifications
  FOR ALL USING (user_id = auth.uid());

-- 6.20 platform_settings
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Settings readable by all" ON platform_settings;
CREATE POLICY "Settings readable by all" ON platform_settings
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Admins can manage settings" ON platform_settings;
CREATE POLICY "Admins can manage settings" ON platform_settings
  FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- 6.21 event_images
ALTER TABLE event_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Event images readable by all" ON event_images;
CREATE POLICY "Event images readable by all" ON event_images
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Producers can manage own event images" ON event_images;
CREATE POLICY "Producers can manage own event images" ON event_images
  FOR ALL USING (EXISTS (
    SELECT 1 FROM events WHERE id = event_id AND producer_id = auth.uid()
  ));

-- 6.22 seating_reservations
ALTER TABLE seating_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Producers can manage seating reservations" ON seating_reservations;
CREATE POLICY "Producers can manage seating reservations" ON seating_reservations
  FOR ALL USING (EXISTS (
    SELECT 1 FROM seating_maps sm JOIN events e ON sm.event_id = e.id
    WHERE sm.id = seating_map_id AND e.producer_id = auth.uid()
  ));

-- 6.23 timeline_events
ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Timeline events readable by event owner and public" ON timeline_events;
CREATE POLICY "Timeline events readable by event owner and public" ON timeline_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM events WHERE id = event_id AND status = 'published')
    OR EXISTS (SELECT 1 FROM events WHERE id = event_id AND producer_id = auth.uid())
  );

DROP POLICY IF EXISTS "Producers can manage own timeline" ON timeline_events;
CREATE POLICY "Producers can manage own timeline" ON timeline_events
  FOR ALL USING (EXISTS (
    SELECT 1 FROM events WHERE id = event_id AND producer_id = auth.uid()
  ));

-- 6.24 interest_list
ALTER TABLE interest_list ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can join interest list" ON interest_list;
CREATE POLICY "Anyone can join interest list" ON interest_list
  FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Producers can view event interest list" ON interest_list;
CREATE POLICY "Producers can view event interest list" ON interest_list
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM events WHERE id = event_id AND producer_id = auth.uid()
  ));

-- 6.25 affiliates
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Producers can manage own affiliates" ON affiliates;
CREATE POLICY "Producers can manage own affiliates" ON affiliates
  FOR ALL USING (producer_id = auth.uid());

DROP POLICY IF EXISTS "Affiliates readable by public" ON affiliates;
CREATE POLICY "Affiliates readable by public" ON affiliates
  FOR SELECT USING (is_active = TRUE);

-- 6.26 affiliate_conversions
ALTER TABLE affiliate_conversions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Producers can view own conversions" ON affiliate_conversions;
CREATE POLICY "Producers can view own conversions" ON affiliate_conversions
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM affiliates WHERE id = affiliate_id AND producer_id = auth.uid()
  ));

-- 6.27 ticket_transfers
ALTER TABLE ticket_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own transfers" ON ticket_transfers;
CREATE POLICY "Users can view own transfers" ON ticket_transfers
  FOR SELECT USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

-- 6.28 faq_items
ALTER TABLE faq_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "FAQ items readable by all" ON faq_items;
CREATE POLICY "FAQ items readable by all" ON faq_items
  FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS "Producers can manage own FAQ" ON faq_items;
CREATE POLICY "Producers can manage own FAQ" ON faq_items
  FOR ALL USING (EXISTS (
    SELECT 1 FROM events WHERE id = event_id AND producer_id = auth.uid()
  ));

-- 6.29 crm_activities
ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Producers can manage event CRM activities" ON crm_activities;
CREATE POLICY "Producers can manage event CRM activities" ON crm_activities
  FOR ALL USING (EXISTS (
    SELECT 1 FROM events WHERE id = event_id AND producer_id = auth.uid()
  ));

-- 6.30 menu_items (já existe, garantir RLS)
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Menu items readable by all" ON menu_items;
CREATE POLICY "Menu items readable by all" ON menu_items
  FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS "Producers can manage own menu" ON menu_items;
CREATE POLICY "Producers can manage own menu" ON menu_items
  FOR ALL USING (EXISTS (
    SELECT 1 FROM events WHERE id = event_id AND producer_id = auth.uid()
  ));

-- ============================================================
-- 7. STORAGE BUCKETS
-- ============================================================

-- Criar buckets se não existirem
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('event-images', 'event-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]),
  ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg', 'image/png']::text[]),
  ('producer-logos', 'producer-logos', true, 2097152, ARRAY['image/png', 'image/svg+xml']::text[]),
  ('certificates', 'certificates', false, 1048576, ARRAY['image/png', 'application/pdf']::text[]),
  ('event-documents', 'event-documents', false, 10485760, ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[]),
  ('banners', 'banners', true, 2097152, ARRAY['image/jpeg', 'image/png']::text[])
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 8. SEED DATA (opcional)
-- ============================================================

-- Configurações padrão da plataforma
INSERT INTO platform_settings (key, value, description)
VALUES
  ('service_fee_percentage', '{"value": 10}', 'Taxa de serviço cobrada sobre cada venda'),
  ('processing_fee_fixed', '{"value": 0.50}', 'Taxa fixa de processamento por transação'),
  ('minimum_withdrawal', '{"value": 50.00}', 'Valor mínimo para saque'),
  ('withdrawal_processing_days', '{"value": 2}', 'Dias para processar saque'),
  ('platform_name', '{"value": "Aura Tickets"}', 'Nome da plataforma'),
  ('support_email', '{"value": "suporte@aura.events"}', 'Email de suporte')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- FIM DO SCHEMA
-- ============================================================
