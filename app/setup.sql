-- ========================================================
-- AURA EVENTOS — Setup completo do banco de dados
-- Execute TODO este script no SQL Editor do Supabase
-- ========================================================

-- --------------------------------------------------------
-- 1. TABELAS DE SUPORTE (novas — criar primeiro)
-- --------------------------------------------------------

-- --------------------------------------------------------
-- Limpar tabelas de suporte caso existam (para recriar do zero)
-- --------------------------------------------------------
drop table if exists public.feedback cascade;
drop table if exists public.contact_messages cascade;
drop table if exists public.newsletter_subscribers cascade;

-- Newsletter (landing page + footer)
create table public.newsletter_subscribers (
  id uuid default gen_random_uuid() primary key,
  email text not null unique,
  created_at timestamp with time zone default now()
);

-- Mensagens de contato (pagina /contato + ContactSection)
create table public.contact_messages (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  email text not null,
  phone text,
  subject text,
  message text not null,
  page text,
  created_at timestamp with time zone default now()
);

-- Feedbacks (botao flutuante FeedbackButton)
create table public.feedback (
  id uuid default gen_random_uuid() primary key,
  type text check (type in ('melhoria', 'bug', 'duvida', 'sugestao', 'elogio')),
  message text not null,
  rating integer check (rating >= 0 and rating <= 5),
  page text,
  user_agent text,
  created_at timestamp with time zone default now()
);

-- --------------------------------------------------------
-- 2. TABELAS CORE (provavelmente ja existem — ignorar se der erro)
-- --------------------------------------------------------

-- Perfis de usuario
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  avatar_url text,
  role text default 'user' check (role in ('user', 'producer', 'admin')),
  is_verified boolean default false,
  updated_at timestamp with time zone default now()
);

-- Eventos
create table if not exists public.events (
  id uuid default gen_random_uuid() primary key,
  producer_id uuid references public.profiles(id) not null,
  title text not null,
  subtitle text,
  slug text unique not null,
  description text,
  short_description text,
  cover_image text,
  image_url text,
  gallery jsonb default '[]',
  category text default 'Outros',
  tags text[] default '{}',
  venue_name text,
  venue_address text,
  venue_city text,
  venue_state text,
  venue_zip text,
  venue_lat numeric,
  venue_lng numeric,
  date date,
  time text,
  start_date timestamp with time zone default now(),
  end_date timestamp with time zone,
  status text default 'draft' check (status in ('draft', 'published', 'cancelled', 'ended')),
  visibility text default 'public' check (visibility in ('public', 'private', 'unlisted', 'password')),
  password text,
  capacity integer,
  branding jsonb default '{}',
  settings jsonb default '{}',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Tipos de ingresso
create table if not exists public.ticket_types (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.events(id) on delete cascade not null,
  name text not null,
  description text,
  price numeric default 0,
  capacity integer,
  quantity_total integer default 0,
  sold integer default 0,
  quantity_sold integer default 0,
  type text default 'individual' check (type in ('individual', 'vip', 'coletiva', 'mesa')),
  perks text[] default '{}',
  is_active boolean default true,
  lot_number integer default 1,
  sale_start timestamp with time zone,
  sale_end timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Pedidos
create table if not exists public.orders (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.events(id) not null,
  user_id uuid references public.profiles(id),
  total numeric default 0,
  status text default 'pending',
  created_at timestamp with time zone default now()
);

-- View materializada para sumario financeiro
create materialized view if not exists public.event_summary as
select
  e.producer_id,
  e.id as event_id,
  coalesce(sum(tt.sold), 0) as tickets_sold,
  coalesce(sum(tt.price * tt.sold), 0) as total_revenue,
  count(distinct o.user_id) as unique_buyers
from public.events e
left join public.ticket_types tt on tt.event_id = e.id
left join public.orders o on o.event_id = e.id
where e.status = 'published'
group by e.producer_id, e.id;

-- --------------------------------------------------------
-- 3. RLS BASICO (seguranca)
-- --------------------------------------------------------

-- Habilitar RLS
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.ticket_types enable row level security;
alter table public.orders enable row level security;

-- Politicas

drop policy if exists "Perfis publicos" on public.profiles;
create policy "Perfis publicos"
  on public.profiles for select
  to authenticated, anon
  using (true);

drop policy if exists "Eventos publicos" on public.events;
create policy "Eventos publicos"
  on public.events for select
  to authenticated, anon
  using (visibility = 'public' and status = 'published');

drop policy if exists "Produtor gerencia eventos" on public.events;
create policy "Produtor gerencia eventos"
  on public.events for all
  to authenticated
  using (producer_id = auth.uid())
  with check (producer_id = auth.uid());

drop policy if exists "Ticket types publicos" on public.ticket_types;
create policy "Ticket types publicos"
  on public.ticket_types for select
  to authenticated, anon
  using (exists (
    select 1 from public.events e
    where e.id = ticket_types.event_id
    and e.visibility = 'public'
    and e.status = 'published'
  ));

-- --------------------------------------------------------
-- 4. TESTES RAPIDOS (execute para validar)
-- --------------------------------------------------------

-- Teste 1: feedback
insert into public.feedback (type, message, rating, page)
values ('elogio', 'Teste de insercao automatico', 5, '/test')
returning id;

-- Teste 2: contact_messages
insert into public.contact_messages (name, email, message)
values ('Teste', 'teste@aura.events', 'Mensagem de teste automatico')
returning id;

-- Teste 3: newsletter_subscribers
insert into public.newsletter_subscribers (email)
values ('teste@newsletter.com')
returning id;

-- Teste 4: verificar se view existe
select count(*) from public.event_summary;

-- Limpar dados de teste (opcional — descomente se quiser)
-- delete from public.feedback where message = 'Teste de insercao automatico';
-- delete from public.contact_messages where message = 'Mensagem de teste automatico';
-- delete from public.newsletter_subscribers where email = 'teste@newsletter.com';
