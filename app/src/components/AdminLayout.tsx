import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useRef } from 'react'
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
  MessageCircle,
  Mail,
  Camera,
} from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { useAuth } from '../hooks/useAuth'
import ThemeToggle from './ThemeToggle'
import { uploadAvatar } from '../lib/avatarUpload'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const navItems = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/users', icon: Users, label: 'Usuarios', permission: 'manage_users' },
  { to: '/admin/producers', icon: Shield, label: 'Produtores', permission: 'manage_users' },
  { to: '/admin/events', icon: Calendar, label: 'Eventos', permission: 'manage_events' },
  { to: '/admin/finance', icon: DollarSign, label: 'Financeiro', permission: 'manage_finance' },
  { to: '/admin/analytics', icon: BarChart3, label: 'Analytics', permission: 'view_analytics' },
  { to: '/admin/tickets', icon: Ticket, label: 'Ingressos', permission: 'manage_tickets' },
  { to: '/admin/newsletter', icon: Mail, label: 'Newsletter', permission: 'manage_newsletter' },
  { to: '/admin/team', icon: Users, label: 'Equipe', permission: 'manage_team' },
  { to: '/admin/feedback', icon: MessageSquarePlus, label: 'Feedback', permission: 'manage_feedback' },
  { to: '/admin/support', icon: MessageCircle, label: 'Chat Suporte', permission: 'manage_feedback' },
  { to: '/admin/settings', icon: Settings, label: 'Configuracoes', permission: 'manage_settings' },
]

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false)
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

  const filteredNavItems = navItems.filter((item) => {
    if (!item.permission) return true
    return (
      user?.admin_permissions?.includes(item.permission) ||
      user?.admin_permissions?.includes('super_admin')
    )
  })

  return (
    <div className="flex min-h-screen bg-canvas pt-16">
      <aside
        className={cn(
          'fixed left-0 top-0 bottom-0 z-40 bg-[#07080c]/80 backdrop-blur-xl border-r border-white/[0.05] transition-all duration-300 flex flex-col',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        {/* Logo */}
        <div className={cn('flex items-center gap-3 px-4 h-16 border-b border-white/10', collapsed && 'justify-center px-2')}>
          <img
            src="/images/logo-evokaa.png"
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

        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto max-h-[calc(100vh-10rem)] sidebar-dark-scroll">
          {filteredNavItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
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
                  <img src={user.avatar_url || user.avatar || '/images/logo-evokaa.png'} alt="Avatar do usuario" className="w-8 h-8 rounded-full object-cover ring-2 ring-white/10 group-hover:opacity-75 transition-opacity" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/45 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white font-medium truncate">{user.name || user.full_name || 'Usuario'}</div>
                  <div className="text-[10px] text-white/45 truncate">{user.email}</div>
                </div>
              </div>
            ) : (
              <div className="relative group cursor-pointer" onClick={triggerUpload} title="Alterar foto de perfil">
                <img src={user.avatar_url || user.avatar || '/images/logo-evokaa.png'} alt="Avatar do usuario" className="w-8 h-8 rounded-full object-cover ring-2 ring-white/10 group-hover:opacity-75 transition-opacity" />
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
          className="absolute -right-3 top-20 w-6 h-6 rounded-full text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-50"
          style={{ background: 'linear-gradient(135deg, #1d68c4, #8f33f5)', color: 'white', boxShadow: '0 2px 8px rgba(143,51,245,0.4)' }}
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
