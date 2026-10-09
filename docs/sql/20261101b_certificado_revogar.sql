-- Revogar certificado COM HISTÓRICO (Ricardo, 09/10/2026; terceira parte do certificado). Hoje revogar APAGA a linha: some o código, some o registro, e a mesma pessoa
-- não pode receber outro certificado enquanto a linha antiga existe só por acaso. Aqui revogar passa a MARCAR (quem e quando) e a linha fica.
-- O que faz:
--   1. issued_certificates ganha revoked_at e revoked_by (nulos = certificado ativo).
--   2. O índice único (certificate_id, user_id) vira PARCIAL (só entre os não revogados): a pessoa revogada pode receber outro certificado, com código novo; o
--      antigo continua revogado. Dois ativos para a mesma pessoa continuam impossíveis.
--   3. public.certificado_revogar(p_id uuid): o produtor dono do evento revoga (2FA como as demais). Idempotente: revogar de novo mantém a data original.
--      A regra de DELETE do produtor (gf_issued_certificates_produtor_delete) SAI e UPDATE/DELETE saem dos grants de anon e authenticated: ninguém apaga nem altera o histórico pela API; só esta função revoga.
--   4. certificado_validar passa a dizer "revogado": {"valido": false, "revogado": true, "revogado_em": "AAAA-MM-DD"} para código revogado de evento aprovado e titular com
--      ingresso válido (quem tem o código tem o certificado nas mãos; saber que foi revogado é o que ele precisa). Todos os outros casos inválidos seguem IGUAIS
--      ({"valido": false}). certificado_ver devolve o mesmo (só repassa o resultado inválido, que nunca tem dado pessoal).
-- Depende de: 20261031e_certificado_validar.sql, 20261101a_certificado_ver_e_envio.sql e public.gf_mfa_ok() (já em produção).
-- Como aplicar: ANTES de mesclar o front que chama certificado_revogar. Colar inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA pelo TextEdit). Uma transação.
--   Enquanto o front antigo estiver no ar, "Revogar" não apagará mais nada (a regra de DELETE saiu): mesclar o front logo depois do Run.
-- Como desfazer: drop function public.certificado_revogar(uuid); recriar a regra de DELETE e o índice total (só se não houver linha revogada duplicada); colunas podem ficar.
begin;
set local lock_timeout = '5s';

do $$
begin
  if to_regclass('public.issued_certificates') is null or to_regclass('public.certificates') is null or to_regclass('public.events') is null then
    raise exception 'faltam issued_certificates, certificates ou events';
  end if;
  if to_regprocedure('public.certificado_validar(text)') is null or to_regprocedure('public.certificado_ver(text)') is null then
    raise exception 'faltam certificado_validar/certificado_ver (20261031e e 20261101a): aplicar antes';
  end if;
  if to_regprocedure('public.gf_mfa_ok()') is null then raise exception 'falta public.gf_mfa_ok()'; end if;
end $$;

-- 1. Colunas ---------------------------------------------------------------------------------------------------------------
alter table public.issued_certificates add column if not exists revoked_at timestamptz;
alter table public.issued_certificates add column if not exists revoked_by uuid;

-- 2. Um ATIVO por pessoa (o revogado não conta) ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_constraint where conrelid = 'public.issued_certificates'::regclass and conname = 'issued_certificates_certificado_pessoa_key') then
    alter table public.issued_certificates drop constraint issued_certificates_certificado_pessoa_key;
  else
    drop index if exists public.issued_certificates_certificado_pessoa_key;
  end if;
end $$;
create unique index if not exists issued_certificates_certificado_pessoa_ativo_key
  on public.issued_certificates (certificate_id, user_id) where revoked_at is null;

-- 3. Revogar só pela função; o produtor deixa de apagar --------------------------------------------------------------------
drop policy if exists gf_issued_certificates_produtor_delete on public.issued_certificates;
-- Defesa em profundidade: hoje só a RLS segura UPDATE e DELETE (os grants de tabela existem sem regra). Revogados também saem do grant: o histórico só muda pela função.
revoke update, delete on public.issued_certificates from anon, authenticated;

