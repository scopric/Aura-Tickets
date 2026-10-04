import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Newsletter from '../pages/admin/Newsletter'
import Tickets from '../pages/admin/Tickets'
import Finance from '../pages/admin/Finance'
import TeamManager from '../pages/admin/TeamManager'
import { TAXA_PERCENTUAL, TAXA_MINIMA } from '../lib/taxa'

// S1: o painel do admin não promete o que o sistema não faz. Banco e hooks simulados (listas vazias).
vi.mock('../lib/supabase', () => {
  const q: unknown = new Proxy(() => {}, { get: (_, k) => (k === 'then' ? (r: (v: unknown) => void) => r({ data: [], error: null }) : () => q) })
  return { supabase: { from: () => q, rpc: () => q, functions: { invoke: vi.fn() } } }
})
vi.mock('../hooks/useEvents', () => ({ useAdminTickets: () => ({ data: [], isLoading: false }) }))
vi.mock('../hooks/useAdminFinance', () => ({ useAdminFinance: () => ({ data: { orders: [], transactions: [], withdrawals: [] }, isLoading: false, isError: false, error: null }) }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'a1', role: 'admin', admin_permissions: ['super_admin'] } }) }))
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })

const montar = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>)
// texto visível + valores de campos (os modelos da newsletter vivem em input/textarea)
const tudo = () => document.body.textContent + ' ' + [...document.querySelectorAll<HTMLInputElement>('input,textarea')].map(e => e.value).join(' ')

beforeEach(cleanup)

describe('Admin sem promessa falsa (S1)', () => {
  it('Newsletter: nenhum modelo promete pré-venda VIP, Pix Parcelado ou carteira offline; cupom fica', async () => {
    montar(<Newsletter />)
    for (const botao of ['Aviso de pré-venda', /Informativo/, /Destaques/]) {
      fireEvent.click(await screen.findByRole('button', { name: botao }))
      const t = tudo()
      for (const proibida of ['acesso antecipado de 24', 'Pix Parcelado', 'carteira digital offline', 'membro VIP', 'lotes promocionais'])
        expect(t).not.toContain(proibida)
    }
    fireEvent.click(screen.getByRole('button', { name: 'Aviso de pré-venda' }))
    expect(tudo()).toContain('CLUBEEVOKAA10')
    expect(tudo()).toContain('Cupom para produtores')
  })

  it('Tickets: não fala em webhooks e diz que o pagamento está em teste', async () => {
    montar(<Tickets />)
    expect(await screen.findByText(/o pagamento está em teste/)).toBeInTheDocument()
    expect(tudo()).not.toContain('webhooks')
  })

  it('Finance: aba Taxas mostra a taxa real do código, sem slider, prazos D+ nem R$ 10.000', async () => {
    montar(<Finance />)
    fireEvent.click(screen.getByRole('button', { name: /Taxas/ }))
    expect(await screen.findByText(new RegExp(`Taxa de serviço: ${TAXA_PERCENTUAL}% do preço do ingresso, mínimo R\\$\\s${TAXA_MINIMA},00, paga pelo comprador`))).toBeInTheDocument()
    expect(document.querySelector('input[type="range"]')).toBeNull()
    expect(tudo()).not.toContain('R$ 10.000')
    expect(tudo()).not.toMatch(/D\+\d/)
  })

  it('TeamManager: as funções não prometem estorno nem cortesia como existentes', async () => {
    montar(<TeamManager />)
    await waitFor(() => expect(screen.getByText(/Estorno e cortesia ainda não existem/)).toBeInTheDocument())
    expect(tudo()).not.toMatch(/realizar estornos/i)
    expect(tudo()).not.toContain('Autenticação antifraude')
  })
})
