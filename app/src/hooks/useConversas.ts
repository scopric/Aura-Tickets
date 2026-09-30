import { useEffect, useSyncExternalStore } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

// Chat estilo Intercom (etapa 1a). O navegador só LÊ as tabelas (RLS) e só ESCREVE pelas funções
// chat_* do banco (docs/sql/20261001_chat.sql), que decidem o papel de quem chama. As funções e
// tabelas não estão nos tipos gerados do banco: por isso os `as never` nas chamadas.

export type Publico = 'site' | 'producer' | 'participant_evokaa'
export type PapelMensagem = 'customer' | 'agent' | 'producer' | 'bot' | 'system'

export interface Assunto {
  id: string
  label: string
  hint: string | null
  urgent: boolean
}

export interface Conversa {
  id: string
  status: 'open' | 'resolved'
  priority: 'normal' | 'urgent'
  last_message_at: string
  last_message_preview: string | null
  last_reply_at: string | null
  customer_last_read_at: string | null
  agent_last_read_at: string | null
  rating: number | null
  created_at: string
  /** primeiro nome de quem assumiu (gravado pelo servidor, 20261002_chat_atendente.sql) */
  assignee_name: string | null
  /** com o assistente ou com a equipe (20261003_chat_bot.sql) */
  bot_state: 'bot' | 'humano'
  chat_topics: { label: string } | null
}

export interface MensagemChat {
  id: string
  conversation_id: string
  sender_id: string | null
  sender_role: PapelMensagem
  sender_name: string
  body: string
  is_internal: boolean
  attachment_path: string | null
  attachment_name: string | null
  attachment_mime: string | null
  attachment_size: number | null
  /** 1 = resposta do assistente pela base; nulo na cortesia e nas demais mensagens */
  bot_layer: number | null
  created_at: string
}

export interface ContatoProprio {
  name: string
  phone: string | null
  marketing_opt_in: boolean
}

export const TIPOS_ANEXO = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
export const MAX_ANEXO = 10 * 1024 * 1024 // igual ao limite do bucket chat-anexos
export const MAX_TEXTO = 4000

/** Público dos assuntos pelo papel real da conta (mesma regra do chat_start). */
export function publicoDoPapel(role?: string | null): Publico {
  if (role === 'user' || role === 'customer') return 'participant_evokaa'
  if (role === 'producer' || role === 'editor') return 'producer'
  return 'site'
}

/** Mesmo formato que o servidor aceita: 55 + DDD sem zero + 8 ou 9 dígitos. */
export function validarTelefoneBR(valor: string | null | undefined): boolean {
  return /^55[1-9]{2}9?[0-9]{8}$/.test((valor ?? '').replace(/\D/g, ''))
}

/** a é mais recente que b (b vazio conta como "nunca"). */
export function depois(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && (!b || Date.parse(a) > Date.parse(b))
}

export function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/).filter(Boolean)
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?'
}

