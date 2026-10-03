import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Drawer } from 'vaul'
import { Link, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import EventoCapa from '@/components/EventoCapa'
import * as I from '@/components/icones/evokaa16'
import { cn } from '@/lib/utils'
import { useAuth } from '../../hooks/useAuth'
import { useProducerEvents, type DbEvent } from '../../hooks/useEvents'
import { useFixados } from '../../hooks/useFixados'
import { situacaoEvento } from '../../lib/eventoProdutor'
import {
  ROTA_CRIAR_EVENTO, SECOES, abreEvento, eventoDaUrl, filtra, hrefDaTela, rotaAtiva, textoDaTela,
  type Escopo, type Secao, type Tela,
} from '../../lib/navegacaoProdutor'
import ThemeToggle from '../ThemeToggle'
import { ICONE, dataCurta, eventosDaLista } from './lateralComum'

// Folha "Menu" do celular (V4b; estudos/navegacao.md §5.5): a mesma lista da lateral, por escopo, com todas as áreas abertas
// (nada escondido em submenu), tema e Sair. Carregada só quando aberta (BarraCelular), por isso o vaul fica fora da entrada.
// Cabeçalho opaco: a folha de vidro da prancha não tem nada rolando por baixo, então o vidro não apareceria.

const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const item = cn('flex min-h-12 w-full items-center gap-3 rounded-ev-lg px-3 text-left text-[15px] font-medium transition-colors duration-rapido motion-reduce:transition-none hover:bg-[var(--ev-tint-hover)]', foco)
const ativoCls = 'bg-[var(--ev-tint-ativo)] font-semibold'

const normaliza = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

interface FolhaProps {
  aberta: boolean
  /** Abre com o foco no filtro de telas (círculo de busca da barra) */
  buscar: boolean
  onFechar: () => void
}

export default function FolhaMenu({ aberta, buscar, onFechar }: FolhaProps) {
  const { pathname, search } = useLocation()
  const { logout } = useAuth()
  const { data: eventos = [], isLoading } = useProducerEvents()
  const [fixados] = useFixados() // a mesma lista da lateral e da Visão geral
  const [busca, setBusca] = useState('')
  const filtroRef = useRef<HTMLInputElement>(null)
  const fecharRef = useRef<HTMLButtonElement>(null)
  const origem = useRef<HTMLElement | null>(null)
  // foco: entra na folha (busca ou Fechar) e volta a quem abriu ao fechar, de qualquer jeito (o vaul controlado não faz sozinho)
  useEffect(() => {
    if (!aberta) return
    origem.current = document.activeElement as HTMLElement | null
    const id = requestAnimationFrame(() => (buscar ? filtroRef.current : fecharRef.current)?.focus())
    // setTimeout: no toque fora, o mousedown do navegador põe o foco no body depois do fechamento
    return () => { cancelAnimationFrame(id); const o = origem.current; setTimeout(() => o?.focus()) }
  }, [aberta, buscar])

  const eventId = eventoDaUrl(pathname, search)
  const evento: DbEvent | undefined = eventos.find(e => e.id === eventId)
  const escopo: Escopo = eventId && (evento || isLoading) ? 'evento' : 'produtora'

  const q = normaliza(busca.trim())
  const bate = (texto: string) => !q || normaliza(texto).includes(q)
  const sair = () => {
    toast.info('Você saiu da sua conta')
    logout()
  }

  // No evento, "Conta" não tem telas por evento: mostra as da produtora (senão o celular não teria como chegar em Configurações)
  const telasDe = (s: Secao) => { const t = filtra(escopo, s); return t.length || s !== 'Conta' ? t : filtra('produtora', s) }

  const linkTela = (t: Tela) => {
    const ativo = rotaAtiva(t.rota, pathname)
    return (
      <Link
        key={t.tela}
        to={hrefDaTela(t.rota, escopo === 'evento' && t.noEvento ? eventId : null)}
        onClick={onFechar}
        aria-current={ativo ? 'page' : undefined}
        className={cn(item, ativo && ativoCls)}
      >
        <span className="truncate">{textoDaTela(t, escopo)}</span>
      </Link>
    )
  }

  const linkEvento = (e: DbEvent) => {
    const aviso = situacaoEvento(e) === 'Em análise'
    return (
      <Link key={e.id} to={abreEvento(e.id)} onClick={onFechar} aria-label={`${e.title}, ${dataCurta(e)}${aviso ? ', em análise' : ''}`} className={item}>
        <EventoCapa evento={e} tamanho="mini-p" className="shrink-0 !size-5 !rounded-ev-xs" />
        <span className="flex-1 truncate">{e.title}</span>
        {aviso && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-[var(--ev-warning)]" />}
        <span className="shrink-0 text-[13px] font-medium tabular-nums text-muted-foreground">{dataCurta(e)}</span>
      </Link>
    )
  }

  const itensDe = (s: Secao): ReactNode[] => {
    const telas = telasDe(s)
    if (escopo === 'produtora' && s === 'Eventos') {
      return [
        ...telas.slice(0, 1).filter(t => bate(textoDaTela(t, escopo))).map(linkTela),
        ...eventosDaLista(eventos, fixados).filter(e => bate(e.title)).map(linkEvento),
        ...telas.slice(1).filter(t => bate(textoDaTela(t, escopo))).map(linkTela),
      ]
    }
    return telas.filter(t => bate(textoDaTela(t, escopo))).map(linkTela)
  }

  const secoes = SECOES.filter(s => s !== 'Topo').map(s => ({ s, itens: itensDe(s) })).filter(x => x.itens.length > 0)
  const vazio = !secoes.length

  return (
    <Drawer.Root open={aberta} onOpenChange={o => { if (!o) onFechar() }}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[110] bg-[var(--ev-veu)]" />
        <Drawer.Content
          onOpenAutoFocus={e => e.preventDefault()}
          onCloseAutoFocus={e => e.preventDefault()}
          className="fixed inset-x-0 bottom-0 z-[111] flex h-[90dvh] flex-col overflow-hidden rounded-t-[20px] bg-background text-foreground shadow-ev-2 outline-none"
        >
          <div className="shrink-0 px-4 pb-3 pt-2">
            <Drawer.Handle className="mb-2 !h-[5px] !w-9 !bg-muted-foreground/45" />
            <div className="mb-2.5 flex items-center gap-2">
              <Drawer.Title className="flex-1 text-[17px] font-semibold leading-6">Menu</Drawer.Title>
              <Drawer.Close ref={fecharRef} aria-label="Fechar" className={cn('grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-[var(--ev-tint-hover)] hover:text-foreground', foco)}>
                <I.Fechar size={16} />
              </Drawer.Close>
            </div>
            <Drawer.Description className="sr-only">Telas do produtor por área, tema e saída da conta.</Drawer.Description>
            <label className="relative block">
              <span className="sr-only">Buscar tela</span>
              <I.Buscar size={16} className="pointer-events-none absolute left-3 top-3.5 text-muted-foreground" />
              <input
                ref={filtroRef}
                type="search"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar tela"
                autoComplete="off"
                className="h-11 w-full rounded-ev-xl bg-secondary pl-9 pr-3 text-base text-foreground placeholder:text-muted-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            {escopo === 'evento' && (
              <div className="mb-1">
                <Link to="/producer/events" onClick={onFechar} className={cn(item, 'min-h-11 text-muted-foreground')}>
                  <I.SetaEsquerda size={16} />Eventos
                </Link>
                <div className="flex items-center gap-3 px-3 pb-2 pt-1">
                  {evento ? <EventoCapa evento={evento} tamanho="mini-p" className="shrink-0 !size-8 !rounded-ev-sm" /> : <span aria-hidden="true" className="size-8 rounded-ev-sm bg-muted" />}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold leading-5">{evento?.title ?? 'Carregando…'}</span>
                    {evento && <span className="block text-xs leading-4 text-muted-foreground">{dataCurta(evento)} · {situacaoEvento(evento)}</span>}
                  </span>
                </div>
              </div>
            )}
            {secoes.map(({ s, itens }) => {
              const Icone = ICONE[s]
              return (
                <section key={s} aria-label={escopo === 'evento' && s === 'Eventos' ? 'Evento' : s}>
                  <h3 className="flex items-center gap-2 px-3 pb-1 pt-4 text-[13px] font-semibold text-muted-foreground">
                    <Icone size={16} />{escopo === 'evento' && s === 'Eventos' ? 'Evento' : s}
                  </h3>
                  {itens}
                </section>
              )
            })}
            {vazio && <p className="px-3 py-4 text-sm text-muted-foreground">Nenhuma tela com esse nome.</p>}
            {/* fixos: o filtro é só de telas */}
            <div className="mt-2 border-t border-border pt-2">
              <Link to={ROTA_CRIAR_EVENTO} onClick={onFechar} className={item}>
                <I.Criar size={16} />Criar evento
              </Link>
              <div className="grid gap-2 px-3 py-3">
                <span className="text-[15px] font-medium">Tema</span>
                <ThemeToggle className="[&_[role=radiogroup]]:h-11" />
              </div>
              <button type="button" onClick={sair} className={item}>
                <I.Sair size={16} />Sair
              </button>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
