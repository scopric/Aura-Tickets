import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pendencias } from '../lib/tipoEvento'
import {
  MSG_PENDENCIA, SECAO_DA_PENDENCIA, alvosDoModo, campoDaPendencia, diffCampos, dominioDoLink, ingDoBanco, pedidoParaBanco, enviarEvento, errosDeData, errosDeIngresso, formDoEvento, formDoSnap, linkValido, modoPainel, pendenciasDoPainel,
  precoDe, quantidadeDe, semNomeVazio, erroDosIngressos, ERRO_NOME, rotuloDoModo, rotulosDoDiff, snapDoForm, eventoDaPrevia, mudouConteudo, semDatasInvalidas, sha256Hex, ERRO_ACEITE_NO_AR, type Form, type Ing,
} from '../lib/painelEvento'
import { naFilaDeModeracao } from '../lib/eventoProdutor'
import { supabase } from '../lib/supabase'
import type { DbEvent, DbTicketType } from '../hooks/useEvents'

const evento = (o: Partial<DbEvent> = {}) => ({
  id: 'e1', producer_id: 'u1', title: 'Noite de Forró', subtitle: null, description: 'Baile de forró no Espaço Torres, em Curitiba.', category: 'festa_encontro',
  temas: ['musica'], estilos: ['forro'], tags: ['pé-de-serra'], date: '2026-12-12', time: '22:00:00', end_date: '2026-12-13T07:00:00+00:00', local_modo: 'presencial',
  venue_name: 'Espaço Torres', venue_zip: '80000-000', venue_address: 'Rua das Flores, 123 - Centro', venue_city: 'Curitiba', venue_state: 'PR',
  classificacao: 'A16', accent_color: null, status: 'draft', approval_status: 'pending', ...o,
}) as DbEvent

const form = (o: Partial<Form> = {}): Form => ({ ...formDoEvento(evento(), ''), ...o })
const ing = (o: Partial<Ing> = {}): Ing => ({ id: 'i1', nome: 'Pista', preco: '80,00', qtd: '200', bebida: false, tipo: 'individual', ativo: true, vendidos: 0, novo: false, inicioVenda: '', fimVenda: '', descricao: '', minPed: '1', maxPed: '', maxCpf: '', ...o })

describe('formulário ↔ banco', () => {
  it('lê o evento: hora sem segundos, fim em Brasília, endereço separado', () => {
    const f = formDoEvento(evento(), 'https://x.com/a')
    expect(f).toMatchObject({ inicioD: '2026-12-12', inicioH: '22:00', fimD: '2026-12-13', fimH: '04:00', cep: '80000-000', rua: 'Rua das Flores', numero: '123', bairro: 'Centro', link: 'https://x.com/a' })
  })

  it('o que foi lido e regravado sem mexer não gera diff (endereço antigo, fim sem hora, null)', () => {
    for (const e of [evento(), evento({ venue_address: 'Av. Brasil, s/n' }), evento({ venue_address: 'Praça central' }), evento({ end_date: null, subtitle: null, venue_address: null })]) {
      const s = snapDoForm(formDoEvento(e, ''))
      expect(diffCampos(s, snapDoForm(formDoSnap(s)))).toEqual({})
    }
  })

  it('fim incompleto e link inválido ficam FORA do snapshot (o que está salvo não é apagado)', () => {
    expect(snapDoForm(form({ fimD: '2026-12-13', fimH: '' }))).not.toHaveProperty('end_date')
    expect(snapDoForm(form({ fimD: '', fimH: '' }))).toHaveProperty('end_date', null)
    expect(snapDoForm(form({ fimD: '2026-12-13', fimH: '05:00' }))).toHaveProperty('end_date', '2026-12-13T05:00:00-03:00')
    const on = { local_modo: 'online' }
    expect(snapDoForm(form({ ...on, link: 'http://x.com' }))).not.toHaveProperty('online_url')
    expect(snapDoForm(form({ ...on, link: '' }))).toHaveProperty('online_url', '')
    expect(snapDoForm(form({ ...on, link: ' https://x.com ' }))).toHaveProperty('online_url', 'https://x.com')
  })

  it('modo sem link (presencial, a definir): o link salvo é apagado (online_url vazio); híbrido mantém', () => {
    for (const modo of ['presencial', 'a_definir']) expect(snapDoForm(form({ local_modo: modo, link: 'https://x.com/live' }))).toHaveProperty('online_url', '')
    expect(snapDoForm(form({ local_modo: 'hibrido', link: 'https://x.com/live' }))).toHaveProperty('online_url', 'https://x.com/live')
    const base = snapDoForm(form({ local_modo: 'online', link: 'https://x.com/live' }))
    expect(diffCampos(base, snapDoForm(form({ local_modo: 'presencial', link: 'https://x.com/live' })))).toEqual({ local_modo: 'presencial', online_url: '' })
  })

  it('endereço montado vai em venue_address', () => {
    expect(snapDoForm(form({ rua: 'Rua B', numero: '9', bairro: 'Alto' })).venue_address).toBe('Rua B, 9 - Alto')
    expect(snapDoForm(form({ rua: '', numero: '', bairro: '' })).venue_address).toBe('')
  })
})

