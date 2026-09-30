-- =============================================================================
-- Chat estilo Intercom (etapa 3, PR 3a) — base de conhecimento + assistente sem IA — 2026-10-03
-- Aplicar à mão no SQL Editor do Supabase, DEPOIS de 20261001_chat.sql, 20261002_chat_atendente.sql e
-- 20260930_2fa_no_banco.sql (todos em produção). NÃO vai para supabase/migrations (Decisão 02).
-- Depois deste, rodar docs/sql/20261003_kb_seed.sql (os 58 artigos do levantamento).
-- Plano: Claude/Planos/reflective-floating-wand, "Etapa 3" (com as correções da revisão de 30/09).
-- O que muda:
--   - base de conhecimento (kb_articles), dicionário de siglas e gírias (kb_termos), perguntas que o
--     assistente não entendeu (kb_perguntas_sem_resposta); só quem tem manage_support lê e grava.
--   - o assistente (camada 1, sem IA): busca em português sem acento nos artigos publicados e roteiro
--     com os pedidos da própria pessoa no assunto do ingresso; sem resposta confiável, passa para humano.
--   - conversa nasce "bot" (assistente ligado e assunto com assistente) ou "humano" (as de antes ficam
--     "humano"); caixa de entrada, contador, e-mail da equipe e limite de 3 abertas só contam as humanas.
-- chat_start, chat_send, chat_update, chat_inbox, chat_notify_due e chat_messages_after_insert são
-- cópias integrais das versões em produção (lidas com pg_get_functiondef depois da cadeia acima); só os
-- trechos marcados "NOVO (3a)" mudam. chat_start mantém a checagem do 2FA do 20260930 (conferida no fim).
-- Se o 20261001 ou o 20261002 forem rodados de novo, rode este arquivo de novo depois (e o 20260930).
-- Idempotente: pode rodar de novo.
-- =============================================================================
begin;

-- 1. Busca em português sem acento ---------------------------------------------
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;
do $$
begin
  -- cópia da "portuguese" com unaccent antes do stemmer: to_tsvector com ela é IMMUTABLE (coluna gerada)
  if not exists (select 1 from pg_ts_config where cfgname = 'pt_sem_acento' and cfgnamespace = 'public'::regnamespace) then
    create text search configuration public.pt_sem_acento (copy = pg_catalog.portuguese);
    alter text search configuration public.pt_sem_acento
      alter mapping for hword, hword_part, word with extensions.unaccent, pg_catalog.portuguese_stem;
  end if;
end $$;

-- 2. Tabelas da base -----------------------------------------------------------
-- 2a. Artigos. slug = chave do seed (artigo criado no admin não tem slug).
create table if not exists public.kb_articles (
  id uuid primary key default gen_random_uuid(),
  slug text unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  title text not null check (char_length(title) between 5 and 160),
  body text not null check (char_length(body) between 10 and 3500),
  keywords text not null default '' check (char_length(keywords) <= 500),
  audience text not null default 'all' check (audience in ('all', 'participant', 'producer', 'site')),
  department_id uuid references public.chat_departments(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  origin text not null default 'manual' check (origin in ('seed', 'manual', 'atendente', 'ia')),
  source_conversation_id uuid references public.conversations(id) on delete set null,
  review_note text check (char_length(review_note) <= 1000),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- título e palavras-chave pesam mais (A) que o corpo (B)
  busca tsvector generated always as (
    setweight(to_tsvector('public.pt_sem_acento'::regconfig, title || ' ' || keywords), 'A')
    || setweight(to_tsvector('public.pt_sem_acento'::regconfig, body), 'B')
  ) stored
);
create index if not exists kb_articles_busca_idx on public.kb_articles using gin (busca);
-- uma sugestão da IA (PR 3b) por conversa
create unique index if not exists kb_articles_ia_conversa_uidx on public.kb_articles (source_conversation_id) where origin = 'ia';

-- 2b. Slugs do seed excluídos no admin: rodar o seed de novo não os traz de volta
create table if not exists public.kb_slugs_excluidos (
  slug text primary key,
  excluido_em timestamptz not null default now()
);

-- 2c. Dicionário (forma → normal): "vc" → "você". forma já sem acento e minúscula (o front normaliza;
--     o check garante), comparada palavra por palavra por chat_kb_normalizar.
create table if not exists public.kb_termos (
  id uuid primary key default gen_random_uuid(),
  forma text not null unique check (forma ~ '^[a-z0-9]{1,30}$'),
  normal text not null check (char_length(normal) between 1 and 60),
  created_at timestamptz not null default now()
);

-- 2d. Perguntas que o assistente não soube responder (normalizadas e mascaradas), com a contagem
create table if not exists public.kb_perguntas_sem_resposta (
  id uuid primary key default gen_random_uuid(),
  texto text not null check (char_length(texto) between 1 and 200),
  audience text not null check (audience in ('participant', 'producer', 'site')),
  vezes int not null default 1,
  primeira_em timestamptz not null default now(),
  ultima_em timestamptz not null default now(),
  unique (texto, audience)
);

-- 3. Colunas novas do chat -------------------------------------------------------
-- 3a. Assuntos: com assistente (padrão) e roteiro. Na 1ª vez, os três assuntos que vão direto para
--     humano (Decisão 83) e o roteiro do ingresso; depois o admin decide (rodar de novo não desfaz).
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'chat_topics' and column_name = 'bot') then
    alter table public.chat_topics add column bot boolean not null default true;
    update public.chat_topics set bot = false
    where label in ('Dia do evento: check-in e portaria', 'Meus dados e privacidade (LGPD)', 'Pagamento: cobrança, Pix ou cartão');
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'chat_topics' and column_name = 'script') then
    alter table public.chat_topics add column script text check (script in ('ingresso'));
    update public.chat_topics set script = 'ingresso'
    where audience = 'participant_evokaa' and label = 'Não recebi ou não acho meu ingresso';
  end if;
end $$;

-- 3b. Conversas: com quem está (as que já existem ficam "humano"), quando e por que passou, respostas do assistente
alter table public.conversations add column if not exists bot_state text not null default 'humano' check (bot_state in ('bot', 'humano'));
alter table public.conversations add column if not exists handoff_at timestamptz;
alter table public.conversations add column if not exists handoff_reason text;
-- regra refeita a cada rodada (a lista de motivos cresce: 'desligado' = assistente desligado no meio da conversa)
alter table public.conversations drop constraint if exists conversations_handoff_reason_check;
alter table public.conversations add constraint conversations_handoff_reason_check
  check (handoff_reason in ('pedido', 'sem_resposta', 'nao_resolveu', 'anexo', 'erro', 'atendente', 'desligado'));
alter table public.conversations add column if not exists bot_tries int not null default 0;
-- selo "Resolvida pelo assistente": só o "Sim" liga; reabrir (chat_send) e a equipe mudar o status desligam; cron não mexe
alter table public.conversations add column if not exists bot_resolveu boolean not null default false;

-- 3c. Mensagens: camada do assistente (1 = base, 2 = IA no 3b; nula na cortesia) e o estado da conversa quando a mensagem
--     chegou (gatilho abaixo). O bipe do admin assina só bot_state = 'humano': mensagem de cliente
--     com o assistente não toca; a passagem para humano (mensagem "system") toca.
alter table public.conversation_messages add column if not exists bot_layer smallint
  check (bot_layer is null or (bot_layer in (1, 2) and sender_role = 'bot'));
alter table public.conversation_messages add column if not exists bot_state text check (bot_state in ('bot', 'humano'));

-- 3d. Interruptor do assistente (nasce ligado; muda só por chat_bot_ligar)
alter table public.chat_settings add column if not exists bot_enabled boolean not null default true;

-- 4. Funções internas (ninguém de fora executa: revoke no bloco 9) ---------------------

-- 4a. Máscara de dados pessoais: regras de supabase/functions/_shared/mascara.ts (resumir), mas aqui
--     7+ dígitos viram [número] (o Evo continua em 8+): a pergunta sem resposta fica guardada.
--     ponytail: regex, não detector; prefere esconder demais.
create or replace function public.chat_kb_mascarar(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(coalesce(p, ''), '[^\s@<>()]+@[^\s@]+\.[^\s@]+', '[email]', 'g'),
          '(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)', '[cpf]', 'g'),
        '(?<!\d)(\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}(?!\d)', '[telefone]', 'g'),
      '\d(?:[^[:alpha:]0-9\n]{0,3}\d){6,}', '[número]', 'g'),
    200);
$$;

-- 4b. Texto → palavras minúsculas sem acento, trocando siglas e gírias pelo dicionário
create or replace function public.chat_kb_normalizar(p text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(string_agg(
           coalesce(lower(extensions.unaccent('extensions.unaccent'::regdictionary, t.normal)), w.palavra), ' ' order by w.n), '')
  from regexp_split_to_table(lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p, ''))), '[^a-z0-9]+')
       with ordinality as w(palavra, n)
  left join public.kb_termos t on t.forma = w.palavra
  where w.palavra <> '';
$$;

-- 4c. Termos úteis da pergunta: normalizada, sem palavras vazias (artigos, pronomes, saudações,
--     agradecimentos e enchimento), sem números soltos e sem repetição. Vazio = só cortesia.
create or replace function public.chat_kb_termos(p text)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct w), '{}')
  from regexp_split_to_table(public.chat_kb_normalizar(p), ' ') w
  where char_length(w) >= 2
    and w !~ '^[0-9]+$'
    and not (w = any (array[
      -- artigos, preposições, pronomes, conectivos
      'as', 'os', 'um', 'uma', 'uns', 'umas', 'de', 'da', 'do', 'das', 'dos', 'em', 'na', 'no', 'nas', 'nos',
      'num', 'numa', 'ao', 'aos', 'pelo', 'pela', 'pelos', 'pelas', 'por', 'pra', 'pro', 'para', 'com', 'sem',
      'sobre', 'ate', 'apos', 'entre', 'eu', 'me', 'mim', 'meu', 'minha', 'meus', 'minhas', 'voce', 'voces',
      'te', 'ti', 'tu', 'teu', 'tua', 'seu', 'sua', 'seus', 'suas', 'ele', 'ela', 'eles', 'elas', 'lhe',
      'nosso', 'nossa', 'isso', 'isto', 'esse', 'essa', 'este', 'esta', 'estes', 'estas', 'esses', 'essas',
      'aquele', 'aquela', 'aquilo', 'ai', 'la', 'aqui', 'ali', 'ca', 'que', 'qual', 'quais', 'quando',
      'onde', 'como', 'quem', 'quanto', 'porque', 'ja', 'ainda', 'mais', 'menos', 'muito', 'muita', 'muitos',
      'muitas', 'so', 'tambem', 'entao', 'mas', 'pois', 'ou', 'nem', 'se', 'nao', 'sim', 'ne', 'ta', 'to',
      'tah', 'eh', 'sao', 'ser', 'estar', 'estou', 'estava', 'foi', 'era', 'sou', 'tem', 'ter', 'tenho',
      'tinha', 'ha', 'pode', 'posso', 'poderia', 'vai', 'vou', 'fazer', 'faco', 'faz', 'fiz',
      -- enchimento de pedido
      'quero', 'queria', 'gostaria', 'saber', 'sabe', 'sei', 'favor', 'preciso', 'precisava', 'ajuda',
      'ajudar', 'duvida', 'duvidas', 'pergunta', 'alguem', 'algum', 'alguma', 'algo', 'coisa', 'tipo',
      'gente', 'pessoal', 'hoje', 'agora', 'ok', 'certo', 'entendi',
      -- saudações e agradecimentos (mensagem só com eles recebe resposta de cortesia)
      'oi', 'oii', 'oie', 'ola', 'eai', 'eae', 'iae', 'opa', 'salve', 'hey', 'alo', 'bom', 'boa', 'bons',
      'boas', 'dia', 'tarde', 'noite', 'tudo', 'bem', 'beleza', 'joia', 'tranquilo', 'obrigado', 'obrigada',
      'brigado', 'brigada', 'valeu', 'agradeco', 'grato', 'grata', 'beijos', 'abracos', 'falou'
    ]));
$$;

-- 4d. Busca nos artigos publicados do público certo. Um tsquery por termo (plainto_tsquery, combinados
--     com ||: texto cru nunca vira tsquery). acertos = termos achados no artigo; no_titulo = achados no
--     título/palavras-chave, sem contar "evokaa" (o nome da casa está em muitos títulos e não diz o assunto).
--     Com p_aprox, conta também o termo (5+ letras) parecido por trigramas com
--     uma palavra do título/palavras-chave (erro de digitação).
--     ponytail: o modo aproximado varre os publicados (centenas); limiar 0,6 calibrado no T12.
create or replace function public.chat_kb_buscar(p_q text, p_publicos text[], p_limite int, p_aprox boolean default false)
returns table (id uuid, title text, body text, termos int, acertos int, no_titulo int, rank real)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_w text[];
  v_tq tsquery[];
  v_ou tsquery;
  i int;
