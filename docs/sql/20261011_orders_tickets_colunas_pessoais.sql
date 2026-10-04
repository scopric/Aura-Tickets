-- =============================================================================
-- E4 do plano rosy-discovering-fog (produtor, empatar com o mercado): CPF e telefone fora do alcance do produtor.
-- 04/10/2026. Tira o SELECT de orders.customer_cpf, orders.customer_phone e tickets.buyer_cpf de anon e authenticated.
-- Hoje o produtor lê a linha inteira dos pedidos e ingressos dos próprios eventos (regras "Produtores leem ...")
-- porque anon e authenticated têm SELECT na tabela inteira. A RLS escolhe linhas, não colunas: o corte é por grant.
--
-- ORDEM (obrigatória): (a) mesclar o PR do front (fix/produtor-e4-cpf-telefone), que troca todo select('*') e
-- .select() vazio de orders/tickets por colunas explícitas; (b) conferir que a Vercel publicou o main com ele;
-- (c) só então este SQL. Ao contrário, com o SQL antes do front, "Meus pedidos", "Meus ingressos", a compra
-- (insert ... returning *) e o Check-in dão 42501 (permission denied) até o front entrar.
--
-- Como aplicar: colar o arquivo inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA pelo TextEdit: erro 17).
-- Uma transação só: se a conferência do fim falhar, nada é gravado. Idempotente (pode rodar de novo).
-- `set local lock_timeout = '5s'`: se algo segurar orders ou tickets, o arquivo desiste sem gravar; rodar de novo.
-- NÃO mover para supabase/migrations/ (motivo no cabeçalho de 20260927_security_hardening.sql).
-- Teste: supabase/tests/orders_colunas_pessoais.test.sql (pgTAP; banco local, nunca em produção).
--
-- DECISÕES
-- 1. Grant por coluna, não view nem RPC: é a menor mudança que corta a coluna para todos os papéis da API de uma vez
--    (produtor, comprador e admin) sem mexer em nenhuma regra de RLS nem nas telas que já listam colunas.
-- 2. Listas FIXAS e explícitas (revisáveis no PR), não geradas do catálogo. A conferência aborta se a tabela tiver
--    coluna que não está nem na lista liberada nem na retida: coluna nova em orders/tickets precisa entrar aqui
--    (ou num SQL novo com o grant dela), senão a API não a enxerga.
-- 3. Efeito: nem o comprador nem o admin leem mais o CPF ou o telefone pela API (0 pedidos e 0 ingressos com CPF em
--    04/10/2026). Quem precisar (gateway, Fase 4) lê pela chave de serviço; check-in-validate, delete-account e
--    send-email já usam a chave de serviço e não são afetadas. Filtrar ou ordenar por essas colunas também dá 42501.
-- 4. Nome e e-mail (customer_name, customer_email, buyer_name, buyer_email) continuam liberados: o admin (Financeiro e
--    Ingressos) e o Check-in usam. Reduzir isso exige RPC ou view por papel (pendência, alçada do jurídico).
-- 5. anon fica sem SELECT nenhum em orders e tickets: não há leitura anônima legítima (tem_ingresso roda com os
--    direitos do dono da função;
--    as outras funções que leem orders/tickets por quem chama só usam colunas liberadas; conferido no banco local).
-- 6. INSERT, UPDATE e DELETE não mudam, nem as regras (RLS). INSERT ... RETURNING exige SELECT nas colunas
--    devolvidas: o checkout passa a pedir .select('id, ..., customer_name, customer_email'), todas liberadas; o
--    PostgREST monta o RETURNING só com as colunas do select (e as chaves), então não pede as retidas.
-- 7. O Realtime (Payment.tsx escuta UPDATE em orders) só manda as colunas com SELECT e exige SELECT só na chave
--    primária: continua funcionando com status e id.
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 0. Pré-requisitos
do $$
begin
  if to_regclass('public.orders') is null or to_regclass('public.tickets') is null then
    raise exception 'public.orders ou public.tickets não existe';
  end if;
end $$;

-- 1. Tira o SELECT da tabela inteira (revogar o da tabela também revoga os SELECT por coluna: rodar de novo é limpo)
revoke select on public.orders, public.tickets from anon, authenticated;

