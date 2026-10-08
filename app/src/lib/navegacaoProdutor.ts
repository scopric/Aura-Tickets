// Mapa das 30 telas do produtor na lateral por escopo (fase V4a; porte de refs/navegacao/codigo/evokaa-mapa-navegacao.mjs).
// Escopo "produtora": todas as telas, cada uma na sua seção. Escopo "evento": só as que têm `noEvento`, já com o
// evento na URL. Rotas reais do App.tsx (o teste confere). Tela que não existe fica fora (Decisão 22).
import { matchPath } from 'react-router' // mesma implementação do react-router-dom; o dom não exporta o tipo neste ambiente (TS2305)

export type Escopo = 'produtora' | 'evento'

export const SECOES = ['Topo', 'Eventos', 'Vendas', 'Público', 'Operação', 'Financeiro', 'Conta'] as const
export type Secao = (typeof SECOES)[number]

export interface Tela {
  tela: string
  secao: Secao
  rota: string
  /** Texto na lateral da produtora (padrão: `tela`) */
  rotulo?: string
  /** A tela também aparece na lateral do evento, com este texto */
  noEvento?: string
}

// 30 telas na lista (Central de comando, Decisão 197, só na produtora e só para o dono) + o botão "+" (Criar evento, ROTA_CRIAR_EVENTO): as 28 do mapa do estudo mais o Borderô (E5, Decisão 153), os Participantes, os Ingressos e a Divulgação (hub Links e QR; Afiliados, Banners e Lista de interesse seguem como itens e ganham a faixa de abas).
// Decisão 143 (desvio do contrato §6.4): Banners, Lista de interesse, Galeria, Tarefas e CRM ficam só no escopo da
// produtora até terem filtro por evento. Cupons, Afiliados, Cardápio, Orçamento e Resumo aparecem no escopo do evento
// e filtram pelo ?eventId= (V4a2, useFiltroEvento).
export const NAV: Tela[] = [
  { tela: 'Início', secao: 'Topo', rota: '/producer/dashboard' },
  { tela: 'Meus eventos', secao: 'Eventos', rota: '/producer/events', rotulo: 'Todos os eventos' },
  // A Pasta do evento é a Visão geral (V7, EventOverview); a edição fica no botão "Editar" dela.
  { tela: 'Pasta do evento', secao: 'Eventos', rota: '/producer/event/:eventId', noEvento: 'Visão geral' },
  { tela: 'Central de comando', secao: 'Eventos', rota: '/producer/central' },
  { tela: 'Relatório pós-evento', secao: 'Eventos', rota: '/producer/pos-evento', rotulo: 'Relatórios', noEvento: 'Relatório' },
  { tela: 'Ingressos', secao: 'Vendas', rota: '/producer/ingressos', noEvento: 'Ingressos' },
  { tela: 'Cupons', secao: 'Vendas', rota: '/producer/cupons', noEvento: 'Cupons' },
  { tela: 'Divulgação', secao: 'Vendas', rota: '/producer/divulgacao', noEvento: 'Divulgação' },
  { tela: 'Afiliados', secao: 'Vendas', rota: '/producer/afiliados', noEvento: 'Afiliados' },
  { tela: 'Banners', secao: 'Vendas', rota: '/producer/banners' },
  { tela: 'Lista de interesse', secao: 'Vendas', rota: '/producer/lista-interesse' },
  { tela: 'Lugar marcado', secao: 'Vendas', rota: '/producer/lugar-marcado', noEvento: 'Lugar marcado' },
  { tela: 'CRM', secao: 'Público', rota: '/producer/crm' },
  { tela: 'Participantes', secao: 'Público', rota: '/producer/participantes', noEvento: 'Participantes' },
  { tela: 'Check-in', secao: 'Público', rota: '/producer/checkin', noEvento: 'Check-in' },
  { tela: 'Certificados', secao: 'Público', rota: '/producer/certificados', noEvento: 'Certificados' },
  { tela: 'Galeria', secao: 'Público', rota: '/producer/galeria' },
  { tela: 'Cronograma', secao: 'Operação', rota: '/producer/timeline', noEvento: 'Cronograma' },
  { tela: 'Tarefas', secao: 'Operação', rota: '/producer/tarefas' },
  { tela: 'Cardápio', secao: 'Operação', rota: '/producer/menu', noEvento: 'Cardápio' },
  { tela: 'Equipe', secao: 'Operação', rota: '/producer/team' },
  { tela: 'Parceiros', secao: 'Operação', rota: '/producer/parceiros' },
  { tela: 'Financeiro', secao: 'Financeiro', rota: '/producer/finance', rotulo: 'Resumo', noEvento: 'Resumo' },
  { tela: 'Borderô', secao: 'Financeiro', rota: '/producer/bordero', noEvento: 'Borderô' },
  { tela: 'Carteira', secao: 'Financeiro', rota: '/producer/wallet' },
  { tela: 'Orçamento do evento', secao: 'Financeiro', rota: '/producer/caixinha', rotulo: 'Orçamento', noEvento: 'Orçamento' },
  { tela: 'Calculadora de preço', secao: 'Financeiro', rota: '/producer/calculator' },
  { tela: 'Calculadora de mesas', secao: 'Financeiro', rota: '/producer/tables' },
  { tela: 'Configurações', secao: 'Conta', rota: '/producer/settings' },
  { tela: 'Ajuda', secao: 'Conta', rota: '/producer/faq' },
  { tela: 'App do organizador', secao: 'Conta', rota: '/producer/app' },
]

