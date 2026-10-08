-- =============================================================================
-- Tela 06, fatia 2: venda no servidor com meia-entrada, taxa, cupom e reserva de 10 min. 2026-10-30 (NÃO aplicado)
-- ATENÇÃO: este arquivo NÃO é "aditivo" para quem compra. Assim que entrar em produção: (1) a inteira passa a vender só até
-- lotação - ceil(40%) enquanto houver meia a vender (a cota fica guardada para a meia); (2) o front ANTIGO não vende meia e
-- não consegue mais gravar pedido com cupom, desconto ou reserva (RESTRICTIVE); (3) tipo pago sem max_per_order passa a ter
-- teto de 10 por pedido (fora lugar marcado). ORDEM: o Ricardo aplica o A -> o front novo é publicado LOGO em seguida -> o B
-- (20261030b_fechar_insert_navegador.sql) só depois. Produção hoje: 0 ingressos emitidos e 1 pedido, a janela é aceitável.
-- CPF PRESO À CONTA (decisão do Ricardo): profiles.cpf_compra_hmac (só hash, nunca o CPF). Em reservar_ingressos, se algum tipo
-- do pedido tem max_por_cpf, p_cpf é obrigatório e válido; sem hash na conta, o primeiro uso grava pr7_hmac(p_cpf) na mesma
-- transação da reserva (se a reserva falhar, nada fica preso); com hash, p_cpf precisa bater, senão {ok:false,
-- motivo:'cpf_da_conta'} com mensagem fixa que não diz qual é o CPF. A conferência da conta vem ANTES de qualquer consulta a
-- orders por CPF, então uma conta travada só consegue testar o CPF dela. O suporte destrava com admin_limpar_cpf_compra(uid).
-- CONTRATO DE reservar_ingressos (o front PRECISA checar `ok`): depois de gravar o hash da conta a função não levanta mais
-- exceção de regra de negócio; devolve {ok:false, motivo, mensagem} com motivo 'cupom_invalido' | 'cpf_da_conta' |
-- 'indisponivel' (pedido com tipo de limite por CPF: UMA resposta para qualquer falha, inclusive quantidade e estoque, para não
-- haver oráculo) | 'regra' (demais pedidos; mensagem = texto da regra). Sucesso: {ok:true, order_id, ...}. Exceção continua só para
-- erro de entrada (JSON/itens inválidos, não logado, 2FA, evento indisponível, CPF ausente ou inválido, "Muitas tentativas").
-- Cada conta sonda no máximo 1 CPF (o hash é gravado ANTES da subtransação e fica mesmo se a reserva falhar).
-- Risco que resta: quem cria contas novas prende um CPF de terceiro em cada uma (1 sonda por conta); o limite por IP/Edge
-- Function continua pendente (20261028). A coluna não é lida nem escrita por anon/authenticated. A anonimização da conta (pr7_anonimizar_pii, texto de produção em
-- 20261007_pr7_cripto_passo2.sql, md5 21483c3e…) é recriada aqui com UMA linha a mais que zera profiles.cpf_compra_hmac (marca
-- 'cpf_compra_hmac (20261030)'). Pré-requisito: o passo 2 do PR 7 aplicado (a checagem prévia aborta sem ele). Mudanças:
-- 1. Colunas: ticket_types.permite_meia (padrão true; UPDATE para authenticated: o produtor liga e desliga); order_items.beneficio
--    ('inteira'|'meia'), meia_tipo, taxa_unit; orders.reservado_ate. tickets NÃO ganha coluna: a portaria lê o benefício por
--    order_item_id. Tabela beneficios_uf (benefício estadual por UF), vazia, RLS ligada, SELECT para anon.
--    Benefícios nacionais fixos na reservar_ingressos: estudante, pcd, pcd_acompanhante, jovem_baixa_renda. Estadual só vale se
--    existir em beneficios_uf para a UF do evento (events.venue_state).
--    permite_meia = false em mesa e coletiva (UPDATE nos existentes; o guard também recusa). VIP TEM meia (decisão do Ricardo).
-- 2. evk_taxa_centavos(bigint, boolean) e evk_preco_meia(bigint): sem grant (só as funções abaixo usam).
--    Meia = floor(preço/2) em centavos, piso de 1 centavo. Taxa = 10%, mínimo R$ 3 por ingresso, 0 se o valor é 0 (espelha
--    app/src/lib/taxa.ts). Plano B da taxa na meia (sem o piso de R$ 3): trocar a linha marcada PISO_MEIA por 0.
-- 3. order_items_estoque_guard recriada a partir da definição de PRODUÇÃO (md5 783677ce…), preservando a cláusula de
--    pedido_assentos e a marca 'limite por CPF (20261028)'; marca nova 'meia (20261030)': (a) pedido pendente "vivo" =
--    reservado_ate no futuro; sem reservado_ate, a regra antiga (30 min, 10 com assento vivo); (b) cota de meia por tipo
--    = ceil(40% da lotação); item meia exige permite_meia, preço > 0, tipo fora de mesa/coletiva e fora do mapa de lugares,
--    meia_tipo preenchido, e não passa de cota - meias ocupadas ("Restam N meias neste ingresso"); inteira só vende até
--    lotação - max(0, cota - meias ocupadas). Lotação 0 = sem teto, meia sem teto. Cada ticket_type é o seu próprio grupo
--    (a fatia 3 traz o grupo). Tipo de lugar marcado: sem meia e sem reserva de cota (reservar_assentos não grava benefício;
--    ver relatório).
-- 4. confirmar_pedido_gratis recriada a partir de PRODUÇÃO (md5 e949efce…), preservando 'limite por CPF (20261028)': aceita
--    pedido COM CUPOM de total 0 (cupom de 100%: item de preço > 0, desconto no pedido) e recusa reserva vencida.
--    Sem cupom nada muda (item e tipo de preço 0, total 0).
-- 5. vitrine_ingressos(evento): por tipo ativo, preço, taxa, meia, disponíveis; sem dado pessoal; mesmo filtro de acesso
--    da página do evento (evento_acesso aberto/link, publicado e aprovado).
-- 6. reservar_ingressos(evento, itens, cupom, cpf): a ÚNICA porta de compra nova. Tudo em centavos (bigint) calculado no
--    servidor; reserva de 10 min fixos; no máximo 10 reservas por conta e evento por hora; a reserva anterior da conta
--    no evento é cancelada; e-mail do JWT; NÃO copia CPF nem telefone do perfil (CPF só se o tipo tem max_por_cpf).
--    CUPOM: não vale na meia; pedido só de meias com cupom é recusado; no misto o desconto é só nas inteiras.
--    RATEIO DO DESCONTO (determinístico, em centavos): D = desconto nominal (percentual: floor(base * % / 100); fixo: valor
--    * 100; limitado a max_discount e à base; base = subtotal das inteiras). Cada ingresso inteiro recebe
--    floor(D * preço_do_ingresso / base) centavos (proporcional ao preço, para baixo). O desconto efetivo do pedido é a soma
--    disso (pode ficar até N-1 centavos abaixo de D, N = ingressos inteiros; sempre a favor da casa). Cupom de 100% dá
--    exatamente o preço de cada ingresso.
--    TAXA (decisão do Ricardo, 30/10): sobre o preço COM desconto do ingresso: evk_taxa_centavos(preço - desconto do
--    ingresso); ingresso que fica em 0 não paga taxa. Mudar a regra = uma linha, marcada TAXA_BASE na função.
--    min_order_value do cupom é conferido contra o subtotal das inteiras (a base do desconto): suposição, ver relatório.
--    Pedido de total 0 nasce 'pending' e o front segue com confirmar_pedido_gratis.
-- 7. Políticas RESTRICTIVE de INSERT (authenticated): orders sem reservado_ate, cupom e desconto; order_items só inteira ao
--    preço do tipo, sem meia_tipo e sem taxa_unit, e SÓ em pedido sem reservado_ate e sem coupon_id (função auxiliar
--    pedido_do_navegador, porque authenticated não lê reservado_ate): fecha o ataque de injetar item num pedido de cupom de
--    total 0 e pedir confirmar_pedido_gratis. Defesa em 2 camadas: confirmar_pedido_gratis, no ramo com cupom, exige que NENHUM
--    item tenha taxa_unit nula (todo item de reservar_ingressos tem; item de INSERT direto não), soma dos itens = subtotal e
--    subtotal - desconto + taxa = 0. reservar_ingressos, reservar_assentos e os gatilhos são SECURITY DEFINER (dono postgres).
-- 8. Limites contra negação de estoque: teto por pedido também para tipo pago (coalesce(max_per_order, 10), fora lugar marcado);
--    teto de 20 ingressos vivos por conta e evento; no máximo 10 reservas por conta e evento por hora (canceladas contam).
-- 9. Cupom e CPF: recusa de cupom (qualquer motivo, UMA mensagem) e de limite por CPF NÃO levantam exceção: a reserva da conta
--    é preservada (a tentativa roda numa subtransação desfeita), a tentativa é gravada em tentativas_reserva (sem acesso do
--    navegador; >1 dia é apagada na própria função) e o retorno é {ok:false, motivo:'cupom_invalido'|'indisponivel'}. Quem tem
--    10 tentativas falhas na última hora recebe "Muitas tentativas". Limite por CPF e "já comprou" têm o mesmo motivo
--    'indisponivel'. Cupom: UNIQUE(code) e UNIQUE(upper(code)) já existem em coupons, então a busca por upper(code) é
--    determinística; order by id limit 1 só por segurança.
-- 11. CPF preso à conta e admin_limpar_cpf_compra (ver acima). Reaplicar 20261018b_admin_s4b_colunas.sql abortará (coluna nova
--     em profiles fora das listas): classificar cpf_compra_hmac como RETIDA.
-- 10. Gatilho ticket_types_sem_meia_mesa: mesa e coletiva sempre permite_meia=false (INSERT e UPDATE).
--     UPDATE de tabela de authenticated e anon em orders e order_items é revogado (o front só lê; sem política de UPDATE nada
--     mudava; grep em app/src confere).
-- REAPLICAR ARQUIVOS ANTIGOS: o bloco 0 de 20261027_ticket_types_grants_por_coluna.sql abortará (coluna nova permite_meia):
--    pôr permite_meia na lista e no grant se for reaplicado. A conferência da E4 (20261011) também abortará com reservado_ate
--    (e as colunas novas de order_items): classificar como RETIDAS se for reaplicada. authenticated NÃO lê reservado_ate,
--    meia_tipo nem taxa_unit (sem SELECT por coluna novo); o front lê pelo retorno da reservar_ingressos.
-- ORDEM: 0) 20261028_limite_por_cpf aplicado (o bloco 0 confere); 1) este arquivo; 2) front; 3) arquivo B.
-- Como aplicar: colar inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA TextEdit). Uma transação, idempotente.
-- Testes: supabase/tests/venda_servidor_meia.test.sql e supabase/tests/corrida_meia.sh (só em banco descartável). NÃO mover para supabase/migrations/.
-- ponytail: admin_limpar_cpf_compra grava em admin_audit_log só se a S5 (20261016) estiver aplicada; sem ela não há trilha.
-- ponytail: reserva de 10/hora e contagem de usos do cupom por contagem de pedidos (nada incrementa coupons.uses hoje).
-- ponytail: pedido pendente pago depois de reservado_ate (Pix lento) não revalida estoque aqui: é assunto do gateway (Fase 4).
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 0. Pré-requisitos (abortam) ------------------------------------------------------------------------------------------
do $$
declare d text;
begin
  if to_regclass('public.orders') is null or to_regclass('public.order_items') is null or to_regclass('public.ticket_types') is null
     or to_regclass('public.pedido_assentos') is null or to_regclass('public.coupons') is null or to_regclass('public.events') is null then
    raise exception 'faltam orders, order_items, ticket_types, pedido_assentos, coupons ou events';
  end if;
  if to_regprocedure('public.pr7_hmac(text)') is null or to_regprocedure('public.gf_mfa_ok()') is null
     or to_regprocedure('public.tipo_no_mapa(uuid)') is null or to_regprocedure('public.evento_acesso(uuid)') is null
     or to_regprocedure('public.mesa_pedido_guard()') is null then
    raise exception 'faltam pr7_hmac, gf_mfa_ok, tipo_no_mapa, evento_acesso ou mesa_pedido_guard';
  end if;
  if to_regprocedure('public.pr7_anonimizar_pii(uuid)') is null then
    raise exception 'falta pr7_anonimizar_pii (20261007_pr7_cripto_passo2)';
  end if;
  if md5(pg_get_functiondef('public.pr7_anonimizar_pii(uuid)'::regprocedure)) not in ('21483c3e14d146da97a2726ec6230244', 'a76ffc7d7b2f3891b0429dfb60e0eedf') then
    raise exception 'pr7_anonimizar_pii mudou desde a leitura de produção (md5 %): refazer a partir da definição atual', md5(pg_get_functiondef('public.pr7_anonimizar_pii(uuid)'::regprocedure));
  end if;
  if to_regprocedure('public.meu_perfil()') is null
     or md5(pg_get_functiondef('public.meu_perfil()'::regprocedure)) not in ('fd251ac3ff81011aea3ece502c80eeec', '22aeaa9984bf5ce478026e9f5e070c89') then
    raise exception 'meu_perfil ausente ou mudou desde a leitura de produção (md5 fd251ac3…): refazer a partir da definição atual';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'orders_cpf_hash' and tgrelid = 'public.orders'::regclass) then
    raise exception 'falta o gatilho orders_cpf_hash (20261028_limite_por_cpf)';
  end if;
  d := pg_get_functiondef('public.order_items_estoque_guard()'::regprocedure);
  if md5(d) not in ('783677ce59ef02906bd27752455f5fbb', '3641e118aeaf0f2b64acaeb314938fe3') then
    raise exception 'order_items_estoque_guard mudou desde a leitura de produção (md5 %): refazer a partir da definição atual', md5(d);
  end if;
  d := pg_get_functiondef('public.confirmar_pedido_gratis(uuid)'::regprocedure);
  if md5(d) not in ('e949efceff9e652de092c9a8525242c3', 'aaf268ebd776b07fd0802a07d72cc9dd') then
    raise exception 'confirmar_pedido_gratis mudou desde a leitura de produção (md5 %): refazer a partir da definição atual', md5(d);
  end if;