describe('prévia no celular', () => {
  it('mostra o que está na tela: preço 1.234,50, ingresso oculto fora, capa removida (null), nome vazio com texto padrão', () => {
    const e = eventoDaPrevia(
      form({ title: 'Nome novo' }),
      [ing({ preco: '1.234,50', vendidos: 3 }), ing({ id: 'i2', nome: 'Escondido', ativo: false }), ing({ id: 'i3', nome: '  ' })],
      { evento: evento({ cover_image: 'https://x/capa.jpg' }), capaUrl: null },
    )
    expect(e.title).toBe('Nome novo')
    expect(e.cover_image).toBeNull()
    expect(e.ticket_types?.map(t => t.name)).toEqual(['Pista', 'Ingresso sem nome'])
    expect(e.ticket_types?.[0]).toMatchObject({ price: 1234.5, quantity_total: 200, is_active: true })
  })
})

describe('prévia: ingresso salvo', () => {
  const salvo = (o: object) => evento({ ticket_types: [{ id: 'i1', description: 'Open bar', perks: ['Fila rápida'], sale_end: '2026-12-01T00:00:00Z', sold: 7, name: 'Antigo', ...o }] } as Partial<DbEvent>)
  it('preserva benefícios e fim da venda do banco; o formulário vale para nome e preço; sold vem do banco', () => {
    const t = eventoDaPrevia(form(), [ing({ nome: 'Novo', vendidos: 99, descricao: 'Open bar' })], { evento: salvo({}), capaUrl: null }).ticket_types?.[0]
    expect(t).toMatchObject({ description: 'Open bar', perks: ['Fila rápida'], sale_end: '2026-12-01T00:00:00Z', name: 'Novo', price: 80, sold: 7 })
  })
  it('perks que não é lista vira []; ingresso novo (fora do banco) tem sold 0', () => {
    expect(eventoDaPrevia(form(), [ing()], { evento: salvo({ perks: 'x' }), capaUrl: null }).ticket_types?.[0].perks).toEqual([])
    expect(eventoDaPrevia(form(), [ing({ id: 'novo', vendidos: 5 })], { evento: salvo({}), capaUrl: null }).ticket_types?.[0]).toMatchObject({ sold: 0, perks: [] })
  })
})

describe('diff do salvamento automático', () => {
  const base = snapDoForm(form())
  it('sem mudança, nada', () => expect(diffCampos(base, snapDoForm(form()))).toEqual({}))
  it('só as chaves mudadas', () => {
    expect(diffCampos(base, snapDoForm(form({ title: 'Outro', temas: ['musica', 'arte_cultura'] })))).toEqual({ title: 'Outro', temas: ['musica', 'arte_cultura'] })
  })
  it('array igual não conta; ordem diferente conta', () => {
    expect(diffCampos(base, snapDoForm(form({ tags: ['pé-de-serra'] })))).toEqual({})
    expect(diffCampos(base, snapDoForm(form({ tags: ['a', 'b'] })))).toEqual({ tags: ['a', 'b'] })
  })
  it('data e hora vão sempre juntas (hora sozinha sem date seria gravada como vazia)', () => {
    expect(diffCampos(base, snapDoForm(form({ inicioH: '23:00' })))).toEqual({ date: '2026-12-12', time: '23:00' })
    expect(diffCampos(base, snapDoForm(form({ inicioD: '2027-01-01' })))).toEqual({ date: '2027-01-01', time: '22:00' })
  })
  it('limpar o fim grava null; link novo entra', () => {
    expect(diffCampos(base, snapDoForm(form({ fimD: '', fimH: '' })))).toEqual({ end_date: null })
    expect(diffCampos(base, snapDoForm(form({ local_modo: 'hibrido', link: 'https://live.com/x' })))).toEqual({ local_modo: 'hibrido', online_url: 'https://live.com/x' })
  })
  it('a intensidade da cor vai e volta pelo formulário, padrão 100, e não é conteúdo moderado', () => {
    expect(formDoEvento(evento(), '').accent_intensity).toBe(100)
    expect(formDoEvento(evento({ accent_intensity: 40 }), '').accent_intensity).toBe(40)
    expect(diffCampos(snapDoForm(form()), snapDoForm(form({ accent_intensity: 40 })))).toEqual({ accent_intensity: 40 })
    expect(mudouConteudo({ accent_intensity: 40 })).toBe(false)
    expect(rotulosDoDiff({ accent_intensity: 40, accent_color: '#112233' })).toEqual(['cor'])
  })

  it('a escolha da capa (capa_na_cor) vai e volta pelo formulário e não é conteúdo moderado', () => {
    expect(formDoEvento(evento(), '').capa_na_cor).toBe(false)
    expect(formDoEvento(evento({ capa_na_cor: true }), '').capa_na_cor).toBe(true)
    expect(diffCampos(snapDoForm(form()), snapDoForm(form({ capa_na_cor: true })))).toEqual({ capa_na_cor: true })
    expect(mudouConteudo({ capa_na_cor: true })).toBe(false)
    expect(eventoDaPrevia(form({ capa_na_cor: true }), [ing()], { evento: evento(), capaUrl: null }).capa_na_cor).toBe(true)
  })
  it('só a cor não é conteúdo moderado (vale na hora); o resto e a capa são', () => {
    expect(mudouConteudo({ accent_color: '#112233' })).toBe(false)
    expect(mudouConteudo({})).toBe(false)
    expect(mudouConteudo({ accent_color: '#112233', description: 'x' })).toBe(true)
    expect(mudouConteudo({ online_url: 'https://x.com' })).toBe(true)
    expect(mudouConteudo({}, true)).toBe(true)
  })
  it('data com erro fica fora do que se grava (espera a correção)', () => {
    const d = { title: 'x', date: '2020-01-01', time: '10:00', end_date: '2020-01-02T10:00:00-03:00' }
    expect(semDatasInvalidas(d, { inicio: 'x' })).toEqual({ title: 'x', end_date: d.end_date })
    expect(semDatasInvalidas(d, { fim: 'x' })).toEqual({ title: 'x', date: d.date, time: d.time })
    expect(semDatasInvalidas(d, {})).toEqual(d)
  })
  it('rótulos da faixa "Alterações não enviadas", sem repetir', () => {
    expect(rotulosDoDiff({ description: 'x', classificacao: 'A18', venue_name: 'x', venue_city: 'y', online_url: 'z' })).toEqual(['descrição', 'classificação', 'local', 'link'])
  })
})

