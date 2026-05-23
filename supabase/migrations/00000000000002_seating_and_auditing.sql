-- MIGRATION: SEATING, AUDITING AND IDEMPOTENCY
-- Este script adiciona as tabelas faltantes identificadas na especificação de negócio e na análise crítica do Kimi Agent.

-- 1. Tabela: webhook_events (Controle de Idempotência contra race conditions de gateways)
CREATE TABLE public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway TEXT NOT NULL CHECK (gateway IN ('stripe', 'woovi', 'pagseguro')),
  event_id TEXT NOT NULL UNIQUE, -- ID único retornado pelo gateway (ex: evt_xxx ou payment_intent_id)
  status TEXT NOT NULL DEFAULT 'processed' CHECK (status IN ('processing', 'processed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabela: audit_logs (Logs de Auditoria Financeira Invioláveis)
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  amount NUMERIC(10,2),
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabela: seating_maps (Mapas de Assentos para Eventos)
CREATE TABLE public.seating_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Principal',
  config JSONB NOT NULL DEFAULT '{}',
  environments JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Tabela: seating_reservations (Reservas Temporárias de Assentos no Checkout)
CREATE TABLE public.seating_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seating_map_id UUID NOT NULL REFERENCES public.seating_maps(id) ON DELETE CASCADE,
  ticket_type_id UUID REFERENCES public.ticket_types(id) ON DELETE SET NULL,
  seat_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'purchased', 'released')),
  expires_at TIMESTAMPTZ NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Tabela: ticket_transfers (Histórico de Transferências de Ingressos)
CREATE TABLE public.ticket_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Tabela: communications (Logs de Disparos de E-mail/SMS/Push)
CREATE TABLE public.communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  producer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('email', 'sms', 'push')),
  recipient TEXT NOT NULL,
  subject TEXT,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seating_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seating_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;

-- Triggers para atualizações de updated_at
CREATE TRIGGER tr_seating_maps_updated_at
  BEFORE UPDATE ON public.seating_maps
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Políticas RLS Otimizadas (com SELECT auth.uid())

-- 1. Webhook Events Policies (Somente chaves de serviço/Edge Functions podem escrever/ler)
CREATE POLICY "Leitura restrita a administradores e Edge Functions" ON public.webhook_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- 2. Audit Logs Policies
CREATE POLICY "Produtores leem próprios logs de auditoria" ON public.audit_logs
  FOR SELECT USING (producer_id = (SELECT auth.uid()));

CREATE POLICY "Admins leem todos os logs de auditoria" ON public.audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- 3. Seating Maps Policies
CREATE POLICY "Mapas de assentos visíveis para todos" ON public.seating_maps
  FOR SELECT USING (true);

CREATE POLICY "Produtores gerenciam mapas dos próprios eventos" ON public.seating_maps
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE id = event_id AND producer_id = (SELECT auth.uid())
    )
  );

-- 4. Seating Reservations Policies
CREATE POLICY "Visualização pública de reservas de assentos" ON public.seating_reservations
  FOR SELECT USING (true);

CREATE POLICY "Usuários criam próprias reservas de assentos" ON public.seating_reservations
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Usuários atualizam próprias reservas de assentos" ON public.seating_reservations
  FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

-- 5. Ticket Transfers Policies
CREATE POLICY "Usuários leem transferências onde estiveram envolvidos" ON public.ticket_transfers
  FOR SELECT USING (from_user_id = (SELECT auth.uid()) OR to_user_id = (SELECT auth.uid()));

CREATE POLICY "Produtores leem transferências de seus eventos" ON public.ticket_transfers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      JOIN public.events e ON e.id = t.event_id
      WHERE t.id = ticket_id AND e.producer_id = (SELECT auth.uid())
    )
  );

-- 6. Communications Policies
CREATE POLICY "Produtores leem logs de comunicação de seus eventos" ON public.communications
  FOR SELECT USING (producer_id = (SELECT auth.uid()));

-- Índices de Desempenho
CREATE INDEX idx_seating_maps_event ON public.seating_maps(event_id);
CREATE INDEX idx_seating_reservations_map ON public.seating_reservations(seating_map_id);
CREATE INDEX idx_seating_reservations_expires ON public.seating_reservations(expires_at) WHERE status = 'reserved';
CREATE INDEX idx_ticket_transfers_ticket ON public.ticket_transfers(ticket_id);
CREATE INDEX idx_ticket_transfers_users ON public.ticket_transfers(from_user_id, to_user_id);
CREATE INDEX idx_communications_producer ON public.communications(producer_id);
