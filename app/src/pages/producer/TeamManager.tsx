import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import gsap from 'gsap'
import {
  Users, Plus, Mail, Shield, Eye, Check, Trash2,
  LayoutDashboard, Calendar, FolderOpen, Palette, BarChart3,
  Wallet, Wine, Calculator, Settings, Activity,
  ChevronDown, ChevronUp, UserCheck,
  AlertTriangle, Edit3, Ban
} from 'lucide-react'

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
  menu: { label: 'Cardapio', icon: Wine },
  tables: { label: 'Mesas', icon: Calculator },
  settings: { label: 'Configuracoes', icon: Settings },
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
  const ref = useRef<HTMLDivElement>(null)
  const [members, setMembers] = useState<TeamMember[]>([
    {
      id: '1', name: 'Maria Oliveira', email: 'maria@auraevents.com',
      role: 'admin', status: 'active', permissions: createAdminPermissions(),
      assignedTasks: 12, completedTasks: 8, lastActive: 'Hoje, 14:30',
      joinedAt: '10 Jan 2025', avatar: 'https://i.pravatar.cc/150?img=5'
    },
    {
      id: '2', name: 'Pedro Costa', email: 'pedro@auraevents.com',
      role: 'editor', status: 'active',
      permissions: { ...createDefaultPermissions(), events: { view: true, edit: true, delete: false }, crm: { view: true, edit: true, delete: false } },
      assignedTasks: 8, completedTasks: 5, lastActive: 'Ontem, 18:45',
      joinedAt: '15 Fev 2025', avatar: 'https://i.pravatar.cc/150?img=11'
    },
    {
      id: '3', name: 'Ana Santos', email: 'ana@auraevents.com',
      role: 'viewer', status: 'active',
      permissions: { ...createDefaultPermissions(), events: { view: true, edit: false, delete: false }, finance: { view: true, edit: false, delete: false } },
      assignedTasks: 4, completedTasks: 4, lastActive: 'Hoje, 09:15',
      joinedAt: '01 Mar 2025', avatar: 'https://i.pravatar.cc/150?img=9'
    },
    {
      id: '4', name: 'Lucas Mendes', email: 'lucas@auraevents.com',
      role: 'editor', status: 'pending',
      permissions: createDefaultPermissions(),
      assignedTasks: 0, completedTasks: 0, lastActive: '-',
      joinedAt: '16 Jun 2025', avatar: 'https://i.pravatar.cc/150?img=3'
    },
  ])

  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor')
  const [expandedMember, setExpandedMember] = useState<string | null>(null)
  const [editingMember, setEditingMember] = useState<string | null>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.team-card', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.08, ease: 'power3.out' })
    }, ref)
    return () => ctx.revert()
  }, [])

  const canAddMore = members.filter(m => m.status !== 'blocked').length < 5

  const handleInvite = () => {
    if (!inviteEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) {
      toast.error('E-mail invalido')
      return
    }
    if (members.some(m => m.email === inviteEmail)) {
      toast.error('Este e-mail ja esta na equipe')
      return
    }
    if (!canAddMore) {
      toast.error('Limite de 5 membros atingido')
      return
    }

    const perms = inviteRole === 'editor'
      ? { ...createDefaultPermissions(), events: { view: true, edit: true, delete: false }, crm: { view: true, edit: true, delete: false }, finance: { view: true, edit: true, delete: false } }
      : createDefaultPermissions()

    const newMember: TeamMember = {
      id: Date.now().toString(),
      name: inviteEmail.split('@')[0],
      email: inviteEmail,
      role: inviteRole,
      status: 'pending',
      permissions: perms,
      assignedTasks: 0,
      completedTasks: 0,
      lastActive: '-',
      joinedAt: new Date().toLocaleDateString('pt-BR'),
      avatar: `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70) + 1}`
    }

    setMembers([...members, newMember])
    setInviteEmail('')
    setShowInvite(false)
    toast.success(`Convite enviado para ${inviteEmail}!`)
  }

  const updatePermission = (memberId: string, module: string, type: 'view' | 'edit' | 'delete') => {
    setMembers(members.map(m => {
      if (m.id !== memberId) return m
      const current = m.permissions[module] || { view: false, edit: false, delete: false }
      const updated = { ...current, [type]: !current[type] }
      // If edit is enabled, auto-enable view
      if (type === 'edit' && updated.edit && !updated.view) updated.view = true
      // If view is disabled, auto-disable edit and delete
      if (type === 'view' && !updated.view) { updated.edit = false; updated.delete = false }
      return { ...m, permissions: { ...m.permissions, [module]: updated } }
    }))
  }

  const updateRole = (memberId: string, role: 'admin' | 'editor' | 'viewer') => {
    const perms = role === 'admin' ? createAdminPermissions() : role === 'editor'
      ? { ...createDefaultPermissions(), events: { view: true, edit: true, delete: false }, crm: { view: true, edit: true, delete: false }, finance: { view: true, edit: true, delete: false } }
      : createDefaultPermissions()
    setMembers(members.map(m => m.id === memberId ? { ...m, role, permissions: perms } : m))
    toast.success('Permissao atualizada!')
  }

  const updateStatus = (memberId: string, status: 'active' | 'pending' | 'blocked') => {
    setMembers(members.map(m => m.id === memberId ? { ...m, status } : m))
    toast.success(`Membro ${status === 'blocked' ? 'bloqueado' : status === 'active' ? 'ativado' : 'pendente'}`)
  }

  const removeMember = (memberId: string) => {
    setMembers(members.filter(m => m.id !== memberId))
    toast.success('Membro removido')
  }

  const roleLabels: Record<string, { label: string; cls: string }> = {
    admin: { label: 'Administrador', cls: 'bg-plum/10 text-plum border-plum/20' },
    editor: { label: 'Editor', cls: 'bg-amber-50 text-amber-600 border-amber-100' },
    viewer: { label: 'Visualizador', cls: 'bg-blue-50 text-blue-600 border-blue-100' },
  }

  return (
    <div ref={ref} className="p-6 lg:p-10 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Equipe</h1>
          <p className="text-sm text-espresso/50 mt-1">Gerencie ate 5 membros e controle o que cada um ve</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="font-serif text-2xl text-espresso">{members.filter(m => m.status === 'active').length}<span className="text-espresso/20">/5</span></div>
            <div className="text-[10px] text-espresso/30 uppercase tracking-wider">Membros ativos</div>
          </div>
          <button
            onClick={() => canAddMore ? setShowInvite(!showInvite) : toast.error('Limite de 5 membros atingido')}
            className={`px-5 py-2.5 text-sm font-medium rounded-full transition-all flex items-center gap-2 ${canAddMore ? 'bg-plum text-cream hover:shadow-glow' : 'bg-espresso/5 text-espresso/20 cursor-not-allowed'}`}
          >
            <Plus className="w-4 h-4" /> Convidar
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total', value: members.length.toString(), icon: Users },
          { label: 'Ativos', value: members.filter(m => m.status === 'active').length.toString(), icon: UserCheck },
          { label: 'Tarefas', value: members.reduce((s, m) => s + m.assignedTasks, 0).toString(), icon: Activity },
          { label: 'Concluidas', value: members.reduce((s, m) => s + m.completedTasks, 0).toString(), icon: Check },
        ].map(k => (
          <div key={k.label} className="team-card p-5 rounded-2xl bg-white/60 border border-white/60">
            <k.icon className="w-4 h-4 text-plum mb-3" />
            <div className="font-serif text-2xl text-espresso">{k.value}</div>
            <div className="text-[10px] text-espresso/30 mt-1 uppercase tracking-wider">{k.label}</div>
          </div>
        ))}
      </div>

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
              <label className="text-xs text-espresso/40 mb-1 block">Nivel de Acesso</label>
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value as 'editor' | 'viewer')} className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30">
                <option value="editor">Editor</option>
                <option value="viewer">Visualizador</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button onClick={handleInvite} className="px-5 py-2.5 bg-plum text-cream text-sm rounded-full hover:shadow-glow transition-all flex items-center gap-2"><Mail className="w-4 h-4" /> Enviar Convite</button>
            <button onClick={() => setShowInvite(false)} className="px-5 py-2.5 text-sm text-espresso/40 hover:text-espresso transition-colors">Cancelar</button>
          </div>
          <div className="mt-3 p-3 rounded-lg bg-canvas/50">
            <p className="text-[10px] text-espresso/30">Editor: pode criar e editar conteudo. Visualizador: apenas ve dados. Administrador: controle total.</p>
          </div>
        </div>
      )}

      {/* Members List */}
      <div className="space-y-3">
        {members.map(member => {
          const isExpanded = expandedMember === member.id
          const isEditing = editingMember === member.id
          const roleCfg = roleLabels[member.role]
          const completion = member.assignedTasks > 0 ? Math.round((member.completedTasks / member.assignedTasks) * 100) : 0

          return (
            <div key={member.id} className="team-card bg-white/60 border border-white/60 rounded-2xl overflow-hidden">
              {/* Summary Row */}
              <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/40 transition-colors" onClick={() => setExpandedMember(isExpanded ? null : member.id)}>
                <img src={member.avatar} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-canvas flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-espresso">{member.name}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${roleCfg.cls}`}>{roleCfg.label}</span>
                    {member.status === 'pending' && <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] rounded-full border border-amber-100">Pendente</span>}
                    {member.status === 'blocked' && <span className="px-2 py-0.5 bg-red-50 text-red-500 text-[10px] rounded-full border border-red-100">Bloqueado</span>}
                  </div>
                  <div className="text-[11px] text-espresso/30 mt-0.5">{member.email} · {member.lastActive}</div>
                </div>
                <div className="hidden md:flex items-center gap-4 flex-shrink-0">
                  <div className="text-center">
                    <div className="text-xs font-medium text-espresso">{member.assignedTasks}</div>
                    <div className="text-[9px] text-espresso/30">Tarefas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-medium text-green-600">{completion}%</div>
                    <div className="text-[9px] text-espresso/30">Concluido</div>
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
                    <select value={member.role} onChange={e => updateRole(member.id, e.target.value as 'admin' | 'editor' | 'viewer')} className="px-3 py-1.5 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso focus:outline-none">
                      <option value="admin">Administrador</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Visualizador</option>
                    </select>
                    {member.status !== 'blocked' ? (
                      <button onClick={() => updateStatus(member.id, 'blocked')} className="px-3 py-1.5 bg-red-50 text-red-500 text-xs rounded-lg border border-red-100 hover:bg-red-100 transition-all flex items-center gap-1"><Ban className="w-3 h-3" /> Bloquear</button>
                    ) : (
                      <button onClick={() => updateStatus(member.id, 'active')} className="px-3 py-1.5 bg-green-50 text-green-600 text-xs rounded-lg border border-green-100 hover:bg-green-100 transition-all flex items-center gap-1"><Check className="w-3 h-3" /> Ativar</button>
                    )}
                    <button onClick={() => { setEditingMember(isEditing ? null : member.id) }} className="px-3 py-1.5 bg-plum/10 text-plum text-xs rounded-lg hover:bg-plum/20 transition-all flex items-center gap-1"><Shield className="w-3 h-3" /> {isEditing ? 'Fechar' : 'Permissoes'}</button>
                    <button onClick={() => removeMember(member.id)} className="px-3 py-1.5 text-red-500 text-xs hover:bg-red-50 rounded-lg transition-all flex items-center gap-1 ml-auto"><Trash2 className="w-3 h-3" /> Remover</button>
                  </div>

                  {/* Permissions Grid */}
                  {isEditing && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-medium text-espresso">Permissoes por Modulo</h4>
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
                                  <button onClick={() => updatePermission(member.id, key, 'view')} className={`p-1 rounded transition-all ${perm.view ? 'bg-plum/10 text-plum' : 'bg-espresso/5 text-espresso/15'}`}><Eye className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => updatePermission(member.id, key, 'edit')} className={`p-1 rounded transition-all ${perm.edit ? 'bg-amber-50 text-amber-600' : 'bg-espresso/5 text-espresso/15'}`}><Edit3 className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => updatePermission(member.id, key, 'delete')} className={`p-1 rounded transition-all ${perm.delete ? 'bg-red-50 text-red-500' : 'bg-espresso/5 text-espresso/15'}`}><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                              </div>
                              <div className="flex gap-1">
                                {perm.view && <span className="px-1.5 py-0.5 bg-plum/10 text-plum text-[9px] rounded-full">Ver</span>}
                                {perm.edit && <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 text-[9px] rounded-full">Editar</span>}
                                {perm.delete && <span className="px-1.5 py-0.5 bg-red-50 text-red-500 text-[9px] rounded-full">Excluir</span>}
                                {!perm.view && !perm.edit && !perm.delete && <span className="text-[9px] text-espresso/20">Sem acesso</span>}
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
                      <div className="text-sm font-medium text-espresso">{member.assignedTasks}</div>
                      <div className="text-[9px] text-espresso/30">Tarefas atribuidas</div>
                    </div>
                    <div className="p-3 rounded-xl bg-canvas text-center">
                      <div className="text-sm font-medium text-green-600">{member.completedTasks}</div>
                      <div className="text-[9px] text-espresso/30">Concluidas</div>
                    </div>
                    <div className="p-3 rounded-xl bg-canvas text-center">
                      <div className="text-sm font-medium text-espresso">{member.joinedAt}</div>
                      <div className="text-[9px] text-espresso/30">Desde</div>
                    </div>
                  </div>

                  {/* Progress */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-espresso/30">Progresso das tarefas</span>
                      <span className="text-[10px] text-espresso/50">{completion}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-canvas rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${completion}%` }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Warning */}
      {members.filter(m => m.status !== 'blocked').length >= 5 && (
        <div className="mt-6 p-4 rounded-xl bg-amber-50/50 border border-amber-100 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-700">Voce atingiu o limite de 5 membros. Para adicionar mais, remova ou bloqueie um membro existente.</p>
        </div>
      )}
    </div>
  )
}
