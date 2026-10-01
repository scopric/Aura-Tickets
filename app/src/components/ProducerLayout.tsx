import { Outlet, Link, useLocation, useSearchParams } from 'react-router-dom'
import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { ErrorBoundary } from './error-boundary'
import {
  LayoutDashboard, Calendar, CalendarPlus, FolderOpen, Armchair, Clock, CheckSquare, Award, BarChart2,
  TicketPercent, Users, Handshake, Images, ClipboardList, Contact, ScanLine, Camera, Wine, UsersRound, Target,
  BarChart3, Wallet, Calculator, LayoutGrid, Settings, HelpCircle, GraduationCap, Smartphone,
  Receipt, Palette, ShoppingBag, Megaphone, FileText, Zap, CreditCard, Mail, Crown,
  LogOut, Menu, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'
import Tour from './producer/Tour'
import { tourDaRota } from '../lib/tours'
import { useRegistrarTour } from '../hooks/useTourLog'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { useAuth } from '../hooks/useAuth'
import { toast } from 'sonner'
import ThemeToggle from './ThemeToggle'
import { uploadAvatar } from '../lib/avatarUpload'
import EvoHub from './EvoHub'
import FeedbackTopButton from './FeedbackTopButton'
import NotificationsTopButton from './NotificationsTopButton'

const botaoTopo = 'rounded-full p-2 text-foreground hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface SubItem {
  to: string
  icon: React.ElementType
  label: string
  /** Ferramenta ainda em construção: fica fora do menu (Decisão 22); a rota segue atrás de ComingSoonRoute */
  comingSoon?: boolean
}

interface MenuGroup {
  id: string
  /** Sem rótulo: item solto no topo (Início) */
  label?: string
  items: SubItem[]
}

// Menu em 7 grupos, todos abertos (Decisão 114). Todas as páginas continuam existindo.
const menuGroups: MenuGroup[] = [
  { id: 'inicio', items: [{ to: '/producer/dashboard', icon: LayoutDashboard, label: 'Início' }] },
  {
    id: 'events', label: 'Eventos',
    items: [
      { to: '/producer/events', icon: Calendar, label: 'Meus eventos' },
      { to: '/producer/planner', icon: CalendarPlus, label: 'Criar evento' },
      { to: '/producer/event-manager', icon: FolderOpen, label: 'Pasta do evento' },
      { to: '/producer/ingressos-avancados', icon: Receipt, label: 'Ingressos+', comingSoon: true },
      { to: '/producer/lugar-marcado', icon: Armchair, label: 'Lugar marcado' },
      { to: '/producer/timeline', icon: Clock, label: 'Cronograma' },
      { to: '/producer/tarefas', icon: CheckSquare, label: 'Tarefas' },
      { to: '/producer/certificados', icon: Award, label: 'Certificados' },
      { to: '/producer/pos-evento', icon: BarChart2, label: 'Relatório pós-evento' },
    ]
  },
  {
    id: 'sales', label: 'Vendas',
    items: [
      { to: '/producer/cupons', icon: TicketPercent, label: 'Cupons' },
      { to: '/producer/afiliados', icon: Users, label: 'Afiliados' },
      { to: '/producer/banners', icon: Images, label: 'Banners' },
      { to: '/producer/lista-interesse', icon: ClipboardList, label: 'Lista de interesse' },
      { to: '/producer/brand', icon: Palette, label: 'Brand Studio', comingSoon: true },
      { to: '/producer/evokaa-store', icon: ShoppingBag, label: 'Evokaa Store', comingSoon: true },
      { to: '/producer/marketing', icon: Megaphone, label: 'Marketing', comingSoon: true },
    ]
  },
  {
    id: 'audience', label: 'Público',
    items: [
      { to: '/producer/crm', icon: Contact, label: 'CRM' },
      { to: '/producer/checkin', icon: ScanLine, label: 'Check-in' },
      { to: '/producer/galeria', icon: Camera, label: 'Galeria' },
      { to: '/producer/comunicacao', icon: Mail, label: 'Comunicação', comingSoon: true }, // sem tabela nem envio: vira o produto de e-mail do produtor (N2)
    ]
  },
  {
    id: 'ops', label: 'Operação',
    items: [
      { to: '/producer/menu', icon: Wine, label: 'Cardápio' },
      { to: '/producer/parceiros', icon: Handshake, label: 'Parceiros' },
      { to: '/producer/team', icon: UsersRound, label: 'Equipe' },
    ]
  },
  {
    id: 'money', label: 'Dinheiro',
    items: [
      { to: '/producer/finance', icon: BarChart3, label: 'Financeiro' },
      { to: '/producer/wallet', icon: Wallet, label: 'Carteira' },
      { to: '/producer/caixinha', icon: Target, label: 'Orçamento do evento' }, // ex-Caixinha (Decisão 120); a rota fica
      { to: '/producer/calculator', icon: Calculator, label: 'Calculadora de preço' },
      { to: '/producer/tables', icon: LayoutGrid, label: 'Calculadora de mesas' },
      { to: '/producer/bordero', icon: FileText, label: 'Borderô', comingSoon: true },
      { to: '/producer/antecipacao', icon: Zap, label: 'Antecipação', comingSoon: true },
      { to: '/producer/parcelamento', icon: CreditCard, label: 'Parcelamento', comingSoon: true },
    ]
  },
  {
    id: 'account', label: 'Conta',
    items: [
      { to: '/producer/settings', icon: Settings, label: 'Configurações' },
      { to: '/producer/faq', icon: HelpCircle, label: 'Ajuda' },
      { to: '/producer/academy', icon: GraduationCap, label: 'Academy' },
      { to: '/producer/app', icon: Smartphone, label: 'App do organizador' },
      { to: '/producer/assinatura', icon: Crown, label: 'Assinatura', comingSoon: true },
    ]
  },
]

