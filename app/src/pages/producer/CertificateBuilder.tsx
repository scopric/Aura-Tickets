import { useState, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useEffect } from 'react'
import {
  ArrowLeft, Download, Eye, Upload, Type, Image, Signature,
  QrCode, Trash2, Copy, Grid3x3, Sparkles, Save, Mail, Send,
  Calendar as CalendarDays, Plus, Layout
} from 'lucide-react'
import { toast } from 'sonner'

interface CertField {
  id: string
  type: 'text' | 'logo' | 'signature' | 'qrcode' | 'date' | 'hours'
  label: string
  x: number
  y: number
  fontSize: number
  color: string
  value: string
  width: number
  height: number
}

interface CertTemplate {
  id: string
  name: string
  category: string
  bgColor: string
  accentColor: string
  borderStyle: string
  preview: string
}

const templates: CertTemplate[] = [
  { id: 'classic', name: 'Classico Elegante', category: 'geral', bgColor: '#ffffff', accentColor: '#1a0e14', borderStyle: 'border-8 border-double', preview: 'Bordas duplas, tipografia serif' },
  { id: 'modern', name: 'Moderno Minimalista', category: 'tech', bgColor: '#f8f7f5', accentColor: '#7a3b69', borderStyle: 'border-l-4', preview: 'Linha lateral, fonte clean' },
  { id: 'corporate', name: 'Corporativo', category: 'corporativo', bgColor: '#ffffff', accentColor: '#1e3a5f', borderStyle: 'border', preview: 'Azul corporativo, selo dourado' },
  { id: 'creative', name: 'Criativo Artistico', category: 'arte', bgColor: '#fdf6f0', accentColor: '#d97706', borderStyle: 'border-4 border-dashed', preview: 'Cores quentes, layout artistico' },
  { id: 'academic', name: 'Academico', category: 'educacao', bgColor: '#ffffff', accentColor: '#374151', borderStyle: 'border-2', preview: 'Selo academico, serif formal' },
  { id: 'sport', name: 'Esporte e Bem-estar', category: 'esporte', bgColor: '#f0fdf4', accentColor: '#16a34a', borderStyle: 'border-4', preview: 'Verde vibrante, layout dinamico' },
]

const defaultFields: CertField[] = [
  { id: 'logo', type: 'logo', label: 'Logo', x: 50, y: 8, fontSize: 0, color: '', value: '', width: 80, height: 40 },
  { id: 'title', type: 'text', label: 'Titulo', x: 50, y: 22, fontSize: 28, color: '#1a0e14', value: 'Certificado de Participacao', width: 80, height: 40 },
  { id: 'subtitle', type: 'text', label: 'Subtitulo', x: 50, y: 32, fontSize: 14, color: '#7a3b69', value: 'Reconhecemos que', width: 80, height: 25 },
  { id: 'participant', type: 'text', label: 'Nome Participante', x: 50, y: 44, fontSize: 32, color: '#1a0e14', value: '{{NOME}}', width: 80, height: 50 },
  { id: 'event', type: 'text', label: 'Evento', x: 50, y: 56, fontSize: 16, color: '#44403c', value: 'participou do {{EVENTO}}', width: 80, height: 30 },
  { id: 'details', type: 'text', label: 'Detalhes', x: 50, y: 64, fontSize: 12, color: '#78716c', value: 'realizado em {{DATA}} com carga horaria de {{HORAS}}h', width: 80, height: 25 },
  { id: 'signature', type: 'signature', label: 'Assinatura', x: 70, y: 80, fontSize: 14, color: '#1a0e14', value: '{{ASSINATURA}}', width: 100, height: 30 },
  { id: 'sigLabel', type: 'text', label: 'Label Assinatura', x: 70, y: 88, fontSize: 10, color: '#a8a29e', value: 'Assinatura do Produtor', width: 100, height: 15 },
  { id: 'qrcode', type: 'qrcode', label: 'QR Code', x: 15, y: 78, fontSize: 0, color: '', value: '', width: 50, height: 50 },
  { id: 'date', type: 'date', label: 'Data Emissao', x: 15, y: 92, fontSize: 10, color: '#a8a29e', value: '{{DATA_EMISSAO}}', width: 50, height: 15 },
]

