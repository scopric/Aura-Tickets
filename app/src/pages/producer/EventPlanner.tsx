import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { Music, Heart, Mic, Building, Guitar, Cake, GraduationCap, ArrowRight, ArrowLeft, Check, MapPin, Users, DollarSign, Ticket, Sparkles, PartyPopper, Plus, Trash2, Info } from 'lucide-react'
import { toast } from 'sonner'
import { useCreateEvent } from '../../hooks/useEvents'
import { eventProfiles } from '../../data/eventManagerData'
import type { EventProfile } from '../../data/eventManagerData'

const profileIcons: Record<EventProfile, typeof Music> = {
  balada: Music, casamento: Heart, festival: Mic,
  corporativo: Building, show: Guitar, aniversario: Cake, formatura: GraduationCap,
}

const profileColors: Record<EventProfile, string> = {
  balada: '#7a3b69', casamento: '#e11d48', festival: '#3b82f6',
  corporativo: '#64748b', show: '#f59e0b', aniversario: '#22c55e', formatura: '#8b5cf6',
}

interface TicketBatch {
  id: string
  name: string
  price: string
  quantity: string
  startDate: string
  endDate: string
  description: string
}

interface ExpenseItem {
  id: string
  category: string
  item: string
  cost: string
}

export default function EventPlanner() {
  const navigate = useNavigate()
  const createEvent = useCreateEvent()
  const [step, setStep] = useState(1)
  const [data, setData] = useState({
    profile: '' as EventProfile | '',
    title: '',
    date: '',
    time: '',
    location: '',
    capacity: '',
    description: '',
    batches: [] as TicketBatch[],
    expenses: [] as ExpenseItem[],
    feeType: 'absorved' as 'absorved' | 'passed',
    platformFee: '10',
    cardFee: '3.9',
  })

  const steps = [
    { num: 1, label: 'Tipo' },
    { num: 2, label: 'Info' },
    { num: 3, label: 'Lotes' },
    { num: 4, label: 'Custos' },
    { num: 5, label: 'Resumo' },
  ]

  const defaultBatches: TicketBatch[] = [
    { id: '1', name: 'Early Bird', price: '', quantity: '', startDate: '', endDate: '', description: 'Promocao inicial, limitada' },
    { id: '2', name: '1o Lote', price: '', quantity: '', startDate: '', endDate: '', description: 'Primeiro lote oficial' },
    { id: '3', name: '2o Lote', price: '', quantity: '', startDate: '', endDate: '', description: 'Segundo lote' },
    { id: '4', name: 'Pista', price: '', quantity: '', startDate: '', endDate: '', description: 'Ingresso pista' },
  ]

  const defaultExpenses: ExpenseItem[] = [
    { id: '1', category: 'Local', item: 'Aluguel do espaco', cost: '' },
    { id: '2', category: 'Som & Luz', item: 'Equipamento', cost: '' },
    { id: '3', category: 'Artista/DJ', item: 'Contratacao', cost: '' },
    { id: '4', category: 'Seguranca', item: 'Equipe', cost: '' },
    { id: '5', category: 'Marketing', item: 'Divulgacao', cost: '' },
    { id: '6', category: 'Outros', item: 'Imprevistos', cost: '' },
  ]

  const canNext = () => {
    if (step === 1) return !!data.profile
    if (step === 2) return !!data.title && !!data.date && !!data.time && !!data.location && !!data.capacity
    if (step === 3) return data.batches.length > 0 && data.batches.some(b => b.price && b.quantity)
    return true
  }

  const calculations = useMemo(() => {
    const capacity = Number(data.capacity) || 0
    const totalTicketRevenue = data.batches.reduce((sum, b) => sum + (Number(b.price) || 0) * (Number(b.quantity) || 0), 0)
    const totalExpenses = data.expenses.reduce((sum, e) => sum + (Number(e.cost) || 0), 0)
    const platformFeePct = Number(data.platformFee) || 0
    const cardFeePct = Number(data.cardFee) || 0
    const totalFees = totalTicketRevenue * (platformFeePct + cardFeePct) / 100
    const netRevenue = totalTicketRevenue - totalFees
    const profit = netRevenue - totalExpenses
    const avgTicketPrice = capacity > 0 ? totalTicketRevenue / capacity : 0
    const breakEvenTickets = avgTicketPrice > 0 ? Math.ceil(totalExpenses / avgTicketPrice) : 0
    const profitMargin = totalTicketRevenue > 0 ? ((profit / totalTicketRevenue) * 100).toFixed(1) : '0'
    const costPerPerson = capacity > 0 ? totalExpenses / capacity : 0
    const minTicketPrice = capacity > 0 ? (totalExpenses * 1.3) / capacity : 0

    return {
      totalTicketRevenue,
      totalExpenses,
      totalFees,
      netRevenue,
      profit,
      avgTicketPrice,
      breakEvenTickets,
      profitMargin,
      costPerPerson,
      minTicketPrice,
    }
  }, [data])

  const handleFinish = async () => {
    try {
      const eventData = {
        title: data.title,
        description: data.description,
        date: data.date,
        time: data.time,
        location: data.location,
        capacity: Number(data.capacity) || null,
        category: data.profile ? eventProfiles[data.profile as EventProfile].label : 'Outros',
        status: 'published' as const, // Criar publicado por padrão para aparecer na listagem
        cover_image: '/images/hero-bg.jpg', // Placeholder de imagem premium
      }

      const ticketsData = data.batches
        .filter(b => b.price && b.quantity)
        .map(b => ({
          name: b.name,
          price: Number(b.price) || 0,
          capacity: Number(b.quantity) || 0,
          description: b.description || null,
          type: 'individual' as const,
        }))

      await createEvent.mutateAsync({
        event: eventData,
        tickets: ticketsData
      })

      toast.success('Evento planejado e publicado com sucesso!')
      setTimeout(() => navigate('/producer/events'), 800)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar o evento no Supabase')
    }
  }

  const addBatch = () => {
    const names = ['VIP', 'Mesa Coletiva', 'Camarote', 'Backstage', 'Open Bar']
    const used = data.batches.map(b => b.name)
    const next = names.find(n => !used.includes(n)) || `Lote ${data.batches.length + 1}`
    setData({ ...data, batches: [...data.batches, { id: Date.now().toString(), name: next, price: '', quantity: '', startDate: '', endDate: '', description: '' }] })
  }

  const removeBatch = (id: string) => {
    setData({ ...data, batches: data.batches.filter(b => b.id !== id) })
  }

  const updateBatch = (id: string, field: keyof TicketBatch, value: string) => {
    setData({ ...data, batches: data.batches.map(b => b.id === id ? { ...b, [field]: value } : b) })
  }

  const updateExpense = (id: string, field: keyof ExpenseItem, value: string) => {
    setData({ ...data, expenses: data.expenses.map(e => e.id === id ? { ...e, [field]: value } : e) })
  }

  const addExpense = () => {
    setData({ ...data, expenses: [...data.expenses, { id: Date.now().toString(), category: 'Outros', item: '', cost: '' }] })
  }

  const removeExpense = (id: string) => {
    setData({ ...data, expenses: data.expenses.filter(e => e.id !== id) })
  }

  return (
    <div className="min-h-screen bg-canvas p-6 lg:p-10">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-plum/10 rounded-full mb-4">
            <Sparkles className="w-4 h-4 text-plum" />
            <span className="text-xs text-plum font-medium">Planejador de Evento</span>
          </div>
          <h1 className="font-serif text-3xl text-espresso">Criar Novo Evento</h1>
          <p className="text-sm text-espresso/50 mt-2">Configure tudo em 5 passos</p>
        </div>

        {/* Steps */}
        <div className="flex items-center justify-between mb-8">
          {steps.map((s, i) => (
            <div key={s.num} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all ${step > s.num ? 'bg-green-500 text-white' : step === s.num ? 'bg-plum text-cream' : 'bg-white/60 border border-white/60 text-espresso/30'}`}>
                  {step > s.num ? <Check className="w-4 h-4" /> : s.num}
                </div>
                <span className={`text-[10px] mt-1 ${step >= s.num ? 'text-espresso' : 'text-espresso/30'}`}>{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className="flex-1 h-px mx-2 bg-espresso/5">
                  <div className="h-full bg-plum transition-all duration-500" style={{ width: step > s.num ? '100%' : '0%' }} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white/60 border border-white/60 rounded-3xl p-6 lg:p-8">

          {/* STEP 1 - TIPO */}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="font-serif text-xl text-espresso text-center">Que tipo de evento?</h2>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {(Object.entries(eventProfiles) as [EventProfile, typeof eventProfiles.balada][]).map(([key, profile]) => {
                  const Icon = profileIcons[key]
                  const isSelected = data.profile === key
                  return (
                    <button key={key} onClick={() => setData({ ...data, profile: key })} className={`p-4 rounded-2xl border text-left transition-all ${isSelected ? 'border-plum bg-plum/5 shadow-glow' : 'border-white/60 bg-white/40 hover:bg-white/60'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${profileColors[key]}15` }}>
                          <Icon className="w-4 h-4" style={{ color: profileColors[key] }} />
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-plum ml-auto" />}
                      </div>
                      <div className="text-sm font-medium text-espresso">{profile.label}</div>
                      <p className="text-[10px] text-espresso/30 mt-0.5">{profile.description}</p>
                    </button>
                  )
                })}
              </div>
              {data.profile && (
                <div className="p-4 rounded-xl bg-canvas">
                  <p className="text-xs text-espresso/40 mb-2">Itens sugeridos para orcamento:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {eventProfiles[data.profile].defaultBudget.map(item => (
                      <span key={item} className="px-2 py-0.5 bg-white/60 rounded-full text-[10px] text-espresso/50">{item}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2 - INFO */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="font-serif text-xl text-espresso text-center">Informacoes do Evento</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Nome do Evento *</label>
                  <input value={data.title} onChange={e => setData({ ...data, title: e.target.value })} placeholder="Ex: Noite Eletro 2025" className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Data *</label>
                    <input type="date" value={data.date} onChange={e => setData({ ...data, date: e.target.value })} className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Horario *</label>
                    <input type="time" value={data.time} onChange={e => setData({ ...data, time: e.target.value })} className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-espresso/60 mb-1.5 block flex items-center gap-1"><MapPin className="w-3 h-3" />Local *</label>
                  <input value={data.location} onChange={e => setData({ ...data, location: e.target.value })} placeholder="Ex: Warehouse Central, Sao Paulo" className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-espresso/60 mb-1.5 block flex items-center gap-1"><Users className="w-3 h-3" />Capacidade *</label>
                    <input type="number" value={data.capacity} onChange={e => setData({ ...data, capacity: e.target.value })} placeholder="500" className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Tipo</label>
                    <div className="px-4 py-3 bg-canvas rounded-xl text-sm text-espresso/50">{data.profile ? eventProfiles[data.profile as EventProfile].label : '-'}</div>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Descricao</label>
                  <textarea value={data.description} onChange={e => setData({ ...data, description: e.target.value })} rows={3} placeholder="Descreva seu evento..." className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 resize-none" />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 - LOTES */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-xl text-espresso">Lotes de Ingresso</h2>
                <button onClick={addBatch} className="px-3 py-1.5 bg-plum text-cream text-xs rounded-full hover:shadow-glow transition-all flex items-center gap-1"><Plus className="w-3 h-3" /> Adicionar Lote</button>
              </div>

              {/* Default batches if none */}
              {data.batches.length === 0 && (
                <div className="space-y-3">
                  {defaultBatches.map(b => (
                    <div key={b.id} className="p-4 rounded-xl bg-white/40 border border-white/60 space-y-3">
                      <div className="flex items-center justify-between">
                        <input value={b.name} onChange={e => { const updated = defaultBatches.map(db => db.id === b.id ? { ...db, name: e.target.value } : db); setData({ ...data, batches: updated }) }} className="text-sm font-medium text-espresso bg-transparent border-none focus:outline-none w-32" />
                        <button onClick={() => setData({ ...data, batches: data.batches.filter(x => x.id !== b.id) })} className="p-1 rounded hover:bg-red-50 text-espresso/10 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                        <input type="number" placeholder="Preco (R$)" value={b.price} onChange={e => { const updated = defaultBatches.map(db => db.id === b.id ? { ...db, price: e.target.value } : db); setData({ ...data, batches: updated }) }} className="px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
                        <input type="number" placeholder="Quantidade" value={b.quantity} onChange={e => { const updated = defaultBatches.map(db => db.id === b.id ? { ...db, quantity: e.target.value } : db); setData({ ...data, batches: updated }) }} className="px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
                        <input type="date" placeholder="Inicio" value={b.startDate} onChange={e => { const updated = defaultBatches.map(db => db.id === b.id ? { ...db, startDate: e.target.value } : db); setData({ ...data, batches: updated }) }} className="px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
                        <input type="date" placeholder="Fim" value={b.endDate} onChange={e => { const updated = defaultBatches.map(db => db.id === b.id ? { ...db, endDate: e.target.value } : db); setData({ ...data, batches: updated }) }} className="px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
                      </div>
                      <input placeholder="Descricao (opcional)" value={b.description} onChange={e => { const updated = defaultBatches.map(db => db.id === b.id ? { ...db, description: e.target.value } : db); setData({ ...data, batches: updated }) }} className="w-full px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
                    </div>
                  ))}
                </div>
              )}

              {/* Custom batches */}
              {data.batches.length > 0 && (
                <div className="space-y-3">
                  {data.batches.map(b => (
                    <div key={b.id} className="p-4 rounded-xl bg-white/40 border border-white/60 space-y-3">
                      <div className="flex items-center justify-between">
                        <input value={b.name} onChange={e => updateBatch(b.id, 'name', e.target.value)} className="text-sm font-medium text-espresso bg-transparent border-none focus:outline-none w-40" />
                        <button onClick={() => removeBatch(b.id)} className="p-1 rounded hover:bg-red-50 text-espresso/10 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                        <input type="number" placeholder="Preco (R$)" value={b.price} onChange={e => updateBatch(b.id, 'price', e.target.value)} className="px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
                        <input type="number" placeholder="Quantidade" value={b.quantity} onChange={e => updateBatch(b.id, 'quantity', e.target.value)} className="px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
                        <input type="date" value={b.startDate} onChange={e => updateBatch(b.id, 'startDate', e.target.value)} className="px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso focus:outline-none focus:border-plum/30" />
                        <input type="date" value={b.endDate} onChange={e => updateBatch(b.id, 'endDate', e.target.value)} className="px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso focus:outline-none focus:border-plum/30" />
                      </div>
                      <input placeholder="Descricao (opcional)" value={b.description} onChange={e => updateBatch(b.id, 'description', e.target.value)} className="w-full px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
                    </div>
                  ))}
                </div>
              )}

              {/* Quick add presets */}
              <div className="flex flex-wrap gap-2">
                {['VIP', 'Mesa Coletiva', 'Camarote', 'Backstage'].filter(n => !data.batches.some(b => b.name === n)).map(name => (
                  <button key={name} onClick={() => setData({ ...data, batches: [...data.batches, { id: Date.now().toString() + name, name, price: '', quantity: '', startDate: '', endDate: '', description: '' }] })} className="px-3 py-1.5 bg-white/40 border border-white/60 rounded-full text-xs text-espresso/50 hover:text-plum hover:border-plum/30 transition-all">
                    + {name}
                  </button>
                ))}
              </div>

              {/* Calculations preview */}
              {calculations.totalTicketRevenue > 0 && (
                <div className="p-4 rounded-xl bg-canvas space-y-2">
                  <p className="text-xs text-espresso/40 flex items-center gap-1"><Info className="w-3 h-3" /> Previa de receita</p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-espresso/50">Total de ingressos:</span>
                    <span className="font-medium text-espresso">{data.batches.reduce((s, b) => s + (Number(b.quantity) || 0), 0)} / {data.capacity}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-espresso/50">Receita bruta projetada:</span>
                    <span className="font-medium text-espresso">R$ {calculations.totalTicketRevenue.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-espresso/50">Preco medio:</span>
                    <span className="font-medium text-espresso">R$ {calculations.avgTicketPrice.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4 - CUSTOS */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-xl text-espresso">Custos do Evento</h2>
                <button onClick={addExpense} className="px-3 py-1.5 bg-plum text-cream text-xs rounded-full hover:shadow-glow transition-all flex items-center gap-1"><Plus className="w-3 h-3" /> Adicionar</button>
              </div>

              <div className="space-y-2">
                {(data.expenses.length > 0 ? data.expenses : defaultExpenses).map((e, i) => (
                  <div key={e.id} className="grid grid-cols-3 lg:grid-cols-5 gap-2 items-center">
                    <input placeholder="Categoria" value={e.category} onChange={ev => data.expenses.length > 0 ? updateExpense(e.id, 'category', ev.target.value) : setData({ ...data, expenses: defaultExpenses.map((de, di) => di === i ? { ...de, category: ev.target.value } : de) })} className="px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
                    <input placeholder="Item" value={e.item} onChange={ev => data.expenses.length > 0 ? updateExpense(e.id, 'item', ev.target.value) : setData({ ...data, expenses: defaultExpenses.map((de, di) => di === i ? { ...de, item: ev.target.value } : de) })} className="px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 lg:col-span-2" />
                    <input type="number" placeholder="R$" value={e.cost} onChange={ev => data.expenses.length > 0 ? updateExpense(e.id, 'cost', ev.target.value) : setData({ ...data, expenses: defaultExpenses.map((de, di) => di === i ? { ...de, cost: ev.target.value } : de) })} className="px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
                    <button onClick={() => data.expenses.length > 0 ? removeExpense(e.id) : setData({ ...data, expenses: defaultExpenses.filter((_, di) => di !== i) })} className="p-2 rounded hover:bg-red-50 text-espresso/10 hover:text-red-500 justify-self-start"><Trash2 className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>

              {calculations.totalExpenses > 0 && (
                <div className="p-4 rounded-xl bg-canvas space-y-2">
                  <p className="text-xs text-espresso/40">Custo total: <span className="font-medium text-espresso">R$ {calculations.totalExpenses.toLocaleString()}</span></p>
                  <p className="text-xs text-espresso/40">Custo por pessoa: <span className="font-medium text-espresso">R$ {calculations.costPerPerson.toFixed(2)}</span></p>
                </div>
              )}

              <div className="border-t border-espresso/5 pt-4 space-y-3">
                <h3 className="text-sm font-medium text-espresso">Taxas</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-espresso/40 mb-1 block">Taxa da plataforma (%)</label>
                    <input type="number" value={data.platformFee} onChange={e => setData({ ...data, platformFee: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                  </div>
                  <div>
                    <label className="text-xs text-espresso/40 mb-1 block">Taxa do cartao (%)</label>
                    <input type="number" value={data.cardFee} onChange={e => setData({ ...data, cardFee: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/40">
                  <span className="text-xs text-espresso/50">Taxa absorvida pelo produtor</span>
                  <label className="relative inline-flex items-center cursor-pointer ml-auto">
                    <input type="checkbox" checked={data.feeType === 'absorved'} onChange={e => setData({ ...data, feeType: e.target.checked ? 'absorved' : 'passed' })} className="sr-only peer" />
                    <div className="w-10 h-5 bg-espresso/10 rounded-full peer peer-checked:bg-plum transition-colors" />
                    <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5 - RESUMO */}
          {step === 5 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-green-50 border border-green-100 flex items-center justify-center mx-auto mb-4">
                  <PartyPopper className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="font-serif text-xl text-espresso">Resumo do Evento</h2>
                <p className="text-sm text-espresso/50 mt-1">Revise todos os dados antes de criar</p>
              </div>

              {/* Info */}
              <div className="p-5 rounded-2xl bg-white/40 border border-white/60 space-y-3">
                <h3 className="text-sm font-medium text-espresso flex items-center gap-2"><Ticket className="w-4 h-4 text-plum" /> Informacoes</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-espresso/30">Evento:</span> <span className="text-espresso">{data.title || '-'}</span></div>
                  <div><span className="text-espresso/30">Tipo:</span> <span className="text-espresso">{data.profile ? eventProfiles[data.profile as EventProfile].label : '-'}</span></div>
                  <div><span className="text-espresso/30">Data:</span> <span className="text-espresso">{data.date || '-'} {data.time}</span></div>
                  <div><span className="text-espresso/30">Local:</span> <span className="text-espresso">{data.location || '-'}</span></div>
                  <div><span className="text-espresso/30">Capacidade:</span> <span className="text-espresso">{data.capacity || '-'}</span></div>
                </div>
              </div>

              {/* Lotes */}
              <div className="p-5 rounded-2xl bg-white/40 border border-white/60 space-y-3">
                <h3 className="text-sm font-medium text-espresso flex items-center gap-2"><Users className="w-4 h-4 text-plum" /> Lotes de Ingresso</h3>
                <div className="space-y-2">
                  {(data.batches.length > 0 ? data.batches : defaultBatches).map(b => (
                    <div key={b.id} className="flex items-center justify-between text-xs">
                      <span className="text-espresso">{b.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-espresso/40">{b.quantity || 0} ingressos</span>
                        <span className="font-medium text-espresso">R$ {b.price || 0}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-espresso/5 pt-2 flex items-center justify-between text-xs">
                  <span className="text-espresso/40">Total de ingressos</span>
                  <span className="font-medium text-espresso">{(data.batches.length > 0 ? data.batches : defaultBatches).reduce((s, b) => s + (Number(b.quantity) || 0), 0)}</span>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="p-5 rounded-2xl bg-plum/5 border border-plum/10 space-y-4">
                <h3 className="text-sm font-medium text-espresso flex items-center gap-2"><DollarSign className="w-4 h-4 text-plum" /> Resumo Financeiro</h3>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-white/60 text-center">
                    <div className="text-[10px] text-espresso/30 uppercase">Receita Bruta</div>
                    <div className="font-serif text-lg text-espresso">R$ {calculations.totalTicketRevenue.toLocaleString()}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/60 text-center">
                    <div className="text-[10px] text-espresso/30 uppercase">Custos</div>
                    <div className="font-serif text-lg text-red-500">R$ {calculations.totalExpenses.toLocaleString()}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/60 text-center">
                    <div className="text-[10px] text-espresso/30 uppercase">Taxas</div>
                    <div className="font-serif text-lg text-amber-600">R$ {calculations.totalFees.toLocaleString()}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/60 text-center">
                    <div className="text-[10px] text-espresso/30 uppercase">Lucro Estimado</div>
                    <div className={`font-serif text-lg ${calculations.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>R$ {calculations.profit.toLocaleString()}</div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-plum/10">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-espresso/40">Receita liquida (apos taxas):</span>
                    <span className="text-espresso">R$ {calculations.netRevenue.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-espresso/40">Preco medio do ingresso:</span>
                    <span className="text-espresso">R$ {calculations.avgTicketPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-espresso/40">Custo por pessoa:</span>
                    <span className="text-espresso">R$ {calculations.costPerPerson.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-espresso/40">Break-even (ingressos):</span>
                    <span className="font-medium text-plum">{calculations.breakEvenTickets}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-espresso/40">Margem de lucro:</span>
                    <span className={`font-medium ${Number(calculations.profitMargin) >= 0 ? 'text-green-600' : 'text-red-500'}`}>{calculations.profitMargin}%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-espresso/40">Preco minimo recomendado:</span>
                    <span className="font-medium text-plum">R$ {calculations.minTicketPrice.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-100">
                <p className="text-xs text-amber-700 flex items-start gap-2">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  Apos criar o evento, voce podera gerenciar orcamento, fornecedores, checklist e equipe na pasta do evento.
                </p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-espresso/5">
            <button onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1} className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-full transition-all ${step === 1 ? 'text-espresso/20 cursor-not-allowed' : 'text-espresso hover:bg-white/60 border border-white/60'}`}>
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
            {step < 5 ? (
              <button onClick={() => setStep(step + 1)} disabled={!canNext()} className={`flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-full transition-all ${canNext() ? 'bg-plum text-cream hover:shadow-glow' : 'bg-espresso/5 text-espresso/20 cursor-not-allowed'}`}>
                Proximo <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button 
                onClick={handleFinish} 
                disabled={createEvent.isPending}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-500 text-white text-sm font-medium rounded-full hover:shadow-lg transition-all disabled:opacity-50"
              >
                {createEvent.isPending ? 'Criando...' : (
                  <>
                    <Check className="w-4 h-4" /> Criar Evento
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
