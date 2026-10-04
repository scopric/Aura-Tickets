import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import gsap from 'gsap'
import * as I from '@/components/icones/evokaa16'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState, PageHeader, chipAviso, chipInfo, chipNeutro, chipOk } from '@/components/producer/ui'
import { alertaAviso, alertaErro, painel } from '@/components/admin/ui'
import { cn } from '@/lib/utils'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { chamarConvite, mensagemDe } from '../../lib/convite'

interface AdminProfile {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
  role: 'user' | 'producer' | 'admin'
  admin_permissions: string[]
  updated_at: string | null
}

const PERMISSIONS = [
  { id: 'super_admin', label: 'Acesso total 👑', desc: 'Acesso total e irrestrito a todas as funcionalidades e configurações da plataforma.' },
  { id: 'manage_users', label: 'Gerenciar Usuários & Produtores', desc: 'Permite visualizar, suspender e gerenciar contas de clientes e produtores.' },
  { id: 'manage_affiliates', label: 'Afiliados Evokaa', desc: 'Cadastrar afiliados que revendem a plataforma, acordos de comissão e produtores indicados.' },
  { id: 'manage_events', label: 'Moderação de Eventos', desc: 'Permite aprovar ou rejeitar novos eventos criados por produtores.' },
  { id: 'manage_finance', label: 'Visualizar Financeiro', desc: 'Acesso a relatórios de vendas, faturamento geral e repasses.' },
  { id: 'view_analytics', label: 'Visualizar Analytics', desc: 'Acesso a gráficos de tráfego, vendas gerais e dados analíticos.' },
  { id: 'manage_tickets', label: 'Suporte de Ingressos', desc: 'Permite consultar pedidos, realizar estornos e emitir cortesias.' },
  { id: 'manage_settings', label: 'Configurações do Sistema', desc: 'Acesso às taxas de serviço da plataforma, regras de negócio e integrações.' },
  { id: 'manage_feedback', label: 'Moderar Feedbacks', desc: 'Visualização e moderação das mensagens de contato e melhorias.' },
  { id: 'manage_support', label: 'Atendimento (chat)', desc: 'Responder as conversas do chat, fazer notas internas, atribuir, mudar setor e resolver.' },
  { id: 'manage_newsletter', label: 'Campanhas de Newsletter', desc: 'Criar, editar e disparar informativos para a base de e-mails.' },
  { id: 'manage_coupons', label: 'Cupons de Desconto', desc: 'Criar, editar e desativar cupons dos planos vendidos aos produtores.' },
  { id: 'moderate_mesa', label: 'Moderar Match de Mesa', desc: 'Aprova fotos de perfil, faz a triagem de denúncias e revisa remoções. Exige 2FA.' },
  { id: 'manage_team', label: 'Ver a Equipe Evokaa', desc: 'Permite ver os colaboradores da Evokaa. Convidar, remover e alterar funções é só de quem tem Acesso total.' },
]
// No convite, nunca super_admin (só pela edição de permissões); o banco e a Edge Function admin-invite conferem de novo
const PERMISSOES_CONVITE = PERMISSIONS.filter(p => p.id !== 'super_admin')

interface Convite {
  id: string
  email: string
  cargo: string
  permissions: string[]
  status: 'pendente' | 'expirado' | 'usado' | 'cancelado'
  expires_at: string
  used_at: string | null
  nome: string | null
  aviso_em: string | null // null num aceite = o e-mail aos super_admins não saiu
}

