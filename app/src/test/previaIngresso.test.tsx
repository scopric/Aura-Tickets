import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PreviaCorpo, type DadosPrevia } from '../components/producer/PreviaIngresso'
import IngressoVisual from '../components/producer/IngressoVisual'
import { AZUL_EVOKAA, ESTILO_PADRAO, corDoTopo, estiloDoBanco, estiloLimpo, estiloParaBanco, textoSobre } from '../lib/ingressoEstilo'

afterEach(cleanup)

const dados = (estilo = ESTILO_PADRAO): DadosPrevia => ({ eventoId: 'e1', corEvento: '#a55c65', estilo, titulo: 'Noite de Forró', data: '2026-12-12', hora: '22:00', local: 'Espaço Torres' })
const props = () => ({ onLogo: vi.fn(), onTirarLogo: vi.fn(), onSalvar: vi.fn() })
const tela = (o: { pro?: boolean; estilo?: typeof ESTILO_PADRAO; logoUrl?: string | null } = {}) => {
  const p = props()
  render(<MemoryRouter><PreviaCorpo dados={dados(o.estilo)} tipo="Pista" pro={o.pro ?? true} logoUrl={o.logoUrl ?? null} ocupadoLogo={false} salvando={false} {...p} /></MemoryRouter>)
  return p
}
const abaMeu = () => fireEvent.mouseDown(screen.getByRole('tab', { name: /Meu estilo/ }), { button: 0 })

describe('estilo do ingresso', () => {
  it('sem escolha, o topo é o azul da Evokaa', () => {
    expect(corDoTopo(ESTILO_PADRAO)).toBe(AZUL_EVOKAA)
    expect(corDoTopo({ ...ESTILO_PADRAO, cor: '#a55c65' })).toBe('#a55c65')
  })
  it('limpa o que o ingresso não sabe desenhar', () => {
    const e = estiloLimpo({ cor: 'vermelho', logo: 'direita' as never, rodape: 'texto livre' } as never)
    expect(e).toEqual(ESTILO_PADRAO)
    expect('rodape' in e).toBe(false)
  })
  it('texto claro sobre cor escura e escuro sobre cor clara', () => {
    expect(textoSobre('#0c2340')).toBe('#ffffff')
    expect(textoSobre('#f5e663')).toBe('#0c2340')
  })
  it('grava só o que foi escolhido (sem texto livre)', () => {
    expect(estiloParaBanco(ESTILO_PADRAO)).toEqual({})
    expect(estiloParaBanco({ cor: '#a55c65', logo: 'centro' })).toEqual({ cor: '#a55c65', logo: 'centro' })
    expect(estiloParaBanco({ cor: null, logo: 'esquerda', rodape: 'www.golpe.com' } as never)).toEqual({})
  })
  it('lê o que veio do banco; lixo vira o padrão', () => {
    expect(estiloDoBanco({ cor: '#a55c65', logo: 'centro' })).toEqual({ cor: '#a55c65', logo: 'centro' })
    expect(estiloDoBanco(null)).toEqual(ESTILO_PADRAO)
    expect(estiloDoBanco('texto')).toEqual(ESTILO_PADRAO)
  })
})

describe('ingresso desenhado', () => {
  it('mostra o evento, o tipo e marca portador e QR como exemplo', () => {
    render(<IngressoVisual dados={dados()} tipo="Pista" estilo={ESTILO_PADRAO} logoUrl={null} modo="pdf" />)
    expect(screen.getByText('Noite de Forró')).toBeTruthy()
    expect(screen.getByText('Pista')).toBeTruthy()
    expect(screen.getByText('Exemplo')).toBeTruthy()
    expect(screen.getByText('Sua logo aqui')).toBeTruthy()
    expect(screen.getByText('O QR abre a página do ingresso.')).toBeTruthy()
  })
  it('no celular o QR é descrito como dinâmico', () => {
    render(<IngressoVisual dados={dados()} tipo="Pista" estilo={ESTILO_PADRAO} logoUrl="https://x/logo.png" modo="celular" />)
    expect(screen.getByText(/muda a cada cerca de 30 segundos/)).toBeTruthy()
    expect(screen.getByAltText('Logo da produtora')).toBeTruthy()
  })
})

describe('prévia no editor do tipo', () => {
  it('com PRO, "Meu estilo" troca a cor e a logo, o ingresso muda e salvar leva o estilo', () => {
    const p = tela()
    abaMeu()
    fireEvent.click(screen.getByRole('button', { name: 'Cor do evento' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Centro' }))
    expect(getComputedStyle(document.querySelector('figure > div') as HTMLElement).backgroundColor).toBe('rgb(165, 92, 101)')
    fireEvent.click(screen.getByRole('button', { name: 'Salvar estilo' }))
    expect(p.onSalvar).toHaveBeenCalledWith({ cor: '#a55c65', logo: 'centro' })
  })
  it('não oferece campo de texto livre no ingresso', () => {
    tela()
    abaMeu()
    expect(screen.queryByLabelText(/Rodapé/)).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
  })
  it('sem PRO, "Meu estilo" fica bloqueado e leva ao PRO', () => {
    tela({ pro: false })
    abaMeu()
    expect(screen.queryByRole('radio', { name: 'Centro' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Conhecer o PRO' }).getAttribute('href')).toBe('/producer/assinatura')
  })
  it('estilo salvo abre em "Meu estilo" e "Usar o modelo padrão" volta ao padrão', () => {
    const p = tela({ estilo: { cor: '#a55c65', logo: 'centro' } })
    expect((screen.getByRole('tab', { name: /Meu estilo/ }) as HTMLElement).getAttribute('aria-selected')).toBe('true')
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Modelo Evokaa' }), { button: 0 })
    fireEvent.click(screen.getByRole('button', { name: 'Usar o modelo padrão' }))
    expect(p.onSalvar).toHaveBeenCalledWith(ESTILO_PADRAO)
  })
  it('nada a salvar enquanto igual ao que está salvo', () => {
    tela()
    expect((screen.getByRole('button', { name: 'Usar o modelo padrão' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('logo na prévia', () => {
  it('mostra a logo salva, troca e remove pelos botões', () => {
    const p = tela({ logoUrl: 'https://x/logo.png' })
    expect(screen.getByAltText('Logo da produtora')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }))
    expect(p.onTirarLogo).toHaveBeenCalled()
    const arquivo = new File([new Uint8Array(8)], 'logo.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('Arquivo da logo'), { target: { files: [arquivo] } })
    expect(p.onLogo).toHaveBeenCalledWith(arquivo)
  })
  it('sem logo, oferece escolher', () => {
    tela()
    expect(screen.getByRole('button', { name: /Escolher logo/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Remover' })).toBeNull()
  })
})
