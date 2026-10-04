-- pgTAP da S9/PR1 do admin (docs/sql/20261019_admin_s9_reautenticar.sql, Decisão 163 item 12): reautenticação recente para dinheiro.
-- Só em banco descartável: baseline + docs/sql até o estado de produção + S3 (20261014) + S5 (20261016) + o da S9 e rodar este
-- arquivo (psql -f ou `supabase test db`). Tudo em begin ... rollback. Nunca contra produção.
-- pg_temp.como(papel, id, aal, idade, metodo) troca papel e claims do JWT como o PostgREST; em aal2 com `idade` (segundos) o amr leva
-- um login por senha de 1 h atrás e o `metodo` ('totp' por padrão) digitado há `idade` segundos. pg_temp.recusa(sql) = true se
-- falhar com 42501 e hint 'reautenticar'; pg_temp.passa(sql) = 'ok' ou o erro (sqlstate e mensagem).
-- Contas: super (super_admin), adm_fin (manage_finance), adm_wa (admin com fator que NÃO é TOTP), adm_nv (TOTP não confirmado),
-- col (admin com ficha em staff_profiles), p1 (produtor dono), p3 (produtor sem perfil), comum.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(71);

create function pg_temp.como(p_role text, p uuid default null, p_aal text default 'aal1', p_idade int default null,
  p_metodo text default 'totp') returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', case when p_role = 'postgres' then '' else json_strip_nulls(json_build_object(
    'role', p_role, 'sub', p, 'aal', case when p is not null then p_aal end,
    'amr', case when p_idade is not null then json_build_array(
      json_build_object('method', 'password', 'timestamp', extract(epoch from now())::bigint - 3600),
      json_build_object('method', p_metodo, 'timestamp', extract(epoch from now())::bigint - p_idade)) end))::text end, true);
  perform set_config('role', case when p_role = 'postgres' then 'none' else p_role end, true);
end $f$;
-- claims à mão (amr malformado, sem amr etc.)
create function pg_temp.claims(p text) returns void language plpgsql as $f$
begin perform set_config('request.jwt.claims', p, true); perform set_config('role', 'authenticated', true); end $f$;
create function pg_temp.recusa(p text) returns boolean language plpgsql as $f$
declare h text; s text;
begin
  begin execute p; return false;
  exception when others then
    get stacked diagnostics h = pg_exception_hint;
    s := sqlstate;
    return s = '42501' and h = 'reautenticar';
  end;
end $f$;
create function pg_temp.passa(p text) returns text language plpgsql as $f$
begin
  begin execute p; return 'ok';
  exception when others then return sqlstate || ' ' || sqlerrm;
  end;
end $f$;
-- 'ok' = passou; senão sqlstate, hint e mensagem (para conferir que o erro é o de permissão, não o pedido de código)
create function pg_temp.erro(p text) returns text language plpgsql as $f$
declare h text;
begin
  begin execute p; return 'ok';
  exception when others then
    get stacked diagnostics h = pg_exception_hint;
    return sqlstate || '|' || coalesce(h, '') || '|' || sqlerrm;
  end;
end $f$;
grant execute on function pg_temp.como(text, uuid, text, int, text), pg_temp.claims(text), pg_temp.recusa(text), pg_temp.passa(text),
  pg_temp.erro(text) to anon, authenticated, service_role;
grant execute on all functions in schema extensions to anon, authenticated, service_role;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('d9000000-0000-4000-8000-000000000001', 'super@teste-s9.local', now(), '{"full_name":"super"}'),
  ('d9000000-0000-4000-8000-000000000002', 'adm_fin@teste-s9.local', now(), '{"full_name":"adm_fin"}'),
  ('d9000000-0000-4000-8000-000000000003', 'adm_wa@teste-s9.local', now(), '{"full_name":"adm_wa"}'),
  ('d9000000-0000-4000-8000-000000000004', 'adm_nv@teste-s9.local', now(), '{"full_name":"adm_nv"}'),
  ('d9000000-0000-4000-8000-000000000005', 'col@teste-s9.local', now(), '{"full_name":"col"}'),
  ('d9000000-0000-4000-8000-000000000006', 'p1@teste-s9.local', now(), '{"full_name":"p1"}'),
  ('d9000000-0000-4000-8000-000000000007', 'p3@teste-s9.local', now(), '{"full_name":"p3"}'),
  ('d9000000-0000-4000-8000-000000000008', 'comum@teste-s9.local', now(), '{"full_name":"comum"}');
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at) values
  ('d9000000-0000-4000-9000-0000000000f1', 'd9000000-0000-4000-8000-000000000001', 'teste', 'totp', 'verified', now(), now()),
  ('d9000000-0000-4000-9000-0000000000f2', 'd9000000-0000-4000-8000-000000000002', 'teste', 'totp', 'verified', now(), now()),
  ('d9000000-0000-4000-9000-0000000000f3', 'd9000000-0000-4000-8000-000000000003', 'teste', 'webauthn', 'verified', now(), now()),
  ('d9000000-0000-4000-9000-0000000000f4', 'd9000000-0000-4000-8000-000000000004', 'teste', 'totp', 'unverified', now(), now()),
  ('d9000000-0000-4000-9000-0000000000f5', 'd9000000-0000-4000-8000-000000000005', 'teste', 'totp', 'verified', now(), now());
