import { Fragment, useEffect, useState, type ReactNode } from 'react'
import EventoCapa from '@/components/EventoCapa'
import { Link, useLocation } from 'react-router-dom'
import { Root as TooltipRoot } from '@radix-ui/react-tooltip'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useAuth } from '../../hooks/useAuth'
import { useProducerEvents, type DbEvent } from '../../hooks/useEvents'
import { useFixados } from '../../hooks/useFixados'
import { situacaoEvento } from '../../lib/eventoProdutor'
import {
  INICIO, ROTA_CRIAR_EVENTO, SECOES, abreEvento, eventoDaUrl, filtra, gravarNav, hrefDaTela, lerSecoes,
  rotaAtiva, textoDaTela, trocaEvento, ULTIMO_EVENTO, type Escopo, type Secao, type Tela,
} from '../../lib/navegacaoProdutor'
import ThemeToggle from '../ThemeToggle'
import { ICONE, dataCurta, eventosDaLista } from './lateralComum'

// Lateral do produtor por escopo (fase V4a; estudos/navegacao.md §5 e prancha Navegação do protótipo v3.4).
// Só tokens da V1; sem vidro (a prancha só põe vidro no menu flutuante do trilho, aqui um popover opaco).

type Evento = DbEvent

const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const toque = '[@media(pointer:coarse)]:min-h-11'
const itemBase = cn('relative flex h-8 w-full items-center gap-2.5 rounded-ev-md px-2 text-left text-[13px] font-medium transition-colors duration-rapido motion-reduce:transition-none', foco, toque)
const itemCor = (ativo: boolean) => ativo
  ? 'bg-[var(--ev-tint-ativo)] font-semibold text-foreground'
  : 'text-muted-foreground hover:bg-[var(--ev-tint-hover)] hover:text-foreground'

const iniciais = (nome: string) => nome.trim().split(/\s+/).map(p => p[0]).filter((_, i, l) => i === 0 || i === l.length - 1).join('').toUpperCase() || '?'

/** Miniatura simples da capa (a V6b troca por EventoCapa): foto http ou quadrado na cor do evento */
function Capa({ evento, className }: { evento: Evento; className?: string }) {
  return <EventoCapa evento={evento} tamanho="mini-p" className={cn('shrink-0', className)} />
}

/** Dica à direita só no trilho (atraso e "pula atraso" no TooltipProvider da lateral); aberta, o próprio texto basta */
function Dica({ rail, texto, atalho, children }: { rail: boolean; texto: string; atalho?: string; children: ReactNode }) {
  if (!rail) return <>{children}</>
  return (
    <TooltipRoot>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{texto}{atalho && <kbd className="ml-2 opacity-80">{atalho}</kbd>}</TooltipContent>
    </TooltipRoot>
  )
}

interface LateralProps {
  /** Trilho de 56 px (só no computador) */
  rail: boolean
  /** Fecha a gaveta do celular */
  onNavega: () => void
  onRecolher: () => void
}

