-- =============================================================================
-- P4 da fila de auditorias (participante + produtor 14): "Avise-me quando abrir" e Lista de interesse de verdade. 04/10/2026.
-- Hoje public.interest_lists tem só a regra RESTRICTIVE gf_mfa_aal2 (ninguém lê nem grava pela API) e `anon` tem todos os
-- privilégios de tabela do baseline; a tela do produtor lê crm_leads, não esta tabela. Este arquivo:
--   (a) deixa o participante inscrever-se (com consentimento), ver e apagar a PRÓPRIA inscrição, e mais nada;
--   (b) dá ao produtor a lista do SEU evento por função (nome, e-mail e cidade só de quem consentiu) e a remoção
--       da inscrição (sem apagar o lead do CRM);
--   (c) pg_cron "interesse_avisar" (a cada minuto): quando uma venda do evento abre, grava o aviso no sino (P1),
--       marca `notified` e deixa o e-mail na fila;
--   (d) pg_cron "interesse_email" (a cada 2 min): chama a Edge Function send-email (tipo "interesse_aviso"), no padrão
--       do chat-notify: segredo no Vault, fila reservada por 2 min, destino sai do banco;
--   (e) gatilho: a inscrição com consentimento vira lead no CRM do produtor (source 'lista_interesse'), sem duplicar
--       por e-mail.
--
-- Como aplicar: colar o arquivo inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA pelo TextEdit: erro 17).
-- Uma transação só: se a conferência do fim falhar, nada é gravado. Idempotente (pode rodar de novo).
-- NÃO mover para supabase/migrations/ (motivo no cabeçalho de 20260927_security_hardening.sql).
-- Teste: supabase/tests/interesse.test.sql (pgTAP; banco descartável, nunca em produção).
-- Ordem: depende de 20261013_notificacoes.sql (P1), 20260930_2fa_no_banco.sql e 20261005_produtor_acesso.sql (já em
-- produção) e de pg_cron, pg_net e Vault (já usados pelo chat). A Edge Function send-email com o tipo novo
-- precisa estar publicada (com --no-verify-jwt, como o chat-notify): até lá o cron do e-mail recebe erro, o aviso
-- do sino sai igual e o e-mail espera na fila (até 2 dias; depois disso a linha deixa de entrar na fila).
--
-- DECISÕES
-- 1. Consentimento: consentimento_em é gravado pelo BANCO (default now(), fora do grant de INSERT: a pessoa não
--    forja a data) e consentimento_versao é obrigatório na inscrição (a regra de INSERT exige). Linhas antigas ficam
--    com consentimento_em nulo: o produtor as vê só como contagem, sem nome nem e-mail, e elas não recebem aviso.
-- 2. Quem escreve: o dono insere (user_id = auth.uid(), só em evento publicado e aprovado, tipo de ingresso do
--    próprio evento), lê e apaga. UPDATE não existe para a API: notified e as colunas do e-mail só mudam pelo cron e
--    pelas funções de serviço. `anon` perde tudo. service_role mantém o que o baseline dá.
-- 3. Produtor: função interesse_lista (SECURITY DEFINER, search_path vazio, gf_mfa_ok() exigido, dono do evento
--    conferido no corpo). Não há regra de SELECT para o produtor na tabela: ler nome e e-mail exige juntar com
--    profiles, que a RLS dele esconde. O e-mail vem de profiles.email (o produtor só vê o de quem consentiu).
-- 4. E-mail do aviso: sai para auth.users.email (e-mail do login), nunca para texto vindo do cliente. Reserva de
--    2 min em interesse_email_due contra envio duplicado; 5 falhas tiram a linha da fila; sucesso grava
--    email_enviado_em. O aviso do sino não depende do e-mail.
-- 5. "Venda abriu": existe ticket_type ativo do evento (o escolhido, ou qualquer um quando a inscrição é do evento)
--    com sale_start nulo ou já passado e sale_end nulo ou futuro. Se o produtor tirar a data de início de venda,
--    o aviso sai na rodada seguinte (a venda está de fato aberta).
-- 6. CRM: o lead nasce sem etapa (a tela do CRM já mostra "Sem etapa") e só se não houver lead do mesmo produtor com
--    o mesmo e-mail (sem diferença de caixa). Apagar a inscrição NÃO apaga o lead (o produtor já pode ter trabalhado
--    nele); apagar o lead NÃO apaga a inscrição.
-- 7. Fica de fora: lista de espera para ingresso esgotado (M5); preferência de e-mail por conta (decisão 5 da fila);
--    contador de demanda aberto ao público (o produtor vê o total na própria lista).
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 0. Pré-requisitos
do $$
begin
  if to_regclass('public.interest_lists') is null then raise exception 'public.interest_lists não existe'; end if;
  if to_regclass('public.notifications') is null then raise exception 'public.notifications não existe'; end if;
  if to_regproc('public.gf_notificar_evento') is null then
    raise exception 'Falta a P1 (20261013_notificacoes.sql): aplicar antes';
  end if;
  if to_regproc('public.gf_mfa_ok') is null then raise exception 'Falta public.gf_mfa_ok (20260930_2fa_no_banco.sql)'; end if;
  if to_regclass('public.crm_leads') is null then raise exception 'public.crm_leads não existe'; end if;
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then raise exception 'pg_cron desligado'; end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then raise exception 'pg_net desligado'; end if;
end $$;

