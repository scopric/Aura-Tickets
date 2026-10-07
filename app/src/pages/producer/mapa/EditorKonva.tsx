import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { Stage, Layer, Group, Rect, Line, Text } from 'react-konva'
import type Konva from 'konva'
import { useProducerEvents } from '../../../hooks/useEvents'
import { useEventoDaUrl } from '../../../hooks/useEventoDaUrl'
import { Button } from '@/components/ui/button'
import { limites, ajustarTela, zoomNoCursor, ORIGEM_SALA, type Vista } from './geometria'
import { usarMapa } from './usarMapa'

const PASSOS_REGUA = [1, 2, 5, 10, 20, 50, 100]

export default function EditorKonva() {
  const { data: eventos = [], isLoading: carregandoEventos, isError: erroEventos, refetch: recarregarEventos } = useProducerEvents()
  const [eventId, trocarEvento] = useEventoDaUrl(eventos.map(e => e.id))
  const { envs, pronto, erroMapa, sujo, salvar } = usarMapa(eventId)
  const [ativo, setAtivo] = useState(0)
  const env = envs[ativo] || envs[0]
  const ppm = env.pixelsPerMeter || 40

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
  const ajustar = useCallback(() => {
    if (tam.w === 0 || tam.h === 0) return
    const e = envRef.current
    setVista(ajustarTela(limites(e), tam.w, tam.h, e.pixelsPerMeter || 40))
  }, [tam.w, tam.h])
  // Enquadra ao abrir o mapa e ao trocar de pavimento (não a cada edição)
  useEffect(() => { if (pronto) ajustar() }, [pronto, eventId, ativo, ajustar])
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
    if (noFundo(e)) pan.current = e.target.getStage()!.getPointerPosition()
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
        <Button size="sm" onClick={() => salvar(ativo)} disabled={!pronto}>Salvar</Button>
        {erroMapa && <span className="text-xs text-destructive">Não consegui ler o mapa: Salvar bloqueado. Recarregue a página.</span>}
        {sujo && <span className="text-xs text-muted-foreground">Alterações não salvas</span>}
      </header>
      <div ref={caixaRef} className="relative min-h-0 flex-1 bg-muted/40">
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
              </Group>
            </Layer>
            <Layer listening={false}>
              <Line points={[16, tam.h - 20, 16 + passo * escala, tam.h - 20]} stroke="#475569" strokeWidth={2} />
              <Text x={16} y={tam.h - 38} text={`${passo} m`} fontSize={12} fill="#475569" />
            </Layer>
          </Stage>
        )}
      </div>
    </div>
  )
}
