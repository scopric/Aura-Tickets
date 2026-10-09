// Mapa do evento: coordenadas validadas e links dos aplicativos de mapa (a folha "Abrir no mapa").

// PostgREST pode devolver numeric como texto; '' e null não viram 0. Texto só no formato -12.345 (nada de "0x10", "1e9", vírgula).
const numero = (v: unknown): number => (typeof v === 'number' ? v : typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : NaN)

export function coordenadasValidas(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  const a = numero(lat), o = numero(lng)
  // latitude até 85,05° (limite do Web Mercator); (0, 0) exatos é o "campo vazio" (ilha nula), não um lugar
  return Number.isFinite(a) && Number.isFinite(o) && Math.abs(a) <= 85.05 && Math.abs(o) <= 180 && !(a === 0 && o === 0) ? { lat: a, lng: o } : null
}

const seis = (n: number) => n.toFixed(6)

export interface LinkMapa { id: 'google' | 'waze' | 'apple'; nome: string; href: string }

// `consulta` = nome, endereço e cidade em texto; `googleSemCoord` = o mapaUrl que a página já tem
export function linksDeMapa(o: { coords: { lat: number; lng: number } | null; consulta: string; nome: string; googleSemCoord: string }, apple: boolean): LinkMapa[] {
  const { coords: c, consulta, nome } = o
  const par = c ? encodeURIComponent(`${seis(c.lat)},${seis(c.lng)}`) : ''
  const g = { id: 'google', nome: 'Google Maps', href: c ? `https://www.google.com/maps/search/?api=1&query=${par}` : o.googleSemCoord } as const
  const w = { id: 'waze', nome: 'Waze', href: c ? `https://waze.com/ul?ll=${par}&navigate=yes&zoom=17` : `https://waze.com/ul?q=${encodeURIComponent(consulta)}&navigate=yes` } as const
  const a = { id: 'apple', nome: 'Apple Mapas', href: c ? `https://maps.apple.com/?ll=${par}&q=${encodeURIComponent(nome)}` : `https://maps.apple.com/?q=${encodeURIComponent(consulta)}` } as const
  return apple ? [a, g, w] : [g, w, a]
}

// iPhone, iPad e Mac: Apple Mapas primeiro. Sem navigator (SSR): Google primeiro.
export const ehApple = (ua = typeof navigator === 'undefined' ? '' : navigator.userAgent) => /iPhone|iPad|iPod|Macintosh|Mac OS X/.test(ua)
