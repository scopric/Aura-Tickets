-- =============================================================================
-- VF-a, SQL dos Favoritos (redesenho v3.4; Decisão 143, que substitui a 21). 03/10/2026.
-- Tabela public.favoritos (user_id, event_id, criado_em): cada pessoa guarda os eventos publicados que quer
-- ver depois ("coração" no Explorar, "Salvar" na página do evento, tela "Salvos").
-- Arquivo independente: não depende do 20261007_capa_e_cor_do_evento.sql.
--
-- Como aplicar: colar o arquivo inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA pelo TextEdit: erro 17).
-- APLICAR FORA DO HORÁRIO DE PICO: a chave estrangeira para events pede bloqueio curto em events; o
-- `set local lock_timeout = '5s'` do início faz o arquivo desistir sem gravar nada, em vez de travar o
-- site, se algo estiver segurando events ou auth.users. Se desistir, rodar de novo.
-- Uma transação só: se a conferência do fim falhar, nada é gravado. Idempotente (pode rodar de novo).
-- NÃO mover para supabase/migrations/ (motivo no cabeçalho de 20260927_security_hardening.sql).
-- Teste: supabase/tests/favoritos.test.sql (pgTAP; banco local, nunca em produção).
-- Ordem: este SQL antes do front da VF. LGPD: a Política (Privacy.tsx) e o RIPD passam a descrever esta tabela no
-- mesmo PR do front (finalidade, prazo e exclusão); favorito é dado pessoal ligado à conta.
--
-- DECISÕES
-- 1. Chaves: user_id -> auth.users e event_id -> events, as duas ON DELETE CASCADE (pedido do plano).
--    ATENÇÃO, contradiz o plano: a delete-account NÃO apaga auth.users, ela faz soft delete
--    (admin.auth.admin.deleteUser(uid, true)); a linha de auth.users continua e a cascata NÃO dispara.
--    Para a exclusão de conta apagar os favoritos, 'favoritos' tem de entrar na lista de tabelas só pessoais
--    da delete-account (o mesmo .delete().eq('user_id', uid) de interest_lists), no PR do front da VF e só
--    depois deste SQL aplicado (sem a tabela, o passo daria erro 500 em toda exclusão). Fora do escopo deste
--    arquivo. A cascata por event_id vale (evento apagado leva os favoritos).
-- 2. RLS ligada. SELECT, INSERT e DELETE só da própria linha: (select auth.uid()) = user_id. Sem regra de
--    UPDATE (um favorito existe ou não) e sem leitura do produtor ou do admin: quem favoritou o quê não é
--    mostrado a ninguém além da própria pessoa. Contagem pública de favoritos não existe nesta fase.
-- 3. INSERT só de evento publicado e aprovado: o mesmo critério da regra "Eventos públicos ou do produtor"
--    de events (status = 'published' e approval_status = 'approved'). O exists lê events com a RLS de quem
--    insere; como o critério é o da leitura pública, enxerga o evento. Nenhuma regra de events consulta
--    favoritos: sem ciclo (erro 16.3). Evento que sai do ar depois mantém o favorito (a pessoa pode apagar);
--    a tela Salvos filtra o que não está publicado (leitura de events já faz isso por RLS).
-- 4. GRANTs mínimos: nada para anon; authenticated só SELECT, DELETE e INSERT (user_id, event_id), sem
--    criado_em (sempre now() do banco). Sem UPDATE nem TRUNCATE. service_role segue com tudo (padrão do
--    Supabase; é o papel das Edge Functions). O front usa insert (23505 = já era favorito) ou
--    upsert com ignoreDuplicates: true (ON CONFLICT DO NOTHING não precisa de UPDATE).
-- 5. Índices: a chave primária (user_id, event_id) já atende "meus favoritos" e a cascata por usuário. Para a
--    cascata por evento (apagar um evento procura os favoritos dele) falta índice em event_id: criado.
-- 6. A regra RESTRICTIVE gf_mfa_aal2 (2FA) é criada sozinha pelo gatilho rls_auto_enable na criação da tabela;
--    é recriada aqui do mesmo jeito para não depender dele (por exemplo, se a tabela já existisse).
-- 7. Sem limite de favoritos por pessoa: o teto é o número de eventos publicados (a chave primária impede
--    repetição) e cada linha é pequena.
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 0. Pré-requisitos
do $$
begin
  if to_regclass('public.events') is null then raise exception 'public.events não existe'; end if;
  if to_regproc('public.gf_mfa_ok') is null then
    raise exception 'Falta public.gf_mfa_ok (20260930_2fa_no_banco.sql): aplicar antes';
  end if;
