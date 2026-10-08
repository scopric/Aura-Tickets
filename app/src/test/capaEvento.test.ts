import { describe, it, expect, vi, afterEach } from 'vitest'

const upload = vi.fn()
vi.mock('../lib/supabase', () => ({
  supabase: { storage: { from: (b: string) => ({ upload: (...a: unknown[]) => upload(b, ...a), getPublicUrl: (c: string) => ({ data: { publicUrl: `https://x/${b}/${c}` } }) }) } },
}))
vi.mock('../lib/queryClient', () => ({ queryClient: {} }))
vi.mock('../lib/corEvento', () => ({ corViva: () => '#123456' }))
import { prepararCapa, enviarFotoItem } from '../lib/capaEvento'

// Decisão 173: a arte vai inteira, na proporção dela; só reduz acima de 2000 px no lado maior; nunca amplia.
// Image simulada entrega as medidas; createImageBitmap simulado devolve o tamanho pedido; toBlob devolve o tamanho de cada tentativa.
async function preparar(largura: number, altura: number, tamanhoBlob: (tentativa: number) => number = () => 1) {
  vi.stubGlobal('Image', class { naturalWidth = largura; naturalHeight = altura; onload?: () => void; set src(_: string) { queueMicrotask(() => this.onload?.()) } })
  const pedidos: unknown[] = []
  vi.stubGlobal('createImageBitmap', async (_f: unknown, o: { resizeWidth: number; resizeHeight: number }) => { pedidos.push(o); return { width: o.resizeWidth, height: o.resizeHeight, close: () => {} } })
  const desenho = vi.fn()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: desenho } as never)
  let n = 0
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (ok: BlobCallback, tipo?: string) {
    ok(new Blob([new Uint8Array(tamanhoBlob(n++))], { type: tipo }))
  })
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:previa', revokeObjectURL: () => {} }))
  let canvas!: HTMLCanvasElement
  const criar = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((t: string) => { const el = criar(t); if (t === 'canvas') canvas = el as HTMLCanvasElement; return el })
  const capa = await prepararCapa(new File(['x'], 'arte.jpg', { type: 'image/jpeg' }), 'e1')
  return { capa, canvas, desenho, pedidos }
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

  it('lê as medidas antes e pede ao navegador já reduzida (foto de 48 MP não vai inteira para a memória)', async () => {
    const { pedidos } = await preparar(8000, 6000)
    expect(pedidos).toEqual([{ imageOrientation: 'from-image', resizeWidth: 2000, resizeHeight: 1500, resizeQuality: 'high' }])
  })

  it('arte que não cabe em 2 MB nas 4 tentativas do lado 2000 cai para 1600', async () => {
    const { canvas, capa } = await preparar(2000, 2000, t => (t < 4 ? 3 * 1024 * 1024 : 1000))
    expect([canvas.width, canvas.height]).toEqual([1600, 1600])
    expect([capa.largura, capa.altura]).toEqual([2000, 2000])
  })

  it('ruído que só cabe no último lado acaba em 1200; se nem assim cabe, dá erro', async () => {
    const { canvas } = await preparar(2000, 2000, t => (t < 8 ? 3 * 1024 * 1024 : 1000))
    expect(canvas.width).toBe(1200)
    vi.restoreAllMocks()
    await expect(preparar(2000, 2000, () => 3 * 1024 * 1024)).rejects.toThrow('Não foi possível reduzir')
  })
})

describe('prepararCapa sem webp (Safari antigo devolve PNG)', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('vai em jpeg começando em 0,85, sem tentar webp de novo', async () => {
    vi.stubGlobal('createImageBitmap', async () => ({ width: 1080, height: 1350, close: () => {} }))
    vi.stubGlobal('Image', class { naturalWidth = 1080; naturalHeight = 1350; onload: (() => void) | null = null; set src(_: string) { queueMicrotask(() => this.onload?.()) } })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as never)
    const pedidos: [string, number][] = []
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (ok: BlobCallback, tipo?: string, q?: number) {
      pedidos.push([tipo ?? '', q ?? 0])
      ok(new Blob(['x'], { type: tipo === 'image/webp' ? 'image/png' : tipo }))
    })
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:previa', revokeObjectURL: () => {} }))
    const capa = await prepararCapa(new File(['x'], 'arte.jpg', { type: 'image/jpeg' }), 'e1')
    expect(capa.blob.type).toBe('image/jpeg')
    expect(pedidos).toEqual([['image/webp', 0.85], ['image/jpeg', 0.85]])
  })
})

describe('enviarFotoItem', () => {
  it('grava em cardapio-itens como <produtor>/<uuid>.<ext>, sem nome de arquivo', async () => {
    upload.mockResolvedValue({ error: null })
    const url = await enviarFotoItem(new Blob(['x'], { type: 'image/webp' }), 'u-1')
    const [bucket, caminho, , opcoes] = upload.mock.calls[0]
    expect(bucket).toBe('cardapio-itens')
    expect(caminho).toMatch(/^u-1\/[0-9a-f-]{36}\.webp$/)
    expect(opcoes).toMatchObject({ upsert: false, contentType: 'image/webp' })
    expect(url).toBe(`https://x/cardapio-itens/${caminho}`)
  })
})
