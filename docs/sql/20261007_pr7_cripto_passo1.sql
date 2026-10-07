-- =============================================================================
-- PR 7 — passo 1 (aditivo, não-quebra): cifra de PII em repouso.
-- Escopo (decisão Ricardo 07/10): 7 tabelas. CPF de comprador (orders/tickets)
-- fica para o PR do gateway de pagamento (hoje essas colunas estão vazias e sem
-- caminho de escrita).
-- Aplicar à mão no SQL Editor (UTF-8 via pbcopy, NUNCA TextEdit). NÃO vai para supabase/migrations.
-- Idempotente. Ensaiar inteiro em `begin … rollback` pela API antes de aplicar.
-- Pré-requisitos (conferidos em produção 07/10): pgcrypto no schema `extensions`
-- (pgp_sym_encrypt/hmac resolvem), supabase_vault, gf_cpf_valido, gf_admin_can já existem.
--
-- DESFAZER (passo 1 inteiro; NÃO apaga o segredo do Vault — a chave protege o backup):
--   drop trigger if exists zz_pr7_sync_profiles on public.profiles;
--   drop trigger if exists zz_pr7_sync_affiliates on public.platform_affiliates;
--   drop trigger if exists zz_pr7_sync_producer on public.producer_profiles;
--   drop trigger if exists zz_pr7_sync_withdrawals on public.withdrawals;
--   drop trigger if exists zz_pr7_sync_staff on public.staff_profiles;
--   drop function if exists public.pr7_sync_profiles, public.pr7_sync_affiliates,
--     public.pr7_sync_producer, public.pr7_sync_withdrawals, public.pr7_sync_staff;
--   drop function if exists public.pr7_enc(text), public.pr7_dec(bytea), public.pr7_hmac(text), public.pr7_key();
--   drop index if exists public.platform_affiliates_cpf_hmac_idx;
--   alter table public.profiles drop column if exists cpf_enc;
--   alter table public.platform_affiliates drop column if exists cpf_enc, drop column if exists cpf_hmac;
--   alter table public.producer_profiles drop column if exists cnpj_enc, drop column if exists pix_key_enc, drop column if exists bank_account_enc;
--   alter table public.withdrawals drop column if exists pix_key_enc, drop column if exists bank_account_enc;
--   alter table public.staff_profiles drop column if exists cpf_enc, drop column if exists rg_enc, drop column if exists agencia_enc,
--     drop column if exists banco_enc, drop column if exists conta_enc, drop column if exists pix_chave_enc, drop column if exists pix_tipo_enc;
--   -- (o segredo, se for mesmo descartar: delete from vault.secrets where name='pr7_pii_key';)
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 0. Preflight: pgcrypto acessível em extensions
do $$ begin
  perform extensions.pgp_sym_encrypt('x', 'y');
  perform extensions.hmac('x', 'y', 'sha256');
exception when undefined_function then
  raise exception 'pgcrypto não resolve em extensions.*; ajustar o schema das chamadas';
end $$;

-- 1. Segredo no Vault (idempotente) ------------------------------------------------------------------
--    A chave real pode ser definida pelo Ricardo antes de rodar isto (vault.create_secret).
--    Se faltar, criamos com valor aleatório forte; o Ricardo DEVE guardá-la no gerenciador logo após:
--      select decrypted_secret from vault.decrypted_secrets where name='pr7_pii_key';
--    Sem essa chave, o backup cifrado não se recupera.
do $$ declare v_id uuid; begin
  select s.id into v_id from vault.secrets s where s.name = 'pr7_pii_key';
  if v_id is null then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'),
      'pr7_pii_key', 'PR7 — chave de cifra de PII em repouso (cópia no gerenciador do Ricardo)');
  end if;
end $$;

-- 2. Helpers (sem grant: só chamadas de dentro de SECURITY DEFINER) -----------------------------------
create or replace function public.pr7_key()
returns text language plpgsql stable security definer set search_path = '' as $$
declare v text;
begin
  select d.decrypted_secret into v from vault.decrypted_secrets d where d.name = 'pr7_pii_key' limit 1;
  if v is null or char_length(v) = 0 then
    raise exception 'pr7_pii_key ausente/vazio no Vault — escrita de PII bloqueada' using errcode = '55000';
  end if;
  return v;
end $$;

create or replace function public.pr7_enc(p text)
returns bytea language sql volatile security definer set search_path = '' as $$
  select case when p is null then null else extensions.pgp_sym_encrypt(p, public.pr7_key()) end;
$$;

create or replace function public.pr7_dec(p bytea)
returns text language sql stable security definer set search_path = '' as $$
  select case when p is null then null else extensions.pgp_sym_decrypt(p, public.pr7_key()) end;
$$;

