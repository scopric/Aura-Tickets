import { useState, useMemo, useEffect, useRef } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import Chip from '../../components/Chip'
import EventoCapa from '../../components/EventoCapa'
import EventoLinha from '../../components/EventoLinha'
import { usePublicEvents } from '../../hooks/useEvents'
import { temFoto } from '../../lib/corEvento'
import { rotuloDia } from '../../lib/explorar'
import { calcularTaxa, brl } from '../../lib/taxa'
import { rotuloFormato } from '../../lib/tipoEvento'
import { diaBR } from '../../lib/visaoEvento'

const hojeSP = () => diaBR(Date.now())

const categories = [
  'Todos',
  'Música',
  'Negócios',
  'Networking',
  'Arte',
  'Esporte',
  'Gastronomia',
  'Tecnologia',
]

function formatEventDate(dateStr: string | null, timeStr: string | null) {
  if (!dateStr) return 'Data a definir'
  const d = new Date(dateStr + 'T00:00:00')
  const formatted = d.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return timeStr ? `${formatted} às ${timeStr}` : formatted
}

function getMinPrice(ticketTypes?: { price: number | string }[] | null) {
  if (!ticketTypes || ticketTypes.length === 0) return null
  const prices = ticketTypes.map((t) => Number(t.price) || 0).filter((p) => p > 0)
  if (prices.length === 0) return 'Gratuito'
  const { preco, taxa, total } = calcularTaxa(Math.min(...prices))
  return `${brl(total)} (${brl(preco)} + taxa ${brl(taxa)})`
}

// "a partir de R$ 55,00 (R$ 50,00 + taxa R$ 5,00)": o preço sempre com a taxa ao lado; sem ingresso cadastrado, nada
const precoDe = (ticketTypes?: { price: number | string }[] | null) => {
  const p = getMinPrice(ticketTypes)
  return p === null ? null : p === 'Gratuito' ? p : `a partir de ${p}`
}

