import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '@/lib/supabase'

describe('authStore', () => {
  beforeEach(() => {
    // Reset do store antes de cada teste
    useAuthStore.setState({
      user: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,
    })
    vi.clearAllMocks()
  })

  it('deve ter estado inicial correto', () => {
    const state = useAuthStore.getState()

    expect(state.user).toBeNull()
    expect(state.session).toBeNull()
    expect(state.isAuthenticated).toBe(false)
    expect(state.isLoading).toBe(false)
  })

  it('deve definir usuário corretamente', () => {
    const user = {
      id: 'test-id',
      email: 'teste@aura.teste',
      full_name: 'Teste',
      avatar_url: null,
      role: 'producer' as const,
    }

    useAuthStore.getState().setUser(user)

    const state = useAuthStore.getState()
    expect(state.user).toEqual(user)
    expect(state.isAuthenticated).toBe(true)
  })

  it('deve limpar usuário ao fazer logout', () => {
    useAuthStore.getState().setUser({
      id: 'test-id',
      email: 'teste@aura.teste',
      full_name: 'Teste',
      avatar_url: null,
      role: 'user' as const,
    })

    useAuthStore.getState().setUser(null)

    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })

  it('deve definir sessão corretamente', () => {
    const session = { access_token: 'token123' }

    useAuthStore.getState().setSession(session)

    expect(useAuthStore.getState().session).toEqual(session)
  })

  it('deve carregar perfil demo de produtor', async () => {
    const mockSession = {
      access_token: 'mock-token-producer',
    }

    useAuthStore.getState().setSession(mockSession)
    await useAuthStore.getState().fetchProfile()

    const state = useAuthStore.getState()
    expect(state.user?.role).toBe('producer')
    expect(state.user?.full_name).toBe('Produtor Teste')
    expect(state.isAuthenticated).toBe(true)
    expect(state.isLoading).toBe(false)
  })

  it('deve carregar perfil demo de admin', async () => {
    const mockSession = {
      access_token: 'mock-token-admin',
    }

    useAuthStore.getState().setSession(mockSession)
    await useAuthStore.getState().fetchProfile()

    const state = useAuthStore.getState()
    expect(state.user?.role).toBe('admin')
    expect(state.user?.full_name).toBe('Admin Teste')
  })

  it('deve carregar perfil real do Supabase', async () => {
    const mockSession = {
      access_token: 'real-token',
    }
    const mockProfile = {
      full_name: 'Usuario Real',
      avatar_url: 'https://example.com/avatar.png',
      role: 'user',
      is_verified: true,
    }

    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
      data: {
        user: {
          id: 'real-id',
          email: 'real@usuario.com',
        } as any,
      },
      error: null,
    })

    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: mockProfile, error: null } as any) // meu_perfil()

    useAuthStore.getState().setSession(mockSession)
    await useAuthStore.getState().fetchProfile()

    const state = useAuthStore.getState()
    expect(state.user?.full_name).toBe('Usuario Real')
    expect(state.user?.role).toBe('user')
    expect(state.isAuthenticated).toBe(true)
    expect(state.isLoading).toBe(false)
  })

  it('mapeia telefone, cidade, bio e nascimento do perfil (Perfil do participante)', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
      data: { user: { id: 'real-id', email: 'real@usuario.com' } },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.getUser>>)
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: { full_name: 'Usuario Real', role: 'user', phone: '+5511999990000', city: 'Curitiba - PR', bio: 'Oi', birth_date: '1990-05-20' }, error: null } as never) // meu_perfil()
    useAuthStore.getState().setSession({ access_token: 'real-token' })
    await useAuthStore.getState().fetchProfile()
    const u = useAuthStore.getState().user
    expect(u).toMatchObject({ phone: '+5511999990000', city: 'Curitiba - PR', bio: 'Oi', birth_date: '1990-05-20' })
  })

  it('deve limpar estado quando não houver usuário autenticado', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
      data: { user: null },
      error: null,
    })

    useAuthStore.getState().setSession({ access_token: 'expired' })
    await useAuthStore.getState().fetchProfile()

    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.session).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })

  it('fora de desenvolvimento, sessão "mock-token-admin" gravada no navegador não vira admin (PR 3D)', async () => {
    vi.stubEnv('DEV', false)
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
      data: { user: null },
      error: null,
    })

    useAuthStore.getState().setSession({ access_token: 'mock-token-admin' })
    await useAuthStore.getState().fetchProfile()

    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })

  afterEach(() => vi.unstubAllEnvs()) // o stub de DEV não vaza se uma asserção falhar
})
