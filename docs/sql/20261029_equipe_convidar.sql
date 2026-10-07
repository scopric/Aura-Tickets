-- =============================================================================
-- Tela Equipe do produtor: convidar não funcionava. TeamManager.tsx procurava a conta com
-- `from('profiles').select('id').eq('email', …)`, mas a RLS de profiles só deixa ler a própria linha (ou admin):
-- sempre "Nenhuma conta Evokaa com esse e-mail". Achado no teste real depois do #250 (07/10/2026).
-- A lista da equipe tinha o mesmo problema (join em profiles voltava nulo: sem nome nem e-mail).
-- 1) team_convidar(p_email, p_role) devolve jsonb: {ok:true} ou {ok:false, motivo: generico|duplicado|bloqueado|limite|limite_equipe}.
--    Nunca devolve id nem uuid (não vira oráculo de contas). Conta inexistente, a própria e colaborador da Evokaa
--    (role admin) dão o MESMO {ok:false, motivo:'generico'}, sem erro, para a tentativa ficar registrada.
--    Guardas com erro (não dizem nada da conta procurada): sem login, sem 2FA em dia ou sem role producer = 42501;
--    cargo fora de admin|editor|viewer = 22023.
--    Toda chamada que passa das guardas conta em team_convite_tentativas: mais de 20 na última hora = 'limite'.
--    Limite de 5 vínculos não bloqueados (o da tela), com trava na linha do produtor (sem corrida).
--    Conta repetida com o mesmo e-mail (profiles não tem índice único em lower(email)): vale a mais antiga (created_at, id).
-- 2) team_lista(): a equipe do próprio produtor (mesmas guardas), só id, user_id, role, invited_at, accepted_at,
--    blocked_at, full_name ('Convidado' se vazio) e email. Nada de telefone, CPF ou outro dado do perfil.
-- 3) Insert direto em team_members sai (regra team_members_dono_insert e grant de insert de authenticated): permitia
--    gravar vínculo com qualquer user_id (até admin) sem as guardas. Nada no app nem nas funções insere direto
--    (conferido com grep em app/src e supabase/functions em 07/10/2026). Update e delete do dono continuam.
-- RISCO RESIDUAL (decisão do Ricardo): gf_mfa_ok aceita conta SEM fator de 2FA; só quem tem fator precisa do código
-- nesta sessão. Produtor sem 2FA convida e vê a equipe. Exigir fator do produtor é decisão de produto, não deste arquivo.
-- Como aplicar: ensaiar com ROLLBACK, depois colar inteiro no SQL Editor (UTF-8 via pbcopy, nunca TextEdit).
-- Uma transação, idempotente. Aplicar ANTES de mesclar o front. Testes: supabase/tests/team_convidar.test.sql.
-- NÃO mover para supabase/migrations/.
-- Desfazer: drop function if exists public.team_convidar(text, text), public.team_lista();
--   drop table if exists public.team_convite_tentativas;
--   grant insert (producer_id, user_id, role) on table public.team_members to authenticated; e recriar
--   team_members_dono_insert como em 20261017_team_members_rls.sql.
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 0. Pré-requisitos
do $$
begin
  if to_regclass('public.team_members') is null
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'team_members' and column_name = 'blocked_at')
     or to_regprocedure('public.gf_portaria_ok(uuid)') is null then
    raise exception 'falta team_members.blocked_at ou gf_portaria_ok (aplicar antes 20261017_team_members_rls.sql e 20261028_equipe_portaria.sql)';
  end if;
end $$;

-- 1. Tentativas de convite (só a função escreve; ninguém lê pela API)
create table if not exists public.team_convite_tentativas (
  producer_id uuid not null,
  em timestamptz not null default now()
);
create index if not exists team_convite_tentativas_producer_em_idx on public.team_convite_tentativas (producer_id, em);
alter table public.team_convite_tentativas enable row level security;
revoke all on table public.team_convite_tentativas from public, anon, authenticated;

drop function if exists public.team_convidar(text, text);
create function public.team_convidar(p_email text, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_alvo uuid;
  v_bloq timestamptz;
begin
  if v_uid is null or not public.gf_mfa_ok()
     or not exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'producer') then
    raise exception 'Só a conta do produtor convida para a equipe.' using errcode = '42501';
  end if;
  if p_role is null or p_role not in ('admin', 'editor', 'viewer') then
    raise exception 'Cargo inválido.' using errcode = '22023';
  end if;
  -- trava a linha do produtor: tentativas e limite de 5 sem corrida entre duas chamadas dele
  perform 1 from public.profiles where id = v_uid for update;
  delete from public.team_convite_tentativas where em < now() - interval '1 day';
  if (select count(*) from public.team_convite_tentativas c where c.producer_id = v_uid and c.em > now() - interval '1 hour') >= 20 then
    return jsonb_build_object('ok', false, 'motivo', 'limite');
  end if;
  insert into public.team_convite_tentativas (producer_id) values (v_uid);
  -- equipe cheia ANTES de procurar a conta: a resposta não depende de o e-mail existir
  if (select count(*) from public.team_members t where t.producer_id = v_uid and t.blocked_at is null) >= 5 then
    return jsonb_build_object('ok', false, 'motivo', 'limite_equipe');
  end if;
  -- inexistente, a própria conta e colaborador da Evokaa: a mesma resposta (não diz qual)
  select p.id into v_alvo from public.profiles p
  where lower(btrim(p.email)) = lower(btrim(coalesce(p_email, ''))) and p.id <> v_uid and p.role <> 'admin'
  order by p.created_at nulls last, p.id
  limit 1;
  if v_alvo is null then
    return jsonb_build_object('ok', false, 'motivo', 'generico');
  end if;
  select t.blocked_at into v_bloq from public.team_members t where t.producer_id = v_uid and t.user_id = v_alvo;
  if found then
    return jsonb_build_object('ok', false, 'motivo', case when v_bloq is not null then 'bloqueado' else 'duplicado' end);
  end if;
  insert into public.team_members (producer_id, user_id, role) values (v_uid, v_alvo, p_role);
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.team_convidar(text, text) from public, anon;
grant execute on function public.team_convidar(text, text) to authenticated;

create or replace function public.team_lista()
returns table (id uuid, user_id uuid, role text, invited_at timestamptz, accepted_at timestamptz, blocked_at timestamptz,
               full_name text, email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not public.gf_mfa_ok()
     or not exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'producer') then
    raise exception 'Só a conta do produtor vê a equipe.' using errcode = '42501';
  end if;
  return query
    select t.id, t.user_id, t.role, t.invited_at, t.accepted_at, t.blocked_at,
           coalesce(nullif(btrim(p.full_name), ''), 'Convidado'), p.email
    from public.team_members t
    left join public.profiles p on p.id = t.user_id
    where t.producer_id = v_uid
    order by t.invited_at, t.id;
end;
$$;
revoke all on function public.team_lista() from public, anon;
grant execute on function public.team_lista() to authenticated;

-- 3. Sem insert direto em team_members (só team_convidar grava convite)
drop policy if exists team_members_dono_insert on public.team_members;
revoke insert on table public.team_members from authenticated;

commit;