export default function CertificateBuilder() {
  const [searchParams] = useSearchParams()
  const eventIdParam = searchParams.get('eventId')
  const [eventId, setEventId] = useState<string | null>(eventIdParam)

  const [selectedTemplate, setSelectedTemplate] = useState<string>('classic')
  const [fields, setFields] = useState<CertField[]>(defaultFields)
  const [selectedField, setSelectedField] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [sigUrl, setSigUrl] = useState<string | null>(null)
  const [previewName, setPreviewName] = useState('Ana Beatriz Silva')
  const [previewEvent, setPreviewEvent] = useState('Workshop de Design Thinking')
  const [previewDate, setPreviewDate] = useState('15 de Junho de 2025')
  const [previewHours, setPreviewHours] = useState('8')
  const [showPreview, setShowPreview] = useState(false)
  const [showSend, setShowSend] = useState(false)
  const [sendEmails, setSendEmails] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sigInputRef = useRef<HTMLInputElement>(null)

  // Carregar modelo do banco de dados
  useEffect(() => {
    const fetchTemplate = async () => {
      let activeEventId = eventId;
      
      // Buscar o primeiro evento do produtor se não houver parametro na URL
      if (!activeEventId) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: firstEvent } = await supabase
            .from('events')
            .select('id')
            .eq('producer_id', user.id)
            .limit(1)
            .maybeSingle()
            
          if (firstEvent) {
            activeEventId = firstEvent.id;
            setEventId(firstEvent.id);
          }
        }
      }

      if (activeEventId) {
        const { data, error } = await supabase
          .from('certificates')
          .select('*')
          .eq('event_id', activeEventId)
          .maybeSingle()

        if (error) {
          toast.error(`Erro ao carregar modelo: ${error.message}`)
        } else if (data && data.template) {
          const tpl = data.template as any
          if (tpl.selectedTemplate) setSelectedTemplate(tpl.selectedTemplate)
          if (tpl.fields) setFields(tpl.fields)
          if (tpl.logoUrl) setLogoUrl(tpl.logoUrl)
          if (tpl.sigUrl) setSigUrl(tpl.sigUrl)
          toast.success('Modelo de certificado carregado com sucesso!')
        }
      }
    }
    
    fetchTemplate()
  }, [])

  const handleSave = async () => {
    let activeEventId = eventId;

    if (!activeEventId) {
      // Buscar primeiro evento
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: firstEvent } = await supabase
          .from('events')
          .select('id')
          .eq('producer_id', user.id)
          .limit(1)
          .maybeSingle()
          
        if (firstEvent) {
          activeEventId = firstEvent.id;
          setEventId(firstEvent.id);
        }
      }
    }

    if (!activeEventId) {
      toast.error('Crie pelo menos um evento antes de salvar o modelo do certificado.');
      return;
    }

    const { error } = await supabase
      .from('certificates')
      .upsert({
        event_id: activeEventId,
        template: {
          selectedTemplate,
          fields,
          logoUrl,
          sigUrl
        },
        is_active: true
      }, { onConflict: 'event_id' })

    if (error) {
      toast.error(`Erro ao salvar modelo: ${error.message}`)
    } else {
      toast.success('Modelo de certificado salvo com sucesso no banco de dados!')
    }
  }

  const template = templates.find(t => t.id === selectedTemplate) || templates[0]

  const updateField = (id: string, updates: Partial<CertField>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f))
  }

  const addField = (type: CertField['type']) => {
    const newField: CertField = {
      id: `f${Date.now()}`, type,
      label: 'Novo Campo', x: 50, y: 50,
      fontSize: type === 'text' ? 14 : 0, color: '#1a0e14',
      value: type === 'text' ? 'Texto' : '',
      width: type === 'qrcode' ? 50 : type === 'logo' ? 80 : 60,
      height: type === 'qrcode' || type === 'logo' ? 50 : 25,
    }
    setFields([...fields, newField])
    setSelectedField(newField.id)
    toast.success('Campo adicionado!')
  }

  const removeField = (id: string) => {
    if (fields.length <= 1) { toast.error('Mantenha pelo menos um campo'); return }
    setFields(fields.filter(f => f.id !== id))
    if (selectedField === id) setSelectedField(null)
  }

  const handleLogoUpload = () => fileInputRef.current?.click()
  const handleSigUpload = () => sigInputRef.current?.click()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'sig') => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      if (type === 'logo') setLogoUrl(ev.target?.result as string)
      else setSigUrl(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
    toast.success(`${type === 'logo' ? 'Logo' : 'Assinatura'} carregada!`)
  }

  const resolveValue = (field: CertField) => {
    return field.value
      .replace('{{NOME}}', previewName)
      .replace('{{EVENTO}}', previewEvent)
      .replace('{{DATA}}', previewDate)
      .replace('{{HORAS}}', previewHours)
      .replace('{{ASSINATURA}}', sigUrl ? '[ASSINATURA]' : '_________________')
      .replace('{{DATA_EMISSAO}}', new Date().toLocaleDateString('pt-BR'))
  }

  const handleDownload = () => { toast.success('Certificado modelo baixado!') }
  const handleSend = () => {
    if (!sendEmails.trim()) { toast.error('Digite os emails'); return }
    toast.success('Certificados enviados!')
    setShowSend(false)
    setSendEmails('')
  }

  const selected = fields.find(f => f.id === selectedField)

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to="/producer/certificados" className="p-2 rounded-full bg-white/60 border border-white/60 text-espresso/50 hover:text-espresso transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-serif text-3xl text-espresso">Editor de Certificados</h1>
          <p className="text-sm text-espresso/50 mt-1">Crie modelos personalizados com seu logo e assinatura</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowPreview(!showPreview)} className="px-4 py-2.5 bg-white/60 border border-white/60 text-espresso text-sm rounded-full hover:bg-plum hover:text-cream transition-all flex items-center gap-2">
            <Eye className="w-4 h-4" /> Preview
          </button>
          <button onClick={handleSave} className="px-4 py-2.5 bg-plum text-cream text-sm rounded-full hover:shadow-glow transition-all flex items-center gap-2">
            <Save className="w-4 h-4" /> Salvar Modelo
          </button>
        </div>
      </div>

      {/* Templates */}
      <div className="p-5 bg-white/60 border border-white/60 rounded-2xl mb-6">
        <h2 className="text-sm font-medium text-espresso mb-3 flex items-center gap-2"><Layout className="w-4 h-4 text-plum" /> Escolha um Modelo</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {templates.map(t => (
            <button key={t.id} onClick={() => setSelectedTemplate(t.id)}
              className={`p-4 rounded-xl border-2 transition-all text-center ${selectedTemplate === t.id ? 'border-plum bg-plum/5' : 'border-white/60 bg-white/40 hover:border-plum/20'}`}>
              <div className="w-12 h-16 mx-auto rounded mb-2 border" style={{ background: t.bgColor, borderColor: t.accentColor }} />
              <div className="text-xs font-medium text-espresso">{t.name}</div>
              <div className="text-[9px] text-espresso/30">{t.preview}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Editor Sidebar */}
        <div className="lg:col-span-2 space-y-4">
          {/* Branding */}
          <div className="p-5 bg-white/60 border border-white/60 rounded-2xl">
            <h2 className="text-sm font-medium text-espresso mb-3 flex items-center gap-2"><Image className="w-4 h-4 text-plum" /> Identidade Visual</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="upload-logo-input" className="text-xs text-espresso/50 mb-1 block">Logo do Evento</label>
                <input id="upload-logo-input" ref={fileInputRef} type="file" accept="image/*" aria-label="Selecionar arquivo de logo do evento" className="hidden" onChange={e => handleFileChange(e, 'logo')} />
                <button onClick={handleLogoUpload} className="w-full p-3 bg-white/40 border border-white/60 rounded-xl flex items-center justify-center gap-2 text-xs text-espresso/50 hover:text-plum hover:border-plum/30 transition-all">
                  {logoUrl ? <img src={logoUrl} alt="Logo do Evento" className="h-8 object-contain" /> : <><Upload className="w-4 h-4" /> Upload</>}
                </button>
              </div>
              <div>
                <label htmlFor="upload-sig-input" className="text-xs text-espresso/50 mb-1 block">Assinatura</label>
                <input id="upload-sig-input" ref={sigInputRef} type="file" accept="image/*" aria-label="Selecionar arquivo de assinatura" className="hidden" onChange={e => handleFileChange(e, 'sig')} />
                <button onClick={handleSigUpload} className="w-full p-3 bg-white/40 border border-white/60 rounded-xl flex items-center justify-center gap-2 text-xs text-espresso/50 hover:text-plum hover:border-plum/30 transition-all">
                  {sigUrl ? <img src={sigUrl} alt="Assinatura do Produtor" className="h-8 object-contain" /> : <><Signature className="w-4 h-4" /> Upload</>}
                </button>
              </div>
            </div>
            <div className="mt-3">
              <label className="text-xs text-espresso/50 mb-1 block">Cor de Destaque</label>
              <div className="flex gap-2">
                {['#1a0e14', '#7a3b69', '#1e3a5f', '#d97706', '#16a34a', '#dc2626', '#0891b2'].map(c => (
                  <button key={c} onClick={() => {}} title={`Cor ${c}`} aria-label={`Selecionar cor de destaque ${c}`} className={`w-8 h-8 rounded-full border-2 transition-all ${template.accentColor === c ? 'border-espresso scale-110' : 'border-transparent'}`} style={{ background: c }} />
                ))}
              </div>
            </div>
          </div>

          {/* Preview Data */}
          <div className="p-5 bg-white/60 border border-white/60 rounded-2xl">
            <h2 className="text-sm font-medium text-espresso mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-plum" /> Dados de Preview</h2>
            <div className="space-y-2">
              <input value={previewName} onChange={e => setPreviewName(e.target.value)} placeholder="Nome do participante" className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso focus:outline-none focus:border-plum/30" />
              <input value={previewEvent} onChange={e => setPreviewEvent(e.target.value)} placeholder="Nome do evento" className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso focus:outline-none focus:border-plum/30" />
              <input value={previewDate} onChange={e => setPreviewDate(e.target.value)} placeholder="Data" className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso focus:outline-none focus:border-plum/30" />
              <input value={previewHours} onChange={e => setPreviewHours(e.target.value)} placeholder="Horas" className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso focus:outline-none focus:border-plum/30" />
            </div>
          </div>

          {/* Fields List */}
          <div className="p-5 bg-white/60 border border-white/60 rounded-2xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-espresso flex items-center gap-2"><Grid3x3 className="w-4 h-4 text-plum" /> Campos ({fields.length})</h2>
              <div className="flex gap-1">
                <button onClick={() => addField('text')} title="Adicionar campo de texto" aria-label="Adicionar campo de texto" className="p-1.5 rounded-lg hover:bg-plum/10 text-espresso/30 hover:text-plum"><Type className="w-3.5 h-3.5" /></button>
                <button onClick={() => addField('qrcode')} title="Adicionar QR Code" aria-label="Adicionar QR Code" className="p-1.5 rounded-lg hover:bg-plum/10 text-espresso/30 hover:text-plum"><QrCode className="w-3.5 h-3.5" /></button>
                <button onClick={() => addField('text')} title="Adicionar novo campo" aria-label="Adicionar novo campo" className="p-1.5 rounded-lg hover:bg-plum/10 text-espresso/30 hover:text-plum"><Plus className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto sidebar-dark-scroll pr-1">
              {fields.map(f => (
                <div key={f.id} onClick={() => setSelectedField(f.id === selectedField ? null : f.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all text-left cursor-pointer ${selectedField === f.id ? 'bg-plum/10 text-plum' : 'text-espresso/50 hover:bg-white/40'}`}>
                  {f.type === 'text' && <Type className="w-3.5 h-3.5" />}
                  {f.type === 'logo' && <Image className="w-3.5 h-3.5" />}
                  {f.type === 'signature' && <Signature className="w-3.5 h-3.5" />}
                  {f.type === 'qrcode' && <QrCode className="w-3.5 h-3.5" />}
                  {f.type === 'date' && <CalendarDays className="w-3.5 h-3.5" />}
                  <span className="flex-1 truncate">{f.label}</span>
                  <button onClick={e => { e.stopPropagation(); removeField(f.id) }} title="Remover campo" aria-label="Remover campo" className="p-0.5 rounded hover:bg-red-50 text-espresso/20 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          </div>

          {/* Field Editor */}
          {selected && (
            <div className="p-5 bg-white/60 border border-white/60 rounded-2xl">
              <h2 className="text-sm font-medium text-espresso mb-3">Editar: {selected.label}</h2>
              <div className="space-y-3">
                {selected.type === 'text' && (
                  <>
                    <div>
                      <label className="text-xs text-espresso/50 mb-1 block">Texto/Variavel</label>
                      <input value={selected.value} onChange={e => updateField(selected.id, { value: e.target.value })}
                        placeholder="Use {{NOME}}, {{EVENTO}}, {{DATA}}, {{HORAS}}" className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-xs text-espresso focus:outline-none focus:border-plum/30" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor="selected-field-font-size" className="text-xs text-espresso/50 mb-1 block">Tamanho (px)</label>
                        <input id="selected-field-font-size" type="number" value={selected.fontSize} onChange={e => updateField(selected.id, { fontSize: Number(e.target.value) })}
                          className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-xs text-espresso focus:outline-none focus:border-plum/30" />
                      </div>
                      <div>
                        <label htmlFor="selected-field-color" className="text-xs text-espresso/50 mb-1 block">Cor</label>
                        <input id="selected-field-color" type="color" value={selected.color} onChange={e => updateField(selected.id, { color: e.target.value })}
                          className="w-full h-9 bg-white/50 border border-white/60 rounded-lg cursor-pointer" />
                      </div>
                    </div>
                  </>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="selected-field-pos-x" className="text-xs text-espresso/50 mb-1 block">Pos X (%)</label>
                    <input id="selected-field-pos-x" type="number" value={selected.x} min={0} max={100} onChange={e => updateField(selected.id, { x: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-xs text-espresso focus:outline-none focus:border-plum/30" />
                  </div>
                  <div>
                    <label htmlFor="selected-field-pos-y" className="text-xs text-espresso/50 mb-1 block">Pos Y (%)</label>
                    <input id="selected-field-pos-y" type="number" value={selected.y} min={0} max={100} onChange={e => updateField(selected.id, { y: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-xs text-espresso focus:outline-none focus:border-plum/30" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button onClick={() => setShowSend(true)} className="flex-1 py-3 bg-plum text-cream text-sm rounded-full hover:shadow-glow transition-all flex items-center justify-center gap-2">
              <Mail className="w-4 h-4" /> Enviar
            </button>
            <button onClick={handleDownload} className="flex-1 py-3 bg-white/60 border border-white/60 text-espresso text-sm rounded-full hover:bg-plum hover:text-cream transition-all flex items-center justify-center gap-2">
              <Download className="w-4 h-4" /> Baixar
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="lg:col-span-3">
          <div className="sticky top-6">
            <h2 className="text-sm font-medium text-espresso mb-3">Preview do Certificado</h2>
            <div className={`relative bg-white rounded-2xl overflow-hidden shadow-lg mx-auto max-w-[700px] aspect-[1.414/1] ${template.borderStyle}`}
              style={{ borderColor: template.accentColor }}>
              {/* Background */}
              <div className="absolute inset-0" style={{ background: template.bgColor }} />

              {/* Decorative elements */}
              {template.id === 'classic' && (
                <>
                  <div className="absolute top-6 left-6 right-6 bottom-6 border-2 rounded-xl" style={{ borderColor: template.accentColor + '30' }} />
                  <div className="absolute top-10 left-10 right-10 bottom-10 border rounded-xl" style={{ borderColor: template.accentColor + '15' }} />
                </>
              )}
              {template.id === 'modern' && (
                <div className="absolute top-0 left-0 bottom-0 w-2" style={{ background: template.accentColor }} />
              )}
              {template.id === 'corporate' && (
                <div className="absolute top-0 left-0 right-0 h-2" style={{ background: template.accentColor }} />
              )}

              {/* Fields */}
              {fields.map(field => (
                <div key={field.id}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 text-center ${selectedField === field.id ? 'ring-2 ring-plum/50' : ''} ${field.type === 'qrcode' ? 'bg-void rounded-lg flex items-center justify-center' : ''}`}
                  style={{
                    left: `${field.x}%`,
                    top: `${field.y}%`,
                    fontSize: `${field.fontSize}px`,
                    color: field.color,
                    width: `${field.width}%`,
                  }}>
                  {field.type === 'logo' && logoUrl && <img src={logoUrl} alt="Logo do Evento no Certificado" className="max-h-16 object-contain mx-auto" />}
                  {field.type === 'logo' && !logoUrl && <div className="text-xs text-espresso/20">LOGO</div>}
                  {field.type === 'signature' && sigUrl && <img src={sigUrl} alt="Assinatura do Produtor no Certificado" className="max-h-10 object-contain mx-auto" />}
                  {field.type === 'signature' && !sigUrl && <div className="text-lg" style={{ color: field.color }}>_________________</div>}
                  {field.type === 'qrcode' && <QrCode className="w-12 h-12 text-cream" />}
                  {field.type === 'text' && <div style={{ fontSize: `${field.fontSize}px`, color: field.color, fontWeight: field.fontSize > 20 ? 600 : 400 }}>{resolveValue(field)}</div>}
                  {field.type === 'date' && <div style={{ fontSize: `${field.fontSize}px`, color: field.color }}>{resolveValue(field)}</div>}
                  {field.type === 'hours' && <div style={{ fontSize: `${field.fontSize}px`, color: field.color }}>{resolveValue(field)}</div>}
                </div>
              ))}
            </div>

            {/* Variables help */}
            <div className="mt-4 p-4 bg-white/60 border border-white/60 rounded-2xl">
              <h3 className="text-xs font-medium text-espresso mb-2">Variaveis disponiveis:</h3>
              <div className="flex flex-wrap gap-2">
                {['{{NOME}}', '{{EVENTO}}', '{{DATA}}', '{{HORAS}}', '{{ASSINATURA}}', '{{DATA_EMISSAO}}'].map(v => (
                  <button key={v} onClick={() => navigator.clipboard.writeText(v)} className="px-2 py-1 bg-plum/5 text-plum text-[10px] rounded-lg hover:bg-plum/10 transition-all flex items-center gap-1">
                    <Copy className="w-3 h-3" /> {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Send Modal */}
      {showSend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-espresso/20 backdrop-blur-sm" onClick={() => setShowSend(false)} />
          <div className="relative w-full max-w-md bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-elevated">
            <h3 className="font-serif text-xl text-espresso mb-4">Enviar Certificados</h3>
            <p className="text-xs text-espresso/50 mb-3">Digite os emails separados por virgula</p>
            <textarea value={sendEmails} onChange={e => setSendEmails(e.target.value)} rows={4}
              placeholder="ana@email.com, pedro@email.com, ..."
              className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30 resize-none mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setShowSend(false)} className="flex-1 py-2.5 border border-espresso/15 text-espresso text-sm rounded-full hover:bg-espresso/5 transition-all">Cancelar</button>
              <button onClick={handleSend} className="flex-1 py-2.5 bg-plum text-cream text-sm rounded-full hover:shadow-glow transition-all flex items-center justify-center gap-2">
                <Send className="w-4 h-4" /> Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
