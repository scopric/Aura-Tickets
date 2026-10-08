-- QR dinâmico do ingresso, PR B (Decisão 211; plano "Fatia 2b"): marca o ingresso que já usa o código que muda a cada 30 s.
-- O que faz: tickets.qr_dinamico_desde timestamptz (nulo = ainda no QR fixo). Quem grava é SÓ a função ingresso-codigo (service role), na primeira vez
--   que serve códigos ao dono do ingresso. Daí em diante o check-in-validate recusa o UUID fixo (tickets.qr_code) daquele ingresso e qualquer print dele.
--   Quem nunca abre o QR dinâmico continua entrando com o QR fixo do PDF antigo (resposta do Ricardo, 08/10).
-- Sem GRANT novo e sem política nova: tickets só tem política de SELECT para o cliente (conferido em produção em 08/10/2026), então o comprador não consegue
--   gravar esta coluna; o supabase-js do navegador não a altera.
-- ORDEM DE APLICAÇÃO: este SQL ANTES de publicar check-in-validate e ingresso-codigo (as duas leem a coluna; sem ela, o check-in falha com 500).
-- Como desfazer: alter table public.tickets drop column if exists qr_dinamico_desde; (só depois de republicar as funções da versão anterior).
begin;
set local lock_timeout = '5s';

alter table public.tickets add column if not exists qr_dinamico_desde timestamptz;
comment on column public.tickets.qr_dinamico_desde is 'Quando o ingresso passou a usar o QR dinâmico (ingresso-codigo, service role). Não nulo = o QR fixo (qr_code) deste ingresso não vale mais na portaria';

commit;

-- Ensaio (rode à parte; nada fica gravado, termina em erro de propósito): a coluna nasce nula e o cliente não consegue gravá-la.
-- do $$
-- begin
--   alter table public.tickets add column if not exists qr_dinamico_desde timestamptz;
--   assert (select count(*) from public.tickets where qr_dinamico_desde is not null) = 0, 'nasceu preenchida';
--   assert not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tickets' and permissive = 'PERMISSIVE' and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')), 'há política de escrita em tickets';
--   raise exception 'ENSAIO OK (desfeito)';
-- end $$;
