import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, render, screen, fireEvent } from '@testing-library/react'
import type { Environment, SeatNode } from '../pages/producer/mapa/modelo'

const evo = vi.hoisted(() => ({ chamarEvo: vi.fn() }))
vi.mock('../lib/evo', async orig => ({ ...(await orig<typeof import('../lib/evo')>()), chamarEvo: evo.chamarEvo }))
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

import { usarLeitorPlanta } from '../pages/producer/mapa/LeitorPlanta'
import PainelLeitor from '../pages/producer/mapa/LeitorPlanta'
import { acrescentarPecas } from '../pages/producer/mapa/regras'
import { nosDaProposta, emMetros, type Quadro } from '../lib/plantaIA'
import { limites } from '../pages/producer/mapa/geometria'

const IMG = 'data:image/png;base64,AAAA'
const peca = (o: object = {}) => ({ tipo: 'table', x: 0.5, y: 0.5, w: 0.1, h: 0.1, ...o })
const ok = (pecas: unknown[], extra = {}) => ({ ok: true, pecas, descartadas: 0, usage_id: 'u', restante: 7, custo: 5, ...extra })
const Q: Quadro = { offset: { x: 100, y: 80 }, scale: 1, naturalWidth: 2000, naturalHeight: 1000, pixelsPerMeter: 40 }

const no = (o: Partial<SeatNode>): SeatNode => ({
  id: 'n', x: 12, y: 12, label: 'X', type: 'seat', color: '#111111', price: 10, rotation: 0, sold: 0, capacity: 1,
  sectionId: 'a', status: 'free', locked: false, ...o,
})
const env = (seats: SeatNode[]): Environment => ({
  id: 'terreo', name: 'T', seats, walls: [], pixelsPerMeter: 40, roomWidth: 40, roomHeight: 40,
  sections: [{ id: 'a', name: 'A', color: '#aa0000', price: 10 }],
} as Environment)

beforeEach(() => { vi.clearAllMocks() })

