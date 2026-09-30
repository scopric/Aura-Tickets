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
  membros: { nome: string; ingresso: string }[] // nome do dono atual; '(sem nome no perfil)' se vazio
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
}

// mesa_denuncias_do_evento, visão do produtor (só as liberadas)
export interface DenunciaProdutor {
  denunciado: string | null
  motivo: MotivoDenuncia
  mesa: string | null
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
}

export interface FotoParaRevisar {
  id: string
  nome: string | null
  foto: string
  hash: string
  situacao: 'pendente' | 'revisar'
}

export type StatusDenuncia = 'aberta' | 'em_apuracao' | 'resolvida' | 'judicial'
export type MotivoRemocao = 'denuncia_triada' | 'comportamento_no_local' | 'pedido_da_pessoa' | 'outro'

// Listas fechadas do banco (CHECK de mesa_denuncias e mesa_travas)
export const STATUS_DENUNCIA: Record<StatusDenuncia, string> = {
  aberta: 'Aberta',
  em_apuracao: 'Em apuração',
  resolvida: 'Resolvida',
  judicial: 'Judicial',
}

export const MOTIVO_REMOCAO: Record<MotivoRemocao, string> = {
  denuncia_triada: 'Denúncia apurada',
  comportamento_no_local: 'Comportamento no local',
  pedido_da_pessoa: 'Pedido da própria pessoa',
  outro: 'Outro',
}

export const precisa2fa = (err: unknown) => /^Ative o 2FA/.test((err as Error | null)?.message ?? '')

// 23514 = CHECK do banco (detalhe fora de 3 a 500 caracteres ou com caractere de controle).
// 42501 sem ser o do 2FA = "Acesso negado": nem produtor do evento nem moderador.
export function erroMesaAdmin(err: unknown): string {
  const e = err as { code?: string; message?: string } | null
  if (e?.code === '42501' && !precisa2fa(err)) {
    return 'Sem permissão: só o produtor do evento e quem tem a permissão "Moderar Match de Mesa" (com 2FA) acessam o Match de Mesa.'
  }
  if (e?.code === '23514') return 'O banco recusou o texto: use de 3 a 500 caracteres, sem símbolos especiais.'
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
  return useMesaAdminMutation(['mesa-denuncias'], (d: { id: string; status: StatusDenuncia }) =>
    rpc('mesa_denuncia_status', { p_id: d.id, p_status: d.status }))
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
