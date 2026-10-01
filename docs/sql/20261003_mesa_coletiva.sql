-- =============================================================================
-- Mesa Tinder: formação, escolha da mesa, perfil, consentimento, denúncia e moderação da foto
-- (PR A, com o A2 incorporado) — banco — 2026-10-03
-- Aplicar à mão no SQL Editor do Supabase, de uma vez. NÃO vai para supabase/migrations (Decisão 02).
-- Plano: Claude/Planos/groovy-waddling-wilkinson (PR A).
-- Contrato: o navegador não lê nem escreve collective_tables, table_members, mesa_consentimentos e
-- mesa_denuncias; tudo passa por funções SECURITY DEFINER com 2FA (gf_mfa_ok), porque a RLS filtra
-- linhas e não colunas: formar_mesas e mesas_do_evento (produtor/admin/cron), minha_mesa,
-- mesas_para_escolher, escolher_mesa, mesa_sair/mesa_voltar e mesa_denunciar (participante),
-- mesa_consentir/mesa_revogar e mesa_mostrar_rede/mesa_ocultar_rede (consentimentos),
-- meus_avisos_mesa/marcar_avisos_lidos (participante), mesa_denuncias_do_evento e
-- mesa_remover_membro (produtor/moderador), mesa_denuncia_status, mesa_denuncia_liberar,
-- mesa_travas_do_evento, mesa_destravar, mesa_fotos_para_revisar e mesa_foto_decidir (moderador:
-- permissão moderate_mesa e sessão aal2).
-- TESTES: em 20261003_mesa_coletiva_testes.sql (só em banco descartável), aplicado depois deste.
-- Decisões do Ricardo (30/09):
--   - só maiores de 18, 1 cadeira por ingresso e 1 ingresso coletivo por conta em cada evento; quem
--     tem menor no grupo compra mesa normal. A compra exige só a data de nascimento;
--   - para aparecer, só nome, idade e foto (aprovada na moderação) são obrigatórios;
--     questionário, etiquetas, escolaridade e rede social são opcionais ("mesa_ok");
--   - Decisão 94: o colega aparece só com o primeiro nome e a faixa de idade, mais foto, perfil,
--     etiquetas e escolaridade; a rede social só com um segundo aceite. Quem não é mesa_ok tem
--     lugar, aparece só com o primeiro nome e vê os colegas do mesmo jeito (reciprocidade);
--   - escolher a mesa vendo quem está nela, ou "Mesa nova"; trocar sem limite, com vaga, até 2 h
--     antes; quem não escolher é alocado 24 h antes, e a formação completa as mesas com vaga
--     (Decisão 84); participante não bloqueia participante;
--   - denúncia com um toque, sem bloqueio; o admin faz a triagem e libera ao produtor, que vê
--     denunciado, motivo e mesa, menos contra ele ou a equipe dele. Guarda no bloco 3e;
--   - contra perseguição: 30 min entre trocas, aviso "entrou alguém na sua mesa" (sem dizer quem) e
--     remoção pelo produtor ou pelo admin (mesa_remover_membro), com trava, só de quem tem denúncia no evento;
--   - risco aceito: mesas_para_escolher mostra o cartão mesmo em mesa de 1 pessoa (quem está sozinho
--     fica identificável pela foto); o Ricardo decidiu mostrar sempre.
-- FOTO: o app grava a foto em profiles.avatar_url como data:image/jpeg;base64 (app/src/lib/
-- avatarUpload.ts), sem Storage; só esse formato vale para a mesa (blocos 2d e 4b'). Quando a foto
-- for para o Storage, rever (URL de outro bucket ou arquivo sobrescrito depois da moderação).
-- O Supabase dá EXECUTE/ALL a anon e authenticated por padrão (default privileges): por isso
-- cada função e tabela tem revoke explícito seguido do grant mínimo (bloco 7).
-- Permissão nova de admin: moderate_mesa (gf_admin_can já libera super_admin); dar a quem modera.
-- Pré-requisitos (conferidos em 30/09): gf_admin_can, gf_mfa_ok
-- (20260930_2fa_no_banco.sql), team_members, pg_cron, pg_net, Vault, ai_settings e ai_custo
-- (20260929_agente_evo.sql); table_members vazia (o bloco 3 para com erro se não estiver).
-- MODERAÇÃO AUTOMÁTICA DA FOTO (Fase E do plano; Edge Function moderar-foto, outro PR):
--   Criar o segredo no Vault, uma vez, no SQL Editor (valor longo e aleatório, nunca neste arquivo):
--     select vault.create_secret('<valor longo aleatório>', 'mesa_moderacao_secret');
--   A Edge Function lê o mesmo segredo por mesa_moderacao_secret() (bloco 6e), como a chat-notify;
--   não há segredo a cadastrar nela. Sem o segredo no Vault, o cron moderar_fotos (bloco 8) não chama nada.
-- Idempotente: pode rodar de novo.
-- ORDEM: aplicar só junto com o PR do front que troca useMatchmaking, YourTable e ProfileQuiz
-- (PR B/C). Antes dele, o questionário que grava "romance" (CHECK do bloco 2) e a tela antiga da
-- mesa (lê table_members direto, sem GRANT depois do bloco 7) dão erro. O PR B também tem de parar
-- de enviar gender, bio e birth_year (RIPD R03, CHECK do bloco 2): o questionário atual grava gender.
-- E tem de continuar enviando a foto em base64 (data:image/jpeg;base64) como hoje; se a foto for
-- para o Storage, rever este SQL antes.
-- PENDÊNCIA FASE 4: o gatilho do pedido (mesa_pedido_guard, bloco 3c) reduz, não elimina: dois
-- pedidos pendentes da mesma pessoa passam. Na Fase 4, o create-payment tem de refazer a checagem
-- (incluindo pedidos pagos do evento) e o estorno no webhook ao receber 22023 de mesa_idade_guard
-- é obrigatório.
-- Notificação de denúncia: a tabela notifications não tem policy (o front não a lê) e as colunas
-- divergem entre o esquema (body/metadata) e o hook useNotifications (message/data); o produtor e o
-- admin veem as denúncias pela lista.
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
  add column if not exists mesa_consent_revoked_at timestamptz,
  add column if not exists rede_consent_at timestamptz,
  add column if not exists rede_consent_revoked_at timestamptz;

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

-- RIPD R03: gênero, bio e ano de nascimento fora de propósito (a idade vem de profiles.birth_date).
-- 0 linhas em produção (30/09); o update zera o que houver antes do CHECK.
update public.user_profiles_ext set gender = null, bio = null, birth_year = null
where gender is not null or bio is not null or birth_year is not null;
alter table public.user_profiles_ext drop constraint if exists user_profiles_ext_sem_dado_extra_chk;
alter table public.user_profiles_ext add constraint user_profiles_ext_sem_dado_extra_chk check (
  gender is null and bio is null and birth_year is null);

-- 2b. Histórico do consentimento (prova do aceite e da revogação, da mesa e da rede social). Só as
--     funções do bloco 6 gravam.
create table if not exists public.mesa_consentimentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  versao text,
  acao text not null check (acao in ('consentiu', 'revogou')),
  em timestamptz not null default now()
);
create index if not exists mesa_consentimentos_user_idx on public.mesa_consentimentos (user_id);
alter table public.mesa_consentimentos drop constraint if exists mesa_consentimentos_acao_check;
alter table public.mesa_consentimentos add constraint mesa_consentimentos_acao_check check (
  acao in ('consentiu', 'revogou', 'mostrou_rede', 'ocultou_rede'));
alter table public.mesa_consentimentos enable row level security;

-- 2c. As colunas mesa_consent_* e rede_consent_* só mudam pelas funções (que rodam como o dono, não
--     como anon/authenticated).
--     current_user, e não o JWT: é o papel que de fato executa o comando.
create or replace function public.mesa_consent_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') and (
       (tg_op = 'INSERT' and (new.mesa_consent_version is not null or new.mesa_consent_at is not null
                              or new.mesa_consent_revoked_at is not null
                              or new.rede_consent_at is not null or new.rede_consent_revoked_at is not null))
    or (tg_op = 'UPDATE' and (new.mesa_consent_version is distinct from old.mesa_consent_version
                              or new.mesa_consent_at is distinct from old.mesa_consent_at
                              or new.mesa_consent_revoked_at is distinct from old.mesa_consent_revoked_at
                              or new.rede_consent_at is distinct from old.rede_consent_at
                              or new.rede_consent_revoked_at is distinct from old.rede_consent_revoked_at))) then
    raise exception 'Consentimento da mesa só por mesa_consentir/mesa_revogar/mesa_mostrar_rede/mesa_ocultar_rede'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists mesa_consent_guard on public.user_profiles_ext;
create trigger mesa_consent_guard before insert or update on public.user_profiles_ext
  for each row execute function public.mesa_consent_guard();

-- 2d. Moderação da foto (decisão do Ricardo, 30/09): uma Edge Function (outro PR, com service_role)
--     grava aprovada/recusada/revisar; o admin decide (mesa_foto_decidir, bloco 6d). A aprovação vale
--     para a foto moderada, identificada por avatar_moderacao_hash = mesa_foto_hash(avatar_url), o
--     sha256 em hexadecimal (sem guardar
--     outra cópia do base64): trocar a foto volta tudo para pendente. Fotos já existentes começam
--     pendentes. Contrato da Edge Function: o mesmo de mesa_foto_decidir, ou seja, gravar só
--     "where public.mesa_foto_hash(avatar_url) = <hash moderado> and avatar_moderacao in
--     ('pendente', 'revisar')" (ou 'aprovada', para revogar), gravando avatar_moderacao_hash = <hash>.
alter table public.profiles
  add column if not exists avatar_moderacao text not null default 'pendente',
  add column if not exists avatar_moderado_em timestamptz,
  add column if not exists avatar_moderacao_hash text,
  add column if not exists avatar_moderacao_tentativas int not null default 0,
  add column if not exists avatar_moderacao_reservada_ate timestamptz,
  drop column if exists avatar_moderacao_url;
-- fila da moderação (pendentes são poucas perto da base toda)
create index if not exists profiles_avatar_pendente_idx on public.profiles (avatar_moderacao) where avatar_moderacao = 'pendente';
alter table public.profiles drop constraint if exists profiles_avatar_moderacao_chk;
alter table public.profiles add constraint profiles_avatar_moderacao_chk check (
  avatar_moderacao in ('pendente', 'aprovada', 'recusada', 'revisar'));

-- anon/authenticated não gravam as 3 colunas (mesmo padrão de current_user de mesa_consent_guard);
-- service_role e funções SECURITY DEFINER gravam. Convive com gf_protect_profile_privileges
-- (20260927_security_hardening.sql), que roda antes (ordem alfabética dos gatilhos) e só olha
-- role, admin_permissions, is_verified e stripe_customer_id.
create or replace function public.mesa_avatar_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') and (
       (tg_op = 'INSERT' and (new.avatar_moderacao is distinct from 'pendente' or new.avatar_moderado_em is not null
                              or new.avatar_moderacao_hash is not null or new.avatar_moderacao_tentativas <> 0
                              or new.avatar_moderacao_reservada_ate is not null))
    or (tg_op = 'UPDATE' and (new.avatar_moderacao is distinct from old.avatar_moderacao
                              or new.avatar_moderado_em is distinct from old.avatar_moderado_em
                              or new.avatar_moderacao_hash is distinct from old.avatar_moderacao_hash
                              or new.avatar_moderacao_tentativas is distinct from old.avatar_moderacao_tentativas
                              or new.avatar_moderacao_reservada_ate is distinct from old.avatar_moderacao_reservada_ate))) then
    raise exception 'Moderação da foto só pelo sistema' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.avatar_url is distinct from old.avatar_url then
    new.avatar_moderacao := 'pendente';
    new.avatar_moderado_em := null;
    new.avatar_moderacao_hash := null;
    new.avatar_moderacao_tentativas := 0;
    new.avatar_moderacao_reservada_ate := null;
  end if;
  return new;
