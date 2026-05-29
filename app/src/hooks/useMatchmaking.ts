import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

// ============================================================
// Tipos
// ============================================================

export interface MatchmakingProfile {
  id: string
  user_id: string
  temperament: 'introvert' | 'extrovert' | 'ambivert' | null
  intention: 'network' | 'fun' | 'romance' | 'experience' | null
  music_style: 'eletronica' | 'rock' | 'pop' | 'sertanejo' | 'jazz' | 'hiphop' | 'indie' | null
  energy_level: 'low' | 'medium' | 'high' | null
  birth_year: number | null
  gender: 'M' | 'F' | 'NB' | 'prefer_not_say' | null
  bio: string | null
  vibe: string | null
  quiz_completed_at: string | null
}

export interface CollectiveTable {
  id: string
  event_id: string
  ticket_type_id: string | null
  name: string
  theme: string | null
  capacity: number
  compatibility_score: number | null
  status: 'open' | 'full' | 'closed'
  icebreaker_question: string | null
  icebreaker_sent_at: string | null
  created_at: string
  member_count?: number
  remaining_spots?: number
}

export interface TableMember {
  id: string
  table_id: string | null
  user_id: string
  vibe: string | null
  role: string
  matchmaking_answers: Record<string, any>
  joined_at: string
  profiles?: {
    full_name: string | null
    avatar_url: string | null
  } | null
}

export interface QuizAnswers {
  temperament: 'introvert' | 'extrovert' | 'ambivert'
  intention: 'network' | 'fun' | 'romance' | 'experience'
  music_style: 'eletronica' | 'rock' | 'pop' | 'sertanejo' | 'jazz' | 'hiphop' | 'indie'
  energy_level: 'low' | 'medium' | 'high'
  birth_year?: number
  gender?: 'M' | 'F' | 'NB' | 'prefer_not_say'
  bio?: string
}

// ============================================================
// Hook: Perfil de Matchmaking (Quiz)
// ============================================================

export function useMatchmakingProfile() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data: profile, isLoading } = useQuery<MatchmakingProfile | null>({
    queryKey: ['matchmaking-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null

      const { data, error } = await supabase
        .from('user_profiles_ext')
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

      const vibe = generateVibe(answers)

      const { data, error } = await supabase
        .from('user_profiles_ext')
        .upsert({
          user_id: user.id,
          temperament: answers.temperament,
          intention: answers.intention,
          music_style: answers.music_style,
          energy_level: answers.energy_level,
          birth_year: answers.birth_year || null,
          gender: answers.gender || null,
          bio: answers.bio || null,
          vibe,
          quiz_completed_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
        .select()
        .single()

      if (error) throw error
      return data as MatchmakingProfile
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matchmaking-profile', user?.id] })
    },
  })

  return { profile, isLoading, saveProfile }
}

// ============================================================
// Hook: Minha Mesa
// ============================================================

export function useMyTable(eventId: string | null) {
  const { user } = useAuth()

  return useQuery<CollectiveTable | null>({
    queryKey: ['my-table', eventId, user?.id],
    queryFn: async () => {
      if (!eventId || !user?.id) return null

      // Buscar table_member do usuário para este evento
      const { data: memberData, error: memberError } = await supabase
        .from('table_members')
        .select('table_id')
        .eq('user_id', user.id)
        .not('table_id', 'is', null)
        .maybeSingle()

      if (memberError) throw memberError
      if (!memberData?.table_id) return null

      // Buscar dados da mesa
      const { data: tableData, error: tableError } = await supabase
        .from('collective_tables')
        .select('*')
        .eq('id', memberData.table_id)
        .maybeSingle()

      if (tableError) throw tableError
      return tableData as CollectiveTable | null
    },
    enabled: !!eventId && !!user?.id,
  })
}

// ============================================================
// Hook: Membros da Mesa
// ============================================================

export function useTableMembers(tableId: string | null) {
  return useQuery<TableMember[]>({
    queryKey: ['table-members', tableId],
    queryFn: async () => {
      if (!tableId) return []

      const { data, error } = await supabase
        .from('table_members')
        .select(`
          *,
          profiles (
            full_name,
            avatar_url
          )
        `)
        .eq('table_id', tableId)

      if (error) throw error
      return (data || []) as TableMember[]
    },
    enabled: !!tableId,
  })
}

// ============================================================
// Hook: Todas as mesas do evento
// ============================================================

export function useCollectiveTables(eventId: string | null) {
  return useQuery<CollectiveTable[]>({
    queryKey: ['collective-tables', eventId],
    queryFn: async () => {
      if (!eventId) return []

      const { data, error } = await supabase
        .from('collective_table_summary')
        .select('*')
        .eq('event_id', eventId)

      if (error) throw error
      return (data || []) as CollectiveTable[]
    },
    enabled: !!eventId,
  })
}

// ============================================================
// Hook: Executar matchmaking
// ============================================================

export function useRunMatchmaking() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (eventId: string) => {
      if (!user?.id) throw new Error('Usuário não autenticado')

      // 1. Buscar todos os membros pendentes (sem table_id) deste evento
      const { data: pendingMembers, error: pendingError } = await supabase
        .from('table_members')
        .select(`
          *,
          profiles (
            full_name,
            avatar_url
          )
        `)
        .is('table_id', null)

      if (pendingError) throw pendingError
      if (!pendingMembers || pendingMembers.length === 0) {
        throw new Error('Não há participantes pendentes para alocar')
      }

      // 2. Executar algoritmo de matchmaking
      const tables = runMatchmakingAlgorithm(pendingMembers as TableMember[], eventId)

      // 3. Criar mesas no banco e alocar membros
      for (const table of tables) {
        // Criar mesa
        const { data: tableData, error: tableError } = await supabase
          .from('collective_tables')
          .insert({
            event_id: eventId,
            name: table.name,
            theme: table.theme,
            capacity: table.capacity,
            compatibility_score: table.compatibility_score,
            status: table.members.length >= table.capacity ? 'full' : 'open',
          })
          .select()
          .single()

        if (tableError) throw tableError

        // Atualizar membros com o table_id
        for (const member of table.members) {
          const { error: updateError } = await supabase
            .from('table_members')
            .update({ table_id: tableData.id })
            .eq('id', member.id)

          if (updateError) throw updateError
        }
      }

      return tables.length
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collective-tables'] })
      queryClient.invalidateQueries({ queryKey: ['my-table'] })
      queryClient.invalidateQueries({ queryKey: ['table-members'] })
    },
  })
}

