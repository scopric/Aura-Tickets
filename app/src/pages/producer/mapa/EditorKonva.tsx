import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { Stage, Layer, Group, Rect, Circle, Line, Text, Transformer } from 'react-konva'
import type Konva from 'konva'
import { useProducerEvents } from '../../../hooks/useEvents'
import { useEventoDaUrl } from '../../../hooks/useEventoDaUrl'
import { Button } from '@/components/ui/button'
import { limites, ajustarTela, zoomNoCursor, snap, ORIGEM_SALA, type Vista } from './geometria'
import { sectionColors, toolDefaults, typeLabels, type Environment, type SeatNode } from './modelo'
import { useMapa } from './usarMapa'

const PASSOS_REGUA = [1, 2, 5, 10, 20, 50, 100]
const MAX_DESFAZER = 50

type Selecao = { tipo: 'no' | 'parede'; id: string } | null

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

// Forma de um elemento, em metros, centrada em (0,0). Tipo desconhecido cai no retângulo genérico.
function Forma({ s }: { s: SeatNode }) {
  const { w, h } = medidas(s)
  const cor = s.color || toolDefaults[s.type]?.color || '#94a3b8'
  const rotulo = s.label || typeLabels[s.type] || String(s.type)
  const fonte = Math.max(0.25, Math.min(0.5, h * 0.5))
  if (s.type === 'seat') return <Circle radius={w / 2} fill={cor} />
  if (s.type === 'text') return <Text x={-w / 2} y={-h / 2} width={w} height={h} text={s.label || 'Texto'} fontSize={0.6} fill={cor} align="center" verticalAlign="middle" />
  const rotuloNo = <Text x={-w / 2} y={-h / 2} width={w} height={h} text={rotulo} fontSize={fonte} fill="#ffffff" align="center" verticalAlign="middle" listening={false} />
  if (s.type === 'table') {
    const redonda = (s.tableShape || 'circle') === 'circle'
    return (
      <>
        <CadeirasDaMesa w={w} h={h} n={s.seatsCount || 6} />
        {redonda ? <Circle radius={w / 2} fill={cor} /> : <Rect x={-w / 2} y={-h / 2} width={w} height={h} fill={cor} cornerRadius={0.1} />}
        {rotuloNo}
      </>
    )
  }
  return (
    <>
      <Rect x={-w / 2} y={-h / 2} width={w} height={h} fill={cor} opacity={0.9} cornerRadius={Math.min(0.1, h / 4)} />
      {rotuloNo}
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
  useEffect(() => { setSel(null); setSecSel(null) }, [eventId, ativo])

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

  const aoRolar = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const cur = e.target.getStage()?.getPointerPosition()
    if (!cur) return
    setVista(v => zoomNoCursor(v, cur, v.zoom * (e.evt.deltaY < 0 ? 1.1 : 1 / 1.1)))
  }

  // Pan arrastando o fundo (o que não é elemento)
  const pan = useRef<{ x: number; y: number } | null>(null)
  const noFundo = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => e.target === e.target.getStage()
  const iniciarPan = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (noFundo(e)) { pan.current = e.target.getStage()!.getPointerPosition(); setSel(null) }
  }
  const moverPan = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const p = pan.current, cur = e.target.getStage()?.getPointerPosition()
    if (!p || !cur) return
    const dx = cur.x - p.x, dy = cur.y - p.y
    pan.current = cur
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
        <Button size="sm" variant="outline" onClick={ajustar}>Ajustar à tela</Button>
        <Button size="sm" variant="outline" onClick={desfazer} disabled={!hist.current[env.id]?.length}>Desfazer</Button>
        <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={encaixar} onChange={e => setEncaixar(e.target.checked)} /> Encaixar em 0,25 m</label>
        <Button size="sm" onClick={() => salvar(ativo)} disabled={!pronto}>Salvar</Button>
        {erroMapa && <span className="text-xs text-destructive">Não consegui ler o mapa: Salvar bloqueado. Recarregue a página.</span>}
        {sujo && <span className="text-xs text-muted-foreground">Alterações não salvas</span>}
      </header>
      <div className="flex min-h-0 flex-1">
      <div ref={caixaRef} className="relative min-h-0 min-w-0 flex-1 bg-muted/40">
        {tam.w > 0 && (
          <Stage
            width={tam.w} height={tam.h}
            onWheel={aoRolar}
            onMouseDown={iniciarPan} onTouchStart={iniciarPan}
            onMouseMove={moverPan} onTouchMove={moverPan}
            onMouseUp={fimPan} onTouchEnd={fimPan} onMouseLeave={fimPan}
          >
            <Layer>
              <Group x={vista.pan.x} y={vista.pan.y} scaleX={escala} scaleY={escala}>
                <Rect {...sala} width={sala.w} height={sala.h} fill="#f8fafc" stroke="#94a3b8" strokeWidth={1} strokeScaleEnabled={false} listening={false} />
                {(env.walls || []).map(p => {
                  const pontos = [p.x1, p.y1, p.x2, p.y2]
                  const escolhida = sel?.tipo === 'parede' && sel.id === p.id
                  return (
                    <Group
                      key={p.id} draggable={!p.locked}
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
                    x={n.x} y={n.y} rotation={n.rotation || 0} draggable={!n.locked}
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
            </Layer>
          </Stage>
        )}
      </div>
      <aside className="w-60 flex-shrink-0 space-y-5 overflow-y-auto border-l border-border bg-card p-3 text-sm">
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
              <p className="text-xs">{noSel.label || typeLabels[noSel.type] || String(noSel.type)}{noSel.locked ? ' (travado)' : ''}</p>
              <Cores valor={noSel.color || toolDefaults[noSel.type]?.color || '#94a3b8'} onChange={c => corNo(noSel.id, c)} />
            </>
          ) : (
            <p className="text-xs text-muted-foreground">{sel?.tipo === 'parede' ? 'Parede selecionada.' : 'Clique em um elemento para mudar só a cor dele.'}</p>
          )}
        </section>
      </aside>
      </div>
    </div>
  )
}
