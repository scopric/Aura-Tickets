import { describe, it, expect, beforeEach, vi } from 'vitest'
import { lerPrefixo, lerRecentes, registrarRecente } from '../lib/buscaRapida'

describe('lerPrefixo (@ eventos, / telas, > ações)', () => {
  it('símbolo no começo escolhe o grupo e sai do texto filtrado', () => {
    expect(lerPrefixo('@festa')).toEqual({ grupo: 'eventos', consulta: 'festa' })
    expect(lerPrefixo('/ cupons')).toEqual({ grupo: 'telas', consulta: 'cupons' })
    expect(lerPrefixo('>tema')).toEqual({ grupo: 'acoes', consulta: 'tema' })
    expect(lerPrefixo('  @  noite ')).toEqual({ grupo: 'eventos', consulta: 'noite' })
  })
  it('símbolo sozinho lista o grupo todo; sem símbolo (ou no meio do texto) é tudo', () => {
    expect(lerPrefixo('@')).toEqual({ grupo: 'eventos', consulta: '' })
    expect(lerPrefixo('')).toEqual({ grupo: 'tudo', consulta: '' })
    expect(lerPrefixo('festa @ rock')).toEqual({ grupo: 'tudo', consulta: 'festa @ rock' })
    expect(lerPrefixo('e festa')).toEqual({ grupo: 'tudo', consulta: 'e festa' }) // letra não é prefixo: título pode começar por "e"
    expect(lerPrefixo('@@casa show')).toEqual({ grupo: 'eventos', consulta: '@casa show' }) // para achar um título que começa com "@": repetir o símbolo
  })
})

describe('recentes (até 3, sem duplicar, só ids e rotas)', () => {
  beforeEach(() => localStorage.clear())
  it('o mais novo vai para o topo, repetido sobe sem duplicar, e corta em 3', () => {
    registrarRecente({ tipo: 'tela', ref: '/producer/cupons' })
    registrarRecente({ tipo: 'evento', ref: 'e1' })
    registrarRecente({ tipo: 'tela', ref: '/producer/checkin' })
    registrarRecente({ tipo: 'tela', ref: '/producer/cupons' }) // repetido: sobe
    registrarRecente({ tipo: 'evento', ref: 'e2' })
    expect(lerRecentes()).toEqual([{ tipo: 'evento', ref: 'e2' }, { tipo: 'tela', ref: '/producer/cupons' }, { tipo: 'tela', ref: '/producer/checkin' }])
  })
  it('só ids e rotas ficam guardados (nenhum título)', () => {
    registrarRecente({ tipo: 'evento', ref: 'e1' })
    expect(localStorage.getItem('evk.nav.recentes')).toBe('[{"tipo":"evento","ref":"e1"}]')
  })
  it('lixo ou JSON inválido no armazenamento vira lista vazia, e armazenamento quebrado não lança', () => {
    localStorage.setItem('evk.nav.recentes', '{nao é json')
    expect(lerRecentes()).toEqual([])
    localStorage.setItem('evk.nav.recentes', JSON.stringify([{ tipo: 'tela', ref: 5 }, { tipo: 'x', ref: 'a' }, null, { tipo: 'tela', ref: '/ok' }]))
    expect(lerRecentes()).toEqual([{ tipo: 'tela', ref: '/ok' }])
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado') })
    expect(lerRecentes()).toEqual([])
    vi.restoreAllMocks()
  })
})
