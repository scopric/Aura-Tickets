import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ProducerCheckIn from '../pages/producer/CheckIn'
import { codigoCompleto, codigoCurto, EXEMPLO_CODIGO, motivoLeitura, normalizarCodigo } from '../lib/checkin'

const invoke = vi.fn()
vi.mock('../hooks/useEvents', () => ({ useProducerEvents: () => ({ data: [{ id: 'e1', title: 'No ar', status: 'published' }], isLoading: false }) }))
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => { const q: any = { select: () => q, eq: () => q, in: () => q, order: () => q, range: () => q, then: (ok: any) => Promise.resolve({ data: [], count: 0, error: null }).then(ok) }; return q },
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
  },
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }))

const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'

describe('formato do código', () => {
  it('só o uuid de 36 caracteres é código completo; o exemplo da tela é um uuid', () => {
    expect(codigoCompleto(UUID)).toBe(true)
    expect(codigoCompleto(`  ${UUID}\n`)).toBe(true)
    expect(codigoCompleto(UUID.slice(0, 35))).toBe(false)
    expect(codigoCompleto('3f2504e0-4')).toBe(false)
    expect(codigoCompleto('AUR-XXXX-001')).toBe(false)
    expect(codigoCompleto(EXEMPLO_CODIGO)).toBe(true)
  })
  it('código curto do e-mail (8 hex, traço, 1 hex, maiúsculas) é reconhecido; uuid e texto livre não', () => {
    expect(codigoCurto(UUID.slice(0, 10).toUpperCase())).toBe(true)
    expect(codigoCurto('3F2504E0-4')).toBe(true)
    expect(codigoCurto(UUID)).toBe(false)
    expect(codigoCurto('ABC123')).toBe(false)
  })
  it('leitor com Caps Lock: uuid vira minúsculo; texto livre fica como veio', () => {
    expect(normalizarCodigo(` ${UUID.toUpperCase()} `)).toBe(UUID)
    expect(normalizarCodigo(' abc ')).toBe('abc')
  })
})

describe('motivo da leitura', () => {
  it('liberado', () => expect(motivoLeitura({ http: 200, valid: true, message: 'Check-in realizado com sucesso.' })).toMatchObject({ tom: 'ok', rotulo: 'Acesso Permitido' }))
  it('já usado traz o horário', () => {
    const l = motivoLeitura({ http: 200, valid: false, message: 'Ingresso já foi utilizado.', checkedInAt: '2026-10-04T22:30:00.000Z' })
    expect(l).toMatchObject({ tom: 'aviso', rotulo: 'Já usado' })
    expect(l.mensagem).toMatch(/^Já usado às \d{2}:\d{2}$/)
  })
  it('já usado sem horário (corrida entre dois aparelhos) continua aviso', () => {
    expect(motivoLeitura({ http: 200, valid: false, message: 'Ingresso já foi utilizado.' })).toMatchObject({ tom: 'aviso', rotulo: 'Já usado' })
  })
  it('cancelado, reembolsado e transferido', () => {
    expect(motivoLeitura({ http: 200, valid: false, message: 'Ingresso indisponível (Status: cancelled)' }).rotulo).toBe('Cancelado')
    expect(motivoLeitura({ http: 200, valid: false, message: 'Ingresso indisponível (Status: refunded)' }).rotulo).toBe('Cancelado')
    expect(motivoLeitura({ http: 200, valid: false, message: 'Ingresso indisponível (Status: transferred)' }).rotulo).toBe('Transferido')
  })
  it('inválido: 404 da função', () => expect(motivoLeitura({ http: 404, message: 'Ingresso não encontrado ou inválido para este evento' })).toEqual({ tom: 'erro', rotulo: 'Inválido', mensagem: 'Ingresso não encontrado ou inválido para este evento' }))
  it('sistema fora do ar: 500 e rede, marcado como falha (não é problema do ingresso)', () => {
    expect(motivoLeitura({ http: 500, message: 'Não foi possível conferir agora. Tente de novo.' })).toMatchObject({ rotulo: 'Sistema fora do ar', falha: true })
    expect(motivoLeitura({ message: 'Failed to send a request' })).toMatchObject({ rotulo: 'Sistema fora do ar', falha: true })
  })
  it('2FA pendente, sem permissão e sessão expirada', () => {
    expect(motivoLeitura({ http: 403, message: 'Confirme o código do 2FA (saia e entre de novo).' })).toMatchObject({ rotulo: '2FA pendente', falha: true })
    expect(motivoLeitura({ http: 403, message: 'Você não tem permissão para fazer check-in neste evento.' })).toMatchObject({ rotulo: 'Sem permissão', falha: true })
    expect(motivoLeitura({ http: 401 })).toMatchObject({ rotulo: 'Sessão expirada', falha: true })
  })
})

