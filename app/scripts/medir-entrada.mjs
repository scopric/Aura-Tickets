// Mede o que o navegador baixa antes de mostrar qualquer tela: o JS e o CSS que o
// dist/index.html pede (script de entrada, modulepreload e folhas de estilo), em gzip.
// Uso: npm run build && npm run medir   (teto das Decisões 140 e 143: +6 kB por PR)
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const html = readFileSync('dist/index.html', 'utf8')
const arquivos = [...html.matchAll(/<(?:script[^>]*\ssrc|link[^>]*\shref)="(\/assets\/[^"]+\.(?:js|css))"/g)].map(m => m[1])

let js = 0
let css = 0
for (const a of new Set(arquivos)) {
  const kb = gzipSync(readFileSync('dist' + a)).length / 1024
  if (a.endsWith('.css')) css += kb
  else js += kb
  console.log(`${kb.toFixed(1).padStart(7)} kB  ${a}`)
}
console.log(`\nEntrada (gzip): JS ${js.toFixed(1)} kB + CSS ${css.toFixed(1)} kB = ${(js + css).toFixed(1)} kB`)
