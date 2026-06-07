import React from 'react'
import { Link } from 'react-router-dom'
import { Lock, Crown, ArrowRight, ShieldAlert } from 'lucide-react'
import { useFeatures } from '../hooks/useFeatures'
import PageLoading from './PageLoading'

interface FeatureGuardProps {
  featureKey: string
  children: React.ReactNode
}

export default function FeatureGuard({ featureKey, children }: FeatureGuardProps) {
  const { hasFeature, isLoading } = useFeatures()

  if (isLoading) {
    return <PageLoading />
  }

  const hasAccess = hasFeature(featureKey)

  if (hasAccess) {
    return <>{children}</>
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center p-8 rounded-3xl bg-white/60 border border-white/60 shadow-xl backdrop-blur-sm relative overflow-hidden">
        {/* Glow de fundo */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-40 h-40 bg-plum/10 rounded-full blur-3xl pointer-events-none" />
        
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-plum/5 border border-plum/10 flex items-center justify-center mx-auto mb-6 relative">
          <Lock className="w-6 h-6 text-plum" />
          <Crown className="w-4 h-4 text-amber-500 absolute -top-1 -right-1 rotate-12" />
        </div>

        {/* Title */}
        <h2 className="font-serif text-2xl text-espresso mb-3">Funcionalidade Exclusiva</h2>
        
        {/* Desc */}
        <p className="text-sm text-espresso/50 leading-relaxed mb-6">
          A ferramenta correspondente ao código <code className="bg-slate-100 dark:bg-white/5 px-2 py-1 rounded text-xs text-plum font-semibold">{featureKey}</code> não está habilitada na sua conta no momento.
        </p>

        <div className="p-4 rounded-2xl bg-plum/5 border border-plum/10 text-left space-y-2.5 mb-8 text-xs text-espresso/70">
          <div className="flex items-start gap-2">
            <span className="text-plum font-bold">✓</span>
            <span>Você pode fazer upgrade para um plano superior para liberar este e outros recursos.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-plum font-bold">✓</span>
            <span>Solicite liberação manual de testes ou preços customizados diretamente com nosso Administrador.</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
          <Link 
            to="/producer/dashboard"
            className="w-full sm:w-auto px-6 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-espresso text-xs font-semibold rounded-full transition-all"
          >
            Voltar ao Dashboard
          </Link>
          <Link 
            to="/producer/assinatura"
            className="w-full sm:w-auto px-8 py-2.5 bg-plum text-cream text-xs font-semibold rounded-full hover:shadow-glow transition-all flex items-center justify-center gap-1.5"
          >
            <span>Fazer Upgrade</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}
