import { describe, it, expect } from 'vitest'
import type { Environment, SeatNode } from '../pages/producer/mapa/modelo'
import { apagarLote, definirPreco, ligarIngresso, lotesDe, metricas, novoPavimento, apagarPavimento, lerImportacao, lerPreco, nomeUnico, alvoDesfazer, vendidosComPrecoAntigo, buscarNo, alternarStatus, statusEditavel } from '../pages/producer/mapa/regras'

const no = (o: Partial<SeatNode>): SeatNode => ({
  id: 'n', x: 12, y: 12, label: 'X', type: 'seat', color: '#111111', price: 10, rotation: 0, sold: 0, capacity: 1,
  sectionId: 'a', status: 'free', locked: false, ...o,
})
const mapa = (seats: SeatNode[]): Environment => ({
  id: 'terreo', name: 'T', seats, walls: [],
  sections: [
    { id: 'a', name: 'A', color: '#aa0000', price: 10 },
    { id: 'b', name: 'B', color: '#00bb00', price: 50 },
    { id: 'estrutura', name: 'Estrutura', color: '#475569', price: 0 },
  ],
})

describe('lotes', () => {
  it('Estrutura não é lote', () => expect(lotesDe(mapa([])).map(s => s.id)).toEqual(['a', 'b']))
  it('preço inválido não passa; válido vai para a seção e os nós', () => {
    const e = mapa([no({ id: '1' }), no({ id: '2', sectionId: 'b' })])
    for (const p of [-1, NaN, Infinity]) expect(definirPreco(e, 'a', p)).toBe(e)
    const r = definirPreco(e, 'a', 0)
    expect(r.sections[0].price).toBe(0)
    expect(r.seats.map(n => n.price)).toEqual([0, 10])
    expect(definirPreco(e, 'estrutura', 5)).toBe(e)
  })
  it('ligar ingresso copia o preço dele; desligar mantém o preço', () => {
    const e = mapa([no({ id: '1' })])
    const l = ligarIngresso(e, 'a', { id: 't1', price: 99 })
    expect(l.sections[0]).toMatchObject({ ticketTypeId: 't1', price: 99 })
    expect(l.seats[0].price).toBe(99)
    const d = ligarIngresso(l, 'a')
    expect(d.sections[0].ticketTypeId).toBeUndefined()
    expect(d.sections[0].price).toBe(99)
    expect(ligarIngresso(e, 'estrutura', { id: 't1', price: 1 })).toBe(e)
  })
  it('apagar lote migra os elementos para outro lote (cor e preço dele)', () => {
    const e = mapa([no({ id: '1' }), no({ id: '2', sectionId: 'b' })])
    const r = apagarLote(e, 'a')
    expect(r.erro).toBeUndefined()
    expect(r.env.sections.map(s => s.id)).toEqual(['b', 'estrutura'])
    expect(r.env.seats[0]).toMatchObject({ sectionId: 'b', price: 50, color: '#00bb00' })
    expect(r.destino).toBe('B')
  })
  it('apagar lote é bloqueado com venda ou reserva, com um lote só e para Estrutura', () => {
    expect(apagarLote(mapa([no({ sold: 2 })]), 'a').erro).toMatch(/venda/)
    expect(apagarLote(mapa([no({ status: 'reserved' })]), 'a').erro).toMatch(/venda/)
    expect(apagarLote(mapa([no({ status: 'sold' })]), 'a').env.sections).toHaveLength(3)
    const um = mapa([]); um.sections = um.sections.filter(s => s.id !== 'b')
    expect(apagarLote(um, 'a').erro).toMatch(/pelo menos um/)
    expect(apagarLote(mapa([]), 'estrutura').erro).toBeTruthy()
  })
})

describe('metricas', () => {
  it('mesmas fórmulas do editor antigo', () => {
    const e = mapa([
      no({ id: '1', capacity: 1, price: 10, sold: 1 }),
      no({ id: '2', type: 'table', capacity: 6, price: 20, sold: 2, status: 'reserved' }),
      no({ id: '3', type: 'stage', capacity: 0, price: 0 }),
    ])
    e.walls = [{ id: 'w', x1: 0, y1: 0, x2: 1, y2: 1, thickness: 0.15, color: '#000', locked: false }]
    expect(metricas(e)).toEqual({ assentos: 7, mesas: 1, muros: 1, vendido: 3, reservados: 1, receita: 10 + 40, potencial: 10 + 120 })
  })
  it('mapa vazio', () => expect(metricas(mapa([]))).toEqual({ assentos: 0, mesas: 0, muros: 0, vendido: 0, reservados: 0, receita: 0, potencial: 0 }))
})

