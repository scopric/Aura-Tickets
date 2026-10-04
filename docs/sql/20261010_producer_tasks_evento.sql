-- =============================================================================
-- E2, SQL das Tarefas do produtor (ligação com o evento). 10/10/2026.
-- Tabela public.producer_tasks: a tela Tarefas passa a gravar event_id (o front da E2 só usa colunas que já existem).
-- Dois ajustes de banco, sem mudar colunas:
--   (a) producer_tasks_event_id_fkey passa a ON DELETE SET NULL. Hoje a chave não tem ação de exclusão
--       (baseline.sql:2702): uma tarefa ligada ao evento impede o produtor de excluir o evento.
--   (b) a regra "Produtor gerencia tasks" (baseline.sql:3348-3350) ganha WITH CHECK que só aceita event_id nulo
--       ou de evento do próprio produtor. Hoje o check é só producer_id = auth.uid(): dava para gravar uma tarefa
--       apontando para evento de outro produtor (a chave só confere que o evento existe). USING não muda.
--
-- Como aplicar: colar o arquivo inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA pelo TextEdit: erro 17).
-- APLICAR FORA DO HORÁRIO DE PICO: recriar a chave pede bloqueio curto em producer_tasks e events; o
-- `set local lock_timeout = '5s'` do início faz o arquivo desistir sem gravar nada, em vez de travar o site, se
-- algo estiver segurando as tabelas. Se desistir, rodar de novo.
-- Uma transação só: se a conferência do fim falhar, nada é gravado. Idempotente (pode rodar de novo).
-- NÃO mover para supabase/migrations/ (motivo no cabeçalho de 20260927_security_hardening.sql).
-- Teste: supabase/tests/producer_tasks_evento.test.sql (pgTAP; banco local, nunca em produção).
-- Ordem: independe do front da E2 (o front funciona sem este SQL; sem ele, tarefa ligada ainda trava a exclusão
-- do evento e o check de dono do evento não existe).
--
-- DECISÕES
-- 1. SET NULL e não CASCADE: apagar o evento não apaga o trabalho do produtor; a tarefa vira "sem evento" e
--    continua em Todos os eventos. Quem apaga eventos de teste em lote (20260928_apagar_eventos_teste.sql) já
--    apaga as tarefas antes.
-- 2. O exists lê events com a RLS de quem grava; o dono enxerga os próprios eventos, então basta.
--    Nenhuma regra de events consulta producer_tasks: sem ciclo (erro 16.3).
-- 3. A regra RESTRICTIVE gf_mfa_aal2 (2FA) já existe na tabela; é recriada aqui do mesmo jeito (idêntica ao
--    baseline) para o arquivo não depender de como a tabela nasceu. Não some nem muda.
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 0. Pré-requisitos
do $$
begin
  if to_regclass('public.producer_tasks') is null then raise exception 'public.producer_tasks não existe'; end if;
  if to_regclass('public.events') is null then raise exception 'public.events não existe'; end if;
  if to_regproc('public.gf_mfa_ok') is null then
    raise exception 'Falta public.gf_mfa_ok (20260930_2fa_no_banco.sql): aplicar antes';
  end if;
end $$;

-- 1. Chave do evento com ON DELETE SET NULL --------------------------------------------------------------------------
alter table public.producer_tasks drop constraint if exists producer_tasks_event_id_fkey;
alter table public.producer_tasks add constraint producer_tasks_event_id_fkey
  foreign key (event_id) references public.events (id) on delete set null;

-- 2. Regras (mesmo nome e mesmo papel do baseline; só o WITH CHECK ganha a conferência do evento) -------------------
alter table public.producer_tasks enable row level security;

drop policy if exists "Produtor gerencia tasks" on public.producer_tasks;
create policy "Produtor gerencia tasks" on public.producer_tasks as permissive for all to authenticated
  using (producer_id = auth.uid())
  with check (
    producer_id = auth.uid()
    and (event_id is null or exists (
      select 1 from public.events e where e.id = producer_tasks.event_id and e.producer_id = auth.uid()))
  );

drop policy if exists gf_mfa_aal2 on public.producer_tasks;
create policy gf_mfa_aal2 on public.producer_tasks as restrictive for all to authenticated
  using ((select public.gf_mfa_ok())) with check ((select public.gf_mfa_ok()));

-- 3. Conferência que aborta (tudo ou nada) ---------------------------------------------------------------------------
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.producer_tasks'::regclass) then
    raise exception 'producer_tasks sem RLS';
  end if;
  if (select array_agg(policyname::text order by policyname::text) from pg_policies
      where schemaname = 'public' and tablename = 'producer_tasks')
     is distinct from array['Produtor gerencia tasks', 'gf_mfa_aal2'] then
    raise exception 'regras de producer_tasks fora do esperado';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producer_tasks'
      and policyname = 'gf_mfa_aal2' and permissive = 'RESTRICTIVE' and cmd = 'ALL') then
    raise exception 'gf_mfa_aal2 sumiu ou deixou de ser restritiva em producer_tasks';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producer_tasks'
      and policyname = 'Produtor gerencia tasks' and permissive = 'PERMISSIVE' and cmd = 'ALL'
      and roles = array['authenticated']::name[]
      and qual = '(producer_id = auth.uid())' and with_check like '%events%') then
    raise exception 'Produtor gerencia tasks fora do esperado';
  end if;
  if (select confdeltype from pg_constraint where conname = 'producer_tasks_event_id_fkey'
      and conrelid = 'public.producer_tasks'::regclass) is distinct from 'n' then
    raise exception 'producer_tasks_event_id_fkey não é ON DELETE SET NULL';
  end if;
end $$;

commit;

-- Conferência (só leitura). Esperado: 2 regras (Produtor gerencia tasks ALL permissiva, com "events" no with_check;
-- gf_mfa_aal2 ALL restritiva) e a chave producer_tasks_event_id_fkey com ação de exclusão 'n' (set null).
select 'regra' as item, policyname::text as nome, cmd::text as valor, permissive::text as extra, with_check::text as check
from pg_policies where schemaname = 'public' and tablename = 'producer_tasks'
union all
select 'chave', conname::text, confdeltype::text, confrelid::regclass::text, null
from pg_constraint where conrelid = 'public.producer_tasks'::regclass and contype = 'f'
order by 1, 2;

-- =============================================================================
-- ENSAIO COM ROLLBACK: trocar o "commit;" do fim do bloco 3 por "rollback;" e rodar tudo; as conferências que
-- abortam já rodaram dentro da transação, e nada fica gravado. Comportamento (event_id de outro produtor dá erro
-- de RLS; apagar o evento deixa a tarefa sem evento): supabase/tests/producer_tasks_evento.test.sql, em banco local.
-- =============================================================================
