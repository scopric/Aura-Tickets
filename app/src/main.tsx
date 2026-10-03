import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import { queryClient } from './lib/queryClient.ts'

// Depois de um deploy, a aba aberta pede um pedaço (layout ou página) que não existe mais: recarrega uma vez
// para pegar o index.html novo. Sem rede o erro volta; a trava de 10 s evita recarregar em laço.
window.addEventListener('vite:preloadError', () => {
  try {
    const ultima = Number(sessionStorage.getItem('evk.recarga') || 0)
    if (Date.now() - ultima < 10_000) return
    sessionStorage.setItem('evk.recarga', String(Date.now()))
  } catch { /* sem sessionStorage: recarrega mesmo assim */ }
  window.location.reload()
})

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
