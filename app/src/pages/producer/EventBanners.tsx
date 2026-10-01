import { useState } from 'react'
import {
  ImagePlus, Upload, X, Eye, Trash2, ToggleLeft, ToggleRight, Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import {
  useEventBanners,
  useCreateBanner,
  useUpdateBanner,
  useDeleteBanner,
  type DbBanner,
} from '../../hooks/useProducerTools'

// Só https com domínio; null se inválido
function urlImagem(v: string): string | null {
  try { const u = new URL(v.trim()); if (u.protocol === 'https:' && u.hostname.includes('.')) return v.trim() } catch { /* inválido */ }
  return null
}

const positionLabels: Record<string, string> = {
  hero: 'Capa do Evento',
  top: 'Topo da Pagina',
  inline: 'Entre Conteudos',
}

export default function ProducerEventBanners() {
  const { data: banners = [], isLoading } = useEventBanners()
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

  const addBanner = async () => {
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
      toast.success('Banner criado!')
    } catch {
      toast.error('Erro ao criar banner')
    }
  }

  const toggleActive = async (banner: DbBanner) => {
    try {
      await updateBanner.mutateAsync({ id: banner.id, active: !banner.active })
    } catch {
      toast.error('Erro ao atualizar status')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteBanner.mutateAsync(id)
      toast.success('Banner removido')
    } catch {
      toast.error('Erro ao remover banner')
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 lg:p-10 max-w-6xl mx-auto flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-plum animate-spin mb-4" />
        <p className="text-espresso/70 text-sm">Carregando banners...</p>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Banners</h1>
          <p className="text-sm text-espresso/70 mt-1">Gerencie banners promocionais dos seus eventos</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-5 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all">
          <ImagePlus className="w-4 h-4" /> Novo Banner
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Banners', value: banners.length.toString() },
          { label: 'Ativos', value: banners.filter(b => b.active).length.toString() },
          { label: 'Cliques Totais', value: banners.reduce((s, b) => s + (b.clicks || 0), 0).toString() },
          { label: 'Eventos', value: [...new Set(banners.map(b => b.event_name).filter(Boolean))].length.toString() },
        ].map(k => (
          <div key={k.label} className="p-5 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm text-center">
            <div className="font-serif text-2xl text-plum">{k.value}</div>
            <div className="text-xs text-espresso/70 mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Banners Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {banners.map(banner => (
          <div key={banner.id} className={`rounded-2xl border overflow-hidden transition-all ${banner.active ? 'bg-white/60 border-white/60' : 'bg-espresso/[0.02] border-espresso/5 opacity-60'}`}>
            <div className="relative h-40 bg-canvas overflow-hidden group">
              <img src={banner.image_url || ''} alt={banner.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button onClick={() => setPreviewBanner(banner)} className="p-2 rounded-full bg-white/20 text-white hover:bg-white/40 transition-colors">
                  <Eye className="w-4 h-4" />
                </button>
              </div>
              <div className="absolute top-3 left-3">
                <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${banner.active ? 'bg-green-500 text-white' : 'bg-black/50 text-white'}`}>
                  {banner.active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-medium text-espresso">{banner.name}</h3>
                  <p className="text-[10px] text-espresso/70">{banner.event_name || 'Evento'} · {positionLabels[banner.position]}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => toggleActive(banner)} className="p-1.5 rounded-lg hover:bg-canvas transition-colors" title={banner.active ? 'Desativar' : 'Ativar'}>
                    {banner.active ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4 text-espresso/70" />}
                  </button>
                  <button onClick={() => handleDelete(banner.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-espresso/70 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-espresso/70">
                <span>{banner.clicks || 0} cliques</span>
                <span>{new Date(banner.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {banners.length === 0 && (
        <div className="text-center py-16">
          <ImagePlus className="w-12 h-12 text-espresso/10 mx-auto mb-3" />
          <p className="text-sm text-espresso/70">Nenhum banner encontrado.</p>
          <p className="text-xs text-espresso/70 mt-1">Crie seu primeiro banner promocional.</p>
        </div>
      )}

      {/* New Banner Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 glass-backdrop" onClick={() => setShowForm(false)} />
          <div className="glass-panel relative w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-serif text-xl text-espresso">Novo Banner</h3>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-full hover:bg-canvas text-espresso/70 hover:text-espresso transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <input value={form.eventName} onChange={e => setForm({ ...form, eventName: e.target.value })} placeholder="Nome do evento" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/70 focus:outline-none focus:border-plum/30" />
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nome do banner *" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/70 focus:outline-none focus:border-plum/30" />
              <div>
                <label className="text-xs font-medium text-espresso/70 mb-2 block">Posicao</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(positionLabels).map(([key, label]) => (
                    <button key={key} onClick={() => setForm({ ...form, position: key as DbBanner['position'] })} className={`px-3 py-2 rounded-xl text-[11px] font-medium border transition-all ${form.position === key ? 'bg-plum/10 border-plum/30 text-plum' : 'bg-white/40 border-white/60 text-espresso/70'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="border-2 border-dashed border-espresso/10 rounded-2xl p-8 text-center hover:border-plum/30 transition-colors">
                {previewImage ? (
                  <div className="relative">
                    <img src={previewImage} alt="Preview" onError={() => { setPreviewImage(null); setUrl(''); toast.error('A imagem não carregou. Confira o endereço.') }} className="w-full h-32 object-cover rounded-xl" />
                    <button onClick={() => { setPreviewImage(null); setUrl('') }} aria-label="Trocar imagem" className="absolute top-2 right-2 p-1.5 rounded-full bg-void/60 text-cream hover:bg-void transition-colors"><X className="w-3 h-3" /></button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-full bg-plum/10 flex items-center justify-center mx-auto"><Upload className="w-5 h-5 text-plum" /></div>
                    <p className="text-sm text-espresso/70">Cole o endereço (https://) da imagem</p>
                    <input type="url" aria-label="Endereço da imagem" placeholder="https://..." value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); aplicarUrl() } }} onBlur={aplicarUrl} className="w-full max-w-sm px-4 py-2 bg-white/60 border border-espresso/15 rounded-full text-xs text-espresso placeholder:text-espresso/70 focus:outline-none focus:border-plum/40" />
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="px-5 py-2.5 text-sm text-espresso/70 hover:text-espresso transition-colors">Cancelar</button>
              <button onClick={addBanner} disabled={createBanner.isPending} className="px-6 py-2.5 bg-plum text-cream text-sm rounded-full hover:shadow-glow transition-all disabled:opacity-50">
                {createBanner.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar Banner'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Preview Modal */}
      {previewBanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 glass-backdrop" onClick={() => setPreviewBanner(null)} />
          <div className="glass-panel relative w-full max-w-3xl overflow-hidden">
            <img src={previewBanner.image_url || ''} alt={previewBanner.name} className="w-full max-h-[60vh] object-cover" />
            <div className="p-6">
              <h3 className="font-serif text-xl text-espresso mb-1">{previewBanner.name}</h3>
              <p className="text-sm text-espresso/70">{previewBanner.event_name || 'Evento'} · {positionLabels[previewBanner.position]}</p>
              <div className="flex items-center gap-2 mt-3">
                <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${previewBanner.active ? 'bg-green-100 text-green-600' : 'bg-espresso/10 text-espresso/70'}`}>{previewBanner.active ? 'Ativo' : 'Inativo'}</span>
                <span className="text-[10px] text-espresso/70">{previewBanner.clicks || 0} cliques</span>
              </div>
            </div>
            <button onClick={() => setPreviewBanner(null)} className="absolute top-4 right-4 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </div>
  )
}
