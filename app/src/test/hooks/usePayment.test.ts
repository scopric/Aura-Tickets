import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePayment } from '../../hooks/usePayment'
import { supabase } from '../../lib/supabase'

const h = vi.hoisted(() => ({ token: vi.fn() }))
vi.mock('@/lib/recaptcha', () => ({ tokenRecaptcha: h.token }))

const http = (status: number, body?: unknown) => ({ data: null, error: { context: { status, json: async () => { if (body === undefined) throw new Error('sem corpo'); return body } } } })
const pagar = async () => {
  const { result } = renderHook(() => usePayment())
  let r!: Awaited<ReturnType<typeof result.current.pagarPix>>
  await act(async () => { r = await result.current.pagarPix({ orderId: 'o1', cpf: '529.982.247-25' }) })
  return r
}

describe('usePayment.pagarPix', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    let n = 0
    h.token.mockImplementation(async () => `tok-${++n}`)
  })

  it('chama pagbank-criar-pedido com token novo a cada tentativa e só os dígitos do CPF', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { order_id: 'o1', pix_copia_e_cola: '000201...', expira_em: '2026-10-08T15:00:00Z' }, error: null })
    const r = await pagar()
    await pagar()
    expect(r).toEqual({ ok: true, pixCopiaECola: '000201...', expiraEm: '2026-10-08T15:00:00Z' })
    const chamadas = vi.mocked(supabase.functions.invoke).mock.calls
    expect(chamadas[0][0]).toBe('pagbank-criar-pedido')
    expect(chamadas[0][1]).toEqual({ body: { order_id: 'o1', captcha_token: 'tok-1', customer: { tax_id: '52998224725' } } })
    expect((chamadas[1][1] as { body: { captcha_token: string } }).body.captcha_token).toBe('tok-2')
  })

  it('409: mensagem da função e refazerReserva', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue(http(409, { error: 'A reserva expirou. Refaça a reserva.' }) as never)
    expect(await pagar()).toEqual({ ok: false, mensagem: 'A reserva expirou. Refaça a reserva.', refazerReserva: true })
  })

  it('400: mensagem da função, sem refazer nem repetir', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue(http(400, { error: 'CPF inválido' }) as never)
    expect(await pagar()).toEqual({ ok: false, mensagem: 'CPF inválido' })
  })

  it('401: sessão expirada, sem tentarDeNovo', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue(http(401, { error: 'jwt' }) as never)
    expect(await pagar()).toEqual({ ok: false, mensagem: 'Sua sessão expirou, entre de novo.', sessaoExpirada: true })
  })

  it.each([429, 502, 503])('%i: tentarDeNovo', async (status) => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue(http(status, { error: 'x' }) as never)
    const r = await pagar()
    expect(r).toMatchObject({ ok: false, tentarDeNovo: true })
    expect(r).not.toHaveProperty('refazerReserva')
  })

  it('erro de rede (sem status): tentarDeNovo', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: null, error: { message: 'Failed to send a request' } } as never)
    expect(await pagar()).toMatchObject({ ok: false, tentarDeNovo: true })
  })

  it('sem chave do reCAPTCHA: "Pagamento indisponível" e a função nem é chamada', async () => {
    h.token.mockRejectedValue(new Error('Pagamento indisponível'))
    expect(await pagar()).toEqual({ ok: false, mensagem: 'Pagamento indisponível' })
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
  })
})
