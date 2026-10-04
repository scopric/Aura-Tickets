import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import CapaEventoCampo from '../../components/producer/CapaEventoCampo'
import MatchDeMesaPanel from '../../components/producer/MatchDeMesaPanel'
import { PreviaFolha, PreviaMoldura } from '../../components/producer/PreviaCelular'
import SecaoIngressos from '../../components/producer/painel/SecaoIngressos'
import SecaoOQueE from '../../components/producer/painel/SecaoOQueE'
import SecaoPublicar, { type Falta } from '../../components/producer/painel/SecaoPublicar'
import SecaoQuandoOnde from '../../components/producer/painel/SecaoQuandoOnde'
import SecaoRegras from '../../components/producer/painel/SecaoRegras'
import { Faixa } from '../../components/producer/painel/campos'
import { useAutoSave } from '../../components/producer/painel/useAutoSave'
import { EmptyState, PageHeader } from '@/components/producer/ui'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { gravarEvento, useDeleteEvent, useUpdateEvent, type DbEvent, type DbTicketType } from '../../hooks/useEvents'
import { useAuth } from '../../hooks/useAuth'
import { useTourLog } from '../../hooks/useTourLog'
import { siteUrl } from '../../lib/appHost'
import { enviarCapa, useLiberarPrevia, type CapaPronta } from '../../lib/capaEvento'
import { FOTO_PADRAO, corDoEvento, temFoto } from '../../lib/corEvento'
import { confirmacaoDuplicar, erroAoExcluir } from '../../lib/eventoProdutor'
import { useDuplicarEvento } from '../../hooks/useDuplicarEvento'
import { hrefDaTela } from '../../lib/navegacaoProdutor'
import {
  ERRO_NOME, SECAO_DA_PENDENCIA, USA_LINK, diffCampos, enviarEvento, errosDeData, eventoDaPrevia, erroDosIngressos, errosDeIngresso, formDoEvento, formDoSnap, ingDoBanco, linkValido, modoPainel,
  mudouConteudo, pendenciasDoPainel, precoDe, quantidadeDe, rotuloDoModo, rotulosDoDiff, semDatasInvalidas, semNomeVazio, snapDoForm, temErro, type Form, type Ing, type ModoPainel, type Snap,
} from '../../lib/painelEvento'
import { supabase } from '../../lib/supabase'
import { brl, calcularTaxa } from '../../lib/taxa'
import { ACEITE_VERSAO, CLASSIFICACOES, TEMAS, rotuloFormato, textoAceite } from '../../lib/tipoEvento'
import { dataComSemana, horaCurta } from '../../lib/visaoEvento'

// Painel do evento (F1 PR3b; prancha Painel.dc.html e Estados.dc.html): a rota de edição. Seis seções em sanfona, a barra
// "N de 8 prontos", salvamento automático no rascunho, recusado e em análise, e "Enviar alterações" no evento no ar.
// O formulário nasce do evento lido ao abrir e NÃO se realimenta da consulta depois (cada gravação invalida listas).

const SECOES = [
  { id: 'oque', nome: 'O que é' }, { id: 'quando', nome: 'Quando e onde' }, { id: 'img', nome: 'Imagem' },
  { id: 'ing', nome: 'Ingressos' }, { id: 'regras', nome: 'Regras e idade' }, { id: 'pub', nome: 'Publicar' },
] as const
const NOME_SECAO = Object.fromEntries(SECOES.map(s => [s.id, s.nome])) as Record<string, string>
type UltimoAceite = { classificacao: string | null; tem_bebida: boolean; versao: string; texto_hash: string }
const PONTO: Record<ModoPainel, string> = { rascunho: 'bg-muted-foreground', recusado: 'bg-destructive', analise: 'bg-[var(--ev-warning)]', publicado: 'bg-[var(--ev-success)]', fechado: 'bg-muted-foreground' }
const ATIVO = ['rascunho', 'recusado', 'analise']
const GUIA = 'guia:painel-evento' // registro em onboarding_logs (V9): sem ele, o rascunho abre no modo guiado

const porCriacao = (l: DbTicketType[]) => [...l].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
const semCentavos = (v: number) => brl(v).replace(',00', '')

// ---- carregamento -------------------------------------------------------------------------------------------------
// Consultas próprias, sem cache entre visitas (gcTime 0): o formulário nasce do que está no banco agora, não de uma cópia
// de até 5 min que outra tela deixou (usePublicEvent).
const frescas = { gcTime: 0, staleTime: 0, refetchOnMount: 'always', retry: 1 } as const

