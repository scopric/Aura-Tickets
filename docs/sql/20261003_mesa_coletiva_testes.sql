-- =============================================================================
-- Mesa Tinder — TESTES de 20261003_mesa_coletiva.sql (o código fica lá; este arquivo não vai para
-- produção). Rodar só em banco descartável, DEPOIS de aplicar o arquivo de código: são dois blocos,
-- cada um num begin … rollback (nada fica gravado), mas mexem em gatilhos e no cron dentro da
-- transação.
-- T0–T21: formação, perfil, consentimento, idade, grants (seg-6). E0–E30: escolha, troca, denúncia e triagem,
-- faixa de idade, rede social, moderação da foto, avisos, remoção e trava, numeração, conflitos
-- de interesse do moderador, moderação automática da foto (Fase E).
-- Contas de teste com ids fixos (b0000000-…); e-mails *.invalid. Cada teste termina com
-- "NOTICE: Tn OK" ou "NOTICE: En OK"; falha = ERROR com o valor recebido.
-- Rodado em 01/10/2026 (código aplicado duas vezes, depois do essencial do seg-6, #85; remoção só de quem tem denúncia no evento): T1–T21 e E1–E30 OK.
-- Stubs usados no Postgres descartável (supabase/postgres 17.6.1.171), fora do repositório:
-- profiles/events/ticket_types/tickets/user_profiles_ext/collective_tables/table_members com as
-- colunas, CHECKs, FKs, RLS e GRANTs de produção (compatibility_score numeric(3,1),
-- table_members.user_id NOT NULL, events.start_date NOT NULL DEFAULT now(), tickets.order_id
-- NOT NULL), auth.jwt(), auth.mfa_factors, orders/order_items, e gf_mfa_ok/gf_is_admin copiadas
-- de 20260930_2fa_no_banco.sql; team_members, profiles.admin_permissions/is_verified/
-- stripe_customer_id, gf_admin_can e o gatilho gf_protect_profile_privileges como no repositório; e os
-- alter default privileges e revoke de 20261001_seg6_menor_privilegio.sql (#85); pg_net, Vault, ai_settings
-- e ai_custo (20260929_agente_evo.sql).
-- Em produção, events e orders podem ter outras colunas obrigatórias: se o insert de pg_temp.ingresso,
-- do T0 ou do T16 falhar, complete-o.
-- As corridas entre duas sessões (trava mesa_conta; trava por evento em escolher_mesa) não cabem
-- num bloco de uma sessão só: a primeira foi testada à parte com duas sessões psql; da segunda, o
-- E25 confere a ordem das checagens no código.
-- =============================================================================
begin;
-- seg-6 (#85): função nova do postgres fora do schema public nasce só com EXECUTE do dono; os auxiliares
-- pg_temp.* também rodam como authenticated/anon, então ganham EXECUTE (só nesta transação)
create temp table seg6_marco ();
do $$ begin
  execute format('alter default privileges for role postgres in schema %s grant execute on functions to public',
                 pg_my_temp_schema()::regnamespace);
end $$;
-- p = usuário (null = postgres); aal = nível da sessão no JWT
create function pg_temp.como(p uuid, aal text default 'aal1') returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), true);
  perform set_config('request.jwt.claims', case when p is null then '' else json_build_object('sub', p, 'role', 'authenticated', 'aal', aal)::text end, true);
  perform set_config('role', case when p is null then 'postgres' else 'authenticated' end, true);
end $f$;
create function pg_temp.erro(q text) returns text language plpgsql as $f$
begin execute q; return 'ok'; exception when others then return sqlstate; end $f$;
create function pg_temp.u(n int) returns uuid language sql as $f$ select ('b0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $f$;
-- retrato das mesas de um evento (ids, nomes, status, nota e ingressos), para comparar antes/depois
create function pg_temp.retrato(ev uuid) returns text language sql as $f$
  select coalesce(string_agg(c.id || c.name || c.status || coalesce(c.compatibility_score::text, '-') || coalesce(m.ticket_id::text, '-'), ',' order by c.id, m.ticket_id), '')
  from public.collective_tables c left join public.table_members m on m.table_id = c.id where c.event_id = ev $f$;
-- tamanhos em ordem crescente (a numeração da 1ª formação sai do md5, não da ordem de afinidade)
create function pg_temp.tam(ev uuid) returns int[] language sql as $f$
  select array_agg(n order by n) from (select count(m.id)::int n from public.collective_tables c
  left join public.table_members m on m.table_id = c.id where c.event_id = ev group by c.id) s $f$;
-- a mesa maior do evento (desempate pelo número)
create function pg_temp.maior(ev uuid) returns uuid language sql as $f$
  select c.id from public.collective_tables c where c.event_id = ev
  order by (select count(*) from public.table_members m where m.table_id = c.id) desc, substring(c.name from '[0-9]+')::int limit 1 $f$;
create function pg_temp.tamanhos(ev uuid) returns int[] language sql as $f$
  select array_agg(n order by numero) from (select substring(c.name from '[0-9]+')::int numero, count(m.id)::int n from public.collective_tables c
  left join public.table_members m on m.table_id = c.id where c.event_id = ev group by c.name) s $f$;
-- colegas que "quem" vê em minha_mesa (evento ev), achatados
create function pg_temp.colegas(quem uuid, ev uuid) returns setof jsonb language plpgsql as $f$
declare r jsonb;
begin
  perform pg_temp.como(quem);
  r := public.minha_mesa(ev);
  perform pg_temp.como(null);
  return query select c from jsonb_array_elements(r -> 'mesas') m, jsonb_array_elements(m -> 'colegas') c;
end $f$;
-- ingresso com o próprio pedido (tickets.order_id é NOT NULL em produção)
create function pg_temp.ingresso(id int, tipo int, ev int, dono int, st text default 'active') returns void language sql as $f$
  with o as (insert into public.orders (user_id, event_id, status) values (pg_temp.u(dono), pg_temp.u(ev), 'paid') returning id)
  insert into public.tickets (id, order_id, ticket_type_id, event_id, user_id, buyer_name, buyer_email, buyer_cpf, status, created_at)
  select pg_temp.u(ingresso.id), o.id, pg_temp.u(tipo), pg_temp.u(ev), pg_temp.u(dono), 'Comprador ' || dono, 'pessoa' || dono || '@teste.evokaa.invalid',
         '00000000000', st, now() - (10000 - ingresso.id) * interval '1 second' from o $f$;
-- perfil com consentimento, gravado como postgres (o gatilho só barra anon/authenticated)
create function pg_temp.consente(g int) returns void language sql as $f$
  insert into public.user_profiles_ext (user_id, temperament, intention, music_style, energy_level, vibe, tags, social_url, education,
    mesa_consent_version, mesa_consent_at)
  values (pg_temp.u(g), (array['introvert', 'ambivert', 'extrovert'])[g % 3 + 1], (array['network', 'fun', 'experience'])[g % 3 + 1],
    (array['rock', 'pop', 'sertanejo', 'indie'])[g % 4 + 1], (array['low', 'medium', 'high'])[g % 3 + 1], 'Explorador Tranquilo',
    jsonb_build_object('musica', jsonb_build_array((array['rock', 'pop', 'funk'])[g % 3 + 1]), 'idiomas', '["ingles"]'::jsonb),
    'https://instagram.com/pessoa' || g, 'superior', '2026-10-03', now()) $f$;

-- T0. Contas: 1 produtor P, 2 produtor Q, 3 admin, 11..63 pessoas (61 sem data de nascimento,
--     62 com 17 anos, 63 fazendo 18 hoje).
--     Eventos de P: E=901 (daqui a 2 dias; start_date = dia da criação, como em produção),
--     E3=903, E4=904, E5=905. De Q: E2=902. Tipos coletivos 911..915 (um por evento).
insert into auth.users (id, email)
select pg_temp.u(g), 'pessoa' || g || '@teste.evokaa.invalid' from generate_series(1, 63) g;
-- fotos no formato do app (base64) já aprovadas na moderação pelo hash (a de golpe.example não vale)
insert into public.profiles (id, full_name, birth_date, role, avatar_url)
select pg_temp.u(g), case g when 1 then 'Paula Produtora' when 2 then 'Quintino Produtor' when 3 then 'Alice Admin'
  when 11 then 'Ana Maria Souza' when 12 then 'Bruno Carlos Lima' else 'Pessoa' || g || ' Sobrenome' end,
  case g when 61 then null when 62 then (current_date - interval '17 years')::date
    when 63 then (current_date - interval '18 years')::date else date '1995-06-15' end,
  case g when 3 then 'admin' when 1 then 'producer' when 2 then 'producer' else 'user' end,
  case g when 42 then 'https://golpe.example/foto.png' else 'data:image/jpeg;base64,' || encode(convert_to('foto' || g, 'UTF8'), 'base64') end
from generate_series(1, 63) g
on conflict (id) do update set full_name = excluded.full_name, birth_date = excluded.birth_date, role = excluded.role, avatar_url = excluded.avatar_url;
update public.profiles set avatar_moderacao = 'aprovada', avatar_moderacao_hash = public.mesa_foto_hash(avatar_url)
where id in (select pg_temp.u(g) from generate_series(1, 63) g);
insert into public.events (id, producer_id, title, date, time, status, approval_status)
select pg_temp.u(900 + g), pg_temp.u(case g when 2 then 2 else 1 end), 'Evento teste ' || g, current_date + 2, '22:00', 'published', 'approved'
from generate_series(1, 5) g;
insert into public.ticket_types (id, event_id, name, type, capacity)
select pg_temp.u(910 + g), pg_temp.u(900 + g), 'Mesa coletiva', 'coletiva', 100 from generate_series(1, 5) g;
-- E: 13 ativos (11..23) + 24 cancelado + 25 reembolsado; todos consentem menos o 12 (Bruno)
do $$ begin
  perform pg_temp.ingresso(1000 + g, 911, 901, g, case g when 24 then 'cancelled' when 25 then 'refunded' else 'active' end) from generate_series(11, 25) g;
  perform pg_temp.consente(g) from generate_series(11, 45) g where g <> 12;
end $$;
insert into public.user_profiles_ext (user_id, temperament, intention, vibe, social_url) values
  (pg_temp.u(12), 'extrovert', 'fun', 'Turbilhão', 'https://instagram.com/bruno');

-- T1. 13 ingressos ativos → 3 mesas de 5, 4 e 4; nota de 0 a 100 (cabe em numeric(4,1)); vibe não gravada
do $t$
declare n int;
begin
  perform pg_temp.como(pg_temp.u(1));
  n := public.formar_mesas(pg_temp.u(901));
  perform pg_temp.como(null);
  assert n = 13, format('alocou %s', n);
  assert pg_temp.tam(pg_temp.u(901)) = array[4, 4, 5], format('tamanhos %s', pg_temp.tam(pg_temp.u(901)));
  assert (select bool_and(status = 'open' and compatibility_score between 0 and 100 and capacity = 6)
          from public.collective_tables where event_id = pg_temp.u(901)), 'status/nota/capacidade';
  assert (select bool_and(matchmaking_answers = '{}'::jsonb and vibe is null) from public.table_members), 'copiou respostas ou gravou vibe';
  raise notice 'T1 OK: 13 → 5/4/4, notas %', (select array_agg(compatibility_score order by name) from public.collective_tables);
end $t$;

-- T2. Rodar de novo não muda nada (mesmos ids, membros, status e nota)
do $t$
declare antes text := pg_temp.retrato(pg_temp.u(901)); n int;
begin
  n := public.formar_mesas(pg_temp.u(901));
  assert n = 0, format('2ª rodada alocou %s', n);
  assert pg_temp.retrato(pg_temp.u(901)) = antes, 'mudou na 2ª rodada';
  raise notice 'T2 OK: 2ª rodada idempotente';
end $t$;

-- T3. Cancelado e reembolsado ficam de fora
do $t$
begin
  assert not exists (select 1 from public.table_members where ticket_id in (pg_temp.u(1024), pg_temp.u(1025))), 'cancelado/reembolsado na mesa';
  raise notice 'T3 OK: cancelled/refunded fora';
end $t$;

-- T4. Compra nova entra numa mesa com menos gente (das que têm gente); cancelamento sai; mesas cheias →
--     "full" e mesa nova
do $t$
declare n int; v_mesa uuid;
begin
  perform pg_temp.ingresso(1026, 911, 901, 26);
  n := public.formar_mesas(pg_temp.u(901));
  select m.table_id into v_mesa from public.table_members m where m.ticket_id = pg_temp.u(1026);
  assert n = 1 and pg_temp.tam(pg_temp.u(901)) = array[4, 5, 5]
     and (select count(*) from public.table_members where table_id = v_mesa) = 5, format('chegada: n=%s %s', n, pg_temp.tam(pg_temp.u(901)));
  -- cancela alguém (não o Bruno) de uma mesa de 5 que não é a da chegada
  update public.tickets set status = 'cancelled' where id = (select m.ticket_id from public.table_members m
    where m.table_id = (select c.id from public.collective_tables c where c.event_id = pg_temp.u(901) and c.id <> v_mesa
                        and (select count(*) from public.table_members x where x.table_id = c.id) = 5 limit 1)
      and m.user_id <> pg_temp.u(12) order by m.ticket_id limit 1);
  n := public.formar_mesas(pg_temp.u(901));
  assert n = 0 and pg_temp.tam(pg_temp.u(901)) = array[4, 4, 5], format('saída: n=%s %s', n, pg_temp.tam(pg_temp.u(901)));
  perform pg_temp.ingresso(1000 + g, 911, 901, g) from generate_series(27, 33) g;
  n := public.formar_mesas(pg_temp.u(901));
  assert n = 7 and pg_temp.tam(pg_temp.u(901)) = array[2, 6, 6, 6], format('lotação: n=%s %s', n, pg_temp.tam(pg_temp.u(901)));
  assert (select array_agg(status order by status) from public.collective_tables where event_id = pg_temp.u(901))
         = array['full', 'full', 'full', 'open'], 'status full/open';
  assert exists (select 1 from public.collective_tables where event_id = pg_temp.u(901) and name = 'Mesa 4'), 'mesa nova não é a Mesa 4';
  raise notice 'T4 OK: chegada completa a mesa com menos gente, cancelamento sai, lotação abre a Mesa 4';
end $t$;

-- T5. Mesa que esvazia é apagada; quem chega completa a mesa com gente e abre as novas; sem número repetido
do $t$
declare n int;
begin
  perform pg_temp.ingresso(1100 + g, 913, 903, g) from generate_series(34, 40) g;   -- 7 → 4 e 3
  n := public.formar_mesas(pg_temp.u(903));
  assert pg_temp.tam(pg_temp.u(903)) = array[3, 4], format('E3 %s', pg_temp.tam(pg_temp.u(903)));
  update public.tickets set status = 'refunded' where id in (select m.ticket_id from public.table_members m
    where m.table_id = (select c.id from public.collective_tables c where c.event_id = pg_temp.u(903)
                        and (select count(*) from public.table_members x where x.table_id = c.id) = 3));
  n := public.formar_mesas(pg_temp.u(903));
  assert pg_temp.tam(pg_temp.u(903)) = array[4], format('esvaziou %s', pg_temp.tam(pg_temp.u(903)));
  perform pg_temp.ingresso(1150 + g, 913, 903, g) from generate_series(46, 54) g;   -- 9: 2 completam a de 4, 6 + 1 em mesas novas
  n := public.formar_mesas(pg_temp.u(903));
  assert n = 9 and pg_temp.tam(pg_temp.u(903)) = array[1, 6, 6], format('reuso %s', pg_temp.tam(pg_temp.u(903)));
  assert (select count(*) = count(distinct name) from public.collective_tables where event_id = pg_temp.u(903)), 'número repetido';
  raise notice 'T5 OK: mesa vazia apagada; chegadas completam a mesa com gente; sem número repetido';
end $t$;

-- T6. Produtor de outro evento e comprador → 42501; admin sem moderate_mesa → 42501; admin com
--     moderate_mesa só com aal2; produtor consegue; 2FA exigido
do $t$
begin
  perform pg_temp.como(pg_temp.u(2));
  assert pg_temp.erro(format('select public.formar_mesas(%L)', pg_temp.u(901))) = '42501', 'Q formou mesas de E';
  assert pg_temp.erro(format('select public.mesas_do_evento(%L)', pg_temp.u(901))) = '42501', 'Q leu mesas de E';
  perform pg_temp.como(pg_temp.u(11));
  assert pg_temp.erro(format('select public.formar_mesas(%L)', pg_temp.u(901))) = '42501', 'comprador formou mesas';
  assert pg_temp.erro(format('select public.mesas_do_evento(%L)', pg_temp.u(901))) = '42501', 'comprador leu mesas do evento';
  -- o admin 3 não tem moderate_mesa: nem com aal2
  perform pg_temp.como(pg_temp.u(3), 'aal2');
  assert pg_temp.erro(format('select public.formar_mesas(%L)', pg_temp.u(902))) = '42501', 'admin sem moderate_mesa formou';
  assert pg_temp.erro(format('select public.mesas_do_evento(%L)', pg_temp.u(901))) = '42501', 'admin sem moderate_mesa leu';
  perform pg_temp.como(null);
  update public.profiles set admin_permissions = array['moderate_mesa'] where id = pg_temp.u(3);
  -- com moderate_mesa: aal1 → 42501; aal2 → passa
  perform pg_temp.como(pg_temp.u(3), 'aal1');
  assert pg_temp.erro(format('select public.formar_mesas(%L)', pg_temp.u(902))) = '42501', 'moderador aal1 formou';
  assert pg_temp.erro(format('select public.mesas_do_evento(%L)', pg_temp.u(901))) = '42501', 'moderador aal1 leu';
  perform pg_temp.como(pg_temp.u(3), 'aal2');
  assert pg_temp.erro(format('select public.formar_mesas(%L)', pg_temp.u(902))) = 'ok', 'moderador aal2 não formou';
  assert pg_temp.erro(format('select public.mesas_do_evento(%L)', pg_temp.u(901))) = 'ok', 'moderador aal2 não leu';
  perform pg_temp.como(pg_temp.u(1));
  assert jsonb_array_length(public.mesas_do_evento(pg_temp.u(901))) = 4, 'produtor não vê as 4 mesas';
  assert public.mesas_do_evento(pg_temp.u(901))::text like '%Ana Maria Souza%', 'produtor sem nome completo';
  assert public.mesas_do_evento(pg_temp.u(901))::text not like '%@%', 'e-mail em mesas_do_evento';
  -- 2FA: fator verificado e sessão aal1 → 42501; aal2 → passa
  perform pg_temp.como(null);
  insert into auth.mfa_factors (user_id, status) values (pg_temp.u(1), 'verified'), (pg_temp.u(11), 'verified');
  perform pg_temp.como(pg_temp.u(1), 'aal1');
  assert pg_temp.erro(format('select public.formar_mesas(%L)', pg_temp.u(901))) = '42501', 'formar_mesas sem 2FA';
  assert pg_temp.erro(format('select public.mesas_do_evento(%L)', pg_temp.u(901))) = '42501', 'mesas_do_evento sem 2FA';
  perform pg_temp.como(pg_temp.u(11), 'aal1');
  assert pg_temp.erro(format('select public.minha_mesa(%L)', pg_temp.u(901))) = '42501', 'minha_mesa sem 2FA';
  assert pg_temp.erro(format('select public.mesa_consentir(%L)', '2026-10-03')) = '42501', 'mesa_consentir sem 2FA';
  assert pg_temp.erro('select public.mesa_revogar()') = '42501', 'mesa_revogar sem 2FA';
  assert pg_temp.erro(format('select public.minha_mesa(%L)', pg_temp.u(901))) = '42501', 'minha_mesa sem 2FA';
  perform pg_temp.como(pg_temp.u(1), 'aal2');
  assert pg_temp.erro(format('select public.formar_mesas(%L)', pg_temp.u(901))) = 'ok', 'produtor com aal2 barrado';
  perform pg_temp.como(pg_temp.u(11), 'aal2');
  assert pg_temp.erro(format('select public.minha_mesa(%L)', pg_temp.u(901))) = 'ok', 'minha_mesa com aal2 barrada';
  perform pg_temp.como(null);
  delete from auth.mfa_factors where user_id in (pg_temp.u(1), pg_temp.u(11));
  raise notice 'T6 OK: só produtor do evento e moderador com aal2; admin comum barrado; 2FA exigido quando há fator';
end $t$;

-- T7. anon e authenticated não leem nem escrevem nas tabelas; anon não executa as funções
do $t$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'anon', true);
  assert pg_temp.erro('select 1 from public.collective_tables') = '42501', 'anon SELECT mesas';
  assert pg_temp.erro('select 1 from public.table_members') = '42501', 'anon SELECT membros';
  assert pg_temp.erro('select 1 from public.mesa_consentimentos') = '42501', 'anon SELECT histórico';
  assert pg_temp.erro(format('insert into public.collective_tables (event_id, name) values (%L, %L)', pg_temp.u(901), 'X')) = '42501', 'anon INSERT';
  assert pg_temp.erro(format('select public.formar_mesas(%L)', pg_temp.u(901))) = '42501', 'anon EXECUTE formar_mesas';
  assert pg_temp.erro(format('select public.minha_mesa(%L)', pg_temp.u(901))) = '42501', 'anon EXECUTE minha_mesa';
  assert pg_temp.erro(format('select public.mesas_do_evento(%L)', pg_temp.u(901))) = '42501', 'anon EXECUTE mesas_do_evento';
  assert pg_temp.erro(format('select public.mesa_consentir(%L)', '2026-10-03')) = '42501', 'anon EXECUTE mesa_consentir';
  assert pg_temp.erro('select public.mesa_revogar()') = '42501', 'anon EXECUTE mesa_revogar';
  perform pg_temp.como(pg_temp.u(11));
  assert pg_temp.erro('select 1 from public.table_members') = '42501', 'authenticated SELECT membros';
  assert pg_temp.erro('select 1 from public.mesa_consentimentos') = '42501', 'authenticated SELECT histórico';
  assert pg_temp.erro(format('insert into public.collective_tables (event_id, name) values (%L, %L)', pg_temp.u(901), 'X')) = '42501', 'authenticated INSERT';
  assert pg_temp.erro(format('select public.mesa_perfil(%L)', pg_temp.u(12))) = '42501', 'authenticated EXECUTE mesa_perfil';
  assert pg_temp.erro(format('select public.mesa_ok(%L)', pg_temp.u(12))) = '42501', 'authenticated EXECUTE mesa_ok';
  perform pg_temp.como(null);
  raise notice 'T7 OK: tabelas fechadas; anon sem EXECUTE';
end $t$;

-- T8. minha_mesa: sem dado proibido nem nota; quem não consentiu só com o primeiro nome;
--     reciprocidade; colega reembolsado some na hora; quem não tem ingresso não vê nem forma_em
do $t$
declare r jsonb; colega uuid; b jsonb; sai uuid;
begin
  select m2.user_id into colega from public.table_members m1 join public.table_members m2 on m2.table_id = m1.table_id
  where m1.user_id = pg_temp.u(12) and m2.user_id <> pg_temp.u(12) order by m2.ticket_id limit 1;
  perform pg_temp.como(colega);
  r := public.minha_mesa(pg_temp.u(901));
  perform pg_temp.como(null);
  assert jsonb_array_length(r -> 'mesas') = 1, format('mesas: %s', r);
  assert r::text not like '%user_id%' and r::text not like '%email%' and r::text not like '%@teste.evokaa.invalid%'
     and r::text not like '%temperament%' and r::text not like '%intention%' and r::text not like '%b0000000%'
     and r::text not like '%introvert%' and r::text not like '%extrovert%' and r::text not like '%score%'
     and not (r -> 'mesas' -> 0 ? 'score'), format('vazou: %s', r);
  assert (r ->> 'forma_em')::timestamptz = ((current_date + 2) + time '22:00') at time zone 'America/Sao_Paulo' - interval '24 hours',
         format('forma_em %s', r ->> 'forma_em');
  select c into b from jsonb_array_elements(r -> 'mesas' -> 0 -> 'colegas') c where c ->> 'nome' = 'Bruno';
  assert b is not null and b -> 'foto' = 'null' and b -> 'faixa_idade' = 'null' and b -> 'rede_social' = 'null'
     and b -> 'tags' = 'null' and b -> 'escolaridade' = 'null' and b -> 'perfil' = 'null', format('Bruno exposto: %s', b);
  assert (select count(*) from jsonb_array_elements(r -> 'mesas' -> 0 -> 'colegas') c where (c ->> 'eu')::boolean) = 1, 'eu';
  -- Decisão 94: só o primeiro nome e a faixa de idade; rede social só com o segundo aceite (nenhum aqui)
  assert r::text not like '%Sobrenome%' and r::text not like '%Souza%' and r::text not like '%"idade"%', format('nome completo ou idade: %s', r);
  assert (select bool_and(c ->> 'faixa_idade' = '25–34' and c -> 'rede_social' = 'null' and c ->> 'foto' like 'data:image/jpeg;base64,%')
          from jsonb_array_elements(r -> 'mesas' -> 0 -> 'colegas') c where c ->> 'nome' <> 'Bruno'), format('colega que consentiu incompleto: %s', r);
  -- reciprocidade: Bruno (sem consentimento) vê todos só pelo primeiro nome
  assert (select bool_and(c ->> 'nome' not like '% %' and c -> 'foto' = 'null' and c -> 'tags' = 'null')
          from pg_temp.colegas(pg_temp.u(12), pg_temp.u(901)) c), 'Bruno viu perfil completo';
  -- colega reembolsado some antes de formar_mesas rodar de novo
  select m2.ticket_id into sai from public.table_members m1 join public.table_members m2 on m2.table_id = m1.table_id
  where m1.user_id = colega and m2.user_id not in (colega, pg_temp.u(12)) order by m2.ticket_id limit 1;
  update public.tickets set status = 'refunded' where id = sai;
  assert not exists (select 1 from pg_temp.colegas(colega, pg_temp.u(901)) c
                     where c ->> 'nome' = (select split_part(p.full_name, ' ', 1) from public.tickets t join public.profiles p on p.id = t.user_id where t.id = sai)),
         'reembolsado ainda aparece';
  -- sem ingresso coletivo no evento: {"mesas": []}, sem forma_em
  perform pg_temp.como(pg_temp.u(60));
  assert public.minha_mesa(pg_temp.u(901)) = '{"mesas": []}'::jsonb, 'sem ingresso viu algo';
  perform pg_temp.como(null);
  raise notice 'T8 OK: minha_mesa sem dado proibido nem nota; primeiro nome; reciprocidade; reembolsado some';
end $t$;

-- T9. 2º ingresso coletivo na mesma conta → 22023. Defesas de minha_mesa: quem vira menor depois
--     de alocado (burla do ponytail do bloco 3b) só com o primeiro nome; 2 ingressos forçados com o
--     gatilho desligado = 1 colega com acompanhantes; foto fora do Storage do projeto não sai
do $t$
declare c41 jsonb; c42 jsonb; eu jsonb;
begin
  perform pg_temp.ingresso(1500, 914, 904, 41);
  perform pg_temp.ingresso(1501, 914, 904, 42);
  perform pg_temp.ingresso(1503, 914, 904, 43);
  assert pg_temp.erro('select pg_temp.ingresso(1502, 914, 904, 42)') = '22023', '2º ingresso coletivo na mesma conta passou';
  alter table public.tickets disable trigger mesa_idade_guard;
  perform pg_temp.ingresso(1502, 914, 904, 42);
  alter table public.tickets enable trigger mesa_idade_guard;
  perform public.formar_mesas(pg_temp.u(904));
  update public.profiles set birth_date = current_date - interval '17 years' where id = pg_temp.u(41);
  select c into c41 from pg_temp.colegas(pg_temp.u(43), pg_temp.u(904)) c where c ->> 'nome' = 'Pessoa41';
  assert c41 is not null and c41 -> 'faixa_idade' = 'null' and c41 -> 'foto' = 'null' and c41 -> 'tags' = 'null', format('menor exposto: %s', c41);
  select c into c42 from pg_temp.colegas(pg_temp.u(43), pg_temp.u(904)) c where c ->> 'nome' = 'Pessoa42';
  assert (c42 ->> 'acompanhantes')::int = 1 and c42 -> 'foto' = 'null', format('acompanhantes/foto: %s', c42);
  assert (select count(*) from pg_temp.colegas(pg_temp.u(43), pg_temp.u(904))) = 3, 'mais de um colega por pessoa';
  select c into eu from pg_temp.colegas(pg_temp.u(42), pg_temp.u(904)) c where (c ->> 'eu')::boolean;
  assert (select count(*) from pg_temp.colegas(pg_temp.u(42), pg_temp.u(904)) c where (c ->> 'eu')::boolean) = 1
     and (eu ->> 'acompanhantes')::int = 1, format('eu duplicado: %s', eu);
  perform pg_temp.como(pg_temp.u(1));
  assert jsonb_array_length(public.mesas_do_evento(pg_temp.u(904)) -> 0 -> 'membros') = 4, 'produtor não vê 4 cadeiras';
  perform pg_temp.como(null);
  raise notice 'T9 OK: 1 por conta; menor fechado; acompanhantes (defesa); foto externa bloqueada; produtor conta cadeiras';
end $t$;

-- T10. 3 pessoas sem consentimento: forma, sem overflow, nota nula
do $t$
begin
  perform pg_temp.ingresso(1300 + g, 915, 905, g) from generate_series(55, 57) g;
  assert public.formar_mesas(pg_temp.u(905)) = 3, 'não alocou 3';
  assert (select compatibility_score is null from public.collective_tables where event_id = pg_temp.u(905)), 'nota sem par consentido';
  raise notice 'T10 OK: sem consentimento, nota nula';
end $t$;

-- T11. CHECKs: etiquetas, social_url, escolaridade, vibe e "romance"
do $t$
declare u text := pg_temp.u(11);
begin
  perform pg_temp.como(pg_temp.u(11));
  assert pg_temp.erro(format($q$update public.user_profiles_ext set tags = '{"musica": ["forro", "axe_inexistente"]}' where user_id = %L$q$, u)) = '23514', 'tag fora da lista';
  assert pg_temp.erro(format($q$update public.user_profiles_ext set tags = '{"musica": ["sertanejo","funk","rock","pop","eletronica","mpb","samba_pagode","forro","indie"]}' where user_id = %L$q$, u)) = '23514', '9 itens';
  assert pg_temp.erro(format($q$update public.user_profiles_ext set tags = '{"religiao": ["x"]}' where user_id = %L$q$, u)) = '23514', 'categoria estranha';
  assert pg_temp.erro(format($q$update public.user_profiles_ext set tags = '{"musica": ["rock", "rock"]}' where user_id = %L$q$, u)) = '23514', 'repetida';
  assert pg_temp.erro(format($q$update public.user_profiles_ext set tags = '{"musica": "rock"}' where user_id = %L$q$, u)) = '23514', 'não array';
  assert pg_temp.erro(format($q$update public.user_profiles_ext set tags = '{"musica": ["sertanejo","funk","rock","pop","eletronica","mpb","samba_pagode","forro"], "hobbies": ["pets"]}' where user_id = %L$q$, u)) = 'ok', '8 itens válidos';
  assert pg_temp.erro(format($q$update public.user_profiles_ext set social_url = 'http://instagram.com/ana' where user_id = %L$q$, u)) = '23514', 'http://';
  assert pg_temp.erro(format($q$update public.user_profiles_ext set social_url = 'HTTPS://instagram.com/ana' where user_id = %L$q$, u)) = '23514', 'HTTPS maiúsculo';
  assert pg_temp.erro(format($q$update public.user_profiles_ext set social_url = 'https://facebook.com/ana' where user_id = %L$q$, u)) = '23514', 'outro domínio';
  assert pg_temp.erro(format($q$update public.user_profiles_ext set social_url = 'https://instagram.com.golpe.io/ana' where user_id = %L$q$, u)) = '23514', 'domínio disfarçado';
  assert pg_temp.erro(format($q$update public.user_profiles_ext set social_url = 'https://instagram.com/ana"onclick=x' where user_id = %L$q$, u)) = '23514', 'aspas no caminho';
  assert pg_temp.erro(format($q$update public.user_profiles_ext set social_url = 'https://instagram.com/' where user_id = %L$q$, u)) = '23514', 'caminho vazio';
  assert pg_temp.erro(format($q$update public.user_profiles_ext set social_url = 'https://www.linkedin.com/in/ana-souza_1' where user_id = %L$q$, u)) = 'ok', 'linkedin válido';
  assert pg_temp.erro(format($q$update public.user_profiles_ext set education = 'doutorado' where user_id = %L$q$, u)) = '23514', 'escolaridade';
  assert pg_temp.erro(format($q$update public.user_profiles_ext set vibe = 'Hacker' where user_id = %L$q$, u)) = '23514', 'vibe fora da lista';
  assert pg_temp.erro(format($q$update public.user_profiles_ext set vibe = 'Camaleão' where user_id = %L$q$, u)) = 'ok', 'vibe válida';
  assert pg_temp.erro(format($q$update public.user_profiles_ext set intention = 'romance' where user_id = %L$q$, u)) = '23514', 'romance';
  perform pg_temp.como(null);
  raise notice 'T11 OK: CHECKs de tags, social_url, escolaridade, vibe e romance';
end $t$;

-- T12. Consentimento só por função; versão errada falha; revogar zera e registra
do $t$
declare u60 uuid := pg_temp.u(60);
begin
  perform pg_temp.como(pg_temp.u(11));
  assert pg_temp.erro(format($q$update public.user_profiles_ext set mesa_consent_at = now() - interval '1 day' where user_id = %L$q$, pg_temp.u(11))) = '42501', 'update direto de mesa_consent_at';
  assert pg_temp.erro(format($q$update public.user_profiles_ext set mesa_consent_revoked_at = null, mesa_consent_version = 'x' where user_id = %L$q$, pg_temp.u(11))) = '42501', 'update direto de mesa_consent_version';
  perform pg_temp.como(u60);
  assert pg_temp.erro(format($q$insert into public.user_profiles_ext (user_id, mesa_consent_at) values (%L, now())$q$, u60)) = '42501', 'insert direto com consentimento';
  assert pg_temp.erro(format('select public.mesa_consentir(%L)', '2020-01-01')) = '22023', 'versão errada aceita';
  perform public.mesa_consentir('2026-10-03');
  perform pg_temp.como(null);
  assert (select mesa_consent_version = '2026-10-03' and mesa_consent_at is not null and mesa_consent_revoked_at is null
          from public.user_profiles_ext where user_id = u60), 'mesa_consentir não gravou';
  update public.user_profiles_ext set temperament = 'introvert', tags = '{"hobbies": ["pets"]}', social_url = 'https://x.com/p60',
    education = 'medio', vibe = 'Curioso', quiz_completed_at = now() where user_id = u60;
  perform pg_temp.como(u60);
  perform public.mesa_revogar();
  perform pg_temp.como(null);
  assert (select mesa_consent_revoked_at is not null and tags is null and social_url is null and education is null and temperament is null
            and intention is null and music_style is null and energy_level is null and vibe is null and gender is null and bio is null
            and birth_year is null and quiz_completed_at is null from public.user_profiles_ext where user_id = u60), 'revogar não zerou';
  assert (select array_agg(acao order by em, acao) from public.mesa_consentimentos where user_id = u60) = array['consentiu', 'revogou'], 'histórico';
  raise notice 'T12 OK: consentimento só por função; revogação zera e fica no histórico';
end $t$;

-- T13. Cron: forma só na janela de 24 h (pelo date/time, não pelo start_date), um evento com erro
--      não derruba os outros, e apaga mesas de evento com mais de 30 dias
do $t$
declare formar text := (select command from cron.job where jobname = 'formar_mesas');
        apagar text := (select command from cron.job where jobname = 'apagar_mesas_antigas');
        daqui3h timestamp := (now() + interval '3 hours') at time zone 'America/Sao_Paulo';
begin
  -- E2 daqui a 3 h, com 1 ingresso; E5 daqui a 3 h também, mas com erro forçado; E3 com start_date
  -- de 40 dias atrás e date daqui a 10 dias (fora da janela e não pode ser apagado)
  update public.events set date = daqui3h::date, time = daqui3h::time where id in (pg_temp.u(902), pg_temp.u(905));
  perform pg_temp.ingresso(1400, 912, 902, 58);
  perform pg_temp.ingresso(1401, 915, 905, 59);
  create function pg_temp.falha() returns trigger language plpgsql as $f$
  begin if new.ticket_id = 'b0000000-0000-4000-8000-000000001401' then raise exception 'erro forçado'; end if; return new; end $f$;
  create trigger falha before insert on public.table_members for each row execute function pg_temp.falha();
  update public.events set start_date = now() - interval '40 days', date = current_date + 10 where id = pg_temp.u(903);
  perform pg_temp.ingresso(1402, 913, 903, 59);
  update public.events set date = current_date - 40 where id = pg_temp.u(901);
  execute formar;
  drop trigger falha on public.table_members;
  assert exists (select 1 from public.table_members where ticket_id = pg_temp.u(1400)), 'evento com erro derrubou os outros';
  assert not exists (select 1 from public.table_members where ticket_id = pg_temp.u(1401)), 'evento com erro formou';
  assert not exists (select 1 from public.table_members where ticket_id = pg_temp.u(1402)), 'formou fora da janela (usou start_date)';
  execute apagar;
  assert not exists (select 1 from public.collective_tables where event_id = pg_temp.u(901)), 'não apagou mesas de 40 dias';
  assert exists (select 1 from public.collective_tables where event_id = pg_temp.u(903)), 'apagou evento futuro pelo start_date';
  perform pg_temp.como((select user_id from public.tickets where event_id = pg_temp.u(903) and status = 'active' order by id limit 1));
  assert (public.minha_mesa(pg_temp.u(903)) ->> 'forma_em')::timestamptz
         = ((current_date + 10) + time '22:00') at time zone 'America/Sao_Paulo' - interval '24 hours', 'forma_em pelo start_date';
  perform pg_temp.como(null);
  raise notice 'T13 OK: janela pelo date/time; erro isolado por evento; limpeza de 30 dias';
end $t$;

-- T14. mesa_compat: perfis iguais = 100; opostos = 60 (a intenção parcial soma 10); Jaccard soma
do $t$
begin
  assert public.mesa_compat('{"temperament":"introvert","energy_level":"low","intention":"fun","music_style":"rock"}',
                            '{"temperament":"introvert","energy_level":"low","intention":"fun","music_style":"rock"}') = 100, 'iguais';
  assert public.mesa_compat('{"temperament":"introvert","energy_level":"low","intention":"network","music_style":"jazz"}',
                            '{"temperament":"extrovert","energy_level":"high","intention":"fun","music_style":"sertanejo"}') = 60, 'opostos';
  assert public.mesa_compat('{"temperament":"introvert","energy_level":"low","tags":{"musica":["rock"]}}',
                            '{"temperament":"extrovert","energy_level":"high","tags":{"musica":["rock","pop"]}}') = 55, 'jaccard 1/2';
  raise notice 'T14 OK: mesa_compat';
end $t$;

-- T15. Mesa coletiva só para 18+ com data de nascimento (gatilho mesa_idade_guard); ingresso
--      individual não muda; quem ficou sem data depois da compra fica fora da mesa, com aviso
do $t$
begin
  insert into public.ticket_types (id, event_id, name, type, capacity) values (pg_temp.u(916), pg_temp.u(904), 'Pista', 'individual', 100);
  assert pg_temp.erro('select pg_temp.ingresso(1600, 914, 904, 61)') = '22023', 'sem data de nascimento passou';
  assert pg_temp.erro('select pg_temp.ingresso(1601, 914, 904, 62)') = '22023', '17 anos passou';
  assert pg_temp.erro('select pg_temp.ingresso(1602, 914, 904, 63)') = 'ok', '18 anos hoje barrado';
  assert pg_temp.erro('select pg_temp.ingresso(1603, 916, 904, 62)') = 'ok', 'individual de menor barrado';
  assert pg_temp.erro(format('update public.tickets set ticket_type_id = %L where id = %L', pg_temp.u(914), pg_temp.u(1603))) = '22023', 'troca para coletiva de menor passou';
  assert pg_temp.erro(format('update public.tickets set user_id = %L where id = %L', pg_temp.u(61), pg_temp.u(1602))) = '22023', 'transferência para quem não tem data passou';
  perform set_config('role', 'service_role', true);
  assert pg_temp.erro('select pg_temp.ingresso(1604, 914, 904, 62)') = '22023', 'service_role passou';
  perform set_config('role', 'postgres', true);
  -- defesa: comprou com 18+, a data sumiu depois; formar_mesas deixa fora (WARNING esperado)
  update public.profiles set birth_date = null where id = pg_temp.u(63);
  perform public.formar_mesas(pg_temp.u(904));
  assert not exists (select 1 from public.table_members where ticket_id = pg_temp.u(1602)), 'sem data foi alocado';
  raise notice 'T15 OK: coletiva só 18+ com data (inclusive service_role); individual livre; defesa na formação';
end $t$;
-- T16. Pedido (order_items), antes da cobrança: coletiva só com quantidade 1, comprador 18+ com
--      data de nascimento, 1 item coletivo por pedido e nenhum ingresso coletivo já ativo no evento
do $t$
declare o45 uuid := gen_random_uuid(); o62 uuid := gen_random_uuid(); o43 uuid := gen_random_uuid(); item uuid;
begin
  insert into public.orders (id, user_id, event_id, status) values
    (o45, pg_temp.u(45), pg_temp.u(904), 'pending'), (o62, pg_temp.u(62), pg_temp.u(904), 'pending'),
    (o43, pg_temp.u(43), pg_temp.u(904), 'pending');
  assert pg_temp.erro(format('insert into public.order_items (order_id, ticket_type_id, quantity) values (%L, %L, 2)', o45, pg_temp.u(914))) = '22023', 'coletiva com quantidade 2 passou';
  insert into public.order_items (order_id, ticket_type_id, quantity) values (o45, pg_temp.u(914), 1) returning id into item;
  assert pg_temp.erro(format('insert into public.order_items (order_id, ticket_type_id, quantity) values (%L, %L, 1)', o45, pg_temp.u(914))) = '22023', '2º item coletivo no pedido passou';
  assert pg_temp.erro(format('update public.order_items set quantity = 2 where id = %L', item)) = '22023', 'update para quantidade 2 passou';
  assert pg_temp.erro(format('insert into public.order_items (order_id, ticket_type_id, quantity) values (%L, %L, 1)', o62, pg_temp.u(914))) = '22023', 'coletiva de menor passou';
  assert pg_temp.erro(format('insert into public.order_items (order_id, ticket_type_id, quantity) values (%L, %L, 3)', o62, pg_temp.u(916))) = 'ok', 'individual de menor barrado';
  assert pg_temp.erro(format('insert into public.order_items (order_id, ticket_type_id, quantity) values (%L, %L, 1)', o43, pg_temp.u(914))) = '22023', 'quem já tem coletiva comprou outra';
  raise notice 'T16 OK: pedido coletivo barrado antes da cobrança (quantidade, idade, duplicado); individual livre';
end $t$;

-- T17. Transferência só trocando o dono: o antigo some de mesas_do_evento e minha_mesa na hora e
--      sai na rodada seguinte, em que o novo dono entra; reembolsado também some de mesas_do_evento
do $t$
declare r jsonb; n int;
begin
  update public.tickets set user_id = pg_temp.u(47) where id = pg_temp.u(1503);   -- de 43 para 47
  update public.tickets set status = 'refunded' where id = pg_temp.u(1500);       -- 41
  perform pg_temp.como(pg_temp.u(1));
  r := public.mesas_do_evento(pg_temp.u(904));
  assert r::text not like '%' || pg_temp.u(1503) || '%' and r::text not like '%' || pg_temp.u(1500) || '%'
     and r::text not like '%Pessoa43 %' and r::text not like '%Pessoa41 %', format('mesas_do_evento mostra quem saiu: %s', r);
  perform pg_temp.como(null);
  assert not exists (select 1 from pg_temp.colegas(pg_temp.u(42), pg_temp.u(904)) c where c ->> 'nome' = 'Pessoa43'), 'antigo dono em minha_mesa';
  n := public.formar_mesas(pg_temp.u(904));
  assert n = 1 and exists (select 1 from public.table_members where ticket_id = pg_temp.u(1503) and user_id = pg_temp.u(47)), format('novo dono não entrou (n=%s)', n);
  assert not exists (select 1 from public.table_members where user_id = pg_temp.u(43)), 'antigo dono ficou';
  perform pg_temp.como(pg_temp.u(1));
  assert public.mesas_do_evento(pg_temp.u(904))::text like '%Pessoa47 Sobrenome%'
     and public.mesas_do_evento(pg_temp.u(904))::text not like '%Comprador%', 'produtor não vê o novo dono (ou vê quem comprou)';
  -- perfil sem nome: a cadeira aparece como "(sem nome no perfil)", nunca com o nome da compra
  perform pg_temp.como(null);
  update public.profiles set full_name = ' ' where id = pg_temp.u(47);
  perform pg_temp.como(pg_temp.u(1));
  assert public.mesas_do_evento(pg_temp.u(904))::text like '%(sem nome no perfil)%', 'perfil sem nome';
  perform pg_temp.como(null);
  raise notice 'T17 OK: transferência troca a pessoa; quem saiu some de mesas_do_evento';
end $t$;

-- T18. Consentimento de versão antiga do termo = não vigente: só o primeiro nome (e reciprocidade)
do $t$
declare a uuid; b uuid; mesa uuid; ca jsonb;
begin
  mesa := pg_temp.maior(pg_temp.u(903));
  select m.user_id into a from public.table_members m where m.table_id = mesa and public.mesa_ok(m.user_id) order by m.ticket_id limit 1;
  select m.user_id into b from public.table_members m where m.table_id = mesa and public.mesa_ok(m.user_id) and m.user_id <> a order by m.ticket_id limit 1;
  update public.user_profiles_ext set mesa_consent_version = '2025-01-01' where user_id = a;
  select c into ca from pg_temp.colegas(b, pg_temp.u(903)) c where c ->> 'nome' = (select split_part(full_name, ' ', 1) from public.profiles where id = a)
    and not (c ->> 'eu')::boolean;
  assert ca is not null and ca -> 'foto' = 'null' and ca -> 'tags' = 'null', format('versão antiga exposta: %s', ca);
  assert (select bool_and(c ->> 'nome' not like '% %') from pg_temp.colegas(a, pg_temp.u(903)) c), 'versão antiga viu perfis completos';
  raise notice 'T18 OK: termo de versão antiga não vale';
end $t$;

-- T19. mesa_revogar apaga a nota das mesas da pessoa
do $t$
declare mesa uuid; quem uuid;
begin
  mesa := pg_temp.maior(pg_temp.u(903));
  assert (select compatibility_score is not null from public.collective_tables where id = mesa), 'preparo: Mesa 1 sem nota';
  select m.user_id into quem from public.table_members m where m.table_id = mesa and public.mesa_ok(m.user_id) order by m.ticket_id limit 1;
  perform pg_temp.como(quem);
  perform public.mesa_revogar();
  perform pg_temp.como(null);
  assert (select compatibility_score is null from public.collective_tables where id = mesa), 'nota ficou depois de revogar';
  raise notice 'T19 OK: revogar apaga a nota da mesa';
end $t$;
-- T20. Reativação, check-in, troca de pedido, troca de tipo e consentimento de menor
do $t$
declare o45 uuid; o62 uuid; item uuid; v_versao text := public.mesa_termo_versao();  -- lida como postgres (função fechada)
begin
  -- reativação duplicada: 1700 cancelado, 1701 ativo; voltar 1700 para active → 22023
  perform pg_temp.ingresso(1700, 914, 904, 49);
  update public.tickets set status = 'cancelled' where id = pg_temp.u(1700);
  perform pg_temp.ingresso(1701, 914, 904, 49);
  assert pg_temp.erro(format('update public.tickets set status = %L where id = %L', 'active', pg_temp.u(1700))) = '22023', 'reativação duplicada passou';
  assert pg_temp.erro(format('update public.tickets set status = %L where id = %L', 'used', pg_temp.u(1700))) = '22023', 'reativação como used passou';
  -- check-in de quem ficou sem data de nascimento depois da compra: passa
  perform pg_temp.ingresso(1702, 914, 904, 50);
  update public.profiles set birth_date = null where id = pg_temp.u(50);
  assert pg_temp.erro(format('update public.tickets set status = %L where id = %L', 'used', pg_temp.u(1702))) = 'ok', 'check-in barrado';
  assert pg_temp.erro(format('update public.tickets set status = %L where id = %L', 'refunded', pg_temp.u(1702))) = 'ok', 'reembolso barrado';
  -- mover item coletivo para o pedido de um menor → 22023
  select o.id into o45 from public.orders o where o.user_id = pg_temp.u(45) and o.status = 'pending';
  select o.id into o62 from public.orders o where o.user_id = pg_temp.u(62) and o.status = 'pending';
  select oi.id into item from public.order_items oi where oi.order_id = o45 and oi.ticket_type_id = pg_temp.u(914);
  assert pg_temp.erro(format('update public.order_items set order_id = %L where id = %L', o62, item)) = '22023', 'item movido para pedido de menor';
  -- troca de tipo: com vendas → 22023 (nos dois sentidos); sem vendas → passa
  assert pg_temp.erro(format('update public.ticket_types set type = %L where id = %L', 'individual', pg_temp.u(914))) = '22023', 'coletiva vendida virou individual';
  assert pg_temp.erro(format('update public.ticket_types set type = %L where id = %L', 'coletiva', pg_temp.u(916))) = '22023', 'individual vendido virou coletiva';
  insert into public.ticket_types (id, event_id, name, type, capacity) values (pg_temp.u(917), pg_temp.u(904), 'Nova', 'coletiva', 10);
  assert pg_temp.erro(format('update public.ticket_types set type = %L where id = %L', 'vip', pg_temp.u(917))) = 'ok', 'troca sem vendas barrada';
  assert pg_temp.erro(format('update public.ticket_types set name = %L where id = %L', 'Mesa Tinder', pg_temp.u(914))) = 'ok', 'renomear barrado';
  -- mesa_consentir de menor → 22023
  perform pg_temp.como(pg_temp.u(62));
  assert pg_temp.erro(format('select public.mesa_consentir(%L)', v_versao)) = '22023', 'menor consentiu';
  perform pg_temp.como(null);
  raise notice 'T20 OK: reativação duplicada barrada; check-in livre; pedido de menor; tipo travado após venda; menor não consente';
end $t$;
-- T21. seg-6 (#85): mesa_tags_ok executável por authenticated e service_role (o CHECK do questionário
--      roda com o papel de quem grava); as outras puras e as funções de gatilho fechadas; os gatilhos
--      de user_profiles_ext, profiles, tickets, order_items e ticket_types disparam para authenticated
--      sem EXECUTE (o erro é o da regra, nunca 42501)
do $t$
declare f text;
begin
  assert has_function_privilege('authenticated', 'public.mesa_tags_ok(jsonb)', 'execute')
     and has_function_privilege('service_role', 'public.mesa_tags_ok(jsonb)', 'execute')
     and not has_function_privilege('anon', 'public.mesa_tags_ok(jsonb)', 'execute'), 'grant de mesa_tags_ok';
  foreach f in array array['public.mesa_compat(jsonb, jsonb)', 'public.evento_momento(public.events)', 'public.mesa_termo_versao()',
      'public.mesa_foto_formato(text)', 'public.mesa_foto_hash(text)', 'public.mesa_consent_guard()', 'public.mesa_avatar_guard()',
      'public.mesa_idade_guard()', 'public.mesa_pedido_guard()', 'public.mesa_tipo_guard()', 'public.mesa_passagem()'] loop
    assert not has_function_privilege('authenticated', f, 'execute') and not has_function_privilege('anon', f, 'execute'), 'aberta: ' || f;
  end loop;
  perform pg_temp.como(pg_temp.u(58));
  -- upsert do questionário: mesa_consent_guard e o CHECK com mesa_tags_ok
  assert pg_temp.erro(format($q$insert into public.user_profiles_ext (user_id, tags) values (%L, '{"musica": ["rock"]}')
                               on conflict (user_id) do update set tags = excluded.tags$q$, pg_temp.u(58))) = 'ok', 'upsert válido';
  assert pg_temp.erro(format($q$insert into public.user_profiles_ext (user_id, tags) values (%L, '{"musica": ["axe_inexistente"]}')
                               on conflict (user_id) do update set tags = excluded.tags$q$, pg_temp.u(58))) = '23514', 'upsert inválido';
  -- profiles: gf_protect_profile_privileges e mesa_avatar_guard
  assert pg_temp.erro(format($q$update public.profiles set avatar_url = 'data:image/jpeg;base64,Zm90bw==' where id = %L$q$, pg_temp.u(58))) = 'ok', 'profiles';
  -- tickets (mesa_idade_guard): o 58 já tem ingresso coletivo no E2 → 22023
  assert pg_temp.erro('select pg_temp.ingresso(1900, 912, 902, 58)') = '22023', 'tickets';
  -- order_items (mesa_pedido_guard): coletiva com quantidade 2 → 22023
  assert pg_temp.erro(format('with o as (insert into public.orders (user_id, event_id, status) values (%L, %L, %L) returning id)
                              insert into public.order_items (order_id, ticket_type_id, quantity) select o.id, %L, 2 from o',
                             pg_temp.u(58), pg_temp.u(902), 'pending', pg_temp.u(912))) = '22023', 'order_items';
  -- ticket_types (mesa_tipo_guard): tipo vendido não muda → 22023
  assert pg_temp.erro(format('update public.ticket_types set type = %L where id = %L', 'individual', pg_temp.u(912))) = '22023', 'ticket_types';
  perform pg_temp.como(null);
  raise notice 'T21 OK: mesa_tags_ok aberta a authenticated/service_role; internas fechadas; gatilhos disparam sem EXECUTE';
end $t$;
rollback;

-- ---------------------------------------------------------------------------
-- TESTES — escolha da mesa, denúncia, rede social, moderação da foto (bloco próprio, com rollback)
-- ---------------------------------------------------------------------------
begin;
-- seg-6 (#85): função nova do postgres fora do schema public nasce só com EXECUTE do dono; os auxiliares
-- pg_temp.* também rodam como authenticated/anon, então ganham EXECUTE (só nesta transação)
create temp table seg6_marco ();
do $$ begin
  execute format('alter default privileges for role postgres in schema %s grant execute on functions to public',
                 pg_my_temp_schema()::regnamespace);
end $$;
create function pg_temp.como(p uuid, aal text default 'aal1') returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), true);
  perform set_config('request.jwt.claims', case when p is null then '' else json_build_object('sub', p, 'role', 'authenticated', 'aal', aal)::text end, true);
  perform set_config('role', case when p is null then 'postgres' else 'authenticated' end, true);
