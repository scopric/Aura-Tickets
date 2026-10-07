import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// Leitura do painel financeiro do admin. As regras de acesso (docs/sql/20260928_admin_policies.sql)
// dão SELECT para gf_is_admin() em orders, transactions e withdrawals.
// Enquanto o gateway da Fase 4 não existir, todo pedido nasce 'pending': o extrato e a receita
// ficam vazios de propósito, e não inventados.

export interface AdminOrder {
  id: string
  total: number
  status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded'
  payment_method: string | null
  created_at: string
  customer_name: string | null
  customer_email: string | null
  events: { title: string } | null
}

export interface AdminTransaction {
  id: string
  type: 'income' | 'expense' | 'withdrawal' | 'refund' | 'fee'
  amount: number
  description: string | null
  status: 'pending' | 'completed' | 'failed'
  created_at: string
  profiles: ProfileRef | null
}

export interface AdminWithdrawal {
  id: string
  amount: number
  pix_key: string | null
  bank_account: Record<string, unknown> | null
  status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
  processed_at: string | null
  profiles: ProfileRef | null
}

export interface AdminFinanceData {
  orders: AdminOrder[]
  transactions: AdminTransaction[]
  withdrawals: AdminWithdrawal[]
}

/** Recurso embutido do PostgREST: vem como objeto (1:1) ou como lista, e null quando não há linha. */
type Embed<T> = T | T[] | null | undefined
const um = <T,>(v: Embed<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null))

interface ProfileRef { full_name: string | null; email: string | null }

export function useAdminFinance() {
  return useQuery<AdminFinanceData>({
    queryKey: ['admin-finance'],
    queryFn: async () => {
      // sem apelido na FK: orders e transactions têm uma única FK para profiles, então o PostgREST resolve sem ambiguidade
      const [orders, transactions, withdrawals] = await Promise.all([
        supabase
          .from('orders')
          .select('id, total, status, payment_method, created_at, customer_name, customer_email, events (title)')
          .order('created_at', { ascending: false })
          .limit(1000),
        supabase
          .from('transactions')
          .select('id, type, amount, description, status, created_at, profiles (full_name, email)')
          .order('created_at', { ascending: false })
          .limit(1000),
        supabase.rpc('pr7_admin_saques' as never), // Pix/banco completos, só manage_finance (docs/sql/20261007_pr7_cripto_rpcs.sql)
      ])

      const erro = orders.error || transactions.error || withdrawals.error
      if (erro) throw erro

      // as linhas chegam como `never[]` enquanto o cliente do Supabase não tiver os tipos do banco
      // (pendência conhecida: `supabase gen types typescript`), por isso o cast nas 3 leituras
      const txs = (transactions.data || []) as (AdminTransaction & { profiles: Embed<ProfileRef> })[]
      const wds = (withdrawals.data || []) as unknown as (AdminWithdrawal & { produtor_nome: string | null; produtor_email: string | null })[]

      return {
        orders: (orders.data || []) as AdminOrder[],
        transactions: txs.map(t => ({ ...t, profiles: um(t.profiles) })) as AdminTransaction[],
        withdrawals: wds.map(({ produtor_nome, produtor_email, ...w }) => ({
          ...w,
          profiles: { full_name: produtor_nome, email: produtor_email },
        })) as AdminWithdrawal[],
      }
    },
  })
}
