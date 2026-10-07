#!/usr/bin/env bash
# Corrida do lugar marcado: 2 compradores tentam, ao mesmo tempo, o MESMO lugar. Esperado: exatamente 1 reserva; o outro recebe
# "Lugar acabou de ser escolhido" e não deixa pedido. Só em banco LOCAL descartável (com docs/sql até 20261008_assento_reserva aplicado).
# Os dados são gravados com commit (o pgTAP não testa sessões concorrentes numa transação só) e apagados no fim, inclusive se falhar.
# Uso: DB_NAME=assento_t supabase/tests/corrida_assento.sh   (DB_CONTAINER, padrão supabase_db_evokaa; DB_NAME, padrão postgres)
set -u
DB="${DB_CONTAINER:-supabase_db_evokaa}"
NOME="${DB_NAME:-postgres}"
E=c6ff0000-0000-4000-8000-0000000000e1
T=c6ff0000-0000-4000-8000-0000000000b1
P=c6ff0000-0000-4000-8000-0000000000c0
SAIDA="$(mktemp -d)"

psql_db() { docker exec -i "$DB" psql -U postgres -d "$NOME" -v ON_ERROR_STOP=0 -At "$@"; }

limpar() {
  psql_db -q >/dev/null 2>&1 <<SQL
delete from public.events where id = '$E';
delete from auth.users where id::text like 'c6ff0000-0000-4000-8000-0000000000%';
SQL
}
trap 'limpar; rm -rf "$SAIDA"' EXIT
limpar

psql_db -q -v ON_ERROR_STOP=1 <<SQL || { echo "ERRO na montagem"; exit 2; }
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
select ('c6ff0000-0000-4000-8000-0000000000d' || n)::uuid, 'corrida-lugar' || n || '@teste.local', now(), '{}'::jsonb from generate_series(1, 2) n;
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values ('$P', 'corrida-lugar-prod@teste.local', now(), '{"role":"producer"}'::jsonb);
insert into public.events (id, producer_id, title, slug, status, approval_status, start_date)
values ('$E', '$P', 'Corrida lugar', 'corrida-lugar', 'published', 'approved', now() + interval '30 days');
insert into public.ticket_types (id, event_id, name, price, quantity_total) values ('$T', '$E', 'Pista', 50, 10);
insert into public.seating_maps (event_id, is_active, environments) values ('$E', true,
  '[{"id":"a","sections":[{"id":"s","ticketTypeId":"$T"}],"seats":[{"id":"x1","type":"seat","sectionId":"s","status":"free"}]}]'::jsonb);
SQL

# Cada comprador: abre transação, reserva o lugar, SEGURA a transação 3 s (o outro chega e espera a trava) e só então grava.
comprador() {
  local n="$1"
  psql_db > "$SAIDA/c$n.txt" 2>&1 <<SQL
begin;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"c6ff0000-0000-4000-8000-0000000000d$n","aal":"aal1"}', true);
set local role authenticated;
select 'OK ' || (public.reservar_assentos('$E', array['a:x1']) ->> 'order_id');
select pg_sleep(3);
commit;
SQL
}
for n in 1 2; do comprador "$n" & sleep 0.3; done
wait

ok=$(cat "$SAIDA"/c*.txt | grep -c '^OK ')
recusadas=$(cat "$SAIDA"/c*.txt | grep -c 'Lugar acabou de ser escolhido')
pedidos=$(psql_db -c "select count(*) from public.orders where event_id = '$E'")
vivas=$(psql_db -c "select count(*) from public.pedido_assentos where event_id = '$E' and liberada_em is null")

echo "reservas aceitas: $ok (esperado 1)"
echo "recusas 'Lugar acabou de ser escolhido': $recusadas (esperado 1)"
echo "pedidos gravados: $pedidos (esperado 1)"
echo "reservas vivas do lugar: $vivas (esperado 1)"
if [ "$ok" = 1 ] && [ "$recusadas" = 1 ] && [ "$pedidos" = 1 ] && [ "$vivas" = 1 ]; then
  echo "CORRIDA OK"
else
  echo "CORRIDA FALHOU"; cat "$SAIDA"/c*.txt; exit 1
fi