-- 1. Colunas ---------------------------------------------------------------------------------------------------------
alter table public.interest_lists add column if not exists consentimento_em timestamptz;
alter table public.interest_lists alter column consentimento_em set default now(); -- vale só para linhas novas
alter table public.interest_lists add column if not exists consentimento_versao text;
alter table public.interest_lists add column if not exists notified_at timestamptz;
alter table public.interest_lists add column if not exists email_enviado_em timestamptz;
alter table public.interest_lists add column if not exists email_falhas int not null default 0;
alter table public.interest_lists add column if not exists email_reservado_ate timestamptz;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'interest_lists_versao_chk') then
    alter table public.interest_lists add constraint interest_lists_versao_chk
      check (consentimento_versao is null or char_length(consentimento_versao) between 1 and 40);
  end if;
end $$;
create index if not exists interest_lists_event_idx on public.interest_lists (event_id);
create index if not exists interest_lists_user_idx on public.interest_lists (user_id);
create index if not exists interest_lists_pendentes_idx on public.interest_lists (created_at) where not notified;

-- 2. Privilégios e regras (RLS): só o dono. gf_mfa_aal2 (RESTRICTIVE, 2FA) fica intacta --------------------------------
revoke all on table public.interest_lists from anon, authenticated;
grant select, delete on table public.interest_lists to authenticated;
grant insert (user_id, event_id, ticket_type_id, consentimento_versao) on table public.interest_lists to authenticated;
alter table public.interest_lists enable row level security;

drop policy if exists gf_interesse_select_dono on public.interest_lists;
create policy gf_interesse_select_dono on public.interest_lists
  as permissive for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists gf_interesse_insert_dono on public.interest_lists;
create policy gf_interesse_insert_dono on public.interest_lists
  as permissive for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and consentimento_versao is not null
    and exists (select 1 from public.events e
                where e.id = interest_lists.event_id and e.status = 'published' and e.approval_status = 'approved')
    and (ticket_type_id is null
         or exists (select 1 from public.ticket_types t
                    where t.id = interest_lists.ticket_type_id and t.event_id = interest_lists.event_id))
  );

drop policy if exists gf_interesse_delete_dono on public.interest_lists;
create policy gf_interesse_delete_dono on public.interest_lists
  as permissive for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 3. Produtor: lista do próprio evento e remoção da inscrição ----------------------------------------------------------
