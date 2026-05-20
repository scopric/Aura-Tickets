import { useState } from 'react'
import { Link } from 'react-router'
import {
  ArrowLeft, Plus, X, Save, Users, Receipt, ToggleLeft, ToggleRight,
  Tag, FileText, Hash, ChevronDown, ChevronUp, Copy, Percent, Calculator
} from 'lucide-react'
import { toast } from 'sonner'

interface TicketGroup {
  id: string
  name: string
  description: string
  color: string
}

interface TicketType {
  id: string
  name: string
  price: number
  capacity: number
  groupId: string
  halfPrice: boolean
  halfPriceValue: number
  minPerOrder: number
  maxPerOrder: number
  limitPerCpf: number
  description: string
  startDate: string
  endDate: string
  autoClose: boolean
}

interface CustomField {
  id: string
  label: string
  type: 'text' | 'email' | 'phone' | 'select' | 'checkbox' | 'date'
  required: boolean
  options: string
}

interface TaxConfig {
  enabled: boolean
  percentage: number
  minAmount: number
  absorb: boolean
}

interface LotConfig {
  id: string
  name: string
  ticketId: string
  price: number
  capacity: number
  startDate: string
  endDate: string
  autoSwitch: boolean
  nextLotId: string
}

const eventMock = { id: '1', title: 'Noite Eletro 2025' }