const porNome = (nome: string) => NAV.find(t => t.tela === nome)!

/** Início é item solto (fora das seções); "Criar evento" é o botão "+", não item */
export const INICIO = porNome('Início')
export const ROTA_CRIAR_EVENTO = '/producer/events/new'

/** A rota é a da tela atual (a raiz /producer conta como Início); a lateral e a folha Menu usam a mesma regra */
export function rotaAtiva(rota: string, pathname: string): boolean {
  return rota.includes(':')
    ? rotasDaTela(rota).some(r => !!matchPath(r, pathname))
    : pathname === rota || pathname.startsWith(rota + '/') || (rota === INICIO.rota && pathname === '/producer')
}
const PASTA = porNome('Pasta do evento')

/** Telas de uma seção no escopo pedido. No evento, só as que têm `noEvento`; `Topo` nunca entra (item solto);
 *  na produtora a Pasta do evento também não: ela é a linha de cada evento da lista */
export function filtra(escopo: Escopo, secao: Secao): Tela[] {
  if (secao === 'Topo') return []
  return NAV.filter(t => t.secao === secao && (escopo === 'evento' ? t.noEvento : t !== PASTA))
}

export const textoDaTela = (t: Tela, escopo: Escopo) => (escopo === 'evento' ? t.noEvento : t.rotulo) ?? t.tela

/** Nome da seção na lateral e na busca: no escopo do evento, "Eventos" vira "Evento" */
export const rotuloSecao = (escopo: Escopo, s: Secao) => (escopo === 'evento' && s === 'Eventos' ? 'Evento' : s)

/** No evento, "Conta" não tem telas por evento: mostra as da produtora (senão o celular e a busca não chegariam em Configurações) */
export const telasDe = (escopo: Escopo, s: Secao) => { const t = filtra(escopo, s); return t.length || s !== 'Conta' ? t : filtra('produtora', s) }

/** Minúscula e sem acento: o filtro da folha Menu e o da busca ⌘K */
export const normaliza = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** ⌘K no Mac (e iPhone/iPad), Ctrl K nos demais: o rótulo e a tecla que a busca captura */
export const noMac = () => /Mac|iPhone|iPad/.test(navigator.userAgent)
export const atalhoBusca = () => (noMac() ? '⌘K' : 'Ctrl K')

/** Link da tela: `:eventId` na rota é trocado pelo id; sem `:eventId`, o id vai em `?eventId=` */
export function hrefDaTela(rota: string, eventId?: string | null): string {
  if (!eventId) return rota
  return rota.includes(':eventId') ? rota.replace(':eventId', encodeURIComponent(eventId)) : `${rota}?eventId=${encodeURIComponent(eventId)}`
}

/** Para onde vai quem abre um evento (linha da lista, bloco do evento) */
export const abreEvento = (eventId: string) => hrefDaTela(PASTA.rota, eventId)

// Rotas em que o evento vem no caminho (a edição e a Visão geral)
const ROTA_EDICAO = '/producer/events/:eventId/edit'
const ROTAS_COM_EVENTO = [ROTA_EDICAO, '/producer/event/:eventId']

/** Rotas que a lateral conta como a tela da rota dada: a edição do evento fica sob a Visão geral */
export const rotasDaTela = (rota: string): string[] => (rota === PASTA.rota ? [rota, ROTA_EDICAO] : [rota])

/** Evento da URL: `:eventId` do caminho ou `?eventId=`. null quando a URL não é de um evento */
export function eventoDaUrl(pathname: string, search: string): string | null {
  for (const r of ROTAS_COM_EVENTO) {
    const id = matchPath(r, pathname)?.params.eventId
    if (id) return id
  }
  return new URLSearchParams(search).get('eventId') || null
}

/** Mesma tela, outro evento (troca de evento sem sair da tela). Tela fora do mapa cai na abertura do evento */
export function trocaEvento(pathname: string, novoId: string): string {
  const tela = NAV.find(t => matchPath(t.rota, pathname))
  return tela?.noEvento ? hrefDaTela(tela.rota, novoId) : abreEvento(novoId)
}

// Lembrança da pessoa em localStorage (evk.nav.*): sempre com try/catch; se falhar, a lateral começa aberta e sem fixados
const CHAVE = 'evk.nav.'
export function lerNav(nome: string): string | null {
  try { return localStorage.getItem(CHAVE + nome) } catch { return null }
}
export function gravarNav(nome: string, valor: string | null): void {
  try { if (valor === null) localStorage.removeItem(CHAVE + nome); else localStorage.setItem(CHAVE + nome, valor) } catch { /* sem armazenamento: só não lembra */ }
}
export function lerFixados(): string[] {
  try {
    const v: unknown = JSON.parse(lerNav('fixados') ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch { return [] }
}
export const ULTIMO_EVENTO = 'ultimoEvento'
