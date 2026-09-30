-- Baseline: retrato SÓ DO SCHEMA (sem dados) do banco de produção do Evokaa (projeto rwaezeqyuhxrssntcxdv),
-- gerado em 2026-09-30 a partir do catálogo do Postgres 17.6 por consultas somente leitura
-- (endpoint /database/query/read-only da Management API; nenhuma escrita em produção).
-- Serve para `supabase start` / `supabase db reset` subirem localmente um banco igual à produção.
-- Em produção ele já está aplicado: marcar com `supabase migration repair --status applied <versão>` (ver README).

set check_function_bodies = false;

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pg_stat_statements with schema extensions;

-- ===== tabelas =====

create table public.academy_courses (
  id uuid default gen_random_uuid() not null,
  title text not null,
  description text,
  instructor text,
  duration text,
  lessons integer default 0,
  level text default 'iniciante'::text,
  category text,
  students integer default 0,
  rating numeric default 0,
  locked boolean default false,
  created_at timestamp with time zone default now()
);
create table public.access_logs (
  id uuid default gen_random_uuid() not null,
  user_id uuid,
  event text default 'login'::text not null,
  ip inet,
  forwarded_for text,
  user_agent text,
  created_at timestamp with time zone default now() not null
);
create table public.affiliate_coupon_requests (
  id uuid default gen_random_uuid() not null,
  affiliate_id uuid not null,
  discount_percent numeric not null,
  valid_days integer not null,
  plans text[],
  prospect text,
  reason text,
  status text default 'pending'::text not null,
  admin_notes text,
  coupon_id uuid,
  created_at timestamp with time zone default now() not null,
  decided_at timestamp with time zone,
  decided_by uuid
);
create table public.affiliate_links (
  id uuid default gen_random_uuid() not null,
  affiliate_id uuid not null,
  slug text not null,
  label text,
  clicks integer default 0 not null,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null
);
create table public.affiliates (
  id uuid default gen_random_uuid() not null,
  producer_id uuid not null,
  event_id uuid,
  affiliate_user_id uuid not null,
  commission_percent numeric(5,2) default 10.00 not null,
  sales integer default 0 not null,
  total_earned numeric(10,2) default 0.00 not null,
  status text default 'active'::text not null,
  created_at timestamp with time zone default now() not null
);
create table public.ai_credit_grants (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  amount integer not null,
  note text,
  created_by uuid default auth.uid() not null,
  created_at timestamp with time zone default now() not null
);
create table public.ai_settings (
  id integer default 1 not null,
  enabled boolean default false not null,
  model_router text default 'gemini-3.1-flash-lite'::text not null,
  model_simple text default 'gemini-3.1-flash-lite'::text not null,
  model_complex text default 'gemini-3.8-flash'::text not null,
  model_vision text default 'gemini-3.8-flash'::text not null,
  prices jsonb default '{"gemini-3.7-flash": {"in": 0.75, "out": 3.75}, "gemini-3.8-flash": {"in": 0.75, "out": 3.75}, "gemini-3.1-flash-lite": {"in": 0.25, "out": 1.5}, "gemini-3.5-flash-lite": {"in": 0.30, "out": 2.5}, "gemini-3.1-pro-preview": {"in": 2, "out": 12}}'::jsonb not null,
  usd_brl numeric(8,4) default 5.213 not null,
  daily_cap_brl numeric(10,2) default 50 not null,
  hourly_limit integer default 20 not null,
  quotas jsonb default '{"pro": 60, "free": 5, "plus": 20, "starter": 5, "enterprise": 1000}'::jsonb not null,
  credit_cost jsonb default '{"imagem": 5, "simples": 1, "complexo": 3}'::jsonb not null,
  max_steps integer default 5 not null,
  max_output_tokens integer default 2048 not null,
  key_updated_at timestamp with time zone,
  key_updated_by uuid,
  updated_at timestamp with time zone default now()
);
create table public.ai_usage (
  id uuid default gen_random_uuid() not null,
  user_id uuid,
  mode text not null,
  tier text not null,
  model text,
  tokens_in integer default 0 not null,
  tokens_out integer default 0 not null,
  cost_usd numeric(12,6) default 0 not null,
  credits integer default 0 not null,
  steps integer default 0 not null,
  tools text[] default '{}'::text[] not null,
  status text default 'pendente'::text not null,
  resumo text,
  created_at timestamp with time zone default now() not null,
  finished_at timestamp with time zone
);
create table public.certificates (
  id uuid default gen_random_uuid() not null,
  event_id uuid not null,
  template jsonb default '{}'::jsonb not null,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null
);
create table public.chat_contacts (
  id uuid default gen_random_uuid() not null,
  user_id uuid,
  name text not null,
  email text,
  phone text,
  origin text default 'app'::text not null,
  marketing_opt_in boolean default false not null,
  marketing_opt_in_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
create table public.chat_departments (
  id uuid default gen_random_uuid() not null,
  slug text not null,
  name text not null,
  "position" integer default 0 not null,
  active boolean default true not null,
  default_assignee uuid,
  created_at timestamp with time zone default now() not null
);
create table public.chat_settings (
  id integer default 1 not null,
  hours jsonb default '{"1": ["09:00", "18:00"], "2": ["09:00", "18:00"], "3": ["09:00", "18:00"], "4": ["09:00", "18:00"], "5": ["09:00", "18:00"]}'::jsonb not null,
  response_time text default 'Respondemos em até 1 dia útil.'::text not null,
  team_email text default 'contato@evokaa.com.br'::text not null,
  updated_at timestamp with time zone default now() not null
);
create table public.chat_topics (
  id uuid default gen_random_uuid() not null,
  audience text not null,
  label text not null,
  hint text,
  department_id uuid,
  requires_ticket boolean default false not null,
  urgent boolean default false not null,
  mediation boolean default false not null,
  "position" integer default 0 not null,
  active boolean default true not null,
  created_at timestamp with time zone default now() not null
);
create table public.check_ins (
  id uuid default gen_random_uuid() not null,
  event_id uuid not null,
  ticket_id uuid not null,
  user_id uuid not null,
  checked_in_by uuid,
  checked_in_at timestamp with time zone default now() not null
);
create table public.collective_tables (
  id uuid default gen_random_uuid() not null,
  event_id uuid not null,
  ticket_type_id uuid,
  name text not null,
  theme text,
  capacity integer default 6 not null,
  compatibility_score numeric(3,1),
  status text default 'open'::text not null,
  created_at timestamp with time zone default now() not null,
  icebreaker_question text,
  icebreaker_sent_at timestamp with time zone
);
create table public.contact_messages (
  id uuid default gen_random_uuid() not null,
  name text not null,
  email text not null,
  phone text,
  subject text,
  message text not null,
  page text,
  created_at timestamp with time zone default now()
);
create table public.contact_rate_limit_hits (
  id bigint generated always as identity not null,
  ip text not null,
  created_at timestamp with time zone default now() not null
);
create table public.conversation_messages (
  id uuid default gen_random_uuid() not null,
  conversation_id uuid not null,
  sender_id uuid,
  sender_role text not null,
  sender_name text not null,
  body text default ''::text not null,
  is_internal boolean default false not null,
  attachment_path text,
  attachment_name text,
  attachment_mime text,
  attachment_size bigint,
  created_at timestamp with time zone default now() not null
);
create table public.conversations (
  id uuid default gen_random_uuid() not null,
  contact_id uuid,
  user_id uuid,
  kind text default 'evokaa'::text not null,
  topic_id uuid,
  department_id uuid,
  event_id uuid,
  producer_id uuid,
  status text default 'open'::text not null,
  priority text default 'normal'::text not null,
  assignee_id uuid,
  customer_last_read_at timestamp with time zone,
  agent_last_read_at timestamp with time zone,
  first_response_at timestamp with time zone,
  resolved_at timestamp with time zone,
  last_message_at timestamp with time zone default now() not null,
  last_message_preview text,
  last_customer_message_at timestamp with time zone,
  last_reply_at timestamp with time zone,
  rating smallint,
  customer_emailed_at timestamp with time zone,
  team_alerted_at timestamp with time zone,
  notify_failures integer default 0 not null,
  notify_claimed_until timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  assignee_name text
);
create table public.coupons (
  id uuid default gen_random_uuid() not null,
  producer_id uuid,
  event_id uuid,
  code text not null,
  discount_type text default 'percent'::text not null,
  discount_value numeric(10,2) not null,
  max_uses integer,
  uses integer default 0 not null,
  valid_until timestamp with time zone,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  description text,
  valid_from timestamp with time zone,
  max_uses_per_user integer,
  min_order_value numeric,
  max_discount numeric,
  audience text default 'all'::text not null,
  plans text[],
  duration text,
  duration_months integer,
  created_by uuid,
  updated_at timestamp with time zone default now() not null,
  affiliate_id uuid,
  upgrade_from text[]
);
create table public.crm_interactions (
  id uuid default gen_random_uuid() not null,
  lead_id uuid not null,
  type text not null,
  content text,
  created_at timestamp with time zone default now() not null
);
create table public.crm_leads (
  id uuid default gen_random_uuid() not null,
  producer_id uuid not null,
  stage_id uuid,
  full_name text not null,
  email text,
  phone text,
  avatar_url text,
  source text default 'organic'::text not null,
  score integer default 0 not null,
  potential_value numeric(10,2) default 0.00 not null,
  tags text[] default '{}'::text[] not null,
  event_interest text,
  notes text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  city text,
  notified boolean default false,
  notified_at timestamp with time zone
);
create table public.crm_tasks (
  id uuid default gen_random_uuid() not null,
  lead_id uuid not null,
  title text not null,
  due_date timestamp with time zone,
  completed boolean default false not null,
  created_at timestamp with time zone default now() not null
);
create table public.customers (
  id uuid default gen_random_uuid() not null,
  event_id uuid,
  user_id uuid,
  email text,
  name text,
  phone text,
  tags text[] default '{}'::text[],
  notes text,
  total_spent numeric default 0,
  events_attended numeric default 0,
  created_at timestamp with time zone default now()
);
create table public.event_banners (
  id uuid default gen_random_uuid() not null,
  producer_id uuid not null,
  event_name text,
  name text not null,
  image_url text,
  "position" text default 'hero'::text,
  active boolean default true,
  clicks integer default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
create table public.event_budget_boxes (
  id uuid default gen_random_uuid() not null,
  producer_id uuid not null,
  event_id uuid,
  name text not null,
  target numeric default 0,
  saved numeric default 0,
  category text default 'Outros'::text,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
create table public.event_photos (
  id uuid default gen_random_uuid() not null,
  producer_id uuid not null,
  event_name text,
  url text not null,
  caption text,
  likes integer default 0,
  comments integer default 0,
  featured boolean default false,
  size text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
create table public.event_reviews (
  id uuid default gen_random_uuid() not null,
  event_id uuid not null,
  user_id uuid not null,
  rating integer not null,
  comment text,
  created_at timestamp with time zone default now() not null
);
create table public.event_surveys (
  id uuid default gen_random_uuid() not null,
  event_id uuid not null,
  participant_email text not null,
  score integer not null,
  comment text,
  zone text,
  created_at timestamp with time zone default now()
);
create table public.event_timeline_items (
  id uuid default gen_random_uuid() not null,
  producer_id uuid not null,
  event_id uuid,
  "time" text not null,
  title text not null,
  description text,
  type text default 'show'::text,
  responsible text,
  status text default 'futuro'::text,
  duration text,
  location text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
create table public.event_zones (
  id uuid default gen_random_uuid() not null,
  event_id uuid not null,
  name text not null,
  avg_time_minutes integer default 0,
  satisfaction_score numeric default 0,
  expected_visitors integer default 0,
  created_at timestamp with time zone default now()
);
create table public.events (
  id uuid default gen_random_uuid() not null,
  producer_id uuid not null,
  title text not null,
  subtitle text,
  slug text not null,
  description text,
  short_description text,
  cover_image text,
  image_url text,
  gallery jsonb default '[]'::jsonb not null,
  category text,
  tags text[] default '{}'::text[] not null,
  venue_name text,
  venue_address text,
  venue_city text,
  venue_state text,
  venue_zip text,
  venue_lat numeric,
  venue_lng numeric,
  date date,
  "time" time without time zone,
  start_date timestamp with time zone default now() not null,
  end_date timestamp with time zone,
  status text default 'draft'::text not null,
  visibility text default 'public'::text not null,
  password text,
  capacity integer,
  branding jsonb default '{}'::jsonb not null,
  settings jsonb default '{}'::jsonb not null,
  meta_title text,
  meta_description text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  approval_status text default 'pending'::text not null,
  approved_at timestamp with time zone,
  approved_by uuid,
  rejection_reason text,
  featured_carousel boolean default false not null
);
create table public.feedback (
  id uuid default gen_random_uuid() not null,
  type text,
  message text not null,
  rating integer,
  page text,
  user_agent text,
  created_at timestamp with time zone default now(),
  status text default 'novo'::text not null,
  admin_notes text
);
create table public.interest_lists (
  id uuid default gen_random_uuid() not null,
  event_id uuid not null,
  user_id uuid not null,
  ticket_type_id uuid,
  notified boolean default false not null,
  created_at timestamp with time zone default now() not null
);
create table public.issued_certificates (
  id uuid default gen_random_uuid() not null,
  certificate_id uuid not null,
  user_id uuid not null,
  issued_at timestamp with time zone default now() not null,
  code text default (gen_random_uuid())::text not null
);
create table public.menu_items (
  id uuid default gen_random_uuid() not null,
  event_id uuid,
  producer_id uuid not null,
  name text not null,
  description text,
  price numeric(10,2) default 0.00 not null,
  category text default 'bebida'::text not null,
  image_url text,
  is_available boolean default true not null,
  stock integer,
  created_at timestamp with time zone default now() not null
);
create table public.menu_order_items (
  id uuid default gen_random_uuid() not null,
  menu_order_id uuid not null,
  menu_item_id uuid not null,
  quantity integer default 1 not null,
  unit_price numeric(10,2) not null
);
create table public.menu_orders (
  id uuid default gen_random_uuid() not null,
  event_id uuid not null,
  user_id uuid not null,
  status text default 'pending'::text not null,
  pickup_time timestamp with time zone,
  total numeric(10,2) default 0.00 not null,
  qr_code text default (gen_random_uuid())::text not null,
  created_at timestamp with time zone default now() not null
);
create table public.messages (
  id uuid default gen_random_uuid() not null,
  sender_id uuid not null,
  recipient_id uuid not null,
  lead_id uuid,
  content text not null,
  is_read boolean default false not null,
  created_at timestamp with time zone default now() not null
);
create table public.newsletter_subscribers (
  id uuid default gen_random_uuid() not null,
  email text not null,
  created_at timestamp with time zone default now(),
  unsubscribe_token uuid default gen_random_uuid() not null,
  unsubscribed_at timestamp with time zone
);
create table public.newsletters (
  id uuid default gen_random_uuid() not null,
  title text not null,
  content text not null,
  status text default 'draft'::text not null,
  sent_at timestamp with time zone,
  recipient_count integer default 0,
  created_at timestamp with time zone default now() not null
);
create table public.notifications (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  title text not null,
  body text,
  type text default 'info'::text not null,
  is_read boolean default false not null,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null
);
create table public.onboarding_logs (
  id uuid default gen_random_uuid() not null,
  user_id uuid,
  step_name text,
  step_number numeric,
  completed_at timestamp with time zone,
  skipped boolean default false,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);
create table public.order_items (
  id uuid default gen_random_uuid() not null,
  order_id uuid not null,
  ticket_type_id uuid not null,
  quantity integer default 1 not null,
  unit_price numeric(10,2) not null,
  subtotal numeric(10,2) default 0.00 not null,
  created_at timestamp with time zone default now() not null
);
create table public.orders (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  event_id uuid not null,
  coupon_id uuid,
  subtotal numeric(10,2) default 0.00 not null,
  discount numeric(10,2) default 0.00 not null,
  service_fee numeric(10,2) default 0.00 not null,
  processing_fee numeric(10,2) default 0.00 not null,
  total numeric(10,2) default 0.00 not null,
  status text default 'pending'::text not null,
  payment_method text,
  payment_gateway text,
  gateway_payment_id text,
  customer_name text,
  customer_email text,
  customer_cpf text,
  customer_phone text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
create table public.partners (
  id uuid default gen_random_uuid() not null,
  producer_id uuid not null,
  name text not null,
  type text,
  contact text,
  logo_url text,
  notes text,
  created_at timestamp with time zone default now() not null
);
create table public.payments (
  id uuid default gen_random_uuid() not null,
  order_id uuid not null,
  gateway text not null,
  gateway_payment_id text not null,
  amount numeric(10,2) not null,
  status text default 'pending'::text not null,
  split_data jsonb default '{}'::jsonb not null,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
create table public.piggy_transactions (
  id uuid default gen_random_uuid() not null,
  box_id uuid not null,
  type text not null,
  amount numeric default 0,
  note text,
  created_at timestamp with time zone default now()
);
create table public.pipeline_stages (
  id uuid default gen_random_uuid() not null,
  producer_id uuid not null,
  name text not null,
  color text default '#3b82f6'::text not null,
  "position" integer default 0 not null,
  created_at timestamp with time zone default now() not null
);
create table public.platform_affiliate_producers (
  producer_id uuid not null,
  affiliate_id uuid not null,
  source text default 'manual'::text not null,
  linked_at timestamp with time zone default now() not null,
  linked_by uuid,
  id uuid default gen_random_uuid() not null,
  ref_first_seen_at timestamp with time zone,
  ended_at timestamp with time zone,
  ended_by uuid,
  end_reason text,
  affiliate_link_id uuid
);
create table public.platform_affiliates (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  referral_code text not null,
  recurring_percent numeric not null,
  status text default 'active'::text not null,
  agreement_date date default CURRENT_DATE not null,
  notes text,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  full_name text,
  cpf text,
  birth_date date,
  email text,
  phone text,
  whatsapp text,
  cep text,
  street text,
  street_number text,
  complement text,
  neighborhood text,
  city text,
  state text,
  payout_account_id text
);
create table public.platform_settings (
  id uuid default gen_random_uuid() not null,
  key text not null,
  value jsonb default '{}'::jsonb not null,
  updated_by uuid,
  updated_at timestamp with time zone default now() not null
);
create table public.policy_notices (
  user_id uuid not null,
  version text not null,
  sent_at timestamp with time zone default now() not null
);
create table public.producer_profiles (
  id uuid not null,
  company_name text not null,
  cnpj text not null,
  stripe_account_id text,
  woovi_account_id text,
  commission_rate numeric(5,2) default 10.00 not null,
  is_verified boolean default false not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  notification_settings jsonb default '{}'::jsonb not null,
  bank_account jsonb default '{}'::jsonb not null,
  pix_key text,
  api_key text,
  webhook_url text
);
create table public.producer_subscriptions (
  id uuid default gen_random_uuid() not null,
  producer_id uuid not null,
  plan text default 'free'::text not null,
  started_at timestamp with time zone default now() not null,
  expires_at timestamp with time zone,
  is_active boolean default true not null
);
create table public.producer_tasks (
  id uuid default gen_random_uuid() not null,
  producer_id uuid not null,
  event_id uuid,
  assigned_to uuid,
  title text not null,
  description text,
  due_date timestamp with time zone,
  status text default 'todo'::text not null,
  priority text default 'medium'::text not null,
  created_at timestamp with time zone default now() not null
);
create table public.profiles (
  id uuid not null,
  email text not null,
  full_name text,
  phone text,
  cpf text,
  avatar_url text,
  bio text,
  city text,
  birth_date date,
  instagram text,
  tiktok text,
  linkedin text,
  role text default 'user'::text not null,
  stripe_customer_id text,
  is_verified boolean default false not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  website text,
  admin_permissions text[] default '{}'::text[] not null
);
create table public.purchases (
  id uuid default gen_random_uuid() not null,
  user_id uuid,
  coupon_id uuid,
  total_amount numeric(10,2) default 0 not null,
  status text default 'pending'::text not null,
  payment_method text,
  payment_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
create table public.revenue_advances (
  id uuid default gen_random_uuid() not null,
  producer_id uuid not null,
  event_id uuid not null,
  amount numeric default 0,
  fee_pct numeric default 0,
  fee_amount numeric default 0,
  iof_amount numeric default 0,
  net_amount numeric default 0,
  days integer default 7,
  status text default 'requested'::text,
  requested_at timestamp with time zone default now(),
  transferred_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
create table public.seating_maps (
  id uuid default gen_random_uuid() not null,
  event_id uuid not null,
  name text default 'Principal'::text not null,
  config jsonb default '{"elements": [], "background": null}'::jsonb not null,
  environments jsonb default '[{"id": "default", "name": "Principal", "seats": []}]'::jsonb,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
create table public.support_messages (
  id uuid default gen_random_uuid() not null,
  session_id uuid,
  sender_type text,
  sender_id uuid,
  sender_name text,
  content text,
  created_at timestamp with time zone default now(),
  read_at timestamp with time zone
);
create table public.support_sessions (
  id uuid default gen_random_uuid() not null,
  visitor_id uuid,
  user_id uuid,
  status text default 'open'::text,
  assigned_agent_id uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
create table public.table_members (
  id uuid default gen_random_uuid() not null,
  table_id uuid not null,
  user_id uuid not null,
  vibe text,
  role text default 'member'::text not null,
  matchmaking_answers jsonb default '{}'::jsonb not null,
  joined_at timestamp with time zone default now() not null
);
create table public.tasks (
  id uuid default gen_random_uuid() not null,
  event_id uuid,
  title text,
  description text,
  assignee_id uuid,
  status text default 'todo'::text,
  priority text default 'medium'::text,
  due_date timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
create table public.team_members (
  id uuid default gen_random_uuid() not null,
  producer_id uuid not null,
  user_id uuid not null,
  role text default 'viewer'::text not null,
  invited_at timestamp with time zone default now() not null,
  accepted_at timestamp with time zone
);
create table public.ticket_types (
  id uuid default gen_random_uuid() not null,
  event_id uuid not null,
  name text not null,
  description text,
  price numeric(10,2) default 0.00 not null,
  capacity integer,
  quantity_total integer default 0 not null,
  sold integer default 0 not null,
  quantity_sold integer default 0 not null,
  min_per_order integer default 1 not null,
  max_per_order integer,
  valid_from timestamp with time zone,
  valid_until timestamp with time zone,
  sale_start timestamp with time zone,
  sale_end timestamp with time zone,
  perks jsonb default '[]'::jsonb not null,
  perks_array text[] default '{}'::text[] not null,
  type text default 'individual'::text not null,
  sort_order integer,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
create table public.tickets (
  id uuid default gen_random_uuid() not null,
  order_item_id uuid,
  order_id uuid not null,
  ticket_type_id uuid not null,
  event_id uuid not null,
  user_id uuid not null,
  buyer_name text not null,
  buyer_email text not null,
  buyer_cpf text,
  qr_code text default (gen_random_uuid())::text not null,
  status text default 'active'::text not null,
  price_paid numeric(10,2) default 0.00 not null,
  checked_in_at timestamp with time zone,
  checked_in_by uuid,
  transferred_to uuid,
  transfer_count integer default 0,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now()
);
create table public.transactions (
  id uuid default gen_random_uuid() not null,
  producer_id uuid not null,
  event_id uuid,
  order_id uuid,
  type text not null,
  amount numeric(10,2) not null,
  description text,
  status text default 'completed'::text not null,
  created_at timestamp with time zone default now() not null
);
create table public.user_activities (
  id uuid default gen_random_uuid() not null,
  user_id uuid,
  session_id text not null,
  event_type text not null,
  path text,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null
);
create table public.user_consents (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  terms_version text not null,
  privacy_version text not null,
  marketing_consent boolean default false not null,
  data_sharing_consent boolean default false not null,
  accepted_at timestamp with time zone not null,
  recorded_at timestamp with time zone default now() not null,
  ip inet,
  forwarded_for text,
  user_agent text
);
create table public.user_course_progress (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  course_id uuid not null,
  progress integer default 0,
  completed boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
create table public.user_custom_features (
  id uuid default gen_random_uuid() not null,
  user_id uuid,
  feature_key text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone default now()
);
create table public.user_preferences (
  id uuid default gen_random_uuid() not null,
  user_id uuid,
  genres text[] default '{}'::text[],
  event_types text[] default '{}'::text[],
  max_distance numeric default 50,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
create table public.user_profiles_ext (
  id uuid default gen_random_uuid() not null,
  user_id uuid,
  temperament text,
  intention text,
  music_style text,
  energy_level text,
  birth_year numeric,
  gender text,
  bio text,
  vibe text,
  quiz_completed_at timestamp with time zone,
  created_at timestamp with time zone default now()
);
create table public.withdrawals (
  id uuid default gen_random_uuid() not null,
  producer_id uuid not null,
  amount numeric(10,2) not null,
  pix_key text,
  bank_account jsonb default '{}'::jsonb not null,
  status text default 'pending'::text not null,
  created_at timestamp with time zone default now() not null,
  processed_at timestamp with time zone
);
-- ===== funções =====

CREATE OR REPLACE FUNCTION public.admin_activity_stats(desde timestamp with time zone)
 RETURNS TABLE(sessoes bigint, visualizacoes bigint, logins bigint, contas_ativas bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.gf_is_admin() then
    raise exception 'acesso negado: só administradores' using errcode = '42501';
  end if;
  return query
    select count(distinct a.session_id),
           count(*) filter (where a.event_type = 'page_view'),
           count(*) filter (where a.event_type = 'login'),
           count(distinct a.user_id)
    from public.user_activities a
    where a.created_at >= desde;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.affiliate_link_hit(p_code text, p_slug text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  update public.affiliate_links l
     set clicks = l.clicks + 1
    from public.platform_affiliates a
   where a.id = l.affiliate_id
     and upper(a.referral_code) = upper(p_code)
     and a.status = 'active'
     and l.slug = lower(p_slug)
     and l.is_active;
$function$
;
CREATE OR REPLACE FUNCTION public.affiliate_my_producers()
 RETURNS TABLE(full_name text, linked_at timestamp with time zone, ended_at timestamp with time zone, source text, producer_since timestamp with time zone, link_slug text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p.full_name, v.linked_at, v.ended_at, v.source, p.created_at, l.slug
  from public.platform_affiliate_producers v
  join public.platform_affiliates a on a.id = v.affiliate_id
  join public.profiles p on p.id = v.producer_id
  left join public.affiliate_links l on l.id = v.affiliate_link_id
  where a.user_id = (select auth.uid()) and public.gf_mfa_ok()
  order by v.linked_at desc;
$function$
;
CREATE OR REPLACE FUNCTION public.agent_meus_eventos()
 RETURNS TABLE(id uuid, title text, start_date timestamp with time zone, status text, capacity integer, venue_city text, ingressos bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select e.id, e.title, e.start_date, e.status, e.capacity, e.venue_city,
         (select count(*)
          from public.tickets t
          join public.ticket_types tt on tt.id = t.ticket_type_id
          where tt.event_id = e.id) as ingressos
  from public.events e
  where e.producer_id = (select auth.uid())
  order by e.start_date desc;
$function$
;
CREATE OR REPLACE FUNCTION public.ai_admin_resumo(p_de timestamp with time zone, p_ate timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.ai_balance()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.ai_custo(p_model text, p_in bigint, p_out bigint)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.ai_finish(p_id uuid, p_tokens_in integer, p_tokens_out integer, p_steps integer, p_tools text[], p_status text, p_resumo text, p_called boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.ai_get_gemini_key()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select d.decrypted_secret
  from vault.decrypted_secrets d
  where d.name = 'gemini_api_key'
  limit 1;
$function$
;
CREATE OR REPLACE FUNCTION public.ai_grant_credits(p_user uuid, p_amount integer, p_note text)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  insert into public.ai_credit_grants (user_id, amount, note)
  values (p_user, p_amount, p_note)
  returning id;
$function$
;
CREATE OR REPLACE FUNCTION public.ai_key_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.ai_log(p_user uuid, p_mode text, p_tier text, p_model text, p_tokens_in integer, p_tokens_out integer, p_resumo text, p_status text DEFAULT 'erro'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.ai_portoes(p_user uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.ai_precheck(p_user uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.ai_reserve(p_user uuid, p_tier text, p_mode text, p_model text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.ai_saldo(p_user uuid)
 RETURNS TABLE(plano text, cota integer, concedido integer, usado integer, periodo text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.ai_set_gemini_key(p_key text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.aviso_politica_destinatarios(p_version text)
 RETURNS TABLE(user_id uuid, email text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.aviso_politica_registrar(p_user uuid, p_version text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  insert into public.policy_notices (user_id, version)
  values (p_user, p_version)
  on conflict do nothing;
$function$
;
CREATE OR REPLACE FUNCTION public.chat_arquivos_a_apagar(p_user uuid)
 RETURNS SETOF text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select o.name
  from storage.objects o
  where o.bucket_id = 'chat-anexos'
    and o.owner = p_user
    and not exists (
      select 1 from public.conversation_messages m
      where m.attachment_path = o.name
        and not (m.sender_id = p_user and m.sender_role = 'customer'));
$function$
;
CREATE OR REPLACE FUNCTION public.chat_can_upload(p_name text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.chat_inbox(p_filtro text, p_busca text, p_limite integer)
 RETURNS TABLE(id uuid, user_id uuid, contact_id uuid, kind text, status text, priority text, assignee_id uuid, department_id uuid, department_name text, topic_label text, mediation boolean, contact_name text, contact_email text, contact_phone text, last_message_at timestamp with time zone, last_message_preview text, last_customer_message_at timestamp with time zone, last_reply_at timestamp with time zone, agent_last_read_at timestamp with time zone, customer_last_read_at timestamp with time zone, nao_lida boolean, created_at timestamp with time zone, resolved_at timestamp with time zone, rating smallint)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare
  v_busca text := lower(trim(coalesce(p_busca, '')));
begin
  if coalesce(p_filtro, '') not in ('minhas', 'sem_dono', 'urgentes', 'mediacao', 'abertas', 'resolvidas') then
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
         c.created_at, c.resolved_at, c.rating
  from public.conversations c
  left join public.chat_departments d on d.id = c.department_id
  left join public.chat_topics t on t.id = c.topic_id
  left join public.chat_contacts ct on ct.id = c.contact_id
  where case p_filtro
      when 'minhas' then c.status = 'open' and c.assignee_id = (select auth.uid())
      when 'sem_dono' then c.status = 'open' and c.assignee_id is null
      when 'urgentes' then c.status = 'open' and c.priority = 'urgent'
      when 'mediacao' then coalesce(t.mediation, false)
      when 'abertas' then c.status = 'open'
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
$function$
;
CREATE OR REPLACE FUNCTION public.chat_mark_read(p_conv uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.chat_messages_after_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.is_internal then
    return null;
  end if;
  update public.conversations c set
    last_message_at = new.created_at,
    last_message_preview = left(case when new.body <> '' then new.body
                                     else 'Anexo: ' || coalesce(new.attachment_name, 'arquivo') end, 140),
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
$function$
;
CREATE OR REPLACE FUNCTION public.chat_notify_due()
 RETURNS TABLE(tipo text, conversation_id uuid, email text, nome text, assunto text, urgente boolean, previa text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.chat_notify_mark(p_ids uuid[], p_tipo text, p_ok boolean)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.chat_notify_secret()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select d.decrypted_secret from vault.decrypted_secrets d where d.name = 'chat_notify_secret' limit 1;
$function$
;
CREATE OR REPLACE FUNCTION public.chat_public_settings()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with agora as (select (now() at time zone 'America/Sao_Paulo') as t)
  select jsonb_build_object(
    'aberto_agora', coalesce(
      (a.t::time >= (s.hours -> extract(isodow from a.t)::int::text ->> 0)::time
       and a.t::time < (s.hours -> extract(isodow from a.t)::int::text ->> 1)::time), false),
    'prazo', s.response_time
  )
  from public.chat_settings s, agora a
  where s.id = 1;
$function$
;
CREATE OR REPLACE FUNCTION public.chat_rate(p_conv uuid, p_rating integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.chat_role(p_conv uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case
    when c.user_id = (select auth.uid()) then 'customer'
    when c.producer_id = (select auth.uid()) then 'producer'
    when (c.kind = 'evokaa' or coalesce(t.mediation, false)) and public.gf_admin_can('manage_support') then 'agent'
  end
  from public.conversations c
  left join public.chat_topics t on t.id = c.topic_id
  where c.id = p_conv and public.gf_mfa_ok();
$function$
;
CREATE OR REPLACE FUNCTION public.chat_role_path(p_name text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case
    when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]{1,200}$'
      then public.chat_role(split_part(p_name, '/', 1)::uuid)
  end;
$function$
;
CREATE OR REPLACE FUNCTION public.chat_send(p_conv uuid, p_body text, p_is_internal boolean, p_attachment_path text, p_attachment_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    if (select c.status from public.conversations c where c.id = p_conv) = 'resolved'
       and (select count(*) from public.conversations c where c.user_id = v_uid and c.status = 'open') >= 3 then
      return jsonb_build_object('ok', false, 'motivo', 'limite_abertas');
    end if;
    select ct.name into v_sender
    from public.conversations c join public.chat_contacts ct on ct.id = c.contact_id
    where c.id = p_conv;
    update public.conversations c
    set status = 'open', resolved_at = null, updated_at = now()
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
  end if;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.chat_start(p_topic_id uuid, p_event_id uuid, p_name text, p_phone text, p_marketing_opt_in boolean, p_body text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if (select count(*) from public.conversations c where c.user_id = v_uid and c.status = 'open') >= 3 then
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

  insert into public.conversations (contact_id, user_id, kind, topic_id, department_id, priority)
  values (v_contact, v_uid, 'evokaa', v_topic.id, v_topic.department_id,
          case when v_topic.urgent then 'urgent' else 'normal' end)
  returning id into v_conv;

  insert into public.conversation_messages (conversation_id, sender_id, sender_role, sender_name, body)
  values (v_conv, v_uid, 'customer', v_name, v_body);

  return jsonb_build_object('ok', true, 'id', v_conv);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.chat_update(p_conv uuid, p_patch jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    updated_at = now()
  where c.id = p_conv;

  return jsonb_build_object('ok', true);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.gf_admin_can(p text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.profiles pr
    where pr.id = (select auth.uid())
      and pr.role = 'admin'
      and ('super_admin' = any(pr.admin_permissions) or p = any(pr.admin_permissions))
  ) and public.gf_mfa_ok();
$function$
;
CREATE OR REPLACE FUNCTION public.gf_cpf_valido(p text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.gf_is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  ) and public.gf_mfa_ok();
$function$
;
CREATE OR REPLACE FUNCTION public.gf_mfa_ok()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = (select auth.uid()) and f.status = 'verified'
      );
$function$
;
CREATE OR REPLACE FUNCTION public.gf_protect_affiliate_link()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  -- só trava quem edita pelo site (papéis do PostgREST); a contagem de cliques roda dentro de
  -- affiliate_link_hit (security definer, como dona da função) e passa
  if current_user in ('authenticated', 'anon') and not (select public.gf_is_admin())
     and (new.slug is distinct from old.slug or new.affiliate_id is distinct from old.affiliate_id
          or new.clicks is distinct from old.clicks or new.created_at is distinct from old.created_at) then
    raise exception 'Só é possível alterar o nome de exibição e ativar/desativar o link.';
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.gf_protect_event_moderation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not ((current_setting('role', true) in ('anon', 'authenticated')
           or coalesce(auth.jwt()->>'role', '') in ('anon', 'authenticated'))
          and not public.gf_is_admin()) then
    return new;
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
      new.venue_state, new.venue_zip, new.venue_lat, new.venue_lng)
     is distinct from
     (old.date, old.time, old.start_date, old.end_date, old.venue_name, old.venue_address, old.venue_city,
      old.venue_state, old.venue_zip, old.venue_lat, old.venue_lng)
     and exists (select 1 from public.tickets t
                 where t.event_id = old.id and coalesce(t.status, 'active') not in ('cancelled', 'refunded')) then
    raise exception 'Evento com ingresso vendido: data e local só mudam pelo admin (Decreto 13.108, arts. 20 a 22)'
      using errcode = '42501';
  end if;

  if old.approval_status in ('approved', 'rejected')
     and (new.title, new.subtitle, new.description, new.short_description, new.cover_image, new.image_url,
          new.gallery, new.category, new.tags, new.meta_title, new.meta_description, new.date, new.time, new.start_date, new.end_date, new.venue_name,
          new.venue_address, new.venue_city, new.venue_state, new.venue_zip, new.venue_lat, new.venue_lng)
         is distinct from
         (old.title, old.subtitle, old.description, old.short_description, old.cover_image, old.image_url,
          old.gallery, old.category, old.tags, old.meta_title, old.meta_description, old.date, old.time, old.start_date, old.end_date, old.venue_name,
          old.venue_address, old.venue_city, old.venue_state, old.venue_zip, old.venue_lat, old.venue_lng) then
    new.approval_status := 'pending';
    new.featured_carousel := false;
    new.approved_at := null;
    new.approved_by := null; -- rejection_reason fica: é o histórico da recusa
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.gf_protect_producer_profile_privileges()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if (current_user in ('anon', 'authenticated')
      or coalesce(auth.jwt()->>'role', '') in ('anon', 'authenticated'))
     and not public.gf_is_admin() then
    if tg_op = 'INSERT' then
      if new.is_verified or new.commission_rate is distinct from 10.00 then
        raise exception 'Campo protegido não permitido' using errcode = '42501';
      end if;
    elsif new.is_verified is distinct from old.is_verified
       or new.commission_rate is distinct from old.commission_rate then
      raise exception 'Alteração de campo protegido não permitida' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.gf_protect_profile_privileges()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
     and not exists (select 1 from public.profiles p
                     where p.id <> old.id and p.role = 'admin' and 'super_admin' = any(p.admin_permissions)) then
    raise exception 'A plataforma precisa de pelo menos um super_admin' using errcode = '42501';
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
$function$
;
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.link_me_to_affiliate(p_code text, p_ref_first_seen_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_link text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.tem_ingresso(p_event uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.tickets t
    where t.event_id = p_event and t.user_id = (select auth.uid())
  );
$function$
;
-- ===== chaves primárias e únicas =====

alter table only public.academy_courses add constraint academy_courses_pkey PRIMARY KEY (id);
alter table only public.access_logs add constraint access_logs_pkey PRIMARY KEY (id);
alter table only public.affiliate_coupon_requests add constraint affiliate_coupon_requests_pkey PRIMARY KEY (id);
alter table only public.affiliate_links add constraint affiliate_links_affiliate_id_slug_key UNIQUE (affiliate_id, slug);
alter table only public.affiliate_links add constraint affiliate_links_pkey PRIMARY KEY (id);
alter table only public.affiliates add constraint affiliates_pkey PRIMARY KEY (id);
alter table only public.ai_credit_grants add constraint ai_credit_grants_pkey PRIMARY KEY (id);
alter table only public.ai_settings add constraint ai_settings_pkey PRIMARY KEY (id);
alter table only public.ai_usage add constraint ai_usage_pkey PRIMARY KEY (id);
alter table only public.certificates add constraint certificates_pkey PRIMARY KEY (id);
alter table only public.chat_contacts add constraint chat_contacts_pkey PRIMARY KEY (id);
alter table only public.chat_contacts add constraint chat_contacts_user_id_key UNIQUE (user_id);
alter table only public.chat_departments add constraint chat_departments_pkey PRIMARY KEY (id);
alter table only public.chat_departments add constraint chat_departments_slug_key UNIQUE (slug);
alter table only public.chat_settings add constraint chat_settings_pkey PRIMARY KEY (id);
alter table only public.chat_topics add constraint chat_topics_pkey PRIMARY KEY (id);
alter table only public.check_ins add constraint check_ins_pkey PRIMARY KEY (id);
alter table only public.collective_tables add constraint collective_tables_pkey PRIMARY KEY (id);
alter table only public.contact_messages add constraint contact_messages_pkey PRIMARY KEY (id);
alter table only public.contact_rate_limit_hits add constraint contact_rate_limit_hits_pkey PRIMARY KEY (id);
alter table only public.conversation_messages add constraint conversation_messages_pkey PRIMARY KEY (id);
alter table only public.conversations add constraint conversations_pkey PRIMARY KEY (id);
alter table only public.coupons add constraint coupons_code_key UNIQUE (code);
alter table only public.coupons add constraint coupons_pkey PRIMARY KEY (id);
alter table only public.crm_interactions add constraint crm_interactions_pkey PRIMARY KEY (id);
alter table only public.crm_leads add constraint crm_leads_pkey PRIMARY KEY (id);
alter table only public.crm_tasks add constraint crm_tasks_pkey PRIMARY KEY (id);
alter table only public.customers add constraint customers_pkey PRIMARY KEY (id);
alter table only public.event_banners add constraint event_banners_pkey PRIMARY KEY (id);
alter table only public.event_budget_boxes add constraint event_budget_boxes_pkey PRIMARY KEY (id);
alter table only public.event_photos add constraint event_photos_pkey PRIMARY KEY (id);
alter table only public.event_reviews add constraint event_reviews_event_id_user_id_key UNIQUE (event_id, user_id);
alter table only public.event_reviews add constraint event_reviews_pkey PRIMARY KEY (id);
alter table only public.event_surveys add constraint event_surveys_pkey PRIMARY KEY (id);
alter table only public.event_timeline_items add constraint event_timeline_items_pkey PRIMARY KEY (id);
alter table only public.event_zones add constraint event_zones_pkey PRIMARY KEY (id);
alter table only public.events add constraint events_pkey PRIMARY KEY (id);
alter table only public.events add constraint events_slug_key UNIQUE (slug);
alter table only public.feedback add constraint feedback_pkey PRIMARY KEY (id);
alter table only public.interest_lists add constraint interest_lists_event_id_user_id_key UNIQUE (event_id, user_id);
alter table only public.interest_lists add constraint interest_lists_pkey PRIMARY KEY (id);
alter table only public.issued_certificates add constraint issued_certificates_code_key UNIQUE (code);
alter table only public.issued_certificates add constraint issued_certificates_pkey PRIMARY KEY (id);
alter table only public.menu_items add constraint menu_items_pkey PRIMARY KEY (id);
alter table only public.menu_order_items add constraint menu_order_items_pkey PRIMARY KEY (id);
alter table only public.menu_orders add constraint menu_orders_pkey PRIMARY KEY (id);
alter table only public.menu_orders add constraint menu_orders_qr_code_key UNIQUE (qr_code);
alter table only public.messages add constraint messages_pkey PRIMARY KEY (id);
alter table only public.newsletter_subscribers add constraint newsletter_subscribers_email_key UNIQUE (email);
alter table only public.newsletter_subscribers add constraint newsletter_subscribers_pkey PRIMARY KEY (id);
alter table only public.newsletters add constraint newsletters_pkey PRIMARY KEY (id);
alter table only public.notifications add constraint notifications_pkey PRIMARY KEY (id);
alter table only public.onboarding_logs add constraint onboarding_logs_pkey PRIMARY KEY (id);
alter table only public.order_items add constraint order_items_pkey PRIMARY KEY (id);
alter table only public.orders add constraint orders_pkey PRIMARY KEY (id);
alter table only public.partners add constraint partners_pkey PRIMARY KEY (id);
alter table only public.payments add constraint payments_pkey PRIMARY KEY (id);
alter table only public.piggy_transactions add constraint piggy_transactions_pkey PRIMARY KEY (id);
alter table only public.pipeline_stages add constraint pipeline_stages_pkey PRIMARY KEY (id);
alter table only public.platform_affiliate_producers add constraint platform_affiliate_producers_pkey PRIMARY KEY (id);
alter table only public.platform_affiliates add constraint platform_affiliates_pkey PRIMARY KEY (id);
alter table only public.platform_affiliates add constraint platform_affiliates_user_id_key UNIQUE (user_id);
alter table only public.platform_settings add constraint platform_settings_key_key UNIQUE (key);
alter table only public.platform_settings add constraint platform_settings_pkey PRIMARY KEY (id);
alter table only public.policy_notices add constraint policy_notices_pkey PRIMARY KEY (user_id, version);
alter table only public.producer_profiles add constraint producer_profiles_cnpj_key UNIQUE (cnpj);
alter table only public.producer_profiles add constraint producer_profiles_pkey PRIMARY KEY (id);
alter table only public.producer_subscriptions add constraint producer_subscriptions_pkey PRIMARY KEY (id);
alter table only public.producer_subscriptions add constraint producer_subscriptions_producer_id_key UNIQUE (producer_id);
alter table only public.producer_tasks add constraint producer_tasks_pkey PRIMARY KEY (id);
alter table only public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table only public.purchases add constraint purchases_pkey PRIMARY KEY (id);
alter table only public.revenue_advances add constraint revenue_advances_pkey PRIMARY KEY (id);
alter table only public.seating_maps add constraint seating_maps_pkey PRIMARY KEY (id);
alter table only public.support_messages add constraint support_messages_pkey PRIMARY KEY (id);
alter table only public.support_sessions add constraint support_sessions_pkey PRIMARY KEY (id);
alter table only public.table_members add constraint table_members_pkey PRIMARY KEY (id);
alter table only public.tasks add constraint tasks_pkey PRIMARY KEY (id);
alter table only public.team_members add constraint team_members_pkey PRIMARY KEY (id);
alter table only public.ticket_types add constraint ticket_types_pkey PRIMARY KEY (id);
alter table only public.tickets add constraint tickets_pkey PRIMARY KEY (id);
alter table only public.tickets add constraint tickets_qr_code_key UNIQUE (qr_code);
alter table only public.transactions add constraint transactions_pkey PRIMARY KEY (id);
alter table only public.user_activities add constraint user_activities_pkey PRIMARY KEY (id);
alter table only public.user_consents add constraint user_consents_pkey PRIMARY KEY (id);
alter table only public.user_consents add constraint user_consents_user_id_terms_version_privacy_version_key UNIQUE (user_id, terms_version, privacy_version);
alter table only public.user_course_progress add constraint user_course_progress_pkey PRIMARY KEY (id);
alter table only public.user_course_progress add constraint user_course_progress_user_id_course_id_key UNIQUE (user_id, course_id);
alter table only public.user_custom_features add constraint user_custom_features_pkey PRIMARY KEY (id);
alter table only public.user_preferences add constraint user_preferences_pkey PRIMARY KEY (id);
alter table only public.user_preferences add constraint user_preferences_user_id_key UNIQUE (user_id);
alter table only public.user_profiles_ext add constraint user_profiles_ext_pkey PRIMARY KEY (id);
alter table only public.user_profiles_ext add constraint user_profiles_ext_user_id_key UNIQUE (user_id);
alter table only public.withdrawals add constraint withdrawals_pkey PRIMARY KEY (id);
-- ===== checks =====

alter table only public.academy_courses add constraint academy_courses_level_check CHECK ((level = ANY (ARRAY['iniciante'::text, 'intermediario'::text, 'avancado'::text])));
alter table only public.access_logs add constraint access_logs_event_check CHECK ((event = 'login'::text));
alter table only public.access_logs add constraint access_logs_forwarded_for_check CHECK ((length(forwarded_for) <= 200));
alter table only public.access_logs add constraint access_logs_user_agent_check CHECK ((length(user_agent) <= 300));
alter table only public.affiliate_coupon_requests add constraint affiliate_coupon_requests_admin_notes_check CHECK ((char_length(admin_notes) <= 500));
alter table only public.affiliate_coupon_requests add constraint affiliate_coupon_requests_discount_percent_check CHECK ((discount_percent = ANY (ARRAY[(5)::numeric, (10)::numeric, (15)::numeric, (20)::numeric, (25)::numeric])));
alter table only public.affiliate_coupon_requests add constraint affiliate_coupon_requests_plans_check CHECK (((plans IS NULL) OR (plans <@ ARRAY['starter'::text, 'plus'::text, 'pro'::text, 'enterprise'::text])));
alter table only public.affiliate_coupon_requests add constraint affiliate_coupon_requests_prospect_check CHECK ((char_length(prospect) <= 200));
alter table only public.affiliate_coupon_requests add constraint affiliate_coupon_requests_reason_check CHECK ((char_length(reason) <= 1000));
alter table only public.affiliate_coupon_requests add constraint affiliate_coupon_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));
alter table only public.affiliate_coupon_requests add constraint affiliate_coupon_requests_valid_days_check CHECK (((valid_days >= 1) AND (valid_days <= 30)));
alter table only public.affiliate_links add constraint affiliate_links_clicks_check CHECK ((clicks >= 0));
alter table only public.affiliate_links add constraint affiliate_links_label_check CHECK ((char_length(label) <= 80));
alter table only public.affiliate_links add constraint affiliate_links_slug_check CHECK (((slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND ((char_length(slug) >= 2) AND (char_length(slug) <= 40))));
alter table only public.affiliates add constraint affiliates_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])));
alter table only public.ai_credit_grants add constraint ai_credit_grants_amount_check CHECK (((amount >= 1) AND (amount <= 10000)));
alter table only public.ai_credit_grants add constraint ai_credit_grants_note_check CHECK ((char_length(note) <= 200));
alter table only public.ai_settings add constraint ai_settings_id_check CHECK ((id = 1));
alter table only public.ai_settings add constraint ai_settings_max_output_tokens_check CHECK (((max_output_tokens >= 256) AND (max_output_tokens <= 8192)));
alter table only public.ai_settings add constraint ai_settings_max_steps_check CHECK (((max_steps >= 1) AND (max_steps <= 8)));
alter table only public.ai_usage add constraint ai_usage_mode_check CHECK ((mode = ANY (ARRAY['chat'::text, 'planejar'::text, 'ping'::text])));
alter table only public.ai_usage add constraint ai_usage_resumo_check CHECK ((char_length(resumo) <= 500));
alter table only public.ai_usage add constraint ai_usage_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'ok'::text, 'erro'::text])));
alter table only public.ai_usage add constraint ai_usage_tier_check CHECK ((tier = ANY (ARRAY['simples'::text, 'complexo'::text, 'imagem'::text, 'fora_do_escopo'::text])));
alter table only public.chat_contacts add constraint chat_contacts_email_check CHECK ((email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text));
alter table only public.chat_contacts add constraint chat_contacts_name_check CHECK (((char_length(name) >= 2) AND (char_length(name) <= 120)));
alter table only public.chat_contacts add constraint chat_contacts_origin_check CHECK ((origin = ANY (ARRAY['site'::text, 'app'::text, 'migracao'::text])));
alter table only public.chat_contacts add constraint chat_contacts_phone_check CHECK ((phone ~ '^55[1-9]{2}9?[0-9]{8}$'::text));
alter table only public.chat_departments add constraint chat_departments_name_check CHECK (((char_length(name) >= 2) AND (char_length(name) <= 60)));
alter table only public.chat_departments add constraint chat_departments_slug_check CHECK ((slug ~ '^[a-z_]{2,40}$'::text));
alter table only public.chat_settings add constraint chat_settings_id_check CHECK ((id = 1));
alter table only public.chat_settings add constraint chat_settings_response_time_check CHECK ((char_length(response_time) <= 120));
alter table only public.chat_settings add constraint chat_settings_team_email_check CHECK ((team_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text));
alter table only public.chat_topics add constraint chat_topics_audience_check CHECK ((audience = ANY (ARRAY['site'::text, 'producer'::text, 'participant_evokaa'::text, 'participant_producer'::text])));
alter table only public.chat_topics add constraint chat_topics_destino_chk CHECK (((audience = 'participant_producer'::text) = (department_id IS NULL)));
alter table only public.chat_topics add constraint chat_topics_hint_check CHECK ((char_length(hint) <= 300));
alter table only public.chat_topics add constraint chat_topics_label_check CHECK (((char_length(label) >= 2) AND (char_length(label) <= 120)));
alter table only public.collective_tables add constraint collective_tables_status_check CHECK ((status = ANY (ARRAY['open'::text, 'full'::text, 'closed'::text])));
alter table only public.conversation_messages add constraint conversation_messages_attachment_name_check CHECK ((char_length(attachment_name) <= 200));
alter table only public.conversation_messages add constraint conversation_messages_attachment_path_check CHECK ((char_length(attachment_path) <= 300));
alter table only public.conversation_messages add constraint conversation_messages_body_check CHECK ((char_length(body) <= 4000));
alter table only public.conversation_messages add constraint conversation_messages_conteudo_chk CHECK (((body <> ''::text) OR (attachment_path IS NOT NULL)));
alter table only public.conversation_messages add constraint conversation_messages_nota_chk CHECK ((NOT (is_internal AND (sender_role = 'customer'::text))));
alter table only public.conversation_messages add constraint conversation_messages_sender_name_check CHECK (((char_length(sender_name) >= 1) AND (char_length(sender_name) <= 120)));
alter table only public.conversation_messages add constraint conversation_messages_sender_role_check CHECK ((sender_role = ANY (ARRAY['customer'::text, 'agent'::text, 'producer'::text, 'bot'::text, 'system'::text])));
alter table only public.conversations add constraint conversations_assignee_name_check CHECK ((char_length(assignee_name) <= 60));
alter table only public.conversations add constraint conversations_kind_check CHECK ((kind = ANY (ARRAY['evokaa'::text, 'producer'::text])));
alter table only public.conversations add constraint conversations_last_message_preview_check CHECK ((char_length(last_message_preview) <= 140));
alter table only public.conversations add constraint conversations_priority_check CHECK ((priority = ANY (ARRAY['normal'::text, 'urgent'::text])));
alter table only public.conversations add constraint conversations_rating_check CHECK (((rating >= 1) AND (rating <= 3)));
alter table only public.conversations add constraint conversations_status_check CHECK ((status = ANY (ARRAY['open'::text, 'resolved'::text])));
alter table only public.coupons add constraint coupons_afiliado_chk CHECK (((affiliate_id IS NULL) OR ((producer_id IS NULL) AND (discount_type = 'percent'::text) AND (discount_value = ANY (ARRAY[(5)::numeric, (10)::numeric, (15)::numeric, (20)::numeric, (25)::numeric])) AND (valid_until IS NOT NULL) AND (valid_until <= (COALESCE(valid_from, created_at) + '720:00:00'::interval)) AND (max_uses_per_user = 1))));
alter table only public.coupons add constraint coupons_audience_chk CHECK ((audience = ANY (ARRAY['all'::text, 'first_purchase'::text, 'first_subscription'::text, 'private'::text])));
alter table only public.coupons add constraint coupons_discount_type_check CHECK ((discount_type = ANY (ARRAY['percent'::text, 'fixed'::text])));
alter table only public.coupons add constraint coupons_duracao_chk CHECK ((((duration IS NULL) AND (duration_months IS NULL)) OR ((duration = ANY (ARRAY['once'::text, 'forever'::text])) AND (duration_months IS NULL)) OR ((duration = 'repeating'::text) AND ((duration_months >= 1) AND (duration_months <= 36)))));
alter table only public.coupons add constraint coupons_limites_chk CHECK ((((max_uses IS NULL) OR (max_uses >= 1)) AND ((max_uses_per_user IS NULL) OR (max_uses_per_user >= 1)) AND ((min_order_value IS NULL) OR (min_order_value >= (0)::numeric)) AND ((max_discount IS NULL) OR (max_discount > (0)::numeric)) AND (uses >= 0)));
alter table only public.coupons add constraint coupons_periodo_chk CHECK (((valid_from IS NULL) OR (valid_until IS NULL) OR (valid_until > valid_from)));
alter table only public.coupons add constraint coupons_plans_chk CHECK (((plans IS NULL) OR (plans <@ ARRAY['starter'::text, 'plus'::text, 'pro'::text, 'enterprise'::text])));
alter table only public.coupons add constraint coupons_tipo_chk CHECK ((((producer_id IS NULL) AND (event_id IS NULL) AND (duration IS NOT NULL)) OR ((producer_id IS NOT NULL) AND (plans IS NULL) AND (duration IS NULL))));
alter table only public.coupons add constraint coupons_upgrade_chk CHECK (((upgrade_from IS NULL) OR ((producer_id IS NULL) AND (cardinality(upgrade_from) > 0) AND (upgrade_from <@ ARRAY['free'::text, 'starter'::text, 'plus'::text, 'pro'::text]))));
alter table only public.coupons add constraint coupons_value_chk CHECK (((discount_value > (0)::numeric) AND ((discount_type <> 'percent'::text) OR (discount_value <= (100)::numeric))));
alter table only public.crm_interactions add constraint crm_interactions_type_check CHECK ((type = ANY (ARRAY['message'::text, 'call'::text, 'email'::text, 'note'::text, 'meeting'::text])));
alter table only public.crm_leads add constraint crm_leads_score_check CHECK (((score >= 0) AND (score <= 100)));
alter table only public.event_banners add constraint event_banners_position_check CHECK (("position" = ANY (ARRAY['hero'::text, 'top'::text, 'inline'::text])));
alter table only public.event_reviews add constraint event_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)));
alter table only public.event_surveys add constraint event_surveys_score_check CHECK (((score >= 0) AND (score <= 10)));
alter table only public.event_timeline_items add constraint event_timeline_items_status_check CHECK ((status = ANY (ARRAY['concluido'::text, 'atual'::text, 'futuro'::text])));
alter table only public.event_timeline_items add constraint event_timeline_items_type_check CHECK ((type = ANY (ARRAY['soundcheck'::text, 'abertura'::text, 'show'::text, 'comida'::text, 'transporte'::text, 'decoracao'::text, 'vip'::text, 'encerramento'::text])));
alter table only public.events add constraint events_approval_status_check CHECK ((approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));
alter table only public.events add constraint events_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'cancelled'::text, 'ended'::text])));
alter table only public.events add constraint events_visibility_check CHECK ((visibility = ANY (ARRAY['public'::text, 'private'::text, 'unlisted'::text, 'password'::text])));
alter table only public.feedback add constraint feedback_rating_check CHECK (((rating >= 0) AND (rating <= 5)));
alter table only public.feedback add constraint feedback_status_check CHECK ((status = ANY (ARRAY['novo'::text, 'lido'::text, 'respondido'::text, 'resolvido'::text])));
alter table only public.feedback add constraint feedback_type_check CHECK ((type = ANY (ARRAY['melhoria'::text, 'bug'::text, 'duvida'::text, 'sugestao'::text, 'elogio'::text])));
alter table only public.menu_items add constraint menu_items_category_check CHECK ((category = ANY (ARRAY['bebida'::text, 'comida'::text, 'combo'::text, 'merch'::text, 'servico'::text])));
alter table only public.menu_orders add constraint menu_orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'preparing'::text, 'ready'::text, 'delivered'::text, 'cancelled'::text])));
alter table only public.newsletters add constraint newsletters_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text])));
alter table only public.notifications add constraint notifications_type_check CHECK ((type = ANY (ARRAY['info'::text, 'sale'::text, 'reminder'::text, 'promo'::text, 'system'::text])));
alter table only public.orders add constraint orders_payment_method_check CHECK ((payment_method = ANY (ARRAY['pix'::text, 'credit_card'::text, 'boleto'::text])));
alter table only public.orders add constraint orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'cancelled'::text, 'refunded'::text])));
alter table only public.payments add constraint payments_gateway_check CHECK ((gateway = ANY (ARRAY['stripe'::text, 'woovi'::text, 'pagseguro'::text])));
alter table only public.payments add constraint payments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'refunded'::text])));
alter table only public.piggy_transactions add constraint piggy_transactions_type_check CHECK ((type = ANY (ARRAY['deposit'::text, 'withdraw'::text])));
alter table only public.platform_affiliate_producers add constraint platform_affiliate_producers_source_chk CHECK ((source = ANY (ARRAY['manual'::text, 'link'::text, 'code'::text, 'coupon'::text])));
alter table only public.platform_affiliate_producers add constraint platform_affiliate_producers_end_reason_check CHECK ((char_length(end_reason) <= 500));
alter table only public.platform_affiliates add constraint platform_affiliates_code_chk CHECK ((referral_code ~ '^[A-Z0-9_-]{3,30}$'::text));
alter table only public.platform_affiliates add constraint platform_affiliates_dados_chk CHECK ((((cpf IS NULL) OR public.gf_cpf_valido(cpf)) AND ((birth_date IS NULL) OR ((birth_date >= '1900-01-01'::date) AND (birth_date <= (CURRENT_DATE - '18 years'::interval)))) AND ((email IS NULL) OR (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text)) AND ((phone IS NULL) OR (phone ~ '^[0-9]{10,13}$'::text)) AND ((whatsapp IS NULL) OR (whatsapp ~ '^[0-9]{10,13}$'::text)) AND ((cep IS NULL) OR (cep ~ '^[0-9]{8}$'::text)) AND ((state IS NULL) OR (state ~ '^[A-Z]{2}$'::text)) AND ((full_name IS NULL) OR ((char_length(full_name) >= 3) AND (char_length(full_name) <= 150)))));
alter table only public.platform_affiliates add constraint platform_affiliates_recurring_percent_check CHECK (((recurring_percent >= (15)::numeric) AND (recurring_percent <= (25)::numeric)));
alter table only public.platform_affiliates add constraint platform_affiliates_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'ended'::text])));
alter table only public.policy_notices add constraint policy_notices_version_check CHECK (((char_length(version) >= 8) AND (char_length(version) <= 20)));
alter table only public.producer_subscriptions add constraint producer_subscriptions_plan_check CHECK ((plan = ANY (ARRAY['free'::text, 'starter'::text, 'plus'::text, 'pro'::text, 'enterprise'::text])));
alter table only public.producer_tasks add constraint producer_tasks_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])));
alter table only public.producer_tasks add constraint producer_tasks_status_check CHECK ((status = ANY (ARRAY['todo'::text, 'in_progress'::text, 'done'::text])));
alter table only public.profiles add constraint profiles_role_check CHECK ((role = ANY (ARRAY['user'::text, 'customer'::text, 'producer'::text, 'admin'::text])));
alter table only public.purchases add constraint purchases_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'refunded'::text, 'cancelled'::text])));
alter table only public.revenue_advances add constraint revenue_advances_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'approved'::text, 'transferred'::text, 'reconciled'::text, 'rejected'::text])));
alter table only public.team_members add constraint team_members_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'editor'::text, 'viewer'::text])));
alter table only public.ticket_types add constraint ticket_types_type_check CHECK ((type = ANY (ARRAY['individual'::text, 'vip'::text, 'coletiva'::text, 'mesa'::text])));
alter table only public.tickets add constraint tickets_status_check CHECK ((status = ANY (ARRAY['active'::text, 'used'::text, 'cancelled'::text, 'refunded'::text, 'transferred'::text])));
alter table only public.transactions add constraint transactions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text])));
alter table only public.transactions add constraint transactions_type_check CHECK ((type = ANY (ARRAY['income'::text, 'expense'::text, 'withdrawal'::text, 'refund'::text, 'fee'::text])));
alter table only public.user_activities add constraint user_activities_event_type_check CHECK ((event_type = ANY (ARRAY['session_start'::text, 'page_view'::text, 'login'::text, 'logout'::text, 'add_to_cart'::text, 'purchase'::text, 'session_end'::text])));
alter table only public.user_activities add constraint user_activities_metadata_check CHECK ((pg_column_size(metadata) <= 4096));
alter table only public.user_activities add constraint user_activities_path_check CHECK ((length(path) <= 2048));
alter table only public.user_activities add constraint user_activities_session_id_check CHECK ((length(session_id) <= 64));
alter table only public.user_consents add constraint user_consents_forwarded_for_check CHECK ((length(forwarded_for) <= 200));
alter table only public.user_consents add constraint user_consents_privacy_version_check CHECK ((length(privacy_version) <= 20));
alter table only public.user_consents add constraint user_consents_terms_version_check CHECK ((length(terms_version) <= 20));
alter table only public.user_consents add constraint user_consents_user_agent_check CHECK ((length(user_agent) <= 300));
alter table only public.user_course_progress add constraint user_course_progress_progress_check CHECK (((progress >= 0) AND (progress <= 100)));
alter table only public.withdrawals add constraint withdrawals_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])));
-- ===== chaves estrangeiras =====

