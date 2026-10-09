-- =============================================================================
-- Quadro, fatia 2A: cartão completo (09/10/2026). O cartão da equipe ganha etiquetas, membros, observadores, checklists,
-- anexos, comentários com recibo de entrega/leitura, "visto por", atalhos para outras ferramentas, dependências e histórico.
-- Só banco: a tela vem depois. Nada aqui mexe em orders, coupons, ticket_types nem pagamentos.
-- 1) Tabelas novas (todas ligadas a producer_tasks por task_id, ON DELETE CASCADE): task_labels e task_card_labels,
--    task_card_members, task_watchers, task_checklists e task_checklist_items, task_attachments (+ bucket privado
--    task-attachments), task_comments e task_comment_receipts, task_card_views, task_links, task_dependencies, task_activity.
-- 2) producer_tasks ganha cover, location, start_date, fields, archived_at, recur_days e recur_next (com conferências).
-- 3) Permissão: o produtor do cartão é a fonte (nenhuma tabela nova repete producer_id). Quatro funções estáveis
--    (board_pode, task_pode, checklist_pode, comment_pode) sobem do cartão ao produtor e chamam equipe_pode() da fatia 1:
--    ver = 'ver', gravar = 'editar'. Por serem SECURITY DEFINER, não há recursão de RLS.
-- 4) Gatilhos: etiqueta e cartão do mesmo quadro; membro do cartão tem de ser da equipe; dependência sem ciclo e dentro
--    do mesmo quadro; mover cartão com dependência aberta é recusado; histórico (task_activity) escrito só por task_log().
-- 5) Segurança: RLS ligada em toda tabela nova, regras por operação, gf_mfa_aal2 (2FA) restritiva como na fatia 1, anon sem
--    nenhum privilégio, authenticated só com permissão por coluna. LGPD: nenhuma coluna de IP em lugar nenhum; o aparelho
--    é só uma categoria (computador, celular, tablet, outro).
--
-- Pré-requisito: a fatia 1 aplicada (20261103_equipe_quadro_f01.sql). O bloco 0 aborta com mensagem clara se faltar.
-- Como aplicar: colar o arquivo inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA pelo TextEdit: erro 17). Fora do horário
-- de pico (set local lock_timeout faz desistir sem gravar nada se algo segurar a tabela; rodar de novo). Uma transação só:
-- se a conferência do fim falhar, nada é gravado. Idempotente. O front atual não usa nada disto: aplicar antes ou depois do merge.
-- NÃO mover para supabase/migrations/ (motivo no cabeçalho de 20260927_security_hardening.sql).
-- Teste: supabase/tests/quadro_f2a.test.sql (pgTAP; banco local, nunca em produção).
-- ATENÇÃO: reaplicar a 20261103 (fatia 1) DEPOIS desta apaga as permissões por coluna de producer_tasks das 7 colunas novas
--   (a fatia 1 refaz os grants do zero). Se isso acontecer, rodar este arquivo de novo (é idempotente e devolve os grants).
-- Desfazer (só depois de voltar o front; ordem importa: gatilhos, tabelas, regras do Storage, colunas, e só no fim as funções).
--   O Desfazer só roda com o papel dono das tabelas (supabase_admin no banco local; no editor do Supabase é o papel padrão). Ensaiado em begin/rollback.
--   Ensaiado em begin/rollback no banco local. O bucket não é apagado por SQL (o Storage protege): esvaziar e apagar pelo painel.
--   drop trigger if exists producer_tasks_quadro_z_deps on public.producer_tasks;
--   drop trigger if exists producer_tasks_quadro_log on public.producer_tasks;
--   drop table if exists public.task_activity, public.task_dependencies, public.task_links, public.task_card_views,
--     public.task_comment_receipts, public.task_comments, public.task_attachments, public.task_checklist_items,
--     public.task_checklists, public.task_watchers, public.task_card_members, public.task_card_labels, public.task_labels;
--   drop policy if exists task_anexos_select on storage.objects;
--   drop policy if exists task_anexos_insert on storage.objects;
--   drop policy if exists task_anexos_delete on storage.objects;
--   alter table public.producer_tasks drop column if exists cover, drop column if exists location, drop column if exists start_date,
--     drop column if exists fields, drop column if exists archived_at, drop column if exists recur_days, drop column if exists recur_next;
--   drop function if exists public.board_pode(uuid, text), public.task_pode(uuid, text), public.checklist_pode(uuid, text),
--     public.comment_pode(uuid, text), public.task_log(uuid, uuid, text, jsonb), public.quadro_location_ok(jsonb),
--     public.quadro_fields_ok(jsonb), public.task_anexo_produtor(text), public.task_limite_tg(), public.task_card_labels_tg(),
--     public.task_card_members_tg(), public.task_checklist_items_tg(), public.task_attachments_tg(), public.task_comments_tg(),
--     public.task_dependencies_tg(), public.task_receipts_tg(), public.task_views_tg(), public.producer_tasks_z_deps_tg(),
--     public.producer_tasks_log_tg(), public.task_comments_del_tg();
--
-- DECISÕES
-- 1. Quem só VÊ o quadro lê tudo do cartão (inclusive comentários e "visto por"); quem EDITA grava. Exceções: observar o
--    cartão, o recibo de comentário e "visto por" são da própria pessoa e pedem só 'ver'; comentário só do autor, que
--    precisa de 'editar' (membro 'ver' não comenta). Apagar cartão continua só do dono (fatia 1).
-- 2. Dependência: "A depende de B" = A só sai da primeira coluna do quadro (menor position) depois que B estiver numa coluna
--    kind = 'done'. O gatilho se chama producer_tasks_quadro_z_deps de propósito: gatilhos BEFORE do mesmo evento rodam em
--    ordem alfabética, então ele roda DEPOIS de producer_tasks_quadro (fatia 1) e já enxerga a coluna final (inclusive a
--    escolhida a partir do status pela tela antiga). Não mexe no gatilho da fatia 1. Dependência criada quando o cartão já
--    saiu da primeira coluna não o devolve: vale só para movimentos novos (a tela pode avisar). Destino de tipo 'todo' é
--    sempre livre (só se barra ir para doing/done). Não barra: mudança de quadro (apagar evento devolve o cartão ao quadro da
--    produtora) nem dependência cujo cartão-pai está arquivado. Criar dependência tem trava (advisory lock por quadro)
--    contra ciclo por duas gravações ao mesmo tempo.
-- 3. task_activity não tem INSERT para authenticated: só task_log(), que ninguém de fora chama (revogada de todos) e que os
--    gatilhos usam. Registra: criado, movido, arquivado, desarquivado, comentario, comentario_apagado, anexo. Apagar cartão não registra (a linha some e a
--    chave estrangeira já está desfeita); o histórico do cartão apagado fica com task_id nulo.
-- 4. Anexo: o caminho no Storage é <producer_id>/<task_id>/<arquivo>. As regras do bucket conferem o primeiro segmento com
--    equipe_pode, e o gatilho de task_attachments confere que o caminho da linha começa com o produtor do cartão. Sem UPDATE
--    de objeto (trocar arquivo = apagar e subir de novo). Limite 10 MB e 4 tipos, no bucket e na tabela.
-- 5. recur_days/recur_next são só colunas: nenhuma rotina cria a próxima ocorrência ainda (fica para a tela/fatia seguinte).
-- 6. fields: objeto JSON até 8 KB com chaves [a-z0-9_]{1,40}; location: txt (até 200), lat e lng, cada um opcional, nos limites.
-- 7. Tetos por gatilho (mensagem em português): 50 listas e 20 etiquetas por cartão, 200 itens por lista, 1000 comentários,
--    30 anexos, 30 atalhos, 20 dependências, 100 membros e 100 observadores por cartão, 50 etiquetas por quadro; comentário com
--    até 20 menções. Garantido: cada teto vale mesmo com várias gravações ao mesmo tempo (trava advisory por tabela+chave
--    até o fim da transação, então a contagem é sempre a real). A chave da trava é 'quadro:'||<id do cartão, da lista ou do
--    quadro>, SEM o nome da tabela: duas tabelas do mesmo cartão na mesma transação usam a mesma trava (reentrante), e não
--    há deadlock entre tabelas. Não garantido: apagar e recriar em rajada dentro do teto.
--    task_activity: nada é descartado por tempo; só 'movido' é podado, só além de 500 por cartão e só os do PRÓPRIO autor
--    (quem grava só apaga os seus; criado, arquivado, desarquivado, comentario, comentario_apagado e anexo nunca são podados).
--    Quando o cartão troca de quadro (apagar evento devolve à produtora), o histórico dele vai junto (UPDATE de board_id).
--    Gatilhos BEFORE rodam antes da RLS: os de checagem de dados saem sem validar (return new) quando quem grava não pode
--    nem ver/editar o cartão, para a RLS recusar com a mesma mensagem 42501 e nada vazar a existência de cartão, etiqueta ou
--    caminho. Sem login (service_role, SQL Editor: auth.uid() nulo) tudo continua validado.
-- 8. read_at (recibo) e last_seen_at ("visto por") são carimbados pelo banco com now(): o cliente só diz "marquei como lido"
--    (qualquer valor não nulo em read_at) ou toca o device; nunca escolhe a hora. Dono do produtor também apaga comentário (moderação).
-- 9. LIMITES CONHECIDOS (Pendências): (a) o arquivo no Storage NÃO é apagado quando a linha do anexo ou o cartão é apagado
--    (a rotina de limpeza fica para depois; o arquivo órfão só ocupa espaço; quem tem 'ver' no cartão ainda o lê, se souber o caminho, enquanto o cartão existir); (b) desarquivar o
--    cartão-pai reabre a dependência de quem dependia dele (agora fica no histórico como 'desarquivado'); (c) o histórico
--    de comentario, arquivado, anexo etc. não tem teto (não pode perder registro): rotina de retenção futura (ex.: apagar com
--    mais de 180 dias, exceto 'criado'); (d) os tetos são gatilhos BEFORE INSERT: INSERT ... ON CONFLICT DO NOTHING num cartão
--    no teto devolve o erro de limite em vez de ignorar (o front não usa upsert nessas tabelas: conferido em useCartao.ts).
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 0. Pré-requisitos -----------------------------------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.task_boards') is null or to_regclass('public.task_columns') is null
     or to_regclass('public.team_member_tools') is null then
    raise exception 'Falta a fatia 1 do quadro (task_boards, task_columns, team_member_tools): aplicar 20261103_equipe_quadro_f01.sql antes';
  end if;
  if to_regprocedure('public.equipe_pode(uuid, text, text, uuid)') is null then
    raise exception 'Falta public.equipe_pode (20261103_equipe_quadro_f01.sql): aplicar antes';
  end if;
  if to_regproc('public.gf_mfa_ok') is null then
    raise exception 'Falta public.gf_mfa_ok (20260930_2fa_no_banco.sql): aplicar antes';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'producer_tasks'
                 and column_name = 'board_id') then
    raise exception 'Falta producer_tasks.board_id (20261103_equipe_quadro_f01.sql): aplicar antes';
  end if;
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    raise exception 'Falta o schema storage';
  end if;