describe('link da transmissão', () => {
  it('aceita https com caminho, porta e query', () => {
    for (const u of ['https://youtube.com/live/abc', 'https://meet.google.com/xyz-abc?x=1#y', 'https://x.com:8080/a']) expect(linkValido(u)).toBe(true)
  })
  it('recusa http, espaço, vazio, usuário@ no endereço e mais de 500 caracteres', () => {
    for (const u of ['http://x.com', 'https://x.com/a b', 'https://', 'https://google.com@evil.com/x', 'https://user:pw@x.com', 'https://google.com@evil.com', 'https://a%40b.com', 'https://a%40b.com/x', 'https://.', 'https://./x', 'https://.com', `https://x.com/${'a'.repeat(500)}`]) {
      expect(linkValido(u), u).toBe(false)
    }
  })
  it('arroba depois do endereço (caminho ou consulta) é permitido: não muda o domínio', () => {
    expect(linkValido('https://x.com/@canal')).toBe(true)
    expect(linkValido('https://x.com?next=a@b.com')).toBe(true)
  })
  it('mostra o domínio real', () => {
    expect(dominioDoLink('https://meet.google.com/xyz')).toBe('meet.google.com')
    expect(dominioDoLink('nada')).toBe('')
  })
})

describe('ingressos', () => {
  it('preço: vírgula decimal, ponto de milhar, zero; recusa vazio, negativo e texto', () => {
    expect(precoDe('80,00')).toBe(80)
    expect(precoDe('1.200,50')).toBe(1200.5)
    expect(precoDe('80.5')).toBe(80.5)
    expect(precoDe('0')).toBe(0)
    for (const t of ['', ' ', '-5', 'abc', '10,5,5', '1.200', '12,345', 'R$ 10']) expect(precoDe(t), t).toBeNull()
  })
  it('quantidade: inteiro maior que zero', () => {
    expect(quantidadeDe('200')).toBe(200)
    for (const t of ['', '0', '-1', '2,5', '1.5', 'x', '1000001', '10000000000']) expect(quantidadeDe(t), t).toBeNull()
    expect(quantidadeDe('1000000')).toBe(1_000_000)
  })
  it('erros por campo, e quantidade abaixo dos vendidos', () => {
    expect(errosDeIngresso(ing())).toEqual({})
    expect(Object.keys(errosDeIngresso(ing({ nome: ' ', preco: 'x', qtd: '0' })))).toEqual(['nome', 'preco', 'qtd'])
    expect(errosDeIngresso(ing({ qtd: '5', vendidos: 8 })).qtd).toMatch(/8/)
    expect(errosDeIngresso(ing({ minPed: '0' })).pedido).toMatch(/Mínimo/)
    expect(errosDeIngresso(ing({ minPed: '5', maxPed: '3' })).pedido).toMatch(/menor que o mínimo/)
    expect(errosDeIngresso(ing({ qtd: '5', maxPed: '6' })).pedido).toMatch(/passar da quantidade/)
    expect(errosDeIngresso(ing({ maxPed: '0' })).pedido).toMatch(/Máximo/)
    expect(errosDeIngresso(ing({ maxPed: '' }))).toEqual({})
    expect(errosDeIngresso(ing({ minPed: '2', maxPed: '8' }))).toEqual({})
    expect(errosDeIngresso(ing({ minPed: '2', maxPed: '11' })).pedido).toMatch(/é 10/)
  })
  it('sem máximo vale 10 (grátis e pago): mínimo acima disso fica impossível de comprar', () => {
    expect(errosDeIngresso(ing({ preco: '0', minPed: '12', maxPed: '' })).pedido).toMatch(/Sem máximo.*10/)
    expect(errosDeIngresso(ing({ preco: '80,00', minPed: '12', maxPed: '' })).pedido).toMatch(/Sem máximo.*10/)
    expect(errosDeIngresso(ing({ preco: '80,00', minPed: '10', maxPed: '' }))).toEqual({})
    expect(errosDeIngresso(ing({ preco: '0', minPed: '12', maxPed: '50' })).pedido).toMatch(/é 10/) // acima de 10 nunca
  })
  it('datas de venda: fim depois do início e não depois do fim do evento', () => {
    const fimEv = Date.parse('2026-12-13T04:00:00-03:00')
    expect(errosDeIngresso(ing({ inicioVenda: '2026-11-01T10:00', fimVenda: '2026-12-01T10:00' }), fimEv)).toEqual({})
    expect(errosDeIngresso(ing({ fimVenda: '2026-12-01T10:00' }), fimEv)).toEqual({})
    expect(errosDeIngresso(ing({ inicioVenda: '2026-12-01T10:00', fimVenda: '2026-12-01T10:00' })).venda).toMatch(/depois do início/)
    expect(errosDeIngresso(ing({ inicioVenda: '2026-12-02T10:00', fimVenda: '2026-12-01T10:00' })).venda).toMatch(/depois do início/)
    expect(errosDeIngresso(ing({ fimVenda: '2026-12-14T10:00' }), fimEv).venda).toMatch(/fim do evento/)
    expect(errosDeIngresso(ing({ fimVenda: '2026-12-14T10:00' })).venda).toBeUndefined()
  })
})

