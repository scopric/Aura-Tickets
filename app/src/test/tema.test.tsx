import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { ThemeProvider, useTheme } from '../contexts/ThemeContext'
import ThemeToggle from '../components/ThemeToggle'
import { ROTAS_COM_TEMA, rotaForcadaEscuro, temaPadrao } from '../lib/tema'

const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8')
const vercel = JSON.parse(readFileSync(resolve(__dirname, '../../vercel.json'), 'utf8'))
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1])
const script = scripts[0]

// matchMedia falso (o jsdom não tem): permite trocar o tema do aparelho no meio do teste
function aparelho(escuro: boolean) {
  const estado = { escuro }
  const ouvintes = new Set<() => void>()
  window.matchMedia = vi.fn(() => ({
    get matches() { return estado.escuro },
    addEventListener: (_: string, f: () => void) => ouvintes.add(f),
    removeEventListener: (_: string, f: () => void) => ouvintes.delete(f),
  })) as unknown as typeof window.matchMedia
  return (v: boolean) => act(() => { estado.escuro = v; ouvintes.forEach(f => f()) })
}

function Mostra() {
  const { tema, temaResolvido, setTema } = useTheme()
  const navegar = useNavigate()
  return (
    <div>
      <button onClick={() => navegar('/producer')}>ir ao produtor</button>
      <button onClick={() => navegar('/app/tickets')}>ir ao participante</button>
      <span data-testid="tema">{tema}</span>
      <span data-testid="resolvido">{temaResolvido}</span>
      <button onClick={() => setTema('auto')}>auto</button>
      <button onClick={() => setTema('light')}>claro</button>
      <button onClick={() => setTema('dark')}>escuro</button>
    </div>
  )
}

const montar = (rota = '/producer', filho = <Mostra />) =>
  render(<MemoryRouter initialEntries={[rota]}><ThemeProvider>{filho}</ThemeProvider></MemoryRouter>)

const classeHtml = () => document.documentElement.className
const corDaBarra = () => document.querySelector('meta[name="theme-color"]')?.getAttribute('content')

beforeEach(() => {
  const meta = document.createElement('meta')
  meta.name = 'theme-color'
  document.head.appendChild(meta)
})

afterEach(() => {
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.remove())
  localStorage.clear()
  document.documentElement.className = ''
  // @ts-expect-error o jsdom não tem matchMedia; cada teste põe o seu
  delete window.matchMedia
})

describe('ThemeContext: 3 estados', () => {
  it('produtor sem nada salvo: automático, segue o aparelho', () => {
    aparelho(true)
    montar()
    expect(screen.getByTestId('tema').textContent).toBe('auto')
    expect(screen.getByTestId('resolvido').textContent).toBe('dark')
    expect(classeHtml()).toBe('dark')
    expect(corDaBarra()).toBe('#0b0d12')
  })

  it.each(['/app/tickets', '/admin/users', '/auth/login'])('%s sem nada salvo: escuro, mesmo com o aparelho claro', rota => {
    aparelho(false)
    montar(rota)
    expect(screen.getByTestId('tema').textContent).toBe('dark')
    expect(classeHtml()).toBe('dark')
  })

  // V11a (Decisão 142): página do evento e checkout começam em Automático; Explorar ('/events') segue forçado
  it.each(['/event/abc', '/checkout', '/checkout/payment'])('%s sem nada salvo: automático, segue o aparelho', rota => {
    aparelho(false)
    montar(rota)
    expect(screen.getByTestId('tema').textContent).toBe('auto')
    expect(classeHtml()).toBe('light')
  })

  it('sem nada salvo, o padrão muda junto com a rota; com escolha salva, não', () => {
    aparelho(false)
    montar('/app/tickets')
    expect(screen.getByTestId('tema').textContent).toBe('dark')
    fireEvent.click(screen.getByText('ir ao produtor'))
    expect(screen.getByTestId('tema').textContent).toBe('auto')
    expect(classeHtml()).toBe('light')
    expect(corDaBarra()).toBe('#ffffff')
    fireEvent.click(screen.getByText('claro'))
    fireEvent.click(screen.getByText('ir ao participante'))
    expect(screen.getByTestId('tema').textContent).toBe('light')
    expect(classeHtml()).toBe('light')
  })

  it('claro, escuro e automático: aplica no <html> e grava', () => {
    aparelho(false)
    montar()
    fireEvent.click(screen.getByText('escuro'))
    expect(classeHtml()).toBe('dark')
    expect(localStorage.getItem('evokaa-theme')).toBe('dark')
    fireEvent.click(screen.getByText('claro'))
    expect(classeHtml()).toBe('light')
    expect(localStorage.getItem('evokaa-theme')).toBe('light')
    fireEvent.click(screen.getByText('auto'))
    expect(screen.getByTestId('resolvido').textContent).toBe('light')
    expect(localStorage.getItem('evokaa-theme')).toBe('auto')
  })

  it.each(['dark', 'light'] as const)('aceita o valor antigo salvo "%s"', antigo => {
    aparelho(antigo === 'light') // o aparelho diz o contrário: vale o salvo
    localStorage.setItem('evokaa-theme', antigo)
    montar()
    expect(screen.getByTestId('tema').textContent).toBe(antigo)
    expect(screen.getByTestId('resolvido').textContent).toBe(antigo)
  })

  it('valor estranho salvo vale como nada salvo (padrão da área)', () => {
    aparelho(false)
    localStorage.setItem('evokaa-theme', 'roxo')
    montar()
    expect(screen.getByTestId('tema').textContent).toBe('auto')
  })

  it('raiz "/" só é forçada no escuro no site; em app.* e alpha.* ela redireciona', () => {
    for (const h of ['www.evokaa.com.br', 'evokaa.com.br', 'localhost']) expect(rotaForcadaEscuro('/', h)).toBe(true)
    for (const h of ['app.evokaa.com.br', 'alpha.evokaa.com.br', 'app.localhost', 'alpha.localhost']) expect(rotaForcadaEscuro('/', h)).toBe(false)
    expect(rotaForcadaEscuro('/events', 'app.evokaa.com.br')).toBe(true)
    expect(rotaForcadaEscuro('/producer/lugar-marcado', 'www.evokaa.com.br')).toBe(false)
  })

  it('no automático, a troca do aparelho muda o tema na hora', () => {
    const mudar = aparelho(false)
    montar()
    expect(screen.getByTestId('resolvido').textContent).toBe('light')
    mudar(true)
    expect(screen.getByTestId('resolvido').textContent).toBe('dark')
    expect(classeHtml()).toBe('dark')
    mudar(false)
    expect(classeHtml()).toBe('light')
  })

  it('rota pública ainda não refeita fica no escuro, mesmo com claro escolhido', () => {
    aparelho(false)
    localStorage.setItem('evokaa-theme', 'light')
    montar('/events')
    expect(screen.getByTestId('resolvido').textContent).toBe('dark')
  })
})

