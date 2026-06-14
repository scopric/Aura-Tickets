-- =============================================================================
-- Gapfix: tabelas que o frontend já consulta mas que podem não existir no banco
-- =============================================================================
-- Derivado do uso REAL nos hooks (useProducerTools, useTasks, useCRM, useContact,
-- useOnboarding, useFeatures, useMatchmaking, SupportChat, app/UserSettings).
--
-- 100% IDEMPOTENTE e SEGURO para rodar mais de uma vez:
--   - CREATE TABLE IF NOT EXISTS  (não recria/apaga tabelas existentes)
--   - políticas com nomes próprios (prefixo gf_) + DROP POLICY IF EXISTS
--   - ENABLE ROW LEVEL SECURITY é no-op se já estiver habilitado
--
-- NÃO inclui cities/states (já cobertos por 00000000000010_brazilian_geography.sql).
-- collective_tables / table_members já existem: aqui só adicionamos colunas faltantes.
--
-- OBS: se alguma destas tabelas já existir com colunas diferentes, revise antes de
-- aplicar. O objetivo é alinhar o banco ao que o código espera.
-- =============================================================================

-- Helper de admin (idempotente)
create or replace function public.gf_is_admin()
returns boolean
language sql stable
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- =============================================================================
-- 1) EVENT_BANNERS  (dono: producer_id)
-- =============================================================================
create table if not exists public.event_banners (
  id uuid primary key default gen_random_uuid(),
  producer_id uuid references public.profiles(id) on delete cascade,
  event_name text,
  name text,
  image_url text,
  position text default 'inline',
  active boolean default true,
  clicks numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.event_banners enable row level security;
drop policy if exists gf_event_banners_all on public.event_banners;
create policy gf_event_banners_all on public.event_banners
  for all using (producer_id = auth.uid() or public.gf_is_admin())
  with check (producer_id = auth.uid() or public.gf_is_admin());

-- =============================================================================
-- 2) EVENT_PHOTOS  (dono: producer_id)
-- =============================================================================
create table if not exists public.event_photos (
  id uuid primary key default gen_random_uuid(),
  producer_id uuid references public.profiles(id) on delete cascade,
  event_name text,
  url text,
  caption text,
  likes numeric default 0,
  comments numeric default 0,
  featured boolean default false,
  size text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.event_photos enable row level security;
drop policy if exists gf_event_photos_all on public.event_photos;
create policy gf_event_photos_all on public.event_photos
  for all using (producer_id = auth.uid() or public.gf_is_admin())
  with check (producer_id = auth.uid() or public.gf_is_admin());

-- =============================================================================
-- 3) EVENT_TIMELINE_ITEMS  (dono: producer_id; filtra por event_id)
-- =============================================================================
create table if not exists public.event_timeline_items (
  id uuid primary key default gen_random_uuid(),
  producer_id uuid references public.profiles(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  time text,
  title text,
  description text,
  type text,
  responsible text,
  status text default 'futuro',
  duration text,
  location text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.event_timeline_items enable row level security;
drop policy if exists gf_event_timeline_all on public.event_timeline_items;
create policy gf_event_timeline_all on public.event_timeline_items
  for all using (producer_id = auth.uid() or public.gf_is_admin())
  with check (producer_id = auth.uid() or public.gf_is_admin());

-- =============================================================================
-- 4) EVENT_SURVEYS  (dono: via event_id -> events.producer_id)
-- =============================================================================
create table if not exists public.event_surveys (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  participant_email text,
  score numeric,
  comment text,
  zone text,
  created_at timestamptz default now()
);
alter table public.event_surveys enable row level security;
drop policy if exists gf_event_surveys_owner on public.event_surveys;
create policy gf_event_surveys_owner on public.event_surveys
  for all using (
    public.gf_is_admin()
    or event_id in (select id from public.events where producer_id = auth.uid())
  )
  with check (
    public.gf_is_admin()
    or event_id in (select id from public.events where producer_id = auth.uid())
  );
-- participantes autenticados podem responder (insert)
drop policy if exists gf_event_surveys_insert on public.event_surveys;
create policy gf_event_surveys_insert on public.event_surveys
  for insert with check (auth.uid() is not null);

-- =============================================================================
-- 5) EVENT_ZONES  (dono: via event_id)
-- =============================================================================
create table if not exists public.event_zones (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  name text,
  avg_time_minutes numeric default 0,
  satisfaction_score numeric default 0,
  expected_visitors numeric default 0,
  created_at timestamptz default now()
);
alter table public.event_zones enable row level security;
drop policy if exists gf_event_zones_owner on public.event_zones;
create policy gf_event_zones_owner on public.event_zones
  for all using (
    public.gf_is_admin()
    or event_id in (select id from public.events where producer_id = auth.uid())
  )
  with check (
    public.gf_is_admin()
    or event_id in (select id from public.events where producer_id = auth.uid())
  );

