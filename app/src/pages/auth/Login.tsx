import { apagarIngressosGuardados } from '../../lib/ingressosOffline'
import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight, Users, Shield, PartyPopper, Loader2, Edit3 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { trackEvent } from '../../lib/tracking'
import { getAppMode } from '../../lib/appHost'
import MfaCodigo, { type MfaStatus } from './MfaCodigo'
import { consumirVolta, guardarVolta, voltaValida } from '../../lib/voltaEvento'

type UserRole = 'user' | 'producer' | 'admin'
type OAuthProvider = 'google' | 'apple' | 'azure'
const OAUTH_LABEL: Record<OAuthProvider, string> = { google: 'Google', apple: 'Apple', azure: 'Microsoft' }

const isAdminMode = getAppMode() === 'admin'

// Destino pelo papel real (profiles.role); a aba escolhida no formulário é só visual
// `daUrl`: ?volta= do coração "Salvar" (VF); só o participante volta para lá (consumirVolta também lê e limpa a guardada)
function panelFor(role: string, daUrl: string | null) {
  const volta = consumirVolta(role, daUrl)
  if (volta) return volta
  if (role === 'admin') return '/admin/dashboard'
  if (role === 'producer' || role === 'editor') return '/producer/dashboard'
  return '/app/hub'
}

// alpha.* só aceita admin; app.* e o site nunca aceitam admin
function blockedMessage(role: string) {
  if (isAdminMode) return role === 'admin' ? null : 'Acesso restrito.'
  return role === 'admin' ? 'Esta conta não pode acessar por este endereço.' : null
}

// Derruba a sessão recusada só neste host ('local'): um admin que abre o app.* por engano
// não perde a sessão do alpha.
async function clearSession() {
  apagarIngressosGuardados()
  await useAuthStore.getState().setUser(null)
  await useAuthStore.getState().setSession(null)
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
  localStorage.removeItem('aura-auth')
}

const GoogleIcon = () => (
  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.87-2.6-2.87-4.53-6.16-4.53z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
  </svg>
)


