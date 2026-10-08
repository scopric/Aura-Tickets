import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { useProducerEvents, type DbTicketType } from '../../hooks/useEvents'
import { useFiltroEvento } from '../../hooks/useEventoDaUrl'
import { useAuth } from '../../hooks/useAuth'
import { useAlternarIngresso, useReceitaDoEvento, useReordenarIngressos, useVendidosPorTipo } from '../../hooks/useIngressos'
import { faltaSegundoFator } from '../../lib/vendasPagas'
import { brl, brlOuGratis } from '../../lib/taxa'
import { situacaoEvento } from '../../lib/eventoProdutor'
import { dataBR } from '../../lib/bordero'
import { ingDoBanco } from '../../lib/painelEvento'
import { abasIngressosCupons, janelaDeVenda, kpisIngressos, mover, ordenar, ordensAlteradas, ROTULO_TIPO, totalDe } from '../../lib/ingressos'
import FiltroEvento from '@/components/producer/FiltroEvento'
import IngressoModal from '@/components/producer/IngressoModal'
import IngressoPrevia from '@/components/producer/IngressoPrevia'
import { AbasDeArea, CabecalhoEvento, EmBreve, KpiCard } from '@/components/producer/ui-evento'
import { PageHeader, EmptyState, Erro, SectionTitle, chipNeutro } from '@/components/producer/ui'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

const n = (v: number) => v.toLocaleString('pt-BR')

