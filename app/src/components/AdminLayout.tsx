import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ErrorBoundary } from './error-boundary'
import {
  LayoutDashboard,
  Users,
  Calendar,
  DollarSign,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
  LogOut,
  Handshake,
  BarChart3,
  Ticket,
  MessageSquarePlus,
  MessageCircle,
  Mail,
  Camera,
  TicketPercent,
  Bot,
  Armchair,
  BookOpen,
  Menu,
} from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { useAuth } from '../hooks/useAuth'
import ThemeToggle from './ThemeToggle'
import NotificationsTopButton from './NotificationsTopButton'
import FeedbackTopButton from './FeedbackTopButton'
import { uploadAvatar } from '../lib/avatarUpload'
import { supabase } from '../lib/supabase'
import { bipe } from '../hooks/useConversas'

const botaoTopo = 'rounded-full p-2 text-foreground hover:bg-slate-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const navItems = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/users', icon: Users, label: 'Usuários', permission: 'manage_users' },
  { to: '/admin/producers', icon: Shield, label: 'Produtores', permission: 'manage_users' },
  { to: '/admin/affiliates', icon: Handshake, label: 'Afiliados Evokaa', permission: 'manage_affiliates' },
  { to: '/admin/events', icon: Calendar, label: 'Eventos', permission: 'manage_events' },
  { to: '/admin/finance', icon: DollarSign, label: 'Financeiro', permission: 'manage_finance' },
  { to: '/admin/analytics', icon: BarChart3, label: 'Analytics', permission: 'view_analytics' },
  { to: '/admin/tickets', icon: Ticket, label: 'Ingressos', permission: 'manage_tickets' },
  { to: '/admin/newsletter', icon: Mail, label: 'Newsletter', permission: 'manage_newsletter' },
  { to: '/admin/coupons', icon: TicketPercent, label: 'Cupons', permission: 'manage_coupons' },
  { to: '/admin/team', icon: Users, label: 'Equipe', permission: 'manage_team' },
  { to: '/admin/feedback', icon: MessageSquarePlus, label: 'Feedback', permission: 'manage_feedback' },
  { to: '/admin/atendimento', icon: MessageCircle, label: 'Atendimento', permission: 'manage_support' },
  { to: '/admin/match-de-mesa', icon: Armchair, label: 'Match de Mesa', permission: 'moderate_mesa' },
  { to: '/admin/conhecimento', icon: BookOpen, label: 'Conhecimento', permission: 'manage_support' },
  { to: '/admin/ia', icon: Bot, label: 'IA / Evo', permission: 'manage_settings' },
  { to: '/admin/settings', icon: Settings, label: 'Configurações', permission: 'manage_settings' },
]

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false)
  // Celular e tablet (abaixo de lg): a barra lateral vira gaveta, fechada por padrão
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const isActive = (path: string) => location.pathname === path

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

  const handleLogout = () => {
    toast.info('Voce saiu da sua conta')
    logout()
    // Nao chamar navigate('/') aqui — o logout ja faz window.location.href = '/'
  }

  // Contador de conversas abertas COM A EQUIPE ao lado de "Atendimento" (as do assistente ficam de fora):
  // o canal abaixo atualiza na hora; o polling de 60 s é reserva
  const podeAtender = !!user?.admin_permissions?.some((p) => p === 'manage_support' || p === 'super_admin')
  const { data: abertas } = useQuery({
    queryKey: ['chat-abertas'],
    enabled: podeAtender,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase.from('conversations' as never).select('id', { count: 'exact', head: true }).eq('status', 'open').eq('bot_state', 'humano')
      if (error) throw error
      return count ?? 0
    },
  })

  // Som de mensagem em qualquer página do alpha (não só no Atendimento): um canal só, INSERT de mensagens
  // de conversa COM A EQUIPE (bot_state da mensagem = estado da conversa quando ela chegou; a RLS limita
  // ao que a pessoa atende): mensagem do cliente e o aviso de passagem do assistente ("system").
  // Mensagem do cliente enquanto o assistente atende não toca. Atualiza o contador na hora.
  const qc = useQueryClient()
  const uid = user?.id
  useEffect(() => {
    if (!podeAtender) return
    const canal = supabase
      .channel(`admin-chat-som-${crypto.randomUUID()}`)
      .on<{ sender_role: string; is_internal: boolean; sender_id: string | null; bot_state: string | null }>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversation_messages', filter: 'bot_state=eq.humano' },
        ({ new: m }) => {
          if ((m.sender_role !== 'customer' && m.sender_role !== 'system') || m.bot_state !== 'humano' || m.is_internal || m.sender_id === uid) return
          bipe([659.25, 987.77])
          qc.invalidateQueries({ queryKey: ['chat-abertas'] })
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [podeAtender, uid, qc])

  // Gaveta aberta: foco no 1º item; Esc fecha e devolve o foco ao botão de menu
  useEffect(() => {
    if (!mobileOpen) return
    navRef.current?.querySelector('a')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setMobileOpen(false)
      menuBtnRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  const filteredNavItems = navItems.filter((item) => {
    if (!item.permission) return true
    return (
      user?.admin_permissions?.includes(item.permission) ||
      user?.admin_permissions?.includes('super_admin')
    )
  })

  return (
    <div className="flex min-h-screen glass-canvas">
      {mobileOpen && (
        <div
          className="fixed inset-0 glass-backdrop z-40 lg:hidden"
          onClick={() => {
            setMobileOpen(false)
            menuBtnRef.current?.focus()
          }}
        />
      )}

      {/* No celular a gaveta fecha fora da tela e fica invisível (sai da ordem do Tab); no computador, como antes */}
      <aside
        id="admin-menu"
        className={cn(
          'fixed left-0 top-0 bottom-0 z-50 lg:z-40 glass-bar border-r transition-all duration-300 flex flex-col',
          'lg:translate-x-0',
          // ao abrir, a visibilidade muda na hora (sem transição), para o foco poder entrar na gaveta
          mobileOpen ? 'translate-x-0 max-lg:[transition-property:transform]' : '-translate-x-full max-lg:invisible',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        {/* Logo */}
        <div className={cn('flex items-center gap-3 px-4 h-16 border-b border-white/10', collapsed && 'justify-center px-2')}>
          <img
            src="/images/logo-evokaa-sm.png"
            alt="Evokaa"
            className={cn("w-auto flex-shrink-0 transition-all", collapsed ? "h-7" : "h-11")}
          />
          {!collapsed && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white tracking-wide">Admin</span>
              <span className="text-[10px] text-purple-400 font-semibold uppercase tracking-wider bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">Evokaa</span>
            </div>
          )}
        </div>

        {/* no celular, a visibilidade dos links não passa por transição (herdam a da gaveta), senão o foco ao abrir falha */}
        <nav ref={navRef} className="max-lg:[&_a]:[transition-property:color,background-color,border-color,box-shadow] min-h-0 flex-1 py-4 px-2 space-y-1 overflow-y-auto sidebar-dark-scroll">
          {filteredNavItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all duration-200 font-medium',
                collapsed ? 'justify-center' : '',
                isActive(item.to)
                  ? 'bg-purple-500/15 text-purple-300 shadow-[inset_0_0_0_1px_rgba(168,85,247,0.25)] border-l-2 border-purple-500 rounded-l-none'
                  : 'text-white/70 hover:text-white hover:bg-white/[0.06]'
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
              {!collapsed && item.to === '/admin/atendimento' && !!abertas && (
                <span className="ml-auto rounded-full bg-purple-600 px-1.5 text-[10px] font-bold leading-4 text-[#fff]">
                  {abertas}<span className="sr-only"> conversas abertas</span>
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* User */}
        {user && (
          <div className={cn('px-3 py-3 border-t border-white/10', collapsed && 'flex justify-center')}>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
            {!collapsed ? (
              <div className="flex items-center gap-3">
                <div className="relative group cursor-pointer" onClick={triggerUpload} title="Alterar foto de perfil">
                  <img src={user.avatar_url || user.avatar || '/images/logo-evokaa-sm.png'} alt="Avatar do usuário" className="w-8 h-8 rounded-full object-cover ring-2 ring-white/10 group-hover:opacity-75 transition-opacity" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/45 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white font-medium truncate">{user.name || user.full_name || 'Usuário'}</div>
                  <div className="text-[10px] text-white/45 truncate">{user.email}</div>
                </div>
              </div>
            ) : (
              <div className="relative group cursor-pointer" onClick={triggerUpload} title="Alterar foto de perfil">
                <img src={user.avatar_url || user.avatar || '/images/logo-evokaa-sm.png'} alt="Avatar do usuário" className="w-8 h-8 rounded-full object-cover ring-2 ring-white/10 group-hover:opacity-75 transition-opacity" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/45 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="p-2 border-t border-white/10 space-y-1 flex flex-col gap-1">
          <ThemeToggle collapsed={collapsed} className="w-full text-white/40 hover:text-white/80" />
          <button
            onClick={handleLogout}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-white/40 hover:text-red-400 hover:bg-red-500/[0.08] transition-all w-full font-medium',
              collapsed && 'justify-center'
            )}
          >
            <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>

        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full text-white hidden lg:flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-50"
          style={{ background: 'linear-gradient(135deg, #1d68c4, #8f33f5)', color: 'white', boxShadow: '0 2px 8px rgba(143,51,245,0.4)' }}
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      <div className={cn('min-w-0 flex-1 transition-all duration-300 min-h-screen', collapsed ? 'lg:ml-16' : 'lg:ml-60')}>
        {/* Barra do topo fixa ao rolar (ocupa os 64 px que antes eram só pt-16): sino e feedback numa cápsula de vidro */}
        <div className="sticky top-0 z-30 flex h-16 items-center justify-between lg:justify-end px-4 pointer-events-none">
          <button
            ref={menuBtnRef}
            type="button"
            onClick={() => {
              setCollapsed(false) // a gaveta abre sempre com os nomes (no celular não há seta para expandir)
              setMobileOpen((o) => !o)
            }}
            aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={mobileOpen}
            aria-controls="admin-menu"
            className="glass-bar pointer-events-auto rounded-full border p-2.5 text-foreground lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="glass-bar pointer-events-auto flex items-center gap-1 rounded-full border p-0.5">
            <NotificationsTopButton className={botaoTopo} />
            <FeedbackTopButton className={botaoTopo} />
          </div>
        </div>
        <ErrorBoundary resetKey={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </div>
    </div>
  )
}
