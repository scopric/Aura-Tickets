-- =============================================================================
-- Convite de colaborador — TESTES de 20261002_convite_colaborador.sql (o código fica lá; este arquivo não vai
-- para produção). Rodar só em banco descartável, DEPOIS de aplicar o arquivo de código: um bloco só, num
-- begin … rollback (nada fica gravado).
-- T0–T12: hash, grants, criar/reenviar/cancelar/listar, conferir, aceitar (token errado, expirado, usado,
-- cancelado; e-mail diferente; aal1; sem fator; CPF, idade, Pix, e-mail secundário; campos faltando), permissões
-- aplicadas iguais às do convite, o gatilho gf_protect_profile_privileges (barra a mudança de papel direta e
-- não barra convite_aceitar) e a RLS de staff_profiles.
-- Contas de teste com ids fixos (c0000000-…); e-mails *.invalid. Cada teste termina com "NOTICE: Tn OK";
-- falha = ERROR com o valor recebido.
-- Rodado em 01/10/2026 (código aplicado duas vezes): T0–T12 OK.
-- Stubs do Postgres descartável (supabase/postgres 17.6.1.171), fora do repositório: profiles com as colunas
-- usadas (role, email, admin_permissions, is_verified, stripe_customer_id), auth.jwt(), auth.mfa_factors,
-- gf_mfa_ok/gf_is_admin de 20260930_2fa_no_banco.sql, o essencial do seg-6 (#85), o arquivo
-- 20261001_seg4_2fa_admin.sql inteiro (gf_is_admin, gf_admin_can, gf_tem_2fa e o gatilho) e gf_cpf_valido de
-- 20260929_afiliados_v2.sql.
-- Corrida entre dois aceites do mesmo token (select … for update) não cabe numa sessão só; o T6 confere que o
-- segundo aceite, depois do primeiro, é recusado.
-- =============================================================================
begin;
-- seg-6: função nova do postgres nasce só com EXECUTE do dono; os auxiliares pg_temp.* rodam também como
-- authenticated/anon, então ganham EXECUTE (só nesta transação). A tabela temporária cria o schema pg_temp.
create temp table seg6_marco ();
do $$ begin
  execute format('alter default privileges for role postgres in schema %s grant execute on functions to public',
                 pg_my_temp_schema()::regnamespace);
end $$;
-- p = usuário (null = postgres); aal = nível da sessão no JWT; e-mail no JWT (claim antiga e claims, como o PostgREST)
create function pg_temp.como(p uuid, aal text default 'aal1', p_role text default 'authenticated') returns void language plpgsql as $f$
declare e text := (select email from public.profiles where id = p);
begin
  perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), true);
  perform set_config('request.jwt.claim.email', coalesce(e, ''), true);
  perform set_config('request.jwt.claims', case when p_role = 'postgres' then ''
    else json_strip_nulls(json_build_object('sub', p, 'role', p_role, 'aal', aal, 'email', e))::text end, true);
  perform set_config('role', p_role, true);
