import { ORIGEM_SALA as O } from './geometria'
import { defaultSections, sectionColors, type Environment, type Section, type SeatNode, type WallNode } from './modelo'
import { criarNo, daSecao, ITENS } from './paleta'

// Cada template devolve o conteúdo de um pavimento; coordenadas locais (0,0 = canto da sala), somadas a (10,10) ao gravar.
export interface Gerado { seats: SeatNode[]; walls: WallNode[]; sections: Section[]; roomWidth: number; roomHeight: number }
export interface Template { id: string; nome: string; descricao: string; gerar: () => Gerado }

type Opcoes = { s?: number; label?: string; rot?: number; w?: number; h?: number; n?: number; cap?: number; cor?: string; shape?: 'circle' | 'rectangle' | 'square' }
const letra = (i: number) => String.fromCharCode(65 + (i % 26))

// Construtor da sala: seções com as cores do editor + uma seção "Estrutura" para o que não é vendido
function sala(W: number, H: number, secoes: [string, number][]) {
  let n = 0
  const nid = () => `t${++n}`
  const estrutura: Section = { id: 'estrutura', name: 'Estrutura', color: '#475569', price: 0 }
  const sections: Section[] = [...secoes.map(([name, price], i) => ({ id: `s${i + 1}`, name, color: sectionColors[i], price })), estrutura]
  const seats: SeatNode[] = []
  const walls: WallNode[] = []

  const add = (item: string, x: number, y: number, o: Opcoes = {}) => {
    const it = ITENS[item]
    const sec = daSecao(it.tipo) ? sections[o.s ?? 0] : estrutura
    seats.push(criarNo(it, O + x, O + y, nid(), sec, {
      ...(o.label ? { label: o.label } : {}),
      ...(o.rot ? { rotation: o.rot } : {}),
      ...(o.w ? { widthMeter: o.w } : {}),
      ...(o.h ? { heightMeter: o.h } : {}),
      ...(o.cap ? { capacity: o.cap } : {}),
      ...(o.cor ? { color: o.cor } : {}),
      ...(o.shape ? { tableShape: o.shape } : {}),
      ...(o.n && it.tipo === 'table' ? { seatsCount: o.n, capacity: o.n } : {}),
    }))
  }
  // cols x rows de assentos; r0/c0 continuam a numeração (fileira A, B... e número da cadeira)
  const grade = (item: string, s: number, x0: number, y0: number, cols: number, rows: number, dx: number, dy: number, r0 = 0, c0 = 0, pre = '') => {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) add(item, x0 + c * dx, y0 + r * dy, { s, label: `${pre}${letra(r0 + r)}${c0 + c + 1}` })
  }
  const parede = (x1: number, y1: number, x2: number, y2: number) =>
    walls.push({ id: nid(), x1: O + x1, y1: O + y1, x2: O + x2, y2: O + y2, thickness: 0.2, color: '#4b5563', locked: false })
  const caixa = (m = 0.3) => {
    parede(m, m, W - m, m); parede(W - m, m, W - m, H - m); parede(W - m, H - m, m, H - m); parede(m, H - m, m, m)
  }
  // saídas de emergência laterais (retângulo girado 90 graus junto da parede)
  const saidas = (y: number) => { add('emergency_exit', 0.6, y, { rot: 90 }); add('emergency_exit', W - 0.6, y, { rot: 90 }) }
  const banheiros = (y: number, ex = 3.5) => { add('wc_female', ex, y); add('wc_male', W - ex, y) }
  const fim = (): Gerado => ({ seats, walls, sections, roomWidth: W, roomHeight: H })
  return { add, grade, parede, caixa, saidas, banheiros, fim }
}

const fileiraDeGrades = (b: ReturnType<typeof sala>, cx: number, y: number, n = 10) => {
  for (let i = 0; i < n; i++) b.add('barricade', cx - (n * 1.5) / 2 + 0.75 + i * 1.5, y, { label: 'Grade' })
}