end $$;

-- 1. Colunas e tabela ---------------------------------------------------------------------------------------------------
alter table public.ticket_types add column if not exists permite_meia boolean not null default true;
-- ponytail: vip fica com permite_meia true (decisão do Ricardo, 30/10: VIP tem meia); só mesa e coletiva não têm.
update public.ticket_types set permite_meia = false where type in ('mesa', 'coletiva') and permite_meia;
grant update (permite_meia) on public.ticket_types to authenticated;

alter table public.order_items add column if not exists beneficio text not null default 'inteira';
alter table public.order_items add column if not exists meia_tipo text;
alter table public.order_items add column if not exists taxa_unit numeric(10, 2);
alter table public.order_items drop constraint if exists order_items_beneficio_check;
alter table public.order_items add constraint order_items_beneficio_check check (beneficio in ('inteira', 'meia'));
alter table public.order_items drop constraint if exists order_items_meia_tipo_check;
alter table public.order_items add constraint order_items_meia_tipo_check check ((beneficio = 'meia') = (meia_tipo is not null));
alter table public.order_items drop constraint if exists order_items_taxa_unit_check;
alter table public.order_items add constraint order_items_taxa_unit_check check (taxa_unit >= 0);
alter table public.orders add column if not exists reservado_ate timestamptz;
create index if not exists orders_reserva_conta_evento_idx on public.orders (user_id, event_id, created_at) where reservado_ate is not null;

