import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

// Com "reduzir movimento" continua girando, mais devagar: é informação, não enfeite
function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon
      role="status"
      aria-label="Carregando"
      className={cn("size-4 animate-spin motion-reduce:[animation-duration:1.6s]", className)}
      {...props}
    />
  )
}

export { Spinner }
