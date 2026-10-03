import * as ToggleGroup from '@radix-ui/react-toggle-group'
import { Sun, Moon, SunMoon } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import { rotaForcadaEscuro, type Tema } from '../lib/tema'
import { cn } from '../lib/utils'

interface ThemeToggleProps {
  className?: string
  collapsed?: boolean
}

// Contrato v3.4, §2.8.9: segmentado "Automático · Claro · Escuro", nesta ordem; nunca interruptor sim/não
const OPCOES: { valor: Tema; rotulo: string; Icone: typeof Sun }[] = [
  { valor: 'auto', rotulo: 'Automático', Icone: SunMoon },
  { valor: 'light', rotulo: 'Claro', Icone: Sun },
  { valor: 'dark', rotulo: 'Escuro', Icone: Moon },
]

export default function ThemeToggle({ className, collapsed = false }: ThemeToggleProps) {
  const { tema, temaResolvido, setTema } = useTheme()
  const { pathname } = useLocation()
  if (rotaForcadaEscuro(pathname)) return null // páginas públicas ainda não refeitas: sempre escuras

  const i = OPCOES.findIndex(o => o.valor === tema)
  const atual = OPCOES[i]

  // Lateral recolhida: um botão que passa pelos 3 estados
  if (collapsed) {
    const proximo = OPCOES[(i + 1) % OPCOES.length]
    const rotulo = `Tema: ${atual.rotulo.toLowerCase()}. Mudar para ${proximo.rotulo.toLowerCase()}`
    return (
      <button
        type="button"
        onClick={() => setTema(proximo.valor)}
        aria-label={rotulo}
        title={rotulo}
        className={cn(
          'w-9 h-9 rounded-ev-md flex items-center justify-center text-muted-foreground hover:text-foreground',
          'transition-colors duration-rapido motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className
        )}
      >
        <atual.Icone className="w-4 h-4" aria-hidden="true" />
      </button>
    )
  }

  return (
    <div className={cn('space-y-1', className)}>
      <ToggleGroup.Root
        type="single"
        value={tema}
        onValueChange={v => setTema((v || tema) as Tema)} // clicar no item já marcado também grava a escolha
        role="radiogroup"
        aria-label="Tema"
        className="relative grid h-8 grid-cols-3 rounded-ev-lg bg-secondary p-0.5"
      >
        {/* item selecionado: desliza por índice, sem medir nada em JS */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0.5 left-0.5 w-[calc((100%-4px)/3)] rounded-ev-md bg-card shadow-[0_1px_2px_rgb(0_0_0/0.10),0_0_0_1px_rgb(0_0_0/0.04)] transition-transform duration-base ease-move motion-reduce:transition-none dark:bg-white/10 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]"
          style={{ transform: `translateX(${i * 100}%)` }}
        />
        {/* 12 px: "Automático" mede 66 px e cada terço da lateral de 240 px tem ~73 px */}
        {OPCOES.map(o => (
          <ToggleGroup.Item
            key={o.valor}
            value={o.valor}
            className="relative z-10 min-w-0 rounded-ev-md px-0.5 text-xs font-medium text-muted-foreground transition-colors duration-rapido motion-reduce:transition-none hover:text-foreground data-[state=on]:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {o.rotulo}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
      {tema === 'auto' && (
        <p className="px-1 text-xs text-muted-foreground">
          Seguindo o aparelho: {temaResolvido === 'dark' ? 'escuro' : 'claro'}
        </p>
      )}
    </div>
  )
}
