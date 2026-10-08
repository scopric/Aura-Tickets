import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import TeamManager from '../pages/producer/TeamManager'

const rpc = vi.fn()
const from = vi.fn()
const invoke = vi.fn()
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'p1' } }) }))
vi.mock('../lib/supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a), from: (...a: unknown[]) => from(...a), functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}))

const membro = { id: 'm1', user_id: 'u2', role: 'editor', invited_at: '2026-10-01T12:00:00Z', accepted_at: null, blocked_at: null, full_name: 'Ana Teste', email: 'ana@exemplo.com' }
// team_lista devolve a equipe; team_convidar devolve { ok, motivo }
const responder = (convite: unknown) => rpc.mockImplementation(async (nome: string) =>
  nome === 'team_lista' ? { data: [membro], error: null } : convite)

const convidar = async () => {
  render(<MemoryRouter><TeamManager /></MemoryRouter>)
  await userEvent.click(await screen.findByRole('button', { name: /Convidar/ }))
  await userEvent.type(screen.getByLabelText('E-mail'), 'bia@exemplo.com')
  await userEvent.click(screen.getByRole('button', { name: /Adicionar membro/ }))
}

describe('Equipe do produtor (TeamManager)', () => {
  beforeEach(() => { rpc.mockReset(); from.mockReset(); toast.success.mockReset(); toast.error.mockReset(); toast.warning.mockReset(); invoke.mockReset(); invoke.mockResolvedValue({ data: { ok: true, enviados: 1 }, error: null }) })

  it('lista vem de team_lista com nome e e-mail', async () => {
    responder({ data: { ok: true }, error: null })
    render(<MemoryRouter><TeamManager /></MemoryRouter>)
    expect(await screen.findByText('Ana Teste')).toBeTruthy()
    expect(screen.getByText(/ana@exemplo\.com/)).toBeTruthy()
    expect(from).not.toHaveBeenCalled()
  })

  it('convite ok: mensagem e recarrega a lista', async () => {
    responder({ data: { ok: true }, error: null })
    await convidar()
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Convite registrado'))
    expect(rpc).toHaveBeenCalledWith('team_convidar', { p_email: 'bia@exemplo.com', p_role: 'editor' })
    expect(rpc.mock.calls.filter(c => c[0] === 'team_lista').length).toBe(2)
    expect(from).not.toHaveBeenCalled()
  })

  it.each([
    ['generico', 'Não foi possível convidar este e-mail. Confira se a pessoa já tem conta na Evokaa com ele.'],
    ['duplicado', 'Esta pessoa já está na sua equipe.'],
    ['bloqueado', 'Esta pessoa está bloqueada na sua equipe. Use Ativar na lista.'],
    ['limite', 'Muitas tentativas. Tente de novo em uma hora.'],
  ])('ok:false %s', async (motivo, texto) => {
    responder({ data: { ok: false, motivo }, error: null })
    await convidar()
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(texto))
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('erro inesperado não vaza a mensagem técnica', async () => {
    responder({ data: null, error: { code: '500', message: 'relation x does not exist' } })
    await convidar()
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Erro ao registrar convite no banco'))
  })

  it('convite ok: chama send-email team_invite sem destinatário e não avisa de falha', async () => {
    responder({ data: { ok: true }, error: null })
    await convidar()
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('send-email', { body: { emailType: 'team_invite' } }))
    expect(toast.warning).not.toHaveBeenCalled()
  })

  it.each([
    ['ok:false (não convidou)', { data: { ok: false, motivo: 'generico' }, error: null }],
    ['erro do banco', { data: null, error: { code: '500', message: 'x' } }],
  ])('sem convite não dispara e-mail: %s', async (_n, convite) => {
    responder(convite)
    await convidar()
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(invoke).not.toHaveBeenCalled()
  })

  it('e-mail que não saiu vira aviso e o convite continua registrado', async () => {
    responder({ data: { ok: true }, error: null })
    invoke.mockResolvedValue({ data: null, error: { message: 'FunctionsHttpError' } })
    await convidar()
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(expect.stringMatching(/o e-mail não saiu/)))
    expect(toast.success).toHaveBeenCalledWith('Convite registrado')
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('sem 2FA (42501): mostra a mensagem do banco e o link para o perfil', async () => {
    const msg = 'Ative a verificação em duas etapas no seu perfil e entre com o código para convidar a equipe.'
    responder({ data: null, error: { code: '42501', message: msg } })
    await convidar()
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(msg))
    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toContain(msg)
    expect(screen.getByRole('link', { name: 'Abrir meu perfil' }).getAttribute('href')).toBe('/producer/settings')
    expect(invoke).not.toHaveBeenCalled()
  })

  it('resposta {ok:true, enviados:0} (e-mail já gasto) também avisa para a pessoa aceitar em /equipe', async () => {
    responder({ data: { ok: true }, error: null })
    invoke.mockResolvedValue({ data: { ok: true, enviados: 0 }, error: null })
    await convidar()
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(expect.stringMatching(/o e-mail não saiu.*\/equipe/)))
    expect(toast.success).toHaveBeenCalledWith('Convite registrado')
  })
})
