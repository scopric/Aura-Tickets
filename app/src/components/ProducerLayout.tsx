import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
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
  Palette, BarChart3
} from 'lucide-react'
import OnboardingTour from '../components/OnboardingTour'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'sonner'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface SubItem {
  to: string
  icon: React.ElementType
  label: string
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
    id: 'events', icon: Calendar, label: 'Eventos', color: '#c49ab8',
    items: [
      { to: '/producer/events', icon: Calendar, label: 'Meus Eventos' },
      { to: '/producer/planner', icon: Sparkles, label: 'Criar Evento' },
      { to: '/producer/event-manager', icon: FolderOpen, label: 'Pasta do Evento' },
      { to: '/producer/ingressos-avancados', icon: Receipt, label: 'Ingressos+' },
      { to: '/producer/lugar-marcado', icon: Armchair, label: 'Lugar Marcado' },
      { to: '/producer/certificados', icon: Award, label: 'Certificados' },
      { to: '/producer/timeline', icon: Clock, label: 'Cronograma' },
      { to: '/producer/pos-evento', icon: BarChart2, label: 'Rel. Pos-Evento' },
      { to: '/producer/brand', icon: Palette, label: 'Brand Studio' },
      { to: '/producer/menu', icon: Wine, label: 'Cardapio' },
    ]
  },
  {
    id: 'sales', icon: Megaphone, label: 'Vendas & Marketing', color: '#f59e0b',
    items: [
      { to: '/producer/aura-store', icon: ShoppingBag, label: 'Evokaa Store' },
      { to: '/producer/lista-interesse', icon: FileText, label: 'Lista de Interesse' },
      { to: '/producer/cupons', icon: TicketPercent, label: 'Cupons' },
      { to: '/producer/afiliados', icon: Users, label: 'Afiliados' },
      { to: '/producer/marketing', icon: Megaphone, label: 'Marketing' },
      { to: '/producer/crm', icon: Users, label: 'CRM Pipeline' },
      { to: '/producer/banners', icon: Images, label: 'Banners' },
    ]
  },
  {
    id: 'finance', icon: Banknote, label: 'Financeiro', color: '#22c55e',
    items: [
      { to: '/producer/wallet', icon: Wallet, label: 'Carteira' },
      { to: '/producer/finance', icon: BarChart3, label: 'Financeiro' },
      { to: '/producer/bordero', icon: Award, label: 'Bordero' },
      { to: '/producer/antecipacao', icon: Zap, label: 'Antecipacao' },
      { to: '/producer/parcelamento', icon: CreditCard, label: 'Parcelamento' },
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
      { to: '/producer/assinatura', icon: Crown, label: 'Assinatura' },
      { to: '/producer/faq', icon: HelpCircle, label: 'Ajuda' },
      { to: '/producer/settings', icon: Settings, label: 'Configuracoes' },
    ]
  },
]

