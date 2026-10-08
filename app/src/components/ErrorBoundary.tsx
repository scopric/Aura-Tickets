import { Component, type ReactNode } from 'react'
import { Home, RefreshCw } from 'lucide-react'

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
    // Depois de um deploy, a página aberta pede um arquivo que não existe mais: recarrega sozinho uma vez
    // (a cada 60 s no máximo, para não entrar em laço se o arquivo realmente sumiu).
    if (/dynamically imported module|Importing a module script failed|ChunkLoadError/i.test(error.message)) {
      try {
        const ultima = Number(sessionStorage.getItem('evk-chunk-reload') ?? 0)
        if (Date.now() - ultima > 60_000) {
          sessionStorage.setItem('evk-chunk-reload', String(Date.now()))
          window.location.reload()
        }
      } catch { /* sem sessionStorage: fica a tela de erro com o botão Recarregar */ }
    }
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
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-semibold mb-2">
              Algo deu errado
            </h1>
            <p className="text-muted-foreground text-sm mb-8">
              Ocorreu um erro inesperado. Tente recarregar a página ou volte para o início.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <pre className="text-left text-xs bg-muted text-muted-foreground p-4 rounded-lg mb-6 overflow-auto max-h-40">
                {this.state.error.message}
                {'\n'}
                {this.state.error.stack}
              </pre>
            )}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={this.handleReload}
                className="flex items-center gap-2 h-10 px-4 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Recarregar
              </button>
              {/* <a>, não <Link>: este boundary envolve o BrowserRouter e o fallback renderiza fora dele */}
              <a
                href="/"
                className="flex items-center gap-2 h-10 px-4 border border-input text-sm font-medium rounded-md hover:bg-accent transition-colors"
              >
                <Home className="w-4 h-4" />
                Início
              </a>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
