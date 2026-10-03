import { useLayoutEffect, useState, type ComponentType } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { cn } from '@/lib/utils'
import { useAoVivo } from '../../hooks/useAoVivo'
import { useProducerEvents } from '../../hooks/useEvents'
import { INICIO, NAV, eventoDaUrl, hrefDaTela, rotaAtiva } from '../../lib/navegacaoProdutor'

// Barra inferior do celular (V4b; estudos/navegacao.md §5.5, prancha Navegação 6.6): 4 abas + círculo de busca, em vidro,
// e a faixa "ao vivo" acima. Só abaixo de 768 px (ProducerLayout decide); de 768 a 1023 px fica a gaveta da V4a.
// Vidro: barra + círculo + faixa = 3 superfícies (o máximo por tela). A pílula da aba atual é a regra da V1 em
// `.vidro [aria-current="page"]` (opaca, contraste sem depender do que passa atrás).
// ponytail: a pílula não desliza entre abas e a barra não encolhe ao rolar (movimentos M2 e M3 da prancha).

// Folha Menu e vaul ficam fora da entrada: baixados no 1º toque, como as páginas lazy (o Vite recarrega a página se o
// pedaço sumiu depois de um deploy; sem rede, main.tsx não recarrega e o toque mostra o aviso, e um novo toque tenta de novo).
// Já baixada, a folha abre dentro do gesto do toque (o teclado do iPhone só abre assim).
const carregarFolha = () => import('./FolhaMenu')
type Folha = { modo: 'menu' | 'busca'; rota: string } | null

const rotaDe = (tela: string) => NAV.find(t => t.tela === tela)!.rota
const EVENTOS = rotaDe('Meus eventos')
const CHECKIN = rotaDe('Check-in')

// bottom e alturas: margem 12 px + área segura (viewport-fit=cover no index.html); --barra-cel = topo da barra (e da faixa)
const BAIXO = 'calc(12px + env(safe-area-inset-bottom))'
const aba = cn(
  'flex flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-semibold leading-[14px] text-[var(--vidro-texto-2)]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
)

export default function BarraCelular() {
  const { pathname, search } = useLocation()
  const { data: eventos = [] } = useProducerEvents()
  const aoVivo = useAoVivo(eventos)
  // Guarda a rota em que abriu: trocar de rota por fora da folha (voltar, link do Evo) fecha, como a gaveta da V4a
  const [folha, setFolha] = useState<Folha>(null)
  if (folha && folha.rota !== pathname) setFolha(null) // ajuste no render: senão reabriria ao voltar à rota
  const [Comp, setComp] = useState<ComponentType<{ aberta: boolean; buscar: boolean; onFechar: () => void }> | null>(null)
  const [vez, setVez] = useState(0) // remonta a folha a cada abertura: o filtro começa vazio
  const aberta = folha?.modo ?? null
  const abre = (modo: 'menu' | 'busca') => {
    const mostra = () => { setVez(v => v + 1); setFolha({ modo, rota: pathname }) }
    if (Comp) return mostra()
    carregarFolha().then(
      m => { setComp(() => m.default); mostra() },
      () => toast.error('Não foi possível abrir o menu. Tente de novo.'),
    )
  }
  const fecha = () => setFolha(null)

  // Evo e aviso de cookies sobem acima da barra (e da faixa) pela variável no <body>
  const temFaixa = !!aoVivo
  useLayoutEffect(() => {
    document.body.style.setProperty('--barra-cel', `calc(${temFaixa ? 124 : 68}px + env(safe-area-inset-bottom))`)
    return () => { document.body.style.removeProperty('--barra-cel') }
  }, [temFaixa])

  const eventId = eventoDaUrl(pathname, search)
  const noInicio = rotaAtiva(INICIO.rota, pathname)
  const noEventos = rotaAtiva(EVENTOS, pathname) || /^\/producer\/events?\//.test(pathname)
  const noCheckin = rotaAtiva(CHECKIN, pathname)
  // qualquer outra tela vive dentro do Menu: a aba Menu fica marcada (e também com a folha aberta)
  const noMenu = !!aberta || !(noInicio || noEventos || noCheckin)

  return (
    <>
      {aoVivo && (
        <div
          role="region"
          aria-label="Evento em andamento"
          style={{ bottom: 'calc(76px + env(safe-area-inset-bottom))' }}
          className="vidro fixed inset-x-3 z-40 flex h-12 items-center gap-2.5 rounded-3xl pl-4 pr-1 text-[13px]"
        >
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-[var(--ev-success)]" />
          <span className="min-w-0 flex-1 truncate">
            <strong className="font-semibold tabular-nums">{aoVivo.entraram}</strong> {aoVivo.entraram === 1 ? 'entrou' : 'entraram'} · {aoVivo.evento.title}
          </span>
          <Link
            to={hrefDaTela(CHECKIN, aoVivo.evento.id)}
            className="grid h-11 shrink-0 place-items-center rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Abrir check-in
          </Link>
        </div>
      )}

      <nav
        aria-label="Navegação do celular"
        style={{ bottom: BAIXO }}
        className="vidro fixed left-3 right-[76px] z-40 grid h-14 grid-cols-4 rounded-[28px] p-1"
      >
        <Link to={INICIO.rota} aria-current={noInicio ? 'page' : undefined} className={aba}>
          <I.Inicio size={24} ativo={noInicio} />Início
        </Link>
        <Link to={EVENTOS} aria-current={noEventos ? 'page' : undefined} className={aba}>
          <I.Eventos size={24} ativo={noEventos} />Eventos
        </Link>
        <Link to={hrefDaTela(CHECKIN, eventId)} aria-current={noCheckin ? 'page' : undefined} className={aba}>
          <I.Checkin size={24} ativo={noCheckin} />Check-in
        </Link>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={aberta === 'menu'}
          data-state={noMenu ? 'active' : 'inactive'}
          onClick={() => abre('menu')}
          className={aba}
        >
          <I.Mais size={24} ativo={noMenu} />Menu
        </button>
      </nav>

      {/* Busca da V4c (⌘K) ainda não existe: por ora abre a folha Menu com o foco no filtro de telas */}
      <button
        type="button"
        aria-label="Buscar tela"
        aria-haspopup="dialog"
        aria-expanded={aberta === 'busca'}
        style={{ bottom: BAIXO }}
        onClick={() => abre('busca')}
        className="vidro fixed right-3 z-40 grid size-14 place-items-center rounded-full text-[var(--vidro-texto)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <I.Buscar size={24} />
      </button>

      {Comp && <Comp key={vez} aberta={!!aberta} buscar={aberta === 'busca'} onFechar={fecha} />}
    </>
  )
}
