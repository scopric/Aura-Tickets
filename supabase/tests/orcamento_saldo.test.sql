-- pgTAP do B3b (docs/sql/20261006_orcamento_saldo_fechado.sql). Só no banco local: `supabase start`, aplicar
-- seg6, seg4, 20261005_produtor_acesso.sql e 20261006_orcamento_saldo_fechado.sql, e rodar `supabase test db`.
-- Tudo em begin ... rollback. pg_temp.como() troca papel e claims do JWT como o PostgREST (igual a
-- produtor_acesso.test.sql).
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(25);

create function pg_temp.como(p_role text, p uuid default null, p_aal text default 'aal1') returns void
language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', case when p_role = 'postgres' then '' else json_strip_nulls(json_build_object(
    'role', p_role, 'sub', p, 'aal', case when p is not null then p_aal end))::text end, true);
  perform set_config('role', p_role, true);
end $f$;
grant execute on function pg_temp.como(text, uuid, text) to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;

-- p1 e p2 produtores sem 2FA; p3 produtor com 2FA confirmado
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('b3b00000-0000-4000-8000-000000000001', 'orc1@teste.local', now(), '{"role":"producer"}'),
  ('b3b00000-0000-4000-8000-000000000002', 'orc2@teste.local', now(), '{"role":"producer"}'),
  ('b3b00000-0000-4000-8000-000000000003', 'orc3@teste.local', now(), '{"role":"producer"}');
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
values ('b3b00000-0000-4000-8000-0000000000f3', 'b3b00000-0000-4000-8000-000000000003', 'teste', 'totp', 'verified', now(), now());
insert into public.event_budget_boxes (id, producer_id, name, target) values
  ('b3b00000-0000-4000-8000-0000000000b3', 'b3b00000-0000-4000-8000-000000000003', 'Item P3', 100);

-- Estrutura
select ok((select prosecdef from pg_proc where oid = 'public.caixinha_movimentar(uuid, text, numeric, text)'::regprocedure),
  'caixinha_movimentar é SECURITY DEFINER');

-- Dono cria como a tela (saved: 0) e não cria já com saldo
select pg_temp.como('authenticated', 'b3b00000-0000-4000-8000-000000000001');
select lives_ok($$insert into event_budget_boxes (id, producer_id, name, target, saved, category, notes) values
  ('b3b00000-0000-4000-8000-0000000000b1', 'b3b00000-0000-4000-8000-000000000001', 'Som', 500, 0, 'Outros', null)$$,
  'dono cria item com saved 0 (como a tela)');
select throws_ok($$insert into event_budget_boxes (producer_id, name, target, saved) values
  ('b3b00000-0000-4000-8000-000000000001', 'Rico', 500, 100)$$, '42501', null, 'criar item já com saldo 100 é recusado');

-- Movimento pela função
select is(caixinha_movimentar('b3b00000-0000-4000-8000-0000000000b1', 'deposit', 100, 'entrada'), 100::numeric,
  'depósito de 100: saldo 100');
select is(caixinha_movimentar('b3b00000-0000-4000-8000-0000000000b1', 'withdraw', 30.004), 70::numeric,
  'estorno de 30,004 (arredonda para 30): saldo 70');
select results_eq($$select type, amount from piggy_transactions where box_id = 'b3b00000-0000-4000-8000-0000000000b1'
  order by type$$, $$values ('deposit'::text, 100::numeric), ('withdraw', 30.00)$$,
  'os 2 movimentos gravados e legíveis pelo dono');
select results_eq($$select saved from event_budget_boxes where id = 'b3b00000-0000-4000-8000-0000000000b1'$$,
  array[70::numeric], 'saldo 70 na tabela');
select throws_ok($$select caixinha_movimentar('b3b00000-0000-4000-8000-0000000000b1', 'withdraw', 100)$$,
  '23514', null, 'estorno maior que o saldo é recusado');
select throws_ok($$select caixinha_movimentar('b3b00000-0000-4000-8000-0000000000b1', 'deposit', 'NaN')$$,
  '22023', null, 'NaN é recusado');