describe('ThemeToggle', () => {
  it('segmentado acessível: Automático, Claro, Escuro', () => {
    aparelho(true)
    montar('/producer', <ThemeToggle />)
    const grupo = screen.getByRole('radiogroup', { name: 'Tema' })
    const opcoes = screen.getAllByRole('radio')
    expect(grupo).toBeInTheDocument()
    expect(opcoes.map(o => o.textContent)).toEqual(['Automático', 'Claro', 'Escuro'])
    expect(opcoes[0]).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Seguindo o aparelho: escuro')).toBeInTheDocument()
    fireEvent.click(opcoes[1])
    expect(opcoes[1]).toHaveAttribute('aria-checked', 'true')
    expect(classeHtml()).toBe('light')
  })

  it('recolhido: um botão que passa pelos 3 estados', () => {
    aparelho(false)
    montar('/producer', <ThemeToggle collapsed />)
    fireEvent.click(screen.getByRole('button', { name: 'Tema: automático. Mudar para claro' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tema: claro. Mudar para escuro' }))
    expect(classeHtml()).toBe('dark')
    expect(screen.getByRole('button', { name: 'Tema: escuro. Mudar para automático' })).toBeInTheDocument()
  })

  it('participante sem nada salvo: mostra "Escuro" selecionado', () => {
    aparelho(false)
    montar('/app/tickets', <ThemeToggle />)
    expect(screen.getByRole('radio', { name: 'Escuro' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByText(/Seguindo o aparelho/)).not.toBeInTheDocument()
  })

  it('não aparece nas rotas forçadas no escuro', () => {
    aparelho(false)
    const { container } = montar('/', <ThemeToggle />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('script contra a piscada (index.html)', () => {
  it('há um único script embutido', () => {
    expect(scripts).toHaveLength(1)
  })

  it('usa a mesma lista de rotas do src/lib/tema.ts', () => {
    const lista = script.match(/\[([^\]]+)\]\.some/)?.[1]
    expect(lista).toBeDefined()
    expect([...lista!.matchAll(/'([^']+)'/g)].map(m => m[1])).toEqual(ROTAS_COM_TEMA.map(r => r.rota))
  })

  it('dá o mesmo resultado de src/lib/tema.ts em todas as combinações (salvo, aparelho, rota, host)', () => {
    let casos = 0
    for (const salvo of [null, 'auto', 'light', 'dark', 'roxo'])
      for (const escuro of [true, false])
        for (const rota of ['/', '/producer', '/producer/lugar-marcado', '/app/tickets', '/admin/users', '/auth/login', '/checkout', '/checkout/payment', '/event/abc', '/events'])
          for (const host of ['www.evokaa.com.br', 'app.evokaa.com.br', 'alpha.evokaa.com.br', 'app.localhost', 'localhost']) {
            aparelho(escuro)
            localStorage.clear()
            if (salvo) localStorage.setItem('evokaa-theme', salvo)
            document.documentElement.className = ''
            // o script é o do próprio index.html; "location" falso para variar rota e host
            new Function('location', script)({ pathname: rota, hostname: host })
            const t = salvo === 'auto' || salvo === 'light' || salvo === 'dark' ? salvo : temaPadrao(rota)
            const esperado = rotaForcadaEscuro(rota, host) || t === 'dark' || (t === 'auto' && escuro) ? 'dark' : 'light'
            expect(classeHtml(), `${salvo} ${escuro} ${host}${rota}`).toBe(esperado)
            expect(corDaBarra()).toBe(esperado === 'dark' ? '#0b0d12' : '#ffffff')
            casos++
          }
    expect(casos).toBe(500)
  })

  it('o hash na CSP do vercel.json bate com o script', () => {
    const hash = createHash('sha256').update(script, 'utf8').digest('base64')
    const csp = vercel.headers
      .flatMap((h: { headers: { key: string; value: string }[] }) => h.headers)
      .find((h: { key: string }) => h.key.startsWith('Content-Security-Policy'))
    const scriptSrc = csp.value.split(';').find((d: string) => d.trim().startsWith('script-src'))
    expect(scriptSrc).toContain(`'sha256-${hash}'`)
  })
})
