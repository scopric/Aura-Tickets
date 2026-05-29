import { useState } from 'react'
import { toast } from 'sonner'
import {
  Settings, Globe, Mail, Shield, Save,
  AlertTriangle, Database, FileText, RefreshCw, Lock, Eye
} from 'lucide-react'

type Section = 'geral' | 'email' | 'moderacao' | 'backup' | 'logs' | 'seguranca'

export default function AdminSettingsPage() {
  const [section, setSection] = useState<Section>('geral')

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

  const [emailConfig, setEmailConfig] = useState({
    smtpHost: 'smtp.sendgrid.net',
    smtpPort: '587',
    smtpUser: 'apikey',
    fromName: 'Evokaa',
    fromEmail: 'noreply@evokaa.events',
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

  const handleSave = () => {
    toast.success('Configuracoes salvas!')
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
                      <button key={item} onClick={() => toast.success(`Exportando ${item.toLowerCase()}...`)} className="w-full flex items-center justify-between p-3 rounded-lg bg-white/40 hover:bg-white/60 transition-all text-left">
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
    </div>
  )
}