export default function Lateral({ rail, onNavega, onRecolher }: LateralProps) {
  const { pathname, search } = useLocation()
  const { user, logout } = useAuth()
  const { data: eventos = [], isLoading } = useProducerEvents()
  const [fixados, alternaFixo] = useFixados()
  const [abertas, setAbertas] = useState(lerSecoes) // abertas ou fechadas à mão, por `escopo:Seção`

  const eventId = eventoDaUrl(pathname, search)
  const evento: Evento | undefined = eventos.find(e => e.id === eventId)
  const escopo: Escopo = eventId && (evento || isLoading) ? 'evento' : 'produtora'

  // evento aberto vira o "último evento usado" (as telas por evento começam nele)
  useEffect(() => { if (evento) gravarNav(ULTIMO_EVENTO, evento.id) }, [evento])

  const nome = user?.name || user?.full_name || 'Usuário'
  const produtora = user?.producer_profile?.company_name || nome
  const foto = user?.avatar_url || user?.avatar

  const ativa = (rota: string) => rotaAtiva(rota, pathname)

  const sair = () => {
    toast.info('Você saiu da sua conta')
    logout() // o logout já faz window.location.href = '/'
  }

  const linhas = eventosDaLista(eventos, fixados)

  const itemLink = (t: Tela, nivel: 1 | 2 = 2) => {
    const ativo = ativa(t.rota)
    return (
      <Link
        key={t.tela}
        to={hrefDaTela(t.rota, escopo === 'evento' ? eventId : null)}
        onClick={onNavega}
        aria-current={ativo ? 'page' : undefined}
        className={cn(itemBase, itemCor(ativo), nivel === 2 && 'pl-[34px] font-normal')}
      >
        <span className="truncate">{textoDaTela(t, escopo)}</span>
      </Link>
    )
  }

  const linhaEvento = (e: Evento) => {
    const aviso = situacaoEvento(e) === 'Em análise'
    return (
      <Link
        key={e.id}
        to={abreEvento(e.id)}
        onClick={onNavega}
        aria-label={`${e.title}, ${dataCurta(e)}${aviso ? ', em análise' : ''}`}
        className={cn(itemBase, itemCor(false), 'h-9 gap-2 pl-7')}
      >
        <Capa evento={e} className="!size-5 !rounded-ev-xs" />
        <span className="flex-1 truncate">{e.title}</span>
        {aviso && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-[var(--ev-warning)]" />}
        <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">{dataCurta(e)}</span>
      </Link>
    )
  }

  // ---- seções (cada área na sua seção; no evento, só as telas dele) ----
  const secoes = SECOES.filter(s => s !== 'Topo' && filtra(escopo, s).length > 0)
  const rotuloSecao = (s: Secao) => (escopo === 'evento' && s === 'Eventos' ? 'Evento' : s)

  const conteudoSecao = (s: Secao) => {
    const telas = filtra(escopo, s)
    if (escopo === 'produtora' && s === 'Eventos') {
      return <>{itemLink(telas[0])}{linhas.map(linhaEvento)}{telas.slice(1).map(t => itemLink(t))}</>
    }
    return <>{telas.map(t => itemLink(t))}</>
  }

  const secaoAtiva = (s: Secao) => filtra(escopo, s).some(t => ativa(t.rota))

  const area = (s: Secao) => {
    const chave = `${escopo}:${s}`
    // a da tela atual sempre aberta (§5.3); no escopo do evento todas (cabem, §5.1); na produtora, também a de Eventos
    const aberta = secaoAtiva(s) || (abertas[chave] ?? (escopo === 'evento' || s === 'Eventos'))
    const id = `lateral-${s}`
    const Icone = ICONE[s]
    return (
      <div key={s}>
        <button
          type="button"
          aria-expanded={aberta}
          aria-controls={id}
          onClick={() => {
            const novas = { ...abertas, [chave]: !aberta }
            setAbertas(novas)
            gravarNav('secoes', JSON.stringify(novas))
          }}
          className={cn(itemBase, secaoAtiva(s) ? 'text-foreground' : 'text-muted-foreground hover:bg-[var(--ev-tint-hover)] hover:text-foreground')}
        >
          <Icone size={16} />
          <span className="flex-1 truncate">{rotuloSecao(s)}</span>
          <I.ChevronDireita size={16} className={cn('transition-transform duration-rapido motion-reduce:transition-none', aberta && 'rotate-90')} />
        </button>
        {aberta && <div id={id} role="group" aria-label={rotuloSecao(s)} className="mt-0.5 flex flex-col gap-0.5">{conteudoSecao(s)}</div>}
      </div>
    )
  }

  // ---- trilho: área vira ícone com popover; eventos viram quadradinhos ----
  const areaTrilho = (s: Secao) => <AreaTrilho key={s} rotulo={rotuloSecao(s)} icone={ICONE[s]} ativo={secaoAtiva(s)}>{conteudoSecao(s)}</AreaTrilho>

  const botaoIcone = 'relative flex size-10 items-center justify-center rounded-ev-md transition-colors duration-rapido motion-reduce:transition-none ' + foco

  const inicioAtivo = ativa(INICIO.rota)
  const inicio = (
    <Dica key="inicio" rail={rail} texto={INICIO.tela}>
      <Link
        to={INICIO.rota}
        onClick={onNavega}
        aria-current={inicioAtivo ? 'page' : undefined}
        aria-label={rail ? INICIO.tela : undefined}
        className={rail ? cn(botaoIcone, itemCor(inicioAtivo), 'self-center') : cn(itemBase, itemCor(inicioAtivo))}
      >
        <I.Inicio size={16} ativo={inicioAtivo} className={inicioAtivo ? 'text-primary' : undefined} />
        {!rail && <span className="truncate">{INICIO.tela}</span>}
      </Link>
    </Dica>
  )

  // ---- topo ----
  const marca = <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded-ev-xs bg-foreground text-[9px] font-bold tracking-wide text-background">{iniciais(produtora)}</span>
  const seletorProdutora = (
    <Popover>
      <Dica rail={rail} texto={produtora}>
        <PopoverTrigger asChild>
          <button type="button" aria-label={`Produtora ${produtora}: trocar ou abrir equipe`} className={cn(rail ? botaoIcone : cn(itemBase, 'font-semibold text-foreground hover:bg-[var(--ev-tint-hover)]'))}>
            {marca}
            {!rail && <><span className="flex-1 truncate">{produtora}</span><I.ChevronBaixo size={16} className="text-muted-foreground" /></>}
          </button>
        </PopoverTrigger>
      </Dica>
      <PopoverContent side={rail ? 'right' : 'bottom'} align="start" className="w-60 p-1">
        <p className="px-2 pb-1 pt-1.5 text-xs font-semibold text-muted-foreground">Produtora</p>
        <div aria-current="true" className="flex h-8 items-center gap-2 rounded-ev-sm px-2 text-[13px] font-medium">
          {marca}<span className="flex-1 truncate">{produtora}</span><I.Check size={16} className="text-primary" />
        </div>
        <div role="separator" className="my-1 h-px bg-border" />
        <Link to="/producer/team" onClick={onNavega} className={cn(itemBase, itemCor(false))}>Equipe</Link>
        <Link to="/producer/settings" onClick={onNavega} className={cn(itemBase, itemCor(false))}>Configurações</Link>
      </PopoverContent>
    </Popover>
  )

  // ponytail: o botão "Buscar… ⌘K" volta na V4c (BuscaRapida), acima do "+" e, no trilho, entre a produtora e o "+"

  const criar = (
    <Dica rail={rail} texto="Criar evento">
      <Link
        to={ROTA_CRIAR_EVENTO}
        onClick={onNavega}
        aria-label="Criar evento"
        className={cn('flex items-center justify-center gap-2 rounded-ev-md bg-card text-[13px] font-medium text-foreground shadow-ev-secondary hover:bg-[var(--ev-sec-hover)]', foco, toque, rail ? 'size-10' : 'h-8 w-full')}
      >
        <I.Criar size={16} />{!rail && 'Criar evento'}
      </Link>
    </Dica>
  )

  // ---- bloco do evento (escopo evento) ----
  const fixado = !!evento && fixados.includes(evento.id)
  const blocoEvento = escopo === 'evento' && (
    <>
      <div className={cn('flex items-center px-2', rail ? 'flex-col gap-1 pb-1' : 'h-12 gap-1')}>
        <Dica rail={rail} texto="Todos os eventos">
          <Link
            to="/producer/events"
            onClick={onNavega}
            aria-label="Todos os eventos"
            className={rail ? cn(botaoIcone, itemCor(false)) : cn(itemBase, itemCor(false), 'flex-1')}
          >
            <I.SetaEsquerda size={16} />
            {!rail && <span className="truncate">Todos os eventos</span>}
          </Link>
        </Dica>
        {evento && !rail && (
          <button
            type="button"
            aria-pressed={fixado}
            aria-label={fixado ? `Desafixar ${evento.title} da lista` : `Fixar ${evento.title} na lista`}
            onClick={() => alternaFixo(evento.id)}
            className={cn('relative flex size-8 shrink-0 items-center justify-center rounded-ev-md text-muted-foreground hover:bg-[var(--ev-tint-hover)] hover:text-foreground', foco, toque, '[@media(pointer:coarse)]:min-w-11')}
          >
            <I.Estrela size={16} ativo={fixado} className={fixado ? 'text-primary' : undefined} />
          </button>
        )}
      </div>
      <div className={cn('px-2 pb-2', rail && 'flex justify-center')}>
        <Popover>
          <Dica rail={rail} texto={evento?.title ?? 'Evento'}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`Evento ${evento?.title ?? ''}: trocar de evento`}
                className={cn('flex items-center gap-2.5 rounded-ev-md text-left hover:bg-[var(--ev-tint-hover)]', foco, rail ? 'size-10 justify-center' : 'w-full p-2')}
              >
                {evento ? <Capa evento={evento} className="!size-8 !rounded-ev-sm" /> : <span className="size-8 rounded-ev-sm bg-muted" aria-hidden="true" />}
                {!rail && (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold leading-5">{evento?.title ?? 'Carregando…'}</span>
                      {evento && <span className="block text-xs leading-4 text-muted-foreground">{dataCurta(evento)} · {situacaoEvento(evento)}</span>}
                    </span>
                    <I.ChevronBaixo size={16} className="shrink-0 text-muted-foreground" />
                  </>
                )}
              </button>
            </PopoverTrigger>
          </Dica>
          <PopoverContent side={rail ? 'right' : 'bottom'} align="start" className="max-h-80 w-64 overflow-y-auto p-1">
            <p className="px-2 pb-1 pt-1.5 text-xs font-semibold text-muted-foreground">Trocar de evento</p>
            {eventos.map(e => (
              <Link
                key={e.id}
                to={trocaEvento(pathname, e.id)}
                onClick={onNavega}
                aria-current={e.id === eventId ? 'true' : undefined}
                className={cn(itemBase, itemCor(e.id === eventId), 'h-9 gap-2')}
              >
                <Capa evento={e} className="!size-5 !rounded-ev-xs" />
                <span className="flex-1 truncate">{e.title}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{dataCurta(e)}</span>
              </Link>
            ))}
          </PopoverContent>
        </Popover>
      </div>
    </>
  )

  // ---- rodapé ----
  const avatar = (
    <Popover>
      <Dica rail={rail} texto={nome}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`${nome}: perfil, tema e sair`}
            className={cn('flex min-w-0 items-center gap-2 rounded-ev-md text-[13px] font-medium hover:bg-[var(--ev-tint-hover)]', foco, rail ? 'size-10 justify-center' : 'h-8 flex-1 px-1', toque)}
          >
            <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center overflow-hidden rounded-full bg-secondary text-[10px] font-semibold shadow-[inset_0_0_0_1px_hsl(var(--border))]">
              {foto ? <img src={foto} alt="" className="size-full object-cover" /> : iniciais(nome)}
            </span>
            {!rail && <span className="truncate">{nome}</span>}
          </button>
        </PopoverTrigger>
      </Dica>
      <PopoverContent side={rail ? 'right' : 'top'} align="start" className="w-64 p-1">
        <div className="px-2 pb-2 pt-1.5">
          <p className="truncate text-[13px] font-semibold">{nome}</p>
          {user?.email && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
        </div>
        <Link to="/producer/settings" onClick={onNavega} className={cn(itemBase, itemCor(false))}>Perfil e configurações</Link>
        <div role="separator" className="my-1 h-px bg-border" />
        <div className="px-1 py-1"><ThemeToggle /></div>
        <div role="separator" className="my-1 h-px bg-border" />
        <button type="button" onClick={sair} className={cn(itemBase, itemCor(false))}>Sair</button>
      </PopoverContent>
    </Popover>
  )

  const recolher = (
    <Dica rail={rail} texto="Expandir menu" atalho="⌘B">
      <button
        type="button"
        onClick={onRecolher}
        aria-label={rail ? 'Expandir menu' : 'Recolher menu'}
        aria-expanded={!rail}
        aria-controls="produtor-menu"
        title={rail ? undefined : 'Recolher menu (⌘B)'}
        className={cn('relative hidden items-center justify-center rounded-ev-md text-muted-foreground hover:bg-[var(--ev-tint-hover)] hover:text-foreground lg:flex', foco, rail ? 'size-10' : 'size-8 shrink-0')}
      >
        <I.Lateral size={16} />
      </button>
    </Dica>
  )

  return (
    // 400 ms para a 1ª dica; passando de um item a outro em 300 ms, a seguinte sai na hora
    <TooltipProvider delayDuration={400} skipDelayDuration={300}>
      <div className={cn('flex shrink-0 flex-col gap-2 px-2 pb-2 pt-2', rail && 'items-center')}>
        {escopo === 'produtora' ? seletorProdutora : null}
        {blocoEvento}
        {criar}
      </div>

      <nav aria-label="Menu do produtor" className={cn('flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain px-2 pb-2 pt-0.5 sidebar-dark-scroll', rail && 'items-center')}>
        {escopo === 'produtora' && inicio}
        {secoes.filter(s => s !== 'Conta').map(s => rail ? (
          <Fragment key={s}>
            {areaTrilho(s)}
            {escopo === 'produtora' && s === 'Eventos' && linhas.map(e => <RailEvento key={e.id} e={e} />)}
          </Fragment>
        ) : area(s))}
        {secoes.includes('Conta') && (
          <>
            <div role="separator" className={cn('my-2.5 h-px shrink-0 bg-border', rail ? 'w-6' : 'w-full')} />
            {rail ? areaTrilho('Conta') : area('Conta')}
          </>
        )}
      </nav>

      <div className={cn('mx-2 mb-2 flex shrink-0 items-center gap-2 border-t border-border pt-2', rail && 'flex-col')}>
        {avatar}
        {recolher}
      </div>
    </TooltipProvider>
  )
}

