import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { toast } from 'sonner'
import ProducerCoupons from '../pages/producer/Coupons'

// Ganchos falsos: a tela é testada sem banco
const criar = vi.fn()
const atualizar = vi.fn()
const apagar = vi.fn()
let lista: object[] = []
let pendente = false
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('../hooks/useProducerTools', () => ({
  useProducerCoupons: () => ({ data: lista, isLoading: false, isError: false, refetch: vi.fn(), isFetching: false }),
  useCreateCoupon: () => ({ mutateAsync: criar, isPending: false }),
  useUpdateCoupon: () => ({ mutateAsync: atualizar, isPending: pendente }),
  useDeleteCoupon: () => ({ mutateAsync: apagar, isPending: pendente }),
}))
vi.mock('../hooks/useEvents', () => ({ useProducerEvents: () => ({ data: [] }) }))
vi.mock('../hooks/useEventoDaUrl', () => ({ useFiltroEvento: () => [null, vi.fn()] }))
vi.mock('@/components/producer/FiltroEvento', () => ({ default: () => null }))

// datas em horário local, como o formulário grava
const inicio = new Date('2099-12-01T00:00:00').toISOString()
const fim = new Date('2099-12-31T23:59:59').toISOString()
const cupom = (extra: object = {}) => ({
  id: 'c1', code: 'AURA20', description: null, discount_type: 'percent', discount_value: 20, min_order_value: null,
  max_uses: null, uses: 0, event_id: null, valid_from: inicio, valid_until: fim, is_active: true, ...extra,
})
const montar = () => render(<MemoryRouter><ProducerCoupons /></MemoryRouter>)
const salvar = () => fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

beforeEach(() => {
  criar.mockReset(); atualizar.mockReset(); apagar.mockReset(); vi.mocked(toast.error).mockClear()
  lista = [cupom()]; pendente = false
})

describe('Cupons do produtor', () => {
  it('novo cupom abre com limite vazio e rótulo de pedidos', () => {
    montar()
    fireEvent.click(screen.getAllByRole('button', { name: /Novo cupom/ })[0])
    const campo = screen.getByLabelText('Limite de pedidos (vazio = sem limite)') as HTMLInputElement
    expect(campo.value).toBe('')
  })

  it('sem limite mostra ∞ no cartão', () => {
    montar()
    expect(screen.getByText('0/∞')).toBeTruthy()
  })

  it('o lápis preenche o formulário e salvar chama update com id e datas (dia 1 e dia 31)', async () => {
    atualizar.mockResolvedValue({})
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Editar AURA20' }))
    expect((screen.getByLabelText('Início') as HTMLInputElement).value).toBe('2099-12-01')
    expect((screen.getByLabelText('Fim') as HTMLInputElement).value).toBe('2099-12-31')
    fireEvent.change(screen.getByLabelText('Desconto (%)'), { target: { value: '30' } })
    salvar()
    await waitFor(() => expect(atualizar).toHaveBeenCalledTimes(1))
    expect(atualizar.mock.calls[0][0]).toMatchObject({ id: 'c1', code: 'AURA20', discount_value: 30, max_uses: null, valid_from: inicio, valid_until: fim })
  })

  it('cupom já usado trava tipo, valor e código', () => {
    lista = [cupom({ uses: 1 })]
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Editar AURA20' }))
    expect((screen.getByLabelText('Código') as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByLabelText('Tipo') as HTMLSelectElement).disabled).toBe(true)
    expect((screen.getByLabelText('Desconto (%)') as HTMLInputElement).disabled).toBe(true)
    expect(screen.getByText('Já usado: valor travado')).toBeTruthy()
  })

  it('edição não manda código/tipo/valor quando o cupom já foi usado', async () => {
    lista = [cupom({ uses: 2 })]
    atualizar.mockResolvedValue({})
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Editar AURA20' }))
    fireEvent.change(screen.getByLabelText('Limite de pedidos (vazio = sem limite)'), { target: { value: '50' } })
    salvar()
    await waitFor(() => expect(atualizar).toHaveBeenCalled())
    const arg = atualizar.mock.calls[0][0]
    expect(arg.max_uses).toBe(50)
    expect(arg).not.toHaveProperty('discount_value')
    expect(arg).not.toHaveProperty('code')
  })

  it('data final já passada não bloqueia se não foi alterada', async () => {
    const passado = new Date('2020-01-31T23:59:59').toISOString()
    lista = [cupom({ valid_from: null, valid_until: passado })]
    atualizar.mockResolvedValue({})
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Editar AURA20' }))
    salvar()
    await waitFor(() => expect(atualizar).toHaveBeenCalled())
  })

  it.each([
    ['23505 código repetido', { code: '23505' }, 'Esse código já existe'],
    ['valor', { code: '23514', message: 'violates check constraint "coupons_value_chk"' }, 'Valor do desconto inválido'],
    ['datas', { code: '23514', message: 'violates check constraint "coupons_periodo_chk"' }, 'As datas do cupom são inválidas'],
    ['limite', { code: '23514', message: 'violates check constraint "coupons_limites_chk"' }, 'O limite de pedidos é inválido'],
    ['valor travado', { code: '42501', message: 'Valor travado' }, 'Cupom já usado: o valor não pode mudar.'],
    ['42501', { code: '42501', message: 'permission denied' }, /2FA/],
    ['PGRST116', { code: 'PGRST116' }, /2FA/],
    ['outro', new Error('x'), 'Não foi possível salvar o cupom.'],
  ])('erro %s mostra a mensagem certa ao salvar', async (_n, erro, esperado) => {
    atualizar.mockRejectedValue(erro)
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Editar AURA20' }))
    salvar()
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    const msg = vi.mocked(toast.error).mock.calls[0][0] as string
    typeof esperado === 'string' ? expect(msg).toBe(esperado) : expect(msg).toMatch(esperado)
  })

  it('ligar/desligar e excluir usam a mesma tradução de erro', async () => {
    atualizar.mockRejectedValue({ code: 'PGRST116' })
    apagar.mockRejectedValue({ code: '42501' })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Desativar AURA20' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Remover AURA20' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(2))
    expect(vi.mocked(toast.error).mock.calls.every(c => /2FA/.test(c[0] as string))).toBe(true)
  })

  it('com mutação pendente os botões do cartão ficam desabilitados', () => {
    pendente = true
    montar()
    for (const nome of ['Editar AURA20', 'Desativar AURA20', 'Remover AURA20'])
      expect((screen.getByRole('button', { name: nome }) as HTMLButtonElement).disabled).toBe(true)
  })
})
