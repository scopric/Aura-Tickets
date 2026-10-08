-- NUNCA aplicar em produção: é só para `supabase start`/`db reset` locais. Na produção esta versão já está marcada como aplicada (ver README).
-- Baseline: retrato SÓ DO SCHEMA (sem dados) do banco de produção do Evokaa (projeto rwaezeqyuhxrssntcxdv).
-- Regerado em 2026-10-08 com `supabase db dump --linked` (pg_dump, somente leitura; nenhuma escrita em produção), schema public.
-- Substitui o retrato de 2026-09-30 (que não tinha 28 tabelas, 130 triggers e dezenas de funções que entraram via docs/sql).
-- A mesma versão (20260930134600) é mantida de propósito: na produção ela já está marcada como aplicada (ver README).
-- O final ("Completado fora de public") vem do retrato anterior: gatilho em auth.users, bucket e policies do Storage e event trigger.
-- Segue de fora: dados, jobs do pg_cron, segredos do Vault, arquivos do Storage e os buckets/policies do Storage posteriores a 30/09
-- (ex.: capas-eventos, logos-produtor): o banco local NÃO é idêntico à produção nessa parte.


-- Zera os privilégios padrão do Supabase local em public ANTES de criar os objetos: o pg_dump só emite os GRANTs que a produção
-- tem (e o ALTER DEFAULT PRIVILEGES no fim). Sem isto, o anon recebe EXECUTE/SELECT por padrão e o banco local fica mais aberto que a produção.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated, service_role;




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."aceite_evento_versao"() RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$ select '2026-10-07' $$;


ALTER FUNCTION "public"."aceite_evento_versao"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_activity_stats"("desde" timestamp with time zone) RETURNS TABLE("sessoes" bigint, "visualizacoes" bigint, "logins" bigint, "contas_ativas" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  -- Decisão 163: a permissão da tela (Analytics), não "qualquer admin"
  if not public.gf_admin_can('view_analytics') then
    raise exception 'acesso negado: precisa da permissão view_analytics' using errcode = '42501';
  end if;
  return query
    select count(distinct a.session_id),
           count(*) filter (where a.event_type = 'page_view'),
           count(*) filter (where a.event_type = 'login'),
           count(distinct a.user_id)
    from public.user_activities a
    where a.created_at >= desde;
end;
$$;


ALTER FUNCTION "public"."admin_activity_stats"("desde" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_equipe"() RETURNS TABLE("id" "uuid", "full_name" "text", "email" "text", "avatar_url" "text", "admin_permissions" "text"[])
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.gf_admin_can('manage_team') then
    raise exception 'acesso negado: precisa da permissão manage_team' using errcode = '42501';
  end if;
  return query
    select p.id, p.full_name, p.email, p.avatar_url, p.admin_permissions
    from public.profiles p
    where p.role = 'admin'
    order by p.full_name;
end;
$$;


ALTER FUNCTION "public"."admin_equipe"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producer_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "subtitle" "text",
    "slug" "text" NOT NULL,
    "description" "text",
    "short_description" "text",
    "cover_image" "text",
    "image_url" "text",
    "gallery" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "category" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "venue_name" "text",
    "venue_address" "text",
    "venue_city" "text",
    "venue_state" "text",
    "venue_zip" "text",
    "venue_lat" numeric,
    "venue_lng" numeric,
    "date" "date",
    "time" time without time zone,
    "start_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "end_date" timestamp with time zone,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "visibility" "text" DEFAULT 'public'::"text" NOT NULL,
    "capacity" integer,
    "branding" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "meta_title" "text",
    "meta_description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "approval_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "approved_at" timestamp with time zone,
    "approved_by" "uuid",
    "rejection_reason" "text",
    "featured_carousel" boolean DEFAULT false NOT NULL,
    "accent_color" "text",
    "mostrar_contagem" boolean DEFAULT false NOT NULL,
    "temas" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "estilos" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "classificacao" "text",
    "local_modo" "text" DEFAULT 'presencial'::"text" NOT NULL,
    "privado_alterado_em" timestamp with time zone,
    "ingressos_alterados_em" timestamp with time zone,
    "capa_na_cor" boolean DEFAULT false NOT NULL,
    "accent_intensity" smallint DEFAULT 100 NOT NULL,
    "ticket_style" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "events_accent_color_check" CHECK (("accent_color" ~ '^#[0-9a-fA-F]{6}$'::"text")),
    CONSTRAINT "events_accent_intensity_check" CHECK ((("accent_intensity" >= 10) AND ("accent_intensity" <= 100))),
    CONSTRAINT "events_approval_status_check" CHECK (("approval_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "events_classificacao_check" CHECK (("classificacao" = ANY (ARRAY['AL'::"text", 'A6'::"text", 'A10'::"text", 'A12'::"text", 'A14'::"text", 'A16'::"text", 'A18'::"text"]))),
    CONSTRAINT "events_cover_image_check" CHECK ((("cover_image" IS NULL) OR ("cover_image" = '/images/hero-bg.jpg'::"text") OR ("cover_image" ~ (((('^https://rwaezeqyuhxrssntcxdv\.supabase\.co/storage/v1/object/public/capas-eventos/'::"text" || ("producer_id")::"text") || '/'::"text") || ("id")::"text") || '/[A-Za-z0-9_-]{8,80}\.(webp|jpe?g)$'::"text")))),
    CONSTRAINT "events_estilos_check" CHECK ((("cardinality"("estilos") <= 3) AND (("cardinality"("estilos") = 0) OR ('musica'::"text" = ANY ("temas"))) AND ("estilos" <@ ARRAY['sertanejo'::"text", 'funk'::"text", 'rock'::"text", 'pop'::"text", 'eletronica'::"text", 'mpb'::"text", 'samba_pagode'::"text", 'forro'::"text", 'rap_trap'::"text", 'jazz_blues'::"text", 'indie'::"text", 'reggae'::"text", 'kpop'::"text", 'gospel'::"text", 'axe'::"text", 'classica'::"text", 'outro'::"text"]))),
    CONSTRAINT "events_image_url_check" CHECK ((("image_url" IS NULL) OR ("image_url" = '/images/hero-bg.jpg'::"text") OR ("image_url" ~ (((('^https://rwaezeqyuhxrssntcxdv\.supabase\.co/storage/v1/object/public/capas-eventos/'::"text" || ("producer_id")::"text") || '/'::"text") || ("id")::"text") || '/[A-Za-z0-9_-]{8,80}\.(webp|jpe?g)$'::"text")))),
    CONSTRAINT "events_local_modo_check" CHECK (("local_modo" = ANY (ARRAY['presencial'::"text", 'online'::"text", 'hibrido'::"text", 'a_definir'::"text"]))),
    CONSTRAINT "events_slug_nao_uuid" CHECK ((("slug" IS NULL) OR ("slug" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::"text"))),
    CONSTRAINT "events_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'cancelled'::"text", 'ended'::"text"]))),
    CONSTRAINT "events_tags_max_check" CHECK (("cardinality"("tags") <= 10)),
    CONSTRAINT "events_temas_check" CHECK ((("cardinality"("temas") <= 3) AND ("temas" <@ ARRAY['musica'::"text", 'gastronomia_bebidas'::"text", 'negocios'::"text", 'tecnologia'::"text", 'arte_cultura'::"text", 'bem_estar'::"text", 'esportes'::"text", 'religiao'::"text", 'infantil_familia'::"text", 'educacao'::"text", 'moda'::"text", 'causas_sociais'::"text", 'ar_livre'::"text", 'datas_comemorativas'::"text"]))),
    CONSTRAINT "events_ticket_style_check" CHECK ((("jsonb_typeof"("ticket_style") = 'object'::"text") AND ((("ticket_style" - 'cor'::"text") - 'logo'::"text") = '{}'::"jsonb") AND ((NOT ("ticket_style" ? 'cor'::"text")) OR (("jsonb_typeof"(("ticket_style" -> 'cor'::"text")) = 'string'::"text") AND (("ticket_style" ->> 'cor'::"text") ~ '^#[0-9a-fA-F]{6}$'::"text"))) AND ((NOT ("ticket_style" ? 'logo'::"text")) OR (("jsonb_typeof"(("ticket_style" -> 'logo'::"text")) = 'string'::"text") AND (("ticket_style" ->> 'logo'::"text") = ANY (ARRAY['esquerda'::"text", 'centro'::"text"])))))),
    CONSTRAINT "events_visibility_check" CHECK (("visibility" = ANY (ARRAY['public'::"text", 'private'::"text", 'unlisted'::"text", 'password'::"text"])))
);


ALTER TABLE "public"."events" OWNER TO "postgres";


COMMENT ON COLUMN "public"."events"."capa_na_cor" IS 'true: capa em duotone na cor do evento; false (padrão): foto original (Decisão 173)';



COMMENT ON COLUMN "public"."events"."accent_intensity" IS 'Intensidade da cor do evento em %, 10 a 100; 100 = cor cheia (padrão)';



COMMENT ON COLUMN "public"."events"."ticket_style" IS 'Estilo do ingresso do evento: {cor, logo}; vazio = modelo padrão da Evokaa. Sem texto livre (sem moderação)';



CREATE OR REPLACE FUNCTION "public"."admin_evento_decidir"("p_id" "uuid", "p_decisao" "text", "p_motivo" "text", "p_versao" timestamp with time zone) RETURNS "public"."events"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v_aprova boolean := p_decisao = 'aprovar';
  v_motivo text := nullif(btrim(p_motivo), '');
  v_ev public.events;
begin
  if not (select public.gf_admin_can('manage_events')) then
    raise exception 'Sem permissão para moderar eventos' using errcode = '42501';
  end if;
  if p_decisao is null or p_decisao not in ('aprovar', 'recusar', 'revogar') then
    raise exception 'Decisão inválida: use aprovar, recusar ou revogar' using errcode = '22023';
  end if;
  if p_decisao = 'recusar' and (v_motivo is null or char_length(v_motivo) > 500) then
    raise exception 'Recusar exige um motivo de até 500 caracteres' using errcode = '22023';
  end if;

  update public.events set
    approval_status = case p_decisao when 'aprovar' then 'approved' when 'recusar' then 'rejected' else 'pending' end,
    approved_at = case when v_aprova then now() end,
    approved_by = case when v_aprova then (select auth.uid()) end,
    rejection_reason = case when p_decisao = 'recusar' then v_motivo end,
    featured_carousel = case when v_aprova then featured_carousel else false end,
    -- só o que está no ar sai do ar: cancelled e ended são decisão do produtor
    status = case when not v_aprova and status = 'published' then 'draft' else status end,
    ingressos_alterados_em = case when v_aprova then null else ingressos_alterados_em end
  -- revogar ignora a versão (o produtor não pode impedi-la mexendo no evento sem parar), mas só vale sobre evento ainda
  -- approved: revogar um rejected apagaria a recusa e o motivo (tela velha do admin)
  where id = p_id
    and case when p_decisao = 'revogar' then approval_status = 'approved' else updated_at = p_versao end
  returning * into v_ev;

  if not found then
    raise exception 'O evento mudou desde que você abriu; recarregue.' using errcode = 'P0002';
  end if;
  return v_ev;
end;
$$;


ALTER FUNCTION "public"."admin_evento_decidir"("p_id" "uuid", "p_decisao" "text", "p_motivo" "text", "p_versao" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_limpar_cpf_compra"("p_uid" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
begin
  if not public.gf_is_admin() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  update public.profiles set cpf_compra_hmac = null where id = p_uid;
  if not found then
    raise exception 'Conta não encontrada' using errcode = '22023';
  end if;
  -- trilha de admin da S5 (20261016), se já aplicada; sem ela só fica o `ponytail:` do cabeçalho
  if to_regclass('public.admin_audit_log') is not null then
    execute 'insert into public.admin_audit_log (autor, tipo, acao, tabela, objeto_id) values ($1, ''acao'', ''limpar_cpf_compra'', ''profiles'', $2)'
      using auth.uid(), p_uid::text;
  end if;
end;
$_$;


ALTER FUNCTION "public"."admin_limpar_cpf_compra"("p_uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_ocultar_organizador"("p_producer" "uuid", "p_ocultar" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare v_antes boolean;
begin
  if not (select public.gf_admin_can('manage_events')) then
    raise exception 'Sem permissão para moderar organizadores' using errcode = '42501';
  end if;
  if p_ocultar is null or not exists (select 1 from public.producer_profiles where id = p_producer) then
    raise exception 'Produtor ou decisão inválidos' using errcode = '22023';
  end if;
  select oculto_por_admin into v_antes from public.producer_public where producer_id = p_producer;
  insert into public.producer_public (producer_id, oculto_por_admin) values (p_producer, p_ocultar)
    on conflict (producer_id) do update set oculto_por_admin = p_ocultar, updated_at = now();
  -- trilha (S5) quando existir neste banco; mesmas colunas de 20261016_admin_s5_trilha.sql
  if to_regclass('public.admin_audit_log') is not null then
    execute 'insert into public.admin_audit_log (autor, tipo, acao, tabela, objeto_id, antes, depois)
             values ($1, ''acao'', $2, ''producer_public'', $3, $4, $5)'
      using (select auth.uid()), case when p_ocultar then 'ocultar_organizador' else 'mostrar_organizador' end,
            p_producer::text, jsonb_build_object('oculto_por_admin', coalesce(v_antes, false)),
            jsonb_build_object('oculto_por_admin', p_ocultar);
  end if;
end $_$;


ALTER FUNCTION "public"."admin_ocultar_organizador"("p_producer" "uuid", "p_ocultar" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_registrar_exportacao"("p_tabela" "text", "p_linhas" integer, "p_motivo" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_perm text := case p_tabela
    when 'users' then 'manage_users' when 'profiles' then 'manage_users'
    when 'events' then 'manage_events'
    when 'orders' then 'manage_finance' when 'transactions' then 'manage_finance' when 'withdrawals' then 'manage_finance'
    when 'user_activities' then 'view_analytics' end;
begin
  if v_perm is null then
    raise exception 'Tabela de exportação desconhecida.' using errcode = '22023';
  end if;
  if not public.gf_admin_can(v_perm) then
    raise exception 'Sem permissão para exportar esta área.' using errcode = '42501';
  end if;
  if p_linhas is null or p_linhas < 0 then
    raise exception 'Número de linhas inválido.' using errcode = '22023';
  end if;
  insert into public.admin_audit_log (autor, tipo, acao, tabela, depois, motivo, ip)
  values ((select auth.uid()), 'leitura', 'exportar', p_tabela, jsonb_build_object('linhas', p_linhas),
          coalesce(nullif(left(btrim(p_motivo), 500), ''), public.audit_motivo_cabecalho()), null /* IP desligado */);
end;
$$;


ALTER FUNCTION "public"."admin_registrar_exportacao"("p_tabela" "text", "p_linhas" integer, "p_motivo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_usuario_ficha"("p_user" "uuid", "p_motivo" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_perfil jsonb;
begin
  if not public.gf_admin_can('manage_users') then
    raise exception 'Só quem gerencia usuários vê a ficha.' using errcode = '42501';
  end if;
  select jsonb_build_object('id', p.id, 'email', p.email, 'full_name', p.full_name, 'phone', p.phone, 'role', p.role,
      'created_at', p.created_at, 'avatar_url', p.avatar_url,
      'producer_subscriptions', coalesce((select jsonb_agg(jsonb_build_object('plan', s.plan, 'expires_at', s.expires_at,
          'is_active', s.is_active)) from public.producer_subscriptions s where s.producer_id = p.id), '[]'::jsonb),
      'user_custom_features', coalesce((select jsonb_agg(jsonb_build_object('feature_key', f.feature_key,
          'expires_at', f.expires_at)) from public.user_custom_features f where f.user_id = p.id), '[]'::jsonb))
    into v_perfil from public.profiles p where p.id = p_user;
  if v_perfil is null then
    raise exception 'Usuário não encontrado.' using errcode = 'P0001';
  end if;
  insert into public.admin_audit_log (autor, tipo, acao, tabela, objeto_id, motivo, ip)
  values ((select auth.uid()), 'leitura', 'ver_ficha', 'profiles', p_user::text,
          coalesce(nullif(left(btrim(p_motivo), 500), ''), public.audit_motivo_cabecalho()), null /* IP desligado */);
  return jsonb_build_object('perfil', v_perfil,
    'atividades', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc)
      from (select * from public.user_activities where user_id = p_user order by created_at desc limit 1000) a), '[]'::jsonb),
    'ingressos', coalesce((select jsonb_agg(jsonb_build_object('event_id', t.event_id))
      from public.tickets t where t.user_id = p_user), '[]'::jsonb));
end;
$$;


ALTER FUNCTION "public"."admin_usuario_ficha"("p_user" "uuid", "p_motivo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_usuarios_lista"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.gf_admin_can('manage_users') then
    raise exception 'acesso negado: precisa da permissão manage_users' using errcode = '42501';
  end if;
  -- mesma forma que o PostgREST devolvia a Users.tsx: assinatura 1:1 (objeto ou nulo) e recursos em lista
  -- ponytail: sem teto de linhas (22 perfis hoje, 05/10/2026); paginar (limit/offset na RPC e na tela) quando passar de ~1000
  return coalesce((
    select jsonb_agg(x.j order by x.created_at desc)
    from (
      select p.created_at, jsonb_build_object(
        'id', p.id, 'email', p.email, 'full_name', p.full_name, 'phone', p.phone, 'role', p.role,
        'created_at', p.created_at, 'avatar_url', p.avatar_url,
        'producer_subscriptions', (select jsonb_build_object('plan', s.plan, 'expires_at', s.expires_at, 'is_active', s.is_active)
                                   from public.producer_subscriptions s where s.producer_id = p.id limit 1),
        'user_custom_features', coalesce((select jsonb_agg(jsonb_build_object('feature_key', f.feature_key, 'expires_at', f.expires_at))
                                          from public.user_custom_features f where f.user_id = p.id), '[]'::jsonb)) as j
      from public.profiles p) x), '[]'::jsonb);
end;
$$;


ALTER FUNCTION "public"."admin_usuarios_lista"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."affiliate_link_hit"("p_code" "text", "p_slug" "text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  update public.affiliate_links l
     set clicks = l.clicks + 1
    from public.platform_affiliates a
   where a.id = l.affiliate_id
     and upper(a.referral_code) = upper(p_code)
     and a.status = 'active'
     and l.slug = lower(p_slug)
     and l.is_active;
$$;


ALTER FUNCTION "public"."affiliate_link_hit"("p_code" "text", "p_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."affiliate_my_producers"() RETURNS TABLE("full_name" "text", "linked_at" timestamp with time zone, "ended_at" timestamp with time zone, "source" "text", "producer_since" timestamp with time zone, "link_slug" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select p.full_name, v.linked_at, v.ended_at, v.source, p.created_at, l.slug
  from public.platform_affiliate_producers v
  join public.platform_affiliates a on a.id = v.affiliate_id
  join public.profiles p on p.id = v.producer_id
  left join public.affiliate_links l on l.id = v.affiliate_link_id
  where a.user_id = (select auth.uid()) and public.gf_mfa_ok()
  order by v.linked_at desc;
$$;


ALTER FUNCTION "public"."affiliate_my_producers"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."afiliados_para_cupons"() RETURNS TABLE("id" "uuid", "nome" "text", "codigo" "text", "ativo" boolean)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.gf_admin_can_any(array['manage_coupons', 'manage_affiliates']) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  return query
    select pa.id, coalesce(pr.full_name, pa.full_name), pa.referral_code, pa.status = 'active'
    from public.platform_affiliates pa
    left join public.profiles pr on pr.id = pa.user_id
    order by pa.referral_code;
end;
$$;


ALTER FUNCTION "public"."afiliados_para_cupons"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."agent_meus_eventos"() RETURNS TABLE("id" "uuid", "title" "text", "start_date" timestamp with time zone, "status" "text", "capacity" integer, "venue_city" "text", "ingressos" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select e.id, e.title, e.start_date, e.status, e.capacity, e.venue_city,
         (select count(*)
          from public.tickets t
          join public.ticket_types tt on tt.id = t.ticket_type_id
          where tt.event_id = e.id) as ingressos
  from public.events e
  where e.producer_id = (select auth.uid())
  order by e.start_date desc;
$$;


ALTER FUNCTION "public"."agent_meus_eventos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ai_admin_resumo"("p_de" timestamp with time zone, "p_ate" timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_usd_brl numeric;
  v_out jsonb;
begin
  if not public.gf_admin_can('manage_settings') then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if p_de is null or p_ate is null or p_ate <= p_de then
    raise exception 'Período inválido' using errcode = '22023';
  end if;

  select s.usd_brl into v_usd_brl from public.ai_settings s where s.id = 1;

  -- "pergunta" = pedido de produtor atendido ou cobrado; pings do admin e recusas do roteador
  -- ficam só em "chamadas" (todas as linhas, que também têm custo)
  with u as (
    select a.*, (a.mode <> 'ping' and (a.credits > 0 or a.status = 'ok')) as pergunta
    from public.ai_usage a
    where a.created_at >= p_de and a.created_at < p_ate
  )
  select jsonb_build_object(
    'totais', (
      select jsonb_build_object(
        'usd', coalesce(sum(u.cost_usd), 0),
        'brl', round(coalesce(sum(u.cost_usd), 0) * v_usd_brl, 2),
        'perguntas', count(*) filter (where u.pergunta),
        'chamadas', count(*),
        'custo_medio_brl', round(coalesce(sum(u.cost_usd), 0) * v_usd_brl / nullif(count(*) filter (where u.pergunta), 0), 4)
      ) from u
    ),
    'por_dia', (
      select coalesce(jsonb_agg(jsonb_build_object('dia', x.dia, 'usd', x.usd, 'perguntas', x.n) order by x.dia), '[]')
      from (
        select (u.created_at at time zone 'America/Sao_Paulo')::date as dia,
               sum(u.cost_usd) as usd, count(*) filter (where u.pergunta) as n
        from u group by 1
      ) x
    ),
    'por_produtor', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'user_id', x.user_id, 'nome', p.full_name, 'email', p.email,
               'usd', x.usd, 'perguntas', x.n, 'creditos', x.cr) order by x.usd desc), '[]')
      from (
        select u.user_id, sum(u.cost_usd) as usd, count(*) filter (where u.pergunta) as n, sum(u.credits) as cr
        from u group by u.user_id
        order by usd desc
        limit 20
      ) x
      left join public.profiles p on p.id = x.user_id
    ),
    'por_modelo', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'model', x.model, 'usd', x.usd, 'perguntas', x.n,
               'tokens_in', x.tin, 'tokens_out', x.tout) order by x.usd desc), '[]')
      from (
        select u.model, sum(u.cost_usd) as usd, count(*) filter (where u.pergunta) as n,
               sum(u.tokens_in) as tin, sum(u.tokens_out) as tout
        from u group by u.model
      ) x
    ),
    'por_modo', (
      select coalesce(jsonb_agg(jsonb_build_object('mode', x.mode, 'usd', x.usd, 'perguntas', x.n) order by x.usd desc), '[]')
      from (
        select u.mode, sum(u.cost_usd) as usd, count(*) filter (where u.pergunta) as n
        from u group by u.mode
      ) x
    ),
    'historico', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', x.id, 'created_at', x.created_at, 'nome', p.full_name, 'email', p.email,
               'mode', x.mode, 'tier', x.tier, 'model', x.model,
               'tokens_in', x.tokens_in, 'tokens_out', x.tokens_out,
               'cost_usd', x.cost_usd, 'credits', x.credits, 'status', x.status)
             order by x.created_at desc), '[]')
      from (select * from u order by u.created_at desc limit 100) x
      left join public.profiles p on p.id = x.user_id
    )
  ) into v_out;

  return v_out;
end;
$$;


ALTER FUNCTION "public"."ai_admin_resumo"("p_de" timestamp with time zone, "p_ate" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ai_balance"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user uuid := auth.uid();
  v_enabled boolean;
  v record;
begin
  if not public.gf_mfa_ok() then
    raise exception 'Confirme o código do 2FA' using errcode = '42501';
  end if;
  if v_user is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;

  select s.enabled into v_enabled from public.ai_settings s where s.id = 1;
  select * into v from public.ai_saldo(v_user);

  return jsonb_build_object(
    'habilitado', coalesce(v_enabled, false),
    'plano', v.plano,
    'cota', v.cota,
    'concedido', v.concedido,
    'usado', v.usado,
    'restante', greatest(v.cota + v.concedido - v.usado, 0),
    'periodo', v.periodo
  );
end;
$$;


ALTER FUNCTION "public"."ai_balance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ai_custo"("p_model" "text", "p_in" bigint, "p_out" bigint) RETURNS numeric
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
declare
  v_prices jsonb;
  v_in numeric;
  v_out numeric;
begin
  select s.prices into v_prices from public.ai_settings s where s.id = 1;
  v_in := (v_prices -> p_model ->> 'in')::numeric;
  v_out := (v_prices -> p_model ->> 'out')::numeric;
  if v_in is null or v_out is null then
    raise warning 'ai_settings.prices sem preço para o modelo %; usando o maior preço da tabela', p_model;
    select max((p.value ->> 'in')::numeric), max((p.value ->> 'out')::numeric)
      into v_in, v_out
    from jsonb_each(v_prices) p;
  end if;
  return (greatest(coalesce(p_in, 0), 0) * coalesce(v_in, 0)
        + greatest(coalesce(p_out, 0), 0) * coalesce(v_out, 0)) / 1e6;
end;
$$;


ALTER FUNCTION "public"."ai_custo"("p_model" "text", "p_in" bigint, "p_out" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ai_finish"("p_id" "uuid", "p_tokens_in" integer, "p_tokens_out" integer, "p_steps" integer, "p_tools" "text"[], "p_status" "text", "p_resumo" "text", "p_called" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_tin int := greatest(coalesce(p_tokens_in, 0), 0);
  v_tout int := greatest(coalesce(p_tokens_out, 0), 0);
  v_model text;
  v_cost numeric(12,6);
begin
  if coalesce(p_status, '') not in ('ok', 'erro') then
    raise exception 'Status inválido' using errcode = '22023';
  end if;

  select u.model into v_model
  from public.ai_usage u
  where u.id = p_id and u.status = 'pendente'
  for update;
  if not found then
    return jsonb_build_object('cost_usd', null);
  end if;

  v_cost := public.ai_custo(v_model, v_tin, v_tout);

  update public.ai_usage u
  set tokens_in = v_tin,
      tokens_out = v_tout,
      cost_usd = v_cost,
      credits = case when p_status = 'erro' and not coalesce(p_called, false) then 0 else u.credits end,
      steps = greatest(coalesce(p_steps, 0), 0),
      tools = coalesce(p_tools, '{}'),
      status = p_status,
      resumo = left(p_resumo, 500),
      finished_at = now()
  where u.id = p_id;

  return jsonb_build_object('cost_usd', v_cost);
end;
$$;


ALTER FUNCTION "public"."ai_finish"("p_id" "uuid", "p_tokens_in" integer, "p_tokens_out" integer, "p_steps" integer, "p_tools" "text"[], "p_status" "text", "p_resumo" "text", "p_called" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ai_get_gemini_key"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select d.decrypted_secret
  from vault.decrypted_secrets d
  where d.name = 'gemini_api_key'
  limit 1;
$$;


ALTER FUNCTION "public"."ai_get_gemini_key"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ai_grant_credits"("p_user" "uuid", "p_amount" integer, "p_note" "text") RETURNS "uuid"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
  insert into public.ai_credit_grants (user_id, amount, note)
  values (p_user, p_amount, p_note)
  returning id;
$$;


ALTER FUNCTION "public"."ai_grant_credits"("p_user" "uuid", "p_amount" integer, "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ai_key_status"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_key text;
  v_ok boolean;
begin
  if not public.gf_admin_can('manage_settings') then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;

  select d.decrypted_secret into v_key
  from vault.decrypted_secrets d
  where d.name = 'gemini_api_key';
  v_ok := coalesce(v_key, '') <> '';

  return jsonb_build_object(
    'configurada', v_ok,
    'final_4', case when v_ok then right(v_key, 4) end,
    'atualizada_em', case when v_ok then (select s.key_updated_at from public.ai_settings s where s.id = 1) end
  );
end;
$$;


ALTER FUNCTION "public"."ai_key_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ai_log"("p_user" "uuid", "p_mode" "text", "p_tier" "text", "p_model" "text", "p_tokens_in" integer, "p_tokens_out" integer, "p_resumo" "text", "p_status" "text" DEFAULT 'erro'::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if coalesce(p_status, '') not in ('ok', 'erro') then
    raise exception 'Status inválido' using errcode = '22023';
  end if;

  insert into public.ai_usage (user_id, mode, tier, model, tokens_in, tokens_out, cost_usd,
                               credits, status, resumo, finished_at)
  values (p_user, p_mode, p_tier, p_model,
          greatest(coalesce(p_tokens_in, 0), 0), greatest(coalesce(p_tokens_out, 0), 0),
          public.ai_custo(p_model, p_tokens_in, p_tokens_out),
          0, p_status, left(p_resumo, 500), now());
end;
$$;


ALTER FUNCTION "public"."ai_log"("p_user" "uuid", "p_mode" "text", "p_tier" "text", "p_model" "text", "p_tokens_in" integer, "p_tokens_out" integer, "p_resumo" "text", "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ai_portoes"("p_user" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
declare
  s public.ai_settings;
begin
  select * into s from public.ai_settings where id = 1;
  if not coalesce(s.enabled, false) then
    return jsonb_build_object('ok', false, 'motivo', 'desligado');
  end if;

  if ((select coalesce(sum(u.cost_usd), 0) from public.ai_usage u
       where u.created_at >= date_trunc('day', now(), 'America/Sao_Paulo')
         and u.status <> 'pendente')
      + (select coalesce(sum(public.ai_custo(u.model,
                                             (s.max_steps + 2) * 20000,
                                             (s.max_steps + 2) * s.max_output_tokens)), 0)
         from public.ai_usage u
         where u.status = 'pendente' and u.created_at > now() - interval '2 hours')
     ) * s.usd_brl >= s.daily_cap_brl then
    return jsonb_build_object('ok', false, 'motivo', 'teto_diario');
  end if;

  if (select count(*) from public.ai_usage u
      where u.user_id = p_user and u.created_at > now() - interval '1 hour') >= s.hourly_limit then
    return jsonb_build_object('ok', false, 'motivo', 'limite_hora');
  end if;

  return null;
end;
$$;


ALTER FUNCTION "public"."ai_portoes"("p_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ai_precheck"("p_user" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v record;
  v_barrado jsonb;
  v_restante int;
  v_menor int;
begin
  if p_user is null then
    raise exception 'Parâmetros inválidos' using errcode = '22023';
  end if;

  v_barrado := public.ai_portoes(p_user);
  if v_barrado is not null then
    return v_barrado;
  end if;

  select min(c.value::int) into v_menor
  from public.ai_settings s, jsonb_each_text(s.credit_cost) c
  where s.id = 1 and c.value::int > 0;

  select * into v from public.ai_saldo(p_user);
  v_restante := v.cota + v.concedido - v.usado;
  if v_restante < coalesce(v_menor, 0) then
    return jsonb_build_object('ok', false, 'motivo', 'sem_credito');
  end if;

  return jsonb_build_object('ok', true, 'restante', v_restante);
end;
$$;


ALTER FUNCTION "public"."ai_precheck"("p_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ai_reserve"("p_user" "uuid", "p_tier" "text", "p_mode" "text", "p_model" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  s public.ai_settings;
  v record;
  v_barrado jsonb;
  v_custo int;
  v_id uuid;
begin
  if p_user is null
     or coalesce(p_tier, '') not in ('simples', 'complexo', 'imagem', 'fora_do_escopo')
     or coalesce(p_mode, '') not in ('chat', 'planejar', 'ping') then
    raise exception 'Parâmetros inválidos' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('ai:' || p_user::text));

  v_barrado := public.ai_portoes(p_user);
  if v_barrado is not null then
    return v_barrado;
  end if;

  select * into s from public.ai_settings where id = 1;
  if p_tier = 'fora_do_escopo' or p_mode = 'ping' then
    v_custo := 0;
  else
    v_custo := (s.credit_cost->>p_tier)::int;
    if v_custo is null then
      raise exception 'ai_settings.credit_cost sem valor para o tier %', p_tier using errcode = '22023';
    end if;
  end if;

  select * into v from public.ai_saldo(p_user);
  if v.usado + v_custo > v.cota + v.concedido then
    return jsonb_build_object('ok', false, 'motivo', 'sem_credito');
  end if;

  insert into public.ai_usage (user_id, mode, tier, model, credits)
  values (p_user, p_mode, p_tier, p_model, v_custo)
  returning id into v_id;

  return jsonb_build_object(
    'ok', true,
    'id', v_id,
    'custo', v_custo,
    'restante', v.cota + v.concedido - v.usado - v_custo
  );
end;
$$;


ALTER FUNCTION "public"."ai_reserve"("p_user" "uuid", "p_tier" "text", "p_mode" "text", "p_model" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ai_saldo"("p_user" "uuid") RETURNS TABLE("plano" "text", "cota" integer, "concedido" integer, "usado" integer, "periodo" "text")
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
declare
  v_quotas jsonb;
  v_mes timestamptz := date_trunc('month', now(), 'America/Sao_Paulo');
  v_modulo boolean;
begin
  select s.quotas into v_quotas from public.ai_settings s where s.id = 1;

  select ps.plan into plano
  from public.producer_subscriptions ps
  where ps.producer_id = p_user
    and ps.is_active
    and (ps.expires_at is null or ps.expires_at > now());
  plano := coalesce(plano, 'free');
  cota := coalesce((v_quotas->>plano)::int, 0);

  -- módulo "agent" liberado e não vencido: sobe a cota até a do pro
  v_modulo := exists (
    select 1 from public.user_custom_features f
    where f.user_id = p_user
      and f.feature_key = 'agent'
      and (f.expires_at is null or f.expires_at > now())
  );
  if v_modulo and cota < coalesce((v_quotas->>'pro')::int, 0) then
    cota := (v_quotas->>'pro')::int;
  end if;

  -- todos os planos, Free incluído, renovam no dia 1º e não acumulam (Ricardo, 29/09/2026);
  -- concedido pelo admin vale só no mês da concessão
  periodo := 'mes';

  select coalesce(sum(g.amount), 0) into concedido
  from public.ai_credit_grants g
  where g.user_id = p_user
    and g.created_at >= v_mes;

  -- erro não gasta crédito do produtor (a pergunta que falhou não conta)
  select coalesce(sum(u.credits), 0) into usado
  from public.ai_usage u
  where u.user_id = p_user
    and u.status <> 'erro'
    and u.created_at >= v_mes;

  return next;
end;
$$;


ALTER FUNCTION "public"."ai_saldo"("p_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ai_set_gemini_key"("p_key" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_key text := trim(p_key);
  v_id uuid;
begin
  if not public.gf_admin_can('manage_settings') then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if v_key is null or char_length(v_key) not between 20 and 200 then
    raise exception 'Chave inválida: deve ter entre 20 e 200 caracteres' using errcode = '22023';
  end if;

  select s.id into v_id from vault.secrets s where s.name = 'gemini_api_key';
  if v_id is null then
    perform vault.create_secret(v_key, 'gemini_api_key', 'Chave da API do Google Gemini (Evo)');
  else
    perform vault.update_secret(v_id, v_key);
  end if;

  update public.ai_settings
  set key_updated_at = now(), key_updated_by = auth.uid()
  where id = 1;
end;
$$;


ALTER FUNCTION "public"."ai_set_gemini_key"("p_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assentos_ocupados"("p_event" "uuid") RETURNS TABLE("seat_key" "text", "estado" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select pa.seat_key, case when o.status = 'paid' then 'vendido' else 'reservado' end
    from public.pedido_assentos pa
    join public.orders o on o.id = pa.order_id
   where pa.event_id = p_event and pa.liberada_em is null
     and public.evento_acesso(p_event) in ('aberto', 'link')
     and (o.status = 'paid' or (o.status = 'pending' and pa.expira_em > now()));
$$;


ALTER FUNCTION "public"."assentos_ocupados"("p_event" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_ip_cabecalho"() RETURNS "inet"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
declare
  h jsonb;
  xff text[];
begin
  -- fora do bloco de declaração: valor inválido cai no EXCEPTION e vira nulo
  h := current_setting('request.headers', true)::jsonb;
  xff := string_to_array(h ->> 'x-forwarded-for', ',');
  return coalesce(nullif(btrim(h ->> 'cf-connecting-ip'), ''), nullif(btrim(xff[cardinality(xff)]), ''))::inet;
exception when others then
  return null;
end;
$$;


ALTER FUNCTION "public"."audit_ip_cabecalho"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_limpar"() RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  n bigint;
begin
  perform set_config('evokaa.audit_limpeza', 'on', true);
  delete from public.admin_audit_log a where public.audit_vencido(a.tipo, a.criado_em);
  get diagnostics n = row_count;
  perform set_config('evokaa.audit_limpeza', 'off', true);
  return n;
end;
$$;


ALTER FUNCTION "public"."audit_limpar"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_log_imutavel"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  -- a única exceção: audit_limpar() liga a chave local e a linha já passou do prazo
  if tg_op = 'DELETE' and coalesce(current_setting('evokaa.audit_limpeza', true), '') = 'on'
     and public.audit_vencido(old.tipo, old.criado_em) then
    return old;
  end if;
  raise exception 'A trilha de auditoria não se altera nem se apaga.' using errcode = '42501';
end;
$$;


ALTER FUNCTION "public"."audit_log_imutavel"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_motivo_cabecalho"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
begin
  return nullif(left(btrim(convert_from(decode(nullif(
    current_setting('request.headers', true)::jsonb ->> 'x-evokaa-motivo', ''), 'base64'), 'UTF8')), 500), '');
exception when others then
  return null;
end;
$$;


ALTER FUNCTION "public"."audit_motivo_cabecalho"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_registra"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_id text := coalesce(nullif(tg_argv[0], ''), 'id');
  v_vigiadas text[] := string_to_array(coalesce(tg_argv[1], ''), ',');
  v_ocultar text[] := string_to_array(coalesce(tg_argv[2], ''), ',');
  v_old jsonb;
  v_new jsonb;
  v_antes jsonb;
  v_depois jsonb;
  v_motivo text;
begin
  if tg_op <> 'INSERT' then v_old := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_new := to_jsonb(new); end if;

  if tg_op = 'UPDATE' then
    -- só o que mudou E está na lista de vigiadas
    select coalesce(jsonb_object_agg(n.key, n.value), '{}'::jsonb) into v_depois
      from jsonb_each(v_new) n
      where n.key = any (v_vigiadas) and n.value is distinct from (v_old -> n.key);
    if v_depois = '{}'::jsonb then return null; end if;
    select coalesce(jsonb_object_agg(o.key, o.value), '{}'::jsonb) into v_antes
      from jsonb_each(v_old) o where v_depois ? o.key;
  elsif tg_op = 'INSERT' then
    -- a mesma lista de permitidas: coluna que não está nela (inclusive coluna futura) nunca entra
    select coalesce(jsonb_object_agg(n.key, n.value), '{}'::jsonb) into v_depois from jsonb_each(v_new) n where n.key = any (v_vigiadas);
  else
    select coalesce(jsonb_object_agg(o.key, o.value), '{}'::jsonb) into v_antes from jsonb_each(v_old) o where o.key = any (v_vigiadas);
  end if;

  -- colunas ocultas: o valor nunca entra na trilha, só o fato de existir ou mudar
  v_antes := v_antes || (select coalesce(jsonb_object_agg(k, to_jsonb('«oculto»'::text)), '{}'::jsonb)
                         from unnest(v_ocultar) k where v_antes ? k);
  v_depois := v_depois || (select coalesce(jsonb_object_agg(k, to_jsonb('«oculto»'::text)), '{}'::jsonb)
                           from unnest(v_ocultar) k where v_depois ? k);

  v_motivo := public.audit_motivo_cabecalho();

  insert into public.admin_audit_log (autor, tipo, acao, tabela, objeto_id, antes, depois, motivo, ip)
  values ((select auth.uid()), 'acao', case tg_op when 'INSERT' then 'criar' when 'UPDATE' then 'alterar' else 'excluir' end,
          tg_table_name, coalesce(v_new, v_old) ->> v_id, v_antes, v_depois, v_motivo, null /* IP desligado: public.audit_ip_cabecalho() na S6 */);
  return null;
end;
$$;


ALTER FUNCTION "public"."audit_registra"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_registrar_servico"("p_autor" "uuid", "p_acao" "text", "p_tabela" "text", "p_objeto_id" "text" DEFAULT NULL::"text", "p_depois" "jsonb" DEFAULT NULL::"jsonb", "p_motivo" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  insert into public.admin_audit_log (autor, tipo, acao, tabela, objeto_id, depois, motivo, ip)
  values (p_autor, 'acao', p_acao, p_tabela, p_objeto_id, p_depois, nullif(left(btrim(p_motivo), 500), ''), null /* IP desligado */);
end;
$$;


ALTER FUNCTION "public"."audit_registrar_servico"("p_autor" "uuid", "p_acao" "text", "p_tabela" "text", "p_objeto_id" "text", "p_depois" "jsonb", "p_motivo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_vencido"("p_tipo" "text", "p_em" timestamp with time zone) RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select case p_tipo when 'acao' then p_em < now() - interval '2 years'
                     when 'leitura' then p_em < now() - interval '6 months'
                     else false end;
$$;


ALTER FUNCTION "public"."audit_vencido"("p_tipo" "text", "p_em" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."aviso_politica_destinatarios"("p_version" "text") RETURNS TABLE("user_id" "uuid", "email" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
  select u.id, u.email::text
  from auth.users u
  where u.deleted_at is null
    and u.email_confirmed_at is not null
    and u.email is not null
    and u.email not ilike '%@anonimo.evokaa.com.br'
    -- exclusão de conta que parou no meio: o perfil já foi anonimizado, mas o login ainda existe
    and not exists (
      select 1 from public.profiles p
      where p.id = u.id and p.email ilike '%@anonimo.evokaa.com.br'
    )
    -- contas de teste: aura.com é domínio real de terceiros (contas antigas do tempo "Aura");
    -- domínios de teste não existem e voltariam como devolução (reputação do domínio de envio)
    and split_part(lower(u.email), '@', 2) not in ('aura.com', 'aura.teste')
    and u.email !~* '\.(test|teste|invalid|example|localhost)$'
    and not exists (
      select 1 from public.policy_notices n
      where n.user_id = u.id and n.version = p_version
    )
  order by u.created_at;
$_$;


ALTER FUNCTION "public"."aviso_politica_destinatarios"("p_version" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."aviso_politica_registrar"("p_user" "uuid", "p_version" "text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  insert into public.policy_notices (user_id, version)
  values (p_user, p_version)
  on conflict do nothing;
$$;


ALTER FUNCTION "public"."aviso_politica_registrar"("p_user" "uuid", "p_version" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."caixinha_movimentar"("p_box" "uuid", "p_tipo" "text", "p_valor" numeric, "p_nota" "text" DEFAULT NULL::"text") RETURNS numeric
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_saldo numeric;
  v_valor numeric := round(p_valor, 2);
begin
  if not public.gf_mfa_ok() then
    raise exception 'Confirme o código do 2FA' using errcode = '42501';
  end if;
  if p_tipo is null or p_tipo not in ('deposit', 'withdraw') then
    raise exception 'Tipo de movimento inválido' using errcode = '22023';
  end if;
  -- NaN é maior que tudo no Postgres; "not (... and ...)" recusa NaN, Infinity e nulo
  if v_valor is null or not (v_valor > 0 and v_valor < 1e9) then
    raise exception 'Valor inválido (entre 0,01 e 999.999.999,99)' using errcode = '22023';
  end if;
  if length(p_nota) > 500 then
    raise exception 'Observação com mais de 500 caracteres' using errcode = '22023';
  end if;
  -- trava a linha: outra movimentação da mesma caixinha espera esta terminar
  select coalesce(b.saved, 0) into v_saldo
    from public.event_budget_boxes b
   where b.id = p_box and b.producer_id = (select auth.uid())
     for update;
  if not found then
    raise exception 'Caixinha não encontrada' using errcode = '42501';
  end if;
  v_saldo := v_saldo + case when p_tipo = 'deposit' then v_valor else -v_valor end;
  if v_saldo < 0 then
    raise exception 'Saldo insuficiente' using errcode = '23514';
  end if;
  update public.event_budget_boxes set saved = v_saldo, updated_at = now() where id = p_box;
  insert into public.piggy_transactions (box_id, type, amount, note) values (p_box, p_tipo, v_valor, p_nota);
  return v_saldo;
end;
$$;


ALTER FUNCTION "public"."caixinha_movimentar"("p_box" "uuid", "p_tipo" "text", "p_valor" numeric, "p_nota" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."capas_arquivos_a_apagar"("p_user" "uuid") RETURNS SETOF "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'capas-eventos'
    and left(o.name, 37) = p_user::text || '/';
$$;


ALTER FUNCTION "public"."capas_arquivos_a_apagar"("p_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."capas_can_upload"("p_name" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."capas_can_upload"("p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cardapio_can_upload"("p_name" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."cardapio_can_upload"("p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."certificado_validar"("p_code" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  v record;
begin
  if p_code is null or p_code !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return jsonb_build_object('valido', false);
  end if;

  select ic.issued_at, c.template ->> 'horas' as horas, e.title, e.start_date,
         coalesce(nullif(btrim(pp.company_name), ''), nullif(btrim(pr.full_name), '')) as organizador,
         (select t.buyer_name
            from public.tickets t
           where t.event_id = c.event_id and t.user_id = ic.user_id and t.status in ('active', 'used')
           order by (t.checked_in_at is not null) desc, t.created_at
           limit 1) as nome,
         exists (select 1 from public.tickets t
                  where t.event_id = c.event_id and t.user_id = ic.user_id and t.status in ('active', 'used')) as tem_ingresso
    into v
    from public.issued_certificates ic
    join public.certificates c on c.id = ic.certificate_id
    join public.events e on e.id = c.event_id
    left join public.producer_profiles pp on pp.id = e.producer_id
    left join public.profiles pr on pr.id = e.producer_id
   where ic.code = lower(p_code)
     and e.approval_status = 'approved'; -- ponytail: política 1; tirar esta linha para validar também evento não aprovado

  if not found or not v.tem_ingresso then -- ponytail: política 2; trocar por `if not found then` para validar mesmo com ingresso estornado (nome sairá nulo)
    return jsonb_build_object('valido', false);
  end if;

  return jsonb_build_object(
    'valido', true,
    'nome', nullif(btrim(v.nome), ''),
    'evento', v.title,
    'data_evento', to_char(v.start_date at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'),
    'organizador', v.organizador,
    'emitido_em', to_char(v.issued_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'),
    'horas', case when v.horas ~ '^[0-9]{1,4}$' then v.horas else null end
  );
end $_$;


ALTER FUNCTION "public"."certificado_validar"("p_code" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."certificado_validar"("p_code" "text") IS 'Validação pública de certificado (página /certificado/<código>): devolve só nome, evento, data, organizador, emissão e carga horária; código inexistente ou revogado = {"valido": false}';



CREATE OR REPLACE FUNCTION "public"."chat_arquivos_a_apagar"("p_user" "uuid") RETURNS SETOF "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'chat-anexos'
    and o.owner = p_user
    and not exists (
      select 1 from public.conversation_messages m
      where m.attachment_path = o.name
        and not (m.sender_id = p_user and m.sender_role = 'customer'));
$$;


ALTER FUNCTION "public"."chat_arquivos_a_apagar"("p_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."chat_atendentes"() RETURNS TABLE("id" "uuid", "full_name" "text", "email" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.gf_admin_can('manage_support') then
    raise exception 'acesso negado: precisa da permissão manage_support' using errcode = '42501';
  end if;
  -- mesma regra do chat_update: admin com manage_support ou super_admin
  return query
    select p.id, p.full_name, p.email
    from public.profiles p
    where p.role = 'admin' and p.admin_permissions && array['super_admin', 'manage_support']
    order by p.full_name;
end;
$$;


ALTER FUNCTION "public"."chat_atendentes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."chat_bot_feedback"("p_conv" "uuid", "p_resolveu" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."chat_bot_feedback"("p_conv" "uuid", "p_resolveu" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."chat_bot_ligar"("p_ligado" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."chat_bot_ligar"("p_ligado" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."chat_bot_passar"("p_conv" "uuid", "p_motivo" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_cfg jsonb;
  v_user uuid;
  v_aviso constant text := 'Você já tem conversas abertas com a nossa equipe; continue por uma delas.';
begin
  select c.user_id into v_user from public.conversations c where c.id = p_conv and c.status = 'open' and c.bot_state = 'bot';
  if not found then
    return false;
  end if;
  if p_motivo not in ('erro', 'atendente') then
    perform pg_advisory_xact_lock(hashtext('chat:' || v_user::text));
    if (select count(*) from public.conversations c where c.user_id = v_user and c.status = 'open' and c.bot_state = 'humano') >= 3 then
      -- o aviso não se repete seguido (botão e "Não" de novo, sem nada escrito entre eles)
      if (select m.sender_role is distinct from 'bot' or m.body is distinct from v_aviso
          from public.conversation_messages m where m.conversation_id = p_conv
          order by m.created_at desc, m.id desc limit 1) is not false then
        insert into public.conversation_messages (conversation_id, sender_id, sender_role, sender_name, body, created_at)
        values (p_conv, null, 'bot', 'Assistente Evokaa', v_aviso, clock_timestamp());
      end if;
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
  -- aviso de passagem (Ricardo, 01/10): não dá a entender que alguém responde já; diz o horário e que o
  -- aviso da resposta vai para o e-mail (WhatsApp só quando houver integração).
  -- ponytail: horário escrito no texto; se o admin passar a editar chat_settings.hours, montar daqui.
  insert into public.conversation_messages (conversation_id, sender_id, sender_role, sender_name, body, created_at)
  values (p_conv, null, 'system', 'Evokaa',
          case p_motivo
            when 'pedido' then 'Certo! Sua conversa foi para a nossa equipe.'
            when 'nao_resolveu' then 'Que pena que não resolveu. Sua conversa foi para a nossa equipe.'
            when 'sem_resposta' then 'Não encontrei isso na nossa central de ajuda, então sua conversa foi para a nossa equipe.'
            else 'Sua conversa foi para a nossa equipe.' end
          || case when coalesce((v_cfg ->> 'aberto_agora')::boolean, false)
                  then ' Nosso atendimento é de segunda a sexta, das 9h às 18h (horário de Brasília), e a resposta chega aqui no chat.'
                  else ' Nosso atendimento é de segunda a sexta, das 9h às 18h (horário de Brasília). Agora estamos fora desse horário. '
                       || coalesce(v_cfg ->> 'prazo', 'Respondemos em até 1 dia útil.') || ' A resposta chega aqui no chat.' end
          || ' Se você não estiver por aqui quando a equipe responder, avisamos no e-mail da sua conta.',
          clock_timestamp());
  return true;
end;
$$;


ALTER FUNCTION "public"."chat_bot_passar"("p_conv" "uuid", "p_motivo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."chat_bot_pode_ia"("p_conv" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select false;
$$;


ALTER FUNCTION "public"."chat_bot_pode_ia"("p_conv" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."chat_bot_responder"("p_conv" "uuid", "p_texto" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
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
  -- desligado com a conversa já aberta com ele: a mensagem vai para a equipe (no limite de 3, o aviso dele)
  if not coalesce((select s.bot_enabled from public.chat_settings s where s.id = 1), false) then
    perform public.chat_bot_passar(p_conv, 'desligado');
    return;
  end if;
  v_aud := case when v_c.role in ('user', 'customer') then 'participant'
                when v_c.role in ('producer', 'editor') then 'producer' else 'site' end;
  v_publicos := array['all', 'site', v_aud];

  -- pedido escrito de uma pessoa (estreito: "transferir o ingresso para outra pessoa", "a operadora do
  -- cartão recusou", "comprei com vocês" e "o ingresso tem alguém no nome?" não são pedido; "com vocês"
  -- só com verbo de contato antes)
  v_norm := public.chat_kb_normalizar(p_texto);
  if v_norm ~ '\m(atendente|humano|humana)\M'
     or v_norm ~ '\m(falar|chamar|conversar|quero)\s+(com\s+)?((um|uma|o|a)\s+)?operadora?\M'
     or v_norm ~ '\m(falar|fala|chamar|conversar|contato)\s+com\s+((um|uma|o|a)\s+)?(pessoa|alguem|gente|equipe|suporte|atendimento|voces|vcs|responsavel)\M'
     or v_norm ~ '\mtem\s+alguem\s+(ai|ae|online)\M' or v_norm ~ '\mtem\s+alguem$'
     or v_norm ~ '\mem\s+contato\M'
     or v_norm ~ '\m(transfere|transferir|passa|passar)\s+(para|pra)\s+((um|uma|o|a)\s+)?(alguem|pessoa|humano|atendente)\M'
     or v_norm ~ '\mme\s+(transfere|transferir)$'
     or v_norm ~ '\m(telefone|whatsapp|zap|numero)\s+(de|da|do)\s+(voces|vcs|evokaa|empresa|atendimento|suporte)\M'
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
$_$;


ALTER FUNCTION "public"."chat_bot_responder"("p_conv" "uuid", "p_texto" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."chat_can_upload"("p_name" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_uid uuid := auth.uid();
  v_pasta text;
begin
  if v_uid is null or public.chat_role_path(p_name) is null then
    return false;
  end if;
  v_pasta := split_part(p_name, '/', 1);
  if not exists (select 1 from public.conversations c where c.id = v_pasta::uuid and c.status = 'open') then
    return false;
  end if;
  perform pg_advisory_xact_lock(hashtext('upload:' || v_pasta || ':' || v_uid::text));
  return (select count(*) from storage.objects o
          where o.bucket_id = 'chat-anexos'
            and o.owner = v_uid
            and starts_with(o.name, v_pasta || '/')) < 20;
end;
$$;


ALTER FUNCTION "public"."chat_can_upload"("p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."chat_cliente_contexto"("p_user" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.gf_admin_can('manage_support') then
    raise exception 'acesso negado: precisa da permissão manage_support' using errcode = '42501';
  end if;
  -- só de quem tem conversa que ESTE atendente vê (chat_role = 'agent': conversa com a Evokaa ou mediação), não a que é
  -- só entre cliente e produtor
  if p_user is null or not exists (select 1 from public.conversations c
      where c.user_id = p_user and public.chat_role(c.id) = 'agent') then
    raise exception 'este cliente não tem conversa que o suporte veja' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'papel', (select pr.role from public.profiles pr where pr.id = p_user),
    'plano', (select jsonb_build_object('plan', s.plan, 'is_active', s.is_active, 'expires_at', s.expires_at)
              from public.producer_subscriptions s where s.producer_id = p_user limit 1),
    'ingressos', coalesce((select jsonb_agg(x.j order by x.created_at desc) from (
        select t.created_at, jsonb_build_object('id', t.id, 'status', t.status, 'created_at', t.created_at,
          'ticket_types', jsonb_build_object('name', tt.name, 'events', jsonb_build_object('title', e.title))) as j
        from public.tickets t
        left join public.ticket_types tt on tt.id = t.ticket_type_id
        left join public.events e on e.id = tt.event_id
        where t.user_id = p_user order by t.created_at desc limit 5) x), '[]'::jsonb),
    'pedidos', coalesce((select jsonb_agg(x.j order by x.created_at desc) from (
        select o.created_at, jsonb_build_object('id', o.id, 'total', o.total, 'status', o.status,
          'created_at', o.created_at, 'events', jsonb_build_object('title', e.title)) as j
        from public.orders o
        left join public.events e on e.id = o.event_id
        where o.user_id = p_user order by o.created_at desc limit 5) x), '[]'::jsonb));
end;
$$;


ALTER FUNCTION "public"."chat_cliente_contexto"("p_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."chat_handoff"("p_conv" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."chat_handoff"("p_conv" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."chat_inbox"("p_filtro" "text", "p_busca" "text", "p_limite" integer) RETURNS TABLE("id" "uuid", "user_id" "uuid", "contact_id" "uuid", "kind" "text", "status" "text", "priority" "text", "assignee_id" "uuid", "department_id" "uuid", "department_name" "text", "topic_label" "text", "mediation" boolean, "contact_name" "text", "contact_email" "text", "contact_phone" "text", "last_message_at" timestamp with time zone, "last_message_preview" "text", "last_customer_message_at" timestamp with time zone, "last_reply_at" timestamp with time zone, "agent_last_read_at" timestamp with time zone, "customer_last_read_at" timestamp with time zone, "nao_lida" boolean, "created_at" timestamp with time zone, "resolved_at" timestamp with time zone, "rating" smallint, "bot_state" "text", "handoff_at" timestamp with time zone, "bot_resolveu" boolean)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."chat_inbox"("p_filtro" "text", "p_busca" "text", "p_limite" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."chat_kb_buscar"("p_q" "text", "p_publicos" "text"[], "p_limite" integer, "p_aprox" boolean DEFAULT false) RETURNS TABLE("id" "uuid", "title" "text", "body" "text", "termos" integer, "acertos" integer, "no_titulo" integer, "rank" real)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."chat_kb_buscar"("p_q" "text", "p_publicos" "text"[], "p_limite" integer, "p_aprox" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."chat_kb_mascarar"("p" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."chat_kb_mascarar"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."chat_kb_normalizar"("p" "text") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select coalesce(string_agg(
           coalesce(lower(extensions.unaccent('extensions.unaccent'::regdictionary, t.normal)), w.palavra), ' ' order by w.n), '')
  from regexp_split_to_table(lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p, ''))), '[^a-z0-9]+')
       with ordinality as w(palavra, n)
  left join public.kb_termos t on t.forma = w.palavra
  where w.palavra <> '';
$$;


ALTER FUNCTION "public"."chat_kb_normalizar"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."chat_kb_termos"("p" "text") RETURNS "text"[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
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
$_$;


ALTER FUNCTION "public"."chat_kb_termos"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."chat_mark_read"("p_conv" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_role text := public.chat_role(p_conv);
begin
  if v_role is null then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if v_role = 'customer' then
    update public.conversations c set customer_last_read_at = now() where c.id = p_conv;
  else
    update public.conversations c set agent_last_read_at = now() where c.id = p_conv;
  end if;
  return jsonb_build_object('ok', true);
end;
$$;


ALTER FUNCTION "public"."chat_mark_read"("p_conv" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."chat_messages_after_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."chat_messages_after_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."chat_messages_before_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.bot_state := (select c.bot_state from public.conversations c where c.id = new.conversation_id);
  return new;
end;
$$;


ALTER FUNCTION "public"."chat_messages_before_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."chat_notify_due"() RETURNS TABLE("tipo" "text", "conversation_id" "uuid", "email" "text", "nome" "text", "assunto" "text", "urgente" boolean, "previa" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."chat_notify_due"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."chat_notify_mark"("p_ids" "uuid"[], "p_tipo" "text", "p_ok" boolean) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_n int;
begin
  if coalesce(p_tipo, '') not in ('cliente', 'equipe') or p_ok is null then
    raise exception 'Parâmetros inválidos' using errcode = '22023';
  end if;
  update public.conversations c set
    customer_emailed_at = case when p_ok and p_tipo = 'cliente' then now() else c.customer_emailed_at end,
    team_alerted_at = case when p_ok and p_tipo = 'equipe' then now() else c.team_alerted_at end,
    notify_failures = case
      when p_tipo = 'equipe' then c.notify_failures
      when p_ok then 0
      else c.notify_failures + 1 end
  where c.id = any(p_ids);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;


ALTER FUNCTION "public"."chat_notify_mark"("p_ids" "uuid"[], "p_tipo" "text", "p_ok" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."chat_notify_secret"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select d.decrypted_secret from vault.decrypted_secrets d where d.name = 'chat_notify_secret' limit 1;
$$;


ALTER FUNCTION "public"."chat_notify_secret"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."chat_public_settings"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  with agora as (select (now() at time zone 'America/Sao_Paulo') as t)
  select jsonb_build_object(
    'aberto_agora', coalesce(
      (a.t::time >= (s.hours -> extract(isodow from a.t)::int::text ->> 0)::time
       and a.t::time < (s.hours -> extract(isodow from a.t)::int::text ->> 1)::time), false),
    'prazo', s.response_time
  )
  from public.chat_settings s, agora a
  where s.id = 1;
$$;


ALTER FUNCTION "public"."chat_public_settings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."chat_rate"("p_conv" "uuid", "p_rating" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if public.chat_role(p_conv) is distinct from 'customer' then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if p_rating is null or p_rating not between 1 and 3 then
    raise exception 'Avaliação inválida: de 1 a 3' using errcode = '22023';
  end if;
  update public.conversations c set rating = p_rating, updated_at = now()
  where c.id = p_conv and c.status = 'resolved' and c.rating is null;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'nao_permitido');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;


ALTER FUNCTION "public"."chat_rate"("p_conv" "uuid", "p_rating" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."chat_role"("p_conv" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select case
    when c.user_id = (select auth.uid()) then 'customer'
    when c.producer_id = (select auth.uid()) then 'producer'
    when (c.kind = 'evokaa' or coalesce(t.mediation, false)) and public.gf_admin_can('manage_support') then 'agent'
  end
  from public.conversations c
  left join public.chat_topics t on t.id = c.topic_id
  where c.id = p_conv and public.gf_mfa_ok();
$$;


ALTER FUNCTION "public"."chat_role"("p_conv" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."chat_role_path"("p_name" "text") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
  select case
    when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]{1,200}$'
      then public.chat_role(split_part(p_name, '/', 1)::uuid)
  end;
$_$;


ALTER FUNCTION "public"."chat_role_path"("p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."chat_send"("p_conv" "uuid", "p_body" "text", "p_is_internal" boolean, "p_attachment_path" "text", "p_attachment_name" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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
    -- NOVO (3a): só as humanas contam, e reabrir conversa do assistente só não esbarra no limite com ele ligado
    -- (desligado, a mensagem vai para a equipe: conta como humana)
    if (select c.status = 'resolved'
               and (c.bot_state = 'humano' or not coalesce((select s.bot_enabled from public.chat_settings s where s.id = 1), false))
        from public.conversations c where c.id = p_conv)
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
    -- NOVO (3a): resposta pública de atendente tira a conversa do assistente (e o selo do Sim)
    update public.conversations c
    set bot_state = 'humano', handoff_at = coalesce(c.handoff_at, now()), handoff_reason = coalesce(c.handoff_reason, 'atendente'),
        bot_resolveu = false
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


ALTER FUNCTION "public"."chat_send"("p_conv" "uuid", "p_body" "text", "p_is_internal" boolean, "p_attachment_path" "text", "p_attachment_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."chat_start"("p_topic_id" "uuid", "p_event_id" "uuid", "p_name" "text", "p_phone" "text", "p_marketing_opt_in" boolean, "p_body" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
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
$_$;


ALTER FUNCTION "public"."chat_start"("p_topic_id" "uuid", "p_event_id" "uuid", "p_name" "text", "p_phone" "text", "p_marketing_opt_in" boolean, "p_body" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."chat_update"("p_conv" "uuid", "p_patch" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
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
    -- NOVO (3a): a equipe mudar o status (reabrir ou resolver) ou assumir tira o selo "Resolvida pelo assistente"
    bot_resolveu = case when p_patch ? 'status' or v_assignee is not null then false else c.bot_resolveu end,
    updated_at = now()
  where c.id = p_conv;

  return jsonb_build_object('ok', true);
end;
$_$;


ALTER FUNCTION "public"."chat_update"("p_conv" "uuid", "p_patch" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."colaborador_dados"("p_user" "uuid") RETURNS TABLE("nome_completo" "text", "cpf" "text", "rg" "text", "data_nascimento" "date", "cep" "text", "rua" "text", "numero" "text", "complemento" "text", "bairro" "text", "cidade" "text", "uf" "text", "email_secundario" "text", "telefone" "text", "whatsapp" "text", "emergencia_nome" "text", "emergencia_parentesco" "text", "emergencia_telefone" "text", "banco" "text", "agencia" "text", "conta" "text", "pix_tipo" "text", "pix_chave" "text", "email" "text", "cargo" "text", "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.gf_admin_can('super_admin') then
    raise exception 'Só quem tem Acesso total vê os dados do cadastro.' using errcode='42501';
  end if;
  insert into public.staff_profiles_acessos (leitor, colaborador)
    select (select auth.uid()), s.user_id from public.staff_profiles s where s.user_id = p_user;
  return query
    select s.nome_completo, public.pr7_mascara_cpf(public.pr7_dec(s.cpf_enc)),
           public.pr7_mascara4(public.pr7_dec(s.rg_enc)), s.data_nascimento, s.cep, s.rua, s.numero,
           s.complemento, s.bairro, s.cidade, s.uf, s.email_secundario, s.telefone, s.whatsapp,
           s.emergencia_nome, s.emergencia_parentesco, s.emergencia_telefone,
           public.pr7_dec(s.banco_enc), public.pr7_mascara4(public.pr7_dec(s.agencia_enc)),
           public.pr7_mascara4(public.pr7_dec(s.conta_enc)), public.pr7_dec(s.pix_tipo_enc),
           public.pr7_mascara4(public.pr7_dec(s.pix_chave_enc)), s.email, s.cargo, s.updated_at
    from public.staff_profiles s where s.user_id = p_user;
end $$;


ALTER FUNCTION "public"."colaborador_dados"("p_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."colaboradores_resumo"() RETURNS TABLE("user_id" "uuid", "nome" "text", "cargo" "text", "email" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.gf_is_admin() then
    raise exception 'Só colaboradores da Evokaa veem a equipe.' using errcode = '42501';
  end if;
  -- só quem segue na equipe (quem foi removido continua com o cadastro, mas não aparece)
  return query select s.user_id, s.nome_completo, s.cargo, s.email
    from public.staff_profiles s join public.profiles p on p.id = s.user_id and p.role = 'admin';
end;
$$;


ALTER FUNCTION "public"."colaboradores_resumo"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirmar_pedido_gratis"("p_order" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  o public.orders%rowtype;
  v_nome text;
  v_email text;
  n int := 0;
  esperado int;
  it record;
  v_motivo text;
begin
  select * into o from public.orders where id = p_order and user_id = auth.uid() and status = 'pending' for update;
  if not found then
    raise exception 'Pedido não encontrado ou já processado' using errcode = '22023';
  end if;
  if o.created_at <= now() - interval '30 minutes' then
    raise exception 'Pedido expirado, volte ao evento e escolha de novo' using errcode = '22023';
  end if;
  -- meia (20261030): reserva do servidor vencida não vira ingresso (o estoque já foi liberado)
  if o.reservado_ate is not null and o.reservado_ate <= now() then
    raise exception 'Reserva expirada, volte ao evento e escolha de novo' using errcode = '22023';
  end if;
  -- trava os itens e depois os tipos (por id, sem impasse) ANTES de conferir qualquer coisa
  perform 1 from public.order_items where order_id = o.id for update;
  perform 1 from public.ticket_types where id in (select ticket_type_id from public.order_items where order_id = o.id) order by id for update;
  select coalesce(sum(quantity), 0) into esperado from public.order_items where order_id = o.id;
  if esperado = 0 then
    raise exception 'Pedido sem itens' using errcode = '22023';
  end if;
  -- meia (20261030): pedido com cupom (coupon_id só nasce em reservar_ingressos; o navegador não consegue gravar) pode ter
  -- item de preço > 0 e total 0 (cupom de 100%); sem cupom, continua exigindo item e tipo de preço 0
  if o.total <> 0 or (o.coupon_id is null and exists (
       select 1 from public.order_items oi join public.ticket_types tt on tt.id = oi.ticket_type_id
        where oi.order_id = o.id and (oi.unit_price <> 0 or tt.price <> 0)))
     or (o.coupon_id is not null and (
         exists (select 1 from public.order_items oi where oi.order_id = o.id and oi.taxa_unit is null) -- item de INSERT direto
         or (select coalesce(sum(oi.unit_price * oi.quantity), 0) from public.order_items oi where oi.order_id = o.id) <> o.subtotal
         or o.subtotal - o.discount + o.service_fee <> 0)) then
    raise exception 'Pedido não é gratuito' using errcode = '22023';
  end if;
  if exists (select 1 from public.order_items oi where oi.order_id = o.id and not public.pode_comprar(o.id, oi.ticket_type_id)) then
    raise exception 'Evento indisponível para compra' using errcode = '22023';
  end if;
  for it in select distinct oi.ticket_type_id from public.order_items oi where oi.order_id = o.id loop
    v_motivo := public.venda_bloqueada(it.ticket_type_id);
    if v_motivo is not null then raise exception '%', v_motivo using errcode = '22023'; end if;
  end loop;

  -- limite por conta: ingressos já comprados (pedidos 'paid') + os deste pedido, por tipo (tipos já travados acima)
  for it in select tt.name, coalesce(tt.max_per_order, 10) as teto, a.q + coalesce((
                select sum(oi2.quantity) from public.order_items oi2 join public.orders o2 on o2.id = oi2.order_id
                 where o2.user_id = o.user_id and o2.status = 'paid' and oi2.ticket_type_id = a.ticket_type_id), 0) as total
              from (select oi.ticket_type_id, sum(oi.quantity) as q from public.order_items oi where oi.order_id = o.id group by 1) a
              join public.ticket_types tt on tt.id = a.ticket_type_id loop
    if it.total > it.teto then
      raise exception 'Limite de % ingressos por pessoa em "%": você já tem % (com este pedido)', it.teto, it.name, it.total using errcode = '22023';
    end if;
  end loop;

  -- limite por CPF (20261028): pedidos 'paid' do mesmo CPF (qualquer conta) + este pedido; mensagem sem contagem
  for it in select tt.max_por_cpf as teto, a.q + coalesce((
                select sum(oi2.quantity) from public.order_items oi2 join public.orders o2 on o2.id = oi2.order_id
                 where o2.customer_cpf_hmac = o.customer_cpf_hmac and o2.status = 'paid' and oi2.ticket_type_id = a.ticket_type_id), 0) as total
              from (select oi.ticket_type_id, sum(oi.quantity) as q from public.order_items oi where oi.order_id = o.id group by 1) a
              join public.ticket_types tt on tt.id = a.ticket_type_id
             where tt.max_por_cpf is not null loop
    if o.customer_cpf_hmac is null then
      raise exception 'Informe o CPF do comprador para este ingresso' using errcode = '22023';
    end if;
    if it.total > it.teto then
      raise exception 'Limite de % ingressos por CPF neste ingresso', it.teto using errcode = '22023';
    end if;
  end loop;

  select coalesce(nullif(o.customer_name, ''), nullif(p.full_name, ''), nullif(u.raw_user_meta_data->>'full_name', ''), ''),
         coalesce(nullif(o.customer_email, ''), nullif(p.email, ''), nullif(u.email, ''), '')
    into v_nome, v_email
    from (select 1) d
    left join public.profiles p on p.id = o.user_id
    left join auth.users u on u.id = o.user_id;
  for it in select oi.id, oi.ticket_type_id, oi.quantity from public.order_items oi
              join public.ticket_types tt on tt.id = oi.ticket_type_id
             where oi.order_id = o.id and (o.coupon_id is not null or (oi.unit_price = 0 and tt.price = 0)) loop
    update public.ticket_types tt set sold = coalesce(tt.sold, 0) + it.quantity, quantity_sold = coalesce(tt.quantity_sold, 0) + it.quantity
     where tt.id = it.ticket_type_id
       and (case when coalesce(tt.quantity_total, 0) > 0 then tt.quantity_total
                 when coalesce(tt.capacity, 0) > 0 then tt.capacity else null end is null
            or coalesce(tt.sold, 0) + it.quantity <= case when coalesce(tt.quantity_total, 0) > 0 then tt.quantity_total else tt.capacity end);
    if not found then
      raise exception 'Ingressos esgotados' using errcode = '22023';
    end if;
    insert into public.tickets (order_item_id, order_id, ticket_type_id, event_id, user_id, buyer_name, buyer_email, status)
    select it.id, o.id, it.ticket_type_id, o.event_id, o.user_id, v_nome, v_email, 'active'
      from generate_series(1, it.quantity);
    n := n + it.quantity;
  end loop;
  if n <> esperado then
    raise exception 'Emissão incompleta (% de %)', n, esperado using errcode = '22023';
  end if;
  update public.orders set status = 'paid' where id = o.id;
  return n;
end;
$$;


ALTER FUNCTION "public"."confirmar_pedido_gratis"("p_order" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirmar_pedido_pago"("p_order_id" "uuid", "p_gateway_payment_id" "text", "p_valor_pago_centavos" integer, "p_event_id" "text" DEFAULT NULL::"text", "p_pago_em" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  o public.orders%rowtype;
  v_ret text;   -- o que o chamador recebe
  v_res text;   -- o que fica em webhook_events.resultado
  v_cons text;  -- nome da constraint violada
  v_base numeric; -- soma dos itens de benefício inteira (base do rateio do desconto)
  v_pp numeric;   -- price_paid do ingresso
  v_nome text;
  v_email text;
  n int := 0;
  esperado int;
  it record;
begin
  select * into o from public.orders where id = p_order_id for update;
  if exists (select 1 from public.orders where id <> p_order_id and gateway_payment_id = p_gateway_payment_id) then
    -- este pagamento já é de OUTRO pedido: estornar tiraria o dinheiro dele. Vem antes de qualquer 'estorno'.
    v_ret := 'conflito'; v_res := 'conflito_gateway_payment_id';
  elsif not found then
    v_ret := 'nao_encontrado'; v_res := 'nao_encontrado';
  elsif o.status = 'paid' then
    if o.gateway_payment_id is not distinct from p_gateway_payment_id then
      v_ret := 'ja_pago'; v_res := 'ja_pago';
    else
      v_ret := 'estorno'; v_res := 'pagamento_duplicado'; -- pedido já pago por outro pagamento: este segundo tem de ser devolvido
    end if;
  elsif o.status <> 'pending' then
    -- cancelado pelo cron (ou failed/refunded): não revive, o chamador estorna
    v_ret := 'estorno'; v_res := 'pagamento_tardio';
  elsif o.created_at <= least(greatest(coalesce(p_pago_em, now()), o.created_at), now()) - interval '30 minutes' or (o.reservado_ate is not null and o.reservado_ate <= least(greatest(coalesce(p_pago_em, now()), o.created_at), now())) then
    v_ret := 'estorno'; v_res := 'pagamento_tardio'; -- pendente vencido que o cron ainda não cancelou
  elsif p_valor_pago_centavos::bigint is distinct from round(o.total * 100)::bigint then
    v_ret := 'valor_divergente'; v_res := 'valor_divergente: pago ' || coalesce(p_valor_pago_centavos::text, 'null') || ', esperado ' || round(o.total * 100)::bigint;
  else
    begin
      -- trava itens e tipos (por id), como confirmar_pedido_gratis
      perform 1 from public.order_items where order_id = o.id for update;
      perform 1 from public.ticket_types where id in (select ticket_type_id from public.order_items where order_id = o.id) order by id for update;
      select coalesce(sum(quantity), 0) into esperado from public.order_items where order_id = o.id;
      if esperado = 0 then
        raise exception 'Pedido sem itens' using errcode = '22023';
      end if;
      -- evento cancelado/bloqueado ou tipo desativado entre a reserva e o pagamento: não emite (como pode_comprar, sem auth.uid nem visibilidade)
      if not exists (select 1 from public.events e where e.id = o.event_id and e.status = 'published' and e.approval_status = 'approved')
         or exists (select 1 from public.order_items oi join public.ticket_types tt on tt.id = oi.ticket_type_id where oi.order_id = o.id and (not tt.is_active or tt.event_id <> o.event_id)) then
        raise exception 'Evento indisponível para compra' using errcode = '22023';
      end if;
      -- limite por conta: de confirmar_pedido_gratis (20261030a), tipos já travados acima
      for it in select tt.name, coalesce(tt.max_per_order, 10) as teto, a.q + coalesce((
                    select sum(oi2.quantity) from public.order_items oi2 join public.orders o2 on o2.id = oi2.order_id
                     where o2.user_id = o.user_id and o2.status = 'paid' and oi2.ticket_type_id = a.ticket_type_id), 0) as total
                  from (select oi.ticket_type_id, sum(oi.quantity) as q from public.order_items oi where oi.order_id = o.id group by 1) a
                  join public.ticket_types tt on tt.id = a.ticket_type_id
                 -- mesma regra da reserva (reservar_ingressos): tipo PAGO sem max_per_order e tipo de lugar marcado não têm teto por conta
                 where not (tt.price > 0 and tt.max_per_order is null) and not public.tipo_no_mapa(tt.id) loop
        if it.total > it.teto then
          raise exception 'Limite de % ingressos por pessoa em "%"', it.teto, it.name using errcode = '22023';
        end if;
      end loop;
      select coalesce(sum(unit_price * quantity), 0) into v_base from public.order_items where order_id = o.id and beneficio = 'inteira';
      select coalesce(nullif(o.customer_name, ''), nullif(p.full_name, ''), nullif(u.raw_user_meta_data->>'full_name', ''), ''),
             coalesce(nullif(o.customer_email, ''), nullif(p.email, ''), nullif(u.email, ''), '')
        into v_nome, v_email
        from (select 1) d
        left join public.profiles p on p.id = o.user_id
        left join auth.users u on u.id = o.user_id;
      -- emissão: mesma de confirmar_pedido_gratis (20261030a), para TODOS os itens (aqui o item é pago)
      for it in select oi.id, oi.ticket_type_id, oi.quantity, oi.unit_price, oi.beneficio from public.order_items oi where oi.order_id = o.id loop
        update public.ticket_types tt set sold = coalesce(tt.sold, 0) + it.quantity, quantity_sold = coalesce(tt.quantity_sold, 0) + it.quantity
         where tt.id = it.ticket_type_id
           and (case when coalesce(tt.quantity_total, 0) > 0 then tt.quantity_total
                     when coalesce(tt.capacity, 0) > 0 then tt.capacity else null end is null
                or coalesce(tt.sold, 0) + it.quantity <= case when coalesce(tt.quantity_total, 0) > 0 then tt.quantity_total else tt.capacity end);
        if not found then
          raise exception 'Ingressos esgotados' using errcode = '22023';
        end if;
        v_pp := case when it.beneficio = 'inteira' and v_base > 0 then it.unit_price - round(o.discount * it.unit_price / v_base, 2) else it.unit_price end;
        insert into public.tickets (order_item_id, order_id, ticket_type_id, event_id, user_id, buyer_name, buyer_email, status, price_paid)
        select it.id, o.id, it.ticket_type_id, o.event_id, o.user_id, v_nome, v_email, 'active', v_pp
          from generate_series(1, it.quantity);
        n := n + it.quantity;
      end loop;
      if n <> esperado then
        raise exception 'Emissão incompleta (% de %)', n, esperado using errcode = '22023';
      end if;
      -- gatilhos orders_pago_assento_guard e orders_pago_cpf_guard disparam aqui (22023)
      update public.orders set status = 'paid', gateway_payment_id = p_gateway_payment_id, payment_gateway = 'pagbank' where id = o.id;
      insert into public.payments (order_id, gateway, gateway_payment_id, amount, status)
        values (o.id, 'pagbank', p_gateway_payment_id, o.total, 'completed');
      v_ret := 'pago'; v_res := 'pago';
    exception
      when sqlstate '22023' then
        v_ret := 'estorno'; v_res := 'estorno_recusado: ' || sqlerrm; -- subtransação desfeita: sem ticket, sold intacto, pedido segue pending
      when unique_violation then
        get stacked diagnostics v_cons = constraint_name;
        if v_cons is distinct from 'orders_gateway_payment_id_uk' then raise; end if;
        v_ret := 'conflito'; v_res := 'conflito_gateway_payment_id'; -- outro pedido já tem este gateway_payment_id
    end;
  end if;

  insert into public.webhook_events (gateway, event_id, order_id, resultado)
    values ('pagbank', coalesce(p_event_id, p_gateway_payment_id), o.id, v_res)
  on conflict (gateway, event_id) do nothing; -- o primeiro desfecho do evento fica
  return v_ret;
end;
$$;


ALTER FUNCTION "public"."confirmar_pedido_pago"("p_order_id" "uuid", "p_gateway_payment_id" "text", "p_valor_pago_centavos" integer, "p_event_id" "text", "p_pago_em" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."convite_aceitar"("p_token" "text", "p_dados" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  v public.admin_invites%rowtype;
  v_uid uuid := (select auth.uid());
  v_email text := lower(coalesce(auth.email(), auth.jwt() ->> 'email'));
  d jsonb := coalesce(p_dados, '{}'::jsonb);
  v_nasc date;
  v_pix_tipo text := d ->> 'pix_tipo';
  v_cpf text;
  v_rg text;
  v_banco text;
  v_agencia text;
  v_conta text;
  v_pix_chave text;
  v_claims text;
  v_cons text;
  v_n int;
begin
  -- 1. hash do token (trava o convite até o fim da transação: dois aceites do mesmo token não passam)
  select * into v from public.admin_invites i where i.token_hash = public.convite_hash(p_token) for update;
  if not found then
    raise exception 'Convite inválido ou expirado.' using errcode = 'P0001';
  end if;
  -- 2. pendente e no prazo (mesma mensagem: não diz se foi usado, cancelado ou venceu)
  if v.status <> 'pendente' or v.expires_at <= now() then
    raise exception 'Convite inválido ou expirado.' using errcode = 'P0001';
  end if;
  -- 3. a conta é a do e-mail convidado
  if v_uid is null or v_email is distinct from v.email then
    raise exception 'Entre com a conta do e-mail que recebeu o convite.' using errcode = '42501';
  end if;
  -- 4. 2FA: fator confirmado e o código digitado nesta sessão (a mesma exigência de gf_is_admin)
  if not (public.gf_mfa_ok() and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
          and exists (select 1 from auth.mfa_factors f where f.user_id = v_uid and f.status = 'verified')) then
    raise exception 'Ative a verificação em duas etapas e entre com o código antes de concluir o cadastro.' using errcode = '42501';
  end if;
  -- quem já é admin não passa por aqui (as permissões do convite substituiriam as dele, inclusive super_admin)
  if exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'admin') then
    raise exception 'Esta conta já faz parte dos colaboradores da Evokaa.' using errcode = 'P0001';
  end if;
  -- conta de produtor viraria admin e perderia o painel do produtor: o convite é para um e-mail só do trabalho
  if exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'producer') then
    raise exception 'Este e-mail já tem uma conta de produtor. Convide outro e-mail, só para o trabalho na Evokaa.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.team_members t where t.user_id = v_uid) then
    raise exception 'Este e-mail faz parte da equipe de um produtor. Convide outro e-mail, só para o trabalho na Evokaa.' using errcode = 'P0001';
  end if;

  -- 5. campos
  begin
    v_nasc := (d ->> 'data_nascimento')::date;
  exception when others then
    raise exception 'Data de nascimento inválida.' using errcode = '22023';
  end;
  -- valores normalizados (os mesmos que o insert gravava em texto)
  v_cpf := regexp_replace(nullif(btrim(d ->> 'cpf'), ''), '\D', '', 'g');
  v_rg := nullif(btrim(d ->> 'rg'), '');
  v_banco := nullif(btrim(d ->> 'banco'), '');
  v_agencia := nullif(btrim(d ->> 'agencia'), '');
  v_conta := nullif(btrim(d ->> 'conta'), '');
  v_pix_chave := case v_pix_tipo
    when 'cpf' then regexp_replace(nullif(btrim(d ->> 'pix_chave'), ''), '\D', '', 'g')
    when 'email' then lower(nullif(btrim(d ->> 'pix_chave'), ''))
    when 'aleatoria' then lower(nullif(btrim(d ->> 'pix_chave'), ''))
    else nullif(btrim(d ->> 'pix_chave'), '') end;
  -- as regras dos CHECKs staff_* que caíram com as colunas de texto (mesmas mensagens)
  if v_cpf is null or v_rg is null or v_pix_tipo is null or v_pix_chave is null then
    raise exception 'Preencha todos os campos obrigatórios.' using errcode = '22023';
  end if;
  if not public.gf_cpf_valido(v_cpf) then
    raise exception 'CPF inválido.' using errcode = '22023';
  end if;
  if char_length(btrim(v_rg)) not between 3 and 20 then
    raise exception 'Informe o RG.' using errcode = '22023';
  end if;
  if char_length(v_banco) > 80 or char_length(v_agencia) > 20 or char_length(v_conta) > 30 then
    raise exception 'Dados bancários longos demais.' using errcode = '22023';
  end if;
  if not (case v_pix_tipo
      when 'cpf' then public.gf_cpf_valido(v_pix_chave)
      when 'email' then v_pix_chave = lower(btrim(v_pix_chave)) and char_length(v_pix_chave) <= 77 and v_pix_chave ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
      when 'telefone' then v_pix_chave ~ '^\+55[0-9]{10,11}$'
      when 'aleatoria' then v_pix_chave ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      else false end) then
    raise exception 'A chave Pix não confere com o tipo escolhido.' using errcode = '22023';
  end if;
  begin
    insert into public.staff_profiles as s (user_id, invite_id, email, cargo, nome_completo, cpf_enc, rg_enc, data_nascimento, cep, rua,
      numero, complemento, bairro, cidade, uf, email_secundario, telefone, whatsapp, emergencia_nome, emergencia_parentesco,
      emergencia_telefone, banco_enc, agencia_enc, conta_enc, pix_tipo_enc, pix_chave_enc)
    values (v_uid, v.id, v.email, v.cargo,
      -- apóstrofo curvo do iPhone vira reto; forma decomposta vira NFC (a regra staff_nome_ok olha a forma composta)
      normalize(nullif(replace(btrim(d ->> 'nome_completo'), '’', ''''), ''), NFC),
      public.pr7_enc(v_cpf),
      public.pr7_enc(v_rg),
      v_nasc,
      regexp_replace(nullif(btrim(d ->> 'cep'), ''), '\D', '', 'g'),
      nullif(btrim(d ->> 'rua'), ''),
      nullif(btrim(d ->> 'numero'), ''),
      nullif(btrim(d ->> 'complemento'), ''),
      nullif(btrim(d ->> 'bairro'), ''),
      nullif(btrim(d ->> 'cidade'), ''),
      upper(nullif(btrim(d ->> 'uf'), '')),
      lower(nullif(btrim(d ->> 'email_secundario'), '')),
      nullif(btrim(d ->> 'telefone'), ''),
      nullif(btrim(d ->> 'whatsapp'), ''),
      nullif(btrim(d ->> 'emergencia_nome'), ''),
      nullif(btrim(d ->> 'emergencia_parentesco'), ''),
      nullif(btrim(d ->> 'emergencia_telefone'), ''),
      public.pr7_enc(v_banco),
      public.pr7_enc(v_agencia),
      public.pr7_enc(v_conta),
      public.pr7_enc(v_pix_tipo),
      public.pr7_enc(v_pix_chave))
    -- conta que já foi colaboradora (e saiu) e foi convidada de novo: o cadastro é refeito
    on conflict (user_id) do update set invite_id = excluded.invite_id, email = excluded.email, cargo = excluded.cargo,
      nome_completo = excluded.nome_completo, data_nascimento = excluded.data_nascimento,
      cep = excluded.cep, rua = excluded.rua, numero = excluded.numero, complemento = excluded.complemento,
      bairro = excluded.bairro, cidade = excluded.cidade, uf = excluded.uf, email_secundario = excluded.email_secundario,
      telefone = excluded.telefone, whatsapp = excluded.whatsapp, emergencia_nome = excluded.emergencia_nome,
      emergencia_parentesco = excluded.emergencia_parentesco, emergencia_telefone = excluded.emergencia_telefone,
      cpf_enc = public.pr7_enc_se_mudou(v_cpf, s.cpf_enc), rg_enc = public.pr7_enc_se_mudou(v_rg, s.rg_enc),
      banco_enc = public.pr7_enc_se_mudou(v_banco, s.banco_enc), agencia_enc = public.pr7_enc_se_mudou(v_agencia, s.agencia_enc),
      conta_enc = public.pr7_enc_se_mudou(v_conta, s.conta_enc), pix_tipo_enc = public.pr7_enc_se_mudou(v_pix_tipo, s.pix_tipo_enc),
      pix_chave_enc = public.pr7_enc_se_mudou(v_pix_chave, s.pix_chave_enc), updated_at = now();
  exception
    when not_null_violation then
      raise exception 'Preencha todos os campos obrigatórios.' using errcode = '22023';
    when check_violation then
      get stacked diagnostics v_cons = constraint_name;
      raise exception '%', case v_cons
        when 'staff_nome_ok' then 'Informe o nome completo, só com letras, espaço, apóstrofo, ponto ou hífen (sem endereço de site).'
        when 'staff_nascimento_ok' then 'Data de nascimento inválida: é preciso ter 18 anos ou mais.'
        when 'staff_cep_ok' then 'CEP: 8 dígitos.'
        when 'staff_endereco_ok' then 'Endereço incompleto (rua, número, bairro e cidade).'
        when 'staff_uf_ok' then 'Escolha o estado (UF).'
        when 'staff_email_secundario_ok' then 'E-mail secundário inválido ou igual ao e-mail principal.'
        when 'staff_telefones_ok' then 'Telefone ou WhatsApp inválido.'
        when 'staff_emergencia_ok' then 'Contato de emergência incompleto (nome, parentesco e telefone).'
        else 'Dados do cadastro inválidos.' end using errcode = '22023';
  end;

  -- papel e permissões vêm do convite gravado, nunca de quem chama. Sem as claims, o gatilho
  -- gf_protect_profile_privileges trata o UPDATE como do dono do banco (ver o cabeçalho de 20261002); elas voltam em seguida.
  v_claims := current_setting('request.jwt.claims', true);
  perform set_config('request.jwt.claims', '', true);
  update public.profiles set role = 'admin', admin_permissions = v.permissions where id = v_uid;
  get diagnostics v_n = row_count;
  perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  if v_n <> 1 then
    raise exception 'Perfil da conta não encontrado.' using errcode = 'P0001';
  end if;

  update public.admin_invites set status = 'usado', used_by = v_uid, used_at = now() where id = v.id;
end;
$_$;


ALTER FUNCTION "public"."convite_aceitar"("p_token" "text", "p_dados" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."convite_cancelar"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.gf_admin_can('super_admin') then
    raise exception 'Só quem tem Acesso total cancela convites.' using errcode = '42501';
  end if;
  update public.admin_invites set status = 'cancelado' where id = p_id and status = 'pendente';
  if not found then
    raise exception 'Convite não encontrado, já usado ou cancelado.' using errcode = 'P0001';
  end if;
end;
$$;


ALTER FUNCTION "public"."convite_cancelar"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."convite_conferir"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select coalesce(
    (select jsonb_build_object('valido', true,
              'email', left(split_part(i.email, '@', 1), 1) || '***@' || split_part(i.email, '@', 2))
     from public.admin_invites i
     where i.token_hash = public.convite_hash(p_token) and i.status = 'pendente' and i.expires_at > now()),
    jsonb_build_object('valido', false));
$$;


ALTER FUNCTION "public"."convite_conferir"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."convite_criar"("p_email" "text", "p_cargo" "text", "p_permissions" "text"[], "p_token_hash" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_perms text[] := array(select distinct x from unnest(coalesce(p_permissions, '{}')) x order by x);
  v_id uuid;
begin
  if not public.gf_admin_can('super_admin') then
    raise exception 'Só quem tem Acesso total convida colaboradores.' using errcode = '42501';
  end if;
  if not public.convite_permissoes_ok(v_perms) then
    raise exception 'Função inválida no convite.' using errcode = '22023';
  end if;
  if exists (select 1 from public.profiles p where lower(p.email) = v_email and p.role = 'admin') then
    raise exception 'Essa pessoa já faz parte dos colaboradores da Evokaa.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.profiles p where lower(p.email) = v_email and p.role = 'producer') then
    raise exception 'Este e-mail já tem uma conta de produtor. Convide outro e-mail, só para o trabalho na Evokaa.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.team_members t join public.profiles p on p.id = t.user_id where lower(p.email) = v_email and t.accepted_at is not null) then
    raise exception 'Este e-mail faz parte da equipe de um produtor. Convide outro e-mail, só para o trabalho na Evokaa.' using errcode = 'P0001';
  end if;
  -- convite pendente vencido não segura o e-mail
  update public.admin_invites set status = 'cancelado' where email = v_email and status = 'pendente' and expires_at <= now();
  begin
    insert into public.admin_invites (email, cargo, permissions, token_hash, created_by)
    values (v_email, btrim(coalesce(p_cargo, '')), v_perms, p_token_hash, (select auth.uid()))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Já existe um convite pendente para este e-mail. Use Reenviar na lista de convites.' using errcode = 'P0001';
  when check_violation then
    raise exception 'Dados do convite inválidos (e-mail ou cargo).' using errcode = '22023';
  end;
  return v_id;
end;
$$;


ALTER FUNCTION "public"."convite_criar"("p_email" "text", "p_cargo" "text", "p_permissions" "text"[], "p_token_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."convite_hash"("p" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  select encode(sha256(convert_to(coalesce(p, ''), 'UTF8')), 'hex');
$$;


ALTER FUNCTION "public"."convite_hash"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."convite_permissoes_ok"("p" "text"[]) RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  select p is not null
     and array_position(p, null) is null
     and p <@ array['manage_users', 'manage_affiliates', 'manage_events', 'manage_finance', 'view_analytics',
                    'manage_tickets', 'manage_settings', 'manage_feedback', 'manage_support', 'manage_newsletter',
                    'manage_coupons', 'moderate_mesa', 'manage_team', 'view_audit']::text[];
$$;


ALTER FUNCTION "public"."convite_permissoes_ok"("p" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."convite_reenviar"("p_id" "uuid", "p_token_hash" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_email text;
begin
  if not public.gf_admin_can('super_admin') then
    raise exception 'Só quem tem Acesso total reenvia convites.' using errcode = '42501';
  end if;
  begin
    update public.admin_invites set token_hash = p_token_hash, expires_at = now() + interval '7 days'
    where id = p_id and status = 'pendente'
    returning email into v_email;
  exception when check_violation or unique_violation then
    raise exception 'Token inválido.' using errcode = '22023';
  end;
  if v_email is null then
    raise exception 'Convite não encontrado, já usado ou cancelado.' using errcode = 'P0001';
  end if;
  return v_email;
end;
$$;


ALTER FUNCTION "public"."convite_reenviar"("p_id" "uuid", "p_token_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."convites_listar"() RETURNS TABLE("id" "uuid", "email" "text", "cargo" "text", "permissions" "text"[], "status" "text", "created_at" timestamp with time zone, "expires_at" timestamp with time zone, "used_at" timestamp with time zone, "used_by" "uuid", "nome" "text", "aviso_em" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.gf_admin_can('super_admin') then
    raise exception 'Só quem tem Acesso total vê os convites.' using errcode = '42501';
  end if;
  return query
    select i.id, i.email, i.cargo, i.permissions,
           case when i.status = 'pendente' and i.expires_at <= now() then 'expirado' else i.status end,
           i.created_at, i.expires_at, i.used_at, i.used_by, s.nome_completo, i.aviso_em
    from public.admin_invites i
    left join public.staff_profiles s on s.user_id = i.used_by
    where i.status = 'pendente' or (i.status = 'usado' and i.used_at > now() - interval '30 days')
    order by coalesce(i.used_at, i.created_at) desc;
end;
$$;


ALTER FUNCTION "public"."convites_listar"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pipeline_stages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producer_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" DEFAULT '#3b82f6'::"text" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pipeline_stages" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."crm_criar_etapas_padrao"() RETURNS SETOF "public"."pipeline_stages"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Faça login' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('crm_etapas:' || v_uid::text, 0));
  if not exists (select 1 from public.pipeline_stages where producer_id = v_uid) then
    insert into public.pipeline_stages (producer_id, name, color, position) values
      (v_uid, 'Novo', '#3b82f6', 0),
      (v_uid, 'Contato feito', '#8b5cf6', 1),
      (v_uid, 'Interessado', '#f59e0b', 2),
      (v_uid, 'Negociando', '#f97316', 3),
      (v_uid, 'Fechado', '#22c55e', 4);
  end if;
  return query select * from public.pipeline_stages where producer_id = v_uid order by position, created_at;
end;
$$;


ALTER FUNCTION "public"."crm_criar_etapas_padrao"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."escolher_mesa"("p_event_id" "uuid", "p_mesa_numero" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_uid uuid := auth.uid();
  -- Escolha e troca só até 2 h antes do evento; entre trocas, 30 min (contra perseguição).
  v_prazo constant interval := interval '2 hours';
  v_intervalo constant interval := interval '30 minutes';
  v_ticket uuid;
  v_tipo uuid;
  v_eu public.table_members;
  v_mesa uuid;
  v_nome text;
begin
  if v_uid is null or not public.gf_mfa_ok() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  select t.id, t.ticket_type_id into v_ticket, v_tipo
  from public.tickets t join public.ticket_types tt on tt.id = t.ticket_type_id
  where t.event_id = p_event_id and t.user_id = v_uid and tt.type = 'coletiva' and t.status in ('active', 'used')
  order by t.created_at limit 1;
  if v_ticket is null then
    raise exception 'Você não tem ingresso da Mesa Tinder neste evento' using errcode = '22023';
  end if;
  if not public.mesa_ok(v_uid) then
    raise exception 'Para escolher a mesa, aceite o termo e tenha foto aprovada' using errcode = '22023';
  end if;
  -- 30 min: conferência rápida antes da trava por evento e de novo depois dela (duas chamadas
  -- simultâneas: a segunda espera a primeira e vê a troca que ela gravou)
  if exists (select 1 from public.table_members m where m.ticket_id = v_ticket and m.ultima_troca_em > now() - v_intervalo) then
    raise exception 'Espere 30 minutos entre uma troca de mesa e outra' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('formar_mesas:' || p_event_id));
  -- depois da trava: uma remoção feita ao mesmo tempo já está gravada
  if public.mesa_travado(p_event_id, v_uid) then
    raise exception 'Sua participação nas mesas deste evento foi suspensa pela organização.' using errcode = '22023';
  end if;
  if (select public.evento_momento(e) from public.events e where e.id = p_event_id) - now() < v_prazo then
    raise exception 'Escolha e troca de mesa só até 2 h antes do evento' using errcode = '22023';
  end if;

  -- cadeira de ingresso transferido que formar_mesas ainda não limpou (ticket_id é único)
  delete from public.table_members m where m.ticket_id = v_ticket and m.user_id <> v_uid;
  select m.* into v_eu from public.table_members m where m.ticket_id = v_ticket;
  if v_eu.oculto then
    raise exception 'Você saiu da Mesa Tinder: volte para escolher a mesa' using errcode = '22023';
  end if;
  if v_eu.ultima_troca_em > now() - v_intervalo then
    raise exception 'Espere 30 minutos entre uma troca de mesa e outra' using errcode = '22023';
  end if;

  if p_mesa_numero is null then
    select 'Mesa ' || (coalesce(max(substring(c.name from '[0-9]+')::int), 0) + 1) into v_nome
    from public.collective_tables c where c.event_id = p_event_id;
    insert into public.collective_tables (event_id, ticket_type_id, name, capacity, status)
    values (p_event_id, v_tipo, v_nome, 6, 'open')
    returning id into v_mesa;
  else
    select c.id, c.name into v_mesa, v_nome
    from public.collective_tables c
    where c.event_id = p_event_id and c.name = 'Mesa ' || p_mesa_numero;
    if v_mesa is not null and v_mesa = v_eu.table_id then
      raise exception 'Você já está nesta mesa' using errcode = '22023';
    end if;
    if not exists (select 1 from public.collective_tables c
                   where c.id = v_mesa and c.ticket_type_id = v_tipo and c.status <> 'closed'
                     and public.mesa_ocupados(c.id) < c.capacity) then
      raise exception 'Mesa indisponível' using errcode = '22023';
    end if;
  end if;

  if v_eu.id is null then
    insert into public.table_members (table_id, user_id, ticket_id, vibe) values (v_mesa, v_uid, v_ticket, null);
  else
    update public.table_members m set table_id = v_mesa, ultima_troca_em = now() where m.id = v_eu.id;
    if public.mesa_ocupados(v_eu.table_id) = 0 then
      delete from public.collective_tables c where c.id = v_eu.table_id;
    else
      perform public.mesa_recalcular(v_eu.table_id);
    end if;
  end if;
  perform public.mesa_recalcular(v_mesa);
  return jsonb_build_object('numero', substring(v_nome from '[0-9]+')::int, 'nome', v_nome);
end;
$$;


ALTER FUNCTION "public"."escolher_mesa"("p_event_id" "uuid", "p_mesa_numero" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."evento_acesso"("p_event" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select case
    when e.producer_id = auth.uid() then 'aberto'
    when e.status <> 'published' or e.approval_status <> 'approved' then null
    when e.visibility = 'public' then 'aberto'
    when e.visibility = 'unlisted' then 'link'
    when e.visibility = 'password' then 'senha'
    when e.visibility = 'private' then 'convidados'
  end
  from public.events e
  where e.id = p_event;
$$;


ALTER FUNCTION "public"."evento_acesso"("p_event" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."evento_contagem_publica"("p_event_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select (select count(*)::integer from public.tickets t
          where t.event_id = e.id and t.status in ('active', 'used'))
  from public.events e
  where e.id = p_event_id
    and e.status = 'published' and e.approval_status = 'approved'
    and public.evento_acesso(e.id) in ('aberto', 'link')
    and e.mostrar_contagem;
$$;


ALTER FUNCTION "public"."evento_contagem_publica"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."evento_momento"("e" "public"."events") RETURNS timestamp with time zone
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select coalesce((e.date + coalesce(e.time, '00:00'::time)) at time zone 'America/Sao_Paulo', e.start_date);
$$;


ALTER FUNCTION "public"."evento_momento"("e" "public"."events") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."evento_privado_marca"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if tg_op = 'UPDATE' and new.event_id is distinct from old.event_id then
    raise exception 'O link do evento não muda de evento' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.online_url is not distinct from old.online_url then
    return null;
  end if;
  update public.events set privado_alterado_em = clock_timestamp()
  where id = case when tg_op = 'DELETE' then old.event_id else new.event_id end;
  return null;
end;
$$;


ALTER FUNCTION "public"."evento_privado_marca"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."evento_publico"("p_ref" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  v_id uuid;
  v_acesso text;
begin
  -- uuid busca SÓ por id; o resto, SÓ por slug e só de evento público (slug de "Só com link" é chutável: título + data)
  if p_ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select e.id into v_id from public.events e where e.id = p_ref::uuid;
  else
    select e.id into v_id from public.events e where e.slug = p_ref and e.visibility = 'public';
  end if;
  if v_id is null then return null; end if;

  v_acesso := public.evento_acesso(v_id);
  if v_acesso in ('aberto', 'link') then
    return jsonb_build_object(
      'acesso', v_acesso,
      'evento', (select to_jsonb(e) from public.events e where e.id = v_id),
      'ingressos', coalesce((
        select jsonb_agg(to_jsonb(t) order by t.sort_order nulls last, t.created_at)
        from public.ticket_types t where t.event_id = v_id and t.is_active), '[]'::jsonb));
  elsif v_acesso = 'senha' then
    return jsonb_build_object('acesso', v_acesso, 'cartao', (
      select jsonb_build_object('id', e.id, 'slug', e.slug, 'title', e.title, 'cover_image', e.cover_image,
        'image_url', e.image_url, 'date', e.date, 'venue_city', e.venue_city)
      from public.events e where e.id = v_id));
  end if;
  return null;
end $_$;


ALTER FUNCTION "public"."evento_publico"("p_ref" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."evk_preco_meia"("p_cent" bigint) RETURNS bigint
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  select case when coalesce(p_cent, 0) <= 0 then 0 else greatest(p_cent / 2, 1) end -- bigint / bigint arredonda para baixo
$$;


ALTER FUNCTION "public"."evk_preco_meia"("p_cent" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."evk_taxa_centavos"("p_cent" bigint, "p_meia" boolean DEFAULT false) RETURNS bigint
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  select case when coalesce(p_cent, 0) <= 0 then 0
              else greatest(round(p_cent * 10 / 100.0)::bigint, case when p_meia then 0 else 300 end) end
$$;


ALTER FUNCTION "public"."evk_taxa_centavos"("p_cent" bigint, "p_meia" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."formar_mesas"("p_event_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_uid uuid := auth.uid();
  v_tipo uuid;
  v_primeira boolean;
  v_ids uuid[];
  v_ticket uuid;
  v_mesa uuid;
  v_k int;
  v_prox int;
  v_mudou uuid[] := '{}';
  v_total int := 0;
  v_fora uuid[];
begin
  if v_uid is null then
    if session_user not in ('postgres', 'supabase_admin') then
      raise exception 'Acesso negado' using errcode = '42501';
    end if;
  elsif not public.gf_mfa_ok() then
    raise exception 'Acesso negado' using errcode = '42501';
  elsif not exists (select 1 from public.events e where e.id = p_event_id and e.producer_id = v_uid) then
    -- admin só com moderate_mesa e sessão aal2 (auditoria do PR C)
    perform public.mesa_moderador();
  end if;
  -- cron e botão do produtor ao mesmo tempo: um espera o outro
  perform pg_advisory_xact_lock(hashtext('formar_mesas:' || p_event_id));

  -- Saídas: ingresso cancelado, reembolsado ou transferido (status ou só troca de dono) libera o
  -- lugar (a mesa fica); o novo dono entra como candidato logo abaixo
  with sai as (
    delete from public.table_members m
    using public.tickets t, public.collective_tables c
    where t.id = m.ticket_id and c.id = m.table_id and c.event_id = p_event_id
      and (t.status not in ('active', 'used') or t.user_id is distinct from m.user_id)
    returning m.table_id
  )
  select v_mudou || coalesce(array_agg(distinct sai.table_id), '{}') into v_mudou from sai;

  select coalesce(max(substring(c.name from '[0-9]+')::int), 0) + 1 into v_prox
  from public.collective_tables c where c.event_id = p_event_id;

  for v_tipo in
    select tt.id from public.ticket_types tt
    where tt.event_id = p_event_id and tt.type = 'coletiva' order by tt.id
  loop
    v_primeira := not exists (select 1 from public.collective_tables c where c.ticket_type_id = v_tipo);
    -- Candidatos. Na primeira formação, em ordem de afinidade (quem não é mesa_ok, perfil neutro);
    -- depois, por ordem de compra.
    select array_agg(t.id order by
             case when v_primeira then array_position(array['introvert', 'ambivert', 'extrovert'], x.p ->> 'temperament') end,
             case when v_primeira then array_position(array['low', 'medium', 'high'], x.p ->> 'energy_level') end,
             case when v_primeira then x.p ->> 'intention' end,
             case when v_primeira then x.p ->> 'music_style' end,
             t.created_at, t.id)
      into v_ids
    from public.tickets t
    cross join lateral (select coalesce(public.mesa_perfil(t.user_id),
                                        '{"temperament": "ambivert", "energy_level": "medium"}'::jsonb) p) x
    join public.profiles pr on pr.id = t.user_id
    where t.ticket_type_id = v_tipo and t.event_id = p_event_id and t.status in ('active', 'used')
      and pr.birth_date <= current_date - interval '18 years'
      and not exists (select 1 from public.table_members m where m.ticket_id = t.id)
      and not public.mesa_travado(p_event_id, t.user_id);
    -- Defesa além do gatilho mesa_idade_guard: menor ou sem data de nascimento fica fora e é avisado
    -- (só os ids dos ingressos no log, nenhum dado pessoal)
    select array_agg(t.id order by t.id) into v_fora
    from public.tickets t
    left join public.profiles pr on pr.id = t.user_id
    where t.ticket_type_id = v_tipo and t.event_id = p_event_id and t.status in ('active', 'used')
      and (pr.birth_date is null or pr.birth_date > current_date - interval '18 years')
      and not exists (select 1 from public.table_members m where m.ticket_id = t.id)
      and not public.mesa_travado(p_event_id, t.user_id);
    if v_fora is not null then
      raise warning 'formar_mesas(%): % ingresso(s) de menor ou sem data de nascimento fora da mesa: %',
        p_event_id, cardinality(v_fora), v_fora;
    end if;
    continue when v_ids is null;
    v_total := v_total + cardinality(v_ids);

    -- ponytail: uma escolha antecipada (escolher_mesa) cria mesa do tipo e desliga a afinidade da
    -- primeira formação para todo o tipo de ingresso; os demais entram pela fila de quem chega
    -- depois. Separar "mesa escolhida" de "mesa formada" se a afinidade fizer falta.
    if v_primeira then
      -- ntile sobre a fila ordenada: grupos parecidos e equilibrados (13 → 5/4/4). O número da mesa
      -- sai do md5 do menor ingresso do grupo (determinístico e sem revelar a ordem de temperamento).
      v_k := ceil(cardinality(v_ids) / 6.0);
      with u as (
        select u.ticket_id, ntile(v_k) over (order by u.ord) grupo
        from unnest(v_ids) with ordinality u(ticket_id, ord)
      ), g as (
        select u.grupo, v_prox - 1 + row_number() over (order by md5(min(u.ticket_id::text))) numero
        from u group by u.grupo
      ), mesas as (
        insert into public.collective_tables (event_id, ticket_type_id, name, capacity, status)
        select p_event_id, v_tipo, 'Mesa ' || g.numero, 6, 'open' from g
        returning id, name
      )
      -- vibe nula: minha_mesa lê a vibe na hora, com o consentimento vigente
      insert into public.table_members (table_id, user_id, ticket_id, vibe)
      select m.id, t.user_id, t.id, null
      from u
      join g on g.grupo = u.grupo
      join public.tickets t on t.id = u.ticket_id
      join mesas m on m.name = 'Mesa ' || g.numero;
      v_prox := v_prox + v_k;
      v_mudou := v_mudou || array(select c.id from public.collective_tables c where c.ticket_type_id = v_tipo);
    else
      -- Quem chega depois: mesa do mesmo tipo com vaga, primeiro as que já têm gente (com escolha antes
      -- da formação, a formação completa as mesas com vaga: Decisão 84) e, entre elas, a com menos
      -- gente; sem vaga, mesa nova.
      -- ponytail: sem afinidade para quem chega depois (plano); reformar mesa já anunciada confundiria.
      foreach v_ticket in array v_ids loop
        select c.id into v_mesa
        from public.collective_tables c
        cross join lateral (select count(*) n from public.table_members m where m.table_id = c.id) q
        where c.ticket_type_id = v_tipo and c.status <> 'closed' and q.n < c.capacity
        order by (q.n = 0), q.n, c.created_at, substring(c.name from '[0-9]+')::int
        limit 1;
        if v_mesa is null then
          insert into public.collective_tables (event_id, ticket_type_id, name, capacity, status)
          values (p_event_id, v_tipo, 'Mesa ' || v_prox, 6, 'open')
          returning id into v_mesa;
          v_prox := v_prox + 1;
        end if;
        insert into public.table_members (table_id, user_id, ticket_id, vibe)
        select v_mesa, t.user_id, t.id, null
        from public.tickets t where t.id = v_ticket;
        v_mudou := v_mudou || v_mesa;
      end loop;
    end if;
  end loop;

  -- Situação e nota só das mesas que mudaram. A nota usa só os pares em que os dois são mesa_ok;
  -- sem nenhum par assim, fica nula.
  update public.collective_tables c set
    status = case when c.status = 'closed' then 'closed'
                  when (select count(*) from public.table_members m where m.table_id = c.id) >= c.capacity then 'full'
                  else 'open' end,
    compatibility_score = (
      select round(avg(public.mesa_compat(pa.p, pb.p)), 1)
      from public.table_members a
      join public.table_members b on b.table_id = a.table_id and a.ticket_id < b.ticket_id
      cross join lateral (select public.mesa_perfil(a.user_id) p) pa
      cross join lateral (select public.mesa_perfil(b.user_id) p) pb
      where a.table_id = c.id and pa.p is not null and pb.p is not null)
  where c.id = any(v_mudou);
  -- mesa que ficou sem ninguém (saídas) sai, como em escolher_mesa
  delete from public.collective_tables c
  where c.event_id = p_event_id and not exists (select 1 from public.table_members m where m.table_id = c.id);

  return v_total;
end;
$$;


ALTER FUNCTION "public"."formar_mesas"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gf_admin_can"("p" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1 from public.profiles pr
    where pr.id = (select auth.uid())
      and pr.role = 'admin'
      and ('super_admin' = any(pr.admin_permissions) or p = any(pr.admin_permissions))
  ) and public.gf_mfa_ok()
    -- Decisão 99: admin só com fator confirmado e o código digitado nesta sessão
    -- S9: o fator é o de aplicativo (TOTP)
    and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    and exists (select 1 from auth.mfa_factors f where f.user_id = (select auth.uid()) and f.factor_type = 'totp' and f.status = 'verified');
$$;


ALTER FUNCTION "public"."gf_admin_can"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gf_admin_can_any"("p" "text"[]) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1 from public.profiles pr
    where pr.id = (select auth.uid())
      and pr.role = 'admin'
      and ('super_admin' = any(pr.admin_permissions) or pr.admin_permissions && p)
  ) and public.gf_mfa_ok()
    -- Decisão 99: admin só com fator confirmado e o código digitado nesta sessão
    -- S9: o fator é o de aplicativo (TOTP)
    and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    and exists (select 1 from auth.mfa_factors f where f.user_id = (select auth.uid()) and f.factor_type = 'totp' and f.status = 'verified');
$$;


ALTER FUNCTION "public"."gf_admin_can_any"("p" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gf_cpf_valido"("p" "text") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO ''
    AS $_$
declare
  d int[];
  s int;
  i int;
  dv1 int;
  dv2 int;
begin
  if p is null or p !~ '^[0-9]{11}$' or p ~ '^(.)\1{10}$' then
    return false;
  end if;
  d := array(select substr(p, g, 1)::int from generate_series(1, 11) g);
  s := 0;
  for i in 1..9 loop s := s + d[i] * (11 - i); end loop;
  dv1 := case when s % 11 < 2 then 0 else 11 - s % 11 end;
  s := 0;
  for i in 1..10 loop s := s + d[i] * (12 - i); end loop;
  dv2 := case when s % 11 < 2 then 0 else 11 - s % 11 end;
  return d[10] = dv1 and d[11] = dv2;
end;
$_$;


ALTER FUNCTION "public"."gf_cpf_valido"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gf_cupom_regras"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
begin
  if new.producer_id is null then
    return new;
  end if;
  if (tg_op = 'INSERT' or new.code is distinct from old.code or old.producer_id is null)
     and new.code !~ '^[A-Za-z0-9][A-Za-z0-9_-]{1,29}$' then
    raise exception 'coupons_code_formato: código de cupom inválido (use de 2 a 30 letras, números, hífen ou sublinhado)' using errcode = 'check_violation';
  end if;
  if tg_op = 'INSERT' and (select count(*) from public.coupons c where c.producer_id = new.producer_id) >= 5000 then
    raise exception 'coupons_teto: limite de 5000 cupons por produtor atingido' using errcode = 'check_violation';
  end if;
  return new;
end $_$;


ALTER FUNCTION "public"."gf_cupom_regras"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gf_events_ingressos_marca"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if new.ingressos_alterados_em is distinct from (case when tg_op = 'UPDATE' then old.ingressos_alterados_em end)
     and current_user in ('authenticated', 'anon')
     and not public.gf_admin_can('manage_events') then
    raise exception 'ingressos_alterados_em é gravado só pelo banco' using errcode = '42501';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."gf_events_ingressos_marca"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gf_ha_outro_super_admin"("p_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  -- só de dentro do gatilho: chamada direta pela API viraria oráculo de "quem é o único super_admin"
  if pg_trigger_depth() = 0 then
    raise exception 'uso interno' using errcode = '42501';
  end if;
  return exists (select 1 from public.profiles p
                 where p.id <> p_id and p.role = 'admin' and 'super_admin' = any(p.admin_permissions));
end;
$$;


ALTER FUNCTION "public"."gf_ha_outro_super_admin"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gf_interesse_avisar"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare n int;
begin
  with devidos as (
    select i.id, i.user_id, i.event_id, left(e.title, 120) as titulo
    from public.interest_lists i
    join public.events e on e.id = i.event_id
    where not i.notified and i.consentimento_em is not null and i.removido_em is null
      and e.status = 'published' and e.approval_status = 'approved'
      and exists (select 1 from public.ticket_types t
                  where t.event_id = e.id and t.is_active
                    and (i.ticket_type_id is null or t.id = i.ticket_type_id)
                    and (t.sale_start is null or t.sale_start <= now())
                    and (t.sale_end is null or t.sale_end > now()))
    order by i.created_at
    limit 500
    for update of i skip locked
  ), marcados as (
    update public.interest_lists i
       set notified = true, notified_at = now()
      from devidos d
     where i.id = d.id
    returning d.user_id, d.event_id, d.titulo
  ), avisos as (
    insert into public.notifications (user_id, title, body, type, metadata)
    select p.id, 'As vendas abriram',
           '"' || m.titulo || '" abriu as vendas. Garanta seu ingresso.',
           'sale',
           jsonb_build_object('origem', 'interesse', 'event_id', m.event_id, 'url', '/event/' || m.event_id)
    from marcados m
    join public.profiles p on p.id = m.user_id
    returning 1
  )
  select count(*) into n from marcados;
  return n;
end;
$$;


ALTER FUNCTION "public"."gf_interesse_avisar"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gf_interesse_para_crm"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if new.consentimento_em is null or new.removido_em is not null then return null; end if;
  insert into public.crm_leads (producer_id, full_name, email, city, source, event_interest)
  select e.producer_id, left(coalesce(nullif(btrim(p.full_name), ''), 'Participante'), 200), u.email::text, p.city,
         'lista_interesse', left(e.title, 200)
  from public.events e
  join public.profiles p on p.id = new.user_id
  join auth.users u on u.id = new.user_id
  where e.id = new.event_id and u.email is not null and u.email_confirmed_at is not null
  on conflict do nothing;
  return null;
end;
$$;


ALTER FUNCTION "public"."gf_interesse_para_crm"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gf_is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  ) and public.gf_mfa_ok()
    -- Decisão 99: admin só com fator confirmado e o código digitado nesta sessão
    -- S9: o fator é o de aplicativo (TOTP)
    and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    and exists (select 1 from auth.mfa_factors f where f.user_id = (select auth.uid()) and f.factor_type = 'totp' and f.status = 'verified');
$$;


ALTER FUNCTION "public"."gf_is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gf_mfa_ok"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = (select auth.uid()) and f.status = 'verified'
      );
$$;


ALTER FUNCTION "public"."gf_mfa_ok"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gf_notificar_evento"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_publico_antes boolean := old.status = 'published' and old.approval_status = 'approved';
  v_publico_agora boolean := new.status = 'published' and new.approval_status = 'approved';
begin
  -- 1. Moderação decidiu (aprovou ou recusou): avisa o produtor
  if new.approval_status is distinct from old.approval_status and new.approval_status in ('approved', 'rejected') then
    insert into public.notifications (user_id, title, body, type, metadata)
    select p.id,
           case new.approval_status when 'approved' then 'Seu evento foi aprovado' else 'Seu evento foi recusado' end,
           case new.approval_status
             when 'approved' then '"' || left(new.title, 120) || '" já está no ar.'
             else '"' || left(new.title, 120) || '" foi recusado.'
                  || coalesce(' Motivo: ' || left(nullif(btrim(new.rejection_reason), ''), 500), '')
           end,
           case new.approval_status when 'approved' then 'info' else 'system' end,
           jsonb_build_object('origem', 'moderacao', 'event_id', new.id, 'url', '/producer/events/' || new.id || '/edit')
    from public.profiles p
    where p.id = new.producer_id;
  end if;

  -- 1b. Moderação devolveu um evento aprovado para análise (quem edita não é o produtor): avisa o produtor
  if old.approval_status = 'approved' and new.approval_status = 'pending'
     and (select auth.uid()) is distinct from new.producer_id then
    insert into public.notifications (user_id, title, body, type, metadata)
    select p.id, 'Seu evento voltou para análise',
           '"' || left(old.title, 120) || '" voltou para análise da equipe.',
           'info',
           jsonb_build_object('origem', 'moderacao', 'event_id', new.id, 'url', '/producer/events/' || new.id || '/edit')
    from public.profiles p
    where p.id = new.producer_id;
  end if;

  -- 2. Evento que estava no ar mudou de data ou de local: avisa quem salvou. Não exige "no ar agora": se o produtor
  --    mudou, o banco já o pôs em análise no mesmo UPDATE (decisão 6)
  if v_publico_antes and new.status = 'published'
     and (new.date, new."time", new.start_date, new.end_date, new.venue_name, new.venue_address, new.venue_city, new.venue_state)
         is distinct from
         (old.date, old."time", old.start_date, old.end_date, old.venue_name, old.venue_address, old.venue_city, old.venue_state)
  then
    insert into public.notifications (user_id, title, body, type, metadata)
    select p.id, 'Um evento salvo mudou de data ou local',
           case when v_publico_agora
                then '"' || left(old.title, 120) || '" tem novos dados. Confira antes de se planejar.'
                else '"' || left(old.title, 120) || '" mudou de data ou local e está em nova análise.' end,
           'info',
           -- em análise o evento não aparece para o participante (RLS): leva a Salvos, não à página do evento
           jsonb_build_object('origem', 'evento_salvo', 'event_id', new.id,
                              'url', case when v_publico_agora then '/event/' || new.id else '/app/salvos' end)
    from public.favoritos f
    join public.profiles p on p.id = f.user_id
    where f.event_id = new.id;
  end if;

  -- 3. Evento no ar foi cancelado: avisa quem salvou
  if v_publico_antes and new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    insert into public.notifications (user_id, title, body, type, metadata)
    select p.id, 'Um evento salvo foi cancelado',
           '"' || left(old.title, 120) || '" foi cancelado.',
           'system',
           -- evento cancelado não aparece para o participante (RLS): leva a Salvos, não à página do evento
           jsonb_build_object('origem', 'evento_salvo', 'event_id', new.id, 'url', '/app/salvos')
    from public.favoritos f
    join public.profiles p on p.id = f.user_id
    where f.event_id = new.id;
  end if;

  return null; -- AFTER: o retorno é ignorado
end;
$$;


ALTER FUNCTION "public"."gf_notificar_evento"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gf_portaria_ok"("p_producer" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select public.gf_mfa_ok() and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    and exists (select 1 from auth.mfa_factors f where f.user_id = (select auth.uid()) and f.status = 'verified')
    and exists (select 1 from public.team_members t
                where t.producer_id = p_producer and t.user_id = (select auth.uid())
                  and t.role in ('admin', 'editor') and t.accepted_at is not null and t.blocked_at is null);
$$;


ALTER FUNCTION "public"."gf_portaria_ok"("p_producer" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gf_protect_affiliate_link"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  -- S3 (Decisão 163): manage_affiliates no lugar de gf_is_admin
  -- o link não muda de afiliado depois de criado, nem por manage_affiliates (desviaria comissão; Decisão 163)
  if current_user in ('authenticated', 'anon') and new.affiliate_id is distinct from old.affiliate_id then
    raise exception 'Alteração de campo protegido não permitida' using errcode = '42501';
  end if;
  -- só trava quem edita pelo site (papéis do PostgREST); a contagem de cliques roda dentro de
  -- affiliate_link_hit (security definer, como dona da função) e passa
  if current_user in ('authenticated', 'anon') and not (select public.gf_admin_can('manage_affiliates'))
     and (new.slug is distinct from old.slug or new.affiliate_id is distinct from old.affiliate_id
          or new.clicks is distinct from old.clicks or new.created_at is distinct from old.created_at) then
    raise exception 'Só é possível alterar o nome de exibição e ativar/desativar o link.';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."gf_protect_affiliate_link"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gf_protect_coupon_uses"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  -- S3 (Decisão 163): manage_coupons no lugar de gf_is_admin
  if (current_user in ('anon', 'authenticated')
      or coalesce(auth.jwt()->>'role', '') in ('anon', 'authenticated'))
     and not public.gf_admin_can('manage_coupons') then
    if tg_op = 'INSERT' then
      if new.uses <> 0 then
        raise exception 'Campo protegido não permitido' using errcode = '42501';
      end if;
    elsif new.uses is distinct from old.uses then
      raise exception 'Alteração de campo protegido não permitida' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."gf_protect_coupon_uses"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gf_protect_event_cancel"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  -- Decisão 163: quem mexe em evento alheio com ingresso vendido é quem tem manage_events (era qualquer admin)
  if not ((current_setting('role', true) in ('anon', 'authenticated')
           or coalesce(auth.jwt()->>'role', '') in ('anon', 'authenticated'))
          and not public.gf_admin_can('manage_events')) then
    return new;
  end if;
  -- vendido: mesmo critério da trava de data e local da F0a (inclui 'transferred')
  if not exists (select 1 from public.tickets t
                 where t.event_id = old.id and coalesce(t.status, 'active') not in ('cancelled', 'refunded')) then
    return new;
  end if;
  if old.status = 'cancelled' then
    raise exception 'Evento cancelado com ingressos vendidos só é reaberto pelo suporte da Evokaa.'
      using errcode = 'EV003';
  end if;
  if new.status = 'cancelled' then
    raise exception 'Este evento tem ingressos vendidos. Para cancelar, fale com o suporte da Evokaa.'
      using errcode = 'EV001';
  end if;
  -- maior data conhecida da linha antiga (DECISÕES 7)
  if (new.status = 'draft' and old.status = 'published')
     or (new.status = 'ended'
         and greatest(old.end_date, old.start_date,
                      (old.date + coalesce(old.time, time '23:59:59')) at time zone 'America/Sao_Paulo') > now()) then
    raise exception 'Este evento tem ingressos vendidos e não pode sair do ar. Fale com o suporte da Evokaa.'
      using errcode = 'EV002';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."gf_protect_event_cancel"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gf_protect_event_moderation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not ((current_setting('role', true) in ('anon', 'authenticated')
           or coalesce(auth.jwt()->>'role', '') in ('anon', 'authenticated'))
          and not public.gf_is_admin()) then
    return new;
  end if;

  -- aceite do produtor (20261024): passar para published exige aceite gravado para a versão, a classificação e a bebida atuais
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    if not exists (select 1 from public.evento_aceites a
                   where a.event_id = new.id
                     and a.versao = public.aceite_evento_versao()
                     and a.classificacao is not distinct from (case when new.category = 'esporte' then null else new.classificacao end)
                     and a.tem_bebida = exists (select 1 from public.ticket_types t where t.event_id = new.id and t.inclui_bebida)) then
      raise exception 'Evento sem aceite do produtor para a classificação e a bebida atuais' using errcode = '42501';
    end if;
  end if;

  if tg_op = 'INSERT' then
    if new.approval_status is distinct from 'pending'
       or new.approved_at is not null or new.approved_by is not null
       or new.rejection_reason is not null or coalesce(new.featured_carousel, false) then
      raise exception 'Evento novo entra em análise; aprovação e destaque são do admin' using errcode = '42501';
    end if;
    return new;
  end if;

  if (new.approval_status, new.approved_at, new.approved_by, new.rejection_reason, new.featured_carousel)
     is distinct from
     (old.approval_status, old.approved_at, old.approved_by, old.rejection_reason, old.featured_carousel) then
    raise exception 'Aprovação e destaque do evento são do admin' using errcode = '42501';
  end if;

  if (new.date, new.time, new.start_date, new.end_date, new.venue_name, new.venue_address, new.venue_city,
      new.venue_state, new.venue_zip, new.venue_lat, new.venue_lng, new.local_modo)
     is distinct from
     (old.date, old.time, old.start_date, old.end_date, old.venue_name, old.venue_address, old.venue_city,
      old.venue_state, old.venue_zip, old.venue_lat, old.venue_lng, old.local_modo)
     and exists (select 1 from public.tickets t
                 where t.event_id = old.id and coalesce(t.status, 'active') not in ('cancelled', 'refunded')) then
    raise exception 'Evento com ingresso vendido: data e local só mudam pelo admin (Decreto 13.108, arts. 20 a 22)'
      using errcode = '42501';
  end if;

  if old.approval_status in ('approved', 'rejected')
     and (new.title, new.subtitle, new.description, new.short_description, new.cover_image, new.image_url,
          new.gallery, new.category, new.tags, new.meta_title, new.meta_description, new.date, new.time, new.start_date, new.end_date, new.venue_name,
          new.venue_address, new.venue_city, new.venue_state, new.venue_zip, new.venue_lat, new.venue_lng,
          new.temas, new.estilos, new.classificacao, new.local_modo, new.privado_alterado_em)
         is distinct from
         (old.title, old.subtitle, old.description, old.short_description, old.cover_image, old.image_url,
          old.gallery, old.category, old.tags, old.meta_title, old.meta_description, old.date, old.time, old.start_date, old.end_date, old.venue_name,
          old.venue_address, old.venue_city, old.venue_state, old.venue_zip, old.venue_lat, old.venue_lng,
          old.temas, old.estilos, old.classificacao, old.local_modo, old.privado_alterado_em) then
    new.approval_status := 'pending';
    new.featured_carousel := false;
    new.approved_at := null;
    new.approved_by := null; -- rejection_reason fica: é o histórico da recusa
  end if;

  -- voltou a published (recusado reenviado, revogado, aprovado que passou por rascunho): nova análise
  if old.status is distinct from 'published' and new.status = 'published' then
    new.approval_status := 'pending';
    new.featured_carousel := false;
    new.approved_at := null;
    new.approved_by := null; -- rejection_reason fica: o painel mostra o motivo
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."gf_protect_event_moderation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gf_protect_platform_affiliate_payout"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  -- S3 (Decisão 163, item 10): nem super_admin troca a conta já preenchida, nem muda de quem é a linha
  -- (user_id) ou o código de indicação (referral_code): desviaria a comissão do afiliado
  if (current_user in ('anon', 'authenticated')
      or coalesce(auth.jwt()->>'role', '') in ('anon', 'authenticated'))
     and ((old.payout_account_id is not null and new.payout_account_id is distinct from old.payout_account_id)
          or new.user_id is distinct from old.user_id
          or new.referral_code is distinct from old.referral_code) then
    raise exception 'Alteração de campo protegido não permitida' using errcode = '42501';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."gf_protect_platform_affiliate_payout"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gf_protect_producer_profile_privileges"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v_dono boolean;
begin
  -- S3 (Decisão 163): regra por coluna
  if not (current_user in ('anon', 'authenticated')
          or coalesce(auth.jwt()->>'role', '') in ('anon', 'authenticated')) then
    return new;
  end if;
  v_dono := coalesce(auth.uid() = (case when tg_op = 'INSERT' then new.id else old.id end), false);
  if tg_op = 'INSERT' then
    -- cadastro de OUTRA pessoa (admin com manage_users): sem CNPJ, Pix e conta bancária
    if not v_dono and (new.cnpj_enc is not null or new.cnpj_hmac is not null
                       or new.pix_key_enc is not null or new.bank_account_enc is not null) then
      raise exception 'Campo protegido não permitido' using errcode = '42501';
    end if;
    if new.is_verified and not public.gf_admin_can('manage_users') then
      raise exception 'Campo protegido não permitido' using errcode = '42501';
    end if;
    if (new.commission_rate is distinct from 10.00
        or new.webhook_url is not null or new.stripe_account_id is not null or new.woovi_account_id is not null)
       and not public.gf_admin_can('super_admin') then
      raise exception 'Campo protegido não permitido' using errcode = '42501';
    end if;
  else
    -- a linha não "muda de dono": id e created_at nunca mudam pelo site
    if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
      raise exception 'Alteração de campo protegido não permitida' using errcode = '42501';
    end if;
    if not v_dono and (new.pix_key_enc is distinct from old.pix_key_enc
                       or new.bank_account_enc is distinct from old.bank_account_enc
                       or new.cnpj_enc is distinct from old.cnpj_enc
                       or new.cnpj_hmac is distinct from old.cnpj_hmac
                       or new.company_name is distinct from old.company_name) then
      raise exception 'Alteração de campo protegido não permitida' using errcode = '42501';
    end if;
    if new.is_verified is distinct from old.is_verified and not public.gf_admin_can('manage_users') then
      raise exception 'Alteração de campo protegido não permitida' using errcode = '42501';
    end if;
    if (new.commission_rate is distinct from old.commission_rate
        or new.webhook_url is distinct from old.webhook_url
        or new.stripe_account_id is distinct from old.stripe_account_id
        or new.woovi_account_id is distinct from old.woovi_account_id)
       and not public.gf_admin_can('super_admin') then
      raise exception 'Alteração de campo protegido não permitida' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."gf_protect_producer_profile_privileges"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gf_protect_profile_privileges"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  -- Quem sai do papel admin perde as permissões (senão voltar a admin depois recupera as antigas)
  if old.role = 'admin' and new.role is distinct from 'admin' then
    new.admin_permissions := '{}';
  end if;

  -- Nunca sobrar zero super_admin (vale para todos, inclusive a chave de serviço do delete-account).
  -- A trava serializa dois super_admins que se rebaixam ao mesmo tempo (senão os dois passariam).
  if old.role = 'admin' and 'super_admin' = any(coalesce(old.admin_permissions, '{}')) then
    perform pg_advisory_xact_lock(hashtext('gf_super_admin'));
  end if;
  if old.role = 'admin' and 'super_admin' = any(coalesce(old.admin_permissions, '{}'))
     and not (new.role = 'admin' and 'super_admin' = any(coalesce(new.admin_permissions, '{}')))
     and not public.gf_ha_outro_super_admin(old.id) then
    raise exception 'A plataforma precisa de pelo menos um super_admin' using errcode = '42501';
  end if;

  -- Decisão 99: só vira admin quem já tem 2FA confirmado (usuário e chave de serviço; o dono do banco fica livre)
  if new.role = 'admin' and old.role is distinct from 'admin'
     and current_user not in ('postgres', 'supabase_admin')
     and public.gf_tem_2fa(new.id) is not true then
    raise exception 'Só dá para promover a admin uma conta com 2FA confirmado.' using errcode = '42501';
  end if;

  -- Daqui para baixo, só chamadas de usuário; chave de serviço e postgres seguem livres
  if not (current_user in ('anon', 'authenticated')
          or coalesce(auth.jwt() ->> 'role', '') in ('anon', 'authenticated')) then
    return new;
  end if;

  -- Trocar o id "moveria" o perfil (com papel e permissões) para outro login
  if new.id is distinct from old.id then
    raise exception 'O id do perfil não pode ser alterado' using errcode = '42501';
  end if;

  if new.admin_permissions is distinct from old.admin_permissions
     or (new.role is distinct from old.role and 'admin' in (new.role, old.role)) then
    if not public.gf_admin_can('super_admin') then
      raise exception 'Só o super_admin altera papel de admin e permissões' using errcode = '42501';
    end if;
    if new.id = (select auth.uid()) then
      raise exception 'Ninguém altera o próprio papel nem as próprias permissões' using errcode = '42501';
    end if;
  elsif new.role is distinct from old.role then
    -- participante, cliente, produtor e editor: quem gerencia usuários
    if not public.gf_admin_can('manage_users') then
      raise exception 'Alteração de papel exige a permissão manage_users' using errcode = '42501';
    end if;
  end if;

  if (new.is_verified is distinct from old.is_verified
      or new.stripe_customer_id is distinct from old.stripe_customer_id)
     and not public.gf_admin_can('manage_users') then
    raise exception 'Alteração de campo protegido não permitida' using errcode = '42501';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."gf_protect_profile_privileges"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gf_protect_withdrawals"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  -- S3 (Decisão 163): travado por lista de exceção, então coluna futura já nasce travada
  if (current_user in ('anon', 'authenticated')
      or coalesce(auth.jwt()->>'role', '') in ('anon', 'authenticated'))
     and (to_jsonb(new) - 'status' - 'processed_at') is distinct from (to_jsonb(old) - 'status' - 'processed_at') then
    raise exception 'Alteração de campo protegido não permitida' using errcode = '42501';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."gf_protect_withdrawals"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gf_reauth_dinheiro"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  -- só chamadas do site; chave de serviço e SQL Editor seguem livres
  if (current_user in ('anon', 'authenticated') or coalesce(auth.jwt() ->> 'role', '') in ('anon', 'authenticated'))
     and not public.gf_reauth_recente(300) then
    raise exception 'Confirme o código da verificação em duas etapas para continuar.' using errcode = '42501', hint = 'reautenticar';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."gf_reauth_dinheiro"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gf_reauth_recente"("p_segundos" integer) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    and coalesce((
      select bool_or(
        a ->> 'method' = 'totp'
        and case when (a ->> 'timestamp') ~ '^[0-9]+(\.[0-9]+)?$' then (a ->> 'timestamp')::numeric end
            >= extract(epoch from now()) - p_segundos)
      from jsonb_array_elements(case when jsonb_typeof(auth.jwt() -> 'amr') = 'array' then auth.jwt() -> 'amr' else '[]'::jsonb end) a
    ), false);
$_$;


ALTER FUNCTION "public"."gf_reauth_recente"("p_segundos" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gf_tem_2fa"("p_user" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select case
    when p_user = (select auth.uid())
      or (select public.gf_admin_can('super_admin'))
      or (select auth.role()) = 'service_role'
    then exists (select 1 from auth.mfa_factors f where f.user_id = p_user and f.factor_type = 'totp' and f.status = 'verified')
  end;
$$;


ALTER FUNCTION "public"."gf_tem_2fa"("p_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gf_ticket_types_toca_evento"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  antigo uuid;
  novo uuid;
  material boolean;
begin
  if tg_op = 'UPDATE'
     and (to_jsonb(old) - array['sold', 'quantity_sold', 'updated_at'])
         is not distinct from (to_jsonb(new) - array['sold', 'quantity_sold', 'updated_at']) then
    return null; -- só venda (ou nada): não é mudança do evento
  end if;
  -- Decisão 163 item 15: preço, quantidade e tipo novo avisam o admin; pausar, ordem e datas de venda não
  material := tg_op <> 'UPDATE'
    or (old.event_id, old.price, old.quantity_total, old.capacity, old.type, old.name, old.description,
        old.inclui_bebida, old.perks, old.perks_array)
       is distinct from
       (new.event_id, new.price, new.quantity_total, new.capacity, new.type, new.name, new.description,
        new.inclui_bebida, new.perks, new.perks_array);
  if tg_op <> 'INSERT' then antigo := old.event_id; end if;
  if tg_op <> 'DELETE' then novo := new.event_id; end if;
  update public.events
     set updated_at = now(),
         ingressos_alterados_em = case when material and approval_status = 'approved'
                                       then clock_timestamp() else ingressos_alterados_em end
   where id in (antigo, novo);
  return null;
end;
$$;


ALTER FUNCTION "public"."gf_ticket_types_toca_evento"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gf_trava_venda_ingresso"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."gf_trava_venda_ingresso"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    case when new.raw_user_meta_data->>'role' = 'producer' then 'producer' else 'user' end
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."interesse_email_due"() RETURNS TABLE("id" "uuid", "email" "text", "nome" "text", "evento" "text", "event_id" "uuid")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  with fila as (
    select i.id
    from public.interest_lists i
    join auth.users u on u.id = i.user_id
    where i.notified and i.removido_em is null and i.email_enviado_em is null and i.email_falhas < 5
      and i.notified_at > now() - interval '48 hours'
      and (i.email_reservado_ate is null or i.email_reservado_ate < now())
      and u.email is not null and u.email_confirmed_at is not null and u.deleted_at is null
    order by i.notified_at
    limit 50
    for update of i skip locked
  ), reservados as (
    update public.interest_lists i
       set email_reservado_ate = now() + interval '2 minutes'
      from fila f
     where i.id = f.id
    returning i.id, i.user_id, i.event_id
  )
  select r.id, u.email::text, coalesce(nullif(btrim(p.full_name), ''), 'Olá')::text, left(e.title, 120)::text, r.event_id
  from reservados r
  join auth.users u on u.id = r.user_id
  join public.events e on e.id = r.event_id
  left join public.profiles p on p.id = r.user_id;
$$;


ALTER FUNCTION "public"."interesse_email_due"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."interesse_email_mark"("p_ids" "uuid"[], "p_ok" boolean) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare n int;
begin
  update public.interest_lists
     set email_enviado_em = case when p_ok then now() end,
         email_falhas = case when p_ok then email_falhas else email_falhas + 1 end,
         email_reservado_ate = null
   where id = any (p_ids);
  get diagnostics n = row_count;
  return n;
end;
$$;


ALTER FUNCTION "public"."interesse_email_mark"("p_ids" "uuid"[], "p_ok" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."interesse_entrar"("p_event_id" "uuid", "p_ticket_type_id" "uuid", "p_versao" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not (select public.gf_mfa_ok()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if p_versao is null or not exists (select 1 from public.events e
       where e.id = p_event_id and e.status = 'published' and e.approval_status = 'approved') then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if p_ticket_type_id is not null and not exists (select 1 from public.ticket_types t
       where t.id = p_ticket_type_id and t.event_id = p_event_id) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  insert into public.interest_lists (user_id, event_id, ticket_type_id, consentimento_versao)
  values (v_uid, p_event_id, p_ticket_type_id, p_versao)
  on conflict (event_id, user_id) do update
    set removido_em = null, consentimento_em = now(), consentimento_versao = excluded.consentimento_versao,
        ticket_type_id = excluded.ticket_type_id
    where public.interest_lists.removido_em is not null;
  return true;
end;
$$;


ALTER FUNCTION "public"."interesse_entrar"("p_event_id" "uuid", "p_ticket_type_id" "uuid", "p_versao" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."interesse_lista"("p_event_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "event_id" "uuid", "event_title" "text", "full_name" "text", "email" "text", "city" "text", "notified" boolean, "notified_at" timestamp with time zone, "consentiu" boolean, "created_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select i.id, i.event_id, e.title::text,
         case when i.consentimento_em is not null then p.full_name end,
         case when i.consentimento_em is not null then u.email::text end,
         case when i.consentimento_em is not null then p.city end,
         i.notified, i.notified_at, i.consentimento_em is not null, i.created_at
  from public.interest_lists i
  join public.events e on e.id = i.event_id
  left join public.profiles p on p.id = i.user_id
  left join auth.users u on u.id = i.user_id
  where e.producer_id = (select auth.uid())
    and i.removido_em is null
    and (select public.gf_mfa_ok())
    and (p_event_id is null or i.event_id = p_event_id)
  order by i.created_at desc
  limit 5000;
$$;


ALTER FUNCTION "public"."interesse_lista"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."interesse_notify_secret"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select d.decrypted_secret from vault.decrypted_secrets d where d.name = 'interesse_notify_secret' limit 1;
$$;


ALTER FUNCTION "public"."interesse_notify_secret"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."interesse_remover"("p_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare n int;
begin
  if (select auth.uid()) is null or not (select public.gf_mfa_ok()) then return false; end if;
  update public.interest_lists i set removido_em = now()
  from public.events e
  where i.id = p_id and i.removido_em is null and e.id = i.event_id and e.producer_id = (select auth.uid());
  get diagnostics n = row_count;
  return n = 1;
end;
$$;


ALTER FUNCTION "public"."interesse_remover"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."interesse_sair"("p_event_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare n int;
begin
  if (select auth.uid()) is null or not (select public.gf_mfa_ok()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  update public.interest_lists set removido_em = now()
   where user_id = (select auth.uid()) and event_id = p_event_id and removido_em is null;
  get diagnostics n = row_count;
  return n = 1;
end;
$$;


ALTER FUNCTION "public"."interesse_sair"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kb_articles_after_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if old.slug is not null then
    insert into public.kb_slugs_excluidos (slug) values (old.slug) on conflict (slug) do nothing;
  end if;
  return null;
end;
$$;


ALTER FUNCTION "public"."kb_articles_after_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_me_to_affiliate"("p_code" "text", "p_ref_first_seen_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_link" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  v_uid uuid := (select auth.uid());
  v_aff uuid;
begin
  if not public.gf_mfa_ok() then
    raise exception 'Confirme o código do 2FA' using errcode = '42501';
  end if;
  if v_uid is null or p_code is null or p_code !~* '^[A-Z0-9_-]{3,30}$' then
    return false;
  end if;
  -- só no momento do cadastro (conta com até 1 hora) e só se o produtor nunca teve afiliado,
  -- nem vínculo já encerrado pelo admin: senão um produtor antigo se ligaria a um afiliado
  -- amigo depois e dividiria a comissão (achado da revisão de 29/09/2026)
  if not exists (select 1 from public.profiles
                  where id = v_uid and role = 'producer' and created_at > now() - interval '1 hour') then
    return false;
  end if;
  if exists (select 1 from public.platform_affiliate_producers where producer_id = v_uid) then
    return false;
  end if;
  select id into v_aff from public.platform_affiliates
   where upper(referral_code) = upper(p_code) and status = 'active' and user_id <> v_uid;
  if v_aff is null then
    return false;
  end if;
  insert into public.platform_affiliate_producers (producer_id, affiliate_id, source, ref_first_seen_at, affiliate_link_id)
  values (v_uid, v_aff,
          case when p_ref_first_seen_at is null then 'code' else 'link' end,
          -- data do link: nunca no futuro nem mais de 30 dias atrás (o navegador pode mentir)
          case when p_ref_first_seen_at between now() - interval '720 hours' and now() then p_ref_first_seen_at end,
          (select l.id from public.affiliate_links l where l.affiliate_id = v_aff and l.slug = lower(p_link)))
  on conflict do nothing;
  return found;
end;
$_$;


ALTER FUNCTION "public"."link_me_to_affiliate"("p_code" "text", "p_ref_first_seen_at" timestamp with time zone, "p_link" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."listar_afiliados"() RETURNS TABLE("id" "uuid", "email_mascarado" "text", "commission_percent" numeric, "status" "text", "event_id" "uuid", "evento" "text", "sales" integer, "total_earned" numeric, "created_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select a.id,
         case when length(split_part(u.email, '@', 1)) > 2 then left(u.email, 2) else '*' end
           || '***@' || split_part(u.email, '@', 2),
         a.commission_percent, a.status, a.event_id, e.title, a.sales, a.total_earned, a.created_at
    from public.affiliates a
    join auth.users u on u.id = a.affiliate_user_id
    left join public.events e on e.id = a.event_id
   where a.producer_id = (select auth.uid()) and public.gf_mfa_ok()
   order by a.created_at desc;
$$;


ALTER FUNCTION "public"."listar_afiliados"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."logos_can_upload"("p_name" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."logos_can_upload"("p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."marcar_avisos_lidos"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if auth.uid() is null or not public.gf_mfa_ok() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  update public.mesa_avisos set lido = true where user_id = auth.uid() and not lido;
end;
$$;


ALTER FUNCTION "public"."marcar_avisos_lidos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_avatar_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if current_user in ('anon', 'authenticated') and (
       (tg_op = 'INSERT' and (new.avatar_moderacao is distinct from 'pendente' or new.avatar_moderado_em is not null
                              or new.avatar_moderacao_hash is not null or new.avatar_moderacao_tentativas <> 0
                              or new.avatar_moderacao_reservada_ate is not null))
    or (tg_op = 'UPDATE' and (new.avatar_moderacao is distinct from old.avatar_moderacao
                              or new.avatar_moderado_em is distinct from old.avatar_moderado_em
                              or new.avatar_moderacao_hash is distinct from old.avatar_moderacao_hash
                              or new.avatar_moderacao_tentativas is distinct from old.avatar_moderacao_tentativas
                              or new.avatar_moderacao_reservada_ate is distinct from old.avatar_moderacao_reservada_ate))) then
    raise exception 'Moderação da foto só pelo sistema' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.avatar_url is distinct from old.avatar_url then
    new.avatar_moderacao := 'pendente';
    new.avatar_moderado_em := null;
    new.avatar_moderacao_hash := null;
    new.avatar_moderacao_tentativas := 0;
    new.avatar_moderacao_reservada_ate := null;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."mesa_avatar_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_cartao"("p_user" "uuid", "p_ok" boolean, "p_oculto" boolean) RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select jsonb_build_object(
    'nome', case when p_oculto then 'Lugar ocupado' else split_part(trim(p.full_name), ' ', 1) end,
    -- anos completos (comparar o intervalo de age() com '25 years' erra no fim de mês de 30 dias:
    -- 24 anos, 11 meses e 30 dias conta como 25 anos)
    'faixa_idade', case when p_ok then case
        when date_part('year', age(p.birth_date)) < 25 then '18–24'
        when date_part('year', age(p.birth_date)) < 35 then '25–34'
        when date_part('year', age(p.birth_date)) < 45 then '35–44'
        when date_part('year', age(p.birth_date)) < 60 then '45–59'
        else '60+' end end,
    'foto', case when p_ok then p.avatar_url end,
    'perfil', case when p_ok then x.vibe end,
    'tags', case when p_ok then coalesce(x.tags, '{}'::jsonb) end,
    'escolaridade', case when p_ok then x.education end,
    'rede_social', case when p_ok and x.rede_consent_at is not null and x.rede_consent_revoked_at is null
                        then x.social_url end)
  from public.profiles p
  left join public.user_profiles_ext x on x.user_id = p.id
  where p.id = p_user;
$$;


ALTER FUNCTION "public"."mesa_cartao"("p_user" "uuid", "p_ok" boolean, "p_oculto" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_compat"("a" "jsonb", "b" "jsonb") RETURNS numeric
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  with v as (
    select array_position(array['introvert', 'ambivert', 'extrovert'], a ->> 'temperament') ta,
           array_position(array['introvert', 'ambivert', 'extrovert'], b ->> 'temperament') tb,
           array_position(array['low', 'medium', 'high'], a ->> 'energy_level') ea,
           array_position(array['low', 'medium', 'high'], b ->> 'energy_level') eb,
           a ->> 'intention' ia, b ->> 'intention' ib,
           a ->> 'music_style' ma, b ->> 'music_style' mb
  ),
  xa as (select e.key || ':' || x.v t from jsonb_each(coalesce(a -> 'tags', '{}')) e, jsonb_array_elements_text(e.value) x(v)),
  xb as (select e.key || ':' || x.v t from jsonb_each(coalesce(b -> 'tags', '{}')) e, jsonb_array_elements_text(e.value) x(v))
  select greatest(0, least(100, 50
    + coalesce((2 - abs(ta - tb)) * 15, 0)
    + case when ia = ib then 20
           when ('{"network": ["fun", "experience"], "fun": ["network", "experience"],
                   "experience": ["network", "fun"]}'::jsonb -> ia) ? ib then 10 else 0 end
    + case when ma = mb then 20
           when ('{"eletronica": ["indie", "hiphop"], "rock": ["indie", "pop"], "pop": ["rock", "indie", "hiphop"],
                   "sertanejo": ["pop"], "jazz": ["indie"], "hiphop": ["eletronica", "pop"],
                   "indie": ["rock", "eletronica", "jazz"]}'::jsonb -> ma) ? mb then 10 else 0 end
    + coalesce((2 - abs(ea - eb)) * 10, 0)
    + 10 * coalesce((select count(*) from (select t from xa intersect select t from xb) i)::numeric
                    / nullif((select count(*) from (select t from xa union select t from xb) u), 0), 0)
  ))::numeric
  from v;
$$;


ALTER FUNCTION "public"."mesa_compat"("a" "jsonb", "b" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_conflito"("p_evento" "uuid", "p_denunciado" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select p_denunciado = auth.uid()
      or (exists (select 1 from public.events e where e.id = p_evento and e.producer_id = auth.uid())
          and exists (select 1 from public.team_members tm where tm.producer_id = auth.uid() and tm.user_id = p_denunciado and tm.accepted_at is not null));
$$;


ALTER FUNCTION "public"."mesa_conflito"("p_evento" "uuid", "p_denunciado" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_consent_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if current_user in ('anon', 'authenticated') and (
       (tg_op = 'INSERT' and (new.mesa_consent_version is not null or new.mesa_consent_at is not null
                              or new.mesa_consent_revoked_at is not null
                              or new.rede_consent_at is not null or new.rede_consent_revoked_at is not null))
    or (tg_op = 'UPDATE' and (new.mesa_consent_version is distinct from old.mesa_consent_version
                              or new.mesa_consent_at is distinct from old.mesa_consent_at
                              or new.mesa_consent_revoked_at is distinct from old.mesa_consent_revoked_at
                              or new.rede_consent_at is distinct from old.rede_consent_at
                              or new.rede_consent_revoked_at is distinct from old.rede_consent_revoked_at))) then
    raise exception 'Consentimento da mesa só por mesa_consentir/mesa_revogar/mesa_mostrar_rede/mesa_ocultar_rede'
      using errcode = '42501';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."mesa_consent_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_consentir"("p_versao" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_uid uuid := auth.uid();
  v_versao constant text := public.mesa_termo_versao();
begin
  if v_uid is null or not public.gf_mfa_ok() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if p_versao is distinct from v_versao then
    raise exception 'Versão do termo desatualizada: recarregue a página' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_uid and trim(coalesce(p.full_name, '')) <> '') then
    raise exception 'Para participar, adicione seu nome ao perfil' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles p
                 where p.id = v_uid and p.birth_date <= current_date - interval '18 years') then
    raise exception 'Mesa Tinder é só para maiores de 18: informe sua data de nascimento' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles p
                 where p.id = v_uid and public.mesa_foto_formato(p.avatar_url)) then
    raise exception 'Para participar, adicione sua foto de perfil' using errcode = '22023';
  end if;
  insert into public.user_profiles_ext (user_id, mesa_consent_version, mesa_consent_at, mesa_consent_revoked_at)
  values (v_uid, v_versao, now(), null)
  on conflict (user_id) do update
    set mesa_consent_version = excluded.mesa_consent_version,
        mesa_consent_at = excluded.mesa_consent_at,
        mesa_consent_revoked_at = null;
  insert into public.mesa_consentimentos (user_id, versao, acao) values (v_uid, v_versao, 'consentiu');
end;
$$;


ALTER FUNCTION "public"."mesa_consentir"("p_versao" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_denuncia_liberar"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform public.mesa_moderador();
  update public.mesa_denuncias set liberada_produtor_em = coalesce(liberada_produtor_em, now()),
                                   liberada_por = coalesce(liberada_por, auth.uid())
  where id = p_id and not coalesce(public.mesa_conflito(evento, denunciado), false);
  if not found then
    raise exception 'Denúncia não encontrada' using errcode = '22023';
  end if;
end;
$$;


ALTER FUNCTION "public"."mesa_denuncia_liberar"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_denuncia_que_remove"("p_event_id" "uuid", "p_user" "uuid", "p_produtor" boolean) RETURNS "uuid"
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select d.id
  from public.events e
  join public.mesa_denuncias d on d.evento = e.id
  where e.id = p_event_id and d.denunciado = p_user
    and case when p_produtor then
          d.liberada_produtor_em is not null
          and d.denunciado is distinct from e.producer_id
          and d.denunciante is distinct from e.producer_id
          and d.liberada_por is distinct from auth.uid()
          and not exists (select 1 from public.team_members tm where tm.producer_id = e.producer_id and tm.user_id = d.denunciado and tm.accepted_at is not null)
        else
          not coalesce(public.mesa_conflito(d.evento, d.denunciado), false)
          and d.denunciante is distinct from auth.uid()
          and d.status <> 'aberta'  -- só depois da análise
        end
    and d.resultado is distinct from 'improcedente'  -- resolvida e improcedente nunca vale
  order by d.criado_em desc, d.id
  limit 1;
$$;


ALTER FUNCTION "public"."mesa_denuncia_que_remove"("p_event_id" "uuid", "p_user" "uuid", "p_produtor" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_denuncia_status"("p_id" "uuid", "p_status" "text", "p_resultado" "text" DEFAULT NULL::"text", "p_explicacao" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform public.mesa_moderador();
  -- ponytail: resolver como improcedente só grava a denúncia; quem foi removido por ela continua travado até o
  -- moderador decidir destravar (mesa_destravar). A destrava automática foi tirada de propósito: exigia repetir
  -- a regra de quem removeu e travar contra corrida entre transações. A lista de remoções mostra o resultado.
  if p_status = 'resolvida' and (p_resultado is null or nullif(btrim(p_explicacao, E' \t\r\n'), '') is null) then
    raise exception 'Para marcar como resolvida, informe o resultado (procedente ou improcedente) e a explicação'
      using errcode = '22023';
  end if;
  update public.mesa_denuncias
  set status = p_status, status_mudado_por = auth.uid(), status_mudado_em = now(),
      resultado = case when p_status = 'resolvida' then p_resultado end,
      resultado_explicacao = case when p_status = 'resolvida' then btrim(p_explicacao, E' \t\r\n') end
  where id = p_id and not coalesce(public.mesa_conflito(evento, denunciado), false);
  if not found then
    raise exception 'Denúncia não encontrada' using errcode = '22023';
  end if;
end;
$$;


ALTER FUNCTION "public"."mesa_denuncia_status"("p_id" "uuid", "p_status" "text", "p_resultado" "text", "p_explicacao" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_denunciar"("p_membro" "uuid", "p_motivo" "text", "p_detalhe" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_uid uuid := auth.uid();
  v_alvo public.mesa_passagens;
  v_ini timestamptz;
  v_fim timestamptz;
begin
  if v_uid is null or not public.gf_mfa_ok() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  select p.* into v_alvo from public.mesa_passagens p where p.membro_id = p_membro order by p.entrou_em desc limit 1;
  if v_alvo.id is null or v_alvo.user_id = v_uid
     or not (exists (select 1 from public.tickets t join public.ticket_types tt on tt.id = t.ticket_type_id
                     where t.event_id = v_alvo.evento and t.user_id = v_uid and tt.type = 'coletiva'
                       and t.status in ('active', 'used'))
             or exists (select 1 from public.mesa_passagens p where p.user_id = v_uid and p.evento = v_alvo.evento)) then
    raise exception 'Pessoa não encontrada' using errcode = '22023';
  end if;
  -- duas denúncias da mesma pessoa ao mesmo tempo: uma espera a outra (limite de 5)
  perform pg_advisory_xact_lock(hashtext('mesa_denuncia:' || v_uid || ':' || v_alvo.evento));
  if exists (select 1 from public.mesa_denuncias d
             where d.denunciante = v_uid and d.denunciado = v_alvo.user_id and d.evento = v_alvo.evento) then
    return jsonb_build_object('ja_denunciado', true);
  end if;
  if (select count(*) from public.mesa_denuncias d where d.denunciante = v_uid and d.evento = v_alvo.evento) >= 5 then
    raise exception 'Limite de 5 denúncias por evento' using errcode = '22023';
  end if;
  -- período em que estiveram juntos na mesma mesa (do primeiro encontro ao último; quem ainda está
  -- junto conta até a hora da denúncia)
  select min(greatest(a.entrou_em, b.entrou_em)),
         max(least(coalesce(a.saiu_em, clock_timestamp()), coalesce(b.saiu_em, clock_timestamp())))
    into v_ini, v_fim
  from public.mesa_passagens a join public.mesa_passagens b on b.table_id = a.table_id
  where a.user_id = v_uid and b.user_id = v_alvo.user_id and a.evento = v_alvo.evento
    and a.entrou_em < coalesce(b.saiu_em, 'infinity') and b.entrou_em < coalesce(a.saiu_em, 'infinity');
  if p_motivo = 'assedio' and v_ini is null then
    raise exception 'Assédio só pode ser denunciado por quem esteve na mesma mesa ao mesmo tempo' using errcode = '22023';
  end if;
  insert into public.mesa_denuncias (denunciante, denunciado, denunciante_nome, denunciado_nome, evento, evento_em,
                                     table_id, mesa, motivo, detalhe, mesma_mesa, sobreposicao_inicio, sobreposicao_fim)
  select v_uid, v_alvo.user_id, pa.full_name, pb.full_name, v_alvo.evento, public.evento_momento(e),
         v_alvo.table_id, (select c.name from public.collective_tables c where c.id = v_alvo.table_id),
         p_motivo, nullif(trim(p_detalhe), ''), v_ini is not null, v_ini, v_fim
  from public.events e
  join public.profiles pa on pa.id = v_uid
  join public.profiles pb on pb.id = v_alvo.user_id
  where e.id = v_alvo.evento;
  return jsonb_build_object('ok', true);
end;
$$;


ALTER FUNCTION "public"."mesa_denunciar"("p_membro" "uuid", "p_motivo" "text", "p_detalhe" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_denuncias_do_evento"("p_event_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_produtor uuid := (select e.producer_id from public.events e where e.id = p_event_id);
begin
  if not public.gf_mfa_ok() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if public.gf_admin_can('moderate_mesa') then
    perform public.mesa_moderador();
    return coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', d.id, 'criado_em', d.criado_em, 'motivo', d.motivo, 'detalhe', d.detalhe, 'status', d.status,
               'mesa', d.mesa, 'denunciante', d.denunciante_nome, 'denunciado', d.denunciado_nome,
               'mesma_mesa', d.mesma_mesa, 'sobreposicao_inicio', d.sobreposicao_inicio,
               'sobreposicao_fim', d.sobreposicao_fim, 'status_mudado_em', d.status_mudado_em,
               'liberada_produtor_em', d.liberada_produtor_em, 'resultado', d.resultado,
               'resultado_explicacao', d.resultado_explicacao)
             order by d.criado_em desc, d.id)
      from public.mesa_denuncias d
      where d.evento = p_event_id and not coalesce(public.mesa_conflito(d.evento, d.denunciado), false)
    ), '[]'::jsonb);
  end if;
  if v_produtor is distinct from auth.uid() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('denunciado', d.denunciado_nome, 'motivo', d.motivo, 'mesa', d.mesa, 'resultado', d.resultado)
                     order by d.criado_em desc, d.id)
    from public.mesa_denuncias d
    where d.evento = p_event_id and d.liberada_produtor_em is not null and d.denunciado is distinct from v_produtor
      and not exists (select 1 from public.team_members tm where tm.producer_id = v_produtor and tm.user_id = d.denunciado and tm.accepted_at is not null)
  ), '[]'::jsonb);
end;
$$;


ALTER FUNCTION "public"."mesa_denuncias_do_evento"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_destravar"("p_event_id" "uuid", "p_trava_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform public.mesa_moderador();
  update public.mesa_travas set destravada_por = auth.uid(), destravada_em = now()
  where id = p_trava_id and evento = p_event_id and destravada_em is null
    and not coalesce(public.mesa_conflito(evento, user_id), false);
  if not found then
    raise exception 'Trava não encontrada' using errcode = '22023';
  end if;
end;
$$;


ALTER FUNCTION "public"."mesa_destravar"("p_event_id" "uuid", "p_trava_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_foto_contestar"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_uid uuid := auth.uid();
  v_hash text;
begin
  if v_uid is null or not public.gf_mfa_ok() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  select public.mesa_foto_hash(p.avatar_url) into v_hash from public.profiles p
  where p.id = v_uid and p.avatar_moderacao = 'recusada' and p.avatar_moderacao_hash = public.mesa_foto_hash(p.avatar_url);
  if v_hash is null
     or exists (select 1 from public.mesa_moderacoes m where m.user_id = v_uid and m.hash = v_hash and m.decisao = 'contestada')
     or (select m.decisao from public.mesa_moderacoes m where m.user_id = v_uid and m.hash = v_hash
         order by m.id desc limit 1) is distinct from 'recusada' then
    return false;
  end if;
  -- primeiro a mudança de estado, com a foto conferida de novo (trocada no meio: nada é gravado)
  update public.profiles p set avatar_moderacao = 'revisar', avatar_moderado_em = now()
  where p.id = v_uid and p.avatar_moderacao = 'recusada' and public.mesa_foto_hash(p.avatar_url) = v_hash;
  if not found then
    return false;
  end if;
  insert into public.mesa_moderacoes (user_id, hash, decisao) values (v_uid, v_hash, 'contestada');
  return true;
end;
$$;


ALTER FUNCTION "public"."mesa_foto_contestar"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_foto_decidir"("p_user" "uuid", "p_hash" "text", "p_aprovada" boolean) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform public.mesa_moderador();
  update public.profiles p set
    avatar_moderacao = case when p_aprovada then 'aprovada' else 'recusada' end,
    avatar_moderado_em = now(),
    avatar_moderacao_hash = p_hash
  where p.id = p_user and p.id is distinct from auth.uid() and public.mesa_foto_hash(p.avatar_url) = p_hash and p_aprovada is not null
    and (p.avatar_moderacao in ('pendente', 'revisar') or (p.avatar_moderacao = 'aprovada' and not p_aprovada));
  return found;
end;
$$;


ALTER FUNCTION "public"."mesa_foto_decidir"("p_user" "uuid", "p_hash" "text", "p_aprovada" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_foto_formato"("p" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $_$
  -- até 60.000 caracteres (a foto do app, 150×150 em JPEG, fica bem abaixo); o tamanho antes da regex
  select case when length(p) > 60000 then false
              else coalesce(p ~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$', false) end
$_$;


ALTER FUNCTION "public"."mesa_foto_formato"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_foto_hash"("p" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$ select encode(sha256(convert_to(p, 'UTF8')), 'hex') $$;


ALTER FUNCTION "public"."mesa_foto_hash"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_foto_na_fila"("p_user" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
    from public.profiles p
    join public.user_profiles_ext x on x.user_id = p.id
    where p.id = p_user and p.avatar_moderacao = 'pendente' and public.mesa_foto_formato(p.avatar_url)
      and x.mesa_consent_at is not null and x.mesa_consent_revoked_at is null
      and x.mesa_consent_version = public.mesa_termo_versao()
      and p.avatar_moderacao_tentativas < 3
      and (p.avatar_moderacao_reservada_ate is null or p.avatar_moderacao_reservada_ate < now())
      and (select count(*) from public.mesa_moderacoes m
           where m.user_id = p.id and m.em > now() - interval '24 hours' and m.decisao <> 'contestada') < 5);
$$;


ALTER FUNCTION "public"."mesa_foto_na_fila"("p_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_foto_resultado_auto"("p_user" "uuid", "p_hash" "text", "p_decisao" "text", "p_motivos" "text"[], "p_modelo" "text", "p_tokens_in" integer, "p_tokens_out" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if p_decisao is null or p_decisao not in ('aprovada', 'recusada', 'revisar', 'erro') then
    raise exception 'Decisão inválida' using errcode = '22023';
  end if;
  insert into public.mesa_moderacoes (user_id, hash, decisao, motivos, modelo, tokens_in, tokens_out, custo)
  select p.id, p_hash, p_decisao, coalesce(p_motivos, '{}'), p_modelo, p_tokens_in, p_tokens_out,
         public.ai_custo(p_modelo, p_tokens_in, p_tokens_out)
  from public.profiles p where p.id = p_user;
  if p_decisao = 'erro' then
    update public.profiles p set
      avatar_moderacao_tentativas = p.avatar_moderacao_tentativas + 1,
      avatar_moderacao_reservada_ate = null,
      avatar_moderacao = case when p.avatar_moderacao_tentativas + 1 >= 3 then 'revisar' else p.avatar_moderacao end,
      avatar_moderado_em = case when p.avatar_moderacao_tentativas + 1 >= 3 then now() else p.avatar_moderado_em end
    where p.id = p_user and public.mesa_foto_hash(p.avatar_url) = p_hash and p.avatar_moderacao = 'pendente';
  else
    update public.profiles p set
      avatar_moderacao = p_decisao,
      avatar_moderacao_hash = p_hash,
      avatar_moderado_em = now(),
      avatar_moderacao_tentativas = 0,
      avatar_moderacao_reservada_ate = null
    where p.id = p_user and public.mesa_foto_hash(p.avatar_url) = p_hash and p.avatar_moderacao = 'pendente';
  end if;
  return found;
end;
$$;


ALTER FUNCTION "public"."mesa_foto_resultado_auto"("p_user" "uuid", "p_hash" "text", "p_decisao" "text", "p_motivos" "text"[], "p_modelo" "text", "p_tokens_in" integer, "p_tokens_out" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_fotos_para_moderar_auto"("p_limite" integer DEFAULT 20) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_teto constant int := 500;
  v_modelo text := (select s.model_simple from public.ai_settings s where s.id = 1);
  v_feitas int;
  v_n int;
  v_fotos jsonb;
begin
  if not public.mesa_ia_ligada() then
    return jsonb_build_object('modelo', v_modelo, 'fotos', '[]'::jsonb);
  end if;
  -- desde a meia-noite de São Paulo (usa o índice de em)
  select count(*) into v_feitas from public.mesa_moderacoes m
  where m.em >= date_trunc('day', now(), 'America/Sao_Paulo') and m.decisao not in ('erro', 'contestada');
  v_n := least(greatest(coalesce(p_limite, 20), 0), v_teto - v_feitas);
  if v_n <= 0 then
    return jsonb_build_object('modelo', v_modelo, 'fotos', '[]'::jsonb);
  end if;
  -- Reserva e tentativas repetidas aqui: mesa_foto_na_fila enxerga o banco do início do comando, e
  -- depois do "skip locked" a linha travada é relida; sem isto, duas rodadas simultâneas poderiam
  -- reservar a mesma foto. Ordem: quem nunca foi reservado primeiro e a reservada há mais tempo
  -- depois (a foto que interrompeu uma rodada vai para o fim e não trava o lote).
  with alvo as (
    select p.id
    from public.user_profiles_ext x
    join public.profiles p on p.id = x.user_id
    where x.mesa_consent_at is not null and x.mesa_consent_revoked_at is null
      and p.avatar_moderacao = 'pendente'
      and (p.avatar_moderacao_reservada_ate is null or p.avatar_moderacao_reservada_ate < now())
      and p.avatar_moderacao_tentativas < 3
      and public.mesa_foto_na_fila(p.id)
    order by p.avatar_moderacao_reservada_ate nulls first, p.avatar_moderacao_tentativas, p.id
    limit v_n
    for update of p skip locked
  ), reservadas as (
    update public.profiles p set avatar_moderacao_reservada_ate = now() + interval '5 minutes'
    from alvo where p.id = alvo.id
    returning p.id, p.avatar_url
  )
  select coalesce(jsonb_agg(jsonb_build_object('user', r.id, 'hash', public.mesa_foto_hash(r.avatar_url), 'foto', r.avatar_url)
                            order by r.id), '[]'::jsonb)
    into v_fotos
  from reservadas r;
  return jsonb_build_object('modelo', v_modelo, 'fotos', v_fotos);
end;
$$;


ALTER FUNCTION "public"."mesa_fotos_para_moderar_auto"("p_limite" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_fotos_para_revisar"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform public.mesa_moderador();
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.full_name, 'foto', p.avatar_url, 'hash', public.mesa_foto_hash(p.avatar_url),
                                        'situacao', p.avatar_moderacao,
                                        -- a última decisão da IA para esta mesma foto, se houver
                                        'ia', (select jsonb_build_object('decisao', m.decisao, 'motivos', m.motivos, 'em', m.em)
                                               from public.mesa_moderacoes m
                                               where m.user_id = p.id and m.hash = public.mesa_foto_hash(p.avatar_url)
                                                 and m.decisao <> 'contestada'
                                               order by m.id desc limit 1),
                                        -- a pessoa contestou a recusa automática desta foto (mesa_foto_contestar)
                                        'contestada', exists (select 1 from public.mesa_moderacoes m
                                                              where m.user_id = p.id and m.hash = public.mesa_foto_hash(p.avatar_url)
                                                                and m.decisao = 'contestada'))
                     order by p.full_name, p.id)
    from public.profiles p
    join public.user_profiles_ext x on x.user_id = p.id
    where p.avatar_moderacao in ('pendente', 'revisar') and public.mesa_foto_formato(p.avatar_url)
      and p.id is distinct from auth.uid()
      and x.mesa_consent_at is not null and x.mesa_consent_revoked_at is null
  ), '[]'::jsonb);
end;
$$;


ALTER FUNCTION "public"."mesa_fotos_para_revisar"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_ia_ligada"() RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$ select coalesce((select s.enabled from public.ai_settings s where s.id = 1), false) $$;


ALTER FUNCTION "public"."mesa_ia_ligada"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_idade_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_evento uuid;
begin
  -- check-in, cancelamento e outras trocas de status: nada a checar; só a volta para active/used
  if tg_op = 'UPDATE' and new.ticket_type_id is not distinct from old.ticket_type_id
     and new.user_id is not distinct from old.user_id
     and (new.status not in ('active', 'used') or old.status in ('active', 'used')) then
    return new;
  end if;
  select tt.event_id into v_evento from public.ticket_types tt where tt.id = new.ticket_type_id and tt.type = 'coletiva';
  if not found then
    return new;
  end if;
  -- dois webhooks ao mesmo tempo para a mesma pessoa e evento: um espera o outro (até o commit)
  perform pg_advisory_xact_lock(hashtext('mesa_conta:' || new.user_id || ':' || v_evento));
  if not exists (select 1 from public.profiles p
                 where p.id = new.user_id and p.birth_date <= current_date - interval '18 years') then
    raise exception 'Mesa coletiva: informe sua data de nascimento (só maiores de 18)' using errcode = '22023';
  end if;
  if exists (select 1 from public.tickets t
             join public.ticket_types tt on tt.id = t.ticket_type_id
             where t.user_id = new.user_id and tt.event_id = v_evento and tt.type = 'coletiva'
               and t.status in ('active', 'used') and t.id <> new.id) then
    raise exception 'Mesa Tinder: 1 lugar por conta em cada evento' using errcode = '22023';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."mesa_idade_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_moderacao_secret"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select d.decrypted_secret from vault.decrypted_secrets d where d.name = 'mesa_moderacao_secret' limit 1;
$$;


ALTER FUNCTION "public"."mesa_moderacao_secret"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_moderador"() RETURNS "void"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
begin
  if not public.gf_admin_can('moderate_mesa') then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'Ative o 2FA para moderar' using errcode = '42501';
  end if;
end;
$$;


ALTER FUNCTION "public"."mesa_moderador"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_mostrar_rede"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.gf_mfa_ok() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  update public.user_profiles_ext x set rede_consent_at = now(), rede_consent_revoked_at = null
  where x.user_id = v_uid and x.mesa_consent_at is not null and x.mesa_consent_revoked_at is null
    and x.mesa_consent_version = public.mesa_termo_versao();
  if not found then
    raise exception 'Aceite primeiro o termo da Mesa Tinder' using errcode = '22023';
  end if;
  insert into public.mesa_consentimentos (user_id, versao, acao) values (v_uid, public.mesa_termo_versao(), 'mostrou_rede');
end;
$$;


ALTER FUNCTION "public"."mesa_mostrar_rede"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_ocultar_rede"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.gf_mfa_ok() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  update public.user_profiles_ext x set rede_consent_revoked_at = now()
  where x.user_id = v_uid and x.rede_consent_at is not null and x.rede_consent_revoked_at is null;
  if found then
    insert into public.mesa_consentimentos (user_id, versao, acao) values (v_uid, public.mesa_termo_versao(), 'ocultou_rede');
  end if;
end;
$$;


ALTER FUNCTION "public"."mesa_ocultar_rede"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_ocupados"("p_mesa" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select count(*)::int
  from public.table_members m
  join public.tickets t on t.id = m.ticket_id
  where m.table_id = p_mesa and t.user_id = m.user_id and t.status in ('active', 'used');
$$;


ALTER FUNCTION "public"."mesa_ocupados"("p_mesa" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_ok"("p_user" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
    from public.user_profiles_ext x
    join public.profiles p on p.id = x.user_id
    where x.user_id = p_user
      and x.mesa_consent_at is not null and x.mesa_consent_revoked_at is null
      and x.mesa_consent_version = public.mesa_termo_versao()
      and p.birth_date <= current_date - interval '18 years'
      and trim(coalesce(p.full_name, '')) <> ''
      and public.mesa_foto_formato(p.avatar_url)
      and p.avatar_moderacao = 'aprovada' and p.avatar_moderacao_hash = public.mesa_foto_hash(p.avatar_url));
$$;


ALTER FUNCTION "public"."mesa_ok"("p_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_passagem"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if tg_op = 'UPDATE' and new.table_id is not distinct from old.table_id then
    return null;
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    update public.mesa_passagens set saiu_em = clock_timestamp() where membro_id = old.id and saiu_em is null;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    insert into public.mesa_passagens (membro_id, user_id, ticket_id, evento, table_id, entrou_em)
    select new.id, new.user_id, new.ticket_id, c.event_id, new.table_id, clock_timestamp()
    from public.collective_tables c where c.id = new.table_id;
    -- só quem ainda tem ingresso active/used dele (reembolsado ou transferido não é avisado)
    insert into public.mesa_avisos (user_id, evento, table_id, mesa, tipo)
    select distinct p.user_id, p.evento, p.table_id, c.name, 'entrou'
    from public.mesa_passagens p
    join public.collective_tables c on c.id = p.table_id
    join public.tickets t on t.id = p.ticket_id and t.user_id = p.user_id and t.status in ('active', 'used')
    where p.table_id = new.table_id and p.saiu_em is null and p.user_id <> new.user_id
      and p.entrou_em < statement_timestamp()
    on conflict (user_id, table_id, tipo) where not lido do nothing;
  end if;
  return null;
end;
$$;


ALTER FUNCTION "public"."mesa_passagem"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_pedido_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_evento uuid;
  v_user uuid;
begin
  select tt.event_id into v_evento from public.ticket_types tt where tt.id = new.ticket_type_id and tt.type = 'coletiva';
  if not found then
    return new;
  end if;
  if new.quantity is distinct from 1 then
    raise exception 'Mesa Tinder: 1 lugar por conta em cada evento (quantidade deve ser 1)' using errcode = '22023';
  end if;
  select o.user_id into v_user from public.orders o where o.id = new.order_id;
  perform pg_advisory_xact_lock(hashtext('mesa_conta:' || v_user || ':' || v_evento));
  if not exists (select 1 from public.profiles p
                 where p.id = v_user and p.birth_date <= current_date - interval '18 years') then
    raise exception 'Mesa coletiva: informe sua data de nascimento (só maiores de 18)' using errcode = '22023';
  end if;
  if exists (select 1 from public.order_items oi
             join public.ticket_types tt on tt.id = oi.ticket_type_id
             where oi.order_id = new.order_id and tt.type = 'coletiva' and oi.id is distinct from new.id) then
    raise exception 'Mesa Tinder: 1 lugar por conta em cada evento (o pedido já tem uma mesa coletiva)' using errcode = '22023';
  end if;
  if exists (select 1 from public.tickets t
             join public.ticket_types tt on tt.id = t.ticket_type_id
             where t.user_id = v_user and tt.event_id = v_evento and tt.type = 'coletiva'
               and t.status in ('active', 'used')) then
    raise exception 'Mesa Tinder: 1 lugar por conta em cada evento (você já tem um nesta mesa coletiva)' using errcode = '22023';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."mesa_pedido_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_perfil"("p_user" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select jsonb_build_object(
    'temperament', coalesce(x.temperament, 'ambivert'),
    'energy_level', coalesce(x.energy_level, 'medium'),
    'intention', x.intention,
    'music_style', x.music_style,
    'tags', coalesce(x.tags, '{}'::jsonb))
  from public.user_profiles_ext x
  where x.user_id = p_user and public.mesa_ok(p_user);
$$;


ALTER FUNCTION "public"."mesa_perfil"("p_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_recalcular"("p_mesa" "uuid") RETURNS "void"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
  update public.collective_tables c set
    status = case when c.status = 'closed' then 'closed'
                  when public.mesa_ocupados(c.id) >= c.capacity then 'full' else 'open' end,
    compatibility_score = (
      select round(avg(public.mesa_compat(pa.p, pb.p)), 1)
      from public.table_members a
      join public.table_members b on b.table_id = a.table_id and a.ticket_id < b.ticket_id
      cross join lateral (select public.mesa_perfil(a.user_id) p) pa
      cross join lateral (select public.mesa_perfil(b.user_id) p) pb
      where a.table_id = c.id and pa.p is not null and pb.p is not null)
  where c.id = p_mesa;
$$;


ALTER FUNCTION "public"."mesa_recalcular"("p_mesa" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_remover_membro"("p_event_id" "uuid", "p_ticket_id" "uuid", "p_motivo" "text", "p_detalhe" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user uuid;
  v_mesa uuid;
  v_nome text;
  v_trava uuid;
  v_produtor boolean;
  v_denuncia uuid;
begin
  if not public.gf_mfa_ok() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  v_produtor := exists (select 1 from public.events e where e.id = p_event_id and e.producer_id = (select auth.uid()));
  if not v_produtor then
    perform public.mesa_moderador();
  end if;
  select t.user_id into v_user from public.tickets t join public.ticket_types tt on tt.id = t.ticket_type_id
  where t.id = p_ticket_id and t.event_id = p_event_id and tt.type = 'coletiva';
  if v_user is null then
    raise exception 'Ingresso não encontrado neste evento' using errcode = '22023';
  end if;
  if p_motivo = 'pedido_da_pessoa' then
    -- só vale no CHECK (dado antigo); quem quer sair usa mesa_sair
    raise exception 'Motivo inválido: sem denúncia ninguém é removido; quem quer sair usa "sair da mesa"' using errcode = '22023';
  end if;
  -- (quem é produtor do evento e também moderador vale como produtor)
  v_denuncia := public.mesa_denuncia_que_remove(p_event_id, v_user, v_produtor);
  if v_denuncia is null then
    raise exception 'Só é possível remover quem tem denúncia neste evento' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('formar_mesas:' || p_event_id));
  insert into public.mesa_travas (evento, user_id, ticket_id, motivo, detalhe, por, denuncia_id)
  values (p_event_id, v_user, p_ticket_id, p_motivo, nullif(trim(p_detalhe), ''), auth.uid(), v_denuncia)
  on conflict (evento, user_id) where destravada_em is null do nothing
  returning id into v_trava;  -- nulo quando já havia trava vigente
  delete from public.table_members m where m.ticket_id = p_ticket_id returning m.table_id into v_mesa;
  if v_mesa is not null then
    select c.name into v_nome from public.collective_tables c where c.id = v_mesa;
    if public.mesa_ocupados(v_mesa) = 0 then
      delete from public.collective_tables c where c.id = v_mesa;
    else
      perform public.mesa_recalcular(v_mesa);
    end if;
  end if;
  -- aviso só quando algo mudou (trava nova ou saída da mesa).
  -- ponytail: a 2ª remoção com trava vigente não é registrada em lugar nenhum (B2); guardar um
  -- histórico de remoções se a organização precisar dele.
  if v_trava is not null or v_mesa is not null then
    insert into public.mesa_avisos (user_id, evento, table_id, mesa, tipo)
    values (v_user, p_event_id, v_mesa, v_nome, 'removido')
    on conflict (user_id, table_id, tipo) where not lido do nothing;
  end if;
end;
$$;


ALTER FUNCTION "public"."mesa_remover_membro"("p_event_id" "uuid", "p_ticket_id" "uuid", "p_motivo" "text", "p_detalhe" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_revogar"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_uid uuid := auth.uid();
  v_versao text;
begin
  if v_uid is null or not public.gf_mfa_ok() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  update public.user_profiles_ext x set
    mesa_consent_revoked_at = now(),
    rede_consent_revoked_at = case when x.rede_consent_at is not null then now() end,
    tags = null, social_url = null, education = null, temperament = null, intention = null,
    music_style = null, energy_level = null, vibe = null, gender = null, bio = null,
    birth_year = null, quiz_completed_at = null
  where x.user_id = v_uid
  returning x.mesa_consent_version into v_versao;
  if found then
    insert into public.mesa_consentimentos (user_id, versao, acao) values (v_uid, v_versao, 'revogou');
  end if;
  update public.collective_tables c set compatibility_score = null
  where c.id in (select m.table_id from public.table_members m where m.user_id = v_uid);
end;
$$;


ALTER FUNCTION "public"."mesa_revogar"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_sair"("p_event_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if auth.uid() is null or not public.gf_mfa_ok() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  update public.table_members m set oculto = true
  from public.collective_tables c
  where c.id = m.table_id and c.event_id = p_event_id and m.user_id = auth.uid();
  if not found then
    raise exception 'Você ainda não tem mesa neste evento' using errcode = '22023';
  end if;
end;
$$;


ALTER FUNCTION "public"."mesa_sair"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_tags_ok"("p" "jsonb") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  select jsonb_typeof(p) = 'object' and not exists (
    select 1
    from jsonb_each(p) e
    left join (values
      ('musica', array['sertanejo', 'funk', 'rock', 'pop', 'eletronica', 'mpb', 'samba_pagode', 'forro',
                       'rap_trap', 'jazz_blues', 'indie', 'reggae', 'kpop']),
      ('comida', array['brasileira', 'churrasco', 'japonesa', 'italiana', 'mexicana', 'arabe', 'chinesa',
                       'nordestina', 'hamburguer', 'pizza', 'frutos_do_mar', 'doces', 'boteco']),
      ('passeios', array['praia', 'trilha', 'cachoeira', 'parque', 'museu', 'teatro', 'cinema', 'show',
                         'balada', 'barzinho', 'feira', 'stand_up']),
      ('viagem', array['praia', 'serra', 'campo', 'cidade_grande', 'exterior', 'mochilao', 'cruzeiro',
                       'estrada', 'ecoturismo', 'gastronomica', 'festivais']),
      ('filmes', array['acao', 'comedia', 'drama', 'terror', 'suspense', 'ficcao_cientifica', 'romance',
                       'animacao', 'documentario', 'fantasia', 'policial', 'musical', 'series']),
      ('idiomas', array['ingles', 'espanhol', 'frances', 'italiano', 'alemao', 'japones', 'mandarim',
                        'coreano', 'russo']),
      ('hobbies', array['academia', 'corrida', 'futebol', 'ciclismo', 'games', 'leitura', 'fotografia',
                        'culinaria', 'danca', 'tocar_instrumento', 'desenho_pintura', 'jardinagem', 'pets',
                        'jogos_de_tabuleiro'])
    ) l(cat, ok) on l.cat = e.key
    where l.cat is null
       -- case: jsonb_array_length em valor que não é array daria erro em vez de "inválido"
       or case when jsonb_typeof(e.value) <> 'array' then true
          else jsonb_array_length(e.value) > 8
            or exists (select 1 from jsonb_array_elements(e.value) x(v)
                       where jsonb_typeof(x.v) <> 'string' or not (x.v #>> '{}') = any(l.ok))
            or (select count(distinct x.v) from jsonb_array_elements(e.value) x(v)) <> jsonb_array_length(e.value)
          end
  );
$$;


ALTER FUNCTION "public"."mesa_tags_ok"("p" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_tem_foto_para_moderar"() RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  -- primeiro quem tem consentimento vigente (o conjunto pequeno), depois o filtro completo
  select public.mesa_ia_ligada()
     and exists (select 1
                 from public.user_profiles_ext x
                 join public.profiles p on p.id = x.user_id and p.avatar_moderacao = 'pendente'
                 where x.mesa_consent_at is not null and x.mesa_consent_revoked_at is null
                   and public.mesa_foto_na_fila(p.id));
$$;


ALTER FUNCTION "public"."mesa_tem_foto_para_moderar"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_termo_versao"() RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$ select '2026-10-03' $$;


ALTER FUNCTION "public"."mesa_termo_versao"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_tipo_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if (old.type = 'coletiva') is distinct from (new.type = 'coletiva')
     and (exists (select 1 from public.order_items oi where oi.ticket_type_id = old.id)
          or exists (select 1 from public.tickets t where t.ticket_type_id = old.id)) then
    raise exception 'Não dá para mudar para/de Mesa Tinder depois de vender' using errcode = '22023';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."mesa_tipo_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_travado"("p_evento" "uuid", "p_user" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select exists (select 1 from public.mesa_travas tr
                 where tr.evento = p_evento and tr.user_id = p_user and tr.destravada_em is null);
$$;


ALTER FUNCTION "public"."mesa_travado"("p_evento" "uuid", "p_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_travas_do_evento"("p_event_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform public.mesa_moderador();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', tr.id, 'pessoa', pu.full_name, 'motivo', tr.motivo, 'detalhe', tr.detalhe, 'denuncia_id', tr.denuncia_id, 'denuncia_motivo', dn.motivo, 'denuncia_resultado', dn.resultado,
             'por', pp.full_name, 'em', tr.em, 'destravada_em', tr.destravada_em, 'destravada_por', pd.full_name)
           order by tr.em desc, tr.id)
    from public.mesa_travas tr
    left join public.profiles pu on pu.id = tr.user_id
    left join public.profiles pp on pp.id = tr.por
    left join public.profiles pd on pd.id = tr.destravada_por
    left join public.mesa_denuncias dn on dn.id = tr.denuncia_id
    where tr.evento = p_event_id and not coalesce(public.mesa_conflito(tr.evento, tr.user_id), false)
  ), '[]'::jsonb);
end;
$$;


ALTER FUNCTION "public"."mesa_travas_do_evento"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesa_voltar"("p_event_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if auth.uid() is null or not public.gf_mfa_ok() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  update public.table_members m set oculto = false
  from public.collective_tables c
  where c.id = m.table_id and c.event_id = p_event_id and m.user_id = auth.uid();
  if not found then
    raise exception 'Você ainda não tem mesa neste evento' using errcode = '22023';
  end if;
end;
$$;


ALTER FUNCTION "public"."mesa_voltar"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesas_do_evento"("p_event_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_produtor boolean;
begin
  if not public.gf_mfa_ok() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  v_produtor := exists (select 1 from public.events e where e.id = p_event_id and e.producer_id = (select auth.uid()));
  if not v_produtor then
    -- admin só com moderate_mesa e sessão aal2 (auditoria do PR C): o nome completo de todas as mesas
    perform public.mesa_moderador();
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'numero', substring(c.name from '[0-9]+')::int,
             'nome', c.name,
             'capacidade', c.capacity,
             'membros', (
               -- o nome do dono atual do ingresso (transferido: o novo dono), nunca o de quem comprou
               select coalesce(jsonb_agg(jsonb_build_object('nome', coalesce(nullif(trim(p.full_name), ''), '(sem nome no perfil)'),
                                                            'ingresso', t.id,
                                                            'pode_remover', public.mesa_denuncia_que_remove(p_event_id, t.user_id, v_produtor) is not null)
                                         order by p.full_name, t.id), '[]'::jsonb)
               from public.table_members m
               join public.tickets t on t.id = m.ticket_id
               left join public.profiles p on p.id = t.user_id
               where m.table_id = c.id and t.status in ('active', 'used') and t.user_id = m.user_id)
           ) order by substring(c.name from '[0-9]+')::int)
    from public.collective_tables c
    where c.event_id = p_event_id
  ), '[]'::jsonb);
end;
$$;


ALTER FUNCTION "public"."mesas_do_evento"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesas_para_escolher"("p_event_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_uid uuid := auth.uid();
  v_ticket uuid;
  v_tipo uuid;
  v_mesa uuid;
  v_saiu boolean;
begin
  if v_uid is null or not public.gf_mfa_ok() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  select t.id, t.ticket_type_id into v_ticket, v_tipo
  from public.tickets t join public.ticket_types tt on tt.id = t.ticket_type_id
  where t.event_id = p_event_id and t.user_id = v_uid and tt.type = 'coletiva' and t.status in ('active', 'used')
  order by t.created_at limit 1;
  if v_ticket is null then
    return jsonb_build_object('mesas', '[]'::jsonb, 'motivo', 'sem_ingresso');
  end if;
  if (select public.evento_momento(e) from public.events e where e.id = p_event_id) - now() < interval '2 hours' then
    return jsonb_build_object('mesas', '[]'::jsonb, 'motivo', 'fora_do_prazo');
  end if;
  if public.mesa_travado(p_event_id, v_uid) then
    return jsonb_build_object('mesas', '[]'::jsonb, 'motivo', 'travado');
  end if;
  if not public.mesa_ok(v_uid) then
    return jsonb_build_object('mesas', '[]'::jsonb, 'motivo', 'sem_perfil');
  end if;
  select m.table_id, m.oculto into v_mesa, v_saiu
  from public.table_members m where m.ticket_id = v_ticket and m.user_id = v_uid;
  if v_saiu then
    return jsonb_build_object('mesas', '[]'::jsonb, 'motivo', 'saiu');
  end if;

  return jsonb_build_object('mesas', coalesce((
    select jsonb_agg(jsonb_build_object(
             'numero', substring(c.name from '[0-9]+')::int,
             'vagas', c.capacity - o.n,
             'pessoas', coalesce(pes.lista, '[]'::jsonb),
             'etiquetas', case when (select count(*) from jsonb_array_elements(pes.lista) x
                                     where jsonb_typeof(x -> 'tags') = 'object') >= 3 then (
               select coalesce(jsonb_agg(jsonb_build_object('categoria', s.cat, 'etiqueta', s.tag, 'pessoas', s.n)
                                         order by s.n desc, s.cat, s.tag), '[]'::jsonb)
               from (select e.key cat, v.tag, count(*)::int n
                     from jsonb_array_elements(pes.lista) x, jsonb_each(x -> 'tags') e, jsonb_array_elements_text(e.value) v(tag)
                     where jsonb_typeof(x -> 'tags') = 'object'
                     group by e.key, v.tag) s) end)
           order by substring(c.name from '[0-9]+')::int)
    from public.collective_tables c
    cross join lateral (select public.mesa_ocupados(c.id) n) o
    cross join lateral (
      select jsonb_agg(public.mesa_cartao(m.user_id, k.ok, not k.ok)
                       || jsonb_build_object('id', case when k.ok then m.id end)
                       order by not k.ok, m.joined_at, m.id) lista
      from public.table_members m
      join public.tickets t on t.id = m.ticket_id
      cross join lateral (select not m.oculto and public.mesa_ok(m.user_id) ok) k
      where m.table_id = c.id and t.user_id = m.user_id and t.status in ('active', 'used')) pes
    where c.event_id = p_event_id and c.ticket_type_id = v_tipo and c.status <> 'closed'
      and c.id is distinct from v_mesa and o.n < c.capacity
  ), '[]'::jsonb));
end;
$$;


ALTER FUNCTION "public"."mesas_para_escolher"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."meu_organizador_publico"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if (select auth.uid()) is null then raise exception 'sem sessão' using errcode = '42501'; end if;
  if not public.gf_mfa_ok() then
    raise exception 'Reautenticação de dois fatores necessária.' using errcode = '42501';
  end if;
  -- cnpj/razao_social vêm do cadastro (somente leitura para o formulário); nunca são gravados em producer_public
  return (select to_jsonb(pp) - 'oculto_por_admin'
            || jsonb_build_object('cnpj', public.organizador_cnpj_do_produtor(pp.producer_id))
          from public.producer_public pp where pp.producer_id = (select auth.uid()));
end $$;


ALTER FUNCTION "public"."meu_organizador_publico"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."meu_perfil"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select to_jsonb(p) - array['cpf_enc', 'stripe_customer_id', 'cpf_compra_hmac'] -- cpf_compra_hmac (20261030)
  from public.profiles p
  where p.id = (select auth.uid())
    and public.gf_mfa_ok(); -- a mesma regra RESTRICTIVE gf_mfa_aal2 da tabela
$$;


ALTER FUNCTION "public"."meu_perfil"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."meus_avisos_mesa"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if auth.uid() is null or not public.gf_mfa_ok() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', a.id, 'evento', a.evento, 'mesa', a.mesa, 'tipo', a.tipo,
                                        'mensagem', case a.tipo
                                          when 'removido' then 'Você foi retirado da sua mesa pela organização do evento; procure a organização no local'
                                          else 'Entrou alguém na sua mesa' end,
                                        'criado_em', a.criado_em, 'lido', a.lido)
                     order by a.lido, a.criado_em desc, a.id)
    from public.mesa_avisos a where a.user_id = auth.uid()
  ), '[]'::jsonb);
end;
$$;


ALTER FUNCTION "public"."meus_avisos_mesa"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."minha_mesa"("p_event_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_uid uuid := auth.uid();
  v_eu_ok boolean;
  v_saiu boolean;
begin
  if v_uid is null or not public.gf_mfa_ok() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  -- sem ingresso coletivo válido no evento: nada, nem a data de formação
  if not exists (select 1 from public.tickets t
                 join public.ticket_types tt on tt.id = t.ticket_type_id
                 where t.event_id = p_event_id and t.user_id = v_uid and tt.type = 'coletiva'
                   and t.status in ('active', 'used')) then
    return jsonb_build_object('mesas', '[]'::jsonb);
  end if;
  -- tirada da mesa pela organização (mesa_remover_membro): sem mesa e sem data de formação
  if public.mesa_travado(p_event_id, v_uid) then
    return jsonb_build_object('mesas', '[]'::jsonb, 'travado', true);
  end if;
  v_saiu := exists (select 1 from public.table_members m join public.collective_tables c on c.id = m.table_id
                    where c.event_id = p_event_id and m.user_id = v_uid and m.oculto);
  v_eu_ok := public.mesa_ok(v_uid) and not v_saiu;

  return jsonb_build_object(
    'forma_em', (select public.evento_momento(e) - interval '24 hours' from public.events e where e.id = p_event_id),
    'saiu', v_saiu,
    'mesas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'nome', c.name,
               'capacidade', c.capacity,
               'colegas', (
                 select jsonb_agg(public.mesa_cartao(g.user_id, k.ok, k.oculto)
                          || jsonb_build_object('id', case when not k.oculto then g.membro end, 'eu', g.user_id = v_uid)
                          || case when g.n > 1 then jsonb_build_object('acompanhantes', g.n - 1) else '{}'::jsonb end
                        order by g.user_id = v_uid desc, k.oculto, g.primeiro)
                 from (select m.user_id, count(*) n, min(m.ticket_id::text) primeiro,
                              (array_agg(m.id order by m.ticket_id))[1] membro, bool_or(m.oculto) oculto
                       from public.table_members m
                       join public.tickets t on t.id = m.ticket_id
                       where m.table_id = c.id and t.user_id = m.user_id and t.status in ('active', 'used')
                       group by m.user_id) g
                 -- a própria pessoa nunca vira "Lugar ocupado" para si mesma
                 cross join lateral (select g.oculto and g.user_id <> v_uid oculto) o
                 cross join lateral (select o.oculto, v_eu_ok and not o.oculto and public.mesa_ok(g.user_id) ok) k)
             ) order by substring(c.name from '[0-9]+')::int)
      from public.collective_tables c
      where c.event_id = p_event_id
        and exists (select 1 from public.table_members m
                    join public.tickets t on t.id = m.ticket_id
                    where m.table_id = c.id and m.user_id = v_uid and t.user_id = m.user_id
                      and t.status in ('active', 'used'))
    ), '[]'::jsonb)
  );
end;
$$;


ALTER FUNCTION "public"."minha_mesa"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."order_items_estoque_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_lotacao int;
  v_sold int;
  v_reservado int;
  v_min int;
  v_max int;
  v_no_pedido int;
  v_motivo text;
  v_max_cpf int;
  v_hash bytea;
  v_user uuid;
  v_outros int;
  v_permite boolean;
  v_preco numeric;
  v_tipo text;
  v_meias int;
  v_cota int;
  v_reserva int;
  v_limite int;
  v_mapa boolean;
  v_meia_ok boolean;
  v_restam int;
begin
  select case when coalesce(tt.quantity_total, 0) > 0 then tt.quantity_total
              when coalesce(tt.capacity, 0) > 0 then tt.capacity else 0 end,
         coalesce(tt.sold, 0), tt.min_per_order,
         case when tt.price = 0 then coalesce(tt.max_per_order, 10) else tt.max_per_order end,
         tt.max_por_cpf, tt.permite_meia, tt.price, tt.type
    into v_lotacao, v_sold, v_min, v_max, v_max_cpf, v_permite, v_preco, v_tipo
    from public.ticket_types tt where tt.id = new.ticket_type_id for update;
  if not found then
    return new; -- tipo inexistente cai na FK
  end if;
  -- meia (20261030): tipo pago sem máximo também tem teto por pedido e por conta/evento (negação de estoque); lugar marcado fica fora
  -- (reservar_assentos grava um item com todos os lugares)
  if v_preco > 0 and not public.tipo_no_mapa(new.ticket_type_id) then
    v_max := coalesce(v_max, 10);
    if (select coalesce(sum(oi.quantity), 0) from public.order_items oi join public.orders o on o.id = oi.order_id
         join public.orders o2 on o2.id = new.order_id
         where o.user_id = o2.user_id and o.event_id = o2.event_id and o.status = 'pending' and oi.id is distinct from new.id
           and coalesce(o.reservado_ate > now(), o.created_at > now() - interval '30 minutes')) + new.quantity > 20 then
      raise exception 'Limite de 20 ingressos reservados ao mesmo tempo neste evento' using errcode = '22023';
    end if;
  end if;
  -- v_max: tipo grátis sem máximo definido = teto de 10; tipo pago sem máximo = sem teto por pedido (nulo)
  if new.quantity < 1 or new.quantity < coalesce(v_min, 1) then
    raise exception 'Quantidade fora do permitido por pedido (mínimo %)', coalesce(v_min, 1) using errcode = '22023';
  end if;
  select coalesce(sum(oi.quantity), 0) + new.quantity into v_no_pedido
    from public.order_items oi
   where oi.order_id = new.order_id and oi.ticket_type_id = new.ticket_type_id and oi.id is distinct from new.id;
  if v_max is not null and v_no_pedido > v_max then
    raise exception 'Limite de % ingressos por pedido deste tipo', v_max using errcode = '22023';
  end if;
  v_motivo := public.venda_bloqueada(new.ticket_type_id);
  if v_motivo is not null then
    raise exception '%', v_motivo using errcode = '22023';
  end if;
  -- limite por CPF (20261028): antes do teste de lotação, vale mesmo sem lotação; a mensagem não diz quantos o CPF já tem
  if v_max_cpf is not null then
    select o.customer_cpf_hmac, o.user_id into v_hash, v_user from public.orders o where o.id = new.order_id;
    if v_hash is null then
      raise exception 'Informe o CPF do comprador para este ingresso' using errcode = '22023';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(new.ticket_type_id::text || encode(v_hash, 'hex'), 0));
    select coalesce(sum(oi.quantity), 0) into v_outros
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
     where oi.ticket_type_id = new.ticket_type_id and o.customer_cpf_hmac = v_hash
       and o.id <> new.order_id and oi.id is distinct from new.id
       and (o.status = 'paid'
            or (o.status = 'pending' and o.user_id = v_user -- pendente só da MESMA conta; o de outra é rechecado ao pagar
                and o.created_at > now() - case when exists (select 1 from public.pedido_assentos pa where pa.order_id = o.id and pa.liberada_em is null)
                                                then interval '10 minutes' else interval '30 minutes' end));
    if v_no_pedido + v_outros > v_max_cpf then
      raise exception 'Limite de % ingressos por CPF neste ingresso', v_max_cpf using errcode = '22023';
    end if;
  end if;
  -- meia (20261030): quem pode ter meia e a cota. Mesa, coletiva, preço 0 e permite_meia=false não têm meia; lugar marcado
  -- só tem em lugar individual (20261030f, abaixo). Quem não tem meia não segura cota.
  v_mapa := public.tipo_no_mapa(new.ticket_type_id);
  v_meia_ok := v_permite and v_tipo not in ('mesa', 'coletiva') and v_preco > 0;
  if new.beneficio = 'meia' then
    if not v_meia_ok then
      raise exception 'Este ingresso não tem meia-entrada' using errcode = '22023';
    end if;
    -- lotação 0 (quantity_total e capacity vazios): sem base para a cota de 40%, então sem meia (20261030f); vale para qualquer porta
    if v_lotacao = 0 then
      raise exception 'Meia-entrada não disponível para algum dos lugares escolhidos' using errcode = '22023';
    end if;
    -- meia em lugar marcado (20261030f): só em lugar individual já preso a este pedido (reservar_assentos grava pedido_assentos antes dos itens)
    if v_mapa and (select coalesce(sum(oi.quantity), 0) from public.order_items oi
                    where oi.order_id = new.order_id and oi.ticket_type_id = new.ticket_type_id and oi.beneficio = 'meia' and oi.id is distinct from new.id)
                  + new.quantity > (select count(*) from public.pedido_assentos pa
                                     where pa.order_id = new.order_id and pa.ticket_type_id = new.ticket_type_id and pa.liberada_em is null and pa.lugares = 1) then
      raise exception 'Meia-entrada em lugar marcado só vale em lugar individual escolhido' using errcode = '22023';
    end if;
    if new.meia_tipo is null then
      raise exception 'Informe o tipo de meia-entrada' using errcode = '22023';
    end if;
  end if;
  if v_lotacao = 0 then
    return new; -- sem lotação não se afirma esgotado (e a meia fica sem teto)
  end if;
  v_cota := case when v_meia_ok then (v_lotacao * 4 + 9) / 10 else 0 end; -- ceil(40% da lotação do tipo); cada tipo é o seu grupo (fatia 3 traz o grupo)
  select coalesce(sum(oi.quantity), 0) into v_reservado
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
   where oi.ticket_type_id = new.ticket_type_id and oi.id is distinct from new.id
     and o.status = 'pending'
     and coalesce(o.reservado_ate > now(), -- meia (20261030): reserva do servidor vale até reservado_ate; sem ele, a regra antiga
                  o.created_at > now() - case when exists (select 1 from public.pedido_assentos pa where pa.order_id = o.id and pa.liberada_em is null)
                                     then interval '10 minutes' else interval '30 minutes' end);
  -- meia (20261030): meias já ocupadas (pagas + reservas vivas) e a reserva de vagas para a cota de meia
  select coalesce(sum(oi.quantity), 0) into v_meias
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
   where oi.ticket_type_id = new.ticket_type_id and oi.id is distinct from new.id and oi.beneficio = 'meia'
     and (o.status = 'paid'
          or (o.status = 'pending'
              and coalesce(o.reservado_ate > now(), o.created_at > now() - case when exists (select 1 from public.pedido_assentos pa where pa.order_id = o.id and pa.liberada_em is null)
                                     then interval '10 minutes' else interval '30 minutes' end)));
  v_restam := greatest(v_cota - v_meias, 0);
  v_reserva := case when v_mapa then 0 else v_restam end; -- lugar marcado: a cota limita as meias, mas não guarda vagas (o comprador escolhe o lugar)
  if new.beneficio = 'meia' and v_meias + new.quantity > v_cota then
    raise exception 'Restam % meias neste ingresso', v_restam using errcode = '22023';
  end if;
  v_limite := v_lotacao - case when new.beneficio = 'meia' then 0 else v_reserva end; -- a inteira não come as vagas guardadas para a meia
  if v_sold + v_reservado + new.quantity > v_limite then
    raise exception 'Ingressos esgotados ou insuficientes (restam %)', greatest(v_limite - v_sold - v_reservado, 0) using errcode = '22023';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."order_items_estoque_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."orders_cpf_hash"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_cpf text := regexp_replace(coalesce(new.customer_cpf, ''), '\D', '', 'g');
begin
  new.customer_cpf_hmac := null; -- hash só nasce do CPF validado aqui
  if btrim(coalesce(new.customer_cpf, '')) <> '' then
    if not public.gf_cpf_valido(v_cpf) then
      raise exception 'CPF inválido' using errcode = '22023';
    end if;
    new.customer_cpf_hmac := public.pr7_hmac(v_cpf);
    -- anti-sondagem: no máximo 3 CPFs diferentes por conta por hora (repetir o mesmo CPF não conta)
    if new.user_id is not null
       and (select count(distinct o.customer_cpf_hmac) from public.orders o
             where o.user_id = new.user_id and o.customer_cpf_hmac is not null
               and o.created_at > now() - interval '1 hour') >= 3
       and not exists (select 1 from public.orders o
             where o.user_id = new.user_id and o.customer_cpf_hmac = new.customer_cpf_hmac
               and o.created_at > now() - interval '1 hour') then
      raise exception 'Muitas tentativas com CPFs diferentes. Tente de novo mais tarde.' using errcode = '22023';
    end if;
  end if;
  new.customer_cpf := null; -- o CPF puro nunca fica no banco
  return new;
end;
$$;


ALTER FUNCTION "public"."orders_cpf_hash"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."orders_pago_assento_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if exists (select 1 from public.pedido_assentos pa
              where pa.order_id = new.id and (pa.liberada_em is not null or pa.expira_em <= now())) then
    raise exception 'O tempo do lugar acabou: o pagamento deste pedido não pode ser confirmado' using errcode = '22023';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."orders_pago_assento_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."orders_pago_cpf_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare it record;
begin
  for it in select a.ticket_type_id, a.q, tt.max_por_cpf
              from (select oi.ticket_type_id, sum(oi.quantity) as q from public.order_items oi where oi.order_id = new.id group by 1) a
              join public.ticket_types tt on tt.id = a.ticket_type_id
             where tt.max_por_cpf is not null
             order by a.ticket_type_id loop
    if new.customer_cpf_hmac is null then
      raise exception 'Informe o CPF do comprador para este ingresso' using errcode = '22023';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(it.ticket_type_id::text || encode(new.customer_cpf_hmac, 'hex'), 0));
    if it.q + coalesce((select sum(oi.quantity) from public.order_items oi join public.orders o on o.id = oi.order_id
                         where oi.ticket_type_id = it.ticket_type_id and o.customer_cpf_hmac = new.customer_cpf_hmac
                           and o.status = 'paid' and o.id <> new.id), 0) > it.max_por_cpf then
      raise exception 'Limite de % ingressos por CPF neste ingresso', it.max_por_cpf using errcode = '22023';
    end if;
  end loop;
  return new;
end;
$$;


ALTER FUNCTION "public"."orders_pago_cpf_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."orders_um_pendente"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if new.status = 'pending' then
    perform pg_advisory_xact_lock(hashtextextended(new.user_id::text || new.event_id::text, 0));
    update public.orders set status = 'cancelled'
     where user_id = new.user_id and event_id = new.event_id and status = 'pending';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."orders_um_pendente"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."organizador_cnpj_do_produtor"("p_producer" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare j jsonb; v text;
begin
  select to_jsonb(pp) into j from public.producer_profiles pp where pp.id = p_producer;
  if j is null then return null; end if;
  v := regexp_replace(coalesce(j ->> 'cnpj', ''), '\D', '', 'g');
  if public.organizador_cnpj_valido(v) then return v; end if;
  -- PR7-PASSO2: cnpj em texto pode ter sumido; tenta o cifrado só se pr7_dec(bytea) e a coluna existirem
  if to_regprocedure('public.pr7_dec(bytea)') is not null and j ->> 'cnpj_enc' is not null then
    execute 'select public.pr7_dec(decode(substr($1, 3), ''hex''))' into v using j ->> 'cnpj_enc';
    v := regexp_replace(coalesce(v, ''), '\D', '', 'g');
    if public.organizador_cnpj_valido(v) then return v; end if;
  end if;
  return null;
end $_$;


ALTER FUNCTION "public"."organizador_cnpj_do_produtor"("p_producer" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."organizador_cnpj_valido"("p" "text") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO ''
    AS $_$
declare
  d int[]; s int; i int; dv1 int; dv2 int;
  w1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2];
  w2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
begin
  if p is null or p !~ '^[0-9]{14}$' or p ~ '^(.)\1{13}$' then return false; end if;
  d := array(select substr(p, g, 1)::int from generate_series(1, 14) g);
  s := 0; for i in 1..12 loop s := s + d[i] * w1[i]; end loop;
  dv1 := case when s % 11 < 2 then 0 else 11 - s % 11 end;
  s := 0; for i in 1..13 loop s := s + d[i] * w2[i]; end loop;
  dv2 := case when s % 11 < 2 then 0 else 11 - s % 11 end;
  return d[13] = dv1 and d[14] = dv2;
end $_$;


ALTER FUNCTION "public"."organizador_cnpj_valido"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."organizador_marca_ok"("p" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $_$
  select regexp_replace(
           translate(translate(normalize(lower(coalesce(p, '')), nfkc), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'),
                     '01345@$', 'oieasas'),
           '[^a-z]', '', 'g') !~ '(evokaa|auratickets)';
$_$;


ALTER FUNCTION "public"."organizador_marca_ok"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."organizador_publico"("p_evento" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  with ev as (
    select e.producer_id, public.organizador_cnpj_do_produtor(e.producer_id) as cnpj
    from public.events e
    where e.id = p_evento and public.evento_acesso(p_evento) in ('aberto', 'link')
  )
  select case when ev.cnpj is null and pp.producer_id is null then null  -- PF sem linha: sem bloco
              when pp.oculto_por_admin then null
              else nullif(jsonb_strip_nulls(jsonb_build_object(
      'nome', case when pp.producer_id is null then (select pf.company_name from public.producer_profiles pf where pf.id = ev.producer_id)
                   when pp.mostrar_nome then pp.nome_publico end,
      'razao_social', case when ev.cnpj is not null then (select pf.company_name from public.producer_profiles pf where pf.id = ev.producer_id) end,
      'cnpj', ev.cnpj,                   -- só PJ (CNPJ do cadastro, válido): sai sempre
      'whatsapp', case when pp.mostrar_whatsapp then pp.whatsapp end,
      'instagram', case when pp.mostrar_instagram then pp.instagram end,
      'site', case when pp.mostrar_site then pp.site end,
      'email', case when pp.mostrar_email then pp.email_contato end,
      'outras_redes', case when pp.mostrar_outras_redes then pp.outras_redes end)), '{}'::jsonb) end
  from ev left join public.producer_public pp on pp.producer_id = ev.producer_id;
$$;


ALTER FUNCTION "public"."organizador_publico"("p_evento" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."organizador_redes_ok"("p" "jsonb") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  select p is null or (
    jsonb_typeof(p) = 'array' and jsonb_array_length(p) <= 5 and length(p::text) <= 1000
    and not exists (
      select 1 from jsonb_array_elements(p) e
      where jsonb_typeof(e) <> 'object'
         or jsonb_typeof(e -> 'rotulo') is distinct from 'string' or length(e ->> 'rotulo') not between 1 and 30
         or not public.organizador_marca_ok(e ->> 'rotulo')
         or translate(lower(e ->> 'rotulo'), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn') ~ '\m(pix|pagamento)\M'
         or jsonb_typeof(e -> 'url') is distinct from 'string'
         or not public.organizador_url_ok(e ->> 'url')));
$$;


ALTER FUNCTION "public"."organizador_redes_ok"("p" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."organizador_url_ok"("p" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $_$
  select p ~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(/[^\s"<>]*)?$'
     and length(p) <= 200
     and substring(p from '^https://([^/]+)') !~* '(^|\.)xn--'
     and public.organizador_marca_ok(substring(p from '^https://([^/]+)'));
$_$;


ALTER FUNCTION "public"."organizador_url_ok"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pedido_do_navegador"("p_order" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (select 1 from public.orders o where o.id = p_order and o.reservado_ate is null and o.coupon_id is null);
$$;


ALTER FUNCTION "public"."pedido_do_navegador"("p_order" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pedidos_pendentes_expirar"("p_minutos" integer DEFAULT 30) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare n int;
begin
  update public.orders o
     set status = 'cancelled'
   where o.status = 'pending'
     and (o.created_at < now() - make_interval(mins => greatest(p_minutos, 5))
          or (o.created_at < now() - interval '10 minutes'
              and exists (select 1 from public.pedido_assentos pa where pa.order_id = o.id and pa.liberada_em is null)));
  get diagnostics n = row_count;
  return n;
end $$;


ALTER FUNCTION "public"."pedidos_pendentes_expirar"("p_minutos" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."platform_settings_updated_by"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  -- quem chega com sessão grava; service_role e SQL Editor (sem auth.uid) deixam como veio
  if (select auth.uid()) is not null then new.updated_by := (select auth.uid()); end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."platform_settings_updated_by"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pode_comprar"("p_order" "uuid", "p_ticket_type" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
    from public.orders o
    join public.ticket_types tt on tt.id = p_ticket_type and tt.event_id = o.event_id
    join public.events e on e.id = o.event_id
    where o.id = p_order and o.user_id = auth.uid() and o.status = 'pending'
      and tt.is_active and e.status = 'published' and e.approval_status = 'approved'
      and public.evento_acesso(o.event_id) in ('aberto', 'link')
  );
$$;


ALTER FUNCTION "public"."pode_comprar"("p_order" "uuid", "p_ticket_type" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pr7_admin_afiliados"() RETURNS TABLE("id" "uuid", "user_id" "uuid", "referral_code" "text", "status" "text", "recurring_percent" numeric, "agreement_date" "date", "notes" "text", "full_name" "text", "cpf_mascarado" "text", "birth_date" "date", "email" "text", "phone" "text", "whatsapp" "text", "cep" "text", "street" "text", "street_number" "text", "complement" "text", "neighborhood" "text", "city" "text", "state" "text", "payout_account_id" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "created_by" "uuid", "user_full_name" "text", "user_email" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.gf_admin_can('manage_affiliates') then
    raise exception 'Só quem administra afiliados vê a lista.' using errcode='42501';
  end if;
  return query
    select a.id, a.user_id, a.referral_code, a.status, a.recurring_percent, a.agreement_date, a.notes,
           a.full_name, public.pr7_mascara_cpf(public.pr7_dec(a.cpf_enc)), a.birth_date, a.email, a.phone,
           a.whatsapp, a.cep, a.street, a.street_number, a.complement, a.neighborhood, a.city, a.state,
           a.payout_account_id, a.created_at, a.updated_at, a.created_by, u.full_name, u.email
    from public.platform_affiliates a
    left join public.profiles u on u.id = a.user_id
    order by a.created_at desc;
end $$;


ALTER FUNCTION "public"."pr7_admin_afiliados"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pr7_admin_saques"() RETURNS TABLE("id" "uuid", "amount" numeric, "status" "text", "created_at" timestamp with time zone, "processed_at" timestamp with time zone, "pix_key" "text", "bank_account" "jsonb", "produtor_nome" "text", "produtor_email" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.gf_admin_can('manage_finance') then
    raise exception 'Só quem administra finanças vê os saques.' using errcode='42501';
  end if;
  insert into public.withdrawals_acessos (leitor, linhas)
    select (select auth.uid()), least(count(*), 1000)::int
    from public.withdrawals w join public.profiles pr on pr.id = w.producer_id;
  return query
    select w.id, w.amount, w.status, w.created_at, w.processed_at,
           public.pr7_dec(w.pix_key_enc), coalesce(public.pr7_dec(w.bank_account_enc)::jsonb, '{}'::jsonb),
           pr.full_name, pr.email
    from public.withdrawals w
    join public.profiles pr on pr.id = w.producer_id
    order by w.created_at desc limit 1000;
end $$;


ALTER FUNCTION "public"."pr7_admin_saques"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pr7_anonimizar_pii"("p_uid" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  update public.producer_profiles
    set cnpj_enc = null, cnpj_hmac = null, pix_key_enc = null, bank_account_enc = public.pr7_enc('{}')
    where id = p_uid;
  update public.withdrawals
    set pix_key_enc = null, bank_account_enc = public.pr7_enc('{}')
    where producer_id = p_uid;
  update public.platform_affiliates set cpf_enc = null, cpf_hmac = null where user_id = p_uid;
  update public.profiles set cpf_enc = null where id = p_uid;
  update public.profiles set cpf_compra_hmac = null where id = p_uid; -- cpf_compra_hmac (20261030)
end $$;


ALTER FUNCTION "public"."pr7_anonimizar_pii"("p_uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pr7_dec"("p" "bytea") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select case when p is null then null else extensions.pgp_sym_decrypt(p, public.pr7_key()) end;
$$;


ALTER FUNCTION "public"."pr7_dec"("p" "bytea") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pr7_enc"("p" "text") RETURNS "bytea"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select case when p is null then null else extensions.pgp_sym_encrypt(p, public.pr7_key()) end;
$$;


ALTER FUNCTION "public"."pr7_enc"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pr7_enc_se_mudou"("p_novo" "text", "p_atual" "bytea") RETURNS "bytea"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select case
    when p_novo is null then null
    when p_atual is not null and public.pr7_dec(p_atual) is not distinct from p_novo then p_atual
    else public.pr7_enc(p_novo) end;
$$;


ALTER FUNCTION "public"."pr7_enc_se_mudou"("p_novo" "text", "p_atual" "bytea") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pr7_hmac"("p" "text") RETURNS "bytea"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select case when p is null then null
    else extensions.hmac(regexp_replace(p, '\D', '', 'g'), public.pr7_key(), 'sha256') end;
$$;


ALTER FUNCTION "public"."pr7_hmac"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pr7_key"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v text;
begin
  select d.decrypted_secret into v from vault.decrypted_secrets d where d.name = 'pr7_pii_key' limit 1;
  if v is null or char_length(v) = 0 then
    raise exception 'pr7_pii_key ausente/vazio no Vault — escrita de PII bloqueada' using errcode = '55000';
  end if;
  return v;
end $$;


ALTER FUNCTION "public"."pr7_key"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pr7_mascara4"("p" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  select case when p is null or p = '' then p else '••••' || right(p,4) end;
$$;


ALTER FUNCTION "public"."pr7_mascara4"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pr7_mascara_cpf"("p" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  select case when p is null then null
    else '***.***.***-' || right(regexp_replace(p,'\D','','g'), 2) end;
$$;


ALTER FUNCTION "public"."pr7_mascara_cpf"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pr7_meu_cadastro"() RETURNS TABLE("nome_completo" "text", "cpf" "text", "rg" "text", "data_nascimento" "date", "cep" "text", "rua" "text", "numero" "text", "complemento" "text", "bairro" "text", "cidade" "text", "uf" "text", "email_secundario" "text", "telefone" "text", "whatsapp" "text", "emergencia_nome" "text", "emergencia_parentesco" "text", "emergencia_telefone" "text", "banco" "text", "agencia" "text", "conta" "text", "pix_tipo" "text", "pix_chave" "text", "email" "text", "cargo" "text", "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.gf_mfa_ok() then
    raise exception 'Reautenticação de dois fatores necessária.' using errcode='42501';
  end if;
  return query
    select s.nome_completo, public.pr7_dec(s.cpf_enc), public.pr7_dec(s.rg_enc), s.data_nascimento,
           s.cep, s.rua, s.numero, s.complemento, s.bairro, s.cidade, s.uf, s.email_secundario,
           s.telefone, s.whatsapp, s.emergencia_nome, s.emergencia_parentesco, s.emergencia_telefone,
           public.pr7_dec(s.banco_enc), public.pr7_dec(s.agencia_enc), public.pr7_dec(s.conta_enc),
           public.pr7_dec(s.pix_tipo_enc), public.pr7_dec(s.pix_chave_enc), s.email, s.cargo, s.updated_at
    from public.staff_profiles s where s.user_id = (select auth.uid());
end $$;


ALTER FUNCTION "public"."pr7_meu_cadastro"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pr7_produtor_financeiro"() RETURNS TABLE("cnpj" "text", "pix_key" "text", "bank_account" "jsonb")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.gf_mfa_ok() then
    raise exception 'Reautenticação de dois fatores necessária.' using errcode='42501';
  end if;
  return query
    select public.pr7_dec(p.cnpj_enc), public.pr7_dec(p.pix_key_enc),
           coalesce(public.pr7_dec(p.bank_account_enc)::jsonb, '{}'::jsonb)
    from public.producer_profiles p where p.id = (select auth.uid());
end $$;


ALTER FUNCTION "public"."pr7_produtor_financeiro"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pr7_salvar_afiliado"("p_id" "uuid", "p_cpf" "text", "p_full_name" "text", "p_birth_date" "date", "p_email" "text", "p_phone" "text", "p_whatsapp" "text", "p_cep" "text", "p_street" "text", "p_street_number" "text", "p_complement" "text", "p_neighborhood" "text", "p_city" "text", "p_state" "text", "p_recurring_percent" numeric, "p_status" "text", "p_agreement_date" "date", "p_notes" "text", "p_user_id" "uuid" DEFAULT NULL::"uuid", "p_referral_code" "text" DEFAULT NULL::"text", "p_payout_account_id" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_id uuid := p_id; v_cpf text := nullif(regexp_replace(coalesce(p_cpf,''),'\D','','g'),'');
begin
  if not public.gf_admin_can('manage_affiliates') then
    raise exception 'Sem permissão para afiliados.' using errcode='42501';
  end if;
  if v_cpf is not null and not public.gf_cpf_valido(v_cpf) then
    raise exception 'CPF de afiliado inválido' using errcode='23514';
  end if;
  if p_id is null then
    if v_cpf is null then raise exception 'CPF obrigatório' using errcode='23514'; end if;
    insert into public.platform_affiliates
      (user_id, referral_code, cpf_enc, cpf_hmac, full_name, birth_date, email, phone, whatsapp, cep, street,
       street_number, complement, neighborhood, city, state, recurring_percent, status,
       agreement_date, notes, payout_account_id, created_by)
    values (p_user_id, p_referral_code, public.pr7_enc(v_cpf), public.pr7_hmac(v_cpf), p_full_name, p_birth_date,
       p_email, p_phone, p_whatsapp,
       p_cep, p_street, p_street_number, p_complement, p_neighborhood, p_city, p_state,
       p_recurring_percent, p_status, p_agreement_date, p_notes, p_payout_account_id, (select auth.uid()))
    returning id into v_id;
  else
    update public.platform_affiliates set
      full_name=p_full_name, birth_date=p_birth_date, email=p_email, phone=p_phone, whatsapp=p_whatsapp,
      cep=p_cep, street=p_street, street_number=p_street_number, complement=p_complement,
      neighborhood=p_neighborhood, city=p_city, state=p_state, recurring_percent=p_recurring_percent,
      status=p_status, agreement_date=p_agreement_date, notes=p_notes,
      cpf_enc  = case when v_cpf is null then cpf_enc  else public.pr7_enc_se_mudou(v_cpf, cpf_enc) end,
      cpf_hmac = case when v_cpf is null then cpf_hmac else public.pr7_hmac(v_cpf) end,
      payout_account_id = coalesce(payout_account_id, p_payout_account_id),
      updated_at = now()
    where id = p_id;
    if not found then raise exception 'Afiliado não encontrado' using errcode='P0001'; end if;
  end if;
  return v_id;
end $$;


ALTER FUNCTION "public"."pr7_salvar_afiliado"("p_id" "uuid", "p_cpf" "text", "p_full_name" "text", "p_birth_date" "date", "p_email" "text", "p_phone" "text", "p_whatsapp" "text", "p_cep" "text", "p_street" "text", "p_street_number" "text", "p_complement" "text", "p_neighborhood" "text", "p_city" "text", "p_state" "text", "p_recurring_percent" numeric, "p_status" "text", "p_agreement_date" "date", "p_notes" "text", "p_user_id" "uuid", "p_referral_code" "text", "p_payout_account_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pr7_salvar_meu_cadastro"("p_nome_completo" "text", "p_cpf" "text", "p_rg" "text", "p_data_nascimento" "date", "p_cep" "text", "p_rua" "text", "p_numero" "text", "p_complemento" "text", "p_bairro" "text", "p_cidade" "text", "p_uf" "text", "p_email_secundario" "text", "p_telefone" "text", "p_whatsapp" "text", "p_emergencia_nome" "text", "p_emergencia_parentesco" "text", "p_emergencia_telefone" "text", "p_banco" "text", "p_agencia" "text", "p_conta" "text", "p_pix_tipo" "text", "p_pix_chave" "text", "p_updated_at" timestamp with time zone) RETURNS timestamp with time zone
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare v_uid uuid := (select auth.uid()); v_cpf text := regexp_replace(coalesce(p_cpf,''),'\D','','g'); v_ts timestamptz;
begin
  if v_uid is null then raise exception 'sem sessão' using errcode='42501'; end if;
  if not (coalesce(auth.jwt() ->> 'aal','') = 'aal2' and public.gf_tem_2fa(v_uid) is true) then
    raise exception 'Reautenticação de dois fatores necessária para alterar o cadastro.' using errcode='42501';
  end if;
  -- colunas que eram NOT NULL no texto (cpf já é coberto abaixo: vazio vira '' e não passa em gf_cpf_valido)
  if p_rg is null or p_pix_tipo is null or p_pix_chave is null then
    raise exception 'Preencha todos os campos obrigatórios.' using errcode='23502';
  end if;
  if not public.gf_cpf_valido(v_cpf) then raise exception 'CPF inválido' using errcode='23514'; end if;
  if char_length(btrim(p_rg)) not between 3 and 20 then raise exception 'Informe o RG.' using errcode='23514'; end if;
  if char_length(p_banco) > 80 or char_length(p_agencia) > 20 or char_length(p_conta) > 30 then
    raise exception 'Dados bancários longos demais.' using errcode='23514';
  end if;
  if not (case p_pix_tipo
      when 'cpf' then public.gf_cpf_valido(p_pix_chave)
      when 'email' then p_pix_chave = lower(btrim(p_pix_chave)) and char_length(p_pix_chave) <= 77 and p_pix_chave ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
      when 'telefone' then p_pix_chave ~ '^\+55[0-9]{10,11}$'
      when 'aleatoria' then p_pix_chave ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      else false end) then
    raise exception 'A chave Pix não confere com o tipo escolhido.' using errcode='23514';
  end if;
  update public.staff_profiles set
    nome_completo=p_nome_completo, data_nascimento=p_data_nascimento, cep=p_cep,
    rua=p_rua, numero=p_numero, complemento=p_complemento, bairro=p_bairro, cidade=p_cidade, uf=p_uf,
    email_secundario=p_email_secundario, telefone=p_telefone, whatsapp=p_whatsapp,
    emergencia_nome=p_emergencia_nome, emergencia_parentesco=p_emergencia_parentesco,
    emergencia_telefone=p_emergencia_telefone,
    cpf_enc = public.pr7_enc_se_mudou(v_cpf, cpf_enc),
    rg_enc = public.pr7_enc_se_mudou(p_rg, rg_enc),
    banco_enc = public.pr7_enc_se_mudou(p_banco, banco_enc),
    agencia_enc = public.pr7_enc_se_mudou(p_agencia, agencia_enc),
    conta_enc = public.pr7_enc_se_mudou(p_conta, conta_enc),
    pix_tipo_enc = public.pr7_enc_se_mudou(p_pix_tipo, pix_tipo_enc),
    pix_chave_enc = public.pr7_enc_se_mudou(p_pix_chave, pix_chave_enc),
    updated_at=now()
  where user_id = v_uid and updated_at = p_updated_at
  returning updated_at into v_ts;
  if v_ts is null then raise exception 'Não foi possível salvar: o cadastro foi alterado em outra aba ou não existe. Recarregue a página.' using errcode='P0001'; end if;
  return v_ts;
end $_$;


ALTER FUNCTION "public"."pr7_salvar_meu_cadastro"("p_nome_completo" "text", "p_cpf" "text", "p_rg" "text", "p_data_nascimento" "date", "p_cep" "text", "p_rua" "text", "p_numero" "text", "p_complemento" "text", "p_bairro" "text", "p_cidade" "text", "p_uf" "text", "p_email_secundario" "text", "p_telefone" "text", "p_whatsapp" "text", "p_emergencia_nome" "text", "p_emergencia_parentesco" "text", "p_emergencia_telefone" "text", "p_banco" "text", "p_agencia" "text", "p_conta" "text", "p_pix_tipo" "text", "p_pix_chave" "text", "p_updated_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pr7_salvar_produtor_financeiro"("p_cnpj" "text", "p_pix_key" "text", "p_bank_account" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_uid uuid := (select auth.uid());
        v_cnpj text := nullif(regexp_replace(coalesce(p_cnpj,''),'\D','','g'), '');  -- '' ou formatação -> null/dígitos
begin
  if v_uid is null then raise exception 'sem sessão' using errcode='42501'; end if;
  if not public.gf_mfa_ok() then
    raise exception 'Reautenticação de dois fatores necessária.' using errcode='42501';
  end if;
  if v_cnpj is not null and length(v_cnpj) <> 14 then
    raise exception 'CNPJ inválido' using errcode='23514';
  end if;
  insert into public.producer_profiles as pp (id, company_name, cnpj_enc, cnpj_hmac, bank_account_enc, pix_key_enc, notification_settings)
    values (v_uid, coalesce((select full_name from public.profiles where id=v_uid),'Minha Empresa'),
            public.pr7_enc(v_cnpj), public.pr7_hmac(v_cnpj),
            public.pr7_enc(coalesce(p_bank_account,'{}'::jsonb)::text),
            public.pr7_enc(coalesce(p_pix_key,'')), '{}'::jsonb)
  on conflict (id) do update
    set cnpj_enc = public.pr7_enc_se_mudou(v_cnpj, pp.cnpj_enc),
        cnpj_hmac = public.pr7_hmac(v_cnpj),
        pix_key_enc = public.pr7_enc_se_mudou(coalesce(p_pix_key,''), pp.pix_key_enc),
        bank_account_enc = public.pr7_enc_se_mudou(coalesce(p_bank_account,'{}'::jsonb)::text, pp.bank_account_enc);
end $$;


ALTER FUNCTION "public"."pr7_salvar_produtor_financeiro"("p_cnpj" "text", "p_pix_key" "text", "p_bank_account" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."produtor_vendas_pagas"("p_de" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_ate" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_event_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  with base as (
    select o.id, o.event_id, e.title, o.status, o.total, o.payment_method,
           (o.created_at at time zone 'America/Sao_Paulo')::date as dia
    from public.orders o
    join public.events e on e.id = o.event_id
    where e.producer_id = (select auth.uid())
      and o.status in ('paid', 'refunded')
      and (p_de is null or o.created_at >= p_de)
      and (p_ate is null or o.created_at < p_ate)
      and (p_event_id is null or o.event_id = p_event_id)
  ), pagos as (select * from base where status = 'paid')
  select jsonb_build_object(
    'total', coalesce((select sum(total) from pagos), 0),
    'pedidos', (select count(*) from pagos),
    'reembolsados', jsonb_build_object(
      'pedidos', (select count(*) from base where status = 'refunded'),
      'total', coalesce((select sum(total) from base where status = 'refunded'), 0)),
    'por_evento', coalesce((select jsonb_agg(jsonb_build_object('event_id', event_id, 'titulo', titulo, 'pedidos', n, 'total', t)
                            order by t desc, event_id)
                            from (select event_id, max(title) as titulo, count(*) as n, sum(total) as t from pagos group by event_id) x), '[]'::jsonb),
    'por_dia', coalesce((select jsonb_agg(jsonb_build_object('dia', dia, 'pedidos', n, 'total', t) order by dia)
                          from (select dia, count(*) as n, sum(total) as t from pagos group by dia) x), '[]'::jsonb),
    'por_forma', coalesce((select jsonb_agg(jsonb_build_object('forma', forma, 'pedidos', n, 'total', t) order by t desc, forma)
                            from (select coalesce(payment_method, '') as forma, count(*) as n, sum(total) as t from pagos group by 1) x), '[]'::jsonb)
  );
$$;


ALTER FUNCTION "public"."produtor_vendas_pagas"("p_de" timestamp with time zone, "p_ate" timestamp with time zone, "p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reservar_assentos"("p_event" "uuid", "p_seats" "text"[], "p_meias" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  v_user uuid := auth.uid();
  v_mapa jsonb;
  v_n int;
  v_ok int;
  v_sel jsonb;
  v_order uuid;
  v_expira timestamptz := now() + interval '10 minutes';
  v_nome text;
  v_email text;
  v_sub bigint := 0;
  v_taxa bigint := 0;
  v_cent bigint;
  v_itens jsonb := '[]'::jsonb;
  v_uf text;
  v_meias int := 0;
  l record;
begin
  if v_user is null then
    raise exception 'Entre na sua conta para escolher o lugar' using errcode = '42501';
  end if;
  if p_seats is null or cardinality(p_seats) < 1 or cardinality(p_seats) > 20 then
    raise exception 'Escolha de 1 a 20 lugares' using errcode = '22023';
  end if;
  p_meias := coalesce(p_meias, '[]'::jsonb);
  -- valida o JSON ANTES de qualquer cast; cada meia aponta para um lugar escolhido, sem repetir
  if jsonb_typeof(p_meias) <> 'array' or jsonb_array_length(p_meias) > 20
     or exists (select 1 from jsonb_array_elements(p_meias) e(v)
                 where jsonb_typeof(e.v) <> 'object'
                    or jsonb_typeof(e.v -> 'seat_key') is distinct from 'string'
                    or jsonb_typeof(e.v -> 'meia_tipo') is distinct from 'string'
                    or not coalesce((e.v ->> 'seat_key') = any (p_seats), false)) then -- coalesce: NULL em p_seats não pode driblar a conferência
    raise exception 'Meia inválida: informe o lugar (entre os escolhidos) e o tipo de meia-entrada' using errcode = '22023';
  end if;
  if (select count(*) - count(distinct e.v ->> 'seat_key') from jsonb_array_elements(p_meias) e(v)) > 0 then
    raise exception 'Meia inválida: informe o lugar (entre os escolhidos) e o tipo de meia-entrada' using errcode = '22023';
  end if;
  if public.evento_acesso(p_event) is distinct from 'aberto' and public.evento_acesso(p_event) is distinct from 'link' then
    raise exception 'Evento indisponível para compra' using errcode = '22023';
  end if;
  -- evento_acesso devolve 'aberto' ao dono mesmo em rascunho: aqui só se reserva em evento publicado e aprovado
  select upper(btrim(e.venue_state)) into v_uf from public.events e where e.id = p_event and e.status = 'published' and e.approval_status = 'approved';
  if not found then
    raise exception 'Evento indisponível para compra' using errcode = '22023';
  end if;
  -- meia_tipo: nacional fixo ou estadual cadastrado para a UF do evento (igual ao reservar_ingressos)
  if exists (select 1 from jsonb_array_elements(p_meias) e(v)
              where not ((e.v ->> 'meia_tipo') in ('estudante', 'pcd', 'pcd_acompanhante', 'jovem_baixa_renda')
                         or exists (select 1 from public.beneficios_uf b where b.uf = v_uf and b.codigo = e.v ->> 'meia_tipo'))) then
    raise exception 'Tipo de meia-entrada inválido para este evento' using errcode = '22023';
  end if;
  -- mesma trava do gatilho orders_um_pendente: contagem e criação do pedido da mesma pessoa e evento em fila
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || p_event::text, 0));
  select count(*) into v_n from public.orders where user_id = v_user and event_id = p_event and created_at > now() - interval '1 hour';
  if v_n >= 5 then
    raise exception 'Você já fez 5 pedidos neste evento na última hora. Tente de novo mais tarde.' using errcode = '22023';
  end if;
  select environments into v_mapa from public.seating_maps where event_id = p_event and is_active;
  if v_mapa is null then
    raise exception 'Este evento não tem mapa de lugares disponível' using errcode = '22023';
  end if;

  -- lugares pedidos que existem, estão livres no mapa e têm setor com tipo de ingresso do evento; agrupa por tipo
  select coalesce(jsonb_agg(jsonb_build_object('seat_key', x.seat_key, 'tt', x.tt, 'lugares', x.lugares, 'stype', x.stype)), '[]'::jsonb) into v_sel
    from (
      select distinct (env.value->>'id') || ':' || (s.value->>'id') as seat_key,
             (sec.value->>'ticketTypeId')::uuid as tt,
             case when s.value->>'type' = 'table'
                  then least(greatest(coalesce(case when jsonb_typeof(s.value->'seatsCount') = 'number' then (s.value->>'seatsCount')::int end,
                                               case when jsonb_typeof(s.value->'capacity') = 'number' then (s.value->>'capacity')::int end, 6), 1), 50) -- teto 50: mapa adulterado não vira pedido gigante
                  else 1 end as lugares,
             s.value->>'type' as stype
        from jsonb_array_elements(case when jsonb_typeof(v_mapa) = 'array' then v_mapa else '[]'::jsonb end) env(value)
        cross join lateral jsonb_array_elements(case when jsonb_typeof(env.value->'seats') = 'array' then env.value->'seats' else '[]'::jsonb end) s(value)
        join lateral jsonb_array_elements(case when jsonb_typeof(env.value->'sections') = 'array' then env.value->'sections' else '[]'::jsonb end) sec(value)
          on sec.value->>'id' = s.value->>'sectionId'
       where (env.value->>'id') || ':' || (s.value->>'id') = any (p_seats)
         and s.value->>'type' in ('seat', 'table')
         and coalesce(s.value->>'status', 'free') = 'free'
         and sec.value->>'ticketTypeId' ~ '^[0-9a-fA-F-]{36}$'
    ) x
   where exists (select 1 from public.ticket_types tt
                  where tt.id = x.tt and tt.event_id = p_event and tt.is_active and tt.type is distinct from 'coletiva');
  v_ok := jsonb_array_length(v_sel);
  if v_ok <> (select count(distinct x) from unnest(p_seats) x) then
    raise exception 'Algum dos lugares escolhidos não está disponível' using errcode = '22023';
  end if;

  -- meia: cada lugar de meia tem de ser lugar individual ('seat') de tipo com meia (permite_meia, pago, fora de mesa/coletiva).
  -- UMA mensagem para qualquer falha (mesa, tipo sem meia, grátis): não diz qual regra barrou.
  if exists (select 1 from jsonb_array_elements(p_meias) e(v)
              where not exists (select 1 from jsonb_to_recordset(v_sel) r(seat_key text, tt uuid, lugares int, stype text)
                                  join public.ticket_types tt on tt.id = r.tt
                                 where r.seat_key = e.v ->> 'seat_key' and r.stype = 'seat'
                                   and tt.permite_meia and tt.price > 0 and tt.type not in ('mesa', 'coletiva')
                                   and (coalesce(tt.quantity_total, 0) > 0 or coalesce(tt.capacity, 0) > 0))) then -- lotação 0 = cota de 40% sem base: sem meia
    raise exception 'Meia-entrada não disponível para algum dos lugares escolhidos' using errcode = '22023';
  end if;
  -- marca o tipo de meia em cada lugar (nulo = inteira)
  select coalesce(jsonb_agg(r.value || jsonb_build_object('meia_tipo', m.meia_tipo)), '[]'::jsonb) into v_sel
    from jsonb_array_elements(v_sel) r(value)
    left join jsonb_to_recordset(p_meias) m(seat_key text, meia_tipo text) on m.seat_key = r.value ->> 'seat_key';

  -- pedido pelo caminho do #217: preço do banco; os gatilhos conferem estoque, máximo, janela e cancelam o pendente anterior
  select coalesce(nullif(p.full_name, ''), nullif(u.raw_user_meta_data->>'full_name', '')),
         coalesce(nullif(p.email, ''), nullif(u.email, ''))
    into v_nome, v_email
    from (select 1) d
    left join public.profiles p on p.id = v_user
    left join auth.users u on u.id = v_user;
  -- itens por tipo e tipo de meia (ordem de id do tipo: mesma ordem de trava em todo pedido); tudo em centavos
  for l in select r.tt, r.meia_tipo, sum(r.lugares)::int as q, round(tt.price * 100)::bigint as c
             from jsonb_to_recordset(v_sel) r(seat_key text, tt uuid, lugares int, meia_tipo text) join public.ticket_types tt on tt.id = r.tt
            group by r.tt, r.meia_tipo, tt.price order by r.tt, r.meia_tipo nulls first loop
    v_cent := case when l.meia_tipo is null then l.c else public.evk_preco_meia(l.c) end;
    v_sub := v_sub + v_cent * l.q;
    v_taxa := v_taxa + public.evk_taxa_centavos(v_cent, l.meia_tipo is not null) * l.q; -- = app/src/lib/taxa.ts
    if l.meia_tipo is not null then v_meias := v_meias + l.q; end if;
    v_itens := v_itens || jsonb_build_object('tt', l.tt, 'meia_tipo', l.meia_tipo, 'q', l.q, 'cent', v_cent,
                                             'taxa', public.evk_taxa_centavos(v_cent, l.meia_tipo is not null),
                                             'n', jsonb_array_length(v_itens) + 1);
  end loop;
  insert into public.orders (user_id, event_id, subtotal, service_fee, total, status, customer_name, customer_email)
  values (v_user, p_event, v_sub / 100.0, v_taxa / 100.0, (v_sub + v_taxa) / 100.0, 'pending', v_nome, v_email)
  returning id into v_order;

  -- libera o que venceu ou ficou de pedido não pago: pedido pendente vencido é cancelado ANTES, e a reserva guarda o rastro
  update public.orders set status = 'cancelled'
   where status = 'pending' and id in (select order_id from public.pedido_assentos
                                        where event_id = p_event and liberada_em is null and expira_em <= now());
  update public.pedido_assentos pa set liberada_em = now(), expira_em = least(pa.expira_em, now())
    from public.orders o
   where o.id = pa.order_id and pa.event_id = p_event and pa.liberada_em is null
     and o.status <> 'paid' and (o.status <> 'pending' or pa.expira_em <= now());

  -- lugares ANTES dos itens: o guard de estoque confere a meia contra os lugares individuais presos a este pedido
  begin
    insert into public.pedido_assentos (order_id, event_id, seat_key, ticket_type_id, lugares, expira_em)
    select v_order, p_event, r.seat_key, r.tt, r.lugares, v_expira from jsonb_to_recordset(v_sel) r(seat_key text, tt uuid, lugares int);
  exception when unique_violation then
    raise exception 'Lugar acabou de ser escolhido' using errcode = '22023';
  end;
  insert into public.order_items (order_id, ticket_type_id, quantity, unit_price, taxa_unit, subtotal, beneficio, meia_tipo)
  select v_order, y.tt, y.q, round(y.cent / 100.0, 2), round(y.taxa / 100.0, 2), round(y.cent * y.q / 100.0, 2),
         case when y.meia_tipo is null then 'inteira' else 'meia' end, y.meia_tipo
    from jsonb_to_recordset(v_itens) y(tt uuid, meia_tipo text, q int, cent bigint, taxa bigint, n int)
   order by y.n; -- ordem de trava garantida: a do array (por id do tipo)
  return jsonb_build_object('order_id', v_order, 'expira_em', v_expira, 'agora', now(), 'meias', v_meias); -- 'agora' para a contagem do navegador não depender do relógio dele
end;
$_$;


ALTER FUNCTION "public"."reservar_assentos"("p_event" "uuid", "p_seats" "text"[], "p_meias" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reservar_ingressos"("p_event_id" "uuid", "p_itens" "jsonb", "p_cupom" "text" DEFAULT NULL::"text", "p_cpf" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    SET "lock_timeout" TO '5s'
    AS $_$
declare
  v_uid uuid := auth.uid();
  v_ev record;
  v_cup record;
  v_cup_id uuid;
  v_it record;
  v_base bigint := 0;       -- subtotal das inteiras (base do desconto)
  v_desc_nominal bigint := 0;
  v_cent bigint;
  v_d bigint;
  v_taxa_u bigint;
  v_sub bigint := 0;
  v_desc bigint := 0;
  v_taxa bigint := 0;
  v_total bigint;
  v_linhas jsonb := '[]'::jsonb;
  v_order uuid;
  v_ate timestamptz := now() + interval '10 minutes'; -- 10 min fixos, definidos aqui (o cliente não escolhe)
  v_cancel int;
  v_usos int;
  v_n_inteira int;
  v_cpf boolean;
  v_motivo text;
  v_msg text;
  v_mensagem text;
  v_conta boolean := false; -- recusa que conta como tentativa (sonda de cupom ou de CPF)
  v_dig text;
  v_atual text;
  v_h text;
begin
  if v_uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Entre na sua conta para comprar' using errcode = '42501';
  end if;
  if not public.gf_mfa_ok() then
    raise exception 'Confirme o código do 2FA' using errcode = '42501';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) not between 1 and 10 then
    raise exception 'Informe de 1 a 10 itens' using errcode = '22023';
  end if;
  -- valida o JSON ANTES de qualquer cast (texto no lugar de número não pode virar erro 22P02)
  if exists (select 1 from jsonb_array_elements(p_itens) e(v)
              where jsonb_typeof(e.v) <> 'object'
                 or jsonb_typeof(e.v -> 'ticket_type_id') is distinct from 'string'
                 or (e.v ->> 'ticket_type_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                 or jsonb_typeof(e.v -> 'quantidade') is distinct from 'number'
                 or (e.v ->> 'quantidade')::numeric not between 1 and 100 or (e.v ->> 'quantidade')::numeric <> trunc((e.v ->> 'quantidade')::numeric)
                 or coalesce(jsonb_typeof(e.v -> 'beneficio'), 'string') <> 'string'
                 or coalesce(e.v ->> 'beneficio', 'inteira') not in ('inteira', 'meia')
                 or coalesce(jsonb_typeof(e.v -> 'meia_tipo'), 'string') <> 'string') then
    raise exception 'Item inválido (ingresso, quantidade inteira de 1 a 100, benefício inteira ou meia)' using errcode = '22023';
  end if;
  if (select count(*) - count(distinct (x.ticket_type_id, coalesce(x.beneficio, 'inteira'), x.meia_tipo))
        from jsonb_to_recordset(p_itens) as x(ticket_type_id uuid, quantidade int, beneficio text, meia_tipo text)) > 0 then
    raise exception 'Item repetido: some as quantidades do mesmo ingresso e benefício' using errcode = '22023';
  end if;
  select e.id, e.producer_id, upper(btrim(e.venue_state)) as uf into v_ev from public.events e
   where e.id = p_event_id and e.status = 'published' and e.approval_status = 'approved'
     and public.evento_acesso(e.id) in ('aberto', 'link');
  if not found then
    raise exception 'Evento indisponível para venda' using errcode = '22023';
  end if;
  -- meia_tipo: nacional fixo ou estadual cadastrado para a UF do evento
  for v_it in select x.meia_tipo, coalesce(x.beneficio, 'inteira') as beneficio
                from jsonb_to_recordset(p_itens) as x(ticket_type_id uuid, quantidade int, beneficio text, meia_tipo text) loop
    if v_it.beneficio = 'inteira' and v_it.meia_tipo is not null then
      raise exception 'Inteira não tem tipo de meia-entrada' using errcode = '22023';
    end if;
    if v_it.beneficio = 'meia' and (v_it.meia_tipo is null
       or not (v_it.meia_tipo in ('estudante', 'pcd', 'pcd_acompanhante', 'jovem_baixa_renda')
               or exists (select 1 from public.beneficios_uf b where b.uf = v_ev.uf and b.codigo = v_it.meia_tipo))) then
      raise exception 'Tipo de meia-entrada inválido para este evento' using errcode = '22023';
    end if;
  end loop;

  if (select count(distinct x.ticket_type_id) from jsonb_to_recordset(p_itens) as x(ticket_type_id uuid, quantidade int, beneficio text, meia_tipo text))
     <> (select count(*) from public.ticket_types tt where tt.event_id = p_event_id and tt.is_active
          and tt.id in (select x.ticket_type_id from jsonb_to_recordset(p_itens) as x(ticket_type_id uuid, quantidade int, beneficio text, meia_tipo text))) then
    raise exception 'Ingresso não encontrado ou indisponível' using errcode = '22023';
  end if;
  select coalesce(sum(round(tt.price * 100)::bigint * x.quantidade) filter (where coalesce(x.beneficio, 'inteira') = 'inteira'), 0),
         count(*) filter (where coalesce(x.beneficio, 'inteira') = 'inteira'),
         coalesce(bool_or(tt.max_por_cpf is not null), false)
    into v_base, v_n_inteira, v_cpf
    from jsonb_to_recordset(p_itens) as x(ticket_type_id uuid, quantidade int, beneficio text, meia_tipo text)
    join public.ticket_types tt on tt.id = x.ticket_type_id;


  perform pg_advisory_xact_lock(hashtextextended('reserva:' || v_uid || ':' || p_event_id, 0));
  if random() < 0.01 then -- limpeza barata: 1% das chamadas (índice em quando)
    delete from public.tentativas_reserva where quando < now() - interval '1 day';
  end if;
  if (select count(*) from public.tentativas_reserva t where t.user_id = v_uid and t.quando > now() - interval '1 hour') >= 10 then
    raise exception 'Muitas tentativas. Tente de novo mais tarde.' using errcode = '22023';
  end if;
  if (select count(*) from public.orders o
       where o.user_id = v_uid and o.event_id = p_event_id and o.reservado_ate is not null
         and o.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Muitas reservas neste evento. Tente de novo em alguns minutos.' using errcode = '22023';
  end if;

  -- CPF preso à conta (decisão do Ricardo), no corpo principal, FORA da subtransação: o hash fica gravado mesmo se o resto da
  -- reserva falhar, e depois dele a função NUNCA levanta exceção de regra de negócio (devolve {ok:false}). Cada conta sonda
  -- no máximo 1 CPF. Vem antes de qualquer consulta a orders por CPF.
  if v_cpf then
    v_dig := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
    if v_dig = '' then
      raise exception 'Informe o CPF do comprador para este ingresso' using errcode = '22023';
    end if;
    if not public.gf_cpf_valido(v_dig) then
      raise exception 'CPF inválido' using errcode = '22023';
    end if;
    v_h := encode(public.pr7_hmac(v_dig), 'hex');
    select p.cpf_compra_hmac into v_atual from public.profiles p where p.id = v_uid for update;
    if v_atual is null then
      update public.profiles set cpf_compra_hmac = v_h where id = v_uid; -- primeiro uso trava, mesmo que a reserva falhe
    elsif v_atual <> v_h then
      insert into public.tentativas_reserva (user_id, motivo) values (v_uid, 'cpf_da_conta');
      return jsonb_build_object('ok', false, 'motivo', 'cpf_da_conta',
        'mensagem', 'Use o CPF já vinculado à sua conta (se estiver errado, fale com o suporte)');
    end if;
  end if;

  -- Tudo que pode ser recusado por regra de negócio roda numa subtransação: se recusar, a reserva anterior da conta
  -- é preservada (nada fica gravado) e a função devolve {ok:false}, sem exceção, para a tentativa poder ser contada.
  begin
    update public.orders set status = 'cancelled'
     where user_id = v_uid and event_id = p_event_id and status = 'pending' and reservado_ate is not null;
    get diagnostics v_cancel = row_count;

    -- cupom: qualquer recusa levanta o mesmo erro interno (EV001), sem dizer o motivo
    if btrim(coalesce(p_cupom, '')) <> '' then
      if v_n_inteira = 0 then
        raise exception 'O cupom não vale para meia-entrada: tire o cupom ou inclua ingressos inteiros' using errcode = '22023';
      end if;
      select * into v_cup from public.coupons c
       where upper(c.code) = upper(btrim(p_cupom)) and c.producer_id = v_ev.producer_id
         and (c.event_id is null or c.event_id = p_event_id) and c.is_active
         and (c.valid_from is null or c.valid_from <= now()) and (c.valid_until is null or c.valid_until > now())
         and c.audience in ('all', 'first_purchase')
       order by c.id limit 1
       for update;
      if not found
         or (v_cup.audience = 'first_purchase' and exists (select 1 from public.orders o where o.user_id = v_uid and o.status = 'paid'))
         or (v_cup.min_order_value is not null and v_base < round(v_cup.min_order_value * 100)::bigint) then
        raise exception 'cupom' using errcode = 'EV001';
      end if;
      v_cup_id := v_cup.id;
      select count(*) into v_usos from public.orders o
       where o.coupon_id = v_cup.id and (o.status = 'paid' or (o.status = 'pending' and o.reservado_ate > now()));
      if v_cup.max_uses is not null and v_usos >= v_cup.max_uses then
        raise exception 'cupom' using errcode = 'EV001';
      end if;
      select count(*) into v_usos from public.orders o
       where o.coupon_id = v_cup.id and o.user_id = v_uid and (o.status = 'paid' or (o.status = 'pending' and o.reservado_ate > now()));
      if v_cup.max_uses_per_user is not null and v_usos >= v_cup.max_uses_per_user then
        raise exception 'cupom' using errcode = 'EV001';
      end if;
      v_desc_nominal := case v_cup.discount_type
                          when 'percent' then floor(v_base * v_cup.discount_value / 100)::bigint
                          else round(v_cup.discount_value * 100)::bigint end;
      if v_cup.max_discount is not null then
        v_desc_nominal := least(v_desc_nominal, round(v_cup.max_discount * 100)::bigint);
      end if;
      v_desc_nominal := least(v_desc_nominal, v_base);
      if v_desc_nominal <= 0 then -- cupom sem efeito (pedido só de itens grátis ou desconto 0): não grava coupon_id nem queima o cupom
        raise exception 'cupom' using errcode = 'EV001';
      end if;
    end if;

    -- linhas (ordem de id do tipo: mesma ordem de trava em todo pedido, sem impasse)
    for v_it in select x.ticket_type_id, x.quantidade, coalesce(x.beneficio, 'inteira') as beneficio, x.meia_tipo,
                       round(tt.price * 100)::bigint as cent
                  from jsonb_to_recordset(p_itens) as x(ticket_type_id uuid, quantidade int, beneficio text, meia_tipo text)
                  join public.ticket_types tt on tt.id = x.ticket_type_id
                 order by x.ticket_type_id, 3, x.meia_tipo loop
      if v_it.beneficio = 'meia' then
        v_cent := public.evk_preco_meia(v_it.cent);
        v_d := 0; -- cupom não vale na meia
      else
        v_cent := v_it.cent;
        v_d := case when v_base > 0 then (v_desc_nominal * v_cent) / v_base else 0 end; -- rateio: ver cabeçalho
      end if;
      v_taxa_u := public.evk_taxa_centavos(v_cent - v_d, v_it.beneficio = 'meia'); -- TAXA_BASE: preço com desconto (decisão do Ricardo, 30/10)
      v_sub := v_sub + v_cent * v_it.quantidade;
      v_desc := v_desc + v_d * v_it.quantidade;
      v_taxa := v_taxa + v_taxa_u * v_it.quantidade;
      v_linhas := v_linhas || jsonb_build_object('ticket_type_id', v_it.ticket_type_id, 'quantidade', v_it.quantidade,
        'beneficio', v_it.beneficio, 'meia_tipo', v_it.meia_tipo, 'cent', v_cent, 'desc_cent', v_d, 'taxa_cent', v_taxa_u);
    end loop;
    v_total := v_sub - v_desc + v_taxa;

    insert into public.orders (user_id, event_id, coupon_id, subtotal, discount, service_fee, total, status,
                               customer_name, customer_email, customer_cpf, reservado_ate)
    values (v_uid, p_event_id, v_cup_id, round(v_sub / 100.0, 2), round(v_desc / 100.0, 2), round(v_taxa / 100.0, 2), round(v_total / 100.0, 2), 'pending',
            (select nullif(btrim(p.full_name), '') from public.profiles p where p.id = v_uid),
            auth.jwt() ->> 'email', case when v_cpf then nullif(btrim(coalesce(p_cpf, '')), '') end, v_ate)
    returning id into v_order;

    -- um insert por item, em ordem: o guard e a mesa_pedido_guard enxergam os itens anteriores do mesmo pedido
    for v_it in select * from jsonb_to_recordset(v_linhas)
             as y(ticket_type_id uuid, quantidade int, beneficio text, meia_tipo text, cent bigint, taxa_cent bigint) loop
      insert into public.order_items (order_id, ticket_type_id, quantity, unit_price, taxa_unit, subtotal, beneficio, meia_tipo)
      values (v_order, v_it.ticket_type_id, v_it.quantidade, round(v_it.cent / 100.0, 2), round(v_it.taxa_cent / 100.0, 2),
              round(v_it.cent * v_it.quantidade / 100.0, 2), v_it.beneficio, v_it.meia_tipo);
    end loop;
  exception
    when sqlstate 'EV001' then
      v_motivo := 'cupom_invalido';
      v_mensagem := 'Cupom inválido ou não se aplica a este pedido';
      v_conta := true;
    when sqlstate '22023' then
      -- regra de negócio (esgotado, tetos, meia, limite por CPF, ...): vira retorno, para o hash da conta (acima) não ser desfeito
      get stacked diagnostics v_msg = message_text;
      if v_cpf then
        -- pedido com tipo de limite por CPF: UMA resposta só, para a falha por CPF e as outras não se distinguirem (sem oráculo)
        v_motivo := 'indisponivel';
        v_mensagem := 'Não foi possível reservar. Confira quantidade e disponibilidade e tente de novo.';
        -- só a recusa do limite por CPF (e a de muitos CPFs) conta tentativa; esgotado, tetos etc. não bloqueiam o comprador honesto
        v_conta := v_msg like 'Limite de % ingressos por CPF neste ingresso' or v_msg like 'Muitas tentativas com CPFs diferentes%';
      else
        v_motivo := 'regra';
        v_mensagem := v_msg;
      end if;
    when others then
      -- erro inesperado (lock timeout, deadlock 40P01, serialização 40001, ...): com tipo de limite por CPF vira a MESMA resposta
      -- uniforme (o hash da conta, gravado antes, fica); sem ele, relança como antes. Nunca devolve ok:true aqui.
      if v_cpf then
        v_motivo := 'indisponivel';
        v_mensagem := 'Não foi possível reservar. Confira quantidade e disponibilidade e tente de novo.';
      else
        raise;
      end if;
  end;
  if v_motivo is not null then
    if v_conta then -- só as recusas que sondam cupom ou CPF contam tentativa; esgotado, tetos e erros inesperados não
      insert into public.tentativas_reserva (user_id, motivo) values (v_uid, v_motivo);
    end if;
    return jsonb_build_object('ok', false, 'motivo', v_motivo, 'mensagem', v_mensagem);
  end if;

  return jsonb_build_object(
    'ok', true, 'order_id', v_order, 'status', 'pending', 'subtotal', round(v_sub / 100.0, 2), 'desconto', round(v_desc / 100.0, 2),
    'taxa', round(v_taxa / 100.0, 2), 'total', round(v_total / 100.0, 2), 'reservado_ate', v_ate, 'agora', now(), 'itens', v_linhas,
    'aviso', case when v_cancel > 0 then 'Sua reserva anterior neste evento foi substituída por esta.' end);
end;
$_$;


ALTER FUNCTION "public"."reservar_ingressos"("p_event_id" "uuid", "p_itens" "jsonb", "p_cupom" "text", "p_cpf" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table','partitioned table')
  loop
     if cmd.schema_name is not null and cmd.schema_name in ('public') and cmd.schema_name not in ('pg_catalog','information_schema') and cmd.schema_name not like 'pg_toast%' and cmd.schema_name not like 'pg_temp%' then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
      begin
        execute format(
          'create policy gf_mfa_aal2 on %s as restrictive for all to authenticated '
          'using ((select public.gf_mfa_ok())) with check ((select public.gf_mfa_ok()))', cmd.object_identity);
      exception
        when others then
          raise warning 'rls_auto_enable: sem a regra gf_mfa_aal2 em % (%)', cmd.object_identity, sqlerrm;
      end;
     else
        raise log 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     end if;
  end loop;
end;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."salvar_organizador_publico"("p_nome_publico" "text", "p_whatsapp" "text", "p_instagram" "text", "p_site" "text", "p_email_contato" "text", "p_outras_redes" "jsonb", "p_mostrar_nome" boolean, "p_mostrar_whatsapp" boolean, "p_mostrar_instagram" boolean, "p_mostrar_site" boolean, "p_mostrar_email" boolean, "p_mostrar_outras_redes" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_uid uuid := (select auth.uid());
  v_nome text := nullif(btrim(p_nome_publico), '');
  v_zap text := nullif(regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'), '');
  v_insta text := nullif(regexp_replace(btrim(coalesce(p_instagram, '')), '^@', ''), '');
  v_site text := nullif(btrim(p_site), '');
  v_email text := nullif(btrim(p_email_contato), '');
begin
  if v_uid is null then raise exception 'sem sessão' using errcode = '42501'; end if;
  if not public.gf_mfa_ok() then
    raise exception 'Reautenticação de dois fatores necessária.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.producer_profiles where id = v_uid) then
    raise exception 'Só produtores configuram o organizador.' using errcode = '42501';
  end if;
  if v_nome is null then raise exception 'Informe o nome do organizador.' using errcode = '23514'; end if;
  -- WhatsApp sem DDI (10-11 dígitos) ganha o 55; com DDI fica como está
  if v_zap is not null and length(v_zap) <= 11 then v_zap := '55' || v_zap; end if;

  -- formato: o CHECK da tabela recusa o que escapar (errcode 23514). oculto_por_admin nunca é tocado aqui.
  insert into public.producer_public (producer_id, nome_publico, whatsapp, instagram, site,
      email_contato, outras_redes, mostrar_nome, mostrar_whatsapp, mostrar_instagram, mostrar_site, mostrar_email,
      mostrar_outras_redes)
    values (v_uid, v_nome, v_zap, v_insta, v_site, v_email, p_outras_redes,
      coalesce(p_mostrar_nome, true), coalesce(p_mostrar_whatsapp, false), coalesce(p_mostrar_instagram, false),
      coalesce(p_mostrar_site, false), coalesce(p_mostrar_email, false), coalesce(p_mostrar_outras_redes, false))
  on conflict (producer_id) do update set
      nome_publico = excluded.nome_publico,
      whatsapp = excluded.whatsapp, instagram = excluded.instagram, site = excluded.site,
      email_contato = excluded.email_contato, outras_redes = excluded.outras_redes,
      mostrar_nome = excluded.mostrar_nome, mostrar_whatsapp = excluded.mostrar_whatsapp,
      mostrar_instagram = excluded.mostrar_instagram, mostrar_site = excluded.mostrar_site,
      mostrar_email = excluded.mostrar_email, mostrar_outras_redes = excluded.mostrar_outras_redes,
      updated_at = now();
end $$;


ALTER FUNCTION "public"."salvar_organizador_publico"("p_nome_publico" "text", "p_whatsapp" "text", "p_instagram" "text", "p_site" "text", "p_email_contato" "text", "p_outras_redes" "jsonb", "p_mostrar_nome" boolean, "p_mostrar_whatsapp" boolean, "p_mostrar_instagram" boolean, "p_mostrar_site" boolean, "p_mostrar_email" boolean, "p_mostrar_outras_redes" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seating_maps_sem_cpf"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if exists (
    select 1
      from jsonb_array_elements(case when jsonb_typeof(new.environments) = 'array' then new.environments else '[]'::jsonb end) env(value)
      cross join lateral jsonb_array_elements(case when jsonb_typeof(env.value->'sections') = 'array' then env.value->'sections' else '[]'::jsonb end) sec(value)
      join public.ticket_types tt on replace(tt.id::text, '-', '') = replace(lower(sec.value->>'ticketTypeId'), '-', '')
     where tt.event_id = new.event_id and tt.max_por_cpf is not null) then
    raise exception 'Este setor usa um ingresso com limite por CPF: tire o limite do ingresso antes de ligar o setor ao mapa' using errcode = '22023';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."seating_maps_sem_cpf"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_profiles_registra_pagamento"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  insert into public.staff_profiles_historico_pagamento (user_id, alterado_por, antes, depois)
  values (new.user_id, (select auth.uid()),
    jsonb_build_object('pix_tipo_enc', encode(old.pix_tipo_enc, 'hex'), 'pix_chave_enc', encode(old.pix_chave_enc, 'hex'),
      'banco_enc', encode(old.banco_enc, 'hex'), 'agencia_enc', encode(old.agencia_enc, 'hex'), 'conta_enc', encode(old.conta_enc, 'hex')),
    jsonb_build_object('pix_tipo_enc', encode(new.pix_tipo_enc, 'hex'), 'pix_chave_enc', encode(new.pix_chave_enc, 'hex'),
      'banco_enc', encode(new.banco_enc, 'hex'), 'agencia_enc', encode(new.agencia_enc, 'hex'), 'conta_enc', encode(new.conta_enc, 'hex')));
  return null;
end;
$$;


ALTER FUNCTION "public"."staff_profiles_registra_pagamento"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_profiles_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at := now();
  new.nome_completo := normalize(replace(btrim(new.nome_completo), '’', ''''), NFC);
  return new;
end;
$$;


ALTER FUNCTION "public"."staff_profiles_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."team_aceitar_convite"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Entre na sua conta para aceitar o convite.' using errcode = '42501';
  end if;
  -- 2FA: fator confirmado e o código digitado nesta sessão (a mesma exigência de convite_aceitar)
  if not (public.gf_mfa_ok() and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
          and exists (select 1 from auth.mfa_factors f where f.user_id = v_uid and f.status = 'verified')) then
    raise exception 'Ative a verificação em duas etapas e entre com o código antes de aceitar o convite.' using errcode = '42501';
  end if;
  -- colaborador da Evokaa não entra em equipe de produtor (o espelho de convite_criar/convite_aceitar)
  update public.team_members t set accepted_at = now()
  where t.id = p_id and t.user_id = v_uid and t.accepted_at is null and t.blocked_at is null
    and not exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'admin');
  if not found then
    raise exception 'Convite não encontrado ou já aceito.' using errcode = 'P0001';
  end if;
end;
$$;


ALTER FUNCTION "public"."team_aceitar_convite"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."team_contagem"("p_event_id" "uuid") RETURNS TABLE("total" bigint, "usados" bigint, "cancelados" bigint, "transferidos" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select count(*), count(*) filter (where t.status = 'used'), count(*) filter (where t.status in ('cancelled', 'refunded')),
         count(*) filter (where t.status = 'transferred')
  from public.events e
  join public.tickets t on t.event_id = e.id
  where e.id = p_event_id and e.status = 'published' and public.gf_portaria_ok(e.producer_id);
$$;


ALTER FUNCTION "public"."team_contagem"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."team_convidar"("p_email" "text", "p_role" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_uid uuid := (select auth.uid());
  v_alvo uuid;
  v_bloq timestamptz;
begin
  if v_uid is null or not exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'producer') then
    raise exception 'Só a conta do produtor convida para a equipe.' using errcode = '42501';
  end if;
  -- 2FA: fator confirmado e o código digitado nesta sessão (a mesma condição de team_aceitar_convite)
  if not (public.gf_mfa_ok() and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
          and exists (select 1 from auth.mfa_factors f where f.user_id = v_uid and f.status = 'verified')) then
    raise exception 'Ative a verificação em duas etapas no seu perfil e entre com o código para convidar a equipe.' using errcode = '42501';
  end if;
  if p_role is null or p_role not in ('admin', 'editor', 'viewer') then
    raise exception 'Cargo inválido.' using errcode = '22023';
  end if;
  -- trava a linha do produtor: tentativas e limite de 5 sem corrida entre duas chamadas dele
  perform 1 from public.profiles where id = v_uid for update;
  delete from public.team_convite_tentativas where em < now() - interval '1 day';
  if (select count(*) from public.team_convite_tentativas c where c.producer_id = v_uid and c.em > now() - interval '1 hour') >= 20 then
    return jsonb_build_object('ok', false, 'motivo', 'limite');
  end if;
  insert into public.team_convite_tentativas (producer_id) values (v_uid);
  -- equipe cheia ANTES de procurar a conta: a resposta não depende de o e-mail existir
  if (select count(*) from public.team_members t where t.producer_id = v_uid and t.blocked_at is null) >= 5 then
    return jsonb_build_object('ok', false, 'motivo', 'limite_equipe');
  end if;
  -- inexistente, a própria conta e colaborador da Evokaa: a mesma resposta (não diz qual)
  select p.id into v_alvo from public.profiles p
  where lower(btrim(p.email)) = lower(btrim(coalesce(p_email, ''))) and p.id <> v_uid and p.role <> 'admin'
  order by p.created_at nulls last, p.id
  limit 1;
  if v_alvo is null then
    return jsonb_build_object('ok', false, 'motivo', 'generico');
  end if;
  select t.blocked_at into v_bloq from public.team_members t where t.producer_id = v_uid and t.user_id = v_alvo;
  if found then
    return jsonb_build_object('ok', false, 'motivo', case when v_bloq is not null then 'bloqueado' else 'duplicado' end);
  end if;
  insert into public.team_members (producer_id, user_id, role) values (v_uid, v_alvo, p_role);
  return jsonb_build_object('ok', true);
end;
$$;


ALTER FUNCTION "public"."team_convidar"("p_email" "text", "p_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."team_convite_email_reservar"() RETURNS TABLE("user_id" "uuid", "email" "text", "role" "text", "produtor" "text", "reserva" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'producer') then
    raise exception 'Só a conta do produtor envia o convite da equipe.' using errcode = '42501';
  end if;
  if not (public.gf_mfa_ok() and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
          and exists (select 1 from auth.mfa_factors f where f.user_id = v_uid and f.status = 'verified')) then
    raise exception 'Ative a verificação em duas etapas no seu perfil e entre com o código para convidar a equipe.' using errcode = '42501';
  end if;
  -- retenção: controle com mais de 30 dias sai (a janela de 7 dias já não olha para ele)
  delete from public.team_convite_email where reservado_em < now() - interval '30 days';
  -- trava por convidado (em ordem, sem deadlock) antes de contar as 24 h: dois produtores ao mesmo tempo não passam do limite de 3
  perform pg_advisory_xact_lock(hashtext(u.user_id::text)) from (
    select distinct t.user_id from public.team_members t
    where t.producer_id = v_uid and t.accepted_at is null and t.blocked_at is null and t.invited_at > now() - interval '10 minutes'
    order by t.user_id) u;
  -- insert ... on conflict ... where é atômico por linha: duas chamadas ao mesmo tempo não reservam o mesmo par.
  -- Par com e-mail há 7 dias ou mais recomeça (falhas zeradas); dentro dos 7 dias só quem falhou e tem menos de 3 falhas.
  return query
    with r as (
      insert into public.team_convite_email as c (producer_id, user_id, reservado_em)
      select t.producer_id, t.user_id, clock_timestamp() from public.team_members t
      where t.producer_id = v_uid and t.accepted_at is null and t.blocked_at is null
        and t.invited_at > now() - interval '10 minutes'
        -- limite por convidado: 3 reservas de produtores DIFERENTES em 24 h
        and (select count(*) from public.team_convite_email x
             where x.user_id = t.user_id and x.producer_id <> t.producer_id and x.enviado and x.reservado_em > now() - interval '24 hours') < 3
      on conflict (producer_id, user_id) do update
        set reservado_em = excluded.reservado_em, enviado = true,
            falhas = case when c.reservado_em < now() - interval '7 days' then 0 else c.falhas end
        where c.reservado_em < now() - interval '7 days' or (not c.enviado and c.falhas < 3)
      returning c.user_id, c.reservado_em
    )
    select r.user_id, p.email, t.role,
           coalesce(nullif(btrim(pf.company_name), ''), nullif(btrim(pp.full_name), ''), 'Um produtor da Evokaa'),
           r.reservado_em
    from r join public.team_members t on t.producer_id = v_uid and t.user_id = r.user_id
    join public.profiles p on p.id = r.user_id
    left join public.profiles pp on pp.id = v_uid
    left join public.producer_profiles pf on pf.id = v_uid
    order by t.invited_at, t.id;
end;
$$;


ALTER FUNCTION "public"."team_convite_email_reservar"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."team_convite_email_resultado"("p_producer" "uuid", "p_user" "uuid", "p_reserva" timestamp with time zone, "p_ok" boolean) RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  update public.team_convite_email c
  set enviado = false, falhas = c.falhas + 1
  where c.producer_id = p_producer and c.user_id = p_user and c.reservado_em = p_reserva and c.enviado and not p_ok;
$$;


ALTER FUNCTION "public"."team_convite_email_resultado"("p_producer" "uuid", "p_user" "uuid", "p_reserva" timestamp with time zone, "p_ok" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."team_eventos"() RETURNS TABLE("id" "uuid", "title" "text", "start_date" timestamp with time zone, "producer_id" "uuid", "producer_name" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select e.id, e.title, e.start_date, e.producer_id, coalesce(nullif(btrim(p.full_name), ''), 'Produtor')
  from public.events e
  left join public.profiles p on p.id = e.producer_id
  where e.status = 'published' and public.gf_portaria_ok(e.producer_id)
  order by e.start_date, e.id;
$$;


ALTER FUNCTION "public"."team_eventos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."team_lista"() RETURNS TABLE("id" "uuid", "user_id" "uuid", "role" "text", "invited_at" timestamp with time zone, "accepted_at" timestamp with time zone, "blocked_at" timestamp with time zone, "full_name" "text", "email" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not public.gf_mfa_ok()
     or not exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'producer') then
    raise exception 'Só a conta do produtor vê a equipe.' using errcode = '42501';
  end if;
  return query
    select t.id, t.user_id, t.role, t.invited_at, t.accepted_at, t.blocked_at,
           coalesce(nullif(btrim(p.full_name), ''), 'Convidado'), p.email
    from public.team_members t
    left join public.profiles p on p.id = t.user_id
    where t.producer_id = v_uid
    order by t.invited_at, t.id;
end;
$$;


ALTER FUNCTION "public"."team_lista"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."team_lista_ingressos"("p_event_id" "uuid") RETURNS TABLE("id" "uuid", "buyer_name" "text", "status" "text", "checked_in_at" timestamp with time zone, "tipo" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select t.id, t.buyer_name, t.status, t.checked_in_at, tt.name
  from public.events e
  join public.tickets t on t.event_id = e.id
  left join public.ticket_types tt on tt.id = t.ticket_type_id
  where e.id = p_event_id and e.status = 'published' and public.gf_portaria_ok(e.producer_id)
  order by t.created_at desc, t.id
  limit 1000;
$$;


ALTER FUNCTION "public"."team_lista_ingressos"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."team_meus_convites"() RETURNS TABLE("id" "uuid", "producer_id" "uuid", "producer_name" "text", "role" "text", "invited_at" timestamp with time zone, "accepted_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  -- conta com 2FA sem o código nesta sessão: avisa em vez de lista vazia (a tela pede o código)
  if not public.gf_mfa_ok() then
    raise exception 'Entre com o código da verificação em duas etapas para ver seus convites.' using errcode = '42501';
  end if;
  return query
    select t.id, t.producer_id, coalesce(nullif(btrim(p.full_name), ''), 'Produtor'), t.role, t.invited_at, t.accepted_at
    from public.team_members t
    left join public.profiles p on p.id = t.producer_id
    where t.user_id = (select auth.uid()) and t.blocked_at is null
    order by t.accepted_at is not null, t.invited_at desc;
end;
$$;


ALTER FUNCTION "public"."team_meus_convites"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tem_ingresso"("p_event" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1 from public.tickets t
    where t.event_id = p_event and t.user_id = (select auth.uid())
  );
$$;


ALTER FUNCTION "public"."tem_ingresso"("p_event" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ticket_types_cpf_sem_mapa"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if public.tipo_no_mapa(new.id) then
    raise exception 'Este ingresso é vendido por lugar marcado: não use limite por CPF nele' using errcode = '22023';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."ticket_types_cpf_sem_mapa"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ticket_types_sem_meia_mesa"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if new.type in ('mesa', 'coletiva') then new.permite_meia := false; end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."ticket_types_sem_meia_mesa"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tipo_no_mapa"("p_tt" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
      from public.ticket_types tt
      join public.seating_maps m on m.event_id = tt.event_id and m.is_active
      cross join lateral jsonb_array_elements(case when jsonb_typeof(m.environments) = 'array' then m.environments else '[]'::jsonb end) env(value)
      cross join lateral jsonb_array_elements(case when jsonb_typeof(env.value->'sections') = 'array' then env.value->'sections' else '[]'::jsonb end) sec(value)
     where tt.id = p_tt and replace(lower(sec.value->>'ticketTypeId'), '-', '') = replace(p_tt::text, '-', '')); -- só os dígitos: uuid com hífens fora do padrão (que o ::uuid da reservar_assentos aceita) também casa; sem cast, sem exceção
$$;


ALTER FUNCTION "public"."tipo_no_mapa"("p_tt" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."venda_bloqueada"("p_ticket_type" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select case
    when x.fim <= now() then 'Este evento já terminou'
    when x.sale_start > now() then 'Vendas ainda não abriram'
    when x.sale_end <= now() then 'Vendas encerradas'
  end
  from (
    select tt.sale_start, tt.sale_end,
           coalesce(e.end_date, i.inicio + case when e.date is not null and e."time" is null then interval '24 hours' else interval '12 hours' end) as fim
      from public.ticket_types tt
      join public.events e on e.id = tt.event_id
      cross join lateral (select case when e.date is not null
          then (e.date + coalesce(e."time", time '00:00')) at time zone 'America/Sao_Paulo' else e.start_date end as inicio) i
     where tt.id = p_ticket_type) x;
$$;


ALTER FUNCTION "public"."venda_bloqueada"("p_ticket_type" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."vincular_afiliado"("p_email" "text", "p_evento" "uuid", "p_comissao" numeric) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_uid uuid := (select auth.uid());
  v_alvo uuid;
  v_nasc date;
begin
  if not public.gf_mfa_ok() then
    raise exception 'Confirme o código do 2FA' using errcode = '42501';
  end if;
  if v_uid is null
     or not exists (select 1 from public.profiles where id = v_uid and role = 'producer')
     or not exists (select 1 from public.events where id = p_evento and producer_id = v_uid) then
    return 'sem_permissao';
  end if;
  -- conta de produtor descartável recém-criada não sonda e-mails (DECISÕES 10)
  -- DECISÕES 17: auth.users, não profiles (que o usuário edita); sem data (nula) conta como recente
  if not exists (select 1 from auth.users where id = v_uid and created_at <= now() - interval '24 hours') then
    return 'conta_recente';
  end if;
  if p_email is null or btrim(p_email) = '' or length(p_email) > 254 then
    return 'email_invalido';
  end if;
  if p_comissao is null or p_comissao < 0.01 or p_comissao > 100 then
    return 'comissao_invalida';
  end if;

  -- limite: 20 tentativas por hora e 100 por dia por produtor (DECISÕES 11); a trava serializa as chamadas
  perform pg_advisory_xact_lock(hashtextextended('vincular_afiliado:' || v_uid::text, 0));
  delete from public.afiliado_tentativas where producer_id = v_uid and criado_em < now() - interval '24 hours';
  if (select count(*) from public.afiliado_tentativas where producer_id = v_uid) >= 100
     or (select count(*) from public.afiliado_tentativas
          where producer_id = v_uid and criado_em > now() - interval '1 hour') >= 20 then
    return 'limite';
  end if;
  insert into public.afiliado_tentativas (producer_id) values (v_uid);

  select u.id, p.birth_date into v_alvo, v_nasc
    from auth.users u
    join public.profiles p on p.id = u.id
   where lower(u.email) = lower(btrim(p_email))
     and u.email_confirmed_at is not null
     and u.deleted_at is null
     and not u.is_anonymous
   limit 1;
  if v_alvo = v_uid then
    return 'proprio';
  end if;
  -- mesma resposta para "não existe" e "existe mas não pode" (DECISÕES 10)
  if v_alvo is null or v_nasc is null or v_nasc > (current_date - interval '18 years')::date then
    return 'nao_encontrado';
  end if;

  insert into public.affiliates (producer_id, event_id, affiliate_user_id, commission_percent)
  values (v_uid, p_evento, v_alvo, round(p_comissao, 2))
  on conflict (affiliate_user_id, event_id) do nothing;
  if not found then
    return 'ja_vinculado';
  end if;
  return 'ok';
end;
$$;


ALTER FUNCTION "public"."vincular_afiliado"("p_email" "text", "p_evento" "uuid", "p_comissao" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."vitrine_ingressos"("p_event_id" "uuid") RETURNS TABLE("ticket_type_id" "uuid", "nome" "text", "preco" numeric, "taxa" numeric, "preco_meia" numeric, "taxa_meia" numeric, "permite_meia" boolean, "disponiveis" integer, "meias_disponiveis" integer, "meias_total" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select x.id, x.name, x.cent / 100.0, public.evk_taxa_centavos(x.cent) / 100.0,
         case when x.meia_ok then public.evk_preco_meia(x.cent) / 100.0 end,
         case when x.meia_ok then public.evk_taxa_centavos(public.evk_preco_meia(x.cent), true) / 100.0 end,
         x.meia_ok,
         case when x.lot > 0 then greatest(x.lot - x.sold - x.res - greatest(x.cota - x.meias, 0), 0)::int end,
         case when x.meia_ok then case when x.lot > 0 then greatest(least(x.cota - x.meias, x.lot - x.sold - x.res), 0)::int end else 0 end,
         case when x.meia_ok and x.lot > 0 then x.cota else 0 end
    from (
      select tt.id, tt.name, tt.sort_order, tt.created_at, round(tt.price * 100)::bigint as cent,
             case when coalesce(tt.quantity_total, 0) > 0 then tt.quantity_total when coalesce(tt.capacity, 0) > 0 then tt.capacity else 0 end as lot,
             coalesce(tt.sold, 0) as sold,
             (tt.permite_meia and tt.type not in ('mesa', 'coletiva') and tt.price > 0 and not public.tipo_no_mapa(tt.id)) as meia_ok,
             (select coalesce(sum(oi.quantity), 0) from public.order_items oi join public.orders o on o.id = oi.order_id
               where oi.ticket_type_id = tt.id and o.status = 'pending'
                 and coalesce(o.reservado_ate > now(), o.created_at > now() - case when exists (select 1 from public.pedido_assentos pa where pa.order_id = o.id and pa.liberada_em is null)
                                     then interval '10 minutes' else interval '30 minutes' end))::int as res,
             (select coalesce(sum(oi.quantity), 0) from public.order_items oi join public.orders o on o.id = oi.order_id
               where oi.ticket_type_id = tt.id and oi.beneficio = 'meia' and (o.status = 'paid' or (o.status = 'pending'
                 and coalesce(o.reservado_ate > now(), o.created_at > now() - case when exists (select 1 from public.pedido_assentos pa where pa.order_id = o.id and pa.liberada_em is null)
                                     then interval '10 minutes' else interval '30 minutes' end))))::int as meias,
             case when (tt.permite_meia and tt.type not in ('mesa', 'coletiva') and tt.price > 0 and not public.tipo_no_mapa(tt.id))
                  then ((case when coalesce(tt.quantity_total, 0) > 0 then tt.quantity_total when coalesce(tt.capacity, 0) > 0 then tt.capacity else 0 end) * 4 + 9) / 10
                  else 0 end as cota
        from public.ticket_types tt
       where tt.event_id = p_event_id and tt.is_active
         and public.evento_acesso(p_event_id) in ('aberto', 'link')
         and exists (select 1 from public.events e where e.id = p_event_id and e.status = 'published' and e.approval_status = 'approved')
    ) x
   order by x.sort_order nulls last, x.created_at;
$$;


ALTER FUNCTION "public"."vitrine_ingressos"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."withdrawals_quem_processou"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if tg_op = 'INSERT' then
    new.processed_by := null; -- saque novo ainda não foi processado por ninguém
  elsif new.status is distinct from old.status then
    -- sem sessão (service_role, webhook) fica nulo: nunca mantém o admin do status anterior
    new.processed_by := (select auth.uid());
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."withdrawals_quem_processou"() OWNER TO "postgres";


CREATE TEXT SEARCH CONFIGURATION "public"."pt_sem_acento" (
    PARSER = "pg_catalog"."default" );

ALTER TEXT SEARCH CONFIGURATION "public"."pt_sem_acento"
    ADD MAPPING FOR "asciiword" WITH "portuguese_stem";

ALTER TEXT SEARCH CONFIGURATION "public"."pt_sem_acento"
    ADD MAPPING FOR "word" WITH "extensions"."unaccent", "portuguese_stem";

ALTER TEXT SEARCH CONFIGURATION "public"."pt_sem_acento"
    ADD MAPPING FOR "numword" WITH "simple";

ALTER TEXT SEARCH CONFIGURATION "public"."pt_sem_acento"
    ADD MAPPING FOR "email" WITH "simple";

ALTER TEXT SEARCH CONFIGURATION "public"."pt_sem_acento"
    ADD MAPPING FOR "url" WITH "simple";

ALTER TEXT SEARCH CONFIGURATION "public"."pt_sem_acento"
    ADD MAPPING FOR "host" WITH "simple";

ALTER TEXT SEARCH CONFIGURATION "public"."pt_sem_acento"
    ADD MAPPING FOR "sfloat" WITH "simple";

ALTER TEXT SEARCH CONFIGURATION "public"."pt_sem_acento"
    ADD MAPPING FOR "version" WITH "simple";

ALTER TEXT SEARCH CONFIGURATION "public"."pt_sem_acento"
    ADD MAPPING FOR "hword_numpart" WITH "simple";

ALTER TEXT SEARCH CONFIGURATION "public"."pt_sem_acento"
    ADD MAPPING FOR "hword_part" WITH "extensions"."unaccent", "portuguese_stem";

ALTER TEXT SEARCH CONFIGURATION "public"."pt_sem_acento"
    ADD MAPPING FOR "hword_asciipart" WITH "portuguese_stem";

ALTER TEXT SEARCH CONFIGURATION "public"."pt_sem_acento"
    ADD MAPPING FOR "numhword" WITH "simple";

ALTER TEXT SEARCH CONFIGURATION "public"."pt_sem_acento"
    ADD MAPPING FOR "asciihword" WITH "portuguese_stem";

ALTER TEXT SEARCH CONFIGURATION "public"."pt_sem_acento"
    ADD MAPPING FOR "hword" WITH "extensions"."unaccent", "portuguese_stem";

ALTER TEXT SEARCH CONFIGURATION "public"."pt_sem_acento"
    ADD MAPPING FOR "url_path" WITH "simple";

ALTER TEXT SEARCH CONFIGURATION "public"."pt_sem_acento"
    ADD MAPPING FOR "file" WITH "simple";

ALTER TEXT SEARCH CONFIGURATION "public"."pt_sem_acento"
    ADD MAPPING FOR "float" WITH "simple";

ALTER TEXT SEARCH CONFIGURATION "public"."pt_sem_acento"
    ADD MAPPING FOR "int" WITH "simple";

ALTER TEXT SEARCH CONFIGURATION "public"."pt_sem_acento"
    ADD MAPPING FOR "uint" WITH "simple";


ALTER TEXT SEARCH CONFIGURATION "public"."pt_sem_acento" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."academy_courses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "instructor" "text",
    "duration" "text",
    "lessons" integer DEFAULT 0,
    "level" "text" DEFAULT 'iniciante'::"text",
    "category" "text",
    "students" integer DEFAULT 0,
    "rating" numeric DEFAULT 0,
    "locked" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "academy_courses_level_check" CHECK (("level" = ANY (ARRAY['iniciante'::"text", 'intermediario'::"text", 'avancado'::"text"])))
);


ALTER TABLE "public"."academy_courses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."access_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "event" "text" DEFAULT 'login'::"text" NOT NULL,
    "ip" "inet",
    "forwarded_for" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "access_logs_event_check" CHECK (("event" = 'login'::"text")),
    CONSTRAINT "access_logs_forwarded_for_check" CHECK (("length"("forwarded_for") <= 200)),
    CONSTRAINT "access_logs_user_agent_check" CHECK (("length"("user_agent") <= 300))
);


ALTER TABLE "public"."access_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_audit_log" (
    "id" bigint NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "autor" "uuid",
    "tipo" "text" NOT NULL,
    "acao" "text" NOT NULL,
    "tabela" "text" NOT NULL,
    "objeto_id" "text",
    "antes" "jsonb",
    "depois" "jsonb",
    "motivo" "text",
    "ip" "inet",
    CONSTRAINT "admin_audit_log_acao_ok" CHECK ((("char_length"("acao") >= 1) AND ("char_length"("acao") <= 60))),
    CONSTRAINT "admin_audit_log_motivo_ok" CHECK (("char_length"("motivo") <= 500)),
    CONSTRAINT "admin_audit_log_objeto_ok" CHECK (("char_length"("objeto_id") <= 80)),
    CONSTRAINT "admin_audit_log_tabela_ok" CHECK ((("char_length"("tabela") >= 1) AND ("char_length"("tabela") <= 60))),
    CONSTRAINT "admin_audit_log_tipo_ok" CHECK (("tipo" = ANY (ARRAY['acao'::"text", 'leitura'::"text"])))
);


ALTER TABLE "public"."admin_audit_log" OWNER TO "postgres";


ALTER TABLE "public"."admin_audit_log" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."admin_audit_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."admin_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "cargo" "text" NOT NULL,
    "permissions" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "token_hash" "text" NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "used_by" "uuid",
    "used_at" timestamp with time zone,
    "aviso_em" timestamp with time zone,
    CONSTRAINT "admin_invites_cargo_ok" CHECK ((("char_length"("btrim"("cargo")) >= 2) AND ("char_length"("btrim"("cargo")) <= 80))),
    CONSTRAINT "admin_invites_email_ok" CHECK ((("email" = "lower"("btrim"("email"))) AND ("char_length"("email") <= 254) AND ("email" ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::"text"))),
    CONSTRAINT "admin_invites_permissions_ok" CHECK ("public"."convite_permissoes_ok"("permissions")),
    CONSTRAINT "admin_invites_status_ok" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'usado'::"text", 'cancelado'::"text"]))),
    CONSTRAINT "admin_invites_token_hash_ok" CHECK (("token_hash" ~ '^[0-9a-f]{64}$'::"text"))
);


ALTER TABLE "public"."admin_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."affiliate_coupon_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "affiliate_id" "uuid" NOT NULL,
    "discount_percent" numeric NOT NULL,
    "valid_days" integer NOT NULL,
    "plans" "text"[],
    "prospect" "text",
    "reason" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "admin_notes" "text",
    "coupon_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "decided_at" timestamp with time zone,
    "decided_by" "uuid",
    CONSTRAINT "affiliate_coupon_requests_admin_notes_check" CHECK (("char_length"("admin_notes") <= 500)),
    CONSTRAINT "affiliate_coupon_requests_discount_percent_check" CHECK (("discount_percent" = ANY (ARRAY[(5)::numeric, (10)::numeric, (15)::numeric, (20)::numeric, (25)::numeric]))),
    CONSTRAINT "affiliate_coupon_requests_plans_check" CHECK ((("plans" IS NULL) OR ("plans" <@ ARRAY['starter'::"text", 'plus'::"text", 'pro'::"text", 'enterprise'::"text"]))),
    CONSTRAINT "affiliate_coupon_requests_prospect_check" CHECK (("char_length"("prospect") <= 200)),
    CONSTRAINT "affiliate_coupon_requests_reason_check" CHECK (("char_length"("reason") <= 1000)),
    CONSTRAINT "affiliate_coupon_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "affiliate_coupon_requests_valid_days_check" CHECK ((("valid_days" >= 1) AND ("valid_days" <= 30)))
);


ALTER TABLE "public"."affiliate_coupon_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."affiliate_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "affiliate_id" "uuid" NOT NULL,
    "slug" "text" NOT NULL,
    "label" "text",
    "clicks" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "affiliate_links_clicks_check" CHECK (("clicks" >= 0)),
    CONSTRAINT "affiliate_links_label_check" CHECK (("char_length"("label") <= 80)),
    CONSTRAINT "affiliate_links_slug_check" CHECK ((("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::"text") AND (("char_length"("slug") >= 2) AND ("char_length"("slug") <= 40))))
);


ALTER TABLE "public"."affiliate_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."affiliates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producer_id" "uuid" NOT NULL,
    "event_id" "uuid",
    "affiliate_user_id" "uuid" NOT NULL,
    "commission_percent" numeric(5,2) DEFAULT 10.00 NOT NULL,
    "sales" integer DEFAULT 0 NOT NULL,
    "total_earned" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "affiliates_commission_percent_check" CHECK ((("commission_percent" >= 0.01) AND ("commission_percent" <= (100)::numeric))),
    CONSTRAINT "affiliates_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."affiliates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."afiliado_tentativas" (
    "id" bigint NOT NULL,
    "producer_id" "uuid" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."afiliado_tentativas" OWNER TO "postgres";


ALTER TABLE "public"."afiliado_tentativas" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."afiliado_tentativas_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."ai_credit_grants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "amount" integer NOT NULL,
    "note" "text",
    "created_by" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_credit_grants_amount_check" CHECK ((("amount" >= 1) AND ("amount" <= 10000))),
    CONSTRAINT "ai_credit_grants_note_check" CHECK (("char_length"("note") <= 200))
);


ALTER TABLE "public"."ai_credit_grants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_settings" (
    "id" integer DEFAULT 1 NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "model_router" "text" DEFAULT 'gemini-3.1-flash-lite'::"text" NOT NULL,
    "model_simple" "text" DEFAULT 'gemini-3.1-flash-lite'::"text" NOT NULL,
    "model_complex" "text" DEFAULT 'gemini-3.8-flash'::"text" NOT NULL,
    "model_vision" "text" DEFAULT 'gemini-3.8-flash'::"text" NOT NULL,
    "prices" "jsonb" DEFAULT '{"gemini-3.7-flash": {"in": 0.75, "out": 3.75}, "gemini-3.8-flash": {"in": 0.75, "out": 3.75}, "gemini-3.1-flash-lite": {"in": 0.25, "out": 1.5}, "gemini-3.5-flash-lite": {"in": 0.30, "out": 2.5}, "gemini-3.1-pro-preview": {"in": 2, "out": 12}}'::"jsonb" NOT NULL,
    "usd_brl" numeric(8,4) DEFAULT 5.213 NOT NULL,
    "daily_cap_brl" numeric(10,2) DEFAULT 50 NOT NULL,
    "hourly_limit" integer DEFAULT 20 NOT NULL,
    "quotas" "jsonb" DEFAULT '{"pro": 60, "free": 5, "plus": 20, "starter": 5, "enterprise": 1000}'::"jsonb" NOT NULL,
    "credit_cost" "jsonb" DEFAULT '{"imagem": 5, "simples": 1, "complexo": 3}'::"jsonb" NOT NULL,
    "max_steps" integer DEFAULT 5 NOT NULL,
    "max_output_tokens" integer DEFAULT 2048 NOT NULL,
    "key_updated_at" timestamp with time zone,
    "key_updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ai_settings_id_check" CHECK (("id" = 1)),
    CONSTRAINT "ai_settings_max_output_tokens_check" CHECK ((("max_output_tokens" >= 256) AND ("max_output_tokens" <= 8192))),
    CONSTRAINT "ai_settings_max_steps_check" CHECK ((("max_steps" >= 1) AND ("max_steps" <= 8)))
);


ALTER TABLE "public"."ai_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "mode" "text" NOT NULL,
    "tier" "text" NOT NULL,
    "model" "text",
    "tokens_in" integer DEFAULT 0 NOT NULL,
    "tokens_out" integer DEFAULT 0 NOT NULL,
    "cost_usd" numeric(12,6) DEFAULT 0 NOT NULL,
    "credits" integer DEFAULT 0 NOT NULL,
    "steps" integer DEFAULT 0 NOT NULL,
    "tools" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "resumo" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    CONSTRAINT "ai_usage_mode_check" CHECK (("mode" = ANY (ARRAY['chat'::"text", 'planejar'::"text", 'ping'::"text"]))),
    CONSTRAINT "ai_usage_resumo_check" CHECK (("char_length"("resumo") <= 500)),
    CONSTRAINT "ai_usage_status_check" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'ok'::"text", 'erro'::"text"]))),
    CONSTRAINT "ai_usage_tier_check" CHECK (("tier" = ANY (ARRAY['simples'::"text", 'complexo'::"text", 'imagem'::"text", 'fora_do_escopo'::"text"])))
);


ALTER TABLE "public"."ai_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."beneficios_uf" (
    "uf" character(2) NOT NULL,
    "codigo" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "documento" "text" NOT NULL
);


ALTER TABLE "public"."beneficios_uf" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."certificates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "template" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."certificates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "origin" "text" DEFAULT 'app'::"text" NOT NULL,
    "marketing_opt_in" boolean DEFAULT false NOT NULL,
    "marketing_opt_in_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chat_contacts_email_check" CHECK (("email" ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::"text")),
    CONSTRAINT "chat_contacts_name_check" CHECK ((("char_length"("name") >= 2) AND ("char_length"("name") <= 120))),
    CONSTRAINT "chat_contacts_origin_check" CHECK (("origin" = ANY (ARRAY['site'::"text", 'app'::"text", 'migracao'::"text"]))),
    CONSTRAINT "chat_contacts_phone_check" CHECK (("phone" ~ '^55[1-9]{2}9?[0-9]{8}$'::"text"))
);


ALTER TABLE "public"."chat_contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_departments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "default_assignee" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chat_departments_name_check" CHECK ((("char_length"("name") >= 2) AND ("char_length"("name") <= 60))),
    CONSTRAINT "chat_departments_slug_check" CHECK (("slug" ~ '^[a-z_]{2,40}$'::"text"))
);


ALTER TABLE "public"."chat_departments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_settings" (
    "id" integer DEFAULT 1 NOT NULL,
    "hours" "jsonb" DEFAULT '{"1": ["09:00", "18:00"], "2": ["09:00", "18:00"], "3": ["09:00", "18:00"], "4": ["09:00", "18:00"], "5": ["09:00", "18:00"]}'::"jsonb" NOT NULL,
    "response_time" "text" DEFAULT 'Respondemos em até 1 dia útil.'::"text" NOT NULL,
    "team_email" "text" DEFAULT 'contato@evokaa.com.br'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "bot_enabled" boolean DEFAULT true NOT NULL,
    CONSTRAINT "chat_settings_id_check" CHECK (("id" = 1)),
    CONSTRAINT "chat_settings_response_time_check" CHECK (("char_length"("response_time") <= 120)),
    CONSTRAINT "chat_settings_team_email_check" CHECK (("team_email" ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::"text"))
);


ALTER TABLE "public"."chat_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_topics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "audience" "text" NOT NULL,
    "label" "text" NOT NULL,
    "hint" "text",
    "department_id" "uuid",
    "requires_ticket" boolean DEFAULT false NOT NULL,
    "urgent" boolean DEFAULT false NOT NULL,
    "mediation" boolean DEFAULT false NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "bot" boolean DEFAULT true NOT NULL,
    "script" "text",
    CONSTRAINT "chat_topics_audience_check" CHECK (("audience" = ANY (ARRAY['site'::"text", 'producer'::"text", 'participant_evokaa'::"text", 'participant_producer'::"text"]))),
    CONSTRAINT "chat_topics_destino_chk" CHECK ((("audience" = 'participant_producer'::"text") = ("department_id" IS NULL))),
    CONSTRAINT "chat_topics_hint_check" CHECK (("char_length"("hint") <= 300)),
    CONSTRAINT "chat_topics_label_check" CHECK ((("char_length"("label") >= 2) AND ("char_length"("label") <= 120))),
    CONSTRAINT "chat_topics_script_check" CHECK (("script" = 'ingresso'::"text"))
);


ALTER TABLE "public"."chat_topics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."check_ins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "checked_in_by" "uuid",
    "checked_in_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."check_ins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."collective_tables" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "ticket_type_id" "uuid",
    "name" "text" NOT NULL,
    "theme" "text",
    "capacity" integer DEFAULT 6 NOT NULL,
    "compatibility_score" numeric(4,1),
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "icebreaker_question" "text",
    "icebreaker_sent_at" timestamp with time zone,
    CONSTRAINT "collective_tables_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'full'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."collective_tables" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "subject" "text",
    "message" "text" NOT NULL,
    "page" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."contact_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_rate_limit_hits" (
    "id" bigint NOT NULL,
    "ip" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."contact_rate_limit_hits" OWNER TO "postgres";


ALTER TABLE "public"."contact_rate_limit_hits" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."contact_rate_limit_hits_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."conversation_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_id" "uuid",
    "sender_role" "text" NOT NULL,
    "sender_name" "text" NOT NULL,
    "body" "text" DEFAULT ''::"text" NOT NULL,
    "is_internal" boolean DEFAULT false NOT NULL,
    "attachment_path" "text",
    "attachment_name" "text",
    "attachment_mime" "text",
    "attachment_size" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "bot_layer" smallint,
    "bot_state" "text",
    CONSTRAINT "conversation_messages_attachment_name_check" CHECK (("char_length"("attachment_name") <= 200)),
    CONSTRAINT "conversation_messages_attachment_path_check" CHECK (("char_length"("attachment_path") <= 300)),
    CONSTRAINT "conversation_messages_body_check" CHECK (("char_length"("body") <= 4000)),
    CONSTRAINT "conversation_messages_bot_state_check" CHECK (("bot_state" = ANY (ARRAY['bot'::"text", 'humano'::"text"]))),
    CONSTRAINT "conversation_messages_check" CHECK ((("bot_layer" IS NULL) OR (("bot_layer" = ANY (ARRAY[1, 2])) AND ("sender_role" = 'bot'::"text")))),
    CONSTRAINT "conversation_messages_conteudo_chk" CHECK ((("body" <> ''::"text") OR ("attachment_path" IS NOT NULL))),
    CONSTRAINT "conversation_messages_nota_chk" CHECK ((NOT ("is_internal" AND ("sender_role" = 'customer'::"text")))),
    CONSTRAINT "conversation_messages_sender_name_check" CHECK ((("char_length"("sender_name") >= 1) AND ("char_length"("sender_name") <= 120))),
    CONSTRAINT "conversation_messages_sender_role_check" CHECK (("sender_role" = ANY (ARRAY['customer'::"text", 'agent'::"text", 'producer'::"text", 'bot'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."conversation_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contact_id" "uuid",
    "user_id" "uuid",
    "kind" "text" DEFAULT 'evokaa'::"text" NOT NULL,
    "topic_id" "uuid",
    "department_id" "uuid",
    "event_id" "uuid",
    "producer_id" "uuid",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "assignee_id" "uuid",
    "customer_last_read_at" timestamp with time zone,
    "agent_last_read_at" timestamp with time zone,
    "first_response_at" timestamp with time zone,
    "resolved_at" timestamp with time zone,
    "last_message_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_message_preview" "text",
    "last_customer_message_at" timestamp with time zone,
    "last_reply_at" timestamp with time zone,
    "rating" smallint,
    "customer_emailed_at" timestamp with time zone,
    "team_alerted_at" timestamp with time zone,
    "notify_failures" integer DEFAULT 0 NOT NULL,
    "notify_claimed_until" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "assignee_name" "text",
    "bot_state" "text" DEFAULT 'humano'::"text" NOT NULL,
    "handoff_at" timestamp with time zone,
    "handoff_reason" "text",
    "bot_tries" integer DEFAULT 0 NOT NULL,
    "bot_resolveu" boolean DEFAULT false NOT NULL,
    CONSTRAINT "conversations_assignee_name_check" CHECK (("char_length"("assignee_name") <= 60)),
    CONSTRAINT "conversations_bot_state_check" CHECK (("bot_state" = ANY (ARRAY['bot'::"text", 'humano'::"text"]))),
    CONSTRAINT "conversations_handoff_reason_check" CHECK (("handoff_reason" = ANY (ARRAY['pedido'::"text", 'sem_resposta'::"text", 'nao_resolveu'::"text", 'anexo'::"text", 'erro'::"text", 'atendente'::"text", 'desligado'::"text"]))),
    CONSTRAINT "conversations_kind_check" CHECK (("kind" = ANY (ARRAY['evokaa'::"text", 'producer'::"text"]))),
    CONSTRAINT "conversations_last_message_preview_check" CHECK (("char_length"("last_message_preview") <= 140)),
    CONSTRAINT "conversations_priority_check" CHECK (("priority" = ANY (ARRAY['normal'::"text", 'urgent'::"text"]))),
    CONSTRAINT "conversations_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 3))),
    CONSTRAINT "conversations_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'resolved'::"text"])))
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coupons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producer_id" "uuid",
    "event_id" "uuid",
    "code" "text" NOT NULL,
    "discount_type" "text" DEFAULT 'percent'::"text" NOT NULL,
    "discount_value" numeric(10,2) NOT NULL,
    "max_uses" integer,
    "uses" integer DEFAULT 0 NOT NULL,
    "valid_until" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "description" "text",
    "valid_from" timestamp with time zone,
    "max_uses_per_user" integer,
    "min_order_value" numeric,
    "max_discount" numeric,
    "audience" "text" DEFAULT 'all'::"text" NOT NULL,
    "plans" "text"[],
    "duration" "text",
    "duration_months" integer,
    "created_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "affiliate_id" "uuid",
    "upgrade_from" "text"[],
    CONSTRAINT "coupons_afiliado_chk" CHECK ((("affiliate_id" IS NULL) OR (("producer_id" IS NULL) AND ("discount_type" = 'percent'::"text") AND ("discount_value" = ANY (ARRAY[(5)::numeric, (10)::numeric, (15)::numeric, (20)::numeric, (25)::numeric])) AND ("valid_until" IS NOT NULL) AND ("valid_until" <= (COALESCE("valid_from", "created_at") + '720:00:00'::interval)) AND ("max_uses_per_user" = 1)))),
    CONSTRAINT "coupons_audience_chk" CHECK (("audience" = ANY (ARRAY['all'::"text", 'first_purchase'::"text", 'first_subscription'::"text", 'private'::"text"]))),
    CONSTRAINT "coupons_discount_type_check" CHECK (("discount_type" = ANY (ARRAY['percent'::"text", 'fixed'::"text"]))),
    CONSTRAINT "coupons_duracao_chk" CHECK (((("duration" IS NULL) AND ("duration_months" IS NULL)) OR (("duration" = ANY (ARRAY['once'::"text", 'forever'::"text"])) AND ("duration_months" IS NULL)) OR (("duration" = 'repeating'::"text") AND (("duration_months" >= 1) AND ("duration_months" <= 36))))),
    CONSTRAINT "coupons_limites_chk" CHECK (((("max_uses" IS NULL) OR ("max_uses" >= 1)) AND (("max_uses_per_user" IS NULL) OR ("max_uses_per_user" >= 1)) AND (("min_order_value" IS NULL) OR ("min_order_value" >= (0)::numeric)) AND (("max_discount" IS NULL) OR ("max_discount" > (0)::numeric)) AND ("uses" >= 0))),
    CONSTRAINT "coupons_periodo_chk" CHECK ((("valid_from" IS NULL) OR ("valid_until" IS NULL) OR ("valid_until" > "valid_from"))),
    CONSTRAINT "coupons_plans_chk" CHECK ((("plans" IS NULL) OR ("plans" <@ ARRAY['starter'::"text", 'plus'::"text", 'pro'::"text", 'enterprise'::"text"]))),
    CONSTRAINT "coupons_tipo_chk" CHECK (((("producer_id" IS NULL) AND ("event_id" IS NULL) AND ("duration" IS NOT NULL)) OR (("producer_id" IS NOT NULL) AND ("plans" IS NULL) AND ("duration" IS NULL)))),
    CONSTRAINT "coupons_upgrade_chk" CHECK ((("upgrade_from" IS NULL) OR (("producer_id" IS NULL) AND ("cardinality"("upgrade_from") > 0) AND ("upgrade_from" <@ ARRAY['free'::"text", 'starter'::"text", 'plus'::"text", 'pro'::"text"])))),
    CONSTRAINT "coupons_value_chk" CHECK ((("discount_value" > (0)::numeric) AND (("discount_type" <> 'percent'::"text") OR ("discount_value" <= (100)::numeric))))
);


ALTER TABLE "public"."coupons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crm_interactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "content" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "crm_interactions_type_check" CHECK (("type" = ANY (ARRAY['message'::"text", 'call'::"text", 'email'::"text", 'note'::"text", 'meeting'::"text"])))
);


ALTER TABLE "public"."crm_interactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crm_leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producer_id" "uuid" NOT NULL,
    "stage_id" "uuid",
    "full_name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "avatar_url" "text",
    "source" "text" DEFAULT 'organic'::"text" NOT NULL,
    "score" integer DEFAULT 0 NOT NULL,
    "potential_value" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "event_interest" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "city" "text",
    "notified" boolean DEFAULT false,
    "notified_at" timestamp with time zone,
    CONSTRAINT "crm_leads_score_check" CHECK ((("score" >= 0) AND ("score" <= 100)))
);


ALTER TABLE "public"."crm_leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crm_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "due_date" timestamp with time zone,
    "completed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."crm_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid",
    "user_id" "uuid",
    "email" "text",
    "name" "text",
    "phone" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "notes" "text",
    "total_spent" numeric DEFAULT 0,
    "events_attended" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "email_type" "text" NOT NULL,
    "recipient" "text",
    "status" "text" NOT NULL,
    "resend_id" "text",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "email_logs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."email_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_banners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producer_id" "uuid" NOT NULL,
    "event_name" "text",
    "name" "text" NOT NULL,
    "image_url" "text",
    "position" "text" DEFAULT 'hero'::"text",
    "active" boolean DEFAULT true,
    "clicks" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "event_banners_image_url_chk" CHECK (("image_url" ~ '^(https://|/[^/])'::"text")),
    CONSTRAINT "event_banners_position_check" CHECK (("position" = ANY (ARRAY['hero'::"text", 'top'::"text", 'inline'::"text"])))
);


ALTER TABLE "public"."event_banners" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_budget_boxes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producer_id" "uuid" NOT NULL,
    "event_id" "uuid",
    "name" "text" NOT NULL,
    "target" numeric DEFAULT 0,
    "saved" numeric DEFAULT 0,
    "category" "text" DEFAULT 'Outros'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "event_budget_boxes_name_len" CHECK (("length"("name") <= 120)),
    CONSTRAINT "event_budget_boxes_notes_len" CHECK (("length"("notes") <= 1000))
);


ALTER TABLE "public"."event_budget_boxes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producer_id" "uuid" NOT NULL,
    "event_name" "text",
    "url" "text" NOT NULL,
    "caption" "text",
    "likes" integer DEFAULT 0,
    "comments" integer DEFAULT 0,
    "featured" boolean DEFAULT false,
    "size" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "event_photos_url_chk" CHECK (("url" ~ '^(https://|/[^/])'::"text"))
);


ALTER TABLE "public"."event_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "rating" integer NOT NULL,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."event_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "coupon_id" "uuid",
    "subtotal" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "discount" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "service_fee" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "processing_fee" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "total" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "payment_method" "text",
    "payment_gateway" "text",
    "gateway_payment_id" "text",
    "customer_name" "text",
    "customer_email" "text",
    "customer_cpf" "text",
    "customer_phone" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "customer_cpf_hmac" "bytea",
    "reservado_ate" timestamp with time zone,
    CONSTRAINT "orders_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['pix'::"text", 'credit_card'::"text", 'boleto'::"text"]))),
    CONSTRAINT "orders_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'failed'::"text", 'cancelled'::"text", 'refunded'::"text"]))),
    CONSTRAINT "orders_valores_chk" CHECK ((("subtotal" >= (0)::numeric) AND ("discount" >= (0)::numeric) AND ("service_fee" >= (0)::numeric) AND ("processing_fee" >= (0)::numeric) AND ("total" >= (0)::numeric)))
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ticket_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "capacity" integer,
    "quantity_total" integer DEFAULT 0 NOT NULL,
    "sold" integer DEFAULT 0 NOT NULL,
    "quantity_sold" integer DEFAULT 0 NOT NULL,
    "min_per_order" integer DEFAULT 1 NOT NULL,
    "max_per_order" integer,
    "valid_from" timestamp with time zone,
    "valid_until" timestamp with time zone,
    "sale_start" timestamp with time zone,
    "sale_end" timestamp with time zone,
    "perks" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "perks_array" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "type" "text" DEFAULT 'individual'::"text" NOT NULL,
    "sort_order" integer,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "inclui_bebida" boolean DEFAULT false NOT NULL,
    "max_por_cpf" integer,
    "permite_meia" boolean DEFAULT true NOT NULL,
    CONSTRAINT "ticket_types_max_por_cpf_check" CHECK (("max_por_cpf" > 0)),
    CONSTRAINT "ticket_types_type_check" CHECK (("type" = ANY (ARRAY['individual'::"text", 'vip'::"text", 'coletiva'::"text", 'mesa'::"text"]))),
    CONSTRAINT "ticket_types_valores_chk" CHECK ((("price" >= (0)::numeric) AND ("capacity" >= 0) AND ("quantity_total" >= 0) AND ("sold" >= 0) AND ("quantity_sold" >= 0) AND ("min_per_order" >= 1) AND ("max_per_order" >= 1)))
);


ALTER TABLE "public"."ticket_types" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."event_summary" AS
 SELECT "e"."producer_id",
    "e"."id" AS "event_id",
    COALESCE("sum"("tt"."sold"), (0)::bigint) AS "tickets_sold",
    COALESCE("sum"(("tt"."price" * ("tt"."sold")::numeric)), (0)::numeric) AS "total_revenue",
    "count"(DISTINCT "o"."user_id") AS "unique_buyers"
   FROM (("public"."events" "e"
     LEFT JOIN "public"."ticket_types" "tt" ON (("tt"."event_id" = "e"."id")))
     LEFT JOIN "public"."orders" "o" ON (("o"."event_id" = "e"."id")))
  WHERE ("e"."status" = 'published'::"text")
  GROUP BY "e"."producer_id", "e"."id"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."event_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_surveys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "participant_email" "text" NOT NULL,
    "score" integer NOT NULL,
    "comment" "text",
    "zone" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "event_surveys_score_check" CHECK ((("score" >= 0) AND ("score" <= 10)))
);


ALTER TABLE "public"."event_surveys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_timeline_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producer_id" "uuid" NOT NULL,
    "event_id" "uuid",
    "time" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "type" "text" DEFAULT 'show'::"text",
    "responsible" "text",
    "status" "text" DEFAULT 'futuro'::"text",
    "duration" "text",
    "location" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "event_timeline_items_status_check" CHECK (("status" = ANY (ARRAY['concluido'::"text", 'atual'::"text", 'futuro'::"text"]))),
    CONSTRAINT "event_timeline_items_type_check" CHECK (("type" = ANY (ARRAY['soundcheck'::"text", 'abertura'::"text", 'show'::"text", 'comida'::"text", 'transporte'::"text", 'decoracao'::"text", 'vip'::"text", 'encerramento'::"text"])))
);


ALTER TABLE "public"."event_timeline_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_zones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "avg_time_minutes" integer DEFAULT 0,
    "satisfaction_score" numeric DEFAULT 0,
    "expected_visitors" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_zones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."evento_aceites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid",
    "producer_id" "uuid" NOT NULL,
    "versao" "text" NOT NULL,
    "texto_hash" "text" NOT NULL,
    "classificacao" "text",
    "tem_bebida" boolean NOT NULL,
    "ip" "text",
    "forwarded_for" "text",
    "user_agent" "text",
    "aceito_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "texto" "text" NOT NULL,
    CONSTRAINT "evento_aceites_classificacao_check" CHECK (("classificacao" = ANY (ARRAY['AL'::"text", 'A6'::"text", 'A10'::"text", 'A12'::"text", 'A14'::"text", 'A16'::"text", 'A18'::"text"]))),
    CONSTRAINT "evento_aceites_texto_check" CHECK (("texto" <> ''::"text")),
    CONSTRAINT "evento_aceites_texto_hash_check" CHECK (("texto_hash" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "evento_aceites_user_agent_check" CHECK (("char_length"("user_agent") <= 500))
);


ALTER TABLE "public"."evento_aceites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."evento_privado" (
    "event_id" "uuid" NOT NULL,
    "online_url" "text",
    CONSTRAINT "evento_privado_online_url_check" CHECK ((("online_url" ~ '^https://[^\s]+$'::"text") AND ("char_length"("online_url") <= 500)))
);


ALTER TABLE "public"."evento_privado" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."favoritos" (
    "user_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."favoritos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text",
    "message" "text" NOT NULL,
    "rating" integer,
    "page" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'novo'::"text" NOT NULL,
    "admin_notes" "text",
    CONSTRAINT "feedback_rating_check" CHECK ((("rating" >= 0) AND ("rating" <= 5))),
    CONSTRAINT "feedback_status_check" CHECK (("status" = ANY (ARRAY['novo'::"text", 'lido'::"text", 'respondido'::"text", 'resolvido'::"text"]))),
    CONSTRAINT "feedback_tamanhos_chk" CHECK ((("length"("page") <= 2048) AND ("length"("user_agent") <= 1024) AND ("length"("admin_notes") <= 5000))),
    CONSTRAINT "feedback_type_check" CHECK (("type" = ANY (ARRAY['melhoria'::"text", 'bug'::"text", 'duvida'::"text", 'sugestao'::"text", 'elogio'::"text"])))
);


ALTER TABLE "public"."feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."interest_lists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "ticket_type_id" "uuid",
    "notified" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "consentimento_em" timestamp with time zone DEFAULT "now"(),
    "consentimento_versao" "text",
    "notified_at" timestamp with time zone,
    "email_enviado_em" timestamp with time zone,
    "email_falhas" integer DEFAULT 0 NOT NULL,
    "email_reservado_ate" timestamp with time zone,
    "removido_em" timestamp with time zone,
    CONSTRAINT "interest_lists_versao_chk" CHECK ((("consentimento_versao" IS NULL) OR ("consentimento_versao" = 'p4-v1-2026-10-07'::"text")))
);


ALTER TABLE "public"."interest_lists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."issued_certificates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "certificate_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "issued_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "code" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL
);


ALTER TABLE "public"."issued_certificates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kb_articles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text",
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "keywords" "text" DEFAULT ''::"text" NOT NULL,
    "audience" "text" DEFAULT 'all'::"text" NOT NULL,
    "department_id" "uuid",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "origin" "text" DEFAULT 'manual'::"text" NOT NULL,
    "source_conversation_id" "uuid",
    "review_note" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "busca" "tsvector" GENERATED ALWAYS AS (("setweight"("to_tsvector"('"public"."pt_sem_acento"'::"regconfig", (("title" || ' '::"text") || "keywords")), 'A'::"char") || "setweight"("to_tsvector"('"public"."pt_sem_acento"'::"regconfig", "body"), 'B'::"char"))) STORED,
    CONSTRAINT "kb_articles_audience_check" CHECK (("audience" = ANY (ARRAY['all'::"text", 'participant'::"text", 'producer'::"text", 'site'::"text"]))),
    CONSTRAINT "kb_articles_body_check" CHECK ((("char_length"("body") >= 10) AND ("char_length"("body") <= 3500))),
    CONSTRAINT "kb_articles_keywords_check" CHECK (("char_length"("keywords") <= 500)),
    CONSTRAINT "kb_articles_origin_check" CHECK (("origin" = ANY (ARRAY['seed'::"text", 'manual'::"text", 'atendente'::"text", 'ia'::"text"]))),
    CONSTRAINT "kb_articles_review_note_check" CHECK (("char_length"("review_note") <= 1000)),
    CONSTRAINT "kb_articles_slug_check" CHECK (("slug" ~ '^[a-z0-9-]{3,60}$'::"text")),
    CONSTRAINT "kb_articles_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text"]))),
    CONSTRAINT "kb_articles_title_check" CHECK ((("char_length"("title") >= 5) AND ("char_length"("title") <= 160)))
);


ALTER TABLE "public"."kb_articles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kb_perguntas_sem_resposta" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "texto" "text" NOT NULL,
    "audience" "text" NOT NULL,
    "vezes" integer DEFAULT 1 NOT NULL,
    "primeira_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ultima_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "kb_perguntas_sem_resposta_audience_check" CHECK (("audience" = ANY (ARRAY['participant'::"text", 'producer'::"text", 'site'::"text"]))),
    CONSTRAINT "kb_perguntas_sem_resposta_texto_check" CHECK ((("char_length"("texto") >= 1) AND ("char_length"("texto") <= 200)))
);


ALTER TABLE "public"."kb_perguntas_sem_resposta" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kb_slugs_excluidos" (
    "slug" "text" NOT NULL,
    "excluido_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."kb_slugs_excluidos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kb_termos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "forma" "text" NOT NULL,
    "normal" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "kb_termos_forma_check" CHECK (("forma" ~ '^[a-z0-9]{1,30}$'::"text")),
    CONSTRAINT "kb_termos_normal_check" CHECK ((("char_length"("normal") >= 1) AND ("char_length"("normal") <= 60)))
);


ALTER TABLE "public"."kb_termos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."menu_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid",
    "producer_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "category" "text" DEFAULT 'bebida'::"text" NOT NULL,
    "image_url" "text",
    "is_available" boolean DEFAULT true NOT NULL,
    "stock" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "menu_items_category_check" CHECK (("category" = ANY (ARRAY['bebida'::"text", 'comida'::"text", 'combo'::"text", 'merch'::"text", 'servico'::"text"])))
);


ALTER TABLE "public"."menu_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."menu_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "menu_order_id" "uuid" NOT NULL,
    "menu_item_id" "uuid" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "unit_price" numeric(10,2) NOT NULL
);


ALTER TABLE "public"."menu_order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."menu_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "pickup_time" timestamp with time zone,
    "total" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "qr_code" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "menu_orders_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'preparing'::"text", 'ready'::"text", 'delivered'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."menu_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mesa_avisos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "evento" "uuid" NOT NULL,
    "table_id" "uuid",
    "mesa" "text",
    "tipo" "text" DEFAULT 'entrou'::"text" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "lido" boolean DEFAULT false NOT NULL,
    CONSTRAINT "mesa_avisos_tipo_check" CHECK (("tipo" = ANY (ARRAY['entrou'::"text", 'removido'::"text"])))
);


ALTER TABLE "public"."mesa_avisos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mesa_consentimentos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "versao" "text",
    "acao" "text" NOT NULL,
    "em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mesa_consentimentos_acao_check" CHECK (("acao" = ANY (ARRAY['consentiu'::"text", 'revogou'::"text", 'mostrou_rede'::"text", 'ocultou_rede'::"text"])))
);


ALTER TABLE "public"."mesa_consentimentos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mesa_denuncias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "denunciante" "uuid",
    "denunciado" "uuid",
    "denunciante_nome" "text",
    "denunciado_nome" "text",
    "evento" "uuid",
    "evento_em" timestamp with time zone NOT NULL,
    "table_id" "uuid",
    "mesa" "text",
    "motivo" "text" NOT NULL,
    "detalhe" "text",
    "mesma_mesa" boolean NOT NULL,
    "sobreposicao_inicio" timestamp with time zone,
    "sobreposicao_fim" timestamp with time zone,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'aberta'::"text" NOT NULL,
    "status_mudado_por" "uuid",
    "status_mudado_em" timestamp with time zone,
    "liberada_produtor_em" timestamp with time zone,
    "liberada_por" "uuid",
    "resultado" "text",
    "resultado_explicacao" "text",
    CONSTRAINT "mesa_denuncias_check" CHECK ((("motivo" <> 'assedio'::"text") OR "mesma_mesa")),
    CONSTRAINT "mesa_denuncias_check1" CHECK (
CASE
    WHEN ("status" = 'resolvida'::"text") THEN ("resultado" IS NOT NULL)
    ELSE (("resultado" IS NULL) AND ("resultado_explicacao" IS NULL))
END),
    CONSTRAINT "mesa_denuncias_detalhe_check" CHECK ((("char_length"("detalhe") <= 500) AND ("detalhe" !~ '[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f؜‎‏‪-‮⁦-⁩]'::"text"))),
    CONSTRAINT "mesa_denuncias_motivo_check" CHECK (("motivo" = ANY (ARRAY['assedio'::"text", 'perfil_falso'::"text", 'conteudo_improprio'::"text", 'outro'::"text"]))),
    CONSTRAINT "mesa_denuncias_resultado_check" CHECK (("resultado" = ANY (ARRAY['procedente'::"text", 'improcedente'::"text"]))),
    CONSTRAINT "mesa_denuncias_resultado_explicacao_check" CHECK (((("char_length"("resultado_explicacao") >= 10) AND ("char_length"("resultado_explicacao") <= 1000)) AND ("resultado_explicacao" !~ '[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f؜‎‏‪-‮⁦-⁩]'::"text") AND ("resultado_explicacao" ~ '[[:alnum:]]'::"text"))),
    CONSTRAINT "mesa_denuncias_status_check" CHECK (("status" = ANY (ARRAY['aberta'::"text", 'em_apuracao'::"text", 'resolvida'::"text", 'judicial'::"text"])))
);


ALTER TABLE "public"."mesa_denuncias" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mesa_moderacoes" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "hash" "text" NOT NULL,
    "decisao" "text" NOT NULL,
    "motivos" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "modelo" "text",
    "tokens_in" integer,
    "tokens_out" integer,
    "custo" numeric,
    "em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mesa_moderacoes_decisao_check" CHECK (("decisao" = ANY (ARRAY['aprovada'::"text", 'recusada'::"text", 'revisar'::"text", 'erro'::"text", 'contestada'::"text"]))),
    CONSTRAINT "mesa_moderacoes_motivos_check" CHECK (("motivos" <@ ARRAY['nudez'::"text", 'violencia'::"text", 'odio'::"text", 'politica'::"text", 'drogas'::"text", 'sem_rosto'::"text", 'famoso'::"text", 'texto_contato'::"text", 'bloqueio_seguranca'::"text", 'formato'::"text", 'outro'::"text"]))
);


ALTER TABLE "public"."mesa_moderacoes" OWNER TO "postgres";


ALTER TABLE "public"."mesa_moderacoes" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."mesa_moderacoes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."mesa_passagens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "membro_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "evento" "uuid" NOT NULL,
    "table_id" "uuid" NOT NULL,
    "entrou_em" timestamp with time zone NOT NULL,
    "saiu_em" timestamp with time zone
);


ALTER TABLE "public"."mesa_passagens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mesa_travas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "evento" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "ticket_id" "uuid",
    "motivo" "text" NOT NULL,
    "detalhe" "text",
    "por" "uuid",
    "em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "destravada_por" "uuid",
    "destravada_em" timestamp with time zone,
    "denuncia_id" "uuid",
    CONSTRAINT "mesa_travas_check" CHECK ((("motivo" <> 'outro'::"text") OR ("detalhe" IS NOT NULL))),
    CONSTRAINT "mesa_travas_detalhe_check" CHECK (((("char_length"("detalhe") >= 3) AND ("char_length"("detalhe") <= 500)) AND ("detalhe" !~ '[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f؜‎‏‪-‮⁦-⁩]'::"text"))),
    CONSTRAINT "mesa_travas_motivo_check" CHECK (("motivo" = ANY (ARRAY['denuncia_triada'::"text", 'comportamento_no_local'::"text", 'pedido_da_pessoa'::"text", 'outro'::"text"])))
);


ALTER TABLE "public"."mesa_travas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "lead_id" "uuid",
    "content" "text" NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."newsletter_subscribers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "unsubscribe_token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unsubscribed_at" timestamp with time zone
);


ALTER TABLE "public"."newsletter_subscribers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."newsletters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "sent_at" timestamp with time zone,
    "recipient_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "newsletters_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'sent'::"text"])))
);


ALTER TABLE "public"."newsletters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "type" "text" DEFAULT 'info'::"text" NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['info'::"text", 'sale'::"text", 'reminder'::"text", 'promo'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."onboarding_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "step_name" "text",
    "step_number" numeric,
    "completed_at" timestamp with time zone,
    "skipped" boolean DEFAULT false,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."onboarding_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "ticket_type_id" "uuid" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "unit_price" numeric(10,2) NOT NULL,
    "subtotal" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "beneficio" "text" DEFAULT 'inteira'::"text" NOT NULL,
    "meia_tipo" "text",
    "taxa_unit" numeric(10,2),
    CONSTRAINT "order_items_beneficio_check" CHECK (("beneficio" = ANY (ARRAY['inteira'::"text", 'meia'::"text"]))),
    CONSTRAINT "order_items_meia_tipo_check" CHECK ((("beneficio" = 'meia'::"text") = ("meia_tipo" IS NOT NULL))),
    CONSTRAINT "order_items_taxa_unit_check" CHECK (("taxa_unit" >= (0)::numeric)),
    CONSTRAINT "order_items_valores_chk" CHECK ((("quantity" >= 1) AND ("unit_price" >= (0)::numeric) AND ("subtotal" >= (0)::numeric)))
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."partners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producer_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text",
    "contact" "text",
    "logo_url" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."partners" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "gateway" "text" NOT NULL,
    "gateway_payment_id" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "split_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payments_gateway_check" CHECK (("gateway" = ANY (ARRAY['stripe'::"text", 'woovi'::"text", 'pagseguro'::"text", 'pagbank'::"text"]))),
    CONSTRAINT "payments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text", 'refunded'::"text"])))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pedido_assentos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "seat_key" "text" NOT NULL,
    "ticket_type_id" "uuid" NOT NULL,
    "lugares" integer NOT NULL,
    "expira_em" timestamp with time zone NOT NULL,
    "liberada_em" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pedido_assentos_lugares_check" CHECK (("lugares" >= 1))
);


ALTER TABLE "public"."pedido_assentos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."piggy_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "box_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "amount" numeric DEFAULT 0,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "piggy_transactions_note_len" CHECK (("length"("note") <= 500)),
    CONSTRAINT "piggy_transactions_type_check" CHECK (("type" = ANY (ARRAY['deposit'::"text", 'withdraw'::"text"])))
);


ALTER TABLE "public"."piggy_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_affiliate_producers" (
    "producer_id" "uuid" NOT NULL,
    "affiliate_id" "uuid" NOT NULL,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "linked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "linked_by" "uuid",
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ref_first_seen_at" timestamp with time zone,
    "ended_at" timestamp with time zone,
    "ended_by" "uuid",
    "end_reason" "text",
    "affiliate_link_id" "uuid",
    CONSTRAINT "platform_affiliate_producers_end_reason_check" CHECK (("char_length"("end_reason") <= 500)),
    CONSTRAINT "platform_affiliate_producers_source_chk" CHECK (("source" = ANY (ARRAY['manual'::"text", 'link'::"text", 'code'::"text", 'coupon'::"text"])))
);


ALTER TABLE "public"."platform_affiliate_producers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_affiliates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "referral_code" "text" NOT NULL,
    "recurring_percent" numeric NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "agreement_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "full_name" "text",
    "birth_date" "date",
    "email" "text",
    "phone" "text",
    "whatsapp" "text",
    "cep" "text",
    "street" "text",
    "street_number" "text",
    "complement" "text",
    "neighborhood" "text",
    "city" "text",
    "state" "text",
    "payout_account_id" "text",
    "cpf_enc" "bytea",
    "cpf_hmac" "bytea",
    CONSTRAINT "platform_affiliates_code_chk" CHECK (("referral_code" ~ '^[A-Z0-9_-]{3,30}$'::"text")),
    CONSTRAINT "platform_affiliates_dados_chk" CHECK (((("birth_date" IS NULL) OR (("birth_date" >= '1900-01-01'::"date") AND ("birth_date" <= (CURRENT_DATE - '18 years'::interval)))) AND (("email" IS NULL) OR ("email" ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::"text")) AND (("phone" IS NULL) OR ("phone" ~ '^[0-9]{10,13}$'::"text")) AND (("whatsapp" IS NULL) OR ("whatsapp" ~ '^[0-9]{10,13}$'::"text")) AND (("cep" IS NULL) OR ("cep" ~ '^[0-9]{8}$'::"text")) AND (("state" IS NULL) OR ("state" ~ '^[A-Z]{2}$'::"text")) AND (("full_name" IS NULL) OR (("char_length"("full_name") >= 3) AND ("char_length"("full_name") <= 150))))),
    CONSTRAINT "platform_affiliates_recurring_percent_check" CHECK ((("recurring_percent" >= (15)::numeric) AND ("recurring_percent" <= (25)::numeric))),
    CONSTRAINT "platform_affiliates_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'paused'::"text", 'ended'::"text"])))
);


ALTER TABLE "public"."platform_affiliates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "value" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."platform_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."policy_notices" (
    "user_id" "uuid" NOT NULL,
    "version" "text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "policy_notices_version_check" CHECK ((("char_length"("version") >= 8) AND ("char_length"("version") <= 20)))
);


ALTER TABLE "public"."policy_notices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."producer_profiles" (
    "id" "uuid" NOT NULL,
    "company_name" "text" NOT NULL,
    "stripe_account_id" "text",
    "woovi_account_id" "text",
    "commission_rate" numeric(5,2) DEFAULT 10.00 NOT NULL,
    "is_verified" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notification_settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "webhook_url" "text",
    "cnpj_enc" "bytea",
    "pix_key_enc" "bytea",
    "bank_account_enc" "bytea",
    "cnpj_hmac" "bytea",
    "logo_url" "text",
    CONSTRAINT "producer_profiles_logo_url_check" CHECK ((("logo_url" IS NULL) OR ("logo_url" ~ (('^https://rwaezeqyuhxrssntcxdv\.supabase\.co/storage/v1/object/public/logos-produtor/'::"text" || ("id")::"text") || '/[A-Za-z0-9_-]{8,80}\.(png|webp|jpe?g)$'::"text"))))
);


ALTER TABLE "public"."producer_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."producer_public" (
    "producer_id" "uuid" NOT NULL,
    "nome_publico" "text",
    "whatsapp" "text",
    "instagram" "text",
    "site" "text",
    "email_contato" "text",
    "outras_redes" "jsonb",
    "mostrar_nome" boolean DEFAULT true NOT NULL,
    "mostrar_whatsapp" boolean DEFAULT false NOT NULL,
    "mostrar_instagram" boolean DEFAULT false NOT NULL,
    "mostrar_site" boolean DEFAULT false NOT NULL,
    "mostrar_email" boolean DEFAULT false NOT NULL,
    "mostrar_outras_redes" boolean DEFAULT false NOT NULL,
    "oculto_por_admin" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "producer_public_email_check" CHECK ((("email_contato" IS NULL) OR (("length"("email_contato") <= 254) AND ("email_contato" ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::"text") AND ("email_contato" !~ '[?&#%,;<>"]'::"text")))),
    CONSTRAINT "producer_public_instagram_check" CHECK ((("instagram" IS NULL) OR ("instagram" ~ '^[A-Za-z0-9._]{1,30}$'::"text"))),
    CONSTRAINT "producer_public_nome_check" CHECK ((("nome_publico" IS NULL) OR ((("length"("nome_publico") >= 1) AND ("length"("nome_publico") <= 80)) AND "public"."organizador_marca_ok"("nome_publico")))),
    CONSTRAINT "producer_public_redes_check" CHECK ("public"."organizador_redes_ok"("outras_redes")),
    CONSTRAINT "producer_public_site_check" CHECK ((("site" IS NULL) OR "public"."organizador_url_ok"("site"))),
    CONSTRAINT "producer_public_whatsapp_check" CHECK ((("whatsapp" IS NULL) OR ("whatsapp" ~ '^55[0-9]{10,11}$'::"text")))
);


ALTER TABLE "public"."producer_public" OWNER TO "postgres";


COMMENT ON TABLE "public"."producer_public" IS 'O que o produtor escolheu mostrar na página do evento. Sem leitura direta: só pelas funções organizador_publico / meu_organizador_publico.';



CREATE TABLE IF NOT EXISTS "public"."producer_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producer_id" "uuid" NOT NULL,
    "plan" "text" DEFAULT 'free'::"text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    CONSTRAINT "producer_subscriptions_plan_check" CHECK (("plan" = ANY (ARRAY['free'::"text", 'starter'::"text", 'plus'::"text", 'pro'::"text", 'enterprise'::"text"])))
);


ALTER TABLE "public"."producer_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."producer_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producer_id" "uuid" NOT NULL,
    "event_id" "uuid",
    "assigned_to" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "due_date" timestamp with time zone,
    "status" "text" DEFAULT 'todo'::"text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "producer_tasks_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "producer_tasks_status_check" CHECK (("status" = ANY (ARRAY['todo'::"text", 'in_progress'::"text", 'done'::"text"])))
);


ALTER TABLE "public"."producer_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "phone" "text",
    "avatar_url" "text",
    "bio" "text",
    "city" "text",
    "birth_date" "date",
    "instagram" "text",
    "tiktok" "text",
    "linkedin" "text",
    "role" "text" DEFAULT 'user'::"text" NOT NULL,
    "stripe_customer_id" "text",
    "is_verified" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "website" "text",
    "admin_permissions" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "avatar_moderacao" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "avatar_moderado_em" timestamp with time zone,
    "avatar_moderacao_hash" "text",
    "avatar_moderacao_tentativas" integer DEFAULT 0 NOT NULL,
    "avatar_moderacao_reservada_ate" timestamp with time zone,
    "cpf_enc" "bytea",
    "cpf_compra_hmac" "text",
    CONSTRAINT "profiles_avatar_moderacao_chk" CHECK (("avatar_moderacao" = ANY (ARRAY['pendente'::"text", 'aprovada'::"text", 'recusada'::"text", 'revisar'::"text"]))),
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'customer'::"text", 'producer'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "coupon_id" "uuid",
    "total_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "payment_method" "text",
    "payment_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "purchases_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'refunded'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."purchases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."revenue_advances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producer_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "amount" numeric DEFAULT 0,
    "fee_pct" numeric DEFAULT 0,
    "fee_amount" numeric DEFAULT 0,
    "iof_amount" numeric DEFAULT 0,
    "net_amount" numeric DEFAULT 0,
    "days" integer DEFAULT 7,
    "status" "text" DEFAULT 'requested'::"text",
    "requested_at" timestamp with time zone DEFAULT "now"(),
    "transferred_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "revenue_advances_status_check" CHECK (("status" = ANY (ARRAY['requested'::"text", 'approved'::"text", 'transferred'::"text", 'reconciled'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."revenue_advances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."seating_maps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "name" "text" DEFAULT 'Principal'::"text" NOT NULL,
    "config" "jsonb" DEFAULT '{"elements": [], "background": null}'::"jsonb" NOT NULL,
    "environments" "jsonb" DEFAULT '[{"id": "default", "name": "Principal", "seats": []}]'::"jsonb",
    "is_active" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."seating_maps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_profiles" (
    "user_id" "uuid" NOT NULL,
    "invite_id" "uuid",
    "email" "text" NOT NULL,
    "cargo" "text" NOT NULL,
    "nome_completo" "text" NOT NULL,
    "data_nascimento" "date" NOT NULL,
    "cep" "text" NOT NULL,
    "rua" "text" NOT NULL,
    "numero" "text" NOT NULL,
    "complemento" "text",
    "bairro" "text" NOT NULL,
    "cidade" "text" NOT NULL,
    "uf" "text" NOT NULL,
    "email_secundario" "text" NOT NULL,
    "telefone" "text" NOT NULL,
    "whatsapp" "text" NOT NULL,
    "emergencia_nome" "text" NOT NULL,
    "emergencia_parentesco" "text" NOT NULL,
    "emergencia_telefone" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cpf_enc" "bytea" NOT NULL,
    "rg_enc" "bytea" NOT NULL,
    "agencia_enc" "bytea",
    "banco_enc" "bytea",
    "conta_enc" "bytea",
    "pix_chave_enc" "bytea" NOT NULL,
    "pix_tipo_enc" "bytea" NOT NULL,
    CONSTRAINT "staff_cep_ok" CHECK (("cep" ~ '^[0-9]{8}$'::"text")),
    CONSTRAINT "staff_email_secundario_ok" CHECK ((("email_secundario" = "lower"("btrim"("email_secundario"))) AND ("char_length"("email_secundario") <= 254) AND ("email_secundario" ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::"text") AND ("email_secundario" <> "lower"("email")))),
    CONSTRAINT "staff_emergencia_ok" CHECK (((("char_length"("btrim"("emergencia_nome")) >= 3) AND ("char_length"("btrim"("emergencia_nome")) <= 150)) AND (("char_length"("btrim"("emergencia_parentesco")) >= 2) AND ("char_length"("btrim"("emergencia_parentesco")) <= 50)) AND ("emergencia_telefone" ~ '^\+[1-9][0-9]{9,14}$'::"text"))),
    CONSTRAINT "staff_endereco_ok" CHECK (((("char_length"("btrim"("rua")) >= 2) AND ("char_length"("btrim"("rua")) <= 150)) AND (("char_length"("btrim"("numero")) >= 1) AND ("char_length"("btrim"("numero")) <= 20)) AND (("char_length"("btrim"("bairro")) >= 2) AND ("char_length"("btrim"("bairro")) <= 100)) AND (("char_length"("btrim"("cidade")) >= 2) AND ("char_length"("btrim"("cidade")) <= 100)) AND (("complemento" IS NULL) OR ("char_length"("complemento") <= 100)))),
    CONSTRAINT "staff_nascimento_ok" CHECK ((("data_nascimento" >= '1900-01-01'::"date") AND ("data_nascimento" <= (CURRENT_DATE - '18 years'::interval)))),
    CONSTRAINT "staff_nome_ok" CHECK (((("char_length"("btrim"("nome_completo")) >= 3) AND ("char_length"("btrim"("nome_completo")) <= 150)) AND ("nome_completo" ~ '^[A-Za-zÀ-ÖØ-öø-ɏḀ-ỿ ''.-]+$'::"text") AND ("nome_completo" !~ '\.[A-Za-zÀ-ÿ]{2}'::"text"))),
    CONSTRAINT "staff_telefones_ok" CHECK ((("telefone" ~ '^\+[1-9][0-9]{9,14}$'::"text") AND ("whatsapp" ~ '^\+[1-9][0-9]{9,14}$'::"text"))),
    CONSTRAINT "staff_uf_ok" CHECK (("uf" = ANY (ARRAY['AC'::"text", 'AL'::"text", 'AP'::"text", 'AM'::"text", 'BA'::"text", 'CE'::"text", 'DF'::"text", 'ES'::"text", 'GO'::"text", 'MA'::"text", 'MT'::"text", 'MS'::"text", 'MG'::"text", 'PA'::"text", 'PB'::"text", 'PR'::"text", 'PE'::"text", 'PI'::"text", 'RJ'::"text", 'RN'::"text", 'RS'::"text", 'RO'::"text", 'RR'::"text", 'SC'::"text", 'SP'::"text", 'SE'::"text", 'TO'::"text"])))
);


ALTER TABLE "public"."staff_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_profiles_acessos" (
    "id" bigint NOT NULL,
    "leitor" "uuid" NOT NULL,
    "colaborador" "uuid" NOT NULL,
    "lido_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."staff_profiles_acessos" OWNER TO "postgres";


ALTER TABLE "public"."staff_profiles_acessos" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."staff_profiles_acessos_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."staff_profiles_historico_pagamento" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "alterado_por" "uuid",
    "alterado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "antes" "jsonb" NOT NULL,
    "depois" "jsonb" NOT NULL
);


ALTER TABLE "public"."staff_profiles_historico_pagamento" OWNER TO "postgres";


ALTER TABLE "public"."staff_profiles_historico_pagamento" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."staff_profiles_historico_pagamento_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."support_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid",
    "sender_type" "text",
    "sender_id" "uuid",
    "sender_name" "text",
    "content" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "read_at" timestamp with time zone
);


ALTER TABLE "public"."support_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."support_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "visitor_id" "uuid",
    "user_id" "uuid",
    "status" "text" DEFAULT 'open'::"text",
    "assigned_agent_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."support_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."table_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "vibe" "text",
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "matchmaking_answers" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "oculto" boolean DEFAULT false NOT NULL,
    "ultima_troca_em" timestamp with time zone
);


ALTER TABLE "public"."table_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid",
    "title" "text",
    "description" "text",
    "assignee_id" "uuid",
    "status" "text" DEFAULT 'todo'::"text",
    "priority" "text" DEFAULT 'medium'::"text",
    "due_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_convite_email" (
    "producer_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "reservado_em" timestamp with time zone NOT NULL,
    "enviado" boolean DEFAULT true NOT NULL,
    "falhas" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."team_convite_email" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_convite_tentativas" (
    "producer_id" "uuid" NOT NULL,
    "em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."team_convite_tentativas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producer_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'viewer'::"text" NOT NULL,
    "invited_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "accepted_at" timestamp with time zone,
    "blocked_at" timestamp with time zone,
    CONSTRAINT "team_members_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'editor'::"text", 'viewer'::"text"])))
);


ALTER TABLE "public"."team_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tentativas_reserva" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "quando" timestamp with time zone DEFAULT "now"() NOT NULL,
    "motivo" "text" NOT NULL
);


ALTER TABLE "public"."tentativas_reserva" OWNER TO "postgres";


ALTER TABLE "public"."tentativas_reserva" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."tentativas_reserva_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_item_id" "uuid",
    "order_id" "uuid" NOT NULL,
    "ticket_type_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "buyer_name" "text" NOT NULL,
    "buyer_email" "text" NOT NULL,
    "buyer_cpf" "text",
    "qr_code" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "price_paid" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "checked_in_at" timestamp with time zone,
    "checked_in_by" "uuid",
    "transferred_to" "uuid",
    "transfer_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "qr_dinamico_desde" timestamp with time zone,
    CONSTRAINT "tickets_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'used'::"text", 'cancelled'::"text", 'refunded'::"text", 'transferred'::"text"])))
);


ALTER TABLE "public"."tickets" OWNER TO "postgres";


COMMENT ON COLUMN "public"."tickets"."qr_dinamico_desde" IS 'Quando o ingresso passou a usar o QR dinâmico (ingresso-codigo, service role). Não nulo = o QR fixo (qr_code) deste ingresso não vale mais na portaria';



CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producer_id" "uuid" NOT NULL,
    "event_id" "uuid",
    "order_id" "uuid",
    "type" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'completed'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "transactions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "transactions_type_check" CHECK (("type" = ANY (ARRAY['income'::"text", 'expense'::"text", 'withdrawal'::"text", 'refund'::"text", 'fee'::"text"])))
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "session_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "path" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_activities_event_type_check" CHECK (("event_type" = ANY (ARRAY['session_start'::"text", 'page_view'::"text", 'login'::"text", 'logout'::"text", 'add_to_cart'::"text", 'purchase'::"text", 'session_end'::"text"]))),
    CONSTRAINT "user_activities_metadata_check" CHECK (("pg_column_size"("metadata") <= 4096)),
    CONSTRAINT "user_activities_path_check" CHECK (("length"("path") <= 2048)),
    CONSTRAINT "user_activities_session_id_check" CHECK (("length"("session_id") <= 64))
);


ALTER TABLE "public"."user_activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_consents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "terms_version" "text" NOT NULL,
    "privacy_version" "text" NOT NULL,
    "marketing_consent" boolean DEFAULT false NOT NULL,
    "data_sharing_consent" boolean DEFAULT false NOT NULL,
    "accepted_at" timestamp with time zone NOT NULL,
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ip" "inet",
    "forwarded_for" "text",
    "user_agent" "text",
    CONSTRAINT "user_consents_forwarded_for_check" CHECK (("length"("forwarded_for") <= 200)),
    CONSTRAINT "user_consents_privacy_version_check" CHECK (("length"("privacy_version") <= 20)),
    CONSTRAINT "user_consents_terms_version_check" CHECK (("length"("terms_version") <= 20)),
    CONSTRAINT "user_consents_user_agent_check" CHECK (("length"("user_agent") <= 300))
);


ALTER TABLE "public"."user_consents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_course_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "course_id" "uuid" NOT NULL,
    "progress" integer DEFAULT 0,
    "completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_course_progress_progress_check" CHECK ((("progress" >= 0) AND ("progress" <= 100)))
);


ALTER TABLE "public"."user_course_progress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_custom_features" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "feature_key" "text",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_custom_features" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "genres" "text"[] DEFAULT '{}'::"text"[],
    "event_types" "text"[] DEFAULT '{}'::"text"[],
    "max_distance" numeric DEFAULT 50,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles_ext" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "temperament" "text",
    "intention" "text",
    "music_style" "text",
    "energy_level" "text",
    "birth_year" numeric,
    "gender" "text",
    "bio" "text",
    "vibe" "text",
    "quiz_completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "social_url" "text",
    "tags" "jsonb" DEFAULT '{}'::"jsonb",
    "education" "text",
    "mesa_consent_version" "text",
    "mesa_consent_at" timestamp with time zone,
    "mesa_consent_revoked_at" timestamp with time zone,
    "rede_consent_at" timestamp with time zone,
    "rede_consent_revoked_at" timestamp with time zone,
    CONSTRAINT "user_profiles_ext_education_chk" CHECK (("education" = ANY (ARRAY['fundamental'::"text", 'medio'::"text", 'tecnico'::"text", 'superior_cursando'::"text", 'superior'::"text", 'pos'::"text"]))),
    CONSTRAINT "user_profiles_ext_intention_chk" CHECK (("intention" IS DISTINCT FROM 'romance'::"text")),
    CONSTRAINT "user_profiles_ext_sem_dado_extra_chk" CHECK ((("gender" IS NULL) AND ("bio" IS NULL) AND ("birth_year" IS NULL))),
    CONSTRAINT "user_profiles_ext_social_url_chk" CHECK (("social_url" ~ '^https://(www\.)?(instagram\.com|tiktok\.com|x\.com|twitter\.com|linkedin\.com)/[A-Za-z0-9._~@/-]{1,100}$'::"text")),
    CONSTRAINT "user_profiles_ext_tags_chk" CHECK ("public"."mesa_tags_ok"("tags")),
    CONSTRAINT "user_profiles_ext_vibe_chk" CHECK (("vibe" = ANY (ARRAY['Observador'::"text", 'Contemplador'::"text", 'Filósofo'::"text", 'Curioso'::"text", 'Explorador Tranquilo'::"text", 'Analista'::"text", 'Dinâmico Reservado'::"text", 'Energia Contida'::"text", 'Fogo Interior'::"text", 'Social Leve'::"text", 'Conector Calmo'::"text", 'Anfitrião Discreto'::"text", 'Animador'::"text", 'Centro das Atenções'::"text", 'Contagiante'::"text", 'Turbilhão'::"text", 'Furacão Social'::"text", 'Estrela Cadente'::"text", 'Equilibrado'::"text", 'Adaptável'::"text", 'Camaleão'::"text", 'Versátil'::"text", 'Multifacetado'::"text", 'Tudo-em-Um'::"text", 'Explosão Controlada'::"text", 'Dinamite Social'::"text", 'Supernova'::"text"])))
);


ALTER TABLE "public"."user_profiles_ext" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."webhook_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gateway" "text" NOT NULL,
    "event_id" "text" NOT NULL,
    "order_id" "uuid",
    "recebido_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resultado" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."webhook_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."withdrawals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producer_id" "uuid" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    "processed_by" "uuid",
    "pix_key_enc" "bytea",
    "bank_account_enc" "bytea",
    CONSTRAINT "withdrawals_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."withdrawals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."withdrawals_acessos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "leitor" "uuid",
    "lido_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "linhas" integer
);


ALTER TABLE "public"."withdrawals_acessos" OWNER TO "postgres";


ALTER TABLE ONLY "public"."academy_courses"
    ADD CONSTRAINT "academy_courses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."access_logs"
    ADD CONSTRAINT "access_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_audit_log"
    ADD CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_invites"
    ADD CONSTRAINT "admin_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_invites"
    ADD CONSTRAINT "admin_invites_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."affiliate_coupon_requests"
    ADD CONSTRAINT "affiliate_coupon_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."affiliate_links"
    ADD CONSTRAINT "affiliate_links_affiliate_id_slug_key" UNIQUE ("affiliate_id", "slug");



ALTER TABLE ONLY "public"."affiliate_links"
    ADD CONSTRAINT "affiliate_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."affiliates"
    ADD CONSTRAINT "affiliates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."afiliado_tentativas"
    ADD CONSTRAINT "afiliado_tentativas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_credit_grants"
    ADD CONSTRAINT "ai_credit_grants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_settings"
    ADD CONSTRAINT "ai_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_usage"
    ADD CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."beneficios_uf"
    ADD CONSTRAINT "beneficios_uf_pkey" PRIMARY KEY ("uf", "codigo");



ALTER TABLE ONLY "public"."certificates"
    ADD CONSTRAINT "certificates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_contacts"
    ADD CONSTRAINT "chat_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_contacts"
    ADD CONSTRAINT "chat_contacts_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."chat_departments"
    ADD CONSTRAINT "chat_departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_departments"
    ADD CONSTRAINT "chat_departments_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."chat_settings"
    ADD CONSTRAINT "chat_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_topics"
    ADD CONSTRAINT "chat_topics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."check_ins"
    ADD CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."collective_tables"
    ADD CONSTRAINT "collective_tables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_messages"
    ADD CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_rate_limit_hits"
    ADD CONSTRAINT "contact_rate_limit_hits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_messages"
    ADD CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_interactions"
    ADD CONSTRAINT "crm_interactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_leads"
    ADD CONSTRAINT "crm_leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_tasks"
    ADD CONSTRAINT "crm_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_logs"
    ADD CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_banners"
    ADD CONSTRAINT "event_banners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_budget_boxes"
    ADD CONSTRAINT "event_budget_boxes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_photos"
    ADD CONSTRAINT "event_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_reviews"
    ADD CONSTRAINT "event_reviews_event_id_user_id_key" UNIQUE ("event_id", "user_id");



ALTER TABLE ONLY "public"."event_reviews"
    ADD CONSTRAINT "event_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_surveys"
    ADD CONSTRAINT "event_surveys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_timeline_items"
    ADD CONSTRAINT "event_timeline_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_zones"
    ADD CONSTRAINT "event_zones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."evento_aceites"
    ADD CONSTRAINT "evento_aceites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."evento_privado"
    ADD CONSTRAINT "evento_privado_pkey" PRIMARY KEY ("event_id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."favoritos"
    ADD CONSTRAINT "favoritos_pkey" PRIMARY KEY ("user_id", "event_id");



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."interest_lists"
    ADD CONSTRAINT "interest_lists_event_id_user_id_key" UNIQUE ("event_id", "user_id");



ALTER TABLE ONLY "public"."interest_lists"
    ADD CONSTRAINT "interest_lists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."issued_certificates"
    ADD CONSTRAINT "issued_certificates_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."issued_certificates"
    ADD CONSTRAINT "issued_certificates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kb_articles"
    ADD CONSTRAINT "kb_articles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kb_articles"
    ADD CONSTRAINT "kb_articles_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."kb_perguntas_sem_resposta"
    ADD CONSTRAINT "kb_perguntas_sem_resposta_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kb_perguntas_sem_resposta"
    ADD CONSTRAINT "kb_perguntas_sem_resposta_texto_audience_key" UNIQUE ("texto", "audience");



ALTER TABLE ONLY "public"."kb_slugs_excluidos"
    ADD CONSTRAINT "kb_slugs_excluidos_pkey" PRIMARY KEY ("slug");



ALTER TABLE ONLY "public"."kb_termos"
    ADD CONSTRAINT "kb_termos_forma_key" UNIQUE ("forma");



ALTER TABLE ONLY "public"."kb_termos"
    ADD CONSTRAINT "kb_termos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menu_order_items"
    ADD CONSTRAINT "menu_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menu_orders"
    ADD CONSTRAINT "menu_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menu_orders"
    ADD CONSTRAINT "menu_orders_qr_code_key" UNIQUE ("qr_code");



ALTER TABLE ONLY "public"."mesa_avisos"
    ADD CONSTRAINT "mesa_avisos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mesa_consentimentos"
    ADD CONSTRAINT "mesa_consentimentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mesa_denuncias"
    ADD CONSTRAINT "mesa_denuncias_denunciante_denunciado_evento_key" UNIQUE ("denunciante", "denunciado", "evento");



ALTER TABLE ONLY "public"."mesa_denuncias"
    ADD CONSTRAINT "mesa_denuncias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mesa_moderacoes"
    ADD CONSTRAINT "mesa_moderacoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mesa_passagens"
    ADD CONSTRAINT "mesa_passagens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mesa_travas"
    ADD CONSTRAINT "mesa_travas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."newsletter_subscribers"
    ADD CONSTRAINT "newsletter_subscribers_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."newsletter_subscribers"
    ADD CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."newsletters"
    ADD CONSTRAINT "newsletters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."onboarding_logs"
    ADD CONSTRAINT "onboarding_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."partners"
    ADD CONSTRAINT "partners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pedido_assentos"
    ADD CONSTRAINT "pedido_assentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."piggy_transactions"
    ADD CONSTRAINT "piggy_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pipeline_stages"
    ADD CONSTRAINT "pipeline_stages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_affiliate_producers"
    ADD CONSTRAINT "platform_affiliate_producers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_affiliates"
    ADD CONSTRAINT "platform_affiliates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_affiliates"
    ADD CONSTRAINT "platform_affiliates_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."policy_notices"
    ADD CONSTRAINT "policy_notices_pkey" PRIMARY KEY ("user_id", "version");



ALTER TABLE ONLY "public"."producer_profiles"
    ADD CONSTRAINT "producer_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."producer_public"
    ADD CONSTRAINT "producer_public_pkey" PRIMARY KEY ("producer_id");



ALTER TABLE ONLY "public"."producer_subscriptions"
    ADD CONSTRAINT "producer_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."producer_subscriptions"
    ADD CONSTRAINT "producer_subscriptions_producer_id_key" UNIQUE ("producer_id");



ALTER TABLE ONLY "public"."producer_tasks"
    ADD CONSTRAINT "producer_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."revenue_advances"
    ADD CONSTRAINT "revenue_advances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."seating_maps"
    ADD CONSTRAINT "seating_maps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_profiles_acessos"
    ADD CONSTRAINT "staff_profiles_acessos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_profiles_historico_pagamento"
    ADD CONSTRAINT "staff_profiles_historico_pagamento_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_profiles"
    ADD CONSTRAINT "staff_profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."support_messages"
    ADD CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_sessions"
    ADD CONSTRAINT "support_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."table_members"
    ADD CONSTRAINT "table_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."table_members"
    ADD CONSTRAINT "table_members_ticket_id_key" UNIQUE ("ticket_id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_convite_email"
    ADD CONSTRAINT "team_convite_email_pkey" PRIMARY KEY ("producer_id", "user_id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_producer_user_key" UNIQUE ("producer_id", "user_id");



ALTER TABLE ONLY "public"."tentativas_reserva"
    ADD CONSTRAINT "tentativas_reserva_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ticket_types"
    ADD CONSTRAINT "ticket_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_qr_code_key" UNIQUE ("qr_code");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_activities"
    ADD CONSTRAINT "user_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_consents"
    ADD CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_consents"
    ADD CONSTRAINT "user_consents_user_id_terms_version_privacy_version_key" UNIQUE ("user_id", "terms_version", "privacy_version");



ALTER TABLE ONLY "public"."user_course_progress"
    ADD CONSTRAINT "user_course_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_course_progress"
    ADD CONSTRAINT "user_course_progress_user_id_course_id_key" UNIQUE ("user_id", "course_id");



ALTER TABLE ONLY "public"."user_custom_features"
    ADD CONSTRAINT "user_custom_features_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_profiles_ext"
    ADD CONSTRAINT "user_profiles_ext_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles_ext"
    ADD CONSTRAINT "user_profiles_ext_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."webhook_events"
    ADD CONSTRAINT "webhook_events_gateway_event_uk" UNIQUE ("gateway", "event_id");



ALTER TABLE ONLY "public"."webhook_events"
    ADD CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."withdrawals_acessos"
    ADD CONSTRAINT "withdrawals_acessos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."withdrawals"
    ADD CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("id");



CREATE INDEX "access_logs_created_at_idx" ON "public"."access_logs" USING "btree" ("created_at");



CREATE INDEX "access_logs_user_id_idx" ON "public"."access_logs" USING "btree" ("user_id");



CREATE INDEX "admin_audit_log_autor_idx" ON "public"."admin_audit_log" USING "btree" ("autor", "criado_em" DESC);



CREATE INDEX "admin_audit_log_data_idx" ON "public"."admin_audit_log" USING "btree" ("criado_em" DESC);



CREATE INDEX "admin_audit_log_objeto_idx" ON "public"."admin_audit_log" USING "btree" ("tabela", "objeto_id", "criado_em" DESC);



CREATE UNIQUE INDEX "admin_invites_pendente_email_idx" ON "public"."admin_invites" USING "btree" ("email") WHERE ("status" = 'pendente'::"text");



CREATE INDEX "admin_invites_used_by_idx" ON "public"."admin_invites" USING "btree" ("used_by") WHERE ("used_by" IS NOT NULL);



CREATE INDEX "affiliate_coupon_requests_affiliate_idx" ON "public"."affiliate_coupon_requests" USING "btree" ("affiliate_id", "created_at" DESC);



CREATE UNIQUE INDEX "affiliates_afiliado_evento_key" ON "public"."affiliates" USING "btree" ("affiliate_user_id", "event_id");



CREATE INDEX "afiliado_tentativas_producer_idx" ON "public"."afiliado_tentativas" USING "btree" ("producer_id", "criado_em");



CREATE INDEX "ai_credit_grants_user_created_idx" ON "public"."ai_credit_grants" USING "btree" ("user_id", "created_at");



CREATE INDEX "ai_usage_created_idx" ON "public"."ai_usage" USING "btree" ("created_at");



CREATE INDEX "ai_usage_user_created_idx" ON "public"."ai_usage" USING "btree" ("user_id", "created_at" DESC);



CREATE UNIQUE INDEX "certificates_event_id_key" ON "public"."certificates" USING "btree" ("event_id");



CREATE INDEX "chat_topics_department_idx" ON "public"."chat_topics" USING "btree" ("department_id");



CREATE INDEX "contact_messages_created_at_idx" ON "public"."contact_messages" USING "btree" ("created_at" DESC);



CREATE INDEX "contact_rate_limit_hits_ip_created_at_idx" ON "public"."contact_rate_limit_hits" USING "btree" ("ip", "created_at");



CREATE INDEX "conversation_messages_conv_created_idx" ON "public"."conversation_messages" USING "btree" ("conversation_id", "created_at");



CREATE INDEX "conversation_messages_sender_created_idx" ON "public"."conversation_messages" USING "btree" ("sender_id", "created_at");



CREATE INDEX "conversations_assignee_open_idx" ON "public"."conversations" USING "btree" ("assignee_id") WHERE ("status" = 'open'::"text");



CREATE INDEX "conversations_status_last_idx" ON "public"."conversations" USING "btree" ("status", "last_message_at" DESC);



CREATE INDEX "conversations_user_last_idx" ON "public"."conversations" USING "btree" ("user_id", "last_message_at" DESC);



CREATE UNIQUE INDEX "coupons_plataforma_code_idx" ON "public"."coupons" USING "btree" ("upper"("code")) WHERE ("producer_id" IS NULL);



CREATE UNIQUE INDEX "coupons_produtor_code_idx" ON "public"."coupons" USING "btree" ("producer_id", "upper"("code")) WHERE ("producer_id" IS NOT NULL);



CREATE UNIQUE INDEX "crm_leads_producer_email_uq" ON "public"."crm_leads" USING "btree" ("producer_id", "lower"("email"));



CREATE INDEX "email_logs_created_at_idx" ON "public"."email_logs" USING "btree" ("created_at");



CREATE INDEX "email_logs_pedido_tipo_idx" ON "public"."email_logs" USING "btree" ("order_id", "email_type", "created_at" DESC);



CREATE INDEX "evento_aceites_event_id_idx" ON "public"."evento_aceites" USING "btree" ("event_id", "aceito_em" DESC);



CREATE INDEX "evento_aceites_producer_aceito_idx" ON "public"."evento_aceites" USING "btree" ("producer_id", "aceito_em" DESC);



CREATE INDEX "favoritos_event_id_idx" ON "public"."favoritos" USING "btree" ("event_id");



CREATE INDEX "feedback_created_at_idx" ON "public"."feedback" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_advances_producer" ON "public"."revenue_advances" USING "btree" ("producer_id");



CREATE INDEX "idx_budget_boxes_producer" ON "public"."event_budget_boxes" USING "btree" ("producer_id");



CREATE INDEX "idx_course_progress_user" ON "public"."user_course_progress" USING "btree" ("user_id");



CREATE INDEX "idx_crm_leads_producer" ON "public"."crm_leads" USING "btree" ("producer_id");



CREATE INDEX "idx_custom_features_user" ON "public"."user_custom_features" USING "btree" ("user_id");



CREATE INDEX "idx_customers_event" ON "public"."customers" USING "btree" ("event_id");



CREATE INDEX "idx_event_banners_producer" ON "public"."event_banners" USING "btree" ("producer_id");



CREATE INDEX "idx_event_photos_producer" ON "public"."event_photos" USING "btree" ("producer_id");



CREATE INDEX "idx_events_date" ON "public"."events" USING "btree" ("date");



CREATE INDEX "idx_events_producer" ON "public"."events" USING "btree" ("producer_id");



CREATE INDEX "idx_events_slug" ON "public"."events" USING "btree" ("slug");



CREATE INDEX "idx_events_status" ON "public"."events" USING "btree" ("status");



CREATE INDEX "idx_onboarding_user" ON "public"."onboarding_logs" USING "btree" ("user_id");



CREATE INDEX "idx_orders_event" ON "public"."orders" USING "btree" ("event_id");



CREATE INDEX "idx_orders_user" ON "public"."orders" USING "btree" ("user_id");



CREATE INDEX "idx_piggy_box" ON "public"."piggy_transactions" USING "btree" ("box_id");



CREATE INDEX "idx_support_messages_session" ON "public"."support_messages" USING "btree" ("session_id");



CREATE INDEX "idx_surveys_event" ON "public"."event_surveys" USING "btree" ("event_id");



CREATE INDEX "idx_tasks_event" ON "public"."tasks" USING "btree" ("event_id");



CREATE INDEX "idx_ticket_types_event" ON "public"."ticket_types" USING "btree" ("event_id");



CREATE INDEX "idx_tickets_event" ON "public"."tickets" USING "btree" ("event_id");



CREATE INDEX "idx_tickets_user" ON "public"."tickets" USING "btree" ("user_id");



CREATE INDEX "idx_timeline_event" ON "public"."event_timeline_items" USING "btree" ("event_id");



CREATE INDEX "idx_user_activities_created_at" ON "public"."user_activities" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_user_activities_session_id" ON "public"."user_activities" USING "btree" ("session_id");



CREATE INDEX "idx_user_activities_user_id" ON "public"."user_activities" USING "btree" ("user_id");



CREATE INDEX "idx_zones_event" ON "public"."event_zones" USING "btree" ("event_id");



CREATE INDEX "interest_lists_event_idx" ON "public"."interest_lists" USING "btree" ("event_id");



CREATE INDEX "interest_lists_pendentes_idx" ON "public"."interest_lists" USING "btree" ("created_at") WHERE ((NOT "notified") AND ("removido_em" IS NULL));



CREATE INDEX "interest_lists_user_idx" ON "public"."interest_lists" USING "btree" ("user_id");



CREATE UNIQUE INDEX "issued_certificates_certificado_pessoa_key" ON "public"."issued_certificates" USING "btree" ("certificate_id", "user_id");



CREATE INDEX "kb_articles_busca_idx" ON "public"."kb_articles" USING "gin" ("busca");



CREATE UNIQUE INDEX "kb_articles_ia_conversa_uidx" ON "public"."kb_articles" USING "btree" ("source_conversation_id") WHERE ("origin" = 'ia'::"text");



CREATE UNIQUE INDEX "mesa_avisos_nao_lido_uq" ON "public"."mesa_avisos" USING "btree" ("user_id", "table_id", "tipo") WHERE (NOT "lido");



CREATE INDEX "mesa_consentimentos_user_idx" ON "public"."mesa_consentimentos" USING "btree" ("user_id");



CREATE INDEX "mesa_denuncias_evento_idx" ON "public"."mesa_denuncias" USING "btree" ("evento");



CREATE INDEX "mesa_moderacoes_em_idx" ON "public"."mesa_moderacoes" USING "btree" ("em");



CREATE INDEX "mesa_moderacoes_user_idx" ON "public"."mesa_moderacoes" USING "btree" ("user_id", "hash");



CREATE INDEX "mesa_passagens_membro_idx" ON "public"."mesa_passagens" USING "btree" ("membro_id");



CREATE INDEX "mesa_passagens_mesa_idx" ON "public"."mesa_passagens" USING "btree" ("table_id");



CREATE INDEX "mesa_passagens_user_idx" ON "public"."mesa_passagens" USING "btree" ("user_id", "evento");



CREATE UNIQUE INDEX "mesa_travas_vigente_uq" ON "public"."mesa_travas" USING "btree" ("evento", "user_id") WHERE ("destravada_em" IS NULL);



CREATE UNIQUE INDEX "newsletter_subscribers_email_lower_idx" ON "public"."newsletter_subscribers" USING "btree" ("lower"("email"));



CREATE UNIQUE INDEX "newsletter_subscribers_unsubscribe_token_idx" ON "public"."newsletter_subscribers" USING "btree" ("unsubscribe_token");



CREATE INDEX "notifications_user_created_idx" ON "public"."notifications" USING "btree" ("user_id", "created_at" DESC);



CREATE UNIQUE INDEX "onboarding_logs_user_step_key" ON "public"."onboarding_logs" USING "btree" ("user_id", "step_name");



CREATE INDEX "orders_customer_cpf_hmac_idx" ON "public"."orders" USING "btree" ("customer_cpf_hmac") WHERE ("customer_cpf_hmac" IS NOT NULL);



CREATE UNIQUE INDEX "orders_gateway_payment_id_uk" ON "public"."orders" USING "btree" ("gateway_payment_id") WHERE ("gateway_payment_id" IS NOT NULL);



CREATE INDEX "orders_reserva_conta_evento_idx" ON "public"."orders" USING "btree" ("user_id", "event_id", "created_at") WHERE ("reservado_ate" IS NOT NULL);



CREATE UNIQUE INDEX "pedido_assentos_lugar_vivo" ON "public"."pedido_assentos" USING "btree" ("event_id", "seat_key") WHERE ("liberada_em" IS NULL);



CREATE INDEX "pedido_assentos_pedido" ON "public"."pedido_assentos" USING "btree" ("order_id");



CREATE INDEX "platform_affiliate_producers_affiliate_idx" ON "public"."platform_affiliate_producers" USING "btree" ("affiliate_id");



CREATE UNIQUE INDEX "platform_affiliate_producers_ativo_idx" ON "public"."platform_affiliate_producers" USING "btree" ("producer_id") WHERE ("ended_at" IS NULL);



CREATE UNIQUE INDEX "platform_affiliates_code_upper_idx" ON "public"."platform_affiliates" USING "btree" ("upper"("referral_code"));



CREATE UNIQUE INDEX "platform_affiliates_cpf_hmac_idx" ON "public"."platform_affiliates" USING "btree" ("cpf_hmac") WHERE ("cpf_hmac" IS NOT NULL);



CREATE UNIQUE INDEX "platform_affiliates_payout_idx" ON "public"."platform_affiliates" USING "btree" ("payout_account_id") WHERE ("payout_account_id" IS NOT NULL);



CREATE UNIQUE INDEX "producer_profiles_cnpj_hmac_idx" ON "public"."producer_profiles" USING "btree" ("cnpj_hmac") WHERE ("cnpj_hmac" IS NOT NULL);



CREATE INDEX "producer_subscriptions_producer_id_idx" ON "public"."producer_subscriptions" USING "btree" ("producer_id");



CREATE INDEX "profiles_avatar_pendente_idx" ON "public"."profiles" USING "btree" ("avatar_moderacao") WHERE ("avatar_moderacao" = 'pendente'::"text");



CREATE UNIQUE INDEX "seating_maps_event_id_key" ON "public"."seating_maps" USING "btree" ("event_id");



CREATE INDEX "staff_hist_pagamento_user_idx" ON "public"."staff_profiles_historico_pagamento" USING "btree" ("user_id");



CREATE INDEX "staff_profiles_acessos_colaborador_idx" ON "public"."staff_profiles_acessos" USING "btree" ("colaborador", "lido_em");



CREATE INDEX "team_convite_tentativas_producer_em_idx" ON "public"."team_convite_tentativas" USING "btree" ("producer_id", "em");



CREATE INDEX "tentativas_reserva_quando_idx" ON "public"."tentativas_reserva" USING "btree" ("quando");



CREATE INDEX "tentativas_reserva_user_idx" ON "public"."tentativas_reserva" USING "btree" ("user_id", "quando");



CREATE INDEX "user_activities_created_at_idx" ON "public"."user_activities" USING "btree" ("created_at");



CREATE INDEX "withdrawals_processed_by_idx" ON "public"."withdrawals" USING "btree" ("processed_by") WHERE ("processed_by" IS NOT NULL);



CREATE OR REPLACE TRIGGER "admin_audit_log_imutavel" BEFORE DELETE OR UPDATE ON "public"."admin_audit_log" FOR EACH ROW EXECUTE FUNCTION "public"."audit_log_imutavel"();



CREATE OR REPLACE TRIGGER "admin_audit_log_sem_truncate" BEFORE TRUNCATE ON "public"."admin_audit_log" FOR EACH STATEMENT EXECUTE FUNCTION "public"."audit_log_imutavel"();



CREATE OR REPLACE TRIGGER "audit_admin_invites_ins" AFTER INSERT ON "public"."admin_invites" FOR EACH ROW WHEN (true) EXECUTE FUNCTION "public"."audit_registra"('id', 'status,permissions,token_hash,expires_at', 'token_hash,email');



CREATE OR REPLACE TRIGGER "audit_admin_invites_upd" AFTER UPDATE ON "public"."admin_invites" FOR EACH ROW WHEN ((("old"."status" IS DISTINCT FROM "new"."status") OR ("old"."permissions" IS DISTINCT FROM "new"."permissions") OR ("old"."token_hash" IS DISTINCT FROM "new"."token_hash") OR ("old"."expires_at" IS DISTINCT FROM "new"."expires_at"))) EXECUTE FUNCTION "public"."audit_registra"('id', 'status,permissions,token_hash,expires_at', 'token_hash,email');



CREATE OR REPLACE TRIGGER "audit_affiliate_coupon_requests_del" AFTER DELETE ON "public"."affiliate_coupon_requests" FOR EACH ROW WHEN (true) EXECUTE FUNCTION "public"."audit_registra"('id', 'affiliate_id,status,admin_notes,coupon_id,decided_at,decided_by,discount_percent,valid_days,plans', '');



CREATE OR REPLACE TRIGGER "audit_affiliate_coupon_requests_upd" AFTER UPDATE ON "public"."affiliate_coupon_requests" FOR EACH ROW WHEN ((("old"."status" IS DISTINCT FROM "new"."status") OR ("old"."admin_notes" IS DISTINCT FROM "new"."admin_notes") OR ("old"."coupon_id" IS DISTINCT FROM "new"."coupon_id"))) EXECUTE FUNCTION "public"."audit_registra"('id', 'affiliate_id,status,admin_notes,coupon_id,decided_at,decided_by,discount_percent,valid_days,plans', '');



CREATE OR REPLACE TRIGGER "audit_affiliate_links_del" AFTER DELETE ON "public"."affiliate_links" FOR EACH ROW WHEN (true) EXECUTE FUNCTION "public"."audit_registra"('id', 'affiliate_id,slug,label,is_active', '');



CREATE OR REPLACE TRIGGER "audit_affiliate_links_ins" AFTER INSERT ON "public"."affiliate_links" FOR EACH ROW WHEN (true) EXECUTE FUNCTION "public"."audit_registra"('id', 'affiliate_id,slug,label,is_active', '');



CREATE OR REPLACE TRIGGER "audit_affiliate_links_upd" AFTER UPDATE ON "public"."affiliate_links" FOR EACH ROW WHEN ((("to_jsonb"("new".*) - 'clicks'::"text") IS DISTINCT FROM ("to_jsonb"("old".*) - 'clicks'::"text"))) EXECUTE FUNCTION "public"."audit_registra"('id', 'affiliate_id,slug,label,is_active', '');



CREATE OR REPLACE TRIGGER "audit_ai_credit_grants_ins" AFTER INSERT ON "public"."ai_credit_grants" FOR EACH ROW WHEN (true) EXECUTE FUNCTION "public"."audit_registra"('id', 'user_id,amount,created_by', 'note');



CREATE OR REPLACE TRIGGER "audit_ai_settings_del" AFTER DELETE ON "public"."ai_settings" FOR EACH ROW WHEN (true) EXECUTE FUNCTION "public"."audit_registra"('id', 'enabled,model_router,model_simple,model_complex,model_vision,prices,usd_brl,daily_cap_brl,hourly_limit,quotas,credit_cost,max_steps,max_output_tokens,key_updated_at,key_updated_by', '');



CREATE OR REPLACE TRIGGER "audit_ai_settings_ins" AFTER INSERT ON "public"."ai_settings" FOR EACH ROW WHEN (true) EXECUTE FUNCTION "public"."audit_registra"('id', 'enabled,model_router,model_simple,model_complex,model_vision,prices,usd_brl,daily_cap_brl,hourly_limit,quotas,credit_cost,max_steps,max_output_tokens,key_updated_at,key_updated_by', '');



CREATE OR REPLACE TRIGGER "audit_ai_settings_upd" AFTER UPDATE ON "public"."ai_settings" FOR EACH ROW WHEN (("old".* IS DISTINCT FROM "new".*)) EXECUTE FUNCTION "public"."audit_registra"('id', 'enabled,model_router,model_simple,model_complex,model_vision,prices,usd_brl,daily_cap_brl,hourly_limit,quotas,credit_cost,max_steps,max_output_tokens,key_updated_at,key_updated_by', '');



CREATE OR REPLACE TRIGGER "audit_chat_settings_ins" AFTER INSERT ON "public"."chat_settings" FOR EACH ROW WHEN (true) EXECUTE FUNCTION "public"."audit_registra"('id', 'hours,response_time,team_email,bot_enabled', '');



CREATE OR REPLACE TRIGGER "audit_chat_settings_upd" AFTER UPDATE ON "public"."chat_settings" FOR EACH ROW WHEN (("old".* IS DISTINCT FROM "new".*)) EXECUTE FUNCTION "public"."audit_registra"('id', 'hours,response_time,team_email,bot_enabled', '');



CREATE OR REPLACE TRIGGER "audit_contact_messages_del" AFTER DELETE ON "public"."contact_messages" FOR EACH ROW WHEN (true) EXECUTE FUNCTION "public"."audit_registra"('id', 'name,email,phone,subject,message', 'name,email,phone,subject,message');



CREATE OR REPLACE TRIGGER "audit_contact_messages_upd" AFTER UPDATE ON "public"."contact_messages" FOR EACH ROW WHEN (("old".* IS DISTINCT FROM "new".*)) EXECUTE FUNCTION "public"."audit_registra"('id', 'name,email,phone,subject,message', 'name,email,phone,subject,message');



CREATE OR REPLACE TRIGGER "audit_coupons_del" AFTER DELETE ON "public"."coupons" FOR EACH ROW WHEN (("old"."producer_id" IS NULL)) EXECUTE FUNCTION "public"."audit_registra"('id', 'producer_id,event_id,code,discount_type,discount_value,max_uses,valid_until,valid_from,is_active,description,max_uses_per_user,min_order_value,max_discount,audience,plans,duration,duration_months,affiliate_id,upgrade_from', '');



CREATE OR REPLACE TRIGGER "audit_coupons_ins" AFTER INSERT ON "public"."coupons" FOR EACH ROW WHEN (("new"."producer_id" IS NULL)) EXECUTE FUNCTION "public"."audit_registra"('id', 'producer_id,event_id,code,discount_type,discount_value,max_uses,valid_until,valid_from,is_active,description,max_uses_per_user,min_order_value,max_discount,audience,plans,duration,duration_months,affiliate_id,upgrade_from', '');



CREATE OR REPLACE TRIGGER "audit_coupons_upd" AFTER UPDATE ON "public"."coupons" FOR EACH ROW WHEN (((("old"."producer_id" IS NULL) OR ("new"."producer_id" IS NULL)) AND ((("to_jsonb"("new".*) - 'uses'::"text") - 'updated_at'::"text") IS DISTINCT FROM (("to_jsonb"("old".*) - 'uses'::"text") - 'updated_at'::"text")))) EXECUTE FUNCTION "public"."audit_registra"('id', 'producer_id,event_id,code,discount_type,discount_value,max_uses,valid_until,valid_from,is_active,description,max_uses_per_user,min_order_value,max_discount,audience,plans,duration,duration_months,affiliate_id,upgrade_from', '');



CREATE OR REPLACE TRIGGER "audit_events_upd" AFTER UPDATE ON "public"."events" FOR EACH ROW WHEN ((("old"."approval_status" IS DISTINCT FROM "new"."approval_status") OR ("old"."approved_at" IS DISTINCT FROM "new"."approved_at") OR ("old"."approved_by" IS DISTINCT FROM "new"."approved_by") OR ("old"."rejection_reason" IS DISTINCT FROM "new"."rejection_reason") OR ("old"."featured_carousel" IS DISTINCT FROM "new"."featured_carousel"))) EXECUTE FUNCTION "public"."audit_registra"('id', 'approval_status,approved_at,approved_by,rejection_reason,featured_carousel', '');



CREATE OR REPLACE TRIGGER "audit_feedback_del" AFTER DELETE ON "public"."feedback" FOR EACH ROW WHEN (true) EXECUTE FUNCTION "public"."audit_registra"('id', 'status,admin_notes,message,user_agent', 'message,user_agent');



CREATE OR REPLACE TRIGGER "audit_feedback_upd" AFTER UPDATE ON "public"."feedback" FOR EACH ROW WHEN ((("old"."status" IS DISTINCT FROM "new"."status") OR ("old"."admin_notes" IS DISTINCT FROM "new"."admin_notes"))) EXECUTE FUNCTION "public"."audit_registra"('id', 'status,admin_notes,message,user_agent', 'message,user_agent');



CREATE OR REPLACE TRIGGER "audit_kb_articles_del" AFTER DELETE ON "public"."kb_articles" FOR EACH ROW WHEN (true) EXECUTE FUNCTION "public"."audit_registra"('id', 'slug,title,body,keywords,audience,department_id,status,review_note', 'body,busca');



CREATE OR REPLACE TRIGGER "audit_kb_articles_ins" AFTER INSERT ON "public"."kb_articles" FOR EACH ROW WHEN (true) EXECUTE FUNCTION "public"."audit_registra"('id', 'slug,title,body,keywords,audience,department_id,status,review_note', 'body,busca');



CREATE OR REPLACE TRIGGER "audit_kb_articles_upd" AFTER UPDATE ON "public"."kb_articles" FOR EACH ROW WHEN (("old".* IS DISTINCT FROM "new".*)) EXECUTE FUNCTION "public"."audit_registra"('id', 'slug,title,body,keywords,audience,department_id,status,review_note', 'body,busca');



CREATE OR REPLACE TRIGGER "audit_kb_termos_del" AFTER DELETE ON "public"."kb_termos" FOR EACH ROW WHEN (true) EXECUTE FUNCTION "public"."audit_registra"('id', 'forma,normal', '');



CREATE OR REPLACE TRIGGER "audit_kb_termos_ins" AFTER INSERT ON "public"."kb_termos" FOR EACH ROW WHEN (true) EXECUTE FUNCTION "public"."audit_registra"('id', 'forma,normal', '');



CREATE OR REPLACE TRIGGER "audit_kb_termos_upd" AFTER UPDATE ON "public"."kb_termos" FOR EACH ROW WHEN (("old".* IS DISTINCT FROM "new".*)) EXECUTE FUNCTION "public"."audit_registra"('id', 'forma,normal', '');



CREATE OR REPLACE TRIGGER "audit_newsletters_del" AFTER DELETE ON "public"."newsletters" FOR EACH ROW WHEN (true) EXECUTE FUNCTION "public"."audit_registra"('id', 'title,content,status,sent_at,recipient_count', 'content');



CREATE OR REPLACE TRIGGER "audit_newsletters_ins" AFTER INSERT ON "public"."newsletters" FOR EACH ROW WHEN (true) EXECUTE FUNCTION "public"."audit_registra"('id', 'title,content,status,sent_at,recipient_count', 'content');



CREATE OR REPLACE TRIGGER "audit_newsletters_upd" AFTER UPDATE ON "public"."newsletters" FOR EACH ROW WHEN (("old".* IS DISTINCT FROM "new".*)) EXECUTE FUNCTION "public"."audit_registra"('id', 'title,content,status,sent_at,recipient_count', 'content');



CREATE OR REPLACE TRIGGER "audit_platform_affiliate_producers_del" AFTER DELETE ON "public"."platform_affiliate_producers" FOR EACH ROW WHEN (true) EXECUTE FUNCTION "public"."audit_registra"('id', 'producer_id,affiliate_id,source,ended_at,ended_by,affiliate_link_id', '');



CREATE OR REPLACE TRIGGER "audit_platform_affiliate_producers_ins" AFTER INSERT ON "public"."platform_affiliate_producers" FOR EACH ROW WHEN (true) EXECUTE FUNCTION "public"."audit_registra"('id', 'producer_id,affiliate_id,source,ended_at,ended_by,affiliate_link_id', '');



CREATE OR REPLACE TRIGGER "audit_platform_affiliate_producers_upd" AFTER UPDATE ON "public"."platform_affiliate_producers" FOR EACH ROW WHEN (("old".* IS DISTINCT FROM "new".*)) EXECUTE FUNCTION "public"."audit_registra"('id', 'producer_id,affiliate_id,source,ended_at,ended_by,affiliate_link_id', '');



CREATE OR REPLACE TRIGGER "audit_platform_affiliates_del" AFTER DELETE ON "public"."platform_affiliates" FOR EACH ROW WHEN (true) EXECUTE FUNCTION "public"."audit_registra"('id', 'user_id,referral_code,recurring_percent,status,agreement_date,full_name,notes,cpf_enc,payout_account_id', 'full_name,notes,cpf_enc,birth_date,email,phone,whatsapp,cep,street,street_number,complement,neighborhood,city,state,payout_account_id');



CREATE OR REPLACE TRIGGER "audit_platform_affiliates_ins" AFTER INSERT ON "public"."platform_affiliates" FOR EACH ROW WHEN (true) EXECUTE FUNCTION "public"."audit_registra"('id', 'user_id,referral_code,recurring_percent,status,agreement_date,full_name,notes,cpf_enc,payout_account_id', 'full_name,notes,cpf_enc,birth_date,email,phone,whatsapp,cep,street,street_number,complement,neighborhood,city,state,payout_account_id');



CREATE OR REPLACE TRIGGER "audit_platform_affiliates_upd" AFTER UPDATE ON "public"."platform_affiliates" FOR EACH ROW WHEN (("old".* IS DISTINCT FROM "new".*)) EXECUTE FUNCTION "public"."audit_registra"('id', 'user_id,referral_code,recurring_percent,status,agreement_date,full_name,notes,cpf_enc,payout_account_id', 'full_name,notes,cpf_enc,birth_date,email,phone,whatsapp,cep,street,street_number,complement,neighborhood,city,state,payout_account_id');



CREATE OR REPLACE TRIGGER "audit_platform_settings_del" AFTER DELETE ON "public"."platform_settings" FOR EACH ROW WHEN (true) EXECUTE FUNCTION "public"."audit_registra"('id', 'key,value', '');



CREATE OR REPLACE TRIGGER "audit_platform_settings_ins" AFTER INSERT ON "public"."platform_settings" FOR EACH ROW WHEN (true) EXECUTE FUNCTION "public"."audit_registra"('id', 'key,value', '');



CREATE OR REPLACE TRIGGER "audit_platform_settings_upd" AFTER UPDATE ON "public"."platform_settings" FOR EACH ROW WHEN ((("old"."key" IS DISTINCT FROM "new"."key") OR ("old"."value" IS DISTINCT FROM "new"."value"))) EXECUTE FUNCTION "public"."audit_registra"('id', 'key,value', '');



CREATE OR REPLACE TRIGGER "audit_producer_profiles_upd" AFTER UPDATE ON "public"."producer_profiles" FOR EACH ROW WHEN ((("old"."commission_rate" IS DISTINCT FROM "new"."commission_rate") OR ("old"."is_verified" IS DISTINCT FROM "new"."is_verified") OR ("old"."pix_key_enc" IS DISTINCT FROM "new"."pix_key_enc") OR ("old"."bank_account_enc" IS DISTINCT FROM "new"."bank_account_enc") OR ("old"."cnpj_enc" IS DISTINCT FROM "new"."cnpj_enc") OR ("old"."stripe_account_id" IS DISTINCT FROM "new"."stripe_account_id") OR ("old"."woovi_account_id" IS DISTINCT FROM "new"."woovi_account_id"))) EXECUTE FUNCTION "public"."audit_registra"('id', 'commission_rate,is_verified,pix_key_enc,bank_account_enc,cnpj_enc,stripe_account_id,woovi_account_id', 'pix_key_enc,bank_account_enc,cnpj_enc,stripe_account_id,woovi_account_id,webhook_url,notification_settings,company_name,api_key');



CREATE OR REPLACE TRIGGER "audit_producer_subscriptions_del" AFTER DELETE ON "public"."producer_subscriptions" FOR EACH ROW WHEN (true) EXECUTE FUNCTION "public"."audit_registra"('id', 'producer_id,plan,started_at,expires_at,is_active', '');



CREATE OR REPLACE TRIGGER "audit_producer_subscriptions_ins" AFTER INSERT ON "public"."producer_subscriptions" FOR EACH ROW WHEN (true) EXECUTE FUNCTION "public"."audit_registra"('id', 'producer_id,plan,started_at,expires_at,is_active', '');



CREATE OR REPLACE TRIGGER "audit_producer_subscriptions_upd" AFTER UPDATE ON "public"."producer_subscriptions" FOR EACH ROW WHEN (("old".* IS DISTINCT FROM "new".*)) EXECUTE FUNCTION "public"."audit_registra"('id', 'producer_id,plan,started_at,expires_at,is_active', '');



CREATE OR REPLACE TRIGGER "audit_profiles_upd" AFTER UPDATE ON "public"."profiles" FOR EACH ROW WHEN ((("old"."role" IS DISTINCT FROM "new"."role") OR ("old"."admin_permissions" IS DISTINCT FROM "new"."admin_permissions") OR ("old"."is_verified" IS DISTINCT FROM "new"."is_verified"))) EXECUTE FUNCTION "public"."audit_registra"('id', 'role,admin_permissions,is_verified', 'email,full_name,phone,cpf,avatar_url,bio,city,birth_date,instagram,tiktok,linkedin,website,stripe_customer_id,avatar_moderacao_hash');



CREATE OR REPLACE TRIGGER "audit_revenue_advances_del" AFTER DELETE ON "public"."revenue_advances" FOR EACH ROW WHEN (true) EXECUTE FUNCTION "public"."audit_registra"('id', 'producer_id,event_id,amount,status,transferred_at', '');



CREATE OR REPLACE TRIGGER "audit_revenue_advances_upd" AFTER UPDATE ON "public"."revenue_advances" FOR EACH ROW WHEN (("old"."status" IS DISTINCT FROM "new"."status")) EXECUTE FUNCTION "public"."audit_registra"('id', 'producer_id,event_id,amount,status,transferred_at', '');



CREATE OR REPLACE TRIGGER "audit_user_custom_features_del" AFTER DELETE ON "public"."user_custom_features" FOR EACH ROW WHEN (true) EXECUTE FUNCTION "public"."audit_registra"('id', 'user_id,feature_key,expires_at', '');



CREATE OR REPLACE TRIGGER "audit_user_custom_features_ins" AFTER INSERT ON "public"."user_custom_features" FOR EACH ROW WHEN (true) EXECUTE FUNCTION "public"."audit_registra"('id', 'user_id,feature_key,expires_at', '');



CREATE OR REPLACE TRIGGER "audit_user_custom_features_upd" AFTER UPDATE ON "public"."user_custom_features" FOR EACH ROW WHEN (("old".* IS DISTINCT FROM "new".*)) EXECUTE FUNCTION "public"."audit_registra"('id', 'user_id,feature_key,expires_at', '');



CREATE OR REPLACE TRIGGER "audit_withdrawals_upd" AFTER UPDATE ON "public"."withdrawals" FOR EACH ROW WHEN (("old"."status" IS DISTINCT FROM "new"."status")) EXECUTE FUNCTION "public"."audit_registra"('id', 'status,processed_at,processed_by', 'pix_key,bank_account');



CREATE OR REPLACE TRIGGER "chat_messages_after_insert" AFTER INSERT ON "public"."conversation_messages" FOR EACH ROW EXECUTE FUNCTION "public"."chat_messages_after_insert"();



CREATE OR REPLACE TRIGGER "chat_messages_before_insert" BEFORE INSERT ON "public"."conversation_messages" FOR EACH ROW EXECUTE FUNCTION "public"."chat_messages_before_insert"();



CREATE OR REPLACE TRIGGER "evento_privado_marca" AFTER INSERT OR DELETE OR UPDATE ON "public"."evento_privado" FOR EACH ROW EXECUTE FUNCTION "public"."evento_privado_marca"();



CREATE OR REPLACE TRIGGER "gf_cupom_regras" BEFORE INSERT OR UPDATE OF "code", "producer_id" ON "public"."coupons" FOR EACH ROW EXECUTE FUNCTION "public"."gf_cupom_regras"();



CREATE OR REPLACE TRIGGER "gf_events_ingressos_marca" BEFORE INSERT OR UPDATE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."gf_events_ingressos_marca"();



CREATE OR REPLACE TRIGGER "gf_interesse_para_crm" AFTER INSERT OR UPDATE OF "removido_em" ON "public"."interest_lists" FOR EACH ROW EXECUTE FUNCTION "public"."gf_interesse_para_crm"();



CREATE OR REPLACE TRIGGER "gf_notificar_evento" AFTER UPDATE OF "approval_status", "status", "date", "time", "start_date", "end_date", "venue_name", "venue_address", "venue_city", "venue_state" ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."gf_notificar_evento"();



CREATE OR REPLACE TRIGGER "gf_protect_affiliate_link" BEFORE UPDATE ON "public"."affiliate_links" FOR EACH ROW EXECUTE FUNCTION "public"."gf_protect_affiliate_link"();



CREATE OR REPLACE TRIGGER "gf_protect_coupon_uses" BEFORE INSERT OR UPDATE ON "public"."coupons" FOR EACH ROW EXECUTE FUNCTION "public"."gf_protect_coupon_uses"();



CREATE OR REPLACE TRIGGER "gf_protect_event_cancel" BEFORE UPDATE OF "status" ON "public"."events" FOR EACH ROW WHEN ((("old"."status" IS DISTINCT FROM "new"."status") AND (("new"."status" = ANY (ARRAY['cancelled'::"text", 'draft'::"text", 'ended'::"text"])) OR ("old"."status" = 'cancelled'::"text")))) EXECUTE FUNCTION "public"."gf_protect_event_cancel"();



CREATE OR REPLACE TRIGGER "gf_protect_event_moderation" BEFORE INSERT OR UPDATE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."gf_protect_event_moderation"();



CREATE OR REPLACE TRIGGER "gf_protect_platform_affiliate_payout" BEFORE UPDATE ON "public"."platform_affiliates" FOR EACH ROW EXECUTE FUNCTION "public"."gf_protect_platform_affiliate_payout"();



CREATE OR REPLACE TRIGGER "gf_protect_producer_profile_privileges" BEFORE INSERT OR UPDATE ON "public"."producer_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."gf_protect_producer_profile_privileges"();



CREATE OR REPLACE TRIGGER "gf_protect_profile_privileges" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."gf_protect_profile_privileges"();



CREATE OR REPLACE TRIGGER "gf_protect_withdrawals" BEFORE UPDATE ON "public"."withdrawals" FOR EACH ROW EXECUTE FUNCTION "public"."gf_protect_withdrawals"();



CREATE OR REPLACE TRIGGER "gf_reauth_dinheiro_ins" BEFORE INSERT ON "public"."producer_profiles" FOR EACH ROW WHEN (("new"."commission_rate" IS DISTINCT FROM 10.00)) EXECUTE FUNCTION "public"."gf_reauth_dinheiro"();



CREATE OR REPLACE TRIGGER "gf_reauth_dinheiro_upd" BEFORE UPDATE ON "public"."producer_profiles" FOR EACH ROW WHEN (("old"."commission_rate" IS DISTINCT FROM "new"."commission_rate")) EXECUTE FUNCTION "public"."gf_reauth_dinheiro"();



CREATE OR REPLACE TRIGGER "gf_ticket_types_toca_evento" AFTER INSERT OR DELETE OR UPDATE ON "public"."ticket_types" FOR EACH ROW EXECUTE FUNCTION "public"."gf_ticket_types_toca_evento"();



CREATE OR REPLACE TRIGGER "gf_trava_venda_ingresso" BEFORE UPDATE ON "public"."ticket_types" FOR EACH ROW WHEN ((("new"."quantity_total" IS DISTINCT FROM "old"."quantity_total") OR ("new"."capacity" IS DISTINCT FROM "old"."capacity"))) EXECUTE FUNCTION "public"."gf_trava_venda_ingresso"();



CREATE OR REPLACE TRIGGER "kb_articles_after_delete" AFTER DELETE ON "public"."kb_articles" FOR EACH ROW EXECUTE FUNCTION "public"."kb_articles_after_delete"();



CREATE OR REPLACE TRIGGER "mesa_avatar_guard" BEFORE INSERT OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."mesa_avatar_guard"();



CREATE OR REPLACE TRIGGER "mesa_consent_guard" BEFORE INSERT OR UPDATE ON "public"."user_profiles_ext" FOR EACH ROW EXECUTE FUNCTION "public"."mesa_consent_guard"();



CREATE OR REPLACE TRIGGER "mesa_idade_guard" BEFORE INSERT OR UPDATE OF "ticket_type_id", "user_id", "status" ON "public"."tickets" FOR EACH ROW EXECUTE FUNCTION "public"."mesa_idade_guard"();



CREATE OR REPLACE TRIGGER "mesa_passagem" AFTER INSERT OR DELETE OR UPDATE OF "table_id" ON "public"."table_members" FOR EACH ROW EXECUTE FUNCTION "public"."mesa_passagem"();



CREATE OR REPLACE TRIGGER "mesa_pedido_guard" BEFORE INSERT OR UPDATE OF "ticket_type_id", "quantity", "order_id" ON "public"."order_items" FOR EACH ROW EXECUTE FUNCTION "public"."mesa_pedido_guard"();



CREATE OR REPLACE TRIGGER "mesa_tipo_guard" BEFORE UPDATE OF "type" ON "public"."ticket_types" FOR EACH ROW EXECUTE FUNCTION "public"."mesa_tipo_guard"();



CREATE OR REPLACE TRIGGER "order_items_estoque_guard" BEFORE INSERT OR UPDATE OF "ticket_type_id", "quantity" ON "public"."order_items" FOR EACH ROW EXECUTE FUNCTION "public"."order_items_estoque_guard"();



CREATE OR REPLACE TRIGGER "orders_cpf_hash" BEFORE INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."orders_cpf_hash"();



CREATE OR REPLACE TRIGGER "orders_pago_assento_guard" BEFORE UPDATE OF "status" ON "public"."orders" FOR EACH ROW WHEN ((("new"."status" = 'paid'::"text") AND ("old"."status" IS DISTINCT FROM 'paid'::"text"))) EXECUTE FUNCTION "public"."orders_pago_assento_guard"();



CREATE OR REPLACE TRIGGER "orders_pago_cpf_guard" BEFORE UPDATE OF "status" ON "public"."orders" FOR EACH ROW WHEN ((("new"."status" = 'paid'::"text") AND ("old"."status" IS DISTINCT FROM 'paid'::"text"))) EXECUTE FUNCTION "public"."orders_pago_cpf_guard"();



CREATE OR REPLACE TRIGGER "orders_um_pendente" BEFORE INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."orders_um_pendente"();



CREATE OR REPLACE TRIGGER "platform_settings_reauth_dinheiro_del" BEFORE DELETE ON "public"."platform_settings" FOR EACH ROW WHEN (("old"."key" = 'fees'::"text")) EXECUTE FUNCTION "public"."gf_reauth_dinheiro"();



CREATE OR REPLACE TRIGGER "platform_settings_reauth_dinheiro_ins" BEFORE INSERT ON "public"."platform_settings" FOR EACH ROW WHEN (("new"."key" = 'fees'::"text")) EXECUTE FUNCTION "public"."gf_reauth_dinheiro"();



CREATE OR REPLACE TRIGGER "platform_settings_reauth_dinheiro_upd" BEFORE UPDATE ON "public"."platform_settings" FOR EACH ROW WHEN ((("old"."key" = 'fees'::"text") OR ("new"."key" = 'fees'::"text"))) EXECUTE FUNCTION "public"."gf_reauth_dinheiro"();



CREATE OR REPLACE TRIGGER "platform_settings_updated_by" BEFORE INSERT OR UPDATE ON "public"."platform_settings" FOR EACH ROW EXECUTE FUNCTION "public"."platform_settings_updated_by"();



CREATE OR REPLACE TRIGGER "producer_profiles_updated_at" BEFORE UPDATE ON "public"."producer_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "seating_maps_sem_cpf" BEFORE INSERT OR UPDATE OF "environments", "is_active", "event_id" ON "public"."seating_maps" FOR EACH ROW WHEN ("new"."is_active") EXECUTE FUNCTION "public"."seating_maps_sem_cpf"();



CREATE OR REPLACE TRIGGER "seating_maps_updated_at" BEFORE UPDATE ON "public"."seating_maps" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "staff_profiles_reauth_dinheiro" BEFORE UPDATE ON "public"."staff_profiles" FOR EACH ROW WHEN (((NOT ("old"."invite_id" IS DISTINCT FROM "new"."invite_id")) AND (("old"."banco_enc" IS DISTINCT FROM "new"."banco_enc") OR ("old"."agencia_enc" IS DISTINCT FROM "new"."agencia_enc") OR ("old"."conta_enc" IS DISTINCT FROM "new"."conta_enc") OR ("old"."pix_tipo_enc" IS DISTINCT FROM "new"."pix_tipo_enc") OR ("old"."pix_chave_enc" IS DISTINCT FROM "new"."pix_chave_enc")))) EXECUTE FUNCTION "public"."gf_reauth_dinheiro"();



CREATE OR REPLACE TRIGGER "staff_profiles_registra_pagamento" AFTER UPDATE ON "public"."staff_profiles" FOR EACH ROW WHEN ((("old"."pix_tipo_enc" IS DISTINCT FROM "new"."pix_tipo_enc") OR ("old"."pix_chave_enc" IS DISTINCT FROM "new"."pix_chave_enc") OR ("old"."banco_enc" IS DISTINCT FROM "new"."banco_enc") OR ("old"."agencia_enc" IS DISTINCT FROM "new"."agencia_enc") OR ("old"."conta_enc" IS DISTINCT FROM "new"."conta_enc"))) EXECUTE FUNCTION "public"."staff_profiles_registra_pagamento"();



CREATE OR REPLACE TRIGGER "staff_profiles_updated_at" BEFORE UPDATE ON "public"."staff_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."staff_profiles_updated_at"();



CREATE OR REPLACE TRIGGER "ticket_types_cpf_sem_mapa" BEFORE INSERT OR UPDATE OF "max_por_cpf" ON "public"."ticket_types" FOR EACH ROW WHEN (("new"."max_por_cpf" IS NOT NULL)) EXECUTE FUNCTION "public"."ticket_types_cpf_sem_mapa"();



CREATE OR REPLACE TRIGGER "ticket_types_sem_meia_mesa" BEFORE INSERT OR UPDATE OF "type", "permite_meia" ON "public"."ticket_types" FOR EACH ROW EXECUTE FUNCTION "public"."ticket_types_sem_meia_mesa"();



CREATE OR REPLACE TRIGGER "tr_crm_leads_updated_at" BEFORE UPDATE ON "public"."crm_leads" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "tr_events_updated_at" BEFORE UPDATE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "tr_orders_updated_at" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "tr_payments_updated_at" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "tr_producer_profiles_updated_at" BEFORE UPDATE ON "public"."producer_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "tr_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "tr_ticket_types_updated_at" BEFORE UPDATE ON "public"."ticket_types" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "withdrawals_quem_processou" BEFORE INSERT OR UPDATE ON "public"."withdrawals" FOR EACH ROW EXECUTE FUNCTION "public"."withdrawals_quem_processou"();



CREATE OR REPLACE TRIGGER "withdrawals_reauth_dinheiro" BEFORE UPDATE ON "public"."withdrawals" FOR EACH ROW WHEN (("old"."status" IS DISTINCT FROM "new"."status")) EXECUTE FUNCTION "public"."gf_reauth_dinheiro"();



ALTER TABLE ONLY "public"."admin_invites"
    ADD CONSTRAINT "admin_invites_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."admin_invites"
    ADD CONSTRAINT "admin_invites_used_by_fkey" FOREIGN KEY ("used_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."affiliate_coupon_requests"
    ADD CONSTRAINT "affiliate_coupon_requests_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "public"."platform_affiliates"("id");



ALTER TABLE ONLY "public"."affiliate_coupon_requests"
    ADD CONSTRAINT "affiliate_coupon_requests_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id");



ALTER TABLE ONLY "public"."affiliate_coupon_requests"
    ADD CONSTRAINT "affiliate_coupon_requests_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."affiliate_links"
    ADD CONSTRAINT "affiliate_links_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "public"."platform_affiliates"("id");



ALTER TABLE ONLY "public"."affiliates"
    ADD CONSTRAINT "affiliates_affiliate_user_id_fkey" FOREIGN KEY ("affiliate_user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."affiliates"
    ADD CONSTRAINT "affiliates_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id");



ALTER TABLE ONLY "public"."affiliates"
    ADD CONSTRAINT "affiliates_producer_id_fkey" FOREIGN KEY ("producer_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."afiliado_tentativas"
    ADD CONSTRAINT "afiliado_tentativas_producer_id_fkey" FOREIGN KEY ("producer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_credit_grants"
    ADD CONSTRAINT "ai_credit_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_usage"
    ADD CONSTRAINT "ai_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."certificates"
    ADD CONSTRAINT "certificates_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id");



ALTER TABLE ONLY "public"."chat_contacts"
    ADD CONSTRAINT "chat_contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chat_departments"
    ADD CONSTRAINT "chat_departments_default_assignee_fkey" FOREIGN KEY ("default_assignee") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chat_topics"
    ADD CONSTRAINT "chat_topics_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."chat_departments"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."check_ins"
    ADD CONSTRAINT "check_ins_checked_in_by_fkey" FOREIGN KEY ("checked_in_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."check_ins"
    ADD CONSTRAINT "check_ins_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id");



ALTER TABLE ONLY "public"."check_ins"
    ADD CONSTRAINT "check_ins_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id");



ALTER TABLE ONLY "public"."check_ins"
    ADD CONSTRAINT "check_ins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."collective_tables"
    ADD CONSTRAINT "collective_tables_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collective_tables"
    ADD CONSTRAINT "collective_tables_ticket_type_id_fkey" FOREIGN KEY ("ticket_type_id") REFERENCES "public"."ticket_types"("id");



ALTER TABLE ONLY "public"."conversation_messages"
    ADD CONSTRAINT "conversation_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_messages"
    ADD CONSTRAINT "conversation_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."chat_contacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."chat_departments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_producer_id_fkey" FOREIGN KEY ("producer_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."chat_topics"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "public"."platform_affiliates"("id");



ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id");



ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_producer_id_fkey" FOREIGN KEY ("producer_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."crm_interactions"
    ADD CONSTRAINT "crm_interactions_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crm_leads"
    ADD CONSTRAINT "crm_leads_producer_id_fkey" FOREIGN KEY ("producer_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."crm_leads"
    ADD CONSTRAINT "crm_leads_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."pipeline_stages"("id");



ALTER TABLE ONLY "public"."crm_tasks"
    ADD CONSTRAINT "crm_tasks_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."email_logs"
    ADD CONSTRAINT "email_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_banners"
    ADD CONSTRAINT "event_banners_producer_id_fkey" FOREIGN KEY ("producer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_budget_boxes"
    ADD CONSTRAINT "event_budget_boxes_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_budget_boxes"
    ADD CONSTRAINT "event_budget_boxes_producer_id_fkey" FOREIGN KEY ("producer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_photos"
    ADD CONSTRAINT "event_photos_producer_id_fkey" FOREIGN KEY ("producer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_reviews"
    ADD CONSTRAINT "event_reviews_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id");



ALTER TABLE ONLY "public"."event_reviews"
    ADD CONSTRAINT "event_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."event_surveys"
    ADD CONSTRAINT "event_surveys_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_timeline_items"
    ADD CONSTRAINT "event_timeline_items_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_timeline_items"
    ADD CONSTRAINT "event_timeline_items_producer_id_fkey" FOREIGN KEY ("producer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_zones"
    ADD CONSTRAINT "event_zones_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."evento_aceites"
    ADD CONSTRAINT "evento_aceites_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."evento_privado"
    ADD CONSTRAINT "evento_privado_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_producer_id_fkey" FOREIGN KEY ("producer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favoritos"
    ADD CONSTRAINT "favoritos_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favoritos"
    ADD CONSTRAINT "favoritos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "fk_orders_coupon" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id");



ALTER TABLE ONLY "public"."interest_lists"
    ADD CONSTRAINT "interest_lists_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id");



ALTER TABLE ONLY "public"."interest_lists"
    ADD CONSTRAINT "interest_lists_ticket_type_id_fkey" FOREIGN KEY ("ticket_type_id") REFERENCES "public"."ticket_types"("id");



ALTER TABLE ONLY "public"."interest_lists"
    ADD CONSTRAINT "interest_lists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."issued_certificates"
    ADD CONSTRAINT "issued_certificates_certificate_id_fkey" FOREIGN KEY ("certificate_id") REFERENCES "public"."certificates"("id");



ALTER TABLE ONLY "public"."issued_certificates"
    ADD CONSTRAINT "issued_certificates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."kb_articles"
    ADD CONSTRAINT "kb_articles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."kb_articles"
    ADD CONSTRAINT "kb_articles_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."chat_departments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."kb_articles"
    ADD CONSTRAINT "kb_articles_source_conversation_id_fkey" FOREIGN KEY ("source_conversation_id") REFERENCES "public"."conversations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_producer_id_fkey" FOREIGN KEY ("producer_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."menu_order_items"
    ADD CONSTRAINT "menu_order_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id");



ALTER TABLE ONLY "public"."menu_order_items"
    ADD CONSTRAINT "menu_order_items_menu_order_id_fkey" FOREIGN KEY ("menu_order_id") REFERENCES "public"."menu_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menu_orders"
    ADD CONSTRAINT "menu_orders_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id");



ALTER TABLE ONLY "public"."menu_orders"
    ADD CONSTRAINT "menu_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."mesa_avisos"
    ADD CONSTRAINT "mesa_avisos_evento_fkey" FOREIGN KEY ("evento") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mesa_avisos"
    ADD CONSTRAINT "mesa_avisos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mesa_consentimentos"
    ADD CONSTRAINT "mesa_consentimentos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mesa_denuncias"
    ADD CONSTRAINT "mesa_denuncias_denunciado_fkey" FOREIGN KEY ("denunciado") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mesa_denuncias"
    ADD CONSTRAINT "mesa_denuncias_denunciante_fkey" FOREIGN KEY ("denunciante") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mesa_denuncias"
    ADD CONSTRAINT "mesa_denuncias_evento_fkey" FOREIGN KEY ("evento") REFERENCES "public"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mesa_denuncias"
    ADD CONSTRAINT "mesa_denuncias_liberada_por_fkey" FOREIGN KEY ("liberada_por") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mesa_denuncias"
    ADD CONSTRAINT "mesa_denuncias_status_mudado_por_fkey" FOREIGN KEY ("status_mudado_por") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mesa_moderacoes"
    ADD CONSTRAINT "mesa_moderacoes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mesa_passagens"
    ADD CONSTRAINT "mesa_passagens_evento_fkey" FOREIGN KEY ("evento") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mesa_passagens"
    ADD CONSTRAINT "mesa_passagens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mesa_travas"
    ADD CONSTRAINT "mesa_travas_denuncia_id_fkey" FOREIGN KEY ("denuncia_id") REFERENCES "public"."mesa_denuncias"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mesa_travas"
    ADD CONSTRAINT "mesa_travas_destravada_por_fkey" FOREIGN KEY ("destravada_por") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mesa_travas"
    ADD CONSTRAINT "mesa_travas_evento_fkey" FOREIGN KEY ("evento") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mesa_travas"
    ADD CONSTRAINT "mesa_travas_por_fkey" FOREIGN KEY ("por") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mesa_travas"
    ADD CONSTRAINT "mesa_travas_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mesa_travas"
    ADD CONSTRAINT "mesa_travas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."onboarding_logs"
    ADD CONSTRAINT "onboarding_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_ticket_type_id_fkey" FOREIGN KEY ("ticket_type_id") REFERENCES "public"."ticket_types"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."partners"
    ADD CONSTRAINT "partners_producer_id_fkey" FOREIGN KEY ("producer_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."pedido_assentos"
    ADD CONSTRAINT "pedido_assentos_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pedido_assentos"
    ADD CONSTRAINT "pedido_assentos_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pedido_assentos"
    ADD CONSTRAINT "pedido_assentos_ticket_type_id_fkey" FOREIGN KEY ("ticket_type_id") REFERENCES "public"."ticket_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."piggy_transactions"
    ADD CONSTRAINT "piggy_transactions_box_id_fkey" FOREIGN KEY ("box_id") REFERENCES "public"."event_budget_boxes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pipeline_stages"
    ADD CONSTRAINT "pipeline_stages_producer_id_fkey" FOREIGN KEY ("producer_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."platform_affiliate_producers"
    ADD CONSTRAINT "platform_affiliate_producers_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "public"."platform_affiliates"("id");



ALTER TABLE ONLY "public"."platform_affiliate_producers"
    ADD CONSTRAINT "platform_affiliate_producers_affiliate_link_id_fkey" FOREIGN KEY ("affiliate_link_id") REFERENCES "public"."affiliate_links"("id");



ALTER TABLE ONLY "public"."platform_affiliate_producers"
    ADD CONSTRAINT "platform_affiliate_producers_ended_by_fkey" FOREIGN KEY ("ended_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."platform_affiliate_producers"
    ADD CONSTRAINT "platform_affiliate_producers_linked_by_fkey" FOREIGN KEY ("linked_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."platform_affiliate_producers"
    ADD CONSTRAINT "platform_affiliate_producers_producer_id_fkey" FOREIGN KEY ("producer_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."platform_affiliates"
    ADD CONSTRAINT "platform_affiliates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."platform_affiliates"
    ADD CONSTRAINT "platform_affiliates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."policy_notices"
    ADD CONSTRAINT "policy_notices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."producer_profiles"
    ADD CONSTRAINT "producer_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."producer_public"
    ADD CONSTRAINT "producer_public_producer_id_fkey" FOREIGN KEY ("producer_id") REFERENCES "public"."producer_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."producer_subscriptions"
    ADD CONSTRAINT "producer_subscriptions_producer_id_fkey" FOREIGN KEY ("producer_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."producer_tasks"
    ADD CONSTRAINT "producer_tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."producer_tasks"
    ADD CONSTRAINT "producer_tasks_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."producer_tasks"
    ADD CONSTRAINT "producer_tasks_producer_id_fkey" FOREIGN KEY ("producer_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."revenue_advances"
    ADD CONSTRAINT "revenue_advances_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."revenue_advances"
    ADD CONSTRAINT "revenue_advances_producer_id_fkey" FOREIGN KEY ("producer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."seating_maps"
    ADD CONSTRAINT "seating_maps_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_profiles"
    ADD CONSTRAINT "staff_profiles_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "public"."admin_invites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_profiles"
    ADD CONSTRAINT "staff_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."support_messages"
    ADD CONSTRAINT "support_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."support_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."support_sessions"
    ADD CONSTRAINT "support_sessions_assigned_agent_id_fkey" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."support_sessions"
    ADD CONSTRAINT "support_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."table_members"
    ADD CONSTRAINT "table_members_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."collective_tables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_members"
    ADD CONSTRAINT "table_members_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_members"
    ADD CONSTRAINT "table_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_producer_id_fkey" FOREIGN KEY ("producer_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."tentativas_reserva"
    ADD CONSTRAINT "tentativas_reserva_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ticket_types"
    ADD CONSTRAINT "ticket_types_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_checked_in_by_fkey" FOREIGN KEY ("checked_in_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_ticket_type_id_fkey" FOREIGN KEY ("ticket_type_id") REFERENCES "public"."ticket_types"("id");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_transferred_to_fkey" FOREIGN KEY ("transferred_to") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_producer_id_fkey" FOREIGN KEY ("producer_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."user_activities"
    ADD CONSTRAINT "user_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_course_progress"
    ADD CONSTRAINT "user_course_progress_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."academy_courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_course_progress"
    ADD CONSTRAINT "user_course_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_custom_features"
    ADD CONSTRAINT "user_custom_features_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles_ext"
    ADD CONSTRAINT "user_profiles_ext_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."webhook_events"
    ADD CONSTRAINT "webhook_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."withdrawals"
    ADD CONSTRAINT "withdrawals_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."withdrawals"
    ADD CONSTRAINT "withdrawals_producer_id_fkey" FOREIGN KEY ("producer_id") REFERENCES "public"."profiles"("id");



CREATE POLICY "Admin gerencia afiliados evokaa" ON "public"."platform_affiliates" TO "authenticated" USING (( SELECT "public"."gf_admin_can"('manage_affiliates'::"text") AS "gf_admin_can")) WITH CHECK (( SELECT "public"."gf_admin_can"('manage_affiliates'::"text") AS "gf_admin_can"));



CREATE POLICY "Admin gerencia coupons da plataforma" ON "public"."coupons" TO "authenticated" USING ((("producer_id" IS NULL) AND ( SELECT "public"."gf_admin_can"('manage_coupons'::"text") AS "gf_admin_can"))) WITH CHECK ((("producer_id" IS NULL) AND ( SELECT "public"."gf_admin_can"('manage_coupons'::"text") AS "gf_admin_can")));



CREATE POLICY "Admin gerencia indicados de afiliados" ON "public"."platform_affiliate_producers" TO "authenticated" USING (( SELECT "public"."gf_admin_can"('manage_affiliates'::"text") AS "gf_admin_can")) WITH CHECK (( SELECT "public"."gf_admin_can"('manage_affiliates'::"text") AS "gf_admin_can"));



CREATE POLICY "Admin gerencia links de afiliado" ON "public"."affiliate_links" TO "authenticated" USING (( SELECT "public"."gf_admin_can"('manage_affiliates'::"text") AS "gf_admin_can")) WITH CHECK (( SELECT "public"."gf_admin_can"('manage_affiliates'::"text") AS "gf_admin_can"));



CREATE POLICY "Admin gerencia pedidos de cupom" ON "public"."affiliate_coupon_requests" TO "authenticated" USING (( SELECT "public"."gf_admin_can"('manage_coupons'::"text") AS "gf_admin_can")) WITH CHECK (( SELECT "public"."gf_admin_can"('manage_coupons'::"text") AS "gf_admin_can"));



CREATE POLICY "Admin le coupons" ON "public"."coupons" FOR SELECT TO "authenticated" USING (( SELECT "public"."gf_admin_can"('manage_coupons'::"text") AS "gf_admin_can"));



CREATE POLICY "Afiliado ativo cria link" ON "public"."affiliate_links" FOR INSERT TO "authenticated" WITH CHECK ((("affiliate_id" IN ( SELECT "platform_affiliates"."id"
   FROM "public"."platform_affiliates"
  WHERE (("platform_affiliates"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("platform_affiliates"."status" = 'active'::"text")))) AND ("clicks" = 0)));



CREATE POLICY "Afiliado ativo cria pedido" ON "public"."affiliate_coupon_requests" FOR INSERT TO "authenticated" WITH CHECK ((("affiliate_id" IN ( SELECT "platform_affiliates"."id"
   FROM "public"."platform_affiliates"
  WHERE (("platform_affiliates"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("platform_affiliates"."status" = 'active'::"text")))) AND ("status" = 'pending'::"text") AND ("coupon_id" IS NULL) AND ("decided_at" IS NULL) AND ("decided_by" IS NULL) AND ("admin_notes" IS NULL)));



CREATE POLICY "Afiliado atualiza os proprios links" ON "public"."affiliate_links" FOR UPDATE TO "authenticated" USING (("affiliate_id" IN ( SELECT "platform_affiliates"."id"
   FROM "public"."platform_affiliates"
  WHERE ("platform_affiliates"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) WITH CHECK (("affiliate_id" IN ( SELECT "platform_affiliates"."id"
   FROM "public"."platform_affiliates"
  WHERE ("platform_affiliates"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Afiliado le o proprio cadastro" ON "public"."platform_affiliates" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Afiliado le os proprios cupons" ON "public"."coupons" FOR SELECT TO "authenticated" USING (("affiliate_id" IN ( SELECT "platform_affiliates"."id"
   FROM "public"."platform_affiliates"
  WHERE ("platform_affiliates"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Afiliado le os proprios indicados" ON "public"."platform_affiliate_producers" FOR SELECT TO "authenticated" USING (("affiliate_id" IN ( SELECT "platform_affiliates"."id"
   FROM "public"."platform_affiliates"
  WHERE ("platform_affiliates"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Afiliado le os proprios links" ON "public"."affiliate_links" FOR SELECT TO "authenticated" USING (("affiliate_id" IN ( SELECT "platform_affiliates"."id"
   FROM "public"."platform_affiliates"
  WHERE ("platform_affiliates"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Afiliado le os proprios pedidos" ON "public"."affiliate_coupon_requests" FOR SELECT TO "authenticated" USING (("affiliate_id" IN ( SELECT "platform_affiliates"."id"
   FROM "public"."platform_affiliates"
  WHERE ("platform_affiliates"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Anyone can read active seating maps" ON "public"."seating_maps" FOR SELECT USING ((("is_active" = true) AND ("public"."evento_acesso"("event_id") = ANY (ARRAY['aberto'::"text", 'link'::"text"]))));



CREATE POLICY "Apenas admins gerenciam subscribers" ON "public"."newsletter_subscribers" TO "authenticated" USING (( SELECT "public"."gf_admin_can"('manage_newsletter'::"text") AS "gf_admin_can")) WITH CHECK (( SELECT "public"."gf_admin_can"('manage_newsletter'::"text") AS "gf_admin_can"));



CREATE POLICY "Apenas admins leem e gerenciam campanhas" ON "public"."newsletters" TO "authenticated" USING (( SELECT "public"."gf_admin_can"('manage_newsletter'::"text") AS "gf_admin_can")) WITH CHECK (( SELECT "public"."gf_admin_can"('manage_newsletter'::"text") AS "gf_admin_can"));



CREATE POLICY "Benefícios estaduais são públicos" ON "public"."beneficios_uf" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Cursos publicos" ON "public"."academy_courses" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Eventos com senha ou de convidados liberados" ON "public"."events" FOR SELECT USING ((("visibility" = ANY (ARRAY['password'::"text", 'private'::"text"])) AND ("public"."evento_acesso"("id") = 'aberto'::"text")));



CREATE POLICY "Eventos públicos ou do produtor" ON "public"."events" FOR SELECT USING (((("status" = 'published'::"text") AND ("approval_status" = 'approved'::"text") AND ("visibility" = 'public'::"text")) OR (( SELECT "auth"."uid"() AS "uid") = "producer_id")));



CREATE POLICY "Ingressos à venda de evento aprovado" ON "public"."ticket_types" FOR SELECT TO "authenticated", "anon" USING (("is_active" AND ("public"."evento_acesso"("event_id") = 'aberto'::"text")));



CREATE POLICY "Producers can manage own seating maps" ON "public"."seating_maps" USING ((EXISTS ( SELECT 1
   FROM "public"."events"
  WHERE (("events"."id" = "seating_maps"."event_id") AND ("events"."producer_id" = "auth"."uid"())))));



CREATE POLICY "Produtor gerencia banners" ON "public"."event_banners" TO "authenticated" USING (("producer_id" = "auth"."uid"())) WITH CHECK (("producer_id" = "auth"."uid"()));



CREATE POLICY "Produtor gerencia budget boxes" ON "public"."event_budget_boxes" TO "authenticated" USING (("producer_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ((("producer_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("event_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_budget_boxes"."event_id") AND ("e"."producer_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "Produtor gerencia certificates" ON "public"."certificates" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "certificates"."event_id") AND ("e"."producer_id" = "auth"."uid"())))));



CREATE POLICY "Produtor gerencia coupons" ON "public"."coupons" TO "authenticated" USING (("producer_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ((("producer_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("event_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "coupons"."event_id") AND ("e"."producer_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "Produtor gerencia eventos" ON "public"."events" TO "authenticated" USING (("producer_id" = "auth"."uid"())) WITH CHECK (("producer_id" = "auth"."uid"()));



CREATE POLICY "Produtor gerencia fotos" ON "public"."event_photos" TO "authenticated" USING (("producer_id" = "auth"."uid"())) WITH CHECK (("producer_id" = "auth"."uid"()));



CREATE POLICY "Produtor gerencia partners" ON "public"."partners" TO "authenticated" USING (("producer_id" = "auth"."uid"())) WITH CHECK (("producer_id" = "auth"."uid"()));



CREATE POLICY "Produtor gerencia tasks" ON "public"."producer_tasks" TO "authenticated" USING (("producer_id" = "auth"."uid"())) WITH CHECK ((("producer_id" = "auth"."uid"()) AND (("event_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "producer_tasks"."event_id") AND ("e"."producer_id" = "auth"."uid"())))))));



CREATE POLICY "Produtor gerencia timeline" ON "public"."event_timeline_items" TO "authenticated" USING (("producer_id" = "auth"."uid"())) WITH CHECK (("producer_id" = "auth"."uid"()));



CREATE POLICY "Produtor gerencia zones" ON "public"."event_zones" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_zones"."event_id") AND ("e"."producer_id" = "auth"."uid"())))));



CREATE POLICY "Produtor ve surveys do evento" ON "public"."event_surveys" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_surveys"."event_id") AND ("e"."producer_id" = "auth"."uid"())))));



CREATE POLICY "Produtor ve transactions" ON "public"."piggy_transactions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."event_budget_boxes" "b"
  WHERE (("b"."id" = "piggy_transactions"."box_id") AND ("b"."producer_id" = "auth"."uid"())))));



CREATE POLICY "Produtores gerenciam ingressos dos próprios eventos" ON "public"."ticket_types" USING ((EXISTS ( SELECT 1
   FROM "public"."events"
  WHERE (("events"."id" = "ticket_types"."event_id") AND ("events"."producer_id" = "auth"."uid"())))));



CREATE POLICY "Produtores gerenciam próprio perfil" ON "public"."producer_profiles" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Produtores gerenciam próprios eventos" ON "public"."events" USING (("auth"."uid"() = "producer_id")) WITH CHECK (("auth"."uid"() = "producer_id"));



CREATE POLICY "Produtores leem compras dos próprios eventos" ON "public"."orders" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."events"
  WHERE (("events"."id" = "orders"."event_id") AND ("events"."producer_id" = "auth"."uid"())))));



CREATE POLICY "Produtores leem ingressos dos próprios eventos" ON "public"."tickets" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."events"
  WHERE (("events"."id" = "tickets"."event_id") AND ("events"."producer_id" = "auth"."uid"())))));



CREATE POLICY "Produtores leem itens de compras dos seus eventos" ON "public"."order_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."orders"
  WHERE (("orders"."id" = "order_items"."order_id") AND (EXISTS ( SELECT 1
           FROM "public"."events"
          WHERE (("events"."id" = "orders"."event_id") AND ("events"."producer_id" = "auth"."uid"()))))))));



CREATE POLICY "Produtores veem pagamentos dos seus eventos" ON "public"."payments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."orders"
  WHERE (("orders"."id" = "payments"."order_id") AND (EXISTS ( SELECT 1
           FROM "public"."events"
          WHERE (("events"."id" = "orders"."event_id") AND ("events"."producer_id" = "auth"."uid"()))))))));



CREATE POLICY "Quem tem ingresso lê o evento" ON "public"."events" FOR SELECT TO "authenticated" USING ("public"."tem_ingresso"("id"));



CREATE POLICY "Quem tem ingresso lê o tipo" ON "public"."ticket_types" FOR SELECT TO "authenticated" USING (("id" IN ( SELECT "t"."ticket_type_id"
   FROM "public"."tickets" "t"
  WHERE ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Usuario ve proprio progresso" ON "public"."user_course_progress" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Usuários leem próprias compras" ON "public"."orders" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Usuários leem próprios itens de compras" ON "public"."order_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."orders"
  WHERE (("orders"."id" = "order_items"."order_id") AND ("orders"."user_id" = "auth"."uid"())))));



CREATE POLICY "Usuários leem seus ingressos" ON "public"."tickets" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Usuários modificam próprio perfil" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Usuários veem próprios pagamentos" ON "public"."payments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."orders"
  WHERE (("orders"."id" = "payments"."order_id") AND ("orders"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."academy_courses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."access_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."affiliate_coupon_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."affiliate_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."affiliates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."afiliado_tentativas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_credit_grants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_credit_grants_admin_insert" ON "public"."ai_credit_grants" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."gf_admin_can"('manage_settings'::"text") AS "gf_admin_can") AND ("created_by" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "ai_credit_grants_select_own_or_admin" ON "public"."ai_credit_grants" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."gf_admin_can"('manage_settings'::"text") AS "gf_admin_can")));



ALTER TABLE "public"."ai_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_settings_admin_select" ON "public"."ai_settings" FOR SELECT TO "authenticated" USING (( SELECT "public"."gf_admin_can"('manage_settings'::"text") AS "gf_admin_can"));



CREATE POLICY "ai_settings_admin_update" ON "public"."ai_settings" FOR UPDATE TO "authenticated" USING (( SELECT "public"."gf_admin_can"('manage_settings'::"text") AS "gf_admin_can")) WITH CHECK (( SELECT "public"."gf_admin_can"('manage_settings'::"text") AS "gf_admin_can"));



ALTER TABLE "public"."ai_usage" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_usage_select_own_or_admin" ON "public"."ai_usage" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."gf_admin_can"('manage_settings'::"text") AS "gf_admin_can")));



ALTER TABLE "public"."beneficios_uf" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."certificates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_contacts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_contacts_select" ON "public"."chat_contacts" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."gf_admin_can"('manage_support'::"text") AS "gf_admin_can")));



ALTER TABLE "public"."chat_departments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_departments_select" ON "public"."chat_departments" FOR SELECT TO "authenticated" USING (("active" OR ( SELECT "public"."gf_admin_can"('manage_support'::"text") AS "gf_admin_can")));



ALTER TABLE "public"."chat_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_settings_select" ON "public"."chat_settings" FOR SELECT TO "authenticated" USING (( SELECT "public"."gf_admin_can"('manage_support'::"text") AS "gf_admin_can"));



ALTER TABLE "public"."chat_topics" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_topics_select" ON "public"."chat_topics" FOR SELECT TO "authenticated" USING (("active" OR ( SELECT "public"."gf_admin_can"('manage_support'::"text") AS "gf_admin_can")));



ALTER TABLE "public"."check_ins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."collective_tables" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_rate_limit_hits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversation_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversation_messages_select" ON "public"."conversation_messages" FOR SELECT TO "authenticated" USING (
CASE "public"."chat_role"("conversation_id")
    WHEN 'agent'::"text" THEN true
    WHEN 'producer'::"text" THEN ((NOT "is_internal") OR ("sender_role" = 'producer'::"text"))
    WHEN 'customer'::"text" THEN (NOT "is_internal")
    ELSE false
END);



ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversations_select" ON "public"."conversations" FOR SELECT TO "authenticated" USING (("public"."chat_role"("id") IS NOT NULL));



ALTER TABLE "public"."coupons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crm_interactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crm_leads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crm_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_banners" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_budget_boxes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_photos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_surveys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_timeline_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_zones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."evento_aceites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "evento_aceites_select" ON "public"."evento_aceites" FOR SELECT TO "authenticated" USING ((("producer_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."gf_admin_can"('manage_events'::"text") AS "gf_admin_can")));



ALTER TABLE "public"."evento_privado" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "evento_privado_select" ON "public"."evento_privado" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "evento_privado"."event_id") AND ("e"."producer_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR ( SELECT "public"."gf_admin_can"('manage_events'::"text") AS "gf_admin_can") OR (EXISTS ( SELECT 1
   FROM "public"."tickets" "t"
  WHERE (("t"."event_id" = "evento_privado"."event_id") AND ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("t"."status" = ANY (ARRAY['active'::"text", 'used'::"text"])))))));



CREATE POLICY "evento_privado_write" ON "public"."evento_privado" TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "evento_privado"."event_id") AND ("e"."producer_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR ( SELECT "public"."gf_admin_can"('manage_events'::"text") AS "gf_admin_can"))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "evento_privado"."event_id") AND ("e"."producer_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR ( SELECT "public"."gf_admin_can"('manage_events'::"text") AS "gf_admin_can")));



ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."favoritos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "favoritos_delete" ON "public"."favoritos" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "favoritos_insert" ON "public"."favoritos" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "favoritos"."event_id") AND ("e"."status" = 'published'::"text") AND ("e"."approval_status" = 'approved'::"text")))) AND ("public"."evento_acesso"("event_id") = 'aberto'::"text")));



CREATE POLICY "favoritos_select" ON "public"."favoritos" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."feedback" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gf_academy_admin_write" ON "public"."academy_courses" TO "authenticated" USING (( SELECT "public"."gf_admin_can"('super_admin'::"text") AS "gf_admin_can")) WITH CHECK (( SELECT "public"."gf_admin_can"('super_admin'::"text") AS "gf_admin_can"));



CREATE POLICY "gf_academy_read" ON "public"."academy_courses" FOR SELECT USING (true);



CREATE POLICY "gf_affiliates_afiliado_select" ON "public"."affiliates" FOR SELECT TO "authenticated" USING (("affiliate_user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "gf_affiliates_dono_select" ON "public"."affiliates" FOR SELECT TO "authenticated" USING (("producer_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "gf_affiliates_dono_update" ON "public"."affiliates" FOR UPDATE TO "authenticated" USING (("producer_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("producer_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "gf_budget_boxes_all" ON "public"."event_budget_boxes" TO "authenticated" USING (( SELECT "public"."gf_admin_can"('super_admin'::"text") AS "gf_admin_can")) WITH CHECK (( SELECT "public"."gf_admin_can"('super_admin'::"text") AS "gf_admin_can"));



CREATE POLICY "gf_budget_boxes_insert_saldo_zero" ON "public"."event_budget_boxes" AS RESTRICTIVE FOR INSERT TO "authenticated" WITH CHECK (("saved" = (0)::numeric));



CREATE POLICY "gf_check_ins_admin_select" ON "public"."check_ins" FOR SELECT TO "authenticated" USING (( SELECT "public"."gf_admin_can"('manage_tickets'::"text") AS "gf_admin_can"));



CREATE POLICY "gf_contact_messages_admin_all" ON "public"."contact_messages" TO "authenticated" USING (( SELECT "public"."gf_admin_can"('manage_feedback'::"text") AS "gf_admin_can")) WITH CHECK (( SELECT "public"."gf_admin_can"('manage_feedback'::"text") AS "gf_admin_can"));



CREATE POLICY "gf_course_progress_all" ON "public"."user_course_progress" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "gf_crm_interactions_dono" ON "public"."crm_interactions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."crm_leads" "l"
  WHERE (("l"."id" = "crm_interactions"."lead_id") AND ("l"."producer_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."crm_leads" "l"
  WHERE (("l"."id" = "crm_interactions"."lead_id") AND ("l"."producer_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "gf_crm_leads_dono" ON "public"."crm_leads" TO "authenticated" USING (("producer_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ((("producer_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("stage_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."pipeline_stages" "s"
  WHERE (("s"."id" = "crm_leads"."stage_id") AND ("s"."producer_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "gf_custom_features_admin_write" ON "public"."user_custom_features" TO "authenticated" USING (( SELECT "public"."gf_admin_can"('manage_users'::"text") AS "gf_admin_can")) WITH CHECK (( SELECT "public"."gf_admin_can"('manage_users'::"text") AS "gf_admin_can"));



CREATE POLICY "gf_custom_features_read" ON "public"."user_custom_features" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."gf_admin_can"('manage_users'::"text") AS "gf_admin_can")));



CREATE POLICY "gf_customers_owner" ON "public"."customers" TO "authenticated" USING ((( SELECT "public"."gf_admin_can"('super_admin'::"text") AS "gf_admin_can") OR ("event_id" IN ( SELECT "e"."id"
   FROM "public"."events" "e"
  WHERE ("e"."producer_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((( SELECT "public"."gf_admin_can"('super_admin'::"text") AS "gf_admin_can") OR ("event_id" IN ( SELECT "e"."id"
   FROM "public"."events" "e"
  WHERE ("e"."producer_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "gf_event_banners_all" ON "public"."event_banners" TO "authenticated" USING ((("producer_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."gf_admin_can"('super_admin'::"text") AS "gf_admin_can"))) WITH CHECK ((("producer_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."gf_admin_can"('super_admin'::"text") AS "gf_admin_can")));



CREATE POLICY "gf_event_photos_all" ON "public"."event_photos" TO "authenticated" USING ((("producer_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."gf_admin_can"('super_admin'::"text") AS "gf_admin_can"))) WITH CHECK ((("producer_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."gf_admin_can"('super_admin'::"text") AS "gf_admin_can")));



CREATE POLICY "gf_event_surveys_insert" ON "public"."event_surveys" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."tickets" "t"
  WHERE (("t"."event_id" = "event_surveys"."event_id") AND ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "gf_event_surveys_owner" ON "public"."event_surveys" TO "authenticated" USING ((( SELECT "public"."gf_admin_can"('super_admin'::"text") AS "gf_admin_can") OR ("event_id" IN ( SELECT "e"."id"
   FROM "public"."events" "e"
  WHERE ("e"."producer_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((( SELECT "public"."gf_admin_can"('super_admin'::"text") AS "gf_admin_can") OR ("event_id" IN ( SELECT "e"."id"
   FROM "public"."events" "e"
  WHERE ("e"."producer_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "gf_event_timeline_all" ON "public"."event_timeline_items" TO "authenticated" USING ((("producer_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."gf_admin_can"('super_admin'::"text") AS "gf_admin_can"))) WITH CHECK ((("producer_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."gf_admin_can"('super_admin'::"text") AS "gf_admin_can")));



CREATE POLICY "gf_event_zones_owner" ON "public"."event_zones" TO "authenticated" USING ((( SELECT "public"."gf_admin_can"('super_admin'::"text") AS "gf_admin_can") OR ("event_id" IN ( SELECT "e"."id"
   FROM "public"."events" "e"
  WHERE ("e"."producer_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((( SELECT "public"."gf_admin_can"('super_admin'::"text") AS "gf_admin_can") OR ("event_id" IN ( SELECT "e"."id"
   FROM "public"."events" "e"
  WHERE ("e"."producer_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "gf_events_admin_select" ON "public"."events" FOR SELECT TO "authenticated" USING (( SELECT "public"."gf_admin_can_any"(ARRAY['manage_events'::"text", 'manage_users'::"text", 'manage_finance'::"text", 'manage_tickets'::"text", 'view_analytics'::"text", 'manage_coupons'::"text", 'moderate_mesa'::"text"]) AS "gf_admin_can_any"));



CREATE POLICY "gf_events_admin_write" ON "public"."events" TO "authenticated" USING (( SELECT "public"."gf_admin_can"('manage_events'::"text") AS "gf_admin_can")) WITH CHECK (( SELECT "public"."gf_admin_can"('manage_events'::"text") AS "gf_admin_can"));



CREATE POLICY "gf_feedback_admin_delete" ON "public"."feedback" FOR DELETE TO "authenticated" USING (( SELECT "public"."gf_admin_can"('manage_feedback'::"text") AS "gf_admin_can"));



CREATE POLICY "gf_feedback_admin_select" ON "public"."feedback" FOR SELECT TO "authenticated" USING (( SELECT "public"."gf_admin_can"('manage_feedback'::"text") AS "gf_admin_can"));



CREATE POLICY "gf_feedback_admin_update" ON "public"."feedback" FOR UPDATE TO "authenticated" USING (( SELECT "public"."gf_admin_can"('manage_feedback'::"text") AS "gf_admin_can")) WITH CHECK (( SELECT "public"."gf_admin_can"('manage_feedback'::"text") AS "gf_admin_can"));



CREATE POLICY "gf_feedback_insert" ON "public"."feedback" FOR INSERT TO "authenticated", "anon" WITH CHECK (((("length"(COALESCE("message", ''::"text")) >= 1) AND ("length"(COALESCE("message", ''::"text")) <= 2000)) AND (("rating" IS NULL) OR (("rating" >= 1) AND ("rating" <= 5))) AND ("status" = 'novo'::"text") AND ("admin_notes" IS NULL)));



CREATE POLICY "gf_interesse_select_dono" ON "public"."interest_lists" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "gf_issued_certificates_participante" ON "public"."issued_certificates" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "gf_issued_certificates_produtor_delete" ON "public"."issued_certificates" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."certificates" "c"
     JOIN "public"."events" "e" ON (("e"."id" = "c"."event_id")))
  WHERE (("c"."id" = "issued_certificates"."certificate_id") AND ("e"."producer_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "gf_issued_certificates_produtor_insert" ON "public"."issued_certificates" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."certificates" "c"
     JOIN "public"."events" "e" ON (("e"."id" = "c"."event_id")))
     JOIN "public"."tickets" "t" ON (("t"."event_id" = "c"."event_id")))
  WHERE (("c"."id" = "issued_certificates"."certificate_id") AND ("e"."producer_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("t"."user_id" = "issued_certificates"."user_id") AND ("t"."status" = ANY (ARRAY['active'::"text", 'used'::"text"]))))));



CREATE POLICY "gf_issued_certificates_produtor_select" ON "public"."issued_certificates" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."certificates" "c"
     JOIN "public"."events" "e" ON (("e"."id" = "c"."event_id")))
  WHERE (("c"."id" = "issued_certificates"."certificate_id") AND ("e"."producer_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "gf_menu_items_dono" ON "public"."menu_items" TO "authenticated" USING (("producer_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ((("producer_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("event_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "menu_items"."event_id") AND ("e"."producer_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "gf_menu_items_evento_aprovado" ON "public"."menu_items" FOR SELECT TO "authenticated" USING (("is_available" AND (EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "menu_items"."event_id") AND ("e"."status" = 'published'::"text") AND ("e"."approval_status" = 'approved'::"text"))))));



CREATE POLICY "gf_mfa_aal2" ON "public"."academy_courses" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."access_logs" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."admin_audit_log" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."admin_invites" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."affiliate_coupon_requests" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."affiliate_links" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."affiliates" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."afiliado_tentativas" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."ai_credit_grants" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."ai_settings" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."ai_usage" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."beneficios_uf" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."certificates" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."chat_contacts" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."chat_departments" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."chat_settings" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."chat_topics" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."check_ins" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."collective_tables" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."contact_messages" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."contact_rate_limit_hits" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."conversation_messages" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."conversations" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."coupons" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."crm_interactions" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."crm_leads" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."crm_tasks" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."customers" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."email_logs" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."event_banners" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."event_budget_boxes" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."event_photos" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."event_reviews" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."event_surveys" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."event_timeline_items" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."event_zones" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."evento_aceites" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."evento_privado" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."events" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."favoritos" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."feedback" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."interest_lists" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."issued_certificates" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."kb_articles" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."kb_perguntas_sem_resposta" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."kb_slugs_excluidos" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."kb_termos" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."menu_items" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."menu_order_items" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."menu_orders" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."mesa_avisos" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."mesa_consentimentos" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."mesa_denuncias" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."mesa_moderacoes" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."mesa_passagens" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."mesa_travas" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."messages" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."newsletter_subscribers" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."newsletters" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."notifications" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."onboarding_logs" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."order_items" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."orders" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."partners" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."payments" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."pedido_assentos" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."piggy_transactions" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."pipeline_stages" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."platform_affiliate_producers" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."platform_affiliates" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."platform_settings" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."policy_notices" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."producer_profiles" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."producer_public" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."producer_subscriptions" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."producer_tasks" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."profiles" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."purchases" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."revenue_advances" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."seating_maps" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."staff_profiles" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."staff_profiles_acessos" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."staff_profiles_historico_pagamento" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."support_messages" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."support_sessions" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."table_members" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."tasks" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."team_convite_email" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."team_convite_tentativas" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."team_members" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."tentativas_reserva" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."ticket_types" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."tickets" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."transactions" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."user_activities" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."user_consents" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."user_course_progress" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."user_custom_features" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."user_preferences" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."user_profiles_ext" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."webhook_events" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."withdrawals" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_mfa_aal2" ON "public"."withdrawals_acessos" AS RESTRICTIVE TO "authenticated" USING (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")) WITH CHECK (( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok"));



CREATE POLICY "gf_notifications_delete_dono" ON "public"."notifications" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "gf_notifications_select_dono" ON "public"."notifications" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "gf_notifications_update_dono" ON "public"."notifications" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "gf_onboarding_all" ON "public"."onboarding_logs" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "gf_order_items_admin_select" ON "public"."order_items" FOR SELECT TO "authenticated" USING (( SELECT "public"."gf_admin_can"('manage_finance'::"text") AS "gf_admin_can"));



CREATE POLICY "gf_order_items_so_inteira" ON "public"."order_items" AS RESTRICTIVE FOR INSERT TO "authenticated" WITH CHECK ((("beneficio" = 'inteira'::"text") AND ("meia_tipo" IS NULL) AND ("taxa_unit" IS NULL) AND "public"."pedido_do_navegador"("order_id") AND ("unit_price" = ( SELECT "tt"."price"
   FROM "public"."ticket_types" "tt"
  WHERE ("tt"."id" = "order_items"."ticket_type_id")))));



CREATE POLICY "gf_orders_admin_select" ON "public"."orders" FOR SELECT TO "authenticated" USING (( SELECT "public"."gf_admin_can_any"(ARRAY['manage_finance'::"text", 'view_analytics'::"text"]) AS "gf_admin_can_any"));



CREATE POLICY "gf_orders_sem_reserva_falsa" ON "public"."orders" AS RESTRICTIVE FOR INSERT TO "authenticated" WITH CHECK ((("reservado_ate" IS NULL) AND ("coupon_id" IS NULL) AND (COALESCE("discount", (0)::numeric) = (0)::numeric)));



CREATE POLICY "gf_piggy_tx_owner" ON "public"."piggy_transactions" TO "authenticated" USING ((( SELECT "public"."gf_admin_can"('super_admin'::"text") AS "gf_admin_can") OR ("box_id" IN ( SELECT "b"."id"
   FROM "public"."event_budget_boxes" "b"
  WHERE ("b"."producer_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((( SELECT "public"."gf_admin_can"('super_admin'::"text") AS "gf_admin_can") OR ("box_id" IN ( SELECT "b"."id"
   FROM "public"."event_budget_boxes" "b"
  WHERE ("b"."producer_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "gf_pipeline_stages_dono" ON "public"."pipeline_stages" TO "authenticated" USING (("producer_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("producer_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "gf_platform_settings_admin_all" ON "public"."platform_settings" TO "authenticated" USING (( SELECT "public"."gf_admin_can"('manage_settings'::"text") AS "gf_admin_can")) WITH CHECK (( SELECT "public"."gf_admin_can"('manage_settings'::"text") AS "gf_admin_can"));



CREATE POLICY "gf_platform_settings_public_read" ON "public"."platform_settings" FOR SELECT TO "authenticated", "anon" USING (("key" = ANY (ARRAY['general'::"text", 'fees'::"text"])));



CREATE POLICY "gf_producer_profiles_admin_insert" ON "public"."producer_profiles" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."gf_admin_can"('manage_users'::"text") AS "gf_admin_can"));



CREATE POLICY "gf_producer_profiles_admin_update" ON "public"."producer_profiles" FOR UPDATE TO "authenticated" USING (( SELECT "public"."gf_admin_can"('manage_users'::"text") AS "gf_admin_can")) WITH CHECK (( SELECT "public"."gf_admin_can"('manage_users'::"text") AS "gf_admin_can"));



CREATE POLICY "gf_producer_profiles_select_own_or_admin" ON "public"."producer_profiles" FOR SELECT TO "authenticated" USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."gf_admin_can_any"(ARRAY['manage_users'::"text", 'manage_finance'::"text"]) AS "gf_admin_can_any")));



CREATE POLICY "gf_producer_subscriptions_admin_all" ON "public"."producer_subscriptions" TO "authenticated" USING (( SELECT "public"."gf_admin_can"('manage_users'::"text") AS "gf_admin_can")) WITH CHECK (( SELECT "public"."gf_admin_can"('manage_users'::"text") AS "gf_admin_can"));



CREATE POLICY "gf_producer_subscriptions_owner_select" ON "public"."producer_subscriptions" FOR SELECT TO "authenticated" USING (("producer_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "gf_profiles_admin_update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."gf_admin_can"('manage_users'::"text") AS "gf_admin_can") AND (("role" <> 'admin'::"text") OR ( SELECT "public"."gf_admin_can"('super_admin'::"text") AS "gf_admin_can")))) WITH CHECK ((( SELECT "public"."gf_admin_can"('manage_users'::"text") AS "gf_admin_can") AND (("role" <> 'admin'::"text") OR ( SELECT "public"."gf_admin_can"('super_admin'::"text") AS "gf_admin_can"))));



CREATE POLICY "gf_profiles_ext_owner" ON "public"."user_profiles_ext" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "gf_profiles_select_own_or_admin" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."gf_admin_can_any"(ARRAY['manage_users'::"text", 'manage_team'::"text", 'manage_affiliates'::"text", 'manage_events'::"text", 'manage_finance'::"text", 'manage_tickets'::"text", 'manage_coupons'::"text", 'view_analytics'::"text", 'manage_settings'::"text"]) AS "gf_admin_can_any") OR (("role" = 'admin'::"text") AND ( SELECT "public"."gf_admin_can"('manage_support'::"text") AS "gf_admin_can"))));



CREATE POLICY "gf_revenue_advances_admin_delete" ON "public"."revenue_advances" FOR DELETE TO "authenticated" USING (( SELECT "public"."gf_admin_can"('manage_finance'::"text") AS "gf_admin_can"));



CREATE POLICY "gf_revenue_advances_admin_update" ON "public"."revenue_advances" FOR UPDATE TO "authenticated" USING (( SELECT "public"."gf_admin_can"('manage_finance'::"text") AS "gf_admin_can")) WITH CHECK (( SELECT "public"."gf_admin_can"('manage_finance'::"text") AS "gf_admin_can"));



CREATE POLICY "gf_revenue_advances_select" ON "public"."revenue_advances" FOR SELECT TO "authenticated" USING ((("producer_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."gf_admin_can"('manage_finance'::"text") AS "gf_admin_can")));



CREATE POLICY "gf_support_sessions_owner" ON "public"."support_sessions" TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."gf_is_admin"())) WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."gf_is_admin"()));



CREATE POLICY "gf_tasks_assignee_read" ON "public"."tasks" FOR SELECT USING (("assignee_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "gf_tasks_owner" ON "public"."tasks" TO "authenticated" USING ((( SELECT "public"."gf_admin_can"('super_admin'::"text") AS "gf_admin_can") OR ("event_id" IN ( SELECT "e"."id"
   FROM "public"."events" "e"
  WHERE ("e"."producer_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((( SELECT "public"."gf_admin_can"('super_admin'::"text") AS "gf_admin_can") OR ("event_id" IN ( SELECT "e"."id"
   FROM "public"."events" "e"
  WHERE ("e"."producer_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "gf_ticket_types_admin_select" ON "public"."ticket_types" FOR SELECT TO "authenticated" USING (( SELECT "public"."gf_admin_can_any"(ARRAY['manage_tickets'::"text", 'manage_events'::"text", 'moderate_mesa'::"text"]) AS "gf_admin_can_any"));



CREATE POLICY "gf_tickets_admin_select" ON "public"."tickets" FOR SELECT TO "authenticated" USING (( SELECT "public"."gf_admin_can_any"(ARRAY['manage_tickets'::"text", 'manage_users'::"text"]) AS "gf_admin_can_any"));



CREATE POLICY "gf_transactions_admin_select" ON "public"."transactions" FOR SELECT TO "authenticated" USING (( SELECT "public"."gf_admin_can"('manage_finance'::"text") AS "gf_admin_can"));



CREATE POLICY "gf_user_preferences_all" ON "public"."user_preferences" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "gf_withdrawals_admin_select" ON "public"."withdrawals" FOR SELECT TO "authenticated" USING (( SELECT "public"."gf_admin_can"('manage_finance'::"text") AS "gf_admin_can"));



CREATE POLICY "gf_withdrawals_admin_update" ON "public"."withdrawals" FOR UPDATE TO "authenticated" USING (( SELECT "public"."gf_admin_can"('manage_finance'::"text") AS "gf_admin_can")) WITH CHECK (( SELECT "public"."gf_admin_can"('manage_finance'::"text") AS "gf_admin_can"));



ALTER TABLE "public"."interest_lists" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."issued_certificates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kb_articles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kb_articles_delete" ON "public"."kb_articles" FOR DELETE TO "authenticated" USING (( SELECT "public"."gf_admin_can"('manage_support'::"text") AS "gf_admin_can"));



CREATE POLICY "kb_articles_insert" ON "public"."kb_articles" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."gf_admin_can"('manage_support'::"text") AS "gf_admin_can") AND ("origin" = ANY (ARRAY['manual'::"text", 'atendente'::"text"])) AND ("created_by" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "kb_articles_select" ON "public"."kb_articles" FOR SELECT TO "authenticated" USING (( SELECT "public"."gf_admin_can"('manage_support'::"text") AS "gf_admin_can"));



CREATE POLICY "kb_articles_update" ON "public"."kb_articles" FOR UPDATE TO "authenticated" USING (( SELECT "public"."gf_admin_can"('manage_support'::"text") AS "gf_admin_can")) WITH CHECK (( SELECT "public"."gf_admin_can"('manage_support'::"text") AS "gf_admin_can"));



CREATE POLICY "kb_perguntas_admin" ON "public"."kb_perguntas_sem_resposta" TO "authenticated" USING (( SELECT "public"."gf_admin_can"('manage_support'::"text") AS "gf_admin_can"));



ALTER TABLE "public"."kb_perguntas_sem_resposta" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kb_slugs_excluidos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kb_termos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kb_termos_admin" ON "public"."kb_termos" TO "authenticated" USING (( SELECT "public"."gf_admin_can"('manage_support'::"text") AS "gf_admin_can")) WITH CHECK (( SELECT "public"."gf_admin_can"('manage_support'::"text") AS "gf_admin_can"));



ALTER TABLE "public"."menu_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."menu_order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."menu_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mesa_avisos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mesa_consentimentos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mesa_denuncias" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mesa_moderacoes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mesa_passagens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mesa_travas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."newsletter_subscribers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."newsletters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."onboarding_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."partners" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pedido_assentos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."piggy_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pipeline_stages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_affiliate_producers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_affiliates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."policy_notices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."producer_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."producer_public" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."producer_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."producer_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."revenue_advances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."seating_maps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_profiles_acessos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_profiles_historico_pagamento" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staff_profiles_proprio_edita" ON "public"."staff_profiles" FOR UPDATE TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (( SELECT "public"."gf_tem_2fa"(( SELECT "auth"."uid"() AS "uid")) AS "gf_tem_2fa") IS TRUE) AND (COALESCE((( SELECT "auth"."jwt"() AS "jwt") ->> 'aal'::"text"), ''::"text") = 'aal2'::"text"))) WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (( SELECT "public"."gf_tem_2fa"(( SELECT "auth"."uid"() AS "uid")) AS "gf_tem_2fa") IS TRUE) AND (COALESCE((( SELECT "auth"."jwt"() AS "jwt") ->> 'aal'::"text"), ''::"text") = 'aal2'::"text")));



CREATE POLICY "staff_profiles_proprio_le" ON "public"."staff_profiles" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ( SELECT "public"."gf_mfa_ok"() AS "gf_mfa_ok")));



ALTER TABLE "public"."support_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "support_messages_delete" ON "public"."support_messages" FOR DELETE TO "authenticated" USING (( SELECT "public"."gf_is_admin"() AS "gf_is_admin"));



CREATE POLICY "support_messages_insert" ON "public"."support_messages" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."gf_is_admin"() AS "gf_is_admin") OR (("session_id" IN ( SELECT "s"."id"
   FROM "public"."support_sessions" "s"
  WHERE ("s"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("sender_type" = 'visitor'::"text") AND ("sender_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "support_messages_select" ON "public"."support_messages" FOR SELECT TO "authenticated" USING ((( SELECT "public"."gf_is_admin"() AS "gf_is_admin") OR ("session_id" IN ( SELECT "s"."id"
   FROM "public"."support_sessions" "s"
  WHERE ("s"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "support_messages_update" ON "public"."support_messages" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."gf_is_admin"() AS "gf_is_admin") OR ("session_id" IN ( SELECT "s"."id"
   FROM "public"."support_sessions" "s"
  WHERE ("s"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((( SELECT "public"."gf_is_admin"() AS "gf_is_admin") OR ("session_id" IN ( SELECT "s"."id"
   FROM "public"."support_sessions" "s"
  WHERE ("s"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."support_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."table_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_convite_email" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_convite_tentativas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "team_members_dono_delete" ON "public"."team_members" FOR DELETE TO "authenticated" USING (("producer_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "team_members_dono_select" ON "public"."team_members" FOR SELECT TO "authenticated" USING (("producer_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "team_members_dono_update" ON "public"."team_members" FOR UPDATE TO "authenticated" USING (("producer_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("producer_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."tentativas_reserva" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ticket_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tickets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_activities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_activities_insert_own" ON "public"."user_activities" FOR INSERT TO "authenticated", "anon" WITH CHECK ((("user_id" IS NULL) OR ("user_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "user_activities_select_admin" ON "public"."user_activities" FOR SELECT TO "authenticated" USING (( SELECT "public"."gf_admin_can_any"(ARRAY['manage_users'::"text", 'view_analytics'::"text", 'manage_settings'::"text"]) AS "gf_admin_can_any"));



CREATE POLICY "user_activities_select_own" ON "public"."user_activities" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."user_consents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_consents_select_own" ON "public"."user_consents" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."user_course_progress" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_custom_features" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles_ext" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."webhook_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."withdrawals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."withdrawals_acessos" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."conversation_messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."conversations";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."support_messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."support_sessions";



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";




















































































































































































































































































REVOKE ALL ON FUNCTION "public"."aceite_evento_versao"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."aceite_evento_versao"() TO "service_role";
GRANT ALL ON FUNCTION "public"."aceite_evento_versao"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_activity_stats"("desde" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_activity_stats"("desde" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_activity_stats"("desde" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_equipe"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_equipe"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_equipe"() TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."events" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_evento_decidir"("p_id" "uuid", "p_decisao" "text", "p_motivo" "text", "p_versao" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_evento_decidir"("p_id" "uuid", "p_decisao" "text", "p_motivo" "text", "p_versao" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_evento_decidir"("p_id" "uuid", "p_decisao" "text", "p_motivo" "text", "p_versao" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_limpar_cpf_compra"("p_uid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_limpar_cpf_compra"("p_uid" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."admin_limpar_cpf_compra"("p_uid" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_ocultar_organizador"("p_producer" "uuid", "p_ocultar" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_ocultar_organizador"("p_producer" "uuid", "p_ocultar" boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."admin_ocultar_organizador"("p_producer" "uuid", "p_ocultar" boolean) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_registrar_exportacao"("p_tabela" "text", "p_linhas" integer, "p_motivo" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_registrar_exportacao"("p_tabela" "text", "p_linhas" integer, "p_motivo" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_usuario_ficha"("p_user" "uuid", "p_motivo" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_usuario_ficha"("p_user" "uuid", "p_motivo" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_usuarios_lista"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_usuarios_lista"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_usuarios_lista"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."affiliate_link_hit"("p_code" "text", "p_slug" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."affiliate_link_hit"("p_code" "text", "p_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."affiliate_link_hit"("p_code" "text", "p_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."affiliate_link_hit"("p_code" "text", "p_slug" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."affiliate_my_producers"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."affiliate_my_producers"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."affiliate_my_producers"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."afiliados_para_cupons"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."afiliados_para_cupons"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."afiliados_para_cupons"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."agent_meus_eventos"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."agent_meus_eventos"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."ai_admin_resumo"("p_de" timestamp with time zone, "p_ate" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ai_admin_resumo"("p_de" timestamp with time zone, "p_ate" timestamp with time zone) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."ai_balance"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ai_balance"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."ai_custo"("p_model" "text", "p_in" bigint, "p_out" bigint) FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."ai_finish"("p_id" "uuid", "p_tokens_in" integer, "p_tokens_out" integer, "p_steps" integer, "p_tools" "text"[], "p_status" "text", "p_resumo" "text", "p_called" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ai_finish"("p_id" "uuid", "p_tokens_in" integer, "p_tokens_out" integer, "p_steps" integer, "p_tools" "text"[], "p_status" "text", "p_resumo" "text", "p_called" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."ai_get_gemini_key"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ai_get_gemini_key"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."ai_grant_credits"("p_user" "uuid", "p_amount" integer, "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ai_grant_credits"("p_user" "uuid", "p_amount" integer, "p_note" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."ai_key_status"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ai_key_status"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."ai_log"("p_user" "uuid", "p_mode" "text", "p_tier" "text", "p_model" "text", "p_tokens_in" integer, "p_tokens_out" integer, "p_resumo" "text", "p_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ai_log"("p_user" "uuid", "p_mode" "text", "p_tier" "text", "p_model" "text", "p_tokens_in" integer, "p_tokens_out" integer, "p_resumo" "text", "p_status" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ai_portoes"("p_user" "uuid") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."ai_precheck"("p_user" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ai_precheck"("p_user" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ai_reserve"("p_user" "uuid", "p_tier" "text", "p_mode" "text", "p_model" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ai_reserve"("p_user" "uuid", "p_tier" "text", "p_mode" "text", "p_model" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ai_saldo"("p_user" "uuid") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."ai_set_gemini_key"("p_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ai_set_gemini_key"("p_key" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."assentos_ocupados"("p_event" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assentos_ocupados"("p_event" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."assentos_ocupados"("p_event" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."assentos_ocupados"("p_event" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."audit_ip_cabecalho"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."audit_limpar"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."audit_log_imutavel"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."audit_motivo_cabecalho"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."audit_registra"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."audit_registrar_servico"("p_autor" "uuid", "p_acao" "text", "p_tabela" "text", "p_objeto_id" "text", "p_depois" "jsonb", "p_motivo" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."audit_registrar_servico"("p_autor" "uuid", "p_acao" "text", "p_tabela" "text", "p_objeto_id" "text", "p_depois" "jsonb", "p_motivo" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."audit_vencido"("p_tipo" "text", "p_em" timestamp with time zone) FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."aviso_politica_destinatarios"("p_version" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."aviso_politica_destinatarios"("p_version" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."aviso_politica_registrar"("p_user" "uuid", "p_version" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."aviso_politica_registrar"("p_user" "uuid", "p_version" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."caixinha_movimentar"("p_box" "uuid", "p_tipo" "text", "p_valor" numeric, "p_nota" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."caixinha_movimentar"("p_box" "uuid", "p_tipo" "text", "p_valor" numeric, "p_nota" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."caixinha_movimentar"("p_box" "uuid", "p_tipo" "text", "p_valor" numeric, "p_nota" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."capas_arquivos_a_apagar"("p_user" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."capas_arquivos_a_apagar"("p_user" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."capas_can_upload"("p_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."capas_can_upload"("p_name" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."cardapio_can_upload"("p_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cardapio_can_upload"("p_name" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."certificado_validar"("p_code" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."certificado_validar"("p_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."certificado_validar"("p_code" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."certificado_validar"("p_code" "text") TO "anon";



REVOKE ALL ON FUNCTION "public"."chat_arquivos_a_apagar"("p_user" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."chat_arquivos_a_apagar"("p_user" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."chat_atendentes"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."chat_atendentes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."chat_atendentes"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."chat_bot_feedback"("p_conv" "uuid", "p_resolveu" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."chat_bot_feedback"("p_conv" "uuid", "p_resolveu" boolean) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."chat_bot_ligar"("p_ligado" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."chat_bot_ligar"("p_ligado" boolean) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."chat_bot_passar"("p_conv" "uuid", "p_motivo" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."chat_bot_pode_ia"("p_conv" "uuid") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."chat_bot_responder"("p_conv" "uuid", "p_texto" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."chat_can_upload"("p_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."chat_can_upload"("p_name" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."chat_cliente_contexto"("p_user" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."chat_cliente_contexto"("p_user" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."chat_cliente_contexto"("p_user" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."chat_handoff"("p_conv" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."chat_handoff"("p_conv" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."chat_inbox"("p_filtro" "text", "p_busca" "text", "p_limite" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."chat_inbox"("p_filtro" "text", "p_busca" "text", "p_limite" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."chat_kb_buscar"("p_q" "text", "p_publicos" "text"[], "p_limite" integer, "p_aprox" boolean) FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."chat_kb_mascarar"("p" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."chat_kb_normalizar"("p" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."chat_kb_termos"("p" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."chat_mark_read"("p_conv" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."chat_mark_read"("p_conv" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."chat_messages_after_insert"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."chat_messages_before_insert"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."chat_notify_due"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."chat_notify_due"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."chat_notify_mark"("p_ids" "uuid"[], "p_tipo" "text", "p_ok" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."chat_notify_mark"("p_ids" "uuid"[], "p_tipo" "text", "p_ok" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."chat_notify_secret"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."chat_notify_secret"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."chat_public_settings"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."chat_public_settings"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."chat_rate"("p_conv" "uuid", "p_rating" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."chat_rate"("p_conv" "uuid", "p_rating" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."chat_role"("p_conv" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."chat_role"("p_conv" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."chat_role_path"("p_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."chat_role_path"("p_name" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."chat_send"("p_conv" "uuid", "p_body" "text", "p_is_internal" boolean, "p_attachment_path" "text", "p_attachment_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."chat_send"("p_conv" "uuid", "p_body" "text", "p_is_internal" boolean, "p_attachment_path" "text", "p_attachment_name" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."chat_start"("p_topic_id" "uuid", "p_event_id" "uuid", "p_name" "text", "p_phone" "text", "p_marketing_opt_in" boolean, "p_body" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."chat_start"("p_topic_id" "uuid", "p_event_id" "uuid", "p_name" "text", "p_phone" "text", "p_marketing_opt_in" boolean, "p_body" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."chat_update"("p_conv" "uuid", "p_patch" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."chat_update"("p_conv" "uuid", "p_patch" "jsonb") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."colaborador_dados"("p_user" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."colaborador_dados"("p_user" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."colaboradores_resumo"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."colaboradores_resumo"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."confirmar_pedido_gratis"("p_order" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."confirmar_pedido_gratis"("p_order" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."confirmar_pedido_gratis"("p_order" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."confirmar_pedido_pago"("p_order_id" "uuid", "p_gateway_payment_id" "text", "p_valor_pago_centavos" integer, "p_event_id" "text", "p_pago_em" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."confirmar_pedido_pago"("p_order_id" "uuid", "p_gateway_payment_id" "text", "p_valor_pago_centavos" integer, "p_event_id" "text", "p_pago_em" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."convite_aceitar"("p_token" "text", "p_dados" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."convite_aceitar"("p_token" "text", "p_dados" "jsonb") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."convite_cancelar"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."convite_cancelar"("p_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."convite_conferir"("p_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."convite_conferir"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."convite_conferir"("p_token" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."convite_criar"("p_email" "text", "p_cargo" "text", "p_permissions" "text"[], "p_token_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."convite_criar"("p_email" "text", "p_cargo" "text", "p_permissions" "text"[], "p_token_hash" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."convite_hash"("p" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."convite_permissoes_ok"("p" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."convite_permissoes_ok"("p" "text"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."convite_reenviar"("p_id" "uuid", "p_token_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."convite_reenviar"("p_id" "uuid", "p_token_hash" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."convites_listar"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."convites_listar"() TO "authenticated";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."pipeline_stages" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."pipeline_stages" TO "authenticated";
GRANT ALL ON TABLE "public"."pipeline_stages" TO "service_role";



REVOKE ALL ON FUNCTION "public"."crm_criar_etapas_padrao"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."crm_criar_etapas_padrao"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."crm_criar_etapas_padrao"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."escolher_mesa"("p_event_id" "uuid", "p_mesa_numero" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."escolher_mesa"("p_event_id" "uuid", "p_mesa_numero" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."escolher_mesa"("p_event_id" "uuid", "p_mesa_numero" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."evento_acesso"("p_event" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."evento_acesso"("p_event" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."evento_acesso"("p_event" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."evento_acesso"("p_event" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."evento_contagem_publica"("p_event_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."evento_contagem_publica"("p_event_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."evento_contagem_publica"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."evento_contagem_publica"("p_event_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."evento_momento"("e" "public"."events") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."evento_momento"("e" "public"."events") TO "service_role";



REVOKE ALL ON FUNCTION "public"."evento_privado_marca"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."evento_privado_marca"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."evento_publico"("p_ref" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."evento_publico"("p_ref" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."evento_publico"("p_ref" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."evento_publico"("p_ref" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."evk_preco_meia"("p_cent" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."evk_preco_meia"("p_cent" bigint) TO "service_role";



REVOKE ALL ON FUNCTION "public"."evk_taxa_centavos"("p_cent" bigint, "p_meia" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."evk_taxa_centavos"("p_cent" bigint, "p_meia" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."formar_mesas"("p_event_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."formar_mesas"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."formar_mesas"("p_event_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."gf_admin_can"("p" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."gf_admin_can"("p" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."gf_admin_can_any"("p" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."gf_admin_can_any"("p" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."gf_admin_can_any"("p" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."gf_cpf_valido"("p" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."gf_cpf_valido"("p" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gf_cpf_valido"("p" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."gf_cupom_regras"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."gf_cupom_regras"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."gf_events_ingressos_marca"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."gf_events_ingressos_marca"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."gf_ha_outro_super_admin"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."gf_ha_outro_super_admin"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gf_ha_outro_super_admin"("p_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."gf_interesse_avisar"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."gf_interesse_para_crm"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."gf_is_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."gf_is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."gf_is_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."gf_mfa_ok"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."gf_mfa_ok"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."gf_mfa_ok"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."gf_notificar_evento"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."gf_notificar_evento"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."gf_portaria_ok"("p_producer" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."gf_portaria_ok"("p_producer" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."gf_protect_affiliate_link"() TO "anon";
GRANT ALL ON FUNCTION "public"."gf_protect_affiliate_link"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."gf_protect_affiliate_link"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."gf_protect_coupon_uses"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."gf_protect_coupon_uses"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."gf_protect_coupon_uses"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."gf_protect_event_cancel"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."gf_protect_event_cancel"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."gf_protect_event_moderation"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."gf_protect_event_moderation"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."gf_protect_platform_affiliate_payout"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."gf_protect_platform_affiliate_payout"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."gf_protect_platform_affiliate_payout"() TO "service_role";



GRANT ALL ON FUNCTION "public"."gf_protect_producer_profile_privileges"() TO "anon";
GRANT ALL ON FUNCTION "public"."gf_protect_producer_profile_privileges"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."gf_protect_producer_profile_privileges"() TO "service_role";



GRANT ALL ON FUNCTION "public"."gf_protect_profile_privileges"() TO "anon";
GRANT ALL ON FUNCTION "public"."gf_protect_profile_privileges"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."gf_protect_profile_privileges"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."gf_protect_withdrawals"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."gf_protect_withdrawals"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."gf_protect_withdrawals"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."gf_reauth_dinheiro"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."gf_reauth_recente"("p_segundos" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."gf_reauth_recente"("p_segundos" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."gf_reauth_recente"("p_segundos" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."gf_tem_2fa"("p_user" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."gf_tem_2fa"("p_user" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gf_tem_2fa"("p_user" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."gf_ticket_types_toca_evento"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."gf_ticket_types_toca_evento"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."gf_trava_venda_ingresso"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."gf_trava_venda_ingresso"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."interesse_email_due"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."interesse_email_due"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."interesse_email_mark"("p_ids" "uuid"[], "p_ok" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."interesse_email_mark"("p_ids" "uuid"[], "p_ok" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."interesse_entrar"("p_event_id" "uuid", "p_ticket_type_id" "uuid", "p_versao" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."interesse_entrar"("p_event_id" "uuid", "p_ticket_type_id" "uuid", "p_versao" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."interesse_lista"("p_event_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."interesse_lista"("p_event_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."interesse_notify_secret"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."interesse_notify_secret"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."interesse_remover"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."interesse_remover"("p_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."interesse_sair"("p_event_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."interesse_sair"("p_event_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."kb_articles_after_delete"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."link_me_to_affiliate"("p_code" "text", "p_ref_first_seen_at" timestamp with time zone, "p_link" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."link_me_to_affiliate"("p_code" "text", "p_ref_first_seen_at" timestamp with time zone, "p_link" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_me_to_affiliate"("p_code" "text", "p_ref_first_seen_at" timestamp with time zone, "p_link" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."listar_afiliados"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."listar_afiliados"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."listar_afiliados"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."logos_can_upload"("p_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."logos_can_upload"("p_name" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."marcar_avisos_lidos"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."marcar_avisos_lidos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."marcar_avisos_lidos"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_avatar_guard"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_avatar_guard"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_cartao"("p_user" "uuid", "p_ok" boolean, "p_oculto" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_cartao"("p_user" "uuid", "p_ok" boolean, "p_oculto" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_compat"("a" "jsonb", "b" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_compat"("a" "jsonb", "b" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_conflito"("p_evento" "uuid", "p_denunciado" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_conflito"("p_evento" "uuid", "p_denunciado" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_consent_guard"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_consent_guard"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_consentir"("p_versao" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_consentir"("p_versao" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mesa_consentir"("p_versao" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_denuncia_liberar"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_denuncia_liberar"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mesa_denuncia_liberar"("p_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_denuncia_que_remove"("p_event_id" "uuid", "p_user" "uuid", "p_produtor" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_denuncia_que_remove"("p_event_id" "uuid", "p_user" "uuid", "p_produtor" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_denuncia_status"("p_id" "uuid", "p_status" "text", "p_resultado" "text", "p_explicacao" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_denuncia_status"("p_id" "uuid", "p_status" "text", "p_resultado" "text", "p_explicacao" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mesa_denuncia_status"("p_id" "uuid", "p_status" "text", "p_resultado" "text", "p_explicacao" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_denunciar"("p_membro" "uuid", "p_motivo" "text", "p_detalhe" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_denunciar"("p_membro" "uuid", "p_motivo" "text", "p_detalhe" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mesa_denunciar"("p_membro" "uuid", "p_motivo" "text", "p_detalhe" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_denuncias_do_evento"("p_event_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_denuncias_do_evento"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mesa_denuncias_do_evento"("p_event_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_destravar"("p_event_id" "uuid", "p_trava_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_destravar"("p_event_id" "uuid", "p_trava_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mesa_destravar"("p_event_id" "uuid", "p_trava_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_foto_contestar"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_foto_contestar"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mesa_foto_contestar"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_foto_decidir"("p_user" "uuid", "p_hash" "text", "p_aprovada" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_foto_decidir"("p_user" "uuid", "p_hash" "text", "p_aprovada" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."mesa_foto_decidir"("p_user" "uuid", "p_hash" "text", "p_aprovada" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_foto_formato"("p" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_foto_formato"("p" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_foto_hash"("p" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_foto_hash"("p" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_foto_na_fila"("p_user" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_foto_na_fila"("p_user" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_foto_resultado_auto"("p_user" "uuid", "p_hash" "text", "p_decisao" "text", "p_motivos" "text"[], "p_modelo" "text", "p_tokens_in" integer, "p_tokens_out" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_foto_resultado_auto"("p_user" "uuid", "p_hash" "text", "p_decisao" "text", "p_motivos" "text"[], "p_modelo" "text", "p_tokens_in" integer, "p_tokens_out" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_fotos_para_moderar_auto"("p_limite" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_fotos_para_moderar_auto"("p_limite" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_fotos_para_revisar"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_fotos_para_revisar"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mesa_fotos_para_revisar"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_ia_ligada"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_ia_ligada"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_idade_guard"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_idade_guard"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_moderacao_secret"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_moderacao_secret"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_moderador"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_moderador"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_mostrar_rede"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_mostrar_rede"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mesa_mostrar_rede"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_ocultar_rede"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_ocultar_rede"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mesa_ocultar_rede"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_ocupados"("p_mesa" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_ocupados"("p_mesa" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_ok"("p_user" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_ok"("p_user" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_passagem"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_passagem"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_pedido_guard"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_pedido_guard"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_perfil"("p_user" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_perfil"("p_user" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_recalcular"("p_mesa" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_recalcular"("p_mesa" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_remover_membro"("p_event_id" "uuid", "p_ticket_id" "uuid", "p_motivo" "text", "p_detalhe" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_remover_membro"("p_event_id" "uuid", "p_ticket_id" "uuid", "p_motivo" "text", "p_detalhe" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mesa_remover_membro"("p_event_id" "uuid", "p_ticket_id" "uuid", "p_motivo" "text", "p_detalhe" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_revogar"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_revogar"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mesa_revogar"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_sair"("p_event_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_sair"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mesa_sair"("p_event_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_tags_ok"("p" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_tags_ok"("p" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mesa_tags_ok"("p" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_tem_foto_para_moderar"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_tem_foto_para_moderar"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_termo_versao"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_termo_versao"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_tipo_guard"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_tipo_guard"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_travado"("p_evento" "uuid", "p_user" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_travado"("p_evento" "uuid", "p_user" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_travas_do_evento"("p_event_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_travas_do_evento"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mesa_travas_do_evento"("p_event_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesa_voltar"("p_event_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesa_voltar"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mesa_voltar"("p_event_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesas_do_evento"("p_event_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesas_do_evento"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mesas_do_evento"("p_event_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesas_para_escolher"("p_event_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesas_para_escolher"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mesas_para_escolher"("p_event_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."meu_organizador_publico"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."meu_organizador_publico"() TO "service_role";
GRANT ALL ON FUNCTION "public"."meu_organizador_publico"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."meu_perfil"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."meu_perfil"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."meu_perfil"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."meus_avisos_mesa"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."meus_avisos_mesa"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."meus_avisos_mesa"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."minha_mesa"("p_event_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."minha_mesa"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."minha_mesa"("p_event_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."order_items_estoque_guard"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."order_items_estoque_guard"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."orders_cpf_hash"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."orders_cpf_hash"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."orders_pago_assento_guard"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."orders_pago_assento_guard"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."orders_pago_cpf_guard"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."orders_pago_cpf_guard"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."orders_um_pendente"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."orders_um_pendente"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."organizador_cnpj_do_produtor"("p_producer" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."organizador_cnpj_do_produtor"("p_producer" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."organizador_cnpj_valido"("p" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."organizador_cnpj_valido"("p" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."organizador_cnpj_valido"("p" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."organizador_marca_ok"("p" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."organizador_marca_ok"("p" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."organizador_marca_ok"("p" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."organizador_publico"("p_evento" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."organizador_publico"("p_evento" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."organizador_publico"("p_evento" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."organizador_publico"("p_evento" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."organizador_redes_ok"("p" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."organizador_redes_ok"("p" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."organizador_redes_ok"("p" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."organizador_url_ok"("p" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."organizador_url_ok"("p" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."organizador_url_ok"("p" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."pedido_do_navegador"("p_order" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pedido_do_navegador"("p_order" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."pedido_do_navegador"("p_order" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."pedidos_pendentes_expirar"("p_minutos" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pedidos_pendentes_expirar"("p_minutos" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."platform_settings_updated_by"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."pode_comprar"("p_order" "uuid", "p_ticket_type" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pode_comprar"("p_order" "uuid", "p_ticket_type" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."pode_comprar"("p_order" "uuid", "p_ticket_type" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."pr7_admin_afiliados"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pr7_admin_afiliados"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."pr7_admin_saques"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pr7_admin_saques"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."pr7_anonimizar_pii"("p_uid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pr7_anonimizar_pii"("p_uid" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."pr7_dec"("p" "bytea") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."pr7_enc"("p" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."pr7_enc_se_mudou"("p_novo" "text", "p_atual" "bytea") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."pr7_hmac"("p" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."pr7_key"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."pr7_mascara4"("p" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."pr7_mascara_cpf"("p" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."pr7_meu_cadastro"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pr7_meu_cadastro"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."pr7_produtor_financeiro"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pr7_produtor_financeiro"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."pr7_salvar_afiliado"("p_id" "uuid", "p_cpf" "text", "p_full_name" "text", "p_birth_date" "date", "p_email" "text", "p_phone" "text", "p_whatsapp" "text", "p_cep" "text", "p_street" "text", "p_street_number" "text", "p_complement" "text", "p_neighborhood" "text", "p_city" "text", "p_state" "text", "p_recurring_percent" numeric, "p_status" "text", "p_agreement_date" "date", "p_notes" "text", "p_user_id" "uuid", "p_referral_code" "text", "p_payout_account_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pr7_salvar_afiliado"("p_id" "uuid", "p_cpf" "text", "p_full_name" "text", "p_birth_date" "date", "p_email" "text", "p_phone" "text", "p_whatsapp" "text", "p_cep" "text", "p_street" "text", "p_street_number" "text", "p_complement" "text", "p_neighborhood" "text", "p_city" "text", "p_state" "text", "p_recurring_percent" numeric, "p_status" "text", "p_agreement_date" "date", "p_notes" "text", "p_user_id" "uuid", "p_referral_code" "text", "p_payout_account_id" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."pr7_salvar_meu_cadastro"("p_nome_completo" "text", "p_cpf" "text", "p_rg" "text", "p_data_nascimento" "date", "p_cep" "text", "p_rua" "text", "p_numero" "text", "p_complemento" "text", "p_bairro" "text", "p_cidade" "text", "p_uf" "text", "p_email_secundario" "text", "p_telefone" "text", "p_whatsapp" "text", "p_emergencia_nome" "text", "p_emergencia_parentesco" "text", "p_emergencia_telefone" "text", "p_banco" "text", "p_agencia" "text", "p_conta" "text", "p_pix_tipo" "text", "p_pix_chave" "text", "p_updated_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pr7_salvar_meu_cadastro"("p_nome_completo" "text", "p_cpf" "text", "p_rg" "text", "p_data_nascimento" "date", "p_cep" "text", "p_rua" "text", "p_numero" "text", "p_complemento" "text", "p_bairro" "text", "p_cidade" "text", "p_uf" "text", "p_email_secundario" "text", "p_telefone" "text", "p_whatsapp" "text", "p_emergencia_nome" "text", "p_emergencia_parentesco" "text", "p_emergencia_telefone" "text", "p_banco" "text", "p_agencia" "text", "p_conta" "text", "p_pix_tipo" "text", "p_pix_chave" "text", "p_updated_at" timestamp with time zone) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."pr7_salvar_produtor_financeiro"("p_cnpj" "text", "p_pix_key" "text", "p_bank_account" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pr7_salvar_produtor_financeiro"("p_cnpj" "text", "p_pix_key" "text", "p_bank_account" "jsonb") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."produtor_vendas_pagas"("p_de" timestamp with time zone, "p_ate" timestamp with time zone, "p_event_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."produtor_vendas_pagas"("p_de" timestamp with time zone, "p_ate" timestamp with time zone, "p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."produtor_vendas_pagas"("p_de" timestamp with time zone, "p_ate" timestamp with time zone, "p_event_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reservar_assentos"("p_event" "uuid", "p_seats" "text"[], "p_meias" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reservar_assentos"("p_event" "uuid", "p_seats" "text"[], "p_meias" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."reservar_assentos"("p_event" "uuid", "p_seats" "text"[], "p_meias" "jsonb") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."reservar_ingressos"("p_event_id" "uuid", "p_itens" "jsonb", "p_cupom" "text", "p_cpf" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reservar_ingressos"("p_event_id" "uuid", "p_itens" "jsonb", "p_cupom" "text", "p_cpf" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."reservar_ingressos"("p_event_id" "uuid", "p_itens" "jsonb", "p_cupom" "text", "p_cpf" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."salvar_organizador_publico"("p_nome_publico" "text", "p_whatsapp" "text", "p_instagram" "text", "p_site" "text", "p_email_contato" "text", "p_outras_redes" "jsonb", "p_mostrar_nome" boolean, "p_mostrar_whatsapp" boolean, "p_mostrar_instagram" boolean, "p_mostrar_site" boolean, "p_mostrar_email" boolean, "p_mostrar_outras_redes" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."salvar_organizador_publico"("p_nome_publico" "text", "p_whatsapp" "text", "p_instagram" "text", "p_site" "text", "p_email_contato" "text", "p_outras_redes" "jsonb", "p_mostrar_nome" boolean, "p_mostrar_whatsapp" boolean, "p_mostrar_instagram" boolean, "p_mostrar_site" boolean, "p_mostrar_email" boolean, "p_mostrar_outras_redes" boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."salvar_organizador_publico"("p_nome_publico" "text", "p_whatsapp" "text", "p_instagram" "text", "p_site" "text", "p_email_contato" "text", "p_outras_redes" "jsonb", "p_mostrar_nome" boolean, "p_mostrar_whatsapp" boolean, "p_mostrar_instagram" boolean, "p_mostrar_site" boolean, "p_mostrar_email" boolean, "p_mostrar_outras_redes" boolean) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."seating_maps_sem_cpf"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."seating_maps_sem_cpf"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."staff_profiles_registra_pagamento"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."staff_profiles_updated_at"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."team_aceitar_convite"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."team_aceitar_convite"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."team_aceitar_convite"("p_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."team_contagem"("p_event_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."team_contagem"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."team_contagem"("p_event_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."team_convidar"("p_email" "text", "p_role" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."team_convidar"("p_email" "text", "p_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."team_convidar"("p_email" "text", "p_role" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."team_convite_email_reservar"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."team_convite_email_reservar"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."team_convite_email_reservar"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."team_convite_email_resultado"("p_producer" "uuid", "p_user" "uuid", "p_reserva" timestamp with time zone, "p_ok" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."team_convite_email_resultado"("p_producer" "uuid", "p_user" "uuid", "p_reserva" timestamp with time zone, "p_ok" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."team_eventos"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."team_eventos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."team_eventos"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."team_lista"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."team_lista"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."team_lista"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."team_lista_ingressos"("p_event_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."team_lista_ingressos"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."team_lista_ingressos"("p_event_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."team_meus_convites"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."team_meus_convites"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."team_meus_convites"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."tem_ingresso"("p_event" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tem_ingresso"("p_event" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."tem_ingresso"("p_event" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ticket_types_cpf_sem_mapa"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ticket_types_cpf_sem_mapa"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."ticket_types_sem_meia_mesa"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ticket_types_sem_meia_mesa"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."tipo_no_mapa"("p_tt" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tipo_no_mapa"("p_tt" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."venda_bloqueada"("p_ticket_type" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."venda_bloqueada"("p_ticket_type" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."vincular_afiliado"("p_email" "text", "p_evento" "uuid", "p_comissao" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."vincular_afiliado"("p_email" "text", "p_evento" "uuid", "p_comissao" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vincular_afiliado"("p_email" "text", "p_evento" "uuid", "p_comissao" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."vitrine_ingressos"("p_event_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."vitrine_ingressos"("p_event_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."vitrine_ingressos"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."vitrine_ingressos"("p_event_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."withdrawals_quem_processou"() FROM PUBLIC;












SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;









GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."academy_courses" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."academy_courses" TO "authenticated";
GRANT ALL ON TABLE "public"."academy_courses" TO "service_role";



GRANT ALL ON TABLE "public"."access_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."admin_audit_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."admin_audit_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."admin_audit_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."admin_invites" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."affiliate_coupon_requests" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."affiliate_coupon_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."affiliate_coupon_requests" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."affiliate_links" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."affiliate_links" TO "authenticated";
GRANT ALL ON TABLE "public"."affiliate_links" TO "service_role";



GRANT REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."affiliates" TO "anon";
GRANT REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."affiliates" TO "authenticated";
GRANT ALL ON TABLE "public"."affiliates" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."affiliates" TO "authenticated";



GRANT SELECT("producer_id") ON TABLE "public"."affiliates" TO "authenticated";



GRANT SELECT("event_id") ON TABLE "public"."affiliates" TO "authenticated";



GRANT SELECT("commission_percent"),UPDATE("commission_percent") ON TABLE "public"."affiliates" TO "authenticated";



GRANT SELECT("sales") ON TABLE "public"."affiliates" TO "authenticated";



GRANT SELECT("total_earned") ON TABLE "public"."affiliates" TO "authenticated";



GRANT SELECT("status"),UPDATE("status") ON TABLE "public"."affiliates" TO "authenticated";



GRANT SELECT("created_at") ON TABLE "public"."affiliates" TO "authenticated";



GRANT ALL ON TABLE "public"."afiliado_tentativas" TO "service_role";



GRANT ALL ON SEQUENCE "public"."afiliado_tentativas_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."afiliado_tentativas_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."afiliado_tentativas_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."ai_credit_grants" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."ai_credit_grants" TO "authenticated";



GRANT ALL ON TABLE "public"."ai_settings" TO "service_role";
GRANT SELECT,UPDATE ON TABLE "public"."ai_settings" TO "authenticated";



GRANT ALL ON TABLE "public"."ai_usage" TO "service_role";
GRANT SELECT ON TABLE "public"."ai_usage" TO "authenticated";



GRANT ALL ON TABLE "public"."beneficios_uf" TO "service_role";
GRANT SELECT ON TABLE "public"."beneficios_uf" TO "anon";
GRANT SELECT ON TABLE "public"."beneficios_uf" TO "authenticated";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."certificates" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."certificates" TO "authenticated";
GRANT ALL ON TABLE "public"."certificates" TO "service_role";



GRANT ALL ON TABLE "public"."chat_contacts" TO "service_role";
GRANT SELECT ON TABLE "public"."chat_contacts" TO "authenticated";



GRANT ALL ON TABLE "public"."chat_departments" TO "service_role";
GRANT SELECT ON TABLE "public"."chat_departments" TO "authenticated";



GRANT ALL ON TABLE "public"."chat_settings" TO "service_role";
GRANT SELECT ON TABLE "public"."chat_settings" TO "authenticated";



GRANT ALL ON TABLE "public"."chat_topics" TO "service_role";
GRANT SELECT ON TABLE "public"."chat_topics" TO "authenticated";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."check_ins" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."check_ins" TO "authenticated";
GRANT ALL ON TABLE "public"."check_ins" TO "service_role";



GRANT ALL ON TABLE "public"."collective_tables" TO "service_role";



GRANT SELECT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."contact_messages" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."contact_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_messages" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."contact_rate_limit_hits" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."contact_rate_limit_hits" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_rate_limit_hits" TO "service_role";



GRANT ALL ON SEQUENCE "public"."contact_rate_limit_hits_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."contact_rate_limit_hits_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."contact_rate_limit_hits_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_messages" TO "service_role";
GRANT SELECT ON TABLE "public"."conversation_messages" TO "authenticated";



GRANT ALL ON TABLE "public"."conversations" TO "service_role";
GRANT SELECT ON TABLE "public"."conversations" TO "authenticated";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."coupons" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."coupons" TO "authenticated";
GRANT ALL ON TABLE "public"."coupons" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."crm_interactions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."crm_interactions" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_interactions" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."crm_leads" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."crm_leads" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_leads" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."crm_tasks" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."crm_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_tasks" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."customers" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON TABLE "public"."email_logs" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."event_banners" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."event_banners" TO "authenticated";
GRANT ALL ON TABLE "public"."event_banners" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."event_budget_boxes" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN ON TABLE "public"."event_budget_boxes" TO "authenticated";
GRANT ALL ON TABLE "public"."event_budget_boxes" TO "service_role";



GRANT UPDATE("event_id") ON TABLE "public"."event_budget_boxes" TO "authenticated";



GRANT UPDATE("name") ON TABLE "public"."event_budget_boxes" TO "authenticated";



GRANT UPDATE("target") ON TABLE "public"."event_budget_boxes" TO "authenticated";



GRANT UPDATE("category") ON TABLE "public"."event_budget_boxes" TO "authenticated";



GRANT UPDATE("notes") ON TABLE "public"."event_budget_boxes" TO "authenticated";



GRANT UPDATE("updated_at") ON TABLE "public"."event_budget_boxes" TO "authenticated";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."event_photos" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."event_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."event_photos" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."event_reviews" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."event_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."event_reviews" TO "service_role";



GRANT REFERENCES,DELETE,TRIGGER,MAINTAIN ON TABLE "public"."orders" TO "anon";
GRANT REFERENCES,DELETE,TRIGGER,MAINTAIN ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."orders" TO "authenticated";



GRANT SELECT("user_id") ON TABLE "public"."orders" TO "authenticated";



GRANT SELECT("event_id") ON TABLE "public"."orders" TO "authenticated";



GRANT SELECT("coupon_id") ON TABLE "public"."orders" TO "authenticated";



GRANT SELECT("subtotal") ON TABLE "public"."orders" TO "authenticated";



GRANT SELECT("discount") ON TABLE "public"."orders" TO "authenticated";



GRANT SELECT("service_fee") ON TABLE "public"."orders" TO "authenticated";



GRANT SELECT("processing_fee") ON TABLE "public"."orders" TO "authenticated";



GRANT SELECT("total") ON TABLE "public"."orders" TO "authenticated";



GRANT SELECT("status") ON TABLE "public"."orders" TO "authenticated";



GRANT SELECT("payment_method") ON TABLE "public"."orders" TO "authenticated";



GRANT SELECT("payment_gateway") ON TABLE "public"."orders" TO "authenticated";



GRANT SELECT("gateway_payment_id") ON TABLE "public"."orders" TO "authenticated";



GRANT SELECT("customer_name") ON TABLE "public"."orders" TO "authenticated";



GRANT SELECT("customer_email") ON TABLE "public"."orders" TO "authenticated";



GRANT SELECT("created_at") ON TABLE "public"."orders" TO "authenticated";



GRANT SELECT("updated_at") ON TABLE "public"."orders" TO "authenticated";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN ON TABLE "public"."ticket_types" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN ON TABLE "public"."ticket_types" TO "authenticated";
GRANT ALL ON TABLE "public"."ticket_types" TO "service_role";



GRANT UPDATE("name") ON TABLE "public"."ticket_types" TO "authenticated";



GRANT UPDATE("description") ON TABLE "public"."ticket_types" TO "authenticated";



GRANT UPDATE("price") ON TABLE "public"."ticket_types" TO "authenticated";



GRANT UPDATE("capacity") ON TABLE "public"."ticket_types" TO "authenticated";



GRANT UPDATE("quantity_total") ON TABLE "public"."ticket_types" TO "authenticated";



GRANT UPDATE("min_per_order") ON TABLE "public"."ticket_types" TO "authenticated";



GRANT UPDATE("max_per_order") ON TABLE "public"."ticket_types" TO "authenticated";



GRANT UPDATE("valid_from") ON TABLE "public"."ticket_types" TO "authenticated";



GRANT UPDATE("valid_until") ON TABLE "public"."ticket_types" TO "authenticated";



GRANT UPDATE("sale_start") ON TABLE "public"."ticket_types" TO "authenticated";



GRANT UPDATE("sale_end") ON TABLE "public"."ticket_types" TO "authenticated";



GRANT UPDATE("perks") ON TABLE "public"."ticket_types" TO "authenticated";



GRANT UPDATE("perks_array") ON TABLE "public"."ticket_types" TO "authenticated";



GRANT UPDATE("type") ON TABLE "public"."ticket_types" TO "authenticated";



GRANT UPDATE("sort_order") ON TABLE "public"."ticket_types" TO "authenticated";



GRANT UPDATE("is_active") ON TABLE "public"."ticket_types" TO "authenticated";



GRANT UPDATE("inclui_bebida") ON TABLE "public"."ticket_types" TO "authenticated";



GRANT UPDATE("max_por_cpf") ON TABLE "public"."ticket_types" TO "authenticated";



GRANT UPDATE("permite_meia") ON TABLE "public"."ticket_types" TO "authenticated";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."event_summary" TO "anon";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."event_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."event_summary" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."event_surveys" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."event_surveys" TO "authenticated";
GRANT ALL ON TABLE "public"."event_surveys" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."event_timeline_items" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."event_timeline_items" TO "authenticated";
GRANT ALL ON TABLE "public"."event_timeline_items" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."event_zones" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."event_zones" TO "authenticated";
GRANT ALL ON TABLE "public"."event_zones" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."evento_aceites" TO "service_role";
GRANT SELECT ON TABLE "public"."evento_aceites" TO "authenticated";



GRANT ALL ON TABLE "public"."evento_privado" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."evento_privado" TO "authenticated";



GRANT ALL ON TABLE "public"."favoritos" TO "service_role";
GRANT SELECT,DELETE ON TABLE "public"."favoritos" TO "authenticated";



GRANT INSERT("user_id") ON TABLE "public"."favoritos" TO "authenticated";



GRANT INSERT("event_id") ON TABLE "public"."favoritos" TO "authenticated";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."feedback" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback" TO "service_role";



GRANT ALL ON TABLE "public"."interest_lists" TO "service_role";
GRANT SELECT ON TABLE "public"."interest_lists" TO "authenticated";



GRANT SELECT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."issued_certificates" TO "anon";
GRANT SELECT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."issued_certificates" TO "authenticated";
GRANT ALL ON TABLE "public"."issued_certificates" TO "service_role";



GRANT INSERT("certificate_id") ON TABLE "public"."issued_certificates" TO "authenticated";



GRANT INSERT("user_id") ON TABLE "public"."issued_certificates" TO "authenticated";



GRANT ALL ON TABLE "public"."kb_articles" TO "service_role";
GRANT SELECT,DELETE ON TABLE "public"."kb_articles" TO "authenticated";



GRANT INSERT("title"),UPDATE("title") ON TABLE "public"."kb_articles" TO "authenticated";



GRANT INSERT("body"),UPDATE("body") ON TABLE "public"."kb_articles" TO "authenticated";



GRANT INSERT("keywords"),UPDATE("keywords") ON TABLE "public"."kb_articles" TO "authenticated";



GRANT INSERT("audience"),UPDATE("audience") ON TABLE "public"."kb_articles" TO "authenticated";



GRANT INSERT("department_id"),UPDATE("department_id") ON TABLE "public"."kb_articles" TO "authenticated";



GRANT INSERT("status"),UPDATE("status") ON TABLE "public"."kb_articles" TO "authenticated";



GRANT INSERT("origin") ON TABLE "public"."kb_articles" TO "authenticated";



GRANT INSERT("source_conversation_id") ON TABLE "public"."kb_articles" TO "authenticated";



GRANT INSERT("created_by") ON TABLE "public"."kb_articles" TO "authenticated";



GRANT UPDATE("updated_at") ON TABLE "public"."kb_articles" TO "authenticated";



GRANT ALL ON TABLE "public"."kb_perguntas_sem_resposta" TO "service_role";
GRANT SELECT,DELETE ON TABLE "public"."kb_perguntas_sem_resposta" TO "authenticated";



GRANT ALL ON TABLE "public"."kb_slugs_excluidos" TO "service_role";



GRANT ALL ON TABLE "public"."kb_termos" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."kb_termos" TO "authenticated";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."menu_items" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."menu_items" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_items" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."menu_order_items" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."menu_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_order_items" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."menu_orders" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."menu_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_orders" TO "service_role";



GRANT ALL ON TABLE "public"."mesa_avisos" TO "service_role";



GRANT ALL ON TABLE "public"."mesa_consentimentos" TO "service_role";



GRANT ALL ON TABLE "public"."mesa_denuncias" TO "service_role";



GRANT ALL ON TABLE "public"."mesa_moderacoes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."mesa_moderacoes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."mesa_moderacoes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."mesa_moderacoes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."mesa_passagens" TO "service_role";



GRANT ALL ON TABLE "public"."mesa_travas" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."messages" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT SELECT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."newsletter_subscribers" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."newsletter_subscribers" TO "authenticated";
GRANT ALL ON TABLE "public"."newsletter_subscribers" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."newsletters" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."newsletters" TO "authenticated";
GRANT ALL ON TABLE "public"."newsletters" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "service_role";
GRANT SELECT,DELETE ON TABLE "public"."notifications" TO "authenticated";



GRANT UPDATE("is_read") ON TABLE "public"."notifications" TO "authenticated";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."onboarding_logs" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."onboarding_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."onboarding_logs" TO "service_role";



GRANT SELECT,REFERENCES,DELETE,TRIGGER,MAINTAIN ON TABLE "public"."order_items" TO "anon";
GRANT SELECT,REFERENCES,DELETE,TRIGGER,MAINTAIN ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."partners" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."partners" TO "authenticated";
GRANT ALL ON TABLE "public"."partners" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."payments" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."pedido_assentos" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."piggy_transactions" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."piggy_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."piggy_transactions" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."platform_affiliate_producers" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."platform_affiliate_producers" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_affiliate_producers" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."platform_affiliates" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."platform_affiliates" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_affiliates" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."platform_settings" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."platform_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_settings" TO "service_role";



GRANT ALL ON TABLE "public"."policy_notices" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."producer_profiles" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."producer_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."producer_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."producer_public" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."producer_subscriptions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."producer_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."producer_subscriptions" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."producer_tasks" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."producer_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."producer_tasks" TO "service_role";



GRANT REFERENCES,DELETE,TRIGGER,MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT REFERENCES,DELETE,TRIGGER,MAINTAIN ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT SELECT("id"),INSERT("id"),UPDATE("id") ON TABLE "public"."profiles" TO "authenticated";
GRANT INSERT("id"),UPDATE("id") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("email"),INSERT("email"),UPDATE("email") ON TABLE "public"."profiles" TO "authenticated";
GRANT INSERT("email"),UPDATE("email") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("full_name"),INSERT("full_name"),UPDATE("full_name") ON TABLE "public"."profiles" TO "authenticated";
GRANT INSERT("full_name"),UPDATE("full_name") ON TABLE "public"."profiles" TO "anon";



GRANT INSERT("phone"),UPDATE("phone") ON TABLE "public"."profiles" TO "anon";
GRANT INSERT("phone"),UPDATE("phone") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("avatar_url"),INSERT("avatar_url"),UPDATE("avatar_url") ON TABLE "public"."profiles" TO "authenticated";
GRANT INSERT("avatar_url"),UPDATE("avatar_url") ON TABLE "public"."profiles" TO "anon";



GRANT INSERT("bio"),UPDATE("bio") ON TABLE "public"."profiles" TO "anon";
GRANT INSERT("bio"),UPDATE("bio") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("city"),UPDATE("city") ON TABLE "public"."profiles" TO "anon";
GRANT INSERT("city"),UPDATE("city") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("birth_date"),UPDATE("birth_date") ON TABLE "public"."profiles" TO "anon";
GRANT INSERT("birth_date"),UPDATE("birth_date") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("instagram"),UPDATE("instagram") ON TABLE "public"."profiles" TO "anon";
GRANT INSERT("instagram"),UPDATE("instagram") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("tiktok"),UPDATE("tiktok") ON TABLE "public"."profiles" TO "anon";
GRANT INSERT("tiktok"),UPDATE("tiktok") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("linkedin"),UPDATE("linkedin") ON TABLE "public"."profiles" TO "anon";
GRANT INSERT("linkedin"),UPDATE("linkedin") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("role"),INSERT("role"),UPDATE("role") ON TABLE "public"."profiles" TO "authenticated";
GRANT INSERT("role"),UPDATE("role") ON TABLE "public"."profiles" TO "anon";



GRANT INSERT("stripe_customer_id"),UPDATE("stripe_customer_id") ON TABLE "public"."profiles" TO "anon";
GRANT INSERT("stripe_customer_id"),UPDATE("stripe_customer_id") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("is_verified"),UPDATE("is_verified") ON TABLE "public"."profiles" TO "anon";
GRANT INSERT("is_verified"),UPDATE("is_verified") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("created_at"),INSERT("created_at"),UPDATE("created_at") ON TABLE "public"."profiles" TO "authenticated";
GRANT INSERT("created_at"),UPDATE("created_at") ON TABLE "public"."profiles" TO "anon";



GRANT INSERT("updated_at"),UPDATE("updated_at") ON TABLE "public"."profiles" TO "anon";
GRANT INSERT("updated_at"),UPDATE("updated_at") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("website"),UPDATE("website") ON TABLE "public"."profiles" TO "anon";
GRANT INSERT("website"),UPDATE("website") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("admin_permissions"),UPDATE("admin_permissions") ON TABLE "public"."profiles" TO "anon";
GRANT INSERT("admin_permissions"),UPDATE("admin_permissions") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("avatar_moderacao"),INSERT("avatar_moderacao"),UPDATE("avatar_moderacao") ON TABLE "public"."profiles" TO "authenticated";
GRANT INSERT("avatar_moderacao"),UPDATE("avatar_moderacao") ON TABLE "public"."profiles" TO "anon";



GRANT INSERT("avatar_moderado_em"),UPDATE("avatar_moderado_em") ON TABLE "public"."profiles" TO "anon";
GRANT INSERT("avatar_moderado_em"),UPDATE("avatar_moderado_em") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("avatar_moderacao_hash"),UPDATE("avatar_moderacao_hash") ON TABLE "public"."profiles" TO "anon";
GRANT INSERT("avatar_moderacao_hash"),UPDATE("avatar_moderacao_hash") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("avatar_moderacao_tentativas"),UPDATE("avatar_moderacao_tentativas") ON TABLE "public"."profiles" TO "anon";
GRANT INSERT("avatar_moderacao_tentativas"),UPDATE("avatar_moderacao_tentativas") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("avatar_moderacao_reservada_ate"),UPDATE("avatar_moderacao_reservada_ate") ON TABLE "public"."profiles" TO "anon";
GRANT INSERT("avatar_moderacao_reservada_ate"),UPDATE("avatar_moderacao_reservada_ate") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("cpf_enc"),UPDATE("cpf_enc") ON TABLE "public"."profiles" TO "anon";
GRANT INSERT("cpf_enc"),UPDATE("cpf_enc") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."purchases" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."purchases" TO "authenticated";
GRANT ALL ON TABLE "public"."purchases" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."revenue_advances" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."revenue_advances" TO "authenticated";
GRANT ALL ON TABLE "public"."revenue_advances" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."seating_maps" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."seating_maps" TO "authenticated";
GRANT ALL ON TABLE "public"."seating_maps" TO "service_role";



GRANT ALL ON TABLE "public"."staff_profiles" TO "service_role";
GRANT SELECT ON TABLE "public"."staff_profiles" TO "authenticated";



GRANT UPDATE("nome_completo") ON TABLE "public"."staff_profiles" TO "authenticated";



GRANT UPDATE("data_nascimento") ON TABLE "public"."staff_profiles" TO "authenticated";



GRANT UPDATE("cep") ON TABLE "public"."staff_profiles" TO "authenticated";



GRANT UPDATE("rua") ON TABLE "public"."staff_profiles" TO "authenticated";



GRANT UPDATE("numero") ON TABLE "public"."staff_profiles" TO "authenticated";



GRANT UPDATE("complemento") ON TABLE "public"."staff_profiles" TO "authenticated";



GRANT UPDATE("bairro") ON TABLE "public"."staff_profiles" TO "authenticated";



GRANT UPDATE("cidade") ON TABLE "public"."staff_profiles" TO "authenticated";



GRANT UPDATE("uf") ON TABLE "public"."staff_profiles" TO "authenticated";



GRANT UPDATE("email_secundario") ON TABLE "public"."staff_profiles" TO "authenticated";



GRANT UPDATE("telefone") ON TABLE "public"."staff_profiles" TO "authenticated";



GRANT UPDATE("whatsapp") ON TABLE "public"."staff_profiles" TO "authenticated";



GRANT UPDATE("emergencia_nome") ON TABLE "public"."staff_profiles" TO "authenticated";



GRANT UPDATE("emergencia_parentesco") ON TABLE "public"."staff_profiles" TO "authenticated";



GRANT UPDATE("emergencia_telefone") ON TABLE "public"."staff_profiles" TO "authenticated";



GRANT DELETE ON TABLE "public"."staff_profiles_acessos" TO "service_role";



GRANT SELECT("colaborador") ON TABLE "public"."staff_profiles_acessos" TO "service_role";



GRANT ALL ON SEQUENCE "public"."staff_profiles_acessos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."staff_profiles_acessos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."staff_profiles_acessos_id_seq" TO "service_role";



GRANT DELETE ON TABLE "public"."staff_profiles_historico_pagamento" TO "service_role";



GRANT SELECT("user_id") ON TABLE "public"."staff_profiles_historico_pagamento" TO "service_role";



GRANT ALL ON SEQUENCE "public"."staff_profiles_historico_pagamento_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."staff_profiles_historico_pagamento_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."staff_profiles_historico_pagamento_id_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN ON TABLE "public"."support_messages" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN ON TABLE "public"."support_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."support_messages" TO "service_role";



GRANT UPDATE("read_at") ON TABLE "public"."support_messages" TO "authenticated";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."support_sessions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."support_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."support_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."table_members" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."tasks" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."team_convite_email" TO "service_role";



GRANT ALL ON TABLE "public"."team_convite_tentativas" TO "service_role";



GRANT ALL ON TABLE "public"."team_members" TO "service_role";
GRANT SELECT,DELETE ON TABLE "public"."team_members" TO "authenticated";



GRANT UPDATE("role") ON TABLE "public"."team_members" TO "authenticated";



GRANT UPDATE("blocked_at") ON TABLE "public"."team_members" TO "authenticated";



GRANT ALL ON TABLE "public"."tentativas_reserva" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tentativas_reserva_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tentativas_reserva_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tentativas_reserva_id_seq" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."tickets" TO "anon";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."tickets" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."tickets" TO "authenticated";



GRANT SELECT("order_item_id") ON TABLE "public"."tickets" TO "authenticated";



GRANT SELECT("order_id") ON TABLE "public"."tickets" TO "authenticated";



GRANT SELECT("ticket_type_id") ON TABLE "public"."tickets" TO "authenticated";



GRANT SELECT("event_id") ON TABLE "public"."tickets" TO "authenticated";



GRANT SELECT("user_id") ON TABLE "public"."tickets" TO "authenticated";



GRANT SELECT("buyer_name") ON TABLE "public"."tickets" TO "authenticated";



GRANT SELECT("buyer_email") ON TABLE "public"."tickets" TO "authenticated";



GRANT SELECT("qr_code") ON TABLE "public"."tickets" TO "authenticated";



GRANT SELECT("status") ON TABLE "public"."tickets" TO "authenticated";



GRANT SELECT("price_paid") ON TABLE "public"."tickets" TO "authenticated";



GRANT SELECT("checked_in_at") ON TABLE "public"."tickets" TO "authenticated";



GRANT SELECT("checked_in_by") ON TABLE "public"."tickets" TO "authenticated";



GRANT SELECT("transferred_to") ON TABLE "public"."tickets" TO "authenticated";



GRANT SELECT("transfer_count") ON TABLE "public"."tickets" TO "authenticated";



GRANT SELECT("created_at") ON TABLE "public"."tickets" TO "authenticated";



GRANT SELECT("updated_at") ON TABLE "public"."tickets" TO "authenticated";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."transactions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



GRANT ALL ON TABLE "public"."user_activities" TO "service_role";
GRANT INSERT ON TABLE "public"."user_activities" TO "anon";
GRANT SELECT,INSERT ON TABLE "public"."user_activities" TO "authenticated";



GRANT ALL ON TABLE "public"."user_consents" TO "service_role";
GRANT SELECT ON TABLE "public"."user_consents" TO "authenticated";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."user_course_progress" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."user_course_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."user_course_progress" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."user_custom_features" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."user_custom_features" TO "authenticated";
GRANT ALL ON TABLE "public"."user_custom_features" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."user_preferences" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."user_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_preferences" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."user_profiles_ext" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."user_profiles_ext" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles_ext" TO "service_role";



GRANT ALL ON TABLE "public"."webhook_events" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."withdrawals" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."withdrawals" TO "authenticated";
GRANT ALL ON TABLE "public"."withdrawals" TO "service_role";



GRANT SELECT ON TABLE "public"."withdrawals_acessos" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" REVOKE ALL ON FUNCTIONS FROM PUBLIC;

-- ===== Completado fora de public (auth, storage, event trigger) =====
-- O retrato de public não inclui estes objetos; o teste pgTAP e o app dependem deles.
-- Definições copiadas da produção por consulta somente leitura em 2026-09-30.
-- Dados ficam de fora: jobs do pg_cron, segredos do Vault e arquivos do Storage não são versionados.

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('chat-anexos', 'chat-anexos', 'f', 10485760, '{image/jpeg,image/png,image/webp,application/pdf}') on conflict (id) do nothing;

create policy chat_anexos_insert on storage.objects as PERMISSIVE for INSERT to authenticated

  with check (((bucket_id = 'chat-anexos'::text) AND public.chat_can_upload(name)));

create policy chat_anexos_select on storage.objects as PERMISSIVE for SELECT to authenticated

  using (((bucket_id = 'chat-anexos'::text) AND (public.chat_role_path(name) IS NOT NULL)));

create policy gf_mfa_aal2 on storage.objects as RESTRICTIVE for ALL to authenticated

  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))

  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));

create event trigger ensure_rls on ddl_command_end when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO') execute function public.rls_auto_enable();

-- A materialized view nasce vazia; preencher para consultas locais.
refresh materialized view public.event_summary;
