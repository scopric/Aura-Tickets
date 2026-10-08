import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import LeitorCamera from '../components/producer/LeitorCamera'

const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const jsqr = vi.hoisted(() => vi.fn())
vi.mock('jsqr', () => ({ default: jsqr }))

const track = { stop: vi.fn(), getCapabilities: vi.fn(() => ({})), applyConstraints: vi.fn().mockResolvedValue(undefined) }
const stream = { getTracks: () => [track], getVideoTracks: () => [track] }
const getUserMedia = vi.fn()
const detect = vi.fn()

// avança o relógio e deixa as promessas do laço terminarem
const passar = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
const abrir = async () => { fireEvent.click(screen.getByRole('button', { name: /Ler com a câmera/ })); await passar(0) }

beforeEach(() => {
  vi.useFakeTimers()
  track.stop.mockReset(); track.getCapabilities.mockReset().mockReturnValue({}); track.applyConstraints.mockClear()
  getUserMedia.mockReset().mockResolvedValue(stream)
  detect.mockReset().mockResolvedValue([])
  jsqr.mockReset().mockReturnValue(null)
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true })
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
  Object.defineProperty(HTMLMediaElement.prototype, 'readyState', { get: () => 4, configurable: true })
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { get: () => 640, configurable: true })
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { get: () => 480, configurable: true })
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  ;(window as any).BarcodeDetector = class { detect = detect }
  Object.defineProperty(navigator, 'vibrate', { value: vi.fn(), configurable: true })
})
afterEach(() => { vi.useRealTimers(); delete (window as any).BarcodeDetector })

