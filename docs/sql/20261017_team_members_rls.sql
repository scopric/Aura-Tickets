-- =============================================================================
-- Tela Equipe do produtor: team_members tinha RLS ligada e SÓ a regra RESTRICTIVE gf_mfa_aal2, sem nenhuma permissiva.
-- Resultado: a lista vinha vazia e convidar dava erro. (Conferido em produção em 04/10/2026.)
-- 1) 4 regras permissivas para o produtor dono (producer_id = auth.uid()). O 2FA segue na RESTRICTIVE gf_mfa_aal2.
--    INSERT: só por conta de produtor (profiles.role = 'producer'), sem se convidar, sempre pendente e não bloqueado.
--    O produtor NÃO grava accepted_at (o aceite é do próprio convidado, ainda sem fluxo: ver PR) nem troca user_id/producer_id.
-- 2) Permissões por coluna: anon sem nada; authenticated com SELECT e DELETE, INSERT só (producer_id, user_id, role),
--    UPDATE só (role, blocked_at). Sem TRIGGER/REFERENCES/TRUNCATE/MAINTAIN. service_role não é mexido.
-- 3) Coluna blocked_at: bloquear = blocked_at preenchido, ativar = limpar. O cargo nunca muda (antes o front gravava
--    role='blocked', recusado pelo CHECK, e Ativar rebaixava para viewer). O check-in passa a exigir blocked_at nulo.
-- 4) Único (producer_id, user_id). Se já houver duplicata, o arquivo para com erro e lista as linhas: resolva e rode de novo.
-- Membro convidado NÃO ganha leitura: nada no app lê team_members como membro (check-in usa service role).
-- Como aplicar: ANTES de mesclar o PR (o front novo lê blocked_at). Colar inteiro no SQL Editor (UTF-8 via pbcopy,
-- NUNCA pelo TextEdit). Uma transação, idempotente. Depois, fazer o deploy da função check-in-validate.
-- Desfazer (nesta ordem; só depois de voltar o front e a função antigos):
--   drop policy team_members_dono_select/_insert/_update/_delete on public.team_members;   (os 4 nomes)
--   alter table public.team_members drop constraint if exists team_members_producer_user_key;
--   alter table public.team_members drop column if exists blocked_at;
--   revoke all on public.team_members from anon; revoke all on public.team_members from authenticated;
--   grant delete, insert, references, select, trigger, update on public.team_members to authenticated;
--   (e, se quiser o estado antigo exato, grant delete, insert, references, select, trigger, update ... to anon)
-- NÃO mover para supabase/migrations/ (motivo no cabeçalho de 20260927_security_hardening.sql).
-- =============================================================================
begin;
set local lock_timeout = '5s';

do $$
declare v text;
begin
  select string_agg(producer_id || '/' || user_id || ' x' || n, '; ') into v
    from (select producer_id, user_id, count(*) n from public.team_members group by 1, 2 having count(*) > 1) d;
  if v is not null then
    raise exception 'team_members tem vínculos duplicados (producer/user): %. Remova as sobras e rode de novo.', v;
  end if;
end $$;

alter table public.team_members add column if not exists blocked_at timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'team_members_producer_user_key'
                  and conrelid = 'public.team_members'::regclass) then
    alter table public.team_members add constraint team_members_producer_user_key unique (producer_id, user_id);
  end if;
end $$;

revoke all on table public.team_members from anon;
revoke all on table public.team_members from authenticated;
grant select, delete on table public.team_members to authenticated;
grant insert (producer_id, user_id, role) on table public.team_members to authenticated;
grant update (role, blocked_at) on table public.team_members to authenticated;

drop policy if exists team_members_dono_select on public.team_members;
drop policy if exists team_members_dono_insert on public.team_members;
drop policy if exists team_members_dono_update on public.team_members;
drop policy if exists team_members_dono_delete on public.team_members;

create policy team_members_dono_select on public.team_members as permissive for select to authenticated
  using (producer_id = (select auth.uid()));
create policy team_members_dono_insert on public.team_members as permissive for insert to authenticated
  with check (producer_id = (select auth.uid())
              and user_id <> producer_id
              and accepted_at is null and blocked_at is null
              and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'producer'));
create policy team_members_dono_update on public.team_members as permissive for update to authenticated
  using (producer_id = (select auth.uid())) with check (producer_id = (select auth.uid()));
create policy team_members_dono_delete on public.team_members as permissive for delete to authenticated
  using (producer_id = (select auth.uid()));

commit;
