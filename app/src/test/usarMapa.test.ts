import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const lido = vi.hoisted(() => ({ data: { environments: [] as unknown[] }, error: null }))
vi.mock('../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => lido }) }) }) },
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

import { useMapa } from '../pages/producer/mapa/usarMapa'

describe('useMapa', () => {
  it('environments vazio abre os pavimentos novos, não um editor sem pavimento', async () => {
    const { result } = renderHook(() => useMapa('ev1'))
    await waitFor(() => expect(result.current.pronto).toBe(true))
    expect(result.current.envs.length).toBeGreaterThan(0)
  })
})