-- 2. Devolve o SELECT a authenticated, coluna por coluna, sem as pessoais
grant select (id, user_id, event_id, coupon_id, subtotal, discount, service_fee, processing_fee, total, status,
  payment_method, payment_gateway, gateway_payment_id, customer_name, customer_email, created_at, updated_at)
  on public.orders to authenticated;
grant select (id, order_item_id, order_id, ticket_type_id, event_id, user_id, buyer_name, buyer_email, qr_code, status,
  price_paid, checked_in_at, checked_in_by, transferred_to, transfer_count, created_at, updated_at)
  on public.tickets to authenticated;

-- 3. Conferência que aborta (tudo ou nada) --------------------------------------------------------------------------
do $$
declare
  -- as MESMAS listas dos grants acima; mudar aqui e lá juntos
  lib_orders  text[] := array['id', 'user_id', 'event_id', 'coupon_id', 'subtotal', 'discount', 'service_fee',
    'processing_fee', 'total', 'status', 'payment_method', 'payment_gateway', 'gateway_payment_id', 'customer_name',
    'customer_email', 'created_at', 'updated_at'];
  ret_orders  text[] := array['customer_cpf', 'customer_phone'];
  lib_tickets text[] := array['id', 'order_item_id', 'order_id', 'ticket_type_id', 'event_id', 'user_id', 'buyer_name',
    'buyer_email', 'qr_code', 'status', 'price_paid', 'checked_in_at', 'checked_in_by', 'transferred_to',
    'transfer_count', 'created_at', 'updated_at'];
  ret_tickets text[] := array['buyer_cpf'];
  t text; lib text[]; ret text[]; c text;
begin
  foreach t in array array['orders', 'tickets'] loop
    if t = 'orders' then lib := lib_orders; ret := ret_orders; else lib := lib_tickets; ret := ret_tickets; end if;

    -- coluna nova esquecida (nem liberada nem retida)
    select string_agg(a.attname, ', ') into c from pg_attribute a
    where a.attrelid = format('public.%I', t)::regclass and a.attnum > 0 and not a.attisdropped
      and a.attname <> all (lib || ret);
    if c is not null then
      raise exception '%: coluna fora das listas (%): classificar em liberada ou retida neste arquivo', t, c;
    end if;

    if has_table_privilege('authenticated', format('public.%I', t), 'select') then
      raise exception '%: authenticated ainda tem SELECT na tabela inteira (grant a PUBLIC?)', t;
    end if;
    foreach c in array ret loop
      if has_column_privilege('authenticated', format('public.%I', t), c, 'select') then
        raise exception '%.%: authenticated ainda lê a coluna retida', t, c;
      end if;
    end loop;
    foreach c in array lib loop
      if not has_column_privilege('authenticated', format('public.%I', t), c, 'select') then
        raise exception '%.%: authenticated perdeu a leitura de coluna liberada', t, c;
      end if;
    end loop;

    if has_table_privilege('anon', format('public.%I', t), 'select')
       or has_any_column_privilege('anon', format('public.%I', t), 'select') then
      raise exception '%: anon ainda tem SELECT', t;
    end if;
  end loop;
end $$;

commit;

-- Conferência (só leitura). Esperado: authenticated com SELECT em 17 colunas de orders e 17 de tickets, sem
-- customer_cpf, customer_phone e buyer_cpf; anon sem nenhuma linha de SELECT.
select table_name::text, grantee::text, count(*) as colunas_com_select,
  bool_or(column_name in ('customer_cpf', 'customer_phone', 'buyer_cpf')) as alguma_pessoal
from information_schema.column_privileges
where table_schema = 'public' and table_name in ('orders', 'tickets') and privilege_type = 'SELECT'
  and grantee in ('anon', 'authenticated', 'PUBLIC')
group by 1, 2 order by 1, 2;

-- =============================================================================
-- ENSAIO COM ROLLBACK: trocar o "commit;" do fim do bloco 3 por "rollback;" e rodar tudo; a conferência que aborta
-- já rodou dentro da transação, e nada fica gravado. Comportamento (produtor e comprador lendo CPF recebem 42501,
-- telas leem as colunas delas, insert com returning id): supabase/tests/orders_colunas_pessoais.test.sql.
--
-- Desfazer (volta ao estado de antes: SELECT na tabela inteira para anon e authenticated):
-- begin;
-- revoke select on public.orders, public.tickets from anon, authenticated;  -- leva junto os SELECT por coluna
-- grant select on public.orders, public.tickets to anon, authenticated;
-- commit;
-- =============================================================================
