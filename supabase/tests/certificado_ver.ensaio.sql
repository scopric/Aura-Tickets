-- Ensaio de docs/sql/20261101a_certificado_ver_e_envio.sql. Só em banco local DESCARTÁVEL (nunca produção), com 20261031e e 20261101a já aplicados e stubs mínimos
-- (auth.users, profiles, producer_profiles, events, certificates, issued_certificates, tickets). Rodado em 09/10/2026: TODOS OS CASOS OK, SQL aplicado 2x sem erro.
-- Limite: sem a RLS real das tabelas; a função é security definer e não depende dela.
do $$
declare
  O uuid := 'fe000000-0000-4000-8000-000000000001'; P uuid := 'fe000000-0000-4000-8000-000000000002';
  E uuid := 'fe000000-0000-4000-8000-0000000000e1'; C uuid := 'fe000000-0000-4000-8000-0000000000c1';
  COD text := 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'; r jsonb;
begin
  insert into auth.users values (O, 'org@x.local'), (P, 'part@x.local');
  insert into public.producer_profiles values (O, 'Produtora X');
  insert into public.events values (E, O, 'Workshop de Teste', '2026-12-12 20:00:00+00', 'approved');
  insert into public.certificates (id, event_id, template) values (C, E, '{"selectedTemplate":"classic","accentColor":"#1d68c4","fields":[{"id":"title","type":"text"}],"logoUrl":"https://x/l.png","sigUrl":null,"horas":"8","segredo":"NAO-SAI","outro":{"a":1}}');
  insert into public.issued_certificates (certificate_id, user_id, code) values (C, P, COD);
  insert into public.tickets (event_id, user_id, buyer_name, status) values (E, P, 'Maria Participante', 'active');

  r := public.certificado_ver(COD);
  assert r ->> 'valido' = 'true', 'T1 válido';
  assert r ->> 'nome' = 'Maria Participante' and r ->> 'evento' = 'Workshop de Teste', 'T2 mesmos campos do validar';
  assert r ->> 'codigo' = COD, 'T3 codigo';
  assert (select array_agg(k order by k) from jsonb_object_keys(r -> 'modelo') k) = array['accentColor','fields','horas','logoUrl','selectedTemplate'], 'T4 só chaves conhecidas do modelo (sigUrl nulo some; "segredo" e "outro" não saem): '||(r->'modelo')::text;
  assert (select array_agg(k order by k) from jsonb_object_keys(r) k) = array['codigo','data_evento','emitido_em','evento','horas','modelo','nome','organizador','valido'], 'T5 chaves da resposta';
  assert public.certificado_ver(upper(COD)) ->> 'valido' = 'true', 'T6 maiúsculas valem';
  assert public.certificado_ver(upper(COD)) ->> 'codigo' = COD, 'T7 codigo sai em minúsculas';
  assert public.certificado_ver('bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb') = '{"valido": false}', 'T8 inexistente';
  assert public.certificado_ver('lixo') = '{"valido": false}' and public.certificado_ver(null) = '{"valido": false}', 'T9 malformado e nulo';
  assert not (public.certificado_ver('bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb') ? 'modelo'), 'T10 inválido não leva modelo';

  update public.events set approval_status = 'pending' where id = E;
  assert public.certificado_ver(COD) = '{"valido": false}', 'T11 evento não aprovado: igual a inválido';
  update public.events set approval_status = 'approved' where id = E;
  update public.tickets set status = 'refunded' where event_id = E;
  assert public.certificado_ver(COD) = '{"valido": false}', 'T12 titular sem ingresso válido';
  update public.tickets set status = 'active' where event_id = E;

  update public.certificates set template = jsonb_build_object('fields', jsonb_build_array(repeat('x', 3100000))) where id = C;
  r := public.certificado_ver(COD);
  assert r ->> 'valido' = 'true' and jsonb_typeof(r -> 'modelo') = 'null', 'T13 modelo grande demais não sai, a validação continua: '||left(r::text,120);
  update public.certificates set template = '[]'::jsonb where id = C;
  r := public.certificado_ver(COD);
  assert r ->> 'valido' = 'true' and jsonb_typeof(r -> 'modelo') = 'null', 'T14 template que não é objeto: modelo nulo';

  -- permissões
  set role anon;
  assert public.certificado_ver(COD) ->> 'valido' = 'true', 'T15 anon executa';
  begin perform 1 from public.certificate_email_logs; assert false, 'T16 anon leu o log'; exception when insufficient_privilege then null; end;
  reset role; set role authenticated;
  begin perform 1 from public.certificate_email_logs; assert false, 'T17 authenticated leu o log'; exception when insufficient_privilege then null; end;
  begin insert into public.certificate_email_logs (issued_certificate_id, producer_id, status) values (gen_random_uuid(), O, 'sent'); assert false, 'T18 authenticated gravou'; exception when insufficient_privilege then null; end;
  reset role;
  -- log: status e cascata
  begin insert into public.certificate_email_logs (issued_certificate_id, producer_id, status) select id, O, 'enviado' from public.issued_certificates; assert false, 'T19 status inválido aceito'; exception when check_violation then null; end;
  insert into public.certificate_email_logs (issued_certificate_id, producer_id, status) select id, O, 'pending' from public.issued_certificates;
  delete from public.issued_certificates;
  assert (select count(*) from public.certificate_email_logs) = 0, 'T20 apagar o certificado apaga o log (cascata)';
  raise notice 'TODOS OS 20 CASOS OK';
end $$;
