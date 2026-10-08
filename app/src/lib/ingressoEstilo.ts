import { contraste, ehHex } from './corEvento'

// Estilo do ingresso do produtor (Decisão 206). O modelo padrão da Evokaa é o do PDF atual (azul da marca, sem rodapé).
// "Meu estilo" é do plano PRO; hoje useFeatures libera para todos e a cobrança entra depois.
export const AZUL_EVOKAA = '#4a60e3'
export const TINTA = '#0c2340'
export const RODAPE_MAX = 120
export const FEATURE_ESTILO = 'ingresso_estilo'

export type PosicaoLogo = 'esquerda' | 'centro'
export type EstiloIngresso = { cor: string | null; rodape: string; logo: PosicaoLogo }
export const ESTILO_PADRAO: EstiloIngresso = { cor: null, rodape: '', logo: 'esquerda' }

/** Cor do topo: a escolhida (#rrggbb) ou o azul da Evokaa. */
export const corDoTopo = (e: EstiloIngresso) => (ehHex(e.cor) ? e.cor : AZUL_EVOKAA)

/** Texto branco quando passa de 4,5:1 sobre a cor; senão a tinta escura da marca. */
export const textoSobre = (cor: string) => (contraste(cor, '#ffffff') >= 4.5 ? '#ffffff' : TINTA)

/** Aceita só o que o ingresso sabe desenhar (o servidor vai repetir esta conferência). */
export function estiloLimpo(e: Partial<EstiloIngresso> | null | undefined): EstiloIngresso {
  return {
    cor: ehHex(e?.cor) ? e.cor : null,
    rodape: (e?.rodape ?? '').replace(/[\r\n\t]+/g, ' ').slice(0, RODAPE_MAX),
    logo: e?.logo === 'centro' ? 'centro' : 'esquerda',
  }
}

// Logo do produtor: PNG, JPEG ou WebP até 5 MB (SVG fica de fora). O navegador reduz para PNG de até 512 px.
export const LOGO_TIPOS = ['image/png', 'image/jpeg', 'image/webp']
export const LOGO_MAX_BYTES = 5 * 1024 * 1024
export const LOGO_LADO = 512

export function erroDaLogo(f: { type: string; size: number }): string | null {
  if (!LOGO_TIPOS.includes(f.type)) return 'Use uma imagem PNG, JPEG ou WebP.'
  if (f.size > LOGO_MAX_BYTES) return 'A imagem passa de 5 MB. Escolha uma menor.'
  return null
}

/** Lado maior limitado a 512 px, sem ampliar. */
export function ladoDaLogo(w: number, h: number): { w: number; h: number } {
  const k = Math.min(1, LOGO_LADO / Math.max(w, h, 1))
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) }
}

/** Reduz e regrava em PNG pelo canvas (descarta EXIF). Devolve uma URL local; quem chama libera com URL.revokeObjectURL. */
export async function prepararLogo(file: File): Promise<string> {
  const erro = erroDaLogo(file)
  if (erro) throw new Error(erro)
  const img = await createImageBitmap(file).catch(() => { throw new Error('Não foi possível abrir essa imagem. Escolha outro arquivo.') })
  const { w, h } = ladoDaLogo(img.width, img.height)
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  canvas.getContext('2d')?.drawImage(img, 0, 0, w, h)
  img.close()
  const blob = await new Promise<Blob | null>(ok => canvas.toBlob(ok, 'image/png'))
  if (!blob) throw new Error('Não foi possível preparar a imagem. Tente outra.')
  return URL.createObjectURL(blob)
}
