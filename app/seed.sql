-- ============================================================
-- AURA PLATFORM — Seed de Dados de Demonstração
-- Execute APÓS criar os usuários no Supabase Auth
-- ============================================================
-- Substitua os UUIDs abaixo pelos IDs reais dos usuários criados no Auth
-- Você encontra os IDs em: Supabase Dashboard > Authentication > Users

-- IDs de exemplo (substitua pelos reais):
-- Produtor: 'd3f6ab7a-b847-4aa4-af6c-033a738c2ce4'
-- Admin:    'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
-- Cliente:  'b2c3d4e5-f6a7-8901-bcde-f23456789012'

-- Para funcionar com o modo demo do frontend, use EXATAMENTE estes UUIDs:
-- Crie os usuários no painel Supabase com estes IDs (se possível)
-- ou atualize o frontend com os IDs reais após criar.

DO $$
DECLARE
  v_producer_id UUID := 'd3f6ab7a-b847-4aa4-af6c-033a738c2ce4';
  v_admin_id UUID := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  v_customer_id UUID := 'b2c3d4e5-f6a7-8901-bcde-f23456789012';
  v_event1_id UUID := 'e1a2b3c4-d5e6-7890-abcd-ef1234567890';
  v_event2_id UUID := 'f2b3c4d5-e6f7-8901-bcde-f23456789012';
  v_event3_id UUID := 'a3c4d5e6-f7a8-9012-cdef-345678901234';
  v_tt1_id UUID := 't1a2b3c4-d5e6-7890-abcd-ef1234567890';
  v_tt2_id UUID := 't2b3c4d5-e6f7-8901-bcde-f23456789012';
  v_tt3_id UUID := 't3c4d5e6-f7a8-9012-cdef-345678901234';
  v_order1_id UUID := 'o1a2b3c4-d5e6-7890-abcd-ef1234567890';
BEGIN

