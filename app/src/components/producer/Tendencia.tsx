import { cn } from '@/lib/utils'

/** Mini-tendência (sparkline) para dentro de cartões de KPI: só a forma da série, sem eixo nem número (o número está ao lado).
 *  Lacunas (null) não entram: a linha liga só os dias que têm valor. */
export default function Tendencia({ valores, className }: { valores: (number | null)[]; className?: string }) {
  const com = valores.map((v, i) => [v, i] as const).filter((p): p is readonly [number, number] => p[0] != null)
  if (com.length < 2) return null
  const max = Math.max(...com.map(p => p[0])), min = Math.min(...com.map(p => p[0]))
  const y = (v: number) => (max === min ? 22 : 22 - ((v - min) / (max - min)) * 20) // série constante vira linha na base
  const pontos = com.map(([v, i]) => `${((i / Math.max(1, valores.length - 1)) * 100).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true" focusable="false" className={cn('block h-6 w-24', className)}>
      <polyline points={pontos} fill="none" className="stroke-primary" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