export default function AppEvents() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('Todos')
  const { data: events = [], isLoading } = usePublicEvents()
  // o círculo de busca da barra inferior chega com ?busca=1: foca o campo. Espera a lista carregar (o campo só existe
  // depois) e refoca a cada toque (location.key muda mesmo com a tela já aberta)
  const [params] = useSearchParams()
  const { key } = useLocation()
  const campoBusca = useRef<HTMLInputElement>(null)
  useEffect(() => { if (params.has('busca') && !isLoading) campoBusca.current?.focus() }, [params, key, isLoading])

  const filtered = useMemo(() => {
    return events.filter((e) => {
      const matchesSearch =
        !search ||
        e.title.toLowerCase().includes(search.toLowerCase()) ||
        (e.venue_city || '').toLowerCase().includes(search.toLowerCase()) ||
        rotuloFormato(e.category).toLowerCase().includes(search.toLowerCase())
      const matchesCategory =
        activeCategory === 'Todos' || e.category === activeCategory
      return matchesSearch && matchesCategory
    })
  }, [events, search, activeCategory])

  const featured = filtered[0]
  const rest = filtered.slice(1)
  const semEventos = events.length === 0
  const filtrando = !!search || activeCategory !== 'Todos'
  const hoje = hojeSP() // a cada renderização: o rótulo "Hoje" confere depois da meia-noite

  if (isLoading) {
    return (
      <div className="py-32 text-center text-foreground">
        <Spinner className="mx-auto size-6" />
        <p className="mt-4 text-base text-muted-foreground">Carregando eventos...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 text-foreground">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.015em]">Descubra Eventos</h1>
          <p className="mt-1 text-[15px] text-muted-foreground">
            Encontre os melhores eventos perto de você
          </p>
        </div>
        <form role="search" onSubmit={e => e.preventDefault()} className="relative w-full lg:w-96">
          <label className="relative block">
            <span className="sr-only">Buscar eventos</span>
            <I.Buscar size={16} className="pointer-events-none absolute left-3.5 top-3.5 text-muted-foreground" />
            <Input
              ref={campoBusca}
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, cidade ou categoria..."
              className="h-11 rounded-ev-lg bg-card pl-10 pr-11 text-base [&::-webkit-search-cancel-button]:hidden"
            />
          </label>
          {search && (
            <button
              type="button"
              aria-label="Limpar busca"
              onClick={() => { setSearch(''); campoBusca.current?.focus() }}
              className="absolute right-0 top-0 grid h-11 w-11 place-items-center rounded-ev-lg text-muted-foreground focus-visible:outline-none focus-visible:shadow-ev-foco"
            >
              <I.Fechar size={16} />
            </button>
          )}
        </form>
      </div>

      {/* Category Filters */}
      <div role="group" aria-label="Filtros" className="-mt-2 flex items-center gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {categories.map((cat) => (
          <Chip key={cat} marcado={activeCategory === cat} onClick={() => setActiveCategory(cat)}>{cat}</Chip>
        ))}
      </div>

      {/* Featured Event: o destaque do Explorar (capa 4:5, selo da data sobre a foto, nome abaixo); no computador, ao lado da lista */}
      {rest.length === 0 && !featured ? (
        <div role="status" className="mx-auto flex max-w-sm flex-col items-center px-4 py-12 text-center">
          <img src="/evo/evo-corpo-celular.webp" alt="" width={76} height={132} className="h-[132px] w-auto" />
          <h2 className="mt-4 text-lg font-semibold leading-6">{semEventos ? 'Ainda não há eventos publicados' : 'Nenhum evento encontrado'}</h2>
          <p className="mt-1.5 text-[15px] leading-[22px] text-muted-foreground">
            {semEventos ? 'Quando sair o primeiro, ele aparece aqui.' : 'Tente ajustar os filtros ou a busca para encontrar o que procura.'}
          </p>
          {semEventos && (
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Button asChild variant="outline"><Link to="/app/salvos">Ver salvos</Link></Button>
              <Button asChild variant="outline"><Link to="/app/hub">Ir para o Início</Link></Button>
            </div>
          )}
        </div>
      ) : (
        <div className={featured ? 'lg:grid lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-10' : undefined}>
          {featured && (
            <section aria-labelledby="t-destaque" className="lg:sticky lg:top-24">
              <h2 id="t-destaque" className="mb-3 text-[15px] font-semibold">Em destaque</h2>
              <Link
                to={`/event/${featured.slug || featured.id}`}
                className="block max-w-[360px] rounded-ev-xl focus-visible:outline-none focus-visible:shadow-ev-foco"
              >
                <span className="relative block">
                  <EventoCapa evento={featured} tamanho="cartao" />
                  {/* selo sobre a foto: placa preta com texto branco nos dois temas (text-[#fff]: o .light .text-white do index.css escureceria o texto) */}
                  {(temFoto(featured.cover_image) || temFoto(featured.image_url)) && featured.date && (
                    <span aria-hidden="true" className="wide absolute left-3 top-3 rounded-ev-sm bg-[#0b0d12] px-2 py-1 font-display text-[13px] font-extrabold uppercase leading-4 tracking-[0.02em] text-[#fff]">
                      {rotuloDia(featured.date, hoje).curto}
                    </span>
                  )}
                </span>
                <span className="wide mt-3 block font-display text-2xl font-extrabold leading-7 tracking-[-0.015em]">{featured.title}</span>
                <span className="mt-1 block text-[13px] leading-[18px] text-muted-foreground">
                  {formatEventDate(featured.date, featured.time)} · {featured.venue_city || featured.venue_name || 'Local a definir'}
                </span>
                {precoDe(featured.ticket_types) && <span className="mt-1 block text-[13px] leading-[18px]">{precoDe(featured.ticket_types)}</span>}
              </Link>
            </section>
          )}

          <section aria-labelledby="t-lista" className="min-w-0">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 id="t-lista" className="text-[15px] font-semibold">
                {rest.length > 0 ? 'Próximos eventos' : 'Eventos'}
              </h2>
              <span className="text-[13px] text-muted-foreground">
                {filtered.length} evento{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>

            <ul className="divide-y divide-border sm:grid sm:grid-cols-2 sm:gap-3 sm:divide-y-0">
              {rest.map((event) => (
                <EventoLinha
                  key={event.id}
                  evento={event}
                  to={`/event/${event.slug || event.id}`}
                  linha={`${formatEventDate(event.date, event.time)} · ${event.venue_city || event.venue_name || 'Local a definir'}`}
                  preco={precoDe(event.ticket_types)}
                  className="sm:rounded-ev-xl sm:border sm:border-border sm:p-3 sm:first:p-3 sm:last:p-3"
                />
              ))}
            </ul>
          </section>
        </div>
      )}

      {/* Bottom CTA: limpar filtros só faz sentido com filtro ativo */}
      {filtrando && <div className="flex flex-col items-start justify-between gap-4 border-t border-border pt-6 md:flex-row md:items-center">
        <div>
          <h2 className="text-lg font-semibold leading-6">Não encontrou o que procura?</h2>
          <p className="mt-1 text-[15px] text-muted-foreground">
            Explore todos os eventos disponíveis na plataforma Evokaa.
          </p>
        </div>
        <Button
          variant="outline"
          size="lg"
          onClick={() => {
            setSearch('')
            setActiveCategory('Todos')
          }}
        >
          Ver todos os eventos
        </Button>
      </div>}
    </div>
  )
}