end $$;

-- 1. Tabela ---------------------------------------------------------------------------------------------------------
create table if not exists public.favoritos (
  user_id   uuid not null references auth.users (id) on delete cascade,
  event_id  uuid not null references public.events (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (user_id, event_id)
);
create index if not exists favoritos_event_id_idx on public.favoritos (event_id);

-- 2. RLS ------------------------------------------------------------------------------------------------------------
alter table public.favoritos enable row level security;

drop policy if exists favoritos_select on public.favoritos;
create policy favoritos_select on public.favoritos
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists favoritos_insert on public.favoritos;
create policy favoritos_insert on public.favoritos
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.events e
      where e.id = favoritos.event_id
        and e.status = 'published' and e.approval_status = 'approved')
  );

drop policy if exists favoritos_delete on public.favoritos;
create policy favoritos_delete on public.favoritos
  for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists gf_mfa_aal2 on public.favoritos;
create policy gf_mfa_aal2 on public.favoritos as restrictive for all to authenticated
  using ((select public.gf_mfa_ok())) with check ((select public.gf_mfa_ok()));

-- 3. Privilégios ----------------------------------------------------------------------------------------------------
revoke all on public.favoritos from public, anon, authenticated;
grant select, delete on public.favoritos to authenticated;
grant insert (user_id, event_id) on public.favoritos to authenticated;

-- 4. Conferência que aborta (tudo ou nada) ---------------------------------------------------------------------------
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.favoritos'::regclass) then
    raise exception 'favoritos sem RLS';
  end if;
  if (select array_agg(policyname::text order by policyname::text) from pg_policies
      where schemaname = 'public' and tablename = 'favoritos')
     is distinct from array['favoritos_delete', 'favoritos_insert', 'favoritos_select', 'gf_mfa_aal2'] then
    raise exception 'regras de favoritos fora do esperado';
  end if;
  if has_table_privilege('anon', 'public.favoritos', 'select,insert,update,delete,truncate,references,trigger')
     or has_any_column_privilege('anon', 'public.favoritos', 'select,insert,update,references') then
    raise exception 'anon tem privilégio em favoritos';
  end if;
  if has_table_privilege('authenticated', 'public.favoritos', 'insert,update,truncate,references,trigger')
     or has_any_column_privilege('authenticated', 'public.favoritos', 'update,references')
     or has_column_privilege('authenticated', 'public.favoritos', 'criado_em', 'insert')
     or not has_table_privilege('authenticated', 'public.favoritos', 'select,delete')
     or not has_column_privilege('authenticated', 'public.favoritos', 'user_id', 'insert')
     or not has_column_privilege('authenticated', 'public.favoritos', 'event_id', 'insert') then
    raise exception 'privilégios de authenticated em favoritos fora do esperado';
  end if;
end $$;

commit;

-- Conferência (só leitura). Esperado: 4 regras (favoritos_delete DELETE, favoritos_insert INSERT, favoritos_select
-- SELECT, gf_mfa_aal2 ALL restritiva), os dois índices (favoritos_pkey e favoritos_event_id_idx), as duas chaves
-- com ação de exclusão 'c' (cascade) e privilégios de authenticated só em select, delete e insert (user_id, event_id).
select 'regra' as item, policyname::text as nome, cmd::text as valor, permissive::text as extra
from pg_policies where schemaname = 'public' and tablename = 'favoritos'
union all
select 'índice', indexname::text, null, null from pg_indexes where schemaname = 'public' and tablename = 'favoritos'
union all
select 'chave', conname::text, confdeltype::text, confrelid::regclass::text
from pg_constraint where conrelid = 'public.favoritos'::regclass and contype = 'f'
union all
select 'privilégio', grantee::text, privilege_type::text, null
from information_schema.role_table_grants where table_schema = 'public' and table_name = 'favoritos'
  and grantee in ('anon', 'authenticated', 'public')
union all
select 'privilégio de coluna', grantee::text, privilege_type::text, column_name::text
from information_schema.column_privileges where table_schema = 'public' and table_name = 'favoritos'
  and grantee in ('anon', 'authenticated', 'public') and privilege_type = 'INSERT'
order by 1, 2, 3;

-- =============================================================================
-- ENSAIO COM ROLLBACK: trocar o "commit;" do fim do bloco 4 por "rollback;" e rodar tudo; as conferências que
-- abortam já rodaram dentro da transação, e nada fica gravado. Comportamento (A não vê nem apaga favorito de B,
-- evento não publicado, cascata): supabase/tests/favoritos.test.sql, em banco local.
-- =============================================================================
