import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { situacaoEvento } from '../lib/eventoProdutor'
import type { DbEvent } from './useEvents'

// Faixa "ao vivo" do celular (V4b): só no dia de um evento publicado e só com a contagem real de check-ins do dia.
// ponytail: dia e hora na hora de Brasília (-03:00 fixo, como dataPorVir); com dois eventos no mesmo dia vale o mais cedo.
const diaDe = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }) // AAAA-MM-DD

export function eventoDeHoje(eventos: DbEvent[], agora = new Date()): DbEvent | undefined {
  const hoje = diaDe(agora)
  return eventos
    .filter(e => situacaoEvento(e) === 'Publicado' && (e.date ?? diaDe(new Date(e.start_date))) === hoje)
    .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))[0]
}

/** `{ evento, entraram }` quando há evento publicado hoje e a contagem chegou; null em qualquer outro caso (inclusive erro) */
export function useAoVivo(eventos: DbEvent[]) {
  const evento = eventoDeHoje(eventos)
  const dia = diaDe(new Date())
  const { data } = useQuery({
    queryKey: ['ao-vivo', evento?.id, dia],
    enabled: !!evento,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', evento!.id)
        .gte('checked_in_at', `${dia}T00:00:00-03:00`)
      if (error) throw error
      return count ?? 0
    },
  })
  return evento && data !== undefined ? { evento, entraram: data } : null
}