// ============================================================
// Algoritmo de Matchmaking (Cliente)
// ============================================================

interface MatchmakingTable {
  name: string
  theme: string
  capacity: number
  compatibility_score: number
  members: TableMember[]
}

function runMatchmakingAlgorithm(members: TableMember[], eventId: string): MatchmakingTable[] {
  const DEFAULT_CAPACITY = 6
  const tables: MatchmakingTable[] = []
  const unallocated = [...members]

  // Embaralhar para evitar viés de ordem de compra
  for (let i = unallocated.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unallocated[i], unallocated[j]] = [unallocated[j], unallocated[i]]
  }

  while (unallocated.length > 0) {
    const tableMembers: TableMember[] = []
    const seed = unallocated.shift()!
    tableMembers.push(seed)

    // Encontrar os mais compatíveis com o seed
    const scored = unallocated.map(m => ({
      member: m,
      score: calculateCompatibility(seed, m),
    })).sort((a, b) => b.score - a.score)

    // Preencher a mesa até a capacidade
    while (tableMembers.length < DEFAULT_CAPACITY && scored.length > 0) {
      const best = scored.shift()!
      tableMembers.push(best.member)
      const idx = unallocated.findIndex(u => u.id === best.member.id)
      if (idx !== -1) unallocated.splice(idx, 1)
    }

    // Calcular score médio da mesa
    let totalScore = 0
    let pairCount = 0
    for (let i = 0; i < tableMembers.length; i++) {
      for (let j = i + 1; j < tableMembers.length; j++) {
        totalScore += calculateCompatibility(tableMembers[i], tableMembers[j])
        pairCount++
      }
    }
    const avgScore = pairCount > 0 ? totalScore / pairCount : 70

    // Gerar nome temático baseado no perfil dominante
    const dominantProfile = getDominantProfile(tableMembers)
    const name = generateTableName(dominantProfile)
    const theme = generateTableTheme(dominantProfile)

    tables.push({
      name,
      theme,
      capacity: DEFAULT_CAPACITY,
      compatibility_score: Math.round(avgScore * 10) / 10,
      members: tableMembers,
    })
  }

  return tables
}