// Cadastro do colaborador (staff_profiles, docs/sql/20261002_convite_colaborador.sql): só o super_admin lê
type Ficha = Record<string, string | null>
const PIX_LABEL: Record<string, string> = { cpf: 'CPF', email: 'E-mail', telefone: 'Celular', aleatoria: 'Chave aleatória' }
const dataBr = (iso: string | null) => (iso ? new Date(iso.length === 10 ? iso + 'T00:00:00' : iso).toLocaleDateString('pt-BR') : '—')
const linhasFicha = (f: Ficha): [string, string][] => [
  ['Nome completo', f.nome_completo ?? '—'],
  ['Cargo', f.cargo ?? '—'],
  ['CPF', (f.cpf ?? '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') || '—'],
  ['RG', f.rg ?? '—'],
  ['Nascimento', dataBr(f.data_nascimento)],
  ['Endereço', [f.rua, f.numero, f.complemento, f.bairro, f.cidade && `${f.cidade}/${f.uf}`, f.cep].filter(Boolean).join(', ')],
  ['E-mail secundário', f.email_secundario ?? '—'],
  ['Telefone', f.telefone ?? '—'],
  ['WhatsApp', f.whatsapp ?? '—'],
  ['Emergência', `${f.emergencia_nome ?? '—'} (${f.emergencia_parentesco ?? '—'}), ${f.emergencia_telefone ?? '—'}`],
  ['Pix', `${PIX_LABEL[f.pix_tipo ?? ''] ?? f.pix_tipo}: ${f.pix_chave ?? '—'}`],
  ['Banco', [f.banco, f.agencia && `ag. ${f.agencia}`, f.conta && `conta ${f.conta}`].filter(Boolean).join(', ') || '—'],
]