alter table only public.affiliate_coupon_requests add constraint affiliate_coupon_requests_affiliate_id_fkey FOREIGN KEY (affiliate_id) REFERENCES public.platform_affiliates(id);
alter table only public.affiliate_coupon_requests add constraint affiliate_coupon_requests_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES public.coupons(id);
alter table only public.affiliate_coupon_requests add constraint affiliate_coupon_requests_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES public.profiles(id);
alter table only public.affiliate_links add constraint affiliate_links_affiliate_id_fkey FOREIGN KEY (affiliate_id) REFERENCES public.platform_affiliates(id);
alter table only public.affiliates add constraint affiliates_affiliate_user_id_fkey FOREIGN KEY (affiliate_user_id) REFERENCES public.profiles(id);
alter table only public.affiliates add constraint affiliates_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id);
alter table only public.affiliates add constraint affiliates_producer_id_fkey FOREIGN KEY (producer_id) REFERENCES public.profiles(id);
alter table only public.ai_credit_grants add constraint ai_credit_grants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table only public.ai_usage add constraint ai_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
alter table only public.certificates add constraint certificates_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id);
alter table only public.chat_contacts add constraint chat_contacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
alter table only public.chat_departments add constraint chat_departments_default_assignee_fkey FOREIGN KEY (default_assignee) REFERENCES public.profiles(id) ON DELETE SET NULL;
alter table only public.chat_topics add constraint chat_topics_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.chat_departments(id) ON DELETE RESTRICT;
alter table only public.check_ins add constraint check_ins_checked_in_by_fkey FOREIGN KEY (checked_in_by) REFERENCES public.profiles(id);
alter table only public.check_ins add constraint check_ins_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id);
alter table only public.check_ins add constraint check_ins_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);
alter table only public.check_ins add constraint check_ins_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);
alter table only public.collective_tables add constraint collective_tables_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
alter table only public.collective_tables add constraint collective_tables_ticket_type_id_fkey FOREIGN KEY (ticket_type_id) REFERENCES public.ticket_types(id);
alter table only public.conversation_messages add constraint conversation_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;
alter table only public.conversation_messages add constraint conversation_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
alter table only public.conversations add constraint conversations_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
alter table only public.conversations add constraint conversations_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.chat_contacts(id) ON DELETE SET NULL;
alter table only public.conversations add constraint conversations_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.chat_departments(id) ON DELETE SET NULL;
alter table only public.conversations add constraint conversations_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;
alter table only public.conversations add constraint conversations_producer_id_fkey FOREIGN KEY (producer_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
alter table only public.conversations add constraint conversations_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.chat_topics(id) ON DELETE SET NULL;
alter table only public.conversations add constraint conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
alter table only public.coupons add constraint coupons_affiliate_id_fkey FOREIGN KEY (affiliate_id) REFERENCES public.platform_affiliates(id);
alter table only public.coupons add constraint coupons_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);
alter table only public.coupons add constraint coupons_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id);
alter table only public.coupons add constraint coupons_producer_id_fkey FOREIGN KEY (producer_id) REFERENCES public.profiles(id);
alter table only public.crm_interactions add constraint crm_interactions_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.crm_leads(id) ON DELETE CASCADE;
alter table only public.crm_leads add constraint crm_leads_producer_id_fkey FOREIGN KEY (producer_id) REFERENCES public.profiles(id);
alter table only public.crm_leads add constraint crm_leads_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES public.pipeline_stages(id);
alter table only public.crm_tasks add constraint crm_tasks_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.crm_leads(id) ON DELETE CASCADE;
alter table only public.customers add constraint customers_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
alter table only public.customers add constraint customers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
alter table only public.event_banners add constraint event_banners_producer_id_fkey FOREIGN KEY (producer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table only public.event_budget_boxes add constraint event_budget_boxes_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
alter table only public.event_budget_boxes add constraint event_budget_boxes_producer_id_fkey FOREIGN KEY (producer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table only public.event_photos add constraint event_photos_producer_id_fkey FOREIGN KEY (producer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table only public.event_reviews add constraint event_reviews_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id);
alter table only public.event_reviews add constraint event_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);
alter table only public.event_surveys add constraint event_surveys_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
alter table only public.event_timeline_items add constraint event_timeline_items_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
alter table only public.event_timeline_items add constraint event_timeline_items_producer_id_fkey FOREIGN KEY (producer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table only public.event_zones add constraint event_zones_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
alter table only public.events add constraint events_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.profiles(id);
alter table only public.events add constraint events_producer_id_fkey FOREIGN KEY (producer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table only public.interest_lists add constraint interest_lists_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id);
alter table only public.interest_lists add constraint interest_lists_ticket_type_id_fkey FOREIGN KEY (ticket_type_id) REFERENCES public.ticket_types(id);
alter table only public.interest_lists add constraint interest_lists_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);
alter table only public.issued_certificates add constraint issued_certificates_certificate_id_fkey FOREIGN KEY (certificate_id) REFERENCES public.certificates(id);
alter table only public.issued_certificates add constraint issued_certificates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);
alter table only public.menu_items add constraint menu_items_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
alter table only public.menu_items add constraint menu_items_producer_id_fkey FOREIGN KEY (producer_id) REFERENCES public.profiles(id);
alter table only public.menu_order_items add constraint menu_order_items_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id);
alter table only public.menu_order_items add constraint menu_order_items_menu_order_id_fkey FOREIGN KEY (menu_order_id) REFERENCES public.menu_orders(id) ON DELETE CASCADE;
alter table only public.menu_orders add constraint menu_orders_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id);
alter table only public.menu_orders add constraint menu_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);
alter table only public.messages add constraint messages_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.crm_leads(id);
alter table only public.messages add constraint messages_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.profiles(id);
alter table only public.messages add constraint messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id);
alter table only public.notifications add constraint notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);
alter table only public.onboarding_logs add constraint onboarding_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table only public.order_items add constraint order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
alter table only public.order_items add constraint order_items_ticket_type_id_fkey FOREIGN KEY (ticket_type_id) REFERENCES public.ticket_types(id);
alter table only public.orders add constraint fk_orders_coupon FOREIGN KEY (coupon_id) REFERENCES public.coupons(id);
alter table only public.orders add constraint orders_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id);
alter table only public.orders add constraint orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);
alter table only public.partners add constraint partners_producer_id_fkey FOREIGN KEY (producer_id) REFERENCES public.profiles(id);
alter table only public.payments add constraint payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);
alter table only public.piggy_transactions add constraint piggy_transactions_box_id_fkey FOREIGN KEY (box_id) REFERENCES public.event_budget_boxes(id) ON DELETE CASCADE;
alter table only public.pipeline_stages add constraint pipeline_stages_producer_id_fkey FOREIGN KEY (producer_id) REFERENCES public.profiles(id);
alter table only public.platform_affiliate_producers add constraint platform_affiliate_producers_affiliate_id_fkey FOREIGN KEY (affiliate_id) REFERENCES public.platform_affiliates(id);
alter table only public.platform_affiliate_producers add constraint platform_affiliate_producers_affiliate_link_id_fkey FOREIGN KEY (affiliate_link_id) REFERENCES public.affiliate_links(id);
alter table only public.platform_affiliate_producers add constraint platform_affiliate_producers_linked_by_fkey FOREIGN KEY (linked_by) REFERENCES public.profiles(id);
alter table only public.platform_affiliate_producers add constraint platform_affiliate_producers_producer_id_fkey FOREIGN KEY (producer_id) REFERENCES public.profiles(id);
alter table only public.platform_affiliate_producers add constraint platform_affiliate_producers_ended_by_fkey FOREIGN KEY (ended_by) REFERENCES public.profiles(id);
alter table only public.platform_affiliates add constraint platform_affiliates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);
alter table only public.platform_affiliates add constraint platform_affiliates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);
alter table only public.platform_settings add constraint platform_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id);
alter table only public.policy_notices add constraint policy_notices_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table only public.producer_profiles add constraint producer_profiles_id_fkey FOREIGN KEY (id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table only public.producer_subscriptions add constraint producer_subscriptions_producer_id_fkey FOREIGN KEY (producer_id) REFERENCES public.profiles(id);
alter table only public.producer_tasks add constraint producer_tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id);
alter table only public.producer_tasks add constraint producer_tasks_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id);
alter table only public.producer_tasks add constraint producer_tasks_producer_id_fkey FOREIGN KEY (producer_id) REFERENCES public.profiles(id);
alter table only public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table only public.revenue_advances add constraint revenue_advances_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
alter table only public.revenue_advances add constraint revenue_advances_producer_id_fkey FOREIGN KEY (producer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table only public.seating_maps add constraint seating_maps_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
alter table only public.support_messages add constraint support_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.support_sessions(id) ON DELETE CASCADE;
alter table only public.support_sessions add constraint support_sessions_assigned_agent_id_fkey FOREIGN KEY (assigned_agent_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
alter table only public.support_sessions add constraint support_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
alter table only public.table_members add constraint table_members_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.collective_tables(id) ON DELETE CASCADE;
alter table only public.table_members add constraint table_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);
alter table only public.tasks add constraint tasks_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
alter table only public.tasks add constraint tasks_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
alter table only public.team_members add constraint team_members_producer_id_fkey FOREIGN KEY (producer_id) REFERENCES public.profiles(id);
alter table only public.team_members add constraint team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);
alter table only public.ticket_types add constraint ticket_types_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
alter table only public.tickets add constraint tickets_checked_in_by_fkey FOREIGN KEY (checked_in_by) REFERENCES public.profiles(id);
alter table only public.tickets add constraint tickets_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id);
alter table only public.tickets add constraint tickets_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);
alter table only public.tickets add constraint tickets_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id);
alter table only public.tickets add constraint tickets_ticket_type_id_fkey FOREIGN KEY (ticket_type_id) REFERENCES public.ticket_types(id);
alter table only public.tickets add constraint tickets_transferred_to_fkey FOREIGN KEY (transferred_to) REFERENCES public.profiles(id);
alter table only public.tickets add constraint tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);
alter table only public.transactions add constraint transactions_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id);
alter table only public.transactions add constraint transactions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);
alter table only public.transactions add constraint transactions_producer_id_fkey FOREIGN KEY (producer_id) REFERENCES public.profiles(id);
alter table only public.user_activities add constraint user_activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table only public.user_course_progress add constraint user_course_progress_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.academy_courses(id) ON DELETE CASCADE;
alter table only public.user_course_progress add constraint user_course_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table only public.user_custom_features add constraint user_custom_features_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table only public.user_preferences add constraint user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table only public.user_profiles_ext add constraint user_profiles_ext_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table only public.withdrawals add constraint withdrawals_producer_id_fkey FOREIGN KEY (producer_id) REFERENCES public.profiles(id);
-- ===== views =====

