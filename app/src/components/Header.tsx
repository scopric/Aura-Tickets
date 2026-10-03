import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, UserPlus, LogOut, LayoutDashboard, ChevronDown } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { useAuth } from '../hooks/useAuth'
import { appUrl } from '../lib/appHost'
import { registerUrl } from '../lib/affiliateRef'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const location = useLocation()
  const isProducerRoute = location.pathname.startsWith('/producer')
  const { user, isAuthenticated, logout, role } = useAuth()

  // Fecha dropdown ao mudar de rota
  useEffect(() => {
    setShowUserMenu(false)
  }, [location.pathname])

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 30)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const isActive = (path: string) => location.pathname === path

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-out',
        isProducerRoute && 'hidden',
        // ponytail: /contato é a única página pública forçada no escuro com topo claro; ali o cabeçalho já nasce escuro.
        // bg-void segue o tema (escuro: #07080c; claro: branco): só /events (V11b) aparece nos dois temas
        isScrolled || location.pathname === '/contato'
          ? 'bg-void/80 backdrop-blur-xl shadow-sm'
          : 'bg-transparent'
      )}
    >
      <div className="max-w-6xl mx-auto pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] lg:pl-[max(2rem,env(safe-area-inset-left))] lg:pr-[max(2rem,env(safe-area-inset-right))]">
        <div className="flex items-center justify-between h-16 lg:h-[4.5rem]">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <img
              src="/images/logo-evokaa-sm.png"
              alt="Evokaa"
              className={cn(
                "w-auto transition-all duration-300 group-hover:scale-105",
                isScrolled
                  ? "h-8"
                  : "h-11 dark:filter dark:drop-shadow-[0_0_15px_rgba(29,104,196,0.45)] dark:drop-shadow-[0_0_5px_rgba(143,51,245,0.4)] dark:brightness-110"
              )}
            />
            {!isScrolled && (
              <span className="text-[10px] font-medium text-muted-foreground dark:text-white/60 tracking-widest uppercase hidden sm:block">
                Plataforma
              </span>
            )}
            {isScrolled && (
              <span className="text-[10px] font-medium text-muted-foreground dark:text-slate-400 tracking-widest uppercase hidden sm:block">
                Plataforma
              </span>
            )}
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {[
              { href: '/', label: 'Início' },
              { href: '/events', label: 'Eventos' },
              { href: '/app/download', label: 'App' },
              { href: '/contato', label: 'Contato' },
            ].map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  'relative px-4 py-2 text-[13px] font-medium transition-colors duration-300 rounded-full',
                  isActive(link.href)
                    ? 'text-primary dark:text-cyan-400'
                    : 'text-muted-foreground hover:text-foreground dark:text-white/60 dark:hover:text-white'
                )}
              >
                {isActive(link.href) && (
                  <span className={cn(
                    'absolute inset-0 rounded-full',
                    'bg-foreground/[0.06] dark:bg-white/[0.07]'
                  )} />
                )}
                <span className="relative">{link.label}</span>
              </Link>
            ))}
          </nav>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-2">
            {isAuthenticated && user ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className={cn(
                    'flex items-center gap-2 pl-1 pr-2 py-1 rounded-full transition-colors',
                    'hover:bg-foreground/5 dark:hover:bg-white/5'
                  )}
                >
                  <img
                    src={user.avatar_url || '/images/logo-evokaa-sm.png'}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200"
                  />
                  <span className={cn(
                    'text-[13px] font-medium max-w-[120px] truncate',
                    'text-foreground dark:text-white'
                  )}>
                    {user.full_name || user.email}
                  </span>
                  <ChevronDown className={cn(
                    'w-3.5 h-3.5 transition-transform',
                    showUserMenu && 'rotate-180',
                    'text-muted-foreground dark:text-white/60'
                  )} />
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-card border border-border rounded-2xl shadow-xl py-2 z-50">
                    <div className="px-4 py-2 border-b border-border mb-1">
                      <p className="text-xs font-medium text-foreground truncate">{user.full_name || user.email}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{role === 'producer' ? 'Produtor' : role === 'admin' ? 'Admin' : 'Participante'}</p>
                    </div>
                    <Link
                      to={role === 'admin' ? '/admin/dashboard' : role === 'producer' ? '/producer/dashboard' : '/app/hub'}
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
                  className={cn(
                    'text-[13px] py-2.5 px-5 font-medium rounded-full transition-all duration-300',
                    'text-foreground border border-input hover:bg-foreground/5 dark:text-white/80 dark:border-white/15 dark:hover:bg-white/5 dark:hover:border-white/25'
                  )}
                >
                  Entrar
                </Link>
                <Link
                  to={registerUrl(appUrl)}
                  className="text-[13px] py-2.5 px-5 font-semibold text-primary-foreground rounded-full transition-all duration-300 bg-primary dark:bg-[linear-gradient(135deg,#3b82f6,#8b5cf6)] hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:scale-[1.02] active:scale-[0.98]"
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
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Menu"
            aria-expanded={isMobileMenuOpen}
            className={cn(
              'md:hidden p-2',
              'text-foreground dark:text-white'
            )}
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={cn(
          'md:hidden overflow-hidden transition-all duration-500',
          isMobileMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="bg-card border-t border-border pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] py-6 space-y-1">
          {[
            { href: '/', label: 'Início' },
            { href: '/events', label: 'Eventos' },
            { href: '/app/download', label: 'App' },
            { href: '/contato', label: 'Contato' },
          ].map((link) => (
            <Link
              key={link.href}
              to={link.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className={cn(
                'flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                isActive(link.href)
                  ? 'bg-accent text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              {link.label}
            </Link>
          ))}
          <div className="flex gap-2 mt-4 pt-4 border-t border-border">
            {isAuthenticated && user ? (
              <>
                <Link
                  to={role === 'admin' ? '/admin/dashboard' : role === 'producer' ? '/producer/dashboard' : '/app/hub'}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-foreground border border-border rounded-full hover:bg-accent transition-all"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Meu Painel
                </Link>
                <button
                  onClick={() => { setIsMobileMenuOpen(false); logout() }}
                  className="flex-1 flex items-center justify-center py-3 text-sm font-medium text-destructive border border-destructive/40 rounded-full hover:bg-destructive/10 transition-all"
                >
                  <LogOut className="w-4 h-4 mr-1" />
                  Sair
                </button>
              </>
            ) : (
              <>
                <Link
                  to={appUrl('/auth/login')}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex-1 flex items-center justify-center py-3 text-sm font-medium text-foreground border border-border rounded-full hover:bg-accent transition-all"
                >
                  Entrar
                </Link>
                <Link
                  to={registerUrl(appUrl)}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex-1 flex items-center justify-center py-3 text-sm font-semibold text-primary-foreground rounded-full transition-all hover:shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
                >
                  Criar Conta
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