-- CPF/documento determinístico para unicidade (ignora formatação)
create or replace function public.pr7_hmac(p text)
returns bytea language sql stable security definer set search_path = '' as $$
  select case when p is null then null
    else extensions.hmac(regexp_replace(p, '\D', '', 'g'), public.pr7_key(), 'sha256') end;
$$;

revoke all on function public.pr7_key(), public.pr7_enc(text), public.pr7_dec(bytea), public.pr7_hmac(text)
  from public, anon, authenticated, service_role;

-- 3. Colunas novas (bytea) + hmac ---------------------------------------------------------------------
alter table public.profiles            add column if not exists cpf_enc bytea;
alter table public.platform_affiliates add column if not exists cpf_enc bytea, add column if not exists cpf_hmac bytea;
alter table public.producer_profiles   add column if not exists cnpj_enc bytea,
                                        add column if not exists pix_key_enc bytea,
                                        add column if not exists bank_account_enc bytea;
alter table public.withdrawals         add column if not exists pix_key_enc bytea,
                                        add column if not exists bank_account_enc bytea;
alter table public.staff_profiles      add column if not exists cpf_enc bytea,
                                        add column if not exists rg_enc bytea,
                                        add column if not exists agencia_enc bytea,
                                        add column if not exists banco_enc bytea,
                                        add column if not exists conta_enc bytea,
                                        add column if not exists pix_chave_enc bytea,
                                        add column if not exists pix_tipo_enc bytea;

-- índice único NOVO sobre o hmac (o antigo sobre o texto fica até o passo 2)
create unique index if not exists platform_affiliates_cpf_hmac_idx
  on public.platform_affiliates (cpf_hmac) where cpf_hmac is not null;

-- 4. Gatilhos keep-in-sync (SECURITY DEFINER; recomputam só quando muda ou _enc nulo) -----------------
-- profiles.cpf: nullable, sem RAISE (não bloquear perfil legado; 0 CPF hoje)
create or replace function public.pr7_sync_profiles()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.cpf is null then new.cpf_enc := null;
  elsif tg_op = 'INSERT' or new.cpf is distinct from old.cpf or new.cpf_enc is null then
    new.cpf_enc := public.pr7_enc(new.cpf);
  end if;
  return new;
end $$;
drop trigger if exists zz_pr7_sync_profiles on public.profiles;
create trigger zz_pr7_sync_profiles before insert or update on public.profiles
  for each row execute function public.pr7_sync_profiles();

-- platform_affiliates: VALIDA (fronteira de unicidade) + hmac
create or replace function public.pr7_sync_affiliates()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.cpf is null then new.cpf_enc := null; new.cpf_hmac := null;
  elsif tg_op = 'INSERT' or new.cpf is distinct from old.cpf or new.cpf_enc is null or new.cpf_hmac is null then
    if not public.gf_cpf_valido(regexp_replace(new.cpf, '\D', '', 'g')) then
      raise exception 'CPF de afiliado inválido' using errcode = '23514';
    end if;
    new.cpf_enc  := public.pr7_enc(new.cpf);
    new.cpf_hmac := public.pr7_hmac(new.cpf);
  end if;
  return new;
end $$;
drop trigger if exists zz_pr7_sync_affiliates on public.platform_affiliates;
create trigger zz_pr7_sync_affiliates before insert or update on public.platform_affiliates
  for each row execute function public.pr7_sync_affiliates();

-- producer_profiles: cnpj, pix_key (nullable), bank_account (jsonb NOT NULL default '{}')
create or replace function public.pr7_sync_producer()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.cnpj is null then new.cnpj_enc := null;
  elsif tg_op = 'INSERT' or new.cnpj is distinct from old.cnpj or new.cnpj_enc is null then
    new.cnpj_enc := public.pr7_enc(new.cnpj);
  end if;
  if new.pix_key is null then new.pix_key_enc := null;
  elsif tg_op = 'INSERT' or new.pix_key is distinct from old.pix_key or new.pix_key_enc is null then
    new.pix_key_enc := public.pr7_enc(new.pix_key);
  end if;
  if tg_op = 'INSERT' or new.bank_account is distinct from old.bank_account or new.bank_account_enc is null then
    new.bank_account_enc := public.pr7_enc(new.bank_account::text);  -- '{}' cifra normal
  end if;
  return new;
end $$;
drop trigger if exists zz_pr7_sync_producer on public.producer_profiles;
create trigger zz_pr7_sync_producer before insert or update on public.producer_profiles
  for each row execute function public.pr7_sync_producer();

-- withdrawals: pix_key (nullable), bank_account (jsonb NOT NULL)
create or replace function public.pr7_sync_withdrawals()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.pix_key is null then new.pix_key_enc := null;
  elsif tg_op = 'INSERT' or new.pix_key is distinct from old.pix_key or new.pix_key_enc is null then
    new.pix_key_enc := public.pr7_enc(new.pix_key);
  end if;
  if tg_op = 'INSERT' or new.bank_account is distinct from old.bank_account or new.bank_account_enc is null then
    new.bank_account_enc := public.pr7_enc(new.bank_account::text);
  end if;
  return new;
