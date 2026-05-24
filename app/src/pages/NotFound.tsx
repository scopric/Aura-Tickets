import { Link } from 'react-router-dom'
import { Home, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
      <div className="text-center">
        <div className="font-serif text-9xl text-plum/10 mb-4">404</div>
        <h1 className="font-serif text-3xl text-espresso mb-2">Pagina nao encontrada</h1>
        <p className="text-espresso/50 text-sm mb-8 max-w-md mx-auto">A pagina que voce esta procurando nao existe ou foi movida. Verifique o endereco ou volte para o inicio.</p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/" className="flex items-center gap-2 px-6 py-3 bg-plum text-cream font-medium rounded-full hover:shadow-glow transition-all">
            <Home className="w-4 h-4" />
            Voltar ao inicio
          </Link>
          <button onClick={() => window.history.back()} className="flex items-center gap-2 px-6 py-3 border border-espresso/15 text-espresso font-medium rounded-full hover:bg-espresso/5 transition-all">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
        </div>
      </div>
    </div>
  )
}
