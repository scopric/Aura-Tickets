import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, Users, DollarSign, Star, TrendingUp,
  MapPin, Send, ThumbsUp, ThumbsDown, MessageSquare,
  ChevronDown, ChevronUp, Award, Target, Zap
} from 'lucide-react'
import { toast } from 'sonner'

interface NPSResponse {
  score: number
  comment: string
  date: string
  name: string
}

const npsData: NPSResponse[] = import.meta.env.DEV ? [
  { score: 10, comment: 'Evento incrivel! Organizacao perfeita, ja quero o proximo!', date: '2025-06-16', name: 'Ana B.' },
  { score: 9, comment: 'Muito bom, so fila do bar que estava grande.', date: '2025-06-16', name: 'Pedro C.' },
  { score: 10, comment: 'A experiencia VIP valeu cada centavo. Parabens!', date: '2025-06-15', name: 'Mariana S.' },
  { score: 8, comment: 'Gostei bastante, mas o som podia estar melhor.', date: '2025-06-15', name: 'Lucas M.' },
  { score: 7, comment: 'Bom evento, mas começou atrasado.', date: '2025-06-15', name: 'Julia R.' },
  { score: 10, comment: 'Melhor festa do ano! Com certeza volto.', date: '2025-06-15', name: 'Carlos E.' },
  { score: 6, comment: 'Espaco muito lotado, dificil se mover.', date: '2025-06-14', name: 'Fernanda O.' },
  { score: 9, comment: 'Adorei a Mesa Coletiva, conheci gente demais!', date: '2025-06-14', name: 'Ricardo S.' },
] : []

const hourlyAttendance = import.meta.env.DEV ? [
  { hour: '18h', count: 45 },
  { hour: '19h', count: 120 },
  { hour: '20h', count: 280 },
  { hour: '21h', count: 520 },
  { hour: '22h', count: 780 },
  { hour: '23h', count: 890 },
  { hour: '00h', count: 650 },
  { hour: '01h', count: 320 },
  { hour: '02h', count: 120 },
] : []

const zoneData = import.meta.env.DEV ? [
  { zone: 'Palco Principal', visitors: 920, avgTime: '2h30', satisfaction: 9.2 },
  { zone: 'Bar/Bebidas', visitors: 780, avgTime: '25min', satisfaction: 7.5 },
  { zone: 'Area VIP', visitors: 180, avgTime: '3h10', satisfaction: 9.8 },
  { zone: 'Area Externa', visitors: 340, avgTime: '45min', satisfaction: 8.1 },
  { zone: 'Banheiros', visitors: 650, avgTime: '8min', satisfaction: 6.2 },
] : []

