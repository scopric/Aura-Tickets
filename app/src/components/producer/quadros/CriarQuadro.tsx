import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { selectNativo } from '@/components/producer/ui'
import { cn } from '@/lib/utils'
import { useProducerEvents } from '../../../hooks/useEvents'
import {
  LIMITE_PESSOAS, LIMITE_QUADROS, NOME_MAX, ROTULO_KIND, ROTULO_VIS, mensagemQuadro, rotuloDias, validarNome, visibilidadePadrao,
  useCriarQuadro, useEquipeQuadros, useModelosQuadro,
  type KindQuadro, type NivelQuadro, type VisQuadro,
} from '../../../hooks/useQuadros'
import Segmentado from './Segmentado'
import SeletorPessoas from './SeletorPessoas'

type Cat = 'todos' | KindQuadro
const CATS: readonly (readonly [Cat, string])[] = [['todos', 'Todos'], ['evento', 'Eventos'], ['equipe', 'Equipe e empresa'], ['pessoal', 'Pessoal']]
const TIPOS: readonly (readonly [KindQuadro, string])[] = [['evento', 'Evento'], ['equipe', 'Equipe e empresa'], ['pessoal', 'Pessoal']]
const VIS: readonly (readonly [VisQuadro, string])[] = [['pessoal', ROTULO_VIS.pessoal], ['equipe', ROTULO_VIS.equipe], ['escolhidas', ROTULO_VIS.escolhidas]]
const COLS_ZERO = ['A fazer', 'Em andamento', 'Feito']
const ICONE: Record<string, typeof I.Estrela> = {
  evento_completo: I.Estrela, dia_a_dia: I.Sol, fornecedores: I.Caminhao, divulgacao: I.Divulgacao, pos_evento: I.Bandeira,
  reuniao_equipe: I.Conversa, financeiro_equipe: I.Carteira, lancamento_vendas: I.Raio,
}
const Capa = ({ Ic }: { Ic: typeof I.Estrela }) => (
  <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-[10px] bg-primary/10 text-primary"><Ic size={22} /></span>
)
const cartoes = (n: number) => `${n} ${n === 1 ? 'cartão inicial' : 'cartões iniciais'}`

