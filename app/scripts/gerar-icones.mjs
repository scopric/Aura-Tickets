// Gera src/components/icones/evokaa16.ts a partir do JSON da família Evokaa 16.
// Uso: node scripts/gerar-icones.mjs ~/Public/evokaa-redesenho/refs/icones/codigo/icones-completo.json
import { readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const entrada = process.argv[2]
if (!entrada) {
  console.error('Uso: node scripts/gerar-icones.mjs <icones-completo.json>')
  process.exit(1)
}
const json = JSON.parse(readFileSync(entrada.replace(/^~(?=\/)/, homedir()), 'utf8'))

const pascal = nome =>
  nome
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map(p => p[0].toUpperCase() + p.slice(1))
    .join('')

const vistos = new Map()
const linhas = Object.entries(json).map(([nome, camadas]) => {
  const id = pascal(nome)
  if (!/^[A-Z][A-Za-z0-9]*$/.test(id)) throw new Error(`Nome inválido: ${nome} -> ${id}`)
  if (vistos.has(id)) throw new Error(`Nome repetido: ${nome} e ${vistos.get(id)} -> ${id}`)
  vistos.set(id, nome)
  const extra = Object.keys(camadas).filter(k => !['tint', 'stroke', 'solid', 'half'].includes(k))
  if (extra.length || !camadas.stroke && !camadas.solid) throw new Error(`Camadas inválidas em ${nome}: ${Object.keys(camadas)}`)
  const corpo = ['tint', 'stroke', 'solid', 'half']
    .filter(k => camadas[k])
    .map(k => `${k}: ${JSON.stringify(camadas[k])}`)
    .join(', ')
  return `export const ${id} = /*#__PURE__*/ criar(${JSON.stringify(id)}, { ${corpo} })`
})

const saida = `// Gerado a partir de ~/Public/evokaa-redesenho/refs/icones/codigo/icones-completo.json — não editar à mão.
// Regenerar: node scripts/gerar-icones.mjs <caminho do icones-completo.json>
// Uso: import * as I from '@/components/icones/evokaa16' e <I.Buscar /> (acesso estático; I[nome] puxa a família inteira).
import { criar } from './criar'

export type { IconeEvokaa, IconeProps } from './criar'

${linhas.join('\n')}
`
const destino = join(dirname(fileURLToPath(import.meta.url)), '../src/components/icones/evokaa16.ts')
writeFileSync(destino, saida)
console.log(`${linhas.length} ícones -> ${destino}`)