end $$;
drop trigger if exists zz_pr7_sync_withdrawals on public.withdrawals;
create trigger zz_pr7_sync_withdrawals before insert or update on public.withdrawals
  for each row execute function public.pr7_sync_withdrawals();

-- staff_profiles: cpf (NOT NULL, staff_cpf_ok garante válido), rg/agencia/banco/conta (nullable), pix_chave/pix_tipo (NOT NULL)
create or replace function public.pr7_sync_staff()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.cpf is distinct from old.cpf or new.cpf_enc is null then
    new.cpf_enc := public.pr7_enc(new.cpf);
  end if;
  if new.rg is null then new.rg_enc := null;
  elsif tg_op = 'INSERT' or new.rg is distinct from old.rg or new.rg_enc is null then new.rg_enc := public.pr7_enc(new.rg); end if;
  if new.agencia is null then new.agencia_enc := null;
  elsif tg_op = 'INSERT' or new.agencia is distinct from old.agencia or new.agencia_enc is null then new.agencia_enc := public.pr7_enc(new.agencia); end if;
  if new.banco is null then new.banco_enc := null;
  elsif tg_op = 'INSERT' or new.banco is distinct from old.banco or new.banco_enc is null then new.banco_enc := public.pr7_enc(new.banco); end if;
  if new.conta is null then new.conta_enc := null;
  elsif tg_op = 'INSERT' or new.conta is distinct from old.conta or new.conta_enc is null then new.conta_enc := public.pr7_enc(new.conta); end if;
  if tg_op = 'INSERT' or new.pix_chave is distinct from old.pix_chave or new.pix_chave_enc is null then new.pix_chave_enc := public.pr7_enc(new.pix_chave); end if;
  if tg_op = 'INSERT' or new.pix_tipo  is distinct from old.pix_tipo  or new.pix_tipo_enc  is null then new.pix_tipo_enc  := public.pr7_enc(new.pix_tipo);  end if;
  return new;
end $$;
drop trigger if exists zz_pr7_sync_staff on public.staff_profiles;
create trigger zz_pr7_sync_staff before insert or update on public.staff_profiles
  for each row execute function public.pr7_sync_staff();

-- 5. Backfill (poucas linhas; o gatilho NÃO recifra: texto inalterado e _enc deixa de ser nulo) -------
update public.profiles            set cpf_enc = public.pr7_enc(cpf)                     where cpf is not null and cpf_enc is null;
update public.platform_affiliates set cpf_enc = public.pr7_enc(cpf),
                                      cpf_hmac = public.pr7_hmac(cpf)                    where cpf is not null and cpf_enc is null;
update public.producer_profiles   set cnpj_enc = public.pr7_enc(cnpj),
                                      pix_key_enc = public.pr7_enc(pix_key),
                                      bank_account_enc = public.pr7_enc(bank_account::text) where bank_account_enc is null;
update public.withdrawals         set pix_key_enc = public.pr7_enc(pix_key),
                                      bank_account_enc = public.pr7_enc(bank_account::text) where bank_account_enc is null;
update public.staff_profiles      set cpf_enc = public.pr7_enc(cpf), rg_enc = public.pr7_enc(rg),
                                      agencia_enc = public.pr7_enc(agencia), banco_enc = public.pr7_enc(banco),
                                      conta_enc = public.pr7_enc(conta), pix_chave_enc = public.pr7_enc(pix_chave),
                                      pix_tipo_enc = public.pr7_enc(pix_tipo)            where cpf_enc is null;

-- 6. Conferência que aborta (cobertura e round-trip) --------------------------------------------------
do $$ begin
  if exists (select 1 from public.profiles            where cpf is not null and cpf_enc is null)
  or exists (select 1 from public.platform_affiliates where cpf is not null and (cpf_enc is null or cpf_hmac is null))
  or exists (select 1 from public.staff_profiles      where cpf_enc is null)
  or exists (select 1 from public.producer_profiles   where bank_account_enc is null)
  or exists (select 1 from public.withdrawals         where bank_account_enc is null) then
    raise exception 'backfill incompleto: há PII sem coluna _enc';
  end if;
  if exists (select 1 from public.platform_affiliates
             where cpf is not null and public.pr7_dec(cpf_enc) is distinct from cpf) then
    raise exception 'round-trip cifra/decifra divergente em platform_affiliates';
  end if;
  if exists (select 1 from public.producer_profiles
             where public.pr7_dec(bank_account_enc)::jsonb is distinct from bank_account) then
    raise exception 'round-trip bank_account (jsonb) divergente em producer_profiles';
  end if;
end $$;

commit;
