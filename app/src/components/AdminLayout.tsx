import { Outlet, Link, useLocation, useNavigate } from 'react-router'
import { useState } from 'react'
import { toast } from 'sonner'
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
  BarChart3,
  Ticket,
  MessageSquarePlus,
} from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { useAuth } from '../contexts/AuthContext'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const navItems = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/users', icon: Users, label: 'Usuarios' },
  { to: '/admin/producers', icon: Shield, label: 'Produtores' },
  { to: '/admin/events', icon: Calendar, label: 'Eventos' },
  { to: '/admin/finance', icon: DollarSign, label: 'Financeiro' },
  { to: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/admin/tickets', icon: Ticket, label: 'Ingressos' },
  { to: '/admin/feedback', icon: MessageSquarePlus, label: 'Feedback' },
  { to: '/admin/settings', icon: Settings, label: 'Configuracoes' },
]

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const isActive = (path: string) => location.pathname === path

  const handleLogout = () => {
    toast.info('Voce saiu da sua conta')
    logout()
    navigate('/')
  }

  return (
    <div className="flex min-h-screen bg-canvas pt-16">
      <aside
        className={cn(
          'fixed left-0 top-0 bottom-0 z-40 bg-[#1a1118] border-r border-white/10 transition-all duration-300 flex flex-col',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        {/* Logo */}
        <div className={cn('flex items-center gap-3 px-4 h-16 border-b border-white/10', collapsed && 'justify-center px-2')}>
          <img src="/images/logo-aura.png" alt="Aura" className="h-7 w-auto flex-shrink-0" />
          {!collapsed && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white tracking-wide">Admin</span>
              <span className="text-[10px] text-rose-400 font-semibold uppercase tracking-wider bg-rose-500/20 px-2 py-0.5 rounded-full border border-rose-500/30">Aura</span>
            </div>
          )}
        </div>

        <nav className="flex-1 py-4 px-2 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all duration-200 font-medium',
                collapsed ? 'justify-center' : '',
                isActive(item.to)
                  ? 'bg-rose-500/20 text-rose-400 shadow-[inset_0_0_0_1px_rgba(244,63,94,0.3)]'
                  : 'text-white/70 hover:text-white hover:bg-white/[0.06]'
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          ))}
        </nav>

        {/* User */}
        {user && (
          <div className={cn('px-3 py-3 border-t border-white/10', collapsed && 'flex justify-center')}>
            {!collapsed ? (
              <div className="flex items-center gap-3">
                <img src={user.avatar} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-white/10" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white font-medium truncate">{user.name}</div>
                  <div className="text-[10px] text-white/30 truncate">{user.email}</div>
                </div>
              </div>
            ) : (
              <img src={user.avatar} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-white/10" />
            )}
          </div>
        )}

        <div className="p-2 border-t border-white/10 space-y-1">
          <Link
            to="/admin/settings"
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-white/50 hover:text-white/90 hover:bg-white/[0.06] transition-all w-full font-medium',
              collapsed && 'justify-center'
            )}
          >
            <Settings className="w-[18px] h-[18px] flex-shrink-0" />
            {!collapsed && <span>Config</span>}
          </Link>
          <button
            onClick={handleLogout}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-white/50 hover:text-red-400 hover:bg-red-500/[0.08] transition-all w-full font-medium',
              collapsed && 'justify-center'
            )}
          >
            <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-rose-500 text-cream flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-50"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      <div className={cn('flex-1 transition-all duration-300 min-h-screen', collapsed ? 'ml-16' : 'ml-60')}>
        <Outlet />
      </div>
    </div>
  )
}
