-- PR 5 do plano de segurança: entrada pública só pela função e limites no banco (01/10/2026).
-- Contato e inscrição na newsletter deixam de gravar direto como visitante (regras "with check (true)"): a
-- gravação passa a ser só pela Edge Function send-email (service role, depois do limite por IP e da validação).
-- Mais CHECKs de valores não negativos, de endereço de imagem e de tamanho de texto.
--
-- ORDEM DE APLICAÇÃO (obrigatória):
--   Se este SQL rodar antes da `send-email` nova, o formulário de contato e a inscrição do rodapé PARAM: o site
--   antigo grava direto na tabela e a regra que deixava gravar some. Por isso:
--   0. ANTES de publicar: baixar a `send-email` que está no ar (`get_edge_function` pelo MCP ou
--      `supabase functions download send-email`) e comparar com a do `main` (invariante 10). Se diferir, parar: a
--      produção tem mudança fora do repositório e publicar este PR a apagaria.
--   1. Publicar a `send-email` deste PR, da raiz do repositório (supabase/functions/send-email + _shared).
--   2. Conferir a publicada INTEIRA: baixar de novo e fazer diff contra supabase/functions/send-email/index.ts e
--      _shared/validar.ts deste ramo. Tem de dar zero diferença (grep de uma palavra não basta).
--   Se o PR for mesclado ANTES de publicar a função: o rodapé responde "Payload inválido" na inscrição da
--   newsletter e o contato só chega por e-mail (não grava no admin, a função antiga não grava), até publicar.
--   3. Mesclar o PR (front novo na Vercel: contato e rodapé só chamam a função). Entre o passo 1 e este, o
--      front antigo grava o contato direto E a função nova grava de novo: mensagem duplicada no admin, só nessa
--      janela. Fazer 1 e 3 em seguida.
--   4. Rodar as consultas ANTES abaixo (só leitura). Todas têm de dar 0. Se alguma der mais que 0, NÃO aplicar:
--      mandar o resultado para corrigir os dados primeiro (o bloco de conferência do começo abortaria mesmo
--      assim, sem gravar nada).
--   5. Colar este arquivo inteiro no SQL Editor (uma transação: se qualquer conferência falhar, nada é gravado).
-- Idempotente (pode rodar de novo).
--
-- ANTES (só leitura, rodar no SQL Editor de produção e conferir que tudo dá 0):
--   select 'ticket_types' as tabela, count(*) from public.ticket_types
--     where price < 0 or capacity < 0 or quantity_total < 0 or sold < 0 or quantity_sold < 0
--        or min_per_order < 1 or max_per_order < 1
--   union all select 'orders', count(*) from public.orders
--     where subtotal < 0 or discount < 0 or service_fee < 0 or processing_fee < 0 or total < 0
--   union all select 'order_items', count(*) from public.order_items where quantity < 1 or unit_price < 0 or subtotal < 0
--   union all select 'event_photos', count(*) from public.event_photos where url !~ '^(https://|/[^/])'
--   union all select 'event_banners', count(*) from public.event_banners where image_url !~ '^(https://|/[^/])'
--   union all select 'feedback', count(*) from public.feedback
--     where length(page) > 2048 or length(user_agent) > 1024 or length(admin_notes) > 5000;
--
-- DECISÕES
-- 1. Regras removidas: contact_messages.gf_contact_insert e newsletter_subscribers."Qualquer pessoa pode se
--    inscrever" (as duas "to public", with check (true)). Também sai o INSERT de anon nessas duas tabelas, para
--    que uma regra aberta criada por engano no futuro não reabra a gravação direta. Admin segue gravando e lendo
--    pelas regras próprias (gf_contact_messages_admin_all, "Apenas admins gerenciam subscribers").
-- 2. Limite por IP: a função conta contato e newsletter juntos na contact_rate_limit_hits (5 a cada 10 min).
--    Sem coluna nova: separar só se um canal começar a atrapalhar o outro. A chave é o IP (IPv4) ou o prefixo
--    /64 (IPv6). A tabela é limpa por um job do pg_cron (limpar_contact_rate_limit_hits, de hora em hora: apaga o
--    que tem mais de 1 dia), no padrão do limpar_access_logs.
-- 3. Valores: >= 0 em preço, capacidade, quantidades vendidas e totais; quantidade de item e mínimo por pedido
--    >= 1. Cupons NÃO entram: já têm coupons_value_chk (desconto > 0 e percentual <= 100) e coupons_limites_chk
--    (usos, mínimo do pedido, desconto máximo) no baseline.
-- 4. Imagem de galeria (event_photos.url) e de banner (event_banners.image_url, pode ser nula): só https:// ou
--    caminho do próprio site (/...). "//outro-site" (relativo ao protocolo) fica de fora de propósito: carregaria
--    de outro domínio. As telas do produtor já exigem https:// (EventGallery, EventBanners).
-- 5. Tamanho: feedback.message já tem limite de 2000 na regra gf_feedback_insert (não duplicado aqui); entram
--    page (2048, igual a user_activities.path), user_agent (1024) e admin_notes (5000). user_activities já tem
--    CHECK de path, session_id, metadata e event_type no baseline: nada novo.
-- 6. As regras de admin da newsletter (newsletters."Apenas admins leem e gerenciam campanhas" e
--    newsletter_subscribers."Apenas admins gerenciam subscribers") conferiam profiles.role = 'admin' direto: sem a
--    permissão manage_newsletter (a mesma da rota /admin/newsletter e do disparo na send-email) e sem passar pelo
--    2FA do admin (gf_mfa_ok). Passam a usar gf_admin_can('manage_newsletter') (super_admin também passa), só para
--    authenticated. Efeito colateral: admin sem manage_newsletter deixa de ver o contador "Inscritos na
--    newsletter" do painel (o card mostra erro), como já acontece com as outras áreas restritas.
begin;

