-- Validação pública do certificado (pendência 10-a4; o QR e o "Código do certificado" impressos hoje não confirmam nada).
-- O que faz: cria public.certificado_validar(p_code text) -> jsonb, chamável por QUALQUER pessoa (anon e logado), para a página pública /certificado/<código>.
--   Quem tem o certificado nas mãos tem o código (issued_certificates.code = uuid v4 aleatório, 122 bits: não se adivinha nem se enumera).
--   Resposta, sempre um jsonb pequeno:
--     código inexistente, mal formado, certificado revogado (hoje revogar APAGA a linha), evento NÃO aprovado ou titular sem ingresso válido:  {"valido": false}   (igual em todos, de propósito)
--     código válido: {"valido": true, "nome": ..., "evento": ..., "data_evento": "AAAA-MM-DD", "organizador": ..., "emitido_em": "AAAA-MM-DD", "horas": ...}
--   "nome" é o nome informado na compra do ingresso do titular (o mesmo que sai impresso no certificado). Nada de e-mail, CPF, telefone, id de usuário ou id interno sai desta função.
--   DECISÕES DE POLÍTICA (escolhidas pelo lado seguro; o Ricardo pode afrouxar com uma linha cada, ver os dois "ponytail" abaixo):
--     1. o certificado só valida se o evento está APROVADO (events.approval_status = 'approved'): sem isso um produtor emitiria certificado de evento que a Evokaa nunca aprovou
--        e a página pública da Evokaa o confirmaria. Evento despublicado depois (status draft) continua validando; só a aprovação conta;
--     2. só valida enquanto o titular tem ingresso ativo ou usado no evento: ingresso estornado, cancelado ou transferido invalida o certificado dessa pessoa.
--   "horas" é a carga horária digitada no editor (certificates.template->>'horas'), só se for um número curto; senão nulo.
-- Como é seguro:
--   SECURITY DEFINER com search_path vazio (lê as tabelas por cima da RLS, só o que está acima); entrada validada (36 caracteres no formato uuid) antes de tocar no banco;
--   a busca é por igualdade exata no código (índice/unique já existente em issued_certificates.code); EXECUTE só para anon e authenticated (revoga de public).
--   Limite de consultas: o SQL não enxerga o IP; com 122 bits de entropia a enumeração não é viável. Se um dia houver abuso de volume, pôr a chamada atrás de uma Edge Function com limitarPorIp.
-- Depende de: tabelas issued_certificates, certificates, events, tickets, producer_profiles e profiles (já existem em produção).
-- Reaplicar: seguro (create or replace). Como desfazer: drop function public.certificado_validar(text);
begin;
set local lock_timeout = '5s';

create or replace function public.certificado_validar(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v record;
begin
  if p_code is null or p_code !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return jsonb_build_object('valido', false);
  end if;

  select ic.issued_at, c.template ->> 'horas' as horas, e.title, e.start_date,
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

comment on function public.certificado_validar(text) is 'Validação pública de certificado (página /certificado/<código>): devolve só nome, evento, data, organizador, emissão e carga horária; código inexistente ou revogado = {"valido": false}';

revoke all on function public.certificado_validar(text) from public;
grant execute on function public.certificado_validar(text) to anon, authenticated;

-- Conferência: a função existe, é security definer com search_path vazio, e só anon/authenticated executam
do $$
declare v_def boolean; v_cfg text[];
begin
  select p.prosecdef, p.proconfig into v_def, v_cfg
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'certificado_validar' and pg_get_function_identity_arguments(p.oid) = 'p_code text';
  if v_def is distinct from true then raise exception 'certificado_validar não é security definer'; end if;
  if v_cfg is null or not (v_cfg @> array['search_path=""']) then raise exception 'certificado_validar sem search_path vazio'; end if;
  if has_function_privilege('anon', 'public.certificado_validar(text)', 'execute') is not true
     or has_function_privilege('authenticated', 'public.certificado_validar(text)', 'execute') is not true then
    raise exception 'anon/authenticated sem EXECUTE';
  end if;
  if (public.certificado_validar('nao-e-um-codigo') ->> 'valido') <> 'false'
     or (public.certificado_validar('00000000-0000-4000-8000-000000000000') ->> 'valido') <> 'false'
     or (public.certificado_validar(null) ->> 'valido') <> 'false' then
    raise exception 'código inválido deveria dar valido=false';
  end if;
end $$;

commit;

-- Conferência depois do Run (leitura): esperado = 1 função, security_definer true, anon_executa true.
-- select count(*) as funcoes, bool_and(p.prosecdef) as security_definer, has_function_privilege('anon', 'public.certificado_validar(text)', 'execute') as anon_executa
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'certificado_validar';
-- Chamada de verdade (com um código de certificado emitido): select public.certificado_validar('<código>');
