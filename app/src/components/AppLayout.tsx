import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Calendar, Heart, Ticket, ShoppingCart, MessageCircle,
  Bell, Settings, LogOut, ChevronLeft, ChevronRight, Search, User, Loader2,
  Menu
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useUserNotifications, useMarkAllNotificationsRead } from '../hooks/useNotifications'
import { cn } from '../lib/utils'

const navItems = [
  { to: '/app/hub', icon: LayoutDashboard, label: 'Início' },
  { to: '/app/tickets', icon: Ticket, label: 'Meus Ingressos' },
  { to: '/app/events', icon: Calendar, label: 'Eventos' },
  { to: '/app/favorites', icon: Heart, label: 'Favoritos' },
  { to: '/app/orders', icon: ShoppingCart, label: 'Compras' },
  { to: '/app/chat', icon: MessageCircle, label: 'Chat' },
  { to: '/app/notifications', icon: Bell, label: 'Notificações' },
  { to: '/app/profile', icon: User, label: 'Perfil' },
  { to: '/app/settings', icon: Settings, label: 'Configurações' },
]

function formatTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Agora'
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showNotifs, setShowNotifs] = useState(false)
  const { user, logout } = useAuth()
  const location = useLocation()

  const { data: notifications = [], isLoading: isNotifLoading } = useUserNotifications()
  const markAllRead = useMarkAllNotificationsRead()

  const unreadCount = notifications.filter((n: any) => !n.is_read).length

  const handleMarkAllRead = () => {
    markAllRead.mutate()
    setShowNotifs(false)
  }

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/')

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 bottom-0 z-50 flex flex-col transition-all duration-300 ease-out',
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'w-[72px]' : 'w-[250px]'
        )}
        style={{ background: 'var(--void)' }}
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
            src="/images/logo-evokaa.png"
            alt="Evokaa"
            className="h-7 w-auto object-contain"
          />
          {!collapsed && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white/90 tracking-wide">Evokaa</span>
              <span
                className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{
                  background: 'rgba(59,130,246,0.25)',
                  color: '#60a5fa',
                  border: '1px solid rgba(59,130,246,0.3)',
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
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg transition-all duration-200',
                  collapsed ? 'justify-center px-0 py-2.5 mx-1' : 'px-3 py-2',
                  active
                    ? 'text-white'
                    : 'text-white/60 hover:text-white/90 hover:bg-white/[0.04]'
                )}
                style={active ? { background: 'rgba(59,130,246,0.2)' } : {}}
                title={collapsed ? item.label : undefined}
              >
                <item.icon
                  className={cn(
                    'flex-shrink-0 transition-transform duration-200',
                    collapsed ? 'w-[18px] h-[18px]' : 'w-[17px] h-[17px]',
                    active && 'scale-110'
                  )}
                  style={{ color: active ? '#c49ab8' : undefined }}
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
            {!collapsed ? (
              <div className="flex items-center gap-2.5 px-1">
                <img
                  src={user.avatar || '/images/avatar-default.jpg'}
                  alt="Avatar"
                  className="w-8 h-8 rounded-full object-cover ring-1 ring-white/10"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-white/80 font-medium truncate">
                    {user.name || user.full_name || 'Usuário'}
                  </div>
                  <div className="text-[10px] text-white/25 truncate">{user.email}</div>
                </div>
              </div>
            ) : (
              <img
                src={user.avatar || '/images/avatar-default.jpg'}
                alt="Avatar"
                className="w-8 h-8 rounded-full object-cover ring-1 ring-white/10"
              />
            )}
          </div>
        )}

        {/* Logout */}
        <div className="p-2 flex-shrink-0">
          <button
            onClick={logout}
            className={cn(
              'flex items-center gap-3 rounded-lg transition-all w-full text-white/20 hover:text-red-400/80 hover:bg-red-500/[0.06]',
              collapsed ? 'justify-center px-0 py-2' : 'px-3 py-2'
            )}
            title={collapsed ? 'Sair' : undefined}
          >
            <LogOut className="w-[17px] h-[17px] flex-shrink-0" />
            {!collapsed && <span className="text-[13px]">Sair</span>}
          </button>
        </div>

        {/* Collapse toggle (desktop only) */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-[70px] w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110 z-50 hidden lg:flex"
          style={{
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            color: 'white',
            boxShadow: '0 2px 8px rgba(59,130,246,0.4)',
          }}
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* Main Content */}
      <div
        className={cn(
          'flex-1 flex flex-col min-h-screen transition-all duration-300',
          'lg:ml-[72px]',
          !collapsed && 'lg:ml-[250px]'
        )}
      >
        {/* Header */}
        <header
          className="sticky top-0 z-30 h-16 flex items-center justify-between px-6 border-b"
          style={{
            background: 'rgba(248,250,252,0.9)',
            backdropFilter: 'blur(16px)',
            borderColor: 'rgba(255,255,255,0.6)',
          }}
        >
          <div className="flex items-center gap-4">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <Menu className="w-5 h-5 text-slate-500" />
            </button>

            {/* Search */}
            <div className="relative w-72 max-w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar eventos..."
                className="w-full pl-9 pr-4 py-2 bg-white/70 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifs(!showNotifs)}
                className="relative p-2.5 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <Bell className="w-5 h-5 text-slate-900/50" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white" />
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifs && (
                <div className="absolute right-0 top-full mt-2 w-96 bg-white/90 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl overflow-hidden z-50">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">Notificações</h3>
                    <button
                      onClick={handleMarkAllRead}
                      disabled={markAllRead.isPending || unreadCount === 0}
                      className="text-xs text-blue-500 hover:underline disabled:opacity-40 font-medium"
                    >
                      {markAllRead.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        'Marcar como lidas'
                      )}
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {isNotifLoading ? (
                      <div className="p-6 text-center">
                        <Loader2 className="w-5 h-5 text-blue-500 animate-spin mx-auto" />
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="p-6 text-center text-sm text-slate-900/40">
                        Nenhuma notificação
                      </div>
                    ) : (
                      notifications.map((n: any) => (
                        <div
                          key={n.id}
                          className={cn(
                            'p-3 border-b border-slate-100 last:border-0 transition-colors',
                            !n.is_read ? 'bg-blue-500/5' : ''
                          )}
                        >
                          <p className="text-sm text-slate-900 font-medium">{n.title}</p>
                          {n.message && (
                            <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                          )}
                          <p className="text-[11px] text-slate-400 mt-1">{formatTimeAgo(n.created_at)}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Avatar */}
            <img
              src={user?.avatar || '/images/avatar-default.jpg'}
              alt="Avatar"
              className="w-9 h-9 rounded-full object-cover ring-2 ring-blue-500/20"
            />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 lg:p-10 max-w-[1440px] mx-auto w-full">
          <Outlet />
        </main>
      </div>

    </div>
  )
}
