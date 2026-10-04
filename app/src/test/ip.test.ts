import { describe, it, expect } from 'vitest'
import { clientIp } from '../../../supabase/functions/_shared/ip'

const ip = (h: Record<string, string>) => clientIp(new Headers(h))

describe('clientIp', () => {
  it('IPv4 simples e cadeia: o candidato é o último elemento', () => {
    expect(ip({ 'x-forwarded-for': '203.0.113.7' })).toEqual({ ip: '203.0.113.7', forwarded_for: '203.0.113.7' })
    expect(ip({ 'x-forwarded-for': '1.1.1.1, 10.0.0.1, 203.0.113.7' }).ip).toBe('203.0.113.7')
  })
  it('texto que não é IP não passa ("cafe", "dead", ":::::", 999.1.1.1)', () => {
    for (const lixo of ['cafe', 'dead', ':::::', '999.1.1.1']) {
      expect(ip({ 'x-forwarded-for': lixo })).toEqual({ ip: null, forwarded_for: null })
    }
  })
  it('forwarded_for guarda só os itens que são IP', () => {
    expect(ip({ 'x-forwarded-for': 'abc, 1.2.3.4, <script>, 5.6.7.8' })).toEqual({ ip: '5.6.7.8', forwarded_for: '1.2.3.4, 5.6.7.8' })
  })
  it('IPv6 e IPv6 mapeado passam', () => {
    expect(ip({ 'x-forwarded-for': '2001:db8::1' }).ip).toBe('2001:db8::1')
    expect(ip({ 'x-real-ip': '::ffff:1.2.3.4' }).ip).toBe('::ffff:1.2.3.4')
  })
  it('ordem de preferência: cf-connecting-ip, depois o fim do x-forwarded-for, depois x-real-ip', () => {
    expect(ip({ 'cf-connecting-ip': '8.8.8.8', 'x-forwarded-for': '1.1.1.1' }).ip).toBe('8.8.8.8')
    expect(ip({ 'x-forwarded-for': '1.1.1.1', 'x-real-ip': '9.9.9.9' }).ip).toBe('1.1.1.1')
    expect(ip({ 'x-real-ip': '9.9.9.9' }).ip).toBe('9.9.9.9')
    expect(ip({})).toEqual({ ip: null, forwarded_for: null })
  })
  it('cadeia longa: até 200 caracteres, sem cortar IP no meio, e termina no último', () => {
    const cadeia = Array.from({ length: 30 }, (_, i) => `10.0.0.${i + 100}`).join(', ')
    const { forwarded_for } = ip({ 'x-forwarded-for': cadeia })
    expect(forwarded_for!.length).toBeLessThanOrEqual(200)
    expect(forwarded_for!.endsWith('10.0.0.129')).toBe(true)
    expect(forwarded_for!.startsWith('10.0.0.')).toBe(true)
  })
})