create table if not exists public.tentativas_reserva (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  quando timestamptz not null default now(),
  motivo text not null
);
create index if not exists tentativas_reserva_user_idx on public.tentativas_reserva (user_id, quando);
create index if not exists tentativas_reserva_quando_idx on public.tentativas_reserva (quando);
alter table public.tentativas_reserva enable row level security;
revoke all on table public.tentativas_reserva from public, anon, authenticated;

create or replace function public.ticket_types_sem_meia_mesa()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.type in ('mesa', 'coletiva') then new.permite_meia := false; end if;
  return new;
end;
$$;
revoke all on function public.ticket_types_sem_meia_mesa() from public, anon, authenticated;
drop trigger if exists ticket_types_sem_meia_mesa on public.ticket_types;
create trigger ticket_types_sem_meia_mesa before insert or update of type, permite_meia on public.ticket_types
  for each row execute function public.ticket_types_sem_meia_mesa();

-- o front só lê orders e order_items (sem política de UPDATE nada mudava); fecha também o grant
revoke update on table public.orders, public.order_items from anon, authenticated;

alter table public.profiles add column if not exists cpf_compra_hmac text;
-- Sem SELECT, INSERT e UPDATE para anon/authenticated. Se o papel tem o privilégio na TABELA inteira, troca por privilégio nas
-- demais colunas (revoke de coluna não vale sobre grant de tabela); se já é por coluna (S4b), a coluna nova nasce sem grant.
do $$
declare r text; p text; c text;
begin
  select string_agg(quote_ident(a.attname), ', ') into c from pg_attribute a
   where a.attrelid = 'public.profiles'::regclass and a.attnum > 0 and not a.attisdropped and a.attname <> 'cpf_compra_hmac';
  foreach r in array array['anon', 'authenticated'] loop
    foreach p in array array['select', 'insert', 'update'] loop
      if has_table_privilege(r, 'public.profiles', p) then
        execute format('revoke %s on table public.profiles from %I', p, r);
        execute format('grant %s (%s) on public.profiles to %I', p, c, r);
      end if;
    end loop;
  end loop;
