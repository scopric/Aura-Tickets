import { describe, it, expect, vi } from 'vitest'

// _shared/email.ts lê Deno.env ao carregar: o teste simula o mínimo e importa depois
vi.stubGlobal('Deno', { env: { get: () => undefined } })
const { montarConviteEquipe } = await import('../../../supabase/functions/_shared/conviteEquipe')

const padrao = 'Um produtor da Evokaa'
const nomeNoAssunto = (n: string) => montarConviteEquipe(n, 'viewer', 'https://x').subject.replace('Convite para a equipe de ', '').replace(' na Evokaa', '')

describe('e-mail do convite da equipe', () => {
  it('HTML e quebra de linha no nome ficam neutros: sem tag, sem quebra no assunto', () => {
    const { subject, html } = montarConviteEquipe('Ana <script>alert(1)</script>\r\nBcc: fulano', 'editor', 'https://app.evokaa.com.br')
    expect(html).not.toContain('<script>')
    expect(html).not.toMatch(/alert\(1\)/)
    expect(subject).not.toMatch(/[\r\n<>]/)
    expect(subject).toMatch(/^Convite para a equipe de .+ na Evokaa$/)
  })

  it('cargo em português, link do app e aviso de 2FA', () => {
    const t = (r: string) => montarConviteEquipe('Ana', r, 'https://app.evokaa.com.br').html
    expect(t('admin')).toContain('Administrador')
    expect(t('editor')).toContain('Editor')
    expect(t('viewer')).toContain('Visualizador')
    expect(t('viewer')).toContain('href="https://app.evokaa.com.br/equipe"')
    expect(t('viewer')).toContain('duas etapas')
    expect(t('viewer')).toContain('não expira')
  })

  it('texto novo: equipe de {nome} como {cargo}, sem "portaria"', () => {
    const { html } = montarConviteEquipe('Studio 54 Eventos', 'admin', 'https://x')
    expect(html).toContain('Você foi convidado para a equipe de <strong>Studio 54 Eventos</strong> como <strong>Administrador</strong>.')
    expect(html).not.toMatch(/portaria/i)
  })

  it('nome de empresa legítimo passa; só letras latinas, dígitos, &, espaço, hífen e apóstrofo sobrevivem', () => {
    expect(nomeNoAssunto('Studio 54 Eventos')).toBe('Studio 54 Eventos')
    expect(nomeNoAssunto('Bora & Dançar')).toBe('Bora & Dançar')
    expect(nomeNoAssunto('Bar 1900')).toBe('Bar 1900')
    expect(nomeNoAssunto('evokaa 24h')).toBe('evokaa 24h')
    expect(nomeNoAssunto('- -')).toBe('Um produtor da Evokaa')
    expect(nomeNoAssunto('João Silva')).toBe('João Silva')
    expect(nomeNoAssunto('Dr. Ana')).toBe('Dr Ana')
    expect(nomeNoAssunto("D'Ávila-Souza")).toBe("D'Ávila-Souza")
    expect(nomeNoAssunto('ｅｖｏｋａａ ＳＵＰＯＲＴＥ')).toBe('evokaa SUPORTE') // fullwidth vira letra comum
    expect(nomeNoAssunto('ｅｖｏｋａａ．ｃｏｍ １２３ ＠')).toBe('evokaacom 123') // ponto e símbolo fullwidth saem; dígito curto fica
    expect(nomeNoAssunto('José Lima')).toBe('José Lima') // acento decomposto vira acento inteiro
  })

  it.each(['golpe.com.', 'golpe。com', 'golpe[.]com', '11 99999-9999', 'Pix 11999999999', 'g0lpe.cοm', 'https://x.co/a', '12345', 'Tel 99999 9999', '11 9999 9999', 'WhatsApp 1199 9999 999', 'Pix 11-9999-9999', '0800 123 4567', 'Ligue 11 9 9999 9999', '1 2 3 4 5 6 7 8 9 0 1'])('telefone, endereço e homóglifo não passam: %s', n => {
    const nome = nomeNoAssunto(n)
    expect(nome).not.toMatch(/[.\[\]/:。]/)
    expect((nome.match(/\d/g) ?? []).length).toBeLessThanOrEqual(4)
    expect(nome).not.toMatch(/[^\p{Script=Latin}\d&\s'’-]/u)
  })

  it('sem nada aproveitável: texto padrão; nome longo é cortado em 60', () => {
    expect(nomeNoAssunto('')).toBe(padrao)
    expect(nomeNoAssunto('  .com  ')).toBe('com')
    expect(nomeNoAssunto('99999 ...')).toBe(padrao)
    expect(nomeNoAssunto('a'.repeat(100))).toHaveLength(60)
  })
})
