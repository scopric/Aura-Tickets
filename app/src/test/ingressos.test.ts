import { describe, it, expect } from 'vitest'
import type { DbTicketType } from '../hooks/useEvents'
import {
  ALFABETO, abasIngressosCupons, erroDoModelo, gerarCodigos, ingNovo, ingParaBanco, janelaDeVenda, kpisIngressos, diaValido, lerCsv, modeloCsv, motivoDoErro, mover, ordenar, ordensAlteradas, prefixoLimpo, validarCupons,
} from '../lib/ingressos'

const tt = (id: string, extra: Partial<DbTicketType> = {}) => ({ id, name: id, price: 50, is_active: true, quantity_total: 100, type: 'individual', created_at: '2026-01-01', ...extra }) as DbTicketType

describe('ordem dos ingressos', () => {
  it('ordena por sort_order de 1 em diante; sem ordem (nulo ou 0) vai por último, pela criação', () => {
    const l = [tt('sem', { sort_order: null, created_at: '2026-03-01' }), tt('c', { sort_order: 3 }), tt('zero', { sort_order: 0, created_at: '2026-02-01' }), tt('a', { sort_order: 1 })]
    expect(ordenar(l).map(t => t.id)).toEqual(['a', 'c', 'zero', 'sem'])
  })
  it('mover troca de posição; posição inválida devolve a mesma lista', () => {
    expect(mover(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(mover(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b'])
    const l = ['a', 'b']
    expect(mover(l, 0, 5)).toBe(l)
    expect(mover(l, 1, 1)).toBe(l)
  })
  it('numera a partir de 1 e só volta quem mudou', () => {
    const antes = [tt('a', { sort_order: 1 }), tt('b', { sort_order: 2 }), tt('c', { sort_order: 3 })]
    expect(ordensAlteradas(antes, mover(antes, 0, 1))).toEqual([{ id: 'b', sort_order: 1 }, { id: 'a', sort_order: 2 }])
    expect(ordensAlteradas(antes, antes)).toEqual([])
    const nunca = [tt('a', { sort_order: null }), tt('b', { sort_order: null })]
    expect(ordensAlteradas(nunca, nunca)).toEqual([{ id: 'a', sort_order: 1 }, { id: 'b', sort_order: 2 }])
  })
  it('reordenar A,B,C e criar D => A,B,C,D (o novo, sem ordem, fica no fim)', () => {
    const base = [tt('a', { created_at: '2026-01-01' }), tt('b', { created_at: '2026-01-02' }), tt('c', { created_at: '2026-01-03' })]
    const nova = mover(ordenar(base), 2, 0) // C,A,B
    const gravado = base.map(t => ({ ...t, sort_order: ordensAlteradas(base, nova).find(o => o.id === t.id)?.sort_order ?? null }))
    const comD = [...gravado, tt('d', { sort_order: null, created_at: '2026-02-01' })]
    expect(ordenar(comD).map(t => t.id)).toEqual(['c', 'a', 'b', 'd'])
    // se o banco der 0 ao ingresso novo, ele também vai para o fim
    expect(ordenar([...gravado, tt('d', { sort_order: 0, created_at: '2026-02-01' })]).map(t => t.id)).toEqual(['c', 'a', 'b', 'd'])
  })
})

describe('números do topo', () => {
  it('disponíveis só contam o ingresso visível e nunca ficam negativos', () => {
    const tipos = [tt('a', { quantity_total: 100 }), tt('b', { quantity_total: 50, is_active: false }), tt('c', { quantity_total: 10 })]
    expect(kpisIngressos(tipos, { a: 30, b: 5, c: 12 })).toEqual({ vendidos: 47, disponiveis: 70 })
  })
})

describe('ingresso para o banco', () => {
  it('novo grupo: mesa coletiva, sem meia, mesmo se marcarem meia', () => {
    const i = { ...ingNovo('grupo'), nome: ' Mesa 4 ', preco: '200,00', qtd: '10', meia: true }
    expect(ingParaBanco(i)).toMatchObject({ id: undefined, name: 'Mesa 4', price: 200, capacity: 10, type: 'coletiva', permite_meia: false, min_per_order: 1, max_per_order: null, max_por_cpf: null, sale_start: null })
  })
  it('gratuito sai com preço 0; pago com preço 0 é recusado pelo modelo', () => {
    expect(ingParaBanco({ ...ingNovo('gratuito'), nome: 'X', qtd: '5' }).price).toBe(0)
    expect(erroDoModelo('pago', { ...ingNovo('pago'), preco: '0,00' })).toMatch(/maior que zero/)
    expect(erroDoModelo('pago', { ...ingNovo('pago'), preco: '10,00' })).toBeUndefined()
    expect(erroDoModelo('gratuito', ingNovo('gratuito'))).toBeUndefined()
    expect(erroDoModelo(null, { ...ingNovo('pago'), preco: '0,00' })).toBeUndefined() // edição não troca o modelo
  })
  it('janela de venda em Brasília', () => {
    expect(janelaDeVenda(null, null)).toMatch(/Sem janela/)
    expect(janelaDeVenda('2026-10-10T17:00:00+00:00', '2026-10-20T21:00:00+00:00')).toBe('10/10/2026 14:00 até 20/10/2026 18:00')
    expect(janelaDeVenda('2026-10-10T17:00:00+00:00', null)).toBe('Desde 10/10/2026 14:00')
  })
  it('abas levam o evento escolhido nas duas rotas', () => {
    expect(abasIngressosCupons('e1')).toEqual([{ to: '/producer/ingressos?eventId=e1', label: 'Ingressos' }, { to: '/producer/cupons?eventId=e1', label: 'Cupons' }])
    expect(abasIngressosCupons()[1].to).toBe('/producer/cupons')
  })
})

describe('códigos em lote', () => {
  it('500 códigos únicos, com o prefixo, sem caracteres ambíguos', () => {
    const c = gerarCodigos('amigos', 500)
    expect(new Set(c).size).toBe(500)
    expect(c.every(x => /^AMIGOS-[A-Z2-9]{6}$/.test(x) && !/[ILO01]/.test(x.slice(7)))).toBe(true)
    expect([...ALFABETO].some(ch => 'ILO01'.includes(ch))).toBe(false)
  })
  it('não repete código que já existe (nem em minúsculas)', () => {
    const sorte = (() => { let k = 0; return () => (k++ < 6 ? 0 : 1) })() // 1º código AAAAAA, 2º AAAAAA de novo (descartado), depois BBBBBB
    const c = gerarCodigos('x', 1, ['x-aaaaaa'], sorte)
    expect(c).toHaveLength(1)
    expect(c[0]).toBe('X-BBBBBB')
    expect(() => gerarCodigos('x', 2, [], () => 0)).toThrow() // sorteio travado nunca fecha: não trava a tela
  })
  it('prefixo limpo e quantidade fora de 1..500 recusados', () => {
    expect(prefixoLimpo('Ação-10 %')).toBe('ACAO10')
    expect(() => gerarCodigos('', 5)).toThrow()
    expect(() => gerarCodigos('A', 501)).toThrow()
    expect(() => gerarCodigos('A', 0)).toThrow()
  })
})

describe('CSV de cupons', () => {
  const cab = 'codigo;tipo;valor;usos\r\n'
  it('lê ; e , e o BOM, aspas e vírgula decimal', () => {
    expect(lerCsv('﻿a;b\r\n1;2\r\n')).toEqual([['a', 'b'], ['1', '2']])
    expect(lerCsv('a,b\n"x,y",2')).toEqual([['a', 'b'], ['x,y', '2']])
    expect(lerCsv('a;b\n"he said ""hi""";2')).toEqual([['a', 'b'], ['he said "hi"', '2']])
    expect(lerCsv('')).toEqual([])
  })
  it('válidas e erros linha a linha, com o número da linha do arquivo', () => {
    const r = validarCupons(cab + 'ok10;percent;10,5;1\r\nruim;percent;101;1\r\nfix;fixed;20;abc\r\n;percent;5;1\r\nTIPO;gold;5;1\r\nzero;fixed;0;1\r\nsemlimite;fixed;5,00;\r\n', ['EXISTE'])
    expect(r.total).toBe(7)
    expect(r.validas.map(c => [c.code, c.discount_type, c.discount_value, c.max_uses])).toEqual([['OK10', 'percent', 10.5, 1], ['SEMLIMITE', 'fixed', 5, null]])
    expect(r.erros.map(e => e.linha)).toEqual([3, 4, 5, 6, 7])
    expect(r.erros[0].motivo).toMatch(/100/)
    expect(r.erros[1].motivo).toMatch(/usos/)
  })
  it('código repetido no arquivo ou já existente é erro', () => {
    const r = validarCupons(cab + 'a1;percent;5;1\r\nA1;percent;5;1\r\nexiste;percent;5;1\r\n', ['EXISTE'])
    expect(r.validas).toHaveLength(1)
    expect(r.erros.map(e => e.linha)).toEqual([3, 4])
  })
  it('fórmula no código nunca passa', () => {
    const r = validarCupons(cab + '=HYPERLINK("x");percent;5;1\r\n+cmd;percent;5;1\r\n@x;percent;5;1\r\n', [])
    expect(r.validas).toHaveLength(0)
    expect(r.erros).toHaveLength(3)
  })
  it('cabeçalho ausente, arquivo vazio e mais de 500 linhas não gravam nada', () => {
    expect(validarCupons('', []).geral).toMatch(/vazio/)
    expect(validarCupons('a;b;c;d\n1;2;3;4', []).geral).toMatch(/colunas/)
    const grande = cab + Array.from({ length: 501 }, (_, i) => `C${i + 10};percent;5;1`).join('\n')
    const r = validarCupons(grande, [])
    expect(r.geral).toMatch(/500/)
    expect(r.validas).toHaveLength(0)
    expect(validarCupons(cab + Array.from({ length: 500 }, (_, i) => `C${i + 10};percent;5;1`).join('\n'), []).validas).toHaveLength(500)
  })
  it('colunas opcionais: validade AAAA-MM-DD vira fim do dia de Brasília; data torta é erro', () => {
    const r = validarCupons('codigo;tipo;valor;usos;descricao;validade\r\nA1;percent;5;1;Amigos;2099-12-31\r\nA2;percent;5;1;;31/12/2099\r\n', [])
    expect(r.validas[0]).toMatchObject({ description: 'Amigos', valid_until: '2100-01-01T02:59:59.000Z' })
    expect(r.erros).toHaveLength(1)
  })
  it('validade: data que não existe (31/02) e data passada são erros', () => {
    const r = validarCupons('codigo;tipo;valor;usos;validade\r\nA1;percent;5;1;2099-02-31\r\nA2;percent;5;1;2020-01-01\r\nA3;percent;5;1;2099-02-28\r\n', [])
    expect(r.validas.map(c => c.code)).toEqual(['A3'])
    expect(r.erros.map(e => e.motivo)).toEqual([expect.stringMatching(/data real/), expect.stringMatching(/já passou/)])
    expect(diaValido('2026-02-31')).toBe(false)
    expect(diaValido('2028-02-29')).toBe(true)
  })
  it('colisão no banco (23505) tem mensagem genérica, sem dizer que o código existe', () => {
    expect(motivoDoErro('23505')).toBe('Não foi possível criar este código, tente outro')
    expect(motivoDoErro('23505')).not.toMatch(/existe/)
  })
  it('modelo para baixar tem BOM e passa na própria validação', () => {
    const m = modeloCsv()
    expect(m.startsWith('﻿codigo;tipo;valor;usos')).toBe(true)
    expect(validarCupons(m, []).validas).toHaveLength(1)
  })
})
