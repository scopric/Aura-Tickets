import { Component, type ReactNode } from 'react'
import { Home, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="font-serif text-6xl text-plum/20 mb-4">Ops</div>
            <h1 className="font-serif text-2xl text-espresso mb-2">
              Algo deu errado
            </h1>
            <p className="text-espresso/50 text-sm mb-8">
              Ocorreu um erro inesperado. Tente recarregar a pagina ou volte para o inicio.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <pre className="text-left text-xs bg-void text-cream/70 p-4 rounded-xl mb-6 overflow-auto max-h-40">
                {this.state.error.message}
                {'\n'}
                {this.state.error.stack}
              </pre>
            )}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={this.handleReload}
                className="flex items-center gap-2 px-6 py-3 bg-plum text-cream font-medium rounded-full hover:shadow-glow transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Recarregar
              </button>
              <Link
                to="/"
                className="flex items-center gap-2 px-6 py-3 border border-espresso/15 text-espresso font-medium rounded-full hover:bg-espresso/5 transition-all"
              >
                <Home className="w-4 h-4" />
                Inicio
              </Link>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
