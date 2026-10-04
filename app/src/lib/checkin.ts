// Check-in da portaria: formato do código e motivo da leitura (funções puras, testadas em test/checkinLeitura.test.tsx).

// qr_code do ingresso = gen_random_uuid()::text (baseline.sql, tickets.qr_code): 36 caracteres, minúsculas
const CODIGO_INGRESSO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const EXEMPLO_CODIGO = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'

export const codigoCompleto = (s: string) => CODIGO_INGRESSO.test(s.trim())

// Leitor com Caps Lock manda maiúsculas e a busca no banco diferencia: o formato real é sempre minúsculo
export const normalizarCodigo = (s: string) => (codigoCompleto(s) ? s.trim().toLowerCase() : s.trim())

export interface RespostaLeitura {
  http?: number // status da função; sem ele, a chamada nem chegou lá (rede)
  valid?: boolean
  message?: string
  checkedInAt?: string | null
}
export interface Leitura { tom: 'ok' | 'aviso' | 'erro'; rotulo: string; mensagem: string; falha?: boolean }

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

// Traduz a resposta de supabase/functions/check-in-validate. "falha" = problema do sistema ou da conta, não do ingresso.
export function motivoLeitura(r: RespostaLeitura): Leitura {
  const msg = r.message ?? ''
  if (r.valid) return { tom: 'ok', rotulo: 'Acesso Permitido', mensagem: msg || 'Check-in realizado com sucesso!' }
  if (r.http === undefined || r.http >= 500) {
    return { tom: 'erro', rotulo: 'Sistema fora do ar', mensagem: 'Não foi possível conferir agora. O problema não é do ingresso: tente de novo.', falha: true }
  }
  if (r.http === 401) return { tom: 'erro', rotulo: 'Sessão expirada', mensagem: 'Faça login de novo para continuar.', falha: true }
  if (r.http === 403) {
    return /2FA/i.test(msg)
      ? { tom: 'erro', rotulo: '2FA pendente', mensagem: 'Confirme o código do 2FA: saia e entre de novo.', falha: true }
      : { tom: 'erro', rotulo: 'Sem permissão', mensagem: msg || 'Você não tem permissão para fazer check-in neste evento.', falha: true }
  }
  if (r.http === 400 || r.http === 404) return { tom: 'erro', rotulo: 'Inválido', mensagem: msg || 'Ingresso não encontrado ou inválido para este evento' }
  if (/já foi utilizado/i.test(msg)) {
    return { tom: 'aviso', rotulo: 'Já usado', mensagem: r.checkedInAt ? `Já usado às ${hora(r.checkedInAt)}` : 'Ingresso já foi utilizado' }
  }
  const status = /Status:\s*(\w+)/.exec(msg)?.[1]
  if (status === 'cancelled' || status === 'refunded') return { tom: 'erro', rotulo: 'Cancelado', mensagem: 'Ingresso cancelado ou reembolsado: não libera entrada.' }
  if (status === 'transferred') return { tom: 'erro', rotulo: 'Transferido', mensagem: 'Ingresso transferido: este código não libera entrada.' }
  return { tom: 'erro', rotulo: 'Indisponível', mensagem: msg || 'Ingresso indisponível' }
}
