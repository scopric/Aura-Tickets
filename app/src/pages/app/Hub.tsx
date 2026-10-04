import { useState, useMemo } from 'react'
import * as I from '@/components/icones/evokaa16'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { usePublicEvents } from '../../hooks/useEvents'
import { useUserTickets } from '../../hooks/useCheckout'
import { useAuth } from '../../hooks/useAuth'
import { Linha, LinhaAnterior, Passe } from '../../components/CartoesIngresso'
import SemIngressos, { NaoVejoMeuIngresso } from '../../components/SemIngressos'
import { useEventMenuItems } from '../../hooks/useMenuItems'
import { agruparPorEvento, ehProximo, motivoEvento, motivoSemQr } from '../../lib/ingresso'
import Chip from '../../components/Chip'
import EventoLinha from '../../components/EventoLinha'

export default function AppHub() {
  const [activeTab, setActiveTab] = useState<'ingressos' | 'eventos' | 'cardapio' | 'chat'>('ingressos')
  const [searchTerm, setSearchTerm] = useState('')
  const [menuCategory, setMenuCategory] = useState<string>('Todos')
  
  const { user } = useAuth()
  const { data: dbEvents = [], isLoading: isLoadingEvents } = usePublicEvents()
  const { data: dbTickets = [], isLoading: isLoadingTickets } = useUserTickets()

  // Próximos / Anteriores, em ordem de data (a mesma regra da tela Ingressos)
  const [agora] = useState(() => Date.now())
  const proximos = useMemo(() => agruparPorEvento(dbTickets.filter(t => ehProximo(t, agora))), [dbTickets, agora])
  const anteriores = useMemo(() => agruparPorEvento(dbTickets.filter(t => !ehProximo(t, agora)), true), [dbTickets, agora])
  const ativos = dbTickets.filter(t => !motivoSemQr(t)).length // vale: ativo, evento não cancelado nem fora do ar nem encerrado

  // O cardápio e o chat seguem o evento que vem primeiro por data (e que não está cancelado nem fora do ar), não a compra mais recente
  const comanda = proximos.find(g => !motivoEvento(g.evento))
  const activeEventId = comanda?.id ?? null
  const activeEventName = comanda?.evento?.title || 'Evento'

  const { data: dbMenuItems = [], isLoading: isLoadingMenu } = useEventMenuItems(activeEventId || undefined)

  const tabs = [
    { id: 'ingressos' as const, label: 'Meus Ingressos', count: ativos > 0 ? ativos : undefined },
    { id: 'eventos' as const, label: 'Eventos', count: dbEvents.length > 0 ? dbEvents.length : undefined },
    { id: 'cardapio' as const, label: 'Cardápio', count: undefined },
    { id: 'chat' as const, label: 'Chat', count: undefined },
  ]

  const filteredEvents = dbEvents.filter(e => 
    e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.venue_name || e.location || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  const tituloSecao = 'text-[15px] font-semibold leading-5'
  const diaCurto = (data: string | null) => data ? new Date(data + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }) : 'Data a definir'

  const renderStats = () => (
    <dl className="grid grid-cols-2 divide-x divide-border border-y border-border py-3 text-center">
      <div className="flex flex-col-reverse">
        <dt className="text-xs leading-4 text-muted-foreground">Ingressos ativos</dt>
        <dd className="font-display text-[28px] font-semibold leading-8 tracking-[-0.01em] tabular-nums">{isLoadingTickets ? '–' : ativos}</dd>
      </div>
      <div className="flex flex-col-reverse">
        <dt className="text-xs leading-4 text-muted-foreground">Eventos publicados</dt>
        <dd className="font-display text-[28px] font-semibold leading-8 tracking-[-0.01em] tabular-nums">{dbEvents.length}</dd>
      </div>
    </dl>
  )

  const renderTickets = () => (
    <div className="space-y-4">
      <h2 className={tituloSecao}>Meus Ingressos</h2>
      {isLoadingTickets ? (
        <div aria-busy="true" className="space-y-3">
          {[1, 2].map(i => <Skeleton key={i} className="h-[132px] w-full rounded-ev-lg" />)}
        </div>
      ) : proximos.length === 0 ? (
        <SemIngressos anteriores={anteriores.length} />
      ) : (
        <div className="space-y-3">
          <Passe g={proximos[0]} />
          {proximos.slice(1).map(g => <Linha key={g.id} g={g} />)}
          <NaoVejoMeuIngresso />
        </div>
      )}
      {!isLoadingTickets && anteriores.length > 0 && (
        <details className="group">
          <summary className="flex h-11 cursor-pointer items-center justify-between rounded-ev-md text-sm font-semibold focus-visible:outline-none focus-visible:shadow-ev-foco">
            <span>Anteriores <span className="font-display tabular-nums text-muted-foreground">{anteriores.length}</span></span>
            <I.ChevronDireita size={16} aria-hidden="true" className="transition-transform group-open:rotate-90" />
          </summary>
          <ul className="mt-2 space-y-3">{anteriores.map(g => <LinhaAnterior key={g.id + g.ingressos[0].id} g={g} />)}</ul>
        </details>
      )}
    </div>
  )

  const renderNextEvents = () => (
    <div className="space-y-4">
      <h2 className={`${tituloSecao} mt-6`}>Próximos Eventos</h2>
      {isLoadingEvents ? (
        <div aria-busy="true" className="space-y-3">
          {[1, 2].map(i => <Skeleton key={i} className="h-[120px] w-full rounded-ev-lg" />)}
        </div>
      ) : dbEvents.length > 0 ? (
        <ul className="divide-y divide-border">
          {dbEvents.slice(0, 2).map(event => (
            <EventoLinha key={event.id} evento={event} to={`/event/${event.id}`} linha={`${diaCurto(event.date)} · ${event.venue_name || event.location || 'Local a definir'}`} />
          ))}
        </ul>
      ) : (
        <p className="text-[13px] leading-[18px] text-muted-foreground">Nenhum evento agendado no momento.</p>
      )}
    </div>
  )

  const renderEventosList = () => (
    <div className="space-y-4">
      <h2 className={tituloSecao}>Descobrir Eventos</h2>
      <label className="relative block">
        <span className="sr-only">Buscar eventos</span>
        <I.Buscar size={16} className="pointer-events-none absolute left-3.5 top-3.5 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Buscar eventos..."
          className="h-11 rounded-ev-lg bg-card pl-10 text-base"
        />
      </label>

      {isLoadingEvents ? (
        <div aria-busy="true" className="space-y-3">
          {[1, 2].map(i => <Skeleton key={i} className="h-[120px] w-full rounded-ev-lg" />)}
        </div>
      ) : filteredEvents.length > 0 ? (
        <ul className="divide-y divide-border">
          {filteredEvents.map(event => {
            const formattedDate = event.date
              ? new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
              : 'Data a definir'
            return (
              <EventoLinha key={event.id} evento={event} to={`/event/${event.id}`} linha={`${formattedDate} · ${event.venue_name || event.location || 'Local a definir'}`} />
            )
          })}
        </ul>
      ) : (
        <p className="py-12 text-center text-[13px] leading-[18px] text-muted-foreground">Nenhum evento encontrado.</p>
      )}
    </div>
  )

  const renderCardapio = () => (
    <div className="space-y-4">
      <h2 className={tituloSecao}>Cardápio do Evento</h2>
      <p className="text-[13px] leading-[18px] text-[var(--ev-warning)]">Pedidos pelo app em breve: por enquanto, o cardápio é só para consulta.</p>
      {activeEventId ? (
        <>
          <div>
            <h3 className="truncate text-sm font-semibold">{activeEventName}</h3>
            <p className="text-xs leading-4 text-muted-foreground">Consulte os itens e preços do evento</p>
          </div>

          {/* Categories */}
          <div role="group" aria-label="Categorias do cardápio" className="flex items-center gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {['Todos', 'bebida', 'comida', 'combo', 'merch', 'servico'].map((cat) => (
              <Chip key={cat} marcado={menuCategory === cat} onClick={() => setMenuCategory(cat)}>
                {cat === 'servico' ? 'Serviço' : cat === 'merch' ? 'Merch' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Chip>
            ))}
          </div>

          {/* Menu items */}
          {isLoadingMenu ? (
            <div className="flex items-center justify-center py-8">
              <Spinner className="size-5" />
            </div>
          ) : dbMenuItems.length === 0 ? (
            <p className="py-8 text-center text-[13px] leading-[18px] text-muted-foreground">Cardápio não disponível para este evento.</p>
          ) : (
            <ul className="max-h-[300px] divide-y divide-border overflow-y-auto">
              {dbMenuItems
                .filter(item => menuCategory === 'Todos' || item.category === menuCategory)
                .map(item => {
                  const icons: Record<string, I.IconeEvokaa> = { bebida: I.Cardapio, comida: I.Talheres, combo: I.Pacote, merch: I.Pacote, servico: I.Destaque }
                  const Icon = icons[item.category] || I.Pacote
                  return (
                    <li key={item.id} className="flex items-center gap-3 py-3">
                      <span aria-hidden="true" className="grid size-9 flex-none place-items-center rounded-ev-md bg-secondary text-muted-foreground">
                        <Icon size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{item.name}</div>
                        <div className="truncate text-xs leading-4 text-muted-foreground">{item.description}</div>
                      </div>
                      <div className="flex-none font-display text-sm font-semibold tabular-nums">R$ {item.price}</div>
                    </li>
                  )
                })}
            </ul>
          )}
        </>
      ) : (
        <div className="space-y-1 py-8 text-center">
          <p className="text-sm font-semibold">Você não tem ingressos ativos</p>
          <p className="text-[13px] leading-[18px] text-muted-foreground">Compre um ingresso para ver o cardápio do evento</p>
        </div>
      )}
    </div>
  )

  const renderChat = () => (
    <div className="space-y-4">
      <h2 className={tituloSecao}>Chat com o Produtor</h2>
      <div role="status" className="space-y-1 py-8 text-center">
        <p className="text-sm font-semibold">O chat com o produtor ainda não está disponível</p>
        <p className="text-[13px] leading-[18px] text-muted-foreground">Para tirar uma dúvida, fale com a equipe da Evokaa pelo botão do Evo, no canto da tela.</p>
      </div>
    </div>
  )

  return (
    <div className="w-full pb-8 text-foreground">
      {/* Welcome */}
      <div className="max-w-lg lg:max-w-7xl mx-auto px-4 py-4 lg:py-6">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="grid size-10 flex-none place-items-center rounded-full bg-secondary text-muted-foreground">
            <I.Conta size={20} />
          </span>
          <div>
            <p className="text-[13px] leading-[18px] text-muted-foreground">Olá,</p>
            <h1 className="text-2xl font-semibold leading-8 tracking-[-0.015em]">{user?.full_name || user?.name || 'Participante'}</h1>
          </div>
        </div>
      </div>

      {/* Layout Responsivo: Grid no Desktop / Abas no Mobile */}
      <div className="max-w-lg lg:max-w-7xl mx-auto px-4">
        {/* Seletor de Abas (Visível apenas no Mobile) */}
        <div role="group" aria-label="Seções do Hub" className="lg:hidden mb-6 flex items-center gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map(t => (
            <Chip key={t.id} marcado={activeTab === t.id} onClick={() => setActiveTab(t.id)}>
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <>{' '}<span className="ml-0.5 font-display tabular-nums">{t.count}</span></>
              )}
            </Chip>
          ))}
        </div>

        {/* Visualização Mobile (Abas): o conteúdo entra pelo lado, 8 px, e só esmaece com "reduzir movimento" (aba-entra, index.css) */}
        <div key={activeTab} className="lg:hidden space-y-4 animate-[aba-entra_var(--mov-rapido)_var(--curva-sai)]">
          {activeTab === 'ingressos' && (
            <div className="space-y-6">
              {renderStats()}
              {renderTickets()}
              {renderNextEvents()}
            </div>
          )}
          {activeTab === 'eventos' && renderEventosList()}
          {activeTab === 'cardapio' && renderCardapio()}
          {activeTab === 'chat' && renderChat()}
        </div>

        {/* Visualização Desktop (Grid Completo de 3 Colunas) */}
        <div className="hidden lg:grid lg:grid-cols-12 lg:gap-10">
          {/* Coluna 1: Ingressos & Stats (4 colunas) */}
          <div className="lg:col-span-4 space-y-6">
            {renderStats()}
            {renderTickets()}
            {renderNextEvents()}
          </div>

          {/* Coluna 2: Busca & Descobrir Eventos (4 colunas) */}
          <div className="lg:col-span-4 space-y-6">
            {renderEventosList()}
          </div>

          {/* Coluna 3: Interação Local - Cardápio & Chat do Evento Ativo (4 colunas): seções separadas por fio, sem caixa */}
          <div className="lg:col-span-4 space-y-6">
            {renderCardapio()}
            <div className="border-t border-border pt-6">
              {renderChat()}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