export default function PostEventReport() {
  const [showNPS, setShowNPS] = useState(true)
  const [showHeatmap, setShowHeatmap] = useState(true)
  const [showComments, setShowComments] = useState(false)
  const [sendNPS, setSendNPS] = useState(false)

  const totalResponses = npsData.length
  const promoters = npsData.filter(r => r.score >= 9).length
  const passives = npsData.filter(r => r.score >= 7 && r.score <= 8).length
  const detractors = npsData.filter(r => r.score <= 6).length
  const npsScore = Math.round(((promoters - detractors) / totalResponses) * 100)
  const avgRating = (npsData.reduce((s, r) => s + r.score, 0) / totalResponses).toFixed(1)

  const maxAttendance = Math.max(...hourlyAttendance.map(h => h.count))

  const handleSendNPS = () => {
    setSendNPS(true)
    toast.success('Pesquisa NPS enviada para todos os participantes!')
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link to="/producer/dashboard" className="p-2 rounded-full bg-white/60 border border-white/60 text-espresso/50 hover:text-espresso transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-serif text-3xl text-espresso">Relatorio Pos-Evento</h1>
          <p className="text-sm text-espresso/50 mt-1">Noite Eletro 2025 — Analise completa de desempenho</p>
        </div>
        {!sendNPS && (
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
          { label: 'NPS Score', value: npsScore > 0 ? `+${npsScore}` : npsScore.toString(), icon: Target, color: npsScore >= 50 ? '#22c55e' : npsScore >= 0 ? '#f59e0b' : '#ef4444' },
          { label: 'Nota Media', value: avgRating, icon: Star, color: '#f59e0b' },
          { label: 'Participantes', value: '892', icon: Users, color: '#3b82f6' },
          { label: 'Receita Total', value: 'R$ 79.9K', icon: DollarSign, color: '#7a3b69' },
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
              <div className="text-2xl font-serif text-green-600">{promoters}</div>
              <div className="text-xs text-espresso/40">Promotores (9-10)</div>
              <div className="text-[10px] text-green-600 mt-1">{Math.round((promoters / totalResponses) * 100)}%</div>
            </div>
            <div className="p-4 bg-amber-50/50 rounded-xl text-center">
              <div className="w-5 h-5 rounded-full border-2 border-amber-400 mx-auto mb-2" />
              <div className="text-2xl font-serif text-amber-600">{passives}</div>
              <div className="text-xs text-espresso/40">Passivos (7-8)</div>
              <div className="text-[10px] text-amber-600 mt-1">{Math.round((passives / totalResponses) * 100)}%</div>
            </div>
            <div className="p-4 bg-red-50/50 rounded-xl text-center">
              <ThumbsDown className="w-5 h-5 text-red-500 mx-auto mb-2" />
              <div className="text-2xl font-serif text-red-500">{detractors}</div>
              <div className="text-xs text-espresso/40">Detratores (0-6)</div>
              <div className="text-[10px] text-red-500 mt-1">{Math.round((detractors / totalResponses) * 100)}%</div>
            </div>
            {/* NPS gauge */}
            <div className="md:col-span-3 mt-2">
              <div className="w-full h-3 rounded-full overflow-hidden flex">
                <div className="h-full bg-green-400" style={{ width: `${(promoters / totalResponses) * 100}%` }} />
                <div className="h-full bg-amber-400" style={{ width: `${(passives / totalResponses) * 100}%` }} />
                <div className="h-full bg-red-400" style={{ width: `${(detractors / totalResponses) * 100}%` }} />
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
            <div className="flex items-end gap-2 h-40 mb-4">
              {hourlyAttendance.map(h => (
                <div key={h.hour} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-[9px] text-espresso/30">{h.count}</div>
                  <div className="w-full bg-plum/20 rounded-t-sm hover:bg-plum/40 transition-all relative group"
                    style={{ height: `${(h.count / maxAttendance) * 100}%` }}>
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-void text-cream text-[9px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {h.count} pessoas
                    </div>
                  </div>
                  <div className="text-[9px] text-espresso/30">{h.hour}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {zoneData.map(z => (
                <div key={z.zone} className="p-3 bg-white/40 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-espresso">{z.zone}</div>
                    <div className="text-[10px] text-espresso/30">{z.visitors} visitantes · tempo medio {z.avgTime}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-400" />
                    <span className="text-xs font-medium text-espresso">{z.satisfaction}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Comments */}
      <div className="p-6 bg-white/60 border border-white/60 rounded-2xl mb-6">
        <button onClick={() => setShowComments(!showComments)} className="w-full flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-espresso flex items-center gap-2"><MessageSquare className="w-4 h-4 text-plum" /> Comentarios dos Participantes</h2>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-espresso/30">{npsData.length} respostas</span>
            {showComments ? <ChevronUp className="w-4 h-4 text-espresso/30" /> : <ChevronDown className="w-4 h-4 text-espresso/30" />}
          </div>
        </button>
        {showComments && (
          <div className="space-y-3">
            {npsData.map((r, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-white/40 rounded-xl">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium ${r.score >= 9 ? 'bg-green-50 text-green-600' : r.score >= 7 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'}`}>
                  {r.score}
                </div>
                <div className="flex-1">
                  <div className="text-xs text-espresso/70">{r.comment}</div>
                  <div className="text-[10px] text-espresso/25 mt-1">{r.name} · {r.date}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Insights */}
      <div className="p-6 bg-plum/5 border border-plum/15 rounded-2xl">
        <h2 className="text-sm font-medium text-espresso mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-plum" /> Insights Automaticos</h2>
        <div className="space-y-2">
          {[
            'O pico de ocupacao foi as 23h com 890 pessoas. Considere aumentar capacidade ou abrir areas adicionais.',
            'Satisfacao na area VIP (9.8) foi muito superior a geral. Investir em experiencias premium tem retorno.',
            'Fila do bar foi o principal ponto de insatisfacao. Adicionar pontos de venda pode melhorar NPS.',
            `${promoters * 10}% dos participantes sao promotores. Eles podem ser convidados para proximos eventos com desconto.`,
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
