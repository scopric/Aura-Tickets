-- =============================================================================
-- Chat estilo Intercom (etapa 1a) — nome de quem atende — 2026-10-02
-- Aplicar à mão no SQL Editor do Supabase, DEPOIS de 20261001_chat.sql (já em produção; não editar
-- aquele arquivo). NÃO vai para supabase/migrations (Decisão 02). Idempotente: pode rodar de novo.
-- Pedido do Ricardo: "se tiver uma equipe, quem assumir a conversa tem que aparecer com o nome".
--   - conversations.assignee_name: primeiro nome do responsável, gravado só pelo servidor (o cliente
--     lê pela RLS de conversations, que já vale; não dá para ler profiles de outra pessoa).
--   - chat_update grava assignee_name junto com assignee_id.
--   - chat_send: 1ª resposta de atendente (não nota interna) em conversa sem dono atribui a quem respondeu.
-- As duas funções são cópias integrais das de 20261001_chat.sql; só os trechos marcados "NOVO" mudam.
-- =============================================================================
begin;

alter table public.conversations add column if not exists assignee_name text check (char_length(assignee_name) <= 60);

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

  -- NOVO (20261002): 1ª resposta de atendente numa conversa sem dono atribui a ela (nota interna não)
  if v_role = 'agent' and not v_internal then
    update public.conversations c
    set assignee_id = v_uid,
        assignee_name = (select left(nullif(split_part(trim(p.full_name), ' ', 1), ''), 60) from public.profiles p where p.id = v_uid)
    where c.id = p_conv and c.assignee_id is null;
  end if;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

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
    -- NOVO (20261002): primeiro nome do novo dono (nulo = sem dono)
    assignee_name = case when p_patch ? 'assignee_id'
      then (select left(nullif(split_part(trim(p.full_name), ' ', 1), ''), 60) from public.profiles p where p.id = v_assignee)
      else c.assignee_name end,
    priority = case when p_patch ? 'priority' then p_patch ->> 'priority' else c.priority end,
    department_id = case when p_patch ? 'department_id' then v_dept else c.department_id end,
    updated_at = now()
  where c.id = p_conv;

  return jsonb_build_object('ok', true);
end;
$$;

-- Preenche as conversas que já têm dono
update public.conversations c
set assignee_name = (select left(nullif(split_part(trim(p.full_name), ' ', 1), ''), 60) from public.profiles p where p.id = c.assignee_id)
where c.assignee_id is not null and c.assignee_name is null;

