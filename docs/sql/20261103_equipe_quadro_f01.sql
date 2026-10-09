-- =============================================================================
-- Equipe e Quadro, fatias 0+1 (09/10/2026). Quadro de tarefas com colunas, por evento ou da produtora, e permissão de
-- membro da equipe por ferramenta. O membro ainda NÃO abre o painel do produtor nesta fatia: o banco fica pronto e a
-- tela continua só do dono.
-- 1) Tabelas novas: task_boards (um quadro por produtor+evento, ou da produtora quando event_id é nulo), task_columns
--    (colunas do quadro; kind = todo | doing | done) e team_member_tools (nível ver | editar por membro e ferramenta).
-- 2) producer_tasks ganha board_id, column_id, position (fracionário: mover um cartão grava um número entre os vizinhos),
--    updated_at (a tela usa para detectar duas pessoas mexendo no mesmo cartão) e created_by.
-- 3) equipe_pode(): única porta de permissão (dono, ou membro aceito, não bloqueado e com nível suficiente).
-- 4) Gatilho em producer_tasks: sem quadro, cria/usa o quadro certo; recusa coluna de outro quadro; mantém status
--    coerente com a coluna (a tela antiga, que só grava status, continua funcionando); carimba updated_at e created_by.
-- 5) Segurança: producer_tasks tinha SELECT/INSERT/UPDATE/DELETE para o papel anon (baseline) e a regra única
--    "Produtor gerencia tasks". Sai a regra única e sai o anon; entram regras por operação com equipe_pode e
--    permissões por coluna (padrão de 20261017_team_members_rls.sql). gf_mfa_aal2 (2FA) é recriada idêntica.
--    A conferência "evento é do próprio produtor" (de 20261010_producer_tasks_evento.sql) passa para o gatilho.
-- 6) Apagar um evento com tarefas: gatilho em events devolve as tarefas ao quadro da produtora antes (antes elas
--    ficavam "sem evento" por ON DELETE SET NULL; o quadro do evento some junto, em cascata).
-- 7) Backfill: toda tarefa existente ganha quadro, coluna (pelo status) e posição. Idempotente.
--
-- Pré-requisitos: 20260930_2fa_no_banco.sql (gf_mfa_ok) e 20261017_team_members_rls.sql (blocked_at, único producer/user).
-- Como aplicar: colar o arquivo inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA pelo TextEdit: erro 17). Fora do horário
-- de pico (set local lock_timeout abaixo faz desistir sem gravar nada se algo segurar a tabela; rodar de novo).
-- Uma transação só: se a conferência do fim falhar, nada é gravado. Idempotente.
-- O front funciona antes e depois deste SQL (antes: "modo antigo", só status). Aplicar antes ou depois do merge.
-- NÃO mover para supabase/migrations/ (motivo no cabeçalho de 20260927_security_hardening.sql).
-- Teste: supabase/tests/equipe_quadro_f01.test.sql (pgTAP; banco local, nunca em produção).
-- Desfazer (só depois de voltar o front): drop trigger producer_tasks_quadro on public.producer_tasks;
--   drop trigger events_quadro_antes_apagar on public.events; apagar as regras novas e recriar "Produtor gerencia tasks"
--   (ver 20261010_producer_tasks_evento.sql); alter table producer_tasks drop column board_id, column_id, position,
--   updated_at, created_by; drop table team_member_tools, task_columns, task_boards; drop function equipe_pode,
--   quadro_garantir, quadro_criar_interno, producer_tasks_quadro_tg, events_quadro_antes_apagar_tg.
--
-- DECISÕES
-- 1. Coluna tem "kind" (todo/doing/done) porque o status de producer_tasks (CHECK) continua sendo a verdade para
--    relatórios e para a tela antiga; o gatilho mantém os dois iguais.
-- 2. board_id e column_id ficam anuláveis na coluna (a tela antiga grava sem eles); o gatilho sempre os preenche.
-- 3. ON DELETE RESTRICT em board_id/column_id: não se apaga coluna com cartão. O quadro do evento só some quando o
--    gatilho de events já tirou as tarefas dele.
-- 4. Sem flag de sessão no backfill: o gatilho reproduz o mesmo status (a coluna é escolhida pelo status).
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 0. Pré-requisitos -----------------------------------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.producer_tasks') is null then raise exception 'public.producer_tasks não existe'; end if;
  if to_regclass('public.team_members') is null then raise exception 'public.team_members não existe'; end if;
  if to_regproc('public.gf_mfa_ok') is null then
    raise exception 'Falta public.gf_mfa_ok (20260930_2fa_no_banco.sql): aplicar antes';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'team_members'
                 and column_name = 'blocked_at') then
    raise exception 'Falta team_members.blocked_at (20261017_team_members_rls.sql): aplicar antes';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'team_members_producer_user_key'
                 and conrelid = 'public.team_members'::regclass) then
    raise exception 'Falta team_members_producer_user_key (20261017_team_members_rls.sql): aplicar antes';
  end if;
