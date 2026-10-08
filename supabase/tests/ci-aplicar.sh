#!/usr/bin/env bash
# Prepara o banco LOCAL descartável do CI. O baseline (supabase/migrations) já traz o estado da produção, então só falta o
# segredo de teste do PR 7 (cifra de PII) no Vault local. Só em banco descartável. Nunca contra produção.
# Uso: DB_CONTAINER=supabase_db_evokaa supabase/tests/ci-aplicar.sh
set -u
DB="${DB_CONTAINER:-supabase_db_evokaa}"
psqlc() { docker exec -i "$DB" psql -U postgres -h 127.0.0.1 -v ON_ERROR_STOP=1 -q "$@"; }
psqlc -c 'select 1' >/dev/null 2>&1 || { echo "banco local inacessível (DB_CONTAINER=$DB)"; exit 1; }
psqlc -c "select vault.create_secret(encode(gen_random_bytes(32),'hex'),'pr7_pii_key')" >/dev/null 2>&1 || true
echo "segredo de teste criado; baseline = produção de 2026-10-08"
