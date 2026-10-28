import { useMemo, useState } from 'react'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { EmptyState, Erro, PageHeader, selectNativo } from '@/components/producer/ui'
import CartaoQuadro from '@/components/producer/quadros/CartaoQuadro'
import CriarQuadro from '@/components/producer/quadros/CriarQuadro'
import Segmentado from '@/components/producer/quadros/Segmentado'
import { useAuth } from '../../hooks/useAuth'
import { useProducerEvents } from '../../hooks/useEvents'
import {
  ROTULO_KIND, filtrarQuadros, mensagemQuadro, ordenarQuadros, useContagemQuadros, useEquipeQuadros, useMembrosQuadros, useQuadros,
  type FiltroQuadro, type KindQuadro, type OrdemQuadro, type QuadroLinha,
} from '../../hooks/useQuadros'

const FILTROS: readonly (readonly [FiltroQuadro, string])[] = [['todos', 'Todos'], ['pessoal', 'Pessoais'], ['equipe', 'Equipe e empresa'], ['evento', 'Por evento']]
const SECOES: readonly (readonly [KindQuadro, string])[] = [['pessoal', 'Pessoais'], ['equipe', ROTULO_KIND.equipe], ['evento', 'Por evento']]
const rotuloSecao = 'flex items-center gap-3 font-sans text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground after:h-px after:flex-1 after:bg-border after:content-[""]'

