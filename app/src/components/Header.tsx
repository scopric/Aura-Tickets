import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, UserPlus } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const location = useLocation()
  const isProducerRoute = location.pathname.startsWith('/producer')

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
          ? 'bg-[var(--canvas)]/80 backdrop-blur-xl border-b border-[var(--espresso)]/[0.06]'
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
              className="h-7 w-auto transition-transform duration-300 group-hover:scale-105"
            />
            {!isScrolled && (
              <span className="text-[10px] font-medium text-[var(--ink-faint)] tracking-widest uppercase hidden sm:block">
                Plataforma
              </span>
            )}
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {[
              { href: '/', label: 'Inicio' },
              { href: '/event/noite-eletro-2025', label: 'Eventos' },
              { href: '/app/download', label: 'App' },
              { href: '/contato', label: 'Contato' },
            ].map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  'relative px-4 py-2 text-[13px] font-medium transition-colors duration-300 rounded-full',
                  isActive(link.href)
                    ? 'text-[var(--plum)]'
                    : 'text-[var(--ink-light)] hover:text-[var(--espresso)]'
                )}
              >
                {isActive(link.href) && (
                  <span className="absolute inset-0 bg-[var(--plum)]/[0.07] rounded-full" />
                )}
                <span className="relative">{link.label}</span>
              </Link>
            ))}
          </nav>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-2">
            <Link
              to="/auth/login"
              className="btn-ghost text-[13px] py-2.5 px-5"
            >
              Entrar
            </Link>
            <Link
              to="/auth/register"
              className="btn-primary text-[13px] py-2.5 px-5 flex items-center gap-2"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Criar Conta
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-[var(--espresso)]"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={cn(
          'md:hidden overflow-hidden transition-all duration-500',
          isMobileMenuOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="bg-[var(--canvas)]/95 backdrop-blur-xl border-t border-[var(--espresso)]/[0.06] px-6 py-6 space-y-1">
          {[
            { href: '/', label: 'Inicio' },
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
                  ? 'bg-[var(--plum)]/[0.07] text-[var(--plum)]'
                  : 'text-[var(--ink-light)] hover:bg-white/40'
              )}
            >
              {link.label}
            </Link>
          ))}
          <div className="flex gap-2 mt-4 pt-4 border-t border-[var(--espresso)]/[0.06]">
            <Link
              to="/auth/login"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex-1 flex items-center justify-center py-3 text-sm font-medium text-[var(--ink-light)] border border-[var(--espresso)]/[0.08] rounded-full hover:bg-white/40 transition-all"
            >
              Entrar
            </Link>
            <Link
              to="/auth/register"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex-1 flex items-center justify-center py-3 text-sm font-medium text-[var(--cream)] bg-[var(--plum)] rounded-full hover:shadow-lg transition-all"
            >
              Criar Conta
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
