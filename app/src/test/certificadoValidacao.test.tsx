import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CertificadoValidacao from '../pages/CertificadoValidacao'
import { BASE_VALIDACAO, codigoValido, urlDoCertificado, validarCertificado } from '../lib/certificadoValidar'

const COD = '3f2a9c1e-5b7d-4e8a-9c3b-1a2b3c4d5e6f'
const rpc = vi.hoisted(() => vi.fn())
vi.mock('../lib/supabase', () => ({ supabase: { rpc: rpc } }))

const montar = (codigo: string) => render(
  <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter initialEntries={[`/certificado/${codigo}`]}><Routes><Route path="/certificado/:codigo" element={<CertificadoValidacao />} /></Routes></MemoryRouter>
  </QueryClientProvider>,
)
const VALIDO = { valido: true, nome: 'Ana Beatriz Silva', evento: 'Workshop de Design', data_evento: '2026-06-15', organizador: 'Produtora X', emitido_em: '2026-06-16', horas: '8' }

describe('lib: certificadoValidar', () => {
  beforeEach(() => rpc.mockReset())
  it('o QR leva ao domínio do app, com o código escapado', () => {
    expect(urlDoCertificado(COD)).toBe(`${BASE_VALIDACAO}/certificado/${COD}`)
    expect(urlDoCertificado('a b/c')).toBe(`${BASE_VALIDACAO}/certificado/a%20b%2Fc`)
  })
  it('só código no formato uuid vai ao banco', async () => {
    expect(codigoValido(COD)).toBe(true)
    for (const ruim of ['', 'abc', COD + 'x', `${COD}'; drop`, '../etc']) { expect(await validarCertificado(ruim)).toEqual({ valido: false }) }
    expect(rpc).not.toHaveBeenCalled()
  })
  it('devolve só os campos conhecidos e do tipo certo; resposta fora do formato vira inválido', async () => {
    rpc.mockResolvedValueOnce({ data: { ...VALIDO, email: 'x@y.z', cpf: '1', extra: 1 }, error: null })
    const r = await validarCertificado(COD)
    expect(r).toEqual(VALIDO) // sem email/cpf/extra
    rpc.mockResolvedValueOnce({ data: { valido: true, evento: '', data_evento: '2026-06-15', emitido_em: '2026-06-16' }, error: null })
    expect(await validarCertificado(COD)).toEqual({ valido: false })
    rpc.mockResolvedValueOnce({ data: { valido: true, evento: 'X', data_evento: 'ontem', emitido_em: '2026-06-16' }, error: null })
    expect(await validarCertificado(COD)).toEqual({ valido: false })
    rpc.mockResolvedValueOnce({ data: { valido: false }, error: null })
    expect(await validarCertificado(COD)).toEqual({ valido: false })
    rpc.mockResolvedValueOnce({ data: { ...VALIDO, horas: '<b>8</b>' }, error: null })
    expect(await validarCertificado(COD)).toMatchObject({ valido: true, horas: null })
  })
  it('erro do banco lança (a página mostra "não foi possível consultar", não "inválido")', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    await expect(validarCertificado(COD)).rejects.toBeTruthy()
  })
})

describe('página /certificado/<código>', () => {
  beforeEach(() => rpc.mockReset())
  afterEach(() => cleanup())

  it('válido: mostra os dados e a data por extenso, sem e-mail nem CPF', async () => {
    rpc.mockResolvedValue({ data: VALIDO, error: null })
    montar(COD)
    expect(await screen.findByRole('heading', { name: 'Certificado válido' })).toBeInTheDocument()
    expect(rpc).toHaveBeenCalledWith('certificado_validar', { p_code: COD })
    for (const t of ['Ana Beatriz Silva', 'Workshop de Design', 'Produtora X', '8 h', '15 de junho de 2026', '16 de junho de 2026']) expect(screen.getByText(t)).toBeInTheDocument()
    expect(screen.getByText(COD)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/@|cpf:/i)
  })
  it('inválido, revogado ou inexistente: a mesma mensagem, sem dizer qual', async () => {
    rpc.mockResolvedValue({ data: { valido: false }, error: null })
    montar(COD)
    expect(await screen.findByRole('heading', { name: 'Não encontramos este certificado' })).toBeInTheDocument()
    expect(screen.queryByText(/revogad/i)).toBeNull()
  })
  it('código fora do formato: não consulta o banco e mostra "não encontramos"', async () => {
    montar('lixo')
    expect(await screen.findByRole('heading', { name: 'Não encontramos este certificado' })).toBeInTheDocument()
    expect(rpc).not.toHaveBeenCalled()
  })
  it('erro de rede é diferente de inválido e deixa tentar de novo', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'rede' } })
    montar(COD)
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível consultar agora')
    expect(screen.queryByText('Certificado válido')).toBeNull()
    rpc.mockResolvedValueOnce({ data: VALIDO, error: null })
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('heading', { name: 'Certificado válido' })).toBeInTheDocument()
  })
  it('não é indexada por buscadores e a marca some ao sair', async () => {
    rpc.mockResolvedValue({ data: { valido: false }, error: null })
    const { unmount } = montar(COD)
    await waitFor(() => expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow'))
    unmount()
    expect(document.querySelector('meta[name="robots"]')).toBeNull()
  })
  it('nome vindo do banco com HTML sai como texto, não como marcação', async () => {
    rpc.mockResolvedValue({ data: { ...VALIDO, nome: '<img src=x onerror=alert(1)>' }, error: null })
    montar(COD)
    await screen.findByRole('heading', { name: 'Certificado válido' })
    expect(document.querySelector('img[src="x"]')).toBeNull()
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()
  })
})
