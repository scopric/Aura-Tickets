import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { SetaEsquerda } from '../../components/icones/evokaa16'
import { LinhaAnterior, Linha, Passe } from '../../components/CartoesIngresso'
import IngressosDoEvento from '../../components/Ingresso'
import ThemeToggle from '../../components/ThemeToggle'
import SemIngressos, { NaoVejoMeuIngresso } from '../../components/SemIngressos'
import YourTable from '../../components/YourTable'
import { Button } from '../../components/ui/button'
import { Spinner } from '../../components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { useUserTickets } from '../../hooks/useUserTickets'
import { agruparPorEvento, ehProximo, enderecoDoEvento, linkMapa } from '../../lib/ingresso'

export default function ParticipantTickets() {
  const [params] = useSearchParams()
  const [mesaDe, setMesaDe] = useState<string | null>(null) // evento da "Sua mesa" aberta
  const { data: tickets = [], isLoading } = useUserTickets()

  const [agora] = useState(() => Date.now()) // a lista vale para esta abertura da tela
  const proximos = agruparPorEvento(tickets.filter(t => ehProximo(t, agora)))
  const anteriores = agruparPorEvento(tickets.filter(t => !ehProximo(t, agora)), true)
  const eventoId = params.get('evento')
  // o link direto abre qualquer ingresso ativo, mesmo o de um evento que a lista já considera anterior (evento de vários dias sem end_date);
  // o QR some só se o evento está cancelado ou tem end_date vencida (motivoSemQr)
  const aberto = eventoId ? agruparPorEvento(tickets.filter(t => t.status === 'active')).find(g => g.id === eventoId) : undefined

  return (
    <div className="mx-auto w-full max-w-lg">
      {eventoId ? (
        <>
          <div className="mb-4 flex items-center gap-2">
            <Button asChild variant="ghost" size="icon" className="-ml-2.5">
              <Link to="/app/tickets" aria-label="Voltar para Ingressos"><SetaEsquerda aria-hidden="true" /></Link>
            </Button>
            <h1 className="min-w-0 flex-1 truncate text-[15px] font-semibold">{aberto?.evento?.title ?? 'Ingressos'}</h1>
          </div>
          {isLoading ? (
            <div className="py-20 text-center"><Spinner className="mx-auto size-6" /></div>
          ) : aberto?.evento ? (
            <IngressosDoEvento ingressos={aberto.ingressos} evento={aberto.evento} abrirNoQr={params.get('qr') === '1'} onSuaMesa={() => setMesaDe(aberto.id)} />
          ) : (
            <div className="py-16 text-center">
              <p className="text-sm text-muted-foreground">Não encontramos ingressos ativos deste evento.</p>
              <Button asChild variant="outline" className="mt-4"><Link to="/app/tickets">Ver meus ingressos</Link></Button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-2">
            <h1 className="flex-1 text-2xl font-semibold tracking-[-0.015em]">Ingressos</h1>
            <ThemeToggle collapsed className="size-11" />
          </div>

          {isLoading ? (
            <div className="py-20 text-center"><Spinner className="mx-auto size-6" /></div>
          ) : (
            <Tabs defaultValue="proximos">
              <TabsList variant="pilula" className="h-10 w-full">
                <TabsTrigger value="proximos">Próximos <span className="font-display tabular-nums text-muted-foreground">{proximos.length}</span></TabsTrigger>
                <TabsTrigger value="anteriores">Anteriores <span className="font-display tabular-nums text-muted-foreground">{anteriores.length}</span></TabsTrigger>
              </TabsList>

              <TabsContent value="proximos" className="mt-3">
                {proximos.length === 0 ? (
                  <SemIngressos anteriores={anteriores.length} />
                ) : (
                  <div className="space-y-3">
                    <Passe g={proximos[0]} />
                    {proximos[0].evento && (
                      <Button asChild variant="ghost" className="h-12 w-full justify-start gap-3 px-1 text-sm font-medium text-foreground">
                        <a href={linkMapa(enderecoDoEvento(proximos[0].evento) || proximos[0].evento.title)} target="_blank" rel="noopener noreferrer">
                          <span className="flex-1 truncate text-left">{[proximos[0].evento.venue_name, proximos[0].evento.venue_city].filter(Boolean).join(', ') || 'Local do evento'}</span>
                          <span className="font-semibold text-primary">Como chegar</span>
                        </a>
                      </Button>
                    )}
                    {proximos.length > 1 && (
                      <>
                        <h2 className="pt-3 text-[15px] font-semibold">Mais adiante</h2>
                        {proximos.slice(1).map(g => <Linha key={g.id} g={g} />)}
                      </>
                    )}
                    <NaoVejoMeuIngresso />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="anteriores" className="mt-3">
                {anteriores.length === 0 ? (
                  <p className="py-16 text-center text-sm text-muted-foreground">Nenhum ingresso anterior.</p>
                ) : (
                  <>
                    <ul className="space-y-3">{anteriores.map(g => <LinhaAnterior key={g.id + g.ingressos[0].id} g={g} />)}</ul>
                    <p className="pt-5 text-[13px] leading-5 text-muted-foreground">Ingresso usado não abre o QR de novo.</p>
                  </>
                )}
              </TabsContent>
            </Tabs>
          )}
        </>
      )}

      {/* Sua mesa (Match de Mesa) */}
      {mesaDe && (
        // Esc fecha; o contains ignora o Esc dos modais internos (termo, denúncia, questionário), que vêm por portal
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
          role="dialog" aria-modal="true" aria-label="Sua mesa" tabIndex={-1}
          onKeyDown={e => { if (e.key === 'Escape' && e.currentTarget.contains(e.target as Node)) setMesaDe(null) }}
        >
          <div className="absolute inset-0 glass-backdrop" onClick={() => setMesaDe(null)} />
          <div className="relative w-full max-w-2xl my-8">
            <button autoFocus onClick={() => setMesaDe(null)} aria-label="Fechar sua mesa" className="absolute -top-3 -right-3 z-10 w-9 h-9 rounded-full bg-void border border-white/10 text-cream flex items-center justify-center"><X className="w-4 h-4" /></button>
            <YourTable eventId={mesaDe} />
          </div>
        </div>
      )}
    </div>
  )
}