end $$;

create temp table _f01_antes on commit drop as select count(*) as n from public.producer_tasks;

-- 1. Tabelas -------------------------------------------------------------------------------------------------------------
create table if not exists public.task_boards (
  id          uuid primary key default gen_random_uuid(),
  producer_id uuid not null references public.profiles (id),
  event_id    uuid references public.events (id) on delete cascade,
  name        text not null default 'Quadro',
  created_at  timestamptz not null default now()
);
-- um quadro por (produtor, evento); event_id nulo = quadro da produtora (nulo não conflita num índice comum: daí o coalesce)
create unique index if not exists task_boards_unico
  on public.task_boards (producer_id, (coalesce(event_id, '00000000-0000-0000-0000-000000000000'::uuid)));

create table if not exists public.task_columns (
  id       uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.task_boards (id) on delete cascade,
  name     text not null check (char_length(name) between 1 and 40),
  kind     text not null check (kind in ('todo', 'doing', 'done')),
  position numeric not null
);
create index if not exists task_columns_board_idx on public.task_columns (board_id, position);

create table if not exists public.team_member_tools (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.team_members (id) on delete cascade,
  ferramenta text not null check (ferramenta in ('quadro')),
  nivel      text not null check (nivel in ('ver', 'editar')),
  unique (member_id, ferramenta)
);

alter table public.producer_tasks add column if not exists board_id uuid references public.task_boards (id) on delete restrict;
alter table public.producer_tasks add column if not exists column_id uuid references public.task_columns (id) on delete restrict;
alter table public.producer_tasks add column if not exists position numeric;
alter table public.producer_tasks add column if not exists updated_at timestamptz not null default now();
alter table public.producer_tasks add column if not exists created_by uuid references public.profiles (id);
create index if not exists producer_tasks_quadro_idx on public.producer_tasks (board_id, column_id, position);

-- 2. Permissão: equipe_pode ------------------------------------------------------------------------------------------------
-- Verdadeira se p_user é o próprio produtor, ou membro aceito, não bloqueado e com nível suficiente na ferramenta
-- (editar vale como ver). p_ferramenta nula = só confere que é membro ativo. Para não vazar quem é membro de quem, perguntar
-- por OUTRA pessoa só responde a quem pode editar o quadro daquele produtor (e a rotinas sem login, como o backfill).
create or replace function public.equipe_pode(p_produtor uuid, p_ferramenta text, p_nivel text, p_user uuid default auth.uid())
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if p_user is null or p_produtor is null then return false; end if;
  if v_uid is not null and p_user <> v_uid and not public.equipe_pode(p_produtor, 'quadro', 'editar') then
    return false;
  end if;
  if p_user = p_produtor then return true; end if;
  return exists (
    select 1 from public.team_members m
    where m.producer_id = p_produtor and m.user_id = p_user and m.accepted_at is not null and m.blocked_at is null
      and (p_ferramenta is null or exists (
        select 1 from public.team_member_tools t
        where t.member_id = m.id and t.ferramenta = p_ferramenta
          and (t.nivel = 'editar' or p_nivel is distinct from 'editar'))));
end $$;

