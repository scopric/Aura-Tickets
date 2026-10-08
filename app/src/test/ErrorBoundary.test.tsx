import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom'
import RootErrorBoundary from '../components/ErrorBoundary'
import { ErrorBoundary } from '../components/error-boundary'

function Boom(): never {
  throw new Error('erro de teste')
}

describe('ErrorBoundary', () => {
  it('raiz: fallback fora do Router renderiza (sem <Link>) e mostra "Algo deu errado"', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <RootErrorBoundary>
        <Boom />
      </RootErrorBoundary>
    )
    expect(screen.getByText('Algo deu errado')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Início/ })).toHaveAttribute('href', '/')
  })

  it('área: erro numa tela não derruba o layout (menu continua na tela)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    function Layout() {
      return (
        <div>
          <nav>Menu do layout</nav>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      )
    }
    render(
      <MemoryRouter initialEntries={['/admin/finance']}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/admin/finance" element={<Boom />} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Menu do layout')).toBeInTheDocument()
    expect(screen.getByText('Algo deu errado')).toBeInTheDocument()
  })

  it('área: sai do estado de erro quando o resetKey muda (troca de rota), sem recarregar', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { rerender } = render(
      <ErrorBoundary resetKey="/admin/finance">
        <Boom />
      </ErrorBoundary>
    )
    expect(screen.getByText('Algo deu errado')).toBeInTheDocument()
    rerender(
      <ErrorBoundary resetKey="/admin/users">
        <p>Tela nova</p>
      </ErrorBoundary>
    )
    expect(screen.getByText('Tela nova')).toBeInTheDocument()
  })
})
