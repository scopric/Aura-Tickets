import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Settings, Globe, Mail, Shield, Save,
  AlertTriangle, Database, FileText, Lock,
  Loader2
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useTwoFactor } from '../../hooks/useTwoFactor'
import { uploadAvatar } from '../../lib/avatarUpload'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/button'
import { toCsv, downloadCsv, csvFilename, fetchAllRows } from '../../lib/exportCsv'

type LogFilter = 'all' | 'login' | 'page_view' | 'session_start'
interface Activity { id: string; user_id: string | null; event_type: string; path: string | null; created_at: string; profiles?: { email: string | null } | null }
const LOG_FILTERS: { id: LogFilter; label: string }[] = [
  { id: 'all', label: 'Todos' }, { id: 'login', label: 'Logins' }, { id: 'page_view', label: 'Páginas' }, { id: 'session_start', label: 'Sessões' },
]
const LOG_LABEL: Record<string, string> = { login: 'Login', page_view: 'Página', session_start: 'Sessão' }

// Colunas reais das tabelas (conferidas em produção); o PostgREST devolve no máximo 1.000 linhas por consulta
const EXPORTS: Record<string, { table: string; columns: string[] }> = {
  Usuarios: { table: 'profiles', columns: ['id', 'email', 'full_name', 'role', 'created_at'] },
  Eventos: { table: 'events', columns: ['id', 'title', 'venue_name', 'venue_city', 'date', 'status', 'approval_status', 'created_at'] },
  Transacoes: { table: 'orders', columns: ['id', 'user_id', 'event_id', 'total', 'status', 'payment_method', 'created_at'] },
  Logs: { table: 'user_activities', columns: ['id', 'user_id', 'session_id', 'event_type', 'path', 'created_at'] },
}

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

  const mfa = useTwoFactor()

  const [general, setGeneral] = useState({
    platformName: 'Evokaa',
    tagline: 'Plataforma de Experiencias',
    timezone: 'America/Sao_Paulo',
    currency: 'BRL',
    language: 'pt-BR',
    maintenance: false,
    registrationOpen: true,
    producerApproval: true,
  })

  const [moderation, setModeration] = useState({
    bannedWords: 'golpe, fraude, pix falso',
    autoFlag: true,
    requireApproval: true,
    reportThreshold: '3',
  })

  const [isLoadingSettings, setIsLoadingSettings] = useState(true)
  const [isSavingSettings, setIsSavingSettings] = useState(false)

  // Logs reais (user_activities): últimos 200, filtrados por event_type no servidor
  const [logFilter, setLogFilter] = useState<LogFilter>('all')
  const [activities, setActivities] = useState<Activity[]>([])
  const [logsError, setLogsError] = useState('')
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)

  useEffect(() => {
    if (section !== 'logs') return
    let cancelled = false
    async function loadLogs() {
      setIsLoadingLogs(true)
      setLogsError('')
      const query = (select: string) => {
        let q = supabase.from('user_activities').select(select).order('created_at', { ascending: false }).limit(200)
        if (logFilter !== 'all') q = q.eq('event_type', logFilter)
        return q
      }
      // Tenta com o e-mail via embed; se a relação não existir, cai para só o user_id
      let res: { data: any[] | null; error: any } = await query('id, user_id, event_type, path, created_at, profiles(email)')
      if (res.error) res = await query('id, user_id, event_type, path, created_at')
      if (cancelled) return
      if (res.error) setLogsError(res.error.message || 'Erro ao carregar os logs')
      else setActivities((res.data || []) as Activity[])
      setIsLoadingLogs(false)
    }
    loadLogs()
    return () => { cancelled = true }
  }, [section, logFilter])

  // Carrega configurações reais do banco de dados na inicialização
  useEffect(() => {
    async function loadSettings() {
      try {
        const { data: dbData, error } = await supabase
          .from('platform_settings')
          .select('key, value')
        
        if (error) throw error

        if (dbData) {
          dbData.forEach(item => {
            if (item.key === 'general' && item.value) {
              // A linha `general` é lida no navegador pelo checkout: chave de CEP não pode ficar nela (e some no próximo Salvar)
              const { cepProvider: _p, cepApiKey: _k, cepApiUrl: _u, ...rest } = item.value as Record<string, unknown>
              setGeneral(prev => ({ ...prev, ...rest }))
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
      } else if (section === 'moderacao') {
        key = 'moderation'
        payload = moderation
      } else {
        toast.dismiss(toastId)
        setIsSavingSettings(false)
        return
      }

      const { error } = await supabase
        .from('platform_settings')
        .upsert({ key, value: payload, updated_at: new Date().toISOString() }, { onConflict: 'key' }) // a chave única é `key`, não o id

      if (error) throw error

      toast.success('Configurações salvas com sucesso!', { id: toastId })
    } catch (err: any) {
      console.error('[AdminSettings] Erro ao salvar configurações:', err)
      toast.error(err.message || 'Erro ao salvar configurações', { id: toastId })
    } finally {
      setIsSavingSettings(false)
    }
  }

  // Exportação CSV paginada (só o que a regra de acesso deixa o admin ler; erro real no toast)
  const handleExport = async (type: string) => {
    const { table, columns } = EXPORTS[type]
    const toastId = toast.loading(`Buscando ${table}...`)
    try {
      const rows = await fetchAllRows<Record<string, unknown>>((from, to) =>
        supabase.from(table).select(columns.join(', ')).order('created_at', { ascending: false }).order('id').range(from, to) as any
      )
      if (rows.length === 0) {
        toast.info(`Nenhuma linha em ${table} para exportar (ou o admin ainda não tem regra de leitura nessa tabela).`, { id: toastId })
        return
      }
      downloadCsv(csvFilename(table), toCsv(rows, columns))
      toast.success(`${rows.length} linha(s) de ${table} exportada(s).`, { id: toastId })
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
                <button onClick={handleSave} disabled={isSavingSettings} className="px-6 py-2.5 bg-rose-500 text-white text-sm rounded-full hover:shadow-lg hover:shadow-rose-500/20 transition-all flex items-center gap-2 disabled:opacity-50">
                  <Save className="w-4 h-4" />Salvar
                </button>
              </div>
            </div>
          )}

          {/* EMAIL: somente leitura; nada aqui é editável nem gravado no banco */}
          {section === 'email' && (
            <div className="space-y-6">
              <h2 className="text-lg font-medium text-espresso">Configuracao de E-mail</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-card border border-border space-y-3">
                  <h3 className="text-sm font-medium text-foreground flex items-center gap-2"><Mail className="w-4 h-4 text-rose-400" />Provedor</h3>
                  <dl className="text-xs space-y-2">
                    <div><dt className="text-muted-foreground">Serviço</dt><dd className="text-foreground">Resend</dd></div>
                    <div><dt className="text-muted-foreground">Função de envio</dt><dd className="text-foreground"><code>send-email</code> (Supabase Edge Function, publicada, versão 13, exige JWT)</dd></div>
                    <div><dt className="text-muted-foreground">Remetente</dt><dd className="text-foreground">Evokaa Tickets &lt;ingressos@evokaa.com.br&gt;</dd></div>
                  </dl>
                  <p className="text-[11px] text-muted-foreground flex items-start gap-1.5"><Lock className="w-3 h-3 mt-0.5 shrink-0" />A chave <code>RESEND_API_KEY</code> fica só nos segredos da Edge Function: nunca no navegador nem nesta tela.</p>
                  <div className="flex flex-wrap gap-3 pt-1 text-xs">
                    <a href="https://resend.com/emails" target="_blank" rel="noopener noreferrer" className="text-rose-500 hover:underline">Painel do Resend</a>
                    <a href="https://supabase.com/dashboard/project/rwaezeqyuhxrssntcxdv/functions" target="_blank" rel="noopener noreferrer" className="text-rose-500 hover:underline">Funções no Supabase</a>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-card border border-border space-y-3">
                  <h3 className="text-sm font-medium text-foreground">O que dispara e-mail hoje</h3>
                  <ul className="text-xs text-foreground space-y-1.5 list-disc pl-4">
                    <li>Formulário de contato do site (<code>useContact.ts</code> → contato@evokaa.com.br)</li>
                  </ul>
                  <h3 className="text-sm font-medium text-foreground pt-2">Ainda não disparam</h3>
                  <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
                    <li>Confirmação de pedido</li>
                    <li>Ingressos</li>
                    <li>Newsletter</li>
                  </ul>
                  <p className="text-[11px] text-muted-foreground">Em construção na fase A2c.</p>
                </div>
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
                <button onClick={handleSave} disabled={isSavingSettings} className="px-6 py-2.5 bg-rose-500 text-white text-sm rounded-full hover:shadow-lg hover:shadow-rose-500/20 transition-all flex items-center gap-2 disabled:opacity-50">
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
                <div className="p-5 rounded-2xl bg-card border border-border">
                  <Database className="w-6 h-6 text-rose-400 mb-3" />
                  <h3 className="text-sm font-medium text-foreground mb-1">Exportar Dados</h3>
                  <p className="text-xs text-muted-foreground mb-4">Extrato parcial em CSV: só o que a regra de acesso deixa o admin ler</p>
                  <div className="space-y-2">
                    {Object.keys(EXPORTS).map(item => (
                      <button key={item} onClick={() => handleExport(item)} className="w-full flex items-center justify-between p-3 rounded-lg bg-white/40 hover:bg-white/60 transition-all text-left">
                        <span className="text-xs text-espresso">{item}</span>
                        <span className="text-[10px] text-rose-400">CSV</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-card border border-border space-y-3">
                  <AlertTriangle className="w-6 h-6 text-amber-500 mb-1" />
                  <h3 className="text-sm font-medium text-foreground">Backup completo</h3>
                  <p className="text-xs text-muted-foreground">O plano gratuito do Supabase não faz backup ("Not included").</p>
                  <p className="text-xs text-muted-foreground">O backup semanal completo é feito por uma GitHub Action (<code>.github/workflows/backup.yml</code>, <code>supabase db dump</code>) e guardado <strong>cifrado (AES-256)</strong> como artefato do repositório, que é público: sem a frase-senha o arquivo não abre. Se o workflow ainda não existir no repositório, o backup automático ainda não está ativo.</p>
                  <p className="text-xs text-muted-foreground">As exportações ao lado são um extrato parcial, não substituem o backup.</p>
                </div>
              </div>
            </div>
          )}

          {/* LOGS: user_activities (session_start, page_view, login) */}
          {section === 'logs' && (
            <div className="space-y-6">
              <h2 className="text-lg font-medium text-espresso">Logs do Sistema</h2>

              <div className="flex items-center gap-2 mb-4" role="group" aria-label="Filtrar por tipo">
                {LOG_FILTERS.map(f => (
                  <Button key={f.id} type="button" size="sm" variant={logFilter === f.id ? 'default' : 'outline'} aria-pressed={logFilter === f.id} onClick={() => setLogFilter(f.id)} className="rounded-full">
                    {f.label}
                  </Button>
                ))}
              </div>

              {logsError && (
                <div role="alert" className="p-4 rounded-2xl border border-red-200 bg-red-50 text-sm text-red-700 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-300">
                  Não foi possível carregar os logs: {logsError}
                </div>
              )}

              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                {isLoadingLogs ? (
                  <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-rose-400" /></div>
                ) : activities.length === 0 && !logsError ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">Nenhum registro encontrado.</div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left px-4 py-3 text-[10px] font-medium text-muted-foreground uppercase">Tipo</th>
                        <th className="text-left px-4 py-3 text-[10px] font-medium text-muted-foreground uppercase hidden md:table-cell">Usuario</th>
                        <th className="text-left px-4 py-3 text-[10px] font-medium text-muted-foreground uppercase">Caminho</th>
                        <th className="text-right px-4 py-3 text-[10px] font-medium text-muted-foreground uppercase hidden md:table-cell">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activities.map(log => (
                        <tr key={log.id} className="border-b border-border last:border-0 hover:bg-white/40 transition-colors">
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 text-[10px] rounded-full border ${log.event_type === 'login' ? 'bg-blue-50 text-blue-600 border-blue-100' : log.event_type === 'session_start' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-espresso/5 text-espresso/60 border-espresso/10'}`}>
                              {LOG_LABEL[log.event_type] || log.event_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-foreground hidden md:table-cell font-mono">{log.profiles?.email || log.user_id || 'Visitante'}</td>
                          <td className="px-4 py-3 text-xs text-foreground break-all">{log.path || '—'}</td>
                          <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden md:table-cell whitespace-nowrap">{new Date(log.created_at).toLocaleString('pt-BR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {!isLoadingLogs && activities.length === 200 && (
                <p className="text-[11px] text-muted-foreground">Mostrando os 200 registros mais recentes. Para o histórico completo, exporte na aba Backup.</p>
              )}
            </div>
          )}

          {/* SEGURANCA */}
          {section === 'seguranca' && (
            <div className="space-y-6">
              <h2 className="text-lg font-medium text-espresso">Seguranca</h2>

              {/* 2FA Pessoal do Admin */}
              <div className="p-4 rounded-xl bg-white/60 border border-white/60 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-espresso">Minha Autenticação de Dois Fatores (2FA)</div>
                  <div className="text-[10px] text-espresso/30">
                    {mfa.loading ? 'Carregando status...' : mfa.enabled ? 'Ativo — Seu login de administrador exige o código do Google Authenticator' : 'Inativo — Ative para proteger sua conta administrativa'}
                  </div>
                </div>
                <button 
                  disabled={mfa.loading}
                  aria-label={mfa.enabled ? 'Desativar 2FA' : 'Ativar 2FA'}
                  aria-pressed={mfa.enabled}
                  onClick={mfa.toggle} 
                  className={`relative w-11 h-6 rounded-full transition-colors ${mfa.enabled ? 'bg-rose-500' : 'bg-espresso/10'} disabled:opacity-55`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${mfa.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {mfa.modal}
    </div>
  )
}