create view public.collective_table_summary with (security_invoker=true) as
 SELECT ct.id,
    ct.event_id,
    ct.ticket_type_id,
    ct.name,
    ct.theme,
    ct.capacity,
    ct.compatibility_score,
    ct.status,
    ct.created_at,
    COALESCE(count(tm.id), (0)::bigint) AS member_count,
    GREATEST((ct.capacity - COALESCE(count(tm.id), (0)::bigint)), (0)::bigint) AS remaining_spots
   FROM (public.collective_tables ct
     LEFT JOIN public.table_members tm ON ((tm.table_id = ct.id)))
  GROUP BY ct.id;
-- ===== materialized views =====

create materialized view public.event_summary as
 SELECT e.producer_id,
    e.id AS event_id,
    COALESCE(sum(tt.sold), (0)::bigint) AS tickets_sold,
    COALESCE(sum((tt.price * (tt.sold)::numeric)), (0)::numeric) AS total_revenue,
    count(DISTINCT o.user_id) AS unique_buyers
   FROM ((public.events e
     LEFT JOIN public.ticket_types tt ON ((tt.event_id = e.id)))
     LEFT JOIN public.orders o ON ((o.event_id = e.id)))
  WHERE (e.status = 'published'::text)
  GROUP BY e.producer_id, e.id