select throws_ok($$select caixinha_movimentar('b3b00000-0000-4000-8000-0000000000b1', 'deposit', 'Infinity')$$,
  '22023', null, 'Infinity é recusado');
select throws_ok($$select caixinha_movimentar('b3b00000-0000-4000-8000-0000000000b1', 'roubo', 10)$$,
  '22023', null, 'tipo inválido é recusado');

-- Gravação direta fechada
select throws_ok($$update event_budget_boxes set saved = 1000000 where id = 'b3b00000-0000-4000-8000-0000000000b1'$$,
  '42501', null, 'dono não grava saved direto');
select throws_ok($$update event_budget_boxes set producer_id = 'b3b00000-0000-4000-8000-000000000002'
  where id = 'b3b00000-0000-4000-8000-0000000000b1'$$, '42501', null, 'dono não troca producer_id');
select throws_ok($$insert into piggy_transactions (box_id, type, amount) values
  ('b3b00000-0000-4000-8000-0000000000b1', 'deposit', 1000)$$, '42501', null, 'insert direto em piggy_transactions barrado');
select throws_ok($$update piggy_transactions set amount = 1 where box_id = 'b3b00000-0000-4000-8000-0000000000b1'$$,
  '42501', null, 'update direto em piggy_transactions barrado');
select throws_ok($$delete from piggy_transactions where box_id = 'b3b00000-0000-4000-8000-0000000000b1'$$,
  '42501', null, 'delete direto em piggy_transactions barrado');

-- Editar e renomear continua
select results_eq($$with u as (update event_budget_boxes set name = 'Som e luz', target = 800, category = 'Estrutura',
  notes = 'ok', updated_at = now() where id = 'b3b00000-0000-4000-8000-0000000000b1' returning name, target)
  select * from u$$, $$values ('Som e luz'::text, 800::numeric)$$, 'dono renomeia e muda a meta');
select results_eq($$select saved from event_budget_boxes where id = 'b3b00000-0000-4000-8000-0000000000b1'$$,
  array[70::numeric], 'editar não mexe no saldo (continua 70)');

-- Outro produtor
select pg_temp.como('authenticated', 'b3b00000-0000-4000-8000-000000000002');
select throws_ok($$select caixinha_movimentar('b3b00000-0000-4000-8000-0000000000b1', 'withdraw', 10)$$,
  '42501', null, 'outro produtor não movimenta o item de P1');
select results_eq($$select count(*) from piggy_transactions$$, array[0::bigint], 'outro produtor não lê os movimentos');

-- 2FA: com fator confirmado, só com aal2
select pg_temp.como('authenticated', 'b3b00000-0000-4000-8000-000000000003');
select throws_ok($$select caixinha_movimentar('b3b00000-0000-4000-8000-0000000000b3', 'deposit', 10)$$,
  '42501', 'Confirme o código do 2FA', 'produtor com 2FA sem o código (aal1): barrado');
select pg_temp.como('authenticated', 'b3b00000-0000-4000-8000-000000000003', 'aal2');
select is(caixinha_movimentar('b3b00000-0000-4000-8000-0000000000b3', 'deposit', 10), 10::numeric,
  'o mesmo produtor com aal2 movimenta');

-- Visitante
select pg_temp.como('anon');
select throws_ok($$select caixinha_movimentar('b3b00000-0000-4000-8000-0000000000b1', 'deposit', 10)$$,
  '42501', null, 'visitante não executa caixinha_movimentar');

-- Apagar o item continua (o cascade dos movimentos roda com o privilégio do dono da tabela)
select pg_temp.como('authenticated', 'b3b00000-0000-4000-8000-000000000001');
select results_eq($$with d as (delete from event_budget_boxes where id = 'b3b00000-0000-4000-8000-0000000000b1'
  returning 1) select count(*) from d$$, array[1::bigint], 'dono apaga o item');
select pg_temp.como('postgres');
select results_eq($$select count(*) from piggy_transactions where box_id = 'b3b00000-0000-4000-8000-0000000000b1'$$,
  array[0::bigint], 'os movimentos do item apagado foram junto (cascade)');

select * from finish();
rollback;
