# Backup do banco (Supabase)

O plano gratuito do Supabase não faz backup ("Not included" na página de preços, 27/09/2026). Duas camadas:

1. **Automático, semanal:** `.github/workflows/backup.yml` roda `supabase db dump` (roles, schema e dados) toda segunda às 06:00 UTC e guarda o arquivo **cifrado** como artefato do GitHub Actions por 90 dias. O repositório é público e artefatos são baixáveis por quem tem leitura, por isso a cifra é obrigatória: sem `BACKUP_PASSPHRASE` o job falha de propósito.
2. **Manual, quando quiser:** os mesmos comandos na sua máquina (CLI do Supabase instalada):

```bash
supabase db dump --db-url "$SUPABASE_DB_URL" -f roles.sql --role-only
supabase db dump --db-url "$SUPABASE_DB_URL" -f schema.sql
supabase db dump --db-url "$SUPABASE_DB_URL" -f data.sql --use-copy --data-only
```

## Configurar (uma vez, pelo Ricardo)

```bash
gh secret set SUPABASE_DB_URL --repo scopric/Aura-Tickets      # cole a URI do Supabase → Connect (com a senha)
gh secret set BACKUP_PASSPHRASE --repo scopric/Aura-Tickets    # frase longa; guarde no gerenciador de senhas
gh workflow run "Backup semanal do banco" --repo scopric/Aura-Tickets   # primeira execução, para conferir
```

## Restaurar

```bash
gpg -d backup-AAAA-MM-DD.tar.gz.gpg > backup.tar.gz && tar xzf backup.tar.gz
psql "$DB_URL" --single-transaction --variable ON_ERROR_STOP=1 -f backup/roles.sql -f backup/schema.sql -f backup/data.sql
```

Fonte dos comandos: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore (aberta em 27/09/2026). Action oficial: https://github.com/supabase/setup-cli (v3.0.1 em 27/09/2026).
