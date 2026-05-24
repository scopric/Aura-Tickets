-- SEED AURA TICKETS — Dados de demonstração para MVP
-- Execute no SQL Editor do Supabase (https://supabase.com/dashboard/project/rwaezeqyuhxrssntcxdv/sql)
--
-- INSTRUÇÕES:
-- 1. Acesse o app e registre uma conta de PRODUTOR em /auth/register
--    (use: produtor@aura.teste / senha123)
-- 2. No Supabase Dashboard → Table Editor → profiles, copie o UUID do produtor
-- 3. Substitua 'COLE_AQUI_O_UUID_DO_PRODUTOR' abaixo por esse UUID
-- 4. Rode este script

DO $$
DECLARE
  v_producer_id UUID := 'COLE_AQUI_O_UUID_DO_PRODUTOR'::UUID;
  v_event1_id   UUID := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::UUID;
  v_event2_id   UUID := 'b2c3d4e5-f6a7-8901-bcde-f23456789012'::UUID;
  v_event3_id   UUID := 'c3d4e5f6-a7b8-9012-cdef-345678901234'::UUID;
BEGIN

-- ============================================================
-- 1. EVENTOS
-- ============================================================
INSERT INTO public.events (id, producer_id, title, subtitle, slug, description, short_description, cover_image, image_url, gallery, category, tags, venue_name, venue_address, venue_city, venue_state, date, time, start_date, end_date, status, visibility, capacity, branding, settings, created_at, updated_at)
VALUES
  (v_event1_id, v_producer_id, 'Noite Eletro 2025', 'Uma experiência sonora imersiva', 'noite-eletro-2025', 'A Noite Eletro 2025 reúne os melhores DJs de Curitiba em uma noite inesquecível de música eletrônica. Prepare-se para uma experiência sensorial completa com luzes, som de alta fidelidade e uma energia contagiante.', 'Experiência sonora imersiva com os melhores DJs de Curitiba.', '/images/hero-bg.jpg', '/images/hero-bg.jpg', '["/images/concert-1.jpg","/images/concert-2.jpg","/images/concert-3.jpg"]', 'Música', '{"eletronica","festa","curitiba"}', 'Warehouse Central', 'R. XV de Novembro, 123 - Centro', 'Curitiba', 'PR', '2025-06-15', '22:00', '2025-06-15T22:00:00-03:00', '2025-06-16T06:00:00-03:00', 'published', 'public', 500, '{"primaryColor":"#7a3b69"}', '{"taxaServico":10}', now(), now()),
  (v_event2_id, v_producer_id, 'Jazz Sunset Session', 'Música ao vivo no rooftop', 'jazz-sunset-session', 'Uma tarde de jazz ao vivo no rooftop mais charmoso da cidade. Acompanhe o pôr do sol com boa música, drinks especiais e uma atmosfera única.', 'Jazz ao vivo no rooftop com pôr do sol.', '/images/event-card-1.jpg', '/images/event-card-1.jpg', '["/images/concert-2.jpg"]', 'Música', '{"jazz","rooftop","sunset"}', 'Rooftop Skyline', 'Av. das Américas, 456 - Batel', 'Curitiba', 'PR', '2025-06-22', '17:00', '2025-06-22T17:00:00-03:00', '2025-06-22T23:00:00-03:00', 'published', 'public', 200, '{"primaryColor":"#d4a373"}', '{"taxaServico":8}', now(), now()),
  (v_event3_id, v_producer_id, 'Feira de Arte Contemporânea', 'Arte, design e criatividade', 'feira-arte-contemporanea', 'A maior feira de arte contemporânea do sul do Brasil reúne artistas locais e nacionais em um espaço de exposição e vendas único.', 'Arte contemporânea e design em Curitiba.', '/images/event-card-2.jpg', '/images/event-card-2.jpg', '["/images/concert-3.jpg"]', 'Arte', '{"arte","design","cultura"}', 'Parque Barigüi', 'R. Prof. Guido Straube, s/n - Bigorrilho', 'Curitiba', 'PR', '2025-07-05', '10:00', '2025-07-05T10:00:00-03:00', '2025-07-05T20:00:00-03:00', 'draft', 'public', 1000, '{"primaryColor":"#2a9d8f"}', '{"taxaServico":5}', now(), now())
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;

-- ============================================================
-- 2. TIPOS DE INGRESSO
-- ============================================================
INSERT INTO public.ticket_types (id, event_id, name, description, price, capacity, quantity_total, sold, min_per_order, max_per_order, perks, type, is_active, created_at, updated_at)
VALUES
  ('t1-ind-'||v_event1_id, v_event1_id, 'Ingresso Individual', 'Acesso geral ao evento', 80.00, 300, 300, 145, 1, 10, '["Acesso geral","1 drink de boas-vindas"]', 'individual', true, now(), now()),
  ('t1-vip-'||v_event1_id, v_event1_id, 'Ingresso VIP', 'Acesso VIP com open bar', 180.00, 100, 100, 78, 1, 5, '["Acesso prioritário","Open bar premium","Área VIP","Meet & greet"]', 'vip', true, now(), now()),
  ('t1-mc-'||v_event1_id, v_event1_id, 'Mesa Coletiva', 'Mesa para 6 pessoas com matchmaking', 160.00, 60, 60, 42, 6, 6, '["Mesa para 6","Matchmaking por afinidade","1 garrafa de espumante","Acesso VIP"]', 'coletiva', true, now(), now()),
  ('t2-ind-'||v_event2_id, v_event2_id, 'Ingresso Geral', 'Acesso ao rooftop e show', 60.00, 150, 150, 89, 1, 10, '["Acesso ao rooftop","1 drink de boas-vindas"]', 'individual', true, now(), now()),
  ('t2-vip-'||v_event2_id, v_event2_id, 'Mesa VIP', 'Mesa reservada com vista privilegiada', 120.00, 30, 30, 18, 2, 6, '["Mesa reservada","Vista para o pôr do sol","Open bar de espumantes"]', 'vip', true, now(), now()),
  ('t3-ind-'||v_event3_id, v_event3_id, 'Entrada Geral', 'Acesso à feira e exposições', 30.00, 800, 800, 0, 1, 20, '["Acesso às exposições","Folder do evento"]', 'individual', true, now(), now()),
  ('t3-vip-'||v_event3_id, v_event3_id, 'Passe VIP', 'Acesso VIP com workshop', 90.00, 100, 100, 0, 1, 5, '["Acesso VIP","Workshop de arte","Café da manhã","Kit do artista"]', 'vip', true, now(), now())
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. CARDÁPIO / MENU ITEMS
-- ============================================================
INSERT INTO public.menu_items (id, event_id, producer_id, name, description, price, category, image_url, is_available, stock, created_at)
VALUES
  (gen_random_uuid(), v_event1_id, v_producer_id, 'Gin Tônica Aura', 'Gin importado, tônica artesanal, zimbro e rosa', 28.00, 'bebida', '/images/concert-1.jpg', true, 200, now()),
  (gen_random_uuid(), v_event1_id, v_producer_id, 'Espumante Brut', 'Espumante nacional brut, bem gelado', 35.00, 'bebida', '/images/concert-2.jpg', true, 150, now()),
  (gen_random_uuid(), v_event1_id, v_producer_id, 'Burger Eletro', 'Hambúrguer artesanal, queijo cheddar, cebola caramelizada', 32.00, 'comida', '/images/concert-3.jpg', true, 100, now()),
  (gen_random_uuid(), v_event1_id, v_producer_id, 'Combo VIP', '2 drinks + 1 porção + 1 água', 75.00, 'combo', '/images/hero-bg.jpg', true, 50, now()),
  (gen_random_uuid(), v_event1_id, v_producer_id, 'Camiseta Noite Eletro', 'Edição limitada, 100% algodão', 65.00, 'merch', '/images/event-card-1.jpg', true, 80, now()),
  (gen_random_uuid(), v_event2_id, v_producer_id, 'Dry Martini', 'Gin, vermute seco, azeitona', 32.00, 'bebida', '/images/concert-1.jpg', true, 100, now()),
  (gen_random_uuid(), v_event2_id, v_producer_id, 'Cheese Board', 'Tábua de queijos finos com geleia e nozes', 45.00, 'comida', '/images/concert-2.jpg', true, 40, now()),
  (gen_random_uuid(), v_event2_id, v_producer_id, 'Espumante Rosé', 'Espumante rosé nacional, servido em taça', 38.00, 'bebida', '/images/concert-3.jpg', true, 80, now()),
  (gen_random_uuid(), v_event3_id, v_producer_id, 'Café Especial', 'Café de origem única, método pour over', 12.00, 'bebida', '/images/event-card-2.jpg', true, 300, now()),
  (gen_random_uuid(), v_event3_id, v_producer_id, 'Pão de Queijo Gourmet', 'Pão de queijo recheado com requeijão', 15.00, 'comida', '/images/hero-bg.jpg', true, 200, now())
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. CRM — PIPELINE E LEADS
-- ============================================================
INSERT INTO public.pipeline_stages (id, producer_id, name, color, position, created_at)
VALUES
  ('st-novo-'||v_producer_id, v_producer_id, 'Novo', '#3b82f6', 0, now()),
  ('st-qual-'||v_producer_id, v_producer_id, 'Qualificado', '#8b5cf6', 1, now()),
  ('st-prop-'||v_producer_id, v_producer_id, 'Proposta', '#f59e0b', 2, now()),
  ('st-neg-'||v_producer_id, v_producer_id, 'Negociação', '#ec4899', 3, now()),
  ('st-fech-'||v_producer_id, v_producer_id, 'Fechado', '#22c55e', 4, now()),
  ('st-perd-'||v_producer_id, v_producer_id, 'Perdido', '#ef4444', 5, now())
ON CONFLICT DO NOTHING;

INSERT INTO public.crm_leads (id, producer_id, stage_id, full_name, email, phone, source, score, potential_value, tags, event_interest, notes, created_at, updated_at)
VALUES
  (gen_random_uuid(), v_producer_id, 'st-novo-'||v_producer_id, 'Carlos Silva', 'carlos@email.com', '41999991111', 'instagram', 65, 320.00, '{"interessado","mesa"}', 'Noite Eletro 2025', 'Quer mesa coletiva para grupo de 6 amigos', now(), now()),
  (gen_random_uuid(), v_producer_id, 'st-qual-'||v_producer_id, 'Mariana Oliveira', 'mariana@email.com', '41988882222', 'site', 82, 180.00, '{"vip","casal"}', 'Noite Eletro 2025', 'Interesse em ingresso VIP para casal', now(), now()),
  (gen_random_uuid(), v_producer_id, 'st-prop-'||v_producer_id, 'Pedro Henrique', 'pedro@email.com', '41977773333', 'indicacao', 45, 80.00, '{"individual","estudante"}', 'Jazz Sunset', 'Buscando ingresso com desconto estudante', now(), now()),
  (gen_random_uuid(), v_producer_id, 'st-fech-'||v_producer_id, 'Juliana Martins', 'juliana@email.com', '41966664444', 'organic', 95, 540.00, '{"mesa","aniversario"}', 'Noite Eletro 2025', 'Comprou mesa coletiva para aniversário', now(), now())
ON CONFLICT DO NOTHING;

-- ============================================================
-- 5. MESA COLETIVA
-- ============================================================
INSERT INTO public.collective_tables (id, event_id, name, theme, capacity, compatibility_score, status, created_at)
VALUES
  ('mc-aurora-'||v_event1_id, v_event1_id, 'Mesa Aurora', 'Vibe energética e extrovertida', 6, 87.5, 'open', now()),
  ('mc-nebula-'||v_event1_id, v_event1_id, 'Mesa Nebula', 'Vibe chill e introspectiva', 6, 92.0, 'open', now())
ON CONFLICT DO NOTHING;

END $$;
