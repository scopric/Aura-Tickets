import { useState, useRef, useEffect, useCallback, useMemo, type MouseEvent as ReactMouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useProducerEvents } from '../../hooks/useEvents'
import { useEventoDaUrl } from '../../hooks/useEventoDaUrl'
import { reduzirPlanta, pdfParaImagem } from '../../lib/plantaFundo'
import * as I from '@/components/icones/evokaa16'
import { chamarEvo, RECUSAS, creditos } from '../../components/evo/EvoChat'
import { alternarTipo, contarPorTipo, nosDaProposta, pecasValidas, LARGURA_BASE_PX, type PecaProposta } from '../../lib/plantaIA'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

// Tipos de ferramentas do editor
type ToolType = 
  | 'select' | 'pan' | 'seat' | 'table' | 'stage' | 'bar' | 'door' | 'text' | 'dancefloor' | 'area' | 'stairs' 
  | 'restroom' | 'info' | 'service' | 'wall' | 'ledscreen' | 'truss' | 'generator' | 'soundhouse' 
  | 'barricade' | 'bistro' | 'couch' | 'tent' | 'stand' | 'chemical_toilet' | 'accessible_toilet' | 'emergency_exit'
  | 'buffet_table' | 'dressing_room' | 'portico' | 'dj_deck' | 'unifila_barrier'
  | 'vip_lounge' | 'l_bar' | 'u_bar' | 'food_court' | 'ticket_office' | 'parking_spot' | 'foh_desk'
  | 'backdrop' | 'round_buffet' | 'cloakroom' | 'extinguisher' | 'runway_stage' | 'container_toilet' | 'large_tent'

type SeatStatus = 'free' | 'sold' | 'blocked' | 'reserved'

interface SeatNode {
  id: string
  x: number // em metros (posição do centro)
  y: number // em metros (posição do centro)
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
  widthMeter?: number  // Largura real em metros
  heightMeter?: number // Altura real em metros
  tableShape?: 'circle' | 'rectangle' | 'square' // Formato para mesas (redonda, retangular, quadrada)
  seatsCount?: number // Quantidade de cadeiras na mesa ou sofá
}

interface WallNode {
  id: string
  x1: number // ponto inicial em metros
  y1: number // ponto inicial em metros
  x2: number // ponto final em metros
  y2: number // ponto final em metros
  thickness: number // espessura em metros (ex: 0.15 ou 0.25)
  color: string
  locked: boolean
}

interface Section {
  id: string
  name: string
  color: string
  price: number
  ticketTypeId?: string // ticket_types.id do ingresso que este setor vende (sem ele, o setor não vende)
}

interface Environment {
  id: string
  name: string
  seats: SeatNode[]
  sections: Section[]
  walls?: WallNode[] // Opcional para manter retrocompatibilidade
  pixelsPerMeter?: number // Escala do ambiente
  roomShape?: 'rectangle' | 'l_shape'
  roomWidth?: number  // em metros
  roomHeight?: number // em metros
  roomLWidth?: number  // largura perna L
  roomLHeight?: number // altura perna L
  roomRotation?: number // rotação global do pavilhão
}

// ponytail: custo padrão da leitura (ai_settings.credit_cost.imagem); o produtor não lê as configurações do Evo.
// Se a administração mudar o valor, este texto fica desatualizado até uma leitura recusada ou concluída mostrar o real.
const CUSTO_LEITURA = 5
const ESCALA_PADRAO = 40 // pixelsPerMeter de um pavimento novo; 40 = escala ainda não calibrada
const MAX_ARQUIVO_BYTES = 15 * 1024 * 1024 // planta enviada pelo produtor (imagem ou PDF); a que vai ao Evo já sai reduzida

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
  select: 'Selecionar', pan: 'Mão (Pan)', seat: 'Cadeira', table: 'Mesa Inteligente', stage: 'Palco', bar: 'Bar',
  door: 'Entrada', text: 'Texto', dancefloor: 'Pista Dança', area: 'Área Livre',
  stairs: 'Escada', restroom: 'Banheiro', info: 'Informação', service: 'Atendimento',
  wall: 'Muro / Parede', ledscreen: 'Painel LED', truss: 'Treliça', generator: 'Gerador',
  soundhouse: 'House Mix', barricade: 'Barricada', bistro: 'Bistrô', couch: 'Sofá Lounge',
  tent: 'Tenda/Gazebo', stand: 'Stand Exp.', chemical_toilet: 'WC Químico',
  accessible_toilet: 'WC PNE', emergency_exit: 'Saída Emerg.',
  buffet_table: 'Mesa Buffet', dressing_room: 'Camarim / Backstage', portico: 'Pórtico Entrada',
  dj_deck: 'Praticável DJ', unifila_barrier: 'Grade Unifila',
  vip_lounge: 'Lounge VIP', l_bar: 'Bar em L', u_bar: 'Bar em U', food_court: 'Praça Alimentação',
  ticket_office: 'Bilheteria / Portaria', parking_spot: 'Vaga Estacionam.', foh_desk: 'Mesa de Som (FOH)',
  backdrop: 'Backdrop (Fotos)', round_buffet: 'Mesa Buffet Red.', cloakroom: 'Guarda-volumes',
  extinguisher: 'Extintor Incêndio', runway_stage: 'Passarela Desfile', container_toilet: 'WC Container',
  large_tent: 'Tenda Pirâmide Gde.'
}

let _nextId = Date.now()
const genId = () => `e${_nextId++}`
const snapVal = (v: number, g: number) => Math.round(v / g) * g

function toolIcon(t: ToolType) {
  switch (t) {
    case 'select': return I.Cursor
    case 'pan': return I.Mao
    case 'seat': return I.Lugar
    case 'table': return I.Quadrado
    case 'stage': return I.Tela
    case 'bar': return I.Cardapio
    case 'door': return I.Porta
    case 'text': return I.Texto
    case 'dancefloor': return I.Circulo
    case 'area': return I.Camadas
    case 'stairs': return I.Ordenar
    case 'restroom': return I.Sanitario
    case 'info': return I.Ajuda
    case 'service': return I.SinoRecepcao
    case 'wall': return I.Grade
    case 'ledscreen': return I.Tela
    case 'truss': return I.Grade
    case 'generator': return ZapIcon
    case 'soundhouse': return AudioIcon
    case 'barricade': return BarricadeIcon
    case 'bistro': return BistroIcon
    case 'couch': return SofaIcon
    case 'tent': return TentIcon
    case 'stand': return StandIcon
    case 'chemical_toilet': return WcIcon
    case 'accessible_toilet': return WheelchairIcon
    case 'emergency_exit': return ExitIcon
    case 'buffet_table': return BuffetIcon
    case 'dressing_room': return DressingRoomIcon
    case 'portico': return PorticoIcon
    case 'dj_deck': return DjDeckIcon
    case 'unifila_barrier': return UnifilaIcon
    case 'vip_lounge': return VipLoungeIcon
    case 'l_bar': return LBarIcon
    case 'u_bar': return UBarIcon
    case 'food_court': return FoodCourtIcon
    case 'ticket_office': return TicketOfficeIcon
    case 'parking_spot': return ParkingSpotIcon
    case 'foh_desk': return FohDeskIcon
    case 'backdrop': return BackdropIcon
    case 'round_buffet': return RoundBuffetIcon
    case 'cloakroom': return CloakroomIcon
    case 'extinguisher': return ExtinguisherIcon
    case 'runway_stage': return RunwayStageIcon
    case 'container_toilet': return ContainerToiletIcon
    case 'large_tent': return LargeTentIcon
  }
}

function VipLoungeIcon(props: any) {
  return <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
}
function LBarIcon(props: any) {
  return <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M6 4v10a4 4 0 0 0 4 4h8"/></svg>
}
function UBarIcon(props: any) {
  return <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M6 4v10a6 6 0 0 0 12 0V4"/></svg>
}
function FoodCourtIcon(props: any) {
  return <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 2v4M10 2v4M14 2v4"/></svg>
}
function TicketOfficeIcon(props: any) {
  return <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="4" y="4" width="16" height="16" rx="2"/><line x1="4" y1="10" x2="20" y2="10"/><line x1="10" y1="10" x2="10" y2="20"/></svg>
}
function ParkingSpotIcon(props: any) {
  return <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/></svg>
}
function FohDeskIcon(props: any) {
  return <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="6" y1="8" x2="6" y2="16"/><line x1="12" y1="6" x2="12" y2="18"/><line x1="18" y1="8" x2="18" y2="16"/></svg>
}
function BackdropIcon(props: any) {
  return <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M20.5 7h-1.5"/></svg>
}
function RoundBuffetIcon(props: any) {
  return <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><circle cx="8" cy="8" r="1"/><circle cx="16" cy="8" r="1"/><circle cx="8" cy="16" r="1"/><circle cx="16" cy="16" r="1"/></svg>
}
function CloakroomIcon(props: any) {
  return <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12 22V8a3 3 0 0 1 3-3h2M12 8a3 3 0 0 0-3-3H7"/><circle cx="12" cy="3" r="1"/></svg>
}
function ExtinguisherIcon(props: any) {
  return <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="6" y="8" width="12" height="13" rx="2"/><path d="M12 8V4m0 0a2 2 0 0 1 2-2M12 4a2 2 0 0 0-2-2m2 4h4m-4 5h4"/></svg>
}
function RunwayStageIcon(props: any) {
  return <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M10 2h4v14h-4zM2 16h20v6H2z"/></svg>
}
function ContainerToiletIcon(props: any) {
  return <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="8" y1="4" x2="8" y2="20"/><line x1="16" y1="4" x2="16" y2="20"/></svg>
}
function LargeTentIcon(props: any) {
  return <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12 2 2 12h20zM2 12v8h20v-8M12 2v18M6 12v8M18 12v8"/></svg>
}

function ZapIcon(props: any) {
  return <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
}
function AudioIcon(props: any) {
  return <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><circle cx="12" cy="14" r="4"/><line x1="12" y1="6" x2="12.01" y2="6"/></svg>
}
function BarricadeIcon(props: any) {
  return <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="3" y="11" width="18" height="6" rx="1"/><line x1="6" y1="6" x2="6" y2="11"/><line x1="18" y1="6" x2="18" y2="11"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
}
function BistroIcon(props: any) {
  return <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="6" r="4"/><line x1="12" y1="10" x2="12" y2="21"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
}
function SofaIcon(props: any) {
  return <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"/><path d="M2 11v5a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><path d="M4 18v2"/><path d="M20 18v2"/><path d="M12 9v9"/></svg>
}
function TentIcon(props: any) {
  return <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m12 2-10 16h20z"/><path d="m12 2v16"/><path d="M9 14h6"/></svg>
}
function StandIcon(props: any) {
  return <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M3 3h18v18H3z"/><path d="M9 3v18"/><path d="M3 9h18"/></svg>
}
function WcIcon(props: any) {
  return <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M14 18V5c0-1.1-.9-2-2-2s-2 .9-2 2v13"/><path d="M10 9H8V7h2V5c0-2.2 1.8-4 4-4s4 1.8 4 4v2h2v2h-2"/><circle cx="12" cy="21" r="1"/></svg>
}
function WheelchairIcon(props: any) {
  return <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="4" r="1.5"/><path d="M8.5 7.5c0-.8.7-1.5 1.5-1.5h1.5a1.5 1.5 0 0 1 1.5 1.5V12h3"/><path d="M11 16.5a4 4 0 1 1-4-4"/></svg>
}
function ExitIcon(props: any) {
  return <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
}
function BuffetIcon(props: any) {
  return <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><circle cx="6" cy="15" r="1.5"/><circle cx="12" cy="15" r="1.5"/><circle cx="18" cy="15" r="1.5"/></svg>
}
function DressingRoomIcon(props: any) {
  return <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
}
function PorticoIcon(props: any) {
  return <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M3 22V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v16"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="7" y1="4" x2="7" y2="9"/><line x1="17" y1="4" x2="17" y2="9"/></svg>
}
function DjDeckIcon(props: any) {
  return <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="7" cy="12" r="3"/><circle cx="17" cy="12" r="3"/><path d="M7 12h10"/></svg>
}
function UnifilaIcon(props: any) {
  return <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="6" cy="12" r="3"/><circle cx="18" cy="12" r="3"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="6" y1="15" x2="6" y2="21"/><line x1="18" y1="15" x2="18" y2="21"/></svg>
}

// Configurações padrão dos elementos em metros
const toolDefaults: Record<ToolType, { wMeter: number; hMeter: number; cap: number; color: string }> = {
  select: { wMeter: 0, hMeter: 0, cap: 0, color: '' },
  pan: { wMeter: 0, hMeter: 0, cap: 0, color: '' },
  seat: { wMeter: 0.5, hMeter: 0.5, cap: 1, color: '#7a3b69' },
  table: { wMeter: 1.8, hMeter: 1.2, cap: 6, color: '#7a3b69' },
  stage: { wMeter: 8.0, hMeter: 4.0, cap: 0, color: '#444444' },
  bar: { wMeter: 3.5, hMeter: 1.2, cap: 0, color: '#7c3aed' },
  door: { wMeter: 1.8, hMeter: 0.3, cap: 0, color: '#059669' },
  text: { wMeter: 3.0, hMeter: 0.8, cap: 0, color: '#1e293b' },
  dancefloor: { wMeter: 6.0, hMeter: 6.0, cap: 0, color: '#d97706' },
  area: { wMeter: 8.0, hMeter: 8.0, cap: 0, color: '#78716c' },
  stairs: { wMeter: 1.5, hMeter: 2.5, cap: 0, color: '#ea580c' },
  restroom: { wMeter: 2.5, hMeter: 2.0, cap: 0, color: '#0891b2' },
  info: { wMeter: 1.5, hMeter: 1.2, cap: 0, color: '#2563eb' },
  service: { wMeter: 2.0, hMeter: 1.2, cap: 0, color: '#0d9488' },
  
  wall: { wMeter: 0, hMeter: 0, cap: 0, color: '#4b5563' },
  ledscreen: { wMeter: 5.0, hMeter: 0.3, cap: 0, color: '#10b981' },
  truss: { wMeter: 3.0, hMeter: 0.3, cap: 0, color: '#6b7280' },
  generator: { wMeter: 2.2, hMeter: 1.5, cap: 0, color: '#ca8a04' },
  soundhouse: { wMeter: 3.0, hMeter: 2.0, cap: 0, color: '#4f46e5' },
  barricade: { wMeter: 1.5, hMeter: 0.2, cap: 0, color: '#4b5563' },
  bistro: { wMeter: 0.8, hMeter: 0.8, cap: 0, color: '#8b5cf6' },
  couch: { wMeter: 1.8, hMeter: 0.8, cap: 0, color: '#db2777' },
  tent: { wMeter: 4.0, hMeter: 4.0, cap: 0, color: '#6d28d9' },
  stand: { wMeter: 3.0, hMeter: 3.0, cap: 0, color: '#0284c7' },
  chemical_toilet: { wMeter: 1.1, hMeter: 1.1, cap: 0, color: '#0891b2' },
  accessible_toilet: { wMeter: 1.8, hMeter: 1.8, cap: 0, color: '#0891b2' },
  emergency_exit: { wMeter: 1.8, hMeter: 0.3, cap: 0, color: '#dc2626' },
  
  buffet_table: { wMeter: 3.0, hMeter: 1.0, cap: 0, color: '#d97706' },
  dressing_room: { wMeter: 4.0, hMeter: 3.0, cap: 0, color: '#db2777' },
  portico: { wMeter: 4.0, hMeter: 0.8, cap: 0, color: '#0f766e' },
  dj_deck: { wMeter: 2.5, hMeter: 1.8, cap: 0, color: '#4f46e5' },
  unifila_barrier: { wMeter: 2.0, hMeter: 0.15, cap: 0, color: '#78716c' },

  vip_lounge: { wMeter: 6.0, hMeter: 4.0, cap: 15, color: '#be185d' },
  l_bar: { wMeter: 4.0, hMeter: 4.0, cap: 0, color: '#7c3aed' },
  u_bar: { wMeter: 5.0, hMeter: 4.0, cap: 0, color: '#7c3aed' },
  food_court: { wMeter: 12.0, hMeter: 8.0, cap: 40, color: '#ea580c' },
  ticket_office: { wMeter: 3.0, hMeter: 2.0, cap: 0, color: '#0284c7' },
  parking_spot: { wMeter: 2.5, hMeter: 5.0, cap: 0, color: '#64748b' },
  foh_desk: { wMeter: 3.0, hMeter: 1.8, cap: 0, color: '#4f46e5' },
  backdrop: { wMeter: 3.0, hMeter: 0.5, cap: 0, color: '#ec4899' },
  round_buffet: { wMeter: 2.4, hMeter: 2.4, cap: 0, color: '#d97706' },
  cloakroom: { wMeter: 3.0, hMeter: 1.5, cap: 0, color: '#4b5563' },
  extinguisher: { wMeter: 0.4, hMeter: 0.4, cap: 0, color: '#ef4444' },
  runway_stage: { wMeter: 2.0, hMeter: 8.0, cap: 0, color: '#444444' },
  container_toilet: { wMeter: 6.0, hMeter: 2.4, cap: 0, color: '#0891b2' },
  large_tent: { wMeter: 10.0, hMeter: 10.0, cap: 0, color: '#6d28d9' }
}

const TOOL_CATEGORIES = [
  { id: 'navigation', name: 'Navegação', tools: ['select', 'pan', 'text'] as ToolType[] },
  { id: 'seating', name: 'Assentos & Mesas', tools: ['seat', 'table', 'buffet_table', 'round_buffet', 'bistro', 'couch', 'vip_lounge'] as ToolType[] },
  { id: 'structures', name: 'Estruturas de Evento', tools: ['stage', 'runway_stage', 'dj_deck', 'ledscreen', 'truss', 'dancefloor', 'barricade', 'unifila_barrier', 'backdrop'] as ToolType[] },
  { id: 'technical', name: 'Área Técnica', tools: ['soundhouse', 'foh_desk', 'generator', 'dressing_room', 'area', 'stairs', 'parking_spot'] as ToolType[] },
  { id: 'service_food', name: 'Alimentação & Tendas', tools: ['bar', 'l_bar', 'u_bar', 'food_court', 'service', 'stand', 'tent', 'large_tent', 'cloakroom', 'info'] as ToolType[] },
  { id: 'facilities', name: 'Paredes & Acessos', tools: ['wall', 'door', 'emergency_exit', 'portico', 'ticket_office', 'chemical_toilet', 'accessible_toilet', 'container_toilet', 'restroom', 'extinguisher'] as ToolType[] }
]

const novosPavimentos = (): Environment[] => [
  {
    id: 'terreo',
    name: 'Térreo (Principal)',
    seats: [],
    sections: JSON.parse(JSON.stringify(defaultSections)),
    walls: [],
    pixelsPerMeter: 40
  },
]

// O que vai para o banco e o que conta como "alterado": pavimentos + planta de fundo (zoom e pan não contam)
const fundoPadrao = { scale: 1.0, offset: { x: 150, y: 100 }, opacity: 0.4 }
const montarFundo = (image: string | null, scale: number, offset: { x: number; y: number }, opacity: number) =>
  image ? { image, scale, offset, opacity } : null
const instantaneo = (envs: Environment[], fundo: ReturnType<typeof montarFundo>) => JSON.stringify({ envs, fundo })

