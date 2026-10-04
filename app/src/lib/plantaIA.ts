// Leitor de planta com IA (fase E6): contas puras do lado do navegador, testadas em app/src/test/planta.test.ts.
// O Peca vem do servidor (supabase/functions/_shared/planta.ts): centro (x, y) e tamanho (w, h) como fração da
// planta, de 0 a 1, a partir do canto superior esquerdo.
import type { Peca } from '../../../supabase/functions/_shared/planta'

export type PecaProposta = Peca & { id: string; marcada: boolean }

/** Onde a planta está no editor e a escala do pavimento. A planta tem `scale * 1000` px de largura. */
export type Quadro = {
  offset: { x: number; y: number }
  scale: number
  naturalWidth: number
  naturalHeight: number
  pixelsPerMeter: number
}

export const LARGURA_BASE_PX = 1000 // largura da planta no editor com scale 1 (o <img> do fundo)

const doisDecimais = (v: number) => Math.round(v * 100) / 100

/** Peça em 0..1 sobre a planta → metros no editor (centro e tamanho), com a proporção real da imagem. */
export function emMetros(p: Peca, q: Quadro) {
  const largura = q.scale * LARGURA_BASE_PX
  const altura = (largura * q.naturalHeight) / q.naturalWidth
  return {
    x: doisDecimais((q.offset.x + p.x * largura) / q.pixelsPerMeter),
    y: doisDecimais((q.offset.y + p.y * altura) / q.pixelsPerMeter),
    widthMeter: doisDecimais((p.w * largura) / q.pixelsPerMeter),
    heightMeter: doisDecimais((p.h * altura) / q.pixelsPerMeter),
  }
}

/** Só as peças marcadas pelo produtor, já em metros. O que ficou desmarcado não entra no mapa. */
export function nosDaProposta(pecas: PecaProposta[], q: Quadro) {
  return pecas.filter(p => p.marcada).map(p => ({ tipo: p.tipo, rotulo: p.rotulo, ...emMetros(p, q) }))
}

/** Confere de novo a resposta do servidor: tipo que o editor não tem ou número fora de 0..1 é descartado. */
export function pecasValidas(dado: unknown, tipoExiste: (tipo: string) => boolean): Peca[] {
  if (!Array.isArray(dado)) return []
  const faixa = (v: unknown) => typeof v === 'number' && v >= 0 && v <= 1
  return dado.filter((p): p is Peca =>
    typeof p?.tipo === 'string' && tipoExiste(p.tipo) && faixa(p.x) && faixa(p.y) && faixa(p.w) && faixa(p.h) && p.w > 0 && p.h > 0)
}

export function contarPorTipo(pecas: PecaProposta[]) {
  const por: Record<string, { total: number; marcadas: number }> = {}
  for (const p of pecas) {
    const c = (por[p.tipo] ??= { total: 0, marcadas: 0 })
    c.total++
    if (p.marcada) c.marcadas++
  }
  return por
}

/** "Desmarcar tipo": com todas do tipo marcadas, desmarca todas; senão, marca todas. */
export function alternarTipo(pecas: PecaProposta[], tipo: string): PecaProposta[] {
  const doTipo = pecas.filter(p => p.tipo === tipo)
  const marcar = !doTipo.every(p => p.marcada)
  return pecas.map(p => (p.tipo === tipo ? { ...p, marcada: marcar } : p))
}
