import { useState, useRef, useEffect } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Calendar, Ticket, ShoppingCart, MessageCircle,
  Bell, Settings, LogOut, ChevronLeft, ChevronRight, Search, User,
  Menu, Camera
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useUserNotifications } from '../hooks/useNotifications'
import { useTourDaUrl } from '../hooks/useTourDaUrl'
import { cn } from '../lib/utils'
import ThemeToggle from './ThemeToggle'
import { ErrorBoundary } from './error-boundary'
import { uploadAvatar } from '../lib/avatarUpload'
import EvoHub from './EvoHub'
import Tour from './producer/Tour'
import FeedbackTopButton from './FeedbackTopButton'
import NotificationsTopButton from './NotificationsTopButton'
import * as I from './icones/evokaa16'

const navItems = [
  { to: '/app/hub', icon: LayoutDashboard, label: 'Início' },
  { to: '/app/tickets', icon: Ticket, label: 'Meus Ingressos', tour: 'app-ingressos' },
  { to: '/app/events', icon: Calendar, label: 'Eventos', tour: 'app-explorar' },
  { to: '/app/orders', icon: ShoppingCart, label: 'Compras' },
  { to: '/app/chat', icon: MessageCircle, label: 'Chat' },
  { to: '/app/notifications', icon: Bell, label: 'Notificações' },
  { to: '/app/profile', icon: User, label: 'Perfil' },
  { to: '/app/settings', icon: Settings, label: 'Configurações' },
]

// Barra inferior do celular (V10a, como a prancha): Explorar, Ingressos e Conta, mais o círculo de busca à parte.
// Início, Chat, Compras, Notificações e Configurações seguem no menu do topo (e Notificações no sino); a V10b decide o resto.
const abas = [
  { to: '/app/events', Icone: I.Explorar, label: 'Explorar', tour: 'app-explorar' },
  { to: '/app/tickets', Icone: I.Ingressos, label: 'Ingressos', tour: 'app-ingressos' },
  { to: '/app/profile', Icone: I.Conta, label: 'Conta' },
]

