// Respostas da função vincular_afiliado (docs/sql/20261005_produtor_acesso.sql, DECISÕES 9 a 17) em texto para o produtor.
// 'nao_encontrado' cobre conta inexistente, e-mail não confirmado, menor de 18 e sem data de nascimento (DECISÕES 10).
const MENSAGENS: Record<string, string> = {
  ok: 'Afiliado vinculado.',
  ja_vinculado: 'Essa pessoa já é afiliada deste evento.',
  nao_encontrado: 'Não encontramos uma conta que possa ser afiliada com esse e-mail. A pessoa precisa ter conta na Evokaa, ser maior de 18 anos e ter a data de nascimento no perfil.',
  proprio: 'Você não pode ser afiliado do seu próprio evento.',
  sem_permissao: 'Só é possível vincular afiliados aos seus próprios eventos.',
  conta_recente: 'Por segurança, contas de produtor com menos de 24 horas ainda não vinculam afiliados.',
  email_invalido: 'Informe um e-mail válido.',
  comissao_invalida: 'A comissão precisa ficar entre 0,01% e 100%.',
  limite: 'Muitas tentativas. Tente de novo mais tarde.',
}

const MFA = 'Para vincular afiliados, confirme o código do 2FA: saia e entre de novo digitando o código do aplicativo autenticador.'
const FALHA = 'Não foi possível vincular agora. Tente de novo em instantes.'

export function mensagemVinculo(codigo: unknown, erro?: { code?: string } | null): string {
  if (erro) return erro.code === '42501' ? MFA : FALHA
  return (typeof codigo === 'string' && Object.hasOwn(MENSAGENS, codigo)) ? MENSAGENS[codigo] : FALHA
}
