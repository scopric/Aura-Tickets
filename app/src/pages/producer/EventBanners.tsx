import { useState } from 'react'
import * as I from '@/components/icones/evokaa16'
import { toast } from 'sonner'
import {
  useEventBanners,
  useCreateBanner,
  useUpdateBanner,
  useDeleteBanner,
  type DbBanner,
} from '../../hooks/useProducerTools'
import { PageHeader, Stat, EmptyState } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// Só https com domínio; null se inválido
function urlImagem(v: string): string | null {
  try { const u = new URL(v.trim()); if (u.protocol === 'https:' && u.hostname.includes('.')) return v.trim() } catch { /* inválido */ }
  return null
}

const positionLabels: Record<string, string> = {
  hero: 'Capa do evento',
  top: 'Topo da página',
  inline: 'Entre conteúdos',
}

const icone = 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'

export default function ProducerEventBanners() {
  const { data: banners = [], isLoading, isError, refetch, isFetching } = useEventBanners()
  const createBanner = useCreateBanner()
  const updateBanner = useUpdateBanner()
  const deleteBanner = useDeleteBanner()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ eventName: '', name: '', position: 'hero' as DbBanner['position'] })
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [url, setUrl] = useState('')
  const [previewBanner, setPreviewBanner] = useState<DbBanner | null>(null)

  // a imagem entra no blur, no Enter ou no salvar (validada aqui também)
  const aplicarUrl = () => {
    if (!url.trim()) return
    const ok = urlImagem(url)
    if (ok) setPreviewImage(ok)
    else toast.error('Use um endereço de imagem que comece com https://')
  }

  const addBanner = async (e: React.FormEvent) => {
    e.preventDefault()
    const imagem = previewImage ?? urlImagem(url)
    if (!form.name.trim()) { toast.error('Preencha o nome do banner'); return }
    if (!imagem) { toast.error('Cole o endereço (https://) da imagem'); return }
    try {
      await createBanner.mutateAsync({
        event_name: form.eventName || null,
        name: form.name,
        image_url: imagem,
        position: form.position,
        active: true,
        clicks: 0,
      })
      setForm({ eventName: '', name: '', position: 'hero' })
      setPreviewImage(null)
      setUrl('')
      setShowForm(false)
      toast.success('Banner criado.')
    } catch {
      toast.error('Não foi possível criar o banner.')
    }
  }

  const toggleActive = async (banner: DbBanner) => {
    try {
      await updateBanner.mutateAsync({ id: banner.id, active: !banner.active })
    } catch {
      toast.error('Não foi possível atualizar o status.')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir este banner?')) return
    try {
      await deleteBanner.mutateAsync(id)
      toast.success('Banner removido.')
    } catch {
      toast.error('Não foi possível remover o banner.')
    }
  }

  const header = (
    <PageHeader
      title="Banners"
      description="Banners promocionais dos seus eventos"
      actions={<Button onClick={() => setShowForm(true)}><I.ImagemMais aria-hidden="true" />Novo banner</Button>}
    />
  )

  if (isLoading) {
    return (
      <div aria-busy="true">
        {header}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map(n => <Skeleton key={n} className="h-[92px] rounded-[10px] bg-muted" />)}
        </div>
        <Skeleton className="mt-6 h-56 rounded-[10px] bg-muted" />
      </div>
    )
  }

  if (isError) {
    return (
      <div>
        {header}
        <div role="alert" className="flex flex-col gap-3 rounded-[10px] border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground">Não foi possível carregar os banners.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? 'Carregando…' : 'Tentar de novo'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {header}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Banners" value={banners.length} />
        <Stat label="Ativos" value={banners.filter(b => b.active).length} />
        <Stat label="Cliques" value={banners.reduce((s, b) => s + (b.clicks || 0), 0)} />
        <Stat label="Eventos" value={[...new Set(banners.map(b => b.event_name).filter(Boolean))].length} />
      </div>

      <div className="mt-6">
        {banners.length === 0 ? (
          <EmptyState
            title="Nenhum banner ainda"
            description="Crie o primeiro banner promocional."
            action={<Button onClick={() => setShowForm(true)}><I.ImagemMais aria-hidden="true" />Novo banner</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {banners.map(banner => (
              <div key={banner.id} className="overflow-hidden rounded-[10px] border border-border bg-card">
                <div className={`relative h-40 bg-muted ${banner.active ? '' : 'opacity-60'}`}>
                  <img src={banner.image_url || ''} alt={banner.name} className="size-full object-cover" />
                  <Badge variant={banner.active ? 'default' : 'secondary'} className="absolute left-3 top-3">{banner.active ? 'Ativo' : 'Inativo'}</Badge>
                </div>
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-medium text-foreground">{banner.name}</h2>
                    <p className="truncate text-xs text-muted-foreground">{banner.event_name || 'Sem evento'} · {positionLabels[banner.position]}</p>
                    <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                      {banner.clicks || 0} cliques · {new Date(banner.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Switch checked={banner.active} onCheckedChange={() => toggleActive(banner)} aria-label={banner.active ? `Desativar ${banner.name}` : `Ativar ${banner.name}`} className="mr-1" />
                    <Button variant="ghost" size="icon-sm" className={icone} onClick={() => setPreviewBanner(banner)} aria-label={`Ver ${banner.name}`}>
                      <I.Olho aria-hidden="true" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" className={icone} onClick={() => handleDelete(banner.id)} aria-label={`Remover ${banner.name}`}>
                      <I.Lixeira aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo banner</DialogTitle>
            <DialogDescription>Cole o endereço (https://) de uma imagem já publicada.</DialogDescription>
          </DialogHeader>
          <form id="form-banner" onSubmit={addBanner} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="banner-nome">Nome do banner</Label>
              <Input id="banner-nome" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="banner-evento">Nome do evento (opcional)</Label>
              <Input id="banner-evento" value={form.eventName} onChange={e => setForm({ ...form, eventName: e.target.value })} />
            </div>
            <div role="group" aria-label="Posição" className="grid gap-1.5">
              <span className="text-sm font-medium text-foreground">Posição</span>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(positionLabels).map(([key, label]) => (
                  <Button key={key} type="button" aria-pressed={form.position === key} variant={form.position === key ? 'secondary' : 'outline'} size="sm" onClick={() => setForm({ ...form, position: key as DbBanner['position'] })} className="h-auto whitespace-normal py-2 text-xs">
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={previewImage ? undefined : 'banner-url'}>Endereço da imagem</Label>
              {previewImage ? (
                <div className="relative">
                  <img src={previewImage} alt="Prévia do banner" onError={() => { setPreviewImage(null); setUrl(''); toast.error('A imagem não carregou. Confira o endereço.') }} className="h-32 w-full rounded-md border border-border object-cover" />
                  <Button type="button" variant="secondary" size="icon-sm" onClick={() => { setPreviewImage(null); setUrl('') }} aria-label="Trocar imagem" className="absolute right-2 top-2">
                    <I.Fechar aria-hidden="true" />
                  </Button>
                </div>
              ) : (
                <Input id="banner-url" type="url" placeholder="https://" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); aplicarUrl() } }} onBlur={aplicarUrl} />
              )}
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button type="submit" form="form-banner" loading={createBanner.isPending}>
              Criar banner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewBanner} onOpenChange={aberto => { if (!aberto) setPreviewBanner(null) }}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-3xl">
          {previewBanner && (
            <>
              <img src={previewBanner.image_url || ''} alt={previewBanner.name} className="max-h-[60vh] w-full object-cover" />
              <DialogHeader className="p-6 pt-0">
                <DialogTitle>{previewBanner.name}</DialogTitle>
                <DialogDescription>
                  {previewBanner.event_name || 'Sem evento'} · {positionLabels[previewBanner.position]} · {previewBanner.active ? 'Ativo' : 'Inativo'} · {previewBanner.clicks || 0} cliques
                </DialogDescription>
              </DialogHeader>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