function teatro(): Gerado {
  const b = sala(30, 32, [['Premium', 150], ['Regular', 100], ['Econômica', 60]])
  b.add('stage', 15, 3.5, { w: 12, h: 5, label: 'Palco Principal' })
  b.add('pa_array', 7, 2.5); b.add('pa_array', 23, 2.5)
  ;[[0, 0], [4, 1], [8, 2]].forEach(([r0, s]) => { b.grade('poltrona', s, 8.2, 9.5 + r0 * 0.9, 8, 4, 0.8, 0.9, r0, 0); b.grade('poltrona', s, 16.2, 9.5 + r0 * 0.9, 8, 4, 0.8, 0.9, r0, 8) })
  b.add('foh_desk', 15, 23, { label: 'Mesa de Som' })
  b.add('portico', 15, 31.2, { label: 'Entrada Principal' })
  b.banheiros(29.8); b.saidas(14); b.caixa()
  return b.fim()
}

function auditorio(): Gerado {
  const b = sala(36, 28, [['Frontal', 200], ['Central', 140], ['Fundos', 90]])
  b.add('stage', 18, 3, { w: 10, h: 4, label: 'Palco' })
  b.add('pa_array', 4, 2.5); b.add('pa_array', 32, 2.5)
  for (let i = 0; i < 8; i++) {
    const r = 8 + i * 1.1
    const n = Math.floor((r * (2 * Math.PI) / 3) / 0.65)
    for (let k = 0; k < n; k++) {
      const a = Math.PI / 6 + (k / (n - 1)) * (2 * Math.PI) / 3
      b.add('poltrona', 18 + r * Math.cos(a), 2 + r * Math.sin(a), { s: i < 3 ? 0 : i < 6 ? 1 : 2, label: `${letra(i)}${k + 1}`, rot: Math.round((a * 180) / Math.PI - 90), w: 0.5, h: 0.5 })
    }
  }
  b.add('foh_desk', 18, 21.5, { label: 'Mesa de Som' })
  b.add('portico', 18, 27.2, { label: 'Entrada Principal' })
  b.banheiros(25.8); b.saidas(12); b.caixa()
  return b.fim()
}

function estadio(): Gerado {
  const b = sala(60, 44, [['Norte', 80], ['Sul', 80], ['Leste', 60], ['Oeste', 60]])
  b.add('area', 30, 22, { w: 36, h: 20, label: 'Gramado / Campo', cor: '#15803d' })
  b.grade('poltrona', 0, 12.8, 3, 40, 6, 0.8, 0.9, 0, 0, 'N-')
  b.grade('poltrona', 1, 12.8, 36.5, 40, 6, 0.8, 0.9, 0, 0, 'S-')
  for (let r = 0; r < 20; r++) for (let c = 0; c < 5; c++) {
    b.add('poltrona', 3 + c * 0.9, 14 + r * 0.8, { s: 3, label: `L-${letra(c)}${r + 1}` })
    b.add('poltrona', 53.4 + c * 0.9, 14 + r * 0.8, { s: 2, label: `O-${letra(c)}${r + 1}` })
  }
  b.add('wc_female', 4, 3); b.add('wc_male', 4, 34)
  b.add('medical_post', 56, 3); b.add('ambulance', 53, 34)
  b.add('security_post', 8, 9); b.add('security_post', 52, 9)
  b.add('gate', 30, 43.3, { label: 'Portão Principal' })
  for (let i = 0; i < 4; i++) b.add('turnstile', 27 + i * 2, 42.4)
  b.add('accreditation', 52, 42)
  b.add('double_exit', 0.6, 22, { rot: 90 }); b.add('double_exit', 59.4, 22, { rot: 90 })
  b.caixa()
  return b.fim()
}

function arena(): Gerado {
  const b = sala(50, 40, [['Pista', 150], ['Pista Premium', 300], ['Camarote', 600]])
  b.add('stage_large', 25, 5, { label: 'Palco' })
  fileiraDeGrades(b, 25, 10.5)
  b.add('dancefloor', 25, 14, { s: 1, w: 24, h: 6, label: 'Pista Premium (Front Stage)' })
  b.add('dancefloor', 25, 25, { s: 0, w: 24, h: 14, label: 'Pista' })
  let cam = 0
  ;[16, 24].forEach(y => { b.add('box_elevated', 4.5, y, { s: 2, w: 6, h: 6, label: `Camarote ${++cam}` }); b.add('box_elevated', 45.5, y, { s: 2, w: 6, h: 6, label: `Camarote ${++cam}` }) })
  b.add('pa_array', 11, 4); b.add('pa_array', 39, 4)
  ;[[12, 10], [38, 10], [12, 30], [38, 30]].forEach(([x, y]) => b.add('light_tower', x, y))
  b.add('foh_desk', 25, 34, { label: 'Mesa de Som' })
  b.add('bar_island', 8, 31); b.add('bar_island', 42, 31)
  b.add('gate', 25, 39.2, { label: 'Portão Principal' })
  for (let i = 0; i < 6; i++) b.add('turnstile', 20 + i * 2, 37.5)
  b.add('accreditation', 8, 36.5)
  b.banheiros(37, 8)
  b.add('medical_post', 47, 34)
  b.add('double_exit', 0.6, 20, { rot: 90 }); b.add('double_exit', 49.4, 20, { rot: 90 })
  b.caixa()
  return b.fim()
}

