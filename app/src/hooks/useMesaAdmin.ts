import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { rpc, type MotivoDenuncia } from './useMatchmaking'
import { useAuth } from './useAuth'

// Match de Mesa, lado do produtor e do moderador (admin com moderate_mesa e sessão aal2). Só funções do
// banco (docs/sql/20261003_mesa_coletiva.sql): elas recusam com erro (22023/42501) em vez de devolver
// zero linhas, por isso não há `.select()` a conferir aqui.

// ============================================================
// Tipos (formato exato do JSON das funções)
// ============================================================

// mesas_do_evento: nome completo e ingresso, um por cadeira (o produtor acomoda as pessoas)
export interface MesaDoEvento {
  numero: number
  nome: string
  capacidade: number
  // nome do dono atual; '(sem nome no perfil)' se vazio. pode_remover: só quem tem denúncia no evento
  // (para o produtor, só liberada a ele); o banco recusa a remoção dos outros (22023)
  membros: { nome: string; ingresso: string; pode_remover: boolean }[]
}

// mesa_denuncias_do_evento, visão do moderador
export interface DenunciaModerador {
  id: string
  criado_em: string
  motivo: MotivoDenuncia
  detalhe: string | null
  status: StatusDenuncia
  mesa: string | null
  denunciante: string | null
  denunciado: string | null
  mesma_mesa: boolean
  sobreposicao_inicio: string | null
  sobreposicao_fim: string | null
  status_mudado_em: string | null
  liberada_produtor_em: string | null
  resultado: ResultadoDenuncia | null
  resultado_explicacao: string | null // apagada 180 dias depois do evento
}

// mesa_denuncias_do_evento, visão do produtor (só as liberadas)
export interface DenunciaProdutor {
  denunciado: string | null
  motivo: MotivoDenuncia
  mesa: string | null
  resultado: ResultadoDenuncia | null // sem a explicação
}

export interface MesaTrava {
  id: string
  pessoa: string | null
  motivo: MotivoRemocao
  detalhe: string | null
  por: string | null
  em: string
  destravada_em: string | null
  destravada_por: string | null
  denuncia_id: string | null
  denuncia_motivo: MotivoDenuncia | null
  denuncia_resultado: ResultadoDenuncia | null
}

export interface FotoParaRevisar {
  id: string
  nome: string | null
  foto: string
  hash: string
  situacao: 'pendente' | 'revisar'
  // última decisão da moderação automática para esta mesma foto (null = a IA não viu)
  ia: { decisao: DecisaoIa; motivos: string[]; em: string } | null
  // a pessoa contestou a recusa automática (mesa_foto_contestar)
  contestada: boolean
}

export type StatusDenuncia = 'aberta' | 'em_apuracao' | 'resolvida' | 'judicial'
export type ResultadoDenuncia = 'procedente' | 'improcedente'
export type MotivoRemocao = 'denuncia_triada' | 'comportamento_no_local' | 'pedido_da_pessoa' | 'outro'

// Listas fechadas do banco (CHECK de mesa_denuncias e mesa_travas)
export const STATUS_DENUNCIA: Record<StatusDenuncia, string> = {
  aberta: 'Aberta',
  em_apuracao: 'Em apuração',
  resolvida: 'Resolvida',
  judicial: 'Judicial',
}

export const RESULTADO_DENUNCIA: Record<ResultadoDenuncia, string> = {
  procedente: 'Procedente (a denúncia era verdadeira)',
  improcedente: 'Improcedente (a denúncia não se confirmou)',
}
// o banco aceita a explicação de 10 a 1000 caracteres
export const EXPLICACAO_MIN = 10
export const EXPLICACAO_MAX = 1000
// tira os caracteres que o CHECK do banco recusa (controle e direção de texto), sem os espaços nem quebras de linha
// eslint-disable-next-line no-control-regex
export const limparTexto = (t: string) => t.replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
// o banco conta caracteres (não unidades UTF-16) e exige ao menos uma letra ou número
export const explicacaoValida = (t: string) => {
  const n = [...limparTexto(t).trim()].length
  return n >= EXPLICACAO_MIN && n <= EXPLICACAO_MAX && /[\p{L}\p{Nd}]/u.test(t)
}

export const MOTIVO_REMOCAO: Record<MotivoRemocao, string> = {
  denuncia_triada: 'Denúncia apurada',
  comportamento_no_local: 'Comportamento no local',
  pedido_da_pessoa: 'Pedido da própria pessoa',
  outro: 'Outro',
}

// CHECK de mesa_moderacoes (decisao sem 'contestada', que o banco não devolve em "ia"; e motivos)
export type DecisaoIa = 'aprovada' | 'recusada' | 'revisar' | 'erro'
export const DECISAO_IA: Record<DecisaoIa, string> = {
  aprovada: 'IA aprovou',
  recusada: 'IA recusou',
  revisar: 'IA em dúvida',
  erro: 'IA com erro',
}
export const MOTIVO_IA: Record<string, string> = {
  nudez: 'nudez',
  violencia: 'violência',
  odio: 'discurso de ódio',
  politica: 'conteúdo político',
  drogas: 'drogas',
  sem_rosto: 'sem rosto',
  famoso: 'parece pessoa pública',
  texto_contato: 'contato escrito',
  bloqueio_seguranca: 'bloqueada pelo filtro do Google',
  formato: 'formato não aceito',
  outro: 'outro motivo',
}

export const precisa2fa = (err: unknown) => /^Ative o 2FA/.test((err as Error | null)?.message ?? '')

