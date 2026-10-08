import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import LateralSecoes, { type ItemLateral } from '../components/producer/painel/LateralSecoes'

const nomes = ['O que é', 'Quando e onde', 'Imagem', 'Ingressos', 'Regras e idade', 'Publicar']
const itens: ItemLateral[] = nomes.map((nome, i) => ({ id: `s${i}`, nome, pronta: i < 2, faltam: i === 3 ? 2 : 0, atual: i === 3 }))

describe('LateralSecoes', () => {
  it('mostra os 6 itens, o progresso, o pronto, o contador e o item atual', () => {
    render(<LateralSecoes itens={itens} onIr={vi.fn()} prontos={5} total={8} />)
    expect(screen.getByRole('navigation', { name: 'Seções do evento' })).toBeTruthy()
    expect(screen.getAllByRole('button')).toHaveLength(6)
    expect(screen.getByText('5/8', { exact: false })).toBeTruthy()
    expect(screen.getAllByText(/, pronto/)).toHaveLength(2)
    expect(screen.getByText(', faltam 2 itens')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Ingressos/ }).getAttribute('aria-current')).toBe('true')
    expect(screen.getByRole('button', { name: /Imagem/ }).getAttribute('aria-current')).toBeNull()
  })

  it('clicar chama onIr com o id da seção', () => {
    const onIr = vi.fn()
    render(<LateralSecoes itens={itens} onIr={onIr} prontos={5} total={8} />)
    fireEvent.click(screen.getByRole('button', { name: /Regras e idade/ }))
    expect(onIr).toHaveBeenCalledWith('s4')
  })
})
