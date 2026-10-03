import * as React from "react"
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group"
import { type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { toggleVariants } from "@/components/ui/toggle"

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants> & {
    spacing?: number
  }
>({
  size: "default",
  variant: "default",
  spacing: 0,
})

function ToggleGroup({
  className,
  variant,
  size,
  spacing = 0,
  children,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> &
  VariantProps<typeof toggleVariants> & {
    spacing?: number
  }) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      data-spacing={spacing}
      style={{ "--gap": spacing } as React.CSSProperties}
      className={cn(
        "group/toggle-group flex w-fit items-center gap-[calc(var(--gap)*0.25rem)] rounded-md data-[spacing=default]:data-[variant=outline]:shadow-sm",
        className
      )}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size, spacing }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  )
}

function ToggleGroupItem({
  className,
  children,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item> &
  VariantProps<typeof toggleVariants>) {
  const context = React.useContext(ToggleGroupContext)

  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      data-variant={context.variant || variant}
      data-size={context.size || size}
      data-spacing={context.spacing}
      className={cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        "w-auto min-w-0 shrink-0 px-3 focus:z-10 focus-visible:z-10",
        "data-[spacing=0]:rounded-none data-[spacing=0]:shadow-none data-[spacing=0]:first:rounded-l-md data-[spacing=0]:last:rounded-r-md data-[spacing=0]:data-[variant=outline]:border-l-0 data-[spacing=0]:data-[variant=outline]:first:border-l",
        className
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  )
}

// Escolha exclusiva entre 2 a 5 opções curtas (período do gráfico, Scanner/Lista). O botão em relevo desliza:
// colunas iguais, largura 1/N, anda 100% por posição (nada é medido em JS). Teclado, foco e rádio vêm do Radix.
function Segmented({
  items,
  value,
  onValueChange,
  size = "sm",
  label,
  className,
}: {
  items: { value: string; label: React.ReactNode; count?: number }[]
  value: string
  onValueChange: (value: string) => void
  size?: "sm" | "md"
  /** nome do grupo para o leitor de tela */
  label: string
  className?: string
}) {
  const i = Math.max(0, items.findIndex((it) => it.value === value))
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      role="radiogroup"
      value={value}
      onValueChange={(v) => v && onValueChange(v)} // clicar no item já marcado não desmarca
      aria-label={label}
      data-slot="segmented"
      className={cn("relative grid rounded-md bg-secondary p-0.5", size === "sm" ? "h-8" : "h-10", className)}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0.5 left-0.5 rounded-sm bg-card shadow-ev-seg transition-transform duration-base ease-move motion-reduce:transition-none"
        style={{ width: `calc((100% - 4px) / ${items.length})`, transform: `translateX(${i * 100}%)` }}
      />
      {items.map((it) => (
        <ToggleGroupPrimitive.Item
          key={it.value}
          value={it.value}
          data-slot="segmented-item"
          className={cn(
            "alvo-44 relative z-10 inline-flex items-center justify-center gap-1.5 rounded-sm px-3 font-medium text-muted-foreground outline-none",
            "transition-colors duration-rapido hover:text-foreground data-[state=on]:text-foreground motion-reduce:transition-none",
            "focus-visible:shadow-[inset_0_0_0_2px_hsl(var(--ring))]",
            size === "sm" ? "text-[13px]" : "text-sm"
          )}
        >
          {it.label}
          {it.count != null && <span className="tabular-nums text-muted-foreground">{it.count}</span>}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  )
}

export { ToggleGroup, ToggleGroupItem, Segmented }
