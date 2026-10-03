-- =============================================================================
-- V6a, SQL da capa e da cor do evento (redesenho v3.4; Decisões 136, 142 e 143). 03/10/2026.
--   1. Bucket de Storage "capas-eventos": público para ler, 2 MB, só jpeg e webp; enviar só em
--      <producer_id>/<event_id>/<arquivo> de um evento do próprio produtor; sem alterar, apagar nem listar.
--   2. events.accent_color (cor do evento, #rrggbb) e events.mostrar_contagem ("N pessoas vão", desligado).
--   3. Limpeza das fotos antigas em Base64 em cover_image E image_url (viram '/images/hero-bg.jpg', que a V6b
--      mostra como cartaz) e trava nas duas colunas: só vazio, a foto padrão ou um arquivo do bucket acima,
--      do próprio evento.
--   4. evento_contagem_publica(event_id): a contagem pública, só com o evento publicado e aprovado e a
--      opção ligada.
--   5. capas_arquivos_a_apagar(user_id): lista as capas de um produtor para a delete-account apagar.
--
-- Como aplicar: colar o arquivo inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA pelo TextEdit: erro 17).
-- APLICAR FORA DO HORÁRIO DE PICO: o ALTER TABLE em events pede bloqueio exclusivo até o fim da transação
-- (leituras e vendas esperam); o `set local lock_timeout = '5s'` do início faz o arquivo desistir sem gravar
-- nada, em vez de travar o site, se algo estiver segurando events. Se desistir, rodar de novo.
-- Uma transação só: se uma conferência falhar, nada é gravado. Idempotente (pode rodar de novo).
-- NÃO mover para supabase/migrations/ (motivo no cabeçalho de 20260927_security_hardening.sql).
-- ORDEM: (a) rodar o PASSO 0 abaixo e ver o resultado; (b) aplicar este SQL; (c) só depois publicar a
-- delete-account nova (ela chama capas_arquivos_a_apagar: sem a função, toda exclusão de conta dá 500);
-- (d) o front da V6b (envio da capa). Entre (b) e (d), o EditEvent antigo, ao escolher uma foto nova, grava
-- Base64 e leva 23514 (a trava recusa): é o efeito desejado. Salvar SEM trocar a foto também funciona e não
-- manda evento aprovado de volta à análise: a limpeza grava '/images/hero-bg.jpg' nas duas colunas, que é o
-- mesmo valor que o EditEvent antigo regrava (cover_image e image_url = image || '/images/hero-bg.jpg').
--
-- PASSO 0 (só leitura; rodar SOZINHO antes de aplicar, em produção):
--   select count(*) filter (where cover_image like 'data:%')  as capa_base64,
--          count(*) filter (where image_url like 'data:%')    as image_url_base64,
--          count(*) filter (where cover_image is not null and cover_image not like 'data:%'
--                             and cover_image <> '/images/hero-bg.jpg') as capa_outro_valor,
--          count(*) filter (where image_url is not null and image_url not like 'data:%'
--                             and image_url <> '/images/hero-bg.jpg') as image_url_outro_valor,
--          count(*) as eventos
--   from public.events;
--   select cover_image, image_url, count(*) from public.events
--    where (cover_image is not null and cover_image not like 'data:%')
--       or (image_url is not null and image_url not like 'data:%') group by 1, 2;
--   Esperado (plano): capa_outro_valor = 0 e image_url_outro_valor = 0 (os eventos usam /images/hero-bg.jpg).
--   Se algum vier > 0, o bloco 4 para com a lista dos valores e nada é gravado: decidir o que fazer com eles
--   antes de reaplicar.
--   select policyname, cmd, roles::text, qual, with_check from pg_policies
--    where schemaname = 'storage' and tablename = 'objects';
--   Esperado: nenhuma regra (a não ser as restritivas, como gf_mfa_aal2) sem filtro de bucket_id: uma de SELECT
--   listaria também este bucket; uma de INSERT deixaria enviar fora do caminho. O bloco 7 aborta se achar.
--
-- DECISÕES
-- 1. Bucket público: a leitura pela URL pública não passa por regra de SELECT (a rota pública do Storage
--    lê como superusuário). Por isso NÃO há regra de SELECT em storage.objects para este bucket: ninguém
--    lista os arquivos (listar exige SELECT) e a URL, com o uuid do produtor e do evento, não se adivinha.
-- 2. O envio do supabase-js precisa só de INSERT: o storage-api (código da v1.77.0, lido na imagem local:
--    uploader.canUpload -> createObject) testa o envio com um INSERT sem RETURNING, como o usuário, e só
--    depois grava o definitivo como superusuário. Com upsert: true o teste seria INSERT ... ON CONFLICT DO
--    UPDATE ... RETURNING e exigiria UPDATE e SELECT: como não existem, falha. Com upsert: false, nome já
--    existente dá violação de unicidade (409) mesmo sem enxergar a linha: um arquivo nunca é sobrescrito
--    (Decisão 136: trocar a foto aprovada sem passar pela moderação). O front envia com upsert: false e
--    nome novo a cada envio. Versão do storage-api em produção: não verificada. Ensaio real de envio: só no V6b.
--    DELETE direto em storage.objects já é barrado pelo gatilho storage.protect_delete (testado no banco
--    local); a delete-account apaga pela API do Storage (remove), que usa os nomes de capas_arquivos_a_apagar.
-- 3. Caminho aceito: <auth.uid()>/<uuid do evento>/<nome 8-80 letras, números, _ ou ->.webp|.jpg|.jpeg, sem
--    subpasta. O evento tem de ser do próprio produtor (events.producer_id). A regra de 2FA gf_mfa_aal2 de
--    storage.objects continua valendo (quem tem 2FA só envia com a sessão aal2).
-- 4. Limite de 2 MB e tipos image/jpeg e image/webp são do bucket, e a rota de CÓPIA do Storage (copyObject)
--    não confere o bucket de destino; por isso a regra de INSERT repete as duas checagens sobre a metadata
--    que o storage-api passa ao teste de permissão: mimetype em (image/jpeg, image/webp) e contentLength entre 1 e
--    2097152. Vale para envio e para cópia (a cópia leva a metadata do arquivo de origem, p.ex. um PDF do
--    chat-anexos: recusada). ATENÇÃO: o tipo é o declarado pelo cliente; não verificado se o storage-api confere o
--    conteúdo do arquivo. A retirada de GPS/EXIF é feita no navegador (canvas), e NÃO é garantida pelo banco.
-- 5. A limpeza dos Base64 (cover_image e image_url, ambos viram '/images/hero-bg.jpg', não NULL: o EditEvent
--    antigo regrava exatamente esse valor, e um NULL viraria "mudou a foto" e mandaria o evento aprovado de volta
--    para análise a cada salvamento) roda como o dono do banco (SQL Editor, papel postgres). O gatilho
--    gf_protect_event_moderation (20260930_f0a_moderacao_eventos.sql, bloco 2) só vigia anon/authenticated
--    que não são admin; postgres, service_role e pg_cron "passam direto" (primeiro if da função). Então o
--    UPDATE NÃO manda os eventos para análise e NÃO precisa desligar o gatilho. É certo não mandar: sem foto
--    não há o que moderar. Uma foto nova do produtor continua mandando (gatilho: new.cover_image distinto de
--    old.cover_image, em evento aprovado ou recusado). Para não depender de suposição, o bloco 4 tira uma foto de
--    approval_status/featured_carousel/approved_at antes e confere depois; se algum mudou, aborta.
--    Efeito colateral aceito: o gatilho tr_events_updated_at atualiza updated_at dessas linhas.
-- 6. Trava de cover_image E de image_url (mesmo padrão) como CHECK (não gatilho), criada DEPOIS da limpeza.
--    NOT VALID + VALIDATE na mesma transação NÃO diminui o bloqueio (o ADD CONSTRAINT já segura o bloqueio
--    exclusivo até o commit e o VALIDATE varre a tabela por dentro dele): usado só porque o plano pede a
--    ordem "limpar, travar, validar"; a tabela é pequena (dezenas de eventos), custo irrelevante.
--    A URL tem de ser deste projeto (rwaezeqyuhxrssntcxdv, o mesmo do CSP em app/vercel.json) e apontar
--    para a pasta do próprio produtor e do próprio evento (producer_id e id da mesma linha). Efeitos: um
--    evento não aponta para a capa de outro; mudar o dono do evento exigiria limpar a capa antes. Em banco
--    local/preview (outro projeto) a trava recusa URL de bucket: testar só com o padrão de produção.
--    O CHECK vale em todo UPDATE da linha, mesmo de outra coluna: por isso a conferência do bloco 4.
-- 7. mostrar_contagem boolean not null default false (Decisão 142). O produtor liga por evento; ligar ou
--    desligar não é conteúdo e não volta para análise (fora da lista do gatilho de moderação). O mesmo vale
--    para accent_color.
-- 8. evento_contagem_publica: SECURITY DEFINER com search_path vazio (lê tickets sem passar pela RLS de
--    tickets e sem criar ciclo com events, erro 16.3). "Publicado e aprovado" é o mesmo critério da regra
--    "Eventos públicos ou do produtor" de events (status = 'published' e approval_status = 'approved').
--    Conta tickets de status 'active' e 'used' (tickets_status_check: active, used, cancelled, refunded,
--    transferred). Devolve NULL (nunca 0) quando o evento não existe, não é público ou a opção está
--    desligada: quem chama não distingue os casos. Evento com visibility = 'private' (events_visibility_check:
--    public, private, unlisted, password) também devolve NULL; 'unlisted' e 'password' continuam contando, porque
--    o evento já é legível pela regra de events. Só devolve um número agregado; nenhum nome, id de
--    comprador ou e-mail. EXECUTE: tirado de public/anon/authenticated e dado a anon, authenticated e
--    service_role (o seg6 já tira de PUBLIC e anon o que o postgres cria, então o grant é explícito).
-- 9. capas_arquivos_a_apagar(p_user): igual à chat_arquivos_a_apagar (20261001_chat.sql, 3m): lista os
--    arquivos do bucket que começam por <p_user>/. Só service_role executa (a delete-account).
-- 10. Teto de 10 arquivos por evento e envio só em evento não cancelado: capas_can_upload(name), no molde de
--    chat_can_upload (20261001_chat.sql:220-244), SECURITY DEFINER, com pg_advisory_xact_lock por evento. LIMITE
--    DA TRAVA: o storage-api roda o teste de permissão numa transação que é desfeita (testPermission) e só depois
--    grava o arquivo; o lock some no fim do teste. Envios SIMULTÂNEOS do mesmo evento podem passar juntos e
--    passar de 10 por poucos arquivos. Serve contra abuso de volume, não é limite exato. O teto vale por evento;
--    o total por produtor é (eventos x 10 x 2 MB).
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 0. Pré-requisitos: o gatilho da F0a e as tabelas que este arquivo usa existem.
do $$
begin
  if to_regclass('storage.objects') is null or to_regclass('storage.buckets') is null then
    raise exception 'storage.objects/buckets não existem';
  end if;
  if not exists (select 1 from pg_trigger
                 where tgrelid = 'public.events'::regclass and tgname = 'gf_protect_event_moderation') then
    raise exception 'Falta o gatilho gf_protect_event_moderation (20260930_f0a_moderacao_eventos.sql): aplicar antes';
  end if;
  if to_regclass('public.tickets') is null then
    raise exception 'public.tickets não existe';
  end if;
