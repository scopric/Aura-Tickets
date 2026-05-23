import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import gsap from 'gsap'
import {
  Users, Plus, Mail, Shield, Eye, Check, Trash2,
  LayoutDashboard, Calendar, FolderOpen, Palette, BarChart3,
  Wallet, Wine, Calculator, Settings, Activity,
  ChevronDown, ChevronUp, UserCheck,
  Edit3, Ban
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

interface Permission {
  view: boolean
  edit: boolean
  delete: boolean
}

interface TeamMember {
  id: string
  name: string
  email: string
  role: 'admin' | 'editor' | 'viewer'
  status: 'active' | 'pending' | 'blocked'
  permissions: Record<string, Permission>
  assignedTasks: number
  completedTasks: number
  lastActive: string
  joinedAt: string
  avatar: string
}

const defaultPermissions: Record<string, { label: string; icon: typeof LayoutDashboard }> = {
  dashboard: { label: 'Dashboard', icon: LayoutDashboard },
  events: { label: 'Eventos', icon: Calendar },
  eventManager: { label: 'Gestor de Festas', icon: FolderOpen },
  planner: { label: 'Planejar Evento', icon: Edit3 },
  brand: { label: 'Brand Studio', icon: Palette },
  crm: { label: 'CRM', icon: Activity },
  finance: { label: 'Financeiro', icon: BarChart3 },
  wallet: { label: 'Carteira', icon: Wallet },
  menu: { label: 'Cardápio', icon: Wine },
  tables: { label: 'Mesas', icon: Calculator },
  settings: { label: 'Configurações', icon: Settings },
}

const createDefaultPermissions = (): Record<string, Permission> => {
  const perms: Record<string, Permission> = {}
  Object.keys(defaultPermissions).forEach(key => {
    perms[key] = { view: true, edit: false, delete: false }
  })
  return perms
}

const createAdminPermissions = (): Record<string, Permission> => {
  const perms: Record<string, Permission> = {}
  Object.keys(defaultPermissions).forEach(key => {
    perms[key] = { view: true, edit: true, delete: true }
  })
  return perms
}

export default function TeamManager() {
  const { user } = useAuth()
  const ref = useRef<HTMLDivElement>(null)
  
  const [members, setMembers] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor')
  const [expandedMember, setExpandedMember] = useState<string | null>(null)
  const [editingMember, setEditingMember] = useState<string | null>(null)

  // Mapear dados do banco de dados para a interface local
  const mapDbMemberToTeamMember = (dbMember: any): TeamMember => {
    const profile = dbMember.profiles || {}
    let status: TeamMember['status'] = 'pending'
    if (dbMember.accepted_at) {
      status = 'active'
    } else if (dbMember.role === 'blocked') {
      status = 'blocked'
    }

    const isAdm = dbMember.role === 'admin'

    return {
      id: dbMember.id,
      name: profile.full_name || dbMember.email?.split('@')[0] || 'Convidado',
      email: dbMember.email || profile.email || '',
      role: (dbMember.role || 'viewer') as TeamMember['role'],
      status: status,
      permissions: isAdm ? createAdminPermissions() : createDefaultPermissions(),
      assignedTasks: Math.floor(Math.random() * 5), // Dados fictícios para o layout de tarefas
      completedTasks: Math.floor(Math.random() * 2),
      lastActive: dbMember.accepted_at ? 'Ativo recentemente' : '-',
      joinedAt: new Date(dbMember.invited_at || dbMember.created_at || Date.now()).toLocaleDateString('pt-BR'),
      avatar: profile.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${profile.full_name || 'U'}`
    }
  }

  // Carregar lista de membros do Supabase
  const loadMembers = async () => {
    if (!user?.id) return
    setIsLoading(true)
    try {
      // 1. Consultar a tabela team_members
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          *,
          profiles:user_id (
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('producer_id', user.id)

      if (error) throw error

      if (!data || data.length === 0) {
        // Se estiver vazio, rodamos o auto-seed
        await seedInitialTeam(user.id)
        return
      }

      setMembers(data.map(mapDbMemberToTeamMember))
    } catch (err: any) {
      console.error('Erro ao carregar equipe:', err)
      toast.error('Erro ao carregar equipe de administradores')
    } finally {
      setIsLoading(false)
    }
  }

  // Auto-seed de membros de teste
  const seedInitialTeam = async (producerId: string) => {
    try {
      // Criar alguns usuários falsos na tabela profiles para associar (ou usar o próprio id como admin)
      // Como não podemos criar contas no Auth facilmente, criaremos linhas na tabela team_members simulando os convites
      const initialMembers = [
        { producer_id: producerId, user_id: producerId, role: 'admin', invited_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(), accepted_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString() },
        // Criaremos convites simulados
        { producer_id: producerId, user_id: producerId, role: 'editor', invited_at: new Date().toISOString(), accepted_at: null },
        { producer_id: producerId, user_id: producerId, role: 'viewer', invited_at: new Date().toISOString(), accepted_at: null }
      ]

      const { error } = await supabase
        .from('team_members')
        .insert(initialMembers)

      if (error) throw error

      // Recarregar
      const { data: finalMembers } = await supabase
        .from('team_members')
        .select(`
          *,
          profiles:user_id (
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('producer_id', producerId)

      if (finalMembers) {
        setMembers(finalMembers.map(mapDbMemberToTeamMember))
      }
    } catch (err) {
      console.error('Erro no auto-seed de equipe:', err)
    }
  }

  useEffect(() => {
    loadMembers()
  }, [user?.id])

  useEffect(() => {
    if (!isLoading) {
      const ctx = gsap.context(() => {
        gsap.fromTo('.team-card', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.08, ease: 'power3.out' })
      }, ref)
      return () => ctx.revert()
    }
  }, [isLoading])

  const canAddMore = members.filter(m => m.status !== 'blocked').length < 5

  // Enviar convite de membro no Supabase
  const handleInvite = async () => {
    if (!inviteEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) {
      toast.error('E-mail inválido')
      return
    }
    if (members.some(m => m.email === inviteEmail)) {
      toast.error('Este e-mail já está na equipe')
      return
    }
    if (!canAddMore) {
      toast.error('Limite de 5 membros atingido')
      return
    }
    if (!user?.id) return

    try {
      // 1. Verificar se existe usuário cadastrado com esse e-mail na tabela profiles
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', inviteEmail)
        .maybeSingle()

      // Para fins de MVP em localhost, se o perfil não existe, vinculamos temporariamente ao id do próprio produtor
      // simulando o convite pendente.
      const targetUserId = profileData ? profileData.id : user.id

      const { error } = await supabase
        .from('team_members')
        .insert({
          producer_id: user.id,
          user_id: targetUserId,
          role: inviteRole,
          invited_at: new Date().toISOString(),
        })

      if (error) throw error

      toast.success(`Convite enviado para ${inviteEmail}!`)
      setInviteEmail('')
      setShowInvite(false)
      loadMembers()
    } catch (err: any) {
      console.error('Erro ao convidar membro:', err)
      toast.error('Erro ao registrar convite no banco')
    }
  }

  // Atualizar permissões locais (simulado para o layout visual)
  const updatePermission = (memberId: string, module: string, type: 'view' | 'edit' | 'delete') => {
    setMembers(members.map(m => {
      if (m.id !== memberId) return m
      const current = m.permissions[module] || { view: false, edit: false, delete: false }
      const updated = { ...current, [type]: !current[type] }
      if (type === 'edit' && updated.edit && !updated.view) updated.view = true
      if (type === 'view' && !updated.view) { updated.edit = false; updated.delete = false }
      return { ...m, permissions: { ...m.permissions, [module]: updated } }
    }))
  }

  // Atualizar role do membro no banco
  const updateRole = async (memberId: string, role: 'admin' | 'editor' | 'viewer') => {
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ role: role })
        .eq('id', memberId)

      if (error) throw error

      toast.success('Permissão de nível de acesso atualizada!')
      loadMembers()
    } catch (err: any) {
      console.error('Erro ao atualizar permissão:', err)
      toast.error('Erro ao atualizar permissão no banco')
    }
  }

  // Bloquear/desbloquear membro
  const updateStatus = async (memberId: string, status: 'active' | 'pending' | 'blocked') => {
    try {
      // Se for bloqueado, mudamos a role para blocked na tabela
      const dbRole = status === 'blocked' ? 'blocked' : 'viewer'
      
      const { error } = await supabase
        .from('team_members')
        .update({ 
          role: dbRole,
          accepted_at: status === 'active' ? new Date().toISOString() : null
        })
        .eq('id', memberId)

      if (error) throw error

      toast.success(`Membro ${status === 'blocked' ? 'bloqueado' : 'ativado'}`)
      loadMembers()
    } catch (err: any) {
      console.error('Erro ao alterar status:', err)
      toast.error('Erro ao alterar status no banco')
    }
  }

  // Remover membro do banco
  const removeMember = async (memberId: string) => {
    if (window.confirm('Tem certeza que deseja remover este membro da equipe?')) {
      try {
        const { error } = await supabase
          .from('team_members')
          .delete()
          .eq('id', memberId)

        if (error) throw error

        toast.success('Membro removido da equipe')
        loadMembers()
      } catch (err: any) {
        console.error('Erro ao deletar membro:', err)
        toast.error('Erro ao remover membro no banco')
      }
    }
  }

  const roleLabels: Record<string, { label: string; cls: string }> = {
    admin: { label: 'Administrador', cls: 'bg-plum/10 text-plum border-plum/20' },
    editor: { label: 'Editor', cls: 'bg-amber-50 text-amber-600 border-amber-100' },
    viewer: { label: 'Visualizador', cls: 'bg-blue-50 text-blue-600 border-blue-100' },
    blocked: { label: 'Bloqueado', cls: 'bg-red-50 text-red-500 border-red-100' }
  }

  return (
    <div ref={ref} className="p-6 lg:p-10 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Equipe</h1>
          <p className="text-sm text-espresso/50 mt-1">Gerencie a equipe de administradores e permissões de acesso</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="font-serif text-2xl text-espresso">{members.filter(m => m.status === 'active').length}<span className="text-espresso/20">/5</span></div>
            <div className="text-[10px] text-espresso/30 uppercase tracking-wider font-semibold">Membros ativos</div>
          </div>
          <button
            onClick={() => canAddMore ? setShowInvite(!showInvite) : toast.error('Limite de 5 membros atingido')}
            className={`px-5 py-2.5 text-sm font-medium rounded-full transition-all flex items-center gap-2 ${canAddMore ? 'bg-plum text-cream hover:shadow-glow' : 'bg-espresso/5 text-espresso/20 cursor-not-allowed'}`}
          >
            <Plus className="w-4 h-4" /> Convidar
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="p-5 rounded-2xl bg-white/40 border border-white/60 animate-pulse h-[98px]" />
          ))}
        </div>
      ) : (
        /* KPIs */
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Membros', value: members.length.toString(), icon: Users },
            { label: 'Membros Ativos', value: members.filter(m => m.status === 'active').length.toString(), icon: UserCheck },
            { label: 'Tarefas Ativas', value: members.reduce((s, m) => s + m.assignedTasks, 0).toString(), icon: Activity },
            { label: 'Tarefas Concluídas', value: members.reduce((s, m) => s + m.completedTasks, 0).toString(), icon: Check },
          ].map(k => (
            <div key={k.label} className="team-card p-5 rounded-2xl bg-white/60 border border-white/60">
              <k.icon className="w-4 h-4 text-plum mb-3" />
              <div className="font-serif text-2xl text-espresso">{k.value}</div>
              <div className="text-[10px] text-espresso/30 mt-1 uppercase tracking-wider font-semibold">{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Invite Form */}
      {showInvite && (
        <div className="team-card p-6 rounded-2xl bg-white/60 border border-white/60 mb-6">
          <h3 className="text-sm font-medium text-espresso mb-4">Convidar Membro</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="text-xs text-espresso/40 mb-1 block">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-espresso/20" />
                <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="colega@email.com" className="w-full pl-10 pr-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              </div>
            </div>
            <div>
              <label className="text-xs text-espresso/40 mb-1 block">Nível de Acesso</label>
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value as 'editor' | 'viewer')} aria-label="Nível de Acesso" title="Selecionar nível de acesso" className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30">
                <option value="editor">Editor</option>
                <option value="viewer">Visualizador</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button onClick={handleInvite} className="px-5 py-2.5 bg-plum text-cream text-sm rounded-full hover:shadow-glow transition-all flex items-center gap-2"><Mail className="w-4 h-4" /> Enviar Convite</button>
            <button onClick={() => setShowInvite(false)} className="px-5 py-2.5 text-sm text-espresso/40 hover:text-espresso transition-colors">Cancelar</button>
          </div>
        </div>
      )}

      {/* Members List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(n => (
            <div key={n} className="h-16 bg-white/40 border border-white/60 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {members.map(member => {
            const isExpanded = expandedMember === member.id
            const isEditing = editingMember === member.id
            const roleCfg = roleLabels[member.role] || roleLabels.viewer
            const completion = member.assignedTasks > 0 ? Math.round((member.completedTasks / member.assignedTasks) * 100) : 0

            return (
              <div key={member.id} className="team-card bg-white/60 border border-white/60 rounded-2xl overflow-hidden">
                {/* Summary Row */}
                <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/40 transition-colors" onClick={() => setExpandedMember(isExpanded ? null : member.id)}>
                  <img src={member.avatar} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-canvas flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-espresso">{member.name}</span>
                      <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${roleCfg.cls}`}>{roleCfg.label}</span>
                      {member.status === 'pending' && <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] rounded-full border border-amber-100">Pendente</span>}
                      {member.status === 'blocked' && <span className="px-2 py-0.5 bg-red-50 text-red-500 text-[10px] rounded-full border border-red-100 font-medium">Bloqueado</span>}
                    </div>
                    <div className="text-[11px] text-espresso/30 mt-0.5">{member.email} · Atividade: {member.lastActive}</div>
                  </div>
                  <div className="hidden md:flex items-center gap-4 flex-shrink-0">
                    <div className="text-center">
                      <div className="text-xs font-semibold text-espresso">{member.assignedTasks}</div>
                      <div className="text-[9px] text-espresso/30">Tarefas</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-semibold text-green-600">{completion}%</div>
                      <div className="text-[9px] text-espresso/30">Concluído</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-espresso/20" /> : <ChevronDown className="w-4 h-4 text-espresso/20" />}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-espresso/5 p-4 space-y-4">
                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <select value={member.role} onChange={e => updateRole(member.id, e.target.value as 'admin' | 'editor' | 'viewer')} aria-label="Cargo do membro" title="Selecionar cargo do membro" className="px-3 py-1.5 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso focus:outline-none">
                        <option value="admin">Administrador</option>
                        <option value="editor">Editor</option>
                        <option value="viewer">Visualizador</option>
                      </select>
                      {member.status !== 'blocked' ? (
                        <button onClick={() => updateStatus(member.id, 'blocked')} className="px-3 py-1.5 bg-red-50 text-red-500 text-xs rounded-lg border border-red-100 hover:bg-red-100 transition-all flex items-center gap-1"><Ban className="w-3 h-3" /> Bloquear</button>
                      ) : (
                        <button onClick={() => updateStatus(member.id, 'active')} className="px-3 py-1.5 bg-green-50 text-green-600 text-xs rounded-lg border border-green-100 hover:bg-green-100 transition-all flex items-center gap-1"><Check className="w-3 h-3" /> Ativar</button>
                      )}
                      <button onClick={() => { setEditingMember(isEditing ? null : member.id) }} className="px-3 py-1.5 bg-plum/10 text-plum text-xs rounded-lg hover:bg-plum/20 transition-all flex items-center gap-1"><Shield className="w-3 h-3" /> {isEditing ? 'Fechar' : 'Permissões'}</button>
                      <button onClick={() => removeMember(member.id)} className="px-3 py-1.5 text-red-500 text-xs hover:bg-red-50 rounded-lg transition-all flex items-center gap-1 ml-auto"><Trash2 className="w-3 h-3" /> Remover</button>
                    </div>

                    {/* Permissions Grid */}
                    {isEditing && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-semibold text-espresso">Permissões de Módulo</h4>
                          <div className="flex items-center gap-3 text-[10px] text-espresso/30">
                            <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> Ver</span>
                            <span className="flex items-center gap-1"><Edit3 className="w-3 h-3" /> Editar</span>
                            <span className="flex items-center gap-1"><Trash2 className="w-3 h-3" /> Excluir</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {Object.entries(defaultPermissions).map(([key, mod]) => {
                            const perm = member.permissions[key] || { view: false, edit: false, delete: false }
                            const Icon = mod.icon
                            return (
                              <div key={key} className="p-3 rounded-xl bg-white/40 border border-white/60">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <Icon className="w-4 h-4 text-plum" />
                                    <span className="text-xs text-espresso">{mod.label}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => updatePermission(member.id, key, 'view')} aria-label="Permissão de Visualização" title="Visualizar" className={`p-1 rounded transition-all ${perm.view ? 'bg-plum/10 text-plum' : 'bg-espresso/5 text-espresso/15'}`}><Eye className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => updatePermission(member.id, key, 'edit')} aria-label="Permissão de Edição" title="Editar" className={`p-1 rounded transition-all ${perm.edit ? 'bg-amber-50 text-amber-600' : 'bg-espresso/5 text-espresso/15'}`}><Edit3 className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => updatePermission(member.id, key, 'delete')} aria-label="Permissão de Exclusão" title="Excluir" className={`p-1 rounded transition-all ${perm.delete ? 'bg-red-50 text-red-500' : 'bg-espresso/5 text-espresso/15'}`}><Trash2 className="w-3.5 h-3.5" /></button>
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  {perm.view && <span className="px-1.5 py-0.5 bg-plum/10 text-plum text-[9px] rounded-full">Ver</span>}
                                  {perm.edit && <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 text-[9px] rounded-full">Editar</span>}
                                  {perm.delete && <span className="px-1.5 py-0.5 bg-red-50 text-red-500 text-[9px] rounded-full">Excluir</span>}
                                  {!perm.view && !perm.edit && !perm.delete && <span className="text-[9px] text-espresso/20 font-medium">Sem acesso</span>}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 rounded-xl bg-canvas text-center">
                        <div className="text-sm font-semibold text-espresso">{member.assignedTasks}</div>
                        <div className="text-[9px] text-espresso/30">Atribuídas</div>
                      </div>
                      <div className="p-3 rounded-xl bg-canvas text-center">
                        <div className="text-sm font-semibold text-green-600">{member.completedTasks}</div>
                        <div className="text-[9px] text-espresso/30">Concluídas</div>
                      </div>
                      <div className="p-3 rounded-xl bg-canvas text-center">
                        <div className="text-sm font-semibold text-espresso">{member.joinedAt}</div>
                        <div className="text-[9px] text-espresso/30">Entrou em</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
