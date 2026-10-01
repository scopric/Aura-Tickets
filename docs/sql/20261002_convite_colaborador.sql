-- =============================================================================
-- Convite de colaborador da Evokaa (Fase F) — banco — 2026-10-02
-- Aplicar à mão no SQL Editor do Supabase, de uma vez. NÃO vai para supabase/migrations (Decisão 02).
-- Plano: Claude/Planos/groovy-waddling-wilkinson (Fase F); especificação de 30/09 ("Convite de funcionário
-- e permissões do admin"), com as mudanças da Decisão 125 (01/10): o acesso libera assim que o cadastro
-- termina, sem aprovação; a interface fala de "colaboradores da Evokaa"; os super_admins recebem e-mail a
-- cada convite aceito (Edge Function admin-invite, ação aceitar, que chama convite_aceitar e manda o aviso na
-- mesma requisição; convites_listar mostra os aceites dos últimos 30 dias e se o aviso saiu).
-- Contrato:
--   - admin_invites: RLS ligada, sem policy e sem GRANT para anon/authenticated. Só as funções abaixo e a
--     chave de serviço (Edge Function admin-invite, ações criar-conta e aceitar) leem e gravam.
--     O token nunca é guardado: só o sha256 (hex) do texto do token. Validade de 7 dias, uso único;
--     reenviar troca o hash (o link antigo para de valer).
--   - staff_profiles: os dados do cadastro do colaborador (nunca em profiles, que outras telas leem).
--     RLS: o próprio lê e edita os dados dele (UPDATE só nas colunas do cadastro: nunca user_id, invite_id,
--     email, cargo nem as datas; updated_at é do gatilho; editar exige fator confirmado e aal2). Toda mudança de
--     Pix ou banco fica em staff_profiles_historico_pagamento e toda leitura da ficha pelo super_admin em
--     staff_profiles_acessos (as duas só de inserção, por gatilho/função, sem acesso pela API). O super_admin lê tudo por colaborador_dados(); os demais admins veem só nome, cargo
--     e e-mail por colaboradores_resumo().
--   - Funções (todas SECURITY DEFINER, search_path '', dono postgres):
--       convite_criar, convite_reenviar, convite_cancelar, convites_listar, colaborador_dados:
--         só super_admin com 2FA e sessão aal2 (gf_admin_can('super_admin'), seg-4);
--       colaboradores_resumo: qualquer admin (gf_is_admin, que já exige 2FA e aal2); só quem segue admin;
--       conta de produtor (role producer ou editor) ou que já é admin não é convidada nem aceita convite: o
--       convite é para um e-mail só do trabalho na Evokaa;
--       convite_conferir(token): anon e authenticated; diz se o convite vale e devolve o e-mail mascarado;
--       convite_aceitar(token, dados): authenticated; confere, nesta ordem, o hash do token, se o convite
--         está pendente e no prazo, se o e-mail da conta é o do convite, 2FA (gf_mfa_ok, aal2 e fator
--         confirmado) e os campos (CHECKs de staff_profiles); depois, na mesma transação, grava
--         staff_profiles, aplica role = 'admin' e as permissões LIDAS DO CONVITE e marca o convite como usado.
--   - Permissões do convite: só as da lista PERMISSIONS da tela Equipe (app/src/pages/admin/TeamManager.tsx),
--     nunca super_admin (que só se dá pela edição de permissões). Garantido pelo CHECK de admin_invites
--     (convite_permissoes_ok) e de novo na Edge Function. Mudou a lista? Mudar aqui, na Edge Function
--     (PERMISSOES) e na tela.
-- Gatilho gf_protect_profile_privileges (seg-4): ele barra quem chama pela API (JWT com role authenticated)
-- de mudar o próprio papel, inclusive dentro de uma função SECURITY DEFINER. convite_aceitar já conferiu
-- convite, e-mail e 2FA; para o UPDATE de profiles ela esvazia request.jwt.claims só durante esse comando
-- (o gatilho trata a chamada como a do dono do banco) e devolve as claims logo depois. O 2FA que o gatilho
-- exigiria (gf_tem_2fa) a própria função confere antes (fator confirmado + aal2). Testado no arquivo de testes.
-- Pré-requisitos (no repositório): gf_mfa_ok e gf_is_admin (20260930_2fa_no_banco.sql), gf_admin_can, gf_tem_2fa
-- e o gatilho gf_protect_profile_privileges (20261001_seg4_2fa_admin.sql), gf_cpf_valido (20260929_afiliados_v2.sql).
-- TESTES: em 20261002_convite_colaborador_testes.sql (só em banco descartável), aplicado depois deste.
-- ORDEM: 1) este arquivo; 2) Edge Function admin-invite (supabase functions deploy admin-invite; usa
-- RESEND_API_KEY, que já existe); 3) o front (página /convite no alpha e a tela Equipe). Sem este arquivo, a
-- tela Equipe mostra erro ao listar convites e o /convite diz que o convite não vale.
-- GUARDA (alçada do jurídico, não decidida aqui): por quanto tempo staff_profiles de quem SAIU da equipe fica
-- guardado (hoje fica até a exclusão da conta, pelo delete-account). admin_invites não pendentes saem em 90 dias
-- (cron convites_limpar, bloco 7), prazo técnico provisório sujeito ao jurídico.
-- Precisa do pg_cron ligado (já exigido por 20261001_seg5_entrada_limites.sql).
-- Idempotente: pode rodar de novo.
-- =============================================================================
begin;

