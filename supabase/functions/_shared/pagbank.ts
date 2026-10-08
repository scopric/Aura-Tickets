// Cliente fino da API do PagBank + funções puras de dinheiro, CPF, split e prazo (testadas em pagbank_test.ts).
// Valores em CENTAVOS (inteiros). Nada aqui lê banco nem grava segredo: o token vem de quem chama.

export const ACCO_RE = /^ACCO_[0-9A-Fa-f-]{36}$/

export type PagbankCfg = { baseUrl: string; token: string }

/** Erro do PagBank já sem corpo: a mensagem para o cliente é escolhida por quem chama, o detalhe vai (mascarado) só para o log. */
export class PagbankErro extends Error {
  constructor(public status: number, detalhe: string) { super(detalhe) }
}

/** Tira de um texto de log o token, o Bearer, IDs de conta (ACCO_), CPF/CNPJ (11 ou 14 dígitos) e e-mails. */
export function mascarar(texto: string, token = ''): string {
  let s = texto
  if (token.length >= 8) s = s.split(token).join('***')
  return s
    .replace(/Bearer\s+\S+/gi, 'Bearer ***')
    .replace(/ACCO_[0-9A-Fa-f-]+/g, 'ACCO_***')
    .replace(/\b\d{11}(\d{3})?\b/g, '***')
    .replace(/[^\s@"]+@[^\s@"]+/g, '***@***')
}

/** Reais (número do banco, ex. 12.34) para centavos inteiros; 3+ casas arredondam; inválido/negativo = NaN. */
export function reaisParaCentavos(v: number | string | null | undefined): number {
  const n = typeof v === 'string' ? Number(v) : v
  if (n == null || !Number.isFinite(n) || n < 0) return NaN
  // 1.005 * 100 = 100.49999...: o epsilon corrige o erro do ponto flutuante antes de arredondar
  return Math.round(n * 100 + Number.EPSILON * n * 100)
}

/** CPF com dígitos verificadores; aceita pontuação; rejeita sequência repetida (111.111.111-11). */
export function validarCpf(v: unknown): boolean {
  if (typeof v !== 'string') return false
  const d = v.replace(/[.\-\s]/g, '')
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false
  const dv = (n: number) => {
    let soma = 0
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i)
    const r = (soma * 10) % 11
    return r === 10 ? 0 : r
  }
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10])
}

/**
 * Split FIXED: a plataforma fica com a taxa (sem custódia) e o produtor com o RESTO (soma exata = total),
 * com custódia até `liberarEm`. Regras do PagBank (sandbox): mínimo 2 recebedores distintos, ACCO_ + 36 caracteres.
 * Devolve null (sem split) quando algo não permite dividir; quem chama registra o motivo.
 */
export function montarSplit(a: {
  totalCentavos: number; taxaCentavos: number; plataformaId: string; produtorId: string | null | undefined; liberarEm: string
}) {
  const { totalCentavos, taxaCentavos, plataformaId, produtorId, liberarEm } = a
  if (!produtorId || !ACCO_RE.test(produtorId) || !ACCO_RE.test(plataformaId) || produtorId === plataformaId) return null
  if (!Number.isInteger(totalCentavos) || !Number.isInteger(taxaCentavos) || taxaCentavos <= 0 || taxaCentavos >= totalCentavos) return null
  return {
    method: 'FIXED',
    receivers: [
      { account: { id: plataformaId }, amount: { value: taxaCentavos }, reason: 'Taxa de serviço Evokaa', configurations: { custody: { apply: false } } },
      { account: { id: produtorId }, amount: { value: totalCentavos - taxaCentavos }, reason: 'Repasse ao produtor',
        configurations: { custody: { apply: true, release: { scheduled: liberarEm } } } },
    ],
  }
}

const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z')

/** Validade do Pix: o MENOR entre (reservado_ate − 15 s) e (agora + 9 min), em segundos inteiros (arredonda para baixo). Nunca passa de reservado_ate. */
export function calcularExpiracao(reservadoAte: Date, agora: Date): string {
  const ms = Math.min(reservadoAte.getTime() - 15_000, agora.getTime() + 9 * 60_000)
  return iso(new Date(Math.floor(ms / 1000) * 1000))
}

const DIA = 86_400_000
/**
 * Data de liberação da custódia: fim do evento + `dias`, no máximo 364 dias a partir de agora (o PagBank aceita até 365;
 * sem data seriam 90). Formato -03:00 (o aceito no sandbox). Brasília não tem horário de verão desde 2019.
 */
export function calcularLiberacao(fimEvento: Date, dias: number, agora: Date): string {
  const alvo = Math.min(fimEvento.getTime() + dias * DIA, agora.getTime() + 364 * DIA)
  return new Date(Math.floor(alvo / 1000) * 1000 - 3 * 3600_000).toISOString().replace('Z', '-03:00')
}

/** Chamada à API com timeout. Qualquer falha vira PagbankErro SEM o corpo da resposta (o detalhe mascarado fica na mensagem, só para log). */
export async function pagbankFetch(
  cfg: PagbankCfg, caminho: string, init: { method: 'GET' | 'POST'; body?: unknown; idempotencia?: string }, fetchFn: typeof fetch = fetch, timeoutMs = 15_000,
): Promise<Record<string, unknown>> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const r = await fetchFn(cfg.baseUrl.replace(/\/+$/, '') + caminho, {
      method: init.method,
      signal: ctl.signal,
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        'x-api-version': '1.0',
        'Content-Type': 'application/json',
        // não verificado na doc salva: nome do cabeçalho de idempotência do PagBank (a página só diz "cabeçalho")
        ...(init.idempotencia ? { 'x-idempotency-key': init.idempotencia } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })
    const texto = await r.text()
    if (!r.ok) throw new PagbankErro(r.status, mascarar(`PagBank ${init.method} ${caminho} -> ${r.status}: ${texto.slice(0, 500)}`, cfg.token))
    try { return JSON.parse(texto) } catch { throw new PagbankErro(502, 'PagBank devolveu resposta que não é JSON') }
  } catch (e) {
    if (e instanceof PagbankErro) throw e
    throw new PagbankErro(504, mascarar(`PagBank ${init.method} ${caminho} falhou: ${e instanceof Error ? e.name : 'erro'}`, cfg.token))
  } finally {
    clearTimeout(t)
  }
}