update public.profiles set role = 'admin', admin_permissions = array['super_admin']::text[] where id = 'd9000000-0000-4000-8000-000000000001';
update public.profiles set role = 'admin', admin_permissions = array['manage_finance']::text[] where id = 'd9000000-0000-4000-8000-000000000002';
-- o gatilho de profiles não deixa promover sem fator TOTP: adm_wa e adm_nv são promovidos pelo dono do banco (emergência) e ficam sem TOTP confirmado
update public.profiles set role = 'admin', admin_permissions = array['super_admin']::text[] where id = 'd9000000-0000-4000-8000-000000000003';
update public.profiles set role = 'admin', admin_permissions = array['manage_finance']::text[] where id = 'd9000000-0000-4000-8000-000000000004';
update public.profiles set role = 'admin', admin_permissions = array['manage_users']::text[] where id = 'd9000000-0000-4000-8000-000000000005';
insert into public.producer_profiles (id, company_name, pix_key, bank_account, cnpj) values
  ('d9000000-0000-4000-8000-000000000006', 'Paula Eventos', 'p1@pix', '{"banco":"341"}', '11222333000181');
insert into public.withdrawals (id, producer_id, amount) values
  ('d9000000-0000-4000-8000-0000000000d1', 'd9000000-0000-4000-8000-000000000006', 50),
  ('d9000000-0000-4000-8000-0000000000d2', 'd9000000-0000-4000-8000-000000000006', 60),
  ('d9000000-0000-4000-8000-0000000000d3', 'd9000000-0000-4000-8000-000000000006', 70),
  ('d9000000-0000-4000-8000-0000000000d4', 'd9000000-0000-4000-8000-000000000006', 80);
insert into public.platform_settings (key, value) values ('general', '{"a":1}'), ('fees', '{"taxa":10}'), ('fees_teste', '{"x":1}');
insert into public.staff_profiles (user_id, email, cargo, nome_completo, cpf, rg, data_nascimento, cep, rua, numero, bairro, cidade, uf,
  email_secundario, telefone, whatsapp, emergencia_nome, emergencia_parentesco, emergencia_telefone, pix_tipo, pix_chave) values
  ('d9000000-0000-4000-8000-000000000005', 'col@teste-s9.local', 'Analista', 'Clara Teste', '52998224725', '123456789', '1990-01-01',
   '01001000', 'Rua A', '1', 'Centro', 'São Paulo', 'SP', 'col2@teste-s9.local', '+5511900000000', '+5511900000000',
   'Pai Teste', 'Pai', '+5511900000001', 'email', 'col@teste-s9.local');

-- A. gf_reauth_recente: aal2 e um TOTP dentro da janela --------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'public.gf_reauth_recente(int)', 'execute')
  and has_function_privilege('authenticated', 'public.gf_reauth_recente(int)', 'execute')
  and has_function_privilege('service_role', 'public.gf_reauth_recente(int)', 'execute'), 'gf_reauth_recente: authenticated e service_role executam, anon não');
