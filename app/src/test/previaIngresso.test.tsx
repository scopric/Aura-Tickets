import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PreviaCorpo, type DadosPrevia } from '../components/producer/PreviaIngresso'
import IngressoVisual from '../components/producer/IngressoVisual'
import { AZUL_EVOKAA, ESTILO_PADRAO, RODAPE_MAX, corDoTopo, erroDaLogo, estiloLimpo, ladoDaLogo, textoSobre } from '../lib/ingressoEstilo'

const { preparar } = vi.hoisted(() => ({ preparar: vi.fn() }))
vi.mock('../lib/ingressoEstilo', async orig => ({ ...(await orig<typeof import('../lib/ingressoEstilo')>()), prepararLogo: preparar }))

afterEach(() => { cleanup(); vi.restoreAllMocks(); preparar.mockReset() })

const dados: DadosPrevia = { eventoId: 'e1', corEvento: '#a55c65', titulo: 'Noite de Forró', data: '2026-12-12', hora: '22:00', local: 'Espaço Torres' }
const tela = (pro: boolean) => render(<MemoryRouter><PreviaCorpo dados={dados} tipo="Pista" pro={pro} /></MemoryRouter>)

describe('estilo do ingresso', () => {
  it('sem escolha, o topo é o azul da Evokaa', () => {
    expect(corDoTopo(ESTILO_PADRAO)).toBe(AZUL_EVOKAA)
    expect(corDoTopo({ ...ESTILO_PADRAO, cor: '#a55c65' })).toBe('#a55c65')
  })
  it('limpa o que o ingresso não sabe desenhar', () => {
    const e = estiloLimpo({ cor: 'vermelho', rodape: 'a\nb'.padEnd(300, 'x'), logo: 'direita' as never })
    expect(e.cor).toBeNull()
    expect(e.logo).toBe('esquerda')
    expect(e.rodape).not.toMatch(/[\r\n]/)
    expect(e.rodape.length).toBe(RODAPE_MAX)
  })
  it('texto claro sobre cor escura e escuro sobre cor clara', () => {
    expect(textoSobre('#0c2340')).toBe('#ffffff')
    expect(textoSobre('#f5e663')).toBe('#0c2340')
  })
  it('recusa SVG e arquivo grande; reduz o lado maior a 512 px sem ampliar', () => {
    expect(erroDaLogo({ type: 'image/svg+xml', size: 10 })).toMatch(/PNG, JPEG ou WebP/)
    expect(erroDaLogo({ type: 'image/png', size: 6 * 1024 * 1024 })).toMatch(/5 MB/)
    expect(erroDaLogo({ type: 'image/webp', size: 1000 })).toBeNull()
    expect(ladoDaLogo(2048, 1024)).toEqual({ w: 512, h: 256 })
    expect(ladoDaLogo(200, 100)).toEqual({ w: 200, h: 100 })
  })
})

describe('ingresso desenhado', () => {
  it('mostra o evento, o tipo e marca portador e QR como exemplo', () => {
    render(<IngressoVisual dados={dados} tipo="Pista" estilo={ESTILO_PADRAO} logoUrl={null} modo="pdf" />)
    expect(screen.getByText('Noite de Forró')).toBeTruthy()
    expect(screen.getByText('Pista')).toBeTruthy()
    expect(screen.getByText('Exemplo')).toBeTruthy()
    expect(screen.getByText('Sua logo aqui')).toBeTruthy()
    expect(screen.getByText('O QR abre a página do ingresso.')).toBeTruthy()
  })
  it('no celular o QR é descrito como dinâmico', () => {
    render(<IngressoVisual dados={dados} tipo="Pista" estilo={ESTILO_PADRAO} logoUrl="blob:x" modo="celular" />)
    expect(screen.getByText(/muda a cada cerca de 30 segundos/)).toBeTruthy()
    expect(screen.getByAltText('Logo da produtora')).toBeTruthy()
  })
})

describe('prévia no editor do tipo', () => {
  it('com PRO, "Meu estilo" deixa trocar o rodapé e o ingresso muda', () => {
    tela(true)
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Meu estilo/ }), { button: 0 })
    fireEvent.change(screen.getByLabelText(/Rodapé/), { target: { value: 'Entrada até 23h' } })
    expect(screen.getByText('Entrada até 23h')).toBeTruthy()
  })
  it('sem PRO, "Meu estilo" fica bloqueado e leva ao PRO', () => {
    tela(false)
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Meu estilo/ }), { button: 0 })
    expect(screen.queryByLabelText(/Rodapé/)).toBeNull()
    expect(screen.getByRole('link', { name: 'Conhecer o PRO' }).getAttribute('href')).toBe('/producer/assinatura')
  })
})

describe('logo escolhida na prévia', () => {
  const arquivo = () => new File([new Uint8Array(8)], 'logo.png', { type: 'image/png' })
  const escolhe = () => fireEvent.change(screen.getByLabelText('Arquivo da logo'), { target: { files: [arquivo()] } })

  it('libera a URL ao remover e ao fechar a folha', async () => {
    const revoga = vi.fn(); URL.revokeObjectURL = revoga // o jsdom não traz esta função
    preparar.mockResolvedValue('blob:a')
    const { unmount } = tela(true)
    escolhe()
    await waitFor(() => expect(screen.getByAltText('Logo da produtora')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }))
    expect(revoga).toHaveBeenCalledWith('blob:a')
    preparar.mockResolvedValue('blob:b')
    escolhe()
    await waitFor(() => expect(screen.getByAltText('Logo da produtora')).toBeTruthy())
    unmount()
    expect(revoga).toHaveBeenCalledWith('blob:b')
  })
  it('logo que fica pronta depois de fechar a folha é liberada na hora', async () => {
    const revoga = vi.fn(); URL.revokeObjectURL = revoga // o jsdom não traz esta função
    let pronta: (u: string) => void = () => {}
    preparar.mockReturnValue(new Promise<string>(ok => { pronta = ok }))
    const { unmount } = tela(true)
    escolhe()
    unmount()
    pronta('blob:tarde')
    await waitFor(() => expect(revoga).toHaveBeenCalledWith('blob:tarde'))
  })
})
