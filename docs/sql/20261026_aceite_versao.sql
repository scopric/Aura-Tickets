-- =============================================================================
-- Texto do aceite do produtor, versão 2026-10-07 (Decisão 6: texto novo = versão nova, aqui e em _shared/tipoEvento.ts).
-- Muda só a função aceite_evento_versao(). Ajustes pedidos pelo Ricardo, como jurídico, em 07/10/2026:
--   1. item 2: a autoclassificação é provisória e pode ser revista pelo MJSP; a responsabilidade segue com o produtor;
--   3. item 3: regras de acesso da faixa etária e determinações da autoridade judiciária competente (sem a lista
--      universal de "autorização por escrito");
--   5. última linha: diz a finalidade do registro de IP e navegador (prova do aceite).
-- EFEITO: os aceites gravados com a versão 2026-10-04 deixam de valer para publicar (o gatilho exige a versão atual):
-- eventos ainda em rascunho ou recusados pedem o aceite de novo. Evento já publicado não é afetado.
-- ORDEM: mesclar o PR (a Vercel publica o front com a versão nova), rodar este SQL e publicar a Edge Function
-- aceite-evento, um logo depois do outro: entre as três pontas a versão difere e o aceite responde 409.
-- Como aplicar: colar inteiro no SQL Editor (UTF-8 via pbcopy, nunca TextEdit). Uma transação, idempotente.
-- NÃO mover para supabase/migrations/.
-- =============================================================================
begin;
set local lock_timeout = '5s';

do $$
begin
  if to_regprocedure('public.aceite_evento_versao()') is null then
    raise exception 'aceite_evento_versao() não existe: aplicar antes 20261009_f1a_tipo_evento.sql';
  end if;
end $$;

create or replace function public.aceite_evento_versao()
returns text
language sql
immutable
set search_path = ''
as $$ select '2026-10-07' $$;

do $$
begin
  if public.aceite_evento_versao() <> '2026-10-07' then
    raise exception 'aceite_evento_versao() não devolveu 2026-10-07';
  end if;
  if has_function_privilege('anon', 'public.aceite_evento_versao()', 'execute') then
    raise exception 'EXECUTE de aceite_evento_versao não pode estar liberado para anon';
  end if;
  if not has_function_privilege('service_role', 'public.aceite_evento_versao()', 'execute') then
    raise exception 'service_role perdeu o EXECUTE de aceite_evento_versao (a Edge Function precisa dele)';
  end if;
end $$;

commit;
