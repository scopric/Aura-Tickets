-- Logo do produtor (Ricardo, 08/10/2026; Decisão 206 e plano-mestre, seção 2.2). Uma logo por produtor, para planilhas, PDFs,
-- ingresso e e-mails (ainda sem consumidor: ligar nas exportações e no ingresso é trabalho de outros PRs). NÃO aparece na página pública do evento (organizador_publico não a lê).
-- O que faz:
--   1. producer_profiles.logo_url: URL pública da logo; o CHECK só aceita arquivo do bucket logos-produtor DENTRO da pasta do próprio produtor
--      (nulo = sem logo). O dono já edita a própria linha (regra "Produtores gerenciam próprio perfil", com 2FA): nenhuma função nova.
--   2. Bucket público logos-produtor (png, webp ou jpeg, até 1 MB) e UMA regra de INSERT em storage.objects: caminho <produtor>/<nome>.<ext>,
--      tipo e tamanho conferidos, só quem tem producer_profiles envia, no máximo 20 envios por produtor a cada 24 horas.
--   Sem regra de UPDATE nem DELETE (como cardapio-itens): trocar a logo sobe arquivo novo; o antigo fica órfão. O teto vale por dia (20 envios por
--   24 h, no máximo 20 MB por produtor por dia), para o produtor nunca ficar travado para sempre.
-- Como aplicar: ANTES de mesclar o front (que lê e grava logo_url). Colar inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA pelo TextEdit).
--   Uma transação, idempotente. Sem mudança em dados existentes.
-- Como desfazer (só depois de tirar o front): alter table public.producer_profiles drop column if exists logo_url;
--   drop policy if exists logos_produtor_insert on storage.objects; drop function if exists public.logos_can_upload(text);
--   (arquivos do bucket só saem pelo painel do Storage: o banco bloqueia DELETE direto em storage.objects).
begin;
set local lock_timeout = '5s';

do $$
begin
  if to_regclass('storage.objects') is null or to_regclass('storage.buckets') is null then
    raise exception 'storage.objects/buckets não existem';
  end if;
  if to_regclass('public.producer_profiles') is null then
    raise exception 'public.producer_profiles não existe';
  end if;
end $$;

-- 1. Coluna e trava -----------------------------------------------------------------------------------------------
alter table public.producer_profiles add column if not exists logo_url text;
alter table public.producer_profiles drop constraint if exists producer_profiles_logo_url_check;
alter table public.producer_profiles add constraint producer_profiles_logo_url_check
  check (logo_url is null or logo_url ~ ('^https://rwaezeqyuhxrssntcxdv\.supabase\.co/storage/v1/object/public/logos-produtor/'
    || id::text || '/[A-Za-z0-9_-]{8,80}\.(png|webp|jpe?g)$'));

-- 2. Bucket e regra de envio --------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos-produtor', 'logos-produtor', true, 1048576, array['image/png', 'image/webp', 'image/jpeg'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.logos_can_upload(p_name text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or split_part(p_name, '/', 1) <> v_uid::text then
    return false;
  end if;
  -- só quem tem perfil de produtor envia (conta comum não gasta o espaço do bucket)
  if not exists (select 1 from public.producer_profiles pp where pp.id = v_uid) then
    return false;
  end if;
  perform pg_advisory_xact_lock(hashtext('logos:' || v_uid::text));
  return (select count(*) from storage.objects o
          where o.bucket_id = 'logos-produtor'
            and starts_with(o.name, v_uid::text || '/')
            and o.created_at > now() - interval '24 hours') < 20;
end;
$$;
revoke all on function public.logos_can_upload(text) from public, anon, authenticated, service_role;
grant execute on function public.logos_can_upload(text) to authenticated;

drop policy if exists logos_produtor_insert on storage.objects;
create policy logos_produtor_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'logos-produtor'
    and objects.name ~ ('^' || (select auth.uid())::text || '/[A-Za-z0-9_-]{8,80}\.(png|webp|jpe?g)$')
    and (objects.metadata->>'mimetype') in ('image/png', 'image/webp', 'image/jpeg')
    and coalesce((objects.metadata->>'contentLength')::bigint, 0) between 1 and 1048576
    and public.logos_can_upload(objects.name)
  );

-- 3. Conferência que aborta (tudo ou nada) ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'logos-produtor' and public
                 and file_size_limit = 1048576 and allowed_mime_types = array['image/png', 'image/webp', 'image/jpeg']) then
    raise exception 'bucket logos-produtor fora do esperado';
  end if;
  -- exatamente 1 regra cita o bucket (a de INSERT); nenhuma outra, de qualquer tipo, o alcança
  if (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
      and coalesce(qual, '') || coalesce(with_check, '') like '%logos-produtor%') <> 1
     or not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                    and policyname = 'logos_produtor_insert' and cmd = 'INSERT') then
    raise exception 'esperado exatamente 1 regra citando logos-produtor, e ela é logos_produtor_insert (INSERT)';
  end if;
  -- regra permissiva de INSERT, UPDATE (um 'move' para este bucket) ou ALL cujo with_check/using não COMECE por bucket_id = '<literal>' AND alcançaria este bucket; as restritivas
  -- (gf_mfa_aal2) só restringem e ficam de fora
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
             and permissive = 'PERMISSIVE' and cmd in ('INSERT', 'UPDATE', 'ALL') and policyname <> 'logos_produtor_insert'
             and coalesce(with_check, qual, '') !~ $re$^\(*bucket_id = '[^']+'(::text)?\)+ AND $re$) then
    raise exception 'há regra permissiva de INSERT/UPDATE em storage.objects sem bucket_id = literal: %',
      (select string_agg(policyname::text, ', ') from pg_policies where schemaname = 'storage' and tablename = 'objects'
       and permissive = 'PERMISSIVE' and cmd in ('INSERT', 'UPDATE', 'ALL') and policyname <> 'logos_produtor_insert'
       and coalesce(with_check, qual, '') !~ $re$^\(*bucket_id = '[^']+'(::text)?\)+ AND $re$);
  end if;
  if has_function_privilege('anon', 'public.logos_can_upload(text)', 'execute')
     or not has_function_privilege('authenticated', 'public.logos_can_upload(text)', 'execute') then
    raise exception 'EXECUTE de logos_can_upload errado';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'producer_profiles' and column_name = 'logo_url')
     or not exists (select 1 from pg_constraint where conname = 'producer_profiles_logo_url_check' and convalidated) then
    raise exception 'logo_url ou a trava dela não ficou no lugar';
  end if;
end $$;

commit;

select 'bucket' as item, id as nome, public::text as valor, file_size_limit::text as extra, allowed_mime_types::text as extra2
from storage.buckets where id = 'logos-produtor'
union all
select 'regra storage.objects', policyname, cmd, roles::text, null
from pg_policies where schemaname = 'storage' and tablename = 'objects' and coalesce(with_check, '') like '%logos-produtor%'
union all
select 'coluna', column_name, data_type, is_nullable, null
from information_schema.columns where table_schema = 'public' and table_name = 'producer_profiles' and column_name = 'logo_url';
