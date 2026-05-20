import { useState } from 'react'
import {
  Handshake, Building2, Truck, Plus, X, DollarSign, Trash2,
  Phone, Mail, CheckCircle2, Star
} from 'lucide-react'
import { toast } from 'sonner'

interface Partner {
  id: string
  type: 'patrocinador' | 'fornecedor'
  name: string
  contact: string
  email: string
  phone: string
  category: string
  value: number
  status: 'confirmado' | 'pendente' | 'cancelado'
  eventName: string
  notes: string
  contractUrl: string
  deliverables: string
}

const mockPartners: Partner[] = [
  { id: 'p1', type: 'patrocinador', name: 'Red Bull Brasil', contact: 'Ana Marketing', email: 'ana@redbull.com', phone: '(11) 3456-7890', category: 'Bebida/Energia', value: 15000, status: 'confirmado', eventName: 'Noite Eletro 2025', notes: 'Bar exclusivo + branding no palco', contractUrl: '#', deliverables: 'Logo no palco, distribuicao de produtos' },
  { id: 'p2', type: 'fornecedor', name: 'Som & Luz Pro', contact: 'Carlos Tecnico', email: 'carlos@someluz.com', phone: '(11) 2345-6789', category: 'Som e Iluminacao', value: 8500, status: 'confirmado', eventName: 'Noite Eletro 2025', notes: 'PA line array + moving heads', contractUrl: '#', deliverables: 'Setup dia do evento, 2h de teste' },
  { id: 'p3', type: 'fornecedor', name: 'Buffet Gourmet', contact: 'Fernanda Chefe', email: 'fernanda@buffet.com', phone: '(11) 3456-7891', category: 'Alimentacao', value: 5000, status: 'pendente', eventName: 'Noite Eletro 2025', notes: '500 pax, finger food + open bar VIP', contractUrl: '', deliverables: 'Servico completo 4h' },
  { id: 'p4', type: 'patrocinador', name: 'Spotify Brasil', contact: 'Pedro Brand', email: 'pedro@spotify.com', phone: '(11) 4567-8901', category: 'Streaming', value: 25000, status: 'confirmado', eventName: 'Noite Eletro 2025', notes: 'Playlist oficial + influencer kit', contractUrl: '#', deliverables: 'Postagem nos stories, divulgacao do evento' },
  { id: 'p5', type: 'fornecedor', name: 'Decor Festas', contact: 'Maria Decor', email: 'maria@decorfestas.com', phone: '(11) 5678-9012', category: 'Decoracao', value: 3200, status: 'confirmado', eventName: 'Jazz Sunset Session', notes: 'Tema tropical + luz ambiente', contractUrl: '#', deliverables: 'Montagem e desmontagem' },
  { id: 'p6', type: 'fornecedor', name: 'Seguranca Total', contact: 'Roberto Seg', email: 'rob@seguranca.com', phone: '(11) 6789-0123', category: 'Seguranca', value: 4500, status: 'pendente', eventName: 'Noite Eletro 2025', notes: '12 segurancas + controle de acesso', contractUrl: '', deliverables: 'Equipe completa' },
]

const categoryColors: Record<string, string> = {
  'Bebida/Energia': 'bg-red-50 text-red-600',
  'Som e Iluminacao': 'bg-violet-50 text-violet-600',
  'Alimentacao': 'bg-green-50 text-green-600',
  'Streaming': 'bg-blue-50 text-blue-600',
  'Decoracao': 'bg-pink-50 text-pink-600',
  'Seguranca': 'bg-gray-50 text-gray-600',
  'Outro': 'bg-canvas text-espresso/50',
}

