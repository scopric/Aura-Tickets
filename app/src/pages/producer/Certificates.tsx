import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Palette, Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useProducerEvents } from '../../hooks/useEvents'
import {
  useEventCertificates,
  useParticipantesCertificado,
  useCertificadosEmitidos,
  useEmitirCertificados,
  useRevogarCertificado,
} from '../../hooks/useProducerTools'
import { PageHeader, Stat, EmptyState } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

const select = 'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30'
const icone = 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'

// Avatar com as iniciais, sem serviço externo (LGPD)
const iniciais = (nome: string) =>
  nome.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?'

function mensagemErro(err: unknown, padrao: string) {
  const code = (err as { code?: string } | null)?.code
  if (code === '23505') return 'Certificado já emitido para esta pessoa. A lista foi atualizada.'
  // 42501: alguém da lista deixou de ter ingresso válido (a regra do banco recusa o lote todo)
  if (code === '42501') return 'A lista mudou; atualizamos os participantes. Tente de novo.'
  return padrao
}

function Alerta({ texto, onRetry, carregando }: { texto: string; onRetry: () => void; carregando: boolean }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-[10px] border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-foreground">{texto}</p>
      <Button variant="outline" size="sm" onClick={onRetry} disabled={carregando}>{carregando ? 'Carregando…' : 'Tentar de novo'}</Button>
    </div>
  )
}

