import { describe, it, expect } from 'vitest'
import { sugestaoDoEvo, temPortaria, type DadosSugestao } from '../lib/inicioProdutor'
import type { DbEvent } from '../hooks/useEvents'

const DIA = 86400000
const agora = Date.parse('2026-10-10T12:00:00-03:00') // 10/10/2026, meio-dia em Brasília
const dia = (n: number) => new Date(agora + n * DIA - 3 * 3600000).toISOString().slice(0, 10) // a data de Brasília, n dias depois
const FOTO = 'https://x.supabase.co/storage/capa.jpg'
const nada = new Set<string>()
const tt = (cap: number) => [{ id: 'tt1', name: 'Pista', quantity_total: cap, capacity: null, is_active: true }]

// evento no ar, com foto, ingressos, daqui a 30 dias e aprovado há 1 dia: nenhuma regra vale por padrão
const ev = (o: Record<string, unknown> = {}) => ({
  id: 'e1', title: 'Show', status: 'published', approval_status: 'approved', approved_at: new Date(agora - DIA).toISOString(),
  date: dia(30), time: '22:00:00', start_date: new Date(agora - 40 * DIA).toISOString(), end_date: null,
  cover_image: FOTO, image_url: null, capacity: null, ticket_types: tt(100), ...o,
}) as unknown as DbEvent
const dados = (eventos: DbEvent[], o: Partial<DadosSugestao> = {}): DadosSugestao => ({
  eventos, vendidos: { porEvento: { e1: 1 }, cortado: false }, porTipo: { tt1: 1 }, checkinFeito: true, empresa: true, ...o,
})
const chaveDe = (d: DadosSugestao, r = nada) => sugestaoDoEvo(d, r, agora)?.chave

