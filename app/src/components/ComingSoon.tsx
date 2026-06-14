import { Link } from 'react-router-dom'
import { Hammer, ArrowLeft } from 'lucide-react'

interface ComingSoonProps {
  /** Nome da ferramenta exibido ao usuário */
  title?: string
  /** Link de retorno (default: dashboard do produtor) */
  backTo?: string
}

/**
 * Tela honesta de "em construção" para funcionalidades ainda não finalizadas.
 * Usada para ocultar páginas que hoje exibiriam dados mockados, sem deletar o
 * código original (que permanece pronto para ser religado quando a feature ficar real).
 */
export default function ComingSoon({ title = 'Esta ferramenta', backTo = '/producer/dashboard' }: ComingSoonProps) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center p-8 rounded-3xl bg-white/60 border border-white/60 shadow-xl backdrop-blur-sm relative overflow-hidden">
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-40 h-40 bg-plum/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-16 h-16 rounded-2xl bg-plum/5 border border-plum/10 flex items-center justify-center mx-auto mb-6">
          <Hammer className="w-6 h-6 text-plum" />
        </div>

        <h2 className="font-serif text-2xl text-espresso mb-3">Em construção</h2>

        <p className="text-sm text-espresso/50 leading-relaxed mb-8">
          <strong className="text-espresso/70">{title}</strong> está sendo finalizada e ficará
          disponível em breve. Estamos trabalhando para entregá-la com dados reais e totalmente
          funcional.
        </p>

        <Link
          to={backTo}
          className="inline-flex items-center justify-center gap-1.5 px-6 py-2.5 bg-plum text-cream text-xs font-semibold rounded-full hover:shadow-glow transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar ao Dashboard</span>
        </Link>
      </div>
    </div>
  )
}

/**
 * Guard que oculta uma página atrás de uma flag de "em breve".
 * Enquanto `enabled` for false, renderiza <ComingSoon/> em vez do conteúdo real —
 * preservando o componente filho (import permanece válido) para religar no futuro.
 */
export function ComingSoonRoute({
  enabled = false,
  title,
  children,
}: {
  enabled?: boolean
  title?: string
  children: React.ReactNode
}) {
  if (enabled) return <>{children}</>
  return <ComingSoon title={title} />
}