with no data;
-- ===== índices =====

CREATE INDEX access_logs_created_at_idx ON public.access_logs USING btree (created_at);
CREATE INDEX access_logs_user_id_idx ON public.access_logs USING btree (user_id);
CREATE INDEX affiliate_coupon_requests_affiliate_idx ON public.affiliate_coupon_requests USING btree (affiliate_id, created_at DESC);
CREATE INDEX ai_credit_grants_user_created_idx ON public.ai_credit_grants USING btree (user_id, created_at);
CREATE INDEX ai_usage_created_idx ON public.ai_usage USING btree (created_at);
CREATE INDEX ai_usage_user_created_idx ON public.ai_usage USING btree (user_id, created_at DESC);
CREATE INDEX chat_topics_department_idx ON public.chat_topics USING btree (department_id);
CREATE INDEX contact_messages_created_at_idx ON public.contact_messages USING btree (created_at DESC);
CREATE INDEX contact_rate_limit_hits_ip_created_at_idx ON public.contact_rate_limit_hits USING btree (ip, created_at);
CREATE INDEX conversation_messages_conv_created_idx ON public.conversation_messages USING btree (conversation_id, created_at);
CREATE INDEX conversation_messages_sender_created_idx ON public.conversation_messages USING btree (sender_id, created_at);
CREATE INDEX conversations_assignee_open_idx ON public.conversations USING btree (assignee_id) WHERE (status = 'open'::text);
CREATE INDEX conversations_status_last_idx ON public.conversations USING btree (status, last_message_at DESC);
CREATE INDEX conversations_user_last_idx ON public.conversations USING btree (user_id, last_message_at DESC);
CREATE UNIQUE INDEX coupons_code_upper_idx ON public.coupons USING btree (upper(code));
CREATE INDEX feedback_created_at_idx ON public.feedback USING btree (created_at DESC);
CREATE INDEX idx_advances_producer ON public.revenue_advances USING btree (producer_id);
CREATE INDEX idx_budget_boxes_producer ON public.event_budget_boxes USING btree (producer_id);
CREATE INDEX idx_course_progress_user ON public.user_course_progress USING btree (user_id);
CREATE INDEX idx_crm_leads_producer ON public.crm_leads USING btree (producer_id);
CREATE INDEX idx_custom_features_user ON public.user_custom_features USING btree (user_id);
CREATE INDEX idx_customers_event ON public.customers USING btree (event_id);
CREATE INDEX idx_event_banners_producer ON public.event_banners USING btree (producer_id);
CREATE INDEX idx_event_photos_producer ON public.event_photos USING btree (producer_id);
CREATE INDEX idx_events_date ON public.events USING btree (date);
CREATE INDEX idx_events_producer ON public.events USING btree (producer_id);
CREATE INDEX idx_events_slug ON public.events USING btree (slug);
CREATE INDEX idx_events_status ON public.events USING btree (status);
CREATE INDEX idx_onboarding_user ON public.onboarding_logs USING btree (user_id);
CREATE INDEX idx_orders_event ON public.orders USING btree (event_id);
CREATE INDEX idx_orders_user ON public.orders USING btree (user_id);
CREATE INDEX idx_piggy_box ON public.piggy_transactions USING btree (box_id);
CREATE INDEX idx_support_messages_session ON public.support_messages USING btree (session_id);
CREATE INDEX idx_surveys_event ON public.event_surveys USING btree (event_id);
CREATE INDEX idx_tasks_event ON public.tasks USING btree (event_id);
CREATE INDEX idx_ticket_types_event ON public.ticket_types USING btree (event_id);
CREATE INDEX idx_tickets_event ON public.tickets USING btree (event_id);
CREATE INDEX idx_tickets_user ON public.tickets USING btree (user_id);
CREATE INDEX idx_timeline_event ON public.event_timeline_items USING btree (event_id);
CREATE INDEX idx_user_activities_created_at ON public.user_activities USING btree (created_at DESC);
CREATE INDEX idx_user_activities_session_id ON public.user_activities USING btree (session_id);
CREATE INDEX idx_user_activities_user_id ON public.user_activities USING btree (user_id);
CREATE INDEX idx_zones_event ON public.event_zones USING btree (event_id);
CREATE UNIQUE INDEX newsletter_subscribers_email_lower_idx ON public.newsletter_subscribers USING btree (lower(email));
CREATE UNIQUE INDEX newsletter_subscribers_unsubscribe_token_idx ON public.newsletter_subscribers USING btree (unsubscribe_token);
CREATE INDEX platform_affiliate_producers_affiliate_idx ON public.platform_affiliate_producers USING btree (affiliate_id);
CREATE UNIQUE INDEX platform_affiliate_producers_ativo_idx ON public.platform_affiliate_producers USING btree (producer_id) WHERE (ended_at IS NULL);
CREATE UNIQUE INDEX platform_affiliates_code_upper_idx ON public.platform_affiliates USING btree (upper(referral_code));
CREATE UNIQUE INDEX platform_affiliates_cpf_idx ON public.platform_affiliates USING btree (cpf) WHERE (cpf IS NOT NULL);
CREATE UNIQUE INDEX platform_affiliates_payout_idx ON public.platform_affiliates USING btree (payout_account_id) WHERE (payout_account_id IS NOT NULL);
CREATE INDEX producer_subscriptions_producer_id_idx ON public.producer_subscriptions USING btree (producer_id);
CREATE INDEX user_activities_created_at_idx ON public.user_activities USING btree (created_at);
-- ===== gatilhos =====

