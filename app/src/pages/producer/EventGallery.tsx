import { useState } from 'react'
import {
  ImagePlus, Upload, X, Grid3X3, List, Heart, MessageCircle,
  Trash2, Download, Eye, Check
} from 'lucide-react'
import { toast } from 'sonner'

interface GalleryPhoto {
  id: string
  eventName: string
  url: string
  caption: string
  likes: number
  comments: number
  featured: boolean
  uploadedAt: string
  size: string
}

const mockPhotos: GalleryPhoto[] = [
  { id: 'g1', eventName: 'Noite Eletro 2025', url: '/images/concert-1.jpg', caption: 'Abertura do palco principal', likes: 47, comments: 12, featured: true, uploadedAt: '15 Mai 2025', size: '2.4MB' },
  { id: 'g2', eventName: 'Noite Eletro 2025', url: '/images/concert-2.jpg', caption: 'DJ set principal', likes: 63, comments: 8, featured: false, uploadedAt: '15 Mai 2025', size: '1.8MB' },
  { id: 'g3', eventName: 'Noite Eletro 2025', url: '/images/concert-3.jpg', caption: 'Publico animado', likes: 89, comments: 23, featured: false, uploadedAt: '16 Mai 2025', size: '3.1MB' },
  { id: 'g4', eventName: 'Noite Eletro 2025', url: '/images/event-card-1.jpg', caption: 'Area VIP', likes: 34, comments: 5, featured: false, uploadedAt: '16 Mai 2025', size: '1.2MB' },
  { id: 'g5', eventName: 'Noite Eletro 2025', url: '/images/event-card-2.jpg', caption: 'Decoracao de luzes', likes: 56, comments: 9, featured: true, uploadedAt: '14 Mai 2025', size: '2.0MB' },
  { id: 'g6', eventName: 'Jazz Sunset Session', url: '/images/concert-1.jpg', caption: 'Pôr do sol', likes: 112, comments: 31, featured: true, uploadedAt: '22 Mai 2025', size: '2.7MB' },
]

