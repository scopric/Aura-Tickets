import { useState, useEffect } from 'react'
import {
  TrendingUp, Users, Percent,
  Copy, Check, Trash2, RotateCcw, Sparkles
} from 'lucide-react'
import { toast } from 'sonner'

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
    <div className="p-6 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-9 h-9 rounded-xl bg-plum/10 flex items-center justify-center"><Percent className="w-4 h-4 text-plum" /></div>
        <div><h3 className="text-sm font-medium text-espresso">Precificacao</h3><p className="text-[10px] text-espresso/30">Calcule markup, margem e preco</p></div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Custo (R$)</label>
          <input type="number" value={cost} onChange={e => setCost(e.target.value)} placeholder="0,00" className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Markup (%)</label>
            <input type="number" value={markup} onChange={e => setMarkup(e.target.value)} onBlur={calcFromMarkup} placeholder="0%" className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
          </div>
          <div>
            <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Margem (%)</label>
            <input type="number" value={margin} onChange={e => setMargin(e.target.value)} onBlur={calcFromMargin} placeholder="0%" className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Preco de Venda (R$)</label>
          <input type="number" value={price} onChange={e => setPrice(e.target.value)} onBlur={calcFromPrice} placeholder="0,00" className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 font-semibold" />
        </div>

        {price && cost && (
          <div className="p-4 rounded-xl bg-green-50 border border-green-100">
            <div className="flex justify-between text-sm mb-1"><span className="text-espresso/50">Lucro unitario</span><span className="text-green-600 font-medium">R$ {(Number(price) - Number(cost)).toFixed(2)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-espresso/50">Markup</span><span className="text-green-600 font-medium">{markup}%</span></div>
            <div className="flex justify-between text-sm"><span className="text-espresso/50">Margem</span><span className="text-green-600 font-medium">{margin}%</span></div>
          </div>
        )}

        <button onClick={reset} className="flex items-center gap-2 text-xs text-espresso/30 hover:text-espresso/60 transition-colors mx-auto">
          <RotateCcw className="w-3 h-3" /> Limpar
        </button>
      </div>
    </div>
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
    <div className="p-6 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-9 h-9 rounded-xl bg-plum/10 flex items-center justify-center"><Users className="w-4 h-4 text-plum" /></div>
        <div><h3 className="text-sm font-medium text-espresso">Divisao de Conta</h3><p className="text-[10px] text-espresso/30">Split entre amigos ou equipe</p></div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Total (R$)</label>
            <input type="number" value={total} onChange={e => setTotal(e.target.value)} placeholder="0,00" className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
          </div>
          <div>
            <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Pessoas</label>
            <input type="number" min={2} value={people || ''} onChange={e => setPeople(e.target.value)} placeholder="2" className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Gorjeta/Taxa (%)</label>
          <div className="flex items-center gap-2">
            {['0', '10', '15', '20'].map(t => (
              <button key={t} onClick={() => setTip(t)} className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${tip === t ? 'bg-plum text-cream' : 'bg-white/40 border border-white/60 text-espresso/50'}`}>
                {t}%
              </button>
            ))}
          </div>
        </div>

        {grandTotal > 0 && (
          <>
            <div className="p-4 rounded-xl bg-plum/5 border border-plum/10 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-espresso/50">Subtotal</span><span className="text-espresso font-medium">R$ {subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-espresso/50">Gorjeta ({tip}%)</span><span className="text-espresso font-medium">R$ {tipAmount.toFixed(2)}</span></div>
              <div className="border-t border-plum/10 pt-2 flex justify-between"><span className="text-sm font-medium text-espresso">Total</span><span className="text-lg font-serif text-plum">R$ {grandTotal.toFixed(2)}</span></div>
              <div className="border-t border-plum/10 pt-2 flex justify-between"><span className="text-sm text-espresso/60">Por pessoa</span><span className="text-sm font-semibold text-plum">R$ {perPerson.toFixed(2)}</span></div>
            </div>

            <div className="space-y-2">
              {names.slice(0, pCount).map((n, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-espresso/40 w-6">{i + 1}</span>
                  <input value={n} onChange={e => { const nn = [...names]; nn[i] = e.target.value; setNames(nn) }} placeholder={`Pessoa ${i + 1}`} className="flex-1 px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
                  <span className="text-xs text-plum font-medium">R$ {perPerson.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
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
    <div className="p-6 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-9 h-9 rounded-xl bg-plum/10 flex items-center justify-center"><TrendingUp className="w-4 h-4 text-plum" /></div>
        <div><h3 className="text-sm font-medium text-espresso">Projecao de Evento</h3><p className="text-[10px] text-espresso/30">Estime receita, lucro e ponto de equilibrio</p></div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Ingressos (vendidos)</label>
            <input type="number" value={tickets} onChange={e => setTickets(e.target.value)} placeholder="0" className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
          </div>
          <div>
            <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Capacidade total</label>
            <input type="number" value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="0" className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Preco medio (R$)</label>
            <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0,00" className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
          </div>
          <div>
            <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Custos totais (R$)</label>
            <input type="number" value={costs} onChange={e => setCosts(e.target.value)} placeholder="0,00" className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
          </div>
        </div>

        {totalRevenue > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-green-50 border border-green-100 text-center">
              <div className="text-[10px] text-espresso/30 mb-1">Receita Estimada</div>
              <div className="text-lg font-serif text-green-600">R$ {totalRevenue.toLocaleString()}</div>
            </div>
            <div className={`p-4 rounded-xl border text-center ${profit >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
              <div className="text-[10px] text-espresso/30 mb-1">Lucro Estimado</div>
              <div className={`text-lg font-serif ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>R$ {profit.toLocaleString()}</div>
            </div>
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 text-center">
              <div className="text-[10px] text-espresso/30 mb-1">Margem</div>
              <div className="text-lg font-serif text-amber-600">{profitMargin}%</div>
            </div>
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 text-center">
              <div className="text-[10px] text-espresso/30 mb-1">Ocupacao</div>
              <div className="text-lg font-serif text-blue-600">{occupancy}%</div>
            </div>
          </div>
        )}

        {breakeven > 0 && (
          <div className="p-4 rounded-xl bg-plum/5 border border-plum/10">
            <div className="flex items-center gap-2 mb-1"><Sparkles className="w-3.5 h-3.5 text-plum" /><span className="text-xs font-medium text-espresso/60">Ponto de Equilibrio</span></div>
            <p className="text-sm text-espresso/70">Voce precisa vender <strong className="text-plum">{breakeven} ingressos</strong> para cobrir os custos.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Saved Results ───
function SavedResults() {
  const [saved, setSaved] = useState<{ id: string; label: string; value: string; date: string }[]>(() => {
    const s = localStorage.getItem('aura_calc_results')
    return s ? JSON.parse(s) : []
  })
  const [copied, setCopied] = useState<string | null>(null)

  const copy = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 1500)
    toast.success('Copiado!')
  }

  const remove = (id: string) => {
    const updated = saved.filter(s => s.id !== id)
    setSaved(updated)
    localStorage.setItem('aura_calc_results', JSON.stringify(updated))
  }

  if (saved.length === 0) return null

  return (
    <div className="p-6 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm">
      <h3 className="text-sm font-medium text-espresso mb-4">Resultados Salvos</h3>
      <div className="space-y-2">
        {saved.map(s => (
          <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-canvas hover:bg-white/40 transition-colors">
            <div>
              <div className="text-xs text-espresso font-medium">{s.label}</div>
              <div className="text-[10px] text-espresso/30">{s.date}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-serif text-plum">{s.value}</span>
              <button onClick={() => copy(s.id, s.value)} className="p-1.5 rounded-lg hover:bg-white text-espresso/20 hover:text-espresso/60 transition-colors">
                {copied === s.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => remove(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-espresso/20 hover:text-red-500 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main ───
export default function ProducerCalculator() {
  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-espresso">Calculadora</h1>
        <p className="text-sm text-espresso/50 mt-1">Ferramentas para precificacao, divisao e projecao</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <MarkupCalc />
        <SplitCalc />
        <ProjectionCalc />
      </div>

      <div className="mt-6">
        <SavedResults />
      </div>
    </div>
  )
}
