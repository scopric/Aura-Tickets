// Vocabulário do tipo de evento (F1): formato (events.category), temas, estilos musicais, classificação e modo do
// local. Os slugs são os mesmos dos CHECKs de events em docs/sql/20261009_f1a_tipo_evento.sql e do Evo
// (supabase/functions/agent). Este arquivo é IDÊNTICO a supabase/functions/_shared/tipoEvento.ts (a Edge Function em
// Deno não importa de app/src): src/test/tipoEvento.test.ts compara as duas cópias, o SQL e mesaTags.ts.
// Mudou aqui? Copie para o _shared e confira o SQL.

export const FORMATOS = [
  { valor: 'festa_encontro', rotulo: 'Festa ou encontro' },
  { valor: 'show', rotulo: 'Show ou apresentação' },
  { valor: 'festival_feira', rotulo: 'Festival ou feira' },
  { valor: 'balada', rotulo: 'Balada' },
  { valor: 'teatro_standup', rotulo: 'Teatro, stand-up ou espetáculo' },
  { valor: 'palestra_congresso', rotulo: 'Palestra ou congresso' },
  { valor: 'curso_workshop', rotulo: 'Curso ou workshop' },
  { valor: 'networking', rotulo: 'Networking' },
  { valor: 'jantar_degustacao', rotulo: 'Jantar, gala ou degustação' },
  { valor: 'esporte', rotulo: 'Esporte ou corrida' },
  { valor: 'passeio_experiencia', rotulo: 'Passeio ou experiência' },
  { valor: 'celebracao', rotulo: 'Celebração (casamento, formatura, aniversário)' },
  { valor: 'outro', rotulo: 'Outro' },
] as const

export const TEMAS = [
  { valor: 'musica', rotulo: 'Música' },
  { valor: 'gastronomia_bebidas', rotulo: 'Gastronomia e bebidas' },
  { valor: 'negocios', rotulo: 'Negócios' },
  { valor: 'tecnologia', rotulo: 'Tecnologia' },
  { valor: 'arte_cultura', rotulo: 'Arte e cultura' },
  { valor: 'bem_estar', rotulo: 'Bem-estar' },
  { valor: 'esportes', rotulo: 'Esportes' },
  { valor: 'religiao', rotulo: 'Religião' },
  { valor: 'infantil_familia', rotulo: 'Infantil e família' },
  { valor: 'educacao', rotulo: 'Educação' },
  { valor: 'moda', rotulo: 'Moda' },
  { valor: 'causas_sociais', rotulo: 'Causas sociais' },
  { valor: 'ar_livre', rotulo: 'Ar livre' },
  { valor: 'datas_comemorativas', rotulo: 'Datas comemorativas' },
] as const

// Os 13 primeiros são os de MESA_TAGS.musica (mesmos slugs e rótulos); o teste confere
export const ESTILOS = [
  { valor: 'sertanejo', rotulo: 'Sertanejo' },
  { valor: 'funk', rotulo: 'Funk' },
  { valor: 'rock', rotulo: 'Rock' },
  { valor: 'pop', rotulo: 'Pop' },
  { valor: 'eletronica', rotulo: 'Eletrônica' },
  { valor: 'mpb', rotulo: 'MPB' },
  { valor: 'samba_pagode', rotulo: 'Samba e pagode' },
  { valor: 'forro', rotulo: 'Forró' },
  { valor: 'rap_trap', rotulo: 'Rap e trap' },
  { valor: 'jazz_blues', rotulo: 'Jazz e blues' },
  { valor: 'indie', rotulo: 'Indie' },
  { valor: 'reggae', rotulo: 'Reggae' },
  { valor: 'kpop', rotulo: 'K-pop' },
  { valor: 'gospel', rotulo: 'Gospel' },
  { valor: 'axe', rotulo: 'Axé' },
  { valor: 'classica', rotulo: 'Clássica' },
  { valor: 'outro', rotulo: 'Outro' },
] as const

