-- =============================================================================
-- Trava de aceite — TESTES de 20261024_trava_aceite_publicar.sql (o código fica lá; este arquivo não vai para produção).
-- Rodar só em banco descartável, DEPOIS de aplicar o arquivo de código. Um bloco begin … rollback.
-- Cada teste termina com "NOTICE: Tn OK"; falha = ERROR com o valor recebido. Mesmos papéis/jwt simulados de 20261012_f1b_reenvio_testes.sql.
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
create function pg_temp.u(n int) returns uuid language sql as $f$ select ('a2000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $f$;
grant execute on all functions in schema pg_temp to anon, authenticated;

insert into auth.users (id, email) select pg_temp.u(n), 'ace-' || n || '@teste.invalid' from unnest(array[1]) n;
insert into public.profiles (id, email, role) select pg_temp.u(n), 'ace-' || n || '@teste.invalid', 'user' from unnest(array[1]) n
on conflict (id) do nothing;

-- 60 rascunho A16 sem aceite | 61 rascunho A16 com aceite de versão antiga | 62 rascunho A16 com aceite de A12
-- 63 rascunho A16 com aceite correto | 64 publicado e aprovado (só edição) | 65 rascunho A16 com aceite sem bebida e ingresso com bebida
insert into public.events (id, producer_id, title, slug, status, approval_status, category, classificacao, approved_at)
values
  (pg_temp.u(60), pg_temp.u(1), 'Evento 60', 'ace-60', 'draft', 'pending', 'festa_encontro', 'A16', null),
  (pg_temp.u(61), pg_temp.u(1), 'Evento 61', 'ace-61', 'draft', 'pending', 'festa_encontro', 'A16', null),
  (pg_temp.u(62), pg_temp.u(1), 'Evento 62', 'ace-62', 'draft', 'pending', 'festa_encontro', 'A16', null),
  (pg_temp.u(63), pg_temp.u(1), 'Evento 63', 'ace-63', 'draft', 'pending', 'festa_encontro', 'A16', null),
  (pg_temp.u(64), pg_temp.u(1), 'Evento 64', 'ace-64', 'published', 'approved', 'festa_encontro', 'A16', now()),
  (pg_temp.u(65), pg_temp.u(1), 'Evento 65', 'ace-65', 'draft', 'pending', 'festa_encontro', 'A16', null);
insert into public.ticket_types (id, event_id, name, price, quantity_total, inclui_bebida)
values (pg_temp.u(70), pg_temp.u(65), 'Open bar', 50, 10, true);

create function pg_temp.aceite(ev int, ver text, cl text, beb boolean) returns void language sql as $f$
  insert into public.evento_aceites (event_id, producer_id, versao, texto, texto_hash, classificacao, tem_bebida)
  values (pg_temp.u(ev), pg_temp.u(1), ver, 'texto', repeat('a', 64), cl, beb) $f$;
select pg_temp.aceite(61, 'versao-antiga-inexistente', 'A16', false);
select pg_temp.aceite(62, public.aceite_evento_versao(), 'A12', false);
select pg_temp.aceite(63, public.aceite_evento_versao(), 'A16', false);
select pg_temp.aceite(65, public.aceite_evento_versao(), 'A16', false);

do $$
declare r text;
begin
  perform pg_temp.como(pg_temp.u(1));
  r := pg_temp.erro($q$update public.events set status = 'published' where id = 'a2000000-0000-4000-8000-000000000060'$q$);
  perform pg_temp.como(null);
  if r <> '42501' then raise exception 'T1 publicar sem aceite deve dar 42501: %', r; end if;
  raise notice 'T1 OK';

  perform pg_temp.como(pg_temp.u(1));
  r := pg_temp.erro($q$update public.events set status = 'published' where id = 'a2000000-0000-4000-8000-000000000061'$q$);
  perform pg_temp.como(null);
  if r <> '42501' then raise exception 'T2a aceite de versão antiga deve dar 42501: %', r; end if;
  perform pg_temp.como(pg_temp.u(1));
  r := pg_temp.erro($q$update public.events set status = 'published' where id = 'a2000000-0000-4000-8000-000000000062'$q$);
  perform pg_temp.como(null);
  if r <> '42501' then raise exception 'T2b aceite de outra classificação deve dar 42501: %', r; end if;
  perform pg_temp.como(pg_temp.u(1));
  r := pg_temp.erro($q$update public.events set status = 'published' where id = 'a2000000-0000-4000-8000-000000000065'$q$);
  perform pg_temp.como(null);
  if r <> '42501' then raise exception 'T2c aceite sem bebida com ingresso de bebida deve dar 42501: %', r; end if;
  raise notice 'T2 OK';

  perform pg_temp.como(pg_temp.u(1));
  r := pg_temp.erro($q$update public.events set status = 'published' where id = 'a2000000-0000-4000-8000-000000000063'$q$);
  perform pg_temp.como(null);
  if r <> 'ok' or (select status from public.events where id = pg_temp.u(63)) <> 'published' then raise exception 'T3 aceite correto deve passar: %', r; end if;
  raise notice 'T3 OK';

  perform pg_temp.como(pg_temp.u(1));
  r := pg_temp.erro($q$update public.events set title = 'Evento 64 novo' where id = 'a2000000-0000-4000-8000-000000000064'$q$);
  perform pg_temp.como(null);
  if r <> 'ok' then raise exception 'T4 editar evento já publicado (sem aceite) deve passar: %', r; end if;
  raise notice 'T4 OK';

  -- T5: INSERT já publicado pelo produtor cai
  perform pg_temp.como(pg_temp.u(1));
  r := pg_temp.erro($q$insert into public.events (id, producer_id, title, slug, status, approval_status) values ('a2000000-0000-4000-8000-000000000066', 'a2000000-0000-4000-8000-000000000001', 'E66', 'ace-66', 'published', 'pending')$q$);
  perform pg_temp.como(null);
  if r <> '42501' then raise exception 'T5 INSERT published deve dar 42501: %', r; end if;
  raise notice 'T5 OK';

  -- T6: service_role/postgres (sem papel authenticated) publica sem aceite
  r := pg_temp.erro($q$update public.events set status = 'published' where id = 'a2000000-0000-4000-8000-000000000060'$q$);
  if r <> 'ok' then raise exception 'T6 papel de serviço deve passar: %', r; end if;
  raise notice 'T6 OK';
end $$;

rollback;
