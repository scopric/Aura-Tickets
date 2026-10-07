import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { Stage, Layer, Group, Rect, Circle, Ellipse, Line, Text, Transformer } from 'react-konva'
import type Konva from 'konva'
import { useProducerEvents } from '../../../hooks/useEvents'
import { useEventoDaUrl } from '../../../hooks/useEventoDaUrl'
import { Button } from '@/components/ui/button'
import { limites, ajustarTela, zoomNoCursor, snap, ORIGEM_SALA, type Vista } from './geometria'
import { sectionColors, toolDefaults, typeLabels, type Environment, type SeatNode } from './modelo'
import { useMapa } from './usarMapa'
import BarraPaleta from './BarraPaleta'
import SeletorTemplates from './SeletorTemplates'
import { criarNo, daSecao, ESTRUTURA, formaDe, ITENS } from './paleta'
import { aplicarTemplate, type Template } from './templates'
import { decidirApagar, decidirTemplate, proximoRotulo, rotuloDaCopia } from './regras'

const PASSOS_REGUA = [1, 2, 5, 10, 20, 50, 100]
const MAX_DESFAZER = 50
const PASSO_SETA = 0.25

let seq = Date.now()
const novoId = () => `e${seq++}`

type Selecao = { tipo: 'no' | 'parede'; id: string } | null

const fmtM = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')

const medidas = (s: SeatNode) => ({
  w: s.widthMeter || toolDefaults[s.type]?.wMeter || 0.5,
  h: s.heightMeter || toolDefaults[s.type]?.hMeter || 0.5,
})

// ponytail: cadeiras da mesa em anel elíptico ao redor, mesmo para mesa retangular; trocar por lados da mesa se o produtor pedir
function CadeirasDaMesa({ w, h, n }: { w: number; h: number; n: number }) {
  return Array.from({ length: Math.max(0, Math.min(n, 40)) }, (_, i) => {
    const a = (2 * Math.PI * i) / Math.min(n, 40)
    return <Circle key={i} x={(w / 2 + 0.25) * Math.cos(a)} y={(h / 2 + 0.25) * Math.sin(a)} radius={0.2} fill="#64748b" listening={false} />
  })
}

// Texto em metros: o Konva desenha mal fonte de 0,3 px, então escreve numa escala 40x maior e reduz o grupo
const AMPLIA = 40
function Texto({ w, h, texto, fonte, cor }: { w: number; h: number; texto: string; fonte: number; cor: string }) {
  return (
    <Group scaleX={1 / AMPLIA} scaleY={1 / AMPLIA} listening={false}>
      <Text x={(-w / 2) * AMPLIA} y={(-h / 2) * AMPLIA} width={w * AMPLIA} height={h * AMPLIA} text={texto} fontSize={fonte * AMPLIA} fill={cor} align="center" verticalAlign="middle" wrap="none" />
    </Group>
  )
}

// Forma de um elemento, em metros, centrada em (0,0). Tipo sem forma própria cai no retângulo com o nome.
function Forma({ s }: { s: SeatNode }) {
  const { w, h } = medidas(s)
  const cor = s.color || toolDefaults[s.type]?.color || '#94a3b8'
  const rotulo = s.label || typeLabels[s.type] || String(s.type)
  const fonte = Math.max(0.2, Math.min(0.5, h * 0.5, (w * 1.7) / Math.max(1, rotulo.length)))
  const textoRotulo = <Texto w={w} h={h} texto={rotulo} fonte={fonte} cor="#ffffff" />
  if (s.type === 'seat') {
    return (
      <>
        {Math.abs(w - h) < 0.01 ? <Circle radius={w / 2} fill={cor} /> : <Rect x={-w / 2} y={-h / 2} width={w} height={h} fill={cor} cornerRadius={0.1} />}
        {w >= 0.75 && textoRotulo}
      </>
    )
  }
  // texto livre: a cor padrão é escura demais para a sala escura, então clareia
  if (s.type === 'text') return <Texto w={w} h={h} texto={s.label || 'Texto'} fonte={0.6} cor={cor.toLowerCase() === '#1e293b' ? '#e2e8f0' : cor} />
  if (s.type === 'table') {
    const redonda = (s.tableShape || 'circle') === 'circle'
    return (
      <>
        <CadeirasDaMesa w={w} h={h} n={s.seatsCount || 6} />
        {redonda ? <Circle radius={w / 2} fill={cor} /> : <Rect x={-w / 2} y={-h / 2} width={w} height={h} fill={cor} cornerRadius={0.1} />}
        {textoRotulo}
      </>
    )
  }
  return (
    <>
      {formaDe(s.type) === 'c'
        ? <Ellipse radiusX={w / 2} radiusY={h / 2} fill={cor} opacity={0.9} />
        : <Rect x={-w / 2} y={-h / 2} width={w} height={h} fill={cor} opacity={0.9} cornerRadius={Math.min(0.1, h / 4)} />}
      {textoRotulo}
    </>
  )
}

