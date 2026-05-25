import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  User, Lock, CreditCard, Bell, Briefcase, Users, Link2, Save,
  Eye, EyeOff, Instagram, Globe, Copy,
  Shield, Smartphone, Mail, Trash2, AlertTriangle, Loader2
} from 'lucide-react'
import { useProducerSettings } from '../../hooks/useProducerSettings'
import { supabase } from '../../lib/supabase'

type Section = 'perfil' | 'conta' | 'pagamento' | 'notificacoes' | 'equipe' | 'integracoes'

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

  // Estados locais editáveis
  const [profile, setProfile] = useState({
    name: '', email: '', phone: '', bio: '', company: '',
    website: '', instagram: '', tiktok: '', linkedin: '', avatar: ''
  })

  const [password, setPassword] = useState({ current: '', new: '', confirm: '' })
  const [showPw, setShowPw] = useState<Record<string, boolean>>({})
  const [twoFA, setTwoFA] = useState(false)

  const [payment, setPayment] = useState({
    bankName: 'Itau', accountType: 'corrente', agency: '', account: '', holder: '', pixKey: ''
  })

  const [notifications, setNotifications] = useState({
    newSale: true, newMessage: true, eventReminder: true, payoutComplete: true,
    marketingEmails: false, pushEnabled: true, smsEnabled: false,
  })

  const [team, setTeam] = useState<Array<{ id: string; name: string; email: string; role: string; status: 'active' | 'pending' }>>([])
  const [inviteEmail, setInviteEmail] = useState('')

  const [integrations, setIntegrations] = useState({ apiKey: '', webhook: '' })

  // Sincronizar estado local com dados do Supabase
  useEffect(() => {
    if (data) {
      setProfile({
        name: data.profile.full_name || '',
        email: data.profile.email || '',
        phone: data.profile.phone || '',
        bio: data.profile.bio || '',
        company: data.producer_profile?.company_name || '',
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
      setIntegrations({
        apiKey: data.producer_profile?.api_key || '',
        webhook: data.producer_profile?.webhook_url || '',
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
      await saveProducerProfile({ company_name: profile.company })
      toast.success('Empresa atualizada!')
    } catch {
      toast.error('Erro ao salvar empresa')
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
    if (password.new.length < 6) {
      toast.error('Mínimo 6 caracteres')
      return
    }
    try {
      const { error } = await supabase.auth.updateUser({ password: password.new })
      if (error) throw error
      setPassword({ current: '', new: '', confirm: '' })
      toast.success('Senha alterada!')
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

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copiado!')
  }

  const sidebarItems: { id: Section; label: string; icon: typeof User }[] = [
    { id: 'perfil', label: 'Perfil', icon: User },
    { id: 'conta', label: 'Conta & Seguranca', icon: Lock },
    { id: 'pagamento', label: 'Pagamento', icon: CreditCard },
    { id: 'notificacoes', label: 'Notificacoes', icon: Bell },
    { id: 'equipe', label: 'Equipe', icon: Users },
    { id: 'integracoes', label: 'Integracoes', icon: Link2 },
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
        <p className="text-sm text-espresso/50 mt-1">Gerencie sua conta e preferencias</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <div className="lg:w-56 flex-shrink-0">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
            {sidebarItems.map(item => (
              <button key={item.id} onClick={() => setSection(item.id)} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all whitespace-nowrap ${section === item.id ? 'bg-plum/10 text-plum font-medium' : 'text-espresso/40 hover:text-espresso hover:bg-white/40'}`}>
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
                <img src={profile.avatar} alt="" className="w-20 h-20 rounded-2xl object-cover ring-2 ring-canvas" />
                <div>
                  <button className="px-4 py-2 bg-plum text-cream text-xs rounded-full hover:shadow-glow transition-all" onClick={() => toast.info('Upload de avatar sera implementado com Storage')}>Alterar foto</button>
                  <p className="text-[10px] text-espresso/30 mt-1">JPG, PNG. Max 2MB</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-espresso/40 mb-1 block">Nome</label>
                  <input value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                </div>
                <div>
                  <label className="text-xs text-espresso/40 mb-1 block">E-mail</label>
                  <input value={profile.email} disabled className="w-full px-4 py-2.5 bg-white/30 border border-white/60 rounded-xl text-sm text-espresso/50 focus:outline-none cursor-not-allowed" />
                </div>
                <div>
                  <label className="text-xs text-espresso/40 mb-1 block">Telefone</label>
                  <input value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                </div>
                <div>
                  <label className="text-xs text-espresso/40 mb-1 block">Empresa</label>
                  <input value={profile.company} onChange={e => setProfile({ ...profile, company: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-espresso/40 mb-1 block">Bio</label>
                  <textarea value={profile.bio} onChange={e => setProfile({ ...profile, bio: e.target.value })} rows={3} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30 resize-none" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-espresso/40 mb-1 block flex items-center gap-1"><Globe className="w-3 h-3" />Website</label>
                  <input value={profile.website} onChange={e => setProfile({ ...profile, website: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                </div>
                <div>
                  <label className="text-xs text-espresso/40 mb-1 block flex items-center gap-1"><Instagram className="w-3 h-3" />Instagram</label>
                  <input value={profile.instagram} onChange={e => setProfile({ ...profile, instagram: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                </div>
                <div>
                  <label className="text-xs text-espresso/40 mb-1 block flex items-center gap-1"><Smartphone className="w-3 h-3" />TikTok</label>
                  <input value={profile.tiktok} onChange={e => setProfile({ ...profile, tiktok: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                </div>
                <div>
                  <label className="text-xs text-espresso/40 mb-1 block flex items-center gap-1"><Globe className="w-3 h-3" />LinkedIn</label>
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
                      <label className="text-xs text-espresso/40 mb-1 block">
                        {field === 'current' ? 'Senha atual' : field === 'new' ? 'Nova senha' : 'Confirmar nova senha'}
                      </label>
                      <div className="relative">
                        <input
                          type={showPw[field] ? 'text' : 'password'}
                          value={password[field as keyof typeof password]}
                          onChange={e => setPassword({ ...password, [field]: e.target.value })}
                          className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso pr-10 focus:outline-none focus:border-plum/30"
                        />
                        <button onClick={() => setShowPw({ ...showPw, [field]: !showPw[field] })} className="absolute right-3 top-1/2 -translate-y-1/2 text-espresso/30">
                          {showPw[field] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  ))}
                  <button onClick={handlePassword} className="px-5 py-2 bg-plum text-cream text-sm rounded-full hover:shadow-glow transition-all">Atualizar senha</button>
                </div>
              </div>

              <div className="border-t border-espresso/5 pt-6">
                <h2 className="text-lg font-medium text-espresso mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-plum" />Verificacao em Duas Etapas</h2>
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/60 border border-white/60">
                  <div>
                    <div className="text-sm text-espresso">Autenticacao 2FA</div>
                    <div className="text-[10px] text-espresso/30">Proteja sua conta com codigo SMS</div>
                  </div>
                  <button onClick={() => setTwoFA(!twoFA)} className={`relative w-11 h-6 rounded-full transition-colors ${twoFA ? 'bg-plum' : 'bg-espresso/10'}`}>
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${twoFA ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>

              <div className="border-t border-espresso/5 pt-6">
                <h2 className="text-lg font-medium text-red-500 mb-4 flex items-center gap-2"><AlertTriangle className="w-5 h-5" />Zona de Perigo</h2>
                <div className="p-4 rounded-xl bg-red-50/50 border border-red-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-espresso">Excluir conta</div>
                      <div className="text-[10px] text-espresso/30">Esta acao nao pode ser desfeita</div>
                    </div>
                    <button className="px-4 py-2 bg-red-500 text-white text-xs rounded-full hover:bg-red-600 transition-all" onClick={() => toast.info('Funcao de exclusao sera implementada com confirmacao por email')}>Excluir</button>
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
                  <label className="text-xs text-espresso/40 mb-1 block">Banco</label>
                  <select value={payment.bankName} onChange={e => setPayment({ ...payment, bankName: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30">
                    <option>Itau</option><option>Bradesco</option><option>Nubank</option><option>Santander</option><option>Inter</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-espresso/40 mb-1 block">Tipo de Conta</label>
                  <select value={payment.accountType} onChange={e => setPayment({ ...payment, accountType: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30">
                    <option value="corrente">Conta Corrente</option><option value="poupanca">Poupanca</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-espresso/40 mb-1 block">Agencia</label>
                  <input value={payment.agency} onChange={e => setPayment({ ...payment, agency: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                </div>
                <div>
                  <label className="text-xs text-espresso/40 mb-1 block">Conta</label>
                  <input value={payment.account} onChange={e => setPayment({ ...payment, account: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-espresso/40 mb-1 block">Titular</label>
                  <input value={payment.holder} onChange={e => setPayment({ ...payment, holder: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-espresso/40 mb-1 block flex items-center gap-1"><Smartphone className="w-3 h-3" />Chave Pix</label>
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
                        <div className="text-[10px] text-espresso/30">{item.desc}</div>
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
                <label className="text-xs text-espresso/40 block">Convidar membro</label>
                <div className="flex gap-2">
                  <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@exemplo.com" className="flex-1 px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
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
                      <div className="text-[10px] text-espresso/30">{member.email}</div>
                    </div>
                    <select value={member.role} onChange={e => handleRoleChange(member.id, e.target.value)} className="text-xs bg-white/60 border border-white/60 rounded-lg px-2 py-1 text-espresso focus:outline-none">
                      <option>Admin</option><option>Editor</option><option>Visualizador</option>
                    </select>
                    <span className={`px-2 py-0.5 text-[10px] rounded-full border ${member.status === 'active' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                      {member.status === 'active' ? 'Ativo' : 'Pendente'}
                    </span>
                    <button onClick={() => handleRemoveMember(member.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-espresso/10 hover:text-red-500 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {team.length === 0 && (
                  <div className="py-8 text-center text-xs text-espresso/30">Nenhum membro na equipe ainda.</div>
                )}
              </div>
            </div>
          )}

          {/* INTEGRACOES */}
          {section === 'integracoes' && (
            <div className="space-y-6">
              <h2 className="text-lg font-medium text-espresso">Integracoes</h2>

              <div className="space-y-4">
                <div className="p-5 rounded-xl bg-white/60 border border-white/60">
                  <label className="text-xs text-espresso/40 mb-2 block flex items-center gap-1"><Briefcase className="w-3 h-3" />API Key</label>
                  <div className="flex gap-2">
                    <div className="flex-1 px-4 py-2.5 bg-canvas rounded-xl text-xs text-espresso/40 font-mono truncate">{integrations.apiKey}</div>
                    <button onClick={() => handleCopy(integrations.apiKey)} className="px-3 py-2.5 bg-plum text-cream rounded-xl hover:shadow-glow transition-all">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-white/60 border border-white/60">
                  <label className="text-xs text-espresso/40 mb-2 block flex items-center gap-1"><Link2 className="w-3 h-3" />Webhook URL</label>
                  <div className="flex gap-2">
                    <div className="flex-1 px-4 py-2.5 bg-canvas rounded-xl text-xs text-espresso/40 font-mono truncate">{integrations.webhook}</div>
                    <button onClick={() => handleCopy(integrations.webhook)} className="px-3 py-2.5 bg-plum text-cream rounded-xl hover:shadow-glow transition-all">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-white/60 border border-white/60">
                  <h3 className="text-sm font-medium text-espresso mb-3">Widget de Vendas</h3>
                  <p className="text-xs text-espresso/30 mb-3">Incorpore o botao de compra no seu site</p>
                  <div className="p-3 bg-canvas rounded-xl font-mono text-[10px] text-espresso/40 break-all">
                    {`<script src="https://evokaa.events/widget.js" data-producer="123"></script>`}
                  </div>
                  <button onClick={() => handleCopy(`<script src="https://evokaa.events/widget.js" data-producer="123"></script>`)} className="mt-2 px-4 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso hover:bg-white transition-all flex items-center gap-1">
                    <Copy className="w-3 h-3" /> Copiar codigo
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
