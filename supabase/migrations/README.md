- `20260930134600_baseline.sql` retrata só o schema (sem dados) da produção; **regerado em 08/10/2026** com `supabase db dump --linked` (schema public) mais o trecho de auth/storage/event trigger do retrato anterior. Mantém a mesma versão porque na produção ela já está marcada como aplicada. Serve para `supabase start`/`supabase db reset` e o pgTAP locais. Para regerar de novo: `supabase db dump --linked -f <arquivo>`, juntar o trecho "Completado fora de public" e o bloco de privilégios padrão do topo.
- "Deploy to production" da integração GitHub do Supabase continua desligado (Decisão 03): nada desta pasta vai sozinho para a produção.
- SQL novo para a produção segue em `docs/sql/` até a convenção de migrations do PR 9.
- Antes de qualquer `db push` ou de religar o Deploy to production, o Ricardo marca o histórico da produção uma vez (em 30/09 o histórico remoto tinha só `20260927013038 security_hardening_20260927`, sem arquivo aqui):
  1. `supabase migration repair --status reverted 20260927013038 --project-ref rwaezeqyuhxrssntcxdv` (o conteúdo já está no baseline);
  2. `supabase migration repair --status applied 20260930134600 --project-ref rwaezeqyuhxrssntcxdv`;
  3. conferir com `supabase migration list` que local e remoto batem.
- `supabase/config.toml` é só para o ambiente local: nunca `supabase config push`.
