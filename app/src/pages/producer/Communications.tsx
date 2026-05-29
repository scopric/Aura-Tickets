import { useState, useEffect } from 'react'
import {
  Mail, MessageSquare, Send, Bell,
  X, TrendingUp, Eye, Trash2, Copy
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

interface Campaign {
  id: string
  name: string
  type: 'email' | 'sms' | 'push'
  subject: string
  audience: string
  sent: number
  openRate: number
  clickRate: number
  status: 'enviada' | 'agendada' | 'rascunho'
  date: string
  eventName: string
}

const templates = [
  { id: 'tp1', name: 'Lembrete de Evento', type: 'email' as const },
  { id: 'tp2', name: 'Promoção de Ingressos', type: 'email' as const },
  { id: 'tp3', name: 'Agradecimento Pós-Evento', type: 'email' as const },
  { id: 'tp4', name: 'Alerta SMS - Últimos Ingressos', type: 'sms' as const },
  { id: 'tp5', name: 'Push - Ingressos Liberados', type: 'push' as const },
]

export default function ProducerCommunications() {
  const { user } = useAuth()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'email' as Campaign['type'], subject: '', message: '', audience: 'Todos os participantes', eventName: '', schedule: false, date: '', time: '' })
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'email' | 'sms' | 'push'>('all')

  // Mapear dados do banco para o layout local do frontend
  const mapDbCommToCampaign = (dbComm: any): Campaign => {
    let frontStatus: Campaign['status'] = 'enviada'
    if (dbComm.status === 'pending') {
      frontStatus = 'agendada'
    } else if (dbComm.status === 'draft') {
      frontStatus = 'rascunho'
    }

    // Métricas — em produção viriam de tabela de analytics ou provedor de envio
    let mockOpen = 0
    let mockClick = 0
    let mockSent = 0

    if (dbComm.status === 'sent') {
      if (dbComm.type === 'email') {
        mockOpen = 0
        mockClick = 0
        mockSent = 0
      } else if (dbComm.type === 'sms') {
        mockOpen = 0
        mockClick = 0
        mockSent = 0
      } else {
        mockOpen = 0
        mockClick = 0
        mockSent = 0
      }
    }

    return {
      id: dbComm.id,
      name: dbComm.subject || 'Campanha de Comunicação',
      type: (dbComm.type || 'email') as Campaign['type'],
      subject: dbComm.subject || '',
      audience: dbComm.recipient || 'Todos os participantes',
      sent: mockSent,
      openRate: mockOpen,
      clickRate: mockClick,
      status: frontStatus,
      date: new Date(dbComm.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' }),
      eventName: dbComm.events?.title || 'Geral'
    }
  }

  // Carregar histórico de comunicações do Supabase
  const loadCampaigns = async () => {
    if (!user?.id) return
    setIsLoading(true)
    try {
      const { data: dbComms, error } = await supabase
        .from('communications')
        .select(`
          *,
          events (title)
        `)
        .eq('producer_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      if (!dbComms || dbComms.length === 0) {
        // Auto-seed apenas em desenvolvimento para demonstração
        if (import.meta.env.DEV) {
          await seedInitialCampaigns(user.id)
        }
        setIsLoading(false)
        return
      }

      setCampaigns(dbComms.map(mapDbCommToCampaign))
    } catch (err: any) {
      console.error('Erro ao carregar comunicações:', err)
      toast.error('Erro ao carregar histórico de comunicações')
    } finally {
      setIsLoading(false)
    }
  }

  // Realizar auto-seed para exibição do portfólio no localhost
  const seedInitialCampaigns = async (producerId: string) => {
    try {
      // Obter um evento do produtor para vincular se possível
      const { data: events } = await supabase
        .from('events')
        .select('id')
        .eq('producer_id', producerId)
        .limit(1)

      const eventId = events && events.length > 0 ? events[0].id : null

      const initialCommsData = [
        { producer_id: producerId, event_id: eventId, type: 'email', recipient: 'Compradores VIP', subject: 'Lembrete Noite Eletro', content: 'Faltam 2 dias! Preparado? A área VIP abre às 22h.', status: 'sent', created_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString() },
        { producer_id: producerId, event_id: eventId, type: 'email', recipient: 'Todos os participantes', subject: 'Promoção Early Bird', content: '50% OFF - Somente hoje. Aproveite os ingressos promocionais.', status: 'sent', created_at: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString() },
        { producer_id: producerId, event_id: eventId, type: 'sms', recipient: 'Compradores VIP', subject: 'SMS - Últimas Mesas', content: 'Apenas 5 mesas VIP restantes! Garanta o seu upgrade agora.', status: 'sent', created_at: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString() },
        { producer_id: producerId, event_id: eventId, type: 'push', recipient: 'Todos os participantes', subject: 'Push - Jazz Sunset', content: 'Novos ingressos extras liberados no lote 3!', status: 'pending', created_at: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString() },
        { producer_id: producerId, event_id: eventId, type: 'email', recipient: 'Lista de interesse', subject: 'Lembrete Palestra', content: 'Não esqueça de preencher sua ficha de presença para o certificado.', status: 'draft', created_at: new Date().toISOString() }
      ]

      const { error: insertError } = await supabase
        .from('communications')
        .insert(initialCommsData)

      if (insertError) throw insertError

      // Recarregar do banco
      const { data: finalComms } = await supabase
        .from('communications')
        .select(`
          *,
          events (title)
        `)
        .eq('producer_id', producerId)
        .order('created_at', { ascending: false })

      if (finalComms) {
        setCampaigns(finalComms.map(mapDbCommToCampaign))
      }
    } catch (err) {
      console.error('Erro no auto-seed de comunicações:', err)
    }
  }

  useEffect(() => {
    loadCampaigns()
  }, [user?.id])

  const filtered = campaigns
    .filter(c => activeTab === 'all' || c.type === activeTab)
    .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.subject.toLowerCase().includes(search.toLowerCase()))

  const totalSent = campaigns.reduce((s, c) => s + c.sent, 0)
  const avgOpen = campaigns.filter(c => c.openRate > 0).length > 0 ? Math.round(campaigns.filter(c => c.openRate > 0).reduce((s, c) => s + c.openRate, 0) / campaigns.filter(c => c.openRate > 0).length) : 0
  const avgClick = campaigns.filter(c => c.clickRate > 0).length > 0 ? Math.round(campaigns.filter(c => c.clickRate > 0).reduce((s, c) => s + c.clickRate, 0) / campaigns.filter(c => c.clickRate > 0).length) : 0

  // Salvar nova campanha no Supabase
  const addCampaign = async () => {
    if (!form.name || !form.subject) { 
      toast.error('Preencha o nome e o assunto da campanha')
      return 
    }
    if (!user?.id) return

    try {
      const commStatus = form.schedule ? 'pending' : 'draft'
      const scheduleTime = form.schedule && form.date ? new Date(`${form.date}T${form.time || '12:00'}:00`).toISOString() : new Date().toISOString()
      
      // Obter ID do primeiro evento do produtor para associar (opcional)
      const { data: events } = await supabase
        .from('events')
        .select('id')
        .eq('producer_id', user.id)
        .limit(1)
      const eventId = events && events.length > 0 ? events[0].id : null

      const { error } = await supabase
        .from('communications')
        .insert({
          producer_id: user.id,
          event_id: eventId,
          type: form.type,
          recipient: form.audience,
          subject: form.name,
          content: form.message || form.subject,
          status: commStatus,
          created_at: scheduleTime
        })
        .select()

      if (error) throw error

      toast.success(form.schedule ? 'Campanha agendada no Supabase!' : 'Rascunho salvo no Supabase!')
      setShowForm(false)
      
      // Limpar formulário
      setForm({ name: '', type: 'email', subject: '', message: '', audience: 'Todos os participantes', eventName: '', schedule: false, date: '', time: '' })
      
      // Recarregar
      loadCampaigns()
    } catch (err: any) {
      console.error('Erro ao criar campanha:', err)
      toast.error('Erro ao salvar campanha no banco')
    }
  }

  // Excluir campanha do Supabase
  const deleteCampaign = async (id: string) => {
    if (window.confirm('Deseja excluir esta campanha permanentemente?')) {
      try {
        const { error } = await supabase
          .from('communications')
          .delete()
          .eq('id', id)

        if (error) throw error

        toast.success('Campanha excluída')
        loadCampaigns()
      } catch (err: any) {
        console.error('Erro ao deletar campanha:', err)
        toast.error('Erro ao excluir campanha')
      }
    }
  }

  const typeIcons = {
    email: Mail,
    sms: MessageSquare,
    push: Bell,
  }

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Comunicação</h1>
          <p className="text-sm text-espresso/50 mt-1">E-mail marketing, SMS e notificações em tempo real</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-5 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all">
          <Send className="w-4 h-4" /> Nova Campanha
        </button>
      </div>

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="p-5 rounded-2xl bg-white/40 border border-white/60 animate-pulse text-center h-[98px]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Campanhas', value: campaigns.length.toString(), icon: Mail, color: 'text-plum' },
            { label: 'Mensagens Enviadas', value: totalSent.toLocaleString(), icon: Send, color: 'text-blue-600' },
            { label: 'Taxa de Abertura', value: `${avgOpen}%`, icon: Eye, color: 'text-amber-600' },
            { label: 'Taxa de Cliques', value: `${avgClick}%`, icon: TrendingUp, color: 'text-green-600' },
          ].map(k => (
            <div key={k.label} className="p-5 rounded-2xl bg-white/60 border border-white/60 text-center">
              <k.icon className={`w-5 h-5 ${k.color} mx-auto mb-2`} />
              <div className={`font-serif text-2xl ${k.color}`}>{k.value}</div>
              <div className="text-xs text-espresso/40 mt-1">{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Templates Quick Start */}
      <div className="mb-8 p-5 rounded-2xl bg-white/60 border border-white/60">
        <h3 className="text-sm font-medium text-espresso mb-3">Modelos Rápidos</h3>
        <div className="flex flex-wrap gap-2">
          {templates.map(t => {
            const Icon = typeIcons[t.type]
            return (
              <button key={t.id} onClick={() => { setForm({ ...form, type: t.type, name: t.name, subject: t.name }); setShowForm(true) }} className="flex items-center gap-2 px-4 py-2.5 bg-canvas rounded-xl text-xs text-espresso/60 hover:bg-plum/10 hover:text-plum transition-all border border-transparent hover:border-plum/20">
                <Icon className="w-3.5 h-3.5" /> {t.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-1 p-1 bg-white/60 border border-white/60 rounded-2xl w-fit">
          {[
            { id: 'all' as const, label: 'Todas', icon: Mail },
            { id: 'email' as const, label: 'E-mail', icon: Mail },
            { id: 'sms' as const, label: 'SMS', icon: MessageSquare },
            { id: 'push' as const, label: 'Push', icon: Bell },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all ${activeTab === t.id ? 'bg-plum text-cream' : 'text-espresso/40 hover:text-espresso/70'}`}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar campanhas..." className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 w-48" />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(n => (
            <div key={n} className="h-20 bg-white/40 border border-white/60 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => {
            const Icon = typeIcons[c.type]
            return (
              <div key={c.id} className="flex items-center gap-4 p-4 rounded-2xl bg-white/60 border border-white/60 hover:bg-white/80 transition-all">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${c.type === 'email' ? 'bg-blue-50' : c.type === 'sms' ? 'bg-green-50' : 'bg-amber-50'}`}>
                  <Icon className={`w-5 h-5 ${c.type === 'email' ? 'text-blue-600' : c.type === 'sms' ? 'text-green-600' : 'text-amber-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-sm font-medium text-espresso">{c.name}</h3>
                    <span className={`px-2 py-0.5 text-[9px] font-medium rounded-full ${
                      c.status === 'enviada' ? 'bg-green-50 text-green-600 border border-green-100' :
                      c.status === 'agendada' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                      'bg-gray-50 text-gray-500 border border-gray-100'
                    }`}>{c.status}</span>
                  </div>
                  <p className="text-xs text-espresso/40 truncate pr-4">{c.subject}</p>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-espresso/30">
                    <span>{c.audience}</span>
                    <span>{c.eventName}</span>
                    {c.sent > 0 && <span className="flex items-center gap-1"><Send className="w-3 h-3" /> {c.sent} disparos</span>}
                  </div>
                </div>
                {c.status === 'enviada' && (
                  <div className="text-right flex-shrink-0 hidden md:block">
                    <div className="text-xs text-espresso/60">{c.openRate}% abertura</div>
                    <div className="text-xs text-espresso/60">{c.clickRate}% cliques</div>
                  </div>
                )}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => { setForm({ ...form, name: `Cópia - ${c.name}`, type: c.type, subject: c.subject, audience: c.audience }); setShowForm(true); toast.success('Modelo copiado para edição!') }} className="p-1.5 rounded-lg hover:bg-canvas text-espresso/20 hover:text-espresso/60 transition-colors" title="Duplicar Campanha"><Copy className="w-3.5 h-3.5" /></button>
                  <button onClick={() => deleteCampaign(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-espresso/20 hover:text-red-500 transition-colors" title="Excluir Campanha"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="bg-white/40 border border-dashed border-espresso/10 rounded-2xl py-12 text-center text-xs text-espresso/30">
              Nenhuma campanha encontrada nesta categoria.
            </div>
          )}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-espresso/20 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-lg bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-elevated max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-serif text-xl text-espresso">Nova Campanha</h3>
              <button onClick={() => setShowForm(false)} aria-label="Fechar modal" title="Fechar" className="p-2 rounded-full hover:bg-canvas text-espresso/40 hover:text-espresso transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center bg-white/60 border border-white/60 rounded-full p-1">
                {(['email', 'sms', 'push'] as const).map(t => (
                  <button key={t} onClick={() => setForm({ ...form, type: t })} className={`flex-1 py-2 text-xs font-medium rounded-full transition-all ${form.type === t ? 'bg-plum text-cream' : 'text-espresso/40'}`}>
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs font-medium text-espresso/50 mb-1.5 block">Nome da Campanha *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Lembrete Importante 1" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              </div>
              <div>
                <label className="text-xs font-medium text-espresso/50 mb-1.5 block">Assunto da Mensagem *</label>
                <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="Assunto que aparecerá no destinatário..." className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              </div>
              <div>
                <label className="text-xs font-medium text-espresso/50 mb-1.5 block">Conteúdo Completo (Mensagem)</label>
                <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="Escreva o texto completo da mensagem aqui..." rows={4} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 resize-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-espresso/50 mb-1.5 block">Público Alvo</label>
                <select value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value })} aria-label="Selecionar público alvo" title="Público Alvo" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso/60 focus:outline-none">
                  <option value="Todos os participantes">Todos os participantes</option>
                  <option value="Compradores VIP">Compradores VIP</option>
                  <option value="Compradores Pista">Compradores Pista</option>
                  <option value="Lista de interesse">Lista de interesse</option>
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer pt-2">
                <input type="checkbox" checked={form.schedule} onChange={e => setForm({ ...form, schedule: e.target.checked })} className="accent-plum" />
                <span className="text-xs text-espresso/60">Agendar envio futuro</span>
              </label>
              {form.schedule && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <input type="date" aria-label="Data de agendamento" title="Data de agendamento" onChange={e => setForm({ ...form, date: e.target.value })} className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso/60 focus:outline-none" />
                  <input type="time" aria-label="Hora de agendamento" title="Hora de agendamento" onChange={e => setForm({ ...form, time: e.target.value })} className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso/60 focus:outline-none" />
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-espresso/5">
              <button onClick={() => setShowForm(false)} className="px-5 py-2.5 text-sm text-espresso/50 hover:text-espresso transition-colors">Cancelar</button>
              <button onClick={addCampaign} className="px-6 py-2.5 bg-plum text-cream text-sm rounded-full hover:shadow-glow transition-all">{form.schedule ? 'Agendar' : 'Disparar / Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
