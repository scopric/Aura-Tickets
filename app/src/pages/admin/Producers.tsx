import { useEffect, useState } from 'react'
import { iniciais } from '../../hooks/useConversas'
import * as I from '@/components/icones/evokaa16'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState, PageHeader, Stat, chipAviso, chipNeutro, chipOk } from '@/components/producer/ui'
import { Tabela, alertaErro, painel, th } from '@/components/admin/ui'
import { cn } from '@/lib/utils'
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
    { label: 'Produtores', value: producers.length },
    { label: 'Cadastro de empresa completo', value: producers.filter(p => p.company).length },
    { label: 'Verificados', value: producers.filter(p => p.company?.is_verified).length },
    { label: 'Eventos no total', value: producers.reduce((s, p) => s + p.events, 0) },
  ]

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      <PageHeader title="Produtores" description="Contas com papel de produtor e a verificação do cadastro de empresa" />

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map(k => <Stat key={k.label} label={k.label} value={isLoading ? '…' : k.value} />)}
      </div>

      <div className="relative mb-6 max-w-md">
        <I.Buscar size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome, e-mail ou empresa..."
          aria-label="Buscar produtor"
          className="pl-9"
        />
      </div>

      {loadError && (
        <div role="alert" className={cn(alertaErro, 'mb-4')}>
          Não foi possível carregar os produtores: {loadError}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner className="size-6 text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={producers.length === 0 ? 'Nenhum produtor cadastrado.' : 'Nenhum produtor encontrado com essa busca.'}
          description={producers.length === 0 ? undefined : 'Tente outro nome, e-mail ou empresa.'}
        />
      ) : (
        <div className={`${painel} overflow-hidden`}>
          <Tabela label="Lista de produtores">
            <thead>
              <tr className="border-b border-border">
                {['Produtor', 'Empresa / CNPJ', 'Eventos', 'Verificação', 'Cadastro', ''].map((h, i) => (
                  <th key={i} className={cn(th, i === 1 ? 'hidden md:table-cell' : i === 2 || i === 4 ? 'hidden lg:table-cell' : '')}>{h || <span className="sr-only">Ações</span>}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const c = p.company
                const saving = savingId === p.id
                return (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-[var(--ev-tint-hover)]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {/* sem foto: iniciais locais (o nome não vai mais a api.dicebear.com; LGPD) */}
                        {p.avatar_url
                          ? <img src={p.avatar_url} alt="" className="size-9 rounded-full bg-muted object-cover" />
                          : <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">{iniciais(p.full_name || 'Produtor')}</span>}
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground">{p.full_name || 'Sem nome'}</div>
                          <div className="text-xs text-muted-foreground">{p.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      {c ? (
                        <div>
                          <div className="text-sm text-foreground">{c.company_name}</div>
                          <div className="text-xs text-muted-foreground">CNPJ {c.cnpj.startsWith('PENDENTE-') ? 'a preencher' : c.cnpj}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">cadastro incompleto</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-sm tabular-nums text-foreground lg:table-cell">{p.events}</td>
                    <td className="px-4 py-3">
                      {!c ? (
                        <Badge variant="secondary" className={chipNeutro}>Sem cadastro</Badge>
                      ) : c.is_verified ? (
                        <Badge variant="secondary" className={chipOk}><I.Verificado />Verificado</Badge>
                      ) : (
                        <Badge variant="secondary" className={chipAviso}>Não verificado</Badge>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-xs tabular-nums text-muted-foreground lg:table-cell">{new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!c && (
                          <Button variant="outline" size="sm" onClick={() => createProfile(p)} loading={saving}>
                            Completar cadastro
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setVerified(p, !c?.is_verified)}
                          disabled={!c}
                          loading={saving}
                          title={!c ? 'Crie o cadastro de empresa primeiro' : undefined}
                        >
                          {c?.is_verified ? 'Remover verificação' : 'Verificar'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </Tabela>
        </div>
      )}
    </div>
  )
}
