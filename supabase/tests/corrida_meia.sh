#!/usr/bin/env bash
# Corrida da meia (docs/sql/20261030a_venda_servidor_meia.sql): tipo de R$ 50 com lotação 5 (cota de meia = ceil(0,4 x 5) = 2).
# Antes da corrida, outra conta segura 1 meia e outra 2 inteiras: sobram 1 meia e 1 inteira.
# Rodada 1: duas contas disputam a ÚLTIMA MEIA ao mesmo tempo. Esperado: exatamente 1 reserva; a outra recebe {ok:false} com "Restam 0 meias".
# Rodada 2: duas contas disputam a ÚLTIMA INTEIRA. Esperado: exatamente 1 reserva; a outra recebe "Ingressos esgotados".
# Só em banco LOCAL descartável (com docs/sql até 20261030a aplicado). Os dados são gravados com commit (o pgTAP não testa sessões
# concorrentes numa transação só) e apagados no fim, inclusive se falhar.
# Uso: DB_NAME=meia_t supabase/tests/corrida_meia.sh   (DB_CONTAINER, padrão supabase_db_evokaa; DB_NAME, padrão postgres)
set -u
DB="${DB_CONTAINER:-supabase_db_evokaa}"
NOME="${DB_NAME:-postgres}"
E=c8ff0000-0000-4000-8000-0000000000e1
T=c8ff0000-0000-4000-8000-0000000000b1
P=c8ff0000-0000-4000-8000-0000000000c0
U=c8ff0000-0000-4000-8000-0000000000d
SAIDA="$(mktemp -d)"

psql_db() { docker exec -i "$DB" psql -U postgres -d "$NOME" -v ON_ERROR_STOP=0 -At "$@"; }

limpar() {
  psql_db -q >/dev/null 2>&1 <<SQL
delete from public.order_items where ticket_type_id = '$T';
delete from public.orders where event_id = '$E';
delete from public.ticket_types where id = '$T';
delete from public.events where id = '$E';
delete from auth.users where id::text like 'c8ff0000-0000-4000-8000-0000000000%';
SQL
}
trap 'limpar; rm -rf "$SAIDA"' EXIT
limpar

psql_db -q -v ON_ERROR_STOP=1 <<SQL || { echo "ERRO na montagem"; exit 2; }
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
select ('${U}' || n)::uuid, 'corrida-meia' || n || '@teste.local', now(), '{"full_name":"Corrida"}'::jsonb from generate_series(1, 6) n;
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values ('$P', 'corrida-meia-prod@teste.local', now(), '{"role":"producer"}'::jsonb);
insert into public.events (id, producer_id, title, slug, status, approval_status, start_date)
values ('$E', '$P', 'Corrida Meia', 'corrida-meia', 'published', 'approved', now() + interval '30 days');
insert into public.ticket_types (id, event_id, name, price, quantity_total) values ('$T', '$E', 'Pista', 50, 5);
SQL

# reservar N: conta n reserva "quantidade" de "beneficio"; segura a transação 3 s antes do commit (os outros esperam a trava)
reservar() { # $1 conta  $2 inteira|meia  $3 quantidade  $4 segundos  $5 arquivo de saída
  local tipo=""; [ "$2" = meia ] && tipo=',"meia_tipo":"estudante"'
  psql_db > "$5" 2>&1 <<SQL
begin;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"${U}$1","aal":"aal2","email":"c$1@teste.local"}', true);
set local role authenticated;
select case when r ->> 'ok' = 'true' then 'OK $1 ' || (r ->> 'order_id') else 'RECUSADA $1 ' || (r ->> 'mensagem') end
  from (select public.reservar_ingressos('$E', '[{"ticket_type_id":"$T","quantidade":$3,"beneficio":"$2"$tipo}]'::jsonb) as r) x;
select pg_sleep($4);
commit;
SQL
}
reservar 1 meia 1 0 "$SAIDA/pre1.txt"
reservar 2 inteira 2 0 "$SAIDA/pre2.txt"
if ! grep -q '^OK 1' "$SAIDA/pre1.txt" || ! grep -q '^OK 2' "$SAIDA/pre2.txt"; then echo "ERRO no pré-preenchimento"; cat "$SAIDA"/pre*.txt; exit 2; fi

rodada() { # $1 inteira|meia  $2 contas (duas)  $3 mensagem esperada
  rm -f "$SAIDA"/r*.txt
  for n in $2; do reservar "$n" "$1" 1 3 "$SAIDA/r$n.txt" & sleep 0.3; done
  wait
  local ok recusadas
  ok=$(cat "$SAIDA"/r*.txt | grep -c '^OK ')
  recusadas=$(cat "$SAIDA"/r*.txt | grep -c "$3")
  echo "rodada $1: reservas aceitas $ok (esperado 1); recusas '$3' $recusadas (esperado 1)"
  [ "$ok" = 1 ] && [ "$recusadas" = 1 ]
}
falhou=0
rodada meia "3 4" "Restam 0 meias" || falhou=1
rodada inteira "5 6" "Ingressos esgotados" || falhou=1

total=$(psql_db -c "select coalesce(sum(oi.quantity), 0) from public.order_items oi join public.orders o on o.id = oi.order_id where oi.ticket_type_id = '$T' and o.status = 'pending'")
meias=$(psql_db -c "select coalesce(sum(oi.quantity), 0) from public.order_items oi join public.orders o on o.id = oi.order_id where oi.ticket_type_id = '$T' and o.status = 'pending' and oi.beneficio = 'meia'")
echo "ingressos reservados: $total (esperado 5 = lotação); meias: $meias (esperado 2 = cota)"
if [ "$falhou" = 0 ] && [ "$total" = 5 ] && [ "$meias" = 2 ]; then
  echo "CORRIDA OK"
else
  echo "CORRIDA FALHOU"; cat "$SAIDA"/r*.txt; exit 1
fi