export default function PainelEvento() {
  const { eventId } = useParams()
  const { user } = useAuth()
  const ev = useQuery({
    queryKey: ['painel-evento', eventId], enabled: !!eventId, ...frescas,
    queryFn: async () => {
      const { data, error } = await supabase.from('events').select('*, ticket_types (*)').eq('id', eventId!).maybeSingle()
      if (error) throw error
      return data as DbEvent | null
    },
  })
  const dono = !!ev.data && ev.data.producer_id === user?.id
  const lk = useQuery({
    queryKey: ['painel-link', eventId], enabled: dono, ...frescas,
    queryFn: async () => {
      const { data, error } = await supabase.from('evento_privado' as never).select('online_url').eq('event_id', eventId!).maybeSingle()
      if (error) throw error
      return (data as { online_url: string | null } | null)?.online_url ?? ''
    },
  })
  // Último aceite do evento (o dono lê evento_aceites): sem ele não dá para saber se classificação e bebida mudaram depois.
  // Falhar aqui não bloqueia o painel: sem a leitura não aparece a faixa "aceite pendente".
  const ac = useQuery({
    queryKey: ['painel-aceite', eventId], enabled: dono, ...frescas,
    queryFn: async (): Promise<UltimoAceite | null> => {
      const { data, error } = await supabase.from('evento_aceites' as never).select('classificacao, tem_bebida, versao, texto_hash').eq('event_id', eventId!).order('aceito_em', { ascending: false }).limit(1)
      if (error) throw error
      return ((data as UltimoAceite[] | null) ?? [])[0] ?? null
    },
  })
  // Vendidos por tipo: ticket_types.sold não é atualizado por nada no banco; vale a contagem de ingressos válidos
  const vd = useQuery({
    queryKey: ['painel-vendidos', eventId], enabled: !!ev.data, ...frescas,
    queryFn: async () => {
      const tipos = ev.data!.ticket_types ?? []
      const contagens = await Promise.all(tipos.map(t =>
        supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('ticket_type_id', t.id).in('status', ['active', 'used'])))
      const porId: Record<string, number> = {}
      tipos.forEach((t, i) => {
        const gravado = Math.max(Number(t.sold) || 0, Number((t as unknown as { quantity_sold?: number }).quantity_sold) || 0)
        porId[t.id] = Math.max(contagens[i].error ? 0 : contagens[i].count ?? 0, gravado)
      })
      return porId
    },
  })

  const cabecalho = <PageHeader title="Evento" description="Carregando o painel…" />
  if (ev.isPending || (dono && (lk.isPending || ac.isPending)) || (ev.data && vd.isPending)) {
    return (
      <div aria-busy="true" className="mx-auto max-w-3xl">
        {cabecalho}
        <Skeleton className="h-8 rounded-md bg-muted" />
        <Skeleton className="mt-6 h-80 rounded-[10px] bg-muted" />
      </div>
    )
  }
  // Releitura que falha (internet) não desmonta o painel já aberto: só erro SEM dados mostra "Tentar de novo"
  if ((ev.isError && !ev.data) || (lk.isError && lk.data === undefined)) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Evento" />
        <div role="alert" className="flex flex-col gap-3 rounded-[10px] border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground">Não foi possível carregar o evento. Nada foi alterado.</p>
          <Button variant="outline" size="sm" onClick={() => { void ev.refetch(); void lk.refetch() }}>Tentar de novo</Button>
        </div>
      </div>
    )
  }
  // Só o dono abre o painel (a regra de gravação do banco é por dono, sem equipe): quem lê o evento pela regra pública
  // (evento no ar de outro produtor, ou um editor) vê "não encontrado"
  if (!ev.data || !dono) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Evento" />
        <EmptyState title="Evento não encontrado" action={<Button asChild variant="outline"><Link to="/producer/events">Voltar para meus eventos</Link></Button>} />
      </div>
    )
  }
  return <Painel evento={ev.data} linkInicial={lk.data ?? ''} vendidosPorId={vd.data ?? {}} ultimoAceite={ac.data === undefined ? undefined : ac.data} />
}

