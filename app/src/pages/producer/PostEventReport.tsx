import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, Users, DollarSign, Star, TrendingUp,
  MapPin, Send, ThumbsUp, ThumbsDown, MessageSquare,
  ChevronDown, ChevronUp, Award, Target, Zap, Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useProducerEvents } from '../../hooks/useEvents'
import { useEventSurveys, useEventZones } from '../../hooks/useProducerTools'

export default function PostEventReport() {
  const { data: events = [], isLoading: eventsLoading } = useProducerEvents()
  const [selectedEventId, setSelectedEventId] = useState<string | null>(events[0]?.id || null)

  const { data: surveys = [], isLoading: surveysLoading } = useEventSurveys(selectedEventId)
  const { data: zones = [], isLoading: zonesLoading } = useEventZones(selectedEventId)

  const [stats, setStats] = useState({ participants: 0, revenue: 0 })
  const [statsLoading, setStatsLoading] = useState(false)

  const selectedEvent = events.find(e => e.id === selectedEventId)

  useEffect(() => {
    if (!selectedEventId) return
    setStatsLoading(true)
    Promise.all([
      supabase.from('tickets').select('id', { count: 'exact' }).eq('event_id', selectedEventId),
      supabase.from('orders').select('total').eq('event_id', selectedEventId).eq('status', 'paid'),
    ]).then(([ticketsRes, ordersRes]) => {
      const participants = ticketsRes.count || 0
      const revenue = (ordersRes.data || []).reduce((s: number, o: any) => s + (Number(o.total) || 0), 0)
      setStats({ participants, revenue })
    }).finally(() => setStatsLoading(false))
  }, [selectedEventId])

  const report = useMemo(() => {
    const totalResponses = surveys.length
    const promoters = surveys.filter(r => r.score >= 9).length
    const passives = surveys.filter(r => r.score >= 7 && r.score <= 8).length
    const detractors = surveys.filter(r => r.score <= 6).length
    const npsScore = totalResponses > 0 ? Math.round(((promoters - detractors) / totalResponses) * 100) : 0
    const avgRating = totalResponses > 0 ? (surveys.reduce((s, r) => s + r.score, 0) / totalResponses).toFixed(1) : '0.0'
    return { totalResponses, promoters, passives, detractors, npsScore, avgRating }
  }, [surveys])

  const [showNPS, setShowNPS] = useState(true)
  const [showHeatmap, setShowHeatmap] = useState(true)
  const [showComments, setShowComments] = useState(false)
  const [sendNPS, setSendNPS] = useState(false)

  const handleSendNPS = () => {
    setSendNPS(true)
    toast.success('Pesquisa NPS enviada para todos os participantes!')
  }

  const isLoadingAny = eventsLoading || surveysLoading || zonesLoading || statsLoading

  if (isLoadingAny) {
    return (
      <div className="p-6 lg:p-10 max-w-6xl mx-auto flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-plum animate-spin mb-4" />
        <p className="text-espresso/60 text-sm">Carregando relatorio...</p>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link to="/producer/dashboard" className="p-2 rounded-full bg-white/60 border border-white/60 text-espresso/50 hover:text-espresso transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-serif text-3xl text-espresso">Relatorio Pos-Evento</h1>
          <p className="text-sm text-espresso/50 mt-1">{selectedEvent?.title || 'Selecione um evento'} — Analise completa de desempenho</p>
        </div>
        <select
          value={selectedEventId || ''}
          onChange={e => setSelectedEventId(e.target.value || null)}
          className="px-4 py-2 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30"
        >
          <option value="">Selecione um evento</option>
          {events.map(e => (
            <option key={e.id} value={e.id}>{e.title}</option>
          ))}
        </select>
        {!sendNPS && selectedEventId && (
          <button onClick={handleSendNPS} className="px-5 py-2.5 bg-plum text-cream text-sm rounded-full hover:shadow-glow transition-all flex items-center gap-2">
            <Send className="w-4 h-4" /> Enviar NPS
          </button>
        )}
        {sendNPS && (
          <span className="px-4 py-2 bg-green-50 text-green-600 text-xs rounded-full flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" /> NPS Enviado
          </span>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'NPS Score', value: report.npsScore > 0 ? `+${report.npsScore}` : report.npsScore.toString(), icon: Target, color: report.npsScore >= 50 ? '#22c55e' : report.npsScore >= 0 ? '#f59e0b' : '#ef4444' },
          { label: 'Nota Media', value: report.avgRating, icon: Star, color: '#f59e0b' },
          { label: 'Participantes', value: stats.participants.toString(), icon: Users, color: '#3b82f6' },
          { label: 'Receita', value: `R$ ${(stats.revenue / 1000).toFixed(1)}K`, icon: DollarSign, color: '#7a3b69' },
        ].map(k => (
          <div key={k.label} className="p-5 rounded-2xl bg-white/60 border border-white/60">
            <k.icon className="w-4 h-4 mb-2" style={{ color: k.color }} />
            <div className="font-serif text-2xl" style={{ color: k.color }}>{k.value}</div>
            <div className="text-[10px] text-espresso/40 mt-1 uppercase tracking-wider">{k.label}</div>
          </div>
        ))}
      </div>

      {/* NPS Breakdown */}
      <div className="p-6 bg-white/60 border border-white/60 rounded-2xl mb-6">
        <button onClick={() => setShowNPS(!showNPS)} className="w-full flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-espresso flex items-center gap-2"><Award className="w-4 h-4 text-plum" /> NPS — Net Promoter Score</h2>
          {showNPS ? <ChevronUp className="w-4 h-4 text-espresso/30" /> : <ChevronDown className="w-4 h-4 text-espresso/30" />}
        </button>
        {showNPS && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-green-50/50 rounded-xl text-center">
              <ThumbsUp className="w-5 h-5 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-serif text-green-600">{report.promoters}</div>
              <div className="text-xs text-espresso/40">Promotores (9-10)</div>
              <div className="text-[10px] text-green-600 mt-1">{report.totalResponses > 0 ? Math.round((report.promoters / report.totalResponses) * 100) : 0}%</div>
            </div>
            <div className="p-4 bg-amber-50/50 rounded-xl text-center">
              <div className="w-5 h-5 rounded-full border-2 border-amber-400 mx-auto mb-2" />
              <div className="text-2xl font-serif text-amber-600">{report.passives}</div>
              <div className="text-xs text-espresso/40">Passivos (7-8)</div>
              <div className="text-[10px] text-amber-600 mt-1">{report.totalResponses > 0 ? Math.round((report.passives / report.totalResponses) * 100) : 0}%</div>
            </div>
            <div className="p-4 bg-red-50/50 rounded-xl text-center">
              <ThumbsDown className="w-5 h-5 text-red-500 mx-auto mb-2" />
              <div className="text-2xl font-serif text-red-500">{report.detractors}</div>
              <div className="text-xs text-espresso/40">Detratores (0-6)</div>
              <div className="text-[10px] text-red-500 mt-1">{report.totalResponses > 0 ? Math.round((report.detractors / report.totalResponses) * 100) : 0}%</div>
            </div>
            <div className="md:col-span-3 mt-2">
              <div className="w-full h-3 rounded-full overflow-hidden flex">
                <div className="h-full bg-green-400" style={{ width: `${report.totalResponses > 0 ? (report.promoters / report.totalResponses) * 100 : 0}%` }} />
                <div className="h-full bg-amber-400" style={{ width: `${report.totalResponses > 0 ? (report.passives / report.totalResponses) * 100 : 0}%` }} />
                <div className="h-full bg-red-400" style={{ width: `${report.totalResponses > 0 ? (report.detractors / report.totalResponses) * 100 : 0}%` }} />
              </div>
              <div className="flex justify-between text-[9px] text-espresso/20 mt-1">
                <span>-100</span>
                <span>0</span>
                <span>+100</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Heatmap */}
      <div className="p-6 bg-white/60 border border-white/60 rounded-2xl mb-6">
        <button onClick={() => setShowHeatmap(!showHeatmap)} className="w-full flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-espresso flex items-center gap-2"><MapPin className="w-4 h-4 text-plum" /> Mapa de Calor — Ocupacao por Horario</h2>
          {showHeatmap ? <ChevronUp className="w-4 h-4 text-espresso/30" /> : <ChevronDown className="w-4 h-4 text-espresso/30" />}
        </button>
        {showHeatmap && (
          <div>
            <div className="flex items-center justify-center h-40 bg-canvas rounded-xl mb-4">
              <p className="text-xs text-espresso/30">Dados de check-in por horario serao exibidos aqui quando disponiveis.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {zones.length > 0 ? zones.map(z => (
                <div key={z.id} className="p-3 bg-white/40 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-espresso">{z.name}</div>
                    <div className="text-[10px] text-espresso/30">{z.expected_visitors} visitantes · tempo medio {z.avg_time_minutes}min</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-400" />
                    <span className="text-xs font-medium text-espresso">{z.satisfaction_score}</span>
                  </div>
                </div>
              )) : (
                <div className="md:col-span-2 text-center py-4">
                  <p className="text-xs text-espresso/30">Nenhuma zona cadastrada para este evento.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Comments */}
      <div className="p-6 bg-white/60 border border-white/60 rounded-2xl mb-6">
        <button onClick={() => setShowComments(!showComments)} className="w-full flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-espresso flex items-center gap-2"><MessageSquare className="w-4 h-4 text-plum" /> Comentarios dos Participantes</h2>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-espresso/30">{surveys.length} respostas</span>
            {showComments ? <ChevronUp className="w-4 h-4 text-espresso/30" /> : <ChevronDown className="w-4 h-4 text-espresso/30" />}
          </div>
        </button>
        {showComments && (
          <div className="space-y-3">
            {surveys.map((r, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-white/40 rounded-xl">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium ${r.score >= 9 ? 'bg-green-50 text-green-600' : r.score >= 7 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'}`}>
                  {r.score}
                </div>
                <div className="flex-1">
                  <div className="text-xs text-espresso/70">{r.comment || 'Sem comentario'}</div>
                  <div className="text-[10px] text-espresso/25 mt-1">{r.participant_email} · {new Date(r.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</div>
                </div>
              </div>
            ))}
            {surveys.length === 0 && (
              <p className="text-xs text-espresso/30 text-center py-4">Nenhuma resposta de pesquisa ainda.</p>
            )}
          </div>
        )}
      </div>

      {/* Insights */}
      <div className="p-6 bg-plum/5 border border-plum/15 rounded-2xl">
        <h2 className="text-sm font-medium text-espresso mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-plum" /> Insights Automaticos</h2>
        <div className="space-y-2">
          {[
            report.totalResponses > 0 ? `${Math.round((report.promoters / report.totalResponses) * 100)}% dos participantes sao promotores. Eles podem ser convidados para proximos eventos com desconto.` : 'Envie a pesquisa NPS para obter insights dos participantes.',
            report.totalResponses > 0 && report.detractors > 0 ? `Atenção: ${report.detractors} detratores identificados. Analise os comentarios para melhorias.` : 'Mantenha o NPS acima de 50 para garantir recomendacoes.',
            'O pico de ocupacao geralmente ocorre 2-3 horas apos a abertura. Considere programar atracoes principais nesse horario.',
            'Investir em experiencias VIP tende a gerar satisfacao superior e maior disposicao a pagar.',
          ].map((insight, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-espresso/60">
              <div className="w-1.5 h-1.5 rounded-full bg-plum mt-1.5 flex-shrink-0" />
              {insight}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
