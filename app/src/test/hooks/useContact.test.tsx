import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useContact } from '../../hooks/useContact'
import { supabase } from '../../lib/supabase'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
)
const msg = { name: ' Ana ', email: 'ana@exemplo.com', message: ' Oi ', page: '/contato' }

describe('useContact', () => {
  beforeEach(() => vi.clearAllMocks())

  it('manda tudo pela send-email e não grava direto no banco', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { success: true }, error: null } as never)
    const { result } = renderHook(() => useContact(), { wrapper })
    await result.current.mutateAsync(msg)
    expect(supabase.from).not.toHaveBeenCalled()
    expect(supabase.functions.invoke).toHaveBeenCalledWith('send-email', {
      body: { emailType: 'contact', name: 'Ana', email: 'ana@exemplo.com', phone: '', subject: 'Contato via site', message: 'Oi', page: '/contato' },
    })
  })

  it('erro da função sobe para a tela', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: null, error: new Error('429') } as never)
    const { result } = renderHook(() => useContact(), { wrapper })
    await expect(result.current.mutateAsync(msg)).rejects.toThrow('429')
  })
})
