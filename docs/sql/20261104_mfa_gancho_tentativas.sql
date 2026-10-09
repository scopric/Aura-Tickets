-- Gancho "MFA Verification Hook" do Supabase Auth: freia tentativas erradas do código de 6 dígitos do 2FA (09/10/2026).
-- Antes: nenhum limite por usuário no código TOTP (só limites por IP do Auth). Quem soubesse a senha podia chutar
-- os 1 milhão de combinações. Agora: 5 códigos errados em 15 minutos bloqueiam o fator até a tentativa mais antiga
-- sair da janela (janela deslizante de 15 minutos; cerca de 480 chutes por dia por fator, no máximo).
--
-- COMO O SUPABASE CHAMA O GANCHO (docs/guides/auth/auth-hooks/mfa-verification-hook)
--   Entrada: { user_id, factor_id, valid } — roda DEPOIS de o Auth conferir o código (`valid` diz se acertou).
--   Saída:   { "decision": "continue" } (segue o comportamento normal) ou { "error": { "http_code", "message" } }.
--   `decision: reject` NÃO é usado: ele derruba o usuário de TODAS as sessões, e quem souber a senha usaria isso
--   para deslogar a vítima de propósito.
--
-- DECISÕES
-- 1. Enquanto bloqueado, recusa até o código CERTO (o gancho roda depois da conferência; sem isso, um chute certo
--    durante o bloqueio passaria). Tentativas durante o bloqueio não são gravadas: não prolongam o bloqueio.
-- 2. Código certo fora do bloqueio apaga as tentativas erradas daquele fator.
-- 3. FALHA ABERTA: erro de SQL dentro do gancho (uuid inválido, evento malformado, falha de INSERT) devolve "continue"
--    (o comportamento de hoje). Um gancho com defeito não tranca ninguém para fora do 2FA, nem o admin.
--    Exceção conhecida: cancelamento por tempo (statement_timeout/lock_timeout) não é capturado pelo PL/pgSQL
--    ("when others" não pega query_canceled): falha só aquela tentativa daquele usuário/fator, nunca todos.
-- 4. Um bloqueio por usuário e fator, serializado com advisory lock (duas tentativas ao mesmo tempo não furam o limite).
--    A espera só existe entre tentativas do MESMO usuário e fator, e dura uma transação curta.
-- 5. A tabela não tem política: ninguém lê nem grava pela API (RLS ligada, sem GRANT para anon/authenticated/
--    service_role). A função é SECURITY DEFINER com search_path '' e só o supabase_auth_admin executa.
-- 6. Retenção (LGPD): toda chamada apaga, de qualquer usuário, as linhas com mais de 1 dia. Nada fica guardado para
--    sempre. Linhas só de quem errou e nunca mais voltou saem na próxima chamada de qualquer pessoa.
-- 7. RISCO ACEITO: quem sabe a senha obtém o factor_id (listFactors) e pode manter a vítima trancada enquanto insistir
--    (uma tentativa errada a cada ~3 minutos mantém 5 na janela). A saída real é trocar a senha; o desbloqueio na
--    hora, no SQL Editor, é:
--      delete from public.mfa_tentativas_erradas where user_id = '<uuid do usuário>';
-- 8. Limite residual de força bruta: ~480 chutes por dia por fator (TOTP; tolerância de janelas vizinhas NÃO
--    VERIFICADA). Um robô por meses ainda teria chance pequena e acumulada. Evolução possível, fora deste arquivo:
--    bloqueio progressivo (ex.: 24 h a partir de N erros) com aviso por e-mail ao dono, pesando o risco do item 7.
--
-- DEPOIS DE APLICAR ESTE ARQUIVO (só então o gancho vale): Supabase > Authentication > Auth Hooks > MFA Verification
-- Attempt > Add hook > Postgres function > schema public > função hook_mfa_tentativas > Create. Para desligar:
-- o mesmo painel, desativar o gancho (a função e a tabela podem ficar). Idempotente.
begin;

