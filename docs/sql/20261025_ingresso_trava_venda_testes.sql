-- =============================================================================
-- Trava de venda — TESTES de 20261025_ingresso_trava_venda.sql (este arquivo não vai para produção).
-- Rodar só em banco descartável, DEPOIS de aplicar o arquivo de código. Um bloco begin … rollback.
-- Cada teste termina com "NOTICE: Tn OK"; falha = ERROR com o valor recebido.
-- =============================================================================
begin;

create function pg_temp.como(p uuid, aal text default 'aal1') returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), true);
  perform set_config('request.jwt.claims', case when p is null then '' else json_build_object('sub', p, 'role', 'authenticated', 'aal', aal)::text end, true);
  perform set_config('role', case when p is null then 'postgres' else 'authenticated' end, true);
end $f$;
create function pg_temp.erro(q text) returns text language plpgsql as $f$
begin execute q; return 'ok'; exception when others then return sqlstate; end $f$;
create function pg_temp.u(n int) returns uuid language sql as $f$ select ('a3000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $f$;
grant execute on all functions in schema pg_temp to anon, authenticated;

-- Contas: 1 produtor, 9 admin (manage_events, 2FA)
insert into auth.users (id, email) select pg_temp.u(n), 'tv-' || n || '@teste.invalid' from unnest(array[1, 9]) n;
insert into public.profiles (id, email, role) select pg_temp.u(n), 'tv-' || n || '@teste.invalid', 'user' from unnest(array[1, 9]) n
on conflict (id) do nothing;
update public.profiles set role = 'admin', admin_permissions = array['manage_events'] where id = pg_temp.u(9);
insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at)
values (gen_random_uuid(), pg_temp.u(9), 'totp', 'verified', now(), now());

insert into public.events (id, producer_id, title, slug, status, approval_status, category, approved_at)
values (pg_temp.u(10), pg_temp.u(1), 'Evento 10', 'tv-10', 'published', 'approved', 'festa_encontro', now());
-- ingresso 20: 100 lugares, 5 tickets ativos + 1 cancelado, sold = 0 (conta pelos tickets); ingresso 21: sold = 30, sem tickets
insert into public.ticket_types (id, event_id, name, price, quantity_total, capacity, sold, quantity_sold)
values (pg_temp.u(20), pg_temp.u(10), 'Pista', 50, 100, 100, 0, 0),
       (pg_temp.u(21), pg_temp.u(10), 'Camarote', 90, 100, null, 30, 30);
insert into public.orders (id, user_id, event_id) values (pg_temp.u(30), pg_temp.u(1), pg_temp.u(10));
insert into public.tickets (order_id, ticket_type_id, event_id, user_id, buyer_name, buyer_email, status)
select pg_temp.u(30), pg_temp.u(20), pg_temp.u(10), pg_temp.u(1), 'Comprador', 'c@teste.invalid', case when n = 6 then 'cancelled' else 'active' end
from generate_series(1, 6) n;

do $$
declare r text; m text;
begin
  -- T1: produtor baixa abaixo do vendido (5 tickets) -> 23514 com a mensagem; igual ao vendido passa
  perform pg_temp.como(pg_temp.u(1));
  r := pg_temp.erro($q$update public.ticket_types set quantity_total = 4 where id = 'a3000000-0000-4000-8000-000000000020'$q$);
  begin
    update public.ticket_types set quantity_total = 4 where id = pg_temp.u(20);
  exception when others then m := sqlerrm; end;
  if r <> '23514' or m is distinct from 'Já foram vendidos 5: a quantidade não pode ser menor' then raise exception 'T1a: % / %', r, m; end if;
  r := pg_temp.erro($q$update public.ticket_types set quantity_total = 5 where id = 'a3000000-0000-4000-8000-000000000020'$q$);
  if r <> 'ok' then raise exception 'T1b igual ao vendido: %', r; end if;
  raise notice 'T1 OK';

  -- T2: baixar capacity (legado) abaixo do vendido por sold -> 23514
  r := pg_temp.erro($q$update public.ticket_types set quantity_total = 100, capacity = 29 where id = 'a3000000-0000-4000-8000-000000000021'$q$);
  if r <> '23514' then raise exception 'T2 capacity: %', r; end if;
  raise notice 'T2 OK';

  -- T3: aumentar passa
  r := pg_temp.erro($q$update public.ticket_types set quantity_total = 200 where id = 'a3000000-0000-4000-8000-000000000020'$q$);
  if r <> 'ok' then raise exception 'T3 aumentar: %', r; end if;
  raise notice 'T3 OK';

  -- T4: só sold (estoque) passa, mesmo acima da lotação nova; max_per_order passa
  r := pg_temp.erro($q$update public.ticket_types set sold = 150, quantity_sold = 150 where id = 'a3000000-0000-4000-8000-000000000021'$q$);
  if r <> 'ok' then raise exception 'T4a só sold: %', r; end if;
  r := pg_temp.erro($q$update public.ticket_types set max_per_order = 3 where id = 'a3000000-0000-4000-8000-000000000021'$q$);
  if r <> 'ok' then raise exception 'T4b max_per_order: %', r; end if;
  raise notice 'T4 OK';

  -- T5: admin passa; service_role (sem jwt de anon/authenticated) passa
  perform pg_temp.como(pg_temp.u(9), 'aal2');
  r := pg_temp.erro($q$update public.ticket_types set quantity_total = 1 where id = 'a3000000-0000-4000-8000-000000000020'$q$);
  if r <> 'ok' then raise exception 'T5a admin: %', r; end if;
  perform pg_temp.como(null);
  r := pg_temp.erro($q$update public.ticket_types set quantity_total = 1 where id = 'a3000000-0000-4000-8000-000000000021'$q$);
  if r <> 'ok' then raise exception 'T5b postgres/service: %', r; end if;
  raise notice 'T5 OK';
end $$;

rollback;