end;
$$;
drop trigger if exists mesa_avatar_guard on public.profiles;
create trigger mesa_avatar_guard before insert or update on public.profiles
  for each row execute function public.mesa_avatar_guard();

-- 2e. Decisões da moderação automática (mesa_foto_resultado_auto, bloco 6e): prova da decisão (a
--     pessoa pode contestar: mesa_foto_contestar, decisao 'contestada') e controle de custo. Só recebe
--     inserção, pelas funções; RLS sem policy e sem grant. Some com a conta (cascade). Guarda (cron
--     diário, bloco 8): os motivos, que podem ser sensíveis (nudez, drogas…), são zerados aos 30 dias;
--     decisão, custo e data ficam até os 180 dias. PENDÊNCIA: prazos sujeitos ao jurídico.
create table if not exists public.mesa_moderacoes (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  hash text not null,
  decisao text not null check (decisao in ('aprovada', 'recusada', 'revisar', 'erro', 'contestada')),
  motivos text[] not null default '{}' check (motivos <@ array['nudez', 'violencia', 'odio', 'politica', 'drogas',
    'sem_rosto', 'famoso', 'texto_contato', 'bloqueio_seguranca', 'formato', 'outro']::text[]),
  modelo text,
  tokens_in int,
  tokens_out int,
  custo numeric,
  em timestamptz not null default now()
);
create index if not exists mesa_moderacoes_user_idx on public.mesa_moderacoes (user_id, hash);
create index if not exists mesa_moderacoes_em_idx on public.mesa_moderacoes (em);  -- teto diário e limpeza
alter table public.mesa_moderacoes enable row level security;

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

-- 3a. oculto: "sair da Mesa Tinder" (mesa_sair, bloco 5f): a cadeira continua, o perfil some.
--     ultima_troca_em: 30 min entre trocas da mesma pessoa (escolher_mesa; a 1ª escolha não conta).
alter table public.table_members
  add column if not exists oculto boolean not null default false,
  add column if not exists ultima_troca_em timestamptz,
  drop column if exists mesas_anteriores;

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
-- Rascunhos do A2 (30/09) com bloqueio entre participantes, que o Ricardo tirou no mesmo dia; nunca
-- foram aplicados em produção.
drop function if exists public.mesa_bloquear(uuid), public.mesa_desbloquear(uuid), public.meus_bloqueios(),
  public.mesa_bloqueio_novo(public.table_members), public.mesa_membro_alvo(uuid);
drop table if exists public.mesa_bloqueios;
alter table public.table_members drop column if exists trocas, drop column if exists troca_livre,
  drop column if exists trocas_livres, drop column if exists livres_ganhas;

-- A view antiga não é lida por ninguém que continue (useCollectiveTables sai no PR C); ela também
-- impediria a troca de tipo abaixo.
drop view if exists public.collective_table_summary;
-- numeric(3,1) de produção não comporta 100.0
alter table public.collective_tables alter column compatibility_score type numeric(4,1);

-- 3e. Denúncias da Mesa Tinder (bloco 5g). Nascem "aberta" e só o moderador as vê; o moderador faz
--     a triagem e libera ao produtor (liberada_produtor_em, mesa_denuncia_liberar), que continua vendo
--     a denúncia mesmo depois de o status mudar. Guarda (decisão do Ricardo, 30/09): detalhe
--     apagado 180 dias depois do evento, salvo em_apuracao ou judicial; a denúncia, 3 anos depois,
--     salvo em_apuracao ou judicial (cron apagar_mesas_antigas, bloco 8). Sobrevive à exclusão da
--     conta e do evento (nomes gravados na hora; evento_em guarda a data do evento para a limpeza).
--     Não bloqueia ninguém (participante não bloqueia participante, decisão de 30/09).
--     Nunca aplicada em produção: create table if not exists basta.
create table if not exists public.mesa_denuncias (
  id uuid primary key default gen_random_uuid(),
  denunciante uuid references public.profiles(id) on delete set null,
  denunciado uuid references public.profiles(id) on delete set null,
  denunciante_nome text,
  denunciado_nome text,
  evento uuid references public.events(id) on delete set null,
  evento_em timestamptz not null,
  table_id uuid,  -- a mesa do denunciado (sem FK: a mesa pode ser apagada)
  mesa text,      -- o nome dela na hora
  motivo text not null check (motivo in ('assedio', 'perfil_falso', 'conteudo_improprio', 'outro')),
  -- sem caracteres de controle nem de direção de texto (bidi)
  detalhe text check (char_length(detalhe) <= 500
    and detalhe !~ '[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f؜‎‏‪-‮⁦-⁩]'),
  mesma_mesa boolean not null,  -- estiveram na mesma mesa ao mesmo tempo (base do "assedio")
  -- o período em que estiveram juntos (prova: mesa_passagens some em 30 dias)
  sobreposicao_inicio timestamptz,
  sobreposicao_fim timestamptz,
  criado_em timestamptz not null default now(),
  status text not null default 'aberta' check (status in ('aberta', 'em_apuracao', 'resolvida', 'judicial')),
  status_mudado_por uuid references public.profiles(id) on delete set null,
  status_mudado_em timestamptz,
  liberada_produtor_em timestamptz,
  liberada_por uuid references public.profiles(id) on delete set null,
  -- resolvida exige resultado e explicação (mesa_denuncia_status, que também limpa os dois ao sair de
  -- 'resolvida'). A explicação é apagada com o detalhe, 180 dias depois do evento (cron), então o CHECK
  -- só exige o resultado; o resultado fica com o registro (3 anos). Só o moderador lê a explicação.
  resultado text check (resultado in ('procedente', 'improcedente')),
  resultado_explicacao text check (char_length(resultado_explicacao) between 10 and 1000
    and resultado_explicacao !~ '[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f؜‎‏‪-‮⁦-⁩]'
    and resultado_explicacao ~ '[[:alnum:]]'),
  unique (denunciante, denunciado, evento),
  check (motivo <> 'assedio' or mesma_mesa),
  check (case when status = 'resolvida' then resultado is not null
              else resultado is null and resultado_explicacao is null end)
);
create index if not exists mesa_denuncias_evento_idx on public.mesa_denuncias (evento);
alter table public.mesa_denuncias enable row level security;

-- 3f. Passagens pelas mesas (gatilho mesa_passagem, bloco 4h): quem esteve em que mesa e quando.
--     Base de "mesma mesa ao mesmo tempo" e da denúncia depois da saída (reembolso, transferência,
--     troca). membro_id = id da linha de table_members (o id que o participante vê). Sem FK para a
--     mesa, que pode ser apagada; some com a limpeza de 30 dias (bloco 8).
create table if not exists public.mesa_passagens (
  id uuid primary key default gen_random_uuid(),
  membro_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  ticket_id uuid not null,
  evento uuid not null references public.events(id) on delete cascade,
  table_id uuid not null,
  entrou_em timestamptz not null,
  saiu_em timestamptz
);
create index if not exists mesa_passagens_membro_idx on public.mesa_passagens (membro_id);
create index if not exists mesa_passagens_mesa_idx on public.mesa_passagens (table_id);
create index if not exists mesa_passagens_user_idx on public.mesa_passagens (user_id, evento);
alter table public.mesa_passagens enable row level security;

-- 3g. Avisos à pessoa: "entrou" (alguém entrou na sua mesa, nunca quem) e "removido" (a organização
--     tirou você da mesa, mesa_remover_membro). 1 aviso não lido por mesa e tipo (dedupe).
create table if not exists public.mesa_avisos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  evento uuid not null references public.events(id) on delete cascade,
  table_id uuid,
  mesa text,
  tipo text not null default 'entrou' check (tipo in ('entrou', 'removido')),
  criado_em timestamptz not null default now(),
  lido boolean not null default false
);
drop index if exists public.mesa_avisos_nao_lido_uq;
create unique index mesa_avisos_nao_lido_uq on public.mesa_avisos (user_id, table_id, tipo) where not lido;
alter table public.mesa_avisos enable row level security;

-- 3h. Travas (mesa_remover_membro): a pessoa tirada da mesa pelo produtor ou pelo moderador não
--     escolhe mesa nem é alocada de novo no evento (a cadeira física se resolve no local). A trava é
--     da pessoa no evento (evento, user_id): recomprar depois de reembolso continua travado, e quem
--     recebe um ingresso transferido não herda nada. Motivo de lista fechada; "outro" exige detalhe.
--     Só o moderador destrava (mesa_destravar), com registro. Tabela própria porque
--     table_members.table_id é obrigatório (a linha não fica sem mesa).
--     Guarda: 180 dias depois do evento (cron, bloco 8), como o detalhe da denúncia; PENDÊNCIA:
--     prazo sujeito a decisão do jurídico. Nunca aplicada em produção: create table if not exists basta.
create table if not exists public.mesa_travas (
  id uuid primary key default gen_random_uuid(),
  evento uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  ticket_id uuid references public.tickets(id) on delete set null,  -- o ingresso da hora (informativo)
  motivo text not null check (motivo in ('denuncia_triada', 'comportamento_no_local', 'pedido_da_pessoa', 'outro')),
  detalhe text check (char_length(detalhe) between 3 and 500
    and detalhe !~ '[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f؜‎‏‪-‮⁦-⁩]'),
  por uuid references public.profiles(id) on delete set null,
  em timestamptz not null default now(),
  destravada_por uuid references public.profiles(id) on delete set null,
  destravada_em timestamptz,
  check (motivo <> 'outro' or detalhe is not null)
);
-- a denúncia que justificou a remoção (mesa_remover_membro); sem ela a remoção não acontece
alter table public.mesa_travas add column if not exists denuncia_id uuid references public.mesa_denuncias(id) on delete set null;
create unique index if not exists mesa_travas_vigente_uq on public.mesa_travas (evento, user_id) where destravada_em is null;
alter table public.mesa_travas enable row level security;

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