CREATE TRIGGER gf_protect_affiliate_link BEFORE UPDATE ON public.affiliate_links FOR EACH ROW EXECUTE FUNCTION public.gf_protect_affiliate_link();
CREATE TRIGGER chat_messages_after_insert AFTER INSERT ON public.conversation_messages FOR EACH ROW EXECUTE FUNCTION public.chat_messages_after_insert();
CREATE TRIGGER tr_crm_leads_updated_at BEFORE UPDATE ON public.crm_leads FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER gf_protect_event_moderation BEFORE INSERT OR UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.gf_protect_event_moderation();
CREATE TRIGGER tr_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER tr_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER tr_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER gf_protect_producer_profile_privileges BEFORE INSERT OR UPDATE ON public.producer_profiles FOR EACH ROW EXECUTE FUNCTION public.gf_protect_producer_profile_privileges();
CREATE TRIGGER producer_profiles_updated_at BEFORE UPDATE ON public.producer_profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER tr_producer_profiles_updated_at BEFORE UPDATE ON public.producer_profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER gf_protect_profile_privileges BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.gf_protect_profile_privileges();
CREATE TRIGGER tr_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER seating_maps_updated_at BEFORE UPDATE ON public.seating_maps FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER tr_ticket_types_updated_at BEFORE UPDATE ON public.ticket_types FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
-- ===== RLS =====

alter table public.academy_courses enable row level security;
alter table public.access_logs enable row level security;
alter table public.affiliate_coupon_requests enable row level security;
alter table public.affiliate_links enable row level security;
alter table public.affiliates enable row level security;
alter table public.ai_credit_grants enable row level security;
alter table public.ai_settings enable row level security;
alter table public.ai_usage enable row level security;
alter table public.certificates enable row level security;
alter table public.chat_contacts enable row level security;
alter table public.chat_departments enable row level security;
alter table public.chat_settings enable row level security;
alter table public.chat_topics enable row level security;
alter table public.check_ins enable row level security;
alter table public.collective_tables enable row level security;
alter table public.contact_messages enable row level security;
alter table public.contact_rate_limit_hits enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.conversations enable row level security;
alter table public.coupons enable row level security;
alter table public.crm_interactions enable row level security;
alter table public.crm_leads enable row level security;
alter table public.crm_tasks enable row level security;
alter table public.customers enable row level security;
alter table public.event_banners enable row level security;
alter table public.event_budget_boxes enable row level security;
alter table public.event_photos enable row level security;
alter table public.event_reviews enable row level security;
alter table public.event_surveys enable row level security;
alter table public.event_timeline_items enable row level security;
alter table public.event_zones enable row level security;
alter table public.events enable row level security;
alter table public.feedback enable row level security;
alter table public.interest_lists enable row level security;
alter table public.issued_certificates enable row level security;
alter table public.menu_items enable row level security;
alter table public.menu_order_items enable row level security;
alter table public.menu_orders enable row level security;
alter table public.messages enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.newsletters enable row level security;
alter table public.notifications enable row level security;
alter table public.onboarding_logs enable row level security;
alter table public.order_items enable row level security;
alter table public.orders enable row level security;
alter table public.partners enable row level security;
alter table public.payments enable row level security;
alter table public.piggy_transactions enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.platform_affiliate_producers enable row level security;
alter table public.platform_affiliates enable row level security;
alter table public.platform_settings enable row level security;
alter table public.policy_notices enable row level security;
alter table public.producer_profiles enable row level security;
alter table public.producer_subscriptions enable row level security;
alter table public.producer_tasks enable row level security;
alter table public.profiles enable row level security;
alter table public.purchases enable row level security;
alter table public.revenue_advances enable row level security;
alter table public.seating_maps enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_sessions enable row level security;
alter table public.table_members enable row level security;
alter table public.tasks enable row level security;
alter table public.team_members enable row level security;
alter table public.ticket_types enable row level security;
alter table public.tickets enable row level security;
alter table public.transactions enable row level security;
alter table public.user_activities enable row level security;
alter table public.user_consents enable row level security;
alter table public.user_course_progress enable row level security;
alter table public.user_custom_features enable row level security;
alter table public.user_preferences enable row level security;
alter table public.user_profiles_ext enable row level security;
alter table public.withdrawals enable row level security;
-- ===== policies =====

create policy "Cursos publicos" on public.academy_courses as PERMISSIVE for SELECT to anon, authenticated
  using (true);
create policy gf_academy_admin_write on public.academy_courses as PERMISSIVE for ALL to public
  using (public.gf_is_admin())
  with check (public.gf_is_admin());
create policy gf_academy_read on public.academy_courses as PERMISSIVE for SELECT to public
  using (true);
create policy gf_mfa_aal2 on public.academy_courses as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_mfa_aal2 on public.access_logs as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy "Admin gerencia pedidos de cupom" on public.affiliate_coupon_requests as PERMISSIVE for ALL to authenticated
  using (( SELECT public.gf_is_admin() AS gf_is_admin))
  with check (( SELECT public.gf_is_admin() AS gf_is_admin));
create policy "Afiliado ativo cria pedido" on public.affiliate_coupon_requests as PERMISSIVE for INSERT to authenticated
  with check (((affiliate_id IN ( SELECT platform_affiliates.id
   FROM public.platform_affiliates
  WHERE ((platform_affiliates.user_id = ( SELECT auth.uid() AS uid)) AND (platform_affiliates.status = 'active'::text)))) AND (status = 'pending'::text) AND (coupon_id IS NULL) AND (decided_at IS NULL) AND (decided_by IS NULL) AND (admin_notes IS NULL)));
create policy "Afiliado le os proprios pedidos" on public.affiliate_coupon_requests as PERMISSIVE for SELECT to authenticated
  using ((affiliate_id IN ( SELECT platform_affiliates.id
   FROM public.platform_affiliates
  WHERE (platform_affiliates.user_id = ( SELECT auth.uid() AS uid)))));
create policy gf_mfa_aal2 on public.affiliate_coupon_requests as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy "Admin gerencia links de afiliado" on public.affiliate_links as PERMISSIVE for ALL to authenticated
  using (( SELECT public.gf_is_admin() AS gf_is_admin))
  with check (( SELECT public.gf_is_admin() AS gf_is_admin));
