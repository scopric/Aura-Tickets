import { useState } from 'react'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import type { DbTask } from '../../../hooks/useProducerTools'
import { MAX_PARADAS_ROTEIRO, haversineKm, kmTexto, linkRoteiro, paradasDoRoteiro, temCoordenadas, type Ponto } from '../../../lib/quadroMapa'

/** Cartões abertos com local, por prazo (ou por proximidade, se a pessoa pedir), com a distância em linha reta entre paradas */
export default function RoteiroLocais({ tarefas, concluida }: { tarefas: DbTask[]; concluida: (t: DbTask) => boolean }) {
  // A posição fica só neste estado (memória da página): ordena a lista e nada mais. Não vai para o banco, nem para o link.
  const [minha, setMinha] = useState<Ponto | null>(null)
  const [aviso, setAviso] = useState('')
  const paradas = paradasDoRoteiro(tarefas, concluida, minha)
  const rota = linkRoteiro(paradas)
  const url = rota?.url
  const usadas = rota?.usadas ?? 0
  const cortadas = Math.min(paradas.length, MAX_PARADAS_ROTEIRO) - usadas

  const pedir = () => {
    if (!navigator.geolocation) { setAviso('Este navegador não oferece localização.'); return }
    navigator.geolocation.getCurrentPosition(
      p => { setAviso(''); setMinha({ lat: p.coords.latitude, lng: p.coords.longitude }) },
      e => setAviso(e.code === 1 ? 'Permissão de localização negada.' : 'Não foi possível obter a localização.'),
      { timeout: 8000, maximumAge: 60_000 },
    )
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">Cartões abertos com local, {minha ? 'do mais perto ao mais longe de você' : 'pela ordem do prazo'}. A distância é em linha reta, não a do caminho.</p>
      {paradas.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum cartão aberto tem local ainda.</p> : (
        <ol className="grid gap-1.5">
          {paradas.map((p, i) => {
            const antes = i === 0 ? minha : paradas[i - 1].local
            const km = antes && temCoordenadas(antes) && temCoordenadas(p.local) ? haversineKm(antes, p.local) : null
            return (
              <li key={p.id} className="rounded-md border border-border p-2.5 text-sm">
                <b className="break-words font-medium">{i + 1}. {p.titulo}</b>
                <p className="break-words text-xs text-muted-foreground">{p.local.txt ?? `${p.local.lat}, ${p.local.lng}`}{km !== null && ` · ${kmTexto(km)} ${i === 0 ? 'de você' : 'da parada anterior'}`}</p>
                {i >= usadas && rota && <p className="text-xs text-[var(--ev-warning)]">Fora do roteiro: o limite é {MAX_PARADAS_ROTEIRO} paradas{i < MAX_PARADAS_ROTEIRO && ', e o link do Google não comporta mais'}.</p>}
              </li>
            )
          })}
        </ol>
      )}
      {cortadas > 0 && <p role="status" className="text-xs text-[var(--ev-warning)]">Os endereços são longos: o link do Google comporta só {usadas} {usadas === 1 ? 'parada' : 'paradas'}.</p>}
      {paradas.length > 1 && <p className="text-xs text-muted-foreground">No celular, o Google Maps aceita menos paradas do que no computador (cerca de 3 intermediárias). Se a rota vier incompleta, abra no computador.</p>}
      <div className="flex flex-wrap gap-2">
        {url && <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:shadow-ev-foco sm:min-h-8"><I.AbrirExterno aria-hidden="true" />Abrir roteiro no Google Maps ({usadas} {usadas === 1 ? 'parada' : 'paradas'})</a>}
        {minha
          ? <Button variant="outline" size="sm" className="min-h-11 sm:min-h-8" onClick={() => setMinha(null)}>Parar de usar minha localização</Button>
          : <Button variant="outline" size="sm" className="min-h-11 sm:min-h-8" onClick={pedir}><I.Local aria-hidden="true" />Usar minha localização</Button>}
      </div>
      {aviso && <p role="alert" className="text-sm text-destructive">{aviso}</p>}
      <p className="text-xs text-muted-foreground">Sua localização só é pedida ao apertar o botão, fica só nesta página para ordenar a lista e some ao fechá-la. Não é gravada nem enviada.</p>
    </div>
  )
}
