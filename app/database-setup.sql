-- ============================================================
-- AURA PLATFORM — Schema + Seed Completo
-- Cole TUDO no SQL Editor do Supabase e execute de uma vez
-- https://supabase.com/dashboard/project/rwaezeqyuhxrssntcxdv
-- ============================================================

-- ============================================================
-- 1. EXTENSÕES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 2. TABELAS P0 — Core
-- ============================================================

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  cpf TEXT UNIQUE,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'producer', 'admin')),
  stripe_customer_id TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES public.users(id),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  short_description TEXT,
  image_url TEXT,
  category TEXT,
  tags TEXT[],
  venue_name TEXT,
  venue_address TEXT,
  venue_city TEXT,
  venue_state TEXT,
  venue_zip TEXT,
  venue_lat DECIMAL(10,8),
  venue_lng DECIMAL(11,8),
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled', 'ended')),
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'unlisted')),
  branding JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  meta_title TEXT,
  meta_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ticket_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  quantity_total INTEGER NOT NULL DEFAULT 0,
  quantity_sold INTEGER NOT NULL DEFAULT 0,
  min_per_order INTEGER DEFAULT 1,
  max_per_order INTEGER DEFAULT 10,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  perks JSONB DEFAULT '[]',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_type_id UUID NOT NULL REFERENCES public.ticket_types(id),
  event_id UUID NOT NULL REFERENCES public.events(id),
  order_id UUID NOT NULL,
  user_id UUID REFERENCES public.users(id),
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  buyer_cpf TEXT,
  qr_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'cancelled', 'refunded')),
  price_paid DECIMAL(10,2) NOT NULL,
  checked_in_at TIMESTAMPTZ,
  checked_in_by UUID REFERENCES public.users(id),
  transfer_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id),
  event_id UUID NOT NULL REFERENCES public.events(id),
  coupon_id UUID,
  subtotal DECIMAL(10,2) NOT NULL,
  discount DECIMAL(10,2) DEFAULT 0,
  service_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  processing_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
  payment_method TEXT,
  payment_gateway TEXT,
  gateway_payment_id TEXT,
  customer_name TEXT,
  customer_email TEXT,
  customer_cpf TEXT,
  customer_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  ticket_type_id UUID NOT NULL REFERENCES public.ticket_types(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id),
  gateway TEXT CHECK (gateway IN ('stripe', 'woovi', 'pagseguro', 'manual')),
  gateway_payment_id TEXT,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
  split_data JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS public.check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id),
  event_id UUID NOT NULL REFERENCES public.events(id),
  operator_id UUID REFERENCES public.users(id),
  method TEXT DEFAULT 'qr_scan' CHECK (method IN ('qr_scan', 'manual', 'list')),
  device_info TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.seating_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Principal',
  config JSONB NOT NULL DEFAULT '{"elements": [], "background": null}',
  environments JSONB DEFAULT '[{"id": "default", "name": "Principal", "seats": []}]',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.producer_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  total_earnings DECIMAL(10,2) DEFAULT 0,
  total_withdrawn DECIMAL(10,2) DEFAULT 0,
  available_balance DECIMAL(10,2) DEFAULT 0,
  pending_balance DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. TABELAS P1
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assignee_id UUID REFERENCES public.users(id),
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id),
  user_id UUID REFERENCES public.users(id),
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  tags TEXT[],
  notes TEXT,
  total_spent DECIMAL(10,2) DEFAULT 0,
  events_attended INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id),
  type TEXT NOT NULL CHECK (type IN ('email', 'sms', 'push')),
  segment TEXT,
  subject TEXT,
  content TEXT,
  sent_count INTEGER DEFAULT 0,
  open_count INTEGER DEFAULT 0,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id),
  user_id UUID NOT NULL REFERENCES public.users(id),
  template_id UUID,
  data JSONB DEFAULT '{}',
  pdf_url TEXT,
  issued_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.certificate_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES public.users(id),
  name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  commission_rate DECIMAL(5,2) DEFAULT 10.00,
  total_sales DECIMAL(10,2) DEFAULT 0,
  total_earnings DECIMAL(10,2) DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.event_gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES public.users(id),
  amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  method TEXT,
  bank_info JSONB DEFAULT '{}',
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_events_producer ON public.events(producer_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_events_start_date ON public.events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_slug ON public.events(slug);
CREATE INDEX IF NOT EXISTS idx_events_category ON public.events(category);
CREATE INDEX IF NOT EXISTS idx_ticket_types_event ON public.ticket_types(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_types_active ON public.ticket_types(is_active);
CREATE INDEX IF NOT EXISTS idx_tickets_event ON public.tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON public.tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_order ON public.tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_tickets_qr ON public.tickets(qr_code);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_orders_user ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_event ON public.orders(event_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_event ON public.check_ins(event_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_ticket ON public.check_ins(ticket_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupons_code_event ON public.coupons(code, event_id);

-- ============================================================
-- 5. FUNCTIONS E TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer'),
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at ON public.users;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS events_updated_at ON public.events;
CREATE TRIGGER events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS ticket_types_updated_at ON public.ticket_types;
CREATE TRIGGER ticket_types_updated_at BEFORE UPDATE ON public.ticket_types
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS orders_updated_at ON public.orders;
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS seating_maps_updated_at ON public.seating_maps;
CREATE TRIGGER seating_maps_updated_at BEFORE UPDATE ON public.seating_maps
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS producer_balances_updated_at ON public.producer_balances;
CREATE TRIGGER producer_balances_updated_at BEFORE UPDATE ON public.producer_balances
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tasks_updated_at ON public.tasks;
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.increment_ticket_sold()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.ticket_types
  SET quantity_sold = quantity_sold + 1
  WHERE id = NEW.ticket_type_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_ticket_created ON public.tickets;
CREATE TRIGGER on_ticket_created
  AFTER INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.increment_ticket_sold();

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
  SELECT * INTO v_coupon FROM public.coupons
  WHERE code = p_code AND event_id = p_event_id AND is_active = TRUE;
  IF v_coupon IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 0::DECIMAL, 'Cupom invalido'::TEXT;
    RETURN;
  END IF;
  IF v_coupon.valid_until IS NOT NULL AND v_coupon.valid_until < NOW() THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 0::DECIMAL, 'Cupom expirado'::TEXT;
    RETURN;
  END IF;
  IF v_coupon.max_uses IS NOT NULL AND v_coupon.used_count >= v_coupon.max_uses THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 0::DECIMAL, 'Limite de usos atingido'::TEXT;
    RETURN;
  END IF;
  IF v_coupon.min_order_value IS NOT NULL AND p_order_total < v_coupon.min_order_value THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 0::DECIMAL,
      'Valor minimo de ' || v_coupon.min_order_value || ' nao atingido'::TEXT;
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

DROP MATERIALIZED VIEW IF EXISTS public.event_summary;
CREATE MATERIALIZED VIEW public.event_summary AS
SELECT
  e.id as event_id,
  e.producer_id,
  e.title,
  e.status,
  COUNT(DISTINCT t.id) as total_tickets_sold,
  COALESCE(SUM(o.total), 0) as total_revenue,
  COUNT(DISTINCT o.user_id) as unique_buyers,
  MAX(o.created_at) as last_sale_at
FROM public.events e
LEFT JOIN public.orders o ON o.event_id = e.id AND o.status = 'paid'
LEFT JOIN public.tickets t ON t.event_id = e.id AND t.status = 'active'
GROUP BY e.id, e.producer_id, e.title, e.status;

CREATE INDEX IF NOT EXISTS idx_event_summary_producer ON public.event_summary(producer_id);
CREATE INDEX IF NOT EXISTS idx_event_summary_status ON public.event_summary(status);

-- ============================================================
-- 6. RLS POLICIES
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
CREATE POLICY "Users can read own profile" ON public.users FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Admins can read all users" ON public.users;
CREATE POLICY "Admins can read all users" ON public.users FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
CREATE POLICY "Admins can update all users" ON public.users FOR UPDATE USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Events are publicly readable when published" ON public.events;
CREATE POLICY "Events are publicly readable when published" ON public.events FOR SELECT USING (status = 'published' OR auth.uid() = producer_id);
DROP POLICY IF EXISTS "Producers can CRUD own events" ON public.events;
CREATE POLICY "Producers can CRUD own events" ON public.events FOR ALL USING (auth.uid() = producer_id);
DROP POLICY IF EXISTS "Admins can manage all events" ON public.events;
CREATE POLICY "Admins can manage all events" ON public.events FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

ALTER TABLE public.ticket_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ticket types readable by event owner and public" ON public.ticket_types;
CREATE POLICY "Ticket types readable by event owner and public" ON public.ticket_types FOR SELECT USING (is_active = TRUE AND EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND status = 'published') OR EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND producer_id = auth.uid()));
DROP POLICY IF EXISTS "Producers can manage own ticket types" ON public.ticket_types;
CREATE POLICY "Producers can manage own ticket types" ON public.ticket_types FOR ALL USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND producer_id = auth.uid()));

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own tickets" ON public.tickets;
CREATE POLICY "Users can view own tickets" ON public.tickets FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Producers can view event tickets" ON public.tickets;
CREATE POLICY "Producers can view event tickets" ON public.tickets FOR SELECT USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND producer_id = auth.uid()));
DROP POLICY IF EXISTS "Admins can manage all tickets" ON public.tickets;
CREATE POLICY "Admins can manage all tickets" ON public.tickets FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
CREATE POLICY "Users can view own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Producers can view event orders" ON public.orders;
CREATE POLICY "Producers can view event orders" ON public.orders FOR SELECT USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND producer_id = auth.uid()));
DROP POLICY IF EXISTS "Admins can manage all orders" ON public.orders;
CREATE POLICY "Admins can manage all orders" ON public.orders FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items;
CREATE POLICY "Users can view own order items" ON public.order_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND user_id = auth.uid()));

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT USING (EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND user_id = auth.uid()));
DROP POLICY IF EXISTS "Admins can view all payments" ON public.payments;
CREATE POLICY "Admins can view all payments" ON public.payments FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read active coupons" ON public.coupons;
CREATE POLICY "Anyone can read active coupons" ON public.coupons FOR SELECT USING (is_active = TRUE);
DROP POLICY IF EXISTS "Producers can manage own coupons" ON public.coupons;
CREATE POLICY "Producers can manage own coupons" ON public.coupons FOR ALL USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND producer_id = auth.uid()));

ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Producers can view event check_ins" ON public.check_ins;
CREATE POLICY "Producers can view event check_ins" ON public.check_ins FOR SELECT USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND producer_id = auth.uid()));
DROP POLICY IF EXISTS "Operators can create check_ins" ON public.check_ins;
CREATE POLICY "Operators can create check_ins" ON public.check_ins FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND producer_id = auth.uid()));

