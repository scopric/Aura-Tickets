import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

// E4: authenticated não tem SELECT em orders.customer_cpf, orders.customer_phone e tickets.buyer_cpf
// (docs/sql/20261011_orders_tickets_colunas_pessoais.sql). Com isso, '*' ou .select() vazio em orders/tickets dá 42501
// na tela inteira. Este teste barra esses padrões no app/src; coluna nova nessas tabelas precisa de grant novo no banco.
// S4b: o mesmo vale para profiles (docs/sql/20261018_admin_s4b_profiles_colunas.sql): além de '*' e .select() vazio, barra
// nomear qualquer das 17 colunas retidas (telefone, cpf, nascimento...). O próprio perfil vem de meu_perfil(); a equipe, o
// Atendimento e a lista de Usuários vêm de RPCs.
// ponytail: regex, não parser; select com variável (ex.: select(colunas)) não é conferido.

const LITERAL = '(`[^`]*`|\'[^\']*\'|"[^"]*")'
const RETIDAS_PROFILES = new RegExp(`\\b(${[
  'phone', 'cpf', 'bio', 'city', 'birth_date', 'instagram', 'tiktok', 'linkedin', 'stripe_customer_id', 'is_verified',
  'updated_at', 'website', 'admin_permissions', 'avatar_moderado_em', 'avatar_moderacao_hash', 'avatar_moderacao_tentativas',
  'avatar_moderacao_reservada_ate'].join('|')})\\b`)
// tira os embeds "tabela (colunas)" e devolve só o nível de cima do select
const topo = (s: string) => {
  let t = s
  for (let a = t.replace(/\([^()]*\)/g, ''); a !== t; a = t.replace(/\([^()]*\)/g, '')) t = a
  return t
}

function leiturasProibidas(codigo: string): string[] {
  const achados: string[] = []
  // from('orders'|'tickets') [as never] ou from(<variável>) [as never] ... o PRIMEIRO .select( depois dele, sem atravessar
  // outra consulta; select com variável não é conferido. from(<variável>) pode cair em orders/tickets: barra em qualquer tabela.
  const doFrom = new RegExp(
    `(?<!Array)\\.from\\(\\s*(['"](?:orders|tickets|profiles)['"]|[A-Za-z_$][\\w$]*)(?:\\s+as\\s+\\w+)?\\s*\\)` +
    `(?:(?!\\.from\\(|supabase|\\.select\\()[\\s\\S])*?\\.select\\((\\s*\\)|\\s*${LITERAL})?`, 'g')
  for (const m of codigo.matchAll(doFrom)) {
    const arg = m[2]?.trim()
    const profiles = /^['"]profiles['"]$/.test(m[1])
    if (arg !== undefined && (arg === ')' || topo(arg).includes('*') || (profiles && RETIDAS_PROFILES.test(topo(arg))))) achados.push(`${m[1]}: ${m[0].replace(/\s+/g, ' ').slice(-70)}`)
  }
  // embed orders(...)/tickets(...)/profiles(...) dentro do select de outra tabela
  for (const m of codigo.matchAll(new RegExp(`\\.select\\(\\s*${LITERAL}`, 'g'))) {
    const sel = m[1]
    for (const e of sel.matchAll(/\b(orders|tickets|profiles)(?:!\w+)?\s*\(/g)) {
      const ini = e.index! + e[0].length
      let i = ini
      for (let n = 1; i < sel.length && n; i++) n += sel[i] === '(' ? 1 : sel[i] === ')' ? -1 : 0
      const dentro = sel.slice(ini, i - 1)
      if (!dentro.trim() || topo(dentro).includes('*') || (e[1] === 'profiles' && RETIDAS_PROFILES.test(topo(dentro)))) achados.push(`embed ${e[1]}(${dentro.trim()})`)
    }
  }
  return achados
}

const SRC = resolve(__dirname, '..')
const arquivos = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap(d =>
    d.isDirectory() ? (d.name === 'test' ? [] : arquivos(join(dir, d.name)))
      : /\.tsx?$/.test(d.name) ? [join(dir, d.name)] : [])

describe('orders, tickets e profiles sem colunas pessoais (E4, S4b)', () => {
  it('nenhuma leitura de orders/tickets/profiles no app/src usa *, .select() vazio ou coluna retida', () => {
    const lidos = arquivos(SRC)
    expect(lidos.length).toBeGreaterThan(50)
    const achados = lidos.flatMap(f => leiturasProibidas(readFileSync(f, 'utf8')).map(a => `${relative(SRC, f)} -> ${a}`))
    expect(achados).toEqual([])
  })

  it('pega os padrões proibidos', () => {
    const ruins = [
      "supabase.from('orders').select('*').eq('id', x)",
      "supabaseAdmin.from('orders').select('*')",
      'supabase.from("tickets").select("*")',
      "supabase.from('orders').insert({ user_id: u, total: 1 }).select().single()",
      "supabase\n  .from('orders')\n  .select(`\n    *,\n    events (title)\n  `)",
      "supabase.from('tickets').select('id, *')",
      "supabase.from('check_ins').select('id, tickets (*)')",
      "supabase.from('events').select('id, pedido:orders!inner(*)')",
      "supabase.from('order_items').select('id, orders()')",
      "supabase.from('orders' as never).select('*')",
      "supabase.from(tabela).select('*').order('id').range(from, to)",
      "supabase.from(tabela as never).select()",
      "supabase\n  .from(t)\n  .select(`*`)",
      "supabase.from('profiles').select('*').eq('id', x).single()",
      "supabase.from('profiles').select('id, full_name, phone').eq('id', x)",
      "supabase.from('profiles').select('id, cpf')",
      "supabase.from('profiles').update({ role: 'user' }).eq('id', x).select()",
      "supabase.from('profiles' as never).select('birth_date')",
      "supabase.from('profiles').select('id, producer_profiles(company_name), admin_permissions')",
      "supabase.from('events').select('id, profiles!producer_id (full_name, phone)')",
      "supabase.from('coupons').select('*, producer:profiles!coupons_producer_id_fkey(*)')",
      "supabase.from('user_activities').select('id, profiles(email, is_verified)')",
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
      "supabase.from(tabela).select(colunas[tabela].join(', ')).order('id')\nsupabase.from('x').select('*')",
      "supabase.from('tickets').select(colunasSel, opt).eq('event_id', 1)\nconst y = 1; supabase.from('events').select('*')",
      "supabase.from(tabela as never).delete().eq('id', 1).select('id')",
      "Array.from(ids).map(x => x)\nsupabase.from('events').select('*')",
      "supabase.from('orders' as never).select('id, total')",
      "supabase.from('profiles').select('id, email, full_name, avatar_url, role, created_at')",
      "supabase.from('profiles').select('avatar_url, avatar_moderacao' as never).eq('id', x).maybeSingle()",
      "supabase.from('profiles').update({ phone: p, birth_date: d }).eq('id', x).select('id')",
      "supabase.from('profiles').select('id, producer_profiles(company_name, cnpj, is_verified), events!producer_id(count)')",
      "supabase.from('events').select('id, profiles!producer_id (full_name, email)')",
      "supabase.from('user_activities').select('id, profiles(id, email, full_name, role)')",
      "supabase.from('profiles').select('id', { count: 'exact', head: true })",
    ]
    for (const b of bons) expect(leiturasProibidas(b), b).toEqual([])
  })
})
