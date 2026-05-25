import { useRef, useEffect } from 'react'
import { Shield, CheckCircle, XCircle, Clock, Star, Mail, Phone, Calendar, ArrowUpRight } from 'lucide-react'
import gsap from 'gsap'

const mockProducers = [
  { id: 'p1', name: 'Joao Eventos', email: 'joao@eventos.com', phone: '(11) 98765-0001', avatar: 'https://i.pravatar.cc/150?img=60', status: 'approved', rating: 4.8, events: 12, revenue: 145000, joined: '15 Mar 2024' },
  { id: 'p2', name: 'Maria Producoes', email: 'maria@prod.com', phone: '(11) 98765-0002', avatar: 'https://i.pravatar.cc/150?img=44', status: 'approved', rating: 4.9, events: 8, revenue: 89000, joined: '22 Jan 2024' },
  { id: 'p3', name: 'Pulse Entretenimento', email: 'contato@pulse.com', phone: '(11) 98765-0003', avatar: 'https://i.pravatar.cc/150?img=33', status: 'pending', rating: 0, events: 0, revenue: 0, joined: '10 Mai 2025' },
  { id: 'p4', name: 'Nexus Festas', email: 'nexus@festas.com', phone: '(11) 98765-0004', avatar: 'https://i.pravatar.cc/150?img=68', status: 'approved', rating: 4.5, events: 5, revenue: 45000, joined: '03 Fev 2024' },
  { id: 'p5', name: 'Eko Events', email: 'eko@events.com', phone: '(11) 98765-0005', avatar: 'https://i.pravatar.cc/150?img=12', status: 'rejected', rating: 0, events: 0, revenue: 0, joined: '18 Abr 2025' },
]

const statusConfig: Record<string, { label: string, cls: string, icon: typeof CheckCircle }> = {
  approved: { label: 'Aprovado', cls: 'bg-green-50 text-green-600 border-green-100', icon: CheckCircle },
  pending: { label: 'Pendente', cls: 'bg-amber-50 text-amber-600 border-amber-100', icon: Clock },
  rejected: { label: 'Rejeitado', cls: 'bg-red-50 text-red-500 border-red-100', icon: XCircle },
}

export default function AdminProducers() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.prod-card', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.05, ease: 'power3.out' })
    }, ref)
    return () => ctx.revert()
  }, [])

  const producers = import.meta.env.DEV ? mockProducers : []
  const approved = producers.filter(p => p.status === 'approved')
  const pending = producers.filter(p => p.status === 'pending')
  const totalRevenue = producers.reduce((s, p) => s + p.revenue, 0)

  return (
    <div ref={ref} className="p-6 lg:p-10 max-w-7xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-espresso">Produtores</h1>
        <p className="text-sm text-espresso/50 mt-1">Gerencie produtores e aprovacoes</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total', value: producers.length.toString(), icon: Shield },
          { label: 'Aprovados', value: approved.length.toString(), icon: CheckCircle },
          { label: 'Pendentes', value: pending.length.toString(), icon: Clock },
          { label: 'Receita Total', value: `R$ ${(totalRevenue / 1000).toFixed(0)}K`, icon: Star },
        ].map(k => (
          <div key={k.label} className="prod-card p-5 rounded-2xl bg-white/60 border border-white/60">
            <k.icon className="w-4 h-4 text-plum mb-3" />
            <div className="font-serif text-2xl text-espresso">{k.value}</div>
            <div className="text-[10px] text-espresso/40 mt-1 uppercase tracking-wider">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Pending approvals */}
      {pending.length > 0 && (
        <div className="prod-card mb-6 p-6 rounded-2xl bg-amber-50/50 border border-amber-100">
          <h3 className="text-sm font-medium text-espresso mb-4 flex items-center gap-2"><Clock className="w-4 h-4 text-amber-500" /> Aprovacoes Pendentes ({pending.length})</h3>
          <div className="space-y-3">
            {pending.map(p => (
              <div key={p.id} className="flex items-center justify-between p-4 rounded-xl bg-white/60 border border-white/60">
                <div className="flex items-center gap-3">
                  <img src={p.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                  <div>
                    <div className="text-sm font-medium text-espresso">{p.name}</div>
                    <div className="text-[10px] text-espresso/40">{p.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="px-4 py-2 bg-green-500 text-white text-xs font-medium rounded-full hover:bg-green-600 transition-colors">Aprovar</button>
                  <button className="px-4 py-2 bg-red-500 text-white text-xs font-medium rounded-full hover:bg-red-600 transition-colors">Rejeitar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All producers */}
      <div className="prod-card bg-white/60 border border-white/60 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-espresso/5">
                <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Produtor</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase hidden md:table-cell">Contato</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase hidden lg:table-cell">Eventos</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase hidden lg:table-cell">Desde</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {producers.map(p => {
                const sc = statusConfig[p.status]
                return (
                  <tr key={p.id} className="border-b border-espresso/3 last:border-0 hover:bg-white/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img src={p.avatar} alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-canvas" />
                        <div>
                          <div className="text-sm text-espresso font-medium">{p.name}</div>
                          {p.rating > 0 && <div className="flex items-center gap-1 text-[10px] text-amber-500"><Star className="w-3 h-3 fill-amber-500" />{p.rating}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1 text-[11px] text-espresso/40"><Mail className="w-3 h-3" />{p.email}</div>
                        <div className="flex items-center gap-1 text-[11px] text-espresso/40"><Phone className="w-3 h-3" />{p.phone}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="font-serif text-sm text-espresso">{p.events}</div>
                      <div className="text-[10px] text-espresso/30">{p.revenue > 0 ? `R$ ${(p.revenue / 1000).toFixed(0)}K` : '-'}</div>
                    </td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${sc.cls}`}>{sc.label}</span></td>
                    <td className="px-4 py-3 hidden lg:table-cell"><div className="flex items-center gap-1 text-[11px] text-espresso/30"><Calendar className="w-3 h-3" />{p.joined}</div></td>
                    <td className="px-4 py-3"><button className="p-1.5 rounded-lg hover:bg-canvas text-espresso/20 hover:text-espresso/60 transition-colors"><ArrowUpRight className="w-3.5 h-3.5" /></button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
