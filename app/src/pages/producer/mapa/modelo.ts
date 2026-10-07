import { defaultsNovos, rotulosNovos, type TipoNovo } from './catalogo'

// Tipos de ferramentas do editor (os do catálogo ampliado estão em catalogo.ts)
export type ToolType = TipoNovo
  | 'select' | 'pan' | 'seat' | 'table' | 'stage' | 'bar' | 'door' | 'text' | 'dancefloor' | 'area' | 'stairs' 
  | 'restroom' | 'info' | 'service' | 'wall' | 'ledscreen' | 'truss' | 'generator' | 'soundhouse' 
  | 'barricade' | 'bistro' | 'couch' | 'tent' | 'stand' | 'chemical_toilet' | 'accessible_toilet' | 'emergency_exit'
  | 'buffet_table' | 'dressing_room' | 'portico' | 'dj_deck' | 'unifila_barrier'
  | 'vip_lounge' | 'l_bar' | 'u_bar' | 'food_court' | 'ticket_office' | 'parking_spot' | 'foh_desk'
  | 'backdrop' | 'round_buffet' | 'cloakroom' | 'extinguisher' | 'runway_stage' | 'container_toilet' | 'large_tent'

export type SeatStatus = 'free' | 'sold' | 'blocked' | 'reserved' | 'contact'

export interface SeatNode {
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

export interface WallNode {
  id: string
  x1: number // ponto inicial em metros
  y1: number // ponto inicial em metros
  x2: number // ponto final em metros
  y2: number // ponto final em metros
  thickness: number // espessura em metros (ex: 0.15 ou 0.25)
  color: string
  locked: boolean
}

export interface Section {
  id: string
  name: string
  color: string
  price: number
  ticketTypeId?: string // ticket_types.id do ingresso que este setor vende (sem ele, o setor não vende)
}

export interface Environment {
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

export const sectionColors = [
  '#7a3b69', '#1e3a5f', '#d97706', '#16a34a', '#dc2626',
  '#0891b2', '#8b5cf6', '#ec4899', '#78716c', '#059669'
]

export const defaultSections: Section[] = [
  { id: 'vip', name: 'VIP Frontal', color: '#d97706', price: 250 },
  { id: 'premium', name: 'Premium', color: '#7a3b69', price: 150 },
  { id: 'regular', name: 'Regular', color: '#1e3a5f', price: 80 },
  { id: 'pista', name: 'Pista', color: '#16a34a', price: 60 },
  { id: 'mezanino', name: 'Mezanino', color: '#8b5cf6', price: 120 },
]

export const typeLabels: Record<ToolType, string> = {
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
  large_tent: 'Tenda Pirâmide Gde.',
  ...rotulosNovos
}

// Configurações padrão dos elementos em metros
export const toolDefaults: Record<ToolType, { wMeter: number; hMeter: number; cap: number; color: string }> = {
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
  large_tent: { wMeter: 10.0, hMeter: 10.0, cap: 0, color: '#6d28d9' },
  ...defaultsNovos
}

export const novosPavimentos = (): Environment[] => [
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
export const fundoPadrao = { scale: 1.0, offset: { x: 150, y: 100 }, opacity: 0.4 }
export const montarFundo = (image: string | null, scale: number, offset: { x: number; y: number }, opacity: number) =>
  image ? { image, scale, offset, opacity } : null
export const instantaneo = (envs: Environment[], fundo: ReturnType<typeof montarFundo>) => JSON.stringify({ envs, fundo })

// Lê o JSON salvo (inclusive o antigo, sem walls/pixelsPerMeter/widthMeter) e completa os campos que faltam
export const normalizarEnvs = (envs: Environment[]): Environment[] => envs.map(env => ({
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
