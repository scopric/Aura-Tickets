-- Ensaio de docs/sql/20261031_produtor_logo.sql (21 casos). Só em banco local DESCARTÁVEL (nunca produção), com o SQL já aplicado.
-- Rodado em 08/10/2026 num Postgres 17 com stubs mínimos (auth.uid, storage.buckets/objects, producer_profiles): TODOS OS 21 CASOS OK, SQL aplicado 2x sem erro.
-- Teto de 20 por 24 h: o stub de storage.objects precisa de created_at timestamptz default now() (alter table storage.objects add column if not exists created_at timestamptz default now()).
-- Limite do ensaio: sem a regra restritiva gf_mfa_aal2 e sem o Storage real; o que isso muda só aparece em produção (conferir lá).
create or replace function pg_temp.erro(q text) returns text language plpgsql as $$ begin execute q; return 'passou'; exception when others then return sqlstate; end $$;
create or replace function pg_temp.como(uid text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', uid, false); end $$;
grant execute on function pg_temp.erro(text), pg_temp.como(text) to public;
do $$
declare A text := 'aaaaaaaa-0000-0000-0000-000000000001'; B text := 'bbbbbbbb-0000-0000-0000-000000000002'; r text; i int;
  ins text := $f$insert into storage.objects (bucket_id,name,metadata) values ('logos-produtor', %L, jsonb_build_object('mimetype',%L,'contentLength',%s))$f$;
begin
  perform pg_temp.como(A); set role authenticated;
  r := pg_temp.erro(format(ins, A||'/abcdefgh12345.png','image/png',50000));           assert r='passou', 'T1 dono envia png: '||r;
  r := pg_temp.erro(format(ins, A||'/abcdefgh12346.webp','image/webp',50000));         assert r='passou', 'T2 webp: '||r;
  r := pg_temp.erro(format(ins, B||'/abcdefgh12347.png','image/png',50000));           assert r='42501', 'T3 pasta de outro: '||r;
  r := pg_temp.erro(format(ins, 'abcdefgh12348.png','image/png',50000));               assert r='42501', 'T4 sem pasta: '||r;
  r := pg_temp.erro(format(ins, A||'/../'||B||'/abcdefgh1.png','image/png',50000));    assert r='42501', 'T5 traversal: '||r;
  r := pg_temp.erro(format(ins, A||'/abcdefgh12349.svg','image/svg+xml',50000));       assert r='42501', 'T6 svg: '||r;
  r := pg_temp.erro(format(ins, A||'/abcdefgh12350.png','image/gif',50000));           assert r='42501', 'T7 mime errado: '||r;
  r := pg_temp.erro(format(ins, A||'/abcdefgh12351.png','image/png',2000000));         assert r='42501', 'T8 grande: '||r;
  r := pg_temp.erro(format(ins, A||'/abcdefgh12352.png','image/png',0));               assert r='42501', 'T9 vazio: '||r;
  r := pg_temp.erro(format(ins, A||'/abc.png','image/png',50000));                     assert r='42501', 'T10 nome curto: '||r;
  reset role;
  -- produtor sem perfil (B) e anônimo
  perform pg_temp.como(B); set role authenticated;
  r := pg_temp.erro(format(ins, B||'/abcdefgh12353.png','image/png',50000));           assert r='42501', 'T11 sem perfil de produtor: '||r;
  reset role; perform pg_temp.como(''); set role anon;
  r := pg_temp.erro(format(ins, A||'/abcdefgh12354.png','image/png',50000));           assert r='42501', 'T12 anon: '||r;
  reset role;
  -- teto de 20
  perform pg_temp.como(A); set role authenticated;
  for i in 3..20 loop r := pg_temp.erro(format(ins, A||'/limite'||lpad(i::text,6,'0')||'.png','image/png',1000)); assert r='passou', 'T13 até 20 (#'||i||'): '||r; end loop;
  r := pg_temp.erro(format(ins, A||'/limite999999.png','image/png',1000));             assert r='42501', 'T14 21º arquivo: '||r;
  reset role;
  -- arquivos com mais de 24 h não contam: o produtor destrava sozinho
  update storage.objects set created_at = now() - interval '2 days' where bucket_id = 'logos-produtor';
  perform pg_temp.como(A); set role authenticated;
  r := pg_temp.erro(format(ins, A||'/novodia00001.png','image/png',1000));             assert r='passou', 'T14b depois de 24 h volta a enviar: '||r;
  reset role;
  -- coluna logo_url
  r := pg_temp.erro(format($f$update public.producer_profiles set logo_url=%L where id=%L$f$, 'https://rwaezeqyuhxrssntcxdv.supabase.co/storage/v1/object/public/logos-produtor/'||A||'/abcdefgh12345.png', A)); assert r='passou', 'T15 URL certa: '||r;
  r := pg_temp.erro(format($f$update public.producer_profiles set logo_url=%L where id=%L$f$, 'https://rwaezeqyuhxrssntcxdv.supabase.co/storage/v1/object/public/logos-produtor/'||B||'/abcdefgh12345.png', A)); assert r='23514', 'T16 pasta de outro produtor: '||r;
  r := pg_temp.erro(format($f$update public.producer_profiles set logo_url=%L where id=%L$f$, 'https://evil.example/logo.png', A)); assert r='23514', 'T17 outro domínio: '||r;
  r := pg_temp.erro(format($f$update public.producer_profiles set logo_url=%L where id=%L$f$, 'https://rwaezeqyuhxrssntcxdv.supabase.co/storage/v1/object/public/capas-eventos/'||A||'/abcdefgh12345.png', A)); assert r='23514', 'T18 outro bucket: '||r;
  r := pg_temp.erro(format($f$update public.producer_profiles set logo_url=%L where id=%L$f$, 'https://rwaezeqyuhxrssntcxdv.supabase.co/storage/v1/object/public/logos-produtor/'||A||'/abcdefgh1.png?x=1', A)); assert r='23514', 'T19 query string: '||r;
  r := pg_temp.erro(format($f$update public.producer_profiles set logo_url=null where id=%L$f$, A)); assert r='passou', 'T20 remover (nulo): '||r;
  raise notice 'TODOS OS 21 CASOS OK';
end $$;