-- 4b0. Formato da foto: só a que o app grava (data:image/jpeg;base64, avatarUpload.ts), até 60.000
--      caracteres. Fecha URL externa, de outro bucket ou de arquivo trocado depois da moderação.
create or replace function public.mesa_foto_formato(p text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  -- até 60.000 caracteres (a foto do app, 150×150 em JPEG, fica bem abaixo); o tamanho antes da regex
  select case when length(p) > 60000 then false
              else coalesce(p ~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$', false) end
$$;

-- 4b1. Hash da foto (sha256, hexadecimal): o que a moderação aprova.
create or replace function public.mesa_foto_hash(p text)
returns text
language sql
immutable
set search_path = ''
as $$ select encode(sha256(convert_to(p, 'UTF8')), 'hex') $$;

-- 4b2. Pessoa travada no evento (mesa_travas vigente). Uso interno.
create or replace function public.mesa_travado(p_evento uuid, p_user uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from public.mesa_travas tr
                 where tr.evento = p_evento and tr.user_id = p_user and tr.destravada_em is null);
$$;

-- 4b'. mesa_ok: consentimento vigente (versão atual, não revogado), 18 anos ou mais, nome e foto do
--     app em base64 (mesa_foto_formato), aprovada na moderação para a foto atual (bloco 2d) — os únicos
--     obrigatórios para aparecer (decisão do Ricardo, 30/09). Sem
--     birth_date, não. Com o gatilho mesa_idade_guard (bloco 3b), menor nem chega à mesa; o 18+
--     aqui fica como defesa. Quem apaga a foto ou o nome volta a ser tratado como não mesa_ok (só o
--     primeiro nome, e vê os colegas do mesmo jeito). A compra exige só a idade (blocos 3b e 3c).
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
      and p.birth_date <= current_date - interval '18 years'
      and trim(coalesce(p.full_name, '')) <> ''
      and public.mesa_foto_formato(p.avatar_url)
      and p.avatar_moderacao = 'aprovada' and p.avatar_moderacao_hash = public.mesa_foto_hash(p.avatar_url));
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

-- 4e. mesa_cartao: como um colega aparece para outro (Decisão 94). p_ok = quem vê e quem é visto são
--     mesa_ok e quem é visto não saiu. Sempre só o primeiro nome ("Lugar ocupado" para quem saiu);
--     com p_ok, faixa de idade (nunca a exata), foto, perfil, etiquetas e escolaridade (opcionais
--     vazios saem nulos); a rede social só com o segundo aceite vigente (mesa_mostrar_rede).
--     Uso interno.
create or replace function public.mesa_cartao(p_user uuid, p_ok boolean, p_oculto boolean)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'nome', case when p_oculto then 'Lugar ocupado' else split_part(trim(p.full_name), ' ', 1) end,
    -- anos completos (comparar o intervalo de age() com '25 years' erra no fim de mês de 30 dias:
    -- 24 anos, 11 meses e 30 dias conta como 25 anos)
    'faixa_idade', case when p_ok then case
        when date_part('year', age(p.birth_date)) < 25 then '18–24'
        when date_part('year', age(p.birth_date)) < 35 then '25–34'
        when date_part('year', age(p.birth_date)) < 45 then '35–44'
        when date_part('year', age(p.birth_date)) < 60 then '45–59'
        else '60+' end end,
    'foto', case when p_ok then p.avatar_url end,
    'perfil', case when p_ok then x.vibe end,
    'tags', case when p_ok then coalesce(x.tags, '{}'::jsonb) end,
    'escolaridade', case when p_ok then x.education end,
    'rede_social', case when p_ok and x.rede_consent_at is not null and x.rede_consent_revoked_at is null
                        then x.social_url end)
  from public.profiles p
  left join public.user_profiles_ext x on x.user_id = p.id
  where p.id = p_user;
$$;

-- 4f. Cadeiras ocupadas: só ingresso active/used ainda do mesmo dono (o filtro de minha_mesa), para
--     quem foi reembolsado não segurar vaga até a próxima formar_mesas. Uso interno.
create or replace function public.mesa_ocupados(p_mesa uuid)
returns int
language sql
stable
set search_path = ''
as $$
  select count(*)::int
  from public.table_members m
  join public.tickets t on t.id = m.ticket_id
  where m.table_id = p_mesa and t.user_id = m.user_id and t.status in ('active', 'used');
$$;

-- 4g. Nota e situação (open/full) de uma mesa, como em formar_mesas (nota só com pares mesa_ok).
--     Uso interno.
create or replace function public.mesa_recalcular(p_mesa uuid)
returns void
language sql
set search_path = ''
as $$
  update public.collective_tables c set
    status = case when c.status = 'closed' then 'closed'
                  when public.mesa_ocupados(c.id) >= c.capacity then 'full' else 'open' end,
    compatibility_score = (
      select round(avg(public.mesa_compat(pa.p, pb.p)), 1)
      from public.table_members a
      join public.table_members b on b.table_id = a.table_id and a.ticket_id < b.ticket_id
      cross join lateral (select public.mesa_perfil(a.user_id) p) pa
      cross join lateral (select public.mesa_perfil(b.user_id) p) pb
      where a.table_id = c.id and pa.p is not null and pb.p is not null)
  where c.id = p_mesa;
$$;

-- 4h. Gatilho de table_members: abre e fecha as passagens (bloco 3f) em toda entrada, troca e saída
--     (escolher_mesa, formar_mesas, mesa_remover_membro, reembolso) e avisa quem já estava na mesa
--     que "entrou alguém" (bloco 3g), sem dizer quem, se ainda tiver ingresso válido. SECURITY
--     DEFINER: grava em tabelas fechadas seja quem for que mexa em table_members. "Já estava" =
--     entrou antes deste comando: na
--     primeira formação, todos entram juntos e ninguém é avisado. clock_timestamp: dentro da mesma
--     transação, entrada e saída ficam em ordem.
create or replace function public.mesa_passagem()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.table_id is not distinct from old.table_id then
    return null;
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    update public.mesa_passagens set saiu_em = clock_timestamp() where membro_id = old.id and saiu_em is null;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    insert into public.mesa_passagens (membro_id, user_id, ticket_id, evento, table_id, entrou_em)
    select new.id, new.user_id, new.ticket_id, c.event_id, new.table_id, clock_timestamp()
    from public.collective_tables c where c.id = new.table_id;
    -- só quem ainda tem ingresso active/used dele (reembolsado ou transferido não é avisado)
    insert into public.mesa_avisos (user_id, evento, table_id, mesa, tipo)
    select distinct p.user_id, p.evento, p.table_id, c.name, 'entrou'
    from public.mesa_passagens p
    join public.collective_tables c on c.id = p.table_id
    join public.tickets t on t.id = p.ticket_id and t.user_id = p.user_id and t.status in ('active', 'used')
    where p.table_id = new.table_id and p.saiu_em is null and p.user_id <> new.user_id
      and p.entrou_em < statement_timestamp()
    on conflict (user_id, table_id, tipo) where not lido do nothing;
  end if;
  return null;
end;
$$;
drop trigger if exists mesa_passagem on public.table_members;
create trigger mesa_passagem after insert or update of table_id or delete on public.table_members
  for each row execute function public.mesa_passagem();

-- 4i. Moderação (fotos e denúncias): permissão moderate_mesa (super_admin também passa) e sessão
--     aal2, mesmo sem fator cadastrado (decisão do Ricardo, 30/09). Uso interno.
create or replace function public.mesa_moderador()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.gf_admin_can('moderate_mesa') then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'Ative o 2FA para moderar' using errcode = '42501';
  end if;
end;
$$;

-- 5. Funções da mesa ------------------------------------------------------------------

-- 5a. formar_mesas: aloca quem tem ingresso coletivo (active/used) e ainda não tem lugar; tira quem
--     deixou de ter. Devolve quantas pessoas entraram nesta chamada. Rodar de novo sem mudança nos
--     ingressos não muda nada. Cada tipo de ingresso coletivo tem as próprias mesas; a numeração
--     "Mesa N" é única no evento. Mesa que fica sem ninguém é apagada. Pessoa travada no evento
--     (mesa_travas) fica fora.
--     Com usuário logado: 2FA e produtor do evento, ou moderador (moderate_mesa, aal2). Sem usuário:
--     só o cron/SQL Editor
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
  elsif not public.gf_mfa_ok() then
    raise exception 'Acesso negado' using errcode = '42501';
  elsif not exists (select 1 from public.events e where e.id = p_event_id and e.producer_id = v_uid) then
    -- admin só com moderate_mesa e sessão aal2 (auditoria do PR C)
    perform public.mesa_moderador();
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
      and not exists (select 1 from public.table_members m where m.ticket_id = t.id)
      and not public.mesa_travado(p_event_id, t.user_id);
    -- Defesa além do gatilho mesa_idade_guard: menor ou sem data de nascimento fica fora e é avisado
    -- (só os ids dos ingressos no log, nenhum dado pessoal)
    select array_agg(t.id order by t.id) into v_fora
    from public.tickets t
    left join public.profiles pr on pr.id = t.user_id
    where t.ticket_type_id = v_tipo and t.event_id = p_event_id and t.status in ('active', 'used')
      and (pr.birth_date is null or pr.birth_date > current_date - interval '18 years')
      and not exists (select 1 from public.table_members m where m.ticket_id = t.id)
      and not public.mesa_travado(p_event_id, t.user_id);
    if v_fora is not null then
      raise warning 'formar_mesas(%): % ingresso(s) de menor ou sem data de nascimento fora da mesa: %',
        p_event_id, cardinality(v_fora), v_fora;
    end if;
    continue when v_ids is null;
    v_total := v_total + cardinality(v_ids);

    -- ponytail: uma escolha antecipada (escolher_mesa) cria mesa do tipo e desliga a afinidade da
    -- primeira formação para todo o tipo de ingresso; os demais entram pela fila de quem chega
    -- depois. Separar "mesa escolhida" de "mesa formada" se a afinidade fizer falta.
    if v_primeira then
      -- ntile sobre a fila ordenada: grupos parecidos e equilibrados (13 → 5/4/4). O número da mesa
      -- sai do md5 do menor ingresso do grupo (determinístico e sem revelar a ordem de temperamento).
      v_k := ceil(cardinality(v_ids) / 6.0);
      with u as (
        select u.ticket_id, ntile(v_k) over (order by u.ord) grupo
        from unnest(v_ids) with ordinality u(ticket_id, ord)
      ), g as (
        select u.grupo, v_prox - 1 + row_number() over (order by md5(min(u.ticket_id::text))) numero
        from u group by u.grupo
      ), mesas as (
        insert into public.collective_tables (event_id, ticket_type_id, name, capacity, status)
        select p_event_id, v_tipo, 'Mesa ' || g.numero, 6, 'open' from g
        returning id, name
      )
      -- vibe nula: minha_mesa lê a vibe na hora, com o consentimento vigente
      insert into public.table_members (table_id, user_id, ticket_id, vibe)
      select m.id, t.user_id, t.id, null
      from u
      join g on g.grupo = u.grupo
      join public.tickets t on t.id = u.ticket_id
      join mesas m on m.name = 'Mesa ' || g.numero;
      v_prox := v_prox + v_k;
      v_mudou := v_mudou || array(select c.id from public.collective_tables c where c.ticket_type_id = v_tipo);
    else
      -- Quem chega depois: mesa do mesmo tipo com vaga, primeiro as que já têm gente (com escolha antes
      -- da formação, a formação completa as mesas com vaga: Decisão 84) e, entre elas, a com menos
      -- gente; sem vaga, mesa nova.
      -- ponytail: sem afinidade para quem chega depois (plano); reformar mesa já anunciada confundiria.
      foreach v_ticket in array v_ids loop
        select c.id into v_mesa
        from public.collective_tables c
        cross join lateral (select count(*) n from public.table_members m where m.table_id = c.id) q
        where c.ticket_type_id = v_tipo and c.status <> 'closed' and q.n < c.capacity
        order by (q.n = 0), q.n, c.created_at, substring(c.name from '[0-9]+')::int
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
  -- mesa que ficou sem ninguém (saídas) sai, como em escolher_mesa
  delete from public.collective_tables c
  where c.event_id = p_event_id and not exists (select 1 from public.table_members m where m.table_id = c.id);

  return v_total;
