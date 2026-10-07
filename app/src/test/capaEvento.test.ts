import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../lib/queryClient', () => ({ queryClient: {} }))
vi.mock('../lib/corEvento', () => ({ corViva: () => '#123456' }))
import { prepararCapa } from '../lib/capaEvento'

// Decisão 173: a arte vai inteira, na proporção dela; só reduz acima de 2000 px no lado maior; nunca amplia
async function preparar(largura: number, altura: number) {
  vi.stubGlobal('createImageBitmap', async () => ({ width: largura, height: altura, close: () => {} }))
  const desenho = vi.fn()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: desenho } as never)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (ok: BlobCallback) { ok(new Blob(['x'], { type: 'image/webp' })) })
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:previa' }))
  let canvas!: HTMLCanvasElement
  const criar = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((t: string) => { const el = criar(t); if (t === 'canvas') canvas = el as HTMLCanvasElement; return el })
  const capa = await prepararCapa(new File(['x'], 'arte.jpg', { type: 'image/jpeg' }), 'e1')
  return { capa, canvas, desenho }
}

describe('prepararCapa', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('flyer em pé (1080 × 1350) vai inteiro, sem corte e sem ampliar', async () => {
    const { capa, canvas, desenho } = await preparar(1080, 1350)
    expect([canvas.width, canvas.height]).toEqual([1080, 1350])
    expect(desenho).toHaveBeenCalledWith(expect.anything(), 0, 0, 1080, 1350)
    expect([capa.largura, capa.altura]).toEqual([1080, 1350])
  })

  it('arte grande é reduzida a 2000 px no lado maior, mantendo a proporção', async () => {
    const { capa, canvas } = await preparar(4000, 5000)
    expect([canvas.width, canvas.height]).toEqual([1600, 2000])
    expect([capa.largura, capa.altura]).toEqual([4000, 5000]) // o campo avisa pelo tamanho original
  })

  it('foto pequena (800 × 450) não é ampliada', async () => {
    const { canvas } = await preparar(800, 450)
    expect([canvas.width, canvas.height]).toEqual([800, 450])
  })
})
