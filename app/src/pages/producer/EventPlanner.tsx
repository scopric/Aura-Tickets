import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Music, Heart, Mic, Building, Guitar, Cake, GraduationCap, ArrowRight, ArrowLeft, Check, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import CapaEventoCampo from '../../components/producer/CapaEventoCampo'
import { enviarEGravarCapa, useLiberarPrevia, type CapaPronta } from '../../lib/capaEvento'
import { corSorteada } from '../../lib/corEvento'
import { useAuth } from '../../hooks/useAuth'
import { useCreateEvent } from '../../hooks/useEvents'
import { brl } from '../../lib/taxa'
import { eventProfiles } from '../../data/eventManagerData'
import type { EventProfile } from '../../data/eventManagerData'
import { PageHeader } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'

const cartao = 'rounded-[10px] border border-border bg-card p-4 sm:p-6'
const bloco = 'rounded-lg border border-border p-4'
const icone = 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'

const profileIcons: Record<EventProfile, typeof Music> = {
  balada: Music, casamento: Heart, festival: Mic,
  corporativo: Building, show: Guitar, aniversario: Cake, formatura: GraduationCap,
}


interface TicketBatch {
  id: string
  name: string
  price: string
  quantity: string
  startDate: string
  endDate: string
  description: string
}

interface ExpenseItem {
  id: string
  category: string
  item: string
  cost: string
}