end;
$$;

-- 5b. minha_mesa: as mesas da pessoa logada no evento e os colegas, um por pessoa.
--     "acompanhantes" (mais de um ingresso da mesma pessoa na mesa) é só defesa: mesa_idade_guard
--     e mesa_pedido_guard já garantem 1 ingresso coletivo por conta em cada evento.
--     Nunca devolve user_id, e-mail, telefone, CPF, temperamento, intenção nem a nota da mesa.
--     Colega só aparece com ingresso active/used ainda dele (transferido ou reembolsado some na hora).
--     Cada colega sai como em mesa_cartao (bloco 4e): só o primeiro nome e, quando quem vê E quem é
--     visto são mesa_ok, faixa de idade, foto, perfil, etiquetas, escolaridade e (com o segundo
--     aceite) rede social. "id" é o id da linha de table_members (opaco), para mesa_denunciar; quem
--     saiu (oculto) aparece como "Lugar ocupado", sem id, e também vê os colegas só pelo primeiro
--     nome ("saiu": true).
create or replace function public.minha_mesa(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_eu_ok boolean;
  v_saiu boolean;
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
  -- tirada da mesa pela organização (mesa_remover_membro): sem mesa e sem data de formação
  if public.mesa_travado(p_event_id, v_uid) then
    return jsonb_build_object('mesas', '[]'::jsonb, 'travado', true);
  end if;
  v_saiu := exists (select 1 from public.table_members m join public.collective_tables c on c.id = m.table_id
                    where c.event_id = p_event_id and m.user_id = v_uid and m.oculto);
  v_eu_ok := public.mesa_ok(v_uid) and not v_saiu;

  return jsonb_build_object(
    'forma_em', (select public.evento_momento(e) - interval '24 hours' from public.events e where e.id = p_event_id),
    'saiu', v_saiu,
    'mesas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'nome', c.name,
               'capacidade', c.capacity,
               'colegas', (
                 select jsonb_agg(public.mesa_cartao(g.user_id, k.ok, k.oculto)
                          || jsonb_build_object('id', case when not k.oculto then g.membro end, 'eu', g.user_id = v_uid)
                          || case when g.n > 1 then jsonb_build_object('acompanhantes', g.n - 1) else '{}'::jsonb end
                        order by g.user_id = v_uid desc, k.oculto, g.primeiro)
                 from (select m.user_id, count(*) n, min(m.ticket_id::text) primeiro,
                              (array_agg(m.id order by m.ticket_id))[1] membro, bool_or(m.oculto) oculto
                       from public.table_members m
                       join public.tickets t on t.id = m.ticket_id
                       where m.table_id = c.id and t.user_id = m.user_id and t.status in ('active', 'used')
                       group by m.user_id) g
                 -- a própria pessoa nunca vira "Lugar ocupado" para si mesma
                 cross join lateral (select g.oculto and g.user_id <> v_uid oculto) o
                 cross join lateral (select o.oculto, v_eu_ok and not o.oculto and public.mesa_ok(g.user_id) ok) k)
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

-- 5c. mesas_do_evento: para o produtor (2FA) ou o moderador (moderate_mesa, aal2) acomodar as
--     pessoas (nome completo do dono atual do ingresso e ingresso, um por
--     cadeira). Mesas vazias aparecem, com a lista de membros vazia. Mesmo filtro de minha_mesa:
--     só ingresso active/used ainda do mesmo dono (quem saiu some antes da próxima formação). Sem a
--     nota da mesa (RIPD R14). Quem saiu da Mesa Tinder continua com nome: o produtor sabe quem senta onde.
--     'pode_remover' diz se mesa_remover_membro aceita a pessoa (mesma regra, mesa_denuncia_que_remove:
--     moderador, denúncia já analisada e sem conflito; produtor, a que ele vê e não fez nem liberou),
--     sem expor o user_id.
create or replace function public.mesas_do_evento(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_produtor boolean;
begin
  if not public.gf_mfa_ok() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  v_produtor := exists (select 1 from public.events e where e.id = p_event_id and e.producer_id = (select auth.uid()));
  if not v_produtor then
    -- admin só com moderate_mesa e sessão aal2 (auditoria do PR C): o nome completo de todas as mesas
    perform public.mesa_moderador();
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'numero', substring(c.name from '[0-9]+')::int,
             'nome', c.name,
             'capacidade', c.capacity,
             'membros', (
               -- o nome do dono atual do ingresso (transferido: o novo dono), nunca o de quem comprou
               select coalesce(jsonb_agg(jsonb_build_object('nome', coalesce(nullif(trim(p.full_name), ''), '(sem nome no perfil)'),
                                                            'ingresso', t.id,
                                                            'pode_remover', public.mesa_denuncia_que_remove(p_event_id, t.user_id, v_produtor) is not null)
                                         order by p.full_name, t.id), '[]'::jsonb)
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

-- 5d. mesas_para_escolher: as mesas com vaga do mesmo tipo de ingresso, menos a própria, com quem está
--     nelas (mesa_cartao). Só para quem tem ingresso coletivo válido, é mesa_ok, não saiu, não está
--     travado e está dentro da janela (até 2 h antes do evento); os outros recebem
--     {"mesas": [], "motivo": ...}, sem perfil nenhum. Quem não é mesa_ok ou saiu aparece como
--     "Lugar ocupado", sem id. Etiquetas agregadas só com 3 ou mais perfis visíveis (desenho, 6.2).
--     Risco aceito (Ricardo, 30/09): o cartão aparece mesmo em mesa de 1 pessoa.
create or replace function public.mesas_para_escolher(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ticket uuid;
  v_tipo uuid;
  v_mesa uuid;
  v_saiu boolean;
begin
  if v_uid is null or not public.gf_mfa_ok() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  select t.id, t.ticket_type_id into v_ticket, v_tipo
  from public.tickets t join public.ticket_types tt on tt.id = t.ticket_type_id
  where t.event_id = p_event_id and t.user_id = v_uid and tt.type = 'coletiva' and t.status in ('active', 'used')
  order by t.created_at limit 1;
  if v_ticket is null then
    return jsonb_build_object('mesas', '[]'::jsonb, 'motivo', 'sem_ingresso');
  end if;
  if (select public.evento_momento(e) from public.events e where e.id = p_event_id) - now() < interval '2 hours' then
    return jsonb_build_object('mesas', '[]'::jsonb, 'motivo', 'fora_do_prazo');
  end if;
  if public.mesa_travado(p_event_id, v_uid) then
    return jsonb_build_object('mesas', '[]'::jsonb, 'motivo', 'travado');
  end if;
  if not public.mesa_ok(v_uid) then
    return jsonb_build_object('mesas', '[]'::jsonb, 'motivo', 'sem_perfil');
  end if;
  select m.table_id, m.oculto into v_mesa, v_saiu
  from public.table_members m where m.ticket_id = v_ticket and m.user_id = v_uid;
  if v_saiu then
    return jsonb_build_object('mesas', '[]'::jsonb, 'motivo', 'saiu');
  end if;

  return jsonb_build_object('mesas', coalesce((
    select jsonb_agg(jsonb_build_object(
             'numero', substring(c.name from '[0-9]+')::int,
             'vagas', c.capacity - o.n,
             'pessoas', coalesce(pes.lista, '[]'::jsonb),
             'etiquetas', case when (select count(*) from jsonb_array_elements(pes.lista) x
                                     where jsonb_typeof(x -> 'tags') = 'object') >= 3 then (
               select coalesce(jsonb_agg(jsonb_build_object('categoria', s.cat, 'etiqueta', s.tag, 'pessoas', s.n)
                                         order by s.n desc, s.cat, s.tag), '[]'::jsonb)
               from (select e.key cat, v.tag, count(*)::int n
                     from jsonb_array_elements(pes.lista) x, jsonb_each(x -> 'tags') e, jsonb_array_elements_text(e.value) v(tag)
                     where jsonb_typeof(x -> 'tags') = 'object'
                     group by e.key, v.tag) s) end)
           order by substring(c.name from '[0-9]+')::int)
    from public.collective_tables c
    cross join lateral (select public.mesa_ocupados(c.id) n) o
    cross join lateral (
      select jsonb_agg(public.mesa_cartao(m.user_id, k.ok, not k.ok)
                       || jsonb_build_object('id', case when k.ok then m.id end)
                       order by not k.ok, m.joined_at, m.id) lista
      from public.table_members m
      join public.tickets t on t.id = m.ticket_id
      cross join lateral (select not m.oculto and public.mesa_ok(m.user_id) ok) k
      where m.table_id = c.id and t.user_id = m.user_id and t.status in ('active', 'used')) pes
    where c.event_id = p_event_id and c.ticket_type_id = v_tipo and c.status <> 'closed'
      and c.id is distinct from v_mesa and o.n < c.capacity
  ), '[]'::jsonb));
end;
$$;

-- 5e. escolher_mesa: entra (ou troca) na mesa de número p_mesa_numero; null = "Mesa nova" (a
--     próxima "Mesa N" do evento, capacidade 6, do mesmo tipo de ingresso). Troca sem limite de
--     quantidade, com vaga, até 2 h antes do evento e com 30 min entre uma troca e outra (a 1ª
--     escolha não conta). Ingresso travado (mesa_remover_membro) não escolhe. Mesma trava por evento
--     de formar_mesas. Mesa inexistente, fechada, de outro tipo ou cheia: "Mesa indisponível". A
--     mesa antiga que fica vazia é apagada. Quem já estava na mesa recebe o aviso (gatilho 4h).
--     ponytail: apagar a mesa de número mais alto deixa o número voltar numa "Mesa nova"; guardar o
--     último número do evento se isso confundir alguém.
create or replace function public.escolher_mesa(p_event_id uuid, p_mesa_numero int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  -- Escolha e troca só até 2 h antes do evento; entre trocas, 30 min (contra perseguição).
  v_prazo constant interval := interval '2 hours';
  v_intervalo constant interval := interval '30 minutes';
  v_ticket uuid;
  v_tipo uuid;
  v_eu public.table_members;
  v_mesa uuid;
  v_nome text;
begin
  if v_uid is null or not public.gf_mfa_ok() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  select t.id, t.ticket_type_id into v_ticket, v_tipo
  from public.tickets t join public.ticket_types tt on tt.id = t.ticket_type_id
  where t.event_id = p_event_id and t.user_id = v_uid and tt.type = 'coletiva' and t.status in ('active', 'used')
  order by t.created_at limit 1;
  if v_ticket is null then
    raise exception 'Você não tem ingresso da Mesa Tinder neste evento' using errcode = '22023';
  end if;
  if not public.mesa_ok(v_uid) then
    raise exception 'Para escolher a mesa, aceite o termo e tenha foto aprovada' using errcode = '22023';
  end if;
  -- 30 min: conferência rápida antes da trava por evento e de novo depois dela (duas chamadas
  -- simultâneas: a segunda espera a primeira e vê a troca que ela gravou)
  if exists (select 1 from public.table_members m where m.ticket_id = v_ticket and m.ultima_troca_em > now() - v_intervalo) then
    raise exception 'Espere 30 minutos entre uma troca de mesa e outra' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('formar_mesas:' || p_event_id));
  -- depois da trava: uma remoção feita ao mesmo tempo já está gravada
  if public.mesa_travado(p_event_id, v_uid) then
    raise exception 'Sua participação nas mesas deste evento foi suspensa pela organização.' using errcode = '22023';
  end if;
  if (select public.evento_momento(e) from public.events e where e.id = p_event_id) - now() < v_prazo then
    raise exception 'Escolha e troca de mesa só até 2 h antes do evento' using errcode = '22023';
  end if;

  -- cadeira de ingresso transferido que formar_mesas ainda não limpou (ticket_id é único)
  delete from public.table_members m where m.ticket_id = v_ticket and m.user_id <> v_uid;
  select m.* into v_eu from public.table_members m where m.ticket_id = v_ticket;
  if v_eu.oculto then
    raise exception 'Você saiu da Mesa Tinder: volte para escolher a mesa' using errcode = '22023';
  end if;
  if v_eu.ultima_troca_em > now() - v_intervalo then
    raise exception 'Espere 30 minutos entre uma troca de mesa e outra' using errcode = '22023';
  end if;

  if p_mesa_numero is null then
    select 'Mesa ' || (coalesce(max(substring(c.name from '[0-9]+')::int), 0) + 1) into v_nome
    from public.collective_tables c where c.event_id = p_event_id;
    insert into public.collective_tables (event_id, ticket_type_id, name, capacity, status)
    values (p_event_id, v_tipo, v_nome, 6, 'open')
    returning id into v_mesa;
  else
    select c.id, c.name into v_mesa, v_nome
    from public.collective_tables c
    where c.event_id = p_event_id and c.name = 'Mesa ' || p_mesa_numero;
    if v_mesa is not null and v_mesa = v_eu.table_id then
      raise exception 'Você já está nesta mesa' using errcode = '22023';
    end if;
    if not exists (select 1 from public.collective_tables c
                   where c.id = v_mesa and c.ticket_type_id = v_tipo and c.status <> 'closed'
                     and public.mesa_ocupados(c.id) < c.capacity) then
      raise exception 'Mesa indisponível' using errcode = '22023';
    end if;
  end if;

  if v_eu.id is null then
    insert into public.table_members (table_id, user_id, ticket_id, vibe) values (v_mesa, v_uid, v_ticket, null);
  else
    update public.table_members m set table_id = v_mesa, ultima_troca_em = now() where m.id = v_eu.id;
    if public.mesa_ocupados(v_eu.table_id) = 0 then
      delete from public.collective_tables c where c.id = v_eu.table_id;
    else
      perform public.mesa_recalcular(v_eu.table_id);
    end if;
  end if;
  perform public.mesa_recalcular(v_mesa);
  return jsonb_build_object('numero', substring(v_nome from '[0-9]+')::int, 'nome', v_nome);
end;
$$;

-- 5f. mesa_sair / mesa_voltar: o perfil some (ou volta) na hora; a cadeira continua.
--     ponytail: só age em quem já tem cadeira; antes disso a pessoa não aparece para ninguém, mas
--     formar_mesas a aloca visível. Para sair antes da formação, guardar a escolha por ingresso.
create or replace function public.mesa_sair(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.gf_mfa_ok() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  update public.table_members m set oculto = true
  from public.collective_tables c
  where c.id = m.table_id and c.event_id = p_event_id and m.user_id = auth.uid();
  if not found then
    raise exception 'Você ainda não tem mesa neste evento' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.mesa_voltar(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.gf_mfa_ok() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  update public.table_members m set oculto = false
  from public.collective_tables c
  where c.id = m.table_id and c.event_id = p_event_id and m.user_id = auth.uid();
  if not found then
    raise exception 'Você ainda não tem mesa neste evento' using errcode = '22023';
  end if;
end;
$$;

-- 5g. mesa_denunciar: um toque, com o id de membro vindo de minha_mesa ou mesas_para_escolher. O id
--     vale pelo histórico de passagens (bloco 3f), mesmo depois de troca, reembolso ou transferência,
--     até a limpeza de 30 dias. Pode denunciar quem tem ingresso coletivo válido no evento ou passou
--     por uma mesa dele. Não bloqueia ninguém. Até 5 denúncias por pessoa em cada evento; repetir a
--     mesma devolve {"ja_denunciado": true}. "assedio" só entre quem esteve na mesma mesa ao mesmo
--     tempo (mesma_mesa e o período, gravados como prova). Nasce "aberta": só o moderador vê até
--     liberar ao produtor.
create or replace function public.mesa_denunciar(p_membro uuid, p_motivo text, p_detalhe text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_alvo public.mesa_passagens;
  v_ini timestamptz;
  v_fim timestamptz;
begin
  if v_uid is null or not public.gf_mfa_ok() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  select p.* into v_alvo from public.mesa_passagens p where p.membro_id = p_membro order by p.entrou_em desc limit 1;
  if v_alvo.id is null or v_alvo.user_id = v_uid
     or not (exists (select 1 from public.tickets t join public.ticket_types tt on tt.id = t.ticket_type_id
                     where t.event_id = v_alvo.evento and t.user_id = v_uid and tt.type = 'coletiva'
                       and t.status in ('active', 'used'))
             or exists (select 1 from public.mesa_passagens p where p.user_id = v_uid and p.evento = v_alvo.evento)) then
    raise exception 'Pessoa não encontrada' using errcode = '22023';
  end if;
  -- duas denúncias da mesma pessoa ao mesmo tempo: uma espera a outra (limite de 5)
  perform pg_advisory_xact_lock(hashtext('mesa_denuncia:' || v_uid || ':' || v_alvo.evento));
  if exists (select 1 from public.mesa_denuncias d
             where d.denunciante = v_uid and d.denunciado = v_alvo.user_id and d.evento = v_alvo.evento) then
    return jsonb_build_object('ja_denunciado', true);
  end if;
  if (select count(*) from public.mesa_denuncias d where d.denunciante = v_uid and d.evento = v_alvo.evento) >= 5 then
    raise exception 'Limite de 5 denúncias por evento' using errcode = '22023';
  end if;
  -- período em que estiveram juntos na mesma mesa (do primeiro encontro ao último; quem ainda está
  -- junto conta até a hora da denúncia)
  select min(greatest(a.entrou_em, b.entrou_em)),
         max(least(coalesce(a.saiu_em, clock_timestamp()), coalesce(b.saiu_em, clock_timestamp())))
    into v_ini, v_fim
  from public.mesa_passagens a join public.mesa_passagens b on b.table_id = a.table_id
  where a.user_id = v_uid and b.user_id = v_alvo.user_id and a.evento = v_alvo.evento
    and a.entrou_em < coalesce(b.saiu_em, 'infinity') and b.entrou_em < coalesce(a.saiu_em, 'infinity');
  if p_motivo = 'assedio' and v_ini is null then
    raise exception 'Assédio só pode ser denunciado por quem esteve na mesma mesa ao mesmo tempo' using errcode = '22023';
  end if;
  insert into public.mesa_denuncias (denunciante, denunciado, denunciante_nome, denunciado_nome, evento, evento_em,
                                     table_id, mesa, motivo, detalhe, mesma_mesa, sobreposicao_inicio, sobreposicao_fim)
  select v_uid, v_alvo.user_id, pa.full_name, pb.full_name, v_alvo.evento, public.evento_momento(e),
         v_alvo.table_id, (select c.name from public.collective_tables c where c.id = v_alvo.table_id),
         p_motivo, nullif(trim(p_detalhe), ''), v_ini is not null, v_ini, v_fim
  from public.events e
  join public.profiles pa on pa.id = v_uid
  join public.profiles pb on pb.id = v_alvo.user_id
  where e.id = v_alvo.evento;
  return jsonb_build_object('ok', true);
end;
$$;

-- 5h0. Conflito de interesse na moderação: a denúncia é contra quem chama, ou quem chama é o
--      produtor do evento e a denúncia é contra alguém da equipe dele (team_members). Vale também para o
--      super_admin que produz eventos. Uso interno.
create or replace function public.mesa_conflito(p_evento uuid, p_denunciado uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_denunciado = auth.uid()
      or (exists (select 1 from public.events e where e.id = p_evento and e.producer_id = auth.uid())
          and exists (select 1 from public.team_members tm where tm.producer_id = auth.uid() and tm.user_id = p_denunciado));
$$;

drop function if exists public.mesa_pode_remover(uuid, uuid, boolean);  -- nome antigo
-- 5h1. mesa_denuncia_que_remove: a regra única de quem pode ser removido da mesa (mesa_remover_membro e
--      'pode_remover' de mesas_do_evento). Devolve a denúncia mais recente deste evento contra a pessoa
--      que justifica a remoção, ou nulo. Sem security definer: só é chamada por funções security definer.
--      Produtor (p_produtor): a que ele vê na lista dele (liberada a ele, nem contra ele nem contra a
--      equipe dele), que não foi feita por ele nem liberada por ele (quem acusa ou libera não remove; cobre
--      o produtor que também é moderador). Sem exigir status: a liberada já passou pela triagem.
--      Moderador: só depois da análise (status diferente de 'aberta'), sem conflito de interesse
--      (mesa_conflito) e que não foi ele quem fez a denúncia. Nos dois: resolvida e improcedente nunca vale
--      (valem em_apuracao, judicial e resolvida procedente).
create or replace function public.mesa_denuncia_que_remove(p_event_id uuid, p_user uuid, p_produtor boolean)
returns uuid
language sql
stable
set search_path = ''
as $$
  select d.id
  from public.events e
  join public.mesa_denuncias d on d.evento = e.id
  where e.id = p_event_id and d.denunciado = p_user
    and case when p_produtor then
          d.liberada_produtor_em is not null
          and d.denunciado is distinct from e.producer_id
          and d.denunciante is distinct from e.producer_id
          and d.liberada_por is distinct from auth.uid()
          and not exists (select 1 from public.team_members tm where tm.producer_id = e.producer_id and tm.user_id = d.denunciado)
        else
          not coalesce(public.mesa_conflito(d.evento, d.denunciado), false)
          and d.denunciante is distinct from auth.uid()
          and d.status <> 'aberta'  -- só depois da análise
        end
    and d.resultado is distinct from 'improcedente'  -- resolvida e improcedente nunca vale
  order by d.criado_em desc, d.id
  limit 1;
$$;

-- 5h. mesa_denuncias_do_evento: o moderador (moderate_mesa, aal2) vê tudo, menos as denúncias contra
--     ele mesmo e, se ele produz o evento, contra a equipe dele (conflito de interesse, mesa_conflito);
--     o produtor do evento vê as liberadas a ele
--     (liberada_produtor_em), mesmo depois de o status mudar, com o denunciado (nome completo), o
--     motivo e a mesa, menos as denúncias contra ele mesmo ou contra a equipe dele (team_members).
--     ponytail: o moderador denunciado não vê nem decide a denúncia contra ele; se for o único
--     moderador, ninguém decide. Dar moderate_mesa a mais de uma pessoa (ou ao super_admin).
create or replace function public.mesa_denuncias_do_evento(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_produtor uuid := (select e.producer_id from public.events e where e.id = p_event_id);
begin
  if not public.gf_mfa_ok() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if public.gf_admin_can('moderate_mesa') then
    perform public.mesa_moderador();
    return coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', d.id, 'criado_em', d.criado_em, 'motivo', d.motivo, 'detalhe', d.detalhe, 'status', d.status,
               'mesa', d.mesa, 'denunciante', d.denunciante_nome, 'denunciado', d.denunciado_nome,
               'mesma_mesa', d.mesma_mesa, 'sobreposicao_inicio', d.sobreposicao_inicio,
               'sobreposicao_fim', d.sobreposicao_fim, 'status_mudado_em', d.status_mudado_em,
               'liberada_produtor_em', d.liberada_produtor_em, 'resultado', d.resultado,
               'resultado_explicacao', d.resultado_explicacao)
             order by d.criado_em desc, d.id)
      from public.mesa_denuncias d
      where d.evento = p_event_id and not coalesce(public.mesa_conflito(d.evento, d.denunciado), false)
    ), '[]'::jsonb);
  end if;
  if v_produtor is distinct from auth.uid() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('denunciado', d.denunciado_nome, 'motivo', d.motivo, 'mesa', d.mesa, 'resultado', d.resultado)
                     order by d.criado_em desc, d.id)
    from public.mesa_denuncias d
    where d.evento = p_event_id and d.liberada_produtor_em is not null and d.denunciado is distinct from v_produtor
      and not exists (select 1 from public.team_members tm where tm.producer_id = v_produtor and tm.user_id = d.denunciado)
  ), '[]'::jsonb);
end;
$$;

-- 5i. mesa_denuncia_status e mesa_denuncia_liberar: só o moderador (moderate_mesa, aal2), nunca em
--     conflito de interesse (mesa_conflito); gravam quem fez e quando. Liberar ao produtor é de uma vez só.
-- 'resolvida' exige p_resultado ('procedente' ou 'improcedente') e p_explicacao (10 a 1000 caracteres, CHECK da
-- tabela); em outro status os dois são limpos. Assinatura nova: o drop tira a de 2 parâmetros.
drop function if exists public.mesa_denuncia_status(uuid, text);
create or replace function public.mesa_denuncia_status(p_id uuid, p_status text, p_resultado text default null,
                                                       p_explicacao text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.mesa_moderador();
  if p_status = 'resolvida' and (p_resultado is null or nullif(btrim(p_explicacao, E' \t\r\n'), '') is null) then
    raise exception 'Para marcar como resolvida, informe o resultado (procedente ou improcedente) e a explicação'
      using errcode = '22023';
  end if;
  update public.mesa_denuncias
  set status = p_status, status_mudado_por = auth.uid(), status_mudado_em = now(),
      resultado = case when p_status = 'resolvida' then p_resultado end,
      resultado_explicacao = case when p_status = 'resolvida' then btrim(p_explicacao, E' \t\r\n') end
  where id = p_id and not coalesce(public.mesa_conflito(evento, denunciado), false);
  if not found then
    raise exception 'Denúncia não encontrada' using errcode = '22023';
  end if;
  -- improcedente: quem foi removido por esta denúncia volta a poder escolher mesa (ninguém fica fora sem
  -- denúncia válida); mesmo registro de mesa_destravar, que não gera aviso
  if p_status = 'resolvida' and p_resultado = 'improcedente' then
    update public.mesa_travas set destravada_por = auth.uid(), destravada_em = now()
    where denuncia_id = p_id and destravada_em is null;
  end if;
end;
$$;

create or replace function public.mesa_denuncia_liberar(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.mesa_moderador();
  update public.mesa_denuncias set liberada_produtor_em = coalesce(liberada_produtor_em, now()),
                                   liberada_por = coalesce(liberada_por, auth.uid())
  where id = p_id and not coalesce(public.mesa_conflito(evento, denunciado), false);
  if not found then
    raise exception 'Denúncia não encontrada' using errcode = '22023';
  end if;
end;
$$;

-- 5j. mesa_remover_membro: o produtor do evento (2FA) ou o moderador (moderate_mesa, aal2) tira a
--     pessoa da mesa e trava a pessoa no evento (mesa_travas): ela não escolhe nem é alocada de novo,
--     e a cadeira física se resolve no local. Motivo da lista; "outro" exige detalhe. Grava quem e
--     quando, e avisa a pessoa (aviso "removido"). A mesa que ficar vazia é apagada.
--     Só se remove quem tem denúncia contra si neste evento (mesa_denuncias.denunciado = dono do
--     ingresso, evento = p_event_id): o produtor, só com a denúncia que ele vê (liberada a ele, nem contra
--     ele nem contra a equipe dele, nem feita nem liberada por ele); o moderador, com denúncia já analisada
--     (status diferente de 'aberta'), sem conflito e que não fez (mesa_denuncia_que_remove).
--     Sem denúncia: 22023 "Só é possível remover quem tem denúncia neste evento".
drop function if exists public.mesa_remover_membro(uuid, uuid, text);
create or replace function public.mesa_remover_membro(p_event_id uuid, p_ticket_id uuid, p_motivo text,
                                                      p_detalhe text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_mesa uuid;
  v_nome text;
  v_trava uuid;
  v_produtor boolean;
  v_denuncia uuid;
begin
  if not public.gf_mfa_ok() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  v_produtor := exists (select 1 from public.events e where e.id = p_event_id and e.producer_id = (select auth.uid()));
  if not v_produtor then
    perform public.mesa_moderador();
  end if;
  select t.user_id into v_user from public.tickets t join public.ticket_types tt on tt.id = t.ticket_type_id
  where t.id = p_ticket_id and t.event_id = p_event_id and tt.type = 'coletiva';
  if v_user is null then
    raise exception 'Ingresso não encontrado neste evento' using errcode = '22023';
  end if;
  -- quem é produtor do evento e também moderador vale como produtor
  if p_motivo = 'pedido_da_pessoa' then
    -- só vale no CHECK (dado antigo); quem quer sair usa mesa_sair
    raise exception 'Motivo inválido: sem denúncia ninguém é removido; quem quer sair usa "sair da mesa"' using errcode = '22023';
  end if;
  v_denuncia := public.mesa_denuncia_que_remove(p_event_id, v_user, v_produtor);
  if v_denuncia is null then
    raise exception 'Só é possível remover quem tem denúncia neste evento' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('formar_mesas:' || p_event_id));
  insert into public.mesa_travas (evento, user_id, ticket_id, motivo, detalhe, por, denuncia_id)
  values (p_event_id, v_user, p_ticket_id, p_motivo, nullif(trim(p_detalhe), ''), auth.uid(), v_denuncia)
  on conflict (evento, user_id) where destravada_em is null do nothing
  returning id into v_trava;  -- nulo quando já havia trava vigente
  delete from public.table_members m where m.ticket_id = p_ticket_id returning m.table_id into v_mesa;
  if v_mesa is not null then
    select c.name into v_nome from public.collective_tables c where c.id = v_mesa;
    if public.mesa_ocupados(v_mesa) = 0 then
      delete from public.collective_tables c where c.id = v_mesa;
    else
      perform public.mesa_recalcular(v_mesa);
    end if;
  end if;
  -- aviso só quando algo mudou (trava nova ou saída da mesa).
  -- ponytail: a 2ª remoção com trava vigente não é registrada em lugar nenhum (B2); guardar um
  -- histórico de remoções se a organização precisar dele.
  if v_trava is not null or v_mesa is not null then
    insert into public.mesa_avisos (user_id, evento, table_id, mesa, tipo)
    values (v_user, p_event_id, v_mesa, v_nome, 'removido')
    on conflict (user_id, table_id, tipo) where not lido do nothing;
  end if;
end;
$$;

-- 5j'. mesa_travas_do_evento e mesa_destravar: só o moderador (moderate_mesa, aal2) revisa as remoções
--      e destrava, com registro de quem destravou e quando; nunca a trava dele mesmo nem a de quem é da
--      equipe dele quando ele produz o evento (mesa_conflito).
create or replace function public.mesa_travas_do_evento(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.mesa_moderador();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', tr.id, 'pessoa', pu.full_name, 'motivo', tr.motivo, 'detalhe', tr.detalhe, 'denuncia_motivo', dn.motivo, 'denuncia_resultado', dn.resultado,
             'por', pp.full_name, 'em', tr.em, 'destravada_em', tr.destravada_em, 'destravada_por', pd.full_name)
           order by tr.em desc, tr.id)
    from public.mesa_travas tr
    left join public.profiles pu on pu.id = tr.user_id
    left join public.profiles pp on pp.id = tr.por
    left join public.profiles pd on pd.id = tr.destravada_por
    left join public.mesa_denuncias dn on dn.id = tr.denuncia_id
    where tr.evento = p_event_id and not coalesce(public.mesa_conflito(tr.evento, tr.user_id), false)
  ), '[]'::jsonb);
end;
$$;

create or replace function public.mesa_destravar(p_event_id uuid, p_trava_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.mesa_moderador();
  update public.mesa_travas set destravada_por = auth.uid(), destravada_em = now()
  where id = p_trava_id and evento = p_event_id and destravada_em is null
    and not coalesce(public.mesa_conflito(evento, user_id), false);
  if not found then
    raise exception 'Trava não encontrada' using errcode = '22023';
  end if;
end;
$$;

-- 5k. meus_avisos_mesa / marcar_avisos_lidos: "entrou alguém na sua mesa" (sem dizer quem) e
--     "removido" (a organização tirou a pessoa da mesa).
create or replace function public.meus_avisos_mesa()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.gf_mfa_ok() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', a.id, 'evento', a.evento, 'mesa', a.mesa, 'tipo', a.tipo,
                                        'mensagem', case a.tipo
                                          when 'removido' then 'Você foi retirado da sua mesa pela organização do evento; procure a organização no local'
                                          else 'Entrou alguém na sua mesa' end,
                                        'criado_em', a.criado_em, 'lido', a.lido)
                     order by a.lido, a.criado_em desc, a.id)
    from public.mesa_avisos a where a.user_id = auth.uid()
  ), '[]'::jsonb);
