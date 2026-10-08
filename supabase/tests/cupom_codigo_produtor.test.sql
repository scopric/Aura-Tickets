-- pgTAP de docs/sql/20261031d_cupom_codigo_por_produtor.sql. Só no banco local descartável: aplicar o SQL e rodar `supabase test db`. Tudo em begin ... rollback. Nunca contra produção.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(13);

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('fd000000-0000-4000-8000-000000000001', 'cupom1@teste-cupom.local', now(), '{}'::jsonb),
  ('fd000000-0000-4000-8000-000000000002', 'cupom2@teste-cupom.local', now(), '{}'::jsonb);

-- cupom de produtor: mesmo código em produtores diferentes passa; repetido no mesmo produtor (mesmo em minúscula) não
insert into public.coupons (code, discount_type, discount_value, producer_id) values ('PROMO10', 'percent', 10, 'fd000000-0000-4000-8000-000000000001');
select lives_ok($$insert into public.coupons (code, discount_type, discount_value, producer_id) values ('PROMO10', 'percent', 10, 'fd000000-0000-4000-8000-000000000002')$$,
  'o mesmo código em outro produtor é aceito');
select throws_ok($$insert into public.coupons (code, discount_type, discount_value, producer_id) values ('promo10', 'percent', 10, 'fd000000-0000-4000-8000-000000000001')$$,
  '23505', null, 'repetido no mesmo produtor (caixa diferente) é recusado');

-- cupom da plataforma (producer_id nulo): único entre eles, mas convive com o mesmo código de um produtor
insert into public.coupons (code, discount_type, discount_value, plans, duration) values ('PLANO10', 'percent', 10, array['pro']::text[], 1);
select throws_ok($$insert into public.coupons (code, discount_type, discount_value, plans, duration) values ('plano10', 'percent', 10, array['pro']::text[], 1)$$,
  '23505', null, 'cupom da plataforma repetido é recusado');
select lives_ok($$insert into public.coupons (code, discount_type, discount_value, producer_id) values ('PLANO10', 'percent', 10, 'fd000000-0000-4000-8000-000000000001')$$,
  'a plataforma e um produtor podem ter o mesmo código');

-- formato: vale quando o código nasce ou muda
select throws_ok($$insert into public.coupons (code, discount_type, discount_value, producer_id) values ('=SOMA(A1)', 'percent', 10, 'fd000000-0000-4000-8000-000000000001')$$,
  '23514', null, 'código com caractere de fórmula é recusado');
select throws_ok($$insert into public.coupons (code, discount_type, discount_value, producer_id) values ('A', 'percent', 10, 'fd000000-0000-4000-8000-000000000001')$$,
  '23514', null, 'código de 1 caractere é recusado');
select throws_ok($$insert into public.coupons (code, discount_type, discount_value, producer_id) values (repeat('A', 31), 'percent', 10, 'fd000000-0000-4000-8000-000000000001')$$,
  '23514', null, 'código com mais de 30 caracteres é recusado');
select throws_ok($$update public.coupons set code = 'COM ESPACO' where code = 'PROMO10' and producer_id = 'fd000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'mudar o código para um formato inválido é recusado');

-- cupom antigo fora do formato (simulado desligando o gatilho só para criá-lo) continua podendo ser desativado
alter table public.coupons disable trigger gf_cupom_regras;
insert into public.coupons (code, discount_type, discount_value, producer_id) values ('antigo ruim!', 'percent', 5, 'fd000000-0000-4000-8000-000000000002');
alter table public.coupons enable trigger gf_cupom_regras;
select lives_ok($$update public.coupons set is_active = false where code = 'antigo ruim!'$$, 'cupom antigo fora do formato ainda pode ser desativado');

-- teto: com 5000 cupons do produtor, o próximo insert é recusado
alter table public.coupons disable trigger gf_cupom_regras;
insert into public.coupons (code, discount_type, discount_value, producer_id)
  select 'T' || n, 'percent', 1, 'fd000000-0000-4000-8000-000000000002' from generate_series(1, 5000) n;
alter table public.coupons enable trigger gf_cupom_regras;
select throws_ok($$insert into public.coupons (code, discount_type, discount_value, producer_id) values ('MAIS1', 'percent', 1, 'fd000000-0000-4000-8000-000000000002')$$,
  '23514', null, 'o teto de 5000 cupons por produtor vale');

-- estrutura antiga fora, nova no lugar
select is((select count(*)::int from pg_constraint where conrelid = 'public.coupons'::regclass and conname = 'coupons_code_key'), 0, 'UNIQUE(code) global saiu');
select ok(to_regclass('public.coupons_produtor_code_idx') is not null and to_regclass('public.coupons_code_upper_idx') is null, 'índice por produtor existe e o global saiu');

select * from finish();
rollback;
