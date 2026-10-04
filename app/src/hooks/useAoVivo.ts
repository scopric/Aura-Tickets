import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { fimDe, inicioDe, situacaoEvento, diaInteiro } from '../lib/eventoProdutor'
import type { DbEvent } from './useEvents'

// Faixa "ao vivo" do celular (V4b): só com evento publicado "em andamento" e só com a contagem real de check-ins.
// Em andamento = agora entre 3 h antes do início e o fim (end_date, ou início + 12 h): a portaria abre antes da hora
// e a festa passa da meia-noite. Evento sem hora (só date) vale o dia inteiro, 00:00 a +24 h, como em dataPorVir.
// A hora do evento (date + time) é a de Brasília.
const HORA = 3_600_000
const ANTES = 3 * HORA

const abreEm = (e: DbEvent) => inicioDe(e) - (diaInteiro(e) ? 0 : ANTES) // a portaria abre 3 h antes, se há hora

/** Evento publicado em andamento. Com mais de um, o de início mais perto de agora */
export function eventoEmAndamento(eventos: DbEvent[], agora = new Date()): DbEvent | undefined {
  const t = agora.getTime()
  return eventos
    .filter(e => situacaoEvento(e) === 'Publicado' && t >= abreEm(e) && t <= fimDe(e))
    .sort((a, b) => Math.abs(inicioDe(a) - t) - Math.abs(inicioDe(b) - t))[0]
}

/** `{ evento, entraram }` quando há evento em andamento e a contagem chegou; null em qualquer outro caso (inclusive erro) */
export function useAoVivo(eventos: DbEvent[]) {
  // reavalia a janela a cada minuto: a faixa aparece 3 h antes e some no fim mesmo com a tela parada
  const [, passou] = useState(0)
  useEffect(() => {
    const r = setInterval(() => passou(n => n + 1), 60_000)
    return () => clearInterval(r)
  }, [])
  const evento = eventoEmAndamento(eventos)
  const desde = evento ? new Date(abreEm(evento)).toISOString() : ''
  const { data } = useQuery({
    queryKey: ['ao-vivo', evento?.id, desde],
    enabled: !!evento,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', evento!.id)
        .gte('checked_in_at', desde)
      if (error) throw error
      return count ?? 0
    },
  })
  return evento && data !== undefined ? { evento, entraram: data } : null
}
