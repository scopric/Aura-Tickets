import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, Link as LinkIcon, Copy, BarChart3, Facebook, Globe,
  MessageCircle, ToggleLeft, ToggleRight, Hash,
  Megaphone, Target, TrendingUp, Eye, QrCode, Smartphone, Download
} from 'lucide-react'
import { toast } from 'sonner'

interface PixelConfig {
  enabled: boolean
  id: string
}

interface UTMLink {
  id: string
  name: string
  url: string
  source: string
  medium: string
  campaign: string
  clicks: number
  createdAt: string
}

interface WhatsAppTemplate {
  id: string
  name: string
  message: string
  used: number
}

export default function Marketing() {
  const [googleAnalytics, setGoogleAnalytics] = useState<PixelConfig>({ enabled: true, id: 'G-XXXXXXXXXX' })
  const [facebookPixel, setFacebookPixel] = useState<PixelConfig>({ enabled: false, id: '' })
  const [googleAds, setGoogleAds] = useState<PixelConfig>({ enabled: false, id: '' })

  const [utmLinks, setUtmLinks] = useState<UTMLink[]>([
    { id: '1', name: 'Campanha Instagram', url: 'https://evokaa.events/e/noite-eletro', source: 'instagram', medium: 'social', campaign: 'lancamento-jun', clicks: 342, createdAt: '2025-06-01' },
    { id: '2', name: 'Email Marketing', url: 'https://evokaa.events/e/noite-eletro', source: 'newsletter', medium: 'email', campaign: 'lancamento-jun', clicks: 189, createdAt: '2025-06-02' },
    { id: '3', name: 'Google Ads', url: 'https://evokaa.events/e/noite-eletro', source: 'google', medium: 'cpc', campaign: 'keywords-jun', clicks: 567, createdAt: '2025-06-03' },
    { id: '4', name: 'WhatsApp Grupo', url: 'https://evokaa.events/e/noite-eletro', source: 'whatsapp', medium: 'social', campaign: 'viral-jun', clicks: 891, createdAt: '2025-06-04' },
  ])

  const [showUTMForm, setShowUTMForm] = useState(false)
  const [utmName, setUtmName] = useState('')
  const [utmSource, setUtmSource] = useState('')
  const [utmMedium, setUtmMedium] = useState('')
  const [utmCampaign, setUtmCampaign] = useState('')

  const [waMessage, setWaMessage] = useState('Oii! Vai ter um evento INCRÍVEL e quero te chamar! 🎉 Confira: ')
  const [waLink, setWaLink] = useState('https://evokaa.events/e/noite-eletro')
  const [waGenerated, setWaGenerated] = useState('')

  const [waTemplates] = useState<WhatsAppTemplate[]>([
    { id: '1', name: 'Convite padrao', message: 'Oii! Vai ter um evento INCRÍVEL e quero te chamar! Confira:', used: 45 },
    { id: '2', name: 'Urgencia', message: 'Últimos ingressos! Não perca esse evento incrível:', used: 23 },
    { id: '3', name: 'Grupo', message: 'Galera, organizei um evento sensacional! Bora? 😎', used: 12 },
  ])

  const [qrEvent, setQrEvent] = useState('noite-eletro-2025')
  const [qrSize, setQrSize] = useState<'small' | 'medium' | 'large'>('medium')

  const generateUTM = () => {
    if (!utmName.trim() || !utmSource.trim()) { toast.error('Preencha nome e origem'); return }
    const newLink: UTMLink = {
      id: `u${Date.now()}`, name: utmName, url: waLink, source: utmSource,
      medium: utmMedium, campaign: utmCampaign, clicks: 0, createdAt: new Date().toISOString().split('T')[0],
    }
    setUtmLinks([newLink, ...utmLinks])
    setShowUTMForm(false)
    setUtmName(''); setUtmSource(''); setUtmMedium(''); setUtmCampaign('')
    toast.success('Link UTM criado!')
  }

  const generateWhatsApp = () => {
    const encoded = encodeURIComponent(`${waMessage} ${waLink}`)
    setWaGenerated(`https://wa.me/?text=${encoded}`)
    toast.success('Link do WhatsApp gerado!')
  }

  const copyLink = (text: string) => { navigator.clipboard.writeText(text); toast.success('Copiado!') }

  const totalClicks = utmLinks.reduce((s, l) => s + l.clicks, 0)

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link to="/producer/dashboard" className="p-2 rounded-full bg-white/60 border border-white/60 text-espresso/50 hover:text-espresso transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-serif text-3xl text-espresso">Marketing Integrado</h1>
          <p className="text-sm text-espresso/50 mt-1">Pixels, UTM, WhatsApp e QR Code para divulgar seu evento</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Cliques Totais', value: totalClicks.toLocaleString(), icon: Eye },
          { label: 'Links UTM', value: utmLinks.length.toString(), icon: LinkIcon },
          { label: 'Canal Top', value: 'WhatsApp', icon: TrendingUp },
          { label: 'Conversao', value: '12.4%', icon: Target },
        ].map(k => (
          <div key={k.label} className="p-5 rounded-2xl bg-white/60 border border-white/60">
            <k.icon className="w-4 h-4 text-plum mb-3" />
            <div className="font-serif text-2xl text-espresso">{k.value}</div>
            <div className="text-[10px] text-espresso/40 mt-1 uppercase tracking-wider">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pixels */}
        <div className="p-6 bg-white/60 border border-white/60 rounded-2xl">
          <h2 className="font-serif text-lg text-espresso mb-4 flex items-center gap-2"><Megaphone className="w-5 h-5 text-plum" /> Pixels de Rastreamento</h2>
          <div className="space-y-4">
            {/* Google Analytics */}
            <div className="p-4 bg-white/40 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium text-espresso">Google Analytics 4</span>
                </div>
                <button onClick={() => setGoogleAnalytics({ ...googleAnalytics, enabled: !googleAnalytics.enabled })} className="transition-all">
                  {googleAnalytics.enabled ? <ToggleRight className="w-6 h-6 text-plum" /> : <ToggleLeft className="w-6 h-6 text-espresso/30" />}
                </button>
              </div>
              {googleAnalytics.enabled && (
                <div>
                  <label className="text-xs text-espresso/50 mb-1 block">Measurement ID</label>
                  <input value={googleAnalytics.id} onChange={e => setGoogleAnalytics({ ...googleAnalytics, id: e.target.value })}
                    placeholder="G-XXXXXXXXXX" className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso focus:outline-none focus:border-plum/30" />
                  <p className="text-[10px] text-espresso/30 mt-1">Acompanhe visitas, conversoes e comportamento</p>
                </div>
              )}
            </div>
            {/* Facebook Pixel */}
            <div className="p-4 bg-white/40 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Facebook className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-espresso">Meta Pixel (Facebook)</span>
                </div>
                <button onClick={() => setFacebookPixel({ ...facebookPixel, enabled: !facebookPixel.enabled })} className="transition-all">
                  {facebookPixel.enabled ? <ToggleRight className="w-6 h-6 text-plum" /> : <ToggleLeft className="w-6 h-6 text-espresso/30" />}
                </button>
              </div>
              {facebookPixel.enabled && (
                <div>
                  <label className="text-xs text-espresso/50 mb-1 block">Pixel ID</label>
                  <input value={facebookPixel.id} onChange={e => setFacebookPixel({ ...facebookPixel, id: e.target.value })}
                    placeholder="1234567890" className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso focus:outline-none focus:border-plum/30" />
                  <p className="text-[10px] text-espresso/30 mt-1">Rastreie conversões e crie públicos personalizados</p>
                </div>
              )}
            </div>
            {/* Google Ads */}
            <div className="p-4 bg-white/40 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium text-espresso">Google Ads Conversion</span>
                </div>
                <button onClick={() => setGoogleAds({ ...googleAds, enabled: !googleAds.enabled })} className="transition-all">
                  {googleAds.enabled ? <ToggleRight className="w-6 h-6 text-plum" /> : <ToggleLeft className="w-6 h-6 text-espresso/30" />}
                </button>
              </div>
              {googleAds.enabled && (
                <div>
                  <label className="text-xs text-espresso/50 mb-1 block">Conversion ID</label>
                  <input value={googleAds.id} onChange={e => setGoogleAds({ ...googleAds, id: e.target.value })}
                    placeholder="AW-XXXXXXXXX" className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso focus:outline-none focus:border-plum/30" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* UTM Links */}
        <div className="p-6 bg-white/60 border border-white/60 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-lg text-espresso flex items-center gap-2"><Hash className="w-5 h-5 text-plum" /> Links UTM</h2>
            <button onClick={() => setShowUTMForm(!showUTMForm)} className="px-4 py-2 text-xs bg-plum text-cream rounded-full hover:shadow-glow transition-all">
              {showUTMForm ? 'Cancelar' : 'Novo Link'}
            </button>
          </div>

          {showUTMForm && (
            <div className="mb-4 p-4 bg-white/40 rounded-xl space-y-3">
              <input value={utmName} onChange={e => setUtmName(e.target.value)} placeholder="Nome do link" className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              <div className="grid grid-cols-3 gap-2">
                <input value={utmSource} onChange={e => setUtmSource(e.target.value)} placeholder="Fonte (instagram)" className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
                <input value={utmMedium} onChange={e => setUtmMedium(e.target.value)} placeholder="Meio (social)" className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
                <input value={utmCampaign} onChange={e => setUtmCampaign(e.target.value)} placeholder="Campanha" className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              </div>
              <button onClick={generateUTM} className="w-full py-2 bg-plum text-cream text-xs rounded-full hover:shadow-glow transition-all flex items-center justify-center gap-2">
                <LinkIcon className="w-3.5 h-3.5" /> Gerar Link UTM
              </button>
            </div>
          )}

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {utmLinks.map(link => (
              <div key={link.id} className="flex items-center gap-3 p-3 bg-white/40 rounded-xl">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-espresso truncate">{link.name}</div>
                  <div className="text-[10px] text-espresso/30 truncate">{link.url}?utm_source={link.source}&utm_medium={link.medium}</div>
                </div>
                <div className="text-xs text-plum font-medium">{link.clicks}</div>
                <button onClick={() => copyLink(`${link.url}?utm_source=${link.source}&utm_medium=${link.medium}&utm_campaign=${link.campaign}`)} className="p-1.5 rounded-lg hover:bg-plum/10 text-espresso/30 hover:text-plum transition-colors">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* WhatsApp Generator */}
        <div className="p-6 bg-white/60 border border-white/60 rounded-2xl">
          <h2 className="font-serif text-lg text-espresso mb-4 flex items-center gap-2"><MessageCircle className="w-5 h-5 text-green-500" /> Gerador WhatsApp</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-espresso/50 mb-1 block">Mensagem</label>
              <textarea value={waMessage} onChange={e => setWaMessage(e.target.value)} rows={3}
                className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso focus:outline-none focus:border-plum/30 resize-none" />
            </div>
            <div>
              <label className="text-xs text-espresso/50 mb-1 block">Link do evento</label>
              <input value={waLink} onChange={e => setWaLink(e.target.value)}
                className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso focus:outline-none focus:border-plum/30" />
            </div>
            <button onClick={generateWhatsApp} className="w-full py-2.5 bg-green-500 text-cream text-sm rounded-full hover:shadow-lg transition-all flex items-center justify-center gap-2">
              <Smartphone className="w-4 h-4" /> Gerar Link WhatsApp
            </button>
            {waGenerated && (
              <div className="p-3 bg-green-50 rounded-xl">
                <div className="text-[10px] text-green-700 mb-1">Link gerado:</div>
                <div className="flex items-center gap-2">
                  <input value={waGenerated} readOnly className="flex-1 px-2 py-1.5 bg-white border border-green-200 rounded text-[10px] text-green-800" />
                  <button onClick={() => copyLink(waGenerated)} className="p-1.5 rounded-lg hover:bg-green-100 text-green-600 transition-colors">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Templates */}
            <div className="mt-4">
              <div className="text-xs text-espresso/50 mb-2">Templates salvos</div>
              <div className="space-y-2">
                {waTemplates.map(t => (
                  <button key={t.id} onClick={() => setWaMessage(t.message)}
                    className="w-full text-left p-3 bg-white/40 rounded-xl hover:bg-white/60 transition-colors">
                    <div className="text-xs font-medium text-espresso">{t.name}</div>
                    <div className="text-[10px] text-espresso/30 truncate">{t.message}</div>
                    <div className="text-[10px] text-espresso/20 mt-0.5">Usado {t.used}x</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* QR Code */}
        <div className="p-6 bg-white/60 border border-white/60 rounded-2xl">
          <h2 className="font-serif text-lg text-espresso mb-4 flex items-center gap-2"><QrCode className="w-5 h-5 text-plum" /> QR Code do Evento</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-espresso/50 mb-1 block">Evento</label>
              <input value={qrEvent} onChange={e => setQrEvent(e.target.value)}
                className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso focus:outline-none focus:border-plum/30" />
            </div>
            <div>
              <label className="text-xs text-espresso/50 mb-1 block">Tamanho</label>
              <div className="flex gap-2">
                {(['small', 'medium', 'large'] as const).map(s => (
                  <button key={s} onClick={() => setQrSize(s)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${qrSize === s ? 'bg-plum text-cream' : 'bg-white/40 text-espresso/40'}`}>
                    {s === 'small' ? 'Pequeno' : s === 'medium' ? 'Medio' : 'Grande'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-center">
              <div className={`bg-white p-4 rounded-2xl border border-white/60 ${qrSize === 'small' ? 'w-32' : qrSize === 'medium' ? 'w-48' : 'w-64'}`}>
                {/* Mock QR */}
                <div className="aspect-square bg-void rounded-xl flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-2 border-2 border-white/30 rounded-lg" />
                  <div className="absolute inset-4 border border-white/20 rounded" />
                  <div className="absolute top-2 left-2 w-6 h-6 border-2 border-white rounded" />
                  <div className="absolute top-2 right-2 w-6 h-6 border-2 border-white rounded" />
                  <div className="absolute bottom-2 left-2 w-6 h-6 border-2 border-white rounded" />
                  <QrCode className="w-8 h-8 text-cream/50" />
                </div>
                <p className="text-[10px] text-center text-espresso/30 mt-2">evokaa.events/e/{qrEvent}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => toast.success('QR Code baixado!')} className="flex-1 py-2.5 bg-plum text-cream text-xs rounded-full hover:shadow-glow transition-all flex items-center justify-center gap-2">
                <Download className="w-3.5 h-3.5" /> Baixar PNG
              </button>
              <button onClick={() => copyLink(`https://evokaa.events/e/${qrEvent}`)} className="px-4 py-2.5 border border-espresso/15 text-espresso text-xs rounded-full hover:bg-espresso/5 transition-all">
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
