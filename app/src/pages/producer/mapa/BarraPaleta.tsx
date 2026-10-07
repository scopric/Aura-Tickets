import { useState } from 'react'
import { CATEGORIAS } from './paleta'

const fmt = (n: number) => String(n).replace('.', ',')

// Barra lateral: 6 categorias recolhíveis + busca. Escolher um item arma a ferramenta; o clique no mapa cria o elemento.
export default function BarraPaleta({ ferramenta, onEscolher }: { ferramenta: string; onEscolher: (id: string) => void }) {
  const [busca, setBusca] = useState('')
  const [abertas, setAbertas] = useState<Record<string, boolean>>({ navigation: true, seating: true })
  const q = busca.trim().toLowerCase()

  return (
    <nav aria-label="Paleta de elementos" className="flex w-56 flex-shrink-0 flex-col border-r border-border bg-card text-sm">
      <div className="border-b border-border p-2">
        <input
          type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar elemento…" aria-label="Buscar elemento"
          className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {CATEGORIAS.map(c => {
          const itens = q ? c.itens.filter(i => i.nome.toLowerCase().includes(q)) : c.itens
          if (q && !itens.length) return null
          const aberta = q ? true : !!abertas[c.id]
          return (
            <section key={c.id} className="mb-1">
              <button type="button" aria-expanded={aberta} onClick={() => setAbertas(a => ({ ...a, [c.id]: !a[c.id] }))}
                className="flex w-full items-center justify-between rounded-md px-1.5 py-1 text-left text-xs font-semibold uppercase text-muted-foreground hover:bg-foreground/5">
                <span>{c.nome}</span><span aria-hidden>{aberta ? '−' : '+'}</span>
              </button>
              {aberta && (
                <ul className="mt-0.5 space-y-0.5">
                  {itens.map(i => (
                    <li key={i.id}>
                      <button type="button" aria-pressed={ferramenta === i.id} onClick={() => onEscolher(i.id)}
                        className={`flex w-full items-center justify-between gap-2 rounded-md border px-2 py-1 text-left text-xs ${ferramenta === i.id ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-foreground/5'}`}>
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ background: i.cor || 'transparent', border: i.cor ? undefined : '1px solid currentColor' }} />
                          <span className="truncate">{i.nome}</span>
                        </span>
                        {i.w > 0 && <span className="flex-shrink-0 font-mono text-[10px] text-muted-foreground">{fmt(i.w)}×{fmt(i.h)} m</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}
        {q && !CATEGORIAS.some(c => c.itens.some(i => i.nome.toLowerCase().includes(q))) && <p className="p-2 text-xs text-muted-foreground">Nenhum elemento com “{busca}”.</p>}
      </div>
    </nav>
  )
}
