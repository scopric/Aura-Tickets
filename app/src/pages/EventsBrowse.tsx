import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import BotaoSalvar from '../components/BotaoSalvar'
import Chip from '../components/Chip'
import EventoCapa from '../components/EventoCapa'
import EventoLinha, { Preco } from '../components/EventoLinha'
import { useFavoritos } from '../hooks/useFavoritos'
import { getAppMode, siteUrl } from '../lib/appHost'
import Salvos from './app/Salvos'
import { temFoto } from '../lib/corEvento'
import { brl, TAXA_MINIMA, TAXA_PERCENTUAL } from '../lib/taxa'
import { cn } from '../lib/utils'
import {
  agruparPorDia, categoriasDoCatalogo, cidadesDoCatalogo, estilosDoCatalogo, ordenarPorData, passa, quandoDoSlug, QUANDO_SLUG,
  rotuloClassificacao, rotuloDia, type EventoCatalogo, type Filtros,
} from '../lib/explorar'
import { diaBR, horaCurta } from '../lib/visaoEvento'

// Folha de cidade: o Vaul só baixa na primeira vez que a pessoa abre
const FolhaCidade = lazy(() => import('../components/FolhaCidade'))

const QUANDO = { hoje: 'Hoje', amanha: 'Amanhã', fds: 'Fim de semana', mes: 'Este mês' } as const
const QUANDO_FRASE = { hoje: 'hoje', amanha: 'amanhã', fds: 'neste fim de semana', mes: 'neste mês' } as const
const FILTRO_VAZIO: Filtros = { cidade: null, quando: '', categoria: null, estilo: null, gratis: false, busca: '' }

const hojeSP = () => diaBR(Date.now())
const linhaLocal = (e: EventoCatalogo) => [horaCurta(e.time), e.venue_name || e.venue_city || 'Local a definir'].filter(Boolean).join(' · ')