end $$;

-- 1. Colunas novas ----------------------------------------------------------------------------------------
alter table public.events add column if not exists accent_color text;
alter table public.events add column if not exists mostrar_contagem boolean not null default false;
alter table public.events drop constraint if exists events_accent_color_check;
alter table public.events add constraint events_accent_color_check
  check (accent_color ~ '^#[0-9a-fA-F]{6}$');   -- nulo passa (a cor é opcional)

-- 2. Bucket capas-eventos -----------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('capas-eventos', 'capas-eventos', true, 2097152, array['image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 3. Teto de envio e regra do bucket: só INSERT. Nenhuma de SELECT, UPDATE ou DELETE (Decisões 1, 2 e 10). ---
--    Evento do próprio produtor, não cancelado, com menos de 10 arquivos no caminho. O lock por evento só vale
--    depois da checagem de dono (ninguém segura o lock de evento alheio).
create or replace function public.capas_can_upload(p_name text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_evento text := split_part(p_name, '/', 2);
begin
  if v_uid is null or split_part(p_name, '/', 1) <> v_uid::text then
    return false;
  end if;
  if not exists (select 1 from public.events e
                 where e.id::text = v_evento and e.producer_id = v_uid and e.status <> 'cancelled') then
    return false;
  end if;
  perform pg_advisory_xact_lock(hashtext('capas:' || v_evento));
  return (select count(*) from storage.objects o
          where o.bucket_id = 'capas-eventos'
            and starts_with(o.name, v_uid::text || '/' || v_evento || '/')) < 10;
end;
$$;
revoke all on function public.capas_can_upload(text) from public, anon, authenticated, service_role;
grant execute on function public.capas_can_upload(text) to authenticated;

drop policy if exists capas_eventos_insert on storage.objects;
create policy capas_eventos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'capas-eventos'
    and objects.name ~ ('^' || (select auth.uid())::text
        || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9_-]{8,80}\.(webp|jpe?g)$')
    and (objects.metadata->>'mimetype') in ('image/jpeg', 'image/webp')
    and coalesce((objects.metadata->>'contentLength')::bigint, 0) between 1 and 2097152
    and public.capas_can_upload(objects.name)
  );

-- 4. Capas em Base64 viram "sem foto" e a trava entra DEPOIS da limpeza ------------------------------------
drop table if exists pg_temp._v6a_antes;
create temp table _v6a_antes on commit drop as
  select id, approval_status, featured_carousel, approved_at from public.events;

do $$
declare v_base64 int; v_img int;
begin
  select count(*) filter (where cover_image like 'data:%'),
         count(*) filter (where image_url like 'data:%')
    into v_base64, v_img from public.events;
  raise notice 'Fotos em Base64 que serão trocadas pela foto padrão: cover_image %, image_url %.', v_base64, v_img;
end $$;

update public.events set
  cover_image = case when cover_image like 'data:%' then '/images/hero-bg.jpg' else cover_image end,
  image_url   = case when image_url   like 'data:%' then '/images/hero-bg.jpg' else image_url   end
where cover_image like 'data:%' or image_url like 'data:%';

do $$
declare v_mudou int; v_outros text;
begin
  -- a limpeza não pode ter mexido na moderação de nenhum evento (Decisão 5)
  select count(*) into v_mudou
  from public.events e join _v6a_antes a using (id)
  where (e.approval_status, e.featured_carousel, e.approved_at)
        is distinct from (a.approval_status, a.featured_carousel, a.approved_at);
  if v_mudou > 0 then
    raise exception 'A limpeza mudou a moderação de % evento(s); nada foi gravado', v_mudou;
  end if;
  -- nenhuma foto pode sobrar fora do que as travas aceitam (o VALIDATE falharia no escuro)
  select string_agg(distinct left(x.v, 80), ' | ') into v_outros
  from public.events e, lateral (values (e.cover_image), (e.image_url)) x(v)
  where x.v is not null and x.v <> '/images/hero-bg.jpg'
    and x.v !~ ('^https://rwaezeqyuhxrssntcxdv\.supabase\.co/storage/v1/object/public/capas-eventos/'
        || e.producer_id::text || '/' || e.id::text || '/[A-Za-z0-9_-]{8,80}\.(webp|jpe?g)$');
  if v_outros is not null then
    raise exception 'Fotos fora do padrão (decidir antes de aplicar): %', v_outros;
  end if;
end $$;

alter table public.events drop constraint if exists events_cover_image_check;
alter table public.events add constraint events_cover_image_check check (
  cover_image is null
  or cover_image = '/images/hero-bg.jpg'
  or cover_image ~ ('^https://rwaezeqyuhxrssntcxdv\.supabase\.co/storage/v1/object/public/capas-eventos/'
      || producer_id::text || '/' || id::text || '/[A-Za-z0-9_-]{8,80}\.(webp|jpe?g)$')
) not valid;
alter table public.events validate constraint events_cover_image_check;
alter table public.events drop constraint if exists events_image_url_check;
alter table public.events add constraint events_image_url_check check (
  image_url is null
  or image_url = '/images/hero-bg.jpg'
  or image_url ~ ('^https://rwaezeqyuhxrssntcxdv\.supabase\.co/storage/v1/object/public/capas-eventos/'
      || producer_id::text || '/' || id::text || '/[A-Za-z0-9_-]{8,80}\.(webp|jpe?g)$')
) not valid;
alter table public.events validate constraint events_image_url_check;

-- 5. Contagem pública ("N pessoas vão") -----------------------------------------------------------------------
create or replace function public.evento_contagem_publica(p_event_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (select count(*)::integer from public.tickets t
          where t.event_id = e.id and t.status in ('active', 'used'))
  from public.events e
  where e.id = p_event_id
    and e.status = 'published' and e.approval_status = 'approved'
    and e.visibility <> 'private'
    and e.mostrar_contagem;
$$;
revoke all on function public.evento_contagem_publica(uuid) from public, anon, authenticated;
grant execute on function public.evento_contagem_publica(uuid) to anon, authenticated, service_role;

-- 6. Exclusão de conta: capas do produtor ----------------------------------------------------------------------
create or replace function public.capas_arquivos_a_apagar(p_user uuid)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'capas-eventos'
    and left(o.name, 37) = p_user::text || '/';
$$;
revoke all on function public.capas_arquivos_a_apagar(uuid) from public, anon, authenticated, service_role;
grant execute on function public.capas_arquivos_a_apagar(uuid) to service_role;

-- 7. Conferência que aborta (tudo ou nada) ------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'capas-eventos' and public
                 and file_size_limit = 2097152 and allowed_mime_types = array['image/jpeg', 'image/webp']) then
    raise exception 'bucket capas-eventos fora do esperado';
  end if;
  -- exatamente 1 regra cita o bucket (a de INSERT); nenhuma outra, de qualquer tipo, o alcança
  if (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
      and coalesce(qual, '') || coalesce(with_check, '') like '%capas-eventos%') <> 1
     or not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                    and policyname = 'capas_eventos_insert' and cmd = 'INSERT') then
    raise exception 'esperado exatamente 1 regra citando capas-eventos, e ela é capas_eventos_insert (INSERT)';
  end if;
  -- uma regra permissiva de outro assunto SEM filtro de bucket_id alcançaria este bucket (listar, trocar,
  -- apagar ou enviar fora do caminho); as restritivas (gf_mfa_aal2) só restringem e ficam de fora
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
             and permissive = 'PERMISSIVE' and policyname <> 'capas_eventos_insert'
             and coalesce(qual, '') || coalesce(with_check, '') not like '%bucket_id%') then
    raise exception 'há regra permissiva em storage.objects sem filtro de bucket_id: %',
      (select string_agg(policyname::text, ', ') from pg_policies where schemaname = 'storage' and tablename = 'objects'
       and permissive = 'PERMISSIVE' and policyname <> 'capas_eventos_insert'
       and coalesce(qual, '') || coalesce(with_check, '') not like '%bucket_id%');
  end if;
  if exists (select 1 from pg_constraint where conrelid = 'public.events'::regclass
             and conname in ('events_cover_image_check', 'events_image_url_check', 'events_accent_color_check')
             and not convalidated) then
    raise exception 'trava não validada';
  end if;
  if has_function_privilege('public', 'public.evento_contagem_publica(uuid)', 'execute')
     or not has_function_privilege('anon', 'public.evento_contagem_publica(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.evento_contagem_publica(uuid)', 'execute') then
    raise exception 'EXECUTE de evento_contagem_publica errado';
  end if;
  if has_function_privilege('anon', 'public.capas_can_upload(text)', 'execute')
     or not has_function_privilege('authenticated', 'public.capas_can_upload(text)', 'execute') then
    raise exception 'EXECUTE de capas_can_upload errado';
  end if;
  if has_function_privilege('anon', 'public.capas_arquivos_a_apagar(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.capas_arquivos_a_apagar(uuid)', 'execute')
     or not has_function_privilege('service_role', 'public.capas_arquivos_a_apagar(uuid)', 'execute') then
    raise exception 'EXECUTE de capas_arquivos_a_apagar errado';
  end if;
