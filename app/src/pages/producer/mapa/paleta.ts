import { NOVOS } from './catalogo'
import { toolDefaults, typeLabels, type Section, type SeatNode, type ToolType } from './modelo'

// Item da paleta: um tipo do editor (id = tipo) ou uma variação pronta de cadeira/mesa (id próprio)
export interface ItemCatalogo {
  id: string; tipo: ToolType; nome: string; w: number; h: number; cor: string; cap: number
  mesa?: 'circle' | 'rectangle' | 'square' // só quando tipo = 'table'
}

// Variações de assento e mesa: continuam sendo 'seat'/'table' porque só esses dois entram na venda e na contagem
// ponytail: mesa oval vira retangular (o modelo salvo só tem círculo, retângulo e quadrado); 0,8 x 1,2 m = módulo de referência
// de cadeira de rodas da NBR 9050 (conferir antes de divulgar como norma).
const VARIACOES: ItemCatalogo[] = [
  { id: 'poltrona', tipo: 'seat', nome: 'Poltrona de Teatro', w: 0.55, h: 0.55, cor: '#7a3b69', cap: 1 },
  { id: 'cadeira_pne', tipo: 'seat', nome: 'Cadeira PNE', w: 0.6, h: 0.6, cor: '#2563eb', cap: 1 },
  { id: 'espaco_cadeirante', tipo: 'seat', nome: 'Espaço Cadeirante', w: 0.8, h: 1.2, cor: '#2563eb', cap: 1 },
  { id: 'banco_corrido', tipo: 'table', nome: 'Banco Corrido', w: 2, h: 0.5, cor: '#7a3b69', cap: 4, mesa: 'rectangle' },
  { id: 'camarote', tipo: 'table', nome: 'Camarote / Frisa', w: 3, h: 2.5, cor: '#9333ea', cap: 6, mesa: 'rectangle' },
  { id: 'mesa_oval', tipo: 'table', nome: 'Mesa Oval', w: 2.4, h: 1.2, cor: '#7a3b69', cap: 8, mesa: 'rectangle' },
  { id: 'mesa_quadrada4', tipo: 'table', nome: 'Mesa Quadrada (4)', w: 0.9, h: 0.9, cor: '#7a3b69', cap: 4, mesa: 'square' },
]

// Tipos que já existiam no editor antigo, na mesma ordem das categorias dele ('wall' fica de fora: ainda não há ferramenta de desenhar parede aqui)
const ANTIGOS: Record<string, ToolType[]> = {
  navigation: ['select', 'pan', 'text'],
  seating: ['seat', 'table', 'buffet_table', 'round_buffet', 'bistro', 'couch', 'vip_lounge'],
  structures: ['stage', 'runway_stage', 'dj_deck', 'ledscreen', 'truss', 'dancefloor', 'barricade', 'unifila_barrier', 'backdrop'],
  technical: ['soundhouse', 'foh_desk', 'generator', 'dressing_room', 'area', 'stairs', 'parking_spot'],
  food: ['bar', 'l_bar', 'u_bar', 'food_court', 'service', 'stand', 'tent', 'large_tent', 'cloakroom', 'info'],
  facilities: ['door', 'emergency_exit', 'portico', 'ticket_office', 'chemical_toilet', 'accessible_toilet', 'container_toilet', 'restroom', 'extinguisher'],
}
const NOMES: Record<string, string> = {
  navigation: 'Navegação', seating: 'Assentos e mesas', structures: 'Estruturas de evento',
  technical: 'Área técnica', food: 'Alimentação e tenda', facilities: 'Paredes e acessos',
}

const doTipo = (t: ToolType): ItemCatalogo => {
  const d = toolDefaults[t]
  return { id: t, tipo: t, nome: typeLabels[t], w: d.wMeter, h: d.hMeter, cor: d.color, cap: d.cap }
}

export const CATEGORIAS = Object.keys(NOMES).map(id => ({
  id,
  nome: NOMES[id],
  itens: [
    ...ANTIGOS[id].map(doTipo),
    ...NOVOS.filter(n => n[0] === id).map(n => doTipo(n[1] as ToolType)),
    ...(id === 'seating' ? VARIACOES : []),
  ],
}))

export const ITENS: Record<string, ItemCatalogo> = Object.fromEntries(CATEGORIAS.flatMap(c => c.itens).map(i => [i.id, i]))

// Tipos que pertencem a uma seção de venda: pegam cor e preço dela (os demais ficam com a cor do tipo)
const DA_SECAO = new Set<ToolType>(['seat', 'table', 'dancefloor', 'vip_lounge', 'vip_area', 'bleacher', 'box_elevated', 'stand'])
export const daSecao = (t: ToolType) => DA_SECAO.has(t)

// Seção dos itens que não vendem (mesma dos templates): não entra na contagem nem no potencial de venda
export const ESTRUTURA: Section = Object.freeze({ id: 'estrutura', name: 'Estrutura', color: '#475569', price: 0 })

export const formaDe = (t: string): 'r' | 'c' => (NOVOS.find(n => n[1] === t)?.[7] === 'c' ? 'c' : 'r')

// Cria um elemento a partir do item da paleta (x, y = centro, em metros)
export function criarNo(item: ItemCatalogo, x: number, y: number, id: string, sec: Pick<Section, 'id' | 'color' | 'price'>, extra: Partial<SeatNode> = {}): SeatNode {
  const venda = daSecao(item.tipo)
  const mesa = item.tipo === 'table'
  return {
    id, x, y, label: item.nome, type: item.tipo,
    color: venda ? sec.color : item.cor,
    price: venda ? sec.price : 0,
    rotation: 0, sold: 0, capacity: item.cap, sectionId: sec.id, status: 'free', locked: false,
    widthMeter: item.w, heightMeter: item.h,
    ...(mesa ? { tableShape: item.mesa || 'circle', seatsCount: item.cap || 6 } : {}),
    ...extra,
  }
}