create or replace function public.interesse_lista(p_event_id uuid default null)
returns table (
  id uuid, event_id uuid, event_title text, full_name text, email text, city text,
  notified boolean, notified_at timestamptz, consentiu boolean, created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.event_id, e.title::text,
         case when i.consentimento_em is not null then p.full_name end,
         case when i.consentimento_em is not null then p.email end,
         case when i.consentimento_em is not null then p.city end,
         i.notified, i.notified_at, i.consentimento_em is not null, i.created_at
  from public.interest_lists i
  join public.events e on e.id = i.event_id
  left join public.profiles p on p.id = i.user_id
  where e.producer_id = (select auth.uid())
    and (select public.gf_mfa_ok())
    and (p_event_id is null or i.event_id = p_event_id)
  order by i.created_at desc
  limit 5000;
$$;

create or replace function public.interesse_remover(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare n int;
begin
  if (select auth.uid()) is null or not (select public.gf_mfa_ok()) then return false; end if;
  delete from public.interest_lists i
  using public.events e
  where i.id = p_id and e.id = i.event_id and e.producer_id = (select auth.uid());
  get diagnostics n = row_count;
  return n = 1;
end;
$$;

-- 4. Gatilho: inscrição com consentimento vira lead no CRM do produtor ------------------------------------------------
create or replace function public.gf_interesse_para_crm()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.consentimento_em is null then return null; end if;
  insert into public.crm_leads (producer_id, full_name, email, city, source, event_interest)
  select e.producer_id, left(coalesce(nullif(btrim(p.full_name), ''), 'Participante'), 200), u.email::text, p.city,
         'lista_interesse', left(e.title, 200)
  from public.events e
  join public.profiles p on p.id = new.user_id
  join auth.users u on u.id = new.user_id
  where e.id = new.event_id and u.email is not null
    and not exists (select 1 from public.crm_leads l
                    where l.producer_id = e.producer_id and lower(l.email) = lower(u.email));
  return null;
end;
$$;
drop trigger if exists gf_interesse_para_crm on public.interest_lists;
create trigger gf_interesse_para_crm
  after insert on public.interest_lists
  for each row execute function public.gf_interesse_para_crm();

-- 5. Cron 1: venda abriu -> aviso no sino (P1) e marca notified ----------------------------------------------------------
create or replace function public.gf_interesse_avisar()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare n int;
begin
  with devidos as (
    select i.id, i.user_id, i.event_id, left(e.title, 120) as titulo
    from public.interest_lists i
    join public.events e on e.id = i.event_id
    where not i.notified and i.consentimento_em is not null
      and e.status = 'published' and e.approval_status = 'approved'
      and exists (select 1 from public.ticket_types t
                  where t.event_id = e.id and t.is_active
                    and (i.ticket_type_id is null or t.id = i.ticket_type_id)
                    and (t.sale_start is null or t.sale_start <= now())
                    and (t.sale_end is null or t.sale_end > now()))
    order by i.created_at
    limit 500
    for update of i skip locked
  ), marcados as (
    update public.interest_lists i
       set notified = true, notified_at = now()
      from devidos d
     where i.id = d.id
    returning d.user_id, d.event_id, d.titulo
  ), avisos as (
    insert into public.notifications (user_id, title, body, type, metadata)
    select p.id, 'As vendas abriram',
           '"' || m.titulo || '" abriu as vendas. Garanta seu ingresso.',
           'sale',
           jsonb_build_object('origem', 'interesse', 'event_id', m.event_id, 'url', '/event/' || m.event_id)
    from marcados m
    join public.profiles p on p.id = m.user_id
    returning 1
  )
  select count(*) into n from marcados;
  return n;
end;
$$;

-- 6. Cron 2: e-mail (Edge Function send-email, tipo interesse_aviso). Só service_role ------------------------------------
create or replace function public.interesse_notify_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select d.decrypted_secret from vault.decrypted_secrets d where d.name = 'interesse_notify_secret' limit 1;
$$;

-- Fila (até 50): avisados nas últimas 48 h, sem e-mail enviado, com menos de 5 falhas, fora da reserva. Reserva 2 min.
create or replace function public.interesse_email_due()
returns table (id uuid, email text, nome text, evento text, event_id uuid)
language sql
volatile
security definer
set search_path = ''
as $$
  with fila as (
    select i.id
    from public.interest_lists i
    join auth.users u on u.id = i.user_id
    where i.notified and i.email_enviado_em is null and i.email_falhas < 5
      and i.notified_at > now() - interval '48 hours'
      and (i.email_reservado_ate is null or i.email_reservado_ate < now())
      and u.email is not null and u.deleted_at is null
    order by i.notified_at
    limit 50
    for update of i skip locked
  ), reservados as (
    update public.interest_lists i
       set email_reservado_ate = now() + interval '2 minutes'
      from fila f
     where i.id = f.id
    returning i.id, i.user_id, i.event_id
  )
  select r.id, u.email::text, coalesce(nullif(btrim(p.full_name), ''), 'Olá')::text, left(e.title, 120)::text, r.event_id
  from reservados r
  join auth.users u on u.id = r.user_id
  join public.events e on e.id = r.event_id
  left join public.profiles p on p.id = r.user_id;
$$;

create or replace function public.interesse_email_mark(p_ids uuid[], p_ok boolean)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare n int;
begin
  update public.interest_lists
     set email_enviado_em = case when p_ok then now() end,
         email_falhas = case when p_ok then email_falhas else email_falhas + 1 end,
         email_reservado_ate = null
   where id = any (p_ids);
  get diagnostics n = row_count;
  return n;
end;
$$;

-- 7. Quem executa o quê (o Supabase dá EXECUTE a anon/authenticated por padrão) ----------------------------------------
revoke all on function public.interesse_lista(uuid), public.interesse_remover(uuid) from public, anon, authenticated, service_role;
grant execute on function public.interesse_lista(uuid), public.interesse_remover(uuid) to authenticated;
revoke all on function public.gf_interesse_para_crm(), public.gf_interesse_avisar() from public, anon, authenticated, service_role;
revoke all on function public.interesse_notify_secret(), public.interesse_email_due(), public.interesse_email_mark(uuid[], boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.interesse_notify_secret(), public.interesse_email_due(), public.interesse_email_mark(uuid[], boolean)
  to service_role;

-- 8. Vault + cron. Segredo aleatório criado uma vez; o comando do cron o lê do Vault na hora de rodar -----------------------
do $$
begin
  if not exists (select 1 from vault.secrets s where s.name = 'interesse_notify_secret') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'interesse_notify_secret', 'Segredo do cron para o tipo interesse_aviso da Edge Function send-email');
  end if;
end $$;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
select cron.unschedule('interesse_avisar') where exists (select 1 from cron.job where jobname = 'interesse_avisar');
select cron.schedule('interesse_avisar', '* * * * *', $cron$ select public.gf_interesse_avisar(); $cron$);
select cron.unschedule('interesse_email') where exists (select 1 from cron.job where jobname = 'interesse_email');
select cron.schedule('interesse_email', '*/2 * * * *', $cron$
  select net.http_post(
    url := 'https://rwaezeqyuhxrssntcxdv.supabase.co/functions/v1/send-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-interesse-secret', (select d.decrypted_secret from vault.decrypted_secrets d where d.name = 'interesse_notify_secret')
    ),
    body := '{"tipo":"interesse_aviso"}'::jsonb,
    timeout_milliseconds := 20000
  );
$cron$);

-- 9. Conferência: qualquer divergência aborta e nada é gravado ---------------------------------------------------------
do $$
declare
  v_pol text;
begin
  select string_agg(policyname, ',' order by policyname) into v_pol
  from pg_policies where schemaname = 'public' and tablename = 'interest_lists' and permissive = 'PERMISSIVE';
  if v_pol is distinct from 'gf_interesse_delete_dono,gf_interesse_insert_dono,gf_interesse_select_dono' then
    raise exception 'interest_lists: regras permissivas inesperadas (%)', v_pol;
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'interest_lists'
                 and policyname = 'gf_mfa_aal2' and permissive = 'RESTRICTIVE') then
    raise exception 'interest_lists: faltou a regra gf_mfa_aal2';
  end if;
  if has_table_privilege('anon', 'public.interest_lists', 'select, insert, update, delete, truncate') then
    raise exception 'interest_lists: anon ainda tem privilégio';
  end if;
  if has_table_privilege('authenticated', 'public.interest_lists', 'update')
     or has_table_privilege('authenticated', 'public.interest_lists', 'truncate')
     or has_column_privilege('authenticated', 'public.interest_lists', 'consentimento_em', 'insert')
     or has_column_privilege('authenticated', 'public.interest_lists', 'notified', 'insert')
     or not has_column_privilege('authenticated', 'public.interest_lists', 'consentimento_versao', 'insert') then
    raise exception 'interest_lists: privilégio de authenticated fora do desenhado';
  end if;
  if (select count(*) from cron.job where jobname in ('interesse_avisar', 'interesse_email')) <> 2 then
    raise exception 'cron: faltou um dos jobs do interesse';
  end if;
  if exists (select 1 from cron.job where jobname = 'interesse_email'
             and command like '%' || (select decrypted_secret from vault.decrypted_secrets where name = 'interesse_notify_secret') || '%') then
    raise exception 'cron: segredo escrito no comando';
  end if;
  if has_function_privilege('authenticated', 'public.interesse_email_due()', 'execute')
     or has_function_privilege('anon', 'public.interesse_lista(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.gf_interesse_avisar()', 'execute') then
    raise exception 'funções do interesse com EXECUTE a quem não deve';
  end if;
end $$;

commit;
