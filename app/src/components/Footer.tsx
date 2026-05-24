import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { useState } from 'react'

export default function Footer() {
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault()
    if (email.trim()) {
      setSubscribed(true)
      setEmail('')
      setTimeout(() => setSubscribed(false), 3000)
    }
  }

  return (
    <footer className="bg-void text-cream relative overflow-hidden">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-plum/10 to-transparent pointer-events-none" />
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8">
          {/* Brand */}
          <div className="lg:col-span-4">
            <Link to="/" className="flex items-center gap-2 mb-6">
              <img
                src="/images/logo-evokaa.png"
                alt="Evokaa"
                className="h-10 w-auto"
              />
            </Link>
            <p className="text-cream/60 text-sm leading-relaxed max-w-sm">
              A plataforma definitiva para criadores de experiências. 
              Crie, gerencie e venda eventos extraordinários.
            </p>
          </div>

          {/* Links */}
          <div className="lg:col-span-4 grid grid-cols-2 gap-8">
            <div>
              <h4 className="text-xs font-medium uppercase tracking-widest text-cream/40 mb-4">
                Plataforma
              </h4>
              <ul className="space-y-3">
                {[
                  { label: 'Dashboard', href: '/dashboard' },
                  { label: 'Eventos', href: '/event/noite-eletro-2025' },
                  { label: 'Brand Studio', href: '/brand-studio' },
                ].map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.href}
                      className="text-sm text-cream/60 hover:text-cream transition-colors duration-300 inline-flex items-center gap-1 group"
                    >
                      {link.label}
                      <ArrowUpRight className="w-3 h-3 opacity-0 -translate-y-1 translate-x-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-medium uppercase tracking-widest text-cream/40 mb-4">
                Empresa
              </h4>
              <ul className="space-y-3">
                {['Sobre', 'Carreiras', 'Contato'].map((label) => (
                  <li key={label}>
                    <span className="text-sm text-cream/60 cursor-default">
                      {label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Newsletter */}
          <div className="lg:col-span-4">
            <h4 className="text-xs font-medium uppercase tracking-widest text-cream/40 mb-4">
              Newsletter
            </h4>
            <p className="text-sm text-cream/60 mb-4">
              Receba novidades sobre eventos e atualizações da plataforma.
            </p>
            <form onSubmit={handleSubscribe} className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full bg-white/5 border border-white/10 rounded-full px-5 py-3 text-sm text-cream placeholder:text-cream/30 focus:outline-none focus:border-plum/50 transition-colors"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-plum text-cream text-xs font-medium rounded-full hover:bg-plum/80 transition-colors"
              >
                {subscribed ? 'Enviado!' : 'Assinar'}
              </button>
            </form>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-cream/40">
            &copy; 2025 Evokaa. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-6">
            {['Privacidade', 'Termos', 'Cookies'].map((label) => (
              <span key={label} className="text-xs text-cream/40 cursor-default hover:text-cream/60 transition-colors">
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
