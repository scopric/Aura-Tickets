-- RLS de public.orders (policies em 00000000000000_init_schema.sql e 00000000000005_full_schema.sql):
-- cada comprador vê e cria só os próprios pedidos; ninguém comum altera pedido de outro.
begin;
select plan(7);

-- 0) toda tabela do schema public precisa ter RLS ligada
select tests.rls_enabled('public');

-- 1) usuários de teste (o trigger on_auth_user_created cria a linha em public.profiles)
select tests.create_supabase_user('produtor@test.com');
select tests.create_supabase_user('user1@test.com');
select tests.create_supabase_user('user2@test.com');

-- 2) dados, ainda como postgres (sem RLS): um evento de um terceiro e 3 pedidos
insert into public.events (id, producer_id, title, slug)
values ('00000000-0000-0000-0000-0000000000e1', tests.get_supabase_uid('produtor@test.com'),
        'Evento de teste RLS', 'evento-teste-rls');

insert into public.orders (user_id, event_id) values
  (tests.get_supabase_uid('user1@test.com'), '00000000-0000-0000-0000-0000000000e1'),
  (tests.get_supabase_uid('user1@test.com'), '00000000-0000-0000-0000-0000000000e1'),
  (tests.get_supabase_uid('user2@test.com'), '00000000-0000-0000-0000-0000000000e1');

-- 3) user1: vê só os 2 pedidos dele e consegue criar o próprio
select tests.authenticate_as('user1@test.com');
select results_eq('select count(*) from public.orders', ARRAY[2::bigint],
  'user1 vê só os próprios 2 pedidos');
select lives_ok(
  $$insert into public.orders (user_id, event_id)
    values (tests.get_supabase_uid('user1@test.com'), '00000000-0000-0000-0000-0000000000e1')$$,
  'user1 cria pedido em nome próprio');

-- 4) user2: vê só o 1 pedido dele, não cria pedido em nome de user1 nem altera os dele
select tests.authenticate_as('user2@test.com');
select results_eq('select count(*) from public.orders', ARRAY[1::bigint],
  'user2 vê só o próprio pedido');
select throws_ok(
  $$insert into public.orders (user_id, event_id)
    values (tests.get_supabase_uid('user1@test.com'), '00000000-0000-0000-0000-0000000000e1')$$,
  '42501', 'new row violates row-level security policy for table "orders"',
  'user2 não cria pedido em nome de user1');
select results_ne(
  $$ update public.orders set total = 0.01 where user_id = tests.get_supabase_uid('user1@test.com') returning 1 $$,
  $$ values(1) $$,
  'user2 não altera pedidos de user1');

-- 5) anônimo não vê pedido nenhum
select tests.clear_authentication();
select results_eq('select count(*) from public.orders', ARRAY[0::bigint],
  'anon não vê pedidos');

select * from finish();
rollback;
