# Templates de e-mail do Supabase Auth

`email_templates_premium.html` guarda os modelos de e-mail do login (confirmação, redefinição de senha etc.). `configure_supabase_auth.cjs` os aplica pela API de gestão do Supabase: `node configure_supabase_auth.cjs` e colar o token pessoal quando pedir (nunca gravar o token em arquivo). Não conferido se batem com o que está hoje no painel.

Edge Functions ficam em `supabase/functions/` na raiz; publicar com `supabase functions deploy <nome> --project-ref rwaezeqyuhxrssntcxdv` a partir da raiz do repositório.
