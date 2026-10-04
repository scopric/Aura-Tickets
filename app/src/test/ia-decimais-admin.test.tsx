import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PLANS } from '../lib/plans'

const cfg = {
  enabled: true, model_router: 'm1', model_simple: 'm1', model_complex: 'm1', model_vision: 'm1',
  prices: { m1: { in: 1, out: 2 } }, usd_brl: 5, daily_cap_brl: 100, hourly_limit: 20,
  quotas: Object.fromEntries(PLANS.map(p => [p.id, 10])), credit_cost: { simples: 1, complexo: 2, imagem: 3 },
  max_steps: 4, max_output_tokens: 1024,
}
const update = vi.fn()
vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: () => Promise.resolve({ data: null, error: null }),
    functions: { invoke: vi.fn() },
    from: () => {
      const q: any = {
        select: () => q, eq: () => q, order: () => q, limit: () => q,
        maybeSingle: () => Promise.resolve({ data: cfg, error: null }),
        update: (p: unknown) => { update(p); return { eq: () => ({ select: () => Promise.resolve({ data: [{ id: 1 }], error: null }) }) } },
        then: (ok: (v: unknown) => unknown) => ok({ data: [], error: null }),
      }
      return q
    },
  },
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })

import { toast } from 'sonner'
import AdminAiSettings from '../pages/admin/AiSettings'

const montar = () => render(<QueryClientProvider client={new QueryClient()}><AdminAiSettings /></QueryClientProvider>)

describe('Admin IA: campos numéricos', () => {
  beforeEach(() => { update.mockClear(); vi.mocked(toast.error).mockClear() })

  it('digitar "5,25" mantém o texto e salva 5.25', async () => {
    montar()
    const cot = (await screen.findByLabelText('Cotação do dólar (R$)')) as HTMLInputElement
    fireEvent.change(cot, { target: { value: '5,' } })
    expect(cot.value).toBe('5,')
    fireEvent.change(cot, { target: { value: '5,25' } })
    expect(cot.value).toBe('5,25')
    fireEvent.click(screen.getByRole('button', { name: /Salvar configurações/ }))
    await waitFor(() => expect(update).toHaveBeenCalled())
    expect(update.mock.calls[0][0].usd_brl).toBe(5.25)
  })

  it('cotação 25 é recusada', async () => {
    montar()
    const cot = await screen.findByLabelText('Cotação do dólar (R$)')
    fireEvent.change(cot, { target: { value: '25' } })
    fireEvent.click(screen.getByRole('button', { name: /Salvar configurações/ }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Cotação do dólar: entre 1 e 20 R$.'))
    expect(update).not.toHaveBeenCalled()
  })
})
