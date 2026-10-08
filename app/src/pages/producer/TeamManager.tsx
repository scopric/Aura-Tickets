import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import gsap from 'gsap'
import { Link } from 'react-router-dom'
import * as I from '@/components/icones/evokaa16'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { iniciais } from '../../hooks/useConversas'
import { exigirLinhas } from '../../lib/equipe'
import { PageHeader, Stat, selectNativo, chipAviso, chipErro } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface TeamMember {
  id: string
  name: string
  email: string
  role: 'admin' | 'editor' | 'viewer'
  status: 'active' | 'pending' | 'blocked'
  lastActive: string
  joinedAt: string
  avatar: string | null
}

// Respostas de team_convidar ({ ok: false, motivo }); 'generico' não diz se a conta existe
const MOTIVO_CONVITE: Record<string, string> = {
  generico: 'Não foi possível convidar este e-mail. Confira se a pessoa já tem conta na Evokaa com ele.',
  duplicado: 'Esta pessoa já está na sua equipe.',
  bloqueado: 'Esta pessoa está bloqueada na sua equipe. Use Ativar na lista.',
  limite: 'Muitas tentativas. Tente de novo em uma hora.',
  limite_equipe: 'Limite de 5 membros atingido',
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
  const [aviso2fa, setAviso2fa] = useState<string | null>(null)

  // Mapear dados do banco de dados para a interface local
  const mapDbMemberToTeamMember = (dbMember: any): TeamMember => {
    const profile = dbMember.profiles || {}
    let status: TeamMember['status'] = 'pending'
    if (dbMember.blocked_at) {
      status = 'blocked'
    } else if (dbMember.accepted_at) {
      status = 'active'
    }

    return {
      id: dbMember.id,
      name: profile.full_name || dbMember.email?.split('@')[0] || 'Convidado',
      email: dbMember.email || profile.email || '',
      role: (dbMember.role || 'viewer') as TeamMember['role'],
      status: status,
      lastActive: dbMember.accepted_at ? 'Ativo recentemente' : '-',
      joinedAt: new Date(dbMember.invited_at || dbMember.created_at || Date.now()).toLocaleDateString('pt-BR'),
      avatar: profile.avatar_url || null
    }
  }

  // Carregar lista de membros do Supabase
  const loadMembers = async () => {
    if (!user?.id) return
    setIsLoading(true)
    try {
      // A RLS de profiles não deixa o produtor ler nome e e-mail do membro: team_lista (20261029_equipe_convidar.sql)
      const { data, error } = await supabase.rpc('team_lista' as never)

      if (error) throw error

      setMembers(((data ?? []) as any[]).map(m => mapDbMemberToTeamMember({ ...m, profiles: { full_name: m.full_name, email: m.email } })))
    } catch (err: any) {
      console.error('Erro ao carregar equipe:', err)
      toast.error('Erro ao carregar equipe de administradores')
    } finally {
      setIsLoading(false)
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

  // E-mail do convite: a Edge Function pede ao banco quem receber (nada do destinatário sai daqui). Falha não desfaz o convite.
  const enviarEmailConvite = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('send-email', { body: { emailType: 'team_invite' } })
      // enviados 0: o par já gastou o e-mail (remover e convidar de novo) ou nada ficou pendente; o produtor avisa a pessoa
      if (error || data?.ok === false || data?.enviados === 0) throw error ?? new Error('nenhum e-mail enviado')
    } catch {
      toast.warning(`Convite criado, mas o e-mail não saiu. Avise a pessoa para aceitar em ${window.location.origin}/equipe.`)
    }
  }

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

    setAviso2fa(null)
    try {
      // O banco acha a conta e grava o convite (a RLS de profiles não deixa o produtor procurar e-mail): 20261029_equipe_convidar.sql
      const { data, error } = await supabase.rpc('team_convidar' as never, { p_email: inviteEmail.trim(), p_role: inviteRole } as never)
      if (error) throw error
      const r = data as { ok: boolean; motivo?: string } | null
      if (!r?.ok) {
        toast.error(MOTIVO_CONVITE[r?.motivo ?? ''] ?? MOTIVO_CONVITE.generico)
        return
      }

      toast.success('Convite registrado')
      void enviarEmailConvite()
      setInviteEmail('')
      setShowInvite(false)
      loadMembers()
    } catch (err: any) {
      console.error('Erro ao convidar membro:', err)
      // 42501 (não é conta de produtor ou falta o código do 2FA) e 22023 (cargo) trazem o texto do banco
      if (err?.code === '42501' && /duas etapas/.test(err.message ?? '')) setAviso2fa(err.message) // o link para ativar fica no formulário
      toast.error(err?.code === '42501' || err?.code === '22023' ? err.message : 'Erro ao registrar convite no banco')
    }
  }

  // Atualizar role do membro no banco
  const updateRole = async (memberId: string, role: 'admin' | 'editor' | 'viewer') => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .update({ role: role })
        .eq('id', memberId)
        .select('id')

      exigirLinhas(error, data)

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
      // Só blocked_at: o cargo e o aceite (accepted_at) não são do produtor
      const { data, error } = await supabase
        .from('team_members')
        .update({ blocked_at: status === 'blocked' ? new Date().toISOString() : null })
        .eq('id', memberId)
        .select('id')

      exigirLinhas(error, data)

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
        const { data, error } = await supabase
          .from('team_members')
          .delete()
          .eq('id', memberId)
          .select('id')

        exigirLinhas(error, data)

        toast.success('Membro removido da equipe')
        loadMembers()
      } catch (err: any) {
        console.error('Erro ao deletar membro:', err)
        toast.error('Erro ao remover membro no banco')
      }
    }
  }

  const roleLabels: Record<string, { label: string; cls: string }> = {
    admin: { label: 'Administrador', cls: 'border-transparent bg-[var(--ev-brand-soft)] text-primary' },
    editor: { label: 'Editor', cls: chipAviso },
    viewer: { label: 'Visualizador', cls: '' },
    blocked: { label: 'Bloqueado', cls: chipErro }
  }

  return (
    <div ref={ref}>
      {/* Header */}
      <PageHeader
        title="Equipe"
        description="Gerencie a equipe de administradores e permissões de acesso"
        actions={
          <>
            <div className="hidden text-right sm:block">
              <div className="font-display text-2xl font-semibold tabular-nums text-foreground">{members.filter(m => m.status === 'active').length}<span className="text-muted-foreground">/5</span></div>
              <div className="text-xs text-muted-foreground">Membros ativos</div>
            </div>
            <Button
              variant={canAddMore ? 'default' : 'secondary'}
              aria-disabled={!canAddMore}
              onClick={() => canAddMore ? setShowInvite(!showInvite) : toast.error('Limite de 5 membros atingido')}
            >
              <I.Criar aria-hidden="true" /> Convidar
            </Button>
          </>
        }
      />

      {isLoading ? (
        <div aria-busy="true" className="grid grid-cols-2 gap-3">
          {[1, 2].map(n => (
            <Skeleton key={n} className="h-[92px] rounded-[10px] bg-muted" />
          ))}
        </div>
      ) : (
        /* KPIs */
        <div className="grid grid-cols-2 gap-3">
          <div className="team-card"><Stat label="Total Membros" value={members.length.toString()} /></div>
          <div className="team-card"><Stat label="Membros Ativos" value={members.filter(m => m.status === 'active').length.toString()} /></div>
        </div>
      )}

      {/* Invite Form */}
      {showInvite && (
        <div className="team-card mt-6 rounded-[10px] border border-border bg-card p-4">
          <h2 className="mb-4 text-[15px] font-semibold leading-5 text-foreground">Convidar Membro</h2>
          <p className="mb-4 text-xs text-muted-foreground">A pessoa recebe o convite por e-mail e aceita em {window.location.origin}/equipe, entrando com a conta deste e-mail e com a verificação em duas etapas ativa. Visualizador não faz check-in.</p>
          {aviso2fa && <p role="alert" className="mb-4 text-xs text-destructive">{aviso2fa} <Link to="/producer/settings" className="underline">Abrir meu perfil</Link></p>}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="grid gap-1.5 md:col-span-2">
              <Label htmlFor="equipe-email">E-mail</Label>
              <div className="relative">
                <I.Email size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input id="equipe-email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="colega@email.com" className="pl-9" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="equipe-nivel">Nível de Acesso</Label>
              <select id="equipe-nivel" value={inviteRole} onChange={e => setInviteRole(e.target.value as 'editor' | 'viewer')} className={selectNativo}>
                <option value="editor">Editor</option>
                <option value="viewer">Visualizador</option>
              </select>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button onClick={handleInvite}><I.Criar aria-hidden="true" /> Adicionar membro</Button>
            <Button variant="ghost" onClick={() => setShowInvite(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Members List */}
      {isLoading ? (
        <div aria-busy="true" className="mt-6 grid gap-3">
          {[1, 2].map(n => (
            <Skeleton key={n} className="h-16 rounded-[10px] bg-muted" />
          ))}
        </div>
      ) : (
        <div className="mt-6 grid gap-3">
          {members.map(member => {
            const isExpanded = expandedMember === member.id
            const roleCfg = roleLabels[member.role] || roleLabels.viewer

            return (
              <div key={member.id} className="team-card overflow-hidden rounded-[10px] border border-border bg-card">
                {/* Summary Row */}
                <button type="button" aria-expanded={isExpanded} className="flex w-full items-center gap-4 p-4 text-left outline-none transition-colors hover:bg-[var(--ev-tint-hover)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" onClick={() => setExpandedMember(isExpanded ? null : member.id)}>
                  {member.avatar
                    ? <img src={member.avatar} alt="" className="size-10 shrink-0 rounded-full object-cover" />
                    : <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">{iniciais(member.name)}</span>}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{member.name}</span>
                      <Badge variant="secondary" className={roleCfg.cls}>{roleCfg.label}</Badge>
                      {member.status === 'pending' && <Badge variant="secondary" className={chipAviso}>Pendente</Badge>}
                      {member.status === 'blocked' && <Badge variant="secondary" className={chipErro}>Bloqueado</Badge>}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{member.email} · Atividade: {member.lastActive}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 text-muted-foreground">
                    {isExpanded ? <I.ChevronCima aria-hidden="true" size={16} /> : <I.ChevronBaixo aria-hidden="true" size={16} />}
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="grid gap-4 border-t border-border p-4">
                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      <select value={member.role} onChange={e => updateRole(member.id, e.target.value as 'admin' | 'editor' | 'viewer')} aria-label="Cargo do membro" className={cn(selectNativo, 'w-auto')}>
                        <option value="admin">Administrador</option>
                        <option value="editor">Editor</option>
                        <option value="viewer">Visualizador</option>
                      </select>
                      {member.status !== 'blocked' ? (
                        <Button variant="outline" size="sm" className="text-destructive" onClick={() => updateStatus(member.id, 'blocked')}><I.Proibido aria-hidden="true" /> Bloquear</Button>
                      ) : (
                        <Button variant="outline" size="sm" className="text-[var(--ev-success)]" onClick={() => updateStatus(member.id, 'active')}><I.Check aria-hidden="true" /> Ativar</Button>
                      )}
                      <Button variant="ghost" size="sm" className="ml-auto text-destructive hover:bg-foreground/5 hover:text-destructive" onClick={() => removeMember(member.id)}><I.Lixeira aria-hidden="true" /> Remover</Button>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-1 gap-3">
                      <div className="rounded-[10px] bg-secondary p-3 text-center">
                        <div className="text-sm font-semibold text-foreground">{member.joinedAt}</div>
                        <div className="text-xs text-muted-foreground">Entrou em</div>
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
