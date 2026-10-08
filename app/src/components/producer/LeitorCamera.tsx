import { useEffect, useRef, useState } from 'react'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { codigoCompleto, codigoCurto, normalizarCodigo } from '../../lib/checkin'

// Leitor de QR pela câmera (produtor e equipe). A câmera só abre no clique e para ao fechar, desmontar ou esconder a página.
// O texto lido segue para o mesmo fluxo de validação do leitor USB/digitação (onLeitura); o conteúdo do QR nunca é logado.
const INTERVALO_MS = 250 // ponytail: sondagem simples; requestVideoFrameCallback se precisar de mais quadros
const PAUSA_MS = 1500 // depois de cada leitura, para não ler o mesmo ingresso duas vezes
const LARGURA_MAX = 480 // quadro reduzido para o jsQR

type Estado = 'parada' | 'iniciando' | 'ativa'
type Detector = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> }
type TrilhaComLanterna = { getCapabilities?: () => { torch?: boolean } } // torch ainda não está nos tipos do DOM

function mensagemDoErro(e: unknown): string {
  const nome = (e as { name?: string })?.name
  if (nome === 'NotAllowedError' || nome === 'SecurityError') return 'A câmera foi bloqueada. Libere a câmera para este site nas configurações do navegador ou digite o código abaixo.'
  if (nome === 'NotFoundError' || nome === 'DevicesNotFoundError' || nome === 'OverconstrainedError') return 'Nenhuma câmera encontrada neste aparelho. Digite o código abaixo.'
  if (nome === 'NotReadableError' || nome === 'AbortError') return 'A câmera está sendo usada por outro aplicativo. Feche-o e tente de novo, ou digite o código abaixo.'
  return 'Não foi possível abrir a câmera. Tente de novo ou digite o código abaixo.'
}

