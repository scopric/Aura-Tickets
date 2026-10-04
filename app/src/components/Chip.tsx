import { cn } from '@/lib/utils'

// Chip de filtro do participante (contrato v3.4, 5.4): pílula de 40 px, `aria-pressed`. Desligado: contorno do campo;
// ligado: brand-soft com texto azul. Mesma aparência do Explorar (EventsBrowse).
export default function Chip({ marcado, onClick, children }: { marcado: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={marcado}
      onClick={onClick}
      className={cn(
        'h-10 flex-none whitespace-nowrap rounded-ev-pill px-4 text-sm transition-colors duration-rapido focus-visible:outline-none focus-visible:shadow-ev-foco motion-reduce:transition-none',
        marcado
          ? 'bg-[var(--ev-brand-soft)] font-semibold text-primary'
          : 'font-medium text-foreground shadow-[inset_0_0_0_1px_hsl(var(--input))] hover:bg-[var(--ev-tint-hover)] active:bg-[var(--ev-tint-press)]'
      )}
    >
      {children}
    </button>
  )
}
