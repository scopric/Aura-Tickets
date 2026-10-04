import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"

// Botões do contrato v3.4 (§5 de estudos/botoes.md; prancha: .b, .b-p, .b-s, .b-g).
// Nomes do shadcn mantidos: default = primário, outline = secundário, destructive = perigo.
const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-semibold",
    "outline-none [-webkit-tap-highlight-color:transparent]",
    // cor e sombra: 160 ms; transform (pressionar): 100 ms. No :active a cor muda na hora
    "[transition-property:background-color,color,box-shadow,transform] [transition-duration:var(--mov-rapido),var(--mov-rapido),var(--mov-rapido),var(--mov-micro)] ease-hover",
    "active:[transition-duration:0ms,0ms,0ms,var(--mov-micro)]",
    "focus-visible:shadow-ev-foco",
    // pressionar: 0,97 (lg 0,98; largura total 0,99)
    "active:scale-[.97] [&.w-full]:active:scale-[.99] motion-reduce:[&.w-full]:active:scale-100 disabled:[&.w-full]:active:scale-100",
    // alvo de toque de 44 px só em tela de toque (index.css); com mouse não invade os vizinhos
    "alvo-44",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
    // desabilitado: cor explícita, não opacidade (sobre foto a opacidade deixa a foto vazar)
    "disabled:cursor-not-allowed disabled:bg-[var(--ev-disabled-bg)] disabled:text-[var(--ev-disabled-fg)] disabled:shadow-none disabled:active:scale-100",
    // carregando: não aceita novo clique, mas mantém a cor (não parece desligado)
    "aria-busy:pointer-events-none aria-busy:cursor-progress",
    // "reduzir movimento": sem escala, só a cor muda
    "motion-reduce:[transition-property:background-color,color,box-shadow] motion-reduce:active:scale-100",
  ],
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-ev-primary hover:bg-[var(--ev-brand-hover)] active:bg-[var(--ev-brand-press)] active:shadow-ev-primary-press",
        destructive:
          "bg-destructive text-destructive-foreground shadow-ev-primary hover:bg-[var(--ev-danger-hover)] active:shadow-ev-primary-press",
        outline:
          "bg-card text-foreground shadow-ev-secondary hover:bg-[var(--ev-sec-hover)] active:bg-[var(--ev-sec-press)]",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[var(--ev-sec-press)] active:bg-[var(--ev-sec-press)]",
        ghost:
          "bg-transparent text-muted-foreground hover:bg-[var(--ev-tint-hover)] hover:text-foreground active:bg-[var(--ev-tint-press)] active:text-foreground disabled:bg-transparent",
        link: "bg-transparent text-primary underline-offset-4 hover:underline disabled:bg-transparent",
      },
      size: {
        // altura / raio (rounded-xs..lg = 6/8/10/12 px no tailwind.config) / fonte / ícone / respiro
        xs: "h-7 gap-1 rounded-xs px-2 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 gap-1.5 rounded-sm px-3 text-[13px] [&_svg:not([class*='size-'])]:size-4",
        default: "h-10 gap-2 rounded-md px-4 text-sm [&_svg:not([class*='size-'])]:size-[18px]",
        lg: "h-12 gap-2 rounded-lg px-5 text-base tracking-[-0.01em] [&_svg:not([class*='size-'])]:size-5 active:scale-[.98]",
        "icon-sm": "size-8 rounded-sm p-0 [&_svg:not([class*='size-'])]:size-4",
        icon: "size-10 rounded-md p-0 [&_svg:not([class*='size-'])]:size-[18px]",
        "icon-lg": "size-12 rounded-lg p-0 [&_svg:not([class*='size-'])]:size-5 active:scale-[.98]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  children,
  onClick,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** mostra o indicador no lugar do rótulo (a largura não muda) e ignora cliques e envio de formulário */
    loading?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size }), className)}
      aria-busy={loading || undefined}
      // aria-busy bloqueia o mouse; Enter e o envio do formulário ainda disparariam, então o clique é cancelado
      onClick={loading ? (e) => e.preventDefault() : onClick}
      {...props}
    >
      {loading && !asChild ? (
        // as duas camadas ocupam a mesma célula: a largura não pula quando o rótulo troca
        // gap-[inherit]: repassa o gap do botão à camada invisível (célula única, o gap da grade não aparece)
        <span className="grid items-center gap-[inherit] [&>*]:col-start-1 [&>*]:row-start-1">
          <span aria-hidden="true" className="invisible inline-flex items-center justify-center gap-[inherit]">{children}</span>
          <span className="inline-flex items-center justify-center">
            <Spinner role="presentation" aria-hidden="true" />
            <span className="sr-only">Carregando</span>
          </span>
        </span>
      ) : (
        children
      )}
    </Comp>
  )
}

export { Button, buttonVariants }