describe('usarLeitorPlanta', () => {
  it('lê, valida e guarda a proposta separada; tipo desconhecido e medida fora de 0..1 são descartados e contados', async () => {
    evo.chamarEvo.mockResolvedValue(ok([peca(), peca({ tipo: 'nave' }), peca({ w: 2 }), peca({ tipo: 'stage', rotulo: 'Palco' })]))
    const { result } = renderHook(() => usarLeitorPlanta('e1', IMG))
    const pronto = vi.fn()
    await act(() => result.current.ler(pronto))
    expect(evo.chamarEvo).toHaveBeenCalledWith({ mode: 'planta', event_id: 'e1', imagem: IMG })
    expect(result.current.propostaAtual?.pecas.map(p => p.tipo)).toEqual(['table', 'stage'])
    expect(result.current.propostaAtual).toMatchObject({ custo: 5, restante: 7 })
    expect(pronto).toHaveBeenCalled()
    expect(toast.success.mock.calls[0][0]).toContain('2 descartada(s)')
  })

  it('marcar peça e desmarcar tipo', async () => {
    evo.chamarEvo.mockResolvedValue(ok([peca(), peca(), peca({ tipo: 'stage' })]))
    const { result } = renderHook(() => usarLeitorPlanta('e1', IMG))
    await act(() => result.current.ler(() => {}))
    act(() => result.current.alternarPeca('ia-0'))
    expect(result.current.propostaAtual!.pecas.map(p => p.marcada)).toEqual([false, true, true])
    act(() => result.current.alternarTipo('table')) // nem todas marcadas: marca todas
    act(() => result.current.alternarTipo('table')) // todas marcadas: desmarca todas
    expect(result.current.propostaAtual!.pecas.map(p => p.marcada)).toEqual([false, false, true])
  })

  it.each([
    ['sem_credito', { custo: 5, restante: 2 }, 'custa 5 créditos e você tem 2'],
    ['limite_planta', {}, 'muitas leituras de planta'],
    ['planta_instavel', {}, 'não usou seus créditos'],
  ])('erro %s: mensagem, nada proposto, botão solto de novo', async (motivo, extra, texto) => {
    evo.chamarEvo.mockResolvedValue({ ok: false, motivo, ...extra })
    const { result } = renderHook(() => usarLeitorPlanta('e1', IMG))
    await act(() => result.current.ler(() => {}))
    expect(toast.error.mock.calls[0][0]).toContain(texto)
    expect(result.current.propostaAtual).toBeNull()
    expect(result.current.lendo).toBe(false)
  })

  it('arquivo_invalido usa a mensagem do servidor; rede que explode e resposta malformada não quebram nem travam', async () => {
    const { result } = renderHook(() => usarLeitorPlanta('e1', IMG))
    evo.chamarEvo.mockResolvedValueOnce({ ok: false, motivo: 'arquivo_invalido', message: 'Use PNG até 1,5 MB.' })
    await act(() => result.current.ler(() => {}))
    expect(toast.error).toHaveBeenLastCalledWith('Use PNG até 1,5 MB.')
    evo.chamarEvo.mockRejectedValueOnce(new Error('rede'))
    await act(() => result.current.ler(() => {}))
    expect(toast.error).toHaveBeenLastCalledWith(expect.stringContaining('conexão'))
    for (const lixo of [null, 'texto', { ok: true, pecas: 'x' }, { ok: true }]) {
      evo.chamarEvo.mockResolvedValueOnce(lixo)
      await act(() => result.current.ler(() => {}))
      expect(result.current.lendo).toBe(false)
      expect(result.current.propostaAtual).toBeNull()
    }
  })

  it('duplo clique em Ler chama o servidor uma vez só', async () => {
    let solta!: (v: unknown) => void
    evo.chamarEvo.mockReturnValue(new Promise(r => { solta = r }))
    const { result } = renderHook(() => usarLeitorPlanta('e1', IMG))
    let a!: Promise<void>, b!: Promise<void>
    act(() => { a = result.current.ler(() => {}); b = result.current.ler(() => {}) })
    expect(result.current.lendo).toBe(true)
    await act(async () => { solta(ok([peca()])); await a; await b })
    expect(evo.chamarEvo).toHaveBeenCalledTimes(1)
    expect(result.current.propostaAtual?.pecas).toHaveLength(1)
  })

  it('planta trocada durante a leitura: descarta com aviso', async () => {
    let solta!: (v: unknown) => void
    evo.chamarEvo.mockReturnValue(new Promise(r => { solta = r }))
    const { result, rerender } = renderHook(({ img }) => usarLeitorPlanta('e1', img), { initialProps: { img: IMG } })
    let p!: Promise<void>
    act(() => { p = result.current.ler(() => {}) })
    rerender({ img: 'data:image/png;base64,BBBB' })
    await act(async () => { solta(ok([peca()])); await p })
    expect(result.current.propostaAtual).toBeNull()
    expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('A planta mudou'))
  })

  it('proposta já pronta some se a planta é trocada ou removida', async () => {
    evo.chamarEvo.mockResolvedValue(ok([peca()]))
    const { result, rerender } = renderHook(({ img }) => usarLeitorPlanta('e1', img), { initialProps: { img: IMG as string | undefined } })
    await act(() => result.current.ler(() => {}))
    expect(result.current.propostaAtual).not.toBeNull()
    rerender({ img: undefined })
    expect(result.current.propostaAtual).toBeNull()
  })

  it('troca de evento descarta a proposta e a leitura em voo', async () => {
    evo.chamarEvo.mockResolvedValueOnce(ok([peca()]))
    const { result, rerender } = renderHook(({ id }) => usarLeitorPlanta(id, IMG), { initialProps: { id: 'e1' } })
    await act(() => result.current.ler(() => {}))
    rerender({ id: 'e2' })
    expect(result.current.propostaAtual).toBeNull()

    let solta!: (v: unknown) => void
    evo.chamarEvo.mockReturnValueOnce(new Promise(r => { solta = r }))
    let p!: Promise<void>
    act(() => { p = result.current.ler(() => {}) })
    rerender({ id: 'e3' })
    expect(result.current.lendo).toBe(false)
    await act(async () => { solta(ok([peca()])); await p })
    expect(result.current.propostaAtual).toBeNull()
    expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('já foi cobrada'))
  })

  it('troca de evento com leitura que FALHOU: aviso neutro, sem dizer que foi cobrada', async () => {
    let solta!: (v: unknown) => void
    evo.chamarEvo.mockReturnValueOnce(new Promise(r => { solta = r }))
    const { result, rerender } = renderHook(({ id }) => usarLeitorPlanta(id, IMG), { initialProps: { id: 'e1' } })
    let p!: Promise<void>
    act(() => { p = result.current.ler(() => {}) })
    rerender({ id: 'e2' })
    await act(async () => { solta({ ok: false, motivo: 'planta_instavel' }); await p })
    const msg = toast.info.mock.calls.at(-1)![0] as string
    expect(msg).toContain('interrompida')
    expect(msg).not.toContain('cobrada')
  })

  it('planta salva grande demais não é enviada', async () => {
    const { result } = renderHook(() => usarLeitorPlanta('e1', 'data:image/png;base64,' + 'A'.repeat(2_100_000)))
    await act(() => result.current.ler(() => {}))
    expect(evo.chamarEvo).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalled()
  })
})

