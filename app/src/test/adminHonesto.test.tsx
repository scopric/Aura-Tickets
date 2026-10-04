import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Newsletter from '../pages/admin/Newsletter'
import Tickets from '../pages/admin/Tickets'
import Finance from '../pages/admin/Finance'
import TeamManager from '../pages/admin/TeamManager'
import Users from '../pages/admin/Users'
import homeFonte from '../pages/Home.tsx?raw'
import { TAXA_PERCENTUAL, TAXA_MINIMA } from '../lib/taxa'

// S1: o painel do admin não promete o que o sistema não faz. Banco e hooks simulados (listas vazias).
vi.mock('../lib/supabase', () => {
  const fila = (data: unknown[]): unknown => new Proxy(() => {}, { get: (_, k) => (k === 'then' ? (r: (v: unknown) => void) => r({ data, error: null }) : () => fila(data)) })
  const perfil = { id: 'p1', email: 'ana@x.com', full_name: 'Ana', phone: null, role: 'producer', created_at: '2026-01-01T00:00:00Z', avatar_url: null, producer_subscriptions: [], user_custom_features: [] }
  return { supabase: { from: (t: string) => fila(t === 'profiles' ? [perfil] : []), rpc: () => fila([]), functions: { invoke: vi.fn() } } }
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
    expect(tudo()).toContain('Evokaa Eventos <contato@evokaa.com.br>')
    expect(tudo()).not.toContain('news@evokaa.com.br')
  })

  it('Newsletter: o cupom fica no construtor, desligado de início e depois de cada modelo, com o aviso ao lado', async () => {
    montar(<Newsletter />)
    const cupom = () => screen.getByLabelText('Habilitar Bloco de Cupom') as HTMLInputElement
    expect(cupom().checked).toBe(false)
    expect(screen.getByText(/Só ative quando o cupom existir em Cupons/)).toBeInTheDocument()
    for (const botao of [/Destaques/, 'Aviso de pré-venda', /Informativo/]) {
      fireEvent.click(cupom()) // liga à mão; o modelo tem de desligar
      expect(cupom().checked).toBe(true)
      fireEvent.click(await screen.findByRole('button', { name: botao }))
      expect(cupom().checked).toBe(false)
    }
    fireEvent.click(cupom())
    expect(tudo()).toContain('CLUBEEVOKAA10')
    expect(tudo()).toContain('Cupom para produtores (ainda não ativo)')
    expect(tudo()).not.toMatch(/10% de desconto/)
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
    expect(tudo()).toContain('toda a equipe ainda lê pedidos, financeiro e cupons')
  })

  it('Users: sem papel Editor (o banco recusa) e recursos sem efeito marcados', async () => {
    montar(<Users />)
    fireEvent.click(await screen.findByRole('button', { name: /Gerenciar Ana/ }))
    await screen.findByText('Ainda não libera nada', {}, { timeout: 3000 }).catch(() => {})
    const opcoes = [...document.querySelectorAll('option')].map(o => o.textContent)
    expect(opcoes).toContain('Produtor')
    expect(opcoes).not.toContain('Editor')
    expect(tudo()).not.toMatch(/ou Editor/)
    expect(tudo()).not.toContain('Disparos ilimitados')
    expect(screen.getAllByText('Ainda não libera nada').length).toBeGreaterThanOrEqual(3)
  })

  it('Home: o card de segurança não promete antifraude', () => {
    expect(homeFonte).not.toContain('Autenticação antifraude')
    expect(homeFonte).toContain('Seus dados tratados conforme a LGPD')
  })
})
