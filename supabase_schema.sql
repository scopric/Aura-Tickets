-- 1. Core: Usuários e Perfis
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'producer', 'admin')),
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  phone TEXT,
  city TEXT,
  birth_date DATE,
  instagram TEXT,
  tiktok TEXT,
  linkedin TEXT,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Eventos
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  date DATE NOT NULL,
  time TIME,
  location TEXT,
  address TEXT,
  cover_image TEXT,
  gallery JSONB DEFAULT '[]',
  tags TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','published','cancelled','ended')),
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public','private','password')),
  password TEXT,
  capacity INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tipos de ingresso por evento
CREATE TABLE ticket_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  capacity INTEGER,
  sold INTEGER DEFAULT 0,
  type TEXT DEFAULT 'individual' CHECK (type IN ('individual','vip','coletiva','mesa')),
  perks TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  lot_number INTEGER DEFAULT 1,
  sale_start TIMESTAMPTZ,
  sale_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Compras e Checkout
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  event_id UUID NOT NULL REFERENCES events(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled','refunded')),
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method TEXT CHECK (payment_method IN ('pix','credit_card','boleto')),
  coupon_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  ticket_type_id UUID NOT NULL REFERENCES ticket_types(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ingressos individuais (gerados após pagamento)
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES order_items(id),
  user_id UUID NOT NULL REFERENCES profiles(id),
  event_id UUID NOT NULL REFERENCES events(id),
  ticket_type_id UUID NOT NULL REFERENCES ticket_types(id),
  qr_code TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','used','cancelled','transferred')),
  checked_in_at TIMESTAMPTZ,
  transferred_to UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CRM
CREATE TABLE pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES profiles(id),
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE crm_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES profiles(id),
  stage_id UUID REFERENCES pipeline_stages(id),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  source TEXT DEFAULT 'organic',
  score INTEGER DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  potential_value NUMERIC(10,2) DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  event_interest TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE crm_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('message','call','email','note','meeting')),
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE crm_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date TIMESTAMPTZ,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Cardápio / Comanda Digital
CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  producer_id UUID NOT NULL REFERENCES profiles(id),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  category TEXT DEFAULT 'bebida' CHECK (category IN ('bebida','comida','combo','merch','servico')),
  image_url TEXT,
  is_available BOOLEAN DEFAULT true,
  stock INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE menu_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id),
  user_id UUID NOT NULL REFERENCES profiles(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','preparing','ready','delivered','cancelled')),
  pickup_time TIMESTAMPTZ,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  qr_code TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE menu_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_order_id UUID NOT NULL REFERENCES menu_orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL
);

-- 6. Mesa Coletiva (Matchmaking)
CREATE TABLE collective_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  ticket_type_id UUID REFERENCES ticket_types(id),
  name TEXT NOT NULL,
  theme TEXT,
  capacity INTEGER DEFAULT 6,
  compatibility_score NUMERIC(3,1),
  status TEXT DEFAULT 'open' CHECK (status IN ('open','full','closed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE table_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES collective_tables(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  vibe TEXT,
  role TEXT DEFAULT 'member',
  matchmaking_answers JSONB DEFAULT '{}',
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Financeiro e Carteira
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES profiles(id),
  event_id UUID REFERENCES events(id),
  order_id UUID REFERENCES orders(id),
  type TEXT NOT NULL CHECK (type IN ('income','expense','withdrawal','refund','fee')),
  amount NUMERIC(10,2) NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending','completed','failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES profiles(id),
  amount NUMERIC(10,2) NOT NULL,
  pix_key TEXT,
  bank_account JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- 8. Cupons e Afiliados
CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES profiles(id),
  event_id UUID REFERENCES events(id),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT DEFAULT 'percent' CHECK (discount_type IN ('percent','fixed')),
  discount_value NUMERIC(10,2) NOT NULL,
  max_uses INTEGER,
  uses INTEGER DEFAULT 0,
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES profiles(id),
  event_id UUID REFERENCES events(id),
  affiliate_user_id UUID NOT NULL REFERENCES profiles(id),
  commission_percent NUMERIC(5,2) DEFAULT 10,
  sales INTEGER DEFAULT 0,
  total_earned NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Check-in e Pós-evento
CREATE TABLE check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id),
  ticket_id UUID NOT NULL REFERENCES tickets(id),
  user_id UUID NOT NULL REFERENCES profiles(id),
  checked_in_by UUID REFERENCES profiles(id),
  checked_in_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE event_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id),
  user_id UUID NOT NULL REFERENCES profiles(id),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

CREATE TABLE interest_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id),
  user_id UUID NOT NULL REFERENCES profiles(id),
  ticket_type_id UUID REFERENCES ticket_types(id),
  notified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- 10. Notificações e Comunicação
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  title TEXT NOT NULL,
  body TEXT,
  type TEXT DEFAULT 'info' CHECK (type IN ('info','sale','reminder','promo','system')),
  is_read BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES profiles(id),
  recipient_id UUID NOT NULL REFERENCES profiles(id),
  lead_id UUID REFERENCES crm_leads(id),
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Produção e Equipe
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES profiles(id),
  user_id UUID NOT NULL REFERENCES profiles(id),
  role TEXT DEFAULT 'viewer' CHECK (role IN ('admin','editor','viewer')),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);

CREATE TABLE producer_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES profiles(id),
  event_id UUID REFERENCES events(id),
  assigned_to UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES profiles(id),
  name TEXT NOT NULL,
  type TEXT,
  contact TEXT,
  logo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Certificados
CREATE TABLE certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id),
  template JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE issued_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id UUID NOT NULL REFERENCES certificates(id),
  user_id UUID NOT NULL REFERENCES profiles(id),
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  code TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT
);

-- 13. Configurações e Admin
CREATE TABLE platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  type TEXT DEFAULT 'bug' CHECK (type IN ('bug','feature','other')),
  message TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','in_review','resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE producer_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES profiles(id) UNIQUE,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free','starter','pro','enterprise')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

-- 14. RLS e Policies Básicas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário vê próprio perfil" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Usuário edita próprio perfil" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admin vê todos" ON profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Produtor gerencia seus eventos" ON events FOR ALL USING (producer_id = auth.uid());
CREATE POLICY "Público lê eventos publicados" ON events FOR SELECT USING (status = 'published');

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário vê seus ingressos" ON tickets FOR SELECT USING (user_id = auth.uid());

-- 15. Trigger: Criar Profile Automático
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
