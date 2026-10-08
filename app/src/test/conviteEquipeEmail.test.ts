import { describe, it, expect, vi } from 'vitest'

// _shared/email.ts lê Deno.env ao carregar: o teste simula o mínimo e importa depois
vi.stubGlobal('Deno', { env: { get: () => undefined } })
const { montarConviteEquipe } = await import('../../../supabase/functions/_shared/conviteEquipe')

const padrao = 'Um produtor da Evokaa'
const nomeNoAssunto = (n: string) => montarConviteEquipe(n, 'viewer', 'https://x').subject.replace(' convidou você para a equipe na Evokaa', '')

describe('e-mail do convite da equipe', () => {
  it('HTML e quebra de linha no nome ficam neutros: sem tag, sem quebra no assunto', () => {
    const { subject, html } = montarConviteEquipe('Ana <script>alert(1)</script>\r\nBcc: fulano', 'editor', 'https://app.evokaa.com.br')
    expect(html).not.toContain('<script>')
    expect(html).not.toMatch(/alert\(1\)/)
    expect(subject).not.toMatch(/[\r\n<>]/)
    expect(subject).toContain('convidou você')
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

  it('só letras latinas, espaço, hífen e apóstrofo sobrevivem', () => {
    expect(nomeNoAssunto('João Silva')).toBe('João Silva')
    expect(nomeNoAssunto('Dr. Ana')).toBe('Dr Ana')
    expect(nomeNoAssunto("D'Ávila-Souza")).toBe("D'Ávila-Souza")
    expect(nomeNoAssunto('ｅｖｏｋａａ ＳＵＰＯＲＴＥ')).toBe('evokaa SUPORTE') // fullwidth vira letra comum
    expect(nomeNoAssunto('ｅｖｏｋａａ．ｃｏｍ １２３ ＠')).toBe('evokaacom') // ponto, dígito e símbolo fullwidth saem
    expect(nomeNoAssunto('Jose\u0301 Lima')).toBe('Jos\u00e9 Lima') // acento decomposto vira acento inteiro
  })

  it.each(['golpe.com.', 'golpe。com', 'golpe[.]com', 'Pix 11 99999-9999', 'g0lpe.cοm', 'https://x.co', '12345'])('endereço, telefone e homóglifo não passam: %s', n => {
    const nome = nomeNoAssunto(n)
    expect(nome).not.toMatch(/[.\d\[\]/:。]/)
    expect(nome).not.toMatch(/[^\p{Script=Latin}\s'’-]/u)
  })

  it('sem nada aproveitável: texto padrão; nome longo é cortado em 60', () => {
    expect(nomeNoAssunto('')).toBe(padrao)
    expect(nomeNoAssunto('  1234 .com  ')).toBe('com')
    expect(nomeNoAssunto('99999 ...')).toBe(padrao)
    expect(nomeNoAssunto('a'.repeat(100))).toHaveLength(60)
  })
})
