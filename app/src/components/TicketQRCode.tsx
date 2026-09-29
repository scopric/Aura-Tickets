import { QrCode } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

interface TicketQRCodeProps {
  code: string
  size?: number
  className?: string
}

// Gerado no navegador: o código do ingresso é a credencial de check-in e não sai para serviço de terceiros.
export default function TicketQRCode({ code, size = 200, className = '' }: TicketQRCodeProps) {
  if (!code) {
    return (
      <div
        className={`flex items-center justify-center bg-canvas rounded-xl ${className}`}
        style={{ width: size, height: size }}
      >
        <QrCode className="w-1/3 h-1/3 text-espresso/20" />
      </div>
    )
  }

  return (
    <QRCodeSVG value={code} size={size} marginSize={4} title={`QR Code do ingresso ${code}`} className={className} />
  )
}
