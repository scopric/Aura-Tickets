import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { cn } from '@/lib/utils'
import AviseMe from './AviseMe'
import BlocoOrganizador from './BlocoOrganizador'
import BotaoSalvar from './BotaoSalvar'
import CollectiveTableCard from './CollectiveTableCard'
import ContadorIngresso from './ContadorIngresso'
import EventoCapa from './EventoCapa'
import { CapaInclinada, TotalAnimado, podeMover } from './EventoVitrine'
import ThemeToggle from './ThemeToggle'
import { JanelaSuporte } from './SupportChatWidget'
import { useAuthStore } from '../stores/authStore'
import { publicoDoPapel } from '../hooks/useConversas'
import { ASSUNTO_DENUNCIA } from '../lib/ingresso'
import type { DbEvent } from '../hooks/useEvents'
import { useOrganizadorDoEvento } from '../hooks/useOrganizadorDoEvento'
import { corSorteada, ehHex, temFoto, varsDoEvento } from '../lib/corEvento'
import { calcularTaxa, resumoCarrinho, brl, TAXA_PERCENTUAL, TAXA_MINIMA } from '../lib/taxa'

import { esgotado, lotacao, noLimite, tetoPorPedido } from '../lib/lotacao'
import { CLASSIFICACOES, ESTILOS, TEMAS } from '../lib/tipoEvento'
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

// Linha fina da vitrine (computador e celular): rótulo pequeno em maiúsculas + valor, fio de 1px entre linhas
function LinhaFina({ rotulo, titulo, sub, href, aria }: { rotulo: string; titulo: string; sub?: string; href?: string; aria?: string }) {
  const corpo = (
    <>
      <span className="text-[11px] font-semibold uppercase leading-6 tracking-[0.08em] text-muted-foreground">{rotulo}</span>
      <span className="min-w-0">
        <span className="block break-words text-base leading-6">{titulo}</span>
        {sub && <span className="block break-words text-[13px] leading-5 text-muted-foreground">{sub}</span>}
      </span>
      {href && <I.AbrirExterno size={16} className="mt-1 shrink-0 text-muted-foreground" />}
    </>
  )
  const classe = cn('grid min-h-14 grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-x-4 border-t border-border px-5 py-3 first:border-t-0', href && 'grid-cols-[6.5rem_minmax(0,1fr)_auto]')
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={aria} className={cn(classe, 'transition-colors duration-rapido hover:bg-[var(--ev-tint-hover)] focus-visible:outline-none focus-visible:shadow-ev-foco motion-reduce:transition-none')}>{corpo}</a>
  ) : (
    <div className={classe}>{corpo}</div>
  )
}

