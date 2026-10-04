import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { useAuth } from '../../hooks/useAuth'
import { useTwoFactor } from '../../hooks/useTwoFactor'
import { uploadAvatar } from '../../lib/avatarUpload'
import { supabase } from '../../lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Segmented } from '@/components/ui/toggle-group'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState, PageHeader, SectionTitle, selectNativo, chipInfo, chipNeutro, chipOk } from '@/components/producer/ui'
import { Tabela, alertaErro, painel, th } from '@/components/admin/ui'
import { cn } from '@/lib/utils'
import { toCsv, downloadCsv, csvFilename, fetchAllRows } from '../../lib/exportCsv'

type LogFilter = 'all' | 'login' | 'page_view' | 'session_start'
interface Activity { id: string; user_id: string | null; event_type: string; path: string | null; created_at: string; profiles?: { email: string | null } | null }
const LOG_FILTERS: { id: LogFilter; label: string }[] = [
  { id: 'all', label: 'Todos' }, { id: 'login', label: 'Logins' }, { id: 'page_view', label: 'Páginas' }, { id: 'session_start', label: 'Sessões' },
]
const LOG_LABEL: Record<string, string> = { login: 'Login', page_view: 'Página', session_start: 'Sessão' }

// Colunas reais das tabelas (conferidas em produção); o PostgREST devolve no máximo 1.000 linhas por consulta
const EXPORTS: Record<string, { table: string; columns: string[] }> = {
  Usuários: { table: 'profiles', columns: ['id', 'email', 'full_name', 'role', 'created_at'] },
  Eventos: { table: 'events', columns: ['id', 'title', 'venue_name', 'venue_city', 'date', 'status', 'approval_status', 'created_at'] },
  Transações: { table: 'orders', columns: ['id', 'user_id', 'event_id', 'total', 'status', 'payment_method', 'created_at'] },
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
  const [erroLeitura, setErroLeitura] = useState(false) // sem leitura, Salvar gravaria os padrões por cima do banco
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
        setErroLeitura(true)
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

      // ponytail: Geral e Moderação estão desligadas na tela (nada no site lê essas chaves); estes ramos voltam a valer na E11
      if (section === 'geral') {
        key = 'general'
        payload = { ...general, currency: 'BRL' }
      } else if (section === 'moderacao') {
        key = 'moderation'
        payload = moderation
      } else {
        toast.dismiss(toastId)
        setIsSavingSettings(false)
        return
      }

      const { data, error } = await supabase
        .from('platform_settings')
        .upsert({ key, value: payload, updated_at: new Date().toISOString() }, { onConflict: 'key' }) // a chave única é `key`, não o id
        .select('id')

      if (error) throw error
      if (!data?.length) throw new Error('Nada foi gravado: sua conta não tem permissão para esta configuração.')

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

  const sidebarItems: { id: Section; label: string; icon: I.IconeEvokaa }[] = [
    { id: 'geral', label: 'Geral', icon: I.Globo },
    { id: 'email', label: 'E-mail', icon: I.Email },
    { id: 'moderacao', label: 'Moderação', icon: I.Escudo },
    { id: 'backup', label: 'Backup', icon: I.BancoDeDados },
    { id: 'logs', label: 'Logs', icon: I.Documento },
    { id: 'seguranca', label: 'Segurança', icon: I.Cadeado },
  ]

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <PageHeader title="Configurações" description="Administração da plataforma" />
      {erroLeitura && (
        <div role="alert" className={cn(alertaErro, 'mb-6')}>
          Não foi possível ler as configurações; salvar agora gravaria os valores padrão por cima.
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <nav aria-label="Seções das configurações" className="lg:w-56 flex-shrink-0">
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:flex-col lg:overflow-visible">
            {sidebarItems.map(item => (
              <Button
                key={item.id}
                variant={section === item.id ? 'secondary' : 'ghost'}
                aria-pressed={section === item.id}
                onClick={() => setSection(item.id)}
                className={cn('shrink-0 justify-start', section !== item.id && 'text-muted-foreground hover:text-foreground')}
              >
                <item.icon aria-hidden="true" />{item.label}
              </Button>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* GERAL */}
          {section === 'geral' && (
            <div className="space-y-6">
              {/* Perfil do Administrador */}
              <section className={cn(painel, 'space-y-4 p-4 sm:p-6')}>
                <SectionTitle>Perfil do Administrador</SectionTitle>
                <div className="flex items-center gap-4">
                  <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} aria-label="Escolher foto" />
                  <img src={user?.avatar_url || user?.avatar || '/images/logo-evokaa-sm.png'} alt="Avatar Admin" className="size-20 rounded-[10px] border border-border object-cover" />
                  <div>
                    <Button variant="outline" size="sm" onClick={triggerAvatarUpload}>Alterar foto</Button>
                    <p className="mt-1 text-xs text-muted-foreground">Sua foto é exibida no menu lateral. JPG, PNG. Máx 2MB</p>
                  </div>
                </div>
              </section>

              <section className={cn(painel, 'space-y-6 p-4 sm:p-6')}>
                <SectionTitle>Configurações Gerais</SectionTitle>
                <p id="aviso-geral" className="text-xs text-muted-foreground">Ainda não funciona: nenhum destes campos é lido pelo site (a moeda é sempre Real). Ligar cada um é a fase E11.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="platformName">Nome da Plataforma</Label>
                    <Input id="platformName" placeholder="Nome da Plataforma" value={general.platformName} onChange={e => setGeneral({ ...general, platformName: e.target.value })} disabled aria-describedby="aviso-geral" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="tagline">Tagline</Label>
                    <Input id="tagline" placeholder="Tagline" value={general.tagline} onChange={e => setGeneral({ ...general, tagline: e.target.value })} disabled aria-describedby="aviso-geral" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="timezone">Timezone</Label>
                    <select id="timezone" aria-label="Timezone" value={general.timezone} onChange={e => setGeneral({ ...general, timezone: e.target.value })} className={selectNativo} disabled aria-describedby="aviso-geral">
                      <option>America/Sao_Paulo</option><option>America/Recife</option><option>America/Manaus</option>
                    </select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="currency">Moeda</Label>
                    <p id="currency" className="text-sm text-muted-foreground">Real (R$) — única moeda aceita por enquanto</p>
                  </div>
                </div>

                <div className="space-y-3 border-t border-border pt-4">
                  <h3 className="text-sm font-medium text-foreground">Controle da Plataforma</h3>
                  {[
                    { key: 'maintenance', label: 'Modo manutenção', desc: 'Mostra página de manutenção para todos' },
                    { key: 'registrationOpen', label: 'Cadastros abertos', desc: 'Permitir novos usuários se cadastrarem' },
                    { key: 'producerApproval', label: 'Aprovação de produtores', desc: 'Produtores precisam ser aprovados manualmente' },
                  ].map(item => (
                    <div key={item.key} className="flex items-center justify-between gap-4 rounded-[10px] border border-border bg-secondary p-4">
                      <div className="min-w-0">
                        <Label htmlFor={`general-${item.key}`} className="text-sm text-foreground">{item.label}</Label>
                        <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                      <Switch id={`general-${item.key}`} aria-label={item.label} checked={getGeneralValue(item.key)} onCheckedChange={v => updateGeneralValue(item.key, v)} disabled aria-describedby="aviso-geral" />
                    </div>
                  ))}
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSave} loading={isSavingSettings} disabled aria-describedby="aviso-geral">
                    <I.Guardar aria-hidden="true" />Salvar
                  </Button>
                </div>
              </section>
            </div>
          )}

          {/* EMAIL: somente leitura; nada aqui é editável nem gravado no banco */}
          {section === 'email' && (
            <div className="space-y-6">
              <SectionTitle>Configuração de E-mail</SectionTitle>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <section className={cn(painel, 'space-y-3 p-4 sm:p-6')}>
                  <h3 className="flex items-center gap-2 text-sm font-medium text-foreground"><I.Email size={16} className="text-primary" aria-hidden="true" />Provedor</h3>
                  <dl className="text-xs space-y-2">
                    <div><dt className="text-muted-foreground">Serviço</dt><dd className="text-foreground">Resend</dd></div>
                    <div><dt className="text-muted-foreground">Função de envio</dt><dd className="text-foreground"><code>send-email</code> (Supabase Edge Function, publicada, versão 13, exige JWT)</dd></div>
                    <div><dt className="text-muted-foreground">Remetente</dt><dd className="text-foreground">Evokaa Tickets &lt;ingressos@evokaa.com.br&gt;</dd></div>
                  </dl>
                  <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><I.Cadeado size={14} className="mt-px shrink-0" aria-hidden="true" />A chave <code>RESEND_API_KEY</code> fica só nos segredos da Edge Function: nunca no navegador nem nesta tela.</p>
                  <div className="flex flex-wrap gap-3 pt-1 text-xs">
                    <a href="https://resend.com/emails" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Painel do Resend</a>
                    <a href="https://supabase.com/dashboard/project/rwaezeqyuhxrssntcxdv/functions" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Funções no Supabase</a>
                  </div>
                </section>

                <section className={cn(painel, 'space-y-3 p-4 sm:p-6')}>
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
                  <p className="text-xs text-muted-foreground">Em construção na fase A2c.</p>
                </section>
              </div>
            </div>
          )}

          {/* MODERACAO */}
          {section === 'moderacao' && (
            <section className={cn(painel, 'space-y-6 p-4 sm:p-6')}>
              <SectionTitle>Moderação</SectionTitle>
              <p id="aviso-moderacao" className="text-xs text-muted-foreground">Ainda não funciona: salvar não muda nada no site.</p>

              <div className="grid gap-1.5">
                <Label htmlFor="bannedWords">Palavras Proibidas</Label>
                <Textarea id="bannedWords" placeholder="palavra1, palavra2" value={moderation.bannedWords} onChange={e => setModeration({ ...moderation, bannedWords: e.target.value })} rows={3} className="resize-none" disabled aria-describedby="aviso-moderacao" />
                <p className="text-xs text-muted-foreground">Separadas por virgula</p>
              </div>

              <div className="space-y-3">
                {[
                  { key: 'autoFlag', label: 'Flag automático', desc: 'Marcar conteúdo com palavras proibidas automaticamente' },
                  { key: 'requireApproval', label: 'Aprovação manual', desc: 'Reviews e comentários precisam de aprovação' },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between gap-4 rounded-[10px] border border-border bg-secondary p-4">
                    <div className="min-w-0">
                      <Label htmlFor={`moderation-${item.key}`} className="text-sm text-foreground">{item.label}</Label>
                      <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch id={`moderation-${item.key}`} aria-label={item.label} checked={getModerationValue(item.key)} onCheckedChange={v => updateModerationValue(item.key, v)} disabled aria-describedby="aviso-moderacao" />
                  </div>
                ))}

                <div className="flex items-center justify-between gap-4 rounded-[10px] border border-border bg-secondary p-4">
                  <div className="min-w-0">
                    <Label htmlFor="reportThreshold" className="text-sm text-foreground">Limite de denúncias</Label>
                    <p className="mt-1 text-xs text-muted-foreground">Bloquear automaticamente após X denúncias</p>
                  </div>
                  <Input id="reportThreshold" placeholder="3" type="number" value={moderation.reportThreshold} onChange={e => setModeration({ ...moderation, reportThreshold: e.target.value })} className="w-20 text-center" disabled aria-describedby="aviso-moderacao" />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSave} loading={isSavingSettings} disabled>
                  <I.Guardar aria-hidden="true" />Salvar
                </Button>
              </div>
            </section>
          )}

          {/* BACKUP */}
          {section === 'backup' && (
            <div className="space-y-6">
              <SectionTitle>Backup & Exportação</SectionTitle>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <section className={cn(painel, 'p-4 sm:p-6')}>
                  <I.BancoDeDados size={24} className="mb-3 text-primary" aria-hidden="true" />
                  <h3 className="mb-1 text-sm font-medium text-foreground">Exportar Dados</h3>
                  <p className="mb-4 text-xs text-muted-foreground">Extrato parcial em CSV: só o que a regra de acesso deixa o admin ler</p>
                  <div className="space-y-2">
                    {Object.keys(EXPORTS).map(item => (
                      <Button key={item} variant="outline" onClick={() => handleExport(item)} className="w-full justify-between">
                        <span>{item}</span>
                        <span className="text-xs font-medium text-primary">CSV</span>
                      </Button>
                    ))}
                  </div>
                </section>

                <section className={cn(painel, 'space-y-3 p-4 sm:p-6')}>
                  <I.Alerta size={24} className="mb-1 text-[var(--ev-warning)]" aria-hidden="true" />
                  <h3 className="text-sm font-medium text-foreground">Backup completo</h3>
                  <p className="text-xs text-muted-foreground">O plano gratuito do Supabase não faz backup ("Not included").</p>
                  <p className="text-xs text-muted-foreground">O backup semanal completo é feito por uma GitHub Action (<code>.github/workflows/backup.yml</code>, <code>supabase db dump</code>) e guardado <strong>cifrado (AES-256)</strong> como artefato do repositório, que é público: sem a frase-senha o arquivo não abre. Se o workflow ainda não existir no repositório, o backup automático ainda não está ativo.</p>
                  <p className="text-xs text-muted-foreground">As exportações ao lado são um extrato parcial, não substituem o backup.</p>
                </section>
              </div>
            </div>
          )}

          {/* LOGS: user_activities (session_start, page_view, login) */}
          {section === 'logs' && (
            <div className="space-y-6">
              <SectionTitle>Logs do Sistema</SectionTitle>

              <Segmented label="Filtrar por tipo" items={LOG_FILTERS.map(f => ({ value: f.id, label: f.label }))} value={logFilter} onValueChange={v => setLogFilter(v as LogFilter)} className="w-full sm:w-80" />

              {logsError && (
                <div role="alert" className={alertaErro}>
                  Não foi possível carregar os logs: {logsError}
                </div>
              )}

              <div className={cn(painel, 'overflow-hidden')}>
                {isLoadingLogs ? (
                  <div className="flex justify-center py-12"><Spinner className="size-6 text-primary" /></div>
                ) : activities.length === 0 && !logsError ? (
                  <div className="p-4"><EmptyState title="Nenhum registro encontrado." /></div>
                ) : (
                  <Tabela label="Logs do sistema">
                    <thead>
                      <tr className="border-b border-border">
                        <th className={th}>Tipo</th>
                        <th className={cn(th, 'hidden md:table-cell')}>Usuário</th>
                        <th className={th}>Caminho</th>
                        <th className={cn(th, 'hidden md:table-cell text-right')}>Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activities.map(log => (
                        <tr key={log.id} className="border-b border-border last:border-0 transition-colors hover:bg-secondary/60">
                          <td className="px-4 py-3">
                            <Badge variant="secondary" className={log.event_type === 'login' ? chipInfo : log.event_type === 'session_start' ? chipOk : chipNeutro}>
                              {LOG_LABEL[log.event_type] || log.event_type}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-foreground hidden md:table-cell font-mono">{log.profiles?.email || log.user_id || 'Visitante'}</td>
                          <td className="px-4 py-3 text-xs text-foreground break-all">{log.path || '—'}</td>
                          <td className="px-4 py-3 text-right text-xs tabular-nums text-muted-foreground hidden md:table-cell whitespace-nowrap">{new Date(log.created_at).toLocaleString('pt-BR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Tabela>
                )}
              </div>
              {!isLoadingLogs && activities.length === 200 && (
                <p className="text-xs text-muted-foreground">Mostrando os 200 registros mais recentes. Para o histórico completo, exporte na aba Backup.</p>
              )}
            </div>
          )}

          {/* SEGURANCA */}
          {section === 'seguranca' && (
            <div className="space-y-6">
              <SectionTitle>Segurança</SectionTitle>

              {/* 2FA Pessoal do Admin */}
              <div className={cn(painel, 'flex items-center justify-between gap-4 p-4')}>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">Minha Autenticação de Dois Fatores (2FA)</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {mfa.loading ? 'Carregando status...' : mfa.enabled ? 'Ativo — Seu login de administrador exige o código do Google Authenticator' : 'Inativo — Ative para proteger sua conta administrativa'}
                  </div>
                </div>
                <Switch checked={mfa.enabled} onCheckedChange={() => mfa.toggle()} disabled={mfa.loading} aria-label="Autenticação de dois fatores" />
              </div>
            </div>
          )}
        </div>
      </div>

      {mfa.modal}
    </div>
  )
}
