import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const linhas = [
  { id: 'a', email: 'a@x.com', full_name: 'Ana', avatar_url: null, created_at: '2026-01-01', producer_profiles: null, events: [{ count: 0 }] },
  { id: 'b', email: 'b@x.com', full_name: 'Bia', avatar_url: null, created_at: '2026-01-02', producer_profiles: { company_name: 'Bia Eventos', cnpj: null, is_verified: false, commission_rate: null }, events: [{ count: 1 }] },
]
// profiles devolve 0 linhas no update (regra de acesso barrou): a tela não pode dar sucesso
const { toast } = vi.hoisted(() => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('sonner', () => ({ toast }))
vi.mock('../lib/supabase', () => {
  const q: any = { select: () => q, eq: () => q, order: () => Promise.resolve({ data: linhas, error: null }) }
  const upd = (rows: unknown[]) => ({ update: () => ({ eq: () => ({ select: () => Promise.resolve({ data: rows, error: null }) }) }) })
  return { supabase: { from: (t: string) => (t === 'producer_profiles' ? upd([{ id: 'b' }]) : t === 'profiles' ? { ...q, ...upd([]) } : q) } }
})

import AdminProducers from '../pages/admin/Producers'

describe('Admin: produtores', () => {
  it('CNPJ nulo não quebra e não há botão "Completar cadastro"', async () => {
    render(<AdminProducers />)
    expect(await screen.findByText('Bia Eventos')).toBeInTheDocument()
    // a lista não seleciona mais o CNPJ (só company_name): nada de "CNPJ a preencher"; o texto de cadastro incompleto é outro
    expect(screen.queryByText('CNPJ a preencher')).toBeNull()
    expect(screen.getByText('cadastro incompleto')).toBeInTheDocument() // Ana, sem producer_profiles
    expect(screen.getByText('aguardando cadastro do produtor')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Completar cadastro' })).toBeNull()
  })

  it('verificar: perfil não alterado mostra erro, não sucesso', async () => {
    render(<AdminProducers />)
    await screen.findByText('Bia Eventos')
    const botoes = screen.getAllByRole('button', { name: 'Verificar' }).filter(b => !(b as HTMLButtonElement).disabled)
    expect(botoes).toHaveLength(1) // só a Bia tem cadastro de empresa
    await userEvent.click(botoes[0])
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('o perfil não foi alterado')))
    expect(toast.success).not.toHaveBeenCalled()
  })
})
