-- =============================================================================
-- Tela 24 (Cardápio do produtor), SQL das fotos dos itens. 07/10/2026.
--   Bucket de Storage "cardapio-itens": público para ler, 2 MB, só jpeg e webp; enviar só em
--   <producer_id>/<arquivo> do próprio produtor, até 300 arquivos por produtor; sem alterar, apagar nem listar.
--
-- Como aplicar: colar o arquivo inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA pelo TextEdit: erro 17).
-- Uma transação só: se a conferência final falhar, nada é gravado. Idempotente (pode rodar de novo).
-- NÃO mover para supabase/migrations/ (motivo no cabeçalho de 20260927_security_hardening.sql).
-- ORDEM: aplicar este SQL ANTES de publicar o front da tela 24 (sem o bucket, salvar item com foto dá erro de envio;
-- salvar sem foto continua funcionando).
--
-- PASSO 0 (só leitura; rodar SOZINHO antes de aplicar): mesma conferência do 20261007_capa_e_cor_do_evento.sql:
--   select policyname, cmd, roles::text, qual, with_check from pg_policies
--    where schemaname = 'storage' and tablename = 'objects';
--   select policyname, roles::text, with_check from pg_policies
--    where schemaname = 'storage' and tablename = 'objects' and cmd in ('INSERT', 'ALL') and permissive = 'PERMISSIVE';
--   Esperado: só capas_eventos_insert e chat_anexos_insert (with_check com bucket_id = '<literal>'). O bloco 3 aborta
--   se houver regra permissiva de INSERT (ou ALL) cujo with_check não tenha bucket_id = '<literal>': ela deixaria
--   enviar para este bucket fora do caminho. Regra de SELECT sem bucket_id também listaria: conferir à vista.
--
-- DECISÕES (as de 1 a 4 do 20261007_capa_e_cor_do_evento.sql valem aqui igualmente)
-- 1. Só INSERT em storage.objects; nenhuma regra de SELECT, UPDATE ou DELETE: a leitura é pela URL pública, com
--    upsert: false e nome novo (uuid) a cada envio. O nome do arquivo da pessoa nunca entra no caminho.
-- 2. Caminho aceito: <auth.uid()>/<8-80 letras, números, _ ou ->.webp|.jpg|.jpeg, sem subpasta. mimetype e
--    contentLength da metadata são repetidos na regra por causa da rota de cópia do Storage (não confere o bucket
--    de destino). A regra restritiva gf_mfa_aal2 de storage.objects continua valendo.
-- 3. Teto de 300 arquivos por produtor (cardapio_can_upload, SECURITY DEFINER, search_path vazio, com
--    pg_advisory_xact_lock por produtor). Limite da trava: envios simultâneos podem passar do teto por poucos
--    arquivos (o lock some no fim do teste de permissão do storage-api); serve contra abuso de volume.
-- 3b. Quem esgota os 300 arquivos fica travado: não há regra de DELETE (o gatilho storage.protect_delete também barra).
--    O envio passa a dar 403/42501; o front avisa "Limite de fotos do cardápio atingido ou conta sem permissão de
--    produtor" (mensagemDeEnvio em capaEvento.ts). Liberar espaço exige apagar pelo painel/service_role.
-- 4. A coluna menu_items.image_url NÃO ganha CHECK aqui (fora do escopo): aceita qualquer texto, como antes.
-- PENDÊNCIAS (fora deste arquivo):
--   // ponytail: incluir o bucket cardapio-itens em capas_arquivos_a_apagar / delete-account (LGPD: a exclusão de
--   conta ainda não apaga as fotos de itens). Arquivos órfãos (item excluído ou foto trocada) ficam no bucket até
--   existir essa limpeza; o teto de 300 por produtor limita o estrago.
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 0. Pré-requisitos
do $$
begin
  if to_regclass('storage.objects') is null or to_regclass('storage.buckets') is null then
    raise exception 'storage.objects/buckets não existem';
  end if;
end $$;

