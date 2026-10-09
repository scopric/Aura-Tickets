// Mapa do evento: coordenadas validadas, peças do OpenStreetMap (slippy map) e links dos aplicativos de mapa.

// PostgREST pode devolver numeric como texto; '' e null não viram 0
// texto só no formato -12.345 (nada de "0x10", "1e9", vírgula decimal)
const numero = (v: unknown): number => (typeof v === 'number' ? v : typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : NaN)

export function coordenadasValidas(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  const a = numero(lat), o = numero(lng)
  // o Web Mercator do OSM vai só até 85,05° de latitude; (0, 0) exatos é o "campo vazio" (ilha nula), não um lugar
  return Number.isFinite(a) && Number.isFinite(o) && Math.abs(a) <= 85.05 && Math.abs(o) <= 180 && !(a === 0 && o === 0) ? { lat: a, lng: o } : null
}

export interface PecaMapa { x: number; y: number; z: number; col: number; lin: number; url: string }

// Grade de 3 colunas x 2 linhas com o ponto dentro da peça central. `pinoX`/`pinoY` = posição do ponto em px na grade
// (256 px por peça), para o cartão deslocar a grade e centralizar o pino. Linhas: a de cima ou a de baixo da peça do
// ponto, conforme a metade em que ele cai, para o ponto ficar perto do meio da grade.
export function pecasDoMapa(lat: number, lng: number, z = 15) {
  const n = 2 ** z
  const rad = (lat * Math.PI) / 180
  const xt = ((lng + 180) / 360) * n
  const yt = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n
  const x0 = Math.floor(xt), y0 = Math.floor(yt)
  const fx = xt - x0, fy = yt - y0
  const linTopo = fy < 0.5 ? y0 - 1 : y0
  const pecas: PecaMapa[] = []
  for (let lin = 0; lin < 2; lin++) for (let col = 0; col < 3; col++) {
    const x = (((x0 - 1 + col) % n) + n) % n // lng +-180 dá a volta no mapa
    const y = Math.min(Math.max(linTopo + lin, 0), n - 1)
    pecas.push({ x, y, z, col, lin, url: `https://tile.openstreetmap.org/${z}/${x}/${y}.png` })
  }
  return { z, x0, y0, fx, fy, pecas, pinoX: (1 + fx) * 256, pinoY: (y0 - linTopo + fy) * 256 }
}

const seis = (n: number) => n.toFixed(6)

export interface LinkMapa { id: 'google' | 'waze' | 'apple'; nome: string; href: string }

// `consulta` = nome, endereço e cidade em texto; `googleSemCoord` = o mapaUrl que a página já tem
export function linksDeMapa(o: { coords: { lat: number; lng: number } | null; consulta: string; nome: string; googleSemCoord: string }, apple: boolean): LinkMapa[] {
  const { coords: c, consulta, nome } = o
  const google = c ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${seis(c.lat)},${seis(c.lng)}`)}` : o.googleSemCoord
  const waze = c ? `https://waze.com/ul?ll=${encodeURIComponent(`${seis(c.lat)},${seis(c.lng)}`)}&navigate=yes&zoom=17` : `https://waze.com/ul?q=${encodeURIComponent(consulta)}&navigate=yes`
  const maps = c ? `https://maps.apple.com/?ll=${encodeURIComponent(`${seis(c.lat)},${seis(c.lng)}`)}&q=${encodeURIComponent(nome)}` : `https://maps.apple.com/?q=${encodeURIComponent(consulta)}`
  const g = { id: 'google', nome: 'Google Maps', href: google } as const
  const w = { id: 'waze', nome: 'Waze', href: waze } as const
  const a = { id: 'apple', nome: 'Apple Mapas', href: maps } as const
  return apple ? [a, g, w] : [g, w, a]
}

// iPhone, iPad e Mac: Apple Mapas primeiro. Sem navigator (SSR): Google primeiro.
export const ehApple = (ua = typeof navigator === 'undefined' ? '' : navigator.userAgent) => /iPhone|iPad|iPod|Macintosh|Mac OS X/.test(ua)
