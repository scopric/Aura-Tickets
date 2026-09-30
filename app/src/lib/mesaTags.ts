// Listas fechadas do Match de Mesa. Os slugs são os mesmos do SQL (mesa_tags_ok e os CHECKs de
// user_profiles_ext em docs/sql/20261003_mesa_coletiva.sql): mudar aqui exige mudar lá, e vice-versa.
// src/test/mesaTags.test.tsx compara as duas listas.

export const MESA_TAGS = {
  musica: {
    rotulo: 'Música',
    itens: {
      sertanejo: 'Sertanejo', funk: 'Funk', rock: 'Rock', pop: 'Pop', eletronica: 'Eletrônica', mpb: 'MPB',
      samba_pagode: 'Samba e pagode', forro: 'Forró', rap_trap: 'Rap e trap', jazz_blues: 'Jazz e blues',
      indie: 'Indie', reggae: 'Reggae', kpop: 'K-pop',
    },
  },
  comida: {
    rotulo: 'Comida',
    itens: {
      brasileira: 'Brasileira', churrasco: 'Churrasco', japonesa: 'Japonesa', italiana: 'Italiana',
      mexicana: 'Mexicana', arabe: 'Árabe', chinesa: 'Chinesa', nordestina: 'Nordestina',
      hamburguer: 'Hambúrguer', pizza: 'Pizza', frutos_do_mar: 'Frutos do mar', doces: 'Doces', boteco: 'Boteco',
    },
  },
  passeios: {
    rotulo: 'Passeios',
    itens: {
      praia: 'Praia', trilha: 'Trilha', cachoeira: 'Cachoeira', parque: 'Parque', museu: 'Museu',
      teatro: 'Teatro', cinema: 'Cinema', show: 'Show', balada: 'Balada', barzinho: 'Barzinho',
      feira: 'Feira', stand_up: 'Stand-up',
    },
  },
  viagem: {
    rotulo: 'Viagem',
    itens: {
      praia: 'Praia', serra: 'Serra', campo: 'Campo', cidade_grande: 'Cidade grande', exterior: 'Exterior',
      mochilao: 'Mochilão', cruzeiro: 'Cruzeiro', estrada: 'Pé na estrada', ecoturismo: 'Ecoturismo',
      gastronomica: 'Gastronômica', festivais: 'Festivais',
    },
  },
  filmes: {
    rotulo: 'Filmes e séries',
    itens: {
      acao: 'Ação', comedia: 'Comédia', drama: 'Drama', terror: 'Terror', suspense: 'Suspense',
      ficcao_cientifica: 'Ficção científica', romance: 'Romance', animacao: 'Animação',
      documentario: 'Documentário', fantasia: 'Fantasia', policial: 'Policial', musical: 'Musical', series: 'Séries',
    },
  },
  idiomas: {
    rotulo: 'Idiomas',
    itens: {
      ingles: 'Inglês', espanhol: 'Espanhol', frances: 'Francês', italiano: 'Italiano', alemao: 'Alemão',
      japones: 'Japonês', mandarim: 'Mandarim', coreano: 'Coreano', russo: 'Russo',
    },
  },
  hobbies: {
    rotulo: 'Hobbies',
    itens: {
      academia: 'Academia', corrida: 'Corrida', futebol: 'Futebol', ciclismo: 'Ciclismo', games: 'Games',
      leitura: 'Leitura', fotografia: 'Fotografia', culinaria: 'Culinária', danca: 'Dança',
      tocar_instrumento: 'Tocar instrumento', desenho_pintura: 'Desenho e pintura', jardinagem: 'Jardinagem',
      pets: 'Pets', jogos_de_tabuleiro: 'Jogos de tabuleiro',
    },
  },
} as const

export type MesaCategoria = keyof typeof MESA_TAGS
export type MesaTags = Partial<Record<MesaCategoria, string[]>>
export const MESA_TAGS_MAX = 8 // por categoria, como no SQL
export const MESA_CATEGORIAS = Object.keys(MESA_TAGS) as MesaCategoria[]

export const ESCOLARIDADE = {
  fundamental: 'Ensino fundamental',
  medio: 'Ensino médio',
  tecnico: 'Curso técnico',
  superior_cursando: 'Superior (cursando)',
  superior: 'Superior completo',
  pos: 'Pós-graduação',
} as const
export type Escolaridade = keyof typeof ESCOLARIDADE

// As faixas vêm prontas de mesa_cartao (o banco nunca devolve a idade exata)
export const FAIXAS_IDADE: Record<string, string> = {
  '18–24': '18 a 24 anos',
  '25–34': '25 a 34 anos',
  '35–44': '35 a 44 anos',
  '45–59': '45 a 59 anos',
  '60+': '60 anos ou mais',
}

export function rotuloTag(cat: string, slug: string): string {
  const itens = MESA_TAGS[cat as MesaCategoria]?.itens as Record<string, string> | undefined
  return itens?.[slug] ?? slug
}

// Mesma regex do CHECK user_profiles_ext_social_url_chk
export const REDE_SOCIAL_RE = /^https:\/\/(www\.)?(instagram\.com|tiktok\.com|x\.com|twitter\.com|linkedin\.com)\/[A-Za-z0-9._~@/-]{1,100}$/

// "instagram.com/ana", "HTTP://Instagram.com/ana" → "https://instagram.com/ana". Domínio em minúsculas,
// caminho como veio. Devolve null se não passar na regex do banco.
export function normalizarRedeSocial(entrada: string): string | null {
  const s = entrada.trim()
  const m = s.match(/^(?:https?:\/\/)?([^/\s]+)(\/.*)?$/i)
  if (!m) return null
  const url = `https://${m[1].toLowerCase()}${m[2] ?? ''}`
  return REDE_SOCIAL_RE.test(url) ? url : null
}

// Etiquetas em comum, como "categoria:slug" (a mesma chave do Jaccard de mesa_compat)
export function etiquetasEmComum(a: MesaTags | null | undefined, b: MesaTags | null | undefined): Set<string> {
  const minhas = new Set(Object.entries(a ?? {}).flatMap(([c, l]) => (l ?? []).map(t => `${c}:${t}`)))
  return new Set(Object.entries(b ?? {}).flatMap(([c, l]) => (l ?? []).map(t => `${c}:${t}`)).filter(k => minhas.has(k)))
}
