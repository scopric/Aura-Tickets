import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Palette, Type, Image, Layout, Sparkles, Eye, RotateCcw, Check } from 'lucide-react'
import gsap from 'gsap'

interface BrandSettings {
  primaryColor: string
  secondaryColor: string
  accentColor: string
  fontFamily: string
  cardStyle: 'glass' | 'solid' | 'minimal'
  buttonStyle: 'pill' | 'rounded' | 'square'
  backgroundPattern: string
  borderRadius: number
}

const defaultSettings: BrandSettings = {
  primaryColor: '#7a3b69',
  secondaryColor: '#1a0e14',
  accentColor: '#f7f5f0',
  fontFamily: 'Instrument Serif',
  cardStyle: 'glass',
  buttonStyle: 'pill',
  backgroundPattern: 'none',
  borderRadius: 24,
}

const presetThemes = [
  {
    name: 'Aura',
    settings: {
      primaryColor: '#7a3b69',
      secondaryColor: '#1a0e14',
      accentColor: '#f7f5f0',
      fontFamily: 'Instrument Serif',
      cardStyle: 'glass' as const,
      buttonStyle: 'pill' as const,
      backgroundPattern: 'none',
      borderRadius: 24,
    }
  },
  {
    name: 'Midnight',
    settings: {
      primaryColor: '#2563eb',
      secondaryColor: '#0f172a',
      accentColor: '#f8fafc',
      fontFamily: 'Inter',
      cardStyle: 'solid' as const,
      buttonStyle: 'rounded' as const,
      backgroundPattern: 'dots',
      borderRadius: 12,
    }
  },
  {
    name: 'Sunset',
    settings: {
      primaryColor: '#ea580c',
      secondaryColor: '#431407',
      accentColor: '#fff7ed',
      fontFamily: 'Instrument Serif',
      cardStyle: 'glass' as const,
      buttonStyle: 'pill' as const,
      backgroundPattern: 'gradient',
      borderRadius: 16,
    }
  },
  {
    name: 'Forest',
    settings: {
      primaryColor: '#16a34a',
      secondaryColor: '#052e16',
      accentColor: '#f0fdf4',
      fontFamily: 'Inter',
      cardStyle: 'minimal' as const,
      buttonStyle: 'square' as const,
      backgroundPattern: 'none',
      borderRadius: 8,
    }
  }
]

