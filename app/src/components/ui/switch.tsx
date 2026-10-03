"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

// Liga/desliga com efeito imediato (para escolher entre opções, use o Segmented)
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "group/sw peer relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full p-0.5 outline-none",
        "transition-colors duration-micro ease-linear motion-reduce:transition-none",
        "data-[state=unchecked]:bg-input data-[state=checked]:bg-primary",
        "focus-visible:shadow-ev-foco",
        // data-[state] vem depois de disabled: no CSS; por isso o desabilitado repete o estado
        "disabled:cursor-not-allowed disabled:data-[state=checked]:bg-[var(--ev-disabled-bg)] disabled:data-[state=unchecked]:bg-[var(--ev-disabled-bg)]",
        // alvo de toque de 44 px só em tela de toque (index.css)
        "alvo-44",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.25)]",
          "[transition-property:transform,width] [transition-duration:var(--mov-base),var(--mov-micro)] ease-move motion-reduce:transition-none",
          "data-[state=checked]:translate-x-4",
          // desabilitado: o botão deixa de ser branco (sobre o trilho cinza claro some)
          "group-disabled/sw:bg-[var(--ev-disabled-fg)]",
          // ao segurar, o botão estica 4 px na direção do movimento
          "group-active/sw:w-6 group-data-[state=checked]/sw:group-active/sw:translate-x-3"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