end $$;

-- 1. Colunas novas em producer_tasks --------------------------------------------------------------------------------------
-- location: objeto só com txt (texto até 200), lat (-90..90) e lng (-180..180); CASE para não converter o que não é número.
create or replace function public.quadro_location_ok(p jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select p is null or (
    jsonb_typeof(p) = 'object'
    and (p - array['txt', 'lat', 'lng']) = '{}'::jsonb
    and case when p -> 'txt' is null then true when jsonb_typeof(p -> 'txt') = 'string' then char_length(p ->> 'txt') <= 200 else false end
    and case when p -> 'lat' is null then true when jsonb_typeof(p -> 'lat') = 'number' then (p ->> 'lat')::numeric between -90 and 90 else false end
    and case when p -> 'lng' is null then true when jsonb_typeof(p -> 'lng') = 'number' then (p ->> 'lng')::numeric between -180 and 180 else false end)
$$;
-- fields: objeto cujas chaves são [a-z0-9_]{1,40}
create or replace function public.quadro_fields_ok(p jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'object' and not exists (select 1 from jsonb_object_keys(p) k where k !~ '^[a-z0-9_]{1,40}$')
$$;

alter table public.producer_tasks add column if not exists cover text;
alter table public.producer_tasks add column if not exists location jsonb;
alter table public.producer_tasks add column if not exists start_date date;
alter table public.producer_tasks add column if not exists fields jsonb not null default '{}';
alter table public.producer_tasks add column if not exists archived_at timestamptz;
alter table public.producer_tasks add column if not exists recur_days int;
alter table public.producer_tasks add column if not exists recur_next date;

alter table public.producer_tasks drop constraint if exists producer_tasks_cover_ck;
alter table public.producer_tasks add constraint producer_tasks_cover_ck check (cover is null or cover ~ '^#[0-9a-fA-F]{6}$');
alter table public.producer_tasks drop constraint if exists producer_tasks_location_ck;
alter table public.producer_tasks add constraint producer_tasks_location_ck check (public.quadro_location_ok(location));
alter table public.producer_tasks drop constraint if exists producer_tasks_fields_ck;
alter table public.producer_tasks add constraint producer_tasks_fields_ck
  check (public.quadro_fields_ok(fields) and pg_column_size(fields) < 8192);
alter table public.producer_tasks drop constraint if exists producer_tasks_recur_days_ck;
alter table public.producer_tasks add constraint producer_tasks_recur_days_ck check (recur_days in (1, 7, 14, 30));
create index if not exists producer_tasks_arquivados_idx on public.producer_tasks (board_id, archived_at) where archived_at is not null;

-- 2. Permissão: do cartão ao produtor -----------------------------------------------------------------------------------------
-- Todas SECURITY DEFINER (leem producer_tasks sem passar pela RLS dela, então não há recursão) e estáveis.
create or replace function public.board_pode(p_board uuid, p_nivel text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.task_boards b where b.id = p_board and public.equipe_pode(b.producer_id, 'quadro', p_nivel))
$$;
create or replace function public.task_pode(p_task uuid, p_nivel text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.producer_tasks t where t.id = p_task and public.equipe_pode(t.producer_id, 'quadro', p_nivel))
$$;
create or replace function public.checklist_pode(p_checklist uuid, p_nivel text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin -- plpgsql: a tabela task_checklists só é criada abaixo
  return exists (select 1 from public.task_checklists c join public.producer_tasks t on t.id = c.task_id
                 where c.id = p_checklist and public.equipe_pode(t.producer_id, 'quadro', p_nivel));
end $$;
create or replace function public.comment_pode(p_comment uuid, p_nivel text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin -- plpgsql: a tabela task_comments só é criada abaixo
  return exists (select 1 from public.task_comments c join public.producer_tasks t on t.id = c.task_id
                 where c.id = p_comment and public.equipe_pode(t.producer_id, 'quadro', p_nivel));
end $$;

-- 3. Tabelas -------------------------------------------------------------------------------------------------------------------
create table if not exists public.task_labels (
  id       uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.task_boards (id) on delete cascade,
  name     text not null check (char_length(name) between 1 and 30),
  color    text not null check (color ~ '^#[0-9a-fA-F]{6}$')
);
create index if not exists task_labels_board_idx on public.task_labels (board_id);

create table if not exists public.task_card_labels (
  task_id  uuid not null references public.producer_tasks (id) on delete cascade,
  label_id uuid not null references public.task_labels (id) on delete cascade,
  primary key (task_id, label_id)
);
create index if not exists task_card_labels_label_idx on public.task_card_labels (label_id);

create table if not exists public.task_card_members (
  task_id uuid not null references public.producer_tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (task_id, user_id)
);
create index if not exists task_card_members_user_idx on public.task_card_members (user_id);

create table if not exists public.task_watchers (
  task_id uuid not null references public.producer_tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (task_id, user_id)
);
create index if not exists task_watchers_user_idx on public.task_watchers (user_id);

create table if not exists public.task_checklists (
  id       uuid primary key default gen_random_uuid(),
  task_id  uuid not null references public.producer_tasks (id) on delete cascade,
  title    text not null check (char_length(title) between 1 and 80),
  position numeric not null default 0
);
create index if not exists task_checklists_task_idx on public.task_checklists (task_id, position);

create table if not exists public.task_checklist_items (
  id           uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.task_checklists (id) on delete cascade,
  text         text not null check (char_length(text) between 1 and 200),
  done         boolean not null default false,
  position     numeric not null default 0,
  done_at      timestamptz,
  done_by      uuid references public.profiles (id) on delete set null
);
create index if not exists task_checklist_items_cl_idx on public.task_checklist_items (checklist_id, position);

create table if not exists public.task_attachments (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.producer_tasks (id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) between 3 and 300),
  name         text not null check (char_length(name) between 1 and 200),
  mime         text not null check (mime in ('image/png', 'image/jpeg', 'image/webp', 'application/pdf')),
  size_bytes   bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists task_attachments_task_idx on public.task_attachments (task_id);

create table if not exists public.task_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.producer_tasks (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 4000),
  mentions   uuid[] not null default '{}' check (cardinality(mentions) <= 20),
  created_at timestamptz not null default now()
);
create index if not exists task_comments_task_idx on public.task_comments (task_id, created_at);

-- Recibo: sem IP. device é só a categoria do aparelho.
create table if not exists public.task_comment_receipts (
  comment_id   uuid not null references public.task_comments (id) on delete cascade,
  user_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  delivered_at timestamptz not null default now(),
  read_at      timestamptz,
  device       text check (device in ('computador', 'celular', 'tablet', 'outro')),
  primary key (comment_id, user_id)
);
create index if not exists task_comment_receipts_user_idx on public.task_comment_receipts (user_id);

create table if not exists public.task_card_views (
  task_id      uuid not null references public.producer_tasks (id) on delete cascade,
  user_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  device       text check (device in ('computador', 'celular', 'tablet', 'outro')),
  primary key (task_id, user_id)
);
create index if not exists task_card_views_user_idx on public.task_card_views (user_id);

create table if not exists public.task_links (
  id      uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.producer_tasks (id) on delete cascade,
  kind    text not null check (kind in ('ingresso', 'cupom', 'participantes', 'checkin', 'orcamento', 'financeiro', 'bordero',
                                        'parceiro', 'crm', 'equipe', 'mapa', 'divulgacao', 'certificados', 'cronograma', 'evento')),
  ref     text check (ref is null or ref ~ '^[A-Za-z0-9_-]{1,200}$')
);
create index if not exists task_links_task_idx on public.task_links (task_id);

create table if not exists public.task_dependencies (
  task_id    uuid not null references public.producer_tasks (id) on delete cascade,
  depends_on uuid not null references public.producer_tasks (id) on delete cascade,
  primary key (task_id, depends_on),
  check (task_id <> depends_on)
);
create index if not exists task_dependencies_depends_idx on public.task_dependencies (depends_on);

create table if not exists public.task_activity (
  id         uuid primary key default gen_random_uuid(),
  board_id   uuid not null references public.task_boards (id) on delete cascade,
  task_id    uuid references public.producer_tasks (id) on delete set null,
  actor      uuid references public.profiles (id) on delete set null,
  kind       text not null check (kind in ('criado', 'movido', 'arquivado', 'comentario', 'anexo')),
  data       jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.task_activity drop constraint if exists task_activity_kind_check;
alter table public.task_activity add constraint task_activity_kind_check
  check (kind in ('criado', 'movido', 'arquivado', 'desarquivado', 'comentario', 'comentario_apagado', 'anexo'));
create index if not exists task_activity_board_idx on public.task_activity (board_id, created_at desc);
create index if not exists task_activity_task_idx on public.task_activity (task_id, created_at desc);

-- 4. Gatilhos -------------------------------------------------------------------------------------------------------------------
-- Histórico: única porta de escrita de task_activity.
create or replace function public.task_log(p_board uuid, p_task uuid, p_kind text, p_data jsonb default '{}')
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.task_activity (board_id, task_id, actor, kind, data, created_at)
    values (p_board, p_task, (select auth.uid()), p_kind, p_data, clock_timestamp());
  -- poda: só 'movido', e só além das 500 mais recentes do cartão
  if p_kind = 'movido' and p_task is not null then
    delete from public.task_activity where id in (select a.id from public.task_activity a where a.task_id = p_task and a.kind = 'movido'
                                                   and a.actor is not distinct from (select auth.uid()) order by a.created_at desc, a.id offset 500);
  end if;
end $$;

-- tetos por cartão/quadro: task_limite_tg(coluna, máximo, descrição); conta como dono (sem RLS)
create or replace function public.task_limite_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_n bigint; v_ok boolean; v_id uuid := (to_jsonb(new) ->> tg_argv[0])::uuid;
begin
  -- quem não pode nem ver o cartão/quadro: sai sem contar nem travar (a RLS recusa com 42501). 'ver' (não 'editar') porque
  -- observadores só pedem 'ver'; quem vê já sabe as contagens.
  if (select auth.uid()) is not null then
    if tg_argv[0] = 'task_id' then v_ok := public.task_pode(v_id, 'ver');
    elsif tg_argv[0] = 'board_id' then v_ok := public.board_pode(v_id, 'ver');
    else v_ok := public.checklist_pode(v_id, 'ver'); end if;
    if not v_ok then return new; end if;
  end if;
  perform pg_advisory_xact_lock(hashtext('quadro:' || v_id::text));
  execute format('select count(*) from %s where %I = $1', tg_relid::regclass, tg_argv[0])
    into v_n using v_id;
  if v_n >= tg_argv[1]::int then
    raise exception 'Limite de % %.', tg_argv[1], tg_argv[2] using errcode = '23514';
  end if;
  return new;
end $$;
create or replace function public.task_receipts_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.read_at is not null then new.read_at := greatest(now(), new.delivered_at); end if;
  elsif old.read_at is not null then
    new.read_at := old.read_at;
  elsif new.read_at is not null then
    new.read_at := greatest(now(), old.delivered_at);
  end if;
  return new;
end $$;
drop trigger if exists task_comment_receipts_quadro on public.task_comment_receipts;
create trigger task_comment_receipts_quadro before insert or update on public.task_comment_receipts
  for each row execute function public.task_receipts_tg();
create or replace function public.task_views_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.last_seen_at := now();
  return new;
end $$;
drop trigger if exists task_card_views_quadro on public.task_card_views;
create trigger task_card_views_quadro before insert or update on public.task_card_views
  for each row execute function public.task_views_tg();

-- tetos (ver DECISÃO 7)
drop trigger if exists task_checklists_limite on public.task_checklists;
create trigger task_checklists_limite before insert on public.task_checklists
  for each row execute function public.task_limite_tg('task_id', '50', 'listas por cartão');
drop trigger if exists task_checklist_items_limite on public.task_checklist_items;
create trigger task_checklist_items_limite before insert on public.task_checklist_items
  for each row execute function public.task_limite_tg('checklist_id', '200', 'itens por lista');
drop trigger if exists task_comments_limite on public.task_comments;
create trigger task_comments_limite before insert on public.task_comments
  for each row execute function public.task_limite_tg('task_id', '1000', 'comentários por cartão');
drop trigger if exists task_attachments_limite on public.task_attachments;
create trigger task_attachments_limite before insert on public.task_attachments
  for each row execute function public.task_limite_tg('task_id', '30', 'anexos por cartão');
drop trigger if exists task_links_limite on public.task_links;
create trigger task_links_limite before insert on public.task_links
  for each row execute function public.task_limite_tg('task_id', '30', 'atalhos por cartão');
drop trigger if exists task_dependencies_limite on public.task_dependencies;
create trigger task_dependencies_limite before insert on public.task_dependencies
  for each row execute function public.task_limite_tg('task_id', '20', 'dependências por cartão');
drop trigger if exists task_labels_limite on public.task_labels;
create trigger task_labels_limite before insert on public.task_labels
  for each row execute function public.task_limite_tg('board_id', '50', 'etiquetas por quadro');
drop trigger if exists task_card_members_limite on public.task_card_members;
create trigger task_card_members_limite before insert on public.task_card_members
  for each row execute function public.task_limite_tg('task_id', '100', 'membros por cartão');
drop trigger if exists task_card_labels_limite on public.task_card_labels;
create trigger task_card_labels_limite before insert on public.task_card_labels
  for each row execute function public.task_limite_tg('task_id', '20', 'etiquetas por cartão');
drop trigger if exists task_watchers_limite on public.task_watchers;
create trigger task_watchers_limite before insert on public.task_watchers
  for each row execute function public.task_limite_tg('task_id', '100', 'observadores por cartão');

-- etiqueta e cartão do mesmo quadro
create or replace function public.task_card_labels_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not public.task_pode(new.task_id, 'editar') then return new; end if; -- RLS recusa
  if (select t.board_id from public.producer_tasks t where t.id = new.task_id)
     is distinct from (select l.board_id from public.task_labels l where l.id = new.label_id) then
    raise exception 'Etiqueta de outro quadro.' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists task_card_labels_quadro on public.task_card_labels;
create trigger task_card_labels_quadro before insert on public.task_card_labels
  for each row execute function public.task_card_labels_tg();

-- membro do cartão: dono ou membro ativo da equipe do produtor do cartão
create or replace function public.task_card_members_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not public.task_pode(new.task_id, 'editar') then return new; end if; -- RLS recusa
  if not public.equipe_pode((select t.producer_id from public.producer_tasks t where t.id = new.task_id), null, null, new.user_id) then
    raise exception 'Esse usuário não é da equipe deste produtor.' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists task_card_members_quadro on public.task_card_members;
create trigger task_card_members_quadro before insert on public.task_card_members
  for each row execute function public.task_card_members_tg();

-- item de checklist: quem marcou e quando (o cliente não escolhe)
create or replace function public.task_checklist_items_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.done and (tg_op = 'INSERT' or not old.done) then
    new.done_at := now(); new.done_by := (select auth.uid());
  elsif not new.done then
    new.done_at := null; new.done_by := null;
  elsif tg_op = 'UPDATE' then
    new.done_at := old.done_at; new.done_by := old.done_by;
  end if;
  return new;
end $$;
drop trigger if exists task_checklist_items_quadro on public.task_checklist_items;
create trigger task_checklist_items_quadro before insert or update on public.task_checklist_items
  for each row execute function public.task_checklist_items_tg();

-- anexo: caminho <produtor>/<este cartão>/<uuid>-<nome>.<png|jpg|jpeg|webp|pdf> (mesma regra do Storage); registra no histórico
create or replace function public.task_attachments_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_t public.producer_tasks;
begin
  if (select auth.uid()) is not null and not public.task_pode(new.task_id, 'editar') then return new; end if; -- RLS recusa
  select * into v_t from public.producer_tasks t where t.id = new.task_id;
  if public.task_anexo_produtor(new.storage_path) is distinct from v_t.producer_id
     or split_part(new.storage_path, '/', 2) <> new.task_id::text then
    raise exception 'Caminho de anexo inválido.' using errcode = '23514';
  end if;
  perform public.task_log(v_t.board_id, new.task_id, 'anexo', jsonb_build_object('name', new.name));
  return new;
end $$;
drop trigger if exists task_attachments_quadro on public.task_attachments;
create trigger task_attachments_quadro before insert on public.task_attachments
  for each row execute function public.task_attachments_tg();

-- comentário: menções só de gente da equipe; registra no histórico
create or replace function public.task_comments_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_t public.producer_tasks; v_m uuid;
begin
  select * into v_t from public.producer_tasks t where t.id = new.task_id;
  -- só revalida menções quando elas mudaram (o autor pode editar o texto de comentário antigo)
  if tg_op = 'INSERT' or new.mentions is distinct from old.mentions then
    if cardinality(new.mentions) > 20 then
      raise exception 'Máximo de 20 menções por comentário.' using errcode = '23514';
    end if;
    new.mentions := array(select distinct m from unnest(new.mentions) m);
    foreach v_m in array new.mentions loop
      if not public.equipe_pode(v_t.producer_id, null, null, v_m) then
        raise exception 'Menção a quem não é da equipe deste produtor.' using errcode = '23514';
      end if;
    end loop;
  end if;
  if tg_op = 'INSERT' then
    perform public.task_log(v_t.board_id, new.task_id, 'comentario', jsonb_build_object('comment_id', new.id));
  end if;
  return new;
end $$;
drop trigger if exists task_comments_quadro on public.task_comments;
create trigger task_comments_quadro before insert or update on public.task_comments
  for each row execute function public.task_comments_tg();

-- dependência: mesmo quadro e sem ciclo (A->B->...->A)
create or replace function public.task_dependencies_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not public.task_pode(new.task_id, 'editar') then return new; end if; -- RLS recusa
  if (select t.board_id from public.producer_tasks t where t.id = new.task_id)
     is distinct from (select t.board_id from public.producer_tasks t where t.id = new.depends_on) then
    raise exception 'Dependência entre quadros diferentes.' using errcode = '23514';
  end if;
  -- uma gravação por vez por quadro: sem isso, A->B e B->A ao mesmo tempo passariam as duas pela checagem de ciclo
  perform pg_advisory_xact_lock(hashtext('quadro:' || (select t.board_id::text from public.producer_tasks t where t.id = new.task_id)));
  if exists (with recursive r(id) as (select new.depends_on union select d.depends_on from public.task_dependencies d join r on d.task_id = r.id)
             select 1 from r where r.id = new.task_id) then
    raise exception 'Essa dependência cria um ciclo.' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists task_dependencies_quadro on public.task_dependencies;
create trigger task_dependencies_quadro before insert on public.task_dependencies
  for each row execute function public.task_dependencies_tg();

-- producer_tasks: ir para coluna doing/done com dependência aberta é recusado. Nome com "_z_deps" para rodar DEPOIS do
-- producer_tasks_quadro da fatia 1 (ordem alfabética), já com a coluna final em new.column_id.
create or replace function public.producer_tasks_z_deps_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- só mudança de coluna dentro do MESMO quadro (apagar evento troca de quadro e não pode falhar); destino 'todo' é livre
  if new.board_id is not distinct from old.board_id
     and new.column_id is distinct from old.column_id
     and (select c.kind from public.task_columns c where c.id = new.column_id) is distinct from 'todo'
     and exists (select 1 from public.task_dependencies d
                 join public.producer_tasks b on b.id = d.depends_on
                 left join public.task_columns bc on bc.id = b.column_id
                 where d.task_id = new.id and b.archived_at is null and bc.kind is distinct from 'done') then
    raise exception 'Este cartão depende de outro que ainda não foi concluído.' using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists producer_tasks_quadro_z_deps on public.producer_tasks;
create trigger producer_tasks_quadro_z_deps before update on public.producer_tasks
  for each row execute function public.producer_tasks_z_deps_tg();

-- histórico do cartão (AFTER: o gatilho da fatia 1 já definiu quadro e coluna)
create or replace function public.producer_tasks_log_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.board_id is null then return null; end if; -- só acontece com o gatilho da fatia 1 desligado (testes, manutenção)
  if tg_op = 'INSERT' then
    perform public.task_log(new.board_id, new.id, 'criado', jsonb_build_object('title', new.title));
  else
    -- o cartão trocou de quadro (apagar evento): o histórico dele vai junto, senão sumiria com o quadro do evento
    if new.board_id is distinct from old.board_id then
      update public.task_activity set board_id = new.board_id where task_id = new.id;
    end if;
    if new.column_id is distinct from old.column_id then
      perform public.task_log(new.board_id, new.id, 'movido', jsonb_build_object('de', old.column_id, 'para', new.column_id));
    end if;
    if new.archived_at is not null and old.archived_at is null then
      perform public.task_log(new.board_id, new.id, 'arquivado', '{}');
    end if;
    if new.archived_at is null and old.archived_at is not null then
      perform public.task_log(new.board_id, new.id, 'desarquivado', '{}');
    end if;
  end if;
  return null;
end $$;
-- comentário apagado (AFTER DELETE; ator = auth.uid() dentro de task_log). Apagar o cartão leva os comentários em cascata:
-- sem cartão não há o que registrar (a chave estrangeira recusaria).
create or replace function public.task_comments_del_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_b uuid;
begin
  select t.board_id into v_b from public.producer_tasks t where t.id = old.task_id;
  if v_b is not null then
    perform public.task_log(v_b, old.task_id, 'comentario_apagado', jsonb_build_object('comment_id', old.id));
  end if;
  return null;
end $$;
drop trigger if exists task_comments_quadro_del on public.task_comments;
create trigger task_comments_quadro_del after delete on public.task_comments
  for each row execute function public.task_comments_del_tg();

drop trigger if exists producer_tasks_quadro_log on public.producer_tasks;
create trigger producer_tasks_quadro_log after insert or update on public.producer_tasks
  for each row execute function public.producer_tasks_log_tg();

-- 5. Funções: nenhuma para anon; só as de permissão para authenticated ---------------------------------------------------------
revoke all on function public.board_pode(uuid, text), public.task_pode(uuid, text), public.checklist_pode(uuid, text),
  public.comment_pode(uuid, text), public.quadro_location_ok(jsonb), public.quadro_fields_ok(jsonb) from public, anon;
grant execute on function public.board_pode(uuid, text), public.task_pode(uuid, text), public.checklist_pode(uuid, text),
  public.comment_pode(uuid, text), public.quadro_location_ok(jsonb), public.quadro_fields_ok(jsonb) to authenticated;
revoke all on function public.task_log(uuid, uuid, text, jsonb), public.task_card_labels_tg(), public.task_card_members_tg(),
  public.task_checklist_items_tg(), public.task_attachments_tg(), public.task_comments_tg(), public.task_dependencies_tg(),
  public.producer_tasks_z_deps_tg(), public.producer_tasks_log_tg(), public.task_limite_tg(), public.task_receipts_tg(),
  public.task_views_tg(), public.task_comments_del_tg() from public, anon, authenticated;

-- 6. Regras (RLS) ---------------------------------------------------------------------------------------------------------------
alter table public.task_labels enable row level security;
alter table public.task_card_labels enable row level security;
alter table public.task_card_members enable row level security;
alter table public.task_watchers enable row level security;
alter table public.task_checklists enable row level security;
alter table public.task_checklist_items enable row level security;
alter table public.task_attachments enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_comment_receipts enable row level security;
alter table public.task_card_views enable row level security;
alter table public.task_links enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.task_activity enable row level security;

-- task_labels (por quadro)
drop policy if exists task_labels_ver on public.task_labels;
drop policy if exists task_labels_criar on public.task_labels;
drop policy if exists task_labels_editar on public.task_labels;
drop policy if exists task_labels_apagar on public.task_labels;
create policy task_labels_ver on public.task_labels as permissive for select to authenticated
  using (public.board_pode(board_id, 'ver'));
create policy task_labels_criar on public.task_labels as permissive for insert to authenticated
  with check (public.board_pode(board_id, 'editar'));
create policy task_labels_editar on public.task_labels as permissive for update to authenticated
  using (public.board_pode(board_id, 'editar')) with check (public.board_pode(board_id, 'editar'));
create policy task_labels_apagar on public.task_labels as permissive for delete to authenticated
  using (public.board_pode(board_id, 'editar'));

-- ver / criar / apagar, tudo pelo cartão: task_card_labels, task_card_members, task_attachments, task_dependencies
drop policy if exists task_card_labels_ver on public.task_card_labels;
drop policy if exists task_card_labels_criar on public.task_card_labels;
drop policy if exists task_card_labels_apagar on public.task_card_labels;
create policy task_card_labels_ver on public.task_card_labels as permissive for select to authenticated
  using (public.task_pode(task_id, 'ver'));
create policy task_card_labels_criar on public.task_card_labels as permissive for insert to authenticated
  with check (public.task_pode(task_id, 'editar'));
create policy task_card_labels_apagar on public.task_card_labels as permissive for delete to authenticated
  using (public.task_pode(task_id, 'editar'));

drop policy if exists task_card_members_ver on public.task_card_members;
drop policy if exists task_card_members_criar on public.task_card_members;
drop policy if exists task_card_members_apagar on public.task_card_members;
create policy task_card_members_ver on public.task_card_members as permissive for select to authenticated
  using (public.task_pode(task_id, 'ver'));
create policy task_card_members_criar on public.task_card_members as permissive for insert to authenticated
  with check (public.task_pode(task_id, 'editar'));
create policy task_card_members_apagar on public.task_card_members as permissive for delete to authenticated
  using (public.task_pode(task_id, 'editar'));

drop policy if exists task_attachments_ver on public.task_attachments;
drop policy if exists task_attachments_criar on public.task_attachments;
drop policy if exists task_attachments_apagar on public.task_attachments;
create policy task_attachments_ver on public.task_attachments as permissive for select to authenticated
  using (public.task_pode(task_id, 'ver'));
create policy task_attachments_criar on public.task_attachments as permissive for insert to authenticated
  with check (public.task_pode(task_id, 'editar') and created_by = (select auth.uid()));
create policy task_attachments_apagar on public.task_attachments as permissive for delete to authenticated
  using (public.task_pode(task_id, 'editar'));

drop policy if exists task_dependencies_ver on public.task_dependencies;
drop policy if exists task_dependencies_criar on public.task_dependencies;
drop policy if exists task_dependencies_apagar on public.task_dependencies;
create policy task_dependencies_ver on public.task_dependencies as permissive for select to authenticated
  using (public.task_pode(task_id, 'ver'));
create policy task_dependencies_criar on public.task_dependencies as permissive for insert to authenticated
  with check (public.task_pode(task_id, 'editar'));
create policy task_dependencies_apagar on public.task_dependencies as permissive for delete to authenticated
  using (public.task_pode(task_id, 'editar'));

-- observar o cartão: a própria pessoa, com 'ver'
drop policy if exists task_watchers_ver on public.task_watchers;
drop policy if exists task_watchers_criar on public.task_watchers;
drop policy if exists task_watchers_apagar on public.task_watchers;
create policy task_watchers_ver on public.task_watchers as permissive for select to authenticated
  using (public.task_pode(task_id, 'ver'));
create policy task_watchers_criar on public.task_watchers as permissive for insert to authenticated
  with check (user_id = (select auth.uid()) and public.task_pode(task_id, 'ver'));
create policy task_watchers_apagar on public.task_watchers as permissive for delete to authenticated
  using (user_id = (select auth.uid()));

-- ver / criar / editar / apagar pelo cartão: task_checklists, task_links
drop policy if exists task_checklists_ver on public.task_checklists;
drop policy if exists task_checklists_criar on public.task_checklists;
drop policy if exists task_checklists_editar on public.task_checklists;
drop policy if exists task_checklists_apagar on public.task_checklists;
create policy task_checklists_ver on public.task_checklists as permissive for select to authenticated
  using (public.task_pode(task_id, 'ver'));
create policy task_checklists_criar on public.task_checklists as permissive for insert to authenticated
  with check (public.task_pode(task_id, 'editar'));
create policy task_checklists_editar on public.task_checklists as permissive for update to authenticated
  using (public.task_pode(task_id, 'editar')) with check (public.task_pode(task_id, 'editar'));
create policy task_checklists_apagar on public.task_checklists as permissive for delete to authenticated
  using (public.task_pode(task_id, 'editar'));

drop policy if exists task_links_ver on public.task_links;
drop policy if exists task_links_criar on public.task_links;
drop policy if exists task_links_editar on public.task_links;
drop policy if exists task_links_apagar on public.task_links;
create policy task_links_ver on public.task_links as permissive for select to authenticated
  using (public.task_pode(task_id, 'ver'));
create policy task_links_criar on public.task_links as permissive for insert to authenticated
  with check (public.task_pode(task_id, 'editar'));
create policy task_links_editar on public.task_links as permissive for update to authenticated
  using (public.task_pode(task_id, 'editar')) with check (public.task_pode(task_id, 'editar'));
create policy task_links_apagar on public.task_links as permissive for delete to authenticated
  using (public.task_pode(task_id, 'editar'));

-- itens de checklist (pela lista)
drop policy if exists task_checklist_items_ver on public.task_checklist_items;
drop policy if exists task_checklist_items_criar on public.task_checklist_items;
drop policy if exists task_checklist_items_editar on public.task_checklist_items;
drop policy if exists task_checklist_items_apagar on public.task_checklist_items;
create policy task_checklist_items_ver on public.task_checklist_items as permissive for select to authenticated
  using (public.checklist_pode(checklist_id, 'ver'));
create policy task_checklist_items_criar on public.task_checklist_items as permissive for insert to authenticated
  with check (public.checklist_pode(checklist_id, 'editar'));
create policy task_checklist_items_editar on public.task_checklist_items as permissive for update to authenticated
  using (public.checklist_pode(checklist_id, 'editar')) with check (public.checklist_pode(checklist_id, 'editar'));
create policy task_checklist_items_apagar on public.task_checklist_items as permissive for delete to authenticated
  using (public.checklist_pode(checklist_id, 'editar'));

-- comentários: lê quem vê; só o autor (que edita o quadro) cria, altera e apaga o próprio
drop policy if exists task_comments_ver on public.task_comments;
drop policy if exists task_comments_criar on public.task_comments;
drop policy if exists task_comments_editar on public.task_comments;
drop policy if exists task_comments_apagar on public.task_comments;
create policy task_comments_ver on public.task_comments as permissive for select to authenticated
  using (public.task_pode(task_id, 'ver'));
create policy task_comments_criar on public.task_comments as permissive for insert to authenticated
  with check (user_id = (select auth.uid()) and public.task_pode(task_id, 'editar'));
create policy task_comments_editar on public.task_comments as permissive for update to authenticated
  using (user_id = (select auth.uid()) and public.task_pode(task_id, 'editar'))
  with check (user_id = (select auth.uid()) and public.task_pode(task_id, 'editar'));
create policy task_comments_apagar on public.task_comments as permissive for delete to authenticated
  using ((user_id = (select auth.uid()) and public.task_pode(task_id, 'editar'))
         or exists (select 1 from public.producer_tasks t where t.id = task_id and t.producer_id = (select auth.uid())));

-- recibos: todos com 'ver' leem; cada um grava só o próprio
drop policy if exists task_comment_receipts_ver on public.task_comment_receipts;
drop policy if exists task_comment_receipts_criar on public.task_comment_receipts;
drop policy if exists task_comment_receipts_editar on public.task_comment_receipts;
create policy task_comment_receipts_ver on public.task_comment_receipts as permissive for select to authenticated
  using (public.comment_pode(comment_id, 'ver'));
create policy task_comment_receipts_criar on public.task_comment_receipts as permissive for insert to authenticated
  with check (user_id = (select auth.uid()) and public.comment_pode(comment_id, 'ver'));
create policy task_comment_receipts_editar on public.task_comment_receipts as permissive for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.comment_pode(comment_id, 'ver'));

-- "visto por"
drop policy if exists task_card_views_ver on public.task_card_views;
drop policy if exists task_card_views_criar on public.task_card_views;
drop policy if exists task_card_views_editar on public.task_card_views;
create policy task_card_views_ver on public.task_card_views as permissive for select to authenticated
  using (public.task_pode(task_id, 'ver'));
create policy task_card_views_criar on public.task_card_views as permissive for insert to authenticated
  with check (user_id = (select auth.uid()) and public.task_pode(task_id, 'ver'));
create policy task_card_views_editar on public.task_card_views as permissive for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.task_pode(task_id, 'ver'));

-- histórico: só leitura
drop policy if exists task_activity_ver on public.task_activity;
create policy task_activity_ver on public.task_activity as permissive for select to authenticated
  using (public.board_pode(board_id, 'ver'));

-- 2FA: mesma regra RESTRICTIVE da fatia 1 em cada tabela nova
do $$
declare v_tab text;
begin
  foreach v_tab in array array['task_labels', 'task_card_labels', 'task_card_members', 'task_watchers', 'task_checklists',
    'task_checklist_items', 'task_attachments', 'task_comments', 'task_comment_receipts', 'task_card_views', 'task_links',
    'task_dependencies', 'task_activity'] loop
    execute format('drop policy if exists gf_mfa_aal2 on public.%I', v_tab);
    execute format('create policy gf_mfa_aal2 on public.%I as restrictive for all to authenticated using ((select public.gf_mfa_ok())) with check ((select public.gf_mfa_ok()))', v_tab);
  end loop;
end $$;

-- 7. Permissões por coluna (service_role não é mexido) -----------------------------------------------------------------------------
revoke all on table public.task_labels, public.task_card_labels, public.task_card_members, public.task_watchers,
  public.task_checklists, public.task_checklist_items, public.task_attachments, public.task_comments,
  public.task_comment_receipts, public.task_card_views, public.task_links, public.task_dependencies, public.task_activity
  from public, anon, authenticated;
grant select on table public.task_labels, public.task_card_labels, public.task_card_members, public.task_watchers,
  public.task_checklists, public.task_checklist_items, public.task_attachments, public.task_comments,
  public.task_comment_receipts, public.task_card_views, public.task_links, public.task_dependencies, public.task_activity
  to authenticated;
grant delete on table public.task_labels, public.task_card_labels, public.task_card_members, public.task_watchers,
  public.task_checklists, public.task_checklist_items, public.task_attachments, public.task_comments,
  public.task_links, public.task_dependencies to authenticated;
grant insert (board_id, name, color) on table public.task_labels to authenticated;
grant update (name, color) on table public.task_labels to authenticated;
grant insert (task_id, label_id) on table public.task_card_labels to authenticated;
grant insert (task_id, user_id) on table public.task_card_members to authenticated;
grant insert (task_id, user_id) on table public.task_watchers to authenticated;
grant insert (task_id, title, position) on table public.task_checklists to authenticated;
grant update (title, position) on table public.task_checklists to authenticated;
grant insert (checklist_id, text, done, position) on table public.task_checklist_items to authenticated;
grant update (text, done, position) on table public.task_checklist_items to authenticated;
grant insert (task_id, storage_path, name, mime, size_bytes, created_by) on table public.task_attachments to authenticated;
grant insert (task_id, body, mentions, user_id) on table public.task_comments to authenticated;
grant update (body, mentions) on table public.task_comments to authenticated;
grant insert (comment_id, user_id, read_at, device) on table public.task_comment_receipts to authenticated;
grant update (read_at, device) on table public.task_comment_receipts to authenticated;
grant insert (task_id, user_id, device) on table public.task_card_views to authenticated;
grant update (device) on table public.task_card_views to authenticated;
grant insert (task_id, kind, ref) on table public.task_links to authenticated;
grant update (kind, ref) on table public.task_links to authenticated;
grant insert (task_id, depends_on) on table public.task_dependencies to authenticated;
-- producer_tasks: as colunas novas entram nas permissões da fatia 1 (que continuam valendo)
grant insert (cover, location, start_date, fields, archived_at, recur_days, recur_next) on table public.producer_tasks to authenticated;
grant update (cover, location, start_date, fields, archived_at, recur_days, recur_next) on table public.producer_tasks to authenticated;

-- 8. Storage: bucket privado task-attachments (10 MB; png, jpeg, webp, pdf) ----------------------------------------------------------------
-- Caminho: <producer_id>/<task_id>/<arquivo>. O primeiro segmento decide a permissão. gf_mfa_aal2 de storage.objects
-- (20260930_2fa_no_banco.sql) já vale para todo bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('task-attachments', 'task-attachments', false, 10485760,
        array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- produtor do caminho <produtor>/<cartão>/<uuid>-<nome>.<ext>: nulo se o formato não bate, tem '..' ou o 2º segmento não é
-- um cartão desse produtor (upload órfão). Nome: começa por letra, dígito, _ ou -; extensão minúscula; '.png' não passa.
create or replace function public.task_anexo_produtor(p_name text)
returns uuid language sql stable security definer set search_path = '' as $$
  select t.producer_id from public.producer_tasks t
  where p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f-]{36}-[A-Za-z0-9_-][A-Za-z0-9_.-]{0,82}\.(png|jpe?g|webp|pdf)$'
    and p_name not like '%..%'
    and t.id::text = split_part(p_name, '/', 2) and t.producer_id::text = split_part(p_name, '/', 1)
    -- só revela o produtor a quem tem acesso (sem login = rotina do banco: valida só o formato)
    and ((select auth.uid()) is null or public.equipe_pode(t.producer_id, 'quadro', 'ver'))
$$;
revoke all on function public.task_anexo_produtor(text) from public, anon;
grant execute on function public.task_anexo_produtor(text) to authenticated;

drop policy if exists task_anexos_select on storage.objects;
create policy task_anexos_select on storage.objects as permissive for select to authenticated
  using (bucket_id = 'task-attachments' and public.equipe_pode(public.task_anexo_produtor(name), 'quadro', 'ver'));
drop policy if exists task_anexos_insert on storage.objects;
create policy task_anexos_insert on storage.objects as permissive for insert to authenticated
  with check (bucket_id = 'task-attachments' and public.equipe_pode(public.task_anexo_produtor(name), 'quadro', 'editar'));
drop policy if exists task_anexos_delete on storage.objects;
create policy task_anexos_delete on storage.objects as permissive for delete to authenticated
  using (bucket_id = 'task-attachments' and public.equipe_pode(public.task_anexo_produtor(name), 'quadro', 'editar'));

-- 9. Conferência que aborta (tudo ou nada) ------------------------------------------------------------------------------------------------------
do $$
declare
  v_tab text;
  v_esperado jsonb := jsonb_build_object(
    'task_labels', array['gf_mfa_aal2', 'task_labels_apagar', 'task_labels_criar', 'task_labels_editar', 'task_labels_ver'],
    'task_card_labels', array['gf_mfa_aal2', 'task_card_labels_apagar', 'task_card_labels_criar', 'task_card_labels_ver'],
    'task_card_members', array['gf_mfa_aal2', 'task_card_members_apagar', 'task_card_members_criar', 'task_card_members_ver'],
    'task_watchers', array['gf_mfa_aal2', 'task_watchers_apagar', 'task_watchers_criar', 'task_watchers_ver'],
    'task_checklists', array['gf_mfa_aal2', 'task_checklists_apagar', 'task_checklists_criar', 'task_checklists_editar', 'task_checklists_ver'],
    'task_checklist_items', array['gf_mfa_aal2', 'task_checklist_items_apagar', 'task_checklist_items_criar', 'task_checklist_items_editar', 'task_checklist_items_ver'],
    'task_attachments', array['gf_mfa_aal2', 'task_attachments_apagar', 'task_attachments_criar', 'task_attachments_ver'],
    'task_comments', array['gf_mfa_aal2', 'task_comments_apagar', 'task_comments_criar', 'task_comments_editar', 'task_comments_ver'],
    'task_comment_receipts', array['gf_mfa_aal2', 'task_comment_receipts_criar', 'task_comment_receipts_editar', 'task_comment_receipts_ver'],
    'task_card_views', array['gf_mfa_aal2', 'task_card_views_criar', 'task_card_views_editar', 'task_card_views_ver'],
    'task_links', array['gf_mfa_aal2', 'task_links_apagar', 'task_links_criar', 'task_links_editar', 'task_links_ver'],
    'task_dependencies', array['gf_mfa_aal2', 'task_dependencies_apagar', 'task_dependencies_criar', 'task_dependencies_ver'],
    'task_activity', array['gf_mfa_aal2', 'task_activity_ver']);
begin
  for v_tab in select jsonb_object_keys(v_esperado) loop
    if not (select relrowsecurity from pg_class where oid = ('public.' || v_tab)::regclass) then
      raise exception '% sem RLS', v_tab;
    end if;
    if (select array_agg(policyname::text order by policyname::text) from pg_policies
        where schemaname = 'public' and tablename = v_tab)
       is distinct from (select array_agg(x order by x) from jsonb_array_elements_text(v_esperado -> v_tab) x) then
      raise exception 'regras de % fora do esperado', v_tab;
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = v_tab
        and policyname = 'gf_mfa_aal2' and permissive = 'RESTRICTIVE' and cmd = 'ALL') then
      raise exception 'gf_mfa_aal2 sumiu ou deixou de ser restritiva em %', v_tab;
    end if;
    if has_table_privilege('anon', ('public.' || v_tab)::regclass, 'select,insert,update,delete') then
      raise exception 'anon ainda tem privilégio em %', v_tab;
    end if;
  end loop;
  if has_table_privilege('authenticated', 'public.task_activity', 'insert,update,delete') then
    raise exception 'authenticated não pode gravar em task_activity';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public'
             and (table_name like 'task\_%' or table_name = 'producer_tasks') and column_name ~* '(^|_)ip(_|$)') then
    raise exception 'coluna de IP encontrada (LGPD)';
  end if;
  if has_function_privilege('anon', 'public.task_pode(uuid, text)', 'execute')
     or has_function_privilege('anon', 'public.board_pode(uuid, text)', 'execute')
     or has_function_privilege('anon', 'public.task_log(uuid, uuid, text, jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.task_log(uuid, uuid, text, jsonb)', 'execute') then
    raise exception 'permissão de função fora do esperado';
  end if;
  if not exists (select 1 from storage.buckets where id = 'task-attachments' and not public and file_size_limit = 10485760) then
    raise exception 'bucket task-attachments ausente ou público';
  end if;
  if (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'task\_anexos\_%') <> 3 then
    raise exception 'regras do bucket task-attachments fora do esperado';
  end if;
end $$;

commit;

-- Conferência (só leitura). Esperado: 15 tabelas task_* (13 novas + task_boards e task_columns da fatia 1), 7 colunas novas em producer_tasks, bucket privado.
select 'tabelas' as item, count(*)::text as valor from pg_tables where schemaname = 'public' and tablename like 'task\_%'
union all
select 'colunas novas', count(*)::text from information_schema.columns where table_schema = 'public' and table_name = 'producer_tasks'
  and column_name in ('cover', 'location', 'start_date', 'fields', 'archived_at', 'recur_days', 'recur_next')
union all
select 'bucket privado', (select (not public)::text from storage.buckets where id = 'task-attachments');
