import EventoCapa from '@/components/EventoCapa'
import { EmBreve } from '@/components/producer/ui-evento'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { DbEvent, DbTicketType } from '../../hooks/useEvents'
import { janelaDeVenda, ROTULO_TIPO } from '../../lib/ingressos'
import { brl, calcularTaxa } from '../../lib/taxa'
import { dataBR } from '../../lib/bordero'

// Prévia simples do ingresso (sem a logo do produtor: ver o EmBreve no fim).
export default function IngressoPrevia({ evento, ingresso, onFechar }: { evento: DbEvent; ingresso: DbTicketType | null; onFechar: () => void }) {
  const t = ingresso ? calcularTaxa(Number(ingresso.price) || 0) : null
  return (
    <Sheet open={!!ingresso} onOpenChange={o => { if (!o) onFechar() }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {ingresso && t && (
          <>
            <SheetHeader>
              <SheetTitle>Prévia do ingresso</SheetTitle>
              <SheetDescription>Como o comprador vê este ingresso, de forma simplificada.</SheetDescription>
            </SheetHeader>
            <div className="space-y-6 px-4 pb-6">
              <article aria-label={`Ingresso ${ingresso.name}`} className="overflow-hidden rounded-[10px] border border-border bg-card">
                <div className="flex items-center gap-3 border-b border-border p-4">
                  <EventoCapa evento={evento} tamanho="mini" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{evento.title}</p>
                    {evento.date && <p className="text-xs text-muted-foreground">{dataBR(evento.date)}</p>}
                  </div>
                </div>
                <div className="space-y-2 p-4">
                  <p className="text-lg font-semibold text-foreground">{ingresso.name}</p>
                  <p className="text-xs text-muted-foreground">{ROTULO_TIPO[ingresso.type] ?? ingresso.type}{ingresso.permite_meia ? ' · aceita meia-entrada' : ''}</p>
                  <p className="font-display text-[28px] font-semibold tabular-nums text-foreground">{t.preco > 0 ? brl(t.preco) : 'Gratuito'}</p>
                  {t.preco > 0 && <p className="text-xs text-muted-foreground">+ taxa Evokaa {brl(t.taxa)} = {brl(t.total)}</p>}
                  <p className="text-xs text-muted-foreground">Venda: {janelaDeVenda(ingresso.sale_start, ingresso.sale_end)}</p>
                  {!ingresso.is_active && <p className="text-xs font-medium text-foreground">Oculto: não aparece para venda.</p>}
                </div>
              </article>
              <EmBreve titulo="Prévia com logo do produtor" descricao="Prévia com logo do produtor (plano PRO). Está em outra frente de trabalho e ainda não existe." acao="Ver com a logo" />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
