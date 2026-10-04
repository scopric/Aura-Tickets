import { useProducerEvents } from '../../hooks/useEvents'
import { useFiltroEvento } from '../../hooks/useEventoDaUrl'
import { cn } from '@/lib/utils'
import { selectNativo } from '@/components/producer/ui'

// Seletor do filtro por evento das telas de lista (V4a2): mostra o evento ativo e "Todos os eventos" tira o filtro.
export default function FiltroEvento() {
  const [id, trocar] = useFiltroEvento()
  const { data: eventos = [], isPending } = useProducerEvents()
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <label htmlFor="filtro-evento" className="text-sm text-muted-foreground">Evento</label>
      <select
        id="filtro-evento"
        value={id ?? ''}
        onChange={e => trocar(e.target.value || null)}
        className={cn(selectNativo, 'w-auto min-w-48')}
      >
        <option value="">Todos os eventos</option>
        {id && !eventos.some(e => e.id === id) && <option value={id}>{isPending ? 'Carregando…' : 'Evento não encontrado'}</option>}
        {eventos.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
      </select>
    </div>
  )
}
