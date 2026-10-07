import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DestaqueCampo, { type AlvoDestaque } from '../components/producer/painel/DestaqueCampo'

const a = (campo: string): AlvoDestaque => ({ campo, msg: `falta ${campo}`, secao: 'oque' })

function monta(alvos: AlvoDestaque[], onFechar = vi.fn(), onIndice = vi.fn()) {
  const r = render(<><input id="f-nome" /><input id="f-outro" /><DestaqueCampo alvos={alvos} indice={0} onIndice={onIndice} onFechar={onFechar} /></>)
  return { ...r, onFechar, onIndice }
}

describe('DestaqueCampo', () => {
  beforeEach(() => {
    window.matchMedia = (() => ({ matches: true })) as never
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('congela a lista ao abrir: mudar os alvos por fora não troca o campo focado', () => {
    const { rerender, onFechar, onIndice } = monta([a('f-nome'), a('f-outro')])
    expect(document.activeElement?.id).toBe('f-nome')
    rerender(<><input id="f-nome" /><input id="f-outro" /><DestaqueCampo alvos={[a('f-outro')]} indice={0} onIndice={onIndice} onFechar={onFechar} /></>)
    expect(document.activeElement?.id).toBe('f-nome')
    expect(screen.getByText(/1 de 2/)).toBeTruthy()
  })

  it('fecha ao digitar no campo destacado, não em outro, e Esc fecha', () => {
    const { onFechar } = monta([a('f-nome')])
    fireEvent.input(document.getElementById('f-outro')!)
    expect(onFechar).not.toHaveBeenCalled()
    fireEvent.input(document.getElementById('f-nome')!)
    expect(onFechar).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(onFechar).toHaveBeenCalledTimes(2)
  })

  it('Esc não fecha com diálogo ou lista Radix aberto', () => {
    const { onFechar } = monta([a('f-nome')])
    const d = document.createElement('div'); d.setAttribute('role', 'listbox'); d.setAttribute('data-state', 'open'); document.body.append(d)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(onFechar).not.toHaveBeenCalled()
  })
})