export default function Certificates() {
  const eventosQ = useProducerEvents()
  const events = eventosQ.data ?? []
  const [pickedEventId, setPickedEventId] = useState<string | null>(null)
  // a lista chega depois do 1º render: sem escolha, vale o primeiro evento
  const selectedEventId = pickedEventId ?? events[0]?.id ?? null
  // quem recebe: só quem fez check-in (ingresso usado) ou todo mundo com ingresso válido (ativo ou usado)
  const [somenteCheckin, setSomenteCheckin] = useState(true)

  // certificates guarda o MODELO do evento (um por evento, índice único em event_id)
  const modelosQ = useEventCertificates(selectedEventId)
  const modelo = modelosQ.data?.[0] ?? null
  const participantesQ = useParticipantesCertificado(modelo ? selectedEventId : null)
  const emitidosQ = useCertificadosEmitidos(modelo?.id ?? null)
  const emitir = useEmitirCertificados()
  const revogar = useRevogarCertificado()

  const editorUrl = `/producer/certificado-editor${selectedEventId ? `?eventId=${selectedEventId}` : ''}`
  const header = (
    <PageHeader
      title="Certificados"
      description="Emita certificados para quem participou dos seus eventos"
      actions={events.length > 0 && <Button asChild variant="outline"><Link to={editorUrl}><Palette aria-hidden="true" />Editor de modelos</Link></Button>}
    />
  )

  if (eventosQ.isLoading) {
    return (
      <div aria-busy="true">
        {header}
        <Skeleton className="h-9 w-full max-w-sm rounded-md bg-muted" />
        <Skeleton className="mt-6 h-48 rounded-[10px] bg-muted" />
      </div>
    )
  }

  if (eventosQ.isError) {
    return <div>{header}<Alerta texto="Não foi possível carregar seus eventos." onRetry={() => eventosQ.refetch()} carregando={eventosQ.isFetching} /></div>
  }

  if (events.length === 0) {
    return (
      <div>
        {header}
        <EmptyState
          title="Você ainda não tem eventos"
          description="O certificado é emitido por evento, para quem tem ingresso."
          action={<Button asChild><Link to="/producer/planner"><Plus aria-hidden="true" />Criar evento</Link></Button>}
        />
      </div>
    )
  }

  const participantes = participantesQ.data?.lista ?? []
  const emitidos = emitidosQ.data ?? []
  const emitidoDe = new Map(emitidos.map(c => [c.user_id, c]))
  const elegiveis = participantes.filter(p => !somenteCheckin || p.checkin)
  const pendentes = elegiveis.filter(p => !emitidoDe.has(p.user_id))

  const emitirPara = async (userIds: string[], ok: string) => {
    if (!modelo) return
    try {
      await emitir.mutateAsync({ certificateId: modelo.id, userIds })
      toast.success(ok)
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível emitir o certificado.'))
    }
  }

  const emitirTodos = () => {
    const quem = somenteCheckin ? 'quem fez check-in' : 'quem tem ingresso válido'
    if (!window.confirm(`Emitir ${pendentes.length} certificado(s) para ${quem}?`)) return
    emitirPara(pendentes.map(p => p.user_id), `${pendentes.length} certificado(s) emitido(s).`)
  }

  const handleRevogar = async (nome: string, id: string) => {
    if (!modelo || !window.confirm(`Revogar o certificado de ${nome}? O código de validação deixa de valer.`)) return
    try {
      await revogar.mutateAsync({ id, certificateId: modelo.id })
      toast.success('Certificado revogado.')
    } catch {
      toast.error('Não foi possível revogar o certificado.')
    }
  }

  const carregandoLista = modelosQ.isLoading || (!!modelo && (participantesQ.isLoading || emitidosQ.isLoading))
  const erroLista = modelosQ.isError || participantesQ.isError || emitidosQ.isError

  return (
    <div>
      {header}

      <div className="grid gap-1.5 sm:max-w-sm">
        <Label htmlFor="cert-evento">Evento</Label>
        <select id="cert-evento" value={selectedEventId ?? ''} onChange={e => setPickedEventId(e.target.value || null)} className={select}>
          {events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
      </div>

      <div className="mt-6">
        {carregandoLista ? (
          <Skeleton aria-busy="true" className="h-48 rounded-[10px] bg-muted" />
        ) : erroLista ? (
          <Alerta
            texto="Não foi possível carregar os certificados deste evento."
            onRetry={() => { modelosQ.refetch(); participantesQ.refetch(); emitidosQ.refetch() }}
            carregando={modelosQ.isFetching || participantesQ.isFetching || emitidosQ.isFetching}
          />
        ) : !modelo ? (
          <EmptyState
            title="Este evento ainda não tem modelo de certificado"
            description="Monte o modelo no editor; depois você emite aqui para quem participou."
            action={<Button asChild><Link to={editorUrl}><Palette aria-hidden="true" />Criar modelo</Link></Button>}
          />
        ) : (
          <>
            <fieldset className="rounded-[10px] border border-border bg-card p-4">
              <legend className="px-1 text-sm font-medium text-foreground">Quem recebe</legend>
              <div className="mt-1 grid gap-2 text-sm">
                <label className="flex items-start gap-2">
                  <input type="radio" name="quem-recebe" className="mt-0.5 accent-primary" checked={somenteCheckin} onChange={() => setSomenteCheckin(true)} />
                  <span><span className="text-foreground">Só quem esteve presente</span><span className="block text-xs text-muted-foreground">Ingresso com check-in feito</span></span>
                </label>
                <label className="flex items-start gap-2">
                  <input type="radio" name="quem-recebe" className="mt-0.5 accent-primary" checked={!somenteCheckin} onChange={() => setSomenteCheckin(false)} />
                  <span><span className="text-foreground">Todos com ingresso válido</span><span className="block text-xs text-muted-foreground">Com ou sem check-in (ingresso ativo ou usado)</span></span>
                </label>
              </div>
            </fieldset>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Stat label={somenteCheckin ? 'Presentes' : 'Com ingresso válido'} value={elegiveis.length} />
              <Stat label="Certificados emitidos" value={emitidos.length} />
            </div>

            <div className="mt-6 mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold text-foreground">Participantes</h2>
              <Button onClick={emitirTodos} disabled={pendentes.length === 0 || emitir.isPending}>
                {emitir.isPending ? <><Loader2 className="animate-spin" aria-hidden="true" />Emitindo…</> : `Emitir para todos (${pendentes.length})`}
              </Button>
            </div>

            {elegiveis.length === 0 ? (
              <EmptyState
                title={participantes.length === 0 ? 'Ninguém com ingresso válido ainda' : 'Ninguém fez check-in ainda'}
                description={participantes.length === 0
                  ? 'Quem comprar ingresso para este evento aparece aqui.'
                  : 'Escolha "Todos com ingresso válido" para emitir antes do check-in.'}
              />
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-[10px] border border-border bg-card">
                {elegiveis.map(p => {
                  const cert = emitidoDe.get(p.user_id)
                  return (
                    <li key={p.user_id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground" aria-hidden="true">{iniciais(p.nome)}</span>
                        <p className="min-w-0 truncate text-sm font-medium text-foreground">{p.nome}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <Badge variant="secondary">{p.checkin ? 'Check-in feito' : 'Sem check-in'}</Badge>
                        {cert ? (
                          <>
                            <span className="text-xs text-muted-foreground">Emitido em {new Date(cert.issued_at).toLocaleDateString('pt-BR')}</span>
                            <Button variant="ghost" size="sm" className={icone} onClick={() => handleRevogar(p.nome, cert.id)} disabled={revogar.isPending}>Revogar</Button>
                          </>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => emitirPara([p.user_id], 'Certificado emitido.')} disabled={emitir.isPending}>Emitir</Button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            {participantesQ.data?.cortado && (
              <p className="mt-3 text-xs text-muted-foreground">Lista parcial: este evento tem mais de 1.000 ingressos válidos.</p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">A emissão fica registrada com um código de validação. O participante ainda não vê o certificado no app, e o envio por e-mail e o PDF ainda não existem.</p>
          </>
        )}
      </div>
    </div>
  )
}