export default function EventPlanner() {
  const navigate = useNavigate()
  const createEvent = useCreateEvent()
  const { user } = useAuth()
  const [capa, setCapa] = useState<CapaPronta | null>(null) // foto pronta; só sobe depois de o evento existir
  const [cor, setCor] = useState<{ valor: string; manual: boolean } | null>(null) // null: ainda a cor sorteada pelo título
  const [salvando, setSalvando] = useState(false) // cobre o criar + enviar a foto: sem clique duplo
  useLiberarPrevia(capa)
  const [step, setStep] = useState(1)
  const [data, setData] = useState({
    profile: '' as EventProfile | '',
    title: '',
    date: '',
    time: '',
    location: '',
    capacity: '',
    description: '',
    batches: [] as TicketBatch[],
    expenses: [] as ExpenseItem[],
    feeType: 'absorved' as 'absorved' | 'passed',
    platformFee: '10',
    cardFee: '3.9',
  })

  const steps = [
    { num: 1, label: 'Tipo' },
    { num: 2, label: 'Informações' },
    { num: 3, label: 'Lotes' },
    { num: 4, label: 'Custos' },
    { num: 5, label: 'Resumo' },
  ]

  const defaultBatches: TicketBatch[] = [
    { id: '1', name: 'Early Bird', price: '', quantity: '', startDate: '', endDate: '', description: 'Promoção inicial, limitada' },
    { id: '2', name: '1º lote', price: '', quantity: '', startDate: '', endDate: '', description: 'Primeiro lote oficial' },
    { id: '3', name: '2º lote', price: '', quantity: '', startDate: '', endDate: '', description: 'Segundo lote' },
    { id: '4', name: 'Pista', price: '', quantity: '', startDate: '', endDate: '', description: 'Ingresso pista' },
  ]

  const defaultExpenses: ExpenseItem[] = [
    { id: '1', category: 'Local', item: 'Aluguel do espaço', cost: '' },
    { id: '2', category: 'Som & Luz', item: 'Equipamento', cost: '' },
    { id: '3', category: 'Artista/DJ', item: 'Contratação', cost: '' },
    { id: '4', category: 'Segurança', item: 'Equipe', cost: '' },
    { id: '5', category: 'Marketing', item: 'Divulgação', cost: '' },
    { id: '6', category: 'Outros', item: 'Imprevistos', cost: '' },
  ]

  const canNext = () => {
    if (step === 1) return !!data.profile
    if (step === 2) return !!data.title && !!data.date && !!data.time && !!data.location && !!data.capacity
    if (step === 3) return data.batches.length > 0 && data.batches.some(b => b.price && b.quantity)
    return true
  }

  const calculations = useMemo(() => {
    const capacity = Number(data.capacity) || 0
    const totalTicketRevenue = data.batches.reduce((sum, b) => sum + (Number(b.price) || 0) * (Number(b.quantity) || 0), 0)
    const totalExpenses = data.expenses.reduce((sum, e) => sum + (Number(e.cost) || 0), 0)
    const platformFeePct = Number(data.platformFee) || 0
    const cardFeePct = Number(data.cardFee) || 0
    const totalFees = totalTicketRevenue * (platformFeePct + cardFeePct) / 100
    const netRevenue = totalTicketRevenue - totalFees
    const profit = netRevenue - totalExpenses
    const avgTicketPrice = capacity > 0 ? totalTicketRevenue / capacity : 0
    const breakEvenTickets = avgTicketPrice > 0 ? Math.ceil(totalExpenses / avgTicketPrice) : 0
    const profitMargin = totalTicketRevenue > 0 ? ((profit / totalTicketRevenue) * 100).toFixed(1) : '0'
    const costPerPerson = capacity > 0 ? totalExpenses / capacity : 0
    const minTicketPrice = capacity > 0 ? (totalExpenses * 1.3) / capacity : 0

    return {
      totalTicketRevenue,
      totalExpenses,
      totalFees,
      netRevenue,
      profit,
      avgTicketPrice,
      breakEvenTickets,
      profitMargin,
      costPerPerson,
      minTicketPrice,
    }
  }, [data])

  const handleFinish = async () => {
    setSalvando(true)
    try {
      const eventData = {
        title: data.title,
        description: data.description,
        date: data.date,
        time: data.time,
        location: data.location,
        capacity: Number(data.capacity) || null,
        category: data.profile ? eventProfiles[data.profile as EventProfile].label : 'Outros',
        status: 'published' as const, // Criar publicado por padrão para aparecer na listagem
        cover_image: '/images/hero-bg.jpg', // Placeholder de imagem premium; a foto entra depois, quando o evento já existe
        accent_color: cor?.valor ?? corSorteada(data.title || 'evento'),
      }

      const ticketsData = data.batches
        .filter(b => b.price && b.quantity)
        .map(b => ({
          name: b.name,
          price: Number(b.price) || 0,
          capacity: Number(b.quantity) || 0,
          description: b.description || null,
          type: 'individual' as const,
        }))

      const novo = (await createEvent.mutateAsync({
        event: eventData,
        tickets: ticketsData
      })) as { id: string }

      let fotoFalhou = false
      if (capa && user?.id) {
        fotoFalhou = !(await enviarEGravarCapa(capa, user.id, novo.id))
      }
      if (fotoFalhou) toast.warning('Evento criado, mas a foto de capa não foi enviada. Abra "Editar evento" para enviar de novo.')
      else toast.success('Evento criado. Ele passa pela análise da equipe antes de aparecer ao público.')
      setTimeout(() => navigate('/producer/events'), 800)
    } catch (err: any) {
      setSalvando(false)
      toast.error(err.message || 'Erro ao salvar o evento no Supabase')
    }
  }

  const addBatch = () => {
    const names = ['VIP', 'Mesa Coletiva', 'Camarote', 'Backstage', 'Open Bar']
    const used = data.batches.map(b => b.name)
    const next = names.find(n => !used.includes(n)) || `Lote ${data.batches.length + 1}`
    setData({ ...data, batches: [...data.batches, { id: Date.now().toString(), name: next, price: '', quantity: '', startDate: '', endDate: '', description: '' }] })
  }

  const removeBatch = (id: string) => {
    setData({ ...data, batches: data.batches.filter(b => b.id !== id) })
  }

  const updateBatch = (id: string, field: keyof TicketBatch, value: string) => {
    setData({ ...data, batches: data.batches.map(b => b.id === id ? { ...b, [field]: value } : b) })
  }

  const updateExpense = (id: string, field: keyof ExpenseItem, value: string) => {
    setData({ ...data, expenses: data.expenses.map(e => e.id === id ? { ...e, [field]: value } : e) })
  }

  const addExpense = () => {
    setData({ ...data, expenses: [...data.expenses, { id: Date.now().toString(), category: 'Outros', item: '', cost: '' }] })
  }

  const removeExpense = (id: string) => {
    setData({ ...data, expenses: data.expenses.filter(e => e.id !== id) })
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Criar evento" description="Planeje em 5 passos: tipo, informações, lotes, custos e resumo" />

      {/* Passos */}
      <ol data-tour="planner-passos" className="mb-6 flex items-center">
        {steps.map((s, i) => (
          <li key={s.num} className="flex flex-1 items-center last:flex-none" aria-current={step === s.num ? 'step' : undefined}>
            <div className="flex flex-col items-center">
              <span className={`flex size-8 items-center justify-center rounded-full border text-xs font-medium tabular-nums ${step > s.num ? 'border-primary text-primary' : step === s.num ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground'}`}>
                {step > s.num ? <Check className="size-4" aria-hidden="true" /> : s.num}
              </span>
              <span className={`mt-1 text-[11px] ${step >= s.num ? 'text-foreground' : 'text-muted-foreground'}`}>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <span className={`mx-1 mb-4 h-px flex-1 sm:mx-2 ${step > s.num ? 'bg-primary' : 'bg-border'}`} aria-hidden="true" />
            )}
          </li>
        ))}
      </ol>

      <div data-tour="planner-cartao" className={cartao}>

        {/* PASSO 1 - TIPO */}
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-base font-semibold text-foreground">Que tipo de evento?</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(Object.entries(eventProfiles) as [EventProfile, typeof eventProfiles.balada][]).map(([key, profile]) => {
                const Icon = profileIcons[key]
                const isSelected = data.profile === key
                return (
                  <button key={key} type="button" aria-pressed={isSelected} onClick={() => setData({ ...data, profile: key })}
                    className={`rounded-lg border p-4 text-left transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-foreground/5'}`}>
                    <div className="mb-2 flex items-center gap-2">
                      <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                      <span className="text-sm font-medium text-foreground">{profile.label}</span>
                      {isSelected && <Check className="ml-auto size-4 text-primary" aria-hidden="true" />}
                    </div>
                    <p className="text-xs text-muted-foreground">{profile.description}</p>
                  </button>
                )
              })}
            </div>
            {data.profile && (
              <div className="rounded-lg bg-muted p-4">
                <p className="mb-2 text-xs text-muted-foreground">Itens sugeridos para o orçamento:</p>
                <ul className="flex flex-wrap gap-1.5">
                  {eventProfiles[data.profile].defaultBudget.map(item => (
                    <li key={item} className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground">{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* PASSO 2 - INFORMAÇÕES */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-foreground">Informações do evento</h2>
            <div className="grid gap-1.5">
              <Label htmlFor="plan-titulo">Nome do evento *</Label>
              <Input id="plan-titulo" value={data.title} onChange={e => setData({ ...data, title: e.target.value })} placeholder="Ex: Noite Eletro 2025" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="plan-data">Data *</Label>
                <Input id="plan-data" type="date" value={data.date} onChange={e => setData({ ...data, date: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="plan-horario">Horário *</Label>
                <Input id="plan-horario" type="time" value={data.time} onChange={e => setData({ ...data, time: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="plan-local">Local *</Label>
              <Input id="plan-local" value={data.location} onChange={e => setData({ ...data, location: e.target.value })} placeholder="Ex: Warehouse Central, São Paulo" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="plan-capacidade">Capacidade *</Label>
                <Input id="plan-capacidade" type="number" inputMode="numeric" value={data.capacity} onChange={e => setData({ ...data, capacity: e.target.value })} placeholder="500" />
              </div>
              <div className="grid gap-1.5">
                <span className="text-sm font-medium text-foreground">Tipo</span>
                <span className="flex h-9 items-center rounded-md bg-muted px-3 text-sm text-muted-foreground">{data.profile ? eventProfiles[data.profile as EventProfile].label : '-'}</span>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="plan-descricao">Descrição</Label>
              <Textarea id="plan-descricao" value={data.description} onChange={e => setData({ ...data, description: e.target.value })} rows={3} placeholder="Descreva seu evento…" className="resize-none" />
            </div>
            <div className="border-t border-border pt-4">
              <h3 className="mb-3 text-sm font-medium text-foreground">Capa e cor do evento (opcional)</h3>
              <CapaEventoCampo
                evento={{ id: data.title || 'evento', title: data.title, date: data.date }}
                capa={capa}
                onCapa={setCapa}
                onRemover={() => {}}
                cor={cor?.valor ?? corSorteada(data.title || 'evento')}
                corManual={!!cor?.manual}
                onCor={(valor, manual) => setCor(c => ({ valor, manual: manual || !!c?.manual }))}
                ocupado={salvando}
              />
            </div>
          </div>
        )}

        {/* PASSO 3 - LOTES */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-foreground">Lotes de ingresso</h2>
              <Button size="sm" onClick={addBatch}><Plus aria-hidden="true" />Adicionar lote</Button>
            </div>

            {/* Lotes sugeridos enquanto não há nenhum */}
            {data.batches.length === 0 && (
              <div className="space-y-3">
                {defaultBatches.map(b => (
                  <div key={b.id} className={`${bloco} space-y-3`}>
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor={`lote-nome-${b.id}`} className="sr-only">Nome do lote</Label>
                      <Input id={`lote-nome-${b.id}`} value={b.name} onChange={e => { const updated = defaultBatches.map(db => db.id === b.id ? { ...db, name: e.target.value } : db); setData({ ...data, batches: updated }) }} className="h-8 max-w-48 border-transparent bg-transparent px-1 font-medium shadow-none dark:bg-transparent" />
                      <Button variant="ghost" size="icon-sm" className={icone} onClick={() => setData({ ...data, batches: data.batches.filter(x => x.id !== b.id) })} aria-label={`Remover o lote ${b.name}`}><Trash2 aria-hidden="true" /></Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                      <Input aria-label={`Preço do lote ${b.name} (R$)`} type="number" inputMode="decimal" placeholder="Preço (R$)" value={b.price} onChange={e => { const updated = defaultBatches.map(db => db.id === b.id ? { ...db, price: e.target.value } : db); setData({ ...data, batches: updated }) }} />
                      <Input aria-label={`Quantidade do lote ${b.name}`} type="number" inputMode="numeric" placeholder="Quantidade" value={b.quantity} onChange={e => { const updated = defaultBatches.map(db => db.id === b.id ? { ...db, quantity: e.target.value } : db); setData({ ...data, batches: updated }) }} />
                      <Input aria-label={`Início das vendas do lote ${b.name}`} type="date" value={b.startDate} onChange={e => { const updated = defaultBatches.map(db => db.id === b.id ? { ...db, startDate: e.target.value } : db); setData({ ...data, batches: updated }) }} />
                      <Input aria-label={`Fim das vendas do lote ${b.name}`} type="date" value={b.endDate} onChange={e => { const updated = defaultBatches.map(db => db.id === b.id ? { ...db, endDate: e.target.value } : db); setData({ ...data, batches: updated }) }} />
                    </div>
                    <Input aria-label={`Descrição do lote ${b.name}`} placeholder="Descrição (opcional)" value={b.description} onChange={e => { const updated = defaultBatches.map(db => db.id === b.id ? { ...db, description: e.target.value } : db); setData({ ...data, batches: updated }) }} />
                  </div>
                ))}
              </div>
            )}

            {/* Lotes do produtor */}
            {data.batches.length > 0 && (
              <div className="space-y-3">
                {data.batches.map(b => (
                  <div key={b.id} className={`${bloco} space-y-3`}>
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor={`lote-nome-${b.id}`} className="sr-only">Nome do lote</Label>
                      <Input id={`lote-nome-${b.id}`} value={b.name} onChange={e => updateBatch(b.id, 'name', e.target.value)} className="h-8 max-w-48 border-transparent bg-transparent px-1 font-medium shadow-none dark:bg-transparent" />
                      <Button variant="ghost" size="icon-sm" className={icone} onClick={() => removeBatch(b.id)} aria-label={`Remover o lote ${b.name}`}><Trash2 aria-hidden="true" /></Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                      <Input aria-label={`Preço do lote ${b.name} (R$)`} type="number" inputMode="decimal" placeholder="Preço (R$)" value={b.price} onChange={e => updateBatch(b.id, 'price', e.target.value)} />
                      <Input aria-label={`Quantidade do lote ${b.name}`} type="number" inputMode="numeric" placeholder="Quantidade" value={b.quantity} onChange={e => updateBatch(b.id, 'quantity', e.target.value)} />
                      <Input aria-label={`Início das vendas do lote ${b.name}`} type="date" value={b.startDate} onChange={e => updateBatch(b.id, 'startDate', e.target.value)} />
                      <Input aria-label={`Fim das vendas do lote ${b.name}`} type="date" value={b.endDate} onChange={e => updateBatch(b.id, 'endDate', e.target.value)} />
                    </div>
                    <Input aria-label={`Descrição do lote ${b.name}`} placeholder="Descrição (opcional)" value={b.description} onChange={e => updateBatch(b.id, 'description', e.target.value)} />
                  </div>
                ))}
              </div>
            )}

            {/* Atalhos de lote */}
            <div className="flex flex-wrap gap-1">
              {['VIP', 'Mesa Coletiva', 'Camarote', 'Backstage'].filter(n => !data.batches.some(b => b.name === n)).map(name => (
                <Button key={name} variant="outline" size="sm" onClick={() => setData({ ...data, batches: [...data.batches, { id: Date.now().toString() + name, name, price: '', quantity: '', startDate: '', endDate: '', description: '' }] })}>
                  <Plus aria-hidden="true" />{name}
                </Button>
              ))}
            </div>

            {/* Prévia */}
            {calculations.totalTicketRevenue > 0 && (
              <dl className="space-y-2 rounded-lg bg-muted p-4 text-xs">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Total de ingressos</dt>
                  <dd className="font-medium tabular-nums text-foreground">{data.batches.reduce((s, b) => s + (Number(b.quantity) || 0), 0)} / {data.capacity}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Receita bruta projetada</dt>
                  <dd className="font-medium tabular-nums text-foreground">{brl(calculations.totalTicketRevenue)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Preço médio</dt>
                  <dd className="font-medium tabular-nums text-foreground">{brl(calculations.avgTicketPrice)}</dd>
                </div>
              </dl>
            )}
          </div>
        )}

        {/* PASSO 4 - CUSTOS */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-foreground">Custos do evento</h2>
              <Button size="sm" onClick={addExpense}><Plus aria-hidden="true" />Adicionar</Button>
            </div>

            <div className="space-y-2">
              {(data.expenses.length > 0 ? data.expenses : defaultExpenses).map((e, i) => (
                <div key={e.id} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 lg:grid-cols-[1fr_2fr_1fr_auto]">
                  <Input aria-label={`Categoria do custo ${i + 1}`} placeholder="Categoria" value={e.category} onChange={ev => data.expenses.length > 0 ? updateExpense(e.id, 'category', ev.target.value) : setData({ ...data, expenses: defaultExpenses.map((de, di) => di === i ? { ...de, category: ev.target.value } : de) })} />
                  <Input aria-label={`Item do custo ${i + 1}`} placeholder="Item" value={e.item} onChange={ev => data.expenses.length > 0 ? updateExpense(e.id, 'item', ev.target.value) : setData({ ...data, expenses: defaultExpenses.map((de, di) => di === i ? { ...de, item: ev.target.value } : de) })} className="col-span-2 row-start-2 lg:col-span-1 lg:row-start-auto" />
                  <Input aria-label={`Valor do custo ${i + 1} (R$)`} type="number" inputMode="decimal" placeholder="R$" value={e.cost} onChange={ev => data.expenses.length > 0 ? updateExpense(e.id, 'cost', ev.target.value) : setData({ ...data, expenses: defaultExpenses.map((de, di) => di === i ? { ...de, cost: ev.target.value } : de) })} />
                  <Button variant="ghost" size="icon-sm" className={icone} onClick={() => data.expenses.length > 0 ? removeExpense(e.id) : setData({ ...data, expenses: defaultExpenses.filter((_, di) => di !== i) })} aria-label={`Remover o custo ${e.item || i + 1}`}><Trash2 aria-hidden="true" /></Button>
                </div>
              ))}
            </div>

            {calculations.totalExpenses > 0 && (
              <dl className="space-y-1 rounded-lg bg-muted p-4 text-xs">
                <div className="flex justify-between"><dt className="text-muted-foreground">Custo total</dt><dd className="font-medium tabular-nums text-foreground">{brl(calculations.totalExpenses)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Custo por pessoa</dt><dd className="font-medium tabular-nums text-foreground">{brl(calculations.costPerPerson)}</dd></div>
              </dl>
            )}

            <div className="space-y-3 border-t border-border pt-4">
              <h3 className="text-sm font-medium text-foreground">Taxas</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="plan-taxa-plataforma" className="text-xs text-muted-foreground">Taxa da plataforma (%)</Label>
                  <Input id="plan-taxa-plataforma" type="number" inputMode="decimal" value={data.platformFee} onChange={e => setData({ ...data, platformFee: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="plan-taxa-cartao" className="text-xs text-muted-foreground">Taxa do cartão (%)</Label>
                  <Input id="plan-taxa-cartao" type="number" inputMode="decimal" value={data.cardFee} onChange={e => setData({ ...data, cardFee: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                <Label htmlFor="plan-taxa-absorvida" className="text-xs font-normal text-muted-foreground">Taxa absorvida pelo produtor</Label>
                <Switch id="plan-taxa-absorvida" className="ml-auto" checked={data.feeType === 'absorved'} onCheckedChange={v => setData({ ...data, feeType: v ? 'absorved' : 'passed' })} />
              </div>
            </div>
          </div>
        )}

        {/* PASSO 5 - RESUMO */}
        {step === 5 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">Resumo do evento</h2>
              <p className="mt-1 text-sm text-muted-foreground">Revise os dados antes de criar</p>
            </div>

            <section className={bloco}>
              <h3 className="mb-3 text-sm font-medium text-foreground">Informações</h3>
              <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                <div><dt className="inline text-muted-foreground">Evento: </dt><dd className="inline text-foreground">{data.title || '-'}</dd></div>
                <div><dt className="inline text-muted-foreground">Tipo: </dt><dd className="inline text-foreground">{data.profile ? eventProfiles[data.profile as EventProfile].label : '-'}</dd></div>
                <div><dt className="inline text-muted-foreground">Data: </dt><dd className="inline text-foreground">{data.date ? new Date(data.date + 'T00:00:00').toLocaleDateString('pt-BR') : '-'} {data.time}</dd></div>
                <div><dt className="inline text-muted-foreground">Local: </dt><dd className="inline text-foreground">{data.location || '-'}</dd></div>
                <div><dt className="inline text-muted-foreground">Capacidade: </dt><dd className="inline text-foreground">{data.capacity || '-'}</dd></div>
              </dl>
            </section>

            <section className={bloco}>
              <h3 className="mb-3 text-sm font-medium text-foreground">Lotes de ingresso</h3>
              <ul className="space-y-2">
                {(data.batches.length > 0 ? data.batches : defaultBatches).map(b => (
                  <li key={b.id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate text-foreground">{b.name}</span>
                    <span className="flex shrink-0 items-center gap-3 tabular-nums">
                      <span className="text-muted-foreground">{b.quantity || 0} ingressos</span>
                      <span className="font-medium text-foreground">{brl(Number(b.price) || 0)}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-xs">
                <span className="text-muted-foreground">Total de ingressos</span>
                <span className="font-medium tabular-nums text-foreground">{(data.batches.length > 0 ? data.batches : defaultBatches).reduce((s, b) => s + (Number(b.quantity) || 0), 0)}</span>
              </div>
            </section>

            <section className={bloco}>
              <h3 className="mb-3 text-sm font-medium text-foreground">Resumo financeiro (estimativa)</h3>
              <dl className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Receita bruta', valor: calculations.totalTicketRevenue },
                  { label: 'Custos', valor: calculations.totalExpenses },
                  { label: 'Taxas', valor: calculations.totalFees },
                  { label: 'Lucro estimado', valor: calculations.profit },
                ].map(k => (
                  <div key={k.label} className="rounded-lg bg-muted p-3">
                    <dt className="text-xs text-muted-foreground">{k.label}</dt>
                    <dd className={`text-base font-semibold tabular-nums ${k.valor < 0 ? 'text-destructive' : 'text-foreground'}`}>{brl(k.valor)}</dd>
                  </div>
                ))}
              </dl>
              <dl className="mt-3 space-y-2 border-t border-border pt-3 text-xs">
                <div className="flex justify-between"><dt className="text-muted-foreground">Receita líquida (após taxas)</dt><dd className="tabular-nums text-foreground">{brl(calculations.netRevenue)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Preço médio do ingresso</dt><dd className="tabular-nums text-foreground">{brl(calculations.avgTicketPrice)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Custo por pessoa</dt><dd className="tabular-nums text-foreground">{brl(calculations.costPerPerson)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Ponto de equilíbrio (ingressos)</dt><dd className="font-medium tabular-nums text-foreground">{calculations.breakEvenTickets}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Margem de lucro</dt><dd className={`font-medium tabular-nums ${Number(calculations.profitMargin) < 0 ? 'text-destructive' : 'text-foreground'}`}>{calculations.profitMargin.replace('.', ',')}%</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Preço mínimo recomendado</dt><dd className="font-medium tabular-nums text-foreground">{brl(calculations.minTicketPrice)}</dd></div>
              </dl>
            </section>

            <p className="rounded-lg border border-border bg-muted p-3 text-xs text-foreground">
              Depois de criar, o evento vai para a análise da equipe antes de aparecer ao público. Você edita os dados em Meus eventos.
            </p>
          </div>
        )}

        {/* Navegação */}
        <div data-tour="planner-navegacao" className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4">
          <Button variant="outline" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1}>
            <ArrowLeft aria-hidden="true" />Voltar
          </Button>
          {step < 5 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canNext()}>
              Próximo<ArrowRight aria-hidden="true" />
            </Button>
          ) : (
            <Button onClick={handleFinish} disabled={salvando}>
              {salvando ? (capa ? 'Enviando a foto…' : 'Criando…') : <><Check aria-hidden="true" />Criar evento</>}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
