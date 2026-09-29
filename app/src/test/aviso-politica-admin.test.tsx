import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import AdminAiSettings from '../pages/admin/AiSettings'

// jsdom não tem ResizeObserver (Switch do Radix)
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })

const invoke = vi.mocked(supabase.functions.invoke)
const montar = () => {
  ;(supabase as unknown as { rpc: unknown }).rpc = vi.fn(() => Promise.resolve({ data: null, error: null }))
  return render(<QueryClientProvider client={new QueryClient()}><AdminAiSettings /></QueryClientProvider>)
}

describe('Admin IA: aviso da Política de Privacidade por e-mail', () => {
  beforeEach(() => invoke.mockReset())

  it('conta, só libera o envio com ENVIAR exato e mostra o resultado', async () => {
    invoke.mockResolvedValueOnce({ data: { ok: true, versao: '2026-09-29', destinatarios: 18 }, error: null } as never)
    invoke.mockResolvedValueOnce({ data: { ok: true, versao: '2026-09-29', enviados: 10, falhas: 1, restantes: 7 }, error: null } as never)
    montar()
    expect(screen.getByText('Envio único: quem já recebeu não recebe de novo.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Contar destinatários' }))
    expect(await screen.findByText('18 pessoas vão receber')).toBeInTheDocument()
    expect(invoke).toHaveBeenCalledWith('aviso-politica', { body: { mode: 'contar' } })

    const botao = screen.getByRole('button', { name: 'Enviar para 18 pessoas' })
    const campo = screen.getByLabelText('Digite ENVIAR para confirmar')
    expect(botao).toBeDisabled()
    fireEvent.change(campo, { target: { value: 'enviar' } })
    expect(botao).toBeDisabled()
    fireEvent.change(campo, { target: { value: 'ENVIAR ' } })
    expect(botao).toBeDisabled()
    fireEvent.change(campo, { target: { value: 'ENVIAR' } })
    expect(botao).toBeEnabled()

    fireEvent.click(botao)
    expect(await screen.findByText(/Enviados: 10 · Falhas: 1 · Restantes: 7/)).toBeInTheDocument()
    expect(screen.getByText('Clique de novo para continuar.')).toBeInTheDocument()
    expect(invoke).toHaveBeenLastCalledWith('aviso-politica', { body: { mode: 'enviar', confirmacao: 'ENVIAR' } })
    // pendentes = falhas + restantes
    expect(screen.getByRole('button', { name: 'Enviar para 8 pessoas' })).toBeEnabled()
  })

  it('zero destinatários mantém o envio desabilitado', async () => {
    invoke.mockResolvedValueOnce({ data: { ok: true, versao: '2026-09-29', destinatarios: 0 }, error: null } as never)
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Contar destinatários' }))
    expect(await screen.findByText('0 pessoas vão receber')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Digite ENVIAR para confirmar'), { target: { value: 'ENVIAR' } })
    expect(screen.getByRole('button', { name: 'Enviar para 0 pessoas' })).toBeDisabled()
  })

  it('erros honestos: não publicada e sem permissão (contar); sem Resend e sem resposta (enviar)', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: { name: 'FunctionsHttpError', message: 'x', context: new Response('', { status: 404 }) } } as never)
    invoke.mockResolvedValueOnce({ data: { ok: false, motivo: 'nao_autorizado' }, error: null } as never)
    invoke.mockResolvedValueOnce({ data: { ok: true, versao: '2026-09-29', destinatarios: 16 }, error: null } as never)
    invoke.mockResolvedValueOnce({ data: { ok: false, motivo: 'sem_resend' }, error: null } as never)
    invoke.mockResolvedValueOnce({ data: { ok: true, versao: '2026-09-29', destinatarios: 16 }, error: null } as never)
    invoke.mockResolvedValueOnce({ data: null, error: { name: 'FunctionsFetchError', message: 'Failed to fetch' } } as never)
    montar()
    const contar = screen.getByRole('button', { name: 'Contar destinatários' })
    fireEvent.click(contar)
    expect(await screen.findByText('Função de aviso ainda não publicada.')).toBeInTheDocument()
    fireEvent.click(contar)
    expect(await screen.findByText(/Sem permissão/)).toBeInTheDocument()

    const enviar = async () => {
      fireEvent.click(contar)
      expect(await screen.findByText('16 pessoas vão receber')).toBeInTheDocument()
      fireEvent.change(screen.getByLabelText('Digite ENVIAR para confirmar'), { target: { value: 'ENVIAR' } })
      fireEvent.click(screen.getByRole('button', { name: 'Enviar para 16 pessoas' }))
    }
    await enviar()
    expect(await screen.findByText(/RESEND_API_KEY/)).toBeInTheDocument()
    // erro no envio zera a contagem: é preciso contar de novo antes de repetir
    expect(screen.queryByText('16 pessoas vão receber')).toBeNull()
    await enviar()
    expect(await screen.findByText(/parte pode ter sido enviada/)).toBeInTheDocument()
  })
})