export default function LeitorCamera({ onLeitura, ocupado = false, codigoNaTela }: {
  /** recebe o código já normalizado (uuid em minúsculas) */
  onLeitura: (codigo: string) => void
  /** validação em andamento: não lê enquanto isso */
  ocupado?: boolean
  /** código do cartão de resultado que está na tela: a mesma leitura repetida é ignorada */
  codigoNaTela?: string
}) {
  const [estado, setEstado] = useState<Estado>('parada')
  const [aviso, setAviso] = useState('')
  const [lanterna, setLanterna] = useState<boolean | null>(null) // null = aparelho sem lanterna
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const sessaoRef = useRef(0) // invalida laço e pedido de câmera antigos
  const pausadoAte = useRef(0)
  // props lidas pelo laço sem reiniciá-lo
  const vivo = useRef({ onLeitura, ocupado, codigoNaTela })
  vivo.current = { onLeitura, ocupado, codigoNaTela }

  const parar = () => {
    sessaoRef.current++
    clearTimeout(timerRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setLanterna(null)
    setEstado('parada')
  }

  // saiu da tela (desmontou) ou escondeu a página: a câmera não fica ligada
  useEffect(() => {
    const aoEsconder = () => {
      if (document.visibilityState === 'hidden' && streamRef.current) { parar(); setAviso('A câmera foi desligada porque você saiu da página. Toque em "Ler com a câmera" para continuar.') }
    }
    document.addEventListener('visibilitychange', aoEsconder)
    return () => { document.removeEventListener('visibilitychange', aoEsconder); parar() }
  }, [])

  const abrir = async () => {
    setAviso('')
    if (typeof window !== 'undefined' && window.isSecureContext === false) return setAviso('A câmera só funciona em conexão segura (HTTPS). Abra o endereço com https:// ou digite o código abaixo.')
    if (!navigator.mediaDevices?.getUserMedia) return setAviso('Este navegador não deixa usar a câmera. Digite o código abaixo.')
    parar()
    const sessao = sessaoRef.current
    setEstado('iniciando')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      if (sessao !== sessaoRef.current) { stream.getTracks().forEach(t => t.stop()); return } // fechou enquanto pedia permissão
      streamRef.current = stream
      const video = videoRef.current!
      video.muted = true // iOS Safari só toca sem som e em linha
      video.srcObject = stream
      try { await video.play() } catch { /* o clique que abriu a câmera é o gesto que o iOS exige; se negar, o quadro não anda e o usuário digita */ }
      if (sessao !== sessaoRef.current) return // fechou durante o play(): parar() já desligou tudo
      const caps = (stream.getVideoTracks()[0] as unknown as TrilhaComLanterna | undefined)?.getCapabilities?.()
      setLanterna(caps?.torch ? false : null)
      setEstado('ativa')

      let detector: Detector | null = null
      try {
        const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector
        if (BD) detector = new BD({ formats: ['qr_code'] })
      } catch { detector = null }
      // jsQR só baixa quando o navegador não tem BarcodeDetector (ou ele falha)
      let jsQR: typeof import('jsqr').default | null = null
      let canvas: HTMLCanvasElement | null = null
      const ler = async (): Promise<string | null> => {
        if (detector) {
          try { return (await detector.detect(video))[0]?.rawValue ?? null } catch { detector = null }
        }
        if (!jsQR) jsQR = (await import('jsqr')).default
        canvas ??= document.createElement('canvas')
        const w = Math.min(video.videoWidth, LARGURA_MAX)
        if (!w) return null
        const h = Math.round((video.videoHeight / video.videoWidth) * w)
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return null
        ctx.drawImage(video, 0, 0, w, h)
        const img = ctx.getImageData(0, 0, w, h)
        return jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' })?.data ?? null
      }

      const passo = async () => {
        if (sessao !== sessaoRef.current) return
        if (!vivo.current.ocupado && Date.now() >= pausadoAte.current && video.readyState >= 2) {
          let texto: string | null = null
          try { texto = await ler() } catch {
            if (sessao === sessaoRef.current) { parar(); setAviso('Não foi possível ler a imagem da câmera. Tente de novo ou digite o código abaixo.') }
            return
          }
          if (sessao !== sessaoRef.current) return
          const codigo = texto ? normalizarCodigo(texto) : ''
          if (codigo && codigo !== vivo.current.codigoNaTela) {
            pausadoAte.current = Date.now() + PAUSA_MS
            // só ingresso Evokaa segue para o servidor; o texto de outros QR nunca vai para a tela nem para a rede
            if (codigoCompleto(codigo) || codigoCurto(codigo)) {
              setAviso('')
              navigator.vibrate?.(60)
              vivo.current.onLeitura(codigo)
            } else setAviso('Este QR não é de um ingresso Evokaa.')
          }
        }
        timerRef.current = setTimeout(passo, INTERVALO_MS)
      }
      timerRef.current = setTimeout(passo, INTERVALO_MS)
    } catch (e) {
      if (sessao === sessaoRef.current) { parar(); setAviso(mensagemDoErro(e)) }
    }
  }

  const alternarLanterna = async () => {
    const trilha = streamRef.current?.getVideoTracks()[0]
    if (!trilha || lanterna === null) return
    try {
      await trilha.applyConstraints({ advanced: [{ torch: !lanterna } as MediaTrackConstraintSet] })
      setLanterna(!lanterna)
    } catch { setAviso('Este aparelho não deixou acender a lanterna.') }
  }

  const aberta = estado !== 'parada'
  return (
    <div>
      {!aberta && (
        <Button type="button" className="min-h-14 w-full text-base sm:mx-auto sm:w-auto sm:min-w-64" onClick={abrir}>
          <I.Camera aria-hidden="true" />Ler com a câmera
        </Button>
      )}
      {aviso && <p role="alert" className="mx-auto mt-3 max-w-md text-sm text-foreground">{aviso}</p>}
      <div className={aberta ? 'mx-auto mt-3 max-w-md' : 'hidden'}>
        <div className="relative overflow-hidden rounded-[10px] border border-border bg-black">
          <video ref={videoRef} playsInline muted aria-label="Imagem da câmera" className="aspect-[4/3] w-full object-cover" />
          {estado === 'iniciando' && <p role="status" className="absolute inset-0 flex items-center justify-center text-sm text-white">Abrindo a câmera…</p>}
        </div>
        <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">Aponte para o QR do ingresso. Também dá para digitar o código no campo abaixo.</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {lanterna !== null && (
            <Button type="button" variant="outline" className="min-h-11" aria-pressed={lanterna} onClick={alternarLanterna}>{lanterna ? 'Apagar lanterna' : 'Acender lanterna'}</Button>
          )}
          <Button type="button" variant="outline" className="min-h-11" onClick={parar}><I.Fechar aria-hidden="true" />Fechar câmera</Button>
        </div>
      </div>
    </div>
  )
}