-- 1. Bucket cardapio-itens ------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cardapio-itens', 'cardapio-itens', true, 2097152, array['image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2. Teto de envio e regra do bucket: só INSERT -----------------------------------------------------------------
create or replace function public.cardapio_can_upload(p_name text)
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
  -- só produtor ou admin envia (conta comum não gasta o espaço do bucket); profiles.id = auth.uid()
  if not exists (select 1 from public.profiles p where p.id = v_uid and p.role in ('producer', 'admin')) then
    return false;
  end if;
  perform pg_advisory_xact_lock(hashtext('cardapio:' || v_uid::text));
  return (select count(*) from storage.objects o
          where o.bucket_id = 'cardapio-itens'
            and starts_with(o.name, v_uid::text || '/')) < 300;
end;
$$;
revoke all on function public.cardapio_can_upload(text) from public, anon, authenticated, service_role;
grant execute on function public.cardapio_can_upload(text) to authenticated;

drop policy if exists cardapio_itens_insert on storage.objects;
create policy cardapio_itens_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'cardapio-itens'
    and objects.name ~ ('^' || (select auth.uid())::text || '/[A-Za-z0-9_-]{8,80}\.(webp|jpe?g)$')
    and (objects.metadata->>'mimetype') in ('image/jpeg', 'image/webp')
    and coalesce((objects.metadata->>'contentLength')::bigint, 0) between 1 and 2097152
    and public.cardapio_can_upload(objects.name)
  );

