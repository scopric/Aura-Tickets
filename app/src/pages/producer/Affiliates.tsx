import { useState } from 'react'
import { UserPlus, X, Search, Edit3 } from 'lucide-react'
import { toast } from 'sonner'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useProducerEvents } from '../../hooks/useEvents'
import { mensagemVinculo } from '../../lib/afiliados'
import { brl } from '../../lib/taxa'

// Colunas da listar_afiliados (B3): sem nome nem uuid do afiliado até existir o aceite dele (DECISÕES 13)
interface Afiliado {
  id: string
  email_mascarado: string
  commission_percent: number
  status: 'active' | 'inactive'
  event_id: string | null
  evento: string | null
  sales: number
  total_earned: number
  created_at: string
}

const formVazio = { email: '', eventId: '', comissao: '' }

export default function ProducerAffiliates() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: eventos = [] } = useProducerEvents()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(formVazio)
  const [salvando, setSalvando] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [editando, setEditando] = useState<Afiliado | null>(null)
  const [comissaoNova, setComissaoNova] = useState('')

  const queryKey = ['producer-afiliados', user?.id]
  const { data: affiliates = [], isPending, isError, refetch } = useQuery({
    queryKey,
    enabled: !!user?.id,
    queryFn: async () => {
      // listar só pela função: "select *" em affiliates dá 42501 (grant por coluna, B3)
      const { data, error } = await supabase.rpc('listar_afiliados' as never)
      if (error) throw error
      return ((data ?? []) as Afiliado[]).map(a => ({
        ...a,
        commission_percent: Number(a.commission_percent) || 0,
        sales: Number(a.sales) || 0,
        total_earned: Number(a.total_earned) || 0,
      }))
    },
  })

  const filtered = affiliates
    .filter(a => !search || a.email_mascarado.toLowerCase().includes(search.toLowerCase()) || (a.evento ?? '').toLowerCase().includes(search.toLowerCase()))
    .filter(a => filterStatus === 'all' || a.status === filterStatus)

  const stats = {
    active: affiliates.filter(a => a.status === 'active').length,
    sales: affiliates.reduce((s, a) => s + a.sales, 0),
    earned: affiliates.reduce((s, a) => s + a.total_earned, 0),
  }

  // Vincular só pela vincular_afiliado: trava de 18 anos, limite de tentativas e 2FA ficam no banco (B3)
  const vincular = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.eventId) { toast.error('Escolha o evento'); return }
    setSalvando(true)
    const { data, error } = await supabase.rpc('vincular_afiliado' as never, {
      p_email: form.email.trim(),
      p_evento: form.eventId,
      p_comissao: Number(form.comissao),
    } as never)
    setSalvando(false)
    const msg = mensagemVinculo(data, error)
    if (!error && data === 'ok') {
      toast.success(msg)
      setForm(formVazio)
      setShowForm(false)
      queryClient.invalidateQueries({ queryKey })
    } else {
      toast.error(msg)
    }
  }

  // Só status e commission_percent mudam pela API; .select com colunas listadas (select vazio/* dá 42501) e
  // conferência do retorno: RLS que barra devolve sucesso com 0 linhas (erro 11)
  const atualizar = async (a: Afiliado, campos: { status?: Afiliado['status']; commission_percent?: number }) => {
    const { data, error } = await supabase
      .from('affiliates')
      .update(campos as never) // ponytail: types/database.ts desatualizado (affiliates vira never); some com o gen types
      .eq('id', a.id)
      .select('id,status')
    if (error || !data?.length) {
      toast.error(error?.code === '42501' ? 'Confirme o código do 2FA: saia e entre de novo.' : 'Não foi possível salvar a alteração.')
      return false
    }
    queryClient.invalidateQueries({ queryKey })
    return true
  }

  const toggleStatus = async (a: Afiliado) => {
    const ativo = a.status === 'active'
    if (await atualizar(a, { status: ativo ? 'inactive' : 'active' })) toast.success(ativo ? 'Afiliado desativado.' : 'Afiliado ativado.')
  }

  const salvarComissao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editando) return
    const v = Number(comissaoNova)
    if (!(v >= 0.01 && v <= 100)) { toast.error(mensagemVinculo('comissao_invalida')); return }
    if (await atualizar(editando, { commission_percent: Math.round(v * 100) / 100 })) {
      toast.success('Comissão atualizada.')
      setEditando(null)
    }
  }

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Afiliados</h1>
          <p className="text-sm text-espresso/70 mt-1">Pessoas com conta na Evokaa que vendem seus eventos por comissão</p>
          <p className="text-xs text-amber-600 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 mt-3 max-w-xl">
            O link de venda do afiliado chega com o módulo de Promoters.
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-5 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all">
          <UserPlus className="w-4 h-4" /> Vincular afiliado
        </button>
      </div>

      {isError ? (
        <div role="alert" className="mb-8 p-4 rounded-2xl bg-white/60 border border-white/60 text-sm text-espresso">
          Não foi possível carregar os afiliados. <button onClick={() => refetch()} className="underline">Tentar de novo</button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Ativos', value: stats.active.toString() },
            { label: 'Vendas', value: stats.sales.toString() },
            { label: 'Comissão acumulada', value: brl(stats.earned) },
          ].map(k => (
            <div key={k.label} className="p-4 rounded-2xl bg-white/60 border border-white/60 text-center">
              <div className="font-serif text-xl text-espresso">{isPending ? '…' : k.value}</div>
              <div className="text-[10px] text-espresso/70 mt-0.5 font-semibold">{k.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-espresso/20" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por e-mail ou evento" aria-label="Buscar afiliado" className="w-full pl-10 pr-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/70 focus:outline-none focus:border-plum/30" /></div>
        <div className="flex items-center gap-2">
          {(['all', 'active', 'inactive'] as const).map(s => (
            <button key={s} type="button" onClick={() => setFilterStatus(s)} className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${filterStatus === s ? 'bg-plum text-cream' : 'bg-white/40 border border-white/60 text-espresso/70 hover:text-espresso'}`}>{s === 'all' ? 'Todos' : s === 'active' ? 'Ativos' : 'Inativos'}</button>
          ))}
        </div>
      </div>

      <div className="bg-white/60 border border-white/60 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-espresso/5">
                <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/70 uppercase">Afiliado</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/70 uppercase">Evento</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/70 uppercase">Comissão</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/70 uppercase">Status</th>
                <th className="px-4 py-3"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id} className="border-b border-espresso/5 last:border-0">
                  <td className="px-4 py-3">
                    <div className="text-sm text-espresso font-medium">{a.email_mascarado}</div>
                    <div className="text-[10px] text-espresso/70">{a.sales} vendas · {brl(a.total_earned)}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-espresso/70">{a.evento ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-espresso/70">{a.commission_percent.toLocaleString('pt-BR')}%</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleStatus(a)} aria-label={a.status === 'active' ? `Desativar ${a.email_mascarado}` : `Ativar ${a.email_mascarado}`} className="px-2.5 py-1 text-[10px] font-medium rounded-full border">{a.status === 'active' ? 'Ativo' : 'Inativo'}</button>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => { setEditando(a); setComissaoNova(String(a.commission_percent)) }} aria-label={`Editar comissão de ${a.email_mascarado}`} className="p-1.5 rounded-lg text-espresso/70"><Edit3 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!isPending && !isError && filtered.length === 0 && (
          <p className="p-6 text-center text-sm text-espresso/70">{affiliates.length === 0 ? 'Nenhum afiliado vinculado ainda.' : 'Nenhum afiliado com esse filtro.'}</p>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 glass-backdrop" onClick={() => setShowForm(false)} />
          <form onSubmit={vincular} className="glass-panel relative w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6"><h3 className="font-serif text-xl text-espresso">Vincular afiliado</h3><button type="button" onClick={() => setShowForm(false)} aria-label="Fechar" className="p-2 rounded-full text-espresso/70"><X className="w-4 h-4" /></button></div>
            <div className="space-y-3">
              <select required value={form.eventId} onChange={e => setForm({ ...form, eventId: e.target.value })} aria-label="Evento" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso">
                <option value="">Escolha o evento</option>
                {eventos.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
              </select>
              <input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="E-mail da conta Evokaa do afiliado" aria-label="E-mail do afiliado" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso" />
              <input required type="number" min="0.01" max="100" step="0.01" value={form.comissao} onChange={e => setForm({ ...form, comissao: e.target.value })} placeholder="Comissão (%)" aria-label="Comissão em %" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso" />
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 text-sm text-espresso/70">Cancelar</button>
              <button type="submit" disabled={salvando} className="px-6 py-2.5 bg-plum text-cream text-sm rounded-full disabled:opacity-50">{salvando ? 'Vinculando…' : 'Vincular'}</button>
            </div>
          </form>
        </div>
      )}

      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 glass-backdrop" onClick={() => setEditando(null)} />
          <form onSubmit={salvarComissao} className="glass-panel relative w-full max-w-sm p-6">
            <h3 className="font-serif text-xl text-espresso mb-1">Comissão</h3>
            <p className="text-xs text-espresso/70 mb-4">{editando.email_mascarado} · {editando.evento ?? '—'}</p>
            <input required type="number" min="0.01" max="100" step="0.01" value={comissaoNova} onChange={e => setComissaoNova(e.target.value)} aria-label="Comissão em %" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso" />
            <div className="flex items-center justify-end gap-3 mt-6">
              <button type="button" onClick={() => setEditando(null)} className="px-5 py-2.5 text-sm text-espresso/70">Cancelar</button>
              <button type="submit" className="px-6 py-2.5 bg-plum text-cream text-sm rounded-full">Salvar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
