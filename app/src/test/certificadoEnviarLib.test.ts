import { describe, it, expect, vi } from 'vitest'
import { enviarEmLote, type ResultadoEnvio } from '../lib/certificadoEnviar'
vi.mock('../lib/supabase', () => ({ supabase: {} }))

const ok: ResultadoEnvio = { ok: true }
const falha = (status: number, erro = 'x'): ResultadoEnvio => ({ ok: false, status, erro })
const seq = (...rs: ResultadoEnvio[]) => { const f = vi.fn(); rs.forEach(r => f.mockResolvedValueOnce(r)); return f }

describe('enviarEmLote', () => {
  it('todos enviados', async () => {
    expect(await enviarEmLote(['a', 'b', 'c'], seq(ok, ok, ok))).toEqual({ enviados: 3, naoEnviados: 0, motivo: null, parouNoLimite: false })
  })
  it('problema de uma pessoa (409 sem ingresso, 422 sem e-mail) não para o lote', async () => {
    const f = seq(ok, falha(409, 'sem ingresso'), falha(422, 'sem e-mail'), ok)
    expect(await enviarEmLote(['a', 'b', 'c', 'd'], f)).toEqual({ enviados: 2, naoEnviados: 2, motivo: 'sem ingresso', parouNoLimite: false })
    expect(f).toHaveBeenCalledTimes(4)
  })
  it('limite (429) para e conta o que sobrou como não enviado', async () => {
    const f = seq(ok, ok, falha(429, 'limite'))
    expect(await enviarEmLote(['a', 'b', 'c', 'd', 'e'], f)).toEqual({ enviados: 2, naoEnviados: 3, motivo: 'limite', parouNoLimite: true })
    expect(f).toHaveBeenCalledTimes(3)
  })
  it('acesso negado (403), servidor (500) e rede (0) também param', async () => {
    for (const s of [401, 403, 500, 502, 0]) {
      const f = seq(falha(s, 'parou'))
      expect(await enviarEmLote(['a', 'b'], f)).toMatchObject({ enviados: 0, naoEnviados: 2, motivo: 'parou' })
      expect(f).toHaveBeenCalledTimes(1)
    }
  })
  it('lista vazia não chama nada', async () => {
    const f = vi.fn()
    expect(await enviarEmLote([], f)).toEqual({ enviados: 0, naoEnviados: 0, motivo: null, parouNoLimite: false })
    expect(f).not.toHaveBeenCalled()
  })
})
