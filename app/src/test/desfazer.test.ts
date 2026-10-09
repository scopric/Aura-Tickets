import { describe, it, expect, vi, beforeEach } from 'vitest'
import { toast } from 'sonner'
import { avisarComDesfazer } from '../lib/desfazer'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const acao = () => (vi.mocked(toast.success).mock.calls[0][1] as { action: { label: string; onClick: () => void }; duration: number })

describe('avisarComDesfazer', () => {
  beforeEach(() => vi.clearAllMocks())
  it('mostra o aviso com a ação "Desfazer" por 8 s (ou o tempo pedido)', () => {
    avisarComDesfazer({ mensagem: 'Feito.', inverso: async () => {} })
    expect(toast.success).toHaveBeenCalledWith('Feito.', expect.objectContaining({ duration: 8000 }))
    expect(acao().action.label).toBe('Desfazer')
    vi.clearAllMocks(); avisarComDesfazer({ mensagem: 'Feito.', inverso: async () => {}, ms: 3000 })
    expect(acao().duration).toBe(3000)
  })
  it('o id do aviso (um por item) é repassado: ação nova no mesmo item substitui o aviso velho', () => {
    avisarComDesfazer({ mensagem: 'Feito.', inverso: async () => {}, id: 'desfazer-x' })
    expect(acao()).toMatchObject({ id: 'desfazer-x' })
  })
  it('clicar em Desfazer chama o inverso e confirma "Desfeito."', async () => {
    const inverso = vi.fn().mockResolvedValue(null)
    avisarComDesfazer({ mensagem: 'Feito.', inverso })
    acao().action.onClick()
    await vi.waitFor(() => expect(toast.success).toHaveBeenLastCalledWith('Desfeito.'))
    expect(inverso).toHaveBeenCalledTimes(1)
  })
  it('se o inverso falhar, diz que não deu (e não diz "Desfeito")', async () => {
    avisarComDesfazer({ mensagem: 'Feito.', inverso: () => Promise.reject(new Error('rede')) })
    acao().action.onClick()
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith('Não foi possível desfazer. Tente de novo.'))
    expect(toast.success).toHaveBeenCalledTimes(1)
  })
})
