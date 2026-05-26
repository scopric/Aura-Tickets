import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Calendar, Heart, Ticket, ShoppingCart, MessageCircle,
  Bell, Settings, LogOut, ChevronLeft, ChevronRight, Search, User
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const navItems = [
  { to: '/app/hub', icon: LayoutDashboard, label: 'Inicio' },
  { to: '/app/tickets', icon: Ticket, label: 'Meus Ingressos' },
  { to: '/app/events', icon: Calendar, label: 'Eventos' },
  { to: '/app/favorites', icon: Heart, label: 'Favoritos' },
  { to: '/app/orders', icon: ShoppingCart, label: 'Compras' },
  { to: '/app/chat', icon: MessageCircle, label: 'Chat' },
  { to: '/app/notifications', icon: Bell, label: 'Notificacoes' },
  { to: '/app/profile', icon: User, label: 'Perfil' },
  { to: '/app/settings', icon: Settings, label: 'Configuracoes' },
]

const notifications = [
  { id: 1, text: 'Seu evento Noite Eletro comeca em 2h!', time: '10 min', unread: true },
  { id: 2, text: 'Ingresso VIP confirmado', time: '1h', unread: true },
  { id: 3, text: 'Novo evento: Jazz Sunset', time: '3h', unread: false },
]

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [showNotifs, setShowNotifs] = useState(false)
  const { user, logout } = useAuth()
  const location = useLocation()
  const unreadCount = notifications.filter(n => n.unread).length

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--cream)' }}>
      {/* Sidebar */}
      <aside
        className="fixed left-0 top-0 h-screen z-40 flex flex-col border-r transition-all duration-300"
        style={{
          width: collapsed ? '68px' : '220px',
          background: 'rgba(247,245,240,0.85)',
          backdropFilter: 'blur(24px)',
          borderColor: 'rgba(255,255,255,0.6)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-16 flex-shrink-0">
          {collapsed ? (
            <img src="/images/logo-evokaa.png" alt="Evokaa" className="h-8 w-auto mx-auto" />
          ) : (
            <img src="/images/logo-evokaa.png" alt="Evokaa" className="h-12 w-auto" />
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map(item => {
            const isActive = location.pathname === item.to
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${isActive ? 'bg-plum/10 text-plum' : 'text-espresso/40 hover:text-espresso/70 hover:bg-white/40'}`}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
                {item.to === '/app/notifications' && unreadCount > 0 && !collapsed && (
                  <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-plum text-cream">{unreadCount}</span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div className="px-2.5 py-3 flex-shrink-0">
          <div className={`flex items-center gap-2.5 p-2 rounded-xl ${collapsed ? 'justify-center' : ''}`} style={{ background: 'rgba(122,59,105,0.05)' }}>
            <img src={user?.avatar || '/images/avatar-default.jpg'} alt="Avatar do usuario" className="w-8 h-8 rounded-full object-cover ring-2 ring-plum/20 flex-shrink-0" />
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-espresso truncate">{user?.name}</div>
                <div className="text-[9px] text-espresso/30 capitalize">{user?.role === 'user' ? 'Participante' : user?.role === 'producer' ? 'Produtor' : 'Admin'}</div>
              </div>
            )}
          </div>
          <button onClick={() => { logout() }} className={`flex items-center gap-2 px-3 py-2 mt-1 rounded-xl text-xs text-espresso/30 hover:text-red-500 hover:bg-red-50 transition-all ${collapsed ? 'justify-center w-full' : ''}`}>
            <LogOut className="w-4 h-4" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>

        {/* Toggle */}
        <button onClick={() => setCollapsed(!collapsed)} className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-plum text-cream flex items-center justify-center shadow-md">
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* Main Content */}
      <div className="flex-1 transition-all duration-300" style={{ marginLeft: collapsed ? '68px' : '220px' }}>
        {/* Header */}
        <header className="sticky top-0 z-30 h-16 flex items-center justify-between px-6" style={{ background: 'rgba(247,245,240,0.8)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.6)' }}>
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-espresso/20" />
            <input type="text" placeholder="Buscar eventos..." className="w-full pl-9 pr-4 py-2 bg-white/60 border border-white/60 rounded-full text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowNotifs(!showNotifs)} className="relative p-2 rounded-xl hover:bg-white/40 transition-colors">
              <Bell className="w-4 h-4 text-espresso/50" />
              {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />}
            </button>
            <img src={user?.avatar || '/images/avatar-default.jpg'} alt="Avatar do usuario" className="w-8 h-8 rounded-full object-cover ring-2 ring-plum/20" />
          </div>
        </header>

        {/* Notifications Dropdown */}
        {showNotifs && (
          <div className="fixed top-16 right-6 z-40 w-80 bg-white/80 backdrop-blur-xl border border-white/60 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-espresso/5 flex items-center justify-between">
              <h3 className="text-sm font-medium text-espresso">Notificacoes</h3>
              <button onClick={() => setShowNotifs(false)} className="text-xs text-plum hover:underline">Marcar como lidas</button>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {notifications.map(n => (
                <div key={n.id} className={`p-3 border-b border-espresso/3 last:border-0 ${n.unread ? 'bg-plum/5' : ''}`}>
                  <p className="text-xs text-espresso">{n.text}</p>
                  <p className="text-[10px] text-espresso/30 mt-0.5">{n.time}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <main className="p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