describe('nome vazio e erro ao gravar ingressos', () => {
  it('nome vazio ou só espaços não vai no diff (o salvamento espera); nome preenchido vai', () => {
    expect(semNomeVazio({ title: '', subtitle: 'x' }, '')).toEqual({ subtitle: 'x' })
    expect(semNomeVazio({ title: '   ' }, '   ')).toEqual({})
    expect(semNomeVazio({ title: 'Show' }, 'Show')).toEqual({ title: 'Show' })
    expect(semNomeVazio({ subtitle: 'x' }, '')).toEqual({ subtitle: 'x' })
    expect(ERRO_NOME).toBe('Escreva o nome: ele aparece na página e no ingresso.')
  })
  it('erro de gravação dos ingressos por tipo: dado recusado pelo banco, remoção com pedidos e rede', () => {
    for (const e of [{ code: '22003' }, { code: '23514' }, { status: 400 }, { status: 422 }, { code: 'PGRST102' }]) expect(erroDosIngressos(e)).toMatch(/O banco recusou um dos ingressos: confira nome, preço e quantidade/)
    expect(erroDosIngressos({ code: '23514', message: 'Já foram vendidos 5: a quantidade não pode ser menor' })).toBe('Já foram vendidos 5: a quantidade não pode ser menor')
    const lugar = 'Este ingresso é vendido por lugar marcado: não use limite por CPF nele'
    expect(erroDosIngressos({ code: '22023', message: lugar })).toBe(lugar)
    expect(erroDosIngressos({ code: '23503' })).toMatch(/Use Ocultar/)
    expect(erroDosIngressos(new Error('Failed to fetch'))).toMatch(/Confira a internet/)
    expect(erroDosIngressos(null)).toMatch(/Confira a internet/)
  })
})

describe('datas', () => {
  const agora = new Date('2026-10-05T12:00:00-03:00').getTime()
  const base = { inicioD: '2026-12-12', inicioH: '22:00' }
  it('início no passado só quando a pessoa o mudou', () => {
    expect(errosDeData(form({ inicioD: '2026-01-01' }), base, agora).inicio).toMatch(/passou/)
    expect(errosDeData(form({ inicioD: '2026-01-01' }), { inicioD: '2026-01-01', inicioH: '22:00' }, agora)).toEqual({})
  })
  it('data sem hora e hora sem data', () => {
    expect(errosDeData(form({ inicioH: '' }), base, agora).inicio).toMatch(/hora/)
    expect(errosDeData(form({ inicioD: '' }), base, agora).inicio).toMatch(/data/)
  })
  it('fim antes do início, igual ao início e fim pela metade', () => {
    expect(errosDeData(form({ fimD: '2026-12-12', fimH: '21:00' }), base, agora).fim).toMatch(/depois do início/)
    expect(errosDeData(form({ fimD: '2026-12-12', fimH: '22:00' }), base, agora).fim).toMatch(/depois do início/)
    expect(errosDeData(form({ fimD: '2026-12-12', fimH: '' }), base, agora).fim).toBeTruthy()
    expect(errosDeData(form({ fimD: '2026-12-13', fimH: '04:00' }), base, agora)).toEqual({})
    expect(errosDeData(form({ fimD: '', fimH: '' }), base, agora)).toEqual({})
  })
})

