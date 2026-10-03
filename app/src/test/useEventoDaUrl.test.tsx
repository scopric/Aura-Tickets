import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useEventoDaUrl } from '../hooks/useEventoDaUrl'

const montar = (url: string, ids: string[]) =>
  renderHook(() => ({ ev: useEventoDaUrl(ids), loc: useLocation() }), {
    wrapper: ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>,
  })

describe('useEventoDaUrl', () => {
  beforeEach(() => localStorage.clear())

  it('vale o ?eventId= da URL', () => {
    expect(montar('/producer/checkin?eventId=e2', ['e1', 'e2']).result.current.ev[0]).toBe('e2')
  })

  it('sem URL, cai no último evento usado; id que não existe mais é ignorado', () => {
    localStorage.setItem('evk.nav.ultimoEvento', 'e1')
    expect(montar('/producer/checkin', ['e1', 'e2']).result.current.ev[0]).toBe('e1')
    expect(montar('/producer/checkin?eventId=apagado', ['e1', 'e2']).result.current.ev[0]).toBe('e1')
    expect(montar('/producer/checkin', ['e2']).result.current.ev[0]).toBeNull()
  })

  it('lista ainda carregando (vazia) dá null', () => {
    expect(montar('/producer/checkin?eventId=e1', []).result.current.ev[0]).toBeNull()
  })

  it('trocar grava na URL (mantendo os outros parâmetros) e lembra o evento', () => {
    const { result } = montar('/producer/checkin?tour=checkin', ['e1', 'e2'])
    act(() => result.current.ev[1]('e2'))
    expect(result.current.loc.search).toBe('?tour=checkin&eventId=e2')
    expect(result.current.ev[0]).toBe('e2')
    expect(localStorage.getItem('evk.nav.ultimoEvento')).toBe('e2')
  })
})