end $f$;
create function pg_temp.erro(q text) returns text language plpgsql as $f$
begin execute q; return 'ok'; exception when others then return sqlstate; end $f$;
create function pg_temp.msg(q text) returns text language plpgsql as $f$
begin execute q; return 'ok'; exception when others then return sqlerrm; end $f$;
create function pg_temp.u(n int) returns uuid language sql as $f$ select ('c0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $f$;
-- dados válidos do cadastro, com troca de um campo
create function pg_temp.dados(k text default null, v text default null) returns jsonb language sql as $f$
  select jsonb_build_object('nome_completo', 'Clara Teste da Silva', 'cpf', '529.982.247-25', 'rg', '12.345.678-9',
    'data_nascimento', '1990-05-20', 'cep', '01310-100', 'rua', 'Avenida Paulista', 'numero', '1000', 'complemento', 'Sala 1',
    'bairro', 'Bela Vista', 'cidade', 'São Paulo', 'uf', 'SP', 'email_secundario', 'clara.pessoal@teste-convite.invalid',
    'telefone', '+5511987654321', 'whatsapp', '+5511987654321', 'emergencia_nome', 'Pedro Teste', 'emergencia_parentesco', 'Irmão',
    'emergencia_telefone', '+5511912345678', 'banco', 'Banco Teste', 'agencia', '0001', 'conta', '12345-6',
    'pix_tipo', 'email', 'pix_chave', 'Clara.Pix@teste-convite.invalid')
    || case when k is null then '{}'::jsonb else jsonb_build_object(k, v) end $f$;
-- token de teste → hash, calculado aqui sem convite_hash (que a API não executa): sha256 hex do texto, como a Edge Function
create function pg_temp.h(t text) returns text language sql as $f$ select encode(sha256(convert_to(t, 'UTF8')), 'hex') $f$;

-- Contas: 1 super_admin com fator; 2 convidada com fator; 3 outra conta com fator; 4 convidado sem fator;
-- 5 admin comum (manage_users) com fator; 6 convidada que já é admin
insert into public.profiles (id, email, full_name, role, admin_permissions) values
  (pg_temp.u(1), 'super@teste-convite.invalid', 'Super Teste', 'admin', '{super_admin}'),
  (pg_temp.u(2), 'clara@teste-convite.invalid', 'Clara', 'user', '{}'),
  (pg_temp.u(3), 'outra@teste-convite.invalid', 'Outra', 'user', '{}'),
  (pg_temp.u(4), 'semfator@teste-convite.invalid', 'Sem Fator', 'user', '{}'),
  (pg_temp.u(5), 'admin@teste-convite.invalid', 'Admin Comum', 'admin', '{manage_users}'),
  (pg_temp.u(6), 'jaadmin@teste-convite.invalid', 'Já Admin', 'user', '{}');
insert into auth.mfa_factors (user_id, status)
  select pg_temp.u(n), 'verified' from unnest(array[1, 2, 3, 5, 6]) n;

do $t$ begin
  -- T0. sha256 hex do texto (vetor conhecido de "abc"), igual ao hashToken da Edge Function
  assert public.convite_hash('abc') = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'hash: ' || public.convite_hash('abc');
  raise notice 'T0 OK: sha256 hex';

  -- T1. Grants: anon só confere; ninguém da API lê as tabelas de convite; colunas protegidas fora do UPDATE
  assert has_function_privilege('anon', 'public.convite_conferir(text)', 'execute'), 'anon não confere';
  assert not has_function_privilege('anon', 'public.convite_aceitar(text, jsonb)', 'execute'), 'anon aceita';
  assert not has_function_privilege('anon', 'public.convite_criar(text, text, text[], text)', 'execute'), 'anon cria';
  assert not has_function_privilege('anon', 'public.convites_listar()', 'execute'), 'anon lista';
  assert not has_function_privilege('anon', 'public.colaborador_dados(uuid)', 'execute'), 'anon lê cadastro';
  assert not has_function_privilege('authenticated', 'public.convite_hash(text)', 'execute'), 'authenticated usa convite_hash';
  assert not has_table_privilege('anon', 'public.admin_invites', 'select') and not has_table_privilege('authenticated', 'public.admin_invites', 'select')
     and not has_table_privilege('authenticated', 'public.admin_invites', 'insert') and not has_table_privilege('authenticated', 'public.admin_invites', 'update'),
     'API lê ou grava admin_invites';
  assert not has_table_privilege('anon', 'public.staff_profiles', 'select'), 'anon lê staff_profiles';
  assert not has_table_privilege('authenticated', 'public.staff_profiles', 'insert')
     and not has_table_privilege('authenticated', 'public.staff_profiles', 'delete'), 'authenticated insere ou apaga staff_profiles';
  assert not has_column_privilege('authenticated', 'public.staff_profiles', 'user_id', 'update')
     and not has_column_privilege('authenticated', 'public.staff_profiles', 'invite_id', 'update')
     and not has_column_privilege('authenticated', 'public.staff_profiles', 'email', 'update')
     and not has_column_privilege('authenticated', 'public.staff_profiles', 'cargo', 'update'), 'colunas protegidas com UPDATE';
  assert has_column_privilege('authenticated', 'public.staff_profiles', 'telefone', 'update'), 'colaborador não edita o telefone';
  assert (select relrowsecurity from pg_class where oid = 'public.admin_invites'::regclass)
     and (select relrowsecurity from pg_class where oid = 'public.staff_profiles'::regclass), 'RLS desligada';
  assert not exists (select 1 from pg_policies where tablename = 'admin_invites'), 'admin_invites com policy';
  assert (select bool_and(p.prosecdef and p.proconfig @> array['search_path=""'] and p.proowner = 'postgres'::regrole)
          from pg_proc p where p.proname in ('convite_criar', 'convite_reenviar', 'convite_cancelar', 'convites_listar',
            'colaborador_dados', 'colaboradores_resumo', 'convite_conferir', 'convite_aceitar')), 'função sem definer, search_path ou dono postgres';
  raise notice 'T1 OK: grants, RLS e definer';
end $t$;

do $t$
declare m text; id1 uuid;
begin
  -- T2. convite_criar: só super_admin em aal2; nunca super_admin nem função fora da lista; um pendente por e-mail
  perform pg_temp.como(pg_temp.u(1), 'aal1');
  assert pg_temp.erro($$select public.convite_criar('clara@teste-convite.invalid', 'Atendimento', '{manage_support}', pg_temp.h('tok-clara'))$$) = '42501', 'super_admin aal1 criou';
  perform pg_temp.como(pg_temp.u(5), 'aal2');
  assert pg_temp.erro($$select public.convite_criar('clara@teste-convite.invalid', 'Atendimento', '{manage_support}', pg_temp.h('tok-clara'))$$) = '42501', 'admin comum criou';
  perform pg_temp.como(pg_temp.u(3), 'aal2');
  assert pg_temp.erro($$select public.convite_criar('clara@teste-convite.invalid', 'Atendimento', '{manage_support}', pg_temp.h('tok-clara'))$$) = '42501', 'participante criou';
  perform pg_temp.como(pg_temp.u(1), 'aal2');
  assert pg_temp.erro($$select public.convite_criar('clara@teste-convite.invalid', 'Atendimento', '{super_admin}', pg_temp.h('tok-clara'))$$) = '22023', 'convite com super_admin';
  assert pg_temp.erro($$select public.convite_criar('clara@teste-convite.invalid', 'Atendimento', '{manage_support,super_admin}', pg_temp.h('tok-clara'))$$) = '22023', 'convite com super_admin junto';
  assert pg_temp.erro($$select public.convite_criar('clara@teste-convite.invalid', 'Atendimento', '{dono_de_tudo}', pg_temp.h('tok-clara'))$$) = '22023', 'convite com função inventada';
  assert pg_temp.erro($$select public.convite_criar('clara@teste-convite.invalid', 'Atendimento', array['manage_support', null], pg_temp.h('tok-clara'))$$) = '22023', 'convite com null';
  assert pg_temp.erro($$select public.convite_criar('nao-e-email', 'Atendimento', '{manage_support}', pg_temp.h('tok-x'))$$) = '22023', 'e-mail inválido';
  assert pg_temp.erro($$select public.convite_criar('x@teste-convite.invalid', 'Atendimento', '{manage_support}', 'abc')$$) = '22023', 'hash fora do formato';
  assert pg_temp.erro($$select public.convite_criar('admin@teste-convite.invalid', 'Atendimento', '{manage_support}', pg_temp.h('tok-x'))$$) = 'P0001', 'convidou quem já é admin';
  -- e-mail com maiúsculas e espaços vira minúsculo; funções repetidas saem uma vez, em ordem
  id1 := public.convite_criar(' Clara@Teste-Convite.invalid ', ' Atendimento ', '{moderate_mesa,manage_support,manage_support}', pg_temp.h('tok-clara'));
  assert id1 is not null, 'não criou';
  m := pg_temp.msg($$select public.convite_criar('clara@teste-convite.invalid', 'Outro', '{manage_support}', pg_temp.h('tok-clara-2'))$$);
  assert m like 'Já existe um convite pendente%', 'segundo pendente: ' || m;
  perform public.convite_criar('semfator@teste-convite.invalid', 'Financeiro', '{manage_finance}', pg_temp.h('tok-semfator'));
  perform public.convite_criar('outra-pessoa@teste-convite.invalid', 'Eventos', '{manage_events}', pg_temp.h('tok-cancelar'));
  perform public.convite_criar('jaadmin@teste-convite.invalid', 'Eventos', '{manage_events}', pg_temp.h('tok-jaadmin'));
  perform pg_temp.como(null, null, 'postgres');
  assert (select email || '|' || cargo || '|' || permissions::text || '|' || status || '|' || created_by::text
          from public.admin_invites where id = id1)
       = 'clara@teste-convite.invalid|Atendimento|{manage_support,moderate_mesa}|pendente|' || pg_temp.u(1), 'convite gravado errado';
  assert (select expires_at between now() + interval '7 days' - interval '1 minute' and now() + interval '7 days' + interval '1 minute'
          from public.admin_invites where id = id1), 'validade diferente de 7 dias';
  -- o CHECK barra super_admin mesmo gravando direto (dono do banco)
  assert pg_temp.erro($$insert into public.admin_invites (email, cargo, permissions, token_hash) values ('z@teste-convite.invalid', 'X X', '{super_admin}', pg_temp.h('z'))$$) = '23514', 'CHECK deixou super_admin';
  raise notice 'T2 OK: convite_criar';
end $t$;

do $t$
declare r jsonb;
begin
  -- T3. convite_conferir: anon; token certo devolve o e-mail mascarado; errado, só valido=false
  perform pg_temp.como(null, null, 'anon');
  r := public.convite_conferir('tok-clara');
  assert r = '{"valido": true, "email": "c***@teste-convite.invalid"}'::jsonb, 'conferir certo: ' || r;
  assert public.convite_conferir('tok-errado') = '{"valido": false}'::jsonb, 'conferir errado';
  assert public.convite_conferir(null) = '{"valido": false}'::jsonb, 'conferir null';
  assert pg_temp.erro($$select public.convite_aceitar('tok-clara', pg_temp.dados())$$) = '42501', 'anon aceitou';
  perform pg_temp.como(null, null, 'postgres');
  raise notice 'T3 OK: convite_conferir';
end $t$;

do $t$
declare m text;
begin
  -- T4. convite_aceitar recusa: token errado; e-mail de outra conta; aal1; conta sem fator (aal2 forjado);
  --     CPF inválido; menor de 18; Pix fora do tipo; e-mail secundário igual ao principal; campo faltando
  perform pg_temp.como(pg_temp.u(2), 'aal2');
  m := pg_temp.msg($$select public.convite_aceitar('tok-errado', pg_temp.dados())$$);
  assert m = 'Convite inválido ou expirado.', 'token errado: ' || m;
  perform pg_temp.como(pg_temp.u(3), 'aal2');
  m := pg_temp.msg($$select public.convite_aceitar('tok-clara', pg_temp.dados())$$);
  assert m = 'Entre com a conta do e-mail que recebeu o convite.', 'outra conta: ' || m;
  perform pg_temp.como(pg_temp.u(2), 'aal1');
  m := pg_temp.msg($$select public.convite_aceitar('tok-clara', pg_temp.dados())$$);
  assert m like 'Ative a verificação em duas etapas%', 'aal1: ' || m;
  perform pg_temp.como(pg_temp.u(4), 'aal2');
  m := pg_temp.msg($$select public.convite_aceitar('tok-semfator', pg_temp.dados())$$);
  assert m like 'Ative a verificação em duas etapas%', 'sem fator com aal2 forjado: ' || m;
  perform pg_temp.como(pg_temp.u(2), 'aal2');
  assert pg_temp.msg($$select public.convite_aceitar('tok-clara', pg_temp.dados('cpf', '529.982.247-24'))$$) = 'CPF inválido.', 'CPF inválido passou';
  assert pg_temp.msg($$select public.convite_aceitar('tok-clara', pg_temp.dados('cpf', '111.111.111-11'))$$) = 'CPF inválido.', 'CPF repetido passou';
  m := pg_temp.msg(format($$select public.convite_aceitar('tok-clara', pg_temp.dados('data_nascimento', %L))$$, (current_date - interval '18 years' + interval '1 day')::date::text));
  assert m like 'Data de nascimento inválida%', 'menor de 18: ' || m;
  assert pg_temp.msg($$select public.convite_aceitar('tok-clara', pg_temp.dados('data_nascimento', '20/05/1990'))$$) = 'Data de nascimento inválida.', 'data mal formada';
  assert pg_temp.msg($$select public.convite_aceitar('tok-clara', pg_temp.dados('pix_tipo', 'cpf'))$$) = 'A chave Pix não confere com o tipo escolhido.', 'Pix e-mail como CPF';
  assert pg_temp.msg($$select public.convite_aceitar('tok-clara', pg_temp.dados() || '{"pix_tipo":"telefone","pix_chave":"+1555123456"}')$$) = 'A chave Pix não confere com o tipo escolhido.', 'Pix telefone fora do Brasil';
  assert pg_temp.msg($$select public.convite_aceitar('tok-clara', pg_temp.dados() || '{"pix_tipo":"aleatoria","pix_chave":"123"}')$$) = 'A chave Pix não confere com o tipo escolhido.', 'Pix aleatória curta';
  assert pg_temp.msg($$select public.convite_aceitar('tok-clara', pg_temp.dados('pix_tipo', 'boleto'))$$) = 'A chave Pix não confere com o tipo escolhido.', 'tipo de Pix inventado';
  assert pg_temp.msg($$select public.convite_aceitar('tok-clara', pg_temp.dados('email_secundario', 'Clara@teste-convite.invalid'))$$) = 'E-mail secundário inválido ou igual ao e-mail principal.', 'secundário = principal';
  assert pg_temp.msg($$select public.convite_aceitar('tok-clara', pg_temp.dados('telefone', '11987654321'))$$) = 'Telefone ou WhatsApp inválido.', 'telefone sem DDI';
  assert pg_temp.msg($$select public.convite_aceitar('tok-clara', pg_temp.dados('uf', 'XX'))$$) = 'Escolha o estado (UF).', 'UF inventada';
  assert pg_temp.msg($$select public.convite_aceitar('tok-clara', pg_temp.dados('emergencia_parentesco', ' '))$$) = 'Preencha todos os campos obrigatórios.', 'campo vazio';
  assert pg_temp.msg($$select public.convite_aceitar('tok-clara', pg_temp.dados() - 'rg')$$) = 'Preencha todos os campos obrigatórios.', 'campo faltando';
  assert pg_temp.erro($$select public.convite_aceitar('tok-clara', pg_temp.dados('cpf', '1'))$$) = '22023', 'sqlstate do campo';
  perform pg_temp.como(null, null, 'postgres');
  -- nada mudou: papel, convite e cadastro
  assert (select role || coalesce(admin_permissions::text, '') from public.profiles where id = pg_temp.u(2)) = 'user{}', 'papel mudou numa recusa';
  assert (select status from public.admin_invites where token_hash = pg_temp.h('tok-clara')) = 'pendente', 'convite mudou numa recusa';
  assert not exists (select 1 from public.staff_profiles), 'cadastro gravado numa recusa';
  raise notice 'T4 OK: recusas de convite_aceitar';
end $t$;

do $t$
declare m text;
begin
  -- T5. O gatilho gf_protect_profile_privileges barra a conta de mudar o próprio papel: direto pela API e também
  --     dentro de uma função SECURITY DEFINER do postgres que NÃO esvazia as claims (controle do que convite_aceitar faz)
  create function pg_temp.promove_sem_truque(p uuid) returns void language sql security definer as
    $f$ update public.profiles set role = 'admin', admin_permissions = '{manage_support}' where id = p $f$;
  perform pg_temp.como(pg_temp.u(2), 'aal2');
  assert pg_temp.erro(format($$update public.profiles set role = 'admin' where id = %L$$, pg_temp.u(2))) in ('42501', 'ok'), 'update direto deu erro inesperado';
  perform pg_temp.como(null, null, 'postgres');
  assert (select role from public.profiles where id = pg_temp.u(2)) = 'user', 'conta se promoveu pela API';
  perform pg_temp.como(pg_temp.u(2), 'aal2');
  m := pg_temp.msg(format($$select pg_temp.promove_sem_truque(%L)$$, pg_temp.u(2)));
  assert m = 'Só o super_admin altera papel de admin e permissões', 'definer sem esvaziar as claims: ' || m;
  perform pg_temp.como(null, null, 'postgres');
  raise notice 'T5 OK: o gatilho barra a mudança de papel sem o convite';
end $t$;

do $t$
declare c text;
begin
  -- T6. Aceite válido: papel admin e as permissões do convite (nunca as do corpo), cadastro gravado normalizado,
  --     convite usado; as claims voltam depois do UPDATE; o mesmo token não serve de novo
  perform pg_temp.como(pg_temp.u(2), 'aal2');
  c := current_setting('request.jwt.claims');
  perform public.convite_aceitar('tok-clara', pg_temp.dados() || '{"role":"admin","admin_permissions":["super_admin"],"permissions":["super_admin"],"cargo":"Diretora","user_id":"c0000000-0000-4000-8000-000000000003"}');
  assert current_setting('request.jwt.claims') = c, 'claims não voltaram: ' || current_setting('request.jwt.claims');
  assert (select auth.uid()) = pg_temp.u(2), 'auth.uid mudou';
  -- já admin com 2FA: as funções de admin reconhecem as permissões do convite, e só elas
  assert public.gf_is_admin() and public.gf_admin_can('manage_support') and public.gf_admin_can('moderate_mesa'), 'permissões do convite não valem';
  assert not public.gf_admin_can('super_admin') and not public.gf_admin_can('manage_users'), 'ganhou permissão fora do convite';
  assert pg_temp.msg($$select public.convite_aceitar('tok-clara', pg_temp.dados())$$) = 'Convite inválido ou expirado.', 'token usado aceitou de novo';
  perform pg_temp.como(null, null, 'postgres');
  assert (select role || admin_permissions::text from public.profiles where id = pg_temp.u(2)) = 'admin{manage_support,moderate_mesa}', 'papel/permissões';
  assert (select status = 'usado' and used_by = pg_temp.u(2) and used_at is not null from public.admin_invites where token_hash = pg_temp.h('tok-clara')), 'convite não marcado como usado';
  assert (select user_id = pg_temp.u(2) and cargo = 'Atendimento' and email = 'clara@teste-convite.invalid' and cpf = '52998224725'
            and cep = '01310100' and uf = 'SP' and pix_chave = 'clara.pix@teste-convite.invalid' and invite_id is not null
          from public.staff_profiles), 'cadastro gravado errado';
  assert (select count(*) from public.staff_profiles) = 1, 'cadastro de outra conta';
  assert (select role from public.profiles where id = pg_temp.u(3)) = 'user', 'mexeu na conta do user_id do corpo';
  raise notice 'T6 OK: aceite válido, permissões do convite e uso único';
end $t$;

do $t$
declare m text; n int;
begin
  -- T7. Quem já é admin não aceita convite (as permissões dele seriam trocadas pelas do convite)
  update public.profiles set role = 'admin', admin_permissions = '{manage_finance}' where id = pg_temp.u(6);
  perform pg_temp.como(pg_temp.u(6), 'aal2');
  m := pg_temp.msg($$select public.convite_aceitar('tok-jaadmin', pg_temp.dados('email_secundario', 'outro@teste-convite.invalid'))$$);
  assert m = 'Esta conta já faz parte dos colaboradores da Evokaa.', 'admin aceitou: ' || m;
  perform pg_temp.como(null, null, 'postgres');
  assert (select admin_permissions::text from public.profiles where id = pg_temp.u(6)) = '{manage_finance}', 'permissões do admin mudaram';

  -- T8. Expirado: não confere, não aceita, aparece como "expirado"; um convite novo para o e-mail cancela o vencido
  update public.admin_invites set expires_at = now() - interval '1 second' where token_hash = pg_temp.h('tok-semfator');
  insert into auth.mfa_factors (user_id, status) values (pg_temp.u(4), 'verified');
  perform pg_temp.como(pg_temp.u(4), 'aal2');
  assert public.convite_conferir('tok-semfator') = '{"valido": false}'::jsonb, 'expirado conferiu';
  m := pg_temp.msg($$select public.convite_aceitar('tok-semfator', pg_temp.dados('email_secundario', 'x@teste-convite.invalid'))$$);
  assert m = 'Convite inválido ou expirado.', 'expirado aceitou: ' || m;
  perform pg_temp.como(pg_temp.u(1), 'aal2');
  assert (select status from public.convites_listar() where email = 'semfator@teste-convite.invalid') = 'expirado', 'listar não mostra expirado';
  perform public.convite_criar('semfator@teste-convite.invalid', 'Financeiro', '{manage_finance}', pg_temp.h('tok-semfator-2'));
  select count(*) into n from public.convites_listar() where email = 'semfator@teste-convite.invalid' and status = 'cancelado';
  assert n = 1, 'vencido não foi cancelado';
  perform pg_temp.como(null, null, 'postgres');
  raise notice 'T7 OK: quem já é admin não aceita';
  raise notice 'T8 OK: expirado';
end $t$;

do $t$
declare m text; e text; v_id uuid; v_usado uuid; v_cancelar uuid;
begin
  -- T9. Reenviar: token novo vale, o antigo não; só super_admin; convite usado não reenvia
  select id into v_id from public.admin_invites where token_hash = pg_temp.h('tok-semfator-2');
  select id into v_usado from public.admin_invites where token_hash = pg_temp.h('tok-clara');
  select id into v_cancelar from public.admin_invites where token_hash = pg_temp.h('tok-cancelar');
  perform pg_temp.como(pg_temp.u(5), 'aal2');
  assert pg_temp.erro(format($$select public.convite_reenviar(%L, pg_temp.h('tok-novo'))$$, v_id)) = '42501', 'admin comum reenviou';
  perform pg_temp.como(pg_temp.u(1), 'aal1');
  assert pg_temp.erro(format($$select public.convite_reenviar(%L, pg_temp.h('tok-novo'))$$, v_id)) = '42501', 'super_admin aal1 reenviou';
  perform pg_temp.como(pg_temp.u(1), 'aal2');
  e := public.convite_reenviar(v_id, pg_temp.h('tok-novo'));
  assert e = 'semfator@teste-convite.invalid', 'reenviar devolveu ' || coalesce(e, 'null');
  assert public.convite_conferir('tok-semfator-2') = '{"valido": false}'::jsonb, 'token antigo segue valendo';
  assert (public.convite_conferir('tok-novo') ->> 'valido')::boolean, 'token novo não vale';
  m := pg_temp.msg(format($$select public.convite_reenviar(%L, pg_temp.h('tok-x'))$$, v_usado));
  assert m like 'Convite não encontrado%', 'reenviou convite usado: ' || m;

  -- T10. Cancelar: só super_admin; o cancelado não confere nem aceita
  v_id := v_cancelar;
  perform pg_temp.como(pg_temp.u(5), 'aal2');
  assert pg_temp.erro(format($$select public.convite_cancelar(%L)$$, v_id)) = '42501', 'admin comum cancelou';
  assert pg_temp.erro($$select * from public.convites_listar()$$) = '42501', 'admin comum listou';
  perform pg_temp.como(pg_temp.u(1), 'aal2');
  perform public.convite_cancelar(v_id);
  assert pg_temp.msg(format($$select public.convite_cancelar(%L)$$, v_id)) like 'Convite não encontrado%', 'cancelou duas vezes';
  assert public.convite_conferir('tok-cancelar') = '{"valido": false}'::jsonb, 'cancelado conferiu';
  perform pg_temp.como(null, null, 'postgres');
  raise notice 'T9 OK: reenviar';
  raise notice 'T10 OK: cancelar';
end $t$;

do $t$
declare n int;
begin
  -- T11. staff_profiles: a própria colaboradora lê e edita (só em aal2), não troca cargo/e-mail/user_id; outra conta
  --      não vê; super_admin lê por colaborador_dados; admin comum só nome, cargo e e-mail
  perform pg_temp.como(pg_temp.u(2), 'aal2');
  assert (select count(*) from public.staff_profiles) = 1, 'colaboradora não lê o próprio cadastro';
  update public.staff_profiles set telefone = '+5511900000000', updated_at = now() where user_id = pg_temp.u(2);
  get diagnostics n = row_count;
  assert n = 1, 'colaboradora não editou o telefone';
  assert pg_temp.erro($$update public.staff_profiles set cargo = 'Diretora'$$) = '42501', 'editou o cargo';
  assert pg_temp.erro($$update public.staff_profiles set email = 'x@teste-convite.invalid'$$) = '42501', 'editou o e-mail principal';
  assert pg_temp.erro(format($$update public.staff_profiles set user_id = %L$$, pg_temp.u(3))) = '42501', 'trocou o user_id';
  assert pg_temp.erro($$update public.staff_profiles set invite_id = null$$) = '42501', 'trocou o invite_id';
  assert pg_temp.erro($$update public.staff_profiles set cpf = '12345678900'$$) = '23514', 'gravou CPF inválido';
  assert pg_temp.erro($$insert into public.staff_profiles (user_id) values (gen_random_uuid())$$) = '42501', 'inseriu cadastro';
  assert pg_temp.erro($$delete from public.staff_profiles$$) = '42501', 'apagou cadastro';
  perform pg_temp.como(pg_temp.u(2), 'aal1');
  assert (select count(*) from public.staff_profiles) = 0, 'colaboradora em aal1 lê o cadastro';
  perform pg_temp.como(pg_temp.u(3), 'aal2');
  assert (select count(*) from public.staff_profiles) = 0, 'outra conta lê o cadastro';
  assert pg_temp.erro(format($$select * from public.colaborador_dados(%L)$$, pg_temp.u(2))) = '42501', 'participante leu o cadastro';
  assert pg_temp.erro($$select * from public.colaboradores_resumo()$$) = '42501', 'participante viu a equipe';
  perform pg_temp.como(pg_temp.u(5), 'aal2');
  assert (select count(*) from public.staff_profiles) = 0, 'admin comum lê a tabela';
  assert pg_temp.erro(format($$select * from public.colaborador_dados(%L)$$, pg_temp.u(2))) = '42501', 'admin comum leu o cadastro';
  assert (select nome || '|' || cargo || '|' || email from public.colaboradores_resumo())
       = 'Clara Teste da Silva|Atendimento|clara@teste-convite.invalid', 'resumo errado';
  assert (select count(*) from information_schema.routines r join information_schema.parameters p using (specific_schema, specific_name)
          where r.routine_name = 'colaboradores_resumo' and p.parameter_mode = 'OUT') = 4, 'resumo devolve mais que 4 colunas';
  perform pg_temp.como(pg_temp.u(1), 'aal1');
  assert pg_temp.erro(format($$select * from public.colaborador_dados(%L)$$, pg_temp.u(2))) = '42501', 'super_admin aal1 leu o cadastro';
  perform pg_temp.como(pg_temp.u(1), 'aal2');
  assert (select telefone from public.colaborador_dados(pg_temp.u(2))) = '+5511900000000', 'super_admin não lê o cadastro';
  perform pg_temp.como(null, null, 'postgres');
  raise notice 'T11 OK: RLS de staff_profiles';
end $t$;

do $t$
begin
  -- T12. A chave de serviço (Edge Function) lê e grava o que precisa: convite por hash, marca o aviso, apaga o cadastro
  perform pg_temp.como(null, null, 'service_role');
  assert (select email from public.admin_invites where token_hash = pg_temp.h('tok-novo') and status = 'pendente' and expires_at > now())
       = 'semfator@teste-convite.invalid', 'service_role não acha o convite pelo hash';
  update public.admin_invites set aviso_em = now() where used_by = pg_temp.u(2) and status = 'usado' and aviso_em is null;
  assert found, 'service_role não marcou o aviso';
  delete from public.staff_profiles where user_id = pg_temp.u(2);
  assert found, 'service_role não apagou o cadastro (delete-account)';
  perform pg_temp.como(null, null, 'postgres');
  raise notice 'T12 OK: chave de serviço';
end $t$;

rollback;