export default function ProducerEventGallery() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>(mockPhotos)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedPhoto, setSelectedPhoto] = useState<GalleryPhoto | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [uploadForm, setUploadForm] = useState({ eventName: '', caption: '', featured: false })
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)

  const events = [...new Set(photos.map(p => p.eventName))]
  const [activeEvent, setActiveEvent] = useState('Todos')

  const filtered = activeEvent === 'Todos' ? photos : photos.filter(p => p.eventName === activeEvent)

  const addPhoto = () => {
    if (!uploadPreview) { toast.error('Selecione uma imagem'); return }
    const newPhoto: GalleryPhoto = {
      id: `g${Date.now()}`,
      eventName: uploadForm.eventName || 'Evento Geral',
      url: uploadPreview,
      caption: uploadForm.caption || 'Sem legenda',
      likes: 0,
      comments: 0,
      featured: uploadForm.featured,
      uploadedAt: 'Hoje',
      size: '1.5MB',
    }
    setPhotos([newPhoto, ...photos])
    setUploadForm({ eventName: '', caption: '', featured: false })
    setUploadPreview(null)
    setShowUpload(false)
    toast.success('Foto adicionada!')
  }

  const toggleFeatured = (id: string) => {
    setPhotos(photos.map(p => p.id === id ? { ...p, featured: !p.featured } : p))
  }

  const deletePhoto = (id: string) => {
    setPhotos(photos.filter(p => p.id !== id))
    setSelectedPhoto(null)
    toast.success('Foto removida')
  }

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Galeria de Fotos</h1>
          <p className="text-sm text-espresso/50 mt-1">Gerencie as fotos dos seus eventos</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white/60 border border-white/60 rounded-full p-1">
            <button onClick={() => setViewMode('grid')} className={`p-2 rounded-full transition-all ${viewMode === 'grid' ? 'bg-plum text-cream' : 'text-espresso/30 hover:text-espresso/60'}`}>
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('list')} className={`p-2 rounded-full transition-all ${viewMode === 'list' ? 'bg-plum text-cream' : 'text-espresso/30 hover:text-espresso/60'}`}>
              <List className="w-4 h-4" />
            </button>
          </div>
          <button onClick={() => setShowUpload(true)} className="flex items-center gap-2 px-5 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all">
            <ImagePlus className="w-4 h-4" /> Adicionar Fotos
          </button>
        </div>
      </div>

      {/* Event filter */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        <button onClick={() => setActiveEvent('Todos')} className={`px-4 py-2 rounded-full text-xs font-medium transition-all flex-shrink-0 ${activeEvent === 'Todos' ? 'bg-plum text-cream' : 'bg-white/40 border border-white/60 text-espresso/50 hover:text-espresso/70'}`}>
          Todos ({photos.length})
        </button>
        {events.map(e => (
          <button key={e} onClick={() => setActiveEvent(e)} className={`px-4 py-2 rounded-full text-xs font-medium transition-all flex-shrink-0 ${activeEvent === e ? 'bg-plum text-cream' : 'bg-white/40 border border-white/60 text-espresso/50 hover:text-espresso/70'}`}>
            {e} ({photos.filter(p => p.eventName === e).length})
          </button>
        ))}
      </div>

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(photo => (
            <div key={photo.id} className={`group relative rounded-2xl overflow-hidden cursor-pointer transition-all hover:shadow-lg ${photo.featured ? 'ring-2 ring-plum ring-offset-2' : ''}`}
              onClick={() => setSelectedPhoto(photo)}>
              <div className="aspect-square bg-canvas">
                <img src={photo.url} alt={photo.caption} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-xs text-white font-medium truncate">{photo.caption}</p>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-white/60">
                    <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {photo.likes}</span>
                    <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {photo.comments}</span>
                  </div>
                </div>
              </div>
              {photo.featured && (
                <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-plum/90 text-white text-[9px] font-medium rounded-md">Destaque</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {filtered.map(photo => (
            <div key={photo.id} className={`flex items-center gap-4 p-4 rounded-2xl bg-white/60 border transition-all hover:bg-white/80 ${photo.featured ? 'border-plum/20' : 'border-white/60'}`}>
              <div className="w-16 h-16 rounded-xl bg-canvas overflow-hidden flex-shrink-0 cursor-pointer" onClick={() => setSelectedPhoto(photo)}>
                <img src={photo.url} alt={photo.caption} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-espresso truncate">{photo.caption}</h3>
                <p className="text-[10px] text-espresso/30">{photo.eventName} · {photo.uploadedAt} · {photo.size}</p>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-espresso/30">
                  <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {photo.likes}</span>
                  <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {photo.comments}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => toggleFeatured(photo.id)} className={`p-2 rounded-lg transition-colors ${photo.featured ? 'text-plum bg-plum/10' : 'text-espresso/20 hover:text-amber-500 hover:bg-amber-50'}`} title={photo.featured ? 'Remover destaque' : 'Destacar'}>
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => { setSelectedPhoto(photo) }} className="p-2 rounded-lg hover:bg-canvas text-espresso/20 hover:text-espresso/60 transition-colors">
                  <Eye className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => deletePhoto(photo.id)} className="p-2 rounded-lg hover:bg-red-50 text-espresso/20 hover:text-red-500 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-espresso/20 backdrop-blur-sm" onClick={() => setShowUpload(false)} />
          <div className="relative w-full max-w-lg bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-elevated">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-serif text-xl text-espresso">Adicionar Foto</h3>
              <button onClick={() => setShowUpload(false)} className="p-2 rounded-full hover:bg-canvas text-espresso/40 hover:text-espresso transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div className="border-2 border-dashed border-espresso/10 rounded-2xl p-8 text-center hover:border-plum/30 transition-colors">
                {uploadPreview ? (
                  <div className="relative">
                    <img src={uploadPreview} alt="Preview" className="w-full h-40 object-cover rounded-xl" />
                    <button onClick={() => setUploadPreview(null)} className="absolute top-2 right-2 p-1.5 rounded-full bg-void/60 text-cream hover:bg-void transition-colors"><X className="w-3 h-3" /></button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-full bg-plum/10 flex items-center justify-center mx-auto"><Upload className="w-5 h-5 text-plum" /></div>
                    <p className="text-sm text-espresso/60">Arraste uma imagem ou clique para selecionar</p>
                    <p className="text-xs text-espresso/30">PNG, JPG ate 10MB</p>
                    <button onClick={() => setUploadPreview('/images/concert-1.jpg')} className="px-5 py-2 border border-espresso/15 text-espresso text-xs rounded-full hover:bg-espresso/5 transition-all">Usar exemplo</button>
                  </div>
                )}
              </div>
              <input value={uploadForm.eventName} onChange={e => setUploadForm({ ...uploadForm, eventName: e.target.value })} placeholder="Nome do evento" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              <input value={uploadForm.caption} onChange={e => setUploadForm({ ...uploadForm, caption: e.target.value })} placeholder="Legenda da foto" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={uploadForm.featured} onChange={e => setUploadForm({ ...uploadForm, featured: e.target.checked })} className="accent-plum" />
                <span className="text-xs text-espresso/60">Destacar esta foto</span>
              </label>
            </div>
            <div className="flex items-center justify-end gap-3 mt-5">
              <button onClick={() => setShowUpload(false)} className="px-5 py-2.5 text-sm text-espresso/50 hover:text-espresso transition-colors">Cancelar</button>
              <button onClick={addPhoto} className="px-6 py-2.5 bg-plum text-cream text-sm rounded-full hover:shadow-glow transition-all">Adicionar</button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Detail Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedPhoto(null)} />
          <div className="relative w-full max-w-3xl bg-white/80 backdrop-blur-xl rounded-3xl overflow-hidden shadow-2xl max-h-[90vh]">
            <img src={selectedPhoto.url} alt={selectedPhoto.caption} className="w-full max-h-[50vh] object-cover" />
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-serif text-xl text-espresso mb-1">{selectedPhoto.caption}</h3>
                  <p className="text-sm text-espresso/50">{selectedPhoto.eventName} · {selectedPhoto.uploadedAt} · {selectedPhoto.size}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleFeatured(selectedPhoto.id)} className={`p-2 rounded-lg transition-colors ${selectedPhoto.featured ? 'text-plum bg-plum/10' : 'text-espresso/20 hover:text-amber-500'}`} title="Destacar">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => { navigator.clipboard.writeText(selectedPhoto.url); toast.success('URL copiada!') }} className="p-2 rounded-lg hover:bg-canvas text-espresso/20 hover:text-espresso/60 transition-colors">
                    <Download className="w-4 h-4" />
                  </button>
                  <button onClick={() => deletePhoto(selectedPhoto.id)} className="p-2 rounded-lg hover:bg-red-50 text-espresso/20 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-espresso/5 text-sm text-espresso/40">
                <span className="flex items-center gap-1"><Heart className="w-4 h-4" /> {selectedPhoto.likes} curtidas</span>
                <span className="flex items-center gap-1"><MessageCircle className="w-4 h-4" /> {selectedPhoto.comments} comentarios</span>
              </div>
            </div>
          </div>
          <button onClick={() => setSelectedPhoto(null)} className="absolute top-4 right-4 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"><X className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  )
}
