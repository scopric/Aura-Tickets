import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { useIsMobile } from "@/hooks/use-mobile"
import { useTheme } from "@/contexts/ThemeContext"

const Toaster = ({ ...props }: ToasterProps) => {
  // No celular os avisos no canto inferior se empilhavam sobre o botão principal dos formulários
  // (ex.: "Avançar" do cadastro), que ficava inclicável até sumirem: lá eles vão para o topo.
  const isMobile = useIsMobile()
  const { temaResolvido } = useTheme()
  return (
    <Sonner
      theme={temaResolvido}
      position={isMobile ? "top-center" : "bottom-right"}
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
