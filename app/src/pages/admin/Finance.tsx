import { useRef, useEffect } from 'react'
import { TrendingUp, TrendingDown, CreditCard, ArrowUpRight, ArrowDownRight, Wallet, BarChart3 } from 'lucide-react'
import gsap from 'gsap'

const transactions = [
  { id: 'tx1', desc: 'Ingresso VIP - Noite Eletro', user: 'Ana Carolina', amount: 280, type: 'in' as const, date: '15 Mai 2025, 14:30' },
  { id: 'tx2', desc: 'Mesa Coletiva - Noite Eletro', user: 'Elisa Nakamura', amount: 160, type: 'in' as const, date: '15 Mai 2025, 13:45' },
  { id: 'tx3', desc: 'Saque Produtor - Joao Eventos', user: 'Joao Eventos', amount: 5000, type: 'out' as const, date: '14 Mai 2025, 10:00' },
  { id: 'tx4', desc: 'Ingresso Geral - Jazz Sunset', user: 'Bruno Costa', amount: 80, type: 'in' as const, date: '14 Mai 2025, 09:15' },
  { id: 'tx5', desc: 'Taxa de Plataforma', user: 'Aura', amount: 320, type: 'fee' as const, date: '14 Mai 2025, 00:00' },
  { id: 'tx6', desc: 'Ingresso VIP - Jazz Sunset', user: 'Gabriela Torres', amount: 180, type: 'in' as const, date: '13 Mai 2025, 18:20' },
]

export default function AdminFinance() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.fin-card', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.05, ease: 'power3.out' })
    }, ref)
    return () => ctx.revert()
  }, [])

  const totalIn = transactions.filter(t => t.type === 'in').reduce((s, t) => s + t.amount, 0)
  const totalOut = transactions.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0)
  const totalFees = transactions.filter(t => t.type === 'fee').reduce((s, t) => s + t.amount, 0)
  const balance = totalIn - totalOut - totalFees

  return (
    <div ref={ref} className="p-6 lg:p-10 max-w-7xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-espresso">Financeiro</h1>
        <p className="text-sm text-espresso/50 mt-1">Controle financeiro da plataforma</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Receita Total', value: `R$ ${totalIn.toLocaleString()}`, icon: TrendingUp, change: '+12%' },
          { label: 'Saques', value: `R$ ${totalOut.toLocaleString()}`, icon: TrendingDown, change: '+5%' },
          { label: 'Taxas', value: `R$ ${totalFees.toLocaleString()}`, icon: CreditCard, change: '+8%' },
          { label: 'Saldo', value: `R$ ${balance.toLocaleString()}`, icon: Wallet, change: '' },
        ].map(k => (
          <div key={k.label} className="fin-card p-5 rounded-2xl bg-white/60 border border-white/60">
            <div className="flex items-center justify-between mb-3">
              <k.icon className="w-4 h-4 text-plum" />
              {k.change && <span className="text-[10px] text-green-600">{k.change}</span>}
            </div>
            <div className="font-serif text-2xl text-espresso">{k.value}</div>
            <div className="text-[10px] text-espresso/40 mt-1 uppercase tracking-wider">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Simple chart bars */}
      <div className="fin-card mb-6 p-6 rounded-2xl bg-white/60 border border-white/60">
        <h3 className="text-sm font-medium text-espresso mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-plum" /> Receita Semanal</h3>
        <div className="flex items-end gap-2 h-32">
          {[
            { day: 'Seg', val: 40 },
            { day: 'Ter', val: 65 },
            { day: 'Qua', val: 45 },
            { day: 'Qui', val: 80 },
            { day: 'Sex', val: 95 },
            { day: 'Sab', val: 70 },
            { day: 'Dom', val: 55 },
          ].map(d => (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full bg-plum/10 rounded-lg overflow-hidden relative" style={{ height: '80px' }}>
                <div className="absolute bottom-0 left-0 right-0 bg-plum rounded-lg transition-all duration-700" style={{ height: `${d.val}%` }} />
              </div>
              <span className="text-[10px] text-espresso/30">{d.day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Transactions */}
      <div className="fin-card bg-white/60 border border-white/60 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-espresso/5">
          <h3 className="text-sm font-medium text-espresso">Transacoes Recentes</h3>
        </div>
        <div className="divide-y divide-espresso/3">
          {transactions.map(tx => (
            <div key={tx.id} className="flex items-center gap-4 p-4 hover:bg-white/40 transition-colors">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${tx.type === 'in' ? 'bg-green-50' : tx.type === 'out' ? 'bg-red-50' : 'bg-amber-50'}`}>
                {tx.type === 'in' ? <ArrowUpRight className="w-4 h-4 text-green-600" /> : tx.type === 'out' ? <ArrowDownRight className="w-4 h-4 text-red-500" /> : <CreditCard className="w-4 h-4 text-amber-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-espresso font-medium">{tx.desc}</div>
                <div className="text-[10px] text-espresso/30">{tx.user} · {tx.date}</div>
              </div>
              <div className={`text-sm font-medium ${tx.type === 'in' ? 'text-green-600' : tx.type === 'out' ? 'text-red-500' : 'text-amber-600'}`}>
                {tx.type === 'in' ? '+' : tx.type === 'out' ? '-' : ''}R$ {tx.amount}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
