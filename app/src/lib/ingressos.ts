import type { DbTicketType } from '../hooks/useEvents'
import { toCsv } from './exportCsv'
import { hrefDaTela } from './navegacaoProdutor'
import { partesBrasilia, precoDe, pedidoParaBanco, vendaParaBanco, quantidadeDe, type Ing } from './painelEvento'

// Tela Ingressos e Cupons do produtor, sem tela: ordem dos ingressos, números do topo, pagamento do ingresso, códigos em lote e CSV de cupons.

// ---- ordem dos ingressos ----------------------------------------------------------------------------------------
type Ordenavel = { id: string; sort_order?: number | null; created_at?: string }

/** Pela coluna sort_order, de 1 em diante. Sem ordem (nulo ou 0) vai por último, e o empate é pela criação:
 *  ingresso novo fica no fim da lista, que é onde o produtor espera achá-lo. */
export const ordenar = <T extends Ordenavel>(l: T[]): T[] => {
  const chave = (t: T) => t.sort_order || Infinity
  return [...l].sort((a, b) => (chave(a) === chave(b) ? 0 : chave(a) < chave(b) ? -1 : 1) || (a.created_at ?? '').localeCompare(b.created_at ?? '') || a.id.localeCompare(b.id))
}

/** Tira o item de `de` e põe em `para`. Posição fora da lista devolve a mesma ordem */
export function mover<T>(l: T[], de: number, para: number): T[] {
  if (de === para || de < 0 || para < 0 || de >= l.length || para >= l.length) return l
  const c = [...l]
  c.splice(para, 0, c.splice(de, 1)[0])
  return c
}

/** O sort_order de cada ingresso da nova ordem é a posição dele, a partir de 1 (0 e nulo = sem ordem, vão por último); só volta quem mudou */
export function ordensAlteradas(antes: Ordenavel[], depois: { id: string }[]): { id: string; sort_order: number }[] {
  const atual = new Map(antes.map(t => [t.id, t.sort_order || 0]))
  return depois.map((t, i) => ({ id: t.id, sort_order: i + 1 })).filter(o => atual.get(o.id) !== o.sort_order)
}

// ---- números do topo ---------------------------------------------------------------------------------------------
export const totalDe = (t: Pick<DbTicketType, 'quantity_total' | 'capacity'>) => Number(t.quantity_total ?? t.capacity ?? 0) || 0

/** Vendidos de todos os tipos; disponíveis só dos que estão à venda (oculto não vende). */
export function kpisIngressos(tipos: DbTicketType[], vendidos: Record<string, number>) {
  let v = 0, d = 0
  for (const t of tipos) {
    const vend = vendidos[t.id] ?? 0
    v += vend
    if (t.is_active) d += Math.max(0, totalDe(t) - vend)
  }
  return { vendidos: v, disponiveis: d }
}

// ---- formulário do ingresso ---------------------------------------------------------------------------------------
export type Modelo = 'pago' | 'gratuito' | 'grupo'
export const ROTULO_TIPO: Record<string, string> = { individual: 'Individual', coletiva: 'Mesa coletiva', vip: 'VIP', mesa: 'Mesa (lugar marcado)' }
export const semMeia = (tipo: string) => tipo === 'coletiva' || tipo === 'mesa'

/** Ingresso novo em branco, do modelo escolhido: grupo = mesa coletiva (sem meia); gratuito = preço 0 */
export const ingNovo = (m: Modelo): Ing => ({
  id: 'novo', nome: '', preco: m === 'gratuito' ? '0,00' : '', qtd: '', bebida: false, meia: m !== 'grupo', tipo: m === 'grupo' ? 'coletiva' : 'individual',
  ativo: true, vendidos: 0, novo: true, inicioVenda: '', fimVenda: '', descricao: '', minPed: '1', maxPed: '', maxCpf: '',
})

/** Erro extra do modelo: ingresso pago precisa de preço maior que zero (gratuito é o outro modelo) */
export const erroDoModelo = (m: Modelo | null, i: Ing): string | undefined =>
  m && m !== 'gratuito' && precoDe(i.preco) === 0 ? 'Ingresso pago precisa de preço maior que zero. Para preço 0, escolha Gratuito.' : undefined

