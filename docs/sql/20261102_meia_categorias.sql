-- =============================================================================
-- Meia-entrada por categoria (decisão do Ricardo, 08/10/2026; PR A, só SQL). Ramo feat/meia-estadual.
-- O que faz:
--   1. beneficios_uf: 11 categorias estaduais (ES, PE, SP, PR, BA, SC, PB), idempotente (on conflict do update).
--   2. reservar_ingressos e reservar_assentos: acrescentam 'idoso' à lista dos nacionais; em reservar_assentos o idoso também não é barrado
--      por "lotação 0 = sem meia" (igual ao gatilho). Idoso segue barrado em mesa, coletiva, grátis e permite_meia=false. Resto igual à produção.
--   3. order_items_estoque_guard: o IDOSO FICA FORA da cota de 40% (a cota, a recusa "Restam % meias" e a regra "lotação 0 = sem meia"
--      valem só para meia_tipo diferente de 'idoso'; o idoso conta no estoque total e respeita permite_meia, mesa e coletiva; como não
--      usa as vagas guardadas à cota, a vaga do idoso sai do mesmo saldo da inteira).
--      PONTO A CONFIRMAR PELO JURÍDICO: é interpretação. A Lei 12.933/2013, art. 1º, § 10, limita a 40% as meias de estudante, pessoa
--      com deficiência e jovem; o idoso vem do Estatuto (Lei 10.741/2003, art. 23). Fontes não reabertas nesta sessão: [?].
--      RISCO DE RECEITA: idoso fora da cota = meia por declaração, sem teto, até haver portaria. Aceitar ou não é decisão do Ricardo;
--      confirmar o enquadramento é do jurídico.
--      Se o jurídico disser que o idoso entra na cota, basta tirar o filtro `meia_tipo is distinct from 'idoso'` nos 4 lugares
--      marcados "idoso fora da cota" no gatilho, e nos 2 da vitrine (meias e a cota).
--   4. vitrine_ingressos (mesma assinatura): lugar marcado volta a ter meia (tirou `not tipo_no_mapa` de meia_ok e da cota); em lugar
--      marcado a reserva da cota não é descontada de `disponiveis` (igual ao gatilho: lá v_reserva = 0); idoso fora da contagem de meias.
--   5. meia_beneficios(p_event_id) nova: lista [{codigo, nome, documento, cota}] para o comprador (5 nacionais + os da UF do evento).
-- ORDEM: depois de 20261031_taxa_meia_sem_piso.sql e 20261101_pagbank_base.sql. Pré-requisito conferido no bloco 0: as 3 funções são
--   as 3 funções e o gatilho de produção de 08/10/2026 (md5 de pg_get_functiondef; gatilho 8066ba88a8803a4a0c8ffd9b342f611e) OU já os desta
--   versão (re-executável).
-- Como aplicar: ensaiar com ROLLBACK, depois colar inteiro no SQL Editor (UTF-8 via pbcopy, nunca TextEdit). Uma transação, pode rodar de novo.
-- Testes: supabase/tests/meia_categorias.test.sql (só em banco local descartável).
-- NÃO mover para supabase/migrations/.
-- Desfazer: recriar as 4 funções a partir de supabase/migrations/20260930134600_baseline.sql (que é a produção anterior) e
--   apagar as linhas novas de beneficios_uf e a função meia_beneficios (bloco comentado no fim).
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 0. Pré-requisito: reservar_assentos, reservar_ingressos, vitrine_ingressos e order_items_estoque_guard são as de produção (08/10/2026) ou já as desta versão.
do $$
declare
  r record;
begin
  for r in select * from (values
    ('public.reservar_assentos(uuid, text[], jsonb)', 'ad22829b3ced06c077eeb891d762e546', '35f303f51b974cfa74b122a68ee589d4'),
    ('public.reservar_ingressos(uuid, jsonb, text, text)', 'f0df531cc931ebf60f83cc4f5ead3154', '6dc15447ebf574b2e1b7095f5f91de80'),
    ('public.vitrine_ingressos(uuid)', 'e7d24bb295cc584f954515745b017040', '49c9caea08647f8a77a97e9063025aec')) v(f, antigo, novo) loop
    if to_regprocedure(r.f) is null then
      raise exception 'falta %: aplicar antes os SQL anteriores de docs/sql', r.f;
    end if;
    if md5(pg_get_functiondef(r.f::regprocedure)) not in (r.antigo, r.novo) then
      raise exception '% mudou desde 08/10/2026 (md5 diferente): conferir a definição atual antes de aplicar', r.f;
    end if;
  end loop;
end $$;

-- 1. Categorias estaduais (nome e documento aparecem ao comprador).
insert into public.beneficios_uf (uf, codigo, nome, documento) values
  ('ES', 'es_professor', 'Professor ou educador',
   'Carteira funcional, carteira profissional ou de trabalho, comprovante de renda com a função, comprovante de filiação a entidade de classe, ou outro documento público que comprove a função'),
  ('ES', 'es_doadora_leite', 'Doadora de leite materno',
   'Comprovante de doadora de leite humano emitido por banco de leite, mais identidade com foto'),
  ('ES', 'es_cancer', 'Pessoa com câncer',
   'Laudo médico que comprove o câncer, mais identidade com foto'),
  ('PE', 'pe_cancer', 'Pessoa com câncer',
   'Laudo médico com CID, de profissional do SUS, emitido há no máximo 1 ano, mais identidade com foto'),
  ('PE', 'pe_cancer_acompanhante', 'Acompanhante de pessoa com câncer',
   'Mesmo laudo da pessoa acompanhada (profissional do SUS, com CID, emitido há no máximo 1 ano), mais identidade com foto'),
  ('SP', 'sp_professor', 'Professor da rede pública estadual ou municipal',
   'Carteira funcional da Secretaria da Educação ou holerite, mais identidade com foto'),
  ('PR', 'pr_mesario', 'Mesário ou apoio eleitoral',
   'Certidão da Justiça Eleitoral, mais identidade com foto'),
  ('PR', 'pr_saude', 'Profissional de saúde',
   'Identidade com foto mais contracheque, carteira funcional ou carteira de entidade de classe'),
  ('BA', 'ba_educacao', 'Profissional de educação',
   'Contracheque ou identidade funcional, mais identidade com foto'),
  ('SC', 'sc_menor18', 'Menor de 18 anos',
   'Identidade com foto ou certidão com documento do responsável'),
  ('PB', 'pb_menor12', 'Menor de 12 anos',
   'Documento de identificação com foto')