create policy "Afiliado ativo cria link" on public.affiliate_links as PERMISSIVE for INSERT to authenticated
  with check (((affiliate_id IN ( SELECT platform_affiliates.id
   FROM public.platform_affiliates
  WHERE ((platform_affiliates.user_id = ( SELECT auth.uid() AS uid)) AND (platform_affiliates.status = 'active'::text)))) AND (clicks = 0)));
create policy "Afiliado atualiza os proprios links" on public.affiliate_links as PERMISSIVE for UPDATE to authenticated
  using ((affiliate_id IN ( SELECT platform_affiliates.id
   FROM public.platform_affiliates
  WHERE (platform_affiliates.user_id = ( SELECT auth.uid() AS uid)))))
  with check ((affiliate_id IN ( SELECT platform_affiliates.id
   FROM public.platform_affiliates
  WHERE (platform_affiliates.user_id = ( SELECT auth.uid() AS uid)))));
create policy "Afiliado le os proprios links" on public.affiliate_links as PERMISSIVE for SELECT to authenticated
  using ((affiliate_id IN ( SELECT platform_affiliates.id
   FROM public.platform_affiliates
  WHERE (platform_affiliates.user_id = ( SELECT auth.uid() AS uid)))));
create policy gf_mfa_aal2 on public.affiliate_links as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_mfa_aal2 on public.affiliates as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy ai_credit_grants_admin_insert on public.ai_credit_grants as PERMISSIVE for INSERT to authenticated
  with check ((( SELECT public.gf_admin_can('manage_settings'::text) AS gf_admin_can) AND (created_by = ( SELECT auth.uid() AS uid))));
create policy ai_credit_grants_select_own_or_admin on public.ai_credit_grants as PERMISSIVE for SELECT to authenticated
  using (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.gf_admin_can('manage_settings'::text) AS gf_admin_can)));
create policy gf_mfa_aal2 on public.ai_credit_grants as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy ai_settings_admin_select on public.ai_settings as PERMISSIVE for SELECT to authenticated
  using (( SELECT public.gf_admin_can('manage_settings'::text) AS gf_admin_can));
create policy ai_settings_admin_update on public.ai_settings as PERMISSIVE for UPDATE to authenticated
  using (( SELECT public.gf_admin_can('manage_settings'::text) AS gf_admin_can))
  with check (( SELECT public.gf_admin_can('manage_settings'::text) AS gf_admin_can));
create policy gf_mfa_aal2 on public.ai_settings as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy ai_usage_select_own_or_admin on public.ai_usage as PERMISSIVE for SELECT to authenticated
  using (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.gf_admin_can('manage_settings'::text) AS gf_admin_can)));
create policy gf_mfa_aal2 on public.ai_usage as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy "Produtor gerencia certificates" on public.certificates as PERMISSIVE for ALL to authenticated
  using ((EXISTS ( SELECT 1
   FROM public.events e
  WHERE ((e.id = certificates.event_id) AND (e.producer_id = auth.uid())))));
create policy gf_mfa_aal2 on public.certificates as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy chat_contacts_select on public.chat_contacts as PERMISSIVE for SELECT to authenticated
  using (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.gf_admin_can('manage_support'::text) AS gf_admin_can)));
create policy gf_mfa_aal2 on public.chat_contacts as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy chat_departments_select on public.chat_departments as PERMISSIVE for SELECT to authenticated
  using ((active OR ( SELECT public.gf_admin_can('manage_support'::text) AS gf_admin_can)));
create policy gf_mfa_aal2 on public.chat_departments as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy chat_settings_select on public.chat_settings as PERMISSIVE for SELECT to authenticated
  using (( SELECT public.gf_admin_can('manage_support'::text) AS gf_admin_can));
create policy gf_mfa_aal2 on public.chat_settings as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy chat_topics_select on public.chat_topics as PERMISSIVE for SELECT to authenticated
  using ((active OR ( SELECT public.gf_admin_can('manage_support'::text) AS gf_admin_can)));
create policy gf_mfa_aal2 on public.chat_topics as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_check_ins_admin_select on public.check_ins as PERMISSIVE for SELECT to authenticated
  using (( SELECT public.gf_is_admin() AS gf_is_admin));
create policy gf_mfa_aal2 on public.check_ins as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_mfa_aal2 on public.collective_tables as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_contact_admin_read on public.contact_messages as PERMISSIVE for SELECT to public
  using (public.gf_is_admin());
create policy gf_contact_insert on public.contact_messages as PERMISSIVE for INSERT to public
  with check (true);
create policy gf_contact_messages_admin_all on public.contact_messages as PERMISSIVE for ALL to authenticated
  using (( SELECT public.gf_is_admin() AS gf_is_admin))
  with check (( SELECT public.gf_is_admin() AS gf_is_admin));
create policy gf_mfa_aal2 on public.contact_messages as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_mfa_aal2 on public.contact_rate_limit_hits as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy conversation_messages_select on public.conversation_messages as PERMISSIVE for SELECT to authenticated
  using (
CASE public.chat_role(conversation_id)
    WHEN 'agent'::text THEN true
    WHEN 'producer'::text THEN ((NOT is_internal) OR (sender_role = 'producer'::text))
    WHEN 'customer'::text THEN (NOT is_internal)
    ELSE false
END);
create policy gf_mfa_aal2 on public.conversation_messages as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy conversations_select on public.conversations as PERMISSIVE for SELECT to authenticated
  using ((public.chat_role(id) IS NOT NULL));
create policy gf_mfa_aal2 on public.conversations as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy "Admin gerencia coupons da plataforma" on public.coupons as PERMISSIVE for ALL to authenticated
  using (((producer_id IS NULL) AND ( SELECT public.gf_is_admin() AS gf_is_admin)))
  with check (((producer_id IS NULL) AND ( SELECT public.gf_is_admin() AS gf_is_admin)));
create policy "Admin le coupons" on public.coupons as PERMISSIVE for SELECT to authenticated
  using (( SELECT public.gf_is_admin() AS gf_is_admin));
create policy "Afiliado le os proprios cupons" on public.coupons as PERMISSIVE for SELECT to authenticated
  using ((affiliate_id IN ( SELECT platform_affiliates.id
   FROM public.platform_affiliates
  WHERE (platform_affiliates.user_id = ( SELECT auth.uid() AS uid)))));
create policy "Produtor gerencia coupons" on public.coupons as PERMISSIVE for ALL to authenticated
  using ((producer_id = auth.uid()))
  with check ((producer_id = auth.uid()));
create policy gf_mfa_aal2 on public.coupons as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_mfa_aal2 on public.crm_interactions as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_mfa_aal2 on public.crm_leads as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_mfa_aal2 on public.crm_tasks as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_customers_owner on public.customers as PERMISSIVE for ALL to public
  using ((public.gf_is_admin() OR (event_id IN ( SELECT events.id
   FROM public.events
  WHERE (events.producer_id = auth.uid())))))
  with check ((public.gf_is_admin() OR (event_id IN ( SELECT events.id
   FROM public.events
  WHERE (events.producer_id = auth.uid())))));
create policy gf_mfa_aal2 on public.customers as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy "Produtor gerencia banners" on public.event_banners as PERMISSIVE for ALL to authenticated
  using ((producer_id = auth.uid()))
  with check ((producer_id = auth.uid()));
create policy gf_event_banners_all on public.event_banners as PERMISSIVE for ALL to public
  using (((producer_id = auth.uid()) OR public.gf_is_admin()))
  with check (((producer_id = auth.uid()) OR public.gf_is_admin()));
create policy gf_mfa_aal2 on public.event_banners as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy "Produtor gerencia budget boxes" on public.event_budget_boxes as PERMISSIVE for ALL to authenticated
  using ((producer_id = auth.uid()))
  with check ((producer_id = auth.uid()));
create policy gf_budget_boxes_all on public.event_budget_boxes as PERMISSIVE for ALL to public
  using (((producer_id = auth.uid()) OR public.gf_is_admin()))
  with check (((producer_id = auth.uid()) OR public.gf_is_admin()));
create policy gf_mfa_aal2 on public.event_budget_boxes as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy "Produtor gerencia fotos" on public.event_photos as PERMISSIVE for ALL to authenticated
  using ((producer_id = auth.uid()))
  with check ((producer_id = auth.uid()));
create policy gf_event_photos_all on public.event_photos as PERMISSIVE for ALL to public
  using (((producer_id = auth.uid()) OR public.gf_is_admin()))
  with check (((producer_id = auth.uid()) OR public.gf_is_admin()));
create policy gf_mfa_aal2 on public.event_photos as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_mfa_aal2 on public.event_reviews as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy "Produtor ve surveys do evento" on public.event_surveys as PERMISSIVE for ALL to authenticated
  using ((EXISTS ( SELECT 1
   FROM public.events e
  WHERE ((e.id = event_surveys.event_id) AND (e.producer_id = auth.uid())))));
create policy gf_event_surveys_insert on public.event_surveys as PERMISSIVE for INSERT to authenticated
  with check ((EXISTS ( SELECT 1
   FROM public.tickets t
  WHERE ((t.event_id = event_surveys.event_id) AND (t.user_id = ( SELECT auth.uid() AS uid))))));
create policy gf_event_surveys_owner on public.event_surveys as PERMISSIVE for ALL to public
  using ((public.gf_is_admin() OR (event_id IN ( SELECT events.id
   FROM public.events
  WHERE (events.producer_id = auth.uid())))))
  with check ((public.gf_is_admin() OR (event_id IN ( SELECT events.id
   FROM public.events
  WHERE (events.producer_id = auth.uid())))));
create policy gf_mfa_aal2 on public.event_surveys as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy "Produtor gerencia timeline" on public.event_timeline_items as PERMISSIVE for ALL to authenticated
  using ((producer_id = auth.uid()))
  with check ((producer_id = auth.uid()));
create policy gf_event_timeline_all on public.event_timeline_items as PERMISSIVE for ALL to public
  using (((producer_id = auth.uid()) OR public.gf_is_admin()))
  with check (((producer_id = auth.uid()) OR public.gf_is_admin()));
create policy gf_mfa_aal2 on public.event_timeline_items as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy "Produtor gerencia zones" on public.event_zones as PERMISSIVE for ALL to authenticated
  using ((EXISTS ( SELECT 1
   FROM public.events e
  WHERE ((e.id = event_zones.event_id) AND (e.producer_id = auth.uid())))));
create policy gf_event_zones_owner on public.event_zones as PERMISSIVE for ALL to public
  using ((public.gf_is_admin() OR (event_id IN ( SELECT events.id
   FROM public.events
  WHERE (events.producer_id = auth.uid())))))
  with check ((public.gf_is_admin() OR (event_id IN ( SELECT events.id
   FROM public.events
  WHERE (events.producer_id = auth.uid())))));
create policy gf_mfa_aal2 on public.event_zones as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy "Eventos públicos ou do produtor" on public.events as PERMISSIVE for SELECT to public
  using ((((status = 'published'::text) AND (approval_status = 'approved'::text)) OR (( SELECT auth.uid() AS uid) = producer_id)));
create policy "Produtor gerencia eventos" on public.events as PERMISSIVE for ALL to authenticated
  using ((producer_id = auth.uid()))
  with check ((producer_id = auth.uid()));
create policy "Produtores gerenciam próprios eventos" on public.events as PERMISSIVE for ALL to public
  using ((auth.uid() = producer_id))
  with check ((auth.uid() = producer_id));
create policy "Quem tem ingresso lê o evento" on public.events as PERMISSIVE for SELECT to authenticated
  using (public.tem_ingresso(id));
create policy gf_events_admin_select on public.events as PERMISSIVE for SELECT to authenticated
  using (( SELECT public.gf_is_admin() AS gf_is_admin));
create policy gf_events_admin_write on public.events as PERMISSIVE for ALL to authenticated
  using (( SELECT public.gf_admin_can('manage_events'::text) AS gf_admin_can))
  with check (( SELECT public.gf_admin_can('manage_events'::text) AS gf_admin_can));
create policy gf_mfa_aal2 on public.events as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_feedback_admin_delete on public.feedback as PERMISSIVE for DELETE to authenticated
  using (( SELECT public.gf_is_admin() AS gf_is_admin));
create policy gf_feedback_admin_select on public.feedback as PERMISSIVE for SELECT to authenticated
  using (( SELECT public.gf_is_admin() AS gf_is_admin));
create policy gf_feedback_admin_update on public.feedback as PERMISSIVE for UPDATE to authenticated
  using (( SELECT public.gf_is_admin() AS gf_is_admin))
  with check (( SELECT public.gf_is_admin() AS gf_is_admin));
create policy gf_feedback_insert on public.feedback as PERMISSIVE for INSERT to anon, authenticated
  with check ((((length(COALESCE(message, ''::text)) >= 1) AND (length(COALESCE(message, ''::text)) <= 2000)) AND ((rating IS NULL) OR ((rating >= 1) AND (rating <= 5))) AND (status = 'novo'::text) AND (admin_notes IS NULL)));
create policy gf_mfa_aal2 on public.feedback as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_mfa_aal2 on public.interest_lists as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_mfa_aal2 on public.issued_certificates as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_mfa_aal2 on public.menu_items as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_mfa_aal2 on public.menu_order_items as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_mfa_aal2 on public.menu_orders as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_mfa_aal2 on public.messages as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy "Apenas admins gerenciam subscribers" on public.newsletter_subscribers as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
create policy "Qualquer pessoa pode se inscrever" on public.newsletter_subscribers as PERMISSIVE for INSERT to public
  with check (true);
create policy gf_mfa_aal2 on public.newsletter_subscribers as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy "Apenas admins leem e gerenciam campanhas" on public.newsletters as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
create policy gf_mfa_aal2 on public.newsletters as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_mfa_aal2 on public.notifications as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_mfa_aal2 on public.onboarding_logs as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_onboarding_all on public.onboarding_logs as PERMISSIVE for ALL to public
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
create policy "Produtores leem itens de compras dos seus eventos" on public.order_items as PERMISSIVE for SELECT to public
  using ((EXISTS ( SELECT 1
   FROM public.orders
  WHERE ((orders.id = order_items.order_id) AND (EXISTS ( SELECT 1
           FROM public.events
          WHERE ((events.id = orders.event_id) AND (events.producer_id = auth.uid()))))))));
create policy "Usuários inserem itens da própria compra" on public.order_items as PERMISSIVE for INSERT to authenticated
  with check (((quantity > 0) AND (EXISTS ( SELECT 1
   FROM ((public.orders o
     JOIN public.ticket_types tt ON (((tt.id = order_items.ticket_type_id) AND (tt.event_id = o.event_id))))
     JOIN public.events e ON ((e.id = o.event_id)))
  WHERE ((o.id = order_items.order_id) AND (o.user_id = auth.uid()) AND (o.status = 'pending'::text) AND tt.is_active AND (e.status = 'published'::text) AND (e.approval_status = 'approved'::text))))));
create policy "Usuários leem próprios itens de compras" on public.order_items as PERMISSIVE for SELECT to public
  using ((EXISTS ( SELECT 1
   FROM public.orders
  WHERE ((orders.id = order_items.order_id) AND (orders.user_id = auth.uid())))));
create policy gf_mfa_aal2 on public.order_items as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_order_items_admin_select on public.order_items as PERMISSIVE for SELECT to authenticated
  using (( SELECT public.gf_is_admin() AS gf_is_admin));
create policy "Produtores leem compras dos próprios eventos" on public.orders as PERMISSIVE for SELECT to public
  using ((EXISTS ( SELECT 1
   FROM public.events
  WHERE ((events.id = orders.event_id) AND (events.producer_id = auth.uid())))));
create policy "Usuários criam próprias compras" on public.orders as PERMISSIVE for INSERT to authenticated
  with check (((auth.uid() = user_id) AND (status = 'pending'::text)));
create policy "Usuários leem próprias compras" on public.orders as PERMISSIVE for SELECT to public
  using ((auth.uid() = user_id));
create policy gf_mfa_aal2 on public.orders as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_orders_admin_select on public.orders as PERMISSIVE for SELECT to authenticated
  using (( SELECT public.gf_is_admin() AS gf_is_admin));
create policy "Produtor gerencia partners" on public.partners as PERMISSIVE for ALL to authenticated
  using ((producer_id = auth.uid()))
  with check ((producer_id = auth.uid()));
create policy gf_mfa_aal2 on public.partners as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy "Produtores veem pagamentos dos seus eventos" on public.payments as PERMISSIVE for SELECT to public
  using ((EXISTS ( SELECT 1
   FROM public.orders
  WHERE ((orders.id = payments.order_id) AND (EXISTS ( SELECT 1
           FROM public.events
          WHERE ((events.id = orders.event_id) AND (events.producer_id = auth.uid()))))))));
create policy "Usuários veem próprios pagamentos" on public.payments as PERMISSIVE for SELECT to public
  using ((EXISTS ( SELECT 1
   FROM public.orders
  WHERE ((orders.id = payments.order_id) AND (orders.user_id = auth.uid())))));
create policy gf_mfa_aal2 on public.payments as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy "Produtor ve transactions" on public.piggy_transactions as PERMISSIVE for ALL to authenticated
  using ((EXISTS ( SELECT 1
   FROM public.event_budget_boxes b
  WHERE ((b.id = piggy_transactions.box_id) AND (b.producer_id = auth.uid())))));
create policy gf_mfa_aal2 on public.piggy_transactions as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_piggy_tx_owner on public.piggy_transactions as PERMISSIVE for ALL to public
  using ((public.gf_is_admin() OR (box_id IN ( SELECT event_budget_boxes.id
   FROM public.event_budget_boxes
  WHERE (event_budget_boxes.producer_id = auth.uid())))))
  with check ((public.gf_is_admin() OR (box_id IN ( SELECT event_budget_boxes.id
   FROM public.event_budget_boxes
  WHERE (event_budget_boxes.producer_id = auth.uid())))));