-- =============================================================================
-- 6) EVENT_BUDGET_BOXES  (caixinha; dono: producer_id)
-- =============================================================================
create table if not exists public.event_budget_boxes (
  id uuid primary key default gen_random_uuid(),
  producer_id uuid references public.profiles(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  name text,
  target numeric default 0,
  saved numeric default 0,
  category text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.event_budget_boxes enable row level security;
drop policy if exists gf_budget_boxes_all on public.event_budget_boxes;
create policy gf_budget_boxes_all on public.event_budget_boxes
  for all using (producer_id = auth.uid() or public.gf_is_admin())
  with check (producer_id = auth.uid() or public.gf_is_admin());

-- =============================================================================
-- 7) PIGGY_TRANSACTIONS  (dono: via box_id -> event_budget_boxes.producer_id)
-- =============================================================================
create table if not exists public.piggy_transactions (
  id uuid primary key default gen_random_uuid(),
  box_id uuid references public.event_budget_boxes(id) on delete cascade,
  type text,
  amount numeric default 0,
  note text,
  created_at timestamptz default now()
);
alter table public.piggy_transactions enable row level security;
drop policy if exists gf_piggy_tx_owner on public.piggy_transactions;
create policy gf_piggy_tx_owner on public.piggy_transactions
  for all using (
    public.gf_is_admin()
    or box_id in (select id from public.event_budget_boxes where producer_id = auth.uid())
  )
  with check (
    public.gf_is_admin()
    or box_id in (select id from public.event_budget_boxes where producer_id = auth.uid())
  );

-- =============================================================================
-- 8) REVENUE_ADVANCES  (antecipação; dono: producer_id)
-- =============================================================================
create table if not exists public.revenue_advances (
  id uuid primary key default gen_random_uuid(),
  producer_id uuid references public.profiles(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  amount numeric default 0,
  fee_pct numeric default 0,
  fee_amount numeric default 0,
  iof_amount numeric default 0,
  net_amount numeric default 0,
  days numeric default 0,
  status text default 'requested',
  requested_at timestamptz default now(),
  transferred_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.revenue_advances enable row level security;
drop policy if exists gf_revenue_advances_all on public.revenue_advances;
create policy gf_revenue_advances_all on public.revenue_advances
  for all using (producer_id = auth.uid() or public.gf_is_admin())
  with check (producer_id = auth.uid() or public.gf_is_admin());

-- =============================================================================
-- 9) ACADEMY_COURSES  (catálogo público) + USER_COURSE_PROGRESS (dono: user_id)
-- =============================================================================
create table if not exists public.academy_courses (
  id uuid primary key default gen_random_uuid(),
  title text,
  description text,
  instructor text,
  duration text,
  lessons numeric default 0,
  level text,
  category text,
  students numeric default 0,
  rating numeric default 0,
  locked boolean default false,
  created_at timestamptz default now()
);
alter table public.academy_courses enable row level security;
drop policy if exists gf_academy_read on public.academy_courses;
create policy gf_academy_read on public.academy_courses
  for select using (true);
drop policy if exists gf_academy_admin_write on public.academy_courses;
create policy gf_academy_admin_write on public.academy_courses
  for all using (public.gf_is_admin()) with check (public.gf_is_admin());

create table if not exists public.user_course_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  course_id uuid references public.academy_courses(id) on delete cascade,
  progress numeric default 0,
  completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.user_course_progress enable row level security;
drop policy if exists gf_course_progress_all on public.user_course_progress;
create policy gf_course_progress_all on public.user_course_progress
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =============================================================================
-- 10) TASKS  (dono: via event_id)
-- =============================================================================
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  title text,
  description text,
  assignee_id uuid references public.profiles(id) on delete set null,
  status text default 'todo',
  priority text default 'medium',
  due_date timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.tasks enable row level security;
