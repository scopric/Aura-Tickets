-- =============================================================================
-- Apagar os 6 eventos de teste de maio/2026 (Decisão 35 do cofre, Ricardo em 27/09/2026 21:50).
-- Aplicar à mão no SQL Editor (Decisão 16). Ids conferidos em produção em 27/09/2026 (0 pedidos, 0 ingressos vendidos):
--   bd4225d8-4af7-44ad-b3ff-ca1e5255d958  Sunset Lounge & Jazz        (published, 2026-06-15)
--   5df16fbe-3bfe-4fb4-814c-a1f9804d6099  Neon Beats Party            (published, 2026-07-20)
--   a1b2c3d4-e5f6-7890-abcd-ef1234567890  Noite Eletro 2025           (published, 2025-06-15)
--   b2c3d4e5-f6a7-8901-bcde-f23456789012  Jazz Sunset Session         (published, 2025-06-22)
--   c3d4e5f6-a7b8-9012-cdef-345678901234  Feira de Arte Contemporanea (draft, 2025-07-05)
--   657fceb1-fac1-4ace-9a53-a7bd1c1a73a2  asfdv                       (published, 4556-03-21)
-- ticket_types, menu_items, collective_tables, event_* e seating_maps apagam em cascata;
-- as tabelas abaixo têm FK sem cascata e são limpas antes (hoje estão vazias para esses eventos).
-- =============================================================================
begin;

create temp table _ids (id uuid primary key) on commit drop;
insert into _ids values
 ('bd4225d8-4af7-44ad-b3ff-ca1e5255d958'),('5df16fbe-3bfe-4fb4-814c-a1f9804d6099'),
 ('a1b2c3d4-e5f6-7890-abcd-ef1234567890'),('b2c3d4e5-f6a7-8901-bcde-f23456789012'),
 ('c3d4e5f6-a7b8-9012-cdef-345678901234'),('657fceb1-fac1-4ace-9a53-a7bd1c1a73a2');

-- trava de segurança: só continua se nenhum desses eventos tiver pedido ou ingresso
do $$
begin
  if exists (select 1 from public.orders where event_id in (select id from _ids))
     or exists (select 1 from public.tickets where event_id in (select id from _ids)) then
    raise exception 'há pedidos ou ingressos ligados a estes eventos: não apagar';
  end if;
end $$;

delete from public.check_ins        where event_id in (select id from _ids);
delete from public.event_reviews    where event_id in (select id from _ids);
delete from public.interest_lists   where event_id in (select id from _ids);
delete from public.producer_tasks   where event_id in (select id from _ids);
delete from public.certificates     where event_id in (select id from _ids);
delete from public.affiliates       where event_id in (select id from _ids);
delete from public.coupons          where event_id in (select id from _ids);
delete from public.transactions     where event_id in (select id from _ids);
delete from public.menu_orders      where event_id in (select id from _ids);
delete from public.events           where id in (select id from _ids);

commit;

-- conferência (depois do commit; a tabela temporária já não existe): deve devolver 0
select count(*) as restantes from public.events where id in (
 'bd4225d8-4af7-44ad-b3ff-ca1e5255d958','5df16fbe-3bfe-4fb4-814c-a1f9804d6099',
 'a1b2c3d4-e5f6-7890-abcd-ef1234567890','b2c3d4e5-f6a7-8901-bcde-f23456789012',
 'c3d4e5f6-a7b8-9012-cdef-345678901234','657fceb1-fac1-4ace-9a53-a7bd1c1a73a2');