// Símbolos de autoclassificação (Portaria MJSP 1.048)
export const CLASSIFICACOES = [
  { valor: 'AL', rotulo: 'Livre' },
  { valor: 'A6', rotulo: '6 anos' },
  { valor: 'A10', rotulo: '10 anos' },
  { valor: 'A12', rotulo: '12 anos' },
  { valor: 'A14', rotulo: '14 anos' },
  { valor: 'A16', rotulo: '16 anos' },
  { valor: 'A18', rotulo: '18 anos' },
] as const

export const LOCAL_MODOS = [
  { valor: 'presencial', rotulo: 'Presencial' },
  { valor: 'online', rotulo: 'Online' },
  { valor: 'hibrido', rotulo: 'Híbrido' },
  { valor: 'a_definir', rotulo: 'A definir' },
] as const

export type Formato = (typeof FORMATOS)[number]['valor']
export type Tema = (typeof TEMAS)[number]['valor']
export type Estilo = (typeof ESTILOS)[number]['valor']
export type Classificacao = (typeof CLASSIFICACOES)[number]['valor']
export type LocalModo = (typeof LOCAL_MODOS)[number]['valor']

export const MAX_TEMAS = 3
export const MAX_ESTILOS = 3

// slug → rótulo. Texto antigo de events.category ("Festa", "Música"…) passa como está; sem categoria devolve ''.
export const rotuloFormato = (slug: string | null | undefined): string =>
  FORMATOS.find((f) => f.valor === slug)?.rotulo ?? slug ?? ''

// Aceite do produtor (Decisão 148, item 6; texto final = rascunho v1 aprovado pelo Ricardo em 04/10/2026, nota
// "2026-10-04 Aceite do produtor da F1 — rascunho para o jurídico"). A versão é a de aceite_evento_versao() no SQL.
// O servidor (aceite-evento) monta o texto com o nome do evento e as variantes e grava o hash DESTE texto montado;
// a tela (PR3) mostra o mesmo texto. O teste fixa o sha256 de um caso: mudou uma vírgula? Versão nova aqui, no _shared e no SQL (Decisão 6).
export const ACEITE_VERSAO = '2026-10-04'

export function textoAceite(e: { titulo: string; formato: string | null; classificacao: string | null; temBebida: boolean }): string {
  const c = CLASSIFICACOES.find((x) => x.valor === e.classificacao)
  const classificacao = e.formato === 'esporte'
    ? '2. O evento é esportivo e não é objeto de classificação indicativa.'
    : `2. Autoclassifiquei o evento como ${c ? `${c.valor} (${c.rotulo})` : '[sem classificação]'} pelos critérios do Ministério da Justiça para apresentações ao vivo. Sou o responsável por exibir o símbolo e as demais informações obrigatórias no local e por controlar a entrada de crianças e adolescentes.`
  const bebida = e.temBebida
    ? '4. Sou eu, e não a Evokaa, quem vende e serve a bebida, e não vou vendê-la, fornecê-la nem servi-la a menor de 18 anos.'
    : '4. Nenhum ingresso deste evento inclui bebida alcoólica.'
  return [
    'Termo do produtor para publicar evento',
    `Ao enviar o evento "${e.titulo.trim()}" para aprovação, declaro que:`,
    '1. Sou o organizador do evento ou tenho poderes para representá-lo, e as informações publicadas são verdadeiras: data, local, ingressos e preços.',
    classificacao,
    '3. Na entrada, vou aplicar as regras de acesso de crianças e adolescentes: acompanhamento, autorização por escrito do responsável e a portaria ou o alvará do juiz da comarca, quando houver. Também vou conferir documento com foto e idade.',
    bebida,
    '5. Se eu mudar a classificação ou a bebida de algum ingresso depois da aprovação, refaço este termo antes de enviar as alterações.',
    '6. Sei que a Evokaa intermedeia a venda de ingressos e pode recusar ou tirar do ar um evento em desacordo com este termo ou com os Termos de Uso.',
    `A Evokaa registra a data, a hora, o IP e o navegador deste aceite. Versão ${ACEITE_VERSAO}.`,
  ].join('\n')
}

