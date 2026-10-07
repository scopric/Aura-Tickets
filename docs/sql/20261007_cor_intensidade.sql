-- Intensidade da cor do evento (pedido do Ricardo, 07/10/2026): o produtor escolhe de 10 a 100% quanto da cor entra
-- (100 = cor cheia, o comportamento de sempre). Coluna separada porque events_accent_color_check só aceita #rrggbb.
-- O que faz: cria events.accent_intensity (smallint, padrão 100, entre 10 e 100). Eventos existentes ficam em 100.
-- Mesmo molde de capa_na_cor: NÃO entra na lista de conteúdo do gatilho gf_protect_event_moderation (compara uma lista
-- fixa de colunas), então mudar a intensidade vale na hora, sem nova análise, igual a accent_color. Não há GRANT de coluna
-- nem trilha própria a mexer: o produtor já atualiza events pela política existente, como em capa_na_cor.
-- Como desfazer: alter table public.events drop column if exists accent_intensity;
begin;
set local lock_timeout = '5s';

alter table public.events add column if not exists accent_intensity smallint not null default 100;

alter table public.events drop constraint if exists events_accent_intensity_check;
alter table public.events add constraint events_accent_intensity_check check (accent_intensity between 10 and 100);

comment on column public.events.accent_intensity is 'Intensidade da cor do evento em %, 10 a 100; 100 = cor cheia (padrão)';

commit;

-- Ensaio (rode à parte; nada fica gravado): a coluna existe, o padrão é 100 e o banco recusa fora da faixa.
-- begin;
--   do $$
--   declare e uuid;
--   begin
--     select id into e from public.events limit 1;
--     if e is null then raise notice 'sem evento para ensaiar'; return; end if;
--     assert (select accent_intensity from public.events where id = e) between 10 and 100, 'valor fora da faixa';
--     update public.events set accent_intensity = 40 where id = e;
--     begin
--       update public.events set accent_intensity = 5 where id = e;
--       raise exception 'aceitou 5';
--     exception when check_violation then null;
--     end;
--     begin
--       update public.events set accent_intensity = 101 where id = e;
--       raise exception 'aceitou 101';
--     exception when check_violation then null;
--     end;
--   end $$;
-- rollback;
