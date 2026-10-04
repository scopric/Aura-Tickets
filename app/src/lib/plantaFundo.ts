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
// ponytail: só a página 1; sem as fontes padrão do pdf.js, texto de fonte não embutida pode sair trocado.
export async function pdfParaImagem(arquivo: Blob, maxLado = 1600): Promise<Blob> {
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const tarefa = pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) })
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
