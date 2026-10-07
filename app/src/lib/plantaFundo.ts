// Planta de fundo do editor de lugar marcado: encaixa a imagem inteira (sem cortar) em no máximo 1600 px no maior lado
// e devolve um data URL webp de cerca de 300 KB (reduz a qualidade até caber).
// ponytail: o data URL vai dentro de seating_maps.config (jsonb), que é público quando o mapa está ativo;
// passar para o Storage se a planta pesar.
export async function reduzirPlanta(arquivo: Blob, maxLado = 1600, alvoBytes = 300_000): Promise<string> {
  const img = await createImageBitmap(arquivo)
  const k = Math.min(1, maxLado / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * k)
  c.height = Math.round(img.height * k)
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#fff' // fundo branco: no fallback jpeg (Safari) o transparente viraria preto
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.drawImage(img, 0, 0, c.width, c.height)
  img.close()
  let tipo = 'image/webp'
  for (let q = 0.8; ; q -= 0.1) {
    let url = c.toDataURL(tipo, q)
    if (!url.startsWith(`data:${tipo}`)) { tipo = 'image/jpeg'; url = c.toDataURL(tipo, q) } // Safari não exporta webp
    if (url.length * 0.75 <= alvoBytes || q < 0.4) return url
  }
}

// PDF da planta: a página 1 vira imagem aqui no navegador e segue o mesmo caminho da imagem (reduzirPlanta).
// O pdf.js e o worker só são baixados quando o arquivo é PDF (import dinâmico: chunk separado, fora da entrada).
// Build `legacy`: a moderna exige `Math.sumPrecise` (navegador novo) e falha em Safari/Chrome mais velhos.
// `wasmUrl`: os decodificadores wasm (JBIG2 de PDF escaneado, JPEG 2000, cores ICC) ficam em public/pdfjs-wasm;
// sem eles o PDF escaneado em JBIG2 sai em branco. ponytail: cópia dos arquivos de node_modules/pdfjs-dist/wasm
// (versão 6.4.299); recopiar ao atualizar o pdfjs-dist. Os *_nowasm_fallback.js ficam ao lado para quando a CSP
// passar a bloquear wasm: aí é preciso 'wasm-unsafe-eval' na CSP ou depender desses fallbacks. Só a página 1; sem as fontes padrão, fonte não embutida pode sair trocada.
export async function pdfParaImagem(arquivo: Blob, maxLado = 1600): Promise<Blob> {
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist/legacy/build/pdf.mjs'), import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const tarefa = pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()), wasmUrl: '/pdfjs-wasm/' })
  try {
    const pagina = await (await tarefa.promise).getPage(1)
    const base = pagina.getViewport({ scale: 1 })
    const viewport = pagina.getViewport({ scale: maxLado / Math.max(base.width, base.height) })
    const c = document.createElement('canvas')
    c.width = Math.round(viewport.width)
    c.height = Math.round(viewport.height)
    await pagina.render({ canvas: c, viewport, background: '#fff' }).promise
    return await new Promise<Blob>((ok, falha) => c.toBlob(b => (b ? ok(b) : falha(new Error('canvas vazio'))), 'image/png'))
  } finally {
    await tarefa.destroy()
  }
}

export const MAX_ARQUIVO_BYTES = 15 * 1024 * 1024 // planta enviada pelo produtor (imagem ou PDF)

// Mesmas regras do editor antigo: até 15 MB; imagem ou PDF (o <input accept> do navegador não impede arrastar outro tipo)
export function validarArquivoPlanta(a: { size: number; type: string; name: string }): { pdf: boolean; erro?: string } {
  const pdf = a.type === 'application/pdf' || /\.pdf$/i.test(a.name)
  if (a.size > MAX_ARQUIVO_BYTES) return { pdf, erro: 'Esse arquivo passa de 15 MB. Use um arquivo menor.' }
  if (!pdf && !a.type.startsWith('image/')) return { pdf, erro: 'Use uma imagem (PNG, JPG ou WebP) ou um PDF.' }
  return { pdf }
}
