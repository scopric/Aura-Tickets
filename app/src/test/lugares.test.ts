import { describe, it, expect } from 'vitest'
import { chaveDoLugar, ingressosDoLugar, itensDosLugares, tipoDoLugar } from '../lib/lugares'

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
})
