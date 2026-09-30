-- Diagnóstico: verificar quais tabelas e colunas existem no Supabase
-- Rode isso no SQL Editor do Supabase e me envie o resultado

-- 1. Listar todas as tabelas públicas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 2. Ver colunas da tabela orders (se existir)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'orders';

-- 3. Ver colunas da tabela tickets (se existir)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'tickets';

-- 4. Ver colunas da tabela profiles (se existir)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'profiles';

-- 5. Ver colunas da tabela events (se existir)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'events';
