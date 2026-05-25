import { useState } from 'react'
import { User, Mail, Phone, Calendar, MapPin, Edit3, Save, Star, Ticket, Heart, DollarSign, Shield, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../../hooks/useAuth'
import { useUserTickets } from '../../hooks/useUserTickets'
import { useUserOrders } from '../../hooks/useUserOrders'

export default function ParticipantProfile() {
  const { user } = useAuth()
  const [editing, setEditing] = useState(false)
  const [profile, setProfile] = useState({
    name: user?.name || user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    city: user?.city || '',
    bio: user?.bio || '',
    birthDate: user?.birth_date || '',
  })

  const { data: tickets = [], isLoading: isLoadingTickets } = useUserTickets()
  const { data: orders = [], isLoading: isLoadingOrders } = useUserOrders()

  const activeTickets = tickets.filter(t => t.status === 'active').length
  const totalSpent = orders
    .filter(o => o.status === 'paid')
    .reduce((s, o) => s + o.total_amount, 0)
  const eventCount = new Set(tickets.map(t => t.event_id)).size

  const handleSave = () => {
    toast.success('Perfil salvo!')
    setEditing(false)
  }

  const isLoading = isLoadingTickets || isLoadingOrders

  return (
    <div className="max-w-3xl">
      <h1 className="font-serif text-3xl text-espresso mb-6">Meu Perfil</h1>

      {/* Header Card */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-plum/10 to-plum/5 border border-plum/20 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-plum/20 flex items-center justify-center text-2xl font-serif text-plum">
            {(profile.name || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h2 className="font-serif text-2xl text-espresso">{profile.name || 'Usuario'}</h2>
            <p className="text-xs text-espresso/40">{profile.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-plum/20 text-plum">Plano Gratuito</span>
              <span className="flex items-center gap-1 text-[10px] text-amber-600"><Star className="w-3 h-3 fill-amber-400 text-amber-400" /> 4.8</span>
            </div>
          </div>
          <button onClick={() => { if (editing) { handleSave() } else setEditing(true) }} className="px-4 py-2 bg-white/60 border border-white/60 rounded-full text-xs text-espresso/50 hover:text-plum transition-colors flex items-center gap-1.5">
            {editing ? <><Save className="w-3.5 h-3.5" /> Salvar</> : <><Edit3 className="w-3.5 h-3.5" /> Editar</>}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Eventos', value: isLoading ? '-' : eventCount.toString(), icon: Calendar },
          { label: 'Favoritos', value: '0', icon: Heart },
          { label: 'Ingressos', value: isLoading ? '-' : activeTickets.toString(), icon: Ticket },
          { label: 'Gasto Total', value: isLoading ? '-' : `R$ ${totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign },
        ].map(s => (
          <div key={s.label} className="p-4 rounded-2xl bg-white/60 border border-white/60 text-center">
            <s.icon className="w-4 h-4 text-plum mx-auto mb-1.5" />
            <div className="font-serif text-xl text-espresso">{s.value}</div>
            <div className="text-[10px] text-espresso/40">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Info */}
      <div className="p-6 rounded-2xl bg-white/60 border border-white/60 space-y-4">
        <h3 className="text-sm font-medium text-espresso mb-2">Informacoes Pessoais</h3>
        {[
          { icon: User, label: 'Nome', value: profile.name, key: 'name' },
          { icon: Mail, label: 'Email', value: profile.email, key: 'email' },
          { icon: Phone, label: 'Telefone', value: profile.phone, key: 'phone' },
          { icon: Calendar, label: 'Nascimento', value: profile.birthDate, key: 'birthDate' },
          { icon: MapPin, label: 'Cidade', value: profile.city, key: 'city' },
        ].map(f => (
          <div key={f.key} className="flex items-center gap-3">
            <f.icon className="w-4 h-4 text-espresso/20 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-[10px] text-espresso/30 uppercase">{f.label}</div>
              {editing ? (
                <input value={f.value} onChange={e => setProfile({ ...profile, [f.key]: e.target.value })} className="w-full px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-sm text-espresso focus:outline-none focus:border-plum/30 mt-0.5" />
              ) : (
                <div className="text-sm text-espresso">{f.value || '-'}</div>
              )}
            </div>
          </div>
        ))}
        <div>
          <div className="text-[10px] text-espresso/30 uppercase mb-1">Bio</div>
          {editing ? (
            <textarea value={profile.bio} onChange={e => setProfile({ ...profile, bio: e.target.value })} rows={2} className="w-full px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-sm text-espresso focus:outline-none focus:border-plum/30 resize-none" />
          ) : (
            <div className="text-sm text-espresso/60">{profile.bio || 'Nenhuma bio adicionada.'}</div>
          )}
        </div>
      </div>

      {/* Security */}
      <div className="mt-6 p-6 rounded-2xl bg-white/60 border border-white/60">
        <h3 className="text-sm font-medium text-espresso mb-3 flex items-center gap-2"><Shield className="w-4 h-4 text-plum" /> Seguranca</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-espresso">Senha</div>
              <div className="text-xs text-espresso/30">Altere sua senha periodicamente</div>
            </div>
            <button onClick={() => toast.success('Email de recuperacao enviado!')} className="px-4 py-2 text-xs text-plum hover:bg-plum/10 rounded-full transition-colors">Alterar</button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-espresso">Autenticacao de dois fatores</div>
              <div className="text-xs text-espresso/30">Adicione seguranca extra</div>
            </div>
            <button onClick={() => toast.success('Configuracao iniciada!')} className="px-4 py-2 text-xs text-plum hover:bg-plum/10 rounded-full transition-colors">Ativar</button>
          </div>
        </div>
      </div>
    </div>
  )
}
