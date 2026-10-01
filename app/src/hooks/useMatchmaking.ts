import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { MESA_TERM_VERSION } from '../lib/legal'
import type { MesaTags } from '../lib/mesaTags'
import { useAuth } from './useAuth'

// Match de Mesa: o navegador não lê nem grava as tabelas da mesa. Tudo passa pelas funções do banco
// (docs/sql/20261003_mesa_coletiva.sql, SECURITY DEFINER). O perfil de mesa (user_profiles_ext) é
// gravado direto pelo dono, menos mesa_consent_* e rede_consent_*, que só mudam por função.

// ============================================================
// Tipos (formato exato do JSON das funções)
// ============================================================

export interface MatchmakingProfile {
  user_id: string
  temperament: 'introvert' | 'extrovert' | 'ambivert' | null
  intention: 'network' | 'fun' | 'experience' | null
  music_style: 'eletronica' | 'rock' | 'pop' | 'sertanejo' | 'jazz' | 'hiphop' | 'indie' | null
  energy_level: 'low' | 'medium' | 'high' | null
  vibe: string | null
  tags: MesaTags | null
  education: string | null
  social_url: string | null
  quiz_completed_at: string | null
  mesa_consent_version: string | null
  mesa_consent_at: string | null
  mesa_consent_revoked_at: string | null
  rede_consent_at: string | null
  rede_consent_revoked_at: string | null
}

// Tudo opcional (decisão do Ricardo, 30/09): só nome, idade e foto são obrigatórios, e vêm do perfil
export interface QuizAnswers {
  temperament?: NonNullable<MatchmakingProfile['temperament']>
  intention?: NonNullable<MatchmakingProfile['intention']>
  music_style?: NonNullable<MatchmakingProfile['music_style']>
  energy_level?: NonNullable<MatchmakingProfile['energy_level']>
  tags: MesaTags
  education?: string | null
  social_url?: string | null
}

// mesa_cartao: sempre o primeiro nome; o resto só quando quem vê e quem é visto são mesa_ok
export interface MesaCartao {
  id: string | null // id opaco (table_members) para mesa_denunciar; nulo em "Lugar ocupado"
  nome: string
  faixa_idade: string | null
  foto: string | null
  perfil: string | null
  tags: MesaTags | null
  escolaridade: string | null
  rede_social: string | null
}

export interface MesaColega extends MesaCartao {
  eu: boolean
  acompanhantes?: number
}

export interface MinhaMesa {
  mesas: { nome: string; capacidade: number; colegas: MesaColega[] | null }[]
  forma_em?: string | null
  saiu?: boolean
  travado?: boolean
}

export interface MesaParaEscolher {
  numero: number
  vagas: number
  pessoas: MesaCartao[]
  etiquetas: { categoria: string; etiqueta: string; pessoas: number }[] | null
}

export interface MesasParaEscolher {
  mesas: MesaParaEscolher[]
  motivo?: 'sem_ingresso' | 'fora_do_prazo' | 'travado' | 'sem_perfil' | 'saiu'
}

export interface MesaAviso {
  id: string
  evento: string
  mesa: string | null
  tipo: 'entrou' | 'removido'
  mensagem: string
  criado_em: string
  lido: boolean
}

export type MotivoDenuncia = 'assedio' | 'perfil_falso' | 'conteudo_improprio' | 'outro'

// ============================================================
// Erros do banco em texto para a pessoa
// ============================================================

// 22023 é a recusa de regra do banco (texto em português); 42501, acesso (2FA ou sem login).
// O banco ainda diz "Mesa Tinder" em algumas mensagens: o nome público é "Match de Mesa" (Decisão 90).
export function mesaErro(err: unknown): string {
  const e = err as { code?: string; message?: string } | null
  const msg = e?.message ?? ''
  if (e?.code === '22023') {
    if (/data de nascimento|maiores de 18/i.test(msg)) return 'O Match de Mesa é só para maiores de 18: informe sua data de nascimento no Perfil.'
    if (/1 lugar por conta/i.test(msg)) return 'No Match de Mesa é 1 lugar por conta em cada evento (quantidade 1).'
    return msg.replace(/Mesa Tinder/g, 'Match de Mesa')
  }
  if (e?.code === '42501') return 'Sem acesso. Entre de novo; se sua conta usa verificação em duas etapas, digite o código.'
  return 'Não foi possível concluir agora. Tente de novo em instantes.'
}

