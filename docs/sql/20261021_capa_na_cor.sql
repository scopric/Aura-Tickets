-- Decisão 173: a capa do evento passa a mostrar a foto ORIGINAL por padrão; o duotone "na cor do evento" vira opção do produtor.
-- O que faz: cria events.capa_na_cor (boolean, padrão false). Eventos existentes ficam false = mostram a foto original.
-- NÃO entra na lista de conteúdo do gatilho gf_protect_event_moderation (compara uma lista fixa de colunas): trocar a opção
-- não manda o evento para análise, igual a accent_color.
-- Como desfazer: alter table public.events drop column if exists capa_na_cor;
begin;
set local lock_timeout = '5s';

alter table public.events add column if not exists capa_na_cor boolean not null default false;

comment on column public.events.capa_na_cor is 'true: capa em duotone na cor do evento; false (padrão): foto original (Decisão 173)';

commit;
