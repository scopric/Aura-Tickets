import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { pdfParaImagem, reduzirPlanta, validarArquivoPlanta } from '../../../lib/plantaFundo'
import type { Fundo } from './modelo'
import { MAX_METROS_CALIBRAR } from './geometria'

export type ModoPlanta = '' | 'mover' | 'calibrar'

const ENVIO_PADRAO = { scale: 1, offset: { x: 100, y: 80 }, opacity: 0.4 } // mesmo envio do editor antigo
const AVISO_PESADA = 600_000 // bytes; o reduzirPlanta mira em 300 KB e desiste em qualidade 0,4

// Carrega o data URL; imagem inválida vira `erro` em vez de quebrar o mapa
export function usarImagem(src: string | undefined) {
  const [r, setR] = useState<{ img?: HTMLImageElement; erro?: boolean }>({})
  useEffect(() => {
    setR({})
    if (!src) return
    const img = new window.Image()
    img.onload = () => setR({ img })
    img.onerror = () => setR({ erro: true })
    img.src = src
  }, [src])
  return r
}

export default function PlantaFundo({ envsCount, eventId, fundo, onFundo, modo, onModo, erroImagem }: {
  envsCount: number; eventId: string | null; fundo: Fundo | null; onFundo: (f: Fundo | null) => void; modo: ModoPlanta; onModo: (m: ModoPlanta) => void; erroImagem: boolean
}) {
  const arq = useRef<HTMLInputElement>(null)
  const [lendo, setLendo] = useState(false)
  // envio demorado (PDF) que termina depois de trocar de evento ou sair da tela é descartado
  const vivo = useRef(true)
  const eventoAtual = useRef(eventId)
  eventoAtual.current = eventId
  useEffect(() => { vivo.current = true; return () => { vivo.current = false } }, [])
  const enviar = async (a: File | undefined) => {
    if (!a) return
    const v = validarArquivoPlanta(a)
    if (v.erro) { toast.error(v.erro); return }
    const doEvento = eventId
    setLendo(true)
    try {
      const image = await reduzirPlanta(v.pdf ? await pdfParaImagem(a) : a)
      if (!vivo.current || eventoAtual.current !== doEvento) return
      onFundo({ image, ...ENVIO_PADRAO })
      onModo('')
      toast.success(v.pdf ? 'Página 1 do PDF carregada como planta de fundo.' : 'Imagem da planta carregada como fundo.')
      if (image.length * 0.75 > AVISO_PESADA) toast.warning('A planta ficou pesada mesmo reduzida; o mapa pode demorar a abrir. Prefira uma imagem mais simples.', { duration: 6500 })
    } catch {
      toast.error(v.pdf ? 'Não consegui abrir esse PDF. Confira se ele não tem senha ou use uma imagem.' : 'Não consegui ler essa imagem. Use PNG, JPG ou WebP.')
    } finally { if (vivo.current) setLendo(false) }
  }
  const remover = () => {
    if (!window.confirm('Remover a planta de fundo? O mapa não muda; dá para enviar a planta de novo depois.')) return
    onModo('')
    onFundo(null)
  }
  const ajustar = (p: Partial<Fundo>) => fundo && onFundo({ ...fundo, ...p })
  return (
    <section aria-label="Planta de fundo" className="space-y-2">
      <h2 className="text-xs font-semibold uppercase text-muted-foreground">Planta de fundo</h2>
      <input ref={arq} type="file" accept="image/*,application/pdf" className="sr-only" aria-label="Arquivo da planta" onChange={e => { enviar(e.target.files?.[0]); e.target.value = '' }} />
      <Button size="sm" variant="outline" className="w-full max-lg:h-10" disabled={lendo} onClick={() => arq.current?.click()}>
        {lendo ? 'Lendo…' : fundo ? 'Trocar a planta (imagem ou PDF)' : 'Enviar imagem ou PDF'}
      </Button>
      {envsCount > 1 && <p className="text-xs text-muted-foreground">A planta é a mesma em todos os pavimentos; a escala é do pavimento ativo.</p>}
      {!fundo && <p className="text-xs text-muted-foreground">Até 15 MB. Fica sob o mapa, como guia para posicionar e medir.</p>}
      {fundo && (
        <>
          {erroImagem && <p role="alert" className="text-xs text-destructive">Não consegui exibir a planta salva (imagem inválida). Troque ou remova.</p>}
          <label className="block text-xs text-muted-foreground">Opacidade: <strong className="text-foreground">{Math.round(fundo.opacity * 100)}%</strong>
            <input type="range" min={10} max={100} value={Math.round(fundo.opacity * 100)} onChange={e => ajustar({ opacity: Number(e.target.value) / 100 })} className="block w-full accent-primary" />
          </label>
          <label className="block text-xs text-muted-foreground">Escala da planta: <strong className="text-foreground">{Math.round(fundo.scale * 100)}%</strong>
            <input type="range" min={20} max={200} value={Math.round(fundo.scale * 100)} onChange={e => ajustar({ scale: Number(e.target.value) / 100 })} className="block w-full accent-primary" />
          </label>
          <Button size="sm" variant={modo === 'mover' ? 'default' : 'outline'} aria-pressed={modo === 'mover'} className="w-full max-lg:h-10" onClick={() => onModo(modo === 'mover' ? '' : 'mover')}>Mover planta</Button>
          <Button size="sm" variant={modo === 'calibrar' ? 'default' : 'outline'} aria-pressed={modo === 'calibrar'} className="w-full max-lg:h-10" onClick={() => onModo(modo === 'calibrar' ? '' : 'calibrar')}>Calibrar escala</Button>
          <Button size="sm" variant="outline" className="w-full border-destructive text-destructive max-lg:h-10" onClick={remover}>Remover planta</Button>
        </>
      )}
    </section>
  )
}

