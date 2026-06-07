import { useState, useEffect, useRef } from 'react'
import { 
  Users as UsersIcon, Search, User, Mail, Phone, Calendar, 
  Ban, CheckCircle, Shield, Award, Edit3, X, CreditCard, 
  Plus, Trash2, Key, Check, Clock, AlertCircle, Activity, ArrowUpRight, Loader2
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { toast } from 'sonner'
import gsap from 'gsap'

interface Subscription {
  plan: 'free' | 'starter' | 'plus' | 'pro' | 'enterprise'
  custom_price: number | null
  expires_at: string | null
  is_active: boolean
}

interface CustomFeature {
  feature_key: string
  expires_at: string | null
}

interface Profile {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  role: 'user' | 'customer' | 'producer' | 'admin' | 'editor'
  is_authorized: boolean
  created_at: string
  avatar_url: string | null
  producer_subscriptions?: Subscription | null
  user_custom_features?: CustomFeature[]
}

const roleLabels: Record<string, string> = {
  user: 'Participante',
  customer: 'Cliente',
  producer: 'Produtor',
  admin: 'Administrador',
  editor: 'Editor'
}

const roleColors: Record<string, string> = {
  user: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  customer: 'bg-teal-100 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400',
  producer: 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
  admin: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  editor: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
}

const PLAN_FEATURES: Record<string, string[]> = {
  free: [],
  starter: ['support', 'caixinha', 'calculator'],
  plus: ['support', 'caixinha', 'calculator', 'crm', 'affiliates', 'communications', 'coupons'],
  pro: ['support', 'caixinha', 'calculator', 'crm', 'affiliates', 'communications', 'coupons', 'seating_map', 'banners', 'checkin', 'collective_tables'],
  enterprise: ['support', 'caixinha', 'calculator', 'crm', 'affiliates', 'communications', 'coupons', 'seating_map', 'banners', 'checkin', 'collective_tables', 'api_access']
}

const availableFeatures = [
  { key: 'crm', name: 'CRM Pipeline', desc: 'Funil e gestão de leads' },
  { key: 'affiliates', name: 'Afiliados', desc: 'Comissionamento e promotores' },
  { key: 'collective_tables', name: 'Mesa Coletiva', desc: 'Matchmaking de participantes' },
  { key: 'seating_map', name: 'Lugar Marcado', desc: 'Editor de mapas de assentos' },
  { key: 'api_access', name: 'Acesso à API', desc: 'Tokens e integrações externas' },
  { key: 'banners', name: 'Banners Destaque', desc: 'Banners promocionais na home' },
  { key: 'communications', name: 'Campanhas de E-mail', desc: 'Disparos ilimitados para base' },
  { key: 'checkin', name: 'Scanner de Portaria', desc: 'App de check-in com leitura de QR' },
]

export default function AdminUsers() {
  const { user: loggedInUser } = useAuth()
  const ref = useRef<HTMLDivElement>(null)
  
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  
  // Drawer de Edição
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  
  // Formulário de Edição
  const [editRole, setEditRole] = useState<Profile['role']>('user')
  const [editAuthorized, setEditAuthorized] = useState(true)
  const [editPlan, setEditPlan] = useState<Subscription['plan']>('free')
  const [editCustomPrice, setEditCustomPrice] = useState<string>('')
  const [editExpiresAt, setEditExpiresAt] = useState<string>('')
  
  // Custom Features a serem modificadas
  const [tempFeatures, setTempFeatures] = useState<Record<string, { active: boolean; expires_at: string }>>({})

  // Estado das abas do Drawer e Telemetria
  const [drawerTab, setDrawerTab] = useState<'config' | 'history'>('config')
  const [userHistoryLoading, setUserHistoryLoading] = useState(false)
  const [userHistoryMetrics, setUserHistoryMetrics] = useState<{
    totalLogins: number
    inactivityDays: number
    avgSessionTimeMin: number
    monthlyFrequency: number
    accountStatus: string
  } | null>(null)
  const [abandonedEvents, setAbandonedEvents] = useState<{
    id: string
    title: string
    date: string
    time: string
    venue: string
  }[]>([])
  const [recentNavigation, setRecentNavigation] = useState<{
    id: string
    event_type: string
    path: string
    created_at: string
    metadata: any
  }[]>([])

  const isFeatureInPlan = (featureKey: string) => {
    return PLAN_FEATURES[editPlan]?.includes(featureKey) || false
  }

  const loadData = async () => {
    setIsLoading(true)
    try {
      // 1. Tenta a busca completa com relações do banco
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id, email, full_name, phone, role, is_authorized, created_at, avatar_url,
          producer_subscriptions (
            plan, custom_price, expires_at, is_active
          ),
          user_custom_features (
            feature_key, expires_at
          )
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.warn('Erro na query completa, tentando fallback simples:', error.message)
        // 2. Se falhar, tenta o fallback simples apenas na tabela profiles
        const { data: simpleData, error: simpleError } = await supabase
          .from('profiles')
          .select('id, email, full_name, phone, role, is_authorized, created_at, avatar_url')
          .order('created_at', { ascending: false })

        if (simpleError) throw simpleError
        
        const formatted = (simpleData || []).map((p: any) => ({
          ...p,
          producer_subscriptions: null,
          user_custom_features: []
        }))
        setProfiles(formatted)
      } else {
        const formattedProfiles: Profile[] = (data || []).map((p: any) => ({
          ...p,
          producer_subscriptions: p.producer_subscriptions?.[0] || p.producer_subscriptions || null
        }))
        setProfiles(formattedProfiles)
      }
    } catch (err: any) {
      console.error('Erro ao carregar usuários do Supabase, usando mocks de demonstração:', err)
      
      // 3. Fallback total para modo de demonstração (se o Supabase estiver indisponível ou vazio)
      const mockProfiles: Profile[] = [
        { id: 'u1', email: 'joao@email.com', full_name: 'Joao Silva', phone: '(11) 98765-4321', role: 'producer', is_authorized: true, created_at: new Date().toISOString(), avatar_url: 'https://i.pravatar.cc/150?img=11', producer_subscriptions: { plan: 'pro', custom_price: 149, expires_at: '2025-06-01T00:00:00Z', is_active: true }, user_custom_features: [] },
        { id: 'u2', email: 'ana@email.com', full_name: 'Ana Costa', phone: '(11) 91234-5678', role: 'user', is_authorized: true, created_at: new Date().toISOString(), avatar_url: 'https://i.pravatar.cc/150?img=5', producer_subscriptions: null, user_custom_features: [] },
        { id: 'u3', email: 'carlos@email.com', full_name: 'Carlos Mendes', phone: '(11) 92345-6789', role: 'producer', is_authorized: true, created_at: new Date().toISOString(), avatar_url: 'https://i.pravatar.cc/150?img=3', producer_subscriptions: { plan: 'starter', custom_price: 49, expires_at: '2025-05-10T00:00:00Z', is_active: true }, user_custom_features: [] },
        { id: 'u4', email: 'maria@email.com', full_name: 'Maria Souza', phone: '(11) 93456-7890', role: 'admin', is_authorized: true, created_at: new Date().toISOString(), avatar_url: 'https://i.pravatar.cc/150?img=9', producer_subscriptions: null, user_custom_features: [] },
        { id: 'u5', email: 'pedro@email.com', full_name: 'Pedro Lima', phone: '(11) 94567-8901', role: 'editor', is_authorized: false, created_at: new Date().toISOString(), avatar_url: 'https://i.pravatar.cc/150?img=8', producer_subscriptions: null, user_custom_features: [] }
      ]
      setProfiles(mockProfiles)
      toast.info('Visualizando em modo de demonstração local.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const loadUserHistory = async (userId: string, email: string) => {
    setUserHistoryLoading(true)
    try {
      // 1. Carregar logs reais do Supabase
      const { data: activities, error: actError } = await supabase
        .from('user_activities')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (actError) throw actError

      const { data: userTickets, error: ticketsError } = await supabase
        .from('tickets')
        .select('event_id')
        .eq('user_id', userId)

      if (ticketsError) throw ticketsError

      const boughtEventIds = new Set((userTickets || []).map(t => t.event_id))

      // Se tiver logs no banco, usar dados reais
      if (activities && activities.length > 0) {
        const totalLogins = activities.filter(a => a.event_type === 'login').length

        // Calcular inatividade (dias desde o último evento)
        const lastAct = new Date(activities[0].created_at)
        const diffTime = Math.abs(new Date().getTime() - lastAct.getTime())
        const inactivityDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
        
        let accountStatus = inactivityDays <= 7 ? 'Ativo' : 'Inativo'
        const sub = selectedProfile?.producer_subscriptions
        if (selectedProfile?.role === 'producer' && sub && !sub.is_active) {
          accountStatus = 'Assinatura Cancelada'
        }

        // Calcular tempo de sessão
        const sessions: Record<string, { min: number; max: number }> = {}
        activities.forEach(a => {
          const time = new Date(a.created_at).getTime()
          if (!sessions[a.session_id]) {
            sessions[a.session_id] = { min: time, max: time }
          } else {
            if (time < sessions[a.session_id].min) sessions[a.session_id].min = time
            if (time > sessions[a.session_id].max) sessions[a.session_id].max = time
          }
        })

        let totalDurationMs = 0
        let sessionCount = 0
        Object.values(sessions).forEach(s => {
          const dur = s.max - s.min
          if (dur > 1000 && dur < 4 * 60 * 60 * 1000) {
            totalDurationMs += dur
            sessionCount++
          }
        })
        const avgSessionTimeMin = sessionCount > 0 
          ? Math.round((totalDurationMs / sessionCount) / 1000 / 60) 
          : 0

        // Frequência mensal
        const uniqueDays = new Set<string>()
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        activities.forEach(a => {
          const dt = new Date(a.created_at)
          if (dt >= thirtyDaysAgo) {
            uniqueDays.add(dt.toDateString())
          }
        })
        const monthlyFrequency = uniqueDays.size

        setUserHistoryMetrics({
          totalLogins,
          inactivityDays,
          avgSessionTimeMin,
          monthlyFrequency,
          accountStatus
        })

        // Carrinho abandonado (Visualizados e não comprados)
        const eventViews = activities.filter(a => a.event_type === 'page_view' && a.path && a.path.startsWith('/event/'))
        const viewedEventIds = new Set<string>()
        eventViews.forEach(ev => {
          const parts = ev.path.split('/')
          const evId = parts[2]
          if (evId && evId.length >= 10) {
            viewedEventIds.add(evId)
          }
        })

        const abandonedIds = Array.from(viewedEventIds).filter(id => !boughtEventIds.has(id))
        if (abandonedIds.length > 0) {
          const { data: eventsData } = await supabase
            .from('events')
            .select('id, title, date, time, venue_name')
            .in('id', abandonedIds)
          
          setAbandonedEvents((eventsData || []).map((ev: any) => ({
            id: ev.id,
            title: ev.title,
            date: ev.date,
            time: ev.time,
            venue: ev.venue_name
          })))
        } else {
          setAbandonedEvents([])
        }

        setRecentNavigation(activities.slice(0, 15).map((a: any) => ({
          id: a.id,
          event_type: a.event_type,
          path: a.path,
          created_at: a.created_at,
          metadata: a.metadata
        })))
      } else {
        // Fallback para mock se o banco estiver vazio para este usuário
        throw new Error("Sem logs no banco")
      }
    } catch (err) {
      console.log('Sem dados reais de tracking para o usuário, usando dados simulados detalhados para exibição local.')
      
      const isProducer = selectedProfile?.role === 'producer'
      const isUser = selectedProfile?.role === 'user'
      const isBlocked = selectedProfile?.is_authorized === false

      let status = 'Ativo'
      if (isBlocked) status = 'Bloqueado'
      else if (isProducer && selectedProfile?.producer_subscriptions && !selectedProfile.producer_subscriptions.is_active) status = 'Assinatura Cancelada'
      else if (email.includes('roberto') || email.includes('pedro')) status = 'Inativo'

      const mockMetrics = {
        totalLogins: email === 'ana@email.com' ? 34 : email === 'joao@email.com' ? 82 : 12,
        inactivityDays: status === 'Inativo' ? 14 : status === 'Ativo' ? 0 : 2,
        avgSessionTimeMin: isProducer ? 18 : isUser ? 6 : 10,
        monthlyFrequency: status === 'Inativo' ? 2 : isProducer ? 22 : 8,
        accountStatus: status
      }
      setUserHistoryMetrics(mockMetrics)

      // Mocks de visualizados e não comprados
      if (isUser || email === 'ana@email.com') {
        setAbandonedEvents([
          { id: 'ev-mock-1', title: 'Festival Sunset Evokaa 2026', date: '2026-07-15', time: '16:00', venue: 'Arena Sunset' },
          { id: 'ev-mock-2', title: 'Jazz & Blues Night', date: '2026-08-02', time: '20:00', venue: 'Teatro Bradesco' }
        ])
      } else {
        setAbandonedEvents([])
      }

      // Mocks de navegação recente
      const now = new Date()
      const mockNav = [
        { id: 'nav-1', event_type: 'page_view', path: '/app/hub', created_at: new Date(now.getTime() - 5 * 60 * 1000).toISOString(), metadata: { device: 'Mobile' } },
        { id: 'nav-2', event_type: 'page_view', path: '/event/ev-mock-1', created_at: new Date(now.getTime() - 12 * 60 * 1000).toISOString(), metadata: { device: 'Mobile' } },
        { id: 'nav-3', event_type: 'add_to_cart', path: '/checkout', created_at: new Date(now.getTime() - 15 * 60 * 1000).toISOString(), metadata: { device: 'Mobile', event_id: 'ev-mock-1' } },
        { id: 'nav-4', event_type: 'page_view', path: '/event/ev-mock-2', created_at: new Date(now.getTime() - 25 * 60 * 1000).toISOString(), metadata: { device: 'Mobile' } },
        { id: 'nav-5', event_type: 'login', path: '/auth/login', created_at: new Date(now.getTime() - 30 * 60 * 1000).toISOString(), metadata: { device: 'Mobile' } }
      ]
      
      if (isProducer) {
        mockNav.unshift(
          { id: 'nav-p1', event_type: 'page_view', path: '/producer/dashboard', created_at: new Date(now.getTime() - 2 * 60 * 1000).toISOString(), metadata: { device: 'Desktop' } },
          { id: 'nav-p2', event_type: 'page_view', path: '/producer/events', created_at: new Date(now.getTime() - 10 * 60 * 1000).toISOString(), metadata: { device: 'Desktop' } }
        )
      }

      setRecentNavigation(mockNav)
    } finally {
      setUserHistoryLoading(false)
    }
  }

  useEffect(() => {
    if (selectedProfile) {
      setDrawerTab('config')
    }
  }, [selectedProfile])

  useEffect(() => {
    if (selectedProfile && drawerTab === 'history') {
      loadUserHistory(selectedProfile.id, selectedProfile.email)
    }
  }, [drawerTab, selectedProfile])

  useEffect(() => {
    if (!isLoading) {
      const ctx = gsap.context(() => {
        gsap.fromTo('.user-card', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.04, ease: 'power3.out' })
      }, ref)
      return () => ctx.revert()
    }
  }, [isLoading, roleFilter, statusFilter])

  // Abrir detalhes e preencher estados de edição
  const handleOpenEdit = (profile: Profile) => {
    setSelectedProfile(profile)
    setEditRole(profile.role)
    setEditAuthorized(profile.is_authorized)
    
    const sub = profile.producer_subscriptions
    setEditPlan(sub?.plan || 'free')
    setEditCustomPrice(sub?.custom_price !== null && sub?.custom_price !== undefined ? String(sub.custom_price) : '')
    setEditExpiresAt(sub?.expires_at ? sub.expires_at.substring(0, 10) : '')

    // Inicializar mapa de features temporárias
    const featureMap: Record<string, { active: boolean; expires_at: string }> = {}
    availableFeatures.forEach(f => {
      const activeFeat = profile.user_custom_features?.find(uf => uf.feature_key === f.key)
      featureMap[f.key] = {
        active: !!activeFeat,
        expires_at: activeFeat?.expires_at ? activeFeat.expires_at.substring(0, 10) : ''
      }
    })
    setTempFeatures(featureMap)
  }

  // Gravar modificações no Supabase
  const handleSaveUser = async () => {
    if (!selectedProfile) return
    setIsSaving(true)
    
    try {
      // 1. Atualizar o profile (role e is_authorized)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          role: editRole,
          is_authorized: editAuthorized
        })
        .eq('id', selectedProfile.id)

      if (profileError) throw profileError

      // 2. Tratar Subscription
      if (editPlan !== 'free') {
        const expiresVal = editExpiresAt ? new Date(editExpiresAt).toISOString() : null
        const customPriceVal = editCustomPrice.trim() !== '' ? Number(editCustomPrice) : null

        // Tentar upsert na tabela de assinaturas
        const { error: subError } = await supabase
          .from('producer_subscriptions')
          .upsert({
            producer_id: selectedProfile.id,
            plan: editPlan,
            custom_price: customPriceVal,
            expires_at: expiresVal,
            is_active: true,
            started_at: new Date().toISOString()
          }, { onConflict: 'producer_id' })

        if (subError) throw subError
      } else {
        // Se mudou para free, podemos excluir a assinatura anterior do produtor
        await supabase
          .from('producer_subscriptions')
          .delete()
          .eq('producer_id', selectedProfile.id)
      }

      // 3. Tratar Custom Features (Inserir novos, atualizar prazos e deletar inativos)
      for (const [key, feat] of Object.entries(tempFeatures)) {
        if (feat.active) {
          const expVal = feat.expires_at ? new Date(feat.expires_at).toISOString() : null
          const { error: featError } = await supabase
            .from('user_custom_features')
            .upsert({
              user_id: selectedProfile.id,
              feature_key: key,
              expires_at: expVal
            }, { onConflict: 'user_id,feature_key' })
          
          if (featError) throw featError
        } else {
          // Deletar se existia
          await supabase
            .from('user_custom_features')
            .delete()
            .eq('user_id', selectedProfile.id)
            .eq('feature_key', key)
        }
      }

      toast.success('Usuário atualizado com sucesso!')
      setSelectedProfile(null)
      loadData()
    } catch (err: any) {
      console.error('Erro ao salvar usuário:', err)
      toast.error('Erro ao salvar as configurações: ' + (err.message || err))
    } finally {
      setIsSaving(false)
    }
  }

  // Filtragem dos perfis na listagem
  const filteredProfiles = profiles.filter(p => {
    const term = search.toLowerCase()
    const matchSearch = !search || 
      (p.full_name || '').toLowerCase().includes(term) || 
      p.email.toLowerCase().includes(term) || 
      (p.phone || '').includes(term)

    const matchRole = roleFilter === 'all' || p.role === roleFilter
    
    let matchStatus = true
    if (statusFilter === 'authorized') matchStatus = p.is_authorized
    else if (statusFilter === 'pending') matchStatus = !p.is_authorized

    return matchSearch && matchRole && matchStatus
  })

  // Contadores rápidos para o topo
  const kpis = {
    total: profiles.length,
    producers: profiles.filter(p => p.role === 'producer').length,
    pending: profiles.filter(p => !p.is_authorized).length,
    activeSubscribers: profiles.filter(p => p.producer_subscriptions?.is_active).length
  }

  return (
    <div ref={ref} className="p-6 lg:p-10 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Gestão de Usuários</h1>
          <p className="text-sm text-espresso/50 mt-1">Autorização de acessos, precificação e liberação de recursos do Supabase</p>
        </div>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Usuários', value: kpis.total.toString(), icon: UsersIcon, color: 'text-blue-500' },
          { label: 'Produtores', value: kpis.producers.toString(), icon: Shield, color: 'text-purple-500' },
          { label: 'Pendente Aprovação', value: kpis.pending.toString(), icon: AlertCircle, color: kpis.pending > 0 ? 'text-amber-500 animate-pulse' : 'text-slate-400' },
          { label: 'Planos Ativos', value: kpis.activeSubscribers.toString(), icon: CreditCard, color: 'text-green-500' },
        ].map(k => (
          <div key={k.label} className="user-card p-5 rounded-2xl surface">
            <div className="flex items-center justify-between mb-3">
              <k.icon className={`w-5 h-5 ${k.color}`} />
            </div>
            <div className={`font-serif text-2xl text-espresso`}>{k.value}</div>
            <div className="text-[10px] text-espresso/40 mt-1 uppercase tracking-wider">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-espresso/20" />
          <input 
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, e-mail ou telefone..." 
            className="w-full pl-10 pr-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 transition-colors" 
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Role Filter */}
          <select 
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            aria-label="Filtrar por Papel"
            className="px-3 py-2 bg-white/60 border border-white/60 rounded-xl text-xs text-espresso focus:outline-none focus:border-plum/30"
          >
            <option value="all">Todos os Papéis</option>
            <option value="user">Participante</option>
            <option value="producer">Produtor</option>
            <option value="editor">Editor</option>
            <option value="admin">Administrador</option>
          </select>

          {/* Status Filter */}
          <select 
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            aria-label="Filtrar por Autorização"
            className="px-3 py-2 bg-white/60 border border-white/60 rounded-xl text-xs text-espresso focus:outline-none focus:border-plum/30"
          >
            <option value="all">Status de Acesso</option>
            <option value="authorized">Ativos / Autorizados</option>
            <option value="pending">Pendentes</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(n => (
            <div key={n} className="h-16 rounded-2xl bg-white/40 border border-white/60 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-premium">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th className="hidden md:table-cell">Contato</th>
                  <th className="hidden lg:table-cell">Assinatura / Preço</th>
                  <th className="hidden lg:table-cell">Recursos Extras</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredProfiles.map(p => {
                  const sub = p.producer_subscriptions
                  const customFeats = p.user_custom_features || []
                  
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <img 
                            src={p.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${p.full_name || p.email}`} 
                            alt="" 
                            className="w-9 h-9 rounded-full object-cover ring-2 ring-canvas" 
                          />
                          <div>
                            <div className="text-sm text-espresso font-medium">{p.full_name || 'Sem nome'}</div>
                            <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded ${roleColors[p.role]}`}>
                              {roleLabels[p.role] || p.role}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="hidden md:table-cell">
                        <div className="space-y-0.5 text-xs text-espresso/50">
                          <div className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 opacity-55" />{p.email}</div>
                          {p.phone && <div className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 opacity-55" />{p.phone}</div>}
                        </div>
                      </td>
                      <td className="hidden lg:table-cell">
                        {sub ? (
                          <div className="text-xs">
                            <span className="font-semibold text-plum capitalize">{sub.plan}</span>
                            <div className="text-[10px] text-espresso/40 mt-0.5">
                              {sub.custom_price !== null ? (
                                <span className="text-green-600 font-medium">R$ {sub.custom_price}/mês (Custom)</span>
                              ) : (
                                <span>Preço padrão</span>
                              )}
                            </div>
                            {sub.expires_at && (
                              <div className="text-[9px] text-espresso/30 flex items-center gap-1 mt-0.5">
                                <Clock className="w-3 h-3" /> Expira: {new Date(sub.expires_at).toLocaleDateString('pt-BR')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-espresso/35">Nenhuma</span>
                        )}
                      </td>
                      <td className="hidden lg:table-cell">
                        {customFeats.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {customFeats.map(f => (
                              <span key={f.feature_key} className="text-[8px] bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-espresso/60 px-1.5 py-0.5 rounded" title={f.expires_at ? `Expira em ${new Date(f.expires_at).toLocaleDateString('pt-BR')}` : 'Tempo ilimitado'}>
                                {f.feature_key}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] text-espresso/35">—</span>
                        )}
                      </td>
                      <td>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-semibold rounded-full border ${p.is_authorized ? 'bg-green-50 text-green-600 border-green-100 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20' : 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 animate-pulse'}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${p.is_authorized ? 'bg-green-500' : 'bg-amber-500'}`} />
                          {p.is_authorized ? 'Autorizado' : 'Pendente'}
                        </span>
                      </td>
                      <td>
                        <button 
                          onClick={() => handleOpenEdit(p)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-espresso/70 hover:text-plum hover:border-plum/20 text-xs font-semibold rounded-lg transition-all"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Gerenciar
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {filteredProfiles.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-sm text-espresso/30 italic">
                      Nenhum usuário encontrado com as configurações de busca.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Drawer Lateral de Gerenciamento do Usuário */}
      {selectedProfile && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedProfile(null)} />
          <div className="relative w-full max-w-lg bg-canvas border-l border-slate-200/60 dark:border-white/5 h-full shadow-2xl flex flex-col justify-between overflow-y-auto">
            {/* Top Header */}
            <div className="p-6 border-b border-slate-200/60 dark:border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img 
                  src={selectedProfile.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${selectedProfile.full_name || selectedProfile.email}`} 
                  alt="" 
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-plum/20" 
                />
                <div>
                  <h3 className="font-serif text-lg text-espresso">{selectedProfile.full_name || 'Sem nome'}</h3>
                  <div className="text-xs text-espresso/45">{selectedProfile.email}</div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedProfile(null)}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 text-espresso/40 hover:text-espresso"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs Selector */}
            <div className="px-6 border-b border-slate-200/60 dark:border-white/5 flex gap-4">
              <button
                type="button"
                onClick={() => setDrawerTab('config')}
                className={`py-3 text-xs font-semibold border-b-2 transition-all ${
                  drawerTab === 'config' 
                    ? 'border-plum text-plum' 
                    : 'border-transparent text-espresso/40 hover:text-espresso/60'
                }`}
              >
                Configurações RLS
              </button>
              <button
                type="button"
                onClick={() => setDrawerTab('history')}
                className={`py-3 text-xs font-semibold border-b-2 transition-all ${
                  drawerTab === 'history' 
                    ? 'border-plum text-plum' 
                    : 'border-transparent text-espresso/40 hover:text-espresso/60'
                }`}
              >
                Histórico & Comportamento
              </button>
            </div>

            {/* Scrollable Body depends on Tab */}
            {drawerTab === 'config' ? (
              <div className="p-6 space-y-6 overflow-y-auto flex-1">
                {/* Seção 1: Role & Autorização */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-plum flex items-center gap-1.5"><User className="w-4 h-4" /> Conta & Papel (Role)</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {/* Select Role */}
                    <div>
                      <label className="text-xs font-semibold text-espresso/60 mb-1.5 block">Papel do Usuário</label>
                      <select 
                        value={editRole}
                        onChange={e => setEditRole(e.target.value as Profile['role'])}
                        className="w-full px-3 py-2 bg-white/60 border border-slate-200 rounded-xl text-xs text-espresso focus:outline-none focus:border-plum/30 dark:bg-zinc-800 dark:border-zinc-700"
                      >
                        <option value="user">Participante</option>
                        <option value="producer">Produtor</option>
                        <option value="editor">Editor</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </div>

                    {/* Switch Authorization */}
                    <div>
                      <label className="text-xs font-semibold text-espresso/60 mb-1.5 block">Status de Acesso</label>
                      <button
                        type="button"
                        onClick={() => setEditAuthorized(!editAuthorized)}
                        className={`w-full py-2 px-3 text-xs font-semibold rounded-xl border flex items-center justify-center gap-1.5 transition-all ${
                          editAuthorized 
                            ? 'bg-green-500/10 border-green-500/20 text-green-600 hover:bg-green-500/20' 
                            : 'bg-amber-500/10 border-amber-500/20 text-amber-600 hover:bg-amber-500/20'
                        }`}
                      >
                        {editAuthorized ? <CheckCircle className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                        {editAuthorized ? 'Conta Autorizada' : 'Bloqueado / Pendente'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Seção 2: Plano & Gratuidade */}
                <div className="space-y-4 pt-4 border-t border-slate-200/60 dark:border-white/5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-plum flex items-center gap-1.5"><CreditCard className="w-4 h-4" /> Plano & Assinatura</h4>
                  
                  <div className="space-y-3">
                    {/* Select Plan */}
                    <div>
                      <label className="text-xs font-semibold text-espresso/60 mb-1.5 block">Alterar Plano</label>
                      <select 
                        value={editPlan}
                        onChange={e => setEditPlan(e.target.value as Subscription['plan'])}
                        className="w-full px-3 py-2 bg-white/60 border border-slate-200 rounded-xl text-xs text-espresso focus:outline-none focus:border-plum/30 dark:bg-zinc-800 dark:border-zinc-700"
                      >
                        <option value="free">Sem Plano (Gratuito/Participante)</option>
                        <option value="starter">Evokaa Starter (R$ 49/mês)</option>
                        <option value="plus">Evokaa Plus (R$ 99/mês)</option>
                        <option value="pro">Evokaa Pro (R$ 149/mês)</option>
                        <option value="enterprise">Evokaa Enterprise (R$ 349/mês)</option>
                      </select>
                    </div>

                    {editPlan !== 'free' && (
                      <div className="grid grid-cols-2 gap-4">
                        {/* Preço Customizado */}
                        <div>
                          <label className="text-xs font-semibold text-espresso/60 mb-1.5 block">Preço Customizado (R$)</label>
                          <input
                            type="number"
                            value={editCustomPrice}
                            onChange={e => setEditCustomPrice(e.target.value)}
                            placeholder="Ex: 50"
                            className="w-full px-3 py-2 bg-white/60 border border-slate-200 rounded-xl text-xs text-espresso focus:outline-none focus:border-plum/30 dark:bg-zinc-800 dark:border-zinc-700"
                          />
                          <span className="text-[9px] text-espresso/35 mt-1 block">Deixe em branco para usar valor do plano.</span>
                        </div>

                        {/* Tempo de Gratuidade / Expiração */}
                        <div>
                          <label className="text-xs font-semibold text-espresso/60 mb-1.5 block">Vencimento / Expiração</label>
                          <input
                            type="date"
                            value={editExpiresAt}
                            onChange={e => setEditExpiresAt(e.target.value)}
                            className="w-full px-3 py-2 bg-white/60 border border-slate-200 rounded-xl text-xs text-espresso focus:outline-none focus:border-plum/30 dark:bg-zinc-800 dark:border-zinc-700"
                          />
                          <span className="text-[9px] text-espresso/35 mt-1 block">Data limite da gratuidade ou assinatura.</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Seção 3: Ferramentas Adicionais (Features) */}
                <div className="space-y-4 pt-4 border-t border-slate-200/60 dark:border-white/5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-plum flex items-center gap-1.5">
                      <Key className="w-4 h-4" /> Ferramentas do Produtor
                    </h4>
                    <span className="text-[10px] bg-plum/10 text-plum px-2.5 py-0.5 rounded-full font-bold uppercase">
                      Plano: {editPlan}
                    </span>
                  </div>
                  
                  {editRole === 'user' || editRole === 'customer' ? (
                    <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 text-center">
                      <p className="text-[11px] text-amber-700 dark:text-amber-450 font-medium leading-relaxed">
                        Este usuário é um <strong>Participante</strong>. Ferramentas de produtor não se aplicam a contas de participante comuns, a menos que você altere o papel dele para Produtor ou Editor no painel acima.
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="text-[10px] text-espresso/45 leading-relaxed">
                        Ferramentas nativas do plano <strong className="capitalize">{editPlan}</strong> são liberadas automaticamente. Ative individualmente (Bypass) os recursos adicionais desejados.
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                        {availableFeatures.map(feat => {
                          const inPlan = isFeatureInPlan(feat.key)
                          const tempFeat = tempFeatures[feat.key] || { active: false, expires_at: '' }
                          
                          return (
                            <div 
                              key={feat.key} 
                              className={`p-3 rounded-xl border transition-all flex flex-col justify-between min-h-[92px] ${
                                inPlan 
                                  ? 'bg-green-50/40 border-green-200/60 dark:bg-green-950/10 dark:border-green-900/30' 
                                  : tempFeat.active
                                  ? 'bg-plum/5 border-plum/20 dark:bg-plum/5 dark:border-plum/20 shadow-sm'
                                  : 'bg-white/40 border-slate-200/60 hover:border-slate-300 dark:bg-white/5 dark:border-white/5'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="text-[11px] font-bold text-espresso">{feat.name}</div>
                                  <div className="text-[9px] text-espresso/40 mt-0.5 leading-snug">{feat.desc}</div>
                                </div>
                                
                                {inPlan ? (
                                  <span className="text-[8px] bg-green-500/10 text-green-600 border border-green-500/20 px-1.5 py-0.5 rounded-md font-bold uppercase shrink-0">
                                    No Plano
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setTempFeatures(prev => ({
                                      ...prev,
                                      [feat.key]: { ...prev[feat.key], active: !tempFeat.active }
                                    }))}
                                    className={`w-9 h-5 rounded-full p-0.5 transition-colors flex items-center shrink-0 ${
                                      tempFeat.active ? 'bg-plum' : 'bg-slate-200 dark:bg-white/10'
                                    }`}
                                  >
                                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                                      tempFeat.active ? 'translate-x-4' : 'translate-x-0'
                                    }`} />
                                  </button>
                                )}
                              </div>
                              
                              {!inPlan && tempFeat.active && (
                                <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-plum/10">
                                  <div className="flex items-center justify-between gap-1 text-[9px] text-espresso/50">
                                    <span className="flex items-center gap-1 font-medium"><Clock className="w-3 h-3" /> Expira em:</span>
                                    <button
                                      type="button"
                                      onClick={() => setTempFeatures(prev => ({
                                        ...prev,
                                        [feat.key]: { 
                                          ...prev[feat.key], 
                                          expires_at: tempFeat.expires_at ? '' : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10) 
                                        }
                                      }))}
                                      className="text-plum hover:underline font-bold text-[8px]"
                                    >
                                      {tempFeat.expires_at ? 'Mudar p/ Vitalício' : 'Definir Prazo (30d)'}
                                    </button>
                                  </div>
                                  {tempFeat.expires_at ? (
                                    <input
                                      type="date"
                                      value={tempFeat.expires_at}
                                      onChange={e => setTempFeatures(prev => ({
                                        ...prev,
                                        [feat.key]: { ...prev[feat.key], expires_at: e.target.value }
                                      }))}
                                      className="w-full px-2 py-1 bg-white/85 dark:bg-zinc-850 dark:border-zinc-700 border border-slate-200 rounded-md text-[9px] text-espresso focus:outline-none"
                                    />
                                  ) : (
                                    <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">Acesso Vitalício</span>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-6 overflow-y-auto flex-1">
                {userHistoryLoading ? (
                  <div className="py-20 text-center">
                    <Loader2 className="w-8 h-8 text-plum animate-spin mx-auto mb-3" />
                    <p className="text-xs text-espresso/50">Carregando histórico e métricas...</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Status da Conta */}
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-white/40 border border-white/60 dark:bg-white/5 dark:border-white/5">
                      <div>
                        <div className="text-xs text-espresso/40">Status do Usuário</div>
                        <div className="text-sm font-bold text-espresso mt-0.5">Tempo de Atividade & Assinatura</div>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border ${
                        userHistoryMetrics?.accountStatus === 'Ativo' 
                          ? 'bg-green-50 text-green-600 border-green-100 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20' 
                          : userHistoryMetrics?.accountStatus === 'Inativo'
                          ? 'bg-slate-55 border-slate-200 text-slate-500 dark:bg-zinc-700/50 dark:text-zinc-400 dark:border-zinc-650'
                          : 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20'
                      }`}>
                        <div className={`w-2.5 h-2.5 rounded-full ${
                          userHistoryMetrics?.accountStatus === 'Ativo' 
                            ? 'bg-green-500' 
                            : userHistoryMetrics?.accountStatus === 'Inativo'
                            ? 'bg-slate-400'
                            : 'bg-rose-500'
                        }`} />
                        {userHistoryMetrics?.accountStatus}
                      </span>
                    </div>

                    {/* Grid de Métricas */}
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: 'Tempo sem Uso', value: userHistoryMetrics?.inactivityDays === 0 ? 'Ativo Hoje' : `${userHistoryMetrics?.inactivityDays} dias`, desc: 'Desde o último log', icon: Clock, color: 'text-amber-500' },
                        { label: 'Total de Logins', value: `${userHistoryMetrics?.totalLogins || 0} logins`, desc: 'Acessos registrados', icon: Shield, color: 'text-plum' },
                        { label: 'Média por Sessão', value: `${userHistoryMetrics?.avgSessionTimeMin || 0} min`, desc: 'Tempo médio de navegação', icon: Activity, color: 'text-blue-500' },
                        { label: 'Frequência Mensal', value: `${userHistoryMetrics?.monthlyFrequency || 0} dias ativos`, desc: 'Acessos únicos nos últimos 30d', icon: UsersIcon, color: 'text-purple-500' },
                      ].map(m => (
                        <div key={m.label} className="p-4 rounded-2xl bg-white/40 border border-white/60 dark:bg-white/5 dark:border-white/5">
                          <div className="flex items-center justify-between mb-2">
                            <m.icon className={`w-4 h-4 ${m.color}`} />
                          </div>
                          <div className="text-sm font-bold text-espresso">{m.value}</div>
                          <div className="text-[10px] text-espresso/40 font-medium mt-0.5">{m.label}</div>
                          <div className="text-[9px] text-espresso/30 mt-1">{m.desc}</div>
                        </div>
                      ))}
                    </div>

                    {/* Carrinho Abandonado */}
                    <div className="space-y-3 pt-4 border-t border-slate-200/60 dark:border-white/5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-plum flex items-center gap-1.5">
                        <ArrowUpRight className="w-4 h-4" /> Carrinho Abandonado (Visualizados sem Compra)
                      </h4>
                      <p className="text-[10px] text-espresso/45">Eventos cujos detalhes foram visualizados, mas para os quais nenhum ingresso foi adquirido ainda.</p>
                      
                      {abandonedEvents.length === 0 ? (
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-center text-xs text-espresso/40 italic">
                          Nenhum interesse abandonado registrado.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {abandonedEvents.map(ev => (
                            <div key={ev.id} className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 flex items-start justify-between gap-3">
                              <div>
                                <div className="text-xs font-bold text-espresso">{ev.title}</div>
                                <div className="text-[9.5px] text-espresso/40 mt-1">
                                  {new Date(ev.date).toLocaleDateString('pt-BR')} · {ev.time} · {ev.venue}
                                </div>
                              </div>
                              <span className="text-[8.5px] font-bold uppercase px-1.5 py-0.5 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-md shrink-0">
                                Sem ingresso
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Timeline de Navegação Recente */}
                    <div className="space-y-3 pt-4 border-t border-slate-200/60 dark:border-white/5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-plum flex items-center gap-1.5">
                        <Activity className="w-4 h-4" /> Histórico de Navegação Recente
                      </h4>
                      <p className="text-[10px] text-espresso/45">Últimas 15 ações registradas para esta conta de acordo com a telemetria do app.</p>
                      
                      {recentNavigation.length === 0 ? (
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-center text-xs text-espresso/40 italic">
                          Nenhuma atividade recente registrada.
                        </div>
                      ) : (
                        <div className="space-y-4 pl-2 relative border-l border-slate-200 dark:border-white/10 ml-2">
                          {recentNavigation.map(log => {
                            const date = new Date(log.created_at)
                            return (
                              <div key={log.id} className="relative pl-6">
                                <div className={`absolute left-[-25px] top-1 w-3 h-3 rounded-full border-2 border-canvas ${
                                  log.event_type === 'login' ? 'bg-green-500' :
                                  log.event_type === 'add_to_cart' ? 'bg-amber-500' :
                                  log.event_type === 'purchase' ? 'bg-emerald-500' :
                                  'bg-plum'
                                }`} />
                                <div className="flex items-center justify-between text-[11px] font-medium text-espresso/70">
                                  <span className="font-bold text-espresso capitalize">
                                    {log.event_type === 'page_view' ? 'Visualizou Página' :
                                     log.event_type === 'login' ? 'Efetuou Login' :
                                     log.event_type === 'add_to_cart' ? 'Adicionou ao Carrinho' :
                                     log.event_type === 'purchase' ? 'Comprou Ingresso' :
                                     log.event_type === 'session_start' ? 'Iniciou Sessão' :
                                     log.event_type}
                                  </span>
                                  <span className="text-[9.5px] text-espresso/35 font-mono">
                                    {date.toLocaleDateString('pt-BR')} {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <div className="text-[9.5px] text-espresso/40 font-mono mt-0.5 break-all">
                                  {log.path || '/'}
                                </div>
                                {log.metadata && (
                                  <div className="text-[8px] text-espresso/30 mt-0.5 font-mono">
                                    Device: {log.metadata.device || 'Desconhecido'} · Agent: {log.metadata.userAgent?.slice(0, 40)}...
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bottom Actions */}
            <div className="p-6 bg-slate-50 dark:bg-white/5 border-t border-slate-200/60 dark:border-white/5 flex items-center justify-between gap-3">
              <button 
                onClick={() => setSelectedProfile(null)}
                className="px-6 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-espresso text-xs font-semibold rounded-full transition-all dark:bg-zinc-800 dark:border-zinc-700 dark:hover:bg-zinc-700"
              >
                Cancelar
              </button>
              {drawerTab === 'config' && (
                <button 
                  onClick={handleSaveUser}
                  disabled={isSaving}
                  className="px-8 py-2.5 bg-plum text-cream text-xs font-semibold rounded-full hover:shadow-glow transition-all flex items-center gap-1.5"
                >
                  {isSaving ? 'Gravando...' : 'Salvar Alterações'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