-- 3. Quadros -------------------------------------------------------------------------------------------------------------
-- Interna (sem checagem de quem chama): usada pelo gatilho de producer_tasks, onde a RLS já autorizou a gravação, e pelo
-- backfill. Recusa evento que não é do produtor.
create or replace function public.quadro_criar_interno(p_produtor uuid, p_evento uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_evento is not null and not exists (select 1 from public.events e where e.id = p_evento and e.producer_id = p_produtor) then
    raise exception 'Esse evento não é deste produtor.' using errcode = '42501';
  end if;
  insert into public.task_boards (producer_id, event_id) values (p_produtor, p_evento)
    on conflict (producer_id, (coalesce(event_id, '00000000-0000-0000-0000-000000000000'::uuid))) do nothing
    returning id into v_id;
  if v_id is null then
    select b.id into v_id from public.task_boards b
      where b.producer_id = p_produtor and b.event_id is not distinct from p_evento;
  else
    insert into public.task_columns (board_id, name, kind, position) values
      (v_id, 'A fazer', 'todo', 1000), (v_id, 'Em andamento', 'doing', 2000),
      (v_id, 'Em revisão', 'doing', 3000), (v_id, 'Feito', 'done', 4000);
  end if;
  return v_id;
end $$;

-- Chamada pela tela: devolve o id do quadro (criando com as colunas padrão se ainda não existe).
create or replace function public.quadro_garantir(p_produtor uuid, p_evento uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not public.equipe_pode(p_produtor, 'quadro', 'editar') then
    raise exception 'Sem permissão para o quadro deste produtor.' using errcode = '42501';
  end if;
  return public.quadro_criar_interno(p_produtor, p_evento);
end $$;

-- 4. Gatilho de producer_tasks (um só, BEFORE; sem UPDATE dentro, não faz laço) ------------------------------------------------
create or replace function public.producer_tasks_quadro_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_board public.task_boards;
  v_col public.task_columns;
  v_kind text;
begin
  if new.board_id is null then
    new.board_id := public.quadro_criar_interno(new.producer_id, new.event_id);
    new.column_id := null;
  end if;
  select * into v_board from public.task_boards b where b.id = new.board_id;
  if not found or v_board.producer_id <> new.producer_id then
    raise exception 'Quadro de outro produtor.' using errcode = '42501';
  end if;
  new.event_id := v_board.event_id;

  if new.column_id is not null then
    select * into v_col from public.task_columns c where c.id = new.column_id;
    if not found or v_col.board_id <> new.board_id then
      raise exception 'Coluna de outro quadro.' using errcode = '42501';
    end if;
  end if;

  if new.column_id is null
     or (tg_op = 'UPDATE' and new.column_id is not distinct from old.column_id and new.status is distinct from old.status) then
    -- sem coluna (INSERT sem coluna, ou tarefa que mudou de quadro) ou só o status mudou (tela antiga):
    -- primeira coluna do tipo do status
    v_kind := case new.status when 'in_progress' then 'doing' when 'done' then 'done' else 'todo' end;
    select c.id into new.column_id from public.task_columns c
      where c.board_id = new.board_id and c.kind = v_kind order by c.position limit 1;
    if new.column_id is null then raise exception 'O quadro não tem coluna do tipo %.', v_kind; end if;
  elsif tg_op = 'INSERT' or new.column_id is distinct from old.column_id then
    new.status := case v_col.kind when 'doing' then 'in_progress' else v_col.kind end;
  end if;

  if new.position is null or (tg_op = 'UPDATE' and new.column_id is distinct from old.column_id
                              and new.position is not distinct from old.position) then
    select coalesce(max(t.position), 0) + 1000 into new.position from public.producer_tasks t where t.column_id = new.column_id;
  end if;

  new.updated_at := now();
  if tg_op = 'INSERT' then new.created_by := (select auth.uid()); end if;
  return new;
end $$;

drop trigger if exists producer_tasks_quadro on public.producer_tasks;
create trigger producer_tasks_quadro before insert or update on public.producer_tasks
  for each row execute function public.producer_tasks_quadro_tg();

-- 5. Apagar evento: as tarefas voltam ao quadro da produtora antes do quadro do evento sumir em cascata -----------------------
create or replace function public.events_quadro_antes_apagar_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.producer_tasks set event_id = null, board_id = null, column_id = null where event_id = old.id;
  return old;
end $$;

drop trigger if exists events_quadro_antes_apagar on public.events;
create trigger events_quadro_antes_apagar before delete on public.events
  for each row execute function public.events_quadro_antes_apagar_tg();

revoke all on function public.equipe_pode(uuid, text, text, uuid) from public;
revoke all on function public.quadro_criar_interno(uuid, uuid) from public;
revoke all on function public.quadro_garantir(uuid, uuid) from public;
revoke all on function public.producer_tasks_quadro_tg() from public;
revoke all on function public.events_quadro_antes_apagar_tg() from public;
grant execute on function public.equipe_pode(uuid, text, text, uuid) to authenticated;
grant execute on function public.quadro_garantir(uuid, uuid) to authenticated;

-- 6. Regras e permissões ----------------------------------------------------------------------------------------------------
alter table public.task_boards enable row level security;
alter table public.task_columns enable row level security;
alter table public.team_member_tools enable row level security;
alter table public.producer_tasks enable row level security;

drop policy if exists "Produtor gerencia tasks" on public.producer_tasks;
drop policy if exists tasks_ver on public.producer_tasks;
drop policy if exists tasks_criar on public.producer_tasks;
drop policy if exists tasks_editar on public.producer_tasks;
drop policy if exists tasks_apagar on public.producer_tasks;
create policy tasks_ver on public.producer_tasks as permissive for select to authenticated
  using (public.equipe_pode(producer_id, 'quadro', 'ver'));
create policy tasks_criar on public.producer_tasks as permissive for insert to authenticated
  with check (public.equipe_pode(producer_id, 'quadro', 'editar')
              and (assigned_to is null or public.equipe_pode(producer_id, null, null, assigned_to)));
create policy tasks_editar on public.producer_tasks as permissive for update to authenticated
  using (public.equipe_pode(producer_id, 'quadro', 'editar'))
  with check (public.equipe_pode(producer_id, 'quadro', 'editar')
              and (assigned_to is null or public.equipe_pode(producer_id, null, null, assigned_to)));
create policy tasks_apagar on public.producer_tasks as permissive for delete to authenticated
  using (producer_id = (select auth.uid()));

drop policy if exists task_boards_ver on public.task_boards;
create policy task_boards_ver on public.task_boards as permissive for select to authenticated
  using (public.equipe_pode(producer_id, 'quadro', 'ver'));

drop policy if exists task_columns_ver on public.task_columns;
drop policy if exists task_columns_criar on public.task_columns;
drop policy if exists task_columns_editar on public.task_columns;
drop policy if exists task_columns_apagar on public.task_columns;
create policy task_columns_ver on public.task_columns as permissive for select to authenticated
  using (exists (select 1 from public.task_boards b where b.id = board_id and public.equipe_pode(b.producer_id, 'quadro', 'ver')));
create policy task_columns_criar on public.task_columns as permissive for insert to authenticated
  with check (exists (select 1 from public.task_boards b where b.id = board_id and public.equipe_pode(b.producer_id, 'quadro', 'editar')));
create policy task_columns_editar on public.task_columns as permissive for update to authenticated
  using (exists (select 1 from public.task_boards b where b.id = board_id and public.equipe_pode(b.producer_id, 'quadro', 'editar')))
  with check (exists (select 1 from public.task_boards b where b.id = board_id and public.equipe_pode(b.producer_id, 'quadro', 'editar')));
create policy task_columns_apagar on public.task_columns as permissive for delete to authenticated
  using (exists (select 1 from public.task_boards b where b.id = board_id and public.equipe_pode(b.producer_id, 'quadro', 'editar')));

drop policy if exists team_member_tools_dono on public.team_member_tools;
create policy team_member_tools_dono on public.team_member_tools as permissive for all to authenticated
  using (exists (select 1 from public.team_members m where m.id = member_id and m.producer_id = (select auth.uid())))
  with check (exists (select 1 from public.team_members m where m.id = member_id and m.producer_id = (select auth.uid())));

-- 2FA: mesma regra RESTRICTIVE das outras tabelas do produtor (idêntica ao baseline)
drop policy if exists gf_mfa_aal2 on public.producer_tasks;
create policy gf_mfa_aal2 on public.producer_tasks as restrictive for all to authenticated
  using ((select public.gf_mfa_ok())) with check ((select public.gf_mfa_ok()));
drop policy if exists gf_mfa_aal2 on public.task_boards;
create policy gf_mfa_aal2 on public.task_boards as restrictive for all to authenticated
  using ((select public.gf_mfa_ok())) with check ((select public.gf_mfa_ok()));
drop policy if exists gf_mfa_aal2 on public.task_columns;
create policy gf_mfa_aal2 on public.task_columns as restrictive for all to authenticated
  using ((select public.gf_mfa_ok())) with check ((select public.gf_mfa_ok()));
drop policy if exists gf_mfa_aal2 on public.team_member_tools;
create policy gf_mfa_aal2 on public.team_member_tools as restrictive for all to authenticated
  using ((select public.gf_mfa_ok())) with check ((select public.gf_mfa_ok()));

-- Permissões por coluna (padrão de 20261017). service_role não é mexido.
revoke all on table public.producer_tasks, public.task_boards, public.task_columns, public.team_member_tools from anon;
revoke all on table public.producer_tasks, public.task_boards, public.task_columns, public.team_member_tools from authenticated;
grant select, delete on table public.producer_tasks to authenticated;
grant insert (producer_id, event_id, assigned_to, title, description, due_date, status, priority, board_id, column_id, position)
  on table public.producer_tasks to authenticated;
grant update (assigned_to, title, description, due_date, status, priority, column_id, position)
  on table public.producer_tasks to authenticated;
grant select on table public.task_boards to authenticated;
grant select, delete on table public.task_columns to authenticated;
grant insert (board_id, name, kind, position) on table public.task_columns to authenticated;
grant update (name, kind, position) on table public.task_columns to authenticated;
grant select, delete on table public.team_member_tools to authenticated;
grant insert (member_id, ferramenta, nivel) on table public.team_member_tools to authenticated;
grant update (nivel) on table public.team_member_tools to authenticated;

-- 7. Backfill (idempotente: só toca tarefas sem quadro; o gatilho cria o quadro e escolhe a coluna pelo status) -------------
update public.producer_tasks t set position = r.pos
  from (select id, row_number() over (partition by producer_id, event_id order by created_at, id) * 1000 as pos
          from public.producer_tasks where board_id is null) r
  where t.id = r.id and t.board_id is null;

-- 8. Conferência que aborta (tudo ou nada) ---------------------------------------------------------------------------------------
do $$
declare
  v_tab text;
  v_esperado jsonb := jsonb_build_object(
    'producer_tasks', array['gf_mfa_aal2', 'tasks_apagar', 'tasks_criar', 'tasks_editar', 'tasks_ver'],
    'task_boards', array['gf_mfa_aal2', 'task_boards_ver'],
    'task_columns', array['gf_mfa_aal2', 'task_columns_apagar', 'task_columns_criar', 'task_columns_editar', 'task_columns_ver'],
    'team_member_tools', array['gf_mfa_aal2', 'team_member_tools_dono']);
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
  if exists (select 1 from public.producer_tasks where column_id is null or board_id is null) then
    raise exception 'sobrou tarefa sem quadro ou coluna';
  end if;
  if (select count(*) from public.producer_tasks) <> (select n from _f01_antes) then
    raise exception 'a contagem de tarefas mudou (antes %, depois %)', (select n from _f01_antes), (select count(*) from public.producer_tasks);
  end if;
  if exists (select 1 from public.producer_tasks t join public.task_columns c on c.id = t.column_id
             where t.status is distinct from case c.kind when 'doing' then 'in_progress' else c.kind end) then
    raise exception 'status diferente do tipo da coluna';
  end if;
end $$;

commit;

-- Conferência (só leitura). Esperado: regras das 4 tabelas, 0 tarefas sem coluna, mesmo total de tarefas.
select 'regra' as item, tablename::text as nome, policyname::text as valor, permissive::text as extra
from pg_policies where schemaname = 'public' and tablename in ('producer_tasks', 'task_boards', 'task_columns', 'team_member_tools')
union all
select 'tarefas', 'total', count(*)::text, null from public.producer_tasks
union all
select 'tarefas', 'sem coluna', count(*)::text, null from public.producer_tasks where column_id is null
union all
select 'quadros', 'total', count(*)::text, null from public.task_boards
order by 1, 2, 3;

-- =============================================================================
-- ENSAIO COM ROLLBACK: trocar o "commit;" do fim do bloco 8 por "rollback;" e rodar tudo; as conferências que abortam
-- já rodaram dentro da transação, e nada fica gravado. Comportamento: supabase/tests/equipe_quadro_f01.test.sql (banco local).
-- =============================================================================
