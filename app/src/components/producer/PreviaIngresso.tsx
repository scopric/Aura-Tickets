import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useFeatures } from '../../hooks/useFeatures'
import { corDoEvento } from '../../lib/corEvento'
import { AZUL_EVOKAA, ESTILO_PADRAO, FEATURE_ESTILO, RODAPE_MAX, estiloLimpo, prepararLogo, type EstiloIngresso } from '../../lib/ingressoEstilo'
import { Chip, SegmentadoComSetas } from './painel/campos'
import IngressoVisual, { type DadosIngresso, type ModoIngresso } from './IngressoVisual'

export type DadosPrevia = DadosIngresso & { eventoId: string; corEvento: string | null }

// Corpo da prévia, sem consulta ao banco: `pro` diz se "Meu estilo" está liberado (hoje useFeatures libera para todos).
export function PreviaCorpo({ dados, tipo, pro }: { dados: DadosPrevia; tipo: string; pro: boolean }) {
  const [aba, setAba] = useState<'padrao' | 'meu'>('padrao')
  const [modo, setModo] = useState<ModoIngresso>('pdf')
  const [estilo, setEstilo] = useState<EstiloIngresso>(ESTILO_PADRAO)
  const [logo, setLogo] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const arquivo = useRef<HTMLInputElement>(null)
  const logoAtual = useRef<string | null>(null)
  const pedido = useRef(0) // escolha mais nova vale; o desmonte invalida as em andamento
  useEffect(() => () => { pedido.current = -1; if (logoAtual.current) URL.revokeObjectURL(logoAtual.current) }, [])

  const escolher = async (f: File | undefined) => {
    if (!f) return
    setErro('')
    const meu = ++pedido.current
    try {
      const url = await prepararLogo(f)
      if (pedido.current !== meu) { URL.revokeObjectURL(url); return } // folha fechada ou escolha mais nova
      if (logoAtual.current) URL.revokeObjectURL(logoAtual.current)
      logoAtual.current = url; setLogo(url)
    } catch (e) { if (pedido.current === meu) setErro((e as Error).message) }
    if (arquivo.current) arquivo.current.value = ''
  }
  const tirar = () => { pedido.current++; if (logoAtual.current) URL.revokeObjectURL(logoAtual.current); logoAtual.current = null; setLogo(null); setErro('') }
  const muda = (p: Partial<EstiloIngresso>) => setEstilo(estiloLimpo({ ...estilo, ...p }))
  const corEvento = corDoEvento({ id: dados.eventoId, accent_color: dados.corEvento })
  const usaEstilo = aba === 'meu' && pro

  return (
    <div className="grid gap-5 overflow-y-auto px-4 pb-6">
      <SegmentadoComSetas
        label="Como o comprador vê" size="sm" className="w-64" value={modo} onValueChange={v => setModo(v as ModoIngresso)}
        items={[{ value: 'pdf', label: 'PDF e e-mail' }, { value: 'celular', label: 'No celular' }]}
      />

      <IngressoVisual dados={dados} tipo={tipo} estilo={usaEstilo ? estilo : ESTILO_PADRAO} logoUrl={logo} modo={modo} />

      <Tabs value={aba} onValueChange={v => setAba(v as 'padrao' | 'meu')}>
        <TabsList>
          <TabsTrigger value="padrao">Modelo Evokaa</TabsTrigger>
          <TabsTrigger value="meu">Meu estilo <span className="ml-1.5 rounded-full bg-[var(--ev-brand-soft)] px-1.5 text-[11px] font-semibold text-primary">PRO</span></TabsTrigger>
        </TabsList>
        <TabsContent value="padrao" className="pt-3 text-sm text-muted-foreground">
          O modelo padrão: topo azul da Evokaa, sua logo e o selo Evokaa no rodapé. Vale para todos os planos.
        </TabsContent>
        <TabsContent value="meu" className="grid gap-4 pt-3">
          {!pro ? (
            <div role="note" className="flex flex-col gap-3 rounded-[10px] bg-secondary px-4 py-3 text-sm">
              <p className="text-muted-foreground">Cor, rodapé e posição da logo são do plano PRO. Hoje o ingresso sai no modelo padrão.</p>
              <Button asChild variant="outline" size="sm" className="w-fit"><Link to="/producer/assinatura">Conhecer o PRO</Link></Button>
            </div>
          ) : (
            <>
              <div className="grid gap-1.5">
                <span id="cor-ing" className="text-sm font-medium text-foreground">Cor do topo</span>
                <div role="group" aria-labelledby="cor-ing" className="flex flex-wrap items-center gap-2">
                  <Chip ativo={estilo.cor === null} onClick={() => muda({ cor: null })}>Azul Evokaa</Chip>
                  <Chip ativo={estilo.cor?.toLowerCase() === corEvento.toLowerCase()} onClick={() => muda({ cor: corEvento })}>Cor do evento</Chip>
                  <label className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
                    Outra
                    <input type="color" aria-label="Escolher outra cor" value={estilo.cor ?? AZUL_EVOKAA} onChange={ev => muda({ cor: ev.target.value })} className="alvo-44 h-8 w-10 cursor-pointer rounded border border-input bg-transparent p-0.5" />
                  </label>
                </div>
              </div>
              <div className="grid gap-1.5">
                <span aria-hidden="true" className="text-sm font-medium text-foreground">Posição da logo</span>
                <SegmentadoComSetas
                  label="Posição da logo" size="sm" className="w-56" value={estilo.logo} onValueChange={v => muda({ logo: v as EstiloIngresso['logo'] })}
                  items={[{ value: 'esquerda', label: 'Esquerda' }, { value: 'centro', label: 'Centro' }]}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="rodape-ing">Rodapé (opcional)</Label>
                <Input id="rodape-ing" maxLength={RODAPE_MAX} value={estilo.rodape} onChange={ev => muda({ rodape: ev.target.value })} aria-describedby="rodape-ing-n" />
                <p id="rodape-ing-n" className="text-xs tabular-nums text-muted-foreground">{estilo.rodape.length} de {RODAPE_MAX}</p>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      <div className="grid gap-2 border-t border-border pt-4">
        <p className="text-sm font-medium text-foreground">Logo da produtora</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => arquivo.current?.click()}><I.ImagemMais aria-hidden="true" />{logo ? 'Trocar logo' : 'Escolher logo'}</Button>
          {logo && <Button type="button" variant="ghost" size="sm" onClick={tirar}>Remover</Button>}
          <input ref={arquivo} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} aria-label="Arquivo da logo" onChange={ev => void escolher(ev.target.files?.[0])} />
        </div>
        <p className="text-xs text-muted-foreground">PNG, JPEG ou WebP, até 5 MB. Nesta versão a logo só aparece na prévia; ainda não fica salva.</p>
        {erro && <p role="alert" className="flex items-start gap-1.5 text-xs text-destructive"><I.Erro size={14} className="mt-px shrink-0" aria-hidden="true" />{erro}</p>}
      </div>
    </div>
  )
}

// Só monta quando a folha abre: a consulta do plano não roda com a folha fechada.
function PreviaDoPlano({ dados, tipo }: { dados: DadosPrevia; tipo: string }) {
  // ponytail: hasFeature hoje libera tudo e ignora isLoading; quando a cobrança entrar, travar enquanto `isLoading`.
  const { hasFeature } = useFeatures()
  return <PreviaCorpo dados={dados} tipo={tipo} pro={hasFeature(FEATURE_ESTILO)} />
}

export default function BotaoPrevia({ dados, tipo }: { dados: DadosPrevia; tipo: string }) {
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setAberto(true)}><I.Olho aria-hidden="true" />Prévia</Button>
      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetContent className="w-full gap-0 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Prévia do ingresso</SheetTitle>
            <SheetDescription>Como o comprador recebe. Portador e QR são de exemplo.</SheetDescription>
          </SheetHeader>
          <PreviaDoPlano dados={dados} tipo={tipo} />
        </SheetContent>
      </Sheet>
    </>
  )
}
