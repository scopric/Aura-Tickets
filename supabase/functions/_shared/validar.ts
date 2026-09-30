// Validação dos canais públicos da send-email (contato e inscrição na newsletter). Função pura: roda na
// Edge Function e no vitest (app/src/test/validar.test.ts). O servidor é a única barreira: a tela valida
// também, mas quem ataca chama a função direto.
const texto = (v: unknown) => String(v ?? '').trim()

// ponytail: formato básico (algo@dominio.tld, sem espaço), não RFC 5322; quem confirma o dono é a dupla
// confirmação (plano N1)
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/

export function validarEmail(v: unknown): string | null {
  const email = texto(v).toLowerCase()
  return email.length <= 254 && EMAIL_RE.test(email) ? email : null
}

export type Contato = { name: string; email: string; phone: string; subject: string; message: string; page: string }

export function validarContato(p: Record<string, unknown>): { ok: true; dados: Contato } | { ok: false; erro: string } {
  const name = texto(p.name)
  const email = validarEmail(p.email)
  const phone = texto(p.phone)
  const subject = texto(p.subject)
  const message = texto(p.message)
  const page = texto(p.page)
  if (!name || name.length > 120) return { ok: false, erro: 'Informe um nome de até 120 caracteres.' }
  if (!email) return { ok: false, erro: 'Informe um e-mail válido.' }
  if (phone.length > 30) return { ok: false, erro: 'Telefone com no máximo 30 caracteres.' }
  if (subject.length > 120) return { ok: false, erro: 'Assunto com no máximo 120 caracteres.' }
  if (!message || message.length > 5000) return { ok: false, erro: 'Escreva uma mensagem de até 5000 caracteres.' }
  if (page.length > 300) return { ok: false, erro: 'Página de origem inválida.' }
  return { ok: true, dados: { name, email, phone, subject, message, page } }
}
