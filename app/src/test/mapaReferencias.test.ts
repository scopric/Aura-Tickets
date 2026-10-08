import { describe, it, expect } from 'vitest'
import { CATEGORIAS, ITENS, criarNo, daSecao, ESTRUTURA } from '../pages/producer/mapa/paleta'
import { FAMILIAS, REFERENCIAS } from '../pages/producer/mapa/referencias'

describe('referências "O que é" da paleta', () => {
  const itens = CATEGORIAS.filter(c => c.id !== 'navigation').flatMap(c => c.itens)

  it('todo item da paleta tem descrição (>= 20 caracteres) e família válida', () => {
    expect(itens.length).toBeGreaterThan(80)
    for (const i of itens) {
      const r = REFERENCIAS[i.id]
      expect(r, i.id).toBeTruthy()
      expect(r.descricao.length, i.id).toBeGreaterThanOrEqual(20)
      expect(FAMILIAS, i.id).toContain(r.ilustracao)
    }
  })

  it('não sobra referência de item que não existe', () => {
    for (const id of Object.keys(REFERENCIAS)) expect(ITENS[id], id).toBeTruthy()
  })
})

describe('item que não vende', () => {
  it('Mesa Buffet e afins não são de venda; criados na Estrutura ficam sem preço e fora da seção ativa', () => {
    const ativa = { id: 's1', color: '#111111', price: 80 }
    for (const id of ['buffet_table', 'round_buffet', 'stage', 'generator', 'food_truck']) {
      expect(daSecao(ITENS[id].tipo), id).toBe(false)
      const no = criarNo(ITENS[id], 0, 0, 'n', ESTRUTURA)
      expect(no.sectionId).toBe('estrutura')
      expect(no.price).toBe(0)
    }
    for (const id of ['seat', 'table']) expect(criarNo(ITENS[id], 0, 0, 'n', ativa).sectionId).toBe('s1')
  })
})
