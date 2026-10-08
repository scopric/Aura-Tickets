import type { ReactNode } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useCodigoIngresso } from '../hooks/useCodigoIngresso'

// O QR de entrada (Decisão 211): muda a cada 30 s, então print e encaminhamento não valem. Gerado no navegador a partir da lista que o servidor
// entrega (hooks/useCodigoIngresso). Sem internet usa a lista guardada enquanto ela valer. Nunca mostra o código fixo do ingresso.
export default function QrDinamico({ ingresso, tamanho, aoAmpliar, classe = '' }: {
  ingresso: { id: string; user_id: string }
  tamanho: number
  aoAmpliar?: () => void // com ele, o QR vira o botão "Ampliar"
  classe?: string // visual da placa branca (do chamador)
}) {
  const { estado, qr, restanteS, horas, tentarDeNovo } = useCodigoIngresso(ingresso.user_id, ingresso.id)

  if (qr) {
    const conteudo: ReactNode = (
      <>
        <QRCodeSVG value={qr} size={tamanho} marginSize={4} title="QR de entrada: muda a cada 30 segundos" className="mx-auto block h-auto w-full" style={{ maxWidth: tamanho }} />
        <span className="mt-2 block h-1 w-full overflow-hidden rounded-full bg-[#e6e8ec]" aria-hidden="true">
          <span className="block h-full rounded-full bg-[#0b0d12] transition-[width] duration-1000 ease-linear motion-reduce:transition-none" style={{ width: `${Math.min(100, (restanteS / 30) * 100)}%` }} />
        </span>
        <span className="mt-1.5 block text-xs font-medium leading-4 text-[#5b6472]">Este QR muda a cada 30 segundos. Print não vale.</span>
        {estado === 'sem-rede' && <span className="block text-xs font-medium leading-4 text-[#5b6472]">Sem internet: o QR segue valendo por mais {Math.max(1, Math.floor(horas))} h.</span>}
      </>
    )
    return aoAmpliar
      ? <button type="button" onClick={aoAmpliar} aria-label="Ampliar o QR Code do ingresso" className={classe}>{conteudo}<span className="block text-xs font-medium leading-4 text-[#5b6472]">Toque para ampliar</span></button>
      : <div className={classe}>{conteudo}</div>
  }

  return (
    <div className={classe} role="status">
      <div className="flex min-h-[160px] flex-col items-center justify-center gap-2 px-2 py-4 text-center">
        {estado === 'carregando' && <p className="text-sm font-medium text-[#5b6472]">Carregando o QR…</p>}
        {(estado === 'sem-lista' || estado === 'vencida' || estado === 'falha') && (
          <>
            <p className="text-sm font-medium text-[#0b0d12]">
              {estado === 'vencida' ? 'Sem internet, e o QR guardado no aparelho venceu.' : estado === 'sem-lista' ? 'Sem internet para carregar o QR.' : 'Não consegui carregar o QR.'}
            </p>
            <p className="text-xs text-[#5b6472]">{estado === 'falha' ? 'Tente de novo em instantes.' : 'Conecte-se para atualizar.'}</p>
            <button type="button" onClick={tentarDeNovo} className="mt-1 min-h-11 rounded-lg bg-[#f4f5f7] px-4 text-sm font-semibold text-[#0b0d12] shadow-[0_0_0_1px_rgb(11_13_18/0.10)]">Tentar de novo</button>
          </>
        )}
        {estado === 'indisponivel' && <p className="text-sm font-medium text-[#0b0d12]">Este ingresso não está disponível para entrada.</p>}
      </div>
    </div>
  )
}
