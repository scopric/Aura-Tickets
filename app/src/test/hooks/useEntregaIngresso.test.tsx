import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { supabase } from '@/lib/supabase'
import { useEntregaIngresso } from '../../hooks/useEntregaIngresso'

const invoke = vi.mocked(supabase.functions.invoke)

describe('useEntregaIngresso', () => {
  beforeEach(() => {
    invoke.mockReset()
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {}) // jsdom não navega
  })

  it('baixarPdf chama ticket-pdf com o pedido e baixa o arquivo', async () => {
    invoke.mockResolvedValueOnce({ data: new Blob(['%PDF']), error: null } as never)
    const { result } = renderHook(() => useEntregaIngresso('pedido-1'))
    await act(() => result.current.baixarPdf())
    expect(invoke).toHaveBeenCalledWith('ticket-pdf', { body: { orderId: 'pedido-1' } })
    expect(URL.createObjectURL).toHaveBeenCalled()
  })

  it('erro ao gerar o PDF não baixa nada', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: new Error('falhou') } as never)
    const { result } = renderHook(() => useEntregaIngresso('pedido-1'))
    await act(() => result.current.baixarPdf())
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(result.current.ocupado).toBeNull()
  })

  it('enviarEmail pede ticket_delivery do pedido', async () => {
    invoke.mockResolvedValueOnce({ data: { success: true }, error: null } as never)
    const { result } = renderHook(() => useEntregaIngresso('pedido-1'))
    await act(() => result.current.enviarEmail())
    expect(invoke).toHaveBeenCalledWith('send-email', { body: { orderId: 'pedido-1', emailType: 'ticket_delivery' } })
  })
})

describe('mensagem do servidor', () => {
  it('mostra o texto do 429 e cai no padrão quando não há corpo', async () => {
    const { mensagemDoServidor } = await import('../../hooks/useEntregaIngresso')
    const limite = { context: new Response(JSON.stringify({ error: 'Você já pediu 3 vezes' }), { status: 429 }) }
    expect(await mensagemDoServidor(limite, 'padrão')).toBe('Você já pediu 3 vezes')
    expect(await mensagemDoServidor(new Error('x'), 'padrão')).toBe('padrão')
  })
})
