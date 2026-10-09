-- Ensaio de docs/sql/20261101c_certificado_ver_corta_imagens.sql (13 casos). Só em banco local DESCARTÁVEL (nunca produção), com 20261031e, 20261101a, 20261101b e
-- 20261101c aplicados e os mesmos stubs mínimos de certificado_revogar.ensaio.sql (auth.users, profiles, producer_profiles, events, certificates,
-- issued_certificates com revoked_at, tickets, gf_mfa_ok). Limite: sem a RLS real das tabelas; a função é security definer.
set plpgsql.check_asserts = on;
do $$
declare
  O uuid := 'fe000000-0000-4000-8000-000000000001'; P uuid := 'fe000000-0000-4000-8000-000000000002';
  E uuid := 'fe000000-0000-4000-8000-0000000000e1'; C uuid := 'fe000000-0000-4000-8000-0000000000c1';
  COD text := 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'; r jsonb; base jsonb;
begin
  insert into auth.users values (O, 'org@x.local'), (P, 'part@x.local');
  insert into public.producer_profiles values (O, 'Produtora X');
  insert into public.events values (E, O, 'Workshop de Teste', '2026-12-12 20:00:00+00', 'approved');
  base := '{"selectedTemplate":"classic","accentColor":"#1d68c4","fields":[{"id":"title","type":"text"}],"horas":"8"}';
  insert into public.certificates (id, event_id, template) values (C, E, base || jsonb_build_object('logoUrl', repeat('a', 1000000), 'sigUrl', repeat('b', 1000000)));
  insert into public.issued_certificates (certificate_id, user_id, code) values (C, P, COD);
  insert into public.tickets (event_id, user_id, buyer_name, status) values (E, P, 'Maria Participante', 'active');

  r := public.certificado_ver(COD);
  assert length(r -> 'modelo' ->> 'logoUrl') = 1000000 and length(r -> 'modelo' ->> 'sigUrl') = 1000000, 'T1 imagens de 1.000.000 saem inteiras';

  update public.certificates set template = base || jsonb_build_object('logoUrl', repeat('a', 1500000), 'sigUrl', repeat('b', 1400000)) where id = C;
  r := public.certificado_ver(COD);
  assert length(r -> 'modelo' ->> 'logoUrl') = 1500000 and length(r -> 'modelo' ->> 'sigUrl') = 1400000, 'T2 no teto exato (1.500.000) ainda sai';

  update public.certificates set template = base || jsonb_build_object('logoUrl', repeat('a', 1500001)) where id = C;
  assert not (public.certificado_ver(COD) -> 'modelo' ? 'logoUrl'), 'T2b 1.500.001 já some (borda do >)';

  update public.certificates set template = base || jsonb_build_object('logoUrl', repeat('a', 1600000), 'sigUrl', repeat('b', 1000000)) where id = C;
  r := public.certificado_ver(COD);
  assert not (r -> 'modelo' ? 'logoUrl') and length(r -> 'modelo' ->> 'sigUrl') = 1000000, 'T3 logo de 1.600.000 some, assinatura de 1.000.000 fica';
  assert r -> 'modelo' ->> 'selectedTemplate' = 'classic' and r -> 'modelo' ->> 'accentColor' = '#1d68c4' and r -> 'modelo' ->> 'horas' = '8' and r -> 'modelo' -> 'fields' is not null, 'T4 demais chaves do modelo intactas';
  assert r ->> 'valido' = 'true' and r ->> 'nome' = 'Maria Participante' and r ->> 'evento' = 'Workshop de Teste', 'T5 validação não muda';

  update public.certificates set template = base || jsonb_build_object('logoUrl', repeat('a', 1000000), 'sigUrl', repeat('b', 1600000)) where id = C;
  r := public.certificado_ver(COD);
  assert length(r -> 'modelo' ->> 'logoUrl') = 1000000 and not (r -> 'modelo' ? 'sigUrl'), 'T6 assinatura de 1.600.000 some, logo de 1.000.000 fica';

  update public.certificates set template = base || jsonb_build_object('logoUrl', repeat('a', 1600000), 'sigUrl', repeat('b', 1600000)) where id = C;
  r := public.certificado_ver(COD);
  assert not (r -> 'modelo' ? 'logoUrl') and not (r -> 'modelo' ? 'sigUrl') and r -> 'modelo' ? 'fields', 'T7 as duas grandes somem, o modelo continua';
  assert octet_length(r::text) < 2000, 'T8 resposta pequena sem as imagens: '||octet_length(r::text);

  update public.certificates set template = base || jsonb_build_object('logoUrl', repeat('a', 1500000), 'sigUrl', repeat('b', 1500000), 'fields', jsonb_build_array(repeat('x', 100000))) where id = C;
  r := public.certificado_ver(COD);
  assert jsonb_typeof(r -> 'modelo') = 'null' and r ->> 'valido' = 'true', 'T9 teto geral de ~3 MB continua (modelo nulo, validação segue)';

  update public.certificates set template = base || '{"logoUrl":123,"sigUrl":{"a":1}}' where id = C;
  r := public.certificado_ver(COD);
  assert (r -> 'modelo' ->> 'logoUrl') = '123' and r -> 'modelo' -> 'sigUrl' = '{"a":1}', 'T10 valor que não é texto passa como antes (o front o descarta)';

  update public.certificates set template = base || jsonb_build_object('logoUrl', repeat('a', 1600000)) where id = C;
  update public.issued_certificates set revoked_at = now(), revoked_by = O;
  r := public.certificado_ver(COD);
  assert (select array_agg(k order by k) from jsonb_object_keys(r) k) = array['revogado','revogado_em','valido'] and r ->> 'valido' = 'false', 'T11 revogado continua só {valido, revogado, revogado_em}: '||r::text;

  update public.issued_certificates set revoked_at = null, revoked_by = null;
  set role anon;
  assert public.certificado_ver(COD) ->> 'valido' = 'true', 'T12 anon executa';
  reset role;
  raise notice 'TODOS OS 13 CASOS OK';
end $$;