/** O que vai ao banco, pelo mesmo caminho do editor do evento (useUpdateEvent). Colunas só as que têm grant. */
export const ingParaBanco = (i: Ing): Partial<DbTicketType> => ({
  id: i.novo ? undefined : i.id, name: i.nome.trim(), price: precoDe(i.preco) ?? 0, capacity: quantidadeDe(i.qtd) ?? 0,
  inclui_bebida: i.bebida, permite_meia: i.meia && !semMeia(i.tipo), type: i.tipo as DbTicketType['type'],
  sale_start: vendaParaBanco(i.inicioVenda), sale_end: vendaParaBanco(i.fimVenda), description: i.descricao.trim().slice(0, 500) || null,
  ...pedidoParaBanco(i),
})

/** "10/10/2026 14:00 até 20/10/2026 18:00" (Brasília); sem data nenhuma: sem janela */
export function janelaDeVenda(inicio: string | null | undefined, fim: string | null | undefined): string {
  const f = (iso: string | null | undefined) => { const p = partesBrasilia(iso); return p.d ? `${p.d.split('-').reverse().join('/')} ${p.h}` : '' }
  const a = f(inicio), b = f(fim)
  return a && b ? `${a} até ${b}` : a ? `Desde ${a}` : b ? `Até ${b}` : 'Sem janela: vende até o evento'
}

// ---- cupons: códigos em lote ---------------------------------------------------------------------------------------
export const TETO_CUPONS = 500
/** Sem I, L, O, 0 e 1: não se confundem quando lidos ou digitados */
export const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export const prefixoLimpo = (p: string) => p.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)

function sorteio(n: number): number {
  // descarta o resto da divisão para não favorecer as primeiras letras
  const limite = 256 - (256 % n)
  const b = new Uint8Array(1)
  do crypto.getRandomValues(b); while (b[0] >= limite)
  return b[0] % n
}

/** `qtd` códigos PREFIXO-XXXXXX, únicos entre si e fora de `usados` (maiúsculas: o banco compara upper(code)). */
export function gerarCodigos(prefixo: string, qtd: number, usados: Iterable<string> = [], sorte: (n: number) => number = sorteio): string[] {
  const p = prefixoLimpo(prefixo)
  if (!p || !Number.isInteger(qtd) || qtd < 1 || qtd > TETO_CUPONS) throw new Error('prefixo ou quantidade inválidos')
  const vistos = new Set([...usados].map(c => c.toUpperCase()))
  const novos: string[] = []
  for (let tentativas = 0; novos.length < qtd; tentativas++) {
    if (tentativas > qtd * 20) throw new Error('não consegui gerar códigos únicos')
    const c = `${p}-${Array.from({ length: 6 }, () => ALFABETO[sorte(ALFABETO.length)]).join('')}`
    if (!vistos.has(c)) { vistos.add(c); novos.push(c) }
  }
  return novos
}

/** Mensagem por código estável do banco (23505 = código repetido; o índice é global, de todos os produtores) */
export const motivoDoErro = (code?: string) =>
  code === '23505' ? 'Não foi possível criar este código, tente outro' : code === '42501' ? 'Sem permissão (confirme o 2FA e tente de novo)' : code === '23514' ? 'O banco recusou os valores' : 'Não foi possível gravar'

// ---- cupons: CSV -------------------------------------------------------------------------------------------------------
export type CupomCsv = { code: string; discount_type: 'percent' | 'fixed'; discount_value: number; max_uses: number | null; description: string | null; valid_until: string | null }
export type ErroCsv = { linha: number; motivo: string }
export type RelatorioCsv = { validas: CupomCsv[]; erros: ErroCsv[]; total: number; geral?: string }

const COLUNAS = ['codigo', 'tipo', 'valor', 'usos', 'descricao', 'validade']
/** AAAA-MM-DD que existe no calendário (2026-02-31 não passa: vira 03-03 na volta) */
export const diaValido = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s
/** Fim do dia em Brasília, o mesmo fuso do lote e do CSV */
export const fimDoDia = (s: string) => new Date(`${s}T23:59:59-03:00`)

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Tabela do CSV: BOM fora, separador ; ou , (o da primeira linha), aspas com "" e quebra de linha dentro das aspas */
export function lerCsv(texto: string): string[][] {
  const t = texto.replace(/^﻿/, '')
  const primeira = t.split(/\r?\n/, 1)[0]
  const sep = primeira.split(';').length >= primeira.split(',').length ? ';' : ','
  const linhas: string[][] = []
  let cel = '', linha: string[] = [], aspas = false
  const fechaLinha = () => { linha.push(cel); cel = ''; if (linha.some(c => c.trim() !== '')) linhas.push(linha); linha = [] }
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') { cel += '"'; i++ } else if (c === '"') aspas = false; else cel += c
    } else if (c === '"') aspas = true
    else if (c === sep) { linha.push(cel); cel = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; fechaLinha() }
    else cel += c
  }
  if (cel !== '' || linha.length) fechaLinha()
  return linhas
}

