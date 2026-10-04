import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { useReautenticar } from '../hooks/useReautenticar'

const mfa = vi.hoisted(() => ({ listFactors: vi.fn(), challengeAndVerify: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { auth: { mfa } } }))

const PEDE = { code: '42501', hint: 'reautenticar', message: 'Confirme o código da verificação em duas etapas para continuar.' }

// A tela de teste: um botão que roda a ação e mostra o que o hook devolveu
function Tela({ acao }: { acao: () => PromiseLike<{ error: unknown }> }) {
  const { reautenticar, modal } = useReautenticar()
  const [saida, setSaida] = useState('')
  return (
    <>
      <button type="button" onClick={async () => {
        try { const r = await reautenticar(acao); setSaida(JSON.stringify(r)) } catch (e) { setSaida('lancou ' + JSON.stringify(e)) }
      }}>salvar</button>
      <output>{saida}</output>
      {modal}
    </>
  )
}

const salvar = () => fireEvent.click(screen.getByRole('button', { name: 'salvar' }))
const digitar = (v: string) => fireEvent.change(screen.getByLabelText('Código de verificação'), { target: { value: v } })

describe('useReautenticar', () => {
  beforeEach(() => {
    mfa.listFactors.mockReset().mockResolvedValue({ data: { totp: [{ id: 'f1', status: 'verified' }] }, error: null })
    mfa.challengeAndVerify.mockReset().mockResolvedValue({ data: {}, error: null })
  })

  it('42501 com hint reautenticar: abre a janela, confirma o código e repete a ação uma vez', async () => {
    const acao = vi.fn().mockResolvedValueOnce({ error: PEDE }).mockResolvedValueOnce({ error: null, data: 'gravou' })
    render(<Tela acao={acao} />)
    salvar()
    const janela = await screen.findByRole('dialog')
    expect(janela).toHaveAccessibleName('Confirme com o código do aplicativo')
    expect(acao).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByLabelText('Código de verificação')).toHaveFocus())
    digitar('123456')
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('gravou'))
    expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'f1', code: '123456' })
    expect(acao).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('sem erro: roda a ação uma vez e não abre janela', async () => {
    const acao = vi.fn().mockResolvedValue({ error: null })
    render(<Tela acao={acao} />)
    salvar()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('{"error":null}'))
    expect(acao).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it.each([
    ['outro erro 42501 (sem o hint)', { code: '42501', message: 'Só o super_admin' }],
    ['outro código de erro', { code: '23514', hint: 'reautenticar' }],
  ])('%s: não abre janela nem repete', async (_nome, erro) => {
    const acao = vi.fn().mockResolvedValue({ error: erro })
    render(<Tela acao={acao} />)
    salvar()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(erro.code!))
    expect(acao).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(mfa.challengeAndVerify).not.toHaveBeenCalled()
  })

  it('código errado: mostra o erro, mantém a janela e não repete a ação', async () => {
    mfa.challengeAndVerify.mockResolvedValue({ data: null, error: { message: 'Invalid TOTP code entered' } })
    const acao = vi.fn().mockResolvedValue({ error: PEDE })
    render(<Tela acao={acao} />)
    salvar()
    await screen.findByRole('dialog')
    digitar('000000')
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Código inválido ou expirado')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(acao).toHaveBeenCalledTimes(1)
  })

  it('código incompleto não chama o Supabase', async () => {
    render(<Tela acao={vi.fn().mockResolvedValue({ error: PEDE })} />)
    salvar()
    await screen.findByRole('dialog')
    digitar('12')
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('6 dígitos')
    expect(mfa.listFactors).not.toHaveBeenCalled()
  })

  it('Esc cancela: a ação não repete e quem chamou recebe o erro original', async () => {
    const acao = vi.fn().mockResolvedValue({ error: PEDE })
    render(<Tela acao={acao} />)
    salvar()
    fireEvent.keyDown(await screen.findByRole('dialog'), { key: 'Escape' })
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('"hint":"reautenticar"'))
    expect(acao).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('repete só uma vez: se o banco pedir de novo, devolve o erro sem abrir outra janela', async () => {
    const acao = vi.fn().mockResolvedValue({ error: PEDE })
    render(<Tela acao={acao} />)
    salvar()
    await screen.findByRole('dialog')
    digitar('123456')
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('reautenticar'))
    expect(acao).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('conta sem fator TOTP confirmado: avisa e não repete', async () => {
    mfa.listFactors.mockResolvedValue({ data: { totp: [] }, error: null })
    const acao = vi.fn().mockResolvedValue({ error: PEDE })
    render(<Tela acao={acao} />)
    salvar()
    await screen.findByRole('dialog')
    digitar('123456')
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('não tem a verificação em duas etapas')
    expect(mfa.challengeAndVerify).not.toHaveBeenCalled()
    expect(acao).toHaveBeenCalledTimes(1)
  })

  it('ação que lança o erro (em vez de devolver): também abre a janela e repete', async () => {
    const acao = vi.fn().mockRejectedValueOnce(PEDE).mockResolvedValueOnce({ error: null, data: 'ok' })
    render(<Tela acao={acao} />)
    salvar()
    await screen.findByRole('dialog')
    digitar('123456')
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('"data":"ok"'))
    expect(acao).toHaveBeenCalledTimes(2)
  })

  it('ação que lança outro erro: o erro sobe sem janela', async () => {
    const acao = vi.fn().mockRejectedValue({ code: '500' })
    render(<Tela acao={acao} />)
    salvar()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('lancou {"code":"500"}'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('modal dentro de um <form> da tela: confirmar o código não dispara o submit da tela', async () => {
    const envio = vi.fn((e: React.FormEvent) => e.preventDefault())
    const acao = vi.fn().mockResolvedValueOnce({ error: PEDE }).mockResolvedValueOnce({ error: null })
    render(<form onSubmit={envio}><Tela acao={acao} /></form>)
    salvar()
    await screen.findByRole('dialog')
    digitar('123456')
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(acao).toHaveBeenCalledTimes(2))
    expect(envio).not.toHaveBeenCalled()
  })
})
