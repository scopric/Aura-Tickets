import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import ProducerLayout from '../components/ProducerLayout'
import { ThemeProvider } from '../contexts/ThemeContext'
import { toast } from 'sonner'
import { siteUrl } from '../lib/appHost'
import { refDoEvento } from '../lib/eventoProdutor'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
// Só os eventos do produtor chegam pelo hook (o filtro por producer_id é do hook); a busca não pode listar nada além deles
const evento = (id: string, title: string) => ({ id, title, date: '2026-12-10', time: '20:00', start_date: '2026-12-10T20:00:00-03:00', end_date: null, status: 'published', approval_status: 'approved', cover_image: null })
const doProdutor = [evento('e1', 'Noite de Forró'), evento('e2', 'Baile da Virada')]
let eventosAtuais: unknown[] = doProdutor // cada teste pode trocar a lista; o beforeEach volta ao padrão
vi.mock('../hooks/useEvents', () => ({ useProducerEvents: () => ({ data: eventosAtuais, isLoading: false }) }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { name: 'Ricardo', email: 'r@x.com' }, logout: vi.fn() }) }))
vi.mock('../hooks/useTourLog', () => ({ useRegistrarTour: () => vi.fn() }))
vi.mock('../components/ThemeToggle', () => ({ default: () => null }))
vi.mock('../components/EvoHub', () => ({ default: () => null }))
vi.mock('../components/FeedbackTopButton', () => ({ default: () => null }))
vi.mock('../components/NotificationsTopButton', () => ({ default: () => null }))
vi.mock('../components/producer/BarraCelular', () => ({ default: () => null }))
vi.stubGlobal('matchMedia', (q: string) => ({ matches: !q.includes('max-width'), addEventListener: () => {}, removeEventListener: () => {} }))
// cmdk usa estes dois, que o jsdom não tem
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
Element.prototype.scrollIntoView = () => {}

const Onde = () => <p data-testid="onde">{useLocation().pathname}</p>
const montar = (url = '/producer/dashboard') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <ThemeProvider>
        <Routes>
          <Route element={<><ProducerLayout /><Onde /></>}>
            <Route path="*" element={<h1>Tela</h1>} />
          </Route>
        </Routes>
      </ThemeProvider>
    </MemoryRouter>,
  )
const abrir = async () => {
  fireEvent.keyDown(window, { key: 'k', metaKey: true })
  return screen.findByRole('dialog', { name: 'Buscar telas, eventos e ações' })
}

const UA_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
const comUA = (ua: string) => vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua)
beforeEach(() => { localStorage.clear(); comUA(UA_MAC); eventosAtuais = doProdutor })
afterEach(() => vi.restoreAllMocks())

