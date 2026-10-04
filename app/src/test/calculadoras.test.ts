import { describe, it, expect } from 'vitest'
import { precificar, projetar, totaisMesas } from '../lib/calculadoras'

describe('precificar', () => {
  it('markup 50 sobre custo 100', () => expect(precificar(100, 'markup', 50)).toEqual({ preco: 150, markup: 50, margem: 33.3 }))
  it('margem 20 sobre custo 80', () => expect(precificar(80, 'margem', 20)).toEqual({ preco: 100, markup: 25, margem: 20 }))
  it('preço abaixo do custo dá margem negativa', () => expect(precificar(100, 'preco', 80)).toEqual({ preco: 80, markup: -20, margem: -25 }))
  it('cortesia (preço 0): markup -100, margem nula', () => expect(precificar(100, 'preco', 0)).toEqual({ preco: 0, markup: -100, margem: null }))
  it('margem 100 e custo 0 são inválidos', () => {
    expect(precificar(100, 'margem', 100)).toBeNull()
    expect(precificar(0, 'markup', 10)).toBeNull()
  })
})

describe('projetar', () => {
  it('300 ingressos a 50, custos 20.000, capacidade 200', () => {
    const p = projetar(300, 50, 20000, 200)
    expect(p).toMatchObject({ receita: 15000, lucro: -5000, margem: -33.3, ocupacao: 150, equilibrio: 400, equilibrioAcimaDaCapacidade: true })
  })
  it('ingresso fracionado vira inteiro e centavos fecham', () => {
    expect(projetar(3.9, 19.9, 0, 10).receita).toBe(59.7)
  })
  it('sem preço não há equilíbrio', () => expect(projetar(10, 0, 100, 0).equilibrio).toBe(0))
})

describe('totaisMesas', () => {
  it('mesas iguais multiplicam, ocupados limitados à capacidade', () => {
    const t = totaisMesas([{ capacity: 6, pricePerSeat: 99.9, filled: 10, qty: 3 }])
    expect(t).toEqual({ mesas: 3, lugares: 18, ocupados: 18, receita: 1798.2, maximo: 1798.2, ocupacao: 100 })
  })
  it('vazio', () => expect(totaisMesas([]).ocupacao).toBe(0))
})
