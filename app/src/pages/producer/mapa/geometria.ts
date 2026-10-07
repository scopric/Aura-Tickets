import type { Environment } from './modelo'

// A sala começa em (10 m, 10 m) no sistema de coordenadas do JSON salvo (igual ao editor antigo)
export const ORIGEM_SALA = 10
export const ZOOM_MIN = 0.1
export const ZOOM_MAX = 8

export interface Caixa { x: number; y: number; w: number; h: number }
export interface Vista { zoom: number; pan: { x: number; y: number } }

const limitarZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))

// Caixa que envolve só os elementos e paredes (com rotação), sem a sala; null se não há nada
export function caixaDosElementos(env: Environment): Caixa | null {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity
  for (const s of env.seats || []) {
    const w = s.widthMeter || 0.5, h = s.heightMeter || 0.5
    const r = ((s.rotation || 0) * Math.PI) / 180
    const mx = (Math.abs(w * Math.cos(r)) + Math.abs(h * Math.sin(r))) / 2
    const my = (Math.abs(w * Math.sin(r)) + Math.abs(h * Math.cos(r))) / 2
    x1 = Math.min(x1, s.x - mx); x2 = Math.max(x2, s.x + mx)
    y1 = Math.min(y1, s.y - my); y2 = Math.max(y2, s.y + my)
  }
  for (const p of env.walls || []) {
    const t = (p.thickness || 0) / 2
    x1 = Math.min(x1, p.x1 - t, p.x2 - t); x2 = Math.max(x2, p.x1 + t, p.x2 + t)
    y1 = Math.min(y1, p.y1 - t, p.y2 - t); y2 = Math.max(y2, p.y1 + t, p.y2 + t)
  }
  return x1 === Infinity ? null : { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}

// Menor caixa (em metros) que contém a sala E tudo o que está desenhado, mesmo fora da sala
// ponytail: ignora roomRotation e a sala em L (usa o retângulo roomWidth x roomHeight)
export function limites(env: Environment): Caixa {
  const sx2 = ORIGEM_SALA + (env.roomWidth || 40), sy2 = ORIGEM_SALA + (env.roomHeight || 40)
  const c = caixaDosElementos(env)
  if (!c) return { x: ORIGEM_SALA, y: ORIGEM_SALA, w: sx2 - ORIGEM_SALA, h: sy2 - ORIGEM_SALA }
  const x1 = Math.min(ORIGEM_SALA, c.x), y1 = Math.min(ORIGEM_SALA, c.y)
  return { x: x1, y: y1, w: Math.max(sx2, c.x + c.w) - x1, h: Math.max(sy2, c.y + c.h) - y1 }
}

// Zoom e pan (pixels) que centralizam a caixa na tela com 8% de margem; o Group usa scale = ppm * zoom
export function ajustarTela(caixa: Caixa, viewW: number, viewH: number, ppm: number): Vista {
  const zoom = limitarZoom(Math.min((viewW * 0.92) / (caixa.w * ppm), (viewH * 0.92) / (caixa.h * ppm)))
  const s = ppm * zoom
  return { zoom, pan: { x: (viewW - caixa.w * s) / 2 - caixa.x * s, y: (viewH - caixa.h * s) / 2 - caixa.y * s } }
}

// Muda o zoom mantendo o ponto do mundo que está sob o cursor (em pixels da tela) no mesmo lugar
export function zoomNoCursor(v: Vista, cursor: { x: number; y: number }, novoZoom: number): Vista {
  const zoom = limitarZoom(novoZoom)
  const k = zoom / v.zoom
  return { zoom, pan: { x: cursor.x - (cursor.x - v.pan.x) * k, y: cursor.y - (cursor.y - v.pan.y) * k } }
}

export const snap = (v: number, passo = 0.25) => Math.round(v / passo) * passo || 0 // "|| 0" evita -0

// Aplica o ppm calibrado: só pixelsPerMeter muda; posições (metros), venda e status ficam como estão
export const aplicarPpm = (env: Environment, ppm: number): Environment => ({ ...env, pixelsPerMeter: ppm })

export const PPM_MIN = 5
export const PPM_MAX = 400
export const MAX_METROS_CALIBRAR = 1000

// Calibração: p1 e p2 em metros (como o mapa guarda), `metros` é a distância real entre eles.
// Devolve o novo pixels/metro: a planta (em pixels) não muda, os elementos (em metros) é que são redesenhados na nova escala.
export function calibrar(p1: { x: number; y: number }, p2: { x: number; y: number }, metros: number, ppmAtual: number): { ppm: number } | { erro: string } {
  if (!Number.isFinite(metros) || metros <= 0 || metros > MAX_METROS_CALIBRAR) return { erro: `Informe uma distância entre 0 e ${MAX_METROS_CALIBRAR} metros.` }
  const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y)
  if (!(dist > 1e-6)) return { erro: 'Os dois pontos estão no mesmo lugar. Marque pontos diferentes.' }
  const ppm = Math.round((dist * ppmAtual) / metros)
  if (!Number.isFinite(ppm) || ppm < PPM_MIN || ppm > PPM_MAX) return { erro: `Essa medida daria ${ppm} px por metro; o aceito é de ${PPM_MIN} a ${PPM_MAX}. Confira os pontos e a distância.` }
  return { ppm }
}
