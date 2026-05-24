import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, Lock, Loader2, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [validating, setValidating] = useState(true)
  const [valid, setValid] = useState(false)

  // O Supabase coloca o access_token no hash da URL (#access_token=...)
  // Precisamos detectar o evento PASSWORD_RECOVERY via onAuthStateChange
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setValid(true)
        setValidating(false)
      } else if (event === 'SIGNED_IN' && window.location.hash.includes('type=recovery')) {
        setValid(true)
        setValidating(false)
      } else {
        // Se não houver hash de recovery, pode ser que o usuário chegou aqui sem link
        // Verificamos se há hash na URL
        if (!window.location.hash && !session) {
          setValid(false)
          setValidating(false)
        } else if (window.location.hash) {
          setValid(true)
          setValidating(false)
        }
      }
    })

    // Verificação inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (window.location.hash.includes('access_token')) {
        setValid(true)
        setValidating(false)
      } else if (!session) {
        setValid(false)
        setValidating(false)
      } else {
        setValid(true)
        setValidating(false)
      }
    })

    return () => subscription.unsubscribe()
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
    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres')
      return
    }

    setIsSubmitting(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error

      setDone(true)
      toast.success('Senha alterada com sucesso!')
      // Desloga para forçar login com a nova senha
      await supabase.auth.signOut()
    } catch (err: any) {
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
          <p className="text-sm text-espresso/60">Validando link de recuperação...</p>
        </div>
      </div>
    )
  }

  if (!valid) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <img src="/images/logo-evokaa.png" alt="Aura" className="h-10 w-auto" />
          </Link>
          <div className="p-6 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm">
            <h1 className="font-serif text-xl text-espresso mb-2">Link inválido ou expirado</h1>
            <p className="text-sm text-espresso/50 mb-4">
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
            <img src="/images/logo-evokaa.png" alt="Aura" className="h-10 w-auto" />
          </Link>
          <h1 className="font-serif text-2xl text-espresso">Nova senha</h1>
          <p className="text-sm text-espresso/50 mt-1">
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
              <p className="text-xs text-espresso/50">
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
              <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Nova senha</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 transition-colors disabled:opacity-50 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-espresso/30 hover:text-espresso transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Confirmar nova senha</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 transition-colors disabled:opacity-50 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-espresso/30 hover:text-espresso transition-colors"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

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

            <p className="text-center text-xs text-espresso/40 mt-6">
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
