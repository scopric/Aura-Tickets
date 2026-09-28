-- Formulário de contato (emailType: 'contact') é canal público, sem login e sem limite de
-- envios — alguém pode gastar a cota da Resend chamando em loop. RLS não resolve (o e-mail é
-- escolhido por quem ataca, não dá pra contar por ele); o limite precisa ser por IP, dentro da
-- própria função (mesmo padrão de extração de IP já usado em produção por record-access).
create table if not exists public.contact_rate_limit_hits (
  id bigint generated always as identity primary key,
  ip text not null,
  created_at timestamptz not null default now()
);
create index if not exists contact_rate_limit_hits_ip_created_at_idx
  on public.contact_rate_limit_hits (ip, created_at);

alter table public.contact_rate_limit_hits enable row level security;
-- Sem policy nenhuma: só o service_role (dentro da Edge Function) grava e lê. RLS nega o
-- resto por padrão, igual às outras tabelas internas do projeto.
