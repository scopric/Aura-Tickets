import { useRef, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, DollarSign, CheckCircle2, Clock, Calendar, TrendingUp, TrendingDown, Wallet, Briefcase, Phone, Star, Plus, X, Trash2, Save, Edit3, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import gsap from 'gsap'
import { managedEvents } from '../../data/eventManagerData'
import type { EventBudget, EventVendor, EventTask, EventTimeline, EventTeam, ManagedEvent, EventCashFlow } from '../../data/eventManagerData'

type Tab = 'dashboard' | 'orcamento' | 'fornecedores' | 'checklist' | 'cronograma' | 'equipe' | 'fluxo' | 'info'

export default function EventFolder() {
  const { eventId } = useParams()
  const ref = useRef<HTMLDivElement>(null)
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [event, setEvent] = useState<ManagedEvent | null>(null)
  const [editingInfo, setEditingInfo] = useState(false)
  const [eventInfo, setEventInfo] = useState({ title: '', date: '', time: '', location: '', capacity: 0 })

  useEffect(() => {
    const found = import.meta.env.DEV ? managedEvents.find(e => e.id === eventId) : undefined
    if (found) {
      setEvent({ ...found })
      setEventInfo({ title: found.title, date: found.date, time: found.time, location: found.location, capacity: found.capacity })
    }
  }, [eventId])

  useEffect(() => {
    if (!ref.current) return
    gsap.fromTo('.folder-content', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out' })
  }, [activeTab])

  const saveInfo = () => {
    if (event) {
      setEvent({ ...event, title: eventInfo.title, date: eventInfo.date, time: eventInfo.time, location: eventInfo.location, capacity: eventInfo.capacity })
      setEditingInfo(false)
      toast.success('Informacoes atualizadas!')
    }
  }

  if (!event) {
    return (
      <div className="p-10 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl font-serif text-espresso/10 mb-2">?</div>
          <p className="text-espresso/30">Evento nao encontrado</p>
          <Link to="/producer/event-manager" className="text-plum text-sm hover:underline mt-2 inline-block">Voltar</Link>
        </div>
      </div>
    )
  }

  const totalRev = event.ticketRevenue + event.foodRevenue + event.merchRevenue
  const totalEst = event.budget.reduce((s, b) => s + b.estimated, 0)
  const totalAct = event.budget.reduce((s, b) => s + b.actual, 0)
  const totalPaid = event.budget.reduce((s, b) => s + b.paid, 0)
  const profit = totalRev - totalAct
  const breakEven = totalAct > 0 ? Math.ceil(totalAct / (event.ticketRevenue / event.sold || 1)) : 0
  const progress = Math.round((event.sold / event.capacity) * 100)
  const tasksDone = event.tasks.filter(t => t.status === 'done').length

  const tabs: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'info', label: 'Editar' },
    { id: 'orcamento', label: 'Orcamento' },
    { id: 'fornecedores', label: 'Fornecedores' },
    { id: 'checklist', label: 'Checklist' },
    { id: 'cronograma', label: 'Cronograma' },
    { id: 'equipe', label: 'Equipe' },
    { id: 'fluxo', label: 'Fluxo de Caixa' },
  ]

  return (
    <div ref={ref} className="p-6 lg:p-10 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <Link to="/producer/event-manager" className="inline-flex items-center gap-1 text-xs text-espresso/40 hover:text-plum transition-colors mb-4">
          <ArrowLeft className="w-3 h-3" /> Gestor de Festas
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-serif text-3xl text-espresso">{event.title}</h1>
            <div className="flex items-center gap-4 mt-2 text-xs text-espresso/40">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{event.date} · {event.time}</span>
              <span>{event.location}</span>
              <span className="px-2 py-0.5 rounded-full bg-plum/10 text-plum text-[10px] font-medium capitalize">{event.profile}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${event.status === 'selling' ? 'bg-green-50 text-green-600 border-green-100' : event.status === 'planning' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{event.status === 'selling' ? 'Vendendo' : event.status === 'planning' ? 'Planejando' : event.status === 'ready' ? 'Pronto' : 'Finalizado'}</span>
            </div>
          </div>
          <div className="text-right hidden lg:block">
            <div className={`font-serif text-2xl ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>R$ {profit.toLocaleString()}</div>
            <div className="text-[10px] text-espresso/30">Lucro estimado</div>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-espresso/30">Capacidade: {event.sold} / {event.capacity}</span>
            <span className="text-xs text-espresso/50">{progress}%</span>
          </div>
          <div className="w-full h-2 bg-canvas rounded-full overflow-hidden">
            <div className="h-full bg-plum rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-2">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-4 py-2 text-xs font-medium rounded-full whitespace-nowrap transition-all ${activeTab === t.id ? 'bg-plum text-cream' : 'text-espresso/40 hover:text-espresso hover:bg-white/40'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="folder-content">
        {activeTab === 'dashboard' && <DashboardTab event={event} totalRev={totalRev} totalAct={totalAct} profit={profit} breakEven={breakEven} tasksDone={tasksDone} />}
        {activeTab === 'info' && <EditInfoTab eventInfo={eventInfo} setEventInfo={setEventInfo} editing={editingInfo} setEditing={setEditingInfo} onSave={saveInfo} />}
        {activeTab === 'orcamento' && <OrcamentoTab budget={event.budget} setEvent={setEvent} totalEst={totalEst} totalAct={totalAct} totalPaid={totalPaid} />}
        {activeTab === 'fornecedores' && <FornecedoresTab vendors={event.vendors} setEvent={setEvent} />}
        {activeTab === 'checklist' && <ChecklistTab tasks={event.tasks} setEvent={setEvent} />}
        {activeTab === 'cronograma' && <CronogramaTab timeline={event.timeline} setEvent={setEvent} />}
        {activeTab === 'equipe' && <EquipeTab team={event.team} setEvent={setEvent} />}
        {activeTab === 'fluxo' && <FluxoTab cashFlow={event.cashFlow} setEvent={setEvent} />}
      </div>
    </div>
  )
}

/* ─── Edit Info Tab ─── */
function EditInfoTab({ eventInfo, setEventInfo, editing, setEditing, onSave }: any) {
  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-espresso">Editar Evento</h2>
        {!editing ? (
          <button onClick={() => setEditing(true)} className="px-3 py-1.5 bg-plum text-cream text-xs rounded-full hover:shadow-glow transition-all flex items-center gap-1"><Edit3 className="w-3 h-3" /> Editar</button>
        ) : (
          <div className="flex gap-2">
            <button onClick={onSave} className="px-3 py-1.5 bg-green-500 text-white text-xs rounded-full hover:shadow-lg transition-all flex items-center gap-1"><Save className="w-3 h-3" /> Salvar</button>
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 bg-white/60 border border-white/60 text-espresso text-xs rounded-full"><X className="w-3 h-3" /></button>
          </div>
        )}
      </div>
      <div className="space-y-4">
        {[
          { label: 'Nome do Evento', key: 'title', type: 'text' },
          { label: 'Data', key: 'date', type: 'date' },
          { label: 'Horario', key: 'time', type: 'time' },
          { label: 'Local', key: 'location', type: 'text' },
          { label: 'Capacidade', key: 'capacity', type: 'number' },
        ].map(field => (
          <div key={field.key}>
            <label className="text-xs text-espresso/40 mb-1 block">{field.label}</label>
            {editing ? (
              <input type={field.type} value={eventInfo[field.key]} onChange={e => setEventInfo({ ...eventInfo, [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
            ) : (
              <div className="px-4 py-2.5 bg-canvas rounded-xl text-sm text-espresso">{eventInfo[field.key] || '-'}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Dashboard Tab ─── */
function DashboardTab({ event, totalRev, totalAct, profit, breakEven, tasksDone }: { event: ManagedEvent; totalRev: number; totalAct: number; profit: number; breakEven: number; tasksDone: number }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Receita Total', value: `R$ ${(totalRev / 1000).toFixed(1)}K`, icon: DollarSign, color: 'text-espresso' },
          { label: 'Custo Total', value: `R$ ${(totalAct / 1000).toFixed(1)}K`, icon: TrendingDown, color: 'text-red-500' },
          { label: 'Lucro', value: `R$ ${(profit / 1000).toFixed(1)}K`, icon: TrendingUp, color: profit >= 0 ? 'text-green-600' : 'text-red-500' },
          { label: 'Break-even', value: `${breakEven} ingressos`, icon: Wallet, color: 'text-plum' },
        ].map(k => (
          <div key={k.label} className="p-5 rounded-2xl bg-white/60 border border-white/60">
            <k.icon className={`w-4 h-4 mb-3 ${k.color}`} />
            <div className={`font-serif text-2xl ${k.color}`}>{k.value}</div>
            <div className="text-[10px] text-espresso/30 mt-1 uppercase tracking-wider">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-white/60 border border-white/60">
          <h3 className="text-sm font-medium text-espresso mb-4">Receita por Fonte</h3>
          <div className="space-y-3">
            {[
              { label: 'Ingressos', value: event.ticketRevenue, color: '#7a3b69' },
              { label: 'Alimentacao', value: event.foodRevenue, color: '#22c55e' },
              { label: 'Merchandise', value: event.merchRevenue, color: '#3b82f6' },
            ].map(item => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-espresso/50">{item.label}</span>
                  <span className="text-xs text-espresso">R$ {item.value.toLocaleString()}</span>
                </div>
                <div className="w-full h-3 bg-canvas rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${totalRev > 0 ? (item.value / totalRev) * 100 : 0}%`, backgroundColor: item.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-white/60 border border-white/60 space-y-4">
          <h3 className="text-sm font-medium text-espresso">Status Rapido</h3>
          {[
            { label: 'Vendas', current: event.sold, total: event.capacity, unit: 'ingressos' },
            { label: 'Checklist', current: tasksDone, total: event.tasks.length, unit: 'tarefas' },
            { label: 'Fornecedores', current: event.vendors.filter(v => v.status === 'confirmed').length, total: event.vendors.length, unit: 'confirmados' },
            { label: 'Equipe', current: event.team.filter(t => t.status === 'confirmed').length, total: event.team.length, unit: 'confirmados' },
          ].map(s => (
            <div key={s.label} className="flex items-center justify-between">
              <span className="text-xs text-espresso/50">{s.label}</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 bg-canvas rounded-full overflow-hidden">
                  <div className="h-full bg-plum rounded-full" style={{ width: `${(s.current / s.total) * 100}%` }} />
                </div>
                <span className="text-xs text-espresso">{s.current}/{s.total} {s.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Orcamento Tab ─── */
function OrcamentoTab({ budget, setEvent, totalEst, totalAct, totalPaid }: { budget: EventBudget[]; setEvent: any; totalEst: number; totalAct: number; totalPaid: number }) {
  const [items, setItems] = useState(budget)
  const [showAdd, setShowAdd] = useState(false)
  const [newItem, setNewItem] = useState({ category: '', item: '', estimated: '', actual: '0', paid: '0' })
  const [editingId, setEditingId] = useState<string | null>(null)

  const variance = totalAct - totalEst
  const remaining = totalEst - totalPaid

  const handleAdd = () => {
    if (!newItem.category || !newItem.item) { toast.error('Preencha categoria e item'); return }
    const item: EventBudget = { id: `b${Date.now()}`, category: newItem.category, item: newItem.item, estimated: Number(newItem.estimated) || 0, actual: Number(newItem.actual) || 0, paid: Number(newItem.paid) || 0, status: 'pending' }
    const updated = [...items, item]
    setItems(updated)
    setEvent((prev: any) => ({ ...prev, budget: updated }))
    setNewItem({ category: '', item: '', estimated: '', actual: '0', paid: '0' })
    setShowAdd(false)
    toast.success('Item adicionado!')
  }

  const handleDelete = (id: string) => {
    const updated = items.filter(i => i.id !== id)
    setItems(updated)
    setEvent((prev: any) => ({ ...prev, budget: updated }))
    toast.success('Item removido')
  }

  const handleEdit = (id: string, field: keyof EventBudget, value: string | number) => {
    const updated = items.map(i => i.id === id ? { ...i, [field]: value } : i)
    setItems(updated)
    setEvent((prev: any) => ({ ...prev, budget: updated }))
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Orcado', value: `R$ ${totalEst.toLocaleString()}`, color: 'text-espresso' },
          { label: 'Realizado', value: `R$ ${totalAct.toLocaleString()}`, color: 'text-amber-600' },
          { label: 'Pago', value: `R$ ${totalPaid.toLocaleString()}`, color: 'text-green-600' },
          { label: 'Restante', value: `R$ ${Math.max(0, remaining).toLocaleString()}`, color: remaining >= 0 ? 'text-plum' : 'text-red-500' },
        ].map(k => (
          <div key={k.label} className="p-5 rounded-2xl bg-white/60 border border-white/60">
            <div className={`font-serif text-xl ${k.color}`}>{k.value}</div>
            <div className="text-[10px] text-espresso/30 mt-1 uppercase tracking-wider">{k.label}</div>
          </div>
        ))}
      </div>

      {variance !== 0 && (
        <div className={`p-4 rounded-xl ${variance > 0 ? 'bg-red-50 border border-red-100' : 'bg-green-50 border border-green-100'}`}>
          <p className={`text-xs ${variance > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {variance > 0 ? `Estourando o orcamento em R$ ${variance.toLocaleString()}` : `Economia de R$ ${Math.abs(variance).toLocaleString()}`}
          </p>
        </div>
      )}

      <div className="bg-white/60 border border-white/60 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-espresso/5 flex items-center justify-between">
          <h3 className="text-sm font-medium text-espresso">Itens do Orcamento</h3>
          <button onClick={() => setShowAdd(!showAdd)} className="px-3 py-1.5 bg-plum text-cream text-xs rounded-full hover:shadow-glow transition-all flex items-center gap-1"><Plus className="w-3 h-3" /> Adicionar</button>
        </div>

        {showAdd && (
          <div className="p-4 border-b border-espresso/5 bg-canvas/50 space-y-2">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
              <input value={newItem.category} onChange={e => setNewItem({ ...newItem, category: e.target.value })} placeholder="Categoria" className="px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              <input value={newItem.item} onChange={e => setNewItem({ ...newItem, item: e.target.value })} placeholder="Item" className="px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              <input value={newItem.estimated} onChange={e => setNewItem({ ...newItem, estimated: e.target.value })} placeholder="Orcado" type="number" className="px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              <input value={newItem.actual} onChange={e => setNewItem({ ...newItem, actual: e.target.value })} placeholder="Real" type="number" className="px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              <div className="flex gap-1">
                <button onClick={handleAdd} className="flex-1 py-2 bg-plum text-cream text-xs rounded-lg hover:shadow-glow transition-all flex items-center justify-center gap-1"><Save className="w-3 h-3" /> Salvar</button>
                <button onClick={() => setShowAdd(false)} className="px-2 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso/40"><X className="w-3 h-3" /></button>
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-espresso/5">
                <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Categoria</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Item</th>
                <th className="text-right px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase hidden md:table-cell">Orcado</th>
                <th className="text-right px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase hidden md:table-cell">Real</th>
                <th className="text-right px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase hidden md:table-cell">Pago</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className="border-b border-espresso/3 last:border-0 hover:bg-white/40 transition-colors">
                  <td className="px-4 py-3">
                    {editingId === item.id ? (
                      <input value={item.category} onChange={e => handleEdit(item.id, 'category', e.target.value)} className="w-full px-2 py-1 bg-white/60 border border-white/60 rounded text-xs text-espresso focus:outline-none focus:border-plum/30" />
                    ) : (
                      <span className="text-xs text-espresso font-medium">{item.category}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === item.id ? (
                      <input value={item.item} onChange={e => handleEdit(item.id, 'item', e.target.value)} className="w-full px-2 py-1 bg-white/60 border border-white/60 rounded text-xs text-espresso focus:outline-none focus:border-plum/30" />
                    ) : (
                      <span className="text-xs text-espresso/70">{item.item}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-espresso hidden md:table-cell">R$ {item.estimated.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-xs text-amber-600 hidden md:table-cell">
                    {editingId === item.id ? (
                      <input type="number" value={item.actual} onChange={e => handleEdit(item.id, 'actual', Number(e.target.value))} className="w-20 px-2 py-1 bg-white/60 border border-white/60 rounded text-xs text-right focus:outline-none focus:border-plum/30" />
                    ) : `R$ ${item.actual.toLocaleString()}`}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-green-600 hidden md:table-cell">
                    {editingId === item.id ? (
                      <input type="number" value={item.paid} onChange={e => handleEdit(item.id, 'paid', Number(e.target.value))} className="w-20 px-2 py-1 bg-white/60 border border-white/60 rounded text-xs text-right focus:outline-none focus:border-plum/30" />
                    ) : `R$ ${item.paid.toLocaleString()}`}
                  </td>
                  <td className="px-4 py-3">
                    <select value={item.status} onChange={e => handleEdit(item.id, 'status', e.target.value)} className="px-2 py-0.5 text-[10px] font-medium rounded-full border bg-transparent">
                      <option value="pending">Pendente</option>
                      <option value="paid">Pago</option>
                      <option value="overdue">Atrasado</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditingId(editingId === item.id ? null : item.id)} className="p-1 rounded hover:bg-plum/10 text-espresso/20 hover:text-plum transition-colors"><Pencil className="w-3 h-3" /></button>
                      <button onClick={() => handleDelete(item.id)} className="p-1 rounded hover:bg-red-50 text-espresso/10 hover:text-red-500 transition-colors"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ─── Fornecedores Tab ─── */
function FornecedoresTab({ vendors, setEvent }: { vendors: EventVendor[]; setEvent: any }) {
  const [items, setItems] = useState(vendors)
  const [showAdd, setShowAdd] = useState(false)
  const [newV, setNewV] = useState({ name: '', category: '', contact: '', email: '', price: '', notes: '' })

  const statusCfg: Record<string, { label: string; cls: string }> = {
    confirmed: { label: 'Confirmado', cls: 'bg-green-50 text-green-600 border-green-100' },
    negotiating: { label: 'Negociando', cls: 'bg-amber-50 text-amber-600 border-amber-100' },
    contacted: { label: 'Contactado', cls: 'bg-blue-50 text-blue-600 border-blue-100' },
    cancelled: { label: 'Cancelado', cls: 'bg-red-50 text-red-500 border-red-100' },
  }

  const handleAdd = () => {
    if (!newV.name) { toast.error('Nome obrigatorio'); return }
    const v: EventVendor = { id: `v${Date.now()}`, name: newV.name, category: newV.category || 'Outros', contact: newV.contact, email: newV.email, price: Number(newV.price) || 0, status: 'contacted' as const, rating: 0, notes: newV.notes }
    const updated = [...items, v]
    setItems(updated)
    setEvent((prev: any) => ({ ...prev, vendors: updated }))
    setNewV({ name: '', category: '', contact: '', email: '', price: '', notes: '' })
    setShowAdd(false)
    toast.success('Fornecedor adicionado!')
  }

  const updateStatus = (id: string, status: string) => {
    const updated = items.map(v => v.id === id ? { ...v, status: status as EventVendor['status'] } : v)
    setItems(updated)
    setEvent((prev: any) => ({ ...prev, vendors: updated }))
  }

  const remove = (id: string) => {
    const updated = items.filter(v => v.id !== id)
    setItems(updated)
    setEvent((prev: any) => ({ ...prev, vendors: updated }))
    toast.success('Removido')
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowAdd(!showAdd)} className="px-3 py-1.5 bg-plum text-cream text-xs rounded-full hover:shadow-glow transition-all flex items-center gap-1"><Plus className="w-3 h-3" /> Fornecedor</button>
      </div>

      {showAdd && (
        <div className="p-4 rounded-xl bg-canvas/50 space-y-2">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            <input value={newV.name} onChange={e => setNewV({ ...newV, name: e.target.value })} placeholder="Nome" className="px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
            <input value={newV.category} onChange={e => setNewV({ ...newV, category: e.target.value })} placeholder="Categoria" className="px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
            <input value={newV.contact} onChange={e => setNewV({ ...newV, contact: e.target.value })} placeholder="Telefone" className="px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
            <input value={newV.email} onChange={e => setNewV({ ...newV, email: e.target.value })} placeholder="E-mail" className="px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
            <input value={newV.price} onChange={e => setNewV({ ...newV, price: e.target.value })} placeholder="Preco (R$)" type="number" className="px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
            <div className="flex gap-1">
              <button onClick={handleAdd} className="flex-1 py-2 bg-plum text-cream text-xs rounded-lg hover:shadow-glow transition-all"><Save className="w-3 h-3 inline mr-1" />Salvar</button>
              <button onClick={() => setShowAdd(false)} className="px-2 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso/40"><X className="w-3 h-3" /></button>
            </div>
          </div>
          <input value={newV.notes} onChange={e => setNewV({ ...newV, notes: e.target.value })} placeholder="Notas" className="w-full px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(v => (
          <div key={v.id} className="p-5 rounded-2xl bg-white/60 border border-white/60 hover:shadow-elevated transition-all">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-sm font-medium text-espresso">{v.name}</div>
                <div className="text-[10px] text-espresso/30">{v.category}</div>
              </div>
              <div className="flex items-center gap-1">
                <select value={v.status} onChange={e => updateStatus(v.id, e.target.value)} className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${statusCfg[v.status].cls} bg-transparent`}>
                  <option value="contacted">Contactado</option>
                  <option value="negotiating">Negociando</option>
                  <option value="confirmed">Confirmado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
                <button onClick={() => remove(v.id)} className="p-1 rounded hover:bg-red-50 text-espresso/10 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
              </div>
            </div>
            <div className="space-y-1.5 mb-3">
              <div className="flex items-center gap-1.5 text-[11px] text-espresso/40"><Phone className="w-3 h-3" />{v.contact || '-'}</div>
              <div className="flex items-center gap-1.5 text-[11px] text-espresso/40"><Briefcase className="w-3 h-3" />{v.email || '-'}</div>
              {v.rating > 0 && <div className="flex items-center gap-1 text-[10px] text-amber-500"><Star className="w-3 h-3 fill-amber-500" />{v.rating}</div>}
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-espresso/5">
              <div className="font-serif text-sm text-espresso">R$ {v.price.toLocaleString()}</div>
              <div className="text-[10px] text-espresso/30">{v.notes}</div>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="col-span-full text-center py-12">
            <Briefcase className="w-8 h-8 text-espresso/10 mx-auto mb-2" />
            <p className="text-xs text-espresso/30">Nenhum fornecedor</p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Checklist Tab ─── */
function ChecklistTab({ tasks, setEvent }: { tasks: EventTask[]; setEvent: any }) {
  const [items, setItems] = useState(tasks)
  const [showAdd, setShowAdd] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', category: '', deadline: '', priority: 'medium' as const })

  const toggleStatus = (id: string) => {
    const updated = items.map(t => {
      if (t.id !== id) return t
      const order: Record<string, string> = { todo: 'doing', doing: 'done', done: 'todo' }
      return { ...t, status: order[t.status] as EventTask['status'] }
    })
    setItems(updated)
    setEvent((prev: any) => ({ ...prev, tasks: updated }))
  }

  const handleAdd = () => {
    if (!newTask.title) { toast.error('Digite o titulo'); return }
    const task: EventTask = { id: `t${Date.now()}`, title: newTask.title, category: newTask.category || 'Geral', deadline: newTask.deadline, status: 'todo', priority: newTask.priority }
    const updated = [...items, task]
    setItems(updated)
    setEvent((prev: any) => ({ ...prev, tasks: updated }))
    setNewTask({ title: '', category: '', deadline: '', priority: 'medium' })
    setShowAdd(false)
    toast.success('Tarefa adicionada!')
  }

  const removeTask = (id: string) => {
    const updated = items.filter(t => t.id !== id)
    setItems(updated)
    setEvent((prev: any) => ({ ...prev, tasks: updated }))
    toast.success('Tarefa removida')
  }

  const grouped = { done: items.filter(t => t.status === 'done'), doing: items.filter(t => t.status === 'doing'), todo: items.filter(t => t.status === 'todo') }
  const pct = items.length > 0 ? Math.round((grouped.done.length / items.length) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-32 h-2 bg-canvas rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-espresso/50">{pct}% concluido</span>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="px-3 py-1.5 bg-plum text-cream text-xs rounded-full hover:shadow-glow transition-all flex items-center gap-1"><Plus className="w-3 h-3" /> Nova</button>
      </div>

      {showAdd && (
        <div className="p-4 rounded-xl bg-canvas/50 space-y-2">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-2">
            <input value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })} placeholder="Titulo" className="px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
            <input value={newTask.category} onChange={e => setNewTask({ ...newTask, category: e.target.value })} placeholder="Categoria" className="px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
            <input type="date" value={newTask.deadline} onChange={e => setNewTask({ ...newTask, deadline: e.target.value })} className="px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso focus:outline-none focus:border-plum/30" />
            <div className="flex gap-1">
              <button onClick={handleAdd} className="flex-1 py-2 bg-plum text-cream text-xs rounded-lg hover:shadow-glow transition-all"><Save className="w-3 h-3 inline mr-1" />Salvar</button>
              <button onClick={() => setShowAdd(false)} className="px-2 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso/40"><X className="w-3 h-3" /></button>
            </div>
          </div>
        </div>
      )}

      {(['todo', 'doing', 'done'] as const).map(status => (
        <div key={status}>
          <h4 className="text-xs font-medium text-espresso/40 uppercase tracking-wider mb-3">{status === 'todo' ? 'A Fazer' : status === 'doing' ? 'Em Andamento' : 'Concluido'} ({grouped[status].length})</h4>
          <div className="space-y-2">
            {grouped[status].map(t => (
              <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/60 border border-white/60 hover:bg-white/80 transition-all group">
                <button onClick={() => toggleStatus(t.id)} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${t.status === 'done' ? 'bg-green-500 border-green-500' : t.status === 'doing' ? 'border-amber-400' : 'border-espresso/15'}`}>
                  {t.status === 'done' && <CheckCircle2 className="w-3 h-3 text-white" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm ${t.status === 'done' ? 'text-espresso/30 line-through' : 'text-espresso'}`}>{t.title}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-espresso/30">{t.category}</span>
                    {t.deadline && <span className="text-[10px] text-espresso/20 flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{t.deadline}</span>}
                  </div>
                </div>
                <span className={`px-1.5 py-0.5 text-[9px] rounded border ${t.priority === 'high' ? 'bg-red-50 text-red-500 border-red-100' : t.priority === 'medium' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{t.priority}</span>
                <button onClick={() => removeTask(t.id)} className="p-1 rounded hover:bg-red-50 text-espresso/10 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─── Cronograma Tab ─── */
function CronogramaTab({ timeline, setEvent }: { timeline: EventTimeline[]; setEvent: any }) {
  const [items, setItems] = useState(timeline)
  const [showAdd, setShowAdd] = useState(false)
  const [newItem, setNewItem] = useState({ time: '', title: '', description: '', responsible: '' })

  const toggle = (id: string) => {
    const updated = items.map(i => i.id === id ? { ...i, status: (i.status === 'done' ? 'pending' : 'done') as EventTimeline['status'] } : i)
    setItems(updated)
    setEvent((prev: any) => ({ ...prev, timeline: updated }))
  }

  const handleAdd = () => {
    if (!newItem.time || !newItem.title) { toast.error('Hora e titulo obrigatorios'); return }
    const item: EventTimeline = { id: `tl${Date.now()}`, time: newItem.time, title: newItem.title, description: newItem.description, responsible: newItem.responsible, status: 'pending' }
    const updated = [...items, item].sort((a, b) => a.time.localeCompare(b.time))
    setItems(updated)
    setEvent((prev: any) => ({ ...prev, timeline: updated }))
    setNewItem({ time: '', title: '', description: '', responsible: '' })
    setShowAdd(false)
    toast.success('Adicionado!')
  }

  const remove = (id: string) => {
    const updated = items.filter(i => i.id !== id)
    setItems(updated)
    setEvent((prev: any) => ({ ...prev, timeline: updated }))
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowAdd(!showAdd)} className="px-3 py-1.5 bg-plum text-cream text-xs rounded-full hover:shadow-glow transition-all flex items-center gap-1"><Plus className="w-3 h-3" /> Etapa</button>
      </div>

      {showAdd && (
        <div className="p-4 rounded-xl bg-canvas/50 space-y-2">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <input type="time" value={newItem.time} onChange={e => setNewItem({ ...newItem, time: e.target.value })} className="px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso focus:outline-none focus:border-plum/30" />
            <input value={newItem.title} onChange={e => setNewItem({ ...newItem, title: e.target.value })} placeholder="Titulo" className="px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
            <input value={newItem.responsible} onChange={e => setNewItem({ ...newItem, responsible: e.target.value })} placeholder="Responsavel" className="px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
            <div className="flex gap-1">
              <button onClick={handleAdd} className="flex-1 py-2 bg-plum text-cream text-xs rounded-lg hover:shadow-glow transition-all"><Save className="w-3 h-3 inline mr-1" />Salvar</button>
              <button onClick={() => setShowAdd(false)} className="px-2 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso/40"><X className="w-3 h-3" /></button>
            </div>
          </div>
          <input value={newItem.description} onChange={e => setNewItem({ ...newItem, description: e.target.value })} placeholder="Descricao" className="w-full px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
        </div>
      )}

      <div className="relative pl-8">
        <div className="absolute left-3 top-0 bottom-0 w-px bg-espresso/5" />
        {items.map(item => (
          <div key={item.id} className="relative mb-6 last:mb-0 group">
            <button onClick={() => toggle(item.id)} className={`absolute left-[-22px] top-1 w-6 h-6 rounded-full border-2 flex items-center justify-center z-10 transition-all ${item.status === 'done' ? 'bg-green-500 border-green-500' : 'bg-canvas border-espresso/15'}`}>
              {item.status === 'done' && <CheckCircle2 className="w-3 h-3 text-white" />}
            </button>
            <div className={`p-4 rounded-xl border transition-all ${item.status === 'done' ? 'bg-green-50/50 border-green-100' : 'bg-white/60 border-white/60'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-plum">{item.time}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${item.status === 'done' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>{item.status === 'done' ? 'Concluido' : 'Pendente'}</span>
                <button onClick={() => remove(item.id)} className="ml-auto p-1 rounded hover:bg-red-50 text-espresso/10 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3 h-3" /></button>
              </div>
              <div className={`text-sm font-medium ${item.status === 'done' ? 'text-espresso/40 line-through' : 'text-espresso'}`}>{item.title}</div>
              <p className="text-[11px] text-espresso/30 mt-1">{item.description}</p>
              <p className="text-[10px] text-espresso/20 mt-1">{item.responsible}</p>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-espresso/30 py-8 text-center">Nenhuma etapa no cronograma</p>}
      </div>
    </div>
  )
}

/* ─── Equipe Tab ─── */
function EquipeTab({ team, setEvent }: { team: EventTeam[]; setEvent: any }) {
  const [items, setItems] = useState(team)
  const [showAdd, setShowAdd] = useState(false)
  const [newM, setNewM] = useState({ name: '', role: '', contact: '', payment: '' })

  const statusCfg: Record<string, { label: string; cls: string }> = {
    confirmed: { label: 'Confirmado', cls: 'bg-green-50 text-green-600 border-green-100' },
    invited: { label: 'Convidado', cls: 'bg-amber-50 text-amber-600 border-amber-100' },
    declined: { label: 'Recusado', cls: 'bg-red-50 text-red-500 border-red-100' },
  }

  const totalCost = items.reduce((s, t) => s + t.payment, 0)

  const handleAdd = () => {
    if (!newM.name) { toast.error('Nome obrigatorio'); return }
    const m: EventTeam = { id: `tm${Date.now()}`, name: newM.name, role: newM.role || 'Colaborador', contact: newM.contact, payment: Number(newM.payment) || 0, status: 'invited' as const }
    const updated = [...items, m]
    setItems(updated)
    setEvent((prev: any) => ({ ...prev, team: updated }))
    setNewM({ name: '', role: '', contact: '', payment: '' })
    setShowAdd(false)
    toast.success('Membro adicionado!')
  }

  const updateStatus = (id: string, status: string) => {
    const updated = items.map(m => m.id === id ? { ...m, status: status as EventTeam['status'] } : m)
    setItems(updated)
    setEvent((prev: any) => ({ ...prev, team: updated }))
  }

  const remove = (id: string) => {
    const updated = items.filter(m => m.id !== id)
    setItems(updated)
    setEvent((prev: any) => ({ ...prev, team: updated }))
    toast.success('Removido')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="p-5 rounded-2xl bg-white/60 border border-white/60">
          <div className="font-serif text-2xl text-espresso">R$ {totalCost.toLocaleString()}</div>
          <div className="text-[10px] text-espresso/30 mt-1 uppercase tracking-wider">Custo total da equipe</div>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="px-3 py-1.5 bg-plum text-cream text-xs rounded-full hover:shadow-glow transition-all flex items-center gap-1"><Plus className="w-3 h-3" /> Membro</button>
      </div>

      {showAdd && (
        <div className="p-4 rounded-xl bg-canvas/50 space-y-2">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <input value={newM.name} onChange={e => setNewM({ ...newM, name: e.target.value })} placeholder="Nome" className="px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
            <input value={newM.role} onChange={e => setNewM({ ...newM, role: e.target.value })} placeholder="Funcao" className="px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
            <input value={newM.contact} onChange={e => setNewM({ ...newM, contact: e.target.value })} placeholder="Contato" className="px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
            <div className="flex gap-1">
              <input value={newM.payment} onChange={e => setNewM({ ...newM, payment: e.target.value })} placeholder="Pagamento" type="number" className="flex-1 px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              <button onClick={handleAdd} className="px-3 py-2 bg-plum text-cream rounded-lg hover:shadow-glow transition-all"><Save className="w-3 h-3" /></button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map(m => (
          <div key={m.id} className="p-4 rounded-2xl bg-white/60 border border-white/60 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-plum/10 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-medium text-plum">{m.name[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-espresso">{m.name}</div>
              <div className="text-[10px] text-espresso/30">{m.role}</div>
              <div className="text-[10px] text-espresso/20">{m.contact}</div>
            </div>
            <div className="text-right flex-shrink-0">
              {m.payment > 0 && <div className="text-xs text-espresso">R$ {m.payment.toLocaleString()}</div>}
              <select value={m.status} onChange={e => updateStatus(m.id, e.target.value)} className={`text-[10px] px-1.5 py-0.5 rounded-full border ${statusCfg[m.status].cls} bg-transparent mt-1`}>
                <option value="invited">Convidado</option>
                <option value="confirmed">Confirmado</option>
                <option value="declined">Recusado</option>
              </select>
            </div>
            <button onClick={() => remove(m.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-espresso/10 hover:text-red-500 transition-colors flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
        {items.length === 0 && <p className="col-span-full text-center py-8 text-xs text-espresso/30">Nenhum membro na equipe</p>}
      </div>
    </div>
  )
}

/* ─── Fluxo de Caixa Tab ─── */
function FluxoTab({ cashFlow, setEvent }: { cashFlow: EventCashFlow[]; setEvent: any }) {
  const [showAdd, setShowAdd] = useState(false)
  const [items, setItems] = useState(cashFlow)
  const [newEntry, setNewEntry] = useState({ date: '', description: '', type: 'income' as 'income' | 'expense', amount: '', category: '' })

  const totalIncome = items.filter(i => i.type === 'income').reduce((s, i) => s + i.amount, 0)
  const totalExpense = items.filter(i => i.type === 'expense').reduce((s, i) => s + Math.abs(i.amount), 0)
  const balance = totalIncome - totalExpense

  const handleAdd = () => {
    if (!newEntry.description || !newEntry.amount) { toast.error('Preencha descricao e valor'); return }
    const amt = Number(newEntry.amount)
    const entry: EventCashFlow = {
      id: `cf${Date.now()}`, date: newEntry.date || new Date().toLocaleDateString('pt-BR'),
      description: newEntry.description, type: newEntry.type as 'income' | 'expense',
      category: newEntry.category || (newEntry.type === 'income' ? 'Entrada' : 'Saida'),
      amount: newEntry.type === 'income' ? amt : -amt, balance: balance + (newEntry.type === 'income' ? amt : -amt),
    }
    const updated = [...items, entry]
    setItems(updated)
    setEvent((prev: any) => ({ ...prev, cashFlow: updated }))
    setNewEntry({ date: '', description: '', type: 'income', amount: '', category: '' })
    setShowAdd(false)
    toast.success('Lancamento adicionado!')
  }

  const remove = (id: string) => {
    const updated = items.filter(i => i.id !== id)
    setItems(updated)
    setEvent((prev: any) => ({ ...prev, cashFlow: updated }))
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-green-50 border border-green-100">
          <div className="font-serif text-xl text-green-600">R$ {totalIncome.toLocaleString()}</div>
          <div className="text-[10px] text-green-600/50 mt-1 uppercase tracking-wider">Entradas</div>
        </div>
        <div className="p-5 rounded-2xl bg-red-50 border border-red-100">
          <div className="font-serif text-xl text-red-500">R$ {totalExpense.toLocaleString()}</div>
          <div className="text-[10px] text-red-500/50 mt-1 uppercase tracking-wider">Saidas</div>
        </div>
        <div className="p-5 rounded-2xl bg-white/60 border border-white/60">
          <div className={`font-serif text-xl ${balance >= 0 ? 'text-espresso' : 'text-red-500'}`}>R$ {balance.toLocaleString()}</div>
          <div className="text-[10px] text-espresso/30 mt-1 uppercase tracking-wider">Saldo</div>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={() => setShowAdd(!showAdd)} className="px-3 py-1.5 bg-plum text-cream text-xs rounded-full hover:shadow-glow transition-all flex items-center gap-1"><Plus className="w-3 h-3" /> Lancamento</button>
      </div>

      {showAdd && (
        <div className="p-4 rounded-xl bg-canvas/50 space-y-2">
          <div className="grid grid-cols-1 lg:grid-cols-6 gap-2">
            <input type="date" value={newEntry.date} onChange={e => setNewEntry({ ...newEntry, date: e.target.value })} className="px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso focus:outline-none focus:border-plum/30" />
            <input value={newEntry.description} onChange={e => setNewEntry({ ...newEntry, description: e.target.value })} placeholder="Descricao" className="px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 lg:col-span-2" />
            <select value={newEntry.type} onChange={e => setNewEntry({ ...newEntry, type: e.target.value as 'income' | 'expense' })} className="px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso focus:outline-none focus:border-plum/30">
              <option value="income">Entrada</option><option value="expense">Saida</option>
            </select>
            <input value={newEntry.category} onChange={e => setNewEntry({ ...newEntry, category: e.target.value })} placeholder="Categoria" className="px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
            <div className="flex gap-1">
              <input type="number" value={newEntry.amount} onChange={e => setNewEntry({ ...newEntry, amount: e.target.value })} placeholder="Valor" className="flex-1 px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              <button onClick={handleAdd} className="px-3 py-2 bg-plum text-cream rounded-lg hover:shadow-glow transition-all"><Save className="w-3 h-3" /></button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white/60 border border-white/60 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-espresso/5">
              <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Data</th>
              <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Descricao</th>
              <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase hidden md:table-cell">Categoria</th>
              <th className="text-right px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Valor</th>
              <th className="text-right px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase hidden md:table-cell">Saldo</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-b border-espresso/3 last:border-0 hover:bg-white/40 transition-colors">
                <td className="px-4 py-3 text-xs text-espresso/50">{item.date}</td>
                <td className="px-4 py-3 text-xs text-espresso">{item.description}</td>
                <td className="px-4 py-3 text-xs text-espresso/30 hidden md:table-cell">{item.category}</td>
                <td className={`px-4 py-3 text-right text-xs font-medium ${item.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>{item.type === 'income' ? '+' : ''}R$ {Math.abs(item.amount).toLocaleString()}</td>
                <td className={`px-4 py-3 text-right text-xs hidden md:table-cell ${item.balance >= 0 ? 'text-espresso' : 'text-red-500'}`}>R$ {item.balance.toLocaleString()}</td>
                <td className="px-4 py-3"><button onClick={() => remove(item.id)} className="p-1 rounded hover:bg-red-50 text-espresso/10 hover:text-red-500 transition-colors"><Trash2 className="w-3 h-3" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