export default function ProducerIngressos() {
  const { user } = useAuth()
  const eventos = useProducerEvents()
  const lista = eventos.data ?? []
  const [eventId, trocarEvento] = useFiltroEvento()
  const evento = eventId ? lista.find(e => e.id === eventId) : undefined
  // só os eventos do produtor entram na consulta; ?eventId= de outro evento não lê nada
  const eventoInvalido = !!eventId && !!eventos.data && !evento
  const idOk = evento ? evento.id : null
  const vd = useVendidosPorTipo(idOk)
  const receita = useReceitaDoEvento(idOk)
  const reordenar = useReordenarIngressos()
  const alternar = useAlternarIngresso()

  const [modal, setModal] = useState<{ ing: ReturnType<typeof ingDoBanco> | null } | null>(null)
  const [previa, setPrevia] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState<{ t: DbTicketType; ativo: boolean } | null>(null)
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [aviso, setAviso] = useState('')

  const tipos = ordenar(evento?.ticket_types ?? [])
  const vendidos: Record<string, number> = Object.fromEntries(tipos.map(t => [t.id, Math.max(vd.data?.[t.id] ?? 0, Number(t.sold) || 0)]))
  const k = kpisIngressos(tipos, vendidos)

  // zero em tudo pode ser sessão sem 2FA concluído (o banco devolve vazio, sem erro): nunca mostrar "0 vendidos" falso
  const zerado = !!evento && tipos.length > 0 && !!vd.data && receita.data === 0 && k.vendidos === 0
  const doisFatores = useQuery({ queryKey: ['producer-2fa-pendente', user?.id], enabled: zerado, queryFn: faltaSegundoFator })
  const semFator = zerado && doisFatores.data === true

  const mexer = (de: number, para: number) => {
    if (reordenar.isPending) return // espera a gravação anterior: duas ordens ao mesmo tempo se misturam
    const nova = mover(tipos, de, para)
    const ordens = ordensAlteradas(tipos, nova)
    if (!ordens.length || !evento) return
    setAviso(`${tipos[de].name} agora é o ${para + 1}º de ${tipos.length}.`)
    reordenar.mutate({ eventId: evento.id, ordens }, { onError: () => toast.error('A ordem pode ter ficado parcial; confira a lista.') })
  }
  const trocarVisivel = () => {
    if (!confirmar || !evento) return
    const { t, ativo } = confirmar
    alternar.mutate({ eventId: evento.id, id: t.id, ativo }, {
      onSuccess: () => toast.success(ativo ? 'Ingresso de volta à venda.' : 'Ingresso oculto: não aparece mais para venda.'),
      onError: () => toast.error('Não foi possível mudar o ingresso. Tente de novo.'),
    })
  }

  const novoBtn = <Button className="min-h-11" onClick={() => setModal({ ing: null })}><I.Criar aria-hidden="true" />Novo ingresso</Button>
  const cabecalho = evento ? (
    <>
      <CabecalhoEvento titulo={evento.title} situacao={situacaoEvento(evento)} detalhes={[evento.date && dataBR(evento.date)]} editarHref={`/producer/events/${evento.id}/edit`} extras={novoBtn} />
      <AbasDeArea abas={abasIngressosCupons(eventId)} rotulo="Ingressos e cupons" />
    </>
  ) : (
    <>
      <PageHeader title="Ingressos" description="Os ingressos de cada evento seu e os cupons de desconto" />
      <AbasDeArea abas={abasIngressosCupons(eventId)} rotulo="Ingressos e cupons" />
    </>
  )

  let corpo
  if (eventoInvalido) {
    corpo = <EmptyState title="Evento não encontrado entre os seus" description="O link aponta para um evento que não é seu ou não existe mais." action={<Button variant="outline" className="min-h-11" onClick={() => trocarEvento(null)}>Ver todos os eventos</Button>} />
  } else if (eventos.isPending || (!!evento && (vd.isPending || receita.isPending))) {
    corpo = (
      <div aria-busy="true" aria-label="Carregando ingressos">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-[88px] rounded-[10px] bg-muted" />)}</div>
        <Skeleton className="mt-6 h-64 rounded-[10px] bg-muted" />
      </div>
    )
  } else if (eventos.isError || vd.isError || receita.isError) {
    corpo = <Erro texto="Não foi possível carregar os ingressos." refetch={() => { void eventos.refetch(); void vd.refetch(); void receita.refetch() }} carregando={eventos.isFetching || vd.isFetching || receita.isFetching} />
  } else if (!evento) {
    corpo = <EmptyState title="Escolha um evento" description={lista.length ? 'Os ingressos são de cada evento. Escolha um no seletor acima.' : 'Você ainda não tem eventos. Crie o primeiro para criar ingressos.'} />
  } else {
    corpo = (
      <>
        {semFator && <p role="status" className="mb-4 flex items-start gap-2 rounded-[10px] border border-border bg-card p-3 text-sm text-foreground"><I.Alerta size={16} className="mt-0.5 shrink-0 text-[var(--ev-warning)]" aria-hidden="true" />Confirme o 2FA: saia e entre de novo informando o código. Sem isso, vendidos e receita podem aparecer zerados.</p>}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <KpiCard rotulo="Vendidos" valor={semFator ? '—' : n(k.vendidos)} comparacao="ingressos não cancelados nem reembolsados" />
          <KpiCard rotulo="Disponíveis" valor={semFator ? '—' : n(k.disponiveis)} comparacao="só dos ingressos visíveis" />
          <KpiCard className="col-span-2 lg:col-span-1" rotulo="Receita bruta" valor={semFator ? '—' : brl(receita.data ?? 0)} comparacao="só pedidos pagos, sem os reembolsados" ajuda="Mesma conta do Resumo financeiro: soma dos pedidos pagos do evento, com a taxa Evokaa que o comprador pagou." />
        </div>

        {tipos.length === 0 ? (
          <div className="mt-6"><EmptyState title="Este evento ainda não tem ingressos" description="Crie o primeiro: pago, gratuito ou para grupo." action={novoBtn} /></div>
        ) : (
          <section aria-label="Ingressos do evento" className="mt-6 rounded-[10px] border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <p className="text-sm text-muted-foreground">Arraste pela alça ou use os botões subir e descer para mudar a ordem em que aparecem.</p>
            </div>
            <div aria-hidden="true" className="hidden grid-cols-[2.75rem_minmax(0,2fr)_1fr_1fr_1.4fr_5rem_auto] items-center gap-3 border-b border-border px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
              <span /><span>Ingresso</span><span>Preço</span><span>Vendidos</span><span>Janela de venda</span><span>Visível</span><span>Ações</span>
            </div>
            <ul className="divide-y divide-border">
              {tipos.map((t, i) => {
                const vend = vendidos[t.id]
                return (
                  <li key={t.id} draggable onDragStart={() => setArrastando(t.id)} onDragEnd={() => setArrastando(null)} onDragOver={e => { if (arrastando && !reordenar.isPending) e.preventDefault() }}
                    onDrop={e => { e.preventDefault(); const de = tipos.findIndex(x => x.id === arrastando); setArrastando(null); if (de >= 0) mexer(de, i) }}
                    className={`grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-3 gap-y-2 px-4 py-3 md:grid-cols-[2.75rem_minmax(0,2fr)_1fr_1fr_1.4fr_5rem_auto] md:items-center ${arrastando === t.id ? 'opacity-50' : ''}`}>
                    <div className="flex flex-col items-center">
                      <Button variant="ghost" size="icon-sm" className="size-11 md:size-6" disabled={i === 0 || reordenar.isPending} aria-label={`Subir ${t.name}`} onClick={() => mexer(i, i - 1)}><I.Sobe aria-hidden="true" /></Button>
                      <I.Arrastar size={16} className="hidden cursor-grab text-muted-foreground md:block" aria-hidden="true" />
                      <Button variant="ghost" size="icon-sm" className="size-11 md:size-6" disabled={i === tipos.length - 1 || reordenar.isPending} aria-label={`Descer ${t.name}`} onClick={() => mexer(i, i + 1)}><I.Desce aria-hidden="true" /></Button>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{t.name}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        {ROTULO_TIPO[t.type] ?? t.type}
                        {t.permite_meia && <Badge variant="outline" className={chipNeutro}>Meia</Badge>}
                        {!t.is_active && <Badge variant="outline" className={chipNeutro}>Oculto</Badge>}
                      </p>
                    </div>
                    <p className="col-start-2 text-sm tabular-nums text-foreground md:col-start-auto"><span className="text-xs text-muted-foreground md:hidden">Preço: </span>{brlOuGratis(t.price)}</p>
                    <p className="col-start-2 text-sm tabular-nums text-foreground md:col-start-auto"><span className="text-xs text-muted-foreground md:hidden">Vendidos: </span>{semFator ? '—' : n(vend)} / {n(totalDe(t))}</p>
                    <p className="col-start-2 text-xs text-muted-foreground md:col-start-auto"><span className="md:hidden">Venda: </span>{janelaDeVenda(t.sale_start, t.sale_end)}</p>
                    <label className="col-start-2 flex min-h-11 items-center gap-2 text-sm text-foreground md:col-start-auto">
                      <Switch checked={t.is_active} onCheckedChange={v => setConfirmar({ t, ativo: v })} disabled={alternar.isPending} aria-label={`Visível: ${t.name}`} />
                      <span>{t.is_active ? 'Sim' : 'Não'}</span>
                    </label>
                    <div className="col-start-2 flex flex-wrap gap-2 md:col-start-auto">
                      <Button variant="outline" size="sm" className="min-h-11" aria-label={`Editar ${t.name}`} onClick={() => setModal({ ing: ingDoBanco(t, vend) })}><I.Editar aria-hidden="true" />Editar</Button>
                      <Button variant="outline" size="sm" className="min-h-11" aria-label={`Prévia de ${t.name}`} onClick={() => setPrevia(t.id)}><I.Olho aria-hidden="true" />Prévia</Button>
                    </div>
                  </li>
                )
              })}
            </ul>
            <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">Ingresso não é apagado aqui: use o interruptor Visível para tirá-lo da venda. Quem já comprou continua com o ingresso, e a quantidade não pode ficar abaixo do que já foi vendido.</p>
          </section>
        )}
        <p className="sr-only" role="status" aria-live="polite">{aviso}</p>

        <div className="mt-8">
          <SectionTitle>Em breve</SectionTitle>
          <div className="mt-3 grid max-w-3xl gap-3 md:grid-cols-2">
            <EmBreve titulo="Absorver a taxa" descricao="Você paga a taxa Evokaa e o comprador vê só o preço do ingresso. Antes de ligar, a tela mostra quanto sobra para você. Precisa de uma coluna nova no banco, ainda não criada." acao="Absorver taxa" />
            <EmBreve titulo="Lote de preço" descricao="O preço sobe sozinho por data ou quando uma quantidade é vendida (1º lote, 2º lote). Depende do módulo de lotes (M5)." acao="Criar lote" />
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
      {evento && modal && (
        <IngressoModal key={modal.ing?.id ?? 'novo'} eventId={evento.id} editando={modal.ing} fimEvento={evento.end_date ? Date.parse(evento.end_date) : undefined} classificacao={evento.classificacao} onFechar={() => setModal(null)} />
      )}
      {evento && <IngressoPrevia evento={evento} ingresso={tipos.find(t => t.id === previa) ?? null} onFechar={() => setPrevia(null)} />}
      <AlertDialog open={!!confirmar} onOpenChange={o => { if (!o) setConfirmar(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmar?.ativo ? 'Voltar a vender este ingresso?' : 'Ocultar este ingresso?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmar?.ativo ? `"${confirmar.t.name}" volta a aparecer para venda.` : `"${confirmar?.t.name}" deixa de aparecer para venda. Quem já comprou continua com o ingresso.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Voltar</AlertDialogCancel>
            <AlertDialogAction className="min-h-11" onClick={trocarVisivel}>{confirmar?.ativo ? 'Mostrar' : 'Ocultar'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
