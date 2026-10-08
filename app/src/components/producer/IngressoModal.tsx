import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useUpdateEvent } from '../../hooks/useEvents'
import { erroDoModelo, ingNovo, ingParaBanco, ROTULO_TIPO, semMeia, type Modelo } from '../../lib/ingressos'
import { erroDosIngressos, errosDeIngresso, precoDe, temErro, type Ing } from '../../lib/painelEvento'
import { brl, calcularTaxa } from '../../lib/taxa'

const MODELOS: { id: Modelo; titulo: string; texto: string }[] = [
  { id: 'pago', titulo: 'Pago', texto: 'Ingresso com preço. O comprador paga o preço mais a taxa Evokaa.' },
  { id: 'gratuito', titulo: 'Gratuito', texto: 'Preço 0, sem taxa. Bom para convidados e eventos abertos.' },
  { id: 'grupo', titulo: 'Grupo', texto: 'Mesa coletiva: um grupo compra junto. Sem meia-entrada.' },
]

const Erro = ({ id, children }: { id: string; children?: ReactNode }) => children ? (
  <p id={id} role="alert" className="flex items-start gap-1.5 text-xs text-destructive"><I.Erro size={14} className="mt-px shrink-0" aria-hidden="true" />{children}</p>
) : null

// "Novo ingresso" (passo 1: tipo; passo 2: o essencial; "Avançado" recolhido) e "Editar ingresso" (direto no passo 2).
// Grava pelo mesmo caminho do editor do evento (useUpdateEvent): o servidor confere preço e taxa na venda.
export default function IngressoModal({ eventId, editando, fimEvento, classificacao, onFechar }: {
  eventId: string
  editando: Ing | null
  fimEvento?: number
  classificacao?: string | null
  onFechar: () => void
}) {
  const gravar = useUpdateEvent()
  const [modelo, setModelo] = useState<Modelo | null>(null)
  const [ing, setIng] = useState<Ing | null>(editando)
  const [tentou, setTentou] = useState(false)
  const [confirmar, setConfirmar] = useState<string | null>(null)

  const escolher = (m: Modelo) => { setModelo(m); setIng(ingNovo(m)) }
  const muda = (p: Partial<Ing>) => setIng(i => (i ? { ...i, ...p } : i))
  const e = ing ? errosDeIngresso(ing, fimEvento) : {}
  const eModelo = ing ? erroDoModelo(modelo, ing) : undefined
  const preco = ing ? precoDe(ing.preco) : null
  const taxa = preco !== null && preco > 0 ? calcularTaxa(preco) : null
  const travaMeia = !!ing && semMeia(ing.tipo)

  async function salvar(ev: React.FormEvent) {
    ev.preventDefault()
    if (!ing) return
    setTentou(true)
    if (temErro(e) || eModelo) return
    // edição que mexe em dinheiro pede confirmação antes de gravar
    if (editando) {
      const antes = precoDe(editando.preco) ?? 0
      const virouGratis = antes > 0 && preco === 0
      const mudouComVenda = editando.vendidos > 0 && preco !== antes
      if (virouGratis || mudouComVenda) {
        setConfirmar([virouGratis && 'Este ingresso passa a ser gratuito.', mudouComVenda && 'O novo preço vale só para quem comprar daqui em diante: quem já comprou não é afetado.'].filter(Boolean).join(' '))
        return
      }
    }
    await gravarAgora()
  }

  async function gravarAgora() {
    if (!ing) return
    setConfirmar(null)
    try {
      await gravar.mutateAsync({ eventId, event: {}, tickets: [ingParaBanco(ing)] })
      toast.success(editando ? 'Ingresso atualizado.' : 'Ingresso criado.')
      onFechar()
    } catch (err) {
      toast.error(erroDosIngressos(err))
    }
  }

  const id = 'ing-modal'
  return (
    <Dialog open onOpenChange={o => { if (!o && !gravar.isPending) onFechar() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar ingresso' : 'Novo ingresso'}</DialogTitle>
          <DialogDescription>{!ing ? 'Que tipo de ingresso você quer criar?' : editando ? 'O tipo não muda depois de criado.' : 'Preencha o essencial. O resto fica em Avançado.'}</DialogDescription>
        </DialogHeader>

        {!ing ? (
          <div className="grid gap-3">
            {MODELOS.map(m => (
              <button key={m.id} type="button" onClick={() => escolher(m.id)}
                className="min-h-11 rounded-[10px] border border-border bg-card p-4 text-left hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="block text-[15px] font-semibold text-foreground">{m.titulo}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{m.texto}</span>
              </button>
            ))}
          </div>
        ) : (
          <form id="form-ingresso" onSubmit={salvar} className="grid gap-4" noValidate>
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-nome`}>Nome</Label>
              <Input id={`${id}-nome`} className="min-h-11" value={ing.nome} maxLength={80} autoFocus aria-invalid={!!(tentou && e.nome)} aria-describedby={tentou && e.nome ? `${id}-nome-erro` : undefined} onChange={ev => muda({ nome: ev.target.value })} placeholder="Ex.: Pista, Camarote" />
              {tentou && <Erro id={`${id}-nome-erro`}>{e.nome}</Erro>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-preco`}>Preço (R$)</Label>
                <Input id={`${id}-preco`} className="min-h-11" inputMode="decimal" placeholder="0,00" value={ing.preco} disabled={modelo === 'gratuito'} aria-invalid={!!((tentou || ing.preco !== '') && (e.preco || eModelo))} aria-describedby={`${id}-preco-info`} onChange={ev => muda({ preco: ev.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-qtd`}>Quantidade</Label>
                <Input id={`${id}-qtd`} className="min-h-11" inputMode="numeric" value={ing.qtd} aria-invalid={!!((tentou || ing.qtd !== '') && e.qtd)} aria-describedby={`${id}-qtd-info`} onChange={ev => muda({ qtd: ev.target.value })} />
              </div>
            </div>
            <div id={`${id}-preco-info`} className="grid gap-1 text-[13px] text-muted-foreground">
              {taxa ? (
                <span>Comprador paga <strong className="font-semibold tabular-nums text-foreground">{brl(taxa.total)}</strong> · ingresso {brl(taxa.preco)} + taxa Evokaa {brl(taxa.taxa)}. Você recebe o valor do ingresso, <strong className="font-semibold tabular-nums text-foreground">{brl(taxa.preco)}</strong>.</span>
              ) : preco === 0 ? (
                <span><strong className="font-semibold text-foreground">Gratuito</strong> · sem taxa para o comprador</span>
              ) : (
                <span>Informe o preço com vírgula nos centavos (ex.: 80,00).</span>
              )}
              {(tentou || ing.preco !== '') && <Erro id={`${id}-preco-erro`}>{eModelo ?? e.preco}</Erro>}
            </div>
            <div id={`${id}-qtd-info`} className="grid gap-1 text-[13px] text-muted-foreground">
              {ing.vendidos > 0 && <span>Já vendidos: {ing.vendidos}. A quantidade não pode ficar abaixo disso.</span>}
              {(tentou || ing.qtd !== '') && <Erro id={`${id}-qtd-erro`}>{e.qtd}</Erro>}
            </div>
            {editando && <p className="text-[13px] text-muted-foreground">Tipo: <span className="font-medium text-foreground">{ROTULO_TIPO[ing.tipo] ?? ing.tipo}</span></p>}
            {ing.tipo === 'coletiva' && classificacao !== 'A18' && <p className="text-[13px] text-[var(--ev-warning)]">Só maiores de 18 compram a Mesa coletiva.</p>}

            <details className="rounded-[10px] border border-border p-3">
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Avançado</summary>
              <div className="mt-3 grid gap-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor={`${id}-ini`} className="text-xs text-muted-foreground">Início da venda (opcional)</Label>
                    <Input id={`${id}-ini`} className="min-h-11" type="datetime-local" value={ing.inicioVenda} onChange={ev => muda({ inicioVenda: ev.target.value })} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor={`${id}-fim`} className="text-xs text-muted-foreground">Fim da venda (opcional)</Label>
                    <Input id={`${id}-fim`} className="min-h-11" type="datetime-local" value={ing.fimVenda} aria-invalid={!!e.venda} aria-describedby={e.venda ? `${id}-venda-erro` : undefined} onChange={ev => muda({ fimVenda: ev.target.value })} />
                  </div>
                </div>
                <Erro id={`${id}-venda-erro`}>{e.venda}</Erro>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor={`${id}-min`} className="text-xs text-muted-foreground">Mínimo por pedido</Label>
                    <Input id={`${id}-min`} className="min-h-11" inputMode="numeric" value={ing.minPed} aria-invalid={!!e.pedido} aria-describedby={e.pedido ? `${id}-pedido-erro` : undefined} onChange={ev => muda({ minPed: ev.target.value })} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor={`${id}-max`} className="text-xs text-muted-foreground">Máximo por pedido</Label>
                    <Input id={`${id}-max`} className="min-h-11" inputMode="numeric" value={ing.maxPed} aria-invalid={!!e.pedido} aria-describedby={e.pedido ? `${id}-pedido-erro` : undefined} onChange={ev => muda({ maxPed: ev.target.value })} />
                  </div>
                </div>
                <p className="-mt-2 text-xs text-muted-foreground">De 1 a 10. Máximo vazio = 10.</p>
                <Erro id={`${id}-pedido-erro`}>{e.pedido}</Erro>
                <div className="grid gap-1.5">
                  <Label htmlFor={`${id}-cpf`} className="text-xs text-muted-foreground">Limite por CPF (vazio = sem limite)</Label>
                  <Input id={`${id}-cpf`} className="min-h-11 sm:w-40" inputMode="numeric" value={ing.maxCpf} aria-invalid={!!e.cpf} aria-describedby={e.cpf ? `${id}-cpf-erro` : undefined} onChange={ev => muda({ maxCpf: ev.target.value })} />
                  <Erro id={`${id}-cpf-erro`}>{e.cpf}</Erro>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={`${id}-desc`} className="text-xs text-muted-foreground">Descrição (opcional)</Label>
                  <Textarea id={`${id}-desc`} rows={2} maxLength={500} value={ing.descricao} onChange={ev => muda({ descricao: ev.target.value })} />
                </div>
                <div className="grid gap-1">
                  <div className="flex min-h-11 items-center gap-2">
                    <Checkbox id={`${id}-meia`} checked={ing.meia && !travaMeia} disabled={travaMeia} onCheckedChange={v => muda({ meia: v === true })} />
                    <Label htmlFor={`${id}-meia`} className="font-normal">Aceita meia-entrada</Label>
                  </div>
                  {travaMeia && <p className="text-xs text-muted-foreground">Mesa e mesa coletiva não têm meia-entrada (o banco recusa).</p>}
                </div>
                <div className="flex min-h-11 items-center gap-2">
                  <Checkbox id={`${id}-bebida`} checked={ing.bebida} onCheckedChange={v => muda({ bebida: v === true })} />
                  <Label htmlFor={`${id}-bebida`} className="font-normal">Inclui bebida alcoólica</Label>
                </div>
              </div>
            </details>
          </form>
        )}

        <DialogFooter>
          <Button variant="outline" className="min-h-11" onClick={onFechar} disabled={gravar.isPending}>Cancelar</Button>
          {!editando && ing && <Button variant="ghost" className="min-h-11" onClick={() => { setIng(null); setModelo(null); setTentou(false) }} disabled={gravar.isPending}>Trocar tipo</Button>}
          {ing && <Button type="submit" form="form-ingresso" className="min-h-11" loading={gravar.isPending}>{editando ? 'Salvar' : 'Criar ingresso'}</Button>}
        </DialogFooter>
      </DialogContent>
      <AlertDialog open={confirmar !== null} onOpenChange={o => { if (!o) setConfirmar(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar a mudança de preço?</AlertDialogTitle>
            <AlertDialogDescription>{confirmar}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Voltar</AlertDialogCancel>
            <AlertDialogAction className="min-h-11" onClick={() => { void gravarAgora() }}>Confirmar e salvar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
