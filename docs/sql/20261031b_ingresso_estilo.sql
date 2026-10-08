-- Estilo do ingresso por evento (Decisão 206, plano "prévia do ingresso, logo e envio por WhatsApp", fatia 2). O produtor escolhe a cor do topo e a
-- posição da logo; a logo em si é a do produtor (producer_profiles.logo_url, 20261031_produtor_logo.sql). Quem lê é o PDF e o e-mail do ingresso
-- (função do servidor, em PR à parte). Hoje vale para todos os planos; o PRO passa a ser checado quando a cobrança entrar.
-- O que faz: events.ticket_style jsonb (padrão '{}' = modelo padrão da Evokaa), com trava de formato: só as chaves cor (#rrggbb) e logo ('esquerda' ou 'centro').
-- DE PROPÓSITO NÃO HÁ TEXTO LIVRE (rodapé): o ingresso e o e-mail saem com o remetente da Evokaa para todos os compradores, e esta coluna fica fora
-- da lista de colunas vigiadas por gf_protect_event_moderation (como accent_color). Revisão adversarial e auditoria de segurança de 08/10/2026
-- mostraram que filtro por regex não fecha golpe em texto livre (Unicode largo, "ponto com", telefone por extenso). O rodapé só volta com moderação.
-- Sem GRANT novo: o produtor já atualiza events pela política existente (UPDATE no nível da tabela, conferido em produção em 08/10/2026).
-- Como aplicar: pode ir antes ou depois do front, mas ANTES é melhor: sem a coluna o botão "Salvar estilo" da prévia mostra erro. Uma transação, idempotente,
--   sem mudança em dados (constraint NOT VALID e depois VALIDATE: só leitura longa, sem bloqueio exclusivo prolongado).
-- Como desfazer: alter table public.events drop column if exists ticket_style;
begin;
set local lock_timeout = '5s';

alter table public.events add column if not exists ticket_style jsonb not null default '{}'::jsonb;

alter table public.events drop constraint if exists events_ticket_style_check;
alter table public.events add constraint events_ticket_style_check check (
  jsonb_typeof(ticket_style) = 'object'
  and (ticket_style - 'cor' - 'logo') = '{}'::jsonb
  and (not ticket_style ? 'cor' or (jsonb_typeof(ticket_style -> 'cor') = 'string' and ticket_style ->> 'cor' ~ '^#[0-9a-fA-F]{6}$'))
  and (not ticket_style ? 'logo' or (jsonb_typeof(ticket_style -> 'logo') = 'string' and ticket_style ->> 'logo' in ('esquerda', 'centro')))
) not valid;
alter table public.events validate constraint events_ticket_style_check;

comment on column public.events.ticket_style is 'Estilo do ingresso do evento: {cor, logo}; vazio = modelo padrão da Evokaa. Sem texto livre (sem moderação)';

commit;

-- Ensaio (rode à parte; nada fica gravado, o bloco termina em erro de propósito): aceita o válido, recusa o que não pode.
-- do $$
-- declare ok text[] := array['{}', '{"cor":"#a55c65"}', '{"logo":"centro"}', '{"cor":"#4A60E3","logo":"esquerda"}'];
--   ruim text[] := array['[]', 'null', '{"x":1}', '{"cor":"vermelho"}', '{"cor":"#fff"}', '{"cor":5}', '{"cor":null}', '{"logo":"direita"}', '{"logo":null}', '{"rodape":"texto"}'];
--   v text; e uuid;
-- begin
--   select id into e from public.events limit 1;
--   if e is null then raise exception 'ENSAIO: sem evento'; end if;
--   foreach v in array ok loop update public.events set ticket_style = v::jsonb where id = e; end loop;
--   foreach v in array ruim loop
--     begin update public.events set ticket_style = v::jsonb where id = e; raise exception 'ENSAIO FALHOU: aceitou %', v;
--     exception when check_violation then null; end;
--   end loop;
--   raise exception 'ENSAIO OK (desfeito)';
-- end $$;
