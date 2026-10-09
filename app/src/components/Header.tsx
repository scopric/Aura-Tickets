import { lazy, Suspense, useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, UserPlus, LogOut, LayoutDashboard, ChevronDown } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import ErrorBoundary from './ErrorBoundary'
import { useAuth } from '../hooks/useAuth'
import { appUrl } from '../lib/appHost'
import { registerUrl } from '../lib/affiliateRef'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const LINKS = [
  { href: '/', label: 'Início' },
  { href: '/events', label: 'Eventos' },
  { href: '/app/download', label: 'App' },
  { href: '/contato', label: 'Contato' },
]

// Painel e folha carregam só na primeira vez que se abrem (fora do pacote de entrada)
const PainelEventos = lazy(() => import('./PainelEventos'))
const HeaderFolha = lazy(() => import('./HeaderFolha'))

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [folhaPedida, setFolhaPedida] = useState(false)
  const [eventosAberto, setEventosAberto] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const botaoEventos = useRef<HTMLButtonElement>(null)
  const painel = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const isProducerRoute = location.pathname.startsWith('/producer')
  const { user, isAuthenticated, logout, role } = useAuth()

  // Fecha dropdown e painel ao mudar de rota
  useEffect(() => {
    setShowUserMenu(false)
    setEventosAberto(false)
  }, [location.pathname])

  // Painel de eventos: Esc fecha e devolve o foco ao botão; clique fora também fecha
  useEffect(() => {
    if (!eventosAberto) return
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setEventosAberto(false)
      botaoEventos.current?.focus()
    }
    const aoClicar = (e: MouseEvent) => {
      const alvo = e.target as Node
      if (!painel.current?.contains(alvo) && !botaoEventos.current?.contains(alvo)) setEventosAberto(false)
    }
    document.addEventListener('keydown', aoTeclar)
    document.addEventListener('mousedown', aoClicar)
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      document.removeEventListener('mousedown', aoClicar)
    }
  }, [eventosAberto])

  const isActive = (path: string) => location.pathname === path
  const painelDoUsuario = role === 'admin' ? '/admin/dashboard' : role === 'producer' ? '/producer/dashboard' : '/app/hub'

  return (
    <header
      className={cn(
        'pointer-events-none fixed inset-x-0 top-0 z-50 px-3 pt-2 md:pt-3',
        isProducerRoute && 'hidden',
        // ponytail: /contato é a única página pública forçada no escuro com topo claro; ali a pílula já nasce escura.
        location.pathname === '/contato' && 'dark'
      )}
    >
      <div className="relative mx-auto max-w-4xl">
        {/* Pílula flutuante: o único vidro do cabeçalho (contrato v3.4, no máximo 3 por tela) */}
        <div className="vidro pointer-events-auto flex h-14 items-center justify-between pl-4 pr-2 md:pl-5">
          {/* Logo */}
          <Link to="/" className="group flex items-center gap-3 rounded-full focus-visible:outline-none focus-visible:shadow-ev-foco">
            <img
              src="/images/logo-evokaa-sm.png"
              alt="Evokaa"
              className="h-8 w-auto transition-transform duration-rapido group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            />
            <span className="hidden text-[10px] font-medium uppercase tracking-widest text-[color:var(--vidro-texto-2)] sm:block">
              Plataforma
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-1 md:flex">
            {LINKS.map((link) =>
              link.href === '/events' ? (
                <button
                  key={link.href}
                  ref={botaoEventos}
                  type="button"
                  onClick={() => setEventosAberto(!eventosAberto)}
                  aria-expanded={eventosAberto}
                  aria-controls={eventosAberto ? 'painel-eventos' : undefined}
                  aria-current={isActive(link.href) ? 'page' : undefined}
                  className="alvo-44 flex items-center gap-1 rounded-full px-4 py-2 text-[13px] font-medium text-[color:var(--vidro-texto-2)] transition-colors duration-rapido hover:text-[color:var(--vidro-texto)] focus-visible:outline-none focus-visible:shadow-ev-foco motion-reduce:transition-none"
                >
                  {link.label}
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-rapido motion-reduce:transition-none', eventosAberto && 'rotate-180')} aria-hidden="true" />
                </button>
              ) : (
                <Link
                  key={link.href}
                  to={link.href}
                  aria-current={isActive(link.href) ? 'page' : undefined}
                  className="alvo-44 rounded-full px-4 py-2 text-[13px] font-medium text-[color:var(--vidro-texto-2)] transition-colors duration-rapido hover:text-[color:var(--vidro-texto)] focus-visible:outline-none focus-visible:shadow-ev-foco motion-reduce:transition-none"
                >
                  {link.label}
                </Link>
              )
            )}
          </nav>

          {/* CTA Buttons */}
          <div className="hidden items-center gap-2 md:flex">
            {isAuthenticated && user ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:shadow-ev-foco dark:hover:bg-white/5"
                >
                  <img
                    src={user.avatar_url || '/images/logo-evokaa-sm.png'}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200"
                  />
                  <span className="max-w-[120px] truncate text-[13px] font-medium text-[color:var(--vidro-texto)]">
                    {user.full_name || user.email}
                  </span>
                  <ChevronDown className={cn(
                    'w-3.5 h-3.5 transition-transform',
                    showUserMenu && 'rotate-180',
                    'text-[color:var(--vidro-texto-2)]'
                  )} />
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-card border border-border rounded-2xl shadow-xl py-2 z-50">
                    <div className="px-4 py-2 border-b border-border mb-1">
                      <p className="text-xs font-medium text-foreground truncate">{user.full_name || user.email}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{role === 'producer' ? 'Produtor' : role === 'admin' ? 'Admin' : 'Participante'}</p>
                    </div>
                    <Link
                      to={painelDoUsuario}
                      className="flex items-center gap-2 px-4 py-2 text-[13px] text-foreground hover:bg-accent transition-colors"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5 text-muted-foreground" />
                      Meu Painel
                    </Link>
                    <button
                      onClick={() => { setShowUserMenu(false); logout() }}
                      className="flex items-center gap-2 px-4 py-2 text-[13px] text-destructive hover:bg-destructive/10 transition-colors w-full text-left"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sair
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link
                  to={appUrl('/auth/login')}
                  className="alvo-44 rounded-full border border-[color:var(--vidro-texto-2)]/40 px-5 py-2.5 text-[13px] font-medium text-[color:var(--vidro-texto)] transition-colors duration-rapido hover:bg-foreground/5 focus-visible:outline-none focus-visible:shadow-ev-foco motion-reduce:transition-none dark:hover:bg-white/5"
                >
                  Entrar
                </Link>
                <Link
                  to={registerUrl(appUrl)}
                  className="alvo-44 rounded-full bg-primary px-5 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-ev-primary transition-transform duration-micro hover:bg-primary/90 focus-visible:outline-none focus-visible:shadow-ev-foco active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
                >
                  <span className="flex items-center gap-2">
                    <UserPlus className="w-3.5 h-3.5" />
                    Criar Conta
                  </span>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => { setFolhaPedida(true); setIsMobileMenuOpen(!isMobileMenuOpen) }}
            aria-label="Menu"
            aria-expanded={isMobileMenuOpen}
            className="alvo-44 grid size-10 place-items-center rounded-full text-[color:var(--vidro-texto)] focus-visible:outline-none focus-visible:shadow-ev-foco md:hidden"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Painel "Eventos" (computador): superfície opaca, não vidro */}
        {eventosAberto && (
          <div
            ref={painel}
            id="painel-eventos"
            className="pointer-events-auto absolute inset-x-0 top-full mt-2 hidden rounded-ev-xl border border-border bg-card shadow-ev-2 md:block"
          >
            <ErrorBoundary fallback={<Link to="/events" onClick={() => setEventosAberto(false)} className="block p-4 text-sm font-semibold text-foreground">Ver todos os eventos</Link>}>
              <Suspense fallback={null}><PainelEventos aoNavegar={() => setEventosAberto(false)} /></Suspense>
            </ErrorBoundary>
          </div>
        )}
      </div>

      {folhaPedida && (
        <ErrorBoundary fallback={<Link to="/events" onClick={() => setIsMobileMenuOpen(false)} className="pointer-events-auto fixed inset-x-3 bottom-3 rounded-ev-xl border border-border bg-card p-4 text-center text-sm font-semibold text-foreground md:hidden">Ver todos os eventos</Link>}>
        <Suspense fallback={null}>
          <HeaderFolha
            aberta={isMobileMenuOpen}
            aoMudar={setIsMobileMenuOpen}
            links={LINKS}
            ativo={isActive}
            autenticado={!!(isAuthenticated && user)}
            painelDoUsuario={painelDoUsuario}
            logout={logout}
          />
        </Suspense>
        </ErrorBoundary>
      )}
    </header>
  )
}