describe('Evo sugere: uma regra por vez', () => {
  it('nenhuma vale: null', () => {
    expect(sugestaoDoEvo(dados([ev()]), nada, agora)).toBeNull()
    expect(sugestaoDoEvo(dados([]), nada, agora)).toBeNull()
  })

  it('1. recusado: texto com o motivo, ou sem a citação quando não há motivo', () => {
    const e = ev({ approval_status: 'rejected', rejection_reason: 'Falta o endereço' })
    const s = sugestaoDoEvo(dados([e]), nada, agora)!
    expect(s.chave).toMatch(/^sugestao:recusado:e1:[0-9a-z]+$/)
    expect(s.texto).toBe('O Show voltou da análise com um pedido de ajuste: "Falta o endereço". Corrija e envie de novo.')
    expect(s.acao).toEqual({ texto: 'Abrir evento', to: '/producer/events/e1/edit' })
    expect(sugestaoDoEvo(dados([ev({ approval_status: 'rejected', rejection_reason: null })]), nada, agora)!.texto)
      .toBe('O Show voltou da análise com um pedido de ajuste. Corrija e envie de novo.')
  })

  it('1. recusa dispensada volta com motivo novo; recusado de evento que já passou não aparece', () => {
    const com = (motivo: string, o = {}) => dados([ev({ approval_status: 'rejected', rejection_reason: motivo, ...o })])
    const antiga = chaveDe(com('Falta o endereço'))!
    expect(chaveDe(com('Falta o endereço'), new Set([antiga]))).toBeUndefined()
    const nova = chaveDe(com('Falta a classificação'), new Set([antiga]))
    expect(nova).toMatch(/^sugestao:recusado:e1:/)
    expect(nova).not.toBe(antiga)
    expect(chaveDe(com('Falta o endereço', { date: dia(-30) }))).toBeUndefined()
  })

  it('2. lote com 90% ou mais: mesma chave de antes (tipo + capacidade), barra e "+" com a lista cortada', () => {
    const d = dados([ev({ ticket_types: tt(10) })], { porTipo: { tt1: 9 } })
    const s = sugestaoDoEvo(d, nada, agora)!
    expect(s.chave).toBe('aviso-lote:tt1:10')
    expect(s.texto).toBe('Pista do Show: 9 de 10 vendidos.')
    expect(s.barra).toEqual({ pct: 90, mais: false })
    expect(sugestaoDoEvo({ ...d, vendidos: { porEvento: { e1: 9 }, cortado: true } }, nada, agora)!.texto).toBe('Pista do Show: 9+ de 10 vendidos.')
    expect(sugestaoDoEvo(dados([ev({ ticket_types: tt(10) })], { porTipo: { tt1: 11 } }), nada, agora)!.barra!.pct).toBeCloseTo(110) // a tela limita só a largura
    expect(chaveDe(dados([ev({ ticket_types: tt(10) })], { porTipo: { tt1: 8 } }))).toBeUndefined() // 80%
    expect(chaveDe(dados([ev({ ticket_types: tt(10), approval_status: 'pending' })], { porTipo: { tt1: 10 } }))).toBeUndefined() // não está no ar
  })

  it('3. testar o check-in: no ar, faltam até 7 dias, 1 vendido, nenhum check-in', () => {
    const d = (n: number, o: Partial<DadosSugestao> = {}) => dados([ev({ date: dia(n) })], { checkinFeito: false, ...o })
    expect(chaveDe(d(7))).toBe('dica:checkin:e1')
    expect(sugestaoDoEvo(d(7), nada, agora)!.texto).toBe('Teste o check-in do Show antes do dia.')
    expect(chaveDe(d(8))).toBeUndefined()
    expect(chaveDe(d(7, { checkinFeito: true }))).toBeUndefined()
    expect(chaveDe(d(7, { checkinFeito: undefined }))).toBeUndefined() // ainda não carregou
    expect(chaveDe(d(7, { vendidos: { porEvento: {}, cortado: false } }))).toBeUndefined() // nenhum vendido
    expect(sugestaoDoEvo(d(3), nada, agora)!.acao).toEqual({ texto: 'Abrir check-in', to: '/producer/checkin?tour=checkin' })
    // já começou (hoje às 11h, agora é meio-dia): "antes do dia" não faz mais sentido
    expect(chaveDe(dados([ev({ date: dia(0), time: '11:00:00' })], { checkinFeito: false }))).toBeUndefined()
    expect(chaveDe(dados([ev({ date: dia(0), time: '20:00:00' })], { checkinFeito: false }))).toBe('dica:checkin:e1')
  })

  it('4. rascunho sem ingresso (com data passada não)', () => {
    const rascunho = (o = {}) => ev({ status: 'draft', approval_status: 'pending', ticket_types: [], ...o })
    expect(chaveDe(dados([rascunho()]))).toBe('sugestao:sem-ingresso:e1')
    expect(chaveDe(dados([rascunho({ date: null, start_date: 'invalido' })]))).toBe('sugestao:sem-ingresso:e1') // rascunho novo, sem data
    expect(chaveDe(dados([rascunho({ date: dia(-30) })]))).toBeUndefined()
    expect(chaveDe(dados([rascunho({ ticket_types: tt(10) })]))).toBeUndefined()
    expect(sugestaoDoEvo(dados([rascunho()]), nada, agora)!.texto).toBe('O Show ainda não tem ingressos. Crie pelo menos um para poder vender.')
  })

  it('5. no ar e sem venda há 3 dias ou mais de aprovado', () => {
    const d = (dias: number, o: Partial<DadosSugestao> = {}) =>
      dados([ev({ approved_at: new Date(agora - dias * DIA).toISOString() })], { vendidos: { porEvento: {}, cortado: false }, ...o })
    expect(chaveDe(d(3))).toBe('sugestao:sem-venda:e1')
    expect(chaveDe(d(3 - 1 / 24))).toBeUndefined() // 2 dias e 23 h
    expect(sugestaoDoEvo(d(5), nada, agora)).toMatchObject({
      texto: 'O Show está no ar há 5 dias e ainda não vendeu. Compartilhe o link com o seu público.',
      acao: { texto: 'Copiar link', copiar: 'e1' },
    })
    // slug só em evento público; fora dele o link usa o id (refDoEvento)
    expect(sugestaoDoEvo(dados([ev({ slug: 'show-x', visibility: 'public', approved_at: new Date(agora - 5 * DIA).toISOString() })], { vendidos: { porEvento: {}, cortado: false } }), nada, agora)!.acao.copiar).toBe('show-x')
    expect(chaveDe(d(5, { vendidos: { porEvento: { e1: 1 }, cortado: false } }))).toBeUndefined()
    expect(chaveDe(d(5, { vendidos: { porEvento: {}, cortado: true } }))).toBeUndefined() // lista cortada: zero não é certeza
    expect(chaveDe(d(5, { vendidos: undefined }))).toBeUndefined() // vendas ainda não chegaram
    expect(chaveDe(dados([ev({ approved_at: null })], { vendidos: { porEvento: {}, cortado: false } }))).toBeUndefined()
  })

  it('6. sem foto de capa (foto padrão conta como sem foto; evento passado não)', () => {
    expect(chaveDe(dados([ev({ cover_image: null })]))).toBe('sugestao:sem-foto:e1')
    expect(chaveDe(dados([ev({ cover_image: '/images/hero-bg.jpg' })]))).toBe('sugestao:sem-foto:e1')
    expect(chaveDe(dados([ev({ cover_image: null, image_url: FOTO })]))).toBeUndefined()
    expect(chaveDe(dados([ev({ cover_image: null, date: dia(-2) })]))).toBe('sugestao:pos-evento:e1') // já passou: vale a do relatório, não a da foto
    expect(sugestaoDoEvo(dados([ev({ cover_image: null })]), nada, agora)!.acao).toEqual({ texto: 'Adicionar foto', to: '/producer/events/e1/edit' })
  })

  it('7. pós-evento: terminou há até 7 dias e teve venda', () => {
    const d = (n: number, o: Partial<DadosSugestao> = {}) => dados([ev({ date: dia(n) })], o) // começa às 22h; fim = 10h do dia seguinte
    expect(chaveDe(dados([ev({ date: dia(0), time: '11:00:00' })]))).toBeUndefined() // no dia, 1 h depois do início: está acontecendo
    expect(chaveDe(dados([ev({ date: dia(0), time: null })]))).toBeUndefined() // só com o dia: vale 24 h
    expect(chaveDe(dados([ev({ date: dia(-1), time: null })]))).toBe('sugestao:pos-evento:e1') // dia inteiro de ontem: fim hoje 00h
    expect(chaveDe(dados([ev({ date: dia(-2), time: '22:00:00' })]))).toBe('sugestao:pos-evento:e1') // fim + 1 dia
    expect(chaveDe(dados([ev({ date: dia(-9), time: '22:00:00' })]))).toBeUndefined() // fim + 8 dias
    expect(chaveDe(dados([ev({ date: dia(-9), time: '22:00:00', end_date: new Date(agora - DIA).toISOString() })]))).toBe('sugestao:pos-evento:e1') // end_date manda
    expect(chaveDe(d(-1))).toBe('sugestao:pos-evento:e1')
    expect(chaveDe(d(-6))).toBe('sugestao:pos-evento:e1')
    expect(chaveDe(d(-8))).toBeUndefined() // terminou há mais de 7 dias
    expect(chaveDe(d(-1, { vendidos: { porEvento: {}, cortado: false } }))).toBeUndefined() // sem venda
    expect(chaveDe(dados([ev({ date: dia(-1), approval_status: 'pending' })]))).toBeUndefined() // nunca foi ao ar
    expect(sugestaoDoEvo(d(-1), nada, agora)).toMatchObject({
      texto: 'O Show terminou. Veja quantas pessoas entraram no relatório pós-evento.',
      acao: { to: '/producer/pos-evento?eventId=e1' },
    })
  })

  it('8. empresa sem perfil: só com a leitura feita (false), não com undefined', () => {
    expect(sugestaoDoEvo(dados([ev()], { empresa: false }), nada, agora)).toMatchObject({
      chave: 'sugestao:empresa:perfil', texto: 'Faltam os dados da empresa em Configurações.', acao: { to: '/producer/settings' },
    })
    expect(chaveDe(dados([ev()], { empresa: undefined }))).toBeUndefined()
  })

  it('2b. portaria: no ar, começa em até 7 dias, sem equipe com acesso; undefined não dispara', () => {
    const d = (n: number, o: Partial<DadosSugestao> = {}) => dados([ev({ date: dia(n) })], { portaria: false, ...o })
    expect(sugestaoDoEvo(d(7), nada, agora)).toMatchObject({ chave: 'dica:portaria', acao: { texto: 'Convidar equipe', to: '/producer/team' } })
    expect(chaveDe(d(8))).toBeUndefined()
    expect(chaveDe(d(7, { portaria: true }))).toBeUndefined()
    expect(chaveDe(d(7, { portaria: undefined }))).toBeUndefined()
    expect(chaveDe(dados([ev({ date: dia(0), time: '11:00:00' })], { portaria: false }))).toBeUndefined() // já começou
    // vem antes do teste de check-in (3)
    expect(chaveDe(d(3, { checkinFeito: false }))).toBe('dica:portaria')
    expect(chaveDe(d(3, { checkinFeito: false }), new Set(['dica:portaria']))).toBe('dica:checkin:e1')
  })

  it('temPortaria: só membro aceito, sem bloqueio, admin ou editor', () => {
    const m = (o: Partial<{ role: string; accepted_at: string | null; blocked_at: string | null }> = {}) => ({ role: 'editor', accepted_at: '2026-10-01', blocked_at: null, ...o })
    expect(temPortaria([m()])).toBe(true)
    expect(temPortaria([m({ role: 'admin' })])).toBe(true)
    expect(temPortaria([])).toBe(false)
    expect(temPortaria([m({ role: 'viewer' })])).toBe(false)
    expect(temPortaria([m({ accepted_at: null })])).toBe(false) // convite pendente
    expect(temPortaria([m({ blocked_at: '2026-10-05' })])).toBe(false)
    expect(temPortaria([m({ role: 'viewer' }), m()])).toBe(true)
  })

  it('prioridade: duas valendo, vale a primeira da ordem', () => {
    const recusado = ev({ id: 'e2', approval_status: 'rejected', cover_image: null })
    expect(chaveDe(dados([ev({ cover_image: null }), recusado], { empresa: false }))).toMatch(/^sugestao:recusado:e2:/)
    // lote (2) antes de check-in (3), que vem antes de sem foto (6) e empresa (8)
    const d = dados([ev({ ticket_types: tt(10), date: dia(2), cover_image: null })], { porTipo: { tt1: 10 }, checkinFeito: false, empresa: false })
    expect(chaveDe(d)).toBe('aviso-lote:tt1:10')
    expect(chaveDe(d, new Set(['aviso-lote:tt1:10']))).toBe('dica:checkin:e1')
  })

  it('dispensada: passa para a próxima, até acabar', () => {
    const d = dados([ev({ cover_image: null })], { empresa: false })
    expect(chaveDe(d)).toBe('sugestao:sem-foto:e1')
    expect(chaveDe(d, new Set(['sugestao:sem-foto:e1']))).toBe('sugestao:empresa:perfil')
    expect(sugestaoDoEvo(d, new Set(['sugestao:sem-foto:e1', 'sugestao:empresa:perfil']), agora)).toBeNull()
  })

  it('dispensa vale por evento: dispensar um não esconde o outro', () => {
    const d = dados([ev({ cover_image: null }), ev({ id: 'e2', cover_image: null })])
    expect(chaveDe(d, new Set(['sugestao:sem-foto:e1']))).toBe('sugestao:sem-foto:e2')
  })

  it('lote: dispensa antiga (chave com a capacidade) continua valendo; capacidade nova faz voltar', () => {
    const d = dados([ev({ ticket_types: tt(10) })], { porTipo: { tt1: 9 } })
    expect(chaveDe(d, new Set(['aviso-lote:tt1:10']))).toBeUndefined()
    expect(chaveDe(d, new Set(['aviso-lote:tt1:9']))).toBe('aviso-lote:tt1:10')
  })
})
