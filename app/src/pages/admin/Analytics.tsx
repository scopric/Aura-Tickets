import { useRef, useEffect } from 'react'
import { Users, Calendar, DollarSign, TrendingUp, Activity, PieChart } from 'lucide-react'
import gsap from 'gsap'

const monthlyData = import.meta.env.DEV ? [
  { month: 'Jan', users: 120, events: 5, revenue: 18000 },
  { month: 'Fev', users: 180, events: 8, revenue: 28000 },
  { month: 'Mar', users: 250, events: 12, revenue: 42000 },
  { month: 'Abr', users: 320, events: 15, revenue: 55000 },
  { month: 'Mai', users: 410, events: 18, revenue: 72000 },
] : []

const categoryData = import.meta.env.DEV ? [
  { category: 'Musica', percentage: 45, color: '#7a3b69' },
  { category: 'Arte', percentage: 20, color: '#3b82f6' },
  { category: 'Gastronomia', percentage: 15, color: '#22c55e' },
  { category: 'Tecnologia', percentage: 12, color: '#f59e0b' },
  { category: 'Outros', percentage: 8, color: '#94a3b8' },
] : []

export default function AdminAnalytics() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.an-card', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.05, ease: 'power3.out' })
    }, ref)
    return () => ctx.revert()
  }, [])

  return (
    <div ref={ref} className="p-6 lg:p-10 max-w-7xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-espresso">Analytics</h1>
        <p className="text-sm text-espresso/50 mt-1">Metricas e crescimento da plataforma</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Usuarios Totais', value: '1,280', icon: Users, change: '+15%' },
          { label: 'Eventos no Mes', value: '18', icon: Calendar, change: '+8%' },
          { label: 'Receita Mes', value: 'R$ 72K', icon: DollarSign, change: '+22%' },
          { label: 'Taxa Conversao', value: '3.2%', icon: TrendingUp, change: '+0.4%' },
        ].map(k => (
          <div key={k.label} className="an-card p-5 rounded-2xl bg-white/60 border border-white/60">
            <div className="flex items-center justify-between mb-3">
              <k.icon className="w-4 h-4 text-plum" />
              <span className="text-[10px] text-green-600">{k.change}</span>
            </div>
            <div className="font-serif text-2xl text-espresso">{k.value}</div>
            <div className="text-[10px] text-espresso/40 mt-1 uppercase tracking-wider">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Monthly growth */}
        <div className="an-card p-6 rounded-2xl bg-white/60 border border-white/60">
          <h3 className="text-sm font-medium text-espresso mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-plum" /> Crescimento Mensal</h3>
          <div className="space-y-4">
            {monthlyData.map(d => (
              <div key={d.month}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-espresso/50">{d.month}</span>
                  <span className="text-xs text-espresso/30">{d.users} usuarios</span>
                </div>
                <div className="w-full h-6 bg-canvas rounded-lg overflow-hidden relative">
                  <div className="h-full rounded-lg transition-all duration-700 flex items-center px-2" style={{ width: `${(d.users / 500) * 100}%`, backgroundColor: `${categoryData[0].color}15`, borderLeft: `3px solid ${categoryData[0].color}` }}>
                    <span className="text-[11px] font-medium text-espresso/60">R$ {(d.revenue / 1000).toFixed(0)}K</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Categories */}
        <div className="an-card p-6 rounded-2xl bg-white/60 border border-white/60">
          <h3 className="text-sm font-medium text-espresso mb-4 flex items-center gap-2"><PieChart className="w-4 h-4 text-plum" /> Categorias Populares</h3>
          <div className="space-y-4">
            {categoryData.map(c => (
              <div key={c.category}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-espresso/50">{c.category}</span>
                  <span className="text-xs text-espresso/30">{c.percentage}%</span>
                </div>
                <div className="w-full h-2 bg-canvas rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${c.percentage}%`, backgroundColor: c.color }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-canvas text-center">
              <div className="font-serif text-2xl text-espresso">4.7</div>
              <div className="text-[10px] text-espresso/30 uppercase tracking-wider">Nota Media</div>
            </div>
            <div className="p-4 rounded-xl bg-canvas text-center">
              <div className="font-serif text-2xl text-espresso">68%</div>
              <div className="text-[10px] text-espresso/30 uppercase tracking-wider">Retencao</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