create table if not exists public.mfa_tentativas_erradas (
  id        bigint generated always as identity primary key,
  user_id   uuid        not null,
  factor_id uuid        not null,
  errou_em  timestamptz not null default now()
);

create index if not exists mfa_tentativas_erradas_busca_idx
  on public.mfa_tentativas_erradas (user_id, factor_id, errou_em desc);

create index if not exists mfa_tentativas_erradas_expira_idx
  on public.mfa_tentativas_erradas (errou_em);

alter table public.mfa_tentativas_erradas enable row level security;
revoke all on table public.mfa_tentativas_erradas from public, anon, authenticated, service_role;

create or replace function public.hook_mfa_tentativas(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_limite  constant int      := 5;
  c_janela  constant interval := interval '15 minutes';
  v_user    uuid;
  v_fator   uuid;
  v_valido  boolean;
  v_erros   int;
begin
  v_user   := (event ->> 'user_id')::uuid;
  v_fator  := (event ->> 'factor_id')::uuid;
  v_valido := coalesce((event ->> 'valid')::boolean, false);

  -- um de cada vez por usuário: duas tentativas simultâneas não passam do limite
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || v_fator::text, 0));

  -- retenção (decisão 6): nada com mais de 1 dia, de ninguém
  delete from public.mfa_tentativas_erradas t where t.errou_em <= now() - interval '1 day';

  select count(*) into v_erros
    from public.mfa_tentativas_erradas t
   where t.user_id = v_user and t.factor_id = v_fator and t.errou_em > now() - c_janela;

  if v_erros >= c_limite then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 429,
      'message',   'Muitas tentativas erradas. Espere 15 minutos e tente de novo.'));
  end if;

  if v_valido then
    delete from public.mfa_tentativas_erradas t where t.user_id = v_user and t.factor_id = v_fator;
    return jsonb_build_object('decision', 'continue');
  end if;

  insert into public.mfa_tentativas_erradas (user_id, factor_id) values (v_user, v_fator);
  return jsonb_build_object('decision', 'continue');
exception when others then
  return jsonb_build_object('decision', 'continue'); -- falha aberta (decisão 3)
end
$$;

revoke all on function public.hook_mfa_tentativas(jsonb) from public, anon, authenticated, service_role;
-- O Auth precisa enxergar o schema para chamar a função (em produção já herda de PUBLIC; garante se isso mudar).
grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_mfa_tentativas(jsonb) to supabase_auth_admin;

-- Conferência final: a função existe, é SECURITY DEFINER com search_path vazio e só o Auth executa.
do $c$
declare r record;
begin
  select p.prosecdef, p.proconfig into r from pg_proc p
   where p.oid = 'public.hook_mfa_tentativas(jsonb)'::regprocedure;
  if not found or not r.prosecdef or r.proconfig is null or not ('search_path=""' = any (r.proconfig)) then
    raise exception 'hook_mfa_tentativas: SECURITY DEFINER ou search_path incorretos';
  end if;
  if not has_schema_privilege('supabase_auth_admin', 'public', 'usage') then
    raise exception 'hook_mfa_tentativas: o supabase_auth_admin não enxerga o schema public';
  end if;
  if not has_function_privilege('supabase_auth_admin', 'public.hook_mfa_tentativas(jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.hook_mfa_tentativas(jsonb)', 'execute')
     or has_function_privilege('anon', 'public.hook_mfa_tentativas(jsonb)', 'execute')
     or has_function_privilege('service_role', 'public.hook_mfa_tentativas(jsonb)', 'execute') then
    raise exception 'hook_mfa_tentativas: permissões de execução incorretas';
  end if;
  if has_table_privilege('authenticated', 'public.mfa_tentativas_erradas', 'select')
     or has_table_privilege('anon', 'public.mfa_tentativas_erradas', 'select')
     or has_table_privilege('service_role', 'public.mfa_tentativas_erradas', 'select') then
    raise exception 'mfa_tentativas_erradas: leitura aberta demais';
  end if;
end
$c$;

commit;
