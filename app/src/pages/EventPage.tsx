import { useParams, Link } from 'react-router-dom'
import { useEffect } from 'react'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { useSEO } from '../hooks/useSEO'
import { usePublicEvent } from '../hooks/useEvents'
import { useSalvarPendente } from '../hooks/useFavoritos'
import EventoConteudo from '../components/EventoConteudo'

export default function EventPage() {
  const { eventId } = useParams()
  const { data: event, isLoading, error } = usePublicEvent(eventId)
  useSalvarPendente(event?.id, isLoading) // volta do login pelo coração: grava o favorito aqui

  useSEO({
    title: event ? `${event.title} | Evokaa Tickets` : 'Evento | Evokaa Tickets',
    description: event?.short_description || event?.description || 'Detalhes do evento e compra de ingressos na Evokaa Tickets.',
    image: event?.image_url || event?.cover_image || '/og-image.jpg',
    type: 'event',
  })

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [eventId])

  // Se estiver carregando, exibe o esqueleto da página
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background" aria-busy="true" aria-label="Carregando o evento">
        <div className="mx-auto max-w-xl animate-pulse md:border-x md:border-border">
          <div className="aspect-[390/460] w-full bg-secondary" />
          <div className="space-y-3 bg-secondary/60 px-5 py-6">
            <div className="h-4 w-1/2 rounded bg-secondary" />
            <div className="h-9 w-3/4 rounded bg-secondary" />
          </div>
          <div className="space-y-4 px-5 py-6">
            <div className="h-6 w-full rounded bg-secondary" />
            <div className="h-6 w-5/6 rounded bg-secondary" />
          </div>
        </div>
      </div>
    )
  }

  // Se não encontrar ou der erro
  if (error || !event) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center text-foreground">
        <div className="w-full max-w-md rounded-ev-2xl bg-card p-8 shadow-ev-secondary">
          <div className="mx-auto mb-6 grid size-14 place-items-center rounded-full bg-secondary text-muted-foreground">
            <I.Local size={28} />
          </div>
          <h1 className="mb-3 text-2xl font-semibold">Evento Não Encontrado</h1>
          <p className="mb-8 text-sm leading-relaxed text-muted-foreground">
            O evento solicitado não foi encontrado ou foi removido pelo produtor. Verifique se o endereço está correto.
          </p>
          <Button asChild size="lg" className="rounded-full">
            <Link to="/"><I.SetaEsquerda size={16} /> Voltar para Explorar</Link>
          </Button>
        </div>
      </div>
    )
  }

  return <EventoConteudo evento={event} />
}
