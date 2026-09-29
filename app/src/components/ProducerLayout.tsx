import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useRef } from 'react'
import { ErrorBoundary } from './error-boundary'
import {
  LayoutDashboard, Calendar, Users, Wallet,
  ChevronLeft, ChevronRight, Settings, LogOut,
  Calculator, Wine, FolderOpen, Sparkles, Shield,
  PiggyBank, Images,
  ScanLine, Mail, CheckSquare, Handshake,
  Clock, Megaphone, TicketPercent, HelpCircle, Crown,
  ShoppingBag, Award, FileText, Receipt, GraduationCap,
  Armchair, Smartphone, ChevronDown,
  Tag, Banknote, Zap, CreditCard, BarChart2,
  Palette, BarChart3, Camera
} from 'lucide-react'
import OnboardingTour from '../components/OnboardingTour'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { useAuth } from '../hooks/useAuth'
import { toast } from 'sonner'
import ThemeToggle from './ThemeToggle'
import { uploadAvatar } from '../lib/avatarUpload'
import EvoHub from './EvoHub'
import FeedbackTopButton from './FeedbackTopButton'
import NotificationsTopButton from './NotificationsTopButton'

const botaoTopo = 'rounded-full p-2 text-espresso hover:bg-slate-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum'

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
  icon: React.ElementType
  label: string
  color?: string
  items: SubItem[]
}

/* ==========================================================================
   MENU REESTRUTURADO — 5 GRUPOS PRINCIPAIS (de ~30 itens soltos → 5 grupos)
   ==========================================================================
   
   CONSOLIDACOES REALIZADAS:
   
   1. CERTIFICADOS (era 2 itens → 1)
      - Removido: "Editor Cert." separado
      - Agora: Dentro da pagina Certificados ha um botao "Editor de Modelos"
      
   2. CALCULADORAS (era 2 itens → 1)
      - Fundido: "Calc. de Preco" + "Calc. de Mesas" → "Calculadoras"
      
   3. CONFIG. PAGAMENTO (era 2 itens → 1)
      - Fundido: "Antecipacao" + "Parcelamento" → "Config. Pagamento"
      
   4. AURA STORE + LISTA INTERESSE (de Eventos → Vendas)
      - Evokaa Store e Lista de Interesse sao ferramentas de venda, nao gestao de evento
      
   5. REL. POS-EVENTO (de Eventos → permanece em Eventos, pertence ao ciclo)
   
   6. BANNERS (de Experiencia → Vendas, e marketing visual)
   
   7. APP + FAQ (de Crescimento → Conta, sao informacionais sobre a plataforma)
   
   TODAS AS PAGINAS CONTINUAM EXISTINDO. Apenas a organizacao do menu mudou.
   ========================================================================== */

