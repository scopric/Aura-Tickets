// Moderação automática da foto do Match de Mesa (Fase E): lógica pura, testada pelo Vitest
// (app/src/test/moderacao.test.ts). O index.ts de moderar-foto só liga Deno, Supabase e fetch.
// Nada aqui escreve foto, id, hash ou texto do Gemini no log: só contagens e status HTTP.

export const MOTIVOS_IA = ['nudez', 'violencia', 'odio', 'politica', 'drogas', 'sem_rosto', 'famoso', 'texto_contato', 'outro'] as const

export type Decisao = 'aprovada' | 'recusada' | 'revisar' | 'erro'
export type Resultado = { decisao: Decisao; motivos: string[]; tokensIn: number; tokensOut: number }
export type Foto = { user: string; hash: string; foto: string }

const BLOQUEIOS = ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'IMAGE_SAFETY']
const DECISOES: Record<string, Decisao> = { aprovar: 'aprovada', recusar: 'recusada', revisar: 'revisar' }
const PREFIXO = 'data:image/jpeg;base64,'

const INSTRUCAO = `Você modera a foto de perfil de uma plataforma de eventos para maiores de 18.
Recuse só quando for claro, com o motivo:
- nudez: nudez ou conteúdo sexual;
- violencia: violência ou armas;
- odio: símbolo de ódio;
- politica: propaganda de partido ou candidato;
- drogas: drogas;
- famoso: pessoa famosa conhecida;
- texto_contato: texto ou contato escrito (telefone, @, link);
- sem_rosto: não há rosto humano visível.
Na dúvida, revise. Aprove foto comum de rosto.
Não descreva a pessoa; responda só o JSON.`

// Só o base64 de um JPEG em data URL; qualquer outro formato devolve null.
export function base64Jpeg(foto: string): string | null {
  if (typeof foto !== 'string' || !foto.startsWith(PREFIXO)) return null
  const b64 = foto.slice(PREFIXO.length)
  return /^[A-Za-z0-9+/]+={0,2}$/.test(b64) ? b64 : null
}

// Corpo do generateContent: instrução fixa + a foto, nada mais. safetySettings omitido = padrão do Google.
// maxOutputTokens inclui o raciocínio (como no agent): 256 com thinkingLevel 'low' cabe o JSON;
// modelo que recusa o nível repete sem thinkingConfig (geminiModerar).
export function corpoGemini(b64: string) {
  return {
    systemInstruction: { parts: [{ text: INSTRUCAO }] },
    contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'image/jpeg', data: b64 } }] }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 256,
      thinkingConfig: { thinkingLevel: 'low' },
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          decisao: { type: 'string', enum: ['aprovar', 'recusar', 'revisar'] },
          motivos: { type: 'array', items: { type: 'string', enum: [...MOTIVOS_IA] } },
        },
        required: ['decisao', 'motivos'],
      },
    },
  }
}

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

// Interpreta a resposta (status 200) do Gemini. Fora do formato vira 'erro' inteiro, sem filtrar
// motivos: o schema já fecha a lista, então desvio indica resposta não confiável; o SQL devolve
// a foto à fila e, na 3ª falha, ao admin.
export function interpretar(data: any): Resultado {
  const u = data?.usageMetadata
  // raciocínio é cobrado como saída (mesma conta do agent)
  const tokens = { tokensIn: n(u?.promptTokenCount), tokensOut: n(u?.candidatesTokenCount) + n(u?.thoughtsTokenCount) }
  const cand = data?.candidates?.[0]
  if (data?.promptFeedback?.blockReason || BLOQUEIOS.includes(cand?.finishReason)) {
    return { decisao: 'recusada', motivos: ['bloqueio_seguranca'], ...tokens }
  }
  const erro: Resultado = { decisao: 'erro', motivos: [], ...tokens }
  const parts = Array.isArray(cand?.content?.parts) ? cand.content.parts : []
  const texto = parts.filter((p: any) => typeof p?.text === 'string' && !p.thought).map((p: any) => p.text).join('').trim()
  let r: any
  try {
    r = JSON.parse(texto)
  } catch {
    return erro
  }
  const decisao = DECISOES[r?.decisao]
  if (!decisao || !Array.isArray(r.motivos)) return erro
  if (!r.motivos.every((m: unknown) => (MOTIVOS_IA as readonly unknown[]).includes(m))) return erro
  return { decisao, motivos: [...new Set<string>(r.motivos)], ...tokens }
}

// ---------- orquestração (index.ts injeta Supabase, fetch e relógio) ----------

export type Deps = {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: any; error: { message: string } | null }>
  chaveEnv: string // GEMINI_API_KEY, fallback da chave do Vault
  fetch: typeof fetch
  agora?: () => number
}

// A Edge Function tem 150 s de parede (supabase.com/docs/guides/functions/limits). Paramos de
// pegar foto nova quando faltam 15 s + o timeout de uma chamada, para nenhuma ser cortada no meio.
export const LIMITE_MS = 150_000
export const FOLGA_MS = 15_000
export const TIMEOUT_MS = 20_000

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

