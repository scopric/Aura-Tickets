import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react'
import Quadro from '../components/producer/quadro/Quadro'
import { corPrazo, posicaoNaColuna } from '../lib/tarefas'
import type { ColunaQuadro, DbTask } from '../hooks/useProducerTools'

describe('corPrazo', () => {
  const hoje = '2026-10-09'
  it('vencido fora de Feito é erro; em Feito é neutro', () => {
    expect(corPrazo('2026-10-08T12:00:00-03:00', 'todo', hoje)).toBe('erro')
    expect(corPrazo('2026-10-08T12:00:00-03:00', 'doing', hoje)).toBe('erro')
    expect(corPrazo('2026-10-08T12:00:00-03:00', 'done', hoje)).toBe('neutro')
  })
  it('até 3 dias (hoje incluso) é aviso; depois disso e sem prazo é neutro', () => {
    expect(corPrazo('2026-10-09T12:00:00-03:00', 'todo', hoje)).toBe('aviso')
    expect(corPrazo('2026-10-12T12:00:00-03:00', 'todo', hoje)).toBe('aviso')
    expect(corPrazo('2026-10-13T12:00:00-03:00', 'todo', hoje)).toBe('neutro')
    expect(corPrazo(null, 'todo', hoje)).toBe('neutro')
  })
})

describe('posicaoNaColuna', () => {
  it('coluna vazia, topo, fim e meio', () => {
    expect(posicaoNaColuna([], 0)).toBe(1000)
    expect(posicaoNaColuna([1000, 2000], 0)).toBe(500)
    expect(posicaoNaColuna([1000, 2000], 2)).toBe(3000)
    expect(posicaoNaColuna([1000, 2000], 1)).toBe(1500)
  })
  it('encaixes seguidos no mesmo ponto continuam ordenados', () => {
    let outras = [1000, 2000]
    for (let n = 0; n < 30; n++) { const p = posicaoNaColuna(outras, 1); expect(p).toBeGreaterThan(outras[0]); expect(p).toBeLessThan(outras[outras.length - 1]); outras = [outras[0], p, 2000] }
  })
})

const colunas: ColunaQuadro[] = [
  { id: 'c1', name: 'A fazer', kind: 'todo' },
  { id: 'c2', name: 'Em andamento', kind: 'doing' },
  { id: 'c3', name: 'Feito', kind: 'done' },
]
const t = (id: string, o: Partial<DbTask>): DbTask => ({
  id, producer_id: 'u1', event_id: null, assigned_to: null, title: `Tarefa ${id}`, description: null, due_date: null,
  status: 'todo', priority: 'medium', created_at: `2026-10-0${id}T00:00:00Z`, column_id: 'c1', position: 1000, ...o,
})
const tarefas = [t('1', { position: 2000 }), t('2', { position: 1000 }), t('3', { column_id: 'c2', position: 500 })]

describe('Quadro', () => {
  afterEach(cleanup)
  const montar = (onMover = vi.fn()) => {
    render(<Quadro tarefas={tarefas} colunas={colunas} colunaDe={x => x.column_id ?? ''} ordenavel onMover={onMover} />)
    return onMover
  }

  it('ordena pelo position dentro da coluna', () => {
    montar()
    const titulos = within(screen.getByRole('region', { name: 'A fazer' })).getAllByRole('heading', { level: 3 }).map(h => h.textContent)
    expect(titulos).toEqual(['Tarefa 2', 'Tarefa 1'])
  })

  it('soltar em outra coluna grava o fim dela', () => {
    const onMover = montar()
    fireEvent.dragStart(screen.getByRole('listitem', { name: /Tarefa 1/ }))
    fireEvent.drop(screen.getByRole('region', { name: 'Em andamento' }))
    expect(onMover).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }), 'c2', 1500)
  })

  it('teclado: Espaço pega, seta escolhe a coluna, Espaço solta, com aviso', () => {
    const onMover = montar()
    const cartao = screen.getByRole('listitem', { name: /Tarefa 2/ })
    cartao.focus()
    fireEvent.keyDown(cartao, { key: ' ' })
    fireEvent.keyDown(cartao, { key: 'ArrowRight' })
    expect(screen.getByRole('status').textContent).toBe('Coluna Em andamento.')
    fireEvent.keyDown(cartao, { key: ' ' })
    expect(onMover).toHaveBeenCalledWith(expect.objectContaining({ id: '2' }), 'c2', 1500)
  })

  it('Esc cancela sem mover', () => {
    const onMover = montar()
    const cartao = screen.getByRole('listitem', { name: /Tarefa 2/ })
    fireEvent.keyDown(cartao, { key: ' ' })
    fireEvent.keyDown(cartao, { key: 'ArrowRight' })
    fireEvent.keyDown(cartao, { key: 'Escape' })
    fireEvent.keyDown(cartao, { key: ' ' })
    expect(onMover).not.toHaveBeenCalled()
  })
})
