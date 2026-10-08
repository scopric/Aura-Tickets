import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import Certificates from '../pages/producer/Certificates'
import { camposPadrao } from '../lib/certificados'

vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
const q = (data: unknown, extra: Record<string, unknown> = {}) => ({ data, isLoading: false, isError: false, isFetching: false, refetch: vi.fn(), ...extra })
const banco = vi.hoisted(() => ({
  eventos: { current: {} as Record<string, unknown> }, modelos: { current: {} as Record<string, unknown> }, parts: { current: {} as Record<string, unknown> },
  emitidos: { current: {} as Record<string, unknown> }, fator: vi.fn(), baixar: vi.fn(), emitir: vi.fn(), revogar: vi.fn(), toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))
vi.mock('sonner', () => ({ toast: banco.toast }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../hooks/useEvents', () => ({ useProducerEvents: () => banco.eventos.current }))
vi.mock('../lib/vendasPagas', () => ({ faltaSegundoFator: banco.fator }))
vi.mock('../lib/exportCsv', async orig => ({ ...(await orig<typeof import('../lib/exportCsv')>()), downloadCsv: banco.baixar }))
vi.mock('../hooks/useProducerTools', () => ({
  useEventCertificates: () => banco.modelos.current,
  useParticipantesCertificado: () => banco.parts.current,
  useCertificadosEmitidos: () => banco.emitidos.current,
  useEmitirCertificados: () => ({ mutateAsync: banco.emitir, isPending: false }),
  useRevogarCertificado: () => ({ mutateAsync: banco.revogar, isPending: false }),
}))

const evento = { id: 'e1', title: 'Festa Um', date: '2026-06-15', status: 'draft', ticket_types: [] }
const part = (id: string, nome: string, checkin: boolean) => ({ user_id: id, nome, checkin })
const emi = (id: string, user_id: string, code: string) => ({ id, user_id, issued_at: '2026-06-16T15:00:00Z', code })
const Local = () => <span data-testid="url">{useLocation().pathname + useLocation().search}</span>
const montar = (url = '/producer/certificados?eventId=e1') => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[url]}><Certificates /><Local /></MemoryRouter>
  </QueryClientProvider>,
)
const comDados = (emitidos = [emi('i1', 'p1', 'cod-ana')]) => {
  banco.eventos.current = q([evento])
  banco.modelos.current = q([{ id: 'c1', event_id: 'e1', template: { horas: '8', fields: camposPadrao() }, is_active: true }])
  banco.parts.current = q({ lista: [part('p1', 'Ana', true), part('p2', 'Bruno', true), part('p3', 'Carla', false)], cortado: false })
  banco.emitidos.current = q(emitidos)
}

describe('tela Certificados', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); banco.fator.mockResolvedValue(false); banco.emitir.mockResolvedValue([]); banco.revogar.mockResolvedValue(undefined) })

  it('cabeçalho do evento, KPIs (elegíveis, emitidos, pendentes) e Em breve com botões desativados', () => {
    comDados(); montar()
    expect(screen.getByRole('heading', { name: 'Festa Um' })).toBeInTheDocument()
    const kpi = (nome: string) => screen.getAllByText(nome).map(e => e.closest('[data-slot="card"]')).find(Boolean)!
    expect(kpi('Elegíveis (presentes)')).toHaveTextContent('2')
    expect(kpi('Emitidos')).toHaveTextContent('1')
    expect(kpi('Pendentes')).toHaveTextContent('1')
    for (const n of ['Ativar validação', 'Enviar certificados', 'Ver histórico de revogações', 'Calcular carga horária', 'Ativar emissão automática', 'Carregar todos'])
      expect(screen.getByRole('button', { name: n })).toBeDisabled()
    expect(screen.getAllByText('Em breve').length).toBeGreaterThanOrEqual(6)
  })

  it('emite em lote só para os pendentes', async () => {
    comDados(); vi.spyOn(window, 'confirm').mockReturnValue(true); montar()
    await userEvent.click(screen.getByRole('button', { name: 'Emitir para todos (1)' }))
    expect(banco.emitir).toHaveBeenCalledWith({ certificateId: 'c1', userIds: ['p2'] })
  })

  it('a aba Modelo leva ao editor do mesmo evento', async () => {
    comDados(); montar()
    await userEvent.click(screen.getByRole('tab', { name: /Modelo/ }))
    expect(screen.getByTestId('url')).toHaveTextContent('/producer/certificado-editor?eventId=e1')
  })

  it('aba Emitidos: lista com código, revogar avisa que APAGA e só então revoga', async () => {
    comDados(); montar('/producer/certificados?eventId=e1&aba=emitidos')
    const lista = screen.getByRole('list', { name: 'Certificados emitidos' })
    expect(within(lista).getByText('Ana')).toBeInTheDocument()
    expect(lista).toHaveTextContent('cod-ana')
    await userEvent.click(screen.getByRole('button', { name: 'Revogar o certificado de Ana' }))
    const dlg = await screen.findByRole('alertdialog')
    expect(dlg).toHaveTextContent(/APAGA o registro/)
    expect(dlg).toHaveTextContent(/não fica histórico/)
    expect(banco.revogar).not.toHaveBeenCalled()
    await userEvent.click(within(dlg).getByRole('button', { name: 'Revogar e apagar' }))
    expect(banco.revogar).toHaveBeenCalledWith({ id: 'i1', certificateId: 'c1' })
  })

  it('exporta CSV só com nome, código e data, e avisa de dado pessoal', async () => {
    comDados(); montar('/producer/certificados?eventId=e1&aba=emitidos')
    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }))
    const [arquivo, csv] = banco.baixar.mock.calls[0]
    expect(arquivo).toMatch(/^evokaa-certificados-festa-um-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(csv.replace('﻿', '').split('\r\n')).toEqual(['Nome;Código;Emitido em', 'Ana;cod-ana;16/06/2026'])
    expect(banco.toast.info).toHaveBeenCalledWith(expect.stringContaining('dado pessoal'))
  })

  it('evento que não é do produtor na URL é recusado e não lê nada', () => {
    comDados(); montar('/producer/certificados?eventId=alheio')
    expect(screen.getByText('Evento não encontrado entre os seus')).toBeInTheDocument()
    expect(screen.queryByText('Pendentes')).toBeNull()
  })

  it('estados: esqueleto, erro com nova tentativa, sem modelo, sem eventos e 2FA pendente', async () => {
    comDados(); banco.eventos.current = q(undefined, { isLoading: true }); const a = montar()
    expect(screen.getByLabelText('Carregando certificados')).toHaveAttribute('aria-busy', 'true')
    a.unmount()
    comDados(); banco.emitidos.current = q(undefined, { isError: true }); const b = montar()
    expect(screen.getByRole('alert')).toHaveTextContent(/Não foi possível carregar os certificados/)
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect((banco.emitidos.current.refetch as ReturnType<typeof vi.fn>)).toHaveBeenCalled()
    b.unmount()
    comDados(); banco.modelos.current = q([]); const c = montar()
    expect(screen.getByText('Este evento ainda não tem modelo de certificado')).toBeInTheDocument()
    c.unmount()
    banco.eventos.current = q([]); const d = montar('/producer/certificados')
    expect(screen.getByText('Você ainda não tem eventos')).toBeInTheDocument()
    d.unmount()
    comDados(); banco.parts.current = q({ lista: [], cortado: false }); banco.fator.mockResolvedValue(true); montar()
    expect(await screen.findByText(/Confirme o 2FA/)).toBeInTheDocument()
    expect(screen.queryByText('Ninguém com ingresso válido ainda')).toBeNull()
  })

  describe('PDF', () => {
    let imprimir: ReturnType<typeof vi.fn>
    beforeEach(() => { imprimir = vi.fn(); window.print = imprimir })
    afterEach(() => { document.body.classList.remove('imprimindo-cert') })

    it('um participante: uma folha com o nome e o código dele', async () => {
      comDados(); montar('/producer/certificados?eventId=e1&aba=emitidos')
      await userEvent.click(screen.getByRole('button', { name: 'Baixar PDF de Ana' }))
      await waitFor(() => expect(imprimir).toHaveBeenCalledTimes(1))
      const folhas = document.querySelectorAll('#cert-print .cert-folha')
      expect(folhas).toHaveLength(1)
      expect(folhas[0]).toHaveTextContent('Ana')
      expect(folhas[0]).toHaveTextContent('Código cod-ana')
      expect(folhas[0]).toHaveTextContent('Festa Um')
      expect(folhas[0]).toHaveTextContent('15 de junho de 2026')
      expect(folhas[0]).toHaveTextContent('carga horária de 8h')
    })

    it('em lote: uma folha por emitido; acima de 50 vira partes de 50', async () => {
      comDados(Array.from({ length: 120 }, (_, i) => emi(`i${i}`, `u${i}`, `cod-${i}`)))
      banco.parts.current = q({ lista: Array.from({ length: 120 }, (_, i) => part(`u${i}`, `Pessoa ${i}`, true)), cortado: false })
      montar('/producer/certificados?eventId=e1&aba=emitidos')
      expect(screen.getByText(/partes de até 50/)).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Baixar PDF: 101 a 120' }))
      await waitFor(() => expect(imprimir).toHaveBeenCalledTimes(1))
      expect(document.querySelectorAll('#cert-print .cert-folha')).toHaveLength(20)
      window.dispatchEvent(new Event('afterprint'))
      await waitFor(() => expect(document.getElementById('cert-print')).toBeNull())
      await userEvent.click(screen.getByRole('button', { name: 'Baixar PDF: 1 a 50' }))
      await waitFor(() => expect(imprimir).toHaveBeenCalledTimes(2))
      expect(document.querySelectorAll('#cert-print .cert-folha')).toHaveLength(50)
    }, 30000)

    it('sem afterprint (Safari do iPhone), imprimir de novo chama print de novo', async () => {
      comDados(); montar('/producer/certificados?eventId=e1&aba=emitidos')
      await userEvent.click(screen.getByRole('button', { name: 'Baixar PDF de Ana' }))
      await waitFor(() => expect(imprimir).toHaveBeenCalledTimes(1))
      await userEvent.click(screen.getByRole('button', { name: 'Baixar PDF de Ana' }))
      await waitFor(() => expect(imprimir).toHaveBeenCalledTimes(2))
      expect(document.querySelectorAll('#cert-print')).toHaveLength(1)
    })

    it('espera as imagens decodificarem antes de imprimir', async () => {
      const decode = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(HTMLImageElement.prototype, 'decode', { configurable: true, value: decode })
      comDados(); banco.modelos.current = q([{ id: 'c1', event_id: 'e1', template: { fields: camposPadrao(), logoUrl: 'data:image/png;base64,iVBORw0KGgo=' }, is_active: true }])
      montar('/producer/certificados?eventId=e1&aba=emitidos')
      await userEvent.click(screen.getByRole('button', { name: 'Baixar PDF de Ana' }))
      await waitFor(() => expect(imprimir).toHaveBeenCalled())
      expect(decode).toHaveBeenCalled()
      delete (HTMLImageElement.prototype as { decode?: unknown }).decode
    })

    it('quem não tem nome na lista fica fora do lote, não tem PDF individual e a tela diz quantos', async () => {
      comDados([emi('i1', 'p1', 'cod-ana'), emi('i9', 'sumiu', 'cod-x')]); montar('/producer/certificados?eventId=e1&aba=emitidos')
      expect(screen.getByRole('status')).toHaveTextContent('1 certificado ficou fora do PDF')
      expect(screen.getByRole('button', { name: 'Baixar PDF de Nome indisponível' })).toBeDisabled()
      await userEvent.click(screen.getByRole('button', { name: 'Baixar PDF de todos (1)' }))
      await waitFor(() => expect(imprimir).toHaveBeenCalled())
      expect(document.querySelectorAll('#cert-print .cert-folha')).toHaveLength(1)
    })
  })
})
