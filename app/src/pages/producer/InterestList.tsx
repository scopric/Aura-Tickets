import { useState } from 'react'
import * as I from '@/components/icones/evokaa16'
import { toast } from 'sonner'
import { useInteressados, useRemoverInteressado } from '../../hooks/useInteresse'
import { PageHeader, Stat, EmptyState } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

const icone = 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
const celula = (v: string | null) => `"${(v ?? '').replace(/"/g, '""').replace(/^([=+\-@\t\r])/, "'$1")}"` // aspas duplicadas; fórmula de planilha neutralizada

export default function ProducerInterestList() {
  const { data: lista = [], isLoading, isError, refetch, isFetching } = useInteressados()
  const remover = useRemoverInteressado()
  const [evento, setEvento] = useState('')

  const eventos = [...new Map(lista.map(i => [i.event_id, i.event_title])).entries()]
  const filtrada = evento ? lista.filter(i => i.event_id === evento) : lista
  const avisados = filtrada.filter(i => i.notified).length
  const emails = [...new Set(filtrada.map(i => i.email?.trim()).filter(Boolean))] as string[]

  const copiarEmails = async () => {
    try {
      await navigator.clipboard.writeText(emails.join(', '))
      toast.success(`${emails.length} e-mails copiados.`)
    } catch {
      toast.error('Não foi possível copiar. Tente de novo.')
    }
  }

  const baixarCsv = () => {
    const linhas = [['Nome', 'E-mail', 'Cidade', 'Evento', 'Inscrição', 'Avisado em'],
      ...filtrada.map(i => [i.full_name, i.email, i.city, i.event_title, i.created_at.slice(0, 10), i.notified_at?.slice(0, 10) ?? ''])]
    const url = URL.createObjectURL(new Blob(['﻿' + linhas.map(l => l.map(c => celula(c)).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: 'lista-de-interesse.csv' })
    a.click()
    URL.revokeObjectURL(url)
  }

  // tira só da lista: o lead que a inscrição criou no CRM continua lá
  const handleRemove = async (id: string, nome: string) => {
    if (!window.confirm(`Remover ${nome} da lista? O lead continua no CRM.`)) return
    try {
      await remover.mutateAsync(id)
      toast.success('Removido da lista. O lead continua no CRM.')
    } catch {
      toast.error('Não foi possível remover. Tente de novo.')
    }
  }

  const header = (
    <PageHeader
      title="Lista de interesse"
      description="Pessoas que pediram para ser avisadas quando as vendas abrirem"
      actions={
        <>
          {emails.length > 0 && <Button variant="outline" onClick={copiarEmails}><I.Copiar aria-hidden="true" />Copiar e-mails</Button>}
          {filtrada.length > 0 && <Button variant="outline" onClick={baixarCsv}>Baixar CSV</Button>}
        </>
      }
    />
  )

  if (isLoading) {
    return (
      <div aria-busy="true">
        {header}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {[1, 2, 3].map(n => <Skeleton key={n} className="h-[92px] rounded-[10px] bg-muted" />)}
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
        Quando a venda abre, cada pessoa é avisada sozinha, no aplicativo e por e-mail. Quem se inscreve também entra no seu CRM. Nome, e-mail e cidade só aparecem de quem deu o consentimento.
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Interessados" value={filtrada.length} />
        <Stat label="Avisados" value={avisados} />
        <Stat label="Aguardando a venda" value={filtrada.length - avisados} />
      </div>

      {eventos.length > 1 && (
        <div className="mt-6">
          <label htmlFor="filtro-evento" className="mb-1 block text-sm font-medium">Evento</label>
          <select id="filtro-evento" value={evento} onChange={e => setEvento(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
            <option value="">Todos os eventos</option>
            {eventos.map(([id, titulo]) => <option key={id} value={id}>{titulo}</option>)}
          </select>
        </div>
      )}

      <div className="mt-4">
        {filtrada.length === 0 ? (
          <EmptyState
            title="Ninguém na lista ainda"
            description="O botão “Avise-me quando abrir” aparece na página do evento enquanto a venda não começou. Se você usa verificação em dois fatores e a lista deveria ter gente, confirme o código e recarregue."
          />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-[10px] border border-border bg-card">
            {filtrada.map(item => {
              const nome = item.full_name || 'Inscrição sem consentimento registrado'
              return (
                <li key={item.id} className="flex items-start gap-3 p-3 sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{nome}</span>
                      {item.notified && <Badge variant="secondary">Avisado</Badge>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{item.email || 'Sem e-mail (sem consentimento)'}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[item.event_title, item.city, new Date(item.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon-sm" className={icone} onClick={() => handleRemove(item.id, nome)} aria-label={`Remover ${nome} da lista`}>
                    <I.Lixeira aria-hidden="true" />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
