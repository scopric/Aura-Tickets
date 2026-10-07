-- =============================================================================
-- TESTES de 20261027_ticket_types_grants_por_coluna.sql (o código fica lá; este arquivo não vai para produção).
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

insert into auth.users (id, email) select pg_temp.u(n), 'grn-' || n || '@teste.invalid' from unnest(array[1,2]) n;
insert into public.profiles (id, email, role) select pg_temp.u(n), 'grn-' || n || '@teste.invalid', 'user' from unnest(array[1,2]) n
on conflict (id) do nothing;
insert into public.events (id, producer_id, title, slug, status, approval_status, category, classificacao)
values (pg_temp.u(10), pg_temp.u(1), 'Evento G1', 'grn-10', 'draft', 'pending', 'festa_encontro', 'A16'),
       (pg_temp.u(11), pg_temp.u(2), 'Evento G2', 'grn-11', 'draft', 'pending', 'festa_encontro', 'A16');
insert into public.ticket_types (id, event_id, name, price, quantity_total, sold, quantity_sold)
values (pg_temp.u(20), pg_temp.u(10), 'Pista', 50, 100, 7, 7);

do $$
declare r text;
begin
  -- T1/T2: o produtor dono não zera o vendido
  perform pg_temp.como(pg_temp.u(1));
  r := pg_temp.erro($q$update public.ticket_types set sold = 0 where id = 'a3000000-0000-4000-8000-000000000020'$q$);
  perform pg_temp.como(null);
  if r <> '42501' then raise exception 'T1 zerar sold deve dar 42501: %', r; end if;
  perform pg_temp.como(pg_temp.u(1));
  r := pg_temp.erro($q$update public.ticket_types set quantity_sold = 0 where id = 'a3000000-0000-4000-8000-000000000020'$q$);
  perform pg_temp.como(null);
  if r <> '42501' then raise exception 'T2 zerar quantity_sold deve dar 42501: %', r; end if;
  raise notice 'T1/T2 OK';

  -- T3: não troca o tipo de evento
  perform pg_temp.como(pg_temp.u(1));
  r := pg_temp.erro($q$update public.ticket_types set event_id = 'a3000000-0000-4000-8000-000000000011' where id = 'a3000000-0000-4000-8000-000000000020'$q$);
  perform pg_temp.como(null);
  if r <> '42501' then raise exception 'T3 trocar event_id deve dar 42501: %', r; end if;
  raise notice 'T3 OK';

  -- T4: o que o painel edita continua passando (preço, nome, quantidade acima do vendido, ocultar, datas de venda)
  perform pg_temp.como(pg_temp.u(1));
  r := pg_temp.erro($q$update public.ticket_types set price = 60, name = 'Pista 2', quantity_total = 120, capacity = 120, is_active = false,
                        sale_start = now(), sale_end = now() + interval '1 day', inclui_bebida = false, description = 'x'
                      where id = 'a3000000-0000-4000-8000-000000000020'$q$);
  perform pg_temp.como(null);
  if r <> 'ok' then raise exception 'T4 edição normal deve passar: %', r; end if;
  raise notice 'T4 OK';

  -- T5: a trava de quantidade (20261025) continua valendo
  perform pg_temp.como(pg_temp.u(1));
  r := pg_temp.erro($q$update public.ticket_types set quantity_total = 3 where id = 'a3000000-0000-4000-8000-000000000020'$q$);
  perform pg_temp.como(null);
  if r <> '23514' then raise exception 'T5 baixar abaixo do vendido deve dar 23514: %', r; end if;
  raise notice 'T5 OK';

  -- T6: outro produtor continua sem acesso (a RLS não deixa nem ver a linha: 0 linhas, sem erro)
  perform pg_temp.como(pg_temp.u(2));
  r := pg_temp.erro($q$update public.ticket_types set price = 1 where id = 'a3000000-0000-4000-8000-000000000020'$q$);
  perform pg_temp.como(null);
  if (select price from public.ticket_types where id = pg_temp.u(20)) <> 60 then raise exception 'T6 outro produtor mexeu no preço'; end if;
  raise notice 'T6 OK (%)', r;

  -- T7: papel de serviço/postgres grava sold (é o que a função security definer do #217 faz como dono)
  r := pg_temp.erro($q$update public.ticket_types set sold = 8, quantity_sold = 8 where id = 'a3000000-0000-4000-8000-000000000020'$q$);
  if r <> 'ok' then raise exception 'T7 papel de serviço deve gravar sold: %', r; end if;
  raise notice 'T7 OK';
end $$;

rollback;
