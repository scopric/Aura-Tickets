// IP do cliente para os registros gravados pelo servidor (record-access, aceite-evento).
const IPV4_RE = /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/

// IPv4 com 4 números de 0 a 255 ou IPv6 (o parser de URL valida a forma; texto como "cafe" não passa)
function ipValido(s: string): boolean {
  if (IPV4_RE.test(s)) return true
  if (!s.includes(':') || !/^[0-9a-fA-F:.]{2,45}$/.test(s)) return false
  try { new URL(`http://[${s}]`); return true } catch { return false }
}

/**
 * IP provável do cliente + fim da cadeia de proxies. O cliente pode inventar o COMEÇO do
 * x-forwarded-for, mas não apagar o que os proxies acrescentam no FIM: por isso o candidato
 * é o último elemento (ou cf-connecting-ip, que o Cloudflare sobrescreve) e forwarded_for
 * guarda os últimos 200 caracteres da cadeia (só itens que sejam IP válido). Qual header o
 * gateway do Supabase preenche de fato: conferir após o deploy com um login real (ver PR #27).
 */
export function clientIp(headers: Headers): { ip: string | null; forwarded_for: string | null } {
  const chain = headers.get('x-forwarded-for')
  const candidate = (headers.get('cf-connecting-ip') ?? chain?.split(',').at(-1) ?? headers.get('x-real-ip') ?? '').trim()
  // forwarded_for guarda só itens que são IP; se passar de 200 caracteres, perde os mais antigos (o começo)
  let forwarded = (chain ?? '').split(',').map(x => x.trim()).filter(ipValido).join(', ')
  while (forwarded.length > 200) forwarded = forwarded.slice(forwarded.indexOf(',') + 1).trim()
  return {
    ip: ipValido(candidate) ? candidate : null,
    forwarded_for: forwarded || null,
  }
}
