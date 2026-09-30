import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { passwordError, PASSWORD_HINT } from '../../lib/password'
import {
  User, Lock, CreditCard, Bell, Users, Save,
  Eye, EyeOff, Instagram, Globe,
  Shield, Smartphone, Mail, Trash2, AlertTriangle, Loader2
} from 'lucide-react'
import { useProducerSettings } from '../../hooks/useProducerSettings'
import { useTwoFactor } from '../../hooks/useTwoFactor'
import { supabase } from '../../lib/supabase'
import { uploadAvatar } from '../../lib/avatarUpload'
import PhoneInput from '../../components/ui/PhoneInput'
import { formatCNPJ } from '../../lib/formatters'

type Section = 'perfil' | 'conta' | 'pagamento' | 'notificacoes' | 'equipe'

export default function ProducerSettings() {
  const {
    data,
    isLoading,
    saveProfile,
    isSavingProfile,
    saveProducerProfile,
    isSavingProducerProfile,
    inviteTeamMember,
    removeTeamMember,
    updateTeamRole,
    isTeamActionPending,
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

  const [team, setTeam] = useState<Array<{ id: string; name: string; email: string; role: string; status: 'active' | 'pending' }>>([])
  const [inviteEmail, setInviteEmail] = useState('')

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
        avatar: data.profile.avatar_url || 'https://i.pravatar.cc/150?img=11',
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
      setTeam(data.team)
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
        cnpj: profile.cnpj.replace(/\D/g, '')
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
      // O servidor confere a senha atual sem novo login (um signInWithPassword trocaria a sessão aal2
      // por aal1 e o banco bloquearia tudo). Só vale com "update_password_require_current_password"
      // ligado no Supabase; desligado, o servidor ignora o campo.
      const { error } = await supabase.auth.updateUser({ password: password.new, current_password: password.current })
      if (error?.code === 'current_password_invalid') {
        toast.error('Senha atual incorreta')
        return
      }
      if (error) throw error
      setPassword({ current: '', new: '', confirm: '' })
      toast.success('Senha alterada!')
      // Derruba as sessões dos outros aparelhos; esta continua aberta.
      const { error: outrasError } = await supabase.auth.signOut({ scope: 'others' })
      if (outrasError) toast.error('Senha alterada, mas não foi possível encerrar as outras sessões')
    } catch (err: any) {
      toast.error(err.message || 'Erro ao alterar senha')
    }
  }

  const handleInvite = async () => {
    if (!inviteEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) {
      toast.error('E-mail inválido')
      return
    }
    try {
      await inviteTeamMember({ email: inviteEmail, role: 'Visualizador' })
      setInviteEmail('')
    } catch {
      // erro já tratado no hook
    }
  }

  const handleRemoveMember = async (id: string) => {
    try {
      await removeTeamMember(id)
      setTeam(prev => prev.filter(t => t.id !== id))
    } catch {
      // erro já tratado no hook
    }
  }

  const handleRoleChange = async (id: string, role: string) => {
    try {
      await updateTeamRole({ memberId: id, role })
      setTeam(prev => prev.map(t => t.id === id ? { ...t, role } : t))
    } catch {
      toast.error('Erro ao alterar função')
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
    { id: 'conta', label: 'Conta & Seguranca', icon: Lock },
    { id: 'pagamento', label: 'Pagamento', icon: CreditCard },
    { id: 'notificacoes', label: 'Notificacoes', icon: Bell },
    { id: 'equipe', label: 'Equipe', icon: Users },
  ]

  if (isLoading) {
    return (
      <div className="p-6 lg:p-10 max-w-6xl flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-plum animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-espresso">Configuracoes</h1>
        <p className="text-sm text-espresso/70 mt-1">Gerencie sua conta e preferencias</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <div className="lg:w-56 flex-shrink-0">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
            {sidebarItems.map(item => (
              <button key={item.id} onClick={() => setSection(item.id)} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all whitespace-nowrap ${section === item.id ? 'bg-plum/10 text-plum font-medium' : 'text-espresso/70 hover:text-espresso hover:bg-white/40'}`}>
                <item.icon className="w-4 h-4" />{item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* PERFIL */}
          {section === 'perfil' && (
            <div className="space-y-6">
              <h2 className="text-lg font-medium text-espresso">Perfil Publico</h2>

              {/* Avatar */}
              <div className="flex items-center gap-4">
                <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
                <img src={profile.avatar} alt="" className="w-20 h-20 rounded-2xl object-cover ring-2 ring-canvas" />
                <div>
                  <button className="px-4 py-2 bg-plum text-cream text-xs rounded-full hover:shadow-glow transition-all" onClick={triggerAvatarUpload}>Alterar foto</button>
                  <p className="text-[10px] text-espresso/70 mt-1">JPG, PNG. Max 2MB</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-espresso/70 mb-1 block">Nome</label>
                  <input value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                </div>
                <div>
                  <label className="text-xs text-espresso/70 mb-1 block">E-mail</label>
                  <input value={profile.email} disabled className="w-full px-4 py-2.5 bg-white/30 dark:bg-white/5 border border-white/60 rounded-xl text-sm text-espresso/70 focus:outline-none cursor-not-allowed" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-espresso/70 mb-1 block">Telefone</label>
                  <PhoneInput value={profile.phone} onChange={val => setProfile({ ...profile, phone: val })} />
                </div>
                <div>
                  <label className="text-xs text-espresso/70 mb-1 block">Empresa (Razão Social)</label>
                  <input value={profile.company} onChange={e => setProfile({ ...profile, company: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                </div>
                <div>
                  <label className="text-xs text-espresso/70 mb-1 block">CNPJ</label>
                  <input value={profile.cnpj} placeholder="00.000.000/0000-00" onChange={e => setProfile({ ...profile, cnpj: formatCNPJ(e.target.value) })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-espresso/70 mb-1 block">Bio</label>
                  <textarea value={profile.bio} onChange={e => setProfile({ ...profile, bio: e.target.value })} rows={3} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30 resize-none" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-espresso/70 mb-1 block flex items-center gap-1"><Globe className="w-3 h-3" />Website</label>
                  <input value={profile.website} onChange={e => setProfile({ ...profile, website: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                </div>
                <div>
                  <label className="text-xs text-espresso/70 mb-1 block flex items-center gap-1"><Instagram className="w-3 h-3" />Instagram</label>
                  <input value={profile.instagram} onChange={e => setProfile({ ...profile, instagram: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                </div>
                <div>
                  <label className="text-xs text-espresso/70 mb-1 block flex items-center gap-1"><Smartphone className="w-3 h-3" />TikTok</label>
                  <input value={profile.tiktok} onChange={e => setProfile({ ...profile, tiktok: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                </div>
                <div>
                  <label className="text-xs text-espresso/70 mb-1 block flex items-center gap-1"><Globe className="w-3 h-3" />LinkedIn</label>
                  <input value={profile.linkedin} onChange={e => setProfile({ ...profile, linkedin: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={handleSaveCompany} disabled={isSaving} className="px-6 py-2.5 bg-white/60 border border-white/60 text-espresso text-sm rounded-full hover:bg-white transition-all flex items-center gap-2">
                  <Save className="w-4 h-4" />Salvar Empresa
                </button>
                <button onClick={handleSaveProfile} disabled={isSaving} className="px-6 py-2.5 bg-plum text-cream text-sm rounded-full hover:shadow-glow transition-all flex items-center gap-2">
                  {isSavingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Salvar Perfil
                </button>
              </div>
            </div>
          )}

          {/* CONTA */}
          {section === 'conta' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-lg font-medium text-espresso mb-4">Alterar Senha</h2>
                <div className="space-y-4 max-w-md">
                  {['current', 'new', 'confirm'].map((field) => (
                    <div key={field}>
                      <label className="text-xs text-espresso/70 mb-1 block">
                        {field === 'current' ? 'Senha atual' : field === 'new' ? 'Nova senha' : 'Confirmar nova senha'}
                      </label>
                      <div className="relative">
                        <input
                          type={showPw[field] ? 'text' : 'password'}
                          value={password[field as keyof typeof password]}
                          onChange={e => setPassword({ ...password, [field]: e.target.value })}
                          className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso pr-10 focus:outline-none focus:border-plum/30"
                        />
                        <button onClick={() => setShowPw({ ...showPw, [field]: !showPw[field] })} className="absolute right-3 top-1/2 -translate-y-1/2 text-espresso/70">
                          {showPw[field] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {field === 'new' && <p className="text-[10px] text-espresso/70 mt-1">{PASSWORD_HINT}</p>}
                    </div>
                  ))}
                  <button onClick={handlePassword} className="px-5 py-2 bg-plum text-cream text-sm rounded-full hover:shadow-glow transition-all">Atualizar senha</button>
                </div>
              </div>

              <div className="border-t border-espresso/5 pt-6">
                <h2 className="text-lg font-medium text-espresso mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-plum" />Verificação em Duas Etapas</h2>
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/60 border border-white/60">
                  <div>
                    <div className="text-sm text-espresso">Autenticação 2FA (Google Authenticator)</div>
                    <div className="text-[10px] text-espresso/70">
                      {mfa.loading ? 'Carregando status...' : mfa.enabled ? 'Ativo — Login exige código do autenticador' : 'Inativo — Proteja sua conta com código de segurança'}
                    </div>
                  </div>
                  <button 
                    disabled={mfa.loading}
                    aria-label={mfa.enabled ? 'Desativar 2FA' : 'Ativar 2FA'}
                    aria-pressed={mfa.enabled}
                    onClick={mfa.toggle} 
                    className={`relative w-11 h-6 rounded-full transition-colors ${mfa.enabled ? 'bg-plum' : 'bg-espresso/10'} disabled:opacity-55`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${mfa.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>

              <div className="border-t border-espresso/5 pt-6">
                <h2 className="text-lg font-medium text-red-500 mb-4 flex items-center gap-2"><AlertTriangle className="w-5 h-5" />Zona de Perigo</h2>
                <div className="p-4 rounded-xl bg-red-50/50 border border-red-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-espresso">Excluir conta</div>
                      <div className="text-[10px] text-espresso/70">Esta acao nao pode ser desfeita</div>
                    </div>
                    <button className="px-4 py-2 bg-red-500 text-white text-xs rounded-full hover:bg-red-600 transition-all" onClick={() => { setDeleteConfirm(''); setShowDelete(true) }}>Excluir</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PAGAMENTO */}
          {section === 'pagamento' && (
            <div className="space-y-6">
              <h2 className="text-lg font-medium text-espresso">Dados Bancarios</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-espresso/70 mb-1 block">Banco</label>
                  <select value={payment.bankName} onChange={e => setPayment({ ...payment, bankName: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30">
                    <option>Itau</option><option>Bradesco</option><option>Nubank</option><option>Santander</option><option>Inter</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-espresso/70 mb-1 block">Tipo de Conta</label>
                  <select value={payment.accountType} onChange={e => setPayment({ ...payment, accountType: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30">
                    <option value="corrente">Conta Corrente</option><option value="poupanca">Poupanca</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-espresso/70 mb-1 block">Agencia</label>
                  <input value={payment.agency} onChange={e => setPayment({ ...payment, agency: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                </div>
                <div>
                  <label className="text-xs text-espresso/70 mb-1 block">Conta</label>
                  <input value={payment.account} onChange={e => setPayment({ ...payment, account: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-espresso/70 mb-1 block">Titular</label>
                  <input value={payment.holder} onChange={e => setPayment({ ...payment, holder: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-espresso/70 mb-1 block flex items-center gap-1"><Smartphone className="w-3 h-3" />Chave Pix</label>
                  <input value={payment.pixKey} onChange={e => setPayment({ ...payment, pixKey: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                </div>
              </div>
              <div className="flex justify-end">
                <button onClick={handleSavePayment} disabled={isSavingProducerProfile} className="px-6 py-2.5 bg-plum text-cream text-sm rounded-full hover:shadow-glow transition-all flex items-center gap-2">
                  {isSavingProducerProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Salvar
                </button>
              </div>
            </div>
          )}

          {/* NOTIFICACOES */}
          {section === 'notificacoes' && (
            <div className="space-y-6">
              <h2 className="text-lg font-medium text-espresso">Notificacoes</h2>

              <div className="space-y-3">
                {[
                  { key: 'newSale', label: 'Nova venda', desc: 'Receba alerta quando um ingresso for vendido', icon: CreditCard },
                  { key: 'newMessage', label: 'Nova mensagem', desc: 'Notificacao de mensagens no chat', icon: Mail },
                  { key: 'eventReminder', label: 'Lembretes de evento', desc: 'Alertas 7, 3 e 1 dia antes do evento', icon: Bell },
                  { key: 'payoutComplete', label: 'Saque concluido', desc: 'Confirmacao quando o dinheiro cair na conta', icon: CreditCard },
                  { key: 'marketingEmails', label: 'E-mails de marketing', desc: 'Novidades, dicas e promocoes da Evokaa', icon: Mail },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between p-4 rounded-xl bg-white/60 border border-white/60">
                    <div className="flex items-center gap-3">
                      <item.icon className="w-4 h-4 text-plum" />
                      <div>
                        <div className="text-sm text-espresso">{item.label}</div>
                        <div className="text-[10px] text-espresso/70">{item.desc}</div>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={notifications[item.key as keyof typeof notifications]} onChange={e => setNotifications({ ...notifications, [item.key]: e.target.checked })} className="sr-only peer" />
                      <div className="w-10 h-5 bg-espresso/10 rounded-full peer peer-checked:bg-plum transition-colors" />
                      <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
                    </label>
                  </div>
                ))}
              </div>

              <div className="border-t border-espresso/5 pt-4">
                <h3 className="text-sm font-medium text-espresso mb-3">Canais</h3>
                {[
                  { key: 'pushEnabled', label: 'Push no navegador', icon: Smartphone },
                  { key: 'smsEnabled', label: 'SMS', icon: Smartphone },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between p-4 rounded-xl bg-white/60 border border-white/60 mb-2">
                    <div className="flex items-center gap-3">
                      <item.icon className="w-4 h-4 text-plum" />
                      <span className="text-sm text-espresso">{item.label}</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={notifications[item.key as keyof typeof notifications]} onChange={e => setNotifications({ ...notifications, [item.key]: e.target.checked })} className="sr-only peer" />
                      <div className="w-10 h-5 bg-espresso/10 rounded-full peer peer-checked:bg-plum transition-colors" />
                      <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
                    </label>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <button onClick={handleSaveNotifications} disabled={isSavingProducerProfile} className="px-6 py-2.5 bg-plum text-cream text-sm rounded-full hover:shadow-glow transition-all flex items-center gap-2">
                  {isSavingProducerProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Salvar
                </button>
              </div>
            </div>
          )}

          {/* EQUIPE */}
          {section === 'equipe' && (
            <div className="space-y-6">
              <h2 className="text-lg font-medium text-espresso">Equipe</h2>

              <div className="p-4 rounded-xl bg-canvas/50 space-y-3">
                <label className="text-xs text-espresso/70 block">Convidar membro</label>
                <div className="flex gap-2">
                  <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@exemplo.com" className="flex-1 px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/70 focus:outline-none focus:border-plum/30" />
                  <button onClick={handleInvite} disabled={isTeamActionPending} className="px-4 py-2.5 bg-plum text-cream text-sm rounded-full hover:shadow-glow transition-all">
                    {isTeamActionPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Convidar'}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {team.map(member => (
                  <div key={member.id} className="flex items-center gap-4 p-4 rounded-xl bg-white/60 border border-white/60">
                    <div className="w-9 h-9 rounded-full bg-plum/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-medium text-plum">{member.name[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-espresso font-medium">{member.name}</div>
                      <div className="text-[10px] text-espresso/70">{member.email}</div>
                    </div>
                    <select value={member.role} onChange={e => handleRoleChange(member.id, e.target.value)} className="text-xs bg-white/60 border border-white/60 rounded-lg px-2 py-1 text-espresso focus:outline-none">
                      <option>Admin</option><option>Editor</option><option>Visualizador</option>
                    </select>
                    <span className={`px-2 py-0.5 text-[10px] rounded-full border ${member.status === 'active' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                      {member.status === 'active' ? 'Ativo' : 'Pendente'}
                    </span>
                    <button onClick={() => handleRemoveMember(member.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-espresso/50 hover:text-red-500 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {team.length === 0 && (
                  <div className="py-8 text-center text-xs text-espresso/70">Nenhum membro na equipe ainda.</div>
                )}
              </div>
            </div>
          )}

          {/* Aba "Integrações" (API Key, Webhook, Widget) retirada: não existe API, webhook nem widget para
              produtores (Decisão 37). Volta quando houver, com chave gerada no servidor. */}
        </div>
      </div>

      {mfa.modal}

      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 glass-backdrop" onClick={() => setShowDelete(false)} />
          <div className="glass-panel relative w-full max-w-sm p-6">
            <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-6 h-6 text-red-500" /></div>
            <h3 className="font-serif text-xl text-espresso text-center mb-2">Excluir conta</h3>
            <p className="text-xs text-espresso/70 text-center mb-4">Esta ação é irreversível. Seu perfil, dados bancários e chaves serão removidos e o login desativado. Pedidos e ingressos já emitidos ficam guardados por obrigação fiscal. Eventos publicados com data futura e saques em andamento impedem a exclusão.</p>
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 mb-4">
              <p className="text-xs text-red-500 mb-2">Digite <strong>EXCLUIR</strong> para confirmar:</p>
              <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="EXCLUIR" className="w-full px-3 py-2 bg-white dark:bg-white/5 border border-red-200 rounded-lg text-sm text-red-500 placeholder:text-red-300 focus:outline-none focus:border-red-400" />
            </div>
            <div className="space-y-2">
              <button onClick={handleDeleteAccount} className="w-full py-3 bg-red-500 text-white text-sm font-medium rounded-full hover:bg-red-600 transition-all">Confirmar exclusão</button>
              <button onClick={() => setShowDelete(false)} className="w-full py-3 text-sm text-espresso/70 hover:text-espresso transition-colors">Voltar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
