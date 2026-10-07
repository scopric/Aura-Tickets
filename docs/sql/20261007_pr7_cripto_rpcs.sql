-- =============================================================================
-- PR 7 (cifra de PII), RPCs do cutover do front. Aditivo e idempotente. Aplicar DEPOIS de 20261007_pr7_cripto_passo1.sql
-- e ANTES de publicar o front deste PR.
-- Fase atual: as RPCs de ESCRITA gravam as colunas de texto (os gatilhos zz_pr7_sync_* do passo 1 preenchem _enc); as de
-- LEITURA decifram com pr7_dec(). Cada marca "-- PASSO 2:" diz o que muda depois.
-- DESFAZER (rodar numa transação):
--   drop function if exists public.pr7_produtor_financeiro(), public.pr7_salvar_produtor_financeiro(text,text,jsonb),
--     public.pr7_admin_saques(), public.pr7_admin_afiliados(),
--     public.pr7_salvar_afiliado(uuid,text,text,date,text,text,text,text,text,text,text,text,text,text,numeric,text,date,text,uuid,text,text),
--     public.pr7_meu_cadastro(),
--     public.pr7_salvar_meu_cadastro(text,text,text,date,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,timestamptz),
--     public.pr7_mascara_cpf(text), public.pr7_mascara4(text);
--   drop function if exists public.colaborador_dados(uuid);
--   -- forma ORIGINAL (docs/sql/20261002_convite_colaborador.sql):
--   -- Cada leitura fica em staff_profiles_acessos (por isso volatile)
--   create or replace function public.colaborador_dados(p_user uuid)
--   returns setof public.staff_profiles
--   language plpgsql
--   volatile
--   security definer
--   set search_path = ''
--   as $$
--   begin
--     if not public.gf_admin_can('super_admin') then
--       raise exception 'Só quem tem Acesso total vê os dados do cadastro.' using errcode = '42501';
--     end if;
--     -- só registra quando há ficha para ler
--     insert into public.staff_profiles_acessos (leitor, colaborador)
--       select (select auth.uid()), s.user_id from public.staff_profiles s where s.user_id = p_user;
--     return query select s.* from public.staff_profiles s where s.user_id = p_user;
--   end;
--   $$;
--   revoke all on function public.colaborador_dados(uuid) from public, anon, authenticated, service_role;
--   grant execute on function public.colaborador_dados(uuid) to authenticated;
--   (mesmos grants do original: revoke de public/anon/authenticated/service_role e execute só para authenticated)
-- =============================================================================
begin;
set local lock_timeout = '5s';

create or replace function public.pr7_mascara_cpf(p text)
returns text language sql immutable set search_path = '' as $$
  select case when p is null then null
    else '***.***.***-' || right(regexp_replace(p,'\D','','g'), 2) end;
$$;

create or replace function public.pr7_mascara4(p text)
returns text language sql immutable set search_path = '' as $$
  select case when p is null or p = '' then p else '••••' || right(p,4) end;
$$;

