import { useState, useRef, useEffect, type PointerEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { supabase } from '../../lib/supabase'
import { useProducerEvents } from '../../hooks/useEvents'
import { useParticipantesCertificado } from '../../hooks/useProducerTools'
import { useLogoProdutor } from '../../hooks/useLogoProdutor'
import {
  FONTES, LIMITES, MODELOS, VARIAVEIS, aplicarModelo, camposPadrao, dataLonga, desfazer, erroDaImagem, histVazio, imagemSegura,
  modeloComCor, modeloPorId, mover, refazer, registrar, sanearTemplate,
  type Alinhamento, type Campo, type DadosCertificado, type FonteId, type Hist,
} from '../../lib/certificados'
import { PageHeader, EmptyState, Erro, selectNativo } from '@/components/producer/ui'
import { CertificadoDesenho, ImpressaoCertificados, MiniaturaModelo } from '@/components/producer/CertificadoDesenho'
import GaleriaModelos from '@/components/producer/GaleriaModelos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Segmented } from '@/components/ui/toggle-group'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

// O que desfazer/refazer guarda: os campos e o modelo (trocar de modelo também volta)
interface Estado { fields: Campo[]; modelo: string; accent: string | null }

const icone = 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
const painel = 'rounded-[10px] border border-border bg-card p-4'
const campoNum = 'min-h-11'
const CORES = ['#1a0e14', '#7a3b69', '#1e3a5f', '#d97706', '#16a34a', '#dc2626', '#0891b2']
const ALINHAMENTOS = [{ value: 'left', label: 'Esquerda' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Direita' }]

export default function CertificateBuilder() {
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { data: events = [], isLoading: eventsLoading, isError: eventsError, refetch, isFetching } = useProducerEvents()
  const [pickedEventId, setPickedEventId] = useState<string | null>(null)
  // o modelo é por evento (índice único em certificates.event_id). ?eventId= só vale se for evento do produtor;
  // sem escolha válida, vale o primeiro evento
  const doLink = searchParams.get('eventId')
  const eventId = pickedEventId ?? (events.some(e => e.id === doLink) ? doLink : events[0]?.id) ?? null
  const evento = events.find(e => e.id === eventId)
  // evento cujo modelo já foi lido do banco: salvar antes disso gravaria o padrão por cima do modelo salvo
  const [carregadoPara, setCarregadoPara] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const [estado, setEstado] = useState<Estado>({ fields: camposPadrao(), modelo: 'classic', accent: null })
  const [hist, setHist] = useState<Hist<Estado>>(histVazio)
  const [selectedField, setSelectedField] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [sigUrl, setSigUrl] = useState<string | null>(null)
  const [horas, setHoras] = useState('')
  const [previewName, setPreviewName] = useState('Ana Beatriz Silva')
  // evento e data da prévia partem do evento real; o que o produtor digita vale só para o evento em que digitou
  const [exemplo, setExemplo] = useState<{ eventId: string | null; evento?: string; data?: string }>({ eventId: null })
  const ex: typeof exemplo = exemplo.eventId === eventId ? exemplo : { eventId }
  const previewEvent = ex.evento ?? evento?.title ?? 'Workshop de Design Thinking'
  const previewDate = ex.data ?? (dataLonga(evento?.date) || '15 de junho de 2026')
  const [participanteId, setParticipanteId] = useState('')
  const [galeria, setGaleria] = useState(false)
  const [modeloPendente, setModeloPendente] = useState<string | null>(null)
  const [imprimindo, setImprimindo] = useState(0) // número do pedido de impressão (0 = nenhum); vira a key do contêiner
  const pedidos = useRef(0)
  const arrasto = useRef<(() => void) | null>(null)
  // logo/assinatura que o banco tinha mas o saneamento recusou: ficam guardadas para o Salvar não apagar sem o produtor perceber
  const [descartadas, setDescartadas] = useState<{ logo?: unknown; sig?: unknown }>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sigInputRef = useRef<HTMLInputElement>(null)
  const papelRef = useRef<HTMLDivElement>(null)

  const participantesQ = useParticipantesCertificado(eventId)
  const participantes = participantesQ.data?.lista ?? []
  const { logo: logoOrg } = useLogoProdutor()

  // Carrega o modelo salvo do evento escolhido (ou o padrão, se não houver). O JSON do banco passa por sanearTemplate.
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
        const t = sanearTemplate((data as { template?: unknown } | null)?.template)
        setEstado({ fields: t.fields, modelo: t.selectedTemplate, accent: t.accentColor })
        setHist(histVazio())
        setLogoUrl(t.logoUrl)
        setSigUrl(t.sigUrl)
        setDescartadas({ logo: t.logoDescartada, sig: t.sigDescartada })
        if (t.logoDescartada || t.sigDescartada) {
          toast.warning(`${t.logoDescartada && t.sigDescartada ? 'O logo e a assinatura salvos antes estão' : t.logoDescartada ? 'O logo salvo antes está' : 'A assinatura salva antes está'} num formato que não é mais aceito; envie de novo em PNG, JPG ou WebP.`)
        }
        setHoras(t.horas)
        setSelectedField(null)
        setParticipanteId('')
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
        template: { selectedTemplate: estado.modelo, accentColor: estado.accent, fields: estado.fields, logoUrl: logoUrl ?? descartadas.logo ?? null, sigUrl: sigUrl ?? descartadas.sig ?? null, horas },
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

  const { fields } = estado
  const modelo = modeloComCor(modeloPorId(estado.modelo), estado.accent)

  // Toda edição guarda o estado anterior; digitar seguido no mesmo campo (mesma chave) vira um passo só
  const aplicar = (novo: Estado, chave: string | null = null) => {
    setHist(h => registrar(h, estado, chave))
    setEstado(novo)
  }
  const updateField = (id: string, patch: Partial<Campo>, chave: string | null = null) =>
    aplicar({ ...estado, fields: fields.map(f => (f.id === id ? { ...f, ...patch } : f)) }, chave)
  const limparChave = () => setHist(h => (h.chave ? { ...h, chave: null } : h))
  const selecionar = (id: string | null) => { setSelectedField(id); limparChave() }
  const desfaz = () => { const r = desfazer(hist, estado); if (r) { setHist(r.hist); setEstado(r.estado) } }
  const refaz = () => { const r = refazer(hist, estado); if (r) { setHist(r.hist); setEstado(r.estado) } }

  const moverCampo = (id: string, dx: number, dy: number) =>
    aplicar({ ...estado, fields: fields.map(f => (f.id === id ? mover(f, dx, dy) : f)) }, `mover:${id}`)

  // Arrastar com mouse ou toque: um passo no histórico por arrasto
  const arrastar = (id: string, e: PointerEvent<HTMLDivElement>) => {
    const papel = papelRef.current
    const campo = fields.find(f => f.id === id)
    if (!papel || !campo || e.button > 0) return
    selecionar(id)
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const r = papel.getBoundingClientRect()
    if (!r.width || !r.height) return
    const ini = { px: e.clientX, py: e.clientY, x: campo.x, y: campo.y, antes: estado, moveu: false }
    const andar = (m: globalThis.PointerEvent) => {
      if (!ini.moveu) { ini.moveu = true; setHist(h => registrar(h, ini.antes)) }
      const x = Math.min(100, Math.max(0, ini.x + ((m.clientX - ini.px) / r.width) * 100))
      const y = Math.min(100, Math.max(0, ini.y + ((m.clientY - ini.py) / r.height) * 100))
      setEstado(s => ({ ...s, fields: s.fields.map(f => (f.id === id ? { ...f, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 } : f)) }))
    }
    const fim = () => { window.removeEventListener('pointermove', andar); window.removeEventListener('pointerup', fim); window.removeEventListener('pointercancel', fim) }
    window.addEventListener('pointermove', andar)
    window.addEventListener('pointerup', fim)
    window.addEventListener('pointercancel', fim)
    arrasto.current = fim
  }
  useEffect(() => () => arrasto.current?.(), [])

  const addField = (type: Campo['type']) => {
    let n = fields.length
    while (fields.some(f => f.id === `n${n}`)) n++
    const novo: Campo = {
      id: `n${n}`, type, label: type === 'qrcode' ? 'QR Code' : 'Novo campo', x: 50, y: 50,
      fontSize: type === 'text' ? 14 : 0, color: modelo.tinta, value: type === 'text' ? 'Texto' : '',
      width: type === 'qrcode' ? 12 : 60,
    }
    aplicar({ ...estado, fields: [...fields, novo] })
    setSelectedField(novo.id)
  }

  const removeField = (id: string) => {
    if (fields.length <= 1) { toast.error('Mantenha pelo menos um campo'); return }
    aplicar({ ...estado, fields: fields.filter(f => f.id !== id) })
    if (selectedField === id) setSelectedField(null)
  }

  // Troca de modelo: textos e posições ficam; pede confirmação se já houve edição nesta sessão (e dá para desfazer)
  const usarModelo = (id: string) => aplicar({ fields: aplicarModelo(fields, modeloPorId(id)), modelo: id, accent: null })
  const pedirModelo = (id: string) => {
    if (id === estado.modelo) return
    if (hist.passado.length > 0) setModeloPendente(id); else usarModelo(id)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'sig') => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const erro = erroDaImagem(file)
    if (erro) { toast.error(erro); return }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const url = imagemSegura(ev.target?.result)
      if (!url) { toast.error('Não foi possível usar essa imagem.'); return }
      if (type === 'logo') setLogoUrl(url); else setSigUrl(url)
    }
    reader.readAsDataURL(file)
  }

  const real = participantes.find(p => p.user_id === participanteId)
  const dados: DadosCertificado = {
    nome: real?.nome ?? previewName, evento: previewEvent, data: previewDate, horas: horas || '___',
    emissao: new Date().toLocaleDateString('pt-BR'), codigo: 'EXEMPLO',
  }

  const selected = fields.find(f => f.id === selectedField)
  const ehTexto = selected && (selected.type === 'text' || selected.type === 'date' || selected.type === 'hours')
  // com `loading` o botão não fica `disabled` (senão cinza e sem spinner); o loading já bloqueia o clique
  const podeSalvar = !!eventId && carregadoPara === eventId
  const certificadosUrl = `/producer/certificados${eventId ? `?eventId=${eventId}` : ''}`

  const header = (
    <PageHeader
      title="Editor de certificados"
      description="Monte o modelo do certificado de cada evento, com seu logo e assinatura"
      actions={
        <>
          <Button asChild variant="outline" className="min-h-11"><Link to={certificadosUrl}><I.SetaEsquerda aria-hidden="true" />Certificados</Link></Button>
          {events.length > 0 && (
            <Button className="min-h-11" onClick={handleSave} disabled={!podeSalvar} loading={salvando}>
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
    return <div>{header}<Erro texto="Não foi possível carregar seus eventos." refetch={() => refetch()} carregando={isFetching} /></div>
  }

  if (events.length === 0) {
    return (
      <div>
        {header}
        <EmptyState
          title="Crie um evento antes do certificado"
          description="O modelo de certificado é salvo para um evento."
          action={<Button asChild className="min-h-11"><Link to="/producer/events/new"><I.Criar aria-hidden="true" />Criar evento</Link></Button>}
        />
      </div>
    )
  }

  return (
    <div>
      {header}

      <div className="grid gap-1.5 sm:max-w-sm">
        <Label htmlFor="editor-evento">Modelo do evento</Label>
        <select id="editor-evento" value={eventId ?? ''} onChange={e => setPickedEventId(e.target.value || null)} className={`${selectNativo} min-h-11`}>
          {events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
      </div>

      {/* Modelos: os 6 primeiros aqui; a galeria tem todos */}
      <section aria-labelledby="modelos" className={`${painel} mt-6`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="modelos" className="text-sm font-medium text-foreground">Modelo: {modelo.nome}</h2>
          <Button variant="outline" size="sm" className="min-h-11" onClick={() => setGaleria(true)}>Ver mais modelos ({MODELOS.length - 6})</Button>
        </div>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {MODELOS.slice(0, 6).map(m => (
            <li key={m.id}>
              <button type="button" aria-pressed={estado.modelo === m.id} onClick={() => pedirModelo(m.id)}
                className={`block min-h-11 w-full rounded-lg border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${estado.modelo === m.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-foreground/5'}`}>
                <MiniaturaModelo modelo={m} />
                <span className="mt-2 block text-xs font-medium text-foreground">{m.nome}</span>
                <span className="block text-[11px] text-muted-foreground">{m.descricao}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <GaleriaModelos aberto={galeria} onFechar={() => setGaleria(false)} atual={estado.modelo} onUsar={pedirModelo} />
      <AlertDialog open={!!modeloPendente} onOpenChange={o => { if (!o) setModeloPendente(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Trocar o modelo?</AlertDialogTitle>
            <AlertDialogDescription>Os textos e as posições que você editou ficam. Cores e fontes dos campos voltam ao padrão do novo modelo. Dá para desfazer logo depois.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Voltar</AlertDialogCancel>
            <AlertDialogAction className="min-h-11" onClick={() => { if (modeloPendente) usarModelo(modeloPendente); setModeloPendente(null) }}>Trocar modelo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Editor Sidebar */}
        <div className="space-y-4 lg:col-span-2">
          {/* Branding */}
          <section aria-labelledby="identidade" className={painel}>
            <h2 id="identidade" className="mb-3 text-sm font-medium text-foreground">Identidade visual</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="upload-logo-input" className="mb-1.5 text-xs text-muted-foreground">Logo do evento</Label>
                <input id="upload-logo-input" ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={e => handleFileChange(e, 'logo')} />
                <Button type="button" variant="outline" className="h-12 w-full" onClick={() => fileInputRef.current?.click()}>
                  {logoUrl ? <img src={logoUrl} alt="Logo do evento" className="h-8 object-contain" /> : <><I.Carregar aria-hidden="true" />Enviar</>}
                </Button>
              </div>
              <div>
                <Label htmlFor="upload-sig-input" className="mb-1.5 text-xs text-muted-foreground">Assinatura</Label>
                <input id="upload-sig-input" ref={sigInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={e => handleFileChange(e, 'sig')} />
                <Button type="button" variant="outline" className="h-12 w-full" onClick={() => sigInputRef.current?.click()}>
                  {sigUrl ? <img src={sigUrl} alt="Assinatura do produtor" className="h-8 object-contain" /> : <><I.Assinatura aria-hidden="true" />Enviar</>}
                </Button>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">PNG, JPG ou WebP, até 1 MB.</p>
            {logoOrg.data ? (
              <Button type="button" variant="outline" size="sm" className="mt-2 min-h-11" onClick={() => { const u = imagemSegura(logoOrg.data); if (u) setLogoUrl(u); else toast.error('A logo do organizador está num endereço que não pode ser usado aqui. Envie o arquivo (PNG, JPG ou WebP, até 1 MB) no botão Enviar.') }}>
                <I.Imagem aria-hidden="true" />Usar o logo do organizador
              </Button>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                {logoOrg.isPending ? 'Procurando o logo do organizador…' : <>Você ainda não tem logo do organizador. <Link to="/producer/settings" className="text-foreground underline underline-offset-4">Envie em Configurações</Link> para usar aqui.</>}
              </p>
            )}
            <div className="mt-3">
              <p id="cor-destaque" className="mb-1.5 text-xs text-muted-foreground">Cor de destaque (molduras e faixas)</p>
              <div role="group" aria-labelledby="cor-destaque" className="flex flex-wrap gap-1">
                {CORES.map(c => (
                  <button key={c} type="button" onClick={() => aplicar({ ...estado, accent: c })} aria-pressed={modelo.accent === c} aria-label={`Cor de destaque ${c}`}
                    className="flex size-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className={`size-8 rounded-full border-2 transition-transform ${modelo.accent === c ? 'scale-110 border-foreground' : 'border-transparent'}`} style={{ background: c }} />
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Preview Data */}
          <section aria-labelledby="dados-exemplo" className={painel}>
            <h2 id="dados-exemplo" className="mb-3 text-sm font-medium text-foreground">Dados da prévia</h2>
            <div className="grid gap-2">
              <Label htmlFor="ex-participante" className="text-xs text-muted-foreground">Participante</Label>
              <select id="ex-participante" value={participanteId} onChange={e => setParticipanteId(e.target.value)} className={`${selectNativo} min-h-11`}>
                <option value="">Nome de exemplo</option>
                {participantes.map(p => <option key={p.user_id} value={p.user_id}>{p.nome}</option>)}
              </select>
              {participantesQ.isError && <p role="alert" className="text-xs text-muted-foreground">Não foi possível carregar os participantes; use o nome de exemplo.</p>}
              <Label htmlFor="ex-nome" className="sr-only">Nome de exemplo</Label>
              <Input id="ex-nome" className={campoNum} value={previewName} onChange={e => setPreviewName(e.target.value.slice(0, 120))} placeholder="Nome de exemplo" disabled={!!real} />
              <Label htmlFor="ex-evento" className="sr-only">Nome do evento</Label>
              <Input id="ex-evento" className={campoNum} value={previewEvent} onChange={e => setExemplo({ ...ex, eventId, evento: e.target.value.slice(0, 160) })} placeholder="Nome do evento" />
              <Label htmlFor="ex-data" className="sr-only">Data</Label>
              <Input id="ex-data" className={campoNum} value={previewDate} onChange={e => setExemplo({ ...ex, eventId, data: e.target.value.slice(0, 60) })} placeholder="Data" />
              <Label htmlFor="ex-horas" className="text-xs text-muted-foreground">Carga horária (horas), vale para todos os certificados</Label>
              <Input id="ex-horas" className={campoNum} inputMode="decimal" value={horas} onChange={e => setHoras(/^[\d.,]{0,6}$/.test(e.target.value) ? e.target.value : horas)} placeholder="Ex.: 8" />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Evento e data são só da prévia; na emissão e no PDF valem os do evento. A prévia mostra só o nome do participante.</p>
          </section>

          {/* Fields List */}
          <section aria-labelledby="campos" className={painel}>
            <div className="mb-3 flex items-center justify-between">
              <h2 id="campos" className="text-sm font-medium text-foreground">Campos ({fields.length})</h2>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon-sm" className={`${icone} size-11`} onClick={() => addField('text')} aria-label="Adicionar campo de texto"><I.Texto aria-hidden="true" /></Button>
                <Button variant="ghost" size="icon-sm" className={`${icone} size-11`} onClick={() => addField('qrcode')} aria-label="Adicionar QR Code"><I.Qr aria-hidden="true" /></Button>
              </div>
            </div>
            <ul className="max-h-48 space-y-1 overflow-y-auto pr-1">
              {fields.map(f => (
                <li key={f.id} className={`flex items-center gap-1 rounded-md text-xs ${selectedField === f.id ? 'bg-primary/10 text-foreground' : 'text-muted-foreground'}`}>
                  <button type="button" aria-pressed={selectedField === f.id} onClick={() => selecionar(f.id === selectedField ? null : f.id)}
                    className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {f.type === 'text' && <I.Texto size={14} aria-hidden="true" />}
                    {f.type === 'logo' && <I.Imagem size={14} aria-hidden="true" />}
                    {f.type === 'signature' && <I.Assinatura size={14} aria-hidden="true" />}
                    {f.type === 'qrcode' && <I.Qr size={14} aria-hidden="true" />}
                    {f.type === 'date' && <I.Eventos size={14} aria-hidden="true" />}
                    <span className="truncate">{f.label}</span>
                  </button>
                  <Button variant="ghost" size="icon-sm" className={`${icone} size-11`} onClick={() => removeField(f.id)} aria-label={`Remover o campo ${f.label}`}>
                    <I.Lixeira aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          </section>

          {/* Propriedades do campo selecionado */}
          {selected && (
            <section aria-labelledby="editar-campo" className={painel} onBlur={limparChave}>
              <h2 id="editar-campo" className="mb-3 text-sm font-medium text-foreground">Propriedades: {selected.label}</h2>
              <div className="space-y-3">
                {ehTexto && (
                  <>
                    <div className="grid gap-1.5">
                      <Label htmlFor="selected-field-value" className="text-xs text-muted-foreground">Texto ou variável</Label>
                      <Input id="selected-field-value" className={campoNum} maxLength={LIMITES.texto} value={selected.value} onChange={e => updateField(selected.id, { value: e.target.value }, `${selected.id}:value`)} placeholder="Use {{NOME}}, {{EVENTO}}, {{DATA}}, {{HORAS}}" />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="selected-field-font" className="text-xs text-muted-foreground">Fonte</Label>
                      <select id="selected-field-font" className={`${selectNativo} min-h-11`} value={selected.fontFamily ?? ''} onChange={e => updateField(selected.id, { fontFamily: (e.target.value || undefined) as FonteId | undefined })}>
                        <option value="">Padrão do modelo</option>
                        {FONTES.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="grid gap-1.5">
                        <Label htmlFor="selected-field-font-size" className="text-xs text-muted-foreground">Tamanho ({LIMITES.fonteMin} a {LIMITES.fonteMax})</Label>
                        <Input id="selected-field-font-size" className={campoNum} type="number" min={LIMITES.fonteMin} max={LIMITES.fonteMax} value={selected.fontSize}
                          onChange={e => { const n = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(n)) updateField(selected.id, { fontSize: Math.min(LIMITES.fonteMax, Math.max(LIMITES.fonteMin, n)) }, `${selected.id}:fontSize`) }} />
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor="selected-field-color" className="text-xs text-muted-foreground">Cor</Label>
                        <Input id="selected-field-color" type="color" value={selected.color} onChange={e => updateField(selected.id, { color: e.target.value }, `${selected.id}:color`)} className="min-h-11 cursor-pointer p-1" />
                      </div>
                    </div>
                    <div className="grid gap-1.5">
                      <span className="text-xs text-muted-foreground">Alinhamento</span>
                      <Segmented label="Alinhamento do texto" size="md" className="h-11" items={ALINHAMENTOS} value={selected.align ?? 'center'} onValueChange={v => updateField(selected.id, { align: v as Alinhamento })} />
                    </div>
                    <Button type="button" variant="outline" className="min-h-11" aria-pressed={selected.bold ?? selected.fontSize > 20} onClick={() => updateField(selected.id, { bold: !(selected.bold ?? selected.fontSize > 20) })}>
                      <span className="font-bold">N</span> Negrito
                    </Button>
                  </>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="selected-field-pos-x" className="text-xs text-muted-foreground">X (%)</Label>
                    <Input id="selected-field-pos-x" className={campoNum} type="number" value={selected.x} min={0} max={100} onChange={e => { const n = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(n)) updateField(selected.id, { x: Math.min(100, Math.max(0, n)) }, `${selected.id}:x`) }} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="selected-field-pos-y" className="text-xs text-muted-foreground">Y (%)</Label>
                    <Input id="selected-field-pos-y" className={campoNum} type="number" value={selected.y} min={0} max={100} onChange={e => { const n = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(n)) updateField(selected.id, { y: Math.min(100, Math.max(0, n)) }, `${selected.id}:y`) }} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="selected-field-width" className="text-xs text-muted-foreground">Largura (%)</Label>
                    <Input id="selected-field-width" className={campoNum} type="number" value={selected.width} min={ehTexto ? 10 : 5} max={ehTexto ? 100 : 40}
                      onChange={e => { const n = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(n)) updateField(selected.id, { width: Math.min(ehTexto ? 100 : 40, Math.max(ehTexto ? 10 : 5, n)) }, `${selected.id}:width`) }} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Para mover pelo teclado, foque o campo na prévia e use as setas (Shift anda de 5 em 5).</p>
              </div>
            </section>
          )}

          <p className="text-xs text-muted-foreground">
            A emissão para os participantes é feita na tela <Link to={certificadosUrl} className="text-foreground underline underline-offset-4">Certificados</Link>, onde também está o PDF de quem já recebeu. O envio por e-mail ainda não existe.
          </p>
        </div>

        {/* Preview */}
        <div className="min-w-0 lg:col-span-3">
          <div className="lg:sticky lg:top-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-foreground">Prévia do certificado</h2>
              <div className="flex flex-wrap items-center gap-1">
                <Button variant="outline" size="sm" className="min-h-11" onClick={desfaz} disabled={hist.passado.length === 0}><I.Desfazer aria-hidden="true" />Desfazer</Button>
                <Button variant="outline" size="sm" className="min-h-11" onClick={refaz} disabled={hist.futuro.length === 0}><I.Refazer aria-hidden="true" />Refazer</Button>
                <Button variant="outline" size="sm" className="min-h-11" onClick={() => setImprimindo(++pedidos.current)}><I.Imprimir aria-hidden="true" />Baixar PDF</Button>
              </div>
            </div>
            <div className="mx-auto max-w-[700px] overflow-hidden rounded-[10px] border border-border">
              <CertificadoDesenho modelo={modelo} campos={fields} logoUrl={logoUrl} sigUrl={sigUrl} dados={dados}
                selecionado={selectedField} onSelecionar={selecionar} onMoverTeclado={moverCampo} onArrastar={arrastar} papelRef={papelRef} />
            </div>
            <p className="mx-auto mt-2 max-w-[700px] text-xs text-muted-foreground">
              O PDF abre o &quot;salvar como PDF&quot; do navegador (A4 paisagem). A validação pública ainda não existe: o QR e o código ainda não confirmam o certificado.
            </p>

            {/* Variables help */}
            <div className={`${painel} mt-4`}>
              <h3 className="mb-2 text-xs font-medium text-foreground">Variáveis disponíveis</h3>
              <div className="flex flex-wrap gap-2">
                {VARIAVEIS.map(v => (
                  <Button key={v} variant="secondary" size="sm" className="min-h-11 font-mono text-[11px]" onClick={() => { navigator.clipboard.writeText(v); toast.success('Variável copiada.') }} aria-label={`Copiar ${v}`}>
                    <I.Copiar aria-hidden="true" /> {v}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      {imprimindo > 0 && <ImpressaoCertificados key={imprimindo} itens={[{ dados }]} modelo={modelo} campos={fields} logoUrl={logoUrl} sigUrl={sigUrl} onFim={() => setImprimindo(0)} />}
    </div>
  )
}