end;
$$;

create or replace function public.marcar_avisos_lidos()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.gf_mfa_ok() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  update public.mesa_avisos set lido = true where user_id = auth.uid() and not lido;
end;
$$;

-- 6. Consentimento: só por estas funções (o gatilho do bloco 2c barra a gravação direta) --------

-- 6a. mesa_consentir: aceite do termo vigente. Versão diferente = o front está com o termo velho.
--     Obrigatórios para participar (decisão do Ricardo, 30/09): nome, 18 anos ou mais e foto no
--     formato do app (mesa_foto_formato); o resto (questionário, etiquetas, escolaridade, rede) é opcional. A
--     aprovação da foto não é exigida aqui (a moderação pode demorar): ela só controla se o perfil
--     aparece (mesa_ok).
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
  if not exists (select 1 from public.profiles p where p.id = v_uid and trim(coalesce(p.full_name, '')) <> '') then
    raise exception 'Para participar, adicione seu nome ao perfil' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles p
                 where p.id = v_uid and p.birth_date <= current_date - interval '18 years') then
    raise exception 'Mesa Tinder é só para maiores de 18: informe sua data de nascimento' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles p
                 where p.id = v_uid and public.mesa_foto_formato(p.avatar_url)) then
    raise exception 'Para participar, adicione sua foto de perfil' using errcode = '22023';
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