select pg_temp.como('authenticated', 'd9000000-0000-4000-8000-000000000001', 'aal2', 10);
select is(public.gf_reauth_recente(300), true, 'TOTP de 10 s atrás: recente');
select pg_temp.como('authenticated', 'd9000000-0000-4000-8000-000000000001', 'aal2', 299);
select is(public.gf_reauth_recente(300), true, 'TOTP de 299 s atrás: ainda dentro de 300 s');
select pg_temp.como('authenticated', 'd9000000-0000-4000-8000-000000000001', 'aal2', 301);
select is(public.gf_reauth_recente(300), false, 'TOTP de 301 s atrás: fora de 300 s');
select pg_temp.como('authenticated', 'd9000000-0000-4000-8000-000000000001', 'aal2', 3600);
select is(public.gf_reauth_recente(300), false, 'TOTP de 1 h atrás (amr antigo): não');
select is(public.gf_reauth_recente(7200), true, 'a mesma sessão passa se a janela pedida for de 2 h');
select is(public.gf_reauth_recente(null), false, 'janela nula: não');
select pg_temp.como('authenticated', 'd9000000-0000-4000-8000-000000000001', 'aal2', 10, 'mfa/recovery_code');
select is(public.gf_reauth_recente(300), false, 'código de recuperação recente: NÃO conta');
select pg_temp.como('authenticated', 'd9000000-0000-4000-8000-000000000001', 'aal2', 10, 'password');
select is(public.gf_reauth_recente(300), false, 'só senha recente: não');
select pg_temp.como('authenticated', 'd9000000-0000-4000-8000-000000000001', 'aal1', 10);
select is(public.gf_reauth_recente(300), false, 'aal1 com amr de TOTP recente: não (aal2 é exigido)');
select pg_temp.como('authenticated', 'd9000000-0000-4000-8000-000000000001', 'aal2');
select is(public.gf_reauth_recente(300), false, 'aal2 sem amr no token: não');
select pg_temp.claims('{"role":"authenticated","sub":"d9000000-0000-4000-8000-000000000001","aal":"aal2","amr":"totp"}');
select is(public.gf_reauth_recente(300), false, 'amr que não é lista: não, sem erro');
select pg_temp.claims('{"role":"authenticated","sub":"d9000000-0000-4000-8000-000000000001","aal":"aal2","amr":[{"method":"totp","timestamp":"ontem"},"totp",{"method":"totp"}]}');
select is(public.gf_reauth_recente(300), false, 'timestamp que não é número ou ausente: não, sem erro');
select pg_temp.como('anon');
select throws_ok('select public.gf_reauth_recente(300)', '42501', null, 'anon não executa gf_reauth_recente');

-- B. Funções de admin exigem fator TOTP confirmado -------------------------------------------------------------------------
select pg_temp.como('authenticated', 'd9000000-0000-4000-8000-000000000001', 'aal2', 10);
select ok(public.gf_is_admin() and public.gf_admin_can('manage_finance') and public.gf_admin_can_any(array['manage_users']) and public.gf_tem_2fa('d9000000-0000-4000-8000-000000000001'),
  'admin com TOTP verificado em aal2: gf_is_admin, gf_admin_can, gf_admin_can_any e gf_tem_2fa verdadeiros');
select pg_temp.como('authenticated', 'd9000000-0000-4000-8000-000000000003', 'aal2', 10);
select ok(not public.gf_is_admin() and not public.gf_admin_can('super_admin') and not public.gf_admin_can_any(array['super_admin'])
  and public.gf_tem_2fa('d9000000-0000-4000-8000-000000000003') is not true,
  'admin só com fator webauthn verificado (aal2): não é admin, em nenhuma das quatro');
select pg_temp.como('authenticated', 'd9000000-0000-4000-8000-000000000004', 'aal2', 10);
select ok(not public.gf_is_admin() and not public.gf_admin_can('manage_finance'), 'admin com TOTP não confirmado: não é admin');
select pg_temp.como('authenticated', 'd9000000-0000-4000-8000-000000000003', 'aal1');
select is(public.gf_mfa_ok(), false, 'gf_mfa_ok não mudou: quem tem fator confirmado de qualquer tipo precisa de aal2 (webauthn em aal1: false)');
select pg_temp.como('authenticated', 'd9000000-0000-4000-8000-000000000004', 'aal1');
select is(public.gf_mfa_ok(), true, 'gf_mfa_ok não mudou: fator não confirmado não exige aal2');
select is(md5(pg_get_functiondef('public.gf_mfa_ok()'::regprocedure)), '947db8951761c72a522732b008891fac', 'gf_mfa_ok com o md5 de produção');

-- C. withdrawals: status ----------------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', 'd9000000-0000-4000-8000-000000000002', 'aal2', 3600);
select ok(pg_temp.recusa($$update public.withdrawals set status = 'completed' where id = 'd9000000-0000-4000-8000-0000000000d1'$$),
  'saque: status sem código recente (amr antigo) é recusado com 42501 e hint reautenticar');
