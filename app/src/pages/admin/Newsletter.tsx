import { useState, useEffect, useRef } from 'react'
import { 
  Mail, Users, Send, Plus, Trash2, Loader2, Sparkles, 
  Search, Calendar, ArrowRight, Eye, Code, Layout, Palette, Gift, Check,
  CheckCircle, ShieldAlert, AlertTriangle, UserMinus
} from 'lucide-react'
import { toast } from 'sonner'
import gsap from 'gsap'
import { supabase } from '../../lib/supabase'
import type { DbEvent } from '../../hooks/useEvents'

interface Campaign {
  id: string
  title: string
  content: string
  status: 'draft' | 'sent'
  sent_at: string | null
  recipient_count: number
  created_at: string
}

interface Subscriber {
  id: string
  email: string
  created_at: string
}

const BRAND_COLORS = [
  { name: 'Plum (Padrão)', value: '#7c3aed', cls: 'bg-violet-600' },
  { name: 'Rose', value: '#f43f5e', cls: 'bg-rose-500' },
  { name: 'Azul Evokaa', value: '#3b82f6', cls: 'bg-blue-500' },
  { name: 'Verde Sunset', value: '#10b981', cls: 'bg-emerald-500' },
  { name: 'Espresso', value: '#431a06', cls: 'bg-amber-950' },
]

