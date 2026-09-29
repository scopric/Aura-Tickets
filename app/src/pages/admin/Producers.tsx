import { useEffect, useState } from 'react'
import { Shield, Building2, BadgeCheck, Calendar, Search, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'

interface Company {
  company_name: string
  cnpj: string
  is_verified: boolean
  commission_rate: number | null
}

interface Producer {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
  company: Company | null // linha em producer_profiles (1:1); null = cadastro de empresa incompleto
  events: number
}

export default function AdminProducers() {
  const [producers, setProducers] = useState<Producer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  const loadData = async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const { data, error } = await supabase
        .from('profiles')
        // events tem duas FKs para profiles: sem o !producer_id o PostgREST devolve PGRST201
        .select('id, email, full_name, avatar_url, created_at, producer_profiles(company_name, cnpj, is_verified, commission_rate), events!producer_id(count)')
        .eq('role', 'producer')
        .order('created_at', { ascending: false })
      if (error) throw error
      setProducers((data || []).map((p: any) => {
        const pp = Array.isArray(p.producer_profiles) ? p.producer_profiles[0] : p.producer_profiles
        const ev = Array.isArray(p.events) ? p.events[0] : p.events
        return { id: p.id, email: p.email, full_name: p.full_name, avatar_url: p.avatar_url, created_at: p.created_at, company: pp || null, events: Number(ev?.count) || 0 }
      }))
    } catch (err: any) {
      setProducers([])
      setLoadError(err?.message || 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const setVerified = async (p: Producer, value: boolean) => {
    if (!value && !window.confirm(`Remover a verificação de ${p.company?.company_name || p.email}?`)) return
    setSavingId(p.id)
    try {
      const { data, error } = await supabase
        .from('producer_profiles')
        .update({ is_verified: value })
        .eq('id', p.id)
        .select('id')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('nenhuma linha foi alterada (regra de acesso ou cadastro inexistente)')
      // profiles.is_verified é o que o app carrega no usuário (authStore); manter os dois iguais
      const { error: profileError } = await supabase.from('profiles').update({ is_verified: value }).eq('id', p.id)
      if (profileError) throw profileError
      toast.success(value ? 'Produtor marcado como verificado.' : 'Verificação removida.')
      await loadData()
    } catch (err: any) {
      toast.error('Não foi possível gravar: ' + (err?.message || 'erro desconhecido'))
    } finally {
      setSavingId(null)
    }
  }

  // 8 de 9 produtores não têm linha em producer_profiles (o cadastro pelo site não cria).
  // A regra de INSERT do admin (docs/sql/20260928_admin_policies.sql) permite criar a linha
  // faltante; o produtor preenche CNPJ e dados bancários depois, em Configurações.
  const createProfile = async (p: Producer) => {
    const company = window.prompt(
      `Criar o cadastro de empresa de ${p.full_name || p.email}?\n\nInforme o nome da empresa (deixe em branco para usar o nome do cadastro).`,
      p.full_name || ''
    )
    if (company === null) return
    setSavingId(p.id)
    try {
      // cnpj é NOT NULL UNIQUE no banco: string vazia colide a partir do 2º cadastro
      // (já existe 1 linha com cnpj='' em produção). Placeholder único até o produtor preencher.
      const { error } = await supabase
        .from('producer_profiles')
        .insert({ id: p.id, company_name: company.trim() || p.full_name || 'Minha Empresa', cnpj: `PENDENTE-${p.id}` })
        .select('id')
      if (error) throw error
      toast.success('Cadastro criado. O produtor pode completar CNPJ e dados em Configurações.')
      await loadData()
    } catch (err: any) {
      toast.error('Não foi possível criar o cadastro: ' + (err?.message || 'erro desconhecido'))
    } finally {
      setSavingId(null)
    }
  }

  const q = search.trim().toLowerCase()
  const filtered = q
    ? producers.filter(p => [p.full_name, p.email, p.company?.company_name].some(v => v?.toLowerCase().includes(q)))
    : producers

  const kpis = [
    { label: 'Produtores', value: producers.length, icon: Shield },
    { label: 'Cadastro de empresa completo', value: producers.filter(p => p.company).length, icon: Building2 },
    { label: 'Verificados', value: producers.filter(p => p.company?.is_verified).length, icon: BadgeCheck },
    { label: 'Eventos no total', value: producers.reduce((s, p) => s + p.events, 0), icon: Calendar },
  ]

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-foreground">Produtores</h1>
        <p className="text-sm text-muted-foreground mt-1">Contas com papel de produtor e a verificação do cadastro de empresa</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map(k => (
          <div key={k.label} className="p-5 rounded-2xl bg-card border border-border">
            <k.icon className="w-4 h-4 text-primary mb-3" />
            <div className="font-serif text-2xl text-foreground">{isLoading ? '…' : k.value}</div>
            <div className="text-[11px] text-muted-foreground mt-1 uppercase tracking-wider">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="relative max-w-md mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome, e-mail ou empresa..."
          aria-label="Buscar produtor"
          className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 transition-colors"
        />
      </div>

      {loadError && (
        <div role="alert" className="mb-4 p-4 rounded-2xl border border-red-200 bg-red-50 text-sm text-red-700 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-300">
          Não foi possível carregar os produtores: {loadError}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {['Produtor', 'Empresa / CNPJ', 'Eventos', 'Verificação', 'Cadastro', ''].map((h, i) => (
                    <th key={i} className={`text-left px-4 py-3 text-[11px] font-medium text-muted-foreground uppercase ${i === 1 ? 'hidden md:table-cell' : i === 2 || i === 4 ? 'hidden lg:table-cell' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground italic">
                      {producers.length === 0 ? 'Nenhum produtor cadastrado.' : 'Nenhum produtor encontrado com essa busca.'}
                    </td>
                  </tr>
                ) : filtered.map(p => {
                  const c = p.company
                  const saving = savingId === p.id
                  return (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={p.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(p.full_name || 'Produtor')}`}
                            alt=""
                            className="w-9 h-9 rounded-full object-cover bg-muted"
                          />
                          <div>
                            <div className="text-sm text-foreground font-medium">{p.full_name || 'Sem nome'}</div>
                            <div className="text-[11px] text-muted-foreground">{p.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {c ? (
                          <div>
                            <div className="text-sm text-foreground">{c.company_name}</div>
                            <div className="text-[11px] text-muted-foreground">CNPJ {c.cnpj.startsWith('PENDENTE-') ? 'a preencher' : c.cnpj}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">cadastro incompleto</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-sm text-foreground">{p.events}</td>
                      <td className="px-4 py-3">
                        {!c ? (
                          <span className="px-2 py-0.5 text-[11px] font-medium rounded-full border bg-muted text-muted-foreground border-border">Sem cadastro</span>
                        ) : c.is_verified ? (
                          <span className="px-2 py-0.5 text-[11px] font-medium rounded-full border bg-green-50 text-green-700 border-green-100 dark:bg-green-500/10 dark:text-green-300 dark:border-green-500/20">Verificado</span>
                        ) : (
                          <span className="px-2 py-0.5 text-[11px] font-medium rounded-full border bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20">Não verificado</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!c && (
                            <button
                              onClick={() => createProfile(p)}
                              disabled={saving}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {saving ? 'Gravando…' : 'Completar cadastro'}
                            </button>
                          )}
                          <button
                            onClick={() => setVerified(p, !c?.is_verified)}
                            disabled={!c || saving}
                            title={!c ? 'Crie o cadastro de empresa primeiro' : undefined}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-foreground disabled:hover:border-border"
                          >
                            {saving ? 'Gravando…' : c?.is_verified ? 'Remover verificação' : 'Verificar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