describe('estado do cabeçalho', () => {
  it('draft com motivo é Recusado; draft comum é Rascunho', () => {
    expect(rotuloDoModo({ status: 'draft', approval_status: 'rejected', rejection_reason: 'x' })).toBe('Recusado')
    expect(rotuloDoModo({ status: 'draft', approval_status: 'pending', rejection_reason: 'Falta o endereço' })).toBe('Recusado')
    expect(rotuloDoModo({ status: 'draft', approval_status: 'pending', rejection_reason: null })).toBe('Rascunho')
    expect(modoPainel({ status: 'draft', approval_status: 'approved', rejection_reason: null })).toBe('rascunho')
  })
  it('depois de reenviar o motivo continua gravado, mas é Em análise', () => {
    expect(rotuloDoModo({ status: 'published', approval_status: 'pending', rejection_reason: 'Falta o endereço' })).toBe('Em análise')
    expect(modoPainel({ status: 'published', approval_status: null, rejection_reason: null })).toBe('analise')
  })
  it('no ar, encerrado e cancelado', () => {
    expect(rotuloDoModo({ status: 'published', approval_status: 'approved', rejection_reason: null })).toBe('À venda')
    expect(modoPainel({ status: 'published', approval_status: 'approved', rejection_reason: null })).toBe('publicado')
    expect(rotuloDoModo({ status: 'cancelled', approval_status: 'approved', rejection_reason: null })).toBe('Cancelado')
    expect(modoPainel({ status: 'ended', approval_status: 'approved', rejection_reason: null })).toBe('fechado')
  })
})

describe('os 8 itens da barra com o estado do painel', () => {
  const prontos = (f: Form, i: Ing[], aceite = true) => pendenciasDoPainel(f, i, aceite).filter(p => p.pronto).length
  it('tudo preenchido: 8 de 8', () => expect(prontos(form(), [ing()])).toBe(8))
  it('sem aceite, sem ingresso, sem classificação', () => {
    expect(pendenciasDoPainel(form(), [ing()], false).find(p => !p.pronto)?.id).toBe('aceite')
    expect(pendenciasDoPainel(form(), [], true).find(p => !p.pronto)?.id).toBe('ingresso')
    expect(pendenciasDoPainel(form({ classificacao: '' }), [ing()], true).find(p => !p.pronto)?.id).toBe('classificacao')
  })
  it('esporte dispensa a classificação', () => expect(prontos(form({ category: 'esporte', classificacao: '' }), [ing()])).toBe(8))
  it('só ingresso ativo e válido conta; oculto não', () => {
    expect(prontos(form(), [ing({ ativo: false })])).toBe(7)
    expect(prontos(form(), [ing({ qtd: '0' })])).toBe(7)
    expect(prontos(form(), [ing({ preco: 'x' })])).toBe(7)
    expect(prontos(form(), [ing({ preco: '0,00' })])).toBe(8) // gratuito vale
  })
  it('online pede link https válido; híbrido pede local e link; a definir dispensa', () => {
    expect(prontos(form({ local_modo: 'online', link: '' }), [ing()])).toBe(7)
    expect(prontos(form({ local_modo: 'online', link: 'https://x.com/live' }), [ing()])).toBe(8)
    expect(prontos(form({ local_modo: 'online', link: 'https://a.com@b.com/' }), [ing()])).toBe(7)
    expect(prontos(form({ local_modo: 'hibrido', link: '' }), [ing()])).toBe(7)
    expect(prontos(form({ local_modo: 'a_definir', venue_name: '', venue_city: '' }), [ing()])).toBe(8)
  })
  it('data sem hora, descrição curta e formato antigo (texto livre) pendem', () => {
    expect(prontos(form({ inicioH: '' }), [ing()])).toBe(7)
    expect(prontos(form({ description: 'curta' }), [ing()])).toBe(7)
    expect(prontos(form({ category: 'Festa' }), [ing()])).toBe(7)
  })
})

describe('fila de moderação do admin ("Pendentes")', () => {
  it('só o que foi enviado (published) e não decidido', () => {
    expect(naFilaDeModeracao({ status: 'published', approval_status: 'pending' })).toBe(true)
    expect(naFilaDeModeracao({ status: 'published', approval_status: null })).toBe(true)
    expect(naFilaDeModeracao({ status: 'draft', approval_status: 'pending' })).toBe(false) // rascunho: padrão do banco, não é pedido
    expect(naFilaDeModeracao({ status: 'draft', approval_status: null })).toBe(false)
    expect(naFilaDeModeracao({ status: 'published', approval_status: 'approved' })).toBe(false)
    expect(naFilaDeModeracao({ status: 'published', approval_status: 'rejected' })).toBe(false)
    expect(naFilaDeModeracao({ status: 'cancelled', approval_status: 'pending' })).toBe(false)
  })
})

