import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { CapaInclinada, TotalAnimado } from '../components/EventoVitrine'
import { resumoCarrinho, brl } from '../lib/taxa'

// matchMedia falso: `reduzir` liga prefers-reduced-motion, `mouse` liga hover: hover
const media = (o: { reduzir?: boolean; mouse?: boolean }) =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') ? !!o.reduzir : q.includes('hover') ? !!o.mouse : false }))

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

function mover() {
  const { container } = render(<CapaInclinada><i /></CapaInclinada>)
  const fora = container.firstElementChild as HTMLElement
  vi.spyOn(fora, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100 } as DOMRect)
  act(() => { fora.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 100, clientY: 0 })) }) // jsdom não tem PointerEvent
  return (fora.firstElementChild as HTMLElement).style.getPropertyValue('--ry')
}

describe('vitrine: movimento', () => {
  it('a capa inclina só com mouse e sem "reduzir movimento"', () => {
    media({ mouse: true })
    expect(mover()).toBe('5deg')
    media({ mouse: false })
    expect(mover()).toBe('')
    media({ mouse: true, reduzir: true })
    expect(mover()).toBe('')
    vi.unstubAllGlobals() // sem matchMedia (jsdom): não mexe
    expect(mover()).toBe('')
  })

  it('o total termina exatamente no valor do resumo do carrinho, também depois de animar', () => {
    media({})
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
    const total = (n: number) => resumoCarrinho([{ preco: 25, qtd: n }]).total
    const { container, rerender } = render(<TotalAnimado valor={total(1)} />)
    expect(container.textContent).toBe(brl(total(1)))
    rerender(<TotalAnimado valor={total(3)} />)
    act(() => { vi.advanceTimersByTime(100) })
    expect(container.textContent).not.toBe(brl(total(3))) // no meio da conta
    act(() => { vi.advanceTimersByTime(600) })
    expect(container.textContent).toBe(brl(total(3)))
  })

  it('com "reduzir movimento" o total troca direto', () => {
    media({ reduzir: true })
    const { container, rerender } = render(<TotalAnimado valor={28} />)
    rerender(<TotalAnimado valor={84} />)
    expect(container.textContent).toBe(brl(84))
  })

  it('reduzir movimento ligado e depois desligado: o total exibido nunca fica defasado', () => {
    media({ reduzir: true })
    const { container, rerender } = render(<TotalAnimado valor={28} />)
    rerender(<TotalAnimado valor={84} />)
    media({})
    rerender(<TotalAnimado valor={84} />)
    expect(container.textContent).toBe(brl(84))
  })
})
