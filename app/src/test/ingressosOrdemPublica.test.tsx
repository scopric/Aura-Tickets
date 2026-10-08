import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { usePublicEvent } from '../hooks/useEvents'

const t = (id: string, sort_order: number | null, created_at: string) => ({ id, name: id, price: 10, sort_order, created_at, perks: [] })
vi.mock('../lib/supabase', () => ({
  supabase: { rpc: async () => ({ error: null, data: { evento: { id: 'e1', title: 'X' }, ingressos: [t('d', null, '2026-03-01'), t('c', 3, '2026-01-01'), t('a', 1, '2026-02-01'), t('b', 2, '2026-02-02')] } }) },
}))

describe('ordem escolhida chega ao comprador', () => {
  it('a página pública e o checkout (usePublicEvent) recebem os ingressos por sort_order, sem ordem por último', async () => {
    const w = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
    const { result } = renderHook(() => usePublicEvent('e1'), { wrapper: w })
    await waitFor(() => expect(result.current.data).toBeTruthy())
    expect(result.current.data!.ticket_types!.map(x => x.id)).toEqual(['a', 'b', 'c', 'd'])
  })
})
