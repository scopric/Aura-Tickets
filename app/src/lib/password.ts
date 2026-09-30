// Regra de senha (ASVS 5.0, V6.2): mínimo de 8 caracteres, sem regra de composição
// (maiúscula/número/símbolo não são exigidos). O máximo de 72 bytes é o limite do bcrypt do Supabase.
// Fonte única da regra: o hook usePasswordValidation e as telas de senha leem daqui.
// O painel do Supabase (Authentication → Sign In / Providers → Password) precisa estar igual:
// se exigir composição, a tela aceita e o servidor recusa.
export const PASSWORD_MIN = 8
export const PASSWORD_SYMBOLS = /[!@#$%^&*()_+\-=[\]{};':"|<>?,./`~]/
export const PASSWORD_HINT = `Pelo menos ${PASSWORD_MIN} caracteres`

// Os itens além de minLength só alimentam o medidor de força (usePasswordValidation); não são exigidos.
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
  if (!passwordChecks(password).minLength) return `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres`
  return null
}
