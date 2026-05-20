import { useState, useRef, useEffect, useCallback } from 'react'
import { Link } from 'react-router'
import {
  ArrowLeft, Save, ZoomIn, ZoomOut, RotateCcw, Grid3X3,
  Square, Circle as CircleIcon, Type, Trash2, Copy,
  Armchair, Monitor, Wine, DoorOpen, Plus, X, Layers, Check,
  Info, Search, MapPin, Download, Upload, Undo, Redo,
  Lock, Unlock, MousePointer,
  AlignLeft, AlignCenter,
  ImagePlus, Trash, ArrowUpDown, CircleHelp, ConciergeBell,
  SquareMenu, Globe, Building2, ChevronDown
} from 'lucide-react'
import { toast } from 'sonner'

type ToolType = 'select' | 'seat' | 'table' | 'stage' | 'bar' | 'door' | 'text' | 'dancefloor' | 'area' | 'stairs' | 'restroom' | 'info' | 'service'
type SeatStatus = 'free' | 'sold' | 'blocked' | 'reserved'

interface SeatNode {
  id: string
  x: number
  y: number
  label: string
  type: ToolType
  color: string
  price: number
  rotation: number
  sold: number
  capacity: number
  sectionId: string
  status: SeatStatus
  locked: boolean
}

interface Section {
  id: string
  name: string
  color: string
  price: number
}

interface Environment {
  id: string
  name: string
  seats: SeatNode[]
  sections: Section[]
}

const sectionColors = [
  '#7a3b69', '#1e3a5f', '#d97706', '#16a34a', '#dc2626',
  '#0891b2', '#8b5cf6', '#ec4899', '#78716c', '#059669'
]

const defaultSections: Section[] = [
  { id: 'vip', name: 'VIP Frontal', color: '#d97706', price: 250 },
  { id: 'premium', name: 'Premium', color: '#7a3b69', price: 150 },
  { id: 'regular', name: 'Regular', color: '#1e3a5f', price: 80 },
  { id: 'pista', name: 'Pista', color: '#16a34a', price: 60 },
  { id: 'mezanino', name: 'Mezanino', color: '#8b5cf6', price: 120 },
]

const typeLabels: Record<ToolType, string> = {
  select: 'Selecionar', seat: 'Cadeira', table: 'Mesa', stage: 'Palco', bar: 'Bar',
  door: 'Entrada', text: 'Texto', dancefloor: 'Pista', area: 'Area',
  stairs: 'Escada', restroom: 'Banheiro', info: 'Informacao', service: 'Atendimento'
}

let _nextId = 1
const genId = () => `e${_nextId++}`
const snapVal = (v: number, g: number) => Math.round(v / g) * g

const allTools: ToolType[] = ['select', 'seat', 'table', 'stage', 'bar', 'door', 'text', 'dancefloor', 'area', 'stairs', 'restroom', 'info', 'service']

function toolIcon(t: ToolType) {
  switch (t) {
    case 'select': return MousePointer
    case 'seat': return Armchair
    case 'table': return Square
    case 'stage': return Monitor
    case 'bar': return Wine
    case 'door': return DoorOpen
    case 'text': return Type
    case 'dancefloor': return CircleIcon
    case 'area': return Layers
    case 'stairs': return ArrowUpDown
    case 'restroom': return SquareMenu
    case 'info': return CircleHelp
    case 'service': return ConciergeBell
  }
}

const toolDefaults: Record<ToolType, { w: number; h: number; cap: number; color: string }> = {
  select: { w: 0, h: 0, cap: 0, color: '' },
  seat: { w: 32, h: 32, cap: 1, color: '#7a3b69' },
  table: { w: 70, h: 50, cap: 4, color: '#7a3b69' },
  stage: { w: 200, h: 60, cap: 0, color: '#444' },
  bar: { w: 100, h: 30, cap: 0, color: '#8b5cf6' },
  door: { w: 50, h: 60, cap: 0, color: '#059669' },
  text: { w: 120, h: 30, cap: 0, color: '#1e3a5f' },
  dancefloor: { w: 140, h: 140, cap: 0, color: '#d97706' },
  area: { w: 160, h: 100, cap: 0, color: '#78716c' },
  stairs: { w: 50, h: 60, cap: 0, color: '#f97316' },
  restroom: { w: 50, h: 40, cap: 0, color: '#0891b2' },
  info: { w: 50, h: 40, cap: 0, color: '#1d4ed8' },
  service: { w: 60, h: 40, cap: 0, color: '#059669' },
}

