import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { cn } from '@/lib/utils'
import AviseMe from './AviseMe'
import BotaoSalvar from './BotaoSalvar'
import CollectiveTableCard from './CollectiveTableCard'
import ContadorIngresso from './ContadorIngresso'
import EventoCapa from './EventoCapa'
import ThemeToggle from './ThemeToggle'
import type { DbEvent } from '../hooks/useEvents'
import { corSorteada, ehHex, varsDoEvento } from '../lib/corEvento'
import { calcularTaxa, resumoCarrinho, brl, TAXA_PERCENTUAL, TAXA_MINIMA } from '../lib/taxa'

import { esgotado, lotacao, noLimite } from '../lib/lotacao'
import { CLASSIFICACOES } from '../lib/tipoEvento'
import { fimDe } from '../lib/eventoProdutor'
import { fimDasVendas } from '../lib/interesse'

const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// "22:00" vira "22h"; "21:30", "21h30"
function horaCurta(time: string | null) {
  const m = time?.match(/^(\d{1,2}):(\d{2})/)
  return m ? `${+m[1]}h${m[2] === '00' ? '' : m[2]}` : time || ''
}

// Linha de informação (ícone de 20 px, sem caixa; contrato 8.1, item 4)
function Linha({ icone, titulo, sub, href, rotulo }: { icone: ReactNode; titulo: string; sub?: string; href?: string; rotulo?: string }) {
  const corpo = (
    <>
      <span className="shrink-0 text-muted-foreground">{icone}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-base leading-6">{titulo}</span>
        {sub && <span className="block text-[13px] leading-5 text-muted-foreground">{sub}</span>}
      </span>
      {href && <I.AbrirExterno size={16} className="shrink-0 text-muted-foreground" />}
    </>
  )
  const classe = 'flex min-h-14 w-full items-center gap-4 border-t border-border px-5 py-2 text-left first:border-t-0'
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={rotulo} className={cn(classe, 'hover:bg-[var(--ev-tint-hover)] focus-visible:shadow-[inset_0_0_0_2px_hsl(var(--ring))] focus-visible:outline-none')}>{corpo}</a>
  ) : (
    <div className={classe}>{corpo}</div>
  )
}