// Uma tela só para /events (visitante) e /app/events (participante), com a aba Salvos (/app/salvos).
// O atalho de data é o endereço: /events/hoje, /events/amanha, /events/fim-de-semana, /events/este-mes.
export default function EventsBrowse({ aba }: { aba?: 'salvos' }) {
  const { pathname, key } = useLocation()
  const noApp = pathname.startsWith('/app')
  const base = noApp ? '/app/events' : '/events'
  const navigate = useNavigate()
  const { userId } = useFavoritos()
  const slugQuando = useParams().quando
  const quando = quandoDoSlug(slugQuando)
  // o círculo de busca da barra inferior do app chega com ?busca=1 (foca o campo); a busca do topo, com ?q=termo
  const [params] = useSearchParams()
  const campoBusca = useRef<HTMLInputElement>(null)
  const [resto, setResto] = useState<Omit<Filtros, 'quando'>>({ ...FILTRO_VAZIO, busca: params.get('q') ?? '' })
  const filtros: Filtros = { ...resto, quando }
  const [decrescente, setDecrescente] = useState(false)
  const [folha, setFolha] = useState(false)
  const [folhaPedida, setFolhaPedida] = useState(false)
  const hoje = hojeSP() // a cada renderização: rótulo, filtro e consulta concordam depois da meia-noite
  const irParaQuando = (q: Filtros['quando']) => navigate(q ? `${base}/${QUANDO_SLUG[q]}` : base, { replace: true })
  const muda = (p: Partial<Filtros>) => {
    const { quando: q, ...outros } = p
    if (q !== undefined) irParaQuando(q)
    if (Object.keys(outros).length) setResto(f => ({ ...f, ...outros }))
  }
  useEffect(() => { const q = params.get('q'); if (q !== null) setResto(f => ({ ...f, busca: q })) }, [params, key])
  useEffect(() => { if (params.has('busca') && !aba) campoBusca.current?.focus() }, [params, key, aba])

  // ponytail: traz todos os publicados de uma vez e filtra no navegador (a folha de cidade e os chips precisam do
  // conjunto inteiro). Passou de ~1000 eventos (limite do PostgREST), paginar ou filtrar no banco.
  const { data: catalogo = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['explorar-eventos', hoje],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*, ticket_types (*)')
        .eq('status', 'published')
        .eq('approval_status', 'approved')
        .gte('date', hoje)
        .order('date', { ascending: true })
      if (error) throw error
      return (data ?? []) as EventoCatalogo[]
    },
    select: ordenarPorData,
    enabled: !aba,
  })

  const cidades = cidadesDoCatalogo(catalogo)
  const categorias = categoriasDoCatalogo(catalogo)
  const estilos = estilosDoCatalogo(catalogo)
  const visiveis = catalogo.filter(e => passa(e, filtros, hoje))
  const grupos = agruparPorDia(decrescente ? [...visiveis].reverse() : visiveis, hoje)
  // Destaque: o marcado (featured_carousel) mais próximo, senão o primeiro; com um só evento, só a lista. Como na prancha,
  // o evento em destaque continua na lista do dia.
  const destaque = visiveis.length > 1 ? (visiveis.find(e => e.featured_carousel) ?? visiveis[0]) : undefined

  const temFiltro = !!(filtros.cidade || filtros.quando || filtros.categoria || filtros.estilo || filtros.gratis || filtros.busca.trim())
  const limpar = () => { setResto(FILTRO_VAZIO); irParaQuando('') }
  const nomeCidade = cidades.find(c => c.chave === filtros.cidade)?.nome
  const nomeCategoria = categorias.find(c => c.chave === filtros.categoria)?.nome
  const nomeEstilo = estilos.find(c => c.chave === filtros.estilo)?.nome

  // Vazio: a frase fala do primeiro filtro (busca, data, categoria, cidade) que, tirado, traz eventos de volta
  function vazio() {
    const ativos = (['busca', 'quando', 'categoria', 'estilo', 'gratis', 'cidade'] as const).filter(k => (k === 'busca' ? filtros.busca.trim() : filtros[k]))
    const culpado = ativos.find(k => catalogo.some(e => passa(e, filtros, hoje, k))) ?? ativos[0]
    const emCidade = nomeCidade ? ` em ${nomeCidade}` : ''
    if (culpado === 'busca') return { frase: `Nada para “${filtros.busca.trim()}”.`, apoio: 'Confira a grafia ou busque pelo local, pela cidade ou pelo tipo de evento.', botao: 'Limpar busca', acao: () => muda({ busca: '' }) }
    if (culpado === 'categoria') return { frase: `Nada de ${nomeCategoria}${filtros.quando ? ' ' + QUANDO_FRASE[filtros.quando] : ''}${emCidade}.`, apoio: '', botao: 'Ver todas as categorias', acao: () => muda({ categoria: null }) }
    if (culpado === 'estilo') return { frase: `Nada de ${nomeEstilo}${filtros.quando ? ' ' + QUANDO_FRASE[filtros.quando] : ''}${emCidade}.`, apoio: '', botao: 'Ver todos os estilos', acao: () => muda({ estilo: null }) }
    if (culpado === 'gratis') return { frase: `Nenhum evento gratuito${filtros.quando ? ' ' + QUANDO_FRASE[filtros.quando] : ''}${emCidade}.`, apoio: '', botao: 'Ver os pagos também', acao: () => muda({ gratis: false }) }
    if (culpado === 'quando') {
      const prox = catalogo.find(e => passa(e, filtros, hoje, 'quando'))
      return {
        frase: `Nada ${nomeCategoria ? `de ${nomeCategoria} ` : ''}${QUANDO_FRASE[filtros.quando as keyof typeof QUANDO_FRASE]}${emCidade}.`,
        apoio: prox?.date ? `O próximo é ${prox.title}, ${rotuloDia(prox.date, hoje).curto}.` : '',
        botao: 'Ver todas as datas',
        acao: () => muda({ quando: '' }),
      }
    }
    if (culpado === 'cidade') return { frase: `Ainda não tem evento publicado em ${nomeCidade}.`, apoio: 'Quando sair o primeiro, ele aparece aqui.', botao: 'Ver todas as cidades', acao: () => muda({ cidade: null }) }
    return { frase: 'Ainda não tem evento publicado.', apoio: 'Quando sair o primeiro, ele aparece aqui. Assine a newsletter para saber quando.', botao: '', acao: () => {} }
  }

  if (slugQuando && !quando) return <Navigate to={base} replace /> // atalho que não existe: volta para o Explorar
  const px = noApp ? '' : 'px-5 lg:px-8'
  const abas = !!userId && noApp // só o participante salva; visitante e equipe não veem a aba

  return (
    <div className={noApp ? 'text-foreground' : 'min-h-screen bg-background pb-24 pt-24 text-foreground'}>
      <div className={cn('mx-auto max-w-6xl', px)}>
        <h1 className="text-2xl font-semibold tracking-[-0.015em]">{aba ? 'Salvos' : 'Explorar'}</h1>

        {abas && (
          <div role="group" aria-label="Explorar" className="mt-3 flex gap-2">
            {([['/app/events', 'Eventos', !aba], ['/app/salvos', 'Salvos', !!aba]] as const).map(([to, nome, atual]) => (
              <Link key={to} to={to} aria-current={atual ? 'page' : undefined} className={cn(
                'grid h-10 place-items-center rounded-ev-pill px-4 text-sm focus-visible:outline-none focus-visible:shadow-ev-foco',
                atual ? 'bg-[var(--ev-brand-soft)] font-semibold text-primary' : 'font-medium shadow-[inset_0_0_0_1px_hsl(var(--input))] hover:bg-[var(--ev-tint-hover)]'
              )}>{nome}</Link>
            ))}
          </div>
        )}

        {!aba && cidades.length > 0 && (
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => { setFolhaPedida(true); setFolha(true) }}
            className="-ml-2 mt-1 flex h-11 items-center gap-1 rounded-ev-lg px-2 text-[15px] font-semibold hover:bg-[var(--ev-tint-hover)] focus-visible:outline-none focus-visible:shadow-ev-foco"
          >
            <span className="sr-only">Cidade: </span>
            {nomeCidade ?? 'Todas as cidades'}
            <I.ChevronBaixo size={16} className="text-muted-foreground" />
          </button>
        )}

        {!aba && (
          <form role="search" onSubmit={e => e.preventDefault()} className="relative mt-2 max-w-xl">
            <label className="relative block">
              <span className="sr-only">Buscar evento, local ou cidade</span>
              <I.Buscar size={16} className="pointer-events-none absolute left-3.5 top-3.5 text-muted-foreground" />
              <Input
                ref={campoBusca}
                type="search"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                placeholder="Evento, local ou cidade"
                value={filtros.busca}
                onChange={e => muda({ busca: e.target.value })}
                className="h-11 rounded-ev-lg bg-card pl-10 pr-11 text-base [&::-webkit-search-cancel-button]:hidden"
              />
            </label>
            {filtros.busca && (
              <button
                type="button"
                aria-label="Limpar busca"
                onClick={() => { muda({ busca: '' }); campoBusca.current?.focus() }}
                className="absolute right-0 top-0 grid h-11 w-11 place-items-center rounded-ev-lg text-muted-foreground focus-visible:outline-none focus-visible:shadow-ev-foco"
              >
                <I.Fechar size={16} />
              </button>
            )}
          </form>
        )}
      </div>

      {!aba && (
        <div role="group" aria-label="Filtros" className={cn('mx-auto mt-3 flex max-w-6xl items-center gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', px)}>
          {(Object.keys(QUANDO) as (keyof typeof QUANDO)[]).map(k => (
            <Chip key={k} marcado={filtros.quando === k} onClick={() => muda({ quando: filtros.quando === k ? '' : k })}>{QUANDO[k]}</Chip>
          ))}
          <Chip marcado={filtros.gratis} onClick={() => muda({ gratis: !filtros.gratis })}>Grátis</Chip>
          {categorias.length > 0 && <span aria-hidden="true" className="mx-1 h-6 w-px flex-none bg-border" />}
          {categorias.map(c => (
            <Chip key={c.chave} marcado={filtros.categoria === c.chave} onClick={() => muda({ categoria: filtros.categoria === c.chave ? null : c.chave })}>{c.nome}</Chip>
          ))}
          {estilos.length > 0 && <span aria-hidden="true" className="mx-1 h-6 w-px flex-none bg-border" />}
          {estilos.map(c => (
            <Chip key={c.chave} marcado={filtros.estilo === c.chave} onClick={() => muda({ estilo: filtros.estilo === c.chave ? null : c.chave })}>{c.nome}</Chip>
          ))}
        </div>
      )}

      <div className={cn('mx-auto max-w-6xl', px)}>
        {aba ? <Salvos /> : isLoading ? (
          <div aria-busy="true" className="mt-4 lg:grid lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-10 motion-reduce:[&_[data-slot=skeleton]]:animate-none">
            <div>
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="mt-3 aspect-[4/5] w-full max-w-[360px] rounded-ev-xl" />
              <Skeleton className="mt-3.5 h-[22px] w-44" />
              <Skeleton className="mt-2 h-3.5 w-60" />
            </div>
            <div>
              {[1, 2, 3].map(k => (
                <div key={k} className="mt-6 flex gap-3">
                  <Skeleton className="h-14 w-12 flex-none rounded-ev-lg" />
                  <Skeleton className="h-[120px] w-24 flex-none rounded-ev-md" />
                  <div className="flex-1 pt-1">
                    <Skeleton className="h-4 w-[90%]" />
                    <Skeleton className="mt-1.5 h-4 w-[60%]" />
                    <Skeleton className="mt-3.5 h-3 w-[75%]" />
                  </div>
                </div>
              ))}
            </div>
            <span className="sr-only" role="status">Carregando eventos</span>
          </div>
        ) : isError ? (
          <div role="alert" className="mt-10 flex max-w-sm flex-col items-start gap-3">
            <p className="text-lg font-semibold">Não deu para carregar os eventos.</p>
            <p className="text-[15px] text-muted-foreground">Confira a conexão e tente de novo.</p>
            <Button variant="outline" size="lg" onClick={() => refetch()}>Tentar de novo</Button>
          </div>
        ) : visiveis.length === 0 ? (
          (() => {
            const v = vazio()
            return (
              <div role="status" className="mx-auto mt-10 flex max-w-sm flex-col items-center px-4 text-center">
                <img src="/evo/evo-corpo-celular.webp" alt="" width={76} height={132} className="h-[132px] w-auto" />
                <p className="mt-4 text-pretty text-lg font-semibold leading-6">{v.frase}</p>
                {v.apoio && <p className="mt-1.5 text-pretty text-[15px] leading-[22px] text-muted-foreground">{v.apoio}</p>}
                {v.botao && <Button variant="outline" size="lg" className="mt-5" onClick={v.acao}>{v.botao}</Button>}
                {/* catálogo vazio: a newsletter fica no rodapé do site (no app não há rodapé: abre o do site) */}
                {!v.botao && <Button asChild variant="outline" size="lg" className="mt-5"><a href={getAppMode() === 'app' ? siteUrl('/events#newsletter') : '#newsletter'}>Assinar a newsletter</a></Button>}
              </div>
            )
          })()
        ) : (
          <div className={cn('lg:mt-2', destaque && 'lg:grid lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-10')}>
            {destaque && (
              <section aria-labelledby="t-destaque" className="relative mt-4 max-w-[360px] lg:sticky lg:top-24">
                <h2 id="t-destaque" className="mb-3 text-[15px] font-semibold">Em destaque</h2>
                <Link
                  to={`/event/${destaque.slug || destaque.id}`}
                  className="block max-w-[360px] rounded-ev-xl focus-visible:outline-none focus-visible:shadow-ev-foco"
                >
                  <span className="relative block">
                    <EventoCapa evento={destaque} tamanho="cartao" />
                    {(temFoto(destaque.cover_image) || temFoto(destaque.image_url)) && (
                      <span aria-hidden="true" className="wide absolute left-3 top-3 rounded-ev-sm bg-[#0b0d12] px-2 py-1 font-display text-[13px] font-extrabold uppercase leading-4 tracking-[0.02em] text-[#fff]">
                        {rotuloDia(destaque.date!, hoje).curto}
                      </span>
                    )}
                  </span>
                  <span className="wide mt-3 block font-display text-2xl font-extrabold leading-7 tracking-[-0.015em]">{destaque.title}</span>
                  <span className="mt-1 block pr-11 text-[13px] leading-[18px] text-muted-foreground">
                    {rotuloDia(destaque.date!, hoje).curto} · {linhaLocal(destaque)}
                    {rotuloClassificacao(destaque.classificacao) && <> · <span className="sr-only">Classificação </span>{rotuloClassificacao(destaque.classificacao)}</>}
                  </span>
                  <span className="mt-1 block pr-11 text-[13px] leading-[18px]"><Preco evento={destaque} /></span>
                </Link>
                <BotaoSalvar eventId={destaque.id} className="absolute bottom-0 right-0 size-11 text-muted-foreground" />
              </section>
            )}

            <section aria-labelledby="t-lista" className="min-w-0">
              <div className="mt-7 flex items-baseline justify-between lg:mt-4">
                <h2 id="t-lista" aria-live="polite" className="text-[15px] font-semibold">
                  {visiveis.length === 1 ? '1 evento' : `${visiveis.length} eventos`}
                </h2>
                <div className="-mr-2 flex items-baseline gap-1">
                  {visiveis.length > 1 && (
                    <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setDecrescente(d => !d)}>
                      {decrescente ? 'Mais distantes primeiro' : 'Mais próximos primeiro'}
                    </Button>
                  )}
                  {temFiltro && <Button variant="ghost" size="sm" className="text-primary" onClick={limpar}>Limpar filtros</Button>}
                </div>
              </div>

              {grupos.map(g => (
                <div key={g.data}>
                  {g.novoMes && (
                    <h3 className="-mb-2 mt-7 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground after:h-px after:flex-1 after:bg-border after:content-['']">
                      {g.rotulo.mesNome}
                    </h3>
                  )}
                  <section aria-labelledby={`dia-${g.data}`} className="mt-6 flex gap-3">
                    <div
                      aria-hidden="true"
                      className={cn(
                        'sticky top-24 flex h-14 w-12 flex-none flex-col items-center justify-center gap-px self-start rounded-ev-lg',
                        g.rotulo.hoje ? 'bg-[var(--ev-warm)] text-[#0b0d12]' : 'bg-secondary'
                      )}
                    >
                      <span className={cn('text-[10px] font-semibold uppercase leading-[14px] tracking-[0.04em]', g.rotulo.hoje ? 'text-[#0b0d12]' : 'text-muted-foreground')}>{g.rotulo.sem}</span>
                      <span className="font-display text-[22px] font-semibold leading-6 tracking-[-0.01em] tabular-nums">{g.rotulo.dia}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 id={`dia-${g.data}`} className="sr-only">{g.rotulo.cabecalho}</h4>
                      <ul className="divide-y divide-border sm:grid sm:grid-cols-2 sm:gap-3 sm:divide-y-0">
                        {g.eventos.map(e => (
                          <EventoLinha
                            key={e.id}
                            evento={e}
                            to={`/event/${e.slug || e.id}`}
                            linha={linhaLocal(e)}
                            preco={<Preco evento={e} />}
                            className="sm:rounded-ev-xl sm:border sm:border-border sm:p-3 sm:first:p-3 sm:last:p-3"
                            salvavel
                          />
                        ))}
                      </ul>
                    </div>
                  </section>
                </div>
              ))}

              <p className="mt-6 text-xs leading-4 text-muted-foreground">
                Preços já com a taxa de serviço ({TAXA_PERCENTUAL}%, mínimo de {brl(TAXA_MINIMA)} por ingresso). A página do evento mostra o valor do ingresso e a taxa separados.
              </p>
            </section>
          </div>
        )}
      </div>

      {folhaPedida && (
        <Suspense fallback={null}>
          <FolhaCidade
            aberta={folha}
            onAbrir={setFolha}
            cidades={cidades}
            total={catalogo.length}
            atual={filtros.cidade}
            onEscolher={chave => { muda({ cidade: chave }); setFolha(false) }}
          />
        </Suspense>
      )}
    </div>
  )
}
