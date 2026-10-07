#!/usr/bin/env bash
# Corrida do limite por CPF: 2 contas, o MESMO CPF (fictício, 529.982.247-25), cada uma com pedido pendente de 2 de um tipo
# com max_por_cpf = 2 (pendente de outra conta não segura o CPF: os dois pedidos nascem). Os dois PAGAM ao mesmo tempo
# (update status = 'paid', como o gateway com service_role). Esperado: exatamente 1 pago; o outro recebe "Limite de 2
# ingressos por CPF neste ingresso" (gatilho orders_pago_cpf_guard).
# Só em banco LOCAL descartável (com docs/sql até 20261028_limite_por_cpf aplicado e pr7_hmac funcionando).
# Os dados são gravados com commit (o pgTAP não testa sessões concorrentes numa transação só) e apagados no fim, inclusive se falhar.
# Uso: DB_NAME=cpf_t supabase/tests/corrida_cpf.sh   (DB_CONTAINER, padrão supabase_db_evokaa; DB_NAME, padrão postgres)
set -u
DB="${DB_CONTAINER:-supabase_db_evokaa}"
NOME="${DB_NAME:-postgres}"
E=c7ff0000-0000-4000-8000-0000000000e1
T=c7ff0000-0000-4000-8000-0000000000b1
P=c7ff0000-0000-4000-8000-0000000000c0
SAIDA="$(mktemp -d)"

psql_db() { docker exec -i "$DB" psql -U postgres -d "$NOME" -v ON_ERROR_STOP=0 -At "$@"; }

limpar() {
  psql_db -q >/dev/null 2>&1 <<SQL
delete from public.order_items where ticket_type_id = '$T';
delete from public.orders where event_id = '$E';
delete from public.events where id = '$E';
delete from auth.users where id::text like 'c7ff0000-0000-4000-8000-0000000000%';
SQL
}
trap 'limpar; rm -rf "$SAIDA"' EXIT
limpar

psql_db -q -v ON_ERROR_STOP=1 <<SQL || { echo "ERRO na montagem"; exit 2; }
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
select ('c7ff0000-0000-4000-8000-0000000000d' || n)::uuid, 'corrida-cpf' || n || '@teste.local', now(), '{}'::jsonb from generate_series(1, 2) n;
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values ('$P', 'corrida-cpf-prod@teste.local', now(), '{"role":"producer"}'::jsonb);
insert into public.events (id, producer_id, title, slug, status, approval_status, start_date)
values ('$E', '$P', 'Corrida CPF', 'corrida-cpf', 'published', 'approved', now() + interval '30 days');
insert into public.ticket_types (id, event_id, name, price, quantity_total, max_por_cpf) values ('$T', '$E', 'Pista', 50, 100, 2);
SQL

# Cada conta cria o pedido e o item (com commit); depois os dois pagamentos correm: cada um SEGURA a transação 3 s.
for n in 1 2; do
  psql_db -q -v ON_ERROR_STOP=1 >/dev/null <<SQL || { echo "ERRO no pedido $n"; exit 2; }
begin;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"c7ff0000-0000-4000-8000-0000000000d$n","aal":"aal2"}', true);
set local role authenticated;
insert into public.orders (id, user_id, event_id, total, status, customer_cpf)
values ('c7ff0000-0000-4000-8000-0000000000f$n', 'c7ff0000-0000-4000-8000-0000000000d$n', '$E', 100, 'pending', '529.982.247-25');
insert into public.order_items (order_id, ticket_type_id, quantity, unit_price) values ('c7ff0000-0000-4000-8000-0000000000f$n', '$T', 2, 50);
commit;
SQL
done
comprador() {
  local n="$1"
  psql_db > "$SAIDA/c$n.txt" 2>&1 <<SQL
begin;
set local role service_role;
update public.orders set status = 'paid' where id = 'c7ff0000-0000-4000-8000-0000000000f$n';
select 'OK $n';
select pg_sleep(3);
commit;
SQL
}
for n in 1 2; do comprador "$n" & sleep 0.3; done
wait

ok=$(cat "$SAIDA"/c*.txt | grep -c '^OK ')
recusadas=$(cat "$SAIDA"/c*.txt | grep -c 'Limite de 2 ingressos por CPF neste ingresso')
itens=$(psql_db -c "select coalesce(sum(oi.quantity), 0) from public.order_items oi join public.orders o on o.id = oi.order_id where oi.ticket_type_id = '$T' and o.status = 'paid'")

echo "pagamentos aceitos: $ok (esperado 1)"
echo "recusas 'Limite de 2 ingressos por CPF': $recusadas (esperado 1)"
echo "ingressos pagos no tipo: $itens (esperado 2)"
if [ "$ok" = 1 ] && [ "$recusadas" = 1 ] && [ "$itens" = 2 ]; then
  echo "CORRIDA OK"
else
  echo "CORRIDA FALHOU"; cat "$SAIDA"/c*.txt; exit 1
fi
