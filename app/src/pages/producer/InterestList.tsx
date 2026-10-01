import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, Users, TrendingUp, Bell, Clock,
  CheckCircle2, Trash2, Loader2, Copy
} from 'lucide-react'
import { toast } from 'sonner'
import {
  useProducerLeads,
  useNotifyLead,
  useNotifyAllLeads,
  useDeleteLead,
} from '../../hooks/useProducerTools'

export default function ProducerInterestList() {
  const { data: leads = [], isLoading } = useProducerLeads()
  const notifyLead = useNotifyLead()
  const notifyAll = useNotifyAllLeads()
  const deleteLead = useDeleteLead()

  const [filter, setFilter] = useState<'all' | 'notified' | 'pending'>('all')
  const [showNotifyModal, setShowNotifyModal] = useState(false)

  const filtered = leads.filter(i => {
    if (filter === 'notified') return i.notified
    if (filter === 'pending') return !i.notified
    return true
  })

  const total = leads.length
  const notifiedCount = leads.filter(i => i.notified).length
  const pendingCount = leads.filter(i => !i.notified).length
  const cities = [...new Set(leads.map(i => i.city).filter(Boolean))].length
  const emails = [...new Set(filtered.map(i => i.email?.trim()).filter(Boolean))] as string[]

  // "Avisado" só marca na lista: o e-mail em massa chega com o módulo de Comunicação (M6). Até lá, o produtor copia
  // os e-mails e avisa por conta própria.
  const copiarEmails = async () => {
    try {
      await navigator.clipboard.writeText(emails.join(', '))
      toast.success(`${emails.length} e-mails copiados.`)
    } catch {
      toast.error('Não foi possível copiar. Tente de novo.')
    }
  }

  const handleNotify = async () => {
    try {
      const result = await notifyAll.mutateAsync()
      setShowNotifyModal(false)
      toast.success(`${result?.length || 0} marcados como avisados.`)
    } catch {
      toast.error('Não foi possível marcar como avisados.')
    }
  }

  const handleNotifyOne = async (id: string) => {
    try {
      await notifyLead.mutateAsync(id)
      toast.success('Marcado como avisado.')
    } catch {
      toast.error('Não foi possível marcar como avisado.')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteLead.mutateAsync(id)
      toast.success('Removido!')
    } catch {
      toast.error('Erro ao remover')
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 lg:p-10 max-w-6xl mx-auto flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-plum animate-spin mb-4" />
        <p className="text-espresso/70 text-sm">Carregando lista de interesse...</p>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link to="/producer/event-manager" className="p-2 rounded-full bg-white/60 border border-white/60 text-espresso/70 hover:text-espresso transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-serif text-3xl text-espresso">Lista de Interesse</h1>
          <p className="text-sm text-espresso/70 mt-1">Pessoas interessadas antes das vendas abrirem</p>
          <p className="text-xs text-espresso/70 mt-1">"Marcar como avisado" só registra aqui. O e-mail em massa chega com o módulo de Comunicação.</p>
        </div>
        {emails.length > 0 && (
          <button onClick={copiarEmails} className="px-5 py-2.5 border border-espresso/15 text-espresso text-sm font-medium rounded-full flex items-center gap-2">
            <Copy className="w-4 h-4" /> Copiar e-mails
          </button>
        )}
        {pendingCount > 0 && (
          <button onClick={() => setShowNotifyModal(true)} className="px-5 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all flex items-center gap-2">
            <Bell className="w-4 h-4" /> Marcar {pendingCount} como avisados
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Interessados', value: total.toString(), icon: Users },
          { label: 'Avisados', value: notifiedCount.toString(), icon: CheckCircle2 },
          { label: 'Pendentes', value: pendingCount.toString(), icon: Clock },
          { label: 'Cidades', value: cities.toString(), icon: TrendingUp },
        ].map(k => (
          <div key={k.label} className="p-5 rounded-2xl bg-white/60 border border-white/60">
            <k.icon className="w-4 h-4 text-plum mb-3" />
            <div className="font-serif text-2xl text-espresso">{k.value}</div>
            <div className="text-[10px] text-espresso/70 mt-1 uppercase tracking-wider">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {(['all', 'pending', 'notified'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${filter === f ? 'bg-plum text-cream' : 'bg-white/60 border border-white/60 text-espresso/70 hover:text-espresso'}`}>
            {f === 'all' ? 'Todos' : f === 'pending' ? `Pendentes (${pendingCount})` : `Avisados (${notifiedCount})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white/60 border border-white/60 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-white/60 text-[10px] uppercase tracking-wider text-espresso/70">
          <div className="col-span-3">Nome / Email</div>
          <div className="col-span-2">Telefone</div>
          <div className="col-span-2">Cidade</div>
          <div className="col-span-2">Origem</div>
          <div className="col-span-2">Data</div>
          <div className="col-span-1"></div>
        </div>
        {filtered.map(item => (
          <div key={item.id} className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-white/60 last:border-0 hover:bg-white/40 transition-colors items-center">
            <div className="col-span-3">
              <div className="text-xs font-medium text-espresso">{item.full_name}</div>
              <div className="text-[10px] text-espresso/70">{item.email}</div>
            </div>
            <div className="col-span-2 text-xs text-espresso/70">{item.phone || '-'}</div>
            <div className="col-span-2 text-xs text-espresso/70">{item.city || '-'}</div>
            <div className="col-span-2">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/60 text-espresso/70">{item.source}</span>
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <span className="text-xs text-espresso/70">
                {new Date(item.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
              </span>
              {item.notified && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
            </div>
            <div className="col-span-1 flex items-center justify-end gap-1">
              {!item.notified && (
                <button onClick={() => handleNotifyOne(item.id)} aria-label={`Marcar ${item.full_name} como avisado`} title="Marcar como avisado" className="p-1.5 rounded-lg hover:bg-plum/10 text-espresso/70 hover:text-plum transition-colors">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => handleDelete(item.id)} aria-label={`Remover ${item.full_name}`} title="Remover" className="p-1.5 rounded-lg hover:bg-red-50 text-espresso/70 hover:text-red-500 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-espresso/10 mx-auto mb-3" />
          <p className="text-sm text-espresso/70">Nenhum interessado encontrado.</p>
          <p className="text-xs text-espresso/70 mt-1">A lista sera preenchida conforme pessoas se cadastrarem.</p>
        </div>
      )}

      {/* Notify Modal */}
      {showNotifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 glass-backdrop" onClick={() => setShowNotifyModal(false)} />
          <div className="glass-panel relative w-full max-w-md p-6">
            <h3 className="font-serif text-xl text-espresso text-center mb-2">Marcar como avisados</h3>
            <p className="text-xs text-espresso/70 text-center mb-4">{pendingCount} pessoas serão marcadas como avisadas. Nenhum e-mail é enviado: o envio em massa chega com o módulo de Comunicação.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowNotifyModal(false)} className="flex-1 py-2.5 border border-espresso/15 text-espresso text-sm rounded-full hover:bg-espresso/5 transition-all">
                Cancelar
              </button>
              <button onClick={handleNotify} disabled={notifyAll.isPending} className="flex-1 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {notifyAll.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Marcar como avisados'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