async function rpc<T>(nome: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(nome as never, args as never)
  if (error) throw Object.assign(new Error(mesaErro(error)), { code: error.code })
  return data as unknown as T
}

export function consentimentoVigente(p: MatchmakingProfile | null | undefined): boolean {
  return !!p?.mesa_consent_at && !p.mesa_consent_revoked_at && p.mesa_consent_version === MESA_TERM_VERSION
}

export function redeVigente(p: MatchmakingProfile | null | undefined): boolean {
  return !!p?.rede_consent_at && !p.rede_consent_revoked_at
}

// ============================================================
// Perfil de mesa (questionário)
// ============================================================

export function useMatchmakingProfile() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data: profile, isLoading } = useQuery<MatchmakingProfile | null>({
    queryKey: ['matchmaking-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null
      const { data, error } = await supabase
        .from('user_profiles_ext' as never)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      if (error) throw error
      return data as MatchmakingProfile | null
    },
    enabled: !!user?.id,
  })

  const saveProfile = useMutation({
    mutationFn: async (answers: QuizAnswers) => {
      if (!user?.id) throw new Error('Usuário não autenticado')
      // sem temperamento nem energia, não há perfil de mesa a mostrar (generateVibe inventaria um)
      const vibe = answers.temperament || answers.energy_level ? generateVibe(answers) : null
      // Nunca gender, bio, birth_year (CHECK do banco) nem mesa_consent_* (gatilho do banco)
      const { data, error } = await supabase
        .from('user_profiles_ext' as never)
        .upsert({
          user_id: user.id,
          temperament: answers.temperament ?? null,
          intention: answers.intention ?? null,
          music_style: answers.music_style ?? null,
          energy_level: answers.energy_level ?? null,
          tags: answers.tags,
          education: answers.education ?? null,
          social_url: answers.social_url ?? null,
          vibe,
          quiz_completed_at: new Date().toISOString(),
        } as never, { onConflict: 'user_id' })
        .select()
        .single()
      if (error) throw Object.assign(new Error(mesaErro(error)), { code: error.code })
      return data as MatchmakingProfile
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matchmaking-profile', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['minha-mesa'] })
    },
  })

  return { profile, isLoading, saveProfile }
}

// Mesmos nomes do CHECK user_profiles_ext_vibe_chk
function generateVibe(answers: QuizAnswers): string {
  const vibes: Record<string, Record<string, string[]>> = {
    introvert: {
      low: ['Observador', 'Contemplador', 'Filósofo'],
      medium: ['Curioso', 'Explorador Tranquilo', 'Analista'],
      high: ['Dinâmico Reservado', 'Energia Contida', 'Fogo Interior'],
    },
    extrovert: {
      low: ['Social Leve', 'Conector Calmo', 'Anfitrião Discreto'],
      medium: ['Animador', 'Centro das Atenções', 'Contagiante'],
      high: ['Turbilhão', 'Furacão Social', 'Estrela Cadente'],
    },
    ambivert: {
      low: ['Equilibrado', 'Adaptável', 'Camaleão'],
      medium: ['Versátil', 'Multifacetado', 'Tudo-em-Um'],
      high: ['Explosão Controlada', 'Dinamite Social', 'Supernova'],
    },
  }
  const tempVibes = vibes[answers.temperament ?? 'ambivert']
  const energyVibes = tempVibes[answers.energy_level ?? 'medium']
  return energyVibes[Math.floor(Math.random() * energyVibes.length)]
}

