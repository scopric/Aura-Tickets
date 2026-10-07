import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as TeclaReact } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { chamarEvo, creditos, RECUSAS } from '../../../lib/evo'
import { alternarTipo, contarPorTipo, pecasValidas, CUSTO_LEITURA, type PecaProposta } from '../../../lib/plantaIA'
import { MAX_BYTES } from '../../../../../supabase/functions/_shared/planta'
import { toolDefaults, typeLabels, type ToolType } from './modelo'
import { ITENS } from './paleta'

type Proposta = { imagem: string; eventId: string; pecas: PecaProposta[]; custo?: number; restante?: number }

const tipoExiste = (t: string) => !!ITENS[t] && (toolDefaults[t as ToolType]?.wMeter ?? 0) > 0
const nomeDoTipo = (t: string) => typeLabels[t as ToolType] || t

// A planta de fundo (já reduzida) vai ao Evo; a proposta volta para revisão e não toca no mapa.
// Fica no editor (não no painel) para a resposta de uma leitura já cobrada não se perder se o painel for fechado.
export function usarLeitorPlanta(eventId: string | null, imagem: string | undefined) {
  const [lendo, setLendo] = useState(false)
  const [proposta, setProposta] = useState<Proposta | null>(null)
  const atual = useRef({ eventId, imagem })
  atual.current = { eventId, imagem }
  const emVoo = useRef(false) // trava síncrona: dois cliques seguidos não chegam a duas chamadas (duas cobranças)
  useEffect(() => { setProposta(null); setLendo(false); emVoo.current = false }, [eventId])

  /** `aoTerminar` é chamado quando há proposta para revisar (reabre o painel se foi fechado durante a leitura). */
  const ler = async (aoTerminar: () => void) => {
    if (!eventId || !imagem || emVoo.current) return
    if (imagem.length * 0.75 > MAX_BYTES) { toast.error('A planta salva está pesada demais para a leitura (limite 1,5 MB). Troque a planta por uma imagem menor.'); return }
    emVoo.current = true
    setLendo(true)
    const doEvento = eventId
    let r: Awaited<ReturnType<typeof chamarEvo>>
    try { r = await chamarEvo({ mode: 'planta', event_id: doEvento, imagem }) } catch { r = { ok: false, motivo: 'rede' } }
    if (atual.current.eventId !== doEvento) return // trocou de evento: o efeito acima já soltou a trava
    emVoo.current = false
    setLendo(false)
    try {
      if (!r || typeof r !== 'object') throw new Error('resposta')
      if (!r.ok) {
        toast.error(r.motivo === 'sem_credito' && typeof r.custo === 'number' && typeof r.restante === 'number'
          ? `Esta leitura custa ${creditos(r.custo)} e você tem ${r.restante}.`
          : RECUSAS[r.motivo] ?? r.message ?? RECUSAS.erro_ia)
        return
      }
      if (atual.current.imagem !== imagem) { toast.info('A planta mudou durante a leitura; a proposta foi descartada. A leitura já foi cobrada.'); return }
      const bruto = Array.isArray(r.pecas) ? r.pecas.length : 0
      const pecas = pecasValidas(r.pecas, tipoExiste)
      if (pecas.length === 0) {
        toast.warning('A leitura não reconheceu nenhuma peça nessa planta. Ela foi cobrada; tente uma imagem mais nítida ou monte o mapa à mão.')
        return
      }
      const nums = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
      setProposta({ imagem, eventId: doEvento, pecas: pecas.map((p, i) => ({ ...p, id: `ia-${i}`, marcada: true })), custo: nums(r.custo), restante: nums(r.restante) })
      aoTerminar()
      const fora = bruto - pecas.length
      toast.success(`${pecas.length} peças propostas. Revise por cima da planta antes de aplicar.${fora > 0 ? ` ${fora} descartada(s) por tipo ou medida inválidos.` : ''}`)
    } catch {
      toast.error(RECUSAS.erro_ia)
    }
  }
  // a proposta é da planta e do evento em que foi lida: trocou ou tirou a planta, ela some
  const propostaAtual = proposta && proposta.imagem === imagem && proposta.eventId === eventId ? proposta : null
  const marcar = (fn: (p: PecaProposta[]) => PecaProposta[]) => setProposta(p => (p ? { ...p, pecas: fn(p.pecas) } : p))
  return {
    lendo, propostaAtual, ler, descartar: () => setProposta(null),
    alternarPeca: (id: string) => marcar(ps => ps.map(p => (p.id === id ? { ...p, marcada: !p.marcada } : p))),
    alternarTipo: (tipo: string) => marcar(ps => alternarTipo(ps, tipo)),
  }
}

type Leitor = ReturnType<typeof usarLeitorPlanta>

