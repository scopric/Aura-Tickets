// IP do cliente para os registros gravados pelo servidor (record-access, aceite-evento).
const IP_RE = /^(\d{1,3}(\.\d{1,3}){3}|[0-9a-fA-F:]{2,39})$/

/**
 * IP provável do cliente + fim da cadeia de proxies. O cliente pode inventar o COMEÇO do
 * x-forwarded-for, mas não apagar o que os proxies acrescentam no FIM: por isso o candidato
 * é o último elemento (ou cf-connecting-ip, que o Cloudflare sobrescreve) e forwarded_for
 * guarda os últimos 200 caracteres da cadeia. Qual header o gateway do Supabase preenche de
 * fato: conferir após o deploy com um login real (ver PR #27).
 */
export function clientIp(headers: Headers): { ip: string | null; forwarded_for: string | null } {
  const chain = headers.get('x-forwarded-for')
  const candidate = (headers.get('cf-connecting-ip') ?? chain?.split(',').at(-1) ?? headers.get('x-real-ip') ?? '').trim()
  return {
    ip: IP_RE.test(candidate) ? candidate : null,
    forwarded_for: chain ? chain.slice(-200) : null,
  }
}
