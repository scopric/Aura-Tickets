import { describe, it, expect, beforeEach } from 'vitest'
import {
  CANAIS, MAX_LISTA, comLinkNovo, csvInteressados, gravarLinks, lerLinks, linkComUtm, linkDoEvento, normalizaCampanha, temLinkPublico,
  type LinkSalvo,
} from '../lib/divulgacao'

describe('normalizaCampanha', () => {
  it('minúscula, sem acento, hífen no lugar do resto, sem hífen nas pontas', () => {
    expect(normalizaCampanha('  Lançamento: Lote 1! ')).toBe('lancamento-lote-1')
    expect(normalizaCampanha('---x---')).toBe('x')
    expect(normalizaCampanha('😀 ??')).toBe('')
  })
  it('limita a 40 caracteres sem deixar hífen no fim', () => {
    const r = normalizaCampanha(`${'a'.repeat(39)} bbbb`)
    expect(r.length).toBeLessThanOrEqual(40)
    expect(r.endsWith('-')).toBe(false)
  })
})

describe('linkComUtm', () => {
  const base = 'https://www.evokaa.com.br/event/festa-um'
  it('cada canal tem source e medium próprios', () => {
    expect(new Set(CANAIS.map(c => c.id)).size).toBe(5)
    const u = new URL(linkComUtm(base, 'whatsapp', 'Lote 1'))
    expect(u.origin + u.pathname).toBe(base)
    expect(u.searchParams.get('utm_source')).toBe('whatsapp')
    expect(u.searchParams.get('utm_medium')).toBe('mensagem')
    expect(u.searchParams.get('utm_campaign')).toBe('lote-1')
  })
  it('campanha vazia não cria utm_campaign', () => {
    expect(new URL(linkComUtm(base, 'email', '  ')).searchParams.has('utm_campaign')).toBe(false)
  })
  it('texto da campanha não injeta parâmetro, âncora nem outro endereço', () => {
    const u = new URL(linkComUtm(base, 'instagram', 'x&utm_source=evil&redirect=https://evil.com#frag/../..'))
    expect([...u.searchParams.keys()].sort()).toEqual(['utm_campaign', 'utm_medium', 'utm_source'])
    expect(u.searchParams.get('utm_source')).toBe('instagram')
    expect(u.hash).toBe('')
    expect(u.host).toBe('www.evokaa.com.br')
  })
  it('mantém query que já existia no endereço e troca utm antigo', () => {
    const u = new URL(linkComUtm(`${base}?a=1&utm_source=velho`, 'cartaz', 'p'))
    expect(u.searchParams.get('a')).toBe('1')
    expect(u.searchParams.getAll('utm_source')).toEqual(['cartaz'])
  })
})

describe('link público do evento', () => {
  it('só evento publicado e aprovado', () => {
    expect(temLinkPublico({ status: 'published', approval_status: 'approved' })).toBe(true)
    expect(temLinkPublico({ status: 'published', approval_status: 'pending' })).toBe(false)
    expect(temLinkPublico({ status: 'draft' })).toBe(false)
  })
  it('usa o slug se o evento é público e o id se não é', () => {
    expect(linkDoEvento({ id: 'u1', slug: 'festa', visibility: 'public' })).toMatch(/\/event\/festa$/)
    expect(linkDoEvento({ id: 'u1', slug: 'festa', visibility: 'unlisted' })).toMatch(/\/event\/u1$/)
  })
})

const BASE = `${window.location.protocol}//${window.location.host}/event`

describe('lista guardada no navegador', () => {
  beforeEach(() => localStorage.clear())
  const item = (n: number, url = `${BASE}/${n}`): LinkSalvo => ({ id: `i${n}`, eventId: 'e1', evento: 'Festa', canal: 'email', campanha: '', url, criadoEm: '2026-10-08T10:00:00Z' })

  it('novo vai para o topo, mesmo endereço não repete e passa de 30 corta o mais antigo', () => {
    let l: LinkSalvo[] = []
    for (let n = 0; n < 35; n++) l = comLinkNovo(l, item(n))
    expect(l).toHaveLength(MAX_LISTA)
    expect(l[0].id).toBe('i34')
    expect(comLinkNovo(l, item(99, `${BASE}/10`))).toHaveLength(MAX_LISTA)
    expect(comLinkNovo(l, item(99, `${BASE}/10`))[0].id).toBe('i99')
  })
  it('é por usuário e volta igual', () => {
    expect(gravarLinks('u1', [item(1)])).toBe(true)
    expect(lerLinks('u1')).toEqual([item(1)])
    expect(lerLinks('u2')).toEqual([])
  })
  it('lixo no armazenamento (JSON ruim, formato errado, url que não é do site, canal desconhecido) é descartado', () => {
    localStorage.setItem('evk.divulgacao.u1', '{nao-json')
    expect(lerLinks('u1')).toEqual([])
    localStorage.setItem('evk.divulgacao.u1', JSON.stringify({ a: 1 }))
    expect(lerLinks('u1')).toEqual([])
    localStorage.setItem('evk.divulgacao.u1', JSON.stringify([item(1), { ...item(2), url: 'javascript:alert(1)' }, { ...item(4), url: 'https://evil.com/event/x' }, { ...item(3), canal: 'tiktok' }, 'x', null]))
    expect(lerLinks('u1').map(l => l.id)).toEqual(['i1'])
  })
})

describe('csvInteressados', () => {
  it('aviso de dado pessoal na primeira linha, só as colunas da tela e fórmula neutralizada', () => {
    const csv = csvInteressados([
      { full_name: '=HYPERLINK("x")', email: 'ana@x.y', city: 'Curitiba', event_title: 'Festa', created_at: '2026-10-01T10:00:00Z', notified_at: '2026-10-10T10:00:00Z' },
      { full_name: null, email: null, city: null, event_title: 'Festa', created_at: '2026-10-02T10:00:00Z', notified_at: null },
    ])
    const linhas = csv.replace('﻿', '').split('\r\n')
    expect(linhas[0]).toContain('dados pessoais')
    expect(linhas[1]).toBe('nome;email;cidade;evento;inscricao;avisado_em')
    expect(linhas[2]).toContain("\"'=HYPERLINK(")
    expect(linhas[2]).toContain('ana@x.y;Curitiba;Festa;2026-10-01;2026-10-10')
    expect(linhas[3]).toBe(';;;Festa;2026-10-02;')
    expect(csv.startsWith('﻿')).toBe(true)
  })
})
