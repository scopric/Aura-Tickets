import { useState } from 'react'
import { Loader2, QrCode } from 'lucide-react'

interface TicketQRCodeProps {
  code: string
  size?: number
  className?: string
}

export default function TicketQRCode({ code, size = 200, className = '' }: TicketQRCodeProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(code)}`

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
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-canvas rounded-xl">
          <Loader2 className="w-6 h-6 text-plum animate-spin" />
        </div>
      )}
      {error ? (
        <div className="w-full h-full flex flex-col items-center justify-center bg-canvas rounded-xl p-4">
          <QrCode className="w-10 h-10 text-espresso/20 mb-2" />
          <span className="text-[10px] text-espresso/40 text-center font-mono break-all">{code}</span>
        </div>
      ) : (
        <img
          src={qrUrl}
          alt={`QR Code: ${code}`}
          className="w-full h-full object-contain rounded-xl"
          onLoad={() => setLoading(false)}
          onError={() => { setLoading(false); setError(true) }}
        />
      )}
    </div>
  )
}
