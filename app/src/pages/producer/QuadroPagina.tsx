import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { useAuth } from '../../hooks/useAuth'
import { ConflitoCartao, useMoverTarefa, type DbTask, type StatusTarefa } from '../../hooks/useProducerTools'
import { RESUMO_VAZIO, mensagemSegura, useResumoCartoes } from '../../hooks/useCartao'
import {
  cartaoDoAviso, useAvisosQuadro, useBipeAvisos, useConfigRecibos, useMarcarAvisos, useMarcarEntregue, usePrefsAvisos,
} from '../../hooks/useQuadroAvisos'
import {
  ROTULO_KIND, ROTULO_VIS, mensagemQuadro, useCriarCartao, useMembrosQuadros, useQuadroPorId, useTarefasDoQuadro,
} from '../../hooks/useQuadros'
import { posicaoNaColuna } from '../../lib/tarefas'
import CartaoVerso from '@/components/producer/quadro/CartaoVerso'
import { SinoQuadro } from '@/components/producer/quadro/AvisosQuadro'
import MenuQuadro, { type PaginaQuadro } from '@/components/producer/quadro/MenuQuadro'
import Quadro from '@/components/producer/quadro/Quadro'
import { useEquipeCartao } from '@/components/producer/quadro/useEquipe'
import MenuDoQuadro from '@/components/producer/quadros/MenuDoQuadro'
import { EmptyState, Erro, PageHeader, chipAviso, chipErro, selectNativo } from '@/components/producer/ui'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const rotuloPrioridade = { low: 'Baixa', medium: 'Média', high: 'Alta' } as const
const corPrioridade = { low: '', medium: chipAviso, high: chipErro } as const