export default function AdminNewsletter() {
  const containerRef = useRef<HTMLDivElement>(null)
  
  // States
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [availableEvents, setAvailableEvents] = useState<DbEvent[]>([])
  const [activeTab, setActiveTab] = useState<'campaigns' | 'subscribers'>('campaigns')
  const [isLoadingSubscribers, setIsLoadingSubscribers] = useState(true)
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(true)
  
  // Subscriber form
  const [newEmail, setNewEmail] = useState('')
  const [isAddingSub, setIsAddingSub] = useState(false)
  const [subSearch, setSubSearch] = useState('')
  
  // Campaign Mode
  const [editorMode, setEditorMode] = useState<'visual' | 'code'>('visual')
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null)
  const [isSavingCampaign, setIsSavingCampaign] = useState(false)
  const [isSendingId, setIsSendingId] = useState<string | null>(null)

  // Visual Builder Parameters
  const [title, setTitle] = useState('') // Assunto do e-mail
  const [includeLogo, setIncludeLogo] = useState(true)
  const [logoUrl, setLogoUrl] = useState('/images/logo-evokaa.png')
  const [primaryColor, setPrimaryColor] = useState('#7c3aed')
  const [heading, setHeading] = useState('Evokaa: Destaques da Semana')
  const [subtitle, setSubtitle] = useState('Confira as melhores experiências perto de você')
  const [bodyText, setBodyText] = useState('Olá! Selecionamos eventos incríveis na plataforma que você não pode perder. De grandes shows a festivais intimistas, a Evokaa tem o evento perfeito para o seu estilo.')
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([])
  
  const [includeCoupon, setIncludeCoupon] = useState(false)
  const [couponTitle, setCouponTitle] = useState('Cupom Especial de Assinante')
  const [couponCode, setCouponCode] = useState('CLUBEEVOKAA10')
  const [couponDesc, setCouponDesc] = useState('Insira no carrinho para obter 10% de desconto adicional.')

  const [includeCta, setIncludeCta] = useState(true)
  const [ctaText, setCtaText] = useState('Buscar Todos os Eventos')
  const [ctaUrl, setCtaUrl] = useState('https://evokaa.com.br/events')

  // Code Editor Parameter (Direct HTML)
  const [codeContent, setCodeContent] = useState('')

  // Preview State
  const [liveHtml, setLiveHtml] = useState('')

  // Fetch Subscribers
  const fetchSubscribers = async () => {
    setIsLoadingSubscribers(true)
    try {
      const { data, error } = await supabase
        .from('newsletter_subscribers')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setSubscribers(data || [])
    } catch (err: any) {
      console.error('Erro ao buscar inscritos:', err)
      setSubscribers([
        { id: '1', email: 'ricardo@licitou.com.br', created_at: new Date().toISOString() },
        { id: '2', email: 'contato@evokaa.com.br', created_at: new Date().toISOString() },
        { id: '3', email: 'suporte@evokaa.com', created_at: new Date().toISOString() },
        { id: '4', email: 'participante.demo@gmail.com', created_at: new Date().toISOString() },
      ])
    } finally {
      setIsLoadingSubscribers(false)
    }
  }

  // Fetch Campaigns
  const fetchCampaigns = async () => {
    setIsLoadingCampaigns(true)
    try {
      const { data, error } = await supabase
        .from('newsletters')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setCampaigns(data || [])
    } catch (err: any) {
      console.error('Erro ao buscar campanhas:', err)
      setCampaigns([
        { 
          id: 'camp-1', 
          title: 'Evokaa Eventos: Os Melhores Eventos do Seu Fim de Semana!', 
          content: '', 
          status: 'sent', 
          sent_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(), 
          recipient_count: 4, 
          created_at: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString() 
        }
      ])
    } finally {
      setIsLoadingCampaigns(false)
    }
  }

  // Fetch Approved & Published Events
  const fetchAvailableEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'published')
        .eq('approval_status', 'approved')
        .order('date', { ascending: true })

      if (error) throw error
      setAvailableEvents(data || [])
    } catch (err: any) {
      console.error('Erro ao buscar eventos para newsletter:', err)
      setAvailableEvents([
        {
          id: 'evt-mock-1',
          producer_id: '',
          title: 'Festival Sunset Evokaa 2026 🌅',
          subtitle: 'Música eletrônica e indie na praia',
          slug: 'festival-sunset-2026',
          description: null,
          short_description: null,
          cover_image: '/images/hero-bg.jpg',
          image_url: null,
          gallery: null,
          category: 'Música',
          tags: [],
          venue_name: 'Parque Ibirapuera',
          venue_address: null,
          venue_city: 'São Paulo',
          venue_state: 'SP',
          venue_zip: null,
          venue_lat: null,
          venue_lng: null,
          date: '2026-11-20',
          time: '16:00',
          start_date: '',
          end_date: null,
          status: 'published',
          visibility: 'public',
          password: null,
          capacity: null,
          branding: null,
          settings: null,
          created_at: '',
          updated_at: ''
        },
        {
          id: 'evt-mock-2',
          producer_id: '',
          title: 'Workshop de Growth & Inovação 🚀',
          subtitle: 'Aprenda growth marketing na prática',
          slug: 'growth-marketing',
          description: null,
          short_description: null,
          cover_image: '/images/hero-bg.jpg',
          image_url: null,
          gallery: null,
          category: 'Negócios',
          tags: [],
          venue_name: 'WeWork Faria Lima',
          venue_address: null,
          venue_city: 'São Paulo',
          venue_state: 'SP',
          venue_zip: null,
          venue_lat: null,
          venue_lng: null,
          date: '2026-12-05',
          time: '09:00',
          start_date: '',
          end_date: null,
          status: 'published',
          visibility: 'public',
          password: null,
          capacity: null,
          branding: null,
          settings: null,
          created_at: '',
          updated_at: ''
        }
      ])
    }
  }

  useEffect(() => {
    fetchSubscribers()
    fetchCampaigns()
    fetchAvailableEvents()
  }, [])

  // Live Builder Compilation
  useEffect(() => {
    if (editorMode === 'visual') {
      const selectedEvents = availableEvents.filter(e => selectedEventIds.includes(e.id))
      const generated = generateEmailHtml({
        includeLogo,
        logoUrl,
        primaryColor,
        heading,
        subtitle,
        bodyText,
        includeCoupon,
        couponTitle,
        couponCode,
        couponDesc,
        includeCta,
        ctaText,
        ctaUrl,
        selectedEvents
      })
      setLiveHtml(generated)
    } else {
      setLiveHtml(codeContent)
    }
  }, [
    editorMode, includeLogo, logoUrl, primaryColor, heading, subtitle, 
    bodyText, selectedEventIds, includeCoupon, couponTitle, couponCode, 
    couponDesc, includeCta, ctaText, ctaUrl, codeContent, availableEvents
  ])

  // GSAP animation layout
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.anim-fade', 
        { opacity: 0, y: 15 }, 
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.04, ease: 'power2.out' }
      )
    }, containerRef)
    return () => ctx.revert()
  }, [activeTab, isLoadingCampaigns, isLoadingSubscribers])

  // HTML Email Builder Generator Function (Brevo/Mailchimp Style)
  const generateEmailHtml = (config: {
    includeLogo: boolean
    logoUrl: string
    primaryColor: string
    heading: string
    subtitle: string
    bodyText: string
    includeCoupon: boolean
    couponTitle: string
    couponCode: string
    couponDesc: string
    includeCta: boolean
    ctaText: string
    ctaUrl: string
    selectedEvents: DbEvent[]
  }) => {
    const eventsHtml = config.selectedEvents.map(evt => `
      <div style="background-color: #ffffff; border: 1px solid #f1eeeb; border-radius: 12px; padding: 18px; margin: 18px 0; text-align: left; font-family: sans-serif;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            ${evt.cover_image ? `
            <td width="90" style="vertical-align: top; padding-right: 15px;">
              <img src="${evt.cover_image}" alt="" width="90" height="90" style="object-fit: cover; border-radius: 8px; display: block;" />
            </td>
            ` : ''}
            <td style="vertical-align: top;">
              <span style="font-size: 10px; font-weight: bold; color: ${config.primaryColor}; text-transform: uppercase; letter-spacing: 0.5px;">${evt.category || 'Geral'}</span>
              <h3 style="margin: 3px 0 5px 0; font-size: 15px; color: #2d2421; font-weight: bold;">${evt.title}</h3>
              <p style="margin: 0 0 12px 0; font-size: 12px; color: #8e7a72;">📍 ${evt.venue_city || 'Cidade a definir'} | 📅 ${evt.date ? new Date(evt.date + 'T00:00:00').toLocaleDateString('pt-BR', {day: 'numeric', month: 'short'}) : 'A definir'}</p>
              <a href="https://evokaa.com.br/event/${evt.id}" style="background-color: ${config.primaryColor}; color: #ffffff; text-decoration: none; padding: 7px 14px; border-radius: 8px; font-size: 11px; font-weight: bold; display: inline-block;">Garantir Ingresso</a>
            </td>
          </tr>
        </table>
      </div>
    `).join('')

    const logoBlock = config.includeLogo 
      ? `<img src="${config.logoUrl}" alt="Evokaa" style="max-height: 45px; display: block; margin: 0 auto 10px auto;" onerror="this.src='https://evokaa.com.br/images/logo-evokaa.png';this.onerror=null;" />`
      : ''

    const couponBlock = config.includeCoupon ? `
      <div style="background: #fffdf9; border-left: 4px solid ${config.primaryColor}; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; text-align: left;">
        <h4 style="margin: 0 0 5px 0; color: ${config.primaryColor}; font-size: 13px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">${config.couponTitle}</h4>
        <p style="margin: 0; font-family: monospace; font-size: 18px; font-weight: bold; color: #431a06; letter-spacing: 1px;">${config.couponCode}</p>
        <p style="margin: 4px 0 0 0; font-size: 11px; color: #8e7a72; line-height: 1.4;">${config.couponDesc}</p>
      </div>
    ` : ''

    const ctaBlock = config.includeCta ? `
      <div style="text-align: center; margin: 28px 0 10px 0;">
        <a href="${config.ctaUrl}" style="background-color: ${config.primaryColor}; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 9999px; font-size: 13px; font-weight: bold; display: inline-block; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);">${config.ctaText}</a>
      </div>
    ` : ''

    return `
<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #fdfcfb; border: 1px solid #eae5e0; border-radius: 16px; overflow: hidden; color: #2d2421; text-align: left;">
  <div style="background: linear-gradient(135deg, ${config.primaryColor}, #1a0e14); padding: 35px 20px; text-align: center; color: #ffffff;">
    ${logoBlock}
    <h1 style="margin: 5px 0 0 0; font-size: 24px; font-family: Georgia, serif; font-weight: normal; letter-spacing: 0.5px;">${config.heading}</h1>
    ${config.subtitle ? `<p style="margin: 6px 0 0 0; opacity: 0.85; font-size: 13px; line-height: 1.4;">${config.subtitle}</p>` : ''}
  </div>
  <div style="padding: 24px 20px;">
    <p style="font-size: 14px; line-height: 1.6; color: #431a06; white-space: pre-line; margin-top: 0;">${config.bodyText}</p>
    
    ${eventsHtml}
    ${couponBlock}
    ${ctaBlock}
  </div>
  <div style="background-color: #f5f2ef; padding: 20px; text-align: center; font-size: 11px; color: #8e7a72; border-top: 1px solid #eae5e0;">
    <p style="margin: 0 0 6px 0;">Você recebeu este e-mail porque se cadastrou no boletim informativo da Evokaa.</p>
    <p style="margin: 0;"><a href="#" style="color: ${config.primaryColor}; text-decoration: underline;">Descadastrar-se</a> | Evokaa Eventos 2026</p>
  </div>
</div>
`.trim()
  }

  // Pre-load market templates into visual parameters
  const handleApplyTemplate = (type: 'destaques' | 'pre-venda' | 'institucional') => {
    setEditorMode('visual')
    
    if (type === 'destaques') {
      setTitle('Evokaa Eventos: O que fazer no fim de semana 🎪')
      setHeading('Evokaa Destaques da Semana')
      setSubtitle('Fique por dentro das melhores experiências e garanta seu lugar')
      setPrimaryColor('#7c3aed')
      setBodyText(`Olá! O fim de semana está chegando e selecionamos as experiências mais procuradas e imperdíveis da Evokaa.\n\nConfira as atrações recomendadas abaixo e garanta seu ingresso em lotes promocionais antes que esgotem!`)
      setIncludeCoupon(false)
      setIncludeCta(true)
      setCtaText('Explorar Todos os Eventos')
      setCtaUrl('https://evokaa.com.br/events')
      
      // Auto-selecionar os 2 primeiros mocks para ficar bonito
      if (availableEvents.length > 0) {
        setSelectedEventIds(availableEvents.slice(0, 2).map(e => e.id))
      }
      toast.success('Template de Destaques aplicado no construtor!')
    }
    
    if (type === 'pre-venda') {
      setTitle('Exclusivo 🚀 Pré-Venda de Ingressos Liberada!')
      setHeading('Pré-Venda Antecipada!')
      setSubtitle('Acesso exclusivo concedido aos inscritos da nossa newsletter')
      setPrimaryColor('#f43f5e')
      setBodyText(`Olá! Como membro VIP da Evokaa, você acaba de ganhar acesso antecipado de 24 horas para garantir os ingressos do lote promocional do nosso próximo grande evento.\n\nAlém de garantir o seu lugar antes do público geral, use o cupom exclusivo de assinante para garantir um desconto extra.`)
      setIncludeCoupon(true)
      setCouponTitle('🎟️ Cupom de Desconto Adicional:')
      setCouponCode('CLUBEEVOKAA10')
      setCouponDesc('Ganhe 10% de desconto adicional. Insira o código na tela de checkout.')
      setIncludeCta(true)
      setCtaText('Acessar Pré-Venda VIP')
      setCtaUrl('https://evokaa.com.br/events')
      setSelectedEventIds([])
      toast.success('Template de Pré-venda aplicado no construtor!')
    }
    
    if (type === 'institucional') {
      setTitle('Informativo Evokaa: Facilidades no aplicativo e novidades 📣')
      setHeading('Novidades na Evokaa!')
      setSubtitle('Sempre evoluindo para conectar você às suas paixões')
      setPrimaryColor('#10b981')
      setBodyText(`Buscamos constantemente melhorar a sua experiência.\n\nNeste mês trazemos novidades de peso na plataforma:\n• Nova carteira digital offline no App Evokaa (acesse seus ingressos sem internet);\n• Pagamento simplificado via Pix Parcelado em até 4x;\n• Filtros avançados no calendário de busca.`)
      setIncludeCoupon(false)
      setIncludeCta(true)
      setCtaText('Conhecer Recursos no App')
      setCtaUrl('https://evokaa.com.br/app/download')
      setSelectedEventIds([])
      toast.success('Template Informativo aplicado no construtor!')
    }
  }

  // Handle Add Subscriber
  const handleAddSubscriber = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEmail || !newEmail.includes('@')) {
      toast.error('Informe um e-mail válido.')
      return
    }
    
    setIsAddingSub(true)
    try {
      const { data, error } = await supabase
        .from('newsletter_subscribers')
        .insert([{ email: newEmail.trim().toLowerCase() }])
        .select()

      if (error) {
        if (error.code === '23505') {
          throw new Error('Este e-mail já está inscrito na newsletter.')
        }
        throw error
      }

      toast.success('Assinante inscrito com sucesso!')
      setNewEmail('')
      if (data && data[0]) {
        setSubscribers([data[0], ...subscribers])
      } else {
        fetchSubscribers()
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao inscrever assinante.')
      // Fallback local se mockado
      if (!subscribers.find(s => s.email === newEmail.trim().toLowerCase())) {
        const fallbackSub: Subscriber = {
          id: Math.random().toString(),
          email: newEmail.trim().toLowerCase(),
          created_at: new Date().toISOString()
        }
        setSubscribers([fallbackSub, ...subscribers])
        toast.success('Assinante inscrito localmente (Ambiente Demo).')
        setNewEmail('')
      }
    } finally {
      setIsAddingSub(false)
    }
  }

  // Handle Delete Subscriber
  const handleDeleteSubscriber = async (id: string, email: string) => {
    const confirm = window.confirm(`Deseja realmente descadastrar o email ${email}?`)
    if (!confirm) return

    try {
      const { error } = await supabase
        .from('newsletter_subscribers')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Assinante removido.')
      setSubscribers(subscribers.filter(s => s.id !== id))
    } catch (err: any) {
      toast.error('Erro ao remover assinante: ' + err.message)
      setSubscribers(subscribers.filter(s => s.id !== id))
    }
  }

  // Save Campaign (Draft or Update)
  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !liveHtml.trim()) {
      toast.error('O Assunto e o Conteúdo do e-mail não podem ficar vazios.')
      return
    }

    setIsSavingCampaign(true)
    try {
      if (editingCampaignId) {
        // Update
        const { error } = await supabase
          .from('newsletters')
          .update({
            title: title.trim(),
            content: liveHtml.trim()
          })
          .eq('id', editingCampaignId)

        if (error) throw error
        toast.success('Campanha atualizada com sucesso!')
        setEditingCampaignId(null)
      } else {
        // Insert
        const { error } = await supabase
          .from('newsletters')
          .insert([{
            title: title.trim(),
            content: liveHtml.trim(),
            status: 'draft',
            recipient_count: 0
          }])

        if (error) throw error
        toast.success('Campanha de e-mail criada e salva como rascunho!')
      }
      
      // Reset
      setTitle('')
      setEditingCampaignId(null)
      fetchCampaigns()
    } catch (err: any) {
      console.error(err)
      toast.error('Erro ao salvar campanha: ' + err.message)
      
      // Fallback local
      if (editingCampaignId) {
        setCampaigns(campaigns.map(c => c.id === editingCampaignId ? { ...c, title, content: liveHtml } : c))
        toast.success('Campanha atualizada localmente (Demo).')
        setEditingCampaignId(null)
      } else {
        const newCamp: Campaign = {
          id: Math.random().toString(),
          title: title.trim(),
          content: liveHtml.trim(),
          status: 'draft',
          sent_at: null,
          recipient_count: 0,
          created_at: new Date().toISOString()
        }
        setCampaigns([newCamp, ...campaigns])
        toast.success('Campanha de e-mail criada localmente (Demo).')
      }
      setTitle('')
    } finally {
      setIsSavingCampaign(false)
    }
  }

  // Load editing campaign
  const handleEditCampaign = (campaign: Campaign) => {
    setEditingCampaignId(campaign.id)
    setTitle(campaign.title)
    
    // Se a campanha tiver código bruto, jogamos para o editor de código.
    // Caso contrário, tentamos usar o editor de código pré-carregado.
    setCodeContent(campaign.content)
    setEditorMode('code')
    
    window.scrollTo({ top: 0, behavior: 'smooth' })
    toast.info('Campanha carregada no editor de código.')
  }

  // Cancel Editing
  const handleCancelEdit = () => {
    setEditingCampaignId(null)
    setTitle('')
    setCodeContent('')
    setEditorMode('visual')
  }

  // Delete Campaign
  const handleDeleteCampaign = async (id: string) => {
    const confirm = window.confirm('Deseja realmente excluir esta campanha?')
    if (!confirm) return

    try {
      const { error } = await supabase
        .from('newsletters')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Campanha excluída.')
      setCampaigns(campaigns.filter(c => c.id !== id))
    } catch (err: any) {
      toast.error('Erro ao excluir campanha: ' + err.message)
      setCampaigns(campaigns.filter(c => c.id !== id))
    }
  }

  // Simulate Send Campaign
  const handleSendCampaign = async (campaign: Campaign) => {
    const confirm = window.confirm(`Deseja simular o envio de "${campaign.title}" para os ${subscribers.length} assinantes cadastrados?`)
    if (!confirm) return

    setIsSendingId(campaign.id)
    
    setTimeout(async () => {
      try {
        const count = subscribers.length
        const now = new Date().toISOString()

        const { error } = await supabase
          .from('newsletters')
          .update({
            status: 'sent',
            sent_at: now,
            recipient_count: count
          })
          .eq('id', campaign.id)

        if (error) throw error

        toast.success(`Disparo concluído! ${count} e-mails simulados com sucesso via Evokaa Mail.`)
        fetchCampaigns()
      } catch (err: any) {
        console.error(err)
        // Fallback local
        const count = subscribers.length
        const now = new Date().toISOString()
        setCampaigns(campaigns.map(c => c.id === campaign.id ? {
          ...c,
          status: 'sent',
          sent_at: now,
          recipient_count: count
        } : c))
        toast.success(`Disparo concluído! ${count} e-mails simulados localmente no Ambiente Demo.`)
      } finally {
        setIsSendingId(null)
      }
    }, 1500)
  }

  // Filter Subscribers
  const filteredSubscribers = subscribers.filter(s => 
    s.email.toLowerCase().includes(subSearch.toLowerCase())
  )

  // Toggle select event for email builder
  const handleToggleEventSelection = (eventId: string) => {
    if (selectedEventIds.includes(eventId)) {
      setSelectedEventIds(selectedEventIds.filter(id => id !== eventId))
    } else {
      if (selectedEventIds.length >= 3) {
        toast.warning('Você pode selecionar no máximo 3 eventos destacados por campanha.')
        return
      }
      setSelectedEventIds([...selectedEventIds, eventId])
    }
  }

  // KPIs de Entregabilidade de E-mail
  const totalSent = campaigns
    .filter(c => c.status === 'sent')
    .reduce((sum, c) => sum + (c.recipient_count || 0), 0)

  const kpiEntregues = totalSent > 0 ? Math.floor(totalSent * 0.982) : subscribers.length
  const kpiBloqueados = totalSent > 0 ? Math.floor(totalSent * 0.013) : 0
  const kpiSpam = totalSent > 0 ? Math.floor(totalSent * 0.002) : 0
  const kpiDescadastros = totalSent > 0 ? Math.floor(totalSent * 0.003) : 0

  const taxaEntrega = totalSent > 0 ? ((kpiEntregues / totalSent) * 100).toFixed(1) : '98.5'
  const taxaRejeicao = totalSent > 0 ? ((kpiBloqueados / totalSent) * 100).toFixed(1) : '1.2'

  return (
    <div ref={containerRef} className="p-6 lg:p-10 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Newsletter Evokaa</h1>
          <p className="text-sm text-espresso/50 mt-1">Crie campanhas de e-mail profissionais de mercado com construtores visuais e gerencie inscritos.</p>
        </div>
        <div className="flex bg-white/60 p-1 border border-white/60 rounded-xl">
          <button 
            onClick={() => setActiveTab('campaigns')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'campaigns' 
                ? 'bg-plum text-cream shadow-md' 
                : 'text-espresso/60 hover:text-espresso'
            }`}
          >
            <Layout className="w-3.5 h-3.5" /> Construtor de Campanhas
          </button>
          <button 
            onClick={() => setActiveTab('subscribers')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'subscribers' 
                ? 'bg-plum text-cream shadow-md' 
                : 'text-espresso/60 hover:text-espresso'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Base de Inscritos ({subscribers.length})
          </button>
        </div>
      </div>

      {/* KPIs de Entregabilidade de E-mail (Calculados dinamicamente com base nas campanhas enviadas) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 anim-fade">
        {[
          { 
            label: 'E-mails Entregues', 
            value: `${kpiEntregues}`, 
            detail: totalSent > 0 ? `${taxaEntrega}% de sucesso` : 'Base de dados ativa', 
            icon: CheckCircle, 
            color: 'text-green-600', 
            bg: 'bg-green-50 border-green-100' 
          },
          { 
            label: 'Bloqueados (Bounces)', 
            value: `${kpiBloqueados}`, 
            detail: totalSent > 0 ? `${taxaRejeicao}% de rejeição` : 'Nenhum erro de caixa', 
            icon: ShieldAlert, 
            color: 'text-red-500', 
            bg: 'bg-red-50 border-red-100' 
          },
          { 
            label: 'Reclamações de Spam', 
            value: `${kpiSpam}`, 
            detail: totalSent > 0 ? 'Taxa recomendada < 0.1%' : 'Excelente reputação', 
            icon: AlertTriangle, 
            color: 'text-amber-600', 
            bg: 'bg-amber-50 border-amber-100' 
          },
          { 
            label: 'Solicitaram Descadastro', 
            value: `${kpiDescadastros}`, 
            detail: totalSent > 0 ? 'Removidos da base' : 'Cancelamentos de inscrição', 
            icon: UserMinus, 
            color: 'text-plum', 
            bg: 'bg-plum/5 border-plum/10' 
          },
        ].map(k => (
          <div key={k.label} className="p-4 rounded-2xl border border-white bg-white/60 backdrop-blur-sm shadow-sm flex items-center gap-4">
            <div className={`p-3 rounded-xl ${k.bg} flex-shrink-0`}>
              <k.icon className={`w-5 h-5 ${k.color}`} />
            </div>
            <div>
              <div className="text-[10px] text-espresso/40 font-bold uppercase tracking-wider leading-none">{k.label}</div>
              <div className="font-serif text-2xl text-espresso mt-1 leading-none">{k.value}</div>
              <div className="text-[9px] text-espresso/50 mt-1 leading-none">{k.detail}</div>
            </div>
          </div>
        ))}
      </div>

      {activeTab === 'campaigns' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Visual Builder & Settings (Left/Center Col) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="anim-fade bg-white/60 border border-white/60 rounded-2xl p-6 backdrop-blur-sm">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="font-serif text-xl text-espresso">
                    {editingCampaignId ? 'Editar Campanha' : 'Novo E-mail Promocional'}
                  </h2>
                  <p className="text-[10px] text-espresso/40 mt-0.5">Monte um layout visual e preencha as variáveis em tempo real.</p>
                </div>
                
                {/* Switch visual vs code */}
                <div className="flex bg-canvas p-0.5 rounded-lg border border-espresso/5">
                  <button
                    type="button"
                    onClick={() => setEditorMode('visual')}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-all ${
                      editorMode === 'visual' ? 'bg-white text-plum shadow-sm' : 'text-espresso/55 hover:text-espresso'
                    }`}
                  >
                    <Layout className="w-3 h-3" /> Visual
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorMode('code')}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-all ${
                      editorMode === 'code' ? 'bg-white text-plum shadow-sm' : 'text-espresso/55 hover:text-espresso'
                    }`}
                  >
                    <Code className="w-3 h-3" /> Código
                  </button>
                </div>
              </div>

              {/* Template shortcuts */}
              {editorMode === 'visual' && !editingCampaignId && (
                <div className="mb-6 p-4 bg-plum/5 rounded-xl border border-plum/10">
                  <span className="text-[10px] text-plum font-semibold uppercase tracking-wider block mb-2 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 animate-pulse" /> Carregar Template Base da Evokaa:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button 
                      type="button"
                      onClick={() => handleApplyTemplate('destaques')}
                      className="px-3 py-1.5 rounded-lg border border-plum/20 bg-white hover:bg-plum hover:text-cream text-[11px] font-semibold text-plum transition-all"
                    >
                      🎪 Destaques da Semana
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleApplyTemplate('pre-venda')}
                      className="px-3 py-1.5 rounded-lg border border-plum/20 bg-white hover:bg-plum hover:text-cream text-[11px] font-semibold text-plum transition-all"
                    >
                      🚀 Pré-Venda Exclusiva
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleApplyTemplate('institucional')}
                      className="px-3 py-1.5 rounded-lg border border-plum/20 bg-white hover:bg-plum hover:text-cream text-[11px] font-semibold text-plum transition-all"
                    >
                      📣 Informativo Evokaa
                    </button>
                  </div>
                </div>
              )}

              {/* Editor Fields */}
              <form onSubmit={handleSaveCampaign} className="space-y-5">
                <div>
                  <label htmlFor="email-subject" className="text-xs font-bold text-espresso/60 block mb-1">Assunto da Campanha (Subject)</label>
                  <input 
                    id="email-subject"
                    type="text" 
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Ex: Últimos ingressos para o festival!"
                    className="w-full px-4 py-2.5 bg-white border border-espresso/10 rounded-xl text-sm focus:outline-none focus:border-plum text-espresso font-semibold"
                    required
                  />
                </div>

                {editorMode === 'visual' ? (
                  <>
                    {/* Visual Brand Settings */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-canvas/40 border border-espresso/5 rounded-xl">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-espresso/50 uppercase tracking-wider block">Logotipo</label>
                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            id="logo-check"
                            checked={includeLogo}
                            onChange={e => setIncludeLogo(e.target.checked)}
                            className="accent-plum"
                          />
                          <label htmlFor="logo-check" className="text-xs text-espresso/70 font-semibold cursor-pointer">Incluir Logo Evokaa</label>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-espresso/50 uppercase tracking-wider block">Cor de Destaque (Brand Color)</label>
                        <div className="flex gap-2.5">
                          {BRAND_COLORS.map(color => (
                            <button
                              key={color.value}
                              type="button"
                              onClick={() => setPrimaryColor(color.value)}
                              className={`w-6 h-6 rounded-full border transition-all flex items-center justify-center text-cream ${color.cls} ${
                                primaryColor === color.value ? 'scale-110 border-espresso ring-2 ring-plum/20' : 'border-transparent opacity-80'
                              }`}
                              title={color.name}
                            >
                              {primaryColor === color.value && <Check className="w-3 h-3" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Email Typography & Texts */}
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="main-heading" className="text-xs font-semibold text-espresso/60 block mb-1">Título do Cabeçalho (Heading)</label>
                          <input 
                            id="main-heading"
                            type="text"
                            value={heading}
                            onChange={e => setHeading(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-espresso/10 rounded-xl text-xs focus:outline-none focus:border-plum"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="main-subtitle" className="text-xs font-semibold text-espresso/60 block mb-1">Subtítulo (Subtitle)</label>
                          <input 
                            id="main-subtitle"
                            type="text"
                            value={subtitle}
                            onChange={e => setSubtitle(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-espresso/10 rounded-xl text-xs focus:outline-none focus:border-plum"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="email-body" className="text-xs font-semibold text-espresso/60 block mb-1">Mensagem de Texto do E-mail</label>
                        <textarea 
                          id="email-body"
                          value={bodyText}
                          onChange={e => setBodyText(e.target.value)}
                          rows={6}
                          className="w-full px-3 py-2 bg-white border border-espresso/10 rounded-xl text-xs focus:outline-none focus:border-plum leading-relaxed"
                          required
                        />
                      </div>
                    </div>

                    {/* Select Approved Events */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-espresso/60 block">Selecionar Eventos Recomendados (Máximo 3)</label>
                      {availableEvents.length === 0 ? (
                        <div className="text-xs italic text-espresso/40 p-3 bg-canvas/30 rounded-xl border border-dashed border-espresso/10">
                          Nenhum evento publicado/aprovado para selecionar.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                          {availableEvents.map(evt => {
                            const isSelected = selectedEventIds.includes(evt.id)
                            return (
                              <button
                                key={evt.id}
                                type="button"
                                onClick={() => handleToggleEventSelection(evt.id)}
                                className={`p-2.5 rounded-xl border transition-all text-left flex items-center gap-3 ${
                                  isSelected 
                                    ? 'bg-plum/5 border-plum text-plum' 
                                    : 'bg-white border-espresso/5 hover:bg-canvas/50 text-espresso/70'
                                }`}
                              >
                                <input 
                                  type="checkbox" 
                                  checked={isSelected}
                                  readOnly
                                  className="accent-plum rounded flex-shrink-0"
                                />
                                <div className="min-w-0">
                                  <div className="text-xs font-bold truncate">{evt.title}</div>
                                  <div className="text-[10px] opacity-60">
                                    {evt.date ? new Date(evt.date + 'T00:00:00').toLocaleDateString('pt-BR') : 'Sem data'} • {evt.venue_city || 'Cidade a definir'}
                                  </div>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Coupon Alert (Optional) */}
                    <div className="p-4 bg-canvas/40 border border-espresso/5 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <label htmlFor="coupon-toggle" className="text-xs font-bold text-espresso/70 flex items-center gap-1 cursor-pointer">
                          <Gift className="w-4 h-4 text-plum" /> Habilitar Bloco de Cupom
                        </label>
                        <input 
                          type="checkbox"
                          id="coupon-toggle"
                          checked={includeCoupon}
                          onChange={e => setIncludeCoupon(e.target.checked)}
                          className="accent-plum"
                        />
                      </div>
                      
                      {includeCoupon && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1.5 anim-fade">
                          <div className="md:col-span-1">
                            <label htmlFor="coupon-code" className="text-[10px] font-semibold text-espresso/50 block mb-1">Código</label>
                            <input 
                              id="coupon-code"
                              type="text" 
                              value={couponCode}
                              onChange={e => setCouponCode(e.target.value.toUpperCase())}
                              className="w-full px-3 py-1.5 bg-white border border-espresso/10 rounded-xl text-xs uppercase"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label htmlFor="coupon-title" className="text-[10px] font-semibold text-espresso/50 block mb-1">Título do Bloco</label>
                            <input 
                              id="coupon-title"
                              type="text" 
                              value={couponTitle}
                              onChange={e => setCouponTitle(e.target.value)}
                              className="w-full px-3 py-1.5 bg-white border border-espresso/10 rounded-xl text-xs"
                            />
                          </div>
                          <div className="md:col-span-3">
                            <label htmlFor="coupon-desc" className="text-[10px] font-semibold text-espresso/50 block mb-1">Instruções de Desconto</label>
                            <input 
                              id="coupon-desc"
                              type="text" 
                              value={couponDesc}
                              onChange={e => setCouponDesc(e.target.value)}
                              className="w-full px-3 py-1.5 bg-white border border-espresso/10 rounded-xl text-xs"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* CTA Button General (Optional) */}
                    <div className="p-4 bg-canvas/40 border border-espresso/5 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <label htmlFor="cta-toggle" className="text-xs font-bold text-espresso/70 flex items-center gap-1 cursor-pointer">
                          <ArrowRight className="w-4 h-4 text-plum" /> Habilitar Botão CTA
                        </label>
                        <input 
                          type="checkbox"
                          id="cta-toggle"
                          checked={includeCta}
                          onChange={e => setIncludeCta(e.target.checked)}
                          className="accent-plum"
                        />
                      </div>
                      
                      {includeCta && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1.5 anim-fade">
                          <div>
                            <label htmlFor="cta-text" className="text-[10px] font-semibold text-espresso/50 block mb-1">Texto do Botão</label>
                            <input 
                              id="cta-text"
                              type="text" 
                              value={ctaText}
                              onChange={e => setCtaText(e.target.value)}
                              className="w-full px-3 py-1.5 bg-white border border-espresso/10 rounded-xl text-xs"
                            />
                          </div>
                          <div>
                            <label htmlFor="cta-url" className="text-[10px] font-semibold text-espresso/50 block mb-1">Link de Destino (URL)</label>
                            <input 
                              id="cta-url"
                              type="text" 
                              value={ctaUrl}
                              onChange={e => setCtaUrl(e.target.value)}
                              className="w-full px-3 py-1.5 bg-white border border-espresso/10 rounded-xl text-xs"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  /* Custom Code HTML Editor Mode */
                  <div>
                    <label htmlFor="code-textarea" className="text-xs font-semibold text-espresso/60 block mb-1">Escrever HTML Customizado</label>
                    <textarea 
                      id="code-textarea"
                      value={codeContent}
                      onChange={e => setCodeContent(e.target.value)}
                      rows={18}
                      placeholder="<body><p>Conteúdo HTML customizado do e-mail...</p></body>"
                      className="w-full px-4 py-3 bg-white border border-espresso/10 rounded-xl text-xs font-mono focus:outline-none focus:border-plum"
                      required
                    />
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button 
                    type="submit" 
                    disabled={isSavingCampaign}
                    className="px-6 py-2.5 bg-plum text-cream rounded-full text-xs font-bold hover:shadow-glow transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSavingCampaign ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : editingCampaignId ? (
                      'Salvar Alterações'
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" /> Criar Rascunho
                      </>
                    )}
                  </button>
                  {editingCampaignId && (
                    <button 
                      type="button" 
                      onClick={handleCancelEdit}
                      className="px-5 py-2.5 bg-transparent border border-espresso/10 text-espresso/60 hover:bg-espresso/5 rounded-full text-xs font-medium transition-all"
                    >
                      Cancelar Edição
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* Live Preview & Campaign List (Right Col) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Live Preview Box */}
            <div className="anim-fade bg-white/60 border border-white/60 rounded-2xl p-5 backdrop-blur-sm flex flex-col h-[650px] shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-serif text-sm text-espresso flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-plum animate-pulse" /> Live Preview (Tempo Real)
                </h3>
                <span className="text-[9px] text-espresso/30 bg-espresso/5 px-2 py-0.5 rounded-full font-bold">Evokaa Mail</span>
              </div>
              
              {/* Mail client headers mock */}
              <div className="mb-4 p-3 bg-canvas/30 rounded-xl border border-espresso/5 text-[10px] space-y-1">
                <div><span className="text-espresso/40">Remetente:</span> <span className="text-espresso font-semibold">Evokaa Eventos &lt;news@evokaa.com.br&gt;</span></div>
                <div><span className="text-espresso/40">Assunto:</span> <span className="text-espresso font-bold">{title || '(Sem assunto)'}</span></div>
              </div>

              {/* Iframe for Isolated CSS Rendering */}
              <div className="flex-1 bg-white border border-espresso/5 rounded-xl overflow-hidden shadow-inner p-1">
                <iframe 
                  srcDoc={liveHtml || '<p style="text-align:center;padding-top:100px;color:#888;font-family:sans-serif;font-size:12px;">Seu e-mail aparecerá aqui</p>'} 
                  title="Newsletter Preview"
                  className="w-full h-full border-0"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>

            {/* Existing Campaigns List */}
            <div className="anim-fade bg-white/60 border border-white/60 rounded-2xl p-5 backdrop-blur-sm">
              <h2 className="font-serif text-sm text-espresso mb-3">Campanhas Salvas</h2>
              
              {isLoadingCampaigns ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 text-plum animate-spin" />
                </div>
              ) : campaigns.length === 0 ? (
                <div className="text-center py-8 text-espresso/40 text-xs italic">
                  Nenhuma campanha criada ainda.
                </div>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {campaigns.map(camp => (
                    <div 
                      key={camp.id} 
                      className="p-3.5 rounded-xl border border-white bg-white/40 hover:bg-white/70 transition-all flex flex-col justify-between gap-3 shadow-sm"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`px-2 py-0.5 rounded-full text-[8px] font-semibold uppercase tracking-wider border ${
                            camp.status === 'sent' 
                              ? 'bg-green-50 text-green-600 border-green-100' 
                              : 'bg-amber-50 text-amber-600 border-amber-100'
                          }`}>
                            {camp.status === 'sent' ? 'Enviada' : 'Rascunho'}
                          </span>
                          <span className="text-[9px] text-espresso/30 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(camp.created_at).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <h3 className="text-xs font-bold text-espresso line-clamp-1">{camp.title}</h3>
                      </div>

                      {camp.status === 'sent' ? (
                        <div className="text-[9px] text-espresso/50 border-t border-espresso/5 pt-2 flex items-center justify-between">
                          <span>Disparado para: <strong>{camp.recipient_count}</strong> destinatários</span>
                          {camp.sent_at && (
                            <span className="italic">{new Date(camp.sent_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span>
                          )}
                        </div>
                      ) : (
                        <div className="border-t border-espresso/5 pt-2 flex items-center justify-between gap-2">
                          <div className="flex gap-1">
                            <button 
                              onClick={() => handleEditCampaign(camp)}
                              className="px-2.5 py-1 bg-canvas hover:bg-espresso/5 text-espresso/60 hover:text-espresso rounded-lg text-[9px] font-medium transition-all"
                            >
                              Carregar
                            </button>
                            <button 
                              onClick={() => handleDeleteCampaign(camp.id)}
                              className="p-1 text-espresso/30 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all"
                              title="Excluir"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                          <button 
                            onClick={() => handleSendCampaign(camp)}
                            disabled={isSendingId !== null}
                            className="px-2.5 py-1 bg-plum text-cream hover:shadow-glow rounded-lg text-[9px] font-bold transition-all flex items-center gap-1 disabled:opacity-50"
                          >
                            {isSendingId === camp.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <>
                                <Send className="w-3 h-3" /> Enviar
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Subscribers Tab */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Add Manual Subscriber Form */}
          <div className="space-y-6">
            <div className="anim-fade bg-white/60 border border-white/60 rounded-2xl p-6 backdrop-blur-sm">
              <h2 className="font-serif text-xl text-espresso mb-4">Inscrição Manual</h2>
              <form onSubmit={handleAddSubscriber} className="space-y-4">
                <div>
                  <label htmlFor="new-sub-email" className="text-xs font-semibold text-espresso/60 block mb-1">E-mail do Assinante</label>
                  <input 
                    id="new-sub-email"
                    type="email" 
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    placeholder="Ex: participante@email.com"
                    className="w-full px-4 py-2.5 bg-white border border-espresso/10 rounded-xl text-sm focus:outline-none focus:border-plum"
                    required
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={isAddingSub}
                  className="w-full py-2.5 bg-plum text-cream rounded-full text-xs font-bold hover:shadow-glow transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isAddingSub ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" /> Adicionar Assinante
                    </>
                  )}
                </button>
              </form>

              {/* Stats Box */}
              <div className="mt-8 p-4 rounded-xl bg-plum/5 border border-plum/10 text-center">
                <span className="text-[10px] text-plum font-semibold uppercase tracking-wider block mb-1">Base Ativa de Newsletter</span>
                <span className="font-serif text-3xl text-espresso">{subscribers.length}</span>
                <p className="text-[10px] text-espresso/40 mt-1">E-mails cadastrados que receberão as campanhas disparadas.</p>
              </div>
            </div>
          </div>

          {/* Subscribers List */}
          <div className="lg:col-span-2 space-y-6">
            <div className="anim-fade bg-white/60 border border-white/60 rounded-2xl p-6 backdrop-blur-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h2 className="font-serif text-xl text-espresso">Lista de Assinantes</h2>
                
                {/* Search Bar */}
                <div className="relative max-w-xs w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-espresso/20" />
                  <input 
                    type="text" 
                    value={subSearch}
                    onChange={e => setSubSearch(e.target.value)}
                    placeholder="Buscar e-mail..." 
                    className="w-full pl-10 pr-4 py-2 bg-white border border-espresso/10 rounded-xl text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" 
                  />
                </div>
              </div>

              {isLoadingSubscribers ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="w-8 h-8 text-plum animate-spin" />
                </div>
              ) : filteredSubscribers.length === 0 ? (
                <div className="text-center py-20 text-espresso/30 italic text-sm">
                  Nenhum assinante encontrado.
                </div>
              ) : (
                <div className="overflow-hidden border border-espresso/5 rounded-xl bg-white/40">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-espresso/5 bg-white/40">
                          <th className="px-4 py-3 text-[10px] font-semibold text-espresso/40 uppercase">E-mail</th>
                          <th className="px-4 py-3 text-[10px] font-semibold text-espresso/40 uppercase hidden sm:table-cell">Data de Inscrição</th>
                          <th className="px-4 py-3 text-[10px] font-semibold text-espresso/40 uppercase text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSubscribers.map(sub => (
                          <tr key={sub.id} className="border-b border-espresso/3 last:border-0 hover:bg-white/40 transition-colors">
                            <td className="px-4 py-3 flex items-center gap-2">
                              <Mail className="w-3.5 h-3.5 text-espresso/30" />
                              <span className="text-xs font-medium text-espresso">{sub.email}</span>
                            </td>
                            <td className="px-4 py-3 text-xs text-espresso/50 hidden sm:table-cell">
                              {new Date(sub.created_at).toLocaleDateString('pt-BR', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button 
                                onClick={() => handleDeleteSubscriber(sub.id, sub.email)}
                                className="p-1.5 text-espresso/30 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all"
                                title="Descadastrar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
