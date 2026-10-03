#!/usr/bin/env bash
# Corrida do M5.1 (caso 15): 4 compradores tentam, ao mesmo tempo, a ÚLTIMA inteira de um tipo (2 vagas, cota de
# meia 1). Esperado: exatamente 1 reserva; as outras 3 recusadas com "Restam 0".
# Só no banco LOCAL (supabase start). Os dados são gravados com commit (o pgTAP não consegue testar sessões
# concorrentes numa transação só) e apagados no fim, inclusive se o script falhar.
# Uso: supabase/tests/corrida_reserva.sh   (DB_CONTAINER=nome do container do Postgres; padrão supabase_db_evokaa)
set -u
DB="${DB_CONTAINER:-supabase_db_evokaa}"
E=c5ff0000-0000-4000-8000-0000000000e1
G=c5ff0000-0000-4000-8000-0000000000a1
T=c5ff0000-0000-4000-8000-0000000000b1
P=c5ff0000-0000-4000-8000-0000000000c0   # produtor
SAIDA="$(mktemp -d)"

psql_db() { docker exec -i "$DB" psql -U postgres -v ON_ERROR_STOP=0 -At "$@"; }

limpar() {
  psql_db -q >/dev/null 2>&1 <<SQL
delete from public.tickets where event_id = '$E';
delete from public.order_items where order_id in (select id from public.orders where event_id = '$E');
delete from public.orders where event_id = '$E';
delete from public.ticket_types where event_id = '$E';
delete from public.events where id = '$E';
delete from auth.users where id::text like 'c5ff0000-0000-4000-8000-0000000000%';
SQL
}
trap 'limpar; rm -rf "$SAIDA"' EXIT
limpar

# Montagem: produtor, 4 compradores com nome no perfil, evento publicado e 1 tipo (R$ 50, 2 vagas)
psql_db -q -v ON_ERROR_STOP=1 <<SQL || { echo "ERRO na montagem"; exit 2; }
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
select ('c5ff0000-0000-4000-8000-0000000000d' || n)::uuid, 'corrida' || n || '@teste.local', now(), '{}'::jsonb
  from generate_series(1, 4) n;
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
values ('$P', 'corrida-prod@teste.local', now(), '{"role":"producer"}'::jsonb);
update public.profiles set full_name = 'Corrida ' || right(id::text, 1) where id::text like 'c5ff0000-0000-4000-8000-0000000000d%';
insert into public.events (id, producer_id, title, slug, status, approval_status, start_date)
values ('$E', '$P', 'Corrida', 'corrida-reserva', 'published', 'approved', now() + interval '30 days');
insert into public.ticket_types (id, event_id, name, grupo, lote, price, capacity, max_per_order)
values ('$T', '$E', 'Pista', '$G', 1, 50, 2, 50);
SQL

# Cada comprador: abre transação, reserva 1 inteira, SEGURA a transação 3 s (os outros chegam e esperam a trava) e
# só então grava (commit). Quem perder a corrida recebe erro e a transação aborta.
comprador() {
  local n="$1"
  psql_db > "$SAIDA/c$n.txt" 2>&1 <<SQL
begin;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"c5ff0000-0000-4000-8000-0000000000d$n","aal":"aal1"}', true);
set local role authenticated;
select 'OK ' || (public.reservar_ingressos('$E', '[{"grupo":"$G","beneficio":"inteira","quantidade":1}]'::jsonb) ->> 'order_id');
select pg_sleep(3);
commit;
SQL
}
for n in 1 2 3 4; do comprador "$n" & sleep 0.3; done
wait

ok=$(cat "$SAIDA"/c*.txt | grep -c '^OK ')
recusadas=$(cat "$SAIDA"/c*.txt | grep -c 'Restam 0')
pendentes=$(psql_db -c "select count(*) from public.orders where event_id = '$E' and status = 'pending'")
itens=$(psql_db -c "select coalesce(sum(oi.quantity), 0) from public.order_items oi join public.orders o on o.id = oi.order_id where o.event_id = '$E'")

echo "reservas aceitas: $ok (esperado 1)"
echo "recusas 'Restam 0': $recusadas (esperado 3)"
echo "pedidos pendentes gravados: $pendentes (esperado 1)"
echo "ingressos reservados no total: $itens (esperado 1; o tipo tem 1 inteira livre)"
if [ "$ok" = 1 ] && [ "$recusadas" = 3 ] && [ "$pendentes" = 1 ] && [ "$itens" = 1 ]; then
  echo "CORRIDA OK"
else
  echo "CORRIDA FALHOU"; cat "$SAIDA"/c*.txt; exit 1
fi