-- ============================================================
-- 1. EVENTOS
-- ============================================================
INSERT INTO public.events (id, producer_id, title, slug, description, short_description, image_url, category, tags, venue_name, venue_address, venue_city, venue_state, start_date, end_date, status, visibility, meta_title, meta_description)
VALUES
  (v_event1_id, v_producer_id, 'Festival de Verão 2025', 'festival-de-verao-2025', 'O maior festival de verão da região!', 'Música, comida e diversão para toda a família.', 'https://images.unsplash.com/photo-1533174072545-e8d4aa97edf9?w=800', 'Música', ARRAY['festival', 'verão', 'música'], 'Praia Central', 'Av. Beira Mar, 1000', 'Santos', 'SP', '2025-12-20 14:00:00+00', '2025-12-22 23:00:00+00', 'published', 'public', 'Festival de Verão 2025 | Evokaa Tickets', 'O maior festival de verão da região! Garanta seu ingresso.'),
  (v_event2_id, v_producer_id, 'Conferência Tech Brasil', 'conferencia-tech-brasil', 'A maior conferência de tecnologia do Brasil.', 'Palestras, workshops e networking.', 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800', 'Tecnologia', ARRAY['tech', 'conferência', 'inovação'], 'Centro de Convenções', 'Rua da Tecnologia, 500', 'São Paulo', 'SP', '2025-11-15 09:00:00+00', '2025-11-17 18:00:00+00', 'published', 'public', 'Conferência Tech Brasil 2025', 'A maior conferência de tecnologia do Brasil.'),
  (v_event3_id, v_producer_id, 'Show de Rock Independente', 'show-rock-independente', 'Uma noite de rock autêntico e independente.', 'As melhores bandas independentes da cena local.', 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800', 'Música', ARRAY['rock', 'independente', 'show'], 'Casa de Shows Aurora', 'Rua do Rock, 42', 'Curitiba', 'PR', '2025-10-30 20:00:00+00', '2025-10-31 02:00:00+00', 'draft', 'public', 'Show de Rock Independente', 'Uma noite de rock autêntico e independente.');

-- ============================================================
-- 2. TICKET TYPES
-- ============================================================
INSERT INTO public.ticket_types (id, event_id, name, description, price, quantity_total, quantity_sold, min_per_order, max_per_order, sort_order, is_active)
VALUES
  (v_tt1_id, v_event1_id, 'Ingresso Normal', 'Acesso geral ao festival', 50.00, 500, 45, 1, 10, 1, true),
  (v_tt2_id, v_event1_id, 'Ingresso VIP', 'Acesso VIP com open bar e área exclusiva', 150.00, 100, 12, 1, 4, 2, true),
  (v_tt3_id, v_event2_id, 'Passaporte Completo', 'Acesso a todas as palestras e workshops', 200.00, 300, 78, 1, 5, 1, true),
  (gen_random_uuid(), v_event2_id, 'Workshop Individual', 'Acesso a um workshop específico', 80.00, 50, 23, 1, 3, 2, true),
  (gen_random_uuid(), v_event3_id, 'Entrada Geral', 'Acesso ao show', 30.00, 200, 0, 1, 5, 1, true);

-- ============================================================
-- 3. ORDERS (pedidos de exemplo)
-- ============================================================
INSERT INTO public.orders (id, user_id, event_id, subtotal, discount, service_fee, processing_fee, total, status, payment_method, customer_name, customer_email, customer_cpf, customer_phone)
VALUES
  (v_order1_id, v_customer_id, v_event1_id, 100.00, 0, 5.00, 3.50, 108.50, 'paid', 'pix', 'João Silva', 'joao@email.com', '12345678901', '11999999999'),
  (gen_random_uuid(), v_customer_id, v_event1_id, 150.00, 0, 7.50, 5.25, 162.75, 'paid', 'credit_card', 'Maria Oliveira', 'maria@email.com', '98765432101', '11988888888'),
  (gen_random_uuid(), v_customer_id, v_event2_id, 200.00, 20.00, 9.00, 6.30, 195.30, 'paid', 'pix', 'Carlos Souza', 'carlos@email.com', '45678912301', '11977777777');

-- ============================================================
-- 4. TICKETS (ingressos gerados)
-- ============================================================
INSERT INTO public.tickets (ticket_type_id, event_id, order_id, user_id, buyer_name, buyer_email, buyer_cpf, qr_code, status, price_paid)
VALUES
  (v_tt1_id, v_event1_id, v_order1_id, v_customer_id, 'João Silva', 'joao@email.com', '12345678901', 'QR-' || gen_random_uuid(), 'active', 50.00),
  (v_tt1_id, v_event1_id, v_order1_id, v_customer_id, 'João Silva', 'joao@email.com', '12345678901', 'QR-' || gen_random_uuid(), 'active', 50.00),
  (v_tt2_id, v_event1_id, (SELECT id FROM public.orders WHERE total = 162.75 LIMIT 1), v_customer_id, 'Maria Oliveira', 'maria@email.com', '98765432101', 'QR-' || gen_random_uuid(), 'used', 150.00),
  (v_tt3_id, v_event2_id, (SELECT id FROM public.orders WHERE total = 195.30 LIMIT 1), v_customer_id, 'Carlos Souza', 'carlos@email.com', '45678912301', 'QR-' || gen_random_uuid(), 'active', 200.00);

-- Atualizar quantity_sold manualmente (o trigger já faz, mas como inserimos direto em tickets...)
UPDATE public.ticket_types SET quantity_sold = 2 WHERE id = v_tt1_id;
UPDATE public.ticket_types SET quantity_sold = 1 WHERE id = v_tt2_id;
UPDATE public.ticket_types SET quantity_sold = 1 WHERE id = v_tt3_id;

-- ============================================================
-- 5. COUPONS
-- ============================================================
INSERT INTO public.coupons (event_id, code, type, value, max_uses, used_count, valid_from, valid_until, is_active)
VALUES
  (v_event1_id, 'VERAO25', 'percentage', 25.00, 100, 5, NOW(), '2025-12-20 23:59:59+00', true),
  (v_event2_id, 'TECH10', 'fixed', 10.00, 50, 2, NOW(), '2025-11-15 23:59:59+00', true);

-- ============================================================
-- 6. CUSTOMERS (CRM)
-- ============================================================
INSERT INTO public.customers (event_id, user_id, email, name, phone, tags, notes, total_spent, events_attended)
VALUES
  (v_event1_id, v_customer_id, 'joao@email.com', 'João Silva', '11999999999', ARRAY['VIP', 'recorrente'], 'Cliente desde 2024', 258.50, 3),
  (v_event1_id, NULL, 'ana@email.com', 'Ana Paula', '11966666666', ARRAY['primeira_compra'], 'Interessada em eventos de música', 50.00, 1),
  (v_event2_id, v_customer_id, 'carlos@email.com', 'Carlos Souza', '11977777777', ARRAY['tech', 'workshop'], 'Participou de 2 workshops', 280.00, 2);

-- ============================================================
-- 7. TASKS
-- ============================================================
INSERT INTO public.tasks (event_id, title, description, assignee_id, status, priority, due_date)
VALUES
  (v_event1_id, 'Confirmar som e iluminação', 'Ligar para a empresa de som e confirmar equipamentos', v_producer_id, 'in_progress', 'high', '2025-12-15 18:00:00+00'),
  (v_event1_id, 'Imprimir pulseiras de acesso', 'Enviar arte para gráfica', v_producer_id, 'todo', 'medium', '2025-12-18 12:00:00+00'),
  (v_event2_id, 'Confirmar palestrantes', 'Enviar e-mail de confirmação para todos os palestrantes', v_producer_id, 'done', 'high', '2025-11-01 10:00:00+00');

-- ============================================================
-- 8. AFFILIATES
-- ============================================================
INSERT INTO public.affiliates (event_id, user_id, name, email, code, commission_rate, total_sales, total_earnings, clicks, conversions, is_active)
VALUES
  (v_event1_id, NULL, 'Pedro Afiliado', 'pedro@afiliado.com', 'PEDRO10', 10.00, 500.00, 50.00, 120, 5, true),
  (v_event1_id, NULL, 'Blog da Cidade', 'contato@blogdacidade.com', 'BLOG20', 15.00, 800.00, 120.00, 350, 8, true),
  (v_event2_id, NULL, 'Canal Tech', 'parceria@canaltech.com', 'TECH15', 12.00, 1200.00, 144.00, 500, 12, true);

-- ============================================================
-- 9. COMMUNICATIONS
-- ============================================================
INSERT INTO public.communications (event_id, type, segment, subject, content, sent_count, open_count, sent_at)
VALUES
  (v_event1_id, 'email', 'todos', 'Ingressos à venda!', 'Os ingressos para o Festival de Verão 2025 já estão à venda. Garanta o seu!', 450, 180, NOW() - INTERVAL '2 days'),
  (v_event1_id, 'email', 'compradores', 'Seu ingresso está confirmado!', 'Obrigado pela compra! Seu ingresso para o Festival de Verão está confirmado.', 120, 95, NOW() - INTERVAL '1 day'),
  (v_event2_id, 'push', 'interessados', 'Early bird acabando!', 'O preço early bird da Conferência Tech termina em 24h.', 300, 120, NOW() - INTERVAL '3 days');

-- ============================================================
-- 10. CERTIFICATE TEMPLATES
-- ============================================================
INSERT INTO public.certificate_templates (producer_id, name, config)
VALUES
  (v_producer_id, 'Padrão Evokaa', '{"background": "#1a1a2e", "textColor": "#ffffff", "logoPosition": "top-center"}'),
  (v_producer_id, 'Moderno Tech', '{"background": "#0f0f0f", "textColor": "#00ff88", "logoPosition": "bottom-right"}');

-- ============================================================
-- 11. PRODUCER BALANCES
-- ============================================================
INSERT INTO public.producer_balances (producer_id, total_earnings, total_withdrawn, available_balance, pending_balance)
VALUES
  (v_producer_id, 12500.00, 5000.00, 6500.00, 1000.00);

-- ============================================================
-- 12. REFRESH MATERIALIZED VIEW
-- ============================================================
REFRESH MATERIALIZED VIEW public.event_summary;

END $$;
