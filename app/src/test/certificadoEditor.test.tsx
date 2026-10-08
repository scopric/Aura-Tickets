import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import CertificateBuilder from '../pages/producer/CertificateBuilder'
import { camposPadrao } from '../lib/certificados'

vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
const banco = vi.hoisted(() => ({
  template: { current: null as unknown }, logo: { current: null as string | null }, toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }, upsert: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: banco.toast }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../hooks/useEvents', () => ({ useProducerEvents: () => ({ data: [{ id: 'e1', title: 'Festa Um', date: '2026-06-15', status: 'draft', ticket_types: [] }], isLoading: false, isError: false, isFetching: false, refetch: vi.fn() }) }))
vi.mock('../hooks/useProducerTools', () => ({
  useParticipantesCertificado: () => ({ data: { lista: [{ user_id: 'p1', nome: 'Carla Souza', checkin: true }], cortado: false }, isError: false }),
}))
vi.mock('../hooks/useLogoProdutor', () => ({ useLogoProdutor: () => ({ logo: { data: banco.logo.current, isPending: false } }) }))
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: banco.template.current ? { template: banco.template.current } : null, error: null }) }) }),
      upsert: (v: unknown) => { banco.upsert(v); return { select: () => Promise.resolve({ data: [{ id: 'c1' }], error: null }) } },
    }),
  },
}))

