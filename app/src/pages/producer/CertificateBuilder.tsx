import { useState, useRef, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { supabase } from '../../lib/supabase'
import { useProducerEvents } from '../../hooks/useEvents'
import { PageHeader, EmptyState, selectNativo } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

interface CertField {
  id: string
  type: 'text' | 'logo' | 'signature' | 'qrcode' | 'date' | 'hours'
  label: string
  x: number
  y: number
  fontSize: number
  color: string
  value: string
  width: number
  height: number
}

interface CertTemplate {
  id: string
  name: string
  category: string
  bgColor: string
  accentColor: string
  borderStyle: string
  preview: string
}

// Cores do próprio certificado (o papel é sempre claro); não são cores do painel
const templates: CertTemplate[] = [
  { id: 'classic', name: 'Clássico elegante', category: 'geral', bgColor: '#ffffff', accentColor: '#1a0e14', borderStyle: 'border-8 border-double', preview: 'Bordas duplas, tipografia serifada' },
  { id: 'modern', name: 'Moderno minimalista', category: 'tech', bgColor: '#f8f7f5', accentColor: '#7a3b69', borderStyle: 'border-l-4', preview: 'Linha lateral, fonte limpa' },
  { id: 'corporate', name: 'Corporativo', category: 'corporativo', bgColor: '#ffffff', accentColor: '#1e3a5f', borderStyle: 'border', preview: 'Azul corporativo, faixa no topo' },
  { id: 'creative', name: 'Criativo artístico', category: 'arte', bgColor: '#fdf6f0', accentColor: '#d97706', borderStyle: 'border-4 border-dashed', preview: 'Cores quentes, borda tracejada' },
  { id: 'academic', name: 'Acadêmico', category: 'educacao', bgColor: '#ffffff', accentColor: '#374151', borderStyle: 'border-2', preview: 'Sóbrio e formal' },
  { id: 'sport', name: 'Esporte e bem-estar', category: 'esporte', bgColor: '#f0fdf4', accentColor: '#16a34a', borderStyle: 'border-4', preview: 'Verde, borda larga' },
]

const defaultFields: CertField[] = [
  { id: 'logo', type: 'logo', label: 'Logo', x: 50, y: 8, fontSize: 0, color: '', value: '', width: 80, height: 40 },
  { id: 'title', type: 'text', label: 'Título', x: 50, y: 22, fontSize: 28, color: '#1a0e14', value: 'Certificado de Participação', width: 80, height: 40 },
  { id: 'subtitle', type: 'text', label: 'Subtítulo', x: 50, y: 32, fontSize: 14, color: '#7a3b69', value: 'Reconhecemos que', width: 80, height: 25 },
  { id: 'participant', type: 'text', label: 'Nome do participante', x: 50, y: 44, fontSize: 32, color: '#1a0e14', value: '{{NOME}}', width: 80, height: 50 },
  { id: 'event', type: 'text', label: 'Evento', x: 50, y: 56, fontSize: 16, color: '#44403c', value: 'participou do {{EVENTO}}', width: 80, height: 30 },
  { id: 'details', type: 'text', label: 'Detalhes', x: 50, y: 64, fontSize: 12, color: '#78716c', value: 'realizado em {{DATA}} com carga horária de {{HORAS}}h', width: 80, height: 25 },
  { id: 'signature', type: 'signature', label: 'Assinatura', x: 70, y: 80, fontSize: 14, color: '#1a0e14', value: '{{ASSINATURA}}', width: 100, height: 30 },
  { id: 'sigLabel', type: 'text', label: 'Legenda da assinatura', x: 70, y: 88, fontSize: 10, color: '#a8a29e', value: 'Assinatura do Produtor', width: 100, height: 15 },
  { id: 'qrcode', type: 'qrcode', label: 'QR Code', x: 15, y: 78, fontSize: 0, color: '', value: '', width: 50, height: 50 },
  { id: 'date', type: 'date', label: 'Data de emissão', x: 15, y: 92, fontSize: 10, color: '#a8a29e', value: '{{DATA_EMISSAO}}', width: 50, height: 15 },
]

const icone = 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
const painel = 'rounded-[10px] border border-border bg-card p-4'

export default function CertificateBuilder() {
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { data: events = [], isLoading: eventsLoading, isError: eventsError, refetch, isFetching } = useProducerEvents()
  const [pickedEventId, setPickedEventId] = useState<string | null>(null)
  // o modelo é por evento (índice único em certificates.event_id). ?eventId= só vale se for evento do produtor;
  // sem escolha válida, vale o primeiro evento
  const doLink = searchParams.get('eventId')
  const eventId = pickedEventId ?? (events.some(e => e.id === doLink) ? doLink : events[0]?.id) ?? null
  // evento cujo modelo já foi lido do banco: salvar antes disso gravaria o padrão por cima do modelo salvo
  const [carregadoPara, setCarregadoPara] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const [selectedTemplate, setSelectedTemplate] = useState<string>('classic')
  const [accentColor, setAccentColor] = useState<string | null>(null) // null = cor do modelo
  const [fields, setFields] = useState<CertField[]>(defaultFields)
  const [selectedField, setSelectedField] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [sigUrl, setSigUrl] = useState<string | null>(null)
  const [previewName, setPreviewName] = useState('Ana Beatriz Silva')
  const [previewEvent, setPreviewEvent] = useState('Workshop de Design Thinking')
  const [previewDate, setPreviewDate] = useState('15 de junho de 2025')
  const [previewHours, setPreviewHours] = useState('8')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sigInputRef = useRef<HTMLInputElement>(null)

  // Carrega o modelo salvo do evento escolhido (ou o padrão, se não houver)
  useEffect(() => {
    if (!eventId) return
    let vivo = true
    supabase
      .from('certificates')
      .select('template')
      .eq('event_id', eventId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!vivo) return
        if (error) {
          toast.error('Não foi possível carregar o modelo deste evento.')
          return
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON livre gravado por esta tela
        const tpl = ((data as { template?: any } | null)?.template ?? {}) as any
        setSelectedTemplate(typeof tpl.selectedTemplate === 'string' ? tpl.selectedTemplate : 'classic')
        // só cor hexadecimal: o valor vem do JSON do banco e vai para `style`
        setAccentColor(/^#[0-9a-f]{6}$/i.test(tpl.accentColor) ? tpl.accentColor : null)
        setFields(Array.isArray(tpl.fields) ? tpl.fields : defaultFields)
        setLogoUrl(tpl.logoUrl || null)
        setSigUrl(tpl.sigUrl || null)
        setSelectedField(null)
        setCarregadoPara(eventId)
      })
    return () => { vivo = false }
  }, [eventId])

  const handleSave = async () => {
    if (!eventId || carregadoPara !== eventId) return
    setSalvando(true)
    const { data, error } = await supabase
      .from('certificates')
      // as never: types/database.ts desatualizado (pendência supabase gen types)
      .upsert({
        event_id: eventId,
        template: { selectedTemplate, accentColor, fields, logoUrl, sigUrl },
        is_active: true,
      } as never, { onConflict: 'event_id' })
      .select('id')
    setSalvando(false)

    // sem linha de volta = a regra de acesso barrou (o PostgREST não dá erro nesse caso)
    if (error || !data?.length) {
      toast.error(error?.code === '42501' || !error ? 'Sem permissão para salvar o modelo deste evento.' : 'Não foi possível salvar o modelo.')
      return
    }
    queryClient.invalidateQueries({ queryKey: ['event-certificates', eventId] })
    toast.success('Modelo salvo.')
  }

  const baseTemplate = templates.find(t => t.id === selectedTemplate) || templates[0]
  const template = accentColor ? { ...baseTemplate, accentColor } : baseTemplate

  const updateField = (id: string, updates: Partial<CertField>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f))
  }

  const addField = (type: CertField['type']) => {
    const newField: CertField = {
      id: `f${Date.now()}`, type,
      label: 'Novo campo', x: 50, y: 50,
      fontSize: type === 'text' ? 14 : 0, color: '#1a0e14',
      value: type === 'text' ? 'Texto' : '',
      width: type === 'qrcode' ? 50 : type === 'logo' ? 80 : 60,
      height: type === 'qrcode' || type === 'logo' ? 50 : 25,
    }
    setFields([...fields, newField])
    setSelectedField(newField.id)
  }

  const removeField = (id: string) => {
    if (fields.length <= 1) { toast.error('Mantenha pelo menos um campo'); return }
    setFields(fields.filter(f => f.id !== id))
    if (selectedField === id) setSelectedField(null)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'sig') => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      if (type === 'logo') setLogoUrl(ev.target?.result as string)
      else setSigUrl(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const resolveValue = (field: CertField) => {
    return field.value
      .replace('{{NOME}}', previewName)
      .replace('{{EVENTO}}', previewEvent)
      .replace('{{DATA}}', previewDate)
      .replace('{{HORAS}}', previewHours)
      .replace('{{ASSINATURA}}', sigUrl ? '[ASSINATURA]' : '_________________')
      .replace('{{DATA_EMISSAO}}', new Date().toLocaleDateString('pt-BR'))
  }

  const selected = fields.find(f => f.id === selectedField)
  // com `loading` o botão não fica `disabled` (senão cinza e sem spinner); o loading já bloqueia o clique
  const podeSalvar = !!eventId && carregadoPara === eventId

  const header = (
    <PageHeader
      title="Editor de certificados"
      description="Monte o modelo do certificado de cada evento, com seu logo e assinatura"
      actions={
        <>
          <Button asChild variant="outline"><Link to="/producer/certificados"><I.SetaEsquerda aria-hidden="true" />Certificados</Link></Button>
          {events.length > 0 && (
            <Button onClick={handleSave} disabled={!podeSalvar} loading={salvando}>
              <I.Guardar aria-hidden="true" />Salvar modelo
            </Button>
          )}
        </>
      }
    />
  )

  if (eventsLoading) {
    return (
      <div aria-busy="true">
        {header}
        <Skeleton className="h-9 w-full max-w-sm rounded-md bg-muted" />
        <Skeleton className="mt-6 h-96 rounded-[10px] bg-muted" />
      </div>
    )
  }

  if (eventsError) {
    return (
      <div>
        {header}
        <div role="alert" className="flex flex-col gap-3 rounded-[10px] border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground">Não foi possível carregar seus eventos.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>{isFetching ? 'Carregando…' : 'Tentar de novo'}</Button>
        </div>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div>
        {header}
        <EmptyState
          title="Crie um evento antes do certificado"
          description="O modelo de certificado é salvo para um evento."
          action={<Button asChild><Link to="/producer/planner"><I.Criar aria-hidden="true" />Criar evento</Link></Button>}
        />
      </div>
    )
  }

  return (
    <div>
      {header}

      <div className="grid gap-1.5 sm:max-w-sm">
        <Label htmlFor="editor-evento">Modelo do evento</Label>
        <select id="editor-evento" value={eventId ?? ''} onChange={e => setPickedEventId(e.target.value || null)} className={selectNativo}>
          {events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
      </div>

      {/* Templates */}
      <section aria-labelledby="modelos" className={`${painel} mt-6`}>
        <h2 id="modelos" className="mb-3 text-sm font-medium text-foreground">Escolha um modelo</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {templates.map(t => (
            <button key={t.id} type="button" aria-pressed={selectedTemplate === t.id} onClick={() => { setSelectedTemplate(t.id); setAccentColor(null) }}
              className={`rounded-lg border p-3 text-center transition-colors ${selectedTemplate === t.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-foreground/5'}`}>
              <div className="mx-auto mb-2 h-16 w-12 rounded border" style={{ background: t.bgColor, borderColor: t.accentColor }} />
              <div className="text-xs font-medium text-foreground">{t.name}</div>
              <div className="text-[11px] text-muted-foreground">{t.preview}</div>
            </button>
          ))}
        </div>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Editor Sidebar */}
        <div className="space-y-4 lg:col-span-2">
          {/* Branding */}
          <section aria-labelledby="identidade" className={painel}>
            <h2 id="identidade" className="mb-3 text-sm font-medium text-foreground">Identidade visual</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="upload-logo-input" className="mb-1.5 text-xs text-muted-foreground">Logo do evento</Label>
                <input id="upload-logo-input" ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={e => handleFileChange(e, 'logo')} />
                <Button type="button" variant="outline" className="h-12 w-full" onClick={() => fileInputRef.current?.click()}>
                  {logoUrl ? <img src={logoUrl} alt="Logo do evento" className="h-8 object-contain" /> : <><I.Carregar aria-hidden="true" />Enviar</>}
                </Button>
              </div>
              <div>
                <Label htmlFor="upload-sig-input" className="mb-1.5 text-xs text-muted-foreground">Assinatura</Label>
                <input id="upload-sig-input" ref={sigInputRef} type="file" accept="image/*" className="sr-only" onChange={e => handleFileChange(e, 'sig')} />
                <Button type="button" variant="outline" className="h-12 w-full" onClick={() => sigInputRef.current?.click()}>
                  {sigUrl ? <img src={sigUrl} alt="Assinatura do produtor" className="h-8 object-contain" /> : <><I.Assinatura aria-hidden="true" />Enviar</>}
                </Button>
              </div>
            </div>
            <div className="mt-3">
              <p id="cor-destaque" className="mb-1.5 text-xs text-muted-foreground">Cor de destaque</p>
              <div role="group" aria-labelledby="cor-destaque" className="flex flex-wrap gap-2">
                {['#1a0e14', '#7a3b69', '#1e3a5f', '#d97706', '#16a34a', '#dc2626', '#0891b2'].map(c => (
                  <button key={c} type="button" onClick={() => setAccentColor(c)} aria-pressed={template.accentColor === c} aria-label={`Cor de destaque ${c}`}
                    className={`size-8 rounded-full border-2 transition-transform ${template.accentColor === c ? 'scale-110 border-foreground' : 'border-transparent'}`} style={{ background: c }} />
                ))}
              </div>
            </div>
          </section>

          {/* Preview Data */}
          <section aria-labelledby="dados-exemplo" className={painel}>
            <h2 id="dados-exemplo" className="mb-3 text-sm font-medium text-foreground">Dados de exemplo</h2>
            <div className="grid gap-2">
              <Label htmlFor="ex-nome" className="sr-only">Nome do participante</Label>
              <Input id="ex-nome" value={previewName} onChange={e => setPreviewName(e.target.value)} placeholder="Nome do participante" />
              <Label htmlFor="ex-evento" className="sr-only">Nome do evento</Label>
              <Input id="ex-evento" value={previewEvent} onChange={e => setPreviewEvent(e.target.value)} placeholder="Nome do evento" />
              <Label htmlFor="ex-data" className="sr-only">Data</Label>
              <Input id="ex-data" value={previewDate} onChange={e => setPreviewDate(e.target.value)} placeholder="Data" />
              <Label htmlFor="ex-horas" className="sr-only">Horas</Label>
              <Input id="ex-horas" value={previewHours} onChange={e => setPreviewHours(e.target.value)} placeholder="Horas" />
            </div>
          </section>

          {/* Fields List */}
          <section aria-labelledby="campos" className={painel}>
            <div className="mb-3 flex items-center justify-between">
              <h2 id="campos" className="text-sm font-medium text-foreground">Campos ({fields.length})</h2>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon-sm" className={icone} onClick={() => addField('text')} aria-label="Adicionar campo de texto"><I.Texto aria-hidden="true" /></Button>
                <Button variant="ghost" size="icon-sm" className={icone} onClick={() => addField('qrcode')} aria-label="Adicionar QR Code"><I.Qr aria-hidden="true" /></Button>
              </div>
            </div>
            <ul className="max-h-48 space-y-1 overflow-y-auto pr-1">
              {fields.map(f => (
                <li key={f.id} className={`flex items-center gap-1 rounded-md text-xs ${selectedField === f.id ? 'bg-primary/10 text-foreground' : 'text-muted-foreground'}`}>
                  <button type="button" aria-pressed={selectedField === f.id} onClick={() => setSelectedField(f.id === selectedField ? null : f.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-foreground/5">
                    {f.type === 'text' && <I.Texto size={14} aria-hidden="true" />}
                    {f.type === 'logo' && <I.Imagem size={14} aria-hidden="true" />}
                    {f.type === 'signature' && <I.Assinatura size={14} aria-hidden="true" />}
                    {f.type === 'qrcode' && <I.Qr size={14} aria-hidden="true" />}
                    {f.type === 'date' && <I.Eventos size={14} aria-hidden="true" />}
                    <span className="truncate">{f.label}</span>
                  </button>
                  <Button variant="ghost" size="icon-sm" className={icone} onClick={() => removeField(f.id)} aria-label={`Remover o campo ${f.label}`}>
                    <I.Lixeira aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          </section>

          {/* Field Editor */}
          {selected && (
            <section aria-labelledby="editar-campo" className={painel}>
              <h2 id="editar-campo" className="mb-3 text-sm font-medium text-foreground">Editar: {selected.label}</h2>
              <div className="space-y-3">
                {selected.type === 'text' && (
                  <>
                    <div className="grid gap-1.5">
                      <Label htmlFor="selected-field-value" className="text-xs text-muted-foreground">Texto ou variável</Label>
                      <Input id="selected-field-value" value={selected.value} onChange={e => updateField(selected.id, { value: e.target.value })} placeholder="Use {{NOME}}, {{EVENTO}}, {{DATA}}, {{HORAS}}" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="grid gap-1.5">
                        <Label htmlFor="selected-field-font-size" className="text-xs text-muted-foreground">Tamanho (px)</Label>
                        <Input id="selected-field-font-size" type="number" value={selected.fontSize} onChange={e => updateField(selected.id, { fontSize: Number(e.target.value) })} />
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor="selected-field-color" className="text-xs text-muted-foreground">Cor</Label>
                        <Input id="selected-field-color" type="color" value={selected.color} onChange={e => updateField(selected.id, { color: e.target.value })} className="cursor-pointer p-1" />
                      </div>
                    </div>
                  </>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="selected-field-pos-x" className="text-xs text-muted-foreground">Posição X (%)</Label>
                    <Input id="selected-field-pos-x" type="number" value={selected.x} min={0} max={100} onChange={e => updateField(selected.id, { x: Number(e.target.value) })} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="selected-field-pos-y" className="text-xs text-muted-foreground">Posição Y (%)</Label>
                    <Input id="selected-field-pos-y" type="number" value={selected.y} min={0} max={100} onChange={e => updateField(selected.id, { y: Number(e.target.value) })} />
                  </div>
                </div>
              </div>
            </section>
          )}

          <p className="text-xs text-muted-foreground">
            A emissão para os participantes é feita na tela <Link to="/producer/certificados" className="text-foreground underline underline-offset-4">Certificados</Link>. O envio por e-mail e o PDF ainda não existem.
          </p>
        </div>

        {/* Preview */}
        <div className="min-w-0 lg:col-span-3">
          <div className="lg:sticky lg:top-6">
            <h2 className="mb-3 text-sm font-medium text-foreground">Prévia do certificado</h2>
            <div className={`relative mx-auto aspect-[1.414/1] max-w-[700px] overflow-hidden rounded-[10px] bg-white ${template.borderStyle}`}
              style={{ borderColor: template.accentColor }}>
              {/* Background */}
              <div className="absolute inset-0" style={{ background: template.bgColor }} />

              {/* Decorative elements */}
              {template.id === 'classic' && (
                <>
                  <div className="absolute bottom-6 left-6 right-6 top-6 rounded-xl border-2" style={{ borderColor: template.accentColor + '30' }} />
                  <div className="absolute bottom-10 left-10 right-10 top-10 rounded-xl border" style={{ borderColor: template.accentColor + '15' }} />
                </>
              )}
              {template.id === 'modern' && (
                <div className="absolute bottom-0 left-0 top-0 w-2" style={{ background: template.accentColor }} />
              )}
              {template.id === 'corporate' && (
                <div className="absolute left-0 right-0 top-0 h-2" style={{ background: template.accentColor }} />
              )}

              {/* Fields */}
              {fields.map(field => (
                <div key={field.id}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 text-center ${selectedField === field.id ? 'ring-2 ring-primary/50' : ''} ${field.type === 'qrcode' ? 'flex items-center justify-center rounded-lg bg-neutral-900' : ''}`}
                  style={{
                    left: `${field.x}%`,
                    top: `${field.y}%`,
                    fontSize: `${field.fontSize}px`,
                    color: field.color,
                    width: `${field.width}%`,
                  }}>
                  {field.type === 'logo' && logoUrl && <img src={logoUrl} alt="Logo do evento no certificado" className="mx-auto max-h-16 object-contain" />}
                  {field.type === 'logo' && !logoUrl && <div className="text-xs text-neutral-500">LOGO</div>}
                  {field.type === 'signature' && sigUrl && <img src={sigUrl} alt="Assinatura do produtor no certificado" className="mx-auto max-h-10 object-contain" />}
                  {field.type === 'signature' && !sigUrl && <div className="text-lg" style={{ color: field.color }}>_________________</div>}
                  {field.type === 'qrcode' && <I.Qr size={48} className="text-white" aria-hidden="true" />}
                  {field.type === 'text' && <div style={{ fontSize: `${field.fontSize}px`, color: field.color, fontWeight: field.fontSize > 20 ? 600 : 400 }}>{resolveValue(field)}</div>}
                  {field.type === 'date' && <div style={{ fontSize: `${field.fontSize}px`, color: field.color }}>{resolveValue(field)}</div>}
                  {field.type === 'hours' && <div style={{ fontSize: `${field.fontSize}px`, color: field.color }}>{resolveValue(field)}</div>}
                </div>
              ))}
            </div>

            {/* Variables help */}
            <div className={`${painel} mt-4`}>
              <h3 className="mb-2 text-xs font-medium text-foreground">Variáveis disponíveis</h3>
              <div className="flex flex-wrap gap-2">
                {['{{NOME}}', '{{EVENTO}}', '{{DATA}}', '{{HORAS}}', '{{ASSINATURA}}', '{{DATA_EMISSAO}}'].map(v => (
                  <Button key={v} variant="secondary" size="sm" className="h-7 font-mono text-[11px]" onClick={() => { navigator.clipboard.writeText(v); toast.success('Variável copiada.') }} aria-label={`Copiar ${v}`}>
                    <I.Copiar aria-hidden="true" /> {v}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