// ---- painel ----------------------------------------------------------------------------------------------------------
function Painel({ evento, linkInicial, vendidosPorId, ultimoAceite }: { evento: DbEvent; linkInicial: string; vendidosPorId: Record<string, number>; ultimoAceite?: UltimoAceite | null }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const atualizarIngressos = useUpdateEvent()
  const { duplicar: duplicarEv, duplicando } = useDuplicarEvento()
  const excluir = useDeleteEvent()
  const modo = modoPainel(evento)
  const autosalva = ATIVO.includes(modo)
  const somenteLeitura = modo === 'fechado'

  // estado inicial: lido uma vez
  const [inicial] = useState(() => {
    const f = formDoEvento(evento, linkInicial)
    const tipos = porCriacao(evento.ticket_types ?? []).map(t => ingDoBanco(t, vendidosPorId[t.id] ?? 0))
    // Fora do ar o snapshot guarda o link LIDO: evento aberto em modo sem link (presencial, a definir) que ainda tem link
    // salvo o apaga na primeira gravação. No ar o link antigo fica inofensivo: não vira "alteração" que só o envio resolve.
    const s = snapDoForm(f)
    return { f, s: modoPainel(evento) === 'publicado' ? s : { ...s, online_url: linkInicial }, tipos }
  })
  const [form, setForm] = useState<Form>(inicial.f)
  const [salvo, setSalvo] = useState<Snap>(inicial.s) // o que está gravado (no evento no ar, o que está no ar)
  const salvoRef = useRef(inicial.s)
  const guardaBase = (s: Snap) => { salvoRef.current = s; setSalvo(s) }
  const [ings, setIngs] = useState<Ing[]>(inicial.tipos)
  const [ingsSalvos, setIngsSalvos] = useState<Ing[]>(inicial.tipos)
  const [removidos, setRemovidos] = useState<string[]>([])
  const [salvandoIng, setSalvandoIng] = useState(false)
  const [tentouIng, setTentouIng] = useState(false)
  const [alternando, setAlternando] = useState<string | null>(null)
  const [capa, setCapa] = useState<CapaPronta | null>(null) // foto nova, já reduzida; sobe ao gravar
  const [removida, setRemovida] = useState(false)
  const [urlAtual, setUrlAtual] = useState<string | null>(evento.cover_image)
  const [corManual, setCorManual] = useState(false)
  const enviada = useRef<{ blob: Blob; url: string } | null>(null) // não sobe de novo se a gravação falhar depois do envio
  useLiberarPrevia(capa)
  const [aceiteDe, setAceiteDe] = useState<string | null>(null) // o texto aceito: mudou o texto, o aceite se desfaz
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState('')
  const [dialogo, setDialogo] = useState(false)
  const [soAceite, setSoAceite] = useState(false) // o diálogo só refaz o aceite (evento que já está em análise ou no ar)
  const [saida, setSaida] = useState<string | null>(null)
  const [abertas, setAbertas] = useState<string[]>(['oque'])
  // Modo guiado (decisão 164.1): todo produtor, em rascunho, até concluir ou pular. Leitura com erro = painel normal.
  const { feitos, registrar, carregou, erro: erroGuia } = useTourLog({ ativo: modo === 'rascunho' })
  const [passo, setPasso] = useState(0)
  const [saiuGuia, setSaiuGuia] = useState(false)
  const guiado = modo === 'rascunho' && carregou && !erroGuia && !feitos.has(GUIA) && !saiuGuia

  const set = useCallback((p: Partial<Form>) => setForm(f => ({ ...f, ...p })), [])
  const snap = useMemo(() => snapDoForm(form), [form])
  const diff = useMemo(() => diffCampos(salvo, snap), [salvo, snap])
  const capaPendente = !!capa || removida
  const esporte = form.category === 'esporte'
  const ingSujo = removidos.length > 0 || JSON.stringify(ings) !== JSON.stringify(ingsSalvos)
  const vendidosTotal = ingsSalvos.reduce((s, i) => s + i.vendidos, 0)
  const travado = vendidosTotal > 0

  // ---- gravação do evento (salvamento automático e envio usam a mesma, uma por vez) ----
  const erros = errosDeData(form, inicial.f)
  const erroNome = form.title.trim() === '' ? ERRO_NOME : ''
  const vivo = useRef({ snap, capa, removida, ingSujo, erros, nome: form.title })
  useEffect(() => { vivo.current = { snap, capa, removida, ingSujo, erros, nome: form.title } })
  const fila = useRef<Promise<void>>(Promise.resolve())
  const excluindo = useRef(false)

  async function gravarAgora() {
    if (excluindo.current) return
    const v = vivo.current
    // data com erro (início no passado, fim antes do início…) não é gravada: a tela mostra o erro e espera a correção
    const campos = semNomeVazio(semDatasInvalidas(diffCampos(salvoRef.current, v.snap), v.erros), v.nome)
    const { online_url: link, ...col } = campos
    let extra: Partial<DbEvent> = {}
    let url: string | undefined
    if (v.capa) {
      if (enviada.current?.blob !== v.capa.blob) enviada.current = { blob: v.capa.blob, url: await enviarCapa(v.capa, evento.producer_id, evento.id) }
      url = enviada.current.url
      extra = { cover_image: url, image_url: url }
    } else if (v.removida) {
      extra = { cover_image: FOTO_PADRAO, image_url: FOTO_PADRAO }
    }
    await gravarEvento(evento.id, { ...col, ...extra } as Partial<DbEvent>)
    guardaBase({ ...salvoRef.current, ...col })
    if (link !== undefined) {
      // link vazio (ou modo sem link) apaga a linha de evento_privado; link novo entra por upsert
      const { error } = link === ''
        ? await supabase.from('evento_privado' as never).delete().eq('event_id', evento.id)
        : await supabase.from('evento_privado' as never).upsert({ event_id: evento.id, online_url: link } as never, { onConflict: 'event_id' }).select('event_id').single()
      // falha parcial: o evento já gravou (e pode já estar em análise); o envio explica isso
      if (error) throw Object.assign(new Error(error.message || 'link não gravado'), { parcial: true })
      guardaBase({ ...salvoRef.current, online_url: link })
    }
    if (v.capa && vivo.current.capa === v.capa) { URL.revokeObjectURL(v.capa.previewUrl); setCapa(null); setUrlAtual(url ?? null) }
    else if (v.removida && vivo.current.removida) { setRemovida(false); setUrlAtual(FOTO_PADRAO) }
    void qc.invalidateQueries({ queryKey: ['producer-events'] })
    void qc.invalidateQueries({ queryKey: ['public-event', evento.id] })
  }
  const gravarSerial = () => { const p = fila.current.catch(() => undefined).then(gravarAgora); fila.current = p; return p }

  // Evento no ar: nada salva sozinho, EXCETO o que não é conteúdo moderado (a cor): vale na hora, sem análise
  const capaPendenteAgora = !!capa || removida
  const autoAtivo = autosalva || (modo === 'publicado' && !mudouConteudo(diff, capaPendenteAgora))
  const gatilho = useMemo(() => ({ snap, capa, removida }), [snap, capa, removida])
  const { estado, tentarDeNovo } = useAutoSave({
    ativo: autoAtivo, mudou: gatilho, gravar: gravarSerial,
    temMudanca: () => !excluindo.current && (!!vivo.current.capa || vivo.current.removida || temErro(semNomeVazio(semDatasInvalidas(diffCampos(salvoRef.current, vivo.current.snap), vivo.current.erros), vivo.current.nome))),
  })

  // ---- derivados da tela ----
  const link = form.link.trim()
  const linkRuim = USA_LINK.includes(form.local_modo) && link !== '' && !linkValido(link)
  const temBebidaSalva = ingsSalvos.some(i => i.bebida)
  // "Refazer o aceite" vale o que está SALVO (a função lê o banco e nada é gravado pelo caminho); o envio vale o que está na tela
  const classSalva = salvo.category === 'esporte' ? null : salvo.classificacao || null
  const classificacaoTela = esporte ? null : form.classificacao || null
  const classAceite = soAceite ? classSalva : classificacaoTela
  const textoDoAceite = textoAceite({ titulo: soAceite ? salvo.title : form.title, formato: (soAceite ? salvo.category : form.category) || null, classificacao: classAceite, temBebida: temBebidaSalva })
  const aceiteMarcado = aceiteDe === textoDoAceite
  const lista = pendenciasDoPainel(form, ingsSalvos, aceiteMarcado || modo === 'publicado' || modo === 'analise')
  const prontos = lista.filter(p => p.pronto).length
  const faltas: Falta[] = [
    ...lista.filter(p => !p.pronto).map(p => ({ rotulo: p.rotulo, secao: SECAO_DA_PENDENCIA[p.id], nomeSecao: NOME_SECAO[SECAO_DA_PENDENCIA[p.id]] })),
    ...(ingSujo ? [{ rotulo: 'Salvar os ingressos', secao: 'ing', nomeSecao: 'Ingressos' }] : []),
    ...(erroNome ? [{ rotulo: 'Escrever o nome do evento', secao: 'oque', nomeSecao: 'O que é' }] : []),
    ...(erros.inicio || erros.fim ? [{ rotulo: 'Corrigir as datas', secao: 'quando', nomeSecao: 'Quando e onde' }] : []),
    ...(linkRuim ? [{ rotulo: 'Corrigir o link da transmissão', secao: 'quando', nomeSecao: 'Quando e onde' }] : []),
  ]
  // evento no ar: só o conteúdo moderado vai para a faixa "Alterações não enviadas" (a cor salva sozinha)
  const moderado = modo === 'publicado' && mudouConteudo(diff, capaPendente)
  const alteracoes = moderado ? [...rotulosDoDiff(diff), ...(capaPendente ? ['capa'] : [])] : []
  // Um critério só para o aceite: o ÚLTIMO aceite registrado (lido de evento_aceites). Vale quando não há nenhum, quando a
  // versão do texto é outra e quando a classificação ou a bebida não são as dele. Leitura que falhou (undefined): a
  // classificação mudada na tela ou a bebida diferente da lida na abertura exigem aceite novo no evento no ar.
  const divergeDoAceite = (cls: string | null) => ultimoAceite === null || (ultimoAceite !== undefined
    && (ultimoAceite.versao !== ACEITE_VERSAO || ultimoAceite.classificacao !== cls || ultimoAceite.tem_bebida !== temBebidaSalva))
  const semAceite = ultimoAceite === null
  const aceiteDefasado = (modo === 'analise' || modo === 'publicado') && divergeDoAceite(classSalva)
  const precisaAceiteNovo = modo === 'publicado' && (ultimoAceite === undefined ? 'classificacao' in diff || temBebidaSalva !== inicial.tipos.some(i => i.bebida) : divergeDoAceite(classificacaoTela))
  const aceiteNoDialogo = soAceite || precisaAceiteNovo
  const bloqueioDialogo = soAceite ? '' : ingSujo ? 'Há ingressos com mudanças não salvas. Salve os ingressos antes de enviar.' : erroNome || erros.inicio || erros.fim || linkRuim ? 'Corrija o nome, as datas e o link da transmissão antes de enviar.' : ''

  const ingValidos = !ingSujo && ings.every(i => !temErro(errosDeIngresso(i)))
  const pronta = (id: string) => id === 'img' || (modo !== 'rascunho' && modo !== 'recusado' && id === 'pub')
    || (lista.filter(p => SECAO_DA_PENDENCIA[p.id] === id).every(p => p.pronto) && (id !== 'ing' || ingValidos))
  const ativos = ingsSalvos.filter(i => i.ativo)
  const precos = ativos.map(i => precoDe(i.preco) ?? 0).filter(p => p > 0).map(p => calcularTaxa(p).total)
  const resumos: Record<string, string> = {
    oque: [rotuloFormato(form.category) || 'Sem formato', form.temas.map(t => TEMAS.find(x => x.valor === t)?.rotulo).filter(Boolean).join(', ')].filter(Boolean).join(' · '),
    quando: [
      form.inicioD ? [dataComSemana(form.inicioD), horaCurta(form.inicioH)].filter(Boolean).join(' · ') : 'Sem data',
      form.local_modo === 'a_definir' ? 'local a definir' : form.local_modo === 'online' ? 'online' : (form.venue_name || 'sem local') + (form.local_modo === 'hibrido' ? ' + online' : ''),
    ].join(' · '),
    img: capa || (temFoto(urlAtual) && !removida) ? 'Foto de capa e cor' : 'Sem foto: o evento ganha um cartaz',
    ing: ings.length === 0 ? 'Nenhum ingresso' : `${ings.length} ${ings.length === 1 ? 'ingresso' : 'ingressos'}${precos.length ? ` · a partir de ${semCentavos(Math.min(...precos))}` : ativos.length ? ' · gratuito' : ''}`,
    regras: esporte ? 'Esporte: sem selo' : form.classificacao ? `Classificação ${form.classificacao}${temBebidaSalva ? ' · inclui bebida' : ''}` : 'Falta a classificação',
    pub: modo === 'publicado' ? 'No ar' : modo === 'analise' ? 'Em análise' : modo === 'fechado' ? rotuloDoModo(evento) : faltas.length === 0 ? 'Pronto para enviar' : faltas.length === 1 ? 'Falta 1 item' : `Faltam ${faltas.length} itens`,
  }
  const resumoFalta = (id: string) => !pronta(id) && !(id === 'pub' && modo !== 'rascunho' && modo !== 'recusado')

  const abrir = (id: string) => {
    if (guiado) setPasso(SECOES.findIndex(s => s.id === id))
    // com o guia, só a seção do passo (ao sair dele fica só ela, não um valor velho nem as já visitadas)
    setAbertas(a => (guiado ? [id] : a.includes(id) ? a : [...a, id]))
    setTimeout(() => {
      const cab = document.getElementById(`s-${id}`)
      cab?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
      cab?.focus({ preventScroll: true })
    }, 50)
  }

  function verTodas() {
    void registrar(GUIA, { skipped: true })
    setSaiuGuia(true)
    abrir(SECOES[passo].id) // o botão some: o foco vai ao título da seção
  }

  // ---- ingressos: gravação própria ----
  async function salvarIngressos() {
    setTentouIng(true)
    if (ings.some(i => temErro(errosDeIngresso(i)))) { toast.error('Corrija os ingressos marcados antes de salvar.'); return }
    setSalvandoIng(true)
    try {
      if (removidos.length > 0) {
        const { data, error } = await supabase.from('ticket_types').delete().in('id', removidos).eq('event_id', evento.id).select('id')
        if (error) throw error
        if ((data?.length ?? 0) !== removidos.length) throw new Error('Não foi possível remover um dos ingressos')
        setRemovidos([])
      }
      await atualizarIngressos.mutateAsync({
        eventId: evento.id, event: {},
        tickets: ings.map(i => ({
          id: i.novo ? undefined : i.id, name: i.nome.trim(), price: precoDe(i.preco) ?? 0, capacity: quantidadeDe(i.qtd) ?? 0,
          inclui_bebida: i.bebida, type: i.tipo as DbTicketType['type'],
        })),
      })
      const { data, error } = await supabase.from('ticket_types').select('*').eq('event_id', evento.id)
      if (error) throw error
      const novos = porCriacao((data ?? []) as DbTicketType[]).map(t => ingDoBanco(t, vendidosPorId[t.id] ?? 0))
      setIngs(novos); setIngsSalvos(novos); setTentouIng(false)
      void qc.invalidateQueries({ queryKey: ['painel-evento', evento.id] }) // o Match de Mesa aparece com o primeiro ingresso coletiva
      toast.success('Ingressos salvos.')
    } catch (err) {
      toast.error(erroDosIngressos(err))
    } finally {
      setSalvandoIng(false)
    }
  }

  async function alternarIngresso(g: Ing) {
    setAlternando(g.id)
    try {
      const { error } = await supabase.from('ticket_types').update({ is_active: !g.ativo } as never).eq('id', g.id).eq('event_id', evento.id).select('id').single()
      if (error) throw error
      const troca = (l: Ing[]) => l.map(i => (i.id === g.id ? { ...i, ativo: !g.ativo } : i))
      setIngs(troca); setIngsSalvos(troca)
      toast.success(g.ativo ? 'Ingresso oculto: não aparece mais para venda.' : 'Ingresso de volta à venda.')
    } catch {
      toast.error('Não foi possível mudar o ingresso. Tente de novo.')
    } finally {
      setAlternando(null)
    }
  }

  // ---- enviar ----
  const emEnvio = useRef(false) // o botão já fica travado (loading), mas o estado só muda no próximo render: duplo clique rápido
  // Divergência de hash: o texto do servidor não é o que a tela lia. Relê o evento e passa a tratar o do banco como o salvo,
  // para o próximo refazer funcionar sem recarregar a página.
  async function adotarDoBanco() {
    await recarregar()
    const fresco = qc.getQueryData<DbEvent | null>(['painel-evento', evento.id])
    if (!fresco) return
    const link = salvoRef.current.online_url
    guardaBase({ ...snapDoForm(formDoEvento(fresco, link ?? '')), online_url: link })
    setIngsSalvos(atual => porCriacao(fresco.ticket_types ?? []).map(t => ingDoBanco(t, vendidosPorId[t.id] ?? atual.find(i => i.id === t.id)?.vendidos ?? 0)))
  }
  const recarregar = () => Promise.all([qc.invalidateQueries({ queryKey: ['painel-evento', evento.id] }), qc.invalidateQueries({ queryKey: ['painel-aceite', evento.id] })])
  async function enviar() {
    if (emEnvio.current) return
    if (modo === 'publicado' && bloqueioDialogo) { setErroEnvio(bloqueioDialogo); return }
    emEnvio.current = true
    setEnviando(true); setErroEnvio('')
    try {
      const r = await enviarEvento({
        eventId: evento.id, soAceite,
        gravarPendentes: soAceite ? async () => undefined : gravarSerial, // refazer o aceite não grava conteúdo
        ingressosNaoSalvos: () => !soAceite && vivo.current.ingSujo,
        tela: { classificacao: classAceite, temBebida: temBebidaSalva }, textoAceito: textoDoAceite,
        aceitar: soAceite || modo === 'rascunho' || modo === 'recusado' || precisaAceiteNovo,
        publicar: modo === 'rascunho' || modo === 'recusado',
      })
      if (!r.ok) {
        setErroEnvio(r.erro)
        // Evento no ar: qualquer falha depois de começar a gravar pode ter deixado o banco em análise (até falha parcial:
        // o evento gravou e o link não). Relê para a tela dizer a verdade; o erro vai na faixa e no aviso.
        if (modo === 'publicado' && !soAceite) { setDialogo(false); toast.error(r.erro, { duration: 12000 }) }
        if (r.divergiu) await adotarDoBanco()
        else if (modo === 'publicado' && !soAceite) await recarregar()
        return
      }
      if (guiado) { void registrar(GUIA, { skipped: false, silencioso: true }); setAbertas(['pub']); abrir('pub') } // o envio já avisa o resultado; abrir devolve o foco (o botão Enviar some)
      await recarregar() // relê evento e último aceite ANTES de fechar: a faixa "Aceite pendente" não pode piscar depois do sucesso
      setDialogo(false); setSoAceite(false)
      toast.success(soAceite ? 'Aceite registrado.' : modo === 'publicado' ? 'Alterações enviadas para análise.' : 'Evento enviado para aprovação.')
      void qc.invalidateQueries({ queryKey: ['producer-events'] })
      void qc.invalidateQueries({ queryKey: ['public-event', evento.id] })
    } finally {
      emEnvio.current = false
      setEnviando(false)
    }
  }

  function descartar() {
    setForm(formDoSnap(salvoRef.current))
    if (capa) URL.revokeObjectURL(capa.previewUrl)
    setCapa(null); setRemovida(false); setAceiteDe(null); setErroEnvio('')
    // o botão Descartar some com a faixa: o foco vai para o título da página (senão cai no body)
    setTimeout(() => { const h1 = document.querySelector<HTMLElement>('h1'); if (h1) { h1.tabIndex = -1; h1.focus({ preventScroll: true }) } })
  }

  // ---- sair com mudanças que se perdem: não enviadas (evento no ar), não salvas (erro, gravando, capa) ou ingressos sem salvar ----
  const pendenteSalvar = autoAtivo && (temErro(diff) || capaPendente || estado === 'erro')
  const avisaSair = pendenteSalvar || moderado || ingSujo
  useEffect(() => {
    if (!avisaSair) return
    const antes = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', antes)
    return () => window.removeEventListener('beforeunload', antes)
  }, [avisaSair])
  useEffect(() => {
    if (!avisaSair) return
    // O projeto usa BrowserRouter: useBlocker não existe aqui. Captura o clique em link do app antes do roteador.
    const clique = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank' || a.hasAttribute('download')) return
      const u = new URL(a.href, window.location.href)
      if (u.origin !== window.location.origin || u.pathname + u.search === window.location.pathname + window.location.search) return
      e.preventDefault(); e.stopPropagation()
      setSaida(u.pathname + u.search + u.hash)
    }
    document.addEventListener('click', clique, true)
    return () => document.removeEventListener('click', clique, true)
  }, [avisaSair])
  const motivosSaida = [ingSujo && 'ingressos com mudanças não salvas', moderado && `alterações não enviadas (${alteracoes.join(', ')})`, pendenteSalvar && 'mudanças que ainda não foram salvas'].filter(Boolean).join('; ')

  // ---- menu "Mais ações" (as mesmas regras de Meus eventos) ----
  // a cópia sai do que está salvo: com alteração não enviada ou ingresso não salvo, o botão fica desligado
  function duplicar() {
    if (window.confirm(confirmacaoDuplicar(evento.title))) void duplicarEv(evento)
  }
  async function excluirRascunho() {
    if (!window.confirm(`Excluir o evento "${evento.title}"? Esta ação não pode ser desfeita.`)) return
    excluindo.current = true // o salvamento automático não grava um evento que está sendo apagado
    try {
      await excluir.mutateAsync(evento.id)
      toast.success('Evento excluído.')
      navigate('/producer/events')
    } catch (err) {
      excluindo.current = false
      toast.error(erroAoExcluir(err, vendidosTotal).mensagem)
    }
  }

  const nome = form.title.trim() || 'Evento sem nome'
  const linhaData = [form.inicioD ? [dataComSemana(form.inicioD), horaCurta(form.inicioH)].filter(Boolean).join(' · ') : 'sem data', form.local_modo === 'a_definir' ? 'local a definir' : form.local_modo === 'online' ? 'online' : form.venue_city || form.venue_name].filter(Boolean).join(' · ')
  const cor = form.accent_color ?? corDoEvento(evento)
  const classificacaoNova = CLASSIFICACOES.find(c => c.valor === classAceite)
  const aceiteTrava = !esporte && !form.classificacao

  // Prévia: o que está na tela (não salvo), sem travar a digitação. Só memória: nada vai ao navegador nem ao banco.
  const capaPrevia = capa?.previewUrl ?? (removida ? null : urlAtual)
  const previaEvento = useDeferredValue(useMemo(() => ({ ...eventoDaPrevia(form, ings, { evento, capaUrl: capaPrevia }), accent_color: cor }), [form, ings, evento, capaPrevia, cor]))

  const corpo = (id: string) => {
    switch (id) {
      case 'oque': return <SecaoOQueE f={form} set={set} erroNome={erroNome} />
      case 'quando': return <SecaoQuandoOnde f={form} set={set} travado={travado} erros={erros} />
      case 'img': return (
        <CapaEventoCampo
          evento={{ id: evento.id, title: form.title, date: form.inicioD }}
          urlAtual={removida ? null : urlAtual} capa={capa} onCapa={setCapa}
          onRemover={() => setRemovida(temFoto(urlAtual))}
          cor={cor} corManual={corManual} onCor={(valor, manual) => { set({ accent_color: valor }); if (manual) setCorManual(true) }}
          ocupado={enviando} avisoAnalise={modo === 'publicado'}
        />
      )
      case 'ing': return (
        <SecaoIngressos
          ings={ings} setIngs={setIngs} sujo={ingSujo} salvando={salvandoIng} tentou={tentouIng} onSalvar={() => void salvarIngressos()}
          onRemover={g => { if (!g.novo) setRemovidos(r => [...r, g.id]); setIngs(l => l.filter(i => i.id !== g.id)) }}
          onAlternar={g => void alternarIngresso(g)} alternando={alternando} classificacao={form.classificacao} aDefinir={form.local_modo === 'a_definir'}
        />
      )
      case 'regras': return <SecaoRegras f={form} set={set} bebidaN={ingsSalvos.filter(i => i.bebida).length} ingressosN={ingsSalvos.length} ingSujo={ingSujo} />
      default: return (
        <SecaoPublicar
          modo={modo} faltas={faltas} onIr={abrir} aceiteTexto={textoDoAceite} aceiteMarcado={aceiteMarcado} aceiteTrava={aceiteTrava}
          onAceite={v => setAceiteDe(v ? textoDoAceite : null)} onEnviar={() => void enviar()} enviando={enviando} erroEnvio={erroEnvio}
          noArDesde={evento.approved_at ? new Date(evento.approved_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', timeZone: 'America/Sao_Paulo' }) : undefined}
        />
      )
    }
  }

  return (
    <div className="mx-auto max-w-3xl min-[1180px]:grid min-[1180px]:max-w-6xl min-[1180px]:grid-cols-[minmax(0,1fr)_316px] min-[1180px]:gap-10">
      <div className="min-w-0">
      <PageHeader
        title={nome}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground"><span aria-hidden="true" className={cn('size-2 rounded-full', PONTO[modo])} />{rotuloDoModo(evento)}</span>
            <span aria-hidden="true">·</span><span>{linhaData}</span>
          </span>
        }
        actions={
          <>
            <span role="status" aria-live="polite" className={cn('inline-flex h-8 items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground', estado === 'erro' && 'text-destructive')}>
              {autoAtivo && estado === 'salvando' && <><span aria-hidden="true" className="size-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent motion-reduce:animate-none" />Salvando…</>}
              {autoAtivo && estado === 'salvo' && <><I.Check size={14} aria-hidden="true" />{modo === 'publicado' ? 'Salvo: vale na hora' : 'Salvo'}</>}
              {autoAtivo && estado === 'erro' && <><I.Erro size={14} aria-hidden="true" />Não salvou. <button type="button" className="underline" onClick={() => void tentarDeNovo()}>Tentar de novo</button></>}
            </span>
            <Button asChild variant="outline">
              <a href={siteUrl(`/event/${evento.id}`)} target="_blank" rel="noopener noreferrer"><I.AbrirExterno aria-hidden="true" />Ver página<span className="sr-only"> (abre em nova aba)</span></a>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Mais ações: duplicar, orçamento, excluir rascunho"><I.Mais aria-hidden="true" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => duplicar()} disabled={duplicando || alteracoes.length > 0 || ingSujo}><I.Copiar size={16} aria-hidden="true" />Duplicar</DropdownMenuItem>
                <DropdownMenuItem asChild><Link to={hrefDaTela('/producer/caixinha', evento.id)}><I.Financeiro size={16} aria-hidden="true" />Montar o orçamento</Link></DropdownMenuItem>
                {(modo === 'rascunho' || modo === 'recusado') && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => void excluirRascunho()} disabled={excluir.isPending}><I.Lixeira size={16} aria-hidden="true" />Excluir rascunho</DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <PreviaFolha evento={previaEvento} />

      <div className="mb-4 grid gap-3 empty:hidden">
        {modo === 'recusado' && (
          <Faixa tom="erro" titulo="A equipe recusou o envio" acoes={<Button variant="outline" size="sm" onClick={() => abrir('pub')}>Ir para Publicar</Button>}>
            Motivo: “{evento.rejection_reason || 'Nenhuma justificativa fornecida.'}”
          </Faixa>
        )}
        {modo === 'analise' && (
          <Faixa tom="info" titulo="Em análise pela equipe">
            Você pode continuar editando: tudo é salvo e a equipe aprova a versão mais recente. Se você mudar algo depois que ela abrir o evento, ela recarrega antes de aprovar.
          </Faixa>
        )}
        {modo === 'fechado' && <Faixa tom="info" titulo={`Este evento está ${rotuloDoModo(evento).toLowerCase()}`}>Ele não pode mais ser editado por aqui.</Faixa>}
        {aceiteDefasado && (
          <Faixa
            tom="atencao" titulo="Aceite pendente"
            acoes={<Button size="sm" onClick={() => { setErroEnvio(''); setAceiteDe(null); setSoAceite(true); setDialogo(true) }}>{semAceite ? 'Registrar o aceite' : 'Refazer o aceite'}</Button>}
          >
            {semAceite
              ? 'Este evento ainda não tem aceite do produtor registrado.'
              : 'A classificação ou a bebida dos ingressos não é a do último aceite registrado (ou o texto do aceite mudou).'}
            {moderado ? ' Há alterações não enviadas: o envio delas para análise já refaz o aceite.' : ' Refaça o aceite; isso não muda o evento.'}
            {erroEnvio && <span role="alert" className="mt-1 block text-destructive">{erroEnvio}</span>}
          </Faixa>
        )}
        {alteracoes.length > 0 && (
          <Faixa
            tom="atencao" titulo={`Alterações não enviadas: ${alteracoes.join(', ')}`}
            acoes={<><Button variant="ghost" size="sm" onClick={descartar}>Descartar</Button><Button size="sm" onClick={() => { setErroEnvio(''); setAceiteDe(null); setSoAceite(false); setDialogo(true) }}>Enviar alterações para análise</Button></>}
          >
            Nada muda na página até você enviar. Ao enviar, o evento sai da vitrine e da busca até a equipe aprovar. Ingressos salvos valem na hora.
          </Faixa>
        )}
      </div>

      {guiado && (
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span aria-live="polite" className="text-[13px] font-semibold leading-5 text-foreground">Passo {passo + 1} de {SECOES.length} · {SECOES[passo].nome}</span>
          <span aria-hidden="true" className="flex max-w-60 flex-1 gap-1">
            {SECOES.map((s, i) => <span key={s.id} className={cn('h-1 flex-1 rounded-sm', i <= passo ? 'bg-foreground' : 'bg-secondary')} />)}
          </span>
          <Button variant="ghost" size="sm" onClick={verTodas}>Ver todas as seções</Button>
        </div>
      )}
      {modo !== 'fechado' && !guiado && !(modo === 'rascunho' && !carregou) && (
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span><span className="font-display text-[22px] font-semibold leading-7 tabular-nums">{prontos} de {lista.length}</span> <span className="text-sm text-muted-foreground">prontos</span></span>
          <span role="progressbar" aria-label="Itens prontos" aria-valuemin={0} aria-valuemax={lista.length} aria-valuenow={prontos} className="h-2 min-w-24 flex-1 overflow-hidden rounded bg-secondary">
            <span className="block h-full origin-left rounded bg-foreground transition-transform motion-reduce:transition-none" style={{ transform: `scaleX(${prontos / lista.length})` }} />
          </span>
          {prontos < lista.length
            ? <Button variant="link" size="sm" onClick={() => abrir(SECAO_DA_PENDENCIA[lista.find(p => !p.pronto)!.id])}>Ver o que falta</Button>
            : <span className="text-[13px] text-muted-foreground">Tudo pronto</span>}
        </div>
      )}

      <Accordion
        type="multiple" value={guiado ? [SECOES[passo].id] : abertas}
        onValueChange={guiado ? v => { const n = v.find(i => i !== SECOES[passo].id); if (n) abrir(n) } : setAbertas} className="border-t border-border"
      >
        {SECOES.map(s => {
          const ok = pronta(s.id)
          const falta = resumoFalta(s.id)
          return (
            <AccordionItem key={s.id} value={s.id}>
              <AccordionTrigger id={`s-${s.id}`} className="min-h-16 min-w-0 items-center px-2 py-2 hover:no-underline">
                <span aria-hidden="true" className={cn('grid size-5 shrink-0 place-items-center rounded-full', ok ? 'bg-[var(--ev-success)] text-background' : 'ring-[1.5px] ring-inset ring-[var(--ev-warning)]')}>
                  {ok ? <I.Check size={12} /> : <span className="size-1.5 rounded-full bg-[var(--ev-warning)]" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold leading-5 text-foreground">{s.nome}<span className="sr-only">{ok ? ', pronto' : falta ? ', falta algo' : ''}</span></span>
                  <span className={cn('block truncate text-[13px] font-normal leading-5', falta ? 'text-[var(--ev-warning)]' : 'text-muted-foreground')}>{resumos[s.id]}</span>
                </span>
                {s.id === 'quando' && travado && <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-normal text-muted-foreground"><I.Cadeado size={14} aria-hidden="true" />Travado: há ingressos vendidos</span>}
              </AccordionTrigger>
              <AccordionContent className="px-2 pb-6 pt-1">
                <fieldset disabled={somenteLeitura || enviando} className="m-0 min-w-0 border-0 p-0">{corpo(s.id)}</fieldset>
                {guiado && (
                  <div className="mt-4 flex justify-end gap-2">
                    {passo > 0 && <Button variant="ghost" onClick={() => abrir(SECOES[passo - 1].id)}>Voltar</Button>}
                    {s.id !== 'pub' && <Button variant="secondary" onClick={() => abrir(SECOES[passo + 1].id)}>Próximo</Button>}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>

      {/* Match de Mesa: só com ingresso coletiva (o painel só abre para o dono) */}
      {evento.ticket_types?.some(t => t.type === 'coletiva') && <MatchDeMesaPanel eventId={evento.id} />}

      <Dialog open={dialogo} onOpenChange={o => { if (!enviando) setDialogo(o) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{soAceite ? 'Refazer o aceite?' : 'Enviar alterações para análise?'}</DialogTitle>
            <DialogDescription>
              {soAceite
                ? moderado
                  ? `Há alterações não enviadas (${alteracoes.join(', ')}). O aceite não grava conteúdo: para registrar o aceite, envie as alterações para análise; o envio já inclui o aceite.`
                  : 'O aceite registra a classificação e a bebida que estão salvas no evento. O evento não muda.'
                : `Enquanto a equipe analisa, ${nome} sai da vitrine e da busca. Quem já comprou continua vendo a página e o ingresso.`}
            </DialogDescription>
          </DialogHeader>
          {!soAceite && <p className="text-sm text-foreground">Vai para análise: {alteracoes.join(', ')}.</p>}
          {aceiteNoDialogo && !(soAceite && moderado) && (
            <div className="grid gap-2 rounded-[10px] bg-secondary p-4">
              <p id="dlg-ac" className="text-sm font-medium text-foreground">
                {semAceite
                  ? 'Este evento ainda não tem aceite do produtor registrado: faça o aceite'
                  : `A classificação ou a bebida mudou depois do último aceite: refaça o aceite com a classificação ${classificacaoNova?.valor ?? 'sem classificação'}`}
              </p>
              <details className="text-[13px] text-muted-foreground">
                <summary className="cursor-pointer">Ver o texto do aceite</summary>
                <p className="mt-1 whitespace-pre-line">{textoDoAceite}</p>
              </details>
              <div className="flex items-start gap-2">
                <Checkbox id="dlg-aceite" checked={aceiteMarcado} onCheckedChange={v => setAceiteDe(v === true ? textoDoAceite : null)} className="mt-0.5" />
                <Label htmlFor="dlg-aceite" className="font-normal">Li e aceito o termo do produtor{classificacaoNova ? ` com a classificação ${classificacaoNova.valor}` : ''}</Label>
              </div>
            </div>
          )}
          {(erroEnvio || bloqueioDialogo) && <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive"><I.Erro size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{erroEnvio || bloqueioDialogo}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogo(false)} disabled={enviando}>Cancelar</Button>
            {soAceite && moderado ? (
              <Button onClick={() => { setSoAceite(false); setAceiteDe(null) }}>Enviar alterações para análise</Button>
            ) : (
              <Button loading={enviando} aria-disabled={(aceiteNoDialogo && !aceiteMarcado) || !!bloqueioDialogo || undefined} aria-describedby={aceiteNoDialogo && !aceiteMarcado ? 'dlg-ac' : undefined}
                onClick={() => { if ((!aceiteNoDialogo || aceiteMarcado) && !bloqueioDialogo) void enviar() }}>{soAceite ? 'Registrar o aceite' : 'Enviar para análise'}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={saida !== null} onOpenChange={o => { if (!o) setSaida(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{moderado ? 'Sair sem enviar?' : 'Sair sem salvar?'}</DialogTitle>
            <DialogDescription>
              Há {motivosSaida} em {nome}. Se sair agora, o que não foi salvo ou enviado se perde.{pendenteSalvar ? ' O painel tenta salvar de novo ao sair; se falhar, a mudança se perde.' : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { const destino = saida; setSaida(null); if (destino) navigate(destino) }}>{moderado || ingSujo ? 'Sair e perder' : 'Sair mesmo assim'}</Button>
            <Button variant="outline" onClick={() => setSaida(null)}>Continuar editando</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
      <PreviaMoldura evento={previaEvento} />
    </div>
  )
}
