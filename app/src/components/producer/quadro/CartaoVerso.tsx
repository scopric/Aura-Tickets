import { useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Erro, chipAviso, chipErro, chipNeutro } from '@/components/producer/ui'
import { cn } from '@/lib/utils'
import { useAuth } from '../../../hooks/useAuth'
import {
  useAcoesCartao, useAlternarEtiqueta, useAlternarMembro, useAtualizarCartao, useCartaoDetalhe, useEtiquetasQuadro, mensagemSegura, type ResumoCartao,
} from '../../../hooks/useCartao'
import { useDeleteTask, type ColunaQuadro, type DbTask } from '../../../hooks/useProducerTools'
import { corPrazo, prazoDoDia } from '../../../lib/tarefas'
import { diaBR } from '../../../lib/visaoEvento'
import { EscolhaCapa, EscolhaChecklist, EscolhaDatas, EscolhaEtiquetas, EscolhaLocal, EscolhaMembros } from './CartaoEscolhas'
import { Anexos, Atividade, Checklists, Comentarios, Dependencias, EscolhaVinculo, Secao, Vinculos } from './CartaoSecoes'
import { AvatarPessoa, ChipEtiqueta } from './pecas'
import { ID_QUADRO, corSegura } from './cartaoLib'
import type { Pessoa } from './useEquipe'

const aoErro = (e: Error) => toast.error(mensagemSegura(e))
const alvo = 'min-h-11 sm:min-h-8'
const dataBr = (dia: string) => dia.split('-').reverse().join('/')

interface Props {
  /** Cartão aberto; null = fechado */
  tarefaId: string | null
  tarefas: DbTask[]
  boardId: string
  colunas: ColunaQuadro[]
  pessoas: Pessoa[]
  /** undefined = o resumo ainda não chegou (membros ficam desabilitados) */
  resumo?: ResumoCartao
  /** removido = o cartão foi arquivado ou excluído: o foco vai para o quadro, não para um cartão que não existe mais */
  onFechar: (removido?: boolean) => void
  onMover: (t: DbTask, colunaId: string) => void
}

export default function CartaoVerso({ tarefaId, tarefas, ...resto }: Props) {
  const tarefa = tarefaId ? tarefas.find(t => t.id === tarefaId) : undefined
  const sumiu = useRef(false)
  const fechar = (removido?: boolean) => { sumiu.current = !!removido; resto.onFechar(removido) }
  return (
    <Dialog open={!!tarefa} onOpenChange={aberto => { if (!aberto) fechar() }}>
      {tarefa && (
        <DialogContent
          className="max-h-[92vh] w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] gap-0 overflow-y-auto overflow-x-hidden p-0 sm:max-w-4xl"
          onOpenAutoFocus={e => { sumiu.current = false; e.preventDefault(); (e.currentTarget as HTMLElement).focus() }} // não abre o teclado do celular no título
          onCloseAutoFocus={e => { if (sumiu.current) { e.preventDefault(); document.getElementById(ID_QUADRO)?.focus() } }}
        >
          <Conteudo key={tarefa.id} tarefa={tarefa} tarefas={tarefas} {...resto} onFechar={fechar} />
        </DialogContent>
      )}
    </Dialog>
  )
}

type Escolha = 'membros' | 'etiquetas' | 'checklist' | 'datas' | 'capa' | 'local' | 'vincular'

