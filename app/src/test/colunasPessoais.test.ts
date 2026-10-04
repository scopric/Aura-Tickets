import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

// E4: authenticated não tem SELECT em orders.customer_cpf, orders.customer_phone e tickets.buyer_cpf
// (docs/sql/20261011_orders_tickets_colunas_pessoais.sql). Com isso, '*' ou .select() vazio em orders/tickets dá 42501
// na tela inteira. Este teste barra esses padrões no app/src; coluna nova nessas tabelas precisa de grant novo no banco.
// ponytail: regex, não parser; select com variável (ex.: select(colunas)) não é conferido.

const LITERAL = '(`[^`]*`|\'[^\']*\'|"[^"]*")'
// tira os embeds "tabela (colunas)" e devolve só o nível de cima do select
const topo = (s: string) => {
  let t = s
  for (let a = t.replace(/\([^()]*\)/g, ''); a !== t; a = t.replace(/\([^()]*\)/g, '')) t = a
  return t
}

function leiturasProibidas(codigo: string): string[] {
  const achados: string[] = []
  // from('orders'|'tickets') ... .select(<literal> | vazio), sem atravessar outra consulta
  const doFrom = new RegExp(
    `\\.from\\(\\s*['"](orders|tickets)['"]\\s*\\)((?:(?!\\.from\\(|supabase)[\\s\\S])*?)\\.select\\(\\s*(${LITERAL}|\\))`, 'g')
  for (const m of codigo.matchAll(doFrom)) {
    if (m[3] === ')' || topo(m[3]).includes('*')) achados.push(`${m[1]}: ${m[0].replace(/\s+/g, ' ').slice(-70)}`)
  }
  // embed orders(...)/tickets(...) dentro do select de outra tabela
  for (const m of codigo.matchAll(new RegExp(`\\.select\\(\\s*${LITERAL}`, 'g'))) {
    const sel = m[1]
    for (const e of sel.matchAll(/\b(orders|tickets)(?:!\w+)?\s*\(/g)) {
      const ini = e.index! + e[0].length
      let i = ini
      for (let n = 1; i < sel.length && n; i++) n += sel[i] === '(' ? 1 : sel[i] === ')' ? -1 : 0
      const dentro = sel.slice(ini, i - 1)
      if (!dentro.trim() || topo(dentro).includes('*')) achados.push(`embed ${e[1]}(${dentro.trim()})`)
    }
  }
  return achados
}

const SRC = resolve(__dirname, '..')
const arquivos = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap(d =>
    d.isDirectory() ? (d.name === 'test' ? [] : arquivos(join(dir, d.name)))
      : /\.tsx?$/.test(d.name) ? [join(dir, d.name)] : [])

describe('orders e tickets sem colunas pessoais (E4)', () => {
  it('nenhuma leitura de orders/tickets no app/src usa * ou .select() vazio', () => {
    const lidos = arquivos(SRC)
    expect(lidos.length).toBeGreaterThan(50)
    const achados = lidos.flatMap(f => leiturasProibidas(readFileSync(f, 'utf8')).map(a => `${relative(SRC, f)} -> ${a}`))
    expect(achados).toEqual([])
  })

  it('pega os padrões proibidos', () => {
    const ruins = [
      "supabase.from('orders').select('*').eq('id', x)",
      'supabase.from("tickets").select("*")',
      "supabase.from('orders').insert({ user_id: u, total: 1 }).select().single()",
      "supabase\n  .from('orders')\n  .select(`\n    *,\n    events (title)\n  `)",
      "supabase.from('tickets').select('id, *')",
      "supabase.from('check_ins').select('id, tickets (*)')",
      "supabase.from('events').select('id, pedido:orders!inner(*)')",
      "supabase.from('order_items').select('id, orders()')",
    ]
    for (const r of ruins) expect(leiturasProibidas(r), r).toHaveLength(1)
  })

  it('deixa passar colunas explícitas e * de outras tabelas', () => {
    const bons = [
      "supabase.from('orders').select('id, total, events (*)')",
      "supabase.from('tickets').select(`id, status, ticket_types (name, events (title))`)",
      "supabase.from('tickets').select('id', { count: 'exact', head: true })",
      "supabase.from('events').select('*')",
      "supabase.from('orders').update({ status: 'x' }).eq('id', 1)\nsupabase.from('events').select('*')",
      "supabase.from('check_ins').select('id, tickets (buyer_name, ticket_types (name))')",
      'supabase.from(\'orders\').insert({}).select(`${COLUNAS_PEDIDO}, customer_name`).single()',
    ]
    for (const b of bons) expect(leiturasProibidas(b), b).toEqual([])
  })
})
