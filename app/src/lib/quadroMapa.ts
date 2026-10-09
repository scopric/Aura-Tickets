// Local, rota e distância dos cartões do quadro (Fatia 2B). Sem rede e sem biblioteca: só texto e conta.
// Os links são montados só a partir de constantes https + encodeURIComponent: nada do banco vira endereço.
import type { LocalCartao } from '../hooks/useCartao'
import type { DbTask } from '../hooks/useProducerTools'

export interface Ponto { lat: number; lng: number }

export const latValida = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= -90 && n <= 90
export const lngValida = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= -180 && n <= 180
/** Coordenadas só valem as duas juntas e dentro da faixa */
export const temCoordenadas = (l?: LocalCartao | null): l is LocalCartao & Ponto => !!l && latValida(l.lat) && lngValida(l.lng)

const enc = encodeURIComponent
const MAX_PARADAS = 9
const MAX_TEXTO = 200 // o mesmo limite do banco para o texto do local
const MAX_LINK = 2000 // acima disso navegadores e o Google podem recusar o link

/** "lat,lng" quando há coordenadas, senão o texto do endereço; null se não há nada */
function destino(l?: LocalCartao | null): string | null {
  if (temCoordenadas(l)) return `${l.lat},${l.lng}`
  return l?.txt?.trim().slice(0, MAX_TEXTO) || null
}

export function linkGoogle(l?: LocalCartao | null): string | null {
  const d = destino(l)
  if (!d) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${enc(d)}&travelmode=driving&dir_action=navigate`
}
export function linkWaze(l?: LocalCartao | null): string | null {
  if (temCoordenadas(l)) return `https://waze.com/ul?ll=${enc(`${l.lat},${l.lng}`)}&navigate=yes`
  const t = l?.txt?.trim().slice(0, MAX_TEXTO)
  return t ? `https://waze.com/ul?q=${enc(t)}&navigate=yes` : null
}
export function linkApple(l?: LocalCartao | null): string | null {
  const d = destino(l)
  if (!d) return null
  return `https://maps.apple.com/?daddr=${enc(d)}&dirflg=d`
}

/** Distância em linha reta, em km (fórmula de haversine) */
export function haversineKm(a: Ponto, b: Ponto): number {
  const r = (x: number) => (x * Math.PI) / 180
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}
export const kmTexto = (km: number) => `${km.toFixed(1).replace('.', ',')} km`

export interface Parada { id: string; titulo: string; local: LocalCartao; prazo: string | null }

/** Cartões abertos com local, sem repetir o mesmo destino. Sem origem: por prazo. Com origem: os com coordenadas, do mais perto ao mais longe */
export function paradasDoRoteiro(tarefas: DbTask[], concluida: (t: DbTask) => boolean, origem?: Ponto | null): Parada[] {
  const vistos = new Set<string>()
  const lista: Parada[] = []
  const porPrazo = [...tarefas].sort((a, b) => (a.due_date ?? '9').localeCompare(b.due_date ?? '9') || a.created_at.localeCompare(b.created_at))
  for (const t of porPrazo) {
    const d = destino(t.location)
    if (!d || t.archived_at || concluida(t) || vistos.has(d)) continue
    vistos.add(d)
    lista.push({ id: t.id, titulo: t.title, local: t.location!, prazo: t.due_date })
  }
  if (!origem) return lista
  // ponytail: do mais perto da pessoa para o mais longe, não o menor caminho (problema do caixeiro); sem coordenadas ficam no fim, por prazo
  const dist = (p: Parada) => (temCoordenadas(p.local) ? haversineKm(origem, p.local) : Infinity)
  return [...lista].sort((a, b) => dist(a) - dist(b))
}

/** Rota única no Google Maps com até 9 paradas (a última é o destino), reduzidas até o link caber em 2.000 caracteres. `usadas` = quantas entraram */
// A posição da pessoa nunca entra nos links: ela só ordena a lista, na memória da página
export function linkRoteiro(paradas: Parada[]): { url: string; usadas: number } | null {
  const todas = paradas.slice(0, MAX_PARADAS).map(x => destino(x.local)).filter((x): x is string => !!x)
  for (let n = todas.length; n > 0; n--) {
    const p = todas.slice(0, n), meio = p.slice(0, -1)
    const url = `https://www.google.com/maps/dir/?api=1&destination=${enc(p[n - 1])}&travelmode=driving`
      + (meio.length ? `&waypoints=${meio.map(enc).join('%7C')}` : '')
    if (url.length <= MAX_LINK) return { url, usadas: n }
  }
  return null
}
export const MAX_PARADAS_ROTEIRO = MAX_PARADAS

export type Aparelho = 'computador' | 'celular' | 'tablet' | 'outro'
/** Tipo de aparelho só pela largura da tela e pelo toque (sem user agent, sem IP) */
export function tipoAparelho(): Aparelho {
  if (typeof window === 'undefined') return 'outro'
  const toque = !!window.matchMedia?.('(pointer: coarse)').matches
  if (!toque) return 'computador'
  return window.innerWidth < 768 ? 'celular' : 'tablet'
}
