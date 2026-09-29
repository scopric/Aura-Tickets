import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, Lock, Loader2, CheckCircle2 } from 'lucide-react'
import { supabase, initialAuthHash } from '../../lib/supabase'
import { toast } from 'sonner'
import { passwordError, PASSWORD_HINT } from '../../lib/password'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [validating, setValidating] = useState(true)
  const [valid, setValid] = useState(false)
  // Conta com 2FA: o Supabase só troca a senha numa sessão aal2, e o link de recuperação abre em aal1
  const [mfaCode, setMfaCode] = useState('')
  const [needsCode, setNeedsCode] = useState(false)

  // Só aceita a sessão criada pelo link de recuperação (#…&type=recovery). Link com erro
  // (expirado/já usado) ou uma sessão comum já aberta (ex.: admin logado) não trocam senha aqui.
  useEffect(() => {
    if (initialAuthHash.get('error') || initialAuthHash.get('type') !== 'recovery') {
      setValid(false)
      setValidating(false)
      return
    }
    // getSession aguarda o supabase-js terminar de processar o link. Se o link falhar, a sessão
    // antiga (ex.: admin logado) é mantida — por isso exige que seja a sessão criada pelo link.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const ok = !!session && session.access_token === initialAuthHash.get('access_token')
      if (ok) {
        const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        setNeedsCode(data?.currentLevel === 'aal1' && data?.nextLevel === 'aal2')
      }
      setValid(ok)
      setValidating(false)
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!password || !confirmPassword) {
      toast.error('Preencha todos os campos')
      return
    }
    if (password !== confirmPassword) {
      toast.error('As senhas não conferem')
      return
    }
    const pw = passwordError(password)
    if (pw) {
      toast.error(pw)
      return
    }

    if (needsCode && mfaCode.length !== 6) {
      toast.error('Digite o código de 6 dígitos do aplicativo autenticador')
      return
    }

    setIsSubmitting(true)
    try {
      if (needsCode) {
        const { data: factors, error: listError } = await supabase.auth.mfa.listFactors()
        if (listError) throw listError
        const factorId = factors.totp[0]?.id
        if (!factorId) throw new Error('Não encontramos o autenticador desta conta. Fale com o suporte.')
        const { error: codeError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: mfaCode })
        if (codeError) throw new Error('Código do autenticador inválido. Confira o aplicativo e tente de novo.')
        setNeedsCode(false)
      }
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error

      setDone(true)
      toast.success('Senha alterada com sucesso!')
      // Desloga para forçar login com a nova senha
      await supabase.auth.signOut()
    } catch (err: any) {
      if (err?.code === 'insufficient_aal') {
        setNeedsCode(true)
        toast.error('Digite também o código do aplicativo autenticador')
        return
      }
      toast.error(err.message || 'Erro ao alterar senha')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (validating) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-plum animate-spin mx-auto mb-4" />
          <p className="text-sm text-espresso/70">Validando link de recuperação...</p>
        </div>
      </div>
    )
  }

  if (!valid) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <img src="/images/logo-evokaa.png" alt="Evokaa" className="h-10 w-auto" />
          </Link>
          <div className="p-6 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm">
            <h1 className="font-serif text-xl text-espresso mb-2">Link inválido ou expirado</h1>
            <p className="text-sm text-espresso/70 mb-4">
              Solicite um novo link de recuperação de senha.
            </p>
            <Link
              to="/auth/forgot"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-plum text-cream text-sm rounded-full hover:shadow-glow transition-all"
            >
              <ArrowLeft className="w-3 h-3" /> Solicitar novo link
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <img src="/images/logo-evokaa.png" alt="Evokaa" className="h-10 w-auto" />
          </Link>
          <h1 className="font-serif text-2xl text-espresso">Nova senha</h1>
          <p className="text-sm text-espresso/70 mt-1">
            {done ? 'Sua senha foi atualizada' : 'Crie uma nova senha para sua conta'}
          </p>
        </div>

        {done ? (
          <div className="p-6 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h2 className="text-sm font-medium text-espresso mb-1">Senha alterada!</h2>
              <p className="text-xs text-espresso/70">
                Sua senha foi atualizada com sucesso. Faça login novamente.
              </p>
            </div>
            <Link
              to="/auth/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-plum text-cream text-sm rounded-full hover:shadow-glow transition-all"
            >
              <ArrowLeft className="w-3 h-3" /> Ir para o login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-espresso/70 mb-1.5 block">Nova senha</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Nova senha"
                  aria-describedby="password-hint"
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/70 focus:outline-none focus:border-plum/30 transition-colors disabled:opacity-50 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-espresso/70 hover:text-espresso transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p id="password-hint" className="text-[10px] text-espresso/70 mt-1">{PASSWORD_HINT}</p>
            </div>

            <div>
              <label className="text-xs font-medium text-espresso/70 mb-1.5 block">Confirmar nova senha</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/70 focus:outline-none focus:border-plum/30 transition-colors disabled:opacity-50 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-espresso/70 hover:text-espresso transition-colors"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {needsCode && (
              <div>
                <label htmlFor="reset-mfa" className="text-xs font-medium text-espresso/70 mb-1.5 block">Código do aplicativo autenticador (2FA)</label>
                <input
                  id="reset-mfa"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-center text-lg font-mono tracking-widest text-espresso placeholder:text-espresso/70 focus:outline-none focus:border-plum/30 transition-colors disabled:opacity-50"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-plum text-cream font-medium rounded-full hover:shadow-glow transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Lock className="w-4 h-4" />
                  <span>Alterar senha</span>
                </span>
              )}
            </button>

            <p className="text-center text-xs text-espresso/70 mt-6">
              <Link to="/auth/login" className="text-plum hover:underline inline-flex items-center gap-1">
                <ArrowLeft className="w-3 h-3" /> Voltar para o login
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
