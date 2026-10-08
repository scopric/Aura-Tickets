import { QRCodeSVG } from 'qrcode.react'
import { cn } from '@/lib/utils'
import { dataCurta, horaCurta } from '../../lib/ingresso'
import { corDoTopo, textoSobre, type EstiloIngresso } from '../../lib/ingressoEstilo'

export type DadosIngresso = { titulo: string; data: string; hora: string; local: string }
// 'pdf': o QR abre a página do ingresso. 'celular': o QR da página muda a cada cerca de 30 s (Decisão 211).
export type ModoIngresso = 'pdf' | 'celular'

const EXEMPLO = 'EXEMPLO-SEM-VALOR'

// O ingresso como o comprador recebe. Só desenha: a prévia do produtor e, depois, a tela do comprador usam o mesmo.
// Portador e QR são de exemplo e vêm marcados; o QR não leva nenhum código real.
export default function IngressoVisual({ dados, tipo, estilo, logoUrl, modo, exemplo = true }: {
  dados: DadosIngresso; tipo: string; estilo: EstiloIngresso; logoUrl: string | null; modo: ModoIngresso; exemplo?: boolean
}) {
  const topo = corDoTopo(estilo)
  const texto = textoSobre(topo)
  const quando = [dataCurta(dados.data), horaCurta(dados.hora)].filter(Boolean).join(' · ') || 'A definir'
  const campos: [string, string][] = [['Quando', quando], ['Local', dados.local || 'A definir'], ['Portador', 'Nome do comprador']]
  return (
    <figure
      aria-label={`Prévia do ingresso ${tipo}`}
      className={cn('relative mx-auto w-full max-w-[22rem] overflow-hidden rounded-[14px] border border-border bg-white text-[#0c2340]', modo === 'celular' && 'shadow-[0_1px_2px_rgb(0_0_0/0.12)]')}
    >
      <div className="px-5 pb-5 pt-4" style={{ background: topo, color: texto }}>
        <div className={cn('flex h-10 items-center', estilo.logo === 'centro' ? 'justify-center' : 'justify-start')}>
          {logoUrl
            ? <img src={logoUrl} alt="Logo da produtora" className="max-h-10 max-w-[9rem] object-contain" />
            : <span aria-hidden="true" className="rounded-md border border-dashed px-2 py-1 text-[11px] font-medium" style={{ borderColor: texto }}>Sua logo aqui</span>}
        </div>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.06em]">{tipo || 'Ingresso'}</p>
        <p className="mt-1 line-clamp-3 break-words font-display text-[22px] font-semibold leading-7">{dados.titulo || 'Nome do evento'}</p>
      </div>

      <dl className="grid gap-3 px-5 pt-4">
        {campos.map(([r, v]) => (
          <div key={r}>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#667385]">{r}</dt>
            <dd className="truncate text-[15px] font-semibold leading-5">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="grid justify-items-center gap-2 px-5 pb-4 pt-4">
        <QRCodeSVG value={EXEMPLO} size={132} marginSize={2} title="QR de exemplo, sem valor" />
        <p className="text-center text-[11px] leading-4 text-[#667385]">
          {modo === 'pdf' ? 'O QR abre a página do ingresso.' : 'O QR muda a cada cerca de 30 segundos.'}
        </p>
      </div>

      <p className="border-t border-[#e0e5ed] px-5 py-2 text-center font-display text-[11px] font-semibold text-[#4a60e3]">Evokaa</p>

      {exemplo && <span className="absolute right-3 top-3 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#0c2340]">Exemplo</span>}
    </figure>
  )
}
