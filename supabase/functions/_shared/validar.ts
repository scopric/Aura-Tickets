// Validação dos canais públicos da send-email (contato e inscrição na newsletter). Função pura: roda na
// Edge Function e no vitest (app/src/test/validar.test.ts). O servidor é a única barreira: a tela valida
// também, mas quem ataca chama a função direto.

// null/undefined viram '' (campo opcional vazio); qualquer outro tipo (número, objeto, lista) é inválido
const texto = (v: unknown): string | null => v == null ? '' : typeof v === 'string' ? v.trim() : null

// Caracteres de controle: nenhum em nome, telefone, assunto e e-mail; na mensagem, só quebra de linha e tab
const CONTROLE = /[\u0000-\u001F\u007F]/
const CONTROLE_MENSAGEM = /[\u0000-\u0008\u000B-\u001F\u007F]/

// ponytail: formato básico (algo@dominio.tld, sem espaço), não RFC 5322; quem confirma o dono é a dupla
// confirmação (plano N1)
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/
// ? & # não aparecem em e-mail de verdade e virariam parâmetro no link mailto: do aviso à equipe
const EMAIL_PROIBIDO = /[?&#\u0000-\u001F\u007F]/

export function validarEmail(v: unknown): string | null {
  const email = texto(v)?.toLowerCase()
  return email && email.length <= 254 && EMAIL_RE.test(email) && !EMAIL_PROIBIDO.test(email) ? email : null
}

export type Contato = { name: string; email: string; phone: string; subject: string; message: string; page: string }

export function validarContato(p: Record<string, unknown>): { ok: true; dados: Contato } | { ok: false; erro: string } {
  const name = texto(p.name)
  const phone = texto(p.phone)
  const subject = texto(p.subject)
  const message = texto(p.message)
  const page = texto(p.page)
  if (name === null || phone === null || subject === null || message === null || page === null)
    return { ok: false, erro: 'Dados do formulário inválidos.' }
  const email = validarEmail(p.email)
  if (!name || name.length > 120) return { ok: false, erro: 'Informe um nome de até 120 caracteres.' }
  if (!email) return { ok: false, erro: 'Informe um e-mail válido.' }
  if (phone.length > 30) return { ok: false, erro: 'Telefone com no máximo 30 caracteres.' }
  if (subject.length > 120) return { ok: false, erro: 'Assunto com no máximo 120 caracteres.' }
  if (!message || message.length > 5000) return { ok: false, erro: 'Escreva uma mensagem de até 5000 caracteres.' }
  if (page.length > 300) return { ok: false, erro: 'Página de origem inválida.' }
  if (CONTROLE.test(name) || CONTROLE.test(phone) || CONTROLE.test(subject))
    return { ok: false, erro: 'Há caracteres inválidos no nome, telefone ou assunto.' }
  if (CONTROLE_MENSAGEM.test(message)) return { ok: false, erro: 'Há caracteres inválidos na mensagem.' }
  return { ok: true, dados: { name, email, phone, subject, message, page } }
}

// Chave do limite por IP. IPv4: o próprio endereço. IPv6: o prefixo /64 (ex. "2001:db8:1:2::/64"): o provedor
// entrega um /64 inteiro a cada cliente, então contar por endereço deixaria trocar de IP a cada chamada.
// IPv4 escrito como IPv6 ("::ffff:1.2.3.4") vira o IPv4. Não é IP → null.
const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/
const ipv4 = (s: string) => IPV4_RE.test(s) && s.split('.').every(o => Number(o) <= 255)

export function chaveIp(ip: string): string | null {
  const s = ip.trim().toLowerCase()
  if (ipv4(s)) return s
  if (s.startsWith('::ffff:') && ipv4(s.slice(7))) return s.slice(7)
  const partes = s.split('::')
  if (partes.length > 2) return null
  const grupos = (x: string) => (x ? x.split(':') : [])
  const esq = grupos(partes[0])
  const dir = grupos(partes[1] ?? '')
  const faltam = 8 - esq.length - dir.length
  if (partes.length === 1 ? faltam !== 0 : faltam < 1) return null
  const todos = [...esq, ...Array(partes.length === 2 ? faltam : 0).fill('0'), ...dir]
  if (!todos.every(g => /^[0-9a-f]{1,4}$/.test(g))) return null
  return todos.slice(0, 4).map(g => parseInt(g, 16).toString(16)).join(':') + '::/64'
}