begin
  select array_agg(x.w order by x.w), array_agg(x.tq order by x.w) into v_w, v_tq
  from (select distinct on (y.tq::text) y.w, y.tq
        from (select w, plainto_tsquery('public.pt_sem_acento'::regconfig, w) as tq
              from unnest(public.chat_kb_termos(p_q)) w) y
        where numnode(y.tq) > 0) x;
  if v_w is null then
    return;
  end if;
  for i in 1 .. cardinality(v_tq) loop
    v_ou := case when v_ou is null then v_tq[i] else v_ou || v_tq[i] end;
  end loop;
  return query
  select a.id, a.title, a.body, cardinality(v_w),
         count(*) filter (where a.busca @@ k.tq
           or (p_aprox and char_length(k.w) >= 5 and extensions.word_similarity(k.w, a.tk) >= 0.6))::int,
         count(*) filter (where k.w <> 'evokaa' and (ts_filter(a.busca, '{a}') @@ k.tq
           or (p_aprox and char_length(k.w) >= 5 and extensions.word_similarity(k.w, a.tk) >= 0.6)))::int,
         ts_rank_cd(a.busca, v_ou)
  from (select ar.id, ar.title, ar.body, ar.busca,
               lower(extensions.unaccent('extensions.unaccent'::regdictionary, ar.title || ' ' || ar.keywords)) as tk
        from public.kb_articles ar
        where ar.status = 'published' and ar.audience = any(p_publicos)
          and (p_aprox or ar.busca @@ v_ou)) a
  cross join unnest(v_w, v_tq) as k(w, tq)
  group by a.id, a.title, a.body, a.busca
  having count(*) filter (where a.busca @@ k.tq
           or (p_aprox and char_length(k.w) >= 5 and extensions.word_similarity(k.w, a.tk) >= 0.6)) > 0
  order by 5 desc, 6 desc, 7 desc
  limit least(greatest(coalesce(p_limite, 10), 1), 50);
end;
$$;

