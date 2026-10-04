import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { toast } from 'sonner'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '../contexts/ThemeContext'
import AppDownload from '../pages/app/Download'
import { detectarSistema, esquecerEvento, ouvirInstalacao } from '../lib/instalar'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36'
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15'

// matchMedia falso (o jsdom não tem): `standalone` liga só a consulta de app instalado
function aparelho(standalone: boolean) {
  window.matchMedia = vi.fn((q: string) => ({
    matches: standalone && q.includes('display-mode: standalone'),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

const montar = () => render(<MemoryRouter initialEntries={['/app/download']}><ThemeProvider><AppDownload /></ThemeProvider></MemoryRouter>)

function chegaOAviso(prompt = vi.fn(() => Promise.resolve())) {
  const e = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome: 'accepted' as const }) })
  act(() => { window.dispatchEvent(e) })
  return { e, prompt }
}

describe('detectarSistema', () => {
  it('reconhece iPhone, Android e o resto', () => {
    expect(detectarSistema(IPHONE)).toBe('ios')
    expect(detectarSistema(ANDROID)).toBe('android')
    expect(detectarSistema(MAC)).toBe('outro')
  })
  it('iPad com iPadOS se diz Mac: só o toque o distingue', () => {
    expect(detectarSistema(MAC, 5)).toBe('ios')
  })
})

describe('Instale o app', () => {
  beforeAll(() => ouvirInstalacao())
  beforeEach(() => { esquecerEvento(); aparelho(false); window.history.pushState({}, '', '/app/download') })
  afterEach(() => vi.restoreAllMocks())

  it('sem o aviso do Chrome não há botão Instalar: só o passo a passo', () => {
    montar()
    expect(screen.queryByRole('button', { name: /Instalar na tela inicial/ })).toBeNull()
    expect(screen.getByRole('tab', { name: 'Android' })).toHaveAttribute('data-state', 'active') // computador cai em Android
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('A Evokaa na sua tela inicial')
  })

  it('com o aviso guardado, o botão aparece, o aviso é adiado (preventDefault) e o clique chama prompt()', async () => {
    montar()
    const { e, prompt } = chegaOAviso()
    expect(e.defaultPrevented).toBe(true)
    const botao = screen.getByRole('button', { name: 'Instalar na tela inicial' })
    await act(async () => { fireEvent.click(botao) })
    expect(prompt).toHaveBeenCalledOnce()
    expect(await screen.findByText(/Pronto: o ícone da Evokaa/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Instalar na tela inicial' })).toBeNull() // o aviso só vale uma vez
    expect(screen.queryByRole('tab')).toBeNull() // instalado: some o passo a passo
  })

  it('em outra rota o aviso é guardado, mas sem preventDefault (o mini-aviso do Chrome segue valendo)', () => {
    window.history.pushState({}, '', '/events')
    const { e } = chegaOAviso()
    expect(e.defaultPrevented).toBe(false)
    montar()
    expect(screen.getByRole('button', { name: 'Instalar na tela inicial' })).toBeInTheDocument()
  })

  it('prompt() rejeitado: avisa com mensagem amigável e não quebra a página', async () => {
    const erro = vi.spyOn(toast, 'error').mockImplementation(() => 1)
    montar()
    chegaOAviso(vi.fn(() => Promise.reject(new Error('já usado'))))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Instalar na tela inicial' })) })
    expect(erro).toHaveBeenCalledOnce()
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('no computador há um QR Code para abrir a página no celular, com ou sem botão Instalar', () => {
    montar()
    expect(screen.getByText(/Está no computador\?/)).toBeInTheDocument()
    expect(screen.getByTitle('QR Code para abrir esta página no celular')).toBeInTheDocument()
    chegaOAviso()
    expect(screen.getByTitle('QR Code para abrir esta página no celular')).toBeInTheDocument()
  })

  it('aba Android desenha o furo da câmera; aba iPhone, a ilha', () => {
    const { container } = montar()
    expect(container.querySelector('.cel-ilha')).toHaveClass('furo')
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'iPhone' }), { button: 0 })
    expect(container.querySelector('.cel-ilha')).not.toHaveClass('furo')
  })

  it('no iPhone abre na aba iPhone, com Compartilhar e Adicionar à Tela de Início', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE)
    montar()
    expect(screen.getByRole('tab', { name: 'iPhone' })).toHaveAttribute('data-state', 'active')
    expect(screen.getByText('Compartilhar')).toBeInTheDocument()
    expect(screen.getByText('Adicionar à Tela de Início')).toBeInTheDocument()
  })

  it('já instalado (display-mode: standalone) mostra "já instalado" e esconde os passos', () => {
    aparelho(true)
    montar()
    expect(screen.getByText('O app já está instalado neste aparelho.')).toBeInTheDocument()
    expect(screen.queryByRole('tab')).toBeNull()
    expect(screen.getByRole('link', { name: 'Abrir meus ingressos' })).toHaveAttribute('href', '/app/tickets')
  })

  it('o celular é decorativo (aria-hidden) e a troca de tema fica no rodapé', () => {
    const { container } = montar()
    expect(container.querySelector('.cel-cena')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByRole('radiogroup', { name: 'Tema' })).toBeInTheDocument()
  })
})
