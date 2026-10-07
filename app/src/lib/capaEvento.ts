import { useEffect, useRef } from 'react'
import { supabase } from './supabase'
import { queryClient } from './queryClient'
import { corViva } from './corEvento'

// Envio da capa do evento (V6b; Decisões 136, 142 e 173). A arte vai INTEIRA, na proporção dela (flyer em pé ou deitado),
// reduzida no navegador só se passar de 2000 px no lado maior (nunca ampliada: foto pequena ampliada fica borrada; se não couber em 2 MB, cai para 1600 e 1200) e
// regravada pelo canvas, o que descarta EXIF e GPS. O banco (bucket capas-eventos) também confere tipo, tamanho e
// caminho; aqui se confere antes só para dar mensagem clara.
const ENTRADA_TIPOS = ['image/jpeg', 'image/png', 'image/webp'] // SVG e o resto ficam de fora
const ENTRADA_MAX = 10 * 1024 * 1024 // o que a pessoa escolhe; o arquivo enviado é bem menor
const SAIDA_MAX = 2 * 1024 * 1024 - 4096 // teto do bucket (2 MB) com margem
const LADOS = [2000, 1600, 1200] // lado maior, do melhor ao menor; só reduz, nunca amplia
/** Abaixo disso a arte fica borrada em tela de celular e de computador (o campo avisa); abaixo do mínimo, recusa. */
export const LADO_BOM = 1200
export const LADO_MINIMO = 600
const BUCKET_CAPAS = 'capas-eventos'

export interface CapaPronta {
  blob: Blob // webp (ou jpeg, onde o navegador não grava webp), até 2 MB, sem EXIF
  previewUrl: string // URL local para mostrar antes de enviar (liberar com URL.revokeObjectURL)
  cor: string // cor viva sugerida pela foto (#rrggbb)
  largura: number // tamanho da foto escolhida (já girada), antes de reduzir: o campo avisa se for pequena
  altura: number
}

// Medidas da foto já giradas pelo EXIF (naturalWidth/Height), sem decodificar a arte inteira na memória
function lerMedidas(file: File): Promise<{ w: number; h: number }> {
  const url = URL.createObjectURL(file)
  return new Promise((ok, falha) => {
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); ok({ w: img.naturalWidth, h: img.naturalHeight }) }
    img.onerror = () => { URL.revokeObjectURL(url); falha(new Error('Não foi possível abrir essa foto. Escolha outro arquivo.')) }
    img.src = url
  })
}

const gravar = (canvas: HTMLCanvasElement, tipo: string, q: number) => new Promise<Blob | null>(ok => canvas.toBlob(ok, tipo, q))

export async function prepararCapa(file: File, semente: string): Promise<CapaPronta> {
  if (!ENTRADA_TIPOS.includes(file.type)) throw new Error('Use uma foto JPG, PNG ou WebP.')
  if (file.size > ENTRADA_MAX) throw new Error('A foto deve ter no máximo 10 MB.')
  const { w, h } = await lerMedidas(file)
  const maior = Math.max(w, h)
  let canvas: HTMLCanvasElement | null = null
  let blob: Blob | null = null
  // Lado máximo cai (2000, 1600, 1200) até caber nos 2 MB do bucket; em cada lado, webp em 3 qualidades e jpeg como última
  for (const lado of LADOS) {
    const esc = Math.min(1, lado / maior) // só reduz; a proporção da arte fica
    const rw = Math.round(w * esc), rh = Math.round(h * esc)
    let bmp: ImageBitmap
    try {
      // decodifica já reduzida (foto de 48 MP não pode ir inteira para a memória) e gira pelo EXIF; navegador sem a opção: tenta sem ela
      bmp = await createImageBitmap(file, { imageOrientation: 'from-image', resizeWidth: rw, resizeHeight: rh, resizeQuality: 'high' })
    } catch {
      try {
        bmp = await createImageBitmap(file)
      } catch {
        throw new Error('Não foi possível abrir essa foto. Escolha outro arquivo.')
      }
    }
    try {
      canvas = document.createElement('canvas')
      canvas.width = rw
      canvas.height = rh
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Seu navegador não conseguiu preparar a foto.')
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(bmp, 0, 0, rw, rh)
    } finally {
      bmp.close()
    }
    for (const [tipo, q] of [['image/webp', 0.85], ['image/webp', 0.7], ['image/webp', 0.55], ['image/jpeg', 0.7]] as const) {
      blob = await gravar(canvas, tipo, q)
      if (blob && blob.type !== tipo) blob = null // Safari antigo devolve PNG quando não grava webp: pula para o jpeg
      if (blob && blob.size <= SAIDA_MAX) break
    }
    if (blob && blob.size <= SAIDA_MAX) break
  }
  if (!canvas || !blob || blob.size > SAIDA_MAX) throw new Error('Não foi possível reduzir a foto. Escolha outra.')
  return { blob, previewUrl: URL.createObjectURL(blob), cor: corViva(canvas, semente), largura: w, altura: h }
}

