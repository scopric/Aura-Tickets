import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  useAcoesCartao, mensagemSegura, useEnviarAnexo, useRemoverAnexo, urlAssinadaAnexo, erroDoArquivo, MIMES_ANEXO,
  type AnexoCartao, type AtividadeCartao, type CartaoDetalhe, type KindVinculo,
} from '../../../hooks/useCartao'
import { quando } from '../../../hooks/useConversas'
import type { ColunaQuadro, DbTask } from '../../../hooks/useProducerTools'
import { AvatarPessoa } from './pecas'
import { LIMITE_MENCOES, ROTAS_VINCULO, destinoVinculo, mencoesDe } from './cartaoLib'
import type { Pessoa } from './useEquipe'

const alvo = 'min-h-11 sm:min-h-8'
const campo = 'text-base sm:text-sm'
const aoErro = (e: Error) => toast.error(mensagemSegura(e))


export function Secao({ titulo, icone, acao, children }: { titulo: string; icone: ReactNode; acao?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="grid gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground"><span className="text-muted-foreground" aria-hidden="true">{icone}</span>{titulo}<span className="ml-auto flex gap-1">{acao}</span></h3>
      {children}
    </section>
  )
}
const Vazio = ({ children }: { children: ReactNode }) => <p className="text-sm text-muted-foreground">{children}</p>

type Acoes = ReturnType<typeof useAcoesCartao>

// ─── Checklists ───
function UmaChecklist({ lista, acoes }: { lista: CartaoDetalhe['checklists'][number]; acoes: Acoes }) {
  const [item, setItem] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const feitos = lista.itens.filter(i => i.done).length
  const pct = lista.itens.length ? Math.round((feitos / lista.itens.length) * 100) : 0
  const enviar = (e: FormEvent) => {
    e.preventDefault()
    acoes.adicionarItem.mutate({ checklistId: lista.id, text: item }, { onError: aoErro })
    setItem('')
  }
  return (
    <div className="grid gap-2 rounded-[10px] border border-border p-3">
      <div className="flex items-center gap-2">
        <h4 className="min-w-0 flex-1 truncate text-sm font-medium">{lista.title}</h4>
        <Button variant="ghost" size="sm" className={cn(alvo, confirmando && 'text-destructive')}
          onClick={() => (confirmando ? acoes.apagarChecklist.mutate(lista.id, { onError: aoErro }) : setConfirmando(true))}
          onBlur={() => setConfirmando(false)}>
          {confirmando ? 'Confirmar exclusão' : 'Excluir lista'}
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-9 text-xs tabular-nums text-muted-foreground">{pct}%</span>
        <Progress value={pct} aria-label={`Progresso de ${lista.title}: ${feitos} de ${lista.itens.length}`} />
      </div>
      <ul className="grid gap-0.5">
        {lista.itens.map(i => (
          <li key={i.id} className={cn('flex items-center gap-2', alvo)}>
            <Checkbox id={`item-${i.id}`} checked={i.done} onCheckedChange={v => acoes.alternarItem.mutate({ id: i.id, done: v === true }, { onError: aoErro })} />
            <Label htmlFor={`item-${i.id}`} className={cn('min-w-0 flex-1 cursor-pointer break-words py-1 font-normal', i.done && 'text-muted-foreground line-through')}>{i.text}</Label>
            <Button variant="ghost" size="icon-sm" className="size-11 sm:size-8" aria-label={`Remover o item ${i.text}`} onClick={() => acoes.apagarItem.mutate(i.id, { onError: aoErro })}><I.Fechar aria-hidden="true" /></Button>
          </li>
        ))}
      </ul>
      <form onSubmit={enviar} className="flex gap-2">
        <Input aria-label={`Novo item em ${lista.title}`} value={item} maxLength={200} onChange={e => setItem(e.target.value)} placeholder="Adicionar um item" className={cn('h-11 sm:h-9', campo)} />
        <Button type="submit" variant="outline" size="sm" className={alvo} disabled={!item.trim()} aria-label={`Adicionar item em ${lista.title}`}>Adicionar</Button>
      </form>
    </div>
  )
}
export function Checklists({ detalhe, acoes }: { detalhe: CartaoDetalhe; acoes: Acoes }) {
  if (!detalhe.checklists.length) return null
  return <Secao titulo="Checklists" icone={<I.CheckDuplo />}><div className="grid gap-3">{detalhe.checklists.map(l => <UmaChecklist key={l.id} lista={l} acoes={acoes} />)}</div></Secao>
}

