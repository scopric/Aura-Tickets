-- =============================================================================
-- Check-in (b), fatia 1: desfazer entrada feita por engano. 27/10/2026.
-- Hoje um check-in errado deixa o ingresso 'used' para sempre e a pessoa não entra.
-- 1) public.check_in_desfeitos: histórico de cada entrada desfeita (entrada original, quem desfez, quando, motivo de
--    3 a 200 caracteres). RLS ligada, sem política de escrita: só checkin_desfazer grava. Leitura: só o produtor dono do evento.
-- 2) public.checkin_desfazer(p_ticket_id, p_motivo): ingresso 'used' volta a 'active' (checked_in_at e checked_in_by
--    zerados) e a entrada original fica em check_in_desfeitos, na mesma transação. A(s) linha(s) de check_ins do ingresso são
--    APAGADAS (o admin conta "entrou" por check_ins; o histórico fica em check_in_desfeitos).
--    Quem pode: dono do evento (gf_mfa_ok(): como no resto da plataforma, dono SEM 2FA cadastrado passa; com 2FA cadastrado
--    precisa do código nesta sessão), equipe aceita, sem bloqueio, cargo admin/editor, que EXIGE 2FA verificado e aal2
--    (gf_portaria_ok), e admin da plataforma só com gf_admin_can('manage_tickets').
--    Só em evento publicado e não encerrado (fim = events.end_date; sem ela, start_date + 1 dia) e no máximo 2 desfazimentos
--    por ingresso. Ingresso inexistente, de outro evento, sem permissão, não usado, evento encerrado ou teto atingido:
--    a MESMA mensagem (P0001), sem oráculo.
--    Corrida: o ingresso é travado (for update) e o update só vale com status = 'used'.
-- Como aplicar: ensaiar com ROLLBACK, depois colar inteiro no SQL Editor (UTF-8 via pbcopy, nunca TextEdit).
-- Uma transação, idempotente. Aplicar ANTES de mesclar o front (o botão chama a função).
-- Depende de 20261028_equipe_portaria.sql (gf_portaria_ok). Testes: supabase/tests/checkin_desfazer.test.sql.
-- NÃO mover para supabase/migrations/.
-- Desfazer:
--   drop function if exists public.checkin_desfazer(uuid, text);
--   drop table if exists public.check_in_desfeitos;   -- perde o histórico dos desfeitos (as linhas de check_ins apagadas não voltam)
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 0. Conferência ------------------------------------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.gf_portaria_ok(uuid)') is null then
    raise exception 'falta public.gf_portaria_ok(uuid) (aplicar antes 20261028_equipe_portaria.sql)';
  end if;
  if to_regprocedure('public.gf_admin_can(text)') is null or to_regprocedure('public.gf_mfa_ok()') is null then
    raise exception 'falta public.gf_admin_can(text) ou public.gf_mfa_ok()';
  end if;
  if to_regclass('public.check_ins') is null or to_regclass('public.tickets') is null then
    raise exception 'falta public.check_ins ou public.tickets';
  end if;
end $$;

-- 1. Histórico dos desfeitos
create table if not exists public.check_in_desfeitos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id),
  ticket_id uuid not null references public.tickets (id),
  checked_in_at timestamptz,
  checked_in_by uuid,
  desfeito_por uuid not null,
  desfeito_em timestamptz not null default now(),
  motivo text not null check (char_length(motivo) between 3 and 200)
);
create index if not exists check_in_desfeitos_event_idx on public.check_in_desfeitos (event_id, desfeito_em desc);
create index if not exists check_in_desfeitos_ticket_idx on public.check_in_desfeitos (ticket_id);
alter table public.check_in_desfeitos enable row level security;
revoke all on public.check_in_desfeitos from public, anon, authenticated;
grant select on public.check_in_desfeitos to authenticated;
-- 2FA no banco (padrão de 20260930_2fa_no_banco.sql)
drop policy if exists gf_mfa_aal2 on public.check_in_desfeitos;
create policy gf_mfa_aal2 on public.check_in_desfeitos as restrictive for all to authenticated
  using ((select public.gf_mfa_ok())) with check ((select public.gf_mfa_ok()));
drop policy if exists check_in_desfeitos_dono_select on public.check_in_desfeitos;
create policy check_in_desfeitos_dono_select on public.check_in_desfeitos for select to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.producer_id = (select auth.uid()))
         or public.gf_admin_can('manage_tickets'));

-- 2. Desfazer a entrada
create or replace function public.checkin_desfazer(p_ticket_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_event uuid;
  v_in_at timestamptz;
  v_in_by uuid;
begin
  if v_uid is null then
    raise exception 'Entre na sua conta para desfazer a entrada.' using errcode = '42501';
  end if;
  if char_length(v_motivo) not between 3 and 200 then
    raise exception 'Informe o motivo, de 3 a 200 caracteres.' using errcode = '22023';
  end if;

  -- trava o ingresso usado do evento que o chamador pode operar; qualquer outro caso cai na mesma mensagem abaixo
  select t.event_id, t.checked_in_at, t.checked_in_by into v_event, v_in_at, v_in_by
  from public.tickets t
  join public.events e on e.id = t.event_id
  where t.id = p_ticket_id and t.status = 'used'
    and e.status = 'published' and now() < coalesce(e.end_date, e.start_date + interval '1 day')
    and (select count(*) from public.check_in_desfeitos d where d.ticket_id = t.id) < 2
    and ((e.producer_id = v_uid and public.gf_mfa_ok())
         or public.gf_portaria_ok(e.producer_id)
         or public.gf_admin_can('manage_tickets'))
  for update of t;

  if found then
    update public.tickets set status = 'active', checked_in_at = null, checked_in_by = null
    where id = p_ticket_id and status = 'used';
  end if;
  if not found then
    raise exception 'Não foi possível desfazer: o ingresso não existe, não é deste evento ou não está com a entrada registrada.' using errcode = 'P0001';
  end if;
  delete from public.check_ins where ticket_id = p_ticket_id;

  insert into public.check_in_desfeitos (event_id, ticket_id, checked_in_at, checked_in_by, desfeito_por, motivo)
  values (v_event, p_ticket_id, v_in_at, v_in_by, v_uid, v_motivo);
end;
$$;
revoke all on function public.checkin_desfazer(uuid, text) from public, anon;
grant execute on function public.checkin_desfazer(uuid, text) to authenticated;

-- 3. Conferência final
do $$
begin
  if to_regclass('public.check_in_desfeitos') is null then raise exception 'falta a tabela check_in_desfeitos'; end if;
  if to_regprocedure('public.checkin_desfazer(uuid,text)') is null then raise exception 'falta a função checkin_desfazer'; end if;
  if has_function_privilege('anon', 'public.checkin_desfazer(uuid,text)', 'execute') then raise exception 'anon executa checkin_desfazer'; end if;
  if not (select relrowsecurity from pg_class where oid = 'public.check_in_desfeitos'::regclass) then raise exception 'RLS desligada em check_in_desfeitos'; end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'check_in_desfeitos'
                 and policyname = 'gf_mfa_aal2' and permissive = 'RESTRICTIVE') then
    raise exception 'falta a regra gf_mfa_aal2 em check_in_desfeitos';
  end if;
end $$;

commit;