/** Área no trilho: ícone que abre um popover com as telas da área */
function AreaTrilho({ rotulo, icone: Icone, ativo, children }: { rotulo: string; icone: I.IconeEvokaa; ativo: boolean; children: ReactNode }) {
  const [aberto, setAberto] = useState(false)
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <TooltipRoot>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={rotulo}
              className={cn('relative flex size-10 items-center justify-center rounded-ev-md transition-colors duration-rapido motion-reduce:transition-none', foco, itemCor(ativo))}
            >
              <Icone size={16} ativo={ativo} className={ativo ? 'text-primary' : undefined} />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="right">{rotulo}</TooltipContent>
      </TooltipRoot>
      <PopoverContent side="right" align="start" className="w-56 p-1" onClick={() => setAberto(false)}>
        <p className="px-2 pb-1 pt-1.5 text-xs font-semibold text-muted-foreground">{rotulo}</p>
        <div className="flex flex-col gap-0.5">{children}</div>
      </PopoverContent>
    </Popover>
  )
}

function RailEvento({ e }: { e: Evento }) {
  return (
    <TooltipRoot>
      <TooltipTrigger asChild>
        <Link to={abreEvento(e.id)} aria-label={e.title} className={cn('flex size-10 items-center justify-center rounded-ev-md hover:bg-[var(--ev-tint-hover)]', foco)}>
          <Capa evento={e} className="!size-5 !rounded-ev-xs" />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">{e.title}</TooltipContent>
    </TooltipRoot>
  )
}
