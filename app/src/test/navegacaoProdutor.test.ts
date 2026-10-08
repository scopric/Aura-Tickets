import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { NAV, ROTA_CRIAR_EVENTO, SECOES, abreEvento, eventoDaUrl, filtra, hrefDaTela, trocaEvento } from '../lib/navegacaoProdutor'

const app = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8')
const rotasDoApp = new Set([...app.matchAll(/path="([^"]+)"/g)].map(m => m[1]))

describe('mapa de navegação do produtor (V4a)', () => {
  it('mapeia as 31 telas (30 na lista + o botão "+" de Criar evento), sem repetir', () => {
    expect(NAV).toHaveLength(30)
    expect(new Set(NAV.map(t => t.tela)).size).toBe(30)
    expect(new Set([...NAV.map(t => t.rota), ROTA_CRIAR_EVENTO]).size).toBe(31)
  })

  it('toda tela está numa seção do vocabulário e não existe "Ferramentas"', () => {
    for (const t of NAV) expect(SECOES).toContain(t.secao)
    expect(SECOES.some(s => /ferrament/i.test(s))).toBe(false)
  })

  it('no máximo 6 itens por seção, nos dois escopos', () => {
    for (const s of SECOES) {
      expect(NAV.filter(t => t.secao === s).length).toBeLessThanOrEqual(6)
      expect(filtra('produtora', s).length).toBeLessThanOrEqual(6)
      expect(filtra('evento', s).length).toBeLessThanOrEqual(6)
    }
  })

  it('toda rota existe no App.tsx', () => {
    for (const t of NAV) expect(rotasDoApp, `${t.tela}: ${t.rota}`).toContain(t.rota)
    expect(rotasDoApp).toContain(ROTA_CRIAR_EVENTO)
  })

  it('tela "Em breve" (ComingSoon) não entra no mapa: o menu só mostra telas prontas (Decisões 22 e 213)', () => {
    for (const t of NAV) {
      const linha = app.split('\n').find(l => l.includes(`path="${t.rota}"`)) ?? ''
      expect(linha, t.tela).not.toMatch(/<ComingSoon/)
    }
  })

  it('Decisão 213: as 7 rotas planejadas existem e mostram o cartão "Em breve", fora do menu', () => {
    for (const r of ['brand', 'comunicacao', 'assinatura', 'evokaa-store', 'marketing', 'antecipacao', 'parcelamento']) {
      const linha = app.split('\n').find(l => l.includes(`path="/producer/${r}"`)) ?? ''
      expect(linha, r).toMatch(/<ComingSoon /)
      expect(NAV.map(t => t.rota), r).not.toContain(`/producer/${r}`)
    }
  })

  it('Divulgação: item novo em Vendas, antes de Afiliados, sem tirar Afiliados, Banners e Lista de interesse', () => {
    const vendas = filtra('produtora', 'Vendas').map(t => t.tela)
    expect(vendas.indexOf('Divulgação')).toBeGreaterThanOrEqual(0)
    expect(vendas.indexOf('Divulgação')).toBeLessThan(vendas.indexOf('Afiliados'))
    for (const nome of ['Afiliados', 'Banners', 'Lista de interesse']) expect(vendas).toContain(nome)
    expect(filtra('evento', 'Vendas').map(t => t.noEvento)).toContain('Divulgação')
  })

  it('V7: a Visão geral é a tela do evento no mapa e não está atrás de "Em breve"', () => {
    const pasta = NAV.find(t => t.tela === 'Pasta do evento')!
    expect(pasta.rota).toBe('/producer/event/:eventId')
    expect(pasta.noEvento).toBe('Visão geral')
    expect(filtra('evento', 'Eventos').map(t => t.noEvento)).toContain('Visão geral')
  })

  it('Ingressos: seção Vendas, antes de Cupons, também no escopo do evento', () => {
    const vendas = filtra('evento', 'Vendas').map(t => t.noEvento)
    expect(NAV.find(t => t.tela === 'Ingressos')).toMatchObject({ secao: 'Vendas', rota: '/producer/ingressos', noEvento: 'Ingressos' })
    expect(vendas.indexOf('Ingressos')).toBeGreaterThanOrEqual(0)
    expect(vendas.indexOf('Ingressos')).toBeLessThan(vendas.indexOf('Cupons'))
    expect(hrefDaTela('/producer/ingressos', 'e1')).toBe('/producer/ingressos?eventId=e1')
  })

  it('Decisão 143: Banners, Lista de interesse, Galeria, Tarefas e CRM só no escopo da produtora', () => {
    for (const nome of ['Banners', 'Lista de interesse', 'Galeria', 'Tarefas', 'CRM']) {
      expect(NAV.find(t => t.tela === nome)?.noEvento, nome).toBeUndefined()
    }
  })

  it('escopo do evento: só telas com noEvento, nenhuma sem seção, sem Conta', () => {
    const telas = SECOES.flatMap(s => filtra('evento', s))
    expect(telas.every(t => t.noEvento)).toBe(true)
    expect(telas).toHaveLength(NAV.filter(t => t.noEvento).length)
    expect(filtra('evento', 'Conta')).toHaveLength(0)
  })

  it('escopo da produtora: tudo, menos Início (item solto) e a Pasta (linha do evento)', () => {
    const telas = SECOES.flatMap(s => filtra('produtora', s))
    expect(telas).toHaveLength(30 - 2)
  })
})

describe('evento na URL', () => {
  it('lê o evento do caminho e do ?eventId=', () => {
    expect(eventoDaUrl('/producer/events/abc/edit', '')).toBe('abc')
    expect(eventoDaUrl('/producer/event/xyz', '')).toBe('xyz')
    expect(eventoDaUrl('/producer/checkin', '?eventId=e1&tour=checkin')).toBe('e1')
  })

  it('% malformado na URL não derruba (não lança)', () => {
    expect(() => eventoDaUrl('/producer/events/%E0%A4%A/edit', '')).not.toThrow()
  })

  it('URL que não é de evento dá null (nem a criação de evento conta)', () => {
    expect(eventoDaUrl('/producer/events/new', '')).toBeNull()
    expect(eventoDaUrl('/producer/events', '')).toBeNull()
    expect(eventoDaUrl('/producer/checkin', '')).toBeNull()
  })

  it('monta o link com o evento sem perder a rota', () => {
    expect(hrefDaTela('/producer/checkin')).toBe('/producer/checkin')
    expect(hrefDaTela('/producer/checkin', 'e 1')).toBe('/producer/checkin?eventId=e%201')
    expect(hrefDaTela('/producer/events/:eventId/edit', 'e1')).toBe('/producer/events/e1/edit')
    expect(abreEvento('e1')).toBe('/producer/event/e1')
    expect(hrefDaTela(NAV.find(t => t.tela === 'Pasta do evento')!.rota, 'e1')).toBe('/producer/event/e1')
  })

  it('trocar de evento mantém a tela; tela fora do escopo do evento abre o novo evento', () => {
    expect(trocaEvento('/producer/checkin', 'e2')).toBe('/producer/checkin?eventId=e2')
    expect(trocaEvento('/producer/event/e1', 'e2')).toBe('/producer/event/e2')
    expect(trocaEvento('/producer/events/e1/edit', 'e2')).toBe('/producer/event/e2')
    expect(trocaEvento('/producer/crm', 'e2')).toBe('/producer/event/e2')
  })
})
