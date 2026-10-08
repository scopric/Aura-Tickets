#!/usr/bin/env bash
# Prepara o banco LOCAL descartável do CI: baseline (o `supabase start` já o aplica) + segredo do Vault + docs/sql de 20261001 em diante.
# Os docs/sql não têm ordem de execução garantida (na produção foram aplicados à mão, fora de ordem), então repete as falhas em
# várias passadas até não progredir; o que sobra é listado e NÃO derruba o CI (job informativo, ver .github/workflows/sql-tests.yml).
# Só em banco local descartável. Nunca contra produção. Uso: DB_CONTAINER=supabase_db_evokaa supabase/tests/ci-aplicar.sh
set -u
ERR=$(mktemp -d)
cd "$(dirname "$0")/../.."
DB="${DB_CONTAINER:-supabase_db_evokaa}"
psqlc() { docker exec -i "$DB" psql -U postgres -h 127.0.0.1 -v ON_ERROR_STOP=1 -q "$@"; }
psqlc -c 'select 1' >/dev/null 2>&1 || { echo "banco local inacessível (DB_CONTAINER=$DB)"; exit 1; }
# chave de teste do PR 7 (cifra de PII): só existe neste banco descartável
psqlc -c "select vault.create_secret(encode(gen_random_bytes(32),'hex'),'pr7_pii_key')" >/dev/null 2>&1 || true
pend=$(ls docs/sql/*.sql | awk -F/ '$3 >= "20261001"' | grep -v -e _testes.sql -e kb_seed -e apagar_eventos_teste)
total=$(echo "$pend" | wc -w)
for passe in 1 2 3 4 5 6; do
  prox=""
  for f in $pend; do psqlc < "$f" >/dev/null 2>"$ERR/$(basename "$f").err" || prox="$prox $f"; done
  n=$(echo "$prox" | wc -w); echo "passe $passe: $n de $total ainda falham"
  [ "$n" -eq "$(echo "$pend" | wc -w)" ] && { pend="$prox"; break; }
  pend="$prox"; [ "$n" -eq 0 ] && break
done
for f in $pend; do echo "NAO APLICOU $f: $(grep -m1 ERROR "$ERR/$(basename "$f").err" | cut -c1-160)"; done
exit 0