export default function SeatingMap() {
  // Environments (multiple spaces/floors)
  const [environments, setEnvironments] = useState<Environment[]>([
    { id: 'terreo', name: 'Terreo', seats: [], sections: JSON.parse(JSON.stringify(defaultSections)) },
  ])
  const [activeEnv, setActiveEnv] = useState(0)
  const env = environments[activeEnv]

  const setSeats = (updater: SeatNode[] | ((prev: SeatNode[]) => SeatNode[])) => {
    setEnvironments(prev => {
      const next = [...prev]
      next[activeEnv] = { ...next[activeEnv], seats: typeof updater === 'function' ? updater(next[activeEnv].seats) : updater }
      return next
    })
  }
  const seats = env.seats

  const setSections = (updater: Section[] | ((prev: Section[]) => Section[])) => {
    setEnvironments(prev => {
      const next = [...prev]
      next[activeEnv] = { ...next[activeEnv], sections: typeof updater === 'function' ? updater(next[activeEnv].sections) : updater }
      return next
    })
  }
  const sections = env.sections

  // Tool & Selection
  const [tool, setTool] = useState<ToolType>('select')
  const [selected, setSelected] = useState<string[]>([])
  const [activeSec, setActiveSec] = useState(env.sections[0]?.id || 'sec1')
  const [justHandled, setJustHandled] = useState(false)

  // View
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPan, setIsPan] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })

  // Toggles
  const [showHelp, setShowHelp] = useState(true)
  const [snap, setSnap] = useState(true)
  const [gridSize, setGridSize] = useState(20)
  const [showGrid, setShowGrid] = useState(true)
  const [showLabels, setShowLabels] = useState(true)
  const [search, setSearch] = useState('')
  const [showMinimap, setShowMinimap] = useState(false)

  // History (per environment)
  const [history, setHistory] = useState<Record<number, SeatNode[][]>>({ 0: [[]] })
  const [histIdx, setHistIdx] = useState<Record<number, number>>({ 0: 0 })

  // Clipboard
  const [clipboard, setClipboard] = useState<SeatNode[]>([])

  // Dragging
  const [isDraggingNode, setIsDraggingNode] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [boxSel, setBoxSel] = useState<{ active: boolean; x1: number; y1: number; x2: number; y2: number } | null>(null)

  // Background image
  const [bgImage, setBgImage] = useState<string | null>(null)
  const [bgOpacity, setBgOpacity] = useState(0.5)
  const [bgScale, setBgScale] = useState(1)
  const [bgOffset, setBgOffset] = useState({ x: 50, y: 50 })

  const canvasRef = useRef<HTMLDivElement>(null)

  const activeSection = sections.find(s => s.id === activeSec) || sections[0]

  const pushHistory = useCallback((newSeats: SeatNode[]) => {
    setHistory(prev => {
      const envHist = prev[activeEnv] || [[]]
      const envIdx = (histIdx[activeEnv] || 0)
      const next = envHist.slice(0, envIdx + 1)
      next.push(newSeats)
      if (next.length > 30) next.shift()
      return { ...prev, [activeEnv]: next }
    })
    setHistIdx(prev => ({ ...prev, [activeEnv]: Math.min((prev[activeEnv] || 0) + 1, 29) }))
  }, [activeEnv, histIdx])

  const undo = () => {
    const idx = histIdx[activeEnv] || 0
    if (idx > 0) {
      const envHist = history[activeEnv] || [[]]
      const newSeats = envHist[idx - 1]
      setEnvironments(prev => {
        const next = [...prev]
        next[activeEnv] = { ...next[activeEnv], seats: newSeats }
        return next
      })
      setHistIdx(prev => ({ ...prev, [activeEnv]: idx - 1 }))
      toast.success('Desfeito')
    }
  }

  const redo = () => {
    const idx = histIdx[activeEnv] || 0
    const envHist = history[activeEnv] || [[]]
    if (idx < envHist.length - 1) {
      const newSeats = envHist[idx + 1]
      setEnvironments(prev => {
        const next = [...prev]
        next[activeEnv] = { ...next[activeEnv], seats: newSeats }
        return next
      })
      setHistIdx(prev => ({ ...prev, [activeEnv]: idx + 1 }))
      toast.success('Refeito')
    }
  }

  const getPos = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return { x: (e.clientX - rect.left - pan.x) / zoom, y: (e.clientY - rect.top - pan.y) / zoom }
  }

  // Environment management
  const addEnvironment = () => {
    const newEnv: Environment = {
      id: genId(),
      name: `Ambiente ${environments.length + 1}`,
      seats: [],
      sections: JSON.parse(JSON.stringify(defaultSections)),
    }
    setEnvironments([...environments, newEnv])
    setActiveEnv(environments.length)
    setHistory(prev => ({ ...prev, [environments.length]: [[]] }))
    setHistIdx(prev => ({ ...prev, [environments.length]: 0 }))
    setSelected([])
    setPan({ x: 0, y: 0 })
    setZoom(1)
    toast.success(`Ambiente "${newEnv.name}" criado`)
  }

  const removeEnvironment = (idx: number) => {
    if (environments.length <= 1) { toast.error('Precisa ter pelo menos 1 ambiente'); return }
    const next = environments.filter((_, i) => i !== idx)
    setEnvironments(next)
    const newIdx = Math.min(activeEnv, next.length - 1)
    setActiveEnv(newIdx)
    toast.success('Ambiente removido')
  }

  // Templates
  const applyTemplate = (name: string) => {
    const sec = activeSection
    let newSeats: SeatNode[] = []
    const baseX = 300, baseY = 200

    if (name === 'Teatro') {
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 12; c++) {
          newSeats.push({
            id: genId(), x: baseX + c * 38, y: baseY + r * 38,
            label: `${String.fromCharCode(65 + r)}${c + 1}`, type: 'seat', color: sec.color,
            price: sec.price, rotation: 0, sold: 0, capacity: 1, sectionId: activeSec, status: 'free', locked: false
          })
        }
      }
      newSeats.push({ id: genId(), x: baseX + 160, y: baseY - 70, label: 'Palco', type: 'stage', color: '#444', price: 0, rotation: 0, sold: 0, capacity: 0, sectionId: activeSec, status: 'free', locked: false })
    } else if (name === 'Cinema') {
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 10; c++) {
          newSeats.push({
            id: genId(), x: baseX + c * 40, y: baseY + r * 42,
            label: `${r + 1}-${c + 1}`, type: 'seat', color: sec.color,
            price: sec.price, rotation: 0, sold: 0, capacity: 1, sectionId: activeSec, status: 'free', locked: false
          })
        }
      }
      newSeats.push({ id: genId(), x: baseX + 160, y: baseY - 80, label: 'Tela', type: 'stage', color: '#111', price: 0, rotation: 0, sold: 0, capacity: 0, sectionId: activeSec, status: 'free', locked: false })
    } else if (name === 'Show') {
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 8; c++) {
          newSeats.push({
            id: genId(), x: baseX + c * 36, y: baseY + r * 36,
            label: `${String.fromCharCode(65 + r)}${c + 1}`, type: 'seat', color: sec.color,
            price: sec.price, rotation: 0, sold: 0, capacity: 1, sectionId: activeSec, status: 'free', locked: false
          })
        }
      }
      newSeats.push({ id: genId(), x: baseX - 20, y: baseY - 70, label: 'Palco', type: 'stage', color: '#333', price: 0, rotation: 0, sold: 0, capacity: 0, sectionId: activeSec, status: 'free', locked: false })
    } else if (name === 'Jantar') {
      for (let t = 0; t < 4; t++) {
        const tx = baseX + (t % 2) * 200 + 80, ty = baseY + Math.floor(t / 2) * 160 + 80
        newSeats.push({
          id: genId(), x: tx, y: ty, label: `M${t + 1}`, type: 'table', color: sec.color,
          price: sec.price * 4, rotation: 0, sold: 0, capacity: 4, sectionId: activeSec, status: 'free', locked: false
        })
        const offsets = [[0, -40], [45, 0], [0, 40], [-45, 0]]
        offsets.forEach((off, i) => {
          const angles = [0, 90, 180, 270]
          newSeats.push({
            id: genId(), x: tx + off[0], y: ty + off[1], label: `C${t + 1}-${i + 1}`, type: 'seat', color: sec.color,
            price: sec.price, rotation: angles[i], sold: 0, capacity: 1, sectionId: activeSec, status: 'free', locked: false
          })
        })
      }
    } else if (name === 'Auditorio') {
      for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 8; c++) {
          newSeats.push({
            id: genId(), x: baseX + c * 38, y: baseY + r * 36,
            label: `${String.fromCharCode(65 + r)}${c + 1}`, type: 'seat', color: sec.color,
            price: sec.price, rotation: 0, sold: 0, capacity: 1, sectionId: activeSec, status: 'free', locked: false
          })
        }
      }
      newSeats.push({ id: genId(), x: baseX - 10, y: baseY - 70, label: 'Palco', type: 'stage', color: '#444', price: 0, rotation: 0, sold: 0, capacity: 0, sectionId: activeSec, status: 'free', locked: false })
      newSeats.push({ id: genId(), x: baseX - 60, y: baseY + 180, label: 'Entrada', type: 'door', color: '#059669', price: 0, rotation: 0, sold: 0, capacity: 0, sectionId: activeSec, status: 'free', locked: false })
    } else if (name === 'Vazio') {
      newSeats = []
    }

    const merged = name === 'Vazio' ? [] : [...seats, ...newSeats]
    setSeats(merged)
    pushHistory(merged)
    toast.success(`Template ${name}: ${newSeats.length} elementos`)
  }

  // Mouse handlers for canvas
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      setIsPan(true)
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
      return
    }
    if (tool === 'select' && e.button === 0) {
      const { x, y } = getPos(e)
      setBoxSel({ active: true, x1: x, y1: y, x2: x, y2: y })
      if (!e.ctrlKey && !e.metaKey) setSelected([])
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPan) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y })
      return
    }
    if (isDraggingNode && selected.length === 1) {
      const { x, y } = getPos(e)
      let nx = x - dragOffset.x
      let ny = y - dragOffset.y
      if (snap) { nx = snapVal(nx, gridSize); ny = snapVal(ny, gridSize) }
      const curSeats = environments[activeEnv].seats
      const next = curSeats.map(s => s.id === selected[0] ? { ...s, x: nx, y: ny } : s)
      setSeats(next)
      return
    }
    if (boxSel?.active) {
      const { x, y } = getPos(e)
      setBoxSel({ ...boxSel, x2: x, y2: y })
      const minX = Math.min(boxSel.x1, x), maxX = Math.max(boxSel.x1, x)
      const minY = Math.min(boxSel.y1, y), maxY = Math.max(boxSel.y1, y)
      const curSeats = environments[activeEnv].seats
      const inside = curSeats.filter(s => s.x >= minX && s.x <= maxX && s.y >= minY && s.y <= maxY).map(s => s.id)
      setSelected(inside)
    }
  }

  const handleMouseUp = () => {
    if (isDraggingNode) {
      setIsDraggingNode(false)
      pushHistory(environments[activeEnv].seats)
    }
    if (boxSel?.active) {
      setBoxSel(null)
    }
    setIsPan(false)
    setTimeout(() => setJustHandled(false), 50)
  }

  // Click on empty canvas - only add elements
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (justHandled || isPan || isDraggingNode || tool === 'select') return

    const { x, y } = getPos(e)
    const finalX = snap ? snapVal(x, gridSize) : x
    const finalY = snap ? snapVal(y, gridSize) : y

    const def = toolDefaults[tool]
    const count = seats.filter(s => s.type === tool).length
    const newNode: SeatNode = {
      id: genId(), x: finalX, y: finalY, type: tool,
      label: tool === 'seat' ? `${count + 1}` : tool === 'table' ? `M${count + 1}` : typeLabels[tool],
      color: activeSection?.color || def.color,
      price: activeSection?.price || 0, rotation: 0,
      sold: 0, capacity: def.cap, sectionId: activeSec, status: 'free', locked: false
    }
    const next = [...seats, newNode]
    setSeats(next)
    pushHistory(next)
    setSelected([newNode.id])
    toast.success(`${typeLabels[tool]} adicionado`)
  }

  // Click on element
  const handleElementClick = (e: React.MouseEvent, node: SeatNode) => {
    e.stopPropagation()
    setJustHandled(true)
    if (tool !== 'select') return
    if (e.ctrlKey || e.metaKey) {
      setSelected(prev => prev.includes(node.id) ? prev.filter(id => id !== node.id) : [...prev, node.id])
    } else {
      setSelected([node.id])
    }
  }

  // Element drag start (mousedown on element)
  const handleElementMouseDown = (e: React.MouseEvent, node: SeatNode) => {
    e.stopPropagation()
    setJustHandled(true)
    if (tool !== 'select' || node.locked) return
    if (e.button !== 0) return

    if (!selected.includes(node.id)) {
      if (e.ctrlKey || e.metaKey) {
        setSelected(prev => [...prev, node.id])
      } else {
        setSelected([node.id])
      }
    }

    if (!node.locked) {
      setIsDraggingNode(true)
      const pos = getPos(e)
      setDragOffset({ x: pos.x - node.x, y: pos.y - node.y })
    }
  }

  // Actions
  const updateNode = (id: string, changes: Partial<SeatNode>) => {
    const curSeats = environments[activeEnv].seats
    const next = curSeats.map(s => s.id === id ? { ...s, ...changes } : s)
    setSeats(next)
    pushHistory(next)
  }

  const updateMany = (ids: string[], changes: Partial<SeatNode>) => {
    const curSeats = environments[activeEnv].seats
    const next = curSeats.map(s => ids.includes(s.id) ? { ...s, ...changes } : s)
    setSeats(next)
    pushHistory(next)
  }

  const dup = (id: string) => {
    const s = seats.find(x => x.id === id)
    if (!s || s.locked) return
    const n = { ...s, id: genId(), x: s.x + 35, y: s.y + 35, sold: 0, status: 'free' as SeatStatus }
    const next = [...seats, n]
    setSeats(next)
    pushHistory(next)
    setSelected([n.id])
    toast.success('Duplicado')
  }

  const dupMany = () => {
    const toDup = seats.filter(s => selected.includes(s.id) && !s.locked)
    if (!toDup.length) return
    const newOnes = toDup.map(s => ({ ...s, id: genId(), x: s.x + 35, y: s.y + 35, sold: 0, status: 'free' as SeatStatus }))
    const next = [...seats, ...newOnes]
    setSeats(next)
    pushHistory(next)
    setSelected(newOnes.map(n => n.id))
    toast.success(`${newOnes.length} duplicados`)
  }

  const delNode = (id: string) => {
    const s = seats.find(x => x.id === id)
    if (s?.locked) { toast.error('Elemento travado'); return }
    const next = seats.filter(x => x.id !== id)
    setSeats(next)
    pushHistory(next)
    setSelected(prev => prev.filter(i => i !== id))
    toast.success('Removido')
  }

  const delMany = () => {
    const lockedCount = seats.filter(s => selected.includes(s.id) && s.locked).length
    if (lockedCount) { toast.error(`${lockedCount} travados - destrave primeiro`); return }
    const next = seats.filter(x => !selected.includes(x.id))
    setSeats(next)
    pushHistory(next)
    setSelected([])
    toast.success(`${selected.length} removidos`)
  }

  const sell = (id: string) => {
    const s = seats.find(x => x.id === id)
    if (!s || s.capacity === 0 || s.sold >= s.capacity || s.status === 'blocked') return
    updateNode(id, { sold: s.sold + 1, status: s.sold + 1 >= s.capacity ? 'sold' : 'reserved' as SeatStatus })
    toast.success('Vendido!')
  }

  const unsell = (id: string) => {
    const s = seats.find(x => x.id === id)
    if (!s || s.sold <= 0) return
    updateNode(id, { sold: s.sold - 1, status: s.sold - 1 <= 0 ? 'free' : 'reserved' as SeatStatus })
    toast.success('Cancelado')
  }

  const copySelected = () => {
    const items = seats.filter(s => selected.includes(s.id))
    setClipboard(items)
    toast.success(`${items.length} copiados`)
  }

  const paste = () => {
    if (!clipboard.length) return
    const newOnes = clipboard.map(s => ({ ...s, id: genId(), x: s.x + 40, y: s.y + 40, sold: 0, status: 'free' as SeatStatus }))
    const next = [...seats, ...newOnes]
    setSeats(next)
    pushHistory(next)
    setSelected(newOnes.map(n => n.id))
    toast.success(`${newOnes.length} colados`)
  }

  const selectAll = () => {
    const allIds = seats.map(s => s.id)
    setSelected(allIds)
    toast.success(`${allIds.length} selecionados`)
  }

  const exportMap = () => {
    const data = JSON.stringify({ seats, sections, environments, exportedAt: new Date().toISOString() }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'aura-mapa.json'; a.click()
    URL.revokeObjectURL(url)
    toast.success('Mapa exportado')
  }

  const importMap = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result))
        if (data.environments && Array.isArray(data.environments)) {
          setEnvironments(data.environments)
          setActiveEnv(0)
          setHistory({ 0: [data.environments[0]?.seats || []] })
          setHistIdx({ 0: 0 })
          toast.success(`${data.environments.length} ambientes importados`)
        } else if (data.seats) {
          const next = data.seats.map((s: SeatNode) => ({ ...s, id: s.id || genId() }))
          setSeats(next)
          if (data.sections) setSections(data.sections)
          pushHistory(next)
          toast.success('Mapa importado')
        }
      } catch { toast.error('Arquivo invalido') }
    }
    reader.readAsText(file)
  }

  const uploadBgImage = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      setBgImage(String(reader.result))
      setBgScale(1)
      setBgOffset({ x: 50, y: 50 })
      setBgOpacity(0.5)
      toast.success('Mapa carregado! Ajuste a opacidade e posicao')
    }
    reader.readAsDataURL(file)
  }

  const align = (dir: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    const selSeats = seats.filter(s => selected.includes(s.id))
    if (selSeats.length < 2) return
    let next = [...seats]
    if (dir === 'left') { const minX = Math.min(...selSeats.map(s => s.x)); next = next.map(s => selected.includes(s.id) ? { ...s, x: minX } : s) }
    else if (dir === 'right') { const maxX = Math.max(...selSeats.map(s => s.x)); next = next.map(s => selected.includes(s.id) ? { ...s, x: maxX } : s) }
    else if (dir === 'top') { const minY = Math.min(...selSeats.map(s => s.y)); next = next.map(s => selected.includes(s.id) ? { ...s, y: minY } : s) }
    else if (dir === 'bottom') { const maxY = Math.max(...selSeats.map(s => s.y)); next = next.map(s => selected.includes(s.id) ? { ...s, y: maxY } : s) }
    else if (dir === 'center') { const avgX = selSeats.reduce((sum, s) => sum + s.x, 0) / selSeats.length; next = next.map(s => selected.includes(s.id) ? { ...s, x: avgX } : s) }
    else if (dir === 'middle') { const avgY = selSeats.reduce((sum, s) => sum + s.y, 0) / selSeats.length; next = next.map(s => selected.includes(s.id) ? { ...s, y: avgY } : s) }
    setSeats(next)
    pushHistory(next)
    toast.success(`Alinhado: ${dir}`)
  }

  // Minimap navigation
  const minimapNavigate = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratioX = (e.clientX - rect.left) / rect.width
    const ratioY = (e.clientY - rect.top) / rect.height
    const canvasW = 3000, canvasH = 3000
    const viewW = canvasRef.current?.clientWidth || 800
    const viewH = canvasRef.current?.clientHeight || 600
    setPan({
      x: -(ratioX * canvasW - viewW / 2),
      y: -(ratioY * canvasH - viewH / 2)
    })
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo() }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo() }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') { e.preventDefault(); copySelected() }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') { e.preventDefault(); paste() }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') { e.preventDefault(); selectAll() }
      if (e.key === 'Delete' || e.key === 'Backspace') { if (selected.length) { e.preventDefault(); delMany() } }
      if (e.key === 'd' || e.key === 'D') { if (selected.length) { e.preventDefault(); dupMany() } }
      if (e.key === 'Escape') { setSelected([]); setTool('select') }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selected, seats, clipboard, histIdx, history, activeEnv, environments])

  const totalSeats = seats.filter(s => s.type === 'seat').length
  const totalTables = seats.filter(s => s.type === 'table').length
  const totalCap = seats.reduce((s, e) => s + e.capacity, 0)
  const totalSold = seats.reduce((s, e) => s + e.sold, 0)
  const revenue = seats.reduce((s, e) => s + e.price * e.sold, 0)
  const potential = seats.reduce((s, e) => s + e.price * e.capacity, 0)
  const reservedCount = seats.filter(s => s.status === 'reserved').length
  const blockedCount = seats.filter(s => s.status === 'blocked').length

  const sel = seats.filter(s => selected.includes(s.id))
  const isSel = sel.length === 1
  const isMulti = sel.length > 1

  const filteredSeats = search
    ? seats.filter(s => s.label.toLowerCase().includes(search.toLowerCase()) || typeLabels[s.type].toLowerCase().includes(search.toLowerCase()))
    : seats

  // Canvas dimensions for minimap
  const canvasW = 3000, canvasH = 3000
  const viewW = canvasRef.current?.clientWidth || 800
  const viewH = canvasRef.current?.clientHeight || 600

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-white/60 bg-white/50 backdrop-blur-sm flex-shrink-0 z-20">
        <Link to="/producer/dashboard" className="p-1.5 rounded-full bg-white/60 border border-white/60 text-espresso/50 hover:text-espresso transition-colors flex-shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-lg text-espresso">Editor de Mapa</h1>
          <p className="text-[9px] text-espresso/40">Ctrl+A=selecionar tudo · Shift+arraste=pan · Ctrl+Z=desfazer</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="relative hidden sm:block">
            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-espresso/30" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar..." className="pl-6 pr-2 py-1 bg-white/60 border border-white/60 rounded-lg text-[10px] w-28 focus:outline-none focus:border-plum/30" />
          </div>
          <button onClick={() => setShowGrid(!showGrid)} title="Grade" className={`p-1.5 rounded-lg border transition-all ${showGrid ? 'bg-plum/10 border-plum/30 text-plum' : 'bg-white/60 border-white/60 text-espresso/40'}`}><Grid3X3 className="w-3.5 h-3.5" /></button>
          <button onClick={() => setShowLabels(!showLabels)} title="Labels" className={`p-1.5 rounded-lg border transition-all ${showLabels ? 'bg-plum/10 border-plum/30 text-plum' : 'bg-white/60 border-white/60 text-espresso/40'}`}><Type className="w-3.5 h-3.5" /></button>
          <button onClick={() => setShowMinimap(!showMinimap)} title="Mini-mapa" className={`p-1.5 rounded-lg border transition-all ${showMinimap ? 'bg-plum/10 border-plum/30 text-plum' : 'bg-white/60 border-white/60 text-espresso/40'}`}><MapPin className="w-3.5 h-3.5" /></button>
          <button onClick={undo} disabled={(histIdx[activeEnv] || 0) <= 0} className="p-1.5 rounded-lg border border-white/60 bg-white/60 text-espresso/40 hover:text-espresso disabled:opacity-30"><Undo className="w-3.5 h-3.5" /></button>
          <button onClick={redo} disabled={(histIdx[activeEnv] || 0) >= ((history[activeEnv] || []).length - 1)} className="p-1.5 rounded-lg border border-white/60 bg-white/60 text-espresso/40 hover:text-espresso disabled:opacity-30"><Redo className="w-3.5 h-3.5" /></button>
          <div className="flex items-center gap-1 bg-white/60 rounded-lg border border-white/60 px-1 py-0.5">
            <button onClick={() => setZoom(z => Math.max(0.4, z - 0.15))} className="p-1 rounded hover:bg-white/60"><ZoomOut className="w-3.5 h-3.5 text-espresso/40" /></button>
            <span className="text-[10px] text-espresso/50 w-9 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(2.5, z + 0.15))} className="p-1 rounded hover:bg-white/60"><ZoomIn className="w-3.5 h-3.5 text-espresso/40" /></button>
            <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} className="p-1 rounded hover:bg-white/60"><RotateCcw className="w-3.5 h-3.5 text-espresso/40" /></button>
          </div>
          <button onClick={exportMap} className="p-1.5 rounded-lg border border-white/60 bg-white/60 text-espresso/40 hover:text-espresso" title="Exportar"><Download className="w-3.5 h-3.5" /></button>
          <label className="p-1.5 rounded-lg border border-white/60 bg-white/60 text-espresso/40 hover:text-espresso cursor-pointer" title="Importar">
            <Upload className="w-3.5 h-3.5" />
            <input type="file" accept=".json" className="hidden" onChange={e => e.target.files?.[0] && importMap(e.target.files[0])} />
          </label>
          <button onClick={() => { toast.success('Mapa salvo!') }} className="px-3 py-1.5 bg-plum text-cream text-[10px] rounded-full hover:shadow-glow transition-all flex items-center gap-1">
            <Save className="w-3 h-3" /> Salvar
          </button>
        </div>
      </div>

      {/* Environment tabs */}
      <div className="flex items-center gap-1 px-4 py-1.5 border-b border-white/40 bg-white/30 flex-shrink-0 overflow-x-auto">
        <Building2 className="w-3.5 h-3.5 text-espresso/40 mr-1 flex-shrink-0" />
        {environments.map((e, i) => (
          <div key={e.id} className={`flex items-center gap-1 px-3 py-1 rounded-lg text-[10px] transition-all cursor-pointer border ${i === activeEnv ? 'bg-plum/10 border-plum/30 text-plum' : 'bg-white/40 border-white/60 text-espresso/50 hover:text-espresso'}`}>
            <button onClick={() => { setActiveEnv(i); setSelected([]); }} className="flex items-center gap-1">
              <Globe className="w-3 h-3" />
              <span>{e.name}</span>
              <span className="text-[8px] opacity-50">({e.seats.length})</span>
            </button>
            {environments.length > 1 && (
              <button onClick={(ev) => { ev.stopPropagation(); removeEnvironment(i); }} className="ml-1 p-0.5 rounded hover:bg-red-100 text-espresso/30 hover:text-red-500">
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        ))}
        <button onClick={addEnvironment} className="flex items-center gap-1 px-2 py-1 rounded-lg border border-dashed border-white/60 text-[10px] text-espresso/40 hover:text-espresso hover:border-plum/30 transition-all">
          <Plus className="w-3 h-3" /> Novo
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-60 bg-white/40 border-r border-white/60 flex flex-col overflow-y-auto sidebar-dark-scroll flex-shrink-0">
          {/* Templates */}
          <div className="p-3 border-b border-white/60">
            <h3 className="text-[10px] font-medium text-espresso uppercase tracking-wider mb-2">Templates</h3>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { name: 'Teatro', icon: Armchair, desc: '8x12' },
                { name: 'Cinema', icon: Monitor, desc: '6x10' },
                { name: 'Show', icon: CircleIcon, desc: '5x8' },
                { name: 'Jantar', icon: Square, desc: '4 mesas' },
                { name: 'Auditorio', icon: Layers, desc: '10x8' },
                { name: 'Vazio', icon: X, desc: 'Limpar' },
              ].map(t => (
                <button key={t.name} onClick={() => applyTemplate(t.name)}
                  className="p-2 bg-white/40 rounded-lg border border-white/60 hover:border-plum/30 hover:bg-plum/5 transition-all text-center">
                  <t.icon className="w-4 h-4 text-espresso/30 mx-auto mb-1" />
                  <span className="text-[8px] text-espresso/50 block">{t.name}</span>
                  <span className="text-[7px] text-espresso/30">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tools */}
          <div className="p-3 border-b border-white/60">
            <h3 className="text-[10px] font-medium text-espresso uppercase tracking-wider mb-2">Ferramentas</h3>
            <div className="grid grid-cols-4 gap-1">
              {allTools.map(t => {
                const Icon = toolIcon(t)
                return (
                  <button key={t} onClick={() => setTool(t)}
                    className={`p-1.5 rounded-lg border transition-all flex flex-col items-center gap-0.5 ${tool === t ? 'bg-plum/10 border-plum/30 text-plum' : 'bg-white/40 border-white/60 text-espresso/40 hover:text-espresso'}`}
                    title={typeLabels[t]}>
                    <Icon className="w-3.5 h-3.5" />
                    <span className="text-[7px]">{typeLabels[t]}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Snap & Grid */}
          <div className="p-3 border-b border-white/60">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-medium text-espresso uppercase tracking-wider">Grade & Snap</h3>
              <button onClick={() => setSnap(!snap)} className={`text-[9px] px-2 py-0.5 rounded-full border transition-all ${snap ? 'bg-plum/10 border-plum/30 text-plum' : 'bg-white/40 border-white/60 text-espresso/40'}`}>{snap ? 'On' : 'Off'}</button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-espresso/40">Tamanho</span>
              <input type="range" min="10" max="50" step="5" value={gridSize} onChange={e => setGridSize(Number(e.target.value))} className="flex-1 accent-plum" />
              <span className="text-[9px] text-espresso/50 w-6 text-right">{gridSize}</span>
            </div>
          </div>

          {/* Background Image Upload */}
          <div className="p-3 border-b border-white/60">
            <h3 className="text-[10px] font-medium text-espresso uppercase tracking-wider mb-2">Mapa de Fundo</h3>
            {!bgImage ? (
              <label className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-white/60 rounded-xl cursor-pointer hover:border-plum/30 hover:bg-plum/5 transition-all text-center">
                <ImagePlus className="w-6 h-6 text-espresso/30" />
                <span className="text-[9px] text-espresso/40">Suba planta baixa ou mapa</span>
                <span className="text-[8px] text-espresso/30">PNG, JPG ate 5MB</span>
                <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadBgImage(e.target.files[0])} />
              </label>
            ) : (
              <div className="space-y-2">
                <div className="relative rounded-xl overflow-hidden border border-white/60">
                  <img src={bgImage} alt="Mapa" className="w-full h-20 object-cover" />
                  <button onClick={() => setBgImage(null)} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-sm">
                    <Trash className="w-2.5 h-2.5" />
                  </button>
                </div>
                <div>
                  <label className="text-[9px] text-espresso/40">Opacidade</label>
                  <div className="flex items-center gap-2">
                    <input type="range" min="10" max="100" value={Math.round(bgOpacity * 100)} onChange={e => setBgOpacity(Number(e.target.value) / 100)} className="flex-1 accent-plum" />
                    <span className="text-[9px] text-espresso/50 w-8 text-right">{Math.round(bgOpacity * 100)}%</span>
                  </div>
                </div>
                <div>
                  <label className="text-[9px] text-espresso/40">Escala</label>
                  <div className="flex items-center gap-2">
                    <input type="range" min="50" max="300" value={Math.round(bgScale * 100)} onChange={e => setBgScale(Number(e.target.value) / 100)} className="flex-1 accent-plum" />
                    <span className="text-[9px] text-espresso/50 w-8 text-right">{Math.round(bgScale * 100)}%</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sections */}
          <div className="p-3 border-b border-white/60">
            <h3 className="text-[10px] font-medium text-espresso uppercase tracking-wider mb-2">Secoes</h3>
            <div className="space-y-1">
              {sections.map(s => {
                const secSeats = seats.filter(st => st.sectionId === s.id)
                const secCap = secSeats.reduce((sum, st) => sum + st.capacity, 0)
                const secSold = secSeats.reduce((sum, st) => sum + st.sold, 0)
                return (
                  <button key={s.id} onClick={() => setActiveSec(s.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] transition-all ${activeSec === s.id ? 'bg-plum/5 border border-plum/20' : 'hover:bg-white/40 border border-transparent'}`}>
                    <div className="w-3 h-3 rounded-full flex-shrink-0 border border-white/60" style={{ background: s.color }} />
                    <div className="flex-1 text-left min-w-0">
                      <div className="font-medium text-espresso truncate">{s.name}</div>
                      <div className="text-[8px] text-espresso/30">R$ {s.price} &middot; {secSold}/{secCap} vend.</div>
                    </div>
                    {activeSec === s.id && <Check className="w-3 h-3 text-plum flex-shrink-0" />}
                  </button>
                )
              })}
            </div>
            <button onClick={() => {
              const id = `sec${_nextId++}`
              const color = sectionColors[sections.length % sectionColors.length]
              setSections([...sections, { id, name: `Secao ${sections.length + 1}`, color, price: 100 }])
              setActiveSec(id)
            }} className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 rounded-lg border border-dashed border-white/60 text-[9px] text-espresso/40 hover:text-espresso hover:border-plum/30 transition-all">
              <Plus className="w-3 h-3" /> Nova secao
            </button>
          </div>

          {/* Properties */}
          <div className="p-3">
            <h3 className="text-[10px] font-medium text-espresso uppercase tracking-wider mb-2">
              {isMulti ? `${sel.length} selecionados` : isSel ? 'Propriedades' : 'Nenhum selecionado'}
            </h3>
            {isSel && sel[0] && (
              <div className="space-y-2">
                <div>
                  <label className="text-[9px] text-espresso/40">Label</label>
                  <input value={sel[0].label} onChange={e => updateNode(sel[0].id, { label: e.target.value })}
                    className="w-full px-2 py-1 bg-white/60 border border-white/60 rounded-lg text-[10px] focus:outline-none focus:border-plum/30" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-espresso/40">Preco</label>
                    <input type="number" value={sel[0].price} onChange={e => updateNode(sel[0].id, { price: Number(e.target.value) })}
                      className="w-full px-2 py-1 bg-white/60 border border-white/60 rounded-lg text-[10px] focus:outline-none focus:border-plum/30" />
                  </div>
                  <div>
                    <label className="text-[9px] text-espresso/40">Rotacao</label>
                    <input type="number" value={sel[0].rotation} onChange={e => updateNode(sel[0].id, { rotation: Number(e.target.value) })}
                      className="w-full px-2 py-1 bg-white/60 border border-white/60 rounded-lg text-[10px] focus:outline-none focus:border-plum/30" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-espresso/40">Cor</label>
                    <input type="color" value={sel[0].color} onChange={e => updateNode(sel[0].id, { color: e.target.value })}
                      className="w-full h-7 bg-white/60 border border-white/60 rounded-lg cursor-pointer" />
                  </div>
                  <div>
                    <label className="text-[9px] text-espresso/40">Status</label>
                    <select value={sel[0].status} onChange={e => updateNode(sel[0].id, { status: e.target.value as SeatStatus })}
                      className="w-full px-2 py-1 bg-white/60 border border-white/60 rounded-lg text-[10px] focus:outline-none focus:border-plum/30">
                      <option value="free">Livre</option>
                      <option value="sold">Vendido</option>
                      <option value="reserved">Reservado</option>
                      <option value="blocked">Bloqueado</option>
                    </select>
                  </div>
                </div>
                {sel[0].capacity > 0 && (
                  <div>
                    <label className="text-[9px] text-espresso/40">Vendidos / Capacidade</label>
                    <div className="flex items-center gap-2 mt-1">
                      <button onClick={() => unsell(sel[0].id)} className="px-2 py-1 bg-white/60 rounded-lg text-[9px] hover:bg-white">-</button>
                      <span className="text-[10px] font-medium">{sel[0].sold} / {sel[0].capacity}</span>
                      <button onClick={() => sell(sel[0].id)} className="px-2 py-1 bg-plum/10 text-plum rounded-lg text-[9px] hover:bg-plum/20">+</button>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <button onClick={() => updateNode(sel[0].id, { locked: !sel[0].locked })} className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border text-[9px] transition-all ${sel[0].locked ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white/40 border-white/60 text-espresso/50'}`}>
                    {sel[0].locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />} {sel[0].locked ? 'Travado' : 'Destravado'}
                  </button>
                </div>
                <div className="flex gap-1.5 pt-1">
                  <button onClick={() => dup(sel[0].id)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-white/60 bg-white/40 text-[9px] text-espresso/50 hover:text-espresso"><Copy className="w-3 h-3" /> Duplicar</button>
                  <button onClick={() => delNode(sel[0].id)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-red-200 bg-red-50 text-[9px] text-red-600 hover:bg-red-100"><Trash2 className="w-3 h-3" /> Remover</button>
                </div>
              </div>
            )}
            {isMulti && (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-1">
                  <button onClick={() => updateMany(selected, { status: 'free' })} className="py-1 rounded bg-green-50 border border-green-200 text-green-700 text-[8px]">Livre</button>
                  <button onClick={() => updateMany(selected, { status: 'sold' })} className="py-1 rounded bg-plum/10 border border-plum/20 text-plum text-[8px]">Vendido</button>
                  <button onClick={() => updateMany(selected, { status: 'blocked' })} className="py-1 rounded bg-gray-50 border border-gray-200 text-gray-600 text-[8px]">Bloqueado</button>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <button onClick={() => updateMany(selected, { locked: true })} className="py-1 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[8px]">Travar</button>
                  <button onClick={() => updateMany(selected, { locked: false })} className="py-1 rounded bg-white/60 border border-white/60 text-espresso/50 text-[8px]">Destravar</button>
                  <button onClick={() => updateMany(selected, { rotation: 0 })} className="py-1 rounded bg-white/60 border border-white/60 text-espresso/50 text-[8px]">0 graus</button>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => align('left')} className="flex-1 py-1 rounded bg-white/60 border border-white/60 text-espresso/50 text-[8px]"><AlignLeft className="w-3 h-3 mx-auto" /></button>
                  <button onClick={() => align('center')} className="flex-1 py-1 rounded bg-white/60 border border-white/60 text-espresso/50 text-[8px]"><AlignCenter className="w-3 h-3 mx-auto" /></button>
                  <button onClick={() => align('right')} className="flex-1 py-1 rounded bg-white/60 border border-white/60 text-espresso/50 text-[8px]"><AlignLeft className="w-3 h-3 mx-auto rotate-180" /></button>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => align('top')} className="flex-1 py-1 rounded bg-white/60 border border-white/60 text-espresso/50 text-[8px]"><AlignCenter className="w-3 h-3 mx-auto -rotate-90" /></button>
                  <button onClick={() => align('middle')} className="flex-1 py-1 rounded bg-white/60 border border-white/60 text-espresso/50 text-[8px]"><AlignCenter className="w-3 h-3 mx-auto" /></button>
                  <button onClick={() => align('bottom')} className="flex-1 py-1 rounded bg-white/60 border border-white/60 text-espresso/50 text-[8px]"><AlignCenter className="w-3 h-3 mx-auto rotate-90" /></button>
                </div>
                <div className="flex gap-1.5 pt-1">
                  <button onClick={dupMany} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-white/60 bg-white/40 text-[9px] text-espresso/50 hover:text-espresso"><Copy className="w-3 h-3" /> Duplicar</button>
                  <button onClick={delMany} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-red-200 bg-red-50 text-[9px] text-red-600 hover:bg-red-100"><Trash2 className="w-3 h-3" /> Remover</button>
                </div>
              </div>
            )}
            {!sel.length && (
              <div className="text-[9px] text-espresso/30 italic">Selecione um elemento para editar</div>
            )}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative overflow-hidden bg-stone-100"
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={handleCanvasClick}
          style={{ cursor: isPan ? 'grabbing' : tool === 'select' ? 'default' : 'crosshair' }}>

          <div className="absolute inset-0" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
            {/* Grid */}
            {showGrid && (
              <div className="absolute pointer-events-none" style={{ width: canvasW, height: canvasH,
                backgroundImage: `radial-gradient(circle, rgba(0,0,0,0.08) 1px, transparent 1px)`,
                backgroundSize: `${gridSize}px ${gridSize}px` }} />
            )}

            {/* Background Image */}
            {bgImage && (
              <img src={bgImage} alt="Mapa" className="absolute pointer-events-none select-none"
                style={{ left: bgOffset.x, top: bgOffset.y, width: `${bgScale * 100}%`, maxWidth: 1200,
                  opacity: bgOpacity, zIndex: 0 }} draggable={false} />
            )}

            {/* Box selection */}
            {boxSel?.active && (
              <div className="absolute border-2 border-plum/40 bg-plum/5 pointer-events-none" style={{
                left: Math.min(boxSel.x1, boxSel.x2), top: Math.min(boxSel.y1, boxSel.y2),
                width: Math.abs(boxSel.x2 - boxSel.x1), height: Math.abs(boxSel.y2 - boxSel.y1),
                zIndex: 50 }} />
            )}

            {/* Elements */}
            {filteredSeats.map(s => {
              const isS = selected.includes(s.id)
              const statusColor = s.status === 'sold' ? '#dc2626' : s.status === 'reserved' ? '#d97706' : s.status === 'blocked' ? '#78716c' : s.color
              const dim = s.status === 'sold' || s.status === 'blocked' ? 0.5 : 1

              // Size by type
              let w = 32, h = 32
              if (s.type === 'table') { w = 64; h = 44 }
              else if (s.type === 'stage') { w = 192; h = 56 }
              else if (s.type === 'bar') { w = 96; h = 28 }
              else if (s.type === 'door') { w = 48; h = 56 }
              else if (s.type === 'dancefloor') { w = 128; h = 128 }
              else if (s.type === 'area') { w = 144; h = 96 }
              else if (s.type === 'text') { w = 120; h = 28 }
              else if (s.type === 'stairs') { w = 44; h = 56 }
              else if (s.type === 'restroom') { w = 48; h = 36 }
              else if (s.type === 'info') { w = 48; h = 36 }
              else if (s.type === 'service') { w = 56; h = 36 }

              const showLabelInline = s.type === 'table' || s.type === 'stage' || s.type === 'bar' || s.type === 'door' || s.type === 'text' || s.type === 'restroom' || s.type === 'info' || s.type === 'service' || s.type === 'stairs'

              return (
                <div key={s.id}
                  onMouseDown={(e) => handleElementMouseDown(e, s)}
                  onClick={(e) => handleElementClick(e, s)}
                  className={`absolute ${s.locked ? '' : tool === 'select' ? 'hover:brightness-110' : ''} ${isS ? 'z-20' : 'z-10'}`}
                  style={{
                    left: s.x - w / 2, top: s.y - h / 2, width: w, height: h,
                    cursor: tool === 'select' ? (s.locked ? 'not-allowed' : 'pointer') : 'default',
                    opacity: dim,
                    pointerEvents: tool === 'select' ? 'auto' : 'none',
                    transform: `rotate(${s.rotation}deg)`,
                    transformOrigin: 'center center',
                  }}>
                  <div className={`w-full h-full relative ${isS ? 'ring-2 ring-plum/70 rounded-lg' : ''}`}>
                    {/* Shape rendering */}
                    {s.type === 'seat' && (
                      <div className="w-full h-full rounded-lg border-2 flex items-center justify-center shadow-sm"
                        style={{ borderColor: statusColor, background: isS ? `${statusColor}40` : `${statusColor}20` }}>
                        <Armchair className="w-4 h-4" style={{ color: statusColor }} />
                      </div>
                    )}
                    {s.type === 'table' && (
                      <div className="w-full h-full rounded-xl border-2 flex items-center justify-center shadow-sm"
                        style={{ borderColor: statusColor, background: isS ? `${statusColor}40` : `${statusColor}20` }}>
                        <span className="text-[8px] font-semibold" style={{ color: statusColor }}>{s.label}</span>
                      </div>
                    )}
                    {s.type === 'stage' && (
                      <div className="w-full h-full rounded-lg border-2 flex items-center justify-center shadow-md"
                        style={{ borderColor: s.color, background: isS ? `${s.color}50` : `${s.color}30` }}>
                        <Monitor className="w-4 h-4 mr-1" style={{ color: s.color }} />
                        <span className="text-[9px] font-semibold" style={{ color: s.color }}>{s.label}</span>
                      </div>
                    )}
                    {s.type === 'bar' && (
                      <div className="w-full h-full rounded-md border-2 flex items-center justify-center shadow-sm"
                        style={{ borderColor: s.color, background: isS ? `${s.color}40` : `${s.color}20` }}>
                        <Wine className="w-3 h-3 mr-0.5" style={{ color: s.color }} />
                        <span className="text-[8px] font-semibold" style={{ color: s.color }}>{s.label}</span>
                      </div>
                    )}
                    {s.type === 'door' && (
                      <div className="w-full h-full rounded-lg border-2 border-dashed flex flex-col items-center justify-center shadow-sm"
                        style={{ borderColor: '#059669', background: isS ? '#05966930' : '#05966915' }}>
                        <DoorOpen className="w-4 h-4 text-emerald-600" />
                        <span className="text-[7px] text-emerald-600 font-medium">{s.label}</span>
                      </div>
                    )}
                    {s.type === 'text' && (
                      <div className="w-full h-full px-2 rounded-md bg-white/90 border border-white/80 shadow-sm flex items-center justify-center">
                        <span className="text-[10px] font-semibold text-espresso truncate">{s.label}</span>
                      </div>
                    )}
                    {s.type === 'dancefloor' && (
                      <div className="w-full h-full rounded-2xl border-2 border-dashed flex items-center justify-center shadow-sm"
                        style={{ borderColor: s.color, background: isS ? `${s.color}30` : `${s.color}12` }}>
                        <div className="text-center">
                          <CircleIcon className="w-7 h-7 mx-auto mb-0.5" style={{ color: s.color }} />
                          <span className="text-[8px] font-medium" style={{ color: s.color }}>{s.label}</span>
                        </div>
                      </div>
                    )}
                    {s.type === 'area' && (
                      <div className="w-full h-full rounded-xl border-2 flex items-center justify-center shadow-sm"
                        style={{ borderColor: s.color, background: isS ? `${s.color}25` : `${s.color}10` }}>
                        <span className="text-[9px] font-semibold" style={{ color: s.color }}>{s.label}</span>
                      </div>
                    )}
                    {s.type === 'stairs' && (
                      <div className="w-full h-full rounded-lg border-2 flex flex-col items-center justify-center shadow-sm"
                        style={{ borderColor: '#f97316', background: isS ? '#f9731630' : '#f9731615' }}>
                        <ArrowUpDown className="w-4 h-4 text-orange-500" />
                        <span className="text-[7px] text-orange-600 font-medium">{s.label}</span>
                      </div>
                    )}
                    {s.type === 'restroom' && (
                      <div className="w-full h-full rounded-lg border-2 flex flex-col items-center justify-center shadow-sm"
                        style={{ borderColor: '#0891b2', background: isS ? '#0891b230' : '#0891b215' }}>
                        <SquareMenu className="w-4 h-4 text-cyan-600" />
                        <span className="text-[7px] text-cyan-600 font-medium">{s.label}</span>
                      </div>
                    )}
                    {s.type === 'info' && (
                      <div className="w-full h-full rounded-lg border-2 flex flex-col items-center justify-center shadow-sm"
                        style={{ borderColor: '#1d4ed8', background: isS ? '#1d4ed830' : '#1d4ed815' }}>
                        <CircleHelp className="w-4 h-4 text-blue-600" />
                        <span className="text-[7px] text-blue-600 font-medium">{s.label}</span>
                      </div>
                    )}
                    {s.type === 'service' && (
                      <div className="w-full h-full rounded-lg border-2 flex flex-col items-center justify-center shadow-sm"
                        style={{ borderColor: '#059669', background: isS ? '#05966930' : '#05966915' }}>
                        <ConciergeBell className="w-4 h-4 text-emerald-600" />
                        <span className="text-[7px] text-emerald-600 font-medium">{s.label}</span>
                      </div>
                    )}

                    {/* Hover label */}
                    {showLabels && !showLabelInline && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-1 py-0.5 bg-void text-cream text-[7px] rounded-full whitespace-nowrap pointer-events-none">
                        {s.label}
                      </div>
                    )}
                    {/* Price badge */}
                    {isS && (
                      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-white border border-white/60 text-espresso text-[7px] rounded-full whitespace-nowrap pointer-events-none shadow-sm">
                        R$ {s.price}
                      </div>
                    )}
                    {/* Lock badge */}
                    {s.locked && (
                      <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center shadow-sm z-10">
                        <Lock className="w-2 h-2 text-white" />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Help */}
          {showHelp && (
            <div className="absolute bottom-3 left-3 right-3 bg-white/80 backdrop-blur-sm border border-white/60 rounded-xl p-3 shadow-lg z-30 max-w-sm">
              <div className="flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-plum flex-shrink-0 mt-0.5" />
                <div className="text-[10px] text-espresso/60 leading-relaxed space-y-0.5">
                  <p><strong>1.</strong> Selecione ferramenta &rarr; clique no canvas para adicionar</p>
                  <p><strong>2.</strong> Modo Select: clique para selecionar, arraste para mover</p>
                  <p><strong>3.</strong> Ctrl+clique: multi-selecionar &nbsp;|&nbsp; Ctrl+A: selecionar tudo</p>
                  <p><strong>4.</strong> Clique em area vazia + arraste: selecao em caixa</p>
                  <p><strong>5.</strong> Shift+arraste: mover tela &nbsp;|&nbsp; Del: remover &nbsp;|&nbsp; D: duplicar</p>
                </div>
                <button onClick={() => setShowHelp(false)} className="p-0.5 rounded hover:bg-white/60 text-espresso/30"><X className="w-3 h-3" /></button>
              </div>
            </div>
          )}

          {/* Active tool badge */}
          <div className="absolute top-3 right-3 px-2 py-1 bg-white/60 border border-white/60 rounded-lg text-[10px] text-espresso/50 flex items-center gap-1 z-20">
            {(() => { const Icon = toolIcon(tool); return <Icon className="w-3 h-3" /> })()}
            <span>{typeLabels[tool]}</span>
            <ChevronDown className="w-2.5 h-2.5" />
          </div>

          {/* Minimap - functional */}
          {showMinimap && (
            <div className="absolute bottom-3 right-3 w-48 h-36 bg-white/90 border border-white/80 rounded-xl shadow-lg z-20 overflow-hidden"
              onClick={minimapNavigate}>
              <div className="absolute top-1 left-1 text-[7px] text-espresso/40 bg-white/80 px-1.5 py-0.5 rounded pointer-events-none z-10 font-medium">Mini-mapa (clique para navegar)</div>
              {/* Elements dots */}
              <div className="absolute inset-0">
                {seats.map(s => (
                  <div key={`mini-${s.id}`} className="absolute rounded-full pointer-events-none"
                    style={{
                      left: `${(s.x / canvasW) * 100}%`, top: `${(s.y / canvasH) * 100}%`,
                      width: s.type === 'seat' ? 3 : 5, height: s.type === 'seat' ? 3 : 5,
                      background: s.color, transform: 'translate(-50%, -50%)', opacity: 0.7,
                    }} />
                ))}
              </div>
              {/* Viewport rect */}
              <div className="absolute border-2 border-plum/60 bg-plum/5 rounded pointer-events-none"
                style={{
                  left: `${((-pan.x) / (canvasW * zoom)) * 100}%`,
                  top: `${((-pan.y) / (canvasH * zoom)) * 100}%`,
                  width: `${(viewW / (canvasW * zoom)) * 100}%`,
                  height: `${(viewH / (canvasH * zoom)) * 100}%`,
                  minWidth: 8, minHeight: 8,
                }} />
            </div>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 px-4 py-1.5 border-t border-white/60 bg-white/40 backdrop-blur-sm flex-shrink-0 z-20 text-[10px] text-espresso/50">
        <span className="flex items-center gap-1"><Armchair className="w-3 h-3" /> <strong>{totalSeats}</strong> cadeiras</span>
        <span className="flex items-center gap-1"><Square className="w-3 h-3" /> <strong>{totalTables}</strong> mesas</span>
        <span className="flex items-center gap-1"><Check className="w-3 h-3 text-green-600" /> <strong>{totalSold}/{totalCap}</strong> vendidos</span>
        <span className="flex items-center gap-1"><Info className="w-3 h-3 text-amber-500" /> <strong>{reservedCount}</strong> reserv.</span>
        <span className="flex items-center gap-1"><Lock className="w-3 h-3 text-gray-400" /> <strong>{blockedCount}</strong> bloq.</span>
        <span className="ml-auto font-medium text-plum">R$ {revenue.toLocaleString()} / R$ {potential.toLocaleString()}</span>
      </div>
    </div>
  )
}
