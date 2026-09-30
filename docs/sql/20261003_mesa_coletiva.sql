-- =============================================================================
-- Mesa coletiva: formação automática, perfil de mesa e consentimento (PR A) — banco — 2026-10-03
-- Aplicar à mão no SQL Editor do Supabase. NÃO vai para supabase/migrations (Decisão 02).
-- Plano: Claude/Planos/groovy-waddling-wilkinson (PR A).
-- Contrato: o navegador não lê nem escreve collective_tables, table_members e mesa_consentimentos;
-- tudo passa pelas funções formar_mesas (produtor/admin/cron), minha_mesa (participante),
-- mesas_do_evento (produtor/admin), mesa_consentir e mesa_revogar, SECURITY DEFINER, porque a
-- RLS filtra linhas e não colunas.
-- Exposição e afinidade só para quem tem consentimento vigente E 18 anos ou mais (birth_date
-- preenchida): "mesa_ok". Quem não é mesa_ok tem lugar, entra com perfil neutro, aparece só com o
-- primeiro nome e também vê os colegas só pelo primeiro nome (reciprocidade, decisão do Ricardo).
-- O Supabase dá EXECUTE/ALL a anon e authenticated por padrão (default privileges): por isso
-- cada função e tabela tem revoke explícito seguido do grant mínimo (bloco 7).
-- Pré-requisitos (conferidos em 30/09): gf_is_admin, gf_mfa_ok (20260930_2fa_no_banco.sql), pg_cron;
-- table_members vazia (o bloco 3 para com erro se não estiver).
-- Idempotente: pode rodar de novo.
-- ORDEM: aplicar só junto com o PR do front que troca useMatchmaking, YourTable e ProfileQuiz
-- (PR B/C). Antes dele, o questionário que grava "romance" (CHECK do bloco 2) e a tela antiga da
-- mesa (lê table_members direto, sem GRANT depois do bloco 7) dão erro.
-- PENDÊNCIA FASE 4: o gatilho do pedido (mesa_pedido_guard, bloco 3c) reduz, não elimina: dois
-- pedidos pendentes da mesma pessoa passam. Na Fase 4, o create-payment tem de refazer a checagem
-- (incluindo pedidos pagos do evento) e o estorno no webhook ao receber 22023 de mesa_idade_guard
-- é obrigatório.
-- Mesa Tinder (decisão do Ricardo, 30/09): só maiores de 18, 1 cadeira por ingresso e 1 ingresso
-- coletivo por conta em cada evento; quem tem menor no grupo compra mesa normal.
-- =============================================================================
begin;

-- 1. Etiquetas: lista fechada por categoria, até 8 por categoria, sem repetir.
--    Espelhar em app/src/lib/mesaTags.ts (mesmos slugs):
--    musica:   sertanejo, funk, rock, pop, eletronica, mpb, samba_pagode, forro, rap_trap,
--              jazz_blues, indie, reggae, kpop
--    comida:   brasileira, churrasco, japonesa, italiana, mexicana, arabe, chinesa, nordestina,
--              hamburguer, pizza, frutos_do_mar, doces, boteco
--    passeios: praia, trilha, cachoeira, parque, museu, teatro, cinema, show, balada, barzinho,
--              feira, stand_up
--    viagem:   praia, serra, campo, cidade_grande, exterior, mochilao, cruzeiro, estrada,
--              ecoturismo, gastronomica, festivais
--    filmes:   acao, comedia, drama, terror, suspense, ficcao_cientifica, romance, animacao,
--              documentario, fantasia, policial, musical, series
--    idiomas:  ingles, espanhol, frances, italiano, alemao, japones, mandarim, coreano, russo
--    hobbies:  academia, corrida, futebol, ciclismo, games, leitura, fotografia, culinaria, danca,
--              tocar_instrumento, desenho_pintura, jardinagem, pets, jogos_de_tabuleiro
--    Fora de propósito (LGPD art. 5º, II): gospel, vegetariana/vegana, yoga/meditação,
--    voluntariado e libras, que podem indicar religião, saúde ou deficiência.
create or replace function public.mesa_tags_ok(p jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p) = 'object' and not exists (
    select 1
    from jsonb_each(p) e
    left join (values
      ('musica', array['sertanejo', 'funk', 'rock', 'pop', 'eletronica', 'mpb', 'samba_pagode', 'forro',
                       'rap_trap', 'jazz_blues', 'indie', 'reggae', 'kpop']),
      ('comida', array['brasileira', 'churrasco', 'japonesa', 'italiana', 'mexicana', 'arabe', 'chinesa',
                       'nordestina', 'hamburguer', 'pizza', 'frutos_do_mar', 'doces', 'boteco']),
      ('passeios', array['praia', 'trilha', 'cachoeira', 'parque', 'museu', 'teatro', 'cinema', 'show',
                         'balada', 'barzinho', 'feira', 'stand_up']),
      ('viagem', array['praia', 'serra', 'campo', 'cidade_grande', 'exterior', 'mochilao', 'cruzeiro',
                       'estrada', 'ecoturismo', 'gastronomica', 'festivais']),
      ('filmes', array['acao', 'comedia', 'drama', 'terror', 'suspense', 'ficcao_cientifica', 'romance',
                       'animacao', 'documentario', 'fantasia', 'policial', 'musical', 'series']),
      ('idiomas', array['ingles', 'espanhol', 'frances', 'italiano', 'alemao', 'japones', 'mandarim',
                        'coreano', 'russo']),
      ('hobbies', array['academia', 'corrida', 'futebol', 'ciclismo', 'games', 'leitura', 'fotografia',
                        'culinaria', 'danca', 'tocar_instrumento', 'desenho_pintura', 'jardinagem', 'pets',
                        'jogos_de_tabuleiro'])
    ) l(cat, ok) on l.cat = e.key
    where l.cat is null
       -- case: jsonb_array_length em valor que não é array daria erro em vez de "inválido"
       or case when jsonb_typeof(e.value) <> 'array' then true
          else jsonb_array_length(e.value) > 8
            or exists (select 1 from jsonb_array_elements(e.value) x(v)
                       where jsonb_typeof(x.v) <> 'string' or not (x.v #>> '{}') = any(l.ok))
            or (select count(distinct x.v) from jsonb_array_elements(e.value) x(v)) <> jsonb_array_length(e.value)
          end
  );
$$;


-- 2. Perfil de mesa e consentimento em user_profiles_ext (a policy do dono já cobre as colunas novas).
--    A idade vem de profiles.birth_date. Drop + add da constraint: rodar de novo revalida as linhas.
alter table public.user_profiles_ext
  add column if not exists social_url text,
  add column if not exists tags jsonb default '{}'::jsonb,
  add column if not exists education text,
  add column if not exists mesa_consent_version text,
  add column if not exists mesa_consent_at timestamptz,
  add column if not exists mesa_consent_revoked_at timestamptz;

-- https:// em minúsculas e caminho só com caracteres de URL comum (o front normaliza antes)
alter table public.user_profiles_ext drop constraint if exists user_profiles_ext_social_url_chk;
alter table public.user_profiles_ext add constraint user_profiles_ext_social_url_chk check (
  social_url ~ '^https://(www\.)?(instagram\.com|tiktok\.com|x\.com|twitter\.com|linkedin\.com)/[A-Za-z0-9._~@/-]{1,100}$');

alter table public.user_profiles_ext drop constraint if exists user_profiles_ext_tags_chk;
alter table public.user_profiles_ext add constraint user_profiles_ext_tags_chk check (public.mesa_tags_ok(tags));

alter table public.user_profiles_ext drop constraint if exists user_profiles_ext_education_chk;
alter table public.user_profiles_ext add constraint user_profiles_ext_education_chk check (
  education in ('fundamental', 'medio', 'tecnico', 'superior_cursando', 'superior', 'pos'));

-- vibe: só os nomes que generateVibe (app/src/hooks/useMatchmaking.ts) produz
alter table public.user_profiles_ext drop constraint if exists user_profiles_ext_vibe_chk;
alter table public.user_profiles_ext add constraint user_profiles_ext_vibe_chk check (vibe in (
  'Observador', 'Contemplador', 'Filósofo', 'Curioso', 'Explorador Tranquilo', 'Analista',
  'Dinâmico Reservado', 'Energia Contida', 'Fogo Interior', 'Social Leve', 'Conector Calmo',
  'Anfitrião Discreto', 'Animador', 'Centro das Atenções', 'Contagiante', 'Turbilhão', 'Furacão Social',
  'Estrela Cadente', 'Equilibrado', 'Adaptável', 'Camaleão', 'Versátil', 'Multifacetado', 'Tudo-em-Um',
  'Explosão Controlada', 'Dinamite Social', 'Supernova'));

-- "Romance" saiu do questionário (plano: não coletar dado sensível); 0 linhas em produção (30/09)
alter table public.user_profiles_ext drop constraint if exists user_profiles_ext_intention_chk;
alter table public.user_profiles_ext add constraint user_profiles_ext_intention_chk check (intention is distinct from 'romance');

-- 2b. Histórico do consentimento (prova do aceite e da revogação). Só as funções do bloco 6 gravam.
create table if not exists public.mesa_consentimentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  versao text,
  acao text not null check (acao in ('consentiu', 'revogou')),
  em timestamptz not null default now()
);
create index if not exists mesa_consentimentos_user_idx on public.mesa_consentimentos (user_id);
alter table public.mesa_consentimentos enable row level security;

-- 2c. As colunas mesa_consent_* só mudam pelas funções (que rodam como o dono, não como anon/authenticated).
--     current_user, e não o JWT: é o papel que de fato executa o comando.
create or replace function public.mesa_consent_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') and (
       (tg_op = 'INSERT' and (new.mesa_consent_version is not null or new.mesa_consent_at is not null
                              or new.mesa_consent_revoked_at is not null))
    or (tg_op = 'UPDATE' and (new.mesa_consent_version is distinct from old.mesa_consent_version
                              or new.mesa_consent_at is distinct from old.mesa_consent_at
                              or new.mesa_consent_revoked_at is distinct from old.mesa_consent_revoked_at))) then
    raise exception 'Consentimento da mesa só por mesa_consentir/mesa_revogar' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists mesa_consent_guard on public.user_profiles_ext;
create trigger mesa_consent_guard before insert or update on public.user_profiles_ext
  for each row execute function public.mesa_consent_guard();

-- 3. Um lugar por ingresso: ticket_id é o que torna formar_mesas idempotente.
--    NOT NULL direto porque table_members está vazia em produção (conferido em 30/09); se não
--    estiver, para aqui (linha sem ingresso não tem como ganhar ticket_id).
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'table_members' and column_name = 'ticket_id') then
    if exists (select 1 from public.table_members) then
      raise exception 'table_members tem linhas sem ingresso: apague-as (ou atribua o ticket_id) antes de aplicar este arquivo';
    end if;
    alter table public.table_members
      add column ticket_id uuid not null unique references public.tickets(id) on delete cascade;
  end if;
end $$;

