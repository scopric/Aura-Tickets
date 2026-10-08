-- =============================================================================
-- Tela 06, fatia 3: meia-entrada em LUGAR MARCADO individual (Decisão 192, do Ricardo, 08/10/2026). 2026-10-30 (NÃO aplicado)
-- ORDEM: depois de 20261030a_venda_servidor_meia.sql (usa evk_preco_meia, evk_taxa_centavos, beneficios_uf, permite_meia, tipo_no_mapa).
-- NÃO confundir com 20261030c_equipe_convite_email.sql (outro assunto, mesmo prefixo; os dois são independentes).
-- BASE: reservar_assentos de PRODUÇÃO = docs/sql/20261008_assento_reserva.sql l.132-246, md5 de pg_get_functiondef(reservar_assentos(uuid,text[]))
--   5a23e3532704777b08aadb1229053f11 (informado pelo Ricardo; ESTE agente não tinha acesso ao banco e NÃO conferiu o texto de produção contra o arquivo).
--   order_items_estoque_guard de produção = o do 20261030a, md5 3641e118aeaf0f2b64acaeb314938fe3. O bloco 0 aborta se o md5 de qualquer
--   das duas for outro (a menos que já tenha a marca '20261030c', o que torna o arquivo reaplicável).
-- 1. reservar_assentos(p_event, p_seats, p_meias jsonb default '[]'): a assinatura muda, então a de 2 argumentos é APAGADA (drop) e a nova é
--    criada; a chamada antiga de 2 argumentos continua valendo (o 3º tem default) e vende tudo como inteira, como hoje.
--    p_meias = lista de {"seat_key":"ambiente:assento","meia_tipo":"estudante"}; cada seat_key tem de estar em p_seats, sem repetir.
--    Meia SÓ em lugar individual (type 'seat') de tipo com permite_meia, preço > 0 e fora de mesa/coletiva. Mesa ('table'), tipo
--    mesa/coletiva, tipo grátis ou permite_meia=false: UMA mensagem só ("Meia-entrada não disponível para algum dos lugares escolhidos"),
--    sem dizer qual regra falhou. meia_tipo: nacional fixo (estudante, pcd, pcd_acompanhante, jovem_baixa_renda) ou existente em
--    beneficios_uf para a UF do evento, como no 20261030a. Preço NUNCA vem do cliente: meia = evk_preco_meia(preço do banco).
--    Itens separados em order_items (inteira x cada meia_tipo, por tipo), com beneficio, meia_tipo, unit_price e taxa_unit.
--    Subtotal e taxa do pedido: evk_preco_meia e evk_taxa_centavos (antes: 10% com mínimo de 300 centavos escrito na função; para a
--    inteira o resultado é o mesmo). Cupom NÃO entra aqui. A cota de 40% por tipo é a do guard (abaixo).
--    O retorno ganha 'meias' (quantidade); o resto igual. pedido_assentos agora é gravado ANTES dos itens (o guard precisa dele);
--    se qualquer passo falhar, a transação inteira é desfeita como antes. pedido_assentos NÃO guarda qual lugar é meia (só os itens,
--    por contagem): se a portaria precisar da meia por lugar, é coluna nova em outra fatia.
-- 2. order_items_estoque_guard: reescrito a partir do texto do 20261030a (md5 3641e118…), mexendo SÓ em: (a) item meia em tipo do mapa deixa
--    de ser recusado se houver, no mesmo pedido e tipo, lugares individuais vivos (pedido_assentos, lugares = 1) em número >= meias;
--    mensagem nova "Meia-entrada em lugar marcado só vale em lugar individual escolhido"; (b) a cota de 40% (ceil) passa a valer
--    também no tipo de lugar marcado, mas lá ela só LIMITA as meias, não guarda vagas da inteira (v_reserva = 0): quem escolhe lugar
--    não pode ter lugar "guardado" que ninguém consegue apontar. Lotação 0 continua sem teto. Marca: '20261030c'.
--    Os testes do 20261030a que esperam a recusa antiga ("ainda não está disponível") deixam de valer depois deste arquivo.
-- Risco que resta: o guard não sabe se o lugar da meia é o 1º ou o 2º do pedido (só conta): é indiferente para preço (mesmo tipo = mesmo preço).
-- Como aplicar: colar inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA TextEdit). Uma transação. NÃO mover para supabase/migrations/.
-- Testes: supabase/tests/meia_assentos.test.sql (banco local descartável, com docs/sql até 20261030a aplicado).
-- ponytail: meia sem CPF/documento conferido aqui: a conferência do benefício é na portaria, como na meia sem lugar marcado.
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 0. Pré-requisitos (abortam) ------------------------------------------------------------------------------------------
do $$
declare d text;
begin
  if to_regprocedure('public.evk_preco_meia(bigint)') is null or to_regprocedure('public.evk_taxa_centavos(bigint, boolean)') is null
     or to_regprocedure('public.tipo_no_mapa(uuid)') is null or to_regclass('public.beneficios_uf') is null
     or to_regprocedure('public.reservar_ingressos(uuid, jsonb, text, text)') is null then
    raise exception 'faltam as peças do 20261030a (evk_preco_meia, evk_taxa_centavos, tipo_no_mapa, beneficios_uf, reservar_ingressos): aplicar o 20261030a antes';
  end if;
  if to_regclass('public.pedido_assentos') is null or to_regprocedure('public.evento_acesso(uuid)') is null then
    raise exception 'faltam pedido_assentos ou evento_acesso (20261008_assento_reserva, 20261017_f1_pr3e_visibilidade)';
  end if;
  d := pg_get_functiondef('public.order_items_estoque_guard()'::regprocedure);
  if md5(d) <> '3641e118aeaf0f2b64acaeb314938fe3' and position('20261030c' in d) = 0 then
    raise exception 'order_items_estoque_guard mudou desde a leitura de produção (md5 %): refazer a partir da definição atual', md5(d);
  end if;
  if to_regprocedure('public.reservar_assentos(uuid, text[])') is not null then
    d := pg_get_functiondef('public.reservar_assentos(uuid, text[])'::regprocedure);
    if md5(d) <> '5a23e3532704777b08aadb1229053f11' then
      raise exception 'reservar_assentos mudou desde a leitura de produção (md5 %): refazer a partir da definição atual', md5(d);
    end if;
  elsif to_regprocedure('public.reservar_assentos(uuid, text[], jsonb)') is null then
    raise exception 'falta reservar_assentos (20261008_assento_reserva)';
  end if;
