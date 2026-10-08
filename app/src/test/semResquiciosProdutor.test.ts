import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Decisão 213: a paleta antiga (espresso/plum/cream, font-serif, brilho) não volta ao painel do produtor.
const PASTAS = ['pages/producer', 'components/producer']
const AVULSOS = ['components/ComingSoon.tsx', 'components/ProducerLayout.tsx']
// Exceção: o mapa antigo é de outra sessão (editor novo em /producer/lugar-marcado-v2) e sai com ele.
const EXCECOES = [/^SeatingMap\.tsx$/, /^mapa/i]
const ANTIGO = /espresso|plum|cream|shadow-glow|font-serif/

describe('sem resquícios do visual antigo no produtor', () => {
  it('nenhum arquivo de pages/producer e components/producer usa a paleta antiga', () => {
    const achados: string[] = []
    for (const pasta of PASTAS) {
      const dir = resolve(__dirname, '..', pasta)
      for (const f of readdirSync(dir, { recursive: true }).map(String).filter(n => /\.tsx?$/.test(n) && !EXCECOES.some(e => e.test(n.split('/').pop()!)))) {
        const m = readFileSync(resolve(dir, f), 'utf8').match(new RegExp(ANTIGO, 'g'))
        if (m) achados.push(`${pasta}/${f}: ${m.length}`)
      }
    }
    for (const f of AVULSOS) {
      const m = readFileSync(resolve(__dirname, '..', f), 'utf8').match(new RegExp(ANTIGO, 'g'))
      if (m) achados.push(`${f}: ${m.length}`)
    }
    expect(achados).toEqual([])
  })
})
