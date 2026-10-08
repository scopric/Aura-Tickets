import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SecaoIngressos from '../components/producer/painel/SecaoIngressos'
import { ingDoBanco, type Ing } from '../lib/painelEvento'
import type { DbTicketType } from '../hooks/useEvents'

const tipo = (type: string, permite_meia: boolean) => ingDoBanco({ id: type, name: type, price: 50, quantity_total: 10, type, is_active: true, permite_meia, sale_start: null, sale_end: null } as unknown as DbTicketType, 0)
const montar = (ings: Ing[], setIngs = vi.fn()) => {
  render(<SecaoIngressos ings={ings} setIngs={setIngs} sujo={false} salvando={false} tentou={false} onSalvar={vi.fn()} onRemover={vi.fn()} onAlternar={vi.fn()} alternando={null} classificacao="L" aDefinir={false} />)
  return setIngs
}

describe('Painel do produtor: aceita meia-entrada', () => {
  it('mostra o campo no ingresso individual, reflete o banco e grava a mudança', () => {
    const setIngs = montar([tipo('individual', true)])
    const cx = screen.getByLabelText('Aceita meia-entrada')
    expect(cx.getAttribute('data-state')).toBe('checked')
    fireEvent.click(cx)
    expect(setIngs).toHaveBeenCalledWith([expect.objectContaining({ meia: false })])
  })

  it('ingresso novo nasce desligado', () => {
    const setIngs = montar([])
    fireEvent.click(screen.getByRole('button', { name: /Adicionar ingresso/ }))
    expect(setIngs).toHaveBeenCalledWith([expect.objectContaining({ novo: true, meia: false })])
  })

  it.each(['coletiva', 'mesa'])('some em %s', (t) => {
    montar([tipo(t, false)])
    expect(screen.queryByLabelText('Aceita meia-entrada')).toBeNull()
  })
})