describe('Enviar para aprovação', () => {
  const chamadas: string[] = []
  const update = vi.fn()
  const invoke = vi.mocked(supabase.functions.invoke)
  const TEXTO = 'Termo do produtor para publicar evento\nAo enviar o evento "X", declaro que:'
  let hash = ''
  const resposta = (o: Record<string, unknown> = {}) => ({ data: { ok: true, classificacao: 'A16', tem_bebida: false, texto_hash: hash, ...o }, error: null })
  const base = () => ({
    eventId: 'e1', tela: { classificacao: 'A16' as string | null, temBebida: false }, textoAceito: TEXTO, aceitar: true, publicar: true,
    gravarPendentes: vi.fn(async () => { chamadas.push('gravar') }), ingressosNaoSalvos: vi.fn(() => { chamadas.push('ingressos'); return false }),
  })

  beforeEach(async () => {
    hash = await sha256Hex(TEXTO)
    chamadas.length = 0
    vi.clearAllMocks()
    update.mockImplementation(() => ({ eq: () => ({ select: () => ({ single: () => { chamadas.push('publicar'); return Promise.resolve({ data: { id: 'e1' }, error: null }) } }) }) }))
    vi.mocked(supabase.from).mockReturnValue({ update } as never)
    invoke.mockImplementation((async () => { chamadas.push('aceite'); return resposta() }) as never)
  })

  it('sha256Hex confere com o valor conhecido', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('ordem: grava, confere ingressos, aceite, publica', async () => {
    expect(await enviarEvento(base())).toEqual({ ok: true })
    expect(chamadas).toEqual(['gravar', 'ingressos', 'aceite', 'publicar'])
    expect(invoke).toHaveBeenCalledWith('aceite-evento', { body: { event_id: 'e1' } })
    expect(update).toHaveBeenCalledWith({ status: 'published' })
  })

  it('classificação que o servidor registrou diverge da tela: para e NÃO publica', async () => {
    invoke.mockResolvedValue(resposta({ classificacao: 'A18' }) as never)
    const r = await enviarEvento(base())
    expect(r).toMatchObject({ ok: false, divergiu: true })
    expect(update).not.toHaveBeenCalled()
  })

  it('bebida diverge: para e NÃO publica', async () => {
    invoke.mockResolvedValue(resposta({ tem_bebida: true }) as never)
    expect((await enviarEvento(base())).ok).toBe(false)
    expect(update).not.toHaveBeenCalled()
  })

  it('hash do texto que a pessoa leu diverge do registrado: para e NÃO publica', async () => {
    invoke.mockResolvedValue(resposta({ texto_hash: 'a'.repeat(64) }) as never)
    expect((await enviarEvento(base())).ok).toBe(false)
    expect(update).not.toHaveBeenCalled()
  })

  it('resposta sem texto_hash conta como divergência', async () => {
    invoke.mockResolvedValue({ data: { ok: true, classificacao: 'A16', tem_bebida: false }, error: null } as never)
    expect((await enviarEvento(base())).ok).toBe(false)
    expect(update).not.toHaveBeenCalled()
  })

  it('esporte: tela sem classificação bate com o servidor (null)', async () => {
    invoke.mockResolvedValue(resposta({ classificacao: null }) as never)
    expect(await enviarEvento({ ...base(), tela: { classificacao: null, temBebida: false } })).toEqual({ ok: true })
  })

  it('ingresso não salvo: bloqueia antes do aceite, depois de gravar o evento', async () => {
    const r = await enviarEvento({ ...base(), ingressosNaoSalvos: () => { chamadas.push('ingressos'); return true } })
    expect(r).toMatchObject({ ok: false })
    expect(chamadas).toEqual(['gravar', 'ingressos'])
    expect(invoke).not.toHaveBeenCalled()
  })

  it('falha ao gravar: nada de aceite nem publicação (e não houve gravação)', async () => {
    const r = await enviarEvento({ ...base(), gravarPendentes: async () => { throw new Error('rede') } })
    expect(r).toMatchObject({ ok: false })
    expect(invoke).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('cada status vira texto do próprio front; a mensagem do servidor nunca aparece', async () => {
    const http = (status: number) => ({ data: null, error: { context: { status, json: async () => ({ error: 'DETALHE INTERNO DO SERVIDOR' }) } } })
    const esperados: Record<number, RegExp> = {
      400: /incompleto/, 401: /sessão expirou/, 403: /duas etapas/, 404: /Não encontramos este evento/, 409: /texto do aceite mudou/,
      422: /classificação indicativa/, 429: /Muitas tentativas/, 500: /servidor não conseguiu/,
    }
    for (const [status, re] of Object.entries(esperados)) {
      invoke.mockResolvedValueOnce(http(Number(status)) as never)
      const r = (await enviarEvento(base())) as { erro: string }
      expect(r.erro, status).toMatch(re)
      expect(r.erro).not.toMatch(/DETALHE/)
    }
    invoke.mockResolvedValueOnce({ data: null, error: new Error('Failed to fetch') } as never) // rede
    expect(((await enviarEvento(base())) as { erro: string }).erro).toMatch(/internet/)
    expect(update).not.toHaveBeenCalled()
  })

  it('evento já aprovado: grava e só refaz o aceite se precisar; não mexe no status', async () => {
    expect(await enviarEvento({ ...base(), aceitar: false, publicar: false })).toEqual({ ok: true })
    expect(chamadas).toEqual(['gravar', 'ingressos'])
    chamadas.length = 0
    expect(await enviarEvento({ ...base(), aceitar: true, publicar: false })).toEqual({ ok: true })
    expect(chamadas).toEqual(['gravar', 'ingressos', 'aceite'])
    expect(update).not.toHaveBeenCalled()
  })

  it('evento no ar: aceite que falha DEPOIS de gravar diz que as alterações já foram para análise e por que o aceite falhou', async () => {
    const http = (status: number) => ({ data: null, error: { context: { status } } })
    invoke.mockResolvedValueOnce(http(403) as never)
    const r403 = (await enviarEvento({ ...base(), publicar: false })) as { ok: false; erro: string }
    expect(r403.erro).toBe(`${ERRO_ACEITE_NO_AR} O servidor recusou o aceite. Confirme a verificação em duas etapas no seu perfil e envie de novo.`)
    invoke.mockResolvedValueOnce(http(429) as never)
    expect(((await enviarEvento({ ...base(), publicar: false })) as { erro: string }).erro).toBe(`${ERRO_ACEITE_NO_AR} Muitas tentativas de envio em pouco tempo. Aguarde um pouco e tente de novo.`)
    expect(ERRO_ACEITE_NO_AR).not.toMatch(/nada foi publicado/i)
  })

  it('refazer só o aceite (soAceite): sem a frase "alterações já foram para análise"', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: { context: { status: 500 } } } as never)
    const r = (await enviarEvento({ ...base(), publicar: false, soAceite: true })) as { erro: string }
    expect(r.erro).toBe('O servidor não conseguiu registrar o aceite. Tente de novo em instantes.')
    expect(r.erro).not.toMatch(/alterações/)
  })

  it('divergência: o aceite FOI gravado mas não confere; nunca diz "não foi registrado"', async () => {
    invoke.mockResolvedValue(resposta({ texto_hash: 'a'.repeat(64) }) as never)
    const rascunho = (await enviarEvento(base())) as { erro: string }
    expect(rascunho.erro).toMatch(/aceite gravado não confere com o texto que você leu/)
    expect(rascunho.erro).toMatch(/Nada foi publicado/)
    expect(rascunho.erro).not.toMatch(/não foi registrado/)
    const noAr = (await enviarEvento({ ...base(), publicar: false })) as { erro: string }
    expect(noAr.erro).toMatch(/aceite gravado não confere/)
    expect(noAr.erro).toMatch(/já foram para análise/)
    expect(noAr.erro).not.toMatch(/Nada foi publicado|não foi registrado/)
    const so = (await enviarEvento({ ...base(), publicar: false, soAceite: true })) as { erro: string }
    expect(so.erro).not.toMatch(/análise|publicado/)
  })

  it('falha parcial (o evento gravou e o link não): mensagem própria, não "não foi possível salvar o evento"', async () => {
    const parcial = () => Promise.reject(Object.assign(new Error('link'), { parcial: true }))
    const noAr = (await enviarEvento({ ...base(), publicar: false, aceitar: false, gravarPendentes: parcial })) as { erro: string }
    expect(noAr.erro).toBe('O evento foi salvo e enviado para análise, mas o link não foi gravado: ele será salvo de novo.')
    const rascunho = (await enviarEvento({ ...base(), gravarPendentes: parcial })) as { erro: string }
    expect(rascunho.erro).toMatch(/link não foi gravado/)
    expect(rascunho.erro).not.toMatch(/enviado para análise/)
    expect(invoke).not.toHaveBeenCalled()
  })

  it('divergência pede para recarregar e marca divergiu (a tela relê o evento)', async () => {
    invoke.mockResolvedValue(resposta({ texto_hash: 'a'.repeat(64) }) as never)
    const r = (await enviarEvento(base())) as { erro: string; divergiu?: boolean }
    expect(r.divergiu).toBe(true)
    expect(r.erro).toMatch(/Recarregue a página e refaça o aceite/)
    invoke.mockResolvedValue({ data: null, error: { context: { status: 500 } } } as never)
    expect(((await enviarEvento(base())) as { divergiu?: boolean }).divergiu).toBe(false)
  })

  it('o banco recusa publicar: erro, sem dizer que enviou', async () => {
    update.mockImplementation(() => ({ eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: { code: '42501' } }) }) }) }))
    const r = await enviarEvento(base())
    expect(r).toMatchObject({ ok: false, erro: 'Refaça o aceite: a classificação ou a bebida mudou.' })
  })
})

