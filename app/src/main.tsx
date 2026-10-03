import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import { queryClient } from './lib/queryClient.ts'
import { ouvirInstalacao } from './lib/instalar.ts'

// Depois de um deploy, a aba aberta pede um pedaço (layout ou página) que não existe mais: recarrega uma vez
// para pegar o index.html novo. Offline não recarrega (a página nova também não viria): o erro segue para quem pediu
// o pedaço, que mostra o aviso (ex.: folha Menu do celular). A trava de 10 s evita recarregar em laço.
window.addEventListener('vite:preloadError', () => {
  if (navigator.onLine === false) return
  try {
    const ultima = Number(sessionStorage.getItem('evk.recarga') || 0)
    if (Date.now() - ultima < 10_000) return
    sessionStorage.setItem('evk.recarga', String(Date.now()))
  } catch { /* sem sessionStorage: recarrega mesmo assim */ }
  window.location.reload()
})

ouvirInstalacao() // guarda o aviso de instalação do Chrome para a página /app/download

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
