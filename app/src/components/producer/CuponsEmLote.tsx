import { useState } from 'react'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { selectNativo } from '@/components/producer/ui'
import { useCreateCouponsBulk } from '../../hooks/useProducerTools'
import type { DbEvent } from '../../hooks/useEvents'
import { csvFilename, downloadCsv } from '../../lib/exportCsv'
import { csvDosCodigos, fimDoDia, gerarCodigos, modeloCsv, motivoDoErro, prefixoLimpo, TETO_CUPONS, validarCupons, type CupomCsv, type RelatorioCsv } from '../../lib/ingressos'
import { precoDe } from '../../lib/painelEvento'

type Resultado = { criados: string[]; falhas: { code: string; erro?: string }[] }
const TAMANHO_MAX = 200_000 // bytes: 500 linhas cabem com folga

function Resumo({ r }: { r: Resultado }) {
  return (
    <div role="status" className="grid gap-2 rounded-[10px] border border-border bg-card p-3 text-sm">
      <p className="text-foreground"><strong>{r.criados.length}</strong> {r.criados.length === 1 ? 'cupom criado' : 'cupons criados'}{r.falhas.length > 0 && <>, <strong>{r.falhas.length}</strong> não {r.falhas.length === 1 ? 'foi criado' : 'foram criados'}</>}.</p>
      {/* sem listar os códigos: um código recusado pode existir em outro produtor, e isso não se revela */}
      {r.falhas.length > 0 && (
        <ul className="text-xs text-muted-foreground">
          {[...new Set(r.falhas.map(f => motivoDoErro(f.erro)))].map(mot => <li key={mot}>{r.falhas.filter(f => motivoDoErro(f.erro) === mot).length}: {mot}</li>)}
        </ul>
      )}
      {r.criados.length > 0 && <div><Button variant="outline" size="sm" className="min-h-11" onClick={() => downloadCsv(csvFilename('cupons-criados'), csvDosCodigos(r.criados))}><I.Baixar aria-hidden="true" />Baixar os códigos (CSV)</Button></div>}
    </div>
  )
}

function SeletorEvento({ id, valor, onChange, eventos }: { id: string; valor: string; onChange: (v: string) => void; eventos: DbEvent[] }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>Evento</Label>
      <select id={id} value={valor} onChange={e => onChange(e.target.value)} className={`${selectNativo} min-h-11`}>
        <option value="">Todos os eventos</option>
        {eventos.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
      </select>
    </div>
  )
}

// Só evento do produtor: o id vem da lista dele; o banco confere de novo (RLS)
const eventoDele = (eventos: DbEvent[], id: string) => (id && eventos.some(e => e.id === id) ? id : null)