function Cores({ valor, onChange }: { valor: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {sectionColors.map(c => (
        <button key={c} type="button" aria-label={`Cor ${c}`} onClick={() => onChange(c)}
          className={`h-6 w-6 rounded-full border ${valor.toLowerCase() === c ? 'ring-2 ring-primary ring-offset-1' : 'border-border'}`} style={{ background: c }} />
      ))}
      <input type="color" aria-label="Outra cor" value={/^#[0-9a-f]{6}$/i.test(valor) ? valor : '#000000'} onChange={e => onChange(e.target.value)} className="h-6 w-8 cursor-pointer rounded border border-border bg-transparent p-0" />
    </div>
  )
}

export default function EditorKonva() {
  const { data: eventos = [], isLoading: carregandoEventos, isError: erroEventos, refetch: recarregarEventos } = useProducerEvents()
  const [eventId, trocarEvento] = useEventoDaUrl(eventos.map(e => e.id))
  const { envs, setEnvs, pronto, erroMapa, sujo, salvar } = useMapa(eventId)
  const [ativo, setAtivo] = useState(0)
  const env = envs[ativo] || envs[0]
  const ppm = env.pixelsPerMeter || 40
  const [sel, setSel] = useState<Selecao>(null)
  const [encaixar, setEncaixar] = useState(false)
  const [ferr, setFerr] = useState('select') // 'select', 'pan' ou o id de um item da paleta (clique no mapa cria)
  const [grade, setGrade] = useState(true)
  const [abrirTemplates, setAbrirTemplates] = useState(false)
  const [gaveta, setGaveta] = useState<'' | 'paleta' | 'cores'>('') // telas < 1024 px: painéis viram gavetas
  const abrirRef = useRef<HTMLElement | null>(null) // botão que abriu a gaveta: recebe o foco de volta
  const [versaoTemplate, setVersaoTemplate] = useState(0) // muda a cada template aplicado: dispara o fade do mapa
  const [reenquadrar, setReenquadrar] = useState(0)
  const [secSel, setSecSel] = useState<string | null>(null)
  const sec = (env.sections || []).find(x => x.id === secSel) || (env.sections || [])[0]
  const noSel = sel?.tipo === 'no' ? env.seats.find(n => n.id === sel.id) : undefined

  // Desfazer simples por pavimento: guarda o pavimento inteiro antes de cada mudança.
  // Mudanças seguidas com a mesma chave (arrastar um seletor de cor) viram um só passo.
  const hist = useRef<Record<string, Environment[]>>({})
  const ultima = useRef({ chave: '', t: 0 })
  const mudar = (fn: (e: Environment) => Environment, chave = '') => {
    const agora = Date.now()
    if (!(chave && ultima.current.chave === chave && agora - ultima.current.t < 800)) {
      const pilha = (hist.current[env.id] ||= [])
      pilha.push(env)
      if (pilha.length > MAX_DESFAZER) pilha.shift()
    }
    ultima.current = { chave, t: agora }
    setEnvs(prev => prev.map((e, i) => (i === ativo ? fn(e) : e)))
  }
  const desfazer = () => {
    const anterior = hist.current[env.id]?.pop()
    if (anterior) setEnvs(prev => prev.map(e => (e.id === anterior.id ? anterior : e)))
  }
  useEffect(() => { hist.current = {} }, [eventId])
  useEffect(() => {
    // um quadro depois: os botões (transition: all) ainda herdam visibility:hidden no instante em que a gaveta abre
    if (gaveta) { const q = requestAnimationFrame(() => document.getElementById(`gaveta-${gaveta}`)?.querySelector<HTMLElement>('button, input')?.focus()); return () => cancelAnimationFrame(q) }
    if (abrirRef.current) { abrirRef.current.focus(); abrirRef.current = null }
  }, [gaveta])
  const alternar = (g: 'paleta' | 'cores', el: HTMLElement) => { abrirRef.current = el; setGaveta(a => (a === g ? '' : g)) }
  useEffect(() => { setSel(null); setSecSel(null); setFerr('select') }, [eventId, ativo])

  // Transformer fica fora do grupo em metros para as alças não escalarem com o zoom
  const nosRef = useRef<Record<string, Konva.Group | null>>({})
  const trRef = useRef<Konva.Transformer>(null)
  useEffect(() => {
    const g = noSel && !noSel.locked ? nosRef.current[noSel.id] : null
    trRef.current?.nodes(g ? [g] : [])
    trRef.current?.getLayer()?.batchDraw()
  }, [noSel?.id, noSel?.locked, ativo])

  const moverNo = (id: string, patch: Partial<SeatNode>) =>
    mudar(e => ({ ...e, seats: e.seats.map(n => (n.id === id ? { ...n, ...patch } : n)) }))
  const corSecao = (id: string, cor: string) =>
    mudar(e => ({
      ...e,
      sections: e.sections.map(x => (x.id === id ? { ...x, color: cor } : x)),
      seats: e.seats.map(n => (n.sectionId === id ? { ...n, color: cor } : n)),
    }), `sec-${id}`)
  const corNo = (id: string, cor: string) => moverNo(id, { color: cor })

  // Criar, apagar, duplicar e mover entram no mesmo desfazer por pavimento
  const criarEm = (x: number, y: number) => {
    const it = ITENS[ferr]
    if (!it || !sec) return
    const base = it.id === 'seat' || it.id === 'poltrona' ? '' : it.id === 'table' ? 'Mesa' : it.id === 'cadeira_pne' ? 'PNE' : it.id === 'espaco_cadeirante' ? 'Espaço Cadeirante' : null
    const rotulo = base === null ? it.nome : proximoRotulo(env.seats, base)
    // o que não vende vai para a seção "Estrutura" (criada se faltar), sem inflar a contagem da seção ativa
    const destino = daSecao(it.tipo) ? sec : ESTRUTURA
    const no = criarNo(it, encaixar ? snap(x) : x, encaixar ? snap(y) : y, novoId(), destino, { label: rotulo })
    mudar(e => ({ ...e, sections: (e.sections || []).some(s => s.id === destino.id) ? e.sections : [...(e.sections || []), destino], seats: [...e.seats, no] }))
    setSel({ tipo: 'no', id: no.id })
    setFerr('select')
  }
  const apagar = () => {
    if (!sel) return
    if (sel.tipo === 'no') {
      if (noSel?.locked) return
      const d = noSel ? decidirApagar(noSel) : { acao: 'ok' as const }
      if (d.acao === 'recusar') { window.alert(d.msg); return }
      if (d.acao === 'confirmar' && !window.confirm(d.msg)) return
      mudar(e => ({ ...e, seats: e.seats.filter(n => n.id !== sel.id) }))
    } else {
      if ((env.walls || []).find(p => p.id === sel.id)?.locked) return
      mudar(e => ({ ...e, walls: (e.walls || []).filter(p => p.id !== sel.id) }))
    }
    setSel(null)
  }
  const duplicar = () => {
    if (!noSel) return
    // a cópia é livre: não herda venda, reserva nem trava
    const copia: SeatNode = { ...noSel, id: novoId(), x: noSel.x + 0.5, y: noSel.y + 0.5, status: 'free', sold: 0, locked: false, label: rotuloDaCopia(env.seats, noSel) }
    mudar(e => ({ ...e, seats: [...e.seats, copia] }))
    setSel({ tipo: 'no', id: copia.id })
  }
  const empurrar = (dx: number, dy: number) => {
    if (!sel) return
    const chave = `seta-${sel.id}`
    if (sel.tipo === 'no') {
      if (noSel && !noSel.locked) mudar(e => ({ ...e, seats: e.seats.map(n => (n.id === sel.id ? { ...n, x: n.x + dx, y: n.y + dy } : n)) }), chave)
    } else {
      mudar(e => ({ ...e, walls: (e.walls || []).map(p => (p.id === sel.id && !p.locked ? { ...p, x1: p.x1 + dx, y1: p.y1 + dy, x2: p.x2 + dx, y2: p.y2 + dy } : p)) }), chave)
    }
  }
  const escolherTemplate = (t: Template) => {
    const d = decidirTemplate(env.seats)
    if (!d.permitido) { window.alert(`Não dá para aplicar "${t.nome}": ${d.vendidos} elemento(s) deste pavimento têm venda ou reserva. Crie outro pavimento para o novo modelo.`); return }
    if (env.seats.length + (env.walls || []).length > 0 &&
      !window.confirm(`Aplicar "${t.nome}" apaga os ${env.seats.length} elementos deste pavimento${d.bloqueados ? ` (${d.bloqueados} bloqueados)` : ''}. As seções, os preços e o vínculo com lotes (ingressos) serão substituídos. Dá para desfazer antes de salvar. Continuar?`)) return
    mudar(e => aplicarTemplate(e, t))
    setVersaoTemplate(v => v + 1)
    setSel(null); setFerr('select'); setAbrirTemplates(false)
    setReenquadrar(n => n + 1)
  }
  // Teclado: Delete apaga, Ctrl/Cmd+D duplica, setas movem 0,25 m (Shift = 1 m), Ctrl/Cmd+Z desfaz, Esc volta a selecionar
  const teclas = useRef<(e: KeyboardEvent) => void>(() => {})
  teclas.current = e => {
    const alvo = e.target as HTMLElement | null
    if (abrirTemplates || alvo?.closest?.('input,select,textarea,[role=dialog]')) return
    const emBotao = !!alvo?.closest?.('button,[role=button],[role=menuitem]')
    const cmd = e.ctrlKey || e.metaKey
    const k = e.key.toLowerCase()
    if (k === 'escape') { setFerr('select'); setGaveta('') }
    else if (cmd && k === 'z') { e.preventDefault(); desfazer() }
    else if (cmd && k === 'd') { e.preventDefault(); duplicar() }
    else if (k === 'delete' || k === 'backspace') { if (sel && !emBotao) { e.preventDefault(); apagar() } }
    else if (k.startsWith('arrow') && sel) {
      e.preventDefault()
      const p = PASSO_SETA * (e.shiftKey ? 4 : 1)
      empurrar(k === 'arrowleft' ? -p : k === 'arrowright' ? p : 0, k === 'arrowup' ? -p : k === 'arrowdown' ? p : 0)
    }
  }
  useEffect(() => {
    const f = (e: KeyboardEvent) => teclas.current(e)
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [])

  // Elementos que passam do limite da sala (ficam com contorno vermelho tracejado)
  const salaW = env.roomWidth || 40, salaH = env.roomHeight || 40
  const fora = useMemo(() => {
    const ids = new Set<string>()
    for (const n of env.seats) {
      const c = limites({ ...env, seats: [n], walls: [] })
      if (c.w > salaW + 1e-6 || c.h > salaH + 1e-6) ids.add(n.id)
    }
    return ids
  }, [env.seats, salaW, salaH]) // eslint-disable-line react-hooks/exhaustive-deps

  // Tamanho da área do Stage
  const caixaRef = useRef<HTMLDivElement>(null)
  const [tam, setTam] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = caixaRef.current
    if (!el) return
    const medir = () => setTam({ w: el.clientWidth, h: el.clientHeight })
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [eventId])

  const [vista, setVista] = useState<Vista>({ zoom: 1, pan: { x: 0, y: 0 } })
  const envRef = useRef(env)
  envRef.current = env
  const tamRef = useRef(tam)
  tamRef.current = tam
  const ajustar = useCallback(() => {
    const { w, h } = tamRef.current
    if (w === 0 || h === 0) return
    const e = envRef.current
    setVista(ajustarTela(limites(e), w, h, e.pixelsPerMeter || 40))
  }, [])
  // Enquadra ao abrir o mapa e ao trocar de pavimento (não a cada edição)
  useEffect(() => { if (pronto) ajustar() }, [pronto, eventId, ativo, tam.w > 0, ajustar]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setAtivo(0) }, [eventId])
  useEffect(() => { if (reenquadrar) ajustar() }, [reenquadrar, ajustar])

  const aoRolar = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const cur = e.target.getStage()?.getPointerPosition()
    if (!cur) return
    setVista(v => zoomNoCursor(v, cur, v.zoom * (e.evt.deltaY < 0 ? 1.1 : 1 / 1.1)))
  }

  // Pan arrastando o fundo (o que não é elemento)
  const pan = useRef<{ x: number; y: number } | null>(null)
  const criando = ferr !== 'select' && ferr !== 'pan' && !!ITENS[ferr]
  const arrastou = useRef(false) // o clique veio de um arraste de pan: não cria elemento
  const noFundo = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => e.target === e.target.getStage()
  const iniciarPan = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    arrastou.current = false
    if (ferr === 'pan' || noFundo(e)) { pan.current = e.target.getStage()!.getPointerPosition(); if (ferr === 'select') setSel(null) }
  }
  const aoClicar = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const cur = e.target.getStage()?.getPointerPosition()
    if (!criando || arrastou.current || !cur) return
    criarEm((cur.x - vista.pan.x) / escala, (cur.y - vista.pan.y) / escala)
  }
  const moverPan = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const p = pan.current, cur = e.target.getStage()?.getPointerPosition()
    if (!p || !cur) return
    const dx = cur.x - p.x, dy = cur.y - p.y
    pan.current = cur
    if (dx || dy) arrastou.current = true
    setVista(v => ({ ...v, pan: { x: v.pan.x + dx, y: v.pan.y + dy } }))
  }
  const fimPan = () => { pan.current = null }

  useEffect(() => {
    if (!sujo) return
    const avisar = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [sujo])
  const confirmarSaida = () => !sujo || window.confirm('Há alterações não salvas neste mapa. Sair mesmo assim?')

  const voltarPara = `/producer/dashboard${eventId ? `?eventId=${eventId}` : ''}`
  const seletorEvento = (
    <select
      value={eventId ?? ''}
      onChange={e => { if (e.target.value !== eventId && confirmarSaida()) trocarEvento(e.target.value || null) }}
      aria-label="Evento do mapa"
      className="h-8 max-w-48 rounded-md border border-input bg-transparent px-2 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {!eventId && <option value="">Escolha um evento</option>}
      {eventos.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
    </select>
  )

  if (!eventId) {
    return (
      <div className="painel-produtor flex h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center text-foreground">
        <h1 className="text-base font-semibold">Editor de mapa (novo)</h1>
        <p className="text-sm text-muted-foreground">
          {carregandoEventos ? 'Carregando seus eventos…' : erroEventos ? 'Não consegui carregar seus eventos.' : eventos.length ? 'Escolha o evento cujo mapa você quer editar.' : 'Crie um evento antes de montar o mapa.'}
        </p>
        {erroEventos && <Button size="sm" onClick={() => recarregarEventos()}>Tentar de novo</Button>}
        {eventos.length > 0 && seletorEvento}
        <Link to={voltarPara} className="text-sm text-primary underline">Voltar ao painel</Link>
      </div>
    )
  }

  const escala = ppm * vista.zoom
  const passo = PASSOS_REGUA.find(n => n * escala >= 70) ?? PASSOS_REGUA[PASSOS_REGUA.length - 1]
  const sala = { x: ORIGEM_SALA, y: ORIGEM_SALA, w: env.roomWidth || 40, h: env.roomHeight || 40 }

  return (
    <div className="painel-produtor flex h-screen flex-col overflow-hidden bg-background text-foreground select-none">
      <header className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2">
        <Link to={voltarPara} onClick={(e: ReactMouseEvent) => { if (!confirmarSaida()) e.preventDefault() }} className="text-sm text-primary underline">Voltar</Link>
        <h1 className="text-base font-semibold">Editor de mapa (novo)</h1>
        {seletorEvento}
        <select
          value={ativo}
          onChange={e => setAtivo(Number(e.target.value))}
          aria-label="Pavimento"
          className="h-8 max-w-48 rounded-md border border-input bg-transparent px-2 text-xs text-foreground"
        >
          {envs.map((p, i) => <option key={p.id} value={i}>{p.name}</option>)}
        </select>
        <Button size="sm" variant="outline" className="lg:hidden max-lg:h-10" aria-expanded={gaveta === 'paleta'} aria-controls="gaveta-paleta" onClick={e => alternar('paleta', e.currentTarget)}>Elementos</Button>
        <Button size="sm" variant="outline" className="lg:hidden max-lg:h-10" aria-expanded={gaveta === 'cores'} aria-controls="gaveta-cores" onClick={e => alternar('cores', e.currentTarget)}>Cores</Button>
        <Button size="sm" variant="outline" className="max-lg:h-10" onClick={() => setAbrirTemplates(true)}>Templates</Button>
        <Button size="sm" variant="outline" className="max-lg:h-10" onClick={ajustar}>Ajustar à tela</Button>
        <Button size="sm" variant="outline" className="max-lg:h-10" onClick={desfazer} disabled={!hist.current[env.id]?.length}>Desfazer</Button>
        <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={encaixar} onChange={e => setEncaixar(e.target.checked)} /> Encaixar em 0,25 m</label>
        <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={grade} onChange={e => setGrade(e.target.checked)} /> Grade</label>
        <Button size="sm" className="max-lg:h-10" onClick={() => salvar(ativo)} disabled={!pronto}>Salvar</Button>
        {erroMapa && <span className="text-xs text-destructive">Não consegui ler o mapa: Salvar bloqueado. Recarregue a página.</span>}
        {sujo && <span className="text-xs text-muted-foreground">Alterações não salvas</span>}
      </header>
      <div className="relative flex min-h-0 flex-1">
      <div id="gaveta-paleta" className={`mapa-gaveta ${gaveta === 'paleta' ? 'mapa-gaveta-aberta' : 'max-lg:invisible'} flex flex-col absolute inset-y-0 left-0 z-20 w-72 max-w-[85vw] border-r border-border shadow-xl lg:static lg:z-auto lg:w-[280px] lg:max-w-none lg:flex-shrink-0 lg:translate-x-0 lg:shadow-none ${gaveta === 'paleta' ? 'translate-x-0' : '-translate-x-full'}`}>
        <button type="button" onClick={() => setGaveta('')} className="h-10 flex-shrink-0 border-b border-border bg-card px-3 text-right text-sm text-primary underline lg:hidden">Fechar</button>
        <div className="min-h-0 flex-1"><BarraPaleta ferramenta={ferr} onEscolher={id => { setFerr(id); setGaveta('') }} /></div>
      </div>
      <div ref={caixaRef} className="relative min-h-0 min-w-0 flex-1 bg-muted/40" style={{ cursor: criando ? 'crosshair' : ferr === 'pan' ? 'grab' : undefined }}>
        {tam.w > 0 && (
          <Stage
            width={tam.w} height={tam.h}
            onWheel={aoRolar}
            onMouseDown={iniciarPan} onTouchStart={iniciarPan}
            onMouseMove={moverPan} onTouchMove={moverPan}
            onMouseUp={fimPan} onTouchEnd={fimPan} onMouseLeave={fimPan}
            onClick={aoClicar} onTap={aoClicar}
          >
            <Layer>
              <Group x={vista.pan.x} y={vista.pan.y} scaleX={escala} scaleY={escala}>
                <Rect {...sala} width={sala.w} height={sala.h} fill="#2b303b" stroke="#64748b" strokeWidth={1} strokeScaleEnabled={false} listening={false} />
                {grade && Array.from({ length: Math.floor(sala.w) + 1 }, (_, i) => (i % 5 === 0 || escala >= 12) && (
                  <Line key={`gv${i}`} points={[sala.x + i, sala.y, sala.x + i, sala.y + sala.h]} stroke="#ffffff" opacity={i % 5 === 0 ? 0.16 : 0.06} strokeWidth={1} strokeScaleEnabled={false} listening={false} />
                ))}
                {grade && Array.from({ length: Math.floor(sala.h) + 1 }, (_, i) => (i % 5 === 0 || escala >= 12) && (
                  <Line key={`gh${i}`} points={[sala.x, sala.y + i, sala.x + sala.w, sala.y + i]} stroke="#ffffff" opacity={i % 5 === 0 ? 0.16 : 0.06} strokeWidth={1} strokeScaleEnabled={false} listening={false} />
                ))}
                {(env.walls || []).map(p => {
                  const pontos = [p.x1, p.y1, p.x2, p.y2]
                  const escolhida = sel?.tipo === 'parede' && sel.id === p.id
                  return (
                    <Group
                      key={p.id} draggable={!p.locked && ferr === 'select'}
                      onMouseDown={() => setSel({ tipo: 'parede', id: p.id })} onTouchStart={() => setSel({ tipo: 'parede', id: p.id })}
                      onDragEnd={e => {
                        const dx = e.target.x(), dy = e.target.y()
                        e.target.position({ x: 0, y: 0 })
                        mudar(a => ({ ...a, walls: (a.walls || []).map(q => (q.id === p.id ? { ...q, x1: p.x1 + dx, y1: p.y1 + dy, x2: p.x2 + dx, y2: p.y2 + dy } : q)) }))
                      }}
                    >
                      {escolhida && <Line points={pontos} stroke="#2563eb" strokeWidth={p.thickness + 0.15} lineCap="round" opacity={0.5} listening={false} />}
                      <Line points={pontos} stroke={p.color || '#4b5563'} strokeWidth={p.thickness || 0.15} lineCap="square" hitStrokeWidth={Math.max(p.thickness || 0.15, 0.4)} />
                    </Group>
                  )
                })}
                {env.seats.map(n => (
                  <Group
                    key={n.id} ref={g => { nosRef.current[n.id] = g }}
                    x={n.x} y={n.y} rotation={n.rotation || 0} draggable={!n.locked && ferr === 'select'}
                    onMouseDown={() => setSel({ tipo: 'no', id: n.id })} onTouchStart={() => setSel({ tipo: 'no', id: n.id })}
                    onDragMove={e => { if (encaixar) e.target.position({ x: snap(e.target.x()), y: snap(e.target.y()) }) }}
                    onDragEnd={e => moverNo(n.id, { x: e.target.x(), y: e.target.y() })}
                    onTransformEnd={e => {
                      const g = e.target, { w, h } = medidas(n), sx = g.scaleX(), sy = g.scaleY()
                      g.scaleX(1); g.scaleY(1)
                      // cadeira e mesa redonda mantêm a proporção (círculo): um só fator para largura e altura
      const redondo = n.type === 'seat' || (n.type === 'table' && (n.tableShape || 'circle') === 'circle')
      const k = sx !== 1 ? sx : sy
      moverNo(n.id, { x: g.x(), y: g.y(), rotation: g.rotation(), widthMeter: w * (redondo ? k : sx), heightMeter: redondo ? w * k : h * sy })
                    }}
                  >
                    <Forma s={n} />
                    {fora.has(n.id) && <Rect x={-medidas(n).w / 2} y={-medidas(n).h / 2} width={medidas(n).w} height={medidas(n).h} stroke="#ef4444" strokeWidth={0.1} dash={[0.3, 0.2]} listening={false} />}
                  </Group>
                ))}
              </Group>
            </Layer>
            <Layer>
              <Transformer ref={trRef} rotateEnabled keepRatio={false} boundBoxFunc={(a, b) => (b.width < 8 || b.height < 8 ? a : b)} />
            </Layer>
            <Layer listening={false}>
              <Line points={[16, tam.h - 20, 16 + passo * escala, tam.h - 20]} stroke="#475569" strokeWidth={2} />
              <Text x={16} y={tam.h - 38} text={`${passo} m`} fontSize={12} fill="#475569" />
              <Text x={vista.pan.x + sala.x * escala} y={vista.pan.y + sala.y * escala - 18} text={`${fmtM(sala.w)} x ${fmtM(sala.h)} m${fora.size ? ` · ${fora.size} fora da sala` : ''}`} fontSize={12} fill={fora.size ? '#ef4444' : '#94a3b8'} />
            </Layer>
          </Stage>
        )}
        {versaoTemplate > 0 && <div key={versaoTemplate} aria-hidden onAnimationEnd={() => setVersaoTemplate(0)} className="mapa-fade pointer-events-none absolute inset-0 bg-background opacity-0" />}
      </div>
      <aside id="gaveta-cores" className={`mapa-gaveta ${gaveta === 'cores' ? 'mapa-gaveta-aberta' : 'max-lg:invisible'} mapa-rolagem absolute inset-y-0 right-0 z-20 w-72 max-w-[85vw] space-y-5 overflow-y-auto overflow-x-hidden border-l border-border bg-card p-3 text-sm shadow-xl lg:static lg:z-auto lg:w-60 lg:max-w-none lg:flex-shrink-0 lg:translate-x-0 lg:shadow-none ${gaveta === 'cores' ? 'translate-x-0' : 'translate-x-full'}`}>
        <button type="button" onClick={() => setGaveta('')} className="ml-auto block h-10 text-sm text-primary underline lg:hidden">Fechar</button>
        <section aria-label="Cor da seção" className="space-y-2">
          <h2 className="text-xs font-semibold uppercase text-muted-foreground">Seções</h2>
          <ul className="space-y-1">
            {(env.sections || []).map(x => (
              <li key={x.id}>
                <button type="button" onClick={() => setSecSel(x.id)} aria-pressed={sec?.id === x.id}
                  className={`flex w-full items-center gap-2 rounded-md border px-2 py-1 text-left ${sec?.id === x.id ? 'border-primary bg-primary/10' : 'border-border'}`}>
                  <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ background: x.color }} />
                  <span className="truncate">{x.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{env.seats.filter(n => n.sectionId === x.id).length}</span>
                </button>
              </li>
            ))}
          </ul>
          {sec && (
            <>
              <p className="text-xs text-muted-foreground">Cor de “{sec.name}” (muda todos os elementos da seção)</p>
              <Cores valor={sec.color} onChange={c => corSecao(sec.id, c)} />
            </>
          )}
        </section>
        <section aria-label="Cor do elemento" className="space-y-2">
          <h2 className="text-xs font-semibold uppercase text-muted-foreground">Elemento</h2>
          {noSel ? (
            <>
              <p className="text-xs">{typeLabels[noSel.type] || String(noSel.type)}{noSel.locked ? ' (travado)' : ''} · {fmtM(medidas(noSel).w)} x {fmtM(medidas(noSel).h)} m{fora.has(noSel.id) ? ' · fora da sala' : ''}</p>
              <input
                type="text" aria-label="Nome do elemento" value={noSel.label} disabled={noSel.locked}
                onChange={e => mudar(a => ({ ...a, seats: a.seats.map(n => (n.id === noSel.id ? { ...n, label: e.target.value } : n)) }), `rot-${noSel.id}`)}
                className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
              <Cores valor={noSel.color || toolDefaults[noSel.type]?.color || '#94a3b8'} onChange={c => corNo(noSel.id, c)} />
            </>
          ) : (
            <p className="text-xs text-muted-foreground">{sel?.tipo === 'parede' ? 'Parede selecionada.' : 'Clique em um elemento para mudar só a cor dele.'}</p>
          )}
        </section>
      </aside>
      </div>
      <SeletorTemplates aberto={abrirTemplates} onFechar={() => setAbrirTemplates(false)} onEscolher={escolherTemplate} />
    </div>
  )
}