-- 6b. mesa_revogar: revoga e apaga, no mesmo UPDATE, tudo o que o questionário da mesa coletou,
--     e revoga também o aceite da rede social.
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
    rede_consent_revoked_at = case when x.rede_consent_at is not null then now() end,
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

-- 6c. mesa_mostrar_rede / mesa_ocultar_rede: segundo aceite, separado do da mesa (Decisão 94). A rede
--     social só aparece para colegas mesa_ok enquanto este aceite estiver vigente.
create or replace function public.mesa_mostrar_rede()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.gf_mfa_ok() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  update public.user_profiles_ext x set rede_consent_at = now(), rede_consent_revoked_at = null
  where x.user_id = v_uid and x.mesa_consent_at is not null and x.mesa_consent_revoked_at is null
    and x.mesa_consent_version = public.mesa_termo_versao();
  if not found then
    raise exception 'Aceite primeiro o termo da Mesa Tinder' using errcode = '22023';
  end if;
  insert into public.mesa_consentimentos (user_id, versao, acao) values (v_uid, public.mesa_termo_versao(), 'mostrou_rede');
end;
$$;

create or replace function public.mesa_ocultar_rede()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.gf_mfa_ok() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  update public.user_profiles_ext x set rede_consent_revoked_at = now()
  where x.user_id = v_uid and x.rede_consent_at is not null and x.rede_consent_revoked_at is null;
  if found then
    insert into public.mesa_consentimentos (user_id, versao, acao) values (v_uid, public.mesa_termo_versao(), 'ocultou_rede');
  end if;
