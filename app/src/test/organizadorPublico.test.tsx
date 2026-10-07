import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import OrganizadorPublico from '../components/producer/OrganizadorPublico'

const rpc = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { rpc } }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('sonner', () => ({ toast }))

const linha = {
  nome_publico: 'Paula Eventos', whatsapp: '5511987654321', instagram: 'paula.eventos', site: 'https://paula.com.br',
  email_contato: 'p@x.com', outras_redes: [{ rotulo: 'TikTok', url: 'https://tiktok.com/@paula' }],
  mostrar_nome: true, mostrar_whatsapp: true, mostrar_instagram: false, mostrar_site: false, mostrar_email: false, mostrar_outras_redes: false,
  cnpj: '11222333000181',
}

function montar(leitura: unknown, salvar: unknown = { data: null, error: null }) {
  rpc.mockImplementation((nome: string) => Promise.resolve(nome === 'meu_organizador_publico' ? { data: leitura, error: null } : salvar))
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={qc}><OrganizadorPublico /></QueryClientProvider>)
}

describe('OrganizadorPublico', () => {
  beforeEach(() => { rpc.mockReset(); toast.success.mockReset(); toast.error.mockReset() })

  it('mostra os dados, o CNPJ somente leitura e os avisos', async () => {
    montar(linha)
    expect(await screen.findByDisplayValue('Paula Eventos')).toBeInTheDocument()
    expect(screen.getByDisplayValue('11.222.333/0001-81')).toHaveAttribute('readonly')
    expect(screen.getByText(/CNPJ do seu cadastro \(aba Perfil\) aparecem sempre/)).toBeInTheDocument()
    expect(screen.getByText(/Desligar um campo o esconde na hora/)).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /Mostrar WhatsApp/ })).toBeChecked()
    expect(screen.getByRole('switch', { name: /Mostrar Site/ })).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
  })

  it('sem dados salvos: só o nome ligado e sem CNPJ', async () => {
    montar(null)
    expect(await screen.findByLabelText('Nome do organizador')).toHaveValue('')
    expect(screen.getByRole('switch', { name: /Mostrar Nome/ })).toBeChecked()
    expect(screen.getByRole('switch', { name: /Mostrar E-mail/ })).not.toBeChecked()
    expect(screen.queryByLabelText('CNPJ do cadastro')).toBeNull()
  })

  it('valida por campo e não chama a RPC de salvar', async () => {
    montar(linha)
    fireEvent.change(await screen.findByLabelText('Nome do organizador'), { target: { value: 'Evokaa Shows' } })
    fireEvent.change(screen.getByLabelText('Site'), { target: { value: 'http://x.com' } })
    fireEvent.change(screen.getByLabelText('Instagram'), { target: { value: 'a b' } })
    fireEvent.change(screen.getByLabelText('E-mail de contato'), { target: { value: 'sem-arroba' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText(/não pode conter "Evokaa"/)).toBeInTheDocument()
    expect(screen.getByText(/comece com https:\/\/$/, { selector: '[role=alert]' })).toBeInTheDocument()
    expect(screen.getByText(/letras, números, ponto/)).toBeInTheDocument()
    expect(screen.getByText('Informe um e-mail válido.')).toBeInTheDocument()
    expect(screen.getByLabelText('Nome do organizador')).toHaveAttribute('aria-describedby', 'org-nome-erro')
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('salva chamando a RPC com os 12 parâmetros', async () => {
    montar(linha)
    fireEvent.change(await screen.findByLabelText('Instagram'), { target: { value: '@paula' } })
    fireEvent.click(screen.getByRole('switch', { name: /Mostrar Site/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    expect(rpc).toHaveBeenCalledWith('salvar_organizador_publico', {
      p_nome_publico: 'Paula Eventos', p_whatsapp: '11987654321', p_instagram: 'paula', p_site: 'https://paula.com.br',
      p_email_contato: 'p@x.com', p_outras_redes: [{ rotulo: 'TikTok', url: 'https://tiktok.com/@paula' }],
      p_mostrar_nome: true, p_mostrar_whatsapp: true, p_mostrar_instagram: false, p_mostrar_site: true,
      p_mostrar_email: false, p_mostrar_outras_redes: false,
    })
  })

  it('erro 42501 vira aviso de segundo fator e 23514 de formato', async () => {
    montar(linha, { data: null, error: { code: '42501' } })
    fireEvent.change(await screen.findByLabelText('Nome do organizador'), { target: { value: 'Outro nome' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/segundo fator/)))
    rpc.mockImplementation((n: string) => Promise.resolve(n === 'meu_organizador_publico' ? { data: linha, error: null } : { data: null, error: { code: '23514' } }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/formato inválido/)))
  })

  it.each(['https://linktr.ee?utm=1', 'https://site.com:8080', 'https://café.com.br', 'https://localhost'])('recusa no cliente o site %s', async url => {
    montar(linha)
    fireEvent.change(await screen.findByLabelText('Site'), { target: { value: url } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText(/comece com https:\/\/$/, { selector: '[role=alert]' })).toBeInTheDocument()
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('recusa redes que passam do limite de 1000 caracteres do banco', async () => {
    const redes = Array.from({ length: 5 }, (_, i) => ({ rotulo: `R${i}`, url: `https://a.com/${'x'.repeat(180)}` }))
    montar({ ...linha, outras_redes: redes.map(r => ({ ...r, url: 'https://a.com' })) })
    fireEvent.change(await screen.findByLabelText('Endereço da rede 1'), { target: { value: redes[0].url } })
    for (let i = 2; i <= 5; i++) fireEvent.change(screen.getByLabelText(`Endereço da rede ${i}`), { target: { value: redes[i - 1].url } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Encurte os endereços das redes')).toBeInTheDocument()
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('42501 ao carregar pede o segundo fator em vez de "Tentar de novo"', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501' } })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={qc}><OrganizadorPublico /></QueryClientProvider>)
    expect(await screen.findByText(/Confirme o segundo fator de novo/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Tentar de novo/ })).toBeNull()
  })

  it('WhatsApp inválido: erro ligado ao campo e foco nele', async () => {
    montar(linha)
    const tel = (await screen.findByDisplayValue('(11) 98765-4321')) as HTMLInputElement
    fireEvent.change(tel, { target: { value: '123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await screen.findByText(/DDD e o número/)
    expect(tel).toHaveAttribute('aria-invalid', 'true')
    expect(tel).toHaveAttribute('aria-describedby', 'org-whatsapp-erro')
    expect(tel).toHaveFocus()
  })
})