-- PRODUTOR (dono = auth.uid())
create or replace function public.pr7_produtor_financeiro()
returns table(cnpj text, pix_key text, bank_account jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.gf_mfa_ok() then
    raise exception 'Reautenticação de dois fatores necessária.' using errcode='42501';
  end if;
  return query
    select public.pr7_dec(p.cnpj_enc), public.pr7_dec(p.pix_key_enc),
           public.pr7_dec(p.bank_account_enc)::jsonb
    from public.producer_profiles p where p.id = (select auth.uid());
end $$;

create or replace function public.pr7_salvar_produtor_financeiro(
  p_cnpj text, p_pix_key text, p_bank_account jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'sem sessão' using errcode='42501'; end if;
  if not public.gf_mfa_ok() then
    raise exception 'Reautenticação de dois fatores necessária.' using errcode='42501';
  end if;
  if p_cnpj is not null and length(regexp_replace(p_cnpj,'\D','','g')) <> 14 then
    raise exception 'CNPJ inválido' using errcode='23514';
  end if;
  insert into public.producer_profiles (id, company_name, cnpj, bank_account, pix_key, notification_settings)
    values (v_uid, coalesce((select full_name from public.profiles where id=v_uid),'Minha Empresa'),
            p_cnpj, coalesce(p_bank_account,'{}'::jsonb), coalesce(p_pix_key,''), '{}'::jsonb)
  on conflict (id) do update
    set cnpj = p_cnpj, pix_key = coalesce(p_pix_key,''), bank_account = coalesce(p_bank_account,'{}'::jsonb);
  -- PASSO 2: SET cnpj_enc=pr7_enc(p_cnpj), pix_key_enc=pr7_enc(coalesce(p_pix_key,'')), bank_account_enc=pr7_enc(coalesce(p_bank_account,'{}')::text)
end $$;

-- ADMIN SAQUES (manage_finance; Pix/banco COMPLETOS — decisão Ricardo)
create or replace function public.pr7_admin_saques()
returns table(id uuid, amount numeric, status text, created_at timestamptz, processed_at timestamptz,
              pix_key text, bank_account jsonb, produtor_nome text, produtor_email text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.gf_admin_can('manage_finance') then
    raise exception 'Só quem administra finanças vê os saques.' using errcode='42501';
  end if;
  return query
    select w.id, w.amount, w.status, w.created_at, w.processed_at,
           public.pr7_dec(w.pix_key_enc), public.pr7_dec(w.bank_account_enc)::jsonb,
           pr.full_name, pr.email
    from public.withdrawals w
    join public.profiles pr on pr.id = w.producer_id
    order by w.created_at desc limit 1000;
end $$;

-- ADMIN AFILIADOS (manage_affiliates; CPF MASCARADO)
create or replace function public.pr7_admin_afiliados()
returns table(id uuid, user_id uuid, referral_code text, status text, recurring_percent numeric,
              agreement_date date, notes text, full_name text, cpf_mascarado text, birth_date date,
              email text, phone text, whatsapp text, cep text, street text, street_number text,
              complement text, neighborhood text, city text, state text, payout_account_id text,
              created_at timestamptz, updated_at timestamptz, created_by uuid,
              user_full_name text, user_email text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.gf_admin_can('manage_affiliates') then
    raise exception 'Só quem administra afiliados vê a lista.' using errcode='42501';
  end if;
  return query
    select a.id, a.user_id, a.referral_code, a.status, a.recurring_percent, a.agreement_date, a.notes,
           a.full_name, public.pr7_mascara_cpf(public.pr7_dec(a.cpf_enc)), a.birth_date, a.email, a.phone,
           a.whatsapp, a.cep, a.street, a.street_number, a.complement, a.neighborhood, a.city, a.state,
           a.payout_account_id, a.created_at, a.updated_at, a.created_by, u.full_name, u.email
    from public.platform_affiliates a
    left join public.profiles u on u.id = a.user_id
    order by a.created_at desc;
end $$;

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
      (user_id, referral_code, cpf, full_name, birth_date, email, phone, whatsapp, cep, street,
       street_number, complement, neighborhood, city, state, recurring_percent, status,
       agreement_date, notes, payout_account_id, created_by)
    values (p_user_id, p_referral_code, v_cpf, p_full_name, p_birth_date, p_email, p_phone, p_whatsapp,
       p_cep, p_street, p_street_number, p_complement, p_neighborhood, p_city, p_state,
       p_recurring_percent, p_status, p_agreement_date, p_notes, p_payout_account_id, (select auth.uid()))
    returning id into v_id;
  else
    update public.platform_affiliates set
      full_name=p_full_name, birth_date=p_birth_date, email=p_email, phone=p_phone, whatsapp=p_whatsapp,
      cep=p_cep, street=p_street, street_number=p_street_number, complement=p_complement,
      neighborhood=p_neighborhood, city=p_city, state=p_state, recurring_percent=p_recurring_percent,
      status=p_status, agreement_date=p_agreement_date, notes=p_notes,
      cpf = case when v_cpf is null then cpf else v_cpf end,
      payout_account_id = coalesce(payout_account_id, p_payout_account_id),
      updated_at = now()
    where id = p_id;
    if not found then raise exception 'Afiliado não encontrado' using errcode='P0001'; end if;
  end if;
  return v_id;
  -- PASSO 2: gravar cpf_enc=pr7_enc(v_cpf), cpf_hmac=pr7_hmac(v_cpf) (no UPDATE só quando v_cpf not null)
end $$;

-- STAFF (dono = auth.uid())
create or replace function public.pr7_meu_cadastro()
returns table(nome_completo text, cpf text, rg text, data_nascimento date, cep text, rua text,
              numero text, complemento text, bairro text, cidade text, uf text, email_secundario text,
              telefone text, whatsapp text, emergencia_nome text, emergencia_parentesco text,
              emergencia_telefone text, banco text, agencia text, conta text, pix_tipo text,
              pix_chave text, email text, cargo text, updated_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.gf_mfa_ok() then
    raise exception 'Reautenticação de dois fatores necessária.' using errcode='42501';
  end if;
  return query
    select s.nome_completo, public.pr7_dec(s.cpf_enc), public.pr7_dec(s.rg_enc), s.data_nascimento,
           s.cep, s.rua, s.numero, s.complemento, s.bairro, s.cidade, s.uf, s.email_secundario,
           s.telefone, s.whatsapp, s.emergencia_nome, s.emergencia_parentesco, s.emergencia_telefone,
           public.pr7_dec(s.banco_enc), public.pr7_dec(s.agencia_enc), public.pr7_dec(s.conta_enc),
           public.pr7_dec(s.pix_tipo_enc), public.pr7_dec(s.pix_chave_enc), s.email, s.cargo, s.updated_at
    from public.staff_profiles s where s.user_id = (select auth.uid());
end $$;

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
  if not public.gf_cpf_valido(v_cpf) then raise exception 'CPF inválido' using errcode='23514'; end if;
  update public.staff_profiles set
    nome_completo=p_nome_completo, cpf=v_cpf, rg=p_rg, data_nascimento=p_data_nascimento, cep=p_cep,
    rua=p_rua, numero=p_numero, complemento=p_complemento, bairro=p_bairro, cidade=p_cidade, uf=p_uf,
    email_secundario=p_email_secundario, telefone=p_telefone, whatsapp=p_whatsapp,
    emergencia_nome=p_emergencia_nome, emergencia_parentesco=p_emergencia_parentesco,
    emergencia_telefone=p_emergencia_telefone, banco=p_banco, agencia=p_agencia, conta=p_conta,
    pix_tipo=p_pix_tipo, pix_chave=p_pix_chave, updated_at=now()
  where user_id = v_uid and updated_at = p_updated_at
  returning updated_at into v_ts;
  if v_ts is null then raise exception 'Não foi possível salvar: o cadastro foi alterado em outra aba ou não existe. Recarregue a página.' using errcode='P0001'; end if;
  return v_ts;
  -- PASSO 2: SET *_enc=pr7_enc(...); migrar todas as validações dos CHECKs staff_* para cá
end $$;

-- RESHAPE colaborador_dados (super_admin; mascarado; mantém o log em staff_profiles_acessos)
drop function if exists public.colaborador_dados(uuid);
create function public.colaborador_dados(p_user uuid)
returns table(nome_completo text, cpf text, rg text, data_nascimento date, cep text, rua text,
              numero text, complemento text, bairro text, cidade text, uf text, email_secundario text,
              telefone text, whatsapp text, emergencia_nome text, emergencia_parentesco text,
              emergencia_telefone text, banco text, agencia text, conta text, pix_tipo text,
              pix_chave text, email text, cargo text, updated_at timestamptz)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.gf_admin_can('super_admin') then
    raise exception 'Só quem tem Acesso total vê os dados do cadastro.' using errcode='42501';
  end if;
  insert into public.staff_profiles_acessos (leitor, colaborador)
    select (select auth.uid()), s.user_id from public.staff_profiles s where s.user_id = p_user;
  return query
    select s.nome_completo, public.pr7_mascara_cpf(public.pr7_dec(s.cpf_enc)),
           public.pr7_mascara4(public.pr7_dec(s.rg_enc)), s.data_nascimento, s.cep, s.rua, s.numero,
           s.complemento, s.bairro, s.cidade, s.uf, s.email_secundario, s.telefone, s.whatsapp,
           s.emergencia_nome, s.emergencia_parentesco, s.emergencia_telefone,
           public.pr7_dec(s.banco_enc), public.pr7_mascara4(public.pr7_dec(s.agencia_enc)),
           public.pr7_mascara4(public.pr7_dec(s.conta_enc)), public.pr7_dec(s.pix_tipo_enc),
           public.pr7_mascara4(public.pr7_dec(s.pix_chave_enc)), s.email, s.cargo, s.updated_at
    from public.staff_profiles s where s.user_id = p_user;
end $$;

revoke all on function
  public.pr7_mascara_cpf(text), public.pr7_mascara4(text),
  public.pr7_produtor_financeiro(), public.pr7_salvar_produtor_financeiro(text,text,jsonb),
  public.pr7_admin_saques(), public.pr7_admin_afiliados(),
  public.pr7_salvar_afiliado(uuid,text,text,date,text,text,text,text,text,text,text,text,text,text,numeric,text,date,text,uuid,text,text),
  public.pr7_meu_cadastro(),
  public.pr7_salvar_meu_cadastro(text,text,text,date,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,timestamptz),
  public.colaborador_dados(uuid)
  from public, anon, authenticated, service_role;
grant execute on function
  public.pr7_produtor_financeiro(), public.pr7_salvar_produtor_financeiro(text,text,jsonb),
  public.pr7_admin_saques(), public.pr7_admin_afiliados(),
  public.pr7_salvar_afiliado(uuid,text,text,date,text,text,text,text,text,text,text,text,text,text,numeric,text,date,text,uuid,text,text),
  public.pr7_meu_cadastro(),
  public.pr7_salvar_meu_cadastro(text,text,text,date,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,timestamptz),
  public.colaborador_dados(uuid)
  to authenticated;

commit;
