import { useRef } from 'react'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Segmented } from '@/components/ui/toggle-group'
import { errosDeIngresso, precoDe, type Ing } from '../../../lib/painelEvento'
import { brl, calcularTaxa } from '../../../lib/taxa'
import { Faixa } from './campos'

const TIPO_FIXO: Record<string, string> = { individual: 'Individual', coletiva: 'Mesa coletiva', vip: 'VIP', mesa: 'Mesa' }

// Seção "Ingressos": gravação própria ("Salvar ingressos"), separada do salvamento automático do evento.
export default function SecaoIngressos({ ings, setIngs, sujo, salvando, tentou, onSalvar, onRemover, onAlternar, alternando, classificacao, aDefinir }: {
  ings: Ing[]
  setIngs: (l: Ing[]) => void
  sujo: boolean
  salvando: boolean
  tentou: boolean // a pessoa já clicou em "Salvar ingressos": campo vazio passa a mostrar o erro
  onSalvar: () => void
  onRemover: (i: Ing) => void
  onAlternar: (i: Ing) => void
  alternando: string | null
  classificacao: string
  aDefinir: boolean
}) {
  const n = useRef(0)
  const muda = (id: string, p: Partial<Ing>) => setIngs(ings.map(i => (i.id === id ? { ...i, ...p } : i)))

  return (
    <div className="grid gap-3">
      {ings.length === 0 && <p className="text-sm text-muted-foreground">Nenhum ingresso ainda. Adicione o primeiro.</p>}
      {ings.map((g, k) => {
        const e = errosDeIngresso(g)
        const preco = precoDe(g.preco)
        const temVenda = g.vendidos > 0
        const verPreco = tentou || g.preco.trim() !== ''
        const verQtd = tentou || g.qtd.trim() !== ''
        const t = preco !== null && preco > 0 ? calcularTaxa(preco) : null
        const id = `ing-${g.id}`
        return (
          <div key={g.id} role="group" aria-label={`Ingresso ${g.nome || k + 1}`} className="grid gap-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1.6fr)_9rem_7rem_2.5rem]">
              <div className="col-span-2 grid gap-1.5 sm:col-span-1">
                <Label htmlFor={`${id}-nome`} className="text-xs text-muted-foreground">Nome</Label>
                <Input id={`${id}-nome`} value={g.nome} aria-invalid={!!(tentou && e.nome)} aria-describedby={tentou && e.nome ? `${id}-nome-erro` : undefined} onChange={ev => muda(g.id, { nome: ev.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-preco`} className="text-xs text-muted-foreground">Preço (R$)</Label>
                <Input id={`${id}-preco`} inputMode="decimal" placeholder="0,00" value={g.preco} aria-invalid={verPreco && !!e.preco} aria-describedby={verPreco && e.preco ? `${id}-preco-erro` : undefined} onChange={ev => muda(g.id, { preco: ev.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-qtd`} className="text-xs text-muted-foreground">Quantidade</Label>
                <Input id={`${id}-qtd`} inputMode="numeric" value={g.qtd} aria-invalid={verQtd && !!e.qtd} aria-describedby={verQtd && e.qtd ? `${id}-qtd-erro` : undefined} onChange={ev => muda(g.id, { qtd: ev.target.value })} />
              </div>
              <div className="col-span-2 flex items-end sm:col-span-1">
                {!temVenda && (
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remover ${g.nome || `o ingresso ${k + 1}`}`} onClick={() => onRemover(g)}>
                    <I.Lixeira aria-hidden="true" />
                  </Button>
                )}
              </div>
            </div>

            {[
              [tentou && e.nome, 'nome'], [verPreco && e.preco, 'preco'], [verQtd && e.qtd, 'qtd'],
            ].map(([msg, campo]) => msg && (
              <p key={campo as string} id={`${id}-${campo}-erro`} role="alert" className="flex items-start gap-1.5 text-xs text-destructive"><I.Erro size={14} className="mt-px shrink-0" aria-hidden="true" />{msg}</p>
            ))}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-muted-foreground">
              {t ? (
                <span>Comprador paga <strong className="font-semibold tabular-nums text-foreground">{brl(t.total)}</strong> · {brl(t.preco)} + taxa {brl(t.taxa)}</span>
              ) : preco === 0 ? (
                <span><strong className="font-semibold text-foreground">Gratuito</strong> · sem taxa para o comprador</span>
              ) : null}
              {!g.ativo && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-foreground">Oculto: não aparece para venda</span>}
              {temVenda && (
                <span className="ml-auto flex items-center gap-2">
                  <span className="tabular-nums">{g.vendidos} {g.vendidos === 1 ? 'vendido' : 'vendidos'}</span>
                  <Button type="button" variant="outline" size="sm" loading={alternando === g.id} onClick={() => onAlternar(g)}>{g.ativo ? 'Ocultar' : 'Mostrar'}</Button>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              {g.novo ? (
                <Segmented
                  label={`Tipo de ${g.nome || 'ingresso'}`} size="sm" className="w-64" value={g.tipo} onValueChange={v => muda(g.id, { tipo: v })}
                  items={[{ value: 'individual', label: 'Individual' }, { value: 'coletiva', label: 'Mesa coletiva' }]}
                />
              ) : (
                <p className="text-[13px] text-muted-foreground">Tipo: <span className="font-medium text-foreground">{TIPO_FIXO[g.tipo] ?? g.tipo}</span> (não muda depois de criado)</p>
              )}
              <div className="flex items-center gap-2">
                <Checkbox id={`${id}-bebida`} checked={g.bebida} onCheckedChange={v => muda(g.id, { bebida: v === true })} />
                <Label htmlFor={`${id}-bebida`} className="font-normal">Inclui bebida alcoólica</Label>
              </div>
            </div>
            {g.tipo === 'coletiva' && classificacao !== 'A18' && (
              <Faixa tom="atencao" className="py-2">Só maiores de 18 compram a Mesa coletiva.</Faixa>
            )}
          </div>
        )
      })}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <Button
          type="button" variant="ghost"
          onClick={() => setIngs([...ings, { id: `novo-${++n.current}`, nome: '', preco: '', qtd: '', bebida: false, tipo: 'individual', ativo: true, vendidos: 0, novo: true }])}
        >
          <I.Criar aria-hidden="true" />Adicionar ingresso
        </Button>
        <span className="flex items-center gap-3">
          {sujo && <span role="status" className="text-xs text-muted-foreground">Ingressos com mudanças não salvas</span>}
          <Button type="button" variant="outline" disabled={!sujo} loading={salvando} onClick={onSalvar}>Salvar ingressos</Button>
        </span>
      </div>
      <p className="text-xs text-muted-foreground">Taxa Evokaa de 10%, mínimo de R$ 3 por ingresso, paga pelo comprador e mostrada ao lado do preço. Preço 0 = gratuito. Ingresso com venda não sai da lista: use Ocultar.</p>
      {aDefinir && <p className="flex items-center gap-1.5 text-xs text-[var(--ev-warning)]"><I.Alerta size={14} aria-hidden="true" />Com o local a definir, os ingressos ficam salvos mas não vendem.</p>}
    </div>
  )
}
