// Regra de senha do Supabase Auth deste projeto (Authentication → Sign In / Providers → Password):
// ao menos uma letra minúscula, uma maiúscula, um número e um símbolo do conjunto abaixo (o servidor
// confere pertencimento literal ao conjunto: acento, espaço e emoji NÃO contam). O mínimo de 8 é nosso.
// Fonte única da regra: o hook usePasswordValidation e as telas de senha leem daqui.
// Se a regra do painel mudar, mudar aqui, senão a tela avisa uma coisa e o servidor recusa outra.
// Composição mantida porque o bloqueio de senha vazada (HIBP) exige Supabase Pro; quando ligar,
// trocar por mínimo 8 + lista de senhas comuns (ASVS 5.0 6.2.4/6.2.5).
export const PASSWORD_MIN = 8
export const PASSWORD_SYMBOLS = /[!@#$%^&*()_+\-=[\]{};':"|<>?,./`~]/
export const PASSWORD_HINT = `Pelo menos ${PASSWORD_MIN} caracteres, com letra maiúscula, minúscula, número e símbolo do teclado (ex.: !@#$); acento e espaço não contam`

export function passwordChecks(password: string) {
  return {
    minLength: password.length >= PASSWORD_MIN,
    hasLowercase: /[a-z]/.test(password),
    hasUppercase: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: PASSWORD_SYMBOLS.test(password),
  }
}

export function passwordError(password: string): string | null {
  if (!password) return 'Senha obrigatória'
  if (new TextEncoder().encode(password).length > 72) return 'Senha longa demais (máximo 72 caracteres)'
  const c = passwordChecks(password)
  if (!c.minLength) return `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres`
  if (!c.hasLowercase) return 'Inclua uma letra minúscula'
  if (!c.hasUppercase) return 'Inclua uma letra maiúscula'
  if (!c.hasNumber) return 'Inclua um número'
  if (!c.hasSpecial) return 'Inclua um símbolo do teclado (ex.: !@#$); acento e espaço não contam'
  return null
}
