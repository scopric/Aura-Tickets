import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import BotaoSalvar from '../../components/BotaoSalvar'
import EventoCapa from '../../components/EventoCapa'
import { useEventosSalvos, useFavoritos } from '../../hooks/useFavoritos'
import { rotuloDia } from '../../lib/explorar'
import { diaBR, horaCurta } from '../../lib/visaoEvento'

const hojeSP = () => diaBR(Date.now())

// Salvos (VF): os eventos que o participante marcou com o coração. Os que saíram do ar ficam na lista, sem link, só para remover.
export default function Salvos() {
  const { data: salvos = [], isLoading, isError, refetch } = useEventosSalvos()
  const { definir } = useFavoritos()
  const hoje = hojeSP()

  return (
    <div className="max-w-3xl text-foreground">
      <h1 className="mb-6 text-2xl font-semibold tracking-[-0.015em]">Salvos</h1>

      {isLoading ? (
        <div aria-busy="true" className="space-y-5">
          {[1, 2, 3].map(k => <Skeleton key={k} className="h-[88px] w-full rounded-ev-lg" />)}
          <span className="sr-only" role="status">Carregando os eventos salvos</span>
        </div>
      ) : isError ? (
        <div role="alert" className="flex max-w-sm flex-col items-start gap-3">
          <p className="text-lg font-semibold">Não deu para carregar os eventos salvos.</p>
          <Button variant="outline" size="lg" onClick={() => refetch()}>Tentar de novo</Button>
        </div>
      ) : salvos.length === 0 ? (
        <div role="status" className="flex max-w-sm flex-col items-start gap-3">
          <p className="text-lg font-semibold">Você ainda não salvou nenhum evento.</p>
          <p className="text-[15px] text-muted-foreground">Toque no coração de um evento para guardá-lo aqui.</p>
          <Button asChild variant="outline" size="lg"><Link to="/events">Explorar eventos</Link></Button>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {salvos.map(({ eventId, evento: e }) => e ? (
            <li key={eventId} className="flex items-center gap-1 py-4 first:pt-0">
              <Link to={`/event/${e.id}`} className="flex min-w-0 flex-1 gap-3 rounded-ev-lg focus-visible:outline-none focus-visible:shadow-ev-foco">
                <span aria-hidden="true" className="block w-20 flex-none"><EventoCapa evento={e} tamanho="cartao" /></span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 block text-base font-semibold leading-[22px]">{e.title}</span>
                  <span className="mt-1 block text-[13px] leading-[18px] text-muted-foreground">
                    {[e.date && rotuloDia(e.date, hoje).curto, horaCurta(e.time), e.venue_name || e.venue_city].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </Link>
              <BotaoSalvar eventId={e.id} className="size-11 text-muted-foreground" />
            </li>
          ) : (
            <li key={eventId} className="flex items-center justify-between gap-3 py-4 first:pt-0">
              <span className="min-w-0">
                <span className="block text-base font-semibold leading-[22px]">Evento fora do ar</span>
                <span className="mt-1 block text-[13px] leading-[18px] text-muted-foreground">Este evento não está mais disponível.</span>
              </span>
              <Button variant="outline" size="sm" onClick={() => definir(eventId, false)}>Remover</Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
