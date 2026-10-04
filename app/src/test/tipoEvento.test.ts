import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as front from '../lib/tipoEvento'
import * as shared from '../../../supabase/functions/_shared/tipoEvento'
import { FORMATOS, TEMAS, ESTILOS, CLASSIFICACOES, LOCAL_MODOS, ACEITE_VERSAO, textoAceite, rotuloFormato, avisoEntrada, pendencias } from '../lib/tipoEvento'
import { MESA_TAGS } from '../lib/mesaTags'

const slugs = (l: readonly { valor: string }[]) => l.map(x => x.valor)

describe('listas do tipo de evento', () => {
  it('tamanhos e slugs fixados no plano', () => {
    expect(FORMATOS).toHaveLength(13)
    expect(TEMAS).toHaveLength(14)
    expect(ESTILOS).toHaveLength(17)
    expect(slugs(CLASSIFICACOES)).toEqual(['AL', 'A6', 'A10', 'A12', 'A14', 'A16', 'A18'])
    expect(slugs(LOCAL_MODOS)).toEqual(['presencial', 'online', 'hibrido', 'a_definir'])
    for (const l of [FORMATOS, TEMAS, ESTILOS, CLASSIFICACOES, LOCAL_MODOS]) expect(new Set(slugs(l)).size).toBe(l.length)
  })

  it('os 13 estilos de música são os de MESA_TAGS.musica (mesmos slugs e rótulos)', () => {
    const doFront = Object.fromEntries(ESTILOS.slice(0, 13).map(e => [e.valor, e.rotulo]))
    expect(doFront).toEqual(MESA_TAGS.musica.itens)
    expect(slugs(ESTILOS).slice(13)).toEqual(['gospel', 'axe', 'classica', 'outro'])
  })
})

describe('cópia em supabase/functions/_shared', () => {
  it('é idêntica ao arquivo do app (texto e valores)', () => {
    const dir = resolve(__dirname, '../../..')
    expect(readFileSync(resolve(dir, 'supabase/functions/_shared/tipoEvento.ts'), 'utf8'))
      .toBe(readFileSync(resolve(dir, 'app/src/lib/tipoEvento.ts'), 'utf8'))
    expect(Object.keys(shared).sort()).toEqual(Object.keys(front).sort())
    expect(shared.FORMATOS).toEqual(front.FORMATOS)
    expect(shared.avisoEntrada('A14')).toBe(front.avisoEntrada('A14'))
  })
})

// O SQL da F1 fica no mesmo PR; renomeado, o teste falha (não some calado)
const SQL_PATH = resolve(__dirname, '../../../docs/sql/20261009_f1a_tipo_evento.sql')

describe('listas iguais às do SQL', () => {
  const sql = readFileSync(SQL_PATH, 'utf8')
  // a primeira array[...] do CHECK `nome`
  const listaDoCheck = (nome: string) => {
    const ini = sql.indexOf(`add constraint ${nome} `)
    expect(ini, nome).toBeGreaterThan(-1)
    const corpo = sql.slice(ini, sql.indexOf(';', ini))
    return [...corpo.match(/array\[([^\]]+)\]/)![1].matchAll(/'(\w+)'/g)].map(m => m[1])
  }

  it('temas, estilos, classificação e modo do local', () => {
    expect(listaDoCheck('events_temas_check')).toEqual(slugs(TEMAS))
    expect(listaDoCheck('events_estilos_check')).toEqual(slugs(ESTILOS))
    expect(listaDoCheck('events_classificacao_check')).toEqual(slugs(CLASSIFICACOES))
    expect(listaDoCheck('events_local_modo_check')).toEqual(slugs(LOCAL_MODOS))
  })

  it('ACEITE_VERSAO é a de aceite_evento_versao()', () => {
    const fn = sql.slice(sql.indexOf('function public.aceite_evento_versao'))
    expect(fn.match(/as \$\$ select '([^']+)' \$\$/)![1]).toBe(ACEITE_VERSAO)
  })
})