on conflict (uf, codigo) do update set nome = excluded.nome, documento = excluded.documento;

-- 2. reservar_assentos: só acrescenta 'idoso' à lista dos nacionais (resto igual ao baseline/produção)
CREATE OR REPLACE FUNCTION public.reservar_assentos(p_event uuid, p_seats text[], p_meias jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_mapa jsonb;
  v_n int;
  v_ok int;
  v_sel jsonb;
  v_order uuid;
  v_expira timestamptz := now() + interval '10 minutes';
  v_nome text;
  v_email text;
  v_sub bigint := 0;
  v_taxa bigint := 0;
  v_cent bigint;
  v_itens jsonb := '[]'::jsonb;
  v_uf text;
  v_meias int := 0;
  l record;
begin
  if v_user is null then
    raise exception 'Entre na sua conta para escolher o lugar' using errcode = '42501';
  end if;
  if p_seats is null or cardinality(p_seats) < 1 or cardinality(p_seats) > 20 then
    raise exception 'Escolha de 1 a 20 lugares' using errcode = '22023';
  end if;
  p_meias := coalesce(p_meias, '[]'::jsonb);
  -- valida o JSON ANTES de qualquer cast; cada meia aponta para um lugar escolhido, sem repetir
  if jsonb_typeof(p_meias) <> 'array' or jsonb_array_length(p_meias) > 20
     or exists (select 1 from jsonb_array_elements(p_meias) e(v)
                 where jsonb_typeof(e.v) <> 'object'
                    or jsonb_typeof(e.v -> 'seat_key') is distinct from 'string'
                    or jsonb_typeof(e.v -> 'meia_tipo') is distinct from 'string'
                    or not coalesce((e.v ->> 'seat_key') = any (p_seats), false)) then -- coalesce: NULL em p_seats não pode driblar a conferência
    raise exception 'Meia inválida: informe o lugar (entre os escolhidos) e o tipo de meia-entrada' using errcode = '22023';
  end if;
  if (select count(*) - count(distinct e.v ->> 'seat_key') from jsonb_array_elements(p_meias) e(v)) > 0 then
    raise exception 'Meia inválida: informe o lugar (entre os escolhidos) e o tipo de meia-entrada' using errcode = '22023';
  end if;
  if public.evento_acesso(p_event) is distinct from 'aberto' and public.evento_acesso(p_event) is distinct from 'link' then
    raise exception 'Evento indisponível para compra' using errcode = '22023';
  end if;
  -- evento_acesso devolve 'aberto' ao dono mesmo em rascunho: aqui só se reserva em evento publicado e aprovado
  select upper(btrim(e.venue_state)) into v_uf from public.events e where e.id = p_event and e.status = 'published' and e.approval_status = 'approved';
  if not found then
    raise exception 'Evento indisponível para compra' using errcode = '22023';
  end if;
  -- meia_tipo: nacional fixo ou estadual cadastrado para a UF do evento (igual ao reservar_ingressos)
  if exists (select 1 from jsonb_array_elements(p_meias) e(v)
              where not ((e.v ->> 'meia_tipo') in ('estudante', 'pcd', 'pcd_acompanhante', 'jovem_baixa_renda', 'idoso')
                         or exists (select 1 from public.beneficios_uf b where b.uf = v_uf and b.codigo = e.v ->> 'meia_tipo'))) then
    raise exception 'Tipo de meia-entrada inválido para este evento' using errcode = '22023';
  end if;
  -- mesma trava do gatilho orders_um_pendente: contagem e criação do pedido da mesma pessoa e evento em fila
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || p_event::text, 0));
  select count(*) into v_n from public.orders where user_id = v_user and event_id = p_event and created_at > now() - interval '1 hour';
  if v_n >= 5 then
    raise exception 'Você já fez 5 pedidos neste evento na última hora. Tente de novo mais tarde.' using errcode = '22023';
  end if;
  select environments into v_mapa from public.seating_maps where event_id = p_event and is_active;
  if v_mapa is null then
    raise exception 'Este evento não tem mapa de lugares disponível' using errcode = '22023';
  end if;

  -- lugares pedidos que existem, estão livres no mapa e têm setor com tipo de ingresso do evento; agrupa por tipo
  select coalesce(jsonb_agg(jsonb_build_object('seat_key', x.seat_key, 'tt', x.tt, 'lugares', x.lugares, 'stype', x.stype)), '[]'::jsonb) into v_sel
    from (
      select distinct (env.value->>'id') || ':' || (s.value->>'id') as seat_key,
             (sec.value->>'ticketTypeId')::uuid as tt,
             case when s.value->>'type' = 'table'
                  then least(greatest(coalesce(case when jsonb_typeof(s.value->'seatsCount') = 'number' then (s.value->>'seatsCount')::int end,
                                               case when jsonb_typeof(s.value->'capacity') = 'number' then (s.value->>'capacity')::int end, 6), 1), 50) -- teto 50: mapa adulterado não vira pedido gigante
                  else 1 end as lugares,
             s.value->>'type' as stype
        from jsonb_array_elements(case when jsonb_typeof(v_mapa) = 'array' then v_mapa else '[]'::jsonb end) env(value)
        cross join lateral jsonb_array_elements(case when jsonb_typeof(env.value->'seats') = 'array' then env.value->'seats' else '[]'::jsonb end) s(value)
        join lateral jsonb_array_elements(case when jsonb_typeof(env.value->'sections') = 'array' then env.value->'sections' else '[]'::jsonb end) sec(value)
          on sec.value->>'id' = s.value->>'sectionId'
       where (env.value->>'id') || ':' || (s.value->>'id') = any (p_seats)
         and s.value->>'type' in ('seat', 'table')
         and coalesce(s.value->>'status', 'free') = 'free'
         and sec.value->>'ticketTypeId' ~ '^[0-9a-fA-F-]{36}$'
    ) x
   where exists (select 1 from public.ticket_types tt
                  where tt.id = x.tt and tt.event_id = p_event and tt.is_active and tt.type is distinct from 'coletiva');
  v_ok := jsonb_array_length(v_sel);
  if v_ok <> (select count(distinct x) from unnest(p_seats) x) then
    raise exception 'Algum dos lugares escolhidos não está disponível' using errcode = '22023';
  end if;

  -- meia: cada lugar de meia tem de ser lugar individual ('seat') de tipo com meia (permite_meia, pago, fora de mesa/coletiva).
  -- UMA mensagem para qualquer falha (mesa, tipo sem meia, grátis): não diz qual regra barrou.
  if exists (select 1 from jsonb_array_elements(p_meias) e(v)
              where not exists (select 1 from jsonb_to_recordset(v_sel) r(seat_key text, tt uuid, lugares int, stype text)
                                  join public.ticket_types tt on tt.id = r.tt
                                 where r.seat_key = e.v ->> 'seat_key' and r.stype = 'seat'
                                   and tt.permite_meia and tt.price > 0 and tt.type not in ('mesa', 'coletiva')
                                   and (e.v ->> 'meia_tipo' = 'idoso' or coalesce(tt.quantity_total, 0) > 0 or coalesce(tt.capacity, 0) > 0))) then -- lotação 0 = cota de 40% sem base: sem meia, exceto idoso (fora da cota; igual ao gatilho)
    raise exception 'Meia-entrada não disponível para algum dos lugares escolhidos' using errcode = '22023';
  end if;
  -- marca o tipo de meia em cada lugar (nulo = inteira)
  select coalesce(jsonb_agg(r.value || jsonb_build_object('meia_tipo', m.meia_tipo)), '[]'::jsonb) into v_sel
    from jsonb_array_elements(v_sel) r(value)
    left join jsonb_to_recordset(p_meias) m(seat_key text, meia_tipo text) on m.seat_key = r.value ->> 'seat_key';

  -- pedido pelo caminho do #217: preço do banco; os gatilhos conferem estoque, máximo, janela e cancelam o pendente anterior
  select coalesce(nullif(p.full_name, ''), nullif(u.raw_user_meta_data->>'full_name', '')),
         coalesce(nullif(p.email, ''), nullif(u.email, ''))
    into v_nome, v_email
    from (select 1) d
    left join public.profiles p on p.id = v_user
    left join auth.users u on u.id = v_user;
  -- itens por tipo e tipo de meia (ordem de id do tipo: mesma ordem de trava em todo pedido); tudo em centavos
  for l in select r.tt, r.meia_tipo, sum(r.lugares)::int as q, round(tt.price * 100)::bigint as c
             from jsonb_to_recordset(v_sel) r(seat_key text, tt uuid, lugares int, meia_tipo text) join public.ticket_types tt on tt.id = r.tt
            group by r.tt, r.meia_tipo, tt.price order by r.tt, r.meia_tipo nulls first loop
    v_cent := case when l.meia_tipo is null then l.c else public.evk_preco_meia(l.c) end;
    v_sub := v_sub + v_cent * l.q;
    v_taxa := v_taxa + public.evk_taxa_centavos(v_cent, l.meia_tipo is not null) * l.q; -- = app/src/lib/taxa.ts
    if l.meia_tipo is not null then v_meias := v_meias + l.q; end if;
    v_itens := v_itens || jsonb_build_object('tt', l.tt, 'meia_tipo', l.meia_tipo, 'q', l.q, 'cent', v_cent,
                                             'taxa', public.evk_taxa_centavos(v_cent, l.meia_tipo is not null),
                                             'n', jsonb_array_length(v_itens) + 1);
  end loop;
  insert into public.orders (user_id, event_id, subtotal, service_fee, total, status, customer_name, customer_email)
  values (v_user, p_event, v_sub / 100.0, v_taxa / 100.0, (v_sub + v_taxa) / 100.0, 'pending', v_nome, v_email)
  returning id into v_order;

  -- libera o que venceu ou ficou de pedido não pago: pedido pendente vencido é cancelado ANTES, e a reserva guarda o rastro
  update public.orders set status = 'cancelled'
   where status = 'pending' and id in (select order_id from public.pedido_assentos
                                        where event_id = p_event and liberada_em is null and expira_em <= now());
  update public.pedido_assentos pa set liberada_em = now(), expira_em = least(pa.expira_em, now())
    from public.orders o
   where o.id = pa.order_id and pa.event_id = p_event and pa.liberada_em is null
     and o.status <> 'paid' and (o.status <> 'pending' or pa.expira_em <= now());

  -- lugares ANTES dos itens: o guard de estoque confere a meia contra os lugares individuais presos a este pedido
  begin
    insert into public.pedido_assentos (order_id, event_id, seat_key, ticket_type_id, lugares, expira_em)
    select v_order, p_event, r.seat_key, r.tt, r.lugares, v_expira from jsonb_to_recordset(v_sel) r(seat_key text, tt uuid, lugares int);
  exception when unique_violation then
    raise exception 'Lugar acabou de ser escolhido' using errcode = '22023';
  end;
  insert into public.order_items (order_id, ticket_type_id, quantity, unit_price, taxa_unit, subtotal, beneficio, meia_tipo)
  select v_order, y.tt, y.q, round(y.cent / 100.0, 2), round(y.taxa / 100.0, 2), round(y.cent * y.q / 100.0, 2),
         case when y.meia_tipo is null then 'inteira' else 'meia' end, y.meia_tipo
    from jsonb_to_recordset(v_itens) y(tt uuid, meia_tipo text, q int, cent bigint, taxa bigint, n int)
   order by y.n; -- ordem de trava garantida: a do array (por id do tipo)
  return jsonb_build_object('order_id', v_order, 'expira_em', v_expira, 'agora', now(), 'meias', v_meias); -- 'agora' para a contagem do navegador não depender do relógio dele