ALTER TABLE public.seating_maps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Producers can manage own seating maps" ON public.seating_maps;
CREATE POLICY "Producers can manage own seating maps" ON public.seating_maps FOR ALL USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND producer_id = auth.uid()));

ALTER TABLE public.producer_balances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Producers can view own balance" ON public.producer_balances;
CREATE POLICY "Producers can view own balance" ON public.producer_balances FOR SELECT USING (auth.uid() = producer_id);
DROP POLICY IF EXISTS "Admins can manage all balances" ON public.producer_balances;
CREATE POLICY "Admins can manage all balances" ON public.producer_balances FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Event team can manage tasks" ON public.tasks;
CREATE POLICY "Event team can manage tasks" ON public.tasks FOR ALL USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND producer_id = auth.uid()));

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Producers can manage event customers" ON public.customers;
CREATE POLICY "Producers can manage event customers" ON public.customers FOR ALL USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND producer_id = auth.uid()));

ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Producers can manage event communications" ON public.communications;
CREATE POLICY "Producers can manage event communications" ON public.communications FOR ALL USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND producer_id = auth.uid()));

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own certificates" ON public.certificates;
CREATE POLICY "Users can view own certificates" ON public.certificates FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Producers can manage event certificates" ON public.certificates;
CREATE POLICY "Producers can manage event certificates" ON public.certificates FOR ALL USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND producer_id = auth.uid()));