// O corpo da página pública do evento. Com `previa` (painel do produtor, PR3d-1) vira só o miolo: sem cabeçalho, sem
// "Aparência", sem listener de rolagem, barra de compra sticky e "Comprar" desligado. 'moldura' = vidro; 'folha' = sólida.
export default function EventoConteudo({ evento: event, previa }: { evento: DbEvent; previa?: 'moldura' | 'folha' }) {
  const papel = useAuthStore(s => s.user?.role)
  const [denunciando, setDenunciando] = useState(false) // janela do chat no assunto "Denunciar evento" (a página do evento não tem o Evo)
  const navigate = useNavigate()
  const { data: organizador } = useOrganizadorDoEvento(event.id)
  const location = useLocation()
  const heroRef = useRef<HTMLDivElement>(null)
  const raiz = useRef<HTMLDivElement>(null)
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

  // Entrada ao rolar: o CSS só esconde (data-evv) quando há IntersectionObserver e movimento permitido
  useEffect(() => {
    const el = raiz.current
    if (previa || !el || !podeMover() || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((itens) => itens.forEach((i) => {
      if (i.isIntersecting) { (i.target as HTMLElement).dataset.vista = ''; io.unobserve(i.target) }
    }), { threshold: 0.1 })
    el.querySelectorAll('[data-entra]').forEach((n) => io.observe(n))
    el.dataset.evv = ''
    return () => { io.disconnect(); delete el.dataset.evv }
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
    try {
      if (navigator.share && event) {
        await navigator.share({
          title: event.title,
          text: event.subtitle || event.description || '',
          url: window.location.href,
        })
      } else {
        await navigator.clipboard.writeText(window.location.href)
        toast.success('Link copiado para a área de transferência!')
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return // a pessoa fechou a janela de compartilhar
      toast.error('Não foi possível copiar o link. Copie o endereço na barra do navegador.')
    }
  }

  // key 'default' = a página foi a primeira da sessão no app (veio de outro site ou link direto): voltar sairia do app
  const voltar = () => (location.key !== 'default' ? navigate(-1) : navigate('/events'))

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
  const semana = dataEvento ? maiuscula(dataEvento.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')) : ''
  const mesCurto = dataEvento ? dataEvento.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') : ''
  // Chips do hero: estilos, temas e tags do evento (só se houver), sem repetir
  const chips = [...new Map([
    ...(event.estilos ?? []).map((v) => ESTILOS.find((x) => x.valor === v)?.rotulo),
    ...(event.temas ?? []).map((v) => TEMAS.find((x) => x.valor === v)?.rotulo),
    ...(event.tags ?? []),
  ].filter((c): c is string => !!c?.trim()).map((c) => [c.toLowerCase(), c] as const)).values()].slice(0, 6)
  const fotoFundo = [event.cover_image, event.image_url].find(temFoto)
  const local = event.venue_name || event.location || 'Local a definir'
  const endereco = [event.venue_address, [event.venue_city, event.venue_state].filter(Boolean).join(', ')].filter(Boolean).join(' · ')
  const mapaUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([event.venue_name, event.venue_address, event.venue_city].filter(Boolean).join(', ') || local)}`
  const classificacaoTexto = event.classificacao ? `Classificação: ${CLASSIFICACOES.find((c) => c.valor === event.classificacao)?.rotulo ?? event.classificacao}` : event.category === 'esporte' ? 'Evento esportivo: sem classificação indicativa' : 'Classificação não informada pelo produtor'
  // subtítulo igual ao local não repete
  const subtituloUtil = event.subtitle?.trim() && event.subtitle.trim().toLowerCase() !== local.trim().toLowerCase() ? event.subtitle : null
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
  // Compra em destaque: botão invertido (contraste máximo) com relevo de tecla; só "Comprar" e "Finalizar"
  const cta = 'shrink-0 rounded-full bg-foreground text-background shadow-[inset_0_-2px_0_hsl(var(--background)/0.28)] hover:bg-foreground/90 active:translate-y-px motion-reduce:active:translate-y-0'
  // Título de seção: no computador e no celular da vitrine, rótulo pequeno em maiúsculas com fio que se estende
  const titulo = previa ? 'text-[15px] font-semibold leading-5' : 'flex items-center gap-4 text-[11px] font-semibold uppercase leading-5 tracking-[0.08em] text-muted-foreground after:h-px after:flex-1 after:bg-border'
  const irIngressos = () => {
    const el = document.getElementById('ingressos')
    el?.scrollIntoView({ behavior: podeMover() ? 'smooth' : 'auto' })
    el?.focus({ preventScroll: true })
  }
  const textoHero = aVenda.length === 0 ? motivoSemVenda ?? 'Ingressos indisponíveis' : menorTotal === 0 ? 'Entrada gratuita' : `Ingressos desde ${brl(menorTotal)}, já com a taxa`
  const circuloFundo = rolou ? '' : solido ? 'bg-card text-foreground shadow-ev-2' : 'vidro'

  return (
    <div ref={raiz} className={cn('evento-cor bg-background text-foreground', !previa && 'relative isolate min-h-screen overflow-x-clip')} style={varsDoEvento(corEv, false, event.accent_intensity ?? 100)}>
      {/* Barra de topo: círculos de vidro sobre a capa; depois de rolar, a barra inteira ganha vidro */}
      {!previa && <header
        className={cn(
          'fixed inset-x-0 top-0 z-40 h-16',
          rolou && (solido
            ? 'bg-card text-foreground shadow-[inset_0_-1px_0_hsl(var(--border))]'
            : 'vidro rounded-none shadow-[inset_0_-1px_0_var(--vidro-base)]'),
        )}
      >
        <div className={cn('mx-auto flex h-full max-w-xl items-center gap-2 px-3', !previa && 'lg:max-w-6xl lg:px-8')}>
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

      {!previa && (
        <section ref={heroRef} className="evv-hero">
          <div aria-hidden="true" className="evv-hero-fundo">
            <div className="evv-lav" />
            {fotoFundo && <img className="evv-fundo-img" src={fotoFundo} alt="" loading="lazy" decoding="async" />}
            <div className="evv-gr" />
            <div className="evv-esc" />
          </div>
          <div className="mx-auto grid max-w-6xl gap-8 px-5 pb-12 pt-20 lg:min-h-[max(560px,80vh)] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-center lg:gap-12 lg:px-8 lg:pb-16 lg:pt-28">
            <div className="relative mx-auto aspect-[4/5] w-[78%] max-w-[420px] lg:order-last lg:mx-0 lg:w-full lg:max-w-[440px] lg:justify-self-end">
              <CapaInclinada><EventoCapa evento={event} tamanho="faixa" prioridade /></CapaInclinada>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-4">
                {dataEvento && (
                  <>
                    <span className="evv-data" aria-hidden="true"><b>{dataEvento.getDate()}</b><span>{mesCurto}</span></span>
                    <span className="sr-only">{dataEvento.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}</span>
                  </>
                )}
                <p className="text-[15px] font-semibold leading-5">{dataEvento ? `${semana}${hora ? ` · ${hora}` : ''}` : 'Data a definir'}</p>
              </div>
              <h1 className="font-display wide mt-6 break-words text-[clamp(2.25rem,9vw,3.5rem)] font-extrabold leading-[0.98] tracking-[-0.04em] [text-wrap:balance] lg:text-[clamp(3rem,6.2vw,6rem)]">{event.title}</h1>
              {subtituloUtil && <p className="mt-3 max-w-xl text-base leading-6 text-[color:var(--h-fg2)]">{event.subtitle}</p>}
              <p className="mt-4 flex items-center gap-2 text-[15px] leading-5 text-[color:var(--h-fg2)]">
                <I.Local size={16} className="shrink-0" />
                <span className="min-w-0 break-words">{local}</span>
              </p>
              {chips.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-2" aria-label="Estilos e temas">
                  {chips.map((c) => <li key={c} className="evv-chip">{c}</li>)}
                </ul>
              )}
              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
                <Button size="lg" className={cta} onClick={irIngressos}>Ver ingressos <I.ChevronDireita size={16} /></Button>
                <p className="text-sm leading-5 text-[color:var(--h-fg2)]">{textoHero}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className={cn('mx-auto max-w-xl', !previa && 'lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_400px] lg:grid-rows-[repeat(7,auto)_1fr] lg:gap-x-10 lg:px-8 lg:pt-10 lg:[&>*:not(#ingressos)]:col-start-1')}>
        {previa ? (
          <>
            <div className="relative aspect-[390/460] w-full overflow-hidden">
              <EventoCapa evento={event} tamanho="faixa" prioridade />
            </div>
            {/* Bloco de título na cor do evento: o nome aparece uma vez só */}
            <section className="bg-[var(--evento-fundo)] px-5 pb-5 pt-[22px]">
              <p className="text-[15px] font-semibold leading-5 text-[var(--evento-texto)]">{dataLonga}{hora && ` · ${hora}`}</p>
              <h1 className="font-display wide mt-1.5 break-words text-[34px] font-extrabold leading-9 tracking-[-0.02em]">{event.title}</h1>
              {subtituloUtil && <p className="mt-2 text-base leading-6">{event.subtitle}</p>}
              <p className="mt-2 text-sm leading-5">{local}</p>
            </section>
            <div className="py-2">
              <Linha
                icone={<I.Horario size={20} />}
                titulo={dataEvento ? dataEvento.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Data a definir'}
                sub={hora || undefined}
              />
              <Linha icone={<I.Local size={20} />} titulo={local} sub={endereco || undefined} href={mapaUrl} rotulo={`Como chegar: ${local} (abre o mapa)`} />
              <Linha icone={<I.Info size={20} />} titulo={classificacaoTexto} />
            </div>
          </>
        ) : (
          <div data-entra="" className="py-2 lg:pb-6 lg:pt-0">
            <LinhaFina rotulo="Data" titulo={dataEvento ? dataEvento.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Data a definir'} />
            {hora && <LinhaFina rotulo="Horário" titulo={hora} />}
            <LinhaFina rotulo="Local" titulo={local} sub={endereco || undefined} href={mapaUrl} aria={`Como chegar: ${local} (abre o mapa)`} />
            <LinhaFina rotulo="Faixa etária" titulo={classificacaoTexto} />
          </div>
        )}

        <BlocoOrganizador organizador={organizador} titulo={event.title} />

        {/* Ingressos: lista, com a taxa ao lado do preço (Decreto 13.108, art. 7º) */}
        <section id="ingressos" tabIndex={-1} aria-labelledby="h-ingressos" className={cn('focus:outline-none focus-visible:shadow-ev-foco ','scroll-mt-20 border-t border-border px-5 pb-2 pt-6', !previa && 'lg:col-start-2 lg:row-span-8 lg:row-start-1 lg:max-h-[calc(100dvh-11rem)] lg:self-start lg:overflow-y-auto lg:rounded-ev-xl lg:border lg:bg-card lg:sticky lg:top-20')}>
          <h2 id="h-ingressos" className={titulo}>Ingressos</h2>
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
              <div key={ticket.id} className={cn('flex items-center gap-3 border-t border-border py-3 first-of-type:border-t-0', !previa && 'transition-[background-color,box-shadow] duration-200 motion-reduce:transition-none', !previa && (cart[ticket.id] || 0) > 0 && '-mx-2 rounded-ev-md bg-[color-mix(in_srgb,var(--evento)_9%,transparent)] px-2 shadow-[inset_2px_0_0_var(--evento)]')}>
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
                  {!acabou && !fechado && (
                    <div className="text-[13px] leading-5 text-muted-foreground">máx. {tetoPorPedido(ticket)} por pedido</div>
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
          <section aria-labelledby="h-sobre" data-entra={previa ? undefined : ''} className="border-t border-border px-5 py-6">
            <h2 id="h-sobre" className={cn(titulo, 'mb-2')}>Sobre</h2>
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
          <section aria-labelledby="h-galeria" data-entra={previa ? undefined : ''} className="border-t border-border px-5 py-6">
            <h2 id="h-galeria" className={cn(titulo, 'mb-3')}>Galeria</h2>
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
          <h2 id="h-aparencia" className={cn(titulo, 'mb-2')}>Aparência</h2>
          <ThemeToggle />
          <p className="mt-6 text-sm leading-5 text-muted-foreground">
            Dúvidas sobre a compra? <Link to="/contato" className="font-semibold text-primary underline underline-offset-4">Fale com a gente</Link>.
          </p>
          <p className="mt-3 text-sm leading-5 text-muted-foreground">
            Algo errado neste evento?{' '}
            <button type="button" onClick={() => setDenunciando(true)} className="font-semibold text-primary underline underline-offset-4">Denunciar evento</button>
            {' '}ou escreva para <a href="mailto:contato@evokaa.com.br" className="font-semibold text-primary underline underline-offset-4">contato@evokaa.com.br</a>.
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
        <div className={cn('mx-auto flex max-w-xl items-center gap-3 pb-[max(12px,env(safe-area-inset-bottom))] pl-5 pr-4 pt-2.5', !previa && 'lg:max-w-6xl lg:px-8')}>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold leading-5">
              {cartCount > 0 ? (
                <span className="font-display tabular-nums">{cartCount} ingresso{cartCount > 1 ? 's' : ''} · <TotalAnimado valor={cartResumo.total} /></span>
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
            <Button size="lg" className={cta} onClick={() => navigate('/checkout', { state: { eventId: event.id, cart } })}>
              Finalizar <I.ChevronDireita size={16} />
            </Button>
          ) : (
            <Button size="lg" className={cta} disabled={aVenda.length === 0 || !!previa} onClick={() => document.getElementById('ingressos')?.scrollIntoView()}>
              Comprar <I.ChevronDireita size={16} />
            </Button>
          )}
        </div>
      </div>

      {!previa && denunciando && (
        <JanelaSuporte
          publico={publicoDoPapel(papel)}
          assuntoInicial={ASSUNTO_DENUNCIA}
          textoInicial={`Denúncia do evento "${event.title}" (${window.location.href}): `}
          aoFechar={() => setDenunciando(false)}
          posicao="bottom-28 max-sm:bottom-24 h-[min(620px,calc(100dvh-9rem))]"
        />
      )}

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
