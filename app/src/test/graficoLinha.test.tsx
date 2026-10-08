import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
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
})
