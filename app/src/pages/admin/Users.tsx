import { useState, useEffect, useRef } from 'react'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { EmptyState, PageHeader, Stat, selectNativo, chipAviso, chipErro, chipInfo, chipNeutro, chipOk } from '@/components/producer/ui'
import { Tabela, alertaAviso, alertaErro, painel, th } from '@/components/admin/ui'
import { cn } from '@/lib/utils'
import { iniciais } from '../../hooks/useConversas'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { toast } from 'sonner'
import gsap from 'gsap'
import { PLANS, type PlanId } from '../../lib/plans'

interface Subscription {
  plan: PlanId
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
  user: chipNeutro,
  customer: chipNeutro,
  producer: chipInfo,
  admin: chipErro,
  editor: chipAviso
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
  // Papel de admin só o super_admin muda (docs/sql/20260930_permissoes_admin.sql)
  const souSuper = !!loggedInUser?.admin_permissions?.includes('super_admin')
  const ref = useRef<HTMLDivElement>(null)
  
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  
  // Drawer de Edição
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  
  // Formulário de Edição
  const [editRole, setEditRole] = useState<Profile['role']>('user')
  const [editPlan, setEditPlan] = useState<Subscription['plan']>('free')
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
    setLoadError(null)
    try {
      // Uma consulta só: se falhar, o erro aparece na tela (nada de lista parcial sem aviso)
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id, email, full_name, phone, role, created_at, avatar_url,
          producer_subscriptions (
            plan, expires_at, is_active
          ),
          user_custom_features (
            feature_key, expires_at
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      const formattedProfiles: Profile[] = (data || []).map((p: any) => ({
        ...p,
        producer_subscriptions: p.producer_subscriptions?.[0] || p.producer_subscriptions || null
      }))
      setProfiles(formattedProfiles)
    } catch (err: any) {
      // Nunca mostrar usuários inventados: lista vazia e o erro real na tela.
      console.error('Erro ao carregar usuários:', err)
      setProfiles([])
      setLoadError(err?.message || 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const loadUserHistory = async (userId: string) => {
    setUserHistoryLoading(true)
    setHistoryError(null)
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
        // Conta sem registros de uso: vazio, nunca dados inventados.
        setUserHistoryMetrics(null)
        setAbandonedEvents([])
        setRecentNavigation([])
      }
    } catch (err: any) {
      // Erro real (regra de acesso, rede): dizer que não deu para carregar, não "sem registros".
      setUserHistoryMetrics(null)
      setAbandonedEvents([])
      setRecentNavigation([])
      setHistoryError(err?.message || 'Erro desconhecido')
    } finally {
      setUserHistoryLoading(false)
    }
  }

  useEffect(() => {
    if (selectedProfile) {
      setDrawerTab('config')
    }
  }, [selectedProfile])

  // Painel modal: Esc fecha, Tab fica dentro do painel, a página de fundo não rola e o foco volta ao "Gerenciar" que abriu
  const openerRef = useRef<HTMLElement | null>(null)
  const painelRef = useRef<HTMLDivElement>(null)
  const abertoId = selectedProfile?.id
  useEffect(() => {
    if (!abertoId) return
    const opener = openerRef.current
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') { setSelectedProfile(null); return }
      if (ev.key !== 'Tab' || !painelRef.current) return
      const itens = [...painelRef.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(el => !(el as HTMLButtonElement).disabled && el.offsetParent !== null)
      if (!itens.length) return
      const primeiro = itens[0], ultimo = itens[itens.length - 1]
      if (!painelRef.current.contains(document.activeElement)) { ev.preventDefault(); primeiro.focus() }
      else if (ev.shiftKey && document.activeElement === primeiro) { ev.preventDefault(); ultimo.focus() }
      else if (!ev.shiftKey && document.activeElement === ultimo) { ev.preventDefault(); primeiro.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; opener?.focus?.() }
  }, [abertoId])

  useEffect(() => {
    if (selectedProfile && drawerTab === 'history') {
      loadUserHistory(selectedProfile.id)
    }
  }, [drawerTab, selectedProfile])

  useEffect(() => {
    if (!isLoading) {
      const ctx = gsap.context(() => {
        gsap.fromTo('.user-card', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.04, ease: 'power3.out' })
      }, ref)
      return () => ctx.revert()
    }
  }, [isLoading, roleFilter])

  // Abrir detalhes e preencher estados de edição
  const handleOpenEdit = (profile: Profile) => {
    setSelectedProfile(profile)
    setEditRole(profile.role)
    
    const sub = profile.producer_subscriptions
    setEditPlan(sub?.plan || 'free')
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
    const roleChanged = editRole !== selectedProfile.role
    if (roleChanged && selectedProfile.id === loggedInUser?.id) {
      toast.error('Você não pode alterar o próprio papel.')
      return
    }
    if (roleChanged && editRole === 'admin' && !window.confirm(`Tornar ${selectedProfile.email} administrador da plataforma?`)) return
    setIsSaving(true)
    
    try {
      // 1. Assinatura e recursos primeiro: se falharem (hoje producer_subscriptions não tem regra de acesso),
      //    o papel não fica gravado pela metade.
      if (editPlan !== 'free') {
        const expiresVal = editExpiresAt ? new Date(editExpiresAt).toISOString() : null

        // Tentar upsert na tabela de assinaturas
        const { error: subError } = await supabase
          .from('producer_subscriptions')
          .upsert({
            producer_id: selectedProfile.id,
            plan: editPlan,
            expires_at: expiresVal,
            is_active: true,
            started_at: new Date().toISOString()
          }, { onConflict: 'producer_id' })

        if (subError) throw subError
      } else {
        // Se mudou para free, excluir a assinatura anterior do produtor
        const { error: delSubError } = await supabase
          .from('producer_subscriptions')
          .delete()
          .eq('producer_id', selectedProfile.id)
        if (delSubError) throw delSubError
      }

      // 2. Tratar Custom Features (inserir novas, atualizar prazo das existentes, apagar as desativadas)
      // Produção diverge da migration 00000000000007 (que cria a UNIQUE(user_id, feature_key)):
      // a tabela já existia sem essa constraint, então upsert com onConflict falha ("no unique
      // or exclusion constraint"). Update-se-existe/insert-se-novo em vez de delete+insert: um
      // delete seguido de insert que falhe apagaria a liberação sem conseguir recriar.
      for (const [key, feat] of Object.entries(tempFeatures)) {
        const existed = selectedProfile.user_custom_features?.some(uf => uf.feature_key === key)

        if (feat.active) {
          const expVal = feat.expires_at ? new Date(feat.expires_at).toISOString() : null
          const { error: featError } = existed
            ? await supabase
                .from('user_custom_features')
                .update({ expires_at: expVal })
                .eq('user_id', selectedProfile.id)
                .eq('feature_key', key)
            : await supabase
                .from('user_custom_features')
                .insert({ user_id: selectedProfile.id, feature_key: key, expires_at: expVal })
          if (featError) throw featError
        } else if (existed) {
          const { error: delFeatError } = await supabase
            .from('user_custom_features')
            .delete()
            .eq('user_id', selectedProfile.id)
            .eq('feature_key', key)
          if (delFeatError) throw delFeatError
        }
      }

      // 3. Papel por último (o gatilho do banco só deixa admin alterar role)
      if (roleChanged) {
        const { data: alterado, error: profileError } = await supabase
          .from('profiles')
          // sair de admin zera as permissões: voltar a admin depois não recupera as antigas
          .update(selectedProfile.role === 'admin' && editRole !== 'admin' ? { role: editRole, admin_permissions: [] } : { role: editRole })
          .eq('id', selectedProfile.id)
          .select('id')
        if (profileError) throw profileError
        if (!alterado?.length) throw new Error('sem permissão para alterar o papel desta conta')
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
    
    return matchSearch && matchRole
  })

  // Contadores rápidos para o topo
  const kpis = {
    total: profiles.length,
    producers: profiles.filter(p => p.role === 'producer').length,
    admins: profiles.filter(p => p.role === 'admin').length,
    activeSubscribers: profiles.filter(p => p.producer_subscriptions?.is_active).length
  }

  // Sem foto: iniciais locais (nome e e-mail não vão a api.dicebear.com; LGPD)
  const avatar = (p: Profile, tamanho: string) => p.avatar_url
    ? <img src={p.avatar_url} alt="" className={cn(tamanho, 'shrink-0 rounded-full bg-muted object-cover')} />
    : <span aria-hidden="true" className={cn(tamanho, 'grid shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground')}>{iniciais(p.full_name || p.email)}</span>

  // Rótulo de campo do drawer
  const rotulo = 'mb-1.5 block text-xs font-semibold text-muted-foreground'
  // Título de seção do drawer
  const secao = 'flex items-center gap-1.5 text-[13px] font-semibold text-foreground [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground'

  return (
    <div ref={ref} className="p-6 lg:p-10 max-w-7xl">
      <PageHeader
        title="Gestão de Usuários"
        description="Autorização de acessos, precificação e liberação de recursos do Supabase"
      />

      {/* KPIs Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Usuários', value: kpis.total.toString() },
          { label: 'Produtores', value: kpis.producers.toString() },
          { label: 'Administradores', value: kpis.admins.toString() },
          { label: 'Planos Ativos', value: kpis.activeSubscribers.toString() },
        ].map(k => (
          <div key={k.label} className="user-card">
            <Stat label={k.label} value={k.value} />
          </div>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-md w-full">
          <I.Buscar size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, e-mail ou telefone..."
            aria-label="Buscar usuário"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            aria-label="Filtrar por Papel"
            className={cn(selectNativo, 'md:w-auto')}
          >
            <option value="all">Todos os Papéis</option>
            <option value="user">Participante</option>
            <option value="customer">Cliente</option>
            <option value="producer">Produtor</option>
            <option value="editor">Editor</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
      </div>

      {loadError && (
        <div role="alert" className={cn(alertaErro, 'mb-4')}>
          Não foi possível carregar os usuários: {loadError}
        </div>
      )}

      {/* Users Table */}
      {isLoading ? (
        <div className="space-y-3" role="status" aria-label="Carregando usuários">
          {[1, 2, 3].map(n => (
            <div key={n} className="h-16 rounded-[10px] bg-muted animate-pulse" />
          ))}
        </div>
      ) : filteredProfiles.length === 0 ? (
        <EmptyState title="Nenhum usuário encontrado com as configurações de busca." />
      ) : (
        <div className={`${painel} overflow-hidden`}>
          <Tabela label="Usuários">
            <thead>
              <tr className="border-b border-border">
                <th className={cn(th, 'px-3 sm:px-4')}>Usuário</th>
                <th className={cn(th, 'hidden md:table-cell')}>Contato</th>
                <th className={cn(th, 'hidden lg:table-cell')}>Assinatura / Preço</th>
                <th className={cn(th, 'hidden lg:table-cell')}>Recursos Extras</th>
                <th className={cn(th, 'px-3 sm:px-4')}>Cadastro</th>
                <th className={cn(th, 'px-3 sm:px-4')}><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {filteredProfiles.map(p => {
                const sub = p.producer_subscriptions
                const customFeats = p.user_custom_features || []

                return (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-[var(--ev-tint-hover)]">
                    <td className="px-3 py-3 sm:px-4">
                      <div className="flex items-center gap-3">
                        {avatar(p, 'size-9')}
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground">{p.full_name || 'Sem nome'}</div>
                          <Badge variant="secondary" className={roleColors[p.role] || chipNeutro}>
                            {roleLabels[p.role] || p.role}
                          </Badge>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <div className="space-y-0.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5"><I.Email size={14} aria-hidden="true" />{p.email}</div>
                        {p.phone && <div className="flex items-center gap-1.5"><I.Telefone size={14} aria-hidden="true" />{p.phone}</div>}
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      {sub ? (
                        <div className="text-xs">
                          <span className="font-semibold capitalize text-primary">{sub.plan}</span>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            <span>Preço do plano</span>
                          </div>
                          {sub.expires_at && (
                            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                              <I.Horario size={12} aria-hidden="true" /> Expira: {new Date(sub.expires_at).toLocaleDateString('pt-BR')}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Nenhuma</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      {customFeats.length > 0 ? (
                        <div className="flex max-w-[200px] flex-wrap gap-1">
                          {customFeats.map(f => (
                            <Badge key={f.feature_key} variant="secondary" className={cn(chipNeutro, 'text-[11px]')} title={f.expires_at ? `Expira em ${new Date(f.expires_at).toLocaleDateString('pt-BR')}` : 'Tempo ilimitado'}>
                              {f.feature_key}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 sm:px-4">
                      <span className="text-xs text-muted-foreground" title="Data do cadastro">{new Date(p.created_at).toLocaleDateString('pt-BR')}</span>
                    </td>
                    <td className="px-3 py-3 sm:px-4">
                      {/* no celular só o ícone (a coluna não pode empurrar a tabela além da tela); o nome acessível leva o nome da pessoa */}
                      <Button variant="outline" size="sm" className="max-sm:size-8 max-sm:px-0" aria-label={`Gerenciar ${p.full_name || p.email}`} onClick={ev => { openerRef.current = ev.currentTarget; handleOpenEdit(p) }}>
                        <I.Editar aria-hidden="true" />
                        <span className="max-sm:sr-only">Gerenciar</span>
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </Tabela>
        </div>
      )}

      {/* Drawer Lateral de Gerenciamento do Usuário */}
      {selectedProfile && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 glass-backdrop" onClick={() => setSelectedProfile(null)} />
          <div ref={painelRef} role="dialog" aria-modal="true" aria-label={`Gerenciar ${selectedProfile.full_name || selectedProfile.email}`} className="glass-panel relative w-full max-w-lg h-full flex flex-col justify-between overflow-y-auto rounded-r-none border-y-0 border-r-0 text-foreground">
            {/* Top Header */}
            <div className="p-6 border-b border-border flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                {avatar(selectedProfile, 'size-12')}
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold leading-6 text-foreground">{selectedProfile.full_name || 'Sem nome'}</h3>
                  <div className="break-all text-xs text-muted-foreground">{selectedProfile.email}</div>
                </div>
              </div>
              <Button autoFocus variant="ghost" size="icon" onClick={() => setSelectedProfile(null)} aria-label="Fechar gerenciamento">
                <I.Fechar aria-hidden="true" />
              </Button>
            </div>

            {/* Tabs Selector */}
            <div role="group" aria-label="Seções do usuário" className="px-6 border-b border-border flex gap-4">
              {([['config', 'Configurações RLS'], ['history', 'Histórico & Comportamento']] as const).map(([id, rotuloAba]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={drawerTab === id}
                  onClick={() => setDrawerTab(id)}
                  className={cn(
                    '-mb-px border-b-2 py-3 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    drawerTab === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  {rotuloAba}
                </button>
              ))}
            </div>

            {/* Scrollable Body depends on Tab */}
            {drawerTab === 'config' ? (
              <div className="p-6 space-y-6 overflow-y-auto flex-1">
                {/* Seção 1: Role & Autorização */}
                <div className="space-y-4">
                  <h4 className={secao}><I.Conta aria-hidden="true" /> Conta & Papel (Role)</h4>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Select Role */}
                    <div>
                      <label htmlFor="usuario-papel" className={rotulo}>Papel do Usuário</label>
                      <select
                        id="usuario-papel"
                        value={editRole}
                        onChange={e => setEditRole(e.target.value as Profile['role'])}
                        disabled={selectedProfile.id === loggedInUser?.id || (selectedProfile.role === 'admin' && !souSuper)}
                        title={selectedProfile.id === loggedInUser?.id ? 'Você não pode alterar o próprio papel' : selectedProfile.role === 'admin' && !souSuper ? 'Papel de admin: só o Super Admin altera (em Equipe)' : undefined}
                        className={cn(selectNativo, 'disabled:cursor-not-allowed disabled:opacity-50')}
                      >
                        <option value="user">Participante</option>
                        <option value="producer">Produtor</option>
                        <option value="editor">Editor</option>
                        {(souSuper || selectedProfile.role === 'admin') && <option value="admin">Administrador</option>}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Seção 2: Plano & Gratuidade */}
                <div className="space-y-4 pt-4 border-t border-border">
                  <h4 className={secao}><I.Cartao aria-hidden="true" /> Plano & Assinatura</h4>

                  <div className="space-y-3">
                    {/* Select Plan */}
                    <div>
                      <label htmlFor="usuario-plano" className={rotulo}>Alterar Plano</label>
                      <select
                        id="usuario-plano"
                        value={editPlan}
                        onChange={e => setEditPlan(e.target.value as Subscription['plan'])}
                        className={selectNativo}
                      >
                        {PLANS.map(p => (
                          <option key={p.id} value={p.id}>{p.name}{p.monthlyPrice ? ` (R$ ${p.monthlyPrice}/mês)` : ' (gratuito)'}</option>
                        ))}
                      </select>
                    </div>

                    {editPlan !== 'free' && (
                      <div className="grid grid-cols-2 gap-4">
                        {/* Tempo de Gratuidade / Expiração */}
                        <div>
                          <label htmlFor="usuario-vencimento" className={rotulo}>Vencimento / Expiração</label>
                          <Input
                            id="usuario-vencimento"
                            type="date"
                            value={editExpiresAt}
                            onChange={e => setEditExpiresAt(e.target.value)}
                          />
                          <span className="mt-1 block text-[11px] text-muted-foreground">Data limite da gratuidade ou assinatura.</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Seção 3: Ferramentas Adicionais (Features) */}
                <div className="space-y-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className={secao}>
                      <I.Chave aria-hidden="true" /> Ferramentas do Produtor
                    </h4>
                    <Badge variant="secondary" className={cn(chipInfo, 'uppercase')}>
                      Plano: {editPlan}
                    </Badge>
                  </div>

                  {editRole === 'user' || editRole === 'customer' ? (
                    <div className={cn(alertaAviso, 'p-4 text-[13px] leading-relaxed')}>
                      <I.Info size={16} className="text-[var(--ev-warning)]" aria-hidden="true" />
                      <p>
                        Este usuário é um <strong>Participante</strong>. Ferramentas de produtor não se aplicam a contas de participante comuns, a menos que você altere o papel dele para Produtor ou Editor no painel acima.
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Ferramentas nativas do plano <strong className="capitalize">{editPlan}</strong> são liberadas automaticamente. Ative individualmente (Bypass) os recursos adicionais desejados.
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                        {availableFeatures.map(feat => {
                          const inPlan = isFeatureInPlan(feat.key)
                          const tempFeat = tempFeatures[feat.key] || { active: false, expires_at: '' }

                          return (
                            <div
                              key={feat.key}
                              className={cn(
                                'flex min-h-[92px] flex-col justify-between rounded-[10px] border p-3',
                                inPlan ? chipOk : tempFeat.active ? 'border-primary/40 bg-[var(--ev-brand-soft)]' : 'border-border bg-card',
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="text-xs font-semibold text-foreground">{feat.name}</div>
                                  <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{feat.desc}</div>
                                </div>

                                {inPlan ? (
                                  <Badge variant="secondary" className={cn(chipOk, 'shrink-0')}>
                                    No Plano
                                  </Badge>
                                ) : (
                                  <Switch
                                    checked={tempFeat.active}
                                    onCheckedChange={() => setTempFeatures(prev => ({
                                      ...prev,
                                      [feat.key]: { ...prev[feat.key], active: !tempFeat.active }
                                    }))}
                                    aria-label={`Liberar ${feat.name}`}
                                  />
                                )}
                              </div>

                              {!inPlan && tempFeat.active && (
                                <div className="mt-2 flex flex-col gap-1.5 border-t border-border pt-2">
                                  <div className="flex items-center justify-between gap-1 text-[11px] text-muted-foreground">
                                    <span className="flex items-center gap-1 font-medium"><I.Horario size={12} aria-hidden="true" /> Expira em:</span>
                                    <button
                                      type="button"
                                      onClick={() => setTempFeatures(prev => ({
                                        ...prev,
                                        [feat.key]: {
                                          ...prev[feat.key],
                                          expires_at: tempFeat.expires_at ? '' : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10)
                                        }
                                      }))}
                                      className="rounded-xs text-[11px] font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                      {tempFeat.expires_at ? 'Mudar p/ Vitalício' : 'Definir Prazo (30d)'}
                                    </button>
                                  </div>
                                  {tempFeat.expires_at ? (
                                    <Input
                                      type="date"
                                      aria-label={`Expiração de ${feat.name}`}
                                      value={tempFeat.expires_at}
                                      onChange={e => setTempFeatures(prev => ({
                                        ...prev,
                                        [feat.key]: { ...prev[feat.key], expires_at: e.target.value }
                                      }))}
                                      className="h-8 px-2 text-xs"
                                    />
                                  ) : (
                                    <span className="text-[11px] font-semibold text-[var(--ev-success)]">Acesso Vitalício</span>
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
                  <div className="py-20 text-center" role="status">
                    <Spinner className="mx-auto mb-3 size-8 text-primary" />
                    <p className="text-xs text-muted-foreground">Carregando histórico e métricas...</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {historyError && (
                      <div role="alert" className={cn(alertaErro, 'p-3 text-xs')}>
                        Não foi possível carregar o histórico: {historyError}
                      </div>
                    )}
                    {/* Status da Conta */}
                    <div className="flex items-center justify-between gap-3 rounded-[10px] border border-border bg-secondary/50 p-4">
                      <div>
                        <div className="text-xs text-muted-foreground">Status do Usuário</div>
                        <div className="mt-0.5 text-sm font-semibold text-foreground">Tempo de Atividade & Assinatura</div>
                      </div>
                      <Badge variant="secondary" className={cn(
                        'px-3 py-1',
                        userHistoryMetrics?.accountStatus === 'Ativo' ? chipOk
                          : userHistoryMetrics?.accountStatus === 'Inativo' ? chipNeutro
                          : chipErro,
                      )}>
                        <span aria-hidden="true" className="size-2 rounded-full bg-current" />
                        {userHistoryMetrics?.accountStatus || 'Sem registros'}
                      </Badge>
                    </div>

                    {/* Grid de Métricas */}
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: 'Tempo sem Uso', value: !userHistoryMetrics ? '—' : userHistoryMetrics.inactivityDays === 0 ? 'Ativo Hoje' : `${userHistoryMetrics.inactivityDays} dias`, desc: 'Desde o último log', icon: I.Horario },
                        { label: 'Total de Logins', value: `${userHistoryMetrics?.totalLogins || 0} logins`, desc: 'Acessos registrados', icon: I.Escudo },
                        { label: 'Média por Sessão', value: `${userHistoryMetrics?.avgSessionTimeMin || 0} min`, desc: 'Tempo médio de navegação', icon: I.Atividade },
                        { label: 'Frequência Mensal', value: `${userHistoryMetrics?.monthlyFrequency || 0} dias ativos`, desc: 'Acessos únicos nos últimos 30d', icon: I.Pessoas },
                      ].map(m => (
                        <div key={m.label} className="rounded-[10px] border border-border bg-card p-4">
                          <m.icon size={16} className="mb-2 text-muted-foreground" aria-hidden="true" />
                          <div className="text-sm font-semibold text-foreground">{m.value}</div>
                          <div className="mt-0.5 text-xs font-medium text-muted-foreground">{m.label}</div>
                          <div className="mt-1 text-[11px] text-muted-foreground">{m.desc}</div>
                        </div>
                      ))}
                    </div>

                    {/* Carrinho Abandonado */}
                    <div className="space-y-3 pt-4 border-t border-border">
                      <h4 className={secao}>
                        <I.SetaDiagonalCima aria-hidden="true" /> Carrinho Abandonado (Visualizados sem Compra)
                      </h4>
                      <p className="text-xs text-muted-foreground">Eventos cujos detalhes foram visualizados, mas para os quais nenhum ingresso foi adquirido ainda.</p>

                      {abandonedEvents.length === 0 ? (
                        <div className="rounded-[10px] border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                          Nenhum interesse abandonado registrado.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {abandonedEvents.map(ev => (
                            <div key={ev.id} className="flex items-start justify-between gap-3 rounded-[10px] border border-border bg-card p-3.5">
                              <div>
                                <div className="text-xs font-semibold text-foreground">{ev.title}</div>
                                <div className="mt-1 text-[11px] text-muted-foreground">
                                  {new Date(ev.date).toLocaleDateString('pt-BR')} · {ev.time} · {ev.venue}
                                </div>
                              </div>
                              <Badge variant="secondary" className={chipAviso}>
                                Sem ingresso
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Timeline de Navegação Recente */}
                    <div className="space-y-3 pt-4 border-t border-border">
                      <h4 className={secao}>
                        <I.Atividade aria-hidden="true" /> Histórico de Navegação Recente
                      </h4>
                      <p className="text-xs text-muted-foreground">Últimas 15 ações registradas para esta conta de acordo com a telemetria do app.</p>

                      {recentNavigation.length === 0 ? (
                        <div className="rounded-[10px] border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                          Nenhuma atividade recente registrada.
                        </div>
                      ) : (
                        <div className="relative ml-2 space-y-4 border-l border-border pl-2">
                          {recentNavigation.map(log => {
                            const date = new Date(log.created_at)
                            return (
                              <div key={log.id} className="relative pl-6">
                                <div className={cn(
                                  'absolute left-[-25px] top-1 size-3 rounded-full border-2 border-card',
                                  log.event_type === 'login' || log.event_type === 'purchase' ? 'bg-[var(--ev-success)]'
                                    : log.event_type === 'add_to_cart' ? 'bg-[var(--ev-warning)]'
                                    : 'bg-primary',
                                )} />
                                <div className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
                                  <span className="font-semibold capitalize text-foreground">
                                    {log.event_type === 'page_view' ? 'Visualizou Página' :
                                     log.event_type === 'login' ? 'Efetuou Login' :
                                     log.event_type === 'add_to_cart' ? 'Adicionou ao Carrinho' :
                                     log.event_type === 'purchase' ? 'Comprou Ingresso' :
                                     log.event_type === 'session_start' ? 'Iniciou Sessão' :
                                     log.event_type}
                                  </span>
                                  <span className="font-mono text-[11px]">
                                    {date.toLocaleDateString('pt-BR')} {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <div className="mt-0.5 break-all font-mono text-[11px] text-muted-foreground">
                                  {log.path || '/'}
                                </div>
                                {log.metadata && (
                                  <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                                    Device: {log.metadata.device || 'Desconhecido'}{log.metadata.userAgent ? ` · Agent: ${String(log.metadata.userAgent).slice(0, 40)}…` : ''}
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
            <div className="p-6 bg-secondary/50 border-t border-border flex items-center justify-between gap-3">
              <Button variant="outline" onClick={() => setSelectedProfile(null)}>
                Cancelar
              </Button>
              {drawerTab === 'config' && (
                <Button onClick={handleSaveUser} loading={isSaving}>
                  <I.Guardar aria-hidden="true" />
                  Salvar Alterações
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
