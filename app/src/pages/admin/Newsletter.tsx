import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import gsap from 'gsap'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState, PageHeader, SectionTitle, Stat, chipAviso, chipNeutro, chipOk } from '@/components/producer/ui'
import { Tabela, alertaErro, painel, segmentoOn, segmentoOff, th, trilho } from '@/components/admin/ui'
import { cn } from '@/lib/utils'
import { supabase } from '../../lib/supabase'
import type { DbEvent } from '../../hooks/useEvents'
import { rotuloFormato } from '../../lib/tipoEvento'

interface Campaign {
  id: string
  title: string
  content: string
  status: 'draft' | 'sent'
  sent_at: string | null
  recipient_count: number | null
  created_at: string
}

interface Subscriber {
  id: string
  email: string
  created_at: string
  unsubscribed_at: string | null
}

const BRAND_COLORS = [
  { name: 'Plum (Padrão)', value: '#7c3aed', cls: 'bg-violet-600' },
  { name: 'Rose', value: '#f43f5e', cls: 'bg-rose-500' },
  { name: 'Azul Evokaa', value: '#3b82f6', cls: 'bg-blue-500' },
  { name: 'Verde Sunset', value: '#10b981', cls: 'bg-emerald-500' },
  { name: 'Espresso', value: '#431a06', cls: 'bg-amber-950' },
]

// E-mail não tem "site atual": caminho relativo (/images/...) sai quebrado no Gmail/Outlook
const abs = (url: string) => (url.startsWith('/') ? `https://www.evokaa.com.br${url}` : url)

// Mesma função da send-email. Título, categoria, cidade e capa do evento são escritos pelo produtor e vão
// para a caixa de todos os assinantes: sem escapar, um título com <a href> vira link de phishing no e-mail.
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

// Capa só se for https:// ou caminho do site (/...); qualquer outra coisa (javascript:, data:, http://, //outro-site) some.
export function eventoNewsletterHtml(evt: DbEvent, primaryColor: string) {
  const capa = evt.cover_image && /^(https:\/\/|\/[^/])/.test(evt.cover_image) ? evt.cover_image : null
  return `
    <div style="background-color: #ffffff; border: 1px solid #f1eeeb; border-radius: 12px; padding: 18px; margin: 18px 0; text-align: left; font-family: sans-serif;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          ${capa ? `
          <td width="90" style="vertical-align: top; padding-right: 15px;">
            <img src="${escapeHtml(abs(capa))}" alt="" width="90" height="90" style="object-fit: cover; border-radius: 8px; display: block;" />
          </td>
          ` : ''}
          <td style="vertical-align: top;">
            <span style="font-size: 10px; font-weight: bold; color: ${primaryColor}; text-transform: uppercase; letter-spacing: 0.5px;">${escapeHtml(rotuloFormato(evt.category) || 'Geral')}</span>
            <h3 style="margin: 3px 0 5px 0; font-size: 15px; color: #2d2421; font-weight: bold;">${escapeHtml(evt.title)}</h3>
            <p style="margin: 0 0 12px 0; font-size: 12px; color: #8e7a72;">📍 ${escapeHtml(evt.venue_city || 'Cidade a definir')} | 📅 ${evt.date ? new Date(evt.date + 'T00:00:00').toLocaleDateString('pt-BR', {day: 'numeric', month: 'short'}) : 'A definir'}</p>
            <a href="https://evokaa.com.br/event/${evt.id}" style="background-color: ${primaryColor}; color: #ffffff; text-decoration: none; padding: 7px 14px; border-radius: 8px; font-size: 11px; font-weight: bold; display: inline-block;">Garantir Ingresso</a>
          </td>
        </tr>
      </table>
    </div>
  `
}

