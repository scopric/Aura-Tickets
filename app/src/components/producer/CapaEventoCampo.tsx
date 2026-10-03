import { useId, useState } from 'react'
import { Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import EventoCapa, { type EventoCapaDados } from '../EventoCapa'
import { prepararCapa, type CapaPronta } from '../../lib/capaEvento'
import { temFoto } from '../../lib/corEvento'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

// Campo "capa e cor do evento" dos formulários do produtor (NewEvent, EditEvent, EventPlanner). A foto é preparada
// aqui (reduz e tira EXIF) mas só é enviada quando o pai salva: o banco não deixa apagar arquivo, então enviar a cada
// escolha encheria o limite de 10 por evento.
export default function CapaEventoCampo({ evento, urlAtual, capa, onCapa, onRemover, cor, corManual, onCor, podeEnviar = true, avisoAnalise = false, ocupado: salvando = false }: {
  evento: EventoCapaDados // título, data e id (semente do cartaz e do sorteio de cor) da prévia
  urlAtual?: string | null // capa já salva no evento (EditEvent); some quando a pessoa remove
  capa: CapaPronta | null
  onCapa: (c: CapaPronta | null) => void
  onRemover: () => void
  cor: string
  corManual: boolean // a pessoa já escolheu a cor: uma foto nova não a troca pela sugestão
  onCor: (c: string, manual: boolean) => void
  podeEnviar?: boolean // só o dono do evento envia (a regra do Storage exige o dono no caminho)
  avisoAnalise?: boolean // EditEvent: trocar a capa manda o evento para nova análise (Decisão 136)
  ocupado?: boolean // o pai está salvando: trava as escolhas
}) {
  const id = useId()
  const [preparando, setPreparando] = useState(false)
  const ocupado = preparando || salvando
  const temCapa = !!capa || temFoto(urlAtual)

  async function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    e.target.value = '' // deixa escolher o mesmo arquivo de novo
    if (!arquivo) return
    setPreparando(true)
    try {
      const nova = await prepararCapa(arquivo, evento.id)
      if (capa) URL.revokeObjectURL(capa.previewUrl)
      onCapa(nova)
      if (!corManual) onCor(nova.cor, false) // sugestão da foto; a pessoa troca abaixo
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível usar essa foto.')
    } finally {
      setPreparando(false)
    }
  }

  function remover() {
    if (capa) URL.revokeObjectURL(capa.previewUrl)
    onCapa(null)
    onRemover()
  }

  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,15rem)_1fr]">
      <EventoCapa evento={{ ...evento, cover_image: capa?.previewUrl ?? urlAtual ?? null, image_url: null }} cor={cor} tamanho="cartao" />
      <div className="space-y-4">
        {podeEnviar ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Foto de capa</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline">
                <label className="cursor-pointer has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50">
                  <Upload aria-hidden="true" />{preparando ? 'Preparando…' : temCapa ? 'Trocar a foto' : 'Escolher a foto'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={escolher} disabled={ocupado} className="sr-only" />
                </label>
              </Button>
              {temCapa && <Button type="button" variant="ghost" onClick={remover} disabled={ocupado}><X aria-hidden="true" />Remover a foto</Button>}
            </div>
            <p className="text-xs text-muted-foreground">
              JPG, PNG ou WebP até 10 MB. A foto é reduzida para 1600×900 e os dados de localização dela são apagados. Sem foto, o evento ganha um cartaz com o nome e a data.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Só o dono do evento troca a foto de capa.</p>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-cor`}>Cor do evento</Label>
          <div className="flex items-center gap-3">
            <input id={`${id}-cor`} type="color" value={cor} onChange={e => onCor(e.target.value, true)} disabled={salvando}
              className="h-9 w-14 cursor-pointer rounded-md border border-input bg-transparent p-1 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50" />
            <span className="text-xs tabular-nums text-muted-foreground">{cor}</span>
          </div>
          <p className="text-xs text-muted-foreground">Tinge a capa, o ingresso e os gráficos do evento. A sugestão vem da foto; você pode trocar.</p>
        </div>
        {avisoAnalise && podeEnviar && (
          <p className="rounded-lg border border-border bg-muted p-3 text-sm text-foreground">
            Trocar ou remover a capa manda o evento para nova análise da equipe antes de ele voltar ao ar.
          </p>
        )}
      </div>
    </div>
  )
}