export function CriarEmLote({ eventos, existentes, eventoInicial, onFechar }: { eventos: DbEvent[]; existentes: string[]; eventoInicial: string; onFechar: () => void }) {
  const criar = useCreateCouponsBulk()
  const [f, setF] = useState({ prefixo: '', qtd: '10', tipo: 'percent' as CupomCsv['discount_type'], valor: '', eventId: eventoInicial, fim: '' })
  const [erro, setErro] = useState('')
  const [res, setRes] = useState<Resultado | null>(null)
  const muda = (p: Partial<typeof f>) => setF(x => ({ ...x, ...p }))

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault()
    const qtd = /^\d+$/.test(f.qtd) ? Number(f.qtd) : 0
    const valor = precoDe(f.valor)
    const fim = f.fim ? fimDoDia(f.fim) : null
    const msg = !prefixoLimpo(f.prefixo) ? 'Informe o prefixo (letras e números).'
      : !(qtd >= 1 && qtd <= TETO_CUPONS) ? `A quantidade vai de 1 a ${TETO_CUPONS}.`
      : valor === null || valor <= 0 ? 'O desconto precisa ser maior que zero.'
      : f.tipo === 'percent' && valor > 100 ? 'Percentual não pode passar de 100.'
      : valor > 99999999.99 ? 'Desconto grande demais.'
      : fim && fim.getTime() <= Date.now() ? 'A data final já passou.' : ''
    setErro(msg)
    if (msg) return
    try {
      const codigos = gerarCodigos(f.prefixo, qtd, existentes)
      setRes(await criar.mutateAsync({
        eventId: eventoDele(eventos, f.eventId),
        cupons: codigos.map(code => ({ code, discount_type: f.tipo, discount_value: valor!, max_uses: 1, valid_until: fim ? fim.toISOString() : null })),
      }))
    } catch { toast.error('Não foi possível criar os cupons. Confira a internet e tente de novo.') }
  }

  return (
    <Dialog open onOpenChange={o => { if (!o && !criar.isPending) onFechar() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar cupons em lote</DialogTitle>
          <DialogDescription>Vários códigos únicos, cada um com um uso só. Mesmo desconto e mesma validade para todos.</DialogDescription>
        </DialogHeader>
        {res ? <Resumo r={res} /> : (
          <form id="form-lote" onSubmit={enviar} className="grid gap-3" noValidate>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="lote-prefixo">Prefixo</Label>
                <Input id="lote-prefixo" className="min-h-11 font-mono uppercase" value={f.prefixo} maxLength={10} autoFocus autoComplete="off" placeholder="Ex.: AMIGOS" onChange={e => muda({ prefixo: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="lote-qtd">Quantidade (até {TETO_CUPONS})</Label>
                <Input id="lote-qtd" className="min-h-11" inputMode="numeric" value={f.qtd} onChange={e => muda({ qtd: e.target.value })} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Exemplo de código: <span className="font-mono">{prefixoLimpo(f.prefixo) || 'AMIGOS'}-K7M2QX</span>. Sem as letras I, L, O e os números 0 e 1, que se confundem.</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="lote-tipo">Tipo</Label>
                <select id="lote-tipo" value={f.tipo} onChange={e => muda({ tipo: e.target.value as CupomCsv['discount_type'] })} className={`${selectNativo} min-h-11`}>
                  <option value="percent">Percentual (%)</option>
                  <option value="fixed">Valor fixo (R$)</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="lote-valor">{f.tipo === 'percent' ? 'Desconto (%)' : 'Desconto (R$)'}</Label>
                <Input id="lote-valor" className="min-h-11" inputMode="decimal" value={f.valor} onChange={e => muda({ valor: e.target.value })} />
              </div>
            </div>
            <SeletorEvento id="lote-evento" valor={f.eventId} onChange={v => muda({ eventId: v })} eventos={eventos} />
            <div className="grid gap-1.5">
              <Label htmlFor="lote-fim">Vale até (opcional)</Label>
              <Input id="lote-fim" className="min-h-11" type="date" value={f.fim} onChange={e => muda({ fim: e.target.value })} />
            </div>
            {erro && <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive"><I.Erro size={14} className="mt-0.5 shrink-0" aria-hidden="true" />{erro}</p>}
          </form>
        )}
        <DialogFooter>
          <Button variant="outline" className="min-h-11" onClick={onFechar} disabled={criar.isPending}>{res ? 'Fechar' : 'Cancelar'}</Button>
          {!res && <Button type="submit" form="form-lote" className="min-h-11" loading={criar.isPending}>Criar cupons</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ImportarCsv({ eventos, existentes, eventoInicial, onFechar }: { eventos: DbEvent[]; existentes: string[]; eventoInicial: string; onFechar: () => void }) {
  const criar = useCreateCouponsBulk()
  const [eventId, setEventId] = useState(eventoInicial)
  const [rel, setRel] = useState<RelatorioCsv | null>(null)
  const [aviso, setAviso] = useState('')
  const [res, setRes] = useState<Resultado | null>(null)

  async function ler(arq: File | undefined) {
    setRel(null); setAviso(''); setRes(null)
    if (!arq) return
    if (arq.size > TAMANHO_MAX) { setAviso('Arquivo grande demais. O limite é 500 linhas.'); return }
    setRel(validarCupons(await arq.text(), existentes))
  }
  async function gravar() {
    if (!rel?.validas.length) return
    try { setRes(await criar.mutateAsync({ cupons: rel.validas, eventId: eventoDele(eventos, eventId) })) }
    catch { toast.error('Não foi possível criar os cupons. Confira a internet e tente de novo.') }
  }

  return (
    <Dialog open onOpenChange={o => { if (!o && !criar.isPending) onFechar() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar cupons de um CSV</DialogTitle>
          <DialogDescription>Colunas: codigo;tipo;valor;usos (opcionais: descricao;validade, como 2026-12-31). Até {TETO_CUPONS} linhas. O separador pode ser ; ou ,. Decimal: use ponto (10.5), ou aspas (\"10,5\") quando o separador for vírgula.</DialogDescription>
        </DialogHeader>
        {res ? <Resumo r={res} /> : (
          <div className="grid gap-3">
            <div><Button variant="outline" size="sm" className="min-h-11" onClick={() => downloadCsv('modelo-cupons.csv', modeloCsv())}><I.Baixar aria-hidden="true" />Baixar o modelo</Button></div>
            <SeletorEvento id="csv-evento" valor={eventId} onChange={setEventId} eventos={eventos} />
            <div className="grid gap-1.5">
              <Label htmlFor="csv-arquivo">Arquivo CSV</Label>
              <Input id="csv-arquivo" className="min-h-11" type="file" accept=".csv,text/csv" onChange={e => { void ler(e.target.files?.[0]) }} />
            </div>
            {aviso && <p role="alert" className="text-sm text-destructive">{aviso}</p>}
            {rel?.geral && <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive"><I.Erro size={14} className="mt-0.5 shrink-0" aria-hidden="true" />{rel.geral}</p>}
            {rel && !rel.geral && (
              <div role="status" className="grid gap-2 rounded-[10px] border border-border bg-card p-3 text-sm">
                <p className="text-foreground">{rel.total} {rel.total === 1 ? 'linha' : 'linhas'}: <strong>{rel.validas.length}</strong> válidas, <strong>{rel.erros.length}</strong> com erro.</p>
                {rel.erros.length > 0 && (
                  <>
                    <p className="text-xs text-muted-foreground">As linhas com erro não serão gravadas.</p>
                    <ul className="max-h-40 overflow-y-auto text-xs text-foreground">
                      {rel.erros.slice(0, 50).map(e => <li key={e.linha}>Linha {e.linha}: {e.motivo}</li>)}
                      {rel.erros.length > 50 && <li>e mais {rel.erros.length - 50} linhas com erro</li>}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" className="min-h-11" onClick={onFechar} disabled={criar.isPending}>{res ? 'Fechar' : 'Cancelar'}</Button>
          {!res && <Button className="min-h-11" onClick={() => { void gravar() }} disabled={!rel?.validas.length} loading={criar.isPending}>{rel?.validas.length ? `Gravar ${rel.validas.length} ${rel.validas.length === 1 ? 'cupom válido' : 'cupons válidos'}` : 'Gravar cupons'}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
