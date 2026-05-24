import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Mail, Loader2, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanEmail = email.trim()
    if (!cleanEmail) {
      toast.error('Digite seu e-mail')
      return
    }

    setIsSubmitting(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/auth/reset`,
      })

      if (error) throw error

      setSent(true)
      toast.success('Link de recuperação enviado! Verifique seu e-mail.')
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar link de recuperação')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <img src="/images/logo-aura.png" alt="Aura" className="h-10 w-auto" />
          </Link>
          <h1 className="font-serif text-2xl text-espresso">Recuperar senha</h1>
          <p className="text-sm text-espresso/50 mt-1">
            {sent ? 'Verifique sua caixa de entrada' : 'Informe seu e-mail para receber o link'}
          </p>
        </div>

        {sent ? (
          <div className="p-6 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h2 className="text-sm font-medium text-espresso mb-1">E-mail enviado!</h2>
              <p className="text-xs text-espresso/50">
                Enviamos um link de recuperação para <strong>{email}</strong>.<br />
                Verifique sua caixa de entrada e spam.
              </p>
            </div>
            <Link
              to="/auth/login"
              className="inline-flex items-center gap-2 text-xs text-plum hover:underline"
            >
              <ArrowLeft className="w-3 h-3" /> Voltar para o login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-4 rounded-2xl bg-plum/5 border border-plum/10 mb-6">
              <p className="text-sm text-plum">
                Digite o e-mail da sua conta. Você receberá um link para criar uma nova senha.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-espresso/60 mb-1.5 block">E-mail</label>
              <div className="relative">
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 transition-colors disabled:opacity-50 pr-10"
                />
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-espresso/20" />
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
                  <span>Enviando...</span>
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span>Enviar link de recuperação</span>
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