describe('busca rápida ⌘K (V4c)', () => {
  it('⌘K abre, lista telas, só os eventos do produtor e a ação Criar evento; Esc fecha', async () => {
    montar()
    expect(screen.queryByRole('dialog')).toBeNull()
    const dialogo = await abrir()
    expect(within(dialogo).getByRole('group', { name: 'Telas' })).toBeInTheDocument()
    const eventos = within(dialogo).getByRole('group', { name: 'Eventos' })
    expect(within(eventos).getAllByRole('option').map(o => o.textContent)).toEqual(['Noite de Forró10 dez', 'Baile da Virada10 dez'])
    expect(within(dialogo).getByRole('option', { name: 'Criar evento' })).toBeInTheDocument()
    expect(within(dialogo).queryByRole('option', { name: /Tema:/ })).toBeNull() // tema só quando se digita "tema"
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('fora do Mac vale Ctrl+K (e o rótulo da lateral diz "Ctrl K"); no Mac, Ctrl+K não é capturado', async () => {
    montar()
    expect(screen.getByRole('button', { name: /^Buscar telas, eventos e ações \(⌘K\)/ })).toHaveTextContent('⌘K')
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    await new Promise(r => setTimeout(r, 50))
    expect(screen.queryByRole('dialog')).toBeNull()
    cleanup()
    comUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
    montar()
    expect(screen.getByRole('button', { name: /^Buscar telas, eventos e ações \(Ctrl K\)/ })).toHaveTextContent('Ctrl K')
    fireEvent.keyDown(window, { key: 'K', ctrlKey: true })
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('⌘K com a tecla segurada (repeat) não abre nem alterna', async () => {
    montar()
    fireEvent.keyDown(window, { key: 'k', metaKey: true, repeat: true })
    await new Promise(r => setTimeout(r, 50))
    expect(screen.queryByRole('dialog')).toBeNull()
    await abrir()
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'k', metaKey: true, repeat: true })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'k', metaKey: true })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('tecla segurada (⌘K e ⌘B) recebe preventDefault: não vaza para o navegador', () => {
    montar()
    // fireEvent devolve false quando o evento foi cancelado
    expect(fireEvent.keyDown(window, { key: 'k', metaKey: true, repeat: true })).toBe(false)
    expect(fireEvent.keyDown(window, { key: 'b', metaKey: true, repeat: true })).toBe(false)
    expect(fireEvent.keyDown(window, { key: 'j', metaKey: true, repeat: true })).toBe(true) // outra tecla segue livre
  })

  it('keydown sem key (autopreenchimento do navegador) não lança erro', () => {
    montar()
    const e = new KeyboardEvent('keydown', { metaKey: true, bubbles: true, cancelable: true })
    Object.defineProperty(e, 'key', { value: undefined })
    expect(() => window.dispatchEvent(e)).not.toThrow()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('sem consulta mostra 5 telas; com consulta, até 8; no evento a seção das telas se chama "Evento"', async () => {
    montar()
    const dialogo = await abrir()
    expect(within(within(dialogo).getByRole('group', { name: 'Telas' })).getAllByRole('option')).toHaveLength(5)
    await userEvent.setup().keyboard('e')
    expect(within(within(dialogo).getByRole('group', { name: 'Telas' })).getAllByRole('option')).toHaveLength(8)
    cleanup()
    montar('/producer/event/e1')
    const noEvento = await abrir()
    expect(within(noEvento).getByRole('option', { name: 'Visão geral Evento' })).toBeInTheDocument()
  })

  it('⌘K não abre por cima de diálogo modal nem de alertdialog; popover não bloqueia e fecha sem perder o foco', async () => {
    montar()
    const alerta = document.body.appendChild(Object.assign(document.createElement('div'), { role: 'alertdialog' }))
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    await new Promise(r => setTimeout(r, 50))
    expect(screen.queryByRole('dialog', { name: 'Buscar telas, eventos e ações' })).toBeNull()
    alerta.remove()
    const modal = document.body.appendChild(Object.assign(document.createElement('div'), { role: 'dialog' })) // o Radix não põe aria-modal
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    await new Promise(r => setTimeout(r, 50))
    expect(screen.queryByRole('dialog', { name: 'Buscar telas, eventos e ações' })).toBeNull()
    modal.remove()
    const menu = document.body.appendChild(Object.assign(document.createElement('div'), { role: 'menu' })) // DropdownMenu aberto (modal no Radix)
    menu.setAttribute('data-radix-menu-content', '')
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    await new Promise(r => setTimeout(r, 50))
    expect(screen.queryByRole('dialog', { name: 'Buscar telas, eventos e ações' })).toBeNull()
    menu.remove()

    const user = userEvent.setup()
    const produtora = screen.getByRole('button', { name: /^Produtora .*trocar ou abrir equipe/ })
    await user.click(produtora)
    await screen.findByRole('link', { name: 'Equipe' }) // popover aberto
    await abrir()
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Equipe' })).toBeNull())
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).not.toBe(document.body))
    expect(produtora).toHaveFocus()
  })

  it('acha pela seção e, no evento, também as telas de Conta (sem o evento na URL)', async () => {
    montar()
    await abrir()
    const user = userEvent.setup()
    await user.keyboard('financeiro')
    expect(screen.getAllByRole('option').map(o => o.textContent)).toContain('ResumoFinanceiro')
    cleanup()

    montar('/producer/event/e1')
    await abrir()
    await userEvent.setup().keyboard('configuracoes')
    await userEvent.setup().click(screen.getByRole('option', { name: /Configurações/ }))
    expect(screen.getByTestId('onde')).toHaveTextContent('/producer/settings')
  })

  it('filtra sem acento, Enter abre o evento escolhido e o botão da lateral recebe o foco de volta no Esc', async () => {
    montar()
    const botao = screen.getByRole('button', { name: /^Buscar telas, eventos e ações/ })
    botao.focus()
    fireEvent.click(botao)
    await screen.findByRole('dialog')
    const user = userEvent.setup()
    await user.keyboard('forro')
    expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual(['Noite de Forró10 dez'])
    await user.keyboard('{Enter}')
    expect(screen.getByTestId('onde')).toHaveTextContent('/producer/event/e1')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    botao.focus()
    fireEvent.click(botao)
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(botao).toHaveFocus())
  })

  it('"tema" traz Automático, Claro e Escuro e a escolha grava o tema', async () => {
    montar()
    await abrir()
    const user = userEvent.setup()
    await user.keyboard('tema')
    expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual(['Tema: automáticoatual', 'Tema: claro', 'Tema: escuro']) // o padrão do produtor é automático
    await user.click(screen.getByRole('option', { name: 'Tema: escuro' }))
    expect(localStorage.getItem('evokaa-theme')).toBe('dark')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('tablet: Esc com a busca aberta fecha só a busca; o Esc seguinte fecha a gaveta', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }))
    try {
      montar()
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Abrir menu' }))
      expect(screen.getByRole('button', { name: 'Fechar menu' })).toBeInTheDocument()
      await abrir()
      await user.keyboard('{Escape}')
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(screen.getByRole('button', { name: 'Fechar menu' })).toBeInTheDocument()
      await user.keyboard('{Escape}')
      expect(screen.getByRole('button', { name: 'Abrir menu' })).toBeInTheDocument()
    } finally {
      vi.stubGlobal('matchMedia', (q: string) => ({ matches: !q.includes('max-width'), addEventListener: () => {}, removeEventListener: () => {} }))
    }
  })
})

