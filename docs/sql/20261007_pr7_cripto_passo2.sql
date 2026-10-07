-- =============================================================================
-- PR 7 — passo 2 (ESBOÇO PARA REVISÃO: NÃO APLICAR, NÃO COMMITAR).
-- Apaga as colunas de texto de PII (agora só existem as _enc/_hmac) e converte TODO gravador para gravar _enc.
-- Aplicar à mão no SQL Editor (UTF-8 via pbcopy, NUNCA TextEdit). NÃO vai para supabase/migrations.
-- Pré-requisitos: 20261007_pr7_cripto_passo1.sql e 20261007_pr7_cripto_rpcs.sql aplicados; front do PR 7 no ar
-- (só usa as RPCs pr7_*); decisões de DPO resolvidas (ver PENDENTE em 2e e TODO no fim). ENSAIAR inteiro em
-- `begin … rollback` pela API antes de aplicar, num banco com cópia dos dados de produção.
--
-- DESFAZER: NÃO HÁ VOLTA TRIVIAL. Depois do DROP COLUMN o texto só volta por RESTORE DE SNAPSHOT/BACKUP feito ANTES
-- de aplicar (tire o snapshot e confirme que ele restaura). Reconstruir o texto a partir das _enc é possível (pr7_dec,
-- com a chave pr7_pii_key do Vault) mas exige recriar colunas, CHECKs e as versões antigas das funções/gatilhos dos
-- arquivos citados abaixo. Não troque nem apague a chave do Vault.
--
-- ORDEM OPERACIONAL: o DROP quebra a Edge Function delete-account atual (ela grava cpf/cnpj/pix_key/bank_account em
-- texto). Publicar a versão nova dela (chama rpc pr7_anonimizar_pii, ver 2e) LOGO depois do commit deste arquivo;
-- até lá, excluir conta dá erro 500 (falha segura: nada é apagado, o usuário tenta de novo).
--
-- Fontes lidas e replicadas (arquivo:linha no repositório):
--   gatilhos/helpers .......... 20261007_pr7_cripto_passo1.sql:66-92 (helpers), 119-209 (gatilhos zz_pr7_sync_*)
--   RPCs de escrita ........... 20261007_pr7_cripto_rpcs.sql:65-83, 126-165, 188-214
--   convite_aceitar ........... 20261002_convite_colaborador.sql:416-544 (CHECKs staff_*: 114-157)
--   histórico de pagamento .... 20261002_convite_colaborador.sql:217-235
--   gf_protect_producer_... ... 20261014_admin_s3_permissao_dinheiro.sql:301-357 (md5 S3 5c97dec6…, linha 119)
--   trilha S5 ................. 20261016_admin_s5_trilha.sql:352-362 (spec) e 366-390 (loop que cria os gatilhos)
--   reauth staff .............. 20261019_admin_s9_reautenticar.sql:256-261
--   afiliados ................. 20260929_afiliados_v2.sql:77-90 (dados_chk, índice cpf)
--   meu_perfil ................ 20261018a_admin_s4b_funcoes.sql:119-128
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 0. Pré-requisitos: passo 1 e RPCs aplicados; gf_protect na versão S3 que este arquivo reescreve ----------------
do $$ begin
  if to_regprocedure('public.pr7_enc(text)') is null or to_regprocedure('public.pr7_hmac(text)') is null
     or to_regprocedure('public.pr7_produtor_financeiro()') is null then
    raise exception 'passo 1 / RPCs do PR 7 não aplicados';
  end if;
  if md5(pg_get_functiondef('public.gf_protect_producer_profile_privileges()'::regprocedure)) <> '5c97dec667d533f5e761742ce43fa698' then
    raise exception 'gf_protect_producer_profile_privileges mudou desde a S3 (md5 diferente): refazer 3d a partir da definição atual';
  end if;
  -- 0b. Falha-segura: PII ANTIGA em claro no histórico de pagamento do colaborador. Hoje 0 linhas (Decisão 185);
  --     o gatilho novo (3b') passa a gravar cifrado, mas linhas velhas em claro contradizem "PII só cifrada".
  --     Se houver, redigir antes (como o bloco de redação do admin_audit_log faz para a trilha).
  if exists (select 1 from public.staff_profiles_historico_pagamento h
             where h.antes ?| array['pix_chave','banco','agencia','conta','pix_tipo']
                or h.depois ?| array['pix_chave','banco','agencia','conta','pix_tipo']) then
    raise exception 'há PII antiga em claro em staff_profiles_historico_pagamento: redigir antes de aplicar o passo 2';
  end if;
end $$;

-- 1. cnpj_hmac (Decisão 176b): unicidade do CNPJ sem o texto ----------------------------------------------------
alter table public.producer_profiles add column if not exists cnpj_hmac bytea;
-- 'REMOVIDO-<uid>' é o marcador de conta excluída (delete-account), não é CNPJ: fica sem hmac.
-- O índice único novo substitui o UNIQUE de cnpj (que cai no DROP). Se duas linhas tiverem o mesmo CNPJ com máscaras
-- diferentes, a criação do índice falha e a transação toda aborta (falha segura): resolver à mão antes.
update public.producer_profiles set cnpj_hmac = public.pr7_hmac(cnpj)
  where cnpj is not null and cnpj not like 'REMOVIDO-%'
    and nullif(regexp_replace(cnpj, '\D', '', 'g'), '') is not null and cnpj_hmac is null;
create unique index if not exists producer_profiles_cnpj_hmac_idx
  on public.producer_profiles (cnpj_hmac) where cnpj_hmac is not null;

-- 2. Gravadores passam a gravar _enc ------------------------------------------------------------------------------
-- Helper novo: a cifra do pgcrypto é aleatória (cada pr7_enc dá bytes diferentes). Sem este helper, TODO UPDATE que
-- regrava o mesmo valor mudaria a _enc e dispararia as trilhas S5 e a trava de reautenticação S9 (WHEN "distinct")
-- à toa, o que o gatilho zz_pr7_sync_* evitava (só recifrava se o texto mudasse). Devolve a _enc atual se o valor
-- decifrado for igual; senão cifra de novo. Sem grant: só chamada de dentro de SECURITY DEFINER.
create or replace function public.pr7_enc_se_mudou(p_novo text, p_atual bytea)
returns bytea language sql volatile security definer set search_path = '' as $$
  select case
    when p_novo is null then null
    when p_atual is not null and public.pr7_dec(p_atual) is not distinct from p_novo then p_atual
    else public.pr7_enc(p_novo) end;
$$;
revoke all on function public.pr7_enc_se_mudou(text, bytea) from public, anon, authenticated, service_role;

-- 2a. produtor: CNPJ, Pix e conta bancária. Validação de CNPJ = a da RPC atual no working tree (v_cnpj: só dígitos,
-- '' vira null, 14 dígitos); alinhado à alteração ainda não commitada em 20261007_pr7_cripto_rpcs.sql.
-- ponytail: não existe gf_cnpj_valido no banco (só cnpjValido no front, app/src/lib/formatters.ts:52); criar um agora
-- apertaria uma regra que a RPC não tinha. Trocar por dígito verificador quando o jurídico/produto pedir.
create or replace function public.pr7_salvar_produtor_financeiro(
  p_cnpj text, p_pix_key text, p_bank_account jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
        v_cnpj text := nullif(regexp_replace(coalesce(p_cnpj,''),'\D','','g'), '');  -- '' ou formatação -> null/dígitos
begin
  if v_uid is null then raise exception 'sem sessão' using errcode='42501'; end if;
  if not public.gf_mfa_ok() then
    raise exception 'Reautenticação de dois fatores necessária.' using errcode='42501';
  end if;
  if v_cnpj is not null and length(v_cnpj) <> 14 then
    raise exception 'CNPJ inválido' using errcode='23514';
  end if;
  insert into public.producer_profiles as pp (id, company_name, cnpj_enc, cnpj_hmac, bank_account_enc, pix_key_enc, notification_settings)
    values (v_uid, coalesce((select full_name from public.profiles where id=v_uid),'Minha Empresa'),
            public.pr7_enc(v_cnpj), public.pr7_hmac(v_cnpj),
            public.pr7_enc(coalesce(p_bank_account,'{}'::jsonb)::text),
            public.pr7_enc(coalesce(p_pix_key,'')), '{}'::jsonb)
  on conflict (id) do update
    set cnpj_enc = public.pr7_enc_se_mudou(v_cnpj, pp.cnpj_enc),
        cnpj_hmac = public.pr7_hmac(v_cnpj),
        pix_key_enc = public.pr7_enc_se_mudou(coalesce(p_pix_key,''), pp.pix_key_enc),
        bank_account_enc = public.pr7_enc_se_mudou(coalesce(p_bank_account,'{}'::jsonb)::text, pp.bank_account_enc);
end $$;

-- Leitores: sem o gatilho, a linha criada por admin (INSERT pela API) fica com bank_account_enc nulo (o texto tinha
-- default '{}' e NOT NULL). Devolver '{}' como antes. Resto idêntico a 20261007_pr7_cripto_rpcs.sql:52-63 e 86-101.
create or replace function public.pr7_produtor_financeiro()
returns table(cnpj text, pix_key text, bank_account jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.gf_mfa_ok() then
    raise exception 'Reautenticação de dois fatores necessária.' using errcode='42501';
  end if;
  return query
    select public.pr7_dec(p.cnpj_enc), public.pr7_dec(p.pix_key_enc),
           coalesce(public.pr7_dec(p.bank_account_enc)::jsonb, '{}'::jsonb)
    from public.producer_profiles p where p.id = (select auth.uid());
end $$;

-- Decisão 1 (Ricardo): trilha de quem leu os saques com Pix/banco completos. Só de inserção, pela função; sem acesso
-- pela API (mesmo padrão de staff_profiles_acessos, 20261002_convite_colaborador.sql:238-248). O CSV usa a mesma RPC.
create table if not exists public.withdrawals_acessos (
  id uuid primary key default gen_random_uuid(),
  leitor uuid,
  lido_em timestamptz not null default now(),
  linhas int
);
alter table public.withdrawals_acessos enable row level security;
revoke all on public.withdrawals_acessos from public, anon, authenticated, service_role;
grant select on public.withdrawals_acessos to service_role;

-- VOLATILE (grava a trilha). Conta as linhas que vai devolver (limit 1000, como a consulta).
create or replace function public.pr7_admin_saques()
returns table(id uuid, amount numeric, status text, created_at timestamptz, processed_at timestamptz,
              pix_key text, bank_account jsonb, produtor_nome text, produtor_email text)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.gf_admin_can('manage_finance') then
    raise exception 'Só quem administra finanças vê os saques.' using errcode='42501';
  end if;
  insert into public.withdrawals_acessos (leitor, linhas)
    select (select auth.uid()), least(count(*), 1000)::int
    from public.withdrawals w join public.profiles pr on pr.id = w.producer_id;
  return query
    select w.id, w.amount, w.status, w.created_at, w.processed_at,
           public.pr7_dec(w.pix_key_enc), coalesce(public.pr7_dec(w.bank_account_enc)::jsonb, '{}'::jsonb),
           pr.full_name, pr.email
    from public.withdrawals w
    join public.profiles pr on pr.id = w.producer_id
    order by w.created_at desc limit 1000;
end $$;

-- 2b. afiliado: CPF (validação gf_cpf_valido e permissão manage_affiliates mantidas; a do gatilho zz_pr7_sync_affiliates
-- que valia para escrita direta cai com ele: a escrita passa a ser só por esta RPC)
create or replace function public.pr7_salvar_afiliado(
  p_id uuid, p_cpf text, p_full_name text, p_birth_date date, p_email text, p_phone text,
  p_whatsapp text, p_cep text, p_street text, p_street_number text, p_complement text,
  p_neighborhood text, p_city text, p_state text, p_recurring_percent numeric, p_status text,
  p_agreement_date date, p_notes text, p_user_id uuid default null, p_referral_code text default null,
  p_payout_account_id text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid := p_id; v_cpf text := nullif(regexp_replace(coalesce(p_cpf,''),'\D','','g'),'');
begin
  if not public.gf_admin_can('manage_affiliates') then
    raise exception 'Sem permissão para afiliados.' using errcode='42501';
  end if;
  if v_cpf is not null and not public.gf_cpf_valido(v_cpf) then
    raise exception 'CPF de afiliado inválido' using errcode='23514';
  end if;
  if p_id is null then
    if v_cpf is null then raise exception 'CPF obrigatório' using errcode='23514'; end if;
    insert into public.platform_affiliates
      (user_id, referral_code, cpf_enc, cpf_hmac, full_name, birth_date, email, phone, whatsapp, cep, street,
       street_number, complement, neighborhood, city, state, recurring_percent, status,
       agreement_date, notes, payout_account_id, created_by)
    values (p_user_id, p_referral_code, public.pr7_enc(v_cpf), public.pr7_hmac(v_cpf), p_full_name, p_birth_date,
       p_email, p_phone, p_whatsapp,
       p_cep, p_street, p_street_number, p_complement, p_neighborhood, p_city, p_state,
       p_recurring_percent, p_status, p_agreement_date, p_notes, p_payout_account_id, (select auth.uid()))
    returning id into v_id;
  else
    update public.platform_affiliates set
      full_name=p_full_name, birth_date=p_birth_date, email=p_email, phone=p_phone, whatsapp=p_whatsapp,
      cep=p_cep, street=p_street, street_number=p_street_number, complement=p_complement,
      neighborhood=p_neighborhood, city=p_city, state=p_state, recurring_percent=p_recurring_percent,
      status=p_status, agreement_date=p_agreement_date, notes=p_notes,
      cpf_enc  = case when v_cpf is null then cpf_enc  else public.pr7_enc_se_mudou(v_cpf, cpf_enc) end,
      cpf_hmac = case when v_cpf is null then cpf_hmac else public.pr7_hmac(v_cpf) end,
      payout_account_id = coalesce(payout_account_id, p_payout_account_id),
      updated_at = now()
    where id = p_id;
    if not found then raise exception 'Afiliado não encontrado' using errcode='P0001'; end if;
  end if;
  return v_id;
end $$;

-- 2c. staff (próprio cadastro): grava *_enc e leva para dentro as validações dos CHECKs staff_cpf_ok, staff_rg_ok,
-- staff_banco_ok e staff_pix_ok (caem com o DROP COLUMN). Mesmas regras, sobre os mesmos valores crus que o CHECK via.
-- staff_endereco_ok e os demais CHECKs não tocam coluna apagada: continuam na tabela.
create or replace function public.pr7_salvar_meu_cadastro(
  p_nome_completo text, p_cpf text, p_rg text, p_data_nascimento date, p_cep text, p_rua text,
  p_numero text, p_complemento text, p_bairro text, p_cidade text, p_uf text, p_email_secundario text,
  p_telefone text, p_whatsapp text, p_emergencia_nome text, p_emergencia_parentesco text,
  p_emergencia_telefone text, p_banco text, p_agencia text, p_conta text, p_pix_tipo text, p_pix_chave text,
  p_updated_at timestamptz)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_cpf text := regexp_replace(coalesce(p_cpf,''),'\D','','g'); v_ts timestamptz;
begin
  if v_uid is null then raise exception 'sem sessão' using errcode='42501'; end if;
  if not (coalesce(auth.jwt() ->> 'aal','') = 'aal2' and public.gf_tem_2fa(v_uid) is true) then
    raise exception 'Reautenticação de dois fatores necessária para alterar o cadastro.' using errcode='42501';
  end if;
  -- colunas que eram NOT NULL no texto (cpf já é coberto abaixo: vazio vira '' e não passa em gf_cpf_valido)
  if p_rg is null or p_pix_tipo is null or p_pix_chave is null then
    raise exception 'Preencha todos os campos obrigatórios.' using errcode='23502';
  end if;
  if not public.gf_cpf_valido(v_cpf) then raise exception 'CPF inválido' using errcode='23514'; end if;
  if char_length(btrim(p_rg)) not between 3 and 20 then raise exception 'Informe o RG.' using errcode='23514'; end if;
  if char_length(p_banco) > 80 or char_length(p_agencia) > 20 or char_length(p_conta) > 30 then
    raise exception 'Dados bancários longos demais.' using errcode='23514';
  end if;
  if not (case p_pix_tipo
      when 'cpf' then public.gf_cpf_valido(p_pix_chave)
      when 'email' then p_pix_chave = lower(btrim(p_pix_chave)) and char_length(p_pix_chave) <= 77 and p_pix_chave ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
      when 'telefone' then p_pix_chave ~ '^\+55[0-9]{10,11}$'
      when 'aleatoria' then p_pix_chave ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      else false end) then
    raise exception 'A chave Pix não confere com o tipo escolhido.' using errcode='23514';
  end if;
  update public.staff_profiles set
    nome_completo=p_nome_completo, data_nascimento=p_data_nascimento, cep=p_cep,
    rua=p_rua, numero=p_numero, complemento=p_complemento, bairro=p_bairro, cidade=p_cidade, uf=p_uf,
    email_secundario=p_email_secundario, telefone=p_telefone, whatsapp=p_whatsapp,
    emergencia_nome=p_emergencia_nome, emergencia_parentesco=p_emergencia_parentesco,
    emergencia_telefone=p_emergencia_telefone,
    cpf_enc = public.pr7_enc_se_mudou(v_cpf, cpf_enc),
    rg_enc = public.pr7_enc_se_mudou(p_rg, rg_enc),
    banco_enc = public.pr7_enc_se_mudou(p_banco, banco_enc),
    agencia_enc = public.pr7_enc_se_mudou(p_agencia, agencia_enc),
    conta_enc = public.pr7_enc_se_mudou(p_conta, conta_enc),
    pix_tipo_enc = public.pr7_enc_se_mudou(p_pix_tipo, pix_tipo_enc),
    pix_chave_enc = public.pr7_enc_se_mudou(p_pix_chave, pix_chave_enc),
    updated_at=now()
  where user_id = v_uid and updated_at = p_updated_at
  returning updated_at into v_ts;
  if v_ts is null then raise exception 'Não foi possível salvar: o cadastro foi alterado em outra aba ou não existe. Recarregue a página.' using errcode='P0001'; end if;
  return v_ts;
end $$;

-- 2d. convite_aceitar (cópia de 20261002_convite_colaborador.sql:416-544; muda só: variáveis v_cpf/v_rg/v_banco/
-- v_agencia/v_conta/v_pix_chave, checagens explícitas ANTES do insert no lugar dos CHECKs staff_cpf_ok/staff_rg_ok/
-- staff_banco_ok/staff_pix_ok, e o insert/upsert em *_enc). Os demais CHECKs continuam na tabela e no mapeamento de erro.
create or replace function public.convite_aceitar(p_token text, p_dados jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.admin_invites%rowtype;
  v_uid uuid := (select auth.uid());
  v_email text := lower(coalesce(auth.email(), auth.jwt() ->> 'email'));
  d jsonb := coalesce(p_dados, '{}'::jsonb);
  v_nasc date;
  v_pix_tipo text := d ->> 'pix_tipo';
  v_cpf text;
  v_rg text;
  v_banco text;
  v_agencia text;
  v_conta text;
  v_pix_chave text;
  v_claims text;
  v_cons text;
  v_n int;
begin
  -- 1. hash do token (trava o convite até o fim da transação: dois aceites do mesmo token não passam)
  select * into v from public.admin_invites i where i.token_hash = public.convite_hash(p_token) for update;
  if not found then
    raise exception 'Convite inválido ou expirado.' using errcode = 'P0001';
  end if;
  -- 2. pendente e no prazo (mesma mensagem: não diz se foi usado, cancelado ou venceu)
  if v.status <> 'pendente' or v.expires_at <= now() then
    raise exception 'Convite inválido ou expirado.' using errcode = 'P0001';
  end if;
  -- 3. a conta é a do e-mail convidado
  if v_uid is null or v_email is distinct from v.email then
    raise exception 'Entre com a conta do e-mail que recebeu o convite.' using errcode = '42501';
  end if;
  -- 4. 2FA: fator confirmado e o código digitado nesta sessão (a mesma exigência de gf_is_admin)
  if not (public.gf_mfa_ok() and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
          and exists (select 1 from auth.mfa_factors f where f.user_id = v_uid and f.status = 'verified')) then
    raise exception 'Ative a verificação em duas etapas e entre com o código antes de concluir o cadastro.' using errcode = '42501';
  end if;
  -- quem já é admin não passa por aqui (as permissões do convite substituiriam as dele, inclusive super_admin)
  if exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'admin') then
    raise exception 'Esta conta já faz parte dos colaboradores da Evokaa.' using errcode = 'P0001';
  end if;
  -- conta de produtor viraria admin e perderia o painel do produtor: o convite é para um e-mail só do trabalho
  if exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'producer') then
    raise exception 'Este e-mail já tem uma conta de produtor. Convide outro e-mail, só para o trabalho na Evokaa.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.team_members t where t.user_id = v_uid) then
    raise exception 'Este e-mail faz parte da equipe de um produtor. Convide outro e-mail, só para o trabalho na Evokaa.' using errcode = 'P0001';
  end if;

  -- 5. campos
  begin
    v_nasc := (d ->> 'data_nascimento')::date;
  exception when others then
    raise exception 'Data de nascimento inválida.' using errcode = '22023';
  end;
  -- valores normalizados (os mesmos que o insert gravava em texto)
  v_cpf := regexp_replace(nullif(btrim(d ->> 'cpf'), ''), '\D', '', 'g');
  v_rg := nullif(btrim(d ->> 'rg'), '');
  v_banco := nullif(btrim(d ->> 'banco'), '');
  v_agencia := nullif(btrim(d ->> 'agencia'), '');
  v_conta := nullif(btrim(d ->> 'conta'), '');
  v_pix_chave := case v_pix_tipo
    when 'cpf' then regexp_replace(nullif(btrim(d ->> 'pix_chave'), ''), '\D', '', 'g')
    when 'email' then lower(nullif(btrim(d ->> 'pix_chave'), ''))
    when 'aleatoria' then lower(nullif(btrim(d ->> 'pix_chave'), ''))
    else nullif(btrim(d ->> 'pix_chave'), '') end;
  -- as regras dos CHECKs staff_* que caíram com as colunas de texto (mesmas mensagens)
  if v_cpf is null or v_rg is null or v_pix_tipo is null or v_pix_chave is null then
    raise exception 'Preencha todos os campos obrigatórios.' using errcode = '22023';
  end if;
  if not public.gf_cpf_valido(v_cpf) then
    raise exception 'CPF inválido.' using errcode = '22023';
  end if;
  if char_length(btrim(v_rg)) not between 3 and 20 then
    raise exception 'Informe o RG.' using errcode = '22023';
  end if;
  if char_length(v_banco) > 80 or char_length(v_agencia) > 20 or char_length(v_conta) > 30 then
    raise exception 'Dados bancários longos demais.' using errcode = '22023';
  end if;
  if not (case v_pix_tipo
      when 'cpf' then public.gf_cpf_valido(v_pix_chave)
      when 'email' then v_pix_chave = lower(btrim(v_pix_chave)) and char_length(v_pix_chave) <= 77 and v_pix_chave ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
      when 'telefone' then v_pix_chave ~ '^\+55[0-9]{10,11}$'
      when 'aleatoria' then v_pix_chave ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      else false end) then
    raise exception 'A chave Pix não confere com o tipo escolhido.' using errcode = '22023';
  end if;
  begin
    insert into public.staff_profiles as s (user_id, invite_id, email, cargo, nome_completo, cpf_enc, rg_enc, data_nascimento, cep, rua,
      numero, complemento, bairro, cidade, uf, email_secundario, telefone, whatsapp, emergencia_nome, emergencia_parentesco,
      emergencia_telefone, banco_enc, agencia_enc, conta_enc, pix_tipo_enc, pix_chave_enc)
    values (v_uid, v.id, v.email, v.cargo,
      -- apóstrofo curvo do iPhone vira reto; forma decomposta vira NFC (a regra staff_nome_ok olha a forma composta)
      normalize(nullif(replace(btrim(d ->> 'nome_completo'), '’', ''''), ''), NFC),
      public.pr7_enc(v_cpf),
      public.pr7_enc(v_rg),
      v_nasc,
      regexp_replace(nullif(btrim(d ->> 'cep'), ''), '\D', '', 'g'),
      nullif(btrim(d ->> 'rua'), ''),
      nullif(btrim(d ->> 'numero'), ''),
      nullif(btrim(d ->> 'complemento'), ''),
      nullif(btrim(d ->> 'bairro'), ''),
      nullif(btrim(d ->> 'cidade'), ''),
      upper(nullif(btrim(d ->> 'uf'), '')),
      lower(nullif(btrim(d ->> 'email_secundario'), '')),
      nullif(btrim(d ->> 'telefone'), ''),
      nullif(btrim(d ->> 'whatsapp'), ''),
      nullif(btrim(d ->> 'emergencia_nome'), ''),
      nullif(btrim(d ->> 'emergencia_parentesco'), ''),
      nullif(btrim(d ->> 'emergencia_telefone'), ''),
      public.pr7_enc(v_banco),
      public.pr7_enc(v_agencia),
      public.pr7_enc(v_conta),
      public.pr7_enc(v_pix_tipo),
      public.pr7_enc(v_pix_chave))
    -- conta que já foi colaboradora (e saiu) e foi convidada de novo: o cadastro é refeito
    on conflict (user_id) do update set invite_id = excluded.invite_id, email = excluded.email, cargo = excluded.cargo,
      nome_completo = excluded.nome_completo, data_nascimento = excluded.data_nascimento,
      cep = excluded.cep, rua = excluded.rua, numero = excluded.numero, complemento = excluded.complemento,
      bairro = excluded.bairro, cidade = excluded.cidade, uf = excluded.uf, email_secundario = excluded.email_secundario,
      telefone = excluded.telefone, whatsapp = excluded.whatsapp, emergencia_nome = excluded.emergencia_nome,
      emergencia_parentesco = excluded.emergencia_parentesco, emergencia_telefone = excluded.emergencia_telefone,
      cpf_enc = public.pr7_enc_se_mudou(v_cpf, s.cpf_enc), rg_enc = public.pr7_enc_se_mudou(v_rg, s.rg_enc),
      banco_enc = public.pr7_enc_se_mudou(v_banco, s.banco_enc), agencia_enc = public.pr7_enc_se_mudou(v_agencia, s.agencia_enc),
      conta_enc = public.pr7_enc_se_mudou(v_conta, s.conta_enc), pix_tipo_enc = public.pr7_enc_se_mudou(v_pix_tipo, s.pix_tipo_enc),
      pix_chave_enc = public.pr7_enc_se_mudou(v_pix_chave, s.pix_chave_enc), updated_at = now();
  exception
    when not_null_violation then
      raise exception 'Preencha todos os campos obrigatórios.' using errcode = '22023';
    when check_violation then
      get stacked diagnostics v_cons = constraint_name;
      raise exception '%', case v_cons
        when 'staff_nome_ok' then 'Informe o nome completo, só com letras, espaço, apóstrofo, ponto ou hífen (sem endereço de site).'
        when 'staff_nascimento_ok' then 'Data de nascimento inválida: é preciso ter 18 anos ou mais.'
        when 'staff_cep_ok' then 'CEP: 8 dígitos.'
        when 'staff_endereco_ok' then 'Endereço incompleto (rua, número, bairro e cidade).'
        when 'staff_uf_ok' then 'Escolha o estado (UF).'
        when 'staff_email_secundario_ok' then 'E-mail secundário inválido ou igual ao e-mail principal.'
        when 'staff_telefones_ok' then 'Telefone ou WhatsApp inválido.'
        when 'staff_emergencia_ok' then 'Contato de emergência incompleto (nome, parentesco e telefone).'
        else 'Dados do cadastro inválidos.' end using errcode = '22023';
  end;

  -- papel e permissões vêm do convite gravado, nunca de quem chama. Sem as claims, o gatilho
  -- gf_protect_profile_privileges trata o UPDATE como do dono do banco (ver o cabeçalho de 20261002); elas voltam em seguida.
  v_claims := current_setting('request.jwt.claims', true);
  perform set_config('request.jwt.claims', '', true);
  update public.profiles set role = 'admin', admin_permissions = v.permissions where id = v_uid;
  get diagnostics v_n = row_count;
  perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  if v_n <> 1 then
    raise exception 'Perfil da conta não encontrado.' using errcode = 'P0001';
  end if;

  update public.admin_invites set status = 'usado', used_by = v_uid, used_at = now() where id = v.id;
end;
$$;

-- 2e. delete-account: as colunas de texto somem, o TS não pode mais gravá-las. Uma RPC só (service_role).
-- Substitui, em supabase/functions/delete-account/index.ts: em 'profiles' tirar `cpf: null`; em 'producer_profiles'
-- tirar cnpj, bank_account e pix_key do update (ficam company_name, stripe/woovi, webhook, notification_settings,
-- is_verified); trocar os passos 'withdrawals' e 'platform_affiliates' por UM passo
--   ['pii', () => admin.rpc('pr7_anonimizar_pii', { p_uid: uid })]
-- (a RPC devolve void; rpc() entrega { error }). A comparação de unicidade do CNPJ antigo ('REMOVIDO-<uid>') some:
-- cnpj nulo não colide (índice parcial).
-- Decisão 2 (Ricardo): afiliado MANTÉM como está: só o CPF sai (cpf_enc/cpf_hmac). Nome, e-mail e endereço NÃO são
-- anonimizados aqui.
-- ATENÇÃO: a Edge Function delete-account (já editada neste branch) precisa ser PUBLICADA logo depois de aplicar este
-- arquivo (supabase functions deploy delete-account); até lá a exclusão de conta dá erro 500.
create or replace function public.pr7_anonimizar_pii(p_uid uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.producer_profiles
    set cnpj_enc = null, cnpj_hmac = null, pix_key_enc = null, bank_account_enc = public.pr7_enc('{}')
    where id = p_uid;
  update public.withdrawals
    set pix_key_enc = null, bank_account_enc = public.pr7_enc('{}')
    where producer_id = p_uid;
  update public.platform_affiliates set cpf_enc = null, cpf_hmac = null where user_id = p_uid;
  update public.profiles set cpf_enc = null where id = p_uid;
end $$;
revoke all on function public.pr7_anonimizar_pii(uuid) from public, anon, authenticated, service_role;
grant execute on function public.pr7_anonimizar_pii(uuid) to service_role;

-- 3. Gatilhos/funções que liam o texto ---------------------------------------------------------------------------
-- 3a. keep-in-sync do passo 1 (a partir daqui o texto não é mais fonte de nada)
drop trigger if exists zz_pr7_sync_profiles on public.profiles;
drop trigger if exists zz_pr7_sync_affiliates on public.platform_affiliates;
drop trigger if exists zz_pr7_sync_producer on public.producer_profiles;
drop trigger if exists zz_pr7_sync_withdrawals on public.withdrawals;
drop trigger if exists zz_pr7_sync_staff on public.staff_profiles;
drop function if exists public.pr7_sync_profiles(), public.pr7_sync_affiliates(), public.pr7_sync_producer(),
  public.pr7_sync_withdrawals(), public.pr7_sync_staff();

-- 3b. S9: trava de reautenticação ao mudar Pix/banco do colaborador (20261019_admin_s9_reautenticar.sql:256-261)
drop trigger if exists staff_profiles_reauth_dinheiro on public.staff_profiles;
create trigger staff_profiles_reauth_dinheiro before update on public.staff_profiles
  for each row when (old.invite_id is not distinct from new.invite_id
    and (old.banco_enc is distinct from new.banco_enc or old.agencia_enc is distinct from new.agencia_enc
      or old.conta_enc is distinct from new.conta_enc or old.pix_tipo_enc is distinct from new.pix_tipo_enc
      or old.pix_chave_enc is distinct from new.pix_chave_enc)) execute function public.gf_reauth_dinheiro();

-- 3b'. Histórico de pagamento do colaborador (NÃO estava na spec; achado: o gatilho tem WHEN sobre as colunas de
-- texto, e DROP COLUMN sem CASCADE falharia). Mesma regra, sobre as _enc. O corpo NÃO grava mais Pix/banco em claro:
-- guarda a cifra (hex), decifrável com pr7_dec(decode(valor,'hex')) por quem tem a chave.
-- (20261002_convite_colaborador.sql:217-235)
create or replace function public.staff_profiles_registra_pagamento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.staff_profiles_historico_pagamento (user_id, alterado_por, antes, depois)
  values (new.user_id, (select auth.uid()),
    jsonb_build_object('pix_tipo_enc', encode(old.pix_tipo_enc, 'hex'), 'pix_chave_enc', encode(old.pix_chave_enc, 'hex'),
      'banco_enc', encode(old.banco_enc, 'hex'), 'agencia_enc', encode(old.agencia_enc, 'hex'), 'conta_enc', encode(old.conta_enc, 'hex')),
    jsonb_build_object('pix_tipo_enc', encode(new.pix_tipo_enc, 'hex'), 'pix_chave_enc', encode(new.pix_chave_enc, 'hex'),
      'banco_enc', encode(new.banco_enc, 'hex'), 'agencia_enc', encode(new.agencia_enc, 'hex'), 'conta_enc', encode(new.conta_enc, 'hex')));
  return null;
end;
$$;
drop trigger if exists staff_profiles_registra_pagamento on public.staff_profiles;
create trigger staff_profiles_registra_pagamento after update on public.staff_profiles
  for each row when (old.pix_tipo_enc is distinct from new.pix_tipo_enc or old.pix_chave_enc is distinct from new.pix_chave_enc
    or old.banco_enc is distinct from new.banco_enc or old.agencia_enc is distinct from new.agencia_enc
    or old.conta_enc is distinct from new.conta_enc)
  execute function public.staff_profiles_registra_pagamento();
-- (create or replace preserva dono e grants; o revoke de 20261002:570 continua valendo)

-- 3c. S5: trilha. audit_registra() usa as listas só como nomes de chave de to_jsonb(row): trocar texto por _enc.
-- Oculto continua oculto («oculto»): a trilha registra o FATO da mudança, nunca o valor/bytes.
-- producer_profiles (20261016_admin_s5_trilha.sql:355). Só UPDATE, como antes.
drop trigger if exists audit_producer_profiles_upd on public.producer_profiles;
create trigger audit_producer_profiles_upd after update on public.producer_profiles for each row
  when (old.commission_rate is distinct from new.commission_rate or old.is_verified is distinct from new.is_verified
    or old.pix_key_enc is distinct from new.pix_key_enc or old.bank_account_enc is distinct from new.bank_account_enc
    or old.cnpj_enc is distinct from new.cnpj_enc or old.stripe_account_id is distinct from new.stripe_account_id
    or old.woovi_account_id is distinct from new.woovi_account_id)
  execute function public.audit_registra('id',
    'commission_rate,is_verified,pix_key_enc,bank_account_enc,cnpj_enc,stripe_account_id,woovi_account_id',
    'pix_key_enc,bank_account_enc,cnpj_enc,stripe_account_id,woovi_account_id,webhook_url,notification_settings,company_name,api_key');
-- platform_affiliates (S5 linha 362): cpf -> cpf_enc nas duas listas; ins/upd/del como antes.
drop trigger if exists audit_platform_affiliates_ins on public.platform_affiliates;
create trigger audit_platform_affiliates_ins after insert on public.platform_affiliates for each row when (true)
  execute function public.audit_registra('id',
    'user_id,referral_code,recurring_percent,status,agreement_date,full_name,notes,cpf_enc,payout_account_id',
    'full_name,notes,cpf_enc,birth_date,email,phone,whatsapp,cep,street,street_number,complement,neighborhood,city,state,payout_account_id');
drop trigger if exists audit_platform_affiliates_upd on public.platform_affiliates;
create trigger audit_platform_affiliates_upd after update on public.platform_affiliates for each row when (old.* is distinct from new.*)
  execute function public.audit_registra('id',
    'user_id,referral_code,recurring_percent,status,agreement_date,full_name,notes,cpf_enc,payout_account_id',
    'full_name,notes,cpf_enc,birth_date,email,phone,whatsapp,cep,street,street_number,complement,neighborhood,city,state,payout_account_id');
drop trigger if exists audit_platform_affiliates_del on public.platform_affiliates;
create trigger audit_platform_affiliates_del after delete on public.platform_affiliates for each row when (true)
  execute function public.audit_registra('id',
    'user_id,referral_code,recurring_percent,status,agreement_date,full_name,notes,cpf_enc,payout_account_id',
    'full_name,notes,cpf_enc,birth_date,email,phone,whatsapp,cep,street,street_number,complement,neighborhood,city,state,payout_account_id');
-- 3c'. Decisão 3 (Ricardo): redigir a PII antiga da trilha. Registros anteriores ao passo 2 podem ter, em antes/depois,
-- os valores de pix_key, cnpj e bank_account. Troca SÓ o valor por "[redigido]" (mantém chave e evento). A trilha é
-- imutável por gatilho (admin_audit_log_imutavel): exceção deliberada, desligada só neste bloco, dentro da transação, e
-- religada logo depois (conferido). Revisor/segurança: validar esta exceção.
alter table public.admin_audit_log disable trigger admin_audit_log_imutavel;
update public.admin_audit_log a set
  antes = case when a.antes ?| array['pix_key','cnpj','bank_account'] then
    (select jsonb_object_agg(e.key, case when e.key in ('pix_key','cnpj','bank_account') then '"[redigido]"'::jsonb else e.value end)
     from jsonb_each(a.antes) e) else a.antes end,
  depois = case when a.depois ?| array['pix_key','cnpj','bank_account'] then
    (select jsonb_object_agg(e.key, case when e.key in ('pix_key','cnpj','bank_account') then '"[redigido]"'::jsonb else e.value end)
     from jsonb_each(a.depois) e) else a.depois end
where a.antes ?| array['pix_key','cnpj','bank_account'] or a.depois ?| array['pix_key','cnpj','bank_account'];
alter table public.admin_audit_log enable trigger admin_audit_log_imutavel;
do $$ begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.admin_audit_log'::regclass
                 and tgname = 'admin_audit_log_imutavel' and tgenabled = 'O') then
    raise exception 'gatilho de imutabilidade da trilha não foi religado';
  end if;
  if exists (select 1 from public.admin_audit_log a
             where (a.antes ?| array['pix_key','cnpj','bank_account'] and exists (select 1 from jsonb_each(a.antes) e
                      where e.key in ('pix_key','cnpj','bank_account') and e.value <> '"[redigido]"'::jsonb))
                or (a.depois ?| array['pix_key','cnpj','bank_account'] and exists (select 1 from jsonb_each(a.depois) e
                      where e.key in ('pix_key','cnpj','bank_account') and e.value <> '"[redigido]"'::jsonb))) then
    raise exception 'ainda há PII antiga em admin_audit_log';
  end if;
end $$;
-- withdrawals (S5 linha 356) e profiles (linha 353): a condição e as colunas vigiadas NÃO citam o texto; os nomes na
-- lista "ocultas" (pix_key,bank_account / cpf) não estão entre as vigiadas, logo nunca tiveram efeito. Sem mudança.

-- 3d. gf_protect_producer_profile_privileges (20261014_admin_s3_permissao_dinheiro.sql:301-353), igual à S3 exceto que
-- cnpj/pix_key/bank_account viram cnpj_enc+cnpj_hmac/pix_key_enc/bank_account_enc. Mantém: id/created_at imutáveis,
-- is_verified (manage_users), comissão/webhook/contas de gateway (super_admin), company_name só do dono.
create or replace function public.gf_protect_producer_profile_privileges()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_dono boolean;
begin
  -- S3 (Decisão 163): regra por coluna
  if not (current_user in ('anon', 'authenticated')
          or coalesce(auth.jwt()->>'role', '') in ('anon', 'authenticated')) then
    return new;
  end if;
  v_dono := coalesce(auth.uid() = (case when tg_op = 'INSERT' then new.id else old.id end), false);
  if tg_op = 'INSERT' then
    -- cadastro de OUTRA pessoa (admin com manage_users): sem CNPJ, Pix e conta bancária
    if not v_dono and (new.cnpj_enc is not null or new.cnpj_hmac is not null
                       or new.pix_key_enc is not null or new.bank_account_enc is not null) then
      raise exception 'Campo protegido não permitido' using errcode = '42501';
    end if;
    if new.is_verified and not public.gf_admin_can('manage_users') then
      raise exception 'Campo protegido não permitido' using errcode = '42501';
    end if;
    if (new.commission_rate is distinct from 10.00
        or new.webhook_url is not null or new.stripe_account_id is not null or new.woovi_account_id is not null)
       and not public.gf_admin_can('super_admin') then
      raise exception 'Campo protegido não permitido' using errcode = '42501';
    end if;
  else
    -- a linha não "muda de dono": id e created_at nunca mudam pelo site
    if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
      raise exception 'Alteração de campo protegido não permitida' using errcode = '42501';
    end if;
    if not v_dono and (new.pix_key_enc is distinct from old.pix_key_enc
                       or new.bank_account_enc is distinct from old.bank_account_enc
                       or new.cnpj_enc is distinct from old.cnpj_enc
                       or new.cnpj_hmac is distinct from old.cnpj_hmac
                       or new.company_name is distinct from old.company_name) then
      raise exception 'Alteração de campo protegido não permitida' using errcode = '42501';
    end if;
    if new.is_verified is distinct from old.is_verified and not public.gf_admin_can('manage_users') then
      raise exception 'Alteração de campo protegido não permitida' using errcode = '42501';
    end if;
    if (new.commission_rate is distinct from old.commission_rate
        or new.webhook_url is distinct from old.webhook_url
        or new.stripe_account_id is distinct from old.stripe_account_id
        or new.woovi_account_id is distinct from old.woovi_account_id)
       and not public.gf_admin_can('super_admin') then
      raise exception 'Alteração de campo protegido não permitida' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
-- (o gatilho gf_protect_producer_profile_privileges já aponta para esta função; create or replace a mantém)

-- 3e. meu_perfil (NÃO estava na spec; achado): devolvia to_jsonb(profiles) menos cpf. Sem a coluna cpf, a chave nova
-- cpf_enc passaria a sair para o navegador. Subtrair cpf_enc (20261018a_admin_s4b_funcoes.sql:119-128).
create or replace function public.meu_perfil()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(p) - array['cpf_enc', 'stripe_customer_id']
  from public.profiles p
  where p.id = (select auth.uid())
    and public.gf_mfa_ok(); -- a mesma regra RESTRICTIVE gf_mfa_aal2 da tabela
$$;

-- 4. Constraints e índices ------------------------------------------------------------------------------------------
-- o platform_affiliates_cpf_hmac_idx (passo 1) já garante a unicidade
drop index if exists public.platform_affiliates_cpf_idx;
-- dados_chk sem a cláusula de cpf (20260929_afiliados_v2.sql:77-87). Sem recriar, o DROP COLUMN levaria junto as outras regras.
alter table public.platform_affiliates drop constraint if exists platform_affiliates_dados_chk;
alter table public.platform_affiliates add constraint platform_affiliates_dados_chk
  check ((birth_date is null or birth_date between date '1900-01-01' and current_date - interval '18 years')
     and (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
     and (phone is null or phone ~ '^[0-9]{10,13}$')
     and (whatsapp is null or whatsapp ~ '^[0-9]{10,13}$')
     and (cep is null or cep ~ '^[0-9]{8}$')
     and (state is null or state ~ '^[A-Z]{2}$')
     and (full_name is null or char_length(full_name) between 3 and 150));
-- staff_cpf_ok/staff_rg_ok/staff_banco_ok/staff_pix_ok caem com as colunas (validação migrada: 2c e 2d).

-- 5. DROP das colunas de texto --------------------------------------------------------------------------------------
-- 5.0 Última chance: o texto ainda bate com a _enc em TODAS as linhas? (depois do DROP não há como comparar)
do $$ begin
  if exists (select 1 from public.profiles where cpf is distinct from public.pr7_dec(cpf_enc))
  or exists (select 1 from public.platform_affiliates where cpf is distinct from public.pr7_dec(cpf_enc)
               or (cpf is null) is distinct from (cpf_hmac is null))
  or exists (select 1 from public.producer_profiles where cnpj is distinct from public.pr7_dec(cnpj_enc)
               or pix_key is distinct from public.pr7_dec(pix_key_enc)
               or bank_account is distinct from public.pr7_dec(bank_account_enc)::jsonb)
  or exists (select 1 from public.withdrawals where pix_key is distinct from public.pr7_dec(pix_key_enc)
               or bank_account is distinct from public.pr7_dec(bank_account_enc)::jsonb)
  or exists (select 1 from public.staff_profiles where cpf is distinct from public.pr7_dec(cpf_enc)
               or rg is distinct from public.pr7_dec(rg_enc) or agencia is distinct from public.pr7_dec(agencia_enc)
               or banco is distinct from public.pr7_dec(banco_enc) or conta is distinct from public.pr7_dec(conta_enc)
               or pix_chave is distinct from public.pr7_dec(pix_chave_enc) or pix_tipo is distinct from public.pr7_dec(pix_tipo_enc)) then
    raise exception 'texto e _enc divergem em alguma linha: NÃO apagar; investigar antes';
  end if;
  -- cnpj_hmac coerente com o texto (exceto o marcador REMOVIDO-)
  if exists (select 1 from public.producer_profiles where cnpj is not null and cnpj not like 'REMOVIDO-%'
               and nullif(regexp_replace(cnpj, '\D', '', 'g'), '') is not null and cnpj_hmac is distinct from public.pr7_hmac(cnpj)) then
    raise exception 'cnpj_hmac incompleto ou divergente';
  end if;
end $$;

-- 5.1 Marcador de conta excluída não é PII: sai da _enc (delete-account antigo gravava 'REMOVIDO-<uid>' em cnpj)
update public.producer_profiles set cnpj_enc = null where cnpj like 'REMOVIDO-%';

-- 5.2 NOT NULL que o texto tinha (cpf, rg, pix_tipo, pix_chave em staff). Produtor/saque: bank_account_enc fica
-- nulável (admin cria linha de outro produtor pela API sem _enc); os leitores devolvem '{}' (2a).
alter table public.staff_profiles
  alter column cpf_enc set not null, alter column rg_enc set not null,
  alter column pix_tipo_enc set not null, alter column pix_chave_enc set not null;

-- 5.3 Referências restantes (informativo; revisar a saída do ensaio). O Postgres já ABORTA o DROP COLUMN se uma
-- view, regra de RLS ou gatilho (WHEN) ainda depender da coluna (sem CASCADE de propósito). Corpos de função plpgsql
-- ele NÃO enxerga: lista as funções de public que ainda citam as colunas apagadas.
do $$ declare r record; begin
  for r in select p.oid::regprocedure as fn from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and p.prosrc ~ '\m(cpf|cnpj|pix_key|bank_account|rg|agencia|banco|conta|pix_chave|pix_tipo)\M'
      and p.proname not in ('gf_cpf_valido', 'convite_aceitar', 'pr7_salvar_meu_cadastro', 'pr7_salvar_afiliado',
                            'pr7_salvar_produtor_financeiro', 'pr7_anonimizar_pii')
  loop
    raise notice 'REVISAR (cita coluna de texto apagada?): %', r.fn;
  end loop;
end $$;

alter table public.profiles drop column cpf;
alter table public.platform_affiliates drop column cpf;
alter table public.producer_profiles drop column cnpj, drop column pix_key, drop column bank_account;
alter table public.withdrawals drop column pix_key, drop column bank_account;
alter table public.staff_profiles drop column cpf, drop column rg, drop column agencia, drop column banco,
  drop column conta, drop column pix_chave, drop column pix_tipo;

-- 6. Conferência que aborta ---------------------------------------------------------------------------------------
do $$
declare r record;
begin
  -- 6.1 nenhuma coluna de texto sobrou
  if exists (select 1 from information_schema.columns c where c.table_schema = 'public' and (c.table_name, c.column_name) in (
      ('profiles','cpf'), ('platform_affiliates','cpf'), ('producer_profiles','cnpj'), ('producer_profiles','pix_key'),
      ('producer_profiles','bank_account'), ('withdrawals','pix_key'), ('withdrawals','bank_account'),
      ('staff_profiles','cpf'), ('staff_profiles','rg'), ('staff_profiles','agencia'), ('staff_profiles','banco'),
      ('staff_profiles','conta'), ('staff_profiles','pix_chave'), ('staff_profiles','pix_tipo'))) then
    raise exception 'sobrou coluna de texto de PII';
  end if;
  -- 6.2 Confidencialidade em repouso = a cifra é INDECIFRÁVEL sem a chave + o RLS gateia as linhas.
  -- As colunas _enc herdam o grant AMPLO de tabela do Supabase (anon/authenticated recebem tudo e o RLS filtra —
  -- padrão de TODA tabela do projeto). Isso expõe só CIPHERTEXT (inútil sem a chave, que está no Vault e cujas
  -- pr7_dec/pr7_key não têm grant) e permite escrita direta da PRÓPRIA linha (questão de integridade, não de sigilo;
  -- mesma postura do resto do projeto). Endurecer para grant por coluna (bloquear escrita direta de _enc) é
  -- PENDÊNCIA de hardening, fora do escopo e do risco do passo 2. A conferência checa o que de fato garante o sigilo:
  if has_function_privilege('anon', 'public.pr7_dec(bytea)', 'execute')
     or has_function_privilege('authenticated', 'public.pr7_dec(bytea)', 'execute')
     or has_function_privilege('anon', 'public.pr7_key()', 'execute')
     or has_function_privilege('authenticated', 'public.pr7_key()', 'execute') then
    raise exception 'pr7_dec/pr7_key executável por anon/authenticated: a cifra seria decifrável — abortar';
  end if;
  if exists (select 1 from pg_class cl where cl.relnamespace = 'public'::regnamespace
             and cl.relname in ('profiles','platform_affiliates','producer_profiles','withdrawals','staff_profiles')
             and not cl.relrowsecurity) then
    raise exception 'RLS desligado em alguma tabela de PII: abortar';
  end if;
  -- 6.3 round-trip (decifra de verdade, uma verificação por tabela) e coerência hmac
  if exists (select 1 from public.staff_profiles where not public.gf_cpf_valido(public.pr7_dec(cpf_enc))
               or public.pr7_dec(pix_tipo_enc) not in ('cpf','email','telefone','aleatoria'))
  or exists (select 1 from public.platform_affiliates where cpf_enc is not null
               and (cpf_hmac is distinct from public.pr7_hmac(public.pr7_dec(cpf_enc)) or not public.gf_cpf_valido(public.pr7_dec(cpf_enc))))
  or exists (select 1 from public.producer_profiles where cnpj_enc is not null
               and cnpj_hmac is distinct from public.pr7_hmac(public.pr7_dec(cnpj_enc)))
  or exists (select 1 from public.producer_profiles where bank_account_enc is not null and jsonb_typeof(public.pr7_dec(bank_account_enc)::jsonb) <> 'object')
  or exists (select 1 from public.withdrawals where bank_account_enc is not null and jsonb_typeof(public.pr7_dec(bank_account_enc)::jsonb) <> 'object')
  or exists (select 1 from public.profiles where cpf_enc is not null and char_length(public.pr7_dec(cpf_enc)) = 0) then
    raise exception 'round-trip pr7_dec falhou em alguma tabela';
  end if;
  -- 6.4 gatilhos que tinham de existir e os do passo 1 que tinham de sumir
  if exists (select 1 from pg_trigger where tgname like 'zz_pr7_sync_%' and not tgisinternal) then
    raise exception 'gatilho zz_pr7_sync_* ainda existe';
  end if;
  if (select count(*) from pg_trigger where not tgisinternal and tgenabled = 'O' and tgname in (
        'staff_profiles_reauth_dinheiro', 'staff_profiles_registra_pagamento', 'audit_producer_profiles_upd',
        'audit_platform_affiliates_ins', 'audit_platform_affiliates_upd', 'audit_platform_affiliates_del',
        'gf_protect_producer_profile_privileges')) <> 7 then
    raise exception 'gatilho recriado ausente ou desligado';
  end if;
  if not has_function_privilege('service_role', 'public.pr7_anonimizar_pii(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.pr7_anonimizar_pii(uuid)', 'execute')
     or has_function_privilege('anon', 'public.pr7_anonimizar_pii(uuid)', 'execute') then
    raise exception 'pr7_anonimizar_pii: só service_role pode executar';
  end if;
end $$;

commit;

-- =============================================================================
-- TODO / PENDENTE (para a revisão, não resolvidos aqui):
--  1. (resolvido, Decisão 2) afiliado: só o CPF sai; nome/e-mail/endereço não são anonimizados.
--  2. (resolvido, Decisões 1 e 3) staff_profiles_historico_pagamento está vazio (0 linhas, informado pelo Ricardo; conferir
--     no ensaio); a PII antiga da admin_audit_log é redigida em 3c'.
--  3. Também ficam com PII em claro fora deste escopo: orders/tickets (PR do gateway), admin_audit_log antigo (já
--     oculta) e backups anteriores ao passo 2.
--  4. Arquivos antigos do repositório (20261002_convite_colaborador.sql, 20261014_..._s3, 20261016_..._s5,
--     20261019_..._s9, 20260929_afiliados_v2.sql, passo1/rpcs) ficam como HISTÓRICO: reaplicá-los depois do passo 2
--     recria referências às colunas apagadas ou volta as versões antigas das funções. As guardas md5 da S3 abortam
--     (fail-safe); os demais não. Marcar nesses arquivos "não reaplicar após o passo 2" ao commitar.
--  5. Testes SQL do repositório que citam as colunas de texto (supabase/tests/admin_s3, admin_s5_trilha, admin_s9,
--     admin_s4b_profiles_colunas, produtor_seguranca_l4, produtor_acesso; docs/sql/20261002_convite_colaborador_testes.sql)
--     e app/src/types/database.ts precisam ser atualizados/regenerados. Não tocados aqui.
--  6. Ordem de mensagens de erro em convite_aceitar/pr7_salvar_meu_cadastro: com várias falhas ao mesmo tempo, a
--     mensagem exibida pode ser outra que a do CHECK (antes, NOT NULL vinha antes de qualquer CHECK). Não afeta o que
--     é aceito ou recusado.
--  7. 6.2: o Ricardo informou que anon/authenticated só têm grant de COLUNA nessas tabelas e que as _enc estão sem grant;
--     a conferência fica como rede de segurança (confirmar no ensaio com information_schema.column_privileges).
--  8. A chave de cifra e o hmac usam o mesmo segredo (ponytail do passo 1, linha 215).
-- =============================================================================