export function quando(iso: string): string {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  if (min < 60 * 24) return `há ${Math.floor(min / 60)} h`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

const MOTIVOS: Record<string, string> = {
  nao_disponivel: 'Este assunto ainda não está disponível.',
  assunto_invalido: 'Este assunto não está disponível para a sua conta.',
  limite_abertas: 'Você já tem 3 conversas abertas. Continue numa delas ou aguarde a resposta.',
  limite_hora: 'Você abriu muitas conversas na última hora. Tente de novo mais tarde.',
  limite_minuto: 'Muitas mensagens em pouco tempo. Aguarde um minuto e tente de novo.',
  nao_permitido: 'Não foi possível registrar a avaliação (ela é feita uma vez, com a conversa resolvida).',
  fora_do_assistente: 'Esta conversa já está com a equipe ou foi encerrada.',
}

/** Erro do Supabase → frase em português. As recusas do banco (22023/42501) já vêm em português. */
export function mensagemDeErro(e: unknown): string {
  if (e instanceof Error && e.name === 'ErroChat') return e.message
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'Sem conexão com a internet. Tente de novo quando voltar.'
  const err = e as { code?: string; message?: string } | null
  // recusa do banco em português passa; texto técnico (RLS, privilégio) nunca chega à tela
  if ((err?.code === '22023' || err?.code === '42501') && err.message && !/permission denied|violates|row-level security|policy/i.test(err.message)) return err.message
  if (err?.code === '42501') return 'Você não tem acesso a esta conversa.'
  return 'Não foi possível concluir agora. Tente de novo em instantes.'
}

function erroChat(msg: string) {
  return Object.assign(new Error(msg), { name: 'ErroChat' })
}

type Retorno = { ok: boolean; motivo?: string; id?: string }

async function chamar(nome: string, args: Record<string, unknown>): Promise<Retorno> {
  const { data, error } = await supabase.rpc(nome as never, args as never)
  if (error) throw erroChat(mensagemDeErro(error))
  const r = data as unknown as Retorno
  if (r?.ok === false) throw erroChat(MOTIVOS[r.motivo ?? ''] ?? 'Não foi possível concluir agora. Tente de novo em instantes.')
  return r
}

export async function iniciarConversa(p: { assuntoId: string; nome: string; telefone: string; novidades: boolean; texto: string }): Promise<string> {
  const r = await chamar('chat_start', {
    p_topic_id: p.assuntoId, p_event_id: null, p_name: p.nome, p_phone: p.telefone.replace(/\D/g, ''),
    p_marketing_opt_in: p.novidades, p_body: p.texto,
  })
  return r.id as string
}

export async function enviarMensagem(conversaId: string, texto: string, opcoes: { nota?: boolean; anexo?: { path: string; nome: string } } = {}) {
  await chamar('chat_send', {
    p_conv: conversaId, p_body: texto, p_is_internal: !!opcoes.nota,
    p_attachment_path: opcoes.anexo?.path ?? null, p_attachment_name: opcoes.anexo?.nome ?? null,
  })
}

export async function atualizarConversa(conversaId: string, patch: Record<string, string | null>) {
  await chamar('chat_update', { p_conv: conversaId, p_patch: patch })
}

export async function marcarLida(conversaId: string) {
  await chamar('chat_mark_read', { p_conv: conversaId })
}

/** "Falar com um atendente": tira a conversa do assistente */
export async function falarComAtendente(conversaId: string) {
  await chamar('chat_handoff', { p_conv: conversaId })
}

/** "Isso resolveu?" do assistente: Sim resolve; Não passa para a equipe */
export async function responderAssistente(conversaId: string, resolveu: boolean) {
  await chamar('chat_bot_feedback', { p_conv: conversaId, p_resolveu: resolveu })
}

export async function avaliarConversa(conversaId: string, nota: 1 | 2 | 3) {
  await chamar('chat_rate', { p_conv: conversaId, p_rating: nota })
}

/** Confere tipo e tamanho antes de subir; caminho {conversa}/{uuid} (regra do bucket). */
export function problemaNoArquivo(f: File): string | null {
  if (!TIPOS_ANEXO.includes(f.type)) return 'Envie imagem (JPG, PNG ou WebP) ou PDF.'
  if (f.size > MAX_ANEXO) return 'O arquivo passa de 10 MB.'
  return null
}

export async function enviarAnexo(conversaId: string, f: File): Promise<{ path: string; nome: string }> {
  const problema = problemaNoArquivo(f)
  if (problema) throw erroChat(problema)
  const path = `${conversaId}/${crypto.randomUUID()}`
  const { error } = await supabase.storage.from('chat-anexos').upload(path, f, { contentType: f.type })
  if (error) {
    throw erroChat(navigator.onLine
      ? 'Não foi possível enviar o arquivo. A conversa precisa estar aberta e aceita até 20 arquivos seus.'
      : 'Sem conexão com a internet. Tente de novo quando voltar.')
  }
  return { path, nome: f.name.slice(0, 200) }
}

/** URL assinada de 10 min; com `baixar`, o navegador baixa o arquivo em vez de abrir. */
export async function urlAssinada(path: string, baixar?: string): Promise<string> {
  const { data, error } = await supabase.storage.from('chat-anexos').createSignedUrl(path, 600, baixar ? { download: baixar } : undefined)
  if (error || !data?.signedUrl) throw erroChat('Não foi possível abrir o anexo.')
  return data.signedUrl
}

export function useUrlAnexo(path: string | null, baixar?: string) {
  return useQuery({
    queryKey: ['chat-url', path, baixar ?? null],
    queryFn: () => urlAssinada(path as string, baixar),
    enabled: !!path,
    staleTime: 9 * 60_000, // a URL vale 10 min: renova antes de vencer com a tela aberta
    refetchInterval: 9 * 60_000,
    gcTime: 10 * 60_000,
    retry: false,
  })
}

// Liga/desliga do som das mensagens (padrão ligado). Sem localStorage (modo privado, cota), vale
// só a memória desta carga.
const CHAVE_SOM = 'evokaa-som-chat'
let somMemoria = true
const ouvintesSom = new Set<() => void>()
export function somLigado(): boolean {
  try {
    const v = localStorage.getItem(CHAVE_SOM)
    return v === null ? somMemoria : v !== 'off'
  } catch {
    return somMemoria
  }
}
export function useSomChat(): [boolean, () => void] {
  const ligado = useSyncExternalStore((cb) => {
    ouvintesSom.add(cb)
    return () => { ouvintesSom.delete(cb) }
  }, somLigado)
  const alternar = () => {
    somMemoria = !ligado
    try {
      localStorage.setItem(CHAVE_SOM, somMemoria ? 'on' : 'off')
    } catch {
      // sem storage: fica só em memória
    }
    ouvintesSom.forEach((f) => f())
  }
  return [ligado, alternar]
}

/** Som curto ao chegar mensagem (Web Audio). Desligado pelo usuário, ou bloqueado pelo navegador antes da 1ª interação: silêncio. */
export function bipe(tom: [number, number] = [523.25, 783.99]) {
  if (!somLigado()) return
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    const osc = ctx.createOscillator()
    const ganho = ctx.createGain()
    osc.connect(ganho)
    ganho.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(tom[0], ctx.currentTime)
    ganho.gain.setValueAtTime(0.08, ctx.currentTime)
    osc.start()
    osc.frequency.setValueAtTime(tom[1], ctx.currentTime + 0.08)
    ganho.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    osc.onended = () => { ctx.close() }
    osc.stop(ctx.currentTime + 0.3)
  } catch {
    // sem áudio: segue em silêncio
  }
}