end $$;

-- 1. Guard de estoque (20261030a + meia em lugar marcado) ---------------------------------------------------------------
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
  -- só tem em lugar individual (20261030c, abaixo). Quem não tem meia não segura cota.
  v_mapa := public.tipo_no_mapa(new.ticket_type_id);
  v_meia_ok := v_permite and v_tipo not in ('mesa', 'coletiva') and v_preco > 0;
  if new.beneficio = 'meia' then
    if not v_meia_ok then
      raise exception 'Este ingresso não tem meia-entrada' using errcode = '22023';
    end if;
    -- meia em lugar marcado (20261030c): só em lugar individual já preso a este pedido (reservar_assentos grava pedido_assentos antes dos itens)
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
   where oi.ticket_type_id = new.ticket_type_id and oi.id is distinct from new.id and oi.beneficio = 'meia'
     and (o.status = 'paid'
          or (o.status = 'pending'
              and coalesce(o.reservado_ate > now(), o.created_at > now() - case when exists (select 1 from public.pedido_assentos pa where pa.order_id = o.id and pa.liberada_em is null)
                                     then interval '10 minutes' else interval '30 minutes' end)));
  v_restam := greatest(v_cota - v_meias, 0);
  v_reserva := case when v_mapa then 0 else v_restam end; -- lugar marcado: a cota limita as meias, mas não guarda vagas (o comprador escolhe o lugar)
  if new.beneficio = 'meia' and v_meias + new.quantity > v_cota then
    raise exception 'Restam % meias neste ingresso', v_restam using errcode = '22023';
  end if;
  v_limite := v_lotacao - case when new.beneficio = 'meia' then 0 else v_reserva end; -- a inteira não come as vagas guardadas para a meia
  if v_sold + v_reservado + new.quantity > v_limite then
    raise exception 'Ingressos esgotados ou insuficientes (restam %)', greatest(v_limite - v_sold - v_reservado, 0) using errcode = '22023';
  end if;
  return new;