function SubMenuGroup({ group, collapsed, expandedGroup, toggleGroup, isActivePath }: {
  group: MenuGroup
  collapsed: boolean
  expandedGroup: string | null
  toggleGroup: (id: string) => void
  isActivePath: (path: string) => boolean
}) {
  const isExpanded = expandedGroup === group.id
  const hasActiveChild = group.items.some(i => isActivePath(i.to))

  if (collapsed) {
    return (
      <div className="relative group/menu">
        <button
          onClick={() => {}}
          className={cn(
            'flex items-center justify-center w-full rounded-lg transition-all py-2.5 mx-1',
            hasActiveChild
              ? 'text-white'
              : 'text-white/35 hover:text-white/75 hover:bg-white/[0.04]'
          )}
          style={hasActiveChild ? { background: 'rgba(122,59,105,0.2)' } : {}}
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
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-white/30 mb-1">{group.label}</div>
          {group.items.map(item => (
            <Link key={item.to} to={item.to}
              className={cn(
                'flex items-center gap-2 px-3 py-2 text-[11px] transition-all',
                isActivePath(item.to) ? 'text-white bg-white/[0.06]' : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
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
            : 'text-white/35 hover:text-white/75 hover:bg-white/[0.04]'
        )}
        style={hasActiveChild ? { background: 'rgba(122,59,105,0.15)' } : {}}
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
                  : 'text-white/25 hover:text-white/60 hover:bg-white/[0.03]'
              )}
              style={isActivePath(item.to) ? { background: 'rgba(122,59,105,0.12)' } : {}}
            >
              <item.icon
                className="w-3.5 h-3.5 flex-shrink-0"
                style={{ color: isActivePath(item.to) ? '#c49ab8' : undefined }}
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
    <div className="flex min-h-screen" style={{ background: 'var(--canvas)' }}>
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 bottom-0 z-40 flex flex-col transition-all duration-300 ease-out',
          collapsed ? 'w-[68px]' : 'w-[232px]'
        )}
        style={{ background: 'var(--void)' }}
      >
        {/* Logo area */}
        <div className={cn(
          'flex items-center gap-3 h-16 border-b flex-shrink-0',
          collapsed ? 'justify-center px-0' : 'px-5'
        )}
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        >
          <img src="/images/logo-evokaa.png" alt="Evokaa" className="h-6 w-auto" />
          {!collapsed && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white/90 tracking-wide">Painel</span>
              <span
                className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(122,59,105,0.25)', color: '#c49ab8', border: '1px solid rgba(122,59,105,0.3)' }}
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
                : 'text-white/35 hover:text-white/75 hover:bg-white/[0.04]'
            )}
            style={isActivePath('/producer/dashboard') ? { background: 'rgba(122,59,105,0.2)' } : {}}
            title={collapsed ? 'Dashboard' : undefined}
          >
            <LayoutDashboard
              className={cn(
                'flex-shrink-0 transition-transform duration-200',
                collapsed ? 'w-[18px] h-[18px]' : 'w-[17px] h-[17px]',
                isActivePath('/producer/dashboard') && 'scale-110'
              )}
              style={{ color: isActivePath('/producer/dashboard') ? '#c49ab8' : undefined }}
            />
            {!collapsed && <span className="text-[12.5px] font-medium tracking-wide">Dashboard</span>}
          </Link>

          {/* Menu Groups */}
          {menuGroups.map(group => (
            <SubMenuGroup
              key={group.id}
              group={group}
              collapsed={collapsed}
              expandedGroup={expandedGroup}
              toggleGroup={toggleGroup}
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
            {!collapsed ? (
              <div className="flex items-center gap-2.5 px-1">
                <img
                  src={user.avatar || '/images/logo-evokaa.png'}
                  alt="Avatar do usuario"
                  className="w-7 h-7 rounded-full object-cover ring-1 ring-white/10"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-white/80 font-medium truncate">{user.name || user.full_name || 'Usuario'}</div>
                  <div className="text-[9px] text-white/20 truncate">{user.email}</div>
                </div>
              </div>
            ) : (
              <img
                src={user.avatar || '/images/logo-evokaa.png'}
                alt="Avatar do usuario"
                className="w-7 h-7 rounded-full object-cover ring-1 ring-white/10"
              />
            )}
          </div>
        )}

        {/* Bottom */}
        <div className="p-2 space-y-0.5 flex-shrink-0">
          <button
            onClick={handleLogout}
            className={cn(
              'flex items-center gap-3 rounded-lg transition-all w-full text-white/20 hover:text-red-400/80 hover:bg-red-500/[0.06]',
              collapsed ? 'justify-center px-0 py-2' : 'px-3 py-2'
            )}
            title={collapsed ? 'Sair' : undefined}
          >
            <LogOut className="w-[17px] h-[17px] flex-shrink-0" />
            {!collapsed && <span className="text-[12px]">Sair</span>}
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-[70px] w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110 z-50"
          style={{ background: 'var(--plum)', color: 'var(--cream)', boxShadow: '0 2px 8px rgba(122,59,105,0.4)' }}
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* Main Content */}
      <div
        className="flex-1 transition-all duration-300 min-h-screen"
        style={{ marginLeft: collapsed ? '68px' : '232px' }}
      >
        <Outlet />
      </div>
      <OnboardingTour role="producer" onComplete={() => {}} />
    </div>
  )
}