create policy gf_mfa_aal2 on public.pipeline_stages as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy "Admin gerencia indicados de afiliados" on public.platform_affiliate_producers as PERMISSIVE for ALL to authenticated
  using (( SELECT public.gf_is_admin() AS gf_is_admin))
  with check (( SELECT public.gf_is_admin() AS gf_is_admin));
create policy "Afiliado le os proprios indicados" on public.platform_affiliate_producers as PERMISSIVE for SELECT to authenticated
  using ((affiliate_id IN ( SELECT platform_affiliates.id
   FROM public.platform_affiliates
  WHERE (platform_affiliates.user_id = ( SELECT auth.uid() AS uid)))));
create policy gf_mfa_aal2 on public.platform_affiliate_producers as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy "Admin gerencia afiliados evokaa" on public.platform_affiliates as PERMISSIVE for ALL to authenticated
  using (( SELECT public.gf_is_admin() AS gf_is_admin))
  with check (( SELECT public.gf_is_admin() AS gf_is_admin));
create policy "Afiliado le o proprio cadastro" on public.platform_affiliates as PERMISSIVE for SELECT to authenticated
  using ((user_id = ( SELECT auth.uid() AS uid)));
create policy gf_mfa_aal2 on public.platform_affiliates as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_mfa_aal2 on public.platform_settings as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_platform_settings_admin_all on public.platform_settings as PERMISSIVE for ALL to authenticated
  using (( SELECT public.gf_is_admin() AS gf_is_admin))
  with check (( SELECT public.gf_is_admin() AS gf_is_admin));
create policy gf_platform_settings_public_read on public.platform_settings as PERMISSIVE for SELECT to anon, authenticated
  using ((key = ANY (ARRAY['general'::text, 'fees'::text])));
create policy gf_mfa_aal2 on public.policy_notices as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy "Produtores gerenciam próprio perfil" on public.producer_profiles as PERMISSIVE for ALL to public
  using ((auth.uid() = id))
  with check ((auth.uid() = id));
create policy gf_mfa_aal2 on public.producer_profiles as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_producer_profiles_admin_insert on public.producer_profiles as PERMISSIVE for INSERT to authenticated
  with check (( SELECT public.gf_is_admin() AS gf_is_admin));
create policy gf_producer_profiles_admin_update on public.producer_profiles as PERMISSIVE for UPDATE to authenticated
  using (( SELECT public.gf_is_admin() AS gf_is_admin))
  with check (( SELECT public.gf_is_admin() AS gf_is_admin));
create policy gf_producer_profiles_select_own_or_admin on public.producer_profiles as PERMISSIVE for SELECT to authenticated
  using (((id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.gf_is_admin() AS gf_is_admin)));
create policy gf_mfa_aal2 on public.producer_subscriptions as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_producer_subscriptions_admin_all on public.producer_subscriptions as PERMISSIVE for ALL to authenticated
  using (( SELECT public.gf_is_admin() AS gf_is_admin))
  with check (( SELECT public.gf_is_admin() AS gf_is_admin));
create policy gf_producer_subscriptions_owner_select on public.producer_subscriptions as PERMISSIVE for SELECT to authenticated
  using ((producer_id = ( SELECT auth.uid() AS uid)));
create policy "Produtor gerencia tasks" on public.producer_tasks as PERMISSIVE for ALL to authenticated
  using ((producer_id = auth.uid()))
  with check ((producer_id = auth.uid()));
create policy gf_mfa_aal2 on public.producer_tasks as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy "Usuários modificam próprio perfil" on public.profiles as PERMISSIVE for UPDATE to public
  using ((auth.uid() = id))
  with check ((auth.uid() = id));
create policy gf_mfa_aal2 on public.profiles as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_profiles_admin_update on public.profiles as PERMISSIVE for UPDATE to authenticated
  using ((( SELECT public.gf_admin_can('manage_users'::text) AS gf_admin_can) AND ((role <> 'admin'::text) OR ( SELECT public.gf_admin_can('super_admin'::text) AS gf_admin_can))))
  with check ((( SELECT public.gf_admin_can('manage_users'::text) AS gf_admin_can) AND ((role <> 'admin'::text) OR ( SELECT public.gf_admin_can('super_admin'::text) AS gf_admin_can))));
create policy gf_profiles_select_own_or_admin on public.profiles as PERMISSIVE for SELECT to authenticated
  using (((id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.gf_is_admin() AS gf_is_admin)));
create policy gf_mfa_aal2 on public.purchases as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_mfa_aal2 on public.revenue_advances as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_revenue_advances_admin_delete on public.revenue_advances as PERMISSIVE for DELETE to authenticated
  using (( SELECT public.gf_is_admin() AS gf_is_admin));
create policy gf_revenue_advances_admin_update on public.revenue_advances as PERMISSIVE for UPDATE to authenticated
  using (( SELECT public.gf_is_admin() AS gf_is_admin))
  with check (( SELECT public.gf_is_admin() AS gf_is_admin));
create policy gf_revenue_advances_insert on public.revenue_advances as PERMISSIVE for INSERT to authenticated
  with check (((producer_id = ( SELECT auth.uid() AS uid)) AND (status = 'requested'::text) AND (transferred_at IS NULL) AND (event_id IN ( SELECT events.id
   FROM public.events
  WHERE (events.producer_id = ( SELECT auth.uid() AS uid))))));
create policy gf_revenue_advances_select on public.revenue_advances as PERMISSIVE for SELECT to authenticated
  using (((producer_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.gf_is_admin() AS gf_is_admin)));
create policy "Anyone can read active seating maps" on public.seating_maps as PERMISSIVE for SELECT to public
  using ((is_active = true));
create policy "Producers can manage own seating maps" on public.seating_maps as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM public.events
  WHERE ((events.id = seating_maps.event_id) AND (events.producer_id = auth.uid())))));
create policy gf_mfa_aal2 on public.seating_maps as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_mfa_aal2 on public.support_messages as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy support_messages_delete on public.support_messages as PERMISSIVE for DELETE to authenticated
  using (( SELECT public.gf_is_admin() AS gf_is_admin));
create policy support_messages_insert on public.support_messages as PERMISSIVE for INSERT to authenticated
  with check ((( SELECT public.gf_is_admin() AS gf_is_admin) OR ((session_id IN ( SELECT s.id
   FROM public.support_sessions s
  WHERE (s.user_id = ( SELECT auth.uid() AS uid)))) AND (sender_type = 'visitor'::text) AND (sender_id = ( SELECT auth.uid() AS uid)))));
create policy support_messages_select on public.support_messages as PERMISSIVE for SELECT to authenticated
  using ((( SELECT public.gf_is_admin() AS gf_is_admin) OR (session_id IN ( SELECT s.id
   FROM public.support_sessions s
  WHERE (s.user_id = ( SELECT auth.uid() AS uid))))));
create policy support_messages_update on public.support_messages as PERMISSIVE for UPDATE to authenticated
  using ((( SELECT public.gf_is_admin() AS gf_is_admin) OR (session_id IN ( SELECT s.id
   FROM public.support_sessions s
  WHERE (s.user_id = ( SELECT auth.uid() AS uid))))))
  with check ((( SELECT public.gf_is_admin() AS gf_is_admin) OR (session_id IN ( SELECT s.id
   FROM public.support_sessions s
  WHERE (s.user_id = ( SELECT auth.uid() AS uid))))));
create policy gf_mfa_aal2 on public.support_sessions as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_support_sessions_owner on public.support_sessions as PERMISSIVE for ALL to public
  using (((user_id = auth.uid()) OR public.gf_is_admin()))
  with check (((user_id = auth.uid()) OR public.gf_is_admin()));
create policy gf_mfa_aal2 on public.table_members as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_mfa_aal2 on public.tasks as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_tasks_assignee_read on public.tasks as PERMISSIVE for SELECT to public
  using ((assignee_id = ( SELECT auth.uid() AS uid)));
create policy gf_tasks_owner on public.tasks as PERMISSIVE for ALL to public
  using ((( SELECT public.gf_is_admin() AS gf_is_admin) OR (event_id IN ( SELECT events.id
   FROM public.events
  WHERE (events.producer_id = ( SELECT auth.uid() AS uid))))))
  with check ((( SELECT public.gf_is_admin() AS gf_is_admin) OR (event_id IN ( SELECT events.id
   FROM public.events
  WHERE (events.producer_id = ( SELECT auth.uid() AS uid))))));
create policy gf_mfa_aal2 on public.team_members as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy "Ingressos à venda de evento aprovado" on public.ticket_types as PERMISSIVE for SELECT to anon, authenticated
  using ((is_active AND (EXISTS ( SELECT 1
   FROM public.events e
  WHERE ((e.id = ticket_types.event_id) AND (e.status = 'published'::text) AND (e.approval_status = 'approved'::text))))));
create policy "Produtores gerenciam ingressos dos próprios eventos" on public.ticket_types as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM public.events
  WHERE ((events.id = ticket_types.event_id) AND (events.producer_id = auth.uid())))));
create policy "Quem tem ingresso lê o tipo" on public.ticket_types as PERMISSIVE for SELECT to authenticated
  using ((id IN ( SELECT t.ticket_type_id
   FROM public.tickets t
  WHERE (t.user_id = ( SELECT auth.uid() AS uid)))));
create policy gf_mfa_aal2 on public.ticket_types as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_ticket_types_admin_select on public.ticket_types as PERMISSIVE for SELECT to authenticated
  using (( SELECT public.gf_is_admin() AS gf_is_admin));
create policy "Produtores leem ingressos dos próprios eventos" on public.tickets as PERMISSIVE for SELECT to public
  using ((EXISTS ( SELECT 1
   FROM public.events
  WHERE ((events.id = tickets.event_id) AND (events.producer_id = auth.uid())))));
create policy "Usuários leem seus ingressos" on public.tickets as PERMISSIVE for SELECT to public
  using ((user_id = auth.uid()));
create policy gf_mfa_aal2 on public.tickets as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_tickets_admin_select on public.tickets as PERMISSIVE for SELECT to authenticated
  using (( SELECT public.gf_is_admin() AS gf_is_admin));
create policy gf_mfa_aal2 on public.transactions as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_transactions_admin_select on public.transactions as PERMISSIVE for SELECT to authenticated
  using (( SELECT public.gf_is_admin() AS gf_is_admin));
create policy gf_mfa_aal2 on public.user_activities as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy user_activities_insert_own on public.user_activities as PERMISSIVE for INSERT to anon, authenticated
  with check (((user_id IS NULL) OR (user_id = ( SELECT auth.uid() AS uid))));
create policy user_activities_select_admin on public.user_activities as PERMISSIVE for SELECT to authenticated
  using (public.gf_is_admin());
create policy user_activities_select_own on public.user_activities as PERMISSIVE for SELECT to authenticated
  using ((user_id = ( SELECT auth.uid() AS uid)));
create policy gf_mfa_aal2 on public.user_consents as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy user_consents_select_own on public.user_consents as PERMISSIVE for SELECT to authenticated
  using ((user_id = auth.uid()));
create policy "Usuario ve proprio progresso" on public.user_course_progress as PERMISSIVE for ALL to authenticated
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
create policy gf_course_progress_all on public.user_course_progress as PERMISSIVE for ALL to public
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
create policy gf_mfa_aal2 on public.user_course_progress as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_custom_features_admin_write on public.user_custom_features as PERMISSIVE for ALL to public
  using (public.gf_is_admin())
  with check (public.gf_is_admin());
create policy gf_custom_features_read on public.user_custom_features as PERMISSIVE for SELECT to public
  using (((user_id = auth.uid()) OR public.gf_is_admin()));
create policy gf_mfa_aal2 on public.user_custom_features as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_mfa_aal2 on public.user_preferences as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_user_preferences_all on public.user_preferences as PERMISSIVE for ALL to public
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
create policy gf_mfa_aal2 on public.user_profiles_ext as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_profiles_ext_owner on public.user_profiles_ext as PERMISSIVE for ALL to public
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
create policy gf_mfa_aal2 on public.withdrawals as RESTRICTIVE for ALL to authenticated
  using (( SELECT public.gf_mfa_ok() AS gf_mfa_ok))
  with check (( SELECT public.gf_mfa_ok() AS gf_mfa_ok));
create policy gf_withdrawals_admin_select on public.withdrawals as PERMISSIVE for SELECT to authenticated
  using (( SELECT public.gf_is_admin() AS gf_is_admin));
create policy gf_withdrawals_admin_update on public.withdrawals as PERMISSIVE for UPDATE to authenticated
  using (( SELECT public.gf_is_admin() AS gf_is_admin))
  with check (( SELECT public.gf_is_admin() AS gf_is_admin));
-- ===== grants: zera o padrão local =====