-- Conferência dos dados: aborta com a contagem antes de criar qualquer CHECK.
do $$
declare n_tt int; n_o int; n_oi int; n_ph int; n_bn int; n_fb int;
begin
  select count(*) into n_tt from public.ticket_types
    where price < 0 or capacity < 0 or quantity_total < 0 or sold < 0 or quantity_sold < 0
       or min_per_order < 1 or max_per_order < 1;
  select count(*) into n_o from public.orders
    where subtotal < 0 or discount < 0 or service_fee < 0 or processing_fee < 0 or total < 0;
  select count(*) into n_oi from public.order_items where quantity < 1 or unit_price < 0 or subtotal < 0;
  select count(*) into n_ph from public.event_photos where url !~ '^(https://|/[^/])';
  select count(*) into n_bn from public.event_banners where image_url !~ '^(https://|/[^/])';
  select count(*) into n_fb from public.feedback
    where length(page) > 2048 or length(user_agent) > 1024 or length(admin_notes) > 5000;
  if n_tt + n_o + n_oi + n_ph + n_bn + n_fb > 0 then
    raise exception 'dados violariam os CHECKs: ticket_types=%, orders=%, order_items=%, event_photos=%, event_banners=%, feedback=%',
      n_tt, n_o, n_oi, n_ph, n_bn, n_fb;
  end if;
end;
$$;

-- 1. Contato e newsletter só pela função
drop policy if exists gf_contact_insert on public.contact_messages;
drop policy if exists "Qualquer pessoa pode se inscrever" on public.newsletter_subscribers;
revoke insert on public.contact_messages, public.newsletter_subscribers from anon;

-- Admin da newsletter passa pela permissão e pelo 2FA (decisão 6)
drop policy if exists "Apenas admins leem e gerenciam campanhas" on public.newsletters;
create policy "Apenas admins leem e gerenciam campanhas" on public.newsletters as permissive for all to authenticated
  using ((select public.gf_admin_can('manage_newsletter')))
  with check ((select public.gf_admin_can('manage_newsletter')));