function calculateCompatibility(a: TableMember, b: TableMember): number {
  const ansA = a.matchmaking_answers || {}
  const ansB = b.matchmaking_answers || {}
  let score = 50 // base

  // Temperamento (30%)
  if (ansA.temperament && ansB.temperament) {
    const tempMap: Record<string, number> = { introvert: 1, ambivert: 2, extrovert: 3 }
    const diff = Math.abs(tempMap[ansA.temperament] - tempMap[ansB.temperament])
    score += (2 - diff) * 15
  }

  // Intenção (20%)
  if (ansA.intention === ansB.intention) {
    score += 20
  } else if (ansA.intention && ansB.intention) {
    // Compatibilidades parciais
    const compat: Record<string, string[]> = {
      network: ['fun', 'experience'],
      fun: ['network', 'romance', 'experience'],
      romance: ['fun', 'experience'],
      experience: ['network', 'fun', 'romance'],
    }
    if (compat[ansA.intention]?.includes(ansB.intention)) {
      score += 10
    }
  }

  // Música (20%)
  if (ansA.music_style === ansB.music_style) {
    score += 20
  } else if (ansA.music_style && ansB.music_style) {
    const genres: Record<string, string[]> = {
      eletronica: ['indie', 'hiphop'],
      rock: ['indie', 'pop'],
      pop: ['rock', 'indie', 'hiphop'],
      sertanejo: ['pop'],
      jazz: ['indie'],
      hiphop: ['eletronica', 'pop'],
      indie: ['rock', 'eletronica', 'jazz'],
    }
    if (genres[ansA.music_style]?.includes(ansB.music_style)) {
      score += 10
    }
  }

  // Energia (20%)
  if (ansA.energy_level && ansB.energy_level) {
    const energyMap: Record<string, number> = { low: 1, medium: 2, high: 3 }
    const diff = Math.abs(energyMap[ansA.energy_level] - energyMap[ansB.energy_level])
    score += (2 - diff) * 10
  }

  // Gênero (10% — balanceamento, não necessariamente igual)
  if (ansA.gender && ansB.gender) {
    if (ansA.gender !== ansB.gender) {
      score += 10 // Diversidade de gênero é positiva
    } else {
      score += 5
    }
  }

  return Math.min(100, Math.max(0, score))
}

function getDominantProfile(members: TableMember[]): Record<string, any> {
  const counts: Record<string, number> = {}
  let totalEnergy = 0
  let energyCount = 0

  for (const m of members) {
    const ans = m.matchmaking_answers || {}
    const intent = ans.intention || 'experience'
    counts[intent] = (counts[intent] || 0) + 1

    const energyMap: Record<string, number> = { low: 1, medium: 2, high: 3 }
    if (ans.energy_level) {
      totalEnergy += energyMap[ans.energy_level]
      energyCount++
    }
  }

  const dominantIntention = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'experience'
  const avgEnergy = energyCount > 0 ? totalEnergy / energyCount : 2

  return {
    intention: dominantIntention,
    energy: avgEnergy >= 2.5 ? 'high' : avgEnergy >= 1.5 ? 'medium' : 'low',
    memberCount: members.length,
  }
}

function generateTableName(profile: Record<string, any>): string {
  const names: Record<string, Record<string, string[]>> = {
    network: {
      high: ['Mesa Conexão', 'Mesa Nexus', 'Mesa Hub'],
      medium: ['Mesa Contato', 'Mesa Link', 'Mesa Ponte'],
      low: ['Mesa Reunião', 'Mesa Círculo', 'Mesa Roda'],
    },
    fun: {
      high: ['Mesa Aurora', 'Mesa Festa', 'Mesa Íon'],
      medium: ['Mesa Alegria', 'Mesa Risada', 'Mesa Brisa'],
      low: ['Mesa Sossego', 'Mesa Paz', 'Mesa Tranquilidade'],
    },
    romance: {
      high: ['Mesa Cupido', 'Mesa Amor', 'Mesa Paixão'],
      medium: ['Mesa Encanto', 'Mesa Magia', 'Mesa Química'],
      low: ['Mesa Destino', 'Mesa Sorte', 'Mesa Estrela'],
    },
    experience: {
      high: ['Mesa Aventura', 'Mesa Exploração', 'Mesa Descoberta'],
      medium: ['Mesa Jornada', 'Mesa Caminho', 'Mesa Trilha'],
      low: ['Mesa Refúgio', 'Mesa Oásis', 'Mesa Esconderijo'],
    },
  }

  const intentNames = names[profile.intention] || names.experience
  const energyNames = intentNames[profile.energy] || intentNames.medium
  return energyNames[Math.floor(Math.random() * energyNames.length)]
}

