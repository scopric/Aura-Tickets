-- ========================================================-- AURA EVENTOS — Migração incremental (tabelas novas)-- Execute no SQL Editor do Supabase-- ========================================================

-- --------------------------------------------------------
-- 1. TABELAS ADICIONAIS (producer tools)
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

-- Estender crm_leads com campos de lista de interesse
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'crm_leads') then
    alter table public.crm_leads add column if not exists city text;
    alter table public.crm_leads add column if not exists notified boolean default false;
    alter table public.crm_leads add column if not exists notified_at timestamp with time zone;
  end if;
end $$;

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

-- --------------------------------------------------------
-- 2. TABELAS RESTANTES (certificates, piggy bank, advances, surveys, zones)
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

-- --------------------------------------------------------
-- 3. EVOKAA ACADEMY (cursos e progresso)
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

-- --------------------------------------------------------
-- 4. RLS PARA TODAS AS NOVAS TABELAS
-- --------------------------------------------------------

alter table public.event_timeline_items enable row level security;
drop policy if exists "Produtor gerencia timeline" on public.event_timeline_items;
create policy "Produtor gerencia timeline"
  on public.event_timeline_items for all
  to authenticated
  using (producer_id = auth.uid())
  with check (producer_id = auth.uid());

drop policy if exists "Produtor gerencia banners" on public.event_banners;
create policy "Produtor gerencia banners"
  on public.event_banners for all
  to authenticated
  using (producer_id = auth.uid())
  with check (producer_id = auth.uid());

drop policy if exists "Produtor gerencia fotos" on public.event_photos;
create policy "Produtor gerencia fotos"
  on public.event_photos for all
  to authenticated
  using (producer_id = auth.uid())
  with check (producer_id = auth.uid());

drop policy if exists "Produtor ve surveys do evento" on public.event_surveys;
create policy "Produtor ve surveys do evento"
  on public.event_surveys for all
  to authenticated
  using (exists (select 1 from public.events e where e.id = event_surveys.event_id and e.producer_id = auth.uid()));

drop policy if exists "Produtor gerencia zones" on public.event_zones;
create policy "Produtor gerencia zones"
  on public.event_zones for all
  to authenticated
  using (exists (select 1 from public.events e where e.id = event_zones.event_id and e.producer_id = auth.uid()));

drop policy if exists "Produtor gerencia certificates" on public.certificates;
create policy "Produtor gerencia certificates"
  on public.certificates for all
  to authenticated
  using (exists (select 1 from public.events e where e.id = certificates.event_id and e.producer_id = auth.uid()));

drop policy if exists "Produtor gerencia budget boxes" on public.event_budget_boxes;
create policy "Produtor gerencia budget boxes"
  on public.event_budget_boxes for all
  to authenticated
  using (producer_id = auth.uid())
  with check (producer_id = auth.uid());

drop policy if exists "Produtor ve transactions" on public.piggy_transactions;
create policy "Produtor ve transactions"
  on public.piggy_transactions for all
  to authenticated
  using (exists (select 1 from public.event_budget_boxes b where b.id = piggy_transactions.box_id and b.producer_id = auth.uid()));

drop policy if exists "Produtor gerencia advances" on public.revenue_advances;
create policy "Produtor gerencia advances"
  on public.revenue_advances for all
  to authenticated
  using (producer_id = auth.uid())
  with check (producer_id = auth.uid());

drop policy if exists "Cursos publicos" on public.academy_courses;
create policy "Cursos publicos"
  on public.academy_courses for select
  to authenticated, anon
  using (true);

drop policy if exists "Usuario ve proprio progresso" on public.user_course_progress;
create policy "Usuario ve proprio progresso"
  on public.user_course_progress for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