export default function AdminNewsletter() {
  const containerRef = useRef<HTMLDivElement>(null)
  
  // States
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [availableEvents, setAvailableEvents] = useState<DbEvent[]>([])
  const [activeTab, setActiveTab] = useState<'campaigns' | 'subscribers'>('campaigns')
  const [isLoadingSubscribers, setIsLoadingSubscribers] = useState(true)
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(true)
  const [subscribersError, setSubscribersError] = useState<string | null>(null)
  const [campaignsError, setCampaignsError] = useState<string | null>(null)
  
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
    setSubscribersError(null)
    try {
      const { data, error } = await supabase
        .from('newsletter_subscribers')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setSubscribers((data || []) as Subscriber[])
    } catch (err: any) {
      console.error('Erro ao buscar inscritos:', err)
      setSubscribersError(err.message || 'erro desconhecido')
      setSubscribers([])
    } finally {
      setIsLoadingSubscribers(false)
    }
  }

  // Fetch Campaigns
  const fetchCampaigns = async () => {
    setIsLoadingCampaigns(true)
    setCampaignsError(null)
    try {
      const { data, error } = await supabase
        .from('newsletters')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setCampaigns(data || [])
    } catch (err: any) {
      console.error('Erro ao buscar campanhas:', err)
      setCampaignsError(err.message || 'erro desconhecido')
      setCampaigns([])
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
      setAvailableEvents([])
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
    const eventsHtml = config.selectedEvents.map(evt => eventoNewsletterHtml(evt, config.primaryColor)).join('')

    const logoBlock = config.includeLogo 
      ? `<img src="${abs(config.logoUrl)}" alt="Evokaa" style="max-height: 45px; display: block; margin: 0 auto 10px auto;" />`
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
    <p style="margin: 0;"><a href="%%UNSUBSCRIBE_URL%%" style="color: ${config.primaryColor}; text-decoration: underline;">Descadastrar-se</a> | Evokaa Eventos 2026</p>
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
    }
  }

  // Send Campaign — dispara de verdade pela Edge Function send-email (emailType: 'newsletter'),
  // que confere que quem chama é admin e reescreve o link de descadastro por assinante.
  const activeSubscriberCount = subscribers.filter(s => !s.unsubscribed_at).length

  const handleSendCampaign = async (campaign: Campaign) => {
    const confirm = window.confirm(`Enviar "${campaign.title}" de verdade para os ${activeSubscriberCount} assinantes ativos? Essa ação não pode ser desfeita.`)
    if (!confirm) return

    setIsSendingId(campaign.id)
    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: { emailType: 'newsletter', campaignId: campaign.id }
      })
      if (error) {
        // FunctionsHttpError esconde a mensagem da função ("já enviada", "sem permissão"...) no context
        const ctx = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context
        const msg = typeof ctx?.json === 'function'
          ? await ctx.json().then(b => b?.error).catch(() => undefined)
          : undefined
        throw new Error(msg || error.message)
      }
      if (data?.error) throw new Error(data.error)

      if (data.failed > 0) {
        toast.warning(`Disparo concluído com falhas: ${data.sentCount} de ${data.total} e-mails enviados (${data.failed} falharam).`)
      } else {
        toast.success(`Disparo concluído: ${data.sentCount} de ${data.total} e-mails enviados.`)
      }
    } catch (err: any) {
      console.error(err)
      toast.error('Erro ao disparar a campanha: ' + (err.message || 'erro desconhecido'))
    } finally {
      // recarrega sempre: mesmo com erro a campanha pode ter mudado (ex.: voltou a rascunho)
      fetchCampaigns()
      setIsSendingId(null)
    }
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

  // KPIs reais — sem estimativa: a Resend não tem webhook de entrega/bounce configurado ainda,
  // então só mostramos o que o banco realmente sabe (quantos e-mails saíram e quantos descadastraram)
  const totalSent = campaigns
    .filter(c => c.status === 'sent')
    .reduce((sum, c) => sum + (c.recipient_count || 0), 0)
  const kpiDescadastros = subscribers.filter(s => s.unsubscribed_at).length

  // Rótulo de campo do construtor
  const rotulo = 'mb-1 block text-xs font-semibold text-muted-foreground'
  // Caixa de bloco opcional (cupom, CTA, cores)
  const bloco = 'space-y-3 rounded-[10px] border border-border bg-secondary/50 p-4'
  const marca = 'size-4 shrink-0 accent-primary'

  return (
    <div ref={containerRef} className="p-6 lg:p-10 max-w-7xl">
      <PageHeader
        title="Newsletter Evokaa"
        description="Crie campanhas de e-mail profissionais de mercado com construtores visuais e gerencie inscritos."
        actions={
          <div className={trilho} role="group" aria-label="Seções da newsletter">
            {([
              ['campaigns', I.Painel, 'Construtor de Campanhas'],
              ['subscribers', I.Pessoas, `Base de Inscritos (${subscribers.length})`],
            ] as const).map(([id, Icone, texto]) => (
              <button
                key={id}
                type="button"
                aria-pressed={activeTab === id}
                onClick={() => setActiveTab(id)}
                className={activeTab === id ? segmentoOn : segmentoOff}
              >
                <Icone size={16} aria-hidden="true" /> {texto}
              </button>
            ))}
          </div>
        }
      />

      {/* KPIs reais — sem estimativa de entrega/bounce/spam (a Resend não tem webhook configurado) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 anim-fade">
        <Stat label="E-mails Enviados" value={`${totalSent}`} hint="Soma de todas as campanhas disparadas" />
        <Stat label="Assinantes Ativos" value={`${activeSubscriberCount}`} hint="Recebem a próxima campanha" />
        <Stat label="Descadastros" value={`${kpiDescadastros}`} hint="Pelo link no rodapé do e-mail" />
      </div>

      {activeTab === 'campaigns' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Visual Builder & Settings (Left/Center Col) */}
          <div className="lg:col-span-7 space-y-6">
            <div className={`anim-fade ${painel} p-6`}>
              <div className="mb-6 flex items-start justify-between gap-3">
                <div>
                  <SectionTitle>
                    {editingCampaignId ? 'Editar Campanha' : 'Novo E-mail Promocional'}
                  </SectionTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">Monte um layout visual e preencha as variáveis em tempo real.</p>
                </div>

                {/* Switch visual vs code */}
                <div className={cn(trilho, 'shrink-0')} role="group" aria-label="Modo do editor">
                  {([['visual', I.Painel, 'Visual'], ['code', I.Codigo, 'Código']] as const).map(([modo, Icone, texto]) => (
                    <button
                      key={modo}
                      type="button"
                      aria-pressed={editorMode === modo}
                      onClick={() => setEditorMode(modo)}
                      className={editorMode === modo ? segmentoOn : segmentoOff}
                    >
                      <Icone size={14} aria-hidden="true" /> {texto}
                    </button>
                  ))}
                </div>
              </div>

              {/* Template shortcuts */}
              {editorMode === 'visual' && !editingCampaignId && (
                <div className="mb-6 rounded-[10px] border border-border bg-secondary/50 p-4">
                  <span className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <I.Destaque size={14} className="text-primary" aria-hidden="true" /> Carregar Template Base da Evokaa:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => handleApplyTemplate('destaques')}>🎪 Destaques da Semana</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => handleApplyTemplate('pre-venda')}>🚀 Pré-Venda Exclusiva</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => handleApplyTemplate('institucional')}>📣 Informativo Evokaa</Button>
                  </div>
                </div>
              )}

              {/* Editor Fields */}
              <form onSubmit={handleSaveCampaign} className="space-y-5">
                <div>
                  <label htmlFor="email-subject" className={rotulo}>Assunto da Campanha (Subject)</label>
                  <Input
                    id="email-subject"
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Ex: Últimos ingressos para o festival!"
                    className="font-semibold"
                    required
                  />
                </div>

                {editorMode === 'visual' ? (
                  <>
                    {/* Visual Brand Settings */}
                    <div className="grid grid-cols-1 gap-4 rounded-[10px] border border-border bg-secondary/50 p-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <span className={rotulo}>Logotipo</span>
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id="logo-check"
                            checked={includeLogo}
                            onChange={e => setIncludeLogo(e.target.checked)}
                            className={marca}
                          />
                          <label htmlFor="logo-check" className="cursor-pointer text-xs font-semibold text-foreground">Incluir Logo Evokaa</label>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className={rotulo}>Cor de Destaque (Brand Color)</span>
                        <div className="flex gap-2.5">
                          {BRAND_COLORS.map(color => (
                            // a cor é a do e-mail (vai no HTML), não do tema do painel: por isso não usa token
                            <button
                              key={color.value}
                              type="button"
                              onClick={() => setPrimaryColor(color.value)}
                              aria-label={color.name}
                              aria-pressed={primaryColor === color.value}
                              className={`flex size-7 items-center justify-center rounded-full border text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${color.cls} ${
                                primaryColor === color.value ? 'scale-110 border-foreground ring-2 ring-[var(--ev-brand-soft)]' : 'border-transparent opacity-80'
                              }`}
                              title={color.name}
                            >
                              {primaryColor === color.value && <I.Check size={14} aria-hidden="true" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Email Typography & Texts */}
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="main-heading" className={rotulo}>Título do Cabeçalho (Heading)</label>
                          <Input
                            id="main-heading"
                            type="text"
                            value={heading}
                            onChange={e => setHeading(e.target.value)}
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="main-subtitle" className={rotulo}>Subtítulo (Subtitle)</label>
                          <Input
                            id="main-subtitle"
                            type="text"
                            value={subtitle}
                            onChange={e => setSubtitle(e.target.value)}
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="email-body" className={rotulo}>Mensagem de Texto do E-mail</label>
                        <Textarea
                          id="email-body"
                          value={bodyText}
                          onChange={e => setBodyText(e.target.value)}
                          rows={6}
                          className="leading-relaxed"
                          required
                        />
                      </div>
                    </div>

                    {/* Select Approved Events */}
                    <div className="space-y-2">
                      <span className={rotulo}>Selecionar Eventos Recomendados (Máximo 3)</span>
                      {availableEvents.length === 0 ? (
                        <div className="rounded-[10px] border border-dashed border-border p-3 text-xs text-muted-foreground">
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
                                aria-pressed={isSelected}
                                onClick={() => handleToggleEventSelection(evt.id)}
                                className={`flex items-center gap-3 rounded-[10px] border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                  isSelected
                                    ? 'border-primary bg-[var(--ev-brand-soft)] text-foreground'
                                    : 'border-border bg-card text-foreground hover:bg-[var(--ev-tint-hover)]'
                                }`}
                              >
                                <span aria-hidden="true" className={`flex size-4 shrink-0 items-center justify-center rounded-xs border ${isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-input'}`}>
                                  {isSelected && <I.Check size={12} />}
                                </span>
                                <div className="min-w-0">
                                  <div className="truncate text-xs font-semibold">{evt.title}</div>
                                  <div className="text-[11px] text-muted-foreground">
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
                    <div className={bloco}>
                      <div className="flex items-center justify-between">
                        <label htmlFor="coupon-toggle" className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-foreground">
                          <I.Presente size={16} className="text-primary" aria-hidden="true" /> Habilitar Bloco de Cupom
                        </label>
                        <input
                          type="checkbox"
                          id="coupon-toggle"
                          checked={includeCoupon}
                          onChange={e => setIncludeCoupon(e.target.checked)}
                          className={marca}
                        />
                      </div>

                      {includeCoupon && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1.5 anim-fade">
                          <div className="md:col-span-1">
                            <label htmlFor="coupon-code" className={rotulo}>Código</label>
                            <Input
                              id="coupon-code"
                              type="text"
                              value={couponCode}
                              onChange={e => setCouponCode(e.target.value.toUpperCase())}
                              className="uppercase"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label htmlFor="coupon-title" className={rotulo}>Título do Bloco</label>
                            <Input
                              id="coupon-title"
                              type="text"
                              value={couponTitle}
                              onChange={e => setCouponTitle(e.target.value)}
                            />
                          </div>
                          <div className="md:col-span-3">
                            <label htmlFor="coupon-desc" className={rotulo}>Instruções de Desconto</label>
                            <Input
                              id="coupon-desc"
                              type="text"
                              value={couponDesc}
                              onChange={e => setCouponDesc(e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* CTA Button General (Optional) */}
                    <div className={bloco}>
                      <div className="flex items-center justify-between">
                        <label htmlFor="cta-toggle" className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-foreground">
                          <I.SetaDireita size={16} className="text-primary" aria-hidden="true" /> Habilitar Botão CTA
                        </label>
                        <input
                          type="checkbox"
                          id="cta-toggle"
                          checked={includeCta}
                          onChange={e => setIncludeCta(e.target.checked)}
                          className={marca}
                        />
                      </div>

                      {includeCta && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1.5 anim-fade">
                          <div>
                            <label htmlFor="cta-text" className={rotulo}>Texto do Botão</label>
                            <Input
                              id="cta-text"
                              type="text"
                              value={ctaText}
                              onChange={e => setCtaText(e.target.value)}
                            />
                          </div>
                          <div>
                            <label htmlFor="cta-url" className={rotulo}>Link de Destino (URL)</label>
                            <Input
                              id="cta-url"
                              type="text"
                              value={ctaUrl}
                              onChange={e => setCtaUrl(e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  /* Custom Code HTML Editor Mode */
                  <div>
                    <label htmlFor="code-textarea" className={rotulo}>Escrever HTML Customizado</label>
                    <Textarea
                      id="code-textarea"
                      value={codeContent}
                      onChange={e => setCodeContent(e.target.value)}
                      rows={18}
                      placeholder="<body><p>Conteúdo HTML customizado do e-mail...</p></body>"
                      className="font-mono text-xs"
                      required
                    />
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <Button type="submit" loading={isSavingCampaign}>
                    {editingCampaignId ? (
                      'Salvar Alterações'
                    ) : (
                      <>
                        <I.Criar aria-hidden="true" /> Criar Rascunho
                      </>
                    )}
                  </Button>
                  {editingCampaignId && (
                    <Button type="button" variant="outline" onClick={handleCancelEdit}>
                      Cancelar Edição
                    </Button>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* Live Preview & Campaign List (Right Col) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Live Preview Box */}
            <div className={`anim-fade ${painel} flex h-[650px] flex-col p-5`}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-[15px] font-semibold leading-5 text-foreground">
                  <I.Olho size={16} className="text-primary" aria-hidden="true" /> Live Preview (Tempo Real)
                </h3>
                <Badge variant="secondary" className={chipNeutro}>Evokaa Mail</Badge>
              </div>

              {/* Mail client headers mock */}
              <div className="mb-4 space-y-1 rounded-[10px] border border-border bg-secondary/50 p-3 text-xs">
                <div><span className="text-muted-foreground">Remetente:</span> <span className="font-semibold text-foreground">Evokaa Eventos &lt;news@evokaa.com.br&gt;</span></div>
                <div><span className="text-muted-foreground">Assunto:</span> <span className="font-bold text-foreground">{title || '(Sem assunto)'}</span></div>
              </div>

              {/* Iframe for Isolated CSS Rendering (fundo branco de propósito: é a caixa de entrada do assinante, não o tema do painel) */}
              <div className="flex-1 overflow-hidden rounded-[10px] border border-border bg-white p-1">
                <iframe
                  srcDoc={liveHtml || '<p style="text-align:center;padding-top:100px;color:#888;font-family:sans-serif;font-size:12px;">Seu e-mail aparecerá aqui</p>'}
                  title="Newsletter Preview"
                  className="w-full h-full border-0"
                  // sem allow-scripts: nenhum script do HTML roda. sandbox="" deixava o preview em
                  // branco (testado no navegador em 29/09/2026)
                  sandbox="allow-same-origin"
                />
              </div>
            </div>

            {/* Existing Campaigns List */}
            <div className={`anim-fade ${painel} p-5`}>
              <div className="mb-3"><SectionTitle>Campanhas Salvas</SectionTitle></div>

              {campaignsError && (
                <div role="alert" className={cn(alertaErro, 'mb-3 p-3 text-xs')}>
                  Não foi possível carregar as campanhas: {campaignsError}
                </div>
              )}

              {isLoadingCampaigns ? (
                <div className="flex justify-center py-8">
                  <Spinner className="size-5 text-primary" aria-label="Carregando" />
                </div>
              ) : campaigns.length === 0 ? (
                <EmptyState title="Nenhuma campanha criada ainda." />
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {campaigns.map(camp => (
                    <div
                      key={camp.id}
                      className="flex flex-col justify-between gap-3 rounded-[10px] border border-border bg-card p-3.5 hover:bg-[var(--ev-tint-hover)]"
                    >
                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <Badge variant="secondary" className={camp.status === 'sent' ? chipOk : chipAviso}>
                            {camp.status === 'sent' ? 'Enviada' : 'Rascunho'}
                          </Badge>
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <I.Eventos size={12} aria-hidden="true" />
                            {new Date(camp.created_at).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <h3 className="line-clamp-1 text-[13px] font-semibold text-foreground">{camp.title}</h3>
                      </div>

                      {camp.status === 'sent' ? (
                        <div className="flex items-center justify-between gap-2 border-t border-border pt-2 text-[11px] text-muted-foreground">
                          {camp.recipient_count == null ? (
                            <span className="text-[var(--ev-warning)]">Envio em andamento ou interrompido — confira antes de reenviar</span>
                          ) : (
                            <span>Disparado para: <strong>{camp.recipient_count}</strong> destinatários</span>
                          )}
                          {camp.sent_at && (
                            <span className="italic">{new Date(camp.sent_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
                          <div className="flex gap-1">
                            <Button type="button" size="xs" variant="outline" onClick={() => handleEditCampaign(camp)}>
                              Carregar
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => handleDeleteCampaign(camp.id)}
                              title="Excluir"
                              aria-label={`Excluir campanha ${camp.title}`}
                            >
                              <I.Lixeira aria-hidden="true" />
                            </Button>
                          </div>
                          <Button
                            type="button"
                            size="xs"
                            onClick={() => handleSendCampaign(camp)}
                            disabled={isSendingId !== null}
                            loading={isSendingId === camp.id}
                          >
                            <I.Enviar aria-hidden="true" /> Enviar
                          </Button>
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
            <div className={`anim-fade ${painel} p-6`}>
              <div className="mb-4"><SectionTitle>Inscrição Manual</SectionTitle></div>
              <form onSubmit={handleAddSubscriber} className="space-y-4">
                <div>
                  <label htmlFor="new-sub-email" className={rotulo}>E-mail do Assinante</label>
                  <Input
                    id="new-sub-email"
                    type="email"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    placeholder="Ex: participante@email.com"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" loading={isAddingSub}>
                  <I.Criar aria-hidden="true" /> Adicionar Assinante
                </Button>
              </form>

              {/* Stats Box */}
              <div className="mt-8 rounded-[10px] border border-border bg-secondary/50 p-4 text-center">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">Base Ativa de Newsletter</span>
                <span className="font-display text-[28px] font-semibold leading-8 tabular-nums text-foreground">{activeSubscriberCount}</span>
                <p className="mt-1 text-xs text-muted-foreground">E-mails que receberão as próximas campanhas ({subscribers.length} cadastrados no total).</p>
              </div>
            </div>
          </div>

          {/* Subscribers List */}
          <div className="lg:col-span-2 space-y-6">
            <div className={`anim-fade ${painel} p-6`}>
              <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <SectionTitle>Lista de Assinantes</SectionTitle>

                {/* Search Bar */}
                <div className="relative max-w-xs w-full">
                  <I.Buscar size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    type="text"
                    value={subSearch}
                    onChange={e => setSubSearch(e.target.value)}
                    placeholder="Buscar e-mail..."
                    aria-label="Buscar e-mail"
                    className="pl-9"
                  />
                </div>
              </div>

              {subscribersError && (
                <div role="alert" className={cn(alertaErro, 'mb-4 p-3 text-xs')}>
                  Não foi possível carregar os assinantes: {subscribersError}
                </div>
              )}

              {isLoadingSubscribers ? (
                <div className="flex justify-center py-20">
                  <Spinner className="size-8 text-primary" aria-label="Carregando" />
                </div>
              ) : filteredSubscribers.length === 0 ? (
                <EmptyState title="Nenhum assinante encontrado." />
              ) : (
                <div className="overflow-hidden rounded-[10px] border border-border">
                  <Tabela label="Lista de assinantes">
                    <thead>
                      <tr className="border-b border-border bg-secondary/50">
                        <th className={cn(th, 'px-3 sm:px-4')}>E-mail</th>
                        <th className={cn(th, 'hidden sm:table-cell')}>Data de Inscrição</th>
                        <th className={cn(th, 'px-3 text-right sm:px-4')}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSubscribers.map(sub => (
                        <tr key={sub.id} className="border-b border-border last:border-0 hover:bg-[var(--ev-tint-hover)]">
                          <td className="px-3 py-3 sm:px-4">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <I.Email size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                              <span className="break-all text-xs font-medium text-foreground">{sub.email}</span>
                              {sub.unsubscribed_at && (
                                <Badge variant="secondary" className={chipNeutro}>Descadastrado</Badge>
                              )}
                            </div>
                          </td>
                          <td className="hidden px-4 py-3 text-xs text-muted-foreground sm:table-cell">
                            {new Date(sub.created_at).toLocaleDateString('pt-BR', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="px-3 py-3 text-right sm:px-4">
                            {/* quem descadastrou fica na base como prova do opt-out (LGPD); apagar
                                a linha também deixaria o e-mail ser reinscrito pelo rodapé */}
                            {!sub.unsubscribed_at && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => handleDeleteSubscriber(sub.id, sub.email)}
                                title="Remover assinante"
                                aria-label={`Remover ${sub.email}`}
                              >
                                <I.Lixeira aria-hidden="true" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Tabela>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