export default function SeatingMap() {
  const { data: eventos = [], isLoading: carregandoEventos, isError: erroEventos, refetch: recarregarEventos } = useProducerEvents()
  const [eventId, trocarEvento] = useEventoDaUrl(eventos.map(e => e.id))
  // Mapa carregado do evento escolhido e salvo por último (para o aviso de alterações não salvas)
  const [pronto, setPronto] = useState(false)
  const [erroMapa, setErroMapa] = useState(false)
  const [salvo, setSalvo] = useState<string | null>(null)

  // Environments (múltiplos espaços)
  const [environments, setEnvironments] = useState<Environment[]>(novosPavimentos)
  const [activeEnv, setActiveEnv] = useState(0)

  // Escala ativa em pixels por metro
  const activeEnvObj = environments[activeEnv] || environments[0]
  const pixelsPerMeter = activeEnvObj.pixelsPerMeter || 40

  const roomShape = activeEnvObj.roomShape || 'rectangle'
  const roomWidth = activeEnvObj.roomWidth || 40
  const roomHeight = activeEnvObj.roomHeight || 40
  const roomLWidth = activeEnvObj.roomLWidth || 20
  const roomLHeight = activeEnvObj.roomLHeight || 20
  const roomRotation = activeEnvObj.roomRotation || 0

  // Zoom / Pan
  const [zoom, setZoom] = useState(1.0)
  const [pan, setPan] = useState({ x: 200, y: 120 })
  const [isPan, setIsPan] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })

  // Toggles e visualização
  const [showHelp, setShowHelp] = useState(true)
  const [snap, setSnap] = useState(true)
  const [gridSize, setGridSize] = useState(0.5) // Snap a cada 0.5 metros
  const [showGrid, setShowGrid] = useState(true)
  const [showLabels, setShowLabels] = useState(true)
  const [search, setSearch] = useState('')
  const [showMinimap, setShowMinimap] = useState(true)

  // Estados para recolher / expandir as barras laterais
  const [sidebarLeftOpen, setSidebarLeftOpen] = useState(true)
  const [sidebarRightOpen, setSidebarRightOpen] = useState(true)

  // Tecla de Espaço Pressionada (para movimentação rápida)
  const [spacePressed, setSpacePressed] = useState(false)

  // Ferramentas & Seleção
  const [tool, setTool] = useState<ToolType>('select')
  const [selected, setSelected] = useState<string[]>([])
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null)
  const [rightSidebarTab, setRightSidebarTab] = useState<'lotes' | 'pavilion'>('pavilion')
  const [activeSec, setActiveSec] = useState(activeEnvObj.sections[0]?.id || 'sec1')
  const [justHandled, setJustHandled] = useState(false)

  // Histórico
  const [history, setHistory] = useState<Record<number, { seats: SeatNode[]; walls: WallNode[] }[]>>({ 0: [{ seats: [], walls: [] }] })
  const [histIdx, setHistIdx] = useState<Record<number, number>>({ 0: 0 })

  // Clipboard
  const [clipboard, setClipboard] = useState<SeatNode[]>([])

  // Arrastar Nós e Seleção
  const [isDraggingNode, setIsDraggingNode] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null)
  const [initialNodesPos, setInitialNodesPos] = useState<{ id: string; x: number; y: number; w: number; h: number }[]>([])
  const [dragLeaderId, setDragLeaderId] = useState<string | null>(null)
  const [boxSel, setBoxSel] = useState<{ active: boolean; x1: number; y1: number; x2: number; y2: number } | null>(null)

  // Redimensionamento interativo no canvas (Resize Handles)
  const [isResizingNode, setIsResizingNode] = useState(false)
  const [resizeStartDims, setResizeStartDims] = useState<{
    wMeter: number
    hMeter: number
    x: number
    y: number
    mouseX: number
    mouseY: number
  } | null>(null)

  // Modal do Gerador de Layout Inteligente
  const [autoLayoutModalOpen, setAutoLayoutModalOpen] = useState(false)
  const [autoLayoutConfig, setAutoLayoutConfig] = useState({
    width: 60,
    height: 40,
    layoutType: 'tables' as 'tables' | 'seats', // 'tables' = banquete, 'seats' = auditório
    rowsCount: 4, // 0 = automático, senão fixa a quantidade de fileiras
    hasCentralAisle: false, // vão livre central para circulação/entrada
    spacingX: 2.0, // espaçamento horizontal livre entre bordas dos objetos (m)
    spacingY: 2.0, // espaçamento vertical livre entre fileiras (m)
    stageWidth: 12,
    stageHeight: 5,
    hasStage: true,
    stagePosition: 'Norte' as 'Norte' | 'Sul' | 'Leste' | 'Oeste',
    tableShape: 'circle' as 'circle' | 'rectangle' | 'square',
    tableWidth: 1.8,
    tableHeight: 1.8,
    tableSeats: 6,
    tableCount: 30,
    seatsCount: 100, // Qtd de cadeiras individuais para o modo auditório
    barsCount: 2,
    wcCount: 4,
    emergencyExits: 2
  })

  // Desenho de Muros
  const [wallStartPoint, setWallStartPoint] = useState<{ x: number; y: number } | null>(null)
  const [mouseCanvasPos, setMouseCanvasPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [wallThickness, setWallThickness] = useState(0.15)
  const [draggingWallNode, setDraggingWallNode] = useState<{ wallId: string; endPoint: 'p1' | 'p2' } | null>(null)

  // Calibração de Escala
  const [calibrating, setCalibrating] = useState(false)
  const [calibrationPoints, setCalibrationPoints] = useState<{ x: number; y: number }[]>([])
  const [calibrationLength, setCalibrationLength] = useState<string>('5.0')
  const [showCalibrationDialog, setShowCalibrationDialog] = useState(false)

  // Imagem de Fundo
  const [bgImage, setBgImage] = useState<string | null>(null)
  const [bgOpacity, setBgOpacity] = useState(0.4)
  const [bgScale, setBgScale] = useState(1.0)
  const [bgOffset, setBgOffset] = useState({ x: 150, y: 100 })
  const [bgDragging, setBgDragging] = useState(false)
  const [bgDragStart, setBgDragStart] = useState({ x: 0, y: 0 })

  // Leitor de planta com IA: a proposta fica aqui até o produtor revisar e aplicar (nada vai ao mapa antes)
  const [aiReaderOpen, setAiReaderOpen] = useState(false)
  const [lendo, setLendo] = useState(false)
  const [proposta, setProposta] = useState<{ imagem: string; pecas: PecaProposta[]; custo?: number; restante?: number } | null>(null)
  const [bgNatural, setBgNatural] = useState<{ w: number; h: number } | null>(null)
  // a proposta é da planta em que foi lida: trocou ou tirou a planta, ela some
  const propostaAtual = proposta && proposta.imagem === bgImage ? proposta : null

  // Auto-abrir a barra lateral direita ao selecionar elementos no canvas
  useEffect(() => {
    if (selected.length > 0 || selectedWallId) {
      setSidebarRightOpen(true)
    }
  }, [selected, selectedWallId])

  const canvasRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeSection = activeEnvObj.sections.find(s => s.id === activeSec) || activeEnvObj.sections[0]
  const seats = activeEnvObj.seats || []
  const walls = activeEnvObj.walls || []
  const sections = activeEnvObj.sections || []

  const centerPavilion = () => {
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const viewW = rect.width
    const viewH = rect.height
    
    if (viewW === 0 || viewH === 0) return

    const pW = roomWidth * pixelsPerMeter
    const pH = roomHeight * pixelsPerMeter
    
    // Zoom ideal com 15% de margem
    const zoomX = (viewW * 0.85) / pW
    const zoomY = (viewH * 0.85) / pH
    const newZoom = Math.min(1.5, Math.max(0.2, Math.min(zoomX, zoomY)))
    
    setZoom(newZoom)
    
    // Pan centralizado (compensando o offset de 10 metros onde o salão físico começa a ser desenhado no canvas)
    const panX = (viewW - pW * newZoom) / 2 - (10 * pixelsPerMeter) * newZoom
    const panY = (viewH - pH * newZoom) / 2 - (10 * pixelsPerMeter) * newZoom
    setPan({ x: panX, y: panY })
  }

  const addElementDirectly = (type: ToolType) => {
    const def = toolDefaults[type]
    const w = def.wMeter || 0.5
    const h = def.hMeter || 0.5
    
    // Inserir o elemento no centro do pavilhão físico (compensando o offset de 10 metros)
    const centerX = 10 + roomWidth / 2
    const centerY = 10 + roomHeight / 2
    
    // Se snap estiver ativo, aplica snap no centro
    const finalX = snap ? snapVal(centerX, gridSize) : centerX
    const finalY = snap ? snapVal(centerY, gridSize) : centerY

    const id = genId()
    const newNode: SeatNode = {
      id,
      x: finalX,
      y: finalY,
      label: `${typeLabels[type]} ${seats.filter(s => s.type === type).length + 1}`,
      type,
      color: activeSection?.color || def.color || '#7a3b69',
      price: activeSection?.price !== undefined ? activeSection.price : 100,
      rotation: 0,
      sold: 0,
      capacity: def.cap || 0,
      sectionId: activeSec,
      status: 'free',
      locked: false,
      widthMeter: w,
      heightMeter: h,
      tableShape: type === 'table' ? 'circle' : undefined,
      seatsCount: type === 'table' ? (def.cap || 6) : undefined
    }

    const nextSeats = [...seats, newNode]
    setSeats(nextSeats)
    pushHistory(nextSeats, walls)
    
    // Seleciona o novo elemento e volta para a ferramenta de seleção para edição imediata
    setSelected([id])
    setSelectedWallId(null)
    setTool('select')
    setIsPan(false)
    toast.success(`${typeLabels[type]} adicionado ao centro do salão!`)
  }

  // Ingressos do evento escolhido para ligar a um setor (coletiva não tem lugar marcado; inativo não vende)
  const [tiposIngresso, setTiposIngresso] = useState<{ id: string; name: string; price: number }[]>([])
  const [tiposCarregados, setTiposCarregados] = useState(false) // falso enquanto carrega e se a leitura falhar
  useEffect(() => {
    setTiposIngresso([])
    setTiposCarregados(false)
    if (!eventId) return
    let cancelado = false
    supabase
      .from('ticket_types')
      .select('id, name, price, type, is_active')
      .eq('event_id', eventId)
      .then(({ data, error }) => {
        if (cancelado) return
        if (error) { toast.error(`Não consegui carregar os ingressos do evento: ${error.message}`); return }
        const tipos = (data || []) as unknown as { id: string; name: string; price: number; type: string; is_active: boolean }[] // ticket_types não está nos tipos gerados
        setTiposCarregados(true)
        setTiposIngresso(tipos.filter(t => t.type !== 'coletiva' && t.is_active).map(({ id, name, price }) => ({ id, name, price })))
      })
    return () => { cancelado = true }
  }, [eventId])

  // Carregar do Supabase: roda ao montar e a cada troca de evento (zera o mapa, o desfazer e a planta antes de ler)
  useEffect(() => {
    let cancelado = false
    const iniciais = novosPavimentos()
    setPronto(false)
    setErroMapa(false)
    setSalvo(null)
    setEnvironments(iniciais)
    setActiveEnv(0)
    setActiveSec(iniciais[0].sections[0].id)
    setSelected([])
    setSelectedWallId(null)
    setHistory({ 0: [{ seats: [], walls: [] }] })
    setHistIdx({ 0: 0 })
    setBgImage(null)
    setBgScale(fundoPadrao.scale)
    setBgOffset(fundoPadrao.offset)
    setBgOpacity(fundoPadrao.opacity)
    if (!eventId) return

    const fetchMap = async () => {
      const { data: mapa, error } = await supabase
        .from('seating_maps')
        .select('*')
        .eq('event_id', eventId)
        .maybeSingle()
      const data: any = mapa // a tabela não está nos tipos gerados
      if (cancelado) return

      // Com erro de leitura o mapa não fica pronto: Salvar fica travado para não gravar um mapa vazio por cima do real
      if (error) {
        setErroMapa(true)
        toast.error(`Erro ao carregar mapa: ${error.message}`)
        return
      }

      if (data?.environments && Array.isArray(data.environments)) {
        const loadedEnvs = (data.environments as Environment[]).map(env => ({
          ...env,
          walls: env.walls || [],
          pixelsPerMeter: env.pixelsPerMeter || 40,
          seats: (env.seats || []).map(s => ({
            ...s,
            widthMeter: s.widthMeter || (toolDefaults[s.type]?.wMeter || 0.5),
            heightMeter: s.heightMeter || (toolDefaults[s.type]?.hMeter || 0.5),
            tableShape: s.tableShape || 'circle',
            seatsCount: s.seatsCount || (s.capacity > 0 ? s.capacity : 6)
          }))
        }))

        setEnvironments(loadedEnvs)
        if (loadedEnvs[0]?.sections?.[0]) setActiveSec(loadedEnvs[0].sections[0].id)

        const initialHistory: Record<number, { seats: SeatNode[]; walls: WallNode[] }[]> = {}
        const initialHistIdx: Record<number, number> = {}
        loadedEnvs.forEach((env, index) => {
          initialHistory[index] = [{ seats: env.seats, walls: env.walls || [] }]
          initialHistIdx[index] = 0
        })
        setHistory(initialHistory)
        setHistIdx(initialHistIdx)

        let fundo: ReturnType<typeof montarFundo> = null
        if (data.config && typeof data.config === 'object') {
          const cfg = data.config as any
          if (cfg.zoom) setZoom(cfg.zoom)
          if (cfg.pan) setPan(cfg.pan)
          if (typeof cfg.background?.image === 'string' && cfg.background.image.startsWith('data:image/')) {
            const bg = cfg.background
            fundo = montarFundo(bg.image, bg.scale ?? fundoPadrao.scale, bg.offset ?? fundoPadrao.offset, bg.opacity ?? fundoPadrao.opacity)
            setBgImage(fundo!.image)
            setBgScale(fundo!.scale)
            setBgOffset(fundo!.offset)
            setBgOpacity(fundo!.opacity)
          }
        } else {
          setTimeout(centerPavilion, 200)
        }
        setSalvo(instantaneo(loadedEnvs, fundo))
        toast.success('Mapa de assentos carregado com sucesso!')
      } else {
        // Mapa novo, centraliza no boot
        setSalvo(instantaneo(iniciais, null))
        setTimeout(centerPavilion, 200)
      }
      setPronto(true)
    }

    fetchMap()
    return () => { cancelado = true }
  }, [eventId])

  // só planta enviada pelo produtor (data:image/) conta para o banco e para o "alterado"
  const fundoAtual = bgImage?.startsWith('data:image/') ? montarFundo(bgImage, bgScale, bgOffset, bgOpacity) : null
  // Alterado desde o último mapa carregado ou salvo (JSON do mapa inteiro, recalculado só quando ele muda)
  const sujo = useMemo(
    () => pronto && salvo !== null && instantaneo(environments, fundoAtual) !== salvo,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pronto, salvo, environments, bgImage, bgScale, bgOffset, bgOpacity]
  )

  useEffect(() => {
    if (!sujo) return
    const avisar = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [sujo])

  const confirmarSaida = () => !sujo || window.confirm('Há alterações não salvas neste mapa. Sair mesmo assim?')

  const eventIdRef = useRef(eventId)
  eventIdRef.current = eventId

  const handleSaveMap = async () => {
    if (!eventId || !pronto) {
      toast.error('Escolha um evento e espere o mapa carregar antes de salvar.')
      return
    }

    const fundo = fundoAtual
    const evento = eventId
    const { error } = await supabase
      .from('seating_maps')
      .upsert({
        event_id: eventId,
        name: environments[activeEnv]?.name || 'Principal',
        config: { zoom, pan, background: fundo },
        environments: environments
      }, { onConflict: 'event_id' })

    if (error) {
      toast.error(`Não foi possível salvar o mapa: ${error.message}`, { duration: 6500 })
    } else {
      // Se trocou de evento durante o salvamento, o "salvo" já é de outro mapa: não mexe nele
      if (evento === eventIdRef.current) setSalvo(instantaneo(environments, fundo))
      toast.success('Mapa de assentos salvo!')
    }
  }

  const setSeats = (updater: SeatNode[] | ((prev: SeatNode[]) => SeatNode[])) => {
    setEnvironments(prev => {
      const next = [...prev]
      const currentSeats = next[activeEnv].seats || []
      next[activeEnv] = { 
        ...next[activeEnv], 
        seats: typeof updater === 'function' ? updater(currentSeats) : updater 
      }
      return next
    })
  }

  const setWalls = (updater: WallNode[] | ((prev: WallNode[]) => WallNode[])) => {
    setEnvironments(prev => {
      const next = [...prev]
      const currentWalls = next[activeEnv].walls || []
      next[activeEnv] = { 
        ...next[activeEnv], 
        walls: typeof updater === 'function' ? updater(currentWalls) : updater 
      }
      return next
    })
  }

  const setSections = (updater: Section[] | ((prev: Section[]) => Section[])) => {
    setEnvironments(prev => {
      const next = [...prev]
      next[activeEnv] = { 
        ...next[activeEnv], 
        sections: typeof updater === 'function' ? updater(next[activeEnv].sections) : updater 
      }
      return next
    })
  }

  const updateActiveEnv = (changes: Partial<Environment>) => {
    setEnvironments(prev => {
      const next = [...prev]
      next[activeEnv] = { ...next[activeEnv], ...changes }
      return next
    })
  }

  const pushHistory = useCallback((newSeats: SeatNode[], newWalls: WallNode[]) => {
    setHistory(prev => {
      const envHist = prev[activeEnv] || []
      const envIdx = histIdx[activeEnv] || 0
      const nextHist = envHist.slice(0, envIdx + 1)
      nextHist.push({ seats: newSeats, walls: newWalls })
      if (nextHist.length > 30) nextHist.shift()
      return { ...prev, [activeEnv]: nextHist }
    })
    setHistIdx(prev => ({ 
      ...prev, 
      [activeEnv]: Math.min((prev[activeEnv] || 0) + 1, 29) 
    }))
  }, [activeEnv, histIdx])

  const undo = () => {
    const idx = histIdx[activeEnv] || 0
    if (idx > 0) {
      const envHist = history[activeEnv] || []
      const state = envHist[idx - 1]
      setEnvironments(prev => {
        const next = [...prev]
        next[activeEnv] = { 
          ...next[activeEnv], 
          seats: state.seats,
          walls: state.walls
        }
        return next
      })
      setHistIdx(prev => ({ ...prev, [activeEnv]: idx - 1 }))
      setSelected([])
      setSelectedWallId(null)
      toast.success('Desfeito')
    }
  }

  const redo = () => {
    const idx = histIdx[activeEnv] || 0
    const envHist = history[activeEnv] || []
    if (idx < envHist.length - 1) {
      const state = envHist[idx + 1]
      setEnvironments(prev => {
        const next = [...prev]
        next[activeEnv] = { 
          ...next[activeEnv], 
          seats: state.seats,
          walls: state.walls
        }
        return next
      })
      setHistIdx(prev => ({ ...prev, [activeEnv]: idx + 1 }))
      setSelected([])
      setSelectedWallId(null)
      toast.success('Refeito')
    }
  }

  const getPos = (e: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    const canvasPxX = e.clientX - rect.left - pan.x
    const canvasPxY = e.clientY - rect.top - pan.y
    return { 
      x: canvasPxX / (zoom * pixelsPerMeter), 
      y: canvasPxY / (zoom * pixelsPerMeter) 
    }
  }

  // O evento de scroll/zoom (wheel) é gerenciado nativamente em um useEffect para desabilitar o zoom do navegador.

  const getSnappedWallEndpoint = (x: number, y: number, excludeWallId?: string) => {
    let bestX = x
    let bestY = y
    let minDist = 0.4
    
    walls.forEach(w => {
      if (w.id === excludeWallId) return
      
      const distP1 = Math.hypot(x - w.x1, y - w.y1)
      if (distP1 < minDist) {
        minDist = distP1
        bestX = w.x1
        bestY = w.y1
      }
      
      const distP2 = Math.hypot(x - w.x2, y - w.y2)
      if (distP2 < minDist) {
        minDist = distP2
        bestX = w.x2
        bestY = w.y2
      }
    })
    
    return { x: bestX, y: bestY, snapped: bestX !== x || bestY !== y }
  }

  const addEnvironment = () => {
    const newEnv: Environment = {
      id: genId(),
      name: `Ambiente ${environments.length + 1}`,
      seats: [],
      sections: JSON.parse(JSON.stringify(defaultSections)),
      walls: [],
      pixelsPerMeter: 40
    }
    const nextEnvs = [...environments, newEnv]
    setEnvironments(nextEnvs)
    const newIdx = nextEnvs.length - 1
    setActiveEnv(newIdx)
    setHistory(prev => ({ ...prev, [newIdx]: [{ seats: [], walls: [] }] }))
    setHistIdx(prev => ({ ...prev, [newIdx]: 0 }))
    setSelected([])
    setSelectedWallId(null)
    setPan({ x: 200, y: 120 })
    setZoom(1.0)
    toast.success(`Ambiente "${newEnv.name}" criado!`)
  }

  const removeEnvironment = (idx: number) => {
    if (environments.length <= 1) {
      toast.error('Precisa de pelo menos 1 ambiente.')
      return
    }
    const next = environments.filter((_, i) => i !== idx)
    setEnvironments(next)
    const newIdx = Math.min(activeEnv, next.length - 1)
    setActiveEnv(newIdx)
    setSelected([])
    setSelectedWallId(null)
    toast.success('Ambiente removido.')
  }

  const applyTemplate = (name: string) => {
    const sec = activeSection
    let newSeats: SeatNode[] = []
    let newWalls: WallNode[] = []
    const baseX = 15, baseY = 12

    if (name === 'Teatro') {
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 12; c++) {
          newSeats.push({
            id: genId(), 
            x: baseX + c * 0.8, 
            y: baseY + r * 1.0, 
            label: `${String.fromCharCode(65 + r)}${c + 1}`, 
            type: 'seat', 
            color: sec.color,
            price: sec.price, 
            rotation: 0, 
            sold: 0, 
            capacity: 1, 
            sectionId: activeSec, 
            status: 'free', 
            locked: false,
            widthMeter: 0.5,
            heightMeter: 0.5
          })
        }
      }
      newSeats.push({ 
        id: genId(), 
        x: baseX + 4.4, 
        y: baseY - 3.0, 
        label: 'Palco Principal', 
        type: 'stage', 
        color: '#333333', 
        price: 0, 
        rotation: 0, 
        sold: 0, 
        capacity: 0, 
        sectionId: activeSec, 
        status: 'free', 
        locked: false,
        widthMeter: 10.0,
        heightMeter: 4.0
      })
      newWalls = [
        { id: genId(), x1: baseX - 2, y1: baseY - 5, x2: baseX + 11, y2: baseY - 5, thickness: 0.15, color: '#4b5563', locked: false },
        { id: genId(), x1: baseX + 11, y1: baseY - 5, x2: baseX + 11, y2: baseY + 9, thickness: 0.15, color: '#4b5563', locked: false },
        { id: genId(), x1: baseX + 11, y1: baseY + 9, x2: baseX - 2, y2: baseY + 9, thickness: 0.15, color: '#4b5563', locked: false },
        { id: genId(), x1: baseX - 2, y1: baseY + 9, x2: baseX - 2, y2: baseY - 5, thickness: 0.15, color: '#4b5563', locked: false },
      ]
    } else if (name === 'Jantar VIP') {
      for (let t = 0; t < 4; t++) {
        const tx = baseX + (t % 2) * 6.0 + 2.0
        const ty = baseY + Math.floor(t / 2) * 5.0 + 2.0
        
        newSeats.push({
          id: genId(), 
          x: tx, 
          y: ty, 
          label: `Mesa ${t + 1}`, 
          type: 'table', 
          color: sec.color,
          price: sec.price * 6, 
          rotation: 0, 
          sold: 0, 
          capacity: 6, 
          sectionId: activeSec, 
          status: 'free', 
          locked: false,
          widthMeter: 1.8,
          heightMeter: 1.8,
          tableShape: 'circle',
          seatsCount: 6
        })
      }
    } else if (name === 'Vazio') {
      newSeats = []
      newWalls = []
    }

    const mergedSeats = name === 'Vazio' ? [] : [...seats, ...newSeats]
    const mergedWalls = name === 'Vazio' ? [] : [...walls, ...newWalls]
    
    setSeats(mergedSeats)
    setWalls(mergedWalls)
    pushHistory(mergedSeats, mergedWalls)
    toast.success(`Template "${name}" aplicado!`)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    // Permite Pan clicando com scroll (1), botão direito (2), se a barra de espaço estiver pressionada ou se a ferramenta ativa for Pan
    if (e.button === 1 || e.button === 2 || spacePressed || (e.button === 0 && e.shiftKey) || tool === 'pan') {
      setIsPan(true)
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
      return
    }

    const { x, y } = getPos(e)

    if (calibrating) {
      if (calibrationPoints.length === 0) {
        setCalibrationPoints([{ x, y }])
        toast.info('Clique no segundo ponto do mapa para definir a distância.')
      } else if (calibrationPoints.length === 1) {
        setCalibrationPoints([...calibrationPoints, { x, y }])
        setCalibrating(false)
        setShowCalibrationDialog(true)
      }
      return
    }

    if (tool === 'wall' && e.button === 0) {
      const snapResult = getSnappedWallEndpoint(x, y)
      const finalX = snap ? snapVal(snapResult.x, gridSize) : snapResult.x
      const finalY = snap ? snapVal(snapResult.y, gridSize) : snapResult.y

      if (!wallStartPoint) {
        setWallStartPoint({ x: finalX, y: finalY })
        toast.info('Pressione ESC ou clique com botão direito para encerrar o muro.')
      } else {
        let endX = finalX
        let endY = finalY
        
        if (e.shiftKey) {
          const dx = Math.abs(finalX - wallStartPoint.x)
          const dy = Math.abs(finalY - wallStartPoint.y)
          if (dx > dy) {
            endY = wallStartPoint.y
          } else {
            endX = wallStartPoint.x
          }
        }

        const newWall: WallNode = {
          id: genId(),
          x1: wallStartPoint.x,
          y1: wallStartPoint.y,
          x2: endX,
          y2: endY,
          thickness: wallThickness,
          color: '#4b5563',
          locked: false
        }
        
        const nextWalls = [...walls, newWall]
        setWalls(nextWalls)
        pushHistory(seats, nextWalls)
        setWallStartPoint({ x: endX, y: endY })
      }
      return
    }

    if ((tool === 'select' || tool === 'pan') && e.button === 0) {
      setSelectedWallId(null)
      setBoxSel({ active: true, x1: x, y1: y, x2: x, y2: y })
      if (!e.ctrlKey && !e.metaKey) {
        setSelected([])
      }
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    const { x, y } = getPos(e)
    setMouseCanvasPos({ x, y })

    if (isPan) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y })
      return
    }

    // Redimensionamento interativo de objeto selecionado
    if (isResizingNode && selected.length === 1 && resizeStartDims) {
      const dx = x - resizeStartDims.mouseX
      const dy = y - resizeStartDims.mouseY
      
      let newW = resizeStartDims.wMeter + dx * 2
      let newH = resizeStartDims.hMeter + dy * 2
      
      newW = Math.max(0.2, newW)
      newH = Math.max(0.2, newH)
      
      if (snap) {
        newW = snapVal(newW, 0.1)
        newH = snapVal(newH, 0.1)
      }
      
      const nextSeats = seats.map(s => s.id === selected[0] ? { 
        ...s, 
        widthMeter: newW, 
        heightMeter: newH 
      } : s)
      setSeats(nextSeats)
      return
    }

    if (draggingWallNode) {
      const snapResult = getSnappedWallEndpoint(x, y, draggingWallNode.wallId)
      const finalX = snap ? snapVal(snapResult.x, gridSize) : snapResult.x
      const finalY = snap ? snapVal(snapResult.y, gridSize) : snapResult.y
      
      const nextWalls = walls.map(w => {
        if (w.id === draggingWallNode.wallId) {
          if (draggingWallNode.endPoint === 'p1') {
            return { ...w, x1: finalX, y1: finalY }
          } else {
            return { ...w, x2: finalX, y2: finalY }
          }
        }
        return w
      })
      setWalls(nextWalls)
      return
    }

    // Arraste de múltiplos objetos selecionados
    if (isDraggingNode && dragStartPos && initialNodesPos.length > 0) {
      let dx = x - dragStartPos.x
      let dy = y - dragStartPos.y
      
      const leaderInit = initialNodesPos.find(i => i.id === dragLeaderId) || initialNodesPos[0]
      
      if (snap && leaderInit) {
        // Encontra a coordenada final absoluta do líder com snap baseado no Top-Left
        const targetLeaderLeft = leaderInit.x + dx - leaderInit.w / 2
        const targetLeaderTop = leaderInit.y + dy - leaderInit.h / 2
        
        const leaderLeft = snapVal(targetLeaderLeft, gridSize)
        const leaderTop = snapVal(targetLeaderTop, gridSize)
        
        const finalLeaderX = leaderLeft + leaderInit.w / 2
        const finalLeaderY = leaderTop + leaderInit.h / 2
        
        // Define o deslocamento real necessário para alinhar o líder no ponto absoluto
        dx = finalLeaderX - leaderInit.x
        dy = finalLeaderY - leaderInit.y
      }
      
      const nextSeats = seats.map(s => {
        const init = initialNodesPos.find(i => i.id === s.id)
        if (init) {
          return { ...s, x: init.x + dx, y: init.y + dy }
        }
        return s
      })
      setSeats(nextSeats)
      return
    }

    if (boxSel?.active) {
      setBoxSel({ ...boxSel, x2: x, y2: y })
      const minX = Math.min(boxSel.x1, x), maxX = Math.max(boxSel.x1, x)
      const minY = Math.min(boxSel.y1, y), maxY = Math.max(boxSel.y1, y)
      const inside = seats.filter(s => s.x >= minX && s.x <= maxX && s.y >= minY && s.y <= maxY).map(s => s.id)
      setSelected(inside)
      return
    }

    if (bgDragging) {
      setBgOffset({
        x: e.clientX - bgDragStart.x,
        y: e.clientY - bgDragStart.y
      })
    }
  }

  const handleMouseUp = () => {
    if (isDraggingNode) {
      setIsDraggingNode(false)
      setDragLeaderId(null)
      setDragStartPos(null)
      setInitialNodesPos([])
      pushHistory(seats, walls)
    }
    if (isResizingNode) {
      setIsResizingNode(false)
      setResizeStartDims(null)
      pushHistory(seats, walls)
    }
    if (draggingWallNode) {
      setDraggingWallNode(null)
      pushHistory(seats, walls)
    }
    if (boxSel?.active) {
      setBoxSel(null)
    }
    setBgDragging(false)
    setIsPan(false)
    setTimeout(() => setJustHandled(false), 50)
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault() // Impede menu de contexto do navegador para liberar o botão direito para Pan
    if (tool === 'wall') {
      setWallStartPoint(null)
      toast.info('Construção de muro encerrada.')
    }
  }

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (justHandled || isPan || isDraggingNode || isResizingNode || tool === 'select' || tool === 'pan' || tool === 'wall' || calibrating) return

    const { x, y } = getPos(e)
    const def = toolDefaults[tool]
    const w = def.wMeter || 0.5
    const h = def.hMeter || 0.5
    const targetLeft = x - w / 2
    const targetTop = y - h / 2
    const left = snap ? snapVal(targetLeft, gridSize) : targetLeft
    const top = snap ? snapVal(targetTop, gridSize) : targetTop
    const finalX = left + w / 2
    const finalY = top + h / 2

    const count = seats.filter(s => s.type === tool).length
    
    const newNode: SeatNode = {
      id: genId(),
      x: finalX,
      y: finalY,
      type: tool,
      label: tool === 'seat' ? `${count + 1}` : tool === 'table' ? `Mesa ${count + 1}` : typeLabels[tool],
      color: activeSection?.color || def.color,
      price: activeSection?.price || 0,
      rotation: 0,
      sold: 0,
      capacity: tool === 'table' ? 6 : def.cap, // mesas começam com 6 assentos padrão
      sectionId: activeSec,
      status: 'free',
      locked: false,
      widthMeter: def.wMeter,
      heightMeter: def.hMeter,
      tableShape: tool === 'table' ? 'circle' : undefined,
      seatsCount: tool === 'table' ? 6 : tool === 'couch' ? 3 : undefined
    }

    const nextSeats = [...seats, newNode]
    setSeats(nextSeats)
    pushHistory(nextSeats, walls)
    setSelected([newNode.id])
    toast.success(`${typeLabels[tool]} adicionado(a) com tamanho real!`)
  }

  const handleElementClick = (e: React.MouseEvent, node: SeatNode) => {
    e.stopPropagation()
    setJustHandled(true)
    if (tool !== 'select') return
    
    setSelectedWallId(null)
    if (e.ctrlKey || e.metaKey) {
      setSelected(prev => prev.includes(node.id) ? prev.filter(id => id !== node.id) : [...prev, node.id])
    } else {
      setSelected([node.id])
    }
  }

  const handleElementMouseDown = (e: React.MouseEvent, node: SeatNode) => {
    e.stopPropagation()
    setJustHandled(true)
    
    // Se clicar com botão do meio (1), botão direito (2) ou se estiver na ferramenta Pan, faz Pan do canvas
    if (e.button === 1 || e.button === 2 || spacePressed || tool === 'pan') {
      setIsPan(true)
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
      return
    }

    if (tool !== 'select' || node.locked) return
    if (e.button !== 0) return

    setSelectedWallId(null)
    
    let currentSelected = [...selected]
    if (!selected.includes(node.id)) {
      if (e.ctrlKey || e.metaKey) {
        currentSelected = [...selected, node.id]
        setSelected(currentSelected)
      } else {
        currentSelected = [node.id]
        setSelected(currentSelected)
      }
    }

    setIsDraggingNode(true)
    const pos = getPos(e)
    setDragLeaderId(node.id)
    setDragStartPos({ x: pos.x, y: pos.y })
    
    // Salva posições iniciais de todas as estruturas arrastáveis
    const activeNodes = seats.filter(s => currentSelected.includes(s.id) && !s.locked)
    setInitialNodesPos(activeNodes.map(s => ({
      id: s.id,
      x: s.x,
      y: s.y,
      w: s.widthMeter || toolDefaults[s.type]?.wMeter || 0.5,
      h: s.heightMeter || toolDefaults[s.type]?.hMeter || 0.5
    })))
    setDragOffset({ x: pos.x - node.x, y: pos.y - node.y })
  }

  const updateNode = (id: string, changes: Partial<SeatNode>) => {
    const next = seats.map(s => s.id === id ? { ...s, ...changes } : s)
    setSeats(next)
    pushHistory(next, walls)
  }

  const updateMany = (ids: string[], changes: Partial<SeatNode>) => {
    const next = seats.map(s => ids.includes(s.id) ? { ...s, ...changes } : s)
    setSeats(next)
    pushHistory(next, walls)
  }

  const updateWall = (id: string, changes: Partial<WallNode>) => {
    const next = walls.map(w => w.id === id ? { ...w, ...changes } : w)
    setWalls(next)
    pushHistory(seats, next)
  }

  const dupElement = (id: string) => {
    const s = seats.find(x => x.id === id)
    if (!s || s.locked) return
    const n = { 
      ...s, 
      id: genId(), 
      x: s.x + 1.0, 
      y: s.y + 1.0, 
      sold: 0, 
      status: 'free' as SeatStatus 
    }
    const next = [...seats, n]
    setSeats(next)
    pushHistory(next, walls)
    setSelected([n.id])
    toast.success('Elemento duplicado')
  }

  const dupMany = () => {
    const toDup = seats.filter(s => selected.includes(s.id) && !s.locked)
    if (!toDup.length) return
    const newOnes = toDup.map(s => ({ 
      ...s, 
      id: genId(), 
      x: s.x + 1.0, 
      y: s.y + 1.0, 
      sold: 0, 
      status: 'free' as SeatStatus 
    }))
    const next = [...seats, ...newOnes]
    setSeats(next)
    pushHistory(next, walls)
    setSelected(newOnes.map(n => n.id))
    toast.success(`${newOnes.length} elementos duplicados`)
  }

  const delNode = (id: string) => {
    const s = seats.find(x => x.id === id)
    if (s?.locked) { 
      toast.error('Este elemento está travado.')
      return 
    }
    const next = seats.filter(x => x.id !== id)
    setSeats(next)
    pushHistory(next, walls)
    setSelected(prev => prev.filter(i => i !== id))
    toast.success('Elemento removido')
  }

  const delMany = () => {
    const lockedCount = seats.filter(s => selected.includes(s.id) && s.locked).length
    if (lockedCount) { 
      toast.error(`${lockedCount} elementos estão travados - destrave primeiro.`)
      return 
    }
    const next = seats.filter(x => !selected.includes(x.id))
    setSeats(next)
    pushHistory(next, walls)
    setSelected([])
    toast.success(`${selected.length} elementos removidos`)
  }

  const mergeSelectedNodes = () => {
    if (selected.length < 2) return

    const selNodes = seats.filter(s => selected.includes(s.id))
    if (selNodes.length < 2) return

    // Obter limites físicos
    const lefts = selNodes.map(s => s.x - (s.widthMeter || toolDefaults[s.type]?.wMeter || 0.5) / 2)
    const rights = selNodes.map(s => s.x + (s.widthMeter || toolDefaults[s.type]?.wMeter || 0.5) / 2)
    const tops = selNodes.map(s => s.y - (s.heightMeter || toolDefaults[s.type]?.hMeter || 0.5) / 2)
    const bottoms = selNodes.map(s => s.y + (s.heightMeter || toolDefaults[s.type]?.hMeter || 0.5) / 2)

    const minLeft = Math.min(...lefts)
    const maxRight = Math.max(...rights)
    const minTop = Math.min(...tops)
    const maxBottom = Math.max(...bottoms)

    const newW = maxRight - minLeft
    const newH = maxBottom - minTop

    const newX = minLeft + newW / 2
    const newY = minTop + newH / 2

    const prototype = selNodes[0]

    const newNode: SeatNode = {
      id: genId(),
      x: newX,
      y: newY,
      label: `${prototype.label} Unificado`,
      type: prototype.type,
      color: prototype.color,
      price: prototype.price,
      rotation: 0,
      sold: 0,
      capacity: prototype.type === 'table' ? (prototype.capacity || 6) : (prototype.type === 'seat' ? 1 : 0),
      sectionId: prototype.sectionId,
      status: prototype.status,
      locked: false,
      widthMeter: newW,
      heightMeter: newH,
      ...(prototype.tableShape ? { tableShape: prototype.tableShape, seatsCount: prototype.seatsCount } : {})
    }

    const nextSeats = seats.filter(s => !selected.includes(s.id))
    nextSeats.push(newNode)

    setSeats(nextSeats)
    setSelected([newNode.id])
    pushHistory(nextSeats, walls)
    toast.success('Estruturas mescladas com sucesso em uma única peça!')
  }

  const delWall = (id: string) => {
    const w = walls.find(x => x.id === id)
    if (w?.locked) {
      toast.error('Esta parede está travada.')
      return
    }
    const next = walls.filter(x => x.id !== id)
    setWalls(next)
    pushHistory(seats, next)
    setSelectedWallId(null)
    toast.success('Parede removida')
  }

  const copySelected = () => {
    const items = seats.filter(s => selected.includes(s.id))
    setClipboard(items)
    toast.success(`${items.length} elementos copiados`)
  }

  const paste = () => {
    if (!clipboard.length) return
    const newOnes = clipboard.map(s => ({ 
      ...s, 
      id: genId(), 
      x: s.x + 1.5, 
      y: s.y + 1.5, 
      sold: 0, 
      status: 'free' as SeatStatus 
    }))
    const next = [...seats, ...newOnes]
    setSeats(next)
    pushHistory(next, walls)
    setSelected(newOnes.map(n => n.id))
    toast.success(`${newOnes.length} elementos colados`)
  }

  const selectAll = () => {
    const allIds = seats.map(s => s.id)
    setSelected(allIds)
    toast.success(`${allIds.length} elementos selecionados`)
  }

  const align = (dir: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    const selSeats = seats.filter(s => selected.includes(s.id))
    if (selSeats.length < 2) return
    let next = [...seats]
    if (dir === 'left') { 
      const minX = Math.min(...selSeats.map(s => s.x))
      next = next.map(s => selected.includes(s.id) ? { ...s, x: minX } : s) 
    }
    else if (dir === 'right') { 
      const maxX = Math.max(...selSeats.map(s => s.x))
      next = next.map(s => selected.includes(s.id) ? { ...s, x: maxX } : s) 
    }
    else if (dir === 'top') { 
      const minY = Math.min(...selSeats.map(s => s.y))
      next = next.map(s => selected.includes(s.id) ? { ...s, y: minY } : s) 
    }
    else if (dir === 'bottom') { 
      const maxY = Math.max(...selSeats.map(s => s.y))
      next = next.map(s => selected.includes(s.id) ? { ...s, y: maxY } : s) 
    }
    else if (dir === 'center') { 
      const avgX = selSeats.reduce((sum, s) => sum + s.x, 0) / selSeats.length
      next = next.map(s => selected.includes(s.id) ? { ...s, x: avgX } : s) 
    }
    else if (dir === 'middle') { 
      const avgY = selSeats.reduce((sum, s) => sum + s.y, 0) / selSeats.length
      next = next.map(s => selected.includes(s.id) ? { ...s, y: avgY } : s) 
    }
    setSeats(next)
    pushHistory(next, walls)
    toast.success(`Alinhado: ${dir}`)
  }

  // Imagem ou PDF (página 1) → planta de fundo reduzida. Os dois seguem o mesmo caminho (reduzirPlanta).
  const uploadBgImage = async (file: File) => {
    if (file.size > MAX_ARQUIVO_BYTES) {
      toast.error('Esse arquivo passa de 15 MB. Use um arquivo menor.')
      return
    }
    const pdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
    try {
      const resultStr = await reduzirPlanta(pdf ? await pdfParaImagem(file) : file)
      setBgImage(resultStr)
      setBgScale(1.0)
      setBgOffset({ x: 100, y: 80 })
      setBgOpacity(0.4)
      toast.success(pdf ? 'Página 1 do PDF carregada como planta de fundo!' : 'Imagem da planta carregada como fundo!')
    } catch {
      toast.error(pdf ? 'Não consegui abrir esse PDF. Confira se ele não tem senha ou use uma imagem.' : 'Não consegui ler essa imagem. Use PNG, JPG ou WebP.')
    }
  }

  const triggerImageUpload = () => {
    fileInputRef.current?.click()
  }

  // A planta de fundo (já reduzida) vai ao Evo; a proposta volta para revisão e não toca no mapa
  const lerPlantaComIA = async () => {
    if (!eventId || !bgImage || lendo) return
    setLendo(true)
    let r: Awaited<ReturnType<typeof chamarEvo>>
    try {
      r = await chamarEvo({ mode: 'planta', event_id: eventId, imagem: bgImage })
    } catch {
      r = { ok: false, motivo: 'rede' }
    }
    setLendo(false)
    if (!r.ok) {
      toast.error(r.motivo === 'sem_credito' && typeof r.custo === 'number' && typeof r.restante === 'number'
        ? `Esta leitura custa ${creditos(r.custo)} e você tem ${r.restante}.`
        : RECUSAS[r.motivo] ?? r.message ?? RECUSAS.erro_ia)
      return
    }
    const pecas = pecasValidas(r.pecas, t => (toolDefaults[t as ToolType]?.wMeter ?? 0) > 0)
    if (pecas.length === 0) {
      toast.warning('A leitura não reconheceu nenhuma peça nessa planta. Ela foi cobrada; tente uma imagem mais nítida ou monte o mapa à mão.')
      return
    }
    setProposta({ imagem: bgImage, pecas: pecas.map((p, i) => ({ ...p, id: `ia-${i}`, marcada: true })), custo: r.custo, restante: r.restante })
    toast.success(`${pecas.length} peças propostas. Revise por cima da planta antes de aplicar.`)
  }

  // Só as peças marcadas entram, num único passo do desfazer, e ficam selecionadas para mover o bloco
  const aplicarProposta = () => {
    if (!propostaAtual || !bgNatural) return
    const nos = nosDaProposta(propostaAtual.pecas, {
      offset: bgOffset, scale: bgScale, naturalWidth: bgNatural.w, naturalHeight: bgNatural.h, pixelsPerMeter,
    })
    if (nos.length === 0) {
      toast.error('Nenhuma peça marcada. Marque ao menos uma ou cancele.')
      return
    }
    const contagem: Partial<Record<ToolType, number>> = {}
    const novos: SeatNode[] = nos.map(n => {
      const def = toolDefaults[n.tipo]
      contagem[n.tipo] = (contagem[n.tipo] ?? seats.filter(s => s.type === n.tipo).length) + 1
      const quadrada = Math.abs(n.widthMeter - n.heightMeter) <= 0.15 * Math.max(n.widthMeter, n.heightMeter)
      return {
        id: genId(),
        x: n.x,
        y: n.y,
        label: n.rotulo || `${typeLabels[n.tipo]} ${contagem[n.tipo]}`,
        type: n.tipo,
        color: activeSection?.color || def.color || '#7a3b69',
        price: activeSection?.price !== undefined ? activeSection.price : 100,
        rotation: 0,
        sold: 0,
        capacity: def.cap || 0,
        sectionId: activeSec,
        status: 'free',
        locked: false,
        widthMeter: n.widthMeter,
        heightMeter: n.heightMeter,
        tableShape: n.tipo === 'table' ? (quadrada ? 'circle' : 'rectangle') : undefined,
        seatsCount: n.tipo === 'table' ? (def.cap || 6) : undefined,
      }
    })
    const next = [...seats, ...novos]
    setSeats(next)
    pushHistory(next, walls)
    setSelected(novos.map(n => n.id))
    setSelectedWallId(null)
    setTool('select')
    setProposta(null)
    setAiReaderOpen(false)
    toast.success(`${novos.length} peças aplicadas e selecionadas: mova o bloco ou ajuste uma a uma. Ctrl+Z desfaz tudo.`)
  }

  const generateAutoLayout = () => {
    const cfg = autoLayoutConfig
    const width = Math.max(10, cfg.width)
    const height = Math.max(10, cfg.height)
    
    // 1. Criar muros externos nas dimensões reais informadas
    const newWalls: WallNode[] = [
      { id: genId(), x1: 0, y1: 0, x2: width, y2: 0, thickness: 0.25, color: '#4b5563', locked: true },
      { id: genId(), x1: width, y1: 0, x2: width, y2: height, thickness: 0.25, color: '#4b5563', locked: true },
      { id: genId(), x1: width, y1: height, x2: 0, y2: height, thickness: 0.25, color: '#4b5563', locked: true },
      { id: genId(), x1: 0, y1: height, x2: 0, y2: 0, thickness: 0.25, color: '#4b5563', locked: true },
    ]

    const newSeats: SeatNode[] = []
    
    // Definir área útil inicial
    let xMin = 3.0
    let xMax = width - 3.0
    let yMin = 3.0
    let yMax = height - 3.0

    // 2. Adicionar o Palco Principal
    if (cfg.hasStage) {
      const sw = cfg.stageWidth
      const sh = cfg.stageHeight
      let sx = width / 2
      let sy = sh / 2 + 1.0

      if (cfg.stagePosition === 'Norte') {
        sx = width / 2
        sy = sh / 2 + 1.5
        yMin = sh + 4.5 // Recuo de segurança na frente do palco para tráfego
      } else if (cfg.stagePosition === 'Sul') {
        sx = width / 2
        sy = height - sh / 2 - 1.5
        yMax = height - sh - 4.5
      } else if (cfg.stagePosition === 'Leste') {
        sx = width - sw / 2 - 1.5
        sy = height / 2
        xMax = width - sw - 4.5
      } else if (cfg.stagePosition === 'Oeste') {
        sx = sw / 2 + 1.5
        sy = height / 2
        xMin = sw + 4.5
      }

      newSeats.push({
        id: genId(),
        x: sx,
        y: sy,
        label: 'Palco Principal',
        type: 'stage',
        color: '#292524',
        price: 0,
        rotation: cfg.stagePosition === 'Leste' || cfg.stagePosition === 'Oeste' ? 90 : 0,
        sold: 0,
        capacity: 0,
        sectionId: activeSec,
        status: 'free',
        locked: false,
        widthMeter: sw,
        heightMeter: sh
      })
    }

    // 3. Adicionar Saídas de Emergência simétricas
    const exitW = 1.8
    for (let i = 0; i < cfg.emergencyExits; i++) {
      let ex = 0
      let ey = 0
      let rot = 0
      if (i === 0) {
        ex = width / 2
        ey = height
        rot = 0
      } else if (i === 1) {
        ex = 0
        ey = height / 2
        rot = 90
      } else {
        ex = width
        ey = height / 2
        rot = 90
      }
      newSeats.push({
        id: genId(),
        x: ex,
        y: ey,
        label: `Saída Emergência ${i + 1}`,
        type: 'emergency_exit',
        color: '#dc2626',
        price: 0,
        rotation: rot,
        sold: 0,
        capacity: 0,
        sectionId: activeSec,
        status: 'free',
        locked: true,
        widthMeter: exitW,
        heightMeter: 0.3
      })
    }

    // 4. Distribuir Bares de Apoio
    const barW = 3.5, barH = 1.2
    for (let i = 0; i < cfg.barsCount; i++) {
      const bx = i === 0 ? xMin + 2.0 : xMax - 2.0
      const by = cfg.stagePosition === 'Norte' ? yMax - 2.5 : yMin + 2.5
      newSeats.push({
        id: genId(),
        x: bx,
        y: by,
        label: `Bar Apoio ${i + 1}`,
        type: 'bar',
        color: '#7c3aed',
        price: 0,
        rotation: 0,
        sold: 0,
        capacity: 0,
        sectionId: activeSec,
        status: 'free',
        locked: false,
        widthMeter: barW,
        heightMeter: barH
      })
    }

    // 5. Distribuir Banheiros nos cantos traseiros livres
    const wcW = 1.1, wcH = 1.1
    for (let i = 0; i < cfg.wcCount; i++) {
      const isLeftCorner = i < Math.ceil(cfg.wcCount / 2)
      const offsetMultiplier = isLeftCorner ? i : (i - Math.ceil(cfg.wcCount / 2))
      const wx = isLeftCorner ? xMin + offsetMultiplier * 1.4 : xMax - offsetMultiplier * 1.4
      const wy = cfg.stagePosition === 'Norte' ? yMax - 0.7 : yMin + 0.7
      
      newSeats.push({
        id: genId(),
        x: wx,
        y: wy,
        label: i === 0 ? 'WC PNE' : `WC Químico ${i}`,
        type: i === 0 ? 'accessible_toilet' : 'chemical_toilet',
        color: '#0891b2',
        price: 0,
        rotation: cfg.stagePosition === 'Norte' ? 180 : 0,
        sold: 0,
        capacity: 0,
        sectionId: activeSec,
        status: 'free',
        locked: false,
        widthMeter: i === 0 ? 1.8 : wcW,
        heightMeter: i === 0 ? 1.8 : wcH
      })
    }

    // Ajustar área útil descontando os apoios traseiros
    if (cfg.stagePosition === 'Norte') {
      yMax -= 4.0
    } else {
      yMin += 4.0
    }

    const utileW = xMax - xMin
    const utileH = yMax - yMin

    const isSeats = cfg.layoutType === 'seats'
    const objW = isSeats ? 0.5 : cfg.tableWidth
    const objH = isSeats ? 0.5 : (cfg.tableShape === 'rectangle' ? cfg.tableHeight : cfg.tableWidth)

    const stepX = objW + cfg.spacingX
    const stepY = objH + cfg.spacingY

    const totalToPlace = isSeats ? cfg.seatsCount : cfg.tableCount

    // 1. Calcular número de colunas considerando corredor central
    let colCount = 0
    let colsPerBlock = 0
    if (cfg.hasCentralAisle) {
      const blockW = Math.max(0.5, (utileW - 2.5) / 2)
      colsPerBlock = Math.max(1, Math.floor(blockW / stepX))
      colCount = colsPerBlock * 2
    } else {
      colCount = Math.max(1, Math.floor(utileW / stepX))
    }

    // 2. Calcular número de fileiras
    const maxRows = Math.max(1, Math.floor(utileH / stepY))
    const rowCount = cfg.rowsCount > 0 ? cfg.rowsCount : maxRows
    
    const maxCapacity = colCount * rowCount

    if (totalToPlace > maxCapacity) {
      toast.warning(
        `Espaço comporta com segurança até ${maxCapacity} ${isSeats ? 'cadeiras' : 'mesas'} com os espaçamentos definidos. Colocando o limite máximo organizado.`,
        { duration: 6000 }
      )
    }

    const actualPlacedCount = Math.min(totalToPlace, maxCapacity)
    const rowsUsed = Math.max(1, Math.ceil(actualPlacedCount / colCount))

    // 3. Centralização vertical
    const actualGridH = (rowsUsed - 1) * stepY
    const paddingY = (utileH - actualGridH) / 2
    const startY = yMin + paddingY

    // 4. Centralização horizontal e cálculo de tx para cada coluna
    const colXPositions: number[] = []
    if (cfg.hasCentralAisle) {
      const blockW = (utileW - 2.5) / 2
      const actualBlockGridW = (colsPerBlock - 1) * stepX
      const blockPadding = Math.max(0, (blockW - actualBlockGridW) / 2)

      for (let c = 0; c < colCount; c++) {
        if (c < colsPerBlock) {
          // Bloco esquerdo
          const tx = xMin + blockPadding + c * stepX
          colXPositions.push(tx)
        } else {
          // Bloco direito
          const localCol = c - colsPerBlock
          const tx = (xMax - blockW) + blockPadding + localCol * stepX
          colXPositions.push(tx)
        }
      }
    } else {
      const actualGridW = (colCount - 1) * stepX
      const paddingX = Math.max(0, (utileW - actualGridW) / 2)
      for (let c = 0; c < colCount; c++) {
        const tx = xMin + paddingX + c * stepX
        colXPositions.push(tx)
      }
    }

    // Função auxiliar para rótulo de fileiras
    const getRowLabel = (r: number): string => {
      let label = ''
      let temp = r
      while (temp >= 0) {
        label = String.fromCharCode(65 + (temp % 26)) + label
        temp = Math.floor(temp / 26) - 1
      }
      return label
    }

    // 5. Posicionar os objetos
    for (let i = 0; i < actualPlacedCount; i++) {
      const col = i % colCount
      const row = Math.floor(i / colCount)
      const tx = colXPositions[col]
      const ty = startY + row * stepY

      if (isSeats) {
        const rowLabel = getRowLabel(row)
        const seatNum = col + 1
        newSeats.push({
          id: genId(),
          x: tx,
          y: ty,
          label: `${rowLabel}-${seatNum}`,
          type: 'seat',
          color: activeSection?.color || '#7a3b69',
          price: activeSection?.price || 50,
          rotation: 0,
          sold: 0,
          capacity: 1,
          sectionId: activeSec,
          status: 'free',
          locked: false,
          widthMeter: 0.5,
          heightMeter: 0.5
        })
      } else {
        newSeats.push({
          id: genId(),
          x: tx,
          y: ty,
          label: `Mesa ${i + 1}`,
          type: 'table',
          color: activeSection?.color || '#7a3b69',
          price: activeSection?.price || 150,
          rotation: 0,
          sold: 0,
          capacity: cfg.tableSeats,
          sectionId: activeSec,
          status: 'free',
          locked: false,
          widthMeter: cfg.tableWidth,
          heightMeter: cfg.tableShape === 'rectangle' ? cfg.tableHeight : cfg.tableWidth,
          tableShape: cfg.tableShape,
          seatsCount: cfg.tableSeats
        })
      }
    }

    setSeats(newSeats)
    setWalls(newWalls)
    pushHistory(newSeats, newWalls)
    toast.success(`Planta de ${width}x${height}m montada com ${actualPlacedCount} ${isSeats ? 'cadeiras' : 'mesas'} inteligente!`)
    setAutoLayoutModalOpen(false)
  }

  const startScaleCalibration = () => {
    setCalibrating(true)
    setCalibrationPoints([])
    toast.info('Clique no primeiro ponto da sua linha de calibração.')
  }

  const confirmCalibration = () => {
    if (calibrationPoints.length < 2) return
    const lengthM = parseFloat(calibrationLength)
    if (isNaN(lengthM) || lengthM <= 0) {
      toast.error('Medida inválida.')
      return
    }

    const dx = calibrationPoints[1].x - calibrationPoints[0].x
    const dy = calibrationPoints[1].y - calibrationPoints[0].y
    const originalPpm = pixelsPerMeter
    const distPx = Math.hypot(dx, dy) * originalPpm
    const newPpm = Math.round(distPx / lengthM)
    
    setEnvironments(prev => {
      const next = [...prev]
      next[activeEnv] = { ...next[activeEnv], pixelsPerMeter: newPpm }
      return next
    })
    
    toast.success(`Escala redefinida: 1 metro = ${newPpm}px.`)
    setShowCalibrationDialog(false)
    setCalibrationPoints([])
  }

  // Detectar Atalhos de Teclado e Navegação
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar se estiver focando em algum input ou campo de edição
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.code === 'Space') {
        e.preventDefault()
        setSpacePressed(true)
      }
      
      // Deletar elementos selecionados
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selected.length > 0) {
          e.preventDefault()
          delMany()
        } else if (selectedWallId) {
          e.preventDefault()
          delWall(selectedWallId)
        }
      }

      // Atalhos de Ctrl / Cmd
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase()
        if (key === 'c') {
          e.preventDefault()
          copySelected()
        } else if (key === 'v') {
          e.preventDefault()
          paste()
        } else if (key === 'd') {
          e.preventDefault()
          dupMany()
        } else if (key === 'a') {
          e.preventDefault()
          selectAll()
        } else if (key === 'z') {
          e.preventDefault()
          undo()
        } else if (key === 'y') {
          e.preventDefault()
          redo()
        }
      }

      // Setas Direcionais para ajuste fino de posição em metros
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        const step = e.shiftKey ? 0.5 : 0.1
        let dx = 0
        let dy = 0
        if (e.key === 'ArrowLeft') dx = -step
        else if (e.key === 'ArrowRight') dx = step
        else if (e.key === 'ArrowUp') dy = -step
        else if (e.key === 'ArrowDown') dy = step

        if (dx !== 0 || dy !== 0) {
          e.preventDefault()
          const nextSeats = seats.map(s => {
            if (selected.includes(s.id) && !s.locked) {
              return { ...s, x: s.x + dx, y: s.y + dy }
            }
            return s
          })
          setSeats(nextSeats)
          pushHistory(nextSeats, walls)
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [selected, selectedWallId, seats, walls, clipboard, undo, redo, pushHistory])

  // Refs para ler os valores mais recentes de pan e zoom síncronamente no listener nativo de wheel
  const panRef = useRef(pan)
  const zoomRef = useRef(zoom)

  useEffect(() => {
    panRef.current = pan
  }, [pan])

  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  // Listener nativo do evento wheel com passive: false para bloquear zoom global do navegador
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleWheelNative = (e: WheelEvent) => {
      // Impede o scroll e o zoom nativos da janela do navegador
      e.preventDefault()

      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const currentPan = panRef.current
      const currentZoom = zoomRef.current

      // Se a tecla Ctrl/Meta estiver pressionada (ou pinça no trackpad), faz Zoom
      if (e.ctrlKey || e.metaKey) {
        // Coordenada lógica antes do zoom
        const canvasX = (mouseX - currentPan.x) / (currentZoom * pixelsPerMeter)
        const canvasY = (mouseY - currentPan.y) / (currentZoom * pixelsPerMeter)
        
        const zoomFactor = 1.08
        const newZoom = e.deltaY < 0 
          ? Math.min(4.0, currentZoom * zoomFactor) 
          : Math.max(0.15, currentZoom / zoomFactor)
          
        setPan({
          x: mouseX - canvasX * newZoom * pixelsPerMeter,
          y: mouseY - canvasY * newZoom * pixelsPerMeter
        })
        setZoom(newZoom)
      } else {
        // Caso contrário, faz Pan (Scroll) vertical ou horizontal
        const scrollSpeed = 0.8
        if (e.shiftKey) {
          // Shift + Wheel = Pan Horizontal
          setPan(prev => ({ ...prev, x: prev.x - e.deltaY * scrollSpeed }))
        } else {
          // Wheel livre = Pan Vertical (e scroll horizontal do trackpad se houver deltaX)
          setPan(prev => ({
            x: prev.x - (e.deltaX || 0) * scrollSpeed,
            y: prev.y - e.deltaY * scrollSpeed
          }))
        }
      }
    }

    canvas.addEventListener('wheel', handleWheelNative, { passive: false })
    return () => {
      canvas.removeEventListener('wheel', handleWheelNative)
    }
  }, [pixelsPerMeter, eventId]) // eventId: sem evento a tela é a de escolha e o canvas ainda não existe

  // Ocultar a barra de rolagem global do body e html e resetar scroll ao carregar
  useEffect(() => {
    window.scrollTo(0, 0)
    const originalOverflow = document.body.style.overflow
    const originalHeight = document.body.style.height
    const htmlEl = document.documentElement
    const originalHtmlOverflow = htmlEl.style.overflow
    const originalHtmlHeight = htmlEl.style.height

    document.body.style.overflow = 'hidden'
    document.body.style.height = '100vh'
    htmlEl.style.overflow = 'hidden'
    htmlEl.style.height = '100vh'

    return () => {
      document.body.style.overflow = originalOverflow
      document.body.style.height = originalHeight
      htmlEl.style.overflow = originalHtmlOverflow
      htmlEl.style.height = originalHtmlHeight
    }
  }, [])

  const totalSeats = seats.filter(s => s.type === 'seat').length
  const totalTables = seats.filter(s => s.type === 'table').length
  const totalWalls = walls.length
  const totalCap = seats.reduce((s, e) => s + (e.capacity || 0), 0)
  const totalSold = seats.reduce((s, e) => s + (e.sold || 0), 0)
  const revenue = seats.reduce((s, e) => s + e.price * (e.sold || 0), 0)
  const potential = seats.reduce((s, e) => s + e.price * (e.capacity || 0), 0)
  const reservedCount = seats.filter(s => s.status === 'reserved').length
  const blockedCount = seats.filter(s => s.status === 'blocked').length

  const filteredSeats = search
    ? seats.filter(s => s.label.toLowerCase().includes(search.toLowerCase()) || typeLabels[s.type].toLowerCase().includes(search.toLowerCase()))
    : seats

  const canvasW = Math.max(60, roomWidth + 20) * pixelsPerMeter
  const canvasH = Math.max(60, roomHeight + 20) * pixelsPerMeter
  const viewW = canvasRef.current?.clientWidth || 800
  const viewH = canvasRef.current?.clientHeight || 600

  const minimapNavigate = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratioX = (e.clientX - rect.left) / rect.width
    const ratioY = (e.clientY - rect.top) / rect.height
    setPan({
      x: -(ratioX * canvasW * zoom - viewW / 2),
      y: -(ratioY * canvasH * zoom - viewH / 2)
    })
  }

  const exportMap = () => {
    const data = JSON.stringify({ environments, zoom, pan, exportedAt: new Date().toISOString() }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `evokaa-mapa-assentos.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Mapa exportado!')
  }

  const importMap = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result))
        if (data.environments && Array.isArray(data.environments)) {
          const formatted = data.environments.map((env: any) => ({
            ...env,
            walls: env.walls || [],
            pixelsPerMeter: env.pixelsPerMeter || 40,
            seats: (env.seats || []).map((s: any) => ({ ...s, id: s.id || genId() }))
          }))
          setEnvironments(formatted)
          setActiveEnv(0)
          setHistory({ 0: [{ seats: formatted[0]?.seats || [], walls: formatted[0]?.walls || [] }] })
          setHistIdx({ 0: 0 })
          if (data.zoom) setZoom(data.zoom)
          if (data.pan) setPan(data.pan)
          toast.success('Mapa importado com sucesso!')
        }
      } catch { 
        toast.error('Arquivo de mapa inválido.') 
      }
    }
    reader.readAsText(file)
  }

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

  // Sem evento escolhido a tela não edita nada: pede para escolher
  if (!eventId) {
    return (
      <div className="painel-produtor flex h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center text-foreground">
        <h1 className="text-base font-semibold">Editor de mapa</h1>
        <p className="text-sm text-muted-foreground">
          {carregandoEventos ? 'Carregando seus eventos…' : erroEventos ? 'Não consegui carregar seus eventos.' : eventos.length ? 'Escolha o evento cujo mapa você quer editar.' : 'Crie um evento antes de montar o mapa.'}
        </p>
        {erroEventos && <Button size="sm" onClick={() => recarregarEventos()}>Tentar de novo</Button>}
        {eventos.length > 0 && seletorEvento}
        <Link to={voltarPara} className="text-sm text-primary underline">Voltar ao painel</Link>
      </div>
    )
  }

  // Editor em tela cheia (Decisão 112; V8b): tokens nas barras, no cabeçalho e nas janelas; a planta é uma ilha clara (.mapa-claro) nos dois temas.
  const btnIcone = 'inline-flex items-center justify-center rounded-md border border-border bg-card p-2 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-40 disabled:hover:bg-card flex-shrink-0'
  const btnLigado = (on: boolean) => `inline-flex items-center justify-center rounded-md border p-2 transition-colors flex-shrink-0 ${on ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:bg-foreground/5 hover:text-foreground'}`
  return (
    <div className="painel-produtor w-full max-w-full h-screen max-h-screen relative flex flex-col overflow-hidden glass-canvas font-sans text-foreground select-none min-w-0">

      {/* CABEÇALHO */}
      <header className="w-full max-w-full flex items-center justify-between px-3 py-2 md:px-6 md:py-3 border-b border-border bg-card text-foreground z-30 flex-nowrap gap-2 md:gap-4 overflow-hidden min-w-0 flex-shrink-0">
        <div className="flex items-center gap-3 flex-shrink-0">
          <Link to={voltarPara} onClick={(e: ReactMouseEvent) => { if (!confirmarSaida()) e.preventDefault() }} className={btnIcone} aria-label="Voltar ao painel">
            <I.SetaEsquerda className="w-4 h-4" aria-hidden="true" />
          </Link>
          <div className="flex flex-col min-w-0">
            <h1 className="text-base lg:text-lg font-semibold text-foreground tracking-tight flex items-center gap-2 whitespace-nowrap">
              <span>Editor de mapa</span>
              <span className="hidden sm:inline-flex rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground whitespace-nowrap">Escala métrica</span>
            </h1>
            <p className="hidden xl:block text-[11px] text-muted-foreground mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">Segure Espaço e arraste para navegar · role o mouse para dar zoom</p>
          </div>
          {seletorEvento}
          <Button size="sm" onClick={handleSaveMap} disabled={!pronto} className="ml-2">
            <I.Guardar aria-hidden="true" /> Salvar
          </Button>
        </div>

        {/* CONTROLES SUPERIORES */}
        <div className="flex items-center gap-1.5 lg:gap-2 flex-shrink-0 min-w-0">

          {/* Barra de pesquisa (oculta em telas muito pequenas) */}
          <div className="relative flex-shrink-0 hidden sm:block">
            <I.Buscar className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar…"
              aria-label="Pesquisar no mapa"
              className="h-8 pl-8 pr-3 rounded-md border border-input bg-transparent text-xs text-foreground placeholder:text-muted-foreground w-16 focus:w-28 md:w-24 md:focus:w-32 lg:w-36 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-all"
            />
          </div>

          {/* Seleção e movimento */}
          <div className="flex items-center gap-0.5 rounded-md border border-border bg-muted p-0.5 flex-shrink-0">
            <button
              onClick={() => { setTool('select'); setIsPan(false); }}
              title="Selecionar (V)"
              aria-label="Selecionar (V)"
              aria-pressed={tool === 'select' && !isPan}
              className={`p-1.5 rounded transition-colors ${tool === 'select' && !isPan ? 'bg-card text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <I.Cursor className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <button
              onClick={() => { setTool('pan'); setIsPan(true); }}
              title="Mão: mover a tela (H)"
              aria-label="Mão: mover a tela (H)"
              aria-pressed={tool === 'pan' || isPan}
              className={`p-1.5 rounded transition-colors ${(tool === 'pan' || isPan) ? 'bg-card text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <I.Mao className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          {/* Grade e nomes (ocultos abaixo de lg para economizar espaço horizontal) */}
          <button onClick={() => setShowGrid(!showGrid)} title="Grade métrica" aria-label="Grade métrica" aria-pressed={showGrid} className={`${btnLigado(showGrid)} hidden lg:inline-flex`}>
            <I.Grade className="w-4 h-4" aria-hidden="true" />
          </button>
          <button onClick={() => setShowLabels(!showLabels)} title="Mostrar nomes" aria-label="Mostrar nomes" aria-pressed={showLabels} className={`${btnLigado(showLabels)} hidden lg:inline-flex`}>
            <I.Texto className="w-4 h-4" aria-hidden="true" />
          </button>

          {/* Minimapa (oculto abaixo de xl) */}
          <button onClick={() => setShowMinimap(!showMinimap)} title="Minimapa" aria-label="Minimapa" aria-pressed={showMinimap} className={`${btnLigado(showMinimap)} hidden xl:inline-flex`}>
            <I.Local className="w-4 h-4" aria-hidden="true" />
          </button>

          {/* Desfazer e refazer (ocultos abaixo de xl) */}
          <div className="w-px h-6 bg-border mx-1 flex-shrink-0 hidden xl:block" />

          <button onClick={undo} disabled={(histIdx[activeEnv] || 0) <= 0} title="Desfazer (Ctrl+Z)" aria-label="Desfazer (Ctrl+Z)" className={`${btnIcone} hidden xl:inline-flex`}>
            <I.Desfazer className="w-4 h-4" aria-hidden="true" />
          </button>
          <button onClick={redo} disabled={(histIdx[activeEnv] || 0) >= ((history[activeEnv] || []).length - 1)} title="Refazer (Ctrl+Y)" aria-label="Refazer (Ctrl+Y)" className={`${btnIcone} hidden xl:inline-flex`}>
            <I.Refazer className="w-4 h-4" aria-hidden="true" />
          </button>

          {/* Bloco de zoom completo (visível só acima de 2xl) */}
          <div className="w-px h-6 bg-border mx-1 flex-shrink-0 hidden 2xl:block" />

          <div className="items-center gap-0.5 rounded-md border border-border bg-card px-1 py-0.5 flex-shrink-0 hidden 2xl:flex">
            <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))} title="Afastar" aria-label="Afastar" className="p-1.5 rounded text-muted-foreground hover:bg-foreground/5 hover:text-foreground"><I.Reduzir className="w-3.5 h-3.5" aria-hidden="true" /></button>
            <span className="text-[11px] font-medium tabular-nums text-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(3.0, z + 0.1))} title="Aproximar" aria-label="Aproximar" className="p-1.5 rounded text-muted-foreground hover:bg-foreground/5 hover:text-foreground"><I.Ampliar className="w-3.5 h-3.5" aria-hidden="true" /></button>
            <button onClick={centerPavilion} title="Centralizar o pavilhão na tela" aria-label="Centralizar o pavilhão na tela" className="p-1.5 rounded text-muted-foreground hover:bg-foreground/5 hover:text-foreground"><I.Restaurar className="w-3.5 h-3.5" aria-hidden="true" /></button>
          </div>

          {/* Centralizar avulso (útil e compacto em telas menores) */}
          <button onClick={centerPavilion} title="Centralizar o pavilhão" aria-label="Centralizar o pavilhão" className={`${btnIcone} 2xl:hidden`}>
            <I.Restaurar className="w-3.5 h-3.5" aria-hidden="true" />
          </button>

          {/* Exportar e importar JSON (ocultos abaixo de 2xl) */}
          <div className="w-px h-6 bg-border mx-1 flex-shrink-0 hidden 2xl:block" />

          <button onClick={exportMap} className={`${btnIcone} hidden 2xl:inline-flex`} title="Exportar JSON" aria-label="Exportar JSON"><I.Baixar className="w-4 h-4" aria-hidden="true" /></button>
          <label className={`${btnIcone} cursor-pointer hidden 2xl:inline-flex`} title="Importar JSON">
            <I.Carregar className="w-4 h-4" aria-hidden="true" />
            <span className="sr-only">Importar JSON</span>
            <input type="file" accept=".json" className="hidden" onChange={e => e.target.files?.[0] && importMap(e.target.files[0])} />
          </label>
        </div>
      </header>

      {erroMapa && (
        <div role="alert" className="w-full flex-shrink-0 border-b border-border bg-amber-50 px-6 py-2 text-xs text-amber-900">
          O mapa não carregou; recarregue antes de editar. Enquanto isso o botão Salvar fica travado.
        </div>
      )}

      {/* PAVIMENTOS / AMBIENTES */}
      <div className="w-full max-w-full flex items-center gap-2 px-3 md:px-6 py-2 border-b border-border bg-background text-foreground overflow-x-auto overflow-y-hidden flex-nowrap whitespace-nowrap min-w-0 flex-shrink-0">
        <I.Empresa className="w-4 h-4 text-muted-foreground mr-1 flex-shrink-0" aria-hidden="true" />
        {environments.map((e, i) => (
          <div
            key={e.id}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-colors border ${i === activeEnv ? 'border-primary/40 bg-primary/10 text-foreground font-medium' : 'border-border bg-card text-muted-foreground hover:bg-foreground/5 hover:text-foreground'}`}
          >
            <button onClick={() => { setActiveEnv(i); setSelected([]); setSelectedWallId(null); }} aria-pressed={i === activeEnv} className="flex items-center gap-1.5">
              <I.Globo className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{e.name}</span>
              <span className="text-[11px] tabular-nums text-muted-foreground">({e.seats?.length || 0})</span>
            </button>
            {environments.length > 1 && (
              <button
                onClick={(ev) => { ev.stopPropagation(); removeEnvironment(i); }}
                title="Remover pavimento"
                aria-label={`Remover o pavimento ${e.name}`}
                className="ml-1 p-0.5 rounded text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors"
              >
                <I.Fechar className="w-3 h-3" aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={addEnvironment}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-dashed border-border text-xs text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors flex-shrink-0"
        >
          <I.Criar className="w-3.5 h-3.5" aria-hidden="true" /> Novo pavimento
        </button>

        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setAutoLayoutModalOpen(true)}
            aria-label="Gerador de layout"
            className="flex items-center gap-2 h-8 px-3 md:px-4 rounded-md border border-border bg-card text-xs font-medium text-foreground hover:bg-foreground/5 transition-colors"
          >
            <I.Grade className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden md:inline">Gerador de layout</span>
          </button>

          <button
            onClick={() => setAiReaderOpen(true)}
            aria-label="Leitor de mapa com IA"
            className="flex items-center gap-2 h-8 px-3 md:px-4 rounded-md border border-border bg-card text-xs font-medium text-foreground hover:bg-foreground/5 transition-colors"
          >
            <I.Destaque className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
            <span className="hidden md:inline">Leitor de mapa com IA</span>
          </button>
        </div>
      </div>

      {/* ÁREA PRINCIPAL */}
      <div className="flex-1 flex overflow-hidden min-w-0 w-full max-w-full">
        
        {/* BARRA LATERAL ESQUERDA - FERRAMENTAS */}
        <aside className={`bg-card border-r border-border flex flex-col overflow-y-auto sidebar-dark-scroll flex-shrink-0 z-20 transition-all duration-300 ${sidebarLeftOpen ? 'w-64 opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
          
          <div className="p-4 border-b border-border bg-secondary">
            <h3 className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-2.5">Templates Rápidos</h3>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { name: 'Teatro', icon: I.Lugar, desc: 'auditório' },
                { name: 'VIP Jantar', icon: I.Quadrado, desc: 'banquete' },
                { name: 'Vazio', icon: I.Fechar, desc: 'Limpar tudo' },
              ].map(t => (
                <button 
                  key={t.name} 
                  onClick={() => applyTemplate(t.name === 'VIP Jantar' ? 'Jantar VIP' : t.name)}
                  className="p-2 bg-card rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5 text-center transition-all group shadow-xs"
                >
                  <t.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary mx-auto mb-1 transition-colors" />
                  <span className="text-[9px] font-bold text-foreground block truncate">{t.name}</span>
                  <span className="text-[7px] text-muted-foreground block mt-0.5">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 flex-1 space-y-4">
            {TOOL_CATEGORIES.map(category => (
              <div key={category.id} className="space-y-1.5">
                <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                  {category.name}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {category.tools.map(t => {
                    const Icon = toolIcon(t)
                    const isSelected = tool === t
                    const defaults = toolDefaults[t]
                    return (
                      <button 
                        key={t} 
                        onClick={() => {
                          if (t === 'select' || t === 'pan' || t === 'wall') {
                            setTool(t)
                            if (t === 'pan') setIsPan(true)
                            else setIsPan(false)
                            setSelected([])
                            setSelectedWallId(null)
                          } else {
                            addElementDirectly(t)
                          }
                        }}
                        className={`p-2 rounded-xl border transition-all flex flex-col items-center justify-center gap-1 text-center shadow-xs ${isSelected ? 'bg-primary/10 border-primary/35 text-primary font-bold' : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-border hover:bg-foreground/5'}`}
                        title={`${typeLabels[t]} (${defaults.wMeter}m x ${defaults.hMeter}m)`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-[9px] font-bold leading-tight truncate w-full">{typeLabels[t]}</span>
                        {defaults.wMeter > 0 && (
                          <span className="text-[8px] text-muted-foreground font-mono font-semibold">{defaults.wMeter}x{defaults.hMeter}m</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-border bg-secondary space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Snap ao Grid</h3>
              <button 
                onClick={() => setSnap(!snap)} 
                className={`text-[9px] font-bold px-2 py-0.5 rounded-full border transition-all ${snap ? 'bg-secondary border-border text-[var(--ev-success)]' : 'bg-secondary border-border text-muted-foreground'}`}
              >
                {snap ? 'Ligado' : 'Desligado'}
              </button>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Distância do Snap:</span>
                <span className="font-mono font-bold text-foreground bg-card border border-border px-1.5 py-0.5 rounded">{gridSize} m</span>
              </div>
              <div className="flex gap-1">
                {[0.1, 0.25, 0.5, 1.0].map(val => (
                  <button
                    key={val}
                    onClick={() => setGridSize(val)}
                    className={`flex-1 py-1 rounded-lg border text-[9px] font-mono font-bold transition-all shadow-xs ${gridSize === val ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:bg-foreground/5'}`}
                  >
                    {val}m
                  </button>
                ))}
              </div>
            </div>
          </div>

        </aside>

        {/* CANVAS DE DESENHO CENTRAL */}
        <main 
          className="light mapa-claro flex-1 relative overflow-hidden bg-secondary" /* planta desenhada em branco: fica clara nos dois temas */
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={handleCanvasClick}
          onContextMenu={handleContextMenu}
          style={{ cursor: spacePressed ? 'grab' : isPan ? 'grabbing' : tool === 'select' ? 'default' : 'crosshair' }}
        >
          {/* Botões flutuantes removidos para manter sidebars fixas e sempre visíveis */}

          <div className="absolute top-4 left-4 z-20 pointer-events-none bg-card/90 backdrop-blur-sm border border-border px-3 py-1.5 rounded-xl text-[10px] font-mono text-muted-foreground flex items-center gap-3 shadow-md">
            <span>X: <strong>{mouseCanvasPos.x.toFixed(2)} m</strong></span>
            <span>Y: <strong>{mouseCanvasPos.y.toFixed(2)} m</strong></span>
            {wallStartPoint && (
              <span className="text-primary animate-pulse font-bold">
                Muro atual: {Math.hypot(mouseCanvasPos.x - wallStartPoint.x, mouseCanvasPos.y - wallStartPoint.y).toFixed(2)} m
              </span>
            )}
          </div>

          {/* Viewport do Canvas */}
          <div 
            className="absolute inset-0 origin-top-left" 
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          >
            {/* Grade milimetrada */}
            {showGrid && (
              <div 
                className="absolute pointer-events-none" 
                style={{ 
                  width: canvasW, 
                  height: canvasH,
                  backgroundImage: `
                    linear-gradient(to right, rgba(0,0,0,0.06) ${Math.max(1, 1 / zoom)}px, transparent ${Math.max(1, 1 / zoom)}px),
                    linear-gradient(to bottom, rgba(0,0,0,0.06) ${Math.max(1, 1 / zoom)}px, transparent ${Math.max(1, 1 / zoom)}px),
                    linear-gradient(to right, rgba(0,0,0,0.02) ${Math.max(1, 1 / zoom)}px, transparent ${Math.max(1, 1 / zoom)}px),
                    linear-gradient(to bottom, rgba(0,0,0,0.02) ${Math.max(1, 1 / zoom)}px, transparent ${Math.max(1, 1 / zoom)}px)
                  `,
                  backgroundSize: `${5 * pixelsPerMeter}px ${5 * pixelsPerMeter}px, ${5 * pixelsPerMeter}px ${5 * pixelsPerMeter}px, ${pixelsPerMeter}px ${pixelsPerMeter}px, ${pixelsPerMeter}px ${pixelsPerMeter}px`
                }} 
              />
            )}

            {/* Limite Físico do Pavilhão / Salão (AutoCAD-Style) */}
            {roomShape === 'rectangle' && (
              <div 
                className="absolute border-muted-foreground bg-card shadow-md pointer-events-none transition-all duration-300"
                style={{
                  left: 10 * pixelsPerMeter,
                  top: 10 * pixelsPerMeter,
                  width: roomWidth * pixelsPerMeter,
                  height: roomHeight * pixelsPerMeter,
                  borderWidth: `${Math.max(4, 0.25 * pixelsPerMeter)}px`, // Espessura da parede de 25cm (mínimo 4px para visibilidade)
                  transform: `rotate(${roomRotation}deg)`,
                  transformOrigin: 'top left',
                  zIndex: 0
                }}
              >
                {/* Indicador sutil de Área Útil */}
                <div className="absolute inset-2 border border-dashed border-border flex items-center justify-center text-muted-foreground select-none">
                  <span className="text-xs font-mono font-bold uppercase tracking-widest">{roomWidth} x {roomHeight}m</span>
                </div>
              </div>
            )}

            {roomShape === 'l_shape' && (
              <svg 
                className="absolute pointer-events-none overflow-visible transition-all duration-300"
                style={{
                  left: 10 * pixelsPerMeter,
                  top: 10 * pixelsPerMeter,
                  width: roomWidth * pixelsPerMeter,
                  height: roomHeight * pixelsPerMeter,
                  transform: `rotate(${roomRotation}deg)`,
                  transformOrigin: 'top left',
                  zIndex: 0
                }}
              >
                <polygon 
                  points={`
                    0,0 
                    ${roomWidth * pixelsPerMeter},0 
                    ${roomWidth * pixelsPerMeter},${(roomHeight - roomLHeight) * pixelsPerMeter} 
                    ${(roomWidth - roomLWidth) * pixelsPerMeter},${(roomHeight - roomLHeight) * pixelsPerMeter} 
                    ${(roomWidth - roomLWidth) * pixelsPerMeter},${roomHeight * pixelsPerMeter} 
                    0,${roomHeight * pixelsPerMeter}
                  `}
                  fill="hsl(var(--card))"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={Math.max(4, 0.25 * pixelsPerMeter)}
                  strokeLinejoin="miter"
                />
                <text 
                  x={(roomWidth / 3) * pixelsPerMeter} 
                  y={(roomHeight / 3) * pixelsPerMeter} 
                  fill="hsl(var(--muted-foreground))" 
                  fontSize="12" 
                  fontWeight="bold" 
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  ÁREA ÚTIL EM L ({roomWidth}x{roomHeight}m)
                </text>
              </svg>
            )}

            {/* CONTROLES DO PAVILHÃO DIRETO NO MAPA */}
            {selected.length === 0 && !selectedWallId && (
              <div
                className="absolute pointer-events-none z-10"
                style={{
                  left: 10 * pixelsPerMeter,
                  top: 10 * pixelsPerMeter,
                  width: roomWidth * pixelsPerMeter,
                  height: roomHeight * pixelsPerMeter,
                  transform: `rotate(${roomRotation}deg)`,
                  transformOrigin: 'top left',
                }}
              >
                {/* Linha pontilhada azul ao redor do pavilhão indicando que ele está ativo para edição */}
                <div className="absolute inset-0 border-2 border-dashed rounded pointer-events-none" style={{ borderColor: 'hsl(var(--primary) / 0.35)' }} />

                {/* ALÇA DE REDIMENSIONAMENTO DO PAVILHÃO (Canto Inferior Direito) */}
                <div
                  className="absolute bottom-0 right-0 w-5 h-5 bg-primary border-2 border-card rounded shadow-md cursor-se-resize z-30 pointer-events-auto flex items-center justify-center scale-100 hover:scale-110 active:scale-95 transition-all"
                  style={{ transform: 'translate(50%, 50%)' }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    
                    const startWidth = roomWidth
                    const startHeight = roomHeight
                    const startPos = getPos(e)

                    const handleMouseMoveResizeEnv = (moveEvent: MouseEvent) => {
                      const pos = getPos({
                        clientX: moveEvent.clientX,
                        clientY: moveEvent.clientY
                      })
                      const dx = pos.x - startPos.x
                      const dy = pos.y - startPos.y

                      // Rotacionar dx, dy de volta pelo ângulo de rotação global para aplicar escala alinhada às paredes
                      const rad = -roomRotation * (Math.PI / 180)
                      const rotDx = dx * Math.cos(rad) - dy * Math.sin(rad)
                      const rotDy = dx * Math.sin(rad) + dy * Math.cos(rad)

                      const newW = Math.max(5, startWidth + rotDx)
                      const newH = Math.max(5, startHeight + rotDy)

                      const finalW = snap ? Math.round(newW) : Math.round(newW * 10) / 10
                      const finalH = snap ? Math.round(newH) : Math.round(newH * 10) / 10

                      updateActiveEnv({ roomWidth: finalW, roomHeight: finalH })
                    }

                    const handleMouseUpResizeEnv = () => {
                      window.removeEventListener('mousemove', handleMouseMoveResizeEnv)
                      window.removeEventListener('mouseup', handleMouseUpResizeEnv)
                      pushHistory(seats, walls)
                    }

                    window.addEventListener('mousemove', handleMouseMoveResizeEnv)
                    window.addEventListener('mouseup', handleMouseUpResizeEnv)
                  }}
                  title="Arrastar para mudar o tamanho do salão"
                />

                {/* ALÇA DE ROTAÇÃO DO PAVILHÃO (Topo Central) */}
                <div
                  className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-8 flex flex-col items-center cursor-alias z-30 pointer-events-auto"
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    e.preventDefault()

                    const centerLogicalX = 10 + roomWidth / 2
                    const centerLogicalY = 10 + roomHeight / 2

                    const handleMouseMoveRotateEnv = (moveEvent: MouseEvent) => {
                      const canvasMouse = getPos({
                        clientX: moveEvent.clientX,
                        clientY: moveEvent.clientY
                      })
                      const dx = canvasMouse.x - centerLogicalX
                      const dy = canvasMouse.y - centerLogicalY

                      let angleDeg = Math.atan2(dy, dx) * (180 / Math.PI)
                      angleDeg = (angleDeg + 90) % 360
                      if (angleDeg < 0) angleDeg += 360

                      const finalAngle = snap || moveEvent.shiftKey ? Math.round(angleDeg / 15) * 15 : Math.round(angleDeg)
                      updateActiveEnv({ roomRotation: finalAngle })
                    }

                    const handleMouseUpRotateEnv = () => {
                      window.removeEventListener('mousemove', handleMouseMoveRotateEnv)
                      window.removeEventListener('mouseup', handleMouseUpRotateEnv)
                      pushHistory(seats, walls)
                    }

                    window.addEventListener('mousemove', handleMouseMoveRotateEnv)
                    window.addEventListener('mouseup', handleMouseUpRotateEnv)
                  }}
                  title="Arrastar para girar o salão"
                >
                  {/* Linha conectora */}
                  <div className="w-0.5 h-4 bg-primary" />
                  {/* Bolinha de arraste */}
                  <div className="w-5 h-5 bg-primary hover:bg-primary/90 border border-card rounded-full flex items-center justify-center shadow-glow transition-all scale-100 hover:scale-110 active:scale-95">
                    <I.Restaurar className="w-2.5 h-2.5 text-background" />
                  </div>
                </div>
              </div>
            )}

            {/* Imagem de Fundo */}
            {bgImage && (
              <div 
                className="absolute select-none pointer-events-auto"
                style={{ 
                  left: bgOffset.x, 
                  top: bgOffset.y,
                  width: `${bgScale * 1000}px`,
                  opacity: bgOpacity,
                  cursor: bgDragging ? 'grabbing' : 'grab',
                  zIndex: 0
                }}
                onMouseDown={(e) => {
                  if (tool === 'select' && e.altKey) {
                    e.stopPropagation()
                    setBgDragging(true)
                    setBgDragStart({ x: e.clientX - bgOffset.x, y: e.clientY - bgOffset.y })
                  }
                }}
              >
                <img 
                  src={bgImage} 
                  alt="Planta Baixa" 
                  className="w-full h-auto select-none pointer-events-none" 
                  draggable={false} 
                  onLoad={e => setBgNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                />
              </div>
            )}

            {/* Proposta do leitor de planta com IA: por cima da planta, clique desmarca a peça. Nada entra no mapa antes de "Aplicar". */}
            {propostaAtual && bgNatural && (
              <div
                className="absolute z-40 pointer-events-none"
                style={{ left: bgOffset.x, top: bgOffset.y, width: bgScale * LARGURA_BASE_PX, height: (bgScale * LARGURA_BASE_PX * bgNatural.h) / bgNatural.w }}
              >
                {propostaAtual.pecas.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={p.marcada}
                    aria-label={`${typeLabels[p.tipo]}${p.rotulo ? ` ${p.rotulo}` : ''}: ${p.marcada ? 'marcada, clique para desmarcar' : 'desmarcada, clique para marcar'}`}
                    title={`${typeLabels[p.tipo]}${p.rotulo ? ` · ${p.rotulo}` : ''}`}
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => {
                      e.stopPropagation()
                      setProposta({ ...propostaAtual, pecas: propostaAtual.pecas.map(x => (x.id === p.id ? { ...x, marcada: !x.marcada } : x)) })
                    }}
                    className={`absolute rounded-sm border-2 ${calibrating ? 'pointer-events-none' : 'pointer-events-auto'} ${p.marcada ? 'border-plum bg-plum/25' : 'border-dashed border-stone-400 bg-stone-300/20'}`}
                    style={{ left: `${(p.x - p.w / 2) * 100}%`, top: `${(p.y - p.h / 2) * 100}%`, width: `${p.w * 100}%`, height: `${p.h * 100}%` }}
                  />
                ))}
              </div>
            )}

            {/* Calibração de Escala */}
            {calibrating && calibrationPoints.length > 0 && (
              <div className="absolute pointer-events-none z-50">
                {calibrationPoints.map((p, idx) => (
                  <div 
                    key={idx} 
                    className="absolute w-5 h-5 bg-primary rounded-full border-2 border-card -translate-x-2.5 -translate-y-2.5 flex items-center justify-center font-mono text-[9px] text-primary-foreground font-bold shadow-md"
                    style={{ left: p.x * pixelsPerMeter, top: p.y * pixelsPerMeter }}
                  >
                    {idx + 1}
                  </div>
                ))}
                {calibrationPoints.length === 2 && (
                  <svg className="absolute top-0 left-0 w-[5000px] h-[5000px]">
                    <line 
                      x1={calibrationPoints[0].x * pixelsPerMeter} 
                      y1={calibrationPoints[0].y * pixelsPerMeter} 
                      x2={calibrationPoints[1].x * pixelsPerMeter} 
                      y2={calibrationPoints[1].y * pixelsPerMeter} 
                      stroke="hsl(var(--primary))" 
                      strokeWidth="2.5" 
                      strokeDasharray="4,4" 
                    />
                  </svg>
                )}
              </div>
            )}

            {/* Caixa de seleção */}
            {boxSel?.active && (
              <div 
                className="absolute border-2 border-primary/40 bg-primary/5 pointer-events-none z-50 rounded" 
                style={{
                  left: Math.min(boxSel.x1, boxSel.x2) * pixelsPerMeter, 
                  top: Math.min(boxSel.y1, boxSel.y2) * pixelsPerMeter,
                  width: Math.abs(boxSel.x2 - boxSel.x1) * pixelsPerMeter, 
                  height: Math.abs(boxSel.y2 - boxSel.y1) * pixelsPerMeter,
                }} 
              />
            )}

            {/* Paredes/Muros (SVG) */}
            <svg 
              className="absolute pointer-events-none z-10" 
              style={{ width: canvasW, height: canvasH }}
            >
              {walls.map(w => {
                const isSelected = selectedWallId === w.id
                const p1x = w.x1 * pixelsPerMeter
                const p1y = w.y1 * pixelsPerMeter
                const p2x = w.x2 * pixelsPerMeter
                const p2y = w.y2 * pixelsPerMeter
                const thickPx = w.thickness * pixelsPerMeter
                
                return (
                  <g key={w.id}>
                    <line 
                      x1={p1x} 
                      y1={p1y} 
                      x2={p2x} 
                      y2={p2y} 
                      stroke={w.color || '#4b5563'} 
                      strokeWidth={thickPx} 
                      strokeLinecap="round"
                      className="pointer-events-auto cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (tool === 'select') {
                          setSelectedWallId(w.id)
                          setSelected([])
                        }
                      }}
                    />
                    
                    <line 
                      x1={p1x} 
                      y1={p1y} 
                      x2={p2x} 
                      y2={p2y} 
                      stroke={isSelected ? 'hsl(var(--primary))' : 'hsl(var(--foreground))'} 
                      strokeWidth={thickPx + 2} 
                      strokeLinecap="round"
                      opacity="0.12"
                    />

                    {showLabels && (
                      <text
                        x={(p1x + p2x) / 2}
                        y={(p1y + p2y) / 2 - (thickPx / 2 + 5)}
                        fill="hsl(var(--primary))"
                        fontSize="9"
                        fontWeight="bold"
                        textAnchor="middle"
                        className="select-none pointer-events-none font-mono"
                      >
                        {Math.hypot(w.x2 - w.x1, w.y2 - w.y1).toFixed(2)}m
                      </text>
                    )}
                  </g>
                )
              })}

              {tool === 'wall' && wallStartPoint && (
                <g>
                  <line 
                    x1={wallStartPoint.x * pixelsPerMeter} 
                    y1={wallStartPoint.y * pixelsPerMeter} 
                    x2={mouseCanvasPos.x * pixelsPerMeter} 
                    y2={mouseCanvasPos.y * pixelsPerMeter} 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={wallThickness * pixelsPerMeter} 
                    strokeLinecap="round" 
                    opacity="0.5" 
                  />
                  <circle
                    cx={mouseCanvasPos.x * pixelsPerMeter}
                    cy={mouseCanvasPos.y * pixelsPerMeter}
                    r="5"
                    fill="hsl(var(--primary))"
                    className="animate-ping"
                  />
                </g>
              )}
            </svg>

            {/* PONTOS DE ARRASTE DOS MUROS */}
            {selectedWallId && (() => {
              const wall = walls.find(w => w.id === selectedWallId)
              if (!wall) return null
              return (
                <div className="absolute inset-0 pointer-events-none z-30">
                  <div 
                    className="absolute w-4 h-4 bg-primary border-2 border-card rounded-full -translate-x-2 -translate-y-2 pointer-events-auto cursor-move shadow-md"
                    style={{ left: wall.x1 * pixelsPerMeter, top: wall.y1 * pixelsPerMeter }}
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      setDraggingWallNode({ wallId: selectedWallId, endPoint: 'p1' })
                    }}
                  />
                  <div 
                    className="absolute w-4 h-4 bg-primary border-2 border-card rounded-full -translate-x-2 -translate-y-2 pointer-events-auto cursor-move shadow-md"
                    style={{ left: wall.x2 * pixelsPerMeter, top: wall.y2 * pixelsPerMeter }}
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      setDraggingWallNode({ wallId: selectedWallId, endPoint: 'p2' })
                    }}
                  />
                </div>
              )
            })()}

            {/* RENDERIZAÇÃO DOS ELEMENTOS */}
            {filteredSeats.map(s => {
              const isSelected = selected.includes(s.id)
              const statusColor = s.status === 'sold' ? '#dc2626' : s.status === 'reserved' ? '#d97706' : s.status === 'blocked' ? '#78716c' : s.status === 'contact' ? '#0284c7' : s.color
              const dim = s.status === 'sold' || s.status === 'blocked' || s.status === 'contact' ? 0.65 : 1.0

              // Conversão metros -> pixels
              const w = (s.widthMeter || toolDefaults[s.type]?.wMeter || 0.5) * pixelsPerMeter
              const h = (s.heightMeter || toolDefaults[s.type]?.hMeter || 0.5) * pixelsPerMeter

              const showLabelInline = 
                s.type === 'table' || s.type === 'stage' || s.type === 'bar' || s.type === 'door' || 
                s.type === 'text' || s.type === 'restroom' || s.type === 'info' || s.type === 'service' || 
                s.type === 'stairs' || s.type === 'couch' || s.type === 'tent' || s.type === 'stand' || s.type === 'ledscreen' ||
                s.type === 'vip_lounge' || s.type === 'round_buffet' || s.type === 'runway_stage' || s.type === 'backdrop' ||
                s.type === 'foh_desk' || s.type === 'parking_spot' || s.type === 'l_bar' || s.type === 'u_bar' ||
                s.type === 'food_court' || s.type === 'cloakroom' || s.type === 'ticket_office' || s.type === 'container_toilet' ||
                s.type === 'large_tent' || s.type === 'buffet_table' || s.type === 'dressing_room' || s.type === 'portico' || s.type === 'dj_deck'

              // Determinar o formato para mesas
              const isCircleTable = s.type === 'table' && s.tableShape === 'circle'

              return (
                <div 
                  key={s.id}
                  onMouseDown={(e) => handleElementMouseDown(e, s)}
                  onClick={(e) => handleElementClick(e, s)}
                  className={`absolute origin-center ${s.locked ? '' : tool === 'select' ? 'hover:brightness-105 active:scale-95' : ''} ${isSelected ? 'z-20' : 'z-10'}`}
                  style={{
                    left: s.x * pixelsPerMeter - w / 2, 
                    top: s.y * pixelsPerMeter - h / 2, 
                    width: w, 
                    height: h,
                    cursor: tool === 'select' ? (s.locked ? 'not-allowed' : 'pointer') : 'default',
                    opacity: dim,
                    pointerEvents: tool === 'select' ? 'auto' : 'none',
                    transform: `rotate(${s.rotation}deg)`,
                  }}
                >
                  <div className={`w-full h-full relative ${isSelected ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background rounded-xl shadow-[0_0_12px_hsl(var(--foreground)/0.4)]' : ''}`}>
                    
                    {/* 1. CADEIRA RÚSTICA / ASSENTO */}
                    {s.type === 'seat' && (
                      <div 
                        className="w-full h-full rounded-lg border flex items-center justify-center shadow-xs bg-card"
                        style={{ borderColor: statusColor, background: isSelected ? `${statusColor}25` : `${statusColor}12` }}
                      >
                        <I.Lugar className="w-3.5 h-3.5" style={{ color: statusColor }} />
                      </div>
                    )}

                    {/* 2. MESA INTELIGENTE (REDONDA, RETANGULAR OU QUADRADA COM ASSENTOS VETORIAIS) */}
                    {s.type === 'table' && (
                      <div className="w-full h-full relative flex items-center justify-center">
                        
                        {/* Tampo da Mesa */}
                        <div 
                          className={`border-2 flex flex-col items-center justify-center shadow bg-card z-10 ${s.tableShape === 'circle' ? 'rounded-full' : s.tableShape === 'square' ? 'rounded-lg' : 'rounded-xl'}`}
                          style={{ 
                            borderColor: statusColor, 
                            width: '72%', 
                            height: '72%',
                            background: isSelected ? `${statusColor}15` : 'hsl(var(--card))'
                          }}
                        >
                          <span className="text-[7.5px] font-bold tracking-tight text-foreground truncate max-w-[90%]">{s.label}</span>
                          <span className="text-[6.5px] text-muted-foreground font-mono mt-0.5">{s.seatsCount || s.capacity}L</span>
                        </div>

                        {/* Cadeiras Dispostas ao Redor da Mesa (Layout Vector Inteligente) */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-0">
                          {(() => {
                            const count = s.seatsCount || s.capacity || 6
                            const chairs = []
                            const chairSize = 10.5

                            if (s.tableShape === 'circle') {
                              // Redonda: Distribuição circular elíptica
                              const radiusX = w / 2
                              const radiusY = h / 2
                              for (let i = 0; i < count; i++) {
                                const angle = (i * 2 * Math.PI) / count
                                const cx = w / 2 + Math.cos(angle) * (radiusX * 0.96)
                                const cy = h / 2 + Math.sin(angle) * (radiusY * 0.96)
                                
                                chairs.push(
                                  <circle 
                                    key={`chair-${i}`}
                                    cx={cx} 
                                    cy={cy} 
                                    r={chairSize / 2}
                                    fill="hsl(var(--card))" 
                                    stroke={statusColor} 
                                    strokeWidth="1.2"
                                  />
                                )
                              }
                            } else {
                              // Quadrada ou Retangular: Distribuição perimetral retangular
                              const pad = 5
                              const rw = w - pad * 2
                              const rh = h - pad * 2
                              const peri = 2 * (rw + rh)
                              
                              for (let i = 0; i < count; i++) {
                                // Deslocamento de meio intervalo para centralizar nos lados planos e evitar cantos
                                const dist = ((i + 0.5) * peri) / count
                                let cx = 0
                                let cy = 0
                                
                                if (dist < rw) {
                                  cx = pad + dist
                                  cy = pad
                                } else if (dist < rw + rh) {
                                  cx = pad + rw
                                  cy = pad + (dist - rw)
                                } else if (dist < rw * 2 + rh) {
                                  cx = pad + rw - (dist - rw - rh)
                                  cy = pad + rh
                                } else {
                                  cx = pad
                                  cy = pad + rh - (dist - rw * 2 - rh)
                                }

                                chairs.push(
                                  <circle 
                                    key={`chair-${i}`}
                                    cx={cx} 
                                    cy={cy} 
                                    r={chairSize / 2}
                                    fill="hsl(var(--card))" 
                                    stroke={statusColor} 
                                    strokeWidth="1.2"
                                  />
                                )
                              }
                            }
                            return chairs
                          })()}
                        </svg>
                      </div>
                    )}

                    {/* 3. PALCO */}
                    {s.type === 'stage' && (
                      <div 
                        className="w-full h-full rounded-xl border-2 border-muted-foreground bg-secondary flex flex-col items-center justify-center shadow-sm"
                      >
                        <div className="flex items-center gap-1 text-foreground">
                          <I.Tela className="w-3.5 h-3.5 text-primary" />
                          <span className="text-[10px] font-bold ">{s.label}</span>
                        </div>
                        <span className="text-[8px] text-muted-foreground font-mono font-bold mt-0.5">{s.widthMeter}x{s.heightMeter}m</span>
                        <div className="absolute -left-1 bottom-1.5 w-1 h-3 bg-muted-foreground/50 rounded-l border border-muted-foreground" />
                        <div className="absolute -right-1 bottom-1.5 w-1 h-3 bg-muted-foreground/50 rounded-r border border-muted-foreground" />
                      </div>
                    )}

                    {/* 4. BAR / BALCÃO */}
                    {s.type === 'bar' && (
                      <div 
                        className="w-full h-full rounded-xl border-2 flex items-center justify-center bg-primary/10 shadow-sm"
                        style={{ borderColor: s.color }}
                      >
                        <I.Cardapio className="w-3.5 h-3.5 text-primary mr-1 flex-shrink-0" />
                        <span className="text-[9px] font-bold text-foreground truncate">{s.label}</span>
                      </div>
                    )}

                    {/* 5. PORTAS / SAÍDAS */}
                    {(s.type === 'door' || s.type === 'emergency_exit') && (
                      <div 
                        className="w-full h-full rounded border flex items-center justify-center shadow-xs bg-card"
                        style={{ 
                          borderColor: s.type === 'emergency_exit' ? '#ef4444' : '#10b981',
                          background: s.type === 'emergency_exit' ? '#ef444408' : '#10b98108'
                        }}
                      >
                        <I.Porta className={`w-3.5 h-3.5 ${s.type === 'emergency_exit' ? 'text-red-500' : 'text-emerald-500'}`} />
                      </div>
                    )}

                    {/* 6. PAINEL DE LED */}
                    {s.type === 'ledscreen' && (
                      <div className="w-full h-full bg-foreground border border-muted-foreground rounded flex items-center justify-center">
                        <span className="text-[6.5px] text-emerald-400 font-bold uppercase tracking-wider font-mono">LED · {s.widthMeter}m</span>
                      </div>
                    )}

                    {/* 7. TRELIÇA TRUSS */}
                    {s.type === 'truss' && (
                      <div 
                        className="w-full h-full bg-muted border-y border-muted-foreground/60 flex items-center justify-center opacity-90"
                        style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 6px)' }}
                      >
                        <span className="text-[6.5px] text-muted-foreground font-mono font-bold">TRUSS</span>
                      </div>
                    )}

                    {/* 8. GERADOR */}
                    {s.type === 'generator' && (
                      <div className="w-full h-full bg-amber-50 border border-amber-600 rounded-xl flex flex-col items-center justify-center p-0.5 shadow-xs">
                        <ZapIcon className="w-3.5 h-3.5 text-amber-600" />
                        <span className="text-[7px] text-amber-800 font-mono font-bold uppercase">Gerador</span>
                      </div>
                    )}

                    {/* 9. HOUSE MIX */}
                    {s.type === 'soundhouse' && (
                      <div className="w-full h-full bg-primary/10 border-2 border-primary rounded-xl flex flex-col items-center justify-center p-0.5 text-center shadow-xs">
                        <AudioIcon className="w-3.5 h-3.5 text-primary mb-0.5" />
                        <span className="text-[7.5px] text-foreground font-bold truncate w-full">{s.label}</span>
                      </div>
                    )}

                    {/* 10. BARRICADA */}
                    {s.type === 'barricade' && (
                      <div className="w-full h-full bg-muted border border-muted-foreground/60 flex items-center justify-center">
                        <BarricadeIcon className="w-3 h-3 text-muted-foreground" />
                      </div>
                    )}

                    {/* 11. BISTRÔ */}
                    {s.type === 'bistro' && (
                      <div className="w-full h-full bg-primary/10 border border-primary/40 rounded-full flex items-center justify-center shadow-xs">
                        <BistroIcon className="w-3.5 h-3.5 text-primary" />
                      </div>
                    )}

                    {/* 12. SOFÁ LOUNGE ADAPTATIVO COM DIVISÓRIAS */}
                    {s.type === 'couch' && (
                      <div className="w-full h-full relative rounded-xl border-2 border-pink-400 bg-pink-50 flex items-center justify-center p-1 shadow-xs overflow-hidden">
                        <SofaIcon className="w-3.5 h-3.5 text-pink-600 mr-1.5 flex-shrink-0 z-10" />
                        <span className="text-[8.5px] font-bold text-pink-900 truncate z-10">{s.label}</span>
                        {/* Linhas de assento simulando lugares com flex space real */}
                        <div className="absolute inset-0 flex pointer-events-none z-0">
                          {Array.from({ length: s.seatsCount || 3 }).map((_, idx) => (
                            <div 
                              key={idx}
                              className={`h-full flex-1 ${idx < (s.seatsCount || 3) - 1 ? 'border-r border-pink-300/60' : ''}`}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Mesa de Buffet */}
                    {s.type === 'buffet_table' && (
                      <div className="w-full h-full rounded-xl border-2 border-amber-600 bg-amber-50/70 flex flex-col items-center justify-center shadow-xs overflow-hidden relative">
                        <div className="flex items-center gap-1.5 text-amber-900 font-bold z-10">
                          <BuffetIcon className="w-4 h-4 text-amber-700" />
                          <span className="text-[9.5px]">{s.label}</span>
                        </div>
                        <span className="text-[7.5px] text-amber-800/60 font-mono mt-0.5 z-10">{s.widthMeter}x{s.heightMeter}m</span>
                        <div className="absolute top-1 left-2 right-2 h-0.5 bg-amber-200" />
                        <div className="absolute bottom-1 left-2 right-2 h-0.5 bg-amber-200" />
                      </div>
                    )}

                    {/* Camarim / Backstage */}
                    {s.type === 'dressing_room' && (
                      <div className="w-full h-full rounded-xl border-2 border-pink-500 bg-pink-50/35 flex flex-col items-center justify-center shadow-xs border-dashed">
                        <div className="flex items-center gap-1.5 text-pink-900 font-bold">
                          <DressingRoomIcon className="w-4 h-4 text-pink-600 animate-pulse" />
                          <span className="text-[10px] tracking-wide ">{s.label}</span>
                        </div>
                        <span className="text-[7.5px] text-pink-700/60 font-mono mt-0.5">{s.widthMeter}x{s.heightMeter}m</span>
                      </div>
                    )}

                    {/* Pórtico de Entrada */}
                    {s.type === 'portico' && (
                      <div className="w-full h-full rounded border-2 border-teal-600 bg-teal-50 flex flex-col items-center justify-center shadow-xs">
                        <div className="flex items-center gap-1.5 text-teal-900 font-bold">
                          <PorticoIcon className="w-4 h-4 text-teal-600" />
                          <span className="text-[9px] uppercase tracking-wider">{s.label}</span>
                        </div>
                      </div>
                    )}

                    {/* Praticável / Cabine DJ */}
                    {s.type === 'dj_deck' && (
                      <div className="w-full h-full rounded-xl border-2 border-primary bg-primary/10 flex flex-col items-center justify-center shadow-xs">
                        <div className="flex items-center gap-1.5 text-foreground font-bold">
                          <DjDeckIcon className="w-4 h-4 text-primary" />
                          <span className="text-[9px] ">{s.label}</span>
                        </div>
                        <span className="text-[7.5px] text-primary font-mono mt-0.5">{s.widthMeter}x{s.heightMeter}m</span>
                      </div>
                    )}

                    {/* Grade Unifila */}
                    {s.type === 'unifila_barrier' && (
                      <div 
                        className="w-full h-full bg-muted border-x-2 border-muted-foreground flex items-center justify-center"
                        style={{ backgroundImage: 'linear-gradient(90deg, transparent 45%, hsl(var(--muted-foreground)) 45%, hsl(var(--muted-foreground)) 55%, transparent 55%)', backgroundSize: '15px 100%' }}
                      >
                        <span className="text-[6.5px] text-muted-foreground font-mono font-bold">FILA</span>
                      </div>
                    )}

                    {/* 13. TENDA */}
                    {s.type === 'tent' && (
                      <div 
                        className="w-full h-full border border-primary/40 bg-primary/5 flex items-center justify-center rounded-lg shadow-xs"
                        style={{ backgroundImage: 'linear-gradient(135deg, transparent 49%, hsl(var(--primary) / 0.15) 49%, hsl(var(--primary) / 0.15) 51%, transparent 51%), linear-gradient(45deg, transparent 49%, hsl(var(--primary) / 0.15) 49%, hsl(var(--primary) / 0.15) 51%, transparent 51%)' }}
                      >
                        <TentIcon className="w-4 h-4 text-primary" />
                        <span className="absolute bottom-1 right-1.5 text-[7px] text-primary font-mono font-bold">{s.widthMeter}x{s.heightMeter}m</span>
                      </div>
                    )}

                    {/* 14. ESTANDE */}
                    {s.type === 'stand' && (
                      <div className="w-full h-full border border-sky-400 bg-sky-50 rounded flex flex-col items-center justify-center shadow-xs">
                        <StandIcon className="w-3.5 h-3.5 text-sky-600" />
                        <span className="text-[7.5px] text-sky-800 font-bold uppercase tracking-tight truncate w-full px-0.5">{s.label}</span>
                      </div>
                    )}

                    {/* 15. BANHEIROS */}
                    {(s.type === 'chemical_toilet' || s.type === 'accessible_toilet' || s.type === 'restroom') && (
                      <div className="w-full h-full border border-cyan-400 bg-cyan-50 rounded-xl flex flex-col items-center justify-center shadow-xs">
                        {s.type === 'accessible_toilet' ? (
                          <WheelchairIcon className="w-3.5 h-3.5 text-cyan-600" />
                        ) : (
                          <WcIcon className="w-3.5 h-3.5 text-cyan-600" />
                        )}
                        <span className="text-[7px] text-cyan-800 font-bold uppercase">WC</span>
                      </div>
                    )}

                    {/* 16. TEXTO */}
                    {s.type === 'text' && (
                      <div className="w-full h-full px-2 bg-card border border-border rounded-xl shadow-xs flex items-center justify-center">
                        <span className="text-[9px] font-bold text-foreground truncate">{s.label}</span>
                      </div>
                    )}

                    {/* 17. PISTA DE DANÇA */}
                    {s.type === 'dancefloor' && (
                      <div className="w-full h-full rounded-full border-2 border-dashed border-amber-400 bg-amber-500/5 flex flex-col items-center justify-center text-center">
                        <span className="text-[9px] font-bold text-amber-700 tracking-wider">PISTA</span>
                        <span className="text-[7.5px] text-amber-500 font-mono">{s.widthMeter}m</span>
                      </div>
                    )}

                    {/* 18. ÁREAS LIVRES */}
                    {s.type === 'area' && (
                      <div className="w-full h-full rounded-xl border border-dashed border-muted-foreground/60 bg-secondary/30 flex items-center justify-center">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{s.label}</span>
                      </div>
                    )}

                    {s.type === 'stairs' && (
                      <div className="w-full h-full bg-orange-50 border border-orange-500 rounded-xl flex flex-col items-center justify-center shadow-xs">
                        <I.Ordenar className="w-3.5 h-3.5 text-orange-500" />
                        <span className="text-[7.5px] text-orange-700 font-bold uppercase">Escada</span>
                      </div>
                    )}

                    {s.type === 'info' && (
                      <div className="w-full h-full rounded-xl border border-blue-400 bg-blue-50 flex items-center justify-center shadow-xs">
                        <I.Ajuda className="w-4 h-4 text-blue-600" />
                      </div>
                    )}

                    {s.type === 'service' && (
                      <div className="w-full h-full rounded-xl border border-teal-400 bg-teal-50 flex items-center justify-center shadow-xs">
                        <I.SinoRecepcao className="w-4 h-4 text-teal-600" />
                      </div>
                    )}

                    {/* Elementos novos do catálogo */}
                    {s.type === 'vip_lounge' && (
                      <div className="w-full h-full border-2 border-pink-500 bg-pink-50/70 rounded-xl flex flex-col items-center justify-center p-1 shadow-xs overflow-hidden">
                        <VipLoungeIcon className="w-4 h-4 text-pink-600 mb-0.5 flex-shrink-0" />
                        <span className="text-[9px] text-pink-900 font-bold truncate max-w-full leading-none">{s.label}</span>
                        <span className="text-[7.5px] text-pink-700/60 font-mono mt-0.5 leading-none">{s.seatsCount || s.capacity || 15}L</span>
                      </div>
                    )}

                    {s.type === 'round_buffet' && (
                      <div className="w-full h-full rounded-full border-2 border-amber-600 bg-amber-50/50 flex flex-col items-center justify-center shadow-xs overflow-hidden">
                        <RoundBuffetIcon className="w-4 h-4 text-amber-700 mb-0.5 flex-shrink-0" />
                        <span className="text-[8.5px] text-amber-900 font-bold truncate max-w-[90%] leading-none">{s.label}</span>
                      </div>
                    )}

                    {s.type === 'runway_stage' && (
                      <div className="w-full h-full rounded-lg border-2 border-muted-foreground bg-secondary flex flex-col items-center justify-center p-1 shadow-xs">
                        <RunwayStageIcon className="w-4 h-4 text-muted-foreground mb-0.5 flex-shrink-0" />
                        <span className="text-[8.5px] text-foreground font-bold truncate max-w-full leading-none">{s.label}</span>
                      </div>
                    )}

                    {s.type === 'backdrop' && (
                      <div className="w-full h-full rounded border-2 border-dashed border-rose-500 bg-rose-50/45 flex flex-col items-center justify-center p-1 shadow-xs">
                        <BackdropIcon className="w-4 h-4 text-rose-600 mb-0.5 flex-shrink-0" />
                        <span className="text-[8px] text-rose-900 font-bold truncate max-w-full leading-none">{s.label}</span>
                      </div>
                    )}

                    {s.type === 'foh_desk' && (
                      <div className="w-full h-full rounded-xl border border-primary bg-primary/10 flex flex-col items-center justify-center p-1 shadow-xs">
                        <FohDeskIcon className="w-4 h-4 text-primary mb-0.5 flex-shrink-0" />
                        <span className="text-[8.5px] text-foreground font-bold truncate max-w-full leading-none">{s.label}</span>
                      </div>
                    )}

                    {s.type === 'parking_spot' && (
                      <div className="w-full h-full rounded border-2 border-dashed border-muted-foreground/60 bg-secondary flex flex-col items-center justify-center p-1 shadow-xs">
                        <ParkingSpotIcon className="w-5 h-5 text-muted-foreground opacity-60 mb-0.5 flex-shrink-0" />
                        <span className="text-[8px] text-muted-foreground font-bold truncate max-w-full leading-none">{s.label}</span>
                      </div>
                    )}

                    {s.type === 'l_bar' && (
                      <div className="w-full h-full rounded-xl border-2 border-primary bg-primary/10 flex flex-col items-center justify-center p-1 shadow-sm">
                        <LBarIcon className="w-4 h-4 text-primary mb-0.5 flex-shrink-0" />
                        <span className="text-[8.5px] text-foreground font-bold truncate max-w-full leading-none">{s.label}</span>
                      </div>
                    )}

                    {s.type === 'u_bar' && (
                      <div className="w-full h-full rounded-xl border-2 border-primary bg-primary/10 flex flex-col items-center justify-center p-1 shadow-sm">
                        <UBarIcon className="w-4 h-4 text-primary mb-0.5 flex-shrink-0" />
                        <span className="text-[8.5px] text-foreground font-bold truncate max-w-full leading-none">{s.label}</span>
                      </div>
                    )}

                    {s.type === 'food_court' && (
                      <div className="w-full h-full rounded-xl border-2 border-orange-500 bg-orange-50/70 flex flex-col items-center justify-center p-1 shadow-sm">
                        <FoodCourtIcon className="w-5 h-5 text-orange-600 mb-0.5 flex-shrink-0" />
                        <span className="text-[9.5px] text-orange-950 font-bold truncate max-w-full leading-none">{s.label}</span>
                        <span className="text-[7.5px] text-orange-800 font-mono mt-0.5 leading-none">{s.widthMeter}x{s.heightMeter}m</span>
                      </div>
                    )}

                    {s.type === 'cloakroom' && (
                      <div className="w-full h-full rounded-xl border border-muted-foreground bg-secondary flex flex-col items-center justify-center p-1 shadow-xs">
                        <CloakroomIcon className="w-4 h-4 text-muted-foreground mb-0.5 flex-shrink-0" />
                        <span className="text-[8.5px] text-foreground font-bold truncate max-w-full leading-none">{s.label}</span>
                      </div>
                    )}

                    {s.type === 'large_tent' && (
                      <div 
                        className="w-full h-full border border-primary/40 bg-primary/10 flex items-center justify-center rounded-xl shadow-xs"
                        style={{ backgroundImage: 'linear-gradient(135deg, transparent 49%, hsl(var(--primary) / 0.2) 49%, hsl(var(--primary) / 0.2) 51%, transparent 51%), linear-gradient(45deg, transparent 49%, hsl(var(--primary) / 0.2) 49%, hsl(var(--primary) / 0.2) 51%, transparent 51%)' }}
                      >
                        <LargeTentIcon className="w-5 h-5 text-primary flex-shrink-0" />
                        <span className="absolute bottom-1 right-2 text-[7.5px] text-primary font-mono font-bold">{s.widthMeter}x{s.heightMeter}m</span>
                      </div>
                    )}

                    {s.type === 'ticket_office' && (
                      <div className="w-full h-full border-2 border-sky-500 bg-sky-50 rounded-xl flex flex-col items-center justify-center p-1 shadow-xs">
                        <TicketOfficeIcon className="w-4 h-4 text-sky-600 mb-0.5 flex-shrink-0" />
                        <span className="text-[8.5px] text-sky-900 font-bold uppercase truncate max-w-full leading-none">{s.label}</span>
                      </div>
                    )}

                    {s.type === 'container_toilet' && (
                      <div className="w-full h-full border border-cyan-500 bg-cyan-50/70 rounded-xl flex flex-col items-center justify-center p-1 shadow-xs">
                        <ContainerToiletIcon className="w-4 h-4 text-cyan-600 mb-0.5 flex-shrink-0" />
                        <span className="text-[7.5px] text-cyan-800 font-bold uppercase truncate max-w-full leading-none">{s.label}</span>
                      </div>
                    )}

                    {s.type === 'extinguisher' && (
                      <div className="w-full h-full rounded-full border border-red-500 bg-red-50 flex items-center justify-center shadow-xs">
                        <ExtinguisherIcon className="w-4 h-4 text-red-600 animate-pulse flex-shrink-0" />
                      </div>
                    )}

                    {/* Label suspensa com estilo inline de contraste garantido */}
                    {showLabels && !showLabelInline && (
                      <div 
                        className="absolute -top-5 left-1/2 -translate-x-1/2 px-2 py-0.5 text-[8px] rounded-md whitespace-nowrap pointer-events-none font-bold shadow-xs bg-foreground text-background"
                      >
                        {s.label}
                      </div>
                    )}

                    {/* Preço (badge) se selecionado */}
                    {isSelected && s.price > 0 && (
                      <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-primary text-primary-foreground text-[8px] rounded-full whitespace-nowrap pointer-events-none shadow-md border border-primary/30 font-bold">
                        R$ {s.price}
                      </div>
                    )}

                    {/* Lock */}
                    {s.locked && (
                      <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[var(--ev-warning)] rounded-full flex items-center justify-center shadow border border-card z-10">
                        <I.Cadeado className="w-2.5 h-2.5 text-background" />
                      </div>
                    )}

                    {/* ALÇA DE REDIMENSIONAMENTO INTERATIVA NO CANTO INFERIOR DIREITO (NWSE RESIZE) */}
                    {isSelected && !s.locked && (
                      <div 
                        className="absolute bottom-0 right-0 w-3 h-3 bg-primary border border-card rounded shadow cursor-se-resize z-30"
                        style={{ transform: 'translate(30%, 30%)' }}
                        onMouseDown={(e) => {
                          e.stopPropagation()
                          e.preventDefault()
                          setIsResizingNode(true)
                          const pos = getPos(e)
                          setResizeStartDims({
                            wMeter: s.widthMeter || toolDefaults[s.type]?.wMeter || 0.5,
                            hMeter: s.heightMeter || toolDefaults[s.type]?.hMeter || 0.5,
                            x: s.x,
                            y: s.y,
                            mouseX: pos.x,
                            mouseY: pos.y
                          })
                        }}
                      />
                    )}

                    {/* ALÇA DE ROTAÇÃO NO TOPO (ROTATE HANDLE) */}
                    {isSelected && !s.locked && (
                      <div 
                        className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-8 flex flex-col items-center cursor-alias z-30"
                        style={{ height: '32px' }}
                        onMouseDown={(e) => {
                          e.stopPropagation()
                          e.preventDefault()
                          
                          // Registra o estado inicial de rotação
                          const centerLogicalX = s.x
                          const centerLogicalY = s.y

                          const handleMouseMoveRotate = (moveEvent: MouseEvent) => {
                            const canvasMouse = getPos({
                              clientX: moveEvent.clientX,
                              clientY: moveEvent.clientY
                            })
                            const dx = canvasMouse.x - centerLogicalX
                            const dy = canvasMouse.y - centerLogicalY
                            
                            // Calcula o ângulo do cursor do mouse em relação ao centro do elemento
                            let angleDeg = Math.atan2(dy, dx) * (180 / Math.PI)
                            
                            // A alça está posicionada no topo (que seria -90 graus, ou seja, dy < 0, dx = 0).
                            // Queremos que arrastar direto para cima represente 0 graus em relação à rotação atual.
                            angleDeg = (angleDeg + 90) % 360
                            if (angleDeg < 0) angleDeg += 360
                            
                            // Snap se a opção snap estiver ativa ou com Shift
                            const shouldSnap = snap || moveEvent.shiftKey
                            const finalAngle = shouldSnap ? Math.round(angleDeg / 15) * 15 : Math.round(angleDeg)
                            
                            updateNode(s.id, { rotation: finalAngle })
                          }
                          
                          const handleMouseUpRotate = () => {
                            window.removeEventListener('mousemove', handleMouseMoveRotate)
                            window.removeEventListener('mouseup', handleMouseUpRotate)
                            // Salva no histórico ao finalizar a rotação
                            pushHistory(seats, walls)
                          }
                          
                          window.addEventListener('mousemove', handleMouseMoveRotate)
                          window.addEventListener('mouseup', handleMouseUpRotate)
                        }}
                      >
                        {/* Linha conectora */}
                        <div className="w-0.5 h-4 bg-primary" />
                        {/* Bolinha de arraste */}
                        <div className="w-4 h-4 bg-primary hover:bg-primary/90 border border-card rounded-full flex items-center justify-center shadow-glow transition-all scale-100 hover:scale-110 active:scale-95 pointer-events-auto">
                          <I.Restaurar className="w-2 h-2 text-background" />
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              )
            })}
          </div>

          {/* AJUDA DE NAVEGAÇÃO E DE ATALHOS */}
          {showHelp && (
            <div className="absolute bottom-4 left-4 bg-card/95 backdrop-blur-md border border-border rounded-2xl p-4 shadow-xl z-20 max-w-sm">
              <div className="flex items-start gap-2.5">
                <I.Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground leading-relaxed space-y-1">
                  <h4 className="font-bold text-foreground">Navegação e Customização:</h4>
                  <p><strong>Navegar:</strong> Rolar rodinha para <strong>Zoom</strong> · Segurar <strong>Espaço + mouse drag</strong> para movimentar (Pan) ou clicar com a rodinha do mouse.</p>
                  <p><strong>Redimensionar:</strong> Selecione o elemento e arraste o quadradinho azul no canto inferior dele.</p>
                  <p><strong>Muros:</strong> Clique consecutivos. ESC para finalizar. Shift alinha muros em linha reta.</p>
                </div>
                <button onClick={() => setShowHelp(false)} aria-label="Fechar" className="p-1 rounded hover:bg-foreground/5 text-muted-foreground hover:text-foreground"><I.Fechar className="w-3.5 h-3.5" aria-hidden="true" /></button>
              </div>
            </div>
          )}

          {/* INDICADOR DE FERRAMENTA ATIVA NO MOMENTO */}
          <div className="absolute top-4 right-4 px-3 py-2 bg-card/90 backdrop-blur-sm border border-border rounded-xl text-xs text-foreground flex items-center gap-2 z-20 shadow-md">
            {(() => { 
              const Icon = toolIcon(tool)
              return <Icon className="w-4 h-4 text-primary" /> 
            })()}
            <span className="font-bold">{typeLabels[tool]}</span>
            {tool !== 'select' && (
              <button 
                onClick={() => setTool('select')} 
                className="ml-2 text-[9px] uppercase font-bold bg-secondary text-muted-foreground hover:bg-foreground/5 hover:text-foreground px-1.5 py-0.5 rounded-lg"
              >
                Sair
              </button>
            )}
          </div>

          {/* MINIMAPA CLARO GLASSMORPHIC */}
          {showMinimap && (
            <div 
              className="absolute bottom-4 right-4 w-52 h-36 bg-card/90 backdrop-blur-md border border-border rounded-2xl shadow-xl z-20 overflow-hidden flex flex-col"
            >
              <div className="px-3 py-1.5 bg-secondary border-b border-border text-[9px] text-muted-foreground flex justify-between items-center font-bold">
                <span>Navegação Rápida</span>
                <span className="font-mono">60x60m</span>
              </div>
              <div 
                className="flex-1 relative cursor-pointer bg-secondary overflow-hidden"
                onClick={minimapNavigate}
              >
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {walls.map(w => (
                    <line
                      key={`mini-wall-${w.id}`}
                      x1={`${(w.x1 / 60) * 100}%`}
                      y1={`${(w.y1 / 60) * 100}%`}
                      x2={`${(w.x2 / 60) * 100}%`}
                      y2={`${(w.y2 / 60) * 100}%`}
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth="1.5"
                    />
                  ))}
                </svg>

                {seats.map(s => (
                  <div 
                    key={`mini-${s.id}`} 
                    className="absolute rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2 opacity-75"
                    style={{
                      left: `${(s.x / 60) * 100}%`, 
                      top: `${(s.y / 60) * 100}%`,
                      width: s.type === 'seat' ? 2 : 4, 
                      height: s.type === 'seat' ? 2 : 4,
                      background: s.color,
                    }} 
                  />
                ))}
                
                <div 
                  className="absolute border border-primary bg-primary/5 rounded pointer-events-none"
                  style={{
                    left: `${((-pan.x) / (canvasW * zoom)) * 100}%`,
                    top: `${((-pan.y) / (canvasH * zoom)) * 100}%`,
                    width: `${Math.min(100, (viewW / (canvasW * zoom)) * 100)}%`,
                    height: `${Math.min(100, (viewH / (canvasH * zoom)) * 100)}%`
                  }}
                />
              </div>
            </div>
          )}

          {/* Botão flutuante para recolher/expandir barra lateral esquerda (Ferramentas) */}
          <button
            onClick={() => setSidebarLeftOpen(!sidebarLeftOpen)}
            className={`absolute left-2.5 top-1/2 -translate-y-1/2 z-30 p-1.5 rounded-full bg-card border border-border shadow-lg text-muted-foreground hover:text-primary hover:bg-foreground/5 hover:scale-110 active:scale-95 transition-all pointer-events-auto flex items-center justify-center`}
            style={{ width: '30px', height: '30px' }}
            title={sidebarLeftOpen ? "Recolher ferramentas" : "Mostrar ferramentas"}
          >
            {sidebarLeftOpen ? <I.ChevronEsquerda className="w-4 h-4" /> : <I.ChevronDireita className="w-4 h-4" />}
          </button>

          {/* Botão flutuante para recolher/expandir barra lateral direita (Propriedades) */}
          <button
            onClick={() => setSidebarRightOpen(!sidebarRightOpen)}
            className={`absolute right-2.5 top-1/2 -translate-y-1/2 z-30 p-1.5 rounded-full bg-card border border-border shadow-lg text-muted-foreground hover:text-primary hover:bg-foreground/5 hover:scale-110 active:scale-95 transition-all pointer-events-auto flex items-center justify-center`}
            style={{ width: '30px', height: '30px' }}
            title={sidebarRightOpen ? "Recolher propriedades" : "Mostrar propriedades"}
          >
            {sidebarRightOpen ? <I.ChevronDireita className="w-4 h-4" /> : <I.ChevronEsquerda className="w-4 h-4" />}
          </button>
        </main>

        <aside className={`bg-card border-l border-border flex flex-col overflow-y-auto sidebar-dark-scroll flex-shrink-0 z-20 transition-all duration-300 min-w-0 ${sidebarRightOpen ? 'w-64 opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
          
          {/* Se houver algum elemento selecionado, exibe apenas as propriedades do elemento */}
          {(selected.length > 0 || selectedWallId) ? (
            <>
              {/* Botão de voltar fixo no topo do painel de propriedades */}
              <div className="p-3 border-b border-border bg-secondary flex items-center justify-between">
                <button 
                  onClick={() => { setSelected([]); setSelectedWallId(null); }}
                  className="flex items-center gap-1 text-[10px] font-bold text-primary hover:text-primary/80"
                >
                  <I.SetaEsquerda className="w-3.5 h-3.5" />
                  <span>Voltar ao Salão</span>
                </button>
                <span className="text-[9px] uppercase tracking-wider bg-secondary text-muted-foreground px-2 py-0.5 rounded font-bold">
                  Propriedades
                </span>
              </div>

              <div className="p-4 flex-1 space-y-4">
                <h3 className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  {selected.length > 1 ? `${selected.length} Selecionados` : selected.length === 1 ? 'Propriedades da Estrutura' : 'Propriedades do Muro'}
                </h3>

                {/* Um Elemento Selecionado */}
                {selected.length === 1 && (() => {
                  const node = seats.find(s => s.id === selected[0])
                  if (!node) return null
                  return (
                    <div className="space-y-3 text-xs text-muted-foreground">
                      
                      {/* CONFIGURAÇÃO DINÂMICA DE MESA INTELIGENTE */}
                      {node.type === 'table' && (
                        <div className="p-3 bg-primary/5 rounded-xl border border-primary/15 space-y-3 shadow-sm">
                          <span className="block text-[9px] text-primary font-bold uppercase tracking-wider">Layout de Mesa</span>
                          
                          {/* Formato da Mesa */}
                          <div>
                            <span className="block text-[8px] text-muted-foreground uppercase mb-1 font-bold">Formato da Mesa</span>
                            <div className="flex gap-1">
                              <button 
                                onClick={() => updateNode(node.id, { tableShape: 'circle' })}
                                className={`flex-1 py-1 rounded border text-[9px] font-bold ${node.tableShape === 'circle' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground'}`}
                              >
                                Redonda
                              </button>
                              <button 
                                onClick={() => updateNode(node.id, { tableShape: 'square' })}
                                className={`flex-1 py-1 rounded border text-[9px] font-bold ${node.tableShape === 'square' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground'}`}
                              >
                                Quadrada
                              </button>
                              <button 
                                onClick={() => updateNode(node.id, { tableShape: 'rectangle' })}
                                className={`flex-1 py-1 rounded border text-[9px] font-bold ${node.tableShape === 'rectangle' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground'}`}
                              >
                                Retangular
                              </button>
                            </div>
                          </div>

                          {/* Quantidade de Lugares */}
                          <div>
                            <div className="flex justify-between text-[8.5px] text-muted-foreground mb-1">
                              <span>Ajuste de Assentos:</span>
                              <span className="font-mono font-bold text-primary">{node.seatsCount || node.capacity} Lugares</span>
                            </div>
                            <input 
                              type="range"
                              min="2"
                              max="12"
                              step="1"
                              value={node.seatsCount || node.capacity}
                              onChange={e => {
                                const val = parseInt(e.target.value)
                                let idealDim = 1.2
                                if (val >= 10) idealDim = 2.2
                                else if (val >= 8) idealDim = 1.8
                                else if (val >= 6) idealDim = 1.5
                                else if (val >= 4) idealDim = 1.2
                                else idealDim = 0.9

                                updateNode(node.id, { 
                                  seatsCount: val, 
                                  capacity: val, 
                                  widthMeter: idealDim, 
                                  heightMeter: node.tableShape === 'rectangle' ? idealDim * 0.75 : idealDim
                                })
                              }}
                              className="w-full accent-primary"
                            />
                          </div>

                          {/* Presets Rápidos */}
                          <div className="space-y-1">
                            <span className="block text-[8px] text-muted-foreground uppercase font-bold">Presets Rápidos (Escala Automática)</span>
                            <div className="grid grid-cols-3 gap-1">
                              {[2, 4, 6, 8, 10, 12].map(num => {
                                let w = 1.2, h = 1.2
                                if (num === 2) { w = 0.9; h = 0.9 }
                                else if (num === 4) { w = 1.2; h = 1.2 }
                                else if (num === 6) { w = 1.6; h = 1.2 }
                                else if (num === 8) { w = 1.8; h = 1.8 }
                                else if (num === 10) { w = 2.2; h = 2.2 }
                                else if (num === 12) { w = 2.5; h = 2.5 }

                                const isCurrent = node.seatsCount === num
                                return (
                                  <button
                                    key={num}
                                    onClick={() => updateNode(node.id, {
                                      seatsCount: num,
                                      capacity: num,
                                      widthMeter: w,
                                      heightMeter: node.tableShape === 'rectangle' ? h : w
                                    })}
                                    className={`py-1 rounded border text-[9px] font-bold transition-all ${isCurrent ? 'bg-primary text-primary-foreground border-primary shadow-xs' : 'bg-card border-border text-muted-foreground hover:bg-foreground/5'}`}
                                  >
                                    {num} Lugares
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* CONFIGURAÇÃO DINÂMICA DE SOFÁ LOUNGE */}
                      {node.type === 'couch' && (
                        <div className="p-3 bg-primary/10 rounded-xl border border-primary/30 space-y-3 shadow-sm">
                          <span className="block text-[9px] text-primary font-bold uppercase tracking-wider">Sofá Lounge</span>
                          
                          <div>
                            <div className="flex justify-between text-[8.5px] text-foreground mb-1">
                              <span>Ajuste de Assentos:</span>
                              <span className="font-mono font-bold text-primary">{node.seatsCount || 3} Lugares</span>
                            </div>
                            <input 
                              type="range"
                              min="2"
                              max="5"
                              step="1"
                              value={node.seatsCount || 3}
                              onChange={e => {
                                const val = parseInt(e.target.value)
                                const idealWidth = val === 2 ? 1.4 : val === 3 ? 2.0 : val === 4 ? 2.6 : 3.2
                                updateNode(node.id, { 
                                  seatsCount: val, 
                                  capacity: val, 
                                  widthMeter: idealWidth 
                                })
                              }}
                              className="w-full accent-primary"
                            />
                          </div>

                          <div className="space-y-1">
                            <span className="block text-[8px] text-muted-foreground uppercase font-bold">Presets de Tamanho</span>
                            <div className="grid grid-cols-4 gap-1">
                              {[2, 3, 4, 5].map(num => {
                                const w = num === 2 ? 1.4 : num === 3 ? 2.0 : num === 4 ? 2.6 : 3.2
                                const isCurrent = node.seatsCount === num
                                return (
                                  <button
                                    key={num}
                                    onClick={() => updateNode(node.id, {
                                      seatsCount: num,
                                      capacity: num,
                                      widthMeter: w
                                    })}
                                    className={`py-1 rounded border text-[9px] font-bold transition-all ${isCurrent ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-primary/30 text-primary hover:bg-primary/10'}`}
                                  >
                                    {num} L
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Rotação e Tamanho (Medidas Reais) */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label htmlFor="rot-inp" className="block text-[9px] text-muted-foreground uppercase mb-1 font-bold">Rotação (°)</label>
                          <input 
                            id="rot-inp"
                            type="number" 
                            value={node.rotation} 
                            onChange={e => updateNode(node.id, { rotation: Number(e.target.value) })}
                            className="w-full px-3 py-1.5 bg-card border border-input rounded-xl text-foreground focus:outline-none focus-visible:border-[var(--ev-focus-field)] focus-visible:ring-[3px] focus-visible:ring-[var(--ev-brand-soft)] font-mono font-bold shadow-xs text-center text-xs" 
                          />
                        </div>
                        <div>
                          <label htmlFor="price-inp" className="block text-[9px] text-muted-foreground uppercase mb-1 font-bold">Preço (R$)</label>
                          <input 
                            id="price-inp"
                            type="number" 
                            value={node.price} 
                            onChange={e => updateNode(node.id, { price: Number(e.target.value) })}
                            className="w-full px-3 py-1.5 bg-card border border-input rounded-xl text-foreground focus:outline-none focus-visible:border-[var(--ev-focus-field)] focus-visible:ring-[3px] focus-visible:ring-[var(--ev-brand-soft)] font-mono font-bold shadow-xs text-center text-xs" 
                          />
                        </div>
                      </div>

                      {/* AJUSTE FINO DE TAMANHO VETORIAL */}
                      <div className="p-2.5 bg-secondary rounded-xl border border-border space-y-1.5 shadow-inner">
                        <span className="block text-[8px] text-primary font-bold uppercase tracking-wider">Medidas Reais (Metros)</span>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label htmlFor="w-meter-inp" className="block text-[7.5px] text-muted-foreground uppercase mb-0.5 font-semibold text-center">Largura (X)</label>
                            <input 
                              id="w-meter-inp"
                              type="number" 
                              step="0.05"
                              min="0.1"
                              value={node.widthMeter || toolDefaults[node.type]?.wMeter || 0.5} 
                              onChange={e => updateNode(node.id, { widthMeter: Math.max(0.1, parseFloat(e.target.value)) })}
                              className="w-full px-2 py-1 bg-card border border-input rounded-lg text-foreground font-mono font-bold text-center text-xs" 
                            />
                          </div>
                          <div>
                            <label htmlFor="h-meter-inp" className="block text-[7.5px] text-muted-foreground uppercase mb-0.5 font-semibold text-center">Comprim. (Y)</label>
                            <input 
                              id="h-meter-inp"
                              type="number" 
                              step="0.05"
                              min="0.1"
                              value={node.heightMeter || toolDefaults[node.type]?.hMeter || 0.5} 
                              onChange={e => updateNode(node.id, { heightMeter: Math.max(0.1, parseFloat(e.target.value)) })}
                              className="w-full px-2 py-1 bg-card border border-input rounded-lg text-foreground font-mono font-bold text-center text-xs" 
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label htmlFor="sec-sel" className="block text-[9px] text-muted-foreground uppercase mb-1 font-bold">Lote / Setor (Área)</label>
                        <select
                          id="sec-sel"
                          value={node.sectionId}
                          onChange={e => {
                            const secId = e.target.value
                            const section = sections.find(s => s.id === secId)
                            updateNode(node.id, { 
                              sectionId: secId,
                              color: section?.color || node.color,
                              price: section?.price !== undefined ? section.price : node.price
                            })
                          }}
                          className="w-full px-3 py-2 bg-card border border-input rounded-xl text-foreground focus:outline-none focus-visible:border-[var(--ev-focus-field)] focus-visible:ring-[3px] focus-visible:ring-[var(--ev-brand-soft)] shadow-xs font-bold"
                        >
                          {sections.map(s => (
                            <option key={s.id} value={s.id}>{s.name} (R$ {s.price})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label htmlFor="label-inp" className="block text-[9px] text-muted-foreground uppercase mb-1 font-bold">Identificação</label>
                        <input 
                          id="label-inp"
                          value={node.label} 
                          onChange={e => updateNode(node.id, { label: e.target.value })}
                          className="w-full px-3 py-2 bg-card border border-input rounded-xl text-foreground focus:outline-none focus-visible:border-[var(--ev-focus-field)] focus-visible:ring-[3px] focus-visible:ring-[var(--ev-brand-soft)] shadow-xs" 
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label htmlFor="col-inp" className="block text-[9px] text-muted-foreground uppercase mb-1 font-bold">Cor</label>
                          <input 
                            id="col-inp"
                            type="color" 
                            value={node.color} 
                            onChange={e => updateNode(node.id, { color: e.target.value })}
                            className="w-full h-8 bg-card border border-input rounded-xl cursor-pointer shadow-xs" 
                          />
                        </div>
                        <div>
                          <label htmlFor="status-sel" className="block text-[9px] text-muted-foreground uppercase mb-1 font-bold">Status</label>
                          <select 
                            id="status-sel"
                            value={node.status} 
                            onChange={e => updateNode(node.id, { status: e.target.value as SeatStatus })}
                            className="w-full px-2 py-2 bg-card border border-input rounded-xl text-foreground focus:outline-none focus-visible:border-[var(--ev-focus-field)] focus-visible:ring-[3px] focus-visible:ring-[var(--ev-brand-soft)] shadow-xs"
                          >
                            <option value="free">Livre</option>
                            <option value="sold">Vendido</option>
                            <option value="reserved">Reservado</option>
                            <option value="blocked">Bloqueado</option>
                            <option value="contact">Entrar em Contato</option>
                          </select>
                        </div>
                      </div>

                      {node.capacity > 0 && node.type !== 'table' && (
                        <div className="p-3 bg-secondary rounded-xl border border-border shadow-xs">
                          <span className="block text-[9px] text-muted-foreground uppercase mb-1 font-bold">Ingressos Vendidos</span>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="font-bold text-sm text-foreground font-mono">{node.sold || 0} / {node.capacity}</span>
                            <div className="flex gap-1">
                              <button onClick={() => { if (node.sold > 0) updateNode(node.id, { sold: node.sold - 1, status: node.sold - 1 <= 0 ? 'free' : 'reserved' }) }} className="w-7 h-7 flex items-center justify-center bg-card rounded-lg border border-border hover:bg-foreground/5 shadow-xs">-</button>
                              <button onClick={() => { if (node.sold < node.capacity) updateNode(node.id, { sold: node.sold + 1, status: node.sold + 1 >= node.capacity ? 'sold' : 'reserved' }) }} className="w-7 h-7 flex items-center justify-center bg-primary/10 text-primary rounded-lg border border-primary/30 hover:bg-primary/20 font-bold shadow-xs">+</button>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 pt-1">
                        <button onClick={() => updateNode(node.id, { locked: !node.locked })} className={`flex-1 py-2 rounded-xl border text-[10px] font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs ${node.locked ? 'bg-secondary border-border text-[var(--ev-warning)]' : 'bg-card border-border text-muted-foreground hover:bg-foreground/5'}`}>
                          {node.locked ? <I.Cadeado className="w-3.5 h-3.5" /> : <I.CadeadoAberto className="w-3.5 h-3.5" />} {node.locked ? 'Travado' : 'Destravado'}
                        </button>
                      </div>

                      <div className="flex gap-2 pt-2 border-t border-border">
                        <button onClick={() => dupElement(node.id)} className="flex-1 py-2 rounded-xl border border-border bg-card hover:bg-foreground/5 text-[10px] font-bold flex items-center justify-center gap-1 text-muted-foreground shadow-xs"><I.Copiar className="w-3.5 h-3.5" /> Duplicar</button>
                        <button onClick={() => delNode(node.id)} className="flex-1 py-2 rounded-xl border border-destructive/30 bg-destructive/10 hover:border-destructive/60 text-[10px] font-bold flex items-center justify-center gap-1 text-destructive shadow-xs"><I.Lixeira className="w-3.5 h-3.5" /> Remover</button>
                      </div>
                    </div>
                  )
                })()}

                {/* Múltiplos Elementos Selecionados */}
                {selected.length > 1 && (
                  <div className="space-y-3 text-xs text-muted-foreground">
                    <div className="grid grid-cols-4 gap-1">
                      <button onClick={() => updateMany(selected, { status: 'free' })} className="py-2 rounded-lg bg-secondary border border-border text-[var(--ev-success)] font-bold text-[8px] shadow-xs">Livre</button>
                      <button onClick={() => updateMany(selected, { status: 'sold' })} className="py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary font-bold text-[8px] shadow-xs">Vendido</button>
                      <button onClick={() => updateMany(selected, { status: 'blocked' })} className="py-2 rounded-lg bg-secondary border border-border text-muted-foreground font-bold text-[8px] shadow-xs">Bloq.</button>
                      <button onClick={() => updateMany(selected, { status: 'contact' })} className="py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary font-bold text-[8px] shadow-xs">Contato</button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => updateMany(selected, { locked: true })} className="py-2 rounded-lg bg-secondary border border-border text-[var(--ev-warning)] text-[10px] font-bold shadow-xs">Travar</button>
                      <button onClick={() => updateMany(selected, { locked: false })} className="py-2 rounded-lg bg-card border border-border text-muted-foreground text-[10px] font-bold shadow-xs">Destravar</button>
                    </div>

                    <div>
                      <label htmlFor="sec-many-sel" className="block text-[9px] text-muted-foreground uppercase mb-1 font-bold">Alterar Lote da Seleção</label>
                      <select
                        id="sec-many-sel"
                        value=""
                        onChange={e => {
                          const secId = e.target.value
                          if (!secId) return
                          const section = sections.find(s => s.id === secId)
                          updateMany(selected, { 
                            sectionId: secId,
                            ...(section ? { color: section.color, price: section.price } : {})
                          })
                          toast.success(`Setor alterado para ${selected.length} elementos.`)
                        }}
                        className="w-full px-3 py-2 bg-card border border-input rounded-xl text-foreground focus:outline-none focus-visible:border-[var(--ev-focus-field)] focus-visible:ring-[3px] focus-visible:ring-[var(--ev-brand-soft)] shadow-xs font-bold"
                      >
                        <option value="">-- Mudar todos para o Lote --</option>
                        {sections.map(s => (
                          <option key={s.id} value={s.id}>{s.name} (R$ {s.price})</option>
                        ))}
                      </select>
                    </div>

                    {/* Mesclagem de Estruturas */}
                    <div className="pt-2 border-t border-border">
                      <button
                        onClick={mergeSelectedNodes}
                        className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-[10px] flex items-center justify-center gap-1.5 shadow"
                      >
                        <I.Camadas className="w-3.5 h-3.5" />
                        Mesclar em Estrutura Única (Unir)
                      </button>
                    </div>

                    <div className="pt-2 border-t border-border space-y-2">
                      <span className="block text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Alinhamento Técnico</span>
                      <div className="grid grid-cols-3 gap-1">
                        <button onClick={() => align('left')} title="Alinhar à Esquerda" className="py-2 rounded-lg bg-card hover:bg-foreground/5 border border-border shadow-xs"><I.AlinharEsquerda className="w-4 h-4 mx-auto" /></button>
                        <button onClick={() => align('center')} title="Alinhar Centro Horizontal" className="py-2 rounded-lg bg-card hover:bg-foreground/5 border border-border shadow-xs"><I.AlinharCentro className="w-4 h-4 mx-auto" /></button>
                        <button onClick={() => align('right')} title="Alinhar à Direita" className="py-2 rounded-lg bg-card hover:bg-foreground/5 border border-border shadow-xs"><I.AlinharEsquerda className="w-4 h-4 mx-auto rotate-180" /></button>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        <button onClick={() => align('top')} title="Alinhar ao Topo" className="py-2 rounded-lg bg-card hover:bg-foreground/5 border border-border shadow-xs"><I.AlinharCentro className="w-4 h-4 mx-auto -rotate-90" /></button>
                        <button onClick={() => align('middle')} title="Alinhar Centro Vertical" className="py-2 rounded-lg bg-card hover:bg-foreground/5 border border-border shadow-xs"><I.AlinharCentro className="w-4 h-4 mx-auto" /></button>
                        <button onClick={() => align('bottom')} title="Alinhar Abaixo" className="py-2 rounded-lg bg-card hover:bg-foreground/5 border border-border shadow-xs"><I.AlinharCentro className="w-4 h-4 mx-auto rotate-90" /></button>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-border">
                      <button onClick={dupMany} className="flex-1 py-2 rounded-xl border border-border bg-card hover:bg-foreground/5 text-[10px] font-bold flex items-center justify-center gap-1 text-muted-foreground shadow-xs"><I.Copiar className="w-3.5 h-3.5" /> Duplicar</button>
                      <button onClick={delMany} className="flex-1 py-2 rounded-xl border border-destructive/30 bg-destructive/10 hover:border-destructive/60 text-[10px] font-bold flex items-center justify-center gap-1 text-destructive shadow-xs"><I.Lixeira className="w-3.5 h-3.5" /> Remover</button>
                    </div>
                  </div>
                )}

                {/* Muro selecionado */}
                {selectedWallId && (() => {
                  const wall = walls.find(w => w.id === selectedWallId)
                  if (!wall) return null
                  const len = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1)
                  return (
                    <div className="space-y-3 text-xs text-muted-foreground">
                      <div className="p-3 bg-secondary rounded-xl border border-border shadow-xs text-center">
                        <span className="block text-[9px] text-muted-foreground uppercase mb-0.5 font-bold">Comprimento do Muro</span>
                        <span className="text-base font-mono font-bold text-primary">{len.toFixed(2)} metros</span>
                      </div>

                      <div>
                        <label htmlFor="wall-thick-inp" className="block text-[9px] text-muted-foreground uppercase mb-1 font-bold">Espessura (m)</label>
                        <input 
                          id="wall-thick-inp"
                          type="number" 
                          step="0.05"
                          min="0.05"
                          max="1.0"
                          value={wall.thickness} 
                          onChange={e => updateWall(wall.id, { thickness: Math.max(0.05, parseFloat(e.target.value)) })}
                          className="w-full px-3 py-2 bg-card border border-input rounded-xl text-foreground focus:outline-none focus-visible:border-[var(--ev-focus-field)] focus-visible:ring-[3px] focus-visible:ring-[var(--ev-brand-soft)] font-mono font-bold text-center shadow-xs" 
                        />
                      </div>

                      <div>
                        <label htmlFor="wall-color-inp" className="block text-[9px] text-muted-foreground uppercase mb-1 font-bold">Cor do Muro</label>
                        <input 
                          id="wall-color-inp"
                          type="color" 
                          value={wall.color} 
                          onChange={e => updateWall(wall.id, { color: e.target.value })}
                          className="w-full h-8 bg-card border border-input rounded-xl cursor-pointer shadow-xs" 
                        />
                      </div>

                      <div className="flex gap-2 pt-2 border-t border-border">
                        <button onClick={() => updateWall(wall.id, { locked: !wall.locked })} className={`flex-1 py-2 rounded-xl border text-[10px] font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs ${wall.locked ? 'bg-secondary border-border text-[var(--ev-warning)]' : 'bg-card border-border text-muted-foreground hover:bg-foreground/5'}`}>
                          {wall.locked ? <I.Cadeado className="w-3.5 h-3.5" /> : <I.CadeadoAberto className="w-3.5 h-3.5" />} {wall.locked ? 'Travado' : 'Destravado'}
                        </button>
                        <button onClick={() => delWall(wall.id)} className="flex-1 py-2 rounded-xl border border-destructive/30 bg-destructive/10 hover:border-destructive/60 text-[10px] font-semibold flex items-center justify-center gap-1 text-destructive shadow-xs"><I.Lixeira className="w-3.5 h-3.5" /> Remover</button>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </>
          ) : (
            <>
              {/* Abas Superiores quando nada está selecionado */}
              <div className="flex border-b border-border bg-secondary p-1 gap-1">
                <button
                  onClick={() => setRightSidebarTab('pavilion')}
                  className={`flex-1 py-1.5 rounded-xl text-[10px] font-bold transition-all border ${rightSidebarTab === 'pavilion' ? 'bg-card text-primary border-border shadow-xs font-bold' : 'bg-transparent border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                  Medidas do Salão
                </button>
                <button
                  onClick={() => setRightSidebarTab('lotes')}
                  className={`flex-1 py-1.5 rounded-xl text-[10px] font-bold transition-all border ${rightSidebarTab === 'lotes' ? 'bg-card text-primary border-border shadow-xs font-bold' : 'bg-transparent border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                  Lotes & Preços
                </button>
              </div>

              <div className="p-3.5 flex-1 space-y-4">
                {rightSidebarTab === 'pavilion' ? (
                  <div className="space-y-4">
                    {/* Configurações do Pavilhão Físico */}
                    <div className="p-3 bg-secondary border border-border rounded-2xl space-y-3 shadow-xs">
                      <div className="flex items-center gap-1.5 text-primary border-b border-border pb-1.5">
                        <I.Empresa className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Espaço Físico / Pavilhão</span>
                      </div>

                      {/* Formato */}
                      <div className="space-y-1">
                        <span className="block text-[8px] text-muted-foreground uppercase font-bold">Formato do Salão</span>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button 
                            onClick={() => updateActiveEnv({ roomShape: 'rectangle' })}
                            className={`py-1 rounded-lg border text-[9px] font-bold transition-all ${roomShape === 'rectangle' ? 'bg-primary text-primary-foreground border-primary shadow-xs' : 'bg-card border-border text-muted-foreground hover:bg-foreground/5'}`}
                          >
                            Retangular
                          </button>
                          <button 
                            onClick={() => updateActiveEnv({ roomShape: 'l_shape' })}
                            className={`py-1 rounded-lg border text-[9px] font-bold transition-all ${roomShape === 'l_shape' ? 'bg-primary text-primary-foreground border-primary shadow-xs' : 'bg-card border-border text-muted-foreground hover:bg-foreground/5'}`}
                          >
                            Formato em L
                          </button>
                        </div>
                      </div>

                      {/* Dimensões */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-0.5">
                          <label htmlFor="env-w-inp" className="block text-[8px] text-muted-foreground uppercase font-bold text-center">Largura (X)</label>
                          <input 
                            id="env-w-inp"
                            type="number" 
                            value={roomWidth} 
                            onChange={e => updateActiveEnv({ roomWidth: Math.max(5, parseFloat(e.target.value) || 5) })}
                            className="w-full px-1.5 py-1 bg-card border border-input rounded-lg text-center font-mono font-bold text-xs" 
                          />
                        </div>
                        <div className="space-y-0.5">
                          <label htmlFor="env-h-inp" className="block text-[8px] text-muted-foreground uppercase font-bold text-center">Comprimento (Y)</label>
                          <input 
                            id="env-h-inp"
                            type="number" 
                            value={roomHeight} 
                            onChange={e => updateActiveEnv({ roomHeight: Math.max(5, parseFloat(e.target.value) || 5) })}
                            className="w-full px-1.5 py-1 bg-card border border-input rounded-lg text-center font-mono font-bold text-xs" 
                          />
                        </div>
                      </div>

                      {/* Dimensões L */}
                      {roomShape === 'l_shape' && (
                        <div className="grid grid-cols-2 gap-2 p-2 bg-secondary border border-border rounded-xl">
                          <div className="space-y-0.5">
                            <label htmlFor="env-lw-inp" className="block text-[7.5px] text-muted-foreground uppercase font-bold text-center">Perna (Largura)</label>
                            <input 
                              id="env-lw-inp"
                              type="number" 
                              value={roomLWidth} 
                              onChange={e => updateActiveEnv({ roomLWidth: Math.max(2, parseFloat(e.target.value) || 2) })}
                              className="w-full px-1 py-1 bg-card border border-input rounded-lg text-center font-mono font-bold text-[10px]" 
                            />
                          </div>
                          <div className="space-y-0.5">
                            <label htmlFor="env-lh-inp" className="block text-[7.5px] text-muted-foreground uppercase font-bold text-center">Perna (Compr.)</label>
                            <input 
                              id="env-lh-inp"
                              type="number" 
                              value={roomLHeight} 
                              onChange={e => updateActiveEnv({ roomLHeight: Math.max(2, parseFloat(e.target.value) || 2) })}
                              className="w-full px-1 py-1 bg-card border border-input rounded-lg text-center font-mono font-bold text-[10px]" 
                            />
                          </div>
                        </div>
                      )}

                      {/* Rotação Global */}
                      <div className="space-y-0.5">
                        <label htmlFor="env-rot-inp" className="block text-[8px] text-muted-foreground uppercase font-bold">Rotação Global</label>
                        <div className="flex items-center gap-2">
                          <input 
                            id="env-rot-inp"
                            type="range" 
                            min="0"
                            max="360"
                            value={roomRotation} 
                            onChange={e => updateActiveEnv({ roomRotation: parseInt(e.target.value) || 0 })}
                            className="flex-1 accent-primary cursor-pointer h-1 bg-input rounded-lg appearance-none" 
                          />
                          <input 
                            type="number" 
                            value={roomRotation} 
                            onChange={e => updateActiveEnv({ roomRotation: Math.min(360, Math.max(0, parseInt(e.target.value) || 0)) })}
                            className="w-10 px-1 py-0.5 bg-card border border-input rounded-lg text-center font-mono font-bold text-[10px]" 
                          />
                        </div>
                        <div className="grid grid-cols-4 gap-1 mt-1">
                          {[0, 90, 180, 270].map(deg => (
                            <button 
                              key={deg}
                              onClick={() => updateActiveEnv({ roomRotation: deg })}
                              className={`py-0.5 rounded border font-mono text-[8px] ${roomRotation === deg ? 'bg-primary/10 border-primary/30 text-primary font-bold' : 'bg-card border-border text-muted-foreground hover:bg-foreground/5'}`}
                            >
                              {deg}°
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Ajuste Rápido */}
                      <div className="space-y-1 border-t border-border pt-2">
                        <span className="block text-[8px] text-muted-foreground uppercase font-bold">Ajuste Rápido (Metros)</span>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="block text-[7px] text-muted-foreground font-bold text-center">Largura</span>
                            <div className="flex gap-1 mt-0.5">
                              <button onClick={() => updateActiveEnv({ roomWidth: Math.max(5, roomWidth - 5) })} className="flex-1 py-0.5 rounded bg-secondary border border-border hover:bg-foreground/5 text-[9px] font-bold text-muted-foreground">-5m</button>
                              <button onClick={() => updateActiveEnv({ roomWidth: roomWidth + 5 })} className="flex-1 py-0.5 rounded bg-primary/5 border border-primary/20 hover:bg-primary/10 text-[9px] font-bold text-primary">+5m</button>
                            </div>
                          </div>
                          <div>
                            <span className="block text-[7px] text-muted-foreground font-bold text-center">Comprimento</span>
                            <div className="flex gap-1 mt-0.5">
                              <button onClick={() => updateActiveEnv({ roomHeight: Math.max(5, roomHeight - 5) })} className="flex-1 py-0.5 rounded bg-secondary border border-border hover:bg-foreground/5 text-[9px] font-bold text-muted-foreground">-5m</button>
                              <button onClick={() => updateActiveEnv({ roomHeight: roomHeight + 5 })} className="flex-1 py-0.5 rounded bg-primary/5 border border-primary/20 hover:bg-primary/10 text-[9px] font-bold text-primary">+5m</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Planta Baixa de Fundo */}
                    <div className="p-3 bg-secondary border border-border rounded-2xl space-y-3 shadow-xs">
                      <div className="flex items-center gap-1.5 text-primary border-b border-border pb-1.5">
                        <I.ImagemMais className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Planta Baixa de Fundo</span>
                      </div>

                      {!bgImage ? (
                        <button 
                          onClick={triggerImageUpload}
                          className="w-full flex flex-col items-center justify-center gap-1.5 p-4 border-2 border-dashed border-border dark:border-input rounded-xl hover:border-primary/40 hover:bg-primary/5 transition-all text-center"
                        >
                          <I.ImagemMais className="w-6 h-6 text-muted-foreground" />
                          <span className="text-[9px] text-muted-foreground font-bold">Subir Planta Baixa</span>
                          <span className="text-[7.5px] text-muted-foreground">Referência visual e calibração</span>
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <div className="relative rounded-lg overflow-hidden border border-border shadow-xs">
                            <img src={bgImage} alt="Planta" className="w-full h-12 object-cover opacity-50" />
                            <button 
                              onClick={() => setBgImage(null)} 
                              className="absolute top-1 right-1 p-0.5 bg-destructive text-destructive-foreground rounded hover:bg-[var(--ev-danger-hover)] transition-colors shadow"
                            >
                              <I.Lixeira className="w-2.5 h-2.5" />
                            </button>
                          </div>

                          <div>
                            <div className="flex justify-between text-[8px] text-muted-foreground mb-0.5">
                              <span>Opacidade:</span>
                              <span className="font-mono font-bold text-foreground">{Math.round(bgOpacity * 100)}%</span>
                            </div>
                            <input 
                              type="range" 
                              min="10" 
                              max="100" 
                              value={Math.round(bgOpacity * 100)} 
                              onChange={e => setBgOpacity(Number(e.target.value) / 100)} 
                              className="w-full accent-primary h-1 bg-input rounded-lg appearance-none cursor-pointer" 
                            />
                          </div>

                          <div>
                            <div className="flex justify-between text-[8px] text-muted-foreground mb-0.5">
                              <span>Escala da planta:</span>
                              <span className="font-mono font-bold text-foreground">{Math.round(bgScale * 100)}%</span>
                            </div>
                            <input 
                              type="range" 
                              min="20" 
                              max="200" 
                              value={Math.round(bgScale * 100)} 
                              onChange={e => setBgScale(Number(e.target.value) / 100)} 
                              className="w-full accent-primary h-1 bg-input rounded-lg appearance-none cursor-pointer" 
                            />
                          </div>

                          <button
                            onClick={startScaleCalibration}
                            className={`w-full py-1.5 rounded-lg border text-[9px] font-bold flex items-center justify-center gap-1 transition-all shadow-xs ${calibrating ? 'bg-secondary border-border text-[var(--ev-warning)]' : 'bg-primary/10 border-primary/30 text-primary hover:border-primary/60'}`}
                          >
                            <I.Balanca className="w-3 h-3" />
                            {calibrating ? 'Marcando Pontos...' : 'Calibrar Escala Métrica'}
                          </button>

                          <Button size="xs" className="w-full" onClick={() => setAiReaderOpen(true)}>
                            <I.Destaque aria-hidden="true" />
                            Ler planta com IA
                          </Button>
                        </div>
                      )}
                      
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        accept="image/*,application/pdf" 
                        className="hidden" 
                        onChange={e => e.target.files?.[0] && uploadBgImage(e.target.files[0])} 
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Categorias / Lotes */}
                    <div className="p-3 bg-secondary border border-border rounded-2xl space-y-3 shadow-xs">
                      <div className="flex items-center gap-1.5 text-primary border-b border-border pb-1.5">
                        <I.Camadas className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Categoria / Lote Ativo</span>
                      </div>

                      <div className="space-y-1.5 max-h-[250px] overflow-y-auto pr-1 sidebar-dark-scroll">
                        {sections.map(s => {
                          const secSeats = seats.filter(st => st.sectionId === s.id)
                          const secCap = secSeats.reduce((sum, st) => sum + (st.capacity || 0), 0)
                          const secSold = secSeats.reduce((sum, st) => sum + (st.sold || 0), 0)
                          const isActive = activeSec === s.id
                          return (
                            <div 
                              key={s.id} 
                              className={`rounded-xl border transition-all shadow-xs overflow-hidden ${isActive ? 'bg-primary/5 border-primary/30 text-primary' : 'bg-card border-border text-muted-foreground'}`}
                            >
                              <div 
                                onClick={() => setActiveSec(s.id)}
                                className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer hover:bg-foreground/5 transition-all select-none"
                              >
                                <div className="w-3 h-3 rounded-full flex-shrink-0 border border-white/20 shadow-xs" style={{ background: s.color }} />
                                <div className="flex-1 text-left min-w-0">
                                  <div className="font-bold truncate text-[11px] text-foreground">{s.name}</div>
                                  <div className="text-[8.5px] text-muted-foreground mt-0.5">R$ {s.price} · {secSold}/{secCap} vend.</div>
                                  {!s.ticketTypeId && <div className="text-[8.5px] text-destructive mt-0.5">Não vende (sem ingresso ligado)</div>}
                                </div>
                                {isActive && <I.Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                              </div>

                              {isActive && (
                                <div className="px-2.5 pb-2.5 pt-1 border-t border-border bg-card/40 space-y-1.5 text-[10px]">
                                  <div>
                                    <label htmlFor={`sec-name-inp-${s.id}`} className="block text-[7.5px] text-muted-foreground uppercase font-bold mb-0.5">Nome do Lote</label>
                                    <input 
                                      id={`sec-name-inp-${s.id}`}
                                      type="text"
                                      value={s.name}
                                      onChange={(e) => {
                                        const newName = e.target.value
                                        setSections(prev => prev.map(sec => sec.id === s.id ? { ...sec, name: newName } : sec))
                                        setSeats(prev => prev.map(st => st.sectionId === s.id ? { ...st, sectionName: newName } : st))
                                      }}
                                      className="w-full px-1.5 py-1 bg-card border border-input rounded-lg text-xs text-foreground focus:outline-none focus-visible:border-[var(--ev-focus-field)] focus-visible:ring-[3px] focus-visible:ring-[var(--ev-brand-soft)]"
                                    />
                                  </div>

                                  <div>
                                    <label htmlFor={`sec-ticket-sel-${s.id}`} className="block text-[7.5px] text-muted-foreground uppercase font-bold mb-0.5">Ingresso deste setor</label>
                                    <select
                                      id={`sec-ticket-sel-${s.id}`}
                                      value={s.ticketTypeId || ''}
                                      onChange={(e) => {
                                        const tt = tiposIngresso.find(t => t.id === e.target.value)
                                        // o preço mostrado vem do ingresso; quem manda no valor cobrado é o ingresso, não o mapa
                                        setSections(prev => prev.map(sec => sec.id === s.id ? { ...sec, ticketTypeId: tt?.id, ...(tt ? { price: tt.price } : {}) } : sec))
                                        if (tt) setSeats(prev => prev.map(st => st.sectionId === s.id ? { ...st, price: tt.price } : st))
                                      }}
                                      className="w-full px-1.5 py-1 bg-card border border-input rounded-lg text-xs text-foreground focus:outline-none focus-visible:border-[var(--ev-focus-field)] focus-visible:ring-[3px] focus-visible:ring-[var(--ev-brand-soft)]"
                                    >
                                      <option value="">Não vende (sem ingresso ligado)</option>
                                      {!tiposCarregados && s.ticketTypeId && (
                                        <option value={s.ticketTypeId}>Ingresso ligado (lista ainda não carregada)</option>
                                      )}
                                      {tiposCarregados && s.ticketTypeId && !tiposIngresso.some(t => t.id === s.ticketTypeId) && (
                                        <option value={s.ticketTypeId}>Ingresso indisponível (inativo, coletiva ou removido)</option>
                                      )}
                                      {tiposIngresso.map(t => <option key={t.id} value={t.id}>{t.name} (R$ {t.price})</option>)}
                                    </select>
                                  </div>

                                  <div className="grid grid-cols-2 gap-1.5">
                                    <div>
                                      <label htmlFor={`sec-price-inp-${s.id}`} className="block text-[7.5px] text-muted-foreground uppercase font-bold mb-0.5">Preço (R$)</label>
                                      <input 
                                        id={`sec-price-inp-${s.id}`}
                                        type="number"
                                        value={s.price}
                                        onChange={(e) => {
                                          const newPrice = Number(e.target.value) || 0
                                          setSections(prev => prev.map(sec => sec.id === s.id ? { ...sec, price: newPrice } : sec))
                                          setSeats(prev => prev.map(st => st.sectionId === s.id ? { ...st, price: newPrice } : st))
                                        }}
                                        className="w-full px-1.5 py-1 bg-card border border-input rounded-lg text-xs text-foreground focus:outline-none focus-visible:border-[var(--ev-focus-field)] focus-visible:ring-[3px] focus-visible:ring-[var(--ev-brand-soft)] font-mono"
                                      />
                                    </div>
                                    <div>
                                      <label htmlFor={`sec-color-inp-${s.id}`} className="block text-[7.5px] text-muted-foreground uppercase font-bold mb-0.5">Cor</label>
                                      <div className="flex gap-1 items-center">
                                        <input 
                                          id={`sec-color-inp-${s.id}`}
                                          type="color"
                                          value={s.color}
                                          onChange={(e) => {
                                            const newColor = e.target.value
                                            setSections(prev => prev.map(sec => sec.id === s.id ? { ...sec, color: newColor } : sec))
                                            setSeats(prev => prev.map(st => st.sectionId === s.id ? { ...st, color: newColor } : st))
                                          }}
                                          className="w-6 h-5 p-0 border border-input rounded cursor-pointer"
                                        />
                                        <span className="text-[8px] font-mono text-muted-foreground uppercase truncate">{s.color}</span>
                                      </div>
                                    </div>
                                  </div>

                                  {sections.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const otherSec = sections.find(sec => sec.id !== s.id)
                                        if (!otherSec) return

                                        const nextSections = sections.filter(sec => sec.id !== s.id)
                                        setSections(nextSections)
                                        setActiveSec(otherSec.id)

                                        const nextSeats = seats.map(st => {
                                          if (st.sectionId === s.id) {
                                            return { 
                                              ...st, 
                                              sectionId: otherSec.id, 
                                              sectionName: otherSec.name,
                                              price: otherSec.price,
                                              color: otherSec.color
                                            }
                                          }
                                          return st
                                        })
                                        setSeats(nextSeats)
                                        pushHistory(nextSeats, walls)
                                        toast.success(`Lote excluído. Assentos migrados para o lote "${otherSec.name}".`)
                                      }}
                                      className="w-full flex items-center justify-center gap-1 py-1 rounded-lg border border-destructive/30 bg-destructive/10 text-[9px] text-destructive font-bold hover:border-destructive/60 transition-all active:scale-95"
                                    >
                                      <I.Lixeira className="w-2.5 h-2.5" /> Excluir Lote
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>

                      <button 
                        onClick={() => {
                          const id = `sec-${Date.now()}`
                          const color = sectionColors[sections.length % sectionColors.length]
                          const nextSections = [...sections, { id, name: `Lote ${sections.length + 1}`, color, price: 100 }]
                          setSections(nextSections)
                          setActiveSec(id)
                        }} 
                        className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 rounded-lg border border-dashed border-border dark:border-input text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-foreground/5 transition-all shadow-xs font-bold"
                      >
                        <I.Criar className="w-3 h-3" /> Nova Categoria
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </aside>

      </div>

      {/* FOOTER INFERIOR */}
      <footer className="w-full max-w-full flex items-center gap-5 px-6 py-2 border-t border-border bg-card z-30 shadow-md text-xs text-muted-foreground overflow-x-auto overflow-y-hidden flex-nowrap whitespace-nowrap min-w-0 flex-shrink-0">
        <span className="flex items-center gap-1.5"><I.Lugar className="w-3.5 h-3.5 text-primary" /> Assentos Totais: <strong>{totalCap}</strong></span>
        <span className="flex items-center gap-1.5"><I.Quadrado className="w-3.5 h-3.5 text-[var(--ev-warning)]" /> Mesas: <strong>{totalTables}</strong></span>
        <span className="flex items-center gap-1.5"><I.Grade className="w-3.5 h-3.5 text-muted-foreground" /> Muros: <strong>{totalWalls}</strong></span>
        <div className="w-px h-4 bg-muted" />
        <span className="flex items-center gap-1.5"><I.Check className="w-3.5 h-3.5 text-[var(--ev-success)]" /> Vendido: <strong>{totalSold} / {totalCap}</strong></span>
        <span className="flex items-center gap-1.5"><I.Info className="w-3.5 h-3.5 text-[var(--ev-warning)]" /> Reservado: <strong>{reservedCount}</strong></span>
        
        <div className="ml-auto font-mono text-primary flex items-center gap-3">
          <span>Receita: <strong>R$ {revenue.toLocaleString('pt-BR')}</strong></span>
          <span className="opacity-30">|</span>
          <span className="text-muted-foreground">Potencial: <strong>R$ {potential.toLocaleString('pt-BR')}</strong></span>
        </div>
      </footer>

      {/* LEITOR DE PLANTA COM IA: 1) escolher a planta e ler; 2) revisar a proposta por cima da planta e aplicar */}
      {aiReaderOpen && !propostaAtual && (
        <div className="fixed inset-0 glass-backdrop flex items-center justify-center z-50 p-4">
          <div role="dialog" aria-label="Leitor de planta com IA" className="glass-panel w-full max-w-md overflow-hidden animate-float-in text-foreground">
            <div className="flex justify-between items-center px-5 py-4 border-b border-border bg-secondary">
              <h3 className="text-base font-bold flex items-center gap-2">
                <I.Destaque className="w-5 h-5 text-primary" />
                Leitor de planta com IA
              </h3>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Fechar"
                onClick={() => setAiReaderOpen(false)}
              >
                <I.Fechar />
              </Button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Suba a planta do local em <strong>imagem (PNG, JPG, WebP)</strong> ou <strong>PDF</strong> (só a página 1). Ela vira a planta de fundo do editor.
                Depois a IA do Evo <strong>propõe</strong> peças (mesas, palco, bares, portas…) por cima dela. Você revisa e só então aplica ao mapa.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                É uma proposta: a IA pode errar ou deixar peças de fora, então confira. Para a leitura, a imagem da planta é enviada ao serviço de IA do Evo (Google Gemini).
              </p>

              <Button variant="outline" className="w-full" onClick={triggerImageUpload} disabled={lendo}>
                <I.ImagemMais className="text-primary" />
                {bgImage ? 'Trocar a planta (imagem ou PDF)' : 'Subir imagem ou PDF'}
              </Button>

              {bgImage ? (
                <div className="p-3 bg-secondary border border-border rounded-xl flex items-center gap-2.5">
                  <I.Check className="w-4 h-4 text-[var(--ev-success)] flex-shrink-0" />
                  <span className="text-xs text-[var(--ev-success)] font-bold">Planta carregada no fundo do editor.</span>
                </div>
              ) : (
                <div className="p-3 bg-secondary border border-border rounded-xl text-xs text-muted-foreground font-bold">
                  Nenhuma planta carregada ainda.
                </div>
              )}

              <Button className="w-full" onClick={lerPlantaComIA} disabled={!bgImage || !eventId || lendo}>
                {lendo ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-current/30 border-t-current animate-spin" />
                    Lendo a planta… pode levar até 2 minutos
                  </>
                ) : (
                  <>
                    <I.Destaque />
                    Ler com IA (usa {creditos(CUSTO_LEITURA)} do Evo)
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {aiReaderOpen && propostaAtual && (() => {
        const porTipo = contarPorTipo(propostaAtual.pecas)
        const marcadas = propostaAtual.pecas.filter(p => p.marcada).length
        return (
          <div role="dialog" aria-label="Revisar a proposta da IA" className="glass-panel fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[min(92vw,28rem)] max-h-[55vh] overflow-y-auto p-4 space-y-3 text-foreground shadow-xl">
            <div className="flex justify-between items-start gap-3">
              <div>
                <h3 className="font-serif text-sm font-bold flex items-center gap-2">
                  <I.Destaque className="w-4 h-4 text-primary" />
                  Revise a proposta da IA
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {marcadas} de {propostaAtual.pecas.length} peças marcadas. Clique numa peça sobre a planta para marcar ou desmarcar.
                  {typeof propostaAtual.restante === 'number' && ` Esta leitura gastou ${creditos(propostaAtual.custo ?? CUSTO_LEITURA)}; restam ${propostaAtual.restante}.`}
                </p>
              </div>
              <Button variant="ghost" size="icon-sm" aria-label="Descartar a proposta e fechar" onClick={() => { setProposta(null); setAiReaderOpen(false) }}>
                <I.Fechar />
              </Button>
            </div>

            <ul className="space-y-1">
              {Object.entries(porTipo).map(([tipo, c]) => (
                <li key={tipo} className="flex items-center justify-between gap-2 text-xs">
                  <span><strong className="font-mono">{c.marcadas}</strong>/{c.total} {typeLabels[tipo as ToolType]}</span>
                  <button
                    onClick={() => setProposta({ ...propostaAtual, pecas: alternarTipo(propostaAtual.pecas, tipo) })}
                    className="text-[11px] font-bold text-primary hover:underline"
                  >
                    {c.marcadas === c.total ? 'Desmarcar tipo' : 'Marcar tipo'}
                  </button>
                </li>
              ))}
            </ul>

            {pixelsPerMeter === ESCALA_PADRAO && (
              <p className="text-[11px] leading-relaxed bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-2">
                A escala ainda não foi calibrada. Calibre antes de aplicar (<strong>Calibrar Escala Métrica</strong>, na barra lateral): calibrar depois muda os metros e desalinha as peças da planta.
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => { setProposta(null); setAiReaderOpen(false) }}>
                Descartar
              </Button>
              <Button className="flex-1" onClick={aplicarProposta} disabled={marcadas === 0 || !bgNatural}>
                Aplicar ao mapa ({marcadas})
              </Button>
            </div>
          </div>
        )
      })()}

      {/* MODAL GERADOR DE LAYOUT INTELIGENTE */}
      {autoLayoutModalOpen && (
        <div className="fixed inset-0 glass-backdrop flex items-center justify-center z-50 p-4">
          <div className="glass-panel w-full max-w-lg overflow-hidden animate-float-in text-foreground">
            <div className="flex justify-between items-center px-5 py-4 border-b border-border bg-secondary">
              <h3 className="text-base font-bold flex items-center gap-2">
                <I.Grade className="w-5 h-5 text-primary" />
                Gerador de Layout Inteligente
              </h3>
              <Button variant="ghost" size="icon-sm" aria-label="Fechar" onClick={() => setAutoLayoutModalOpen(false)}>
                <I.Fechar />
              </Button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[80vh] space-y-4 sidebar-dark-scroll text-xs">
              <p className="text-muted-foreground leading-relaxed">
                Configure os parâmetros físicos reais do seu evento. O sistema calculará e montará os muros externos, o palco, as saídas e distribuirá as mesas automaticamente respeitando as diretrizes de segurança e circulação.
              </p>

              {/* 1. Dimensões do Espaço */}
              <div className="bg-secondary p-3 rounded-xl border border-border space-y-2">
                <span className="block text-[9px] font-bold text-primary uppercase tracking-wider">1. Dimensões do Espaço (Metros)</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="space-w" className="block text-[8px] text-muted-foreground uppercase mb-1 font-bold">Largura do Espaço (X)</label>
                    <input 
                      id="space-w"
                      type="number"
                      min="10"
                      max="300"
                      value={autoLayoutConfig.width}
                      onChange={e => setAutoLayoutConfig(prev => ({ ...prev, width: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-2.5 py-1.5 bg-card border border-input rounded-lg text-center font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label htmlFor="space-h" className="block text-[8px] text-muted-foreground uppercase mb-1 font-bold">Comprimento do Espaço (Y)</label>
                    <input 
                      id="space-h"
                      type="number"
                      min="10"
                      max="300"
                      value={autoLayoutConfig.height}
                      onChange={e => setAutoLayoutConfig(prev => ({ ...prev, height: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-2.5 py-1.5 bg-card border border-input rounded-lg text-center font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Tipo de Layout e Elementos */}
              <div className="bg-secondary p-3 rounded-xl border border-border space-y-3">
                <span className="block text-[9px] font-bold text-primary uppercase tracking-wider">2. Tipo de Layout & Assentos</span>
                
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAutoLayoutConfig(prev => ({ ...prev, layoutType: 'tables' }))}
                    className={`py-2 rounded-lg font-bold border transition-all ${autoLayoutConfig.layoutType === 'tables' ? 'bg-primary/10 border-primary text-primary font-bold' : 'bg-card border-border text-muted-foreground'}`}
                  >
                    Banquete (Mesas)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAutoLayoutConfig(prev => ({ ...prev, layoutType: 'seats' }))}
                    className={`py-2 rounded-lg font-bold border transition-all ${autoLayoutConfig.layoutType === 'seats' ? 'bg-primary/10 border-primary text-primary font-bold' : 'bg-card border-border text-muted-foreground'}`}
                  >
                    Auditório (Cadeiras)
                  </button>
                </div>

                {autoLayoutConfig.layoutType === 'tables' ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label htmlFor="tbl-count" className="block text-[8px] text-muted-foreground uppercase mb-1 font-bold">Qtd. de Mesas</label>
                        <input 
                          id="tbl-count"
                          type="number"
                          min="1"
                          max="500"
                          value={autoLayoutConfig.tableCount}
                          onChange={e => setAutoLayoutConfig(prev => ({ ...prev, tableCount: parseInt(e.target.value) || 0 }))}
                          className="w-full px-2 py-1.5 bg-card border border-input rounded-lg text-center font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label htmlFor="tbl-shape" className="block text-[8px] text-muted-foreground uppercase mb-1 font-bold">Formato</label>
                        <select 
                          id="tbl-shape"
                          value={autoLayoutConfig.tableShape}
                          onChange={e => {
                            const shape = e.target.value as any
                            const isRet = shape === 'rectangle'
                            setAutoLayoutConfig(prev => ({ 
                              ...prev, 
                              tableShape: shape, 
                              tableWidth: isRet ? 3.0 : 1.8, 
                              tableHeight: isRet ? 1.0 : 1.8 
                            }))
                          }}
                          className="w-full px-2 py-1.5 bg-card border border-input rounded-lg font-bold"
                        >
                          <option value="circle">Redonda</option>
                          <option value="square">Quadrada</option>
                          <option value="rectangle">Retangular</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="tbl-seats" className="block text-[8px] text-muted-foreground uppercase mb-1 font-bold">Assentos / Mesa</label>
                        <input 
                          id="tbl-seats"
                          type="number"
                          min="2"
                          max="12"
                          value={autoLayoutConfig.tableSeats}
                          onChange={e => setAutoLayoutConfig(prev => ({ ...prev, tableSeats: parseInt(e.target.value) || 0 }))}
                          className="w-full px-2 py-1.5 bg-card border border-input rounded-lg text-center font-mono font-bold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="tbl-w" className="block text-[8px] text-muted-foreground uppercase mb-1 font-bold">Largura / Diâmetro (m)</label>
                        <input 
                          id="tbl-w"
                          type="number"
                          step="0.1"
                          min="0.5"
                          value={autoLayoutConfig.tableWidth}
                          onChange={e => setAutoLayoutConfig(prev => ({ ...prev, tableWidth: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-2 py-1.5 bg-card border border-input rounded-lg text-center font-mono font-bold"
                        />
                      </div>
                      {autoLayoutConfig.tableShape === 'rectangle' && (
                        <div>
                          <label htmlFor="tbl-h" className="block text-[8px] text-muted-foreground uppercase mb-1 font-bold">Comprimento (m)</label>
                          <input 
                            id="tbl-h"
                            type="number"
                            step="0.1"
                            min="0.5"
                            value={autoLayoutConfig.tableHeight}
                            onChange={e => setAutoLayoutConfig(prev => ({ ...prev, tableHeight: parseFloat(e.target.value) || 0 }))}
                            className="w-full px-2 py-1.5 bg-card border border-input rounded-lg text-center font-mono font-bold"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label htmlFor="seat-count" className="block text-[8px] text-muted-foreground uppercase mb-1 font-bold">Quantidade total de Cadeiras</label>
                    <input 
                      id="seat-count"
                      type="number"
                      min="1"
                      max="1000"
                      value={autoLayoutConfig.seatsCount}
                      onChange={e => setAutoLayoutConfig(prev => ({ ...prev, seatsCount: parseInt(e.target.value) || 0 }))}
                      className="w-full px-2.5 py-1.5 bg-card border border-input rounded-lg text-center font-mono font-bold"
                    />
                  </div>
                )}
              </div>

              {/* 3. Distribuição & Espaçamento */}
              <div className="bg-secondary p-3 rounded-xl border border-border space-y-3">
                <span className="block text-[9px] font-bold text-primary uppercase tracking-wider">3. Distribuição & Espaçamento</span>
                
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label htmlFor="rows-count" className="block text-[8px] text-muted-foreground uppercase mb-1 font-bold">Fileiras (0=Aut)</label>
                    <input 
                      id="rows-count"
                      type="number"
                      min="0"
                      max="100"
                      value={autoLayoutConfig.rowsCount}
                      onChange={e => setAutoLayoutConfig(prev => ({ ...prev, rowsCount: parseInt(e.target.value) || 0 }))}
                      className="w-full px-2 py-1.5 bg-card border border-input rounded-lg text-center font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label htmlFor="spacing-x" className="block text-[8px] text-muted-foreground uppercase mb-1 font-bold">Espaçamento X (m)</label>
                    <input 
                      id="spacing-x"
                      type="number"
                      step="0.1"
                      min="0.2"
                      value={autoLayoutConfig.spacingX}
                      onChange={e => setAutoLayoutConfig(prev => ({ ...prev, spacingX: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-2 py-1.5 bg-card border border-input rounded-lg text-center font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label htmlFor="spacing-y" className="block text-[8px] text-muted-foreground uppercase mb-1 font-bold">Espaçamento Y (m)</label>
                    <input 
                      id="spacing-y"
                      type="number"
                      step="0.1"
                      min="0.2"
                      value={autoLayoutConfig.spacingY}
                      onChange={e => setAutoLayoutConfig(prev => ({ ...prev, spacingY: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-2 py-1.5 bg-card border border-input rounded-lg text-center font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={autoLayoutConfig.hasCentralAisle} 
                      onChange={e => setAutoLayoutConfig(prev => ({ ...prev, hasCentralAisle: e.target.checked }))}
                      className="rounded accent-primary" 
                    />
                    <span className="text-[10px] font-bold">Adicionar Corredor Central (Vão de 2.5m)</span>
                  </label>
                </div>
              </div>

              {/* 4. Palco */}
              <div className="bg-secondary p-3 rounded-xl border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="block text-[9px] font-bold text-primary uppercase tracking-wider">4. Configuração do Palco</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={autoLayoutConfig.hasStage} 
                      onChange={e => setAutoLayoutConfig(prev => ({ ...prev, hasStage: e.target.checked }))}
                      className="rounded accent-primary" 
                    />
                    <span className="text-[10px] font-bold">Adicionar Palco</span>
                  </label>
                </div>
                
                {autoLayoutConfig.hasStage && (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label htmlFor="stg-w" className="block text-[8px] text-muted-foreground uppercase mb-1 font-bold">Largura (m)</label>
                      <input 
                        id="stg-w"
                        type="number"
                        min="3"
                        value={autoLayoutConfig.stageWidth}
                        onChange={e => setAutoLayoutConfig(prev => ({ ...prev, stageWidth: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-2 py-1.5 bg-card border border-input rounded-lg text-center font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label htmlFor="stg-h" className="block text-[8px] text-muted-foreground uppercase mb-1 font-bold">Comprim. (m)</label>
                      <input 
                        id="stg-h"
                        type="number"
                        min="2"
                        value={autoLayoutConfig.stageHeight}
                        onChange={e => setAutoLayoutConfig(prev => ({ ...prev, stageHeight: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-2 py-1.5 bg-card border border-input rounded-lg text-center font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label htmlFor="stg-pos" className="block text-[8px] text-muted-foreground uppercase mb-1 font-bold">Posição</label>
                      <select 
                        id="stg-pos"
                        value={autoLayoutConfig.stagePosition}
                        onChange={e => setAutoLayoutConfig(prev => ({ ...prev, stagePosition: e.target.value as any }))}
                        className="w-full px-2 py-1.5 bg-card border border-input rounded-lg font-bold"
                      >
                        <option value="Norte">Norte (Topo)</option>
                        <option value="Sul">Sul (Base)</option>
                        <option value="Leste">Leste (Direita)</option>
                        <option value="Oeste">Oeste (Esquerda)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Estruturas de Apoio */}
              <div className="bg-secondary p-3 rounded-xl border border-border space-y-2">
                <span className="block text-[9px] font-bold text-primary uppercase tracking-wider">4. Infraestrutura de Apoio</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label htmlFor="cfg-bars" className="block text-[8px] text-muted-foreground uppercase mb-1 font-bold">Bares</label>
                    <input 
                      id="cfg-bars"
                      type="number"
                      min="0"
                      value={autoLayoutConfig.barsCount}
                      onChange={e => setAutoLayoutConfig(prev => ({ ...prev, barsCount: parseInt(e.target.value) || 0 }))}
                      className="w-full px-2 py-1.5 bg-card border border-input rounded-lg text-center font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label htmlFor="cfg-wcs" className="block text-[8px] text-muted-foreground uppercase mb-1 font-bold">Banheiros (WC)</label>
                    <input 
                      id="cfg-wcs"
                      type="number"
                      min="0"
                      value={autoLayoutConfig.wcCount}
                      onChange={e => setAutoLayoutConfig(prev => ({ ...prev, wcCount: parseInt(e.target.value) || 0 }))}
                      className="w-full px-2 py-1.5 bg-card border border-input rounded-lg text-center font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label htmlFor="cfg-exits" className="block text-[8px] text-muted-foreground uppercase mb-1 font-bold">Saídas Emerg.</label>
                    <input 
                      id="cfg-exits"
                      type="number"
                      min="1"
                      value={autoLayoutConfig.emergencyExits}
                      onChange={e => setAutoLayoutConfig(prev => ({ ...prev, emergencyExits: parseInt(e.target.value) || 0 }))}
                      className="w-full px-2 py-1.5 bg-card border border-input rounded-lg text-center font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Botões */}
              <div className="flex gap-3 pt-3 border-t border-border">
                <Button variant="outline" className="flex-1" onClick={() => setAutoLayoutModalOpen(false)}>
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={generateAutoLayout}>
                  Gerar Layout Inteligente
                </Button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* DIÁLOGO DE CALIBRAÇÃO */}
      {showCalibrationDialog && (
        <div className="fixed inset-0 glass-backdrop flex items-center justify-center z-50 p-4">
          <div className="glass-panel w-full max-w-sm overflow-hidden p-5 text-foreground">
            <h3 className="text-base font-bold mb-2 flex items-center gap-2">
              <I.Balanca className="w-5 h-5 text-primary" />
              Medida Real do Espaço
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              Qual é o comprimento real em metros da linha que você acabou de marcar na planta de fundo?
            </p>
            <div className="space-y-3">
              <div>
                <label htmlFor="calib-len" className="block text-[8.5px] text-muted-foreground uppercase mb-1 font-bold">Comprimento em Metros</label>
                <input
                  id="calib-len"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={calibrationLength}
                  onChange={e => setCalibrationLength(e.target.value)}
                  className="w-full px-3 py-2 bg-card border border-input rounded-xl text-foreground focus:outline-none focus-visible:border-[var(--ev-focus-field)] focus-visible:ring-[3px] focus-visible:ring-[var(--ev-brand-soft)] font-mono font-bold text-center text-lg shadow-xs"
                />
              </div>
              <div className="flex gap-2 pt-1.5">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowCalibrationDialog(false)
                    setCalibrationPoints([])
                  }}
                >
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={confirmCalibration}>
                  Confirmar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
