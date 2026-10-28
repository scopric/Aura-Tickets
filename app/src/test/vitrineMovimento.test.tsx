import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { TotalAnimado } from '../components/EventoVitrine'
import { resumoCarrinho, brl } from '../lib/taxa'

// matchMedia falso: `reduzir` liga prefers-reduced-motion, `mouse` liga hover: hover
const media = (o: { reduzir?: boolean; mouse?: boolean }) =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') ? !!o.reduzir : q.includes('hover') ? !!o.mouse : false }))

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('vitrine: movimento', () => {
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