select is((select status from public.withdrawals where id = 'd9000000-0000-4000-8000-0000000000d1'), 'pending', 'saque: nada gravou');
select pg_temp.como('authenticated', 'd9000000-0000-4000-8000-000000000002', 'aal2');
select ok(pg_temp.recusa($$update public.withdrawals set status = 'completed' where id = 'd9000000-0000-4000-8000-0000000000d1'$$),
  'saque: status em aal2 sem amr é recusado');
select pg_temp.como('authenticated', 'd9000000-0000-4000-8000-000000000002', 'aal2', 10, 'mfa/recovery_code');
select ok(pg_temp.recusa($$update public.withdrawals set status = 'completed' where id = 'd9000000-0000-4000-8000-0000000000d1'$$),
  'saque: código de recuperação não destrava');
select pg_temp.como('authenticated', 'd9000000-0000-4000-8000-000000000002', 'aal2', 10);
select is(pg_temp.passa($$update public.withdrawals set status = 'completed' where id = 'd9000000-0000-4000-8000-0000000000d1'$$), 'ok', 'saque: status com TOTP de 10 s atrás passa');
select is((select status from public.withdrawals where id = 'd9000000-0000-4000-8000-0000000000d1'), 'completed', 'saque: status gravado');
select pg_temp.como('authenticated', 'd9000000-0000-4000-8000-000000000002', 'aal2', 3600);
select is(pg_temp.passa($$update public.withdrawals set processed_at = now() where id = 'd9000000-0000-4000-8000-0000000000d2'$$), 'ok',
  'saque: mudar só processed_at (status igual) não pede código');
select is(pg_temp.passa($$update public.withdrawals set status = status where id = 'd9000000-0000-4000-8000-0000000000d2'$$), 'ok', 'saque: status regravado igual não pede código');
select pg_temp.como('authenticated', 'd9000000-0000-4000-8000-000000000004', 'aal2', 3600);
select is((pg_temp.erro($$update public.withdrawals set amount = 1 where id = 'd9000000-0000-4000-8000-0000000000d2'$$)), 'ok', 'saque: admin sem permissão enxerga 0 linhas pela RLS (sem erro de código)');
select pg_temp.como('authenticated', 'd9000000-0000-4000-8000-000000000002', 'aal2', 3600);
select alike(pg_temp.erro($$update public.withdrawals set amount = 1, status = 'completed' where id = 'd9000000-0000-4000-8000-0000000000d2'$$),
  '42501||Alteração de campo protegido%', 'saque: erro de permissão (coluna travada) vem antes do pedido de código');
select pg_temp.como('service_role');
select is(pg_temp.passa($$update public.withdrawals set status = 'completed' where id = 'd9000000-0000-4000-8000-0000000000d3'$$), 'ok', 'saque: service_role passa sem amr');
select pg_temp.como('postgres');
select is(pg_temp.passa($$update public.withdrawals set status = 'completed' where id = 'd9000000-0000-4000-8000-0000000000d4'$$), 'ok', 'saque: dono do banco passa');

-- D. producer_profiles: comissão --------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', 'd9000000-0000-4000-8000-000000000001', 'aal2', 3600);
select ok(pg_temp.recusa($$update public.producer_profiles set commission_rate = 12 where id = 'd9000000-0000-4000-8000-000000000006'$$),
  'comissão: super_admin sem código recente é recusado com 42501 e hint reautenticar');
select is((select commission_rate from public.producer_profiles where id = 'd9000000-0000-4000-8000-000000000006'), 10.00, 'comissão: nada gravou');
select is(pg_temp.passa($$update public.producer_profiles set is_verified = true where id = 'd9000000-0000-4000-8000-000000000006'$$), 'ok',
  'comissão: mudar outra coluna (is_verified) não pede código');
select is(pg_temp.passa($$update public.producer_profiles set commission_rate = 10.00 where id = 'd9000000-0000-4000-8000-000000000006'$$), 'ok',
  'comissão: regravar o mesmo valor não pede código');
select ok(pg_temp.recusa($$insert into public.producer_profiles (id, company_name, commission_rate) values ('d9000000-0000-4000-8000-000000000007', 'P3', 12)$$),
  'comissão: criar linha com comissão diferente de 10.00 sem código recente é recusado');
select pg_temp.como('authenticated', 'd9000000-0000-4000-8000-000000000001', 'aal2', 10);
select is(pg_temp.passa($$update public.producer_profiles set commission_rate = 12 where id = 'd9000000-0000-4000-8000-000000000006'$$), 'ok', 'comissão: com TOTP recente passa');
select is((select commission_rate from public.producer_profiles where id = 'd9000000-0000-4000-8000-000000000006'), 12.00, 'comissão: valor gravado');
select is(pg_temp.passa($$insert into public.producer_profiles (id, company_name, commission_rate) values ('d9000000-0000-4000-8000-000000000007', 'P3', 15)$$), 'ok',
  'comissão: criar linha com comissão 15 passa com TOTP recente');
