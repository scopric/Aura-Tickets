-- Ensaio de docs/sql/20261101b_certificado_revogar.sql (25 casos). Só em banco local DESCARTÁVEL (nunca produção), com 20261031e, 20261101a e 20261101b aplicados, o
-- desenho de produção reproduzido (índice único total antes, regra de DELETE do produtor, grants de tabela como em produção: SELECT/UPDATE/DELETE inteiros e INSERT só em certificate_id e user_id, gf_mfa_ok stub com app.mfa) e stubs das tabelas. Rodado em 09/10/2026: TODOS OS 25 CASOS OK.
-- Limite: sem a RLS real das outras tabelas; as funções são security definer.
do $$
declare
  O uuid := 'fe000000-0000-4000-8000-000000000001'; P uuid := 'fe000000-0000-4000-8000-000000000002'; X uuid := 'fe000000-0000-4000-8000-000000000003';
  E uuid := 'fe000000-0000-4000-8000-0000000000e1'; C uuid := 'fe000000-0000-4000-8000-0000000000c1';
  COD text := 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'; COD2 text := 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'; ID1 uuid; ID2 uuid; r jsonb; t1 timestamptz;
begin
  insert into auth.users values (O, 'org@x.local'), (P, 'part@x.local'), (X, 'outro@x.local');
  insert into public.producer_profiles values (O, 'Produtora X');
  insert into public.events values (E, O, 'Workshop de Teste', '2026-12-12 20:00:00+00', 'approved');
  insert into public.certificates (id, event_id, template) values (C, E, '{"horas":"8"}');
  insert into public.issued_certificates (certificate_id, user_id, code) values (C, P, COD) returning id into ID1;
  insert into public.tickets (event_id, user_id, buyer_name, status) values (E, P, 'Maria Participante', 'active');

  -- antes de revogar
  assert public.certificado_validar(COD) ->> 'valido' = 'true' and not (public.certificado_validar(COD) ? 'revogado'), 'T1 ativo valida e não tem a chave revogado';
  assert (select array_agg(k order by k) from jsonb_object_keys(public.certificado_validar(COD)) k) = array['data_evento','emitido_em','evento','horas','nome','organizador','valido'], 'T2 chaves do válido iguais às de antes';
  assert public.certificado_ver(COD) ->> 'valido' = 'true' and public.certificado_ver(COD) ? 'modelo', 'T3 ver igual a antes';

  -- permissões e dono
  perform set_config('request.jwt.claim.sub', O::text, false); perform set_config('app.mfa', 'on', false);
  set role anon; begin perform public.certificado_revogar(ID1); assert false, 'T4 anon revogou'; exception when insufficient_privilege then null; end; reset role;
  perform set_config('request.jwt.claim.sub', X::text, false); set role authenticated;
  begin perform public.certificado_revogar(ID1); assert false, 'T5 outro produtor revogou'; exception when insufficient_privilege then null; end;
  begin perform public.certificado_revogar(gen_random_uuid()); assert false, 'T6 id inexistente deveria dar o mesmo erro'; exception when insufficient_privilege then null; end; reset role;
  perform set_config('request.jwt.claim.sub', '', false); set role authenticated;
  begin perform public.certificado_revogar(ID1); assert false, 'T7 sem sessão revogou'; exception when insufficient_privilege then null; end; reset role;
  perform set_config('request.jwt.claim.sub', O::text, false); perform set_config('app.mfa', 'off', false); set role authenticated;
  begin perform public.certificado_revogar(ID1); assert false, 'T8 sem 2FA revogou'; exception when insufficient_privilege then null; end; reset role;
  assert (select revoked_at from public.issued_certificates where id = ID1) is null, 'T9 nada foi revogado pelas tentativas negadas';

  -- revoga como dono
  perform set_config('app.mfa', 'on', false); set role authenticated;
  perform public.certificado_revogar(ID1); reset role;
  select revoked_at into t1 from public.issued_certificates where id = ID1;
  assert t1 is not null and (select revoked_by from public.issued_certificates where id = ID1) = O, 'T10 marcou quando e quem';
  r := public.certificado_validar(COD);
  assert r = jsonb_build_object('valido', false, 'revogado', true, 'revogado_em', to_char(t1 at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')), 'T11 validar diz revogado e quando: '||r::text;
  assert public.certificado_ver(COD) = r, 'T12 ver devolve o mesmo, sem nome, evento nem modelo';
  assert not (r ? 'nome' or r ? 'evento' or r ? 'organizador'), 'T13 revogado não traz dado pessoal';
  set role authenticated; perform public.certificado_revogar(ID1); reset role;
  assert (select revoked_at from public.issued_certificates where id = ID1) = t1, 'T14 revogar de novo mantém a data original';

  -- reemitir para a mesma pessoa
  insert into public.issued_certificates (certificate_id, user_id, code) values (C, P, COD2) returning id into ID2;
  assert public.certificado_validar(COD2) ->> 'valido' = 'true', 'T15 o novo certificado valida';
  assert (public.certificado_validar(COD) ->> 'revogado') = 'true', 'T16 o antigo segue revogado';
  begin insert into public.issued_certificates (certificate_id, user_id, code) values (C, P, 'cccccccc-3333-4333-8333-cccccccccccc'); assert false, 'T17 dois ativos para a mesma pessoa'; exception when unique_violation then null; end;
  assert (select count(*) from public.issued_certificates where certificate_id = C and user_id = P) = 2, 'T18 o histórico ficou (2 linhas)';

  -- os outros casos inválidos continuam iguais
  update public.events set approval_status = 'pending' where id = E;
  assert public.certificado_validar(COD) = '{"valido": false}', 'T19 revogado de evento não aprovado: igual a inválido, sem a chave revogado';
  update public.events set approval_status = 'approved' where id = E;
  update public.tickets set status = 'refunded';
  assert public.certificado_validar(COD) = '{"valido": false}', 'T20 revogado de titular sem ingresso: igual a inválido';
  update public.tickets set status = 'active';

  -- o produtor não apaga mais pela API
  assert not exists (select 1 from pg_policies where schemaname='public' and tablename='issued_certificates' and cmd = 'DELETE' and policyname <> 'gf_mfa_aal2'), 'T21 regra de DELETE saiu';
  assert has_function_privilege('authenticated','public.certificado_revogar(uuid)','execute') and not has_function_privilege('anon','public.certificado_revogar(uuid)','execute'), 'T22 permissões da função';
  -- ataque direto pela API como o produtor dono: nem alterar, nem apagar, nem inserir já revogado
  perform set_config('request.jwt.claim.sub', O::text, false); perform set_config('app.mfa', 'on', false); set role authenticated;
  begin update public.issued_certificates set revoked_at = null where id = ID1; assert false, 'T23 produtor desfez a revogação'; exception when insufficient_privilege then null; end;
  begin delete from public.issued_certificates where id = ID1; assert false, 'T24 produtor apagou o histórico'; exception when insufficient_privilege then null; end;
  begin insert into public.issued_certificates (certificate_id, user_id, revoked_at) values (C, X, now()); assert false, 'T25 produtor inseriu já revogado'; exception when insufficient_privilege then null; end;
  reset role;
  raise notice 'TODOS OS 25 CASOS OK';
end $$;
