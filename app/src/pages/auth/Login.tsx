import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight, Users, Shield, PartyPopper, Loader2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { toast } from 'sonner'

type UserRole = 'user' | 'producer' | 'admin'

export default function AuthLogin() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isAuthenticated, role: currentRoleContext } = useAuth()

  // Verificar se veio do checkout com carrinho pendente
  const fromCheckout = location.state?.from === '/checkout'
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('user')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Redirect if already authenticated
  useEffect(() => {
    console.log('[DEBUG Login] useEffect check:', { isAuthenticated, currentRoleContext })
    if (isAuthenticated && currentRoleContext) {
      console.log('[DEBUG Login] Redirecionando usuario logado. Role:', currentRoleContext)
      // Se veio do checkout com carrinho pendente, redirecionar de volta para o checkout
      const pendingCheckout = sessionStorage.getItem('aura_pending_checkout')
      if (pendingCheckout && currentRoleContext === 'user') {
        navigate('/checkout')
        return
      }
      if (currentRoleContext === 'admin') navigate('/admin/dashboard')
      else if (currentRoleContext === 'producer') navigate('/producer/dashboard')
      else navigate('/app/hub')
    }
  }, [isAuthenticated, currentRoleContext, navigate])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    // Log removido para producao
    setError('')
    const cleanEmail = email.trim()
    const cleanPassword = password.trim()
    if (!cleanEmail || !cleanPassword) {
      setError('Preencha e-mail e senha')
      return
    }
    
    setIsSubmitting(true)
    try {
      console.log('[DEBUG Login] Chamando login() para:', cleanEmail)
      const success = await login(cleanEmail, cleanPassword)
      console.log('[DEBUG Login] Retorno do login():', success)
      if (success) {
        toast.success(`Bem-vindo de volta!`)
        // Se veio do checkout, redirecionar para lá após login bem-sucedido
        const pendingCheckout = sessionStorage.getItem('aura_pending_checkout')
        if (fromCheckout && pendingCheckout) {
          navigate('/checkout')
          return
        }
        // The useEffect above will handle the redirect once the profile is loaded into context
      } else {
        setError('E-mail ou senha incorretos')
      }
    } catch (err: any) {
      console.error('[Login] Erro capturado:', err)
      setError(err?.message || err?.error_description || 'E-mail ou senha incorretos')
    } finally {
      setIsSubmitting(false)
    }
  }

  const roles: { value: UserRole; label: string; icon: typeof Users; desc: string; color: string; path: string }[] = [
    { value: 'user', label: 'Participante', icon: Users, desc: 'Comprar ingressos e viver experiências', color: 'plum', path: '/app/hub' },
    { value: 'producer', label: 'Produtor', icon: PartyPopper, desc: 'Criar e gerenciar seus eventos', color: 'amber', path: '/producer/dashboard' },
    { value: 'admin', label: 'Administrador', icon: Shield, desc: 'Gestão interna da plataforma', color: 'rose', path: '/admin/dashboard' },
  ]

  const currentRole = roles.find(r => r.value === role)!

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <img src="/images/logo-evokaa.png" alt="Evokaa" className="h-10 w-auto" />
          </Link>
          <h1 className="font-serif text-2xl text-espresso">Bem-vindo de volta</h1>
          <p className="text-sm text-espresso/50 mt-1">Escolha seu perfil e entre</p>
        </div>

        {/* Role Selection */}
        <div className="bg-white/60 border border-white/60 rounded-2xl p-1.5 mb-6 flex gap-1">
          {roles.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRole(r.value)}
              className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                role === r.value
                  ? r.value === 'admin'
                    ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                    : r.value === 'producer'
                    ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                    : 'bg-plum text-cream shadow-lg shadow-plum/20'
                  : 'text-espresso/40 hover:text-espresso/70'
              }`}
            >
              <r.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{r.label}</span>
            </button>
          ))}
        </div>

        {/* Role description */}
        <div className={`p-4 rounded-2xl mb-6 text-center ${
          role === 'admin' ? 'bg-rose-50 border border-rose-100' :
          role === 'producer' ? 'bg-amber-50 border border-amber-100' :
          'bg-plum/5 border border-plum/10'
        }`}>
          <p className={`text-sm ${
            role === 'admin' ? 'text-rose-700' :
            role === 'producer' ? 'text-amber-700' :
            'text-plum'
          }`}>{currentRole.desc}</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-xs text-red-600 text-center">{error}</div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-espresso/60 mb-1.5 block">E-mail</label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              disabled={isSubmitting}
              className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 transition-colors disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Senha</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Sua senha"
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 transition-colors pr-10 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-espresso/30 hover:text-espresso transition-colors"
                disabled={isSubmitting}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-espresso/50 cursor-pointer">
              <input type="checkbox" className="accent-plum" disabled={isSubmitting} />
              Lembrar-me
            </label>
            <Link to="/auth/forgot" className="text-xs text-plum hover:underline">Esqueci a senha</Link>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-3 font-medium rounded-full transition-all flex items-center justify-center gap-2 ${
              role === 'admin' ? 'bg-rose-500 text-white hover:shadow-lg hover:shadow-rose-500/20' :
              role === 'producer' ? 'bg-amber-500 text-white hover:shadow-lg hover:shadow-amber-500/20' :
              'bg-plum text-cream hover:shadow-glow'
            } disabled:opacity-70 disabled:cursor-not-allowed`}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Acessando...</span>
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span>Entrar como {currentRole.label}</span>
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-espresso/5" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-canvas text-xs text-espresso/30">ou</span>
            </div>
          </div>

          <button type="button" disabled={isSubmitting} className="w-full py-3 border border-espresso/15 text-espresso text-sm font-medium rounded-full hover:bg-espresso/5 transition-all disabled:opacity-50">
            Entrar com Google
          </button>
        </form>

        <p className="text-center text-xs text-espresso/40 mt-6">
          Não tem conta?{' '}
          <Link to="/auth/register" className="text-plum hover:underline">Criar conta</Link>
        </p>

        {/* App download hint */}
        <div className="mt-8 p-4 rounded-2xl bg-void text-cream text-center">
          <p className="text-xs text-cream/50 mb-2">Baixe o app para uma experiência completa</p>
          <Link
            to="/app/download"
            className="text-xs text-plum hover:text-cream transition-colors inline-flex items-center gap-1"
          >
            Ver opções de download <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  )
}