-- 3b. Mesa coletiva só para maiores de 18, com data de nascimento, e 1 por conta em cada evento
--     (regras do Ricardo, 30/09).
--     Regra de negócio, não de permissão: vale para todos, inclusive service_role e o webhook de
--     pagamento. Checa na criação, na troca de tipo ou de dono e na volta para active/used
--     (reativação); check-in, cancelamento e reembolso passam direto. Ingressos coletivos
--     existentes: 0 em produção (30/09), nada a revisar.
--     ponytail: quem já tem ingresso coletivo ainda pode trocar profiles.birth_date para uma data de
--     menor depois da compra (burla). formar_mesas deixa essa pessoa fora da mesa com aviso e
--     mesa_ok a fecha; travar a troca fica para o fluxo do perfil (profiles é de outro fluxo).
create or replace function public.mesa_idade_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evento uuid;
begin
  -- check-in, cancelamento e outras trocas de status: nada a checar; só a volta para active/used
  if tg_op = 'UPDATE' and new.ticket_type_id is not distinct from old.ticket_type_id
     and new.user_id is not distinct from old.user_id
     and (new.status not in ('active', 'used') or old.status in ('active', 'used')) then
    return new;
  end if;
  select tt.event_id into v_evento from public.ticket_types tt where tt.id = new.ticket_type_id and tt.type = 'coletiva';
  if not found then
    return new;
  end if;
  -- dois webhooks ao mesmo tempo para a mesma pessoa e evento: um espera o outro (até o commit)
  perform pg_advisory_xact_lock(hashtext('mesa_conta:' || new.user_id || ':' || v_evento));
  if not exists (select 1 from public.profiles p
                 where p.id = new.user_id and p.birth_date <= current_date - interval '18 years') then
    raise exception 'Mesa coletiva: informe sua data de nascimento (só maiores de 18)' using errcode = '22023';
  end if;
  if exists (select 1 from public.tickets t
             join public.ticket_types tt on tt.id = t.ticket_type_id
             where t.user_id = new.user_id and tt.event_id = v_evento and tt.type = 'coletiva'
               and t.status in ('active', 'used') and t.id <> new.id) then
    raise exception 'Mesa Tinder: 1 lugar por conta em cada evento' using errcode = '22023';
  end if;
  return new;
end;
$$;
drop trigger if exists mesa_idade_guard on public.tickets;
create trigger mesa_idade_guard before insert or update of ticket_type_id, user_id, status on public.tickets
  for each row execute function public.mesa_idade_guard();

-- 3c. As mesmas regras no pedido, antes da cobrança: 1 lugar por item, comprador maior de 18 com
--     data de nascimento, 1 item coletivo por pedido e nenhum ingresso coletivo já ativo no evento.
create or replace function public.mesa_pedido_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evento uuid;
  v_user uuid;
begin
  select tt.event_id into v_evento from public.ticket_types tt where tt.id = new.ticket_type_id and tt.type = 'coletiva';
  if not found then
    return new;
  end if;
  if new.quantity is distinct from 1 then
    raise exception 'Mesa Tinder: 1 lugar por conta em cada evento (quantidade deve ser 1)' using errcode = '22023';
  end if;
  select o.user_id into v_user from public.orders o where o.id = new.order_id;
  perform pg_advisory_xact_lock(hashtext('mesa_conta:' || v_user || ':' || v_evento));
  if not exists (select 1 from public.profiles p
                 where p.id = v_user and p.birth_date <= current_date - interval '18 years') then
    raise exception 'Mesa coletiva: informe sua data de nascimento (só maiores de 18)' using errcode = '22023';
  end if;
  if exists (select 1 from public.order_items oi
             join public.ticket_types tt on tt.id = oi.ticket_type_id
             where oi.order_id = new.order_id and tt.type = 'coletiva' and oi.id is distinct from new.id) then
    raise exception 'Mesa Tinder: 1 lugar por conta em cada evento (o pedido já tem uma mesa coletiva)' using errcode = '22023';
  end if;
  if exists (select 1 from public.tickets t
             join public.ticket_types tt on tt.id = t.ticket_type_id
             where t.user_id = v_user and tt.event_id = v_evento and tt.type = 'coletiva'
               and t.status in ('active', 'used')) then
    raise exception 'Mesa Tinder: 1 lugar por conta em cada evento (você já tem um nesta mesa coletiva)' using errcode = '22023';
  end if;
  return new;
end;
$$;
drop trigger if exists mesa_pedido_guard on public.order_items;
create trigger mesa_pedido_guard before insert or update of ticket_type_id, quantity, order_id on public.order_items
  for each row execute function public.mesa_pedido_guard();

-- 3c'. Tipo de ingresso não vira nem deixa de ser coletiva depois de vendido: as regras acima
--      valeriam só para parte dos ingressos (e as mesas ficariam sem dono ou com quem não passou nelas).
create or replace function public.mesa_tipo_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (old.type = 'coletiva') is distinct from (new.type = 'coletiva')
     and (exists (select 1 from public.order_items oi where oi.ticket_type_id = old.id)
          or exists (select 1 from public.tickets t where t.ticket_type_id = old.id)) then
    raise exception 'Não dá para mudar para/de Mesa Tinder depois de vender' using errcode = '22023';
  end if;
  return new;
end;
$$;
drop trigger if exists mesa_tipo_guard on public.ticket_types;
create trigger mesa_tipo_guard before update of type on public.ticket_types
  for each row execute function public.mesa_tipo_guard();

-- 3d. Defesa: objetos de versões antigas da mesa (não existem em produção, conferido em 30/09),
--     que exporiam perfis e membros ou criariam mesa fora de formar_mesas.
drop policy if exists "Perfis ext visiveis por membros da mesma mesa" on public.user_profiles_ext;
drop policy if exists "Membros visiveis por participantes da mesma mesa" on public.table_members;
drop trigger if exists trg_collective_ticket on public.tickets;
drop function if exists public.handle_collective_ticket_insert();

-- A view antiga não é lida por ninguém que continue (useCollectiveTables sai no PR C); ela também
-- impediria a troca de tipo abaixo.
drop view if exists public.collective_table_summary;
-- numeric(3,1) de produção não comporta 100.0
alter table public.collective_tables alter column compatibility_score type numeric(4,1);

-- 4. Apoio -------------------------------------------------------------------------

-- 4a. Momento do evento. events.date nunca é nulo hoje; start_date tem DEFAULT now() e em parte dos
--     eventos guarda o dia da criação, por isso só vale quando date falta.
create or replace function public.evento_momento(e public.events)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select coalesce((e.date + coalesce(e.time, '00:00'::time)) at time zone 'America/Sao_Paulo', e.start_date);
$$;

-- 4b. Versão vigente do termo da mesa (MESA_TERM_VERSION no front). Trocar aqui derruba os
--     consentimentos antigos: quem aceitou outra versão volta a aparecer só pelo primeiro nome.
create or replace function public.mesa_termo_versao()
returns text
language sql
immutable
set search_path = ''
as $$ select '2026-10-03' $$;

-- 4b'. mesa_ok: consentimento vigente (versão atual, não revogado) e 18 anos ou mais. Sem
--     birth_date, não. Com o gatilho mesa_idade_guard (bloco 3b), menor nem chega à mesa; o 18+
--     aqui fica como defesa.
create or replace function public.mesa_ok(p_user uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_profiles_ext x
    join public.profiles p on p.id = x.user_id
    where x.user_id = p_user
      and x.mesa_consent_at is not null and x.mesa_consent_revoked_at is null
      and x.mesa_consent_version = public.mesa_termo_versao()
      and p.birth_date <= current_date - interval '18 years');
$$;

-- 4c. mesa_perfil: o que a formação usa de uma pessoa; nulo se não for mesa_ok.
--     Uso interno (sem EXECUTE para anon/authenticated): devolve temperamento e intenção.
create or replace function public.mesa_perfil(p_user uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'temperament', coalesce(x.temperament, 'ambivert'),
    'energy_level', coalesce(x.energy_level, 'medium'),
    'intention', x.intention,
    'music_style', x.music_style,
    'tags', coalesce(x.tags, '{}'::jsonb))
  from public.user_profiles_ext x
  where x.user_id = p_user and public.mesa_ok(p_user);
$$;

-- 4d. mesa_compat: calculateCompatibility (useMatchmaking.ts) portada, 0 a 100.
--     Base 50; temperamento até 30; intenção 20/10; música 20/10; energia até 20.
--     Os 10 pontos do gênero viraram 10 × Jaccard das etiquetas (gênero não entra na afinidade).
create or replace function public.mesa_compat(a jsonb, b jsonb)
returns numeric
language sql
immutable
set search_path = ''
as $$
  with v as (
    select array_position(array['introvert', 'ambivert', 'extrovert'], a ->> 'temperament') ta,
           array_position(array['introvert', 'ambivert', 'extrovert'], b ->> 'temperament') tb,
           array_position(array['low', 'medium', 'high'], a ->> 'energy_level') ea,
           array_position(array['low', 'medium', 'high'], b ->> 'energy_level') eb,
           a ->> 'intention' ia, b ->> 'intention' ib,
           a ->> 'music_style' ma, b ->> 'music_style' mb
  ),
  xa as (select e.key || ':' || x.v t from jsonb_each(coalesce(a -> 'tags', '{}')) e, jsonb_array_elements_text(e.value) x(v)),
  xb as (select e.key || ':' || x.v t from jsonb_each(coalesce(b -> 'tags', '{}')) e, jsonb_array_elements_text(e.value) x(v))
  select greatest(0, least(100, 50
    + coalesce((2 - abs(ta - tb)) * 15, 0)
    + case when ia = ib then 20
           when ('{"network": ["fun", "experience"], "fun": ["network", "experience"],
                   "experience": ["network", "fun"]}'::jsonb -> ia) ? ib then 10 else 0 end
    + case when ma = mb then 20
           when ('{"eletronica": ["indie", "hiphop"], "rock": ["indie", "pop"], "pop": ["rock", "indie", "hiphop"],
                   "sertanejo": ["pop"], "jazz": ["indie"], "hiphop": ["eletronica", "pop"],
                   "indie": ["rock", "eletronica", "jazz"]}'::jsonb -> ma) ? mb then 10 else 0 end
    + coalesce((2 - abs(ea - eb)) * 10, 0)
    + 10 * coalesce((select count(*) from (select t from xa intersect select t from xb) i)::numeric
                    / nullif((select count(*) from (select t from xa union select t from xb) u), 0), 0)
  ))::numeric
  from v;
$$;

-- 5. Funções da mesa ------------------------------------------------------------------

