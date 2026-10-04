import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AvisoPolitica from '../components/AvisoPolitica'
import CookieBanner from '../components/CookieBanner'
import { _resetCamadasParaTeste } from '../lib/camadas'
import { useAuthStore } from '../stores/authStore'
import { PRIVACY_VERSION } from '../lib/legal'

// no Node 26 o localStorage global vem vazio (mesmo padrão do evo.test.tsx)
let mem: Record<string, string> = {}
const armazenamento = () => ({ getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v } })
const montar = () => render(<MemoryRouter><CookieBanner /><AvisoPolitica /></MemoryRouter>)
const politica = () => screen.queryByRole('status')
const cookies = () => screen.queryByRole('button', { name: /Rejeitar opcionais/ })
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })

describe('AvisoPolitica', () => {
  beforeEach(() => {
    // a Política só abre depois da decisão de cookies (lib/camadas.ts)
    mem = { 'aura-cookie-consent': JSON.stringify({ version: '1.0', consent: { necessary: true, analytics: false } }) }
    vi.stubGlobal('localStorage', armazenamento())
    _resetCamadasParaTeste()
    useAuthStore.setState({ session: null, isLoading: false })
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

  it('não quebra quando o navegador bloqueia o armazenamento: uma camada por vez, cookies primeiro', () => {
    const erro = () => { throw new Error('bloqueado') }
    vi.stubGlobal('localStorage', { getItem: erro, setItem: erro })
    montar()
    expect(cookies()).toBeInTheDocument()
    expect(politica()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Rejeitar opcionais/ }))
    expect(cookies()).toBeNull()
    expect(politica()).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar aviso da Política de Privacidade' }))
    expect(politica()).toBeNull()
  })
})