function casaDeShow(): Gerado {
  const b = sala(36, 30, [['Mesa VIP', 1200], ['Mesa Pista', 800], ['Pista', 80]])
  b.add('stage', 18, 3.5, { w: 10, h: 4.5, label: 'Palco' })
  b.add('pa_array', 10, 2.5); b.add('pa_array', 26, 2.5)
  b.add('dancefloor', 18, 10.5, { s: 2, w: 10, h: 6, label: 'Pista' })
  b.add('foh_desk', 18, 14.7, { label: 'Mesa de Som' })
  ;[17, 21, 25].forEach((y, r) => { for (let i = 0; i < 6; i++) b.add('table', 6 + i * 4.8, y, { s: r === 0 ? 0 : 1, w: 1.8, h: 1.8, n: 6, label: `Mesa ${r * 6 + i + 1}` }) })
  b.add('bar', 4.5, 3); b.add('bar', 31.5, 3)
  b.add('portico', 18, 29.2, { label: 'Entrada Principal' })
  b.add('wc_female', 3, 27.8); b.add('wc_male', 33, 27.8)
  b.saidas(12); b.caixa()
  return b.fim()
}

function festival(): Gerado {
  const b = sala(80, 60, [['Pista', 200], ['Área VIP', 500]])
  b.add('stage_large', 40, 6, { label: 'Palco Principal' })
  b.add('pa_array', 28, 5); b.add('pa_array', 52, 5)
  ;[[30, 12], [50, 12], [30, 32], [50, 32]].forEach(([x, y]) => b.add('light_tower', x, y))
  fileiraDeGrades(b, 40, 11.5, 12)
  b.add('dancefloor', 40, 22.5, { s: 0, w: 36, h: 21, label: 'Pista' })
  b.add('vip_area', 12, 22, { s: 1, w: 14, h: 10, label: 'Área VIP' })
  b.add('foh_desk', 40, 36, { label: 'Mesa de Som' })
  for (let i = 0; i < 5; i++) b.add('food_truck', 8 + i * 8, 50)
  b.add('snack_bar', 52, 50)
  b.add('tent_6', 66, 16, { label: 'Tenda Parceiros' }); b.add('tent_6', 66, 24, { label: 'Tenda Parceiros' })
  b.add('bar_island', 62, 34); b.add('bar_island', 70, 34)
  ;[10, 30, 50].forEach(x => b.add('water_point', x, 40))
  b.add('wc_female', 64, 52); b.add('wc_male', 70, 52); b.add('accessible_toilet', 75, 52)
  b.add('fire_post', 6, 33.5); b.add('medical_post', 6, 38); b.add('ambulance', 8, 44)
  b.add('loading_area', 74, 8); b.add('generator_large', 72, 14)
  ;[20, 40, 60].forEach(x => b.add('gate', x, 59.2))
  for (let i = 0; i < 5; i++) { b.add('turnstile', 36 + i * 2, 57); b.add('turnstile', 16 + i * 2, 57) }
  b.add('accreditation', 10, 55)
  b.add('double_exit', 0.6, 30, { rot: 90 }); b.add('double_exit', 79.4, 30, { rot: 90 })
  b.caixa()
  return b.fim()
}

