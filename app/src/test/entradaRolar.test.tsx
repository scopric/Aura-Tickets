import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { useRef } from 'react'
import { useEntradaAoRolar } from '../components/EventoVitrine'

// IntersectionObserver falso: guarda quem foi observado e deixa o teste responder (ou não)
const observers: { alvos: Element[]; cb: IntersectionObserverCallback }[] = []
class IOFalso {
  alvos: Element[] = []
  constructor(public cb: IntersectionObserverCallback) { observers.push(this) }
  observe(e: Element) { this.alvos.push(e) }
  unobserve(e: Element) { this.alvos = this.alvos.filter((x) => x !== e) }
  disconnect() { this.alvos = [] }
}
const responde = (alvo: Element, isIntersecting: boolean) =>
  act(() => { observers[0].cb([{ target: alvo, isIntersecting } as IntersectionObserverEntry], observers[0] as unknown as IntersectionObserver) })

function Caixa({ tarde }: { tarde: boolean }) {
  const r = useRef<HTMLDivElement>(null)
  useEntradaAoRolar(r, true, 0)
  return <div ref={r} data-testid="raiz"><section data-entra="" id="a" />{tarde && <section data-entra="" id="b" />}</div>
}
const media = (reduzir: boolean) => vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') ? reduzir : true }))

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); observers.length = 0 })

describe('entrada ao rolar: nada fica invisível', () => {
  it('bloco que monta depois também é observado e revelado', async () => {
    media(false); vi.stubGlobal('IntersectionObserver', IOFalso)
    const { rerender, container } = render(<Caixa tarde={false} />)
    rerender(<Caixa tarde />)
    await act(async () => { await Promise.resolve() }) // o MutationObserver roda em microtarefa
    const b = container.querySelector('#b')!
    expect(observers[0].alvos).toContain(b)
    responde(b, true)
    expect(b).toHaveAttribute('data-vista')
  })

  it('observer mudo: depois de 1,2 s tudo aparece; observer que respondeu "fora da tela" continua esperando', () => {
    media(false); vi.useFakeTimers(); vi.stubGlobal('IntersectionObserver', IOFalso)
    const { container } = render(<Caixa tarde />)
    const [a, b] = [container.querySelector('#a')!, container.querySelector('#b')!]
    responde(a, false) // a respondeu: está só fora da tela
    act(() => { vi.advanceTimersByTime(1300) })
    expect(b).toHaveAttribute('data-vista') // nunca respondeu: liberado pela trava
    expect(a).not.toHaveAttribute('data-vista') // vai aparecer quando rolar até ele
    responde(a, true)
    expect(a).toHaveAttribute('data-vista')
  })

  it('sem IntersectionObserver ou com reduzir movimento nada é escondido (sem data-evv)', () => {
    media(false); vi.stubGlobal('IntersectionObserver', undefined)
    const um = render(<Caixa tarde />)
    expect(um.getByTestId('raiz')).not.toHaveAttribute('data-evv')
    um.unmount()
    media(true); vi.stubGlobal('IntersectionObserver', IOFalso)
    const dois = render(<Caixa tarde />)
    expect(dois.getByTestId('raiz')).not.toHaveAttribute('data-evv')
  })
})
