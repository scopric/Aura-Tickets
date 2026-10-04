-- =============================================================================
-- F1-a — TESTES de 20261009_f1a_tipo_evento.sql (o código fica lá; este arquivo não vai para produção).
-- Rodar só em banco descartável, DEPOIS de aplicar o arquivo de código. Um bloco begin … rollback.
-- Cada teste termina com "NOTICE: Tn OK"; falha = ERROR com o valor recebido.
-- Ambiente usado (04/10/2026): contêiner supabase/postgres:17.6.1.171 com o baseline de
-- supabase/migrations/20260930134600_baseline.sql; stubs fora do repositório: auth.jwt() lendo
-- request.jwt.claims, auth.mfa_factors, storage.buckets/objects; gf_is_admin e gf_admin_can copiadas de produção
-- (Decisão 99, com aal2 e fator verificado). gf_protect_event_moderation do baseline = a de produção
-- (md5 46d4fede…). Código aplicado duas vezes antes dos testes.
-- =============================================================================
begin;

create function pg_temp.como(p uuid, aal text default 'aal1') returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), true);
  perform set_config('request.jwt.claims', case when p is null then '' else json_build_object('sub', p, 'role', 'authenticated', 'aal', aal)::text end, true);
  perform set_config('role', case when p is null then 'postgres' else 'authenticated' end, true);
