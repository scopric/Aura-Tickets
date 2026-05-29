import { useState, useEffect } from 'react'
import {
  Users, TrendingUp, Target, Phone, Mail, MessageSquare,
  Star, ArrowRight, Search, CheckCircle2,
  Calendar, DollarSign, BarChart3, Plus, Trash2, X
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

interface Lead {
  id: string
  name: string
  email: string
  avatar: string
  status: 'novo' | 'qualificado' | 'proposta' | 'negociacao' | 'fechado'
  source: string
  score: number
  value: number
  lastContact: string
  eventInterest: string
  phone: string
  notes: string
  interactions: { date: string; type: string; content: string }[]
}

const columns = [
  { key: 'novo', label: 'Novo', color: 'bg-blue-100 text-blue-700', icon: Users },
  { key: 'qualificado', label: 'Qualificado', color: 'bg-amber-100 text-amber-700', icon: Target },
  { key: 'proposta', label: 'Proposta', color: 'bg-violet-100 text-violet-700', icon: Mail },
  { key: 'negociacao', label: 'Negociação', color: 'bg-orange-100 text-orange-700', icon: ArrowRight },
  { key: 'fechado', label: 'Fechado', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
] as const

export default function ProducerCRM() {
  const { user } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Lead | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  // Estados para o modal de novo lead
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newLeadName, setNewLeadName] = useState('')
  const [newLeadEmail, setNewLeadEmail] = useState('')
  const [newLeadPhone, setNewLeadPhone] = useState('')
  const [newLeadSource, setNewLeadSource] = useState('Instagram')
  const [newLeadValue, setNewLeadValue] = useState('')
  const [newLeadInterest, setNewLeadInterest] = useState('')
  const [newLeadNotes, setNewLeadNotes] = useState('')
  const [isSubmittingLead, setIsSubmittingLead] = useState(false)

  // Estados para nova interação
  const [newIntType, setNewIntType] = useState('Nota')
  const [newIntContent, setNewIntContent] = useState('')
  const [isSubmittingInt, setIsSubmittingInt] = useState(false)

  // Função para formatar data decorrida
  const formatTimeElapsed = (dateStr: string) => {
    try {
      const diffMs = new Date().getTime() - new Date(dateStr).getTime()
      const diffMins = Math.floor(diffMs / 60000)
      if (diffMins < 1) return 'Agora mesmo'
      if (diffMins < 60) return `Há ${diffMins} min`
      const diffHours = Math.floor(diffMins / 60)
      if (diffHours < 24) return `Há ${diffHours}h`
      return new Date(dateStr).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
    } catch {
      return ''
    }
  }

  // Mapear do banco de dados para a interface local
  const mapDbLeadToLead = (dbLead: any): Lead => {
    const sortedInteractions = (dbLead.crm_interactions || [])
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return {
      id: dbLead.id,
      name: dbLead.full_name,
      email: dbLead.email || '',
      avatar: dbLead.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${dbLead.full_name}`,
      status: (dbLead.stage_id || 'novo') as Lead['status'],
      source: dbLead.source || 'Organico',
      score: dbLead.score || 50,
      value: Number(dbLead.potential_value) || 0,
      lastContact: sortedInteractions[0]
        ? formatTimeElapsed(sortedInteractions[0].created_at)
        : 'Sem contato',
      eventInterest: dbLead.event_interest || '',
      phone: dbLead.phone || '',
      notes: dbLead.notes || '',
      interactions: sortedInteractions.map((int: any) => ({
        date: new Date(int.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }),
        type: int.type,
        content: int.content || '',
      })),
    }
  }

  // Carregar leads do Supabase
  const loadLeads = async () => {
    if (!user?.id) return
    setIsLoading(true)
    try {
      const { data: dbLeads, error } = await supabase
        .from('crm_leads')
        .select(`
          *,
          crm_interactions (*)
        `)
        .eq('producer_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      if (!dbLeads || dbLeads.length === 0) {
        // Auto-seed apenas em desenvolvimento para demonstração
        if (import.meta.env.DEV) {
          await seedInitialLeads(user.id)
        }
        return
      }

      setLeads(dbLeads.map(mapDbLeadToLead))
    } catch (err: any) {
      console.error('Erro ao carregar leads:', err)
      toast.error('Erro ao carregar leads do CRM')
    } finally {
      setIsLoading(false)
    }
  }

  // Criar registros iniciais (auto-seed) para demonstração sem telas vazias
  const seedInitialLeads = async (producerId: string) => {
    try {
      const initialLeadsData = [
        { producer_id: producerId, full_name: 'Pedro Santos', email: 'pedro@empresa.com', stage_id: 'novo', source: 'Instagram', score: 72, potential_value: 5000, event_interest: 'Festa Corporativa', phone: '(11) 98765-1111', notes: 'Interessado em evento para 100 pessoas' },
        { producer_id: producerId, full_name: 'Mariana Costa', email: 'mariana@design.com', stage_id: 'qualificado', source: 'Indicacao', score: 91, potential_value: 12000, event_interest: 'Noite Eletro 2025', phone: '(11) 98765-2222', notes: 'Ja comprou antes, quer upgrade' },
        { producer_id: producerId, full_name: 'Carlos Eduardo', email: 'carlos@tech.com', stage_id: 'proposta', source: 'Google Ads', score: 68, potential_value: 8500, event_interest: 'Workshop UX', phone: '(11) 98765-3333', notes: 'Aguardando aprovacao do gestor' },
        { producer_id: producerId, full_name: 'Fernanda Lima', email: 'fernanda@food.com', stage_id: 'negociacao', source: 'Afiliado', score: 85, potential_value: 15000, event_interest: 'Gastronomia Fest', phone: '(11) 98765-4444', notes: 'Negociando desconto de 10%' },
        { producer_id: producerId, full_name: 'Roberto Souza', email: 'roberto@corp.com', stage_id: 'fechado', source: 'LinkedIn', score: 94, potential_value: 22000, event_interest: 'Evento Corporativo Q3', phone: '(11) 98765-5555', notes: 'CONTRATO ASSINADO!' }
      ]

      const { data: createdLeads, error: leadsError } = await supabase
        .from('crm_leads')
        .insert(initialLeadsData)
        .select()

      if (leadsError) throw leadsError

      // Criar algumas interações iniciais vinculadas a esses leads
      if (createdLeads && createdLeads.length > 0) {
        const interactionsToInsert = []

        const findLeadId = (name: string) => createdLeads.find(l => l.full_name === name)?.id

        const pedroId = findLeadId('Pedro Santos')
        if (pedroId) {
          interactionsToInsert.push(
            { lead_id: pedroId, type: 'Visita', content: 'Visitou pagina do evento e preencheu cadastro.' },
            { lead_id: pedroId, type: 'Email', content: 'Clicou no email de lancamento do lote.' }
          )
        }

        const marianaId = findLeadId('Mariana Costa')
        if (marianaId) {
          interactionsToInsert.push(
            { lead_id: marianaId, type: 'Ligacao', content: 'Conversa de 15 min por telefone, interesse em area VIP confirmado.' },
            { lead_id: marianaId, type: 'WhatsApp', content: 'Pediu orcamento de camarote privado.' }
          )
        }

        const carlosId = findLeadId('Carlos Eduardo')
        if (carlosId) {
          interactionsToInsert.push(
            { lead_id: carlosId, type: 'Email', content: 'Primeira proposta comercial enviada por e-mail.' }
          )
        }

        const fernandaId = findLeadId('Fernanda Lima')
        if (fernandaId) {
          interactionsToInsert.push(
            { lead_id: fernandaId, type: 'Ligacao', content: 'Negociacao ativa. Solicitou 10% de desconto para faturar corporativo.' }
          )
        }

        const robertoId = findLeadId('Roberto Souza')
        if (robertoId) {
          interactionsToInsert.push(
            { lead_id: robertoId, type: 'Fechamento', content: 'Contrato de patrocinio assinado e lote de ingressos faturado!' }
          )
        }

        if (interactionsToInsert.length > 0) {
          await supabase.from('crm_interactions').insert(interactionsToInsert)
        }
      }

      // Recarregar os dados agora já semeados no banco
      const { data: finalLeads } = await supabase
        .from('crm_leads')
        .select(`
          *,
          crm_interactions (*)
        `)
        .eq('producer_id', producerId)
        .order('created_at', { ascending: false })

      if (finalLeads) {
        setLeads(finalLeads.map(mapDbLeadToLead))
      }
    } catch (err: any) {
      console.error('Erro no auto-seed de CRM:', err)
    }
  }

  useEffect(() => {
    loadLeads()
  }, [user?.id])

  const filtered = leads.filter(l => !search || l.name.toLowerCase().includes(search.toLowerCase()))

  const stats = {
    total: leads.length,
    novos: leads.filter(l => l.status === 'novo').length,
    conversao: leads.length > 0 ? Math.round((leads.filter(l => l.status === 'fechado').length / leads.length) * 100) : 0,
    revenue: leads.filter(l => l.status === 'fechado').reduce((s, l) => s + l.value, 0),
    pipeline: leads.reduce((s, l) => s + l.value, 0),
    avgScore: leads.length > 0 ? Math.round(leads.reduce((s, l) => s + l.score, 0) / leads.length) : 0,
  }

  const handleDragStart = (id: string) => setDraggedId(id)
  const handleDragOver = (e: React.DragEvent, col: string) => { e.preventDefault(); setDragOverCol(col) }
  const handleDragLeave = () => setDragOverCol(null)
  
  const handleDrop = async (col: string) => {
    if (draggedId) {
      const originalLeads = [...leads]
      // Atualização otimista no estado
      setLeads(leads.map(l => l.id === draggedId ? { ...l, status: col as Lead['status'] } : l))
      
      const lead = leads.find(l => l.id === draggedId)
      if (lead) {
        try {
          const { error } = await supabase
            .from('crm_leads')
            .update({ stage_id: col })
            .eq('id', draggedId)

          if (error) throw error

          toast.success(`${lead.name} movido para ${columns.find(c => c.key === col)?.label}`)

          // Registrar nova interação de movimentação
          await supabase.from('crm_interactions').insert({
            lead_id: draggedId,
            type: 'Movimentacao',
            content: `Fase do pipeline alterada para: ${columns.find(c => c.key === col)?.label}`
          })
          
          // Se o lead movido for o que está aberto no Drawer, atualizamos ele também
          if (selected && selected.id === draggedId) {
            setSelected({ ...selected, status: col as Lead['status'] })
          }
        } catch (err: any) {
          console.error('Erro ao atualizar fase do lead:', err)
          setLeads(originalLeads)
          toast.error('Erro ao salvar alteração no banco de dados')
        }
      }
      setDraggedId(null)
    }
    setDragOverCol(null)
  }

  // Adicionar novo lead no banco
  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLeadName.trim()) {
      toast.error('Preencha o nome do lead')
      return
    }
    if (!user?.id) return

    setIsSubmittingLead(true)
    try {
      const score = Math.floor(Math.random() * 40) + 50 // Gerar score aleatório inicial entre 50 e 90
      const potentialValue = Number(newLeadValue) || 0

      const { data: createdLead, error } = await supabase
        .from('crm_leads')
        .insert({
          producer_id: user.id,
          full_name: newLeadName,
          email: newLeadEmail || null,
          phone: newLeadPhone || null,
          source: newLeadSource,
          score: score,
          potential_value: potentialValue,
          event_interest: newLeadInterest || null,
          notes: newLeadNotes || null,
          stage_id: 'novo',
        })
        .select()
        .single()

      if (error) throw error

      // Criar interação inicial com as notas
      if (newLeadNotes.trim() && createdLead) {
        await supabase.from('crm_interactions').insert({
          lead_id: createdLead.id,
          type: 'Cadastro',
          content: `Lead adicionado com notas iniciais: "${newLeadNotes}"`
        })
      } else if (createdLead) {
        await supabase.from('crm_interactions').insert({
          lead_id: createdLead.id,
          type: 'Cadastro',
          content: 'Lead criado no pipeline.'
        })
      }

      toast.success('Lead adicionado com sucesso!')
      setIsAddModalOpen(false)
      
      // Limpar campos
      setNewLeadName('')
      setNewLeadEmail('')
      setNewLeadPhone('')
      setNewLeadValue('')
      setNewLeadInterest('')
      setNewLeadNotes('')

      // Recarregar leads
      loadLeads()
    } catch (err: any) {
      console.error('Erro ao criar lead:', err)
      toast.error(err.message || 'Erro ao criar lead no Supabase')
    } finally {
      setIsSubmittingLead(false)
    }
  }

  // Deletar lead do banco
  const handleDeleteLead = async (id: string, name: string) => {
    if (window.confirm(`Tem certeza que deseja excluir o lead "${name}"? Esta ação excluirá todo o histórico de interações.`)) {
      try {
        const { error } = await supabase
          .from('crm_leads')
          .delete()
          .eq('id', id)

        if (error) throw error

        toast.success(`Lead ${name} excluído`)
        if (selected?.id === id) setSelected(null)
        loadLeads()
      } catch (err: any) {
        console.error('Erro ao deletar lead:', err)
        toast.error('Erro ao excluir o lead')
      }
    }
  }

  // Adicionar nova interação no banco
  const handleAddInteraction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newIntContent.trim() || !selected) {
      toast.error('Preencha o conteúdo da interação')
      return
    }

    setIsSubmittingInt(true)
    try {
      const { error } = await supabase
        .from('crm_interactions')
        .insert({
          lead_id: selected.id,
          type: newIntType,
          content: newIntContent,
        })

      if (error) throw error

      toast.success('Interação registrada com sucesso!')
      setNewIntContent('')

      // Recarregar os detalhes do lead selecionado e a lista principal
      const { data: updatedDbLead } = await supabase
        .from('crm_leads')
        .select(`
          *,
          crm_interactions (*)
        `)
        .eq('id', selected.id)
        .single()

      if (updatedDbLead) {
        const mapped = mapDbLeadToLead(updatedDbLead)
        setSelected(mapped)
        
        // Atualiza na lista em memória também para evitar novo refetch total imediato
        setLeads(leads.map(l => l.id === selected.id ? mapped : l))
      }
    } catch (err: any) {
      console.error('Erro ao adicionar interação:', err)
      toast.error('Erro ao salvar interação no banco')
    } finally {
      setIsSubmittingInt(false)
    }
  }

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">CRM</h1>
          <p className="text-sm text-espresso/50 mt-1">Pipeline, leads e comunicação integrada</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative max-w-xs w-full flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-espresso/20" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar leads..." className="w-full pl-9 pr-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
          </div>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Novo Lead
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-8">
          {[1, 2, 3, 4, 5, 6].map(n => (
            <div key={n} className="p-4 rounded-2xl bg-white/40 border border-white/60 animate-pulse text-center h-[90px]">
              <div className="w-4 h-4 bg-espresso/5 rounded-full mx-auto mb-2" />
              <div className="h-4 bg-espresso/5 rounded w-12 mx-auto mb-2" />
              <div className="h-3 bg-espresso/5 rounded w-16 mx-auto" />
            </div>
          ))}
        </div>
      ) : (
        /* KPIs */
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-8">
          {[
            { label: 'Total Leads', value: stats.total, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Novos', value: stats.novos, icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
            { label: 'Conversão', value: `${stats.conversao}%`, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Score Médio', value: stats.avgScore, icon: Star, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Receita Fechada', value: stats.revenue >= 10000 ? `R$ ${(stats.revenue / 1000).toFixed(1)}K` : `R$ ${stats.revenue}`, icon: DollarSign, color: 'text-plum', bg: 'bg-plum/5' },
            { label: 'Pipeline Total', value: stats.pipeline >= 10000 ? `R$ ${(stats.pipeline / 1000).toFixed(1)}K` : `R$ ${stats.pipeline}`, icon: BarChart3, color: 'text-violet-600', bg: 'bg-violet-50' },
          ].map(s => (
            <div key={s.label} className={`p-4 rounded-2xl ${s.bg} border border-white/60 text-center`}>
              <s.icon className={`w-4 h-4 ${s.color} mx-auto mb-1.5`} />
              <div className={`font-serif text-lg ${s.color}`}>{s.value}</div>
              <div className="text-[10px] text-espresso/40 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Kanban */}
      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map(col => (
            <div key={col.key} className="flex-shrink-0 w-72 rounded-2xl p-4 bg-white/20 border border-white/40 space-y-4">
              <div className="h-5 bg-espresso/5 rounded w-20 animate-pulse" />
              {[1, 2].map(n => (
                <div key={n} className="p-3 bg-white/40 border border-white/40 rounded-xl space-y-2 h-[100px] animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map(col => {
            const colLeads = filtered.filter(l => l.status === col.key)
            const isOver = dragOverCol === col.key
            return (
              <div
                key={col.key}
                className={`flex-shrink-0 w-72 rounded-2xl bg-white/30 border border-white/60 transition-all ${isOver ? 'ring-2 ring-plum/30 scale-[1.02]' : ''}`}
                onDragOver={e => handleDragOver(e, col.key)}
                onDragLeave={handleDragLeave}
                onDrop={() => handleDrop(col.key)}
              >
                <div className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <col.icon className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium text-espresso">{col.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-canvas text-espresso/40">{colLeads.length}</span>
                  </div>
                </div>
                <div className="p-2 space-y-2 max-h-[500px] overflow-y-auto">
                  {colLeads.map(l => (
                    <div
                      key={l.id}
                      draggable
                      onDragStart={() => handleDragStart(l.id)}
                      onClick={() => setSelected(l)}
                      className="p-3 rounded-xl bg-white/60 border border-white/60 hover:shadow-md hover:bg-white/80 transition-all cursor-grab active:cursor-grabbing group relative"
                    >
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteLead(l.id, l.name) }}
                        className="absolute top-2 right-2 p-1 rounded-md text-espresso/10 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                        title="Excluir Lead"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      <div className="flex items-center gap-2 mb-2 pr-4">
                        <img src={l.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-espresso truncate">{l.name}</div>
                          <div className="text-[9px] text-espresso/30">{l.source}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mb-1.5">
                        <Star className="w-3 h-3 text-amber-400" />
                        <span className="text-[10px] text-espresso/50">{l.score}</span>
                        <span className="text-[10px] text-plum ml-auto">R$ {l.value.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1 pt-1 border-t border-espresso/5">
                        <span className="text-[9px] text-espresso/25 truncate max-w-[150px]">{l.eventInterest || 'Interesse geral'}</span>
                        <span className="text-[8px] text-espresso/30 font-medium">{l.lastContact}</span>
                      </div>
                    </div>
                  ))}
                  {colLeads.length === 0 && <div className="py-8 text-center text-[10px] text-espresso/15">Arraste leads aqui</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal: Novo Lead */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)} />
          <div className="relative w-full max-w-md bg-canvas border border-white/60 rounded-3xl p-6 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-serif text-xl text-espresso flex items-center gap-2">
                <Users className="w-5 h-5 text-plum" />
                Adicionar Novo Lead
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} aria-label="Fechar modal" title="Fechar" className="p-1 rounded-lg hover:bg-espresso/5 text-espresso/40">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddLead} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Nome Completo *</label>
                <input 
                  type="text" 
                  required 
                  value={newLeadName} 
                  onChange={e => setNewLeadName(e.target.value)} 
                  placeholder="Pedro Santos" 
                  className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" 
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-espresso/60 mb-1.5 block">E-mail</label>
                  <input 
                    type="email" 
                    value={newLeadEmail} 
                    onChange={e => setNewLeadEmail(e.target.value)} 
                    placeholder="ex@email.com" 
                    className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" 
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Telefone</label>
                  <input 
                    type="text" 
                    value={newLeadPhone} 
                    onChange={e => setNewLeadPhone(e.target.value)} 
                    placeholder="(11) 98765-4321" 
                    className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Origem do Lead</label>
                  <select 
                    value={newLeadSource} 
                    onChange={e => setNewLeadSource(e.target.value)} 
                    aria-label="Selecionar origem do lead"
                    title="Origem do Lead"
                    className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30"
                  >
                    <option value="Instagram">Instagram</option>
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="Google Ads">Google Ads</option>
                    <option value="Facebook">Facebook</option>
                    <option value="Indicacao">Indicação</option>
                    <option value="Afiliado">Afiliado</option>
                    <option value="Organico">Orgânico</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Valor Estimado (R$)</label>
                  <input 
                    type="number" 
                    value={newLeadValue} 
                    onChange={e => setNewLeadValue(e.target.value)} 
                    placeholder="1000" 
                    className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" 
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Evento de Interesse</label>
                <input 
                  type="text" 
                  value={newLeadInterest} 
                  onChange={e => setNewLeadInterest(e.target.value)} 
                  placeholder="Ex: Noite Eletro 2025" 
                  className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" 
                />
              </div>
              <div>
                <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Notas Iniciais</label>
                <textarea 
                  value={newLeadNotes} 
                  onChange={e => setNewLeadNotes(e.target.value)} 
                  rows={3} 
                  placeholder="Observações ou necessidades do lead..." 
                  className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 resize-none" 
                />
              </div>
              <button 
                type="submit" 
                disabled={isSubmittingLead}
                className="w-full py-3 bg-plum text-cream font-medium rounded-full hover:shadow-glow transition-all flex items-center justify-center gap-2"
              >
                {isSubmittingLead ? 'Adicionando...' : 'Adicionar Lead'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-md bg-canvas border-l border-espresso/10 h-full overflow-y-auto shadow-2xl flex flex-col justify-between">
            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <img src={selected.avatar} alt="" className="w-14 h-14 rounded-full object-cover ring-2 ring-plum/30" />
                  <div>
                    <h3 className="font-serif text-xl text-espresso">{selected.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${columns.find(c => c.key === selected.status)?.color}`}>
                        {columns.find(c => c.key === selected.status)?.label}
                      </span>
                      <span className="text-[10px] text-espresso/40">Score: {selected.score}</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} aria-label="Fechar detalhes" title="Fechar" className="p-2 rounded-full bg-white/60 border border-white/60 text-espresso/40 hover:text-espresso">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Informações de contato */}
              <div className="space-y-2.5 mb-6 p-4 rounded-xl bg-white/40 border border-white/60">
                <div className="flex items-center gap-2 text-sm text-espresso/60"><Mail className="w-4 h-4 text-espresso/30" />{selected.email || 'Sem e-mail'}</div>
                <div className="flex items-center gap-2 text-sm text-espresso/60"><Phone className="w-4 h-4 text-espresso/30" />{selected.phone || 'Sem telefone'}</div>
                <div className="flex items-center gap-2 text-sm text-espresso/60"><Calendar className="w-4 h-4 text-espresso/30" />Contato: {selected.lastContact}</div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="p-4 rounded-xl bg-white/60 border border-white/60 text-center">
                  <div className="font-serif text-xl text-plum">{selected.score}</div>
                  <div className="text-[10px] text-espresso/30">Score de Interesse</div>
                </div>
                <div className="p-4 rounded-xl bg-white/60 border border-white/60 text-center">
                  <div className="font-serif text-xl text-green-600">R$ {selected.value.toLocaleString()}</div>
                  <div className="text-[10px] text-espresso/30">Valor Estimado</div>
                </div>
              </div>

              {selected.notes && (
                <div className="mb-6 p-4 rounded-xl bg-white/60 border border-white/60">
                  <div className="text-[10px] text-espresso/30 uppercase mb-1">Notas Principais</div>
                  <div className="text-xs text-espresso/70 leading-relaxed whitespace-pre-wrap">{selected.notes}</div>
                </div>
              )}

              {/* Formulário: Registrar Interação */}
              <div className="mb-6 p-4 rounded-xl bg-white/60 border border-white/60">
                <h4 className="text-xs font-semibold text-espresso/60 uppercase mb-3">Registrar Contato / Nota</h4>
                <form onSubmit={handleAddInteraction} className="space-y-3">
                  <div className="flex gap-2">
                    {['Nota', 'WhatsApp', 'Ligação', 'Email', 'Reunião'].map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setNewIntType(type)}
                        className={`flex-1 py-1 rounded-lg text-[10px] font-medium transition-all border ${
                          newIntType === type 
                            ? 'bg-plum text-cream border-plum' 
                            : 'bg-white/40 border-white/60 text-espresso/60 hover:bg-white/70'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  <textarea
                    required
                    value={newIntContent}
                    onChange={e => setNewIntContent(e.target.value)}
                    rows={2}
                    placeholder={`Conteúdo do contato ou anotação para o ${newIntType}...`}
                    className="w-full px-3 py-2 bg-white border border-white/60 rounded-lg text-xs text-espresso focus:outline-none focus:border-plum/30 resize-none"
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingInt}
                    className="w-full py-2 bg-plum text-cream text-xs font-medium rounded-full hover:shadow-glow transition-all"
                  >
                    {isSubmittingInt ? 'Registrando...' : 'Registrar Interação'}
                  </button>
                </form>
              </div>

              {/* Histórico de interações */}
              <h4 className="text-xs font-semibold text-espresso/40 uppercase mb-3">Histórico de Interações</h4>
              <div className="space-y-2">
                {selected.interactions.map((int, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/40 border border-white/20">
                    <div className="w-8 h-8 rounded-lg bg-canvas flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-3.5 h-3.5 text-plum" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-espresso">{int.type}</span>
                        <span className="text-[9px] text-espresso/30">{int.date}</span>
                      </div>
                      <p className="text-xs text-espresso/60 leading-relaxed mt-0.5 break-words">{int.content}</p>
                    </div>
                  </div>
                ))}
                {selected.interactions.length === 0 && (
                  <div className="text-center py-6 text-xs text-espresso/30">Nenhum contato registrado ainda.</div>
                )}
              </div>
            </div>

            {/* Footer com Ações rápidas */}
            <div className="p-6 bg-white/40 border-t border-espresso/5 flex items-center gap-2">
              <button 
                onClick={() => { navigator.clipboard.writeText(selected.email); toast.success('E-mail copiado!') }} 
                className="flex-1 py-2.5 bg-plum text-cream text-xs rounded-full hover:shadow-glow font-medium flex items-center justify-center gap-1.5"
              >
                <Mail className="w-3.5 h-3.5" />
                Copiar E-mail
              </button>
              <button 
                onClick={() => {
                  if (selected.phone) {
                    window.open(`https://wa.me/55${selected.phone.replace(/[^0-9]/g, '')}`, '_blank');
                    toast.success('WhatsApp iniciado!');
                  } else {
                    toast.error('Lead não possui telefone cadastrado');
                  }
                }} 
                className="flex-1 py-2.5 bg-canvas text-espresso/70 hover:text-espresso text-xs rounded-full hover:bg-white/80 border border-white/60 font-medium flex items-center justify-center gap-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
