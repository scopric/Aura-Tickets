import { supabase } from './supabase'

// Logo do produtor (docs/sql/20261031_produtor_logo.sql): uma por produtor, em <produtor>/<uuid>.<ext> no bucket público
// logos-produtor. Reduzida no navegador a no máximo 512 px (mantém a transparência) e regravada pelo canvas, o que descarta EXIF.
const TIPOS = ['image/png', 'image/jpeg', 'image/webp']
const ENTRADA_MAX = 5 * 1024 * 1024
const SAIDA_MAX = 1024 * 1024 - 4096 // teto do bucket (1 MB) com margem
const LADO = 512
const BUCKET = 'logos-produtor'

export interface LogoPronta { blob: Blob; ext: 'png' | 'webp'; previewUrl: string }

export async function prepararLogo(file: File): Promise<LogoPronta> {
  if (!TIPOS.includes(file.type)) throw new Error('Use uma imagem PNG, JPG ou WebP.')
  if (file.size > ENTRADA_MAX) throw new Error('A imagem deve ter no máximo 5 MB.')
  let bmp: ImageBitmap
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }) } catch {
    try { bmp = await createImageBitmap(file) } catch { throw new Error('Não foi possível abrir essa imagem. Escolha outro arquivo.') }
  }
  const esc = Math.min(1, LADO / Math.max(bmp.width, bmp.height)) // só reduz, nunca amplia
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bmp.width * esc))
  canvas.height = Math.max(1, Math.round(bmp.height * esc))
  try {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Seu navegador não conseguiu preparar a imagem.')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  } finally { bmp.close() }
  const gravar = (tipo: string, q?: number) => new Promise<Blob | null>(ok => canvas.toBlob(ok, tipo, q))
  let blob = await gravar('image/png')
  let ext: 'png' | 'webp' = 'png'
  if (blob && blob.type === 'image/png' && blob.size > SAIDA_MAX) { // PNG pesado: webp com transparência
    const w = await gravar('image/webp', 0.9)
    if (w && w.type === 'image/webp') { blob = w; ext = 'webp' }
  }
  if (!blob || blob.size > SAIDA_MAX || (blob.type !== 'image/png' && blob.type !== 'image/webp')) throw new Error('Não foi possível reduzir a imagem. Escolha outra, mais simples.')
  return { blob, ext, previewUrl: URL.createObjectURL(blob) }
}

function mensagem(err: { message?: string; statusCode?: string | number; status?: number }) {
  const recusado = /row-level security|unauthorized|forbidden|violates/i.test(err.message ?? '') || [401, 403, '401', '403'].includes(err.statusCode ?? err.status ?? 0)
  return recusado
    ? 'O envio foi recusado: só conta de produtor envia logo, e o limite é de 20 envios por dia. Se não for isso, confirme o segundo fator de novo.'
    : 'Não foi possível enviar a logo. Confira a internet e tente de novo.'
}

/** Sobe o arquivo (nome novo a cada envio: o banco não deixa trocar nem apagar) e devolve a URL pública. */
export async function enviarLogo(logo: Pick<LogoPronta, 'blob' | 'ext'>, produtorId: string): Promise<string> {
  const caminho = `${produtorId}/${crypto.randomUUID()}.${logo.ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(caminho, logo.blob, { contentType: logo.blob.type, upsert: false, cacheControl: '86400' })
  if (error) throw new Error(mensagem(error as { message?: string; statusCode?: string }))
  return supabase.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl
}
