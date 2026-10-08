import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import Checkout from '../pages/checkout/Checkout'

// Tela 06 fatia 2: meia-entrada no pedido. O preço e as vagas da meia vêm de vitrine_ingressos (só o Checkout lê).
const h = vi.hoisted(() => ({ estado: null as unknown, vitrine: [] as unknown[] }))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: true, user: { id: 'u1', birth_date: '1990-01-01' } }) }))
vi.mock('../hooks/useEvents', () => ({
  usePublicEvent: () => ({
    isLoading: false, error: null,
    data: { id: 'e1', title: 'Festa', start_date: '2099-01-01T21:00:00Z', date: '2099-01-01', time: '18:00', ticket_types: [{ id: 'tt1', name: 'Pista', price: 50, type: 'individual', quantity_total: 100, sold: 0 }] },
  }),
}))
vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: async (nome: string) => ({ data: nome === 'vitrine_ingressos' ? h.vitrine : null, error: null }),
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }),
  },
}))

const VITRINE = [{ ticket_type_id: 'tt1', nome: 'Pista', preco: 50, taxa: 5, preco_meia: 25, taxa_meia: 3, permite_meia: true, disponiveis: 90, meias_disponiveis: 2, meias_total: 40 }]

function Destino() { h.estado = useLocation().state; return <p>pagamento</p> }
const montar = (cart: Record<string, number>) => render(
  <MemoryRouter initialEntries={[{ pathname: '/checkout', state: { eventId: 'e1', cart } }]}>
    <Routes><Route path="/checkout" element={<Checkout />} /><Route path="/checkout/payment" element={<Destino />} /></Routes>
  </MemoryRouter>
)

describe('Checkout: meia-entrada', () => {
  beforeEach(() => { sessionStorage.clear(); h.estado = null; h.vitrine = VITRINE })

  it('1 inteira + 2 meias: o resumo leva beneficio, meia_tipo, preço e taxa da meia', async () => {
    montar({ 'tt1|inteira|': 1, 'tt1|meia|pcd': 2 })
    await screen.findByText('2 × Pista (meia-entrada)')
    // 50 + 2 × 25 = 100; taxa 5 + 2 × 3 = 11
    fireEvent.click(screen.getByRole('button', { name: /Continuar para Pagamento/ }))
    await waitFor(() => expect(h.estado).not.toBeNull())
    const st = h.estado as { cart: Record<string, number>; itemsSummary: Record<string, unknown>[]; totalAmount: number }
    expect(st.totalAmount).toBe(111)
    expect(st.itemsSummary).toEqual([
      expect.objectContaining({ ticket_type_id: 'tt1', quantity: 1, price: 50, beneficio: 'inteira', meia_tipo: null }),
      expect.objectContaining({ ticket_type_id: 'tt1', quantity: 2, price: 25, taxa_unit: 3, beneficio: 'meia', meia_tipo: 'pcd' }),
    ])
  })

  it('carrinho antigo (chave só com o id) é lido como inteira', async () => {
    h.vitrine = []
    montar({ tt1: 2 })
    await screen.findByText('2 × Pista')
    fireEvent.click(screen.getByRole('button', { name: /Continuar para Pagamento/ }))
    await waitFor(() => expect(h.estado).not.toBeNull())
    expect((h.estado as { itemsSummary: unknown[] }).itemsSummary).toEqual([expect.objectContaining({ quantity: 2, beneficio: 'inteira', meia_tipo: null })])
  })

  it('tipo com permite_meia mostra a linha, a declaração e limita o mais por meias_disponiveis; troca de benefício leva a quantidade', async () => {
    montar({})
    const mais = await screen.findByRole('button', { name: 'Adicionar um Pista (meia-entrada)' })
    expect(screen.getByText(/apresentará o documento/)).toBeTruthy()
    fireEvent.click(mais); fireEvent.click(mais); fireEvent.click(mais)
    expect(screen.getByText('2 Pista (meia-entrada)')).toBeTruthy() // parou em meias_disponiveis = 2
    fireEvent.change(screen.getByLabelText('Quem tem direito à meia'), { target: { value: 'jovem_baixa_renda' } })
    fireEvent.click(screen.getByRole('button', { name: /Continuar para Pagamento/ }))
    await waitFor(() => expect(h.estado).not.toBeNull())
    expect((h.estado as { itemsSummary: unknown[] }).itemsSummary).toEqual([expect.objectContaining({ quantity: 2, beneficio: 'meia', meia_tipo: 'jovem_baixa_renda' })])
  })

  it('a linha da meia mostra a taxa de 10% sem o piso de R$ 3 (preço R$ 12,50 → taxa R$ 1,25)', async () => {
    h.vitrine = [{ ...VITRINE[0], preco_meia: 12.5, taxa_meia: 1.25 }]
    montar({})
    await screen.findByText(/R\$\s12,50 \+ taxa R\$\s1,25 = R\$\s13,75 cada/)
  })

  it('tipo sem permite_meia não mostra a linha de meia', async () => {
    h.vitrine = [{ ...VITRINE[0], permite_meia: false, preco_meia: null, taxa_meia: null, meias_disponiveis: 0, meias_total: 0 }]
    montar({})
    await screen.findByText('Pista')
    await new Promise(r => setTimeout(r, 20))
    expect(screen.queryByText('Meia-entrada')).toBeNull()
  })

  it('duas chaves de meia do mesmo tipo viram uma só (a contagem do teto bate com a tela)', async () => {
    montar({ 'tt1|meia|pcd': 1, 'tt1|meia|estudante': 1 })
    await screen.findByText('2 × Pista (meia-entrada)')
    expect(screen.getAllByText(/× Pista/)).toHaveLength(1)
  })

  it('meia órfã (tipo sem meia na vitrine) sai do carrinho e não conta no teto', async () => {
    h.vitrine = [{ ...VITRINE[0], permite_meia: false, preco_meia: null, taxa_meia: null, meias_disponiveis: 0, meias_total: 0 }]
    montar({ 'tt1|meia|pcd': 10 })
    const mais = await screen.findByRole('button', { name: 'Adicionar um Pista' })
    await waitFor(() => { fireEvent.click(mais); expect(screen.getByText('1 × Pista')).toBeTruthy() }) // o teto de 10 não foi consumido pela meia invisível
  })
})
