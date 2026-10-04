import { useState, useEffect, type ReactNode } from 'react'
import * as I from '@/components/icones/evokaa16'
import { brl } from '../../lib/taxa'
import { precificar, projetar, type Origem } from '../../lib/calculadoras'
import { PageHeader, SectionTitle } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const pct = (n: number | string) => `${String(n).replace('.', ',')}%`

function Cartao({ titulo, descricao, children }: { titulo: string; descricao: string; children: ReactNode }) {
  return (
    <section className="rounded-[10px] border border-border bg-card p-4 sm:p-5">
      <SectionTitle>{titulo}</SectionTitle>
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
// O campo que o produtor digitou por último manda; os outros dois são recalculados a cada tecla.
const fmt = (n: number | null) => (n === null ? '' : String(n))

function MarkupCalc() {
  const [cost, setCost] = useState('')
  const [origem, setOrigem] = useState<Origem>('markup')
  const [digitado, setDigitado] = useState('')

  const r = digitado.trim() === '' ? null : precificar(Number(cost), origem, Number(digitado))
  const mostra = (campo: Origem) => (campo === origem ? digitado : r ? fmt(campo === 'preco' ? r.preco : campo === 'markup' ? r.markup : r.margem) : '')
  const edita = (campo: Origem) => (e: React.ChangeEvent<HTMLInputElement>) => { setOrigem(campo); setDigitado(e.target.value) }

  const reset = () => { setCost(''); setDigitado('') }

  return (
    <Cartao titulo="Precificação" descricao="Calcule markup, margem e preço de venda">
      <Campo id="calc-custo" label="Custo (R$)" min={0} value={cost} onChange={e => setCost(e.target.value)} placeholder="0,00" />
      <div className="grid grid-cols-2 gap-3">
        <Campo id="calc-markup" label="Markup (%)" value={mostra('markup')} onChange={edita('markup')} placeholder="0" />
        <Campo id="calc-margem" label="Margem (%)" value={mostra('margem')} onChange={edita('margem')} placeholder="0" />
      </div>
      <Campo id="calc-preco" label="Preço de venda (R$)" min={0} value={mostra('preco')} onChange={edita('preco')} placeholder="0,00" />

      {r && (
        <div className="space-y-1 rounded-md border border-border p-3">
          <Linha label="Lucro unitário" valor={<span className={r.preco < Number(cost) ? 'text-destructive' : undefined}>{brl(r.preco - Number(cost))}</span>} />
          <Linha label="Markup" valor={pct(r.markup ?? 0)} />
          <Linha label="Margem" valor={r.margem === null ? '—' : pct(r.margem)} />
          {r.preco < Number(cost) && <p className="pt-1 text-xs text-destructive">Venda no prejuízo: o preço está abaixo do custo.</p>}
        </div>
      )}

      <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground hover:text-foreground">
        <I.Restaurar aria-hidden="true" />Limpar
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

  const pCount = Math.min(500, Math.max(2, Math.floor(Number(people)) || 2))
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
        <Campo id="div-pessoas" label="Pessoas" inputMode="numeric" min={2} max={500} step={1} value={people || ''} onChange={e => setPeople(e.target.value)} placeholder="2" />
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
  const [seCobrasse, setSeCobrasse] = useState('')

  const p = projetar(Number(tickets), Number(price), Number(costs), Number(capacity))
  const alt = seCobrasse.trim() === '' ? null : projetar(Number(tickets), Number(seCobrasse), Number(costs), Number(capacity))
  const neg = (n: number) => (n < 0 ? 'text-destructive' : undefined)

  return (
    <Cartao titulo="Projeção do evento" descricao="Estime receita, lucro e ponto de equilíbrio">
      <div className="grid grid-cols-2 gap-3">
        <Campo id="proj-ingressos" label="Ingressos vendidos" inputMode="numeric" min={0} step={1} value={tickets} onChange={e => setTickets(e.target.value)} placeholder="0" />
        <Campo id="proj-capacidade" label="Capacidade" inputMode="numeric" min={0} step={1} value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="0" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo id="proj-preco" label="Preço médio (R$)" min={0} value={price} onChange={e => setPrice(e.target.value)} placeholder="0,00" />
        <Campo id="proj-custos" label="Custos totais (R$)" min={0} value={costs} onChange={e => setCosts(e.target.value)} placeholder="0,00" />
      </div>

      {p.receita > 0 && (
        <div className="space-y-1 rounded-md border border-border p-3">
          <Linha label="Receita estimada" valor={brl(p.receita)} />
          <Linha label="Lucro estimado" valor={<span className={neg(p.lucro)}>{brl(p.lucro)}</span>} />
          <Linha label="Margem" valor={<span className={neg(p.margem)}>{pct(p.margem)}</span>} />
          <Linha label="Ocupação" valor={<span className={p.ocupacao > 100 ? 'text-destructive' : undefined}>{p.ocupacao}%</span>} />
          {p.ocupacao > 100 && <p className="pt-1 text-xs text-destructive">Mais ingressos do que a capacidade.</p>}
        </div>
      )}

      {p.equilibrio > 0 && (
        <p className="rounded-md border border-border p-3 text-sm text-muted-foreground">
          Ponto de equilíbrio: você precisa vender <strong className="font-semibold text-foreground">{p.equilibrio.toLocaleString('pt-BR')} {p.equilibrio === 1 ? 'ingresso' : 'ingressos'}</strong> para cobrir os custos.
          {p.equilibrioAcimaDaCapacidade && <span role="alert" className="mt-1 block font-medium text-destructive">Isso passa da capacidade ({Number(capacity).toLocaleString('pt-BR')}): com esse preço o evento não se paga lotado.</span>}
        </p>
      )}

      <Campo id="proj-se" label="E se eu cobrasse (R$)?" min={0} value={seCobrasse} onChange={e => setSeCobrasse(e.target.value)} placeholder="0,00" />
      {alt && (
        <div className="space-y-1 rounded-md border border-border p-3">
          <Linha label="Receita" valor={brl(alt.receita)} />
          <Linha label="Lucro" valor={<span className={neg(alt.lucro)}>{brl(alt.lucro)}</span>} />
          <Linha label="Margem" valor={<span className={neg(alt.margem)}>{pct(alt.margem)}</span>} />
          <Linha label="Equilíbrio" valor={`${alt.equilibrio.toLocaleString('pt-BR')} ${alt.equilibrio === 1 ? 'ingresso' : 'ingressos'}`} />
        </div>
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
