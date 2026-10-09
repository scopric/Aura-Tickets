import { useId, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import * as I from '@/components/icones/evokaa16'
import { useArrastar } from '../../../hooks/useArrastar'
import type { ResumoCartao } from '../../../hooks/useCartao'
import type { ColunaQuadro, DbTask } from '../../../hooks/useProducerTools'
import { corPrazo, posicaoNaColuna } from '../../../lib/tarefas'
import { diaBR } from '../../../lib/visaoEvento'
import { cn } from '@/lib/utils'
import MenuMover from './MenuMover'
import { AvatarPessoa } from './pecas'
import { ID_QUADRO, corSegura } from './cartaoLib'

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/** Dia, mês, dia da semana e dias até o prazo (negativo = atrasado), no dia de Brasília como o resto do quadro */
function dataDoCanhoto(due: string, hoje: string) {
  const d = new Date(`${diaBR(due)}T00:00:00Z`)
  return { dia: String(d.getUTCDate()).padStart(2, '0'), mes: MES[d.getUTCMonth()], sem: SEMANA[d.getUTCDay()], n: Math.round((d.getTime() - Date.parse(`${hoje}T00:00:00Z`)) / 86_400_000) }
}
const pilula = (n: number) => (n < 0 ? `atraso ${-n} d` : n === 0 ? 'hoje' : n === 1 ? 'amanhã' : `em ${n} d`)

// Inclinação e brilho seguem o ponteiro só com mouse e sem prefers-reduced-motion
function seguir(e: PointerEvent<HTMLElement>) {
  if (e.pointerType !== 'mouse' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const el = e.currentTarget, r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height
  el.dataset.brilho = 'true'
  el.style.setProperty('--mx', `${x * 100}%`); el.style.setProperty('--my', `${y * 100}%`)
  el.style.setProperty('--ry', `${(x - 0.5) * 6}deg`); el.style.setProperty('--rx', `${-(y - 0.5) * 6}deg`)
}
function soltarPonteiro(e: PointerEvent<HTMLElement>) {
  const el = e.currentTarget
  el.dataset.brilho = 'false'; el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg')
}

interface Props {
  tarefas: DbTask[]
  colunas: ColunaQuadro[]
  /** Em que coluna o cartão está (coluna do banco no modo novo; o status no modo por status) */
  colunaDe: (t: DbTask) => string
  /** Modo novo: a ordem é a position do cartão e Subir/Descer existem. Modo por status: ordem por prazo e criação */
  ordenavel: boolean
  /** posicao só vem no modo novo */
  onMover: (t: DbTask, colunaId: string, posicao?: number) => void
  /** Detalhes extras do cartão (prioridade, evento) que a tela escolhe */
  extras?: (t: DbTask) => ReactNode
  /** Furos de picote do checklist: [feitos, total]. Sem checklist no banco ainda, a tela só passa quando existir */
  furos?: (t: DbTask) => [number, number] | undefined
  /** Nome do responsável (inicial no avatar do canhoto); sem ele, mostra "?" quando há responsável */
  nomeDe?: (t: DbTask) => string | undefined
  /** Modo novo: etiquetas, membros, checklist, anexos, mensagens e bloqueio por cartão (uma consulta por quadro). Sem ele nada disso aparece */
  resumo?: Map<string, ResumoCartao>
  /** Nome de quem é membro do cartão (id do usuário) */
  nomePessoa?: (userId: string) => string
  /** Clique ou Enter no cartão abre o verso */
  onAbrir?: (t: DbTask) => void
  /** Cartões com aviso não lido para a pessoa: ganham o ponto violeta "novo" */
  comAviso?: Set<string>
}

const porPrazo = (a: DbTask, b: DbTask) =>
  (a.due_date ?? '9').localeCompare(b.due_date ?? '9') || a.created_at.localeCompare(b.created_at)
const porPosicao = (a: DbTask, b: DbTask) => (a.position ?? Infinity) - (b.position ?? Infinity) || a.created_at.localeCompare(b.created_at)

export default function Quadro({ tarefas, colunas, colunaDe, ordenavel, onMover, extras, furos, nomeDe, resumo, nomePessoa, onAbrir, comAviso }: Props) {
  const dica = useId()
  const nome = (id: string) => colunas.find(c => c.id === id)?.name ?? ''
  const hoje = diaBR(new Date())
  const noCartao = (colunaId: string) => tarefas.filter(t => colunaDe(t) === colunaId).sort(ordenavel ? porPosicao : porPrazo)

  // Soltar/mover para outra coluna: vai para o fim dela
  const para = (t: DbTask, colunaId: string) => {
    if (colunaDe(t) === colunaId || colunas.find(c => c.id === colunaId)?.dica) return
    const fim = noCartao(colunaId).map(x => x.position ?? 0)
    onMover(t, colunaId, ordenavel ? posicaoNaColuna(fim, fim.length) : undefined)
  }
  // Subir/Descer dentro da coluna: encaixa entre os vizinhos do destino (as posições dos outros cartões, sem este)
  const dentro = (t: DbTask, lista: DbTask[], delta: number) => {
    const i = lista.findIndex(x => x.id === t.id)
    const outras = lista.filter(x => x.id !== t.id).map(x => x.position ?? 0)
    onMover(t, colunaDe(t), posicaoNaColuna(outras, i + delta))
  }

  // Clique no cartão abre o verso, mas não em botão/link de dentro nem em menu (o React propaga eventos de portal pela árvore)
  const aoClicar = (t: DbTask) => (e: MouseEvent<HTMLElement>) => {
    if (!onAbrir || !e.currentTarget.contains(e.target as Node) || (e.target as HTMLElement).closest('button,a,[role=menuitem]')) return
    onAbrir(t)
  }

  const arrastar = useArrastar(
    colunas.filter(c => !c.dica).map(c => c.id),
    (cartao, coluna) => { const t = tarefas.find(x => x.id === cartao); if (t) para(t, coluna) },
    nome,
  )

  return (
    <>
      <p role="status" className="sr-only">{arrastar.aviso}</p>
      {onAbrir && <p id={dica} className="sr-only">Enter abre o cartão. Espaço pega o cartão para mover.</p>}
      <div id={ID_QUADRO} role="group" tabIndex={-1} aria-label="Quadro de tarefas" className="flex gap-3 overflow-x-auto pb-2 outline-none">
        {colunas.map(col => {
          const lista = noCartao(col.id)
          return (
            <section
              key={col.id}
              aria-label={col.name}
              className={cn('flex w-80 shrink-0 flex-col rounded-[10px] border bg-card', arrastar.alvo === col.id ? 'border-primary' : 'border-border')}
              {...(col.dica ? {} : arrastar.propsColuna(col.id))}
            >
              <h2 className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5 text-sm font-medium text-foreground">
                <span className="truncate">{col.name}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{lista.length}</span>
              </h2>
              <ul className="max-h-[500px] min-h-16 space-y-2 overflow-y-auto p-2">
                {lista.map((t, i) => {
                  const cor = corPrazo(t.due_date, col.kind, hoje)
                  const feito = col.kind === 'done'
                  const data = t.due_date ? dataDoCanhoto(t.due_date, hoje) : null
                  const estado = feito ? 'feito' : cor === 'erro' ? 'vence' : cor === 'aviso' ? 'logo' : 'normal'
                  const f = furos?.(t)
                  const responsavel = nomeDe?.(t)?.trim() || 'Sem nome' // nunca "?" quando falta o nome
                  const inicial = t.assigned_to ? responsavel[0].toUpperCase() : null
                  const rs = resumo?.get(t.id)
                  const props = arrastar.propsCartao(t.id, col.id)
                  return (
                    <li key={t.id} {...props} aria-label={`${t.title}, coluna ${col.name}`} aria-describedby={onAbrir ? dica : undefined}
                      onClick={aoClicar(t)}
                      onKeyDown={e => { props.onKeyDown(e); if (onAbrir && e.key === 'Enter' && e.target === e.currentTarget) { e.preventDefault(); onAbrir(t) } }}
                      onPointerMove={seguir} onPointerLeave={soltarPonteiro} data-pegado={arrastar.pegado === t.id}
                      className={cn('ev-ingresso rounded-[14px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background', arrastar.pegado === t.id && 'opacity-60')}>
                      <div className="ev-bilhete">
                        <div className="flex min-w-0 flex-col gap-2 py-3 pl-4 pr-1">
                          <div className="flex items-start justify-between gap-1">
                            <span className="flex items-center gap-1.5 pt-1 font-mono text-[10.5px] tracking-[0.08em] text-muted-foreground">
                              EVK-{t.id.slice(0, 4).toUpperCase()}
                              {comAviso?.has(t.id) && <><span aria-hidden="true" className="size-2 rounded-full bg-[var(--brand-violet)]" /><span className="sr-only">aviso novo</span></>}
                            </span>
                            <MenuMover
                              titulo={t.title}
                              ordenavel={ordenavel}
                              podeSubir={i > 0}
                              podeDescer={i < lista.length - 1}
                              onSubir={() => dentro(t, lista, -1)}
                              onDescer={() => dentro(t, lista, 1)}
                              destinos={colunas.filter(c => c.id !== col.id && !c.dica)}
                              onPara={id => para(t, id)}
                            />
                          </div>
                          {!!rs?.etiquetas.length && (
                            <ul className="flex flex-wrap gap-1" aria-label="Etiquetas">
                              {rs.etiquetas.map(e => <li key={e.id} className="h-2 w-8 rounded-full" style={{ background: corSegura(e.color) }} title={e.name}><span className="sr-only">{e.name}</span></li>)}
                            </ul>
                          )}
                          <h3 className={cn('break-words text-[15px] font-semibold leading-tight', feito ? 'text-muted-foreground line-through' : 'text-foreground')}>{t.title}</h3>
                          {f && (
                            <div className="ev-furos" role="img" aria-label={`Checklist: ${f[0]} de ${f[1]} feitos`}>
                              {Array.from({ length: f[1] }, (_, k) => <i key={k} className={k < f[0] ? 'p' : ''} />)}
                              <small className="ml-1.5 font-mono text-[10.5px] text-muted-foreground">{f[0]}/{f[1]}</small>
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {extras?.(t)}
                            {rs?.bloqueado && <span className="flex items-center gap-1 text-[var(--ev-warning)]"><I.Cadeado size={14} aria-hidden="true" />bloqueado</span>}
                            {!!rs?.anexos && <span className="flex items-center gap-1"><I.Anexo size={14} aria-hidden="true" /><span aria-hidden="true">{rs.anexos}</span><span className="sr-only">{rs.anexos} {rs.anexos === 1 ? 'anexo' : 'anexos'}</span></span>}
                            {!!rs?.comentarios && <span className="flex items-center gap-1"><I.Conversa size={14} aria-hidden="true" /><span aria-hidden="true">{rs.comentarios}</span><span className="sr-only">{rs.comentarios} {rs.comentarios === 1 ? 'mensagem' : 'mensagens'}</span></span>}
                            {!!rs?.membros.length && (
                              <span className="ml-auto flex -space-x-1.5">
                                {rs.membros.slice(0, 3).map(id => <AvatarPessoa key={id} nome={nomePessoa?.(id) ?? 'Sem nome'} className="size-6 text-[10px] ring-2 ring-card" />)}
                                {rs.membros.length > 3 && <span className="grid size-6 place-items-center rounded-full bg-secondary text-[10px] ring-2 ring-card">+{rs.membros.length - 3}</span>}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="ev-canhoto" data-estado={estado}>
                          <div className="ev-data">
                            {feito ? <><b aria-hidden="true">✓</b><span>feito</span></>
                              : data ? <><b>{data.dia}</b><span>{data.mes} · {data.sem}</span><small>{pilula(data.n)}</small></>
                              : <><b>—</b><span>sem prazo</span></>}
                          </div>
                          <div className="ev-cod" aria-hidden="true" />
                          {feito && <span className="ev-valido" aria-hidden="true">validado</span>}
                          {inicial ? <span className="ev-av" title={responsavel}>{inicial}</span> : <span className="size-[30px]" />}
                        </div>
                      </div>
                    </li>
                  )
                })}
                {lista.length === 0 && <li className="py-6 text-center text-xs text-muted-foreground">{col.dica ?? 'Arraste cartões para cá'}</li>}
              </ul>
            </section>
          )
        })}
      </div>
    </>
  )
}
