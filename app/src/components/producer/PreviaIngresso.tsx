import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useFeatures } from '../../hooks/useFeatures'
import { mensagemDaLogo, useLogoProdutor } from '../../hooks/useLogoProdutor'
import { corDoEvento } from '../../lib/corEvento'
import { AZUL_EVOKAA, ESTILO_PADRAO, FEATURE_ESTILO, estiloLimpo, estiloParaBanco, type EstiloIngresso } from '../../lib/ingressoEstilo'
import { enviarLogo, prepararLogo } from '../../lib/logoProdutor'
import { supabase } from '../../lib/supabase'
import { Chip, SegmentadoComSetas } from './painel/campos'
import IngressoVisual, { type DadosIngresso, type ModoIngresso } from './IngressoVisual'

export type DadosPrevia = DadosIngresso & { eventoId: string; corEvento: string | null; estilo: EstiloIngresso }

type Corpo = {
  dados: DadosPrevia; tipo: string; pro: boolean
  logoUrl: string | null
  ocupadoLogo: boolean
  onLogo: (f: File) => void
  onTirarLogo: () => void
  salvando: boolean
  onSalvar: (estilo: EstiloIngresso) => void
}

const vazio = (e: EstiloIngresso) => Object.keys(estiloParaBanco(e)).length === 0

// Corpo da prévia, sem consulta ao banco: `pro` diz se "Meu estilo" está liberado (hoje useFeatures libera para todos).
// Salvar vale para o evento inteiro (todos os tipos); a logo é a do produtor e vale para todos os eventos dele.
export function PreviaCorpo({ dados, tipo, pro, logoUrl, ocupadoLogo, onLogo, onTirarLogo, salvando, onSalvar }: Corpo) {
  const [aba, setAba] = useState<'padrao' | 'meu'>(vazio(dados.estilo) ? 'padrao' : 'meu')
  const [modo, setModo] = useState<ModoIngresso>('pdf')
  const [estilo, setEstilo] = useState<EstiloIngresso>(dados.estilo)
  const arquivo = useRef<HTMLInputElement>(null)

  const muda = (p: Partial<EstiloIngresso>) => setEstilo(estiloLimpo({ ...estilo, ...p }))
  const corEvento = corDoEvento({ id: dados.eventoId, accent_color: dados.corEvento })
  const usaEstilo = aba === 'meu' && pro
  const igual = JSON.stringify(estiloParaBanco(usaEstilo ? estilo : ESTILO_PADRAO)) === JSON.stringify(estiloParaBanco(dados.estilo))

  return (
    <div className="grid gap-5 overflow-y-auto px-4 pb-6">
      <SegmentadoComSetas
        label="Como o comprador vê" size="sm" className="w-64" value={modo} onValueChange={v => setModo(v as ModoIngresso)}
        items={[{ value: 'pdf', label: 'PDF e e-mail' }, { value: 'celular', label: 'No celular' }]}
      />

      <IngressoVisual dados={dados} tipo={tipo} estilo={usaEstilo ? estilo : ESTILO_PADRAO} logoUrl={logoUrl} modo={modo} />

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
              <p className="text-muted-foreground">Cor do topo e posição da logo são do plano PRO. Hoje o ingresso sai no modelo padrão.</p>
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
            </>
          )}
        </TabsContent>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled={igual || salvando} loading={salvando} onClick={() => onSalvar(usaEstilo ? estilo : ESTILO_PADRAO)}>
          {usaEstilo ? 'Salvar estilo' : 'Usar o modelo padrão'}
        </Button>
        <span role="status" className="text-xs text-muted-foreground">{igual ? 'É o que está salvo neste evento.' : 'Vale para todos os ingressos deste evento.'}</span>
      </div>

      <div className="grid gap-2 border-t border-border pt-4">
        <p className="text-sm font-medium text-foreground">Logo da produtora</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={ocupadoLogo} onClick={() => arquivo.current?.click()}><I.ImagemMais aria-hidden="true" />{ocupadoLogo ? 'Salvando…' : logoUrl ? 'Trocar logo' : 'Escolher logo'}</Button>
          {logoUrl && <Button type="button" variant="ghost" size="sm" disabled={ocupadoLogo} onClick={onTirarLogo}>Remover</Button>}
          <input
            ref={arquivo} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} aria-label="Arquivo da logo"
            onChange={ev => { const f = ev.target.files?.[0]; ev.target.value = ''; if (f) onLogo(f) }}
          />
        </div>
        <p className="text-xs text-muted-foreground">PNG, JPEG ou WebP, até 5 MB. Salva na hora e vale para todos os seus eventos; também aparece em Configurações &gt; Organizador.</p>
      </div>
    </div>
  )
}

// Só monta quando a folha abre: a consulta do plano e da logo não roda com a folha fechada.
function PreviaLigada({ dados, tipo }: { dados: DadosPrevia; tipo: string }) {
  const { hasFeature } = useFeatures()
  const { user, logo, gravar } = useLogoProdutor()
  const queryClient = useQueryClient()
  const [preparando, setPreparando] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const aoEscolher = async (f: File) => {
    if (!user?.id) return
    setPreparando(true)
    let pronta: Awaited<ReturnType<typeof prepararLogo>> | null = null
    try {
      pronta = await prepararLogo(f)
      await gravar.mutateAsync(await enviarLogo(pronta, user.id))
      toast.success('Logo salva!')
    } catch (e) { toast.error(mensagemDaLogo(e)) } finally {
      if (pronta) URL.revokeObjectURL(pronta.previewUrl)
      setPreparando(false)
    }
  }
  const aoTirar = async () => {
    try { await gravar.mutateAsync(null); toast.success('Logo removida.') } catch (e) { toast.error(mensagemDaLogo(e)) }
  }
  const aoSalvar = async (estilo: EstiloIngresso) => {
    setSalvando(true)
    try {
      // ponytail: os tipos do banco ainda não têm ticket_style; cast até regenerar types/database.ts
      const { data, error } = await supabase.from('events').update({ ticket_style: estiloParaBanco(estilo) } as never).eq('id', dados.eventoId).select('id')
      if (error) throw error
      if (!data?.length) throw new Error('Nenhuma linha atualizada') // RLS: não reportar sucesso sem gravar
      await queryClient.invalidateQueries({ queryKey: ['painel-evento', dados.eventoId] })
      toast.success('Estilo do ingresso salvo.')
    } catch { toast.error('Não foi possível salvar o estilo. Tente de novo.') } finally { setSalvando(false) }
  }

  return (
    <PreviaCorpo
      dados={dados} tipo={tipo} pro={hasFeature(FEATURE_ESTILO)} logoUrl={logo.data ?? null}
      ocupadoLogo={preparando || gravar.isPending} onLogo={f => void aoEscolher(f)} onTirarLogo={() => void aoTirar()}
      salvando={salvando} onSalvar={e => void aoSalvar(e)}
    />
  )
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
          <PreviaLigada dados={dados} tipo={tipo} />
        </SheetContent>
      </Sheet>
    </>
  )
}
