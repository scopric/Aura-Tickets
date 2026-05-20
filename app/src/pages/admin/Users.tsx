import { useRef, useEffect } from 'react'
import { Users as UsersIcon, Search, User, MoreHorizontal, Mail, Phone, Calendar, Ban, CheckCircle } from 'lucide-react'
import gsap from 'gsap'

const mockUsers = [
  { id: 'u1', name: 'Ana Carolina Silva', email: 'ana.silva@email.com', phone: '(11) 98765-4321', avatar: 'https://i.pravatar.cc/150?img=5', status: 'active', role: 'Participante', events: 5, joined: '10 Jan 2025', purchases: 12 },
  { id: 'u2', name: 'Bruno Mendes Costa', email: 'bruno.costa@email.com', phone: '(11) 91234-5678', avatar: 'https://i.pravatar.cc/150?img=11', status: 'active', role: 'Participante', events: 3, joined: '15 Fev 2025', purchases: 8 },
  { id: 'u3', name: 'Camila Rocha Oliveira', email: 'camila.rocha@email.com', phone: '(11) 99876-5432', avatar: 'https://i.pravatar.cc/150?img=9', status: 'active', role: 'Participante', events: 8, joined: '22 Dez 2024', purchases: 24 },
  { id: 'u4', name: 'Diego Ferreira Lima', email: 'diego.lima@email.com', phone: '(11) 92345-6789', avatar: 'https://i.pravatar.cc/150?img=3', status: 'inactive', role: 'Participante', events: 1, joined: '05 Mar 2025', purchases: 1 },
  { id: 'u5', name: 'Elisa Nakamura', email: 'elisa.nak@email.com', phone: '(11) 93456-7890', avatar: 'https://i.pravatar.cc/150?img=20', status: 'active', role: 'Participante', events: 10, joined: '01 Nov 2024', purchases: 35 },
  { id: 'u6', name: 'Felipe Souza Andrade', email: 'felipe.sa@email.com', phone: '(11) 94567-8901', avatar: 'https://i.pravatar.cc/150?img=13', status: 'banned', role: 'Participante', events: 0, joined: '08 Mai 2024', purchases: 0 },
]

const statusColors: Record<string, string> = {
  active: 'bg-green-50 text-green-600 border-green-100',
  inactive: 'bg-amber-50 text-amber-600 border-amber-100',
  banned: 'bg-red-50 text-red-500 border-red-100',
}

export default function AdminUsers() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.user-card', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.05, ease: 'power3.out' })
    }, ref)
    return () => ctx.revert()
  }, [])

  const totalActive = mockUsers.filter(u => u.status === 'active').length
  const totalInactive = mockUsers.filter(u => u.status === 'inactive').length
  const totalBanned = mockUsers.filter(u => u.status === 'banned').length

  return (
    <div ref={ref} className="p-6 lg:p-10 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Usuarios</h1>
          <p className="text-sm text-espresso/50 mt-1">Gerencie todos os usuarios da plataforma</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total', value: mockUsers.length.toString(), icon: UsersIcon },
          { label: 'Ativos', value: totalActive.toString(), icon: CheckCircle },
          { label: 'Inativos', value: totalInactive.toString(), icon: User },
          { label: 'Banidos', value: totalBanned.toString(), icon: Ban },
        ].map(k => (
          <div key={k.label} className="user-card p-5 rounded-2xl bg-white/60 border border-white/60">
            <div className="flex items-center justify-between mb-3">
              <k.icon className="w-4 h-4 text-plum" />
            </div>
            <div className="font-serif text-2xl text-espresso">{k.value}</div>
            <div className="text-[10px] text-espresso/40 mt-1 uppercase tracking-wider">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="user-card relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-espresso/20" />
        <input placeholder="Buscar usuarios..." className="w-full pl-10 pr-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
      </div>

      {/* Table */}
      <div className="user-card bg-white/60 border border-white/60 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-espresso/5">
                <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Usuario</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase hidden md:table-cell">Contato</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase hidden lg:table-cell">Ingressos</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase hidden lg:table-cell">Desde</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {mockUsers.map(u => (
                <tr key={u.id} className="border-b border-espresso/3 last:border-0 hover:bg-white/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={u.avatar} alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-canvas" />
                      <div>
                        <div className="text-sm text-espresso font-medium">{u.name}</div>
                        <div className="text-[10px] text-espresso/30">{u.role}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1 text-[11px] text-espresso/40"><Mail className="w-3 h-3" />{u.email}</div>
                      <div className="flex items-center gap-1 text-[11px] text-espresso/40"><Phone className="w-3 h-3" />{u.phone}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="font-serif text-sm text-espresso">{u.purchases}</div>
                    <div className="text-[10px] text-espresso/30">{u.events} eventos</div>
                  </td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${statusColors[u.status]}`}>{u.status === 'active' ? 'Ativo' : u.status === 'inactive' ? 'Inativo' : 'Banido'}</span></td>
                  <td className="px-4 py-3 hidden lg:table-cell"><div className="flex items-center gap-1 text-[11px] text-espresso/30"><Calendar className="w-3 h-3" />{u.joined}</div></td>
                  <td className="px-4 py-3"><button className="p-1.5 rounded-lg hover:bg-canvas text-espresso/20 hover:text-espresso/60 transition-colors"><MoreHorizontal className="w-3.5 h-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
