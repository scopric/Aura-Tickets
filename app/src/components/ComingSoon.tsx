import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface ComingSoonProps {
  /** Nome da ferramenta */
  titulo: string
  /** O que ela fará quando sair: uma frase direta, sem promessa de data */
  descricao: string
  /** Link de retorno (default: início do produtor) */
  backTo?: string
}

// Cartão das telas planejadas que ainda não existem (Decisão 213). Mesmo desenho do `EmBreve` do
// layout do produtor (feat/produtor-layout-modelo): quando aquele ramo for mesclado, trocar por ele.
export default function ComingSoon({ titulo, descricao, backTo = '/producer/dashboard' }: ComingSoonProps) {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-xl items-center p-4">
      <Card className="w-full gap-3 rounded-[10px] border-dashed border-muted-foreground/40 p-6 shadow-none">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold leading-7 text-foreground">{titulo}</h1>
          <Badge variant="outline">Em breve</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{descricao}</p>
        <div>
          <Button asChild variant="outline" size="sm">
            <Link to={backTo}>
              <ArrowLeft aria-hidden="true" /> Voltar ao início
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  )
}