describe('campo do Scanner', () => {
  beforeEach(() => invoke.mockReset().mockResolvedValue({ data: { valid: true, message: 'Check-in realizado com sucesso.', buyerName: 'Ana Souza', ticketType: 'Pista' }, error: null }))

  it('código curto digitado não dispara; o uuid completo dispara uma vez só', async () => {
    const u = userEvent.setup()
    render(<MemoryRouter><ProducerCheckIn /></MemoryRouter>)
    const campo = screen.getByLabelText('Código do ingresso')
    expect(campo).toHaveAttribute('placeholder', expect.stringContaining(EXEMPLO_CODIGO))

    await u.type(campo, UUID.slice(0, 35))
    expect(invoke).not.toHaveBeenCalled()

    await u.type(campo, UUID.slice(35))
    await waitFor(() => expect(screen.getByText('Acesso Permitido')).toBeInTheDocument())
    expect(invoke).toHaveBeenCalledTimes(1)
    expect(invoke).toHaveBeenCalledWith('check-in-validate', { body: { qrCode: UUID, eventId: 'e1' } })
    expect(campo).toHaveValue('')

    // o Enter que o leitor manda no fim da leitura não dispara de novo
    await u.type(campo, '{Enter}')
    expect(invoke).toHaveBeenCalledTimes(1)
  })

  it('a trava: a mesma leitura com a 1ª ainda pendente chama o servidor uma vez só', async () => {
    let liberar!: (v: unknown) => void
    invoke.mockReturnValue(new Promise(r => { liberar = r }))
    const u = userEvent.setup()
    render(<MemoryRouter><ProducerCheckIn /></MemoryRouter>)
    const campo = screen.getByLabelText('Código do ingresso')
    await u.type(campo, UUID)
    await u.type(campo, UUID)
    const chamadas = invoke.mock.calls.length // conferida depois de liberar a pendente, para o teste não ficar preso se a trava faltar
    liberar({ data: { valid: true, message: 'Check-in realizado com sucesso.' }, error: null })
    await waitFor(() => expect(screen.getByText('Acesso Permitido')).toBeInTheDocument())
    expect(chamadas).toBe(1)
    // terminada a 1ª, o código volta a poder ser lido
    await u.type(campo, UUID)
    expect(invoke).toHaveBeenCalledTimes(2)
  })

  it('código curto do e-mail: avisa para usar o código completo, sem chamar o servidor', async () => {
    const u = userEvent.setup()
    render(<MemoryRouter><ProducerCheckIn /></MemoryRouter>)
    await u.type(screen.getByLabelText('Código do ingresso'), '3F2504E0-4{Enter}')
    expect(await screen.findByText('Código curto: use o código completo do e-mail ou o QR do app')).toBeInTheDocument()
    expect(screen.queryByText('Inválido')).toBeNull()
    expect(invoke).not.toHaveBeenCalled()
  })

  it('Enter valida o que foi digitado, e o servidor diz que é inválido', async () => {
    invoke.mockResolvedValue({ data: null, error: Object.assign(new Error('x'), { context: new Response(JSON.stringify({ valid: false, message: 'Ingresso não encontrado ou inválido para este evento' }), { status: 404 }) }) })
    const u = userEvent.setup()
    render(<MemoryRouter><ProducerCheckIn /></MemoryRouter>)
    await u.type(screen.getByLabelText('Código do ingresso'), 'ABC123{Enter}')
    await waitFor(() => expect(screen.getByText('Inválido')).toBeInTheDocument())
    expect(invoke).toHaveBeenCalledTimes(1)
  })
})