end;
$function$;

revoke execute on function public.order_items_estoque_guard() from public, anon, authenticated;

-- 2. Reservar lugares, com meia opcional por lugar individual ------------------------------------------------------------
drop function if exists public.reservar_assentos(uuid, text[]);
create or replace function public.reservar_assentos(p_event uuid, p_seats text[], p_meias jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
                    or not ((e.v ->> 'seat_key') = any (p_seats))) then
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
              where not ((e.v ->> 'meia_tipo') in ('estudante', 'pcd', 'pcd_acompanhante', 'jovem_baixa_renda')
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
                                   and tt.permite_meia and tt.price > 0 and tt.type not in ('mesa', 'coletiva'))) then
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
                                             'taxa', public.evk_taxa_centavos(v_cent, l.meia_tipo is not null));
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
    from jsonb_to_recordset(v_itens) y(tt uuid, meia_tipo text, q int, cent bigint, taxa bigint); -- a ordem do array é a ordem de trava
  return jsonb_build_object('order_id', v_order, 'expira_em', v_expira, 'agora', now(), 'meias', v_meias); -- 'agora' para a contagem do navegador não depender do relógio dele
end;
$$;
revoke execute on function public.reservar_assentos(uuid, text[], jsonb) from public, anon, authenticated;
grant execute on function public.reservar_assentos(uuid, text[], jsonb) to authenticated;

-- 3. Verificação -------------------------------------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.reservar_assentos(uuid, text[])') is not null then
    raise exception 'a assinatura antiga reservar_assentos(uuid, text[]) ainda existe';
  end if;
  if has_function_privilege('anon', 'public.reservar_assentos(uuid, text[], jsonb)', 'execute')
     or has_function_privilege('public', 'public.reservar_assentos(uuid, text[], jsonb)', 'execute')
     or not has_function_privilege('authenticated', 'public.reservar_assentos(uuid, text[], jsonb)', 'execute') then
    raise exception 'EXECUTE de reservar_assentos fora do esperado (só authenticated)';
  end if;
  if not (select prosecdef from pg_proc where oid = 'public.reservar_assentos(uuid, text[], jsonb)'::regprocedure)
     or not exists (select 1 from pg_proc where oid = 'public.reservar_assentos(uuid, text[], jsonb)'::regprocedure and proconfig = array['search_path=""']) then
    raise exception 'reservar_assentos sem security definer ou sem search_path vazio';
  end if;
  if position('20261030c' in pg_get_functiondef('public.order_items_estoque_guard()'::regprocedure)) = 0
     or has_function_privilege('authenticated', 'public.order_items_estoque_guard()', 'execute')
     or has_function_privilege('anon', 'public.order_items_estoque_guard()', 'execute') then
    raise exception 'order_items_estoque_guard sem a marca 20261030c ou com EXECUTE para o navegador';
  end if;
end $$;

commit;

-- =============================================================================
-- DESFAZER (antes da 1ª venda de meia em lugar marcado): recriar order_items_estoque_guard com o texto do 20261030a (md5 3641e118…) e
-- reservar_assentos com 20261008_assento_reserva.sql (l.132-246):
--   drop function if exists public.reservar_assentos(uuid, text[], jsonb);  -- depois rodar o create or replace do 20261008 e o grant
-- =============================================================================
