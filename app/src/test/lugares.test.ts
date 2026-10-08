import { describe, it, expect } from 'vitest'
import { meiasDosLugares, chaveDoLugar, ingressosDoLugar, itensDosLugares, tipoDoLugar } from '../lib/lugares'

const amb = {
  id: 'terreo',
  sections: [{ id: 'vip', ticketTypeId: 'tt1' }, { id: 'sem' }],
  seats: [
    { id: 's1', type: 'seat', sectionId: 'vip', status: 'free' },
    { id: 's2', type: 'seat', sectionId: 'vip', status: 'blocked' },
    { id: 's3', type: 'seat', sectionId: 'sem', status: 'free' },
    { id: 'm1', type: 'table', sectionId: 'vip', status: 'free', seatsCount: 4 },
    { id: 'w1', type: 'wall', sectionId: 'vip', status: 'free' },
  ],
}

describe('lugares do mapa', () => {
  it('chave = ambiente:assento; mesa vale todas as cadeiras', () => {
    expect(chaveDoLugar(amb, amb.seats[0])).toBe('terreo:s1')
    expect(ingressosDoLugar(amb.seats[3])).toBe(4)
    expect(ingressosDoLugar({ id: 'x', type: 'table' })).toBe(6)
    expect(ingressosDoLugar(amb.seats[0])).toBe(1)
  })
  it('só assento ou mesa livre com setor ligado a ingresso é vendável', () => {
    expect(amb.seats.map(a => tipoDoLugar(amb, a))).toEqual(['tt1', null, null, 'tt1', null])
  })
  it('itens somam por tipo, com preço e nome do tipo', () => {
    const itens = itensDosLugares(amb, ['terreo:s1', 'terreo:m1', 'terreo:s2'], id => id === 'tt1' ? { name: 'Pista', price: 50 } : undefined)
    expect(itens).toEqual([{ ticket_type_id: 'tt1', quantity: 5, name: 'Pista', price: 50 }])
  })

  it('meia por lugar: assento de meia vira item próprio; mesa não tem meia; p_meias sem nulos', () => {
    const preco = (id: string) => id === 'tt1' ? { name: 'Pista', price: 50, preco_meia: 25, taxa_meia: 2.5 } : undefined
    const meias = { 'terreo:s1': 'pcd', 'terreo:m1': 'estudante' }
    const esc = ['terreo:s1', 'terreo:m1']
    const itens = itensDosLugares(amb, esc, preco, meias)
    console.log('ITENS', JSON.stringify(itens))
    expect(itens).toEqual([
      { ticket_type_id: 'tt1', quantity: 1, name: 'Pista (meia-entrada)', price: 25, taxa_unit: 2.5, beneficio: 'meia', meia_tipo: 'pcd' },
      { ticket_type_id: 'tt1', quantity: 4, name: 'Pista', price: 50 },
    ])
    expect(meiasDosLugares(amb, esc, meias, preco)).toEqual([{ seat_key: 'terreo:s1', meia_tipo: 'pcd' }])
    expect(meiasDosLugares(amb, esc, {}, preco)).toEqual([])
  })
})
