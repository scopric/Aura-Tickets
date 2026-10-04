import { useState, type CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { Ingressos, Qr, SetaEsquerda } from '../../components/icones/evokaa16'
import EventoCapa from '../../components/EventoCapa'
import IngressosDoEvento from '../../components/Ingresso'
import ThemeToggle from '../../components/ThemeToggle'
import YourTable from '../../components/YourTable'
import { Button } from '../../components/ui/button'
import { Spinner } from '../../components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { useUserTickets } from '../../hooks/useUserTickets'
import { temFoto, varsDoEvento } from '../../lib/corEvento'
import { useFalta } from '../../hooks/useFalta'
import { agruparPorEvento, corDoEvento, dataCurta, diasAte, ehProximo, enderecoDoEvento, horaCurta, linkMapa, motivoSemQr, quandoFalta, type GrupoIngressos } from '../../lib/ingresso'
import '../../components/Ingresso.css'

const quando = (g: GrupoIngressos) => [dataCurta(g.evento?.date), horaCurta(g.evento?.time)].filter(Boolean).join(' · ')
const contar = (n: number) => `${n} ingresso${n > 1 ? 's' : ''}`
const foco = 'has-[:focus-visible]:shadow-ev-foco'
const cancelado = (g: GrupoIngressos) => g.evento?.status === 'cancelled'

// O botão quadrado do QR leva direto ao QR (o ingresso abre virado); o resto do cartão leva à frente do ingresso
function QrChip({ g, className, icone }: { g: GrupoIngressos; className: string; icone: number }) {
  return (
    <Link to={`?evento=${g.id}&qr=1`} aria-label={`Mostrar o QR de ${g.evento?.title ?? 'Evento'}`} className={`z-10 grid place-items-center outline-none ${className}`}>
      <Qr size={icone} aria-hidden="true" />
    </Link>
  )
}

// O próximo evento é o próprio passe (arte, nome, data e o QR), com recorte no topo como o Wallet
function Passe({ g }: { g: GrupoIngressos }) {
  const e = g.evento
  const dias = diasAte(e?.date)
  // um tipo só: mostra o nome; tipos diferentes no mesmo evento: só a quantidade
  const tipos = new Set(g.ingressos.map(t => t.ticket_types?.name))
  const tipo = tipos.size === 1 ? g.ingressos[0].ticket_types?.name : undefined
  const comFoto = [e?.cover_image, e?.image_url].some(temFoto)
  const hora = horaCurta(e?.time)
  const { falta } = useFalta(e?.date, e?.time)
  return (
    <div className={`rounded-2xl ${foco}`}>
      <div
        className="evento-cor passe-recorte relative overflow-hidden rounded-2xl text-left text-[#fff] transition-transform duration-micro has-[a.passe-abrir:active]:scale-[0.985] motion-reduce:has-[a.passe-abrir:active]:scale-100"
        style={e ? varsDoEvento(corDoEvento(e)) as CSSProperties : undefined}
      >
        {e && <EventoCapa evento={e} tamanho="cartao" className="!aspect-[3/2] !rounded-none" />}
        <div className="flex items-end gap-3 px-4 pb-4 pt-3.5" style={{ background: 'var(--evento-fundo-e)' }}>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {dias !== null && dias >= 0 && (
                <span
                  className="inline-flex h-[22px] items-center rounded-full px-[9px] text-xs font-semibold"
                  style={dias === 0 ? { background: 'var(--ev-warm)', color: '#0b0d12' } : { background: 'rgb(255 255 255 / 0.16)' }}
                >
                  {quandoFalta(dias)}
                </span>
              )}
              <span className="text-[13px] font-medium text-[rgb(255_255_255/0.9)]">{[tipo, contar(g.ingressos.length)].filter(Boolean).join(' · ')}</span>
            </div>
            {cancelado(g) && <p role="status" className="mt-2 text-sm font-semibold">Evento cancelado: o QR não vale. Fale com o suporte.</p>}
            {/* o cartaz já traz o nome e a data; com foto, eles vão no texto */}
            {comFoto && <p className="mt-2 break-words font-display text-[24px] font-extrabold leading-[1.1] tracking-[-0.015em] wide">{e?.title ?? 'Evento'}</p>}
            <p className={`${comFoto ? 'mt-1 text-sm font-medium text-[rgb(255_255_255/0.9)]' : 'mt-2 font-display text-[26px] font-extrabold leading-[1.1] tracking-[-0.015em] wide'}`}>
              {hora ? `${comFoto ? `${dataCurta(e?.date)} · ` : ''}Começa às ${hora}` : quando(g)}
            </p>
            {falta && (
              <p className="mt-1.5 flex items-center gap-2 text-sm font-medium text-[rgb(255_255_255/0.9)]">
                <span aria-hidden="true" className="ingresso-pulso size-1.5 rounded-full bg-[var(--ev-warm)]" />
                <span aria-hidden="true">Começa em <span className="font-display text-[15px] font-semibold tabular-nums text-[#fff]">{falta.texto}</span></span>
                <span className="sr-only">{falta.leitura}</span>
              </p>
            )}
          </div>
          <span aria-hidden="true" className="size-12 shrink-0" />
        </div>
        <Link to={`?evento=${g.id}`} aria-label={`Abrir ${contar(g.ingressos.length)} de ${e?.title ?? 'Evento'}, ${quando(g)}`} className="passe-abrir absolute inset-0 outline-none" />
        {!cancelado(g) && <QrChip g={g} className="absolute bottom-4 right-4 size-12 rounded-xl bg-white text-[#0b0d12] focus-visible:shadow-[0_0_0_2px_var(--evento-fundo-e),0_0_0_4px_#fff]" icone={24} />}
      </div>
    </div>
  )
}

// Os demais: linha-ingresso com recortes laterais, miniatura e o botão do QR
function Linha({ g }: { g: GrupoIngressos }) {
  const e = g.evento
  const dias = diasAte(e?.date)
  return (
    <div className={`rounded-xl ${foco}`}>
      <div className="linha-recorte relative flex h-20 items-center gap-3 rounded-xl bg-secondary px-3 text-left has-[a.linha-abrir:hover]:bg-[var(--ev-sec-press)]">
        {e && <EventoCapa evento={e} tamanho="mini" className="!size-14" />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs leading-4 text-muted-foreground">{[cancelado(g) ? 'Evento cancelado' : null, quando(g), dias !== null && dias >= 0 ? quandoFalta(dias).toLowerCase() : null].filter(Boolean).join(' · ')}</span>
          <span className="block truncate font-display text-lg font-extrabold leading-[22px] tracking-[-0.01em] wide">{e?.title ?? 'Evento'}</span>
          <span className="block truncate text-[13px] leading-[18px] text-muted-foreground">{[[e?.venue_name, e?.venue_city].filter(Boolean).join(', '), contar(g.ingressos.length)].filter(Boolean).join(' · ')}</span>
        </span>
        <span aria-hidden="true" className="size-11 shrink-0" />
        <Link to={`?evento=${g.id}`} aria-label={`Abrir ${contar(g.ingressos.length)} de ${e?.title ?? 'Evento'}, ${quando(g)}`} className="linha-abrir absolute inset-0 rounded-xl outline-none" />
        {!cancelado(g) && <QrChip g={g} className="absolute right-3 top-1/2 size-11 -translate-y-1/2 rounded-full bg-card text-foreground shadow-ev-secondary focus-visible:shadow-ev-foco" icone={16} />}
      </div>
    </div>
  )
}

// Ingresso que já passou, foi usado, cancelado ou transferido: só consulta, não abre o QR
const SITUACAO: Record<string, [string, string]> = {
  used: ['usado', 'usados'], cancelled: ['cancelado', 'cancelados'], transferred: ['transferido', 'transferidos'],
  refunded: ['reembolsado', 'reembolsados'], active: ['encerrado', 'encerrados'],
}
function LinhaAnterior({ g }: { g: GrupoIngressos }) {
  const e = g.evento
  const [um] = g.ingressos
  // um ingresso: a situação dele; vários: a contagem por situação ("1 usado · 1 cancelado")
  const palavra = (st: string, n: number) => (SITUACAO[st] ?? [st, st])[n > 1 ? 1 : 0]
  const tally = g.ingressos.reduce<Record<string, number>>((m, t) => ({ ...m, [t.status]: (m[t.status] ?? 0) + 1 }), {})
  const situacao = g.ingressos.length > 1
    ? Object.entries(tally).map(([st, n]) => `${n} ${palavra(st, n)}`).join(' · ')
    : um.status === 'used' ? `Usado${um.checked_in_at ? ` em ${new Date(um.checked_in_at).toLocaleDateString('pt-BR')}` : ''}`
    : um.status === 'active' ? motivoSemQr(um) ?? 'Evento encerrado'
    : palavra(um.status, 1).replace(/^./, c => c.toUpperCase())
  return (
    <li className="flex h-20 items-center gap-3 rounded-xl bg-secondary px-3">
      {e && <EventoCapa evento={e} tamanho="mini" className="!size-14" />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs leading-4 text-muted-foreground">{quando(g)}</p>
        <p className="truncate font-display text-lg font-extrabold leading-[22px] tracking-[-0.01em] wide">{e?.title ?? 'Evento'}</p>
        <p className="truncate text-[13px] leading-[18px] text-muted-foreground">{situacao}</p>
      </div>
    </li>
  )
}

export default function ParticipantTickets() {
  const [params] = useSearchParams()
  const [mesaDe, setMesaDe] = useState<string | null>(null) // evento da "Sua mesa" aberta
  const { data: tickets = [], isLoading } = useUserTickets()

  const [agora] = useState(() => Date.now()) // a lista vale para esta abertura da tela
  const proximos = agruparPorEvento(tickets.filter(t => ehProximo(t, agora)))
  const anteriores = agruparPorEvento(tickets.filter(t => !ehProximo(t, agora)), true)
  const eventoId = params.get('evento')
  // o link direto abre qualquer ingresso ativo, mesmo o de um evento que a lista já considera anterior (evento de vários dias sem end_date);
  // o QR some só se o evento está cancelado ou tem end_date vencida (motivoSemQr)
  const aberto = eventoId ? agruparPorEvento(tickets.filter(t => t.status === 'active')).find(g => g.id === eventoId) : undefined

  return (
    <div className="mx-auto w-full max-w-lg">
      {eventoId ? (
        <>
          <div className="mb-4 flex items-center gap-2">
            <Button asChild variant="ghost" size="icon" className="-ml-2.5">
              <Link to="/app/tickets" aria-label="Voltar para Ingressos"><SetaEsquerda aria-hidden="true" /></Link>
            </Button>
            <h1 className="min-w-0 flex-1 truncate text-[15px] font-semibold">{aberto?.evento?.title ?? 'Ingressos'}</h1>
          </div>
          {isLoading ? (
            <div className="py-20 text-center"><Spinner className="mx-auto size-6" /></div>
          ) : aberto?.evento ? (
            <IngressosDoEvento ingressos={aberto.ingressos} evento={aberto.evento} abrirNoQr={params.get('qr') === '1'} onSuaMesa={() => setMesaDe(aberto.id)} />
          ) : (
            <div className="py-16 text-center">
              <p className="text-sm text-muted-foreground">Não encontramos ingressos ativos deste evento.</p>
              <Button asChild variant="outline" className="mt-4"><Link to="/app/tickets">Ver meus ingressos</Link></Button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-2">
            <h1 className="flex-1 text-2xl font-semibold tracking-[-0.015em]">Ingressos</h1>
            <ThemeToggle collapsed className="size-11" />
          </div>

          {isLoading ? (
            <div className="py-20 text-center"><Spinner className="mx-auto size-6" /></div>
          ) : (
            <Tabs defaultValue="proximos">
              <TabsList variant="pilula" className="h-10 w-full">
                <TabsTrigger value="proximos">Próximos <span className="font-display tabular-nums text-muted-foreground">{proximos.length}</span></TabsTrigger>
                <TabsTrigger value="anteriores">Anteriores <span className="font-display tabular-nums text-muted-foreground">{anteriores.length}</span></TabsTrigger>
              </TabsList>

              <TabsContent value="proximos" className="mt-3">
                {proximos.length === 0 ? (
                  <div className="py-16 text-center">
                    <Ingressos size={40} className="mx-auto mb-3 text-muted-foreground" aria-hidden="true" />
                    <p className="text-sm text-muted-foreground">Seus ingressos aparecem aqui depois da compra.</p>
                    <Button asChild className="mt-4"><Link to="/app/events">Explorar eventos</Link></Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Passe g={proximos[0]} />
                    {proximos[0].evento && (
                      <Button asChild variant="ghost" className="h-12 w-full justify-start gap-3 px-1 text-sm font-medium text-foreground">
                        <a href={linkMapa(enderecoDoEvento(proximos[0].evento) || proximos[0].evento.title)} target="_blank" rel="noopener noreferrer">
                          <span className="flex-1 truncate text-left">{[proximos[0].evento.venue_name, proximos[0].evento.venue_city].filter(Boolean).join(', ') || 'Local do evento'}</span>
                          <span className="font-semibold text-primary">Como chegar</span>
                        </a>
                      </Button>
                    )}
                    {proximos.length > 1 && (
                      <>
                        <h2 className="pt-3 text-[15px] font-semibold">Mais adiante</h2>
                        {proximos.slice(1).map(g => <Linha key={g.id} g={g} />)}
                      </>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="anteriores" className="mt-3">
                {anteriores.length === 0 ? (
                  <p className="py-16 text-center text-sm text-muted-foreground">Nenhum ingresso anterior.</p>
                ) : (
                  <>
                    <ul className="space-y-3">{anteriores.map(g => <LinhaAnterior key={g.id + g.ingressos[0].id} g={g} />)}</ul>
                    <p className="pt-5 text-[13px] leading-5 text-muted-foreground">Ingresso usado não abre o QR de novo.</p>
                  </>
                )}
              </TabsContent>
            </Tabs>
          )}
        </>
      )}

      {/* Sua mesa (Match de Mesa) */}
      {mesaDe && (
        // Esc fecha; o contains ignora o Esc dos modais internos (termo, denúncia, questionário), que vêm por portal
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
          role="dialog" aria-modal="true" aria-label="Sua mesa" tabIndex={-1}
          onKeyDown={e => { if (e.key === 'Escape' && e.currentTarget.contains(e.target as Node)) setMesaDe(null) }}
        >
          <div className="absolute inset-0 glass-backdrop" onClick={() => setMesaDe(null)} />
          <div className="relative w-full max-w-2xl my-8">
            <button autoFocus onClick={() => setMesaDe(null)} aria-label="Fechar sua mesa" className="absolute -top-3 -right-3 z-10 w-9 h-9 rounded-full bg-void border border-white/10 text-cream flex items-center justify-center"><X className="w-4 h-4" /></button>
            <YourTable eventId={mesaDe} />
          </div>
        </div>
      )}
    </div>
  )
}