function mensagemDeEnvio(err: { message?: string; statusCode?: string | number; status?: number }): string {
  const recusado = /row-level security|unauthorized|forbidden|violates/i.test(err.message ?? '') || [401, 403, '401', '403'].includes(err.statusCode ?? err.status ?? 0)
  return recusado
    ? 'O envio da foto foi recusado: só o dono do evento envia, o evento não pode estar cancelado e cada evento aceita até 10 envios de capa.'
    : 'Não foi possível enviar a foto. Confira a internet e tente de novo.'
}

// Sobe a capa em <produtor>/<evento>/<uuid>.<ext> (a regra do Storage exige esse caminho; o nome do arquivo da pessoa
// não entra). upsert: false e nome novo a cada envio: o banco não deixa trocar nem apagar arquivo. Devolve a URL pública.
export async function enviarCapa(capa: Pick<CapaPronta, 'blob'>, produtorId: string, eventoId: string): Promise<string> {
  const ext = capa.blob.type === 'image/webp' ? 'webp' : 'jpg'
  const caminho = `${produtorId}/${eventoId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET_CAPAS).upload(caminho, capa.blob, { contentType: capa.blob.type, upsert: false, cacheControl: '86400' })
  if (error) throw new Error(mensagemDeEnvio(error as { message?: string; statusCode?: string }))
  return supabase.storage.from(BUCKET_CAPAS).getPublicUrl(caminho).data.publicUrl
}

// Grava a URL nas duas colunas (a trava do banco aceita só URL do bucket, a foto padrão ou vazio). Trocar a capa de
// evento aprovado manda o evento para nova análise (gatilho gf_protect_event_moderation, Decisão 136).
async function gravarCapa(eventoId: string, url: string): Promise<void> {
  // ponytail: os tipos do banco resolvem para never (mesmo erro de useEvents); cast até regenerar types/database.ts
  // select + single: RLS que filtra devolve 0 linhas sem erro, e aí o single falha em vez de fingir que gravou
  const { error } = await supabase.from('events').update({ cover_image: url, image_url: url } as never).eq('id', eventoId).select('id').single()
  if (error) throw error
}

// Evento novo (cópia do começo rápido): a foto sobe depois de o evento existir. Falhar não perde o evento: devolve false
// e a tela avisa para enviar de novo no painel do evento.
export async function enviarEGravarCapa(capa: Pick<CapaPronta, 'blob'>, produtorId: string, eventoId: string): Promise<boolean> {
  try {
    await gravarCapa(eventoId, await enviarCapa(capa, produtorId, eventoId))
    queryClient.invalidateQueries({ queryKey: ['producer-events'] })
    return true
  } catch (err) {
    console.error('Falha ao enviar a capa do evento:', err instanceof Error ? err.message : err)
    return false
  }
}

// Libera a URL local da prévia ao sair da tela (a troca e a remoção são liberadas no próprio campo)
export function useLiberarPrevia(capa: CapaPronta | null) {
  const atual = useRef(capa)
  useEffect(() => { atual.current = capa })
  useEffect(() => () => { if (atual.current) URL.revokeObjectURL(atual.current.previewUrl) }, [])
}
