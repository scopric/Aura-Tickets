import { useState } from 'react'
import { Plus, X, Trash2, Handshake, TrendingUp, DollarSign, Phone, Mail, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  useProducerPartners,
  useCreatePartner,
  useUpdatePartner,
  useDeletePartner,
  type DbPartner,
} from '../../hooks/useProducerTools'

const partnerTypes = ['Todos', 'Patrocinador', 'Fornecedor']
const statusOptions = ['Todos', 'Confirmado', 'Pendente', 'Cancelado']
const categories = ['Alimentacao', 'Bebidas', 'Audio/Som', 'Iluminacao', 'Decoracao', 'Seguranca', 'Fotografia', 'Marketing', 'Transporte', 'Outros']

const statusColors = {
  confirmado: 'bg-green-50 text-green-600 border-green-100',
  pendente: 'bg-amber-50 text-amber-600 border-amber-100',
  cancelado: 'bg-red-50 text-red-500 border-red-100',
}

export default function ProducerPartners() {
  const { data: partners = [], isLoading } = useProducerPartners()
  const createPartner = useCreatePartner()
  const updatePartner = useUpdatePartner()
  const deletePartner = useDeletePartner()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'patrocinador' as DbPartner['type'], category: 'Alimentacao', contact: '', email: '', phone: '', value: '', eventName: '', notes: '', deliverables: '' })
  const [activeTab, setActiveTab] = useState('Todos')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)

  const filtered = partners
    .filter(p => activeTab === 'Todos' || p.type === activeTab.toLowerCase())
    .filter(p => statusFilter === 'Todos' || p.status === statusFilter.toLowerCase())
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  const totalValue = filtered.reduce((s, p) => s + Number(p.value || 0), 0)
  const confirmedValue = filtered.filter(p => p.status === 'confirmado').reduce((s, p) => s + Number(p.value || 0), 0)

  const addPartner = async () => {
    if (!form.name) return
    try {
      await createPartner.mutateAsync({
        name: form.name,
        type: form.type,
        category: form.category,
        contact: form.contact || null,
        email: form.email || null,
        phone: form.phone || null,
        value: Number(form.value) || 0,
        event_name: form.eventName || null,
        notes: form.notes || null,
        deliverables: form.deliverables || null,
        status: 'pendente',
      })
      setForm({ name: '', type: 'patrocinador', category: 'Alimentacao', contact: '', email: '', phone: '', value: '', eventName: '', notes: '', deliverables: '' })
      setShowForm(false)
      toast.success('Parceiro adicionado!')
    } catch {
      toast.error('Erro ao adicionar parceiro')
    }
  }

  const updateStatus = async (id: string, status: DbPartner['status']) => {
    try {
      await updatePartner.mutateAsync({ id, status })
      toast.success('Status atualizado!')
    } catch {
      toast.error('Erro ao atualizar status')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deletePartner.mutateAsync(id)
      setSelected(null)
      toast.success('Parceiro removido!')
    } catch {
      toast.error('Erro ao remover parceiro')
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 lg:p-10 max-w-5xl mx-auto flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-plum animate-spin mb-4" />
        <p className="text-espresso/60 text-sm">Carregando parceiros...</p>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Parceiros & Patrocinios</h1>
          <p className="text-sm text-espresso/50 mt-1">Gerencie fornecedores e patrocinadores</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-5 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all">
          <Plus className="w-4 h-4" /> Novo Parceiro
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total de Parceiros', value: partners.length, icon: Handshake, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Valor Total', value: `R$ ${totalValue.toLocaleString('pt-BR')}`, icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Confirmado', value: `R$ ${confirmedValue.toLocaleString('pt-BR')}`, icon: TrendingUp, color: 'text-plum', bg: 'bg-plum/10' },
        ].map(s => (
          <div key={s.label} className={`p-4 rounded-2xl ${s.bg} border border-white/60 text-center`}>
            <s.icon className={`w-5 h-5 ${s.color} mx-auto mb-1`} />
            <div className={`font-serif text-xl ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-espresso/40 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-1 p-1 bg-white/60 border border-white/60 rounded-full">
          {partnerTypes.map(type => (
            <button key={type} onClick={() => setActiveTab(type)} className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${activeTab === type ? 'bg-plum text-cream' : 'text-espresso/40 hover:text-espresso/70'}`}>{type}</button>
          ))}
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-white/60 border border-white/60 rounded-full px-3 py-1.5 text-[11px] text-espresso focus:outline-none">
          {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="ml-auto px-4 py-1.5 bg-white/60 border border-white/60 rounded-full text-xs text-espresso focus:outline-none focus:border-plum/30" />
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-md bg-canvas border border-white/60 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-serif text-xl text-espresso">Novo Parceiro</h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-espresso/5 text-espresso/40"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nome da empresa" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as DbPartner['type'] })} className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30">
                  <option value="patrocinador">Patrocinador</option>
                  <option value="fornecedor">Fornecedor</option>
                </select>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30">
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <input value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} placeholder="Nome do contato" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
              <div className="grid grid-cols-2 gap-3">
                <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email" className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Telefone" className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} placeholder="Valor (R$)" type="number" className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                <input value={form.eventName} onChange={e => setForm({ ...form, eventName: e.target.value })} placeholder="Evento" className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
              </div>
              <textarea value={form.deliverables} onChange={e => setForm({ ...form, deliverables: e.target.value })} placeholder="Entregaveis" rows={2} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30 resize-none" />
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Observacoes" rows={2} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30 resize-none" />
              <button onClick={addPartner} disabled={createPartner.isPending} className="w-full py-3 bg-plum text-cream text-sm font-medium rounded-xl hover:shadow-glow transition-all disabled:opacity-50">
                {createPartner.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Adicionar Parceiro'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Partner Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(partner => (
          <div key={partner.id} className={`p-5 rounded-2xl border backdrop-blur-sm transition-all ${selected === partner.id ? 'bg-plum/5 border-plum/20 ring-1 ring-plum/10' : 'bg-white/60 border-white/60 hover:shadow-md'}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-sm font-medium text-espresso">{partner.name}</h3>
                <span className={`inline-block px-2 py-0.5 text-[9px] font-medium rounded-full border mt-1 ${statusColors[partner.status] || statusColors.pendente}`}>{partner.status}</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => updateStatus(partner.id, partner.status === 'confirmado' ? 'pendente' : 'confirmado')} className="p-1.5 rounded-lg text-espresso/10 hover:text-green-600 hover:bg-green-50 transition-colors">
                  <Handshake className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(partner.id)} className="p-1.5 rounded-lg text-espresso/10 hover:text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="space-y-1.5 mb-3">
              {partner.contact && (
                <div className="flex items-center gap-2 text-xs text-espresso/50">
                  <User className="w-3.5 h-3.5" />
                  <span>{partner.contact}</span>
                </div>
              )}
              {partner.email && (
                <div className="flex items-center gap-2 text-xs text-espresso/50">
                  <Mail className="w-3.5 h-3.5" />
                  <span>{partner.email}</span>
                </div>
              )}
              {partner.phone && (
                <div className="flex items-center gap-2 text-xs text-espresso/50">
                  <Phone className="w-3.5 h-3.5" />
                  <span>{partner.phone}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-espresso/5">
              <div className="text-xs">
                <span className="text-espresso/30">Valor</span>
                <div className="font-medium text-espresso">R$ {Number(partner.value || 0).toLocaleString('pt-BR')}</div>
              </div>
              <div className="text-xs text-right">
                <span className="text-espresso/30">Categoria</span>
                <div className="font-medium text-espresso">{partner.category}</div>
              </div>
            </div>

            {partner.notes && (
              <div className="mt-2 p-2 rounded-xl bg-canvas">
                <p className="text-[10px] text-espresso/40"><FileText className="w-3 h-3 inline mr-1" />{partner.notes}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Handshake className="w-12 h-12 text-espresso/10 mx-auto mb-3" />
          <p className="text-sm text-espresso/30">Nenhum parceiro encontrado.</p>
          <p className="text-xs text-espresso/20 mt-1">Adicione seu primeiro fornecedor ou patrocinador.</p>
        </div>
      )}
    </div>
  )
}

function User(props: { className?: string }) {
  return (
    <svg className={props.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}
