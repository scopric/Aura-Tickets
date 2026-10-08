-- =============================================================================
-- Tela 20, Equipe do produtor: o convite passa a ir por e-mail (Decisão 190) e convidar exige 2FA (Decisão 191).
-- 1) team_convidar(p_email, p_role): igual à de 20261029_equipe_convidar.sql, com UMA guarda a mais: o produtor precisa de
--    fator de 2FA confirmado (auth.mfa_factors.status = 'verified') e do código digitado nesta sessão (aal2), a mesma
--    condição de team_aceitar_convite/gf_portaria_ok (20261028_equipe_portaria.sql). Sem isso: 42501 com a mensagem
--    "Ative a verificação em duas etapas no seu perfil e entre com o código para convidar a equipe."
--    Fecha o RISCO RESIDUAL de 20261029 (produtor sem 2FA convidava). team_lista, bloquear, ativar e remover não mudam.
-- 2) team_convite_email (producer_id, user_id, reservado_em, enviado, falhas): controle de "um e-mail por convite", POR PAR
--    produtor/convidado e sem chave estrangeira: sobrevive à remoção do membro (remover e convidar de novo não reenvia).
--    Nenhuma coluna nova em team_members (os grants por coluna de 20261017 ficam como estão). RLS ligada, sem acesso pela API.
-- 3) team_convite_email_reservar() (authenticated; mesmas guardas de produtor + 2FA): reserva, de uma vez, os vínculos DO
--    PRÓPRIO produtor ainda pendentes (accepted_at e blocked_at nulos), convidados nos últimos 10 minutos e cujo par não teve
--    e-mail nos últimos 7 dias. A reserva já conta como enviada (otimista: se o resultado se perder, nada reenvia). Falha
--    libera o par até 3 vezes dentro dos 7 dias. Devolve user_id, e-mail, cargo, nome do produtor e a marca da reserva.
--    O chamador não passa id nem e-mail: não dá para mandar e-mail a quem ele não convidou.
-- 4) team_convite_email_resultado(p_producer, p_user, p_reserva, p_ok): só service_role (a Edge Function send-email). Com
--    p_ok = false desfaz a reserva daquela marca e soma uma falha; uma falha atrasada de reserva antiga não desfaz uma mais
--    nova. Com p_ok = true não faz nada (a reserva já contou). O produtor não consegue zerar o controle.
-- Como aplicar: ensaiar com ROLLBACK, depois colar inteiro no SQL Editor (UTF-8 via pbcopy, nunca TextEdit). Uma transação,
--   idempotente. Aplicar ANTES de mesclar o front e de publicar send-email. Testes: supabase/tests/team_convite_email.test.sql.
-- O bloco 0 recusa se team_convidar não existir com o corpo de 20261029 (referência a team_convite_tentativas e limite_equipe):
--   sem 20261029 aplicado este arquivo não faz sentido. Vale também para a versão deste arquivo, então pode rodar de novo.
--   Conferir em produção antes: select prosrc like '%limite_equipe%' from pg_proc where oid = 'public.team_convidar(text,text)'::regprocedure;
--   (tem de dar true).
--   gf_mfa_ok() já exige aal2 de quem tem fator verificado; a condição aal2 abaixo é redundante e fica por defesa em profundidade.
-- Limites do e-mail: 1 por par produtor/convidado a cada 7 dias; no máximo 3 por convidado em 24 h somando produtores diferentes
--   (o convidado não vira alvo de spam por vários produtores); linhas de controle com mais de 30 dias são apagadas por reservar().
-- RISCO ACEITO: team_convidar ainda responde ok ou genérico, o que mostra se a conta existe; mitigado pelo 2FA do produtor
--   (Decisão 191) e pelo limite de 20 tentativas por hora. Resposta única para tudo é decisão de produto, pendente.
-- NÃO mover para supabase/migrations/.
-- Desfazer só o e-mail: drop function if exists public.team_convite_email_reservar(), public.team_convite_email_resultado(uuid, uuid, timestamptz, boolean);
--   drop table if exists public.team_convite_email; e MANTER a team_convidar nova. Recolar a de 20261029 reabre o risco da Decisão 191
--   (produtor sem 2FA convida).
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 0. Pré-requisitos
do $$
begin
  if to_regclass('public.team_members') is null
     or to_regprocedure('public.gf_mfa_ok()') is null
     or to_regclass('public.team_convite_tentativas') is null
     or not exists (select 1 from pg_proc where oid = to_regprocedure('public.team_convidar(text, text)')
                    and prosrc like '%team_convite_tentativas%' and prosrc like '%limite_equipe%') then
    raise exception 'falta team_convidar (corpo de 20261029), team_convite_tentativas ou gf_mfa_ok (aplicar antes 20261029_equipe_convidar.sql)';
  end if;
end $$;

-- 1. team_convidar com a guarda de 2FA (o resto é idêntico a 20261029)
create or replace function public.team_convidar(p_email text, p_role text)
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
  if v_uid is null or not exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'producer') then
    raise exception 'Só a conta do produtor convida para a equipe.' using errcode = '42501';
  end if;
  -- 2FA: fator confirmado e o código digitado nesta sessão (a mesma condição de team_aceitar_convite)
  if not (public.gf_mfa_ok() and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
          and exists (select 1 from auth.mfa_factors f where f.user_id = v_uid and f.status = 'verified')) then
    raise exception 'Ative a verificação em duas etapas no seu perfil e entre com o código para convidar a equipe.' using errcode = '42501';
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

-- 2. Controle de envio do e-mail por par produtor/convidado (só as funções abaixo escrevem; ninguém lê pela API)
create table if not exists public.team_convite_email (
  producer_id uuid not null,
  user_id uuid not null,
  reservado_em timestamptz not null,
  enviado boolean not null default true,
  falhas int not null default 0,
  primary key (producer_id, user_id)
);
alter table public.team_convite_email enable row level security;
revoke all on table public.team_convite_email from public, anon, authenticated;

-- 3. Reservar os e-mails a enviar (o produtor chama pela Edge Function, com o JWT dele)
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
           coalesce(nullif(btrim((select pp.full_name from public.profiles pp where pp.id = v_uid)), ''), 'Um produtor da Evokaa'),
           r.reservado_em
    from r join public.team_members t on t.producer_id = v_uid and t.user_id = r.user_id
    join public.profiles p on p.id = r.user_id
    order by t.invited_at, t.id;
end;
$$;
revoke all on function public.team_convite_email_reservar() from public, anon;
grant execute on function public.team_convite_email_reservar() to authenticated;

-- 4. Resultado do envio (só a Edge Function, com a service role): falha desfaz a reserva daquela marca
create or replace function public.team_convite_email_resultado(p_producer uuid, p_user uuid, p_reserva timestamptz, p_ok boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.team_convite_email c
  set enviado = false, falhas = c.falhas + 1
  where c.producer_id = p_producer and c.user_id = p_user and c.reservado_em = p_reserva and c.enviado and not p_ok;
$$;
revoke all on function public.team_convite_email_resultado(uuid, uuid, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.team_convite_email_resultado(uuid, uuid, timestamptz, boolean) to service_role;

commit;