end $$;

create or replace function public.admin_limpar_cpf_compra(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.gf_is_admin() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  update public.profiles set cpf_compra_hmac = null where id = p_uid;
  if not found then
    raise exception 'Conta não encontrada' using errcode = '22023';
  end if;
  -- trilha de admin da S5 (20261016), se já aplicada; sem ela só fica o `ponytail:` do cabeçalho
  if to_regclass('public.admin_audit_log') is not null then
    execute 'insert into public.admin_audit_log (autor, tipo, acao, tabela, objeto_id) values ($1, ''acao'', ''limpar_cpf_compra'', ''profiles'', $2)'
      using auth.uid(), p_uid::text;
  end if;
end;
$$;
revoke all on function public.admin_limpar_cpf_compra(uuid) from public, anon, authenticated;
grant execute on function public.admin_limpar_cpf_compra(uuid) to authenticated;

create table if not exists public.beneficios_uf (
  uf char(2) not null,
  codigo text not null,
  nome text not null,
  documento text not null,
  primary key (uf, codigo)
);
alter table public.beneficios_uf enable row level security;
revoke all on table public.beneficios_uf from public, anon, authenticated;
grant select on table public.beneficios_uf to anon, authenticated;
drop policy if exists "Benefícios estaduais são públicos" on public.beneficios_uf;
create policy "Benefícios estaduais são públicos" on public.beneficios_uf for select to anon, authenticated using (true);

-- 2. Preço da meia e taxa ---------------------------------------------------------------------------------------------
create or replace function public.evk_preco_meia(p_cent bigint)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select case when coalesce(p_cent, 0) <= 0 then 0 else greatest(p_cent / 2, 1) end -- bigint / bigint arredonda para baixo
$$;
revoke all on function public.evk_preco_meia(bigint) from public, anon, authenticated;

-- espelho de app/src/lib/taxa.ts (taxaCentavos): 10%, mínimo R$ 3 por ingresso, 0 se o valor é 0
create or replace function public.evk_taxa_centavos(p_cent bigint, p_meia boolean default false)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select case when coalesce(p_cent, 0) <= 0 then 0
              else greatest(round(p_cent * 10 / 100.0)::bigint, case when p_meia then 300 /*PISO_MEIA*/ else 300 end) end
$$;
revoke all on function public.evk_taxa_centavos(bigint, boolean) from public, anon, authenticated;

-- 3. Guard de estoque (produção + limite por CPF + meia) ----------------------------------------------------------------
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
  -- também não (a meia por assento depende de reservar_assentos, fatia 3). Quem não tem meia não segura cota.
  v_mapa := public.tipo_no_mapa(new.ticket_type_id);
  v_meia_ok := v_permite and v_tipo not in ('mesa', 'coletiva') and v_preco > 0;
  if new.beneficio = 'meia' then
    if not v_meia_ok then
      raise exception 'Este ingresso não tem meia-entrada' using errcode = '22023';
    end if;
    if v_mapa then
      raise exception 'Meia-entrada em lugar marcado ainda não está disponível' using errcode = '22023';
    end if;
    if new.meia_tipo is null then
      raise exception 'Informe o tipo de meia-entrada' using errcode = '22023';
    end if;
  end if;
  if v_lotacao = 0 then
    return new; -- sem lotação não se afirma esgotado (e a meia fica sem teto)
  end if;
  v_cota := case when v_meia_ok and not v_mapa then (v_lotacao * 4 + 9) / 10 else 0 end; -- ceil(40% da lotação do tipo); cada tipo é o seu grupo (fatia 3 traz o grupo)
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
  v_reserva := greatest(v_cota - v_meias, 0);
  if new.beneficio = 'meia' and v_meias + new.quantity > v_cota then
    raise exception 'Restam % meias neste ingresso', v_reserva using errcode = '22023';
  end if;
  v_limite := v_lotacao - case when new.beneficio = 'meia' then 0 else v_reserva end; -- a inteira não come as vagas guardadas para a meia
  if v_sold + v_reservado + new.quantity > v_limite then
    raise exception 'Ingressos esgotados ou insuficientes (restam %)', greatest(v_limite - v_sold - v_reservado, 0) using errcode = '22023';
  end if;
  return new;
end;
$function$;

revoke execute on function public.order_items_estoque_guard() from public, anon, authenticated;

-- 4. Pedido gratuito (produção + limite por CPF + cupom de 100%) --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirmar_pedido_gratis(p_order uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  o public.orders%rowtype;
  v_nome text;
  v_email text;
  n int := 0;
  esperado int;
  it record;
  v_motivo text;
begin
  select * into o from public.orders where id = p_order and user_id = auth.uid() and status = 'pending' for update;
  if not found then
    raise exception 'Pedido não encontrado ou já processado' using errcode = '22023';
  end if;
  if o.created_at <= now() - interval '30 minutes' then
    raise exception 'Pedido expirado, volte ao evento e escolha de novo' using errcode = '22023';
  end if;
  -- meia (20261030): reserva do servidor vencida não vira ingresso (o estoque já foi liberado)
  if o.reservado_ate is not null and o.reservado_ate <= now() then
    raise exception 'Reserva expirada, volte ao evento e escolha de novo' using errcode = '22023';
  end if;
  -- trava os itens e depois os tipos (por id, sem impasse) ANTES de conferir qualquer coisa
  perform 1 from public.order_items where order_id = o.id for update;
  perform 1 from public.ticket_types where id in (select ticket_type_id from public.order_items where order_id = o.id) order by id for update;
  select coalesce(sum(quantity), 0) into esperado from public.order_items where order_id = o.id;
  if esperado = 0 then
    raise exception 'Pedido sem itens' using errcode = '22023';
  end if;
  -- meia (20261030): pedido com cupom (coupon_id só nasce em reservar_ingressos; o navegador não consegue gravar) pode ter
  -- item de preço > 0 e total 0 (cupom de 100%); sem cupom, continua exigindo item e tipo de preço 0
  if o.total <> 0 or (o.coupon_id is null and exists (
       select 1 from public.order_items oi join public.ticket_types tt on tt.id = oi.ticket_type_id
        where oi.order_id = o.id and (oi.unit_price <> 0 or tt.price <> 0)))
     or (o.coupon_id is not null and (
         exists (select 1 from public.order_items oi where oi.order_id = o.id and oi.taxa_unit is null) -- item de INSERT direto
         or (select coalesce(sum(oi.unit_price * oi.quantity), 0) from public.order_items oi where oi.order_id = o.id) <> o.subtotal
         or o.subtotal - o.discount + o.service_fee <> 0)) then
    raise exception 'Pedido não é gratuito' using errcode = '22023';
  end if;
  if exists (select 1 from public.order_items oi where oi.order_id = o.id and not public.pode_comprar(o.id, oi.ticket_type_id)) then
    raise exception 'Evento indisponível para compra' using errcode = '22023';
  end if;
  for it in select distinct oi.ticket_type_id from public.order_items oi where oi.order_id = o.id loop
    v_motivo := public.venda_bloqueada(it.ticket_type_id);
    if v_motivo is not null then raise exception '%', v_motivo using errcode = '22023'; end if;
  end loop;

  -- limite por conta: ingressos já comprados (pedidos 'paid') + os deste pedido, por tipo (tipos já travados acima)
  for it in select tt.name, coalesce(tt.max_per_order, 10) as teto, a.q + coalesce((
                select sum(oi2.quantity) from public.order_items oi2 join public.orders o2 on o2.id = oi2.order_id
                 where o2.user_id = o.user_id and o2.status = 'paid' and oi2.ticket_type_id = a.ticket_type_id), 0) as total
              from (select oi.ticket_type_id, sum(oi.quantity) as q from public.order_items oi where oi.order_id = o.id group by 1) a
              join public.ticket_types tt on tt.id = a.ticket_type_id loop
    if it.total > it.teto then
      raise exception 'Limite de % ingressos por pessoa em "%": você já tem % (com este pedido)', it.teto, it.name, it.total using errcode = '22023';
    end if;
  end loop;

  -- limite por CPF (20261028): pedidos 'paid' do mesmo CPF (qualquer conta) + este pedido; mensagem sem contagem
  for it in select tt.max_por_cpf as teto, a.q + coalesce((
                select sum(oi2.quantity) from public.order_items oi2 join public.orders o2 on o2.id = oi2.order_id
                 where o2.customer_cpf_hmac = o.customer_cpf_hmac and o2.status = 'paid' and oi2.ticket_type_id = a.ticket_type_id), 0) as total
              from (select oi.ticket_type_id, sum(oi.quantity) as q from public.order_items oi where oi.order_id = o.id group by 1) a
              join public.ticket_types tt on tt.id = a.ticket_type_id
             where tt.max_por_cpf is not null loop
    if o.customer_cpf_hmac is null then
      raise exception 'Informe o CPF do comprador para este ingresso' using errcode = '22023';
    end if;
    if it.total > it.teto then
      raise exception 'Limite de % ingressos por CPF neste ingresso', it.teto using errcode = '22023';
    end if;
  end loop;

  select coalesce(nullif(o.customer_name, ''), nullif(p.full_name, ''), nullif(u.raw_user_meta_data->>'full_name', ''), ''),
         coalesce(nullif(o.customer_email, ''), nullif(p.email, ''), nullif(u.email, ''), '')
    into v_nome, v_email
    from (select 1) d
    left join public.profiles p on p.id = o.user_id
    left join auth.users u on u.id = o.user_id;
  for it in select oi.id, oi.ticket_type_id, oi.quantity from public.order_items oi
              join public.ticket_types tt on tt.id = oi.ticket_type_id
             where oi.order_id = o.id and (o.coupon_id is not null or (oi.unit_price = 0 and tt.price = 0)) loop
    update public.ticket_types tt set sold = coalesce(tt.sold, 0) + it.quantity, quantity_sold = coalesce(tt.quantity_sold, 0) + it.quantity
     where tt.id = it.ticket_type_id
       and (case when coalesce(tt.quantity_total, 0) > 0 then tt.quantity_total
                 when coalesce(tt.capacity, 0) > 0 then tt.capacity else null end is null
            or coalesce(tt.sold, 0) + it.quantity <= case when coalesce(tt.quantity_total, 0) > 0 then tt.quantity_total else tt.capacity end);
    if not found then
      raise exception 'Ingressos esgotados' using errcode = '22023';
    end if;
    insert into public.tickets (order_item_id, order_id, ticket_type_id, event_id, user_id, buyer_name, buyer_email, status)
    select it.id, o.id, it.ticket_type_id, o.event_id, o.user_id, v_nome, v_email, 'active'
      from generate_series(1, it.quantity);
    n := n + it.quantity;
  end loop;
  if n <> esperado then
    raise exception 'Emissão incompleta (% de %)', n, esperado using errcode = '22023';
  end if;
  update public.orders set status = 'paid' where id = o.id;
  return n;
end;
$function$;

revoke execute on function public.confirmar_pedido_gratis(uuid) from public, anon, authenticated;
grant execute on function public.confirmar_pedido_gratis(uuid) to authenticated;

-- 4b. Anonimização da conta (texto de produção + zerar cpf_compra_hmac) ----------------------------------------------------
create or replace function public.pr7_anonimizar_pii(p_uid uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.producer_profiles
    set cnpj_enc = null, cnpj_hmac = null, pix_key_enc = null, bank_account_enc = public.pr7_enc('{}')
    where id = p_uid;
  update public.withdrawals
    set pix_key_enc = null, bank_account_enc = public.pr7_enc('{}')
    where producer_id = p_uid;
  update public.platform_affiliates set cpf_enc = null, cpf_hmac = null where user_id = p_uid;
  update public.profiles set cpf_enc = null where id = p_uid;
  update public.profiles set cpf_compra_hmac = null where id = p_uid; -- cpf_compra_hmac (20261030)
end $$;
revoke all on function public.pr7_anonimizar_pii(uuid) from public, anon, authenticated, service_role;
grant execute on function public.pr7_anonimizar_pii(uuid) to service_role;

-- 4c. meu_perfil (texto de produção, 20261007_pr7_cripto_passo2.sql:606) sem cpf_compra_hmac ----------------------------------
create or replace function public.meu_perfil()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(p) - array['cpf_enc', 'stripe_customer_id', 'cpf_compra_hmac'] -- cpf_compra_hmac (20261030)
  from public.profiles p
  where p.id = (select auth.uid())
    and public.gf_mfa_ok(); -- a mesma regra RESTRICTIVE gf_mfa_aal2 da tabela
$$;
alter function public.meu_perfil() owner to postgres;
revoke all on function public.meu_perfil() from public, anon;
grant execute on function public.meu_perfil() to authenticated;

-- 5. Vitrine ------------------------------------------------------------------------------------------------------------
-- Mesma conta do guard, só leitura. Preço/taxa em reais; disponiveis e meias_disponiveis nulos = tipo sem lotação (sem teto).
create or replace function public.vitrine_ingressos(p_event_id uuid)
returns table (
  ticket_type_id uuid, nome text, preco numeric, taxa numeric, preco_meia numeric, taxa_meia numeric,
  permite_meia boolean, disponiveis int, meias_disponiveis int, meias_total int)
language sql
stable
security definer
set search_path = ''
as $$
  select x.id, x.name, x.cent / 100.0, public.evk_taxa_centavos(x.cent) / 100.0,
         case when x.meia_ok then public.evk_preco_meia(x.cent) / 100.0 end,
         case when x.meia_ok then public.evk_taxa_centavos(public.evk_preco_meia(x.cent), true) / 100.0 end,
         x.meia_ok,
         case when x.lot > 0 then greatest(x.lot - x.sold - x.res - greatest(x.cota - x.meias, 0), 0)::int end,
         case when x.meia_ok then case when x.lot > 0 then greatest(least(x.cota - x.meias, x.lot - x.sold - x.res), 0)::int end else 0 end,
         case when x.meia_ok and x.lot > 0 then x.cota else 0 end
    from (
      select tt.id, tt.name, tt.sort_order, tt.created_at, round(tt.price * 100)::bigint as cent,
             case when coalesce(tt.quantity_total, 0) > 0 then tt.quantity_total when coalesce(tt.capacity, 0) > 0 then tt.capacity else 0 end as lot,
             coalesce(tt.sold, 0) as sold,
             (tt.permite_meia and tt.type not in ('mesa', 'coletiva') and tt.price > 0 and not public.tipo_no_mapa(tt.id)) as meia_ok,
             (select coalesce(sum(oi.quantity), 0) from public.order_items oi join public.orders o on o.id = oi.order_id
               where oi.ticket_type_id = tt.id and o.status = 'pending'
                 and coalesce(o.reservado_ate > now(), o.created_at > now() - case when exists (select 1 from public.pedido_assentos pa where pa.order_id = o.id and pa.liberada_em is null)
                                     then interval '10 minutes' else interval '30 minutes' end))::int as res,
             (select coalesce(sum(oi.quantity), 0) from public.order_items oi join public.orders o on o.id = oi.order_id
               where oi.ticket_type_id = tt.id and oi.beneficio = 'meia' and (o.status = 'paid' or (o.status = 'pending'
                 and coalesce(o.reservado_ate > now(), o.created_at > now() - case when exists (select 1 from public.pedido_assentos pa where pa.order_id = o.id and pa.liberada_em is null)
                                     then interval '10 minutes' else interval '30 minutes' end))))::int as meias,
             case when (tt.permite_meia and tt.type not in ('mesa', 'coletiva') and tt.price > 0 and not public.tipo_no_mapa(tt.id))
                  then ((case when coalesce(tt.quantity_total, 0) > 0 then tt.quantity_total when coalesce(tt.capacity, 0) > 0 then tt.capacity else 0 end) * 4 + 9) / 10
                  else 0 end as cota
        from public.ticket_types tt
       where tt.event_id = p_event_id and tt.is_active
         and public.evento_acesso(p_event_id) in ('aberto', 'link')
         and exists (select 1 from public.events e where e.id = p_event_id and e.status = 'published' and e.approval_status = 'approved')
    ) x
   order by x.sort_order nulls last, x.created_at;
$$;
revoke all on function public.vitrine_ingressos(uuid) from public, anon, authenticated;
grant execute on function public.vitrine_ingressos(uuid) to anon, authenticated;

-- 6. Reserva no servidor ------------------------------------------------------------------------------------------------
create or replace function public.pedido_do_navegador(p_order uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.orders o where o.id = p_order and o.reservado_ate is null and o.coupon_id is null);
$$;
revoke all on function public.pedido_do_navegador(uuid) from public, anon, authenticated;
grant execute on function public.pedido_do_navegador(uuid) to authenticated;

create or replace function public.reservar_ingressos(p_event_id uuid, p_itens jsonb, p_cupom text default null, p_cpf text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set lock_timeout = '5s'
as $$
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
       or not (v_it.meia_tipo in ('estudante', 'pcd', 'pcd_acompanhante', 'jovem_baixa_renda')
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
    when sqlstate '22023' then
      -- regra de negócio (esgotado, tetos, meia, limite por CPF, ...): vira retorno, para o hash da conta (acima) não ser desfeito
      get stacked diagnostics v_msg = message_text;
      if v_cpf then
        -- pedido com tipo de limite por CPF: UMA resposta só, para a falha por CPF e as outras não se distinguirem (sem oráculo)
        v_motivo := 'indisponivel';
        v_mensagem := 'Não foi possível reservar. Confira quantidade e disponibilidade e tente de novo.';
      else
        v_motivo := 'regra';
        v_mensagem := v_msg;
      end if;
  end;
  if v_motivo is not null then
    if v_motivo <> 'regra' then -- só as recusas que sondam cupom ou CPF contam tentativa; esgotado e tetos não
      insert into public.tentativas_reserva (user_id, motivo) values (v_uid, v_motivo);
    end if;
    return jsonb_build_object('ok', false, 'motivo', v_motivo, 'mensagem', v_mensagem);
  end if;

  return jsonb_build_object(
    'ok', true, 'order_id', v_order, 'status', 'pending', 'subtotal', round(v_sub / 100.0, 2), 'desconto', round(v_desc / 100.0, 2),
    'taxa', round(v_taxa / 100.0, 2), 'total', round(v_total / 100.0, 2), 'reservado_ate', v_ate, 'agora', now(), 'itens', v_linhas,
    'aviso', case when v_cancel > 0 then 'Sua reserva anterior neste evento foi substituída por esta.' end);
end;
$$;
revoke all on function public.reservar_ingressos(uuid, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.reservar_ingressos(uuid, jsonb, text, text) to authenticated;

-- 7. O navegador não fabrica reserva, cupom, desconto, meia nem preço (RESTRICTIVE soma com as permissivas antigas) -------
drop policy if exists gf_orders_sem_reserva_falsa on public.orders;
create policy gf_orders_sem_reserva_falsa on public.orders as restrictive for insert to authenticated
  with check (reservado_ate is null and coupon_id is null and coalesce(discount, 0) = 0);
drop policy if exists gf_order_items_so_inteira on public.order_items;
create policy gf_order_items_so_inteira on public.order_items as restrictive for insert to authenticated
  with check (beneficio = 'inteira' and meia_tipo is null and taxa_unit is null and public.pedido_do_navegador(order_id)
              and unit_price = (select tt.price from public.ticket_types tt where tt.id = ticket_type_id));

-- 8. Conferências (abortam) ---------------------------------------------------------------------------------------------
do $$
declare r text; f text; c record;
begin
  if position('limite por CPF (20261028)' in pg_get_functiondef('public.order_items_estoque_guard()'::regprocedure)) = 0
     or position('meia (20261030)' in pg_get_functiondef('public.order_items_estoque_guard()'::regprocedure)) = 0
     or position('pedido_assentos' in pg_get_functiondef('public.order_items_estoque_guard()'::regprocedure)) = 0
     or position('limite por CPF (20261028)' in pg_get_functiondef('public.confirmar_pedido_gratis(uuid)'::regprocedure)) = 0
     or position('meia (20261030)' in pg_get_functiondef('public.confirmar_pedido_gratis(uuid)'::regprocedure)) = 0 then
    raise exception 'guard ou confirmar_pedido_gratis sem as marcas esperadas';
  end if;
  foreach r in array array['anon', 'authenticated'] loop
    foreach f in array array['public.evk_taxa_centavos(bigint, boolean)', 'public.evk_preco_meia(bigint)', 'public.order_items_estoque_guard()'] loop
      if has_function_privilege(r, f, 'execute') then raise exception '% pode executar %', r, f; end if;
    end loop;
  end loop;
  if not has_function_privilege('anon', 'public.vitrine_ingressos(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.vitrine_ingressos(uuid)', 'execute') then
    raise exception 'vitrine_ingressos: anon e authenticated precisam executar';
  end if;
  if has_function_privilege('anon', 'public.reservar_ingressos(uuid, jsonb, text, text)', 'execute')
     or not has_function_privilege('authenticated', 'public.reservar_ingressos(uuid, jsonb, text, text)', 'execute') then
    raise exception 'reservar_ingressos: só authenticated executa';
  end if;
  if has_function_privilege('anon', 'public.confirmar_pedido_gratis(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.confirmar_pedido_gratis(uuid)', 'execute') then
    raise exception 'EXECUTE de confirmar_pedido_gratis fora do esperado (só authenticated)';
  end if;
  if not has_column_privilege('authenticated', 'public.ticket_types', 'permite_meia', 'update') then
    raise exception 'authenticated sem UPDATE de permite_meia (o painel edita)';
  end if;
  if has_column_privilege('authenticated', 'public.orders', 'reservado_ate', 'select')
     or has_column_privilege('anon', 'public.orders', 'reservado_ate', 'select') then
    raise exception 'reservado_ate não deveria ser legível pelo navegador';
  end if;
  if exists (select 1 from public.ticket_types where type in ('mesa', 'coletiva') and permite_meia) then
    raise exception 'mesa/coletiva com permite_meia';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and permissive = 'RESTRICTIVE' and cmd = 'INSERT'
        and policyname in ('gf_orders_sem_reserva_falsa', 'gf_order_items_so_inteira')) <> 2 then
    raise exception 'faltam as políticas RESTRICTIVE de INSERT';
  end if;
  if has_function_privilege('anon', 'public.pedido_do_navegador(uuid)', 'execute') or has_table_privilege('authenticated', 'public.tentativas_reserva', 'select')
     or has_table_privilege('authenticated', 'public.orders', 'update') or has_table_privilege('authenticated', 'public.order_items', 'update')
     or not (select relrowsecurity from pg_class where oid = 'public.tentativas_reserva'::regclass) then
    raise exception 'privilégios de pedido_do_navegador, tentativas_reserva ou UPDATE de orders/order_items fora do esperado';
  end if;
  if position('cpf_compra_hmac (20261030)' in pg_get_functiondef('public.meu_perfil()'::regprocedure)) = 0
     or has_function_privilege('anon', 'public.meu_perfil()', 'execute') or not has_function_privilege('authenticated', 'public.meu_perfil()', 'execute') then
    raise exception 'meu_perfil sem a marca ou com EXECUTE fora do esperado (authenticated sim, anon não)';
  end if;
  if position('cpf_compra_hmac (20261030)' in pg_get_functiondef('public.pr7_anonimizar_pii(uuid)'::regprocedure)) = 0
     or not has_function_privilege('service_role', 'public.pr7_anonimizar_pii(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.pr7_anonimizar_pii(uuid)', 'execute') or has_function_privilege('anon', 'public.pr7_anonimizar_pii(uuid)', 'execute') then
    raise exception 'pr7_anonimizar_pii sem a marca ou com EXECUTE fora do esperado (só service_role)';
  end if;
  foreach r in array array['anon', 'authenticated'] loop
    foreach f in array array['select', 'insert', 'update'] loop
      if has_column_privilege(r, 'public.profiles', 'cpf_compra_hmac', f) then raise exception '% tem % em profiles.cpf_compra_hmac', r, f; end if;
    end loop;
  end loop;
  if has_function_privilege('anon', 'public.admin_limpar_cpf_compra(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.admin_limpar_cpf_compra(uuid)', 'execute') then
    raise exception 'EXECUTE de admin_limpar_cpf_compra fora do esperado';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.beneficios_uf'::regclass) then
    raise exception 'RLS desligada em beneficios_uf';
  end if;
  -- casos de app/src/test/taxa.test.ts (10%, mínimo R$ 3, gratuito 0), em centavos
  for c in select * from (values (0, 0), (1000, 300), (2999, 300), (3000, 300), (10000, 1000), (3333, 333), (3005, 301),
                                 (2000, 300), (5000, 500), (-1000, 0)) v(cent, esperado) loop
    if public.evk_taxa_centavos(c.cent) <> c.esperado then
      raise exception 'evk_taxa_centavos(%) deu %, esperado %', c.cent, public.evk_taxa_centavos(c.cent), c.esperado;
    end if;
  end loop;
  if public.evk_preco_meia(5000) <> 2500 or public.evk_preco_meia(5001) <> 2500 or public.evk_preco_meia(1) <> 1
     or public.evk_preco_meia(0) <> 0 then
    raise exception 'evk_preco_meia fora do esperado';
  end if;
  if exists (select 1 from public.vitrine_ingressos(gen_random_uuid())) then
    raise exception 'vitrine_ingressos devolveu linhas para evento inexistente';
  end if;
end $$;

commit;

-- =============================================================================
-- DESFAZER (antes da 1ª venda): recriar guard e confirmar_pedido_gratis com as definições de produção guardadas ANTES de
-- aplicar (md5 783677ce… e e949efce…); depois:
--   drop policy if exists gf_orders_sem_reserva_falsa on public.orders; drop policy if exists gf_order_items_so_inteira on public.order_items;
--   drop function if exists public.reservar_ingressos(uuid, jsonb, text, text); drop function if exists public.vitrine_ingressos(uuid);
--   drop function if exists public.evk_taxa_centavos(bigint, boolean); drop function if exists public.evk_preco_meia(bigint);
--   drop table if exists public.beneficios_uf; drop index if exists public.orders_reserva_conta_evento_idx;
--   alter table public.orders drop column if exists reservado_ate;
--   alter table public.order_items drop column if exists meia_tipo, drop column if exists taxa_unit, drop column if exists beneficio;
--   alter table public.ticket_types drop column if exists permite_meia;
--   (pr7_anonimizar_pii: recriar com o texto de produção, md5 21483c3e…)
--   drop function if exists public.admin_limpar_cpf_compra(uuid); alter table public.profiles drop column if exists cpf_compra_hmac;
--   drop table if exists public.tentativas_reserva; drop function if exists public.pedido_do_navegador(uuid);
--   drop trigger if exists ticket_types_sem_meia_mesa on public.ticket_types; drop function if exists public.ticket_types_sem_meia_mesa();
--   grant update on table public.orders, public.order_items to authenticated;  -- só se o baseline antigo for desejado
-- =============================================================================