create or replace function public.certificado_revogar(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'sem sessão' using errcode = '42501'; end if;
  if not public.gf_mfa_ok() then
    raise exception 'Reautenticação de dois fatores necessária.' using errcode = '42501';
  end if;
  -- só o dono do evento; "não existe" e "não é seu" dão o mesmo erro
  if not exists (
    select 1 from public.issued_certificates ic
      join public.certificates c on c.id = ic.certificate_id
      join public.events e on e.id = c.event_id
     where ic.id = p_id and e.producer_id = v_uid
  ) then
    raise exception 'Você não tem acesso a este certificado.' using errcode = '42501';
  end if;
  update public.issued_certificates set revoked_at = now(), revoked_by = v_uid where id = p_id and revoked_at is null;
end $$;
comment on function public.certificado_revogar(uuid) is 'Revoga o certificado emitido (marca revoked_at/revoked_by; a linha fica). Só o produtor dono do evento, com 2FA. Idempotente.';
revoke all on function public.certificado_revogar(uuid) from public, anon;
grant execute on function public.certificado_revogar(uuid) to authenticated;

-- 4. Validação mostra "revogado" ----------------------------------------------------------------------------------------------
create or replace function public.certificado_validar(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v record;
begin
  if p_code is null or p_code !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return jsonb_build_object('valido', false);
  end if;

  select ic.issued_at, ic.revoked_at, c.template ->> 'horas' as horas, e.title, e.start_date,
         coalesce(nullif(btrim(pp.company_name), ''), nullif(btrim(pr.full_name), '')) as organizador,
         (select t.buyer_name
            from public.tickets t
           where t.event_id = c.event_id and t.user_id = ic.user_id and t.status in ('active', 'used')
           order by (t.checked_in_at is not null) desc, t.created_at
           limit 1) as nome,
         exists (select 1 from public.tickets t
                  where t.event_id = c.event_id and t.user_id = ic.user_id and t.status in ('active', 'used')) as tem_ingresso
    into v
    from public.issued_certificates ic
    join public.certificates c on c.id = ic.certificate_id
    join public.events e on e.id = c.event_id
    left join public.producer_profiles pp on pp.id = e.producer_id
    left join public.profiles pr on pr.id = e.producer_id
   where ic.code = lower(p_code)
     and e.approval_status = 'approved'; -- ponytail: política 1; tirar esta linha para validar também evento não aprovado

  if not found or not v.tem_ingresso then -- ponytail: política 2; trocar por `if not found then` para validar mesmo com ingresso estornado (nome sairá nulo)
    return jsonb_build_object('valido', false);
  end if;

  if v.revoked_at is not null then -- sem nome, evento nem organizador: só diz que foi revogado e quando
    return jsonb_build_object('valido', false, 'revogado', true, 'revogado_em', to_char(v.revoked_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'));
  end if;

  return jsonb_build_object(
    'valido', true,
    'nome', nullif(btrim(v.nome), ''),
    'evento', v.title,
    'data_evento', to_char(v.start_date at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'),
    'organizador', v.organizador,
    'emitido_em', to_char(v.issued_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'),
    'horas', case when v.horas ~ '^[0-9]{1,4}$' then v.horas else null end
  );
end $$;
revoke all on function public.certificado_validar(text) from public;
grant execute on function public.certificado_validar(text) to anon, authenticated;

create or replace function public.certificado_ver(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb;
  t jsonb;
  m jsonb; -- modelo que sai (null = sem modelo)
begin
  v := public.certificado_validar(p_code); -- toda a regra de validade (e a entrada validada) fica lá
  if v is null then return jsonb_build_object('valido', false); end if;
  if (v ->> 'valido') is distinct from 'true' then return v; end if; -- inválido (ou revogado): o mesmo mínimo de certificado_validar, sem dado pessoal

  select c.template into t
    from public.issued_certificates ic
    join public.certificates c on c.id = ic.certificate_id
   where ic.code = lower(p_code);

  if t is not null and jsonb_typeof(t) = 'object' then
    m := jsonb_strip_nulls(jsonb_build_object(
      'selectedTemplate', t -> 'selectedTemplate', 'accentColor', t -> 'accentColor', 'fields', t -> 'fields',
      'logoUrl', t -> 'logoUrl', 'sigUrl', t -> 'sigUrl', 'horas', t -> 'horas'));
    if octet_length(m::text) > 3000000 then m := null; end if; -- mede só o que sairia, não as chaves descartadas
  end if;

  return v || jsonb_build_object('codigo', lower(p_code), 'modelo', m);
end $$;
revoke all on function public.certificado_ver(text) from public;
grant execute on function public.certificado_ver(text) to anon, authenticated;

-- 5. Conferência que aborta (tudo ou nada) ---------------------------------------------------------------------------------
do $$
declare v_cfg text[]; v_def boolean;
begin
  select p.prosecdef, p.proconfig into v_def, v_cfg from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'certificado_revogar';
  if v_def is distinct from true or v_cfg is null or not (v_cfg @> array['search_path=""']) then raise exception 'certificado_revogar deve ser security definer com search_path vazio'; end if;
  if has_function_privilege('anon', 'public.certificado_revogar(uuid)', 'execute') or not has_function_privilege('authenticated', 'public.certificado_revogar(uuid)', 'execute') then
    raise exception 'EXECUTE de certificado_revogar errado';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'issued_certificates' and cmd in ('DELETE', 'ALL') and policyname <> 'gf_mfa_aal2') then
    raise exception 'ainda há regra de DELETE em issued_certificates: %', (select string_agg(policyname::text, ', ') from pg_policies where schemaname = 'public' and tablename = 'issued_certificates' and cmd in ('DELETE', 'ALL'));
  end if;
  if has_table_privilege('authenticated', 'public.issued_certificates', 'update') or has_table_privilege('authenticated', 'public.issued_certificates', 'delete')
     or has_table_privilege('anon', 'public.issued_certificates', 'update') or has_table_privilege('anon', 'public.issued_certificates', 'delete') then
    raise exception 'anon/authenticated ainda têm UPDATE ou DELETE em issued_certificates';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'issued_certificates_certificado_pessoa_ativo_key' and indexdef like '%WHERE (revoked_at IS NULL)%') then
    raise exception 'índice único parcial não ficou no lugar';
  end if;
  if (public.certificado_validar('nao-e-um-codigo') ->> 'valido') <> 'false' or (public.certificado_ver(null) ->> 'valido') <> 'false' then
    raise exception 'código inválido deveria dar valido=false';
  end if;
end $$;

commit;

select 'funcao' as item, proname::text as nome, prosecdef::text as valor from pg_proc where pronamespace = 'public'::regnamespace and proname in ('certificado_revogar', 'certificado_validar', 'certificado_ver')
union all select 'coluna', column_name::text, data_type::text from information_schema.columns where table_schema = 'public' and table_name = 'issued_certificates' and column_name in ('revoked_at', 'revoked_by')
union all select 'indice', indexname::text, '' from pg_indexes where schemaname = 'public' and tablename = 'issued_certificates';