export default function ProducerPartners() {
  const [partners, setPartners] = useState<Partner[]>(mockPartners)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type: 'patrocinador' as Partner['type'], name: '', contact: '', email: '', phone: '', category: '', value: '', eventName: '', notes: '', deliverables: '' })
  const [activeTab, setActiveTab] = useState<'all' | 'patrocinador' | 'fornecedor'>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Partner | null>(null)

  const filtered = partners
    .filter(p => activeTab === 'all' || p.type === activeTab)
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))

  const sponsorValue = partners.filter(p => p.type === 'patrocinador').reduce((s, p) => s + p.value, 0)
  const supplierValue = partners.filter(p => p.type === 'fornecedor').reduce((s, p) => s + p.value, 0)
  const confirmed = partners.filter(p => p.status === 'confirmado').length

  const addPartner = () => {
    if (!form.name) { toast.error('Nome obrigatorio'); return }
    const newP: Partner = {
      id: `p${Date.now()}`,
      type: form.type,
      name: form.name,
      contact: form.contact,
      email: form.email,
      phone: form.phone,
      category: form.category || 'Outro',
      value: Number(form.value) || 0,
      status: 'pendente',
      eventName: form.eventName || 'Geral',
      notes: form.notes,
      contractUrl: '',
      deliverables: form.deliverables,
    }
    setPartners([newP, ...partners])
    setForm({ type: 'patrocinador', name: '', contact: '', email: '', phone: '', category: '', value: '', eventName: '', notes: '', deliverables: '' })
    setShowForm(false)
    toast.success(`${form.type === 'patrocinador' ? 'Patrocinador' : 'Fornecedor'} adicionado!`)
  }

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Parceiros</h1>
          <p className="text-sm text-espresso/50 mt-1">Patrocinadores e fornecedores do evento</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-5 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all">
          <Plus className="w-4 h-4" /> Novo Parceiro
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Parceiros', value: partners.length.toString(), icon: Handshake, color: 'text-plum' },
          { label: 'Confirmados', value: confirmed.toString(), icon: CheckCircle2, color: 'text-green-600' },
          { label: 'Receita Patrocinios', value: `R$ ${sponsorValue.toLocaleString()}`, icon: DollarSign, color: 'text-amber-600' },
          { label: 'Custo Fornecedores', value: `R$ ${supplierValue.toLocaleString()}`, icon: Truck, color: 'text-blue-600' },
        ].map(k => (
          <div key={k.label} className="p-5 rounded-2xl bg-white/60 border border-white/60 text-center">
            <k.icon className={`w-5 h-5 ${k.color} mx-auto mb-2`} />
            <div className={`font-serif text-2xl ${k.color}`}>{k.value}</div>
            <div className="text-xs text-espresso/40 mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-1 p-1 bg-white/60 border border-white/60 rounded-2xl">
          {([
            { id: 'all' as const, label: 'Todos', icon: Handshake },
            { id: 'patrocinador' as const, label: 'Patrocinadores', icon: Star },
            { id: 'fornecedor' as const, label: 'Fornecedores', icon: Building2 },
          ]).map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all ${activeTab === t.id ? 'bg-plum text-cream' : 'text-espresso/40 hover:text-espresso/70'}`}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 w-48" />
      </div>

      {/* Table */}
      <div className="bg-white/60 border border-white/60 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-espresso/5">
              <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Parceiro</th>
              <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase hidden lg:table-cell">Categoria</th>
              <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase hidden md:table-cell">Evento</th>
              <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Valor</th>
              <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className="border-b border-espresso/3 last:border-0 hover:bg-white/40 transition-colors cursor-pointer" onClick={() => setSelected(p)}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${p.type === 'patrocinador' ? 'bg-amber-50' : 'bg-blue-50'}`}>
                      {p.type === 'patrocinador' ? <Star className="w-4 h-4 text-amber-600" /> : <Building2 className="w-4 h-4 text-blue-600" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm text-espresso font-medium">{p.name}</div>
                      <div className="text-[10px] text-espresso/30">{p.contact}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${categoryColors[p.category] || 'bg-canvas text-espresso/50'}`}>{p.category}</span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-xs text-espresso/40">{p.eventName}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-sm font-serif font-medium ${p.type === 'patrocinador' ? 'text-green-600' : 'text-red-500'}`}>
                    {p.type === 'patrocinador' ? '+' : '-'}R$ {p.value.toLocaleString()}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                    p.status === 'confirmado' ? 'bg-green-50 text-green-600 border border-green-100' :
                    p.status === 'pendente' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                    'bg-red-50 text-red-400 border border-red-100'
                  }`}>{p.status}</span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={(e) => { e.stopPropagation(); setPartners(partners.filter(x => x.id !== p.id)); toast.success('Removido') }} className="p-1.5 rounded-lg hover:bg-red-50 text-espresso/20 hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-espresso/20 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-md bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-elevated">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-serif text-xl text-espresso">Novo Parceiro</h3>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-full hover:bg-canvas text-espresso/40 hover:text-espresso transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center bg-white/60 border border-white/60 rounded-full p-1">
                <button onClick={() => setForm({ ...form, type: 'patrocinador' })} className={`flex-1 py-2 text-xs font-medium rounded-full transition-all ${form.type === 'patrocinador' ? 'bg-plum text-cream' : 'text-espresso/40'}`}>Patrocinador</button>
                <button onClick={() => setForm({ ...form, type: 'fornecedor' })} className={`flex-1 py-2 text-xs font-medium rounded-full transition-all ${form.type === 'fornecedor' ? 'bg-plum text-cream' : 'text-espresso/40'}`}>Fornecedor</button>
              </div>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nome da empresa *" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              <input value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} placeholder="Nome do contato" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              <div className="grid grid-cols-2 gap-3">
                <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email" className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Telefone" className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Categoria" className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
                <input type="number" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} placeholder="Valor (R$)" className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none" />
              </div>
              <input value={form.eventName} onChange={e => setForm({ ...form, eventName: e.target.value })} placeholder="Evento" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Notas/Observacoes" rows={2} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 resize-none" />
              <textarea value={form.deliverables} onChange={e => setForm({ ...form, deliverables: e.target.value })} placeholder="Entregaveis" rows={2} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 resize-none" />
            </div>
            <div className="flex items-center justify-end gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="px-5 py-2.5 text-sm text-espresso/50 hover:text-espresso transition-colors">Cancelar</button>
              <button onClick={addPartner} className="px-6 py-2.5 bg-plum text-cream text-sm rounded-full hover:shadow-glow transition-all">Adicionar</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-md bg-canvas border-l border-espresso/10 h-full overflow-y-auto shadow-2xl">
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selected.type === 'patrocinador' ? 'bg-amber-50' : 'bg-blue-50'}`}>
                    {selected.type === 'patrocinador' ? <Star className="w-5 h-5 text-amber-600" /> : <Building2 className="w-5 h-5 text-blue-600" />}
                  </div>
                  <div>
                    <h3 className="font-serif text-xl text-espresso">{selected.name}</h3>
                    <span className="text-[10px] text-espresso/30 capitalize">{selected.type} · {selected.category}</span>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="p-2 rounded-full bg-canvas text-espresso/40 hover:text-espresso transition-colors"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-sm text-espresso/50"><Mail className="w-4 h-4 text-espresso/30" />{selected.email}</div>
                <div className="flex items-center gap-2 text-sm text-espresso/50"><Phone className="w-4 h-4 text-espresso/30" />{selected.phone}</div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="p-4 rounded-xl bg-white/60 border border-white/60 text-center">
                  <div className={`font-serif text-xl ${selected.type === 'patrocinador' ? 'text-green-600' : 'text-red-500'}`}>R$ {selected.value.toLocaleString()}</div>
                  <div className="text-[10px] text-espresso/30">{selected.type === 'patrocinador' ? 'Patrocinio' : 'Custo'}</div>
                </div>
                <div className="p-4 rounded-xl bg-white/60 border border-white/60 text-center">
                  <div className={`text-xs font-medium px-2 py-1 rounded-full inline-block mt-1 ${selected.status === 'confirmado' ? 'bg-green-50 text-green-600' : selected.status === 'pendente' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-400'}`}>{selected.status}</div>
                  <div className="text-[10px] text-espresso/30 mt-1">Status</div>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="p-4 rounded-xl bg-white/60 border border-white/60">
                  <div className="text-[10px] text-espresso/30 uppercase mb-1">Notas</div>
                  <div className="text-sm text-espresso/60">{selected.notes}</div>
                </div>
                <div className="p-4 rounded-xl bg-white/60 border border-white/60">
                  <div className="text-[10px] text-espresso/30 uppercase mb-1">Entregaveis</div>
                  <div className="text-sm text-espresso/60">{selected.deliverables}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
