-- =============================================================================
-- Admin do alpha passa a ler e apagar as mensagens de contato (Fase A2b)
-- Aplicar à mão no SQL Editor do Supabase. NÃO vai para supabase/migrations (Decisão 02).
-- Motivo: `contact_messages` só tinha regra de INSERT para visitante; o formulário de contato
-- gravava as mensagens e ninguém — nem o admin — conseguia lê-las (1 mensagem real perdida).
-- Idempotente: pode rodar de novo.
-- =============================================================================
begin;

drop policy if exists gf_contact_messages_admin_all on public.contact_messages;
create policy gf_contact_messages_admin_all on public.contact_messages
  for all to authenticated
  using ((select public.gf_is_admin()))
  with check ((select public.gf_is_admin()));

create index if not exists contact_messages_created_at_idx on public.contact_messages (created_at desc);

commit;

-- =============================================================================
-- CONFERÊNCIA (só leitura) — rodar depois:
-- select tablename, policyname, cmd from pg_policies where tablename = 'contact_messages';
--   -- esperado: gf_contact_messages_admin_all, ALL
-- select count(*) from public.contact_messages;   -- deve devolver 1 (a mensagem real de 28/09)
-- =============================================================================