/** Kanban de UM quadro (/producer/quadros/:boardId): a mesma tela de cartões das Tarefas, já com o board_id */
export default function QuadroPagina() {
  const { boardId } = useParams()
  const { user } = useAuth()
  const qc = useQueryClient()
  const um = useQuadroPorId(boardId)
  const lista = useTarefasDoQuadro(boardId)
  const membros = useMembrosQuadros()
  const moverTarefa = useMoverTarefa()
  const criarCartao = useCriarCartao(um.data?.quadro)
  const quadro = um.data?.quadro, colunas = um.data?.colunas ?? []
  const tarefas = useMemo(() => (lista.data ?? []).filter(t => !t.archived_at), [lista.data])
  const pronto = !!quadro && lista.isSuccess

  const [versoId, setVersoId] = useState<string | null>(null)
  const [pagina, setPagina] = useState<PaginaQuadro>(null)
  const [novo, setNovo] = useState<{ titulo: string; coluna: string; erro: string } | null>(null)
  const resumo = useResumoCartoes(pronto ? boardId : null, tarefas.map(t => t.id))
  const pessoas = useEquipeCartao(pronto)

  // Avisos, bipe e confirmação de leitura (fatia 2B): sem o SQL no banco nada disso aparece
  const { prefs, disponivel: avisosOk } = usePrefsAvisos()
  const { avisos, naoLidos, carregado } = useAvisosQuadro(avisosOk)
  useBipeAvisos(avisos, carregado, prefs)
  const { config: recibos, alterar: alterarRecibos } = useConfigRecibos(boardId)
  useMarcarEntregue(tarefas.map(t => t.id), pronto && recibos.disponivel && recibos.ligado)
  const { mutate: marcarAvisos } = useMarcarAvisos()
  const comAviso = useMemo(() => new Set(avisos.filter(a => !a.is_read).map(cartaoDoAviso).filter((x): x is string => !!x)), [avisos])
  useEffect(() => {
    if (!versoId) return
    const ids = avisos.filter(a => !a.is_read && cartaoDoAviso(a) === versoId).map(a => a.id)
    if (ids.length) marcarAvisos(ids)
  }, [versoId, avisos, marcarAvisos])

  // Link ?cartao=<id> (avisos e links antigos de /producer/tarefas): abre o verso e tira o parâmetro da URL
  const [params, setParams] = useSearchParams()
  const cartaoDaUrl = params.get('cartao')
  useEffect(() => {
    if (!cartaoDaUrl || !lista.isSuccess) return
    if (tarefas.some(t => t.id === cartaoDaUrl)) setVersoId(cartaoDaUrl) // eslint-disable-line react-hooks/set-state-in-effect -- o link da URL abre o cartão
    setParams((p: URLSearchParams) => { const n = new URLSearchParams(p); n.delete('cartao'); return n }, { replace: true })
  }, [cartaoDaUrl, lista.isSuccess, tarefas, setParams])

  const euDono = quadro?.producer_id === user?.id
  const meu = membros.data?.get(boardId ?? '')?.find(m => m.user_id === user?.id)
  // 'equipe': o nível vem da ferramenta quadro (o front não sabe), então o botão aparece para quem vê; o banco recusa com 42501 e a tela mostra a frase
  const podeEditar = euDono || (quadro?.visibility === 'escolhidas' ? meu?.nivel === 'editar' : quadro?.visibility === 'equipe')

  const mover = async (t: DbTask, colunaId: string, posicao?: number) => {
    const kind = colunas.find(c => c.id === colunaId)?.kind
    const status: StatusTarefa | undefined = kind && (kind === 'doing' ? 'in_progress' : kind)
    const mudanca = { column_id: colunaId, position: posicao, ...(status && { status }) }
    qc.setQueryData<DbTask[]>(['producer-tasks', user?.id, 'quadro', boardId], old => old?.map(x => (x.id === t.id ? { ...x, ...mudanca } : x))) // otimista; o erro e o fim da gravação recarregam a lista
    try {
      await moverTarefa.mutateAsync({ tarefa: t, mudanca })
    } catch (err) {
      toast.error(err instanceof ConflitoCartao ? 'Outra pessoa mexeu neste cartão. O quadro foi atualizado.' : mensagemSegura(err))
    }
  }
  const moverParaFim = (t: DbTask, colunaId: string) => {
    const fim = tarefas.filter(x => x.column_id === colunaId).map(x => x.position ?? 0).sort((a, b) => a - b)
    mover(t, colunaId, posicaoNaColuna(fim, fim.length))
  }

  const abrirNovo = () => setNovo({ titulo: '', coluna: (colunas.find(c => c.kind === 'todo') ?? colunas[0])?.id ?? '', erro: '' })
  const enviarNovo = async (e: FormEvent) => {
    e.preventDefault()
    if (!novo) return
    try { await criarCartao.mutateAsync({ titulo: novo.titulo, colunaId: novo.coluna }); setNovo(null); toast.success('Cartão criado.') }
    catch (err) { setNovo({ ...novo, erro: mensagemQuadro(err) }) }
  }

  const voltar = <Button variant="outline" asChild><Link to="/producer/quadros"><I.SetaEsquerda aria-hidden="true" />Meus quadros</Link></Button>

  if (um.isPending) {
    return (
      <div aria-busy="true">
        <PageHeader title="Quadro" actions={voltar} />
        <p role="status" className="sr-only">Carregando o quadro…</p>
        <Skeleton className="h-64 rounded-[10px] bg-muted" />
      </div>
    )
  }
  if (um.isError) {
    return <div><PageHeader title="Quadro" actions={voltar} /><Erro texto={`Não foi possível carregar o quadro. ${mensagemQuadro(um.error)}`} refetch={um.refetch} carregando={um.isFetching} /></div>
  }
  if (!quadro) {
    return (
      <div>
        <PageHeader title="Quadro" actions={voltar} />
        <EmptyState title="Quadro não encontrado" description="Ele não existe ou você não tem acesso a ele." />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={quadro.name}
        description={`${ROTULO_KIND[quadro.kind]} · ${ROTULO_VIS[quadro.visibility]}${quadro.archived_at ? ' · Arquivado' : ''}`}
        actions={
          <>
            {voltar}
            {avisosOk && <SinoQuadro avisos={avisos} naoLidos={naoLidos} onPreferencias={() => setPagina('prefs')} />}
            <MenuQuadro pagina={pagina} onPagina={setPagina} avisosDisponivel={avisosOk} config={recibos}
              alterarRecibos={(ligado, onErro) => alterarRecibos.mutate(ligado, { onError: onErro })}
              boardId={quadro.id} colunas={colunas} temEvento={!!quadro.event_id}
              tarefas={tarefas} concluida={t => colunas.find(c => c.id === t.column_id)?.kind === 'done'} />
            <MenuDoQuadro quadro={quadro} comAbrir={false} />
            {podeEditar && <Button onClick={abrirNovo} disabled={!colunas.length}><I.Criar aria-hidden="true" />Novo cartão</Button>}
          </>
        }
      />

      {lista.isPending ? <Skeleton className="h-64 rounded-[10px] bg-muted" />
        : lista.isError ? <Erro texto={`Não foi possível carregar os cartões. ${mensagemQuadro(lista.error)}`} refetch={lista.refetch} carregando={lista.isFetching} />
        : (
          <Quadro
            tarefas={tarefas} colunas={colunas} colunaDe={t => t.column_id ?? ''} ordenavel onMover={mover}
            nomeDe={t => pessoas.find(p => p.id === t.assigned_to)?.nome}
            resumo={resumo.data} nomePessoa={id => pessoas.find(p => p.id === id)?.nome ?? 'Sem nome'}
            onAbrir={t => setVersoId(t.id)} comAviso={avisosOk ? comAviso : undefined}
            furos={t => { const r = resumo.data?.get(t.id); return r?.checkTotal ? [r.checkFeitos, r.checkTotal] : undefined }}
            extras={t => <Badge variant="secondary" className={corPrioridade[t.priority]}>{rotuloPrioridade[t.priority]}</Badge>}
          />
        )}
      {pronto && resumo.isError && <p role="status" className="mt-2 text-xs text-muted-foreground">Não foi possível carregar etiquetas e contadores dos cartões.</p>}

      <CartaoVerso tarefaId={versoId} tarefas={tarefas} boardId={quadro.id} colunas={colunas} pessoas={pessoas}
        resumo={versoId && resumo.data ? resumo.data.get(versoId) ?? RESUMO_VAZIO : undefined} onFechar={() => setVersoId(null)} onMover={moverParaFim} />

      <Dialog open={!!novo} onOpenChange={a => { if (!a) setNovo(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo cartão</DialogTitle><DialogDescription>O cartão entra no fim da coluna escolhida.</DialogDescription></DialogHeader>
          {novo && (
            <form id="form-novo-cartao" onSubmit={enviarNovo} className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="cartao-titulo">Título</Label>
                <Input id="cartao-titulo" maxLength={200} value={novo.titulo} autoComplete="off" onChange={e => setNovo({ ...novo, titulo: e.target.value, erro: '' })} placeholder="Ex.: Contratar o DJ" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cartao-coluna">Coluna</Label>
                <select id="cartao-coluna" value={novo.coluna} onChange={e => setNovo({ ...novo, coluna: e.target.value })} className={selectNativo}>
                  {colunas.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <p role="alert" className="min-h-4 text-[12.5px] font-medium text-destructive">{novo.erro}</p>
            </form>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovo(null)}>Cancelar</Button>
            <Button type="submit" form="form-novo-cartao" loading={criarCartao.isPending}>Criar cartão</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
