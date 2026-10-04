import { type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Qr } from './icones/evokaa16'
import EventoCapa from './EventoCapa'
import { temFoto, varsDoEvento } from '../lib/corEvento'
import { useFalta } from '../hooks/useFalta'
import { corDoEvento, dataCurta, diasAte, horaCurta, motivoEvento, motivoSemQr, quandoFalta, type GrupoIngressos } from '../lib/ingresso'
import './Ingresso.css'

// Os cartões da carteira (Ingressos) e do Início: o passe do próximo evento, a linha dos demais e a linha dos anteriores.
const quando = (g: GrupoIngressos) => [dataCurta(g.evento?.date), horaCurta(g.evento?.time)].filter(Boolean).join(' · ')
const contar = (n: number) => `${n} ingresso${n > 1 ? 's' : ''}`
const foco = 'has-[:focus-visible]:shadow-ev-foco'
const aviso = (g: GrupoIngressos) => motivoEvento(g.evento) // 'Evento cancelado' | 'Evento fora do ar' | null

// O botão quadrado do QR leva direto ao QR (o ingresso abre virado); o resto do cartão leva à frente do ingresso
function QrChip({ g, className, icone }: { g: GrupoIngressos; className: string; icone: number }) {
  return (
    <Link to={`/app/tickets?evento=${g.id}&qr=1`} aria-label={`Mostrar o QR de ${g.evento?.title ?? 'Evento'}`} className={`z-10 grid place-items-center outline-none ${className}`}>
      <Qr size={icone} aria-hidden="true" />
    </Link>
  )
}

// O próximo evento é o próprio passe (arte, nome, data e o QR), com recorte no topo como o Wallet
export function Passe({ g }: { g: GrupoIngressos }) {
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
            {aviso(g) && <p role="status" className="mt-2 text-sm font-semibold">{aviso(g)}: o QR não vale. Fale com o suporte.</p>}
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
        <Link to={`/app/tickets?evento=${g.id}`} aria-label={`Abrir ${contar(g.ingressos.length)} de ${e?.title ?? 'Evento'}, ${quando(g)}`} className="passe-abrir absolute inset-0 outline-none" />
        {!aviso(g) && <QrChip g={g} className="absolute bottom-4 right-4 size-12 rounded-xl bg-white text-[#0b0d12] focus-visible:shadow-[0_0_0_2px_var(--evento-fundo-e),0_0_0_4px_#fff]" icone={24} />}
      </div>
    </div>
  )
}

// Os demais: linha-ingresso com recortes laterais, miniatura e o botão do QR
export function Linha({ g }: { g: GrupoIngressos }) {
  const e = g.evento
  const dias = diasAte(e?.date)
  return (
    <div className={`rounded-xl ${foco}`}>
      <div className="linha-recorte relative flex h-20 items-center gap-3 rounded-xl bg-secondary px-3 text-left has-[a.linha-abrir:hover]:bg-[var(--ev-sec-press)]">
        {e && <EventoCapa evento={e} tamanho="mini" className="!size-14" />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs leading-4 text-muted-foreground">{[aviso(g), quando(g), dias !== null && dias >= 0 ? quandoFalta(dias).toLowerCase() : null].filter(Boolean).join(' · ')}</span>
          <span className="block truncate font-display text-lg font-extrabold leading-[22px] tracking-[-0.01em] wide">{e?.title ?? 'Evento'}</span>
          <span className="block truncate text-[13px] leading-[18px] text-muted-foreground">{[[e?.venue_name, e?.venue_city].filter(Boolean).join(', '), contar(g.ingressos.length)].filter(Boolean).join(' · ')}</span>
        </span>
        <span aria-hidden="true" className="size-11 shrink-0" />
        <Link to={`/app/tickets?evento=${g.id}`} aria-label={`Abrir ${contar(g.ingressos.length)} de ${e?.title ?? 'Evento'}, ${quando(g)}`} className="linha-abrir absolute inset-0 rounded-xl outline-none" />
        {!aviso(g) && <QrChip g={g} className="absolute right-3 top-1/2 size-11 -translate-y-1/2 rounded-full bg-card text-foreground shadow-ev-secondary focus-visible:shadow-ev-foco" icone={16} />}
      </div>
    </div>
  )
}

// Ingresso que já passou, foi usado, cancelado ou transferido: só consulta, não abre o QR
const SITUACAO: Record<string, [string, string]> = {
  used: ['usado', 'usados'], cancelled: ['cancelado', 'cancelados'], transferred: ['transferido', 'transferidos'],
  refunded: ['reembolsado', 'reembolsados'], active: ['encerrado', 'encerrados'],
}
export function LinhaAnterior({ g }: { g: GrupoIngressos }) {
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

