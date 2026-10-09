import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  haversineKm, linkApple, linkGoogle, linkRoteiro, linkWaze, paradasDoRoteiro, temCoordenadas, tipoAparelho, MAX_PARADAS_ROTEIRO,
} from '../lib/quadroMapa'
import type { DbTask } from '../hooks/useProducerTools'

const SP = { lat: -23.5505, lng: -46.6333 }
const RJ = { lat: -22.9068, lng: -43.1729 }
const tarefa = (id: string, o: Partial<DbTask> = {}) => ({
  id, producer_id: 'u1', event_id: null, assigned_to: null, title: `Cartão ${id}`, description: null, due_date: null, status: 'todo', priority: 'medium',
  created_at: `2026-10-0${(id.charCodeAt(0) % 9) + 1}T00:00:00Z`, ...o,
}) as DbTask

describe('links de rota', () => {
  it('com coordenadas: usa lat,lng codificado nos três apps', () => {
    expect(linkGoogle(SP)).toBe('https://www.google.com/maps/dir/?api=1&destination=-23.5505%2C-46.6333&travelmode=driving&dir_action=navigate')
    expect(linkWaze(SP)).toBe('https://waze.com/ul?ll=-23.5505%2C-46.6333&navigate=yes')
    expect(linkApple(SP)).toBe('https://maps.apple.com/?daddr=-23.5505%2C-46.6333&dirflg=d')
  })
  it('sem coordenadas: usa o texto, com encoding (acento, &, # e espaço)', () => {
    const l = { txt: 'Rua Itu, 12 & Cia #3 São Paulo' }
    const g = linkGoogle(l)!
    expect(g).toContain('destination=Rua%20Itu%2C%2012%20%26%20Cia%20%233%20S%C3%A3o%20Paulo')
    expect(linkWaze(l)).toBe('https://waze.com/ul?q=Rua%20Itu%2C%2012%20%26%20Cia%20%233%20S%C3%A3o%20Paulo&navigate=yes')
    expect(new URL(g).searchParams.get('destination')).toBe(l.txt)
  })
  it('texto com javascript: ou http: continua só um valor dentro de https', () => {
    for (const txt of ['javascript:alert(1)', 'https://evil.com/x', '"><script>']) {
      for (const url of [linkGoogle({ txt }), linkWaze({ txt }), linkApple({ txt })]) {
        expect(url).toMatch(/^https:\/\/(www\.google\.com|waze\.com|maps\.apple\.com)\//)
        expect(url!.toLowerCase()).not.toContain('javascript:')
        expect(new URL(url!).host).toMatch(/^(www\.google\.com|waze\.com|maps\.apple\.com)$/)
      }
    }
  })
  it('sem nada para ir: devolve null', () => {
    expect(linkGoogle({})).toBeNull()
    expect(linkWaze(null)).toBeNull()
    expect(linkApple({ txt: '   ' })).toBeNull()
  })
})

describe('coordenadas', () => {
  it('recusa fora da faixa, NaN, texto e metade do par', () => {
    expect(temCoordenadas({ lat: 90, lng: 180 })).toBe(true)
    expect(temCoordenadas({ lat: 90.01, lng: 0 })).toBe(false)
    expect(temCoordenadas({ lat: 0, lng: -180.5 })).toBe(false)
    expect(temCoordenadas({ lat: Number.NaN, lng: 0 })).toBe(false)
    expect(temCoordenadas({ lat: '1' as unknown as number, lng: 0 })).toBe(false)
    expect(temCoordenadas({ lat: 10 })).toBe(false)
  })
  it('coordenada inválida não vira link com ela: cai no texto', () => {
    expect(linkGoogle({ lat: 99, lng: 0, txt: 'Praça' })).toContain('destination=Pra%C3%A7a')
    expect(linkWaze({ lat: 99, lng: 0 })).toBeNull()
  })
})

describe('haversine', () => {
  it('São Paulo a Rio dá cerca de 360 km e a distância de um ponto a ele mesmo é 0', () => {
    expect(haversineKm(SP, RJ)).toBeGreaterThan(355)
    expect(haversineKm(SP, RJ)).toBeLessThan(362)
    expect(haversineKm(SP, SP)).toBe(0)
    expect(haversineKm(SP, RJ)).toBeCloseTo(haversineKm(RJ, SP), 9)
  })
})

describe('roteiro', () => {
  const doze = Array.from({ length: 12 }, (_, i) => tarefa(`t${i}`, { due_date: `2026-11-${String(i + 1).padStart(2, '0')}T12:00:00-03:00`, location: { lat: -23 + i * 0.01, lng: -46 } }))
  const aberta = () => false

  it('ordena por prazo, ignora arquivado, concluído e destino repetido', () => {
    const lista = [
      tarefa('b', { due_date: '2026-11-05T12:00:00-03:00', location: { txt: 'B' } }),
      tarefa('a', { due_date: '2026-11-01T12:00:00-03:00', location: { txt: 'A' } }),
      tarefa('c', { due_date: '2026-11-02T12:00:00-03:00', location: { txt: 'A' } }), // mesmo destino de a
      tarefa('d', { location: { txt: 'D' }, archived_at: '2026-10-01T00:00:00Z' }),
      tarefa('e', { location: { txt: 'E' }, column_id: 'feito' }),
      tarefa('f', { location: null }),
    ]
    const p = paradasDoRoteiro(lista, t => t.column_id === 'feito')
    expect(p.map(x => x.id)).toEqual(['a', 'b'])
  })
  it('limita a 9 paradas: o link tem 8 pontos intermediários e o destino é a 9ª', () => {
    const p = paradasDoRoteiro(doze, aberta)
    expect(p).toHaveLength(12)
    const url = new URL(linkRoteiro(p)!.url)
    expect(url.searchParams.get('waypoints')!.split('|')).toHaveLength(MAX_PARADAS_ROTEIRO - 1)
    expect(url.searchParams.get('destination')).toBe(`${p[8].local.lat},${p[8].local.lng}`)
    expect(url.search).not.toContain(String(p[9].local.lat))
  })
  it('uma parada só: sem waypoints; nenhuma: null', () => {
    expect(linkRoteiro(paradasDoRoteiro([doze[0]], aberta))!.url).not.toContain('waypoints')
    expect(linkRoteiro([])).toBeNull()
  })
  it('com a posição da pessoa ordena do mais perto ao mais longe, sem pôr a posição no link', () => {
    const ordem = paradasDoRoteiro(doze, aberta, { lat: -22.8, lng: -46 })
    expect(ordem[0].id).toBe('t11')
    expect(ordem[11].id).toBe('t0')
    expect(linkRoteiro(ordem)!.url).not.toContain('origin')
    expect(linkRoteiro(ordem)!.url).not.toContain('-22.8%2C')
  })
})

describe('limites do texto e do link', () => {
  it('corta o endereço em 200 caracteres nos três links', () => {
    const l = { txt: 'a'.repeat(500) }
    expect(new URL(linkGoogle(l)!).searchParams.get('destination')).toHaveLength(200)
    expect(new URL(linkWaze(l)!).searchParams.get('q')).toHaveLength(200)
    expect(new URL(linkApple(l)!).searchParams.get('daddr')).toHaveLength(200)
  })
  it('o link do roteiro nunca passa de 2.000 caracteres: reduz as paradas e diz quantas entraram', () => {
    const longas = Array.from({ length: 9 }, (_, i) => tarefa(`z${i}`, { due_date: `2026-11-0${i + 1}T12:00:00-03:00`, location: { txt: `${i}ç `.repeat(60) } }))
    const p = paradasDoRoteiro(longas, () => false)
    const r = linkRoteiro(p)!
    expect(r.url.length).toBeLessThanOrEqual(2000)
    expect(r.usadas).toBeLessThan(9)
    expect(r.usadas).toBeGreaterThan(0)
    // com endereços curtos entram as 9
    const curtas = paradasDoRoteiro(Array.from({ length: 9 }, (_, i) => tarefa(`k${i}`, { location: { txt: `Rua ${i}`, lat: i, lng: i } })), () => false)
    expect(linkRoteiro(curtas)!.usadas).toBe(9)
  })
})

describe('tipo de aparelho (sem user agent)', () => {
  afterEach(() => vi.unstubAllGlobals())
  const com = (toque: boolean, largura: number) => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: toque && q.includes('coarse') }))
    vi.stubGlobal('innerWidth', largura)
  }
  it('mouse = computador; toque estreito = celular; toque largo = tablet', () => {
    com(false, 1400); expect(tipoAparelho()).toBe('computador')
    com(true, 390); expect(tipoAparelho()).toBe('celular')
    com(true, 1024); expect(tipoAparelho()).toBe('tablet')
  })
})
