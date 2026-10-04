import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import EventsBrowse from '../pages/EventsBrowse'
import { diaBR, diaMais } from '../lib/visaoEvento'

// A consulta do Explorar: from().select().eq().eq().gte().order() resolve com os eventos de cada teste
let resposta: { data: unknown[] | null; error: unknown }
vi.mock('../lib/supabase', () => {
  const cadeia: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'gte']) cadeia[m] = () => cadeia
  cadeia.order = () => Promise.resolve(resposta)
  return { supabase: { from: () => cadeia } }
})

const hoje = diaBR(Date.now())
const evento = (id: string, p: Record<string, unknown> = {}) => ({
  id, title: `Evento ${id}`, date: hoje, time: '22:00:00', status: 'published',
  venue_name: 'Casa Mirante', venue_city: 'Curitiba', category: 'Show', ticket_types: [{ price: 50 }], ...p,
})

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><EventsBrowse /></MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  resposta = { data: [], error: null }
})

describe('Explorar (V11b)', () => {
  it('lista por dia: Hoje, Amanhã e data; destaque; preço com taxa; coração em cada evento (VF); nada de "N pessoas vão"', async () => {
    resposta.data = [
      evento('a', { title: 'Baile do Sol' }),
      evento('b', { title: 'Pagode na Laje', date: diaMais(hoje, 1), time: '16:00:00', venue_name: 'Laje do Alto' }),
      evento('c', { title: 'Noite de Forró', date: diaMais(hoje, 9), category: 'Festa', ticket_types: [{ price: 0 }], featured_carousel: true }),
    ]
    montar()
    expect(await screen.findByRole('heading', { name: '3 eventos' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Explorar' })).toBeInTheDocument()

    // destaque = o marcado como destaque, mesmo não sendo o primeiro da lista
    const destaque = screen.getByRole('region', { name: 'Em destaque' })
    expect(within(destaque).getByText('Noite de Forró')).toBeInTheDocument()

    // títulos de dia como cabeçalhos
    const dias = screen.getAllByRole('heading', { level: 4 }).map(h => h.textContent)
    expect(dias[0]).toMatch(/^Hoje, /)
    expect(dias[1]).toMatch(/^Amanhã, /)
    expect(dias).toHaveLength(3)

    // preço: menor ingresso + taxa de R$ 5 (10%), ou gratuito
    expect(screen.getAllByText(/R\$\s?55,00/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Gratuito').length).toBeGreaterThan(0)

    // visitante: um "Salvar evento" por linha da lista (o destaque também está na lista)
    expect(screen.getAllByRole('button', { name: 'Salvar evento' })).toHaveLength(3)
    expect(screen.queryByText(/pessoas vão/i)).not.toBeInTheDocument()
  })

  it('folha de cidade: só as cidades dos eventos; escolher filtra; "Todas as cidades" limpa', async () => {
    resposta.data = [
      evento('a', { title: 'Baile do Sol' }),
      evento('b', { title: 'Vigília', venue_city: 'São Paulo' }),
      evento('c', { title: 'Sem cidade', venue_city: null }),
    ]
    montar()
    await screen.findByRole('heading', { name: '3 eventos' })
    fireEvent.click(screen.getByRole('button', { name: /Todas as cidades/ }))
    const folha = await screen.findByRole('dialog')
    const radios = within(folha).getAllByRole('radio').map(r => r.textContent)
    expect(radios).toEqual(['Todas as cidades3 eventos', 'Curitiba1 evento', 'São Paulo1 evento'])
    expect(within(folha).getByRole('radio', { name: /Todas as cidades/ })).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(within(folha).getByRole('radio', { name: /São Paulo/ }))
    // a folha fecha (no jsdom o Vaul não tira o nó do ar, só marca closed; por isso hidden: true nas buscas)
    await waitFor(() => expect(folha).toHaveAttribute('data-state', 'closed'))
    expect(await screen.findByRole('heading', { name: '1 evento', hidden: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /São Paulo/, hidden: true })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros', hidden: true }))
    expect(await screen.findByRole('heading', { name: '3 eventos', hidden: true })).toBeInTheDocument()
  })

  it('categorias reais como botões com aria-pressed; vazio com Evo e saída "Ver todas as categorias"', async () => {
    resposta.data = [
      evento('a', { category: 'Show' }),
      evento('b', { category: 'Festa', date: diaMais(hoje, 3) }),
    ]
    montar()
    await screen.findByRole('heading', { name: '2 eventos' })
    const filtros = screen.getByRole('group', { name: 'Filtros' })
    const rotulos = within(filtros).getAllByRole('button').map(b => b.textContent)
    expect(rotulos).toEqual(['Hoje', 'Fim de semana', 'Festa', 'Show']) // só as categorias que existem

    const festa = within(filtros).getByRole('button', { name: 'Festa' })
    expect(festa).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(festa)
    expect(festa).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: '1 evento' })).toBeInTheDocument()

    // Festa + Hoje: nenhuma festa hoje; a frase fala do que esvaziou a lista
    fireEvent.click(within(filtros).getByRole('button', { name: 'Hoje' }))
    const vazio = screen.getByRole('status')
    expect(within(vazio).getByText('Nada de Festa hoje.')).toBeInTheDocument()
    expect(within(vazio).getByText(/O próximo é Evento b/)).toBeInTheDocument()
    expect(vazio.querySelector('img')).toHaveAttribute('src', '/evo/evo-corpo-celular.webp')

    fireEvent.click(within(vazio).getByRole('button', { name: 'Ver todas as datas' }))
    expect(screen.getByRole('heading', { name: '1 evento' })).toBeInTheDocument()
  })

  it('busca sem resultado: frase com o termo e "Limpar busca"; vírgula e aspas não quebram', async () => {
    resposta.data = [evento('a', { title: 'Baile do Sol' })]
    montar()
    await screen.findByRole('heading', { name: '1 evento' })
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'rock, (ao "vivo")' } })
    const vazio = screen.getByRole('status')
    expect(within(vazio).getByText(/Nada para “rock, \(ao "vivo"\)”/)).toBeInTheDocument()
    fireEvent.click(within(vazio).getByRole('button', { name: 'Limpar busca' }))
    expect(screen.getByRole('heading', { name: '1 evento' })).toBeInTheDocument()
  })

  it('sem evento publicado: texto honesto, sem botão e sem seletor de cidade', async () => {
    montar()
    expect(await screen.findByText('Ainda não tem evento publicado.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cidades/i })).not.toBeInTheDocument()
    expect(within(screen.getByRole('status')).queryByRole('button')).not.toBeInTheDocument()
  })

  it('erro na consulta: avisa e oferece tentar de novo (não finge que não há eventos)', async () => {
    resposta = { data: null, error: new Error('falhou') }
    montar()
    expect(await screen.findByText('Não deu para carregar os eventos.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
  })
})
