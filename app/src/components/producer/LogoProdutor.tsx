import { useId, useState } from 'react'
import { toast } from 'sonner'
import { Upload } from 'lucide-react'
import { enviarLogo, prepararLogo } from '../../lib/logoProdutor'
import { mensagemDaLogo, useLogoProdutor } from '../../hooks/useLogoProdutor'
import { SectionTitle } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

// Logo do organizador (Configurações > Organizador). Salva na hora: envia o arquivo e grava producer_profiles.logo_url.
// Guardada para planilhas, PDFs, ingressos e e-mails (ainda sem consumidor); não aparece na página pública do evento.
export default function LogoProdutor() {
  const { user, logo, gravar } = useLogoProdutor()
  const id = useId()
  const [preparando, setPreparando] = useState(false)

  async function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    e.target.value = '' // deixa escolher o mesmo arquivo de novo
    if (!arquivo || !user?.id) return
    setPreparando(true)
    let pronta: Awaited<ReturnType<typeof prepararLogo>> | null = null
    try {
      pronta = await prepararLogo(arquivo)
      await gravar.mutateAsync(await enviarLogo(pronta, user.id))
      toast.success('Logo salva!')
    } catch (err) {
      toast.error(mensagemDaLogo(err))
    } finally {
      if (pronta) URL.revokeObjectURL(pronta.previewUrl)
      setPreparando(false)
    }
  }

  async function remover() {
    try { await gravar.mutateAsync(null); toast.success('Logo removida.') } catch { toast.error('Não foi possível remover a logo.') }
  }

  const ocupado = preparando || gravar.isPending
  return (
    <section aria-labelledby={`${id}-t`} className="mb-6 space-y-4 rounded-[10px] border border-border bg-card p-4 sm:p-6">
      <SectionTitle id={`${id}-t`}>Logo do organizador</SectionTitle>
      {logo.isPending ? (
        <Skeleton aria-busy="true" className="h-24 rounded-[10px] bg-muted" />
      ) : logo.isError ? (
        <p role="alert" className="text-sm text-muted-foreground">A logo ainda não está disponível para a sua conta. Tente de novo mais tarde.</p>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex size-24 shrink-0 items-center justify-center rounded-[10px] border border-border bg-muted/40 p-2">
            {logo.data
              ? <img src={logo.data} alt="Logo atual do organizador" className="max-h-full max-w-full object-contain" />
              : <span className="text-center text-xs text-muted-foreground">Sem logo</span>}
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline">
                <label className="cursor-pointer has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50">
                  <Upload aria-hidden="true" />{preparando ? 'Preparando…' : logo.data ? 'Trocar a logo' : 'Escolher a logo'}
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={escolher} disabled={ocupado} className="sr-only" />
                </label>
              </Button>
              {logo.data && <Button type="button" variant="ghost" onClick={remover} disabled={ocupado}>Remover a logo</Button>}
            </div>
            <p className="text-xs text-muted-foreground">PNG com fundo transparente fica melhor. Até 5 MB; reduzimos para 512 px e apagamos os dados de localização da imagem.</p>
            <p className="text-xs text-muted-foreground">Vamos usar nas suas planilhas, PDFs, ingressos e e-mails; por enquanto ela só fica guardada. Não aparece na página pública do evento.</p>
          </div>
        </div>
      )}
    </section>
  )
}