function banquete(): Gerado {
  const b = sala(30, 26, [['Mesa dos Noivos', 0], ['Convidados', 0]])
  b.add('stage', 15, 2.5, { w: 8, h: 3, label: 'Palco / Banda' })
  b.add('dancefloor', 15, 12, { s: 1, w: 6, h: 6, label: 'Pista de Dança' })
  let k = 0
  for (const x of [4.5, 8.5, 21.5, 25.5]) for (const y of [7, 12, 17]) b.add('table', x, y, { s: 1, w: 1.8, h: 1.8, n: 8, label: `Mesa ${++k}` })
  b.add('table', 15, 21.5, { s: 0, w: 4, h: 1, n: 8, shape: 'rectangle', label: 'Mesa dos Noivos' })
  b.add('buffet_table', 4, 23); b.add('buffet_table', 26, 23)
  b.add('portico', 15, 25.2, { label: 'Entrada' })
  b.add('wc_female', 3.5, 2.5); b.add('wc_male', 26.5, 2.5)
  b.saidas(13); b.caixa()
  return b.fim()
}

function formatura(): Gerado {
  const b = sala(34, 34, [['Formandos', 0], ['Convidados', 60]])
  b.add('stage', 17, 4, { w: 14, h: 5, label: 'Palco / Colação' })
  b.add('backdrop', 17, 1.2, { w: 6 })
  b.add('pa_array', 6, 3); b.add('pa_array', 28, 3)
  for (let r = 0; r < 10; r++) { b.grade('poltrona', r < 2 ? 0 : 1, 10.2, 10.5 + r * 0.9, 8, 1, 0.8, 0.9, r, 0); b.grade('poltrona', r < 2 ? 0 : 1, 18.2, 10.5 + r * 0.9, 8, 1, 0.8, 0.9, r, 8) }
  b.add('escape_route', 17, 15, { w: 1.4, h: 9.5, label: 'Corredor Central' })
  b.add('foh_desk', 17, 22.5, { label: 'Mesa de Som' })
  b.add('buffet_table', 9, 28, { label: 'Coquetel' }); b.add('buffet_table', 25, 28, { label: 'Coquetel' })
  b.add('portico', 17, 33.2, { label: 'Entrada Principal' })
  b.banheiros(31.8); b.saidas(14); b.caixa()
  return b.fim()
}

function congresso(): Gerado {
  const b = sala(30, 26, [['Participantes', 120]])
  b.add('ledscreen', 15, 1, { w: 8, label: 'Telão' })
  b.add('stage', 15, 3.2, { w: 10, h: 2.5, label: 'Mesa Diretora' })
  let k = 0
  for (const x of [5, 8.2, 11.4, 18.6, 21.8, 25]) for (let r = 0; r < 6; r++) b.add('table', x, 9 + r * 2.2, { w: 1.8, h: 0.6, n: 3, shape: 'rectangle', label: `Mesa ${++k}` })
  b.add('foh_desk', 15, 22.8, { label: 'Mesa de Som' })
  b.add('accreditation', 4, 24); b.add('buffet_table', 10, 23.5, { label: 'Coffee Break' })
  b.add('wc_female', 22, 23.8); b.add('wc_male', 27, 23.8)
  b.add('portico', 15, 25.2, { label: 'Entrada' })
  b.saidas(12); b.caixa()
  return b.fim()
}

function feira(): Gerado {
  const b = sala(50, 38, [['Stands', 1200]])
  let k = 0
  for (const y of [5.5, 8.7, 17.5, 20.7]) for (let i = 0; i < 9; i++) b.add('stand', 5.5 + i * 4.6, y, { cap: 1, label: `Stand ${String(++k).padStart(2, '0')}` })
  b.add('food_court', 40, 31, { label: 'Praça de Alimentação' })
  b.add('accreditation', 5, 33.5); b.add('info', 12, 33)
  b.add('wc_female', 20, 35.5); b.add('wc_male', 25, 35.5)
  b.add('gate', 30, 37.2, { label: 'Entrada' })
  b.add('double_exit', 0.6, 19, { rot: 90 }); b.add('double_exit', 49.4, 19, { rot: 90 })
  b.caixa()
  return b.fim()
}