describe('aplicar a proposta', () => {
  const seats = [
    no({ id: 'v', label: 'Mesa 1', type: 'table', sold: 1, status: 'sold' }),
    no({ id: 'l', label: 'A1', locked: true, status: 'blocked' }),
  ]
  const sec = { id: 'a', name: 'A', color: '#aa0000', price: 10 }
  const marcada = (o: object, marcada = true) => ({ ...peca(o), id: `ia-${Math.random()}`, marcada }) as never

  it('só as marcadas viram nós; existentes intactos; mesas continuam numeradas; estrutura fora da seção de venda', () => {
    const e = env(seats)
    const nos = nosDaProposta([marcada({}), marcada({}), marcada({ tipo: 'stage', rotulo: 'Palco' }), marcada({}, false)], Q)
    let n = 0
    const r = acrescentarPecas(e, nos, sec, () => `x${n++}`)
    expect(r.ids).toEqual(['x0', 'x1', 'x2'])
    expect(r.env.seats.slice(0, 2)).toEqual(seats) // existentes idênticos (vendido e travado)
    const novos = r.env.seats.slice(2)
    expect(novos.map(s => s.label)).toEqual(['Mesa 2', 'Mesa 3', 'Palco'])
    expect(novos.map(s => s.sectionId)).toEqual(['a', 'a', 'estrutura'])
    expect(novos[2]).toMatchObject({ price: 0, status: 'free', sold: 0, locked: false })
    expect(r.env.sections.map(s => s.id)).toEqual(['a', 'estrutura'])
    expect(novos[0]).toMatchObject({ x: emMetros(peca(), Q).x, widthMeter: emMetros(peca(), Q).widthMeter, tableShape: 'rectangle' }) // 2,5 x 1,25 m: não é quadrada
    expect(e.seats).toBe(seats) // não mutou o pavimento de origem
  })

  it('rótulo repetido da IA não duplica; peça fora da sala é detectada pelas mesmas contas do editor', () => {
    const nos = nosDaProposta([marcada({ rotulo: 'A1' }), marcada({ x: 0.99, y: 0.99 })], { ...Q, scale: 3 })
    const e = env(seats)
    const r = acrescentarPecas(e, nos, sec, (() => { let i = 0; return () => `y${i++}` })())
    expect(r.env.seats[2].label).toBe('Mesa 2')
    const fora = r.env.seats.filter(s => r.ids.includes(s.id) && limites({ ...e, seats: [s], walls: [] }).w > 40) // mesma regra do aviso do editor
    expect(fora.map(s => s.id)).toEqual(['y1'])
  })
})

describe('PainelLeitor', () => {
  const leitor = (extra = {}) => ({ lendo: false, propostaAtual: null, ler: vi.fn(), descartar: vi.fn(), alternarPeca: vi.fn(), alternarTipo: vi.fn(), ...extra }) as never
  it('mostra privacidade, custo e proposta antes do botão; Esc fecha; botão desabilitado lendo', () => {
    const onFechar = vi.fn()
    const { rerender } = render(<PainelLeitor leitor={leitor()} naoCalibrada={false} onLer={vi.fn()} onAplicar={vi.fn()} onFechar={onFechar} />)
    const d = screen.getByRole('dialog')
    expect(d.textContent).toMatch(/Google Gemini/)
    expect(d.textContent).toMatch(/5 créditos/)
    expect(d.textContent).toMatch(/proposta/)
    expect(d.textContent).toMatch(/não desfaz a cobrança/)
    fireEvent.keyDown(d, { key: 'Escape' })
    expect(onFechar).toHaveBeenCalledTimes(1)
    rerender(<PainelLeitor leitor={leitor({ lendo: true })} naoCalibrada={false} onLer={vi.fn()} onAplicar={vi.fn()} onFechar={onFechar} />)
    expect((screen.getByRole('button', { name: 'Lendo…' }) as HTMLButtonElement).disabled).toBe(true)
  })

  describe('com proposta já cobrada', () => {
    const prop = { imagem: IMG, eventId: 'e1', custo: 5, restante: 7, pecas: [{ ...peca(), id: 'ia-0', marcada: true }] }
    const montar = () => {
      const l = leitor({ propostaAtual: prop })
      const onFechar = vi.fn()
      render(<PainelLeitor leitor={l} naoCalibrada={false} onLer={vi.fn()} onAplicar={vi.fn()} onFechar={onFechar} />)
      return { l: l as unknown as { descartar: ReturnType<typeof vi.fn> }, onFechar }
    }
    it('mostra o aviso permanente; Esc e Fechar só fecham e não apagam a proposta', () => {
      const { l, onFechar } = montar()
      expect(screen.getByRole('dialog').textContent).toContain('Esta leitura já foi cobrada; fechar não perde a proposta, descartar sim.')
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
      fireEvent.click(screen.getByRole('button', { name: /Fechar o painel/ }))
      expect(onFechar).toHaveBeenCalledTimes(2)
      expect(l.descartar).not.toHaveBeenCalled()
    })
    it('Descartar pede confirmação: recusando nada acontece; confirmando apaga e fecha', () => {
      const { l, onFechar } = montar()
      const c = vi.spyOn(window, 'confirm').mockReturnValue(false)
      fireEvent.click(screen.getByRole('button', { name: 'Descartar' }))
      expect(c.mock.calls[0][0]).toContain('já foi cobrada')
      expect(l.descartar).not.toHaveBeenCalled()
      expect(onFechar).not.toHaveBeenCalled()
      c.mockReturnValue(true)
      fireEvent.click(screen.getByRole('button', { name: 'Descartar' }))
      expect(l.descartar).toHaveBeenCalledTimes(1)
      expect(onFechar).toHaveBeenCalledTimes(1)
      c.mockRestore()
    })
  })
})
