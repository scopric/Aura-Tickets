import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAutoSave } from '../components/producer/painel/useAutoSave'

// Salvamento automático do painel: 800 ms depois da última mudança, uma gravação por vez.
type P = { mudou: number; ativo?: boolean }

function monta(gravar: () => Promise<void>, temMudanca = () => true) {
  return renderHook(({ mudou, ativo = true }: P) => useAutoSave({ ativo, mudou, temMudanca, gravar }), { initialProps: { mudou: 0 } as P })
}
const avanca = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })

describe('useAutoSave', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.spyOn(console, 'error').mockImplementation(() => undefined) })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  it('grava 800 ms depois da mudança, não antes; Salvando… e depois Salvo', async () => {
    let fim!: () => void
    const gravar = vi.fn(() => new Promise<void>(ok => { fim = ok }))
    const { result } = monta(gravar)
    await avanca(799)
    expect(gravar).not.toHaveBeenCalled()
    await avanca(1)
    expect(gravar).toHaveBeenCalledTimes(1)
    expect(result.current.estado).toBe('salvando')
    await act(async () => { fim() })
    expect(result.current.estado).toBe('salvo')
  })

  it('cada mudança reinicia a espera (só grava depois da última)', async () => {
    const gravar = vi.fn(async () => undefined)
    const { rerender } = monta(gravar)
    await avanca(500); rerender({ mudou: 1 })
    await avanca(500); rerender({ mudou: 2 })
    await avanca(799)
    expect(gravar).not.toHaveBeenCalled()
    await avanca(1)
    expect(gravar).toHaveBeenCalledTimes(1)
  })

  it('uma gravação por vez: mudou durante a gravação, grava de novo quando terminar', async () => {
    const fins: (() => void)[] = []
    let ativas = 0, maxAtivas = 0
    const gravar = vi.fn(() => { ativas++; maxAtivas = Math.max(maxAtivas, ativas); return new Promise<void>(ok => { fins.push(() => { ativas--; ok() }) }) })
    const { rerender, result } = monta(gravar)
    await avanca(800)
    expect(gravar).toHaveBeenCalledTimes(1)
    rerender({ mudou: 1 })
    await avanca(800) // o timer da 2ª mudança dispara com a 1ª ainda gravando
    expect(gravar).toHaveBeenCalledTimes(1)
    await act(async () => { fins[0]() })
    expect(gravar).toHaveBeenCalledTimes(2) // regravou o que mudou no meio
    await act(async () => { fins[1]() })
    expect(maxAtivas).toBe(1)
    expect(result.current.estado).toBe('salvo')
  })

  it('erro: mostra "erro", não insiste sozinho e "Tentar de novo" grava', async () => {
    const gravar = vi.fn().mockRejectedValueOnce(new Error('rede')).mockResolvedValue(undefined)
    const { result } = monta(gravar)
    await avanca(800)
    expect(result.current.estado).toBe('erro')
    await avanca(5000)
    expect(gravar).toHaveBeenCalledTimes(1)
    await act(async () => { await result.current.tentarDeNovo() })
    expect(gravar).toHaveBeenCalledTimes(2)
    expect(result.current.estado).toBe('salvo')
  })

  it('sem mudança em relação ao salvo: não grava e não mostra nada', async () => {
    const gravar = vi.fn(async () => undefined)
    const { result } = monta(gravar, () => false)
    await avanca(2000)
    expect(gravar).not.toHaveBeenCalled()
    expect(result.current.estado).toBe('ocioso')
  })

  it('desligado (evento no ar): nada salva sozinho', async () => {
    const gravar = vi.fn(async () => undefined)
    renderHook(() => useAutoSave({ ativo: false, mudou: 1, temMudanca: () => true, gravar }))
    await avanca(2000)
    expect(gravar).not.toHaveBeenCalled()
  })

  it('sair da tela com mudança pendente grava na hora', async () => {
    const gravar = vi.fn(async () => undefined)
    const { unmount } = monta(gravar)
    await avanca(300)
    unmount()
    await avanca(0)
    expect(gravar).toHaveBeenCalledTimes(1)
  })
})