export default function AdminTeamManager() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { user } = useAuth()
  // Só o super_admin promove, rebaixa e altera permissões (o banco garante: docs/sql/20260930_permissoes_admin.sql)
  const canEdit = !!user?.admin_permissions?.includes('super_admin')
  
  // States
  const [admins, setAdmins] = useState<AdminProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  
  // Convite de colaborador (Edge Function admin-invite)
  const [conviteEmail, setConviteEmail] = useState('')
  const [conviteCargo, setConviteCargo] = useState('')
  const [convitePerms, setConvitePerms] = useState<string[]>([])
  const [enviandoConvite, setEnviandoConvite] = useState(false)
  const [convites, setConvites] = useState<Convite[]>([])
  const [convitesErro, setConvitesErro] = useState('')
  const [conviteEmAndamento, setConviteEmAndamento] = useState<string | null>(null)
  // Nome, cargo e e-mail de quem entrou por convite (qualquer admin); cadastro completo só para o super_admin
  const [cargos, setCargos] = useState<Record<string, string>>({})
  const [ficha, setFicha] = useState<{ id: string; dados: Ficha | null } | null>(null)
  
  // Permission management
  const [selectedAdmin, setSelectedAdmin] = useState<AdminProfile | null>(null)
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])
  const [isSavingPermissions, setIsSavingPermissions] = useState(false)

  // Fetch Admins list
  const fetchAdmins = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'admin')
        .order('full_name', { ascending: true })

      if (error) throw error
      setAdmins(data || [])
      setLoadError('')
    } catch (err: any) {
      console.error('Erro ao buscar equipe admin:', err)
      setAdmins([])
      setLoadError(err.message || 'Erro ao buscar a equipe')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchConvites = () =>
    chamarConvite<{ convites: Convite[] }>({ acao: 'listar' }).then(
      r => { setConvites(r.convites); setConvitesErro('') },
      err => setConvitesErro(mensagemDe(err)),
    )

  useEffect(() => {
    fetchAdmins()
    supabase.rpc('colaboradores_resumo' as never).then(({ data }) => {
      const linhas = (data ?? []) as { user_id: string; cargo: string }[]
      setCargos(Object.fromEntries(linhas.map(l => [l.user_id, l.cargo])))
    })
  }, [])

  useEffect(() => {
    if (canEdit) fetchConvites()
  }, [canEdit])

  // Ficha do colaborador selecionado (só o super_admin; o banco confere com colaborador_dados)
  useEffect(() => {
    if (!canEdit || !selectedAdmin) return
    let cancelado = false
    const id = selectedAdmin.id
    supabase.rpc('colaborador_dados' as never, { p_user: id } as never).then(({ data, error }) => {
      if (cancelado) return
      if (error) console.error('[Equipe] cadastro do colaborador:', error.message)
      setFicha({ id, dados: ((data ?? []) as Ficha[])[0] ?? null })
    })
    return () => { cancelado = true }
  }, [canEdit, selectedAdmin])
  const fichaAtual = selectedAdmin && ficha?.id === selectedAdmin.id ? ficha.dados : 'carregando'

  // Animar entrada
  useEffect(() => {
    if (!isLoading) {
      const ctx = gsap.context(() => {
        gsap.fromTo('.anim-team', 
          { opacity: 0, y: 15 }, 
          { opacity: 1, y: 0, duration: 0.4, stagger: 0.05, ease: 'power2.out' }
        )
      }, containerRef)
      return () => ctx.revert()
    }
  }, [isLoading])

  const handleConvidar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(conviteEmail.trim())) { toast.error('Informe um e-mail válido.'); return }
    if (conviteCargo.trim().length < 2) { toast.error('Informe o cargo.'); return }
    setEnviandoConvite(true)
    try {
      await chamarConvite({ acao: 'criar', email: conviteEmail.trim(), cargo: conviteCargo.trim(), permissoes: convitePerms })
      toast.success('Convite enviado. O link vale por 7 dias.')
      setConviteEmail('')
      setConviteCargo('')
      setConvitePerms([])
    } catch (err) {
      toast.error(mensagemDe(err))
    } finally {
      setEnviandoConvite(false)
      fetchConvites()
    }
  }

  const handleConviteAcao = async (c: Convite, acao: 'reenviar' | 'cancelar') => {
    if (acao === 'cancelar' && !window.confirm(`Cancelar o convite de ${c.email}? O link enviado deixa de valer.`)) return
    setConviteEmAndamento(c.id)
    try {
      await chamarConvite({ acao, id: c.id })
      toast.success(acao === 'reenviar' ? 'Convite reenviado com um link novo. O anterior deixou de valer.' : 'Convite cancelado.')
    } catch (err) {
      toast.error(mensagemDe(err))
    } finally {
      setConviteEmAndamento(null)
      fetchConvites()
    }
  }

  // Open Permission Editor
  const handleEditPermissions = (admin: AdminProfile) => {
    if (!canEdit || admin.id === user?.id) return // ninguém altera as próprias permissões
    setSelectedAdmin(admin)
    setSelectedPermissions(admin.admin_permissions || [])
  }

  // Toggle single permission selection
  const handleTogglePermission = (permId: string) => {
    if (selectedPermissions.includes(permId)) {
      setSelectedPermissions(selectedPermissions.filter(p => p !== permId))
    } else {
      setSelectedPermissions([...selectedPermissions, permId])
    }
  }

  // Save admin permissions
  // Último admin com super_admin não pode perder o acesso total, senão ninguém mais administra a equipe
  const isLastSuperAdmin = (adminId: string) => {
    const supers = admins.filter(a => a.admin_permissions?.includes('super_admin'))
    return supers.length === 1 && supers[0].id === adminId
  }

  const handleSavePermissions = async () => {
    if (!selectedAdmin) return
    const losesSuper = selectedAdmin.admin_permissions?.includes('super_admin') && !selectedPermissions.includes('super_admin')
    if (losesSuper && selectedAdmin.id === user?.id) {
      toast.error('Você não pode rebaixar a si mesmo.')
      return
    }
    if (losesSuper && isLastSuperAdmin(selectedAdmin.id)) {
      toast.error('Esta é a última conta com Acesso total: dê Acesso total a outro colaborador antes de tirar o desta.')
      return
    }
    setIsSavingPermissions(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          admin_permissions: selectedPermissions
        })
        .eq('id', selectedAdmin.id)
        .select('id')

      if (error) throw error
      if (!data?.length) throw new Error('sem permissão para alterar este perfil')

      toast.success('Permissões da equipe atualizadas com sucesso!')
      
      // Update local state
      setAdmins(admins.map(a => a.id === selectedAdmin.id ? { 
        ...a, 
        admin_permissions: selectedPermissions 
      } : a))
      
      setSelectedAdmin(null)
    } catch (err: any) {
      console.error(err)
      toast.error('Erro ao salvar permissões: ' + (err.message || 'falha desconhecida'))
    } finally {
      setIsSavingPermissions(false)
    }
  }

  // Remove Admin (Demote to User)
  const handleRemoveAdmin = async (adminId: string, name: string) => {
    if (adminId === user?.id) {
      toast.error('Você não pode remover a si mesmo da equipe.')
      return
    }
    if (isLastSuperAdmin(adminId)) {
      toast.error('Esta é a última conta com Acesso total: dê Acesso total a outro colaborador antes de removê-la.')
      return
    }
    const confirm = window.confirm(`Remover ${name} dos colaboradores da Evokaa? A conta volta a ser de participante comum.`)
    if (!confirm) return

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          role: 'user',
          admin_permissions: []
        })
        .eq('id', adminId)
        .select('id')

      if (error) throw error
      if (!data?.length) throw new Error('sem permissão para alterar este perfil')

      toast.success(`${name} rebaixado para Participante com sucesso.`)
      setAdmins(admins.filter(a => a.id !== adminId))
      if (selectedAdmin?.id === adminId) setSelectedAdmin(null)
    } catch (err: any) {
      console.error(err)
      toast.error('Erro ao remover: ' + (err.message || 'falha desconhecida'))
    }
  }

  return (
    <div ref={containerRef} className="p-6 lg:p-10 max-w-7xl">
      <PageHeader title="Equipe Evokaa" description="Convide colaboradores e ajuste as áreas do painel que cada um acessa." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Admins List (Left/Center Col) */}
        <div className="lg:col-span-2 space-y-6">
          <section className={cn('anim-team', painel, 'p-4 sm:p-6')}>
            <h2 className="mb-4 flex items-center gap-2 text-[15px] font-semibold leading-5 tracking-normal text-foreground">
              <I.Escudo size={16} className="text-primary" aria-hidden="true" /> Colaboradores da Evokaa
            </h2>

            {loadError && (
              <div role="alert" className={cn(alertaErro, 'mb-4')}>
                Não foi possível carregar a equipe: {loadError}
              </div>
            )}
            {isLoading ? (
              <div className="flex justify-center py-20">
                <Spinner className="size-8 text-primary" />
              </div>
            ) : admins.length === 0 ? (
              <EmptyState title="Nenhum colaborador cadastrado." />
            ) : (
              <div className="space-y-3">
                {admins.map(admin => {
                  const isSuper = admin.admin_permissions?.includes('super_admin')
                  const permsCount = admin.admin_permissions?.length || 0

                  return (
                    <button
                      type="button"
                      key={admin.id}
                      onClick={() => handleEditPermissions(admin)}
                      aria-pressed={selectedAdmin?.id === admin.id}
                      className={cn(
                        'flex w-full items-center justify-between gap-4 rounded-[10px] border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        canEdit && admin.id !== user?.id ? 'cursor-pointer' : 'cursor-default',
                        selectedAdmin?.id === admin.id
                          ? 'border-primary bg-[var(--ev-brand-soft)]'
                          : 'border-border bg-card hover:bg-secondary',
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-foreground">
                          {admin.avatar_url ? (
                            <img src={admin.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            admin.full_name?.charAt(0).toUpperCase() || <I.Conta size={16} aria-hidden="true" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                            <span className="truncate">{admin.full_name || 'Colaborador Evokaa'}</span>
                            {isSuper && (
                              <I.Coroa size={14} className="shrink-0 text-[var(--ev-warning)]" aria-label="Acesso total" />
                            )}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            {cargos[admin.id] && <span className="font-medium text-foreground">{cargos[admin.id]} ·</span>}
                            <span>
                              {isSuper
                                ? 'Acesso Total'
                                : permsCount === 0
                                ? 'Sem permissões ativas'
                                : `${permsCount} permissões atribuídas`}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        {/* Perm chips preview */}
                        <div className="hidden md:flex flex-wrap gap-1 max-w-[250px] justify-end">
                          {isSuper ? (
                            <Badge variant="secondary" className={chipAviso}>Acesso total</Badge>
                          ) : (
                            admin.admin_permissions?.slice(0, 3).map(p => (
                              <Badge key={p} variant="secondary" className={chipNeutro}>
                                {p.replace('manage_', '').replace('view_', '')}
                              </Badge>
                            ))
                          )}
                          {!isSuper && permsCount > 3 && (
                            <Badge variant="secondary" className={chipInfo}>
                              +{permsCount - 3}
                            </Badge>
                          )}
                        </div>
                        <I.ChevronDireita size={16} className={cn('text-muted-foreground transition-transform', selectedAdmin?.id === admin.id && 'translate-x-1 text-primary')} aria-hidden="true" />
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          {canEdit && (
            <section className={cn('anim-team', painel, 'p-4 sm:p-6')}>
              <h2 className="mb-4 flex items-center gap-2 text-[15px] font-semibold leading-5 tracking-normal text-foreground">
                <I.Email size={16} className="text-primary" aria-hidden="true" /> Convites
              </h2>
              {convitesErro && (
                <div role="alert" className={cn(alertaErro, 'mb-4 p-3 text-xs')}>
                  Não foi possível carregar os convites: {convitesErro}
                </div>
              )}
              {convites.filter(c => c.status === 'pendente' || c.status === 'expirado').length === 0 ? (
                !convitesErro && <p className="text-xs text-muted-foreground italic">Nenhum convite pendente.</p>
              ) : (
                <ul className="space-y-3">
                  {convites.filter(c => c.status === 'pendente' || c.status === 'expirado').map(c => (
                    <li key={c.id} className="flex flex-col justify-between gap-3 rounded-[10px] border border-border bg-card p-4 sm:flex-row sm:items-center">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground">{c.email}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {c.cargo} · {c.status === 'expirado'
                            ? <span className="font-semibold text-[var(--ev-warning)]">expirado</span>
                            : <>vale até {dataBr(c.expires_at)}</>}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => handleConviteAcao(c, 'reenviar')}
                          disabled={conviteEmAndamento === c.id}
                        >
                          <I.Atualizar aria-hidden="true" /> Reenviar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleConviteAcao(c, 'cancelar')}
                          disabled={conviteEmAndamento === c.id}
                          className="text-destructive hover:text-destructive"
                        >
                          <I.Fechar aria-hidden="true" /> Cancelar
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {convites.some(c => c.status === 'usado') && (
                <>
                  <h3 className="mb-3 mt-8 text-[15px] font-semibold leading-5 text-foreground">Aceitos recentemente</h3>
                  <ul className="space-y-2">
                    {convites.filter(c => c.status === 'usado').map(c => (
                      <li key={c.id} className="flex flex-col justify-between gap-2 rounded-[10px] border border-border bg-card p-3 sm:flex-row sm:items-center">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-foreground">{c.nome || c.email}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">{c.email} · {c.cargo} · aceito em {dataBr(c.used_at)}</div>
                        </div>
                        {c.aviso_em
                          ? <Badge variant="secondary" className={chipOk}>aviso enviado</Badge>
                          : <Badge variant="secondary" className={chipAviso}>sem aviso por e-mail</Badge>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}
        </div>

        {/* Action Panel (Right Col) */}
        <div className="space-y-6">
          {/* Edit Permissions Sidebar/Box */}
          {selectedAdmin ? (
            <section className={cn('anim-team', painel, 'relative p-4 sm:p-6')}>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setSelectedAdmin(null)}
                className="absolute right-3 top-3"
                aria-label="Fechar"
                title="Fechar"
              >
                <I.Fechar aria-hidden="true" />
              </Button>

              <div className="mb-6 pr-8">
                <div className="text-[11px] font-medium uppercase tracking-wide text-primary">Ajustar Acesso</div>
                <h3 className="mt-0.5 text-[15px] font-semibold leading-snug text-foreground">{selectedAdmin.full_name || 'Colaborador(a)'}</h3>
                <p className="mt-1 text-xs text-muted-foreground">Selecione quais áreas do painel este colaborador(a) pode acessar.</p>
              </div>

              {/* Cadastro do colaborador (só o super_admin chega a este painel) */}
              <div className="mb-6 rounded-[10px] border border-border bg-secondary p-4">
                <div className="mb-2 text-xs font-semibold text-foreground">Dados do cadastro</div>
                {fichaAtual === 'carregando' ? (
                  <Spinner className="text-primary" />
                ) : !fichaAtual ? (
                  <p className="text-xs text-muted-foreground">Sem cadastro de colaborador (conta que entrou na equipe antes do convite).</p>
                ) : (
                  <dl className="space-y-1.5 text-xs">
                    {linhasFicha(fichaAtual).map(([rotulo, valor]) => (
                      <div key={rotulo} className="grid grid-cols-[7.5rem_1fr] gap-2">
                        <dt className="text-muted-foreground">{rotulo}</dt>
                        <dd className="text-foreground [overflow-wrap:anywhere]">{valor}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>

              {/* Permissions list */}
              <div className="mb-6 max-h-[360px] space-y-2 overflow-y-auto border-b border-border pb-4 pr-1">
                {PERMISSIONS.map(perm => {
                  const isChecked = selectedPermissions.includes(perm.id)
                  return (
                    <label
                      key={perm.id}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-lg border p-2.5 transition-colors',
                        isChecked ? 'border-primary/30 bg-[var(--ev-brand-soft)]' : 'border-transparent hover:bg-secondary',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleTogglePermission(perm.id)}
                        className="mt-1 size-4 accent-primary"
                      />
                      <div>
                        <div className="text-xs font-semibold text-foreground">{perm.label}</div>
                        <div className="mt-0.5 text-xs leading-snug text-muted-foreground">{perm.desc}</div>
                      </div>
                    </label>
                  )
                })}
              </div>

              <div className="space-y-2">
                <Button
                  type="button"
                  onClick={handleSavePermissions}
                  loading={isSavingPermissions}
                  className="w-full"
                >
                  <I.Guardar aria-hidden="true" /> Salvar Permissões
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleRemoveAdmin(selectedAdmin.id, selectedAdmin.full_name || 'Colaborador(a)')}
                  className="w-full text-destructive hover:text-destructive"
                >
                  <I.Lixeira aria-hidden="true" /> Remover da Equipe
                </Button>
              </div>
            </section>
          ) : !canEdit ? (
            <div className={cn('anim-team', painel, 'p-4 text-xs leading-relaxed text-muted-foreground sm:p-6')}>
              Só quem tem Acesso total convida colaboradores, remove da Equipe Evokaa e altera funções.
            </div>
          ) : (
            /* Convidar colaborador */
            <section className={cn('anim-team', painel, 'p-4 sm:p-6')}>
              <h2 className="mb-1.5 flex items-center gap-2 text-[15px] font-semibold leading-5 tracking-normal text-foreground">
                <I.PessoaMais size={16} className="text-primary" aria-hidden="true" /> Convidar colaborador
              </h2>
              <p className="mb-5 text-xs leading-normal text-muted-foreground">
                A pessoa recebe um link por e-mail (vale 7 dias), cria a senha ou entra com a conta que já tem, ativa a verificação em duas etapas e preenche o cadastro. O acesso libera assim que ela termina, com as funções marcadas aqui; você recebe um e-mail quando isso acontecer.
              </p>

              <form onSubmit={handleConvidar} className="space-y-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="convite-email-input">E-mail</Label>
                  <Input
                    id="convite-email-input"
                    type="email"
                    value={conviteEmail}
                    onChange={e => setConviteEmail(e.target.value)}
                    placeholder="pessoa@email.com"
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="convite-cargo-input">Cargo</Label>
                  <Input
                    id="convite-cargo-input"
                    value={conviteCargo}
                    maxLength={80}
                    onChange={e => setConviteCargo(e.target.value)}
                    placeholder="Atendimento, Financeiro…"
                    required
                  />
                </div>
                <fieldset>
                  <legend className="mb-1 text-sm font-medium text-foreground">Funções</legend>
                  <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
                    {PERMISSOES_CONVITE.map(perm => {
                      const marcada = convitePerms.includes(perm.id)
                      return (
                        <label
                          key={perm.id}
                          className={cn(
                            'flex cursor-pointer items-start gap-3 rounded-lg border p-2.5 transition-colors',
                            marcada ? 'border-primary/30 bg-[var(--ev-brand-soft)]' : 'border-transparent hover:bg-secondary',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={marcada}
                            onChange={() => setConvitePerms(marcada ? convitePerms.filter(p => p !== perm.id) : [...convitePerms, perm.id])}
                            className="mt-1 size-4 accent-primary"
                          />
                          <div>
                            <div className="text-xs font-semibold text-foreground">{perm.label}</div>
                            <div className="mt-0.5 text-xs leading-snug text-muted-foreground">{perm.desc}</div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </fieldset>
                <Button type="submit" loading={enviandoConvite} className="w-full">
                  <I.Enviar aria-hidden="true" /> Enviar convite
                </Button>
              </form>

              {/* Security Advisory */}
              <div className={cn(alertaAviso, 'mt-8 gap-2.5')}>
                <I.EscudoAlerta size={16} className="text-[var(--ev-warning)]" aria-hidden="true" />
                <div>
                  <div className="font-semibold">Aviso de Segurança</div>
                  <p className="mt-0.5 leading-normal text-muted-foreground">
                    Cada função dá acesso a dados de clientes, produtores e pagamentos. Dê a cada colaborador(a) só as funções de que ele(a) precisa.
                  </p>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