const montar = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={['/producer/certificado-editor?eventId=e1']}><CertificateBuilder /></MemoryRouter>
  </QueryClientProvider>,
)
const papel = () => screen.getByRole('button', { name: /^Campo Título\./ })
const esperarPronto = async () => { await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar modelo' })).toBeEnabled()) }

describe('editor de certificados', () => {
  beforeEach(() => { banco.template.current = null; banco.logo.current = null; vi.clearAllMocks(); vi.stubEnv('VITE_SUPABASE_URL', 'https://abc.supabase.co') })
  afterEach(() => vi.unstubAllEnvs())

  it('galeria: abre com todos os modelos em miniatura e "Usar este modelo" mantém o texto digitado', async () => {
    banco.template.current = { fields: camposPadrao().map(c => c.id === 'title' ? { ...c, value: 'Meu título' } : c) }
    montar(); await esperarPronto()
    await userEvent.click(screen.getByRole('button', { name: /Ver mais modelos/ }))
    const janela = await screen.findByRole('dialog', { name: 'Escolher modelo' })
    const botoes = within(janela).getAllByRole('button', { pressed: false }).filter(b => /Noturno|Oceano|Rosé|Grafite|Terra|Vibrante/.test(b.textContent ?? ''))
    expect(botoes).toHaveLength(6)
    // a miniatura é a mini-prévia do modelo: o texto do modelo aparece dentro dela
    expect(within(janela).getAllByText('Certificado de Participação').length).toBeGreaterThanOrEqual(12)
    await userEvent.click(within(janela).getByRole('button', { name: /Noturno dourado/ }))
    await userEvent.click(within(janela).getByRole('button', { name: 'Usar este modelo' }))
    expect(screen.queryByRole('dialog', { name: 'Escolher modelo' })).toBeNull()
    expect(screen.getByRole('heading', { name: /Modelo: Noturno dourado/ })).toBeInTheDocument()
    expect(screen.getByText('Meu título')).toBeInTheDocument() // texto já digitado ficou
  })

  it('depois de editar, trocar de modelo pede confirmação e pode ser desfeito', async () => {
    montar(); await esperarPronto()
    await userEvent.click(papel())
    fireEvent.keyDown(papel(), { key: 'ArrowRight' }) // edição
    await userEvent.click(screen.getByRole('button', { name: /Moderno minimalista/ }))
    const aviso = await screen.findByRole('alertdialog')
    expect(aviso).toHaveTextContent(/textos e as posições/)
    await userEvent.click(within(aviso).getByRole('button', { name: 'Trocar modelo' }))
    expect(screen.getByRole('heading', { name: /Modelo: Moderno minimalista/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }))
    expect(screen.getByRole('heading', { name: /Modelo: Clássico elegante/ })).toBeInTheDocument()
  })

  it('teclado move o campo (Shift anda mais) e desfazer/refazer voltam e avançam', async () => {
    montar(); await esperarPronto()
    await userEvent.click(screen.getByRole('button', { name: /^Campo Título\./ }))
    const x = () => (screen.getByLabelText('X (%)') as HTMLInputElement).value
    expect(x()).toBe('50')
    fireEvent.keyDown(papel(), { key: 'ArrowRight' })
    expect(x()).toBe('51')
    fireEvent.keyDown(papel(), { key: 'ArrowLeft', shiftKey: true })
    expect(x()).toBe('46')
    expect(screen.getByRole('button', { name: 'Refazer' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }))
    expect(x()).toBe('50') // setas seguidas no mesmo campo são um passo só
    await userEvent.click(screen.getByRole('button', { name: 'Refazer' }))
    expect(x()).toBe('46')
  })

  it('painel de propriedades: fonte só da lista, tamanho limitado, alinhamento e negrito', async () => {
    montar(); await esperarPronto()
    await userEvent.click(papel())
    const fonte = screen.getByLabelText('Fonte') as HTMLSelectElement
    expect([...fonte.options].map(o => o.textContent)).toEqual(['Padrão do modelo', 'Plus Jakarta Sans', 'Outfit', 'Archivo', 'Serifada (Georgia)'])
    await userEvent.selectOptions(fonte, 'serifa')
    expect(papel().style.fontFamily).toContain('Georgia')
    fireEvent.change(screen.getByLabelText(/Tamanho/), { target: { value: '5000' } })
    expect((screen.getByLabelText(/Tamanho/) as HTMLInputElement).value).toBe('96')
    await userEvent.click(screen.getByRole('radio', { name: 'Esquerda' }))
    expect(papel().style.textAlign).toBe('left')
    await userEvent.click(screen.getByRole('button', { name: /Negrito/ }))
    expect(papel().style.fontWeight).toBe('400')
  })

  it('QR é real (svg com o código) e a prévia usa o nome do participante escolhido', async () => {
    const { container } = montar(); await esperarPronto()
    expect(container.querySelector('svg[role="img"]')).not.toBeNull()
    const nome = () => screen.getByRole('button', { name: /^Campo Nome do participante\./ })
    expect(nome()).toHaveTextContent('Ana Beatriz Silva')
    await userEvent.selectOptions(screen.getByLabelText('Participante'), 'p1')
    expect(nome()).toHaveTextContent('Carla Souza')
  })

  it('logo do organizador: com logo, o botão usa; sem logo, a ajuda leva a Configurações', async () => {
    banco.logo.current = 'https://abc.supabase.co/storage/v1/object/public/logos-produtor/u1/a.png'
    const { unmount } = montar(); await esperarPronto()
    await userEvent.click(screen.getByRole('button', { name: 'Usar o logo do organizador' }))
    expect(document.querySelector('img[alt="Logo no certificado"]')?.getAttribute('src')).toBe('https://abc.supabase.co/storage/v1/object/public/logos-produtor/u1/a.png')
    unmount()
    banco.logo.current = 'https://outro-host.com/a.png'
    const outro = montar(); await esperarPronto()
    await userEvent.click(screen.getByRole('button', { name: 'Usar o logo do organizador' }))
    expect(banco.toast.error).toHaveBeenCalledWith(expect.stringContaining('endereço que não pode ser usado'))
    expect(document.querySelector('img[alt="Logo no certificado"]')).toBeNull()
    outro.unmount()
    banco.logo.current = null
    montar(); await esperarPronto()
    expect(screen.queryByRole('button', { name: 'Usar o logo do organizador' })).toBeNull()
    expect(screen.getByRole('link', { name: /Envie em Configurações/ })).toHaveAttribute('href', '/producer/settings')
  })

  it('template perigoso do banco é saneado: cor, fonte e imagem inválidas não chegam ao desenho', async () => {
    banco.template.current = {
      logoUrl: 'javascript:alert(1)', sigUrl: 'data:image/svg+xml;base64,PHN2Zz4=',
      fields: [{ id: 'title', type: 'text', label: 'Título', x: 50, y: 20, fontSize: 20, color: 'red;position:fixed', value: '<b onclick=alert(1)>Oi</b>', width: 80, fontFamily: 'Papyrus' }],
    }
    const { container } = montar(); await esperarPronto()
    expect(screen.getByText('<b onclick=alert(1)>Oi</b>')).toBeInTheDocument() // texto escapado, não vira elemento
    expect(container.querySelector('b')).toBeNull()
    expect(container.querySelector('img[alt="Logo no certificado"]')).toBeNull()
    expect(papel().style.position).not.toBe('fixed')
  })

  it('logo antigo que o saneamento recusa: avisa ao carregar e o Salvar não apaga em silêncio', async () => {
    banco.template.current = { fields: camposPadrao(), logoUrl: 'data:image/gif;base64,R0lGODlh' }
    montar(); await esperarPronto()
    expect(banco.toast.warning).toHaveBeenCalledWith('O logo salvo antes está num formato que não é mais aceito; envie de novo em PNG, JPG ou WebP.')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar modelo' }))
    await waitFor(() => expect(banco.upsert).toHaveBeenCalled())
    expect((banco.upsert.mock.calls[0][0] as { template: { logoUrl: unknown } }).template.logoUrl).toBe('data:image/gif;base64,R0lGODlh')
  })

  it('avisa que a validação pública ainda não existe', async () => {
    montar(); await esperarPronto()
    expect(screen.getByText(/validação pública ainda não existe: o QR e o código ainda não confirmam o certificado/)).toBeInTheDocument()
  })

  it('arquivo de logo fora de png/jpeg/webp ou acima de 1 MB é recusado', async () => {
    montar(); await esperarPronto()
    const input = document.getElementById('upload-logo-input') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' })] } })
    expect(banco.toast.error).toHaveBeenCalledWith('Use uma imagem PNG, JPG ou WebP.')
    fireEvent.change(input, { target: { files: [new File([new Uint8Array(1024 * 1024 + 1)], 'a.png', { type: 'image/png' })] } })
    expect(banco.toast.error).toHaveBeenCalledWith('A imagem deve ter no máximo 1 MB.')
  })

  it('salvar grava o template com os campos editados e a carga horária', async () => {
    montar(); await esperarPronto()
    await userEvent.type(screen.getByLabelText(/Carga horária/), '12')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar modelo' }))
    await waitFor(() => expect(banco.upsert).toHaveBeenCalled())
    const tpl = (banco.upsert.mock.calls[0][0] as { template: { horas: string; fields: unknown[]; selectedTemplate: string } }).template
    expect([tpl.horas, tpl.selectedTemplate, tpl.fields.length]).toEqual(['12', 'classic', camposPadrao().length])
  })

  describe('PDF pelo navegador', () => {
    let imprimir: ReturnType<typeof vi.fn>
    beforeEach(() => { imprimir = vi.fn(); window.print = imprimir })

    it('"Baixar PDF" monta o contêiner só-impressão e chama window.print; ao terminar, limpa tudo', async () => {
      montar(); await esperarPronto()
      expect(document.getElementById('cert-print')).toBeNull()
      await userEvent.click(screen.getByRole('button', { name: 'Baixar PDF' }))
      await waitFor(() => expect(imprimir).toHaveBeenCalledTimes(1))
      const area = document.getElementById('cert-print')!
      expect(area.classList.contains('cert-print')).toBe(true)
      expect(area.parentElement).toBe(document.body) // irmão do app: o CSS de impressão esconde os outros
      expect(area.querySelectorAll('.cert-folha')).toHaveLength(1)
      expect(document.body.classList.contains('imprimindo-cert')).toBe(true)
      expect(document.head.textContent).toContain('A4 landscape')
      window.dispatchEvent(new Event('afterprint'))
      await waitFor(() => expect(document.getElementById('cert-print')).toBeNull())
      expect(document.body.classList.contains('imprimindo-cert')).toBe(false)
    })
  })
})