end;
$$;

-- 6d. Moderação da foto pelo moderador (moderate_mesa, aal2): a fila são as fotos pendentes ou em
--     revisão, no formato do app, de quem aceitou o termo da mesa (não a base toda), com o hash
--     (sha256); a decisão só vale se a foto ainda for a mesma (hash) e estiver pendente ou em revisão,
--     ou aprovada, para revogar (p_aprovada = false). Nunca a própria foto. Devolve se decidiu. A fila
--     traz em "ia" a última decisão da moderação automática para a mesma foto (mesa_moderacoes) e em
--     "contestada" se a pessoa contestou a recusa automática.
create or replace function public.mesa_fotos_para_revisar()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.mesa_moderador();
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.full_name, 'foto', p.avatar_url, 'hash', public.mesa_foto_hash(p.avatar_url),
                                        'situacao', p.avatar_moderacao,
                                        -- a última decisão da IA para esta mesma foto, se houver
                                        'ia', (select jsonb_build_object('decisao', m.decisao, 'motivos', m.motivos, 'em', m.em)
                                               from public.mesa_moderacoes m
                                               where m.user_id = p.id and m.hash = public.mesa_foto_hash(p.avatar_url)
                                                 and m.decisao <> 'contestada'
                                               order by m.id desc limit 1),
                                        -- a pessoa contestou a recusa automática desta foto (mesa_foto_contestar)
                                        'contestada', exists (select 1 from public.mesa_moderacoes m
                                                              where m.user_id = p.id and m.hash = public.mesa_foto_hash(p.avatar_url)
                                                                and m.decisao = 'contestada'))
                     order by p.full_name, p.id)
    from public.profiles p
    join public.user_profiles_ext x on x.user_id = p.id
    where p.avatar_moderacao in ('pendente', 'revisar') and public.mesa_foto_formato(p.avatar_url)
      and p.id is distinct from auth.uid()
      and x.mesa_consent_at is not null and x.mesa_consent_revoked_at is null
  ), '[]'::jsonb);
end;
$$;

