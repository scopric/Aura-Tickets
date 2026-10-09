-- =============================================================================
-- TESTES de 20261104_mfa_gancho_tentativas.sql (o código fica lá; este arquivo não vai para produção).
-- Rodar só em banco descartável (ou dentro de transação com ROLLBACK), DEPOIS de aplicar o arquivo de código.
-- Cada teste termina com "NOTICE: Tn OK" e grava em pg_temp.res; falha = ERROR com o valor recebido.
-- No fim, `select * from pg_temp.res` lista os testes que passaram. Um bloco begin … rollback.
-- =============================================================================
begin;

create temp table res (t text);
create function pg_temp.ok(n text) returns void language plpgsql as $f$
begin insert into pg_temp.res values (n); raise notice '% OK', n; end $f$;
create function pg_temp.afirma(n text, cond boolean, visto text) returns void language plpgsql as $f$
begin
  if cond is not true then raise exception '% FALHOU: %', n, visto; end if;
  perform pg_temp.ok(n);
end $f$;

-- uuids fictícios: usuário A/B e fatores 1/2
create function pg_temp.u(n int) returns uuid language sql as $f$ select ('a5000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $f$;
create function pg_temp.ev(u int, f int, valido boolean) returns jsonb language sql as
$f$ select jsonb_build_object('user_id', pg_temp.u(u), 'factor_id', pg_temp.u(f), 'valid', valido) $f$;
create function pg_temp.hook(u int, f int, valido boolean) returns jsonb language sql as
$f$ select public.hook_mfa_tentativas(pg_temp.ev(u, f, valido)) $f$;
create function pg_temp.bloqueado(j jsonb) returns boolean language sql as
$f$ select (j #>> '{error,http_code}') = '429' and j ->> 'decision' is null $f$;
create function pg_temp.segue(j jsonb) returns boolean language sql as
$f$ select (j ->> 'decision') = 'continue' and j -> 'error' is null $f$;

delete from public.mfa_tentativas_erradas where user_id in (pg_temp.u(101), pg_temp.u(102));

-- T1: código certo, sem histórico, segue
select pg_temp.afirma('T1 código certo segue', pg_temp.segue(pg_temp.hook(101, 1, true)), pg_temp.hook(101, 1, true)::text);

-- T2: 5 erradas seguem o comportamento normal (o Auth recusa o código) e ficam gravadas
do $t$
declare i int; j jsonb;
begin
  for i in 1..5 loop
    j := pg_temp.hook(101, 1, false);
    perform pg_temp.afirma('T2.' || i || ' errada ' || i || ' segue', pg_temp.segue(j), j::text);
  end loop;
  perform pg_temp.afirma('T2 cinco erradas gravadas',
    (select count(*) from public.mfa_tentativas_erradas where user_id = pg_temp.u(101) and factor_id = pg_temp.u(1)) = 5, 'contagem');
end $t$;

-- T3: a 6ª tentativa errada é bloqueada com 429 e NÃO é gravada
do $t$
declare j jsonb;
begin
  j := pg_temp.hook(101, 1, false);
  perform pg_temp.afirma('T3 sexta errada bloqueada 429', pg_temp.bloqueado(j), j::text);
  perform pg_temp.afirma('T3 bloqueio não grava tentativa',
    (select count(*) from public.mfa_tentativas_erradas where user_id = pg_temp.u(101) and factor_id = pg_temp.u(1)) = 5, 'contagem');
end $t$;

-- T4: bloqueado, até o código CERTO é recusado
do $t$
declare j jsonb;
begin
  j := pg_temp.hook(101, 1, true);
  perform pg_temp.afirma('T4 código certo durante o bloqueio é recusado', pg_temp.bloqueado(j), j::text);
end $t$;

-- T5: outro fator do mesmo usuário e outro usuário não são afetados
do $t$
declare j1 jsonb; j2 jsonb;
begin
  j1 := pg_temp.hook(101, 2, true);
  j2 := pg_temp.hook(102, 1, true);
  perform pg_temp.afirma('T5 outro fator segue', pg_temp.segue(j1), j1::text);
  perform pg_temp.afirma('T5 outro usuário segue', pg_temp.segue(j2), j2::text);
end $t$;

-- T6: passada a janela de 15 min, libera (as erradas antigas deixam de contar)
do $t$
declare j jsonb;
begin
  update public.mfa_tentativas_erradas set errou_em = now() - interval '16 minutes'
   where user_id = pg_temp.u(101) and factor_id = pg_temp.u(1);
  j := pg_temp.hook(101, 1, true);
  perform pg_temp.afirma('T6 libera depois da janela', pg_temp.segue(j), j::text);
  perform pg_temp.afirma('T6 código certo apaga o histórico',
    (select count(*) from public.mfa_tentativas_erradas where user_id = pg_temp.u(101) and factor_id = pg_temp.u(1)) = 0, 'contagem');
end $t$;

-- T7: 4 erradas e depois a certa: zera o contador (4 novas erradas não bloqueiam)
do $t$
declare i int; j jsonb;
begin
  for i in 1..4 loop perform pg_temp.hook(102, 1, false); end loop;
  perform pg_temp.hook(102, 1, true);
  for i in 1..4 loop j := pg_temp.hook(102, 1, false); end loop;
  perform pg_temp.afirma('T7 acerto zera o contador', pg_temp.segue(j), j::text);
  perform pg_temp.afirma('T7 quatro erradas após o zero ficam gravadas',
    (select count(*) from public.mfa_tentativas_erradas where user_id = pg_temp.u(102) and factor_id = pg_temp.u(1)) = 4, 'contagem');
end $t$;

-- T8: FALHA ABERTA: evento malformado nunca levanta erro nem bloqueia
do $t$
declare j jsonb;
begin
  j := public.hook_mfa_tentativas('{}'::jsonb);
  perform pg_temp.afirma('T8 evento vazio segue', pg_temp.segue(j), j::text);
  j := public.hook_mfa_tentativas('{"user_id":"nao-e-uuid","factor_id":"x","valid":false}'::jsonb);
  perform pg_temp.afirma('T8 uuid inválido segue', pg_temp.segue(j), j::text);
  j := public.hook_mfa_tentativas(null);
  perform pg_temp.afirma('T8 evento nulo segue', pg_temp.segue(j), j::text);
  j := public.hook_mfa_tentativas(jsonb_build_object('user_id', pg_temp.u(103), 'factor_id', pg_temp.u(1), 'valid', 'talvez'));
  perform pg_temp.afirma('T8 valid inválido segue', pg_temp.segue(j), j::text);
end $t$;

-- T9: permissões (a função e a tabela não são acessíveis pela API)
select pg_temp.afirma('T9 só o Auth executa',
  has_function_privilege('supabase_auth_admin', 'public.hook_mfa_tentativas(jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.hook_mfa_tentativas(jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.hook_mfa_tentativas(jsonb)', 'execute'), 'privilégios de execução');
select pg_temp.afirma('T9 tabela fechada para a API',
  not has_table_privilege('authenticated', 'public.mfa_tentativas_erradas', 'select')
  and not has_table_privilege('anon', 'public.mfa_tentativas_erradas', 'select')
  and not has_table_privilege('authenticated', 'public.mfa_tentativas_erradas', 'insert')
  and (select relrowsecurity from pg_class where oid = 'public.mfa_tentativas_erradas'::regclass), 'privilégios/RLS da tabela');

-- T10: quem é authenticated não consegue chamar a função nem ler a tabela (erro de permissão no OBJETO certo)
do $t$
declare e1 text; m1 text; e2 text; m2 text;
begin
  set local role authenticated;
  begin perform public.hook_mfa_tentativas('{}'::jsonb); e1 := 'ok';
  exception when others then e1 := sqlstate; m1 := sqlerrm; end;
  begin perform 1 from public.mfa_tentativas_erradas limit 1; e2 := 'ok';
  exception when others then e2 := sqlstate; m2 := sqlerrm; end;
  reset role;
  perform pg_temp.afirma('T10 authenticated não executa a função', e1 = '42501' and m1 like '%hook_mfa_tentativas%', coalesce(e1, '') || ' ' || coalesce(m1, ''));
  perform pg_temp.afirma('T10 authenticated não lê a tabela', e2 = '42501' and m2 like '%mfa_tentativas_erradas%', coalesce(e2, '') || ' ' || coalesce(m2, ''));
end $t$;

-- T11: retenção: uma chamada apaga o que tem mais de 1 dia, de QUALQUER usuário (e preserva o recente)
do $t$
begin
  insert into public.mfa_tentativas_erradas (user_id, factor_id, errou_em) values
    (pg_temp.u(104), pg_temp.u(1), now() - interval '2 days'),
    (pg_temp.u(104), pg_temp.u(1), now() - interval '2 hours');
  perform pg_temp.hook(105, 1, true);
  perform pg_temp.afirma('T11 apaga o que passou de 1 dia',
    (select count(*) from public.mfa_tentativas_erradas where user_id = pg_temp.u(104) and errou_em < now() - interval '1 day') = 0, 'velhas');
  perform pg_temp.afirma('T11 preserva o recente',
    (select count(*) from public.mfa_tentativas_erradas where user_id = pg_temp.u(104)) = 1, 'recentes');
end $t$;

-- T12: o Auth enxerga o schema e a tabela não é acessível nem pelo service_role
select pg_temp.afirma('T12 Auth usa o schema public', has_schema_privilege('supabase_auth_admin', 'public', 'usage'), 'schema');
select pg_temp.afirma('T12 service_role fora da tabela e da função',
  not has_table_privilege('service_role', 'public.mfa_tentativas_erradas', 'select')
  and not has_function_privilege('service_role', 'public.hook_mfa_tentativas(jsonb)', 'execute'), 'service_role');

select t as passou from pg_temp.res order by ctid;
rollback;
