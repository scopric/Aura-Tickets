import { describe, it, expect, vi, afterEach } from 'vitest'
import { toast } from 'sonner'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import BotaoInativo from '../components/producer/BotaoInativo'

vi.mock('sonner', () => ({ toast: { info: vi.fn() } }))
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })

describe('BotaoInativo', () => {
  afterEach(cleanup)
  it('com disabled e motivo: não faz a ação, continua focável e liga o motivo por aria-describedby', () => {
    const acao = vi.fn()
    render(<BotaoInativo disabled motivo="Este lead não tem e-mail." onClick={acao}>Copiar e-mail</BotaoInativo>)
    const b = screen.getByRole('button', { name: 'Copiar e-mail' })
    expect(b).toHaveAttribute('aria-disabled', 'true'); expect(b).not.toBeDisabled() // focável: o leitor de tela chega nele
    fireEvent.click(b); expect(acao).not.toHaveBeenCalled()
    expect(document.getElementById(b.getAttribute('aria-describedby')!)!.textContent).toBe('Este lead não tem e-mail.')
  })
  it('no toque o tooltip não abre: clicar mostra o motivo num aviso e não faz a ação', () => {
    const acao = vi.fn()
    render(<BotaoInativo disabled motivo="Nenhum certificado emitido ainda." onClick={acao}>Exportar</BotaoInativo>)
    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }))
    expect(toast.info).toHaveBeenCalledWith('Nenhum certificado emitido ainda.', expect.objectContaining({ duration: 4000 }))
    expect(acao).not.toHaveBeenCalled()
  })
  it('com loading e motivo ao mesmo tempo continua bloqueado', () => {
    const acao = vi.fn()
    render(<BotaoInativo disabled loading motivo="Aguarde." onClick={acao}>Enviar</BotaoInativo>)
    fireEvent.click(screen.getByRole('button', { name: 'Carregando' })); expect(acao).not.toHaveBeenCalled()
  })
  it('habilitado: é o botão de sempre e a ação roda', () => {
    const acao = vi.fn()
    render(<BotaoInativo motivo="Não aparece" onClick={acao}>Copiar e-mail</BotaoInativo>)
    const b = screen.getByRole('button', { name: 'Copiar e-mail' })
    expect(b).not.toHaveAttribute('aria-disabled'); fireEvent.click(b); expect(acao).toHaveBeenCalledTimes(1)
  })
  it('inativo sem motivo (ex.: carregando): disabled nativo, como antes', () => {
    render(<BotaoInativo disabled>Salvar</BotaoInativo>)
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
  })
})
