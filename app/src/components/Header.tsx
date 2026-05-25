import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, UserPlus, LogOut, LayoutDashboard, ChevronDown } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { useAuth } from '../contexts/AuthContext'

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
        isScrolled
          ? 'bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm'
          : 'bg-transparent'
      )}
    >
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-[4.5rem]">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <img
              src="/images/logo-evokaa.png"
              alt="Evokaa"
              className="h-8 w-auto transition-transform duration-300 group-hover:scale-105"
            />
            {!isScrolled && (
              <span className="text-[10px] font-medium text-white/40 tracking-widest uppercase hidden sm:block">
                Plataforma
              </span>
            )}
            {isScrolled && (
              <span className="text-[10px] font-medium text-slate-400 tracking-widest uppercase hidden sm:block">
                Plataforma
              </span>
            )}
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {[
              { href: '/', label: 'Início' },
              { href: '/event/festival-de-verao-2025', label: 'Eventos' },
              { href: '/app/download', label: 'App' },
              { href: '/contato', label: 'Contato' },
            ].map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  'relative px-4 py-2 text-[13px] font-medium transition-colors duration-300 rounded-full',
                  isActive(link.href)
                    ? isScrolled ? 'text-blue-500' : 'text-cyan-400'
                    : isScrolled ? 'text-slate-500 hover:text-slate-900' : 'text-white/60 hover:text-white'
                )}
              >
                {isActive(link.href) && (
                  <span className={cn(
                    'absolute inset-0 rounded-full',
                    isScrolled ? 'bg-blue-500/[0.07]' : 'bg-white/[0.07]'
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
                    isScrolled ? 'hover:bg-slate-100' : 'hover:bg-white/5'
                  )}
                >
                  <img
                    src={user.avatar_url || '/images/logo-evokaa.png'}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200"
                  />
                  <span className={cn(
                    'text-[13px] font-medium max-w-[120px] truncate',
                    isScrolled ? 'text-slate-700' : 'text-white'
                  )}>
                    {user.full_name || user.email}
                  </span>
                  <ChevronDown className={cn(
                    'w-3.5 h-3.5 transition-transform',
                    showUserMenu && 'rotate-180',
                    isScrolled ? 'text-slate-400' : 'text-white/40'
                  )} />
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white/95 backdrop-blur-xl border border-slate-200/60 rounded-2xl shadow-xl py-2 z-50">
                    <div className="px-4 py-2 border-b border-slate-100 mb-1">
                      <p className="text-xs font-medium text-slate-900 truncate">{user.full_name || user.email}</p>
                      <p className="text-[10px] text-slate-400 capitalize">{role === 'producer' ? 'Produtor' : role === 'admin' ? 'Admin' : 'Participante'}</p>
                    </div>
                    <Link
                      to={role === 'admin' ? '/admin/dashboard' : role === 'producer' ? '/producer/dashboard' : '/app/hub'}
                      className="flex items-center gap-2 px-4 py-2 text-[13px] text-slate-700 hover:bg-blue-50 transition-colors"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5 text-slate-400" />
                      Meu Painel
                    </Link>
                    <button
                      onClick={() => { setShowUserMenu(false); logout() }}
                      className="flex items-center gap-2 px-4 py-2 text-[13px] text-red-500 hover:bg-red-50 transition-colors w-full text-left"
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
                  to="/auth/login"
                  className={cn(
                    'text-[13px] py-2.5 px-5 font-medium rounded-full transition-all duration-300',
                    isScrolled 
                      ? 'text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300' 
                      : 'text-white/80 border border-white/15 hover:bg-white/5 hover:border-white/25'
                  )}
                >
                  Entrar
                </Link>
                <Link
                  to="/auth/register"
                  className="text-[13px] py-2.5 px-5 font-semibold text-white rounded-full transition-all duration-300 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  }}
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
            className={cn(
              'md:hidden p-2',
              isScrolled ? 'text-slate-700' : 'text-white'
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
        <div className="bg-white/95 backdrop-blur-xl border-t border-slate-200/60 px-6 py-6 space-y-1">
          {[
            { href: '/', label: 'Início' },
            { href: '/event/noite-eletro-2025', label: 'Eventos' },
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
                  ? 'bg-blue-500/[0.07] text-blue-500'
                  : 'text-slate-500 hover:bg-slate-50'
              )}
            >
              {link.label}
            </Link>
          ))}
          <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
            {isAuthenticated && user ? (
              <>
                <Link
                  to={role === 'admin' ? '/admin/dashboard' : role === 'producer' ? '/producer/dashboard' : '/app/hub'}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-slate-600 border border-slate-200 rounded-full hover:bg-slate-50 transition-all"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Meu Painel
                </Link>
                <button
                  onClick={() => { setIsMobileMenuOpen(false); logout() }}
                  className="flex-1 flex items-center justify-center py-3 text-sm font-medium text-red-500 border border-red-200 rounded-full hover:bg-red-50 transition-all"
                >
                  <LogOut className="w-4 h-4 mr-1" />
                  Sair
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/auth/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex-1 flex items-center justify-center py-3 text-sm font-medium text-slate-600 border border-slate-200 rounded-full hover:bg-slate-50 transition-all"
                >
                  Entrar
                </Link>
                <Link
                  to="/auth/register"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex-1 flex items-center justify-center py-3 text-sm font-semibold text-white rounded-full transition-all hover:shadow-lg"
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