drop policy if exists gf_tasks_owner on public.tasks;
create policy gf_tasks_owner on public.tasks
  for all using (
    public.gf_is_admin()
    or assignee_id = auth.uid()
    or event_id in (select id from public.events where producer_id = auth.uid())
  )
  with check (
    public.gf_is_admin()
    or event_id in (select id from public.events where producer_id = auth.uid())
  );

-- =============================================================================
-- 11) CONTACT_MESSAGES  (formulário público; insert por qualquer um, leitura admin)
-- =============================================================================
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  phone text,
  subject text default 'Contato via site',
  message text,
  page text,
  created_at timestamptz default now()
);
alter table public.contact_messages enable row level security;
drop policy if exists gf_contact_insert on public.contact_messages;
create policy gf_contact_insert on public.contact_messages
  for insert with check (true);
drop policy if exists gf_contact_admin_read on public.contact_messages;
create policy gf_contact_admin_read on public.contact_messages
  for select using (public.gf_is_admin());

-- =============================================================================
-- 12) CUSTOMERS  (CRM; dono: via event_id)
-- =============================================================================
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  email text,
  name text,
  phone text,
  tags text[] default '{}',
  notes text,
  total_spent numeric default 0,
  events_attended numeric default 0,
  created_at timestamptz default now()
);
alter table public.customers enable row level security;
drop policy if exists gf_customers_owner on public.customers;
create policy gf_customers_owner on public.customers
  for all using (
    public.gf_is_admin()
    or event_id in (select id from public.events where producer_id = auth.uid())
  )
  with check (
    public.gf_is_admin()
    or event_id in (select id from public.events where producer_id = auth.uid())
  );

-- =============================================================================
-- 13) ONBOARDING_LOGS  (dono: user_id; append-only)
-- =============================================================================
create table if not exists public.onboarding_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  step_name text,
  step_number numeric,
  completed_at timestamptz,
  skipped boolean default false,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);
alter table public.onboarding_logs enable row level security;
drop policy if exists gf_onboarding_all on public.onboarding_logs;
create policy gf_onboarding_all on public.onboarding_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =============================================================================
-- 14) USER_CUSTOM_FEATURES  (dono: user_id; admin gerencia)
-- =============================================================================
create table if not exists public.user_custom_features (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  feature_key text,
  expires_at timestamptz,
  created_at timestamptz default now()
);
alter table public.user_custom_features enable row level security;
drop policy if exists gf_custom_features_read on public.user_custom_features;
create policy gf_custom_features_read on public.user_custom_features
  for select using (user_id = auth.uid() or public.gf_is_admin());
drop policy if exists gf_custom_features_admin_write on public.user_custom_features;
create policy gf_custom_features_admin_write on public.user_custom_features
  for all using (public.gf_is_admin()) with check (public.gf_is_admin());

