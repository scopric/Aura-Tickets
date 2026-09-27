-- =============================================================================
-- Realtime do chat de suporte — 2026-09-27
-- APLICADO MANUALMENTE em produção (projeto rwaezeqyuhxrssntcxdv) via Supabase MCP.
-- NÃO mover para supabase/migrations/ (motivo em docs/sql/20260927_security_hardening.sql).
--
-- O widget de suporte (app/src/components/SupportChatWidget.tsx) assina INSERTs em
-- support_messages via Realtime (postgres_changes), e a tela do admin
-- (app/src/pages/admin/SupportChat.tsx) assina support_sessions para listar sessões novas.
-- Nenhuma das duas estava na publicação supabase_realtime (a migration
-- app/supabase/migrations/20260604000000_create_support_chat.sql nunca foi aplicada), então
-- a resposta do atendente só aparecia ao fechar e abrir o chat, e o admin só via sessão nova
-- ao recarregar. O Realtime respeita o RLS: cada usuário só recebe as próprias linhas.
-- Idempotente. Não altera dados.
-- =============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_messages'
  ) then
    alter publication supabase_realtime add table public.support_messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_sessions'
  ) then
    alter publication supabase_realtime add table public.support_sessions;
  end if;
end $$;
