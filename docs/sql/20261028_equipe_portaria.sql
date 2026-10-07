-- =============================================================================
-- Tela 20 (Check-in): acesso real para a equipe da portaria (Decisões 172 e 186). 07/10/2026.
-- Antes: o produtor convidava (team_members), mas ninguém gravava accepted_at, o membro não lia a própria linha
-- e não lia os ingressos do produtor: o check-in do membro abria vazio.
-- 1) team_meus_convites(): o membro vê os próprios vínculos não bloqueados (pendentes e aceitos), com o nome do
--    produtor. Conta com 2FA sem o código nesta sessão (aal1): erro 42501 (a tela pede para entrar com o código).
-- 2) team_aceitar_convite(p_id): grava accepted_at no convite da própria conta, pendente e não bloqueado.
--    Exige 2FA cadastrado (fator verified) e o código nesta sessão (aal2), como convite_aceitar. Convite não expira.
--    Qualquer falha do convite (não existe, é de outra conta, já aceito, bloqueado, conta de colaborador da Evokaa)
--    dá a MESMA mensagem (P0001).
-- 3) team_eventos(), team_lista_ingressos(p_event_id) (os 1000 mais recentes) e team_contagem(p_event_id): o que a portaria precisa, sem SELECT novo em tickets nem em
--    events. Só membro aceito, sem bloqueio, cargo admin ou editor, com 2FA cadastrado e o código nesta sessão
--    (gf_portaria_ok, uso interno). A lista devolve SÓ id, buyer_name, status, checked_in_at e o nome do tipo: sem
--    qr_code, buyer_email, buyer_cpf, user_id, order_id, price_paid, transferred_to. Quem não pode recebe lista vazia.
--    Ignoram a RLS de events: evento publicado com senha ou privado também aparece para a equipe.
--    O check-in em si continua na Edge Function check-in-validate (não muda).
-- 4) MÉDIO do #206: vínculo PENDENTE não conta mais como equipe em mesa_conflito, mesa_denuncia_que_remove,
--    mesa_denuncias_do_evento, convite_criar e convite_aceitar. Cada função foi recriada igual à anterior
--    (20261003_mesa_coletiva.sql e 20261002_convite_colaborador.sql), só com `and <alias>.accepted_at is not null`.
--    `create or replace` mantém dono e permissões dessas funções. O bloco 0 aborta se a definição de produção mudou.
-- Como aplicar: ensaiar com ROLLBACK, depois colar inteiro no SQL Editor (UTF-8 via pbcopy, nunca TextEdit).
-- Uma transação, idempotente. Aplicar ANTES de mesclar o front (/equipe chama as funções novas).
-- Testes: supabase/tests/team_aceite.test.sql. NÃO mover para supabase/migrations/.
-- Desfazer:
--   drop function if exists public.team_contagem(uuid), public.team_lista_ingressos(uuid), public.team_eventos(), public.gf_portaria_ok(uuid),
--     public.team_aceitar_convite(uuid), public.team_meus_convites();
--   e rodar de novo as 5 funções dos arquivos 20261003_mesa_coletiva.sql e 20261002_convite_colaborador.sql.
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 0. Conferência das definições de produção --------------------------------------------------------------------------
do $$
declare
  f text;
  atual text;
  -- md5(pg_get_functiondef) de produção (07/10/2026) e da versão deste arquivo (2ª aplicação)
  producao jsonb := jsonb_build_object(
    'convite_aceitar(text,jsonb)', 'c542ca25390fd406dafd96dc5d709419',
    'convite_criar(text,text,text[],text)', '6f2f429f946b5ae64215e7dbd70900cd',
    'mesa_conflito(uuid,uuid)', 'a6cf049266a86157d31da976f2525ad6',
    'mesa_denuncia_que_remove(uuid,uuid,boolean)', 'd4a66835e7d5320cb077569321cc3df0',
    'mesa_denuncias_do_evento(uuid)', '90169fa2af33e1321ee443d20d7851d6');
  versao_nova jsonb := jsonb_build_object(
    'convite_aceitar(text,jsonb)', '805f624bc3baaae11629ee844406c2f5',
    'convite_criar(text,text,text[],text)', '6216205ac8b3ef9d00505dc8034170d5',
    'mesa_conflito(uuid,uuid)', 'ee6c090f7bef3415b2580fad23beb0d1',
    'mesa_denuncia_que_remove(uuid,uuid,boolean)', '3800b1cab2b33ee4ded35cf563cbb45a',
    'mesa_denuncias_do_evento(uuid)', '0f6dc89f83451c2cb0249a158cf4752d');
begin
  if to_regclass('public.team_members') is null
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'team_members' and column_name = 'blocked_at') then
    raise exception 'falta public.team_members.blocked_at (aplicar antes 20261017_team_members_rls.sql)';
  end if;
  for f in select jsonb_object_keys(producao) loop
    if to_regprocedure('public.' || f) is null then
      raise exception 'falta a função public.%', f;
    end if;
    atual := md5(pg_get_functiondef(('public.' || f)::regprocedure));
    if atual is distinct from producao ->> f and atual is distinct from versao_nova ->> f then
      raise exception 'public.% mudou desde 07/10/2026 (md5 %): NÃO aplicar; refazer o bloco 4 a partir da definição atual', f, atual;
    end if;
  end loop;