-- 3. Conferência que aborta (tudo ou nada) ------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'cardapio-itens' and public
                 and file_size_limit = 2097152 and allowed_mime_types = array['image/jpeg', 'image/webp']) then
    raise exception 'bucket cardapio-itens fora do esperado';
  end if;
  -- exatamente 1 regra cita o bucket (a de INSERT); nenhuma outra, de qualquer tipo, o alcança
  if (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
      and coalesce(qual, '') || coalesce(with_check, '') like '%cardapio-itens%') <> 1
     or not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                    and policyname = 'cardapio_itens_insert' and cmd = 'INSERT') then
    raise exception 'esperado exatamente 1 regra citando cardapio-itens, e ela é cardapio_itens_insert (INSERT)';
  end if;
  -- regra permissiva de INSERT (ou ALL) cujo with_check não COMECE por bucket_id = '<literal>' AND (barra também `or true`) alcançaria este bucket; as restritivas
  -- (gf_mfa_aal2) só restringem e ficam de fora
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
             and permissive = 'PERMISSIVE' and cmd in ('INSERT', 'ALL') and policyname <> 'cardapio_itens_insert'
             and coalesce(with_check, qual, '') !~ $re$^\(*bucket_id = '[^']+'(::text)?\)+ AND $re$) then
    raise exception 'há regra permissiva de INSERT em storage.objects sem bucket_id = literal: %',
      (select string_agg(policyname::text, ', ') from pg_policies where schemaname = 'storage' and tablename = 'objects'
       and permissive = 'PERMISSIVE' and cmd in ('INSERT', 'ALL') and policyname <> 'cardapio_itens_insert'
       and coalesce(with_check, qual, '') !~ $re$^\(*bucket_id = '[^']+'(::text)?\)+ AND $re$);
  end if;
  if has_function_privilege('anon', 'public.cardapio_can_upload(text)', 'execute')
     or not has_function_privilege('authenticated', 'public.cardapio_can_upload(text)', 'execute') then
    raise exception 'EXECUTE de cardapio_can_upload errado';
  end if;
end $$;

commit;

-- Conferência (só leitura). Esperado: 1 linha de bucket (público, 2097152, {image/jpeg,image/webp}) e, em
-- storage.objects, a regra cardapio_itens_insert (INSERT, authenticated) e NENHUMA outra citando cardapio-itens.
select 'bucket' as item, id as nome, public::text as valor, file_size_limit::text as extra, allowed_mime_types::text as extra2
from storage.buckets where id = 'cardapio-itens'
union all
select 'regra storage.objects', policyname, cmd, roles::text, null
from pg_policies where schemaname = 'storage' and tablename = 'objects'
order by 1, 2;

-- =============================================================================
-- TESTES (rodar à mão: tire o "-- " do começo das linhas abaixo e rode tudo de uma vez; o bloco inteiro está num
-- begin ... rollback e não deixa nada gravado). Rodar DEPOIS de aplicar o arquivo, em banco LOCAL (nunca em produção).
-- Falha = ERROR com o motivo; sucesso = "NOTICE: T1 OK".
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
-- insert into auth.users (id, email) values
--   ('c6b00000-0000-4000-8000-000000000001', 'p@teste-cardapio.invalid'),
--   ('c6b00000-0000-4000-8000-000000000002', 'q@teste-cardapio.invalid');
-- update public.profiles set role = 'producer' where id = 'c6b00000-0000-4000-8000-000000000001';
-- do $$
-- declare p uuid := 'c6b00000-0000-4000-8000-000000000001'; q uuid := 'c6b00000-0000-4000-8000-000000000002';
--   ins text := 'insert into storage.objects (bucket_id, name, owner, metadata) values (%L, %L, %L, %L::jsonb)';
--   w text := '{"mimetype":"image/webp","contentLength":1234}';
-- begin
--   perform pg_temp.como('authenticated', p);
--   assert pg_temp.erro(format(ins, 'cardapio-itens', p || '/aaaaaaaa-1111.webp', p, w)) = 'ok', 'P não enviou na própria pasta';
--   -- conta comum (role user) não envia
--   perform pg_temp.como('postgres');
--   update public.profiles set role = 'producer' where id in (p, q);
--   update public.profiles set role = 'user' where id = q;
--   perform pg_temp.como('authenticated', q);
--   assert pg_temp.erro(format(ins, 'cardapio-itens', q || '/aaaaaaaa-7777.webp', q, w)) = '42501', 'user enviou';
--   perform pg_temp.como('authenticated', p);
--   assert pg_temp.erro(format(ins, 'cardapio-itens', q || '/aaaaaaaa-2222.webp', p, w)) = '42501', 'P enviou na pasta de Q';
--   assert pg_temp.erro(format(ins, 'cardapio-itens', p || '/../' || q || '/aaaaaaaa.webp', p, w)) = '42501', 'aceitou ../';
--   assert pg_temp.erro(format(ins, 'cardapio-itens', p || '/sub/aaaaaaaa.webp', p, w)) = '42501', 'subpasta aceita';
--   assert pg_temp.erro(format(ins, 'cardapio-itens', p || '/aaaaaaaa-3333.svg', p, '{"mimetype":"image/svg+xml","contentLength":1234}')) = '42501', 'SVG aceito';
--   assert pg_temp.erro(format(ins, 'cardapio-itens', p || '/aaaaaaaa-4444.webp', p, '{"mimetype":"image/webp","contentLength":3145728}')) = '42501', '3 MB aceito';
--   assert pg_temp.erro(format('insert into storage.objects (bucket_id, name, owner) values (%L, %L, %L)', 'cardapio-itens', p || '/aaaaaaaa-5555.webp', p)) = '42501', 'sem metadata aceito';
--   assert (select count(*) from storage.objects where bucket_id = 'cardapio-itens') = 0, 'P lista objetos do bucket';
--   perform pg_temp.como('anon');
--   assert pg_temp.erro(format(ins, 'cardapio-itens', p || '/aaaaaaaa-6666.webp', p, w)) = '42501', 'anon enviou';
--   assert pg_temp.erro('select public.cardapio_can_upload(''x/y'')') = '42501', 'anon executa cardapio_can_upload';
--   perform pg_temp.como('postgres');
--   assert (select count(*) from storage.objects where bucket_id = 'cardapio-itens') = 1, 'esperava 1 arquivo';
--   raise notice 'T1 OK';
-- end $$;
-- rollback;
