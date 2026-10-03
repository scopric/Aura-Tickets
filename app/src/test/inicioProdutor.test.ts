import { describe, it, expect } from 'vitest'
import { janelas, serie, total, variacao, resumoDe, haQuanto, emQuantosDias, horaCurta, dataPorExtenso, rotuloDoBalde } from '../lib/inicioProdutor'

// Sábado, 3 de outubro de 2026, 21:42 (horário do computador)
const agora = new Date(2026, 9, 3, 21, 42).getTime()
const em = (d: number, h = 12) => new Date(2026, 9, d, h).getTime()

describe('contas do Início', () => {
  it('7 dias: janela de 3/10 para trás e anterior logo antes', () => {
    const { atual, anterior } = janelas('7d', agora)
    expect(new Date(atual.ini).getDate()).toBe(27) // 27 set .. 3 out
    expect(atual.n).toBe(7)
    expect(new Date(anterior!.ini).getDate()).toBe(20) // 20 .. 26 set
  })

  it('serie soma por dia e total só conta dentro da janela', () => {
    const { atual } = janelas('7d', agora)
    const linhas = [{ t: em(3, 10), v: 5 }, { t: em(3, 20), v: 7 }, { t: em(1), v: 2 }, { t: new Date(2026, 8, 26, 12).getTime(), v: 99 }]
    expect(serie(linhas, atual, agora)).toEqual([0, 0, 0, 0, 2, 0, 12]) // 27, 28, 29, 30 set, 1, 2, 3 out
    expect(total(linhas, atual)).toBe(14)
  })

  it('hoje: 24 horas, sem horas futuras no período em curso', () => {
    const { atual, anterior } = janelas('hoje', agora)
    const s = serie([{ t: em(3, 9), v: 1 }], atual, agora)
    expect(s.length).toBe(22) // 0h .. 21h
    expect(s[9]).toBe(1)
    expect(serie([], anterior!).length).toBe(24)
    expect(rotuloDoBalde(atual, 9)).toBe('9h')
  })

  it('tudo: sem período anterior; a partir de 60 dias vira semana', () => {
    expect(janelas('tudo', agora, em(1)).anterior).toBeNull()
    const longa = janelas('tudo', agora, new Date(2026, 5, 1).getTime()).atual
    expect(longa.passo).toBe(7)
    expect(longa.n).toBe(Math.ceil(125 / 7)) // 1/6 a 3/10 = 125 dias
  })

  it('variação compara o mesmo trecho: venda constante dá ~0%, mesmo com o dia de hoje pela metade', () => {
    // uma venda de 10 por dia, ao meio-dia, de 20/9 a 3/10; agora = 21h42 de 3/10
    const linhas = Array.from({ length: 14 }, (_, i) => ({ t: new Date(2026, 8, 20 + i, 12).getTime(), v: 10 }))
    const { atual, anterior } = janelas('7d', agora)
    const r = resumoDe(linhas, false, atual, anterior, agora)
    expect(r.valor).toBe(70)
    expect(r.ant).toBe(70)
    expect(r.variacao).toBe(0)
    // hoje às 8h: a venda das 12h de hoje ainda não existe; ontem inteiro não pode ser cobrado contra hoje até as 8h
    const cedo = new Date(2026, 9, 3, 8).getTime()
    const hoje = janelas('hoje', cedo)
    const l2 = [{ t: new Date(2026, 9, 2, 12).getTime(), v: 10 }, { t: new Date(2026, 9, 3, 7).getTime(), v: 10 }]
    expect(resumoDe(l2, false, hoje.atual, hoje.anterior, cedo).variacao).toBeNull() // ontem até as 8h = 0: sem base
  })

  it('variação só existe com base de comparação', () => {
    expect(variacao(165, 100)).toBeCloseTo(0.65)
    expect(variacao(10, 0)).toBeNull()
    expect(variacao(10, null)).toBeNull()
  })

  it('textos de data', () => {
    expect(dataPorExtenso(new Date(agora))).toBe('Sáb, 3 de outubro')
    expect(horaCurta('22:00:00')).toBe('22h')
    expect(horaCurta('21:30')).toBe('21h30')
    expect(horaCurta(null)).toBeNull()
    expect(emQuantosDias(new Date(2026, 11, 12), agora)).toBe('em 70 dias')
    expect(emQuantosDias(new Date(2026, 9, 4), agora)).toBe('amanhã')
    expect(emQuantosDias(new Date(2026, 9, 3), agora)).toBe('hoje')
    expect(haQuanto(agora - 5 * 60000, agora)).toBe('há 5 min')
    expect(haQuanto(em(3, 18), agora)).toBe('há 3 h')
    expect(haQuanto(em(2, 19), agora)).toBe('ontem, 19h')
    expect(haQuanto(new Date(2026, 8, 28, 9).getTime(), agora)).toBe('28 set')
  })
})