describe('rotuloFormato', () => {
  it('slug vira rótulo; texto antigo passa como está; vazio devolve ""', () => {
    expect(rotuloFormato('festa_encontro')).toBe('Festa ou encontro')
    expect(rotuloFormato('Festa')).toBe('Festa')
    expect(rotuloFormato(null)).toBe('')
    expect(rotuloFormato(undefined)).toBe('')
  })
})

describe('avisoEntrada (Portaria 1.048, art. 10)', () => {
  it('AL e A6: só a regra dos menores de 10 anos', () => {
    expect(avisoEntrada('AL')).toMatch(/^Livre para todos os públicos\. Menores de 10 anos só entram acompanhados/)
    expect(avisoEntrada('A6')).toMatch(/^Não recomendado para menores de 6 anos\. Menores de 10 anos só entram acompanhados/)
    expect(avisoEntrada('A6')).not.toMatch(/autorização por escrito/)
  })
  it('A10: sem a faixa intermediária; A12 a A16: de 10 até a idade menos 1, com responsável ou autorização', () => {
    expect(avisoEntrada('A10')).not.toMatch(/De 10 a/)
    expect(avisoEntrada('A12')).toMatch(/menores de 12 anos\. De 10 a 11 anos, só com o responsável ou um acompanhante autorizado por ele, ou com autorização por escrito/)
    expect(avisoEntrada('A16')).toMatch(/De 10 a 15 anos/)
  })
  it('A18: 16 e 17 com responsável ou autorização; menor de 16 não entra', () => {
    const t = avisoEntrada('A18')
    expect(t).toMatch(/Jovens de 16 e 17 anos entram só com o responsável/)
    expect(t).toMatch(/Menores de 16 não entram\./)
  })
  it('toda faixa avisa que o juiz local pode restringir; fora da lista não gera aviso', () => {
    for (const c of slugs(CLASSIFICACOES)) expect(avisoEntrada(c)).toMatch(/portaria do juiz local/)
    expect(avisoEntrada('A99')).toBe('')
    expect(avisoEntrada(null)).toBe('')
  })
})