export default function AuthLogin() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isAuthenticated, role: currentRoleContext } = useAuth()

  // Verificar se veio do checkout com carrinho pendente
  const fromCheckout = location.state?.from === '/checkout'
  // ?volta=/event/<id>: só caminho de evento, nunca endereço de fora (lib/voltaEvento). Google e cadastro a levam pelo sessionStorage.
  const volta = voltaValida(new URLSearchParams(location.search).get('volta'))
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>(isAdminMode ? 'admin' : 'user')
  // Erro devolvido pelo provedor na volta do login social (#error=…&error_description=…).
  // O supabase-js não limpa o hash quando há erro, por isso basta ler o da rota atual.
  const [error, setError] = useState(() => new URLSearchParams(location.hash.slice(1)).get('error_description') ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Login social não passa pelo cadastro: o aceite dos Termos/Política precisa ser marcado aqui
  // (LGPD art. 8º: manifestação inequívoca); record-access grava no 1º login.
  const [socialConsent, setSocialConsent] = useState(false)

  // Estados do MFA (2FA)
  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials')
  const [mfaChallenge, setMfaChallenge] = useState<{ factorId: string; challengeId: string } | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaStatus, setMfaStatus] = useState<MfaStatus>('idle')

  // Conta com 2FA e sessão ainda sem o código (aal1): abre o passo do código e devolve true.
  // Enquanto isso o banco não entrega nada da conta (docs/sql/20260930_2fa_no_banco.sql): o papel
  // lido no login ainda é o provisório, por isso nada de bloqueio por papel antes do código.
  // Erro ao abrir o passo do código também devolve true (com a mensagem na tela): quem chama para ali,
  // sem decidir pelo papel provisório.
  async function startMfaIfNeeded(): Promise<boolean> {
    try {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (error) throw error
      if (data?.currentLevel !== 'aal1' || data?.nextLevel !== 'aal2') return false
      const factors = await supabase.auth.mfa.listFactors()
      if (factors.error) throw factors.error
      const totpFactor = factors.data?.totp?.[0]
      if (!totpFactor) throw new Error('Esta conta usa um tipo de 2FA que o site ainda não aceita.')
      const challenge = await supabase.auth.mfa.challenge({ factorId: totpFactor.id })
      if (challenge.error) throw challenge.error
      setMfaChallenge({ factorId: totpFactor.id, challengeId: challenge.data.id })
      setStep('mfa')
      return true
    } catch (err: any) {
      console.error('[Login MFA] Erro ao abrir o passo do código:', err)
      setError(`Não foi possível pedir o código do 2FA: ${err?.message || 'tente de novo'}`)
      return true // interrompe: sem o código a conta não é lida, e o papel provisório bloquearia errado
    }
  }

  // Intercepta se o ProtectedRoute exigir MFA direta para uma sessao aal1 ativa
  useEffect(() => {
    if (location.state?.mfaRequired) startMfaIfNeeded()
  }, [location.state])

  // Login social. Volta ao próprio /auth/login: o useEffect "já autenticado" abaixo decide o
  // destino pelo papel real (profiles.role), aplica o bloqueio por endereço (admin no app.*)
  // e respeita o carrinho pendente do checkout — o mesmo caminho do login com senha.
  // Fluxo implícito (lib/supabase.ts): a sessão volta no hash da URL e o supabase-js a processa.
  const handleOAuthLogin = async (provider: OAuthProvider) => {
    if (!socialConsent) {
      setError('Marque o aceite dos Termos de Uso e da Política de Privacidade para entrar com Google.')
      return
    }
    setIsSubmitting(true)
    setError('')
    guardarVolta(volta)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/login`,
          // Azure: o Supabase exige o escopo email; profile traz o nome (openid ele já acrescenta).
          ...(provider === 'azure' ? { scopes: 'email profile' } : {}),
        },
      })
      if (error) throw error
    } catch (err: any) {
      console.error(`[OAuth ${OAUTH_LABEL[provider]}] Erro:`, err)
      setError(err?.message || `Erro ao entrar com ${OAUTH_LABEL[provider]}`)
      setIsSubmitting(false)
    }
  }

  // Redirect if already authenticated
  // Não age durante o envio: ali o papel no store ainda é o provisório ('user') e quem decide é o handleLogin.
  useEffect(() => {
    // mfaRequired: quem decide é o efeito acima (senão vira loop com o ProtectedRoute).
    // Volta do Google e sessão restaurada: primeiro o código do 2FA, depois o papel.
    if (isAuthenticated && currentRoleContext && step === 'credentials' && !isSubmitting && !location.state?.mfaRequired) {
      let cancelado = false
      ;(async () => {
        if (await startMfaIfNeeded() || cancelado) return
        const blocked = blockedMessage(currentRoleContext)
        if (blocked) {
          setError(blocked)
          clearSession()
          return
        }
        // Se veio do checkout com carrinho pendente, redirecionar de volta para o checkout
        const pendingCheckout = sessionStorage.getItem('aura_pending_checkout')
        if (pendingCheckout && currentRoleContext === 'user') {
          navigate('/checkout')
          return
        }
        navigate(panelFor(currentRoleContext, volta))
      })()
      return () => { cancelado = true }
    }
  }, [isAuthenticated, currentRoleContext, navigate, step, isSubmitting, location.state, volta])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const cleanEmail = email.trim()
    // A senha vai como foi digitada: o cadastro não corta espaços, então cortar aqui barraria quem os usou.
    if (!cleanEmail || !password) {
      setError('Preencha e-mail e senha')
      return
    }
    
    setIsSubmitting(true)
    let redirected = false
    try {
      const success = await login(cleanEmail, password)
      if (success) {
        if (await startMfaIfNeeded()) return

        // Papel real: profiles.role, carregado pelo fetchProfile dentro do login()
        const realRole = useAuthStore.getState().user?.role
        // Sem papel (perfil não carregou) não entra: fecha em erro
        const blocked = realRole ? blockedMessage(realRole) : 'Não foi possível confirmar o acesso desta conta. Tente de novo.'
        if (blocked) {
          await clearSession()
          setError(blocked)
          return
        }

        // Registrar log de login no Supabase
        trackEvent('login', location.pathname)

        toast.success(`Bem-vindo de volta!`)
        // Se veio do checkout, redirecionar para lá após login bem-sucedido; senão, painel do papel real
        const pendingCheckout = sessionStorage.getItem('aura_pending_checkout')
        const target = fromCheckout && pendingCheckout ? '/checkout' : realRole && panelFor(realRole, volta)
        if (target) {
          redirected = true
          navigate(target)
        }
      } else {
        setError('E-mail ou senha incorretos')
      }
    } catch (err: any) {
      console.error('[Login] Erro capturado:', err)
      setError(err?.message || err?.error_description || 'E-mail ou senha incorretos')
    } finally {
      // Após navegar, o botão segue travado: assim o useEffect de "já autenticado" não navega de novo
      // (com v7_startTransition a troca de rota é adiada e ele rodaria antes dela).
      if (!redirected) setIsSubmitting(false)
    }
  }

  const handleMfaVerify = async (codigo: string) => {
    setError('')
    if (codigo.length !== 6 || !mfaChallenge || mfaStatus === 'verificando' || mfaStatus === 'ok') return

    setIsSubmitting(true)
    setMfaStatus('verificando')
    try {
      // Desafio novo a cada tentativa: o aberto ao entrar vence em minutos (era o "MFA challenge has expired")
      const novo = await supabase.auth.mfa.challenge({ factorId: mfaChallenge.factorId })
      if (novo.error) throw novo.error
      setMfaChallenge({ factorId: mfaChallenge.factorId, challengeId: novo.data.id })
      const verify = await supabase.auth.mfa.verify({
        factorId: mfaChallenge.factorId,
        challengeId: novo.data.id,
        code: codigo
      })

      if (verify.error) throw verify.error

      // Só agora (aal2) o banco entrega o perfil: papel real e bloqueio por endereço
      await useAuthStore.getState().fetchProfile({ force: true })
      const realRole = useAuthStore.getState().user?.role
      // Sem papel (perfil não carregou) não entra: fecha em erro, como no login sem 2FA
      const blocked = realRole ? blockedMessage(realRole) : 'Não foi possível confirmar o acesso desta conta. Tente de novo.'
      if (blocked) {
        await clearSession()
        setMfaStatus('idle')
        setStep('credentials')
        setError(blocked)
        return
      }
      trackEvent('login', location.pathname)
      setMfaStatus('ok')
      await new Promise(r => setTimeout(r, 700)) // deixa ver o ✓ verde antes de trocar de tela

      const pendingCheckout = sessionStorage.getItem('aura_pending_checkout')
      if (fromCheckout && pendingCheckout) {
        navigate('/checkout')
        return
      }

      // Redireciona pelo papel do perfil (profiles.role), nunca por user_metadata (editável pelo usuário)
      navigate(panelFor(realRole!, volta)) // papel nulo já foi barrado acima (blocked)
    } catch (err: any) {
      console.error('[MFA Verify] Erro:', err)
      setMfaStatus('erro')
      // Só o código errado ou vencido limpa as caixas; rede, servidor e perfil mantêm o que foi digitado
      const codigoErrado = err?.code === 'mfa_verification_failed' || err?.code === 'mfa_challenge_expired'
      if (codigoErrado) setMfaCode('')
      setError(
        err?.code === 'mfa_challenge_expired' ? 'O código venceu. Digite o código atual do app.'
          : err?.code === 'mfa_verification_failed' ? 'Código incorreto. Confira o app e tente de novo.'
          : err?.status === 429 ? 'Muitas tentativas. Espere um minuto e tente de novo.'
          : 'Não foi possível verificar agora. Confira a conexão e tente de novo.'
      )
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
            <img src="/images/logo-evokaa-sm.png" alt="Evokaa" className="h-10 w-auto" />
          </Link>
          <h1 className="font-serif text-2xl text-espresso">{isAdminMode ? 'Acesso administrativo' : 'Bem-vindo de volta'}</h1>
          {!isAdminMode && <p className="text-sm text-espresso/70 mt-1">Escolha seu perfil e entre</p>}
        </div>

        {/* Role Selection: alpha.* só Administrador; demais hosts só Participante e Produtor */}
        <div className="bg-white/60 border border-white/60 rounded-2xl p-1.5 mb-6 flex gap-1">
          {roles.filter(r => (r.value === 'admin') === isAdminMode).map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRole(r.value)}
              aria-label={r.label} // no celular só o ícone aparece: o nome fica para leitores de tela e testes
              aria-pressed={role === r.value}
              className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                role === r.value
                  ? r.value === 'admin'
                    ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                    : r.value === 'producer'
                    ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                    : 'bg-plum text-cream shadow-lg shadow-plum/20'
                  : 'text-espresso/70 hover:text-espresso'
              }`}
            >
              <r.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{r.label}</span>
            </button>
          ))}
        </div>

        {/* Role description */}
        {step !== 'mfa' && <div className={`p-4 rounded-2xl mb-6 text-center ${
          role === 'admin' ? 'bg-rose-50 border border-rose-100' :
          role === 'producer' ? 'bg-amber-50 border border-amber-100' :
          'bg-plum/5 border border-plum/10'
        }`}>
          <p className={`text-sm ${
            role === 'admin' ? 'text-rose-700' :
            role === 'producer' ? 'text-amber-700' :
            'text-plum'
          }`}>{currentRole.desc}</p>
        </div>}

        {/* Error */}
        {error && step !== 'mfa' && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-xs text-red-700 text-center">{error}</div>
        )}

        {/* Form */}
        {step === 'mfa' ? (
          <MfaCodigo
            codigo={mfaCode}
            status={mfaStatus}
            erro={error}
            onChange={v => { setMfaCode(v); if (mfaStatus === 'erro') { setMfaStatus('idle'); setError('') } }}
            onCompleto={handleMfaVerify}
            onVoltar={async () => {
              // Sai da sessão sem o código: senão o efeito "já autenticado" reabre este passo e a
              // sessão aal1 deixa o site vazio (o banco não entrega nada sem o código)
              await clearSession()
              setStep('credentials')
              setMfaChallenge(null)
              setMfaCode('')
              setMfaStatus('idle')
            }}
          />
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-espresso/70 mb-1.5 block">E-mail</label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-base md:text-sm text-espresso placeholder:text-espresso/70 focus:outline-none focus:border-plum/30 transition-colors disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-espresso/70 mb-1.5 block">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Sua senha"
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-base md:text-sm text-espresso placeholder:text-espresso/70 focus:outline-none focus:border-plum/30 transition-colors pr-10 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={showPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-espresso/70 hover:text-espresso transition-colors"
                  disabled={isSubmitting}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end">
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

            {/* Acesso administrativo: só e-mail e senha */}
            {!isAdminMode && (<>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-espresso/5" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-3 bg-canvas text-xs text-espresso/70">ou entrar com</span>
              </div>
            </div>

            <div className="space-y-2.5">
              {/* Quem entra por provedor não passa pelo cadastro: aceite explícito aqui; record-access grava no 1º login */}
              <label className="flex items-start gap-2 text-[11px] text-espresso/70 mb-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={socialConsent}
                  onChange={(e) => setSocialConsent(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 accent-plum"
                />
                <span>
                  Li e aceito os <a href="/termos" target="_blank" rel="noopener noreferrer" className="underline">Termos de Uso</a> e a <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="underline">Política de Privacidade</a> para entrar com Google.
                </span>
              </label>
              <button
                type="button"
                onClick={() => handleOAuthLogin('google')}
                disabled={isSubmitting || !socialConsent}
                className="w-full py-2.5 px-4 border border-espresso/15 text-espresso text-sm font-medium rounded-full hover:bg-espresso/5 transition-all disabled:opacity-50 flex items-center justify-center"
              >
                <GoogleIcon />
                <span>Entrar com Google</span>
              </button>
              {/* "Entrar com Apple" escondido por decisão do Ricardo (28/09/2026): só Google por ora.
                  A Apple exige o Apple Developer Program (US$ 99/ano); handleOAuthLogin('apple') continua pronto. */}
              {/* "Entrar com Microsoft" escondido até o app do Azure ser refeito (Decisão 23, 27/09/2026):
                  o Client ID atual devolve AADSTS65002. handleOAuthLogin('azure') continua pronto. */}
            </div>
            </>)}
          </form>
        )}

        {!isAdminMode && (<>
        <p className="text-center text-xs text-espresso/70 mt-6">
          Não tem conta?{' '}
          <Link to="/auth/register" onClick={() => guardarVolta(volta)} className="text-plum hover:underline">Criar conta</Link>
        </p>

        {/* App download hint */}
        <div className="mt-8 p-4 rounded-2xl bg-void text-cream text-center">
          <p className="text-xs text-cream/70 mb-2">Instale a Evokaa na tela inicial do celular</p>
          <Link
            to="/app/download"
            className="text-xs text-plum hover:text-cream transition-colors inline-flex items-center gap-1"
          >
            Ver como instalar <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        </>)}
      </div>
    </div>
  )
}
