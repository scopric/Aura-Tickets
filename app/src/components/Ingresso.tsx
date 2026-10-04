import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import { toast } from 'sonner'
import { Agenda, Atualizar, Baixar, ChevronDireita, ChevronEsquerda, Compartilhar, Fechar, Info, Local, Mesa, Qr } from './icones/evokaa16'
import EventoCapa from './EventoCapa'
import TicketQRCode from './TicketQRCode'
import { Button } from './ui/button'
import { useTheme } from '../contexts/ThemeContext'
import { siteUrl } from '../lib/appHost'
import { temFoto, varsDoEvento } from '../lib/corEvento'
import { baixarIcs, corDoEvento, dataCurta, diasAte, enderecoDoEvento, gerarIcs, horaCurta, linkMapa, motivoSemQr, quandoFalta, salvarQrPng } from '../lib/ingresso'
import { useFalta } from '../hooks/useFalta'
import { useTelaAcesa } from '../hooks/useTelaAcesa'
import type { DbTicket } from '../hooks/useCheckout'
import './Ingresso.css'
import './EventoCapa.css'

type Evento = NonNullable<DbTicket['events']>

// branco fixo (text-[#fff]): o .light .text-white do index.css escureceria o texto sobre a cor do evento
const rotulo = 'text-[11px] font-semibold uppercase leading-[14px] tracking-[0.06em] text-[rgb(255_255_255/0.9)]'
// 17 px abaixo de 380 px: "Qua, 30 set · 22h30 · Em 120 dias" cabe em 320 px
const valor = 'font-display text-[17px] font-semibold leading-6 tabular-nums min-[380px]:text-[20px]'

// Diálogos abertos por estado (sem Dialog.Trigger): o Radix não sabe para onde devolver o foco; guardamos quem abriu.
// setTimeout: no toque fora, o mousedown do navegador põe o foco no body depois do fechamento.
function useFocoDeVolta() {
  const origem = useRef(document.activeElement as HTMLElement | null)
  return (e: Event) => { e.preventDefault(); const o = origem.current; setTimeout(() => o?.focus()) }
}

