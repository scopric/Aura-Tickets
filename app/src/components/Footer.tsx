import { Link, useLocation } from 'react-router-dom'
import { appUrl } from '../lib/appHost'
import { rotaForcadaEscuro } from '../lib/tema'
import { ArrowUpRight, Loader2 } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'

// Fundo escuro fixo em qualquer tema: o texto tem de ser fixo também (text-white/NN e text-cream mudam no tema claro e davam 2,66:1)
// Decisão 142: a troca de tema das páginas públicas fica no rodapé. Decisão 144: o tema é por área, e só as rotas de
// ROTAS_COM_TEMA o seguem; nas outras (a Home e as forçadas no escuro) o seletor não aparece e este pedaço nem baixa
const ThemeToggle = lazy(() => import('./ThemeToggle'))

export default function Footer() {
  const { pathname } = useLocation()
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error('Por favor, insira um e-mail válido.')
      return
    }

    setLoading(true)
    try {
      // Pela Edge Function (valida, limita por IP e grava; o visitante não tem INSERT na tabela). A resposta
      // é a mesma exista ou não o e-mail na lista: não revela quem já é assinante.
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: { emailType: 'newsletter_subscribe', email: email.trim() },
      })
      if (error || data?.error) {
        // FunctionsHttpError guarda a resposta da função em error.context; erro de rede não
        const ctx = (error as { context?: { json?: () => Promise<{ error?: string }> } } | null)?.context
        const msg = data?.error || (typeof ctx?.json === 'function' ? await ctx.json().then(b => b?.error).catch(() => undefined) : undefined)
        toast.error(msg || 'Erro ao inscrever. Tente novamente.')
        return
      }

      setSubscribed(true)
      setEmail('')
      toast.success('Inscrição recebida!')
      setTimeout(() => setSubscribed(false), 4000)
    } catch (err) {
      console.error('[Newsletter]', err)
      toast.error('Erro ao inscrever. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <footer className="bg-slate-950 text-slate-50 relative overflow-hidden">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-blue-500/10 to-transparent pointer-events-none" />
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8">
          {/* Brand */}
          <div className="lg:col-span-4">
            <Link to="/" className="flex items-center gap-2 mb-6">
              <img
                src="/images/logo-evokaa-sm.png"
                alt="Evokaa"
                className="h-20 w-auto"
              />
            </Link>
            <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
              A plataforma definitiva para criadores de experiências. 
              Crie, gerencie e venda eventos extraordinários.
            </p>
          </div>

          {/* Links */}
          <div className="lg:col-span-4 grid grid-cols-2 gap-8">
            <div>
              <h4 className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-4">
                Plataforma
              </h4>
              <ul className="space-y-3">
                <li>
                  {/* painel do produtor fica em app.*: âncora comum, não <Link> (troca de host) */}
                  <a
                    href={appUrl('/producer/dashboard')}
                    className="text-sm text-slate-400 hover:text-white transition-colors duration-300 inline-flex items-center gap-1 group"
                  >
                    Dashboard
                    <ArrowUpRight className="w-3 h-3 opacity-0 -translate-y-1 translate-x-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all" />
                  </a>
                </li>
                <li>
                  <Link
                    to="/events"
                    className="text-sm text-slate-400 hover:text-white transition-colors duration-300 inline-flex items-center gap-1 group"
                  >
                    Eventos
                    <ArrowUpRight className="w-3 h-3 opacity-0 -translate-y-1 translate-x-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all" />
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-4">
                Empresa
              </h4>
              <ul className="space-y-3">
                {/* "Sobre" e "Carreiras" saíram: não há página para elas */}
                <li>
                  <Link
                    to="/contato"
                    className="text-sm text-slate-400 hover:text-white transition-colors duration-300 inline-flex items-center gap-1 group"
                  >
                    Contato
                    <ArrowUpRight className="w-3 h-3 opacity-0 -translate-y-1 translate-x-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all" />
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Newsletter */}
          <div id="newsletter" className="lg:col-span-4 scroll-mt-24">
            <h4 className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-4">
              Newsletter
            </h4>
            <p className="text-sm text-slate-400 mb-4">
              Receba novidades sobre eventos e atualizações da plataforma.
            </p>
            <form onSubmit={handleSubscribe} className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full bg-white/5 border border-white/10 rounded-full px-5 py-3 text-sm text-slate-50 placeholder:text-slate-400 focus:outline-none focus:border-blue-500/50 transition-colors"
              />
              <button
                type="submit"
                disabled={loading}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-1.5 text-slate-50 text-xs font-medium rounded-full hover:opacity-90 transition-colors disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
              >
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : subscribed ? 'Enviado!' : 'Assinar'}
              </button>
            </form>
            {subscribed && (
              <p className="text-xs text-slate-400 mt-2">
                Se você já tinha cancelado a inscrição, fale com a gente para voltar a receber.
              </p>
            )}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-400">
            &copy; 2025 Evokaa. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-6">
            <Link to="/privacidade" className="text-xs text-slate-400 hover:text-white transition-colors">
              Privacidade
            </Link>
            <Link to="/termos" className="text-xs text-slate-400 hover:text-white transition-colors">
              Termos
            </Link>
            <button onClick={() => { if (typeof window !== 'undefined' && (window as any).__auraOpenCookieBanner) (window as any).__auraOpenCookieBanner() }} className="text-xs text-slate-400 hover:text-white transition-colors">
              Cookies
            </button>
          </div>
        </div>

        {/* o rodapé é escuro nos dois temas: o seletor também (a classe dark refaz as cores só dentro dele) */}
        {!rotaForcadaEscuro(pathname) && (
          <div className="dark mt-8 max-w-xs">
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-slate-400">Aparência</p>
            <Suspense fallback={<div className="h-8" />}>
              <ThemeToggle />
            </Suspense>
          </div>
        )}
      </div>
    </footer>
  )
}