const colorOptions = ['#7a3b69', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899']

export default function EventTicketConfig() {
  const [groups, setGroups] = useState<TicketGroup[]>([
    { id: 'g1', name: 'Ingressos Gerais', description: 'Acesso principal ao evento', color: '#7a3b69' },
  ])
  const [tickets, setTickets] = useState<TicketType[]>([
    {
      id: 't1', name: 'Entrada Geral', price: 80, capacity: 200, groupId: 'g1',
      halfPrice: true, halfPriceValue: 40, minPerOrder: 1, maxPerOrder: 10, limitPerCpf: 10,
      description: 'Acesso completo ao evento', startDate: '2025-06-01', endDate: '2025-06-14', autoClose: true,
    },
  ])
  const [customFields, setCustomFields] = useState<CustomField[]>([
    { id: 'cf1', label: 'CPF', type: 'text', required: true, options: '' },
    { id: 'cf2', label: 'Telefone', type: 'phone', required: true, options: '' },
  ])
  const [tax, setTax] = useState<TaxConfig>({
    enabled: true, percentage: 10, minAmount: 3.99, absorb: false,
  })
  const [lots, setLots] = useState<LotConfig[]>([
    { id: 'l1', name: '1o Lote - Early Bird', ticketId: 't1', price: 60, capacity: 50, startDate: '2025-06-01', endDate: '2025-06-07', autoSwitch: true, nextLotId: '' },
  ])
  const [expandedGroup, setExpandedGroup] = useState<string | null>('g1')
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null)

  const addGroup = () => {
    const newGroup: TicketGroup = {
      id: `g${Date.now()}`,
      name: 'Novo Grupo',
      description: '',
      color: colorOptions[groups.length % colorOptions.length],
    }
    setGroups([...groups, newGroup])
    toast.success('Grupo criado!')
  }

  const removeGroup = (id: string) => {
    if (groups.length <= 1) { toast.error('Mantenha pelo menos um grupo'); return }
    setGroups(groups.filter(g => g.id !== id))
    setTickets(tickets.map(t => t.groupId === id ? { ...t, groupId: groups[0].id } : t))
  }

  const addTicket = (groupId: string) => {
    const newTicket: TicketType = {
      id: `t${Date.now()}`,
      name: '', price: 0, capacity: 0, groupId,
      halfPrice: false, halfPriceValue: 0, minPerOrder: 1, maxPerOrder: 10, limitPerCpf: 10,
      description: '', startDate: '', endDate: '', autoClose: false,
    }
    setTickets([...tickets, newTicket])
    setExpandedTicket(newTicket.id)
  }

  const removeTicket = (id: string) => {
    setTickets(tickets.filter(t => t.id !== id))
    setLots(lots.filter(l => l.ticketId !== id))
  }

  const updateTicket = (id: string, updates: Partial<TicketType>) => {
    setTickets(tickets.map(t => t.id === id ? { ...t, ...updates } : t))
  }

  const addCustomField = () => {
    setCustomFields([...customFields, { id: `cf${Date.now()}`, label: '', type: 'text', required: false, options: '' }])
  }

  const removeCustomField = (id: string) => {
    setCustomFields(customFields.filter(f => f.id !== id))
  }

  const updateField = (id: string, updates: Partial<CustomField>) => {
    setCustomFields(customFields.map(f => f.id === id ? { ...f, ...updates } : f))
  }

  const addLot = (ticketId: string) => {
    const ticket = tickets.find(t => t.id === ticketId)
    const newLot: LotConfig = {
      id: `l${Date.now()}`, name: 'Novo Lote', ticketId,
      price: ticket?.price || 0, capacity: 0,
      startDate: '', endDate: '', autoSwitch: false, nextLotId: '',
    }
    setLots([...lots, newLot])
  }

  const removeLot = (id: string) => { setLots(lots.filter(l => l.id !== id)) }
  const updateLot = (id: string, updates: Partial<LotConfig>) => {
    setLots(lots.map(l => l.id === id ? { ...l, ...updates } : l))
  }

  const duplicateTicket = (ticket: TicketType) => {
    const newTicket = { ...ticket, id: `t${Date.now()}`, name: `${ticket.name} (Copia)` }
    setTickets([...tickets, newTicket])
    toast.success('Ingresso duplicado!')
  }

  const handleSave = () => {
    toast.success('Configuracao de ingressos salva com sucesso!')
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link to="/producer/event-manager" className="p-2 rounded-full bg-white/60 border border-white/60 text-espresso/50 hover:text-espresso transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-serif text-3xl text-espresso">Ingressos Avancados</h1>
          <p className="text-sm text-espresso/50 mt-1">{eventMock.title} — Configure grupos, lotes, meia-entrada, formularios e taxas</p>
        </div>
        <button onClick={handleSave} className="px-6 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all flex items-center gap-2">
          <Save className="w-4 h-4" /> Salvar
        </button>
      </div>

      {/* ============ GRUPOS DE INGRESSOS ============ */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Tag className="w-5 h-5 text-plum" />
          <h2 className="font-serif text-xl text-espresso">Grupos de Ingressos</h2>
          <span className="text-xs text-espresso/30">{groups.length} grupo(s)</span>
        </div>

        {groups.map(group => {
          const groupTickets = tickets.filter(t => t.groupId === group.id)
          const isExpanded = expandedGroup === group.id
          return (
            <div key={group.id} className="mb-4 bg-white/60 border border-white/60 rounded-2xl overflow-hidden">
              {/* Group Header */}
              <div className="p-4 flex items-center gap-3">
                <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: group.color }} />
                <input
                  value={group.name}
                  onChange={e => setGroups(groups.map(g => g.id === group.id ? { ...g, name: e.target.value } : g))}
                  className="flex-1 bg-transparent text-sm font-medium text-espresso focus:outline-none"
                />
                <input
                  value={group.description}
                  onChange={e => setGroups(groups.map(g => g.id === group.id ? { ...g, description: e.target.value } : g))}
                  placeholder="Descricao do grupo..."
                  className="hidden sm:block w-48 bg-white/40 border border-white/60 rounded-lg px-3 py-1.5 text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30"
                />
                <div className="flex items-center gap-1">
                  {colorOptions.map(c => (
                    <button key={c} onClick={() => setGroups(groups.map(g => g.id === group.id ? { ...g, color: c } : g))}
                      className={`w-5 h-5 rounded-full border-2 transition-all ${group.color === c ? 'border-espresso scale-110' : 'border-transparent'}`}
                      style={{ background: c }} />
                  ))}
                </div>
                <button onClick={() => setExpandedGroup(isExpanded ? null : group.id)} className="p-1.5 rounded-lg hover:bg-white/60 transition-colors">
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-espresso/40" /> : <ChevronDown className="w-4 h-4 text-espresso/40" />}
                </button>
                {groups.length > 1 && (
                  <button onClick={() => removeGroup(group.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-espresso/30 hover:text-red-500 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Tickets in Group */}
              {isExpanded && (
                <div className="px-4 pb-4">
                  {groupTickets.map(ticket => {
                    const isTicketExpanded = expandedTicket === ticket.id
                    const ticketLots = lots.filter(l => l.ticketId === ticket.id)
                    return (
                      <div key={ticket.id} className="mb-3 bg-white/40 border border-white/60 rounded-xl overflow-hidden">
                        {/* Ticket Header */}
                        <div className="p-4 flex items-center gap-3">
                          <Hash className="w-4 h-4 text-plum/50" />
                          <input value={ticket.name}
                            onChange={e => updateTicket(ticket.id, { name: e.target.value })}
                            placeholder="Nome do ingresso" className="flex-1 bg-transparent text-sm font-medium text-espresso focus:outline-none" />
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-espresso/30">R$</span>
                            <input type="number" value={ticket.price || ''}
                              onChange={e => updateTicket(ticket.id, { price: Number(e.target.value) })}
                              placeholder="0,00" className="w-20 bg-white/40 border border-white/60 rounded-lg px-2 py-1.5 text-sm text-espresso text-right focus:outline-none focus:border-plum/30" />
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="w-3.5 h-3.5 text-espresso/30" />
                            <input type="number" value={ticket.capacity || ''}
                              onChange={e => updateTicket(ticket.id, { capacity: Number(e.target.value) })}
                              placeholder="Qtd" className="w-16 bg-white/40 border border-white/60 rounded-lg px-2 py-1.5 text-sm text-espresso text-right focus:outline-none focus:border-plum/30" />
                          </div>
                          <button onClick={() => setExpandedTicket(isTicketExpanded ? null : ticket.id)}
                            className="p-1.5 rounded-lg hover:bg-white/60 transition-colors">
                            {isTicketExpanded ? <ChevronUp className="w-4 h-4 text-espresso/40" /> : <ChevronDown className="w-4 h-4 text-espresso/40" />}
                          </button>
                          <button onClick={() => duplicateTicket(ticket)} className="p-1.5 rounded-lg hover:bg-white/60 text-espresso/30 hover:text-plum transition-colors">
                            <Copy className="w-4 h-4" />
                          </button>
                          {tickets.length > 1 && (
                            <button onClick={() => removeTicket(ticket.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-espresso/30 hover:text-red-500 transition-colors">
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Ticket Advanced Config */}
                        {isTicketExpanded && (
                          <div className="px-4 pb-4 border-t border-white/60">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                              {/* Meia-entrada */}
                              <div className="p-4 bg-white/40 rounded-xl">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="text-sm font-medium text-espresso flex items-center gap-2">
                                    <Percent className="w-4 h-4 text-plum" /> Meia-Entrada
                                  </h4>
                                  <button onClick={() => updateTicket(ticket.id, { halfPrice: !ticket.halfPrice })}
                                    className="transition-all">
                                    {ticket.halfPrice ? <ToggleRight className="w-6 h-6 text-plum" /> : <ToggleLeft className="w-6 h-6 text-espresso/30" />}
                                  </button>
                                </div>
                                {ticket.halfPrice && (
                                  <div className="space-y-3">
                                    <div>
                                      <label className="text-xs text-espresso/50 mb-1 block">Valor da Meia</label>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-espresso/30">R$</span>
                                        <input type="number" value={ticket.halfPriceValue || ''}
                                          onChange={e => updateTicket(ticket.id, { halfPriceValue: Number(e.target.value) })}
                                          className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso focus:outline-none focus:border-plum/30" />
                                      </div>
                                      {ticket.price > 0 && ticket.halfPriceValue > 0 && (
                                        <p className="text-[10px] text-espresso/30 mt-1">
                                          Desconto: {Math.round((1 - ticket.halfPriceValue / ticket.price) * 100)}%
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Limites */}
                              <div className="p-4 bg-white/40 rounded-xl">
                                <h4 className="text-sm font-medium text-espresso mb-3 flex items-center gap-2">
                                  <Hash className="w-4 h-4 text-plum" /> Limites por Compra
                                </h4>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="text-xs text-espresso/50 mb-1 block">Minimo</label>
                                    <input type="number" value={ticket.minPerOrder}
                                      onChange={e => updateTicket(ticket.id, { minPerOrder: Number(e.target.value) })}
                                      className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso focus:outline-none focus:border-plum/30" />
                                  </div>
                                  <div>
                                    <label className="text-xs text-espresso/50 mb-1 block">Maximo</label>
                                    <input type="number" value={ticket.maxPerOrder}
                                      onChange={e => updateTicket(ticket.id, { maxPerOrder: Number(e.target.value) })}
                                      className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso focus:outline-none focus:border-plum/30" />
                                  </div>
                                  <div className="col-span-2">
                                    <label className="text-xs text-espresso/50 mb-1 block">Limite por CPF</label>
                                    <input type="number" value={ticket.limitPerCpf}
                                      onChange={e => updateTicket(ticket.id, { limitPerCpf: Number(e.target.value) })}
                                      className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso focus:outline-none focus:border-plum/30" />
                                    <p className="text-[10px] text-espresso/30 mt-1">Quantos ingressos deste tipo uma pessoa pode comprar no total</p>
                                  </div>
                                </div>
                              </div>

                              {/* Periodo de venda */}
                              <div className="p-4 bg-white/40 rounded-xl">
                                <h4 className="text-sm font-medium text-espresso mb-3 flex items-center gap-2">
                                  <Receipt className="w-4 h-4 text-plum" /> Periodo de Venda
                                </h4>
                                <div className="space-y-3">
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="text-xs text-espresso/50 mb-1 block">Inicio</label>
                                      <input type="date" value={ticket.startDate}
                                        onChange={e => updateTicket(ticket.id, { startDate: e.target.value })}
                                        className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso focus:outline-none focus:border-plum/30" />
                                    </div>
                                    <div>
                                      <label className="text-xs text-espresso/50 mb-1 block">Fim</label>
                                      <input type="date" value={ticket.endDate}
                                        onChange={e => updateTicket(ticket.id, { endDate: e.target.value })}
                                        className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso focus:outline-none focus:border-plum/30" />
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => updateTicket(ticket.id, { autoClose: !ticket.autoClose })}
                                      className="transition-all">
                                      {ticket.autoClose ? <ToggleRight className="w-5 h-5 text-plum" /> : <ToggleLeft className="w-5 h-5 text-espresso/30" />}
                                    </button>
                                    <span className="text-xs text-espresso/50">Encerrar automaticamente ao atingir capacidade</span>
                                  </div>
                                </div>
                              </div>

                              {/* Descricao */}
                              <div className="p-4 bg-white/40 rounded-xl">
                                <h4 className="text-sm font-medium text-espresso mb-3 flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-plum" /> Descricao
                                </h4>
                                <textarea value={ticket.description}
                                  onChange={e => updateTicket(ticket.id, { description: e.target.value })}
                                  placeholder="O que este ingresso inclui..."
                                  rows={4}
                                  className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 resize-none" />
                              </div>
                            </div>

                            {/* Lotes */}
                            <div className="mt-4 p-4 bg-white/40 rounded-xl">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-medium text-espresso flex items-center gap-2">
                                  <Calculator className="w-4 h-4 text-plum" /> Lotes ({ticketLots.length})
                                </h4>
                                <button onClick={() => addLot(ticket.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-plum hover:bg-plum/10 rounded-full transition-colors">
                                  <Plus className="w-3 h-3" /> Adicionar Lote
                                </button>
                              </div>
                              {ticketLots.length === 0 && (
                                <p className="text-xs text-espresso/30 py-2">Sem lotes configurados. O ingresso usara o preco padrao.</p>
                              )}
                              {ticketLots.map((lot, li) => (
                                <div key={lot.id} className="grid grid-cols-12 gap-2 mb-2 items-end">
                                  <div className="col-span-2">
                                    <label className="text-[10px] text-espresso/50 mb-1 block">Nome</label>
                                    <input value={lot.name} onChange={e => updateLot(lot.id, { name: e.target.value })}
                                      className="w-full px-2 py-1.5 bg-white/50 border border-white/60 rounded-lg text-xs text-espresso focus:outline-none" />
                                  </div>
                                  <div className="col-span-2">
                                    <label className="text-[10px] text-espresso/50 mb-1 block">Preco R$</label>
                                    <input type="number" value={lot.price || ''} onChange={e => updateLot(lot.id, { price: Number(e.target.value) })}
                                      className="w-full px-2 py-1.5 bg-white/50 border border-white/60 rounded-lg text-xs text-espresso focus:outline-none" />
                                  </div>
                                  <div className="col-span-2">
                                    <label className="text-[10px] text-espresso/50 mb-1 block">Qtd</label>
                                    <input type="number" value={lot.capacity || ''} onChange={e => updateLot(lot.id, { capacity: Number(e.target.value) })}
                                      className="w-full px-2 py-1.5 bg-white/50 border border-white/60 rounded-lg text-xs text-espresso focus:outline-none" />
                                  </div>
                                  <div className="col-span-2">
                                    <label className="text-[10px] text-espresso/50 mb-1 block">Inicio</label>
                                    <input type="date" value={lot.startDate} onChange={e => updateLot(lot.id, { startDate: e.target.value })}
                                      className="w-full px-2 py-1.5 bg-white/50 border border-white/60 rounded-lg text-xs text-espresso focus:outline-none" />
                                  </div>
                                  <div className="col-span-2">
                                    <label className="text-[10px] text-espresso/50 mb-1 block">Fim</label>
                                    <input type="date" value={lot.endDate} onChange={e => updateLot(lot.id, { endDate: e.target.value })}
                                      className="w-full px-2 py-1.5 bg-white/50 border border-white/60 rounded-lg text-xs text-espresso focus:outline-none" />
                                  </div>
                                  <div className="col-span-1 flex items-center gap-1">
                                    <button onClick={() => updateLot(lot.id, { autoSwitch: !lot.autoSwitch })}
                                      title="Virada automatica" className="transition-all">
                                      {lot.autoSwitch ? <ToggleRight className="w-5 h-5 text-plum" /> : <ToggleLeft className="w-5 h-5 text-espresso/30" />}
                                    </button>
                                    <button onClick={() => removeLot(lot.id)} className="p-1 rounded hover:bg-red-50 text-espresso/30 hover:text-red-500">
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  <div className="col-span-12 flex items-center gap-2">
                                    <span className="text-[10px] text-espresso/30">{li + 1}o lote — {lot.autoSwitch ? 'Virada automatica ativa' : 'Virada manual'}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  <button onClick={() => addTicket(group.id)}
                    className="flex items-center gap-2 px-4 py-3 border border-dashed border-espresso/15 rounded-xl text-sm text-espresso/40 hover:text-plum hover:border-plum/30 transition-all w-full justify-center">
                    <Plus className="w-4 h-4" /> Adicionar Ingresso
                  </button>
                </div>
              )}
            </div>
          )
        })}
        <button onClick={addGroup}
          className="flex items-center gap-2 px-4 py-3 border border-dashed border-plum/30 rounded-xl text-sm text-plum hover:bg-plum/5 transition-all">
          <Plus className="w-4 h-4" /> Novo Grupo
        </button>
      </div>

      {/* ============ FORMULARIOS PERSONALIZADOS ============ */}
      <div className="mb-6 bg-white/60 border border-white/60 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <FileText className="w-5 h-5 text-plum" />
          <h2 className="font-serif text-xl text-espresso">Formularios Personalizados</h2>
          <span className="text-xs text-espresso/30">{customFields.length} campo(s)</span>
        </div>
        <p className="text-xs text-espresso/40 mb-4">Capture informacoes adicionais dos participantes durante a compra</p>

        {customFields.map((field, i) => (
          <div key={field.id} className="flex items-center gap-3 mb-3 p-3 bg-white/40 border border-white/60 rounded-xl">
            <span className="text-xs text-espresso/20 w-5">{i + 1}</span>
            <input value={field.label}
              onChange={e => updateField(field.id, { label: e.target.value })}
              placeholder="Nome do campo" className="flex-1 px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
            <select value={field.type}
              onChange={e => updateField(field.id, { type: e.target.value as CustomField['type'] })}
              className="px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso focus:outline-none focus:border-plum/30">
              <option value="text">Texto</option>
              <option value="email">E-mail</option>
              <option value="phone">Telefone</option>
              <option value="select">Lista</option>
              <option value="checkbox">Checkbox</option>
              <option value="date">Data</option>
            </select>
            {(field.type === 'select') && (
              <input value={field.options}
                onChange={e => updateField(field.id, { options: e.target.value })}
                placeholder="Op1, Op2, Op3" className="w-32 px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
            )}
            <button onClick={() => updateField(field.id, { required: !field.required })}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${field.required ? 'bg-plum/10 text-plum' : 'bg-white/40 text-espresso/30'}`}>
              {field.required ? 'Obrigatorio' : 'Opcional'}
            </button>
            <button onClick={() => removeCustomField(field.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-espresso/30 hover:text-red-500 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button onClick={addCustomField}
          className="flex items-center gap-2 px-4 py-3 border border-dashed border-espresso/15 rounded-xl text-sm text-espresso/40 hover:text-plum hover:border-plum/30 transition-all">
          <Plus className="w-4 h-4" /> Adicionar Campo
        </button>
      </div>

      {/* ============ CONFIGURACAO DE TAXA ============ */}
      <div className="mb-6 bg-white/60 border border-white/60 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Calculator className="w-5 h-5 text-plum" />
          <h2 className="font-serif text-xl text-espresso">Taxa de Servico</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-white/40 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-espresso">Taxa de Servico</h4>
              <button onClick={() => setTax({ ...tax, enabled: !tax.enabled })} className="transition-all">
                {tax.enabled ? <ToggleRight className="w-6 h-6 text-plum" /> : <ToggleLeft className="w-6 h-6 text-espresso/30" />}
              </button>
            </div>
            {tax.enabled && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-espresso/50 mb-1 block">Percentual (%)</label>
                  <input type="number" value={tax.percentage}
                    onChange={e => setTax({ ...tax, percentage: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso focus:outline-none focus:border-plum/30" />
                </div>
                <div>
                  <label className="text-xs text-espresso/50 mb-1 block">Valor Minimo (R$)</label>
                  <input type="number" value={tax.minAmount}
                    onChange={e => setTax({ ...tax, minAmount: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso focus:outline-none focus:border-plum/30" />
                  <p className="text-[10px] text-espresso/30 mt-1">Para ingressos com valor baixo, aplica o minimo</p>
                </div>
                <div>
                  <label className="text-xs text-espresso/50 mb-1 block">Quem paga a taxa?</label>
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => setTax({ ...tax, absorb: true })}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${tax.absorb ? 'bg-plum text-cream' : 'bg-white/40 text-espresso/40'}`}>
                      Produtor (absorve)
                    </button>
                    <button onClick={() => setTax({ ...tax, absorb: false })}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${!tax.absorb ? 'bg-plum text-cream' : 'bg-white/40 text-espresso/40'}`}>
                      Comprador (repassa)
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="md:col-span-2 p-4 bg-white/40 rounded-xl">
            <h4 className="text-sm font-medium text-espresso mb-3">Simulacao</h4>
            {tickets.map(t => {
              if (!tax.enabled) return null
              const fee = Math.max((t.price * tax.percentage) / 100, tax.minAmount)
              const finalPrice = tax.absorb ? t.price : t.price + fee
              return (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-white/60 last:border-0">
                  <span className="text-xs text-espresso/60">{t.name || 'Ingresso'}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-espresso/30">Base: R$ {t.price.toFixed(2)}</span>
                    <span className="text-xs text-plum">Taxa: R$ {fee.toFixed(2)}</span>
                    <span className="text-xs font-medium text-espresso">
                      {tax.absorb ? 'Produtor recebe' : 'Comprador paga'}: R$ {finalPrice.toFixed(2)}
                    </span>
                  </div>
                </div>
              )
            })}
            <div className="mt-3 p-3 bg-plum/5 rounded-lg">
              <p className="text-xs text-plum">
                {tax.absorb
                  ? 'O produtor absorve a taxa. O comprador ve o preco sem taxa adicional.'
                  : 'O comprador paga a taxa adicional. O produtor recebe o valor integral do ingresso.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button onClick={handleSave} className="px-8 py-3 bg-plum text-cream font-medium rounded-full hover:shadow-glow transition-all flex items-center gap-2">
          <Save className="w-4 h-4" /> Salvar Configuracao
        </button>
      </div>
    </div>
  )
}
