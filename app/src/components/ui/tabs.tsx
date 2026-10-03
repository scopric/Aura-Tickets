"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

type Forma = "linha" | "pilula"
const FormaContext = React.createContext<Forma>("linha")

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

// "linha" (padrão): abas de página com sublinhado de 2 px que desliza até a aba ativa
// (refs/movimento 03-aba-indicador, em CSS puro). "pilula": trilho cinza com a aba ativa em relevo.
function TabsList({
  className,
  variant = "linha",
  children,
  ref,
  onKeyDown,
  onPointerDown,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & { variant?: Forma }) {
  const lista = React.useRef<HTMLDivElement | null>(null)
  const [ind, setInd] = React.useState({ x: 0, w: 0 })
  const [teclado, setTeclado] = React.useState(false)
  // o ref de quem usa e o interno (que mede as abas) convivem
  const juntaRef = React.useCallback(
    (no: HTMLDivElement | null) => {
      lista.current = no
      if (typeof ref === "function") ref(no)
      else if (ref) ref.current = no
    },
    [ref]
  )

  React.useLayoutEffect(() => {
    const el = lista.current
    if (!el) return
    let anterior = -1
    let ro: ResizeObserver | null = null
    const medir = () => {
      const abas = [...el.querySelectorAll<HTMLElement>('[role="tab"]')]
      abas.forEach(a => ro?.observe(a)) // pega também abas que entraram depois
      const atual = abas.findIndex(a => a.dataset.state === "active")
      if (atual < 0) return
      if (variant === "linha") {
        const { offsetLeft: x, offsetWidth: w } = abas[atual]
        setInd(i => (i.x === x && i.w === w ? i : { x, w }))
      }
      // o conteúdo entra pelo lado da aba escolhida (--aba-dir, lido no keyframe aba-entra)
      if (anterior >= 0 && atual !== anterior)
        el.closest<HTMLElement>('[data-slot="tabs"]')?.style.setProperty("--aba-dir", atual > anterior ? "1" : "-1")
      anterior = atual
    }
    if (typeof ResizeObserver !== "undefined") ro = new ResizeObserver(medir) // jsdom não tem
    ro?.observe(el)
    medir()
    const mo = new MutationObserver(medir)
    mo.observe(el, { attributes: true, attributeFilter: ["data-state"], childList: true, subtree: true })
    return () => {
      mo.disconnect()
      ro?.disconnect()
    }
  }, [variant])

  return (
    <FormaContext.Provider value={variant}>
      <TabsPrimitive.List
        ref={juntaRef}
        data-slot="tabs-list"
        data-variant={variant}
        className={cn(
          variant === "linha"
            ? "relative flex h-10 items-end gap-6 border-b border-border"
            : "bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]",
          className
        )}
        // teclado não anima: as setas trocam de aba sem o indicador deslizar
        onKeyDown={e => { setTeclado(true); onKeyDown?.(e) }}
        onPointerDown={e => { setTeclado(false); onPointerDown?.(e) }}
        {...props}
      >
        {children}
        {variant === "linha" && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[-1px] left-0 h-0.5 w-px origin-left bg-foreground transition-transform duration-base ease-move motion-reduce:transition-none"
            style={{
              transform: `translateX(${ind.x}px) scaleX(${ind.w})`,
              transitionDuration: teclado ? "0ms" : undefined,
            }}
          />
        )}
      </TabsPrimitive.List>
    </FormaContext.Provider>
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const forma = React.useContext(FormaContext)
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-sm font-medium outline-none transition-colors duration-micro disabled:pointer-events-none disabled:text-[var(--ev-disabled-fg)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        forma === "linha"
          ? "relative -mb-px h-10 rounded-md text-muted-foreground hover:text-foreground focus-visible:shadow-ev-foco data-[state=active]:text-foreground"
          : "h-[calc(100%-1px)] flex-1 rounded-md border border-transparent px-2 py-1 text-foreground focus-visible:border-ring focus-visible:outline-1 focus-visible:outline-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=active]:bg-background data-[state=active]:shadow-sm dark:text-muted-foreground dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 dark:data-[state=active]:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(
        "flex-1 outline-none data-[state=active]:animate-[aba-entra_var(--mov-rapido)_var(--curva-sai)]",
        className
      )}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
