import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import EventoLinha, { Preco } from '../../components/EventoLinha'
import { useEventosSalvos, useFavoritos } from '../../hooks/useFavoritos'
import { rotuloDia } from '../../lib/explorar'
import { diaBR, horaCurta } from '../../lib/visaoEvento'

const hojeSP = () => diaBR(Date.now())

// Aba Salvos do Explorar: os eventos que o participante marcou com o coração. Os que saíram do ar ficam na lista, sem link,
// só para remover; os que já passaram ficam marcados. Salvar não reserva ingresso.
export default function Salvos() {
  const { data: salvos = [], isLoading, isError, refetch } = useEventosSalvos()
  const { definir } = useFavoritos()
  const hoje = hojeSP()

  if (isLoading) {
    return (
      <div aria-busy="true" className="mt-4 space-y-5">
        {[1, 2, 3].map(k => <Skeleton key={k} className="h-[120px] w-full rounded-ev-lg" />)}
        <span className="sr-only" role="status">Carregando os eventos salvos</span>
      </div>
    )
  }
  if (isError) {
    return (
      <div role="alert" className="mt-10 flex max-w-sm flex-col items-start gap-3">
        <p className="text-lg font-semibold">Não deu para carregar os eventos salvos.</p>
        <Button variant="outline" size="lg" onClick={() => refetch()}>Tentar de novo</Button>
      </div>
    )
  }
  if (salvos.length === 0) {
    return (
      <div role="status" className="mt-10 flex max-w-sm flex-col items-start gap-3">
        <p className="text-lg font-semibold">Você ainda não salvou nenhum evento.</p>
        <p className="text-[15px] text-muted-foreground">Toque no coração de um evento para guardá-lo aqui.</p>
        <Button asChild variant="outline" size="lg"><Link to="/app/events">Explorar eventos</Link></Button>
      </div>
    )
  }
  return (
    <>
      <p className="mt-4 text-[13px] leading-[18px] text-muted-foreground">Salvar um evento não reserva ingresso: o ingresso só é seu depois da compra.</p>
      <ul className="mt-3 divide-y divide-border sm:grid sm:grid-cols-2 sm:gap-3 sm:divide-y-0">
        {salvos.map(({ eventId, evento: e }) => e ? (
          <EventoLinha
            key={eventId}
            evento={e}
            to={`/event/${e.slug || e.id}`}
            linha={[e.date && rotuloDia(e.date, hoje).curto, horaCurta(e.time), e.venue_name || e.venue_city].filter(Boolean).join(' · ')}
            preco={e.date && e.date < hoje ? <span className="font-semibold">Evento passado</span> : <Preco evento={e} />}
            className="sm:rounded-ev-xl sm:border sm:border-border sm:p-3 sm:first:p-3 sm:last:p-3"
            salvavel
          />
        ) : (
          <li key={eventId} className="flex items-center justify-between gap-3 py-4 first:pt-0">
            <span className="min-w-0">
              <span className="block text-base font-semibold leading-[22px]">Evento fora do ar</span>
              <span className="mt-1 block text-[13px] leading-[18px] text-muted-foreground">Este evento não está mais disponível.</span>
            </span>
            <Button variant="outline" size="sm" onClick={() => definir(eventId, false, true)}>Remover</Button>
          </li>
        ))}
      </ul>
    </>
  )
}