// Comparação em tempo constante (cópia de chat-notify): compara os SHA-256 byte a byte.
export async function mesmoSegredo(a: string, b: string) {
  const hash = async (s: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))
  const [x, y] = await Promise.all([hash(a), hash(b)])
  let d = 0
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i]
  return d === 0
}

// Uma chamada ao Gemini com timeout; qualquer falha técnica vira 'erro' (sem lançar).
async function geminiModerar(deps: Deps, key: string, model: string, b64: string): Promise<Resultado> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
  const chamar = async (body: unknown) => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    try {
      const r = await deps.fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      })
      return { status: r.status, data: await r.json().catch(() => null) }
    } finally {
      clearTimeout(timer)
    }
  }
  try {
    const body = corpoGemini(b64)
    let r = await chamar(body)
    // Modelo que não aceita o nível de raciocínio: tenta uma vez sem thinkingConfig (como no agent)
    if (r.status === 400 && /thinking/i.test(JSON.stringify(r.data ?? ''))) {
      const { thinkingConfig: _, ...generationConfig } = body.generationConfig
      r = await chamar({ ...body, generationConfig })
    }
    if (r.status !== 200) {
      console.error(`[moderar-foto] Gemini respondeu ${r.status}`)
      const u = r.data?.usageMetadata
      return { decisao: 'erro', motivos: [], tokensIn: n(u?.promptTokenCount), tokensOut: n(u?.candidatesTokenCount) }
    }
    return interpretar(r.data)
  } catch {
    console.error('[moderar-foto] Gemini sem resposta (rede ou timeout)')
    return { decisao: 'erro', motivos: [], tokensIn: 0, tokensOut: 0 }
  }
}

export async function moderarLote(req: Request, deps: Deps): Promise<Response> {
  const agora = deps.agora ?? Date.now
  const fimParaComecar = agora() + LIMITE_MS - FOLGA_MS - TIMEOUT_MS
  if (req.method !== 'POST') return json(405, { ok: false })
  // Mesma ordem do chat-notify: sem cabeçalho nem consulta o banco; o segredo vem do Vault
  // (mesa_moderacao_secret, só service_role) e é comparado antes de qualquer outra chamada.
  const recebido = req.headers.get('x-moderacao-secret') ?? ''
  if (!recebido) return json(401, { ok: false })
  const { data: segredo, error: segredoError } = await deps.rpc('mesa_moderacao_secret')
  if (segredoError) {
    console.error('[moderar-foto] mesa_moderacao_secret falhou')
    return json(500, { ok: false })
  }
  if (typeof segredo !== 'string' || !segredo || !(await mesmoSegredo(recebido, segredo))) return json(401, { ok: false })

  // Sem chave não pega o lote: as fotos não ficam reservadas à toa
  const { data: chaveVault } = await deps.rpc('ai_get_gemini_key')
  const key = (typeof chaveVault === 'string' && chaveVault) || deps.chaveEnv
  if (!key) return json(503, { ok: false, motivo: 'sem_chave' })

  const { data: lote, error } = await deps.rpc('mesa_fotos_para_moderar_auto', { p_limite: 20 })
  if (error) {
    console.error('[moderar-foto] mesa_fotos_para_moderar_auto falhou')
    return json(500, { ok: false })
  }
  const fotos: Foto[] = Array.isArray(lote?.fotos) ? lote.fotos : []
  const modelo = typeof lote?.modelo === 'string' ? lote.modelo : ''
  const c = { processadas: 0, aprovadas: 0, recusadas: 0, revisar: 0, erros: 0 }
  if (!fotos.length) return json(200, { processadas: 0 })
  if (!modelo) {
    console.error('[moderar-foto] lote sem modelo')
    return json(500, { ok: false })
  }

  // Em sequência; as que sobrarem voltam à fila quando a reserva (5 min) vencer.
  for (const f of fotos) {
    if (agora() > fimParaComecar) break
    const b64 = base64Jpeg(f.foto)
    const r: Resultado = b64
      ? await geminiModerar(deps, key, modelo, b64)
      : { decisao: 'recusada', motivos: ['formato'], tokensIn: 0, tokensOut: 0 }
    try {
      const { data: ok, error: e } = await deps.rpc('mesa_foto_resultado_auto', {
        p_user: f.user, p_hash: f.hash, p_decisao: r.decisao, p_motivos: r.motivos,
        p_modelo: modelo, p_tokens_in: r.tokensIn, p_tokens_out: r.tokensOut,
      })
      if (e || ok !== true) console.error('[moderar-foto] mesa_foto_resultado_auto não gravou')
    } catch {
      console.error('[moderar-foto] mesa_foto_resultado_auto falhou')
    }
    c.processadas++
    if (r.decisao === 'aprovada') c.aprovadas++
    else if (r.decisao === 'recusada') c.recusadas++
    else if (r.decisao === 'revisar') c.revisar++
    else c.erros++
  }
  console.log('[moderar-foto]', JSON.stringify(c))
  return json(200, c)
}