export default function ProducerQuadros() {
  const { user } = useAuth()
  const quadros = useQuadros()
  const contagem = useContagemQuadros()
  const membros = useMembrosQuadros()
  const { data: eventos = [] } = useProducerEvents()
  const equipe = useEquipeQuadros(!!quadros.data?.some(b => b.producer_id === user?.id)) // a função só responde ao dono
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<FiltroQuadro>('todos')
  const [ordem, setOrdem] = useState<OrdemQuadro>('recentes')
  const [arquivados, setArquivados] = useState(false)
  const [criar, setCriar] = useState<{ categoria: FiltroQuadro } | null>(null)

  const todos = quadros.data ?? []
  const nomes = useMemo(() => new Map((equipe.data ?? []).map(p => [p.id, p.nome])), [equipe.data])
  const eventoDe = (b: QuadroLinha) => (b.event_id ? eventos.find(e => e.id === b.event_id) : undefined)
  const diaDe = (b: QuadroLinha) => eventoDe(b)?.date?.slice(0, 10) ?? null
  const criadosPorMim = todos.filter(b => b.producer_id === user?.id && !b.is_default).length
  const qtdArquivados = todos.filter(b => b.archived_at).length

  const visiveis = filtrarQuadros(todos, { busca, filtro, arquivados })
  const recentes = !arquivados && !busca.trim() && filtro === 'todos' ? ordenarQuadros(visiveis, 'recentes', diaDe).slice(0, 3) : []
  const jaVistos = new Set(recentes.map(b => b.id))

  const cartao = (b: QuadroLinha, grande = false) => (
    <CartaoQuadro key={b.id} quadro={b} grande={grande} sou={b.producer_id === user?.id} eventoDia={diaDe(b)} eventoTitulo={eventoDe(b)?.title}
      contagem={contagem.data?.get(b.id) ?? (contagem.isSuccess ? { abertos: 0, atrasados: 0 } : undefined)} membros={membros.data?.get(b.id) ?? []}
      nomeDe={id => (id === user?.id ? user?.name || 'Você' : nomes.get(id) ?? 'Sem nome')} />
  )
  const tileCriar = (
    <button key="criar" type="button" onClick={() => setCriar({ categoria: filtro })}
      className="flex min-h-28 w-full items-center justify-center gap-2.5 rounded-xl border border-dashed border-border text-sm font-medium text-foreground/80 outline-none transition-colors hover:border-primary hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring">
      <I.Criar aria-hidden="true" />Criar quadro
    </button>
  )

  const header = (
    <PageHeader title="Meus quadros" description="Quadros pessoais, da equipe e de cada evento"
      actions={<Button onClick={() => setCriar({ categoria: filtro })}><I.Criar aria-hidden="true" />Criar quadro</Button>} />
  )
  const modal = criar && <CriarQuadro categoria={criar.categoria} criadosPorMim={criadosPorMim} onFechar={() => setCriar(null)} />

  if (quadros.isPending) {
    return (
      <div aria-busy="true">
        {header}
        <p role="status" className="sr-only">Carregando quadros…</p>
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">{[1, 2, 3].map(n => <Skeleton key={n} className="h-32 rounded-[14px] bg-muted" />)}</div>
      </div>
    )
  }
  if (quadros.isError) {
    return <div>{header}<Erro texto={`Não foi possível carregar os quadros. ${mensagemQuadro(quadros.error)}`} refetch={quadros.refetch} carregando={quadros.isFetching} /></div>
  }
  if (!todos.length) {
    return (
      <div>
        {header}
        <EmptyState title="Nenhum quadro ainda" description="Crie o primeiro a partir de um modelo ou comece do zero."
          action={<Button onClick={() => setCriar({ categoria: 'todos' })}><I.Criar aria-hidden="true" />Criar quadro</Button>} />
        {modal}
      </div>
    )
  }

  const grupos = SECOES.filter(([k]) => filtro === 'todos' || filtro === k)
    .map(([k, titulo]) => ({ k, titulo, lista: ordenarQuadros(visiveis.filter(b => b.kind === k && !jaVistos.has(b.id)), ordem === 'recentes' && k === 'evento' ? 'prazo' : ordem, diaDe) }))
    .filter(g => g.lista.length)
  const secoes = grupos.map((g, i) => (
    <section key={g.k} aria-labelledby={`sec-${g.k}`} className="mt-6">
      <h3 id={`sec-${g.k}`} className={`${rotuloSecao} mb-3`}>{g.titulo}</h3>
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">{i === 0 && !arquivados && tileCriar}{g.lista.map(b => cartao(b))}</div>
    </section>
  ))

  return (
    <div>
      {header}
      <div role="toolbar" aria-label="Controles dos quadros" className="flex flex-wrap items-center gap-2">
        <Input type="search" aria-label="Buscar quadro" placeholder="Buscar quadro" maxLength={60} value={busca} onChange={e => setBusca(e.target.value)} className="w-full sm:w-56" />
        <Segmentado rotulo="Filtrar por tipo" valor={filtro} onChange={setFiltro} opcoes={FILTROS} />
        <select aria-label="Ordenar por" value={ordem} onChange={e => setOrdem(e.target.value as OrdemQuadro)} className={cn(selectNativo, 'w-auto')}>
          <option value="recentes">Mais recentes</option><option value="az">A–Z</option><option value="prazo">Por prazo</option>
        </select>
      </div>

      {recentes.length > 0 && (
        <section aria-labelledby="sec-recentes" className="mt-6">
          <h2 id="sec-recentes" className={`${rotuloSecao} mb-3`}>Recentes</h2>
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">{recentes.map(b => cartao(b, true))}</div>
        </section>
      )}

      <div className="mt-8">
        <h2 className={`${rotuloSecao} -mb-2`}>{arquivados ? 'Arquivados' : 'Todos os quadros'}</h2>
        {secoes.length ? secoes : (
          <div className="mt-4 grid gap-3">
            {recentes.length === 0 && <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">{arquivados ? 'Nenhum quadro arquivado.' : 'Nenhum quadro encontrado.'}</p>}
            {!arquivados && <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">{tileCriar}</div>}
          </div>
        )}
      </div>

      <Button variant="link" className="mt-4 min-h-11 px-0 text-muted-foreground sm:min-h-8" onClick={() => setArquivados(a => !a)}>
        {arquivados ? 'Voltar aos quadros ativos' : `Ver arquivados (${qtdArquivados})`}
      </Button>
      {(contagem.isError || membros.isError) && <p role="status" className="mt-2 text-xs text-muted-foreground">Não foi possível carregar os contadores e as pessoas de alguns quadros.</p>}
      {modal}
    </div>
  )
}