-- =============================================================================
-- 15) SUPPORT_SESSIONS / SUPPORT_MESSAGES  (chat de suporte)
-- =============================================================================
create table if not exists public.support_sessions (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid,
  user_id uuid references public.profiles(id) on delete set null,
  status text default 'open',
  assigned_agent_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.support_sessions enable row level security;
drop policy if exists gf_support_sessions_owner on public.support_sessions;
create policy gf_support_sessions_owner on public.support_sessions
  for all using (user_id = auth.uid() or public.gf_is_admin())
  with check (user_id = auth.uid() or public.gf_is_admin());
-- permite criar sessão como visitante autenticado
drop policy if exists gf_support_sessions_insert on public.support_sessions;
create policy gf_support_sessions_insert on public.support_sessions
  for insert with check (auth.uid() is not null or public.gf_is_admin());

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.support_sessions(id) on delete cascade,
  sender_type text,
  sender_id uuid,
  sender_name text,
  content text,
  created_at timestamptz default now(),
  read_at timestamptz
);
alter table public.support_messages enable row level security;
drop policy if exists gf_support_messages_owner on public.support_messages;
create policy gf_support_messages_owner on public.support_messages
  for all using (
    public.gf_is_admin()
    or session_id in (select id from public.support_sessions where user_id = auth.uid())
  )
  with check (
    public.gf_is_admin()
    or session_id in (select id from public.support_sessions where user_id = auth.uid())
  );

-- =============================================================================
-- 16) USER_PROFILES_EXT  (matchmaking; dono: user_id, único)
-- =============================================================================
create table if not exists public.user_profiles_ext (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete cascade,
  temperament text,
  intention text,
  music_style text,
  energy_level text,
  birth_year numeric,
  gender text,
  bio text,
  vibe text,
  quiz_completed_at timestamptz,
  created_at timestamptz default now()
);
alter table public.user_profiles_ext enable row level security;
drop policy if exists gf_profiles_ext_owner on public.user_profiles_ext;
create policy gf_profiles_ext_owner on public.user_profiles_ext
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- leitura por outros participantes para matchmaking (somente leitura)
drop policy if exists gf_profiles_ext_read on public.user_profiles_ext;
create policy gf_profiles_ext_read on public.user_profiles_ext
  for select using (auth.uid() is not null);

-- =============================================================================
-- 17) USER_PREFERENCES  (NOVA — preferências do participante; dono: user_id)
-- =============================================================================
create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete cascade,
  genres text[] default '{}',
  event_types text[] default '{}',
  max_distance numeric default 50,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.user_preferences enable row level security;
drop policy if exists gf_user_preferences_all on public.user_preferences;
create policy gf_user_preferences_all on public.user_preferences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =============================================================================
-- 18) COLLECTIVE_TABLES: colunas faltantes usadas pelo matchmaking
-- =============================================================================
alter table public.collective_tables add column if not exists icebreaker_question text;
alter table public.collective_tables add column if not exists icebreaker_sent_at timestamptz;

-- =============================================================================
-- 19) COLLECTIVE_TABLE_SUMMARY  (VIEW: mesas + contagem de membros)
-- =============================================================================
create or replace view public.collective_table_summary as
select
  ct.id,
  ct.event_id,
  ct.ticket_type_id,
  ct.name,
  ct.theme,
  ct.capacity,
  ct.compatibility_score,
  ct.status,
  ct.created_at,
  coalesce(count(tm.id), 0) as member_count,
  greatest(ct.capacity - coalesce(count(tm.id), 0), 0) as remaining_spots
from public.collective_tables ct
left join public.table_members tm on tm.table_id = ct.id
group by ct.id;

-- Índices úteis (idempotentes)
create index if not exists idx_event_banners_producer on public.event_banners(producer_id);
create index if not exists idx_event_photos_producer on public.event_photos(producer_id);
create index if not exists idx_timeline_event on public.event_timeline_items(event_id);
create index if not exists idx_surveys_event on public.event_surveys(event_id);
create index if not exists idx_zones_event on public.event_zones(event_id);
create index if not exists idx_budget_boxes_producer on public.event_budget_boxes(producer_id);
create index if not exists idx_piggy_box on public.piggy_transactions(box_id);
create index if not exists idx_advances_producer on public.revenue_advances(producer_id);
create index if not exists idx_course_progress_user on public.user_course_progress(user_id);
create index if not exists idx_tasks_event on public.tasks(event_id);
create index if not exists idx_customers_event on public.customers(event_id);
create index if not exists idx_onboarding_user on public.onboarding_logs(user_id);
create index if not exists idx_custom_features_user on public.user_custom_features(user_id);
create index if not exists idx_support_messages_session on public.support_messages(session_id);
