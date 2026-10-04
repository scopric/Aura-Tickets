import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ComecoRapido from '../pages/producer/ComecoRapido'
import type { DbEvent } from '../hooks/useEvents'

let role = 'producer'
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', role } }) }))
const criar = vi.fn()
const duplicar = vi.fn()
const meus: Partial<DbEvent>[] = [
  { id: 'e1', title: 'Noite de Forró', date: '2026-12-12', venue_name: 'Espaço Torres', cover_image: null, image_url: null },
  { id: 'e2', title: 'Baile da Virada', date: null, venue_name: null, venue_city: 'Curitiba', cover_image: null, image_url: null },
]
let lista = meus
vi.mock('../hooks/useEvents', () => ({
  useCreateEvent: () => ({ mutateAsync: criar }),
  useProducerEvents: () => ({ data: lista, isLoading: false, isError: false, refetch: vi.fn(), isFetching: false }),
}))
vi.mock('../hooks/useDuplicarEvento', () => ({ useDuplicarEvento: () => ({ duplicar, duplicando: false }) }))

function montar() {
  return render(
    <MemoryRouter initialEntries={['/producer/events/new']}>
      <Routes>
        <Route path="/producer/events/new" element={<ComecoRapido />} />
        <Route path="/producer/events/:id/edit" element={<p>painel do evento</p>} />
      </Routes>
    </MemoryRouter>,
  )
}
const criarRascunho = () => fireEvent.click(screen.getByRole('button', { name: /Criar rascunho/ }))

beforeEach(() => { vi.clearAllMocks(); role = 'producer'; lista = meus; criar.mockResolvedValue({ id: 'novo1' }) })

describe('ComecoRapido: do zero', () => {
  it('só o nome é obrigatório: sem nome mostra o erro, marca o campo e não cria', () => {
    montar()
    criarRascunho()
    expect(screen.getByText('Escreva o nome: ele aparece na página e no ingresso.')).toBeInTheDocument()
    expect(screen.getByLabelText('Nome do evento')).toHaveAttribute('aria-invalid', 'true')
    expect(criar).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Nome do evento'), { target: { value: '   ' } }) // só espaços também não vale
    criarRascunho()
    expect(criar).not.toHaveBeenCalled()
  })

  it('limita o nome a 80 caracteres', () => {
    montar()
    expect(screen.getByLabelText('Nome do evento')).toHaveAttribute('maxlength', '80')
  })

  it('cria rascunho sem ingressos com formato, data, hora e cidade e abre o painel', async () => {
    montar()
    fireEvent.change(screen.getByLabelText('Nome do evento'), { target: { value: '  Noite de Forró ' } })
    fireEvent.change(screen.getByLabelText('Formato'), { target: { value: 'festa_encontro' } })
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-12-12' } })
    fireEvent.change(screen.getByLabelText('Hora de início'), { target: { value: '22:00' } })
    fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: ' Curitiba ' } })
    criarRascunho()
    expect(await screen.findByText('painel do evento')).toBeInTheDocument()
    expect(criar).toHaveBeenCalledTimes(1)
    expect(criar).toHaveBeenCalledWith({
      event: { title: 'Noite de Forró', category: 'festa_encontro', date: '2026-12-12', time: '22:00', venue_city: 'Curitiba', status: 'draft' },
      tickets: [],
    })
  })

  it('só com o nome: formato, data e cidade vão vazios (null)', async () => {
    montar()
    fireEvent.change(screen.getByLabelText('Nome do evento'), { target: { value: 'Teste' } })
    criarRascunho()
    await screen.findByText('painel do evento')
    expect(criar.mock.calls[0][0].event).toEqual({ title: 'Teste', category: null, date: null, time: null, venue_city: null, status: 'draft' })
  })

  it('hora sem data não é perdida em silêncio: pede a data e não cria', () => {
    montar()
    fireEvent.change(screen.getByLabelText('Nome do evento'), { target: { value: 'Teste' } })
    fireEvent.change(screen.getByLabelText('Hora de início'), { target: { value: '20:00' } })
    criarRascunho()
    expect(screen.getByText('Escolha a data: a hora só vale junto com ela.')).toBeInTheDocument()
    expect(criar).not.toHaveBeenCalled()
  })

  it('durante a criação o botão trava e o segundo clique não cria outro evento', async () => {
    let termina!: (v: unknown) => void
    criar.mockReturnValue(new Promise(ok => { termina = ok }))
    montar()
    fireEvent.change(screen.getByLabelText('Nome do evento'), { target: { value: 'Teste' } })
    const botao = screen.getByRole('button', { name: /Criar rascunho/ })
    fireEvent.click(botao)
    await waitFor(() => expect(botao).toBeDisabled())
    fireEvent.submit(screen.getByLabelText('Nome do evento').closest('form')!) // Enter no campo
    fireEvent.click(botao)
    expect(criar).toHaveBeenCalledTimes(1)
    await act(async () => { termina({ id: 'novo1' }) })
    expect(await screen.findByText('painel do evento')).toBeInTheDocument()
  })

  it('erro do banco: mensagem amigável (nunca o texto cru) e o botão volta para tentar de novo', async () => {
    criar.mockRejectedValueOnce(new Error('new row for relation "events" violates check constraint'))
    montar()
    fireEvent.change(screen.getByLabelText('Nome do evento'), { target: { value: 'Teste' } })
    criarRascunho()
    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('Não foi possível criar o rascunho. Confira a internet e tente de novo.')
    expect(alerta).not.toHaveTextContent(/violates|constraint|relation/)
    await waitFor(() => expect(screen.getByRole('button', { name: /Criar rascunho/ })).toBeEnabled())
    criarRascunho()
    expect(await screen.findByText('painel do evento')).toBeInTheDocument()
    expect(criar).toHaveBeenCalledTimes(2)
  })
})

describe('ComecoRapido: Evo e cópia', () => {
  it('"Abrir o Evo" dispara evo:planejar; sem Evo (participante) a opção não aparece', () => {
    const ouviu = vi.fn()
    window.addEventListener('evo:planejar', ouviu)
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir o Evo' }))
    expect(ouviu).toHaveBeenCalledTimes(1)
    window.removeEventListener('evo:planejar', ouviu)
  })

  it('sem permissão de Evo a opção some', () => {
    role = 'editor'
    montar()
    expect(screen.queryByRole('button', { name: 'Abrir o Evo' })).toBeNull()
    expect(screen.queryByText('Montar com o Evo')).toBeNull()
  })

  it('lista os eventos com data e local e copia só depois de confirmar', () => {
    montar()
    expect(screen.getByText('Noite de Forró')).toBeInTheDocument()
    expect(screen.getByText('sáb, 12 dez · Espaço Torres')).toBeInTheDocument()
    expect(screen.getByText('sem data · Curitiba')).toBeInTheDocument()
    const confirma = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    fireEvent.click(screen.getByRole('button', { name: 'Copiar Noite de Forró' }))
    expect(duplicar).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Copiar Noite de Forró' }))
    expect(duplicar).toHaveBeenCalledWith(meus[0])
    expect(confirma.mock.calls[1][0]).toMatch(/Datas, vendas, aprovação e destaque não vão/)
    confirma.mockRestore()
  })

  it('sem eventos: avisa em vez de lista vazia', () => {
    lista = []
    montar()
    expect(screen.getByText(/Quando você tiver o primeiro evento/)).toBeInTheDocument()
  })
})
