import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, X, Check } from 'lucide-react'
import { usePublicEvent, useUpdateEvent } from '../../hooks/useEvents'
import { toast } from 'sonner'
import MatchDeMesaPanel from '../../components/producer/MatchDeMesaPanel'
import CapaEventoCampo from '../../components/producer/CapaEventoCampo'
import { enviarCapa, useLiberarPrevia, type CapaPronta } from '../../lib/capaEvento'
import { FOTO_PADRAO, corSorteada, ehHex, temFoto } from '../../lib/corEvento'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader, EmptyState } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'

const TIPOS = ['Festa', 'Corporativo', 'Workshop', 'Show', 'Palestra', 'Networking', 'Gastronomia', 'Esporte']
const cartao = 'rounded-[10px] border border-border bg-card p-4 sm:p-6'
const icone = 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'

export default function ProducerEditEvent() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const { data: existingEvent, isLoading } = usePublicEvent(eventId)
  const updateEvent = useUpdateEvent()
  const { user } = useAuth()
  const [step, setStep] = useState(1)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    location: '',
  })

  const [tickets, setTickets] = useState([{ id: '1', name: '', price: '', capacity: '' }])
  const [capa, setCapa] = useState<CapaPronta | null>(null) // foto nova, já reduzida; só sobe ao salvar
  const [removida, setRemovida] = useState(false)
  const [corEditada, setCorEditada] = useState<{ valor: string; manual: boolean } | null>(null) // null = não mexeu: a cor salva continua
  const [salvando, setSalvando] = useState(false) // cobre enviar a foto + salvar: sem clique duplo
  useLiberarPrevia(capa)
  const enviada = useRef<{ blob: Blob; url: string } | null>(null) // evita subir de novo se o salvar falhar depois do envio
  const [eventType, setEventType] = useState('Festa')
  const [customType, setCustomType] = useState('')

  // Preencher formulário com dados existentes
  useEffect(() => {
    if (existingEvent) {
      setFormData({
        title: existingEvent.title || '',
        description: existingEvent.description || '',
        date: existingEvent.date || '',
        time: existingEvent.time || '',
        location: existingEvent.venue_name || '',
      })

      const cat = existingEvent.category || 'Festa'
      const predefinedTypes = ['Festa', 'Corporativo', 'Workshop', 'Show', 'Palestra', 'Networking', 'Gastronomia', 'Esporte']
      if (predefinedTypes.includes(cat)) {
        setEventType(cat)
        setCustomType('')
      } else {
        setEventType('Outro')
        setCustomType(cat)
      }

      if (existingEvent.ticket_types && existingEvent.ticket_types.length > 0) {
        setTickets(existingEvent.ticket_types.map(t => ({
          id: t.id,
          name: t.name,
          price: String(t.price),
          capacity: t.capacity ? String(t.capacity) : '',
        })))
      }
    }
  }, [existingEvent])

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const addTicket = () => {
    setTickets([...tickets, { id: `new-${Date.now()}`, name: '', price: '', capacity: '' }])
  }

  const removeTicket = (id: string) => {
    setTickets(tickets.filter(t => t.id !== id))
  }

  const updateTicket = (id: string, field: 'name' | 'price' | 'capacity', value: string) => {
    setTickets(tickets.map(t => t.id === id ? { ...t, [field]: value } : t))
  }

  const handleSave = async () => {
    if (!eventId || !existingEvent) return
    // Foto: só entra no salvamento quando mudou (trocar ou remover manda o evento aprovado para nova análise, Decisão 136)
    let foto: { cover_image: string; image_url: string } | undefined
    setSalvando(true)
    if (capa) {
      if (enviada.current?.blob !== capa.blob) {
        try {
          enviada.current = { blob: capa.blob, url: await enviarCapa(capa, existingEvent.producer_id, existingEvent.id) }
        } catch (err) {
          toast.error(`${err instanceof Error ? err.message : 'Não foi possível enviar a foto.'} O resto do formulário foi mantido.`)
          setSalvando(false)
          return
        }
      }
      foto = { cover_image: enviada.current.url, image_url: enviada.current.url }
    } else if (removida) {
      foto = { cover_image: FOTO_PADRAO, image_url: FOTO_PADRAO }
    }
    try {
      const category = eventType === 'Outro' ? customType || 'Outro' : eventType

      const eventPayload = {
        title: formData.title || 'Sem título',
        description: formData.description || null,
        date: formData.date || null,
        time: formData.time || null,
        location: formData.location || null,
        venue_name: formData.location || null,
        category: category,
        status: existingEvent?.status || 'published',
        ...foto,
        ...(corEditada ? { accent_color: corEditada.valor } : {}),
        capacity: tickets.reduce((sum, t) => sum + (Number(t.capacity) || 0), 0) || null
      }

      const ticketsPayload = tickets
        .filter(t => t.name && t.price)
        .map(t => ({
          id: t.id.startsWith('new-') ? undefined : t.id,
          name: t.name,
          price: Number(t.price) || 0,
          capacity: t.capacity ? Number(t.capacity) : null,
          type: 'individual' as const
        }))

      await updateEvent.mutateAsync({
        eventId,
        event: eventPayload,
        tickets: ticketsPayload
      })

      toast.success('Alterações salvas. Mudanças no conteúdo do evento voltam para a análise da equipe.')
      setTimeout(() => navigate('/producer/events'), 800)
    } catch (err: any) {
      setSalvando(false)
      toast.error(err.message || 'Erro ao atualizar evento')
    }
  }

  const steps = [
    { num: 1, label: 'Informações' },
    { num: 2, label: 'Ingressos' },
    { num: 3, label: 'Imagem' },
    { num: 4, label: 'Revisão' },
  ]

  const canNextStep1 = () => {
    return !!formData.title && !!formData.date && !!formData.location
  }

  const canNextStep2 = () => {
    return tickets.length > 0 && tickets.every(t => t.name && t.price && t.capacity)
  }

  const header = (
    <PageHeader
      title="Editar evento"
      description="Atualize as informações do seu evento"
      actions={<Button asChild variant="outline"><Link to="/producer/events"><ArrowLeft aria-hidden="true" />Meus eventos</Link></Button>}
    />
  )

  if (isLoading) {
    return (
      <div aria-busy="true" className="mx-auto max-w-3xl">
        {header}
        <Skeleton className="h-8 rounded-md bg-muted" />
        <Skeleton className="mt-6 h-80 rounded-[10px] bg-muted" />
      </div>
    )
  }

  if (!existingEvent) {
    return (
      <div className="mx-auto max-w-3xl">
        {header}
        <EmptyState
          title="Evento não encontrado"
          action={<Button asChild variant="outline"><Link to="/producer/events">Voltar para meus eventos</Link></Button>}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      {header}

      {/* Mensagem de rejeição */}
      {existingEvent?.approval_status === 'rejected' && (
        <div role="status" className="mb-6 rounded-[10px] border border-destructive/40 bg-card p-4 text-sm">
          <p className="font-medium text-foreground">Motivo da recusa</p>
          <p className="mt-1 text-muted-foreground">{existingEvent.rejection_reason || 'Nenhuma justificativa fornecida.'}</p>
        </div>
      )}

      {/* Passos */}
      <ol className="mb-8 flex items-center gap-2">
        {steps.map((s, i) => (
          <li key={s.num} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              aria-current={step === s.num ? 'step' : undefined}
              aria-label={`Passo ${s.num}: ${s.label}`}
              onClick={() => {
                if (s.num === 1) setStep(1)
                else if (s.num === 2 && canNextStep1()) setStep(2)
                else if (s.num === 3 && canNextStep1() && canNextStep2()) setStep(3)
                else if (s.num === 4 && canNextStep1() && canNextStep2()) setStep(4)
              }}
              className={`flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium tabular-nums transition-colors ${
                step === s.num ? 'border-primary bg-primary text-primary-foreground' :
                step > s.num ? 'border-primary text-primary' :
                'border-border text-muted-foreground hover:bg-foreground/5'
              }`}
            >
              {step > s.num ? <Check className="size-4" aria-hidden="true" /> : s.num}
            </button>
            <span className={`hidden text-xs font-medium sm:block ${step === s.num ? 'text-foreground' : 'text-muted-foreground'}`}>{s.label}</span>
            {i < steps.length - 1 && <span className={`h-px flex-1 ${step > s.num ? 'bg-primary' : 'bg-border'}`} aria-hidden="true" />}
          </li>
        ))}
      </ol>

      {/* Passo 1: Informações */}
      {step === 1 && (
        <div className="space-y-6">
          <section className={cartao}>
            <h2 className="mb-4 text-base font-semibold text-foreground">Informações do evento</h2>
            <div className="space-y-4">
              <div className="grid gap-1.5">
                <Label htmlFor="evento-titulo">Título *</Label>
                <Input id="evento-titulo" value={formData.title} onChange={e => handleInputChange('title', e.target.value)} placeholder="Ex: Noite Eletro 2025" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="evento-descricao">Descrição</Label>
                <Textarea id="evento-descricao" rows={4} value={formData.description} onChange={e => handleInputChange('description', e.target.value)} placeholder="Descreva seu evento…" className="resize-none" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="evento-data">Data *</Label>
                  <Input id="evento-data" type="date" value={formData.date} onChange={e => handleInputChange('date', e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="evento-horario">Horário</Label>
                  <Input id="evento-horario" type="time" value={formData.time} onChange={e => handleInputChange('time', e.target.value)} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="evento-local">Local *</Label>
                <Input id="evento-local" value={formData.location} onChange={e => handleInputChange('location', e.target.value)} placeholder="Endereço ou nome do espaço" />
              </div>
              <div>
                <p id="evento-tipo" className="mb-2 text-sm font-medium text-foreground">Tipo de evento</p>
                <div role="group" aria-labelledby="evento-tipo" className="mb-3 flex flex-wrap gap-1">
                  {TIPOS.map((tag) => (
                    <Button key={tag} type="button" size="sm" variant={eventType === tag ? 'secondary' : 'ghost'} aria-pressed={eventType === tag} className={eventType === tag ? '' : icone}
                      onClick={() => { setEventType(tag); setCustomType('') }}>
                      {tag}
                    </Button>
                  ))}
                  <Button type="button" size="sm" variant={eventType === 'Outro' ? 'secondary' : 'ghost'} aria-pressed={eventType === 'Outro'} className={eventType === 'Outro' ? '' : icone} onClick={() => setEventType('Outro')}>
                    <Plus aria-hidden="true" />Outro
                  </Button>
                </div>
                {eventType === 'Outro' && (
                  <>
                    <Label htmlFor="evento-tipo-outro" className="sr-only">Tipo do evento</Label>
                    <Input id="evento-tipo-outro" value={customType} onChange={e => setCustomType(e.target.value)} placeholder="Digite o tipo do seu evento…" />
                  </>
                )}
              </div>
            </div>
          </section>
          <Button onClick={() => setStep(2)} disabled={!canNextStep1()}>Próximo</Button>
        </div>
      )}

      {/* Passo 2: Ingressos */}
      {step === 2 && (
        <div className="space-y-6">
          <section className={cartao}>
            <h2 className="mb-4 text-base font-semibold text-foreground">Ingressos</h2>
            <div className="space-y-3">
              {tickets.map((ticket, i) => (
                <div key={ticket.id} className="rounded-lg border border-border p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-medium text-foreground">Ingresso {i + 1}</h3>
                    {tickets.length > 1 && (
                      <Button variant="ghost" size="icon-sm" className={icone} onClick={() => removeTicket(ticket.id)} aria-label={`Remover o ingresso ${i + 1}`}>
                        <X aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="grid gap-1.5">
                      <Label htmlFor={`ingresso-nome-${ticket.id}`} className="text-xs text-muted-foreground">Nome *</Label>
                      <Input id={`ingresso-nome-${ticket.id}`} value={ticket.name} onChange={e => updateTicket(ticket.id, 'name', e.target.value)} placeholder="Ex: VIP" />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor={`ingresso-preco-${ticket.id}`} className="text-xs text-muted-foreground">Preço (R$) *</Label>
                      <Input id={`ingresso-preco-${ticket.id}`} type="number" inputMode="decimal" value={ticket.price} onChange={e => updateTicket(ticket.id, 'price', e.target.value)} placeholder="0,00" />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor={`ingresso-capacidade-${ticket.id}`} className="text-xs text-muted-foreground">Capacidade *</Label>
                      <Input id={`ingresso-capacidade-${ticket.id}`} type="number" inputMode="numeric" value={ticket.capacity} onChange={e => updateTicket(ticket.id, 'capacity', e.target.value)} placeholder="Quantidade" />
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="outline" className="w-full border-dashed" onClick={addTicket}>
                <Plus aria-hidden="true" />Adicionar ingresso
              </Button>
            </div>
          </section>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
            <Button onClick={() => setStep(3)} disabled={!canNextStep2()}>Próximo</Button>
          </div>
        </div>
      )}

      {/* Passo 3: Imagem */}
      {step === 3 && (
        <div className="space-y-6">
          <section className={cartao}>
            <h2 className="mb-4 text-base font-semibold text-foreground">Capa e cor do evento</h2>
            <CapaEventoCampo
              evento={{ id: existingEvent.id, title: formData.title, date: formData.date }}
              urlAtual={removida ? null : existingEvent.cover_image}
              capa={capa}
              onCapa={setCapa}
              onRemover={() => setRemovida(temFoto(existingEvent.cover_image))}
              cor={corEditada?.valor ?? (ehHex(existingEvent.accent_color) ? existingEvent.accent_color : corSorteada(existingEvent.id))}
              corManual={!!corEditada?.manual}
              onCor={(valor, manual) => setCorEditada(c => ({ valor, manual: manual || !!c?.manual }))}
              ocupado={salvando}
              podeEnviar={existingEvent.producer_id === user?.id}
              avisoAnalise
            />
          </section>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setStep(2)}>Voltar</Button>
            <Button onClick={() => setStep(4)}>Próximo</Button>
          </div>
        </div>
      )}

      {/* Passo 4: Revisão */}
      {step === 4 && (
        <div className="space-y-6">
          <section className={cartao}>
            <h2 className="mb-2 text-base font-semibold text-foreground">Revisão</h2>
            <dl className="divide-y divide-border text-sm">
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-muted-foreground">Título</dt>
                <dd className="text-right font-medium text-foreground">{formData.title || '-'}</dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-muted-foreground">Data</dt>
                <dd className="text-right font-medium text-foreground">
                  {formData.date ? new Date(formData.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-muted-foreground">Local</dt>
                <dd className="text-right font-medium text-foreground">{formData.location || '-'}</dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-muted-foreground">Ingressos</dt>
                <dd className="text-right font-medium text-foreground">{tickets.length} tipo(s)</dd>
              </div>
            </dl>
            <p className="mt-4 rounded-lg border border-border bg-muted p-3 text-sm text-foreground">
              Ao salvar as alterações, o evento volta para a análise da equipe e fica visível ao público depois da aprovação.
            </p>
          </section>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setStep(3)}>Voltar</Button>
            <Button onClick={handleSave} disabled={salvando}>
              {salvando ? (capa ? 'Enviando a foto…' : 'Salvando…') : <><Check aria-hidden="true" />Salvar alterações</>}
            </Button>
          </div>
        </div>
      )}

      {/* Match de Mesa: só o dono do evento (editor da equipe e outro produtor não) e só com ingresso coletiva */}
      {existingEvent.producer_id === user?.id && existingEvent.ticket_types?.some(t => t.type === 'coletiva') && (
        <MatchDeMesaPanel eventId={existingEvent.id} />
      )}
    </div>
  )
}