end;
$function$;

-- 3. reservar_ingressos: idem
CREATE OR REPLACE FUNCTION public.reservar_ingressos(p_event_id uuid, p_itens jsonb, p_cupom text DEFAULT NULL::text, p_cpf text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET lock_timeout TO '5s'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_ev record;
  v_cup record;
  v_cup_id uuid;
  v_it record;
  v_base bigint := 0;       -- subtotal das inteiras (base do desconto)
  v_desc_nominal bigint := 0;
  v_cent bigint;
  v_d bigint;
  v_taxa_u bigint;
  v_sub bigint := 0;
  v_desc bigint := 0;
  v_taxa bigint := 0;
  v_total bigint;
  v_linhas jsonb := '[]'::jsonb;
  v_order uuid;
  v_ate timestamptz := now() + interval '10 minutes'; -- 10 min fixos, definidos aqui (o cliente não escolhe)
  v_cancel int;
  v_usos int;
  v_n_inteira int;
  v_cpf boolean;
  v_motivo text;
  v_msg text;
  v_mensagem text;
  v_conta boolean := false; -- recusa que conta como tentativa (sonda de cupom ou de CPF)
  v_dig text;
  v_atual text;
  v_h text;
begin
  if v_uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Entre na sua conta para comprar' using errcode = '42501';
  end if;
  if not public.gf_mfa_ok() then
    raise exception 'Confirme o código do 2FA' using errcode = '42501';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) not between 1 and 10 then
    raise exception 'Informe de 1 a 10 itens' using errcode = '22023';
  end if;
  -- valida o JSON ANTES de qualquer cast (texto no lugar de número não pode virar erro 22P02)
  if exists (select 1 from jsonb_array_elements(p_itens) e(v)
              where jsonb_typeof(e.v) <> 'object'
                 or jsonb_typeof(e.v -> 'ticket_type_id') is distinct from 'string'
                 or (e.v ->> 'ticket_type_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                 or jsonb_typeof(e.v -> 'quantidade') is distinct from 'number'
                 or (e.v ->> 'quantidade')::numeric not between 1 and 100 or (e.v ->> 'quantidade')::numeric <> trunc((e.v ->> 'quantidade')::numeric)
                 or coalesce(jsonb_typeof(e.v -> 'beneficio'), 'string') <> 'string'
                 or coalesce(e.v ->> 'beneficio', 'inteira') not in ('inteira', 'meia')
                 or coalesce(jsonb_typeof(e.v -> 'meia_tipo'), 'string') <> 'string') then
    raise exception 'Item inválido (ingresso, quantidade inteira de 1 a 100, benefício inteira ou meia)' using errcode = '22023';
  end if;
  if (select count(*) - count(distinct (x.ticket_type_id, coalesce(x.beneficio, 'inteira'), x.meia_tipo))
        from jsonb_to_recordset(p_itens) as x(ticket_type_id uuid, quantidade int, beneficio text, meia_tipo text)) > 0 then
    raise exception 'Item repetido: some as quantidades do mesmo ingresso e benefício' using errcode = '22023';
  end if;
  select e.id, e.producer_id, upper(btrim(e.venue_state)) as uf into v_ev from public.events e
   where e.id = p_event_id and e.status = 'published' and e.approval_status = 'approved'
     and public.evento_acesso(e.id) in ('aberto', 'link');
  if not found then
    raise exception 'Evento indisponível para venda' using errcode = '22023';
  end if;
  -- meia_tipo: nacional fixo ou estadual cadastrado para a UF do evento
  for v_it in select x.meia_tipo, coalesce(x.beneficio, 'inteira') as beneficio
                from jsonb_to_recordset(p_itens) as x(ticket_type_id uuid, quantidade int, beneficio text, meia_tipo text) loop
    if v_it.beneficio = 'inteira' and v_it.meia_tipo is not null then
      raise exception 'Inteira não tem tipo de meia-entrada' using errcode = '22023';
    end if;
    if v_it.beneficio = 'meia' and (v_it.meia_tipo is null
       or not (v_it.meia_tipo in ('estudante', 'pcd', 'pcd_acompanhante', 'jovem_baixa_renda', 'idoso')
               or exists (select 1 from public.beneficios_uf b where b.uf = v_ev.uf and b.codigo = v_it.meia_tipo))) then
      raise exception 'Tipo de meia-entrada inválido para este evento' using errcode = '22023';
    end if;
  end loop;

  if (select count(distinct x.ticket_type_id) from jsonb_to_recordset(p_itens) as x(ticket_type_id uuid, quantidade int, beneficio text, meia_tipo text))
     <> (select count(*) from public.ticket_types tt where tt.event_id = p_event_id and tt.is_active
          and tt.id in (select x.ticket_type_id from jsonb_to_recordset(p_itens) as x(ticket_type_id uuid, quantidade int, beneficio text, meia_tipo text))) then
    raise exception 'Ingresso não encontrado ou indisponível' using errcode = '22023';
  end if;
  select coalesce(sum(round(tt.price * 100)::bigint * x.quantidade) filter (where coalesce(x.beneficio, 'inteira') = 'inteira'), 0),
         count(*) filter (where coalesce(x.beneficio, 'inteira') = 'inteira'),
         coalesce(bool_or(tt.max_por_cpf is not null), false)
    into v_base, v_n_inteira, v_cpf
    from jsonb_to_recordset(p_itens) as x(ticket_type_id uuid, quantidade int, beneficio text, meia_tipo text)
    join public.ticket_types tt on tt.id = x.ticket_type_id;


  perform pg_advisory_xact_lock(hashtextextended('reserva:' || v_uid || ':' || p_event_id, 0));
  if random() < 0.01 then -- limpeza barata: 1% das chamadas (índice em quando)
    delete from public.tentativas_reserva where quando < now() - interval '1 day';
  end if;
  if (select count(*) from public.tentativas_reserva t where t.user_id = v_uid and t.quando > now() - interval '1 hour') >= 10 then
    raise exception 'Muitas tentativas. Tente de novo mais tarde.' using errcode = '22023';
  end if;
  if (select count(*) from public.orders o
       where o.user_id = v_uid and o.event_id = p_event_id and o.reservado_ate is not null
         and o.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Muitas reservas neste evento. Tente de novo em alguns minutos.' using errcode = '22023';
  end if;

  -- CPF preso à conta (decisão do Ricardo), no corpo principal, FORA da subtransação: o hash fica gravado mesmo se o resto da
  -- reserva falhar, e depois dele a função NUNCA levanta exceção de regra de negócio (devolve {ok:false}). Cada conta sonda
  -- no máximo 1 CPF. Vem antes de qualquer consulta a orders por CPF.
  if v_cpf then
    v_dig := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
    if v_dig = '' then
      raise exception 'Informe o CPF do comprador para este ingresso' using errcode = '22023';
    end if;
    if not public.gf_cpf_valido(v_dig) then
      raise exception 'CPF inválido' using errcode = '22023';
    end if;
    v_h := encode(public.pr7_hmac(v_dig), 'hex');
    select p.cpf_compra_hmac into v_atual from public.profiles p where p.id = v_uid for update;
    if v_atual is null then
      update public.profiles set cpf_compra_hmac = v_h where id = v_uid; -- primeiro uso trava, mesmo que a reserva falhe
    elsif v_atual <> v_h then
      insert into public.tentativas_reserva (user_id, motivo) values (v_uid, 'cpf_da_conta');
      return jsonb_build_object('ok', false, 'motivo', 'cpf_da_conta',
        'mensagem', 'Use o CPF já vinculado à sua conta (se estiver errado, fale com o suporte)');
    end if;
  end if;

  -- Tudo que pode ser recusado por regra de negócio roda numa subtransação: se recusar, a reserva anterior da conta
  -- é preservada (nada fica gravado) e a função devolve {ok:false}, sem exceção, para a tentativa poder ser contada.
  begin
    update public.orders set status = 'cancelled'
     where user_id = v_uid and event_id = p_event_id and status = 'pending' and reservado_ate is not null;
    get diagnostics v_cancel = row_count;

    -- cupom: qualquer recusa levanta o mesmo erro interno (EV001), sem dizer o motivo
    if btrim(coalesce(p_cupom, '')) <> '' then
      if v_n_inteira = 0 then
        raise exception 'O cupom não vale para meia-entrada: tire o cupom ou inclua ingressos inteiros' using errcode = '22023';
      end if;
      select * into v_cup from public.coupons c
       where upper(c.code) = upper(btrim(p_cupom)) and c.producer_id = v_ev.producer_id
         and (c.event_id is null or c.event_id = p_event_id) and c.is_active
         and (c.valid_from is null or c.valid_from <= now()) and (c.valid_until is null or c.valid_until > now())
         and c.audience in ('all', 'first_purchase')
       order by c.id limit 1
       for update;
      if not found
         or (v_cup.audience = 'first_purchase' and exists (select 1 from public.orders o where o.user_id = v_uid and o.status = 'paid'))
         or (v_cup.min_order_value is not null and v_base < round(v_cup.min_order_value * 100)::bigint) then
        raise exception 'cupom' using errcode = 'EV001';
      end if;
      v_cup_id := v_cup.id;
      select count(*) into v_usos from public.orders o
       where o.coupon_id = v_cup.id and (o.status = 'paid' or (o.status = 'pending' and o.reservado_ate > now()));
      if v_cup.max_uses is not null and v_usos >= v_cup.max_uses then
        raise exception 'cupom' using errcode = 'EV001';
      end if;
      select count(*) into v_usos from public.orders o
       where o.coupon_id = v_cup.id and o.user_id = v_uid and (o.status = 'paid' or (o.status = 'pending' and o.reservado_ate > now()));
      if v_cup.max_uses_per_user is not null and v_usos >= v_cup.max_uses_per_user then
        raise exception 'cupom' using errcode = 'EV001';
      end if;
      v_desc_nominal := case v_cup.discount_type
                          when 'percent' then floor(v_base * v_cup.discount_value / 100)::bigint
                          else round(v_cup.discount_value * 100)::bigint end;
      if v_cup.max_discount is not null then
        v_desc_nominal := least(v_desc_nominal, round(v_cup.max_discount * 100)::bigint);
      end if;
      v_desc_nominal := least(v_desc_nominal, v_base);
      if v_desc_nominal <= 0 then -- cupom sem efeito (pedido só de itens grátis ou desconto 0): não grava coupon_id nem queima o cupom
        raise exception 'cupom' using errcode = 'EV001';
      end if;
    end if;

    -- linhas (ordem de id do tipo: mesma ordem de trava em todo pedido, sem impasse)
    for v_it in select x.ticket_type_id, x.quantidade, coalesce(x.beneficio, 'inteira') as beneficio, x.meia_tipo,
                       round(tt.price * 100)::bigint as cent
                  from jsonb_to_recordset(p_itens) as x(ticket_type_id uuid, quantidade int, beneficio text, meia_tipo text)
                  join public.ticket_types tt on tt.id = x.ticket_type_id
                 order by x.ticket_type_id, 3, x.meia_tipo loop
      if v_it.beneficio = 'meia' then
        v_cent := public.evk_preco_meia(v_it.cent);
        v_d := 0; -- cupom não vale na meia
      else
        v_cent := v_it.cent;
        v_d := case when v_base > 0 then (v_desc_nominal * v_cent) / v_base else 0 end; -- rateio: ver cabeçalho
      end if;
      v_taxa_u := public.evk_taxa_centavos(v_cent - v_d, v_it.beneficio = 'meia'); -- TAXA_BASE: preço com desconto (decisão do Ricardo, 30/10)
      v_sub := v_sub + v_cent * v_it.quantidade;
      v_desc := v_desc + v_d * v_it.quantidade;
      v_taxa := v_taxa + v_taxa_u * v_it.quantidade;
      v_linhas := v_linhas || jsonb_build_object('ticket_type_id', v_it.ticket_type_id, 'quantidade', v_it.quantidade,
        'beneficio', v_it.beneficio, 'meia_tipo', v_it.meia_tipo, 'cent', v_cent, 'desc_cent', v_d, 'taxa_cent', v_taxa_u);
    end loop;
    v_total := v_sub - v_desc + v_taxa;

    insert into public.orders (user_id, event_id, coupon_id, subtotal, discount, service_fee, total, status,
                               customer_name, customer_email, customer_cpf, reservado_ate)
    values (v_uid, p_event_id, v_cup_id, round(v_sub / 100.0, 2), round(v_desc / 100.0, 2), round(v_taxa / 100.0, 2), round(v_total / 100.0, 2), 'pending',
            (select nullif(btrim(p.full_name), '') from public.profiles p where p.id = v_uid),
            auth.jwt() ->> 'email', case when v_cpf then nullif(btrim(coalesce(p_cpf, '')), '') end, v_ate)
    returning id into v_order;

    -- um insert por item, em ordem: o guard e a mesa_pedido_guard enxergam os itens anteriores do mesmo pedido
    for v_it in select * from jsonb_to_recordset(v_linhas)
             as y(ticket_type_id uuid, quantidade int, beneficio text, meia_tipo text, cent bigint, taxa_cent bigint) loop
      insert into public.order_items (order_id, ticket_type_id, quantity, unit_price, taxa_unit, subtotal, beneficio, meia_tipo)
      values (v_order, v_it.ticket_type_id, v_it.quantidade, round(v_it.cent / 100.0, 2), round(v_it.taxa_cent / 100.0, 2),
              round(v_it.cent * v_it.quantidade / 100.0, 2), v_it.beneficio, v_it.meia_tipo);
    end loop;
  exception
    when sqlstate 'EV001' then
      v_motivo := 'cupom_invalido';
      v_mensagem := 'Cupom inválido ou não se aplica a este pedido';
      v_conta := true;
    when sqlstate '22023' then
      -- regra de negócio (esgotado, tetos, meia, limite por CPF, ...): vira retorno, para o hash da conta (acima) não ser desfeito
      get stacked diagnostics v_msg = message_text;
      if v_cpf then
        -- pedido com tipo de limite por CPF: UMA resposta só, para a falha por CPF e as outras não se distinguirem (sem oráculo)
        v_motivo := 'indisponivel';
        v_mensagem := 'Não foi possível reservar. Confira quantidade e disponibilidade e tente de novo.';
        -- só a recusa do limite por CPF (e a de muitos CPFs) conta tentativa; esgotado, tetos etc. não bloqueiam o comprador honesto
        v_conta := v_msg like 'Limite de % ingressos por CPF neste ingresso' or v_msg like 'Muitas tentativas com CPFs diferentes%';
      else
        v_motivo := 'regra';
        v_mensagem := v_msg;
      end if;
    when others then
      -- erro inesperado (lock timeout, deadlock 40P01, serialização 40001, ...): com tipo de limite por CPF vira a MESMA resposta
      -- uniforme (o hash da conta, gravado antes, fica); sem ele, relança como antes. Nunca devolve ok:true aqui.
      if v_cpf then
        v_motivo := 'indisponivel';
        v_mensagem := 'Não foi possível reservar. Confira quantidade e disponibilidade e tente de novo.';
      else
        raise;
      end if;
  end;
  if v_motivo is not null then
    if v_conta then -- só as recusas que sondam cupom ou CPF contam tentativa; esgotado, tetos e erros inesperados não
      insert into public.tentativas_reserva (user_id, motivo) values (v_uid, v_motivo);
    end if;
    return jsonb_build_object('ok', false, 'motivo', v_motivo, 'mensagem', v_mensagem);
  end if;

  return jsonb_build_object(
    'ok', true, 'order_id', v_order, 'status', 'pending', 'subtotal', round(v_sub / 100.0, 2), 'desconto', round(v_desc / 100.0, 2),
    'taxa', round(v_taxa / 100.0, 2), 'total', round(v_total / 100.0, 2), 'reservado_ate', v_ate, 'agora', now(), 'itens', v_linhas,
    'aviso', case when v_cancel > 0 then 'Sua reserva anterior neste evento foi substituída por esta.' end);
end;
$function$;

-- 4. Gatilho do estoque: idoso fora da cota de 40%
CREATE OR REPLACE FUNCTION public.order_items_estoque_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_lotacao int;
  v_sold int;
  v_reservado int;
  v_min int;
  v_max int;
  v_no_pedido int;
  v_motivo text;
  v_max_cpf int;
  v_hash bytea;
  v_user uuid;
  v_outros int;
  v_permite boolean;
  v_preco numeric;
  v_tipo text;
  v_meias int;
  v_cota int;
  v_reserva int;
  v_limite int;
  v_mapa boolean;
  v_meia_ok boolean;
  v_restam int;
begin
  select case when coalesce(tt.quantity_total, 0) > 0 then tt.quantity_total
              when coalesce(tt.capacity, 0) > 0 then tt.capacity else 0 end,
         coalesce(tt.sold, 0), tt.min_per_order,
         case when tt.price = 0 then coalesce(tt.max_per_order, 10) else tt.max_per_order end,
         tt.max_por_cpf, tt.permite_meia, tt.price, tt.type
    into v_lotacao, v_sold, v_min, v_max, v_max_cpf, v_permite, v_preco, v_tipo
    from public.ticket_types tt where tt.id = new.ticket_type_id for update;
  if not found then
    return new; -- tipo inexistente cai na FK
  end if;
  -- meia (20261030): tipo pago sem máximo também tem teto por pedido e por conta/evento (negação de estoque); lugar marcado fica fora
  -- (reservar_assentos grava um item com todos os lugares)
  if v_preco > 0 and not public.tipo_no_mapa(new.ticket_type_id) then
    v_max := coalesce(v_max, 10);
    if (select coalesce(sum(oi.quantity), 0) from public.order_items oi join public.orders o on o.id = oi.order_id
         join public.orders o2 on o2.id = new.order_id
         where o.user_id = o2.user_id and o.event_id = o2.event_id and o.status = 'pending' and oi.id is distinct from new.id
           and coalesce(o.reservado_ate > now(), o.created_at > now() - interval '30 minutes')) + new.quantity > 20 then
      raise exception 'Limite de 20 ingressos reservados ao mesmo tempo neste evento' using errcode = '22023';
    end if;
  end if;
  -- v_max: tipo grátis sem máximo definido = teto de 10; tipo pago sem máximo = sem teto por pedido (nulo)
  if new.quantity < 1 or new.quantity < coalesce(v_min, 1) then
    raise exception 'Quantidade fora do permitido por pedido (mínimo %)', coalesce(v_min, 1) using errcode = '22023';
  end if;
  select coalesce(sum(oi.quantity), 0) + new.quantity into v_no_pedido
    from public.order_items oi
   where oi.order_id = new.order_id and oi.ticket_type_id = new.ticket_type_id and oi.id is distinct from new.id;
  if v_max is not null and v_no_pedido > v_max then
    raise exception 'Limite de % ingressos por pedido deste tipo', v_max using errcode = '22023';
  end if;
  v_motivo := public.venda_bloqueada(new.ticket_type_id);
  if v_motivo is not null then
    raise exception '%', v_motivo using errcode = '22023';
  end if;
  -- limite por CPF (20261028): antes do teste de lotação, vale mesmo sem lotação; a mensagem não diz quantos o CPF já tem
  if v_max_cpf is not null then
    select o.customer_cpf_hmac, o.user_id into v_hash, v_user from public.orders o where o.id = new.order_id;
    if v_hash is null then
      raise exception 'Informe o CPF do comprador para este ingresso' using errcode = '22023';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(new.ticket_type_id::text || encode(v_hash, 'hex'), 0));
    select coalesce(sum(oi.quantity), 0) into v_outros
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
     where oi.ticket_type_id = new.ticket_type_id and o.customer_cpf_hmac = v_hash
       and o.id <> new.order_id and oi.id is distinct from new.id
       and (o.status = 'paid'
            or (o.status = 'pending' and o.user_id = v_user -- pendente só da MESMA conta; o de outra é rechecado ao pagar
                and o.created_at > now() - case when exists (select 1 from public.pedido_assentos pa where pa.order_id = o.id and pa.liberada_em is null)
                                                then interval '10 minutes' else interval '30 minutes' end));
    if v_no_pedido + v_outros > v_max_cpf then
      raise exception 'Limite de % ingressos por CPF neste ingresso', v_max_cpf using errcode = '22023';
    end if;
  end if;
  -- meia (20261030): quem pode ter meia e a cota. Mesa, coletiva, preço 0 e permite_meia=false não têm meia; lugar marcado
  -- só tem em lugar individual (20261030f, abaixo). Quem não tem meia não segura cota.
  v_mapa := public.tipo_no_mapa(new.ticket_type_id);
  v_meia_ok := v_permite and v_tipo not in ('mesa', 'coletiva') and v_preco > 0;
  if new.beneficio = 'meia' then
    if not v_meia_ok then
      raise exception 'Este ingresso não tem meia-entrada' using errcode = '22023';
    end if;
    -- lotação 0 (quantity_total e capacity vazios): sem base para a cota de 40%, então sem meia (20261030f); vale para qualquer porta
    if v_lotacao = 0 and new.meia_tipo is distinct from 'idoso' then -- idoso fora da cota (ver cabeçalho)
      raise exception 'Meia-entrada não disponível para algum dos lugares escolhidos' using errcode = '22023';
    end if;
    -- meia em lugar marcado (20261030f): só em lugar individual já preso a este pedido (reservar_assentos grava pedido_assentos antes dos itens)
    if v_mapa and (select coalesce(sum(oi.quantity), 0) from public.order_items oi
                    where oi.order_id = new.order_id and oi.ticket_type_id = new.ticket_type_id and oi.beneficio = 'meia' and oi.id is distinct from new.id)
                  + new.quantity > (select count(*) from public.pedido_assentos pa
                                     where pa.order_id = new.order_id and pa.ticket_type_id = new.ticket_type_id and pa.liberada_em is null and pa.lugares = 1) then
      raise exception 'Meia-entrada em lugar marcado só vale em lugar individual escolhido' using errcode = '22023';
    end if;
    if new.meia_tipo is null then
      raise exception 'Informe o tipo de meia-entrada' using errcode = '22023';
    end if;
  end if;
  if v_lotacao = 0 then
    return new; -- sem lotação não se afirma esgotado (e a meia fica sem teto)
  end if;
  v_cota := case when v_meia_ok then (v_lotacao * 4 + 9) / 10 else 0 end; -- ceil(40% da lotação do tipo); cada tipo é o seu grupo (fatia 3 traz o grupo)
  select coalesce(sum(oi.quantity), 0) into v_reservado
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
   where oi.ticket_type_id = new.ticket_type_id and oi.id is distinct from new.id
     and o.status = 'pending'
     and coalesce(o.reservado_ate > now(), -- meia (20261030): reserva do servidor vale até reservado_ate; sem ele, a regra antiga
                  o.created_at > now() - case when exists (select 1 from public.pedido_assentos pa where pa.order_id = o.id and pa.liberada_em is null)
                                     then interval '10 minutes' else interval '30 minutes' end);
  -- meia (20261030): meias já ocupadas (pagas + reservas vivas) e a reserva de vagas para a cota de meia
  select coalesce(sum(oi.quantity), 0) into v_meias
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
   where oi.ticket_type_id = new.ticket_type_id and oi.id is distinct from new.id and oi.beneficio = 'meia' and oi.meia_tipo is distinct from 'idoso' -- idoso fora da cota (ver cabeçalho)
     and (o.status = 'paid'
          or (o.status = 'pending'
              and coalesce(o.reservado_ate > now(), o.created_at > now() - case when exists (select 1 from public.pedido_assentos pa where pa.order_id = o.id and pa.liberada_em is null)
                                     then interval '10 minutes' else interval '30 minutes' end)));
  v_restam := greatest(v_cota - v_meias, 0);
  v_reserva := case when v_mapa then 0 else v_restam end; -- lugar marcado: a cota limita as meias, mas não guarda vagas (o comprador escolhe o lugar)
  if new.beneficio = 'meia' and new.meia_tipo is distinct from 'idoso' and v_meias + new.quantity > v_cota then -- idoso fora da cota (ver cabeçalho)
    raise exception 'Restam % meias neste ingresso', v_restam using errcode = '22023';
  end if;
  v_limite := v_lotacao - case when new.beneficio = 'meia' and new.meia_tipo is distinct from 'idoso' then 0 else v_reserva end; -- idoso fora da cota (ver cabeçalho): não usa as vagas guardadas à cota -- a inteira não come as vagas guardadas para a meia
  if v_sold + v_reservado + new.quantity > v_limite then
    raise exception 'Ingressos esgotados ou insuficientes (restam %)', greatest(v_limite - v_sold - v_reservado, 0) using errcode = '22023';
  end if;
  return new;
end;
$function$;

-- 5. Vitrine: meia também em lugar marcado, mesmo número do gatilho; idoso fora da contagem
CREATE OR REPLACE FUNCTION public.vitrine_ingressos(p_event_id uuid)
 RETURNS TABLE(ticket_type_id uuid, nome text, preco numeric, taxa numeric, preco_meia numeric, taxa_meia numeric, permite_meia boolean, disponiveis integer, meias_disponiveis integer, meias_total integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select x.id, x.name, x.cent / 100.0, public.evk_taxa_centavos(x.cent) / 100.0,
         case when x.meia_ok then public.evk_preco_meia(x.cent) / 100.0 end,
         case when x.meia_ok then public.evk_taxa_centavos(public.evk_preco_meia(x.cent), true) / 100.0 end,
         x.meia_ok,
         case when x.lot > 0 then greatest(x.lot - x.sold - x.res - case when x.mapa then 0 else greatest(x.cota - x.meias, 0) end, 0)::int end,
         case when x.meia_ok then case when x.lot > 0 then greatest(least(x.cota - x.meias, x.lot - x.sold - x.res), 0)::int end else 0 end,
         case when x.meia_ok and x.lot > 0 then x.cota else 0 end
    from (
      select tt.id, tt.name, tt.sort_order, tt.created_at, round(tt.price * 100)::bigint as cent,
             case when coalesce(tt.quantity_total, 0) > 0 then tt.quantity_total when coalesce(tt.capacity, 0) > 0 then tt.capacity else 0 end as lot,
             coalesce(tt.sold, 0) as sold, public.tipo_no_mapa(tt.id) as mapa,
             (tt.permite_meia and tt.type not in ('mesa', 'coletiva') and tt.price > 0) as meia_ok,
             (select coalesce(sum(oi.quantity), 0) from public.order_items oi join public.orders o on o.id = oi.order_id
               where oi.ticket_type_id = tt.id and o.status = 'pending'
                 and coalesce(o.reservado_ate > now(), o.created_at > now() - case when exists (select 1 from public.pedido_assentos pa where pa.order_id = o.id and pa.liberada_em is null)
                                     then interval '10 minutes' else interval '30 minutes' end))::int as res,
             (select coalesce(sum(oi.quantity), 0) from public.order_items oi join public.orders o on o.id = oi.order_id
               where oi.ticket_type_id = tt.id and oi.beneficio = 'meia' and oi.meia_tipo is distinct from 'idoso' and (o.status = 'paid' or (o.status = 'pending'
                 and coalesce(o.reservado_ate > now(), o.created_at > now() - case when exists (select 1 from public.pedido_assentos pa where pa.order_id = o.id and pa.liberada_em is null)
                                     then interval '10 minutes' else interval '30 minutes' end))))::int as meias,
             case when (tt.permite_meia and tt.type not in ('mesa', 'coletiva') and tt.price > 0)
                  then ((case when coalesce(tt.quantity_total, 0) > 0 then tt.quantity_total when coalesce(tt.capacity, 0) > 0 then tt.capacity else 0 end) * 4 + 9) / 10
                  else 0 end as cota
        from public.ticket_types tt
       where tt.event_id = p_event_id and tt.is_active
         and public.evento_acesso(p_event_id) in ('aberto', 'link')
         and exists (select 1 from public.events e where e.id = p_event_id and e.status = 'published' and e.approval_status = 'approved')
    ) x
   order by x.sort_order nulls last, x.created_at;
$function$;

-- 6. meia_beneficios(evento): o que o comprador pode escolher como meia neste evento. Mesmo filtro de acesso da vitrine; evento
--    invisível ou inexistente devolve []. UF vazia ou sem linha em beneficios_uf: só os nacionais. cota=false: idoso (fora dos 40%).
create or replace function public.meia_beneficios(p_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.evento_acesso(p_event_id) in ('aberto', 'link')
         and exists (select 1 from public.events e where e.id = p_event_id and e.status = 'published' and e.approval_status = 'approved')
    then (
      select coalesce(jsonb_agg(jsonb_build_object('codigo', x.codigo, 'nome', x.nome, 'documento', x.documento, 'cota', x.cota)
                                order by x.ordem, x.nome), '[]'::jsonb)
        from (
          select * from (values
            ('estudante', 'Estudante', 'Carteira de Identificação Estudantil (CIE) válida, mais identidade com foto', true, 0),
            ('pcd', 'Pessoa com deficiência', 'Documento oficial que comprove a deficiência, mais identidade com foto', true, 0),
            ('pcd_acompanhante', 'Acompanhante de pessoa com deficiência', 'Documento oficial que comprove a deficiência da pessoa acompanhada, mais identidade com foto', true, 0),
            ('jovem_baixa_renda', 'Jovem de baixa renda', 'Identidade Jovem (ID Jovem) válida, mais identidade com foto', true, 0),
            ('idoso', 'Idoso (60 anos ou mais)', 'Identidade com foto', false, 0)
          ) n(codigo, nome, documento, cota, ordem)
          union all
          select b.codigo, b.nome, b.documento, true, 1
            from public.beneficios_uf b
           where b.uf = (select upper(btrim(e.venue_state)) from public.events e where e.id = p_event_id)
        ) x
    )
    else '[]'::jsonb
  end;
$$;
revoke all on function public.meia_beneficios(uuid) from public, anon, authenticated;
grant execute on function public.meia_beneficios(uuid) to anon, authenticated;

-- 7. Conferência final (falha desfaz tudo): idoso aceito nas duas portas, EXECUTE de anon/authenticated, 11 categorias.
do $$
begin
  if (select count(*) from public.beneficios_uf where codigo in ('es_professor', 'es_doadora_leite', 'es_cancer', 'pe_cancer', 'pe_cancer_acompanhante',
        'sp_professor', 'pr_mesario', 'pr_saude', 'ba_educacao', 'sc_menor18', 'pb_menor12')) <> 11 then
    raise exception 'beneficios_uf: faltam categorias';
  end if;
  if pg_get_functiondef('public.reservar_ingressos(uuid, jsonb, text, text)'::regprocedure) not like '%''jovem_baixa_renda'', ''idoso''%'
     or pg_get_functiondef('public.reservar_assentos(uuid, text[], jsonb)'::regprocedure) not like '%''jovem_baixa_renda'', ''idoso''%' then
    raise exception 'idoso não entrou na lista dos nacionais';
  end if;
  if pg_get_functiondef('public.order_items_estoque_guard()'::regprocedure) not like '%distinct from ''idoso''%' then
    raise exception 'gatilho sem o filtro do idoso';
  end if;
  if not has_function_privilege('anon', 'public.meia_beneficios(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.meia_beneficios(uuid)', 'execute')
     or not has_function_privilege('anon', 'public.vitrine_ingressos(uuid)', 'execute') then
    raise exception 'meia_beneficios/vitrine_ingressos: anon e authenticated precisam executar';
  end if;
end $$;

commit;

-- Desfazer (rodar à parte): recriar reservar_assentos, reservar_ingressos, vitrine_ingressos e order_items_estoque_guard com o texto
-- de supabase/migrations/20260930134600_baseline.sql, e:
-- begin;
-- drop function if exists public.meia_beneficios(uuid);
-- delete from public.beneficios_uf where codigo in ('es_professor','es_doadora_leite','es_cancer','pe_cancer','pe_cancer_acompanhante','sp_professor','pr_mesario','pr_saude','ba_educacao','sc_menor18','pb_menor12');
-- commit;
