import { describe, it, expect } from 'vitest'
import { corsHeaders } from '../../../supabase/functions/_shared/cors'

const origem = (o?: string) =>
  corsHeaders(new Request('https://x.supabase.co/functions/v1/f', { headers: o ? { Origin: o } : {} }))['Access-Control-Allow-Origin']

describe('corsHeaders das Edge Functions', () => {
  it('origem da lista volta ela mesma', () => {
    for (const o of ['https://evokaa.com.br', 'https://www.evokaa.com.br', 'https://app.evokaa.com.br', 'https://alpha.evokaa.com.br'])
      expect(origem(o)).toBe(o)
  })

  it('localhost em qualquer porta e com subdomínio passa', () => {
    for (const o of ['http://localhost', 'http://localhost:5173', 'http://app.localhost:5173', 'http://alpha.localhost:4173'])
      expect(origem(o)).toBe(o)
  })

  it('origem estranha não volta: recebe a do site', () => {
    for (const o of ['https://evil.com', 'https://evokaa.com.br.evil.com', 'https://aura-tickets-pypy-x-outro.vercel.app',
      'https://aura-tickets-pypy-evil-scoprics-projects.vercel.app', 'https://aura-tickets-pypy.vercel.app',
      'http://localhost.evil.com', 'https://localhost:5173', 'null', undefined])
      expect(origem(o)).toBe('https://www.evokaa.com.br')
  })

  it('manda Vary: Origin e só os métodos usados', () => {
    const h = corsHeaders(new Request('https://x.supabase.co/'))
    expect(h.Vary).toBe('Origin')
    expect(h['Access-Control-Allow-Methods']).toBe('POST, OPTIONS')
  })
})
