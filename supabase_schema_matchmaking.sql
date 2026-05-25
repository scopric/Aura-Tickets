-- ============================================================
-- Schema: Mesa Coletiva (Matchmaking)
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Tabela de perfis estendidos para matchmaking
CREATE TABLE IF NOT EXISTS public.user_profiles_ext (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  temperament TEXT CHECK (temperament IN ('introvert', 'extrovert', 'ambivert')),
  intention TEXT CHECK (intention IN ('network', 'fun', 'romance', 'experience')),
  music_style TEXT CHECK (music_style IN ('eletronica', 'rock', 'pop', 'sertanejo', 'jazz', 'hiphop', 'indie')),
  energy_level TEXT CHECK (energy_level IN ('low', 'medium', 'high')),
  birth_year INTEGER,
  gender TEXT CHECK (gender IN ('M', 'F', 'NB', 'prefer_not_say')),
  bio TEXT,
  vibe TEXT,
  quiz_completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_profiles_ext_user_id ON public.user_profiles_ext(user_id);

-- RLS
ALTER TABLE public.user_profiles_ext ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Perfis ext visiveis pelo proprio usuario"
  ON public.user_profiles_ext FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Perfis ext editaveis pelo proprio usuario"
  ON public.user_profiles_ext FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Política especial: membros da mesma mesa podem ver perfis parciais uns dos outros
CREATE POLICY "Perfis ext visiveis por membros da mesma mesa"
  ON public.user_profiles_ext FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.table_members tm1
      JOIN public.table_members tm2 ON tm1.table_id = tm2.table_id
      WHERE tm1.user_id = auth.uid()
      AND tm2.user_id = public.user_profiles_ext.user_id
    )
  );

-- ============================================================
-- collective_tables (ajustar se já existe)
-- ============================================================

-- Verificar se a tabela existe e adicionar colunas se necessário
DO $$
BEGIN
  -- Se não existir, criar
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'collective_tables'
  ) THEN
    CREATE TABLE public.collective_tables (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
      ticket_type_id UUID REFERENCES public.ticket_types(id),
      name TEXT NOT NULL,
      theme TEXT,
      capacity INTEGER NOT NULL DEFAULT 6,
      compatibility_score NUMERIC(3,1),
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'full', 'closed')),
      icebreaker_question TEXT,
      icebreaker_sent_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
  END IF;
END
$$;

-- Adicionar colunas se não existirem
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'collective_tables' AND column_name = 'theme') THEN
    ALTER TABLE public.collective_tables ADD COLUMN theme TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'collective_tables' AND column_name = 'compatibility_score') THEN
    ALTER TABLE public.collective_tables ADD COLUMN compatibility_score NUMERIC(3,1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'collective_tables' AND column_name = 'icebreaker_question') THEN
    ALTER TABLE public.collective_tables ADD COLUMN icebreaker_question TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'collective_tables' AND column_name = 'icebreaker_sent_at') THEN
    ALTER TABLE public.collective_tables ADD COLUMN icebreaker_sent_at TIMESTAMP WITH TIME ZONE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_collective_tables_event_id ON public.collective_tables(event_id);

ALTER TABLE public.collective_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mesas visiveis por participantes do evento"
  ON public.collective_tables FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.event_id = public.collective_tables.event_id
      AND t.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = public.collective_tables.event_id
      AND e.producer_id = auth.uid()
    )
  );

-- ============================================================
-- table_members (ajustar se já existe)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'table_members'
  ) THEN
    CREATE TABLE public.table_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      table_id UUID NOT NULL REFERENCES public.collective_tables(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES public.profiles(id),
      vibe TEXT,
      role TEXT NOT NULL DEFAULT 'member',
      matchmaking_answers JSONB NOT NULL DEFAULT '{}',
      joined_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'table_members' AND column_name = 'vibe') THEN
    ALTER TABLE public.table_members ADD COLUMN vibe TEXT;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_table_members_table_id ON public.table_members(table_id);
CREATE INDEX IF NOT EXISTS idx_table_members_user_id ON public.table_members(user_id);

ALTER TABLE public.table_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros visiveis por participantes da mesma mesa"
  ON public.table_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.table_members tm
      WHERE tm.table_id = public.table_members.table_id
      AND tm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.collective_tables ct
      JOIN public.events e ON e.id = ct.event_id
      WHERE ct.id = public.table_members.table_id
      AND e.producer_id = auth.uid()
    )
  );

-- ============================================================
-- Trigger: após insert em tickets (tipo coletiva), criar table_member
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_collective_ticket_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar se o ticket_type é do tipo 'coletiva' ou 'mesa'
  IF EXISTS (
    SELECT 1 FROM public.ticket_types tt
    WHERE tt.id = NEW.ticket_type_id
    AND tt.type = 'coletiva'
  ) THEN
    -- Buscar respostas do quiz do usuário
    DECLARE
      quiz_answers JSONB;
      user_vibe TEXT;
    BEGIN
      SELECT 
        jsonb_build_object(
          'temperament', temperament,
          'intention', intention,
          'music_style', music_style,
          'energy_level', energy_level
        ),
        vibe
      INTO quiz_answers, user_vibe
      FROM public.user_profiles_ext
      WHERE user_id = NEW.user_id;

      -- Inserir em table_members (sem table_id ainda, será alocado pelo matchmaking)
      INSERT INTO public.table_members (
        table_id, user_id, vibe, matchmaking_answers
      ) VALUES (
        NULL, -- table_id será definido pelo algoritmo de matchmaking
        NEW.user_id,
        COALESCE(user_vibe, 'Explorador'),
        COALESCE(quiz_answers, '{}')
      );
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dropar trigger se existir para recriar
DROP TRIGGER IF EXISTS trg_collective_ticket ON public.tickets;

CREATE TRIGGER trg_collective_ticket
  AFTER INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_collective_ticket_insert();

-- ============================================================
-- View: mesas com contagem de membros
-- ============================================================

CREATE OR REPLACE VIEW public.collective_table_summary AS
SELECT
  ct.*,
  COUNT(tm.id) as member_count,
  ct.capacity - COUNT(tm.id) as remaining_spots
FROM public.collective_tables ct
LEFT JOIN public.table_members tm ON tm.table_id = ct.id
GROUP BY ct.id;

-- ============================================================
-- Checklist de verificação
-- ============================================================

-- Rode estas queries para verificar:

-- 1. Verificar tabelas criadas
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('user_profiles_ext', 'collective_tables', 'table_members');

-- 2. Verificar trigger
-- SELECT trigger_name, event_manipulation, event_object_table FROM information_schema.triggers WHERE trigger_schema = 'public' AND trigger_name = 'trg_collective_ticket';

-- 3. Teste insert em user_profiles_ext
-- INSERT INTO public.user_profiles_ext (user_id, temperament, intention, music_style, energy_level, birth_year, gender, vibe)
-- VALUES (auth.uid(), 'extrovert', 'fun', 'eletronica', 'high', 1995, 'F', 'Energética')
-- ON CONFLICT (user_id) DO NOTHING;