// ─── Anexos ───
const tamanho = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

export function Anexos({ tarefa, detalhe, entrada }: { tarefa: DbTask; detalhe: CartaoDetalhe; entrada: React.RefObject<HTMLInputElement | null> }) {
  const enviar = useEnviarAnexo()
  const remover = useRemoverAnexo(tarefa.id)
  const [aviso, setAviso] = useState('')
  const escolher = (campoArquivo: HTMLInputElement) => {
    const f = campoArquivo.files?.[0]
    if (!f) return
    const invalido = erroDoArquivo(f)
    setAviso(invalido ?? '')
    if (!invalido) enviar.mutate({ producerId: tarefa.producer_id, taskId: tarefa.id, arquivo: f }, { onError: aoErro })
    campoArquivo.value = '' // deixa escolher o mesmo arquivo de novo
  }
  const abrir = async (a: AnexoCartao) => {
    const janela = window.open('about:blank', '_blank') // aberta já no clique: depois do await o navegador bloquearia
    try {
      const url = await urlAssinadaAnexo(a.storage_path)
      if (janela) { janela.opener = null; janela.location.href = url } else toast.error('Permita janelas abertas para ver o anexo.')
    } catch (e) { janela?.close(); toast.error(mensagemSegura(e)) }
  }
  return (
    <Secao titulo="Anexos" icone={<I.Anexo />} acao={<Button variant="outline" size="sm" className={alvo} loading={enviar.isPending} onClick={() => entrada.current?.click()}>Adicionar anexo</Button>}>
      <input ref={entrada} type="file" hidden accept={MIMES_ANEXO.join(',')} aria-label="Escolher arquivo para anexar" onChange={e => escolher(e.target)} />
      {aviso && <p role="alert" className="text-sm text-destructive">{aviso}</p>}
      {detalhe.anexos.length === 0 ? <Vazio>Nenhum anexo. Imagens PNG, JPEG ou WebP e PDF, até 10 MB.</Vazio> : (
        <ul className="grid gap-1">
          {detalhe.anexos.map(a => (
            <li key={a.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5">
              <I.Documento aria-hidden="true" className="shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-sm">{a.name}<span className="ml-2 text-xs text-muted-foreground">{tamanho(a.size_bytes)}</span></span>
              <Button variant="ghost" size="sm" className={alvo} aria-label={`Abrir o anexo ${a.name}`} onClick={() => abrir(a)}>Abrir</Button>
              <Button variant="ghost" size="icon-sm" className="size-11 sm:size-8" aria-label={`Remover o anexo ${a.name}`} onClick={() => remover.mutate(a, { onError: aoErro })}><I.Lixeira aria-hidden="true" /></Button>
            </li>
          ))}
        </ul>
      )}
    </Secao>
  )
}

// ─── Vínculos ───
export function Vinculos({ tarefa, detalhe, acoes, abrirEscolha }: { tarefa: DbTask; detalhe: CartaoDetalhe; acoes: Acoes; abrirEscolha: () => void }) {
  return (
    <Secao titulo="Vínculos com a plataforma" icone={<I.Link />} acao={<Button variant="outline" size="sm" className={alvo} onClick={abrirEscolha}>Vincular página</Button>}>
      {detalhe.vinculos.length === 0 ? <Vazio>Nenhuma página vinculada. Vincule ingressos, cupons, check-in, orçamento e outras páginas para abrir direto do cartão.</Vazio> : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {detalhe.vinculos.map(v => {
            const [nome] = ROTAS_VINCULO[v.kind] ?? [v.kind]
            const para = ROTAS_VINCULO[v.kind] ? destinoVinculo(v.kind, tarefa.event_id) : null
            return (
              <li key={v.id} className="flex items-center gap-2 rounded-[10px] border border-border px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{nome}</span>
                {para ? <Button asChild variant="outline" size="sm" className={alvo}><Link to={para}>Abrir página<I.AbrirExterno aria-hidden="true" /></Link></Button>
                  : <span className="text-xs text-muted-foreground">Precisa de um evento</span>}
                <Button variant="ghost" size="icon-sm" className="size-11 sm:size-8" aria-label={`Remover o vínculo com ${nome}`} onClick={() => acoes.removerVinculo.mutate(v.id, { onError: aoErro })}><I.Fechar aria-hidden="true" /></Button>
              </li>
            )
          })}
        </ul>
      )}
    </Secao>
  )
}
export function EscolhaVinculo({ detalhe, acoes }: { detalhe: CartaoDetalhe; acoes: Acoes }) {
  return (
    <div className="grid gap-1">
      <p className="mb-1 text-sm font-medium">Vincular página</p>
      <ul className="grid max-h-72 gap-0.5 overflow-y-auto">
        {(Object.keys(ROTAS_VINCULO) as KindVinculo[]).map(k => {
          const ja = detalhe.vinculos.some(v => v.kind === k)
          return <li key={k}><Button variant="ghost" size="sm" className={cn('w-full justify-start', alvo)} disabled={ja} onClick={() => acoes.adicionarVinculo.mutate({ kind: k }, { onError: aoErro })}>{ROTAS_VINCULO[k][0]}{ja && <span className="ml-auto text-xs text-muted-foreground">já vinculada</span>}</Button></li>
        })}
      </ul>
    </div>
  )
}

