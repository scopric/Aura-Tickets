import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { cn } from '@/lib/utils'
import { useProducerEvents } from '../../hooks/useEvents'
import { useFiltroEvento } from '../../hooks/useEventoDaUrl'
import { useAuth } from '../../hooks/useAuth'
import { useParticipantes, useReenviarIngresso } from '../../hooks/useParticipantes'
import { faltaSegundoFator } from '../../lib/vendasPagas'
import { brl } from '../../lib/taxa'
import { downloadCsv, csvFilename, slugArquivo } from '../../lib/exportCsv'
import { situacaoEvento } from '../../lib/eventoProdutor'
import { forma, dataBR } from '../../lib/bordero'
import {
  ABAS, ROTULO_ABA, SITUACAO, quando, csvParticipantes, entradasFeitas, filtrar, linhaDoTempo, resumo,
  type Aba, type FiltroCheckin, type Participante,
} from '../../lib/participantes'
import FiltroEvento from '@/components/producer/FiltroEvento'
import { CabecalhoEvento, EmBreve, KpiCard } from '@/components/producer/ui-evento'
import { PageHeader, EmptyState, Erro, SectionTitle, selectNativo } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

const POR_PAGINA = 25
const nomeDe = (p: Participante) => p.customer_name || p.ingressos[0]?.buyer_name || 'Sem nome'
const emailDe = (p: Participante) => p.customer_email || p.ingressos[0]?.buyer_email || 'Sem e-mail'
const aba = (v: string | null): Aba => ABAS.find(a => a === v) ?? 'confirmados'