// Faixa sobre o mapa (a gaveta fecha ao iniciar o modo): instrução, distância real e confirmar/cancelar
export function FaixaPlanta({ modo, pontos, ppm, onAplicar, onCancelar }: {
  modo: ModoPlanta; pontos: number; ppm: number; onAplicar: (metros: number) => string | null; onCancelar: () => void
}) {
  const [txt, setTxt] = useState('')
  const [erro, setErro] = useState('')
  useEffect(() => { setTxt(''); setErro('') }, [modo])
  if (!modo) return null
  const aplicar = () => setErro(onAplicar(Number(txt.replace(',', '.'))) ?? '')
  return (
    <div role="status" className="absolute left-1/2 top-12 z-10 flex max-w-[94%] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs shadow-md">
      {modo === 'mover' && <span>Arraste a planta para posicioná-la.</span>}
      {modo === 'calibrar' && pontos < 2 && <span>Clique no ponto {pontos + 1} de 2 sobre a planta (uma distância que você conhece).</span>}
      {modo === 'calibrar' && pontos === 2 && (
        <>
          <label className="flex items-center gap-1">Distância real (m)
            <input type="text" inputMode="decimal" aria-label="Distância real em metros" autoFocus value={txt} maxLength={8} placeholder={`até ${MAX_METROS_CALIBRAR}`}
              onChange={e => { setTxt(e.target.value); setErro('') }}
              onKeyDown={e => { if (e.key === 'Enter') aplicar(); if (e.key === 'Escape') onCancelar() }}
              className="h-8 w-24 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 max-lg:h-10" />
          </label>
          <Button size="sm" className="max-lg:h-10" onClick={aplicar}>Aplicar escala</Button>
          <span className="text-muted-foreground">Hoje: 1 m = {ppm} px</span>
        </>
      )}
      <Button size="sm" variant="outline" className="max-lg:h-10" onClick={onCancelar}>{modo === 'mover' ? 'Concluir' : 'Cancelar (Esc)'}</Button>
      {erro && <span role="alert" className="w-full text-center text-destructive">{erro}</span>}
    </div>
  )
}