-- 1. Permissões aceitas num convite (a lista PERMISSIONS da tela Equipe, sem super_admin)
create or replace function public.convite_permissoes_ok(p text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p is not null
     and array_position(p, null) is null
     and p <@ array['manage_users', 'manage_affiliates', 'manage_events', 'manage_finance', 'view_analytics',
                    'manage_tickets', 'manage_settings', 'manage_feedback', 'manage_support', 'manage_newsletter',
                    'manage_coupons', 'moderate_mesa', 'manage_team']::text[];
$$;

-- sha256 (hex) do texto do token: o mesmo cálculo da Edge Function (hashToken)
create or replace function public.convite_hash(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(coalesce(p, ''), 'UTF8')), 'hex');
$$;

-- 2. Convites
create table if not exists public.admin_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null constraint admin_invites_email_ok
    check (email = lower(btrim(email)) and char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  cargo text not null constraint admin_invites_cargo_ok check (char_length(btrim(cargo)) between 2 and 80),
  permissions text[] not null default '{}' constraint admin_invites_permissions_ok check (public.convite_permissoes_ok(permissions)),
  token_hash text not null unique constraint admin_invites_token_hash_ok check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null default now() + interval '7 days',
  status text not null default 'pendente' constraint admin_invites_status_ok check (status in ('pendente', 'usado', 'cancelado')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  used_by uuid references public.profiles(id) on delete set null,
  used_at timestamptz,
  -- quando saiu o aviso aos super_admins (ação aceitar da Edge Function): um aviso por convite
  aviso_em timestamptz
);
-- um convite pendente por e-mail (o expirado é cancelado por convite_criar antes de criar outro)
create unique index if not exists admin_invites_pendente_email_idx on public.admin_invites (email) where status = 'pendente';
create index if not exists admin_invites_used_by_idx on public.admin_invites (used_by) where used_by is not null;
alter table public.admin_invites enable row level security;
revoke all on public.admin_invites from public, anon, authenticated;
grant select, insert, update, delete on public.admin_invites to service_role;

-- 3. Cadastro do colaborador
create table if not exists public.staff_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  invite_id uuid references public.admin_invites(id) on delete set null,
  -- e-mail principal (o da conta e do convite) e cargo do convite: o colaborador não edita
  email text not null,
  cargo text not null,
  -- só letras (com acento), espaço, apóstrofo, ponto e hífen
  nome_completo text not null constraint staff_nome_ok check (char_length(btrim(nome_completo)) between 3 and 150
    and nome_completo ~ '^[A-Za-zÀ-ÖØ-öø-ÿ ''.-]+$'),
  cpf text not null constraint staff_cpf_ok check (public.gf_cpf_valido(cpf)),
  rg text not null constraint staff_rg_ok check (char_length(btrim(rg)) between 3 and 20),
  data_nascimento date not null constraint staff_nascimento_ok
    check (data_nascimento between date '1900-01-01' and current_date - interval '18 years'),
  cep text not null constraint staff_cep_ok check (cep ~ '^[0-9]{8}$'),
  rua text not null,
  numero text not null,
  complemento text,
  bairro text not null,
  cidade text not null,
  uf text not null constraint staff_uf_ok check (uf in ('AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
    'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO')),
  email_secundario text not null,
  -- formato do PhoneInput: +DDI e o número, só dígitos
  telefone text not null,
  whatsapp text not null,
  emergencia_nome text not null,
  emergencia_parentesco text not null,
  emergencia_telefone text not null,
  banco text,
  agencia text,
  conta text,
  pix_tipo text not null,
  pix_chave text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_endereco_ok check (char_length(btrim(rua)) between 2 and 150 and char_length(btrim(numero)) between 1 and 20
    and char_length(btrim(bairro)) between 2 and 100 and char_length(btrim(cidade)) between 2 and 100
    and (complemento is null or char_length(complemento) <= 100)),
  constraint staff_email_secundario_ok check (email_secundario = lower(btrim(email_secundario)) and char_length(email_secundario) <= 254
    and email_secundario ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and email_secundario <> lower(email)),
  constraint staff_telefones_ok check (telefone ~ '^\+[1-9][0-9]{9,14}$' and whatsapp ~ '^\+[1-9][0-9]{9,14}$'),
  constraint staff_emergencia_ok check (char_length(btrim(emergencia_nome)) between 3 and 150
    and char_length(btrim(emergencia_parentesco)) between 2 and 50 and emergencia_telefone ~ '^\+[1-9][0-9]{9,14}$'),
  constraint staff_banco_ok check ((banco is null or char_length(banco) <= 80) and (agencia is null or char_length(agencia) <= 20)
    and (conta is null or char_length(conta) <= 30)),
  -- Pix no formato do tipo: CPF com dígito verificador, e-mail, celular +55 com DDD, chave aleatória (UUID)
  constraint staff_pix_ok check (case pix_tipo
    when 'cpf' then public.gf_cpf_valido(pix_chave)
    when 'email' then pix_chave = lower(btrim(pix_chave)) and char_length(pix_chave) <= 77 and pix_chave ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    when 'telefone' then pix_chave ~ '^\+55[0-9]{10,11}$'
    when 'aleatoria' then pix_chave ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    else false end)
);
alter table public.staff_profiles enable row level security;
revoke all on public.staff_profiles from public, anon, authenticated;
grant select on public.staff_profiles to authenticated;
grant update (nome_completo, cpf, rg, data_nascimento, cep, rua, numero, complemento, bairro, cidade, uf, email_secundario,
  telefone, whatsapp, emergencia_nome, emergencia_parentesco, emergencia_telefone, banco, agencia, conta, pix_tipo, pix_chave)
  on public.staff_profiles to authenticated;