drop policy if exists "Apenas admins gerenciam subscribers" on public.newsletter_subscribers;
create policy "Apenas admins gerenciam subscribers" on public.newsletter_subscribers as permissive for all to authenticated
  using ((select public.gf_admin_can('manage_newsletter')))
  with check ((select public.gf_admin_can('manage_newsletter')));

-- 3. Valores não negativos
alter table public.ticket_types drop constraint if exists ticket_types_valores_chk;
alter table public.ticket_types add constraint ticket_types_valores_chk check (
  price >= 0 and capacity >= 0 and quantity_total >= 0 and sold >= 0 and quantity_sold >= 0
  and min_per_order >= 1 and max_per_order >= 1);
alter table public.orders drop constraint if exists orders_valores_chk;
alter table public.orders add constraint orders_valores_chk check (
  subtotal >= 0 and discount >= 0 and service_fee >= 0 and processing_fee >= 0 and total >= 0);
alter table public.order_items drop constraint if exists order_items_valores_chk;
alter table public.order_items add constraint order_items_valores_chk check (
  quantity >= 1 and unit_price >= 0 and subtotal >= 0);

-- 4. Endereço de imagem
alter table public.event_photos drop constraint if exists event_photos_url_chk;
alter table public.event_photos add constraint event_photos_url_chk check (url ~ '^(https://|/[^/])');
alter table public.event_banners drop constraint if exists event_banners_image_url_chk;
alter table public.event_banners add constraint event_banners_image_url_chk check (image_url ~ '^(https://|/[^/])');

-- 5. Tamanho de texto
alter table public.feedback drop constraint if exists feedback_tamanhos_chk;
alter table public.feedback add constraint feedback_tamanhos_chk check (
  length(page) <= 2048 and length(user_agent) <= 1024 and length(admin_notes) <= 5000);

-- 6. Limpeza da tabela do limite por IP (só as últimas 10 min contam; 1 dia de folga para investigar abuso)
create extension if not exists pg_cron;
select cron.unschedule('limpar_contact_rate_limit_hits')
  where exists (select 1 from cron.job where jobname = 'limpar_contact_rate_limit_hits');
select cron.schedule('limpar_contact_rate_limit_hits', '23 * * * *',
  $$delete from public.contact_rate_limit_hits where created_at < now() - interval '1 day'$$);

-- Conferência obrigatória: se algo faltar, nada deste arquivo é gravado.
do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public'
             and ((tablename = 'contact_messages' and policyname = 'gf_contact_insert')
                  or (tablename = 'newsletter_subscribers' and policyname = 'Qualquer pessoa pode se inscrever'))) then
    raise exception 'regra de INSERT aberta ainda existe';
  end if;
  if has_table_privilege('anon', 'public.contact_messages', 'insert')
     or has_table_privilege('anon', 'public.newsletter_subscribers', 'insert') then
    raise exception 'anon ainda tem INSERT em contact_messages/newsletter_subscribers';
  end if;
  -- nenhuma regra que valha para visitante pode deixar gravar nessas tabelas
  if exists (select 1 from pg_policies where schemaname = 'public'
             and tablename in ('contact_messages', 'newsletter_subscribers')
             and cmd in ('INSERT', 'ALL') and roles && array['public', 'anon']::name[]
             and coalesce(with_check, qual) = 'true') then
    raise exception 'há regra aberta (true) de gravação em contact_messages/newsletter_subscribers';
  end if;
  -- admin da newsletter só por gf_admin_can (permissão + 2FA), nunca por role = 'admin' direto
  if exists (select 1 from pg_policies where schemaname = 'public'
             and tablename in ('newsletters', 'newsletter_subscribers')
             and (coalesce(qual, '') ~ 'role\s*=\s*''admin''' or coalesce(with_check, '') ~ 'role\s*=\s*''admin''')) then
    raise exception 'regra de newsletters/newsletter_subscribers ainda confere role = admin direto';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public'
        and ((tablename = 'newsletters' and policyname = 'Apenas admins leem e gerenciam campanhas')
             or (tablename = 'newsletter_subscribers' and policyname = 'Apenas admins gerenciam subscribers'))
        and roles = array['authenticated']::name[]
        and qual ~ 'gf_admin_can\(''manage_newsletter''' and with_check ~ 'gf_admin_can\(''manage_newsletter''') <> 2 then
    raise exception 'regras de admin da newsletter não usam gf_admin_can(manage_newsletter)';
  end if;
  if (select count(*) from pg_constraint where conname in ('ticket_types_valores_chk', 'orders_valores_chk',
        'order_items_valores_chk', 'event_photos_url_chk', 'event_banners_image_url_chk', 'feedback_tamanhos_chk')
        and convalidated) <> 6 then
    raise exception 'falta CHECK (ou não validado)';
  end if;
  if not exists (select 1 from cron.job where jobname = 'limpar_contact_rate_limit_hits') then
    raise exception 'job limpar_contact_rate_limit_hits não agendado';
  end if;