-- 5a. formar_mesas: aloca quem tem ingresso coletivo (active/used) e ainda não tem lugar; tira quem
--     deixou de ter. Devolve quantas pessoas entraram nesta chamada. Rodar de novo sem mudança nos
--     ingressos não muda nada. Cada tipo de ingresso coletivo tem as próprias mesas; a numeração
--     "Mesa N" é única no evento e nunca se repete (mesa que esvazia fica aberta até a limpeza).
--     Com usuário logado: 2FA e produtor do evento ou admin. Sem usuário: só o cron/SQL Editor
--     (sessão postgres ou supabase_admin; o pg_cron conecta com o usuário que agendou o job).
create or replace function public.formar_mesas(p_event_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_tipo uuid;
  v_primeira boolean;
  v_ids uuid[];
  v_ticket uuid;
  v_mesa uuid;
  v_k int;
  v_prox int;
  v_mudou uuid[] := '{}';
  v_total int := 0;
  v_fora uuid[];
begin
  if v_uid is null then
    if session_user not in ('postgres', 'supabase_admin') then
      raise exception 'Acesso negado' using errcode = '42501';
    end if;
  elsif not public.gf_mfa_ok()
     or (not exists (select 1 from public.events e where e.id = p_event_id and e.producer_id = v_uid)
         and not public.gf_is_admin()) then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  -- cron e botão do produtor ao mesmo tempo: um espera o outro
  perform pg_advisory_xact_lock(hashtext('formar_mesas:' || p_event_id));

  -- Saídas: ingresso cancelado, reembolsado ou transferido (status ou só troca de dono) libera o
  -- lugar (a mesa fica); o novo dono entra como candidato logo abaixo
  with sai as (
    delete from public.table_members m
    using public.tickets t, public.collective_tables c
    where t.id = m.ticket_id and c.id = m.table_id and c.event_id = p_event_id
      and (t.status not in ('active', 'used') or t.user_id is distinct from m.user_id)
    returning m.table_id
  )
  select v_mudou || coalesce(array_agg(distinct sai.table_id), '{}') into v_mudou from sai;

  select coalesce(max(substring(c.name from '[0-9]+')::int), 0) + 1 into v_prox
  from public.collective_tables c where c.event_id = p_event_id;

  for v_tipo in
    select tt.id from public.ticket_types tt
    where tt.event_id = p_event_id and tt.type = 'coletiva' order by tt.id
  loop
    v_primeira := not exists (select 1 from public.collective_tables c where c.ticket_type_id = v_tipo);
    -- Candidatos. Na primeira formação, em ordem de afinidade (quem não é mesa_ok, perfil neutro);
    -- depois, por ordem de compra.
    select array_agg(t.id order by
             case when v_primeira then array_position(array['introvert', 'ambivert', 'extrovert'], x.p ->> 'temperament') end,
             case when v_primeira then array_position(array['low', 'medium', 'high'], x.p ->> 'energy_level') end,
             case when v_primeira then x.p ->> 'intention' end,
             case when v_primeira then x.p ->> 'music_style' end,
             t.created_at, t.id)
      into v_ids
    from public.tickets t
    cross join lateral (select coalesce(public.mesa_perfil(t.user_id),
                                        '{"temperament": "ambivert", "energy_level": "medium"}'::jsonb) p) x
    join public.profiles pr on pr.id = t.user_id
    where t.ticket_type_id = v_tipo and t.event_id = p_event_id and t.status in ('active', 'used')
      and pr.birth_date <= current_date - interval '18 years'
      and not exists (select 1 from public.table_members m where m.ticket_id = t.id);
    -- Defesa além do gatilho mesa_idade_guard: menor ou sem data de nascimento fica fora e é avisado
    -- (só os ids dos ingressos no log, nenhum dado pessoal)
    select array_agg(t.id order by t.id) into v_fora
    from public.tickets t
    left join public.profiles pr on pr.id = t.user_id
    where t.ticket_type_id = v_tipo and t.event_id = p_event_id and t.status in ('active', 'used')
      and (pr.birth_date is null or pr.birth_date > current_date - interval '18 years')
      and not exists (select 1 from public.table_members m where m.ticket_id = t.id);
    if v_fora is not null then
      raise warning 'formar_mesas(%): % ingresso(s) de menor ou sem data de nascimento fora da mesa: %',
        p_event_id, cardinality(v_fora), v_fora;
    end if;
    continue when v_ids is null;
    v_total := v_total + cardinality(v_ids);

    if v_primeira then
      -- ntile sobre a fila ordenada: grupos parecidos e equilibrados (13 → 5/4/4)
      v_k := ceil(cardinality(v_ids) / 6.0);
      with mesas as (
        insert into public.collective_tables (event_id, ticket_type_id, name, capacity, status)
        select p_event_id, v_tipo, 'Mesa ' || (v_prox + g - 1), 6, 'open'
        from generate_series(1, v_k) g
        returning id, name
      ), u as (
        select u.ticket_id, ntile(v_k) over (order by u.ord) grupo
        from unnest(v_ids) with ordinality u(ticket_id, ord)
      )
      -- vibe nula: minha_mesa lê a vibe na hora, com o consentimento vigente
      insert into public.table_members (table_id, user_id, ticket_id, vibe)
      select m.id, t.user_id, t.id, null
      from u
      join public.tickets t on t.id = u.ticket_id
      join mesas m on m.name = 'Mesa ' || (v_prox + u.grupo - 1);
      v_prox := v_prox + v_k;
      v_mudou := v_mudou || array(select c.id from public.collective_tables c where c.ticket_type_id = v_tipo);
    else
      -- Quem chega depois: mesa do mesmo tipo com menos gente; sem vaga, mesa nova.
      -- ponytail: sem afinidade para quem chega depois (plano); reformar mesa já anunciada confundiria.
      foreach v_ticket in array v_ids loop
        select c.id into v_mesa
        from public.collective_tables c
        cross join lateral (select count(*) n from public.table_members m where m.table_id = c.id) q
        where c.ticket_type_id = v_tipo and c.status <> 'closed' and q.n < c.capacity
        order by q.n, c.created_at, substring(c.name from '[0-9]+')::int
        limit 1;
        if v_mesa is null then
          insert into public.collective_tables (event_id, ticket_type_id, name, capacity, status)
          values (p_event_id, v_tipo, 'Mesa ' || v_prox, 6, 'open')
          returning id into v_mesa;
          v_prox := v_prox + 1;
        end if;
        insert into public.table_members (table_id, user_id, ticket_id, vibe)
        select v_mesa, t.user_id, t.id, null
        from public.tickets t where t.id = v_ticket;
        v_mudou := v_mudou || v_mesa;
      end loop;
    end if;
  end loop;

  -- Situação e nota só das mesas que mudaram. A nota usa só os pares em que os dois são mesa_ok;
  -- sem nenhum par assim, fica nula.
  update public.collective_tables c set
    status = case when c.status = 'closed' then 'closed'
                  when (select count(*) from public.table_members m where m.table_id = c.id) >= c.capacity then 'full'
                  else 'open' end,
    compatibility_score = (
      select round(avg(public.mesa_compat(pa.p, pb.p)), 1)
      from public.table_members a
      join public.table_members b on b.table_id = a.table_id and a.ticket_id < b.ticket_id
      cross join lateral (select public.mesa_perfil(a.user_id) p) pa
      cross join lateral (select public.mesa_perfil(b.user_id) p) pb
      where a.table_id = c.id and pa.p is not null and pb.p is not null)
  where c.id = any(v_mudou);

  return v_total;
end;
$$;

-- 5b. minha_mesa: as mesas da pessoa logada no evento e os colegas, um por pessoa.
--     "acompanhantes" (mais de um ingresso da mesma pessoa na mesa) é só defesa: mesa_idade_guard
--     e mesa_pedido_guard já garantem 1 ingresso coletivo por conta em cada evento.
--     Nunca devolve user_id, e-mail, telefone, CPF, temperamento, intenção nem a nota da mesa.
--     Colega só aparece com ingresso active/used ainda dele (transferido ou reembolsado some na hora).
--     Perfil completo só quando quem vê E quem é visto são mesa_ok; senão, só o primeiro nome.
--     Foto só do Storage do projeto (URL pública, não é segredo):
--     https://rwaezeqyuhxrssntcxdv.supabase.co/storage/
create or replace function public.minha_mesa(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_foto_ok constant text := 'https://rwaezeqyuhxrssntcxdv.supabase.co/storage/';
  v_eu_ok boolean;
begin
  if v_uid is null or not public.gf_mfa_ok() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  -- sem ingresso coletivo válido no evento: nada, nem a data de formação
  if not exists (select 1 from public.tickets t
                 join public.ticket_types tt on tt.id = t.ticket_type_id
                 where t.event_id = p_event_id and t.user_id = v_uid and tt.type = 'coletiva'
                   and t.status in ('active', 'used')) then
    return jsonb_build_object('mesas', '[]'::jsonb);
  end if;
  v_eu_ok := public.mesa_ok(v_uid);

  return jsonb_build_object(
    'forma_em', (select public.evento_momento(e) - interval '24 hours' from public.events e where e.id = p_event_id),
    'mesas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'nome', c.name,
               'capacidade', c.capacity,
               'colegas', (
                 select jsonb_agg(jsonb_build_object(
                          'nome', case when k.ok then p.full_name else split_part(trim(p.full_name), ' ', 1) end,
                          'foto', case when k.ok and starts_with(p.avatar_url, v_foto_ok) then p.avatar_url end,
                          'idade', case when k.ok then date_part('year', age(p.birth_date))::int end,
                          'rede_social', case when k.ok then x.social_url end,
                          'perfil', case when k.ok then x.vibe end,
                          'tags', case when k.ok then coalesce(x.tags, '{}'::jsonb) end,
                          'escolaridade', case when k.ok then x.education end,
                          'eu', g.user_id = v_uid)
                        || case when g.n > 1 then jsonb_build_object('acompanhantes', g.n - 1) else '{}'::jsonb end
                        order by g.user_id = v_uid desc, p.full_name, g.primeiro)
                 from (select m.user_id, count(*) n, min(m.ticket_id::text) primeiro
                       from public.table_members m
                       join public.tickets t on t.id = m.ticket_id
                       where m.table_id = c.id and t.user_id = m.user_id and t.status in ('active', 'used')
                       group by m.user_id) g
                 join public.profiles p on p.id = g.user_id
                 left join public.user_profiles_ext x on x.user_id = g.user_id
                 cross join lateral (select v_eu_ok and public.mesa_ok(g.user_id) ok) k)
             ) order by substring(c.name from '[0-9]+')::int)
      from public.collective_tables c
      where c.event_id = p_event_id
        and exists (select 1 from public.table_members m
                    join public.tickets t on t.id = m.ticket_id
                    where m.table_id = c.id and m.user_id = v_uid and t.user_id = m.user_id
                      and t.status in ('active', 'used'))
    ), '[]'::jsonb)
  );
end;
$$;

