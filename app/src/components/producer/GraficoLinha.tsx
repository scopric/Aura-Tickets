import { useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'

// Gráfico de linha do Início (contrato v3.4, 7.1): série do período em --primary 2 px com preenchimento a 8%, período
// anterior tracejado em cinza, eixo Y à direita sem linha própria, 3 linhas de grade e eixo X sem rótulo girado.
// SVG puro (sem Recharts): a série tem no máximo ~90 pontos e o gráfico precisa funcionar também no teste.
const ALTURA = 240
const Y = [12, 120, 228] // linhas de grade (topo, meio, base)
const LARGURA = 800

// Teto "redondo" do eixo; contagem (inteiro) só usa tetos cuja metade também é inteira
function teto(m: number, inteiro: boolean): number {
  if (m <= 0) return 1
  if (inteiro && m <= 10) return m <= 2 ? 2 : m <= 4 ? 4 : 10
  const p = 10 ** Math.floor(Math.log10(m))
  const f = m / p
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p
}

// Posição do ponto i entre 0 e 1 (um ponto só fica no meio) e sua altura em px
const px = (i: number, n: number) => (n > 1 ? i / (n - 1) : 0.5)
const py = (y: number, max: number) => Y[2] - (y / max) * (Y[2] - Y[0])
// v começa no ponto de índice `de` da série (para desenhar só um trecho)
const caminho = (v: number[], n: number, max: number, de = 0) =>
  v.map((y, i) => `${i ? 'L' : 'M'}${(px(de + i, n) * LARGURA).toFixed(1)} ${py(y, max).toFixed(1)}`).join(' ')

export default function GraficoLinha({ atual, anterior, n, inteiro = false, formatoValor, formatoEixo, rotulo, rotuloEixo, ultimoParcial = true, legendaAtual, legendaAnterior, resumo, vazio }: {
  atual: number[] // pode ter menos de n pontos (o que ainda não aconteceu não entra)
  anterior: number[] | null
  n: number
  inteiro?: boolean
  formatoValor: (v: number) => string
  formatoEixo: (v: number) => string
  rotulo: (k: number) => string
  /** texto curto do eixo (padrão: o mesmo da dica); a dica e a tabela mantêm o texto completo */
  rotuloEixo?: (k: number) => string
  /** o último ponto é de um período ainda em curso (dia de hoje): trecho final tracejado. Falso quando o período já fechou (ex.: festa encerrada) */
  ultimoParcial?: boolean
  legendaAtual: string
  legendaAnterior: string
  /** texto lido por quem usa leitor de tela (o gráfico em si é imagem) */
  resumo: string
  /** sem dado no período: grade e linha zerada, com este conteúdo no centro */
  vazio?: ReactNode
}) {
  const [hi, setHi] = useState<number | null>(null)
  const max = teto(Math.max(0, ...atual, ...(anterior ?? [])), inteiro)
  const x = (i: number) => px(i, n)
  const ultimo = atual.length - 1

  const marcas = Array.from({ length: Math.min(n, 7) }, (_, i) => (n > 1 ? Math.round((i * (n - 1)) / (Math.min(n, 7) - 1 || 1)) : 0))

  const mover = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const i = Math.round(((e.clientX - r.left) / r.width) * (n - 1))
    setHi(Math.max(0, Math.min(ultimo, i)))
  }
  const tecla = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') return setHi(null)
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    setHi(h => Math.max(0, Math.min(ultimo, (h ?? ultimo) + (e.key === 'ArrowRight' ? 1 : -1))))
  }

  // sempre montada: leitor de tela só anuncia mudança de texto numa região que já existia
  const dica = hi != null && !vazio ? `${rotulo(hi)}: ${formatoValor(atual[hi])}${anterior ? `, período anterior ${formatoValor(anterior[hi])}` : ''}` : ''

  return (
    <div>
      <div
        className="relative mx-5 mr-16 mt-5 rounded-sm outline-none focus-visible:shadow-ev-foco"
        style={{ height: ALTURA }}
        tabIndex={vazio ? undefined : 0}
        role={vazio ? undefined : 'img'} // com role=img o botão do estado vazio ficaria escondido do leitor de tela
        aria-label={vazio ? undefined : resumo}
        onPointerMove={vazio ? undefined : mover}
        onPointerLeave={() => setHi(null)}
        onKeyDown={vazio ? undefined : tecla}
        onBlur={() => setHi(null)}
      >
        <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} preserveAspectRatio="none" width="100%" height={ALTURA} aria-hidden="true" focusable="false" className="block overflow-visible">
          {Y.map(y => <line key={y} x1="0" x2={LARGURA} y1={y} y2={y} className="stroke-border" vectorEffect="non-scaling-stroke" />)}
          {vazio ? (
            <path d={`M0 ${Y[2]} H${LARGURA}`} fill="none" className="stroke-border" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          ) : (
            <>
              {anterior && <path d={caminho(anterior, n, max)} fill="none" className="stroke-muted-foreground" strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />}
              {atual.length > 1 && <path d={`${caminho(atual, n, max)} L${(x(ultimo) * LARGURA).toFixed(1)} ${Y[2]} L${(x(0) * LARGURA).toFixed(1)} ${Y[2]} Z`} className="fill-primary" fillOpacity="0.08" />}
              {(ultimoParcial ? atual.length > 2 : atual.length > 1) && <path d={caminho(ultimoParcial ? atual.slice(0, -1) : atual, n, max)} fill="none" className="stroke-primary" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
              {/* o último ponto é do dia (ou da hora) em curso: o trecho final é tracejado */}
              {ultimoParcial && atual.length > 1 && <path d={caminho(atual.slice(-2), n, max, ultimo - 1)} fill="none" className="stroke-primary" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
              {atual.length === 1 && <circle cx={LARGURA / 2} cy={py(atual[0], max)} r="3" className="fill-primary" />}
            </>
          )}
        </svg>

        {!vazio && [max, max / 2, 0].map((v, i) => (
          <span key={i} aria-hidden="true" className="absolute -right-14 -translate-y-1/2 text-[11px] font-medium leading-[14px] tabular-nums text-muted-foreground" style={{ top: Y[i] }}>
            {formatoEixo(v)}
          </span>
        ))}

        {hi != null && !vazio && (
          <>
            <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-px bg-muted-foreground/50" style={{ left: `${x(hi) * 100}%` }} />
            <span aria-hidden="true" className="pointer-events-none absolute -ml-1 -mt-1 size-2 rounded-full bg-primary shadow-[0_0_0_2px_hsl(var(--card))]" style={{ left: `${x(hi) * 100}%`, top: py(atual[hi], max) }} />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-2 z-10 whitespace-nowrap rounded-ev-sm bg-[var(--ev-indigo)] px-2.5 py-2 text-xs font-medium leading-4 text-white shadow-ev-2 dark:bg-foreground dark:text-background"
              style={{ left: `${x(hi) * 100}%`, transform: x(hi) > 0.6 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)' }}
            >
              <div className="opacity-70">{rotulo(hi)}</div>
              <div className="font-display text-sm font-semibold leading-5 tabular-nums">{formatoValor(atual[hi])}</div>
              {anterior && <div className="font-display tabular-nums opacity-70">anterior {formatoValor(anterior[hi])}</div>}
            </div>
          </>
        )}

        {vazio && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center text-sm text-muted-foreground">{vazio}</div>}
      </div>
      <span className="sr-only" aria-live="polite">{dica}</span>

      <div aria-hidden="true" className="mx-5 mr-16 mt-2 flex justify-between text-[11px] font-medium leading-[14px] tabular-nums text-muted-foreground">
        {marcas.map(k => <span key={k}>{(rotuloEixo ?? rotulo)(k)}</span>)}
      </div>

      {!vazio && (
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 pb-4 pt-3 text-xs leading-4 text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><svg width="14" height="2" aria-hidden="true"><line x1="0" x2="14" y1="1" y2="1" className="stroke-primary" strokeWidth="2" /></svg>{legendaAtual}</span>
          {anterior && <span className="inline-flex items-center gap-1.5"><svg width="14" height="2" aria-hidden="true"><line x1="0" x2="14" y1="1" y2="1" className="stroke-muted-foreground" strokeWidth="1.5" strokeDasharray="4 4" /></svg>{legendaAnterior}</span>}
        </p>
      )}
    </div>
  )
}