describe('pavimentos', () => {
  const dois = () => [mapa([no({ id: '1' })]), { ...mapa([]), id: 'p2', name: 'Pavimento 2' }]
  it('novo: nome e id únicos, ordem dos outros intacta', () => {
    const r = novoPavimento(dois(), 'p3')
    expect(r.map(e => e.id)).toEqual(['terreo', 'p2', 'p3'])
    expect(r[2].name).toBe('Pavimento 3')
    expect(novoPavimento(r.slice(0, 1).concat({ ...r[2], name: 'Pavimento 2' }), 'x').at(-1)!.name).toBe('Pavimento 3')
  })
  it('apagar preserva a ordem e os ids dos restantes', () => {
    const tres = novoPavimento(dois(), 'p3')
    expect(apagarPavimento(tres, 'p2').envs.map(e => e.id)).toEqual(['terreo', 'p3'])
  })
  it('apagar é bloqueado com venda/reserva e mantém pelo menos 1', () => {
    const e = dois(); e[1].seats = [no({ id: 'v', status: 'reserved' })]
    expect(apagarPavimento(e, 'p2').erro).toMatch(/venda/)
    expect(apagarPavimento(e, 'p2').envs).toBe(e)
    expect(apagarPavimento([e[0]], 'terreo').erro).toMatch(/pelo menos um/)
  })
})

describe('importação', () => {
  const arq = (o: unknown) => JSON.stringify(o)
  const bom = () => ({ environments: [mapa([no({ id: '1' })])], zoom: 1, pan: { x: 0, y: 0 } })
  const livre = [mapa([])]
  it('válida: passa por normalizarEnvs', () => {
    const r = lerImportacao(arq(bom()), livre)
    expect(r.erro).toBeUndefined()
    expect(r.envs![0].pixelsPerMeter).toBe(40)
    expect(r.envs![0].seats[0].widthMeter).toBeGreaterThan(0)
  })
  it('inválida: JSON ruim, sem lista, vazio, x/y não finito, ids repetidos, preço negativo, grande', () => {
    expect(lerImportacao('{nao', livre).erro).toBeTruthy()
    expect(lerImportacao(arq({}), livre).erro).toBeTruthy()
    expect(lerImportacao(arq({ environments: [] }), livre).erro).toBeTruthy()
    const xy = bom(); (xy.environments[0].seats[0] as any).x = null
    expect(lerImportacao(arq(xy), livre).erro).toMatch(/posição/)
    const str = bom(); (str.environments[0].seats[0] as any).y = '3'
    expect(lerImportacao(arq(str), livre).erro).toMatch(/posição/)
    const dup = bom(); dup.environments.push(dup.environments[0])
    expect(lerImportacao(arq(dup), livre).erro).toBeTruthy()
    const neg = bom(); neg.environments[0].seats[0].price = -5
    expect(lerImportacao(arq(neg), livre).erro).toMatch(/negativo/)
    expect(lerImportacao('x'.repeat(5 * 1024 * 1024 + 1), livre).erro).toMatch(/5 MB/)
  })
  it('bloqueada se o mapa atual tem venda ou reserva', () => {
    expect(lerImportacao(arq(bom()), [mapa([no({ sold: 1 })])]).erro).toMatch(/vendidos/)
    expect(lerImportacao(arq(bom()), [mapa([no({ status: 'reserved' })])]).erro).toMatch(/vendidos/)
  })
})

describe('busca e status', () => {
  it('busca por rótulo ou tipo, sem acento, primeiro resultado', () => {
    const nos = [no({ id: '1', label: 'Mesa 1', type: 'table' }), no({ id: '2', label: 'Palco Principal', type: 'stage' }), no({ id: '3', label: 'Mesa 2', type: 'table' })]
    expect(buscarNo(nos, 'mesa')?.id).toBe('1')
    expect(buscarNo(nos, 'PALCO')?.id).toBe('2')
    expect(buscarNo(nos, 'Mesa Inteligente')?.id).toBe('1')
    expect(buscarNo(nos, 'zzz')).toBeUndefined()
    expect(buscarNo(nos, '  ')).toBeUndefined()
  })
  it('alterna Livre e Bloqueado; vendido, reservado e contato não mudam', () => {
    const l = no({})
    expect(alternarStatus(l, 'blocked').status).toBe('blocked')
    expect(alternarStatus(alternarStatus(l, 'blocked'), 'free').status).toBe('free')
    for (const x of [no({ sold: 1 }), no({ status: 'sold' }), no({ status: 'reserved' }), no({ status: 'contact' })]) {
      expect(statusEditavel(x)).toBe(false)
      expect(alternarStatus(x, 'free')).toBe(x)
    }
    expect(alternarStatus(l, 'sold')).toBe(l)
    expect(alternarStatus(l, 'reserved')).toBe(l)
  })
})