/** "Criar quadro" em 2 passos: modelo, depois nome, tipo, quem vê e pessoas. Montar quando for abrir (o estado nasce zerado). */
export default function CriarQuadro({ categoria = 'todos', criadosPorMim, onFechar }: { categoria?: Cat; criadosPorMim: number; onFechar: () => void }) {
  const navegar = useNavigate()
  const modelos = useModelosQuadro()
  const { data: eventos = [] } = useProducerEvents()
  const criar = useCriarQuadro()
  const [passo, setPasso] = useState<1 | 2>(1)
  const [cat, setCat] = useState<Cat>(categoria)
  const [busca, setBusca] = useState('')
  const [modeloKey, setModeloKey] = useState<string | null>(null) // null = começar do zero
  const [nome, setNome] = useState('')
  const [kind, setKind] = useState<KindQuadro>('equipe')
  const [eventId, setEventId] = useState('')
  const [vis, setVis] = useState<VisQuadro>('equipe')
  const [sel, setSel] = useState<Record<string, NivelQuadro>>({})
  const [erros, setErros] = useState<{ nome?: string; evento?: string; pessoas?: string; geral?: string }>({})
  const equipe = useEquipeQuadros(passo === 2 && vis === 'escolhidas')
  const campoNome = useRef<HTMLInputElement>(null)
  useEffect(() => { if (passo === 2) campoNome.current?.focus() }, [passo]) // o botão que levou ao passo 2 some: o foco vai para o nome

  const modelo = modelos.data?.find(m => m.key === modeloKey)
  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return (modelos.data ?? []).filter(m => (cat === 'todos' || m.kind_sugerido === cat) && (!t || `${m.name} ${m.description ?? ''}`.toLowerCase().includes(t)))
  }, [modelos.data, cat, busca])
  const contagem = (c: Cat) => (modelos.data ?? []).filter(m => c === 'todos' || m.kind_sugerido === c).length
  const colunas = modelo ? modelo.columns.map(c => c.name) : COLS_ZERO
  const noTeto = criadosPorMim >= LIMITE_QUADROS

  const avancar = () => {
    setNome(modelo?.name ?? ''); setKind(modelo?.kind_sugerido ?? 'equipe'); setVis(visibilidadePadrao(modelo?.kind_sugerido ?? 'equipe'))
    setErros({}); setPasso(2)
  }
  const mudarTipo = (k: KindQuadro) => { setKind(k); setVis(visibilidadePadrao(k)); setErros(e => ({ ...e, evento: undefined, pessoas: undefined })) }

  const enviar = async () => {
    const e = { nome: validarNome(nome) || undefined, evento: kind === 'evento' && !eventId ? 'Escolha o evento do quadro.' : undefined,
      pessoas: vis === 'escolhidas' && !Object.keys(sel).length ? 'Escolha ao menos uma pessoa.' : undefined,
      geral: noTeto ? `Você chegou ao limite de ${LIMITE_QUADROS} quadros (os arquivados contam).` : undefined }
    setErros(e)
    if (e.nome || e.evento || e.pessoas || e.geral) return
    try {
      const id = await criar.mutateAsync({ nome, kind, eventId: eventId || null, modelo: modeloKey, visibilidade: vis, membros: sel })
      onFechar()
      toast.success(`Quadro criado: ${nome.trim()}.`, { action: { label: 'Abrir', onClick: () => navegar(`/producer/quadros/${id}`) } })
    } catch (err) {
      setErros({ geral: mensagemQuadro(err) })
    }
  }

  const resumo = vis === 'pessoal' ? 'Só você.' : vis === 'equipe' ? 'Você e a equipe que tem acesso ao quadro.'
    : `Você e ${Object.keys(sel).length} ${Object.keys(sel).length === 1 ? 'pessoa' : 'pessoas'}.`

  return (
    <Dialog open onOpenChange={aberto => { if (!aberto) onFechar() }}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] gap-0 overflow-y-auto overflow-x-hidden p-0 sm:max-w-3xl">
        <div className="grid md:grid-cols-[minmax(0,1fr)_250px]">
          <div className="min-w-0 p-5 sm:p-6">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">Passo {passo} de 2</p>
            <DialogTitle className="mt-1 text-2xl font-medium tracking-[-0.03em]">Criar quadro</DialogTitle>
            <DialogDescription className="sr-only">Escolha um modelo e depois o nome, o tipo e quem vê o quadro.</DialogDescription>

            {passo === 1 ? (
              <div className="mt-4 grid gap-3">
                <Segmentado rotulo="Categorias de modelo" valor={cat} onChange={setCat}
                  opcoes={CATS.map(([v, t]) => [v, `${t} ${contagem(v)}`] as const)} />
                <Input type="search" aria-label="Buscar modelo" placeholder="Buscar modelo" maxLength={60} value={busca} onChange={e => setBusca(e.target.value)} />
                <div role="radiogroup" aria-label="Modelos" className="grid max-h-[46vh] auto-rows-min gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2">
                  <Tile Ic={I.Criar} titulo="Começar do zero" desc="Quadro vazio com três colunas." rodape={COLS_ZERO.join(' · ')} ativo={modeloKey === null} onClick={() => setModeloKey(null)} largo />
                  {lista.map(m => (
                    <Tile key={m.key} Ic={m.owner_id ? I.Pasta : ICONE[m.key] ?? I.Prancheta} titulo={m.name} desc={m.description ?? (m.owner_id ? 'Salvo a partir de um quadro seu.' : '')}
                      rodape={cartoes(m.cards.length)} ativo={modeloKey === m.key} onClick={() => setModeloKey(m.key)} />
                  ))}
                </div>
                {modelos.isPending && <p role="status" className="text-sm text-muted-foreground">Carregando modelos…</p>}
                {modelos.isError && <p role="alert" className="text-sm text-destructive">Não foi possível carregar os modelos. Você ainda pode começar do zero.</p>}
                {!modelos.isPending && !modelos.isError && lista.length === 0 && <p className="rounded-[10px] border border-dashed border-border p-4 text-center text-sm text-muted-foreground">Nenhum modelo encontrado.</p>}
              </div>
            ) : (
              <div className="mt-4 grid gap-4">
                <div className="grid gap-1.5">
                  <label htmlFor="quadro-nome" className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">Nome</label>
                  <Input id="quadro-nome" ref={campoNome} value={nome} maxLength={NOME_MAX} autoComplete="off" aria-invalid={!!erros.nome} aria-describedby={erros.nome ? "quadro-nome-erro" : undefined}
                    onChange={e => { setNome(e.target.value); setErros(x => ({ ...x, nome: undefined })) }} />
                  {erros.nome && <p id="quadro-nome-erro" role="alert" className="text-[12.5px] font-medium text-destructive">{erros.nome}</p>}
                </div>
                <div className="grid gap-1.5">
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">Tipo</span>
                  <Segmentado rotulo="Tipo de quadro" valor={kind} onChange={mudarTipo} opcoes={TIPOS} />
                </div>
                {kind === 'evento' && (
                  <div className="grid gap-1.5">
                    <label htmlFor="quadro-evento" className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">Evento</label>
                    <select id="quadro-evento" className={selectNativo} value={eventId} aria-invalid={!!erros.evento} aria-describedby={erros.evento ? "quadro-evento-erro" : undefined}
                      onChange={e => { setEventId(e.target.value); setErros(x => ({ ...x, evento: undefined })) }}>
                      <option value="">{eventos.length ? 'Escolha o evento' : 'Você ainda não tem evento'}</option>
                      {eventos.map(ev => <option key={ev.id} value={ev.id}>{ev.title}{ev.date ? ` · ${ev.date.slice(0, 10).split('-').reverse().join('/')}` : ''}</option>)}
                    </select>
                    <p className="text-[12.5px] text-muted-foreground">Os prazos dos cartões seguem a data do evento.</p>
                    {erros.evento && <p id="quadro-evento-erro" role="alert" className="text-[12.5px] font-medium text-destructive">{erros.evento}</p>}
                  </div>
                )}
                <div className="grid gap-1.5">
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">Quem vê</span>
                  <Segmentado rotulo="Quem vê o quadro" valor={vis} onChange={v => { setVis(v); setErros(x => ({ ...x, pessoas: undefined })) }} opcoes={VIS} desligadas={kind === 'pessoal' ? ['equipe', 'escolhidas'] : []} />
                  {kind === 'pessoal' && <p className="text-[12.5px] text-muted-foreground">Pessoal fica só com você.</p>}
                </div>
                {vis === 'escolhidas' && (
                  <div className="grid gap-1.5">
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">Pessoas (até {LIMITE_PESSOAS})</span>
                    {equipe.isPending ? <p role="status" className="text-sm text-muted-foreground">Carregando a equipe…</p>
                      : equipe.isError ? <p role="alert" className="text-sm text-destructive">Não foi possível carregar a equipe.</p>
                      : <SeletorPessoas equipe={equipe.data ?? []} valor={sel} onChange={v => { setSel(v); setErros(x => ({ ...x, pessoas: undefined })) }} />}
                    {erros.pessoas && <p role="alert" className="text-[12.5px] font-medium text-destructive">{erros.pessoas}</p>}
                  </div>
                )}
                {erros.geral && <p role="alert" className="text-[12.5px] font-medium text-destructive">{erros.geral}</p>}
              </div>
            )}
          </div>

          <aside aria-label="Resumo do quadro" className="flex min-w-0 flex-col gap-3 border-t border-dashed border-border bg-muted/40 p-5 md:border-l md:border-t-0">
            <div className="pr-8">
              <h3 className="font-mono text-[10px] font-medium uppercase tracking-[0.09em] text-muted-foreground">Prévia</h3>
              <div aria-live="polite" className="mt-2 text-[13px] text-foreground/80">
                <b className="font-semibold">{modelo?.name ?? 'Quadro vazio'}</b>
                <ol className="mt-1.5 grid gap-0.5">{colunas.map((c, i) => <li key={i} className="flex items-center gap-2"><span aria-hidden="true" className="size-[5px] rounded-full bg-border" />{c}</li>)}</ol>
                {!!modelo?.cards.length && (
                  <ul className="mt-2.5 grid gap-0.5 border-t border-dashed border-border pt-2 text-muted-foreground">
                    {modelo.cards.slice(0, 3).map((k, i) => <li key={i}>{k.titulo}{k.dias == null ? '' : ` · ${rotuloDias(k.dias)}`}</li>)}
                    {modelo.cards.length > 3 && <li>+ {modelo.cards.length - 3} cartões</li>}
                  </ul>
                )}
              </div>
            </div>
            {passo === 2 && (
              <div>
                <h3 className="font-mono text-[10px] font-medium uppercase tracking-[0.09em] text-muted-foreground">Quem verá</h3>
                <p aria-live="polite" className="mt-1.5 text-[12.5px] text-foreground/80">{resumo}</p>
                <p className="mt-1 text-[12px] text-muted-foreground">{ROTULO_KIND[kind]} · {ROTULO_VIS[vis]}</p>
              </div>
            )}
            <div className="mt-auto flex flex-col gap-1.5 pt-3">
              {passo === 1
                ? <Button onClick={avancar} disabled={noTeto} className="min-h-11 sm:min-h-9">Continuar</Button>
                : <Button onClick={enviar} loading={criar.isPending} className="min-h-11 sm:min-h-9">Criar quadro</Button>}
              {passo === 2 && <Button variant="outline" onClick={() => setPasso(1)} className="min-h-11 sm:min-h-9">Voltar</Button>}
              <Button variant="outline" onClick={onFechar} className="min-h-11 sm:min-h-9">Cancelar</Button>
              {noTeto && passo === 1 && <p role="alert" className="text-[12.5px] font-medium text-destructive">Você chegou ao limite de {LIMITE_QUADROS} quadros (os arquivados contam).</p>}
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Tile({ Ic, titulo, desc, rodape, ativo, onClick, largo }: { Ic: typeof I.Estrela; titulo: string; desc: string; rodape: string; ativo: boolean; onClick: () => void; largo?: boolean }) {
  return (
    <button type="button" role="radio" aria-checked={ativo} onClick={onClick}
      className={cn('flex min-h-[92px] w-full items-start gap-3 rounded-xl border border-border bg-card p-3 text-left outline-none transition-colors hover:border-foreground/40 focus-visible:ring-2 focus-visible:ring-ring',
        ativo && 'border-primary ring-2 ring-primary/30', largo && 'sm:col-span-2')}>
      <Capa Ic={Ic} />
      <span className="min-w-0">
        <strong className="block text-[15px] font-semibold leading-snug tracking-[-0.012em]">{titulo}</strong>
        {desc && <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{desc}</span>}
        <span className="mt-1.5 block text-[12.5px] text-foreground/75">{rodape}</span>
      </span>
    </button>
  )
}