-- 5c. mesas_do_evento: para o produtor acomodar as pessoas (nome completo e ingresso, um por
--     cadeira). Mesas vazias aparecem, com a lista de membros vazia. Mesmo filtro de minha_mesa:
--     só ingresso active/used ainda do mesmo dono (quem saiu some antes da próxima formação).
create or replace function public.mesas_do_evento(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.gf_mfa_ok()
     or (not exists (select 1 from public.events e where e.id = p_event_id and e.producer_id = (select auth.uid()))
         and not public.gf_is_admin()) then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'numero', substring(c.name from '[0-9]+')::int,
             'nome', c.name,
             'capacidade', c.capacity,
             'score', c.compatibility_score,
             'membros', (
               select coalesce(jsonb_agg(jsonb_build_object('nome', coalesce(p.full_name, t.buyer_name), 'ingresso', t.id)
                                         order by coalesce(p.full_name, t.buyer_name), t.id), '[]'::jsonb)
               from public.table_members m
               join public.tickets t on t.id = m.ticket_id
               left join public.profiles p on p.id = t.user_id
               where m.table_id = c.id and t.status in ('active', 'used') and t.user_id = m.user_id)
           ) order by substring(c.name from '[0-9]+')::int)
    from public.collective_tables c
    where c.event_id = p_event_id
  ), '[]'::jsonb);
end;
$$;

-- 6. Consentimento: só por estas funções (o gatilho do bloco 2c barra a gravação direta) --------

-- 6a. mesa_consentir: aceite do termo vigente. Versão diferente = o front está com o termo velho.
create or replace function public.mesa_consentir(p_versao text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_versao constant text := public.mesa_termo_versao();
begin
  if v_uid is null or not public.gf_mfa_ok() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if p_versao is distinct from v_versao then
    raise exception 'Versão do termo desatualizada: recarregue a página' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles p
                 where p.id = v_uid and p.birth_date <= current_date - interval '18 years') then
    raise exception 'Mesa Tinder é só para maiores de 18' using errcode = '22023';
  end if;
  insert into public.user_profiles_ext (user_id, mesa_consent_version, mesa_consent_at, mesa_consent_revoked_at)
  values (v_uid, v_versao, now(), null)
  on conflict (user_id) do update
    set mesa_consent_version = excluded.mesa_consent_version,
        mesa_consent_at = excluded.mesa_consent_at,
        mesa_consent_revoked_at = null;
  insert into public.mesa_consentimentos (user_id, versao, acao) values (v_uid, v_versao, 'consentiu');
end;
$$;

-- 6b. mesa_revogar: revoga e apaga, no mesmo UPDATE, tudo o que o questionário da mesa coletou.
--     O lugar na mesa continua (sem afinidade e só com o primeiro nome). A nota das mesas da pessoa
--     é apagada: foi calculada com as respostas dela (volta na próxima mudança da mesa, sem ela).
create or replace function public.mesa_revogar()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_versao text;
begin
  if v_uid is null or not public.gf_mfa_ok() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  update public.user_profiles_ext x set
    mesa_consent_revoked_at = now(),
    tags = null, social_url = null, education = null, temperament = null, intention = null,
    music_style = null, energy_level = null, vibe = null, gender = null, bio = null,
    birth_year = null, quiz_completed_at = null
  where x.user_id = v_uid
  returning x.mesa_consent_version into v_versao;
  if found then
    insert into public.mesa_consentimentos (user_id, versao, acao) values (v_uid, v_versao, 'revogou');
  end if;
  update public.collective_tables c set compatibility_score = null
  where c.id in (select m.table_id from public.table_members m where m.user_id = v_uid);
end;
$$;

-- 7. Quem acessa o quê ---------------------------------------------------------------
-- Tabelas: só as funções acima leem e escrevem (RLS sem policy + sem GRANT).
revoke all on public.collective_tables, public.table_members, public.mesa_consentimentos from anon, authenticated;

revoke all on function public.mesa_ok(uuid) from public, anon, authenticated;
revoke all on function public.mesa_perfil(uuid) from public, anon, authenticated;
revoke all on function public.mesa_consent_guard() from public, anon, authenticated;
revoke all on function public.mesa_idade_guard() from public, anon, authenticated;
revoke all on function public.mesa_pedido_guard() from public, anon, authenticated;
revoke all on function public.mesa_tipo_guard() from public, anon, authenticated;
revoke all on function public.formar_mesas(uuid) from public, anon;
revoke all on function public.minha_mesa(uuid) from public, anon;
revoke all on function public.mesas_do_evento(uuid) from public, anon;
revoke all on function public.mesa_consentir(text) from public, anon;
revoke all on function public.mesa_revogar() from public, anon;
grant execute on function public.formar_mesas(uuid) to authenticated;
grant execute on function public.minha_mesa(uuid) to authenticated;
grant execute on function public.mesas_do_evento(uuid) to authenticated;
grant execute on function public.mesa_consentir(text) to authenticated;
grant execute on function public.mesa_revogar() to authenticated;
-- mesa_tags_ok, mesa_compat, evento_momento e mesa_termo_versao são puras (não leem tabela): ficam com o grant
-- padrão, porque o CHECK de tags roda com a permissão de quem grava o perfil.

-- 8. Cron. formar_mesas a cada 15 min, nas 24 h antes do evento; cada evento num bloco próprio,
--    para um erro não derrubar os outros. apagar_mesas_antigas todo dia às 04:37 UTC.
--    ponytail: a falha de um evento aparece só como WARNING no log do Postgres; em
--    cron.job_run_details a execução fica "succeeded". Se precisar de alerta, gravar a falha numa tabela.
select cron.unschedule('formar_mesas') where exists (select 1 from cron.job where jobname = 'formar_mesas');
select cron.schedule('formar_mesas', '*/15 * * * *', $cron$
  do $job$
  declare r record;
  begin
    for r in
      select e.id from public.events e
      where exists (select 1 from public.ticket_types tt where tt.event_id = e.id and tt.type = 'coletiva')
        and public.evento_momento(e) between now() and now() + interval '24 hours'
    loop
      begin
        perform public.formar_mesas(r.id);
      exception when others then
        raise warning 'formar_mesas(%) falhou: % %', r.id, sqlstate, sqlerrm;
      end;
    end loop;
  end $job$;
$cron$);

select cron.unschedule('apagar_mesas_antigas') where exists (select 1 from cron.job where jobname = 'apagar_mesas_antigas');
select cron.schedule('apagar_mesas_antigas', '37 4 * * *', $cron$
  delete from public.collective_tables c
  using public.events e
  where e.id = c.event_id and public.evento_momento(e) < now() - interval '30 days';
$cron$);

commit;

-- Conferência:
-- select jobname, schedule from cron.job where jobname in ('formar_mesas', 'apagar_mesas_antigas');
-- select grantee, privilege_type from information_schema.role_table_grants
--   where table_name in ('collective_tables', 'table_members', 'mesa_consentimentos') and grantee in ('anon', 'authenticated');



