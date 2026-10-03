import { Outlet, useLocation, useSearchParams } from 'react-router-dom'
import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { ErrorBoundary } from './error-boundary'
import { Menu } from 'lucide-react'
import Tour from './producer/Tour'
import Lateral from './producer/Lateral'
import { tourDaRota } from '../lib/tours'
import { gravarNav, lerNav } from '../lib/navegacaoProdutor'
import { useRegistrarTour } from '../hooks/useTourLog'
import { cn } from '@/lib/utils'
import EvoHub from './EvoHub'
import FeedbackTopButton from './FeedbackTopButton'
import NotificationsTopButton from './NotificationsTopButton'

const botaoTopo = 'rounded-full p-2 text-foreground hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

// Lateral por escopo (V4a, Decisões 141 e 143): o conteúdo está em producer/Lateral.tsx e as telas em lib/navegacaoProdutor.ts.
// Aqui ficam a casca (trilho de 56 px no computador, gaveta no celular), o ⌘B, o tour e a barra do topo.
// Todas as páginas continuam existindo; tela "em breve" fica fora da lateral (Decisão 22).

const COMPUTADOR = '(min-width: 1024px)'

export default function ProducerLayout() {
  const [recolhida, setRecolhida] = useState(() => lerNav('recolhida') === '1')
  const [computador, setComputador] = useState(() => window.matchMedia(COMPUTADOR).matches)
  // Celular e tablet (abaixo de lg): a barra lateral vira gaveta, fechada por padrão (mesmo padrão do AdminLayout).
  // Guarda a rota em que foi aberta: trocar de rota (botão voltar, links do Evo) fecha sem efeito extra
  const [gavetaEm, setGavetaEm] = useState<string | null>(null)
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const paginaRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const [params, setSearchParams] = useSearchParams()
  const registrar = useRegistrarTour()
  const tourId = params.get('tour')
  const tour = tourDaRota(tourId, location.pathname)
  const tirarParametro = useCallback(
    () => setSearchParams((p: URLSearchParams) => { const n = new URLSearchParams(p); n.delete('tour'); return n }, { replace: true }),
    [setSearchParams])
  // ?tour= que não existe ou não é desta tela: tira da URL
  useEffect(() => { if (tourId && !tour) tirarParametro() }, [tourId, tour, tirarParametro])
  // Tour fechado: foco no título da tela. Roda depois da limpeza do Tour, que tira o inert do #root
  // (com setTimeout o foco era pedido ainda com a página inerte e caía no body)
  const focarTitulo = useRef(false)
  useEffect(() => {
    if (tour || !focarTitulo.current) return
    focarTitulo.current = false
    const h1 = paginaRef.current?.querySelector('h1')
    if (h1) { h1.tabIndex = -1; h1.focus() }
  }, [tour])
  const mobileOpen = gavetaEm === location.pathname
  // Trilho só no computador: na gaveta a lateral abre sempre com os nomes
  const trilho = recolhida && computador

  const alternaTrilho = useCallback(() => setRecolhida(r => {
    gravarNav('recolhida', r ? '0' : '1')
    return !r
  }), [])

  useEffect(() => {
    const m = window.matchMedia(COMPUTADOR)
    const muda = () => setComputador(m.matches)
    m.addEventListener('change', muda)
    return () => m.removeEventListener('change', muda)
  }, [])

  // ⌘B / Ctrl+B recolhe e abre. Ignorado: com Shift/Alt, abaixo de 1024 px (não há trilho), com o tour aberto
  // (app inerte) e com o foco em campo de texto ou editor (⌘B é negrito lá)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'b' || !computador || tour) return
      if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return
      e.preventDefault()
      alternaTrilho()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [alternaTrilho, computador, tour])

  // Gaveta aberta: foco no 1º item; Esc fecha e devolve o foco ao botão de menu
  useEffect(() => {
    if (!mobileOpen) return
    document.getElementById('produtor-menu')?.querySelector<HTMLElement>('a, button')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setGavetaEm(null)
      menuBtnRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  // Entrada de tela a cada troca de rota: reinicia a animação CSS sem remontar a página
  // (key remontaria a tela inteira; o boundary usa resetKey — "O que não pode quebrar", seção 10)
  useLayoutEffect(() => {
    const el = paginaRef.current
    if (!el) return
    el.classList.remove('produtor-entrar')
    void el.offsetWidth
    el.classList.add('produtor-entrar')
  }, [location.pathname])

  return (
    <div className="painel-produtor glass-canvas flex min-h-screen">
      {mobileOpen && (
        <div
          className="fixed inset-0 glass-backdrop z-40 lg:hidden"
          onClick={() => {
            setGavetaEm(null)
            menuBtnRef.current?.focus()
          }}
        />
      )}

      {/* No celular a gaveta fecha fora da tela e fica invisível (sai da ordem do Tab); no computador, fixa */}
      <aside
        id="produtor-menu"
        className={cn(
          'fixed left-0 top-0 bottom-0 z-50 lg:z-40 flex w-[248px] flex-col border-r border-border bg-[var(--ev-sidebar)] transition-[width,transform] duration-base ease-move motion-reduce:transition-none',
          'lg:translate-x-0',
          // ao abrir, a visibilidade muda na hora (sem transição), para o foco poder entrar na gaveta
          mobileOpen ? 'translate-x-0 max-lg:[transition-property:transform]' : '-translate-x-full max-lg:invisible',
          trilho && 'lg:w-14'
        )}
      >
        <Lateral rail={trilho} onNavega={() => setGavetaEm(null)} onRecolher={alternaTrilho} />
      </aside>

      {/* Conteúdo (pb-24: o fim da página rola acima do Evo flutuante) */}
      <div className={cn('min-w-0 flex-1 min-h-screen pb-24 transition-[margin] duration-base ease-move motion-reduce:transition-none', trilho ? 'lg:ml-14' : 'lg:ml-[248px]')}>
        {/* Barra do topo fixa ao rolar. Celular: 56 px com menu, logo, sino e feedback.
            Computador: faixa invisível de 40 px só com os ícones à direita (não cobre botões do cabeçalho das páginas) */}
        <div className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border bg-background px-4 lg:pointer-events-none lg:h-10 lg:justify-end lg:border-0 lg:bg-transparent">
          <div className="flex items-center gap-2 lg:hidden">
            <button
              ref={menuBtnRef}
              type="button"
              onClick={() => {
                setGavetaEm(mobileOpen ? null : location.pathname)
              }}
              aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={mobileOpen}
              aria-controls="produtor-menu"
              className="rounded-md p-2 text-foreground hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Menu className="size-5" strokeWidth={1.75} />
            </button>
            <img src="/images/logo-evokaa-sm.png" alt="Evokaa" className="h-7 w-auto" />
          </div>
          <div className="pointer-events-auto flex items-center gap-1 lg:rounded-full lg:border lg:border-border lg:bg-card lg:p-0.5">
            <NotificationsTopButton className={botaoTopo} />
            <FeedbackTopButton className={botaoTopo} />
          </div>
        </div>
        <div ref={paginaRef} inert={mobileOpen} className="produtor-pagina produtor-entrar mx-auto w-full max-w-[1200px] p-4 md:p-6 lg:p-8">
          <ErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </div>
      </div>
      <EvoHub />
      {/* O tour nunca abre sozinho: só com ?tour=<id> e na tela do próprio tour */}
      {tour && (
        <Tour key={tourId} tour={tour} onFim={puladas => {
          void registrar(`tour:${tourId}`, { skipped: puladas })
          focarTitulo.current = true
          tirarParametro()
        }} />
      )}
    </div>
  )
}
