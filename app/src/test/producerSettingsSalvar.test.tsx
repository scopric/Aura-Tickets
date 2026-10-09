import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import ProducerSettings from '../pages/producer/ProducerSettings'
import { useProducerSettings } from '../hooks/useProducerSettings'

const m = vi.hoisted(() => ({
  salvar: vi.fn(),
  erro: vi.fn(),
  linhas: [{ id: 'u1' }] as { id: string }[],
  dados: { profile: { id: 'u1', full_name: 'Paula', email: 'p@x.com' }, producer_profile: { company_name: 'Paula Eventos', cnpj: null } },
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: m.erro } }))
vi.mock('../hooks/useTwoFactor', () => ({ useTwoFactor: () => ({ loading: false, enabled: false, toggle: vi.fn(), modal: null }) }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../lib/supabase', () => {
  const b: object = new Proxy({}, {
    get: (_o, k) => k === 'then'
      ? (ok: (v: unknown) => unknown) => ok({ data: m.linhas, error: null })
      : () => b,
  })
  return { supabase: { from: () => b } }
})

let useReal = false
vi.mock('../hooks/useProducerSettings', async (orig) => {
  const real = await orig<typeof import('../hooks/useProducerSettings')>()
  return {
    ...real,
    useProducerSettings: () => useReal ? real.useProducerSettings() : ({
      data: m.dados, isPending: false, isError: false, refetch: vi.fn(), isFetching: false,
      saveProfile: vi.fn(), isSavingProfile: false, saveProducerProfile: m.salvar, isSavingProducerProfile: false,
    }),
  }
})

const montar = () => render(<MemoryRouter><ProducerSettings /></MemoryRouter>)
const clicar = () => fireEvent.click(screen.getByRole('button', { name: /Salvar empresa/ }))

describe('Salvar empresa', () => {
  beforeEach(() => { useReal = false; m.salvar.mockReset(); m.erro.mockReset() })

  it('CNPJ vazio: envia cnpj null', async () => {
    m.salvar.mockResolvedValue(undefined)
    montar(); clicar()
    await waitFor(() => expect(m.salvar).toHaveBeenCalledWith({ company_name: 'Paula Eventos', cnpj: null }))
  })

  it('CNPJ inválido: não salva', () => {
    montar()
    fireEvent.change(screen.getByLabelText(/CNPJ/), { target: { value: '11222333000182' } })
    clicar()
    expect(m.salvar).not.toHaveBeenCalled()
    expect(m.erro).toHaveBeenCalledWith('CNPJ inválido: confira os números')
  })

  it('CNPJ válido: envia só os dígitos', async () => {
    m.salvar.mockResolvedValue(undefined)
    montar()
    fireEvent.change(screen.getByLabelText(/CNPJ/), { target: { value: '11222333000181' } })
    clicar()
    await waitFor(() => expect(m.salvar).toHaveBeenCalledWith({ company_name: 'Paula Eventos', cnpj: '11222333000181' }))
  })

  it('23505: mostra "já cadastrado"', async () => {
    m.salvar.mockRejectedValue({ code: '23505' })
    montar()
    fireEvent.change(screen.getByLabelText(/CNPJ/), { target: { value: '11222333000181' } })
    clicar()
    await waitFor(() => expect(m.erro).toHaveBeenCalledWith('Este CNPJ já está cadastrado em outra conta'))
  })

  it('razão social vazia: não salva', () => {
    montar()
    fireEvent.change(screen.getByLabelText(/Empresa \(razão social\)/), { target: { value: '  ' } })
    clicar()
    expect(m.salvar).not.toHaveBeenCalled()
    expect(m.erro).toHaveBeenCalledWith('Informe a razão social')
  })
})

describe('saveProducerProfile (UPDATE)', () => {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children)

  it('0 linhas atualizadas vira erro; 1 linha é sucesso', async () => {
    useReal = true // pix_key, cnpj e banco vão pela RPC (pr7_salvar_produtor_financeiro); o UPDATE com .select é o dos demais campos
    const { result } = renderHook(() => useProducerSettings(), { wrapper })
    m.linhas = []
    await expect(result.current.saveProducerProfile({ company_name: 'x' })).rejects.toThrow('Nenhuma linha atualizada')
    m.linhas = [{ id: 'u1' }]
    await expect(result.current.saveProducerProfile({ company_name: 'x' })).resolves.toBeUndefined()
  })
})
