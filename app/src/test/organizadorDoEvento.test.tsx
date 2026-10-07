import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import BlocoOrganizador from '../components/BlocoOrganizador'
import { useOrganizadorDoEvento } from '../hooks/useOrganizadorDoEvento'

const rpc = vi.fn()
vi.mock('../lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }))

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
)

describe('useOrganizadorDoEvento', () => {
  beforeEach(() => rpc.mockReset())

  it('chama organizador_publico com o evento e devolve os dados', async () => {
    rpc.mockResolvedValue({ data: { nome: 'Bora' }, error: null })
    const { result } = renderHook(() => useOrganizadorDoEvento('e1'), { wrapper })
    await waitFor(() => expect(result.current.data).toEqual({ nome: 'Bora' }))
    expect(rpc).toHaveBeenCalledWith('organizador_publico', { p_evento: 'e1' })
  })

  it('null do banco vira null', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    const { result } = renderHook(() => useOrganizadorDoEvento('e1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })

  it('erro: falha sem tentar de novo', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('x') })
    const { result } = renderHook(() => useOrganizadorDoEvento('e1'), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})

describe('BlocoOrganizador', () => {
  it('nada quando null, undefined ou vazio', () => {
    const { container, rerender } = render(<BlocoOrganizador organizador={null} titulo="X" />)
    expect(container).toBeEmptyDOMElement()
    rerender(<BlocoOrganizador organizador={undefined} titulo="X" />)
    expect(container).toBeEmptyDOMElement()
    rerender(<BlocoOrganizador organizador={{}} titulo="X" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('só o nome: sem links nem CNPJ', () => {
    render(<BlocoOrganizador organizador={{ nome: 'Bora Dançar' }} titulo="X" />)
    expect(screen.getByRole('region', { name: 'Organizador' })).toBeInTheDocument()
    expect(screen.getByText('Bora Dançar')).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.queryByText(/CNPJ/)).toBeNull()
  })

  it('PJ mostra razão social e CNPJ formatado', () => {
    render(<BlocoOrganizador organizador={{ nome: 'Bora', razao_social: 'Bora Eventos LTDA', cnpj: '11222333000181' }} titulo="X" />)
    expect(screen.getByText('Bora Eventos LTDA · CNPJ 11.222.333/0001-81')).toBeInTheDocument()
  })

  it('links externos com rel e domínio; wa.me só com dígitos e mensagem codificada', () => {
    render(<BlocoOrganizador titulo="Noite & Forró" organizador={{
      nome: 'Bora', whatsapp: '5511999998888', instagram: 'bora.danca', site: 'https://www.bora.com.br/x',
      email: 'oi@bora.com.br', outras_redes: [{ rotulo: 'TikTok', url: 'https://tiktok.com/@bora' }],
    }} />)
    const wa = screen.getByRole('link', { name: /WhatsApp/ })
    expect(wa).toHaveAttribute('href', `https://wa.me/5511999998888?text=${encodeURIComponent('Olá! Vi o evento Noite & Forró na Evokaa.')}`)
    expect(screen.getByRole('link', { name: /Instagram/ })).toHaveAttribute('href', 'https://instagram.com/bora.danca')
    const site = screen.getByRole('link', { name: /Site/ })
    expect(site).toHaveTextContent('bora.com.br')
    expect(screen.getByRole('link', { name: /TikTok/ })).toHaveTextContent('tiktok.com')
    for (const a of [wa, site, screen.getByRole('link', { name: /TikTok/ })]) {
      expect(a).toHaveAttribute('target', '_blank')
      expect(a).toHaveAttribute('rel', 'noopener noreferrer nofollow')
    }
    expect(screen.getByRole('link', { name: /E-mail/ })).toHaveAttribute('href', 'mailto:oi@bora.com.br')
  })

  it('descarta URL não-https, esquemas perigosos e valores malformados', () => {
    render(<BlocoOrganizador titulo="X" organizador={{
      nome: 'Bora', whatsapp: '11999998888', instagram: 'a/b', site: 'http://bora.com',
      email: 'sem-arroba',
      outras_redes: [{ rotulo: 'A', url: 'javascript:alert(1)' }, { rotulo: 'B', url: 'http://x.com' }, { rotulo: 'C', url: 'https://user:pw@x.com' }],
    }} />)
    expect(screen.queryByRole('link')).toBeNull()
  })
})