end $f$;
-- sqlstate e mensagem ('ok' se passou)
create function pg_temp.erro(q text) returns text language plpgsql as $f$
begin execute q; return 'ok'; exception when others then return sqlstate || ' ' || sqlerrm; end $f$;
create function pg_temp.u(n int) returns uuid language sql as $f$ select ('b0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $f$;
create function pg_temp.ingresso(id int, tipo int, ev int, dono int) returns void language sql as $f$
  with o as (insert into public.orders (user_id, event_id, status) values (pg_temp.u(dono), pg_temp.u(ev), 'paid') returning id)
  insert into public.tickets (id, order_id, ticket_type_id, event_id, user_id, buyer_name, buyer_email, buyer_cpf, status, created_at)
  select pg_temp.u(ingresso.id), o.id, pg_temp.u(tipo), pg_temp.u(ev), pg_temp.u(dono), 'Comprador ' || dono, 'pessoa' || dono || '@teste.evokaa.invalid',
         '00000000000', 'active', now() - (10000 - ingresso.id) * interval '1 second' from o $f$;
-- perfil com consentimento (gravado como postgres) e rede social cadastrada, sem o 2º aceite
create function pg_temp.consente(g int) returns void language sql as $f$
  insert into public.user_profiles_ext (user_id, temperament, intention, music_style, energy_level, vibe, tags, social_url, education,
    mesa_consent_version, mesa_consent_at)
  values (pg_temp.u(g), 'ambivert', 'fun', 'pop', 'medium', 'Explorador Tranquilo',
    '{"musica": ["samba_pagode"], "idiomas": ["ingles"]}', 'https://instagram.com/pessoa' || g, 'superior', public.mesa_termo_versao(), now()) $f$;
-- chama uma função como "quem" (volta para postgres); guarda a resposta para o teste de vazamento
create table pg_temp.saidas (q text, r text);
create function pg_temp.rpc(quem int, q text) returns jsonb language plpgsql as $f$
declare r jsonb;
begin
  perform pg_temp.como(pg_temp.u(quem));
  execute 'select to_jsonb(' || q || ')' into r;
  perform pg_temp.como(null);
  insert into pg_temp.saidas values (q, r::text);
  return r;
end $f$;
-- o mesmo, com sessão aal2 (moderação exige)
create function pg_temp.rpc2(quem int, q text) returns jsonb language plpgsql as $f$
declare r jsonb;
begin
  perform pg_temp.como(pg_temp.u(quem), 'aal2');
  execute 'select to_jsonb(' || q || ')' into r;
  perform pg_temp.como(null);
  insert into pg_temp.saidas values (q, r::text);
  return r;
end $f$;
create function pg_temp.err2(quem int, q text) returns text language plpgsql as $f$
declare r text;
begin
  perform pg_temp.como(pg_temp.u(quem), 'aal2');
  r := pg_temp.erro('select ' || q);
  perform pg_temp.como(null);
  return r;
end $f$;
-- foto no formato do app (data:image/jpeg;base64)
create function pg_temp.foto(g text) returns text language sql as $f$
  select 'data:image/jpeg;base64,' || encode(convert_to('foto' || g, 'UTF8'), 'base64') $f$;
-- "passaram 30 minutos" desde a última troca
create function pg_temp.passa30(g int) returns void language sql as $f$
  update public.table_members set ultima_troca_em = null where user_id = pg_temp.u(g) $f$;
create function pg_temp.err(quem int, q text) returns text language plpgsql as $f$
declare r text;
begin
  perform pg_temp.como(pg_temp.u(quem));
  r := pg_temp.erro('select ' || q);
  perform pg_temp.como(null);
  return r;
end $f$;
create function pg_temp.mesa_de(g int, ev int) returns int language sql as $f$
  select substring(c.name from '[0-9]+')::int from public.table_members m join public.collective_tables c on c.id = m.table_id
  where m.user_id = pg_temp.u(g) and c.event_id = pg_temp.u(ev) $f$;
create function pg_temp.membro(g int, ev int) returns uuid language sql as $f$
  select m.id from public.table_members m join public.collective_tables c on c.id = m.table_id
  where m.user_id = pg_temp.u(g) and c.event_id = pg_temp.u(ev) $f$;
create function pg_temp.lista_mesa(r jsonb, n int) returns jsonb language sql as $f$
  select x from jsonb_array_elements(r -> 'mesas') x where (x ->> 'numero')::int = n $f$;
create function pg_temp.pessoa(r jsonb, n int, nome text) returns jsonb language sql as $f$
  select p from jsonb_array_elements(pg_temp.lista_mesa(r, n) -> 'pessoas') p where p ->> 'nome' = nome $f$;
create function pg_temp.escolhe(g int, ev int, n int) returns jsonb language sql as $f$
  select pg_temp.rpc(g, format('public.escolher_mesa(%L, %s)', pg_temp.u(ev), coalesce(n::text, 'null'))) $f$;

-- E0. Contas: 1 produtor P, 2 produtor Q, 3 admin (super_admin), 4 admin sem moderate_mesa, 5 equipe
--     de P, 11..40 pessoas
--     (20 sem consentimento; 26..29 nas bordas das faixas de idade; 36 sem foto; 37 sem nome).
--     E=901, E3=903, E4=904, E5=905 e E6=906 de P daqui a 2 dias; E2=902 de P daqui a 1 h. Tipos
--     coletivos 911 a 916. Fotos em base64, aprovadas pelo hash (menos a do 39, pendente).
insert into auth.users (id, email) select pg_temp.u(g), 'pessoa' || g || '@teste.evokaa.invalid' from generate_series(1, 40) g;
insert into public.profiles (id, full_name, birth_date, role, admin_permissions, avatar_url)
select pg_temp.u(g), case g when 37 then ' ' else 'Pessoa' || g || ' Sobrenome' end,
  case g when 26 then current_date - interval '25 years' + interval '1 day' when 27 then current_date - interval '25 years'
    when 28 then current_date - interval '60 years' + interval '1 day' when 29 then current_date - interval '60 years'
    else date '1995-06-15' end,
  case g when 3 then 'admin' when 4 then 'admin' when 1 then 'producer' when 2 then 'producer' else 'user' end,
  case g when 3 then array['super_admin'] when 4 then array['manage_users'] end,
  case g when 36 then null else pg_temp.foto(g::text) end
from generate_series(1, 40) g;
update public.profiles set avatar_moderacao = 'aprovada', avatar_moderacao_hash = public.mesa_foto_hash(avatar_url) where avatar_url is not null and id <> pg_temp.u(39);
insert into public.events (id, producer_id, title, date, time, status, approval_status) values
  (pg_temp.u(901), pg_temp.u(1), 'Evento A2', current_date + 2, '22:00', 'published', 'approved'),
  (pg_temp.u(902), pg_temp.u(1), 'Evento em 1 h', ((now() + interval '1 hour') at time zone 'America/Sao_Paulo')::date,
   ((now() + interval '1 hour') at time zone 'America/Sao_Paulo')::time, 'published', 'approved'),
  (pg_temp.u(903), pg_temp.u(1), 'Evento denúncias', current_date + 2, '21:00', 'published', 'approved'),
  (pg_temp.u(904), pg_temp.u(1), 'Evento avisos', current_date + 2, '21:00', 'published', 'approved'),
  (pg_temp.u(905), pg_temp.u(1), 'Evento sobreposição', current_date + 2, '21:00', 'published', 'approved'),
  (pg_temp.u(906), pg_temp.u(1), 'Evento numeração', current_date + 2, '21:00', 'published', 'approved');
insert into public.ticket_types (id, event_id, name, type, capacity) values
  (pg_temp.u(911), pg_temp.u(901), 'Mesa Tinder', 'coletiva', 100), (pg_temp.u(912), pg_temp.u(902), 'Mesa Tinder', 'coletiva', 100),
  (pg_temp.u(913), pg_temp.u(903), 'Mesa Tinder', 'coletiva', 100), (pg_temp.u(914), pg_temp.u(904), 'Mesa Tinder', 'coletiva', 100),
  (pg_temp.u(915), pg_temp.u(905), 'Mesa Tinder', 'coletiva', 100), (pg_temp.u(916), pg_temp.u(906), 'Mesa Tinder', 'coletiva', 100);
insert into public.team_members (producer_id, user_id) values (pg_temp.u(1), pg_temp.u(5));
do $$ begin
  perform pg_temp.ingresso(2000 + g, 911, 901, g) from generate_series(11, 24) g;
  perform pg_temp.consente(g) from generate_series(11, 35) g where g <> 20;
  perform pg_temp.consente(g) from generate_series(1, 5) g;
end $$;

-- E1. Sem mesa, "Mesa nova" cria a Mesa 1; o 2º vê o 1º (primeiro nome, faixa, foto, etiquetas; sem
--     rede sem o 2º aceite) e entra
do $t$
declare r jsonb; p jsonb;
begin
  assert pg_temp.rpc(11, format('public.mesas_para_escolher(%L)', pg_temp.u(901))) = '{"mesas": []}', 'lista inicial não vazia';
  assert pg_temp.escolhe(11, 901, null) = '{"nome": "Mesa 1", "numero": 1}', 'mesa nova';
  r := pg_temp.rpc(12, format('public.mesas_para_escolher(%L)', pg_temp.u(901)));
  p := pg_temp.pessoa(r, 1, 'Pessoa11');
  assert (pg_temp.lista_mesa(r, 1) ->> 'vagas')::int = 5 and p ->> 'faixa_idade' = '25–34' and p ->> 'foto' like 'data:image/jpeg;base64,%'
     and p -> 'tags' ? 'musica' and p ->> 'perfil' = 'Explorador Tranquilo' and p -> 'rede_social' = 'null' and p ->> 'id' is not null
     and not p ? 'idade', format('cartão do 11: %s', r);
  assert pg_temp.lista_mesa(r, 1) -> 'etiquetas' = 'null', 'etiquetas com 1 pessoa';
  perform pg_temp.escolhe(12, 901, 1);
  assert pg_temp.mesa_de(12, 901) = 1, 'o 12 não entrou';
  raise notice 'E1 OK: Mesa nova; primeiro nome, faixa, foto e etiquetas; sem rede sem o 2º aceite';
end $t$;

-- E2. Sem perfil (sem consentimento) ou sem ingresso: mesas [] e sem escolha
do $t$
begin
  assert pg_temp.rpc(20, format('public.mesas_para_escolher(%L)', pg_temp.u(901))) = '{"mesas": [], "motivo": "sem_perfil"}', '20';
  assert pg_temp.rpc(25, format('public.mesas_para_escolher(%L)', pg_temp.u(901))) = '{"mesas": [], "motivo": "sem_ingresso"}', '25';
  assert pg_temp.err(20, format('public.escolher_mesa(%L, 1)', pg_temp.u(901))) like '22023%termo%', '20 escolheu';
  assert pg_temp.err(25, format('public.escolher_mesa(%L, 1)', pg_temp.u(901))) like '22023%ingresso%', '25 escolheu';
  raise notice 'E2 OK: sem perfil ou sem ingresso, mesas: [] e sem escolha';
end $t$;

-- E3. Etiquetas agregadas com 3 perfis; 6 enchem a mesa; mesa cheia e inexistente: "Mesa indisponível"
do $t$
declare m jsonb;
begin
  perform pg_temp.escolhe(13, 901, 1);
  m := pg_temp.lista_mesa(pg_temp.rpc(14, format('public.mesas_para_escolher(%L)', pg_temp.u(901))), 1);
  assert m -> 'etiquetas' @> '[{"categoria": "musica", "etiqueta": "samba_pagode", "pessoas": 3}]', format('etiquetas: %s', m -> 'etiquetas');
  perform pg_temp.escolhe(g, 901, 1) from generate_series(14, 16) g;
  assert (select status from public.collective_tables where event_id = pg_temp.u(901) and name = 'Mesa 1') = 'full', 'Mesa 1 não ficou full';
  assert pg_temp.err(17, format('public.escolher_mesa(%L, 1)', pg_temp.u(901))) = '22023 Mesa indisponível', 'cheia';
  assert pg_temp.err(17, format('public.escolher_mesa(%L, 99)', pg_temp.u(901))) = '22023 Mesa indisponível', 'inexistente';
  raise notice 'E3 OK: etiquetas com 3; cheia e inexistente dão a mesma resposta';
end $t$;

-- E4. Troca sem limite enquanto há vaga; mesa que fica vazia é apagada; a menos de 2 h, negada
do $t$
begin
  perform pg_temp.escolhe(17, 901, null);                                              -- Mesa 2
  perform pg_temp.escolhe(16, 901, 2);
  perform pg_temp.passa30(16);
  perform pg_temp.escolhe(16, 901, 1);
  perform pg_temp.passa30(16);
  perform pg_temp.escolhe(16, 901, 2);
  assert pg_temp.mesa_de(16, 901) = 2, '3 trocas seguidas falharam';
  perform pg_temp.escolhe(18, 901, null);                                              -- Mesa 3, sozinho
  perform pg_temp.escolhe(18, 901, 2);
  assert not exists (select 1 from public.collective_tables where event_id = pg_temp.u(901) and name = 'Mesa 3'), 'mesa vazia ficou';
  perform pg_temp.ingresso(2100, 912, 902, 11);
  assert pg_temp.err(11, format('public.escolher_mesa(%L, null)', pg_temp.u(902))) = '22023 Escolha e troca de mesa só até 2 h antes do evento', 'a 1 h';
  raise notice 'E4 OK: troca sem limite; mesa vazia apagada; a menos de 2 h negada';
end $t$;

-- E5. Denúncia: grava sem bloquear; repetida devolve ja_denunciado; assédio só com mesma mesa ao mesmo
--     tempo; detalhe sem controle/bidi e até 500
do $t$
begin
  assert pg_temp.rpc(13, format('public.mesa_denunciar(%L, %L, %L)', pg_temp.membro(12, 901), 'assedio', 'Mensagens insistentes')) = '{"ok": true}', '1ª';
  assert pg_temp.rpc(13, format('public.mesa_denunciar(%L, %L, %L)', pg_temp.membro(12, 901), 'assedio', 'de novo')) = '{"ja_denunciado": true}', 'repetida';
  assert (select count(*) from public.mesa_denuncias where denunciante = pg_temp.u(13)) = 1, 'repetida duplicou';
  assert to_regclass('public.mesa_bloqueios') is null, 'tabela de bloqueios existe';
  perform pg_temp.escolhe(13, 901, 2);
  perform pg_temp.escolhe(12, 901, 2);                                                  -- o denunciado pode ir para a mesma mesa
  assert pg_temp.mesa_de(12, 901) = 2, 'denúncia bloqueou';
  assert pg_temp.err(21, format('public.mesa_denunciar(%L, %L)', pg_temp.membro(11, 901), 'assedio')) like '22023 Assédio%', 'assédio sem mesa';
  assert pg_temp.err(21, format('public.mesa_denunciar(%L, %L)', pg_temp.membro(11, 901), 'outro')) = 'ok', 'outro sem mesa barrado';
  -- o 16 esteve na Mesa 1 junto com o 11 (hoje está na 2): pode denunciar assédio do 11
  assert pg_temp.err(16, format('public.mesa_denunciar(%L, %L)', pg_temp.membro(11, 901), 'assedio')) = 'ok', 'assédio de quem esteve na mesa';
  assert (select mesma_mesa from public.mesa_denuncias where denunciante = pg_temp.u(16)), 'mesma_mesa falso';
  assert pg_temp.err(14, format('public.mesa_denunciar(%L, %L)', pg_temp.membro(11, 901), 'antipatia')) like '23514%', 'motivo';
  assert pg_temp.err(14, format('public.mesa_denunciar(%L, %L, %L)', pg_temp.membro(11, 901), 'outro', repeat('x', 501))) like '23514%', '> 500';
  assert pg_temp.err(14, format('public.mesa_denunciar(%L, %L, %L)', pg_temp.membro(11, 901), 'outro', 'a' || chr(8238) || 'b')) like '23514%', 'bidi';
  assert pg_temp.err(14, format('public.mesa_denunciar(%L, %L, %L)', pg_temp.membro(11, 901), 'outro', 'a' || chr(7))) like '23514%', 'controle';
  assert pg_temp.err(14, format('public.mesa_denunciar(%L, %L, %L)', pg_temp.membro(11, 901), 'outro', 'a' || chr(127))) like '23514%', 'DEL';
  assert pg_temp.err(14, format('public.mesa_denunciar(%L, %L, %L)', pg_temp.membro(11, 901), 'outro', 'a' || chr(1564))) like '23514%', 'U+061C';
  assert pg_temp.err(14, format('public.mesa_denunciar(%L, %L, %L)', pg_temp.membro(11, 901), 'outro', 'a' || chr(8207))) like '23514%', 'U+200F';
  assert pg_temp.err(14, format('public.mesa_denunciar(%L, %L, %L)', pg_temp.membro(11, 901), 'outro', 'linha 1' || chr(10) || 'linha 2')) = 'ok', 'quebra de linha barrada';
  assert pg_temp.err(25, format('public.mesa_denunciar(%L, %L)', pg_temp.membro(11, 901), 'outro')) = '22023 Pessoa não encontrada', 'sem ingresso denunciou';
  raise notice 'E5 OK: denúncia sem bloqueio, sem duplicar; assédio só com mesma mesa; detalhe validado';
end $t$;

-- E6. Quem vê as denúncias: o moderador (aal2) tudo; o produtor só depois da triagem, só denunciado,
--     motivo e mesa, e nada contra ele ou a equipe; outros não
do $t$
declare r jsonb;
begin
  perform pg_temp.ingresso(3000 + g, 913, 903, g) from generate_series(31, 35) g;
  perform pg_temp.ingresso(3001, 913, 903, 1);
  perform pg_temp.ingresso(3005, 913, 903, 5);
  perform pg_temp.escolhe(31, 903, null);
  perform pg_temp.escolhe(g, 903, 1) from unnest(array[1, 5, 32]) g;
  perform pg_temp.rpc(32, format('public.mesa_denunciar(%L, %L, %L)', pg_temp.membro(1, 903), 'assedio', 'o produtor'));
  perform pg_temp.rpc(32, format('public.mesa_denunciar(%L, %L)', pg_temp.membro(5, 903), 'outro'));
  perform pg_temp.rpc(32, format('public.mesa_denunciar(%L, %L, %L)', pg_temp.membro(31, 903), 'perfil_falso', 'foto de outra pessoa'));
  -- triagem: antes de o admin liberar, o produtor não vê nada
  assert pg_temp.rpc(1, format('public.mesa_denuncias_do_evento(%L)', pg_temp.u(903))) = '[]', 'produtor viu antes da triagem';
  r := pg_temp.rpc2(3, format('public.mesa_denuncias_do_evento(%L)', pg_temp.u(903)));
  assert jsonb_array_length(r) = 3 and r::text like '%Pessoa1 Sobrenome%' and r::text like '%Pessoa5 Sobrenome%'
     and (select bool_and(x ->> 'denunciante' = 'Pessoa32 Sobrenome' and (x ->> 'mesma_mesa')::boolean and x ->> 'status' = 'aberta') from jsonb_array_elements(r) x)
     and r::text like '%foto de outra pessoa%', format('admin: %s', r);
  -- o admin libera as três; o produtor vê só a que não é contra ele nem contra a equipe
  perform pg_temp.rpc2(3, format('public.mesa_denuncia_liberar(%L)', d.id)) from public.mesa_denuncias d where d.evento = pg_temp.u(903);
  r := pg_temp.rpc(1, format('public.mesa_denuncias_do_evento(%L)', pg_temp.u(903)));
  assert r = '[{"mesa": "Mesa 1", "motivo": "perfil_falso", "denunciado": "Pessoa31 Sobrenome"}]', format('produtor: %s', r);
  assert (select bool_and(table_id is not null and liberada_por = pg_temp.u(3) and liberada_produtor_em is not null and status = 'aberta')
          from public.mesa_denuncias where evento = pg_temp.u(903)), 'table_id/quem liberou';
  -- moderação exige moderate_mesa e aal2, mesmo sem fator cadastrado
  assert pg_temp.err(3, format('public.mesa_denuncias_do_evento(%L)', pg_temp.u(903))) = '42501 Ative o 2FA para moderar', 'aal1 moderou';
  assert pg_temp.err2(4, format('public.mesa_denuncias_do_evento(%L)', pg_temp.u(903))) = '42501 Acesso negado', 'admin sem moderate_mesa';
  assert pg_temp.err(2, format('public.mesa_denuncias_do_evento(%L)', pg_temp.u(903))) like '42501%', 'outro produtor';
  assert pg_temp.err(31, format('public.mesa_denuncias_do_evento(%L)', pg_temp.u(903))) like '42501%', 'comprador';
  raise notice 'E6 OK: triagem do admin; produtor vê só o liberado, nada contra ele ou a equipe; moderação com aal2';
end $t$;

-- E7. Status só pelo moderador (aal2); limpeza: detalhe em 180 dias e denúncia em 3 anos, os dois salvo
--     judicial/em_apuracao
do $t$
declare d1 uuid; d2 uuid; d3 uuid; d4 uuid; apagar text := (select command from cron.job where jobname = 'apagar_mesas_antigas');
begin
  select id into d1 from public.mesa_denuncias where denunciado = pg_temp.u(31);
  select id into d2 from public.mesa_denuncias where denunciado = pg_temp.u(1);
  select id into d3 from public.mesa_denuncias where denunciado = pg_temp.u(5);
  select id into d4 from public.mesa_denuncias where denunciante = pg_temp.u(21);
  assert pg_temp.err(1, format('public.mesa_denuncia_status(%L, %L)', d2, 'judicial')) like '42501%', 'produtor mudou status';
  assert pg_temp.err(3, format('public.mesa_denuncia_status(%L, %L)', d2, 'judicial')) = '42501 Ative o 2FA para moderar', 'aal1 mudou status';
  assert pg_temp.err2(3, format('public.mesa_denuncia_status(%L, %L)', d2, 'arquivada')) like '23514%', 'status fora da lista';
  perform pg_temp.rpc2(3, format('public.mesa_denuncia_status(%L, %L)', d2, 'judicial'));
  perform pg_temp.rpc2(3, format('public.mesa_denuncia_status(%L, %L)', d4, 'em_apuracao'));
  perform pg_temp.rpc2(3, format('public.mesa_denuncia_status(%L, %L)', d1, 'resolvida'));
  assert (select status_mudado_por = pg_temp.u(3) and status_mudado_em is not null from public.mesa_denuncias where id = d1), 'quem mudou';
  assert pg_temp.rpc(1, format('public.mesa_denuncias_do_evento(%L)', pg_temp.u(903)))::text like '%Pessoa31 Sobrenome%', 'produtor perdeu a liberada depois de resolvida';
  update public.mesa_denuncias set evento_em = now() - interval '200 days' where id = d1;
  update public.mesa_denuncias set evento_em = now() - interval '4 years' where id in (d2, d3, d4);
  execute apagar;
  assert (select detalhe is null from public.mesa_denuncias where id = d1), 'detalhe de 200 dias ficou';
  assert (select detalhe = 'o produtor' from public.mesa_denuncias where id = d2), 'apagou detalhe de denúncia judicial';
  assert exists (select 1 from public.mesa_denuncias where id = d4), 'apagou em_apuracao';
  assert not exists (select 1 from public.mesa_denuncias where id = d3), 'não apagou a de 4 anos (liberada ao produtor)';
  assert (select detalhe is not null from public.mesa_denuncias where denunciante = pg_temp.u(13)), 'apagou detalhe recente';
  raise notice 'E7 OK: status só moderador com aal2; 180 dias e 3 anos, salvo em apuração ou judicial';
end $t$;

-- E8. Sair: "Lugar ocupado" para os colegas, sem id; o produtor vê o nome; voltar restaura
do $t$
declare r jsonb; c jsonb;
begin
  perform pg_temp.rpc(14, format('public.mesa_sair(%L)', pg_temp.u(901)));
  r := pg_temp.rpc(11, format('public.minha_mesa(%L)', pg_temp.u(901)));
  select x into c from jsonb_array_elements(r -> 'mesas' -> 0 -> 'colegas') x where x ->> 'nome' = 'Lugar ocupado';
  assert r::text not like '%Pessoa14%' and c -> 'id' = 'null' and c -> 'foto' = 'null', format('lugar ocupado: %s', r);
  assert pg_temp.rpc(1, format('public.mesas_do_evento(%L)', pg_temp.u(901)))::text like '%Pessoa14 Sobrenome%', 'produtor sem o nome';
  assert pg_temp.rpc(14, format('public.mesas_para_escolher(%L)', pg_temp.u(901))) = '{"mesas": [], "motivo": "saiu"}', 'quem saiu lista';
  perform pg_temp.rpc(14, format('public.mesa_voltar(%L)', pg_temp.u(901)));
  assert pg_temp.rpc(11, format('public.minha_mesa(%L)', pg_temp.u(901)))::text like '%Pessoa14%', 'voltar não restaurou';
  raise notice 'E8 OK: sair vira Lugar ocupado; produtor vê o nome; voltar restaura';
end $t$;

-- E9. formar_mesas depois: não mexe em quem escolheu e completa as mesas com vaga antes de abrir outra
--     (Mesa 1 com 3, Mesa 2 com 5; 6 sem mesa: 4 completam as duas e 2 vão para a Mesa 3)
do $t$
declare n int;
begin
  create temp table antes on commit drop as select id, table_id from public.table_members;
  perform pg_temp.como(pg_temp.u(1));
  n := public.formar_mesas(pg_temp.u(901));
  perform pg_temp.como(null);
  assert n = 6, format('alocou %s', n);
  assert (select count(*) from antes a join public.table_members m on m.id = a.id and m.table_id = a.table_id) = (select count(*) from antes),
         'mexeu em quem escolheu';
  assert (select array_agg(public.mesa_ocupados(c.id) order by c.name) from public.collective_tables c where c.event_id = pg_temp.u(901))
         = array[6, 6, 2], format('não completou: %s', (select array_agg(public.mesa_ocupados(c.id) order by c.name)
                                                          from public.collective_tables c where c.event_id = pg_temp.u(901)));
  raise notice 'E9 OK: formar_mesas preserva quem escolheu e completa as mesas com vaga antes de abrir outra';
end $t$;

-- E10. Faixa de idade nas bordas: 24/25 e 59/60
do $t$
declare r jsonb;
begin
  perform pg_temp.ingresso(3000 + g, 913, 903, g) from generate_series(26, 29) g;
  perform pg_temp.escolhe(26, 903, null);                                              -- Mesa 2
  perform pg_temp.escolhe(g, 903, 2) from generate_series(27, 29) g;
  r := pg_temp.rpc(33, format('public.mesas_para_escolher(%L)', pg_temp.u(903)));
  assert pg_temp.pessoa(r, 2, 'Pessoa26') ->> 'faixa_idade' = '18–24' and pg_temp.pessoa(r, 2, 'Pessoa27') ->> 'faixa_idade' = '25–34'
     and pg_temp.pessoa(r, 2, 'Pessoa28') ->> 'faixa_idade' = '45–59' and pg_temp.pessoa(r, 2, 'Pessoa29') ->> 'faixa_idade' = '60+',
         format('faixas: %s', pg_temp.lista_mesa(r, 2));
  raise notice 'E10 OK: faixas 18–24/25–34 e 45–59/60+ nas bordas';
end $t$;

-- E11. Rede social: sem o 2º aceite não aparece; com ele aparece; ocultar e revogar a mesa escondem
do $t$
declare lista text := format('public.mesas_para_escolher(%L)', pg_temp.u(903));
begin
  assert pg_temp.pessoa(pg_temp.rpc(33, lista), 2, 'Pessoa27') -> 'rede_social' = 'null', 'rede sem 2º aceite';
  perform pg_temp.como(pg_temp.u(27));
  assert pg_temp.erro(format('update public.user_profiles_ext set rede_consent_at = now() where user_id = %L', pg_temp.u(27))) like '42501%', 'gravou o aceite direto';
  perform pg_temp.como(null);
  perform pg_temp.rpc(27, 'public.mesa_mostrar_rede()');
  assert pg_temp.pessoa(pg_temp.rpc(33, lista), 2, 'Pessoa27') ->> 'rede_social' = 'https://instagram.com/pessoa27', 'rede com 2º aceite';
  perform pg_temp.rpc(27, 'public.mesa_ocultar_rede()');
  assert pg_temp.pessoa(pg_temp.rpc(33, lista), 2, 'Pessoa27') -> 'rede_social' = 'null', 'rede depois de ocultar';
  perform pg_temp.rpc(27, 'public.mesa_mostrar_rede()');
  perform pg_temp.rpc(27, 'public.mesa_revogar()');
  assert (select rede_consent_revoked_at is not null from public.user_profiles_ext where user_id = pg_temp.u(27)), 'revogar não revogou a rede';
  -- quem revogou deixa de ser mesa_ok: na lista vira "Lugar ocupado", sem rede nem id
  assert pg_temp.pessoa(pg_temp.rpc(33, lista), 2, 'Pessoa27') is null
     and pg_temp.pessoa(pg_temp.rpc(33, lista), 2, 'Lugar ocupado') -> 'rede_social' = 'null'
     and pg_temp.pessoa(pg_temp.rpc(33, lista), 2, 'Lugar ocupado') -> 'id' = 'null', 'rede depois de revogar';
  assert pg_temp.err(20, 'public.mesa_mostrar_rede()') like '22023%', 'rede sem termo da mesa';
  assert (select array_agg(acao order by acao) from public.mesa_consentimentos where user_id = pg_temp.u(27))
         = array['mostrou_rede', 'mostrou_rede', 'ocultou_rede', 'revogou'], 'histórico da rede';
  raise notice 'E11 OK: rede só com o 2º aceite; ocultar e revogar escondem; histórico gravado';
end $t$;

-- E12. mesas_do_evento sem score (RIPD R14); gender, bio e birth_year recusados (R03)
do $t$
begin
  assert not exists (select 1 from jsonb_array_elements(pg_temp.rpc(1, format('public.mesas_do_evento(%L)', pg_temp.u(901)))) x where x ? 'score'), 'score';
  perform pg_temp.como(pg_temp.u(11));
  assert pg_temp.erro(format($q$update public.user_profiles_ext set gender = 'F' where user_id = %L$q$, pg_temp.u(11))) like '23514%', 'gender';
  assert pg_temp.erro(format($q$update public.user_profiles_ext set bio = 'oi' where user_id = %L$q$, pg_temp.u(11))) like '23514%', 'bio';
  assert pg_temp.erro(format($q$update public.user_profiles_ext set birth_year = 1990 where user_id = %L$q$, pg_temp.u(11))) like '23514%', 'birth_year';
  perform pg_temp.como(null);
  raise notice 'E12 OK: sem score; gender, bio e birth_year recusados';
end $t$;

-- E13. Consentir exige nome, 18+ e foto; sem questionário passa e o cartão sai com os opcionais vazios;
--      apagar a foto esconde o perfil
do $t$
declare p jsonb; lista text := format('public.mesas_para_escolher(%L)', pg_temp.u(903));
begin
  assert pg_temp.err(36, format('public.mesa_consentir(%L)', public.mesa_termo_versao())) = '22023 Para participar, adicione sua foto de perfil', 'sem foto';
  assert pg_temp.err(37, format('public.mesa_consentir(%L)', public.mesa_termo_versao())) = '22023 Para participar, adicione seu nome ao perfil', 'sem nome';
  perform pg_temp.rpc(38, format('public.mesa_consentir(%L)', public.mesa_termo_versao()));
  perform pg_temp.ingresso(3038, 913, 903, 38);
  perform pg_temp.escolhe(38, 903, 2);
  p := pg_temp.pessoa(pg_temp.rpc(33, lista), 2, 'Pessoa38');
  assert p ->> 'foto' like 'data:image/jpeg;base64,%' and p ->> 'faixa_idade' = '25–34' and p -> 'perfil' = 'null' and p -> 'tags' = '{}'
     and p -> 'escolaridade' = 'null' and p -> 'rede_social' = 'null', format('sem questionário: %s', p);
  update public.profiles set avatar_url = null where id = pg_temp.u(38);
  -- sem foto: na lista vira "Lugar ocupado" (sem id), como quem não é mesa_ok
  assert pg_temp.pessoa(pg_temp.rpc(33, lista), 2, 'Pessoa38') is null, 'sem foto ainda aparece';
  assert pg_temp.rpc(38, lista) = '{"mesas": [], "motivo": "sem_perfil"}', 'sem foto ainda lista';
  raise notice 'E13 OK: consentir exige nome e foto; opcionais vazios não quebram; sem foto, sem perfil';
end $t$;

-- E14. Moderação: pendente não aparece; aprovada aparece; trocar a foto invalida a aprovação (hash);
--      decisão com hash antigo não faz nada; URL do Storage não vale; ninguém se autoaprova; a fila é
--      só de quem aceitou o termo; aal1 não modera
do $t$
declare p jsonb; r jsonb; h text;
begin
  perform pg_temp.consente(39);
  perform pg_temp.ingresso(3039, 913, 903, 39);
  -- 39 ainda pendente: não é mesa_ok, não escolhe; entra pela formação e aparece só pelo primeiro nome
  assert pg_temp.err(39, format('public.escolher_mesa(%L, 2)', pg_temp.u(903))) like '22023%foto aprovada%', 'pendente escolheu';
  perform public.formar_mesas(pg_temp.u(903));
  perform pg_temp.passa30(33);
  perform pg_temp.escolhe(33, 903, pg_temp.mesa_de(39, 903));
  p := (select x from jsonb_array_elements(pg_temp.rpc(33, format('public.minha_mesa(%L)', pg_temp.u(903))) -> 'mesas' -> 0 -> 'colegas') x
        where x ->> 'nome' = 'Pessoa39');
  assert p is not null and p -> 'foto' = 'null' and p -> 'faixa_idade' = 'null', format('pendente aparece: %s', p);
  -- ninguém se autoaprova (nem pelo hash)
  perform pg_temp.como(pg_temp.u(39));
  assert pg_temp.erro(format($q$update public.profiles set avatar_moderacao = 'aprovada', avatar_moderacao_hash = public.mesa_foto_hash(avatar_url) where id = %L$q$, pg_temp.u(39))) like '42501%', 'autoaprovou';
  perform pg_temp.como(null);
  -- a fila: pendentes e em revisão, no formato do app, de quem aceitou o termo. O 40 aceitou, mas a
  -- foto é URL do Storage: fica fora. O 36 tem foto grande demais (> 60.000): fora também.
  update public.profiles set avatar_url = 'https://rwaezeqyuhxrssntcxdv.supabase.co/storage/v1/object/public/avatars/40.png' where id = pg_temp.u(40);
  perform pg_temp.consente(40);
  update public.profiles set avatar_url = 'data:image/jpeg;base64,' || repeat('A', 60000) where id = pg_temp.u(36);
  perform pg_temp.consente(36);
  r := pg_temp.rpc2(3, 'public.mesa_fotos_para_revisar()');
  assert jsonb_array_length(r) = 1 and r -> 0 ->> 'nome' = 'Pessoa39 Sobrenome'
     and r -> 0 ->> 'hash' = encode(sha256(convert_to(pg_temp.foto('39'), 'UTF8')), 'hex'), format('fila: %s', r);
  assert not public.mesa_foto_formato('data:image/jpeg;base64,' || repeat('A', 60000)) and public.mesa_foto_formato(pg_temp.foto('39')), 'limite de tamanho';
  h := r -> 0 ->> 'hash';
  assert pg_temp.err(39, 'public.mesa_fotos_para_revisar()') like '42501%', 'não admin listou';
  assert pg_temp.err(3, 'public.mesa_fotos_para_revisar()') = '42501 Ative o 2FA para moderar', 'aal1 listou';
  assert pg_temp.err2(33, format('public.mesa_foto_decidir(%L, %L, true)', pg_temp.u(39), h)) like '42501%', 'não admin decidiu';
  -- a foto muda entre a fila e a decisão: o hash antigo não aprova nada
  perform pg_temp.como(pg_temp.u(39));
  update public.profiles set avatar_url = pg_temp.foto('39b') where id = pg_temp.u(39);
  perform pg_temp.como(null);
  assert pg_temp.rpc2(3, format('public.mesa_foto_decidir(%L, %L, true)', pg_temp.u(39), h)) = 'false', 'hash antigo aprovou';
  assert not public.mesa_ok(pg_temp.u(39)), 'aprovado com hash antigo';
  -- com o hash da foto atual, aprova
  assert pg_temp.rpc2(3, format('public.mesa_foto_decidir(%L, %L, true)', pg_temp.u(39), public.mesa_foto_hash(pg_temp.foto('39b')))) = 'true', 'não decidiu';
  assert public.mesa_ok(pg_temp.u(39)), 'aprovada não é mesa_ok';
  -- aprovar de novo não faz nada; revogar a aprovada (com o hash) faz
  assert pg_temp.rpc2(3, format('public.mesa_foto_decidir(%L, %L, true)', pg_temp.u(39), public.mesa_foto_hash(pg_temp.foto('39b')))) = 'false', 'reaprovou';
  assert pg_temp.rpc2(3, format('public.mesa_foto_decidir(%L, %L, false)', pg_temp.u(39), public.mesa_foto_hash(pg_temp.foto('39b')))) = 'true', 'não revogou';
  assert not public.mesa_ok(pg_temp.u(39)) and (select avatar_moderacao = 'recusada' from public.profiles where id = pg_temp.u(39)), 'revogada ainda vale';
  -- trocar a foto volta a pendente e esconde o perfil
  perform pg_temp.como(pg_temp.u(39));
  update public.profiles set avatar_url = pg_temp.foto('39c') where id = pg_temp.u(39);
  perform pg_temp.como(null);
  assert (select avatar_moderacao = 'pendente' and avatar_moderacao_hash is null and avatar_moderado_em is null from public.profiles where id = pg_temp.u(39)), 'troca não voltou a pendente';
  assert not public.mesa_ok(pg_temp.u(39)), 'foto nova sem moderação ainda vale';
  -- URL do Storage (ou qualquer URL) não vale, nem aprovada pelo hash; nem para consentir
  update public.profiles set avatar_moderacao = 'aprovada', avatar_moderacao_hash = public.mesa_foto_hash(avatar_url) where id = pg_temp.u(40);
  assert not public.mesa_ok(pg_temp.u(40)), 'URL do Storage aceita';
  assert pg_temp.err(40, format('public.mesa_consentir(%L)', public.mesa_termo_versao())) = '22023 Para participar, adicione sua foto de perfil', 'consentiu com URL';
  assert pg_temp.err(36, format('public.mesa_consentir(%L)', public.mesa_termo_versao())) = '22023 Para participar, adicione sua foto de perfil', 'consentiu com foto grande';
  raise notice 'E14 OK: sha256; hash antigo não decide; revogar aprovada; URL e foto grande recusadas e fora da fila; sem autoaprovação; aal1 não modera';
end $t$;

-- E15. Ingresso reembolsado: some de minha_mesa, mesas_para_escolher e mesas_do_evento, mas a denúncia
--      continua possível pelas passagens (nos dois sentidos), mesmo depois de formar_mesas tirar a linha
do $t$
declare id32 uuid := pg_temp.membro(32, 903);
begin
  update public.tickets set status = 'refunded' where id = pg_temp.u(3032);
  assert pg_temp.rpc(31, format('public.minha_mesa(%L)', pg_temp.u(903)))::text not like '%Pessoa32%', 'minha_mesa';
  assert pg_temp.rpc(33, format('public.mesas_para_escolher(%L)', pg_temp.u(903)))::text not like '%Pessoa32%', 'lista';
  assert pg_temp.rpc(1, format('public.mesas_do_evento(%L)', pg_temp.u(903)))::text not like '%Pessoa32%', 'produtor';
  perform public.formar_mesas(pg_temp.u(903));
  assert not exists (select 1 from public.table_members where id = id32), 'linha do reembolsado ficou';
  assert pg_temp.rpc(31, format('public.mesa_denunciar(%L, %L)', id32, 'assedio')) = '{"ok": true}', 'não denunciou reembolsado';
  assert pg_temp.rpc(32, format('public.mesa_denunciar(%L, %L)', pg_temp.membro(33, 903), 'outro')) = '{"ok": true}', 'reembolsado não denunciou';
  raise notice 'E15 OK: reembolsado some das listas; a denúncia segue pelas passagens';
end $t$;

-- E18. 30 minutos entre trocas; a 1ª escolha não conta
do $t$
begin
  perform pg_temp.ingresso(4000 + g, 914, 904, g) from generate_series(11, 14) g;
  perform pg_temp.escolhe(11, 904, null);                                              -- 1ª escolha: Mesa 1
  perform pg_temp.escolhe(11, 904, null);                                              -- troca logo em seguida: Mesa 2
  assert pg_temp.err(11, format('public.escolher_mesa(%L, null)', pg_temp.u(904))) = '22023 Espere 30 minutos entre uma troca de mesa e outra', '2ª troca seguida';
  perform pg_temp.passa30(11);
  assert pg_temp.mesa_de(11, 904) = 2, 'preparo';
  raise notice 'E18 OK: 30 min entre trocas; a 1ª escolha não conta';
end $t$;

-- E19. Aviso "entrou alguém na sua mesa": para quem já estava, sem dizer quem; 1 não lido por mesa
do $t$
declare r jsonb;
begin
  perform pg_temp.escolhe(12, 904, 2);
  perform pg_temp.escolhe(13, 904, 2);
  r := (select jsonb_agg(x) from jsonb_array_elements(pg_temp.rpc(11, 'public.meus_avisos_mesa()')) x where x ->> 'evento' = pg_temp.u(904)::text);
  assert jsonb_array_length(r) = 1 and r -> 0 ->> 'mesa' = 'Mesa 2' and not (r -> 0 ->> 'lido')::boolean
     and (select array_agg(k order by k) from jsonb_object_keys(r -> 0) k) = array['criado_em', 'evento', 'id', 'lido', 'mensagem', 'mesa', 'tipo']
     and r -> 0 ->> 'tipo' = 'entrou' and r -> 0 ->> 'mensagem' = 'Entrou alguém na sua mesa'
     and r::text !~ 'Pessoa|Sobrenome', format('aviso: %s', r);
  assert not exists (select 1 from jsonb_array_elements(pg_temp.rpc(12, 'public.meus_avisos_mesa()')) x
                     where x ->> 'evento' = pg_temp.u(904)::text), 'quem entrou junto foi avisado';
  perform pg_temp.rpc(11, 'public.marcar_avisos_lidos()');
  assert (select bool_and((x ->> 'lido')::boolean) from jsonb_array_elements(pg_temp.rpc(11, 'public.meus_avisos_mesa()')) x), 'não marcou';
  raise notice 'E19 OK: aviso sem dizer quem entrou; dedupe; marcar como lido';
end $t$;
do $t$
begin
  perform pg_temp.escolhe(14, 904, 2);
  assert (select count(*) from public.mesa_avisos where user_id = pg_temp.u(11) and evento = pg_temp.u(904) and not lido) = 1, 'novo aviso depois de lido';
  assert (select count(*) from public.mesa_avisos where user_id = pg_temp.u(12) and evento = pg_temp.u(904) and not lido) = 1, 'o 12 não foi avisado';
  raise notice 'E19b OK: entrada seguinte avisa de novo quem já estava';
end $t$;

-- E19c. Aviso não vai para quem foi reembolsado
do $t$
begin
  -- aviso não vai para quem foi reembolsado (a linha ainda está na mesa até formar_mesas)
  perform pg_temp.rpc(g, 'public.marcar_avisos_lidos()') from unnest(array[11, 12]) g;
  update public.tickets set status = 'refunded' where id = pg_temp.u(4012);
  perform pg_temp.ingresso(4015, 914, 904, 15);
  perform pg_temp.escolhe(15, 904, 2);
  assert (select count(*) from public.mesa_avisos where user_id = pg_temp.u(12) and evento = pg_temp.u(904) and not lido) = 0, 'reembolsado avisado';
  assert (select count(*) from public.mesa_avisos where user_id = pg_temp.u(11) and evento = pg_temp.u(904) and not lido) = 1, 'o 11 não foi avisado';
  raise notice 'E19c OK: aviso não vai para quem foi reembolsado';
end $t$;

-- E20. Remoção: produtor (2FA) ou moderador (aal2); motivo da lista ("outro" com detalhe); a pessoa
--      sai, fica travada (não escolhe, não é realocada), recebe o aviso "removido" e minha_mesa diz
--      "travado"; reembolso e recompra continuam travados; quem recebe ingresso transferido não herda;
--      o moderador lista e destrava
do $t$
declare r jsonb; tv uuid;
begin
  -- denúncias contra o 13 (liberada ao produtor) e o 14 (não liberada); sem denúncia ninguém é removido
  insert into public.mesa_denuncias (denunciante, denunciado, evento, evento_em, motivo, mesma_mesa, liberada_produtor_em)
  values (pg_temp.u(11), pg_temp.u(13), pg_temp.u(904), now() + interval '3 days', 'perfil_falso', false, now());
  insert into public.mesa_denuncias (denunciante, denunciado, evento, evento_em, motivo, mesma_mesa)
  values (pg_temp.u(11), pg_temp.u(14), pg_temp.u(904), now() + interval '3 days', 'perfil_falso', false);
  assert pg_temp.err(2, format('public.mesa_remover_membro(%L, %L, %L)', pg_temp.u(904), pg_temp.u(4013), 'outro')) like '42501%', 'outro produtor removeu';
  assert pg_temp.err(11, format('public.mesa_remover_membro(%L, %L, %L)', pg_temp.u(904), pg_temp.u(4013), 'outro')) like '42501%', 'comprador removeu';
  assert pg_temp.err(3, format('public.mesa_remover_membro(%L, %L, %L)', pg_temp.u(904), pg_temp.u(4013), 'denuncia_triada')) = '42501 Ative o 2FA para moderar', 'admin aal1 removeu';
  assert pg_temp.err(1, format('public.mesa_remover_membro(%L, %L, %L)', pg_temp.u(904), pg_temp.u(4013), 'antipatia')) like '23514%', 'motivo fora da lista';
  assert pg_temp.err(1, format('public.mesa_remover_membro(%L, %L, %L)', pg_temp.u(904), pg_temp.u(4013), 'outro')) like '23514%', 'outro sem detalhe';
  assert pg_temp.err(1, format('public.mesa_remover_membro(%L, %L, %L, %L)', pg_temp.u(904), pg_temp.u(4013), 'outro', 'ab')) like '23514%', 'detalhe curto';
  assert pg_temp.err(1, format('public.mesa_remover_membro(%L, %L, %L, %L)', pg_temp.u(904), pg_temp.u(4013), 'outro', 'x' || chr(8238) || 'yz')) like '23514%', 'detalhe com bidi';
  -- sem denúncia neste evento ninguém é removido (produtor ou moderador); denúncia de outro evento não vale
  assert pg_temp.err(1, format('public.mesa_remover_membro(%L, %L, %L)', pg_temp.u(904), pg_temp.u(4015), 'pedido_da_pessoa')) = '22023 Só é possível remover quem tem denúncia neste evento', 'produtor removeu sem denúncia';
  assert pg_temp.err2(3, format('public.mesa_remover_membro(%L, %L, %L)', pg_temp.u(904), pg_temp.u(4015), 'pedido_da_pessoa')) = '22023 Só é possível remover quem tem denúncia neste evento', 'moderador removeu sem denúncia';
  insert into public.mesa_denuncias (denunciante, denunciado, evento, evento_em, motivo, mesma_mesa, liberada_produtor_em)
  values (pg_temp.u(11), pg_temp.u(15), pg_temp.u(903), now() + interval '3 days', 'perfil_falso', false, now());
  assert pg_temp.err(1, format('public.mesa_remover_membro(%L, %L, %L)', pg_temp.u(904), pg_temp.u(4015), 'pedido_da_pessoa')) = '22023 Só é possível remover quem tem denúncia neste evento', 'denúncia de outro evento valeu (produtor)';
  assert pg_temp.err2(3, format('public.mesa_remover_membro(%L, %L, %L)', pg_temp.u(904), pg_temp.u(4015), 'pedido_da_pessoa')) = '22023 Só é possível remover quem tem denúncia neste evento', 'denúncia de outro evento valeu (moderador)';
  -- denúncia não liberada: o produtor não remove; pode_remover só aparece para quem a regra aceita
  assert pg_temp.err(1, format('public.mesa_remover_membro(%L, %L, %L)', pg_temp.u(904), pg_temp.u(4014), 'pedido_da_pessoa')) = '22023 Só é possível remover quem tem denúncia neste evento', 'produtor removeu com denúncia não liberada';
  assert (select bool_or((p ->> 'pode_remover')::boolean) from jsonb_array_elements(pg_temp.rpc(1, format('public.mesas_do_evento(%L)', pg_temp.u(904)))) m,
          jsonb_array_elements(m -> 'membros') p where p ->> 'ingresso' = pg_temp.u(4013)::text), 'pode_remover falso para o 13 (produtor)';
  assert not (select bool_or((p ->> 'pode_remover')::boolean) from jsonb_array_elements(pg_temp.rpc(1, format('public.mesas_do_evento(%L)', pg_temp.u(904)))) m,
          jsonb_array_elements(m -> 'membros') p where p ->> 'ingresso' in (pg_temp.u(4014)::text, pg_temp.u(4015)::text)), 'pode_remover verdadeiro para o 14 ou o 15 (produtor)';
  assert (select bool_or((p ->> 'pode_remover')::boolean) from jsonb_array_elements(pg_temp.rpc2(3, format('public.mesas_do_evento(%L)', pg_temp.u(904)))) m,
          jsonb_array_elements(m -> 'membros') p where p ->> 'ingresso' = pg_temp.u(4014)::text), 'pode_remover falso para o 14 (moderador)';
  perform pg_temp.rpc(1, format('public.mesa_remover_membro(%L, %L, %L)', pg_temp.u(904), pg_temp.u(4013), 'comportamento_no_local'));
  assert pg_temp.mesa_de(13, 904) is null, 'continua na mesa';
  assert exists (select 1 from public.mesa_travas where evento = pg_temp.u(904) and user_id = pg_temp.u(13) and por = pg_temp.u(1)
                 and motivo = 'comportamento_no_local' and destravada_em is null), 'sem registro';
  r := (select jsonb_agg(x) from jsonb_array_elements(pg_temp.rpc(13, 'public.meus_avisos_mesa()')) x where x ->> 'tipo' = 'removido');
  assert jsonb_array_length(r) = 1 and r -> 0 ->> 'mensagem' like 'Você foi retirado da sua mesa pela organização do evento%', format('aviso removido: %s', r);
  assert pg_temp.rpc(13, format('public.minha_mesa(%L)', pg_temp.u(904))) = '{"mesas": [], "travado": true}', 'minha_mesa sem travado';
  assert pg_temp.err(13, format('public.escolher_mesa(%L, null)', pg_temp.u(904))) = '22023 Sua participação nas mesas deste evento foi suspensa pela organização.', 'travado escolheu';
  assert pg_temp.rpc(13, format('public.mesas_para_escolher(%L)', pg_temp.u(904))) = '{"mesas": [], "motivo": "travado"}', 'travado lista';
  perform pg_temp.como(pg_temp.u(1));
  assert public.formar_mesas(pg_temp.u(904)) = 0, 'formar realocou o travado';
  perform pg_temp.como(null);
  -- reembolso e recompra: a trava é da pessoa
  update public.tickets set status = 'refunded' where id = pg_temp.u(4013);
  perform pg_temp.ingresso(4113, 914, 904, 13);
  assert pg_temp.err(13, format('public.escolher_mesa(%L, null)', pg_temp.u(904))) like '22023 Sua participação%', 'recompra destravou';
  perform pg_temp.como(pg_temp.u(1));
  perform public.formar_mesas(pg_temp.u(904));
  perform pg_temp.como(null);
  assert pg_temp.mesa_de(13, 904) is null, 'recompra realocada';
  -- o moderador (aal2) remove o 14; o ingresso vai para o 16, que não herda a trava
  perform pg_temp.rpc2(3, format('public.mesa_remover_membro(%L, %L, %L, %L)', pg_temp.u(904), pg_temp.u(4014), 'outro', 'pedido registrado no local'));
  update public.tickets set user_id = pg_temp.u(16) where id = pg_temp.u(4014);
  assert not public.mesa_travado(pg_temp.u(904), pg_temp.u(16)) and public.mesa_travado(pg_temp.u(904), pg_temp.u(14)), 'trava passou com o ingresso';
  assert pg_temp.rpc(16, format('public.mesas_para_escolher(%L)', pg_temp.u(904))) ? 'mesas'
     and pg_temp.rpc(16, format('public.mesas_para_escolher(%L)', pg_temp.u(904))) ->> 'motivo' is null, 'novo dono travado';
  -- o moderador lista e destrava; o produtor não
  r := pg_temp.rpc2(3, format('public.mesa_travas_do_evento(%L)', pg_temp.u(904)));
  assert jsonb_array_length(r) = 2 and r::text like '%Pessoa13 Sobrenome%' and r::text like '%pedido registrado no local%', format('travas: %s', r);
  assert pg_temp.err2(1, format('public.mesa_travas_do_evento(%L)', pg_temp.u(904))) like '42501%', 'produtor listou travas';
  select id into tv from public.mesa_travas where user_id = pg_temp.u(13) and evento = pg_temp.u(904);
  assert pg_temp.err2(1, format('public.mesa_destravar(%L, %L)', pg_temp.u(904), tv)) like '42501%', 'produtor destravou';
  perform pg_temp.rpc2(3, format('public.mesa_destravar(%L, %L)', pg_temp.u(904), tv));
  assert (select destravada_por = pg_temp.u(3) and destravada_em is not null from public.mesa_travas where id = tv), 'sem registro do destravamento';
  assert pg_temp.err2(3, format('public.mesa_destravar(%L, %L)', pg_temp.u(904), tv)) = '22023 Trava não encontrada', 'destravou 2 vezes';
  assert pg_temp.err(13, format('public.escolher_mesa(%L, null)', pg_temp.u(904))) = 'ok', 'destravado não escolhe';
  raise notice 'E20 OK: remoção com motivo, trava por pessoa, aviso removido, travado em minha_mesa; recompra travada; transferência não herda; destravar';
end $t$;

-- E25. Corrida: em escolher_mesa, a trava por pessoa é conferida depois do pg_advisory_xact_lock, e os
--      30 min antes e depois dele (ordem no código; a corrida com duas sessões não cabe neste bloco)
do $t$
declare f text := pg_get_functiondef('public.escolher_mesa(uuid, int)'::regprocedure);
begin
  assert position('pg_advisory_xact_lock' in f) < position('mesa_travado(p_event_id, v_uid)' in f), 'trava antes do lock';
  assert position('Espere 30 minutos' in f) < position('pg_advisory_xact_lock' in f)
     and position('Espere 30 minutos' in substring(f from position('pg_advisory_xact_lock' in f))) > 0, '30 min só de um lado do lock';
  raise notice 'E25 OK: trava depois do lock; 30 min antes e depois';
end $t$;

-- E26. O moderador denunciado não vê nem decide a denúncia contra ele
do $t$
declare d uuid;
begin
  perform pg_temp.ingresso(3003, 913, 903, 3);
  perform pg_temp.escolhe(3, 903, null);
  assert pg_temp.rpc(31, format('public.mesa_denunciar(%L, %L)', pg_temp.membro(3, 903), 'outro')) = '{"ok": true}', 'não denunciou o moderador';
  select id into d from public.mesa_denuncias where denunciado = pg_temp.u(3);
  assert pg_temp.rpc2(3, format('public.mesa_denuncias_do_evento(%L)', pg_temp.u(903)))::text not like '%' || d || '%', 'moderador vê a denúncia contra ele';
  assert pg_temp.err2(3, format('public.mesa_denuncia_status(%L, %L)', d, 'resolvida')) = '22023 Denúncia não encontrada', 'moderador decidiu a própria';
  assert pg_temp.err2(3, format('public.mesa_denuncia_liberar(%L)', d)) = '22023 Denúncia não encontrada', 'moderador liberou a própria';
  raise notice 'E26 OK: moderador denunciado não vê nem decide';
end $t$;

-- E21. Numeração da 1ª formação: pelo md5 do menor ingresso de cada grupo, não pela ordem de temperamento
do $t$
declare n int;
begin
  perform pg_temp.ingresso(5000 + g, 916, 906, g) from generate_series(11, 23) g;
  update public.user_profiles_ext set temperament = (array['introvert', 'ambivert', 'extrovert'])[g % 3 + 1]
  from generate_series(11, 23) g where user_id = pg_temp.u(g);
  perform pg_temp.como(pg_temp.u(1));
  n := public.formar_mesas(pg_temp.u(906));
  perform pg_temp.como(null);
  assert n = 13, format('alocou %s', n);
  assert (select array_agg(substring(c.name from '[0-9]+')::int order by md5((select min(m.ticket_id::text) from public.table_members m where m.table_id = c.id)))
          from public.collective_tables c where c.event_id = pg_temp.u(906)) = array[1, 2, 3], 'numeração fora do md5';
  raise notice 'E21 OK: mesas numeradas pelo md5 do menor ingresso do grupo';
end $t$;

-- E22. "Mesma mesa" = ao mesmo tempo: quem entrou depois que o outro saiu não denuncia assédio
do $t$
begin
  perform pg_temp.ingresso(6000 + g, 915, 905, g) from generate_series(11, 13) g;
  perform pg_temp.escolhe(11, 905, null);                                              -- Mesa 1: 11
  perform pg_temp.escolhe(13, 905, 1);                                                 -- Mesa 1: 11 e 13
  perform pg_temp.escolhe(11, 905, null);                                              -- 11 vai para a Mesa 2
  perform pg_temp.escolhe(12, 905, 1);                                                 -- 12 chega à Mesa 1 depois
  assert pg_temp.err(12, format('public.mesa_denunciar(%L, %L)', pg_temp.membro(11, 905), 'assedio')) like '22023 Assédio%', 'sem sobreposição passou';
  assert pg_temp.rpc(12, format('public.mesa_denunciar(%L, %L)', pg_temp.membro(13, 905), 'assedio')) = '{"ok": true}', 'com sobreposição barrou';
  assert pg_temp.rpc(13, format('public.mesa_denunciar(%L, %L)', pg_temp.membro(11, 905), 'assedio')) = '{"ok": true}', 'passado junto barrou';
  assert (select bool_and(sobreposicao_inicio is not null and sobreposicao_inicio < sobreposicao_fim and mesma_mesa)
          from public.mesa_denuncias where evento = pg_temp.u(905)), 'sobreposição não gravada';
  -- 13 e 11: juntos da entrada do 13 até a saída do 11
  assert (select d.sobreposicao_fim = (select saiu_em from public.mesa_passagens where user_id = pg_temp.u(11) and evento = pg_temp.u(905) and saiu_em is not null)
          from public.mesa_denuncias d where d.evento = pg_temp.u(905) and d.denunciante = pg_temp.u(13)), 'fim da sobreposição errado';
  raise notice 'E22 OK: assédio só com sobreposição de períodos; período gravado na denúncia';
end $t$;

-- E23. Lista vazia fora da janela (menos de 2 h para o evento)
do $t$
begin
  assert pg_temp.rpc(11, format('public.mesas_para_escolher(%L)', pg_temp.u(902))) = '{"mesas": [], "motivo": "fora_do_prazo"}', 'lista a 1 h';
  raise notice 'E23 OK: lista vazia a menos de 2 h';
end $t$;

-- E24. Limite de 5 denúncias por denunciante em cada evento
do $t$
begin
  perform pg_temp.rpc(11, format('public.mesa_denunciar(%L, %L)', pg_temp.membro(g, 901), 'outro')) from unnest(array[15, 17, 18, 19, 22]) g;
  assert (select count(*) from public.mesa_denuncias where denunciante = pg_temp.u(11) and evento = pg_temp.u(901)) = 5, 'não gravou 5';
  assert pg_temp.err(11, format('public.mesa_denunciar(%L, %L)', pg_temp.membro(23, 901), 'outro')) = '22023 Limite de 5 denúncias por evento', '6ª passou';
  assert pg_temp.rpc(11, format('public.mesa_denunciar(%L, %L)', pg_temp.membro(15, 901), 'outro')) = '{"ja_denunciado": true}', 'repetida no limite';
  raise notice 'E24 OK: limite de 5 denúncias por evento';
end $t$;

-- E27. Conflitos de interesse do moderador (admin 3): não destrava a si mesmo nem vê a própria trava;
--      não aprova a própria foto; como produtor de um evento, não vê nem decide denúncia contra a
--      própria equipe. Remover de novo mantém 1 aviso só. Travado sem perfil recebe "travado".
do $t$
declare r jsonb; tv uuid; d uuid;
begin
  -- o produtor P remove o admin 3 do evento 904
  perform pg_temp.ingresso(4003, 914, 904, 3);
  perform pg_temp.escolhe(3, 904, null);
  insert into public.mesa_denuncias (denunciante, denunciado, evento, evento_em, motivo, mesma_mesa, liberada_produtor_em)
  values (pg_temp.u(11), pg_temp.u(3), pg_temp.u(904), now() + interval '3 days', 'perfil_falso', false, now());
  perform pg_temp.rpc(1, format('public.mesa_remover_membro(%L, %L, %L)', pg_temp.u(904), pg_temp.u(4003), 'pedido_da_pessoa'));
  select id into tv from public.mesa_travas where user_id = pg_temp.u(3) and evento = pg_temp.u(904) and destravada_em is null;
  -- (o nome dele aparece como quem destravou a trava do 13, no E20; aqui conta só a pessoa travada)
  assert not exists (select 1 from jsonb_array_elements(pg_temp.rpc2(3, format('public.mesa_travas_do_evento(%L)', pg_temp.u(904)))) x
                     where x ->> 'pessoa' = 'Pessoa3 Sobrenome'), 'vê a própria trava';
  assert exists (select 1 from jsonb_array_elements(pg_temp.rpc2(3, format('public.mesa_travas_do_evento(%L)', pg_temp.u(904)))) x
                 where x ->> 'pessoa' = 'Pessoa14 Sobrenome'), 'lista vazia';
  assert pg_temp.err2(3, format('public.mesa_destravar(%L, %L)', pg_temp.u(904), tv)) = '22023 Trava não encontrada', 'destravou a si mesmo';
  -- remover de novo (trava vigente, já fora da mesa) não repete o aviso, mesmo depois de lido
  perform pg_temp.rpc(3, 'public.marcar_avisos_lidos()');
  perform pg_temp.rpc(1, format('public.mesa_remover_membro(%L, %L, %L)', pg_temp.u(904), pg_temp.u(4003), 'pedido_da_pessoa'));
  assert (select count(*) from public.mesa_avisos where user_id = pg_temp.u(3) and evento = pg_temp.u(904) and tipo = 'removido') = 1, 'aviso repetido';
  -- o admin 3 troca a própria foto (volta a pendente): não aparece na fila dele nem se aprova
  perform pg_temp.como(pg_temp.u(3));
  update public.profiles set avatar_url = pg_temp.foto('3b') where id = pg_temp.u(3);
  perform pg_temp.como(null);
  assert pg_temp.rpc2(3, 'public.mesa_fotos_para_revisar()')::text not like '%Pessoa3 Sobrenome%', 'própria foto na fila';
  assert pg_temp.rpc2(3, format('public.mesa_foto_decidir(%L, %L, true)', pg_temp.u(3), public.mesa_foto_hash(pg_temp.foto('3b')))) = 'false', 'aprovou a própria foto';
  -- travado e sem perfil (foto pendente): o motivo é "travado"
  assert not public.mesa_ok(pg_temp.u(3)), 'preparo: 3 ainda é mesa_ok';
  assert pg_temp.rpc(3, format('public.mesas_para_escolher(%L)', pg_temp.u(904))) = '{"mesas": [], "motivo": "travado"}', 'travado sem perfil';
  -- o admin 3 produz o evento 907; o 17 é da equipe dele e é denunciado pelo 18
  insert into public.events (id, producer_id, title, date, time, status, approval_status)
  values (pg_temp.u(907), pg_temp.u(3), 'Evento do admin', current_date + 2, '21:00', 'published', 'approved');
  insert into public.ticket_types (id, event_id, name, type, capacity) values (pg_temp.u(917), pg_temp.u(907), 'Mesa Tinder', 'coletiva', 100);
  insert into public.team_members (producer_id, user_id) values (pg_temp.u(3), pg_temp.u(17));
  perform pg_temp.ingresso(7000 + g, 917, 907, g) from generate_series(17, 19) g;
  perform pg_temp.escolhe(17, 907, null);
  perform pg_temp.escolhe(g, 907, 1) from generate_series(18, 19) g;
  perform pg_temp.rpc(18, format('public.mesa_denunciar(%L, %L)', pg_temp.membro(17, 907), 'outro'));
  perform pg_temp.rpc(18, format('public.mesa_denunciar(%L, %L)', pg_temp.membro(19, 907), 'outro'));
  select id into d from public.mesa_denuncias where evento = pg_temp.u(907) and denunciado = pg_temp.u(17);
  r := pg_temp.rpc2(3, format('public.mesa_denuncias_do_evento(%L)', pg_temp.u(907)));
  assert jsonb_array_length(r) = 1 and r -> 0 ->> 'denunciado' = 'Pessoa19 Sobrenome', format('moderador-produtor vê a equipe: %s', r);
  assert pg_temp.err2(3, format('public.mesa_denuncia_status(%L, %L)', d, 'resolvida')) = '22023 Denúncia não encontrada', 'decidiu contra a equipe';
  assert pg_temp.err2(3, format('public.mesa_denuncia_liberar(%L)', d)) = '22023 Denúncia não encontrada', 'liberou contra a equipe';
  raise notice 'E27 OK: moderador não destrava a si mesmo, não aprova a própria foto, não decide contra a própria equipe; 1 aviso só; travado antes de sem_perfil';
end $t$;

-- E28. Moderação automática da foto (Fase E; só service_role): fila com reserva sem duplicidade; fora
--      da fila quem não consentiu, formato inválido ou 3 tentativas; resultado com hash antigo não muda
--      nada (mas registra o custo); aprovada aparece em minha_mesa, recusada não; 3 erros → revisar;
--      revisar vai para o admin com "ia"; trocar a foto zera tentativas e reserva; authenticated não
--      grava as colunas novas; teto diário de 500; EXECUTE só de service_role; cron sem segredo não chama
do $t$
declare r1 jsonb; r2 jsonb; r3 jsonb; u1 uuid[]; u2 uuid[]; ok boolean; i int; p jsonb; r jsonb; n0 bigint;
  m text := 'gemini-3.1-flash-lite'; cron_cmd text := (select command from cron.job where jobname = 'moderar_fotos');
begin
  assert (select schedule from cron.job where jobname = 'moderar_fotos') = '*/2 * * * *', 'cron moderar_fotos';
  update public.ai_settings set enabled = true where id = 1;   -- o interruptor da IA (E29 testa desligado)
  assert has_function_privilege('service_role', 'public.mesa_fotos_para_moderar_auto(int)', 'execute')
     and has_function_privilege('service_role', 'public.mesa_foto_resultado_auto(uuid, text, text, text[], text, int, int)', 'execute')
     and not has_function_privilege('authenticated', 'public.mesa_fotos_para_moderar_auto(int)', 'execute')
     and not has_function_privilege('anon', 'public.mesa_fotos_para_moderar_auto(int)', 'execute')
     and not has_function_privilege('authenticated', 'public.mesa_foto_resultado_auto(uuid, text, text, text[], text, int, int)', 'execute')
     and not has_function_privilege('anon', 'public.mesa_foto_resultado_auto(uuid, text, text, text[], text, int, int)', 'execute')
     and has_function_privilege('service_role', 'public.mesa_moderacao_secret()', 'execute')
     and not has_function_privilege('authenticated', 'public.mesa_moderacao_secret()', 'execute')
     and not has_function_privilege('anon', 'public.mesa_moderacao_secret()', 'execute'), 'EXECUTE';
  assert not exists (select 1 from information_schema.role_table_grants where table_name = 'mesa_moderacoes'
                     and grantee in ('anon', 'authenticated', 'PUBLIC')), 'mesa_moderacoes com grant';
  -- 41..43 e 47: pendentes, no formato e com consentimento; 44 sem consentimento; 45 URL; 46 com 3 tentativas
  insert into auth.users (id, email) select pg_temp.u(g), 'pessoa' || g || '@teste.evokaa.invalid' from generate_series(41, 47) g;
  insert into public.profiles (id, full_name, birth_date, avatar_url)
  select pg_temp.u(g), 'Pessoa' || g || ' Sobrenome', date '1995-06-15',
         case g when 45 then 'https://rwaezeqyuhxrssntcxdv.supabase.co/storage/v1/object/public/avatars/45.png' else pg_temp.foto(g::text) end
  from generate_series(41, 47) g;
  perform pg_temp.consente(g) from generate_series(41, 47) g where g <> 44;
  update public.profiles set avatar_moderacao_tentativas = 3 where id = pg_temp.u(46);
  -- cron sem o segredo no Vault: não chama nada
  select count(*) into n0 from net.http_request_queue;
  execute cron_cmd;
  assert (select count(*) from net.http_request_queue) = n0, 'cron chamou sem segredo';
  -- três rodadas seguidas: nenhuma foto repete
  perform set_config('role', 'service_role', true);
  r1 := public.mesa_fotos_para_moderar_auto(2);
  r2 := public.mesa_fotos_para_moderar_auto(20);
  r3 := public.mesa_fotos_para_moderar_auto(20);
  perform set_config('role', 'postgres', true);
  u1 := array(select (x ->> 'user')::uuid from jsonb_array_elements(r1 -> 'fotos') x);
  u2 := array(select (x ->> 'user')::uuid from jsonb_array_elements(r2 -> 'fotos') x);
  assert r1 ->> 'modelo' = m and cardinality(u1) = 2, format('1ª rodada: %s', r1);
  assert not (u1 && u2) and r3 -> 'fotos' = '[]', 'foto repetida entre rodadas';
  assert array[pg_temp.u(41), pg_temp.u(42), pg_temp.u(43), pg_temp.u(47)] <@ (u1 || u2), 'faltou foto na fila';
  assert not (array[pg_temp.u(44), pg_temp.u(45), pg_temp.u(46), pg_temp.u(36), pg_temp.u(40)] && (u1 || u2)), 'entrou quem não devia';
  assert (select bool_and(x ->> 'hash' = public.mesa_foto_hash(x ->> 'foto') and x ->> 'foto' like 'data:image/jpeg;base64,%')
          from jsonb_array_elements((r1 -> 'fotos') || (r2 -> 'fotos')) x), 'hash ou foto';
  assert (select bool_and(avatar_moderacao_reservada_ate > now()) from public.profiles where id = any(u1 || u2)), 'sem reserva';
  -- resultados
  perform set_config('role', 'service_role', true);
  ok := public.mesa_foto_resultado_auto(pg_temp.u(41), public.mesa_foto_hash(pg_temp.foto('41-antiga')), 'aprovada', '{}', m, 560, 60);
  perform set_config('role', 'postgres', true);
  assert not ok and (select avatar_moderacao = 'pendente' and avatar_moderacao_hash is null and avatar_moderacao_reservada_ate is not null
                     from public.profiles where id = pg_temp.u(41)), 'hash antigo mexeu em profiles';
  perform set_config('role', 'service_role', true);
  ok := public.mesa_foto_resultado_auto(pg_temp.u(41), public.mesa_foto_hash(pg_temp.foto('41')), 'aprovada', '{}', m, 560, 60);
  assert ok, 'aprovada não gravou';
  assert public.mesa_foto_resultado_auto(pg_temp.u(42), public.mesa_foto_hash(pg_temp.foto('42')), 'recusada', '{nudez}', m, 560, 60), 'recusada';
  assert public.mesa_foto_resultado_auto(pg_temp.u(47), public.mesa_foto_hash(pg_temp.foto('47')), 'revisar', '{famoso}', m, 560, 60), 'revisar';
  for i in 1..3 loop
    assert public.mesa_foto_resultado_auto(pg_temp.u(43), public.mesa_foto_hash(pg_temp.foto('43')), 'erro', '{}', m, 0, 0), format('erro %s', i);
  end loop;
  assert pg_temp.erro(format('select public.mesa_foto_resultado_auto(%L, %L, %L, %L, %L, 1, 1)', pg_temp.u(44), 'x', 'aprovada', '{inventado}', m)) like '23514%', 'motivo fora da lista';
  assert pg_temp.erro(format('select public.mesa_foto_resultado_auto(%L, %L, %L, %L, %L, 1, 1)', pg_temp.u(44), 'x', 'talvez', '{}', m)) like '22023%', 'decisão fora da lista';
  perform set_config('role', 'postgres', true);
  assert (select count(*) = 2 and bool_and(custo > 0) from public.mesa_moderacoes where user_id = pg_temp.u(41)), 'custo não registrado';
  assert (select avatar_moderacao = 'aprovada' and avatar_moderacao_hash = public.mesa_foto_hash(avatar_url)
                 and avatar_moderacao_tentativas = 0 and avatar_moderacao_reservada_ate is null
          from public.profiles where id = pg_temp.u(41)), 'aprovada sem zerar';
  assert (select avatar_moderacao = 'revisar' and avatar_moderacao_tentativas = 3 from public.profiles where id = pg_temp.u(43)), '3 erros sem revisar';
  -- aprovada aparece em minha_mesa; recusada não
  insert into public.events (id, producer_id, title, date, time, status, approval_status)
  values (pg_temp.u(908), pg_temp.u(1), 'Evento moderação', current_date + 2, '21:00', 'published', 'approved');
  insert into public.ticket_types (id, event_id, name, type, capacity) values (pg_temp.u(918), pg_temp.u(908), 'Mesa Tinder', 'coletiva', 100);
  perform pg_temp.ingresso(8000 + g, 918, 908, g) from unnest(array[21, 41, 42]) g;
  perform pg_temp.escolhe(21, 908, null);
  perform public.formar_mesas(pg_temp.u(908));
  r := pg_temp.rpc(21, format('public.minha_mesa(%L)', pg_temp.u(908)));
  select x into p from jsonb_array_elements(r -> 'mesas' -> 0 -> 'colegas') x where x ->> 'nome' = 'Pessoa41';
  assert p ->> 'foto' = pg_temp.foto('41'), format('aprovada sem foto: %s', r);
  select x into p from jsonb_array_elements(r -> 'mesas' -> 0 -> 'colegas') x where x ->> 'nome' = 'Pessoa42';
  assert p is not null and p -> 'foto' = 'null', format('recusada com foto: %s', r);
  -- revisar (pela IA ou por 3 erros) vai para o admin, com a última decisão da IA
  r := pg_temp.rpc2(3, 'public.mesa_fotos_para_revisar()');
  assert (select x -> 'ia' ->> 'decisao' = 'revisar' and x -> 'ia' -> 'motivos' = '["famoso"]' from jsonb_array_elements(r) x
          where x ->> 'nome' = 'Pessoa47 Sobrenome'), format('fila do admin (47): %s', r);
  assert (select x -> 'ia' ->> 'decisao' = 'erro' from jsonb_array_elements(r) x where x ->> 'nome' = 'Pessoa43 Sobrenome'), 'fila do admin (43)';
  -- authenticated não grava as colunas novas; trocar a foto zera tentativas e reserva
  perform pg_temp.como(pg_temp.u(43));
  assert pg_temp.erro(format('update public.profiles set avatar_moderacao_tentativas = 0 where id = %L', pg_temp.u(43))) like '42501%', 'gravou tentativas';
  assert pg_temp.erro(format('update public.profiles set avatar_moderacao_reservada_ate = now() where id = %L', pg_temp.u(43))) like '42501%', 'gravou reserva';
  update public.profiles set avatar_url = pg_temp.foto('43b') where id = pg_temp.u(43);
  perform pg_temp.como(pg_temp.u(39));
  update public.profiles set avatar_url = pg_temp.foto('39d') where id = pg_temp.u(39);
  perform pg_temp.como(null);
  assert (select bool_and(avatar_moderacao = 'pendente' and avatar_moderacao_tentativas = 0 and avatar_moderacao_reservada_ate is null)
          from public.profiles where id in (pg_temp.u(43), pg_temp.u(39))), 'trocar a foto não zerou';
  -- teto diário: 500 decisões de "erro" não contam; 500 decisões no dia esvaziam a fila
  insert into public.mesa_moderacoes (user_id, hash, decisao) select pg_temp.u(44), 'x', 'erro' from generate_series(1, 500);
  perform set_config('role', 'service_role', true);
  r := public.mesa_fotos_para_moderar_auto(1);
  perform set_config('role', 'postgres', true);
  assert jsonb_array_length(r -> 'fotos') = 1, 'erros contaram no teto';
  insert into public.mesa_moderacoes (user_id, hash, decisao) select pg_temp.u(44), 'x', 'aprovada' from generate_series(1, 500);
  perform set_config('role', 'service_role', true);
  r := public.mesa_fotos_para_moderar_auto(20);
  perform set_config('role', 'postgres', true);
  assert r -> 'fotos' = '[]', format('teto ignorado: %s', r);
  delete from public.mesa_moderacoes where user_id = pg_temp.u(44) and decisao = 'aprovada';
  perform set_config('role', 'service_role', true);
  r := public.mesa_fotos_para_moderar_auto(20);
  perform set_config('role', 'postgres', true);
  assert jsonb_array_length(r -> 'fotos') >= 1, 'fila não voltou abaixo do teto';
  -- com o segredo no Vault (e foto pendente), o cron chama a Edge Function
  perform set_config('role', 'service_role', true);
  assert public.mesa_moderacao_secret() is null, 'segredo antes de existir';
  perform set_config('role', 'postgres', true);
  perform vault.create_secret('segredo-de-teste-nao-usar', 'mesa_moderacao_secret');
  assert (select count(*) from cron.job where jobname = 'moderar_fotos'
          and command not like '%' || (select decrypted_secret from vault.decrypted_secrets where name = 'mesa_moderacao_secret') || '%') = 1,
         'segredo escrito no cron';
  perform set_config('role', 'service_role', true);
  assert public.mesa_moderacao_secret() = 'segredo-de-teste-nao-usar', 'service_role não lê o segredo';
  perform set_config('role', 'postgres', true);
  assert pg_temp.err(43, 'public.mesa_moderacao_secret()') like '42501%', 'authenticated leu o segredo';
  update public.profiles set avatar_moderacao_reservada_ate = null where avatar_moderacao = 'pendente';  -- reservas vencidas
  execute cron_cmd;
  assert (select count(*) from net.http_request_queue) = n0 + 1, 'cron não chamou com segredo';
  raise notice 'E28 OK: fila com reserva; fora da fila; hash antigo; aprovada/recusada/revisar/3 erros; admin com ia; troca zera; teto; EXECUTE; segredo; cron';
end $t$;

-- E29. Correções da Fase E: contestação da recusa automática (LGPD, art. 20); limite de 5 moderações
--      por pessoa em 24 h; motivos zerados aos 30 dias; interruptor da IA; o cron só chama com foto na fila
do $t$
declare r jsonb; apagar text := (select command from cron.job where jobname = 'apagar_mesas_antigas'); d1 bigint; d2 bigint;
begin
  assert has_function_privilege('authenticated', 'public.mesa_foto_contestar()', 'execute')
     and not has_function_privilege('anon', 'public.mesa_foto_contestar()', 'execute'), 'EXECUTE de mesa_foto_contestar';
  foreach r in array array['"public.mesa_ia_ligada()"', '"public.mesa_foto_na_fila(uuid)"', '"public.mesa_tem_foto_para_moderar()"']::jsonb[] loop
    assert not has_function_privilege('authenticated', r #>> '{}', 'execute') and not has_function_privilege('anon', r #>> '{}', 'execute'), 'aberta: ' || r;
  end loop;
  -- contestar: o 42 foi recusado pela IA (E28): contesta uma vez; vai para revisar e para a fila do admin
  assert pg_temp.rpc(42, 'public.mesa_foto_contestar()') = 'true', 'não contestou';
  assert (select avatar_moderacao = 'revisar' from public.profiles where id = pg_temp.u(42)), 'contestação sem revisar';
  assert pg_temp.rpc(42, 'public.mesa_foto_contestar()') = 'false', 'contestou duas vezes';
  r := pg_temp.rpc2(3, 'public.mesa_fotos_para_revisar()');
  assert (select x -> 'ia' ->> 'decisao' = 'recusada' and x -> 'ia' -> 'motivos' = '["nudez"]' and (x ->> 'contestada')::boolean
          from jsonb_array_elements(r) x where x ->> 'nome' = 'Pessoa42 Sobrenome'), format('fila do admin (42): %s', r);
  -- só recusa da IA: o 41 está aprovado; o 47 foi para revisar pela IA e recusado pelo admin
  assert pg_temp.rpc(41, 'public.mesa_foto_contestar()') = 'false', 'contestou foto aprovada';
  assert pg_temp.rpc2(3, format('public.mesa_foto_decidir(%L, %L, false)', pg_temp.u(47), public.mesa_foto_hash(pg_temp.foto('47')))) = 'true', 'preparo 47';
  assert pg_temp.rpc(47, 'public.mesa_foto_contestar()') = 'false', 'contestou recusa do admin';
  -- limite por pessoa: 5 moderações em 24 h tiram a foto da fila; mais antigas não contam
  update public.profiles set avatar_moderacao_reservada_ate = null where id = pg_temp.u(43);
  assert public.mesa_foto_na_fila(pg_temp.u(43)), 'preparo: 43 fora da fila';
  insert into public.mesa_moderacoes (user_id, hash, decisao, em)
  select pg_temp.u(43), 'h', 'aprovada', now() - interval '1 hour' from generate_series(1, 5);
  assert not public.mesa_foto_na_fila(pg_temp.u(43)), 'passou do limite de 5 por pessoa';
  update public.mesa_moderacoes set em = now() - interval '25 hours' where user_id = pg_temp.u(43) and hash = 'h';
  assert public.mesa_foto_na_fila(pg_temp.u(43)), 'moderação de mais de 24 h contou';
  -- motivos zerados aos 30 dias; decisão e custo ficam
  insert into public.mesa_moderacoes (user_id, hash, decisao, motivos, custo, em)
  values (pg_temp.u(44), 'h30', 'recusada', '{drogas}', 0.001, now() - interval '31 days') returning id into d1;
  insert into public.mesa_moderacoes (user_id, hash, decisao, motivos, custo, em)
  values (pg_temp.u(44), 'h10', 'recusada', '{drogas}', 0.001, now() - interval '10 days') returning id into d2;
  execute apagar;
  assert (select motivos = '{}' and decisao = 'recusada' and custo = 0.001 from public.mesa_moderacoes where id = d1), 'motivos de 31 dias ficaram';
  assert (select motivos = '{drogas}' from public.mesa_moderacoes where id = d2), 'apagou motivos de 10 dias';
  -- interruptor: IA desligada (ou sem linha) esvazia a fila e o cron não chama
  update public.ai_settings set enabled = false where id = 1;
  perform set_config('role', 'service_role', true);
  r := public.mesa_fotos_para_moderar_auto(20);
  perform set_config('role', 'postgres', true);
  assert r -> 'fotos' = '[]' and not public.mesa_tem_foto_para_moderar(), format('IA desligada: %s', r);
  update public.ai_settings set enabled = true where id = 1;
  assert public.mesa_tem_foto_para_moderar(), 'preparo: nada na fila';
  -- só pendente sem consentimento: o cron não chama (as outras pendentes ficam reservadas)
  update public.profiles set avatar_moderacao_reservada_ate = now() + interval '1 hour' where avatar_moderacao = 'pendente';
  update public.profiles set avatar_moderacao_reservada_ate = null where id = pg_temp.u(44);
  assert (select avatar_moderacao = 'pendente' from public.profiles where id = pg_temp.u(44))
     and not public.mesa_tem_foto_para_moderar(), 'pendente sem consentimento conta para o cron';
  raise notice 'E29 OK: contestação (só a própria, só recusa da IA, 1 vez, vai ao admin); limite por pessoa; motivos aos 30 dias; interruptor; cron só com foto na fila';
end $t$;

-- E30. Fase E, últimas correções: A→B→A não dá 2ª contestação do hash A; contestar com a foto trocada
--      não grava nada (e o update vem antes do insert); a foto reservada por último vai para o fim da fila
do $t$
declare r jsonb; f text := pg_get_functiondef('public.mesa_foto_contestar()'::regprocedure);
begin
  -- A→B→A: o 42 já contestou o hash A (E29); a IA recusa A de novo; não há 2ª contestação
  perform pg_temp.como(pg_temp.u(42));
  update public.profiles set avatar_url = pg_temp.foto('42b') where id = pg_temp.u(42);
  update public.profiles set avatar_url = pg_temp.foto('42') where id = pg_temp.u(42);
  perform pg_temp.como(null);
  perform set_config('role', 'service_role', true);
  assert public.mesa_foto_resultado_auto(pg_temp.u(42), public.mesa_foto_hash(pg_temp.foto('42')), 'recusada', '{nudez}',
                                         'gemini-3.1-flash-lite', 560, 60), 'preparo: recusa de A';
  perform set_config('role', 'postgres', true);
  assert pg_temp.rpc(42, 'public.mesa_foto_contestar()') = 'false', '2ª contestação do hash A';
  assert (select count(*) from public.mesa_moderacoes where user_id = pg_temp.u(42) and decisao = 'contestada') = 1, 'contestada gravada de novo';
  assert (select avatar_moderacao = 'recusada' from public.profiles where id = pg_temp.u(42)), 'estado mudou';
  -- foto trocada: a contestação devolve false e não grava "contestada"; no código, o update (que
  -- confere o hash de novo) vem antes do insert
  perform pg_temp.como(pg_temp.u(42));
  update public.profiles set avatar_url = pg_temp.foto('42c') where id = pg_temp.u(42);
  perform pg_temp.como(null);
  assert pg_temp.rpc(42, 'public.mesa_foto_contestar()') = 'false', 'contestou foto trocada';
  assert (select count(*) from public.mesa_moderacoes where user_id = pg_temp.u(42) and decisao = 'contestada') = 1, 'gravou contestada';
  assert position('update public.profiles' in f) < position('insert into public.mesa_moderacoes' in f)
     and f like '%if not found then%', 'insert antes do update';
  -- ordem da fila: nunca reservada antes da reservada há mais tempo (as outras pendentes ficam reservadas)
  insert into auth.users (id, email) select pg_temp.u(g), 'pessoa' || g || '@teste.evokaa.invalid' from generate_series(49, 50) g;
  insert into public.profiles (id, full_name, birth_date, avatar_url)
  select pg_temp.u(g), 'Pessoa' || g || ' Sobrenome', date '1995-06-15', pg_temp.foto(g::text) from generate_series(49, 50) g;
  perform pg_temp.consente(g) from generate_series(49, 50) g;
  update public.profiles set avatar_moderacao_reservada_ate = now() + interval '1 hour'
  where avatar_moderacao = 'pendente' and id not in (pg_temp.u(49), pg_temp.u(50));
  update public.profiles set avatar_moderacao_reservada_ate = now() - interval '1 minute' where id = pg_temp.u(49);
  perform set_config('role', 'service_role', true);
  r := public.mesa_fotos_para_moderar_auto(1);
  assert r -> 'fotos' -> 0 ->> 'user' = pg_temp.u(50)::text, format('a reservada por último veio antes: %s', r -> 'fotos' -> 0 ->> 'user');
  r := public.mesa_fotos_para_moderar_auto(1);
  assert r -> 'fotos' -> 0 ->> 'user' = pg_temp.u(49)::text, 'a reservada por último não veio depois';
  assert public.mesa_fotos_para_moderar_auto(5) -> 'fotos' = '[]', 'reservou de novo';
  perform set_config('role', 'postgres', true);
  raise notice 'E30 OK: A→B→A sem 2ª contestação; foto trocada não contesta; fila com a reservada por último no fim';
end $t$;

-- E16. anon sem EXECUTE; tabela de denúncias sem grant; funções internas fechadas; 2FA
do $t$
declare f text;
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'anon', true);
  foreach f in array array[format('public.mesas_para_escolher(%L)', pg_temp.u(901)), format('public.escolher_mesa(%L, null)', pg_temp.u(901)),
      format('public.mesa_denunciar(%L, %L)', pg_temp.u(1), 'outro'), format('public.mesa_denuncias_do_evento(%L)', pg_temp.u(901)),
      format('public.mesa_denuncia_status(%L, %L)', pg_temp.u(1), 'resolvida'), format('public.mesa_sair(%L)', pg_temp.u(901)),
      format('public.mesa_voltar(%L)', pg_temp.u(901)), 'public.mesa_mostrar_rede()', 'public.mesa_ocultar_rede()',
      'public.mesa_fotos_para_revisar()', format('public.mesa_foto_decidir(%L, %L, true)', pg_temp.u(1), 'x'),
      format('public.mesa_remover_membro(%L, %L, %L)', pg_temp.u(901), pg_temp.u(1), 'outro'), 'public.meus_avisos_mesa()',
      format('public.mesa_denuncia_liberar(%L)', pg_temp.u(1)), format('public.mesa_travas_do_evento(%L)', pg_temp.u(901)),
      format('public.mesa_destravar(%L, %L)', pg_temp.u(901), pg_temp.u(1)),
      'public.marcar_avisos_lidos()'] loop
    assert pg_temp.erro('select ' || f) like '42501%', 'anon executou ' || f;
  end loop;
  perform pg_temp.como(null);
  assert not exists (select 1 from information_schema.role_table_grants
                     where table_name in ('mesa_denuncias', 'mesa_passagens', 'mesa_avisos', 'mesa_travas')
                       and grantee in ('anon', 'authenticated', 'PUBLIC')), 'tabela nova com grant';
  assert pg_temp.err(11, 'count(*) from public.mesa_denuncias') like '42501%', 'authenticated leu denúncias';
  assert pg_temp.err(11, 'count(*) from public.mesa_passagens') like '42501%', 'authenticated leu passagens';
  assert pg_temp.err(11, 'count(*) from public.mesa_avisos') like '42501%', 'authenticated leu avisos';
  assert pg_temp.err(11, 'count(*) from public.mesa_travas') like '42501%', 'authenticated leu travas';
  assert pg_temp.err(11, 'public.mesa_moderador()') like '42501%', 'mesa_moderador aberta';
  assert pg_temp.err(11, format('public.mesa_travado(%L, %L)', pg_temp.u(901), pg_temp.u(11))) like '42501%', 'mesa_travado aberta';
  assert pg_temp.err(11, format('public.mesa_cartao(%L, true, false)', pg_temp.u(12))) like '42501%', 'mesa_cartao aberta';
  assert pg_temp.err(11, format('public.mesa_ocupados(%L)', pg_temp.u(1))) like '42501%', 'mesa_ocupados aberta';
  assert pg_temp.err(11, format('public.mesa_recalcular(%L)', pg_temp.u(1))) like '42501%', 'mesa_recalcular aberta';
  insert into auth.mfa_factors (user_id, status) values (pg_temp.u(12), 'verified');
  perform pg_temp.como(pg_temp.u(12), 'aal1');
  assert pg_temp.erro(format('select public.mesas_para_escolher(%L)', pg_temp.u(901))) like '42501%', 'sem 2FA listou';
  assert pg_temp.erro('select public.mesa_mostrar_rede()') like '42501%', 'sem 2FA mostrou rede';
  perform pg_temp.como(pg_temp.u(12), 'aal2');
  assert pg_temp.erro(format('select public.mesas_para_escolher(%L)', pg_temp.u(901))) = 'ok', 'aal2 barrado';
  perform pg_temp.como(null);
  raise notice 'E16 OK: anon sem EXECUTE; denúncias sem grant; internas fechadas; 2FA';
end $t$;

-- E17. Nenhuma resposta ao participante traz user_id, id de ingresso, e-mail, CPF, nome completo ou
--      idade exata (mesas_do_evento, mesa_denuncias_do_evento e mesa_fotos_para_revisar são do
--      produtor/admin e trazem o nome completo de propósito)
do $t$
begin
  delete from pg_temp.saidas where q ~ '^public\.(mesas_do_evento|mesa_denuncias_do_evento|mesa_fotos_para_revisar|mesa_travas_do_evento)';
  -- ids de usuário (u(1..99)) e de ingresso (u(2000..6999)); o id do evento em meus_avisos_mesa é esperado
  assert (select count(*) from pg_temp.saidas) > 40, 'poucas respostas';
  assert not exists (select 1 from pg_temp.saidas where r ~ '8000-0000000000[0-9]{2}"|8000-00000000[2-6][0-9]{3}"|@|00000000000|user_id|ticket|cpf|email|Sobrenome|"idade"'),
         'vazou: ' || (select r from pg_temp.saidas where r ~ '8000-0000000000[0-9]{2}"|8000-00000000[2-6][0-9]{3}"|@|00000000000|user_id|ticket|cpf|email|Sobrenome|"idade"' limit 1);
  raise notice 'E17 OK: % respostas sem user_id, ingresso, e-mail, CPF, nome completo ou idade exata', (select count(*) from pg_temp.saidas);
end $t$;
rollback;
