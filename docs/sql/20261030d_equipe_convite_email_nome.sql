-- =============================================================================
-- Tela 20, e-mail do convite da equipe: o nome do produtor no e-mail passa a ser o das configurações dele
-- (producer_profiles.company_name = Empresa; sem empresa, profiles.full_name; sem os dois, 'Um produtor da Evokaa').
-- Só recria team_convite_email_reservar() de 20261030c_equipe_convite_email.sql, igual em tudo (guardas, limites, retorno,
-- grants) exceto a coluna `produtor`. Nenhuma coluna nova, nenhuma outra tabela ou função mexida.
-- Como aplicar: depois de 20261030c; ensaiar com ROLLBACK, colar inteiro no SQL Editor (UTF-8 via pbcopy, nunca TextEdit).
--   Uma transação, idempotente. Testes: supabase/tests/team_convite_email.test.sql.
-- NÃO mover para supabase/migrations/.
-- Desfazer: recolar team_convite_email_reservar() de 20261030c_equipe_convite_email.sql.
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 0. Pré-requisito
do $$
begin
  if to_regprocedure('public.team_convite_email_reservar()') is null or to_regclass('public.producer_profiles') is null then
    raise exception 'falta team_convite_email_reservar ou producer_profiles (aplicar antes 20261030c_equipe_convite_email.sql)';
  end if;
end $$;

create or replace function public.team_convite_email_reservar()
returns table (user_id uuid, email text, role text, produtor text, reserva timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'producer') then
    raise exception 'Só a conta do produtor envia o convite da equipe.' using errcode = '42501';
  end if;
  if not (public.gf_mfa_ok() and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
          and exists (select 1 from auth.mfa_factors f where f.user_id = v_uid and f.status = 'verified')) then
    raise exception 'Ative a verificação em duas etapas no seu perfil e entre com o código para convidar a equipe.' using errcode = '42501';
  end if;
  -- retenção: controle com mais de 30 dias sai (a janela de 7 dias já não olha para ele)
  delete from public.team_convite_email where reservado_em < now() - interval '30 days';
  -- trava por convidado (em ordem, sem deadlock) antes de contar as 24 h: dois produtores ao mesmo tempo não passam do limite de 3
  perform pg_advisory_xact_lock(hashtext(u.user_id::text)) from (
    select distinct t.user_id from public.team_members t
    where t.producer_id = v_uid and t.accepted_at is null and t.blocked_at is null and t.invited_at > now() - interval '10 minutes'
    order by t.user_id) u;
  -- insert ... on conflict ... where é atômico por linha: duas chamadas ao mesmo tempo não reservam o mesmo par.
  -- Par com e-mail há 7 dias ou mais recomeça (falhas zeradas); dentro dos 7 dias só quem falhou e tem menos de 3 falhas.
  return query
    with r as (
      insert into public.team_convite_email as c (producer_id, user_id, reservado_em)
      select t.producer_id, t.user_id, clock_timestamp() from public.team_members t
      where t.producer_id = v_uid and t.accepted_at is null and t.blocked_at is null
        and t.invited_at > now() - interval '10 minutes'
        -- limite por convidado: 3 reservas de produtores DIFERENTES em 24 h
        and (select count(*) from public.team_convite_email x
             where x.user_id = t.user_id and x.producer_id <> t.producer_id and x.enviado and x.reservado_em > now() - interval '24 hours') < 3
      on conflict (producer_id, user_id) do update
        set reservado_em = excluded.reservado_em, enviado = true,
            falhas = case when c.reservado_em < now() - interval '7 days' then 0 else c.falhas end
        where c.reservado_em < now() - interval '7 days' or (not c.enviado and c.falhas < 3)
      returning c.user_id, c.reservado_em
    )
    select r.user_id, p.email, t.role,
           coalesce(nullif(btrim(pf.company_name), ''), nullif(btrim(pp.full_name), ''), 'Um produtor da Evokaa'),
           r.reservado_em
    from r join public.team_members t on t.producer_id = v_uid and t.user_id = r.user_id
    join public.profiles p on p.id = r.user_id
    left join public.profiles pp on pp.id = v_uid
    left join public.producer_profiles pf on pf.id = v_uid
    order by t.invited_at, t.id;
end;
$$;
revoke all on function public.team_convite_email_reservar() from public, anon;
grant execute on function public.team_convite_email_reservar() to authenticated;

commit;