select pg_temp.como('authenticated', 'd9000000-0000-4000-8000-000000000005', 'aal2', 3600);
select alike(pg_temp.erro($$update public.producer_profiles set commission_rate = 20 where id = 'd9000000-0000-4000-8000-000000000006'$$),
  '42501||Alteração de campo protegido%', 'comissão: manage_users (não é super_admin) recebe o erro de permissão, não o pedido de código');
select pg_temp.como('authenticated', 'd9000000-0000-4000-8000-000000000006', 'aal1');
select is(pg_temp.passa($$update public.producer_profiles set company_name = 'Paula Eventos 3' where id = 'd9000000-0000-4000-8000-000000000006'$$), 'ok',
  'comissão: produtor edita a própria linha sem código (nada de dinheiro da plataforma mudou)');
select pg_temp.como('service_role');
select is(pg_temp.passa($$update public.producer_profiles set commission_rate = 11 where id = 'd9000000-0000-4000-8000-000000000006'$$), 'ok', 'comissão: service_role passa sem amr');
select pg_temp.como('postgres');
select is(pg_temp.passa($$update public.producer_profiles set commission_rate = 10 where id = 'd9000000-0000-4000-8000-000000000006'$$), 'ok', 'comissão: dono do banco passa');

-- E. platform_settings: só a linha 'fees' -------------------------------------------------------------------------------------
select pg_temp.como('authenticated', 'd9000000-0000-4000-8000-000000000001', 'aal2', 3600);
select ok(pg_temp.recusa($$update public.platform_settings set value = '{"taxa":12}' where key = 'fees'$$), 'taxa: update sem código recente é recusado com 42501 e hint reautenticar');
select ok(pg_temp.recusa($$delete from public.platform_settings where key = 'fees'$$), 'taxa: delete sem código recente é recusado');
select ok(pg_temp.recusa($$update public.platform_settings set key = 'fees_velha' where key = 'fees'$$), 'taxa: renomear a linha fees sem código é recusado');
select ok(pg_temp.recusa($$update public.platform_settings set key = 'fees' where key = 'fees_teste'$$), 'taxa: renomear outra linha para fees sem código é recusado');
select is((select value from public.platform_settings where key = 'fees'), '{"taxa":10}'::jsonb, 'taxa: nada gravou');
select is(pg_temp.passa($$update public.platform_settings set value = '{"a":2}' where key = 'general'$$), 'ok', 'configuração geral: não pede código');
select is(pg_temp.passa($$update public.platform_settings set value = '{"x":2}' where key = 'fees_teste'$$), 'ok', 'chave parecida (fees_teste): não pede código');
select pg_temp.como('authenticated', 'd9000000-0000-4000-8000-000000000001', 'aal2', 10);
select is(pg_temp.passa($$update public.platform_settings set value = '{"taxa":12}' where key = 'fees'$$), 'ok', 'taxa: update com TOTP recente passa');
select is(pg_temp.passa($$delete from public.platform_settings where key = 'fees'$$), 'ok', 'taxa: delete com TOTP recente passa');
select pg_temp.como('authenticated', 'd9000000-0000-4000-8000-000000000001', 'aal2', 3600);
select ok(pg_temp.recusa($$insert into public.platform_settings (key, value) values ('fees', '{"taxa":9}')$$), 'taxa: insert sem código recente é recusado');
select pg_temp.como('authenticated', 'd9000000-0000-4000-8000-000000000001', 'aal2', 10);
select is(pg_temp.passa($$insert into public.platform_settings (key, value) values ('fees', '{"taxa":9}')$$), 'ok', 'taxa: insert com TOTP recente passa');
select pg_temp.como('service_role');
select is(pg_temp.passa($$update public.platform_settings set value = '{"taxa":8}' where key = 'fees'$$), 'ok', 'taxa: service_role passa sem amr');
select pg_temp.como('postgres');
select is(pg_temp.passa($$delete from public.platform_settings where key = 'fees'$$), 'ok', 'taxa: dono do banco passa');

