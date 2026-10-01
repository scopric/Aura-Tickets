import { describe, it, expect, vi, beforeEach } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MESA_TAGS, ESCOLARIDADE, FAIXAS_IDADE, REDE_SOCIAL_RE, normalizarRedeSocial, etiquetasEmComum } from '../lib/mesaTags'
import { MESA_TERM_VERSION } from '../lib/legal'
import { supabase } from '../lib/supabase'
import { useMyTable, useMesaConsentir, useMesaDenunciar, mesaErro } from '../hooks/useMatchmaking'

vi.mock('../lib/supabase', () => ({ supabase: { rpc: vi.fn() } }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))

// O SQL da mesa (PR #77) entra no repositório junto com este front. MESA_SQL aponta para outra cópia.
const SQL_PATH = process.env.MESA_SQL ?? resolve(__dirname, '../../../docs/sql/20261003_mesa_coletiva.sql')
const temSql = existsSync(SQL_PATH)

describe.skipIf(!temSql)('listas iguais às do SQL', () => {
  const sql = temSql ? readFileSync(SQL_PATH, 'utf8') : ''

  it('etiquetas: mesmas categorias e slugs de mesa_tags_ok', () => {
    const corpo = sql.slice(sql.indexOf('function public.mesa_tags_ok'), sql.indexOf(') l(cat, ok)'))
    const doSql = Object.fromEntries(
      [...corpo.matchAll(/\('(\w+)', array\[([^\]]+)\]\)/g)].map(m => [m[1], [...m[2].matchAll(/'(\w+)'/g)].map(x => x[1])])
    )
    const doFront = Object.fromEntries(Object.entries(MESA_TAGS).map(([c, v]) => [c, Object.keys(v.itens)]))
    expect(Object.keys(doSql)).toHaveLength(7)
    expect(doFront).toEqual(doSql)
  })

  it('escolaridade, faixas de idade, regex da rede social e versão do termo', () => {
    const edu = sql.match(/education in \(([^)]+)\)/)![1]
    expect(Object.keys(ESCOLARIDADE)).toEqual([...edu.matchAll(/'(\w+)'/g)].map(x => x[1]))

    const faixas = sql.slice(sql.indexOf("'faixa_idade'"), sql.indexOf("'foto', case when p_ok"))
    expect(Object.keys(FAIXAS_IDADE)).toEqual([...faixas.matchAll(/'(\d{2}(?:–\d{2}|\+))'/g)].map(x => x[1]))

    const re = sql.match(/social_url ~ '([^']+)'/)![1]
    expect(REDE_SOCIAL_RE.source.replace(/\\\//g, '/')).toBe(re)

    expect(sql).toContain(`as $$ select '${MESA_TERM_VERSION}' $$`)
  })
})

describe('normalizarRedeSocial (casos do teste T11 do SQL)', () => {
  it.each([
    ['instagram.com/ana', 'https://instagram.com/ana'],
    ['HTTPS://Instagram.COM/Ana.Souza', 'https://instagram.com/Ana.Souza'],
    ['http://tiktok.com/@ana', 'https://tiktok.com/@ana'],
    ['  www.linkedin.com/in/ana-souza_1 ', 'https://www.linkedin.com/in/ana-souza_1'],
    ['x.com/ana', 'https://x.com/ana'],
  ])('%s → %s', (entrada, saida) => {
    expect(normalizarRedeSocial(entrada)).toBe(saida)
  })

  it.each([
    'https://facebook.com/ana',
    'https://instagram.com.golpe.io/ana',
    'https://instagram.com/ana"onclick=x',
    'https://instagram.com/',
    'instagram.com/ana?utm=1',
    'javascript:alert(1)',
    '',
  ])('recusa %s', (entrada) => {
    expect(normalizarRedeSocial(entrada)).toBeNull()
  })
})

describe('etiquetasEmComum', () => {
  it('compara categoria e etiqueta (praia de passeios ≠ praia de viagem)', () => {
    const comuns = etiquetasEmComum(
      { musica: ['rock', 'pop'], passeios: ['praia'], idiomas: ['ingles'] },
      { musica: ['rock', 'funk'], viagem: ['praia'], idiomas: ['ingles'] },
    )
    expect([...comuns].sort()).toEqual(['idiomas:ingles', 'musica:rock'])
  })

  it('sem etiquetas (colega sem consentimento) não quebra', () => {
    expect(etiquetasEmComum({ musica: ['rock'] }, null).size).toBe(0)
    expect(etiquetasEmComum(undefined, { musica: ['rock'] }).size).toBe(0)
  })
})

describe('hooks da mesa (supabase.rpc simulado)', () => {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children)
  const rpc = vi.mocked(supabase.rpc) as unknown as ReturnType<typeof vi.fn>

  beforeEach(() => rpc.mockReset())

  it('useMyTable chama minha_mesa com o evento', async () => {
    const mesa = { forma_em: '2026-10-10T01:00:00+00:00', saiu: false, mesas: [] }
    rpc.mockResolvedValue({ data: mesa, error: null })
    const { result } = renderHook(() => useMyTable('ev1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(rpc).toHaveBeenCalledWith('minha_mesa', { p_event_id: 'ev1' })
    expect(result.current.data).toEqual(mesa)
  })

  it('useMesaConsentir manda a versão do termo; erro 22023 vira texto sem "Tinder"', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '22023', message: 'Mesa Tinder: 1 lugar por conta em cada evento' } })
    const { result } = renderHook(() => useMesaConsentir(), { wrapper })
    await expect(result.current.mutateAsync()).rejects.toThrow('No Match de Mesa é 1 lugar por conta em cada evento (quantidade 1).')
    expect(rpc).toHaveBeenCalledWith('mesa_consentir', { p_versao: MESA_TERM_VERSION })
  })

  it('useMesaDenunciar manda detalhe vazio como null e devolve ja_denunciado', async () => {
    rpc.mockResolvedValue({ data: { ja_denunciado: true }, error: null })
    const { result } = renderHook(() => useMesaDenunciar(), { wrapper })
    await expect(result.current.mutateAsync({ membro: 'm1', motivo: 'perfil_falso', detalhe: '  ' })).resolves.toEqual({ ja_denunciado: true })
    expect(rpc).toHaveBeenCalledWith('mesa_denunciar', { p_membro: 'm1', p_motivo: 'perfil_falso', p_detalhe: null })
  })

  it('mesaErro: idade, 2FA e texto técnico', () => {
    expect(mesaErro({ code: '22023', message: 'Mesa coletiva: informe sua data de nascimento (só maiores de 18)' })).toMatch(/maiores de 18/)
    expect(mesaErro({ code: '42501', message: 'Acesso negado' })).toMatch(/duas etapas/)
    expect(mesaErro({ code: 'XX000', message: 'permission denied for table x' })).not.toMatch(/permission/)
  })
})
