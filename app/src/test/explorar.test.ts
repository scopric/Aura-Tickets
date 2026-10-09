import { describe, it, expect } from 'vitest'
import {
  agruparPorDia, aPartirDe, categoriasDoCatalogo, cidadesDoCatalogo, fimDeSemana, ordenarPorData, passa, rotuloDia,
  type EventoCatalogo, type Filtros,
} from '../lib/explorar'
import { diaBR, diaMais, horaCurta } from '../lib/visaoEvento'

const F: Filtros = { cidade: null, quando: '', categoria: null, busca: '' }
const ev = (id: string, p: Partial<EventoCatalogo> = {}): EventoCatalogo => ({ id, title: `Evento ${id}`, date: '2026-10-03', ...p })

describe('datas no fuso de São Paulo', () => {
  it('hoje é o dia de São Paulo, não o de Greenwich', () => {
    expect(diaBR(new Date('2026-10-04T02:30:00Z'))).toBe('2026-10-03') // 23h30 de sábado em SP
    expect(diaBR(new Date('2026-10-04T03:00:00Z'))).toBe('2026-10-04') // meia-noite em SP
  })

  it('soma dias atravessando mês e ano', () => {
    expect(diaMais('2026-10-31', 1)).toBe('2026-11-01')
    expect(diaMais('2026-12-31', 1)).toBe('2027-01-01')
    expect(diaMais('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('Hoje, Amanhã e os outros dias', () => {
    const hoje = '2026-10-03' // sábado
    expect(rotuloDia('2026-10-03', hoje)).toMatchObject({ sem: 'Hoje', curto: 'Hoje', cabecalho: 'Hoje, sábado, 3 de outubro', hoje: true })
    expect(rotuloDia('2026-10-04', hoje)).toMatchObject({ sem: 'Amanhã', cabecalho: 'Amanhã, domingo, 4 de outubro', hoje: false })
    expect(rotuloDia('2026-12-12', hoje)).toMatchObject({ sem: 'Sáb', dia: '12', curto: 'Sáb · 12 dez', mesNome: 'dezembro' })
    expect(rotuloDia('2027-01-09', hoje).mesNome).toBe('janeiro de 2027')
  })

  it('hora curta', () => {
    expect(horaCurta('22:00:00')).toBe('22h')
    expect(horaCurta('23:59:00')).toBe('23h59')
    expect(horaCurta('09:05')).toBe('9h05')
    expect(horaCurta(null)).toBeNull()
  })

  it('fim de semana: de segunda a sexta os próximos sábado e domingo; sábado e domingo, o que resta', () => {
    expect(fimDeSemana('2026-10-05')).toEqual(['2026-10-10', '2026-10-11']) // segunda
    expect(fimDeSemana('2026-10-09')).toEqual(['2026-10-10', '2026-10-11']) // sexta
    expect(fimDeSemana('2026-10-10')).toEqual(['2026-10-10', '2026-10-11']) // sábado
    expect(fimDeSemana('2026-10-11')).toEqual(['2026-10-11']) // domingo
  })
})

describe('lista por dia', () => {
  it('agrupa por data, ordena pela hora e abre cabeçalho de mês só quando o mês muda', () => {
    const lista = ordenarPorData([
      ev('c', { date: '2026-11-02' }),
      ev('b', { date: '2026-10-03', time: '23:59:00' }),
      ev('a', { date: '2026-10-03', time: '22:00:00' }),
      ev('sem-data', { date: null }),
      ev('d', { date: '2026-10-20' }),
    ])
    expect(lista.map(e => e.id)).toEqual(['a', 'b', 'd', 'c'])
    const g = agruparPorDia(lista, '2026-10-03')
    expect(g.map(x => [x.data, x.eventos.map(e => e.id), x.novoMes])).toEqual([
      ['2026-10-03', ['a', 'b'], true],
      ['2026-10-20', ['d'], false],
      ['2026-11-02', ['c'], true],
    ])
  })
})

describe('cidades e categorias reais', () => {
  const todos = [
    ev('1', { venue_city: 'Curitiba', category: 'Show' }),
    ev('2', { venue_city: ' curitiba ', category: 'SHOW' }), // texto antigo: caixa diferente conta como o mesmo
    ev('3', { venue_city: 'São Paulo', category: 'Festa' }),
    ev('4', { venue_city: null, category: 'Trilha na serra' }),
    ev('5', { venue_city: 'Florianópolis', category: 'Corporativo' }),
  ]

  it('conta cada cidade uma vez (sem acento e caixa) e ignora evento sem cidade', () => {
    expect(cidadesDoCatalogo(todos).map(c => [c.nome, c.qtd])).toEqual([['Curitiba', 2], ['Florianópolis', 1], ['São Paulo', 1]])
  })

  it('categorias: mais eventos primeiro; empate em ordem alfabética', () => {
    expect(categoriasDoCatalogo(todos).map(c => c.nome)).toEqual(['Show ou apresentação', 'Corporativo', 'Festa', 'Trilha na serra'])
  })

  it('categoria em slug do formato aparece pelo rótulo, e o filtro acha o evento por ele', () => {
    const novo = ev('6', { category: 'festa_encontro', date: '2026-10-04' })
    const [chip] = categoriasDoCatalogo([novo])
    expect(chip.nome).toBe('Festa ou encontro')
    expect(passa(novo, { ...F, categoria: chip.chave }, '2026-10-03')).toBe(true)
    expect(passa(novo, { ...F, busca: 'encontro' }, '2026-10-03')).toBe(true)
  })

  it('sem evento, sem cidade e sem categoria (nada inventado)', () => {
    expect(cidadesDoCatalogo([])).toEqual([])
    expect(categoriasDoCatalogo([])).toEqual([])
  })
})

describe('filtros', () => {
  const hoje = '2026-10-03'
  const e = ev('1', { title: 'Noite de Forró', venue_name: 'Espaço Torres', venue_city: 'Curitiba', category: 'Show', date: '2026-10-04' })

  it('busca sem acento, em qualquer ordem, no título, local, cidade e categoria', () => {
    expect(passa(e, { ...F, busca: 'forro torres' }, hoje)).toBe(true)
    expect(passa(e, { ...F, busca: 'CURITIBA' }, hoje)).toBe(true)
    expect(passa(e, { ...F, busca: 'rock, (ao "vivo")' }, hoje)).toBe(false) // vírgula e aspas não quebram nada
  })

  it('cidade e categoria pela chave', () => {
    expect(passa(e, { ...F, cidade: 'curitiba' }, hoje)).toBe(true)
    expect(passa(e, { ...F, cidade: 'sao paulo' }, hoje)).toBe(false)
    // a chave da categoria é a do rótulo do formato ('Show' vira 'Show ou apresentação'), a mesma do chip
    const [chip] = categoriasDoCatalogo([e])
    expect(passa(e, { ...F, categoria: chip.chave }, hoje)).toBe(true)
    expect(passa(e, { ...F, categoria: 'festa' }, hoje)).toBe(false)
  })

  it('hoje e fim de semana', () => {
    expect(passa(e, { ...F, quando: 'hoje' }, hoje)).toBe(false)
    expect(passa(e, { ...F, quando: 'fds' }, hoje)).toBe(true) // sábado 3 e domingo 4
    expect(passa({ ...e, date: '2026-10-03' }, { ...F, quando: 'hoje' }, hoje)).toBe(true)
  })

  it('ignorar tira um filtro da conta', () => {
    expect(passa(e, { ...F, quando: 'hoje', cidade: 'curitiba' }, hoje, 'quando')).toBe(true)
  })
})

describe('preço "a partir de" com taxa', () => {
  const agora = new Date('2026-10-03T12:00:00Z').getTime()

  it('menor ingresso pago + taxa (10%, mínimo R$ 3)', () => {
    expect(aPartirDe(ev('1', { ticket_types: [{ price: 80 }, { price: '40' }] }), agora)).toBe(44)
    expect(aPartirDe(ev('2', { ticket_types: [{ price: 10 }] }), agora)).toBe(13) // taxa mínima
  })

  it('gratuito só quando todo ingresso à venda é grátis; sem ingresso, sem preço', () => {
    expect(aPartirDe(ev('1', { ticket_types: [{ price: 0 }] }), agora)).toBe(0)
    expect(aPartirDe(ev('2', { ticket_types: [] }), agora)).toBeNull()
    expect(aPartirDe(ev('3'), agora)).toBeNull()
  })

  it('ingresso desativado ou com venda encerrada não conta', () => {
    const e = ev('1', { ticket_types: [{ price: 20, is_active: false }, { price: 30, sale_end: '2026-10-01T00:00:00Z' }, { price: 100 }] })
    expect(aPartirDe(e, agora)).toBe(110)
    expect(aPartirDe(ev('2', { ticket_types: [{ price: 20, is_active: false }] }), agora)).toBeNull()
  })
})