describe('LeitorCamera', () => {
  it('não pede a câmera sem clique', async () => {
    render(<LeitorCamera onLeitura={vi.fn()} />)
    await passar(1000)
    expect(getUserMedia).not.toHaveBeenCalled()
  })

  it('pede a câmera traseira no clique e entrega o código normalizado uma vez só (debounce e repetição)', async () => {
    const onLeitura = vi.fn()
    detect.mockResolvedValue([{ rawValue: ` ${UUID.toUpperCase()} ` }])
    const { rerender } = render(<LeitorCamera onLeitura={onLeitura} />)
    await abrir()
    expect(getUserMedia).toHaveBeenCalledWith({ video: { facingMode: 'environment' }, audio: false })
    await passar(300)
    expect(onLeitura).toHaveBeenCalledTimes(1)
    expect(onLeitura).toHaveBeenCalledWith(UUID)
    await passar(1000) // dentro da pausa de 1,5 s: o mesmo QR no quadro não vira outra leitura
    expect(onLeitura).toHaveBeenCalledTimes(1)
    // cartão de resultado na tela com este código: a leitura repetida é ignorada mesmo depois da pausa
    rerender(<LeitorCamera onLeitura={onLeitura} codigoNaTela={UUID} />)
    await passar(3000)
    expect(onLeitura).toHaveBeenCalledTimes(1)
    // saiu o cartão: pode ler de novo
    rerender(<LeitorCamera onLeitura={onLeitura} codigoNaTela={undefined} />)
    await passar(300)
    expect(onLeitura).toHaveBeenCalledTimes(2)
  })

  it('QR de outra coisa: avisa sem mostrar o texto e não envia ao servidor; código curto do e-mail segue', async () => {
    const onLeitura = vi.fn()
    detect.mockResolvedValue([{ rawValue: 'https://exemplo.com/segredo' }])
    render(<LeitorCamera onLeitura={onLeitura} />)
    await abrir(); await passar(300)
    expect(onLeitura).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Este QR não é de um ingresso Evokaa.')
    expect(document.body.textContent).not.toContain('exemplo.com')
    detect.mockResolvedValue([{ rawValue: '3F2504E0-4' }])
    await passar(2000)
    expect(onLeitura).toHaveBeenCalledWith('3F2504E0-4')
  })

  it('fechou durante o play(): não deixa o laço nem a câmera para trás', async () => {
    let tocar!: () => void
    HTMLMediaElement.prototype.play = vi.fn(() => new Promise<void>(r => { tocar = r }))
    detect.mockResolvedValue([{ rawValue: UUID }])
    const onLeitura = vi.fn()
    const { unmount } = render(<LeitorCamera onLeitura={onLeitura} />)
    await abrir()
    unmount()
    await act(async () => { tocar() })
    await passar(1000)
    expect(onLeitura).not.toHaveBeenCalled()
    expect(track.stop).toHaveBeenCalled()
  })

  it('não lê enquanto a validação está em andamento', async () => {
    const onLeitura = vi.fn()
    detect.mockResolvedValue([{ rawValue: UUID }])
    const { rerender } = render(<LeitorCamera onLeitura={onLeitura} ocupado />)
    await abrir(); await passar(2000)
    expect(onLeitura).not.toHaveBeenCalled()
    rerender(<LeitorCamera onLeitura={onLeitura} ocupado={false} />)
    await passar(300)
    expect(onLeitura).toHaveBeenCalledWith(UUID)
  })

  it('sem BarcodeDetector usa o jsQR (carregado só então) sobre o quadro reduzido', async () => {
    delete (window as any).BarcodeDetector
    const desenhar = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: desenhar, getImageData: () => ({ data: new Uint8ClampedArray(4) }) } as any)
    jsqr.mockReturnValue({ data: UUID })
    const onLeitura = vi.fn()
    render(<LeitorCamera onLeitura={onLeitura} />)
    await abrir(); await passar(300)
    expect(jsqr).toHaveBeenCalled()
    expect(desenhar).toHaveBeenCalledWith(expect.anything(), 0, 0, 480, 360) // 640x480 reduzido a 480 de largura
    expect(onLeitura).toHaveBeenCalledWith(UUID)
  })

  it('permissão negada: mensagem em português, câmera não fica aberta e o botão volta', async () => {
    getUserMedia.mockRejectedValue(Object.assign(new Error('x'), { name: 'NotAllowedError' }))
    render(<LeitorCamera onLeitura={vi.fn()} />)
    await abrir()
    expect(screen.getByRole('alert')).toHaveTextContent(/câmera foi bloqueada/)
    expect(screen.getByRole('button', { name: /Ler com a câmera/ })).toBeVisible()
  })

  it('sem câmera no aparelho', async () => {
    getUserMedia.mockRejectedValue(Object.assign(new Error('x'), { name: 'NotFoundError' }))
    render(<LeitorCamera onLeitura={vi.fn()} />)
    await abrir()
    expect(screen.getByRole('alert')).toHaveTextContent(/Nenhuma câmera encontrada/)
  })

  it('contexto sem HTTPS: avisa e nem tenta abrir', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true })
    render(<LeitorCamera onLeitura={vi.fn()} />)
    await abrir()
    expect(screen.getByRole('alert')).toHaveTextContent(/HTTPS/)
    expect(getUserMedia).not.toHaveBeenCalled()
  })

  it('erro ao ler o quadro: avisa e desliga a câmera', async () => {
    delete (window as any).BarcodeDetector
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn(), getImageData: () => { throw new Error('x') } } as any)
    render(<LeitorCamera onLeitura={vi.fn()} />)
    await abrir(); await passar(300)
    expect(screen.getByRole('alert')).toHaveTextContent(/Não foi possível ler a imagem/)
    expect(track.stop).toHaveBeenCalled()
  })

  it('para todas as trilhas ao fechar, ao desmontar e ao esconder a página', async () => {
    const { unmount } = render(<LeitorCamera onLeitura={vi.fn()} />)
    await abrir()
    fireEvent.click(screen.getByRole('button', { name: /Fechar câmera/ }))
    expect(track.stop).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: /Ler com a câmera/ })).toBeVisible()

    await abrir()
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(track.stop).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('alert')).toHaveTextContent(/saiu da página/)
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })

    await abrir()
    unmount()
    expect(track.stop).toHaveBeenCalledTimes(3)
  })

  it('fechou enquanto o navegador pedia permissão: a câmera que chega depois é desligada', async () => {
    let liberar!: (s: unknown) => void
    getUserMedia.mockReturnValue(new Promise(r => { liberar = r }))
    const { unmount } = render(<LeitorCamera onLeitura={vi.fn()} />)
    await abrir()
    unmount()
    await act(async () => { liberar(stream) })
    expect(track.stop).toHaveBeenCalled()
  })

  it('lanterna só aparece se o aparelho tiver', async () => {
    const { unmount } = render(<LeitorCamera onLeitura={vi.fn()} />)
    await abrir()
    expect(screen.queryByRole('button', { name: /lanterna/i })).toBeNull()
    unmount()

    track.getCapabilities.mockReturnValue({ torch: true })
    render(<LeitorCamera onLeitura={vi.fn()} />)
    await abrir()
    fireEvent.click(screen.getByRole('button', { name: 'Acender lanterna' }))
    await passar(0)
    expect(track.applyConstraints).toHaveBeenCalledWith({ advanced: [{ torch: true }] })
    expect(screen.getByRole('button', { name: 'Apagar lanterna' })).toBeVisible()
  })
})