// Decisão 22 (27/09/2026): o que está "em breve" sai do menu até ficar pronto; as rotas continuam atrás de ComingSoonRoute.
const visibleMenuGroups: MenuGroup[] = menuGroups.map(g => ({ ...g, items: g.items.filter(i => !i.comingSoon) }))

/** Iniciais locais do nome (ou do e-mail): sem serviço externo de avatar */
function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase() || '?'
}

export default function ProducerLayout() {
  const [collapsed, setCollapsed] = useState(false)
  // Celular e tablet (abaixo de lg): a barra lateral vira gaveta, fechada por padrão (mesmo padrão do AdminLayout).
  // Guarda a rota em que foi aberta: trocar de rota (botão voltar, links do Evo) fecha sem efeito extra
  const [gavetaEm, setGavetaEm] = useState<string | null>(null)
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const navRef = useRef<HTMLElement>(null)
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
  const { user, logout } = useAuth()
  const mobileOpen = gavetaEm === location.pathname

  const fileInputRef = useRef<HTMLInputElement>(null)
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && user?.id) {
      await uploadAvatar(file, user.id)
    }
  }

  const isActivePath = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/')
    || (path === '/producer/dashboard' && location.pathname === '/producer')

  const handleLogout = () => {
    toast.info('Você saiu da sua conta')
    logout()
    // Nao chamar navigate('/') aqui — o logout ja faz window.location.href = '/'
  }

  // Gaveta aberta: foco no 1º item; Esc fecha e devolve o foco ao botão de menu
  useEffect(() => {
    if (!mobileOpen) return
    navRef.current?.querySelector('a')?.focus()
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

  const nome = user?.name || user?.full_name || 'Usuário'
  const foto = user?.avatar_url || user?.avatar

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
          'fixed left-0 top-0 bottom-0 z-50 lg:z-40 flex flex-col border-r border-border bg-muted dark:bg-card transition-all duration-200',
          'lg:translate-x-0',
          // ao abrir, a visibilidade muda na hora (sem transição), para o foco poder entrar na gaveta
          mobileOpen ? 'translate-x-0 max-lg:[transition-property:transform]' : '-translate-x-full max-lg:invisible',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        <div className={cn('flex h-14 shrink-0 items-center gap-2 px-4', collapsed && 'justify-center px-0')}>
          <img src="/images/logo-evokaa-sm.png" alt="Evokaa" className="h-7 w-auto shrink-0" />
          {!collapsed && <span className="text-sm font-semibold text-foreground">Produtor</span>}
        </div>

        {/* no celular, a visibilidade dos links não passa por transição (herdam a da gaveta), senão o foco ao abrir falha */}
        <nav
          ref={navRef}
          aria-label="Menu do produtor"
          className="max-lg:[&_a]:[transition-property:color,background-color,border-color,box-shadow] min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3 sidebar-dark-scroll"
        >
          {visibleMenuGroups.map(group => (
            <div key={group.id} className="pt-3 first:pt-1">
              {group.label && !collapsed && (
                <p className="px-2.5 pb-1 text-xs font-medium text-muted-foreground">{group.label}</p>
              )}
              <div className="space-y-px">
                {group.items.map(item => {
                  const ativo = isActivePath(item.to)
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setGavetaEm(null)}
                      aria-current={ativo ? 'page' : undefined}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13.5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        collapsed && 'justify-center px-0',
                        ativo ? 'bg-primary/10 font-medium text-foreground' : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
                      )}
                    >
                      <item.icon className={cn('size-4 shrink-0', ativo && 'text-primary')} strokeWidth={1.75} />
                      <span className={collapsed ? 'sr-only' : 'truncate'}>{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 space-y-1 border-t border-border p-2">
          {user && (
            <div className={cn('flex items-center gap-2.5 px-1 py-1.5', collapsed && 'justify-center px-0')}>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Alterar foto de perfil"
                title="Alterar foto de perfil"
                className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {foto ? <img src={foto} alt="" className="size-full object-cover" /> : iniciais(user.name || user.full_name || user.email || 'U')}
              </button>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-foreground">{nome}</div>
                  <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                </div>
              )}
            </div>
          )}
          <div className={cn(collapsed && 'flex justify-center')}>
            <ThemeToggle collapsed={collapsed} className="w-full" />
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title={collapsed ? 'Sair' : undefined}
            className={cn(
              'flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-[13.5px] text-muted-foreground hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              collapsed && 'justify-center px-0'
            )}
          >
            <LogOut className="size-4 shrink-0" strokeWidth={1.75} />
            <span className={collapsed ? 'sr-only' : undefined}>Sair</span>
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            className={cn(
              'hidden h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-[13.5px] text-muted-foreground hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:flex',
              collapsed && 'justify-center px-0'
            )}
          >
            {collapsed ? <PanelLeftOpen className="size-4 shrink-0" strokeWidth={1.75} /> : <PanelLeftClose className="size-4 shrink-0" strokeWidth={1.75} />}
            {!collapsed && <span>Recolher</span>}
          </button>
        </div>
      </aside>

      {/* Conteúdo (pb-24: o fim da página rola acima do Evo flutuante) */}
      <div className={cn('min-w-0 flex-1 min-h-screen pb-24 transition-[margin] duration-200', collapsed ? 'lg:ml-16' : 'lg:ml-60')}>
        {/* Barra do topo fixa ao rolar. Celular: 56 px com menu, logo, sino e feedback.
            Computador: faixa invisível de 40 px só com os ícones à direita (não cobre botões do cabeçalho das páginas) */}
        <div className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border bg-background px-4 lg:pointer-events-none lg:h-10 lg:justify-end lg:border-0 lg:bg-transparent">
          <div className="flex items-center gap-2 lg:hidden">
            <button
              ref={menuBtnRef}
              type="button"
              onClick={() => {
                setCollapsed(false) // a gaveta abre sempre com os nomes (no celular não há botão de expandir)
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
          tirarParametro()
        }} />
      )}
    </div>
  )
}