// Mesma consulta do breakpoint lg: a lateral só aparece a partir dela; abaixo, vale a barra inferior
const COMPUTADOR = '(min-width: 1024px)'

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const paginaRef = useRef<HTMLElement>(null)
  const { tour, tourId, fim } = useTourDaUrl(paginaRef)
  // Os dois menus têm os mesmos alvos: a lateral só os expõe no computador (no celular ela fica fora da tela)
  const [computador, setComputador] = useState(() => !!window.matchMedia?.(COMPUTADOR).matches)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && user?.id) {
      await uploadAvatar(file, user.id)
    }
    e.target.value = '' // escolher a mesma imagem de novo volta a disparar o envio
  }

  // Busca do topo (computador): leva ao Explorar com o termo já no campo (Events.tsx lê ?q=)
  const buscar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const q = String(new FormData(e.currentTarget).get('q') ?? '').trim()
    navigate(q ? `/app/events?q=${encodeURIComponent(q)}` : '/app/events')
  }

  const triggerUpload = () => {
    fileInputRef.current?.click()
  }

  const { data: notifications = [] } = useUserNotifications()

  const unreadCount = notifications.filter((n: any) => !n.is_read).length

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/')

  // Avisa o resto da página que a barra existe (--barra-cel no <body>, abaixo de lg, já com a área segura): o Evo e o
  // aviso de cookies sobem sobre ela. Limpa ao sair.
  useEffect(() => {
    const mq = window.matchMedia?.(COMPUTADOR)
    if (!mq) return
    const aplicar = () => {
      document.body.style.setProperty('--barra-cel', mq.matches ? '0px' : 'calc(68px + env(safe-area-inset-bottom, 0px))')
      setComputador(mq.matches)
    }
    aplicar()
    mq.addEventListener('change', aplicar)
    return () => { mq.removeEventListener('change', aplicar); document.body.style.removeProperty('--barra-cel') }
  }, [])

  return (
    <div className="layout-antigo flex min-h-screen glass-canvas">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 glass-backdrop z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 bottom-0 z-50 flex flex-col pl-[env(safe-area-inset-left)] transition-all duration-300 ease-out',
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'w-[72px]' : 'w-[250px]',
          'glass-bar border-r'
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            'flex items-center gap-3 h-16 border-b flex-shrink-0',
            collapsed ? 'justify-center px-0' : 'px-5'
          )}
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        >
          <img
            src="/images/logo-evokaa-sm.png"
            alt="Evokaa"
            className="h-7 w-auto object-contain"
          />
          {!collapsed && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white/90 tracking-wide">Evokaa</span>
              <span
                className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{
                  background: 'rgba(143, 51, 245, 0.1)',
                  color: 'var(--plum-light)',
                  border: '1px solid rgba(143,51,245,0.25)',
                }}
              >
                App
              </span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2.5 space-y-0.5 overflow-y-auto sidebar-dark-scroll">
          {navItems.map((item) => {
            const active = isActive(item.to)
            return (
              <Link
                key={item.to}
                to={item.to}
                data-tour={computador ? item.tour : undefined}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg transition-all duration-200',
                  collapsed ? 'justify-center px-0 py-2.5 mx-1' : 'px-3 py-2',
                  active
                    ? 'text-white'
                    : 'text-white/60 hover:text-white/90 hover:bg-white/[0.04]'
                )}
                style={active ? { background: 'rgba(143, 51, 245, 0.15)', borderLeft: '3px solid #8f33f5', borderRadius: '0px 8px 8px 0px' } : {}}
                title={collapsed ? item.label : undefined}
                aria-label={collapsed ? item.label : undefined}
              >
                <item.icon
                  className={cn(
                    'flex-shrink-0 transition-transform duration-200',
                    collapsed ? 'w-[18px] h-[18px]' : 'w-[17px] h-[17px]',
                    active && 'scale-110'
                  )}
                  style={{ color: active ? '#8f33f5' : undefined }}
                />
                {!collapsed && (
                  <span className="text-[13px] font-medium tracking-wide">{item.label}</span>
                )}
                {!collapsed && item.to === '/app/notifications' && unreadCount > 0 && (
                  <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-plum text-cream font-medium">
                    {unreadCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User */}
        {user && (
          <div
            className={cn(
              'border-t mx-2 pt-3 pb-2 flex-shrink-0',
              collapsed && 'flex justify-center'
            )}
            style={{ borderColor: 'rgba(255,255,255,0.06)' }}
          >
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
            {!collapsed ? (
              <div className="flex items-center gap-2.5 px-1">
                <button type="button" className="relative group cursor-pointer shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum" onClick={triggerUpload} title="Alterar foto de perfil" aria-label="Alterar foto de perfil">
                  <img
                    src={user.avatar_url || user.avatar || '/images/logo-evokaa-sm.png'}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover ring-1 ring-white/10 group-hover:opacity-75 transition-opacity"
                  />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/45 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-3.5 h-3.5 text-white" aria-hidden="true" />
                  </span>
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-white/80 font-medium truncate">
                    {user.name || user.full_name || 'Usuário'}
                  </div>
                  <div className="text-[10px] text-white/25 truncate">{user.email}</div>
                </div>
              </div>
            ) : (
              <button type="button" className="relative group cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum" onClick={triggerUpload} title="Alterar foto de perfil" aria-label="Alterar foto de perfil">
                <img
                  src={user.avatar_url || user.avatar || '/images/logo-evokaa-sm.png'}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover ring-1 ring-white/10 group-hover:opacity-75 transition-opacity"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/45 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-3.5 h-3.5 text-white" aria-hidden="true" />
                </span>
              </button>
            )}
          </div>
        )}

        {/* Logout */}
        <div className="p-2 flex-shrink-0 flex flex-col gap-1">
          <ThemeToggle collapsed={collapsed} className="w-full text-white/40 hover:text-white/80" />
          <button
            onClick={logout}
            className={cn(
              'flex items-center gap-3 rounded-lg transition-all w-full text-white/60 hover:text-red-400/80 hover:bg-red-500/[0.06]',
              collapsed ? 'justify-center px-0 py-2.5 mx-1' : 'px-3 py-2.5'
            )}
            title={collapsed ? 'Sair' : undefined}
            aria-label={collapsed ? 'Sair' : undefined}
          >
            <LogOut className="w-[17px] h-[17px] flex-shrink-0" />
            {!collapsed && <span className="text-[13px]">Sair</span>}
          </button>
        </div>

        {/* Collapse toggle (desktop only) */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          className="absolute -right-3 top-[70px] w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110 z-50 hidden lg:flex"
          style={{
            background: 'linear-gradient(135deg, #1d68c4, #8f33f5)',
            color: 'white',
            boxShadow: '0 2px 8px rgba(143,51,245,0.4)',
          }}
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* Main Content */}
      <div
        className={cn(
          // laterais: com viewport-fit=cover o conteúdo não pode ir para baixo do entalhe (iPhone deitado)
          'flex-1 min-w-0 flex flex-col min-h-screen pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] transition-all duration-300',
          'lg:ml-[72px]',
          !collapsed && 'lg:ml-[250px]'
        )}
      >
        {/* Header */}
        <header
          className="sticky top-0 z-30 h-16 flex items-center justify-between px-6 border-b glass-bar"
        >
          <div className="flex items-center gap-4">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
              className="lg:hidden p-2 rounded-lg hover:bg-white/[0.04] transition-colors"
            >
              <Menu className="w-5 h-5 text-white/70" />
            </button>

            {/* Mobile logo */}
            <Link to="/app/hub" className="lg:hidden flex items-center gap-2">
              <img
                src="/images/logo-evokaa-sm.png"
                alt="Evokaa"
                className="h-6 w-auto object-contain"
              />
            </Link>

            {/* Busca (no celular some: lá o círculo da barra inferior abre o Explorar com o campo focado). Aqui leva ao
                Explorar com o termo já digitado */}
            <form role="search" onSubmit={buscar} className="relative hidden w-72 max-w-full sm:block">
              <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="search"
                name="q"
                autoComplete="off"
                enterKeyHint="search"
                aria-label="Buscar eventos"
                placeholder="Buscar eventos"
                className="w-full pl-9 pr-4 py-2 bg-white/[0.02] border border-white/[0.06] rounded-xl text-sm text-white placeholder:!text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-plum transition-all"
              />
            </form>
          </div>

          <div className="flex items-center gap-4">
            {/* Sino: o mesmo componente do produtor */}
            <NotificationsTopButton
              className="rounded-xl p-2.5 text-white/60 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
              verTodas={{ to: '/app/notifications', texto: 'Ver todas as notificações' }}
            />

            <FeedbackTopButton className="p-2.5 rounded-xl text-white/60 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400" />

            {/* Avatar: clicar troca a foto */}
            <button type="button" onClick={triggerUpload} title="Alterar foto de perfil" aria-label="Alterar foto de perfil" className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum">
              <img
                src={user?.avatar_url || user?.avatar || '/images/logo-evokaa-sm.png'}
                alt=""
                className="w-9 h-9 rounded-full object-cover ring-2 ring-purple-500/20"
              />
            </button>
          </div>
        </header>

        {/* Page Content (pb-24: o fim da página rola acima do Evo flutuante) */}
        <main ref={paginaRef} className="flex-1 p-6 pb-[calc(6rem+var(--barra-cel,0px))] lg:p-10 lg:pb-24 max-w-[1440px] mx-auto w-full">
          <ErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {/* Barra inferior em vidro (só celular), com a busca em círculo à parte. Item ativo: pílula opaca e ícone com a
          camada tint (.vidro, index.css). A busca leva ao Explorar com o campo de busca focado. */}
      <div className="fixed inset-x-3 bottom-[calc(12px+env(safe-area-inset-bottom,0px))] z-30 mx-auto flex max-w-[420px] items-center gap-3 lg:hidden">
        <nav aria-label="Navegação principal" className="vidro flex h-14 min-w-0 flex-1 items-center p-1">
          {abas.map(({ to, Icone, label, tour: alvo }) => {
            const ativa = isActive(to)
            return (
              <Link
                key={to}
                to={to}
                data-tour={alvo}
                aria-current={ativa ? 'page' : undefined}
                className="flex h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-semibold leading-[14px] text-[var(--vidro-texto-2)] focus-visible:outline-none focus-visible:shadow-ev-foco"
              >
                <Icone size={24} ativo={ativa} />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>
        <Link
          to="/app/events?busca=1"
          aria-label="Buscar eventos"
          className="vidro grid size-14 shrink-0 place-items-center text-[var(--vidro-texto)] transition-transform duration-micro active:scale-[1.06] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:shadow-ev-foco"
        >
          <I.Buscar size={24} />
        </Link>
      </div>

      <EvoHub />
      {/* O tour nunca abre sozinho: só com ?tour=<id> e na tela do próprio tour */}
      {tour && (
        <Tour key={tourId} tour={tour} onFim={fim} />
      )}
    </div>
  )
}
