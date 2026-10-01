// Cópia da regra de senha de app/src/lib/password.ts (passwordError) para as Edge Functions, que não importam
// arquivos do app. O teste app/src/test/password.test.ts confere que as duas dão a mesma resposta: mudou lá, mude aqui.
const PASSWORD_MIN = 8
const PASSWORD_SYMBOLS = /[!@#$%^&*()_+\-=[\]{};':"|<>?,./`~]/

export function passwordError(password: string): string | null {
  if (!password) return 'Senha obrigatória'
  if (new TextEncoder().encode(password).length > 72) return 'Senha longa demais (máximo 72 caracteres)'
  if (password.length < PASSWORD_MIN) return `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres`
  if (!/[a-z]/.test(password)) return 'Inclua uma letra minúscula'
  if (!/[A-Z]/.test(password)) return 'Inclua uma letra maiúscula'
  if (!/[0-9]/.test(password)) return 'Inclua um número'
  if (!PASSWORD_SYMBOLS.test(password)) return 'Inclua um símbolo do teclado (ex.: !@#$); acento e espaço não contam'
  return null
}
