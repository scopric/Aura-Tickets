-- ============================================================
-- DIAGNÓSTICO COMPLETO DO SCHEMA AURA TICKETS
-- Execute no SQL Editor do Supabase para verificar estado
-- ============================================================

-- 1. Verificar colunas da tabela tickets
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tickets'
ORDER BY ordinal_position;

-- 2. Verificar se tabelas do matchmaking existem
SELECT 
  table_name,
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = t.table_name
  ) as existe
FROM (VALUES 
  ('user_profiles_ext'),
  ('collective_tables'),
  ('table_members'),
  ('messages')
) AS t(table_name);

-- 3. Verificar trigger de collective ticket
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public' 
AND trigger_name = 'trg_collective_ticket';

-- 4. Verificar realtime está habilitado para messages
SELECT 
  tablename,
  EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE schemaname = 'public' AND tablename = t.tablename
  ) as realtime_ativo
FROM (VALUES ('messages')) AS t(tablename);

-- 5. Verificar tabela profiles (usada em user_id FK)
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY ordinal_position;

-- 6. Verificar tabela orders (usada em order_id FK)
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'orders'
ORDER BY ordinal_position;

-- 7. Verificar tabela order_items (usada em order_item_id FK)
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'order_items'
ORDER BY ordinal_position;

-- 8. Verificar tabela ticket_types (usada em ticket_type_id FK)
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'ticket_types'
ORDER BY ordinal_position;
