import { useState } from 'react'
import {
  Palette, Upload, Type, ImagePlus, QrCode, Share2, Download,
  Sparkles, Copy, Instagram,
  Smartphone, Monitor, Tablet
} from 'lucide-react'
import { toast } from 'sonner'

interface BrandPreset {
  name: string; bg: string; text: string; accent: string; card: string;
}

const presets: BrandPreset[] = [
  { name: 'Evokaa', bg: '#f7f5f0', text: '#1a0e14', accent: '#7a3b69', card: '#ffffff' },
  { name: 'Midnight', bg: '#0a0a0a', text: '#f0f0f0', accent: '#6366f1', card: '#1a1a1a' },
  { name: 'Forest', bg: '#f0fdf4', text: '#14532d', accent: '#16a34a', card: '#ffffff' },
  { name: 'Ocean', bg: '#eff6ff', text: '#1e3a5f', accent: '#2563eb', card: '#ffffff' },
  { name: 'Sunset', bg: '#fff7ed', text: '#7c2d12', accent: '#ea580c', card: '#ffffff' },
  { name: 'Rose', bg: '#fff1f2', text: '#881337', accent: '#e11d48', card: '#ffffff' },
]

const fonts = [
  { name: 'Instrument Serif', family: 'serif', sample: 'The quick brown fox' },
  { name: 'Inter', family: 'sans-serif', sample: 'Clean and modern typography' },
  { name: 'Playfair Display', family: 'serif', sample: 'Elegant editorial design' },
  { name: 'Space Grotesk', family: 'sans-serif', sample: 'Tech-forward aesthetic' },
]

const socialTemplates = [
  { id: 'ig1', name: 'Story - Lote Disponivel', size: '1080x1920', platform: 'Instagram' },
  { id: 'ig2', name: 'Post - Evento Confirmado', size: '1080x1080', platform: 'Instagram' },
  { id: 'tw1', name: 'Twitter - Lineup', size: '1200x675', platform: 'Twitter' },
  { id: 'fb1', name: 'Facebook - Event Cover', size: '1920x1080', platform: 'Facebook' },
  { id: 'wa1', name: 'WhatsApp - Convite', size: '800x800', platform: 'WhatsApp' },
]

