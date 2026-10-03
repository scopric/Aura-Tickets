import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { situacaoEvento } from '../lib/eventoProdutor'
import type { DbEvent } from './useEvents'

// Faixa "ao vivo" do celular (V4b): só com evento publicado "em andamento" e só com a contagem real de check-ins.
// Em andamento = agora entre 3 h antes do início e o fim (end_date, ou início + 12 h): a portaria abre antes da hora
// e a festa passa da meia-noite. Evento sem hora (só date) vale o dia inteiro, 00:00 a +24 h, como em dataPorVir.
// A hora do evento (date + time) é a de Brasília.
const FUSO = 'America/Sao_Paulo'
const HORA = 3_600_000
const ANTES = 3 * HORA
const DURACAO_PADRAO = 12 * HORA
const DIA = 24 * HORA

// ms que o fuso está à frente do UTC no instante t (derivado do Intl: segue a regra do fuso, sem deslocamento fixo)
function deslocamento(t: number): number {
  const p: Record<string, string> = {}
  for (const x of new Intl.DateTimeFormat('en-US', { timeZone: FUSO, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(t))) p[x.type] = x.value
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(t / 1000) * 1000
}

/** Instante (ms UTC) de "AAAA-MM-DD" + "HH:MM[:SS]" na hora de Brasília */
export function instanteLocal(data: string, hora = '00:00:00'): number {
  const [a, m, d] = data.split('-').map(Number)
  const [h = 0, mi = 0, s = 0] = hora.split(':').map(Number)
  const parede = Date.UTC(a, m - 1, d, h, mi, s)
  return parede - deslocamento(parede - deslocamento(parede))
}

const diaInteiro = (e: DbEvent) => !!e.date && !e.time
const inicioDe = (e: DbEvent) => (e.date ? instanteLocal(e.date, e.time || '00:00:00') : new Date(e.start_date).getTime())
const fimDe = (e: DbEvent) => (e.end_date ? new Date(e.end_date).getTime() : inicioDe(e) + (diaInteiro(e) ? DIA : DURACAO_PADRAO))
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
