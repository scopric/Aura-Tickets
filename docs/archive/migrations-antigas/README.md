# Migrations antigas (arquivadas, NÃO aplicar)

Estes arquivos vieram de `supabase/migrations/` (pasta `raiz/`) e de `app/supabase/migrations/` (pasta `app/`).
Foram tirados de lá porque a integração GitHub↔Supabase aplica em produção o que estiver em `supabase/migrations/`, e `00000000000000_init_schema.sql` começa com `DROP TABLE … CASCADE` de 33 tabelas (só não rodava por um erro de sintaxe).
**Não aplique nenhum deles** no banco, nem copie de volta para `supabase/migrations/`: não retratam o schema real e podem apagar dados.
O schema real de produção vai ser retratado num baseline próprio (PR 1b). Até lá, SQL novo continua em `docs/sql/`.
