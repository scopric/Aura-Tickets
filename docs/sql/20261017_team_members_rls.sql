-- =============================================================================
-- Tela Equipe do produtor: team_members tinha RLS ligada e SÓ a regra RESTRICTIVE gf_mfa_aal2, sem nenhuma permissiva.
-- Resultado: a lista vinha vazia e convidar dava erro. (Conferido em produção em 04/10/2026.)
-- 1) 4 regras permissivas: o produtor dono (producer_id = auth.uid()) lê, convida, altera e remove os SEUS membros.
--    Outro produtor não vê nem toca. O 2FA continua exigido pela RESTRICTIVE gf_mfa_aal2 (não mexida aqui).
--    O membro convidado NÃO ganha leitura: nenhum código do app lê team_members como membro (o check-in usa service
--    role; as funções de convite e de mesa são security definer).
-- 2) Coluna blocked_at: o front gravava role = 'blocked', que o CHECK team_members_role_check (admin/editor/viewer)
--    recusa; e "Ativar" gravava 'viewer', rebaixando admin/editor. Agora bloquear = blocked_at preenchido + accepted_at
--    nulo (o check-in já exige accepted_at, então o bloqueio vale na porta), e ativar = limpa blocked_at e volta
--    accepted_at; o cargo (role) nunca muda. Menor que mexer no CHECK ou guardar "papel anterior".
-- Como aplicar: colar inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA pelo TextEdit). Uma transação, idempotente.
-- Desfazer: drop policy dos 4 nomes abaixo; alter table public.team_members drop column blocked_at.
-- NÃO mover para supabase/migrations/ (motivo no cabeçalho de 20260927_security_hardening.sql).
-- =============================================================================
begin;
set local lock_timeout = '5s';

alter table public.team_members add column if not exists blocked_at timestamptz;

drop policy if exists team_members_dono_select on public.team_members;
drop policy if exists team_members_dono_insert on public.team_members;
drop policy if exists team_members_dono_update on public.team_members;
drop policy if exists team_members_dono_delete on public.team_members;

create policy team_members_dono_select on public.team_members as permissive for select to authenticated
  using (producer_id = (select auth.uid()));
create policy team_members_dono_insert on public.team_members as permissive for insert to authenticated
  with check (producer_id = (select auth.uid()));
create policy team_members_dono_update on public.team_members as permissive for update to authenticated
  using (producer_id = (select auth.uid())) with check (producer_id = (select auth.uid()));
create policy team_members_dono_delete on public.team_members as permissive for delete to authenticated
  using (producer_id = (select auth.uid()));

commit;
