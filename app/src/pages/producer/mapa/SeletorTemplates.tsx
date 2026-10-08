import { useMemo } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ORIGEM_SALA } from './geometria'
import { TEMPLATES, type Template } from './templates'

// Miniatura: cada elemento vira um retângulo na sua cor, dentro da sala (sem rotação, só para dar ideia)
function Miniatura({ t }: { t: Template }) {
  const g = useMemo(() => t.gerar(), [t])
  return (
    <svg viewBox={`0 0 ${g.roomWidth} ${g.roomHeight}`} className="h-24 w-full rounded bg-muted" aria-hidden>
      {g.seats.map(s => {
        const w = s.widthMeter || 0.5, h = s.heightMeter || 0.5
        const girado = Math.round(s.rotation || 0) % 180 !== 0
        const [a, b] = girado ? [h, w] : [w, h]
        return <rect key={s.id} x={s.x - ORIGEM_SALA - a / 2} y={s.y - ORIGEM_SALA - b / 2} width={a} height={b} fill={s.color} opacity={0.9} />
      })}
    </svg>
  )
}

export default function SeletorTemplates({ aberto, onFechar, onEscolher }: { aberto: boolean; onFechar: () => void; onEscolher: (t: Template) => void }) {
  return (
    <Dialog open={aberto} onOpenChange={o => { if (!o) onFechar() }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Templates</DialogTitle>
          <DialogDescription>Escolha um modelo para começar. Ele substitui o conteúdo do pavimento atual.</DialogDescription>
        </DialogHeader>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {TEMPLATES.map(t => (
            <li key={t.id}>
              <button type="button" onClick={() => onEscolher(t)} className="w-full space-y-1.5 rounded-lg border border-border p-2 text-left hover:border-primary hover:bg-primary/5">
                {aberto && <Miniatura t={t} />}
                <span className="block text-sm font-semibold">{t.nome}</span>
                <span className="block text-xs text-muted-foreground">{t.descricao}</span>
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
