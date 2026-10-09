import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { selectNativo } from '@/components/producer/ui'
import { mensagemSegura, useEtiquetasQuadro } from '../../../hooks/useCartao'
import type { ColunaQuadro } from '../../../hooks/useProducerTools'
import {
  MAX_BOTOES, MAX_PASSOS, PAPEIS, TIPOS_PASSO, nomeDoPapel, useBotoes, type BotaoQuadro, type PassoBotao, type ResultadoBotao, type TipoPasso,
} from '../../../hooks/useQuadroAcoes'
import { Indisponivel } from './ModelosPapeis'

const alvo = 'min-h-11 sm:min-h-8'
const campo = 'text-base sm:text-sm'
const aoErro = (e: Error) => toast.error(mensagemSegura(e))

/** "N afetados, M ignorados" e, se houver, a lista de motivos (texto puro). Fica na tela até o próximo clique */
export function ResultadoDoBotao({ r }: { r: ResultadoBotao }) {
  const n = (x: number, um: string, varios: string) => `${x} ${x === 1 ? um : varios}`
  return (
    <div role="status" className="grid gap-1 rounded-md border border-border bg-secondary px-3 py-2 text-sm">
      <p>{n(r.afetados, 'afetado', 'afetados')}, {n(r.ignorados, 'ignorado', 'ignorados')}</p>
      {r.motivos.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-muted-foreground">{r.motivos.map((m, i) => <li key={i}>{m}</li>)}</ul>
      )}
    </div>
  )
}

interface Rascunho { name: string; scope: 'card' | 'board'; columnId: string; passos: { t: TipoPasso; v: string }[] }

/** Texto de um passo para a lista: "Mover para Feito". O valor vem das listas reais do quadro */
function descreverPasso(p: PassoBotao, colunas: ColunaQuadro[], etiquetas: { id: string; name: string }[]) {
  const rotulo = TIPOS_PASSO.find(t => t.tipo === p.t)?.rotulo ?? p.t
  switch (p.t) {
    case 'mover': return `${rotulo} ${colunas.find(c => c.id === p.v)?.name ?? 'coluna que não existe mais'}`
    case 'etiqueta': return `${rotulo} ${etiquetas.find(e => e.id === p.v)?.name ?? 'etiqueta que não existe mais'}`
    case 'atribuir': case 'avisar': return `${rotulo} ${nomeDoPapel(String(p.v))}`
    case 'prazo': return `${rotulo} ${p.v} ${p.v === 1 ? 'dia' : 'dias'}`
    default: return rotulo
  }
}