end $$;

-- 1. Meus vínculos de equipe (sem bloqueio)
drop function if exists public.team_meus_convites();
create function public.team_meus_convites()
returns table (id uuid, producer_id uuid, producer_name text, role text, invited_at timestamptz, accepted_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- conta com 2FA sem o código nesta sessão: avisa em vez de lista vazia (a tela pede o código)
  if not public.gf_mfa_ok() then
    raise exception 'Entre com o código da verificação em duas etapas para ver seus convites.' using errcode = '42501';
  end if;
  return query
    select t.id, t.producer_id, coalesce(nullif(btrim(p.full_name), ''), 'Produtor'), t.role, t.invited_at, t.accepted_at
    from public.team_members t
    left join public.profiles p on p.id = t.producer_id
    where t.user_id = (select auth.uid()) and t.blocked_at is null
    order by t.accepted_at is not null, t.invited_at desc;
end;
$$;
revoke all on function public.team_meus_convites() from public, anon;
grant execute on function public.team_meus_convites() to authenticated;

-- 2. Aceitar o convite da própria conta
create or replace function public.team_aceitar_convite(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Entre na sua conta para aceitar o convite.' using errcode = '42501';
  end if;
  -- 2FA: fator confirmado e o código digitado nesta sessão (a mesma exigência de convite_aceitar)
  if not (public.gf_mfa_ok() and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
          and exists (select 1 from auth.mfa_factors f where f.user_id = v_uid and f.status = 'verified')) then
    raise exception 'Ative a verificação em duas etapas e entre com o código antes de aceitar o convite.' using errcode = '42501';
  end if;
  -- colaborador da Evokaa não entra em equipe de produtor (o espelho de convite_criar/convite_aceitar)
  update public.team_members t set accepted_at = now()
  where t.id = p_id and t.user_id = v_uid and t.accepted_at is null and t.blocked_at is null
    and not exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'admin');
  if not found then
    raise exception 'Convite não encontrado ou já aceito.' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function public.team_aceitar_convite(uuid) from public, anon;
grant execute on function public.team_aceitar_convite(uuid) to authenticated;

-- 3. Portaria: membro aceito, sem bloqueio, admin ou editor, com 2FA cadastrado e o código nesta sessão. Uso interno.
create or replace function public.gf_portaria_ok(p_producer uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.gf_mfa_ok() and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    and exists (select 1 from auth.mfa_factors f where f.user_id = (select auth.uid()) and f.status = 'verified')
    and exists (select 1 from public.team_members t
                where t.producer_id = p_producer and t.user_id = (select auth.uid())
                  and t.role in ('admin', 'editor') and t.accepted_at is not null and t.blocked_at is null);
$$;
revoke all on function public.gf_portaria_ok(uuid) from public, anon, authenticated;

create or replace function public.team_eventos()
returns table (id uuid, title text, start_date timestamptz, producer_id uuid, producer_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.title, e.start_date, e.producer_id, coalesce(nullif(btrim(p.full_name), ''), 'Produtor')
  from public.events e
  left join public.profiles p on p.id = e.producer_id
  where e.status = 'published' and public.gf_portaria_ok(e.producer_id)
  order by e.start_date, e.id;
$$;
revoke all on function public.team_eventos() from public, anon;
grant execute on function public.team_eventos() to authenticated;

-- Os 1000 mais recentes, como a lista do dono (max_rows da API também é 1000); os números vêm de team_contagem.
create or replace function public.team_lista_ingressos(p_event_id uuid)
returns table (id uuid, buyer_name text, status text, checked_in_at timestamptz, tipo text)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.buyer_name, t.status, t.checked_in_at, tt.name
  from public.events e
  join public.tickets t on t.event_id = e.id
  left join public.ticket_types tt on tt.id = t.ticket_type_id
  where e.id = p_event_id and e.status = 'published' and public.gf_portaria_ok(e.producer_id)
  order by t.created_at desc, t.id
  limit 1000;
$$;
revoke all on function public.team_lista_ingressos(uuid) from public, anon;
grant execute on function public.team_lista_ingressos(uuid) to authenticated;

-- Números do evento para a portaria (só contagens, sem dado pessoal); mesmas guardas da lista
create or replace function public.team_contagem(p_event_id uuid)
returns table (total bigint, usados bigint, cancelados bigint, transferidos bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*), count(*) filter (where t.status = 'used'), count(*) filter (where t.status in ('cancelled', 'refunded')),
         count(*) filter (where t.status = 'transferred')
  from public.events e
  join public.tickets t on t.event_id = e.id
  where e.id = p_event_id and e.status = 'published' and public.gf_portaria_ok(e.producer_id);
$$;
revoke all on function public.team_contagem(uuid) from public, anon;
grant execute on function public.team_contagem(uuid) to authenticated;

-- 4. Vínculo pendente não conta como equipe (MÉDIO do #206)
create or replace function public.mesa_conflito(p_evento uuid, p_denunciado uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_denunciado = auth.uid()
      or (exists (select 1 from public.events e where e.id = p_evento and e.producer_id = auth.uid())
          and exists (select 1 from public.team_members tm where tm.producer_id = auth.uid() and tm.user_id = p_denunciado and tm.accepted_at is not null));
$$;

create or replace function public.mesa_denuncia_que_remove(p_event_id uuid, p_user uuid, p_produtor boolean)
returns uuid
language sql
stable
set search_path = ''
as $$
  select d.id
  from public.events e
  join public.mesa_denuncias d on d.evento = e.id
  where e.id = p_event_id and d.denunciado = p_user
    and case when p_produtor then
          d.liberada_produtor_em is not null
          and d.denunciado is distinct from e.producer_id
          and d.denunciante is distinct from e.producer_id
          and d.liberada_por is distinct from auth.uid()
          and not exists (select 1 from public.team_members tm where tm.producer_id = e.producer_id and tm.user_id = d.denunciado and tm.accepted_at is not null)
        else
          not coalesce(public.mesa_conflito(d.evento, d.denunciado), false)
          and d.denunciante is distinct from auth.uid()
          and d.status <> 'aberta'  -- só depois da análise
        end
    and d.resultado is distinct from 'improcedente'  -- resolvida e improcedente nunca vale
  order by d.criado_em desc, d.id
  limit 1;
$$;

create or replace function public.mesa_denuncias_do_evento(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_produtor uuid := (select e.producer_id from public.events e where e.id = p_event_id);
begin
  if not public.gf_mfa_ok() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if public.gf_admin_can('moderate_mesa') then
    perform public.mesa_moderador();
    return coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', d.id, 'criado_em', d.criado_em, 'motivo', d.motivo, 'detalhe', d.detalhe, 'status', d.status,
               'mesa', d.mesa, 'denunciante', d.denunciante_nome, 'denunciado', d.denunciado_nome,
               'mesma_mesa', d.mesma_mesa, 'sobreposicao_inicio', d.sobreposicao_inicio,
               'sobreposicao_fim', d.sobreposicao_fim, 'status_mudado_em', d.status_mudado_em,
               'liberada_produtor_em', d.liberada_produtor_em, 'resultado', d.resultado,
               'resultado_explicacao', d.resultado_explicacao)
             order by d.criado_em desc, d.id)
      from public.mesa_denuncias d
      where d.evento = p_event_id and not coalesce(public.mesa_conflito(d.evento, d.denunciado), false)
    ), '[]'::jsonb);
  end if;
  if v_produtor is distinct from auth.uid() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('denunciado', d.denunciado_nome, 'motivo', d.motivo, 'mesa', d.mesa, 'resultado', d.resultado)
                     order by d.criado_em desc, d.id)
    from public.mesa_denuncias d
    where d.evento = p_event_id and d.liberada_produtor_em is not null and d.denunciado is distinct from v_produtor
      and not exists (select 1 from public.team_members tm where tm.producer_id = v_produtor and tm.user_id = d.denunciado and tm.accepted_at is not null)
  ), '[]'::jsonb);
