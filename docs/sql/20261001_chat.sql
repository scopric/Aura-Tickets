-- =============================================================================
-- Chat estilo Intercom (etapa 1a) — banco — 2026-10-01
-- Aplicar à mão no SQL Editor do Supabase. NÃO vai para supabase/migrations (Decisão 02).
-- Especificação: Claude/Entregas/2026-09-29 Chat estilo Intercom — especificação (Decisão 75);
-- plano: Claude/Planos/reflective-floating-wand (Fase 1).
-- Contrato: setores, assuntos, contatos, conversas, mensagens e configurações do chat; o navegador
-- só LÊ (RLS) e só ESCREVE pelas funções chat_* (SECURITY DEFINER), que decidem o papel de quem
-- chama pela ligação com a conversa (chat_role), nunca por parâmetro.
-- Avisos por e-mail: o pg_cron chama a Edge Function chat-notify a cada 2 min com um segredo
-- guardado no Vault (chat_notify_secret), lido na hora de rodar; nada de chave neste arquivo.
-- O Supabase dá EXECUTE/ALL a anon e authenticated por padrão (default privileges): por isso
-- cada função e tabela tem revoke explícito seguido do grant mínimo (bloco 10).
-- Pré-requisitos (conferidos em 29/09): gf_admin_can (20260929_agente_evo.sql), supabase_vault,
-- pg_cron e pg_net ligados. Idempotente: pode rodar de novo (inclusive o bloco 9, de migração,
-- que roda outra vez depois do deploy do PR B).
-- =============================================================================
begin;

-- 1. Tabelas ------------------------------------------------------------------

-- 1a. Setores (equipes internas da Evokaa)
create table if not exists public.chat_departments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z_]{2,40}$'),
  name text not null check (char_length(name) between 2 and 60),
  position int not null default 0,
  active boolean not null default true,
  default_assignee uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 1b. Assuntos (o que a pessoa escolhe). Assunto do produtor (participant_producer) não tem setor.
create table if not exists public.chat_topics (
  id uuid primary key default gen_random_uuid(),
  audience text not null check (audience in ('site', 'producer', 'participant_evokaa', 'participant_producer')),
  label text not null check (char_length(label) between 2 and 120),
  hint text check (char_length(hint) <= 300),
  department_id uuid references public.chat_departments(id) on delete restrict,
  requires_ticket boolean not null default false,
  urgent boolean not null default false,
  mediation boolean not null default false,
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint chat_topics_destino_chk check ((audience = 'participant_producer') = (department_id is null))
);
create index if not exists chat_topics_department_idx on public.chat_topics (department_id);

-- 1c. Contatos (base de leads). Um por conta. Telefone nulo só nas conversas migradas.
--     Sem email_verified na 1a: a confirmação automática de e-mail está ligada, então o e-mail
--     da conta não prova nada (plano, "Limite conhecido").
create table if not exists public.chat_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete set null,
  name text not null check (char_length(name) between 2 and 120),
  email text check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (phone ~ '^55[1-9]{2}9?[0-9]{8}$'),
  origin text not null default 'app' check (origin in ('site', 'app', 'migracao')),
  marketing_opt_in boolean not null default false,
  marketing_opt_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 1d. Conversas. "Não lida" sai da própria linha: last_customer_message_at > agent_last_read_at