-- 4e. Camada 2 (IA): no 3a sempre falso; o PR 3b redefine com os interruptores conferidos no servidor
create or replace function public.chat_bot_pode_ia(p_conv uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select false;
$$;

-- 4f. Passa para humano: estado, hora e motivo; zera leitura e alerta da equipe (a conversa volta a
--     aparecer como não lida e sai no e-mail da equipe) e avisa o cliente. Mensagem com clock_timestamp():
--     na mesma transação, now() empataria com a do cliente.
--     Limite de 3 conversas humanas abertas (como no chat_start), com a mesma trava por pessoa; no limite,
--     não passa e o assistente avisa. Erro do assistente e assistente desligado passam sempre (a mensagem
--     não pode ficar sem ninguém).
--     Devolve se passou. Retorno mudou (void → boolean): drop + create.
drop function if exists public.chat_bot_passar(uuid, text);
create function public.chat_bot_passar(p_conv uuid, p_motivo text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cfg jsonb;
  v_user uuid;
begin
  select c.user_id into v_user from public.conversations c where c.id = p_conv and c.status = 'open' and c.bot_state = 'bot';
  if not found then
    return false;
  end if;
  if p_motivo not in ('erro', 'atendente', 'desligado') then
    perform pg_advisory_xact_lock(hashtext('chat:' || v_user::text));
    if (select count(*) from public.conversations c where c.user_id = v_user and c.status = 'open' and c.bot_state = 'humano') >= 3 then
      insert into public.conversation_messages (conversation_id, sender_id, sender_role, sender_name, body, created_at)
      values (p_conv, null, 'bot', 'Assistente Evokaa',
              'Você já tem conversas abertas com a nossa equipe; continue por uma delas.', clock_timestamp());
      return false;
    end if;
  end if;
  update public.conversations c
  set bot_state = 'humano', handoff_at = now(), handoff_reason = p_motivo,
      agent_last_read_at = null, team_alerted_at = null, updated_at = now()
  where c.id = p_conv and c.status = 'open' and c.bot_state = 'bot';
  if not found then
    return false;
  end if;
  v_cfg := public.chat_public_settings();
  insert into public.conversation_messages (conversation_id, sender_id, sender_role, sender_name, body, created_at)
  values (p_conv, null, 'system', 'Evokaa',
          'Vou passar sua conversa para um atendente humano.'
          || case when coalesce((v_cfg ->> 'aberto_agora')::boolean, false) then ''
                  else ' Estamos fora do horário de atendimento. ' || coalesce(v_cfg ->> 'prazo', '') end,
          clock_timestamp());
  return true;
end;
$$;

-- 4g. O assistente responde (camada 1). Ordem: assistente desligado (passa) → pedido escrito de uma
--     pessoa (Decisão 83: passa) → roteiro do ingresso (1ª resposta do assunto com script) → cortesia
--     (nenhum termo útil, ou só palavras de reação e risadas: não conta tentativa nem passa) → artigo
--     confiável (busca exata; senão aproximada) → sem resposta: IA (3b) ou humano; se a conversa sai do
--     assistente, anota os termos da pergunta (mascarados).
--     Confiável: 2+ termos na pergunta, 2+ achados no artigo, cobertura >= 0,6 e mais da metade dos termos no
--     título/palavras-chave; ou 1 termo só, achado no título/palavras-chave de um único artigo.
--     ponytail: limiares e padrões fixos, calibrados no T12; mudar aqui se a base crescer.
create or replace function public.chat_bot_responder(p_conv uuid, p_texto text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c record;
  v_publicos text[];
  v_aud text;
  v_termos text[];
  v_aprox boolean;
  r record;
  v_id uuid;
  v_titulo text;
  v_corpo text;
  v_n int;
  v_acertos int;
  v_no_titulo int;
  v_com_titulo int;
  v_resposta text;
  v_tries int;
  v_norm text;
  v_pergunta text;
  v_saiu boolean;
begin
  select c.id, c.user_id, c.bot_state, c.bot_tries, t.script, p.role
    into v_c
  from public.conversations c
  left join public.chat_topics t on t.id = c.topic_id
  left join public.profiles p on p.id = c.user_id
  where c.id = p_conv;
  if v_c.bot_state is distinct from 'bot' then
    return;
  end if;
  -- desligado com a conversa já aberta com ele: a mensagem vai para a equipe (fora do limite de 3)
  if not coalesce((select s.bot_enabled from public.chat_settings s where s.id = 1), false) then
    perform public.chat_bot_passar(p_conv, 'desligado');
    return;
  end if;
  v_aud := case when v_c.role in ('user', 'customer') then 'participant'
                when v_c.role in ('producer', 'editor') then 'producer' else 'site' end;
  v_publicos := array['all', 'site', v_aud];

  -- pedido escrito de uma pessoa (estreito: "transferir o ingresso para outra pessoa" e "a operadora do
  -- cartão recusou" não são pedido)
  v_norm := public.chat_kb_normalizar(p_texto);
  if v_norm ~ '\m(atendente|humano|humana)\M'
     or v_norm ~ '\m(falar|chamar|conversar|quero)\s+(com\s+)?((um|uma|o|a)\s+)?operadora?\M'
     or v_norm ~ '\mcom\s+(um|uma|o|a)?\s*(pessoa|alguem|gente|equipe|suporte|atendimento|voces|vcs|responsavel)\M'
     or v_norm ~ '\mtem\s+alguem\M'
     or v_norm ~ '\m(nao|sem)\M.*\mrobos?\M|\mrobos?\M.*\mnao\M' then
    perform public.chat_bot_passar(p_conv, 'pedido');
    return;
  end if;

  if v_c.script = 'ingresso' and v_c.bot_tries = 0 then
    -- roteiro: os 5 pedidos mais recentes DA PRÓPRIA PESSOA, com o status honesto
    select 'Encontrei estes pedidos na sua conta (os mais recentes):' || E'\n'
           || string_agg(format('• %s · %s · R$ %s · %s', coalesce(o.title, 'Evento'),
                to_char(o.created_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'),
                translate(to_char(o.total, 'FM999,999,990.00'), ',.', '.,'),
                case o.status
                  when 'pending' then 'Pendente: o pagamento ainda não foi confirmado, e o ingresso só é emitido depois da confirmação'
                  when 'paid' then 'Pago: o ingresso fica em "Meus Ingressos"'
                  when 'failed' then 'Falhou: o pagamento não foi aprovado'
                  when 'cancelled' then 'Cancelado'
                  when 'refunded' then 'Reembolsado'
                  else o.status end), E'\n' order by o.created_at desc)
           || E'\n' || 'Se o pedido que você procura não está aqui, confira se entrou com a mesma conta usada na compra.'
      into v_resposta
    from (select od.created_at, od.total, od.status, e.title
          from public.orders od left join public.events e on e.id = od.event_id
          where od.user_id = v_c.user_id
          order by od.created_at desc limit 5) o;
    v_resposta := coalesce(v_resposta,
      'Não encontrei pedidos nesta conta. Se a compra foi feita com outra conta, entre com ela para ver o ingresso em "Meus Ingressos".');
  else
    v_termos := public.chat_kb_termos(p_texto);
    -- cortesia: nenhum termo útil, ou só palavras de reação e risadas ("perfeito", "kkk"). A lista fica aqui,
    -- sobre a mensagem inteira, e não nas palavras vazias do chat_kb_termos ("show" é categoria de evento).
    if not exists (select 1 from unnest(v_termos) w
                   where w <> all (array['perfeito', 'perfeita', 'legal', 'show', 'bola', 'ah', 'ata', 'rs', 'hmm', 'aff', 'massa', 'top', 'blz'])
                     and w !~ '^(k+|rs+|(rs)+|(ha)+|(he)+|hm+)$') then
      -- cortesia não é resposta: bot_layer nulo (a tela não pergunta "Isso resolveu?")
      insert into public.conversation_messages (conversation_id, sender_id, sender_role, sender_name, body, created_at)
      values (p_conv, null, 'bot', 'Assistente Evokaa',
              case when v_norm ~ '\m(obrigad[oa]|brigad[oa]|valeu|agradeco|grat[oa])\M'
                   then 'Por nada! Se precisar de mais alguma coisa, é só escrever.'
                   when v_norm ~ '\m(oi|oii|oie|ola|opa|eai|eae|iae|salve|hey|alo|bom dia|boa tarde|boa noite|tudo bem)\M'
                   then 'Oi! Tudo bem? Como posso ajudar?'
                   -- reação positiva ("perfeito", "show de bola", "blz"): sem pedir detalhes
                   when v_norm ~ '\m(perfeit[oa]|legal|show|bola|massa|top|beleza)\M'
                   then 'Que bom! Se precisar de mais alguma coisa, é só escrever.'
                   else 'Pode me contar com mais detalhes?' end,
              clock_timestamp());
      return;
    end if;
    foreach v_aprox in array array[false, true] loop
      v_id := null;
      v_com_titulo := 0;
      for r in select * from public.chat_kb_buscar(p_texto, v_publicos, 50, v_aprox) loop
        if v_id is null then
          v_id := r.id; v_titulo := r.title; v_corpo := r.body;
          v_n := r.termos; v_acertos := r.acertos; v_no_titulo := r.no_titulo;
        end if;
        if r.no_titulo > 0 then
          v_com_titulo := v_com_titulo + 1;
        end if;
      end loop;
      if v_id is not null and ((v_n >= 2 and v_acertos >= 2 and v_acertos >= 0.6 * v_n and v_no_titulo * 2 > v_n)
                               or (v_n = 1 and v_no_titulo > 0 and v_com_titulo = 1)) then
        v_resposta := v_titulo || E'\n\n' || v_corpo;
        exit;
      end if;
    end loop;
  end if;

  if v_resposta is null then
    -- PR 3b: com a IA, a Edge Function support-bot responde; sem ela, passa para humano
    v_saiu := public.chat_bot_pode_ia(p_conv);
    if not v_saiu then
      v_saiu := public.chat_bot_passar(p_conv, 'sem_resposta');
    end if;
    -- anota só se a conversa saiu do assistente (no limite de 3 ela fica com ele e a pessoa repete a pergunta);
    -- só os termos úteis, depois da máscara (a frase inteira pode ter nome ou outro dado da pessoa)
    v_pergunta := left(array_to_string(public.chat_kb_termos(public.chat_kb_mascarar(p_texto)), ' '), 200);
    if v_saiu and v_pergunta <> '' then
      insert into public.kb_perguntas_sem_resposta (texto, audience)
      values (v_pergunta, v_aud)
      on conflict (texto, audience) do update
        set vezes = public.kb_perguntas_sem_resposta.vezes + 1, ultima_em = now();
    end if;
    return;
  end if;

  update public.conversations c set bot_tries = c.bot_tries + 1 where c.id = p_conv
  returning c.bot_tries into v_tries;
  if v_tries >= 2 then
    v_resposta := v_resposta || E'\n\n' || 'Se ainda não resolveu, toque em "Falar com um atendente".';
  end if;
  insert into public.conversation_messages (conversation_id, sender_id, sender_role, sender_name, body, bot_layer, created_at)
  values (p_conv, null, 'bot', 'Assistente Evokaa', left(v_resposta, 4000), 1, clock_timestamp());
end;
$$;

-- 5. Funções chamadas pelo navegador --------------------------------------------

-- 5a. "Falar com um atendente" (só o cliente, conversa aberta com o assistente). Com 3 conversas humanas
--     abertas não passa, mas devolve ok: o aviso do assistente já está na conversa (a tela não repete em
--     vermelho); se outra ação a tirou do assistente, fora_do_assistente.
create or replace function public.chat_handoff(p_conv uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.chat_role(p_conv) is distinct from 'customer' then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if not exists (select 1 from public.conversations c where c.id = p_conv and c.status = 'open' and c.bot_state = 'bot') then
    return jsonb_build_object('ok', false, 'motivo', 'fora_do_assistente');
  end if;
  if not public.chat_bot_passar(p_conv, 'pedido') then
    -- ainda com o assistente = limite de 3 (ele já avisou na conversa); senão, outra ação a tirou dele
    if not exists (select 1 from public.conversations c where c.id = p_conv and c.status = 'open' and c.bot_state = 'bot') then
      return jsonb_build_object('ok', false, 'motivo', 'fora_do_assistente');
    end if;
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- 5b. "Isso resolveu?" (só o cliente). Sim: resolvida pelo assistente (status resolved, bot_state
--     fica 'bot', bot_resolveu liga o selo; sem pedir a nota de 1 a 3), só se ainda estiver aberta com o
--     assistente (corrida com "Falar com um atendente"). Não: IA no 3b; no 3a, passa para humano (no
--     limite de 3 abertas, o assistente avisa e ela fica com ele).
create or replace function public.chat_bot_feedback(p_conv uuid, p_resolveu boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.chat_role(p_conv) is distinct from 'customer' then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if p_resolveu is null then
    raise exception 'Resposta inválida' using errcode = '22023';
  end if;
  -- mesma trava do chat_send e do chat_start: o "Sim" espera a mensagem em andamento (e a resposta do assistente)
  perform pg_advisory_xact_lock(hashtext('chat:' || auth.uid()::text));
  if not exists (select 1 from public.conversations c where c.id = p_conv and c.status = 'open' and c.bot_state = 'bot') then
    return jsonb_build_object('ok', false, 'motivo', 'fora_do_assistente');
  end if;
  if p_resolveu then
    update public.conversations c set status = 'resolved', resolved_at = now(), bot_resolveu = true, updated_at = now()
    where c.id = p_conv and c.status = 'open' and c.bot_state = 'bot';
    if not found then
      return jsonb_build_object('ok', false, 'motivo', 'fora_do_assistente');
    end if;
  elsif not public.chat_bot_pode_ia(p_conv) then
    perform public.chat_bot_passar(p_conv, 'nao_resolveu');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- 5c. Interruptor do assistente (admin com manage_support)
create or replace function public.chat_bot_ligar(p_ligado boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.gf_admin_can('manage_support') then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if p_ligado is null then
    raise exception 'Valor inválido' using errcode = '22023';
  end if;
  update public.chat_settings s set bot_enabled = p_ligado, updated_at = now() where s.id = 1;
  return jsonb_build_object('ok', true);
end;
$$;

-- 6. Funções do chat em produção, com os trechos NOVO (3a) ---------------------------

-- 6a. chat_start (versão do 20261001 com a checagem do 2FA do 20260930)
create or replace function public.chat_start(
  p_topic_id uuid, p_event_id uuid, p_name text, p_phone text, p_marketing_opt_in boolean, p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_publicos text[];
  v_name text := trim(coalesce(p_name, ''));
  v_body text := trim(coalesce(p_body, ''));
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_opt boolean := coalesce(p_marketing_opt_in, false);
  v_email text;
  v_topic public.chat_topics;
  v_contact uuid;
  v_conv uuid;
  v_bot boolean;
begin
  if not public.gf_mfa_ok() then
    raise exception 'Confirme o código do 2FA' using errcode = '42501';
  end if;
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  if char_length(v_name) not between 2 and 120 then
    raise exception 'Nome inválido: use de 2 a 120 caracteres' using errcode = '22023';
  end if;
  if v_phone !~ '^55[1-9]{2}9?[0-9]{8}$' then
    raise exception 'Telefone inválido: use um número do Brasil com DDD' using errcode = '22023';
  end if;
  if char_length(v_body) not between 1 and 4000 then
    raise exception 'Mensagem inválida: escreva de 1 a 4.000 caracteres' using errcode = '22023';
  end if;

  select p.role into v_role from public.profiles p where p.id = v_uid;
  if v_role is null then
    raise exception 'Perfil não encontrado' using errcode = '42501';
  end if;
  v_publicos := array['site'] || case
    when v_role in ('user', 'customer') then array['participant_evokaa']
    when v_role in ('producer', 'editor') then array['producer']
    else array[]::text[]
  end;

  select * into v_topic from public.chat_topics t where t.id = p_topic_id and t.active;
  if v_topic.audience = 'participant_producer' or p_event_id is not null then
    return jsonb_build_object('ok', false, 'motivo', 'nao_disponivel');
  end if;
  if v_topic.id is null or not (v_topic.audience = any(v_publicos)) then
    return jsonb_build_object('ok', false, 'motivo', 'assunto_invalido');
  end if;

  -- serializa as escritas da mesma pessoa (chat_start e chat_send) para os limites valerem
  perform pg_advisory_xact_lock(hashtext('chat:' || v_uid::text));
  -- NOVO (3a): o limite de 3 abertas conta só as humanas, e conversa que nasce com o assistente não esbarra nele
  v_bot := coalesce((select s.bot_enabled from public.chat_settings s where s.id = 1), false) and v_topic.bot;
  if not v_bot and (select count(*) from public.conversations c where c.user_id = v_uid and c.status = 'open' and c.bot_state = 'humano') >= 3 then
    return jsonb_build_object('ok', false, 'motivo', 'limite_abertas');
  end if;
  if (select count(*) from public.conversations c
      where c.user_id = v_uid and c.created_at > now() - interval '1 hour') >= 5 then
    return jsonb_build_object('ok', false, 'motivo', 'limite_hora');
  end if;

  -- e-mail sempre o da conta (nunca digitado)
  select u.email into v_email from auth.users u where u.id = v_uid;
  v_email := case when lower(v_email) ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then lower(v_email) end;

  insert into public.chat_contacts (user_id, name, email, phone, origin, marketing_opt_in, marketing_opt_in_at)
  values (v_uid, v_name, v_email, v_phone,
          case when v_topic.audience = 'site' then 'site' else 'app' end,
          v_opt, case when v_opt then now() end)
  on conflict (user_id) do update
    set name = excluded.name,
        email = excluded.email,
        phone = excluded.phone,
        marketing_opt_in = excluded.marketing_opt_in,
        marketing_opt_in_at = case
          when not excluded.marketing_opt_in then null
          when public.chat_contacts.marketing_opt_in then public.chat_contacts.marketing_opt_in_at
          else now() end,
        updated_at = now()
  returning id into v_contact;

  -- formato do PhoneInput (+55…), só se o perfil ainda não tem telefone
  update public.profiles p set phone = '+' || v_phone
  where p.id = v_uid and coalesce(p.phone, '') = '';

  -- NOVO (3a): nasce com o assistente quando ele está ligado e o assunto tem assistente (v_bot, acima)
  insert into public.conversations (contact_id, user_id, kind, topic_id, department_id, priority, bot_state)
  values (v_contact, v_uid, 'evokaa', v_topic.id, v_topic.department_id,
          case when v_topic.urgent then 'urgent' else 'normal' end,
          case when v_bot then 'bot' else 'humano' end)
  returning id into v_conv;

  insert into public.conversation_messages (conversation_id, sender_id, sender_role, sender_name, body)
  values (v_conv, v_uid, 'customer', v_name, v_body);

  -- NOVO (3a): o assistente responde na mesma transação; erro dele passa para humano e nunca derruba
  -- a mensagem do cliente
  if v_bot then
    begin
      perform public.chat_bot_responder(v_conv, v_body);
    exception when others then
      raise warning 'chat_bot_responder (%): %', v_conv, sqlerrm;
      perform public.chat_bot_passar(v_conv, 'erro');
    end;
  end if;

  return jsonb_build_object('ok', true, 'id', v_conv);
end;
$$;

-- 6b. chat_send (versão do 20261002)
create or replace function public.chat_send(
  p_conv uuid, p_body text, p_is_internal boolean, p_attachment_path text, p_attachment_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text := public.chat_role(p_conv);
  v_body text := trim(coalesce(p_body, ''));
  v_internal boolean := coalesce(p_is_internal, false);
  v_path text := nullif(trim(coalesce(p_attachment_path, '')), '');
  v_meta jsonb;
  v_mime text;
  v_name text;
  v_sender text;
  v_id uuid;
begin
  if v_uid is null or v_role is null then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if v_internal and v_role = 'customer' then
    raise exception 'Nota interna é só da equipe' using errcode = '42501';
  end if;
  if char_length(v_body) > 4000 then
    raise exception 'Mensagem longa demais: até 4.000 caracteres' using errcode = '22023';
  end if;
  if v_body = '' and v_path is null then
    raise exception 'Mensagem vazia' using errcode = '22023';
  end if;

  if v_path is not null then
    if v_internal then
      raise exception 'Nota interna não leva anexo' using errcode = '22023';
    end if;
    if not starts_with(v_path, p_conv::text || '/') then
      raise exception 'Anexo de outra conversa' using errcode = '22023';
    end if;
    select o.metadata into v_meta
    from storage.objects o
    where o.bucket_id = 'chat-anexos' and o.name = v_path;
    if not found then
      raise exception 'Anexo não encontrado' using errcode = '22023';
    end if;
    v_mime := v_meta ->> 'mimetype';
    if coalesce(v_mime, '') not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') then
      raise exception 'Tipo de anexo não aceito' using errcode = '22023';
    end if;
    v_name := left(coalesce(nullif(trim(coalesce(p_attachment_name, '')), ''), split_part(v_path, '/', 2)), 200);
  end if;

  perform pg_advisory_xact_lock(hashtext('chat:' || v_uid::text));
  if (select count(*) from public.conversation_messages m
      where m.sender_id = v_uid and m.created_at > now() - interval '1 minute') >= 20 then
    return jsonb_build_object('ok', false, 'motivo', 'limite_minuto');
  end if;

  if v_role = 'customer' then
    -- reabrir conta no limite de 3 abertas, como no chat_start
    -- NOVO (3a): só as humanas contam, e reabrir conversa do assistente não esbarra no limite
    if (select c.status = 'resolved' and c.bot_state = 'humano' from public.conversations c where c.id = p_conv)
       and (select count(*) from public.conversations c where c.user_id = v_uid and c.status = 'open' and c.bot_state = 'humano') >= 3 then
      return jsonb_build_object('ok', false, 'motivo', 'limite_abertas');
    end if;
    select ct.name into v_sender
    from public.conversations c join public.chat_contacts ct on ct.id = c.contact_id
    where c.id = p_conv;
    -- NOVO (3a): reabrir tira o selo "Resolvida pelo assistente"
    update public.conversations c
    set status = 'open', resolved_at = null, bot_resolveu = false, updated_at = now()
    where c.id = p_conv and c.status = 'resolved';
  end if;
  -- cliente: nome do contato (ou do perfil); equipe e produtor: só o primeiro nome
  if v_sender is null then
    select left(case when v_role = 'customer' then nullif(trim(p.full_name), '')
                     else nullif(split_part(trim(p.full_name), ' ', 1), '') end, 120)
      into v_sender from public.profiles p where p.id = v_uid;
  end if;
  v_sender := coalesce(v_sender, case v_role when 'agent' then 'Equipe Evokaa' when 'producer' then 'Produtor' else 'Cliente' end);

  insert into public.conversation_messages (
    conversation_id, sender_id, sender_role, sender_name, body, is_internal,
    attachment_path, attachment_name, attachment_mime, attachment_size
  )
  values (p_conv, v_uid, v_role, v_sender, v_body, v_internal,
          v_path, v_name, v_mime, (v_meta ->> 'size')::bigint)
  returning id into v_id;

  -- NOVO (20261002): 1ª resposta de atendente numa conversa sem dono atribui a ela (nota interna não)
  if v_role = 'agent' and not v_internal then
    update public.conversations c
    set assignee_id = v_uid,
        assignee_name = (select left(nullif(split_part(trim(p.full_name), ' ', 1), ''), 60) from public.profiles p where p.id = v_uid)
    where c.id = p_conv and c.assignee_id is null;
    -- NOVO (3a): resposta pública de atendente tira a conversa do assistente
    update public.conversations c
    set bot_state = 'humano', handoff_at = coalesce(c.handoff_at, now()), handoff_reason = coalesce(c.handoff_reason, 'atendente')
    where c.id = p_conv and c.bot_state = 'bot';
  end if;

  -- NOVO (3a): mensagem do cliente em conversa com o assistente: ele responde (anexo passa para
  -- humano: o assistente não lê arquivo); erro dele passa para humano sem derrubar a mensagem
  if v_role = 'customer' and (select c.bot_state from public.conversations c where c.id = p_conv) = 'bot' then
    begin
      if v_path is not null then
        perform public.chat_bot_passar(p_conv, 'anexo');
      else
        perform public.chat_bot_responder(p_conv, v_body);
      end if;
    exception when others then
      raise warning 'chat_bot_responder (%): %', p_conv, sqlerrm;
      perform public.chat_bot_passar(p_conv, 'erro');
    end;
  end if;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- 6c. chat_update (versão do 20261002)
create or replace function public.chat_update(p_conv uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uuid_re constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  v_chave text;
  v_assignee uuid;
  v_dept uuid;
begin
  if public.chat_role(p_conv) is distinct from 'agent' then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if jsonb_typeof(p_patch) is distinct from 'object' or p_patch = '{}'::jsonb then
    raise exception 'Alteração vazia' using errcode = '22023';
  end if;
  for v_chave in select jsonb_object_keys(p_patch) loop
    if v_chave not in ('status', 'assignee_id', 'priority', 'department_id') then
      raise exception 'Campo não permitido: %', left(v_chave, 40) using errcode = '22023';
    end if;
  end loop;

  if p_patch ? 'status' and coalesce(p_patch ->> 'status', '') not in ('open', 'resolved') then
    raise exception 'Status inválido' using errcode = '22023';
  end if;
  if p_patch ? 'priority' and coalesce(p_patch ->> 'priority', '') not in ('normal', 'urgent') then
    raise exception 'Prioridade inválida' using errcode = '22023';
  end if;
  if p_patch ? 'assignee_id' and jsonb_typeof(p_patch -> 'assignee_id') <> 'null' then
    if coalesce(p_patch ->> 'assignee_id', '') !~ v_uuid_re then
      raise exception 'Responsável inválido' using errcode = '22023';
    end if;
    v_assignee := (p_patch ->> 'assignee_id')::uuid;
    if not exists (
      select 1 from public.profiles pr
      where pr.id = v_assignee and pr.role = 'admin'
        and pr.admin_permissions && array['super_admin', 'manage_support']
    ) then
      raise exception 'Responsável precisa ser admin com a permissão de atendimento' using errcode = '22023';
    end if;
  end if;
  if p_patch ? 'department_id' then
    if coalesce(p_patch ->> 'department_id', '') !~ v_uuid_re then
      raise exception 'Setor inválido' using errcode = '22023';
    end if;
    v_dept := (p_patch ->> 'department_id')::uuid;
    if not exists (select 1 from public.chat_departments d where d.id = v_dept) then
      raise exception 'Setor inválido' using errcode = '22023';
    end if;
  end if;

  update public.conversations c set
    status = case when p_patch ? 'status' then p_patch ->> 'status' else c.status end,
    resolved_at = case
      when not (p_patch ? 'status') then c.resolved_at
      when p_patch ->> 'status' = 'resolved' then coalesce(c.resolved_at, now())
      else null end,
    assignee_id = case when p_patch ? 'assignee_id' then v_assignee else c.assignee_id end,
    -- NOVO (20261002): primeiro nome do novo dono (nulo = sem dono)
    assignee_name = case when p_patch ? 'assignee_id'
      then (select left(nullif(split_part(trim(p.full_name), ' ', 1), ''), 60) from public.profiles p where p.id = v_assignee)
      else c.assignee_name end,
    priority = case when p_patch ? 'priority' then p_patch ->> 'priority' else c.priority end,
    department_id = case when p_patch ? 'department_id' then v_dept else c.department_id end,
    -- NOVO (3a): atribuir um dono tira a conversa do assistente
    bot_state = case when v_assignee is not null then 'humano' else c.bot_state end,
    handoff_at = case when v_assignee is not null and c.bot_state = 'bot' then coalesce(c.handoff_at, now()) else c.handoff_at end,
    handoff_reason = case when v_assignee is not null and c.bot_state = 'bot' then coalesce(c.handoff_reason, 'atendente') else c.handoff_reason end,
    -- NOVO (3a): a equipe mudar o status (reabrir ou resolver) tira o selo "Resolvida pelo assistente"
    bot_resolveu = case when p_patch ? 'status' then false else c.bot_resolveu end,
    updated_at = now()
  where c.id = p_conv;

  return jsonb_build_object('ok', true);
end;
$$;

-- 6d. chat_inbox: o retorno muda (bot_state, handoff_at, bot_resolveu), então drop + create. Filtro novo
--     "assistente" (abertas com o assistente); abertas, minhas, sem dono e urgentes só humanas.
drop function if exists public.chat_inbox(text, text, int);
create function public.chat_inbox(p_filtro text, p_busca text, p_limite int)
returns table (
  id uuid, user_id uuid, contact_id uuid, kind text, status text, priority text,
  assignee_id uuid, department_id uuid, department_name text, topic_label text, mediation boolean,
  contact_name text, contact_email text, contact_phone text,
  last_message_at timestamptz, last_message_preview text,
  last_customer_message_at timestamptz, last_reply_at timestamptz,
  agent_last_read_at timestamptz, customer_last_read_at timestamptz,
  nao_lida boolean, created_at timestamptz, resolved_at timestamptz, rating smallint,
  bot_state text, handoff_at timestamptz, bot_resolveu boolean
)
language plpgsql
stable
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_busca text := lower(trim(coalesce(p_busca, '')));
begin
  if coalesce(p_filtro, '') not in ('minhas', 'sem_dono', 'urgentes', 'mediacao', 'abertas', 'resolvidas', 'assistente') then
    raise exception 'Filtro inválido' using errcode = '22023';
  end if;
  return query
  select c.id, c.user_id, c.contact_id, c.kind, c.status, c.priority,
         c.assignee_id, c.department_id, d.name, t.label, coalesce(t.mediation, false),
         ct.name, ct.email, ct.phone,
         c.last_message_at, c.last_message_preview,
         c.last_customer_message_at, c.last_reply_at,
         c.agent_last_read_at, c.customer_last_read_at,
         coalesce(c.last_customer_message_at > coalesce(c.agent_last_read_at, '-infinity'), false),
         c.created_at, c.resolved_at, c.rating,
         c.bot_state, c.handoff_at, c.bot_resolveu
  from public.conversations c
  left join public.chat_departments d on d.id = c.department_id
  left join public.chat_topics t on t.id = c.topic_id
  left join public.chat_contacts ct on ct.id = c.contact_id
  where case p_filtro
      when 'minhas' then c.status = 'open' and c.bot_state = 'humano' and c.assignee_id = (select auth.uid())
      when 'sem_dono' then c.status = 'open' and c.bot_state = 'humano' and c.assignee_id is null
      when 'urgentes' then c.status = 'open' and c.bot_state = 'humano' and c.priority = 'urgent'
      when 'mediacao' then coalesce(t.mediation, false)
      when 'abertas' then c.status = 'open' and c.bot_state = 'humano'
      when 'assistente' then c.status = 'open' and c.bot_state = 'bot'
      else c.status = 'resolved'
    end
    and (v_busca = ''
      or position(v_busca in lower(coalesce(ct.name, ''))) > 0
      or position(v_busca in lower(coalesce(ct.email, ''))) > 0
      or position(v_busca in coalesce(ct.phone, '')) > 0
      or exists (
        select 1 from public.conversation_messages m
        where m.conversation_id = c.id and position(v_busca in lower(m.body)) > 0
      ))
  order by c.last_message_at desc
  limit least(greatest(coalesce(p_limite, 50), 1), 200);
end;
$$;

-- 6e. chat_notify_due: alerta à equipe só de conversa humana (cópia integral; NOVO marcado)
create or replace function public.chat_notify_due()
returns table (
  tipo text, conversation_id uuid, email text, nome text, assunto text, urgente boolean, previa text
)
language sql
volatile
security definer
set search_path = ''
as $$
  with cli as (
    select 'cliente'::text as tipo, c.id, u.email::text as email,
           coalesce(ct.name, 'cliente') as nome, coalesce(t.label, 'Atendimento') as assunto,
           c.priority = 'urgent' as urgente, null::text as previa
    from public.conversations c
    join auth.users u on u.id = c.user_id
    left join public.chat_contacts ct on ct.id = c.contact_id
    left join public.chat_topics t on t.id = c.topic_id
    where c.last_reply_at < now() - interval '5 minutes'
      and c.last_reply_at > greatest(coalesce(c.customer_last_read_at, '-infinity'),
                                     coalesce(c.customer_emailed_at, '-infinity'))
      and u.email is not null
      and u.deleted_at is null
      and c.notify_failures < 5
      and (c.notify_claimed_until is null or c.notify_claimed_until < now())
    order by c.priority = 'urgent' desc, c.last_reply_at
    limit 50
    for update of c skip locked
  ),
  eq as (
    select 'equipe'::text as tipo, c.id, s.team_email as email,
           coalesce(ct.name, 'Sem nome') as nome, coalesce(t.label, 'Sem assunto') as assunto,
           c.priority = 'urgent' as urgente, c.last_message_preview as previa
    from public.conversations c
    join public.chat_settings s on s.id = 1
    left join public.chat_contacts ct on ct.id = c.contact_id
    left join public.chat_topics t on t.id = c.topic_id
    where c.status = 'open'
      and c.kind = 'evokaa'
      and c.bot_state = 'humano'  -- NOVO (3a): conversa com o assistente não alerta a equipe
      and c.last_customer_message_at > greatest(coalesce(c.agent_last_read_at, '-infinity'),
                                                coalesce(c.team_alerted_at, '-infinity'))
      and (c.team_alerted_at is null or c.team_alerted_at < now() - interval '30 minutes')
      and (c.team_alerted_at is null or c.priority = 'urgent'
           or c.last_customer_message_at < now() - interval '5 minutes')
      and (c.notify_claimed_until is null or c.notify_claimed_until < now())
    order by c.priority = 'urgent' desc, c.last_customer_message_at
    limit 50
    for update of c skip locked
  ),
  reserva as (
    update public.conversations c
    set notify_claimed_until = now() + interval '2 minutes'
    where c.id in (select cli.id from cli union select eq.id from eq)
  )
  select cli.tipo, cli.id, cli.email, cli.nome, cli.assunto, cli.urgente, cli.previa from cli
  union all
  select eq.tipo, eq.id, eq.email, eq.nome, eq.assunto, eq.urgente, eq.previa from eq;
$$;

-- 6f. Gatilho de resumo (cópia integral; NOVO marcado): mensagem do assistente e do sistema não
--     mexe na prévia (o e-mail à equipe mostra a pergunta do cliente)
create or replace function public.chat_messages_after_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_internal then
    return null;
  end if;
  update public.conversations c set
    last_message_at = new.created_at,
    last_message_preview = case when new.sender_role in ('bot', 'system') then c.last_message_preview  -- NOVO (3a)
                                else left(case when new.body <> '' then new.body
                                               else 'Anexo: ' || coalesce(new.attachment_name, 'arquivo') end, 140) end,
    last_customer_message_at = case when new.sender_role = 'customer' then new.created_at else c.last_customer_message_at end,
    -- quem escreve leu a conversa até ali
    customer_last_read_at = case when new.sender_role = 'customer'
                                 then greatest(coalesce(c.customer_last_read_at, '-infinity'), new.created_at)
                                 else c.customer_last_read_at end,
    agent_last_read_at = case when new.sender_role in ('agent', 'producer')
                              then greatest(coalesce(c.agent_last_read_at, '-infinity'), new.created_at)
                              else c.agent_last_read_at end,
    last_reply_at = case when new.sender_role in ('agent', 'producer') then new.created_at else c.last_reply_at end,
    first_response_at = case when new.sender_role in ('agent', 'producer') and c.first_response_at is null
                             then new.created_at else c.first_response_at end,
    notify_failures = 0,  -- mensagem nova: a conversa volta a poder avisar
    updated_at = now()
  where c.id = new.conversation_id;
  return null;
end;
$$;

-- 6g. NOVO (3a): cada mensagem guarda o estado da conversa quando chegou (bipe do admin)
create or replace function public.chat_messages_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.bot_state := (select c.bot_state from public.conversations c where c.id = new.conversation_id);
  return new;
end;
$$;
drop trigger if exists chat_messages_before_insert on public.conversation_messages;
create trigger chat_messages_before_insert
  before insert on public.conversation_messages
  for each row execute function public.chat_messages_before_insert();

-- 6h. Artigo do seed excluído no admin: guarda o slug (o seed não o traz de volta)
create or replace function public.kb_articles_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.slug is not null then
    insert into public.kb_slugs_excluidos (slug) values (old.slug) on conflict (slug) do nothing;
  end if;
  return null;
end;
$$;
drop trigger if exists kb_articles_after_delete on public.kb_articles;
create trigger kb_articles_after_delete
  after delete on public.kb_articles
  for each row execute function public.kb_articles_after_delete();

-- 7. RLS da base: só manage_support lê e grava (o assistente lê pelas funções SECURITY DEFINER) ------
alter table public.kb_articles enable row level security;
alter table public.kb_slugs_excluidos enable row level security;
alter table public.kb_termos enable row level security;
alter table public.kb_perguntas_sem_resposta enable row level security;

revoke all on public.kb_articles, public.kb_slugs_excluidos, public.kb_termos, public.kb_perguntas_sem_resposta
  from anon, authenticated;
grant select, delete on public.kb_articles to authenticated;
-- slug, review_note e busca não se gravam pelo navegador; origem só manual/atendente (regra abaixo)
grant insert (title, body, keywords, audience, department_id, status, origin, source_conversation_id, created_by)
  on public.kb_articles to authenticated;
grant update (title, body, keywords, audience, department_id, status, updated_at) on public.kb_articles to authenticated;
grant select, insert, update, delete on public.kb_termos to authenticated;
grant select, delete on public.kb_perguntas_sem_resposta to authenticated;

drop policy if exists kb_articles_select on public.kb_articles;
create policy kb_articles_select on public.kb_articles
  for select to authenticated using ((select public.gf_admin_can('manage_support')));
drop policy if exists kb_articles_insert on public.kb_articles;
create policy kb_articles_insert on public.kb_articles
  for insert to authenticated
  with check ((select public.gf_admin_can('manage_support')) and origin in ('manual', 'atendente')
              and created_by = (select auth.uid()));
drop policy if exists kb_articles_update on public.kb_articles;
create policy kb_articles_update on public.kb_articles
  for update to authenticated
  using ((select public.gf_admin_can('manage_support'))) with check ((select public.gf_admin_can('manage_support')));
drop policy if exists kb_articles_delete on public.kb_articles;
create policy kb_articles_delete on public.kb_articles
  for delete to authenticated using ((select public.gf_admin_can('manage_support')));

drop policy if exists kb_termos_admin on public.kb_termos;
create policy kb_termos_admin on public.kb_termos
  for all to authenticated
  using ((select public.gf_admin_can('manage_support'))) with check ((select public.gf_admin_can('manage_support')));

drop policy if exists kb_perguntas_admin on public.kb_perguntas_sem_resposta;
create policy kb_perguntas_admin on public.kb_perguntas_sem_resposta
  for all to authenticated using ((select public.gf_admin_can('manage_support')));
-- kb_slugs_excluidos: nenhuma regra para o navegador (só o gatilho grava)

-- 8. Conversa esquecida com o assistente: resolvida sozinha depois de 24 h parada ------
select cron.unschedule('chat_bot_paradas') where exists (select 1 from cron.job where jobname = 'chat_bot_paradas');
select cron.schedule('chat_bot_paradas', '7 * * * *', $cron$
  update public.conversations
  set status = 'resolved', resolved_at = now(), updated_at = now()
  where status = 'open' and bot_state = 'bot' and last_message_at < now() - interval '24 hours';
$cron$);

-- 8b. Perguntas sem resposta guardadas por até 30 dias (Decisão 97; contados da última vez que apareceram)
select cron.unschedule('kb_perguntas_limpeza') where exists (select 1 from cron.job where jobname = 'kb_perguntas_limpeza');
select cron.schedule('kb_perguntas_limpeza', '17 4 * * *', $cron$
  delete from public.kb_perguntas_sem_resposta where ultima_em < now() - interval '30 days';
$cron$);

-- 9. Quem executa o quê ------------------------------------------------------------
revoke all on function public.chat_kb_mascarar(text) from public, anon, authenticated, service_role;
revoke all on function public.chat_kb_normalizar(text) from public, anon, authenticated, service_role;
revoke all on function public.chat_kb_termos(text) from public, anon, authenticated, service_role;
revoke all on function public.chat_kb_buscar(text, text[], int, boolean) from public, anon, authenticated, service_role;
revoke all on function public.chat_bot_pode_ia(uuid) from public, anon, authenticated, service_role;
revoke all on function public.chat_bot_passar(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.chat_bot_responder(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.chat_messages_before_insert() from public, anon, authenticated, service_role;
revoke all on function public.kb_articles_after_delete() from public, anon, authenticated, service_role;

revoke all on function public.chat_handoff(uuid) from public, anon, authenticated, service_role;
grant execute on function public.chat_handoff(uuid) to authenticated;
revoke all on function public.chat_bot_feedback(uuid, boolean) from public, anon, authenticated, service_role;
grant execute on function public.chat_bot_feedback(uuid, boolean) to authenticated;
revoke all on function public.chat_bot_ligar(boolean) from public, anon, authenticated, service_role;
grant execute on function public.chat_bot_ligar(boolean) to authenticated;

-- as de produção: create or replace mantém os privilégios; reafirmados como nos arquivos de origem
revoke all on function public.chat_start(uuid, uuid, text, text, boolean, text) from public, anon, authenticated, service_role;
grant execute on function public.chat_start(uuid, uuid, text, text, boolean, text) to authenticated;
revoke all on function public.chat_send(uuid, text, boolean, text, text) from public, anon, authenticated, service_role;
grant execute on function public.chat_send(uuid, text, boolean, text, text) to authenticated;
revoke all on function public.chat_update(uuid, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.chat_update(uuid, jsonb) to authenticated;
-- chat_inbox foi recriada (drop): permissões refeitas
revoke all on function public.chat_inbox(text, text, int) from public, anon, authenticated, service_role;
grant execute on function public.chat_inbox(text, text, int) to authenticated;
revoke all on function public.chat_notify_due() from public, anon, authenticated, service_role;
grant execute on function public.chat_notify_due() to service_role;
revoke all on function public.chat_messages_after_insert() from public, anon, authenticated, service_role;

-- 10. Dicionário inicial (só na 1ª vez; depois o admin edita) -----------------------------
insert into public.kb_termos (forma, normal)
select v.forma, v.normal
from (values
  ('vc', 'você'), ('vcs', 'vocês'), ('tb', 'também'), ('tbm', 'também'), ('tmb', 'também'), ('tbem', 'também'),
  ('pq', 'porque'), ('pqe', 'porque'), ('q', 'que'), ('oq', 'o que'), ('n', 'não'), ('nn', 'não'), ('naum', 'não'),
  ('td', 'tudo'), ('tds', 'todos'), ('msg', 'mensagem'), ('msgs', 'mensagens'), ('qdo', 'quando'), ('qnd', 'quando'),
  ('qndo', 'quando'), ('qto', 'quanto'), ('qt', 'quanto'), ('qnt', 'quanto'), ('qts', 'quantos'), ('obg', 'obrigado'),
  ('obgd', 'obrigado'), ('obgda', 'obrigada'), ('brigadu', 'obrigado'), ('blz', 'beleza'), ('vlw', 'valeu'),
  ('flw', 'falou'), ('cmg', 'comigo'), ('hj', 'hoje'), ('amnh', 'amanhã'), ('amanha', 'amanhã'), ('pfv', 'por favor'),
  ('pfvr', 'por favor'), ('pf', 'por favor'), ('plz', 'por favor'), ('pls', 'por favor'), ('ingr', 'ingresso'),
  ('ingres', 'ingresso'), ('ingrs', 'ingressos'), ('ingressso', 'ingresso'), ('qrcode', 'qr code'), ('qrcod', 'qr code'),
  ('mt', 'muito'), ('mto', 'muito'), ('mta', 'muita'), ('mts', 'muitos'), ('cd', 'cadê'), ('cade', 'cadê'),
  ('dps', 'depois'), ('agr', 'agora'), ('ngm', 'ninguém'), ('nd', 'nada'), ('ctz', 'certeza'), ('vdd', 'verdade'),
  ('fds', 'fim de semana'), ('aki', 'aqui'), ('aq', 'aqui'), ('eh', 'é'), ('d', 'de'), ('p', 'para'), ('pra', 'para'),
  ('cel', 'celular'), ('tel', 'telefone'), ('fone', 'telefone'), ('whats', 'whatsapp'), ('zap', 'whatsapp'),
  ('wpp', 'whatsapp'), ('insta', 'instagram'), ('email', 'e-mail'), ('emails', 'e-mails'),
  ('logar', 'entrar'), ('loguei', 'entrei'), ('login', 'entrar'), ('pgto', 'pagamento'), ('pagto', 'pagamento'),
  ('vlr', 'valor'), ('nf', 'nota fiscal'), ('pd', 'pode'), ('tava', 'estava')
) as v(forma, normal)
where not exists (select 1 from public.kb_termos)
on conflict (forma) do nothing;

-- 11. Conferência obrigatória: se faltar algo, nada deste arquivo é gravado -----------------
do $$
declare
  v_faltam text;
begin
  -- 2FA: o chat_start recriado aqui e o chat_role continuam com a checagem do 20260930
  select string_agg(f, ', ') into v_faltam
  from unnest(array['chat_start', 'chat_role']) f
  where position('gf_mfa_ok' in pg_get_functiondef(('public.' || f)::regproc)) = 0;
  if v_faltam is not null then
    raise exception 'funções sem a checagem do 2FA: %', v_faltam;
  end if;
  -- tabelas novas com a regra restritiva do 2FA (criada pelo gatilho rls_auto_enable do 20260930)
  select string_agg(t, ', ') into v_faltam
  from unnest(array['kb_articles', 'kb_slugs_excluidos', 'kb_termos', 'kb_perguntas_sem_resposta']) t
  where not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t
                    and p.policyname = 'gf_mfa_aal2' and p.permissive = 'RESTRICTIVE');
  if v_faltam is not null then
    raise exception 'tabelas sem gf_mfa_aal2 (rodar de novo o 20260930_2fa_no_banco.sql): %', v_faltam;
  end if;
  -- busca imutável: a configuração existe e usa unaccent
  if to_tsvector('public.pt_sem_acento'::regconfig, 'Não') <> to_tsvector('public.pt_sem_acento'::regconfig, 'nao') then
    raise exception 'pt_sem_acento não tira acento';
  end if;
end;
$$;

commit;

-- =============================================================================
-- Testes T1–T17 (rodar num banco descartável: imagem supabase/postgres com os stubs do chat, depois de
-- 20261001 → 20261002 → 20260930 → este arquivo → 20261003_kb_seed.sql). Tudo em begin … rollback.
-- Cada teste termina com "NOTICE: Tn OK"; falha = ERROR. O T12 usa frases candidatas que o Ricardo
-- ainda revisa (lista no relatório do PR); falha com qualquer resposta confiante e errada, pedido ou passagem
-- errados, ou com mais de 2 frases que esperam um artigo e passam para humano.
-- =============================================================================
/*
begin;
create function pg_temp.como(p uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), true);
  perform set_config('request.jwt.claims', case when p is null then '' else json_build_object('sub', p, 'role', 'authenticated', 'aal', 'aal1')::text end, true);
  perform set_config('role', case when p is null then 'postgres' else 'authenticated' end, true);
end $f$;
create function pg_temp.erro(q text) returns text language plpgsql as $f$
begin execute q; return 'ok'; exception when others then return sqlstate; end $f$;
create function pg_temp.topico(p_aud text, p_label text) returns uuid language sql as $f$
  select id from public.chat_topics where audience = p_aud and label = p_label $f$;
-- fila sem as reservas das leituras anteriores
create function pg_temp.fila() returns table (tipo text, conversation_id uuid) language sql as $f$
  update public.conversations set notify_claimed_until = null where notify_claimed_until is not null;
  select tipo, conversation_id from public.chat_notify_due();
$f$;
-- conversa "bot" criada direto (sem os limites do chat_start), para o T12
create function pg_temp.conversa_bot(p_user uuid) returns uuid language sql as $f$
  insert into public.conversations (user_id, kind, bot_state) values (p_user, 'evokaa', 'bot') returning id $f$;
-- o que o assistente fez: slug do artigo, cortesia, pedido de detalhes, pedido escrito de uma pessoa ou passa
create function pg_temp.resultado(p_conv uuid) returns text language sql as $f$
  select case
    when c.bot_state = 'humano' and c.handoff_reason = 'pedido' then 'pedido'
    when c.bot_state = 'humano' then 'passa'
    when m.body like 'Oi! Tudo bem?%' or m.body like 'Por nada!%' or m.body like 'Que bom!%' then 'cortesia'
    when m.body = 'Pode me contar com mais detalhes?' then 'detalhes'
    else coalesce((select a.slug from public.kb_articles a where m.body like a.title || E'\n\n%' order by char_length(a.title) desc limit 1), 'outro: ' || left(m.body, 40))
  end
  from public.conversations c
  left join lateral (select body from public.conversation_messages where conversation_id = c.id and sender_role = 'bot' order by created_at desc limit 1) m on true
  where c.id = p_conv $f$;

insert into auth.users (id, email) values
  ('f0000000-0000-4000-8000-000000000001', 'cli@teste.evokaa.invalid'),
  ('f0000000-0000-4000-8000-000000000002', 'cli2@teste.evokaa.invalid'),
  ('f0000000-0000-4000-8000-000000000003', 'prod@teste.evokaa.invalid'),
  ('f0000000-0000-4000-8000-000000000004', 'ana@teste.evokaa.invalid'),
  ('f0000000-0000-4000-8000-000000000005', 'xavier@teste.evokaa.invalid'),
  ('f0000000-0000-4000-8000-000000000006', 'mfa@teste.evokaa.invalid');
insert into public.profiles (id, email, full_name, role, admin_permissions) values
  ('f0000000-0000-4000-8000-000000000001', 'cli@teste.evokaa.invalid', 'Carla Cliente', 'user', '{}'),
  ('f0000000-0000-4000-8000-000000000002', 'cli2@teste.evokaa.invalid', 'Dora Outra', 'user', '{}'),
  ('f0000000-0000-4000-8000-000000000003', 'prod@teste.evokaa.invalid', 'Paulo Produtor', 'producer', '{}'),
  ('f0000000-0000-4000-8000-000000000004', 'ana@teste.evokaa.invalid', 'Ana Atendente', 'admin', '{manage_support}'),
  ('f0000000-0000-4000-8000-000000000005', 'xavier@teste.evokaa.invalid', 'Xavier', 'admin', '{manage_feedback}'),
  ('f0000000-0000-4000-8000-000000000006', 'mfa@teste.evokaa.invalid', 'Mara Fator', 'user', '{}');
insert into auth.mfa_factors (user_id, status) values ('f0000000-0000-4000-8000-000000000006', 'verified');
insert into public.events (id, title) values ('e1000000-0000-4000-8000-000000000001', 'Forró da Lua'), ('e1000000-0000-4000-8000-000000000002', 'Show Secreto');
insert into public.orders (user_id, event_id, total, status, created_at) values
  ('f0000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 60, 'pending', now() - interval '1 day'),
  ('f0000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 1234.5, 'paid', now() - interval '2 days'),
  ('f0000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000002', 99, 'paid', now());

-- T1. Busca: acha, não acha, respeita público e rascunho; texto com símbolos não quebra
do $t$
declare pp text[] := array['all', 'site', 'participant'];
begin
  assert (select id from public.chat_kb_buscar('esqueci minha senha', pp, 5) limit 1) = (select id from public.kb_articles where slug = 'lev-a03'), 'T1: não achou a A03';
  assert not exists (select 1 from public.chat_kb_buscar('xyzqwe blablu', pp, 5)), 'T1: achou o que não existe';
  -- A15 (reembolso) é rascunho
  assert not exists (select 1 from public.chat_kb_buscar('cancelar ingresso reembolso', pp, 50) b join public.kb_articles a on a.id = b.id where a.slug = 'lev-a15'), 'T1: rascunho apareceu';
  -- A58 é só de produtor
  assert not exists (select 1 from public.chat_kb_buscar('tipos de evento categorias', pp, 50) b join public.kb_articles a on a.id = b.id where a.slug = 'lev-a58'), 'T1: artigo de produtor para participante';
  assert exists (select 1 from public.chat_kb_buscar('tipos de evento categorias', array['all', 'site', 'producer'], 50) b join public.kb_articles a on a.id = b.id where a.slug = 'lev-a58'), 'T1: produtor não achou a A58';
  assert (select count(*) from public.chat_kb_buscar('senha:esqueci! (x) ''y'' a:b! & | <-> !', pp, 5)) >= 1, 'T1: símbolos quebraram a busca';
  perform public.chat_kb_buscar('a:b! (x) ''y''', pp, 5);
  raise notice 'T1 OK: busca acha, não acha, respeita público e rascunho; símbolos não quebram';
end $t$;

-- T2. Assistente responde na mesma transação, em ordem, sem contar como resposta da equipe; 2FA mantido
do $t$
declare r jsonb; cv uuid; cli uuid := 'f0000000-0000-4000-8000-000000000001'; m record;
begin
  perform pg_temp.como(cli);
  r := public.chat_start(pg_temp.topico('participant_evokaa', 'Minha conta e acesso'), null, 'Carla', '5511987654321', false, 'esqueci minha senha');
  assert (r->>'ok')::boolean, format('T2 start: %s', r);
  cv := (r->>'id')::uuid;
  perform set_config('teste.conv_senha', cv::text, true);
  select array_agg(sender_role order by created_at) as papeis, count(*) as n,
         bool_and(created_at is not null) as ok, (array_agg(created_at order by created_at))[1] < (array_agg(created_at order by created_at))[2] as ordem
    into m from public.conversation_messages where conversation_id = cv;
  assert m.papeis = array['customer', 'bot'], format('T2: papéis %s', m.papeis);
  assert m.ordem, 'T2: resposta do assistente fora de ordem';
  assert (select sender_id is null and sender_name = 'Assistente Evokaa' and bot_layer = 1 and body like 'Esqueci minha senha. Como recupero?%'
          from public.conversation_messages where conversation_id = cv and sender_role = 'bot'), 'T2: mensagem do assistente';
  assert (select bot_state = 'bot' and bot_tries = 1 and first_response_at is null and last_reply_at is null
                 and last_message_preview = 'esqueci minha senha' from public.conversations where id = cv), 'T2: conversa contou o assistente como equipe';
  -- 2ª resposta sugere o atendente
  r := public.chat_send(cv, 'vc sabe como troco minha senha?', false, null, null);
  assert (select body like 'Como troco minha senha estando logado?%' and body like '%Falar com um atendente%'
          from public.conversation_messages where conversation_id = cv and sender_role = 'bot' order by created_at desc limit 1), 'T2: 2ª resposta';
  -- 2FA: conta com fator confirmado e token aal1 não abre conversa
  perform pg_temp.como('f0000000-0000-4000-8000-000000000006');
  assert pg_temp.erro(format('select public.chat_start(%L, null, %L, %L, false, %L)', pg_temp.topico('participant_evokaa', 'Outros assuntos'), 'Mara', '5511987654321', 'oi')) = '42501', 'T2: 2FA não barrou';
  perform pg_temp.como(null);
  raise notice 'T2 OK: assistente responde em ordem, sem contar como equipe; 2ª resposta oferece atendente; 2FA mantido';
end $t$;

-- T3. Assuntos direto-humano não passam pelo assistente; conversas com o assistente fora do limite de 3
do $t$
declare r jsonb; cli2 uuid := 'f0000000-0000-4000-8000-000000000002'; i int;
begin
  perform pg_temp.como(cli2);
  r := public.chat_start(pg_temp.topico('participant_evokaa', 'Meus dados e privacidade (LGPD)'), null, 'Dora', '5511987654321', false, 'quero apagar meus dados');
  assert (select bot_state = 'humano' from public.conversations where id = (r->>'id')::uuid), 'T3: LGPD foi para o assistente';
  assert not exists (select 1 from public.conversation_messages where conversation_id = (r->>'id')::uuid and sender_role in ('bot', 'system')), 'T3: LGPD recebeu resposta automática';
  r := public.chat_start(pg_temp.topico('participant_evokaa', 'Pagamento: cobrança, Pix ou cartão'), null, 'Dora', '5511987654321', false, 'cobrança');
  r := public.chat_start(pg_temp.topico('participant_evokaa', 'Pagamento: cobrança, Pix ou cartão'), null, 'Dora', '5511987654321', false, 'cobrança 2');
  assert (select count(*) from public.conversations where user_id = cli2 and status = 'open' and bot_state = 'humano') = 3, 'T3: 3 humanas';
  r := public.chat_start(pg_temp.topico('participant_evokaa', 'Outros assuntos'), null, 'Dora', '5511987654321', false, 'oi');
  assert (r->>'ok')::boolean, format('T3: conversa com o assistente esbarrou no limite: %s', r);
  assert (select count(*) from public.conversation_messages where conversation_id = (r->>'id')::uuid and sender_role = 'bot' and body like 'Oi! Tudo bem?%' and bot_layer is null) = 1, 'T3: cortesia';
  assert (select bot_state = 'bot' and bot_tries = 0 from public.conversations where id = (r->>'id')::uuid), 'T3: cortesia contou tentativa ou passou';
  r := public.chat_start(pg_temp.topico('participant_evokaa', 'Meus dados e privacidade (LGPD)'), null, 'Dora', '5511987654321', false, 'quarta humana');
  assert r->>'motivo' = 'limite_abertas', format('T3: 4ª humana passou: %s', r);
  perform pg_temp.como(null);
  raise notice 'T3 OK: assuntos direto-humano sem assistente; assistente fora do limite de 3; cortesia sem tentativa';
end $t$;

-- T4. E-mail da equipe só depois da passagem; passagem avisa e zera a leitura; prévia não muda
do $t$
declare r jsonb; cv uuid; cli uuid := 'f0000000-0000-4000-8000-000000000001'; ad uuid := 'f0000000-0000-4000-8000-000000000004';
begin
  perform pg_temp.como(cli);
  r := public.chat_start(pg_temp.topico('participant_evokaa', 'Outros assuntos'), null, 'Carla', '5511987654321', false, 'oi');
  cv := (r->>'id')::uuid;
  perform pg_temp.como(ad);
  perform public.chat_mark_read(cv);  -- atendente espiou pelo filtro "Com o assistente"
  perform pg_temp.como(null);
  assert not exists (select 1 from pg_temp.fila() f where f.conversation_id = cv), 'T4: conversa com o assistente alertou a equipe';
  perform pg_temp.como(cli);
  r := public.chat_handoff(cv);
  assert (r->>'ok')::boolean, format('T4 handoff: %s', r);
  assert (select bot_state = 'humano' and handoff_reason = 'pedido' and handoff_at is not null and agent_last_read_at is null
                 and last_message_preview = 'oi' from public.conversations where id = cv), 'T4: passagem';
  assert (select body like 'Vou passar sua conversa para um atendente humano.%' and sender_id is null and bot_state = 'humano'
          from public.conversation_messages where conversation_id = cv and sender_role = 'system'), 'T4: mensagem da passagem';
  assert (select bot_state = 'bot' from public.conversation_messages where conversation_id = cv and sender_role = 'customer'), 'T4: mensagem do cliente com o assistente marcou humano (bipe)';
  perform pg_temp.como(null);
  assert exists (select 1 from pg_temp.fila() f where f.conversation_id = cv and f.tipo = 'equipe'), 'T4: passagem não alertou a equipe';
  perform set_config('teste.conv_passada', cv::text, true);
  raise notice 'T4 OK: equipe só é avisada depois da passagem; passagem zera leitura, avisa o cliente e não mexe na prévia';
end $t$;

-- T5. Isso resolveu? Sim resolve pelo assistente (sem nota); Não passa para humano
do $t$
declare r jsonb; cv uuid := current_setting('teste.conv_senha')::uuid; cv2 uuid; cli uuid := 'f0000000-0000-4000-8000-000000000001';
begin
  perform pg_temp.como(cli);
  r := public.chat_bot_feedback(cv, true);
  assert (r->>'ok')::boolean, format('T5 sim: %s', r);
  assert (select status = 'resolved' and bot_state = 'bot' and resolved_at is not null and rating is null from public.conversations where id = cv), 'T5: sim';
  r := public.chat_bot_feedback(cv, false);
  assert r->>'motivo' = 'fora_do_assistente', 'T5: feedback em conversa resolvida';
  -- escrever de novo reabre com o assistente
  r := public.chat_send(cv, 'como altero meu telefone', false, null, null);
  assert (select status = 'open' and bot_state = 'bot' from public.conversations where id = cv), 'T5: reabrir';
  r := public.chat_bot_feedback(cv, false);
  assert (select bot_state = 'humano' and handoff_reason = 'nao_resolveu' from public.conversations where id = cv), 'T5: não';
  assert pg_temp.erro(format('select public.chat_bot_feedback(%L, null)', cv)) = '22023', 'T5: nulo aceito';
  perform pg_temp.como(null);
  raise notice 'T5 OK: Sim resolve pelo assistente; Não passa para humano';
end $t$;

-- T6. Ninguém além do cliente aciona chat_handoff/chat_bot_feedback; funções internas fechadas
do $t$
declare r jsonb; cv uuid; cli uuid := 'f0000000-0000-4000-8000-000000000001';
begin
  perform pg_temp.como(cli);
  r := public.chat_start(pg_temp.topico('participant_evokaa', 'Outros assuntos'), null, 'Carla', '5511987654321', false, 'oi');
  cv := (r->>'id')::uuid;
  perform set_config('teste.conv_t6', cv::text, true);
  foreach r in array array['"f0000000-0000-4000-8000-000000000002"', '"f0000000-0000-4000-8000-000000000004"', '"f0000000-0000-4000-8000-000000000003"']::jsonb[] loop
    perform pg_temp.como((r #>> '{}')::uuid);
    assert pg_temp.erro(format('select public.chat_handoff(%L)', cv)) = '42501', format('T6: %s acionou handoff', r);
    assert pg_temp.erro(format('select public.chat_bot_feedback(%L, true)', cv)) = '42501', format('T6: %s acionou feedback', r);
  end loop;
  perform pg_temp.como(cli);
  assert pg_temp.erro(format('select public.chat_bot_responder(%L, %L)', cv, 'x')) = '42501', 'T6: responder aberto';
  assert pg_temp.erro(format('select public.chat_bot_passar(%L, %L)', cv, 'pedido')) = '42501', 'T6: passar aberto';
  assert pg_temp.erro('select * from public.chat_kb_buscar(''senha'', ''{all}'', 5)') = '42501', 'T6: buscar aberto';
  assert pg_temp.erro('select public.chat_kb_normalizar(''vc'')') = '42501', 'T6: normalizar aberto';
  assert pg_temp.erro('select public.chat_bot_pode_ia(null)') = '42501', 'T6: pode_ia aberto';
  assert pg_temp.erro('select public.chat_bot_ligar(false)') = '42501', 'T6: cliente desligou o assistente';
  assert (select bot_state from public.conversations where id = cv) = 'bot', 'T6: estado mudou';
  perform pg_temp.como(null);
  assert not has_function_privilege('anon', 'public.chat_handoff(uuid)', 'execute'), 'T6: anon executa handoff';
  raise notice 'T6 OK: só o dono aciona passagem e feedback; funções internas fechadas';
end $t$;

-- T7. Filtros do chat_inbox: "Com o assistente" separado das humanas
do $t$
declare ad uuid := 'f0000000-0000-4000-8000-000000000004'; cv uuid := current_setting('teste.conv_t6')::uuid; cp uuid := current_setting('teste.conv_passada')::uuid;
begin
  perform pg_temp.como(ad);
  assert exists (select 1 from public.chat_inbox('assistente', null, 200) where id = cv and bot_state = 'bot'), 'T7: assistente';
  assert not exists (select 1 from public.chat_inbox('abertas', null, 200) where id = cv), 'T7: abertas mostra conversa do assistente';
  assert not exists (select 1 from public.chat_inbox('sem_dono', null, 200) where id = cv), 'T7: sem dono mostra conversa do assistente';
  assert exists (select 1 from public.chat_inbox('abertas', null, 200) where id = cp and bot_state = 'humano' and handoff_at is not null), 'T7: passada não está em abertas';
  assert not exists (select 1 from public.chat_inbox('assistente', null, 200) where id = cp), 'T7: passada ficou no assistente';
  assert pg_temp.erro('select * from public.chat_inbox(''qualquer'', null, 5)') = '22023', 'T7: filtro inválido';
  -- contador do menu: abertas humanas
  assert not exists (select 1 from public.conversations where status = 'open' and bot_state = 'humano' and id = cv), 'T7: contador';
  perform pg_temp.como(null);
  raise notice 'T7 OK: filtro "assistente"; abertas/sem dono só humanas';
end $t$;

-- T8. Roteiro do ingresso: só os pedidos da própria pessoa, com status honesto
do $t$
declare r jsonb; b text; cli uuid := 'f0000000-0000-4000-8000-000000000001'; prod uuid := 'f0000000-0000-4000-8000-000000000003';
begin
  perform pg_temp.como(cli);
  r := public.chat_start(pg_temp.topico('participant_evokaa', 'Não recebi ou não acho meu ingresso'), null, 'Carla', '5511987654321', false, 'não recebi meu ingresso');
  select body into b from public.conversation_messages where conversation_id = (r->>'id')::uuid and sender_role = 'bot';
  assert b like 'Encontrei estes pedidos na sua conta%', format('T8: roteiro: %s', b);
  assert b like '%Forró da Lua%R$ 60,00 · Pendente: o pagamento ainda não foi confirmado%', format('T8: pendente: %s', b);
  assert b like '%R$ 1.234,50 · Pago%', format('T8: pago: %s', b);
  assert b not like '%Show Secreto%', 'T8: pedido de outra pessoa apareceu';
  assert (select position('Pendente' in b) < position('Pago' in b)), 'T8: ordem';
  -- 2ª mensagem do mesmo assunto já vai para a busca
  r := public.chat_send((r->>'id')::uuid, 'vou receber o ingresso por email?', false, null, null);
  perform pg_temp.como(null);
  raise notice 'T8 OK: roteiro com os pedidos da própria pessoa e status honesto';
end $t$;
do $t$
declare cv uuid;
begin
  insert into public.conversations (user_id, kind, bot_state, topic_id)
  values ('f0000000-0000-4000-8000-000000000006', 'evokaa', 'bot', pg_temp.topico('participant_evokaa', 'Não recebi ou não acho meu ingresso')) returning id into cv;
  perform public.chat_bot_responder(cv, 'cadê meu ingresso');
  assert (select body like 'Não encontrei pedidos nesta conta.%' from public.conversation_messages where conversation_id = cv and sender_role = 'bot'), 'T8: sem pedidos';
  raise notice 'T8b OK: sem pedidos, resposta honesta';
end $t$;

-- T9. Atendente respondendo (ou assumindo) tira do assistente; nota interna não
do $t$
declare r jsonb; cv uuid; cv2 uuid; cli2 uuid := 'f0000000-0000-4000-8000-000000000002'; ad uuid := 'f0000000-0000-4000-8000-000000000004';
begin
  perform pg_temp.como(cli2);
  r := public.chat_start(pg_temp.topico('participant_evokaa', 'Outros assuntos'), null, 'Dora', '5511987654321', false, 'obg');
  cv := (r->>'id')::uuid;
  assert (select body like 'Por nada!%' from public.conversation_messages where conversation_id = cv and sender_role = 'bot'), 'T9: cortesia de agradecimento';
  perform pg_temp.como(ad);
  perform public.chat_send(cv, 'nota', true, null, null);
  assert (select bot_state = 'bot' from public.conversations where id = cv), 'T9: nota interna tirou do assistente';
  perform public.chat_send(cv, 'Oi Dora, sou a Ana', false, null, null);
  assert (select bot_state = 'humano' and handoff_reason = 'atendente' and assignee_id = ad from public.conversations where id = cv), 'T9: resposta não tirou do assistente';
  perform pg_temp.como(null);
  delete from public.conversations where user_id = cli2 and bot_state = 'humano' and id <> cv;  -- libera o limite de horas/abertas
  update public.conversations set created_at = now() - interval '2 hours' where user_id = cli2;
  perform pg_temp.como(cli2);
  r := public.chat_start(pg_temp.topico('participant_evokaa', 'Outros assuntos'), null, 'Dora', '5511987654321', false, 'oi');
  cv2 := (r->>'id')::uuid;
  perform pg_temp.como(ad);
  perform public.chat_update(cv2, jsonb_build_object('assignee_id', ad));
  assert (select bot_state = 'humano' and handoff_reason = 'atendente' from public.conversations where id = cv2), 'T9: assumir não tirou do assistente';
  perform pg_temp.como(null);
  raise notice 'T9 OK: resposta pública ou atribuição tiram do assistente; nota interna não';
end $t$;

-- T10. Interruptor: só manage_support muda; desligado, conversa nasce humana e a que já estava com o
--      assistente passa na mensagem seguinte (motivo 'desligado', mesmo no limite de 3)
do $t$
declare r jsonb; cv uuid; ad uuid := 'f0000000-0000-4000-8000-000000000004'; ax uuid := 'f0000000-0000-4000-8000-000000000005'; cli uuid := 'f0000000-0000-4000-8000-000000000001';
  cli2 uuid := 'f0000000-0000-4000-8000-000000000002';
begin
  cv := pg_temp.conversa_bot(cli2);  -- aberta com o assistente antes de desligar
  insert into public.conversations (user_id, kind, status, bot_state) values (cli2, 'evokaa', 'open', 'humano');
  assert (select count(*) from public.conversations where user_id = cli2 and status = 'open' and bot_state = 'humano') = 3, 'T10: 3 humanas';
  perform pg_temp.como(ax);
  assert pg_temp.erro('select public.chat_bot_ligar(false)') = '42501', 'T10: sem permissão desligou';
  perform pg_temp.como(ad);
  r := public.chat_bot_ligar(false);
  assert (select not bot_enabled from public.chat_settings), 'T10: não desligou';
  perform pg_temp.como(null);
  update public.conversations set created_at = now() - interval '2 hours', status = 'resolved' where user_id = cli;
  perform pg_temp.como(cli);
  r := public.chat_start(pg_temp.topico('participant_evokaa', 'Outros assuntos'), null, 'Carla', '5511987654321', false, 'esqueci minha senha');
  assert (select bot_state = 'humano' from public.conversations where id = (r->>'id')::uuid), 'T10: desligado e nasceu com o assistente';
  assert not exists (select 1 from public.conversation_messages where conversation_id = (r->>'id')::uuid and sender_role = 'bot'), 'T10: respondeu desligado';
  perform pg_temp.como(cli2);
  r := public.chat_send(cv, 'esqueci minha senha', false, null, null);
  assert (r->>'ok')::boolean, format('T10 send: %s', r);
  assert (select bot_state = 'humano' and handoff_reason = 'desligado' from public.conversations where id = cv), 'T10: aberta com o assistente não passou ao desligar';
  assert not exists (select 1 from public.conversation_messages where conversation_id = cv and sender_role = 'bot'), 'T10: assistente respondeu desligado';
  assert exists (select 1 from public.conversation_messages where conversation_id = cv and sender_role = 'system' and body like 'Vou passar sua conversa%'), 'T10: sem aviso da passagem';
  perform pg_temp.como(ad);
  r := public.chat_bot_ligar(true);
  perform pg_temp.como(null);
  raise notice 'T10 OK: interruptor só com manage_support; desligado não responde e passa a conversa aberta com o assistente';
end $t$;

-- T13. Limite de 3 humanas abertas na passagem (D3): botão, "Não", pedido escrito e sem resposta não
--      passam e o assistente avisa (o botão devolve ok: o aviso já está na conversa); pergunta sem resposta
--      no limite não é anotada; erro do assistente passa mesmo assim; abaixo do limite passa
do $t$
declare r jsonb; cv uuid; u uuid := 'f0000000-0000-4000-8000-000000000021';
begin
  insert into auth.users (id, email) values (u, 'lia@teste.evokaa.invalid');
  insert into public.profiles (id, email, full_name, role) values (u, 'lia@teste.evokaa.invalid', 'Lia Limite', 'user');
  insert into public.conversations (user_id, kind, status, bot_state) select u, 'evokaa', 'open', 'humano' from generate_series(1, 3);
  cv := pg_temp.conversa_bot(u);
  perform pg_temp.como(u);
  r := public.chat_handoff(cv);
  assert r = '{"ok": true}'::jsonb, format('T13: botão no limite: %s', r);
  r := public.chat_bot_feedback(cv, false);
  perform pg_temp.como(null);
  perform public.chat_bot_responder(cv, 'quero falar com uma pessoa');
  perform public.chat_bot_responder(cv, 'xyzqwe blablu');
  assert (select bot_state = 'bot' and handoff_at is null from public.conversations where id = cv), 'T13: passou no limite';
  assert (select count(*) from public.conversation_messages where conversation_id = cv and sender_role = 'bot' and bot_layer is null
          and body = 'Você já tem conversas abertas com a nossa equipe; continue por uma delas.') = 4, 'T13: aviso do limite';
  assert not exists (select 1 from public.conversation_messages where conversation_id = cv and sender_role = 'system'), 'T13: aviso de passagem no limite';
  assert not exists (select 1 from public.kb_perguntas_sem_resposta where texto = 'blablu xyzqwe'), 'T13: anotou pergunta de quem ficou com o assistente';
  assert public.chat_bot_passar(cv, 'erro'), 'T13: erro não passou no limite';
  assert (select bot_state = 'humano' and handoff_reason = 'erro' from public.conversations where id = cv), 'T13: erro';
  update public.conversations set status = 'resolved' where user_id = u and id <> cv;
  cv := pg_temp.conversa_bot(u);
  perform pg_temp.como(u);
  r := public.chat_handoff(cv);
  assert (r->>'ok')::boolean, format('T13: abaixo do limite: %s', r);
  perform pg_temp.como(null);
  raise notice 'T13 OK: passagem respeita o limite de 3 humanas e avisa; erro passa mesmo no limite';
end $t$;

-- T14. "Sim" × "Falar com um atendente" (B2): o que chega depois não muda nada
do $t$
declare r jsonb; cv uuid; u uuid := 'f0000000-0000-4000-8000-000000000022';
begin
  insert into auth.users (id, email) values (u, 'rui@teste.evokaa.invalid');
  insert into public.profiles (id, email, full_name, role) values (u, 'rui@teste.evokaa.invalid', 'Rui Corrida', 'user');
  cv := pg_temp.conversa_bot(u);
  perform pg_temp.como(u);
  r := public.chat_bot_feedback(cv, true);
  r := public.chat_handoff(cv);
  assert r->>'motivo' = 'fora_do_assistente', format('T14: botão depois do Sim: %s', r);
  perform pg_temp.como(null);
  assert not public.chat_bot_passar(cv, 'pedido'), 'T14: passou conversa resolvida';
  assert (select status = 'resolved' and bot_state = 'bot' and bot_resolveu from public.conversations where id = cv), 'T14: resolvida mudou';
  assert not exists (select 1 from public.conversation_messages where conversation_id = cv and sender_role = 'system'), 'T14: aviso em conversa resolvida';
  cv := pg_temp.conversa_bot(u);
  perform pg_temp.como(u);
  r := public.chat_handoff(cv);
  r := public.chat_bot_feedback(cv, true);
  assert r->>'motivo' = 'fora_do_assistente', format('T14: Sim depois do botão: %s', r);
  assert (select status = 'open' and bot_state = 'humano' and not bot_resolveu from public.conversations where id = cv), 'T14: Sim resolveu conversa humana';
  perform pg_temp.como(null);
  raise notice 'T14 OK: Sim e passagem não se atropelam';
end $t$;

-- T15. Selo "Resolvida pelo assistente" (D4): só o Sim liga; reabrir (cliente ou equipe) desliga; cron e
--      equipe não ligam; chat_inbox devolve o selo
do $t$
declare r jsonb; cv uuid; u uuid := 'f0000000-0000-4000-8000-000000000023'; ad uuid := 'f0000000-0000-4000-8000-000000000004';
begin
  insert into auth.users (id, email) values (u, 'sel@teste.evokaa.invalid');
  insert into public.profiles (id, email, full_name, role) values (u, 'sel@teste.evokaa.invalid', 'Selma Selo', 'user');
  cv := pg_temp.conversa_bot(u);
  perform pg_temp.como(u);
  r := public.chat_bot_feedback(cv, true);
  assert (select bot_resolveu from public.conversations where id = cv), 'T15: Sim sem selo';
  r := public.chat_send(cv, 'oi', false, null, null);
  assert (select status = 'open' and bot_state = 'bot' and not bot_resolveu from public.conversations where id = cv), 'T15: reabrir manteve o selo';
  perform pg_temp.como(null);
  update public.conversations set last_message_at = now() - interval '25 hours' where id = cv;
  execute (select command from cron.job where jobname = 'chat_bot_paradas');
  assert (select status = 'resolved' and not bot_resolveu from public.conversations where id = cv), 'T15: cron deu selo';
  cv := pg_temp.conversa_bot(u);
  perform pg_temp.como(ad);
  r := public.chat_update(cv, '{"status": "resolved"}');
  assert (select status = 'resolved' and bot_state = 'bot' and not bot_resolveu from public.conversations where id = cv), 'T15: equipe deu selo';
  -- equipe reabre a resolvida pelo Sim: o selo sai
  perform pg_temp.como(null);
  cv := pg_temp.conversa_bot(u);
  perform pg_temp.como(u);
  r := public.chat_bot_feedback(cv, true);
  perform pg_temp.como(ad);
  assert exists (select 1 from public.chat_inbox('resolvidas', null, 200) where id = cv and bot_resolveu), 'T15: chat_inbox sem o selo';
  r := public.chat_update(cv, '{"status": "open"}');
  assert (select status = 'open' and not bot_resolveu from public.conversations where id = cv), 'T15: equipe reabriu e o selo ficou';
  perform pg_temp.como(null);
  raise notice 'T15 OK: selo só no Sim; reabrir pela equipe tira o selo; chat_inbox devolve o selo';
end $t$;

-- T16. Cortesia (D5): agradecimento, saudação, reação positiva ou pedido de detalhes (também só com
--      palavras de reação e risadas); nenhuma conta tentativa nem passa; "show" continua termo da busca
do $t$
declare r record; cv uuid; u uuid := 'f0000000-0000-4000-8000-000000000023';
begin
  assert public.chat_kb_termos('show') = '{show}', 'T16: "show" virou palavra vazia';
  for r in select * from (values ('oi', 'Oi! Tudo bem? Como posso ajudar?'), ('bom dia!', 'Oi! Tudo bem? Como posso ajudar?'),
                                 ('td bem?', 'Oi! Tudo bem? Como posso ajudar?'), ('obg', 'Por nada! Se precisar de mais alguma coisa, é só escrever.'),
                                 ('oi, valeu', 'Por nada! Se precisar de mais alguma coisa, é só escrever.'),
                                 ('ok', 'Pode me contar com mais detalhes?'), ('a:b! (x)', 'Pode me contar com mais detalhes?'),
                                 ('perfeito', 'Que bom! Se precisar de mais alguma coisa, é só escrever.'),
                                 ('show de bola!', 'Que bom! Se precisar de mais alguma coisa, é só escrever.'),
                                 ('blz', 'Que bom! Se precisar de mais alguma coisa, é só escrever.'),
                                 ('top, valeu', 'Por nada! Se precisar de mais alguma coisa, é só escrever.'),
                                 ('legal, massa', 'Que bom! Se precisar de mais alguma coisa, é só escrever.'),
                                 ('kkkk', 'Pode me contar com mais detalhes?'), ('rsrs', 'Pode me contar com mais detalhes?'),
                                 ('hahaha', 'Pode me contar com mais detalhes?'), ('hmm', 'Pode me contar com mais detalhes?'),
                                 ('aff', 'Pode me contar com mais detalhes?'), ('ah ta', 'Pode me contar com mais detalhes?'),
                                 ('ata', 'Pode me contar com mais detalhes?')) v(f, b) loop
    cv := pg_temp.conversa_bot(u);
    perform public.chat_bot_responder(cv, r.f);
    assert (select body = r.b and bot_layer is null from public.conversation_messages where conversation_id = cv and sender_role = 'bot'), format('T16: "%s"', r.f);
    assert (select bot_state = 'bot' and bot_tries = 0 from public.conversations where id = cv), format('T16: "%s" contou ou passou', r.f);
  end loop;
  raise notice 'T16 OK: cortesia com agradecimento, saudação, reação positiva ou pedido de detalhes; reação e risada não passam';
end $t$;

-- T17. Pergunta sem resposta: só os termos, com número de 7+ dígitos mascarado; limpeza de 30 dias
do $t$
declare cv uuid; u uuid := 'f0000000-0000-4000-8000-000000000023';
begin
  assert public.chat_kb_mascarar('pedido 1234567') = 'pedido [número]' and public.chat_kb_mascarar('pedido 123456') = 'pedido 123456', 'T17: máscara de 7 dígitos';
  cv := pg_temp.conversa_bot(u);
  perform public.chat_bot_responder(cv, 'Oi, meu pedido 1234567 deu xyzqwe blablu!');
  assert exists (select 1 from public.kb_perguntas_sem_resposta where texto = 'blablu deu numero pedido xyzqwe' and audience = 'participant'),
    format('T17: pergunta gravada: %s', (select array_agg(texto) from public.kb_perguntas_sem_resposta));
  insert into public.kb_perguntas_sem_resposta (texto, audience, ultima_em) values
    ('t17 velha', 'site', now() - interval '31 days'), ('t17 recente', 'site', now() - interval '29 days');
  execute (select command from cron.job where jobname = 'kb_perguntas_limpeza');
  assert not exists (select 1 from public.kb_perguntas_sem_resposta where texto = 't17 velha')
     and exists (select 1 from public.kb_perguntas_sem_resposta where texto = 't17 recente'), 'T17: limpeza de 30 dias';
  raise notice 'T17 OK: pergunta sem resposta só com termos mascarados; limpeza de 30 dias';
end $t$;

-- T11. Base: sem manage_support não lê nem grava; admin grava só manual/atendente; excluir guarda o slug;
--      pergunta sem resposta é anotada mascarada; erro do assistente não derruba a mensagem
do $t$
declare r jsonb; cv uuid; ad uuid := 'f0000000-0000-4000-8000-000000000004'; ax uuid := 'f0000000-0000-4000-8000-000000000005';
  cli uuid := 'f0000000-0000-4000-8000-000000000001'; n int;
begin
  foreach r in array array['"f0000000-0000-4000-8000-000000000005"', '"f0000000-0000-4000-8000-000000000001"']::jsonb[] loop
    perform pg_temp.como((r #>> '{}')::uuid);
    assert (select count(*) from public.kb_articles) = 0, format('T11: %s lê artigos', r);
    assert (select count(*) from public.kb_termos) = 0, format('T11: %s lê dicionário', r);
    assert (select count(*) from public.kb_perguntas_sem_resposta) = 0, format('T11: %s lê perguntas', r);
    assert pg_temp.erro(format('insert into public.kb_articles (title, body, origin, created_by) values (%L, %L, %L, %L)', 'Titulo X', 'Corpo do artigo', 'manual', r #>> '{}')) = '42501', format('T11: %s criou artigo', r);
    assert pg_temp.erro('insert into public.kb_termos (forma, normal) values (''zz'', ''zzz'')') = '42501', format('T11: %s criou termo', r);
    update public.kb_articles set title = 'invadido' where slug = 'lev-a01';
    delete from public.kb_articles where slug = 'lev-a02';
  end loop;
  perform pg_temp.como(null);
  assert (select title from public.kb_articles where slug = 'lev-a01') <> 'invadido' and exists (select 1 from public.kb_articles where slug = 'lev-a02'), 'T11: gravou sem permissão';
  perform pg_temp.como(ad);
  assert (select count(*) from public.kb_articles) = 58, 'T11: admin não lê a base';
  assert pg_temp.erro(format('insert into public.kb_articles (title, body, origin, created_by) values (%L, %L, %L, %L)', 'Titulo X', 'Corpo do artigo', 'seed', ad)) = '42501', 'T11: admin criou com origem seed';
  assert pg_temp.erro(format('insert into public.kb_articles (title, body, origin, created_by) values (%L, %L, %L, %L)', 'Titulo X', 'Corpo do artigo', 'manual', ax)) = '42501', 'T11: admin criou em nome de outro';
  assert pg_temp.erro(format('insert into public.kb_articles (title, body, origin, created_by, slug) values (%L, %L, %L, %L, %L)', 'Titulo X', 'Corpo do artigo', 'manual', ad, 'lev-a99')) = '42501', 'T11: admin gravou slug';
  insert into public.kb_articles (title, body, keywords, origin, created_by, status) values ('Portão do evento', 'O portão abre no horário informado pelo produtor na página do evento.', 'portao, portão, abertura, que horas abre', 'manual', ad, 'published');
  update public.kb_articles set keywords = keywords || ', teste' where slug = 'lev-a01';
  get diagnostics n = row_count;
  assert n = 1, 'T11: admin não editou';
  delete from public.kb_articles where slug = 'lev-a58';
  insert into public.kb_termos (forma, normal) values ('portao', 'portão');
  assert pg_temp.erro('insert into public.kb_termos (forma, normal) values (''Vc'', ''você'')') = '23514', 'T11: forma com maiúscula aceita';
  perform pg_temp.como(null);
  assert exists (select 1 from public.kb_slugs_excluidos where slug = 'lev-a58'), 'T11: exclusão não guardou o slug';
  -- a pergunta do T12 "qdo abre o portao" agora tem artigo (manual, publicado)
  cv := pg_temp.conversa_bot(cli);
  perform public.chat_bot_responder(cv, 'qdo abre o portao');
  assert pg_temp.resultado(cv) like 'outro: Portão do evento%', format('T11: artigo novo: %s', pg_temp.resultado(cv));
  -- pergunta sem resposta anotada só com os termos, mascarada; repetida soma
  cv := pg_temp.conversa_bot(cli);
  perform public.chat_bot_responder(cv, 'Meu CPF 123.456.789-09 e zap (11) 98765-4321 xyzqwe');
  cv := pg_temp.conversa_bot(cli);
  perform public.chat_bot_responder(cv, 'meu cpf 123.456.789-09 e zap (11) 98765-4321 XYZQWE');
  assert (select vezes = 2 and texto !~ '[0-9]{3}' and audience = 'participant' from public.kb_perguntas_sem_resposta where texto = 'cpf telefone whatsapp xyzqwe'), format('T11: pergunta sem resposta: %s', (select array_agg(texto || ' ' || vezes) from public.kb_perguntas_sem_resposta));
  -- erro do assistente passa para humano e a mensagem do cliente fica
  create or replace function public.chat_bot_responder(p_conv uuid, p_texto text) returns void language plpgsql as $f$ begin raise exception 'boom'; end $f$;
  cv := pg_temp.conversa_bot(cli);
  update public.conversations set status = 'open' where id = cv;
  perform pg_temp.como(cli);
  r := public.chat_send(cv, 'qualquer coisa', false, null, null);
  perform pg_temp.como(null);
  assert (r->>'ok')::boolean and exists (select 1 from public.conversation_messages where conversation_id = cv and body = 'qualquer coisa'), 'T11: erro derrubou a mensagem';
  assert (select bot_state = 'humano' and handoff_reason = 'erro' from public.conversations where id = cv), 'T11: erro não passou para humano';
  raise notice 'T11 OK: base só para manage_support; exclusão guarda slug; pergunta sem resposta mascarada; erro do assistente passa para humano';
end $t$;
rollback;

-- T12. Frases (candidatas para o Ricardo revisar: T12-frases.md). Tolerância zero para quem espera passa ou
--      pedido e para artigo errado; até 2 frases que esperam um artigo podem passar para humano.
begin;
create function pg_temp.resultado(p_conv uuid) returns text language sql as $f$
  select case
    when c.bot_state = 'humano' and c.handoff_reason = 'pedido' then 'pedido'
    when c.bot_state = 'humano' then 'passa'
    when m.body like 'Oi! Tudo bem?%' or m.body like 'Por nada!%' or m.body like 'Que bom!%' then 'cortesia'
    when m.body = 'Pode me contar com mais detalhes?' then 'detalhes'
    else coalesce((select a.slug from public.kb_articles a where m.body like a.title || E'\n\n%' order by char_length(a.title) desc limit 1), 'outro: ' || left(m.body, 40))
  end
  from public.conversations c
  left join lateral (select body from public.conversation_messages where conversation_id = c.id and sender_role = 'bot' order by created_at desc limit 1) m on true
  where c.id = p_conv $f$;
insert into auth.users (id, email) values ('f0000000-0000-4000-8000-000000000011', 'p@teste.evokaa.invalid'), ('f0000000-0000-4000-8000-000000000013', 'q@teste.evokaa.invalid');
insert into public.profiles (id, email, full_name, role) values
  ('f0000000-0000-4000-8000-000000000011', 'p@teste.evokaa.invalid', 'Participante', 'user'),
  ('f0000000-0000-4000-8000-000000000013', 'q@teste.evokaa.invalid', 'Produtor', 'producer');
create temp table t12 (n int, frase text, esperado text, papel text default 'user', obtido text);
insert into t12 (n, frase, esperado, papel) values
  (1, 'esqueci minha senha', 'lev-a03', 'user'), (2, 'vc sabe como troco minha senha?', 'lev-a04', 'user'),
  (3, 'oi', 'cortesia', 'user'), (4, 'obg', 'cortesia', 'user'), (5, 'td bem? n recebi meu ingr', 'lev-a12', 'user'),
  (6, 'vc tem q pagar taxa?', 'passa', 'user'), (7, 'qdo abre o portao', 'passa', 'user'), (8, 'reembouso', 'passa', 'user'),
  (9, 'a:b! (x) ''y''', 'detalhes', 'user'), (10, 'Olá, preciso de ajuda', 'cortesia', 'user'),
  (11, 'como faço pra criar uma conta', 'lev-a01', 'user'), (12, 'da pra entrar com o google?', 'lev-a02', 'user'),
  (13, 'quero mudar meu email', 'lev-a05', 'user'), (14, 'como troco meu numero de celular', 'lev-a06', 'user'),
  (15, 'quero excluir minha conta', 'lev-a08', 'user'), (16, 'posso passar meu ingresso pra minha amiga', 'lev-a13', 'user'),
  (17, 'meu pedido ta pendente', 'lev-a19', 'user'), (18, 'da pra parcelar no cartao?', 'lev-a20', 'user'),
  (19, 'tem cupom de desconto?', 'lev-a21', 'user'), (20, 'vcs tem app?', 'lev-a25', 'user'),
  (21, 'o evento sumiu do site', 'lev-a24', 'user'), (22, 'quem organiza o evento?', 'lev-a57', 'user'),
  (23, 'vcs vendem meus dados?', 'lev-a46', 'user'), (24, 'como paro de receber a newsletter', 'lev-a50', 'user'),
  (25, 'quero falar com uma pessoa', 'pedido', 'user'), (26, 'tem meia entrada pra estudante?', 'passa', 'user'),
  (27, 'quanto custa o plano', 'lev-a30', 'producer'), (28, 'como crio cupom pro meu evento', 'lev-a33', 'producer'),
  -- respostas confiantes e erradas (revisor, B1) e pedido escrito de uma pessoa (Decisão 83)
  (29, 'evento cancelado, quero meu dinheiro de volta', 'passa', 'user'), (30, 'quero cancelar minha compra', 'passa', 'user'),
  (31, 'esqueci o email da minha conta', 'passa', 'user'), (32, 'perdi meu celular com o ingresso', 'passa', 'user'),
  (33, 'falar com atendente', 'pedido', 'user'), (34, 'não quero robô', 'pedido', 'user'),
  (35, 'posso transferir o ingresso para outra pessoa?', 'passa', 'user'),  -- não é pedido de pessoa (passa sem resposta)
  -- revisão de 30/09 (segunda rodada): B1, pedido de pessoa mais largo e "operadora" do cartão
  (36, 'perdi meu ingresso', 'passa', 'user'), (37, 'posso pagar em 3 vezes no cartao?', 'lev-a20', 'user'),
  (38, 'qual a taxa da evokaa por ingresso', 'passa', 'producer'), (39, 'a operadora do meu cartao recusou', 'lev-a17', 'user'),
  (40, 'tem alguém aí?', 'pedido', 'user'), (41, 'quero falar com o atendimento', 'pedido', 'user'),
  (42, 'falar com vcs', 'pedido', 'user');
do $t$
declare r record; cv uuid; erros int := 0; graves int;
begin
  for r in select * from t12 order by n loop
    insert into public.conversations (user_id, kind, bot_state)
    values (case r.papel when 'producer' then 'f0000000-0000-4000-8000-000000000013'::uuid else 'f0000000-0000-4000-8000-000000000011'::uuid end, 'evokaa', 'bot')
    returning id into cv;
    perform public.chat_bot_responder(cv, r.frase);
    update t12 set obtido = pg_temp.resultado(cv) where n = r.n;
    update public.conversations set status = 'resolved' where id = cv;  -- não soma no limite de 3 humanas
  end loop;
  -- T12b: com a A15 publicada, o erro de digitação acha o artigo de reembolso
  update public.kb_articles set status = 'published' where slug = 'lev-a15';
  insert into public.conversations (user_id, kind, bot_state) values ('f0000000-0000-4000-8000-000000000011', 'evokaa', 'bot') returning id into cv;
  perform public.chat_bot_responder(cv, 'reembouso');
  insert into t12 values (99, 'reembouso (A15 publicada)', 'lev-a15', 'user', pg_temp.resultado(cv));
  select count(*), count(*) filter (where not (esperado like 'lev-%' and obtido = 'passa')) into erros, graves
  from t12 where obtido is distinct from esperado;
  raise notice 'T12: % de % frases certas', (select count(*) from t12) - erros, (select count(*) from t12);
  for r in select * from t12 where obtido is distinct from esperado order by n loop
    raise notice 'T12 errou #%: "%" esperado % obtido %', r.n, r.frase, r.esperado, r.obtido;
  end loop;
  -- resposta confiante e errada (ou pedido/passagem trocados) não pode; artigo esperado que passou, até 2
  assert graves = 0, 'T12: resposta confiante e errada, ou pedido/passagem trocados';
  assert erros <= 2, 'T12: mais de 2 frases que esperam um artigo passaram para humano';
end $t$;
rollback;
*/
