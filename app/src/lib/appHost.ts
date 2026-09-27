// Um único deploy atende três hosts:
// alpha.* → só administradores; app.* → plataforma (participantes e produtores);
// o resto (evokaa.com.br, www., localhost, previews *.vercel.app) → site institucional.
export function getAppMode(hostname = window.location.hostname): 'admin' | 'app' | 'site' {
  if (hostname.startsWith('alpha.')) return 'admin'
  if (hostname.startsWith('app.')) return 'app'
  return 'site'
}

// URL da plataforma (app.*) para um caminho. Em previews da Vercel devolve o caminho relativo.
export function appUrl(
  path: string,
  { hostname, protocol, port }: Pick<Location, 'hostname' | 'protocol' | 'port'> = window.location
): string {
  if (hostname === 'evokaa.com.br' || hostname.endsWith('.evokaa.com.br')) return `https://app.evokaa.com.br${path}`
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return `${protocol}//app.localhost:${port}${path}`
  return path
}

// URL do site público (www.*) para um caminho: links que o produtor ou o participante copiam para divulgar.
// Sempre absoluta (vai para a área de transferência); em previews da Vercel usa a origem atual.
export function siteUrl(
  path: string,
  { hostname, protocol, port }: Pick<Location, 'hostname' | 'protocol' | 'port'> = window.location
): string {
  if (hostname === 'evokaa.com.br' || hostname.endsWith('.evokaa.com.br')) return `https://www.evokaa.com.br${path}`
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return `${protocol}//localhost:${port}${path}`
  return `${protocol}//${hostname}${port ? `:${port}` : ''}${path}`
}