// Aviso de entrada por faixa: Portaria MJSP 1.048, art. 10, e ECA, art. 75, parágrafo único. Texto de rascunho
// (prancha aprovada em 04/10/2026), a confirmar pelo jurídico. Classificação fora da lista: sem aviso.
export function avisoEntrada(c: string | null | undefined): string {
  if (!CLASSIFICACOES.some((x) => x.valor === c)) return ''
  const base = 'Menores de 10 anos só entram acompanhados dos pais ou do responsável.'
  const aut = 'só com o responsável ou um acompanhante autorizado por ele, ou com autorização por escrito assinada pelo responsável.'
  const juiz = ' Uma portaria do juiz local pode ser mais restritiva.'
  if (c === 'AL') return `Livre para todos os públicos. ${base}${juiz}`
  if (c === 'A6') return `Não recomendado para menores de 6 anos. ${base}${juiz}`
  if (c === 'A18') return `Não recomendado para menores de 18 anos. Jovens de 16 e 17 anos entram ${aut} Menores de 16 não entram.${juiz}`
  const n = parseInt(c!.slice(1), 10)
  return `Não recomendado para menores de ${n} anos. ${n > 10 ? `De 10 a ${n - 1} anos, ${aut} ` : ''}${base}${juiz}`
}

// O que `pendencias` precisa: o evento (colunas de events), o link online (evento_privado.online_url), se há aceite
// gravado e os ingressos (ticket_types). Tudo opcional: campo ausente conta como pendente.
export type EntradaPendencias = {
  title?: string | null
  category?: string | null
  description?: string | null
  date?: string | null
  time?: string | null
  local_modo?: string | null
  venue_name?: string | null
  venue_city?: string | null
  classificacao?: string | null
  online_url?: string | null
  aceite?: boolean
  ticket_types?: { name?: string | null; price?: number | string | null; quantity_total?: number | null; capacity?: number | null }[] | null
}

export type Pendencia = { id: 'nome' | 'formato' | 'descricao' | 'data' | 'local' | 'ingresso' | 'classificacao' | 'aceite'; rotulo: string; pronto: boolean }

// Os 8 itens da barra "N de 8 prontos" (prancha, 04/10/2026). A capa é opcional (sem foto vira cartaz).
export function pendencias(e: EntradaPendencias): Pendencia[] {
  const modo = e.local_modo || 'presencial'
  const linkOk = /^https:\/\/.+/.test(e.online_url ?? '')
  const presencialOk = !!(e.venue_name?.trim() && e.venue_city?.trim())
  const localOk = modo === 'a_definir' || (modo === 'online' ? linkOk : modo === 'hibrido' ? presencialOk && linkOk : presencialOk)
  const ingressos = e.ticket_types ?? []
  const ingressoOk = ingressos.some((t) => t.name?.trim() && (t.quantity_total ?? t.capacity ?? 0) > 0) && ingressos.every((t) => Number(t.price ?? 0) >= 0)
  return [
    { id: 'nome', rotulo: 'Nome do evento', pronto: !!e.title?.trim() },
    { id: 'formato', rotulo: 'Formato', pronto: FORMATOS.some((f) => f.valor === e.category) },
    { id: 'descricao', rotulo: 'Descrição', pronto: (e.description?.trim().length ?? 0) >= 20 },
    { id: 'data', rotulo: 'Data e hora de início', pronto: !!e.date && !!e.time },
    { id: 'local', rotulo: modo === 'online' ? 'Link da transmissão (https)' : modo === 'hibrido' ? 'Local, cidade e link (https)' : 'Local e cidade', pronto: localOk },
    { id: 'ingresso', rotulo: 'Ingresso com quantidade e preço válido', pronto: ingressoOk },
    { id: 'classificacao', rotulo: 'Classificação indicativa', pronto: e.category === 'esporte' || CLASSIFICACOES.some((c) => c.valor === e.classificacao) },
    { id: 'aceite', rotulo: 'Aceite do produtor', pronto: !!e.aceite },
  ]
}
