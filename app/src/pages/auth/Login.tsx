import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight, Users, Shield, PartyPopper, Loader2, Edit3 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { trackEvent } from '../../lib/tracking'

type UserRole = 'user' | 'producer' | 'admin'

const roleLabels: Record<string, string> = {
  user: 'Participante',
  producer: 'Produtor',
  admin: 'Administrador',
  editor: 'Editor'
}

const GoogleIcon = () => (
  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.87-2.6-2.87-4.53-6.16-4.53z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
  </svg>
)

const MicrosoftIcon = () => (
  <svg className="w-4 h-4 mr-2" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="11" height="11" fill="#F25022" />
    <rect x="12" y="0" width="11" height="11" fill="#7FBA00" />
    <rect x="0" y="12" width="11" height="11" fill="#00A1F1" />
    <rect x="12" y="12" width="11" height="11" fill="#FFB900" />
  </svg>
)

const AppleIcon = () => (
  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.82M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.22.67-2.94 1.5-.63.73-1.18 1.87-1.03 2.98 1.12.09 2.27-.56 2.98-1.42z" />
  </svg>
)

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

  // Estados do MFA (2FA)
  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials')
  const [mfaChallenge, setMfaChallenge] = useState<{ factorId: string; challengeId: string } | null>(null)
  const [mfaCode, setMfaCode] = useState('')

  // Intercepta se o ProtectedRoute exigir MFA direta para uma sessao aal1 ativa
  useEffect(() => {
    async function checkRequiredMfa() {
      if (location.state?.mfaRequired) {
        try {
          const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
          if (!error && data && data.nextLevel === 'aal2' && data.currentLevel === 'aal1') {
            const factors = await supabase.auth.mfa.listFactors()
            const totpFactor = factors.data?.totp?.[0]
            if (totpFactor) {
              const challenge = await supabase.auth.mfa.challenge({ factorId: totpFactor.id })
              if (challenge.data) {
                setMfaChallenge({
                  factorId: totpFactor.id,
                  challengeId: challenge.data.id
                })
                setStep('mfa')
              }
            }
          }
        } catch (err) {
          console.error('[Login MFA Check] Erro ao carregar challenge:', err)
        }
      }
    }
    checkRequiredMfa()
  }, [location.state])

  const handleGoogleLogin = async () => {
    setIsSubmitting(true)
    setError('')
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/app/hub`
        }
      })
      if (error) throw error
    } catch (err: any) {
      console.error('[OAuth Google] Erro:', err)
      setError(err?.message || 'Erro ao entrar com Google')
      setIsSubmitting(false)
    }
  }

  const handleMicrosoftLogin = async () => {
    setIsSubmitting(true)
    setError('')
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          redirectTo: `${window.location.origin}/app/hub`,
          scopes: 'email openid profile User.Read'
        }
      })
      if (error) throw error
    } catch (err: any) {
      console.error('[OAuth Microsoft] Erro:', err)
      setError(err?.message || 'Erro ao entrar com Microsoft')
      setIsSubmitting(false)
    }
  }

  const handleAppleLogin = async () => {
    setIsSubmitting(true)
    setError('')
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: `${window.location.origin}/app/hub`
        }
      })
      if (error) throw error
    } catch (err: any) {
      console.error('[OAuth Apple] Erro:', err)
      setError(err?.message || 'Erro ao entrar com Apple')
      setIsSubmitting(false)
    }
  }

  // Redirect if already authenticated
  useEffect(() => {
    console.log('[DEBUG Login] useEffect check:', { isAuthenticated, currentRoleContext, step })
    if (isAuthenticated && currentRoleContext && step === 'credentials') {
      console.log('[DEBUG Login] Redirecionando usuario logado. Role:', currentRoleContext)
      // Se veio do checkout com carrinho pendente, redirecionar de volta para o checkout
      const pendingCheckout = sessionStorage.getItem('aura_pending_checkout')
      if (pendingCheckout && currentRoleContext === 'user') {
        navigate('/checkout')
        return
      }
      if (currentRoleContext === 'admin') navigate('/admin/dashboard')
      else if (currentRoleContext === 'producer' || currentRoleContext === 'editor') navigate('/producer/dashboard')
      else navigate('/app/hub')
    }
  }, [isAuthenticated, currentRoleContext, navigate, step])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
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
        // Verificar se a role real do banco coincide com a role selecionada no formulário de login
        // (com a exceção de que um usuário com a role real 'editor' no banco pode logar selecionando 'producer' no formulário)
        const loggedUser = useAuthStore.getState().user
        const isRoleMatch = loggedUser && (
          loggedUser.role === role || 
          (loggedUser.role === 'editor' && role === 'producer')
        )
        if (loggedUser && !isRoleMatch) {
          // Se a role selecionada for diferente da role do banco, desloga e dá erro
          await useAuthStore.getState().setUser(null)
          await useAuthStore.getState().setSession(null)
          await supabase.auth.signOut().catch(() => {})
          localStorage.removeItem('aura-auth')
          
          setError(`Este e-mail está cadastrado como ${roleLabels[loggedUser.role] || loggedUser.role} e não pode ser utilizado como ${roleLabels[role] || role}.`)
          setIsSubmitting(false)
          return
        }

        // Registrar log de login no Supabase
        trackEvent('login', location.pathname, { email: cleanEmail })

        // Checar se o usuário tem 2FA configurado
        const { data: mfaData, error: mfaError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (!mfaError && mfaData && mfaData.nextLevel === 'aal2' && mfaData.currentLevel === 'aal1') {
          const factors = await supabase.auth.mfa.listFactors()
          const totpFactor = factors.data?.totp?.[0]
          if (totpFactor) {
            const challenge = await supabase.auth.mfa.challenge({ factorId: totpFactor.id })
            if (challenge.data) {
              setMfaChallenge({
                factorId: totpFactor.id,
                challengeId: challenge.data.id
              })
              setStep('mfa')
              setIsSubmitting(false)
              return
            }
          }
        }

        toast.success(`Bem-vindo de volta!`)
        // Se veio do checkout, redirecionar para lá após login bem-sucedido
        const pendingCheckout = sessionStorage.getItem('aura_pending_checkout')
        if (fromCheckout && pendingCheckout) {
          navigate('/checkout')
          return
        }
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

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!mfaCode || mfaCode.length !== 6) {
      setError('Digite o código de 6 dígitos')
      return
    }
    if (!mfaChallenge) return

    setIsSubmitting(true)
    try {
      const verify = await supabase.auth.mfa.verify({
        factorId: mfaChallenge.factorId,
        challengeId: mfaChallenge.challengeId,
        code: mfaCode.trim()
      })

      if (verify.error) {
        throw new Error(verify.error.message || 'Código incorreto. Tente novamente.')
      }

      toast.success('Autenticação multifator bem-sucedida!')
      
      const pendingCheckout = sessionStorage.getItem('aura_pending_checkout')
      if (fromCheckout && pendingCheckout) {
        navigate('/checkout')
        return
      }

      // Redireciona com base nas credenciais
      const { data: sessionData } = await supabase.auth.getSession()
      const metadataRole = sessionData.session?.user?.user_metadata?.role
      if (metadataRole === 'admin') navigate('/admin/dashboard')
      else if (metadataRole === 'producer' || metadataRole === 'editor') navigate('/producer/dashboard')
      else navigate('/app/hub')
    } catch (err: any) {
      console.error('[MFA Verify] Erro:', err)
      setError(err.message || 'Erro ao verificar código de 2FA')
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
        {step === 'mfa' ? (
          <form onSubmit={handleMfaVerify} className="space-y-6">
            <div className="p-4 rounded-2xl bg-plum/5 border border-plum/10 text-center">
              <p className="text-sm text-espresso font-medium">
                Esta conta está protegida por <strong>Autenticação de Dois Fatores (2FA)</strong>.
              </p>
              <p className="text-xs text-espresso/50 mt-1.5">
                Insira abaixo o código de 6 dígitos gerado pelo seu aplicativo Google Authenticator ou similar.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Código de Autenticação</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={mfaCode}
                onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-center text-xl font-mono tracking-[0.5em] text-espresso placeholder:text-espresso/20 focus:outline-none focus:border-plum/30 transition-colors disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3 font-medium rounded-full transition-all flex items-center justify-center gap-2 ${
                role === 'admin' ? 'bg-rose-500 text-white hover:shadow-lg hover:shadow-rose-500/20' :
                role === 'producer' ? 'bg-amber-500 text-white hover:shadow-lg hover:shadow-amber-500/20' :
                role === 'editor' ? 'bg-purple-500 text-white hover:shadow-lg hover:shadow-purple-500/20' :
                'bg-plum text-cream hover:shadow-glow'
              } disabled:opacity-70 disabled:cursor-not-allowed`}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verificando...</span>
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span>Confirmar Código</span>
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setStep('credentials')
                setMfaChallenge(null)
                setMfaCode('')
              }}
              className="w-full py-2.5 px-4 text-espresso/50 hover:text-espresso text-xs font-medium rounded-full hover:bg-espresso/5 transition-all text-center"
            >
              Voltar para a tela de login
            </button>
          </form>
        ) : (
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
                role === 'editor' ? 'bg-purple-500 text-white hover:shadow-lg hover:shadow-purple-500/20' :
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
                <span className="px-3 bg-canvas text-xs text-espresso/30">ou entrar com</span>
              </div>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 border border-espresso/15 text-espresso text-sm font-medium rounded-full hover:bg-espresso/5 transition-all disabled:opacity-50 flex items-center justify-center"
              >
                <GoogleIcon />
                <span>Entrar com Google</span>
              </button>
              <button
                type="button"
                onClick={handleAppleLogin}
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 border border-espresso/15 text-espresso text-sm font-medium rounded-full hover:bg-espresso/5 transition-all disabled:opacity-50 flex items-center justify-center"
              >
                <AppleIcon />
                <span>Entrar com Apple</span>
              </button>
              <button
                type="button"
                onClick={handleMicrosoftLogin}
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 border border-espresso/15 text-espresso text-sm font-medium rounded-full hover:bg-espresso/5 transition-all disabled:opacity-50 flex items-center justify-center"
              >
                <MicrosoftIcon />
                <span>Entrar com Microsoft</span>
              </button>
            </div>
          </form>
        )}

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