--     (equipe) e last_reply_at > customer_last_read_at (cliente).
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.chat_contacts(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  kind text not null default 'evokaa' check (kind in ('evokaa', 'producer')),
  topic_id uuid references public.chat_topics(id) on delete set null,
  department_id uuid references public.chat_departments(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  producer_id uuid references public.profiles(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  priority text not null default 'normal' check (priority in ('normal', 'urgent')),
  assignee_id uuid references public.profiles(id) on delete set null,
  customer_last_read_at timestamptz,
  agent_last_read_at timestamptz,
  first_response_at timestamptz,
  resolved_at timestamptz,
  last_message_at timestamptz not null default now(),
  last_message_preview text check (char_length(last_message_preview) <= 140),
  last_customer_message_at timestamptz,
  last_reply_at timestamptz,
  rating smallint check (rating between 1 and 3),
  customer_emailed_at timestamptz,
  team_alerted_at timestamptz,
  -- envios que falharam seguidos (chat-notify); em 5 a conversa sai da fila e não trava as outras
  notify_failures int not null default 0,
  -- reserva da chat-notify: linha devolvida por chat_notify_due fica fora da fila até esta hora
  notify_claimed_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists conversations_status_last_idx on public.conversations (status, last_message_at desc);
create index if not exists conversations_user_last_idx on public.conversations (user_id, last_message_at desc);
create index if not exists conversations_assignee_open_idx on public.conversations (assignee_id) where status = 'open';

-- 1e. Mensagens. sender_role e sender_name são gravados pelo servidor.
create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  sender_role text not null check (sender_role in ('customer', 'agent', 'producer', 'bot', 'system')),
  sender_name text not null check (char_length(sender_name) between 1 and 120),
  body text not null default '' check (char_length(body) <= 4000),
  is_internal boolean not null default false,
  attachment_path text check (char_length(attachment_path) <= 300),
  attachment_name text check (char_length(attachment_name) <= 200),
  attachment_mime text,
  attachment_size bigint,
  created_at timestamptz not null default now(),
  constraint conversation_messages_conteudo_chk check (body <> '' or attachment_path is not null),
  constraint conversation_messages_nota_chk check (not (is_internal and sender_role = 'customer'))
);
create index if not exists conversation_messages_conv_created_idx on public.conversation_messages (conversation_id, created_at);
create index if not exists conversation_messages_sender_created_idx on public.conversation_messages (sender_id, created_at);

-- 1f. Configurações (linha única). VALORES PROVISÓRIOS até o Ricardo decidir horário, prazo
--     exibido e e-mail da equipe. hours: dia ISO (1 = segunda … 7 = domingo) → [abre, fecha],
--     horário de São Paulo; dia ausente = fechado.
create table if not exists public.chat_settings (
  id int primary key default 1 check (id = 1),
  hours jsonb not null default '{"1":["09:00","18:00"],"2":["09:00","18:00"],"3":["09:00","18:00"],"4":["09:00","18:00"],"5":["09:00","18:00"]}',
  response_time text not null default 'Respondemos em até 1 dia útil.' check (char_length(response_time) <= 120),
  team_email text not null default 'contato@evokaa.com.br' check (team_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  updated_at timestamptz not null default now()
);
insert into public.chat_settings (id) values (1) on conflict do nothing;

-- 2. Seed ----------------------------------------------------------------------
insert into public.chat_departments (slug, name, position) values
  ('comercial', 'Comercial', 1),
  ('atendimento_participante', 'Atendimento ao participante', 2),
  ('suporte_produtor', 'Suporte ao produtor', 3),
  ('suporte_tecnico', 'Suporte técnico', 4),
  ('financeiro', 'Financeiro', 5),
  ('parcerias', 'Parcerias', 6),
  ('privacidade', 'Privacidade', 7),
  ('geral', 'Geral', 8)
on conflict (slug) do nothing;

-- Assuntos só na 1ª vez (depois o admin edita). Os de participant_producer ficam para a etapa 4.
insert into public.chat_topics (audience, label, hint, department_id, urgent, position)
select v.audience, v.label, v.hint, d.id, v.urgent, v.position
from (values
  ('site', 'Quero vender ingressos / conhecer os planos', null, 'comercial', false, 1),
  ('site', 'Comprei um ingresso', 'Para falar com o produtor do evento, entre na sua conta.', 'atendimento_participante', false, 2),
  ('site', 'Quero ser afiliado ou parceiro', null, 'parcerias', false, 3),
  ('site', 'Problema no site ou na minha conta', null, 'suporte_tecnico', false, 4),
  ('site', 'Imprensa e outros assuntos', null, 'geral', false, 5),
  ('producer', 'Criar ou configurar meu evento', null, 'suporte_produtor', false, 1),
  ('producer', 'Dia do evento: check-in e portaria', null, 'suporte_produtor', true, 2),
  ('producer', 'Vendas, repasses e taxas', null, 'financeiro', false, 3),
  ('producer', 'Meu plano e assinatura', null, 'comercial', false, 4),
  ('producer', 'Erro ou problema técnico', null, 'suporte_tecnico', false, 5),
  ('producer', 'Afiliados e indicações', null, 'parcerias', false, 6),
  ('producer', 'Outros assuntos', null, 'geral', false, 7),
  ('participant_evokaa', 'Não recebi ou não acho meu ingresso', null, 'atendimento_participante', false, 1),
  ('participant_evokaa', 'Pagamento: cobrança, Pix ou cartão', null, 'financeiro', false, 2),
  ('participant_evokaa', 'Minha conta e acesso', null, 'suporte_tecnico', false, 3),
  ('participant_evokaa', 'Meus dados e privacidade (LGPD)', null, 'privacidade', false, 4),
  ('participant_evokaa', 'Outros assuntos', null, 'geral', false, 5)
) as v(audience, label, hint, slug, urgent, position)
join public.chat_departments d on d.slug = v.slug
where not exists (select 1 from public.chat_topics);

-- 3. Funções -----------------------------------------------------------------

-- 3a. chat_role: ÚNICA fonte da regra de vínculo com a conversa (RLS, Storage, chat_send,
--     chat_update, chat_mark_read, chat_rate). Dono → customer (mesmo se for admin ou produtor);
--     produtor da conversa → producer; admin com manage_support → agent, em conversa da Evokaa
--     ou de assunto com mediação. Sem vínculo → null.
--     ponytail: avaliada por linha no RLS; desnormalizar se passar de alguns milhares de conversas.
create or replace function public.chat_role(p_conv uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when c.user_id = (select auth.uid()) then 'customer'
    when c.producer_id = (select auth.uid()) then 'producer'
    when (c.kind = 'evokaa' or coalesce(t.mediation, false)) and public.gf_admin_can('manage_support') then 'agent'
  end
  from public.conversations c
  left join public.chat_topics t on t.id = c.topic_id
  where c.id = p_conv;
$$;

-- 3b. chat_role_path: papel pelo caminho do arquivo no Storage ({conversa}/{arquivo}).
--     Cast do UUID só depois do regex (nome fora do formato → null, sem erro).
create or replace function public.chat_role_path(p_name text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]{1,200}$'
      then public.chat_role(split_part(p_name, '/', 1)::uuid)
  end;
$$;

-- 3b'. chat_can_upload: regra de ENVIO ao bucket = vínculo com a conversa do caminho, conversa
--      aberta e no máximo 20 arquivos na pasta dela. CASE garante a ordem: o cast do UUID só
--      roda depois de chat_role_path validar o formato.
--      ponytail: dois envios simultâneos podem passar de 20 por 1; lock por conversa se virar abuso.
create or replace function public.chat_can_upload(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.chat_role_path(p_name) is null then false
    else exists (
           select 1 from public.conversations c
           where c.id = split_part(p_name, '/', 1)::uuid and c.status = 'open')
         and (select count(*) from storage.objects o
              where o.bucket_id = 'chat-anexos'
                and starts_with(o.name, split_part(p_name, '/', 1) || '/')) < 20
  end;
$$;

-- 3c. chat_start: abre conversa com a 1ª mensagem (sem anexo; o clipe só aparece depois).
--     Público permitido = o do papel real (profiles.role) + 'site'. participant_producer e
--     p_event_id ficam recusados na 1a (o parâmetro já existe para a etapa 4 não trocar a assinatura).
--     Limites: 3 conversas abertas por pessoa e 5 conversas novas por hora (cada uma alerta a equipe).
create or replace function public.chat_start(
  p_topic_id uuid, p_event_id uuid, p_name text, p_phone text, p_marketing_opt_in boolean, p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_publicos text[];
  v_name text := trim(coalesce(p_name, ''));
  v_body text := trim(coalesce(p_body, ''));
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_opt boolean := coalesce(p_marketing_opt_in, false);
  v_email text;
  v_topic public.chat_topics;
  v_contact uuid;
  v_conv uuid;
begin
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  if char_length(v_name) not between 2 and 120 then
    raise exception 'Nome inválido: use de 2 a 120 caracteres' using errcode = '22023';
  end if;
  if v_phone !~ '^55[1-9]{2}9?[0-9]{8}$' then
    raise exception 'Telefone inválido: use um número do Brasil com DDD' using errcode = '22023';
  end if;
  if char_length(v_body) not between 1 and 4000 then
    raise exception 'Mensagem inválida: escreva de 1 a 4.000 caracteres' using errcode = '22023';
  end if;

  select p.role into v_role from public.profiles p where p.id = v_uid;
  if v_role is null then
    raise exception 'Perfil não encontrado' using errcode = '42501';
  end if;
  v_publicos := array['site'] || case
    when v_role in ('user', 'customer') then array['participant_evokaa']
    when v_role in ('producer', 'editor') then array['producer']
    else array[]::text[]
  end;

  select * into v_topic from public.chat_topics t where t.id = p_topic_id and t.active;
  if v_topic.audience = 'participant_producer' or p_event_id is not null then
    return jsonb_build_object('ok', false, 'motivo', 'nao_disponivel');
  end if;
  if v_topic.id is null or not (v_topic.audience = any(v_publicos)) then
    return jsonb_build_object('ok', false, 'motivo', 'assunto_invalido');
  end if;

  -- serializa as escritas da mesma pessoa (chat_start e chat_send) para os limites valerem
  perform pg_advisory_xact_lock(hashtext('chat:' || v_uid::text));
  if (select count(*) from public.conversations c where c.user_id = v_uid and c.status = 'open') >= 3 then
    return jsonb_build_object('ok', false, 'motivo', 'limite_abertas');
  end if;
  if (select count(*) from public.conversations c
      where c.user_id = v_uid and c.created_at > now() - interval '1 hour') >= 5 then
    return jsonb_build_object('ok', false, 'motivo', 'limite_hora');
  end if;

  -- e-mail sempre o da conta (nunca digitado)
  select u.email into v_email from auth.users u where u.id = v_uid;
  v_email := case when lower(v_email) ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then lower(v_email) end;

  insert into public.chat_contacts (user_id, name, email, phone, origin, marketing_opt_in, marketing_opt_in_at)
  values (v_uid, v_name, v_email, v_phone,
          case when v_topic.audience = 'site' then 'site' else 'app' end,
          v_opt, case when v_opt then now() end)
  on conflict (user_id) do update
    set name = excluded.name,
        email = excluded.email,
        phone = excluded.phone,
        marketing_opt_in = excluded.marketing_opt_in,
        marketing_opt_in_at = case
          when not excluded.marketing_opt_in then null
          when public.chat_contacts.marketing_opt_in then public.chat_contacts.marketing_opt_in_at
          else now() end,
        updated_at = now()
  returning id into v_contact;

  -- formato do PhoneInput (+55…), só se o perfil ainda não tem telefone
  update public.profiles p set phone = '+' || v_phone
  where p.id = v_uid and coalesce(p.phone, '') = '';

  insert into public.conversations (contact_id, user_id, kind, topic_id, department_id, priority)
  values (v_contact, v_uid, 'evokaa', v_topic.id, v_topic.department_id,
          case when v_topic.urgent then 'urgent' else 'normal' end)
  returning id into v_conv;

  insert into public.conversation_messages (conversation_id, sender_id, sender_role, sender_name, body)
  values (v_conv, v_uid, 'customer', v_name, v_body);

  return jsonb_build_object('ok', true, 'id', v_conv);
end;
$$;

-- 3d. chat_send: papel por chat_role, nunca por parâmetro. Cliente não manda nota; nota não
--     leva anexo (o cliente listaria o arquivo na pasta da conversa). Anexo: caminho
--     {conversa}/…, objeto existente no bucket chat-anexos; tipo e tamanho lidos do Storage.
--     Limite: 20 mensagens por minuto por pessoa. Cliente escrevendo em resolvida reabre
--     (respeitando o máximo de 3 abertas).
create or replace function public.chat_send(
  p_conv uuid, p_body text, p_is_internal boolean, p_attachment_path text, p_attachment_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text := public.chat_role(p_conv);
  v_body text := trim(coalesce(p_body, ''));
  v_internal boolean := coalesce(p_is_internal, false);
  v_path text := nullif(trim(coalesce(p_attachment_path, '')), '');
  v_meta jsonb;
  v_mime text;
  v_name text;
  v_sender text;
  v_id uuid;
begin
  if v_uid is null or v_role is null then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if v_internal and v_role = 'customer' then
    raise exception 'Nota interna é só da equipe' using errcode = '42501';
  end if;
  if char_length(v_body) > 4000 then
    raise exception 'Mensagem longa demais: até 4.000 caracteres' using errcode = '22023';
  end if;
  if v_body = '' and v_path is null then
    raise exception 'Mensagem vazia' using errcode = '22023';
  end if;

  if v_path is not null then
    if v_internal then
      raise exception 'Nota interna não leva anexo' using errcode = '22023';
    end if;
    if not starts_with(v_path, p_conv::text || '/') then
      raise exception 'Anexo de outra conversa' using errcode = '22023';
    end if;
    select o.metadata into v_meta
    from storage.objects o
    where o.bucket_id = 'chat-anexos' and o.name = v_path;
    if not found then
      raise exception 'Anexo não encontrado' using errcode = '22023';
    end if;
    v_mime := v_meta ->> 'mimetype';
    if coalesce(v_mime, '') not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') then
      raise exception 'Tipo de anexo não aceito' using errcode = '22023';
    end if;
    v_name := left(coalesce(nullif(trim(coalesce(p_attachment_name, '')), ''), split_part(v_path, '/', 2)), 200);
  end if;

  perform pg_advisory_xact_lock(hashtext('chat:' || v_uid::text));
  if (select count(*) from public.conversation_messages m
      where m.sender_id = v_uid and m.created_at > now() - interval '1 minute') >= 20 then
    return jsonb_build_object('ok', false, 'motivo', 'limite_minuto');
  end if;

  if v_role = 'customer' then
    -- reabrir conta no limite de 3 abertas, como no chat_start
    if (select c.status from public.conversations c where c.id = p_conv) = 'resolved'
       and (select count(*) from public.conversations c where c.user_id = v_uid and c.status = 'open') >= 3 then
      return jsonb_build_object('ok', false, 'motivo', 'limite_abertas');
    end if;
    select ct.name into v_sender
    from public.conversations c join public.chat_contacts ct on ct.id = c.contact_id
    where c.id = p_conv;
    update public.conversations c
    set status = 'open', resolved_at = null, updated_at = now()
    where c.id = p_conv and c.status = 'resolved';
  end if;
  -- cliente: nome do contato (ou do perfil); equipe e produtor: só o primeiro nome
  if v_sender is null then
    select left(case when v_role = 'customer' then nullif(trim(p.full_name), '')
                     else nullif(split_part(trim(p.full_name), ' ', 1), '') end, 120)
      into v_sender from public.profiles p where p.id = v_uid;
  end if;
  v_sender := coalesce(v_sender, case v_role when 'agent' then 'Equipe Evokaa' when 'producer' then 'Produtor' else 'Cliente' end);

  insert into public.conversation_messages (
    conversation_id, sender_id, sender_role, sender_name, body, is_internal,
    attachment_path, attachment_name, attachment_mime, attachment_size
  )
  values (p_conv, v_uid, v_role, v_sender, v_body, v_internal,
          v_path, v_name, v_mime, (v_meta ->> 'size')::bigint)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- 3e. chat_update: só atendente (agent). Chaves aceitas: status, assignee_id (admin com
--     manage_support ou super_admin, ou nulo), priority, department_id. Outra chave → erro.
create or replace function public.chat_update(p_conv uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uuid_re constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  v_chave text;
  v_assignee uuid;
  v_dept uuid;
begin
  if public.chat_role(p_conv) is distinct from 'agent' then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if jsonb_typeof(p_patch) is distinct from 'object' or p_patch = '{}'::jsonb then
    raise exception 'Alteração vazia' using errcode = '22023';
  end if;
  for v_chave in select jsonb_object_keys(p_patch) loop
    if v_chave not in ('status', 'assignee_id', 'priority', 'department_id') then
      raise exception 'Campo não permitido: %', left(v_chave, 40) using errcode = '22023';
    end if;
  end loop;

  if p_patch ? 'status' and coalesce(p_patch ->> 'status', '') not in ('open', 'resolved') then
    raise exception 'Status inválido' using errcode = '22023';
  end if;
  if p_patch ? 'priority' and coalesce(p_patch ->> 'priority', '') not in ('normal', 'urgent') then
    raise exception 'Prioridade inválida' using errcode = '22023';
  end if;
  if p_patch ? 'assignee_id' and jsonb_typeof(p_patch -> 'assignee_id') <> 'null' then
    if coalesce(p_patch ->> 'assignee_id', '') !~ v_uuid_re then
      raise exception 'Responsável inválido' using errcode = '22023';
    end if;
    v_assignee := (p_patch ->> 'assignee_id')::uuid;
    if not exists (
      select 1 from public.profiles pr
      where pr.id = v_assignee and pr.role = 'admin'
        and pr.admin_permissions && array['super_admin', 'manage_support']
    ) then
      raise exception 'Responsável precisa ser admin com a permissão de atendimento' using errcode = '22023';
    end if;
  end if;
  if p_patch ? 'department_id' then
    if coalesce(p_patch ->> 'department_id', '') !~ v_uuid_re then
      raise exception 'Setor inválido' using errcode = '22023';
    end if;
    v_dept := (p_patch ->> 'department_id')::uuid;
    if not exists (select 1 from public.chat_departments d where d.id = v_dept) then
      raise exception 'Setor inválido' using errcode = '22023';
    end if;
  end if;

  update public.conversations c set
    status = case when p_patch ? 'status' then p_patch ->> 'status' else c.status end,
    resolved_at = case
      when not (p_patch ? 'status') then c.resolved_at
      when p_patch ->> 'status' = 'resolved' then coalesce(c.resolved_at, now())
      else null end,
    assignee_id = case when p_patch ? 'assignee_id' then v_assignee else c.assignee_id end,
    priority = case when p_patch ? 'priority' then p_patch ->> 'priority' else c.priority end,
    department_id = case when p_patch ? 'department_id' then v_dept else c.department_id end,
    updated_at = now()
  where c.id = p_conv;

  return jsonb_build_object('ok', true);
end;
$$;

-- 3f. chat_mark_read: "visto". Cliente marca o lado dele; equipe (agent ou produtor) o outro.
create or replace function public.chat_mark_read(p_conv uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := public.chat_role(p_conv);
begin
  if v_role is null then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if v_role = 'customer' then
    update public.conversations c set customer_last_read_at = now() where c.id = p_conv;
  else
    update public.conversations c set agent_last_read_at = now() where c.id = p_conv;
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- 3g. chat_rate: só o cliente, só conversa resolvida, uma vez (reabrir mantém a nota).
create or replace function public.chat_rate(p_conv uuid, p_rating int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.chat_role(p_conv) is distinct from 'customer' then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if p_rating is null or p_rating not between 1 and 3 then
    raise exception 'Avaliação inválida: de 1 a 3' using errcode = '22023';
  end if;
  update public.conversations c set rating = p_rating, updated_at = now()
  where c.id = p_conv and c.status = 'resolved' and c.rating is null;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'nao_permitido');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- 3h. chat_public_settings: horário (São Paulo) e prazo exibido; nunca o e-mail da equipe.
create or replace function public.chat_public_settings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with agora as (select (now() at time zone 'America/Sao_Paulo') as t)
  select jsonb_build_object(
    'aberto_agora', coalesce(
      (a.t::time >= (s.hours -> extract(isodow from a.t)::int::text ->> 0)::time
       and a.t::time < (s.hours -> extract(isodow from a.t)::int::text ->> 1)::time), false),
    'prazo', s.response_time
  )
  from public.chat_settings s, agora a
  where s.id = 1;
$$;

-- 3i. chat_inbox: lista da caixa de entrada. SECURITY INVOKER: o RLS continua valendo (cliente
--     só vê as próprias conversas; nota interna não vaza pela busca no texto).
--     ponytail: a busca no texto avalia o RLS por mensagem (medida do revisor: ≈2 s com 5.000
--     conversas / 50.000 mensagens); trocar por índice de texto ou pg_trgm antes de chegar lá.
create or replace function public.chat_inbox(p_filtro text, p_busca text, p_limite int)
returns table (
  id uuid, user_id uuid, contact_id uuid, kind text, status text, priority text,
  assignee_id uuid, department_id uuid, department_name text, topic_label text, mediation boolean,
  contact_name text, contact_email text, contact_phone text,
  last_message_at timestamptz, last_message_preview text,
  last_customer_message_at timestamptz, last_reply_at timestamptz,
  agent_last_read_at timestamptz, customer_last_read_at timestamptz,
  nao_lida boolean, created_at timestamptz, resolved_at timestamptz, rating smallint
)
language plpgsql
stable
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_busca text := lower(trim(coalesce(p_busca, '')));
begin
  if coalesce(p_filtro, '') not in ('minhas', 'sem_dono', 'urgentes', 'mediacao', 'abertas', 'resolvidas') then
    raise exception 'Filtro inválido' using errcode = '22023';
  end if;
  return query
  select c.id, c.user_id, c.contact_id, c.kind, c.status, c.priority,
         c.assignee_id, c.department_id, d.name, t.label, coalesce(t.mediation, false),
         ct.name, ct.email, ct.phone,
         c.last_message_at, c.last_message_preview,
         c.last_customer_message_at, c.last_reply_at,
         c.agent_last_read_at, c.customer_last_read_at,
         coalesce(c.last_customer_message_at > coalesce(c.agent_last_read_at, '-infinity'), false),
         c.created_at, c.resolved_at, c.rating
  from public.conversations c
  left join public.chat_departments d on d.id = c.department_id
  left join public.chat_topics t on t.id = c.topic_id
  left join public.chat_contacts ct on ct.id = c.contact_id
  where case p_filtro
      when 'minhas' then c.status = 'open' and c.assignee_id = (select auth.uid())
      when 'sem_dono' then c.status = 'open' and c.assignee_id is null
      when 'urgentes' then c.status = 'open' and c.priority = 'urgent'
      when 'mediacao' then coalesce(t.mediation, false)
      when 'abertas' then c.status = 'open'
      else c.status = 'resolved'
    end
    and (v_busca = ''
      or position(v_busca in lower(coalesce(ct.name, ''))) > 0
      or position(v_busca in lower(coalesce(ct.email, ''))) > 0
      or position(v_busca in coalesce(ct.phone, '')) > 0
      or exists (
        select 1 from public.conversation_messages m
        where m.conversation_id = c.id and position(v_busca in lower(m.body)) > 0
      ))
  order by c.last_message_at desc
  limit least(greatest(coalesce(p_limite, 50), 1), 200);
end;
$$;

-- 3j. Gatilho: resumo da conversa a cada mensagem (nota interna não mexe: senão a prévia e a
--     "não lida" do cliente mostrariam a nota). Quem escreve conta como quem leu.
create or replace function public.chat_messages_after_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_internal then
    return null;
  end if;
  update public.conversations c set
    last_message_at = new.created_at,
    last_message_preview = left(case when new.body <> '' then new.body
                                     else 'Anexo: ' || coalesce(new.attachment_name, 'arquivo') end, 140),
    last_customer_message_at = case when new.sender_role = 'customer' then new.created_at else c.last_customer_message_at end,
    -- quem escreve leu a conversa até ali
    customer_last_read_at = case when new.sender_role = 'customer'
                                 then greatest(coalesce(c.customer_last_read_at, '-infinity'), new.created_at)
                                 else c.customer_last_read_at end,
    agent_last_read_at = case when new.sender_role in ('agent', 'producer')
                              then greatest(coalesce(c.agent_last_read_at, '-infinity'), new.created_at)
                              else c.agent_last_read_at end,
    last_reply_at = case when new.sender_role in ('agent', 'producer') then new.created_at else c.last_reply_at end,
    first_response_at = case when new.sender_role in ('agent', 'producer') and c.first_response_at is null
                             then new.created_at else c.first_response_at end,
    updated_at = now()
  where c.id = new.conversation_id;
  return null;
end;
$$;
drop trigger if exists chat_messages_after_insert on public.conversation_messages;
create trigger chat_messages_after_insert
  after insert on public.conversation_messages
  for each row execute function public.chat_messages_after_insert();

-- 3k. Só service_role (Edge Function chat-notify): o segredo do cron e a fila de avisos.
create or replace function public.chat_notify_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select d.decrypted_secret from vault.decrypted_secrets d where d.name = 'chat_notify_secret' limit 1;
$$;

-- Avisos devidos (até 50 de cada tipo, urgentes primeiro). O destino sai do banco, nunca do chamador:
--   cliente: e-mail da conta (auth.users, conta não excluída) quando há resposta humana (não
--            nota) com mais de 5 min, mais nova que o que ele leu e que o último e-mail.
--   equipe:  chat_settings.team_email quando o cliente escreveu depois da última leitura e do
--            último alerta: conversa nova (nunca alertada) ou urgente na hora; as demais depois
--            de 5 min sem leitura; no máximo 1 alerta por conversa a cada 30 min. A chat-notify
--            junta as linhas "equipe" num único e-mail-resumo por rodada.
--   Conversa com 5 falhas seguidas de envio (notify_failures) sai da fila, para não travar as outras.
-- Reserva contra envio duplicado (duas chamadas juntas ou segredo vazado): as linhas devolvidas
-- ficam travadas (for update skip locked) e reservadas por 2 min (notify_claimed_until) no mesmo
-- comando; chamada seguinte não as vê. A chat-notify marca o resultado por chat_notify_mark,
-- que solta a reserva; se a função cair antes, a reserva vence sozinha em 2 min.
create or replace function public.chat_notify_due()
returns table (
  tipo text, conversation_id uuid, email text, nome text, assunto text, urgente boolean, previa text
)
language sql
volatile
security definer
set search_path = ''
as $$
  with cli as (
    select 'cliente'::text as tipo, c.id, u.email::text as email,
           coalesce(ct.name, 'cliente') as nome, coalesce(t.label, 'Atendimento') as assunto,
           c.priority = 'urgent' as urgente, null::text as previa
    from public.conversations c
    join auth.users u on u.id = c.user_id
    left join public.chat_contacts ct on ct.id = c.contact_id
    left join public.chat_topics t on t.id = c.topic_id
    where c.last_reply_at < now() - interval '5 minutes'
      and c.last_reply_at > greatest(coalesce(c.customer_last_read_at, '-infinity'),
                                     coalesce(c.customer_emailed_at, '-infinity'))
      and u.email is not null
      and u.deleted_at is null
      and c.notify_failures < 5
      and (c.notify_claimed_until is null or c.notify_claimed_until < now())
    order by c.priority = 'urgent' desc, c.last_reply_at
    limit 50
    for update of c skip locked
  ),
  eq as (
    select 'equipe'::text as tipo, c.id, s.team_email as email,
           coalesce(ct.name, 'Sem nome') as nome, coalesce(t.label, 'Sem assunto') as assunto,
           c.priority = 'urgent' as urgente, c.last_message_preview as previa
    from public.conversations c
    join public.chat_settings s on s.id = 1
    left join public.chat_contacts ct on ct.id = c.contact_id
    left join public.chat_topics t on t.id = c.topic_id
    where c.status = 'open'
      and c.kind = 'evokaa'
      and c.last_customer_message_at > greatest(coalesce(c.agent_last_read_at, '-infinity'),
                                                coalesce(c.team_alerted_at, '-infinity'))
      and (c.team_alerted_at is null or c.team_alerted_at < now() - interval '30 minutes')
      and (c.team_alerted_at is null or c.priority = 'urgent'
           or c.last_customer_message_at < now() - interval '5 minutes')
      and c.notify_failures < 5
      and (c.notify_claimed_until is null or c.notify_claimed_until < now())
    order by c.priority = 'urgent' desc, c.last_customer_message_at
    limit 50
    for update of c skip locked
  ),
  reserva as (
    update public.conversations c
    set notify_claimed_until = now() + interval '2 minutes'
    where c.id in (select cli.id from cli union select eq.id from eq)
  )
  select cli.tipo, cli.id, cli.email, cli.nome, cli.assunto, cli.urgente, cli.previa from cli
  union all
  select eq.tipo, eq.id, eq.email, eq.nome, eq.assunto, eq.urgente, eq.previa from eq;
$$;

-- Resultado do envio: sucesso grava a data do tipo e zera as falhas; falha soma 1. Os dois soltam a reserva.
create or replace function public.chat_notify_mark(p_ids uuid[], p_tipo text, p_ok boolean)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n int;
begin
  if coalesce(p_tipo, '') not in ('cliente', 'equipe') or p_ok is null then
    raise exception 'Parâmetros inválidos' using errcode = '22023';
  end if;
  update public.conversations c set
    customer_emailed_at = case when p_ok and p_tipo = 'cliente' then now() else c.customer_emailed_at end,
    team_alerted_at = case when p_ok and p_tipo = 'equipe' then now() else c.team_alerted_at end,
    notify_failures = case when p_ok then 0 else c.notify_failures + 1 end,
    notify_claimed_until = null
  where c.id = any(p_ids);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- 3m. chat_orfaos_de (exclusão de conta, delete-account): arquivos do bucket que a pessoa
--     subiu e que nenhuma mensagem usa.
create or replace function public.chat_orfaos_de(p_user uuid)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'chat-anexos'
    and o.owner = p_user
    and not exists (select 1 from public.conversation_messages m where m.attachment_path = o.name);
$$;

-- 4. RLS: leitura só; nenhuma escrita direta (tudo pelas funções acima) -------
alter table public.chat_departments enable row level security;
alter table public.chat_topics enable row level security;
alter table public.chat_contacts enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.chat_settings enable row level security;

revoke all on public.chat_departments, public.chat_topics, public.chat_contacts,
  public.conversations, public.conversation_messages, public.chat_settings
  from anon, authenticated;
grant select on public.chat_departments, public.chat_topics, public.chat_contacts,
  public.conversations, public.conversation_messages, public.chat_settings
  to authenticated;

drop policy if exists chat_departments_select on public.chat_departments;
create policy chat_departments_select on public.chat_departments
  for select to authenticated
  using (active or (select public.gf_admin_can('manage_support')));

drop policy if exists chat_topics_select on public.chat_topics;
create policy chat_topics_select on public.chat_topics
  for select to authenticated
  using (active or (select public.gf_admin_can('manage_support')));

drop policy if exists chat_contacts_select on public.chat_contacts;
create policy chat_contacts_select on public.chat_contacts
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.gf_admin_can('manage_support')));

drop policy if exists conversations_select on public.conversations;
create policy conversations_select on public.conversations
  for select to authenticated
  using (public.chat_role(id) is not null);

-- agente vê tudo da conversa; produtor não vê nota que não seja de produtor; cliente não vê nota
drop policy if exists conversation_messages_select on public.conversation_messages;
create policy conversation_messages_select on public.conversation_messages
  for select to authenticated
  using (case public.chat_role(conversation_id)
           when 'agent' then true
           when 'producer' then not is_internal or sender_role = 'producer'
           when 'customer' then not is_internal
           else false
         end);

drop policy if exists chat_settings_select on public.chat_settings;
create policy chat_settings_select on public.chat_settings
  for select to authenticated
  using ((select public.gf_admin_can('manage_support')));

-- 5. Storage: bucket privado chat-anexos (10 MB; jpeg, png, webp, pdf) --------
--    Ler: quem tem vínculo com a conversa do caminho. Enviar: idem, com a conversa aberta e até
--    20 arquivos por conversa (chat_can_upload). bucket_id na regra: sem ele, ela valeria para
--    qualquer bucket futuro. Sem UPDATE/DELETE.
--    ponytail: arquivo enviado e nunca anexado fica no bucket (até 20 por conversa); a exclusão
--    de conta apaga os da pessoa; limpeza periódica se houver abuso.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-anexos', 'chat-anexos', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists chat_anexos_select on storage.objects;
create policy chat_anexos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'chat-anexos' and public.chat_role_path(name) is not null);

drop policy if exists chat_anexos_insert on storage.objects;
create policy chat_anexos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat-anexos' and public.chat_can_upload(name));

-- 6. Realtime (o Realtime respeita o RLS acima). O front assina só INSERT (mensagens) e
--    INSERT/UPDATE (conversas): DELETE não passa pelo filtro do RLS.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table public.conversations;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversation_messages'
  ) then
    alter publication supabase_realtime add table public.conversation_messages;
  end if;
end $$;

-- 7. Vault + cron: segredo aleatório criado uma vez; o comando do cron o lê do Vault na hora
--    de rodar (o segredo nunca fica escrito no comando). Função publicada com --no-verify-jwt.
do $$
begin
  if not exists (select 1 from vault.secrets s where s.name = 'chat_notify_secret') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'chat_notify_secret', 'Segredo do cron para a Edge Function chat-notify');
  end if;
end $$;

-- permissões que a doc da Supabase exige para o SQL Editor (role postgres) agendar jobs
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
select cron.unschedule('chat_notify') where exists (select 1 from cron.job where jobname = 'chat_notify');
select cron.schedule('chat_notify', '*/2 * * * *', $cron$
  select net.http_post(
    url := 'https://rwaezeqyuhxrssntcxdv.supabase.co/functions/v1/chat-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-chat-secret', (select d.decrypted_secret from vault.decrypted_secrets d where d.name = 'chat_notify_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
$cron$);

-- 7b. Limite conhecido, fila do pg_net: net.http_request_queue e net._http_response têm grant da
--     plataforma (supabase_admin) a PUBLIC, e o SQL Editor roda como postgres, que não consegue
--     revogar (conferido em produção em 29/09). O schema net não é exposto pela API por padrão, e
--     o x-chat-secret fica na fila menos de 0,5 s (até o pg_net enviar). Mitigação: a reserva em
--     chat_notify_due impede envio duplicado mesmo com o segredo vazado.

-- 8. Quem executa o quê (o Supabase dá EXECUTE a anon/authenticated por padrão) --
revoke all on function public.chat_role(uuid) from public, anon, authenticated, service_role;
grant execute on function public.chat_role(uuid) to authenticated;

revoke all on function public.chat_role_path(text) from public, anon, authenticated, service_role;
grant execute on function public.chat_role_path(text) to authenticated;

revoke all on function public.chat_can_upload(text) from public, anon, authenticated, service_role;
grant execute on function public.chat_can_upload(text) to authenticated;

revoke all on function public.chat_start(uuid, uuid, text, text, boolean, text) from public, anon, authenticated, service_role;
grant execute on function public.chat_start(uuid, uuid, text, text, boolean, text) to authenticated;

revoke all on function public.chat_send(uuid, text, boolean, text, text) from public, anon, authenticated, service_role;
grant execute on function public.chat_send(uuid, text, boolean, text, text) to authenticated;

revoke all on function public.chat_update(uuid, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.chat_update(uuid, jsonb) to authenticated;

revoke all on function public.chat_mark_read(uuid) from public, anon, authenticated, service_role;
grant execute on function public.chat_mark_read(uuid) to authenticated;

revoke all on function public.chat_rate(uuid, int) from public, anon, authenticated, service_role;
grant execute on function public.chat_rate(uuid, int) to authenticated;

revoke all on function public.chat_public_settings() from public, anon, authenticated, service_role;
grant execute on function public.chat_public_settings() to authenticated;

revoke all on function public.chat_inbox(text, text, int) from public, anon, authenticated, service_role;
grant execute on function public.chat_inbox(text, text, int) to authenticated;

revoke all on function public.chat_messages_after_insert() from public, anon, authenticated, service_role;

revoke all on function public.chat_notify_secret() from public, anon, authenticated, service_role;
grant execute on function public.chat_notify_secret() to service_role;

revoke all on function public.chat_notify_due() from public, anon, authenticated, service_role;
grant execute on function public.chat_notify_due() to service_role;

revoke all on function public.chat_notify_mark(uuid[], text, boolean) from public, anon, authenticated, service_role;
grant execute on function public.chat_notify_mark(uuid[], text, boolean) to service_role;

revoke all on function public.chat_orfaos_de(uuid) from public, anon, authenticated, service_role;
grant execute on function public.chat_orfaos_de(uuid) to service_role;

-- 9. Migração do chat antigo (support_*) — idempotente, reusa os ids --------------
--    Roda de novo depois do deploy do PR B (pega o que foi escrito no chat antigo entre os PRs).
--    closed → resolved; open/assigned → open; visitor → customer; agent → agent só se o
--    remetente é admin (senão customer); remetente ou atendente sem perfil → nulo; sessão sem
--    conta → conversa sem contato. Assunto: "Imprensa e outros assuntos" (site, setor Geral).
--    Nenhum aviso sobre o que já existia: a conversa nasce com leituras e avisos em now(). Na
--    2ª rodada, mensagem nova numa conversa já migrada fica "não lida" (e avisa a equipe).
insert into public.chat_contacts (user_id, name, email, origin)
select distinct on (p.id)
       p.id,
       case when char_length(trim(coalesce(p.full_name, ''))) >= 2 then left(trim(p.full_name), 120) else 'Sem nome' end,
       case when lower(u.email) ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then lower(u.email) end,
       'migracao'
from public.support_sessions s
join public.profiles p on p.id = s.user_id
left join auth.users u on u.id = p.id
on conflict (user_id) do nothing;

insert into public.conversations (
  id, contact_id, user_id, kind, topic_id, department_id, status, assignee_id,
  resolved_at, last_message_at, created_at, updated_at,
  customer_last_read_at, agent_last_read_at, customer_emailed_at, team_alerted_at
)
select s.id, ct.id, p.id, 'evokaa', t.id, t.department_id,
       case when s.status = 'closed' then 'resolved' else 'open' end,
       ag.id,
       case when s.status = 'closed' then coalesce(s.updated_at, s.created_at, now()) end,
       coalesce(s.created_at, now()), coalesce(s.created_at, now()), coalesce(s.updated_at, now()),
       now(), now(), now(), now()
from public.support_sessions s
left join public.profiles p on p.id = s.user_id
left join public.chat_contacts ct on ct.user_id = p.id
left join public.profiles ag on ag.id = s.assigned_agent_id
left join lateral (
  select tt.id, tt.department_id
  from public.chat_topics tt
  join public.chat_departments d on d.id = tt.department_id
  where tt.audience = 'site' and d.slug = 'geral'
  order by tt.position
  limit 1
) t on true
on conflict (id) do nothing;

insert into public.conversation_messages (id, conversation_id, sender_id, sender_role, sender_name, body, created_at)
select m.id, m.session_id, p.id,
       -- o chat antigo deixava o cliente gravar qualquer sender_type: "agent" só vale de admin
       case when m.sender_type = 'agent' and p.role = 'admin' then 'agent' else 'customer' end,
       left(coalesce(nullif(trim(m.sender_name), ''), 'Sem nome'), 120),
       left(coalesce(nullif(trim(m.content), ''), '(mensagem vazia)'), 4000),
       coalesce(m.created_at, now())
from public.support_messages m
join public.conversations c on c.id = m.session_id
left join public.profiles p on p.id = m.sender_id
order by m.created_at
on conflict (id) do nothing;

commit;

-- =============================================================================
-- TESTES (rodar à mão no SQL Editor: tire o "-- " do começo das linhas abaixo e rode tudo
-- de uma vez; o bloco inteiro está num begin … rollback e não deixa nada gravado).
-- Cria 6 contas de teste com ids fixos (a0000000-…-00000000000N); se o gatilho de cadastro
-- já criar o perfil, o upsert só ajusta papel e permissões. Cada teste termina com
-- "NOTICE: Tn OK"; falha = ERROR com o valor recebido.
-- Stubs usados no Postgres descartável (imagem supabase/postgres), fora do repositório:
-- extensões pg_cron/pg_net, auth.users.email_confirmed_at, auth.uid()/auth.jwt() de produção,
-- storage.buckets/objects, profiles/events/tickets/support_* e gf_is_admin/gf_admin_can.
-- =============================================================================
-- begin;
-- create function pg_temp.como(p uuid) returns void language plpgsql as $f$
-- begin
--   perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), true);
--   perform set_config('request.jwt.claims', case when p is null then '' else json_build_object('sub', p, 'role', 'authenticated')::text end, true);
--   perform set_config('role', case when p is null then 'postgres' else 'authenticated' end, true);
-- end $f$;
-- create function pg_temp.erro(q text) returns text language plpgsql as $f$
-- begin execute q; return 'ok'; exception when others then return sqlstate; end $f$;
-- -- fila sem as reservas das leituras anteriores (cada chamada de chat_notify_due reserva o que devolve)
-- create function pg_temp.fila() returns table (tipo text, conversation_id uuid, email text, nome text,
--   assunto text, urgente boolean, previa text) language sql as $f$
--   update public.conversations set notify_claimed_until = null where notify_claimed_until is not null;
--   select * from public.chat_notify_due();
-- $f$;
-- create function pg_temp.topico(p_aud text, p_label text) returns uuid language sql as $f$
--   select id from public.chat_topics where audience = p_aud and label = p_label $f$;
--
-- -- T0. Contas: A (user), B (customer), P (producer), AD (admin manage_support),
-- --     AX (admin sem a permissão), SU (super_admin)
-- insert into auth.users (id, email, email_confirmed_at) values
--   ('a0000000-0000-4000-8000-000000000001', 'Ana.Teste@teste.evokaa.invalid', now()),
--   ('a0000000-0000-4000-8000-000000000002', 'bruno@teste.evokaa.invalid', now()),
--   ('a0000000-0000-4000-8000-000000000003', 'produtor@teste.evokaa.invalid', now()),
--   ('a0000000-0000-4000-8000-000000000004', 'atendente@teste.evokaa.invalid', now()),
--   ('a0000000-0000-4000-8000-000000000005', 'semperm@teste.evokaa.invalid', now()),
--   ('a0000000-0000-4000-8000-000000000006', 'super@teste.evokaa.invalid', now());
-- insert into public.profiles (id, email, full_name, phone, role, admin_permissions) values
--   ('a0000000-0000-4000-8000-000000000001', 'ana.teste@teste.evokaa.invalid', 'Ana', null, 'user', '{}'),
--   ('a0000000-0000-4000-8000-000000000002', 'bruno@teste.evokaa.invalid', 'Bruno', '+5521988887777', 'customer', '{}'),
--   ('a0000000-0000-4000-8000-000000000003', 'produtor@teste.evokaa.invalid', 'Paula Produtora', null, 'producer', '{}'),
--   ('a0000000-0000-4000-8000-000000000004', 'atendente@teste.evokaa.invalid', 'Alice Atendente', null, 'admin', '{manage_support}'),
--   ('a0000000-0000-4000-8000-000000000005', 'semperm@teste.evokaa.invalid', 'Xavier', null, 'admin', '{manage_feedback}'),
--   ('a0000000-0000-4000-8000-000000000006', 'super@teste.evokaa.invalid', 'Sara Super', null, 'admin', '{super_admin}')
-- on conflict (id) do update set full_name = excluded.full_name, phone = excluded.phone,
--   role = excluded.role, admin_permissions = excluded.admin_permissions;
--
-- -- T1. Isolamento entre clientes
-- do $t$
-- declare r jsonb; a uuid := 'a0000000-0000-4000-8000-000000000001'; b uuid := 'a0000000-0000-4000-8000-000000000002';
-- begin
--   perform pg_temp.como(a);
--   r := public.chat_start(pg_temp.topico('participant_evokaa', 'Não recebi ou não acho meu ingresso'), null,
--                          'Ana Teste', '+55 (11) 91234-5678', true, 'Oi, preciso de ajuda com o ingresso');
--   assert (r->>'ok')::boolean, format('A start: %s', r);
--   perform set_config('teste.conv_a', r->>'id', true);
--   perform pg_temp.como(b);
--   r := public.chat_start(pg_temp.topico('site', 'Comprei um ingresso'), null, 'Bruno', '5521988887777', false, 'Mensagem do Bruno');
--   assert (r->>'ok')::boolean, format('B start: %s', r);
--   perform set_config('teste.conv_b', r->>'id', true);
--   perform pg_temp.como(a);
--   assert (select count(*) from public.conversations) = 1, 'A vê conversa de outro';
--   assert (select count(*) from public.conversation_messages where conversation_id = current_setting('teste.conv_b')::uuid) = 0, 'A vê mensagem de B';
--   assert (select count(*) from public.chat_contacts) = 1, 'A vê contato de outro';
--   assert pg_temp.erro(format('select public.chat_send(%L, %L, false, null, null)', current_setting('teste.conv_b'), 'invasão')) = '42501', 'A escreveu na conversa de B';
--   assert pg_temp.erro(format('select public.chat_mark_read(%L)', current_setting('teste.conv_b'))) = '42501', 'A marcou lida a de B';
--   assert (select count(*) from public.chat_inbox('abertas', null, 50)) = 1, 'chat_inbox de A mostra outra conversa';
--   perform pg_temp.como(null);
--   raise notice 'T1 OK: cliente só vê e escreve nas próprias conversas';
-- end $t$;
--
-- -- T2. Nota interna: cliente não vê; produtor não vê nota do admin; busca não vaza; prévia não muda
-- do $t$
-- declare r jsonb; a uuid := 'a0000000-0000-4000-8000-000000000001'; ad uuid := 'a0000000-0000-4000-8000-000000000004';
--   p uuid := 'a0000000-0000-4000-8000-000000000003'; b uuid := 'a0000000-0000-4000-8000-000000000002';
--   ca uuid := current_setting('teste.conv_a')::uuid; cp uuid; tm uuid;
-- begin
--   perform pg_temp.como(ad);
--   r := public.chat_send(ca, 'nota secreta xyz', true, null, null);
--   assert (r->>'ok')::boolean, format('nota: %s', r);
--   r := public.chat_send(ca, 'Resposta da equipe', false, null, null);
--   assert (r->>'ok')::boolean, format('resposta: %s', r);
--   r := public.chat_send(ca, 'outra nota secreta', true, null, null);
--   perform pg_temp.como(a);
--   assert (select count(*) from public.conversation_messages where conversation_id = ca and is_internal) = 0, 'cliente vê nota';
--   assert (select count(*) from public.conversation_messages where conversation_id = ca) = 2, 'cliente: contagem errada';
--   assert (select count(*) from public.chat_inbox('abertas', 'secreta', 50)) = 0, 'busca do cliente achou a nota';
--   assert (select count(*) from public.chat_inbox('abertas', 'resposta da', 50)) = 1, 'busca do cliente não achou a resposta';
--   assert (select last_message_preview from public.conversations where id = ca) = 'Resposta da equipe', 'nota mexeu na prévia';
--   assert (select first_response_at is not null and last_reply_at is not null from public.conversations where id = ca), 'gatilho não marcou a resposta';
--   perform pg_temp.como(ad);
--   assert (select count(*) from public.chat_inbox('abertas', 'secreta', 50)) = 1, 'busca do agente não achou a nota';
--   -- conversa com produtor (etapa 4), criada direto: sem mediação o admin não vê; com mediação vê tudo
--   perform pg_temp.como(null);
--   insert into public.conversations (user_id, kind, producer_id) values (b, 'producer', p) returning id into cp;
--   insert into public.conversation_messages (conversation_id, sender_id, sender_role, sender_name, body, is_internal) values
--     (cp, b, 'customer', 'Bruno', 'Pergunta ao produtor', false),
--     (cp, ad, 'agent', 'Alice', 'nota do admin', true),
--     (cp, p, 'producer', 'Paula', 'nota do produtor', true);
--   perform pg_temp.como(p);
--   assert (select count(*) from public.conversations where id = cp) = 1, 'produtor não vê a conversa dele';
--   assert (select count(*) from public.conversation_messages where conversation_id = cp) = 2, 'produtor: contagem errada';
--   assert not exists (select 1 from public.conversation_messages where conversation_id = cp and body = 'nota do admin'), 'produtor vê nota do admin';
--   assert (select count(*) from public.conversations where id = ca) = 0, 'produtor vê conversa da Evokaa';
--   perform pg_temp.como(b);
--   assert (select count(*) from public.conversation_messages where conversation_id = cp) = 1, 'cliente vê nota do produtor';
--   perform pg_temp.como(ad);
--   assert (select count(*) from public.conversations where id = cp) = 0, 'admin vê conversa de produtor sem mediação';
--   perform pg_temp.como(null);
--   insert into public.chat_topics (audience, label, mediation) values ('participant_producer', 'Teste mediação', true) returning id into tm;
--   update public.conversations set topic_id = tm where id = cp;
--   perform pg_temp.como(ad);
--   assert (select count(*) from public.conversation_messages where conversation_id = cp) = 3, 'admin na mediação não vê tudo';
--   perform pg_temp.como(null);
--   perform set_config('teste.conv_p', cp::text, true);
--   raise notice 'T2 OK: nota interna isolada (cliente, produtor, busca, prévia)';
-- end $t$;
--
-- -- T3. Admin sem manage_support é barrado; chat_update só com chaves e responsável válidos
-- do $t$
-- declare r jsonb; ax uuid := 'a0000000-0000-4000-8000-000000000005'; ad uuid := 'a0000000-0000-4000-8000-000000000004';
--   ca text := current_setting('teste.conv_a');
-- begin
--   perform pg_temp.como(ax);
--   assert (select count(*) from public.conversations) = 0, 'admin sem permissão vê conversa';
--   assert (select count(*) from public.chat_contacts) = 0, 'admin sem permissão vê contato';
--   assert pg_temp.erro(format('select public.chat_send(%L, %L, false, null, null)', ca, 'oi')) = '42501', 'admin sem permissão escreveu';
--   assert pg_temp.erro(format('select public.chat_update(%L, %L)', ca, '{"status":"resolved"}')) = '42501', 'admin sem permissão alterou';
--   perform pg_temp.como(ad);
--   assert pg_temp.erro(format('select public.chat_update(%L, %L)', ca, '{"rating":3}')) = '22023', 'chave desconhecida aceita';
--   assert pg_temp.erro(format('select public.chat_update(%L, %L)', ca, '{"assignee_id":"a0000000-0000-4000-8000-000000000001"}')) = '22023', 'cliente virou responsável';
--   assert pg_temp.erro(format('select public.chat_update(%L, %L)', ca, '{"assignee_id":"a0000000-0000-4000-8000-000000000005"}')) = '22023', 'admin sem permissão virou responsável';
--   assert pg_temp.erro(format('select public.chat_update(%L, %L)', ca, '{"status":"fechada"}')) = '22023', 'status inválido aceito';
--   r := public.chat_update(ca::uuid, jsonb_build_object('assignee_id', ad, 'priority', 'urgent'));
--   assert (r->>'ok')::boolean, format('update: %s', r);
--   assert (select count(*) from public.chat_inbox('minhas', null, 50)) = 1, 'filtro minhas';
--   assert (select count(*) from public.chat_inbox('urgentes', null, 50)) = 1, 'filtro urgentes';
--   assert pg_temp.erro('select * from public.chat_inbox(''qualquer'', null, 50)') = '22023', 'filtro inválido aceito';
--   r := public.chat_update(ca::uuid, '{"assignee_id":null,"priority":"normal"}');
--   assert (select assignee_id is null from public.conversations where id = ca::uuid), 'responsável não voltou a nulo';
--   perform pg_temp.como(null);
--   raise notice 'T3 OK: admin sem permissão barrado; chat_update valida chaves e responsável';
-- end $t$;
--
-- -- T4. Dono que também é admin grava "customer" e não manda nem vê nota
-- do $t$
-- declare r jsonb; ad uuid := 'a0000000-0000-4000-8000-000000000004'; su uuid := 'a0000000-0000-4000-8000-000000000006'; cd uuid;
-- begin
--   perform pg_temp.como(ad);
--   r := public.chat_start(pg_temp.topico('site', 'Problema no site ou na minha conta'), null, 'Alice', '5511912345678', false, 'Sou admin e cliente');
--   assert (r->>'ok')::boolean, format('admin start: %s', r);
--   cd := (r->>'id')::uuid;
--   assert (select sender_role from public.conversation_messages where conversation_id = cd) = 'customer', 'dono-admin não gravou customer';
--   assert pg_temp.erro(format('select public.chat_send(%L, %L, true, null, null)', cd, 'nota')) = '42501', 'dono-admin mandou nota';
--   perform pg_temp.como(su);
--   r := public.chat_send(cd, 'nota do super', true, null, null);
--   assert (select sender_role from public.conversation_messages where id = (r->>'id')::uuid) = 'agent', 'super_admin não gravou agent';
--   perform pg_temp.como(ad);
--   assert (select count(*) from public.conversation_messages where conversation_id = cd) = 1, 'dono-admin vê nota na própria conversa';
--   perform pg_temp.como(null);
--   raise notice 'T4 OK: dono-admin grava customer, não manda nem vê nota';
-- end $t$;
--
-- -- T5. Anexo: outra conversa, outro bucket, nota com anexo e tipo errado recusados; válido aceito
-- do $t$
-- declare r jsonb; a uuid := 'a0000000-0000-4000-8000-000000000001'; ad uuid := 'a0000000-0000-4000-8000-000000000004';
--   ca text := current_setting('teste.conv_a'); cb text := current_setting('teste.conv_b');
-- begin
--   insert into storage.buckets (id, name, public) values ('outro-bucket', 'outro-bucket', false) on conflict do nothing;
--   insert into storage.objects (bucket_id, name, owner, metadata) values
--     ('chat-anexos', ca || '/foto.png', a, '{"mimetype":"image/png","size":1234}'),
--     ('chat-anexos', ca || '/script.html', a, '{"mimetype":"text/html","size":10}'),
--     ('chat-anexos', cb || '/doc.pdf', a, '{"mimetype":"application/pdf","size":99}'),
--     ('outro-bucket', ca || '/fora.png', a, '{"mimetype":"image/png","size":5}');
--   perform pg_temp.como(a);
--   assert pg_temp.erro(format('select public.chat_send(%L, %L, false, %L, null)', ca, '', cb || '/doc.pdf')) = '22023', 'anexo de outra conversa aceito';
--   assert pg_temp.erro(format('select public.chat_send(%L, %L, false, %L, null)', ca, '', ca || '/fora.png')) = '22023', 'anexo de outro bucket aceito';
--   assert pg_temp.erro(format('select public.chat_send(%L, %L, false, %L, null)', ca, '', ca || '/script.html')) = '22023', 'tipo de anexo errado aceito';
--   assert pg_temp.erro(format('select public.chat_send(%L, %L, false, %L, null)', ca, '', ca || '/nao-existe.png')) = '22023', 'anexo inexistente aceito';
--   r := public.chat_send(ca::uuid, '', false, ca || '/foto.png', 'minha foto.png');
--   assert (r->>'ok')::boolean, format('anexo válido: %s', r);
--   assert (select attachment_mime = 'image/png' and attachment_size = 1234 and attachment_name = 'minha foto.png'
--           from public.conversation_messages where id = (r->>'id')::uuid), 'tipo/tamanho não vieram do Storage';
--   perform pg_temp.como(ad);
--   assert pg_temp.erro(format('select public.chat_send(%L, %L, true, %L, null)', ca, 'nota', ca || '/foto.png')) = '22023', 'nota com anexo aceita';
--   perform pg_temp.como(null);
--   raise notice 'T5 OK: anexo só da própria conversa, do bucket certo e de tipo aceito';
-- end $t$;
--
-- -- T6. Assunto de outro público, inativo, participant_producer e evento recusados
-- do $t$
-- declare r jsonb; a uuid := 'a0000000-0000-4000-8000-000000000001'; ad uuid := 'a0000000-0000-4000-8000-000000000004';
--   p uuid := 'a0000000-0000-4000-8000-000000000003'; tm uuid;
-- begin
--   perform pg_temp.como(a);
--   r := public.chat_start(pg_temp.topico('producer', 'Outros assuntos'), null, 'Ana', '5511912345678', false, 'x');
--   assert r->>'motivo' = 'assunto_invalido', format('user em assunto de produtor: %s', r);
--   r := public.chat_start(pg_temp.topico('participant_producer', 'Teste mediação'), null, 'Ana', '5511912345678', false, 'x');
--   assert r->>'motivo' = 'nao_disponivel', format('participant_producer: %s', r);
--   r := public.chat_start(pg_temp.topico('site', 'Comprei um ingresso'), gen_random_uuid(), 'Ana', '5511912345678', false, 'x');
--   assert r->>'motivo' = 'nao_disponivel', format('com evento: %s', r);
--   r := public.chat_start(gen_random_uuid(), null, 'Ana', '5511912345678', false, 'x');
--   assert r->>'motivo' = 'assunto_invalido', format('assunto inexistente: %s', r);
--   perform pg_temp.como(null);
--   tm := pg_temp.topico('site', 'Quero ser afiliado ou parceiro');
--   update public.chat_topics set active = false where id = tm;
--   perform pg_temp.como(a);
--   r := public.chat_start(tm, null, 'Ana', '5511912345678', false, 'x');
--   assert r->>'motivo' = 'assunto_invalido', format('assunto inativo: %s', r);
--   assert (select count(*) from public.chat_topics where label = 'Quero ser afiliado ou parceiro') = 0, 'cliente vê assunto inativo';
--   perform pg_temp.como(ad);
--   r := public.chat_start(pg_temp.topico('participant_evokaa', 'Outros assuntos'), null, 'Alice', '5511912345678', false, 'x');
--   assert r->>'motivo' = 'assunto_invalido', format('admin em assunto de participante: %s', r);
--   perform pg_temp.como(p);
--   r := public.chat_start(pg_temp.topico('participant_evokaa', 'Outros assuntos'), null, 'Paula', '5511912345678', false, 'x');
--   assert r->>'motivo' = 'assunto_invalido', format('produtor em assunto de participante: %s', r);
--   perform pg_temp.como(null);
--   update public.chat_topics set active = true where id = tm;
--   raise notice 'T6 OK: assunto só do público do papel + site; etapa 4 recusada';
-- end $t$;
--
-- -- T7. Papéis: customer → participant_evokaa; producer → producer (urgente do assunto)
-- do $t$
-- declare r jsonb; b uuid := 'a0000000-0000-4000-8000-000000000002'; p uuid := 'a0000000-0000-4000-8000-000000000003';
-- begin
--   perform pg_temp.como(b);
--   r := public.chat_start(pg_temp.topico('participant_evokaa', 'Minha conta e acesso'), null, 'Bruno', '5521988887777', false, 'Conta');
--   assert (r->>'ok')::boolean, format('customer em participant_evokaa: %s', r);
--   perform pg_temp.como(p);
--   r := public.chat_start(pg_temp.topico('producer', 'Dia do evento: check-in e portaria'), null, 'Paula', '5531977776666', false, 'Portaria parada!');
--   assert (r->>'ok')::boolean, format('producer em producer: %s', r);
--   assert (select priority = 'urgent' and department_id = (select id from public.chat_departments where slug = 'suporte_produtor')
--           from public.conversations where id = (r->>'id')::uuid), 'prioridade/setor do assunto';
--   perform pg_temp.como(null);
--   perform set_config('teste.conv_urg', r->>'id', true);
--   raise notice 'T7 OK: papel real define o público';
-- end $t$;
--
-- -- T8. E-mail vem de auth.users; telefone normalizado; profiles.phone só se vazio; validações
-- do $t$
-- declare a uuid := 'a0000000-0000-4000-8000-000000000001'; b uuid := 'a0000000-0000-4000-8000-000000000002';
--   t uuid := pg_temp.topico('site', 'Comprei um ingresso');
-- begin
--   assert (select email = 'ana.teste@teste.evokaa.invalid' and phone = '5511912345678' and marketing_opt_in
--           and marketing_opt_in_at is not null and origin = 'app' from public.chat_contacts where user_id = a), 'contato de A';
--   assert (select phone from public.profiles where id = a) = '+5511912345678', 'profiles.phone vazio não foi preenchido';
--   assert (select phone from public.profiles where id = b) = '+5521988887777', 'profiles.phone existente foi trocado';
--   assert (select origin from public.chat_contacts where user_id = b) = 'site', 'origem do contato de B';
--   perform pg_temp.como(a);
--   assert pg_temp.erro(format('select public.chat_start(%L, null, %L, %L, false, %L)', t, 'A', '5511912345678', 'x')) = '22023', 'nome curto';
--   assert pg_temp.erro(format('select public.chat_start(%L, null, %L, %L, false, %L)', t, 'Ana', '1234', 'x')) = '22023', 'telefone curto';
--   assert pg_temp.erro(format('select public.chat_start(%L, null, %L, %L, false, %L)', t, 'Ana', '11912345678', 'x')) = '22023', 'telefone sem 55';
--   assert pg_temp.erro(format('select public.chat_start(%L, null, %L, %L, false, %L)', t, 'Ana', '+1 415 555 0100', 'x')) = '22023', 'telefone estrangeiro';
--   assert pg_temp.erro(format('select public.chat_start(%L, null, %L, %L, false, %L)', t, 'Ana', '5511912345678', repeat('x', 4001))) = '22023', 'texto longo';
--   assert pg_temp.erro(format('select public.chat_start(%L, null, %L, %L, false, %L)', t, 'Ana', '5511912345678', '   ')) = '22023', 'texto vazio';
--   perform pg_temp.como(null);
--   raise notice 'T8 OK: e-mail da conta, telefone BR, validações no servidor';
-- end $t$;
--
-- -- T9. Avaliação única, só em resolvida; cliente escrevendo reabre e a nota fica
-- do $t$
-- declare r jsonb; a uuid := 'a0000000-0000-4000-8000-000000000001'; ad uuid := 'a0000000-0000-4000-8000-000000000004';
--   ca uuid := current_setting('teste.conv_a')::uuid;
-- begin
--   perform pg_temp.como(a);
--   r := public.chat_rate(ca, 3);
--   assert r->>'motivo' = 'nao_permitido', format('avaliou aberta: %s', r);
--   perform pg_temp.como(ad);
--   assert pg_temp.erro(format('select public.chat_rate(%L, 3)', ca)) = '42501', 'agente avaliou';
--   perform public.chat_update(ca, '{"status":"resolved"}');
--   perform pg_temp.como(a);
--   assert pg_temp.erro(format('select public.chat_rate(%L, 5)', ca)) = '22023', 'nota 5 aceita';
--   r := public.chat_rate(ca, 3);
--   assert (r->>'ok')::boolean, format('avaliar: %s', r);
--   r := public.chat_rate(ca, 1);
--   assert r->>'motivo' = 'nao_permitido', format('avaliou 2 vezes: %s', r);
--   r := public.chat_send(ca, 'Voltei, ainda tenho dúvida', false, null, null);
--   assert (select status = 'open' and resolved_at is null and rating = 3 from public.conversations where id = ca), 'não reabriu ou perdeu a nota';
--   perform pg_temp.como(null);
--   raise notice 'T9 OK: avaliação única; reabrir mantém a nota';
-- end $t$;
--
-- -- T10. chat_public_settings sem e-mail da equipe; chat_settings só para admin
-- do $t$
-- declare r jsonb; a uuid := 'a0000000-0000-4000-8000-000000000001'; ad uuid := 'a0000000-0000-4000-8000-000000000004';
-- begin
--   perform pg_temp.como(a);
--   r := public.chat_public_settings();
--   assert (select array_agg(k order by k) from jsonb_object_keys(r) k) = array['aberto_agora', 'prazo'], format('chaves: %s', r);
--   assert r::text not like '%@%', 'vazou e-mail';
--   assert (select count(*) from public.chat_settings) = 0, 'cliente lê chat_settings';
--   perform pg_temp.como(ad);
--   assert (select count(*) from public.chat_settings) = 1, 'admin não lê chat_settings';
--   perform pg_temp.como(null);
--   raise notice 'T10 OK: %', r;
-- end $t$;
--
-- -- T11. Limites: 3 abertas, 5 novas por hora, 20 mensagens por minuto
-- do $t$
-- declare r jsonb; b uuid := 'a0000000-0000-4000-8000-000000000002'; a uuid := 'a0000000-0000-4000-8000-000000000001';
--   t uuid := pg_temp.topico('site', 'Imprensa e outros assuntos'); i int; ca uuid := current_setting('teste.conv_a')::uuid;
-- begin
--   perform pg_temp.como(b);    -- B já tem 3 abertas, todas desta hora (T1, T2 com o produtor, T7)
--   assert (select count(*) from public.conversations where user_id = b and status = 'open') = 3, 'preparo';
--   r := public.chat_start(t, null, 'Bruno', '5521988887777', false, '4ª');
--   assert r->>'motivo' = 'limite_abertas', format('4ª aberta: %s', r);
--   perform pg_temp.como(null);
--   update public.conversations set status = 'resolved' where user_id = b;
--   perform pg_temp.como(b);
--   r := public.chat_start(t, null, 'Bruno', '5521988887777', false, '4ª na hora');
--   r := public.chat_start(t, null, 'Bruno', '5521988887777', false, '5ª na hora');
--   assert (r->>'ok')::boolean, format('5ª na hora: %s', r);
--   r := public.chat_start(t, null, 'Bruno', '5521988887777', false, '6ª na hora');
--   assert r->>'motivo' = 'limite_hora', format('6ª na hora: %s', r);
--   perform pg_temp.como(a);
--   for i in 1..25 loop
--     r := public.chat_send(ca, 'msg ' || i, false, null, null);
--     exit when not (r->>'ok')::boolean;
--   end loop;
--   assert r->>'motivo' = 'limite_minuto', format('limite por minuto: %s', r);
--   assert (select count(*) from public.conversation_messages where sender_id = a and created_at > now() - interval '1 minute') = 20, 'passou de 20';
--   perform pg_temp.como(null);
--   raise notice 'T11 OK: 3 abertas, 5 por hora, 20 por minuto';
-- end $t$;
--
-- -- T12. Storage: ler e enviar só na pasta da própria conversa e só no bucket chat-anexos
-- do $t$
-- declare a uuid := 'a0000000-0000-4000-8000-000000000001'; ca text := current_setting('teste.conv_a'); cb text := current_setting('teste.conv_b');
--   n int;
-- begin
--   perform pg_temp.como(a);
--   assert (select count(*) from storage.objects where bucket_id = 'chat-anexos' and name like cb || '/%') = 0, 'A vê arquivo de B';
--   assert (select count(*) from storage.objects where bucket_id = 'chat-anexos' and name like ca || '/%') = 2, 'A não vê os próprios arquivos';
--   assert (select count(*) from storage.objects where bucket_id = 'outro-bucket') = 0, 'regra vale para outro bucket';
--   assert pg_temp.erro(format('insert into storage.objects (bucket_id, name, owner) values (%L, %L, %L)', 'chat-anexos', cb || '/x.png', a)) = '42501', 'A enviou na pasta de B';
--   assert pg_temp.erro(format('insert into storage.objects (bucket_id, name, owner) values (%L, %L, %L)', 'outro-bucket', ca || '/x.png', a)) = '42501', 'A enviou em outro bucket';
--   assert pg_temp.erro(format('insert into storage.objects (bucket_id, name, owner) values (%L, %L, %L)', 'chat-anexos', 'nao-uuid/x.png', a)) = '42501', 'caminho fora do formato aceito';
--   assert pg_temp.erro(format('insert into storage.objects (bucket_id, name, owner) values (%L, %L, %L)', 'chat-anexos', ca || '/sub/x.png', a)) = '42501', 'subpasta aceita';
--   assert pg_temp.erro(format('insert into storage.objects (bucket_id, name, owner) values (%L, %L, %L)', 'chat-anexos', ca || '/novo.png', a)) = 'ok', 'A não enviou na própria pasta';
--   update storage.objects set name = cb || '/movido.png' where name = ca || '/novo.png';
--   get diagnostics n = row_count;
--   assert n = 0, 'UPDATE liberado';
--   delete from storage.objects where name = ca || '/novo.png';
--   get diagnostics n = row_count;
--   assert n = 0, 'DELETE liberado';
--   perform pg_temp.como(null);
--   raise notice 'T12 OK: Storage restrito à conversa e ao bucket; sem UPDATE/DELETE';
-- end $t$;
--
-- -- T13. Privilégios: chat_notify_* só service_role; anon sem nada; nenhuma escrita direta
-- do $t$
-- declare f regprocedure; tb text; a uuid := 'a0000000-0000-4000-8000-000000000001';
-- begin
--   for f in select p.oid::regprocedure from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'chat\_%' loop
--     assert not has_function_privilege('anon', f, 'execute'), format('anon executa %s', f);
--     if f::text like 'chat_notify%' or f::text like 'chat_orfaos_de%' then
--       assert not has_function_privilege('authenticated', f, 'execute') and has_function_privilege('service_role', f, 'execute'), format('%s', f);
--     end if;
--   end loop;
--   foreach tb in array array['chat_departments', 'chat_topics', 'chat_contacts', 'conversations', 'conversation_messages', 'chat_settings'] loop
--     assert not has_table_privilege('anon', 'public.' || tb, 'select'), format('anon lê %s', tb);
--     assert not has_table_privilege('authenticated', 'public.' || tb, 'insert,update,delete'), format('authenticated escreve em %s', tb);
--   end loop;
--   perform pg_temp.como(a);
--   assert pg_temp.erro('select * from public.chat_notify_due()') = '42501', 'cliente leu a fila de avisos';
--   assert pg_temp.erro('select public.chat_notify_secret()') = '42501', 'cliente leu o segredo';
--   assert pg_temp.erro('update public.conversations set rating = 1') = '42501', 'update direto liberado';
--   perform pg_temp.como(null);
--   assert (select count(*) from cron.job where jobname = 'chat_notify' and command not like '%' || (select decrypted_secret from vault.decrypted_secrets where name = 'chat_notify_secret') || '%') = 1, 'segredo escrito no cron';
--   raise notice 'T13 OK: privilégios mínimos; segredo fora do comando do cron';
-- end $t$;
--
-- -- T14. Regras de chat_notify_due
-- do $t$
-- declare ca uuid := current_setting('teste.conv_a')::uuid; cu uuid := current_setting('teste.conv_urg')::uuid;
--   cp uuid := current_setting('teste.conv_p')::uuid;
-- begin
--   -- conversa nova (nunca alertada) aparece para a equipe; conversa de produtor não
--   update public.conversations set agent_last_read_at = null, team_alerted_at = null where id = ca;
--   assert exists (select 1 from pg_temp.fila() where tipo = 'equipe' and conversation_id = ca), 'nova sem alerta';
--   assert not exists (select 1 from pg_temp.fila() where conversation_id = cp and tipo = 'equipe'), 'conversa de produtor alertou a equipe';
--   assert (select email from pg_temp.fila() where tipo = 'equipe' and conversation_id = ca) = 'contato@evokaa.com.br', 'destino da equipe';
--   -- alertada há 10 min: nada (30 min); há 31 min com mensagem de 1 min: só urgente
--   update public.conversations set team_alerted_at = now() - interval '10 minutes', last_customer_message_at = now(),
--     agent_last_read_at = null where id in (ca, cu);
--   assert not exists (select 1 from pg_temp.fila() where tipo = 'equipe' and conversation_id in (ca, cu)), 'alertou antes de 30 min';
--   update public.conversations set team_alerted_at = now() - interval '31 minutes',
--     last_customer_message_at = now() - interval '1 minute' where id in (ca, cu);
--   update public.conversations set priority = 'normal' where id = ca;
--   assert exists (select 1 from pg_temp.fila() where tipo = 'equipe' and conversation_id = cu and urgente), 'urgente não alertou';
--   assert not exists (select 1 from pg_temp.fila() where tipo = 'equipe' and conversation_id = ca), 'normal alertou antes de 5 min';
--   update public.conversations set last_customer_message_at = now() - interval '6 minutes' where id = ca;
--   assert exists (select 1 from pg_temp.fila() where tipo = 'equipe' and conversation_id = ca), 'normal não alertou depois de 5 min';
--   update public.conversations set agent_last_read_at = now() where id = ca;
--   assert not exists (select 1 from pg_temp.fila() where tipo = 'equipe' and conversation_id = ca), 'alertou conversa lida';
--   -- cliente: resposta de 6 min, não lida, não avisada → e-mail da conta
--   update public.conversations set last_reply_at = now() - interval '6 minutes', customer_last_read_at = null, customer_emailed_at = null where id = ca;
--   assert (select email from pg_temp.fila() where tipo = 'cliente' and conversation_id = ca) = 'Ana.Teste@teste.evokaa.invalid', 'e-mail do cliente';
--   assert (select previa from pg_temp.fila() where tipo = 'cliente' and conversation_id = ca) is null, 'e-mail ao cliente leva texto';
--   update public.conversations set last_reply_at = now() - interval '2 minutes' where id = ca;
--   assert not exists (select 1 from pg_temp.fila() where tipo = 'cliente' and conversation_id = ca), 'avisou antes de 5 min';
--   update public.conversations set last_reply_at = now() - interval '6 minutes', customer_emailed_at = now() - interval '1 minute' where id = ca;
--   assert not exists (select 1 from pg_temp.fila() where tipo = 'cliente' and conversation_id = ca), 'avisou 2 vezes';
--   update public.conversations set customer_emailed_at = null, customer_last_read_at = now() where id = ca;
--   assert not exists (select 1 from pg_temp.fila() where tipo = 'cliente' and conversation_id = ca), 'avisou resposta lida';
--   -- migrada sem mensagem nova depois da migração não aparece
--   assert not exists (select 1 from pg_temp.fila() d
--                      join public.support_sessions s on s.id = d.conversation_id
--                      join public.conversations c on c.id = d.conversation_id
--                      where not exists (select 1 from public.conversation_messages m
--                                        where m.conversation_id = c.id and m.created_at > c.team_alerted_at)), 'migrada gerou aviso';
--   assert (select count(*) from pg_temp.fila() where tipo = 'equipe') <= 50, 'mais de 50';
--   raise notice 'T14 OK: regras de aviso ao cliente e à equipe';
-- end $t$;
--
-- -- T15. Migração (depois de o arquivo rodar 2 vezes): tudo copiado uma vez, com os mapeamentos
-- do $t$
-- begin
--   assert (select count(*) from public.conversations c join public.support_sessions s on s.id = c.id) = (select count(*) from public.support_sessions), 'sessões';
--   assert (select count(*) from public.conversation_messages m join public.support_messages s on s.id = m.id) = (select count(*) from public.support_messages), 'mensagens';
--   assert not exists (select 1 from public.conversations c join public.support_sessions s on s.id = c.id
--                      where c.status <> case when s.status = 'closed' then 'resolved' else 'open' end), 'status';
--   assert not exists (select 1 from public.conversation_messages m join public.support_messages s on s.id = m.id
--                      where m.sender_role <> case when s.sender_type = 'agent'
--                                                   and exists (select 1 from public.profiles p where p.id = s.sender_id and p.role = 'admin')
--                                                  then 'agent' else 'customer' end
--                         or m.sender_id is distinct from (select p.id from public.profiles p where p.id = s.sender_id)), 'remetente';
--   assert not exists (select 1 from public.conversations c join public.support_sessions s on s.id = c.id
--                      where (s.user_id is null) <> (c.contact_id is null)
--                         or c.department_id is distinct from (select id from public.chat_departments where slug = 'geral')), 'contato/setor';
--   raise notice 'T15 OK: % conversas e % mensagens migradas; % "agent" forjado(s) gravado(s) como customer',
--     (select count(*) from public.conversations c join public.support_sessions s on s.id = c.id),
--     (select count(*) from public.conversation_messages m join public.support_messages s on s.id = m.id),
--     (select count(*) from public.conversation_messages m join public.support_messages s on s.id = m.id
--      where s.sender_type = 'agent' and m.sender_role = 'customer');
-- end $t$;
--
-- -- T16. Gatilho: quem escreve leu (as duas ordens: cliente → equipe e equipe → cliente)
-- do $t$
-- declare a uuid := 'a0000000-0000-4000-8000-000000000001'; ad uuid := 'a0000000-0000-4000-8000-000000000004';
--   cv uuid; t0 timestamptz := now() - interval '10 minutes'; c public.conversations;
-- begin
--   insert into public.conversations (user_id, kind) values (a, 'evokaa') returning id into cv;
--   insert into public.conversation_messages (conversation_id, sender_id, sender_role, sender_name, body, created_at)
--   values (cv, a, 'customer', 'Ana', 'pergunta', t0);
--   insert into public.conversation_messages (conversation_id, sender_id, sender_role, sender_name, body, created_at)
--   values (cv, ad, 'agent', 'Alice', 'resposta', t0 + interval '1 minute');
--   select * into c from public.conversations where id = cv;
--   assert c.customer_last_read_at = t0 and c.agent_last_read_at = t0 + interval '1 minute', format('ordem 1: %s', c);
--   assert not exists (select 1 from pg_temp.fila() where tipo = 'equipe' and conversation_id = cv), 'equipe respondeu e ainda alerta';
--   assert exists (select 1 from pg_temp.fila() where tipo = 'cliente' and conversation_id = cv), 'resposta não lida não avisa o cliente';
--   insert into public.conversation_messages (conversation_id, sender_id, sender_role, sender_name, body, created_at)
--   values (cv, a, 'customer', 'Ana', 'réplica', t0 + interval '2 minutes');
--   select * into c from public.conversations where id = cv;
--   assert c.customer_last_read_at = t0 + interval '2 minutes', format('ordem 2: %s', c);
--   assert not exists (select 1 from pg_temp.fila() where tipo = 'cliente' and conversation_id = cv), 'cliente escreveu depois e ainda recebe e-mail';
--   assert exists (select 1 from pg_temp.fila() where tipo = 'equipe' and conversation_id = cv), 'réplica do cliente não alerta a equipe';
--   -- mensagem com data anterior não faz a leitura voltar
--   insert into public.conversation_messages (conversation_id, sender_id, sender_role, sender_name, body, created_at)
--   values (cv, ad, 'agent', 'Alice', 'atrasada', t0);
--   assert (select agent_last_read_at from public.conversations where id = cv) = t0 + interval '1 minute', 'leitura voltou no tempo';
--   delete from public.conversations where id = cv;
--   raise notice 'T16 OK: quem escreve conta como quem leu, nas duas ordens';
-- end $t$;
--
-- -- T17. Reabrir pelo chat_send respeita o máximo de 3 abertas
-- do $t$
-- declare r jsonb; b uuid := 'a0000000-0000-4000-8000-000000000002';
-- begin
--   perform pg_temp.como(b);    -- B: 2 abertas (T11); conv_b e a do produtor (T2) resolvidas
--   assert (select count(*) from public.conversations where user_id = b and status = 'open') = 2, 'preparo';
--   r := public.chat_send(current_setting('teste.conv_b')::uuid, 'reabrindo', false, null, null);
--   assert (r->>'ok')::boolean, format('3ª reaberta: %s', r);
--   r := public.chat_send(current_setting('teste.conv_p')::uuid, 'reabrindo outra', false, null, null);
--   assert r->>'motivo' = 'limite_abertas', format('4ª reaberta: %s', r);
--   assert (select status from public.conversations where id = current_setting('teste.conv_p')::uuid) = 'resolved', 'reabriu mesmo assim';
--   perform pg_temp.como(null);
--   raise notice 'T17 OK: reabrir conta no limite de 3 abertas';
-- end $t$;
--
-- -- T19. Envio ao bucket: só em conversa aberta e até 20 arquivos por conversa; órfãos da pessoa
-- do $t$
-- declare a uuid := 'a0000000-0000-4000-8000-000000000001'; ca text := current_setting('teste.conv_a'); i int;
-- begin
--   update public.conversations set status = 'resolved' where id = ca::uuid;
--   perform pg_temp.como(a);
--   assert pg_temp.erro(format('insert into storage.objects (bucket_id, name, owner) values (%L, %L, %L)', 'chat-anexos', ca || '/r.png', a)) = '42501', 'enviou em conversa resolvida';
--   perform pg_temp.como(null);
--   update public.conversations set status = 'open' where id = ca::uuid;
--   perform pg_temp.como(a);
--   assert pg_temp.erro(format('insert into storage.objects (bucket_id, name, owner) values (%L, %L, %L)', 'chat-anexos', ca || '/ok2.png', a)) = 'ok', 'não enviou em conversa aberta';
--   perform pg_temp.como(null);
--   for i in (select count(*) from storage.objects where bucket_id = 'chat-anexos' and name like ca || '/%') + 1 .. 20 loop
--     insert into storage.objects (bucket_id, name, owner) values ('chat-anexos', ca || '/enchendo-' || i || '.png', a);
--   end loop;
--   assert (select count(*) from storage.objects where bucket_id = 'chat-anexos' and name like ca || '/%') = 20, 'preparo';
--   perform pg_temp.como(a);
--   assert pg_temp.erro(format('insert into storage.objects (bucket_id, name, owner) values (%L, %L, %L)', 'chat-anexos', ca || '/21.png', a)) = '42501', 'passou de 20 arquivos';
--   perform pg_temp.como(null);
--   assert exists (select 1 from public.chat_orfaos_de(a) o where o = ca || '/script.html'), 'arquivo não anexado fora da lista';
--   assert not exists (select 1 from public.chat_orfaos_de(a) o where o = ca || '/foto.png'), 'arquivo anexado entrou como órfão';
--   raise notice 'T19 OK: envio só em conversa aberta, até 20 por conversa; órfãos listados';
-- end $t$;
--
-- -- T20. Fila de avisos: conta excluída e 5 falhas seguidas saem; chat_notify_mark
-- do $t$
-- declare a uuid := 'a0000000-0000-4000-8000-000000000001'; ca uuid := current_setting('teste.conv_a')::uuid; n int;
-- begin
--   update public.conversations set last_reply_at = now() - interval '6 minutes', customer_last_read_at = null,
--     customer_emailed_at = null, notify_failures = 0 where id = ca;
--   assert exists (select 1 from pg_temp.fila() where tipo = 'cliente' and conversation_id = ca), 'preparo';
--   update auth.users set deleted_at = now() where id = a;
--   assert not exists (select 1 from pg_temp.fila() where tipo = 'cliente' and conversation_id = ca), 'avisou conta excluída';
--   update auth.users set deleted_at = null where id = a;
--   update public.conversations set notify_failures = 4 where id = ca;
--   n := public.chat_notify_mark(array[ca], 'cliente', false);
--   assert n = 1 and (select notify_failures from public.conversations where id = ca) = 5, 'falha não somou';
--   assert not exists (select 1 from pg_temp.fila() where conversation_id = ca), 'conversa com 5 falhas continua na fila';
--   n := public.chat_notify_mark(array[ca], 'cliente', true);
--   assert (select notify_failures = 0 and customer_emailed_at = now() and team_alerted_at is distinct from now()
--           from public.conversations where id = ca), 'sucesso não zerou nem gravou só a data do tipo';
--   assert pg_temp.erro(format('select public.chat_notify_mark(array[%L]::uuid[], %L, true)', ca, 'outro')) = '22023', 'tipo inválido aceito';
--   raise notice 'T20 OK: fila sem conta excluída nem conversa travada; chat_notify_mark';
-- end $t$;
--
-- -- T21. Migração, 2ª rodada: mensagem nova no chat antigo depois da 1ª rodada fica não lida e
-- --      avisa a equipe (no Postgres descartável, entra uma mensagem entre a 1ª e a 2ª execução;
-- --      em produção, antes do deploy do PR B, pode não haver caso e o teste só avisa)
-- do $t$
-- declare cv uuid;
-- begin
--   select c.id into cv
--   from public.conversations c join public.support_sessions s on s.id = c.id
--   where c.status = 'open' and c.last_customer_message_at > c.team_alerted_at
--   limit 1;
--   if cv is null then
--     raise notice 'T21 sem caso (nenhuma mensagem nova no chat antigo depois da 1ª rodada)';
--     return;
--   end if;
--   assert (select last_customer_message_at > agent_last_read_at from public.conversations where id = cv), 'ficou como lida';
--   assert not exists (select 1 from pg_temp.fila() where conversation_id = cv), 'alertou antes de 30 min da migração';
--   -- simula 31 minutos passados: todas as datas da conversa andam juntas para trás
--   update public.conversations set team_alerted_at = team_alerted_at - interval '31 minutes',
--     agent_last_read_at = agent_last_read_at - interval '31 minutes',
--     customer_last_read_at = customer_last_read_at - interval '31 minutes',
--     last_customer_message_at = last_customer_message_at - interval '31 minutes' where id = cv;
--   assert exists (select 1 from pg_temp.fila() where tipo = 'equipe' and conversation_id = cv), 'não entrou na fila';
--   raise notice 'T21 OK: mensagem da 2ª rodada fica não lida e entra no chat_notify_due';
-- end $t$;
--
-- -- T22. Reserva: 2ª leitura seguida não devolve as mesmas linhas; vencida a reserva, voltam;
-- --      chat_notify_mark solta a reserva
-- do $t$
-- declare a uuid := 'a0000000-0000-4000-8000-000000000001'; cv uuid; ids1 uuid[]; ids2 uuid[]; ids3 uuid[];
-- begin
--   insert into public.conversations (user_id, kind, last_customer_message_at) values (a, 'evokaa', now()) returning id into cv;
--   update public.conversations set notify_claimed_until = null;
--   select array_agg(conversation_id) into ids1 from public.chat_notify_due();
--   assert cv = any(ids1), 'preparo: conversa nova fora da fila';
--   select coalesce(array_agg(conversation_id), '{}') into ids2 from public.chat_notify_due();
--   assert not (ids2 && ids1), format('2ª leitura devolveu linha reservada: %s', ids2);
--   assert (select notify_claimed_until = now() + interval '2 minutes' from public.conversations where id = cv), 'reserva de 2 min';
--   update public.conversations set notify_claimed_until = notify_claimed_until - interval '3 minutes' where id = any(ids1);
--   select coalesce(array_agg(conversation_id), '{}') into ids3 from public.chat_notify_due();
--   assert cv = any(ids3), 'reserva vencida não voltou à fila';
--   perform public.chat_notify_mark(array[cv], 'equipe', false);
--   assert (select notify_claimed_until is null and notify_failures = 1 from public.conversations where id = cv), 'mark não soltou a reserva';
--   raise notice 'T22 OK: reserva de 2 min contra envio duplicado; mark solta';
-- end $t$;
-- rollback;
