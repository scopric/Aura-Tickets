-- Fase A2c: descadastro por token da newsletter (idempotente).
-- Cada assinante ganha um token opaco para o link de descadastro do e-mail (sem exigir login)
-- e um carimbo de quando descadastrou (registro LGPD do pedido de opt-out).
-- ORDEM: aplicar ESTE SQL antes de publicar a nova versão da função send-email.

alter table public.newsletter_subscribers
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid(),
  add column if not exists unsubscribed_at timestamptz;

create unique index if not exists newsletter_subscribers_unsubscribe_token_idx
  on public.newsletter_subscribers (unsubscribe_token);

-- "Joao@x.com" e "joao@x.com" eram inscrições diferentes (UNIQUE de email diferencia caixa):
-- a pessoa recebia 2x e descadastrar uma não descadastrava a outra. Conferido em 29/09/2026:
-- nenhuma duplicata por caixa na base, então o índice cria sem erro.
create unique index if not exists newsletter_subscribers_email_lower_idx
  on public.newsletter_subscribers (lower(email));

-- Conferência:
-- select id, email, unsubscribe_token, unsubscribed_at from public.newsletter_subscribers limit 5;
-- select indexname from pg_indexes where tablename = 'newsletter_subscribers';
