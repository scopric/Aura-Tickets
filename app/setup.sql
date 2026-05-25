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

-- Tarefas do produtor
create table if not exists public.producer_tasks (
  id uuid default gen_random_uuid() primary key,
  producer_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  category text default 'Pre-evento',
  priority text default 'media' check (priority in ('alta', 'media', 'baixa')),
  status text default 'pendente' check (status in ('pendente', 'em-andamento', 'concluida')),
  due_date date,
  assignee text,
  event_name text,
  tags text[] default '{}',
  subtasks jsonb default '[]',
  comments jsonb default '[]',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Parceiros (patrocinadores e fornecedores)
create table if not exists public.partners (
  id uuid default gen_random_uuid() primary key,
  producer_id uuid references public.profiles(id) on delete cascade not null,
  type text not null check (type in ('patrocinador', 'fornecedor')),
  name text not null,
  contact text,
  email text,
  phone text,
  category text,
  value numeric default 0,
  status text default 'pendente' check (status in ('confirmado', 'pendente', 'cancelado')),
  event_name text,
  notes text,
  contract_url text,
  deliverables text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Cupons de desconto
create table if not exists public.coupons (
  id uuid default gen_random_uuid() primary key,
  producer_id uuid references public.profiles(id) on delete cascade not null,
  code text not null unique,
  type text not null check (type in ('percent', 'fixed')),
  value numeric default 0,
  min_purchase numeric default 0,
  max_uses integer default 999,
  used integer default 0,
  status text default 'ativo' check (status in ('ativo', 'expirado', 'esgotado', 'desativado')),
  event_name text,
  start_date text,
  end_date text,
  description text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
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
alter table public.producer_tasks enable row level security;
alter table public.partners enable row level security;
alter table public.coupons enable row level security;

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

-- Politicas para producer_tasks
drop policy if exists "Produtor gerencia tasks" on public.producer_tasks;
create policy "Produtor gerencia tasks"
  on public.producer_tasks for all
  to authenticated
  using (producer_id = auth.uid())
  with check (producer_id = auth.uid());

-- Politicas para partners
drop policy if exists "Produtor gerencia partners" on public.partners;
create policy "Produtor gerencia partners"
  on public.partners for all
  to authenticated
  using (producer_id = auth.uid())
  with check (producer_id = auth.uid());

-- Politicas para coupons
drop policy if exists "Produtor gerencia coupons" on public.coupons;
create policy "Produtor gerencia coupons"
  on public.coupons for all
  to authenticated
  using (producer_id = auth.uid())
  with check (producer_id = auth.uid());

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

-- --------------------------------------------------------
-- 5. TABELAS ADICIONAIS (producer tools)
-- --------------------------------------------------------

-- Cronograma do evento
create table if not exists public.event_timeline_items (
  id uuid default gen_random_uuid() primary key,
  producer_id uuid references public.profiles(id) on delete cascade not null,
  event_id uuid references public.events(id) on delete cascade,
  time text not null,
  title text not null,
  description text,
  type text default 'show' check (type in ('soundcheck', 'abertura', 'show', 'comida', 'transporte', 'decoracao', 'vip', 'encerramento')),
  responsible text,
  status text default 'futuro' check (status in ('concluido', 'atual', 'futuro')),
  duration text,
  location text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Estender crm_leads (criado em migration) com campos de lista de interesse
-- Nota: crm_leads ja existe via migration; adicionamos colunas se necessario
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'crm_leads') then
    alter table public.crm_leads add column if not exists city text;
    alter table public.crm_leads add column if not exists notified boolean default false;
    alter table public.crm_leads add column if not exists notified_at timestamp with time zone;
  end if;
end $$;

-- --------------------------------------------------------
-- 6. RLS PARA TABELAS ADICIONAIS
-- --------------------------------------------------------

alter table public.event_timeline_items enable row level security;

drop policy if exists "Produtor gerencia timeline" on public.event_timeline_items;
create policy "Produtor gerencia timeline"
  on public.event_timeline_items for all
  to authenticated
  using (producer_id = auth.uid())
  with check (producer_id = auth.uid());

-- Banners promocionais
create table if not exists public.event_banners (
  id uuid default gen_random_uuid() primary key,
  producer_id uuid references public.profiles(id) on delete cascade not null,
  event_name text,
  name text not null,
  image_url text,
  position text default 'hero' check (position in ('hero', 'top', 'inline')),
  active boolean default true,
  clicks integer default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Galeria de fotos
create table if not exists public.event_photos (
  id uuid default gen_random_uuid() primary key,
  producer_id uuid references public.profiles(id) on delete cascade not null,
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

-- RLS para banners
drop policy if exists "Produtor gerencia banners" on public.event_banners;
create policy "Produtor gerencia banners"
  on public.event_banners for all
  to authenticated
  using (producer_id = auth.uid())
  with check (producer_id = auth.uid());

-- RLS para fotos
drop policy if exists "Produtor gerencia fotos" on public.event_photos;
create policy "Produtor gerencia fotos"
  on public.event_photos for all
  to authenticated
  using (producer_id = auth.uid())
  with check (producer_id = auth.uid());

-- --------------------------------------------------------
-- 7. TABELAS RESTANTES (certificates, piggy bank, advances, surveys, zones)
-- --------------------------------------------------------

-- Pesquisas / NPS pos-evento
create table if not exists public.event_surveys (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.events(id) on delete cascade not null,
  participant_email text not null,
  score integer not null check (score >= 0 and score <= 10),
  comment text,
  zone text,
  created_at timestamp with time zone default now()
);

-- Zonas do evento (para analytics de mapa de calor)
create table if not exists public.event_zones (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.events(id) on delete cascade not null,
  name text not null,
  avg_time_minutes integer default 0,
  satisfaction_score numeric default 0,
  expected_visitors integer default 0,
  created_at timestamp with time zone default now()
);

-- Certificados de participacao
create table if not exists public.certificates (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.events(id) on delete cascade not null,
  ticket_id uuid references public.tickets(id) on delete set null,
  participant_name text not null,
  participant_email text,
  hours integer default 0,
  issued boolean default false,
  issue_date date,
  template_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Caixinha / Orcamento por categoria (PiggyBank)
create table if not exists public.event_budget_boxes (
  id uuid default gen_random_uuid() primary key,
  producer_id uuid references public.profiles(id) on delete cascade not null,
  event_id uuid references public.events(id) on delete cascade,
  name text not null,
  target numeric default 0,
  saved numeric default 0,
  category text default 'Outros',
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Transacoes da caixinha
create table if not exists public.piggy_transactions (
  id uuid default gen_random_uuid() primary key,
  box_id uuid references public.event_budget_boxes(id) on delete cascade not null,
  type text not null check (type in ('deposit', 'withdraw')),
  amount numeric default 0,
  note text,
  created_at timestamp with time zone default now()
);

-- Antecipacao de receita
create table if not exists public.revenue_advances (
  id uuid default gen_random_uuid() primary key,
  producer_id uuid references public.profiles(id) on delete cascade not null,
  event_id uuid references public.events(id) on delete cascade not null,
  amount numeric default 0,
  fee_pct numeric default 0,
  fee_amount numeric default 0,
  iof_amount numeric default 0,
  net_amount numeric default 0,
  days integer default 7,
  status text default 'requested' check (status in ('requested', 'approved', 'transferred', 'reconciled', 'rejected')),
  requested_at timestamp with time zone default now(),
  transferred_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Estender check_ins com timestamp (se existir)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'check_ins') then
    alter table public.check_ins add column if not exists checked_in_at timestamp with time zone default now();
  end if;
end $$;

-- RLS para surveys
drop policy if exists "Produtor ve surveys do evento" on public.event_surveys;
create policy "Produtor ve surveys do evento"
  on public.event_surveys for all
  to authenticated
  using (exists (select 1 from public.events e where e.id = event_surveys.event_id and e.producer_id = auth.uid()));

-- RLS para zones
drop policy if exists "Produtor gerencia zones" on public.event_zones;
create policy "Produtor gerencia zones"
  on public.event_zones for all
  to authenticated
  using (exists (select 1 from public.events e where e.id = event_zones.event_id and e.producer_id = auth.uid()));

-- RLS para certificates
drop policy if exists "Produtor gerencia certificates" on public.certificates;
create policy "Produtor gerencia certificates"
  on public.certificates for all
  to authenticated
  using (exists (select 1 from public.events e where e.id = certificates.event_id and e.producer_id = auth.uid()));

-- RLS para budget boxes
drop policy if exists "Produtor gerencia budget boxes" on public.event_budget_boxes;
create policy "Produtor gerencia budget boxes"
  on public.event_budget_boxes for all
  to authenticated
  using (producer_id = auth.uid())
  with check (producer_id = auth.uid());

-- RLS para piggy transactions
drop policy if exists "Produtor ve transactions" on public.piggy_transactions;
create policy "Produtor ve transactions"
  on public.piggy_transactions for all
  to authenticated
  using (exists (select 1 from public.event_budget_boxes b where b.id = piggy_transactions.box_id and b.producer_id = auth.uid()));

-- RLS para revenue advances
drop policy if exists "Produtor gerencia advances" on public.revenue_advances;
create policy "Produtor gerencia advances"
  on public.revenue_advances for all
  to authenticated
  using (producer_id = auth.uid())
  with check (producer_id = auth.uid());

-- --------------------------------------------------------
-- 8. EVOKAA ACADEMY (cursos e progresso)
-- --------------------------------------------------------

-- Cursos
create table if not exists public.academy_courses (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  instructor text,
  duration text,
  lessons integer default 0,
  level text default 'iniciante' check (level in ('iniciante', 'intermediario', 'avancado')),
  category text,
  students integer default 0,
  rating numeric default 0,
  locked boolean default false,
  created_at timestamp with time zone default now()
);

-- Progresso do usuario
create table if not exists public.user_course_progress (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  course_id uuid references public.academy_courses(id) on delete cascade not null,
  progress integer default 0 check (progress >= 0 and progress <= 100),
  completed boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique (user_id, course_id)
);

-- Seed inicial de cursos
insert into public.academy_courses (title, description, instructor, duration, lessons, level, category, students, rating, locked)
values
  ('Como Criar seu Primeiro Evento', 'Do zero ao primeiro ingresso vendido. Aprenda a criar, configurar e publicar um evento completo.', 'Mariana Costa', '2h 30min', 12, 'iniciante', 'Producao', 2340, 4.9, false),
  ('Marketing de Eventos que Vende', 'Estrategias praticas para vender mais ingressos usando redes sociais, email marketing e parcerias.', 'Pedro Lima', '3h 15min', 18, 'intermediario', 'Marketing', 1890, 4.8, false),
  ('Precificacao Inteligente', 'Como definir o preco ideal do ingresso. Analise de custos, concorrencia e elasticidade.', 'Ana Beatriz', '1h 45min', 8, 'intermediario', 'Financeiro', 1560, 4.7, false),
  ('Gestao de Fornecedores', 'Encontre, negocie e gerencie fornecedores. Contratos, briefings e controle de qualidade.', 'Carlos Mendes', '2h 00min', 10, 'intermediario', 'Producao', 980, 4.6, false),
  ('Check-in e Operacao na Porta', 'Tudo sobre credenciamento, controle de acesso, filas e experiencia do participante.', 'Julia Ramos', '1h 30min', 7, 'iniciante', 'Operacao', 1200, 4.8, false),
  ('Afiliados e Promoters', 'Monte uma rede de vendedores, configure comissoes e acompanhe resultados.', 'Lucas Oliveira', '2h 45min', 14, 'avancado', 'Vendas', 750, 4.9, true),
  ('Prevencao de Assedio em Eventos', 'Protocolos, treinamento de equipe e criacao de ambientes seguros.', 'Fernanda Silva', '1h 15min', 6, 'iniciante', 'Seguranca', 2100, 4.9, false),
  ('Analytics e Tomada de Decisao', 'Leia dados, identifique tendencias e tome decisoes baseadas em numeros.', 'Ricardo Souza', '2h 00min', 11, 'avancado', 'Analytics', 640, 4.7, true)
on conflict do nothing;

-- RLS para cursos (publico para leitura)
drop policy if exists "Cursos publicos" on public.academy_courses;
create policy "Cursos publicos"
  on public.academy_courses for select
  to authenticated, anon
  using (true);

-- RLS para progresso (apenas proprio)
drop policy if exists "Usuario ve proprio progresso" on public.user_course_progress;
create policy "Usuario ve proprio progresso"
  on public.user_course_progress for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