export default function BrandStudio() {
  const [settings, setSettings] = useState<BrandSettings>(defaultSettings)
  const [saved, setSaved] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    gsap.fromTo('.studio-panel',
      { x: -40, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.8, stagger: 0.1, ease: 'power3.out' }
    )
    gsap.fromTo('.preview-area',
      { x: 40, opacity: 0 },
      { x: 0, opacity: 1, duration: 1, ease: 'power3.out', delay: 0.3 }
    )
  }, [])

  const updateSetting = <K extends keyof BrandSettings>(key: K, value: BrandSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const applyPreset = (preset: typeof presetThemes[0]) => {
    setSettings(preset.settings)
    setSaved(false)
  }

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleReset = () => {
    setSettings(defaultSettings)
    setSaved(false)
  }

  const getCardClass = () => {
    const base = 'p-6 transition-all duration-300 '
    switch (settings.cardStyle) {
      case 'glass':
        return base + 'bg-white/60 backdrop-blur-xl border border-white/60 shadow-lg'
      case 'solid':
        return base + 'bg-white border border-gray-100 shadow-md'
      case 'minimal':
        return base + 'bg-transparent border border-gray-200'
      default:
        return base
    }
  }

  const getButtonClass = () => {
    const base = 'px-6 py-3 font-medium transition-all duration-300 hover:opacity-90 '
    switch (settings.buttonStyle) {
      case 'pill':
        return base + 'rounded-full'
      case 'rounded':
        return base + 'rounded-xl'
      case 'square':
        return base + 'rounded-none'
      default:
        return base
    }
  }

  const getBorderRadius = () => `${settings.borderRadius}px`

  return (
    <div className="min-h-screen bg-canvas pt-20 lg:pt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-12">
          <div>
            <h1 className="font-serif text-4xl lg:text-5xl text-espresso mb-2">
              Brand <span className="italic text-plum">Studio</span>
            </h1>
            <p className="text-espresso/60">
              Personalize a aparência da página do seu evento
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2.5 border border-espresso/20 text-espresso text-sm font-medium rounded-full hover:bg-espresso/5 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              Resetar
            </button>
            <button
              onClick={handleSave}
              className={`flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-full transition-all ${
                saved
                  ? 'bg-green-500 text-white'
                  : 'bg-plum text-cream hover:shadow-glow'
              }`}
            >
              {saved ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              {saved ? 'Salvo!' : 'Salvar Alterações'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Settings Panel */}
          <div className="lg:col-span-4 space-y-6">
            {/* Presets */}
            <div className="studio-panel p-6 rounded-3xl bg-white/50 border border-white/60 backdrop-blur-sm">
              <h3 className="text-xs font-medium uppercase tracking-widest text-espresso/40 mb-4">
                Temas Prontos
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {presetThemes.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => applyPreset(preset)}
                    className="p-4 rounded-2xl border border-espresso/10 hover:border-plum/30 transition-all group"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-6 h-6 rounded-full"
                        style={{ backgroundColor: preset.settings.primaryColor }}
                      />
                      <span className="text-sm font-medium text-espresso">{preset.name}</span>
                    </div>
                    <div className="flex gap-1">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: preset.settings.secondaryColor }} />
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: preset.settings.accentColor }} />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Colors */}
            <div className="studio-panel p-6 rounded-3xl bg-white/50 border border-white/60 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-4">
                <Palette className="w-4 h-4 text-plum" />
                <h3 className="text-xs font-medium uppercase tracking-widest text-espresso/40">
                  Cores
                </h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-espresso/70 mb-2 block">Cor Primária</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={settings.primaryColor}
                      onChange={(e) => updateSetting('primaryColor', e.target.value)}
                      className="w-12 h-12 rounded-xl border border-espresso/10 cursor-pointer"
                    />
                    <span className="text-sm text-espresso/50 font-mono">{settings.primaryColor}</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-espresso/70 mb-2 block">Cor Secundária</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={settings.secondaryColor}
                      onChange={(e) => updateSetting('secondaryColor', e.target.value)}
                      className="w-12 h-12 rounded-xl border border-espresso/10 cursor-pointer"
                    />
                    <span className="text-sm text-espresso/50 font-mono">{settings.secondaryColor}</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-espresso/70 mb-2 block">Cor de Destaque</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={settings.accentColor}
                      onChange={(e) => updateSetting('accentColor', e.target.value)}
                      className="w-12 h-12 rounded-xl border border-espresso/10 cursor-pointer"
                    />
                    <span className="text-sm text-espresso/50 font-mono">{settings.accentColor}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Typography */}
            <div className="studio-panel p-6 rounded-3xl bg-white/50 border border-white/60 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-4">
                <Type className="w-4 h-4 text-plum" />
                <h3 className="text-xs font-medium uppercase tracking-widest text-espresso/40">
                  Tipografia
                </h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-espresso/70 mb-2 block">Fonte Principal</label>
                  <select
                    value={settings.fontFamily}
                    onChange={(e) => updateSetting('fontFamily', e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-espresso/10 bg-white text-sm text-espresso focus:outline-none focus:border-plum/30"
                  >
                    <option value="Instrument Serif">Instrument Serif</option>
                    <option value="Inter">Inter</option>
                    <option value="Georgia">Georgia</option>
                    <option value="system-ui">System UI</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Cards */}
            <div className="studio-panel p-6 rounded-3xl bg-white/50 border border-white/60 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-4">
                <Layout className="w-4 h-4 text-plum" />
                <h3 className="text-xs font-medium uppercase tracking-widest text-espresso/40">
                  Componentes
                </h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-espresso/70 mb-2 block">Estilo dos Cards</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['glass', 'solid', 'minimal'] as const).map((style) => (
                      <button
                        key={style}
                        onClick={() => updateSetting('cardStyle', style)}
                        className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                          settings.cardStyle === style
                            ? 'border-plum bg-plum/10 text-plum'
                            : 'border-espresso/10 text-espresso/50 hover:border-espresso/20'
                        }`}
                      >
                        {style === 'glass' ? 'Vidro' : style === 'solid' ? 'Sólido' : 'Minimal'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-espresso/70 mb-2 block">Estilo dos Botões</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['pill', 'rounded', 'square'] as const).map((style) => (
                      <button
                        key={style}
                        onClick={() => updateSetting('buttonStyle', style)}
                        className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                          settings.buttonStyle === style
                            ? 'border-plum bg-plum/10 text-plum'
                            : 'border-espresso/10 text-espresso/50 hover:border-espresso/20'
                        }`}
                      >
                        {style === 'pill' ? 'Pílula' : style === 'rounded' ? 'Arredondado' : 'Quadrado'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-espresso/70 mb-2 block">Arredondamento (px)</label>
                  <input
                    type="range"
                    min={0}
                    max={32}
                    value={settings.borderRadius}
                    onChange={(e) => updateSetting('borderRadius', parseInt(e.target.value))}
                    className="w-full accent-plum"
                  />
                  <span className="text-xs text-espresso/40">{settings.borderRadius}px</span>
                </div>
              </div>
            </div>

            {/* Background */}
            <div className="studio-panel p-6 rounded-3xl bg-white/50 border border-white/60 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-4">
                <Image className="w-4 h-4 text-plum" />
                <h3 className="text-xs font-medium uppercase tracking-widest text-espresso/40">
                  Fundo
                </h3>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'none', label: 'Limpo' },
                  { value: 'dots', label: 'Pontos' },
                  { value: 'gradient', label: 'Gradiente' },
                ].map((pattern) => (
                  <button
                    key={pattern.value}
                    onClick={() => updateSetting('backgroundPattern', pattern.value)}
                    className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                      settings.backgroundPattern === pattern.value
                        ? 'border-plum bg-plum/10 text-plum'
                        : 'border-espresso/10 text-espresso/50 hover:border-espresso/20'
                    }`}
                  >
                    {pattern.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="lg:col-span-8">
            <div className="preview-area sticky top-24">
              <div className="flex items-center gap-2 mb-4">
                <Eye className="w-4 h-4 text-plum" />
                <h3 className="text-xs font-medium uppercase tracking-widest text-espresso/40">
                  Pré-visualização
                </h3>
              </div>
              
              <div
                ref={previewRef}
                className="rounded-3xl overflow-hidden border border-espresso/10 shadow-elevated transition-all duration-500"
                style={{
                  backgroundColor: settings.accentColor,
                  backgroundImage: settings.backgroundPattern === 'dots'
                    ? `radial-gradient(circle, ${settings.secondaryColor}10 1px, transparent 1px)`
                    : settings.backgroundPattern === 'gradient'
                    ? `linear-gradient(135deg, ${settings.accentColor} 0%, ${settings.primaryColor}15 100%)`
                    : 'none',
                  backgroundSize: settings.backgroundPattern === 'dots' ? '20px 20px' : 'auto',
                }}
              >
                {/* Mini Event Page Preview */}
                <div className="relative">
                  {/* Hero Preview */}
                  <div
                    className="relative h-64 sm:h-80 flex items-end p-6 sm:p-10"
                    style={{
                      background: `linear-gradient(135deg, ${settings.secondaryColor} 0%, ${settings.primaryColor} 100%)`,
                    }}
                  >
                    <div className="relative z-10">
                      <span
                        className="inline-block px-3 py-1 text-xs font-medium rounded-full mb-3"
                        style={{
                          backgroundColor: `${settings.accentColor}20`,
                          color: settings.accentColor,
                        }}
                      >
                        Música
                      </span>
                      <h2
                        className="font-serif text-3xl sm:text-5xl mb-2"
                        style={{ color: settings.accentColor, fontFamily: settings.fontFamily }}
                      >
                        Noite Eletro 2025
                      </h2>
                      <p className="text-sm opacity-60" style={{ color: settings.accentColor }}>
                        15 de Junho · Warehouse Central
                      </p>
                    </div>
                  </div>

                  {/* Tickets Preview */}
                  <div className="p-6 sm:p-10">
                    <h3
                      className="font-serif text-2xl mb-6"
                      style={{ color: settings.secondaryColor, fontFamily: settings.fontFamily }}
                    >
                      Ingressos
                    </h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Ticket Card 1 */}
                      <div
                        className={getCardClass()}
                        style={{ borderRadius: getBorderRadius() }}
                      >
                        <h4 className="font-medium mb-1" style={{ color: settings.secondaryColor }}>
                          Ingresso Geral
                        </h4>
                        <p className="text-xs opacity-50 mb-4" style={{ color: settings.secondaryColor }}>
                          Acesso à pista principal
                        </p>
                        <div
                          className="font-serif text-3xl mb-4"
                          style={{ color: settings.primaryColor }}
                        >
                          R$ 120
                        </div>
                        <button
                          className={getButtonClass()}
                          style={{
                            backgroundColor: settings.primaryColor,
                            color: settings.accentColor,
                          }}
                        >
                          Comprar
                        </button>
                      </div>

                      {/* Ticket Card 2 */}
                      <div
                        className={getCardClass()}
                        style={{ borderRadius: getBorderRadius() }}
                      >
                        <h4 className="font-medium mb-1" style={{ color: settings.secondaryColor }}>
                          Ingresso VIP
                        </h4>
                        <p className="text-xs opacity-50 mb-4" style={{ color: settings.secondaryColor }}>
                          Experiência premium
                        </p>
                        <div
                          className="font-serif text-3xl mb-4"
                          style={{ color: settings.primaryColor }}
                        >
                          R$ 280
                        </div>
                        <button
                          className={getButtonClass()}
                          style={{
                            backgroundColor: settings.primaryColor,
                            color: settings.accentColor,
                          }}
                        >
                          Comprar
                        </button>
                      </div>
                    </div>

                    {/* Social Proof Preview */}
                    <div className="mt-8">
                      <h3
                        className="font-serif text-2xl mb-4"
                        style={{ color: settings.secondaryColor, fontFamily: settings.fontFamily }}
                      >
                        Por Dentro
                      </h3>
                      <div className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                          {[1, 3, 5, 8].map((id) => (
                            <img
                              key={id}
                              src={`https://i.pravatar.cc/150?img=${id}`}
                              alt=""
                              className="w-8 h-8 rounded-full border-2"
                              style={{ borderColor: settings.accentColor }}
                            />
                          ))}
                        </div>
                        <span className="text-xs opacity-50" style={{ color: settings.secondaryColor }}>
                          +892 participantes confirmados
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Apply CTA */}
              <div className="mt-6 flex items-center justify-between">
                <p className="text-sm text-espresso/50">
                  As alterações serão aplicadas à página do evento
                </p>
                <Link
                  to="/event/noite-eletro-2025"
                  className="flex items-center gap-2 px-6 py-3 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all"
                >
                  <Eye className="w-4 h-4" />
                  Ver no Evento
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
