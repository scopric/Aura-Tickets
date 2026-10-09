// Prévia do mapa (Leaflet + OpenStreetMap). Este arquivo só é carregado pelo import dinâmico de LocalRota,
// então o Leaflet e o CSS dele ficam num pedaço à parte e não entram no pacote principal.
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export default function MapaCartao({ lat, lng }: { lat: number; lng: number }) {
  const caixa = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!caixa.current) return
    const mapa = L.map(caixa.current, { scrollWheelZoom: false }).setView([lat, lng], 15)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(mapa)
    L.circleMarker([lat, lng], { radius: 9, color: '#fff', weight: 3, fillColor: '#8f33f5', fillOpacity: 1 }).addTo(mapa)
    return () => { mapa.remove() }
  }, [lat, lng])
  return <div ref={caixa} role="region" aria-label="Mapa do local" className="z-0 h-44 w-full overflow-hidden rounded-md border border-border" />
}