drop function if exists public.mesa_foto_decidir(uuid, boolean);
create or replace function public.mesa_foto_decidir(p_user uuid, p_hash text, p_aprovada boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.mesa_moderador();
  update public.profiles p set
    avatar_moderacao = case when p_aprovada then 'aprovada' else 'recusada' end,
    avatar_moderado_em = now(),
    avatar_moderacao_hash = p_hash
  where p.id = p_user and p.id is distinct from auth.uid() and public.mesa_foto_hash(p.avatar_url) = p_hash and p_aprovada is not null
    and (p.avatar_moderacao in ('pendente', 'revisar') or (p.avatar_moderacao = 'aprovada' and not p_aprovada));
  return found;
end;
$$;

-- 6e. Moderação automática (Edge Function moderar-foto, só service_role; contrato fixo da Fase E).
--     Apoio (uso interno):
--     - mesa_ia_ligada: o interruptor geral da IA (ai_settings.enabled; nulo = desligado);
--     - mesa_foto_na_fila: a foto da pessoa pode ir para a IA agora: pendente, no formato do app,
--       consentimento da mesa vigente (só essas vão para o Google), menos de 3 tentativas, sem reserva
--       vigente e no máximo 5 moderações dela nas últimas 24 h (acima disso fica pendente e o admin a vê);
--     - mesa_tem_foto_para_moderar: a IA está ligada e há ao menos uma foto na fila (o cron só chama
--       a Edge Function nesse caso).
create or replace function public.mesa_ia_ligada()
returns boolean
language sql
stable
set search_path = ''
as $$ select coalesce((select s.enabled from public.ai_settings s where s.id = 1), false) $$;

create or replace function public.mesa_foto_na_fila(p_user uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.user_profiles_ext x on x.user_id = p.id
    where p.id = p_user and p.avatar_moderacao = 'pendente' and public.mesa_foto_formato(p.avatar_url)
      and x.mesa_consent_at is not null and x.mesa_consent_revoked_at is null
      and x.mesa_consent_version = public.mesa_termo_versao()
      and p.avatar_moderacao_tentativas < 3
      and (p.avatar_moderacao_reservada_ate is null or p.avatar_moderacao_reservada_ate < now())
      and (select count(*) from public.mesa_moderacoes m
           where m.user_id = p.id and m.em > now() - interval '24 hours' and m.decisao <> 'contestada') < 5);
$$;

create or replace function public.mesa_tem_foto_para_moderar()
returns boolean
language sql
stable
set search_path = ''
as $$
  -- primeiro quem tem consentimento vigente (o conjunto pequeno), depois o filtro completo
  select public.mesa_ia_ligada()
     and exists (select 1
                 from public.user_profiles_ext x
                 join public.profiles p on p.id = x.user_id and p.avatar_moderacao = 'pendente'
                 where x.mesa_consent_at is not null and x.mesa_consent_revoked_at is null
                   and public.mesa_foto_na_fila(p.id));
$$;

--     mesa_fotos_para_moderar_auto: até p_limite fotos da fila (mesa_foto_na_fila); reserva cada uma
--     por 5 min (for update skip locked: duas rodadas não pegam a mesma). Com a IA desligada, nada.
--     Devolve {"modelo": ai_settings.model_simple, "fotos": [{user, hash, foto}]}.
--     ponytail: teto fixo de 500 fotos por dia (fuso de São Paulo), contado pelas decisões já gravadas
--     (sem "erro" e sem "contestada"); fotos reservadas e ainda sem resultado não entram na conta, então
--     duas rodadas simultâneas podem passar um pouco do teto. Levar o teto para ai_settings se precisar
--     mudar sem SQL.
create or replace function public.mesa_fotos_para_moderar_auto(p_limite int default 20)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teto constant int := 500;
  v_modelo text := (select s.model_simple from public.ai_settings s where s.id = 1);
  v_feitas int;
  v_n int;
  v_fotos jsonb;
begin
  if not public.mesa_ia_ligada() then
    return jsonb_build_object('modelo', v_modelo, 'fotos', '[]'::jsonb);
  end if;
  -- desde a meia-noite de São Paulo (usa o índice de em)
  select count(*) into v_feitas from public.mesa_moderacoes m
  where m.em >= date_trunc('day', now(), 'America/Sao_Paulo') and m.decisao not in ('erro', 'contestada');
  v_n := least(greatest(coalesce(p_limite, 20), 0), v_teto - v_feitas);
  if v_n <= 0 then
    return jsonb_build_object('modelo', v_modelo, 'fotos', '[]'::jsonb);
  end if;
  -- Reserva e tentativas repetidas aqui: mesa_foto_na_fila enxerga o banco do início do comando, e
  -- depois do "skip locked" a linha travada é relida; sem isto, duas rodadas simultâneas poderiam
  -- reservar a mesma foto. Ordem: quem nunca foi reservado primeiro e a reservada há mais tempo
  -- depois (a foto que interrompeu uma rodada vai para o fim e não trava o lote).
  with alvo as (
    select p.id
    from public.user_profiles_ext x
    join public.profiles p on p.id = x.user_id
    where x.mesa_consent_at is not null and x.mesa_consent_revoked_at is null
      and p.avatar_moderacao = 'pendente'
      and (p.avatar_moderacao_reservada_ate is null or p.avatar_moderacao_reservada_ate < now())
      and p.avatar_moderacao_tentativas < 3
      and public.mesa_foto_na_fila(p.id)
    order by p.avatar_moderacao_reservada_ate nulls first, p.avatar_moderacao_tentativas, p.id
    limit v_n
    for update of p skip locked
  ), reservadas as (
    update public.profiles p set avatar_moderacao_reservada_ate = now() + interval '5 minutes'
    from alvo where p.id = alvo.id
    returning p.id, p.avatar_url
  )
  select coalesce(jsonb_agg(jsonb_build_object('user', r.id, 'hash', public.mesa_foto_hash(r.avatar_url), 'foto', r.avatar_url)
                            order by r.id), '[]'::jsonb)
    into v_fotos
  from reservadas r;
  return jsonb_build_object('modelo', v_modelo, 'fotos', v_fotos);
end;
$$;

-- 6e'. mesa_moderacao_secret: o segredo do cron, para a Edge Function conferir o cabeçalho
--      x-moderacao-secret (mesmo padrão de chat_notify_secret). Só service_role.
create or replace function public.mesa_moderacao_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select d.decrypted_secret from vault.decrypted_secrets d where d.name = 'mesa_moderacao_secret' limit 1;
$$;

-- 6f. mesa_foto_resultado_auto: grava sempre a linha em mesa_moderacoes (o custo existiu) e só muda
--     profiles se a foto ainda for a mesma (hash) e ainda estiver pendente; senão devolve false.
--     aprovada/recusada/revisar: decide, zera tentativas e reserva. erro: +1 tentativa e libera a
--     reserva; na 3ª, vai para revisar (o admin decide).
create or replace function public.mesa_foto_resultado_auto(p_user uuid, p_hash text, p_decisao text, p_motivos text[],
                                                           p_modelo text, p_tokens_in int, p_tokens_out int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_decisao is null or p_decisao not in ('aprovada', 'recusada', 'revisar', 'erro') then
    raise exception 'Decisão inválida' using errcode = '22023';
  end if;
  insert into public.mesa_moderacoes (user_id, hash, decisao, motivos, modelo, tokens_in, tokens_out, custo)
  select p.id, p_hash, p_decisao, coalesce(p_motivos, '{}'), p_modelo, p_tokens_in, p_tokens_out,
         public.ai_custo(p_modelo, p_tokens_in, p_tokens_out)
  from public.profiles p where p.id = p_user;
  if p_decisao = 'erro' then
    update public.profiles p set
      avatar_moderacao_tentativas = p.avatar_moderacao_tentativas + 1,
      avatar_moderacao_reservada_ate = null,
      avatar_moderacao = case when p.avatar_moderacao_tentativas + 1 >= 3 then 'revisar' else p.avatar_moderacao end,
      avatar_moderado_em = case when p.avatar_moderacao_tentativas + 1 >= 3 then now() else p.avatar_moderado_em end
    where p.id = p_user and public.mesa_foto_hash(p.avatar_url) = p_hash and p.avatar_moderacao = 'pendente';
  else
    update public.profiles p set
      avatar_moderacao = p_decisao,
      avatar_moderacao_hash = p_hash,
      avatar_moderado_em = now(),
      avatar_moderacao_tentativas = 0,
      avatar_moderacao_reservada_ate = null
    where p.id = p_user and public.mesa_foto_hash(p.avatar_url) = p_hash and p.avatar_moderacao = 'pendente';
  end if;
  return found;
end;
$$;

-- 6g. mesa_foto_contestar (LGPD, art. 20): a pessoa pede revisão humana da recusa automática da
--     PRÓPRIA foto. Só quando a foto atual está recusada pela IA (a última decisão da IA para o mesmo
--     hash é "recusada") e só 1 vez por foto (hash); a foto vai para "revisar" e aparece na fila do
--     admin. Devolve false quando não dá para contestar. Trocar a foto e voltar à mesma (A→B→A) não dá
--     nova contestação: o limite é pelo hash.
create or replace function public.mesa_foto_contestar()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_hash text;
begin
  if v_uid is null or not public.gf_mfa_ok() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  select public.mesa_foto_hash(p.avatar_url) into v_hash from public.profiles p
  where p.id = v_uid and p.avatar_moderacao = 'recusada' and p.avatar_moderacao_hash = public.mesa_foto_hash(p.avatar_url);
  if v_hash is null
     or exists (select 1 from public.mesa_moderacoes m where m.user_id = v_uid and m.hash = v_hash and m.decisao = 'contestada')
     or (select m.decisao from public.mesa_moderacoes m where m.user_id = v_uid and m.hash = v_hash
         order by m.id desc limit 1) is distinct from 'recusada' then
    return false;
  end if;
  -- primeiro a mudança de estado, com a foto conferida de novo (trocada no meio: nada é gravado)
  update public.profiles p set avatar_moderacao = 'revisar', avatar_moderado_em = now()
  where p.id = v_uid and p.avatar_moderacao = 'recusada' and public.mesa_foto_hash(p.avatar_url) = v_hash;
  if not found then
    return false;
  end if;
  insert into public.mesa_moderacoes (user_id, hash, decisao) values (v_uid, v_hash, 'contestada');
  return true;
end;
$$;

-- 7. Quem acessa o quê ---------------------------------------------------------------
-- Tabelas: só as funções acima leem e escrevem (RLS sem policy + sem GRANT).
revoke all on public.mesa_moderacoes from anon, authenticated;
revoke all on public.collective_tables, public.table_members, public.mesa_consentimentos, public.mesa_denuncias,
  public.mesa_passagens, public.mesa_avisos, public.mesa_travas from anon, authenticated;

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
-- funções internas (sem EXECUTE para o navegador)
revoke all on function public.mesa_avatar_guard() from public, anon, authenticated;
revoke all on function public.mesa_passagem() from public, anon, authenticated;
revoke all on function public.mesa_moderador() from public, anon, authenticated;
revoke all on function public.mesa_travado(uuid, uuid) from public, anon, authenticated;
revoke all on function public.mesa_conflito(uuid, uuid) from public, anon, authenticated;
revoke all on function public.mesa_denuncia_que_remove(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.mesa_cartao(uuid, boolean, boolean) from public, anon, authenticated;
revoke all on function public.mesa_ocupados(uuid) from public, anon, authenticated;
revoke all on function public.mesa_recalcular(uuid) from public, anon, authenticated;
-- escolha, denúncia, rede social e moderação
revoke all on function public.mesas_para_escolher(uuid) from public, anon;
revoke all on function public.escolher_mesa(uuid, int) from public, anon;
revoke all on function public.mesa_sair(uuid) from public, anon;
revoke all on function public.mesa_voltar(uuid) from public, anon;
revoke all on function public.mesa_denunciar(uuid, text, text) from public, anon;
revoke all on function public.mesa_denuncias_do_evento(uuid) from public, anon;
revoke all on function public.mesa_denuncia_status(uuid, text, text, text) from public, anon;
revoke all on function public.mesa_mostrar_rede() from public, anon;
revoke all on function public.mesa_ocultar_rede() from public, anon;
revoke all on function public.mesa_fotos_para_revisar() from public, anon;
revoke all on function public.mesa_foto_decidir(uuid, text, boolean) from public, anon;
revoke all on function public.mesa_remover_membro(uuid, uuid, text, text) from public, anon;
revoke all on function public.mesa_denuncia_liberar(uuid) from public, anon;
revoke all on function public.mesa_travas_do_evento(uuid) from public, anon;
revoke all on function public.mesa_destravar(uuid, uuid) from public, anon;
revoke all on function public.meus_avisos_mesa() from public, anon;
revoke all on function public.marcar_avisos_lidos() from public, anon;
grant execute on function public.mesas_para_escolher(uuid) to authenticated;
grant execute on function public.escolher_mesa(uuid, int) to authenticated;
grant execute on function public.mesa_sair(uuid) to authenticated;
grant execute on function public.mesa_voltar(uuid) to authenticated;
grant execute on function public.mesa_denunciar(uuid, text, text) to authenticated;
grant execute on function public.mesa_denuncias_do_evento(uuid) to authenticated;
grant execute on function public.mesa_denuncia_status(uuid, text, text, text) to authenticated;
grant execute on function public.mesa_mostrar_rede() to authenticated;
grant execute on function public.mesa_ocultar_rede() to authenticated;
grant execute on function public.mesa_fotos_para_revisar() to authenticated;
grant execute on function public.mesa_foto_decidir(uuid, text, boolean) to authenticated;
-- moderação automática: só a Edge Function (service_role)
revoke all on function public.mesa_fotos_para_moderar_auto(int) from public, anon, authenticated;
revoke all on function public.mesa_foto_resultado_auto(uuid, text, text, text[], text, int, int) from public, anon, authenticated;
grant execute on function public.mesa_fotos_para_moderar_auto(int) to service_role;
revoke all on function public.mesa_moderacao_secret() from public, anon, authenticated;
revoke all on function public.mesa_ia_ligada() from public, anon, authenticated;
revoke all on function public.mesa_foto_na_fila(uuid) from public, anon, authenticated;
revoke all on function public.mesa_tem_foto_para_moderar() from public, anon, authenticated;
revoke all on function public.mesa_foto_contestar() from public, anon;
grant execute on function public.mesa_foto_contestar() to authenticated;
grant execute on function public.mesa_moderacao_secret() to service_role;
grant execute on function public.mesa_foto_resultado_auto(uuid, text, text, text[], text, int, int) to service_role;
grant execute on function public.mesa_remover_membro(uuid, uuid, text, text) to authenticated;
grant execute on function public.mesa_denuncia_liberar(uuid) to authenticated;
grant execute on function public.mesa_travas_do_evento(uuid) to authenticated;
grant execute on function public.mesa_destravar(uuid, uuid) to authenticated;
grant execute on function public.meus_avisos_mesa() to authenticated;
grant execute on function public.marcar_avisos_lidos() to authenticated;
-- REGRA (seg-6, #85: função nova do postgres nasce sem EXECUTE para PUBLIC e anon): grant explícito só
-- para função chamada fora de SECURITY DEFINER do dono (CHECK, policy, default de coluna, front).
-- Aqui só mesa_tags_ok, que o CHECK user_profiles_ext_tags_chk roda com o papel de quem grava o perfil
-- (authenticated no questionário, service_role nas Edge Functions). As outras puras (mesa_compat,
-- evento_momento, mesa_termo_versao, mesa_foto_formato, mesa_foto_hash) só rodam dentro das funções
-- SECURITY DEFINER e do cron (postgres): ficam fechadas. Função de gatilho não precisa de EXECUTE de
-- quem dispara o gatilho (conferido no teste T21).
revoke all on function public.mesa_tags_ok(jsonb) from public, anon;
grant execute on function public.mesa_tags_ok(jsonb) to authenticated, service_role;
revoke all on function public.mesa_compat(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.evento_momento(public.events) from public, anon, authenticated;
revoke all on function public.mesa_termo_versao() from public, anon, authenticated;
revoke all on function public.mesa_foto_formato(text) from public, anon, authenticated;
revoke all on function public.mesa_foto_hash(text) from public, anon, authenticated;

-- 8. Cron. formar_mesas a cada 15 min, nas 24 h antes do evento; cada evento num bloco próprio,
--    para um erro não derrubar os outros. apagar_mesas_antigas todo dia às 04:37 UTC (mesas,
--    passagens e avisos de 30 dias; travas e decisões da moderação automática de 180 dias; denúncias
--    vencidas, bloco 3e). moderar_fotos a cada 2 min (moderação automática da foto).
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
  do $job$
  begin
    delete from public.collective_tables c
    using public.events e
    where e.id = c.event_id and public.evento_momento(e) < now() - interval '30 days';
    delete from public.mesa_passagens p using public.events e
    where e.id = p.evento and public.evento_momento(e) < now() - interval '30 days';
    delete from public.mesa_avisos a using public.events e
    where e.id = a.evento and public.evento_momento(e) < now() - interval '30 days';
    -- travas: 180 dias (PENDÊNCIA: prazo sujeito a decisão do jurídico)
    delete from public.mesa_travas tr using public.events e
    where e.id = tr.evento and public.evento_momento(e) < now() - interval '180 days';
    -- denúncias (bloco 3e): detalhe e explicação do resultado em 180 dias (o resultado fica) e a denúncia em 3 anos,
    -- salvo em apuração ou judicial
    update public.mesa_denuncias set detalhe = null, resultado_explicacao = null
    where (detalhe is not null or resultado_explicacao is not null) and evento_em < now() - interval '180 days' and status not in ('em_apuracao', 'judicial');
    delete from public.mesa_denuncias
    where evento_em < now() - interval '3 years' and status not in ('em_apuracao', 'judicial');
    -- decisões da moderação automática (bloco 2e): motivos zerados aos 30 dias; decisão, custo e data
    -- até os 180 dias (PENDÊNCIA: prazos sujeitos ao jurídico)
    update public.mesa_moderacoes set motivos = '{}' where em < now() - interval '30 days' and motivos <> '{}';
    delete from public.mesa_moderacoes where em < now() - interval '180 days';
  end $job$;
$cron$);

-- moderar_fotos a cada 2 min (padrão do chat_notify, 20261001_chat.sql bloco 7): chama a Edge
-- Function moderar-foto com o segredo lido do Vault na hora (nunca escrito no comando). O "from
-- vault.decrypted_secrets" faz o job não chamar nada enquanto o segredo não existir (0 linhas = 0
-- chamadas), e mesa_tem_foto_para_moderar (o mesmo filtro da fila, com o interruptor da IA) evita
-- chamar quando não há o que moderar. Timeout de 160 s: lote de 20 fotos no Gemini.
select cron.unschedule('moderar_fotos') where exists (select 1 from cron.job where jobname = 'moderar_fotos');
select cron.schedule('moderar_fotos', '*/2 * * * *', $cron$
  select net.http_post(
    url := 'https://rwaezeqyuhxrssntcxdv.supabase.co/functions/v1/moderar-foto',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-moderacao-secret', d.decrypted_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 160000
  )
  from vault.decrypted_secrets d
  where d.name = 'mesa_moderacao_secret' and public.mesa_tem_foto_para_moderar();
$cron$);

commit;

-- Conferência:
-- select jobname, schedule from cron.job where jobname in ('formar_mesas', 'apagar_mesas_antigas');
-- select grantee, privilege_type from information_schema.role_table_grants
--   where table_name in ('collective_tables', 'table_members', 'mesa_consentimentos') and grantee in ('anon', 'authenticated');
