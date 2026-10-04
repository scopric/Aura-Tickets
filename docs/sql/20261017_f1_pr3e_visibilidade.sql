-- =============================================================================
-- F1 PR3e-1: base da visibilidade do evento ("Pública" e "Só com link"; Senha e Convidados vêm nos PR3e-2/3).
-- Hoje events.visibility existe mas nenhuma regra olha a coluna: um evento "privado" seria lido por qualquer pessoa.
-- 1) public.evento_acesso(uuid): função central. dono -> 'aberto'; evento fora de published+approved -> null;
--    public -> 'aberto'; unlisted -> 'link'; password -> 'senha'; private -> 'convidados'.
--    (as tabelas evento_liberado e evento_convidados ainda NÃO existem: neste PR password devolve sempre 'senha' e private
--    sempre 'convidados'; o PR3e-2/3 reescrevem a função com create or replace.)
-- 2) public.pode_comprar(order, tipo): refaz os joins da regra de order_items aceitando 'aberto' e 'link'.
-- 3) public.evento_publico(text): a página do evento lê por aqui (nunca lista). Texto no formato de uuid busca SÓ por id;
--    o resto busca SÓ por slug exato e só abre evento 'public' (Só com link, Senha e Convidados só abrem pelo uuid,
--    porque o slug sai do título + data e dá para chutar). O "Copiar link" do painel usa /event/<id> fora de 'public'.
--    + CHECK events_slug_nao_uuid: slug nunca no formato de uuid (impede gravar como slug o uuid de outro evento).
--    Produção conferida em 05/10/2026: 0 slugs nesse formato, 0 nulos.
--    'aberto'/'link' -> {acesso, evento, ingressos}; 'senha' -> {acesso, cartao}; 'convidados' e null -> null.
-- 4) Regras trocadas (nomes exatos lidos do banco de produção em 05/10/2026):
--    events "Eventos públicos ou do produtor" (+ visibility='public') e nova "Eventos com senha ou de convidados liberados";
--    ticket_types "Ingressos à venda de evento aprovado" (is_active + evento_acesso='aberto');
--    orders "Usuários criam próprias compras" (+ evento_acesso aberto/link);
--    order_items "Usuários inserem itens da própria compra" (pode_comprar); favoritos_insert; evento_contagem_publica.
--    "Só com link" nunca entra na RLS: ?visibility=eq.unlisted devolve vazio; só evento_publico abre.
-- Como aplicar: ANTES de mesclar o PR (o front novo chama evento_publico). Colar inteiro no SQL Editor (UTF-8 via pbcopy,
-- NUNCA pelo TextEdit). Uma transação, idempotente.
-- Desfazer (só depois de voltar o front antigo), nesta ordem:
--   drop policy "Eventos com senha ou de convidados liberados" on public.events;
--   create or replace a política "Eventos públicos ou do produtor" sem o "and visibility = 'public'";
--   recriar "Ingressos à venda de evento aprovado" (is_active and exists events published+approved, to anon, authenticated);
--   recriar "Usuários criam próprias compras" (check (auth.uid() = user_id) and status = 'pending');
--   recriar "Usuários inserem itens da própria compra" com o texto antigo (join orders/ticket_types/events);
--   recriar favoritos_insert (exists events published+approved) e evento_contagem_publica (visibility <> 'private');
--   alter table public.events drop constraint if exists events_slug_nao_uuid;
--   drop function public.evento_publico(text), public.pode_comprar(uuid, uuid), public.evento_acesso(uuid);
-- =============================================================================
begin;

-- 1) Função central -----------------------------------------------------------------------------------------------
create or replace function public.evento_acesso(p_event uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when e.producer_id = auth.uid() then 'aberto'
    when e.status <> 'published' or e.approval_status <> 'approved' then null
    when e.visibility = 'public' then 'aberto'
    when e.visibility = 'unlisted' then 'link'
    when e.visibility = 'password' then 'senha'
    when e.visibility = 'private' then 'convidados'
  end
  from public.events e
  where e.id = p_event;
$$;
revoke all on function public.evento_acesso(uuid) from public, anon, authenticated;
grant execute on function public.evento_acesso(uuid) to anon, authenticated; -- as regras de anon a chamam

-- 2) Compra: o item só entra se o evento está aberto ou por link --------------------------------------------------
create or replace function public.pode_comprar(p_order uuid, p_ticket_type uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.orders o
    join public.ticket_types tt on tt.id = p_ticket_type and tt.event_id = o.event_id
    join public.events e on e.id = o.event_id
    where o.id = p_order and o.user_id = auth.uid() and o.status = 'pending'
      and tt.is_active and e.status = 'published' and e.approval_status = 'approved'
      and public.evento_acesso(o.event_id) in ('aberto', 'link')
  );