end $$;

commit;

-- Conferência (só leitura). Esperado: 1 linha de bucket (público, 2097152, {image/jpeg,image/webp});
-- em storage.objects as regras chat_anexos_insert, chat_anexos_select, gf_mfa_aal2 (e as que já existiam)
-- mais capas_eventos_insert (INSERT, authenticated), e NENHUMA outra citando capas-eventos; as três travas
-- de events (cover_image, image_url, accent_color) validadas; capa_base64 = 0; moderação por status igual à do PASSO 0.
select 'bucket' as item, id as nome, public::text as valor, file_size_limit::text as extra, allowed_mime_types::text as extra2
from storage.buckets where id = 'capas-eventos'
union all
select 'regra storage.objects', policyname, cmd, roles::text, null
from pg_policies where schemaname = 'storage' and tablename = 'objects'
union all
select 'trava events', conname, convalidated::text, null, null
from pg_constraint where conrelid = 'public.events'::regclass
  and conname in ('events_cover_image_check', 'events_image_url_check', 'events_accent_color_check')
union all
select 'coluna events', column_name, data_type, is_nullable, column_default
from information_schema.columns where table_schema = 'public' and table_name = 'events'
  and column_name in ('accent_color', 'mostrar_contagem')
union all
select 'fotos Base64 que sobraram', count(*)::text, null, null, null
from public.events where cover_image like 'data:%' or image_url like 'data:%'
union all
select 'moderação', approval_status, count(*)::text, null, null
from public.events group by approval_status
union all
select 'gatilhos events', tgname, null, null, null
from pg_trigger where tgrelid = 'public.events'::regclass and not tgisinternal
order by 1, 2;