describe('limites por pedido', () => {
  const t = (o: object) => ({ id: 't1', name: 'Pista', price: 80, quantity_total: 200, type: 'individual', is_active: true, ...o }) as DbTicketType
  it('ingDoBanco lê descrição, mínimo e máximo; máximo nulo vira vazio', () => {
    expect(ingDoBanco(t({ description: 'Entrada geral', min_per_order: 2, max_per_order: 4 }), 0)).toMatchObject({ descricao: 'Entrada geral', minPed: '2', maxPed: '4' })
    expect(ingDoBanco(t({ description: null, max_per_order: null }), 0)).toMatchObject({ descricao: '', minPed: '1', maxPed: '' })
  })
  it('para o banco: vazio vira null, número vira número', () => {
    expect(pedidoParaBanco(ing({ minPed: '2', maxPed: '' }))).toEqual({ min_per_order: 2, max_per_order: null, max_por_cpf: null })
    expect(pedidoParaBanco(ing({ minPed: '1', maxPed: '4' }))).toEqual({ min_per_order: 1, max_per_order: 4, max_por_cpf: null })
  })
})

describe('limite por CPF', () => {
  const t = (o: object) => ({ id: 't1', name: 'Pista', price: 80, quantity_total: 200, type: 'individual', is_active: true, ...o }) as DbTicketType
  it('ingDoBanco lê max_por_cpf; nulo vira vazio', () => {
    expect(ingDoBanco(t({ max_por_cpf: 2 }), 0).maxCpf).toBe('2')
    expect(ingDoBanco(t({ max_por_cpf: null }), 0).maxCpf).toBe('')
  })
  it('erros: 0, negativo, não inteiro e acima da quantidade; vazio aceito', () => {
    for (const v of ['0', '-1', '1,5', 'abc']) expect(errosDeIngresso(ing({ maxCpf: v })).cpf).toMatch(/Limite por CPF inválido/)
    expect(errosDeIngresso(ing({ maxCpf: '201' })).cpf).toMatch(/passar da quantidade/)
    expect(errosDeIngresso(ing({ maxCpf: '' }))).toEqual({})
    expect(errosDeIngresso(ing({ maxCpf: '200' }))).toEqual({})
  })
  it('para o banco: vazio limpa (null), número vira número', () => {
    expect(pedidoParaBanco(ing({ maxCpf: '' })).max_por_cpf).toBeNull()
    expect(pedidoParaBanco(ing({ maxCpf: ' 2 ' })).max_por_cpf).toBe(2)
  })
})

