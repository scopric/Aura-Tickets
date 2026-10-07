import { describe, it, expect } from 'vitest'
import { calcularTaxa, resumoCarrinho, textoPreco, brlOuGratis } from '../lib/taxa'

describe('calcularTaxa (10%, mínimo de R$ 3 por ingresso, gratuito sem taxa)', () => {
  it('gratuito não tem taxa', () => {
    expect(calcularTaxa(0)).toEqual({ preco: 0, taxa: 0, total: 0 })
  })
  it('aplica o mínimo de R$ 3 abaixo de R$ 30', () => {
    expect(calcularTaxa(10)).toEqual({ preco: 10, taxa: 3, total: 13 })
    expect(calcularTaxa(29.99)).toEqual({ preco: 29.99, taxa: 3, total: 32.99 })
    expect(calcularTaxa(30)).toEqual({ preco: 30, taxa: 3, total: 33 })
  })
  it('aplica 10% acima do mínimo, arredondando ao centavo', () => {
    expect(calcularTaxa(100)).toEqual({ preco: 100, taxa: 10, total: 110 })
    expect(calcularTaxa(33.33)).toEqual({ preco: 33.33, taxa: 3.33, total: 36.66 })
    expect(calcularTaxa(30.05)).toEqual({ preco: 30.05, taxa: 3.01, total: 33.06 })
  })
  it('meia segue a mesma regra, inclusive o mínimo', () => {
    expect(calcularTaxa(20)).toEqual({ preco: 20, taxa: 3, total: 23 })
    expect(calcularTaxa(50)).toEqual({ preco: 50, taxa: 5, total: 55 })
  })
  it('preço negativo ou inválido vira zero', () => {
    expect(calcularTaxa(-10)).toEqual({ preco: 0, taxa: 0, total: 0 })
    expect(calcularTaxa(NaN)).toEqual({ preco: 0, taxa: 0, total: 0 })
  })
})

describe('resumoCarrinho', () => {
  it('soma em centavos sem erro de ponto flutuante', () => {
    const r = resumoCarrinho([{ preco: 19.9, qtd: 3 }])
    expect(r.subtotal).toBe(59.7)
    expect(r.taxa).toBe(9)
    expect(r.total).toBe(68.7)
  })
  it('carrinho misto com gratuito', () => {
    expect(resumoCarrinho([{ preco: 0, qtd: 2 }, { preco: 100, qtd: 1 }])).toEqual({ subtotal: 100, taxa: 10, total: 110 })
  })
  it('carrinho vazio', () => {
    expect(resumoCarrinho([])).toEqual({ subtotal: 0, taxa: 0, total: 0 })
  })
})

describe('textoPreco', () => {
  it('preço, taxa e total discriminados; gratuito sem taxa', () => {
    const t = (s: string) => s.replace(/\u00a0/g, ' ')
    expect(t(textoPreco(50))).toBe('R$ 50,00 + taxa R$ 5,00 = R$ 55,00')
    expect(t(textoPreco(19.9, 3))).toBe('R$ 59,70 + taxa R$ 9,00 = R$ 68,70')
    expect(textoPreco(0)).toBe('Gratuito')
  })
})

describe('brlOuGratis', () => {
  it('zero, nulo e indefinido viram "Grátis"; valor positivo vira reais', () => {
    expect(brlOuGratis(0)).toBe('Grátis')
    expect(brlOuGratis(null)).toBe('Grátis')
    expect(brlOuGratis(undefined)).toBe('Grátis')
    expect(brlOuGratis(13)).toMatch(/R\$\s13,00/)
  })
})