/** Valida linha a linha. `existentes` = códigos do produtor (maiúsculas). Nada é gravado aqui. */
export function validarCupons(texto: string, existentes: Iterable<string> = []): RelatorioCsv {
  const tabela = lerCsv(texto)
  const vazio = { validas: [], erros: [], total: 0 }
  if (tabela.length === 0) return { ...vazio, geral: 'O arquivo está vazio.' }
  const cab = tabela[0].map(semAcento)
  const col = (nome: string) => cab.indexOf(nome)
  if (col('codigo') < 0 || col('tipo') < 0 || col('valor') < 0 || col('usos') < 0) {
    return { ...vazio, geral: 'A primeira linha precisa ter as colunas: codigo;tipo;valor;usos (opcionais: descricao;validade). Baixe o modelo.' }
  }
  const dados = tabela.slice(1)
  if (dados.length > TETO_CUPONS) return { ...vazio, total: dados.length, geral: `O arquivo tem ${dados.length} linhas. O máximo é ${TETO_CUPONS} por vez.` }

  const vistos = new Set([...existentes].map(c => c.toUpperCase()))
  const validas: CupomCsv[] = [], erros: ErroCsv[] = []
  dados.forEach((l, k) => {
    const linha = k + 2 // número da linha no arquivo (o cabeçalho é a 1)
    const v = (nome: string) => (l[col(nome)] ?? '').trim()
    const falhas: string[] = []
    const code = v('codigo').toUpperCase()
    if (!/^[A-Z0-9][A-Z0-9_-]{1,29}$/.test(code)) falhas.push('código inválido (2 a 30 letras sem acento, números, - ou _)')
    else if (vistos.has(code)) falhas.push('código repetido (já existe ou aparece antes no arquivo)')
    const tipo = v('tipo').toLowerCase()
    if (tipo !== 'percent' && tipo !== 'fixed') falhas.push('tipo precisa ser percent ou fixed')
    const valor = precoDe(v('valor'))
    if (valor === null || valor <= 0) falhas.push('valor precisa ser maior que zero')
    else if (tipo === 'percent' && valor > 100) falhas.push('percentual não pode passar de 100')
    else if (valor > 99999999.99) falhas.push('valor grande demais')
    const usosTx = v('usos')
    const usos = usosTx === '' ? null : /^\d+$/.test(usosTx) && Number(usosTx) >= 1 && Number(usosTx) <= 1_000_000 ? Number(usosTx) : NaN
    if (Number.isNaN(usos)) falhas.push('usos precisa ser um número inteiro de 1 em diante (vazio = sem limite)')
    const val = v('validade')
    if (val && !diaValido(val)) falhas.push('validade precisa ser uma data real no formato AAAA-MM-DD')
    else if (val && fimDoDia(val).getTime() <= Date.now()) falhas.push('validade já passou')
    const desc = v('descricao')
    if (desc.length > 200) falhas.push('descrição passa de 200 caracteres')
    if (falhas.length) { erros.push({ linha, motivo: falhas.join('; ') }); return }
    vistos.add(code)
    validas.push({ code, discount_type: tipo as CupomCsv['discount_type'], discount_value: valor!, max_uses: usos as number | null, description: desc || null, valid_until: val ? fimDoDia(val).toISOString() : null })
  })
  return { validas, erros, total: dados.length }
}

/** Modelo para baixar. Passa pelo toCsv do projeto (que protege célula começada em = + - @) */
export const modeloCsv = () => toCsv([{ codigo: 'EXEMPLO10', tipo: 'percent', valor: '10', usos: '1', descricao: 'Amigos da casa', validade: '' }], COLUNAS)

/** Códigos criados, para o produtor distribuir */
export const csvDosCodigos = (codigos: string[]) => toCsv(codigos.map(codigo => ({ codigo })), ['codigo'])

// ---- abas da área ---------------------------------------------------------------------------------------------------
/** Ingressos | Cupons, as duas rotas, com o evento escolhido levado junto */
export const abasIngressosCupons = (eventId?: string | null) => [
  { to: hrefDaTela('/producer/ingressos', eventId), label: 'Ingressos' },
  { to: hrefDaTela('/producer/cupons', eventId), label: 'Cupons' },
]
