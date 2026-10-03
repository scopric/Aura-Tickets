import { createRef } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button, buttonVariants } from '../components/ui/button'
import { Switch } from '../components/ui/switch'
import { Segmented } from '../components/ui/toggle-group'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Spinner } from '../components/ui/spinner'

// Tudo o que o código usa hoje (66 outline, 38 ghost, 10 secondary, 2 destructive, 1 link; sm 55, icon-sm 40, icon 2, default 2)
// mais o que a V2 acrescenta (xs, lg, icon-lg), em todas as combinações.
const VARIANTES = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const
const TAMANHOS = ['xs', 'sm', 'default', 'lg', 'icon-sm', 'icon', 'icon-lg'] as const

// classe que cada variante tem de carregar (cor do preenchimento ou, no caso do link, do texto)
const CLASSE_DA_VARIANTE = {
  default: 'bg-primary',
  destructive: 'bg-destructive',
  outline: 'shadow-ev-secondary',
  secondary: 'bg-secondary',
  ghost: 'bg-transparent',
  link: 'text-primary',
} as const
const CLASSE_DO_TAMANHO = {
  xs: 'h-7', sm: 'h-8', default: 'h-10', lg: 'h-12',
  'icon-sm': 'size-8', icon: 'size-10', 'icon-lg': 'size-12',
} as const

// um eixo por vez (as combinações só mudam classes que não se tocam)
describe('Button: variant e size', () => {
  it.each(VARIANTES)('variant %s: renderiza, tem a classe e respeita disabled', (variant) => {
    const { rerender } = render(<Button variant={variant}>Salvar</Button>)
    const b = screen.getByRole('button', { name: 'Salvar' })
    expect(b).toHaveAttribute('data-slot', 'button')
    expect(b).toHaveClass(CLASSE_DA_VARIANTE[variant])
    expect(b).toBeEnabled()
    // desabilitado: cor explícita (não só opacidade); fantasma e link seguem sem fundo
    const semFundo = variant === 'ghost' || variant === 'link'
    expect(b).toHaveClass(semFundo ? 'disabled:bg-transparent' : 'disabled:bg-[var(--ev-disabled-bg)]', 'disabled:text-[var(--ev-disabled-fg)]', 'disabled:cursor-not-allowed')
    expect(b.className).not.toMatch(/opacity-50/)
    rerender(<Button variant={variant} disabled>Salvar</Button>)
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
  })

  it.each(TAMANHOS)('size %s: renderiza com a classe do tamanho', (size) => {
    render(<Button size={size}>Salvar</Button>)
    expect(screen.getByRole('button', { name: 'Salvar' })).toHaveClass(CLASSE_DO_TAMANHO[size])
  })

  it('sem props: primário no tamanho padrão, com alvo de 44 px e foco duplo', () => {
    render(<Button>Comprar</Button>)
    const b = screen.getByRole('button', { name: 'Comprar' })
    expect(b).toHaveClass('bg-primary', 'h-10', 'alvo-44', 'focus-visible:shadow-ev-foco')
    expect(b).toHaveAttribute('data-variant', 'default')
    expect(b).toHaveAttribute('data-size', 'default')
  })

  it('pressionar: escala 0,97 (lg 0,98, largura total 0,99) e nenhuma com "reduzir movimento"', () => {
    render(<><Button size="sm">Ok</Button><Button size="lg">Grande</Button></>)
    const b = screen.getByRole('button', { name: 'Ok' })
    expect(b).toHaveClass('active:scale-[.97]', '[&.w-full]:active:scale-[.99]', 'motion-reduce:active:scale-100')
    expect(screen.getByRole('button', { name: 'Grande' })).toHaveClass('active:scale-[.98]')
    expect(screen.getByRole('button', { name: 'Grande' })).not.toHaveClass('active:scale-[.97]')
  })

  it('secondary: hover e pressionado opacos (não somem sobre foto)', () => {
    render(<Button variant="secondary">Filtro</Button>)
    const b = screen.getByRole('button', { name: 'Filtro' })
    expect(b).toHaveClass('hover:bg-[var(--ev-sec-press)]', 'active:bg-[var(--ev-sec-press)]')
    expect(b.className).not.toMatch(/tint/)
  })

  it('className do uso vence a do tamanho (twMerge)', () => {
    render(<Button size="sm" className="h-auto rounded-full">Largo</Button>)
    const b = screen.getByRole('button', { name: 'Largo' })
    expect(b).toHaveClass('h-auto', 'rounded-full')
    expect(b).not.toHaveClass('h-8')
    expect(b).not.toHaveClass('rounded-sm')
  })

  it('asChild: vira o filho (link) e mantém data-slot e classes', () => {
    render(<Button asChild variant="outline" size="sm"><a href="/x">Ver</a></Button>)
    const a = screen.getByRole('link', { name: 'Ver' })
    expect(a).toHaveAttribute('href', '/x')
    expect(a).toHaveAttribute('data-slot', 'button')
    expect(a).toHaveClass('shadow-ev-secondary', 'h-8')
  })

  it('buttonVariants (alert-dialog, pagination, calendar) devolve as mesmas classes', () => {
    expect(buttonVariants()).toContain('bg-primary')
    expect(buttonVariants({ variant: 'outline' })).toContain('shadow-ev-secondary')
    expect(buttonVariants({ variant: 'ghost', size: 'icon' })).toContain('size-10')
  })

  it('carregando: aria-busy, "Carregando" em português, rótulo ocupando o espaço e clique ignorado', () => {
    const aoClicar = vi.fn()
    render(<Button loading onClick={aoClicar}>Publicar evento</Button>)
    const b = screen.getByRole('button')
    expect(b).toHaveAttribute('aria-busy', 'true')
    expect(b).toHaveAccessibleName('Carregando')
    expect(screen.getByText('Publicar evento')).toHaveClass('invisible')
    fireEvent.click(b)
    expect(aoClicar).not.toHaveBeenCalled()
  })

  it('carregando dentro de formulário: nenhum envio (clique nem Enter)', () => {
    const envia = vi.fn((e: React.FormEvent) => e.preventDefault())
    const { rerender } = render(<form onSubmit={envia}><Button type="submit" loading>Enviar</Button></form>)
    fireEvent.click(screen.getByRole('button'))
    expect(envia).toHaveBeenCalledTimes(0)
    rerender(<form onSubmit={envia}><Button type="submit">Enviar</Button></form>)
    fireEvent.click(screen.getByRole('button'))
    expect(envia).toHaveBeenCalledTimes(1)
  })

  it('sem loading o DOM é o de sempre (filhos direto no botão) e o clique passa', () => {
    const aoClicar = vi.fn()
    render(<Button onClick={aoClicar}><span data-testid="filho">x</span></Button>)
    expect(screen.getByTestId('filho').parentElement).toBe(screen.getByRole('button'))
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-busy')
    fireEvent.click(screen.getByRole('button'))
    expect(aoClicar).toHaveBeenCalledTimes(1)
  })
})