revoke all on table public.academy_courses from public, anon, authenticated, service_role;
revoke all on table public.access_logs from public, anon, authenticated, service_role;
revoke all on table public.affiliate_coupon_requests from public, anon, authenticated, service_role;
revoke all on table public.affiliate_links from public, anon, authenticated, service_role;
revoke all on table public.affiliates from public, anon, authenticated, service_role;
revoke all on table public.ai_credit_grants from public, anon, authenticated, service_role;
revoke all on table public.ai_settings from public, anon, authenticated, service_role;
revoke all on table public.ai_usage from public, anon, authenticated, service_role;
revoke all on table public.certificates from public, anon, authenticated, service_role;
revoke all on table public.chat_contacts from public, anon, authenticated, service_role;
revoke all on table public.chat_departments from public, anon, authenticated, service_role;
revoke all on table public.chat_settings from public, anon, authenticated, service_role;
revoke all on table public.chat_topics from public, anon, authenticated, service_role;
revoke all on table public.check_ins from public, anon, authenticated, service_role;
revoke all on table public.collective_table_summary from public, anon, authenticated, service_role;
revoke all on table public.collective_tables from public, anon, authenticated, service_role;
revoke all on table public.contact_messages from public, anon, authenticated, service_role;
revoke all on table public.contact_rate_limit_hits from public, anon, authenticated, service_role;
revoke all on sequence public.contact_rate_limit_hits_id_seq from public, anon, authenticated, service_role;
revoke all on table public.conversation_messages from public, anon, authenticated, service_role;
revoke all on table public.conversations from public, anon, authenticated, service_role;
revoke all on table public.coupons from public, anon, authenticated, service_role;
revoke all on table public.crm_interactions from public, anon, authenticated, service_role;
revoke all on table public.crm_leads from public, anon, authenticated, service_role;
revoke all on table public.crm_tasks from public, anon, authenticated, service_role;
revoke all on table public.customers from public, anon, authenticated, service_role;
revoke all on table public.event_banners from public, anon, authenticated, service_role;
revoke all on table public.event_budget_boxes from public, anon, authenticated, service_role;
revoke all on table public.event_photos from public, anon, authenticated, service_role;
revoke all on table public.event_reviews from public, anon, authenticated, service_role;
revoke all on table public.event_summary from public, anon, authenticated, service_role;
revoke all on table public.event_surveys from public, anon, authenticated, service_role;
revoke all on table public.event_timeline_items from public, anon, authenticated, service_role;
revoke all on table public.event_zones from public, anon, authenticated, service_role;
revoke all on table public.events from public, anon, authenticated, service_role;
revoke all on table public.feedback from public, anon, authenticated, service_role;
revoke all on table public.interest_lists from public, anon, authenticated, service_role;
revoke all on table public.issued_certificates from public, anon, authenticated, service_role;
revoke all on table public.menu_items from public, anon, authenticated, service_role;
revoke all on table public.menu_order_items from public, anon, authenticated, service_role;
revoke all on table public.menu_orders from public, anon, authenticated, service_role;
revoke all on table public.messages from public, anon, authenticated, service_role;
revoke all on table public.newsletter_subscribers from public, anon, authenticated, service_role;
revoke all on table public.newsletters from public, anon, authenticated, service_role;
revoke all on table public.notifications from public, anon, authenticated, service_role;
revoke all on table public.onboarding_logs from public, anon, authenticated, service_role;
revoke all on table public.order_items from public, anon, authenticated, service_role;
revoke all on table public.orders from public, anon, authenticated, service_role;
revoke all on table public.partners from public, anon, authenticated, service_role;
revoke all on table public.payments from public, anon, authenticated, service_role;
revoke all on table public.piggy_transactions from public, anon, authenticated, service_role;
revoke all on table public.pipeline_stages from public, anon, authenticated, service_role;
revoke all on table public.platform_affiliate_producers from public, anon, authenticated, service_role;
revoke all on table public.platform_affiliates from public, anon, authenticated, service_role;
revoke all on table public.platform_settings from public, anon, authenticated, service_role;
revoke all on table public.policy_notices from public, anon, authenticated, service_role;
revoke all on table public.producer_profiles from public, anon, authenticated, service_role;
revoke all on table public.producer_subscriptions from public, anon, authenticated, service_role;
revoke all on table public.producer_tasks from public, anon, authenticated, service_role;
revoke all on table public.profiles from public, anon, authenticated, service_role;
revoke all on table public.purchases from public, anon, authenticated, service_role;
revoke all on table public.revenue_advances from public, anon, authenticated, service_role;
revoke all on table public.seating_maps from public, anon, authenticated, service_role;
revoke all on table public.support_messages from public, anon, authenticated, service_role;
revoke all on table public.support_sessions from public, anon, authenticated, service_role;
revoke all on table public.table_members from public, anon, authenticated, service_role;
revoke all on table public.tasks from public, anon, authenticated, service_role;
revoke all on table public.team_members from public, anon, authenticated, service_role;
revoke all on table public.ticket_types from public, anon, authenticated, service_role;
revoke all on table public.tickets from public, anon, authenticated, service_role;
revoke all on table public.transactions from public, anon, authenticated, service_role;
revoke all on table public.user_activities from public, anon, authenticated, service_role;
revoke all on table public.user_consents from public, anon, authenticated, service_role;
revoke all on table public.user_course_progress from public, anon, authenticated, service_role;
revoke all on table public.user_custom_features from public, anon, authenticated, service_role;
revoke all on table public.user_preferences from public, anon, authenticated, service_role;
revoke all on table public.user_profiles_ext from public, anon, authenticated, service_role;
revoke all on table public.withdrawals from public, anon, authenticated, service_role;
-- ===== grants da produção =====

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.academy_courses to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.academy_courses to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.academy_courses to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.access_logs to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.affiliate_coupon_requests to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.affiliate_coupon_requests to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.affiliate_coupon_requests to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.affiliate_links to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.affiliate_links to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.affiliate_links to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.affiliates to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.affiliates to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.affiliates to service_role;
grant INSERT, SELECT on table public.ai_credit_grants to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ai_credit_grants to service_role;
grant SELECT, UPDATE on table public.ai_settings to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ai_settings to service_role;
grant SELECT on table public.ai_usage to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ai_usage to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.certificates to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.certificates to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.certificates to service_role;
grant SELECT on table public.chat_contacts to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.chat_contacts to service_role;
grant SELECT on table public.chat_departments to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.chat_departments to service_role;
grant SELECT on table public.chat_settings to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.chat_settings to service_role;
grant SELECT on table public.chat_topics to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.chat_topics to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.check_ins to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.check_ins to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.check_ins to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, TRIGGER, TRUNCATE, UPDATE on table public.collective_table_summary to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.collective_table_summary to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.collective_table_summary to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.collective_tables to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.collective_tables to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.collective_tables to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.contact_messages to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.contact_messages to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.contact_messages to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.contact_rate_limit_hits to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.contact_rate_limit_hits to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.contact_rate_limit_hits to service_role;
grant SELECT, UPDATE, USAGE on sequence public.contact_rate_limit_hits_id_seq to anon;
grant SELECT, UPDATE, USAGE on sequence public.contact_rate_limit_hits_id_seq to authenticated;
grant SELECT, UPDATE, USAGE on sequence public.contact_rate_limit_hits_id_seq to service_role;
grant SELECT on table public.conversation_messages to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.conversation_messages to service_role;
grant SELECT on table public.conversations to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.conversations to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.coupons to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.coupons to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.coupons to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.crm_interactions to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.crm_interactions to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.crm_interactions to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.crm_leads to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.crm_leads to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.crm_leads to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.crm_tasks to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.crm_tasks to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.crm_tasks to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.customers to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.customers to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.customers to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_banners to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_banners to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_banners to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_budget_boxes to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_budget_boxes to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_budget_boxes to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_photos to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_photos to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_photos to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_reviews to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_reviews to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_reviews to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, TRIGGER, TRUNCATE, UPDATE on table public.event_summary to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, TRIGGER, TRUNCATE, UPDATE on table public.event_summary to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_summary to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_surveys to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_surveys to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_surveys to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_timeline_items to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_timeline_items to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_timeline_items to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_zones to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_zones to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.event_zones to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.events to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.events to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.events to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.feedback to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.feedback to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.feedback to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.interest_lists to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.interest_lists to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.interest_lists to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.issued_certificates to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.issued_certificates to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.issued_certificates to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.menu_items to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.menu_items to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.menu_items to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.menu_order_items to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.menu_order_items to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.menu_order_items to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.menu_orders to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.menu_orders to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.menu_orders to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.messages to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.messages to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.messages to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.newsletter_subscribers to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.newsletter_subscribers to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.newsletter_subscribers to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.newsletters to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.newsletters to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.newsletters to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.notifications to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.notifications to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.notifications to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.onboarding_logs to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.onboarding_logs to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.onboarding_logs to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.order_items to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.order_items to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.order_items to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.orders to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.orders to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.orders to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.partners to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.partners to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.partners to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.payments to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.payments to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.payments to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.piggy_transactions to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.piggy_transactions to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.piggy_transactions to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.pipeline_stages to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.pipeline_stages to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.pipeline_stages to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.platform_affiliate_producers to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.platform_affiliate_producers to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.platform_affiliate_producers to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.platform_affiliates to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.platform_affiliates to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.platform_affiliates to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.platform_settings to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.platform_settings to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.platform_settings to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.policy_notices to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.producer_profiles to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.producer_profiles to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.producer_profiles to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.producer_subscriptions to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.producer_subscriptions to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.producer_subscriptions to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.producer_tasks to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.producer_tasks to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.producer_tasks to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.profiles to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.profiles to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.profiles to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.purchases to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.purchases to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.purchases to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.revenue_advances to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.revenue_advances to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.revenue_advances to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.seating_maps to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.seating_maps to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.seating_maps to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.support_messages to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.support_messages to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.support_messages to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.support_sessions to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.support_sessions to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.support_sessions to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.table_members to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.table_members to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.table_members to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.tasks to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.tasks to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.tasks to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.team_members to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.team_members to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.team_members to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ticket_types to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ticket_types to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ticket_types to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.tickets to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.tickets to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.tickets to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.transactions to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.transactions to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.transactions to service_role;
grant INSERT on table public.user_activities to anon;
grant INSERT, SELECT on table public.user_activities to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.user_activities to service_role;
grant SELECT on table public.user_consents to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.user_consents to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.user_course_progress to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.user_course_progress to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.user_course_progress to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.user_custom_features to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.user_custom_features to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.user_custom_features to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.user_preferences to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.user_preferences to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.user_preferences to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.user_profiles_ext to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.user_profiles_ext to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.user_profiles_ext to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.withdrawals to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.withdrawals to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.withdrawals to service_role;
-- ===== grants por coluna =====

grant UPDATE (read_at) on table public.support_messages to authenticated;
-- ===== funções: zera o padrão local =====

revoke all on function public.admin_activity_stats(desde timestamp with time zone) from public, anon, authenticated, service_role;
revoke all on function public.affiliate_link_hit(p_code text, p_slug text) from public, anon, authenticated, service_role;
revoke all on function public.affiliate_my_producers() from public, anon, authenticated, service_role;
revoke all on function public.agent_meus_eventos() from public, anon, authenticated, service_role;
revoke all on function public.ai_admin_resumo(p_de timestamp with time zone, p_ate timestamp with time zone) from public, anon, authenticated, service_role;
revoke all on function public.ai_balance() from public, anon, authenticated, service_role;
revoke all on function public.ai_custo(p_model text, p_in bigint, p_out bigint) from public, anon, authenticated, service_role;
revoke all on function public.ai_finish(p_id uuid, p_tokens_in integer, p_tokens_out integer, p_steps integer, p_tools text[], p_status text, p_resumo text, p_called boolean) from public, anon, authenticated, service_role;
revoke all on function public.ai_get_gemini_key() from public, anon, authenticated, service_role;
revoke all on function public.ai_grant_credits(p_user uuid, p_amount integer, p_note text) from public, anon, authenticated, service_role;
revoke all on function public.ai_key_status() from public, anon, authenticated, service_role;
revoke all on function public.ai_log(p_user uuid, p_mode text, p_tier text, p_model text, p_tokens_in integer, p_tokens_out integer, p_resumo text, p_status text) from public, anon, authenticated, service_role;
revoke all on function public.ai_portoes(p_user uuid) from public, anon, authenticated, service_role;
revoke all on function public.ai_precheck(p_user uuid) from public, anon, authenticated, service_role;
revoke all on function public.ai_reserve(p_user uuid, p_tier text, p_mode text, p_model text) from public, anon, authenticated, service_role;
revoke all on function public.ai_saldo(p_user uuid) from public, anon, authenticated, service_role;
revoke all on function public.ai_set_gemini_key(p_key text) from public, anon, authenticated, service_role;
revoke all on function public.aviso_politica_destinatarios(p_version text) from public, anon, authenticated, service_role;
revoke all on function public.aviso_politica_registrar(p_user uuid, p_version text) from public, anon, authenticated, service_role;
revoke all on function public.chat_arquivos_a_apagar(p_user uuid) from public, anon, authenticated, service_role;
revoke all on function public.chat_can_upload(p_name text) from public, anon, authenticated, service_role;
revoke all on function public.chat_inbox(p_filtro text, p_busca text, p_limite integer) from public, anon, authenticated, service_role;
revoke all on function public.chat_mark_read(p_conv uuid) from public, anon, authenticated, service_role;
revoke all on function public.chat_messages_after_insert() from public, anon, authenticated, service_role;
revoke all on function public.chat_notify_due() from public, anon, authenticated, service_role;
revoke all on function public.chat_notify_mark(p_ids uuid[], p_tipo text, p_ok boolean) from public, anon, authenticated, service_role;
revoke all on function public.chat_notify_secret() from public, anon, authenticated, service_role;
revoke all on function public.chat_public_settings() from public, anon, authenticated, service_role;
revoke all on function public.chat_rate(p_conv uuid, p_rating integer) from public, anon, authenticated, service_role;
revoke all on function public.chat_role(p_conv uuid) from public, anon, authenticated, service_role;
revoke all on function public.chat_role_path(p_name text) from public, anon, authenticated, service_role;
revoke all on function public.chat_send(p_conv uuid, p_body text, p_is_internal boolean, p_attachment_path text, p_attachment_name text) from public, anon, authenticated, service_role;
revoke all on function public.chat_start(p_topic_id uuid, p_event_id uuid, p_name text, p_phone text, p_marketing_opt_in boolean, p_body text) from public, anon, authenticated, service_role;
revoke all on function public.chat_update(p_conv uuid, p_patch jsonb) from public, anon, authenticated, service_role;
revoke all on function public.gf_admin_can(p text) from public, anon, authenticated, service_role;
revoke all on function public.gf_cpf_valido(p text) from public, anon, authenticated, service_role;
revoke all on function public.gf_is_admin() from public, anon, authenticated, service_role;
revoke all on function public.gf_mfa_ok() from public, anon, authenticated, service_role;
revoke all on function public.gf_protect_affiliate_link() from public, anon, authenticated, service_role;
revoke all on function public.gf_protect_event_moderation() from public, anon, authenticated, service_role;
revoke all on function public.gf_protect_producer_profile_privileges() from public, anon, authenticated, service_role;
revoke all on function public.gf_protect_profile_privileges() from public, anon, authenticated, service_role;
revoke all on function public.handle_new_user() from public, anon, authenticated, service_role;
revoke all on function public.handle_updated_at() from public, anon, authenticated, service_role;
revoke all on function public.link_me_to_affiliate(p_code text, p_ref_first_seen_at timestamp with time zone, p_link text) from public, anon, authenticated, service_role;
revoke all on function public.rls_auto_enable() from public, anon, authenticated, service_role;
revoke all on function public.tem_ingresso(p_event uuid) from public, anon, authenticated, service_role;
-- ===== funções: grants da produção =====

grant EXECUTE on function public.admin_activity_stats(desde timestamp with time zone) to authenticated;
grant EXECUTE on function public.admin_activity_stats(desde timestamp with time zone) to service_role;
grant EXECUTE on function public.affiliate_link_hit(p_code text, p_slug text) to anon;
grant EXECUTE on function public.affiliate_link_hit(p_code text, p_slug text) to authenticated;
grant EXECUTE on function public.affiliate_link_hit(p_code text, p_slug text) to service_role;
grant EXECUTE on function public.affiliate_my_producers() to authenticated;
grant EXECUTE on function public.affiliate_my_producers() to service_role;
grant EXECUTE on function public.agent_meus_eventos() to authenticated;
grant EXECUTE on function public.ai_admin_resumo(p_de timestamp with time zone, p_ate timestamp with time zone) to authenticated;
grant EXECUTE on function public.ai_balance() to authenticated;
grant EXECUTE on function public.ai_finish(p_id uuid, p_tokens_in integer, p_tokens_out integer, p_steps integer, p_tools text[], p_status text, p_resumo text, p_called boolean) to service_role;
grant EXECUTE on function public.ai_get_gemini_key() to service_role;
grant EXECUTE on function public.ai_grant_credits(p_user uuid, p_amount integer, p_note text) to authenticated;
grant EXECUTE on function public.ai_key_status() to authenticated;
grant EXECUTE on function public.ai_log(p_user uuid, p_mode text, p_tier text, p_model text, p_tokens_in integer, p_tokens_out integer, p_resumo text, p_status text) to service_role;
grant EXECUTE on function public.ai_precheck(p_user uuid) to service_role;
grant EXECUTE on function public.ai_reserve(p_user uuid, p_tier text, p_mode text, p_model text) to service_role;
grant EXECUTE on function public.ai_set_gemini_key(p_key text) to authenticated;
grant EXECUTE on function public.aviso_politica_destinatarios(p_version text) to service_role;
grant EXECUTE on function public.aviso_politica_registrar(p_user uuid, p_version text) to service_role;
grant EXECUTE on function public.chat_arquivos_a_apagar(p_user uuid) to service_role;
grant EXECUTE on function public.chat_can_upload(p_name text) to authenticated;
grant EXECUTE on function public.chat_inbox(p_filtro text, p_busca text, p_limite integer) to authenticated;
grant EXECUTE on function public.chat_mark_read(p_conv uuid) to authenticated;
grant EXECUTE on function public.chat_notify_due() to service_role;
grant EXECUTE on function public.chat_notify_mark(p_ids uuid[], p_tipo text, p_ok boolean) to service_role;
grant EXECUTE on function public.chat_notify_secret() to service_role;
grant EXECUTE on function public.chat_public_settings() to authenticated;
grant EXECUTE on function public.chat_rate(p_conv uuid, p_rating integer) to authenticated;
grant EXECUTE on function public.chat_role(p_conv uuid) to authenticated;
grant EXECUTE on function public.chat_role_path(p_name text) to authenticated;
grant EXECUTE on function public.chat_send(p_conv uuid, p_body text, p_is_internal boolean, p_attachment_path text, p_attachment_name text) to authenticated;
grant EXECUTE on function public.chat_start(p_topic_id uuid, p_event_id uuid, p_name text, p_phone text, p_marketing_opt_in boolean, p_body text) to authenticated;
grant EXECUTE on function public.chat_update(p_conv uuid, p_patch jsonb) to authenticated;
grant EXECUTE on function public.gf_admin_can(p text) to authenticated;
grant EXECUTE on function public.gf_cpf_valido(p text) to PUBLIC;
grant EXECUTE on function public.gf_cpf_valido(p text) to anon;
grant EXECUTE on function public.gf_cpf_valido(p text) to authenticated;
grant EXECUTE on function public.gf_cpf_valido(p text) to service_role;
grant EXECUTE on function public.gf_is_admin() to PUBLIC;
grant EXECUTE on function public.gf_is_admin() to anon;
grant EXECUTE on function public.gf_is_admin() to authenticated;
grant EXECUTE on function public.gf_is_admin() to service_role;
grant EXECUTE on function public.gf_mfa_ok() to authenticated;
grant EXECUTE on function public.gf_mfa_ok() to service_role;
grant EXECUTE on function public.gf_protect_affiliate_link() to PUBLIC;
grant EXECUTE on function public.gf_protect_affiliate_link() to anon;
grant EXECUTE on function public.gf_protect_affiliate_link() to authenticated;
grant EXECUTE on function public.gf_protect_affiliate_link() to service_role;
grant EXECUTE on function public.gf_protect_event_moderation() to service_role;
grant EXECUTE on function public.gf_protect_producer_profile_privileges() to PUBLIC;
grant EXECUTE on function public.gf_protect_producer_profile_privileges() to anon;
grant EXECUTE on function public.gf_protect_producer_profile_privileges() to authenticated;
grant EXECUTE on function public.gf_protect_producer_profile_privileges() to service_role;
grant EXECUTE on function public.gf_protect_profile_privileges() to PUBLIC;
grant EXECUTE on function public.gf_protect_profile_privileges() to anon;
grant EXECUTE on function public.gf_protect_profile_privileges() to authenticated;
grant EXECUTE on function public.gf_protect_profile_privileges() to service_role;
grant EXECUTE on function public.handle_new_user() to PUBLIC;
grant EXECUTE on function public.handle_new_user() to anon;
grant EXECUTE on function public.handle_new_user() to authenticated;
grant EXECUTE on function public.handle_new_user() to service_role;
grant EXECUTE on function public.handle_updated_at() to PUBLIC;
grant EXECUTE on function public.handle_updated_at() to anon;
grant EXECUTE on function public.handle_updated_at() to authenticated;
grant EXECUTE on function public.handle_updated_at() to service_role;
grant EXECUTE on function public.link_me_to_affiliate(p_code text, p_ref_first_seen_at timestamp with time zone, p_link text) to authenticated;
grant EXECUTE on function public.link_me_to_affiliate(p_code text, p_ref_first_seen_at timestamp with time zone, p_link text) to service_role;
grant EXECUTE on function public.rls_auto_enable() to PUBLIC;
grant EXECUTE on function public.rls_auto_enable() to anon;
grant EXECUTE on function public.rls_auto_enable() to authenticated;
grant EXECUTE on function public.rls_auto_enable() to service_role;
grant EXECUTE on function public.tem_ingresso(p_event uuid) to authenticated;
grant EXECUTE on function public.tem_ingresso(p_event uuid) to service_role;
-- ===== Realtime =====

alter publication supabase_realtime add table public.conversation_messages, public.conversations, public.support_messages, public.support_sessions;


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