function pistaCamarote(): Gerado {
  const b = sala(44, 36, [['Pista', 120], ['Front Stage', 250], ['Camarote', 700]])
  b.add('stage_large', 22, 5.5, { label: 'Palco' })
  fileiraDeGrades(b, 22, 10.5)
  b.add('dancefloor', 22, 13.5, { s: 1, w: 24, h: 4, label: 'Front Stage' })
  b.add('dancefloor', 22, 23, { s: 0, w: 24, h: 13, label: 'Pista' })
  let cam = 0
  ;[14, 21, 28].forEach(y => { b.add('box_elevated', 5, y, { s: 2, w: 6, h: 6, label: `Camarote ${++cam}` }); b.add('box_elevated', 39, y, { s: 2, w: 6, h: 6, label: `Camarote ${++cam}` }) })
  b.add('pa_array', 10, 4); b.add('pa_array', 34, 4)
  b.add('light_tower', 11, 9); b.add('light_tower', 33, 9)
  b.add('foh_desk', 22, 32, { label: 'Mesa de Som' })
  b.add('bar_island', 11, 33); b.add('bar_island', 33, 33)
  b.add('wc_female', 4, 34.2); b.add('wc_male', 40, 34.2)
  b.add('gate', 22, 35.2, { label: 'Portão Principal' })
  for (let i = 0; i < 4; i++) b.add('turnstile', 19 + i * 2, 33.6)
  b.add('double_exit', 0.6, 20, { rot: 90 }); b.add('double_exit', 43.4, 20, { rot: 90 })
  b.caixa()
  return b.fim()
}

function jantarVip(): Gerado {
  const b = sala(20, 16, [['VIP', 1500]])
  ;[[6, 4], [12, 4], [6, 10], [12, 10]].forEach(([x, y], i) => b.add('table', x, y, { w: 1.8, h: 1.8, n: 6, label: `Mesa ${i + 1}` }))
  b.add('bar', 16, 1.6)
  b.add('portico', 10, 15.2, { label: 'Entrada' })
  b.add('emergency_exit', 0.6, 8, { rot: 90 })
  b.caixa()
  return b.fim()
}

const vazio = (): Gerado => ({ seats: [], walls: [], sections: JSON.parse(JSON.stringify(defaultSections)), roomWidth: 40, roomHeight: 40 })

export const TEMPLATES: Template[] = [
  { id: 'vazio', nome: 'Vazio', descricao: 'Sala em branco, 40 x 40 m, para montar do zero', gerar: vazio },
  { id: 'teatro', nome: 'Teatro', descricao: 'Platéia em duas alas com corredor central, palco, som e saídas', gerar: teatro },
  { id: 'auditorio', nome: 'Auditório', descricao: 'Fileiras curvas em volta do palco, três setores', gerar: auditorio },
  { id: 'estadio', nome: 'Estádio / Arquibancada', descricao: 'Campo no centro e arquibancadas nos quatro lados', gerar: estadio },
  { id: 'arena', nome: 'Arena show em pé', descricao: 'Palco grande, grade, pista premium, pista e camarotes', gerar: arena },
  { id: 'casa-de-show', nome: 'Casa de show com mesas', descricao: 'Palco, pista de dança e 18 mesas de 6 lugares', gerar: casaDeShow },
  { id: 'festival', nome: 'Festival ao ar livre', descricao: 'Palco, pista, área VIP, food trucks, tendas, banheiros e portões', gerar: festival },
  { id: 'banquete', nome: 'Banquete / Casamento', descricao: 'Mesas redondas de 8, pista de dança, palco e mesa dos noivos', gerar: banquete },
  { id: 'formatura', nome: 'Formatura', descricao: 'Palco, platéia com corredor central, setor dos formandos', gerar: formatura },
  { id: 'congresso', nome: 'Congresso / Sala de aula', descricao: 'Mesas escolares em duas alas, mesa diretora e telão', gerar: congresso },
  { id: 'feira', nome: 'Feira / Stands', descricao: '36 stands 3 x 3 m, praça de alimentação e credenciamento', gerar: feira },
  { id: 'pista-camarote', nome: 'Pista + Camarote', descricao: 'Front stage, pista e camarotes elevados nas laterais', gerar: pistaCamarote },
  { id: 'jantar-vip', nome: 'Jantar VIP', descricao: '4 mesas redondas de 6 lugares com bar', gerar: jantarVip },
]

// Troca o conteúdo do pavimento pelo do template (mantém id, nome e escala)
export const aplicarTemplate = (env: Environment, t: Template): Environment => {
  const g = t.gerar()
  // ids prefixados com o do pavimento: não repetem entre pavimentos
  const pre = (id: string) => `${env.id}-${id}`
  return { ...env, ...g, seats: g.seats.map(n => ({ ...n, id: pre(n.id) })), walls: g.walls.map(w => ({ ...w, id: pre(w.id) })), roomShape: 'rectangle' }
}
