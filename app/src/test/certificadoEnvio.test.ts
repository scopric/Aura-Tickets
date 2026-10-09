import { describe, it, expect } from 'vitest'
import { decidirLimite, horasValidas, semEmail, uuidValido, LIMITE_POR_CERTIFICADO_POR_DIA, LIMITE_POR_CERTIFICADO_POR_HORA, LIMITE_POR_PRODUTOR_POR_HORA } from '../../../supabase/functions/_shared/certificadoEnvio'

describe('envio do certificado por e-mail: regras', () => {
  it('limite por certificado: a 1ª tentativa passa (a contagem inclui a própria reserva), a 2ª na mesma hora não', () => {
    expect(decidirLimite(1, 1)).toBeNull()
    expect(decidirLimite(LIMITE_POR_CERTIFICADO_POR_HORA + 1, 1)).toMatchObject({ status: 429, erro: expect.stringContaining('já foi enviado na última hora') })
  })
  it('limite por produtor: 30 por hora em todos os certificados', () => {
    expect(decidirLimite(1, LIMITE_POR_PRODUTOR_POR_HORA)).toBeNull()
    expect(decidirLimite(1, LIMITE_POR_PRODUTOR_POR_HORA + 1)).toMatchObject({ status: 429, erro: expect.stringContaining('Limite de 30') })
  })
  it('o limite do certificado vale antes do do produtor', () => {
    expect(decidirLimite(2, 99)?.erro).toContain('já foi enviado')
  })
  it('só uuid vai ao banco', () => {
    expect(uuidValido('3f2a9c1e-5b7d-4e8a-9c3b-1a2b3c4d5e6f')).toBe(true)
    for (const ruim of ['', 'x', 123, null, "3f2a9c1e-5b7d-4e8a-9c3b-1a2b3c4d5e6f'; drop", '../x']) expect(uuidValido(ruim)).toBe(false)
  })
  it('carga horária só com 1 a 4 dígitos', () => {
    expect(horasValidas('8')).toBe('8')
    for (const ruim of ['', 'abc', '12345', '<b>8</b>', 8, null, undefined, '-1']) expect(horasValidas(ruim)).toBeNull()
  })
  it('limite por dia: 3 envios do mesmo certificado em 24 h', () => {
    expect(decidirLimite(1, 1, LIMITE_POR_CERTIFICADO_POR_DIA)).toBeNull()
    expect(decidirLimite(1, 1, LIMITE_POR_CERTIFICADO_POR_DIA + 1)).toMatchObject({ status: 429, erro: expect.stringContaining('3 vezes hoje') })
  })
  it('mensagem de erro de terceiros sai sem endereço de e-mail', () => {
    expect(semEmail('The to address ana.silva+x@gmail.com is invalid')).toBe('The to address [e-mail] is invalid')
    expect(semEmail('Invalid "to" field: <bob@x.com.br>, tente de novo')).toBe('Invalid "to" field: <[e-mail]>, tente de novo')
    expect(semEmail('sem endereço aqui')).toBe('sem endereço aqui')
  })
})