export default function ProducerParticipantes() {
  const { user } = useAuth()
  const eventos = useProducerEvents()
  const lista = eventos.data ?? []
  const [eventId, trocarEvento] = useFiltroEvento()
  const evento = eventId ? lista.find(e => e.id === eventId) : undefined
  // só os eventos do produtor entram na consulta; ?eventId= de outro evento não lê nada
  const eventoInvalido = !!eventId && !!eventos.data && !lista.some(e => e.id === eventId)
  const dados = useParticipantes(eventId, eventos.data ? lista.map(e => e.id) : undefined)
  const [params, setParams] = useSearchParams()
  const abaAtual = aba(params.get('aba'))

  const [busca, setBusca] = useState('')
  const [tipo, setTipo] = useState('')
  const [checkin, setCheckin] = useState<FiltroCheckin>('todos')
  const [pagina, setPagina] = useState(0)
  const [aberto, setAberto] = useState<string | null>(null)

  useEffect(() => { setTipo(''); setPagina(0) }, [eventId])

  const todos = dados.data ?? []
  const r = resumo(todos)
  const tipos = [...new Map(todos.flatMap(p => p.ingressos).map(t => [t.ticket_type_id, t.ticket_types?.name ?? 'Ingresso'])).entries()]
  const filtrados = filtrar(todos, { aba: abaAtual, busca, tipo, checkin })
  const ultima = Math.max(0, Math.ceil(filtrados.length / POR_PAGINA) - 1)
  const paginaOk = Math.min(pagina, ultima)
  const visiveis = filtrados.slice(paginaOk * POR_PAGINA, (paginaOk + 1) * POR_PAGINA)
  const selecionado = todos.find(p => p.id === aberto) ?? null
  const tituloDe = (id: string) => lista.find(e => e.id === id)?.title

  // zero em tudo pode ser sessão sem 2FA concluído (o banco devolve vazio, sem erro): nunca mostrar "0 participantes" falso
  const semDados = !!dados.data && todos.length === 0
  const doisFatores = useQuery({ queryKey: ['producer-2fa-pendente', user?.id], enabled: semDados, queryFn: faltaSegundoFator })

  const mudaAba = (v: string) => { setPagina(0); setParams((p: URLSearchParams) => { const n = new URLSearchParams(p); n.set('aba', v); return n }, { replace: true }) }
  const filtro = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPagina(0) }

  const exportar = () => {
    downloadCsv(csvFilename(`participantes-${slugArquivo(evento?.title, eventId ?? 'todos')}`), csvParticipantes(filtrados))
    toast.info('O arquivo tem nome e e-mail dos compradores: dado pessoal (LGPD). Não compartilhe.')
  }
  const exportarBtn = (
    <Button variant="outline" className="min-h-11 print:hidden" onClick={exportar} disabled={filtrados.length === 0 || abaAtual === 'convidados'}>
      <I.Baixar aria-hidden="true" />Exportar CSV
    </Button>
  )

  const cabecalho = evento ? (
    <>
      <CabecalhoEvento titulo={evento.title} situacao={situacaoEvento(evento)} detalhes={[evento.date && dataBR(evento.date)]} editarHref={`/producer/events/${evento.id}/edit`} extras={exportarBtn} />
      <h2 className="mb-4 text-lg font-semibold text-foreground">Participantes</h2>
    </>
  ) : (
    <PageHeader title="Participantes" description="Quem comprou ingresso nos seus eventos" actions={exportarBtn} />
  )

  let corpo
  if (eventoInvalido) {
    corpo = <EmptyState title="Evento não encontrado entre os seus" description="O link aponta para um evento que não é seu ou não existe mais." action={<Button variant="outline" className="min-h-11" onClick={() => trocarEvento(null)}>Ver todos os eventos</Button>} />
  } else if (eventos.isPending || dados.isPending) {
    corpo = (
      <div aria-busy="true" aria-label="Carregando participantes">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[1, 2, 3, 4].map(n => <Skeleton key={n} className="h-[88px] rounded-[10px] bg-muted" />)}</div>
        <Skeleton className="mt-6 h-64 rounded-[10px] bg-muted" />
      </div>
    )
  } else if (dados.isError || eventos.isError) {
    corpo = <Erro texto="Não foi possível carregar os participantes." refetch={() => { void dados.refetch(); void eventos.refetch() }} carregando={dados.isFetching} />
  } else if (semDados && doisFatores.isPending) {
    corpo = <div aria-busy="true"><Skeleton className="h-40 rounded-[10px] bg-muted" /></div>
  } else if (semDados && doisFatores.isError) {
    corpo = <Erro texto="Não consegui confirmar o seu acesso (2FA). Sem isso a lista pode parecer vazia." refetch={() => { void doisFatores.refetch() }} carregando={doisFatores.isFetching} />
  } else if (semDados && doisFatores.data) {
    corpo = <EmptyState title="Confirme o 2FA para ver os participantes" description="Saia e entre de novo, informando o código do 2FA. Sem isso o banco não mostra os pedidos." />
  } else if (semDados) {
    corpo = <EmptyState title={eventId ? 'Nenhum pedido neste evento ainda' : 'Nenhum pedido ainda'} description="Quando alguém comprar ingresso de um evento seu, a pessoa aparece aqui. Divulgue o link do evento para vender." />
  } else {
    corpo = (
      <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard rotulo="Pedidos confirmados" valor={r.confirmados.toLocaleString('pt-BR')} comparacao="no total" />
          <KpiCard rotulo="Pedidos pendentes" valor={r.pendentes.toLocaleString('pt-BR')} comparacao="no total" />
          <KpiCard rotulo="Pedidos cancelados" valor={r.cancelados.toLocaleString('pt-BR')} comparacao="no total" />
          <KpiCard rotulo="Entradas feitas" valor={`${r.entradas.toLocaleString('pt-BR')} de ${r.ingressos.toLocaleString('pt-BR')}`} comparacao="ingressos de pedidos confirmados, no total" />
        </div>

        <Tabs value={abaAtual} onValueChange={mudaAba} className="mt-6">
          <TabsList aria-label="Situação do pedido" className="max-w-full overflow-x-auto">
            {ABAS.map(a => (
              <TabsTrigger key={a} value={a} className="min-h-11">
                {ROTULO_ABA[a]}{a !== 'convidados' && <span className="ml-1.5 tabular-nums text-muted-foreground">{r[a].toLocaleString('pt-BR')}</span>}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {abaAtual === 'convidados' ? (
          <div className="mt-4">
            <EmBreve titulo="Convidados e cortesias" descricao="Lista de convidados com ingresso de cortesia e convite por e-mail. Depende de um SQL novo no banco (cortesia e convite), ainda não aplicado." acao="Adicionar convidado" />
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="w-full sm:w-72">
                <label htmlFor="part-busca" className="mb-1 block text-sm text-muted-foreground">Buscar por nome ou e-mail</label>
                <Input id="part-busca" type="search" value={busca} onChange={e => filtro(setBusca)(e.target.value)} className="min-h-11" autoComplete="off" />
              </div>
              <div>
                <label htmlFor="part-tipo" className="mb-1 block text-sm text-muted-foreground">Tipo de ingresso</label>
                <select id="part-tipo" value={tipo} onChange={e => filtro(setTipo)(e.target.value)} className={cn(selectNativo, 'min-h-11 w-auto min-w-44')}>
                  <option value="">Todos os tipos</option>
                  {tipos.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="part-checkin" className="mb-1 block text-sm text-muted-foreground">Check-in</label>
                <select id="part-checkin" value={checkin} onChange={e => filtro(setCheckin)(e.target.value as FiltroCheckin)} className={cn(selectNativo, 'min-h-11 w-auto min-w-44')}>
                  <option value="todos">Todos</option>
                  <option value="feito">Entrada feita</option>
                  <option value="nao">Sem entrada</option>
                </select>
              </div>
            </div>

            {filtrados.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title={`Ninguém em ${ROTULO_ABA[abaAtual].toLowerCase()} com esses filtros`}
                  description={busca || tipo || checkin !== 'todos' ? 'Limpe a busca e os filtros para ver todos.' : 'Os pedidos desta situação aparecem aqui.'}
                  action={(busca || tipo || checkin !== 'todos') && <Button variant="outline" className="min-h-11" onClick={() => { setBusca(''); setTipo(''); setCheckin('todos'); setPagina(0) }}>Limpar filtros</Button>}
                />
              </div>
            ) : (
              <section aria-label="Lista de participantes" className="mt-4 rounded-[10px] border border-border bg-card">
                <div aria-hidden="true" className="hidden grid-cols-[2fr_1.2fr_1fr_1fr_1fr] gap-3 border-b border-border px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
                  <span>Comprador</span><span>Ingressos</span><span>Total</span><span>Check-in</span><span>Pedido em</span>
                </div>
                <ul className="divide-y divide-border">
                  {visiveis.map(p => {
                    const feitas = entradasFeitas(p)
                    return (
                      <li key={p.id}>
                        <button type="button" onClick={() => setAberto(p.id)} aria-label={`Abrir detalhes de ${nomeDe(p)}`}
                          className="grid min-h-11 w-full grid-cols-2 gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:grid-cols-[2fr_1.2fr_1fr_1fr_1fr] md:items-center">
                          <span className="col-span-2 min-w-0 md:col-span-1">
                            <span className="block truncate text-sm font-medium text-foreground">{nomeDe(p)}</span>
                            <span className="block truncate text-xs text-muted-foreground">{emailDe(p)}{!eventId && tituloDe(p.event_id) ? ` · ${tituloDe(p.event_id)}` : ''}</span>
                          </span>
                          <span className="text-sm text-foreground">{p.ingressos.length} {p.ingressos.length === 1 ? 'ingresso' : 'ingressos'}</span>
                          <span className="text-right text-sm tabular-nums text-foreground md:text-left">{brl(Number(p.total) || 0)}</span>
                          <span className="inline-flex items-center gap-1 text-sm text-foreground">
                            {feitas > 0 ? <I.Liberado size={14} aria-hidden="true" /> : <I.Negado size={14} aria-hidden="true" />}
                            {p.ingressos.length === 0 ? 'Sem ingresso' : feitas > 0 ? `Entrou (${feitas}/${p.ingressos.length})` : 'Não entrou'}
                          </span>
                          <span className="text-right text-xs text-muted-foreground md:text-left">{quando(p.created_at)}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
                  <p className="text-xs text-muted-foreground" aria-live="polite">
                    {paginaOk * POR_PAGINA + 1} a {paginaOk * POR_PAGINA + visiveis.length} de {filtrados.length.toLocaleString('pt-BR')}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="min-h-11" disabled={paginaOk === 0} onClick={() => setPagina(paginaOk - 1)}>Anterior</Button>
                    <Button variant="outline" size="sm" className="min-h-11" disabled={paginaOk >= ultima} onClick={() => setPagina(paginaOk + 1)}>Próxima</Button>
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        <div className="mt-8">
          <SectionTitle>Em breve</SectionTitle>
          <div className="mt-3 max-w-xl">
            <EmBreve titulo="Adicionar pedido manual" descricao="Registrar uma venda feita fora do site (dinheiro, Pix direto) e emitir o ingresso. Precisa de uma função nova no banco (RPC), ainda não criada." acao="Adicionar pedido" />
          </div>
        </div>
      </>
    )
  }

  return (
    <div>
      {cabecalho}
      <FiltroEvento />
      {corpo}
      <Detalhe p={selecionado} onClose={() => setAberto(null)} />
    </div>
  )
}

function Detalhe({ p, onClose }: { p: Participante | null; onClose: () => void }) {
  const reenviar = useReenviarIngresso()
  const [confirmar, setConfirmar] = useState(false)
  return (
    <>
      <Sheet open={!!p} onOpenChange={o => { if (!o) onClose() }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {p && (
            <>
              <SheetHeader>
                <SheetTitle>{nomeDe(p)}</SheetTitle>
                <SheetDescription>Pedido {p.id.slice(0, 8)}</SheetDescription>
              </SheetHeader>
              <div className="space-y-6 px-4 pb-6">
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">E-mail</dt><dd className="break-all text-foreground">{emailDe(p)}</dd>
                  <dt className="text-muted-foreground">Total</dt><dd className="text-foreground">{brl(Number(p.total) || 0)}</dd>
                  <dt className="text-muted-foreground">Pagamento</dt><dd className="text-foreground">{forma(p.payment_method)}</dd>
                  <dt className="text-muted-foreground">Situação</dt><dd className="text-foreground">{SITUACAO[p.status] ?? p.status}</dd>
                </dl>

                <section aria-labelledby="det-ingressos">
                  <SectionTitle id="det-ingressos">Ingressos do pedido</SectionTitle>
                  {p.ingressos.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Nenhum ingresso emitido neste pedido.</p> : (
                    <ul className="mt-2 divide-y divide-border rounded-[10px] border border-border">
                      {p.ingressos.map(t => (
                        <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                          <span className="min-w-0"><span className="block truncate text-foreground">{t.ticket_types?.name ?? 'Ingresso'}</span><span className="block truncate text-xs text-muted-foreground">{t.buyer_name || 'Sem nome'}</span></span>
                          <span className="shrink-0 text-xs text-foreground">{t.checked_in_at ? 'Entrou' : t.status === 'active' ? 'Válido' : t.status === 'used' ? 'Usado' : 'Inativo'}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section aria-labelledby="det-tempo">
                  <SectionTitle id="det-tempo">Linha do tempo</SectionTitle>
                  <ol className="mt-2 space-y-2 border-l border-border pl-4">
                    {linhaDoTempo(p).map(m => (
                      <li key={m.chave} className="text-sm">
                        <span className="text-foreground">{m.texto}</span>
                        <span className="block text-xs text-muted-foreground">{m.quando ? quando(m.quando) : 'hora não registrada'}</span>
                      </li>
                    ))}
                  </ol>
                </section>

                {p.status === 'paid' && p.ingressos.length > 0 && (
                  <Button className="min-h-11 w-full" onClick={() => setConfirmar(true)} loading={reenviar.isPending}>
                    <I.Transferir aria-hidden="true" />Reenviar ingresso por e-mail
                  </Button>
                )}

                <section aria-labelledby="det-breve" className="space-y-3">
                  <SectionTitle id="det-breve">Em breve</SectionTitle>
                  <EmBreve titulo="Transferir titularidade" descricao="Passar o ingresso para outra pessoa sem custo (Decreto 13.108, art. 17). Precisa de uma função nova no banco (RPC)." acao="Transferir" />
                  <EmBreve titulo="Selo de meia-entrada" descricao="Marcar e conferir quem comprou meia. Depende do módulo de meia-entrada (M5)." acao="Marcar meia" />
                  <EmBreve titulo="Reenviar por WhatsApp" descricao="Mandar o ingresso pelo WhatsApp do comprador. Depende da integração com o gateway PagBank." acao="Enviar por WhatsApp" />
                  <EmBreve titulo="Cancelar e reembolsar" descricao="Cancelar o pedido e devolver o valor. Depende da integração com o gateway PagBank." acao="Cancelar pedido" />
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reenviar o ingresso?</AlertDialogTitle>
            <AlertDialogDescription>O e-mail com o PDF dos ingressos vai para a conta de quem comprou ({p ? emailDe(p) : ''}). Cada pedido aceita até 3 envios por hora.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Voltar</AlertDialogCancel>
            <AlertDialogAction className="min-h-11" onClick={() => p && reenviar.mutate(p.id)}>Reenviar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