describe('pendencias (os 8 itens da barra "N de 8 prontos")', () => {
  const pronto = {
    title: 'Forró da Vila', category: 'show', description: 'Uma noite de forró pé de serra.', date: '2099-11-20', time: '22:00',
    local_modo: 'presencial', venue_name: 'Arena', venue_city: 'Recife', classificacao: 'A16', aceite: true,
    ticket_types: [{ name: 'Pista', price: 40, quantity_total: 100 }],
  }
  const faltas = (e: Parameters<typeof pendencias>[0]) => pendencias(e).filter(p => !p.pronto).map(p => p.id)

  it('evento completo: 8 itens, nenhum pendente', () => {
    expect(pendencias(pronto)).toHaveLength(8)
    expect(faltas(pronto)).toEqual([])
  })
  it('evento vazio: tudo pendente, menos o modo do local presencial sem local', () => {
    expect(faltas({})).toEqual(['nome', 'formato', 'descricao', 'data', 'local', 'ingresso', 'classificacao', 'aceite'])
  })
  it('sem data (date vazio) acusa, e só a hora também', () => {
    expect(faltas({ ...pronto, date: '' })).toEqual(['data'])
    expect(faltas({ ...pronto, date: null })).toEqual(['data'])
    expect(faltas({ ...pronto, time: null })).toEqual(['data'])
  })
  it('online sem link https acusa; com link passa sem local; http não vale', () => {
    const online = { ...pronto, local_modo: 'online', venue_name: null, venue_city: null }
    expect(faltas(online)).toEqual(['local'])
    expect(faltas({ ...online, online_url: 'http://x.com/sala' })).toEqual(['local'])
    expect(faltas({ ...online, online_url: 'https://meet.example.com/sala' })).toEqual([])
  })
  it('híbrido exige local e link; presencial exige local e cidade', () => {
    expect(faltas({ ...pronto, local_modo: 'hibrido' })).toEqual(['local'])
    expect(faltas({ ...pronto, local_modo: 'hibrido', online_url: 'https://x.com/a' })).toEqual([])
    expect(faltas({ ...pronto, venue_city: '' })).toEqual(['local'])
    expect(faltas({ ...pronto, venue_name: ' ' })).toEqual(['local'])
  })
  it('local_modo ausente conta como presencial', () => {
    expect(faltas({ ...pronto, local_modo: null, venue_name: null })).toEqual(['local'])
  })
  it('esporte não exige classificação; outro formato exige, e valor fora da lista não vale', () => {
    expect(faltas({ ...pronto, category: 'esporte', classificacao: null })).toEqual([])
    expect(faltas({ ...pronto, classificacao: null })).toEqual(['classificacao'])
    expect(faltas({ ...pronto, classificacao: '18' })).toEqual(['classificacao'])
  })
  it('a_definir conta como local pronto, mesmo sem endereço', () => {
    expect(faltas({ ...pronto, local_modo: 'a_definir', venue_name: null, venue_city: null })).toEqual([])
  })
  it('formato antigo em texto livre ("Festa") ainda pede o formato', () => {
    expect(faltas({ ...pronto, category: 'Festa' })).toEqual(['formato'])
  })
  it('ingresso: precisa de nome e quantidade, e nenhum com preço negativo; grátis vale', () => {
    expect(faltas({ ...pronto, ticket_types: [] })).toEqual(['ingresso'])
    expect(faltas({ ...pronto, ticket_types: [{ name: '', price: 10, quantity_total: 5 }] })).toEqual(['ingresso'])
    expect(faltas({ ...pronto, ticket_types: [{ name: 'X', price: 10, quantity_total: 0 }] })).toEqual(['ingresso'])
    expect(faltas({ ...pronto, ticket_types: [{ name: 'X', price: -1, quantity_total: 5 }] })).toEqual(['ingresso'])
    expect(faltas({ ...pronto, ticket_types: [{ name: 'Grátis', price: 0, capacity: 5 }] })).toEqual([])
  })
  it('descrição curta e aceite ausente acusam', () => {
    expect(faltas({ ...pronto, description: 'curta' })).toEqual(['descricao'])
    expect(faltas({ ...pronto, aceite: false })).toEqual(['aceite'])
  })
})

describe('textoAceite', () => {
  const base = { titulo: '  Noite de Forró ', formato: 'festa_encontro', classificacao: 'A16', temBebida: true }
  it('leva o nome do evento, a classificação, a bebida e a versão', () => {
    const t = textoAceite(base)
    expect(t).toContain('Ao enviar o evento "Noite de Forró" para aprovação')
    expect(t).toContain('Autoclassifiquei o evento como A16 (16 anos)')
    expect(t).toContain('quem vende e serve a bebida alcoólica')
    expect(t).toContain(`Versão ${ACEITE_VERSAO}.`)
    expect(t.split('\n')).toHaveLength(9)
  })
  it('variantes: sem bebida e esporte', () => {
    expect(textoAceite({ ...base, temBebida: false })).toContain('Nenhum ingresso deste evento inclui bebida alcoólica.')
    const esporte = textoAceite({ ...base, formato: 'esporte', classificacao: null })
    expect(esporte).toContain('não é objeto de classificação indicativa')
    expect(esporte).not.toContain('Autoclassifiquei')
  })
  it('muda quando muda o que foi declarado (o hash muda junto)', () => {
    expect(textoAceite(base)).not.toBe(textoAceite({ ...base, classificacao: 'A18' }))
    expect(textoAceite(base)).toBe(textoAceite({ ...base }))
  })
})
