import { useState } from 'react'
import { Check, Trash2, Loader2, Copy } from 'lucide-react'
import { toast } from 'sonner'
import {
  useProducerLeads,
  useNotifyLead,
  useNotifyAllLeads,
  useDeleteLead,
} from '../../hooks/useProducerTools'
import { PageHeader, Stat, EmptyState } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const icone = 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'

export default function ProducerInterestList() {
  const { data: leads = [], isLoading, isError, refetch, isFetching } = useProducerLeads()
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

  // a lista lê crm_leads: remover aqui apaga o lead do CRM também
  const handleDelete = async (id: string, nome: string) => {
    if (!window.confirm(`Remover ${nome}? O lead também sai do CRM.`)) return
    try {
      await deleteLead.mutateAsync(id)
      toast.success('Removido da lista.')
    } catch {
      toast.error('Não foi possível remover.')
    }
  }

  const header = (
    <PageHeader
      title="Lista de interesse"
      description="Pessoas interessadas antes das vendas abrirem"
      actions={
        <>
          {emails.length > 0 && (
            <Button variant="outline" onClick={copiarEmails}><Copy aria-hidden="true" />Copiar e-mails</Button>
          )}
          {pendingCount > 0 && (
            <Button onClick={() => setShowNotifyModal(true)}><Check aria-hidden="true" />Marcar {pendingCount} como avisados</Button>
          )}
        </>
      }
    />
  )

  if (isLoading) {
    return (
      <div aria-busy="true">
        {header}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map(n => <Skeleton key={n} className="h-[92px] rounded-[10px] bg-muted" />)}
        </div>
        <Skeleton className="mt-6 h-48 rounded-[10px] bg-muted" />
      </div>
    )
  }

  if (isError) {
    return (
      <div>
        {header}
        <div role="alert" className="flex flex-col gap-3 rounded-[10px] border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground">Não foi possível carregar a lista de interesse.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? 'Carregando…' : 'Tentar de novo'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {header}

      <p className="mb-6 rounded-[10px] border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        "Marcar como avisado" só registra aqui; nenhum e-mail é enviado. O e-mail em massa chega com o módulo de Comunicação.
        {emails.length > 0 && ' Até lá, copie os e-mails e avise por conta própria.'}
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Interessados" value={total} />
        <Stat label="Avisados" value={notifiedCount} />
        <Stat label="Pendentes" value={pendingCount} />
        <Stat label="Cidades" value={cities} />
      </div>

      <div role="group" aria-label="Filtrar" className="mt-6 flex flex-wrap gap-1">
        {(['all', 'pending', 'notified'] as const).map(f => (
          <Button key={f} size="sm" variant={filter === f ? 'secondary' : 'ghost'} aria-pressed={filter === f} onClick={() => setFilter(f)} className={filter === f ? '' : icone}>
            {f === 'all' ? 'Todos' : f === 'pending' ? `Pendentes (${pendingCount})` : `Avisados (${notifiedCount})`}
          </Button>
        ))}
      </div>

      <div className="mt-4">
        {filtered.length === 0 ? (
          <EmptyState
            title={total === 0 ? 'Ninguém na lista ainda' : 'Ninguém com esse filtro'}
            description={total === 0 ? 'A lista é preenchida conforme as pessoas se cadastram.' : undefined}
          />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-[10px] border border-border bg-card">
            {filtered.map(item => (
              <li key={item.id} className="flex items-start gap-3 p-3 sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">{item.full_name}</span>
                    {item.notified && <Badge variant="secondary">Avisado</Badge>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{item.email || 'Sem e-mail'}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[item.phone, item.city, item.source, new Date(item.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!item.notified && (
                    <Button variant="outline" size="sm" onClick={() => handleNotifyOne(item.id)} aria-label={`Marcar ${item.full_name} como avisado`}>
                      <Check aria-hidden="true" /><span className="hidden sm:inline">Marcar como avisado</span>
                    </Button>
                  )}
                  <Button variant="ghost" size="icon-sm" className={icone} onClick={() => handleDelete(item.id, item.full_name)} aria-label={`Remover ${item.full_name}`}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={showNotifyModal} onOpenChange={setShowNotifyModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Marcar como avisados</DialogTitle>
            <DialogDescription>
              {pendingCount} pessoas serão marcadas como avisadas. Nenhum e-mail é enviado: o envio em massa chega com o módulo de Comunicação.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotifyModal(false)}>Cancelar</Button>
            <Button onClick={handleNotify} disabled={notifyAll.isPending}>
              {notifyAll.isPending ? <><Loader2 className="animate-spin" aria-hidden="true" />Marcando…</> : 'Marcar como avisados'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