describe('lerPreco', () => {
  const v = (t: string) => lerPreco(t)?.valor
  it('aceita milhar com ponto + vírgula e simples com 1-2 decimais', () => {
    expect(v('1.200,50')).toBe(1200.5)
    expect(v('12,5')).toBe(12.5)
    expect(v('12.5')).toBe(12.5)
    expect(v('1.20')).toBe(1.2)
    expect(v('90')).toBe(90)
    expect(v('0')).toBe(0)
    expect(v('1.234.567')).toBeUndefined() // > 1.000.000
    expect(v('1.000.000')).toBe(1000000)
    expect(v('12.345.678,9')).toBeUndefined()
  })
  it('"1.200" vale 1200 mas é ambíguo; "1.200,00" e "2.500.000" não', () => {
    expect(lerPreco('1.200')).toEqual({ valor: 1200, ambiguo: true })
    expect(lerPreco('1.200,00')).toEqual({ valor: 1200, ambiguo: false })
    expect(lerPreco('1.200.300')).toBeNull()
    expect(lerPreco('999.999')).toEqual({ valor: 999999, ambiguo: true })
    expect(lerPreco('12.500.0')).toBeNull()
  })
  it('rejeita científica, texto, negativo, vazio, vírgula/ponto soltos e 3 decimais', () => {
    for (const t of ['1e3', '1E3', 'abc', '-3', '+3', '', ' ', '1,', '.5', ',5', '1,234', '1..2', '1,2,3', '12 reais', 'NaN', 'Infinity', '1.2.3'])
      expect(lerPreco(t), t).toBeNull()
  })
})

describe('preço não reescreve elemento vendido', () => {
  const e = () => mapa([no({ id: '1' }), no({ id: '2', sold: 3, price: 10 }), no({ id: '3', status: 'reserved', price: 10 })])
  it('definirPreco: seção e livres mudam; vendido/reservado mantêm; conta os mantidos', () => {
    const r = definirPreco(e(), 'a', 25)
    expect(r.sections[0].price).toBe(25)
    expect(r.seats.map(n => n.price)).toEqual([25, 10, 10])
    expect(vendidosComPrecoAntigo(r, 'a')).toBe(2)
    expect(vendidosComPrecoAntigo(e(), 'a')).toBe(0)
  })
  it('ligarIngresso idem', () => {
    const r = ligarIngresso(e(), 'a', { id: 't', price: 77 })
    expect(r.sections[0]).toMatchObject({ price: 77, ticketTypeId: 't' })
    expect(r.seats.map(n => n.price)).toEqual([77, 10, 10])
    expect(metricas(r).receita).toBe(30)
  })
})

