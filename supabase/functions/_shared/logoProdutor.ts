// Logo do produtor nas exportações (docs/sql/20261031_produtor_logo.sql). Só funções sem dependência de Deno, para o vitest.
// A URL vem do banco (o CHECK já a amarra), mas aqui confere de novo antes de buscar: servidor nunca busca URL que não seja
// a do bucket logos-produtor DENTRO da pasta do próprio produtor (sem isso, uma URL gravada por outro caminho viraria SSRF).
const HOST = 'https://rwaezeqyuhxrssntcxdv.supabase.co/storage/v1/object/public/logos-produtor/'
export const LOGO_MAX_BYTES = 1024 * 1024
// Lado máximo (px) aceito no servidor. A tela reduz a 512 px, então logo legítima nunca passa disto; PNG pequeno que declara
// milhares de pixels ("bomba de descompressão": 8000x8000 em 250 KB gasta ~500 MB e 3,6 s no pdf-lib) fica de fora.
export const LOGO_MAX_LADO = 2000

export function urlLogoValida(url: unknown, produtorId: string): url is string {
  if (typeof url !== 'string' || !/^[0-9a-f-]{36}$/i.test(produtorId)) return false
  return new RegExp(`^${HOST.replace(/[.\\/]/g, '\\$&')}${produtorId}/[A-Za-z0-9_-]{8,80}\\.(png|webp|jpe?g)$`).test(url)
}

/** Tipo pelos primeiros bytes (o Storage confere só o Content-Type declarado, não o conteúdo). webp devolve null: o exceljs não o aceita. */
export function tipoImagem(b: Uint8Array): 'png' | 'jpeg' | null {
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png'
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg'
  return null
}

/** Baixa a logo do produtor. Qualquer falha (sem logo, URL fora do padrão, rede, tamanho, formato) devolve null: a planilha sai sem ela. */
export async function buscarLogo(url: unknown, produtorId: string): Promise<{ bytes: Uint8Array; ext: 'png' | 'jpeg' } | null> {
  if (!urlLogoValida(url, produtorId)) return null
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: 'error' })
    if (!r.ok) return null
    const bytes = new Uint8Array(await r.arrayBuffer())
    if (bytes.length === 0 || bytes.length > LOGO_MAX_BYTES) return null
    const ext = tipoImagem(bytes)
    if (!ext) return null
    const d = dimensoes(bytes, ext)
    return d && d.w > 0 && d.h > 0 && d.w <= LOGO_MAX_LADO && d.h <= LOGO_MAX_LADO ? { bytes, ext } : null // sem medidas legíveis = recusa
  } catch { return null }
}

/** Largura e altura lidas do cabeçalho do arquivo (PNG: IHDR; JPEG: marcador SOF). null se não achar. */
export function dimensoes(b: Uint8Array, ext: 'png' | 'jpeg'): { w: number; h: number } | null {
  const u32 = (i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0
  if (ext === 'png') return b.length >= 24 ? { w: u32(16), h: u32(20) } : null
  for (let i = 2; i + 9 < b.length;) {
    if (b[i] !== 0xff) { i++; continue }
    const m = b[i + 1]
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: (b[i + 7] << 8) | b[i + 8], h: (b[i + 5] << 8) | b[i + 6] }
    i += 2 + ((b[i + 2] << 8) | b[i + 3])
  }
  return null
}

/** Cabe em caixa x caixa mantendo a proporção; nunca amplia. */
export function caber(d: { w: number; h: number } | null, maxW: number, maxH: number): { width: number; height: number } {
  if (!d || d.w <= 0 || d.h <= 0) return { width: maxH, height: maxH }
  const esc = Math.min(1, maxW / d.w, maxH / d.h)
  return { width: Math.max(1, Math.round(d.w * esc)), height: Math.max(1, Math.round(d.h * esc)) }
}

/** Logo salva do produtor (producer_profiles.logo_url), pronta para o PDF. `db` é um cliente do Supabase com direito de ler o perfil (chave de serviço). Qualquer falha = null. */
// deno-lint-ignore no-explicit-any
export async function logoDoProdutor(db: any, produtorId: unknown): Promise<{ bytes: Uint8Array; ext: 'png' | 'jpeg' } | null> {
  if (typeof produtorId !== 'string') return null
  try {
    const { data, error } = await db.from('producer_profiles').select('logo_url').eq('id', produtorId).maybeSingle()
    return error ? null : await buscarLogo(data?.logo_url, produtorId)
  } catch { return null }
}
