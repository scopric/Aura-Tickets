// A Central lê o dia em Brasília; o teste fixa o fuso do navegador do produtor para a janela do período
process.env.TZ = 'America/Sao_Paulo'
import { describe, it, expect } from 'vitest'
import { janelaAnterior, delta, textoDelta, diasDoPeriodo, diasA, porDiaEm, diaBr, totais, entradasPorHora, csvCentral } from '../lib/central'
import type { VendasPagas } from '../lib/vendasPagas'

const agora = Date.parse('2026-10-08T15:00:00-03:00')

describe('janela anterior', () => {
  it('7 dias: mesmo tamanho do trecho decorrido, 7 dias antes', () => {
    const a = janelaAnterior('7d', agora)!
    expect(a.de).toBe('2026-09-25T03:00:00.000Z') // 25/09 00h em Brasília
    expect(Date.parse(a.ate) - Date.parse(a.de)).toBe(agora - Date.parse('2026-10-02T00:00:00-03:00'))
  })
  it('hoje: ontem de 0h até a mesma hora', () => {
    const a = janelaAnterior('hoje', agora)!
    expect(a).toEqual({ de: '2026-10-07T03:00:00.000Z', ate: '2026-10-07T18:00:00.000Z' })
  })
  it('tudo não tem anterior', () => expect(janelaAnterior('tudo', agora)).toBeNull())
  it('vira o mês: 30 dias a partir de 05/10 recua para agosto/setembro', () => {
    const a = janelaAnterior('30d', Date.parse('2026-10-05T12:00:00-03:00'))!
    expect(diaBr(Date.parse(a.de))).toBe('2026-08-07')
  })
})

describe('dias em Brasília', () => {
  it('01h UTC ainda é o dia anterior em Brasília', () => expect(diaBr(Date.parse('2026-10-08T01:00:00Z'))).toBe('2026-10-07'))
  it('virada de mês: 7 dias terminando em 02/11', () => {
    const d = diasDoPeriodo('7d', Date.parse('2026-11-02T12:00:00-03:00'), [])
    expect(d[0]).toBe('2026-10-27'); expect(d).toHaveLength(7); expect(d.at(-1)).toBe('2026-11-02')
  })
  it('diasA atravessa fevereiro bissexto', () => expect(diasA('2028-02-28', 3)).toEqual(['2028-02-28', '2028-02-29', '2028-03-01']))
  it('série por dia com zero nos dias sem venda', () => {
    expect(porDiaEm([{ dia: '2026-10-07', pedidos: 2, total: 50 }], ['2026-10-06', '2026-10-07'])).toEqual([0, 50])
  })
  it('"tudo" começa no primeiro dia com venda', () => {
    expect(diasDoPeriodo('tudo', agora, [{ dia: '2026-10-06', pedidos: 1, total: 1 }])).toEqual(['2026-10-06', '2026-10-07', '2026-10-08'])
  })
})

describe('delta', () => {
  it('calcula e formata', () => {
    expect(delta(150, 100)).toBe(0.5); expect(textoDelta(0.5)).toBe('+50%'); expect(textoDelta(-0.2)).toBe('−20%'); expect(textoDelta(0)).toBe('0%')
  })
  it('anterior zero ou ausente não vira infinito', () => {
    expect(delta(10, 0)).toBeNull(); expect(delta(10, null)).toBeNull()
    expect(textoDelta(null)).toMatch(/sem base/)
  })
})

const v: VendasPagas = {
  total: 300, pedidos: 3, reembolsados: { pedidos: 0, total: 0 },
  por_evento: [{ event_id: 'e1', titulo: '=Festa; "1"', pedidos: 3, total: 300 }],
  por_dia: [{ dia: '2026-10-07', pedidos: 3, total: 300 }],
  por_forma: [{ forma: 'pix', pedidos: 2, total: 200 }, { forma: 'credit_card', pedidos: 1, total: 100 }],
}

describe('totais, entradas e CSV', () => {
  it('forma filtra total e pedidos pela quebra do banco', () => {
    expect(totais(v, null)).toEqual({ total: 300, pedidos: 3 }); expect(totais(v, 'pix')).toEqual({ total: 200, pedidos: 2 }); expect(totais(v, 'boleto')).toEqual({ total: 0, pedidos: 0 })
  })
  it('entradas por hora em Brasília', () => {
    const h = entradasPorHora(['2026-10-08T01:30:00Z', '2026-10-08T01:45:00Z', '2026-10-08T22:00:00Z', 'lixo'])
    expect(h.valores.reduce((a, b) => a + b)).toBe(3); expect(h.rotulos[0]).toBe('07/10 22h'); expect(h.valores[0]).toBe(2); expect(h.rotulos.at(-1)).toBe('08/10 19h'); expect(h.valores.at(-1)).toBe(1)
  })
  it('festa que vira a noite fica em ordem, com o dia quando passa de um', () => {
    const h = entradasPorHora(['2026-10-09T01:10:00Z', '2026-10-09T03:20:00Z']) // 22h do dia 8 e 0h do dia 9 em Brasília
    expect(h.rotulos).toEqual(['08/10 22h', '08/10 23h', '09/10 0h']); expect(h.valores).toEqual([1, 0, 1])
    expect(h.eixo).toEqual(['08/10 22h', '23h', '09/10 0h']) // eixo curto: a data só na 1ª hora de cada dia
  })
  it('CSV com forma traz só o total daquela forma', () => {
    expect(csvCentral(v, 'pix').split('\r\n')[1]).toBe('Total;"Vendas pagas (bruto), Pix";2;"200,00"')
  })
  it('CSV com BOM, ponto e vírgula, vírgula decimal e fórmula neutralizada', () => {
    const csv = csvCentral(v).split('\r\n')
    expect(csv[0]).toBe('﻿secao;item;pedidos;valor_bruto')
    expect(csv[1]).toBe('Total;Vendas pagas (bruto);3;"300,00"')
    expect(csv).toContain('Por dia;07/10/2026;3;"300,00"')
    expect(csv).toContain('Por forma de pagamento;Pix;2;"200,00"')
    expect(csv.find(l => l.startsWith('Por evento'))).toBe('Por evento;"\'=Festa; ""1""";3;"300,00"')
  })
})
