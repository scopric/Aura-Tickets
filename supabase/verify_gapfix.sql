-- =============================================================================
-- Verificação do gapfix — rode no SQL Editor do Supabase APÓS aplicar
-- 20260614120000_gapfix_missing_tables.sql
-- Espera-se que cada tabela apareça com rowsecurity = true e tenha policies.
-- =============================================================================

-- 1) Tabelas existem + RLS habilitado?
select c.relname as tabela,
       c.relrowsecurity as rls_habilitado
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'event_banners','event_photos','event_timeline_items','event_surveys',
    'event_zones','event_budget_boxes','piggy_transactions','revenue_advances',
    'academy_courses','user_course_progress','tasks','contact_messages',
    'customers','onboarding_logs','user_custom_features','support_sessions',
    'support_messages','user_profiles_ext','user_preferences'
  )
order by c.relname;

-- 2) Quantas policies por tabela?
select tablename, count(*) as policies
from pg_policies
where schemaname = 'public'
  and tablename in (
    'event_banners','event_photos','event_timeline_items','event_surveys',
    'event_zones','event_budget_boxes','piggy_transactions','revenue_advances',
    'academy_courses','user_course_progress','tasks','contact_messages',
    'customers','onboarding_logs','user_custom_features','support_sessions',
    'support_messages','user_profiles_ext','user_preferences'
  )
group by tablename
order by tablename;

-- 3) Colunas do icebreaker em collective_tables?
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'collective_tables'
  and column_name in ('icebreaker_question','icebreaker_sent_at');

-- 4) View de resumo existe?
select table_name
from information_schema.views
where table_schema = 'public' and table_name = 'collective_table_summary';
