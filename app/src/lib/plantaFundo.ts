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
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  img.close()
  let tipo = 'image/webp'
  for (let q = 0.8; ; q -= 0.1) {
    let url = c.toDataURL(tipo, q)
    if (!url.startsWith(`data:${tipo}`)) { tipo = 'image/jpeg'; url = c.toDataURL(tipo, q) } // Safari não exporta webp
    if (url.length * 0.75 <= alvoBytes || q < 0.4) return url
  }
}