describe('mapa pendência → seção e campo (o que falta no campo)', () => {
  const ler = (...a: string[]) => readFileSync(join(__dirname, '..', ...a), 'utf8')
  const secoes = ['SecaoOQueE', 'SecaoQuandoOnde', 'SecaoIngressos', 'SecaoRegras', 'SecaoPublicar'].map(n => ler('components/producer/painel', `${n}.tsx`)).join('\n')
  const painel = ler('pages/producer/PainelEvento.tsx')
  const ids = pendencias({}).map(p => p.id)

  it('toda pendência tem mensagem e seção que existe no painel', () => {
    expect(ids).toHaveLength(8)
    for (const id of ids) {
      expect(MSG_PENDENCIA[id], id).toBeTruthy()
      expect(painel, id).toContain(`id: '${SECAO_DA_PENDENCIA[id]}'`)
    }
  })

  it('todo campo apontado existe no código das seções, em todos os modos e com ou sem ingresso', () => {
    const formas = [{}, { local_modo: 'online' }, { local_modo: 'hibrido' }, { local_modo: 'hibrido', venue_name: 'X' }, { venue_name: 'X' }].map(o => form({ venue_name: '', venue_city: '', ...o }))
    const listas = [[], [ing({ id: 'ABC', nome: '' })], [ing({ id: 'ABC', qtd: '' })], [ing({ id: 'ABC' })]]
    for (const id of ids) for (const f of formas) for (const l of listas) {
      const campo = campoDaPendencia(id, f, l)
      const dinamico = campo.match(/^ing-ABC-(\w+)$/)
      if (dinamico) expect(secoes, campo).toContain('${id}-' + dinamico[1])
      else expect(secoes.includes(`id="${campo}"`) || secoes.includes(`'${campo}'`), campo).toBe(true)
    }
  })
})

describe('campo do ingresso pendente', () => {
  it('com mudança não salva o alvo é o botão Salvar (nunca um campo já correto)', () => {
    expect(campoDaPendencia('ingresso', form(), [ing({ id: 'A' })], true)).toBe('ing-salvar')
    expect(campoDaPendencia('ingresso', form(), [], true)).toBe('ing-salvar')
  })
  it('sem mudança: o preço do primeiro ingresso ATIVO (senão o primeiro)', () => {
    expect(campoDaPendencia('ingresso', form(), [ing({ id: 'A', ativo: false }), ing({ id: 'B' })])).toBe('ing-B-preco')
    expect(campoDaPendencia('ingresso', form(), [ing({ id: 'A', ativo: false })])).toBe('ing-A-preco')
  })
})

describe('alvosDoModo (passos do destaque por modo)', () => {
  const x = (campo: string) => ({ campo })
  const pend = [x('f-nome'), x('f-inicio')]
  const bloq = [x('f-nome'), x('ing-salvar')]
  const campos = (l: { campo: string }[]) => l.map(a => a.campo)

  it('rascunho e recusado: pendências + bloqueios, um por campo', () => {
    for (const m of ['rascunho', 'recusado'] as const) expect(campos(alvosDoModo(m, pend, bloq))).toEqual(['f-nome', 'f-inicio', 'ing-salvar'])
  })
  it('no ar e em análise: só os bloqueios', () => {
    for (const m of ['publicado', 'analise'] as const) expect(campos(alvosDoModo(m, pend, bloq))).toEqual(['f-nome', 'ing-salvar'])
    expect(alvosDoModo('publicado', pend, [])).toEqual([])
  })
  it('fechado: nenhum', () => expect(alvosDoModo('fechado', pend, bloq)).toEqual([]))
  it('com vendas, data e hora (desabilitadas) apontam para a seção', () => {
    expect(campos(alvosDoModo('publicado', [], [x('f-inicio'), x('f-fim'), x('f-link')], true))).toEqual(['s-quando', 'f-link'])
  })
})