// 23514 = CHECK do banco (texto fora do tamanho ou com caractere de controle; vale para o detalhe e para a
// explicação do resultado, que têm limites diferentes: a mensagem é genérica).
// 42501 sem ser o do 2FA = "Acesso negado": nem produtor do evento nem moderador.
export function erroMesaAdmin(err: unknown): string {
  const e = err as { code?: string; message?: string } | null
  if (e?.code === '42501' && !precisa2fa(err)) {
    return 'Sem permissão: só o produtor do evento e quem tem a permissão "Moderar Match de Mesa" (com 2FA) acessam o Match de Mesa.'
  }
  if (e?.code === '22023' && /^Só é possível remover/.test(e.message ?? '')) return 'Só é possível remover quem tem denúncia neste evento.'
  if (e?.code === '23514') return 'Texto fora do tamanho permitido ou com caractere não aceito.'
  return e?.message || 'Não foi possível concluir agora. Tente de novo em instantes.'
}

// Recusa do banco (42501, 22023) não muda tentando de novo: mostra na hora; falha de rede tenta 2 vezes
const retry = (n: number, e: unknown) => !(e as { code?: string } | null)?.code && n < 2

// ============================================================
// Leituras
// ============================================================

// user.id nas chaves: outra conta na mesma aba não vê o cache da anterior
export function useMesasDoEvento(eventId: string | null) {
  const { user } = useAuth()
  return useQuery<MesaDoEvento[]>({
    queryKey: ['mesas-do-evento', eventId, user?.id],
    queryFn: () => rpc<MesaDoEvento[]>('mesas_do_evento', { p_event_id: eventId }),
    enabled: !!eventId && !!user?.id,
    retry,
  })
}

// Mesma função para o produtor e o moderador; o banco escolhe a visão pela permissão. Chaves separadas
// por visão para uma nunca aparecer no lugar da outra.
export function useMesaDenuncias<V extends 'moderador' | 'produtor'>(visao: V, eventId: string | null) {
  const { user } = useAuth()
  type T = V extends 'moderador' ? DenunciaModerador : DenunciaProdutor
  return useQuery<T[]>({
    queryKey: ['mesa-denuncias', visao, eventId, user?.id],
    queryFn: () => rpc<T[]>('mesa_denuncias_do_evento', { p_event_id: eventId }),
    enabled: !!eventId && !!user?.id,
    retry,
  })
}

export function useMesaTravas(eventId: string | null) {
  const { user } = useAuth()
  return useQuery<MesaTrava[]>({
    queryKey: ['mesa-travas', eventId, user?.id],
    queryFn: () => rpc<MesaTrava[]>('mesa_travas_do_evento', { p_event_id: eventId }),
    enabled: !!eventId && !!user?.id,
    retry,
  })
}

export function useFotosParaRevisar() {
  const { user } = useAuth()
  return useQuery<FotoParaRevisar[]>({
    queryKey: ['mesa-fotos', user?.id],
    queryFn: () => rpc<FotoParaRevisar[]>('mesa_fotos_para_revisar'),
    enabled: !!user?.id,
    retry,
  })
}

// ============================================================
// Ações (cada uma relê as listas que muda)
// ============================================================

function useMesaAdminMutation<A, R = void>(chaves: string[], fn: (a: A) => Promise<R>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      for (const key of chaves) queryClient.invalidateQueries({ queryKey: [key] })
    },
  })
}

// Devolve quantas pessoas entraram nas mesas nesta chamada
export function useFormarMesas(eventId: string) {
  return useMesaAdminMutation(['mesas-do-evento'], () => rpc<number>('formar_mesas', { p_event_id: eventId }))
}

export function useRemoverMembro(eventId: string) {
  return useMesaAdminMutation(['mesas-do-evento', 'mesa-travas'], (d: { ingresso: string; motivo: MotivoRemocao; detalhe: string }) =>
    rpc('mesa_remover_membro', {
      p_event_id: eventId, p_ticket_id: d.ingresso, p_motivo: d.motivo, p_detalhe: d.detalhe.trim() || null,
    }))
}

export function useDenunciaStatus() {
  // 'resolvida' exige resultado e explicação; nos outros status os dois não vão
  return useMesaAdminMutation(['mesa-denuncias', 'mesa-travas'], (d: { id: string; status: StatusDenuncia; resultado?: ResultadoDenuncia; explicacao?: string }) =>
    rpc('mesa_denuncia_status', d.status === 'resolvida'
      ? { p_id: d.id, p_status: d.status, p_resultado: d.resultado, p_explicacao: d.explicacao === undefined ? undefined : limparTexto(d.explicacao).trim() }
      : { p_id: d.id, p_status: d.status }))
}

export function useDenunciaLiberar() {
  return useMesaAdminMutation(['mesa-denuncias'], (id: string) => rpc('mesa_denuncia_liberar', { p_id: id }))
}

export function useMesaDestravar(eventId: string | null) {
  return useMesaAdminMutation(['mesa-travas'], (travaId: string) =>
    rpc('mesa_destravar', { p_event_id: eventId, p_trava_id: travaId }))
}

// false = a foto mudou depois da fila (hash antigo) ou já foi decidida
export function useFotoDecidir() {
  return useMesaAdminMutation(['mesa-fotos'], (d: { user: string; hash: string; aprovada: boolean }) =>
    rpc<boolean>('mesa_foto_decidir', { p_user: d.user, p_hash: d.hash, p_aprovada: d.aprovada }))
}