const menuGroups: MenuGroup[] = [
  {
    id: 'events', icon: Calendar, label: 'Eventos', color: '#60a5fa',
    items: [
      { to: '/producer/events', icon: Calendar, label: 'Meus Eventos' },
      { to: '/producer/planner', icon: Sparkles, label: 'Criar Evento' },
      { to: '/producer/event-manager', icon: FolderOpen, label: 'Pasta do Evento' },
      { to: '/producer/ingressos-avancados', icon: Receipt, label: 'Ingressos+', comingSoon: true },
      { to: '/producer/lugar-marcado', icon: Armchair, label: 'Lugar Marcado' },
      { to: '/producer/certificados', icon: Award, label: 'Certificados' },
      { to: '/producer/timeline', icon: Clock, label: 'Cronograma' },
      { to: '/producer/pos-evento', icon: BarChart2, label: 'Rel. Pos-Evento' },
      { to: '/producer/brand', icon: Palette, label: 'Brand Studio', comingSoon: true },
      { to: '/producer/menu', icon: Wine, label: 'Cardapio' },
    ]
  },
  {
    id: 'sales', icon: Megaphone, label: 'Vendas & Marketing', color: '#f59e0b',
    items: [
      { to: '/producer/evokaa-store', icon: ShoppingBag, label: 'Evokaa Store', comingSoon: true },
      { to: '/producer/lista-interesse', icon: FileText, label: 'Lista de Interesse' },
      { to: '/producer/cupons', icon: TicketPercent, label: 'Cupons' },
      { to: '/producer/afiliados', icon: Users, label: 'Afiliados' },
      { to: '/producer/marketing', icon: Megaphone, label: 'Marketing', comingSoon: true },
      { to: '/producer/crm', icon: Users, label: 'CRM Pipeline' },
      { to: '/producer/banners', icon: Images, label: 'Banners' },
    ]
  },
  {
    id: 'finance', icon: Banknote, label: 'Financeiro', color: '#22c55e',
    items: [
      { to: '/producer/wallet', icon: Wallet, label: 'Carteira' },
      { to: '/producer/finance', icon: BarChart3, label: 'Financeiro' },
      { to: '/producer/bordero', icon: Award, label: 'Bordero', comingSoon: true },
      { to: '/producer/antecipacao', icon: Zap, label: 'Antecipacao', comingSoon: true },
      { to: '/producer/parcelamento', icon: CreditCard, label: 'Parcelamento', comingSoon: true },
      { to: '/producer/calculator', icon: Calculator, label: 'Calc. de Preco' },
      { to: '/producer/tables', icon: Tag, label: 'Calc. de Mesas' },
      { to: '/producer/caixinha', icon: PiggyBank, label: 'Caixinha' },
    ]
  },
  {
    id: 'ops', icon: Shield, label: 'Operacao', color: '#3b82f6',
    items: [
      { to: '/producer/tarefas', icon: CheckSquare, label: 'Tarefas' },
      { to: '/producer/comunicacao', icon: Mail, label: 'Comunicacao' },
      { to: '/producer/parceiros', icon: Handshake, label: 'Parceiros' },
      { to: '/producer/team', icon: Shield, label: 'Equipe' },
      { to: '/producer/checkin', icon: ScanLine, label: 'Check-in' },
      { to: '/producer/galeria', icon: Images, label: 'Galeria' },
    ]
  },
  {
    id: 'account', icon: Settings, label: 'Conta', color: '#78716c',
    items: [
      { to: '/producer/academy', icon: GraduationCap, label: 'Academy' },
      { to: '/producer/app', icon: Smartphone, label: 'App' },
      { to: '/producer/assinatura', icon: Crown, label: 'Assinatura', comingSoon: true },
      { to: '/producer/faq', icon: HelpCircle, label: 'Ajuda' },
      { to: '/producer/settings', icon: Settings, label: 'Configuracoes' },
    ]
  },
]

// Decisão 22 (27/09/2026): o que está "em breve" sai do menu até ficar pronto; as rotas continuam atrás de ComingSoonRoute.
const visibleMenuGroups: MenuGroup[] = menuGroups.map(g => ({ ...g, items: g.items.filter(i => !i.comingSoon) }))

