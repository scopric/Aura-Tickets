import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight, User, Building, Loader2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import type { Role } from '../../types/auth'
import { toast } from 'sonner'
import AuthLGPDConsent from '../../components/AuthLGPDConsent'
import AuthAcquisitionSelector from '../../components/AuthAcquisitionSelector'

export default function AuthRegister() {
  const navigate = useNavigate()
  const { register, isAuthenticated, role: currentRoleContext } = useAuth()
  const [step, setStep] = useState(1)
  const [showPassword, setShowPassword] = useState(false)
  const [type, setType] = useState<Role>('producer')
  const [name, setName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Estados de privacidade e aquisição (LGPD)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false)
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [dataSharingConsent, setDataSharingConsent] = useState(false)
  const [howDidYouHear, setHowDidYouHear] = useState('')
  const [referralEmail, setReferralEmail] = useState('')

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && currentRoleContext) {
      if (currentRoleContext === 'admin') navigate('/admin/dashboard')
      else if (currentRoleContext === 'producer') navigate('/producer/dashboard')
      else navigate('/app/hub')
    }
  }, [isAuthenticated, currentRoleContext, navigate])

  const validateStep1 = () => {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Nome obrigatório'
    if (!lastName.trim()) e.lastName = 'Sobrenome obrigatório'
    if (!email.trim()) e.email = 'E-mail obrigatório'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'E-mail inválido'
    if (!password) e.password = 'Senha obrigatória'
    else if (password.length < 6) e.password = 'Mínimo 6 caracteres'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateStep1()) {
      setStep(2)
    } else {
      toast.error('Corrija os campos do primeiro passo para prosseguir')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateStep1()) {
      setStep(1)
      toast.error('Corrija os erros de dados no primeiro passo')
      return
    }

    const eErrors: Record<string, string> = {}
    if (!acceptedTerms) eErrors.terms = 'Você deve aceitar os Termos de Uso'
    if (!acceptedPrivacy) eErrors.privacy = 'Você deve aceitar a Política de Privacidade'
    setErrors(eErrors)

    if (Object.keys(eErrors).length > 0) {
      toast.error('Você precisa aceitar os Termos de Uso e a Política de Privacidade.')
      return
    }
    
    setIsSubmitting(true)
    const fullName = `${name.trim()} ${lastName.trim()}`
    const success = await register(fullName, email.trim(), password, type, {
      acceptedTerms,
      acceptedPrivacy,
      marketingConsent,
      dataSharingConsent,
      howDidYouHear,
      referralEmail
    })
    
    if (success) {
      toast.success('Conta criada com sucesso!')
      setTimeout(() => {
        if (!isAuthenticated) {
          navigate('/auth/login')
        }
      }, 1500)
    }
    setIsSubmitting(false)
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <img src="/images/logo-evokaa.png" alt="Evokaa" className="h-10 w-auto" />
          </Link>
          <h1 className="font-serif text-2xl text-espresso">Criar conta</h1>
          <p className="text-sm text-espresso/50 mt-1">Comece a criar eventos ou participar</p>
        </div>

        {/* Indicador de Passos/Etapas */}
        <div className="flex flex-col gap-2 mb-6">
          <div className="flex gap-2">
            <div className="flex-1 h-1 rounded-full bg-plum transition-all duration-300" />
            <div className={`flex-1 h-1 rounded-full transition-all duration-300 ${step === 2 ? 'bg-plum' : 'bg-espresso/10'}`} />
          </div>
          <div className="flex justify-between items-center text-[10px] uppercase tracking-wider font-extrabold text-espresso/40">
            <span>Passo {step} de 2</span>
            <span>{step === 1 ? 'Identificação' : 'Preferências & Termos'}</span>
          </div>
        </div>

        {step === 1 ? (
          <form onSubmit={handleNextStep} className="space-y-4">
            <div className="flex items-center bg-white/60 border border-white/60 rounded-full p-1 mb-2">
              <button 
                type="button"
                onClick={() => setType('producer')} 
                className={`flex-1 py-2 text-xs font-medium rounded-full transition-all flex items-center justify-center gap-1.5 ${type === 'producer' ? 'bg-plum text-cream' : 'text-espresso/50'}`}
              >
                <Building className="w-3.5 h-3.5" />Produtor
              </button>
              <button 
                type="button"
                onClick={() => setType('user')} 
                className={`flex-1 py-2 text-xs font-medium rounded-full transition-all flex items-center justify-center gap-1.5 ${type === 'user' ? 'bg-plum text-cream' : 'text-espresso/50'}`}
              >
                <User className="w-3.5 h-3.5" />Participante
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Nome</label>
                <input
                  type="text"
                  value={name}
                  disabled={isSubmitting}
                  onChange={e => { setName(e.target.value); if (errors.name) setErrors(p => { const n = { ...p }; delete n.name; return n }) }}
                  placeholder="Seu nome"
                  className={`w-full px-4 py-3 bg-white/60 border rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 transition-colors disabled:opacity-50 ${errors.name ? 'border-red-300' : 'border-white/60'}`}
                />
                {errors.name && <p className="text-[10px] text-red-500 mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Sobrenome</label>
                <input
                  type="text"
                  value={lastName}
                  disabled={isSubmitting}
                  onChange={e => { setLastName(e.target.value); if (errors.lastName) setErrors(p => { const n = { ...p }; delete n.lastName; return n }) }}
                  placeholder="Sobrenome"
                  className={`w-full px-4 py-3 bg-white/60 border rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 transition-colors disabled:opacity-50 ${errors.lastName ? 'border-red-300' : 'border-white/60'}`}
                />
                {errors.lastName && <p className="text-[10px] text-red-500 mt-1">{errors.lastName}</p>}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-espresso/60 mb-1.5 block">E-mail</label>
              <input
                type="email"
                value={email}
                disabled={isSubmitting}
                onChange={e => { setEmail(e.target.value); if (errors.email) setErrors(p => { const n = { ...p }; delete n.email; return n }) }}
                placeholder="seu@email.com"
                className={`w-full px-4 py-3 bg-white/60 border rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 transition-colors disabled:opacity-50 ${errors.email ? 'border-red-300' : 'border-white/60'}`}
              />
              {errors.email && <p className="text-[10px] text-red-500 mt-1">{errors.email}</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  disabled={isSubmitting}
                  onChange={e => { setPassword(e.target.value); if (errors.password) setErrors(p => { const n = { ...p }; delete n.password; return n }) }}
                  placeholder="Mínimo 6 caracteres"
                  className={`w-full px-4 py-3 bg-white/60 border rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 transition-colors pr-10 disabled:opacity-50 ${errors.password ? 'border-red-300' : 'border-white/60'}`}
                />
                <button type="button" disabled={isSubmitting} onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-espresso/30 hover:text-espresso transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-[10px] text-red-500 mt-1">{errors.password}</p>}
            </div>

            <button 
              type="submit" 
              className="w-full py-3 bg-plum text-cream font-medium rounded-full hover:shadow-glow transition-all flex items-center justify-center gap-2 mt-2"
            >
              <span>Avançar</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Componente de Canal de Aquisição */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-espresso/60 block">Como nos conheceu?</label>
              <AuthAcquisitionSelector
                value={howDidYouHear}
                referralEmail={referralEmail}
                onChange={(value, email) => {
                  setHowDidYouHear(value)
                  if (email) setReferralEmail(email)
                }}
              />
            </div>

            {/* Componente de Consentimento LGPD */}
            <AuthLGPDConsent
              acceptedTerms={acceptedTerms}
              acceptedPrivacy={acceptedPrivacy}
              marketingConsent={marketingConsent}
              dataSharingConsent={dataSharingConsent}
              onChange={(values) => {
                setAcceptedTerms(values.acceptedTerms)
                setAcceptedPrivacy(values.acceptedPrivacy)
                setMarketingConsent(values.marketingConsent)
                setDataSharingConsent(values.dataSharingConsent)
              }}
            />

            {(errors.terms || errors.privacy) && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-xs text-red-600 text-center">
                {errors.terms || errors.privacy}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button 
                type="submit" 
                disabled={isSubmitting || !acceptedTerms || !acceptedPrivacy}
                className="w-full py-3 bg-plum text-cream font-medium rounded-full hover:shadow-glow transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Criando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Criar Conta <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setStep(1)}
                className="w-full py-2.5 bg-transparent text-espresso/60 hover:text-espresso font-medium text-xs rounded-full transition-all border border-espresso/10 hover:bg-espresso/5 disabled:opacity-50"
              >
                Voltar para os dados cadastrais
              </button>
            </div>
          </form>
        )}

        <p className="text-center text-xs text-espresso/40 mt-6">
          Já tem conta? <Link to="/auth/login" className="text-plum hover:underline">Entrar</Link>
        </p>
      </div>
    </div>
  )
}
