import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { toast } from 'sonner'
import ProducerMenu from '../pages/producer/Menu'

const criar = vi.fn()
const apagar = vi.fn()
const enviar = vi.fn()
const preparar = vi.fn()
let consulta: { data: object[]; isLoading: boolean; isError: boolean }
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../hooks/useMenuItems', () => ({
  useProducerMenuItems: () => ({ ...consulta, refetch: vi.fn(), isFetching: false }),
  useCreateMenuItem: () => ({ mutateAsync: criar, isPending: false }),
  useUpdateMenuItem: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteMenuItem: () => ({ mutateAsync: apagar, isPending: false }),
}))
vi.mock('../hooks/useEvents', () => ({ useProducerEvents: () => ({ data: [], isPending: false }) }))
vi.mock('../hooks/useEventoDaUrl', async orig => ({ ...(await orig<object>()), useFiltroEvento: () => [null, vi.fn()] }))
vi.mock('@/components/producer/FiltroEvento', () => ({ default: () => null }))
vi.mock('../lib/capaEvento', () => ({
  prepararCapa: (...a: unknown[]) => preparar(...a),
  enviarFotoItem: (...a: unknown[]) => enviar(...a),
}))

const item = { id: 'm1', name: 'Gin', description: '', category: 'bebida', price: 10, is_available: true, image_url: null, event_id: null, stock: null }
const montar = () => render(<MemoryRouter><ProducerMenu /></MemoryRouter>)

beforeEach(() => {
  for (const f of [criar, apagar, enviar, preparar]) f.mockReset()
  vi.mocked(toast.error).mockClear()
  consulta = { data: [item], isLoading: false, isError: false }
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:previa', revokeObjectURL: () => {} }))
})

const novoComNome = (nome: string) => {
  fireEvent.click(screen.getAllByRole('button', { name: /Novo item/ })[0])
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: nome } })
}
const escolher = (arq: File) => fireEvent.change(screen.getByLabelText('Foto (opcional)'), { target: { files: [arq] } })

describe('Cardápio do produtor', () => {
  it('foto escolhida é reduzida, enviada ao bucket do produtor e a URL é gravada no item', async () => {
    preparar.mockResolvedValue({ blob: new Blob(['x'], { type: 'image/webp' }), previewUrl: 'blob:p' })
    enviar.mockResolvedValue('https://x/cardapio-itens/u1/abc.webp')
    criar.mockResolvedValue({})
    montar()
    novoComNome('Gin Tônica')
    escolher(new File(['x'], 'minha foto.png', { type: 'image/png' }))
    expect(screen.getByAltText('Prévia da foto do item')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar item' }))
    await waitFor(() => expect(criar).toHaveBeenCalledTimes(1))
    expect(enviar.mock.calls[0][1]).toBe('u1')
    expect(criar.mock.calls[0][0].image_url).toBe('https://x/cardapio-itens/u1/abc.webp')
  })

  it('SVG é recusado e nada é enviado', () => {
    montar()
    novoComNome('Gin')
    escolher(new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' }))
    expect(toast.error).toHaveBeenCalledWith('Use uma foto JPG, PNG ou WebP.')
    expect(screen.queryByAltText('Prévia da foto do item')).toBeNull()
  })

  it('falha de leitura mostra alerta e não diz que o cardápio está vazio', () => {
    consulta = { data: [], isLoading: false, isError: true }
    montar()
    expect(screen.getByRole('alert').textContent).toContain('Não foi possível carregar o cardápio agora.')
    expect(screen.queryByText('Nenhum item encontrado')).toBeNull()
  })

  it('excluir pede confirmação com o nome: Cancelar não apaga, Excluir apaga', async () => {
    apagar.mockResolvedValue({})
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Excluir Gin' }))
    expect(screen.getByRole('alertdialog').textContent).toContain('"Gin"')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(apagar).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Excluir Gin' }))
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
    await waitFor(() => expect(apagar).toHaveBeenCalledWith('m1'))
  })
})