ALTER TABLE public.certificate_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Producers can manage own templates" ON public.certificate_templates;
CREATE POLICY "Producers can manage own templates" ON public.certificate_templates FOR ALL USING (auth.uid() = producer_id);

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read active affiliates" ON public.affiliates;
CREATE POLICY "Anyone can read active affiliates" ON public.affiliates FOR SELECT USING (is_active = TRUE);
DROP POLICY IF EXISTS "Producers can manage own affiliates" ON public.affiliates;
CREATE POLICY "Producers can manage own affiliates" ON public.affiliates FOR ALL USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND producer_id = auth.uid()));

ALTER TABLE public.event_gallery ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view gallery" ON public.event_gallery;
CREATE POLICY "Anyone can view gallery" ON public.event_gallery FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "Producers can manage own gallery" ON public.event_gallery;
CREATE POLICY "Producers can manage own gallery" ON public.event_gallery FOR ALL USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND producer_id = auth.uid()));

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Producers can view own withdrawals" ON public.withdrawals;
CREATE POLICY "Producers can view own withdrawals" ON public.withdrawals FOR SELECT USING (auth.uid() = producer_id);
DROP POLICY IF EXISTS "Admins can manage all withdrawals" ON public.withdrawals;
CREATE POLICY "Admins can manage all withdrawals" ON public.withdrawals FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
