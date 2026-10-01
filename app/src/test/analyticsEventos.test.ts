import { describe, it, expect } from 'vitest'
import { montarEventos, chaveDoCaminho } from '../lib/analyticsEventos'

const UUID = '5413F487-0462-4957-A6B2-3E39EA5DBF6A'
const eventos = [{ id: UUID.toLowerCase(), slug: 'noite-eletro', title: 'Noite Eletro' }]

describe('montarEventos', () => {
  it('soma /event/<id> (em maiúsculas) e /event/<slug> do mesmo evento', () => {
    const r = montarEventos(
      [{ caminho: `/event/${UUID}`, visitantes: 3, paginas: 5 }, { caminho: '/event/noite-eletro/', visitantes: 2, paginas: 4 }],
      eventos,
      [],
    )
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ titulo: 'Noite Eletro', visitantes: 5, paginas: 9, pedidos: 0, conversao: 0 })
  })

  it('conta pedidos, pagos e receita; conversão = pagos ÷ visitantes', () => {
    const r = montarEventos(
      [{ caminho: '/event/noite-eletro', visitantes: 10, paginas: 20 }],
      eventos,
      [
        { event_id: UUID.toLowerCase(), status: 'paid', total: '50.00' },
        { event_id: UUID.toLowerCase(), status: 'pending', total: 50 },
        { event_id: UUID.toLowerCase(), status: 'paid', total: 30 },
      ],
    )
    expect(r[0]).toMatchObject({ pedidos: 3, pagos: 2, receita: 80, conversao: 0.2 })
  })

  it('conversão acima de 100% ou sem visitas vira null; endereço sem evento fica identificado', () => {
    const r = montarEventos(
      [{ caminho: '/event/apagado', visitantes: 1, paginas: 1 }],
      eventos,
      [{ event_id: UUID.toLowerCase(), status: 'paid', total: 10 }],
    )
    const orfao = r.find(l => l.id === null)
    const semVisita = r.find(l => l.id === UUID.toLowerCase())
    expect(orfao?.titulo).toBe('/event/apagado')
    expect(semVisita?.conversao).toBeNull()
  })

  it('chaveDoCaminho tira barra final e query', () => {
    expect(chaveDoCaminho('/event/abc/?x=1')).toBe('abc')
    expect(chaveDoCaminho('/event/s%C3%A3o')).toBe('são')
  })
})
