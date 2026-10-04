import React from 'react'
import { Link } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useFeatures } from '../hooks/useFeatures'
import PageLoading from './PageLoading'
import { Button } from '@/components/ui/button'

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

  // Só tokens (Decisão 112): a rota /producer/lugar-marcado usa o guard fora do ProducerLayout.
  // "Recurso fora do seu plano" fica: e2e-front-1b procura esse texto.
  // ponytail: sem "Fazer Upgrade" (a Assinatura está escondida e levava à tela "Em construção"). Com o
  // pagamento de planos no ar, voltar o botão para /producer/assinatura e tirar o "em breve" do texto.
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="w-full max-w-md rounded-[10px] border border-border bg-card p-6 text-center">
        <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted">
          <Lock aria-hidden="true" className="size-4 text-muted-foreground" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-foreground">Recurso fora do seu plano</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta ferramenta não está liberada na sua conta. Os planos pagos chegam em breve; até lá, peça a liberação à equipe da Evokaa.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          <Button asChild variant="outline">
            <Link to="/producer/dashboard">Voltar ao início</Link>
          </Button>
          <Button asChild>
            <Link to="/contato">Falar com a equipe</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
