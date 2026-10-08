// CORS das Edge Functions chamadas pelo navegador: só os domínios da Evokaa (site, app, alpha) e
// localhost recebem a própria origem de volta; o resto recebe a do site e o navegador bloqueia.
// É conveniência, não barreira: quem protege as funções é o JWT (Authorization: Bearer), que uma
// página de outra origem não consegue ler. Prévias da Vercel ficam de fora (exigem login da Vercel,
// e um padrão por nome de projeto aceitaria projetos de terceiros).
export const ORIGENS = [
  'https://www.evokaa.com.br',
  'https://evokaa.com.br',
  'https://app.evokaa.com.br',
  'https://alpha.evokaa.com.br',
]
const LOCALHOST = /^http:\/\/([a-z]+\.)?localhost(:\d+)?$/

export function corsHeaders(req: Request): Record<string, string> {
  const origem = req.headers.get('Origin') ?? ''
  const permitida = ORIGENS.includes(origem) || LOCALHOST.test(origem)
  return {
    'Access-Control-Allow-Origin': permitida ? origem : ORIGENS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}
