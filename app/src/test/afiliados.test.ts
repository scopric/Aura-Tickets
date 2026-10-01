import { describe, it, expect } from 'vitest'
import { mensagemVinculo } from '../lib/afiliados'

// Códigos que a vincular_afiliado devolve (docs/sql/20261005_produtor_acesso.sql). Se o banco ganhar um código
// novo, ele entra aqui e na lib/afiliados.ts; código sem mensagem própria cairia no texto genérico e o teste falha.
const CODIGOS = ['ok', 'ja_vinculado', 'nao_encontrado', 'proprio', 'sem_permissao', 'conta_recente',
  'email_invalido', 'comissao_invalida', 'limite']

describe('mensagemVinculo', () => {
  const generica = mensagemVinculo('codigo_que_nao_existe')

  it('todo código do banco tem mensagem própria', () => {
    for (const c of CODIGOS) expect(mensagemVinculo(c), c).not.toBe(generica)
    expect(new Set(CODIGOS.map(c => mensagemVinculo(c))).size).toBe(CODIGOS.length)
  })

  it('textos combinados com o Ricardo', () => {
    expect(mensagemVinculo('ok')).toBe('Afiliado vinculado.')
    expect(mensagemVinculo('nao_encontrado')).toBe('Não encontramos uma conta que possa ser afiliada com esse e-mail. A pessoa precisa ter conta na Evokaa, ser maior de 18 anos e ter a data de nascimento no perfil.')
    expect(mensagemVinculo('conta_recente')).toBe('Por segurança, contas de produtor com menos de 24 horas ainda não vinculam afiliados.')
    expect(mensagemVinculo('limite')).toBe('Muitas tentativas. Tente de novo mais tarde.')
  })

  it('42501 pede o código do 2FA; outro erro e retorno estranho viram texto genérico', () => {
    expect(mensagemVinculo(null, { code: '42501' })).toMatch(/2FA/)
    expect(mensagemVinculo(null, { code: '500' })).toBe(generica)
    expect(mensagemVinculo(undefined)).toBe(generica)
    expect(mensagemVinculo('toString')).toBe(generica)
  })
})