end;
$$;

commit;

-- Desfazer:
-- begin;
-- select cron.unschedule('limpar_contact_rate_limit_hits')
--   where exists (select 1 from cron.job where jobname = 'limpar_contact_rate_limit_hits');
-- alter table public.ticket_types drop constraint if exists ticket_types_valores_chk;
-- alter table public.orders drop constraint if exists orders_valores_chk;
-- alter table public.order_items drop constraint if exists order_items_valores_chk;
-- alter table public.event_photos drop constraint if exists event_photos_url_chk;
-- alter table public.event_banners drop constraint if exists event_banners_image_url_chk;
-- alter table public.feedback drop constraint if exists feedback_tamanhos_chk;
-- grant insert on public.contact_messages, public.newsletter_subscribers to anon;
-- create policy gf_contact_insert on public.contact_messages as permissive for insert to public with check (true);
-- create policy "Qualquer pessoa pode se inscrever" on public.newsletter_subscribers as permissive for insert to public
--   with check (true);
-- drop policy if exists "Apenas admins leem e gerenciam campanhas" on public.newsletters;
-- create policy "Apenas admins leem e gerenciam campanhas" on public.newsletters as permissive for all to public
--   using ((exists (select 1 from public.profiles
--     where ((profiles.id = (select auth.uid() as uid)) and (profiles.role = 'admin'::text)))));
-- drop policy if exists "Apenas admins gerenciam subscribers" on public.newsletter_subscribers;
-- create policy "Apenas admins gerenciam subscribers" on public.newsletter_subscribers as permissive for all to public
--   using ((exists (select 1 from public.profiles
--     where ((profiles.id = (select auth.uid() as uid)) and (profiles.role = 'admin'::text)))));
-- commit;
-- (Só desfazer as regras junto com a volta da send-email e do front antigos: a função nova grava por conta própria
-- e não precisa delas.)

