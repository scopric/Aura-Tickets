import { describe, it, expect } from 'vitest'
import { semSegredo, semHash } from '../lib/tracking'

const COD = '3f2a9c1e-5b7d-4e8a-9c3b-1a2b3c4d5e6f'
describe('o código do certificado não vai para nenhuma métrica', () => {
  it('caminho e URL trocam o código por :codigo; o resto fica igual', () => {
    expect(semSegredo(`/certificado/${COD}`)).toBe('/certificado/:codigo')
    expect(semSegredo(`https://app.evokaa.com.br/certificado/${COD}?utm_source=qr#x`)).toBe('https://app.evokaa.com.br/certificado/:codigo?utm_source=qr#x')
    expect(semSegredo('/certificado/lixo/extra')).toBe('/certificado/:codigo/extra')
    for (const igual of ['/', '/events', '/event/abc', '/certificados', '/producer/certificados', '/termos']) expect(semSegredo(igual)).toBe(igual)
  })
  it('Vercel Analytics: a URL sai sem o código e sem o hash', () => {
    const r = semHash({ type: 'pageview', url: `https://app.evokaa.com.br/certificado/${COD}#token=x`, route: null } as never) as { url: string }
    expect(r.url).toBe('https://app.evokaa.com.br/certificado/:codigo')
    expect(JSON.stringify(r)).not.toContain(COD)
  })
})
