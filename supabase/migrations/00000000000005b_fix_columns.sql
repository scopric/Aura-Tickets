-- ============================================================
-- Migration 05b: Adiciona colunas faltantes em tabelas existentes
-- Rode isso ANTES do 05_full_schema.sql
-- ============================================================

-- Verificar e adicionar user_id em orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN user_id UUID REFERENCES profiles(id);
  END IF;
END $$;

-- Verificar e adicionar user_id em tickets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.tickets ADD COLUMN user_id UUID REFERENCES profiles(id);
  END IF;
END $$;

-- Verificar e adicionar event_id em tickets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'event_id'
  ) THEN
    ALTER TABLE public.tickets ADD COLUMN event_id UUID REFERENCES events(id);
  END IF;
END $$;

-- Verificar e adicionar order_id em tickets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'order_id'
  ) THEN
    ALTER TABLE public.tickets ADD COLUMN order_id UUID REFERENCES orders(id);
  END IF;
END $$;

-- Verificar e adicionar ticket_type_id em tickets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'ticket_type_id'
  ) THEN
    ALTER TABLE public.tickets ADD COLUMN ticket_type_id UUID REFERENCES ticket_types(id);
  END IF;
END $$;

-- Verificar e adicionar qr_code em tickets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'qr_code'
  ) THEN
    ALTER TABLE public.tickets ADD COLUMN qr_code TEXT UNIQUE;
  END IF;
END $$;

-- Verificar e adicionar status em tickets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.tickets ADD COLUMN status TEXT DEFAULT 'active';
  END IF;
END $$;

-- Verificar e adicionar price_paid em tickets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'price_paid'
  ) THEN
    ALTER TABLE public.tickets ADD COLUMN price_paid DECIMAL(10,2) DEFAULT 0;
  END IF;
END $$;

-- Verificar e adicionar buyer_name em tickets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'buyer_name'
  ) THEN
    ALTER TABLE public.tickets ADD COLUMN buyer_name TEXT;
  END IF;
END $$;

-- Verificar e adicionar buyer_email em tickets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'buyer_email'
  ) THEN
    ALTER TABLE public.tickets ADD COLUMN buyer_email TEXT;
  END IF;
END $$;

-- Verificar e adicionar buyer_cpf em tickets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'buyer_cpf'
  ) THEN
    ALTER TABLE public.tickets ADD COLUMN buyer_cpf TEXT;
  END IF;
END $$;

-- Verificar e adicionar checked_in_at em tickets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'checked_in_at'
  ) THEN
    ALTER TABLE public.tickets ADD COLUMN checked_in_at TIMESTAMPTZ;
  END IF;
END $$;

-- Verificar e adicionar checked_in_by em tickets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'checked_in_by'
  ) THEN
    ALTER TABLE public.tickets ADD COLUMN checked_in_by UUID REFERENCES profiles(id);
  END IF;
END $$;

-- Verificar e adicionar transfer_count em tickets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'transfer_count'
  ) THEN
    ALTER TABLE public.tickets ADD COLUMN transfer_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Verificar e adicionar coupon_id em orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'coupon_id'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN coupon_id UUID;
  END IF;
END $$;

-- Verificar e adicionar subtotal em orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'subtotal'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN subtotal DECIMAL(10,2) DEFAULT 0;
  END IF;
END $$;

-- Verificar e adicionar discount em orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'discount'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN discount DECIMAL(10,2) DEFAULT 0;
  END IF;
END $$;

-- Verificar e adicionar service_fee em orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'service_fee'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN service_fee DECIMAL(10,2) DEFAULT 0;
  END IF;
END $$;

-- Verificar e adicionar processing_fee em orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'processing_fee'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN processing_fee DECIMAL(10,2) DEFAULT 0;
  END IF;
END $$;

-- Verificar e adicionar payment_method em orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN payment_method TEXT;
  END IF;
END $$;

-- Verificar e adicionar payment_gateway em orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'payment_gateway'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN payment_gateway TEXT;
  END IF;
END $$;

-- Verificar e adicionar gateway_payment_id em orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'gateway_payment_id'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN gateway_payment_id TEXT;
  END IF;
END $$;

-- Verificar e adicionar customer_name em orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'customer_name'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN customer_name TEXT;
  END IF;
END $$;

-- Verificar e adicionar customer_email em orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'customer_email'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN customer_email TEXT;
  END IF;
END $$;

-- Verificar e adicionar customer_cpf em orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'customer_cpf'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN customer_cpf TEXT;
  END IF;
END $$;

-- Verificar e adicionar customer_phone em orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'customer_phone'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN customer_phone TEXT;
  END IF;
END $$;

-- Verificar e adicionar unit_price em order_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'unit_price'
  ) THEN
    ALTER TABLE public.order_items ADD COLUMN unit_price DECIMAL(10,2) DEFAULT 0;
  END IF;
END $$;

-- Verificar e adicionar subtotal em order_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'subtotal'
  ) THEN
    ALTER TABLE public.order_items ADD COLUMN subtotal DECIMAL(10,2) DEFAULT 0;
  END IF;
END $$;

-- ============================================================
-- FIM: Agora rode o 00000000000005_full_schema.sql
-- ============================================================