end $f$;
create function pg_temp.anon() returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end $f$;
create function pg_temp.erro(q text) returns text language plpgsql as $f$
begin execute q; return 'ok'; exception when others then return sqlstate; end $f$;
create function pg_temp.u(n int) returns uuid language sql as $f$ select ('f1000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $f$;
create function pg_temp.status(ev int) returns text language sql as $f$
  select approval_status from public.events where id = pg_temp.u(ev) $f$;
create function pg_temp.aprova(ev int) returns void language sql as $f$
  update public.events set approval_status = 'approved', approved_at = now() where id = pg_temp.u(ev) $f$;
grant execute on all functions in schema pg_temp to anon, authenticated;

-- Contas: 1 produtor, 2 outro usuário, 3 comprador ativo, 4 comprador reembolsado, 9 admin (manage_events, 2FA)
insert into auth.users (id, email) select pg_temp.u(n), 'f1-' || n || '@teste.invalid' from generate_series(1, 9) n;
insert into public.profiles (id, email, role) select pg_temp.u(n), 'f1-' || n || '@teste.invalid', 'user' from generate_series(1, 9) n
on conflict (id) do nothing;
update public.profiles set role = 'admin', admin_permissions = array['manage_events'] where id = pg_temp.u(9);
insert into auth.mfa_factors (user_id, status) values (pg_temp.u(9), 'verified');
-- Eventos do produtor: 10 (sem venda), 11 (com venda: ingressos de 3 e 4), 12 (para apagar), 13 (sem link)
insert into public.events (id, producer_id, title, slug, status, approval_status)
select pg_temp.u(n), pg_temp.u(1), 'Evento ' || n, 'f1-evento-' || n, 'published', 'pending' from unnest(array[10, 11, 12, 13]) n;
insert into public.ticket_types (id, event_id, name, price, quantity_total) values (pg_temp.u(20), pg_temp.u(11), 'Pista', 50, 100);
insert into public.orders (id, user_id, event_id, status, total) values
  (pg_temp.u(30), pg_temp.u(3), pg_temp.u(11), 'paid', 50), (pg_temp.u(31), pg_temp.u(4), pg_temp.u(11), 'paid', 50);
insert into public.tickets (order_id, ticket_type_id, event_id, user_id, buyer_name, buyer_email, status) values
  (pg_temp.u(30), pg_temp.u(20), pg_temp.u(11), pg_temp.u(3), 'Comprador', 'c3@teste.invalid', 'active'),
  (pg_temp.u(31), pg_temp.u(20), pg_temp.u(11), pg_temp.u(4), 'Reembolsado', 'c4@teste.invalid', 'refunded');
insert into public.evento_privado (event_id, online_url) values (pg_temp.u(11), 'https://exemplo.invalid/sala');

do $$
declare r text; n int;
begin
  -- T1: CHECKs de events (como postgres; a CHECK vale para todos)
  r := pg_temp.erro($q$update public.events set temas = array['musica','negocios','moda','educacao'] where id = 'f1000000-0000-4000-8000-000000000010'$q$);
  if r <> '23514' then raise exception 'T1a 4 temas: %', r; end if;
  r := pg_temp.erro($q$update public.events set temas = array['xadrez'] where id = 'f1000000-0000-4000-8000-000000000010'$q$);
  if r <> '23514' then raise exception 'T1b tema fora da lista: %', r; end if;
  r := pg_temp.erro($q$update public.events set temas = array['negocios'], estilos = array['forro'] where id = 'f1000000-0000-4000-8000-000000000010'$q$);
  if r <> '23514' then raise exception 'T1c estilo sem música: %', r; end if;
  r := pg_temp.erro($q$update public.events set temas = array['musica'], estilos = array['pagode_samba'] where id = 'f1000000-0000-4000-8000-000000000010'$q$);
  if r <> '23514' then raise exception 'T1d estilo fora da lista: %', r; end if;
  r := pg_temp.erro($q$update public.events set classificacao = 'L' where id = 'f1000000-0000-4000-8000-000000000010'$q$);
  if r <> '23514' then raise exception 'T1e classificação fora da lista: %', r; end if;
  r := pg_temp.erro($q$update public.events set local_modo = 'remoto' where id = 'f1000000-0000-4000-8000-000000000010'$q$);
  if r <> '23514' then raise exception 'T1f local_modo fora da lista: %', r; end if;
  r := pg_temp.erro($q$update public.events set tags = array['1','2','3','4','5','6','7','8','9','10','11'] where id = 'f1000000-0000-4000-8000-000000000010'$q$);
  if r <> '23514' then raise exception 'T1g 11 etiquetas: %', r; end if;
  r := pg_temp.erro($q$update public.events set temas = array['musica','ar_livre'], estilos = array['forro','samba_pagode','outro'],
                          classificacao = 'A16', local_modo = 'hibrido', tags = array['1','2','3','4','5','6','7','8','9','10']
                       where id = 'f1000000-0000-4000-8000-000000000010'$q$);
  if r <> 'ok' then raise exception 'T1h combinação válida: %', r; end if;
  r := pg_temp.erro($q$insert into public.evento_privado (event_id, online_url) values ('f1000000-0000-4000-8000-000000000012', 'http://inseguro.invalid')$q$);
  if r <> '23514' then raise exception 'T1i link sem https: %', r; end if;
  r := pg_temp.erro($q$insert into public.evento_privado (event_id, online_url) values ('f1000000-0000-4000-8000-000000000012', 'https://' || repeat('a', 500))$q$);
  if r <> '23514' then raise exception 'T1j link com mais de 500: %', r; end if;
  raise notice 'T1 OK';

  -- T2: leitura de evento_privado
  perform pg_temp.anon();
  r := pg_temp.erro('select * from public.evento_privado');
  if r <> '42501' then raise exception 'T2a anônimo lê: %', r; end if;
  perform pg_temp.como(pg_temp.u(2));
  select count(*) into n from public.evento_privado;
  if n <> 0 then raise exception 'T2b outro usuário vê % linhas', n; end if;
  perform pg_temp.como(pg_temp.u(3));
  select count(*) into n from public.evento_privado;
  if n <> 1 then raise exception 'T2c comprador ativo vê % linhas', n; end if;
  perform pg_temp.como(pg_temp.u(4));
  select count(*) into n from public.evento_privado;
  if n <> 0 then raise exception 'T2d comprador reembolsado vê % linhas', n; end if;
  perform pg_temp.como(pg_temp.u(1));
  select count(*) into n from public.evento_privado;
  if n <> 1 then raise exception 'T2e dono vê % linhas', n; end if;
  perform pg_temp.como(pg_temp.u(9), 'aal2');
  select count(*) into n from public.evento_privado;
  if n <> 1 then raise exception 'T2f admin vê % linhas', n; end if;
  perform pg_temp.como(pg_temp.u(9), 'aal1');
  select count(*) into n from public.evento_privado;
  if n <> 0 then raise exception 'T2g admin sem aal2 vê % linhas', n; end if;
  perform pg_temp.como(null);
  raise notice 'T2 OK';

  -- T3: escrita de evento_privado só pelo dono e pelo admin
  perform pg_temp.como(pg_temp.u(2));
  r := pg_temp.erro($q$insert into public.evento_privado (event_id, online_url) values ('f1000000-0000-4000-8000-000000000010', 'https://x.invalid')$q$);
  if r <> '42501' then raise exception 'T3a outro usuário grava: %', r; end if;
  perform pg_temp.como(pg_temp.u(3));
  update public.evento_privado set online_url = 'https://roubado.invalid' where event_id = pg_temp.u(11);
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'T3b comprador trocou o link'; end if;
  perform pg_temp.como(null);
  raise notice 'T3 OK';

  -- T4: link posto, mudado e apagado em evento aprovado volta para análise, sem 42501 para o produtor
  perform pg_temp.aprova(10);
  perform pg_temp.como(pg_temp.u(1));
  r := pg_temp.erro($q$insert into public.evento_privado (event_id, online_url) values ('f1000000-0000-4000-8000-000000000010', 'https://sala.invalid/1')$q$);
  perform pg_temp.como(null);
  if r <> 'ok' or pg_temp.status(10) <> 'pending' then raise exception 'T4a link posto: % / %', r, pg_temp.status(10); end if;
  perform pg_temp.aprova(10);
  perform pg_temp.como(pg_temp.u(1));
  update public.evento_privado set online_url = 'https://sala.invalid/1' where event_id = pg_temp.u(10);
  perform pg_temp.como(null);
  if pg_temp.status(10) <> 'approved' then raise exception 'T4b mesmo link mandou para análise'; end if;
  perform pg_temp.como(pg_temp.u(1));
  r := pg_temp.erro($q$update public.evento_privado set online_url = 'https://sala.invalid/2' where event_id = 'f1000000-0000-4000-8000-000000000010'$q$);
  perform pg_temp.como(null);
  if r <> 'ok' or pg_temp.status(10) <> 'pending' then raise exception 'T4c link mudado: % / %', r, pg_temp.status(10); end if;
  perform pg_temp.aprova(10);
  perform pg_temp.como(pg_temp.u(1));
  r := pg_temp.erro($q$delete from public.evento_privado where event_id = 'f1000000-0000-4000-8000-000000000010'$q$);
  perform pg_temp.como(null);
  if r <> 'ok' or pg_temp.status(10) <> 'pending' then raise exception 'T4d link apagado: % / %', r, pg_temp.status(10); end if;
  -- admin muda o link: não volta para análise
  perform pg_temp.aprova(10);
  perform pg_temp.como(pg_temp.u(9), 'aal2');
  r := pg_temp.erro($q$insert into public.evento_privado (event_id, online_url) values ('f1000000-0000-4000-8000-000000000010', 'https://sala.invalid/3')$q$);
  perform pg_temp.como(null);
  if r <> 'ok' or pg_temp.status(10) <> 'approved' then raise exception 'T4e admin: % / %', r, pg_temp.status(10); end if;
  raise notice 'T4 OK';

  -- T5: tema, estilo e classificação mudados em evento aprovado voltam para análise
  perform pg_temp.como(pg_temp.u(1));
  update public.events set temas = array['musica','moda'] where id = pg_temp.u(10);
  perform pg_temp.como(null);
  if pg_temp.status(10) <> 'pending' then raise exception 'T5a tema: %', pg_temp.status(10); end if;
  perform pg_temp.aprova(10);
  perform pg_temp.como(pg_temp.u(1));
  update public.events set classificacao = 'A18' where id = pg_temp.u(10);
  perform pg_temp.como(null);
  if pg_temp.status(10) <> 'pending' then raise exception 'T5b classificação: %', pg_temp.status(10); end if;
  raise notice 'T5 OK';

  -- T6: local_modo mudado com venda é recusado (42501); sem venda, passa
  perform pg_temp.como(pg_temp.u(1));
  r := pg_temp.erro($q$update public.events set local_modo = 'online' where id = 'f1000000-0000-4000-8000-000000000011'$q$);
  if r <> '42501' then raise exception 'T6a local_modo com venda: %', r; end if;
  r := pg_temp.erro($q$update public.events set local_modo = 'a_definir' where id = 'f1000000-0000-4000-8000-000000000010'$q$);
  if r <> 'ok' then raise exception 'T6b local_modo sem venda: %', r; end if;
  -- link de evento com venda pode mudar (não é data nem local)
  r := pg_temp.erro($q$update public.evento_privado set online_url = 'https://nova.invalid' where event_id = 'f1000000-0000-4000-8000-000000000011'$q$);
  if r <> 'ok' then raise exception 'T6c link com venda: %', r; end if;
  perform pg_temp.como(null);
  raise notice 'T6 OK';

  -- T7: evento_aceites só pela chave de serviço; dono lê o próprio, outro não
  perform pg_temp.como(pg_temp.u(1));
  r := pg_temp.erro($q$insert into public.evento_aceites (event_id, producer_id, versao, texto_hash, tem_bebida)
                       values ('f1000000-0000-4000-8000-000000000010', 'f1000000-0000-4000-8000-000000000001', 'v', repeat('a', 64), false)$q$);
  if r <> '42501' then raise exception 'T7a produtor grava aceite: %', r; end if;
  perform pg_temp.como(null);
  perform set_config('role', 'service_role', true);
  insert into public.evento_aceites (event_id, producer_id, versao, texto_hash, classificacao, tem_bebida, ip)
  values (pg_temp.u(10), pg_temp.u(1), public.aceite_evento_versao(), repeat('a', 64), 'A18', true, '203.0.113.7');
  perform set_config('role', 'postgres', true);
  perform pg_temp.como(pg_temp.u(1));
  select count(*) into n from public.evento_aceites;
  if n <> 1 then raise exception 'T7b dono vê % aceites', n; end if;
  r := pg_temp.erro('update public.evento_aceites set tem_bebida = false');
  if r <> '42501' then raise exception 'T7c dono altera aceite: %', r; end if;
  r := pg_temp.erro('delete from public.evento_aceites');
  if r <> '42501' then raise exception 'T7d dono apaga aceite: %', r; end if;
  perform pg_temp.como(pg_temp.u(2));
  select count(*) into n from public.evento_aceites;
  if n <> 0 then raise exception 'T7e outro usuário vê % aceites', n; end if;
  perform pg_temp.como(null);
  if (select aceito_em from public.evento_aceites where event_id = pg_temp.u(10)) <> now() then
    raise exception 'T7f aceito_em não é a hora do banco';
  end if;
  raise notice 'T7 OK';

  -- T8: apagar evento com link (sem venda) não falha; o link vai junto
  perform pg_temp.como(pg_temp.u(1));
  insert into public.evento_privado (event_id, online_url) values (pg_temp.u(12), 'https://apagar.invalid');
  r := pg_temp.erro($q$delete from public.events where id = 'f1000000-0000-4000-8000-000000000012'$q$);
  perform pg_temp.como(null);
  if r <> 'ok' or exists (select 1 from public.evento_privado where event_id = pg_temp.u(12)) then
    raise exception 'T8 apagar evento com link: %', r;
  end if;
  raise notice 'T8 OK';

  -- T9: bebida por ingresso: padrão falso, o dono marca
  if (select inclui_bebida from public.ticket_types where id = pg_temp.u(20)) then raise exception 'T9a padrão'; end if;
  perform pg_temp.como(pg_temp.u(1));
  r := pg_temp.erro($q$update public.ticket_types set inclui_bebida = true where id = 'f1000000-0000-4000-8000-000000000020'$q$);
  perform pg_temp.como(null);
  if r <> 'ok' or not (select inclui_bebida from public.ticket_types where id = pg_temp.u(20)) then
    raise exception 'T9b dono marca bebida: %', r;
  end if;
  raise notice 'T9 OK';

  -- T10: versão do aceite: authenticated executa, anon não
  perform pg_temp.como(pg_temp.u(1));
  r := pg_temp.erro('select public.aceite_evento_versao()');
  if r <> 'ok' then raise exception 'T10a authenticated: %', r; end if;
  perform pg_temp.anon();
  r := pg_temp.erro('select public.aceite_evento_versao()');
  if r <> '42501' then raise exception 'T10b anon: %', r; end if;
  perform pg_temp.como(null);
  raise notice 'T10 OK';

  -- T11: o link não muda de evento (levaria o link de um rascunho a um evento aprovado sem análise)
  perform pg_temp.como(pg_temp.u(1));
  r := pg_temp.erro($q$update public.evento_privado set event_id = 'f1000000-0000-4000-8000-000000000013'
                       where event_id = 'f1000000-0000-4000-8000-000000000011'$q$);
  if r <> '42501' then raise exception 'T11a troca de evento: %', r; end if;
  -- upsert do PostgREST (on conflict … set event_id = excluded.event_id) continua funcionando
  r := pg_temp.erro($q$insert into public.evento_privado (event_id, online_url) values ('f1000000-0000-4000-8000-000000000011', 'https://upsert.invalid')
                       on conflict (event_id) do update set event_id = excluded.event_id, online_url = excluded.online_url$q$);
  if r <> 'ok' then raise exception 'T11b upsert: %', r; end if;
  perform pg_temp.como(null);
  raise notice 'T11 OK';

  -- T12: nem a service_role altera ou apaga aceite
  perform set_config('role', 'service_role', true);
  r := pg_temp.erro('update public.evento_aceites set tem_bebida = false');
  if r <> '42501' then raise exception 'T12a service_role altera: %', r; end if;
  r := pg_temp.erro('delete from public.evento_aceites');
  if r <> '42501' then raise exception 'T12b service_role apaga: %', r; end if;
  perform set_config('role', 'postgres', true);
  raise notice 'T12 OK';

  -- T13: start_date alinhado com date + time (bloco 1b); salvar o mesmo date/time não muda nada
  if exists (select 1 from public.events where date is not null
             and start_date is distinct from (date + coalesce(time, time '00:00')) at time zone 'America/Sao_Paulo') then
    raise exception 'T13a start_date divergente depois do SQL';
  end if;
  raise notice 'T13 OK';
end $$;

rollback;
