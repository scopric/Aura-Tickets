import { useState } from 'react'
import { ImagePlus, X, Grid3X3, List, Trash2, Copy, Star, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  useEventPhotos,
  useCreatePhoto,
  useUpdatePhoto,
  useDeletePhoto,
  type DbPhoto,
} from '../../hooks/useProducerTools'
import { PageHeader, EmptyState } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// Só https com domínio; null se inválido
function urlImagem(v: string): string | null {
  try { const u = new URL(v.trim()); if (u.protocol === 'https:' && u.hostname.includes('.')) return v.trim() } catch { /* inválido */ }
  return null
}

const icone = 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
const dataCurta = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })

export default function ProducerEventGallery() {
  const { data: photos = [], isLoading } = useEventPhotos()
  const createPhoto = useCreatePhoto()
  const updatePhoto = useUpdatePhoto()
  const deletePhoto = useDeletePhoto()

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [uploadForm, setUploadForm] = useState({ eventName: '', caption: '', featured: false })
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [url, setUrl] = useState('')

  const events = [...new Set(photos.map(p => p.event_name).filter(Boolean))] as string[]
  const [activeEvent, setActiveEvent] = useState('Todos')

  const filtered = activeEvent === 'Todos' ? photos : photos.filter(p => p.event_name === activeEvent)
  const selectedPhoto = photos.find(p => p.id === selectedId) ?? null

  // a imagem entra no blur, no Enter ou no salvar (validada aqui também)
  const aplicarUrl = () => {
    if (!url.trim()) return
    const ok = urlImagem(url)
    if (ok) setUploadPreview(ok)
    else toast.error('Use um endereço de imagem que comece com https://')
  }

  const addPhoto = async (e: React.FormEvent) => {
    e.preventDefault()
    const imagem = uploadPreview ?? urlImagem(url)
    if (!imagem) { toast.error('Cole o endereço (https://) da imagem'); return }
    try {
      await createPhoto.mutateAsync({
        event_name: uploadForm.eventName || null,
        url: imagem,
        caption: uploadForm.caption || null,
        featured: uploadForm.featured,
        size: null, // tamanho desconhecido (imagem por endereço)
      })
      setUploadForm({ eventName: '', caption: '', featured: false })
      setUploadPreview(null)
      setUrl('')
      setShowUpload(false)
      toast.success('Foto adicionada.')
    } catch {
      toast.error('Não foi possível adicionar a foto.')
    }
  }

  const toggleFeatured = async (photo: DbPhoto) => {
    try {
      await updatePhoto.mutateAsync({ id: photo.id, featured: !photo.featured })
    } catch {
      toast.error('Não foi possível atualizar o destaque.')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Apagar esta foto da galeria?')) return
    try {
      await deletePhoto.mutateAsync(id)
      setSelectedId(null)
      toast.success('Foto removida.')
    } catch {
      toast.error('Não foi possível remover a foto.')
    }
  }

  const header = (
    <PageHeader
      title="Galeria de fotos"
      description="Fotos dos seus eventos"
      actions={
        <>
          <div role="group" aria-label="Visualização" className="flex rounded-md border border-border p-0.5">
            <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon-sm" className={viewMode === 'grid' ? '' : icone} aria-pressed={viewMode === 'grid'} aria-label="Ver em grade" onClick={() => setViewMode('grid')}>
              <Grid3X3 aria-hidden="true" />
            </Button>
            <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon-sm" className={viewMode === 'list' ? '' : icone} aria-pressed={viewMode === 'list'} aria-label="Ver em lista" onClick={() => setViewMode('list')}>
              <List aria-hidden="true" />
            </Button>
          </div>
          <Button onClick={() => setShowUpload(true)}><ImagePlus aria-hidden="true" />Adicionar foto</Button>
        </>
      }
    />
  )

  if (isLoading) {
    return (
      <div aria-busy="true">
        {header}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map(n => <Skeleton key={n} className="aspect-square rounded-[10px] bg-muted" />)}
        </div>
      </div>
    )
  }

  return (
    <div>
      {header}

      {photos.length > 0 && (
        <div role="group" aria-label="Filtrar por evento" className="mb-4 flex gap-1 overflow-x-auto pb-1">
          {['Todos', ...events].map(e => (
            <Button key={e} size="sm" variant={activeEvent === e ? 'secondary' : 'ghost'} aria-pressed={activeEvent === e} onClick={() => setActiveEvent(e)} className={`shrink-0 ${activeEvent === e ? '' : icone}`}>
              {e} <span className="tabular-nums text-muted-foreground">{e === 'Todos' ? photos.length : photos.filter(p => p.event_name === e).length}</span>
            </Button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhuma foto ainda"
          description="Adicione a primeira foto da galeria."
          action={<Button onClick={() => setShowUpload(true)}><ImagePlus aria-hidden="true" />Adicionar foto</Button>}
        />
      ) : viewMode === 'grid' ? (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map(photo => (
            <li key={photo.id} className={`relative overflow-hidden rounded-[10px] border bg-card ${photo.featured ? 'border-primary' : 'border-border'}`}>
              <button type="button" onClick={() => setSelectedId(photo.id)} aria-label={`Abrir ${photo.caption || 'foto sem legenda'}`} className="block aspect-square w-full bg-muted">
                <img src={photo.url} alt="" className="size-full object-cover" />
              </button>
              <div className="flex items-center justify-between gap-1 p-2">
                <span className="min-w-0 truncate text-xs text-muted-foreground">{photo.caption || 'Sem legenda'}</span>
                <Button variant="ghost" size="icon-sm" className={icone} onClick={() => handleDelete(photo.id)} aria-label={`Apagar ${photo.caption || 'foto sem legenda'}`}>
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
              {photo.featured && <Badge className="absolute right-2 top-2">Destaque</Badge>}
            </li>
          ))}
        </ul>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-[10px] border border-border bg-card">
          {filtered.map(photo => (
            <li key={photo.id} className="flex items-center gap-3 p-3">
              <button type="button" onClick={() => setSelectedId(photo.id)} aria-label={`Abrir ${photo.caption || 'foto sem legenda'}`} className="size-14 shrink-0 overflow-hidden rounded-md bg-muted">
                <img src={photo.url} alt="" className="size-full object-cover" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{photo.caption || 'Sem legenda'}</span>
                  {photo.featured && <Badge>Destaque</Badge>}
                </p>
                <p className="truncate text-xs text-muted-foreground">{photo.event_name || 'Sem evento'} · {dataCurta(photo.created_at)}{photo.size ? ` · ${photo.size}` : ''}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="icon-sm" className={photo.featured ? 'text-primary hover:bg-foreground/5' : icone} aria-pressed={photo.featured} onClick={() => toggleFeatured(photo)} aria-label={photo.featured ? 'Tirar destaque' : 'Destacar'}>
                  <Star aria-hidden="true" />
                </Button>
                <Button variant="ghost" size="icon-sm" className={icone} onClick={() => handleDelete(photo.id)} aria-label={`Apagar ${photo.caption || 'foto sem legenda'}`}>
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar foto</DialogTitle>
            <DialogDescription>Cole o endereço (https://) de uma imagem já publicada.</DialogDescription>
          </DialogHeader>
          <form id="form-foto" onSubmit={addPhoto} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="foto-url">Endereço da imagem</Label>
              {uploadPreview ? (
                <div className="relative">
                  <img src={uploadPreview} alt="Prévia da foto" onError={() => { setUploadPreview(null); setUrl(''); toast.error('A imagem não carregou. Confira o endereço.') }} className="h-40 w-full rounded-md border border-border object-cover" />
                  <Button type="button" variant="secondary" size="icon-sm" onClick={() => { setUploadPreview(null); setUrl('') }} aria-label="Trocar imagem" className="absolute right-2 top-2">
                    <X aria-hidden="true" />
                  </Button>
                </div>
              ) : (
                <Input id="foto-url" type="url" placeholder="https://" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); aplicarUrl() } }} onBlur={aplicarUrl} />
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="foto-evento">Nome do evento (opcional)</Label>
              <Input id="foto-evento" value={uploadForm.eventName} onChange={e => setUploadForm({ ...uploadForm, eventName: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="foto-legenda">Legenda (opcional)</Label>
              <Input id="foto-legenda" value={uploadForm.caption} onChange={e => setUploadForm({ ...uploadForm, caption: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="foto-destaque" checked={uploadForm.featured} onCheckedChange={v => setUploadForm({ ...uploadForm, featured: v === true })} />
              <Label htmlFor="foto-destaque" className="font-normal">Destacar esta foto</Label>
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpload(false)}>Cancelar</Button>
            <Button type="submit" form="form-foto" disabled={createPhoto.isPending}>
              {createPhoto.isPending ? <><Loader2 className="animate-spin" aria-hidden="true" />Adicionando…</> : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedPhoto} onOpenChange={aberto => { if (!aberto) setSelectedId(null) }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-3xl">
          {selectedPhoto && (
            <>
              <img src={selectedPhoto.url} alt={selectedPhoto.caption || ''} className="max-h-[50vh] w-full object-cover" />
              <div className="flex flex-col gap-3 p-6 pt-0 sm:flex-row sm:items-start sm:justify-between">
                <DialogHeader>
                  <DialogTitle>{selectedPhoto.caption || 'Sem legenda'}</DialogTitle>
                  <DialogDescription>
                    {selectedPhoto.event_name || 'Sem evento'} · {dataCurta(selectedPhoto.created_at)}{selectedPhoto.size ? ` · ${selectedPhoto.size}` : ''}
                  </DialogDescription>
                </DialogHeader>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="outline" size="sm" aria-pressed={selectedPhoto.featured} onClick={() => toggleFeatured(selectedPhoto)}>
                    <Star aria-hidden="true" />{selectedPhoto.featured ? 'Tirar destaque' : 'Destacar'}
                  </Button>
                  <Button variant="ghost" size="icon-sm" className={icone} onClick={() => { navigator.clipboard.writeText(selectedPhoto.url); toast.success('Endereço copiado.') }} aria-label="Copiar endereço da imagem">
                    <Copy aria-hidden="true" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" className={icone} onClick={() => handleDelete(selectedPhoto.id)} aria-label="Apagar foto">
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
