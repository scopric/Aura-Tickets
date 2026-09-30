-- ============================================================
-- Migração: Corrigir colunas faltantes na tabela tickets
-- Executar no SQL Editor do Supabase se encontrar erro:
--   ERROR: 42703: column "user_id" does not exist
-- ============================================================

DO $$
BEGIN
  -- Adicionar user_id se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.tickets ADD COLUMN user_id UUID REFERENCES public.profiles(id);
    -- Preencher user_id com base em orders.user_id (se possível)
    UPDATE public.tickets t
    SET user_id = o.user_id
    FROM public.orders o
    WHERE t.order_id = o.id AND t.user_id IS NULL;
  END IF;

  -- Adicionar buyer_name se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'buyer_name'
  ) THEN
    ALTER TABLE public.tickets ADD COLUMN buyer_name TEXT NOT NULL DEFAULT 'Participante';
  END IF;

  -- Adicionar buyer_email se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'buyer_email'
  ) THEN
    ALTER TABLE public.tickets ADD COLUMN buyer_email TEXT;
  END IF;

  -- Adicionar buyer_cpf se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'buyer_cpf'
  ) THEN
    ALTER TABLE public.tickets ADD COLUMN buyer_cpf TEXT;
  END IF;

  -- Adicionar price_paid se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'price_paid'
  ) THEN
    ALTER TABLE public.tickets ADD COLUMN price_paid NUMERIC(10,2) NOT NULL DEFAULT 0.00;
  END IF;

  -- Adicionar order_item_id se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'order_item_id'
  ) THEN
    ALTER TABLE public.tickets ADD COLUMN order_item_id UUID REFERENCES public.order_items(id);
  END IF;

  -- Adicionar checked_in_by se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'checked_in_by'
  ) THEN
    ALTER TABLE public.tickets ADD COLUMN checked_in_by UUID REFERENCES public.profiles(id);
  END IF;

  -- Adicionar transferred_to se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'transferred_to'
  ) THEN
    ALTER TABLE public.tickets ADD COLUMN transferred_to UUID REFERENCES public.profiles(id);
  END IF;

  -- Adicionar transfer_count se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'transfer_count'
  ) THEN
    ALTER TABLE public.tickets ADD COLUMN transfer_count INTEGER DEFAULT 0;
  END IF;

  -- Atualizar constraint de status se necessário
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'status'
  ) THEN
    -- Remover constraint antiga se existir e recriar com valores atualizados
    ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
    ALTER TABLE public.tickets ADD CONSTRAINT tickets_status_check
      CHECK (status IN ('active', 'used', 'cancelled', 'refunded', 'transferred'));
  END IF;
END $$;
