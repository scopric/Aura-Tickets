import { describe, it, expect } from 'vitest'
import { marcaOk, rotuloOk, hostOk, normalizaUrl, emailSemProibidos, mensagemCheck } from '../lib/organizadorTexto'

describe('organizadorTexto', () => {
  it('marca: recusa variações e aceita parecidos', () => {
    for (const t of ['Ev0kaa', 'E.v.o.k.a.a', 'Evokáa', 'Aura Tickets', 'ｅｖｏｋａａ', 'Laura Tickets']) expect(marcaOk(t), t).toBe(false)
    for (const t of ['Evoka Eventos', 'Festa da Vovó']) expect(marcaOk(t), t).toBe(true)
  })
  it('rótulo: palavras inteiras pix/pagamento', () => {
    for (const t of ['Pix oficial', 'PIX', 'Pagamento', 'Ev0kaa']) expect(rotuloOk(t), t).toBe(false)
    for (const t of ['Pixel Art', 'Pixabay', 'Pagamentos', 'Instagram']) expect(rotuloOk(t), t).toBe(true)
  })
  it('host e e-mail', () => {
    for (const u of ['https://xn--e1afmkfd.com', 'https://evokaa-suporte.com', 'https://pagamento.ev0kaa.io']) expect(hostOk(u), u).toBe(false)
    expect(hostOk('https://empresab.com.br/x')).toBe(true)
    for (const e of ['oi@x.com?a=1', 'a,b@x.com', 'a@x.com>', 'a;b@x.com']) expect(emailSemProibidos(e), e).toBe(false)
    expect(emailSemProibidos('oi@x.com.br')).toBe(true)
  })
  it('normalizaUrl', () => {
    expect(normalizaUrl('www.x.com.br')).toBe('https://www.x.com.br')
    expect(normalizaUrl('http://x.com')).toBe('https://x.com')
    expect(normalizaUrl('HTTP://x.com')).toBe('https://x.com')
    expect(normalizaUrl(' x.com ')).toBe('https://x.com')
    expect(normalizaUrl('   ')).toBe('')
    for (const u of ['javascript:alert(1)', 'ftp://x.com', 'data:text/html,x']) expect(normalizaUrl(u)).toBe(u)
  })
  it('mensagem pelo nome da constraint', () => {
    expect(mensagemCheck('violates check constraint "producer_public_nome_check"')).toMatch(/marca Evokaa/)
    expect(mensagemCheck('violates check constraint "producer_public_redes_check"')).toMatch(/Pix\/Pagamento/)
    expect(mensagemCheck('violates check constraint "producer_public_email_check"')).toMatch(/E-mail|e-mail/)
    expect(mensagemCheck('outra coisa')).toMatch(/formato inválido/)
    expect(mensagemCheck(undefined)).toMatch(/formato inválido/)
  })
})
