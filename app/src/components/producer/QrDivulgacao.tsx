import { useRef } from 'react'
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { baixarArquivo } from '../../lib/divulgacao'

// QR do link (fundo branco e traço preto de propósito: é o que a câmera lê, no tema claro ou escuro) com download em PNG e SVG.
// O PNG sai de um canvas escondido maior (512 px); o SVG, do desenho da tela.
export default function QrDivulgacao({ url, nomeArquivo, titulo }: { url: string; nomeArquivo: string; titulo: string }) {
  const svg = useRef<SVGSVGElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)

  const baixarPng = () => {
    const png = canvas.current?.toDataURL('image/png')
    if (png) baixarArquivo(`${nomeArquivo}.png`, png); else toast.error('Não foi possível gerar o PNG.')
  }
  const baixarSvg = () => {
    if (!svg.current) return
    baixarArquivo(`${nomeArquivo}.svg`, new Blob([new XMLSerializer().serializeToString(svg.current)], { type: 'image/svg+xml' }))
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <QRCodeSVG ref={svg} value={url} size={176} marginSize={2} title={titulo} className="rounded-[10px] border border-border" />
      <QRCodeCanvas ref={canvas} value={url} size={512} marginSize={2} className="hidden" aria-hidden="true" />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="min-h-11" onClick={baixarPng}><I.Baixar aria-hidden="true" />Baixar PNG</Button>
        <Button variant="outline" className="min-h-11" onClick={baixarSvg}><I.Baixar aria-hidden="true" />Baixar SVG</Button>
      </div>
    </div>
  )
}
