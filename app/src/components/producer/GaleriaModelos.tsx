import { useState } from 'react'
import { MODELOS } from '../../lib/certificados'
import { MiniaturaModelo } from '@/components/producer/CertificadoDesenho'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

function Conteudo({ atual, onFechar, onUsar }: { atual: string; onFechar: () => void; onUsar: (id: string) => void }) {
  const [escolhido, setEscolhido] = useState(atual)
  return (
    <>
      <DialogHeader>
        <DialogTitle>Escolher modelo</DialogTitle>
        <DialogDescription>Cada miniatura é o próprio modelo com o seu texto padrão. Ao usar, os textos e as posições que você já editou ficam; cores e fontes dos campos voltam ao padrão do modelo.</DialogDescription>
      </DialogHeader>
      <ul className="grid max-h-[55dvh] grid-cols-2 gap-3 overflow-y-auto p-1 sm:grid-cols-3">
        {MODELOS.map(m => (
          <li key={m.id}>
            <button type="button" aria-pressed={escolhido === m.id} onClick={() => setEscolhido(m.id)}
              className={`block min-h-11 w-full rounded-[10px] border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${escolhido === m.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-foreground/5'}`}>
              <MiniaturaModelo modelo={m} />
              <span className="mt-2 block text-[13px] font-medium text-foreground">{m.nome}{m.id === atual && <span className="ml-1 text-xs font-normal text-muted-foreground">(em uso)</span>}</span>
              <span className="block text-xs text-muted-foreground">{m.descricao}</span>
            </button>
          </li>
        ))}
      </ul>
      <DialogFooter>
        <Button variant="outline" className="min-h-11" onClick={onFechar}>Cancelar</Button>
        <Button className="min-h-11" onClick={() => { onUsar(escolhido); onFechar() }}>Usar este modelo</Button>
      </DialogFooter>
    </>
  )
}

// Janela "Escolher modelo": miniaturas dos 12 modelos; o conteúdo só existe aberto (a escolha recomeça no modelo em uso).
export default function GaleriaModelos({ aberto, onFechar, atual, onUsar }: { aberto: boolean; onFechar: () => void; atual: string; onUsar: (id: string) => void }) {
  return (
    <Dialog open={aberto} onOpenChange={o => { if (!o) onFechar() }}>
      <DialogContent className="sm:max-w-3xl">
        <Conteudo atual={atual} onFechar={onFechar} onUsar={onUsar} />
      </DialogContent>
    </Dialog>
  )
}
