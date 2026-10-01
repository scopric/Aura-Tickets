// Erros da função caixinha_movimentar (docs/sql/20261005_produtor_acesso.sql) em texto para o produtor.
// 42501 vem quando o item não é da conta ou quando a sessão está sem o código do 2FA (a regra esconde a linha).
const MENSAGENS: Record<string, string> = {
  '23514': 'Saldo insuficiente: o valor da retirada é maior que o guardado neste item.',
  '22023': 'Valor inválido. Use um valor entre R$ 0,01 e R$ 999.999.999,99.',
  '42501': 'Este item não foi encontrado na sua conta. Se você usa 2FA, saia e entre de novo digitando o código do aplicativo.',
}

const FALHA = 'Não foi possível registrar o movimento. Tente de novo em instantes.'

export function mensagemMovimento(erro: unknown): string {
  const code = (erro as { code?: unknown } | null | undefined)?.code
  return typeof code === 'string' && Object.hasOwn(MENSAGENS, code) ? MENSAGENS[code] : FALHA
}