-- F. staff_profiles: banco e Pix --------------------------------------------------------------------------------------------
select pg_temp.como('authenticated', 'd9000000-0000-4000-8000-000000000005', 'aal2', 3600);
select ok(pg_temp.recusa($$update public.staff_profiles set pix_chave = 'novo@teste-s9.local' where user_id = 'd9000000-0000-4000-8000-000000000005'$$),
  'ficha: Pix sem código recente é recusado com 42501 e hint reautenticar');
select ok(pg_temp.recusa($$update public.staff_profiles set banco = 'Banco X', agencia = '1234', conta = '99999-1' where user_id = 'd9000000-0000-4000-8000-000000000005'$$),
  'ficha: banco, agência e conta sem código recente são recusados');
select ok(pg_temp.recusa($$update public.staff_profiles set pix_tipo = 'telefone', pix_chave = '+5511911112222' where user_id = 'd9000000-0000-4000-8000-000000000005'$$),
  'ficha: tipo e chave do Pix sem código recente são recusados');
select is((select pix_chave from public.staff_profiles where user_id = 'd9000000-0000-4000-8000-000000000005'), 'col@teste-s9.local', 'ficha: nada gravou');
select is(pg_temp.passa($$update public.staff_profiles set telefone = '+5511922223333' where user_id = 'd9000000-0000-4000-8000-000000000005'$$), 'ok', 'ficha: telefone não pede código');
select is(pg_temp.passa($$update public.staff_profiles set pix_chave = pix_chave where user_id = 'd9000000-0000-4000-8000-000000000005'$$), 'ok', 'ficha: Pix regravado igual não pede código');
select pg_temp.como('authenticated', 'd9000000-0000-4000-8000-000000000005', 'aal2', 10);
select is(pg_temp.passa($$update public.staff_profiles set pix_chave = 'novo@teste-s9.local' where user_id = 'd9000000-0000-4000-8000-000000000005'$$), 'ok', 'ficha: Pix com TOTP recente passa');
select is(pg_temp.passa($$update public.staff_profiles set banco = 'Banco X', agencia = '1234', conta = '99999-1' where user_id = 'd9000000-0000-4000-8000-000000000005'$$), 'ok', 'ficha: banco com TOTP recente passa');
select pg_temp.como('postgres');
select is((select count(*) from public.staff_profiles_historico_pagamento where user_id = 'd9000000-0000-4000-8000-000000000005'), 2::bigint, 'ficha: o histórico de pagamento só registrou as duas mudanças permitidas');
select pg_temp.como('service_role');
select is(pg_temp.passa($$update public.staff_profiles set pix_chave = 'svc@teste-s9.local' where user_id = 'd9000000-0000-4000-8000-000000000005'$$), 'ok', 'ficha: service_role passa sem amr');

-- G. Estrutura ---------------------------------------------------------------------------------------------------------------
select pg_temp.como('postgres');
select is((select count(*) from pg_trigger where tgfoid = 'public.gf_reauth_dinheiro()'::regprocedure and not tgisinternal and tgenabled = 'O'), 7::bigint,
  'sete gatilhos de reautenticação ligados (saque, comissão x2, taxa x3, ficha)');
select ok(not has_function_privilege('anon', 'public.gf_reauth_dinheiro()', 'execute') and not has_function_privilege('authenticated', 'public.gf_reauth_dinheiro()', 'execute'),
  'gf_reauth_dinheiro: função de gatilho, fechada para anon e authenticated');
select is((select array_agg(tgname::text order by tgname collate "C") from pg_trigger where tgrelid = 'public.producer_profiles'::regclass
  and not tgisinternal and (tgtype & 3) = 3 and tgname in ('gf_protect_producer_profile_privileges', 'gf_reauth_dinheiro_ins', 'gf_reauth_dinheiro_upd')),
  array['gf_protect_producer_profile_privileges', 'gf_reauth_dinheiro_ins', 'gf_reauth_dinheiro_upd'], 'producer_profiles: a reautenticação roda depois da proteção de permissão (ordem dos BEFORE)');
select is((select array_agg(tgname::text order by tgname collate "C") from pg_trigger where tgrelid = 'public.withdrawals'::regclass
  and not tgisinternal and (tgtype & 3) = 3 and tgname in ('gf_protect_withdrawals', 'withdrawals_quem_processou', 'withdrawals_reauth_dinheiro')),
  array['gf_protect_withdrawals', 'withdrawals_quem_processou', 'withdrawals_reauth_dinheiro'], 'withdrawals: a reautenticação roda depois da proteção da S3 e de quem processou (ordem dos BEFORE)');

select * from finish();
rollback;