-- =============================================================================
-- TESTES (rodar à mão num banco local ou descartável, NUNCA em produção: tire o "-- " do começo das linhas
-- abaixo e rode tudo de uma vez; está num begin … rollback e não deixa nada gravado). Cada teste termina com
-- "NOTICE: Tn OK"; falha = ERROR com o que deu errado. pg_temp.como() troca o papel da sessão E as claims do
-- JWT, como o PostgREST.
-- =============================================================================
-- begin;
-- create function pg_temp.como(p_role text, p uuid default null, p_aal text default 'aal1') returns void language plpgsql as $f$
-- begin
--   perform set_config('request.jwt.claims', case when p_role = 'postgres' then '' else json_strip_nulls(json_build_object(
--     'role', p_role, 'sub', p, 'aal', case when p is not null then p_aal end))::text end, true);
--   perform set_config('role', p_role, true);
-- end $f$;
-- create function pg_temp.erro(q text) returns text language plpgsql as $f$
-- begin execute q; return 'ok'; exception when others then return sqlstate || ' ' || sqlerrm; end $f$;
-- grant execute on function pg_temp.como(text, uuid, text), pg_temp.erro(text) to anon, authenticated, service_role;
--
-- -- T0. Dados: produtor, evento, tipo de ingresso, pedido.
-- insert into auth.users (id, email, raw_user_meta_data) values
--   ('5e500000-0000-4000-8000-000000000001', 'produtor@teste-seg5.evokaa.invalid', '{"role":"producer"}');
-- insert into public.events (id, producer_id, title, slug, status, approval_status) values
--   ('5e500000-0000-4000-8000-000000000101', '5e500000-0000-4000-8000-000000000001', 'Seg5', 'seg5-a', 'draft', 'pending');
-- insert into public.ticket_types (id, event_id, name, price) values
--   ('5e500000-0000-4000-8000-000000000201', '5e500000-0000-4000-8000-000000000101', 'Geral', 10);
-- insert into public.orders (id, user_id, event_id, total) values
--   ('5e500000-0000-4000-8000-000000000301', '5e500000-0000-4000-8000-000000000001', '5e500000-0000-4000-8000-000000000101', 10);
--
-- -- T1. Visitante não grava contato nem newsletter; a função (service_role) grava.
-- do $t$ begin
--   perform pg_temp.como('anon');
--   assert pg_temp.erro($q$insert into public.contact_messages (name, email, message) values ('a', 'a@b.co', 'oi')$q$) like '42501%', 'anon ainda grava contato';
--   assert pg_temp.erro($q$insert into public.newsletter_subscribers (email) values ('a@b.co')$q$) like '42501%', 'anon ainda grava newsletter';
--   perform pg_temp.como('authenticated', '5e500000-0000-4000-8000-000000000001');
--   assert pg_temp.erro($q$insert into public.contact_messages (name, email, message) values ('a', 'a@b.co', 'oi')$q$) like '42501%', 'logado comum grava contato';
--   assert pg_temp.erro($q$insert into public.newsletter_subscribers (email) values ('a@b.co')$q$) like '42501%', 'logado comum grava newsletter';
--   perform pg_temp.como('service_role');
--   assert pg_temp.erro($q$insert into public.contact_messages (name, email, message) values ('a', 'a@b.co', 'oi')$q$) = 'ok', 'service_role não grava contato';
--   assert pg_temp.erro($q$insert into public.newsletter_subscribers (email) values ('seg5@b.co')$q$) = 'ok', 'service_role não grava newsletter';
--   -- a função trata 23505 como sucesso: e-mail repetido (mesma caixa ou não) cai no índice único
--   assert pg_temp.erro($q$insert into public.newsletter_subscribers (email) values ('SEG5@b.co')$q$) like '23505%', 'duplicata em outra caixa passou';
--   assert pg_temp.erro($q$insert into public.contact_rate_limit_hits (ip) values ('203.0.113.9')$q$) = 'ok', 'service_role não registra hit';
--   perform pg_temp.como('postgres');
--   raise notice 'T1 OK: contato e newsletter só pela função';
-- end $t$;
--
-- -- T2. Valores negativos barrados; zero e positivos passam (como postgres: testa o CHECK, não a RLS).
-- do $t$ begin
--   assert pg_temp.erro($q$update public.ticket_types set price = -1 where id = '5e500000-0000-4000-8000-000000000201'$q$) like '23514%', 'preço negativo';
--   assert pg_temp.erro($q$update public.ticket_types set quantity_total = -1 where id = '5e500000-0000-4000-8000-000000000201'$q$) like '23514%', 'quantidade negativa';
--   assert pg_temp.erro($q$update public.ticket_types set min_per_order = 0 where id = '5e500000-0000-4000-8000-000000000201'$q$) like '23514%', 'mínimo 0';
--   assert pg_temp.erro($q$update public.ticket_types set price = 0, capacity = null, max_per_order = null where id = '5e500000-0000-4000-8000-000000000201'$q$) = 'ok', 'ingresso grátis sem limite barrado';
--   assert pg_temp.erro($q$update public.orders set total = -0.01 where id = '5e500000-0000-4000-8000-000000000301'$q$) like '23514%', 'total negativo';
--   assert pg_temp.erro($q$update public.orders set discount = -5 where id = '5e500000-0000-4000-8000-000000000301'$q$) like '23514%', 'desconto negativo';
--   assert pg_temp.erro($q$insert into public.order_items (order_id, ticket_type_id, quantity, unit_price) values ('5e500000-0000-4000-8000-000000000301', '5e500000-0000-4000-8000-000000000201', 0, 10)$q$) like '23514%', 'item com quantidade 0';
--   assert pg_temp.erro($q$insert into public.order_items (order_id, ticket_type_id, quantity, unit_price) values ('5e500000-0000-4000-8000-000000000301', '5e500000-0000-4000-8000-000000000201', 1, -10)$q$) like '23514%', 'preço unitário negativo';
--   assert pg_temp.erro($q$insert into public.order_items (order_id, ticket_type_id, quantity, unit_price) values ('5e500000-0000-4000-8000-000000000301', '5e500000-0000-4000-8000-000000000201', 2, 0)$q$) = 'ok', 'item grátis barrado';
--   raise notice 'T2 OK: valores negativos barrados';
-- end $t$;
--
-- -- T3. Imagem só https:// ou /caminho; banner sem imagem continua valendo.
-- do $t$ declare u text; begin
--   foreach u in array array['https://cdn.exemplo.com/a.jpg', '/images/a.jpg'] loop
--     assert pg_temp.erro(format($q$insert into public.event_photos (producer_id, url) values ('5e500000-0000-4000-8000-000000000001', %L)$q$, u)) = 'ok', 'foto boa barrada: ' || u;
--     assert pg_temp.erro(format($q$insert into public.event_banners (producer_id, name, image_url) values ('5e500000-0000-4000-8000-000000000001', 'b', %L)$q$, u)) = 'ok', 'banner bom barrado: ' || u;
--   end loop;
--   foreach u in array array['javascript:alert(1)', 'http://x.com/a.jpg', '//evil.com/a.jpg', 'data:image/png;base64,AA', ' https://x.com/a.jpg', ''] loop
--     assert pg_temp.erro(format($q$insert into public.event_photos (producer_id, url) values ('5e500000-0000-4000-8000-000000000001', %L)$q$, u)) like '23514%', 'foto ruim passou: ' || u;
--     assert pg_temp.erro(format($q$insert into public.event_banners (producer_id, name, image_url) values ('5e500000-0000-4000-8000-000000000001', 'b', %L)$q$, u)) like '23514%', 'banner ruim passou: ' || u;
--   end loop;
--   assert pg_temp.erro($q$insert into public.event_banners (producer_id, name) values ('5e500000-0000-4000-8000-000000000001', 'sem imagem')$q$) = 'ok', 'banner sem imagem barrado';
--   raise notice 'T3 OK: endereço de imagem';
-- end $t$;
--
-- -- T4. Tamanho do feedback (visitante, pela regra de sempre): página longa barrada, normal passa.
-- do $t$ begin
--   perform pg_temp.como('anon');
--   assert pg_temp.erro($q$insert into public.feedback (type, message, page, user_agent) values ('bug', 'oi', '/x', 'Mozilla/5.0')$q$) = 'ok', 'feedback normal barrado';
--   assert pg_temp.erro(format($q$insert into public.feedback (type, message, page) values ('bug', 'oi', %L)$q$, repeat('p', 2049))) like '23514%', 'página longa passou';
--   assert pg_temp.erro(format($q$insert into public.feedback (type, message, user_agent) values ('bug', 'oi', %L)$q$, repeat('u', 1025))) like '23514%', 'user_agent longo passou';
--   perform pg_temp.como('postgres');
--   raise notice 'T4 OK: tamanhos do feedback';
-- end $t$;
--
-- -- T5. Newsletter: admin só com manage_newsletter (ou super_admin) e com 2FA; admin de outra área, logado comum
-- -- e visitante não leem; job de limpeza agendado.
-- insert into auth.users (id, email) values
--   ('5e500000-0000-4000-8000-000000000002', 'admin-news@teste-seg5.evokaa.invalid'),
--   ('5e500000-0000-4000-8000-000000000003', 'admin-eventos@teste-seg5.evokaa.invalid'),
--   ('5e500000-0000-4000-8000-000000000004', 'comum@teste-seg5.evokaa.invalid');
-- update public.profiles set role = 'admin', admin_permissions = '{manage_newsletter}' where id = '5e500000-0000-4000-8000-000000000002';
-- update public.profiles set role = 'admin', admin_permissions = '{manage_events}' where id = '5e500000-0000-4000-8000-000000000003';
-- insert into public.newsletters (title, content) values ('Seg5', 'oi');
-- do $t$ declare n int; begin
--   perform pg_temp.como('authenticated', '5e500000-0000-4000-8000-000000000002');
--   select count(*) into n from public.newsletter_subscribers where email = 'seg5@b.co';
--   assert n = 1, 'admin com manage_newsletter não lê inscritos';
--   select count(*) into n from public.newsletters where title = 'Seg5';
--   assert n = 1, 'admin com manage_newsletter não lê campanhas';
--   assert pg_temp.erro($q$insert into public.newsletter_subscribers (email) values ('admin-seg5@b.co')$q$) = 'ok', 'admin com manage_newsletter não grava inscrito';
--   perform pg_temp.como('authenticated', '5e500000-0000-4000-8000-000000000003');
--   select count(*) into n from public.newsletter_subscribers;
--   assert n = 0, 'admin sem manage_newsletter lê inscritos';
--   select count(*) into n from public.newsletters;
--   assert n = 0, 'admin sem manage_newsletter lê campanhas';
--   perform pg_temp.como('authenticated', '5e500000-0000-4000-8000-000000000004');
--   select count(*) into n from public.newsletter_subscribers;
--   assert n = 0, 'logado comum lê inscritos';
--   perform pg_temp.como('anon');
--   assert pg_temp.erro($q$select 1 from public.newsletter_subscribers$q$) = 'ok', 'select anon mudou de comportamento';
--   select count(*) into n from public.newsletter_subscribers;
--   assert n = 0, 'anon lê inscritos';
--   assert pg_temp.erro($q$insert into public.newsletter_subscribers (email) values ('anon-seg5@b.co')$q$) like '42501%', 'anon grava newsletter';
--   perform pg_temp.como('postgres');
--   -- com 2FA cadastrado, o admin em sessão aal1 fica de fora; em aal2 entra
--   insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at)
--     values (gen_random_uuid(), '5e500000-0000-4000-8000-000000000002', 'totp', 'verified', now(), now());
--   perform pg_temp.como('authenticated', '5e500000-0000-4000-8000-000000000002');
--   select count(*) into n from public.newsletter_subscribers;
--   assert n = 0, 'admin com 2FA em aal1 lê inscritos';
--   perform pg_temp.como('authenticated', '5e500000-0000-4000-8000-000000000002', 'aal2');
--   select count(*) into n from public.newsletter_subscribers where email = 'seg5@b.co';
--   assert n = 1, 'admin com 2FA em aal2 não lê inscritos';
--   perform pg_temp.como('postgres');
--   assert exists (select 1 from cron.job where jobname = 'limpar_contact_rate_limit_hits' and schedule = '23 * * * *'), 'job de limpeza não agendado';
--   raise notice 'T5 OK: newsletter só com manage_newsletter e 2FA';
-- end $t$;
-- rollback;
