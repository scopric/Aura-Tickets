-- certificado_ver corta imagens grandes demais (Ricardo, 09/10/2026; quarta parte do certificado). O front descarta logoUrl/sigUrl com mais de 1.500.000
-- caracteres (LIMITES.imagemChars em app/src/lib/certificados.ts), mas a função pública mandava até ~3 MB assim mesmo a qualquer chamada anônima.
-- O que muda: SÓ isto em certificado_ver (o resto é idêntico a 20261101b): logoUrl e sigUrl com mais de 1.500.000 caracteres saem nulos (a chave some do modelo).
--   O teto geral de ~3 MB do modelo continua. Validação, demais chaves, revogado e permissões não mudam.
-- Depende de: 20261101b_certificado_revogar.sql (certificado_validar com "revogado"). Nenhuma tabela é tocada.
-- Como aplicar: colar inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA pelo TextEdit). Uma transação; pode rodar de novo (create or replace).
-- Como desfazer: rodar de novo o bloco certificado_ver de 20261101b.
begin;
set local lock_timeout = '5s';

do $$
begin
  if to_regprocedure('public.certificado_validar(text)') is null or to_regprocedure('public.certificado_revogar(uuid)') is null then
    raise exception 'faltam certificado_validar/certificado_revogar (20261101b): aplicar antes';
  end if;
end $$;

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
      -- imagem acima do teto do front (1.500.000 caracteres) sai nula: o front a descartaria de qualquer jeito
      'logoUrl', case when length(t ->> 'logoUrl') > 1500000 then null else t -> 'logoUrl' end,
      'sigUrl', case when length(t ->> 'sigUrl') > 1500000 then null else t -> 'sigUrl' end,
      'horas', t -> 'horas'));
    if octet_length(m::text) > 3000000 then m := null; end if; -- mede só o que sairia, não as chaves descartadas
  end if;

  return v || jsonb_build_object('codigo', lower(p_code), 'modelo', m);
end $$;
revoke all on function public.certificado_ver(text) from public;
grant execute on function public.certificado_ver(text) to anon, authenticated;

-- Conferência que aborta (tudo ou nada) ---------------------------------------------------------------------------------------
do $$
declare v_cfg text[]; v_def boolean;
begin
  select p.prosecdef, p.proconfig into v_def, v_cfg from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'certificado_ver';
  if v_def is distinct from true or v_cfg is null or not (v_cfg @> array['search_path=""']) then raise exception 'certificado_ver deve ser security definer com search_path vazio'; end if;
  if not has_function_privilege('anon', 'public.certificado_ver(text)', 'execute') or not has_function_privilege('authenticated', 'public.certificado_ver(text)', 'execute') then
    raise exception 'EXECUTE de certificado_ver errado';
  end if;
  if pg_get_functiondef('public.certificado_ver(text)'::regprocedure) not like '%1500000%' then raise exception 'certificado_ver sem o corte de imagens'; end if;
  if (public.certificado_ver(null) ->> 'valido') <> 'false' or (public.certificado_ver('lixo') ->> 'valido') <> 'false' then
    raise exception 'código inválido deveria dar valido=false';
  end if;
end $$;

commit;

select 'certificado_ver' as item, prosecdef::text as security_definer, (pg_get_functiondef(oid) like '%1500000%')::text as corta_imagens
  from pg_proc where pronamespace = 'public'::regnamespace and proname = 'certificado_ver';