-- create or replace mantém os privilégios; reafirmados aqui como no arquivo de origem
revoke all on function public.chat_send(uuid, text, boolean, text, text) from public, anon, authenticated, service_role;
grant execute on function public.chat_send(uuid, text, boolean, text, text) to authenticated;
revoke all on function public.chat_update(uuid, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.chat_update(uuid, jsonb) to authenticated;

commit;

-- =============================================================================
-- Testes (rodar num banco descartável, depois de 20261001_chat.sql e deste arquivo). Nada fica gravado.
-- =============================================================================
/*
begin;
create function pg_temp.como(p uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), true);
  perform set_config('request.jwt.claims', case when p is null then '' else json_build_object('sub', p, 'role', 'authenticated')::text end, true);
  perform set_config('role', case when p is null then 'postgres' else 'authenticated' end, true);
end $f$;
create function pg_temp.erro(q text) returns text language plpgsql as $f$
begin execute q; return 'ok'; exception when others then return sqlstate; end $f$;
insert into auth.users (id, email) values
  ('e0000000-0000-4000-8000-000000000001', 'cliente@teste.evokaa.invalid'),
  ('e0000000-0000-4000-8000-000000000002', 'ana@teste.evokaa.invalid'),
  ('e0000000-0000-4000-8000-000000000003', 'bia@teste.evokaa.invalid');
insert into public.profiles (id, email, full_name, role, admin_permissions) values
  ('e0000000-0000-4000-8000-000000000001', 'cliente@teste.evokaa.invalid', 'Carlos Cliente', 'user', '{}'),
  ('e0000000-0000-4000-8000-000000000002', 'ana@teste.evokaa.invalid', 'Ana Maria Souza', 'admin', '{manage_support}'),
  ('e0000000-0000-4000-8000-000000000003', 'bia@teste.evokaa.invalid', 'Bia Lima', 'admin', '{super_admin}');

do $t$
declare
  r jsonb; conv uuid; conv2 uuid;
  cli uuid := 'e0000000-0000-4000-8000-000000000001';
  ana uuid := 'e0000000-0000-4000-8000-000000000002';
  bia uuid := 'e0000000-0000-4000-8000-000000000003';
  topico uuid := (select id from public.chat_topics where audience = 'participant_evokaa' order by position limit 1);
begin
  perform pg_temp.como(cli);
  r := public.chat_start(topico, null, 'Carlos', '5511987654321', false, 'Primeira conversa');
  conv := (r->>'id')::uuid;
  r := public.chat_start(topico, null, 'Carlos', '5511987654321', false, 'Segunda conversa');
  conv2 := (r->>'id')::uuid;

  -- A1. assumir grava o nome; trocar de dono troca o nome; nulo limpa
  perform pg_temp.como(ana);
  perform public.chat_update(conv, jsonb_build_object('assignee_id', ana));
  assert (select assignee_name from public.conversations where id = conv) = 'Ana', 'A1: assumir não gravou o nome';
  perform public.chat_update(conv, jsonb_build_object('assignee_id', bia));
  assert (select assignee_name from public.conversations where id = conv) = 'Bia', 'A1: trocar de dono não trocou o nome';
  perform public.chat_update(conv, '{"assignee_id": null}'::jsonb);
  assert (select assignee_id is null and assignee_name is null from public.conversations where id = conv), 'A1: nulo não limpou';
  perform public.chat_update(conv, '{"priority": "urgent"}'::jsonb);
  assert (select assignee_name is null from public.conversations where id = conv), 'A1: outra chave mexeu no nome';
  raise notice 'A1 OK: assumir grava o nome, trocar troca, nulo limpa';

  -- A2. nota interna não atribui; 1ª resposta de atendente em conversa sem dono atribui
  perform public.chat_send(conv2, 'nota', true, null, null);
  assert (select assignee_id is null from public.conversations where id = conv2), 'A2: nota interna atribuiu';
  perform public.chat_send(conv2, 'Olá, sou a Ana', false, null, null);
  assert (select assignee_id = ana and assignee_name = 'Ana' from public.conversations where id = conv2), 'A2: resposta não atribuiu';
  -- A3. conversa com dono não muda de dono quando outra pessoa responde
  perform pg_temp.como(bia);
  perform public.chat_send(conv2, 'Complemento da Bia', false, null, null);
  assert (select assignee_id = ana from public.conversations where id = conv2), 'A3: resposta de outra atendente trocou o dono';
  raise notice 'A2/A3 OK: resposta atribui só conversa sem dono; nota não atribui';

  -- A4. cliente lê assignee_name da própria conversa; cliente escrevendo não atribui
  perform pg_temp.como(cli);
  perform public.chat_send(conv, 'Cliente escrevendo', false, null, null);
  assert (select assignee_id is null from public.conversations where id = conv), 'A4: mensagem do cliente atribuiu';
  assert (select assignee_name from public.conversations where id = conv2) = 'Ana', 'A4: cliente não lê o nome';
  assert pg_temp.erro(format('select public.chat_update(%L, %L)', conv2, '{"assignee_id": null}')) = '42501', 'A4: cliente mudou o dono';
  perform pg_temp.como(null);
  raise notice 'A4 OK: cliente lê o nome da própria conversa, não atribui e não muda o dono';
end $t$;
rollback;
*/
