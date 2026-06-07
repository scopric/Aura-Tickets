import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Settings, Globe, Mail, Shield, Save,
  AlertTriangle, Database, FileText, RefreshCw, Lock, Eye,
  Camera, Loader2
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { uploadAvatar } from '../../lib/avatarUpload'
import { supabase } from '../../lib/supabase'

type Section = 'geral' | 'email' | 'moderacao' | 'backup' | 'logs' | 'seguranca'

export default function AdminSettingsPage() {
  const [section, setSection] = useState<Section>('geral')
  const { user } = useAuth()
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && user?.id) {
      await uploadAvatar(file, user.id)
    }
  }

  const triggerAvatarUpload = () => {
    avatarInputRef.current?.click()
  }

  // Estados do MFA (2FA) Pessoal do Administrador
  const [twoFA, setTwoFA] = useState(false)
  const [mfaFactors, setMfaFactors] = useState<any[]>([])
  const [loadingMfa, setLoadingMfa] = useState(true)
  
  const [showMfaModal, setShowMfaModal] = useState(false)
  const [enrollData, setEnrollData] = useState<{ id: string; qrCodeSvg: string; secret: string } | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [mfaError, setMfaError] = useState('')
  const [isVerifyingMfa, setIsVerifyingMfa] = useState(false)

  // Carrega os fatores de MFA da conta do administrador no Supabase
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
        console.error('[MFA Factors Admin] Erro ao carregar:', err)
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
        friendlyName: user?.email || 'Evokaa Admin'
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
      console.error('[MFA Enroll Admin] Erro ao iniciar:', err)
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
      console.error('[MFA Verify Admin] Erro:', err)
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
      console.error('[MFA Unenroll Admin] Erro:', err)
      toast.error(err.message || 'Erro ao desativar o 2FA')
    }
  }

  const [general, setGeneral] = useState({
    platformName: 'Evokaa',
    tagline: 'Plataforma de Experiencias',
    timezone: 'America/Sao_Paulo',
    currency: 'BRL',
    language: 'pt-BR',
    maintenance: false,
    registrationOpen: true,
    producerApproval: true,
    cepProvider: 'viacep',
    cepApiKey: '',
    cepApiUrl: '',
  })

  const [emailConfig, setEmailConfig] = useState({
    smtpHost: 'smtp.sendgrid.net',
    smtpPort: '587',
    smtpUser: 'apikey',
    fromName: 'Evokaa',
    fromEmail: 'noreply@evokaa.com.br',
  })

  const [templates] = useState([
    { id: 'welcome', name: 'Boas-vindas', subject: 'Bem-vindo a Evokaa!', status: 'active' },
    { id: 'purchase', name: 'Confirmacao de Compra', subject: 'Seu ingresso esta confirmado', status: 'active' },
    { id: 'reminder', name: 'Lembrete de Evento', subject: 'Seu evento e amanha!', status: 'active' },
    { id: 'payout', name: 'Saque Concluido', subject: 'Seu saque foi processado', status: 'active' },
  ])

  const [moderation, setModeration] = useState({
    bannedWords: 'golpe, fraude, pix falso',
    autoFlag: true,
    requireApproval: true,
    reportThreshold: '3',
  })

  const [logs] = useState([
    { id: 1, type: 'login', user: 'admin@aura.com', ip: '189.45.67.89', date: '2025-06-15 14:32', action: 'Login bem-sucedido' },
    { id: 2, type: 'error', user: 'sistema', ip: '-', date: '2025-06-15 13:15', action: 'Falha na conexao SMTP' },
    { id: 3, type: 'login', user: 'joao@eventos.com', ip: '201.78.34.12', date: '2025-06-15 12:48', action: 'Login bem-sucedido' },
    { id: 4, type: 'action', user: 'admin@aura.com', ip: '189.45.67.89', date: '2025-06-15 11:20', action: 'Aprovou produtor #44' },
    { id: 5, type: 'error', user: 'sistema', ip: '-', date: '2025-06-15 10:05', action: 'Timeout no processamento de pagamento' },
  ])

  const [isLoadingSettings, setIsLoadingSettings] = useState(true)
  const [isSavingSettings, setIsSavingSettings] = useState(false)

  // Carrega configurações reais do banco de dados na inicialização
  useEffect(() => {
    async function loadSettings() {
      try {
        const { data: dbData, error } = await supabase
          .from('system_settings')
          .select('key, value')
        
        if (error) throw error

        if (dbData) {
          dbData.forEach(item => {
            if (item.key === 'general' && item.value) {
              setGeneral(prev => ({ ...prev, ...item.value }))
            } else if (item.key === 'email' && item.value) {
              setEmailConfig(prev => ({ ...prev, ...item.value }))
            } else if (item.key === 'moderation' && item.value) {
              setModeration(prev => ({ ...prev, ...item.value }))
            }
          })
        }
      } catch (err) {
        console.error('[AdminSettings] Erro ao carregar configuracoes:', err)
      } finally {
        setIsLoadingSettings(false)
      }
    }
    loadSettings()
  }, [])

  // Grava as alterações no Supabase de verdade com base na aba (section) ativa
  const handleSave = async () => {
    setIsSavingSettings(true)
    const toastId = toast.loading('Salvando configurações no banco de dados...')
    try {
      let key = ''
      let payload = {}

      if (section === 'geral') {
        key = 'general'
        payload = general
      } else if (section === 'email') {
        key = 'email'
        payload = emailConfig
      } else if (section === 'moderacao') {
        key = 'moderation'
        payload = moderation
      } else {
        toast.dismiss(toastId)
        setIsSavingSettings(false)
        return
      }

      const { error } = await supabase
        .from('system_settings')
        .upsert({ key, value: payload, updated_at: new Date().toISOString() })

      if (error) throw error

      toast.success('Configurações salvas com sucesso!', { id: toastId })
    } catch (err: any) {
      console.error('[AdminSettings] Erro ao salvar configurações:', err)
      toast.error(err.message || 'Erro ao salvar configurações', { id: toastId })
    } finally {
      setIsSavingSettings(false)
    }
  }

  // Exportação Real para CSV das Tabelas
  const handleExport = async (type: string) => {
    const toastId = toast.loading(`Buscando dados de ${type.toLowerCase()}...`)
    try {
      let csvContent = ''
      const filename = `export_${type.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`

      if (type === 'Usuarios') {
        const { data: users, error } = await supabase
          .from('profiles')
          .select('full_name, email, phone, role, created_at')
          .order('created_at', { ascending: false })

        if (error) throw error

        const headers = ['Nome', 'Email', 'Telefone', 'Papel', 'Data de Cadastro']
        const rows = [headers.join(',')]
        users?.forEach(u => {
          rows.push([
            `"${(u.full_name || '').replace(/"/g, '""')}"`,
            `"${(u.email || '').replace(/"/g, '""')}"`,
            `"${(u.phone || '').replace(/"/g, '""')}"`,
            `"${(u.role || '').replace(/"/g, '""')}"`,
            `"${u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : ''}"`
          ].join(','))
        })
        csvContent = rows.join('\n')

      } else if (type === 'Eventos') {
        const { data: events, error } = await supabase
          .from('events')
          .select('title, description, start_date, location, status, created_at')
          .order('created_at', { ascending: false })

        if (error) throw error

        const headers = ['Título', 'Descrição', 'Data de Início', 'Local', 'Status', 'Criado Em']
        const rows = [headers.join(',')]
        events?.forEach(e => {
          rows.push([
            `"${(e.title || '').replace(/"/g, '""')}"`,
            `"${(e.description || '').replace(/"/g, '""')}"`,
            `"${e.start_date ? new Date(e.start_date).toLocaleDateString('pt-BR') : ''}"`,
            `"${(e.location || '').replace(/"/g, '""')}"`,
            `"${(e.status || '').replace(/"/g, '""')}"`,
            `"${e.created_at ? new Date(e.created_at).toLocaleDateString('pt-BR') : ''}"`
          ].join(','))
        })
        csvContent = rows.join('\n')

      } else if (type === 'Transacoes') {
        const { data: orders, error } = await supabase
          .from('orders')
          .select('id, user_id, total_amount, status, payment_method, created_at')
          .order('created_at', { ascending: false })

        if (error) throw error

        const headers = ['ID do Pedido', 'ID do Usuário', 'Valor Total', 'Status', 'Método de Pagamento', 'Data']
        const rows = [headers.join(',')]
        orders?.forEach(o => {
          rows.push([
            `"${o.id}"`,
            `"${o.user_id || ''}"`,
            `"${o.total_amount || 0}"`,
            `"${(o.status || '').replace(/"/g, '""')}"`,
            `"${(o.payment_method || '').replace(/"/g, '""')}"`,
            `"${o.created_at ? new Date(o.created_at).toLocaleDateString('pt-BR') : ''}"`
          ].join(','))
        })
        csvContent = rows.join('\n')

      } else if (type === 'Logs') {
        const { data: logsData, error } = await supabase
          .from('user_activities')
          .select('user_id, session_id, event_type, path, created_at')
          .order('created_at', { ascending: false })

        if (error) throw error

        const headers = ['ID do Usuário', 'ID de Sessão', 'Tipo do Evento', 'Caminho/URL', 'Data/Hora']
        const rows = [headers.join(',')]
        logsData?.forEach(l => {
          rows.push([
            `"${l.user_id || 'Visitante'}"`,
            `"${l.session_id || ''}"`,
            `"${(l.event_type || '').replace(/"/g, '""')}"`,
            `"${(l.path || '').replace(/"/g, '""')}"`,
            `"${l.created_at ? new Date(l.created_at).toLocaleString('pt-BR') : ''}"`
          ].join(','))
        })
        csvContent = rows.join('\n')
      }

      if (!csvContent || csvContent.split('\n').length <= 1) {
        toast.info('Nenhum dado encontrado para exportar.', { id: toastId })
        return
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', filename)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success('Download concluído com sucesso!', { id: toastId })
    } catch (err: any) {
      console.error('[AdminSettings] Erro ao exportar dados:', err)
      toast.error(err.message || 'Erro ao exportar dados', { id: toastId })
    }
  }

  // Validadores seguros de chaves para evitar riscos de bracket notation (Prototype Pollution)
  const getGeneralValue = (key: string): boolean => {
    const allowedKeys: (keyof typeof general)[] = ['maintenance', 'registrationOpen', 'producerApproval'];
    if (allowedKeys.includes(key as keyof typeof general)) {
      return !!general[key as keyof typeof general];
    }
    return false;
  };

  const updateGeneralValue = (key: string, value: boolean) => {
    const allowedKeys: (keyof typeof general)[] = ['maintenance', 'registrationOpen', 'producerApproval'];
    if (allowedKeys.includes(key as keyof typeof general)) {
      setGeneral(prev => ({ ...prev, [key]: value }));
    }
  };

  const getModerationValue = (key: string): boolean => {
    const allowedKeys: (keyof typeof moderation)[] = ['autoFlag', 'requireApproval'];
    if (allowedKeys.includes(key as keyof typeof moderation)) {
      return !!moderation[key as keyof typeof moderation];
    }
    return false;
  };

  const updateModerationValue = (key: string, value: boolean) => {
    const allowedKeys: (keyof typeof moderation)[] = ['autoFlag', 'requireApproval'];
    if (allowedKeys.includes(key as keyof typeof moderation)) {
      setModeration(prev => ({ ...prev, [key]: value }));
    }
  };

  const sidebarItems: { id: Section; label: string; icon: typeof Settings }[] = [
    { id: 'geral', label: 'Geral', icon: Globe },
    { id: 'email', label: 'E-mail', icon: Mail },
    { id: 'moderacao', label: 'Moderacao', icon: Shield },
    { id: 'backup', label: 'Backup', icon: Database },
    { id: 'logs', label: 'Logs', icon: FileText },
    { id: 'seguranca', label: 'Seguranca', icon: Lock },
  ]

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-espresso">Configuracoes</h1>
        <p className="text-sm text-espresso/50 mt-1">Administracao da plataforma</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <div className="lg:w-56 flex-shrink-0">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
            {sidebarItems.map(item => (
              <button key={item.id} onClick={() => setSection(item.id)} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all whitespace-nowrap ${section === item.id ? 'bg-rose-500/10 text-rose-500 font-medium' : 'text-espresso/40 hover:text-espresso hover:bg-white/40'}`}>
                <item.icon className="w-4 h-4" />{item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* GERAL */}
          {section === 'geral' && (
            <div className="space-y-6">
              {/* Perfil do Administrador */}
              <div className="p-5 rounded-2xl bg-white/60 border border-white/60 space-y-4">
                <h3 className="text-sm font-semibold text-espresso">Perfil do Administrador</h3>
                <div className="flex items-center gap-4">
                  <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
                  <img src={user?.avatar_url || user?.avatar || '/images/logo-evokaa.png'} alt="Avatar Admin" className="w-20 h-20 rounded-2xl object-cover ring-2 ring-rose-500/10" />
                  <div>
                    <button onClick={triggerAvatarUpload} className="px-4 py-2 bg-rose-500 text-white text-xs rounded-full hover:shadow-lg hover:shadow-rose-500/20 transition-all">Alterar foto</button>
                    <p className="text-[10px] text-espresso/30 mt-1">Sua foto é exibida no menu lateral. JPG, PNG. Máx 2MB</p>
                  </div>
                </div>
              </div>

              <h2 className="text-lg font-medium text-espresso">Configuracoes Gerais</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="platformName" className="text-xs text-espresso/40 mb-1 block">Nome da Plataforma</label>
                  <input id="platformName" placeholder="Nome da Plataforma" value={general.platformName} onChange={e => setGeneral({ ...general, platformName: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                </div>
                <div>
                  <label htmlFor="tagline" className="text-xs text-espresso/40 mb-1 block">Tagline</label>
                  <input id="tagline" placeholder="Tagline" value={general.tagline} onChange={e => setGeneral({ ...general, tagline: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                </div>
                <div>
                  <label htmlFor="timezone" className="text-xs text-espresso/40 mb-1 block">Timezone</label>
                  <select id="timezone" aria-label="Timezone" value={general.timezone} onChange={e => setGeneral({ ...general, timezone: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30">
                    <option>America/Sao_Paulo</option><option>America/Recife</option><option>America/Manaus</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="currency" className="text-xs text-espresso/40 mb-1 block">Moeda</label>
                  <select id="currency" aria-label="Moeda" value={general.currency} onChange={e => setGeneral({ ...general, currency: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30">
                    <option value="BRL">Real (R$)</option><option value="USD">Dolar ($)</option><option value="EUR">Euro (EUR)</option>
                  </select>
                </div>
              </div>

              {/* APIs E INTEGRAÇÕES DE CEP */}
              <div className="border-t border-espresso/5 pt-4 space-y-4">
                <h3 className="text-sm font-medium text-espresso">Configuração de CEP / Código Postal</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="cepProvider" className="text-xs text-espresso/40 mb-1 block">Provedor de CEP</label>
                    <select
                      id="cepProvider"
                      value={general.cepProvider || 'viacep'}
                      onChange={e => setGeneral({ ...general, cepProvider: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30"
                    >
                      <option value="viacep">ViaCEP (Apenas Brasil - Grátis)</option>
                      <option value="geoapify">Geoapify (Internacional - Requer Key)</option>
                      <option value="google">Google Maps Geocoding (Requer Key)</option>
                      <option value="nominatim">Nominatim OSM (Internacional - Grátis)</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="cepApiKey" className="text-xs text-espresso/40 mb-1 block">Chave da API (API Key)</label>
                    <input
                      id="cepApiKey"
                      type="password"
                      placeholder="Sua chave secreta da API"
                      value={general.cepApiKey || ''}
                      onChange={e => setGeneral({ ...general, cepApiKey: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30"
                    />
                  </div>
                  <div>
                    <label htmlFor="cepApiUrl" className="text-xs text-espresso/40 mb-1 block">URL Customizada da API (Opcional)</label>
                    <input
                      id="cepApiUrl"
                      type="text"
                      placeholder="https://api.provider.com/v1"
                      value={general.cepApiUrl || ''}
                      onChange={e => setGeneral({ ...general, cepApiUrl: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-espresso/5 pt-4 space-y-3">
                <h3 className="text-sm font-medium text-espresso">Controle da Plataforma</h3>
                {[
                  { key: 'maintenance', label: 'Modo manutencao', desc: 'Mostra pagina de manutencao para todos' },
                  { key: 'registrationOpen', label: 'Cadastros abertos', desc: 'Permitir novos usuarios se cadastrarem' },
                  { key: 'producerApproval', label: 'Aprovacao de produtores', desc: 'Produtores precisam ser aprovados manualmente' },
                ].map(item => {
                  const isChecked = getGeneralValue(item.key);
                  return (
                    <div key={item.key} className="flex items-center justify-between p-4 rounded-xl bg-white/60 border border-white/60">
                      <div>
                        <div className="text-sm text-espresso">{item.label}</div>
                        <div className="text-[10px] text-espresso/30">{item.desc}</div>
                      </div>
                      <label htmlFor={`general-${item.key}`} className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" id={`general-${item.key}`} aria-label={item.label} checked={isChecked} onChange={e => updateGeneralValue(item.key, e.target.checked)} className="sr-only peer" />
                        <div className="w-10 h-5 bg-espresso/10 rounded-full peer peer-checked:bg-rose-500 transition-colors" />
                        <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
                      </label>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end">
                <button onClick={handleSave} className="px-6 py-2.5 bg-rose-500 text-white text-sm rounded-full hover:shadow-lg hover:shadow-rose-500/20 transition-all flex items-center gap-2">
                  <Save className="w-4 h-4" />Salvar
                </button>
              </div>
            </div>
          )}

          {/* EMAIL */}
          {section === 'email' && (
            <div className="space-y-6">
              <h2 className="text-lg font-medium text-espresso">Configuracao de E-mail</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="smtpHost" className="text-xs text-espresso/40 mb-1 block">SMTP Host</label>
                  <input id="smtpHost" placeholder="smtp.example.com" value={emailConfig.smtpHost} onChange={e => setEmailConfig({ ...emailConfig, smtpHost: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                </div>
                <div>
                  <label htmlFor="smtpPort" className="text-xs text-espresso/40 mb-1 block">Porta</label>
                  <input id="smtpPort" placeholder="587" value={emailConfig.smtpPort} onChange={e => setEmailConfig({ ...emailConfig, smtpPort: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                </div>
                <div>
                  <label htmlFor="smtpUser" className="text-xs text-espresso/40 mb-1 block">Usuario</label>
                  <input id="smtpUser" placeholder="Usuario SMTP" value={emailConfig.smtpUser} onChange={e => setEmailConfig({ ...emailConfig, smtpUser: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                </div>
                <div>
                  <label htmlFor="smtpPassword" className="text-xs text-espresso/40 mb-1 block flex items-center gap-1"><Lock className="w-3 h-3" />Senha</label>
                  <input id="smtpPassword" placeholder="Senha SMTP" type="password" value="********" readOnly className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                </div>
                <div>
                  <label htmlFor="fromName" className="text-xs text-espresso/40 mb-1 block">Nome do Remetente</label>
                  <input id="fromName" placeholder="Nome do Remetente" value={emailConfig.fromName} onChange={e => setEmailConfig({ ...emailConfig, fromName: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                </div>
                <div>
                  <label htmlFor="fromEmail" className="text-xs text-espresso/40 mb-1 block">E-mail do Remetente</label>
                  <input id="fromEmail" placeholder="remetente@email.com" value={emailConfig.fromEmail} onChange={e => setEmailConfig({ ...emailConfig, fromEmail: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                </div>
              </div>

              <div className="border-t border-espresso/5 pt-4">
                <h3 className="text-sm font-medium text-espresso mb-3">Templates de E-mail</h3>
                <div className="space-y-2">
                  {templates.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-4 rounded-xl bg-white/60 border border-white/60">
                      <div className="flex items-center gap-3">
                        <Mail className="w-4 h-4 text-rose-400" />
                        <div>
                          <div className="text-sm text-espresso">{t.name}</div>
                          <div className="text-[10px] text-espresso/30">{t.subject}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-green-50 text-green-600 text-[10px] rounded-full border border-green-100">{t.status}</span>
                        <button aria-label={`Visualizar template ${t.name}`} className="p-1.5 rounded-lg hover:bg-white text-espresso/20 hover:text-espresso/60 transition-colors"><Eye className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <button onClick={handleSave} className="px-6 py-2.5 bg-rose-500 text-white text-sm rounded-full hover:shadow-lg hover:shadow-rose-500/20 transition-all flex items-center gap-2">
                  <Save className="w-4 h-4" />Salvar
                </button>
              </div>
            </div>
          )}

          {/* MODERACAO */}
          {section === 'moderacao' && (
            <div className="space-y-6">
              <h2 className="text-lg font-medium text-espresso">Moderacao</h2>

              <div>
                <label htmlFor="bannedWords" className="text-xs text-espresso/40 mb-1 block">Palavras Proibidas</label>
                <textarea id="bannedWords" placeholder="palavra1, palavra2" value={moderation.bannedWords} onChange={e => setModeration({ ...moderation, bannedWords: e.target.value })} rows={3} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30 resize-none" />
                <p className="text-[10px] text-espresso/30 mt-1">Separadas por virgula</p>
              </div>

              <div className="space-y-3">
                {[
                  { key: 'autoFlag', label: 'Flag automatico', desc: 'Marcar conteudo com palavras proibidas automaticamente' },
                  { key: 'requireApproval', label: 'Aprovacao manual', desc: 'Reviews e comentarios precisam de aprovacao' },
                ].map(item => {
                  const isChecked = getModerationValue(item.key);
                  return (
                    <div key={item.key} className="flex items-center justify-between p-4 rounded-xl bg-white/60 border border-white/60">
                      <div>
                        <div className="text-sm text-espresso">{item.label}</div>
                        <div className="text-[10px] text-espresso/30">{item.desc}</div>
                      </div>
                      <label htmlFor={`moderation-${item.key}`} className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" id={`moderation-${item.key}`} aria-label={item.label} checked={isChecked} onChange={e => updateModerationValue(item.key, e.target.checked)} className="sr-only peer" />
                        <div className="w-10 h-5 bg-espresso/10 rounded-full peer peer-checked:bg-rose-500 transition-colors" />
                        <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
                      </label>
                    </div>
                  );
                })}

                <div className="flex items-center justify-between p-4 rounded-xl bg-white/60 border border-white/60">
                  <div>
                    <label htmlFor="reportThreshold" className="text-sm text-espresso">Limite de denuncias</label>
                    <div className="text-[10px] text-espresso/30">Bloquear automaticamente apos X denuncias</div>
                  </div>
                  <input id="reportThreshold" placeholder="3" type="number" value={moderation.reportThreshold} onChange={e => setModeration({ ...moderation, reportThreshold: e.target.value })} className="w-16 px-2 py-1 bg-white/60 border border-white/60 rounded-lg text-sm text-espresso text-center focus:outline-none focus:border-plum/30" />
                </div>
              </div>

              <div className="flex justify-end">
                <button onClick={handleSave} className="px-6 py-2.5 bg-rose-500 text-white text-sm rounded-full hover:shadow-lg hover:shadow-rose-500/20 transition-all flex items-center gap-2">
                  <Save className="w-4 h-4" />Salvar
                </button>
              </div>
            </div>
          )}

          {/* BACKUP */}
          {section === 'backup' && (
            <div className="space-y-6">
              <h2 className="text-lg font-medium text-espresso">Backup & Exportacao</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-white/60 border border-white/60">
                  <Database className="w-6 h-6 text-rose-400 mb-3" />
                  <h3 className="text-sm font-medium text-espresso mb-1">Exportar Dados</h3>
                  <p className="text-xs text-espresso/30 mb-4">Download de todos os dados da plataforma</p>
                  <div className="space-y-2">
                    {['Usuarios', 'Eventos', 'Transacoes', 'Logs'].map(item => (
                      <button key={item} onClick={() => handleExport(item)} className="w-full flex items-center justify-between p-3 rounded-lg bg-white/40 hover:bg-white/60 transition-all text-left">
                        <span className="text-xs text-espresso">{item}</span>
                        <span className="text-[10px] text-rose-400">CSV</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white/60 border border-white/60">
                  <RefreshCw className="w-6 h-6 text-rose-400 mb-3" />
                  <h3 className="text-sm font-medium text-espresso mb-1">Backup Automatico</h3>
                  <p className="text-xs text-espresso/30 mb-4">Agendar backups periodicos</p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/40">
                      <label htmlFor="backupFrequency" className="text-xs text-espresso">Frequencia</label>
                      <select id="backupFrequency" aria-label="Frequencia do backup" className="text-xs bg-white/60 border border-white/60 rounded-lg px-2 py-1 text-espresso focus:outline-none">
                        <option>Diario</option><option>Semanal</option><option>Mensal</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/40">
                      <label htmlFor="backupTime" className="text-xs text-espresso">Horario</label>
                      <input id="backupTime" type="time" defaultValue="03:00" className="text-xs bg-white/60 border border-white/60 rounded-lg px-2 py-1 text-espresso focus:outline-none" aria-label="Horario do backup" />
                    </div>
                    <button onClick={() => toast.success('Backup agendado!')} className="w-full py-2 bg-rose-500 text-white text-xs rounded-full hover:shadow-lg hover:shadow-rose-500/20 transition-all flex items-center justify-center gap-1">
                      <RefreshCw className="w-3 h-3" /> Agendar Backup
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* LOGS */}
          {section === 'logs' && (
            <div className="space-y-6">
              <h2 className="text-lg font-medium text-espresso">Logs do Sistema</h2>

              <div className="flex items-center gap-3 mb-4">
                <button className="px-3 py-1.5 bg-rose-50 text-rose-500 text-xs rounded-full border border-rose-100">Todos</button>
                <button className="px-3 py-1.5 bg-white/60 text-espresso/40 text-xs rounded-full border border-white/60 hover:text-espresso">Login</button>
                <button className="px-3 py-1.5 bg-white/60 text-espresso/40 text-xs rounded-full border border-white/60 hover:text-espresso">Erros</button>
                <button className="px-3 py-1.5 bg-white/60 text-espresso/40 text-xs rounded-full border border-white/60 hover:text-espresso">Acoes</button>
              </div>

              <div className="bg-white/60 border border-white/60 rounded-2xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-espresso/5">
                      <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Tipo</th>
                      <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase hidden md:table-cell">Usuario</th>
                      <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase hidden lg:table-cell">IP</th>
                      <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Acao</th>
                      <th className="text-right px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase hidden md:table-cell">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id} className="border-b border-espresso/3 last:border-0 hover:bg-white/40 transition-colors">
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-[10px] rounded-full border ${log.type === 'login' ? 'bg-blue-50 text-blue-600 border-blue-100' : log.type === 'error' ? 'bg-red-50 text-red-500 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
                            {log.type === 'login' ? 'Login' : log.type === 'error' ? 'Erro' : 'Acao'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-espresso hidden md:table-cell">{log.user}</td>
                        <td className="px-4 py-3 text-xs text-espresso/30 hidden lg:table-cell">{log.ip}</td>
                        <td className="px-4 py-3 text-xs text-espresso">{log.action}</td>
                        <td className="px-4 py-3 text-right text-xs text-espresso/30 hidden md:table-cell">{log.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SEGURANCA */}
          {section === 'seguranca' && (
            <div className="space-y-6">
              <h2 className="text-lg font-medium text-espresso">Seguranca</h2>

              <div className="space-y-3">
                {[
                  { label: 'Forcar 2FA para admins', desc: 'Todos os administradores devem usar autenticacao em duas etapas' },
                  { label: 'Bloquear IP suspeito', desc: 'Bloquear automaticamente IPs com multiplas tentativas falhas' },
                  { label: 'Sessao unica', desc: 'Desconectar outras sessoes ao logar em novo dispositivo' },
                  { label: 'Auditoria de acesso', desc: 'Registrar todas as acoes administrativas' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-white/60 border border-white/60">
                    <div>
                      <div className="text-sm text-espresso">{item.label}</div>
                      <div className="text-[10px] text-espresso/30">{item.desc}</div>
                    </div>
                    <label htmlFor={`security-toggle-${i}`} className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" id={`security-toggle-${i}`} defaultChecked={i < 2} aria-label={item.label} className="sr-only peer" />
                      <div className="w-10 h-5 bg-espresso/10 rounded-full peer peer-checked:bg-rose-500 transition-colors" />
                      <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
                    </label>
                  </div>
                ))}
              </div>

              {/* 2FA Pessoal do Admin */}
              <div className="p-4 rounded-xl bg-white/60 border border-white/60 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-espresso">Minha Autenticação de Dois Fatores (2FA)</div>
                  <div className="text-[10px] text-espresso/30">
                    {loadingMfa ? 'Carregando status...' : twoFA ? 'Ativo — Seu login de administrador exige o código do Google Authenticator' : 'Inativo — Ative para proteger sua conta administrativa'}
                  </div>
                </div>
                <button 
                  disabled={loadingMfa}
                  onClick={twoFA ? handleDisableMfa : handleStartEnroll} 
                  className={`relative w-11 h-6 rounded-full transition-colors ${twoFA ? 'bg-rose-500' : 'bg-espresso/10'} disabled:opacity-55`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${twoFA ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-100">
                <h3 className="text-sm font-medium text-amber-700 mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Sessoes Ativas</h3>
                <div className="space-y-2">
                  {[
                    { device: 'Chrome - Windows', ip: '189.45.67.89', current: true },
                    { device: 'Safari - iPhone', ip: '189.45.67.90', current: false },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/60">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${s.current ? 'bg-green-500' : 'bg-amber-400'}`} />
                        <div>
                          <div className="text-xs text-espresso">{s.device}</div>
                          <div className="text-[10px] text-espresso/30">{s.ip}</div>
                        </div>
                      </div>
                      {s.current ? <span className="text-[10px] text-green-600">Atual</span> : <button className="text-[10px] text-red-500 hover:underline">Revogar</button>}
                    </div>
                  ))}
                </div>
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
              <Shield className="w-5 h-5 text-rose-500" /> Configurar Autenticador (2FA)
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
              <code className="text-xs font-mono font-bold tracking-wider select-all break-all text-rose-600">
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
                  className="px-5 py-2 bg-rose-500 text-white text-xs font-medium rounded-full hover:shadow-lg hover:shadow-rose-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
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