describe('controles da V2', () => {
  it('Spinner anuncia "Carregando" e gira mais devagar com "reduzir movimento"', () => {
    render(<Spinner />)
    const s = screen.getByRole('status', { name: 'Carregando' })
    expect(s).toHaveClass('animate-spin', 'motion-reduce:[animation-duration:1.6s]')
  })

  it('Switch: role=switch, alterna e respeita disabled', () => {
    const muda = vi.fn()
    const { rerender } = render(<Switch aria-label="Venda aberta" onCheckedChange={muda} />)
    const sw = screen.getByRole('switch', { name: 'Venda aberta' })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(sw)
    expect(muda).toHaveBeenCalledWith(true)
    rerender(<Switch aria-label="Venda aberta" disabled />)
    expect(screen.getByRole('switch')).toBeDisabled()
    // o trilho cinza do desabilitado tem de vencer o data-[state] (que vem depois no CSS)
    expect(screen.getByRole('switch')).toHaveClass('disabled:data-[state=checked]:bg-[var(--ev-disabled-bg)]', 'disabled:data-[state=unchecked]:bg-[var(--ev-disabled-bg)]', 'alvo-44')
  })

  it('Segmented: o botão em relevo anda 100% por posição e o clique troca o valor', () => {
    const troca = vi.fn()
    const itens = [{ value: 'a', label: 'Hoje' }, { value: 'b', label: '7 dias' }, { value: 'c', label: '30 dias' }]
    const { container } = render(<Segmented items={itens} value="c" onValueChange={troca} label="Período" />)
    expect(screen.getByRole('radiogroup', { name: 'Período' })).toBeInTheDocument()
    const relevo = container.querySelector<HTMLElement>('[aria-hidden="true"]')!
    expect(relevo.style.transform).toBe('translateX(200%)')
    fireEvent.click(screen.getByRole('radio', { name: '7 dias' }))
    expect(troca).toHaveBeenCalledWith('b')
  })

  it('Tabs: linha com indicador por padrão; pilula sem indicador; troca de aba mostra o conteúdo', () => {
    const { container, unmount } = render(
      <Tabs defaultValue="um">
        <TabsList>
          <TabsTrigger value="um">Um</TabsTrigger>
          <TabsTrigger value="dois">Dois</TabsTrigger>
        </TabsList>
        <TabsContent value="um">conteúdo um</TabsContent>
        <TabsContent value="dois">conteúdo dois</TabsContent>
      </Tabs>
    )
    expect(container.querySelector('[data-slot="tabs-list"] > span[aria-hidden="true"]')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Um' })).toHaveAttribute('data-state', 'active')
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Dois' }))
    expect(screen.getByText('conteúdo dois')).toBeInTheDocument()
    unmount()

    const p = render(
      <Tabs defaultValue="um">
        <TabsList variant="pilula"><TabsTrigger value="um">Um</TabsTrigger></TabsList>
      </Tabs>
    )
    expect(p.container.querySelector('[data-slot="tabs-list"] > span[aria-hidden="true"]')).toBeNull()
  })

  it('Tabs: o ref de quem usa convive com o indicador e aba nova não quebra', () => {
    const ref = createRef<HTMLDivElement>()
    const Abas = ({ n }: { n: number }) => (
      <Tabs defaultValue="t0">
        <TabsList ref={ref}>
          {Array.from({ length: n }, (_, i) => <TabsTrigger key={i} value={`t${i}`}>Aba {i}</TabsTrigger>)}
        </TabsList>
      </Tabs>
    )
    const { container, rerender } = render(<Abas n={1} />)
    expect(ref.current).toBe(container.querySelector('[data-slot="tabs-list"]'))
    rerender(<Abas n={2} />)
    expect(screen.getAllByRole('tab')).toHaveLength(2)
    expect(container.querySelector('[data-slot="tabs-list"] > span[aria-hidden="true"]')).toBeInTheDocument()
  })
})
