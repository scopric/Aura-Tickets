import { supabase } from './supabase'
import type { EventProposal } from '../components/evo/EvoPlanejar'

export type Resposta =
  | { ok: true; reply_md: string; proposal?: EventProposal; pecas?: unknown; custo?: number; usage_id: string; restante: number }
  | { ok: false; motivo: string; message?: string; custo?: number; restante?: number }

export const RECUSAS: Record<string, string> = {
  desligado: 'O Evo ainda não está disponível.',
  sem_credito: 'Seus créditos do Evo acabaram este mês.',
  limite_hora: 'Você fez muitas perguntas na última hora. Espere um pouco e tente de novo.',
  teto_diario: 'O Evo atingiu o limite de uso de hoje. Tente de novo amanhã.',
  sem_chave: 'O Evo está em manutenção. Tente de novo mais tarde.',
  nao_autorizado: 'Sua conta não tem acesso ao Evo.',
  sessao: 'Sua sessão expirou. Entre de novo na sua conta para usar o Evo.',
  erro_ia: 'O Evo teve um problema para responder. Tente de novo em instantes.',
  rede: 'Não consegui falar com o Evo. Confira sua conexão e tente de novo.',
  indisponivel: 'O Evo ainda não está disponível. Tente mais tarde.',
  instabilidade: 'O Evo está com instabilidade. Tente de novo em instantes.',
  // leitor de planta (Lugar marcado)
  limite_planta: 'Você fez muitas leituras de planta na última hora. Tente de novo mais tarde.',
  planta_instavel: 'O leitor de planta está instável no momento. Tente de novo mais tarde. Esta tentativa não usou seus créditos.',
}

export async function chamarEvo(body: object): Promise<Resposta> {
  const { data, error } = await supabase.functions.invoke('agent', { body })
  if (!error) return data as Resposta
  // Erro HTTP ou do relay traz a resposta em `context`
  const ctx = (error as { context?: unknown }).context
  if (ctx instanceof Response) {
    if (ctx.status === 401) return { ok: false, motivo: 'sessao' }
    if (ctx.status === 404) return { ok: false, motivo: 'indisponivel' }
    const corpo = await ctx.json().catch(() => null)
    if (corpo?.motivo) return corpo
    return { ok: false, motivo: ctx.status >= 500 || error.name === 'FunctionsRelayError' ? 'instabilidade' : 'erro_ia' }
  }
  // Sem Response (FunctionsFetchError). Função não publicada também cai aqui: o gateway responde
  // 404 ao preflight OPTIONS e o navegador acusa erro de CORS. Só culpa a conexão se estiver offline.
  return { ok: false, motivo: navigator.onLine === false ? 'rede' : 'instabilidade' }
}

export const creditos = (n: number) => (n === 1 ? '1 crédito' : `${n} créditos`)
