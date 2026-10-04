import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AvisoPolitica from '../components/AvisoPolitica'
import { PRIVACY_VERSION } from '../lib/legal'

// no Node 26 o localStorage global vem vazio (mesmo padrão do evo.test.tsx)
let mem: Record<string, string> = {}
const armazenamento = () => ({ getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v } })
const montar = () => render(<MemoryRouter><AvisoPolitica /></MemoryRouter>)

describe('AvisoPolitica', () => {
  beforeEach(() => {
    // a Política só abre depois da decisão de cookies (lib/camadas.ts)
    mem = { 'aura-cookie-consent': JSON.stringify({ version: '1.0', consent: { necessary: true, analytics: false } }) }
    vi.stubGlobal('localStorage', armazenamento())
  })

  it('aparece com link para a política e some ao fechar, sem voltar depois', () => {
    const { unmount } = montar()
    expect(screen.getByRole('link', { name: 'Política de Privacidade' })).toHaveAttribute('href', '/privacidade')
    fireEvent.click(screen.getByRole('button', { name: 'Fechar aviso da Política de Privacidade' }))
    expect(screen.queryByRole('status')).toBeNull()
    expect(mem[`aviso-politica-${PRIVACY_VERSION}`]).toBe('1')
    unmount()
    montar()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('não quebra quando o navegador bloqueia o armazenamento', () => {
    const erro = () => { throw new Error('bloqueado') }
    vi.stubGlobal('localStorage', { getItem: erro, setItem: erro })
    montar()
    expect(screen.getByRole('status')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar aviso da Política de Privacidade' }))
    expect(screen.queryByRole('status')).toBeNull()
  })
})