end;
$$;

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
    raise exception 'Só quem tem Acesso total convida colaboradores.' using errcode = '42501';
  end if;
  if not public.convite_permissoes_ok(v_perms) then
    raise exception 'Função inválida no convite.' using errcode = '22023';
  end if;
  if exists (select 1 from public.profiles p where lower(p.email) = v_email and p.role = 'admin') then
    raise exception 'Essa pessoa já faz parte dos colaboradores da Evokaa.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.profiles p where lower(p.email) = v_email and p.role = 'producer') then
    raise exception 'Este e-mail já tem uma conta de produtor. Convide outro e-mail, só para o trabalho na Evokaa.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.team_members t join public.profiles p on p.id = t.user_id where lower(p.email) = v_email and t.accepted_at is not null) then
    raise exception 'Este e-mail faz parte da equipe de um produtor. Convide outro e-mail, só para o trabalho na Evokaa.' using errcode = 'P0001';
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
  if exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'producer') then
    raise exception 'Este e-mail já tem uma conta de produtor. Convide outro e-mail, só para o trabalho na Evokaa.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.team_members t where t.user_id = v_uid and t.accepted_at is not null) then
    raise exception 'Este e-mail faz parte da equipe de um produtor. Convide outro e-mail, só para o trabalho na Evokaa.' using errcode = 'P0001';
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
      -- apóstrofo curvo do iPhone vira reto; forma decomposta vira NFC (a regra staff_nome_ok olha a forma composta)
      normalize(nullif(replace(btrim(d ->> 'nome_completo'), '’', ''''), ''), NFC),
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
        when 'staff_nome_ok' then 'Informe o nome completo, só com letras, espaço, apóstrofo, ponto ou hífen (sem endereço de site).'
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

commit;