// ---- QR ampliado: tela branca inteira, tela acesa (Wake Lock). O QR é o mesmo de sempre (TicketQRCode). ----------
function QrAmpliado({ t, evento, aoFechar }: { t: DbTicket; evento: Evento; aoFechar: () => void }) {
  const { temaResolvido } = useTheme()
  const acesa = useTelaAcesa(true)
  const devolverFoco = useFocoDeVolta()
  const quando = [dataCurta(evento.date), horaCurta(evento.time)].filter(Boolean).join(' · ')
  const area = useRef<HTMLDivElement>(null)
  const salvar = () => {
    const svg = area.current?.querySelector('svg')
    if (!svg || !t.code) return
    salvarQrPng(svg, t.code).then(undefined, () => toast.error('Não consegui salvar a imagem. Tire uma captura de tela do QR.'))
  }
  return (
    <Dialog.Root open onOpenChange={aberto => { if (!aberto) aoFechar() }}>
      <Dialog.Portal>
        {/* fundo branco puro nos dois temas: é o que dá o maior contraste para o leitor da portaria */}
        <Dialog.Content onCloseAutoFocus={devolverFoco} className="fixed inset-0 z-[110] flex flex-col items-center overflow-y-auto bg-white px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-14 text-center text-[#0b0d12] outline-none">
          <p className="text-sm font-medium text-[#5b6472]">{quando}</p>
          <Dialog.Title className="mt-1 font-display text-[22px] font-extrabold leading-6 wide">{evento.title}</Dialog.Title>
          <div ref={area} className="mt-7 w-full max-w-[320px]"><TicketQRCode code={t.code} size={320} className="h-auto w-full" /></div>
          <p className="mt-3 font-mono text-[17px] leading-6 tracking-[0.08em]">{t.code}</p>
          <p className="mt-4 text-base font-semibold">{[t.buyer_name, t.ticket_types?.name].filter(Boolean).join(' · ')}</p>
          <Dialog.Description className="mt-1 text-[15px] text-[#5b6472]">Mostre na entrada</Dialog.Description>
          {/* a web não controla o brilho: o aviso só aparece no modo escuro, onde ele faz diferença */}
          {acesa && <p className="mt-3 text-[13px] text-[#5b6472]">A tela fica acesa enquanto o código estiver aberto.</p>}
          {temaResolvido === 'dark' && <p className="mt-1 text-[13px] text-[#5b6472]">Aumente o brilho para a leitura na porta.</p>}
          <div className="mt-auto flex w-full flex-col gap-3 pt-6">
          <Button size="lg" variant="outline" onClick={salvar} className="border-[rgb(11_13_18/0.20)] bg-white text-[#0b0d12] hover:bg-[#eceef1] hover:text-[#0b0d12]">
            <Baixar aria-hidden="true" /> Salvar QR como imagem
          </Button>
          <Dialog.Close asChild>
            <Button size="lg" className="bg-[#f4f5f7] text-[#0b0d12] shadow-[0_0_0_1px_rgb(11_13_18/0.10)] hover:bg-[#eceef1]">
              <Fechar aria-hidden="true" /> Fechar
            </Button>
          </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ---- Detalhes (titular, pedido, regras): folha por cima da tela do ingresso ----------------------------------------
function Detalhes({ t, evento, aoFechar }: { t: DbTicket; evento: Evento; aoFechar: () => void }) {
  const dados: [string, string | null][] = [
    ['Comprador', t.buyer_name ?? null],
    ['Ingresso', t.ticket_types?.name ?? 'Ingresso'],
    ['Lugar', t.seat_info],
    ['Pedido', t.order_id ? `#${t.order_id.slice(0, 8).toUpperCase()}` : null],
    ['Comprado em', t.created_at ? new Date(t.created_at).toLocaleDateString('pt-BR') : null],
    ['Local', enderecoDoEvento(evento) || null],
  ]
  const devolverFoco = useFocoDeVolta()
  return (
    <Dialog.Root open onOpenChange={aberto => { if (!aberto) aoFechar() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-[rgb(11_13_18/0.45)] motion-safe:animate-in motion-safe:fade-in-0" />
        <Dialog.Content onCloseAutoFocus={devolverFoco} className="fixed inset-x-0 bottom-0 z-[61] mx-auto max-h-[85dvh] max-w-lg overflow-y-auto rounded-t-[20px] bg-card px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-5 text-card-foreground shadow-ev-2 outline-none">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-xl font-semibold leading-7">Detalhes do ingresso</Dialog.Title>
            <Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="Fechar"><Fechar aria-hidden="true" /></Button></Dialog.Close>
          </div>
          <Dialog.Description className="text-sm text-muted-foreground">{evento.title}</Dialog.Description>
          <dl className="mt-4 divide-y divide-border">
            {dados.filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="py-2.5"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="break-words text-[15px] font-medium">{v}</dd></div>
            ))}
          </dl>
          <h3 className="mt-5 text-[15px] font-semibold">Regras</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-5 text-muted-foreground">
            <li>Mostre o QR Code na entrada. Cada código vale uma entrada.</li>
            <li>Não compartilhe o código: quem for lido primeiro entra.</li>
            <li>Para cancelar ou tirar dúvidas, fale com o <Link to="/contato" className="underline underline-offset-2">suporte</Link>.</li>
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ---- O cartão (prancha): frente = arte + dados + "Mostrar QR"; verso = QR em placa branca. Opaco, na cor do evento. ----
function Cartao({ t, evento, verso, motivo, aoVirar, aoAmpliar }: { t: DbTicket; evento: Evento; verso: boolean; motivo: string | null; aoVirar: () => void; aoAmpliar: () => void }) {
  // depois de virar, o foco vai para o botão da face que ficou visível (a outra está inert)
  const botaoFrente = useRef<HTMLButtonElement>(null)
  const botaoVerso = useRef<HTMLButtonElement>(null)
  const faceAnterior = useRef(verso)
  useEffect(() => {
    if (faceAnterior.current === verso) return
    faceAnterior.current = verso
    const id = requestAnimationFrame(() => (verso ? botaoVerso : botaoFrente).current?.focus())
    return () => cancelAnimationFrame(id)
  }, [verso])
  const tipo = t.ticket_types?.name ?? 'Ingresso'
  const { falta, comecou } = useFalta(evento.date, evento.time)
  const dias = diasAte(evento.date)
  const comFoto = [evento.cover_image, evento.image_url].some(temFoto)
  const hora = horaCurta(evento.time)
  // terceira coluna: contagem no dia; antes disso, quanto falta em dias
  const rotuloFalta = falta ? 'Começa em' : dias !== null && dias >= 0 ? 'Quando' : null
  const valorFalta = falta ? falta.texto : dias !== null && dias >= 0 ? quandoFalta(dias) : null
  const campos = (
    <div className="mt-3 grid grid-cols-[auto_auto_1fr] gap-x-4">
      <div className="whitespace-nowrap"><div className={rotulo}>Data</div><div className={valor}>{dataCurta(evento.date) ?? '-'}</div></div>
      <div className="whitespace-nowrap"><div className={rotulo}>{comecou ? 'Começou' : 'Começa'}</div><div className={valor}>{hora ?? '-'}</div></div>
      {rotuloFalta && (
        <div className="min-w-0 text-right">
          <div className={rotulo}>{rotuloFalta}</div>
          <div className={valor} aria-hidden={falta ? true : undefined}>{valorFalta}</div>
          {falta && <span className="sr-only">{falta.leitura}</span>}
        </div>
      )}
    </div>
  )
  const cabeca = (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[15px] font-bold">Evokaa</span>
      <span className="font-display text-base font-semibold">{tipo}</span>
    </div>
  )
  return (
    <article
      className="ingresso evento-cor mx-auto w-full max-w-[360px] text-[#fff]"
      style={varsDoEvento(corDoEvento(evento)) as CSSProperties}
      aria-label={`Ingresso ${tipo} de ${evento.title}`}
    >
      <div className={`ingresso-virador${verso ? ' virado' : ''}`} data-face={verso ? 'verso' : 'frente'}>
        {/* frente: a arte ocupa; os dados numa faixa sólida (branco sobre --evento-fundo-e passa AA) */}
        <div className="ingresso-face ingresso-frente" inert={verso} aria-hidden={verso || undefined}>
          <div className="relative min-h-[220px] flex-1">
            <EventoCapa evento={evento} tamanho="cartao" className="!absolute !inset-0 !aspect-auto !h-full !rounded-none" />
          </div>
          <div className="px-5 pb-5 pt-4">
            {cabeca}
            {comFoto && <h2 className="mt-2.5 break-words font-display text-[26px] font-extrabold uppercase leading-[1.08] tracking-[-0.01em] wide">{evento.title}</h2>}
            {campos}
            {motivo ? (
              <p role="status" className="mt-4 rounded-xl bg-[rgb(255_255_255/0.14)] px-4 py-3 text-center text-[15px] font-semibold">{motivo}: o QR não vale para a entrada.</p>
            ) : (
              <Button ref={botaoFrente} size="lg" onClick={aoVirar} className="mt-4 w-full bg-white text-[#0b0d12] shadow-[0_1px_2px_rgb(0_0_0/0.25)] hover:bg-[#eceef1] active:bg-[#eceef1] focus-visible:shadow-[0_0_0_2px_var(--evento-fundo-e),0_0_0_4px_#fff]">
                <Qr aria-hidden="true" className="size-5" /> Mostrar QR
              </Button>
            )}
          </div>
        </div>

        {/* verso: nome, dados, QR grande em placa branca e o titular */}
        <div className="ingresso-face ingresso-verso" inert={!verso} aria-hidden={!verso || undefined}>
          <div className="px-5 pb-[18px] pt-6">
            {cabeca}
            <h2 className="mt-3 break-words font-display text-2xl font-extrabold uppercase leading-[1.08] tracking-[-0.01em] wide">{evento.title}</h2>
            {campos}
            {evento.venue_name && <div className="mt-3"><div className={rotulo}>Local</div><div className="truncate text-[15px] font-semibold leading-5">{evento.venue_name}</div></div>}
            {!motivo && (
              <button
                type="button"
                onClick={aoAmpliar}
                aria-label={`Ampliar o QR Code do ingresso ${t.code}`}
                className="mt-4 block w-full rounded-xl border-0 bg-white p-3 text-center text-[#0b0d12] transition-transform duration-micro active:scale-[0.98] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--evento-fundo-e),0_0_0_4px_#fff]"
              >
                <TicketQRCode code={t.code} size={240} className="mx-auto block h-auto w-full max-w-[240px]" />
                <span className="mt-1.5 block font-mono text-[15px] leading-5 tracking-[0.08em]">{t.code}</span>
                <span className="block text-xs font-medium leading-4 text-[#5b6472]">Toque para ampliar</span>
              </button>
            )}
            <div className="mt-3.5 flex items-end gap-3">
              <div className="min-w-0 flex-1"><div className={rotulo}>Comprador</div><div className="truncate text-[15px] font-semibold leading-5">{t.buyer_name ?? '-'}</div></div>
              <Button ref={botaoVerso} variant="ghost" size="icon-lg" onClick={aoVirar} aria-label="Voltar para a arte do ingresso" className="rounded-full bg-[rgb(255_255_255/0.14)] text-[#fff] hover:bg-[rgb(255_255_255/0.22)] hover:text-[#fff] active:bg-[rgb(255_255_255/0.22)] active:text-[#fff] focus-visible:shadow-[0_0_0_2px_#fff]">
                <Atualizar aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

// ---- A tela do evento: "1 de N", virar, agenda, como chegar -------------------------------------------------
const acao = 'h-14 min-w-0 flex-1 flex-col gap-1 px-1 text-[13px]'

export default function IngressosDoEvento({ ingressos, evento, abrirNoQr = false, onSuaMesa }: {
  ingressos: DbTicket[]
  evento: Evento
  abrirNoQr?: boolean // vem do botão quadrado do QR da carteira: o ingresso abre virado
  onSuaMesa?: () => void
}) {
  const [i, setI] = useState(0)
  const [verso, setVerso] = useState(abrirNoQr)
  const [ampliado, setAmpliado] = useState(false)
  const [detalhes, setDetalhes] = useState(false)
  const t = ingressos[Math.min(i, ingressos.length - 1)]
  const n = ingressos.length
  const endereco = enderecoDoEvento(evento)
  const motivo = motivoSemQr(t)

  const ir = (d: number) => { setI(a => Math.max(0, Math.min(n - 1, a + d))); setVerso(false) }

  const agenda = () => {
    const ics = gerarIcs({ id: evento.id, titulo: evento.title, data: evento.date, hora: evento.time, fim: evento.end_date, local: endereco })
    if (!ics) { toast.error('Este evento ainda não tem data.'); return }
    baixarIcs(ics, evento.title)
  }
  const compartilhar = () => {
    navigator.clipboard.writeText(siteUrl(`/event/${evento.id}`))
      .then(() => toast.success('Link do evento copiado!'), () => toast.error('Não consegui copiar o link.'))
  }

  return (
    <div>
      {n > 1 && (
        <div className="mx-auto mb-3 flex max-w-[360px] items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => ir(-1)} disabled={i === 0} aria-label="Ingresso anterior"><ChevronEsquerda aria-hidden="true" /></Button>
          <span className="font-display text-[13px] font-semibold tabular-nums text-muted-foreground" aria-live="polite">{i + 1} de {n}</span>
          <Button variant="ghost" size="icon" onClick={() => ir(1)} disabled={i === n - 1} aria-label="Próximo ingresso"><ChevronDireita aria-hidden="true" /></Button>
        </div>
      )}

      <div
        key={t.id}
        className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150"
      >
        <Cartao t={t} evento={evento} verso={verso && !motivo} motivo={motivo} aoVirar={() => setVerso(v => !v)} aoAmpliar={() => setAmpliado(true)} />
      </div>

      <div className="mx-auto mt-3 flex max-w-[360px] justify-center gap-1">
        <Button variant="ghost" className={acao} onClick={() => setDetalhes(true)}><Info className="size-5" aria-hidden="true" /> Detalhes</Button>
        <Button variant="ghost" className={acao} onClick={agenda}><Agenda className="size-5" aria-hidden="true" /> Agenda</Button>
        <Button asChild variant="ghost" className={acao}>
          <a href={linkMapa(endereco || evento.title)} target="_blank" rel="noopener noreferrer"><Local className="size-5" aria-hidden="true" /> Como chegar</a>
        </Button>
      </div>
      <div className="mx-auto mt-1 flex max-w-[360px] items-center justify-center gap-1">
        {onSuaMesa && t.ticket_types?.type === 'coletiva' && (
          <Button variant="ghost" size="sm" onClick={onSuaMesa}><Mesa aria-hidden="true" /> Sua mesa</Button>
        )}
        <Button variant="ghost" size="sm" onClick={compartilhar}><Compartilhar aria-hidden="true" /> Copiar link do evento</Button>
      </div>

      {detalhes && <Detalhes t={t} evento={evento} aoFechar={() => setDetalhes(false)} />}
      {ampliado && <QrAmpliado t={t} evento={evento} aoFechar={() => setAmpliado(false)} />}
    </div>
  )
}
