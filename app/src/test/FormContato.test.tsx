import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import FormContato from '../components/home/FormContato'

// Formulário de contato da Home v3 (Decisão 253): o erro fica no campo (aria-invalid + mensagem ligada por
// aria-describedby) e nada é enviado até os obrigatórios estarem preenchidos; o envio vai pelo useContact.
const h = vi.hoisted(() => ({ enviar: vi.fn(async () => true), toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('sonner', () => ({ toast: h.toast }))
vi.mock('../hooks/useContact', () => ({ useContact: () => ({ mutateAsync: h.enviar, isPending: false }) }))

const campo = (nome: string) => screen.getByLabelText(nome)
const preencher = (nome: string, valor: string) => fireEvent.change(campo(nome), { target: { value: valor } })
const enviar = () => fireEvent.click(screen.getByRole('button', { name: 'Enviar mensagem' }))

describe('FormContato', () => {
  beforeEach(() => vi.clearAllMocks())

  it('vazio: marca os quatro obrigatórios no campo e não envia', () => {
    render(<FormContato />)
    enviar()
    for (const nome of ['Nome', 'E-mail', 'Celular', 'Mensagem']) {
      const el = campo(nome)
      expect(el).toHaveAttribute('aria-invalid', 'true')
      expect(document.getElementById(el.getAttribute('aria-describedby')!)).toHaveTextContent(/Informe|Escreva/)
    }
    expect(campo('Assunto (opcional)')).not.toHaveAttribute('aria-invalid')
    expect(h.enviar).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(campo('Nome')) // o foco vai ao primeiro campo com erro
  })

  it('e-mail inválido: só esse campo fica marcado e nada é enviado', () => {
    render(<FormContato />)
    preencher('Nome', 'Ana')
    preencher('E-mail', 'ana@')
    preencher('Celular', '41999999999')
    preencher('Mensagem', 'Olá')
    enviar()
    expect(campo('E-mail')).toHaveAttribute('aria-invalid', 'true')
    expect(campo('Nome')).not.toHaveAttribute('aria-invalid')
    expect(h.enviar).not.toHaveBeenCalled()
  })

  it('preenchido: envia com trim e assunto padrão, e mostra a confirmação', async () => {
    render(<FormContato />)
    preencher('Nome', '  Ana  ')
    preencher('E-mail', ' ana@exemplo.com ')
    preencher('Celular', '(41) 99999-9999')
    preencher('Mensagem', ' Quero criar um evento. ')
    enviar()
    await waitFor(() => expect(h.enviar).toHaveBeenCalledTimes(1))
    expect(h.enviar.mock.calls[0][0]).toEqual({
      name: 'Ana', email: 'ana@exemplo.com', phone: '(41) 99999-9999', subject: 'Contato Geral (Home)', message: 'Quero criar um evento.',
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Mensagem enviada')
    expect(h.toast.error).not.toHaveBeenCalled()
  })

  it('erro do servidor: toast com a mensagem da função e o formulário continua', async () => {
    h.enviar.mockRejectedValueOnce(Object.assign(new Error('x'), { mensagem: 'Muitas mensagens. Tente mais tarde.' }))
    render(<FormContato />)
    preencher('Nome', 'Ana')
    preencher('E-mail', 'ana@exemplo.com')
    preencher('Celular', '41999999999')
    preencher('Mensagem', 'Olá')
    enviar()
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith('Muitas mensagens. Tente mais tarde.'))
    expect(screen.getByRole('button', { name: 'Enviar mensagem' })).toBeInTheDocument()
  })
})
