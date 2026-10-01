import { describe, it, expect, vi } from 'vitest'
import { base64Jpeg, corpoGemini, interpretar, moderarLote, type Deps } from '../../../supabase/functions/_shared/moderacao'

const resposta = (obj: unknown, usage: unknown = { promptTokenCount: 560, candidatesTokenCount: 40 }) => ({
  candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] }, finishReason: 'STOP' }],
  usageMetadata: usage,
})

describe('interpretar', () => {
  it('aprovar, recusar com motivos e revisar', () => {
    expect(interpretar(resposta({ decisao: 'aprovar', motivos: [] }))).toEqual({ decisao: 'aprovada', motivos: [], tokensIn: 560, tokensOut: 40 })
    expect(interpretar(resposta({ decisao: 'recusar', motivos: ['nudez', 'texto_contato'] })).motivos).toEqual(['nudez', 'texto_contato'])
    expect(interpretar(resposta({ decisao: 'recusar', motivos: ['sem_rosto'] })).decisao).toBe('recusada')
    expect(interpretar(resposta({ decisao: 'revisar', motivos: ['famoso'] })).decisao).toBe('revisar')
  })

  it('bloqueios do Gemini viram recusada com bloqueio_seguranca', () => {
    const esperado = { decisao: 'recusada', motivos: ['bloqueio_seguranca'] }
    expect(interpretar({ promptFeedback: { blockReason: 'SAFETY' } })).toMatchObject(esperado)
    expect(interpretar({ candidates: [{ finishReason: 'SAFETY' }] })).toMatchObject(esperado)
    for (const f of ['PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'IMAGE_SAFETY']) {
      expect(interpretar({ candidates: [{ finishReason: f }] })).toMatchObject(esperado)
    }
  })

  it('JSON inválido, enum desconhecido e motivo fora da lista viram erro', () => {
    const quebrado = { candidates: [{ content: { parts: [{ text: '{"decisao":' }] } }] }
    expect(interpretar(quebrado).decisao).toBe('erro')
    expect(interpretar({}).decisao).toBe('erro')
    expect(interpretar(resposta({ decisao: 'talvez', motivos: [] })).decisao).toBe('erro')
    expect(interpretar(resposta({ decisao: 'recusar', motivos: ['nudez', 'feio'] })).decisao).toBe('erro')
    expect(interpretar(resposta({ decisao: 'recusar', motivos: ['bloqueio_seguranca'] })).decisao).toBe('erro')
    expect(interpretar(resposta({ decisao: 'aprovar' })).decisao).toBe('erro')
  })

  it('tokens ausentes contam 0; raciocínio soma na saída', () => {
    const r = interpretar(resposta({ decisao: 'aprovar', motivos: [] }, null))
    expect([r.tokensIn, r.tokensOut]).toEqual([0, 0])
    const t = interpretar(resposta({ decisao: 'aprovar', motivos: [] }, { promptTokenCount: 5, candidatesTokenCount: 3, thoughtsTokenCount: 7 }))
    expect([t.tokensIn, t.tokensOut]).toEqual([5, 10])
  })
})

describe('base64Jpeg e corpoGemini', () => {
  it('extrai o base64 do JPEG e recusa outro formato', () => {
    expect(base64Jpeg('data:image/jpeg;base64,/9j/AAA=')).toBe('/9j/AAA=')
    expect(base64Jpeg('data:image/png;base64,iVBOR')).toBeNull()
    expect(base64Jpeg('https://x/y.jpg')).toBeNull()
    expect(base64Jpeg('data:image/jpeg;base64,')).toBeNull()
    expect(base64Jpeg('data:image/jpeg;base64,abc def')).toBeNull()
  })

  it('corpo leva só a instrução fixa e a foto', () => {
    const c = corpoGemini('/9j/AAA=')
    expect(c.generationConfig.temperature).toBe(0)
    expect(c.generationConfig.responseMimeType).toBe('application/json')
    expect(c.generationConfig.responseSchema.properties.decisao.enum).toEqual(['aprovar', 'recusar', 'revisar'])
    expect(c.generationConfig.responseSchema.properties.motivos.items.enum).not.toContain('bloqueio_seguranca')
    expect(c.generationConfig.responseSchema.properties.motivos.items.enum).not.toContain('formato')
    expect(c.contents).toEqual([{ role: 'user', parts: [{ inlineData: { mimeType: 'image/jpeg', data: '/9j/AAA=' } }] }])
    expect(c).not.toHaveProperty('safetySettings')
    expect(Object.keys(c).sort()).toEqual(['contents', 'generationConfig', 'systemInstruction'])
  })
})

describe('moderarLote', () => {
  const FOTO = 'data:image/jpeg;base64,/9j/AAA='
  const pedido = (segredo?: string) =>
    new Request('http://x/moderar-foto', { method: 'POST', headers: segredo ? { 'x-moderacao-secret': segredo } : {} })
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })

  function montar(fotos: unknown[], fetchImpl: Deps['fetch'], segredo: unknown = 's3gredo') {
    const gravados: Record<string, unknown>[] = []
    const rpc = vi.fn(async (fn: string, args?: Record<string, unknown>) => {
      if (fn === 'mesa_moderacao_secret') return { data: segredo, error: null }
      if (fn === 'ai_get_gemini_key') return { data: 'chave', error: null }
      if (fn === 'mesa_fotos_para_moderar_auto') return { data: { modelo: 'gemini-x', fotos }, error: null }
      gravados.push(args ?? {})
      return { data: true, error: null }
    })
    const fetch = vi.fn(fetchImpl)
    return { deps: { chaveEnv: '', rpc, fetch } as Deps, rpc, fetch, gravados }
  }

  it('sem cabeçalho: 401 sem tocar no banco', async () => {
    const { deps, rpc } = montar([], async () => ok({}))
    expect((await moderarLote(pedido(), deps)).status).toBe(401)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('segredo do Vault vazio, nulo ou diferente: 401 sem nenhuma outra chamada', async () => {
    for (const [vault, enviado] of [['', 's3gredo'], [null, 's3gredo'], ['s3gredo', 'errado']] as const) {
      const { deps, rpc, fetch } = montar([], async () => ok({}), vault)
      expect((await moderarLote(pedido(enviado), deps)).status).toBe(401)
      expect(rpc.mock.calls.map(c => c[0])).toEqual(['mesa_moderacao_secret'])
      expect(fetch).not.toHaveBeenCalled()
    }
  })

  it('falha ao ler o segredo: 500 sem seguir', async () => {
    const { deps, rpc } = montar([], async () => ok({}))
    rpc.mockImplementation(async () => ({ data: null, error: { message: 'x' } }))
    expect((await moderarLote(pedido('s3gredo'), deps)).status).toBe(500)
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('lote vazio responde processadas 0 sem chamar o Gemini', async () => {
    const { deps, fetch } = montar([], async () => ok({}))
    const r = await moderarLote(pedido('s3gredo'), deps)
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ processadas: 0 })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('foto que falha não impede a próxima; contagens e gravação certas', async () => {
    let i = 0
    const respostas = [
      () => { throw new TypeError('rede') },
      () => new Response('{}', { status: 500 }),
      () => ok(resposta({ decisao: 'aprovar', motivos: [] })),
      () => ok({ candidates: [{ finishReason: 'IMAGE_SAFETY' }] }),
    ]
    const fotos = [1, 2, 3, 4].map(n => ({ user: `u${n}`, hash: `h${n}`, foto: FOTO }))
    fotos.push({ user: 'u5', hash: 'h5', foto: 'data:image/png;base64,AAA' })
    const { deps, gravados, fetch } = montar(fotos, async () => respostas[i++]())
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const r = await moderarLote(pedido('s3gredo'), deps)
    expect(await r.json()).toEqual({ processadas: 5, aprovadas: 1, recusadas: 2, revisar: 0, erros: 2 })
    expect(fetch).toHaveBeenCalledTimes(4)
    expect(gravados.map(g => [g.p_user, g.p_decisao, g.p_motivos])).toEqual([
      ['u1', 'erro', []], ['u2', 'erro', []], ['u3', 'aprovada', []],
      ['u4', 'recusada', ['bloqueio_seguranca']], ['u5', 'recusada', ['formato']],
    ])
    expect(gravados[2]).toMatchObject({ p_modelo: 'gemini-x', p_tokens_in: 560, p_tokens_out: 40, p_hash: 'h3' })
    // nada de id, hash ou foto no log
    const texto = JSON.stringify(log.mock.calls)
    expect(texto).not.toMatch(/u\d|h\d|AAA/)
    vi.restoreAllMocks()
  })

  it('para de pegar foto nova perto do limite de tempo', async () => {
    let t = 0
    const fotos = [1, 2, 3].map(n => ({ user: `u${n}`, hash: `h${n}`, foto: FOTO }))
    const { deps, fetch } = montar(fotos, async () => { t += 60_000; return ok(resposta({ decisao: 'aprovar', motivos: [] })) })
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const r = await moderarLote(pedido('s3gredo'), { ...deps, agora: () => t })
    // limite 150 s - folga 15 s - timeout 20 s = 115 s: começa em 0 e 60 s, não em 120 s
    expect((await r.json()).processadas).toBe(2)
    expect(fetch).toHaveBeenCalledTimes(2)
    vi.restoreAllMocks()
  })

  it('modelo que recusa thinkingConfig: repete uma vez sem ele', async () => {
    const corpos: { generationConfig: Record<string, unknown> }[] = []
    const { deps } = montar([{ user: 'u1', hash: 'h1', foto: FOTO }], async (_u, init) => {
      corpos.push(JSON.parse(String(init?.body)))
      return corpos.length === 1
        ? new Response(JSON.stringify({ error: { message: 'thinking level not supported' } }), { status: 400 })
        : ok(resposta({ decisao: 'aprovar', motivos: [] }))
    })
    vi.spyOn(console, 'log').mockImplementation(() => {})
    expect((await (await moderarLote(pedido('s3gredo'), deps)).json()).aprovadas).toBe(1)
    expect(corpos[0].generationConfig.thinkingConfig).toBeDefined()
    expect(corpos[1].generationConfig).not.toHaveProperty('thinkingConfig')
    vi.restoreAllMocks()
  })

  it('sem chave: 503 e não reserva o lote', async () => {
    const { deps, rpc } = montar([], async () => ok({}))
    rpc.mockImplementation(async (fn: string) => ({ data: fn === 'mesa_moderacao_secret' ? 's3gredo' : null, error: null }))
    expect((await moderarLote(pedido('s3gredo'), deps)).status).toBe(503)
    expect(rpc.mock.calls.map(c => c[0])).toEqual(['mesa_moderacao_secret', 'ai_get_gemini_key'])
  })
})
