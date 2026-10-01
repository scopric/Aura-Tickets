import { useState, useEffect, type ReactNode } from 'react'
import { RotateCcw } from 'lucide-react'
import { brl } from '../../lib/taxa'
import { PageHeader } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const pct = (n: number | string) => `${String(n).replace('.', ',')}%`

function Cartao({ titulo, descricao, children }: { titulo: string; descricao: string; children: ReactNode }) {
  return (
    <section className="rounded-[10px] border border-border bg-card p-4 sm:p-5">
      <h2 className="text-sm font-medium text-foreground">{titulo}</h2>
      <p className="text-xs text-muted-foreground">{descricao}</p>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}

function Campo({ id, label, ...props }: { id: string; label: string } & React.ComponentProps<'input'>) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" inputMode="decimal" {...props} />
    </div>
  )
}

function Linha({ label, valor, forte }: { label: string; valor: ReactNode; forte?: boolean }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${forte ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`}>{valor}</span>
    </div>
  )
}

// ─── Markup Calculator ───
function MarkupCalc() {
  const [cost, setCost] = useState('')
  const [markup, setMarkup] = useState('')
  const [margin, setMargin] = useState('')
  const [price, setPrice] = useState('')

  // Calculate from cost + markup
  const calcFromMarkup = () => {
    const c = Number(cost)
    const m = Number(markup)
    if (c > 0 && m > 0) {
      const p = c * (1 + m / 100)
      setPrice(p.toFixed(2))
      setMargin((((p - c) / p) * 100).toFixed(1))
    }
  }

  // Calculate from cost + margin
  const calcFromMargin = () => {
    const c = Number(cost)
    const mar = Number(margin)
    if (c > 0 && mar > 0 && mar < 100) {
      const p = c / (1 - mar / 100)
      setPrice(p.toFixed(2))
      setMarkup((((p - c) / c) * 100).toFixed(1))
    }
  }

  // Calculate from price + cost
  const calcFromPrice = () => {
    const c = Number(cost)
    const p = Number(price)
    if (c > 0 && p > c) {
      setMarkup((((p - c) / c) * 100).toFixed(1))
      setMargin((((p - c) / p) * 100).toFixed(1))
    }
  }

  const reset = () => { setCost(''); setMarkup(''); setMargin(''); setPrice('') }

  return (
    <Cartao titulo="Precificação" descricao="Calcule markup, margem e preço de venda">
      <Campo id="calc-custo" label="Custo (R$)" value={cost} onChange={e => setCost(e.target.value)} placeholder="0,00" />
      <div className="grid grid-cols-2 gap-3">
        <Campo id="calc-markup" label="Markup (%)" value={markup} onChange={e => setMarkup(e.target.value)} onBlur={calcFromMarkup} placeholder="0" />
        <Campo id="calc-margem" label="Margem (%)" value={margin} onChange={e => setMargin(e.target.value)} onBlur={calcFromMargin} placeholder="0" />
      </div>
      <Campo id="calc-preco" label="Preço de venda (R$)" value={price} onChange={e => setPrice(e.target.value)} onBlur={calcFromPrice} placeholder="0,00" />

      {price && cost && (
        <div className="space-y-1 rounded-md border border-border p-3">
          <Linha label="Lucro unitário" valor={brl(Number(price) - Number(cost))} />
          <Linha label="Markup" valor={pct(markup)} />
          <Linha label="Margem" valor={pct(margin)} />
        </div>
      )}

      <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground hover:text-foreground">
        <RotateCcw aria-hidden="true" />Limpar
      </Button>
    </Cartao>
  )
}

// ─── Split Calculator ───
function SplitCalc() {
  const [total, setTotal] = useState('')
  const [people, setPeople] = useState('')
  const [tip, setTip] = useState('10')
  const [names, setNames] = useState<string[]>(['', ''])

  const pCount = Math.max(2, Number(people) || 2)
  const subtotal = Number(total) || 0
  const tipAmount = subtotal * (Number(tip) || 0) / 100
  const grandTotal = subtotal + tipAmount
  const perPerson = grandTotal / pCount

  useEffect(() => {
    if (pCount > names.length) {
      setNames([...names, ...Array(pCount - names.length).fill('')])
    } else if (pCount < names.length) {
      setNames(names.slice(0, pCount))
    }
  }, [pCount])

  return (
    <Cartao titulo="Divisão de conta" descricao="Divida um valor entre pessoas da equipe">
      <div className="grid grid-cols-2 gap-3">
        <Campo id="div-total" label="Total (R$)" value={total} onChange={e => setTotal(e.target.value)} placeholder="0,00" />
        <Campo id="div-pessoas" label="Pessoas" inputMode="numeric" min={2} value={people || ''} onChange={e => setPeople(e.target.value)} placeholder="2" />
      </div>
      <div className="grid gap-1.5">
        <span id="div-gorjeta" className="text-sm font-medium text-foreground">Gorjeta ou taxa</span>
        <div role="group" aria-labelledby="div-gorjeta" className="grid grid-cols-4 gap-1">
          {['0', '10', '15', '20'].map(t => (
            <Button key={t} size="sm" variant={tip === t ? 'secondary' : 'ghost'} aria-pressed={tip === t} onClick={() => setTip(t)}>
              {t}%
            </Button>
          ))}
        </div>
      </div>

      {grandTotal > 0 && (
        <>
          <div className="space-y-1 rounded-md border border-border p-3">
            <Linha label="Subtotal" valor={brl(subtotal)} />
            <Linha label={`Gorjeta (${tip}%)`} valor={brl(tipAmount)} />
            <div className="border-t border-border pt-1"><Linha label="Total" valor={brl(grandTotal)} forte /></div>
            <Linha label="Por pessoa" valor={brl(perPerson)} forte />
          </div>

          <div className="space-y-2">
            {names.slice(0, pCount).map((n, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  aria-label={`Nome da pessoa ${i + 1}`}
                  value={n}
                  onChange={e => { const nn = [...names]; nn[i] = e.target.value; setNames(nn) }}
                  placeholder={`Pessoa ${i + 1}`}
                  className="flex-1"
                />
                <span className="shrink-0 text-sm tabular-nums text-foreground">{brl(perPerson)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Cartao>
  )
}

// ─── Projection Calculator ───
function ProjectionCalc() {
  const [tickets, setTickets] = useState('')
  const [price, setPrice] = useState('')
  const [costs, setCosts] = useState('')
  const [capacity, setCapacity] = useState('')

  const totalRevenue = (Number(tickets) || 0) * (Number(price) || 0)
  const totalCosts = Number(costs) || 0
  const profit = totalRevenue - totalCosts
  const profitMargin = totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(1) : '0'
  const cap = Number(capacity) || 0
  const occupancy = cap > 0 ? ((Number(tickets) || 0) / cap * 100).toFixed(0) : '0'
  const breakeven = Number(price) > 0 ? Math.ceil(totalCosts / Number(price)) : 0

  return (
    <Cartao titulo="Projeção do evento" descricao="Estime receita, lucro e ponto de equilíbrio">
      <div className="grid grid-cols-2 gap-3">
        <Campo id="proj-ingressos" label="Ingressos vendidos" inputMode="numeric" value={tickets} onChange={e => setTickets(e.target.value)} placeholder="0" />
        <Campo id="proj-capacidade" label="Capacidade" inputMode="numeric" value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="0" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo id="proj-preco" label="Preço médio (R$)" value={price} onChange={e => setPrice(e.target.value)} placeholder="0,00" />
        <Campo id="proj-custos" label="Custos totais (R$)" value={costs} onChange={e => setCosts(e.target.value)} placeholder="0,00" />
      </div>

      {totalRevenue > 0 && (
        <div className="space-y-1 rounded-md border border-border p-3">
          <Linha label="Receita estimada" valor={brl(totalRevenue)} />
          <Linha label="Lucro estimado" valor={<span className={profit < 0 ? 'text-destructive' : undefined}>{brl(profit)}</span>} />
          <Linha label="Margem" valor={pct(profitMargin)} />
          <Linha label="Ocupação" valor={`${occupancy}%`} />
        </div>
      )}

      {breakeven > 0 && (
        <p className="rounded-md border border-border p-3 text-sm text-muted-foreground">
          Ponto de equilíbrio: você precisa vender <strong className="font-semibold text-foreground">{breakeven.toLocaleString('pt-BR')} {breakeven === 1 ? 'ingresso' : 'ingressos'}</strong> para cobrir os custos.
        </p>
      )}
    </Cartao>
  )
}

// ─── Main ───
export default function ProducerCalculator() {
  return (
    <div>
      <PageHeader title="Calculadora de preço" description="Precificação, divisão de conta e projeção do evento" />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <MarkupCalc />
        <SplitCalc />
        <ProjectionCalc />
      </div>
    </div>
  )
}
