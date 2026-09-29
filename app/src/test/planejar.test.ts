import { describe, it, expect } from 'vitest'
import { normas, estimarConsumo, sugerirLotes, checklistOrcamento } from '../../../supabase/functions/_shared/planejar'

describe('planejar (cálculos do Evo)', () => {
  it('800 pessoas em pé', () => {
    const r = normas({ publico: 800, layout: 'em_pe' })
    expect(r.saidas.unidades_de_passagem).toBe(8)
    expect(r.saidas.largura_total_m).toBe(4.4)
    expect(r.saidas_minimas.valor).toBe(2)
    expect(r.saidas_minimas.distancia_minima_entre_saidas_m).toBe(10)
    expect(r.antipanico.exigido).toBe(true)
    expect(r.area_minima_m2.valor).toBe(400)
    expect(r.brigadistas.valor).toBe(5)
    expect(r.pcd.cadeira_de_rodas).toBe(16)
    expect(r.pcd.assentos_pcd_mobilidade).toBe(16)
    expect(r.aviso).toContain('AVCB')
  })

  it('801 pessoas pedem 9 unidades de passagem', () => {
    expect(normas({ publico: 801, layout: 'em_pe' }).saidas.unidades_de_passagem).toBe(9)
  })

  it('plateia de 600 lugares: PcD 12/12 e área pelo leiaute', () => {
    const r = normas({ publico: 600, layout: 'plateia', lugares_sentados: 600 })
    expect(r.pcd.cadeira_de_rodas).toBe(12)
    expect(r.pcd.assentos_pcd_mobilidade).toBe(12)
    expect(r.area_minima_m2.valor).toBeNull()
  })

  it('1200 pessoas: PcD 20 + 1% do que passa de 1000', () => {
    const r = normas({ publico: 1200, layout: 'em_pe' })
    expect(r.pcd.cadeira_de_rodas).toBe(22)
    expect(r.pcd.assentos_pcd_mobilidade).toBe(22)
  })

  it('12000 pessoas: brigada 24', () => {
    expect(normas({ publico: 12000, layout: 'em_pe' }).brigadistas.valor).toBe(24)
  })

  it('público 0 (ou fracionado) é recusado', () => {
    expect(() => normas({ publico: 0, layout: 'em_pe' })).toThrow(/público/)
    expect(() => normas({ publico: 10.5, layout: 'em_pe' })).toThrow()
    expect(() => estimarConsumo({ publico: 0, duracao_h: 4 })).toThrow()
  })

  it('lotes somam a capacidade', () => {
    for (const capacidade of [1, 3, 7, 100, 999, 12345]) {
      const { lotes, sugestao_editavel } = sugerirLotes({ preco_alvo: 80, capacidade })
      expect(lotes.reduce((s, l) => s + l.quantidade, 0)).toBe(capacidade)
      expect(sugestao_editavel).toBe(true)
    }
    expect(sugerirLotes({ preco_alvo: 80, capacidade: 100 }).lotes.map(l => l.preco)).toEqual([68, 80, 96])
  })

  it('checklist só calcula brigada e bebidas', () => {
    const { categorias } = checklistOrcamento({ publico: 800, duracao_h: 4.5, uf: 'sp' })
    expect(categorias).toHaveLength(10)
    expect(categorias.filter(c => 'calculado' in c).map(c => c.categoria)).toEqual(['brigada', 'bar_bebidas'])
    const cerveja = estimarConsumo({ publico: 800, duracao_h: 4.5 }).itens[0]
    expect([cerveja.min, cerveja.max]).toEqual([800, 1600])
  })
})
