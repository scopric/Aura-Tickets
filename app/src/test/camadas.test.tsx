import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import CookieBanner from '../components/CookieBanner'
import AvisoPolitica from '../components/AvisoPolitica'
import EvoHub from '../components/EvoHub'
import { camadaAberta, CHAVE_AVISO_POLITICA, fecharPolitica } from '../lib/camadas'
import { PRIVACY_VERSION } from '../lib/legal'
import { useAuthStore } from '../stores/authStore'

vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', role: 'producer', email: 'a@b.c' } }) }))
vi.mock('../hooks/useEvents', () => ({ useCreateEvent: () => ({ mutateAsync: vi.fn(), isPending: false }) }))
vi.mock('../hooks/useFeedback', () => ({ useFeedback: () => ({ mutateAsync: vi.fn(), isPending: false }) }))

Element.prototype.scrollIntoView = vi.fn()
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
// no Node 26 o localStorage global vem vazio (mesmo padrão do evo.test.tsx)
let mem: Record<string, string> = {}
const armazenamento = () => ({ getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v } })

const consulta: unknown = new Proxy(() => {}, { get: (_, k) => (k === 'then' ? (ok: (v: unknown) => unknown) => ok({ data: [], error: null }) : () => consulta) })
const canal: Record<string, unknown> = {}
canal.on = vi.fn(() => canal)
canal.subscribe = vi.fn(() => canal)

const BALAO = 'Oi! Sou o Evo 👋 Posso te ajudar a planejar seu evento.'
const politica = () => screen.queryByText(/Atualizamos a nossa/)
const cookies = () => screen.queryByRole('button', { name: /Rejeitar opcionais/ })

function montar() {
  ;(supabase as unknown as { rpc: unknown }).rpc = vi.fn(() => Promise.resolve({ data: null, error: null }))
  vi.mocked(supabase.from).mockImplementation(() => consulta as never)
  vi.mocked(supabase.channel).mockImplementation(() => canal as never)
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <CookieBanner />
        <AvisoPolitica />
        <EvoHub />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
const esperar = (ms: number) => act(() => new Promise<void>((r) => setTimeout(r, ms)))

describe('uma camada por vez no primeiro acesso', () => {
  beforeEach(() => {
    mem = {}
    vi.stubGlobal('localStorage', armazenamento())
    useAuthStore.setState({ session: null })
  })
  afterEach(() => useAuthStore.setState({ session: null }))

  it('sem decisão: só os cookies; Política e balão do Evo esperam', async () => {
    montar()
    expect(cookies()).toBeInTheDocument()
    expect(politica()).toBeNull()
    await esperar(2300)
    expect(screen.queryByText(BALAO)).toBeNull()
  })

  it.each(['Aceitar todos', 'Rejeitar opcionais'])('"%s" → aparece a Política (e só ela); fechar → balão do Evo depois de 2 s', async (botao) => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: new RegExp(botao) }))
    expect(cookies()).toBeNull()
    expect(politica()).toBeInTheDocument()
    expect(JSON.parse(mem['aura-cookie-consent']).version).toBe('1.0') // o camadas.ts lê esta versão
    await esperar(2300)
    expect(screen.queryByText(BALAO)).toBeNull() // com a Política aberta o relógio do Evo não corre
    fireEvent.click(screen.getByRole('button', { name: 'Fechar aviso da Política de Privacidade' }))
    expect(politica()).toBeNull()
    expect(screen.queryByText(BALAO)).toBeNull() // o relógio de 2 s começa agora
    expect(await screen.findByText(BALAO, {}, { timeout: 3000 })).toBeInTheDocument()
    expect(mem[CHAVE_AVISO_POLITICA]).toBe('1')
  })

  it('conta criada na data da versão vigente: sem Política, balão do Evo logo depois dos cookies', async () => {
    useAuthStore.setState({ session: { user: { created_at: `${PRIVACY_VERSION}T15:00:00Z` } } })
    montar()
    fireEvent.click(screen.getByRole('button', { name: /Rejeitar opcionais/ }))
    expect(politica()).toBeNull()
    expect(await screen.findByText(BALAO, {}, { timeout: 3000 })).toBeInTheDocument()
  })

  it('conta criada antes da versão ainda vê a Política', () => {
    useAuthStore.setState({ session: { user: { created_at: '2026-10-03T23:00:00Z' } } }) // 20h em Brasília
    montar()
    fireEvent.click(screen.getByRole('button', { name: /Rejeitar opcionais/ }))
    expect(politica()).toBeInTheDocument()
  })

  it('camadaAberta: cookies, Política, nada; resposta de outra versão ou corrompida reabre os cookies', () => {
    expect(camadaAberta()).toBe('cookies')
    mem['aura-cookie-consent'] = '{nao e json'
    expect(camadaAberta()).toBe('cookies')
    mem['aura-cookie-consent'] = JSON.stringify({ version: '0.9', consent: { analytics: true } })
    expect(camadaAberta()).toBe('cookies')
    mem['aura-cookie-consent'] = JSON.stringify({ version: '1.0', consent: { analytics: false } })
    expect(camadaAberta()).toBe('politica')
    mem[CHAVE_AVISO_POLITICA] = '1'
    expect(camadaAberta()).toBeNull()
  })

  it('sem armazenamento: não quebra; Política aparece, fecha, e o Evo segue', async () => {
    const erro = () => { throw new Error('bloqueado') }
    vi.stubGlobal('localStorage', { getItem: erro, setItem: erro })
    expect(camadaAberta()).toBe('politica')
    montar()
    expect(politica()).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar aviso da Política de Privacidade' }))
    expect(politica()).toBeNull()
    expect(await screen.findByText(BALAO, {}, { timeout: 3000 })).toBeInTheDocument()
    expect(() => fecharPolitica()).not.toThrow()
  })
})