describe('⌘K v2: prefixos, ações reais e recentes', () => {
  it('"@" lista só eventos; "@baile" filtra; "/" só telas; ">" só ações (com tema); a dica aparece', async () => {
    montar()
    const dialogo = await abrir()
    expect(within(dialogo).getByText((_, el) => el?.tagName === 'P' && /Dica:.*@.*eventos.*\/.*telas.*>.*ações/.test(el.textContent ?? ''))).toBeInTheDocument()
    const user = userEvent.setup()
    await user.keyboard('@')
    expect(within(dialogo).queryByRole('group', { name: 'Telas' })).toBeNull()
    expect(within(within(dialogo).getByRole('group', { name: 'Eventos' })).getAllByRole('option')).toHaveLength(2)
    await user.keyboard('baile')
    expect(within(within(dialogo).getByRole('group', { name: 'Eventos' })).getAllByRole('option').map(o => o.textContent)).toEqual(['Baile da Virada10 dez'])
    await user.clear(screen.getByRole('combobox')); await user.keyboard('/')
    expect(within(dialogo).queryByRole('group', { name: 'Eventos' })).toBeNull()
    expect(within(dialogo).getByRole('group', { name: 'Telas' })).toBeInTheDocument()
    await user.clear(screen.getByRole('combobox')); await user.keyboard('>')
    expect(within(dialogo).queryByRole('group', { name: 'Telas' })).toBeNull()
    expect(within(dialogo).getByRole('option', { name: 'Criar evento' })).toBeInTheDocument()
    expect(within(dialogo).getByRole('option', { name: /Tema: escuro/ })).toBeInTheDocument() // ">" sozinho lista as ações, tema incluído
  })

  it('num evento publicado: "Copiar link do evento" copia o link público e avisa; fora de evento a ação não existe', async () => {
    const copiar = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup() // o setup instala um clipboard próprio; o espião vem depois
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: copiar }, configurable: true })
    montar('/producer/dashboard')
    const fora = await abrir()
    expect(within(fora).queryByRole('option', { name: 'Copiar link do evento' })).toBeNull()
    cleanup()
    montar('/producer/event/e1')
    const dialogo = await abrir()
    await user.click(within(dialogo).getByRole('option', { name: 'Copiar link do evento' }))
    expect(copiar).toHaveBeenCalledWith(siteUrl(`/event/${refDoEvento(doProdutor[0])}`))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Link do evento copiado.'))
  })

  it('"Abrir página pública do evento" abre em nova aba sem vazar o opener', async () => {
    const abrirJanela = vi.spyOn(window, 'open').mockReturnValue(null)
    montar('/producer/event/e2')
    const dialogo = await abrir()
    await userEvent.setup().click(within(dialogo).getByRole('option', { name: 'Abrir página pública do evento' }))
    expect(abrirJanela).toHaveBeenCalledWith(siteUrl(`/event/${refDoEvento(doProdutor[1])}`), '_blank', 'noopener,noreferrer')
  })

  it('recentes: só sem texto, até 3, o escolhido sobe, e evento removido some', async () => {
    montar()
    let dialogo = await abrir()
    const user = userEvent.setup()
    expect(within(dialogo).queryByRole('group', { name: 'Recentes' })).toBeNull() // nada ainda
    await user.click(within(within(dialogo).getByRole('group', { name: 'Eventos' })).getByRole('option', { name: /Baile da Virada/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    dialogo = await abrir()
    const recentes = within(dialogo).getByRole('group', { name: 'Recentes' })
    expect(within(recentes).getAllByRole('option').map(o => o.textContent)).toEqual(['Baile da Virada'])
    await user.keyboard('baile') // com texto, o grupo Recentes não aparece
    expect(within(dialogo).queryByRole('group', { name: 'Recentes' })).toBeNull()
  })

  it('recente de evento que não existe mais não aparece', async () => {
    localStorage.setItem('evk.nav.recentes', JSON.stringify([{ tipo: 'evento', ref: 'apagado' }, { tipo: 'evento', ref: 'e1' }]))
    montar()
    const dialogo = await abrir()
    expect(within(within(dialogo).getByRole('group', { name: 'Recentes' })).getAllByRole('option').map(o => o.textContent)).toEqual(['Noite de Forró'])
  })

  it('só num evento PUBLICADO e aprovado: rascunho e em análise não oferecem copiar nem abrir o link', async () => {
    eventosAtuais = [{ ...evento('e3', 'Ensaio fechado'), status: 'draft', approval_status: null }, { ...evento('e4', 'Festa em análise'), approval_status: 'pending' }]
    for (const id of ['e3', 'e4']) {
      montar(`/producer/event/${id}`)
      const dialogo = await abrir()
      expect(within(dialogo).queryByRole('option', { name: 'Copiar link do evento' })).toBeNull()
      expect(within(dialogo).queryByRole('option', { name: 'Abrir página pública do evento' })).toBeNull()
      cleanup()
    }
  })

  it('evento privado/por link usa o id no link (nunca o slug)', async () => {
    eventosAtuais = [{ ...evento('e5', 'Só convidados'), visibility: 'unlisted', slug: 'so-convidados' }]
    const copiar = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: copiar }, configurable: true })
    montar('/producer/event/e5')
    const dialogo = await abrir()
    await user.click(within(dialogo).getByRole('option', { name: 'Copiar link do evento' }))
    expect(copiar).toHaveBeenCalledWith(siteUrl('/event/e5'))
  })

  it('recente de tela do evento não vira link quebrado na produtora; e Recentes fica DEPOIS de Telas (Enter ao abrir leva à 1ª tela)', async () => {
    localStorage.setItem('evk.nav.recentes', JSON.stringify([{ tipo: 'tela', ref: '/producer/event/:eventId' }, { tipo: 'evento', ref: 'e1' }]))
    montar('/producer/dashboard')
    const dialogo = await abrir()
    const recentes = within(dialogo).getByRole('group', { name: 'Recentes' })
    expect(within(recentes).getAllByRole('option').map(o => o.textContent)).toEqual(['Noite de Forró']) // a "Pasta do evento" não existe na produtora
    const telasGrupo = within(dialogo).getByRole('group', { name: 'Telas' })
    expect(telasGrupo.compareDocumentPosition(recentes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy() // Recentes vem depois de Telas
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true')
    expect(screen.getAllByRole('option')[0].closest('[role=group]')).toBe(within(dialogo).getByRole('group', { name: 'Telas' }))
  })

  it('mensagem de vazio acompanha o prefixo e a dica está ligada ao campo', async () => {
    montar()
    const dialogo = await abrir()
    const campo = screen.getByRole('combobox')
    expect(document.getElementById(campo.getAttribute('aria-describedby')!)!.textContent).toMatch(/Dica:/)
    const user = userEvent.setup()
    await user.keyboard('@zzzz'); expect(within(dialogo).getByText('Nenhum evento com esse nome.')).toBeInTheDocument()
    await user.clear(campo); await user.keyboard('/zzzz'); expect(within(dialogo).getByText('Nenhuma tela com esse nome.')).toBeInTheDocument()
    await user.clear(campo); await user.keyboard('>zzzz'); expect(within(dialogo).getByText('Nenhuma ação com esse nome.')).toBeInTheDocument()
  })
})
