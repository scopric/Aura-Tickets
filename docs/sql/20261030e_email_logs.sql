-- =============================================================================
-- Registro dos e-mails de pedido (email_logs): a função send-email já grava aqui (confirmação e entrega do ingresso),
-- mas a tabela nunca foi criada em produção. Sem ela, nada limitava o reenvio. Com ela, a entrega do ingresso pode ser
-- pedida no máximo 3 vezes por hora por pedido (regra no send-email) e a confirmação sai uma vez só.
-- Só a Edge Function (service_role) lê e grava: RLS ligada, sem policy, sem acesso para anon e authenticated.
-- Retenção: 90 dias (o registro tem o e-mail do destinatário); a limpeza roda pelo pg_cron, se a extensão existir.
-- Como aplicar: ensaiar com ROLLBACK, colar inteiro no SQL Editor (UTF-8 via pbcopy, nunca TextEdit).
--   Uma transação, idempotente. Depois de aplicar, publicar send-email (ver o PR do PDF e e-mail do ingresso).
-- NÃO mover para supabase/migrations/.
-- Desfazer: drop table public.email_logs; (e select cron.unschedule('email_logs_retencao') se o cron foi criado).
-- =============================================================================
begin;
set local lock_timeout = '5s';

do $$
begin
  if to_regclass('public.orders') is null then
    raise exception 'falta a tabela public.orders';
  end if;
end $$;

create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  email_type text not null,
  recipient text,
  status text not null check (status in ('sent', 'failed')),
  resend_id text,
  error_message text,
  created_at timestamptz not null default now()
);

-- a conferência do limite filtra por pedido, tipo e hora
create index if not exists email_logs_pedido_tipo_idx on public.email_logs (order_id, email_type, created_at desc);
-- a limpeza de retenção
create index if not exists email_logs_created_at_idx on public.email_logs (created_at);

alter table public.email_logs enable row level security;
revoke all on public.email_logs from anon, authenticated;

-- retenção de 90 dias (idempotente; sem pg_cron, o aviso fica no resultado e a limpeza vira manual)
do $$
begin
  if to_regnamespace('cron') is null then
    raise notice 'pg_cron ausente: apagar email_logs com mais de 90 dias manualmente de tempos em tempos';
  elsif not exists (select 1 from cron.job where jobname = 'email_logs_retencao') then
    perform cron.schedule('email_logs_retencao', '17 3 * * *', $c$delete from public.email_logs where created_at < now() - interval '90 days'$c$);
  end if;
end $$;

commit;