// Situação da foto na moderação (profiles.avatar_moderacao, só a própria). Coluna ausente (SQL ainda
// não aplicado) = sem aviso. 'sem_foto': a foto não está no formato que a fila aceita (mesma regra de
// mesa_foto_formato no SQL), então nunca seria analisada.
export function useMinhaFotoModeracao() {
  const { user } = useAuth()
  return useQuery<string | null>({
    queryKey: ['foto-moderacao', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('avatar_url, avatar_moderacao' as never).eq('id', user!.id).maybeSingle()
      if (error) return null
      const linha = data as { avatar_url?: string | null; avatar_moderacao?: string } | null
      if (!linha?.avatar_moderacao) return null
      const url = linha.avatar_url ?? ''
      if (url.length > 60000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(url)) return 'sem_foto'
      return linha.avatar_moderacao
    },
    enabled: !!user?.id,
  })
}

// Pede revisão humana da recusa automática da própria foto. false = não dá (já pedida, ou a última
// decisão não foi da IA); o motivo da recusa não volta para a pessoa.
export function useMesaFotoContestar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => rpc<boolean>('mesa_foto_contestar'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['foto-moderacao'] }),
  })
}

// ============================================================
// Mesa (funções do banco)
// ============================================================

export function useMyTable(eventId: string | null) {
  const { user } = useAuth()
  return useQuery<MinhaMesa>({
    queryKey: ['minha-mesa', eventId, user?.id],
    queryFn: () => rpc<MinhaMesa>('minha_mesa', { p_event_id: eventId }),
    enabled: !!eventId && !!user?.id,
  })
}

export function useMesasParaEscolher(eventId: string | null, enabled = true) {
  const { user } = useAuth()
  return useQuery<MesasParaEscolher>({
    queryKey: ['mesas-para-escolher', eventId, user?.id],
    queryFn: () => rpc<MesasParaEscolher>('mesas_para_escolher', { p_event_id: eventId }),
    enabled: enabled && !!eventId && !!user?.id,
  })
}

// Tudo o que muda a mesa ou o perfil relê as duas coisas
function useMesaMutation<A = void, R = void>(fn: (a: A) => Promise<R>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of ['minha-mesa', 'mesas-para-escolher', 'matchmaking-profile']) {
        queryClient.invalidateQueries({ queryKey: [key] })
      }
    },
  })
}

// numero null = "Mesa nova"
export function useEscolherMesa(eventId: string) {
  return useMesaMutation((numero: number | null) =>
    rpc<{ numero: number; nome: string }>('escolher_mesa', { p_event_id: eventId, p_mesa_numero: numero }))
}

export function useMesaConsentir() {
  return useMesaMutation(() => rpc('mesa_consentir', { p_versao: MESA_TERM_VERSION }))
}

export function useMesaRevogar() {
  return useMesaMutation(() => rpc('mesa_revogar'))
}

export function useMesaRede() {
  return useMesaMutation((mostrar: boolean) => rpc(mostrar ? 'mesa_mostrar_rede' : 'mesa_ocultar_rede'))
}

export function useMesaSair(eventId: string) {
  return useMesaMutation(() => rpc('mesa_sair', { p_event_id: eventId }))
}

export function useMesaVoltar(eventId: string) {
  return useMesaMutation(() => rpc('mesa_voltar', { p_event_id: eventId }))
}

export function useMesaDenunciar() {
  return useMutation({
    mutationFn: (d: { membro: string; motivo: MotivoDenuncia; detalhe?: string }) =>
      rpc<{ ok?: boolean; ja_denunciado?: boolean }>('mesa_denunciar', {
        p_membro: d.membro, p_motivo: d.motivo, p_detalhe: d.detalhe?.trim() || null,
      }),
  })
}

export function useMesaAvisos() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const avisos = useQuery<MesaAviso[]>({
    queryKey: ['mesa-avisos', user?.id],
    queryFn: () => rpc<MesaAviso[]>('meus_avisos_mesa'),
    enabled: !!user?.id,
  })
  const marcarLidos = useMutation({
    mutationFn: () => rpc('marcar_avisos_lidos'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mesa-avisos'] }),
  })
  return { avisos, marcarLidos }
}
