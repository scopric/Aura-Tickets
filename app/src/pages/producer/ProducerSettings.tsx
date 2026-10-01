import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { passwordError, PASSWORD_HINT } from '../../lib/password'
import {
  User, Lock, CreditCard, Bell, Users, Save,
  Eye, EyeOff, Instagram, Globe,
  Shield, Smartphone, AlertTriangle, Loader2
} from 'lucide-react'
import { useProducerSettings } from '../../hooks/useProducerSettings'
import { useTwoFactor } from '../../hooks/useTwoFactor'
import { supabase } from '../../lib/supabase'
import { uploadAvatar } from '../../lib/avatarUpload'
import PhoneInput from '../../components/ui/PhoneInput'
import { formatCNPJ } from '../../lib/formatters'
import { PageHeader } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type Section = 'perfil' | 'conta' | 'pagamento' | 'notificacoes' | 'equipe'

const select = 'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30'

export default function ProducerSettings() {
  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
    saveProfile,
    isSavingProfile,
    saveProducerProfile,
    isSavingProducerProfile,
  } = useProducerSettings()

  const [section, setSection] = useState<Section>('perfil')
  // Confirmação da exclusão num modal da página: window.confirm pode ser bloqueado pelo
  // navegador e devolver false sem mostrar nada (foi o que aconteceu no teste de 27/09).
  const [showDelete, setShowDelete] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')

  const avatarInputRef = useRef<HTMLInputElement>(null)
  
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && data?.profile?.id) {
      const newAvatarUrl = await uploadAvatar(file, data.profile.id)
      if (newAvatarUrl) {
        setProfile(prev => ({ ...prev, avatar: newAvatarUrl }))
      }
    }
  }

  const triggerAvatarUpload = () => {
    avatarInputRef.current?.click()
  }

  // Estados locais editáveis
  const [profile, setProfile] = useState({
    name: '', email: '', phone: '', bio: '', company: '', cnpj: '',
    website: '', instagram: '', tiktok: '', linkedin: '', avatar: ''
  })

  const [password, setPassword] = useState({ current: '', new: '', confirm: '' })
  const [showPw, setShowPw] = useState<Record<string, boolean>>({})
  
  const mfa = useTwoFactor()

  const [payment, setPayment] = useState({
    bankName: 'Itau', accountType: 'corrente', agency: '', account: '', holder: '', pixKey: ''
  })

  const [notifications, setNotifications] = useState({
    newSale: true, newMessage: true, eventReminder: true, payoutComplete: true,
    marketingEmails: false, pushEnabled: true, smsEnabled: false,
  })

  // Sincronizar estado local com dados do Supabase
  useEffect(() => {
    if (data) {
      setProfile({
        name: data.profile.full_name || '',
        email: data.profile.email || '',
        phone: data.profile.phone || '',
        bio: data.profile.bio || '',
        company: data.producer_profile?.company_name || '',
        cnpj: data.producer_profile?.cnpj ? formatCNPJ(data.producer_profile.cnpj) : '',
        website: data.profile.website || '',
        instagram: data.profile.instagram || '',
        tiktok: data.profile.tiktok || '',
        linkedin: data.profile.linkedin || '',
        avatar: data.profile.avatar_url || '', // sem foto: iniciais (nada de avatar de terceiros)
      })
      const ba = data.producer_profile?.bank_account || {}
      setPayment({
        bankName: ba.bankName || 'Itau',
        accountType: ba.accountType || 'corrente',
        agency: ba.agency || '',
        account: ba.account || '',
        holder: ba.holder || '',
        pixKey: data.producer_profile?.pix_key || '',
      })
      const ns = data.producer_profile?.notification_settings || {}
      setNotifications({
        newSale: ns.newSale ?? true,
        newMessage: ns.newMessage ?? true,
        eventReminder: ns.eventReminder ?? true,
        payoutComplete: ns.payoutComplete ?? true,
        marketingEmails: ns.marketingEmails ?? false,
        pushEnabled: ns.pushEnabled ?? true,
        smsEnabled: ns.smsEnabled ?? false,
      })
    }
  }, [data])

  const isSaving = isSavingProfile || isSavingProducerProfile

  const handleSaveProfile = async () => {
    try {
      await saveProfile({
        full_name: profile.name,
        phone: profile.phone,
        bio: profile.bio,
        website: profile.website,
        instagram: profile.instagram,
        tiktok: profile.tiktok,
        linkedin: profile.linkedin,
      })
      toast.success('Perfil salvo com sucesso!')
    } catch {
      toast.error('Erro ao salvar perfil')
    }
  }

  const handleSaveCompany = async () => {
    try {
      await saveProducerProfile({
        company_name: profile.company,
        cnpj: profile.cnpj.replace(/\D/g, '') || null, // vazio é null: a UNIQUE não aceita dois ''
      })
      toast.success('Dados da empresa atualizados com sucesso!')
    } catch {
      toast.error('Erro ao salvar dados da empresa')
    }
  }

  const handleSavePayment = async () => {
    try {
      await saveProducerProfile({
        bank_account: {
          bankName: payment.bankName,
          accountType: payment.accountType,
          agency: payment.agency,
          account: payment.account,
          holder: payment.holder,
        },
        pix_key: payment.pixKey,
      })
      toast.success('Dados bancários salvos!')
    } catch {
      toast.error('Erro ao salvar dados bancários')
    }
  }

  const handleSaveNotifications = async () => {
    try {
      await saveProducerProfile({
        notification_settings: notifications,
      })
      toast.success('Preferências de notificação salvas!')
    } catch {
      toast.error('Erro ao salvar notificações')
    }
  }

  const handlePassword = async () => {
    if (!password.current || !password.new || !password.confirm) {
      toast.error('Preencha todos os campos')
      return
    }
    if (password.new !== password.confirm) {
      toast.error('Senhas não conferem')
      return
    }
    const pw = passwordError(password.new)
    if (pw) {
      toast.error(pw)
      return
    }
    try {
      // O servidor confere a senha atual sem novo login nas primeiras 24 h da sessão; depois pede
      // reautenticação (um signInWithPassword trocaria a sessão aal2 por aal1 e o banco bloquearia tudo).
      // Só vale com "update_password_require_current_password" ligado no Supabase; desligado, o servidor ignora o campo.
      const { error } = await supabase.auth.updateUser({ password: password.new, current_password: password.current })
      if (error?.code === 'current_password_invalid') {
        toast.error('Senha atual incorreta')
        return
      }
      if (error?.code === 'reauthentication_needed') {
        toast.error('Por segurança, saia e entre de novo na sua conta para trocar a senha.')
        return
      }
      if (error?.code === 'same_password') {
        toast.error('A nova senha deve ser diferente da atual.')
        return
      }
      if (error?.code === 'weak_password') {
        toast.error(`A senha não atende às regras. ${PASSWORD_HINT}.`)
        return
      }
      if (error) throw error
      setPassword({ current: '', new: '', confirm: '' })
      toast.success('Senha alterada!')
      // O servidor já encerra as outras sessões ao trocar a senha; o token de acesso delas vale até 1 h.
    } catch (err: any) {
      toast.error(err.message || 'Erro ao alterar senha')
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'EXCLUIR') { toast.error('Digite EXCLUIR para confirmar'); return }
    // A função só precisa do JWT da sessão (o supabase-js o envia sozinho); a consulta
    // desta tela (`data`) não é necessária aqui.
    const toastId = toast.loading('Excluindo sua conta e dados do sistema...')
    try {
      // Função com chave de serviço: anonimiza perfil e cadastro de produtor (dados bancários),
      // apaga os dados só pessoais e desativa o login. Pedidos e ingressos ficam (obrigação fiscal).
      const { data: result, error } = await supabase.functions.invoke('delete-account')
      if (error) {
        // Em 4xx/5xx o invoke não devolve o JSON: lê a mensagem real da função
        const body = await (error as { context?: Response }).context?.json?.().catch(() => null)
        throw new Error(body?.error || error.message)
      }
      if (!result?.ok) throw new Error(result?.error || 'A exclusão não foi concluída')

      toast.success('Sua conta foi excluída com sucesso!', { id: toastId })
      setShowDelete(false)
      // A sessão já foi encerrada no servidor; o signOut local só limpa o navegador
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
      window.location.href = '/'
    } catch (err: any) {
      console.error('[ProducerSettings] Erro ao excluir conta:', err)
      toast.error(err.message || 'Erro ao processar exclusão da conta', { id: toastId })
    }
  }

  const sidebarItems: { id: Section; label: string; icon: typeof User }[] = [
    { id: 'perfil', label: 'Perfil', icon: User },
    { id: 'conta', label: 'Conta e segurança', icon: Lock },
    { id: 'pagamento', label: 'Pagamento', icon: CreditCard },
    { id: 'notificacoes', label: 'Notificações', icon: Bell },
    { id: 'equipe', label: 'Equipe', icon: Users },
  ]

  const header = <PageHeader title="Configurações" description="Sua conta, seus dados e suas preferências" />

  if (isLoading) {
    return (
      <div aria-busy="true">
        {header}
        <div className="flex flex-col gap-6 lg:flex-row">
          <Skeleton className="h-10 rounded-[10px] bg-muted lg:h-56 lg:w-56" />
          <Skeleton className="h-96 flex-1 rounded-[10px] bg-muted" />
        </div>
      </div>
    )
  }

  // Sem os dados, o formulário viria vazio e "Salvar" gravaria campos em branco por cima do perfil
  if (isError || !data) {
    return (
      <div>
        {header}
        <div role="alert" className="flex flex-col gap-3 rounded-[10px] border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground">Não foi possível carregar as configurações.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? 'Carregando…' : 'Tentar de novo'}
          </Button>
        </div>
      </div>
    )
  }

  const iniciais = (profile.name || profile.email || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('')

  return (
    <div>
      {header}

      <div className="flex flex-col gap-6 lg:flex-row">
        <nav aria-label="Seções das configurações" className="lg:w-56 lg:shrink-0">
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:flex-col lg:overflow-visible">
            {sidebarItems.map(item => (
              <Button
                key={item.id}
                variant={section === item.id ? 'secondary' : 'ghost'}
                aria-pressed={section === item.id}
                onClick={() => setSection(item.id)}
                className={`shrink-0 justify-start ${section === item.id ? '' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <item.icon aria-hidden="true" />{item.label}
              </Button>
            ))}
          </div>
        </nav>

        <div className="min-w-0 flex-1">
          {/* PERFIL */}
          {section === 'perfil' && (
            <section className="space-y-6 rounded-[10px] border border-border bg-card p-4 sm:p-6">
              <h2 className="text-base font-semibold text-foreground">Perfil público</h2>

              <div className="flex items-center gap-4">
                <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} aria-label="Escolher foto" />
                {profile.avatar
                  ? <img src={profile.avatar} alt="" className="size-16 rounded-full border border-border object-cover" />
                  : <div aria-hidden="true" className="flex size-16 items-center justify-center rounded-full border border-border bg-muted text-lg font-semibold text-muted-foreground">{iniciais}</div>}
                <div>
                  <Button variant="outline" size="sm" onClick={triggerAvatarUpload}>Alterar foto</Button>
                  <p className="mt-1 text-xs text-muted-foreground">JPG ou PNG, até 2 MB</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="cfg-nome">Nome</Label>
                  <Input id="cfg-nome" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cfg-email">E-mail</Label>
                  <Input id="cfg-email" value={profile.email} disabled />
                </div>
                <div className="grid gap-1.5 md:col-span-2">
                  <Label htmlFor="cfg-telefone">Telefone</Label>
                  <PhoneInput id="cfg-telefone" value={profile.phone} onChange={val => setProfile({ ...profile, phone: val })} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cfg-empresa">Empresa (razão social)</Label>
                  <Input id="cfg-empresa" value={profile.company} onChange={e => setProfile({ ...profile, company: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cfg-cnpj">CNPJ (opcional)</Label>
                  <Input id="cfg-cnpj" inputMode="numeric" value={profile.cnpj} placeholder="00.000.000/0000-00" onChange={e => setProfile({ ...profile, cnpj: formatCNPJ(e.target.value) })} />
                </div>
                <div className="grid gap-1.5 md:col-span-2">
                  <Label htmlFor="cfg-bio">Bio</Label>
                  <Textarea id="cfg-bio" value={profile.bio} onChange={e => setProfile({ ...profile, bio: e.target.value })} rows={3} className="resize-none" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="cfg-site"><Globe aria-hidden="true" className="size-3.5" />Site</Label>
                  <Input id="cfg-site" value={profile.website} onChange={e => setProfile({ ...profile, website: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cfg-instagram"><Instagram aria-hidden="true" className="size-3.5" />Instagram</Label>
                  <Input id="cfg-instagram" value={profile.instagram} onChange={e => setProfile({ ...profile, instagram: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cfg-tiktok"><Smartphone aria-hidden="true" className="size-3.5" />TikTok</Label>
                  <Input id="cfg-tiktok" value={profile.tiktok} onChange={e => setProfile({ ...profile, tiktok: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cfg-linkedin"><Globe aria-hidden="true" className="size-3.5" />LinkedIn</Label>
                  <Input id="cfg-linkedin" value={profile.linkedin} onChange={e => setProfile({ ...profile, linkedin: e.target.value })} />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={handleSaveCompany} disabled={isSaving}>
                  {isSavingProducerProfile ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}Salvar empresa
                </Button>
                <Button onClick={handleSaveProfile} disabled={isSaving}>
                  {isSavingProfile ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}Salvar perfil
                </Button>
              </div>
            </section>
          )}

          {/* CONTA */}
          {section === 'conta' && (
            <div className="space-y-6">
              <section className="rounded-[10px] border border-border bg-card p-4 sm:p-6">
                <h2 className="text-base font-semibold text-foreground">Alterar senha</h2>
                <div className="mt-4 max-w-md space-y-4">
                  {(['current', 'new', 'confirm'] as const).map((field) => {
                    const rotulo = field === 'current' ? 'Senha atual' : field === 'new' ? 'Nova senha' : 'Confirmar nova senha'
                    return (
                      <div key={field} className="grid gap-1.5">
                        <Label htmlFor={`cfg-senha-${field}`}>{rotulo}</Label>
                        <div className="relative">
                          <Input
                            id={`cfg-senha-${field}`}
                            type={showPw[field] ? 'text' : 'password'}
                            autoComplete={field === 'current' ? 'current-password' : 'new-password'}
                            value={password[field]}
                            onChange={e => setPassword({ ...password, [field]: e.target.value })}
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setShowPw({ ...showPw, [field]: !showPw[field] })}
                            aria-label={showPw[field] ? `Ocultar ${rotulo.toLowerCase()}` : `Mostrar ${rotulo.toLowerCase()}`}
                            className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showPw[field] ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                          </Button>
                        </div>
                        {field === 'new' && <p className="text-xs text-muted-foreground">{PASSWORD_HINT}</p>}
                      </div>
                    )
                  })}
                  <Button onClick={handlePassword}>Atualizar senha</Button>
                </div>
              </section>

              <section className="rounded-[10px] border border-border bg-card p-4 sm:p-6">
                <h2 className="flex items-center gap-2 text-base font-semibold text-foreground"><Shield aria-hidden="true" className="size-4 text-muted-foreground" />Verificação em duas etapas</h2>
                <div className="mt-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">Autenticação 2FA (app autenticador)</p>
                    <p className="text-xs text-muted-foreground">
                      {mfa.loading ? 'Carregando…' : mfa.enabled ? 'Ativa: o login pede o código do aplicativo' : 'Inativa: proteja sua conta com um código de segurança'}
                    </p>
                  </div>
                  <button
                    disabled={mfa.loading}
                    aria-label={mfa.enabled ? 'Desativar 2FA' : 'Ativar 2FA'}
                    aria-pressed={mfa.enabled}
                    onClick={mfa.toggle}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 ${mfa.enabled ? 'bg-primary' : 'bg-muted'}`}
                  >
                    <span aria-hidden="true" className={`absolute top-0.5 size-5 rounded-full bg-background shadow-sm transition-transform motion-reduce:transition-none ${mfa.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </section>

              <section className="rounded-[10px] border border-destructive/40 bg-card p-4 sm:p-6">
                <h2 className="flex items-center gap-2 text-base font-semibold text-destructive"><AlertTriangle aria-hidden="true" className="size-4" />Zona de perigo</h2>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-foreground">Excluir conta</p>
                    <p className="text-xs text-muted-foreground">Esta ação não pode ser desfeita.</p>
                  </div>
                  <Button variant="destructive" onClick={() => { setDeleteConfirm(''); setShowDelete(true) }}>Excluir conta</Button>
                </div>
              </section>
            </div>
          )}

          {/* PAGAMENTO */}
          {section === 'pagamento' && (
            <section className="space-y-6 rounded-[10px] border border-border bg-card p-4 sm:p-6">
              <div>
                <h2 className="text-base font-semibold text-foreground">Dados bancários</h2>
                <p className="mt-1 text-sm text-muted-foreground">Ficam guardados para o repasse, que começa quando o pagamento estiver ligado.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="cfg-banco">Banco</Label>
                  <select id="cfg-banco" value={payment.bankName} onChange={e => setPayment({ ...payment, bankName: e.target.value })} className={select}>
                    <option value="Itau">Itaú</option><option>Bradesco</option><option>Nubank</option><option>Santander</option><option>Inter</option>
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cfg-tipo-conta">Tipo de conta</Label>
                  <select id="cfg-tipo-conta" value={payment.accountType} onChange={e => setPayment({ ...payment, accountType: e.target.value })} className={select}>
                    <option value="corrente">Conta corrente</option><option value="poupanca">Poupança</option>
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cfg-agencia">Agência</Label>
                  <Input id="cfg-agencia" inputMode="numeric" value={payment.agency} onChange={e => setPayment({ ...payment, agency: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cfg-conta">Conta</Label>
                  <Input id="cfg-conta" inputMode="numeric" value={payment.account} onChange={e => setPayment({ ...payment, account: e.target.value })} />
                </div>
                <div className="grid gap-1.5 md:col-span-2">
                  <Label htmlFor="cfg-titular">Titular</Label>
                  <Input id="cfg-titular" value={payment.holder} onChange={e => setPayment({ ...payment, holder: e.target.value })} />
                </div>
                <div className="grid gap-1.5 md:col-span-2">
                  <Label htmlFor="cfg-pix">Chave Pix</Label>
                  <Input id="cfg-pix" value={payment.pixKey} onChange={e => setPayment({ ...payment, pixKey: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSavePayment} disabled={isSavingProducerProfile}>
                  {isSavingProducerProfile ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}Salvar
                </Button>
              </div>
            </section>
          )}

          {/* NOTIFICAÇÕES */}
          {section === 'notificacoes' && (
            <section className="space-y-6 rounded-[10px] border border-border bg-card p-4 sm:p-6">
              <h2 className="text-base font-semibold text-foreground">Notificações</h2>

              <ul className="divide-y divide-border">
                {[
                  { key: 'newSale', label: 'Nova venda', desc: 'Aviso quando um ingresso for vendido' },
                  { key: 'newMessage', label: 'Nova mensagem', desc: 'Aviso de mensagens no chat' },
                  { key: 'eventReminder', label: 'Lembretes de evento', desc: 'Alertas 7, 3 e 1 dia antes do evento' },
                  { key: 'payoutComplete', label: 'Saque concluído', desc: 'Confirmação quando o dinheiro cair na conta' },
                  { key: 'marketingEmails', label: 'E-mails de marketing', desc: 'Novidades, dicas e promoções da Evokaa' },
                  { key: 'pushEnabled', label: 'Push no navegador', desc: 'Canal de envio' },
                  { key: 'smsEnabled', label: 'SMS', desc: 'Canal de envio' },
                ].map(item => (
                  <li key={item.key} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <Label htmlFor={`cfg-not-${item.key}`} className="text-sm text-foreground">{item.label}</Label>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch
                      id={`cfg-not-${item.key}`}
                      checked={notifications[item.key as keyof typeof notifications]}
                      onCheckedChange={v => setNotifications({ ...notifications, [item.key]: v })}
                    />
                  </li>
                ))}
              </ul>

              <div className="flex justify-end">
                <Button onClick={handleSaveNotifications} disabled={isSavingProducerProfile}>
                  {isSavingProducerProfile ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}Salvar
                </Button>
              </div>
            </section>
          )}

          {/* EQUIPE: a gestão fica na tela Equipe (o módulo M3 refaz); aqui só o atalho */}
          {section === 'equipe' && (
            <section className="rounded-[10px] border border-border bg-card p-4 sm:p-6">
              <h2 className="text-base font-semibold text-foreground">Equipe</h2>
              <p className="mt-1 text-sm text-muted-foreground">Convites e funções da sua equipe ficam na tela Equipe.</p>
              <Button asChild className="mt-4">
                <Link to="/producer/team">Gerenciar equipe</Link>
              </Button>
            </section>
          )}

          {/* Aba "Integrações" (API Key, Webhook, Widget) retirada: não existe API, webhook nem widget para
              produtores (Decisão 37). Volta quando houver, com chave gerada no servidor. */}
        </div>
      </div>

      {mfa.modal}

      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir conta</DialogTitle>
            <DialogDescription>
              Esta ação é irreversível. Seu perfil, dados bancários e chaves serão removidos e o login desativado. Pedidos e ingressos já emitidos ficam guardados por obrigação fiscal. Eventos publicados com data futura e saques em andamento impedem a exclusão.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="cfg-excluir">Digite <strong>EXCLUIR</strong> para confirmar</Label>
            <Input id="cfg-excluir" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="EXCLUIR" autoComplete="off" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)}>Voltar</Button>
            <Button variant="destructive" onClick={handleDeleteAccount}>Confirmar exclusão</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
