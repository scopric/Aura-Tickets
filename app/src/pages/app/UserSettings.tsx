import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { toast } from 'sonner'
import {
  User, Lock, CreditCard, Bell, Shield, Save, Eye, EyeOff,
  Music, UtensilsCrossed, Ticket, MapPin, Heart, Tag,
  Smartphone, Trash2, AlertTriangle, Star, Loader2
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { uploadAvatar } from '../../lib/avatarUpload'
import { supabase } from '../../lib/supabase'

type Section = 'perfil' | 'seguranca' | 'pagamento' | 'notificacoes' | 'privacidade'

export default function UserSettings() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [section, setSection] = useState<Section>('perfil')
  const [showPw, setShowPw] = useState<Record<string, boolean>>({})

  const avatarInputRef = useRef<HTMLInputElement>(null)
  
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && user?.id) {
      const newAvatarUrl = await uploadAvatar(file, user.id)
      if (newAvatarUrl) {
        setProfile(prev => ({ ...prev, avatar: newAvatarUrl }))
      }
    }
  }

  const triggerAvatarUpload = () => {
    avatarInputRef.current?.click()
  }

  const [profile, setProfile] = useState({
    name: user?.name || 'Ana Carolina',
    email: user?.email || 'ana@email.com',
    phone: '(11) 98765-4321',
    city: 'Sao Paulo, SP',
    birthDate: '1998-03-15',
    bio: 'Amante de musica eletronica e festas. Sempre em busca de novas experiencias!',
    avatar: user?.avatar || 'https://i.pravatar.cc/150?img=5',
  })

  const [password, setPassword] = useState({ current: '', new: '', confirm: '' })

  // Estados do MFA (2FA) Real
  const [twoFA, setTwoFA] = useState(false)
  const [mfaFactors, setMfaFactors] = useState<any[]>([])
  const [loadingMfa, setLoadingMfa] = useState(true)
  
  const [showMfaModal, setShowMfaModal] = useState(false)
  const [enrollData, setEnrollData] = useState<{ id: string; qrCodeSvg: string; secret: string } | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [mfaError, setMfaError] = useState('')
  const [isVerifyingMfa, setIsVerifyingMfa] = useState(false)

  // Carrega os fatores de MFA da conta do usuário no Supabase
  useEffect(() => {
    async function loadFactors() {
      try {
        const { data: factorsRes, error } = await supabase.auth.mfa.listFactors()
        if (!error && factorsRes) {
          const activeFactors = factorsRes.totp || []
          setMfaFactors(activeFactors)
          setTwoFA(activeFactors.length > 0)
        }
      } catch (err) {
        console.error('[MFA Factors] Erro ao carregar:', err)
      } finally {
        setLoadingMfa(false)
      }
    }
    loadFactors()
  }, [])

  const handleStartEnroll = async () => {
    setMfaError('')
    setVerifyCode('')
    setIsVerifyingMfa(false)
    try {
      const { data: enrollRes, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'Evokaa Tickets',
        friendlyName: user?.email || 'Evokaa Account'
      })

      if (error) throw error

      if (enrollRes) {
        setEnrollData({
          id: enrollRes.id,
          qrCodeSvg: enrollRes.totp.qr_code || '',
          secret: enrollRes.totp.secret || ''
        })
        setShowMfaModal(true)
      }
    } catch (err: any) {
      console.error('[MFA Enroll] Erro ao iniciar:', err)
      toast.error(err.message || 'Erro ao iniciar ativação de 2FA')
    }
  }

  const handleVerifyEnroll = async (e: React.FormEvent) => {
    e.preventDefault()
    setMfaError('')
    if (!verifyCode || verifyCode.length !== 6) {
      setMfaError('Digite o código de 6 dígitos do aplicativo')
      return
    }
    if (!enrollData) return

    setIsVerifyingMfa(true)
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId: enrollData.id })
      if (challenge.error) throw challenge.error

      const verify = await supabase.auth.mfa.verify({
        factorId: enrollData.id,
        challengeId: challenge.data.id,
        code: verifyCode.trim()
      })

      if (verify.error) throw verify.error

      toast.success('Autenticação de dois fatores (2FA) ativada com sucesso!')
      setTwoFA(true)
      
      const factorsRes = await supabase.auth.mfa.listFactors()
      setMfaFactors(factorsRes.data?.totp || [])
      setShowMfaModal(false)
      setEnrollData(null)
    } catch (err: any) {
      console.error('[MFA Verify] Erro:', err)
      setMfaError(err.message || 'Código inválido. Verifique o app e tente novamente.')
    } finally {
      setIsVerifyingMfa(false)
    }
  }

  const handleDisableMfa = async () => {
    if (!window.confirm('Tem certeza que deseja desativar a autenticação em duas etapas (2FA)? Sua conta ficará menos protegida.')) {
      return
    }
    
    try {
      for (const factor of mfaFactors) {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id })
        if (error) throw error
      }

      toast.success('2FA desativado com sucesso.')
      setTwoFA(false)
      setMfaFactors([])
    } catch (err: any) {
      console.error('[MFA Unenroll] Erro:', err)
      toast.error(err.message || 'Erro ao desativar o 2FA')
    }
  }

  const [preferences, setPreferences] = useState({
    genres: ['eletronica', 'funk', 'hiphop'],
    eventTypes: ['balada', 'festival'],
    maxDistance: '50',
  })

  const [cards, setCards] = useState([
    { id: 'c1', brand: 'Visa', last4: '4242', expiry: '12/26', default: true },
    { id: 'c2', brand: 'Mastercard', last4: '8888', expiry: '08/27', default: false },
  ])

  const [notifications, setNotifications] = useState({
    eventRecommendations: true,
    reminders: true,
    promotions: false,
    friendActivity: true,
    ticketTransfer: true,
    appUpdates: false,
  })

  const [privacy, setPrivacy] = useState({
    profilePublic: false,
    showOnTables: true,
    shareActivity: false,
  })

  const handleSave = () => {
    toast.success('Alteracoes salvas!')
  }

  const handlePassword = () => {
    if (!password.current || !password.new || !password.confirm) {
      toast.error('Preencha todos os campos'); return
    }
    if (password.new !== password.confirm) { toast.error('Senhas nao conferem'); return }
    if (password.new.length < 8) { toast.error('Minimo 8 caracteres'); return }
    setPassword({ current: '', new: '', confirm: '' })
    toast.success('Senha alterada!')
  }

  const handleDeleteAccount = () => {
    toast.info('Conta excluida (demo)')
    logout()
    navigate('/')
  }

  const sidebarItems: { id: Section; label: string; icon: typeof User }[] = [
    { id: 'perfil', label: 'Perfil', icon: User },
    { id: 'seguranca', label: 'Seguranca', icon: Shield },
    { id: 'pagamento', label: 'Pagamento', icon: CreditCard },
    { id: 'notificacoes', label: 'Notificacoes', icon: Bell },
    { id: 'privacidade', label: 'Privacidade', icon: Lock },
  ]

  const genreOptions = [
    { id: 'eletronica', label: 'Eletronica', icon: Music },
    { id: 'funk', label: 'Funk', icon: Star },
    { id: 'hiphop', label: 'Hip Hop', icon: Music },
    { id: 'rock', label: 'Rock', icon: Music },
    { id: 'sertanejo', label: 'Sertanejo', icon: Music },
    { id: 'pagode', label: 'Pagode', icon: Music },
    { id: 'jazz', label: 'Jazz', icon: Music },
    { id: 'indie', label: 'Indie', icon: Star },
  ]

  const eventTypeOptions = [
    { id: 'balada', label: 'Balada', icon: Music },
    { id: 'festival', label: 'Festival', icon: Star },
    { id: 'show', label: 'Show', icon: Music },
    { id: 'casamento', label: 'Casamento', icon: Heart },
    { id: 'corporativo', label: 'Corporativo', icon: Tag },
    { id: 'gastronomia', label: 'Gastronomia', icon: UtensilsCrossed },
  ]

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-espresso">Configuracoes</h1>
        <p className="text-sm text-espresso/50 mt-1">Gerencie seu perfil e preferencias</p>
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
              <h2 className="text-lg font-medium text-espresso">Meu Perfil</h2>

              <div className="flex items-center gap-4">
                <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
                <img src={profile.avatar} alt="" className="w-20 h-20 rounded-2xl object-cover ring-2 ring-canvas" />
                <div>
                  <button className="px-4 py-2 bg-plum text-cream text-xs rounded-full hover:shadow-glow transition-all" onClick={triggerAvatarUpload}>Alterar foto</button>
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
                  <input value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                </div>
                <div>
                  <label className="text-xs text-espresso/40 mb-1 block">Telefone</label>
                  <input value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                </div>
                <div>
                  <label className="text-xs text-espresso/40 mb-1 block flex items-center gap-1"><MapPin className="w-3 h-3" />Cidade</label>
                  <input value={profile.city} onChange={e => setProfile({ ...profile, city: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                </div>
                <div>
                  <label className="text-xs text-espresso/40 mb-1 block">Data de Nascimento</label>
                  <input type="date" value={profile.birthDate} onChange={e => setProfile({ ...profile, birthDate: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-espresso/40 mb-1 block">Bio</label>
                  <textarea value={profile.bio} onChange={e => setProfile({ ...profile, bio: e.target.value })} rows={3} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30 resize-none" />
                </div>
              </div>

              {/* Preferences */}
              <div className="border-t border-espresso/5 pt-6">
                <h3 className="text-sm font-medium text-espresso mb-3">Generos Musicais Favoritos</h3>
                <div className="flex flex-wrap gap-2">
                  {genreOptions.map(g => {
                    const selected = preferences.genres.includes(g.id)
                    return (
                      <button key={g.id} onClick={() => setPreferences({ ...preferences, genres: selected ? preferences.genres.filter(x => x !== g.id) : [...preferences.genres, g.id] })} className={`px-3 py-1.5 rounded-full text-xs transition-all flex items-center gap-1 ${selected ? 'bg-plum text-cream' : 'bg-white/60 border border-white/60 text-espresso/50'}`}>
                        {selected && <Star className="w-3 h-3" />}{g.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="border-t border-espresso/5 pt-4">
                <h3 className="text-sm font-medium text-espresso mb-3">Tipos de Evento Preferidos</h3>
                <div className="flex flex-wrap gap-2">
                  {eventTypeOptions.map(t => {
                    const selected = preferences.eventTypes.includes(t.id)
                    return (
                      <button key={t.id} onClick={() => setPreferences({ ...preferences, eventTypes: selected ? preferences.eventTypes.filter(x => x !== t.id) : [...preferences.eventTypes, t.id] })} className={`px-3 py-1.5 rounded-full text-xs transition-all flex items-center gap-1 ${selected ? 'bg-plum text-cream' : 'bg-white/60 border border-white/60 text-espresso/50'}`}>
                        {selected && <Star className="w-3 h-3" />}{t.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="border-t border-espresso/5 pt-4">
                <label className="text-xs text-espresso/40 mb-2 block">Distancia Maxima (km)</label>
                <div className="flex items-center gap-3">
                  <input type="range" min="5" max="200" value={preferences.maxDistance} onChange={e => setPreferences({ ...preferences, maxDistance: e.target.value })} className="flex-1 accent-plum" />
                  <span className="text-sm text-espresso font-medium w-16">{preferences.maxDistance}km</span>
                </div>
              </div>

              <div className="flex justify-end">
                <button onClick={handleSave} className="px-6 py-2.5 bg-plum text-cream text-sm rounded-full hover:shadow-glow transition-all flex items-center gap-2">
                  <Save className="w-4 h-4" />Salvar
                </button>
              </div>
            </div>
          )}

          {/* SEGURANCA */}
          {section === 'seguranca' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-lg font-medium text-espresso mb-4">Alterar Senha</h2>
                <div className="space-y-4 max-w-md">
                  {['current', 'new', 'confirm'].map(field => (
                    <div key={field}>
                      <label className="text-xs text-espresso/40 mb-1 block">
                        {field === 'current' ? 'Senha atual' : field === 'new' ? 'Nova senha' : 'Confirmar'}
                      </label>
                      <div className="relative">
                        <input type={showPw[field] ? 'text' : 'password'} value={password[field as keyof typeof password]} onChange={e => setPassword({ ...password, [field]: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso pr-10 focus:outline-none focus:border-plum/30" />
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
                <h2 className="text-lg font-medium text-espresso mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-plum" />Verificação em Duas Etapas</h2>
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/60 border border-white/60">
                  <div>
                    <div className="text-sm text-espresso">Autenticação 2FA (Google Authenticator)</div>
                    <div className="text-[10px] text-espresso/30">
                      {loadingMfa ? 'Carregando status...' : twoFA ? 'Ativo — Seu login exige código do autenticador' : 'Inativo — Proteja sua conta com código de segurança'}
                    </div>
                  </div>
                  <button 
                    disabled={loadingMfa}
                    onClick={twoFA ? handleDisableMfa : handleStartEnroll} 
                    className={`relative w-11 h-6 rounded-full transition-colors ${twoFA ? 'bg-plum' : 'bg-espresso/10'} disabled:opacity-55`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${twoFA ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>

              <div className="border-t border-espresso/5 pt-6">
                <h2 className="text-lg font-medium text-red-500 mb-4 flex items-center gap-2"><AlertTriangle className="w-5 h-5" />Zona de Perigo</h2>
                <div className="p-4 rounded-xl bg-red-50/50 border border-red-100">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-sm text-espresso">Excluir conta</div>
                      <div className="text-[10px] text-espresso/30">Todos os dados serao perdidos</div>
                    </div>
                  </div>
                  <button onClick={handleDeleteAccount} className="w-full py-2 bg-red-500 text-white text-xs rounded-full hover:bg-red-600 transition-all">Excluir minha conta</button>
                </div>
              </div>
            </div>
          )}

          {/* PAGAMENTO */}
          {section === 'pagamento' && (
            <div className="space-y-6">
              <h2 className="text-lg font-medium text-espresso">Cartoes Salvos</h2>

              <div className="space-y-3">
                {cards.map(card => (
                  <div key={card.id} className="flex items-center gap-4 p-4 rounded-xl bg-white/60 border border-white/60">
                    <div className="w-10 h-10 rounded-lg bg-plum/10 flex items-center justify-center flex-shrink-0">
                      <CreditCard className="w-5 h-5 text-plum" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-espresso font-medium">{card.brand} ****{card.last4}</div>
                      <div className="text-[10px] text-espresso/30">Expira {card.expiry}</div>
                    </div>
                    {card.default && <span className="px-2 py-0.5 bg-plum/10 text-plum text-[10px] rounded-full">Padrao</span>}
                    <button onClick={() => { setCards(cards.filter(c => c.id !== card.id)); toast.success('Cartao removido') }} className="p-1.5 rounded-lg hover:bg-red-50 text-espresso/10 hover:text-red-500 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <button className="w-full py-3 border border-dashed border-espresso/15 rounded-xl text-sm text-espresso/30 hover:text-plum hover:border-plum/30 transition-all flex items-center justify-center gap-2">
                <CreditCard className="w-4 h-4" /> Adicionar cartao
              </button>

              <div className="border-t border-espresso/5 pt-6">
                <h3 className="text-sm font-medium text-espresso mb-3">Historico de Compras</h3>
                <div className="space-y-2">
                  {[
                    { event: 'Noite Eletro 2025', ticket: 'Ingresso VIP', date: '15 Mai 2025', amount: 280 },
                    { event: 'Jazz Sunset', ticket: 'Ingresso Geral', date: '10 Abr 2025', amount: 80 },
                    { event: 'Noite Eletro 2025', ticket: 'Mesa Coletiva', date: '12 Mai 2025', amount: 160 },
                  ].map((p, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/40 border border-white/60">
                      <div className="flex items-center gap-3">
                        <Ticket className="w-4 h-4 text-plum" />
                        <div>
                          <div className="text-sm text-espresso">{p.event}</div>
                          <div className="text-[10px] text-espresso/30">{p.ticket} · {p.date}</div>
                        </div>
                      </div>
                      <div className="text-sm font-medium text-espresso">R$ {p.amount}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* NOTIFICACOES */}
          {section === 'notificacoes' && (
            <div className="space-y-6">
              <h2 className="text-lg font-medium text-espresso">Notificacoes</h2>
              <div className="space-y-3">
                {[
                  { key: 'eventRecommendations', label: 'Eventos recomendados', desc: 'Baseado nos seus generos favoritos', icon: Ticket },
                  { key: 'reminders', label: 'Lembretes de eventos', desc: 'Alertas antes dos seus eventos confirmados', icon: Smartphone },
                  { key: 'promotions', label: 'Promocoes e descontos', desc: 'Cupons e ofertas exclusivas', icon: Star },
                  { key: 'friendActivity', label: 'Atividade de amigos', desc: 'Quando amigos confirmam em eventos', icon: User },
                  { key: 'ticketTransfer', label: 'Transferencia de ingresso', desc: 'Quando alguem te envia um ingresso', icon: Ticket },
                  { key: 'appUpdates', label: 'Atualizacoes do app', desc: 'Novas funcionalidades e melhorias', icon: Smartphone },
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
              <div className="flex justify-end">
                <button onClick={handleSave} className="px-6 py-2.5 bg-plum text-cream text-sm rounded-full hover:shadow-glow transition-all flex items-center gap-2">
                  <Save className="w-4 h-4" />Salvar
                </button>
              </div>
            </div>
          )}

          {/* PRIVACIDADE */}
          {section === 'privacidade' && (
            <div className="space-y-6">
              <h2 className="text-lg font-medium text-espresso">Privacidade</h2>
              <div className="space-y-3">
                {[
                  { key: 'profilePublic', label: 'Perfil publico', desc: 'Qualquer pessoa pode ver seu perfil e eventos', icon: User },
                  { key: 'showOnTables', label: 'Mostrar nas mesas coletivas', desc: 'Outros participantes podem ver voce nas mesas', icon: Heart },
                  { key: 'shareActivity', label: 'Compartilhar atividade', desc: 'Amigos veem em quais eventos voce confirmou', icon: Smartphone },
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
                      <input type="checkbox" checked={privacy[item.key as keyof typeof privacy]} onChange={e => setPrivacy({ ...privacy, [item.key]: e.target.checked })} className="sr-only peer" />
                      <div className="w-10 h-5 bg-espresso/10 rounded-full peer peer-checked:bg-plum transition-colors" />
                      <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
                    </label>
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <button onClick={handleSave} className="px-6 py-2.5 bg-plum text-cream text-sm rounded-full hover:shadow-glow transition-all flex items-center gap-2">
                  <Save className="w-4 h-4" />Salvar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal do 2FA */}
      {showMfaModal && enrollData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-canvas border border-espresso/10 rounded-2xl p-6 shadow-2xl relative text-espresso">
            <h3 className="font-serif text-xl mb-2 flex items-center gap-2">
              <Shield className="w-5 h-5 text-plum" /> Configurar Autenticador (2FA)
            </h3>
            <p className="text-xs text-espresso/60 mb-4">
              Instale o Google Authenticator ou Microsoft Authenticator no seu celular, escaneie o código abaixo e digite o código de 6 dígitos para validar.
            </p>

            {enrollData.qrCodeSvg && (
              <div 
                className="w-48 h-48 mx-auto my-6 bg-white p-3 rounded-xl flex items-center justify-center shadow-inner border border-espresso/10"
                dangerouslySetInnerHTML={{ __html: enrollData.qrCodeSvg }}
              />
            )}

            <div className="bg-slate-50 dark:bg-white/5 border border-espresso/5 rounded-xl p-3 mb-4 text-center">
              <span className="text-[10px] text-espresso/40 block mb-1">Chave Manual (se o QR Code falhar)</span>
              <code className="text-xs font-mono font-bold tracking-wider select-all break-all text-plum">
                {enrollData.secret}
              </code>
            </div>

            {mfaError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-xs text-red-600 text-center">
                {mfaError}
              </div>
            )}

            <form onSubmit={handleVerifyEnroll} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-espresso/60 mb-1 block">Código de Verificação</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={verifyCode}
                  onChange={e => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  disabled={isVerifyingMfa}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-white/60 border border-slate-200 dark:border-white/60 rounded-xl text-center text-lg font-mono tracking-widest text-espresso focus:outline-none focus:border-plum/30 transition-colors disabled:opacity-50"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  disabled={isVerifyingMfa}
                  onClick={() => {
                    setShowMfaModal(false)
                    setEnrollData(null)
                  }}
                  className="px-4 py-2 text-xs text-espresso/50 hover:text-espresso transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingMfa}
                  className="px-5 py-2 bg-plum text-cream text-xs font-medium rounded-full hover:shadow-glow transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isVerifyingMfa ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Verificando...</span>
                    </>
                  ) : (
                    <span>Ativar 2FA</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