function SubMenuGroup({ group, collapsed, expandedGroup, toggleGroup, onExpand, isActivePath }: {
  group: MenuGroup
  collapsed: boolean
  expandedGroup: string | null
  toggleGroup: (id: string) => void
  /** Menu recolhido: abre a barra lateral já com este grupo expandido */
  onExpand: (id: string) => void
  isActivePath: (path: string) => boolean
}) {
  const isExpanded = expandedGroup === group.id
  const hasActiveChild = group.items.some(i => isActivePath(i.to))

  if (collapsed) {
    return (
      <div className="relative group/menu">
        <button
          onClick={() => onExpand(group.id)}
          className={cn(
            'flex items-center justify-center w-full rounded-lg transition-all py-2.5 mx-1',
            hasActiveChild
              ? 'text-white'
              : 'text-white/60 hover:text-white/90 hover:bg-white/[0.04]'
          )}
          style={hasActiveChild ? { background: 'rgba(143, 51, 245, 0.15)' } : {}}
          title={group.label}
        >
          <group.icon
            className="w-[18px] h-[18px] flex-shrink-0"
            style={{ color: hasActiveChild ? group.color : undefined }}
          />
        </button>
        {/* Tooltip submenu */}
        <div className="absolute left-full top-0 ml-2 w-48 py-2 rounded-xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all duration-200 z-50"
          style={{ background: '#2a1a24', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-white/60 mb-1">{group.label}</div>
          {group.items.map(item => (
            <Link key={item.to} to={item.to}
              className={cn(
                'flex items-center gap-2 px-3 py-2 text-[11px] transition-all',
                isActivePath(item.to) ? 'text-white bg-white/[0.06]' : 'text-white/50 hover:text-white/85 hover:bg-white/[0.04]'
              )}>
              <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={() => toggleGroup(group.id)}
        className={cn(
          'flex items-center gap-3 w-full rounded-lg transition-all duration-200 px-3 py-2',
          hasActiveChild
            ? 'text-white'
            : 'text-white/60 hover:text-white/90 hover:bg-white/[0.04]'
        )}
        style={hasActiveChild ? { background: 'rgba(143, 51, 245, 0.1)' } : {}}
      >
        <group.icon
          className="w-[17px] h-[17px] flex-shrink-0"
          style={{ color: hasActiveChild ? group.color : undefined }}
        />
        <span className="text-[12.5px] font-medium tracking-wide flex-1 text-left">{group.label}</span>
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-200', isExpanded && 'rotate-180')} />
      </button>
      <div className={cn(
        'overflow-hidden transition-all duration-200',
        isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
      )}>
        <div className="pl-4 ml-3 space-y-0.5 py-1" style={{ borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
          {group.items.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex items-center gap-2.5 rounded-md transition-all duration-150 px-2.5 py-1.5',
                isActivePath(item.to)
                  ? 'text-white'
                  : 'text-white/50 hover:text-white/85 hover:bg-white/[0.03]'
              )}
              style={isActivePath(item.to) ? { background: 'rgba(143, 51, 245, 0.12)' } : {}}
            >
              <item.icon
                className="w-3.5 h-3.5 flex-shrink-0"
                style={{ color: isActivePath(item.to) ? '#a78bfa' : undefined }}
              />
              <span className="text-[11.5px]">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ProducerLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [expandedGroup, setExpandedGroup] = useState<string | null>('events')
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && user?.id) {
      await uploadAvatar(file, user.id)
    }
  }

  const triggerUpload = () => {
    fileInputRef.current?.click()
  }

  const isActivePath = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/')

  const toggleGroup = (id: string) => {
    setExpandedGroup(prev => prev === id ? null : id)
  }

  const handleLogout = () => {
    toast.info('Voce saiu da sua conta')
    logout()
    // Nao chamar navigate('/') aqui — o logout ja faz window.location.href = '/'
  }

  return (
    <div className="flex min-h-screen glass-canvas">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 bottom-0 z-40 flex flex-col glass-bar border-r transition-all duration-300 ease-out',
          collapsed ? 'w-[68px]' : 'w-[232px]'
        )}
      >
        {/* Logo area */}
        <div className={cn(
          'flex items-center gap-3 h-16 border-b flex-shrink-0',
          collapsed ? 'justify-center px-0' : 'px-5'
        )}
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        >
          <img
            src="/images/logo-evokaa.png"
            alt="Evokaa"
            className={cn("w-auto transition-all", collapsed ? "h-7" : "h-11")}
          />
          {!collapsed && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white/90 tracking-wide">Painel</span>
              <span
                className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(143,51,245,0.1)', color: 'var(--plum-light)', border: '1px solid rgba(143,51,245,0.25)' }}
              >
                Prod
              </span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto sidebar-dark-scroll">
          {/* Dashboard - direct link */}
          <Link
            to="/producer/dashboard"
            className={cn(
              'flex items-center gap-3 rounded-lg transition-all duration-200',
              collapsed ? 'justify-center px-0 py-2.5 mx-1' : 'px-3 py-2',
              isActivePath('/producer/dashboard')
                ? 'text-white'
                : 'text-white/60 hover:text-white/90 hover:bg-white/[0.04]'
            )}
            style={isActivePath('/producer/dashboard') ? { background: 'rgba(143, 51, 245, 0.15)', borderLeft: '3px solid #8f33f5', borderRadius: '0px 8px 8px 0px' } : {}}
            title={collapsed ? 'Dashboard' : undefined}
          >
            <LayoutDashboard
              className={cn(
                'flex-shrink-0 transition-transform duration-200',
                collapsed ? 'w-[18px] h-[18px]' : 'w-[17px] h-[17px]',
                isActivePath('/producer/dashboard') && 'scale-110'
              )}
              style={{ color: isActivePath('/producer/dashboard') ? '#8f33f5' : undefined }}
            />
            {!collapsed && <span className="text-[12.5px] font-medium tracking-wide">Dashboard</span>}
          </Link>

          {/* Menu Groups */}
          {visibleMenuGroups.map(group => (
            <SubMenuGroup
              key={group.id}
              group={group}
              collapsed={collapsed}
              expandedGroup={expandedGroup}
              toggleGroup={toggleGroup}
              onExpand={(id) => { setCollapsed(false); setExpandedGroup(id) }}
              isActivePath={isActivePath}
            />
          ))}
        </nav>

        {/* User */}
        {user && (
          <div
            className={cn(
              'border-t mx-2 pt-3 pb-2',
              collapsed && 'flex justify-center'
            )}
            style={{ borderColor: 'rgba(255,255,255,0.06)' }}
          >
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
            {!collapsed ? (
              <div className="flex items-center gap-2.5 px-1">
                <div className="relative group cursor-pointer shrink-0" onClick={triggerUpload} title="Alterar foto de perfil">
                  <img
                    src={user.avatar_url || user.avatar || '/images/logo-evokaa.png'}
                    alt="Avatar do usuario"
                    className="w-7 h-7 rounded-full object-cover ring-1 ring-white/10 group-hover:opacity-75 transition-opacity"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/45 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-white/80 font-medium truncate">{user.name || user.full_name || 'Usuario'}</div>
                  <div className="text-[9px] text-white/60 truncate">{user.email}</div>
                </div>
              </div>
            ) : (
              <div className="relative group cursor-pointer" onClick={triggerUpload} title="Alterar foto de perfil">
                <img
                  src={user.avatar_url || user.avatar || '/images/logo-evokaa.png'}
                  alt="Avatar do usuario"
                  className="w-7 h-7 rounded-full object-cover ring-1 ring-white/10 group-hover:opacity-75 transition-opacity"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/45 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bottom */}
        <div className="p-2 space-y-0.5 flex-shrink-0 flex flex-col gap-1">
          <ThemeToggle collapsed={collapsed} className="w-full text-white/40 hover:text-white/80" />
          <button
            onClick={handleLogout}
            className={cn(
              'flex items-center gap-3 rounded-lg transition-all w-full text-white/60 hover:text-red-400/80 hover:bg-red-500/[0.06]',
              collapsed ? 'justify-center px-0 py-2.5 mx-1' : 'px-3 py-2.5'
            )}
            title={collapsed ? 'Sair' : undefined}
          >
            <LogOut className="w-[17px] h-[17px] flex-shrink-0" />
            {!collapsed && <span className="text-[12.5px] font-medium">Sair</span>}
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className="absolute -right-3 top-[70px] w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110 z-50"
          style={{ background: 'linear-gradient(135deg, #1d68c4, #8f33f5)', color: 'white', boxShadow: '0 2px 8px rgba(143,51,245,0.4)' }}
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* Main Content (pb-24: o fim da página rola acima do Evo flutuante) */}
      <div
        className="flex-1 transition-all duration-300 min-h-screen pb-24"
        style={{ marginLeft: collapsed ? '68px' : '232px' }}
      >
        {/* Barra invisível do topo: só ícones à direita, numa faixa própria de 40 px (não cobre
            botões do cabeçalho das páginas, como "Novo Evento" do painel) */}
        <div className="sticky top-0 z-30 flex h-10 items-center justify-end px-4 pointer-events-none">
          <div className="glass-bar pointer-events-auto flex items-center gap-1 rounded-full border">
            <NotificationsTopButton className={botaoTopo} />
            <FeedbackTopButton className={botaoTopo} />
          </div>
        </div>
        <ErrorBoundary resetKey={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </div>
      <EvoHub />
      {/* O tour só abre no painel: antes ele aparecia em toda rota do produtor e cobria
          /producer/events/new, bloqueando o botão "Criar Evento" atrás do overlay. */}
      {(location.pathname === '/producer' || location.pathname === '/producer/dashboard') && (
        <OnboardingTour role="producer" onComplete={() => {}} />
      )}
    </div>
  )
}
