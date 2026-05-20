import { useRef, useEffect } from 'react'
import { Calendar, DollarSign, Clock, CheckCircle, ArrowUpRight } from 'lucide-react'
import gsap from 'gsap'
import { events } from '../../data/mockData'

const allEvents = [
  ...events.map(e => ({ ...e, status: 'approved' as const, producer: 'Joao Eventos', revenue: e.tickets.reduce((s, t) => s + t.price * t.sold, 0) })),
  { id: 'pending-1', title: 'Festival de Inverno', date: '20 Jul 2025', location: 'Curitiba, PR', image: '/images/concert-3.jpg', tags: ['Musica', 'Festival'], status: 'pending' as const, producer: 'Pulse Entretenimento', revenue: 0, tickets: [] },
  { id: 'pending-2', title: 'Sunset House Party', date: '05 Ago 2025', location: 'Rio de Janeiro, RJ', image: '/images/event-card-1.jpg', tags: ['House', 'Praia'], status: 'rejected' as const, producer: 'Eko Events', revenue: 0, tickets: [] },
]

const statusCfg: Record<string, { label: string, cls: string }> = {
  approved: { label: 'Aprovado', cls: 'bg-green-50 text-green-600 border-green-100' },
  pending: { label: 'Pendente', cls: 'bg-amber-50 text-amber-600 border-amber-100' },
  rejected: { label: 'Rejeitado', cls: 'bg-red-50 text-red-500 border-red-100' },
}

export default function AdminEvents() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.evt-card', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.05, ease: 'power3.out' })
    }, ref)
    return () => ctx.revert()
  }, [])

  const approved = allEvents.filter(e => e.status === 'approved')
  const pending = allEvents.filter(e => e.status === 'pending')
  const totalRevenue = approved.reduce((s, e) => s + (e as typeof allEvents[0]).revenue, 0)

  return (
    <div ref={ref} className="p-6 lg:p-10 max-w-7xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-espresso">Eventos</h1>
        <p className="text-sm text-espresso/50 mt-1">Gerencie todos os eventos da plataforma</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total', value: allEvents.length.toString(), icon: Calendar },
          { label: 'Ativos', value: approved.length.toString(), icon: CheckCircle },
          { label: 'Pendentes', value: pending.length.toString(), icon: Clock },
          { label: 'Receita', value: `R$ ${(totalRevenue / 1000).toFixed(0)}K`, icon: DollarSign },
        ].map(k => (
          <div key={k.label} className="evt-card p-5 rounded-2xl bg-white/60 border border-white/60">
            <k.icon className="w-4 h-4 text-plum mb-3" />
            <div className="font-serif text-2xl text-espresso">{k.value}</div>
            <div className="text-[10px] text-espresso/40 mt-1 uppercase tracking-wider">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="evt-card bg-white/60 border border-white/60 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-espresso/5">
                <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Evento</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase hidden md:table-cell">Data</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase hidden lg:table-cell">Produtor</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Status</th>
                <th className="text-right px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase hidden lg:table-cell">Receita</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {allEvents.map(e => (
                <tr key={e.id} className="border-b border-espresso/3 last:border-0 hover:bg-white/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0"><img src={e.image} alt="" className="w-full h-full object-cover" /></div>
                      <div>
                        <div className="text-sm text-espresso font-medium">{e.title}</div>
                        <div className="text-[10px] text-espresso/30">{e.location}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell"><div className="text-xs text-espresso/50">{e.date}</div></td>
                  <td className="px-4 py-3 hidden lg:table-cell"><div className="text-xs text-espresso/50">{(e as typeof allEvents[0]).producer}</div></td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${statusCfg[e.status].cls}`}>{statusCfg[e.status].label}</span></td>
                  <td className="px-4 py-3 text-right hidden lg:table-cell"><div className="text-sm font-serif text-espresso">{(e as typeof allEvents[0]).revenue > 0 ? `R$ ${(e as typeof allEvents[0]).revenue.toLocaleString()}` : '-'}</div></td>
                  <td className="px-4 py-3"><button className="p-1.5 rounded-lg hover:bg-canvas text-espresso/20 hover:text-espresso/60 transition-colors"><ArrowUpRight className="w-3.5 h-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
