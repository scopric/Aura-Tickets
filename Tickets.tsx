import { useRef, useEffect } from 'react'
import { Ticket, CheckCircle, QrCode, XCircle, Clock, Users, BarChart3 } from 'lucide-react'
import gsap from 'gsap'
import { events } from '../../data/mockData'

const allTickets = events.flatMap(e =>
  e.tickets.map(t => ({
    id: t.id,
    name: t.name,
    event: e.title,
    price: t.price,
    sold: t.sold,
    capacity: t.capacity,
    type: t.type,
    revenue: t.price * t.sold,
  }))
)

const recentSales = [
  { id: 's1', buyer: 'Ana Carolina', ticket: 'Ingresso VIP', event: 'Noite Eletro 2025', amount: 280, status: 'confirmed' as const, time: '2 min atras' },
  { id: 's2', buyer: 'Bruno Costa', ticket: 'Mesa Coletiva', event: 'Noite Eletro 2025', amount: 160, status: 'confirmed' as const, time: '5 min atras' },
  { id: 's3', buyer: 'Camila Rocha', ticket: 'Ingresso Geral', event: 'Jazz Sunset', amount: 80, status: 'pending' as const, time: '12 min atras' },
  { id: 's4', buyer: 'Diego Lima', ticket: 'Ingresso VIP', event: 'Feira de Arte', amount: 120, status: 'confirmed' as const, time: '18 min atras' },
  { id: 's5', buyer: 'Elisa Nakamura', ticket: 'Mesa Coletiva', event: 'Noite Eletro 2025', amount: 160, status: 'cancelled' as const, time: '25 min atras' },
]

const statusCfg: Record<string, { label: string, cls: string, icon: typeof CheckCircle }> = {
  confirmed: { label: 'Confirmado', cls: 'bg-green-50 text-green-600 border-green-100', icon: CheckCircle },
  pending: { label: 'Pendente', cls: 'bg-amber-50 text-amber-600 border-amber-100', icon: Clock },
  cancelled: { label: 'Cancelado', cls: 'bg-red-50 text-red-500 border-red-100', icon: XCircle },
}

export default function AdminTickets() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.tk-card', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.05, ease: 'power3.out' })
    }, ref)
    return () => ctx.revert()
  }, [])

  const totalSold = allTickets.reduce((s, t) => s + t.sold, 0)
  const totalCapacity = allTickets.reduce((s, t) => s + t.capacity, 0)
  const totalRevenue = allTickets.reduce((s, t) => s + t.revenue, 0)
  const occupancy = Math.round((totalSold / totalCapacity) * 100)

  return (
    <div ref={ref} className="p-6 lg:p-10 max-w-7xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-espresso">Ingressos</h1>
        <p className="text-sm text-espresso/50 mt-1">Controle todos os ingressos vendidos</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Tipos', value: allTickets.length.toString(), icon: Ticket },
          { label: 'Vendidos', value: totalSold.toLocaleString(), icon: Users },
          { label: 'Ocupacao', value: `${occupancy}%`, icon: BarChart3 },
          { label: 'Receita', value: `R$ ${(totalRevenue / 1000).toFixed(0)}K`, icon: QrCode },
        ].map(k => (
          <div key={k.label} className="tk-card p-5 rounded-2xl bg-white/60 border border-white/60">
            <k.icon className="w-4 h-4 text-plum mb-3" />
            <div className="font-serif text-2xl text-espresso">{k.value}</div>
            <div className="text-[10px] text-espresso/40 mt-1 uppercase tracking-wider">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Ticket types */}
      <div className="tk-card mb-6 bg-white/60 border border-white/60 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-espresso/5">
          <h3 className="text-sm font-medium text-espresso">Por Tipo de Ingresso</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-espresso/5">
                <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Ingresso</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase hidden md:table-cell">Evento</th>
                <th className="text-right px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Preco</th>
                <th className="text-right px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Vendidos</th>
                <th className="text-right px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase hidden lg:table-cell">Receita</th>
              </tr>
            </thead>
            <tbody>
              {allTickets.map(t => (
                <tr key={t.id} className="border-b border-espresso/3 last:border-0 hover:bg-white/40 transition-colors">
                  <td className="px-4 py-3"><div className="text-sm text-espresso font-medium">{t.name}</div><div className="text-[10px] text-espresso/30 capitalize">{t.type}</div></td>
                  <td className="px-4 py-3 hidden md:table-cell"><div className="text-xs text-espresso/50">{t.event}</div></td>
                  <td className="px-4 py-3 text-right"><div className="text-sm font-serif text-espresso">R$ {t.price}</div></td>
                  <td className="px-4 py-3 text-right"><div className="text-sm text-espresso">{t.sold} <span className="text-espresso/30">/ {t.capacity}</span></div></td>
                  <td className="px-4 py-3 text-right hidden lg:table-cell"><div className="text-sm font-serif text-espresso">R$ {t.revenue.toLocaleString()}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent sales */}
      <div className="tk-card bg-white/60 border border-white/60 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-espresso/5">
          <h3 className="text-sm font-medium text-espresso">Vendas Recentes</h3>
        </div>
        <div className="divide-y divide-espresso/3">
          {recentSales.map(s => {
            const sc = statusCfg[s.status]
            return (
              <div key={s.id} className="flex items-center gap-4 p-4 hover:bg-white/40 transition-colors">
                <div className="w-9 h-9 rounded-full bg-plum/10 flex items-center justify-center flex-shrink-0">
                  <sc.icon className="w-4 h-4 text-plum" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-espresso font-medium">{s.buyer}</div>
                  <div className="text-[10px] text-espresso/30">{s.ticket} · {s.event} · {s.time}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-medium text-espresso">R$ {s.amount}</div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${sc.cls}`}>{sc.label}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
