import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import GraficoLinha from '../components/producer/GraficoLinha'

const base = { atual: [1, 4, 9, 6], anterior: null, n: 4, formatoValor: String, formatoEixo: String, rotulo: (k: number) => `dia ${k}`, legendaAtual: 'a', legendaAnterior: 'b' }
const tracejadoDaSerie = (c: HTMLElement) => c.querySelectorAll('path.stroke-primary[stroke-dasharray]').length

describe('GraficoLinha: último ponto em curso', () => {
  afterEach(cleanup)
  it('por padrão o trecho final é tracejado (o dia de hoje ainda não fechou)', () => {
    expect(tracejadoDaSerie(render(<GraficoLinha {...base} />).container)).toBe(1)
  })
  it('com ultimoParcial falso (festa encerrada) a série inteira é contínua', () => {
    expect(tracejadoDaSerie(render(<GraficoLinha {...base} ultimoParcial={false} />).container)).toBe(0)
  })
  it('o eixo usa o rótulo curto e a dica mantém o completo', () => {
    const { container } = render(<GraficoLinha {...base} rotuloEixo={k => `${k}h`} />)
    expect(container.textContent).toContain('3h'); expect(container.textContent).not.toContain('dia 3')
  })
  it('marcadores em cada ponto (até 31) e grade pontilhada com base contínua', () => {
    const { container } = render(<GraficoLinha {...base} />)
    expect(container.querySelectorAll('[data-marcador]').length).toBe(4)
    const linhas = [...container.querySelectorAll('svg line.stroke-border')]
    expect(linhas.filter(l => l.getAttribute('stroke-dasharray')).length).toBe(2); expect(linhas.length).toBe(3)
  })
  it('com mais de 31 pontos os marcadores somem (a linha basta)', () => {
    const muitos = Array.from({ length: 40 }, (_, i) => i)
    expect(render(<GraficoLinha {...base} atual={muitos} n={40} />).container.querySelectorAll('[data-marcador]').length).toBe(0)
  })
  it('a dica anuncia as outras métricas do mesmo dia (teclado)', () => {
    const { container } = render(<GraficoLinha {...base} detalhes={k => [{ rotulo: 'Pedidos', valor: String(k + 10) }]} />)
    fireEvent.keyDown(container.querySelector('[role=img]')!, { key: 'ArrowLeft' }) // do último ponto (3) para o 2
    expect(container.querySelector('[aria-live=polite]')!.textContent).toContain('Pedidos 12')
  })
  it('dia sem valor (null) abre uma lacuna: dois trechos, sem marcador e sem preenchimento; a dica mostra "—"', () => {
    const { container } = render(<GraficoLinha {...base} atual={[1, 2, null, 3, 4, 5]} n={6} ultimoParcial={false} />)
    expect(container.querySelectorAll('path.stroke-primary[d]:not(.fill-primary)').length).toBe(2) // [1,2] e [3,4,5]
    expect(container.querySelectorAll('[data-marcador]').length).toBe(5) // o null não tem marcador
    expect(container.querySelector('path.fill-primary')).toBeNull() // área só sem lacuna
    fireEvent.keyDown(container.querySelector('[role=img]')!, { key: 'ArrowLeft' }); fireEvent.keyDown(container.querySelector('[role=img]')!, { key: 'ArrowLeft' }); fireEvent.keyDown(container.querySelector('[role=img]')!, { key: 'ArrowLeft' })
    expect(container.querySelector('[aria-live=polite]')!.textContent).toContain('dia 2: —')
  })
})
