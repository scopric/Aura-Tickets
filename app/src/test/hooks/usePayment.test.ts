import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePayment } from '../../hooks/usePayment'
import { supabase } from '../../lib/supabase'

describe('usePayment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deve processar pagamento com cartão de crédito', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { transactionId: 'txn_123', clientSecret: 'secret_123' },
      error: null,
    })

    const { result } = renderHook(() => usePayment())

    const paymentResult = await result.current.processPayment({
      orderId: 'order_123',
      method: 'credit_card',
      amount: 100,
      customerName: 'João Silva',
      customerEmail: 'joao@teste.com',
      customerCpf: '12345678901',
    })

    expect(paymentResult.status).toBe('pending')
    expect(paymentResult.transactionId).toBe('txn_123')
    expect(paymentResult.clientSecret).toBe('secret_123')
    expect(supabase.functions.invoke).toHaveBeenCalledWith('stripe-create-payment', expect.any(Object))
  })

  it('deve processar pagamento com Pix', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { chargeId: 'pix_123', qrCodeData: 'pix-copia-cola', qrCodeImageUrl: 'https://qr.pix/123' },
      error: null,
    })

    const { result } = renderHook(() => usePayment())

    const paymentResult = await result.current.processPayment({
      orderId: 'order_456',
      method: 'pix',
      amount: 50,
      customerName: 'Maria Souza',
      customerEmail: 'maria@teste.com',
      customerCpf: '98765432101',
    })

    expect(paymentResult.status).toBe('pending')
    expect(paymentResult.qrCodeData).toBe('pix-copia-cola')
    expect(paymentResult.qrCodeImageUrl).toBe('https://qr.pix/123')
    expect(supabase.functions.invoke).toHaveBeenCalledWith('woovi-create-pix', expect.any(Object))
  })

  it('deve retornar erro quando o gateway falha', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: { message: 'Gateway timeout' },
    })

    const { result } = renderHook(() => usePayment())

    const paymentResult = await result.current.processPayment({
      orderId: 'order_789',
      method: 'credit_card',
      amount: 200,
      customerName: 'Teste',
      customerEmail: 'teste@teste.com',
      customerCpf: '11122233344',
    })

    expect(paymentResult.status).toBe('error')
    expect(paymentResult.message).toContain('Gateway timeout')
  })

  it('deve retornar erro para método não suportado', async () => {
    const { result } = renderHook(() => usePayment())

    const paymentResult = await result.current.processPayment({
      orderId: 'order_000',
      method: 'boleto' as any,
      amount: 100,
      customerName: 'Teste',
      customerEmail: 'teste@teste.com',
      customerCpf: '11122233344',
    })

    expect(paymentResult.status).toBe('error')
    expect(paymentResult.message).toBe('Método de pagamento não suportado')
  })
})
