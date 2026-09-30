-- ============================================================
-- Migration 05a: Criar tabelas base que podem não existir
-- Rode ANTES do 00000000000005_full_schema.sql
-- ============================================================

-- Tabela: profiles (base mínima se não existir)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  bio TEXT,
  city TEXT,
  website TEXT,
  instagram TEXT,
  tiktok TEXT,
  linkedin TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'producer', 'admin')),
  plan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: producer_profiles (base mínima se não existir)
CREATE TABLE IF NOT EXISTS public.producer_profiles (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL DEFAULT 'Minha Empresa',
  cnpj TEXT,
  bank_account JSONB NOT NULL DEFAULT '{}',
  pix_key TEXT,
  notification_settings JSONB NOT NULL DEFAULT '{}',
  api_key TEXT,
  webhook_url TEXT,
  stripe_account_id TEXT,
  balance DECIMAL(10,2) DEFAULT 0,
  total_earnings DECIMAL(10,2) DEFAULT 0,
  withdrawal_method JSONB DEFAULT '{}',
  branding JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: events (base mínima se não existir)
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES profiles(id),
  title TEXT NOT NULL,
  subtitle TEXT,
  slug TEXT UNIQUE,
  description TEXT,
  short_description TEXT,
  cover_image TEXT,
  image_url TEXT,
  gallery JSONB DEFAULT '[]',
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  venue_name TEXT,
  venue_address TEXT,
  venue_city TEXT,
  venue_state TEXT,
  venue_zip TEXT,
  venue_lat DECIMAL(10,8),
  venue_lng DECIMAL(11,8),
  date TEXT,
  time TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled', 'ended')),
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'unlisted')),
  password TEXT,
  capacity INTEGER,
  branding JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  meta_title TEXT,
  meta_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: ticket_types (base mínima se não existir)
CREATE TABLE IF NOT EXISTS public.ticket_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  quantity_total INTEGER DEFAULT 0,
  quantity_sold INTEGER DEFAULT 0,
  capacity INTEGER,
  sold INTEGER DEFAULT 0,
  min_per_order INTEGER DEFAULT 1,
  max_per_order INTEGER DEFAULT 10,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  perks JSONB DEFAULT '[]',
  sort_order INTEGER DEFAULT 0,
  type TEXT DEFAULT 'individual' CHECK (type IN ('individual', 'vip', 'coletiva', 'mesa')),
  is_active BOOLEAN DEFAULT TRUE,
  lot_number INTEGER DEFAULT 1,
  sale_start TIMESTAMPTZ,
  sale_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: orders (base mínima se não existir)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  event_id UUID NOT NULL REFERENCES events(id),
  coupon_id UUID,
  subtotal DECIMAL(10,2) DEFAULT 0,
  discount DECIMAL(10,2) DEFAULT 0,
  service_fee DECIMAL(10,2) DEFAULT 0,
  processing_fee DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
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

-- Tabela: order_items (base mínima se não existir)
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  ticket_type_id UUID NOT NULL REFERENCES ticket_types(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) DEFAULT 0,
  subtotal DECIMAL(10,2) DEFAULT 0
);

-- Tabela: tickets (base mínima se não existir)
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_type_id UUID REFERENCES ticket_types(id),
  event_id UUID REFERENCES events(id),
  order_id UUID REFERENCES orders(id),
  user_id UUID REFERENCES profiles(id),
  buyer_name TEXT,
  buyer_email TEXT,
  buyer_cpf TEXT,
  qr_code TEXT UNIQUE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'used', 'cancelled', 'refunded')),
  price_paid DECIMAL(10,2) DEFAULT 0,
  checked_in_at TIMESTAMPTZ,
  checked_in_by UUID REFERENCES profiles(id),
  transfer_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: team_members (base mínima se não existir)
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES profiles(id),
  user_id UUID REFERENCES profiles(id),
  role TEXT NOT NULL DEFAULT 'viewer',
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: menu_items (base mínima se não existir)
CREATE TABLE IF NOT EXISTS public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id),
  producer_id UUID REFERENCES profiles(id),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  category TEXT DEFAULT 'bebida',
  is_available BOOLEAN DEFAULT TRUE,
  image_url TEXT,
  stock INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: contact_messages (base mínima se não existir)
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: newsletter_subscribers (base mínima se não existir)
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: feedback (base mínima se não existir)
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  rating INTEGER,
  user_id UUID REFERENCES profiles(id),
  email TEXT,
  page TEXT,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FIM: Agora rode o 00000000000005_full_schema.sql
-- ============================================================
