import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import * as I from '@/components/icones/evokaa16'
import EventoCapa from '@/components/EventoCapa'
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { useTheme } from '../../contexts/ThemeContext'
import { useProducerEvents } from '../../hooks/useEvents'
import type { Tema } from '../../lib/tema'
import {
  DASHBOARDS, INICIO, ROTA_CRIAR_EVENTO, SECOES, abreEvento, eventoDaUrl, hrefDaTela, normaliza, rotuloSecao, telasDe, textoDaTela, type Escopo,
} from '../../lib/navegacaoProdutor'
import { ICONE, dataCurta } from './lateralComum'

// Busca rápida ⌘K (V4c; prancha Navegação 6.5): telas, eventos do próprio produtor, ações e tema, sobre o cmdk.
// Carregada só quando aberta (ProducerLayout faz o import dinâmico e a monta enquanto a busca está aberta).
// Moldura em vidro (.vidro, blur 18) e lista sólida; abre sem animação e o véu é liso, sem desfoque (contrato §6.5: "0 ms para abrir").
// O filtro é nosso (cmdk com shouldFilter=false): o do cmdk é aproximado e não ignora acento.

const TEMAS: { valor: Tema; rotulo: string }[] = [
  { valor: 'auto', rotulo: 'automático' },
  { valor: 'light', rotulo: 'claro' },
  { valor: 'dark', rotulo: 'escuro' },
]
const PALAVRAS_TEMA = ['tema', 'claro', 'escuro', 'automatico', 'aparencia'] // quem digita isso quer as ações de tema (2.8.9)
const dir = (texto: string) => <span className="ml-auto shrink-0 text-xs text-muted-foreground">{texto}</span>

export default function BuscaRapida({ onFechar }: { onFechar: () => void }) {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const { tema, setTema } = useTheme()
  // useProducerEvents já traz só os eventos de quem está logado (producer_id): nunca os de outros
  const { data: eventos = [], isLoading } = useProducerEvents()
  const [q, setQ] = useState('')
  // O Radix só devolve o foco a um <Dialog.Trigger>; aqui não há (⌘K e botão da lateral), então guardamos quem abriu e devolvemos
  // ao fechar. Só se o foco se perdeu (body): quem navegou ou clicou noutro campo fica onde está. Com um popover aberto (que
  // fecha ao abrir a busca), o foco volta ao botão que o abriu.
  const [origem] = useState(() => {
    const ativo = document.activeElement
    const id = ativo?.closest('[role="dialog"]')?.id
    return (id && document.querySelector(`[aria-controls="${CSS.escape(id)}"]`)) || ativo
  })
  useEffect(() => () => {
    setTimeout(() => { // depois do fechamento do Radix, que põe o foco no body
      if (origem instanceof HTMLElement && origem.isConnected && document.activeElement === document.body) origem.focus()
    })
  }, [origem])

  const eventId = eventoDaUrl(pathname, search)
  const escopo: Escopo = eventId && (eventos.some(e => e.id === eventId) || isLoading) ? 'evento' : 'produtora' // mesma regra da lateral
  const consulta = normaliza(q.trim())
  const bate = (texto: string) => !consulta || normaliza(texto).includes(consulta)

  // acha pelo texto da tela, pelo nome do mapa ("Financeiro" acha Resumo) e pela seção
  const telas = [
    ...(escopo === 'produtora' ? [INICIO, DASHBOARDS] : []),
    ...SECOES.flatMap(s => telasDe(escopo, s)),
  ].filter(t => bate(`${textoDaTela(t, escopo)} ${t.tela} ${t.secao}`)).slice(0, consulta ? 8 : 5) // sem consulta, só 5 (prancha)
  const doProdutor = eventos.filter(e => bate(e.title)).slice(0, 8) // ponytail: 8 mais recentes; achar um mais antigo é digitando o nome
  const criar = bate('Criar evento')
  const pedeTema = !!consulta && PALAVRAS_TEMA.some(p => p.startsWith(consulta) || consulta.startsWith(p))

  const ir = (href: string) => { onFechar(); navigate(href) }

  return (
    <CommandDialog
      open
      onOpenChange={aberto => { if (!aberto) onFechar() }}
      title="Buscar telas, eventos e ações"
      description="Digite para filtrar. Use as setas e Enter para abrir; Esc fecha."
      showCloseButton={false}
      className="vidro top-24 translate-y-0 gap-0 rounded-ev-xl border-0 p-[6px] data-[state=open]:!animate-none sm:max-w-[600px]"
      overlayClassName="bg-[var(--ev-veu)] before:hidden data-[state=open]:!animate-none"
      commandProps={{ shouldFilter: false, label: 'Buscar telas, eventos e ações' }}
    >
      <CommandInput value={q} onValueChange={setQ} placeholder="Ir para tela, evento ou ação…" aria-label="Buscar" />
      <CommandList aria-label="Resultados">
        <CommandEmpty>Nada com esse nome. Tente o nome do evento, da tela ou "tema".</CommandEmpty>
        {telas.length > 0 && (
          <CommandGroup heading="Telas">
            {telas.map(t => {
              const Icone = ICONE[t.secao]
              return (
                <CommandItem key={t.rota} value={`tela:${t.rota}`} onSelect={() => ir(hrefDaTela(t.rota, escopo === 'evento' && t.noEvento ? eventId : null))}>
                  <Icone size={16} />{textoDaTela(t, escopo)}{t.secao !== 'Topo' && dir(rotuloSecao(escopo, t.secao))}
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}
        {doProdutor.length > 0 && (
          <CommandGroup heading="Eventos">
            {doProdutor.map(e => (
              <CommandItem key={e.id} value={`evento:${e.id}`} onSelect={() => ir(abreEvento(e.id))}>
                <EventoCapa evento={e} tamanho="mini-p" className="!size-4 !rounded-ev-xs shrink-0" />
                <span className="truncate">{e.title}</span>{dir(dataCurta(e))}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {(criar || pedeTema) && (
          <CommandGroup heading="Ações">
            {criar && (
              <CommandItem value="acao:criar" onSelect={() => ir(ROTA_CRIAR_EVENTO)}>
                <I.Criar size={16} />Criar evento
              </CommandItem>
            )}
            {pedeTema && TEMAS.map(t => (
              <CommandItem key={t.valor} value={`tema:${t.valor}`} onSelect={() => { setTema(t.valor); onFechar() }}>
                Tema: {t.rotulo}{tema === t.valor && dir('atual')}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
