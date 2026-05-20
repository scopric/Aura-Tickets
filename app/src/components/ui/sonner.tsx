import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="bottom-right"
      richColors
      closeButton
      duration={3000}
      icons={{
        success: <CircleCheckIcon className="w-4 h-4" />,
        info: <InfoIcon className="w-4 h-4" />,
        warning: <TriangleAlertIcon className="w-4 h-4" />,
        error: <OctagonXIcon className="w-4 h-4" />,
        loading: <Loader2Icon className="w-4 h-4 animate-spin" />,
      }}
      {...props}
    />
  )
}

export { Toaster }