$$;
revoke all on function public.pode_comprar(uuid, uuid) from public, anon, authenticated;
grant execute on function public.pode_comprar(uuid, uuid) to authenticated;

-- 3) Leitura da página --------------------------------------------------------------------------------------------
create or replace function public.evento_publico(p_ref text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_id uuid;
  v_acesso text;
begin
  -- uuid busca SÓ por id; o resto, SÓ por slug e só de evento público (slug de "Só com link" é chutável: título + data)
  if p_ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select e.id into v_id from public.events e where e.id = p_ref::uuid;
  else
    select e.id into v_id from public.events e where e.slug = p_ref and e.visibility = 'public';
  end if;
  if v_id is null then return null; end if;

  v_acesso := public.evento_acesso(v_id);
  if v_acesso in ('aberto', 'link') then
    return jsonb_build_object(
      'acesso', v_acesso,
      'evento', (select to_jsonb(e) from public.events e where e.id = v_id),
      'ingressos', coalesce((
        select jsonb_agg(to_jsonb(t) order by t.sort_order nulls last, t.created_at)
        from public.ticket_types t where t.event_id = v_id and t.is_active), '[]'::jsonb));
  elsif v_acesso = 'senha' then
    return jsonb_build_object('acesso', v_acesso, 'cartao', (
      select jsonb_build_object('id', e.id, 'slug', e.slug, 'title', e.title, 'cover_image', e.cover_image,
        'image_url', e.image_url, 'date', e.date, 'venue_city', e.venue_city)
      from public.events e where e.id = v_id));
  end if;
  return null;
end $$;
revoke all on function public.evento_publico(text) from public, anon, authenticated;
grant execute on function public.evento_publico(text) to anon, authenticated;

-- 3b) Slug nunca no formato de uuid: senão um produtor gravaria como slug o uuid de outro evento e sequestraria o link
alter table public.events drop constraint if exists events_slug_nao_uuid;
alter table public.events add constraint events_slug_nao_uuid
  check (slug is null or slug !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

-- 4) Regras -------------------------------------------------------------------------------------------------------
drop policy if exists "Eventos públicos ou do produtor" on public.events;
create policy "Eventos públicos ou do produtor" on public.events as permissive for select to public
  using (((status = 'published') and (approval_status = 'approved') and (visibility = 'public'))
         or ((select auth.uid()) = producer_id));

drop policy if exists "Eventos com senha ou de convidados liberados" on public.events;
create policy "Eventos com senha ou de convidados liberados" on public.events as permissive for select to public
  using (visibility in ('password', 'private') and public.evento_acesso(id) = 'aberto');

drop policy if exists "Ingressos à venda de evento aprovado" on public.ticket_types;
create policy "Ingressos à venda de evento aprovado" on public.ticket_types as permissive for select to anon, authenticated
  using (is_active and public.evento_acesso(event_id) = 'aberto');

drop policy if exists "Usuários criam próprias compras" on public.orders;
create policy "Usuários criam próprias compras" on public.orders as permissive for insert to authenticated
  with check ((auth.uid() = user_id) and (status = 'pending') and public.evento_acesso(event_id) in ('aberto', 'link'));

drop policy if exists "Usuários inserem itens da própria compra" on public.order_items;
create policy "Usuários inserem itens da própria compra" on public.order_items as permissive for insert to authenticated
  with check ((quantity > 0) and public.pode_comprar(order_id, ticket_type_id));

drop policy if exists favoritos_insert on public.favoritos;
create policy favoritos_insert on public.favoritos as permissive for insert to authenticated
  with check (((select auth.uid()) = user_id)
    and exists (select 1 from public.events e where e.id = favoritos.event_id and e.status = 'published' and e.approval_status = 'approved')
    and public.evento_acesso(event_id) = 'aberto');

create or replace function public.evento_contagem_publica(p_event_id uuid) returns integer
language sql stable security definer set search_path to '' as $function$
  select (select count(*)::integer from public.tickets t
          where t.event_id = e.id and t.status in ('active', 'used'))
  from public.events e
  where e.id = p_event_id
    and e.status = 'published' and e.approval_status = 'approved'
    and public.evento_acesso(e.id) in ('aberto', 'link')
    and e.mostrar_contagem;
$function$;

commit;