function Conteudo({ tarefa, tarefas, boardId, colunas, pessoas, resumo, onFechar, onMover }: Omit<Props, 'tarefaId'> & { tarefa: DbTask }) {
  const { user } = useAuth()
  const [aberto, setAberto] = useState<Escolha | null>(null)
  const [desc, setDesc] = useState(tarefa.description ?? '')
  const [excluir, setExcluir] = useState(false)
  const entradaAnexo = useRef<HTMLInputElement>(null)

  const det = useCartaoDetalhe(tarefa.id)
  const acoes = useAcoesCartao(tarefa.id)
  const atualizar = useAtualizarCartao()
  const apagar = useDeleteTask()
  const etiquetas = useEtiquetasQuadro(boardId)
  const alternarEtq = useAlternarEtiqueta(tarefa.id)
  const alternarMembro = useAlternarMembro(tarefa.id)

  const r = resumo
  const coluna = colunas.find(c => c.id === tarefa.column_id)
  const nome = (id: string) => pessoas.find(p => p.id === id)?.nome ?? 'Sem nome'
  const membros = r?.membros ?? []
  const ligadas = r?.etiquetas ?? []
  const gravar = (campos: Parameters<typeof atualizar.mutate>[0]['campos'], depois?: () => void) =>
    atualizar.mutate({ tarefa, campos }, { onError: aoErro, onSuccess: depois })
  const abrirEscolha = (e: Escolha) => { setAberto(e); document.getElementById(`lado-${e}`)?.scrollIntoView?.({ block: 'center' }) }

  const bloqueios = det.data?.dependencias.filter(d => !d.concluida) ?? []
  const prazo = tarefa.due_date ? diaBR(tarefa.due_date) : null
  const cor = corPrazo(tarefa.due_date, coluna?.kind ?? 'todo')
  const capa = tarefa.cover ? corSegura(tarefa.cover) : null

  const salvarTitulo = (valor: string) => {
    const t = valor.trim()
    if (!t || t === tarefa.title) return
    gravar({ title: t }) // pela mesma fila e com o mesmo updated_at dos outros campos: sem aviso falso de conflito
  }

  // Botão da barra lateral que abre um popover (o mesmo que o "+" do grupo abre pelo estado)
  // função e não componente: um componente criado aqui remontaria a cada render e o campo aberto perderia o foco
  const lado = (id: Escolha, icone: ReactNode, rotulo: string, children: ReactNode) => (
    <Popover key={id} open={aberto === id} onOpenChange={o => setAberto(o ? id : null)}>
      <PopoverTrigger asChild>
        <Button id={`lado-${id}`} variant="ghost" size="sm" className={cn('w-full justify-start', alvo)}>{icone}{rotulo}</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-[70vh] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto">{children}</PopoverContent>
    </Popover>
  )

  return (
    <>
      <DialogTitle className="sr-only">Cartão: {tarefa.title}</DialogTitle>
      <DialogDescription className="sr-only">{coluna ? `Na coluna ${coluna.name}.` : 'Detalhes do cartão.'}</DialogDescription>
      {capa && <div data-testid="capa" className="h-16 w-full" style={{ background: capa }} />}

      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="grid min-w-0 content-start gap-5">
          <div className="grid gap-1 pr-8">
            {coluna && <p className="text-xs text-muted-foreground">Na coluna <b className="font-medium text-foreground">{coluna.name}</b></p>}
            <Textarea aria-label="Título do cartão" defaultValue={tarefa.title} maxLength={200} rows={2}
              onBlur={e => { salvarTitulo(e.target.value); if (!e.target.value.trim()) e.target.value = tarefa.title }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLTextAreaElement).blur() } }}
              className="min-h-0 resize-none border-transparent px-2 py-1.5 text-lg font-semibold leading-snug shadow-none hover:border-input" />
          </div>

          {bloqueios.length > 0 && (
            <p role="status" className={cn('flex items-center gap-2 rounded-md border px-3 py-2 text-sm', chipAviso)}>
              <I.Cadeado aria-hidden="true" />Bloqueado: aguarda {bloqueios.map(b => b.titulo || 'cartão sem título').join(', ')}
            </p>
          )}

          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <div className="grid gap-1">
              <span className="text-xs text-muted-foreground">Membros</span>
              <div className="flex flex-wrap items-center gap-1">
                {membros.map(id => <AvatarPessoa key={id} nome={nome(id)} />)}
                <Button variant="outline" size="icon-sm" className="size-11 sm:size-8" aria-label="Escolher membros" onClick={() => abrirEscolha('membros')}><I.Criar aria-hidden="true" /></Button>
              </div>
            </div>
            <div className="grid gap-1">
              <span className="text-xs text-muted-foreground">Etiquetas</span>
              <div className="flex flex-wrap items-center gap-1">
                {ligadas.map(e => <ChipEtiqueta key={e.id} nome={e.name} cor={e.color} />)}
                <Button variant="outline" size="icon-sm" className="size-11 sm:size-8" aria-label="Escolher etiquetas" onClick={() => abrirEscolha('etiquetas')}><I.Criar aria-hidden="true" /></Button>
              </div>
            </div>
            {(prazo || tarefa.start_date) && (
              <div className="grid gap-1">
                <span className="text-xs text-muted-foreground">Datas</span>
                <Button variant="outline" size="sm" className={cn(alvo, cor === 'erro' ? chipErro : cor === 'aviso' ? chipAviso : chipNeutro)} onClick={() => abrirEscolha('datas')}>
                  <I.Horario aria-hidden="true" />
                  {tarefa.start_date && `${dataBr(tarefa.start_date)}${prazo ? ' a ' : ''}`}{prazo && dataBr(prazo)}{cor === 'erro' && ' (atrasado)'}
                </Button>
              </div>
            )}
          </div>

          {det.isPending ? (
            <div role="status" aria-busy="true"><span className="sr-only">Carregando o cartão…</span><Skeleton className="h-24 rounded-[10px] bg-muted" /></div>
          ) : det.isError ? (
            <Erro texto={`Não foi possível carregar o cartão. Tente de novo.`} refetch={() => det.refetch()} carregando={det.isFetching} />
          ) : (
            <>
              <Vinculos tarefa={tarefa} detalhe={det.data} acoes={acoes} abrirEscolha={() => abrirEscolha('vincular')} />
              {tarefa.location && (
                <Secao titulo="Local" icone={<I.Local />} acao={<Button variant="ghost" size="sm" className={alvo} onClick={() => abrirEscolha('local')}>Editar</Button>}>
                  <p className="break-words text-sm">{tarefa.location.txt}
                    {tarefa.location.lat !== undefined && tarefa.location.lng !== undefined && <span className="ml-2 text-xs text-muted-foreground">{tarefa.location.lat}, {tarefa.location.lng}</span>}
                  </p>
                </Secao>
              )}
              <Secao titulo="Descrição" icone={<I.Texto />}>
                <Textarea aria-label="Descrição do cartão" value={desc} maxLength={1000} rows={4} onChange={e => setDesc(e.target.value)} className="text-base sm:text-sm" placeholder="Detalhes, links e combinados" />
                <div><Button size="sm" className={alvo} disabled={desc.trim() === (tarefa.description ?? '')} loading={atualizar.isPending} onClick={() => gravar({ description: desc.trim() || null })}>Salvar descrição</Button></div>
              </Secao>
              <Checklists detalhe={det.data} acoes={acoes} />
              <Dependencias tarefa={tarefa} tarefas={tarefas} detalhe={det.data} acoes={acoes} />
              <Anexos tarefa={tarefa} detalhe={det.data} entrada={entradaAnexo} />
              <Comentarios detalhe={det.data} acoes={acoes} pessoas={pessoas} eu={user?.id} />
              <Atividade atividade={det.data.atividade} pessoas={pessoas} colunas={colunas} />
            </>
          )}
        </div>

        <aside aria-label="Ações do cartão" className="grid content-start gap-1 border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
          <h3 className="text-xs font-medium text-muted-foreground">Adicionar ao cartão</h3>
          {lado('membros', <I.Pessoas aria-hidden="true" />, 'Membros', <>
            <EscolhaMembros pessoas={pessoas} atuais={membros} pronto={!!resumo}
              alternar={(userId, ligar) => alternarMembro.mutate({ userId, ligar }, { onError: aoErro })} />
          </>)}
          {lado('etiquetas', <I.Hashtag aria-hidden="true" />, 'Etiquetas', <>
            <EscolhaEtiquetas etiquetas={etiquetas.data ?? []} ligadas={ligadas.map(e => e.id)} carregando={etiquetas.isPending}
              alternar={(e, ligar) => alternarEtq.mutate({ taskId: tarefa.id, etiqueta: e, ligar }, { onError: aoErro })}
              criar={etiquetas.criar} editar={etiquetas.editar} apagar={etiquetas.apagar} />
          </>)}
          {lado('checklist', <I.CheckDuplo aria-hidden="true" />, 'Checklist', <>
            <EscolhaChecklist criar={t => acoes.criarChecklist.mutate(t, { onError: aoErro, onSuccess: () => setAberto(null) })} />
          </>)}
          {lado('datas', <I.Horario aria-hidden="true" />, 'Datas', <>
            <EscolhaDatas inicio={tarefa.start_date ?? null} prazo={prazo}
              salvar={(c, dia) => gravar(c === 'prazo' ? { due_date: dia ? prazoDoDia(dia) : null } : { start_date: dia })} />
          </>)}
          <Button variant="ghost" size="sm" className={cn('w-full justify-start', alvo)} onClick={() => entradaAnexo.current?.click()}><I.Anexo aria-hidden="true" />Anexo</Button>
          {lado('capa', <I.Imagem aria-hidden="true" />, 'Capa', <>
            <EscolhaCapa capa={tarefa.cover} salvar={c => gravar({ cover: c }, () => setAberto(null))} />
          </>)}
          {lado('local', <I.Local aria-hidden="true" />, 'Local', <>
            <EscolhaLocal key={JSON.stringify(tarefa.location ?? null)} local={tarefa.location} salvar={l => gravar({ location: l }, () => setAberto(null))} />
          </>)}
          {lado('vincular', <I.Link aria-hidden="true" />, 'Vincular página', <>
            {det.data ? <EscolhaVinculo detalhe={det.data} acoes={acoes} /> : <p className="text-sm text-muted-foreground">Carregando…</p>}
          </>)}

          <h3 className="mt-3 text-xs font-medium text-muted-foreground">Ações</h3>
          <label className="grid gap-1 text-sm">
            <span className="px-1 text-muted-foreground">Mover para</span>
            <select aria-label="Mover para" value={tarefa.column_id ?? ''} onChange={e => e.target.value !== tarefa.column_id && onMover(tarefa, e.target.value)}
              className="h-11 w-full rounded-md border border-input bg-transparent px-2 text-base text-foreground sm:h-9 sm:text-sm">
              {colunas.filter(c => !c.dica).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <Button variant="ghost" size="sm" className={cn('w-full justify-start', alvo)} loading={atualizar.isPending}
            onClick={() => gravar({ archived_at: new Date().toISOString() }, () => { toast.success('Cartão arquivado.'); onFechar(true) })}><I.Arquivar aria-hidden="true" />Arquivar</Button>
          <Button variant="ghost" size="sm" className={cn('w-full justify-start text-destructive', alvo)} onClick={() => setExcluir(true)}><I.Lixeira aria-hidden="true" />Excluir</Button>
        </aside>
      </div>

      <AlertDialog open={excluir} onOpenChange={setExcluir}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{tarefa.title}”?</AlertDialogTitle>
            <AlertDialogDescription>O cartão, o checklist, os anexos e as mensagens somem. Não dá para desfazer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={apagar.isPending}
              onClick={() => apagar.mutate(tarefa.id, { onError: e => toast.error(mensagemSegura(e)), onSuccess: () => { toast.success('Cartão excluído.'); onFechar(true) } })}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