export function useAssuntos(publico: Publico, ativo = true) {
  return useQuery<Assunto[]>({
    queryKey: ['chat-assuntos', publico],
    enabled: ativo,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_topics' as never)
        .select('id, label, hint, urgent')
        .eq('audience', publico)
        .eq('active', true)
        .order('position')
      if (error) throw error
      return (data ?? []) as unknown as Assunto[]
    },
  })
}

export function useChatConfig(ativo = true) {
  return useQuery<{ aberto_agora: boolean; prazo: string }>({
    queryKey: ['chat-config'],
    enabled: ativo,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('chat_public_settings' as never)
      if (error) throw error
      return data as unknown as { aberto_agora: boolean; prazo: string }
    },
  })
}

export function useMeuContato() {
  const { user } = useAuth()
  return useQuery<ContatoProprio | null>({
    queryKey: ['chat-contato', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_contacts' as never)
        .select('name, phone, marketing_opt_in')
        .eq('user_id', user!.id)
        .maybeSingle()
      if (error) throw error
      return (data ?? null) as unknown as ContatoProprio | null
    },
  })
}

/**
 * Conversas da própria conta e quantas têm resposta não lida. Com `ouvir`, abre o canal do
 * Realtime (só INSERT/UPDATE de conversations da conta): cada resposta atualiza a linha da
 * conversa (gatilho), então o mesmo canal renova a lista e as mensagens da conversa. Só quem fica
 * montado o tempo todo ouve (EvoHub e balão do site); o painel usa o mesmo cache.
 */
export function useMinhasConversas(ouvir = false) {
  const { user } = useAuth()
  const uid = user?.id
  const qc = useQueryClient()
  const q = useQuery<Conversa[]>({
    queryKey: ['chat-minhas', uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations' as never)
        .select('id, status, priority, last_message_at, last_message_preview, last_reply_at, customer_last_read_at, agent_last_read_at, rating, created_at, assignee_name, bot_state, chat_topics(label)')
        .eq('user_id', uid!)
        .order('last_message_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as unknown as Conversa[]
    },
  })

  useEffect(() => {
    if (!ouvir || !uid) return
    // última resposta que já tocou, por conversa: a 1ª resposta a uma conversa sem dono chega em
    // dois UPDATEs seguidos (gatilho + atribuição), antes de o cache recarregar
    const tocou = new Map<string, string>()
    const aoMudar = ({ new: nova }: { new: Partial<Conversa> }) => {
      const antes = qc.getQueryData<Conversa[]>(['chat-minhas', uid])?.find((c) => c.id === nova.id)
      const base = (nova.id && tocou.get(nova.id)) || antes?.last_reply_at
      // resposta nova da equipe (a mensagem do próprio cliente não mexe em last_reply_at)
      if (nova.id && nova.last_reply_at && depois(nova.last_reply_at, base)) {
        tocou.set(nova.id, nova.last_reply_at)
        bipe()
      }
      qc.invalidateQueries({ queryKey: ['chat-minhas', uid] })
      if (nova.id) qc.invalidateQueries({ queryKey: ['chat-mensagens', nova.id] })
    }
    // nome único: o supabase-js devolve o canal existente para o mesmo nome (StrictMode monta 2 vezes)
    const canal = supabase
      .channel(`chat-minhas-${uid}-${crypto.randomUUID()}`)
      .on<Conversa>('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations', filter: `user_id=eq.${uid}` }, aoMudar)
      .on<Conversa>('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `user_id=eq.${uid}` }, aoMudar)
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [ouvir, uid, qc])

  const naoLidas = (q.data ?? []).filter((c) => depois(c.last_reply_at, c.customer_last_read_at)).length
  return { ...q, naoLidas }
}

// ponytail: as 500 mensagens mais novas da conversa; paginar se alguma conversa passar disso.
// `apenasPublicas` (tela do cliente): nota interna fica de fora mesmo que a RLS falhe.
export function useMensagens(conversaId: string | null, apenasPublicas = false) {
  return useQuery<MensagemChat[]>({
    queryKey: ['chat-mensagens', conversaId, apenasPublicas ? 'publicas' : 'todas'],
    enabled: !!conversaId,
    queryFn: async () => {
      let q = supabase
        .from('conversation_messages' as never)
        .select('id, conversation_id, sender_id, sender_role, sender_name, body, is_internal, attachment_path, attachment_name, attachment_mime, attachment_size, bot_layer, created_at')
        .eq('conversation_id', conversaId!)
      if (apenasPublicas) q = q.eq('is_internal', false)
      const { data, error } = await q.order('created_at', { ascending: false }).limit(500)
      if (error) throw error
      return ((data ?? []) as unknown as MensagemChat[]).reverse()
    },
  })
}
