import { useState } from 'react'
import { Armchair, ChevronDown, DoorOpen, Hand, MousePointer2, Search, Theater, Type, UtensilsCrossed, Wrench, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { CATEGORIAS, formaDe, type ItemCatalogo } from './paleta'

const fmt = (n: number) => String(n).replace('.', ',')
const ICONES: Record<string, LucideIcon> = { navigation: MousePointer2, seating: Armchair, structures: Theater, technical: Wrench, food: UtensilsCrossed, facilities: DoorOpen }
const NAVEGACAO: { id: string; nome: string; Icone: LucideIcon }[] = [
  { id: 'select', nome: 'Selecionar', Icone: MousePointer2 }, { id: 'pan', nome: 'Mão', Icone: Hand }, { id: 'text', nome: 'Texto', Icone: Type },
]

// Miniatura plana (vista de cima) na proporção real do objeto, até 40 px; mesas ganham cadeirinhas
function Miniatura({ i }: { i: ItemCatalogo }) {
  const M = 40, cor = i.cor || '#94a3b8'
  const k = Math.min(M / i.w, M / i.h, 40) * (i.tipo === 'table' ? 0.6 : 0.9)
  const w = Math.max(6, i.w * k), h = Math.max(6, i.h * k), cx = M / 2, cy = M / 2
  const redonda = i.tipo === 'table' ? (i.mesa || 'circle') === 'circle' : formaDe(i.tipo) === 'c'
  const cadeiras = i.tipo === 'table' ? Math.min(i.cap || 4, 8) : 0
  const pontos = Array.from({ length: cadeiras }, (_, n) => {
    const a = (n / cadeiras) * Math.PI * 2
    return { x: cx + Math.cos(a) * (w / 2 + 3.5), y: cy + Math.sin(a) * (h / 2 + 3.5) }
  })
  return (
    <svg width={M} height={M} viewBox={`0 0 ${M} ${M}`} aria-hidden className="flex-shrink-0">
      {pontos.map((p, n) => <circle key={n} cx={p.x} cy={p.y} r={2.6} fill="none" stroke={cor} strokeWidth={1} opacity={0.8} />)}
      {redonda
        ? <ellipse cx={cx} cy={cy} rx={w / 2} ry={h / 2} fill={cor} fillOpacity={0.25} stroke={cor} strokeWidth={1.25} />
        : <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={2} fill={cor} fillOpacity={0.25} stroke={cor} strokeWidth={1.25} />}
    </svg>
  )
}

// Barra lateral: navegação em ícones, busca fixa e categorias recolhíveis com cartões. Escolher um item arma a ferramenta; o clique no mapa cria o elemento.
export default function BarraPaleta({ ferramenta, onEscolher }: { ferramenta: string; onEscolher: (id: string) => void }) {
  const [busca, setBusca] = useState('')
  const [abertas, setAbertas] = useState<Record<string, boolean>>({ seating: true })
  const q = busca.trim().toLowerCase()
  const cats = CATEGORIAS.filter(c => c.id !== 'navigation')
    .map(c => ({ ...c, itens: q ? c.itens.filter(i => i.nome.toLowerCase().includes(q)) : c.itens }))
    .filter(c => c.itens.length)

  return (
    <nav aria-label="Paleta de elementos" className="flex h-full w-full flex-col bg-card text-foreground">
      <div className="sticky top-0 z-10 space-y-2 border-b border-border bg-card p-3">
        <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Navegação">
          {NAVEGACAO.map(({ id, nome, Icone }) => (
            <button key={id} type="button" aria-pressed={ferramenta === id} title={nome} onClick={() => onEscolher(id)}
              className={`mapa-anim flex h-9 flex-col items-center justify-center rounded-md border text-xs ${ferramenta === id ? 'border-primary bg-primary/15 text-primary' : 'border-border hover:border-foreground/30 hover:bg-foreground/5'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}>
              <Icone className="h-4 w-4" aria-hidden /><span className="sr-only">{nome}</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar elemento…" aria-label="Buscar elemento"
            className="h-9 w-full rounded-md border border-input bg-transparent pl-8 pr-8 text-sm outline-none [&::-webkit-search-cancel-button]:hidden focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50" />
          {busca && (
            <button type="button" aria-label="Limpar busca" onClick={() => setBusca('')} className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-foreground/10">
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      </div>
      <div className="mapa-rolagem min-h-0 flex-1 space-y-1.5 overflow-y-auto overflow-x-hidden p-3">
        {cats.map(c => {
          const aberta = q ? true : !!abertas[c.id]
          const Icone = ICONES[c.id]
          return (
            <section key={c.id} className={`rounded-lg border ${aberta ? 'border-border bg-foreground/[0.03]' : 'border-transparent'}`}>
              <button type="button" aria-expanded={aberta} onClick={() => setAbertas(a => ({ ...a, [c.id]: !a[c.id] }))}
                className="mapa-anim flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Icone className={`h-4 w-4 flex-shrink-0 ${aberta ? 'text-primary' : 'text-muted-foreground'}`} aria-hidden />
                <span className="min-w-0 flex-1 text-sm font-semibold">{c.nome}</span>
                <span className="rounded-full bg-foreground/10 px-1.5 text-xs text-muted-foreground">{c.itens.length}</span>
                <ChevronDown className={`mapa-anim h-4 w-4 flex-shrink-0 text-muted-foreground ${aberta ? 'rotate-180' : ''}`} aria-hidden />
              </button>
              <div className={`mapa-colapso ${aberta ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`} inert={!aberta}>
                <div className="min-h-0 overflow-hidden">
                  <ul className="grid grid-cols-2 gap-2 p-2 pt-1">
                    {c.itens.map(i => {
                      const ativo = ferramenta === i.id
                      return (
                        <li key={i.id} className="min-w-0">
                          <button type="button" aria-pressed={ativo} onClick={() => onEscolher(i.id)}
                            className={`mapa-anim mapa-cartao flex h-full w-full flex-col items-center gap-1.5 rounded-md border p-2 text-center hover:scale-[1.03] hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${ativo ? 'mapa-pulso border-primary bg-primary/15' : 'border-border bg-card'}`}>
                            <Miniatura i={i} />
                            <span className="text-[13px] font-medium leading-tight [overflow-wrap:anywhere]">{i.nome}</span>
                            {i.w > 0 && <span className="text-xs leading-none text-muted-foreground">{fmt(i.w)} × {fmt(i.h)} m</span>}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            </section>
          )
        })}
        {!cats.length && <p className="p-2 text-sm text-muted-foreground">Nenhum elemento com “{busca}”.</p>}
      </div>
    </nav>
  )
}
