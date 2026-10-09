-- Certificado: ver o certificado pelo código (página pública) e registro de envio por e-mail (Ricardo, 09/10/2026, opção A).
-- O que faz:
--   1. public.certificado_ver(p_code text) -> jsonb, chamável por QUALQUER pessoa (anon e logado), para a página /certificado/<código> desenhar o certificado.
--      Devolve EXATAMENTE o que public.certificado_validar devolve (mesmas regras: inexistente, mal formado, evento não aprovado e titular sem ingresso válido dão
--      {"valido": false}) MAIS "codigo" e "modelo": só as chaves selectedTemplate, accentColor, fields, logoUrl, sigUrl e horas de certificates.template (o desenho do
--      certificado: texto, cores, logo e assinatura, que já são públicos por natureza). Modelo acima de ~3 MB (medido só nas chaves que saem) não sai (modelo = null): a página mostra só a validação. Risco aceito: função anônima sem limite de taxa; cada
--      chamada pode devolver até ~3 MB (imagens em data: do editor); o código é o segredo. Se houver pico de tráfego, pôr a página atrás de uma Edge Function com cache.
--      certificado_validar NÃO muda (a API de validação continua mínima).
--   2. public.certificate_email_logs: um registro por tentativa de envio do certificado por e-mail (limite por certificado e por produtor, feito pela Edge Function
--      certificado-enviar). SEM e-mail do destinatário nem nome (minimização): só ids, situação e erro. Sem política e sem GRANT: só a chave de serviço lê e grava.
-- Depende de: 20261031e_certificado_validar.sql (certificado_validar) e das tabelas issued_certificates e certificates (já existem em produção).
-- Como aplicar: ANTES de publicar a função certificado-enviar e de mesclar o front que a chama. Colar inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA pelo TextEdit).
--   Uma transação, idempotente (create or replace / if not exists).
-- Como desfazer (só depois de tirar o front e a função): drop function public.certificado_ver(text); drop table public.certificate_email_logs;
begin;
set local lock_timeout = '5s';

do $$
begin
  if to_regprocedure('public.certificado_validar(text)') is null then
    raise exception 'falta public.certificado_validar(text) (20261031e_certificado_validar.sql): aplicar antes';
  end if;
  if to_regclass('public.issued_certificates') is null or to_regclass('public.certificates') is null then
    raise exception 'faltam issued_certificates ou certificates';
  end if;
end $$;

-- 1. Ver o certificado --------------------------------------------------------------------------------------------------
create or replace function public.certificado_ver(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb;
  t jsonb;
  m jsonb; -- modelo que sai (null = sem modelo)
begin
  v := public.certificado_validar(p_code); -- toda a regra de validade (e a entrada validada) fica lá
  if v is null or (v ->> 'valido') is distinct from 'true' then
    return jsonb_build_object('valido', false);
  end if;

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

comment on function public.certificado_ver(text) is 'Certificado pelo código (página /certificado/<código>): o mesmo de certificado_validar mais codigo e o modelo de desenho (só chaves conhecidas, até ~3 MB).';
revoke all on function public.certificado_ver(text) from public;
grant execute on function public.certificado_ver(text) to anon, authenticated;

-- 2. Registro de envio por e-mail --------------------------------------------------------------------------------------------
create table if not exists public.certificate_email_logs (
  id uuid primary key default gen_random_uuid(),
  issued_certificate_id uuid not null references public.issued_certificates(id) on delete cascade,
  producer_id uuid not null,
  status text not null check (status in ('pending', 'sent', 'failed')),
  resend_id text,
  error_message text,
  created_at timestamptz not null default now()
);
create index if not exists certificate_email_logs_cert_idx on public.certificate_email_logs (issued_certificate_id, created_at desc);
create index if not exists certificate_email_logs_produtor_idx on public.certificate_email_logs (producer_id, created_at desc);
alter table public.certificate_email_logs enable row level security;
revoke all on public.certificate_email_logs from anon, authenticated;
comment on table public.certificate_email_logs is 'Tentativas de envio do certificado por e-mail (certificado-enviar). Sem e-mail nem nome. Só a chave de serviço.';

-- 3. Conferência que aborta (tudo ou nada) ----------------------------------------------------------------------------------
do $$
declare v_def boolean; v_cfg text[];
begin
  select p.prosecdef, p.proconfig into v_def, v_cfg
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'certificado_ver' and pg_get_function_identity_arguments(p.oid) = 'p_code text';
  if v_def is distinct from true then raise exception 'certificado_ver não é security definer'; end if;
  if v_cfg is null or not (v_cfg @> array['search_path=""']) then raise exception 'certificado_ver sem search_path vazio'; end if;
  if has_function_privilege('anon', 'public.certificado_ver(text)', 'execute') is not true
     or has_function_privilege('authenticated', 'public.certificado_ver(text)', 'execute') is not true then
    raise exception 'anon/authenticated sem EXECUTE em certificado_ver';
  end if;
  if (public.certificado_ver('nao-e-um-codigo') ->> 'valido') <> 'false'
     or (public.certificado_ver('00000000-0000-4000-8000-000000000000') ->> 'valido') <> 'false'
     or (public.certificado_ver(null) ->> 'valido') <> 'false' then
    raise exception 'código inválido deveria dar valido=false';
  end if;
  if has_table_privilege('anon', 'public.certificate_email_logs', 'select') or has_table_privilege('authenticated', 'public.certificate_email_logs', 'select')
     or not (select relrowsecurity from pg_class where oid = 'public.certificate_email_logs'::regclass) then
    raise exception 'certificate_email_logs deveria ter RLS ligada e nenhum acesso para anon/authenticated';
  end if;
end $$;

commit;

select 'funcao' as item, proname::text as nome, prosecdef::text as valor from pg_proc where proname = 'certificado_ver' and pronamespace = 'public'::regnamespace
union all
select 'tabela', relname::text, relrowsecurity::text from pg_class where oid = 'public.certificate_email_logs'::regclass;