-- =============================================================================
-- TESTES (rodar à mão: tire o "-- " do começo das linhas abaixo e rode tudo de uma vez; o bloco inteiro
-- está num begin ... rollback e não deixa nada gravado). Rodar DEPOIS de aplicar o arquivo, em banco LOCAL
-- (supabase start; nunca em produção). Cada teste termina com "NOTICE: Tn OK"; falha = ERROR com o motivo.
-- pg_temp.como() troca o papel e as claims do JWT como o PostgREST (igual aos outros arquivos de docs/sql).
-- Em produção, o ensaio com ROLLBACK é só o T2 (o UPDATE de um evento aprovado com foto em Base64): copiar o
-- T0 com um id novo, rodar T2 e conferir que o evento continua 'approved'; tudo desfeito no rollback.
-- =============================================================================
-- begin;
-- create function pg_temp.como(p_role text, p uuid default null, p_aal text default 'aal1') returns void language plpgsql as $f$
-- begin
--   perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), true);
--   perform set_config('request.jwt.claims', case when p_role = 'postgres' then '' else json_strip_nulls(json_build_object(
--     'role', p_role, 'sub', p, 'aal', case when p is not null then p_aal end))::text end, true);
--   perform set_config('role', p_role, true);
-- end $f$;
-- create function pg_temp.erro(q text) returns text language plpgsql as $f$
-- begin execute q; return 'ok'; exception when others then return sqlstate; end $f$;
-- grant execute on function pg_temp.como(text, uuid, text), pg_temp.erro(text) to anon, authenticated;
--
-- -- T0. Dois produtores (P, Q), um comprador (C). Eventos de P: e1 aprovado com destaque, e2 aprovado com a foto padrão,
-- --     e3 publicado e aprovado com a contagem ligada, e4 rascunho com a contagem ligada. Evento de Q: e5. Evento cancelado de P: e8.
-- --     Ids fixos c6a00000-... (o Base64 do e1 só é plantado no T2, porque a trava recusaria o INSERT).
-- insert into auth.users (id, email) values
--   ('c6a00000-0000-4000-8000-000000000001', 'p@teste-v6a.invalid'),
--   ('c6a00000-0000-4000-8000-000000000002', 'q@teste-v6a.invalid'),
--   ('c6a00000-0000-4000-8000-000000000003', 'c@teste-v6a.invalid');
-- update public.profiles set role = 'producer' where id in ('c6a00000-0000-4000-8000-000000000001', 'c6a00000-0000-4000-8000-000000000002');
-- insert into public.events (id, producer_id, title, slug, status, approval_status, approved_at, featured_carousel,
--   cover_image, mostrar_contagem) values
--   ('c6a00000-0000-4000-8000-0000000000e1', 'c6a00000-0000-4000-8000-000000000001', 'E1', 'v6a-e1', 'published', 'approved', now(), true, null, false),
--   ('c6a00000-0000-4000-8000-0000000000e2', 'c6a00000-0000-4000-8000-000000000001', 'E2', 'v6a-e2', 'published', 'approved', now(), false, '/images/hero-bg.jpg', false),
--   ('c6a00000-0000-4000-8000-0000000000e3', 'c6a00000-0000-4000-8000-000000000001', 'E3', 'v6a-e3', 'published', 'approved', now(), false, null, true),
--   ('c6a00000-0000-4000-8000-0000000000e4', 'c6a00000-0000-4000-8000-000000000001', 'E4', 'v6a-e4', 'draft', 'pending', null, false, null, true),
--   ('c6a00000-0000-4000-8000-0000000000e5', 'c6a00000-0000-4000-8000-000000000002', 'E5', 'v6a-e5', 'published', 'approved', now(), false, null, false),
--   ('c6a00000-0000-4000-8000-0000000000e8', 'c6a00000-0000-4000-8000-000000000001', 'E8', 'v6a-e8', 'cancelled', 'approved', now(), false, null, false);
--
-- -- T1. A trava de cover_image
-- do $$
-- declare p uuid := 'c6a00000-0000-4000-8000-000000000001'; e uuid := 'c6a00000-0000-4000-8000-0000000000e3';
--   base text := 'https://rwaezeqyuhxrssntcxdv.supabase.co/storage/v1/object/public/capas-eventos/';
-- begin
--   perform pg_temp.como('postgres');
--   assert pg_temp.erro(format('update public.events set cover_image = %L where id = %L', 'data:image/png;base64,AAAA', e)) = '23514', 'aceitou Base64';
--   assert pg_temp.erro(format('update public.events set cover_image = %L where id = %L', 'https://exemplo.com/a.jpg', e)) = '23514', 'aceitou URL de fora';
--   assert pg_temp.erro(format('update public.events set cover_image = %L where id = %L', 'https://outro.supabase.co/storage/v1/object/public/capas-eventos/' || p || '/' || e || '/abcdefgh.webp', e)) = '23514', 'aceitou outro projeto';
--   assert pg_temp.erro(format('update public.events set cover_image = %L where id = %L', base || 'c6a00000-0000-4000-8000-000000000002/' || e || '/abcdefgh.webp', e)) = '23514', 'aceitou pasta de outro produtor';
--   assert pg_temp.erro(format('update public.events set cover_image = %L where id = %L', base || p || '/c6a00000-0000-4000-8000-0000000000e5/abcdefgh.webp', e)) = '23514', 'aceitou pasta de outro evento';
--   assert pg_temp.erro(format('update public.events set cover_image = %L where id = %L', base || p || '/' || e || '/abcdefgh.svg', e)) = '23514', 'aceitou svg';
--   assert pg_temp.erro(format('update public.events set cover_image = %L where id = %L', base || p || '/' || e || '/abcdefgh.webp?x=1', e)) = '23514', 'aceitou query string';
--   assert pg_temp.erro(format('update public.events set cover_image = %L where id = %L', base || p || '/' || e || '/abcdefgh.webp', e)) = 'ok', 'recusou a URL certa';
--   assert pg_temp.erro(format('update public.events set cover_image = %L where id = %L', '/images/hero-bg.jpg', e)) = 'ok', 'recusou a foto padrão';
--   assert pg_temp.erro(format('update public.events set cover_image = null where id = %L', e)) = 'ok', 'recusou vazio';
--   assert pg_temp.erro(format('update public.events set accent_color = %L where id = %L', '#A1b2C3', e)) = 'ok', 'recusou cor certa';
--   assert pg_temp.erro(format('update public.events set accent_color = %L where id = %L', 'A1B2C3', e)) = '23514', 'aceitou cor sem #';
--   assert pg_temp.erro(format('update public.events set accent_color = %L where id = %L', '#abc', e)) = '23514', 'aceitou cor curta';
--   assert pg_temp.erro(format('update public.events set accent_color = %L where id = %L', '#a1b2c3; drop', e)) = '23514', 'aceitou cor com lixo';
--   assert pg_temp.erro(format('update public.events set image_url = %L where id = %L', 'data:image/png;base64,AAAA', e)) = '23514', 'image_url aceitou Base64';
--   assert pg_temp.erro(format('update public.events set image_url = %L where id = %L', 'https://exemplo.com/a.jpg', e)) = '23514', 'image_url aceitou URL de fora';
--   assert pg_temp.erro(format('update public.events set image_url = %L where id = %L', base || 'c6a00000-0000-4000-8000-000000000002/' || e || '/abcdefgh.webp', e)) = '23514', 'image_url aceitou pasta de outro produtor';
--   assert pg_temp.erro(format('update public.events set image_url = %L where id = %L', base || p || '/' || e || '/abcdefgh.webp', e)) = 'ok', 'image_url recusou a URL certa';
--   assert pg_temp.erro(format('update public.events set image_url = %L where id = %L', '/images/hero-bg.jpg', e)) = 'ok', 'image_url recusou a foto padrão';
--   assert pg_temp.erro(format('update public.events set image_url = null where id = %L', e)) = 'ok', 'image_url recusou vazio';
--   raise notice 'T1 OK';
-- end $$;
--
-- -- T2. Limpeza do Base64 sem mandar para análise (o ensaio de produção). Planta Base64 nas duas colunas do e1 (aprovado,
-- --     com destaque) e só em image_url do e2, roda o UPDATE do bloco 4 como postgres e confere: viram a foto padrão,
-- --     a moderação não muda, e o EditEvent antigo (regrava a foto padrão nas duas colunas) não manda o e1 para análise.
-- alter table public.events drop constraint events_cover_image_check;
-- alter table public.events drop constraint events_image_url_check;
-- update public.events set cover_image = 'data:image/jpeg;base64,/9j/4AAQ', image_url = 'data:image/jpeg;base64,/9j/4AAQ'
--  where id = 'c6a00000-0000-4000-8000-0000000000e1';
-- update public.events set image_url = 'data:image/jpeg;base64,/9j/4AAQ' where id = 'c6a00000-0000-4000-8000-0000000000e2';
-- select pg_temp.como('postgres');
-- update public.events set
--   cover_image = case when cover_image like 'data:%' then '/images/hero-bg.jpg' else cover_image end,
--   image_url   = case when image_url   like 'data:%' then '/images/hero-bg.jpg' else image_url   end
-- where cover_image like 'data:%' or image_url like 'data:%';
-- do $$ begin
--   assert (select cover_image = '/images/hero-bg.jpg' and image_url = '/images/hero-bg.jpg' and approval_status = 'approved'
--           and featured_carousel and approved_at is not null
--           from public.events where id = 'c6a00000-0000-4000-8000-0000000000e1'), 'e1: a limpeza falhou ou mexeu na moderação';
--   assert (select cover_image = '/images/hero-bg.jpg' and image_url = '/images/hero-bg.jpg' and approval_status = 'approved'
--           from public.events where id = 'c6a00000-0000-4000-8000-0000000000e2'), 'e2: a limpeza falhou ou mexeu na moderação';
--   assert (select count(*) from public.events where cover_image like 'data:%' or image_url like 'data:%') = 0, 'sobrou Base64';
--   -- EditEvent antigo salvando outro campo, com as fotos regravadas como estão: continua aprovado
--   perform pg_temp.como('authenticated', 'c6a00000-0000-4000-8000-000000000001');
--   update public.events set cover_image = '/images/hero-bg.jpg', image_url = '/images/hero-bg.jpg', capacity = 10
--    where id = 'c6a00000-0000-4000-8000-0000000000e1';
--   assert (select approval_status from public.events where id = 'c6a00000-0000-4000-8000-0000000000e1') = 'approved',
--     'EditEvent antigo mandou o e1 para análise';
--   perform pg_temp.como('postgres');
--   raise notice 'T2 OK';
-- end $$;
-- alter table public.events add constraint events_cover_image_check check (
--   cover_image is null or cover_image = '/images/hero-bg.jpg'
--   or cover_image ~ ('^https://rwaezeqyuhxrssntcxdv\.supabase\.co/storage/v1/object/public/capas-eventos/'
--       || producer_id::text || '/' || id::text || '/[A-Za-z0-9_-]{8,80}\.(webp|jpe?g)$')) not valid;
-- alter table public.events validate constraint events_cover_image_check;
-- alter table public.events add constraint events_image_url_check check (
--   image_url is null or image_url = '/images/hero-bg.jpg'
--   or image_url ~ ('^https://rwaezeqyuhxrssntcxdv\.supabase\.co/storage/v1/object/public/capas-eventos/'
--       || producer_id::text || '/' || id::text || '/[A-Za-z0-9_-]{8,80}\.(webp|jpe?g)$')) not valid;
-- alter table public.events validate constraint events_image_url_check;
--
-- -- T3. Trocar a capa continua mandando para análise (produtor); a cor e a contagem não.
-- do $$
-- declare p uuid := 'c6a00000-0000-4000-8000-000000000001'; e uuid := 'c6a00000-0000-4000-8000-0000000000e3';
-- begin
--   perform pg_temp.como('authenticated', p);
--   update public.events set accent_color = '#112233', mostrar_contagem = false where id = e;
--   assert (select approval_status from public.events where id = e) = 'approved', 'cor/contagem mandaram para análise';
--   update public.events set cover_image = 'https://rwaezeqyuhxrssntcxdv.supabase.co/storage/v1/object/public/capas-eventos/' || p || '/' || e || '/abcdefgh.webp' where id = e;
--   assert (select approval_status from public.events where id = e) = 'pending', 'trocar a capa não mandou para análise';
--   perform pg_temp.como('postgres');
--   update public.events set approval_status = 'approved', approved_at = now() where id = e;  -- volta para os próximos testes
--   raise notice 'T3 OK';
-- end $$;
--
-- -- T4. evento_contagem_publica: 3 ingressos ativos/usados contam; cancelado, reembolsado e transferido não.
-- insert into public.orders (id, user_id, event_id) values ('c6a00000-0000-4000-8000-0000000000a1', 'c6a00000-0000-4000-8000-000000000003', 'c6a00000-0000-4000-8000-0000000000e3'),
--   ('c6a00000-0000-4000-8000-0000000000a4', 'c6a00000-0000-4000-8000-000000000003', 'c6a00000-0000-4000-8000-0000000000e4');
-- insert into public.ticket_types (id, event_id, name) values ('c6a00000-0000-4000-8000-0000000000b3', 'c6a00000-0000-4000-8000-0000000000e3', 'Pista'),
--   ('c6a00000-0000-4000-8000-0000000000b4', 'c6a00000-0000-4000-8000-0000000000e4', 'Pista');
-- insert into public.tickets (order_id, ticket_type_id, event_id, user_id, buyer_name, buyer_email, status)
-- select 'c6a00000-0000-4000-8000-0000000000a1', 'c6a00000-0000-4000-8000-0000000000b3', 'c6a00000-0000-4000-8000-0000000000e3',
--        'c6a00000-0000-4000-8000-000000000003', 'C', 'c@teste-v6a.invalid', s
-- from unnest(array['active', 'active', 'used', 'cancelled', 'refunded', 'transferred']) s;
-- insert into public.tickets (order_id, ticket_type_id, event_id, user_id, buyer_name, buyer_email, status)
-- values ('c6a00000-0000-4000-8000-0000000000a4', 'c6a00000-0000-4000-8000-0000000000b4', 'c6a00000-0000-4000-8000-0000000000e4',
--         'c6a00000-0000-4000-8000-000000000003', 'C', 'c@teste-v6a.invalid', 'active');
-- do $$
-- declare e3 uuid := 'c6a00000-0000-4000-8000-0000000000e3';
-- begin
--   perform pg_temp.como('anon');
--   assert public.evento_contagem_publica(e3) is null, 'contagem desligada vazou (e3 está com mostrar_contagem = false desde o T3)';
--   perform pg_temp.como('postgres');
--   update public.events set mostrar_contagem = true where id = e3;
--   perform pg_temp.como('anon');
--   assert public.evento_contagem_publica(e3) = 3, 'contagem errada (esperado 3: 2 active + 1 used)';
--   perform pg_temp.como('authenticated', 'c6a00000-0000-4000-8000-000000000003');
--   assert public.evento_contagem_publica(e3) = 3, 'authenticated não leu';
--   assert public.evento_contagem_publica('c6a00000-0000-4000-8000-0000000000e4') is null, 'rascunho vazou a contagem';
--   assert public.evento_contagem_publica('c6a00000-0000-4000-8000-0000000000e2') is null, 'e2 (opção desligada) vazou';
--   assert public.evento_contagem_publica('c6a00000-0000-4000-8000-00000000ffff') is null, 'evento inexistente não deu NULL';
--   perform pg_temp.como('postgres');
--   update public.events set visibility = 'private' where id = e3;
--   perform pg_temp.como('anon');
--   assert public.evento_contagem_publica(e3) is null, 'evento private vazou a contagem';
--   perform pg_temp.como('postgres');
--   update public.events set visibility = 'unlisted' where id = e3;
--   perform pg_temp.como('anon');
--   assert public.evento_contagem_publica(e3) = 3, 'evento unlisted deixou de contar';
--   perform pg_temp.como('postgres');
--   update public.events set visibility = 'public' where id = e3;
--   update public.events set approval_status = 'pending' where id = e3;
--   perform pg_temp.como('anon');
--   assert public.evento_contagem_publica(e3) is null, 'evento não aprovado vazou a contagem';
--   perform pg_temp.como('postgres');
--   update public.events set approval_status = 'approved' where id = e3;
--   assert pg_temp.erro('select public.capas_arquivos_a_apagar(''c6a00000-0000-4000-8000-000000000001'')') = 'ok', 'postgres não executa';
--   perform pg_temp.como('authenticated', 'c6a00000-0000-4000-8000-000000000001');
--   assert pg_temp.erro('select public.capas_arquivos_a_apagar(''c6a00000-0000-4000-8000-000000000001'')') = '42501', 'authenticated executa capas_arquivos_a_apagar';
--   perform pg_temp.como('anon');
--   assert pg_temp.erro('select public.capas_arquivos_a_apagar(''c6a00000-0000-4000-8000-000000000001'')') = '42501', 'anon executa capas_arquivos_a_apagar';
--   raise notice 'T4 OK';
-- end $$;
--
-- -- T5. Storage: enviar só na pasta do próprio evento, com tipo e tamanho certos, até 10 por evento; nada de ler, trocar ou apagar.
-- do $$
-- declare p uuid := 'c6a00000-0000-4000-8000-000000000001'; q uuid := 'c6a00000-0000-4000-8000-000000000002';
--   e1 text := 'c6a00000-0000-4000-8000-0000000000e1'; e3 text := 'c6a00000-0000-4000-8000-0000000000e3';
--   e5 text := 'c6a00000-0000-4000-8000-0000000000e5'; e8 text := 'c6a00000-0000-4000-8000-0000000000e8';
--   ins text := 'insert into storage.objects (bucket_id, name, owner, metadata) values (%L, %L, %L, %L::jsonb)';
--   w text := '{"mimetype":"image/webp","contentLength":1234}'; j text := '{"mimetype":"image/jpeg","contentLength":1234}';
-- begin
--   perform pg_temp.como('authenticated', p);
--   assert pg_temp.erro(format(ins, 'capas-eventos', p || '/' || e1 || '/aaaaaaaa.webp', p, w)) = 'ok', 'P não enviou no próprio evento';
--   assert pg_temp.erro(format(ins, 'capas-eventos', p || '/' || e1 || '/bbbbbbbb.jpeg', p, j)) = 'ok', 'P não enviou .jpeg';
--   assert pg_temp.erro(format(ins, 'capas-eventos', p || '/' || e1 || '/cccccccc.webp', p, '{"mimetype":"image/webp","contentLength":2097152}')) = 'ok', 'recusou exatamente 2 MB';
--   assert pg_temp.erro(format(ins, 'capas-eventos', p || '/' || e5 || '/aaaaaaaa.webp', p, w)) = '42501', 'P enviou no evento de Q';
--   assert pg_temp.erro(format(ins, 'capas-eventos', q || '/' || e5 || '/aaaaaaaa.webp', p, w)) = '42501', 'P enviou na pasta de Q';
--   assert pg_temp.erro(format(ins, 'capas-eventos', p || '/' || e1 || '/sub/aaaaaaaa.webp', p, w)) = '42501', 'subpasta aceita';
--   assert pg_temp.erro(format(ins, 'capas-eventos', p || '/' || e1 || '/aaaaaaaa.png', p, w)) = '42501', 'png aceito no nome';
--   assert pg_temp.erro(format(ins, 'capas-eventos', p || '/' || e1 || '/a.webp', p, w)) = '42501', 'nome curto aceito';
--   assert pg_temp.erro(format(ins, 'capas-eventos', p || '/00000000-0000-4000-8000-000000000000/aaaaaaaa.webp', p, w)) = '42501', 'evento inexistente aceito';
--   assert pg_temp.erro(format(ins, 'capas-eventos', 'aaaaaaaa.webp', p, w)) = '42501', 'arquivo na raiz aceito';
--   assert pg_temp.erro(format(ins, 'outro-bucket', p || '/' || e1 || '/aaaaaaaa.webp', p, w)) = '42501', 'regra vale para outro bucket';
--   -- tipo e tamanho (a cópia do Storage leva a metadata do arquivo de origem, p.ex. um anexo do chat)
--   assert pg_temp.erro(format(ins, 'capas-eventos', p || '/' || e1 || '/dddddddd.webp', p, '{"mimetype":"application/pdf","contentLength":1234}')) = '42501', 'pdf aceito';
--   assert pg_temp.erro(format(ins, 'capas-eventos', p || '/' || e1 || '/dddddddd.webp', p, '{"mimetype":"image/png","contentLength":1234}')) = '42501', 'png (mimetype) aceito';
--   assert pg_temp.erro(format(ins, 'capas-eventos', p || '/' || e1 || '/dddddddd.webp', p, '{"mimetype":"image/webp","contentLength":2097153}')) = '42501', '2 MB + 1 aceito';
--   assert pg_temp.erro(format(ins, 'capas-eventos', p || '/' || e1 || '/dddddddd.webp', p, '{"mimetype":"image/webp","contentLength":10485760}')) = '42501', '10 MB aceito';
--   assert pg_temp.erro(format(ins, 'capas-eventos', p || '/' || e1 || '/dddddddd.webp', p, '{"mimetype":"image/webp","contentLength":0}')) = '42501', 'tamanho 0 aceito';
--   assert pg_temp.erro(format(ins, 'capas-eventos', p || '/' || e1 || '/dddddddd.webp', p, '{"mimetype":"image/webp"}')) = '42501', 'sem tamanho aceito';
--   assert pg_temp.erro(format(ins, 'capas-eventos', p || '/' || e1 || '/dddddddd.webp', p, '{"contentLength":1234}')) = '42501', 'sem tipo aceito';
--   assert pg_temp.erro(format('insert into storage.objects (bucket_id, name, owner) values (%L, %L, %L)', 'capas-eventos', p || '/' || e1 || '/dddddddd.webp', p)) = '42501', 'sem metadata aceito';
--   -- evento cancelado
--   assert pg_temp.erro(format(ins, 'capas-eventos', p || '/' || e8 || '/aaaaaaaa.webp', p, w)) = '42501', 'enviou em evento cancelado';
--   -- teto de 10 por evento (já há 3 no e1)
--   for i in 1..7 loop
--     assert pg_temp.erro(format(ins, 'capas-eventos', p || '/' || e1 || '/eeeeee0' || i || '.webp', p, w)) = 'ok', 'não enviou o arquivo ' || (i + 3);
--   end loop;
--   assert pg_temp.erro(format(ins, 'capas-eventos', p || '/' || e1 || '/ffffffff.webp', p, w)) = '42501', 'enviou o 11º arquivo do evento';
--   assert pg_temp.erro(format(ins, 'capas-eventos', p || '/' || e3 || '/aaaaaaaa.webp', p, w)) = 'ok', 'o teto do e1 travou o e3';
--   assert (select count(*) from storage.objects where bucket_id = 'capas-eventos') = 0, 'P lê/lista objetos do bucket';
--   update storage.objects set name = p || '/' || e1 || '/zzzzzzzz.webp' where bucket_id = 'capas-eventos';
--   -- apagar: o gatilho storage.protect_delete já barra DELETE direto em storage.objects (nem chega na RLS);
--   -- aqui só se confere que a única regra do bucket é a de INSERT
--   assert (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
--           and (policyname like 'capas%' or coalesce(qual, '') || coalesce(with_check, '') ilike '%capas-eventos%')) = 1, 'regra a mais citando capas-eventos';
--   assert (select cmd from pg_policies where policyname = 'capas_eventos_insert') = 'INSERT', 'regra não é de INSERT';
--   perform pg_temp.como('postgres');
--   assert (select count(*) from storage.objects where bucket_id = 'capas-eventos') = 11, 'esperava 11 arquivos';
--   assert (select count(*) from storage.objects where bucket_id = 'capas-eventos' and name = p || '/' || e1 || '/aaaaaaaa.webp') = 1, 'P renomeou arquivo';
--   perform pg_temp.como('authenticated', q);
--   assert pg_temp.erro(format(ins, 'capas-eventos', p || '/' || e1 || '/qqqqqqqq.webp', q, w)) = '42501', 'Q enviou no evento de P';
--   assert pg_temp.erro(format(ins, 'capas-eventos', q || '/' || e1 || '/qqqqqqqq.webp', q, w)) = '42501', 'Q enviou em evento que não é dele, na pasta dele';
--   assert pg_temp.erro(format(ins, 'capas-eventos', q || '/' || e5 || '/qqqqqqqq.webp', q, w)) = 'ok', 'Q não enviou no próprio evento';
--   perform pg_temp.como('anon');
--   assert pg_temp.erro(format(ins, 'capas-eventos', p || '/' || e1 || '/zzzzzzzz.webp', p, w)) = '42501', 'anon enviou';
--   assert (select count(*) from storage.objects where bucket_id = 'capas-eventos') = 0, 'anon lista objetos';
--   assert pg_temp.erro('select public.capas_can_upload(''x/y/z'')') = '42501', 'anon executa capas_can_upload';
--   perform pg_temp.como('postgres');
--   assert (select count(*) from public.capas_arquivos_a_apagar(p)) = 11, 'capas_arquivos_a_apagar(P) não achou os 11';
--   assert (select count(*) from public.capas_arquivos_a_apagar(q)) = 1, 'capas_arquivos_a_apagar(Q) errado';
--   raise notice 'T5 OK';
-- end $$;
-- rollback;
