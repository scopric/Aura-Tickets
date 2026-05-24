import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import Login from '../pages/auth/Login'

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('Login Component', () => {
  it('deve renderizar formulário de login', () => {
    render(<Login />, { wrapper: createWrapper() })

    expect(screen.getByText('Bem-vindo de volta')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('seu@email.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Sua senha')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Entrar/ })).toBeInTheDocument()
  })

  it('deve mostrar erro quando campos estão vazios', async () => {
    render(<Login />, { wrapper: createWrapper() })

    const submitButton = screen.getByRole('button', { name: /Entrar/ })
    fireEvent.click(submitButton)

    // Aguarda a mensagem de erro aparecer
    expect(await screen.findByText('Preencha e-mail e senha')).toBeInTheDocument()
  })

  it('deve ter link para recuperação de senha', () => {
    render(<Login />, { wrapper: createWrapper() })

    const forgotLink = screen.getByRole('link', { name: 'Esqueci a senha' })
    expect(forgotLink).toHaveAttribute('href', '/auth/forgot')
  })

  it('deve ter link para cadastro', () => {
    render(<Login />, { wrapper: createWrapper() })

    const registerLink = screen.getByRole('link', { name: 'Criar conta' })
    expect(registerLink).toHaveAttribute('href', '/auth/register')
  })
})
