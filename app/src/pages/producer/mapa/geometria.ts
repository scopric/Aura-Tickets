import type { Environment } from './modelo'

// A sala começa em (10 m, 10 m) no sistema de coordenadas do JSON salvo (igual ao editor antigo)
export const ORIGEM_SALA = 10
export const ZOOM_MIN = 0.1
export const ZOOM_MAX = 8

export interface Caixa { x: number; y: number; w: number; h: number }
export interface Vista { zoom: number; pan: { x: number; y: number } }

const limitarZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))

// Menor caixa (em metros) que contém a sala E tudo o que está desenhado, mesmo fora da sala
// ponytail: ignora roomRotation e a sala em L (usa o retângulo roomWidth x roomHeight)
export function limites(env: Environment): Caixa {
  let x1 = ORIGEM_SALA, y1 = ORIGEM_SALA
  let x2 = ORIGEM_SALA + (env.roomWidth || 40), y2 = ORIGEM_SALA + (env.roomHeight || 40)
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
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
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