grant select, insert, update, delete on public.staff_profiles to service_role;

-- O próprio colaborador, com 2FA (gf_mfa_ok: conta com fator só em aal2)
drop policy if exists staff_profiles_proprio_le on public.staff_profiles;
create policy staff_profiles_proprio_le on public.staff_profiles for select to authenticated
  using (user_id = (select auth.uid()) and (select public.gf_mfa_ok()));
drop policy if exists staff_profiles_proprio_edita on public.staff_profiles;
-- editar exige fator confirmado na própria conta e o código digitado nesta sessão
create policy staff_profiles_proprio_edita on public.staff_profiles for update to authenticated
  using (user_id = (select auth.uid()) and (select public.gf_tem_2fa((select auth.uid()))) is true
         and coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2')
  with check (user_id = (select auth.uid()) and (select public.gf_tem_2fa((select auth.uid()))) is true
              and coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2');

-- updated_at é do banco (fora do GRANT de UPDATE)
create or replace function public.staff_profiles_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists staff_profiles_updated_at on public.staff_profiles;
create trigger staff_profiles_updated_at before update on public.staff_profiles
  for each row execute function public.staff_profiles_updated_at();

-- Histórico de Pix e banco: quem mudou, quando, de quê para quê. Só de inserção, pelo gatilho; sem acesso pela API
-- (a chave de serviço só apaga, na exclusão da conta).
create table if not exists public.staff_profiles_historico_pagamento (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  alterado_por uuid,
  alterado_em timestamptz not null default now(),
  antes jsonb not null,
  depois jsonb not null
);
create index if not exists staff_hist_pagamento_user_idx on public.staff_profiles_historico_pagamento (user_id);
alter table public.staff_profiles_historico_pagamento enable row level security;
revoke all on public.staff_profiles_historico_pagamento from public, anon, authenticated, service_role;
-- apagar por user_id exige ler a coluna do filtro; só ela
grant delete, select (user_id) on public.staff_profiles_historico_pagamento to service_role;

create or replace function public.staff_profiles_registra_pagamento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.staff_profiles_historico_pagamento (user_id, alterado_por, antes, depois)
  values (new.user_id, (select auth.uid()),
    jsonb_build_object('pix_tipo', old.pix_tipo, 'pix_chave', old.pix_chave, 'banco', old.banco, 'agencia', old.agencia, 'conta', old.conta),
    jsonb_build_object('pix_tipo', new.pix_tipo, 'pix_chave', new.pix_chave, 'banco', new.banco, 'agencia', new.agencia, 'conta', new.conta));
  return null;
end;
$$;
drop trigger if exists staff_profiles_registra_pagamento on public.staff_profiles;
create trigger staff_profiles_registra_pagamento after update on public.staff_profiles
  for each row when (old.pix_tipo is distinct from new.pix_tipo or old.pix_chave is distinct from new.pix_chave
    or old.banco is distinct from new.banco or old.agencia is distinct from new.agencia or old.conta is distinct from new.conta)
  execute function public.staff_profiles_registra_pagamento();

-- Quem leu a ficha de quem (colaborador_dados). Só de inserção, pela função; sem acesso pela API.
create table if not exists public.staff_profiles_acessos (
  id bigint generated always as identity primary key,
  leitor uuid not null,
  colaborador uuid not null,
  lido_em timestamptz not null default now()
);
alter table public.staff_profiles_acessos enable row level security;
revoke all on public.staff_profiles_acessos from public, anon, authenticated, service_role;

-- 4. Funções do super_admin
create or replace function public.convite_criar(p_email text, p_cargo text, p_permissions text[], p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_perms text[] := array(select distinct x from unnest(coalesce(p_permissions, '{}')) x order by x);
  v_id uuid;
begin
  if not public.gf_admin_can('super_admin') then
    raise exception 'Só o super_admin convida colaboradores.' using errcode = '42501';
  end if;
  if not public.convite_permissoes_ok(v_perms) then
    raise exception 'Função inválida no convite.' using errcode = '22023';
  end if;
  if exists (select 1 from public.profiles p where lower(p.email) = v_email and p.role = 'admin') then
    raise exception 'Essa pessoa já faz parte dos colaboradores da Evokaa.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.profiles p where lower(p.email) = v_email and p.role in ('producer', 'editor')) then
    raise exception 'Este e-mail já tem uma conta de produtor. Convide outro e-mail, só para o trabalho na Evokaa.' using errcode = 'P0001';
  end if;
  -- convite pendente vencido não segura o e-mail
  update public.admin_invites set status = 'cancelado' where email = v_email and status = 'pendente' and expires_at <= now();
  begin
    insert into public.admin_invites (email, cargo, permissions, token_hash, created_by)
    values (v_email, btrim(coalesce(p_cargo, '')), v_perms, p_token_hash, (select auth.uid()))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Já existe um convite pendente para este e-mail. Use Reenviar na lista de convites.' using errcode = 'P0001';
  when check_violation then
    raise exception 'Dados do convite inválidos (e-mail ou cargo).' using errcode = '22023';
  end;
  return v_id;
end;
$$;

-- Token novo (o antigo para de valer) e mais 7 dias; devolve o e-mail para a Edge Function mandar o link
create or replace function public.convite_reenviar(p_id uuid, p_token_hash text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  if not public.gf_admin_can('super_admin') then
    raise exception 'Só o super_admin reenvia convites.' using errcode = '42501';
  end if;
  begin
    update public.admin_invites set token_hash = p_token_hash, expires_at = now() + interval '7 days'
    where id = p_id and status = 'pendente'
    returning email into v_email;
  exception when check_violation or unique_violation then
    raise exception 'Token inválido.' using errcode = '22023';
  end;
  if v_email is null then
    raise exception 'Convite não encontrado, já usado ou cancelado.' using errcode = 'P0001';
  end if;
  return v_email;
end;
$$;

create or replace function public.convite_cancelar(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.gf_admin_can('super_admin') then
    raise exception 'Só o super_admin cancela convites.' using errcode = '42501';
  end if;
  update public.admin_invites set status = 'cancelado' where id = p_id and status = 'pendente';
  if not found then
    raise exception 'Convite não encontrado, já usado ou cancelado.' using errcode = 'P0001';
  end if;
end;
$$;

-- Pendentes (status 'expirado' = pendente fora do prazo; no banco segue pendente até ser reenviado ou cancelado) e
-- os usados nos últimos 30 dias, com o nome do cadastro e a hora do aviso aos super_admins (null = o aviso não saiu)
drop function if exists public.convites_listar();
create function public.convites_listar()
returns table (id uuid, email text, cargo text, permissions text[], status text, created_at timestamptz,
               expires_at timestamptz, used_at timestamptz, used_by uuid, nome text, aviso_em timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.gf_admin_can('super_admin') then
    raise exception 'Só o super_admin vê os convites.' using errcode = '42501';
  end if;
  return query
    select i.id, i.email, i.cargo, i.permissions,
           case when i.status = 'pendente' and i.expires_at <= now() then 'expirado' else i.status end,
           i.created_at, i.expires_at, i.used_at, i.used_by, s.nome_completo, i.aviso_em
    from public.admin_invites i
    left join public.staff_profiles s on s.user_id = i.used_by
    where i.status = 'pendente' or (i.status = 'usado' and i.used_at > now() - interval '30 days')
    order by coalesce(i.used_at, i.created_at) desc;
end;
$$;

-- Cada leitura fica em staff_profiles_acessos (por isso volatile)
create or replace function public.colaborador_dados(p_user uuid)
returns setof public.staff_profiles
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.gf_admin_can('super_admin') then
    raise exception 'Só o super_admin vê os dados do cadastro.' using errcode = '42501';
  end if;
  insert into public.staff_profiles_acessos (leitor, colaborador) values ((select auth.uid()), p_user);
  return query select s.* from public.staff_profiles s where s.user_id = p_user;
end;
$$;

-- Qualquer admin (com 2FA e aal2): só nome, cargo e e-mail
create or replace function public.colaboradores_resumo()
returns table (user_id uuid, nome text, cargo text, email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.gf_is_admin() then
    raise exception 'Só colaboradores da Evokaa veem a equipe.' using errcode = '42501';
  end if;
  -- só quem segue na equipe (quem foi removido continua com o cadastro, mas não aparece)
  return query select s.user_id, s.nome_completo, s.cargo, s.email
    from public.staff_profiles s join public.profiles p on p.id = s.user_id and p.role = 'admin';
end;
$$;

-- 5. Página /convite
-- Sem login: o token (32 bytes aleatórios) é a prova. Devolve só se vale e o e-mail mascarado.
create or replace function public.convite_conferir(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object('valido', true,
              'email', left(split_part(i.email, '@', 1), 1) || '***@' || split_part(i.email, '@', 2))
     from public.admin_invites i
     where i.token_hash = public.convite_hash(p_token) and i.status = 'pendente' and i.expires_at > now()),
    jsonb_build_object('valido', false));
$$;

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
  if exists (select 1 from public.profiles p where p.id = v_uid and p.role in ('producer', 'editor')) then
    raise exception 'Este e-mail já tem uma conta de produtor. Convide outro e-mail, só para o trabalho na Evokaa.' using errcode = 'P0001';
  end if;

  -- 5. campos (os CHECKs de staff_profiles; a mensagem sai pelo nome da regra)
  begin
    v_nasc := (d ->> 'data_nascimento')::date;
  exception when others then
    raise exception 'Data de nascimento inválida.' using errcode = '22023';
  end;
  begin
    insert into public.staff_profiles as s (user_id, invite_id, email, cargo, nome_completo, cpf, rg, data_nascimento, cep, rua,
      numero, complemento, bairro, cidade, uf, email_secundario, telefone, whatsapp, emergencia_nome, emergencia_parentesco,
      emergencia_telefone, banco, agencia, conta, pix_tipo, pix_chave)
    values (v_uid, v.id, v.email, v.cargo,
      nullif(btrim(d ->> 'nome_completo'), ''),
      regexp_replace(nullif(btrim(d ->> 'cpf'), ''), '\D', '', 'g'),
      nullif(btrim(d ->> 'rg'), ''),
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
      nullif(btrim(d ->> 'banco'), ''),
      nullif(btrim(d ->> 'agencia'), ''),
      nullif(btrim(d ->> 'conta'), ''),
      v_pix_tipo,
      case v_pix_tipo
        when 'cpf' then regexp_replace(nullif(btrim(d ->> 'pix_chave'), ''), '\D', '', 'g')
        when 'email' then lower(nullif(btrim(d ->> 'pix_chave'), ''))
        when 'aleatoria' then lower(nullif(btrim(d ->> 'pix_chave'), ''))
        else nullif(btrim(d ->> 'pix_chave'), '') end)
    -- conta que já foi colaboradora (e saiu) e foi convidada de novo: o cadastro é refeito
    on conflict (user_id) do update set invite_id = excluded.invite_id, email = excluded.email, cargo = excluded.cargo,
      nome_completo = excluded.nome_completo, cpf = excluded.cpf, rg = excluded.rg, data_nascimento = excluded.data_nascimento,
      cep = excluded.cep, rua = excluded.rua, numero = excluded.numero, complemento = excluded.complemento,
      bairro = excluded.bairro, cidade = excluded.cidade, uf = excluded.uf, email_secundario = excluded.email_secundario,
      telefone = excluded.telefone, whatsapp = excluded.whatsapp, emergencia_nome = excluded.emergencia_nome,
      emergencia_parentesco = excluded.emergencia_parentesco, emergencia_telefone = excluded.emergencia_telefone,
      banco = excluded.banco, agencia = excluded.agencia, conta = excluded.conta, pix_tipo = excluded.pix_tipo,
      pix_chave = excluded.pix_chave, updated_at = now();
  exception
    when not_null_violation then
      raise exception 'Preencha todos os campos obrigatórios.' using errcode = '22023';
    when check_violation then
      get stacked diagnostics v_cons = constraint_name;
      raise exception '%', case v_cons
        when 'staff_nome_ok' then 'Informe o nome completo, só com letras, espaço, apóstrofo, ponto ou hífen.'
        when 'staff_cpf_ok' then 'CPF inválido.'
        when 'staff_rg_ok' then 'Informe o RG.'
        when 'staff_nascimento_ok' then 'Data de nascimento inválida: é preciso ter 18 anos ou mais.'
        when 'staff_cep_ok' then 'CEP: 8 dígitos.'
        when 'staff_endereco_ok' then 'Endereço incompleto (rua, número, bairro e cidade).'
        when 'staff_uf_ok' then 'Escolha o estado (UF).'
        when 'staff_email_secundario_ok' then 'E-mail secundário inválido ou igual ao e-mail principal.'
        when 'staff_telefones_ok' then 'Telefone ou WhatsApp inválido.'
        when 'staff_emergencia_ok' then 'Contato de emergência incompleto (nome, parentesco e telefone).'
        when 'staff_banco_ok' then 'Dados bancários longos demais.'
        when 'staff_pix_ok' then 'A chave Pix não confere com o tipo escolhido.'
        else 'Dados do cadastro inválidos.' end using errcode = '22023';
  end;

  -- papel e permissões vêm do convite gravado, nunca de quem chama. Sem as claims, o gatilho
  -- gf_protect_profile_privileges trata o UPDATE como do dono do banco (ver o cabeçalho); elas voltam em seguida.
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

-- 6. Dono, EXECUTE e search_path: o Supabase dá EXECUTE a anon/authenticated por padrão; aqui só o mínimo
do $$
declare
  f regprocedure;
begin
  foreach f in array array[
    'public.convite_permissoes_ok(text[])', 'public.convite_hash(text)',
    'public.convite_criar(text, text, text[], text)', 'public.convite_reenviar(uuid, text)', 'public.convite_cancelar(uuid)',
    'public.convites_listar()', 'public.colaborador_dados(uuid)', 'public.colaboradores_resumo()',
    'public.convite_conferir(text)', 'public.convite_aceitar(text, jsonb)']::regprocedure[] loop
    execute format('alter function %s owner to postgres', f);
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
  end loop;
end;
$$;
grant execute on function public.convite_criar(text, text, text[], text), public.convite_reenviar(uuid, text),
  public.convite_cancelar(uuid), public.convites_listar(), public.colaborador_dados(uuid), public.colaboradores_resumo(),
  public.convite_aceitar(text, jsonb) to authenticated;
grant execute on function public.convite_conferir(text) to anon, authenticated;
-- As regras (CHECK) rodam com os direitos de quem grava: a chave de serviço grava admin_invites (aviso do aceite) e
-- o colaborador edita staff_profiles. Funções puras, sem dado nenhum.
grant execute on function public.convite_permissoes_ok(text[]) to service_role;
grant execute on function public.gf_cpf_valido(text) to authenticated, service_role;
-- gatilhos: só o banco chama
revoke all on function public.staff_profiles_updated_at(), public.staff_profiles_registra_pagamento() from public, anon, authenticated, service_role;
alter function public.staff_profiles_registra_pagamento() owner to postgres;

-- 7. Limpeza: convite usado ou cancelado sai em 90 dias.
-- ponytail: prazo técnico provisório (o e-mail e o cargo do convite são dados pessoais sem uso depois do aceite);
-- o prazo de guarda é do jurídico: mudar aqui quando ele decidir.
do $$ begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'pg_cron não está ligado: ligar em Database > Extensions antes de rodar este arquivo';
  end if;
end $$;
select cron.unschedule('convites_limpar') where exists (select 1 from cron.job where jobname = 'convites_limpar');
select cron.schedule('convites_limpar', '41 3 * * *',
  $$delete from public.admin_invites where status <> 'pendente' and created_at < now() - interval '90 days'$$);

commit;

-- Desfazer (apaga convites e cadastros; antes, rebaixe pela tela Equipe quem entrou por convite, se for o caso):
-- drop function if exists public.convite_aceitar(text, jsonb), public.convite_conferir(text), public.colaboradores_resumo(),
--   public.colaborador_dados(uuid), public.convites_listar(), public.convite_cancelar(uuid), public.convite_reenviar(uuid, text),
--   public.convite_criar(text, text, text[], text);
-- select cron.unschedule('convites_limpar');
-- drop table if exists public.staff_profiles_acessos, public.staff_profiles_historico_pagamento, public.staff_profiles, public.admin_invites;
-- drop function if exists public.staff_profiles_updated_at(), public.staff_profiles_registra_pagamento();
-- drop function if exists public.convite_hash(text), public.convite_permissoes_ok(text[]);