describe('importação: saneamento', () => {
  const base = () => ({ id: 'x', name: 'P', sections: [{ id: 's', name: 'S', color: '#fff', price: 5, ticketTypeId: 't1' }, { id: 'estrutura', name: 'Estrutura', color: '#475569', price: 0 }],
    seats: [{ id: 'a', x: 1, y: 1, type: 'seat', sold: 9, status: 'sold', sectionId: 'nao-existe', price: 5, capacity: 1 }], walls: [] as any[] })
  const ler = (env: any, ing = ['t1']) => lerImportacao(JSON.stringify({ environments: [env] }), [mapa([])], ing)
  it('zera venda e status do sistema; sectionId inexistente vai para o primeiro lote; status válido fica', () => {
    const env = base(); env.seats.push({ id: 'b', x: 2, y: 2, type: 'seat', sold: 0, status: 'blocked', sectionId: 'estrutura', price: 0, capacity: 0 } as any, { id: 'c', x: 3, y: 3, type: 'seat', sold: 0, status: 'contact', sectionId: 's', price: 0, capacity: 0 } as any, { id: 'd', x: 4, y: 4, type: 'seat', sold: 0, status: 'xyz', sectionId: 's', price: 0, capacity: 0 } as any)
    const r = ler(env)
    expect(r.envs![0].seats.map(n => [n.sold, n.status])).toEqual([[0, 'free'], [0, 'blocked'], [0, 'contact'], [0, 'free']])
    expect(r.envs![0].seats[0].sectionId).toBe('s')
    expect(r.envs![0].seats[1].sectionId).toBe('estrutura')
    expect(r.avisos!.join(' ')).toMatch(/zerados/)
  })
  it('ticketTypeId inexistente no evento é zerado e avisado; existente fica', () => {
    expect(ler(base()).envs![0].sections[0].ticketTypeId).toBe('t1')
    const r = ler(base(), ['outro'])
    expect(r.envs![0].sections[0].ticketTypeId).toBeUndefined()
    expect(r.avisos!.join(' ')).toMatch(/ingressos que não existem/)
    expect(lerImportacao(JSON.stringify({ environments: [base()] }), [mapa([])]).envs![0].sections[0].ticketTypeId).toBeUndefined()
  })
  it('paredes: válida passa; coordenada/espessura ruim recusa', () => {
    const ok = base(); ok.walls = [{ id: 'w', x1: 0, y1: 0, x2: 5, y2: 0, thickness: 0.15 }]
    expect(ler(ok).envs![0].walls![0]).toMatchObject({ x2: 5, locked: false })
    for (const w of [{ id: 'w', x1: 0, y1: 0, x2: null, y2: 0, thickness: 0.2 }, { id: 'w', x1: 0, y1: 0, x2: 1, y2: 0, thickness: 0 }, { id: 'w', x1: 0, y1: 0, x2: 1, y2: 0, thickness: 99 }, { id: 'w', x1: 0, y1: 0, x2: 1, y2: '0', thickness: 0.2 }]) {
      const e = base(); e.walls = [w]
      expect(ler(e).erro).toMatch(/parede/)
    }
  })
  it('tipo desconhecido é mantido e avisado', () => {
    const e = base(); (e.seats[0] as any).type = 'ovni'
    const r = ler(e)
    expect(r.envs![0].seats[0].type).toBe('ovni')
    expect(r.avisos!.join(' ')).toMatch(/ovni/)
  })
  it('__proto__ no arquivo não polui nem entra no mapa', () => {
    const txt = '{"__proto__":{"polluted":1},"environments":[{"id":"x","name":"P","__proto__":{"polluted":2},"sections":[{"id":"s","name":"S","price":1,"__proto__":{"polluted":3}}],"seats":[{"id":"a","x":1,"y":1,"type":"seat","__proto__":{"polluted":4},"constructor":{"prototype":{"polluted":5}}}]}]}'
    const r = lerImportacao(txt, [mapa([])], [])
    expect(r.erro).toBeUndefined()
    expect(({} as any).polluted).toBeUndefined()
    const no0 = r.envs![0].seats[0]
    expect(Object.keys(no0)).not.toContain('__proto__')
    expect(Object.keys(no0)).not.toContain('constructor')
    expect(Object.keys(r.envs![0])).not.toContain('__proto__')
  })
  it('campo numérico negativo ou texto recusa', () => {
    const e = base(); (e.seats[0] as any).capacity = '3'
    expect(ler(e).erro).toBeTruthy()
  })
})

describe('desfazer x importação', () => {
  it('pavimento ativo com histórico desfaz o pavimento', () => expect(alvoDesfazer({ a: [1], b: [] }, 'a', true)).toBe('pavimento'))
  it('importação só volta sem NENHUM histórico', () => {
    expect(alvoDesfazer({ a: [], b: [1] }, 'a', true)).toBeNull()
    expect(alvoDesfazer({ a: [], b: [] }, 'a', true)).toBe('importacao')
    expect(alvoDesfazer({}, 'a', false)).toBeNull()
  })
  it('ao trocar de pavimento o alvo muda junto', () => {
    const h = { a: [1], b: [] as number[] }
    expect(alvoDesfazer(h, 'a', true)).toBe('pavimento')
    expect(alvoDesfazer(h, 'b', true)).toBeNull()
  })
})

describe('nomeUnico', () => {
  it('limita a 60, volta ao anterior se vazio, sufixa duplicado', () => {
    expect(nomeUnico('x'.repeat(80), [], 'ant')).toHaveLength(60)
    expect(nomeUnico('   ', [], 'ant')).toBe('ant')
    expect(nomeUnico('vip', ['VIP'], 'ant')).toBe('vip (2)')
    expect(nomeUnico('vip', ['VIP', 'vip (2)'], 'ant')).toBe('vip (3)')
    expect(nomeUnico('x'.repeat(60), ['x'.repeat(60)], 'a')).toHaveLength(60)
  })
})

describe('importação: lotes e rótulo', () => {
  it('pavimento sem lotes é recusado; rótulo é cortado em 80', () => {
    const e: any = { id: 'x', name: 'P', sections: [], seats: [] }
    expect(lerImportacao(JSON.stringify({ environments: [e] }), [mapa([])], []).erro).toMatch(/ao menos um lote/)
    e.sections = [{ id: 's', name: 'S', price: 1 }]; e.seats = [{ id: 'a', x: 1, y: 1, type: 'seat', label: 'L'.repeat(200) }]
    expect(lerImportacao(JSON.stringify({ environments: [e] }), [mapa([])], []).envs![0].seats[0].label).toHaveLength(80)
  })
})
