-- =============================================================================
-- Tela 04 (Editar evento), Decisão 170. 25/10/2026.
-- Trava de venda: não dá para baixar a quantidade de um ingresso para menos do que já foi vendido.
-- Gatilho BEFORE UPDATE em ticket_types: se quantity_total ou capacity (legado) cair abaixo do vendido, erro 23514
-- 'Já foram vendidos N: a quantidade não pode ser menor' (o painel mostra a mensagem: lib/painelEvento.ts).
-- Vendido = o maior entre tickets do tipo não cancelados/reembolsados, sold e quantity_sold.
-- O gatilho só dispara quando quantity_total ou capacity mudam: o estoque (sold, #217) e max_per_order não passam por aqui.
-- Admin e service_role saem no início (mesmo critério de papel de gf_protect_event_moderation).
-- Como aplicar: colar o arquivo inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA pelo TextEdit). Uma transação, idempotente.
-- Testes: 20261025_ingresso_trava_venda_testes.sql (só em banco descartável). NÃO mover para supabase/migrations/.
-- =============================================================================
begin;
set local lock_timeout = '5s';

do $$
begin
  if to_regclass('public.ticket_types') is null or to_regclass('public.tickets') is null
     or to_regprocedure('public.gf_is_admin()') is null then
    raise exception 'ticket_types, tickets ou gf_is_admin não existem';
  end if;
end $$;

create or replace function public.gf_trava_venda_ingresso()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vendido int;
begin
  if not ((current_setting('role', true) in ('anon', 'authenticated')
           or coalesce(auth.jwt()->>'role', '') in ('anon', 'authenticated'))
          and not public.gf_is_admin()) then
    return new;
  end if;

  select greatest(
           (select count(*) from public.tickets t
             where t.ticket_type_id = old.id and coalesce(t.status, 'active') not in ('cancelled', 'refunded')),
           coalesce(old.sold, 0), coalesce(old.quantity_sold, 0))
    into v_vendido;

  if (new.quantity_total is distinct from old.quantity_total and new.quantity_total < v_vendido)
     or (new.capacity is distinct from old.capacity and new.capacity < v_vendido) then
    raise exception 'Já foram vendidos %: a quantidade não pode ser menor', v_vendido using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.gf_trava_venda_ingresso() from public, anon, authenticated;

drop trigger if exists gf_trava_venda_ingresso on public.ticket_types;
create trigger gf_trava_venda_ingresso
  before update on public.ticket_types
  for each row
  when (new.quantity_total is distinct from old.quantity_total or new.capacity is distinct from old.capacity)
  execute function public.gf_trava_venda_ingresso();

-- Conferências (abortam) ---------------------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.ticket_types'::regclass
                 and tgname = 'gf_trava_venda_ingresso' and tgenabled <> 'D') then
    raise exception 'gatilho gf_trava_venda_ingresso ausente ou desligado';
  end if;
  if has_function_privilege('anon', 'public.gf_trava_venda_ingresso()', 'execute')
     or has_function_privilege('authenticated', 'public.gf_trava_venda_ingresso()', 'execute') then
    raise exception 'EXECUTE de gf_trava_venda_ingresso não foi revogado';
  end if;
end $$;

commit;
