import { useId, useState } from 'react'
import { Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import EventoCapa, { type EventoCapaDados } from '../EventoCapa'
import { prepararCapa, type CapaPronta } from '../../lib/capaEvento'
import { temFoto } from '../../lib/corEvento'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

// Campo "capa e cor do evento" do painel do evento (PainelEvento). A foto é preparada
// aqui (reduz e tira EXIF) mas só é enviada quando o pai salva: o banco não deixa apagar arquivo, então enviar a cada
// escolha encheria o limite de 10 por evento.
export default function CapaEventoCampo({ evento, urlAtual, capa, onCapa, onRemover, cor, corManual, onCor, intensidade, onIntensidade, naCor, onNaCor, podeEnviar = true, avisoAnalise = false, ocupado: salvando = false }: {
  evento: EventoCapaDados // título, data e id (semente do cartaz e do sorteio de cor) da prévia
  urlAtual?: string | null // capa já salva no evento (painel); some quando a pessoa remove
  capa: CapaPronta | null
  onCapa: (c: CapaPronta | null) => void
  onRemover: () => void
  cor: string
  corManual: boolean // a pessoa já escolheu a cor: uma foto nova não a troca pela sugestão
  onCor: (c: string, manual: boolean) => void
  intensidade: number // 10 a 100 (%): 100 = cor cheia; menos = mais suave, misturada com o fundo
  onIntensidade: (v: number) => void
  naCor: boolean // Decisão 173: false = foto original (padrão); true = duotone na cor do evento
  onNaCor: (v: boolean) => void
  podeEnviar?: boolean // só o dono do evento envia (a regra do Storage exige o dono no caminho)
  avisoAnalise?: boolean // painel: trocar a capa manda o evento para nova análise (Decisão 136)
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
      <EventoCapa evento={{ ...evento, cover_image: capa?.previewUrl ?? urlAtual ?? null, image_url: null, capa_na_cor: naCor, accent_intensity: intensidade }} cor={cor} tamanho="cartao" />
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
        {temCapa && (
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium text-foreground">Como a capa aparece</legend>
            <RadioGroup value={naCor ? 'cor' : 'original'} onValueChange={v => onNaCor(v === 'cor')} disabled={salvando} className="gap-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="original" id={`${id}-orig`} />
                <Label htmlFor={`${id}-orig`} className="font-normal">Foto original</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="cor" id={`${id}-na-cor`} />
                <Label htmlFor={`${id}-na-cor`} className="font-normal">Na cor do evento</Label>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              {naCor ? 'A foto vira um retrato em tons da cor do evento, preenchendo o espaço (as bordas podem cortar a arte).' : 'A arte aparece inteira, com as cores reais. O espaço que sobra é preenchido pela própria foto desfocada.'}
            </p>
          </fieldset>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-cor`}>Cor do evento</Label>
          <div className="flex items-center gap-3">
            <input id={`${id}-cor`} type="color" value={cor} onChange={e => onCor(e.target.value, true)} disabled={salvando}
              className="h-9 w-14 cursor-pointer rounded-md border border-input bg-transparent p-1 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50" />
            <span className="text-xs tabular-nums text-muted-foreground">{cor}</span>
          </div>
          <Label htmlFor={`${id}-int`} className="mt-1">Intensidade da cor: <span className="tabular-nums">{intensidade}%</span></Label>
          <input id={`${id}-int`} type="range" min={25} max={100} step={5} value={intensidade} onChange={e => onIntensidade(Number(e.target.value))} disabled={salvando}
            aria-valuetext={`${intensidade}%`} style={{ accentColor: cor }} className="w-full max-w-xs cursor-pointer focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50" />
          <p className="text-xs text-muted-foreground">100% é a cor cheia; menos deixa a cor mais suave, misturada com o fundo. Os textos continuam legíveis. Tinge o ingresso e os gráficos do evento (e a capa, em "Na cor do evento"). A sugestão vem da foto; você pode trocar.</p>
        </div>
        {avisoAnalise && podeEnviar && (
          <p className="rounded-lg border border-border bg-muted p-3 text-sm text-foreground">
            Trocar ou remover a foto manda o evento para nova análise da equipe antes de ele voltar ao ar. Mudar como a capa aparece vale na hora.
          </p>
        )}
      </div>
    </div>
  )
}