function generateTableTheme(profile: Record<string, any>): string {
  const themes: Record<string, Record<string, string[]>> = {
    network: {
      high: ['Empreendedores Noturnos', 'Criadores de Oportunidades', 'Conectores Urbanos'],
      medium: ['Profissionais Criativos', 'Networkers em Ascensão', 'Mentes Colaborativas'],
      low: ['Conversadores Atentos', 'Observadores Sociais', 'Analistas Silenciosos'],
    },
    fun: {
      high: ['Energizados da Noite', 'Almas Festeiras', 'Estrelas da Pista'],
      medium: ['Alegres Companheiros', 'Bom Humor Garantido', 'Diversão em Grupo'],
      low: ['Observadores Alegres', 'Sorrisos Contidos', 'Paz e Alegria'],
    },
    romance: {
      high: ['Corações Acelerados', 'Almas Apaixonadas', 'Românticos Intensos'],
      medium: ['Encantadores da Noite', 'Sonhadores Despertos', 'Química no Ar'],
      low: ['Destinos Cruzados', 'Estrelas Alinhadas', 'Sorte no Amor'],
    },
    experience: {
      high: ['Aventureiros Sem Medo', 'Exploradores da Noite', 'Caçadores de Emoções'],
      medium: ['Curiosos do Mundo', 'Viajantes da Noite', 'Descobridores Urbanos'],
      low: ['Contempladores Serenos', 'Observadores do Mundo', 'Espíritos Tranquilos'],
    },
  }

  const intentThemes = themes[profile.intention] || themes.experience
  const energyThemes = intentThemes[profile.energy] || intentThemes.medium
  return energyThemes[Math.floor(Math.random() * energyThemes.length)]
}

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

  const tempVibes = vibes[answers.temperament] || vibes.ambivert
  const energyVibes = tempVibes[answers.energy_level] || tempVibes.medium
  return energyVibes[Math.floor(Math.random() * energyVibes.length)]
}

// ============================================================
// Hook: Gerar icebreaker
// ============================================================

export function useGenerateIcebreaker() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (tableId: string) => {
      // Buscar membros e perfis da mesa
      const { data: members, error: membersError } = await supabase
        .from('table_members')
        .select(`
          *,
          profiles (
            full_name
          )
        `)
        .eq('table_id', tableId)

      if (membersError) throw membersError
      if (!members || members.length === 0) throw new Error('Mesa sem membros')

      // Gerar pergunta de quebra-gelo baseada nos perfis
      const question = generateIcebreakerQuestion(members as TableMember[])

      // Salvar na mesa
      const { error: updateError } = await supabase
        .from('collective_tables')
        .update({
          icebreaker_question: question,
          icebreaker_sent_at: new Date().toISOString(),
        })
        .eq('id', tableId)

      if (updateError) throw updateError
      return question
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collective-tables'] })
      queryClient.invalidateQueries({ queryKey: ['my-table'] })
    },
  })
}

function generateIcebreakerQuestion(members: TableMember[]): string {
  const answers = members.map(m => m.matchmaking_answers || {})
  const musicStyles = [...new Set(answers.map(a => a.music_style).filter(Boolean))]
  const intentions = [...new Set(answers.map(a => a.intention).filter(Boolean))]
  const energies = [...new Set(answers.map(a => a.energy_level).filter(Boolean))]

  const questions: string[] = [
    'Se vocês pudessem criar um drink que representasse essa mesa, quais ingredientes teria?',
    'Qual é a música perfeita para tocar quando essa mesa entrar no evento?',
    'Se cada um aqui fosse um super-herói, qual seria seu superpoder?',
    'Qual foi o evento mais inesperado e divertido que cada um já viveu?',
    'Se essa mesa fosse uma banda, qual seria o nome e o estilo musical?',
    'Qual lugar do mundo vocês visitariam juntos como grupo?',
    'Qual comida ou bebida nunca pode faltar na mesa de vocês?',
    'Se vocês fossem personagens de um filme, que gênero seria?',
  ]

  // Personalizar baseado nos dados
  if (musicStyles.length > 1) {
    questions.push(`Vocês têm gostos musicais variados (${musicStyles.join(', ')}). Qual seria a playlist colaborativa perfeita para essa noite?`)
  }
  if (intentions.includes('network')) {
    questions.push('Cada um tem 30 segundos para apresentar seu projeto ou paixão para a mesa. Quem começa?')
  }
  if (energies.includes('high')) {
    questions.push('O grupo tem alta energia! Qual seria o desafio mais divertido para fazer juntos hoje à noite?')
  }

  return questions[Math.floor(Math.random() * questions.length)]
}
