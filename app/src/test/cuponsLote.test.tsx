import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { CriarEmLote, ImportarCsv } from '../components/producer/CuponsEmLote'

const m = vi.hoisted(() => ({ criar: vi.fn(), baixar: vi.fn(), insert: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('../lib/exportCsv', async orig => ({ ...(await orig<typeof import('../lib/exportCsv')>()), downloadCsv: m.baixar }))
vi.mock('../lib/supabase', () => ({ supabase: { from: () => ({ insert: m.insert }) } }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))

const eventos = [{ id: 'e1', title: 'Festa Um' }] as never[]
const ok = (criados: string[], falhas: { code: string; erro?: string }[] = []) => m.criar.mockResolvedValue({ criados, falhas })

describe('cupons em lote e CSV (tela)', () => {
  beforeEach(() => { m.criar.mockReset(); m.baixar.mockReset(); m.insert.mockReset() })

  // a tela usa o hook real; aqui o supabase é falso e o que importa é o que chega no INSERT
  const com = (ui: ReactNode) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)

  it('lote: valida antes, gera N códigos únicos, usos=1, producer_id do usuário e evento da lista', async () => {
    m.insert.mockResolvedValue({ error: null })
    com(<CriarEmLote eventos={eventos} existentes={[]} eventoInicial="e1" onFechar={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Criar cupons' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Informe o prefixo')
    expect(m.insert).not.toHaveBeenCalled()
    await userEvent.type(screen.getByLabelText('Prefixo'), 'amigos')
    await userEvent.clear(screen.getByLabelText(/Quantidade/)); await userEvent.type(screen.getByLabelText(/Quantidade/), '501')
    await userEvent.type(screen.getByLabelText('Desconto (%)'), '10')
    await userEvent.click(screen.getByRole('button', { name: 'Criar cupons' }))
    expect(screen.getByRole('alert')).toHaveTextContent('1 a 500')
    await userEvent.clear(screen.getByLabelText(/Quantidade/)); await userEvent.type(screen.getByLabelText(/Quantidade/), '250')
    await userEvent.click(screen.getByRole('button', { name: 'Criar cupons' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('250 cupons criados'))
    expect(m.insert).toHaveBeenCalledTimes(3) // 100 + 100 + 50
    const linhas = m.insert.mock.calls.flatMap(c => c[0]) as Record<string, unknown>[]
    expect(linhas).toHaveLength(250)
    expect(new Set(linhas.map(l => l.code)).size).toBe(250)
    expect(linhas.every(l => l.producer_id === 'u1' && l.event_id === 'e1' && l.max_uses === 1 && l.discount_type === 'percent' && l.discount_value === 10 && l.is_active === true)).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: /Baixar os códigos/ }))
    expect(m.baixar).toHaveBeenCalledTimes(1)
  })

  it('colisão no banco: mensagem genérica, sem listar os códigos nem dizer que existem', async () => {
    m.insert.mockResolvedValue({ error: { code: '23505' } })
    com(<CriarEmLote eventos={eventos} existentes={[]} eventoInicial="" onFechar={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('Prefixo'), 'ZZ'); await userEvent.type(screen.getByLabelText('Desconto (%)'), '5')
    await userEvent.clear(screen.getByLabelText(/Quantidade/)); await userEvent.type(screen.getByLabelText(/Quantidade/), '3')
    await userEvent.click(screen.getByRole('button', { name: 'Criar cupons' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('3: Não foi possível criar este código, tente outro'))
    expect(screen.getByRole('status').textContent).not.toMatch(/ZZ-|já existe/)
  })

  it('lote: percentual acima de 100 não grava', async () => {
    com(<CriarEmLote eventos={eventos} existentes={[]} eventoInicial="" onFechar={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('Prefixo'), 'A'); await userEvent.type(screen.getByLabelText('Desconto (%)'), '101')
    await userEvent.click(screen.getByRole('button', { name: 'Criar cupons' }))
    expect(screen.getByRole('alert')).toHaveTextContent('100')
    expect(m.insert).not.toHaveBeenCalled()
  })

  it('evento que não é da lista do produtor vai como "todos" (null)', async () => {
    m.insert.mockResolvedValue({ error: null })
    com(<CriarEmLote eventos={eventos} existentes={[]} eventoInicial="alheio" onFechar={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('Prefixo'), 'A'); await userEvent.type(screen.getByLabelText('Desconto (%)'), '5')
    await userEvent.click(screen.getByRole('button', { name: 'Criar cupons' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('criado'))
    expect((m.insert.mock.calls[0][0] as { event_id: unknown }[])[0].event_id).toBeNull()
  })

  // jsdom não tem Blob.text()
  const arquivo = (txt: string) => Object.assign(new File([txt], 'c.csv', { type: 'text/csv' }), { text: async () => txt })

  it('CSV: mostra o relatório de erros ANTES de gravar e grava só as válidas após o clique', async () => {
    m.insert.mockResolvedValue({ error: null })
    com(<ImportarCsv eventos={eventos} existentes={['JA']} eventoInicial="" onFechar={vi.fn()} />)
    await userEvent.upload(screen.getByLabelText('Arquivo CSV'), arquivo('﻿codigo;tipo;valor;usos\r\nBOM1;percent;10;1\r\nJA;percent;10;1\r\nBAD;percent;500;1\r\nBOM2;fixed;5,50;3\r\n'))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('4 linhas: 2 válidas, 2 com erro'))
    expect(screen.getByText(/Linha 3: código repetido/)).toBeInTheDocument()
    expect(screen.getByText(/Linha 4: percentual/)).toBeInTheDocument()
    expect(m.insert).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Gravar 2 cupons válidos' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('2 cupons criados'))
    const linhas = m.insert.mock.calls[0][0] as { code: string; discount_value: number; max_uses: number }[]
    expect(linhas.map(l => [l.code, l.discount_value, l.max_uses])).toEqual([['BOM1', 10, 1], ['BOM2', 5.5, 3]])
  })

  it('CSV sem linha válida não deixa gravar; arquivo vazio explica', async () => {
    com(<ImportarCsv eventos={eventos} existentes={[]} eventoInicial="" onFechar={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Gravar cupons' })).toBeDisabled()
    await userEvent.upload(screen.getByLabelText('Arquivo CSV'), arquivo('codigo;tipo;valor;usos\r\n=cmd;percent;5;1\r\n'))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('1 linha: 0 válidas, 1 com erro'))
    expect(screen.getByRole('button', { name: 'Gravar cupons' })).toBeDisabled()
  })

  it('modelo baixado é CSV com BOM', async () => {
    com(<ImportarCsv eventos={eventos} existentes={[]} eventoInicial="" onFechar={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Baixar o modelo' }))
    expect(m.baixar.mock.calls[0][1]).toMatch(/^﻿codigo;tipo;valor;usos/)
  })
})

describe('useCreateCouponsBulk', () => {
  beforeEach(() => { m.insert.mockReset() })
  it('bloco com código repetido (23505) é regravado linha a linha: só a repetida falha', async () => {
    const { useCreateCouponsBulk } = await import('../hooks/useProducerTools')
    m.insert.mockImplementation(async (x: unknown) => {
      const l = Array.isArray(x) ? x : [x]
      return l.some((c: { code: string }) => c.code === 'DUP') ? { error: { code: '23505' } } : { error: null }
    })
    const w = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
    const { result } = renderHook(() => useCreateCouponsBulk(), { wrapper: w })
    const r = await result.current.mutateAsync({ eventId: null, cupons: [{ code: 'A', discount_type: 'fixed', discount_value: 5 }, { code: 'DUP', discount_type: 'fixed', discount_value: 5 }] })
    await waitFor(() => expect(r).toEqual({ criados: ['A'], falhas: [{ code: 'DUP', erro: '23505' }] }))
  })
})