// O corpo da página pública do evento. Com `previa` (painel do produtor, PR3d-1) vira só o miolo: sem cabeçalho, sem
// "Aparência", sem listener de rolagem, barra de compra sticky e "Comprar" desligado. 'moldura' = vidro; 'folha' = sólida.
export default function EventoConteudo({ evento: event, previa }: { evento: DbEvent; previa?: 'moldura' | 'folha' }) {
  const navigate = useNavigate()
  const heroRef = useRef<HTMLDivElement>(null)
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null)
  const [cart, setCart] = useState<Record<string, number>>({})
  const [rolou, setRolou] = useState(false)
  const [sobreAberto, setSobreAberto] = useState(false)
  const [taxaAberta, setTaxaAberta] = useState(false)

  // A barra de topo ganha vidro quando a capa sai de cena (passa por baixo dela)
  useEffect(() => {
    if (previa) return
    const aoRolar = () => setRolou(window.scrollY > (heroRef.current?.offsetHeight ?? 460) - 64)
    aoRolar()
    window.addEventListener('scroll', aoRolar, { passive: true })
    return () => window.removeEventListener('scroll', aoRolar)
  }, [event, previa])

  const addToCart = (ticketId: string) => {
    setCart((prev) => ({ ...prev, [ticketId]: (prev[ticketId] || 0) + 1 }))
  }

  const removeFromCart = (ticketId: string) => {
    setCart((prev) => {
      const updated = { ...prev }
      if (updated[ticketId] > 1) {
        updated[ticketId]--
      } else {
        delete updated[ticketId]
      }
      return updated
    })
  }

  const handleShare = async () => {
    if (navigator.share && event) {
      try {
        await navigator.share({
          title: event.title,
          text: event.subtitle || event.description || '',
          url: window.location.href,
        })
      } catch {
        // Ignora cancelamentos
      }
    } else {
      navigator.clipboard.writeText(window.location.href)
      toast.success('Link copiado para a área de transferência!')
    }
  }

  const voltar = () => (window.history.length > 1 ? navigate(-1) : navigate('/events'))

  const corEv = ehHex(event.accent_color) ? event.accent_color : corSorteada(event.id)
  const ticketTypes = event.ticket_types || []
  const gallery: string[] = Array.isArray(event.gallery) ? event.gallery.filter((g: unknown) => typeof g === 'string' && g) : []

  const cartResumo = resumoCarrinho(Object.entries(cart).map(([ticketId, qty]) => ({
    preco: ticketTypes.find((t) => t.id === ticketId)?.price || 0,
    qtd: qty,
  })))
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0)

  // "A partir de": o menor total (com a taxa) entre os ingressos que ainda se vendem
  // Janela de venda (sale_start/sale_end) e evento já realizado: sem isso o "+" e o "Comprar" seguiam ligados
  const agora = Date.now()
  const janela = (t: (typeof ticketTypes)[number]) =>
    t.sale_end && Date.parse(t.sale_end) < agora ? 'Vendas encerradas'
    : t.sale_start && Date.parse(t.sale_start) > agora ? `Vendas começam em ${new Date(t.sale_start).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
    : null
  const encerrado = fimDe(event) < agora // regra do projeto: sem end_date, início + 12h (como ehProximo)
  const aVenda = encerrado ? [] : ticketTypes.filter((t) => !esgotado(t) && !janela(t))
  const motivos = ticketTypes.filter((t) => !esgotado(t)).map(janela).filter(Boolean) as string[]
  const motivoSemVenda = encerrado ? 'Evento encerrado' : motivos.find((m) => m.startsWith('Vendas começam')) ?? motivos[0] ?? null
  const semVendaAinda = !encerrado && aVenda.length === 0 && !!motivoSemVenda?.startsWith('Vendas começam') // "Avise-me"
  const fimVendas = fimDasVendas(aVenda.map((t) => t.sale_end))
  const menorTotal = aVenda.length ? Math.min(...aVenda.map((t) => calcularTaxa(t.price).total)) : 0

  const dataEvento = event.date ? new Date(event.date + 'T00:00:00') : null
  const dataLonga = dataEvento
    ? maiuscula(dataEvento.toLocaleDateString('pt-BR', {
        weekday: 'long', day: 'numeric', month: 'long',
        ...(dataEvento.getFullYear() !== new Date().getFullYear() && { year: 'numeric' as const }),
      }))
    : 'Data a definir'
  const hora = horaCurta(event.time)
  const local = event.venue_name || event.location || 'Local a definir'
  const endereco = [event.venue_address, [event.venue_city, event.venue_state].filter(Boolean).join(', ')].filter(Boolean).join(' · ')
  const mapaUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([event.venue_name, event.venue_address, event.venue_city].filter(Boolean).join(', ') || local)}`
  const descricao = event.description?.trim()
  const descricaoLonga = (descricao?.length ?? 0) > 240

  // Folha aberta: o vidro de trás vira sólido e sai da conta dos 3 (contrato 2.8.6)
  const solido = taxaAberta
  const barraSolida = solido || previa === 'folha'

  const circulo = cn(
    'relative grid size-10 shrink-0 place-items-center rounded-full alvo-44',
    'transition-transform duration-micro active:scale-105 motion-reduce:active:scale-100',
    'focus-visible:outline-none focus-visible:shadow-ev-foco',
  )
  const circuloFundo = rolou ? '' : solido ? 'bg-card text-foreground shadow-ev-2' : 'vidro'

  return (
    <div className={cn('evento-cor bg-background text-foreground', !previa && 'min-h-screen')} style={varsDoEvento(corEv)}>
      {/* Barra de topo: círculos de vidro sobre a capa; depois de rolar, a barra inteira ganha vidro */}
      {!previa && <header
        className={cn(
          'fixed inset-x-0 top-0 z-40 h-16',
          rolou && (solido
            ? 'bg-card text-foreground shadow-[inset_0_-1px_0_hsl(var(--border))]'
            : 'vidro rounded-none shadow-[inset_0_-1px_0_var(--vidro-base)]'),
        )}
      >
        <div className="mx-auto flex h-full max-w-xl items-center gap-2 px-3">
          <button type="button" onClick={voltar} aria-label="Voltar" className={cn(circulo, circuloFundo)}>
            <I.ChevronEsquerda size={20} />
          </button>
          <span
            aria-hidden="true"
            className={cn('min-w-0 flex-1 truncate text-[15px] font-semibold leading-5 transition-opacity duration-rapido motion-reduce:transition-none', rolou ? 'opacity-100' : 'opacity-0')}
          >
            {event.title}
          </span>
          <button type="button" onClick={handleShare} aria-label="Compartilhar" className={cn(circulo, circuloFundo)}>
            <I.Compartilhar size={20} />
          </button>
          {event.visibility === 'public' && <BotaoSalvar eventId={event.id} className={cn(circulo, circuloFundo)} />}
        </div>
      </header>}

      <div className={cn('mx-auto max-w-xl', !previa && 'min-h-screen md:border-x md:border-border')}>
        {/* Capa sem texto por cima: foto em duotone na cor do evento ou cartaz (o nome fica no bloco abaixo) */}
        <div ref={heroRef} className="relative aspect-[390/460] w-full overflow-hidden">
          <EventoCapa evento={event} tamanho="faixa" prioridade />
        </div>

        {/* Bloco de título na cor do evento: o nome aparece uma vez só */}
        <section className="bg-[var(--evento-fundo)] px-5 pb-5 pt-[22px]">
          <p className="text-[15px] font-semibold leading-5 text-[var(--evento-texto)]">{dataLonga}{hora && ` · ${hora}`}</p>
          <h1 className="font-display wide mt-1.5 break-words text-[34px] font-extrabold leading-9 tracking-[-0.02em]">{event.title}</h1>
          {event.subtitle && <p className="mt-2 text-base leading-6">{event.subtitle}</p>}
          <p className="mt-2 text-sm leading-5">{local}</p>
        </section>

        <div className="py-2">
          <Linha
            icone={<I.Horario size={20} />}
            titulo={dataEvento ? dataEvento.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Data a definir'}
            sub={hora || undefined}
          />
          <Linha icone={<I.Local size={20} />} titulo={local} sub={endereco || undefined} href={mapaUrl} rotulo={`Como chegar: ${local} (abre o mapa)`} />
          <Linha icone={<I.Info size={20} />} titulo={event.classificacao ? `Classificação: ${CLASSIFICACOES.find((c) => c.valor === event.classificacao)?.rotulo ?? event.classificacao}` : event.category === 'esporte' ? 'Evento esportivo: sem classificação indicativa' : 'Classificação não informada pelo produtor'} />
        </div>

        {/* Ingressos: lista, com a taxa ao lado do preço (Decreto 13.108, art. 7º) */}
        <section id="ingressos" aria-labelledby="h-ingressos" className="scroll-mt-20 border-t border-border px-5 pb-2 pt-6">
          <h2 id="h-ingressos" className="text-[15px] font-semibold leading-5">Ingressos</h2>
          {fimVendas && <p className="mt-1 text-sm font-medium leading-5 text-primary">{fimVendas}</p>}

          {semVendaAinda && <AviseMe eventId={event.id} />}

          {ticketTypes.length === 0 && (
            <p className="py-4 text-sm text-muted-foreground">Nenhum ingresso disponível no momento.</p>
          )}

          {ticketTypes.map((ticket) => {
            const fechado = encerrado ? 'Evento encerrado' : janela(ticket)
            if (ticket.type === 'coletiva') {
              return (
                <div key={ticket.id} className="py-3">
                  <CollectiveTableCard
                    ticket={{
                      id: ticket.id,
                      name: ticket.name,
                      price: ticket.price,
                      description: ticket.description || '',
                      sold: ticket.sold || 0,
                      capacity: lotacao(ticket),
                      type: 'coletiva',
                      perks: ticket.perks || [],
                    }}
                    cartQty={cart[ticket.id] || 0}
                    motivoFechado={fechado}
                    mostrarAvisoFoto={ticket.id === ticketTypes.find((t) => t.type === 'coletiva')?.id}
                    // Match de Mesa: 1 lugar por conta em cada evento (o banco recusa quantidade maior)
                    onAdd={() => { if (!cart[ticket.id]) addToCart(ticket.id) }}
                    onRemove={() => removeFromCart(ticket.id)}
                    onQuantityChange={(qty) => {
                      const diff = Math.min(qty, 1) - (cart[ticket.id] || 0)
                      if (diff > 0) {
                        for (let i = 0; i < diff; i++) addToCart(ticket.id)
                      } else if (diff < 0) {
                        for (let i = 0; i < Math.abs(diff); i++) removeFromCart(ticket.id)
                      }
                    }}
                  />
                </div>
              )
            }

            const acabou = esgotado(ticket)
            const { taxa, total } = calcularTaxa(ticket.price)
            const perks = ticket.perks || []
            return (
              <div key={ticket.id} className="flex items-center gap-3 border-t border-border py-3 first-of-type:border-t-0">
                <div className="min-w-0 flex-1">
                  <div className={cn('text-base font-medium leading-6', acabou && 'text-muted-foreground')}>{ticket.name}</div>
                  {ticket.description && <p className="text-[13px] leading-5 text-muted-foreground">{ticket.description}</p>}
                  {acabou ? (
                    <div className="text-sm leading-5 text-muted-foreground">
                      {ticket.price > 0 && <><s className="font-display font-semibold tabular-nums">{brl(total)}</s> · </>}Esgotado
                    </div>
                  ) : fechado ? (
                    <div className="text-sm leading-5 text-muted-foreground">{fechado}</div>
                  ) : ticket.price > 0 ? (
                    <div className="flex flex-wrap items-center gap-x-1.5 text-sm leading-5">
                      <span className="font-display font-semibold tabular-nums">{brl(total)}</span>
                      <span className="text-muted-foreground">{brl(ticket.price)} + {brl(taxa)} de taxa</span>
                      <Button type="button" variant="ghost" size="icon-sm" className="size-6 rounded-full" onClick={() => setTaxaAberta(true)} aria-label="O que é a taxa">
                        <I.Ajuda size={16} />
                      </Button>
                    </div>
                  ) : (
                    <div className="text-sm font-semibold leading-5">Gratuito</div>
                  )}
                  {perks.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setExpandedTicket(expandedTicket === ticket.id ? null : ticket.id)}
                        aria-expanded={expandedTicket === ticket.id}
                        aria-controls={`perks-${ticket.id}`}
                        className="mt-1 text-[13px] font-semibold leading-5 text-primary underline underline-offset-4"
                      >
                        {expandedTicket === ticket.id ? 'Ocultar benefícios' : 'Ver benefícios'}
                      </button>
                      <ul id={`perks-${ticket.id}`} hidden={expandedTicket !== ticket.id} className="mt-1 space-y-1">
                        {perks.map((perk: string, i: number) => (
                          <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <I.Check size={16} className="shrink-0 text-primary" />
                            {perk}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
                {!acabou && !fechado && (
                  <ContadorIngresso
                    nome={ticket.name}
                    qtd={cart[ticket.id] || 0}
                    onMenos={() => removeFromCart(ticket.id)}
                    onMais={() => addToCart(ticket.id)}
                    maisDesligado={noLimite(ticket, cart[ticket.id] || 0)}
                  />
                )}
              </div>
            )
          })}
        </section>

        {descricao && (
          <section aria-labelledby="h-sobre" className="border-t border-border px-5 py-6">
            <h2 id="h-sobre" className="mb-2 text-[15px] font-semibold leading-5">Sobre</h2>
            <p id="sobre-txt" className={cn('whitespace-pre-line text-base leading-6', descricaoLonga && !sobreAberto && 'line-clamp-5')}>{descricao}</p>
            {descricaoLonga && (
              <button
                type="button"
                onClick={() => setSobreAberto(!sobreAberto)}
                aria-expanded={sobreAberto}
                aria-controls="sobre-txt"
                className="mt-2 text-sm font-semibold leading-5 text-primary underline underline-offset-4"
              >
                {sobreAberto ? 'Ler menos' : 'Ler mais'}
              </button>
            )}
          </section>
        )}

        {gallery.length > 0 && (
          <section aria-labelledby="h-galeria" className="border-t border-border px-5 py-6">
            <h2 id="h-galeria" className="mb-3 text-[15px] font-semibold leading-5">Galeria</h2>
            <div className="grid grid-cols-2 gap-2">
              {gallery.map((img, i) => (
                <img key={i} src={img} alt={`${event.title} - ${i + 1}`} loading="lazy" decoding="async" className="aspect-[3/4] w-full rounded-ev-xl object-cover" />
              ))}
            </div>
          </section>
        )}

        {/* Aparência (2.8.9): a troca de tema fica no rodapé da página pública; padrão Automático */}
        {!previa && (
        <section className="border-t border-border px-5 pb-6 pt-6">
          <h2 id="h-aparencia" className="mb-2 text-[15px] font-semibold leading-5">Aparência</h2>
          <ThemeToggle />
          <p className="mt-6 text-sm leading-5 text-muted-foreground">
            Dúvidas sobre a compra? <Link to="/contato" className="font-semibold text-primary underline underline-offset-4">Fale com a gente</Link>.
          </p>
        </section>
        )}
      </div>

      {/* Barra de compra fixa em vidro; "Comprar" é sólido. A taxa fica em --vidro-texto-2 (#334155 no claro, #d6dde6 no escuro) */}
      <div
        className={cn(
          previa ? 'sticky bottom-0 z-10' : 'fixed inset-x-0 bottom-[var(--cookie-banner-h,0px)] z-40',
          barraSolida ? 'border-t border-border bg-card text-foreground' : 'vidro rounded-none shadow-[inset_0_1px_0_var(--vidro-borda),0_-0.5px_0_var(--vidro-base)]',
        )}
      >
        <div className="mx-auto flex max-w-xl items-center gap-3 pb-[max(12px,env(safe-area-inset-bottom))] pl-5 pr-4 pt-2.5">
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold leading-5">
              {cartCount > 0 ? (
                <span className="font-display tabular-nums">{cartCount} ingresso{cartCount > 1 ? 's' : ''} · {brl(cartResumo.total)}</span>
              ) : aVenda.length === 0 ? (
                motivoSemVenda ?? 'Ingressos indisponíveis'
              ) : menorTotal === 0 ? (
                'Gratuito'
              ) : (
                <>A partir de <span className="font-display tabular-nums">{brl(menorTotal)}</span></>
              )}
            </div>
            <div className={cn('mt-0.5 text-xs leading-4', barraSolida ? 'text-muted-foreground' : 'text-[color:var(--vidro-texto-2)]')}>
              {cartCount > 0
                ? cartResumo.taxa > 0 ? `${brl(cartResumo.subtotal)} + taxa ${brl(cartResumo.taxa)}` : 'Gratuito'
                : aVenda.length > 0 && menorTotal > 0 ? 'já com a taxa de serviço' : ' '}
            </div>
          </div>
          {cartCount > 0 ? (
            <Button size="lg" className="shrink-0 rounded-full" onClick={() => navigate('/checkout', { state: { eventId: event.id, cart } })}>
              Finalizar <I.ChevronDireita size={16} />
            </Button>
          ) : (
            <Button size="lg" className="shrink-0 rounded-full" disabled={aVenda.length === 0 || !!previa} onClick={() => document.getElementById('ingressos')?.scrollIntoView()}>
              Comprar <I.ChevronDireita size={16} />
            </Button>
          )}
        </div>
      </div>

      {!previa && <Drawer open={taxaAberta} onOpenChange={setTaxaAberta}>
        <DrawerContent className="mx-auto max-w-xl">
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-xl">Taxa de serviço</DrawerTitle>
            <DrawerDescription className="sr-only">Como a taxa de serviço da Evokaa é calculada</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-3 px-4 pb-8 text-[15px] leading-[22px]">
            <p>A taxa de serviço da Evokaa aparece aqui, antes da compra, e não muda no pagamento.</p>
            <p>
              Ela é de {TAXA_PERCENTUAL}% do valor de cada ingresso, com mínimo de {brl(TAXA_MINIMA)} por ingresso. Ingresso gratuito não paga taxa.
            </p>
          </div>
        </DrawerContent>
      </Drawer>}
    </div>
  )
}
