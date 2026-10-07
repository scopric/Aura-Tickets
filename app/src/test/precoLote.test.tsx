import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PrecoLote from '../pages/producer/mapa/PrecoLote'

const campo = () => screen.getByLabelText('Preço do lote em reais') as HTMLInputElement

describe('PrecoLote', () => {
  it('digitar "1.200" tecla a tecla nunca muda o lote; sair sem confirmar descarta', async () => {
    const onChange = vi.fn()
    const u = userEvent.setup()
    render(<><PrecoLote valor={80} onChange={onChange} /><button>fora</button></>)
    await u.clear(campo())
    for (const c of '1.200') { await u.type(campo(), c); expect(onChange).not.toHaveBeenCalled() }
    expect(screen.getByRole('button', { name: /Confirmar/ })).toBeTruthy()
    await u.click(screen.getByText('fora'))
    expect(onChange).not.toHaveBeenCalled()
    expect(campo().value).toBe('80')
  })
  it('"1.200" + Confirmar aplica 1200 (o clique no botão não descarta antes)', async () => {
    const onChange = vi.fn()
    const u = userEvent.setup()
    render(<PrecoLote valor={80} onChange={onChange} />)
    await u.clear(campo()); await u.type(campo(), '1.200')
    await u.click(screen.getByRole('button', { name: /Confirmar/ }))
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith(1200)
  })
  it('"1,05" + Enter aplica 1.05; sem Enter e sem sair não aplica', async () => {
    const onChange = vi.fn()
    const u = userEvent.setup()
    render(<PrecoLote valor={80} onChange={onChange} />)
    await u.clear(campo()); await u.type(campo(), '1,05')
    expect(onChange).not.toHaveBeenCalled()
    await u.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith(1.05)
  })
  it('sair do campo aplica valor claro; inválido volta ao preço do lote', async () => {
    const onChange = vi.fn()
    const u = userEvent.setup()
    function Pai() { const [v, setV] = useState(80); return <><PrecoLote valor={v} onChange={n => { onChange(n); setV(n) }} /><button>fora</button></> }
    render(<Pai />)
    await u.clear(campo()); await u.type(campo(), '12,5'); await u.click(screen.getByText('fora'))
    expect(onChange).toHaveBeenCalledWith(12.5)
    await u.clear(campo()); await u.type(campo(), '1e3')
    expect(screen.getByRole('alert')).toBeTruthy()
    await u.click(screen.getByText('fora'))
    expect(onChange).toHaveBeenCalledOnce()
    expect(campo().value).toBe('12,5')
  })
})