-- =============================================================================
-- TESTES (rodar à mão no SQL Editor: tire o "-- " do começo das linhas abaixo e rode tudo
-- de uma vez; o bloco inteiro está num begin … rollback e não deixa nada gravado).
-- Contas de teste com ids fixos (b0000000-…); e-mails *.invalid. Cada teste termina com
-- "NOTICE: Tn OK"; falha = ERROR com o valor recebido.
-- Stubs usados no Postgres descartável (supabase/postgres 17.6.1.171), fora do repositório:
-- profiles/events/ticket_types/tickets/user_profiles_ext/collective_tables/table_members com as
-- colunas, CHECKs, FKs, RLS e GRANTs de produção (compatibility_score numeric(3,1),
-- table_members.user_id NOT NULL, events.start_date NOT NULL DEFAULT now(), tickets.order_id
-- NOT NULL), auth.jwt(), auth.mfa_factors, orders/order_items, e gf_mfa_ok/gf_is_admin copiadas
-- de 20260930_2fa_no_banco.sql.
-- Em produção, events e orders podem ter outras colunas obrigatórias: se o insert de pg_temp.ingresso,
-- do T0 ou do T16 falhar, complete-o.
-- A corrida entre duas sessões (trava mesa_conta) não cabe neste bloco de uma sessão só; foi testada
-- à parte, com duas sessões psql em paralelo.
-- =============================================================================
-- begin;
-- -- p = usuário (null = postgres); aal = nível da sessão no JWT
-- create function pg_temp.como(p uuid, aal text default 'aal1') returns void language plpgsql as $f$
-- begin
--   perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), true);
--   perform set_config('request.jwt.claims', case when p is null then '' else json_build_object('sub', p, 'role', 'authenticated', 'aal', aal)::text end, true);
--   perform set_config('role', case when p is null then 'postgres' else 'authenticated' end, true);
-- end $f$;
-- create function pg_temp.erro(q text) returns text language plpgsql as $f$
-- begin execute q; return 'ok'; exception when others then return sqlstate; end $f$;
-- create function pg_temp.u(n int) returns uuid language sql as $f$ select ('b0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $f$;
-- -- retrato das mesas de um evento (ids, nomes, status, nota e ingressos), para comparar antes/depois
-- create function pg_temp.retrato(ev uuid) returns text language sql as $f$
--   select coalesce(string_agg(c.id || c.name || c.status || coalesce(c.compatibility_score::text, '-') || coalesce(m.ticket_id::text, '-'), ',' order by c.id, m.ticket_id), '')
--   from public.collective_tables c left join public.table_members m on m.table_id = c.id where c.event_id = ev $f$;
-- create function pg_temp.tamanhos(ev uuid) returns int[] language sql as $f$
--   select array_agg(n order by numero) from (select substring(c.name from '[0-9]+')::int numero, count(m.id)::int n from public.collective_tables c
--   left join public.table_members m on m.table_id = c.id where c.event_id = ev group by c.name) s $f$;
-- -- colegas que "quem" vê em minha_mesa (evento ev), achatados
-- create function pg_temp.colegas(quem uuid, ev uuid) returns setof jsonb language plpgsql as $f$
-- declare r jsonb;
-- begin
--   perform pg_temp.como(quem);
--   r := public.minha_mesa(ev);
--   perform pg_temp.como(null);
--   return query select c from jsonb_array_elements(r -> 'mesas') m, jsonb_array_elements(m -> 'colegas') c;
-- end $f$;
-- -- ingresso com o próprio pedido (tickets.order_id é NOT NULL em produção)
-- create function pg_temp.ingresso(id int, tipo int, ev int, dono int, st text default 'active') returns void language sql as $f$
--   with o as (insert into public.orders (user_id, event_id, status) values (pg_temp.u(dono), pg_temp.u(ev), 'paid') returning id)
--   insert into public.tickets (id, order_id, ticket_type_id, event_id, user_id, buyer_name, buyer_email, buyer_cpf, status, created_at)
--   select pg_temp.u(ingresso.id), o.id, pg_temp.u(tipo), pg_temp.u(ev), pg_temp.u(dono), 'Comprador ' || dono, 'pessoa' || dono || '@teste.evokaa.invalid',
--          '00000000000', st, now() - (10000 - ingresso.id) * interval '1 second' from o $f$;
-- -- perfil com consentimento, gravado como postgres (o gatilho só barra anon/authenticated)
-- create function pg_temp.consente(g int) returns void language sql as $f$
--   insert into public.user_profiles_ext (user_id, temperament, intention, music_style, energy_level, vibe, tags, social_url, education,
--     mesa_consent_version, mesa_consent_at)
--   values (pg_temp.u(g), (array['introvert', 'ambivert', 'extrovert'])[g % 3 + 1], (array['network', 'fun', 'experience'])[g % 3 + 1],
--     (array['rock', 'pop', 'sertanejo', 'indie'])[g % 4 + 1], (array['low', 'medium', 'high'])[g % 3 + 1], 'Explorador Tranquilo',
--     jsonb_build_object('musica', jsonb_build_array((array['rock', 'pop', 'funk'])[g % 3 + 1]), 'idiomas', '["ingles"]'::jsonb),
--     'https://instagram.com/pessoa' || g, 'superior', '2026-10-03', now()) $f$;
--
-- -- T0. Contas: 1 produtor P, 2 produtor Q, 3 admin, 11..63 pessoas (61 sem data de nascimento,
-- --     62 com 17 anos, 63 fazendo 18 hoje).
-- --     Eventos de P: E=901 (daqui a 2 dias; start_date = dia da criação, como em produção),
-- --     E3=903, E4=904, E5=905. De Q: E2=902. Tipos coletivos 911..915 (um por evento).
-- insert into auth.users (id, email)
-- select pg_temp.u(g), 'pessoa' || g || '@teste.evokaa.invalid' from generate_series(1, 63) g;
-- insert into public.profiles (id, full_name, birth_date, role, avatar_url)
-- select pg_temp.u(g), case g when 1 then 'Paula Produtora' when 2 then 'Quintino Produtor' when 3 then 'Alice Admin'
--   when 11 then 'Ana Maria Souza' when 12 then 'Bruno Carlos Lima' else 'Pessoa ' || g || ' Sobrenome' end,
--   case g when 61 then null when 62 then (current_date - interval '17 years')::date
--     when 63 then (current_date - interval '18 years')::date else date '1995-06-15' end,
--   case g when 3 then 'admin' when 1 then 'producer' when 2 then 'producer' else 'user' end,
--   case g when 42 then 'https://golpe.example/foto.png' else 'https://rwaezeqyuhxrssntcxdv.supabase.co/storage/v1/object/public/avatars/' || g || '.png' end
-- from generate_series(1, 63) g
-- on conflict (id) do update set full_name = excluded.full_name, birth_date = excluded.birth_date, role = excluded.role, avatar_url = excluded.avatar_url;
-- insert into public.events (id, producer_id, title, date, time, status, approval_status)
-- select pg_temp.u(900 + g), pg_temp.u(case g when 2 then 2 else 1 end), 'Evento teste ' || g, current_date + 2, '22:00', 'published', 'approved'
-- from generate_series(1, 5) g;
-- insert into public.ticket_types (id, event_id, name, type, capacity)
-- select pg_temp.u(910 + g), pg_temp.u(900 + g), 'Mesa coletiva', 'coletiva', 100 from generate_series(1, 5) g;
-- -- E: 13 ativos (11..23) + 24 cancelado + 25 reembolsado; todos consentem menos o 12 (Bruno)
-- do $$ begin
--   perform pg_temp.ingresso(1000 + g, 911, 901, g, case g when 24 then 'cancelled' when 25 then 'refunded' else 'active' end) from generate_series(11, 25) g;
--   perform pg_temp.consente(g) from generate_series(11, 45) g where g <> 12;
-- end $$;
-- insert into public.user_profiles_ext (user_id, temperament, intention, vibe, social_url) values
--   (pg_temp.u(12), 'extrovert', 'fun', 'Turbilhão', 'https://instagram.com/bruno');
--
-- -- T1. 13 ingressos ativos → 3 mesas de 5, 4 e 4; nota de 0 a 100 (cabe em numeric(4,1)); vibe não gravada
-- do $t$
-- declare n int;
-- begin
--   perform pg_temp.como(pg_temp.u(1));
--   n := public.formar_mesas(pg_temp.u(901));
--   perform pg_temp.como(null);
--   assert n = 13, format('alocou %s', n);
--   assert pg_temp.tamanhos(pg_temp.u(901)) = array[5, 4, 4], format('tamanhos %s', pg_temp.tamanhos(pg_temp.u(901)));
--   assert (select bool_and(status = 'open' and compatibility_score between 0 and 100 and capacity = 6)
--           from public.collective_tables where event_id = pg_temp.u(901)), 'status/nota/capacidade';
--   assert (select bool_and(matchmaking_answers = '{}'::jsonb and vibe is null) from public.table_members), 'copiou respostas ou gravou vibe';
--   raise notice 'T1 OK: 13 → 5/4/4, notas %', (select array_agg(compatibility_score order by name) from public.collective_tables);
-- end $t$;
--
-- -- T2. Rodar de novo não muda nada (mesmos ids, membros, status e nota)
-- do $t$
-- declare antes text := pg_temp.retrato(pg_temp.u(901)); n int;
-- begin
--   n := public.formar_mesas(pg_temp.u(901));
--   assert n = 0, format('2ª rodada alocou %s', n);
--   assert pg_temp.retrato(pg_temp.u(901)) = antes, 'mudou na 2ª rodada';
--   raise notice 'T2 OK: 2ª rodada idempotente';
-- end $t$;
--
-- -- T3. Cancelado e reembolsado ficam de fora
-- do $t$
-- begin
--   assert not exists (select 1 from public.table_members where ticket_id in (pg_temp.u(1024), pg_temp.u(1025))), 'cancelado/reembolsado na mesa';
--   raise notice 'T3 OK: cancelled/refunded fora';
-- end $t$;
--
-- -- T4. Compra nova entra na mesa com menos gente; cancelamento sai; mesas cheias → "full" e mesa nova
-- do $t$
-- declare n int; v_mesa text;
-- begin
--   perform pg_temp.ingresso(1026, 911, 901, 26);
--   n := public.formar_mesas(pg_temp.u(901));
--   select c.name into v_mesa from public.table_members m join public.collective_tables c on c.id = m.table_id where m.ticket_id = pg_temp.u(1026);
--   assert n = 1 and v_mesa = 'Mesa 2', format('chegada: n=%s mesa=%s', n, v_mesa);
--   assert pg_temp.tamanhos(pg_temp.u(901)) = array[5, 5, 4], format('tamanhos %s', pg_temp.tamanhos(pg_temp.u(901)));
--   update public.tickets set status = 'cancelled' where id = (select m.ticket_id from public.table_members m
--     join public.collective_tables c on c.id = m.table_id where c.name = 'Mesa 1' and c.event_id = pg_temp.u(901)
--     and m.user_id <> pg_temp.u(12) order by m.ticket_id limit 1);
--   n := public.formar_mesas(pg_temp.u(901));
--   assert n = 0 and pg_temp.tamanhos(pg_temp.u(901)) = array[4, 5, 4], format('saída: n=%s %s', n, pg_temp.tamanhos(pg_temp.u(901)));
--   perform pg_temp.ingresso(1000 + g, 911, 901, g) from generate_series(27, 33) g;
--   n := public.formar_mesas(pg_temp.u(901));
--   assert n = 7 and pg_temp.tamanhos(pg_temp.u(901)) = array[6, 6, 6, 2], format('lotação: n=%s %s', n, pg_temp.tamanhos(pg_temp.u(901)));
--   assert (select array_agg(status order by name) from public.collective_tables where event_id = pg_temp.u(901))
--          = array['full', 'full', 'full', 'open'], 'status full/open';
--   raise notice 'T4 OK: chegada entra na Mesa 2, cancelamento sai, lotação abre a Mesa 4';
-- end $t$;
--
-- -- T5. Mesa que esvazia continua aberta (sem nota) e recebe quem chega; número não se repete
-- do $t$
-- declare n int;
-- begin
--   perform pg_temp.ingresso(1100 + g, 913, 903, g) from generate_series(34, 40) g;   -- 7 → Mesa 1 (4) e Mesa 2 (3)
--   n := public.formar_mesas(pg_temp.u(903));
--   assert pg_temp.tamanhos(pg_temp.u(903)) = array[4, 3], format('E3 %s', pg_temp.tamanhos(pg_temp.u(903)));
--   update public.tickets set status = 'refunded' where id in (select m.ticket_id from public.table_members m
--     join public.collective_tables c on c.id = m.table_id where c.event_id = pg_temp.u(903) and c.name = 'Mesa 2');
--   n := public.formar_mesas(pg_temp.u(903));
--   assert pg_temp.tamanhos(pg_temp.u(903)) = array[4, 0], format('esvaziou %s', pg_temp.tamanhos(pg_temp.u(903)));
--   assert (select status = 'open' and compatibility_score is null from public.collective_tables
--           where event_id = pg_temp.u(903) and name = 'Mesa 2'), 'mesa vazia não ficou aberta e sem nota';
--   perform pg_temp.ingresso(1150 + g, 913, 903, g) from generate_series(46, 54) g;   -- 9: 6 na Mesa 2, 2 na Mesa 1, 1 na Mesa 3
--   n := public.formar_mesas(pg_temp.u(903));
--   assert n = 9 and pg_temp.tamanhos(pg_temp.u(903)) = array[6, 6, 1], format('reuso %s', pg_temp.tamanhos(pg_temp.u(903)));
--   assert (select count(*) = count(distinct name) from public.collective_tables where event_id = pg_temp.u(903)), 'número repetido';
--   raise notice 'T5 OK: mesa vazia fica aberta, recebe chegadas; Mesa 3 nova, sem número repetido';
-- end $t$;
--
-- -- T6. Produtor de outro evento e comprador → 42501; admin e produtor conseguem; 2FA exigido
-- do $t$
-- begin
--   perform pg_temp.como(pg_temp.u(2));
--   assert pg_temp.erro(format('select public.formar_mesas(%L)', pg_temp.u(901))) = '42501', 'Q formou mesas de E';
--   assert pg_temp.erro(format('select public.mesas_do_evento(%L)', pg_temp.u(901))) = '42501', 'Q leu mesas de E';
--   perform pg_temp.como(pg_temp.u(11));
--   assert pg_temp.erro(format('select public.formar_mesas(%L)', pg_temp.u(901))) = '42501', 'comprador formou mesas';
--   assert pg_temp.erro(format('select public.mesas_do_evento(%L)', pg_temp.u(901))) = '42501', 'comprador leu mesas do evento';
--   perform pg_temp.como(pg_temp.u(3));
--   assert pg_temp.erro(format('select public.formar_mesas(%L)', pg_temp.u(902))) = 'ok', 'admin não formou';
--   assert pg_temp.erro(format('select public.mesas_do_evento(%L)', pg_temp.u(901))) = 'ok', 'admin não leu';
--   perform pg_temp.como(pg_temp.u(1));
--   assert jsonb_array_length(public.mesas_do_evento(pg_temp.u(901))) = 4, 'produtor não vê as 4 mesas';
--   assert public.mesas_do_evento(pg_temp.u(901))::text like '%Ana Maria Souza%', 'produtor sem nome completo';
--   assert public.mesas_do_evento(pg_temp.u(901))::text not like '%@%', 'e-mail em mesas_do_evento';
--   -- 2FA: fator verificado e sessão aal1 → 42501; aal2 → passa
--   perform pg_temp.como(null);
--   insert into auth.mfa_factors (user_id, status) values (pg_temp.u(1), 'verified'), (pg_temp.u(11), 'verified');
--   perform pg_temp.como(pg_temp.u(1), 'aal1');
--   assert pg_temp.erro(format('select public.formar_mesas(%L)', pg_temp.u(901))) = '42501', 'formar_mesas sem 2FA';
--   assert pg_temp.erro(format('select public.mesas_do_evento(%L)', pg_temp.u(901))) = '42501', 'mesas_do_evento sem 2FA';
--   perform pg_temp.como(pg_temp.u(11), 'aal1');
--   assert pg_temp.erro(format('select public.minha_mesa(%L)', pg_temp.u(901))) = '42501', 'minha_mesa sem 2FA';
--   assert pg_temp.erro(format('select public.mesa_consentir(%L)', '2026-10-03')) = '42501', 'mesa_consentir sem 2FA';
--   assert pg_temp.erro('select public.mesa_revogar()') = '42501', 'mesa_revogar sem 2FA';
--   assert pg_temp.erro(format('select public.minha_mesa(%L)', pg_temp.u(901))) = '42501', 'minha_mesa sem 2FA';
--   perform pg_temp.como(pg_temp.u(1), 'aal2');
--   assert pg_temp.erro(format('select public.formar_mesas(%L)', pg_temp.u(901))) = 'ok', 'produtor com aal2 barrado';
--   perform pg_temp.como(pg_temp.u(11), 'aal2');
--   assert pg_temp.erro(format('select public.minha_mesa(%L)', pg_temp.u(901))) = 'ok', 'minha_mesa com aal2 barrada';
--   perform pg_temp.como(null);
--   delete from auth.mfa_factors where user_id in (pg_temp.u(1), pg_temp.u(11));
--   raise notice 'T6 OK: só produtor do evento e admin; 2FA exigido quando há fator';
-- end $t$;
--
-- -- T7. anon e authenticated não leem nem escrevem nas tabelas; anon não executa as funções
-- do $t$
-- begin
--   perform set_config('request.jwt.claim.sub', '', true);
--   perform set_config('request.jwt.claims', '', true);
--   perform set_config('role', 'anon', true);
--   assert pg_temp.erro('select 1 from public.collective_tables') = '42501', 'anon SELECT mesas';
--   assert pg_temp.erro('select 1 from public.table_members') = '42501', 'anon SELECT membros';
--   assert pg_temp.erro('select 1 from public.mesa_consentimentos') = '42501', 'anon SELECT histórico';
--   assert pg_temp.erro(format('insert into public.collective_tables (event_id, name) values (%L, %L)', pg_temp.u(901), 'X')) = '42501', 'anon INSERT';
--   assert pg_temp.erro(format('select public.formar_mesas(%L)', pg_temp.u(901))) = '42501', 'anon EXECUTE formar_mesas';
--   assert pg_temp.erro(format('select public.minha_mesa(%L)', pg_temp.u(901))) = '42501', 'anon EXECUTE minha_mesa';
--   assert pg_temp.erro(format('select public.mesas_do_evento(%L)', pg_temp.u(901))) = '42501', 'anon EXECUTE mesas_do_evento';
--   assert pg_temp.erro(format('select public.mesa_consentir(%L)', '2026-10-03')) = '42501', 'anon EXECUTE mesa_consentir';
--   assert pg_temp.erro('select public.mesa_revogar()') = '42501', 'anon EXECUTE mesa_revogar';
--   perform pg_temp.como(pg_temp.u(11));
--   assert pg_temp.erro('select 1 from public.table_members') = '42501', 'authenticated SELECT membros';
--   assert pg_temp.erro('select 1 from public.mesa_consentimentos') = '42501', 'authenticated SELECT histórico';
--   assert pg_temp.erro(format('insert into public.collective_tables (event_id, name) values (%L, %L)', pg_temp.u(901), 'X')) = '42501', 'authenticated INSERT';
--   assert pg_temp.erro(format('select public.mesa_perfil(%L)', pg_temp.u(12))) = '42501', 'authenticated EXECUTE mesa_perfil';
--   assert pg_temp.erro(format('select public.mesa_ok(%L)', pg_temp.u(12))) = '42501', 'authenticated EXECUTE mesa_ok';
--   perform pg_temp.como(null);
--   raise notice 'T7 OK: tabelas fechadas; anon sem EXECUTE';
-- end $t$;
--
-- -- T8. minha_mesa: sem dado proibido nem nota; quem não consentiu só com o primeiro nome;
-- --     reciprocidade; colega reembolsado some na hora; quem não tem ingresso não vê nem forma_em
-- do $t$
-- declare r jsonb; colega uuid; b jsonb; sai uuid;
-- begin
--   select m2.user_id into colega from public.table_members m1 join public.table_members m2 on m2.table_id = m1.table_id
--   where m1.user_id = pg_temp.u(12) and m2.user_id <> pg_temp.u(12) order by m2.ticket_id limit 1;
--   perform pg_temp.como(colega);
--   r := public.minha_mesa(pg_temp.u(901));
--   perform pg_temp.como(null);
--   assert jsonb_array_length(r -> 'mesas') = 1, format('mesas: %s', r);
--   assert r::text not like '%user_id%' and r::text not like '%email%' and r::text not like '%@teste.evokaa.invalid%'
--      and r::text not like '%temperament%' and r::text not like '%intention%' and r::text not like '%b0000000%'
--      and r::text not like '%introvert%' and r::text not like '%extrovert%' and r::text not like '%score%'
--      and not (r -> 'mesas' -> 0 ? 'score'), format('vazou: %s', r);
--   assert (r ->> 'forma_em')::timestamptz = ((current_date + 2) + time '22:00') at time zone 'America/Sao_Paulo' - interval '24 hours',
--          format('forma_em %s', r ->> 'forma_em');
--   select c into b from jsonb_array_elements(r -> 'mesas' -> 0 -> 'colegas') c where c ->> 'nome' = 'Bruno';
--   assert b is not null and b -> 'foto' = 'null' and b -> 'idade' = 'null' and b -> 'rede_social' = 'null'
--      and b -> 'tags' = 'null' and b -> 'escolaridade' = 'null' and b -> 'perfil' = 'null', format('Bruno exposto: %s', b);
--   assert (select count(*) from jsonb_array_elements(r -> 'mesas' -> 0 -> 'colegas') c where (c ->> 'eu')::boolean) = 1, 'eu';
--   assert (select bool_and((c ->> 'idade')::int >= 18 and c ->> 'rede_social' like 'https://%' and c ->> 'foto' like 'https://rwaezeqyuhxrssntcxdv.supabase.co/storage/%')
--           from jsonb_array_elements(r -> 'mesas' -> 0 -> 'colegas') c where c ->> 'nome' <> 'Bruno'), format('colega que consentiu incompleto: %s', r);
--   -- reciprocidade: Bruno (sem consentimento) vê todos só pelo primeiro nome
--   assert (select bool_and(c ->> 'nome' not like '% %' and c -> 'foto' = 'null' and c -> 'tags' = 'null')
--           from pg_temp.colegas(pg_temp.u(12), pg_temp.u(901)) c), 'Bruno viu perfil completo';
--   -- colega reembolsado some antes de formar_mesas rodar de novo
--   select m2.ticket_id into sai from public.table_members m1 join public.table_members m2 on m2.table_id = m1.table_id
--   where m1.user_id = colega and m2.user_id not in (colega, pg_temp.u(12)) order by m2.ticket_id limit 1;
--   update public.tickets set status = 'refunded' where id = sai;
--   assert not exists (select 1 from pg_temp.colegas(colega, pg_temp.u(901)) c
--                      where c ->> 'nome' = (select p.full_name from public.tickets t join public.profiles p on p.id = t.user_id where t.id = sai)),
--          'reembolsado ainda aparece';
--   -- sem ingresso coletivo no evento: {"mesas": []}, sem forma_em
--   perform pg_temp.como(pg_temp.u(60));
--   assert public.minha_mesa(pg_temp.u(901)) = '{"mesas": []}'::jsonb, 'sem ingresso viu algo';
--   perform pg_temp.como(null);
--   raise notice 'T8 OK: minha_mesa sem dado proibido nem nota; primeiro nome; reciprocidade; reembolsado some';
-- end $t$;
--
-- -- T9. 2º ingresso coletivo na mesma conta → 22023. Defesas de minha_mesa: quem vira menor depois
-- --     de alocado (burla do ponytail do bloco 3b) só com o primeiro nome; 2 ingressos forçados com o
-- --     gatilho desligado = 1 colega com acompanhantes; foto fora do Storage do projeto não sai
-- do $t$
-- declare c41 jsonb; c42 jsonb; eu jsonb;
-- begin
--   perform pg_temp.ingresso(1500, 914, 904, 41);
--   perform pg_temp.ingresso(1501, 914, 904, 42);
--   perform pg_temp.ingresso(1503, 914, 904, 43);
--   assert pg_temp.erro('select pg_temp.ingresso(1502, 914, 904, 42)') = '22023', '2º ingresso coletivo na mesma conta passou';
--   alter table public.tickets disable trigger mesa_idade_guard;
--   perform pg_temp.ingresso(1502, 914, 904, 42);
--   alter table public.tickets enable trigger mesa_idade_guard;
--   perform public.formar_mesas(pg_temp.u(904));
--   update public.profiles set birth_date = current_date - interval '17 years' where id = pg_temp.u(41);
--   select c into c41 from pg_temp.colegas(pg_temp.u(43), pg_temp.u(904)) c where c ->> 'nome' = 'Pessoa';
--   assert c41 is not null and c41 -> 'idade' = 'null' and c41 -> 'foto' = 'null' and c41 -> 'tags' = 'null', format('menor exposto: %s', c41);
--   select c into c42 from pg_temp.colegas(pg_temp.u(43), pg_temp.u(904)) c where c ->> 'nome' = 'Pessoa 42 Sobrenome';
--   assert (c42 ->> 'acompanhantes')::int = 1 and c42 -> 'foto' = 'null', format('acompanhantes/foto: %s', c42);
--   assert (select count(*) from pg_temp.colegas(pg_temp.u(43), pg_temp.u(904))) = 3, 'mais de um colega por pessoa';
--   select c into eu from pg_temp.colegas(pg_temp.u(42), pg_temp.u(904)) c where (c ->> 'eu')::boolean;
--   assert (select count(*) from pg_temp.colegas(pg_temp.u(42), pg_temp.u(904)) c where (c ->> 'eu')::boolean) = 1
--      and (eu ->> 'acompanhantes')::int = 1, format('eu duplicado: %s', eu);
--   perform pg_temp.como(pg_temp.u(1));
--   assert jsonb_array_length(public.mesas_do_evento(pg_temp.u(904)) -> 0 -> 'membros') = 4, 'produtor não vê 4 cadeiras';
--   perform pg_temp.como(null);
--   raise notice 'T9 OK: 1 por conta; menor fechado; acompanhantes (defesa); foto externa bloqueada; produtor conta cadeiras';
-- end $t$;
--
-- -- T10. 3 pessoas sem consentimento: forma, sem overflow, nota nula
-- do $t$
-- begin
--   perform pg_temp.ingresso(1300 + g, 915, 905, g) from generate_series(55, 57) g;
--   assert public.formar_mesas(pg_temp.u(905)) = 3, 'não alocou 3';
--   assert (select compatibility_score is null from public.collective_tables where event_id = pg_temp.u(905)), 'nota sem par consentido';
--   raise notice 'T10 OK: sem consentimento, nota nula';
-- end $t$;
--
-- -- T11. CHECKs: etiquetas, social_url, escolaridade, vibe e "romance"
-- do $t$
-- declare u text := pg_temp.u(11);
-- begin
--   perform pg_temp.como(pg_temp.u(11));
--   assert pg_temp.erro(format($q$update public.user_profiles_ext set tags = '{"musica": ["forro", "axe_inexistente"]}' where user_id = %L$q$, u)) = '23514', 'tag fora da lista';
--   assert pg_temp.erro(format($q$update public.user_profiles_ext set tags = '{"musica": ["sertanejo","funk","rock","pop","eletronica","mpb","samba_pagode","forro","indie"]}' where user_id = %L$q$, u)) = '23514', '9 itens';
--   assert pg_temp.erro(format($q$update public.user_profiles_ext set tags = '{"religiao": ["x"]}' where user_id = %L$q$, u)) = '23514', 'categoria estranha';
--   assert pg_temp.erro(format($q$update public.user_profiles_ext set tags = '{"musica": ["rock", "rock"]}' where user_id = %L$q$, u)) = '23514', 'repetida';
--   assert pg_temp.erro(format($q$update public.user_profiles_ext set tags = '{"musica": "rock"}' where user_id = %L$q$, u)) = '23514', 'não array';
--   assert pg_temp.erro(format($q$update public.user_profiles_ext set tags = '{"musica": ["sertanejo","funk","rock","pop","eletronica","mpb","samba_pagode","forro"], "hobbies": ["pets"]}' where user_id = %L$q$, u)) = 'ok', '8 itens válidos';
--   assert pg_temp.erro(format($q$update public.user_profiles_ext set social_url = 'http://instagram.com/ana' where user_id = %L$q$, u)) = '23514', 'http://';
--   assert pg_temp.erro(format($q$update public.user_profiles_ext set social_url = 'HTTPS://instagram.com/ana' where user_id = %L$q$, u)) = '23514', 'HTTPS maiúsculo';
--   assert pg_temp.erro(format($q$update public.user_profiles_ext set social_url = 'https://facebook.com/ana' where user_id = %L$q$, u)) = '23514', 'outro domínio';
--   assert pg_temp.erro(format($q$update public.user_profiles_ext set social_url = 'https://instagram.com.golpe.io/ana' where user_id = %L$q$, u)) = '23514', 'domínio disfarçado';
--   assert pg_temp.erro(format($q$update public.user_profiles_ext set social_url = 'https://instagram.com/ana"onclick=x' where user_id = %L$q$, u)) = '23514', 'aspas no caminho';
--   assert pg_temp.erro(format($q$update public.user_profiles_ext set social_url = 'https://instagram.com/' where user_id = %L$q$, u)) = '23514', 'caminho vazio';
--   assert pg_temp.erro(format($q$update public.user_profiles_ext set social_url = 'https://www.linkedin.com/in/ana-souza_1' where user_id = %L$q$, u)) = 'ok', 'linkedin válido';
--   assert pg_temp.erro(format($q$update public.user_profiles_ext set education = 'doutorado' where user_id = %L$q$, u)) = '23514', 'escolaridade';
--   assert pg_temp.erro(format($q$update public.user_profiles_ext set vibe = 'Hacker' where user_id = %L$q$, u)) = '23514', 'vibe fora da lista';
--   assert pg_temp.erro(format($q$update public.user_profiles_ext set vibe = 'Camaleão' where user_id = %L$q$, u)) = 'ok', 'vibe válida';
--   assert pg_temp.erro(format($q$update public.user_profiles_ext set intention = 'romance' where user_id = %L$q$, u)) = '23514', 'romance';
--   perform pg_temp.como(null);
--   raise notice 'T11 OK: CHECKs de tags, social_url, escolaridade, vibe e romance';
-- end $t$;
--
-- -- T12. Consentimento só por função; versão errada falha; revogar zera e registra
-- do $t$
-- declare u60 uuid := pg_temp.u(60);
-- begin
--   perform pg_temp.como(pg_temp.u(11));
--   assert pg_temp.erro(format($q$update public.user_profiles_ext set mesa_consent_at = now() - interval '1 day' where user_id = %L$q$, pg_temp.u(11))) = '42501', 'update direto de mesa_consent_at';
--   assert pg_temp.erro(format($q$update public.user_profiles_ext set mesa_consent_revoked_at = null, mesa_consent_version = 'x' where user_id = %L$q$, pg_temp.u(11))) = '42501', 'update direto de mesa_consent_version';
--   perform pg_temp.como(u60);
--   assert pg_temp.erro(format($q$insert into public.user_profiles_ext (user_id, mesa_consent_at) values (%L, now())$q$, u60)) = '42501', 'insert direto com consentimento';
--   assert pg_temp.erro(format('select public.mesa_consentir(%L)', '2020-01-01')) = '22023', 'versão errada aceita';
--   perform public.mesa_consentir('2026-10-03');
--   perform pg_temp.como(null);
--   assert (select mesa_consent_version = '2026-10-03' and mesa_consent_at is not null and mesa_consent_revoked_at is null
--           from public.user_profiles_ext where user_id = u60), 'mesa_consentir não gravou';
--   update public.user_profiles_ext set temperament = 'introvert', tags = '{"hobbies": ["pets"]}', social_url = 'https://x.com/p60',
--     education = 'medio', vibe = 'Curioso', bio = 'oi', gender = 'F', birth_year = 1990, quiz_completed_at = now() where user_id = u60;
--   perform pg_temp.como(u60);
--   perform public.mesa_revogar();
--   perform pg_temp.como(null);
--   assert (select mesa_consent_revoked_at is not null and tags is null and social_url is null and education is null and temperament is null
--             and intention is null and music_style is null and energy_level is null and vibe is null and gender is null and bio is null
--             and birth_year is null and quiz_completed_at is null from public.user_profiles_ext where user_id = u60), 'revogar não zerou';
--   assert (select array_agg(acao order by em, acao) from public.mesa_consentimentos where user_id = u60) = array['consentiu', 'revogou'], 'histórico';
--   raise notice 'T12 OK: consentimento só por função; revogação zera e fica no histórico';
-- end $t$;
--
-- -- T13. Cron: forma só na janela de 24 h (pelo date/time, não pelo start_date), um evento com erro
-- --      não derruba os outros, e apaga mesas de evento com mais de 30 dias
-- do $t$
-- declare formar text := (select command from cron.job where jobname = 'formar_mesas');
--         apagar text := (select command from cron.job where jobname = 'apagar_mesas_antigas');
--         daqui3h timestamp := (now() + interval '3 hours') at time zone 'America/Sao_Paulo';
-- begin
--   -- E2 daqui a 3 h, com 1 ingresso; E5 daqui a 3 h também, mas com erro forçado; E3 com start_date
--   -- de 40 dias atrás e date daqui a 10 dias (fora da janela e não pode ser apagado)
--   update public.events set date = daqui3h::date, time = daqui3h::time where id in (pg_temp.u(902), pg_temp.u(905));
--   perform pg_temp.ingresso(1400, 912, 902, 58);
--   perform pg_temp.ingresso(1401, 915, 905, 59);
--   create function pg_temp.falha() returns trigger language plpgsql as $f$
--   begin if new.ticket_id = 'b0000000-0000-4000-8000-000000001401' then raise exception 'erro forçado'; end if; return new; end $f$;
--   create trigger falha before insert on public.table_members for each row execute function pg_temp.falha();
--   update public.events set start_date = now() - interval '40 days', date = current_date + 10 where id = pg_temp.u(903);
--   perform pg_temp.ingresso(1402, 913, 903, 59);
--   update public.events set date = current_date - 40 where id = pg_temp.u(901);
--   execute formar;
--   drop trigger falha on public.table_members;
--   assert exists (select 1 from public.table_members where ticket_id = pg_temp.u(1400)), 'evento com erro derrubou os outros';
--   assert not exists (select 1 from public.table_members where ticket_id = pg_temp.u(1401)), 'evento com erro formou';
--   assert not exists (select 1 from public.table_members where ticket_id = pg_temp.u(1402)), 'formou fora da janela (usou start_date)';
--   execute apagar;
--   assert not exists (select 1 from public.collective_tables where event_id = pg_temp.u(901)), 'não apagou mesas de 40 dias';
--   assert exists (select 1 from public.collective_tables where event_id = pg_temp.u(903)), 'apagou evento futuro pelo start_date';
--   perform pg_temp.como((select user_id from public.tickets where event_id = pg_temp.u(903) and status = 'active' order by id limit 1));
--   assert (public.minha_mesa(pg_temp.u(903)) ->> 'forma_em')::timestamptz
--          = ((current_date + 10) + time '22:00') at time zone 'America/Sao_Paulo' - interval '24 hours', 'forma_em pelo start_date';
--   perform pg_temp.como(null);
--   raise notice 'T13 OK: janela pelo date/time; erro isolado por evento; limpeza de 30 dias';
-- end $t$;
--
-- -- T14. mesa_compat: perfis iguais = 100; opostos = 60 (a intenção parcial soma 10); Jaccard soma
-- do $t$
-- begin
--   assert public.mesa_compat('{"temperament":"introvert","energy_level":"low","intention":"fun","music_style":"rock"}',
--                             '{"temperament":"introvert","energy_level":"low","intention":"fun","music_style":"rock"}') = 100, 'iguais';
--   assert public.mesa_compat('{"temperament":"introvert","energy_level":"low","intention":"network","music_style":"jazz"}',
--                             '{"temperament":"extrovert","energy_level":"high","intention":"fun","music_style":"sertanejo"}') = 60, 'opostos';
--   assert public.mesa_compat('{"temperament":"introvert","energy_level":"low","tags":{"musica":["rock"]}}',
--                             '{"temperament":"extrovert","energy_level":"high","tags":{"musica":["rock","pop"]}}') = 55, 'jaccard 1/2';
--   raise notice 'T14 OK: mesa_compat';
-- end $t$;
--
-- -- T15. Mesa coletiva só para 18+ com data de nascimento (gatilho mesa_idade_guard); ingresso
-- --      individual não muda; quem ficou sem data depois da compra fica fora da mesa, com aviso
-- do $t$
-- begin
--   insert into public.ticket_types (id, event_id, name, type, capacity) values (pg_temp.u(916), pg_temp.u(904), 'Pista', 'individual', 100);
--   assert pg_temp.erro('select pg_temp.ingresso(1600, 914, 904, 61)') = '22023', 'sem data de nascimento passou';
--   assert pg_temp.erro('select pg_temp.ingresso(1601, 914, 904, 62)') = '22023', '17 anos passou';
--   assert pg_temp.erro('select pg_temp.ingresso(1602, 914, 904, 63)') = 'ok', '18 anos hoje barrado';
--   assert pg_temp.erro('select pg_temp.ingresso(1603, 916, 904, 62)') = 'ok', 'individual de menor barrado';
--   assert pg_temp.erro(format('update public.tickets set ticket_type_id = %L where id = %L', pg_temp.u(914), pg_temp.u(1603))) = '22023', 'troca para coletiva de menor passou';
--   assert pg_temp.erro(format('update public.tickets set user_id = %L where id = %L', pg_temp.u(61), pg_temp.u(1602))) = '22023', 'transferência para quem não tem data passou';
--   perform set_config('role', 'service_role', true);
--   assert pg_temp.erro('select pg_temp.ingresso(1604, 914, 904, 62)') = '22023', 'service_role passou';
--   perform set_config('role', 'postgres', true);
--   -- defesa: comprou com 18+, a data sumiu depois; formar_mesas deixa fora (WARNING esperado)
--   update public.profiles set birth_date = null where id = pg_temp.u(63);
--   perform public.formar_mesas(pg_temp.u(904));
--   assert not exists (select 1 from public.table_members where ticket_id = pg_temp.u(1602)), 'sem data foi alocado';
--   raise notice 'T15 OK: coletiva só 18+ com data (inclusive service_role); individual livre; defesa na formação';
-- end $t$;
-- -- T16. Pedido (order_items), antes da cobrança: coletiva só com quantidade 1, comprador 18+ com
-- --      data de nascimento, 1 item coletivo por pedido e nenhum ingresso coletivo já ativo no evento
-- do $t$
-- declare o45 uuid := gen_random_uuid(); o62 uuid := gen_random_uuid(); o43 uuid := gen_random_uuid(); item uuid;
-- begin
--   insert into public.orders (id, user_id, event_id, status) values
--     (o45, pg_temp.u(45), pg_temp.u(904), 'pending'), (o62, pg_temp.u(62), pg_temp.u(904), 'pending'),
--     (o43, pg_temp.u(43), pg_temp.u(904), 'pending');
--   assert pg_temp.erro(format('insert into public.order_items (order_id, ticket_type_id, quantity) values (%L, %L, 2)', o45, pg_temp.u(914))) = '22023', 'coletiva com quantidade 2 passou';
--   insert into public.order_items (order_id, ticket_type_id, quantity) values (o45, pg_temp.u(914), 1) returning id into item;
--   assert pg_temp.erro(format('insert into public.order_items (order_id, ticket_type_id, quantity) values (%L, %L, 1)', o45, pg_temp.u(914))) = '22023', '2º item coletivo no pedido passou';
--   assert pg_temp.erro(format('update public.order_items set quantity = 2 where id = %L', item)) = '22023', 'update para quantidade 2 passou';
--   assert pg_temp.erro(format('insert into public.order_items (order_id, ticket_type_id, quantity) values (%L, %L, 1)', o62, pg_temp.u(914))) = '22023', 'coletiva de menor passou';
--   assert pg_temp.erro(format('insert into public.order_items (order_id, ticket_type_id, quantity) values (%L, %L, 3)', o62, pg_temp.u(916))) = 'ok', 'individual de menor barrado';
--   assert pg_temp.erro(format('insert into public.order_items (order_id, ticket_type_id, quantity) values (%L, %L, 1)', o43, pg_temp.u(914))) = '22023', 'quem já tem coletiva comprou outra';
--   raise notice 'T16 OK: pedido coletivo barrado antes da cobrança (quantidade, idade, duplicado); individual livre';
-- end $t$;
--
-- -- T17. Transferência só trocando o dono: o antigo some de mesas_do_evento e minha_mesa na hora e
-- --      sai na rodada seguinte, em que o novo dono entra; reembolsado também some de mesas_do_evento
-- do $t$
-- declare r jsonb; n int;
-- begin
--   update public.tickets set user_id = pg_temp.u(47) where id = pg_temp.u(1503);   -- de 43 para 47
--   update public.tickets set status = 'refunded' where id = pg_temp.u(1500);       -- 41
--   perform pg_temp.como(pg_temp.u(1));
--   r := public.mesas_do_evento(pg_temp.u(904));
--   assert r::text not like '%' || pg_temp.u(1503) || '%' and r::text not like '%' || pg_temp.u(1500) || '%'
--      and r::text not like '%Pessoa 43%' and r::text not like '%Pessoa 41%', format('mesas_do_evento mostra quem saiu: %s', r);
--   perform pg_temp.como(null);
--   assert not exists (select 1 from pg_temp.colegas(pg_temp.u(42), pg_temp.u(904)) c where c ->> 'nome' like 'Pessoa 43%'), 'antigo dono em minha_mesa';
--   n := public.formar_mesas(pg_temp.u(904));
--   assert n = 1 and exists (select 1 from public.table_members where ticket_id = pg_temp.u(1503) and user_id = pg_temp.u(47)), format('novo dono não entrou (n=%s)', n);
--   assert not exists (select 1 from public.table_members where user_id = pg_temp.u(43)), 'antigo dono ficou';
--   perform pg_temp.como(pg_temp.u(1));
--   assert public.mesas_do_evento(pg_temp.u(904))::text like '%Pessoa 47 Sobrenome%', 'produtor não vê o novo dono';
--   perform pg_temp.como(null);
--   raise notice 'T17 OK: transferência troca a pessoa; quem saiu some de mesas_do_evento';
-- end $t$;
--
-- -- T18. Consentimento de versão antiga do termo = não vigente: só o primeiro nome (e reciprocidade)
-- do $t$
-- declare a uuid; b uuid; mesa uuid; ca jsonb;
-- begin
--   select c.id into mesa from public.collective_tables c where c.event_id = pg_temp.u(903) and c.name = 'Mesa 1';
--   select m.user_id into a from public.table_members m where m.table_id = mesa and public.mesa_ok(m.user_id) order by m.ticket_id limit 1;
--   select m.user_id into b from public.table_members m where m.table_id = mesa and public.mesa_ok(m.user_id) and m.user_id <> a order by m.ticket_id limit 1;
--   update public.user_profiles_ext set mesa_consent_version = '2025-01-01' where user_id = a;
--   select c into ca from pg_temp.colegas(b, pg_temp.u(903)) c where c ->> 'nome' = (select split_part(full_name, ' ', 1) from public.profiles where id = a)
--     and not (c ->> 'eu')::boolean;
--   assert ca is not null and ca -> 'foto' = 'null' and ca -> 'tags' = 'null', format('versão antiga exposta: %s', ca);
--   assert (select bool_and(c ->> 'nome' not like '% %') from pg_temp.colegas(a, pg_temp.u(903)) c), 'versão antiga viu perfis completos';
--   raise notice 'T18 OK: termo de versão antiga não vale';
-- end $t$;
--
-- -- T19. mesa_revogar apaga a nota das mesas da pessoa
-- do $t$
-- declare mesa uuid; quem uuid;
-- begin
--   select c.id into mesa from public.collective_tables c where c.event_id = pg_temp.u(903) and c.name = 'Mesa 1';
--   assert (select compatibility_score is not null from public.collective_tables where id = mesa), 'preparo: Mesa 1 sem nota';
--   select m.user_id into quem from public.table_members m where m.table_id = mesa and public.mesa_ok(m.user_id) order by m.ticket_id limit 1;
--   perform pg_temp.como(quem);
--   perform public.mesa_revogar();
--   perform pg_temp.como(null);
--   assert (select compatibility_score is null from public.collective_tables where id = mesa), 'nota ficou depois de revogar';
--   raise notice 'T19 OK: revogar apaga a nota da mesa';
-- end $t$;
-- -- T20. Reativação, check-in, troca de pedido, troca de tipo e consentimento de menor
-- do $t$
-- declare o45 uuid; o62 uuid; item uuid;
-- begin
--   -- reativação duplicada: 1700 cancelado, 1701 ativo; voltar 1700 para active → 22023
--   perform pg_temp.ingresso(1700, 914, 904, 49);
--   update public.tickets set status = 'cancelled' where id = pg_temp.u(1700);
--   perform pg_temp.ingresso(1701, 914, 904, 49);
--   assert pg_temp.erro(format('update public.tickets set status = %L where id = %L', 'active', pg_temp.u(1700))) = '22023', 'reativação duplicada passou';
--   assert pg_temp.erro(format('update public.tickets set status = %L where id = %L', 'used', pg_temp.u(1700))) = '22023', 'reativação como used passou';
--   -- check-in de quem ficou sem data de nascimento depois da compra: passa
--   perform pg_temp.ingresso(1702, 914, 904, 50);
--   update public.profiles set birth_date = null where id = pg_temp.u(50);
--   assert pg_temp.erro(format('update public.tickets set status = %L where id = %L', 'used', pg_temp.u(1702))) = 'ok', 'check-in barrado';
--   assert pg_temp.erro(format('update public.tickets set status = %L where id = %L', 'refunded', pg_temp.u(1702))) = 'ok', 'reembolso barrado';
--   -- mover item coletivo para o pedido de um menor → 22023
--   select o.id into o45 from public.orders o where o.user_id = pg_temp.u(45) and o.status = 'pending';
--   select o.id into o62 from public.orders o where o.user_id = pg_temp.u(62) and o.status = 'pending';
--   select oi.id into item from public.order_items oi where oi.order_id = o45 and oi.ticket_type_id = pg_temp.u(914);
--   assert pg_temp.erro(format('update public.order_items set order_id = %L where id = %L', o62, item)) = '22023', 'item movido para pedido de menor';
--   -- troca de tipo: com vendas → 22023 (nos dois sentidos); sem vendas → passa
--   assert pg_temp.erro(format('update public.ticket_types set type = %L where id = %L', 'individual', pg_temp.u(914))) = '22023', 'coletiva vendida virou individual';
--   assert pg_temp.erro(format('update public.ticket_types set type = %L where id = %L', 'coletiva', pg_temp.u(916))) = '22023', 'individual vendido virou coletiva';
--   insert into public.ticket_types (id, event_id, name, type, capacity) values (pg_temp.u(917), pg_temp.u(904), 'Nova', 'coletiva', 10);
--   assert pg_temp.erro(format('update public.ticket_types set type = %L where id = %L', 'vip', pg_temp.u(917))) = 'ok', 'troca sem vendas barrada';
--   assert pg_temp.erro(format('update public.ticket_types set name = %L where id = %L', 'Mesa Tinder', pg_temp.u(914))) = 'ok', 'renomear barrado';
--   -- mesa_consentir de menor → 22023
--   perform pg_temp.como(pg_temp.u(62));
--   assert pg_temp.erro(format('select public.mesa_consentir(%L)', public.mesa_termo_versao())) = '22023', 'menor consentiu';
--   perform pg_temp.como(null);
--   raise notice 'T20 OK: reativação duplicada barrada; check-in livre; pedido de menor; tipo travado após venda; menor não consente';
-- end $t$;
-- rollback;