function FormBotao({ editando, inicial, colunas, etiquetas, ocupado, onSalvar, onCancelar }: {
  /** Botão já criado: o escopo não muda (o banco não deixa) */
  editando: boolean; inicial: Rascunho; colunas: ColunaQuadro[]; etiquetas: { id: string; name: string }[]; ocupado: boolean
  onSalvar: (r: Rascunho) => void; onCancelar: () => void
}) {
  const [r, setR] = useState(inicial)
  const [foco, setFoco] = useState<string | null>(null)
  useEffect(() => { if (foco) document.getElementById(foco)?.focus() }, [foco, r.passos.length])
  const reais = colunas.filter(c => !c.dica)
  const padrao = (t: TipoPasso) => (t === 'mover' ? reais[0]?.id ?? '' : t === 'etiqueta' ? etiquetas[0]?.id ?? '' : t === 'prazo' ? '2' : t === 'arquivar' ? '' : PAPEIS[0].slug)
  const trocar = (i: number, p: Partial<Rascunho['passos'][number]>) => setR({ ...r, passos: r.passos.map((x, k) => (k === i ? { ...x, ...p } : x)) })
  return (
    <form className="grid gap-3 rounded-[10px] border border-border p-3" onSubmit={e => { e.preventDefault(); onSalvar(r) }}>
      <div className="grid gap-1.5">
        <Label htmlFor="botao-nome">Nome do botão</Label>
        <Input id="botao-nome" className={campo} maxLength={40} value={r.name} onChange={e => setR({ ...r, name: e.target.value })} placeholder="Ex.: Enviar para revisão" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="botao-escopo">Onde age</Label>
          <select id="botao-escopo" disabled={editando} className={`${selectNativo} ${campo}`} value={r.scope} onChange={e => setR({ ...r, scope: e.target.value as Rascunho['scope'] })}>
            <option value="card">Em um cartão</option>
            <option value="board">Em todos os cartões de uma coluna</option>
          </select>
        </div>
        {r.scope === 'board' && (
          <div className="grid gap-1.5">
            <Label htmlFor="botao-coluna">Coluna</Label>
            <select id="botao-coluna" className={`${selectNativo} ${campo}`} value={r.columnId} onChange={e => setR({ ...r, columnId: e.target.value })}>
              <option value="">Escolha a coluna</option>
              {reais.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Passos (na ordem, até {MAX_PASSOS})</legend>
        {r.passos.map((p, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <select id={`passo-tipo-${i}`} aria-label={`Passo ${i + 1}: o que fazer`} className={`${selectNativo} ${campo} w-auto min-w-40 flex-1`} value={p.t}
              onChange={e => trocar(i, { t: e.target.value as TipoPasso, v: padrao(e.target.value as TipoPasso) })}>
              {TIPOS_PASSO.map(t => <option key={t.tipo} value={t.tipo}>{t.rotulo}</option>)}
            </select>
            {p.t === 'prazo' ? (
              <span className="flex items-center gap-1.5 text-sm">
                <Input aria-label={`Passo ${i + 1}: dias`} type="number" inputMode="numeric" min={1} max={30} className={`${campo} w-20`} value={p.v} onChange={e => trocar(i, { v: e.target.value })} />dias
              </span>
            ) : p.t !== 'arquivar' && (
              <select aria-label={`Passo ${i + 1}: valor`} className={`${selectNativo} ${campo} w-auto min-w-40 flex-1`} value={p.v} onChange={e => trocar(i, { v: e.target.value })}>
                {p.t === 'mover' && reais.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                {p.t === 'etiqueta' && (etiquetas.length ? etiquetas.map(e => <option key={e.id} value={e.id}>{e.name}</option>) : <option value="">O quadro não tem etiquetas</option>)}
                {(p.t === 'atribuir' || p.t === 'avisar') && PAPEIS.map(x => <option key={x.slug} value={x.slug}>{x.nome}</option>)}
              </select>
            )}
            <Button type="button" variant="ghost" size="icon-sm" className="size-11 sm:size-8" aria-label={`Tirar o passo ${i + 1}`}
              onClick={() => { setR({ ...r, passos: r.passos.filter((_, k) => k !== i) }); setFoco(i > 0 ? `passo-tipo-${i - 1}` : r.passos.length > 1 ? 'passo-tipo-0' : 'botao-add-passo') }}><I.Fechar aria-hidden="true" /></Button>
          </div>
        ))}
        {r.passos.length < MAX_PASSOS && (
          <div><Button id="botao-add-passo" type="button" variant="outline" size="sm" className={alvo}
            onClick={() => { setR({ ...r, passos: [...r.passos, { t: 'mover', v: padrao('mover') }] }); setFoco(`passo-tipo-${r.passos.length}`) }}><I.Criar aria-hidden="true" />Adicionar passo</Button></div>
        )}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" className={alvo} loading={ocupado}>Salvar botão</Button>
        <Button type="button" variant="ghost" size="sm" className={alvo} onClick={onCancelar}>Cancelar</Button>
      </div>
    </form>
  )
}

/** Página "Botões" do menu do quadro. `pode` = quem tem 'editar'; quem só vê enxerga a lista, sem ações */
export default function PaginaBotoes({ boardId, colunas, pode }: { boardId: string; colunas: ColunaQuadro[]; pode: boolean }) {
  const b = useBotoes(boardId)
  const etiquetas = useEtiquetasQuadro(boardId).data ?? []
  const [editando, setEditando] = useState<BotaoQuadro | 'novo' | null>(null)
  const [apagando, setApagando] = useState<BotaoQuadro | null>(null)
  const [resultado, setResultado] = useState<{ id: string; r: ResultadoBotao } | null>(null)

  if (b.carregando) return <p role="status" className="text-sm text-muted-foreground">Carregando…</p>
  if (!b.disponivel) return <Indisponivel erro={b.erro} />

  const vazio: Rascunho = { name: '', scope: 'card', columnId: '', passos: [{ t: 'mover', v: colunas.find(c => !c.dica)?.id ?? '' }] }
  const rascunhoDe = (x: BotaoQuadro): Rascunho => ({
    name: x.name, scope: x.scope, columnId: x.column_id ?? '', passos: x.steps.map(p => ({ t: p.t, v: p.v === undefined ? '' : String(p.v) })),
  })
  const salvar = (r: Rascunho) => {
    const passos = r.passos.map((p): PassoBotao => (p.t === 'arquivar' ? { t: p.t } : { t: p.t, v: p.t === 'prazo' ? Number(p.v) : p.v }))
    const dados = { name: r.name, scope: r.scope, columnId: r.scope === 'board' ? r.columnId : null, steps: passos }
    const ok = { onError: aoErro, onSuccess: () => { toast.success('Botão salvo.'); setEditando(null) } }
    if (editando && editando !== 'novo') b.editar.mutate({ ...dados, id: editando.id }, ok)
    else b.criar.mutate(dados, ok)
  }
  const rodar = (x: BotaoQuadro) => b.rodar.mutate({ button: x.id }, { onError: aoErro, onSuccess: r => setResultado({ id: x.id, r }) })

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        Botão é uma sequência de passos que se aperta quando quiser. Os de cartão aparecem no verso de todo cartão; os de quadro agem em todos os cartões de uma coluna.
        Nenhum mexe em dinheiro. {pode ? 'Passo com papel que ninguém ocupa é ignorado: defina os papéis na página Papéis.' : 'Você só pode ver os botões; para criar ou rodar, peça acesso de edição.'}
      </p>
      {b.botoes.length === 0 && <p className="text-sm text-muted-foreground">Nenhum botão ainda.</p>}
      <ul className="grid gap-2">
        {b.botoes.map(x => (
          <li key={x.id} className="grid gap-2 rounded-[10px] border border-border p-3">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <b className="min-w-0 break-words text-sm">{x.name}</b>
              <span className="text-xs text-muted-foreground">{x.scope === 'card' ? 'no cartão' : `no quadro, coluna ${colunas.find(c => c.id === x.column_id)?.name ?? 'que não existe mais'}`}</span>
            </div>
            <ol className="list-decimal pl-5 text-xs text-muted-foreground">{x.steps.map((p, i) => <li key={i}>{descreverPasso(p, colunas, etiquetas)}</li>)}</ol>
            {pode && (
              <div className="flex flex-wrap gap-1">
                {x.scope === 'board' && <Button variant="outline" size="sm" className={alvo} loading={b.rodar.isPending && b.rodar.variables?.button === x.id} disabled={b.rodar.isPending} onClick={() => rodar(x)}><I.Raio aria-hidden="true" />Rodar agora</Button>}
                {x.somenteLeitura
                  ? <span className="self-center text-xs text-muted-foreground">Tem passos que esta tela não entende: só leitura.</span>
                  : <Button variant="ghost" size="sm" className={alvo} aria-label={`Editar o botão ${x.name}`} onClick={() => setEditando(x)}><I.Editar aria-hidden="true" />Editar</Button>}
                <Button variant="ghost" size="sm" className={`${alvo} text-destructive`} aria-label={`Apagar o botão ${x.name}`} onClick={() => setApagando(x)}><I.Lixeira aria-hidden="true" />Apagar</Button>
              </div>
            )}
            {resultado?.id === x.id && <ResultadoDoBotao r={resultado.r} />}
          </li>
        ))}
      </ul>
      {pode && (editando ? (
        <FormBotao editando={editando !== 'novo'} key={editando === 'novo' ? 'novo' : editando.id} inicial={editando === 'novo' ? vazio : rascunhoDe(editando)} colunas={colunas} etiquetas={etiquetas}
          ocupado={b.criar.isPending || b.editar.isPending} onSalvar={salvar} onCancelar={() => setEditando(null)} />
      ) : b.botoes.length >= MAX_BOTOES ? (
        <p className="text-xs text-muted-foreground">O quadro já tem o máximo de {MAX_BOTOES} botões.</p>
      ) : (
        <div><Button size="sm" className={alvo} onClick={() => setEditando('novo')}><I.Criar aria-hidden="true" />Novo botão</Button></div>
      ))}

      <AlertDialog open={!!apagando} onOpenChange={o => { if (!o) setApagando(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar o botão “{apagando?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>Os cartões não mudam. Não dá para desfazer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (apagando) b.apagar.mutate(apagando.id, { onError: aoErro, onSuccess: () => toast.success('Botão apagado.') }) }}>Apagar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
