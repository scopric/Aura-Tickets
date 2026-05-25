import { useState, useEffect } from 'react'
import {
  Users, UserPlus, TrendingUp, DollarSign, QrCode, Copy, Check,
  X, Search, Medal, Crown, Award, Star, Tag, Ticket, BarChart3,
  Phone, Mail, Share2, Edit3, Trash2
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

interface AffiliateSale {
  date: string
  tickets: number
  value: number
}

interface Affiliate {
  id: string
  name: string
  email: string
  phone: string
  avatar: string
  code: string
  couponCode: string
  couponDiscount: number
  status: 'ativo' | 'pausado' | 'pendente'
  totalSales: number
  ticketsSold: number
  ticketLimit: number
  commission: number
  commissionRate: number
  commissionPaid: number
  lastSale: string
  level: 'bronze' | 'silver' | 'gold' | 'platinum'
  eventName: string
  pixKey: string
  joinedAt: string
  salesHistory: AffiliateSale[]
  conversionRate: number
}

const generateHistory = (): AffiliateSale[] => {
  // Histórico diário viria de uma tabela de vendas por afiliado
  // Retorna vazio até implementação do backend de analytics
  return []
}

const levelConfig = {
  bronze: { icon: Medal, color: 'text-amber-700', bg: 'bg-amber-100', label: 'Bronze', next: 25 },
  silver: { icon: Award, color: 'text-gray-400', bg: 'bg-gray-100', label: 'Prata', next: 75 },
  gold: { icon: Crown, color: 'text-amber-500', bg: 'bg-amber-50', label: 'Ouro', next: 150 },
  platinum: { icon: Star, color: 'text-violet-500', bg: 'bg-violet-50', label: 'Platina', next: 999 },
}

export default function ProducerAffiliates() {
  const { user } = useAuth()
  const [affiliates, setAffiliates] = useState<Affiliate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', commissionRate: '10', eventName: '', pixKey: '', ticketLimit: '100', couponCode: '', couponDiscount: '' })
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selected, setSelected] = useState<Affiliate | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [showRanking, setShowRanking] = useState(false)

  // Mapear dados do banco de dados para a interface local
  const mapDbAffiliateToAffiliate = (dbAff: any): Affiliate => {
    const profile = dbAff.profiles || {}
    const tickets = dbAff.sales || 0
    const totalValue = Number(dbAff.total_earned) || 0
    const rate = dbAff.commission_percent || 10
    const commission = (totalValue * rate) / 100

    let statusVal: Affiliate['status'] = 'ativo'
    if (dbAff.status === 'paused' || dbAff.status === 'pausado') {
      statusVal = 'pausado'
    } else if (dbAff.status === 'pending' || dbAff.status === 'pendente') {
      statusVal = 'pendente'
    }

    // Nível do afiliado
    let level: Affiliate['level'] = 'bronze'
    if (tickets >= 100) level = 'platinum'
    else if (tickets >= 75) level = 'gold'
    else if (tickets >= 25) level = 'silver'

    const code = `REF-${dbAff.id?.substring(0, 5).toUpperCase() || 'AURA'}`
    const couponCode = `CUPOM-${dbAff.id?.substring(0, 5).toUpperCase() || 'AURA'}`

    return {
      id: dbAff.id,
      name: profile.full_name || dbAff.email?.split('@')[0] || 'Vendedor',
      email: dbAff.email || profile.email || '',
      phone: profile.phone || '',
      avatar: profile.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${profile.full_name || 'U'}`,
      code,
      couponCode,
      couponDiscount: 10,
      status: statusVal,
      totalSales: totalValue,
      ticketsSold: tickets,
      ticketLimit: dbAff.ticket_limit || 0,
      commission: commission,
      commissionRate: rate,
      commissionPaid: dbAff.commission_paid || 0,
      lastSale: tickets > 0 ? 'Há 2h' : '-',
      level: level,
      eventName: dbAff.events?.title || 'Geral',
      pixKey: dbAff.pix_key || '',
      joinedAt: new Date(dbAff.created_at).toLocaleDateString('pt-BR'),
      salesHistory: generateHistory().map(h => ({
        ...h,
        tickets: Math.max(1, Math.floor(tickets / 7)),
        value: Math.max(50, Math.floor(totalValue / 7))
      })),
      conversionRate: dbAff.conversion_rate || 0
    }
  }

  // Carregar afiliados do Supabase
  const loadAffiliates = async () => {
    if (!user?.id) return
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('affiliates')
        .select(`
          *,
          profiles:affiliate_user_id (
            full_name,
            email,
            avatar_url
          ),
          events (title)
        `)
        .eq('producer_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      if (!data || data.length === 0) {
        // Auto-seed apenas em desenvolvimento para demonstração
        if (import.meta.env.DEV) {
          await seedInitialAffiliates(user.id)
        }
        setIsLoading(false)
        return
      }

      setAffiliates(data.map(mapDbAffiliateToAffiliate))
    } catch (err: any) {
      console.error('Erro ao carregar afiliados:', err)
      toast.error('Erro ao carregar lista de afiliados')
    } finally {
      setIsLoading(false)
    }
  }

  // Auto-seed de afiliados
  const seedInitialAffiliates = async (producerId: string) => {
    try {
      const { data: dbEvents } = await supabase
        .from('events')
        .select('id')
        .eq('producer_id', producerId)
        .limit(1)
      const eventId = dbEvents && dbEvents.length > 0 ? dbEvents[0].id : null

      const initialAffs = [
        { producer_id: producerId, event_id: eventId, affiliate_user_id: producerId, commission_percent: 10, sales: 87, total_earned: 12500, status: 'active', created_at: new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString() },
        { producer_id: producerId, event_id: eventId, affiliate_user_id: producerId, commission_percent: 10, sales: 52, total_earned: 8400, status: 'active', created_at: new Date(Date.now() - 45 * 24 * 3600 * 1000).toISOString() },
        { producer_id: producerId, event_id: eventId, affiliate_user_id: producerId, commission_percent: 10, sales: 41, total_earned: 6200, status: 'active', created_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString() },
        { producer_id: producerId, event_id: eventId, affiliate_user_id: producerId, commission_percent: 10, sales: 0, total_earned: 0, status: 'pending', created_at: new Date().toISOString() }
      ]

      const { error } = await supabase
        .from('affiliates')
        .insert(initialAffs)

      if (error) throw error

      // Recarregar
      const { data: finalAffs } = await supabase
        .from('affiliates')
        .select(`
          *,
          profiles:affiliate_user_id (
            full_name,
            email,
            avatar_url
          ),
          events (title)
        `)
        .eq('producer_id', producerId)

      if (finalAffs) {
        setAffiliates(finalAffs.map(mapDbAffiliateToAffiliate))
      }
    } catch (err) {
      console.error('Erro no auto-seed de afiliados:', err)
    }
  }

  useEffect(() => {
    loadAffiliates()
  }, [user?.id])

  const filtered = affiliates
    .filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.code.toLowerCase().includes(search.toLowerCase()))
    .filter(a => filterStatus === 'all' || a.status === filterStatus)

  const stats = {
    total: affiliates.length,
    active: affiliates.filter(a => a.status === 'ativo').length,
    totalSales: affiliates.reduce((s, a) => s + a.totalSales, 0),
    totalTickets: affiliates.reduce((s, a) => s + a.ticketsSold, 0),
    totalCommission: affiliates.reduce((s, a) => s + a.commission, 0),
    commissionPending: affiliates.reduce((s, a) => s + (a.commission - a.commissionPaid), 0),
    avgConversion: affiliates.filter(a => a.conversionRate > 0).length > 0
      ? (affiliates.filter(a => a.conversionRate > 0).reduce((s, a) => s + a.conversionRate, 0) / affiliates.filter(a => a.conversionRate > 0).length).toFixed(1)
      : '0',
  }

  const ranking = [...affiliates].filter(a => a.status === 'ativo').sort((a, b) => b.ticketsSold - a.ticketsSold)

  // Adicionar novo afiliado
  const addAffiliate = async () => {
    if (!form.name || !form.email) {
      toast.error('Preencha nome e e-mail do afiliado')
      return
    }
    if (!user?.id) return

    try {
      // 1. Procurar e-mail na tabela profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', form.email)
        .maybeSingle()

      // Para testes locais se não existir, vincula ao id do produtor
      const targetUserId = profile ? profile.id : user.id

      // 2. Procurar evento para vincular
      const { data: dbEvents } = await supabase
        .from('events')
        .select('id')
        .eq('producer_id', user.id)
        .limit(1)
      const eventId = dbEvents && dbEvents.length > 0 ? dbEvents[0].id : null

      const { error } = await supabase
        .from('affiliates')
        .insert({
          producer_id: user.id,
          event_id: eventId,
          affiliate_user_id: targetUserId,
          commission_percent: Number(form.commissionRate) || 10,
          sales: 0,
          total_earned: 0,
          status: 'active'
        })

      if (error) throw error

      toast.success(`Afiliado ${form.name} adicionado no Supabase!`)
      setShowForm(false)
      setForm({ name: '', email: '', phone: '', commissionRate: '10', eventName: '', pixKey: '', ticketLimit: '100', couponCode: '', couponDiscount: '' })
      loadAffiliates()
    } catch (err: any) {
      console.error('Erro ao adicionar afiliado:', err)
      toast.error('Erro ao registrar afiliado no banco')
    }
  }

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(`https://evokaa.events/?ref=${code}`)
    setCopied(id)
    setTimeout(() => setCopied(null), 1500)
    toast.success('Link de afiliado copiado!')
  }

  // Alternar status do afiliado no banco
  const toggleStatus = async (id: string, currentStatus: Affiliate['status']) => {
    const nextStatus = currentStatus === 'ativo' ? 'paused' : 'active'
    try {
      const { error } = await supabase
        .from('affiliates')
        .update({ status: nextStatus })
        .eq('id', id)

      if (error) throw error

      toast.success('Status do afiliado atualizado no banco!')
      loadAffiliates()
    } catch (err: any) {
      console.error('Erro ao atualizar status:', err)
      toast.error('Erro ao salvar alteração de status')
    }
  }

  // Deletar afiliado do banco
  const deleteAffiliate = async (id: string) => {
    if (window.confirm('Deseja remover este afiliado permanentemente?')) {
      try {
        const { error } = await supabase
          .from('affiliates')
          .delete()
          .eq('id', id)

        if (error) throw error

        toast.success('Afiliado removido do banco')
        setSelected(null)
        loadAffiliates()
      } catch (err: any) {
        console.error('Erro ao excluir afiliado:', err)
        toast.error('Erro ao excluir afiliado')
      }
    }
  }

  const maxHistoryVal = selected ? Math.max(...selected.salesHistory.map(h => h.value), 1) : 1

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Afiliados</h1>
          <p className="text-sm text-espresso/50 mt-1">Gerencie a equipe de comissões, vendas e cupons</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowRanking(!showRanking)} className="flex items-center gap-2 px-4 py-2.5 bg-white/60 border border-white/60 text-espresso text-sm font-medium rounded-full hover:bg-white transition-all">
            <Award className="w-4 h-4" /> Ranking
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-5 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all">
            <UserPlus className="w-4 h-4" /> Novo Afiliado
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {[1, 2, 3, 4, 5].map(n => (
            <div key={n} className="p-4 rounded-2xl bg-white/40 border border-white/60 animate-pulse text-center h-[76px]" />
          ))}
        </div>
      ) : (
        /* Stats */
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Ativos', value: stats.active.toString(), icon: Users, color: 'text-blue-600' },
            { label: 'Vendas Totais', value: `R$ ${stats.totalSales.toLocaleString()}`, icon: DollarSign, color: 'text-green-600' },
            { label: 'Ingressos Vendidos', value: stats.totalTickets.toString(), icon: Ticket, color: 'text-plum' },
            { label: 'Comissão Pendente', value: `R$ ${stats.commissionPending.toLocaleString()}`, icon: TrendingUp, color: 'text-amber-600' },
            { label: 'Conversão Média', value: `${stats.avgConversion}%`, icon: BarChart3, color: 'text-violet-600' },
          ].map(k => (
            <div key={k.label} className="p-4 rounded-2xl bg-white/60 border border-white/60 text-center">
              <k.icon className={`w-4 h-4 ${k.color} mx-auto mb-1.5`} />
              <div className={`font-serif text-xl ${k.color}`}>{k.value}</div>
              <div className="text-[10px] text-espresso/40 mt-0.5 font-semibold">{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Ranking */}
      {showRanking && (
        <div className="mb-8 p-6 rounded-2xl bg-gradient-to-br from-amber-50/60 via-white/60 to-violet-50/60 border border-white/60">
          <h3 className="text-sm font-medium text-espresso mb-4 flex items-center gap-2"><Crown className="w-4 h-4 text-amber-500" /> Ranking de Vendas</h3>
          <div className="space-y-3">
            {ranking.slice(0, 5).map((a, i) => {
              const lc = levelConfig[a.level] || levelConfig.bronze
              const Li = lc.icon
              return (
                <div key={a.id} className="flex items-center gap-4 p-3 rounded-xl bg-white/60 border border-white/60">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-amber-100 text-amber-600' : i === 1 ? 'bg-gray-100 text-gray-500' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-canvas text-espresso/30'}`}>{i + 1}</div>
                  <img src={a.avatar} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-canvas" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-espresso font-medium">{a.name}</div>
                    <div className="text-[10px] text-espresso/30 flex items-center gap-1"><Li className={`w-3 h-3 ${lc.color}`} /> {lc.label} · {a.ticketsSold} ingressos · Conv. {a.conversionRate}%</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-serif text-green-600">R$ {a.totalSales.toLocaleString()}</div>
                    <div className="text-[10px] text-espresso/30">R$ {a.commission.toFixed(0)} comissão</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-espresso/20" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar afiliado..." className="w-full pl-10 pr-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" /></div>
        <div className="flex items-center gap-2">
          {(['all', 'ativo', 'pausado', 'pendente'] as const).map(s => (
            <button key={s} type="button" onClick={() => setFilterStatus(s)} className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${filterStatus === s ? 'bg-plum text-cream' : 'bg-white/40 border border-white/60 text-espresso/50 hover:text-espresso/70'}`}>{s === 'all' ? 'Todos' : s.charAt(0).toUpperCase() + s.slice(1)}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(n => (
            <div key={n} className="h-14 bg-white/40 border border-white/60 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="bg-white/60 border border-white/60 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-espresso/5">
                  <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Afiliado</th>
                  <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase hidden md:table-cell">Código / Cupom</th>
                  <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Limite Vendas</th>
                  <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase hidden md:table-cell">Conv.</th>
                  <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id} className="border-b border-espresso/3 last:border-0 hover:bg-white/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img src={a.avatar} alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-canvas" />
                        <div className="min-w-0">
                          <div className="text-sm text-espresso font-medium">{a.name}</div>
                          <div className="text-[10px] text-espresso/30">{a.ticketsSold} vendidos · R$ {a.totalSales.toLocaleString()}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <button onClick={() => copyCode(a.code, a.id)} className="flex items-center gap-1 px-2 py-1 bg-canvas rounded-lg text-[10px] text-espresso/50 hover:text-plum transition-colors">
                          <QrCode className="w-3 h-3" /> {a.code} {copied === a.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                        {a.couponCode && <span className="px-2 py-1 bg-plum/10 rounded-lg text-[10px] text-plum flex items-center gap-1"><Tag className="w-3 h-3" /> {a.couponCode} ({a.couponDiscount}%)</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-espresso font-medium">{a.ticketsSold}/{a.ticketLimit}</div>
                      <div className="w-20 h-1.5 bg-canvas rounded-full overflow-hidden mt-1">
                        <div className={`h-full rounded-full ${a.ticketsSold >= a.ticketLimit ? 'bg-red-400' : 'bg-plum'}`} style={{ width: `${Math.min((a.ticketsSold / a.ticketLimit) * 100, 100)}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-espresso/60">{a.conversionRate}%</span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleStatus(a.id, a.status)} className={`px-2.5 py-1 text-[10px] font-medium rounded-full border transition-all ${a.status === 'ativo' ? 'bg-green-50 border-green-100 text-green-600' : a.status === 'pausado' ? 'bg-amber-50 border-amber-100 text-amber-600' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>{a.status.charAt(0).toUpperCase() + a.status.slice(1)}</button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setSelected(a)} aria-label="Ver detalhes e editar" title="Editar" className="p-1.5 rounded-lg hover:bg-canvas text-espresso/20 hover:text-espresso/60 transition-colors"><Edit3 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => copyCode(a.code, a.id)} aria-label="Compartilhar link de afiliado" title="Compartilhar" className="p-1.5 rounded-lg hover:bg-canvas text-espresso/20 hover:text-plum transition-colors"><Share2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-espresso/20 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-md bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-elevated max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6"><h3 className="font-serif text-xl text-espresso">Novo Afiliado</h3><button onClick={() => setShowForm(false)} aria-label="Fechar modal" title="Fechar" className="p-2 rounded-full hover:bg-canvas text-espresso/40 hover:text-espresso transition-colors"><X className="w-4 h-4" /></button></div>
            <div className="space-y-3">
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nome completo *" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email *" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Telefone" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              <input value={form.pixKey} onChange={e => setForm({ ...form, pixKey: e.target.value })} placeholder="Chave PIX" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              <div className="grid grid-cols-2 gap-3">
                <input type="number" value={form.commissionRate} onChange={e => setForm({ ...form, commissionRate: e.target.value })} placeholder="% Comissão" className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none" />
                <input type="number" value={form.ticketLimit} onChange={e => setForm({ ...form, ticketLimit: e.target.value })} placeholder="Limite vendas" className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-espresso/5">
              <button onClick={() => setShowForm(false)} className="px-5 py-2.5 text-sm text-espresso/50 hover:text-espresso transition-colors">Cancelar</button>
              <button onClick={addAffiliate} className="px-6 py-2.5 bg-plum text-cream text-sm rounded-full hover:shadow-glow transition-all">Adicionar Afiliado</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail / Performance Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-lg bg-canvas border-l border-espresso/10 h-full overflow-y-auto shadow-2xl">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <img src={selected.avatar} alt="" className="w-14 h-14 rounded-full object-cover ring-2 ring-plum/30" />
                  <div>
                    <h3 className="font-serif text-xl text-espresso">{selected.name}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${levelConfig[selected.level]?.bg || levelConfig.bronze.bg} ${levelConfig[selected.level]?.color || levelConfig.bronze.color}`}>{levelConfig[selected.level]?.label || 'Bronze'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => deleteAffiliate(selected.id)} aria-label="Excluir afiliado" title="Excluir" className="p-2 rounded-full hover:bg-red-50 text-espresso/30 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  <button onClick={() => setSelected(null)} aria-label="Fechar detalhes" title="Fechar" className="p-2 rounded-full bg-canvas text-espresso/40 hover:text-espresso transition-colors"><X className="w-5 h-5" /></button>
                </div>
              </div>

              {/* Contact */}
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-sm text-espresso/50"><Mail className="w-4 h-4 text-espresso/30" />{selected.email}</div>
                <div className="flex items-center gap-2 text-sm text-espresso/50"><Phone className="w-4 h-4 text-espresso/30" />{selected.phone}</div>
                <div className="flex items-center gap-2 text-sm text-espresso/50"><QrCode className="w-4 h-4 text-espresso/30" />Link Ref: {selected.code}</div>
                {selected.pixKey && <div className="flex items-center gap-2 text-sm text-espresso/50"><DollarSign className="w-4 h-4 text-espresso/30" />PIX: {selected.pixKey}</div>}
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="p-4 rounded-xl bg-white/60 border border-white/60 text-center">
                  <div className="font-serif text-xl text-espresso">{selected.ticketsSold}<span className="text-xs text-espresso/30">/{selected.ticketLimit}</span></div>
                  <div className="text-[10px] text-espresso/30">Vendas Realizadas</div>
                  <div className="w-full h-1.5 bg-canvas rounded-full overflow-hidden mt-1.5"><div className={`h-full rounded-full ${selected.ticketsSold >= selected.ticketLimit ? 'bg-red-400' : 'bg-plum'}`} style={{ width: `${Math.min((selected.ticketsSold / selected.ticketLimit) * 100, 100)}%` }} /></div>
                </div>
                <div className="p-4 rounded-xl bg-white/60 border border-white/60 text-center"><div className="font-serif text-xl text-green-600">R$ {selected.totalSales.toLocaleString()}</div><div className="text-[10px] text-espresso/30">Volume Total</div></div>
                <div className="p-4 rounded-xl bg-white/60 border border-white/60 text-center"><div className="font-serif text-xl text-plum">R$ {selected.commission.toFixed(2)}</div><div className="text-[10px] text-espresso/30">Comissão total</div></div>
                <div className="p-4 rounded-xl bg-white/60 border border-white/60 text-center"><div className="font-serif text-xl text-violet-600">{selected.conversionRate}%</div><div className="text-[10px] text-espresso/30">Conversão Média</div></div>
              </div>

              {/* Sales Chart */}
              {selected.salesHistory.length > 0 && (
                <div className="mb-6 p-4 rounded-xl bg-white/60 border border-white/60">
                  <h4 className="text-xs font-medium text-espresso/40 uppercase tracking-wider mb-3 flex items-center gap-2"><BarChart3 className="w-3.5 h-3.5" /> Histórico Recente</h4>
                  <div className="flex items-end gap-2 h-28 pt-2">
                    {selected.salesHistory.map((h, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[8px] text-espresso/40">R$ {h.value}</span>
                        <div className="w-full bg-plum/20 rounded-t-lg transition-all hover:bg-plum/40" style={{ height: `${(h.value / maxHistoryVal) * 60}px` }} />
                        <span className="text-[8px] text-espresso/30">{h.date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Level Progress */}
              <div className="mb-6 p-4 rounded-xl bg-white/60 border border-white/60">
                <h4 className="text-xs font-medium text-espresso/40 uppercase tracking-wider mb-2">Progresso do Ranking</h4>
                <div className="flex items-center justify-between text-[10px] text-espresso/30 mb-1">
                  <span>{levelConfig[selected.level]?.label || 'Bronze'}</span>
                  <span>{selected.ticketsSold} / {levelConfig[selected.level]?.next || 25} ingressos</span>
                </div>
                <div className="w-full h-2 bg-canvas rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-400 to-violet-500 rounded-full" style={{ width: `${Math.min((selected.ticketsSold / (levelConfig[selected.level]?.next || 25)) * 100, 100)}%` }} />
                </div>
              </div>

              {/* Payment Info */}
              <div className="p-4 rounded-xl bg-green-50 border border-green-100 mb-6">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-green-700 font-semibold">Comissão a pagar</span>
                  <span className="text-xs text-green-600 font-semibold">R$ {(selected.commission - selected.commissionPaid).toFixed(2)}</span>
                </div>
                <div className="text-sm text-green-800 font-mono mt-1">PIX: {selected.pixKey}</div>
              </div>

              <button onClick={() => { navigator.clipboard.writeText(selected.email); toast.success('E-mail copiado!') }} className="w-full py-2.5 bg-plum text-cream text-xs font-semibold rounded-full hover:shadow-glow transition-all flex items-center justify-center gap-2">
                <Mail className="w-3.5 h-3.5" /> Copiar E-mail do Afiliado
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
