import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  diffCampos, dominioDoLink, enviarEvento, errosDeData, errosDeIngresso, formDoEvento, formDoSnap, linkValido, modoPainel, pendenciasDoPainel,
  precoDe, quantidadeDe, rotuloDoModo, rotulosDoDiff, snapDoForm, type Form, type Ing,
} from '../lib/painelEvento'
import { naFilaDeModeracao } from '../lib/eventoProdutor'
import { supabase } from '../lib/supabase'
import type { DbEvent } from '../hooks/useEvents'

const evento = (o: Partial<DbEvent> = {}) => ({
  id: 'e1', producer_id: 'u1', title: 'Noite de Forró', subtitle: null, description: 'Baile de forró no Espaço Torres, em Curitiba.', category: 'festa_encontro',
  temas: ['musica'], estilos: ['forro'], tags: ['pé-de-serra'], date: '2026-12-12', time: '22:00:00', end_date: '2026-12-13T07:00:00+00:00', local_modo: 'presencial',
  venue_name: 'Espaço Torres', venue_zip: '80000-000', venue_address: 'Rua das Flores, 123 - Centro', venue_city: 'Curitiba', venue_state: 'PR',
  classificacao: 'A16', accent_color: null, status: 'draft', approval_status: 'pending', ...o,
}) as DbEvent

const form = (o: Partial<Form> = {}): Form => ({ ...formDoEvento(evento(), ''), ...o })
const ing = (o: Partial<Ing> = {}): Ing => ({ id: 'i1', nome: 'Pista', preco: '80,00', qtd: '200', bebida: false, tipo: 'individual', ativo: true, vendidos: 0, novo: false, ...o })

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
    expect(snapDoForm(form({ link: 'http://x.com' }))).not.toHaveProperty('online_url')
    expect(snapDoForm(form({ link: '' }))).toHaveProperty('online_url', '')
    expect(snapDoForm(form({ link: ' https://x.com ' }))).toHaveProperty('online_url', 'https://x.com')
    expect(snapDoForm(form({ link: 'https://x.com' }), false)).not.toHaveProperty('online_url') // quem não é dono não grava o link
  })

  it('endereço montado vai em venue_address', () => {
    expect(snapDoForm(form({ rua: 'Rua B', numero: '9', bairro: 'Alto' })).venue_address).toBe('Rua B, 9 - Alto')
    expect(snapDoForm(form({ rua: '', numero: '', bairro: '' })).venue_address).toBe('')
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
    expect(diffCampos(base, snapDoForm(form({ link: 'https://live.com/x' })))).toEqual({ online_url: 'https://live.com/x' })
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
    for (const u of ['http://x.com', 'https://x.com/a b', 'https://', 'https://google.com@evil.com/x', 'https://user:pw@x.com', 'https://google.com@evil.com', `https://x.com/${'a'.repeat(500)}`]) {
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
    for (const t of ['', '0', '-1', '2,5', '1.5', 'x']) expect(quantidadeDe(t), t).toBeNull()
  })
  it('erros por campo, e quantidade abaixo dos vendidos', () => {
    expect(errosDeIngresso(ing())).toEqual({})
    expect(Object.keys(errosDeIngresso(ing({ nome: ' ', preco: 'x', qtd: '0' })))).toEqual(['nome', 'preco', 'qtd'])
    expect(errosDeIngresso(ing({ qtd: '5', vendidos: 8 })).qtd).toMatch(/8/)
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
  const resposta = (o: Record<string, unknown> = {}) => ({ data: { ok: true, classificacao: 'A16', tem_bebida: false, ...o }, error: null })
  const base = () => ({
    eventId: 'e1', tela: { classificacao: 'A16' as string | null, temBebida: false }, aceitar: true, publicar: true,
    gravarPendentes: vi.fn(async () => { chamadas.push('gravar') }), ingressosNaoSalvos: vi.fn(() => { chamadas.push('ingressos'); return false }),
  })

  beforeEach(() => {
    chamadas.length = 0
    vi.clearAllMocks()
    update.mockImplementation(() => ({ eq: () => ({ select: () => ({ single: () => { chamadas.push('publicar'); return Promise.resolve({ data: { id: 'e1' }, error: null }) } }) }) }))
    vi.mocked(supabase.from).mockReturnValue({ update } as never)
    invoke.mockImplementation((async () => { chamadas.push('aceite'); return resposta() }) as never)
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
    expect(r.ok).toBe(false)
    expect(chamadas).not.toContain('publicar')
    expect(update).not.toHaveBeenCalled()
  })

  it('bebida diverge: para e NÃO publica', async () => {
    invoke.mockResolvedValue(resposta({ tem_bebida: true }) as never)
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

  it('falha ao gravar: nada de aceite nem publicação', async () => {
    const r = await enviarEvento({ ...base(), gravarPendentes: async () => { throw new Error('rede') } })
    expect(r.ok).toBe(false)
    expect(invoke).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('409 e 422 viram texto amigável; outro erro usa a mensagem do servidor', async () => {
    const http = (status: number, error = '') => ({ data: null, error: { context: { status, json: async () => ({ error }) } } })
    invoke.mockResolvedValueOnce(http(409, 'Texto do aceite desatualizado; recarregue a página') as never)
    expect(await enviarEvento(base())).toEqual({ ok: false, erro: 'O texto do aceite mudou. Recarregue a página e envie de novo.' })
    invoke.mockResolvedValueOnce(http(422) as never)
    expect(await enviarEvento(base())).toEqual({ ok: false, erro: 'Escolha a classificação indicativa antes de enviar.' })
    invoke.mockResolvedValueOnce(http(429, 'Muitas tentativas. Tente novamente mais tarde.') as never)
    expect(await enviarEvento(base())).toEqual({ ok: false, erro: 'Muitas tentativas de envio em pouco tempo. Aguarde um pouco e tente de novo.' })
    invoke.mockResolvedValueOnce(http(403, 'Confirme o código de verificação em duas etapas') as never)
    expect(await enviarEvento(base())).toEqual({ ok: false, erro: 'Confirme o código de verificação em duas etapas' })
    invoke.mockResolvedValueOnce({ data: null, error: new Error('Failed to fetch') } as never)
    expect((await enviarEvento(base())) as { erro: string }).toMatchObject({ ok: false, erro: expect.stringMatching(/aceite/) })
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

  it('o banco recusa publicar: erro, sem dizer que enviou', async () => {
    update.mockImplementation(() => ({ eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: { code: '42501' } }) }) }) }))
    expect((await enviarEvento(base())).ok).toBe(false)
  })
})
