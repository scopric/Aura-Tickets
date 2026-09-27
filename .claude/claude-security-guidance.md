# Regras de segurança deste repositório (lidas pelo plugin security-guidance)

Plataforma de ingressos com dados pessoais de compradores (LGPD) e pagamentos por Stripe e Pix (Woovi). Repositório público.

- Nenhuma chave, token ou senha em arquivo versionado. Só variáveis `VITE_*` chegam ao front; `service_role`, chaves secretas do Stripe e da Woovi ficam só em Edge Functions, lidas do ambiente.
- Toda tabela com dado pessoal (`users`, `orders`, `tickets`, `contact_messages`, `newsletter_subscribers`, `feedback`, `support_*`) exige RLS ativa **com política**; RLS ativa sem política bloqueia tudo e esconde erro. Consulta por `id` de outro usuário sem filtro por `auth.uid()` é achado.
- Não registrar em log, `console.log` ou toast: CPF, e-mail, telefone, endereço, dados de cartão, tokens de sessão. Em produção, nenhum `console.log` de sessão ou de usuário.
- Webhooks do Stripe e da Woovi validam a assinatura antes de ler o corpo; sem assinatura válida, responder 400 e não tocar no banco. Idempotência por id do evento.
- Papel do usuário (`role`) é decidido no servidor (trigger ou função), nunca aceito do cliente no `signUp` ou em `metadata`.
- Funções `SECURITY DEFINER` só com `search_path` fixo e sem exposição a `anon`, salvo justificativa escrita.
- Redirecionamentos de login voltam a `/auth/login`; nunca para URL vinda de parâmetro sem lista de permitidos.
- Arquivos em `supabase/migrations/` não são criados nem alterados por agente (a integração aplicaria em produção); SQL novo vai para `docs/sql/`.