export default function ProducerBrand() {
  const [preset, setPreset] = useState(0)
  const [primaryColor, setPrimaryColor] = useState('#7a3b69')
  const [font, setFont] = useState(0)
  const [logo, setLogo] = useState<string | null>(null)
  const [coverImage, setCoverImage] = useState<string | null>(null)
  const [eventTitle, setEventTitle] = useState('Noite Eletro 2025')
  const [eventDate, setEventDate] = useState('20 de Maio, 2025')
  const [eventLocation, setEventLocation] = useState('Sao Paulo/SP')
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  
  const p = presets[preset]
  const f = fonts[font]

  const copyLink = (url: string) => { navigator.clipboard.writeText(url); toast.success('Copiado!') }

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Brand Studio</h1>
          <p className="text-sm text-espresso/50 mt-1">Personalize a identidade visual do seu evento</p>
        </div>
        <button onClick={() => toast.success('Todas as alteracoes foram salvas!')} className="flex items-center gap-2 px-5 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all">
          <Sparkles className="w-4 h-4" /> Publicar Marca
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Controls */}
        <div className="lg:col-span-4 space-y-6">
          {/* Color Presets */}
          <div className="p-5 rounded-2xl bg-white/60 border border-white/60">
            <h3 className="text-sm font-medium text-espresso mb-3 flex items-center gap-2"><Palette className="w-4 h-4 text-plum" /> Paleta de Cores</h3>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {presets.map((pr, i) => (
                <button key={pr.name} onClick={() => { setPreset(i); setPrimaryColor(pr.accent) }} className={`p-3 rounded-xl border-2 transition-all ${preset === i ? 'border-plum shadow-md' : 'border-transparent hover:border-espresso/10'}`} style={{ background: pr.bg }}>
                  <div className="w-6 h-6 rounded-full mx-auto mb-1" style={{ background: pr.accent }} />
                  <div className="text-[10px] font-medium" style={{ color: pr.text }}>{pr.name}</div>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-espresso/40">Cor Principal</label>
              <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-8 h-8 rounded-full overflow-hidden cursor-pointer" />
              <span className="text-xs font-mono text-espresso/40">{primaryColor}</span>
            </div>
          </div>

          {/* Typography */}
          <div className="p-5 rounded-2xl bg-white/60 border border-white/60">
            <h3 className="text-sm font-medium text-espresso mb-3 flex items-center gap-2"><Type className="w-4 h-4 text-plum" /> Tipografia</h3>
            <div className="space-y-2">
              {fonts.map((fn, i) => (
                <button key={fn.name} onClick={() => setFont(i)} className={`w-full p-3 rounded-xl border text-left transition-all ${font === i ? 'border-plum/30 bg-plum/5' : 'border-transparent hover:bg-canvas'}`}>
                  <div className="text-sm font-medium" style={{ fontFamily: fn.family }}>{fn.name}</div>
                  <div className="text-xs text-espresso/30 mt-0.5" style={{ fontFamily: fn.family }}>{fn.sample}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Logo Upload */}
          <div className="p-5 rounded-2xl bg-white/60 border border-white/60">
            <h3 className="text-sm font-medium text-espresso mb-3 flex items-center gap-2"><ImagePlus className="w-4 h-4 text-plum" /> Logo</h3>
            {logo ? (
              <div className="relative">
                <img src={logo} alt="Logo" className="w-full h-24 object-contain rounded-xl bg-canvas p-2" />
                <button onClick={() => setLogo(null)} className="absolute top-2 right-2 p-1 rounded-full bg-void/60 text-cream text-xs">x</button>
              </div>
            ) : (
              <button onClick={() => setLogo('/images/logo-evokaa.png')} className="w-full py-8 border-2 border-dashed border-espresso/10 rounded-2xl text-center hover:border-plum/30 transition-colors">
                <Upload className="w-6 h-6 mx-auto mb-2 text-espresso/20" />
                <p className="text-xs text-espresso/40">Clique para carregar logo</p>
              </button>
            )}
          </div>

          {/* Cover Upload */}
          <div className="p-5 rounded-2xl bg-white/60 border border-white/60">
            <h3 className="text-sm font-medium text-espresso mb-3 flex items-center gap-2"><ImagePlus className="w-4 h-4 text-plum" /> Capa do Evento</h3>
            {coverImage ? (
              <div className="relative">
                <img src={coverImage} alt="Cover" className="w-full h-32 object-cover rounded-xl" />
                <button onClick={() => setCoverImage(null)} className="absolute top-2 right-2 p-1 rounded-full bg-void/60 text-cream text-xs">x</button>
              </div>
            ) : (
              <button onClick={() => setCoverImage('/images/hero-bg.jpg')} className="w-full py-8 border-2 border-dashed border-espresso/10 rounded-2xl text-center hover:border-plum/30 transition-colors">
                <Upload className="w-6 h-6 mx-auto mb-2 text-espresso/20" />
                <p className="text-xs text-espresso/40">Clique para carregar capa</p>
              </button>
            )}
          </div>

          {/* Event Info */}
          <div className="p-5 rounded-2xl bg-white/60 border border-white/60">
            <h3 className="text-sm font-medium text-espresso mb-3">Informacoes do Evento</h3>
            <div className="space-y-3">
              <input value={eventTitle} onChange={e => setEventTitle(e.target.value)} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" placeholder="Titulo do evento" />
              <input value={eventDate} onChange={e => setEventDate(e.target.value)} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" placeholder="Data" />
              <input value={eventLocation} onChange={e => setEventLocation(e.target.value)} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" placeholder="Local" />
            </div>
          </div>

          {/* Social Media Kit */}
          <div className="p-5 rounded-2xl bg-white/60 border border-white/60">
            <h3 className="text-sm font-medium text-espresso mb-3 flex items-center gap-2"><Share2 className="w-4 h-4 text-plum" /> Kit de Midia</h3>
            <div className="space-y-2">
              {socialTemplates.map(t => (
                <button key={t.id} className="w-full flex items-center gap-3 p-3 rounded-xl bg-canvas hover:bg-white/60 transition-all text-left">
                  <div className="w-10 h-10 rounded-lg bg-plum/10 flex items-center justify-center flex-shrink-0">
                    <Instagram className="w-4 h-4 text-plum" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-espresso">{t.name}</div>
                    <div className="text-[10px] text-espresso/30">{t.platform} · {t.size}</div>
                  </div>
                  <Download className="w-3.5 h-3.5 text-espresso/20" />
                </button>
              ))}
            </div>
          </div>

          {/* QR Code */}
          <div className="p-5 rounded-2xl bg-white/60 border border-white/60">
            <h3 className="text-sm font-medium text-espresso mb-3 flex items-center gap-2"><QrCode className="w-4 h-4 text-plum" /> QR Code do Evento</h3>
            <div className="w-32 h-32 bg-canvas rounded-xl mx-auto mb-3 flex items-center justify-center">
              <QrCode className="w-16 h-16 text-espresso/20" />
            </div>
            <button onClick={() => copyLink('https://aura.events/noite-eletro-2025')} className="w-full py-2 bg-canvas rounded-xl text-xs text-espresso/50 hover:text-plum transition-colors flex items-center justify-center gap-2">
              <Copy className="w-3.5 h-3.5" /> Copiar Link
            </button>
          </div>
        </div>

        {/* Right Preview */}
        <div className="lg:col-span-8">
          {/* Device Toggle */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <button onClick={() => setPreviewDevice('desktop')} className={`p-2 rounded-lg transition-colors ${previewDevice === 'desktop' ? 'bg-plum/10 text-plum' : 'text-espresso/30'}`}><Monitor className="w-4 h-4" /></button>
            <button onClick={() => setPreviewDevice('tablet')} className={`p-2 rounded-lg transition-colors ${previewDevice === 'tablet' ? 'bg-plum/10 text-plum' : 'text-espresso/30'}`}><Tablet className="w-4 h-4" /></button>
            <button onClick={() => setPreviewDevice('mobile')} className={`p-2 rounded-lg transition-colors ${previewDevice === 'mobile' ? 'bg-plum/10 text-plum' : 'text-espresso/30'}`}><Smartphone className="w-4 h-4" /></button>
          </div>

          {/* Preview Panel */}
          <div className="rounded-3xl border overflow-hidden shadow-2xl" style={{ background: p.bg, borderColor: `${p.text}10` }}>
            {/* Preview Header */}
            <div className="p-6 text-center" style={{ background: p.accent }}>
              {logo && <img src={logo} alt="" className="h-10 mx-auto mb-3 object-contain" style={{ filter: 'brightness(0) invert(1)' }} />}
              <h2 className="font-serif text-3xl text-white mb-1" style={{ fontFamily: f.family }}>{eventTitle}</h2>
              <p className="text-sm text-white/70">{eventDate} · {eventLocation}</p>
            </div>

            {/* Preview Content */}
            <div className="p-6">
              {coverImage && <img src={coverImage} alt="" className="w-full h-48 object-cover rounded-2xl mb-6" />}

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-2xl" style={{ background: p.card, border: `1px solid ${p.text}08` }}>
                  <div className="text-2xl font-bold mb-0.5" style={{ color: p.accent, fontFamily: f.family }}>250</div>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: p.text, opacity: 0.4 }}>Ingressos</div>
                </div>
                <div className="p-4 rounded-2xl" style={{ background: p.card, border: `1px solid ${p.text}08` }}>
                  <div className="text-2xl font-bold mb-0.5" style={{ color: p.accent, fontFamily: f.family }}>R$45</div>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: p.text, opacity: 0.4 }}>Pista</div>
                </div>
              </div>

              <div className="flex items-center gap-3 mb-6">
                <button className="flex-1 py-3 rounded-full text-sm font-medium text-white" style={{ background: p.accent }}>
                  Comprar Ingresso
                </button>
                <button className="px-4 py-3 rounded-full text-sm" style={{ border: `1px solid ${p.text}15`, color: p.text }}>
                  <Share2 className="w-4 h-4" />
                </button>
              </div>

              {/* Ticket Preview */}
              <div className="p-5 rounded-2xl relative overflow-hidden" style={{ background: p.card, border: `1px solid ${p.text}08` }}>
                <div className="absolute top-0 left-0 w-full h-1" style={{ background: `linear-gradient(90deg, ${p.accent}, ${p.accent}60)` }} />
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs mb-0.5" style={{ color: p.text, opacity: 0.4 }}>VIP</div>
                    <div className="text-lg font-bold" style={{ color: p.text, fontFamily: f.family }}>R$ 120</div>
                    <div className="text-[10px] mt-1" style={{ color: p.text, opacity: 0.3 }}>Acesso backstage + open bar</div>
                  </div>
                  <QrCode className="w-10 h-10" style={{ color: p.accent, opacity: 0.3 }} />
                </div>
              </div>
            </div>
          </div>

          {/* Brand Assets */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Cor Primaria', value: primaryColor, sample: true },
              { label: 'Cor de Fundo', value: p.bg, sample: false },
              { label: 'Cor do Texto', value: p.text, sample: false },
              { label: 'Fonte', value: f.name, sample: false },
            ].map(a => (
              <div key={a.label} className="p-4 rounded-2xl bg-white/60 border border-white/60 text-center">
                {a.sample && <div className="w-8 h-8 rounded-full mx-auto mb-2" style={{ background: a.value }} />}
                <div className="text-xs font-medium text-espresso">{a.value}</div>
                <div className="text-[10px] text-espresso/30 mt-0.5">{a.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