// ─── Dependências ───
export function Dependencias({ tarefa, tarefas, detalhe, acoes }: { tarefa: DbTask; tarefas: DbTask[]; detalhe: CartaoDetalhe; acoes: Acoes }) {
  const [novo, setNovo] = useState('')
  const usadas = new Set(detalhe.dependencias.map(d => d.depends_on))
  const opcoes = tarefas.filter(t => t.id !== tarefa.id && t.board_id === tarefa.board_id && !t.archived_at && !usadas.has(t.id))
  return (
    <Secao titulo="Dependências" icone={<I.Cadeado />}>
      {detalhe.dependencias.length === 0 ? <Vazio>Este cartão não depende de nenhum outro.</Vazio> : (
        <ul className="grid gap-1">
          {detalhe.dependencias.map(d => (
            <li key={d.depends_on} className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5">
              <span className="min-w-0 flex-1 truncate text-sm">{d.titulo || 'Cartão sem título'}</span>
              <span className={cn('text-xs', d.concluida ? 'text-[var(--ev-success)]' : 'text-[var(--ev-warning)]')}>{d.concluida ? 'concluída' : 'em aberto'}</span>
              <Button variant="ghost" size="icon-sm" className="size-11 sm:size-8" aria-label={`Remover a dependência de ${d.titulo || 'cartão sem título'}`} onClick={() => acoes.removerDependencia.mutate(d.depends_on, { onError: aoErro })}><I.Fechar aria-hidden="true" /></Button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={e => { e.preventDefault(); if (novo) { acoes.adicionarDependencia.mutate(novo, { onError: aoErro }); setNovo('') } }} className="flex gap-2">
        <select aria-label="Este cartão depende de" value={novo} onChange={e => setNovo(e.target.value)} className={cn('h-11 min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 text-foreground sm:h-9', campo)}>
          <option value="">Escolha um cartão</option>
          {opcoes.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
        <Button type="submit" variant="outline" size="sm" className={alvo} disabled={!novo} aria-label="Adicionar dependência">Adicionar</Button>
      </form>
    </Secao>
  )
}

// ─── Comentários ───

export function Comentarios({ detalhe, acoes, pessoas, eu }: { detalhe: CartaoDetalhe; acoes: Acoes; pessoas: Pessoa[]; eu?: string }) {
  const [texto, setTexto] = useState('')
  const area = useRef<HTMLTextAreaElement>(null)
  const nome = (id: string) => pessoas.find(p => p.id === id)?.nome ?? 'Sem nome'
  const enviar = (e: FormEvent) => {
    e.preventDefault()
    const mencoes = mencoesDe(texto, pessoas)
    if (mencoes.length > LIMITE_MENCOES) { toast.error(`Marque no máximo ${LIMITE_MENCOES} pessoas por mensagem.`); return }
    acoes.comentar.mutate({ body: texto, mentions: mencoes }, { onError: aoErro })
    setTexto('')
  }
  const marcar = (p: Pessoa) => { setTexto(t => `${t}${t && !/\s$/.test(t) ? ' ' : ''}@${p.nome} `); area.current?.focus() }
  return (
    <Secao titulo="Mensagens" icone={<I.Conversa />}>
      <form onSubmit={enviar} className="grid gap-2">
        <Label htmlFor="comentario-novo" className="sr-only">Escreva uma mensagem</Label>
        <Textarea id="comentario-novo" ref={area} value={texto} maxLength={4000} onChange={e => setTexto(e.target.value)} rows={2} className={campo} placeholder="Escreva uma mensagem. Use @nome para avisar alguém." />
        <div className="flex flex-wrap items-center gap-1">
          {pessoas.length > 1 && <span className="text-xs text-muted-foreground">Marcar:</span>}
          {pessoas.length > 1 && pessoas.map(p => <Button key={p.id} type="button" variant="ghost" size="xs" className="min-h-11 sm:min-h-7" onClick={() => marcar(p)}>@{p.nome}</Button>)}
          <Button type="submit" size="sm" className={cn('ml-auto', alvo)} disabled={!texto.trim()} loading={acoes.comentar.isPending}>Enviar</Button>
        </div>
      </form>
      {detalhe.comentarios.length === 0 ? <Vazio>Nenhuma mensagem ainda.</Vazio> : (
        <ul className="grid gap-2">
          {detalhe.comentarios.map(c => (
            <li key={c.id} className="flex gap-2">
              <AvatarPessoa nome={nome(c.user_id)} />
              <div className="min-w-0 flex-1 rounded-[10px] bg-secondary px-3 py-2">
                <p className="text-xs text-muted-foreground"><b className="font-medium text-foreground">{nome(c.user_id)}</b> · {quando(c.created_at)}</p>
                <p className="whitespace-pre-wrap break-words text-sm">{c.body}</p>
              </div>
              {c.user_id === eu && <Button variant="ghost" size="icon-sm" className="size-11 sm:size-8" aria-label="Apagar a mensagem" onClick={() => acoes.apagarComentario.mutate(c.id, { onError: aoErro })}><I.Lixeira aria-hidden="true" /></Button>}
            </li>
          ))}
        </ul>
      )}
    </Secao>
  )
}

// ─── Atividade ───
export function Atividade({ atividade, pessoas, colunas }: { atividade: AtividadeCartao[]; pessoas: Pessoa[]; colunas: ColunaQuadro[] }) {
  const col = (id: unknown) => colunas.find(c => c.id === id)?.name ?? 'outra coluna'
  const frase = (a: AtividadeCartao) => {
    const quem = a.actor ? pessoas.find(p => p.id === a.actor)?.nome ?? 'Sem nome' : 'O sistema'
    switch (a.kind) {
      case 'criado': return `${quem} criou o cartão`
      case 'movido': return `${quem} moveu o cartão de ${col(a.data.de)} para ${col(a.data.para)}`
      case 'arquivado': return `${quem} arquivou o cartão`
      case 'desarquivado': return `${quem} tirou o cartão do arquivo`
      case 'comentario': return `${quem} comentou`
      case 'comentario_apagado': return `${quem} apagou um comentário`
      case 'anexo': return `${quem} anexou ${typeof a.data.name === 'string' ? a.data.name : 'um arquivo'}`
      default: return `${quem} mexeu no cartão`
    }
  }
  return (
    <Secao titulo="Atividade" icone={<I.Atividade />}>
      {atividade.length === 0 ? <Vazio>Nenhuma atividade registrada.</Vazio> : (
        <ul className="grid gap-1">{atividade.map(a => <li key={a.id} className="text-sm text-muted-foreground">{frase(a)} · {quando(a.created_at)}</li>)}</ul>
      )}
    </Secao>
  )
}
