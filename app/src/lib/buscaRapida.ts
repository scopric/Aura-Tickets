import { gravarNav, lerNav } from './navegacaoProdutor'

// Lógica pura do ⌘K v2 (prefixos e recentes). A moldura e as ações ficam em components/producer/BuscaRapida.tsx.

export type Grupo = 'tudo' | 'eventos' | 'telas' | 'acoes'

// Símbolo (e não letra) no começo do texto: não briga com título de evento que comece por "e" ou "t"
const SIMBOLO: Record<string, Grupo> = { '@': 'eventos', '/': 'telas', '>': 'acoes' }

/** "@festa" → só eventos, consulta "festa"; "/cup" → só telas; ">tema" → só ações; sem símbolo, tudo. */
export function lerPrefixo(q: string): { grupo: Grupo; consulta: string } {
  const t = q.trimStart()
  const grupo = SIMBOLO[t[0] ?? '']
  return grupo ? { grupo, consulta: t.slice(1).trim() } : { grupo: 'tudo', consulta: q.trim() }
}

// Recentes: só o que a própria busca abriu (até 3). Guarda ids e rotas, nunca títulos (o título vem da lista de eventos do produtor).
export type Recente = { tipo: 'tela' | 'evento'; ref: string } // ref = rota da tela ou id do evento
const CHAVE = 'recentes'
const MAX = 3

export function lerRecentes(): Recente[] {
  try {
    const v: unknown = JSON.parse(lerNav(CHAVE) ?? '[]')
    if (!Array.isArray(v)) return []
    return v.filter((r): r is Recente => !!r && (r.tipo === 'tela' || r.tipo === 'evento') && typeof r.ref === 'string').slice(0, MAX)
  } catch { return [] }
}

export function registrarRecente(r: Recente): void {
  const outros = lerRecentes().filter(x => !(x.tipo === r.tipo && x.ref === r.ref))
  gravarNav(CHAVE, JSON.stringify([r, ...outros].slice(0, MAX)))
}
