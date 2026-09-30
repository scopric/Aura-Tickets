// CORS das Edge Functions chamadas pelo navegador: só as origens da Evokaa (site, app, alpha),
// as prévias da Vercel deste projeto e localhost recebem a própria origem de volta.
// Origem fora da lista recebe a do site, e o navegador bloqueia a resposta.
const ORIGENS = [
  'https://www.evokaa.com.br',
  'https://evokaa.com.br',
  'https://app.evokaa.com.br',
  'https://alpha.evokaa.com.br',
  'https://aura-tickets-pypy.vercel.app',
]
const PADROES = [
  /^https:\/\/aura-tickets-pypy(-[a-z0-9-]+)?-scoprics-projects\.vercel\.app$/,
  /^http:\/\/([a-z]+\.)?localhost(:\d+)?$/,
]

export function corsHeaders(req: Request): Record<string, string> {
  const origem = req.headers.get('Origin') ?? ''
  const permitida = ORIGENS.includes(origem) || PADROES.some((p) => p.test(origem))
  return {
    'Access-Control-Allow-Origin': permitida ? origem : ORIGENS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}