export default function PainelLeitor({ leitor, naoCalibrada, onLer, onAplicar, onFechar }: {
  leitor: Leitor; naoCalibrada: boolean; onLer: () => void; onAplicar: () => void; onFechar: () => void
}) {
  const { lendo, propostaAtual: prop } = leitor
  const raiz = useRef<HTMLDivElement>(null)
  // foco entra no painel ao abrir e volta ao botão que abriu ao fechar
  useEffect(() => {
    const antes = document.activeElement as HTMLElement | null
    return () => antes?.focus?.()
  }, [])
  useEffect(() => { raiz.current?.querySelector<HTMLElement>('button:not(:disabled)')?.focus() }, [!!prop])
  const descartar = () => { leitor.descartar(); onFechar() }
  const teclas = (e: TeclaReact) => {
    if (e.key === 'Escape') { e.stopPropagation(); if (prop) descartar(); else onFechar() }
    else if (e.key === 'Tab' && !prop) { // diálogo modal: o Tab não sai dele
      const f = [...raiz.current!.querySelectorAll<HTMLElement>('button:not(:disabled)')]
      if (!f.length) return
      const i = f.indexOf(document.activeElement as HTMLElement)
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus() }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus() }
    }
  }

  if (!prop) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onKeyDown={teclas}>
        <div ref={raiz} role="dialog" aria-modal="true" aria-labelledby="leitor-titulo" className="w-full max-w-md space-y-3 rounded-lg border border-border bg-card p-5 text-foreground shadow-xl">
          <h3 id="leitor-titulo" className="text-base font-bold">Ler planta com IA</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            A IA do Evo <strong>propõe</strong> peças (mesas, palco, bares, portas…) por cima da planta de fundo. Você revisa e só então aplica ao mapa; nada entra sem o seu clique.
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            É uma proposta: a IA pode errar ou deixar peças de fora, então confira.
          </p>
          <p className="rounded-md border border-border bg-secondary p-2 text-xs leading-relaxed">
            <strong>Privacidade:</strong> para a leitura, a imagem da planta é enviada ao serviço de IA do Evo (Google Gemini).
          </p>
          <p className="text-xs leading-relaxed">
            <strong>Custo:</strong> {creditos(CUSTO_LEITURA)} do Evo por leitura. Se o serviço falhar, não cobramos. Fechar este painel durante a leitura <strong>não desfaz a cobrança</strong>.
          </p>
          {lendo && <p role="status" className="text-xs font-bold text-primary">Lendo a planta… pode levar até 2 minutos.</p>}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onFechar}>{lendo ? 'Fechar (a leitura continua)' : 'Cancelar'}</Button>
            <Button className="flex-1" disabled={lendo} onClick={onLer}>{lendo ? 'Lendo…' : `Ler com IA (${creditos(CUSTO_LEITURA)})`}</Button>
          </div>
        </div>
      </div>
    )
  }

  const porTipo = contarPorTipo(prop.pecas)
  const marcadas = prop.pecas.filter(p => p.marcada).length
  return (
    <div ref={raiz} role="dialog" aria-modal="false" aria-labelledby="leitor-titulo" onKeyDown={teclas}
      className="fixed bottom-4 left-1/2 z-50 max-h-[55vh] w-[min(92vw,28rem)] -translate-x-1/2 space-y-3 overflow-y-auto rounded-lg border border-border bg-card p-4 text-foreground shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="leitor-titulo" className="text-sm font-bold">Revise a proposta da IA</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {marcadas} de {prop.pecas.length} peças marcadas; as tracejadas no mapa são as marcadas.
            {typeof prop.restante === 'number' && ` Esta leitura gastou ${creditos(prop.custo ?? CUSTO_LEITURA)}; restam ${prop.restante}.`}
          </p>
        </div>
        <Button variant="ghost" size="sm" aria-label="Descartar a proposta e fechar (Esc)" onClick={descartar}>Fechar</Button>
      </div>
      <ul className="space-y-1">
        {Object.entries(porTipo).map(([tipo, c]) => (
          <li key={tipo} className="text-xs">
            <div className="flex items-center justify-between gap-2">
              <span><strong className="font-mono">{c.marcadas}</strong>/{c.total} {nomeDoTipo(tipo)}</span>
              <button type="button" onClick={() => leitor.alternarTipo(tipo)} className="min-h-6 text-[11px] font-bold text-primary hover:underline max-lg:min-h-10">
                {c.marcadas === c.total ? 'Desmarcar tipo' : 'Marcar tipo'}
              </button>
            </div>
            <details>
              <summary className="cursor-pointer text-[11px] text-muted-foreground max-lg:py-2">Escolher peça a peça</summary>
              <ul className="mt-1 grid grid-cols-2 gap-x-3">
                {prop.pecas.filter(p => p.tipo === tipo).map(p => (
                  <li key={p.id}>
                    <label className="flex items-center gap-1.5 py-0.5 max-lg:py-2">
                      <input type="checkbox" checked={p.marcada} onChange={() => leitor.alternarPeca(p.id)} className="accent-primary" />
                      <span className="truncate">{p.rotulo || `${nomeDoTipo(tipo)} ${p.id.slice(3)}`}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>
      {naoCalibrada && (
        <p role="note" className="rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] leading-relaxed text-amber-800">
          A escala ainda não foi calibrada. Calibre antes de aplicar (<strong>Calibrar escala</strong>, em Planta de fundo): calibrar depois muda os metros e desalinha as peças da planta.
        </p>
      )}
      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1 max-lg:h-10" onClick={descartar}>Descartar</Button>
        <Button className="flex-1 max-lg:h-10" disabled={marcadas === 0} onClick={onAplicar}>Aplicar ao mapa ({marcadas})</Button>
      </div>
    </div>
  )
}
