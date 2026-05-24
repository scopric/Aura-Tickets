import { useState } from 'react'
import {
  Users, Calendar, DollarSign, Ticket, Search,
  Eye, Lock, Unlock, CheckCircle2, XCircle, Crown,
  CreditCard, BarChart3, Clock, AlertTriangle, Mail, Phone
} from 'lucide-react'
import { toast } from 'sonner'

interface User {
  id: string; name: string; email: string; role: 'participante' | 'produtor' | 'admin';
  plan: string; status: 'ativo' | 'bloqueado' | 'pendente'; joinedAt: string;
  events: number; revenue: number; lastLogin: string; phone: string; avatar: string;
  paymentMethod: string; planDueDate: string; planValue: number; totalSpent: number;
  termsAccepted: string; features: string[];
}

interface Plan {
  id: string; name: string; price: number; period: 'mensal' | 'anual';
  color: string; subscribers: number; revenue: number;
  features: { name: string; enabled: boolean }[];
}

interface FeatureGate {
  id: string; name: string; description: string;
  plans: Record<string, boolean>; freeTrial: number;
}

const mockUsers: User[] = [
  { id: 'u1', name: 'Joao Silva', email: 'joao@email.com', role: 'produtor', plan: 'Aura Pro', status: 'ativo', joinedAt: '01 Mar 2025', events: 12, revenue: 156000, lastLogin: '2h atras', phone: '(11) 98765-4321', avatar: 'https://i.pravatar.cc/150?img=11', paymentMethod: 'Cartao Credito', planDueDate: '01 Jun 2025', planValue: 149, totalSpent: 2847, termsAccepted: '01 Mar 2025', features: ['tudo'] },
  { id: 'u2', name: 'Ana Costa', email: 'ana@email.com', role: 'participante', plan: 'Gratuito', status: 'ativo', joinedAt: '15 Fev 2025', events: 0, revenue: 0, lastLogin: '5h atras', phone: '(11) 91234-5678', avatar: 'https://i.pravatar.cc/150?img=5', paymentMethod: '-', planDueDate: '-', planValue: 0, totalSpent: 890, termsAccepted: '15 Fev 2025', features: ['compra', 'favoritos'] },
  { id: 'u3', name: 'Carlos Mendes', email: 'carlos@email.com', role: 'produtor', plan: 'Aura Starter', status: 'ativo', joinedAt: '10 Abr 2025', events: 3, revenue: 23400, lastLogin: '1 dia', phone: '(11) 92345-6789', avatar: 'https://i.pravatar.cc/150?img=3', paymentMethod: 'PIX', planDueDate: '10 Mai 2025', planValue: 49, totalSpent: 147, termsAccepted: '10 Abr 2025', features: ['eventos_limitados', 'financeiro'] },
  { id: 'u4', name: 'Maria Souza', email: 'maria@email.com', role: 'admin', plan: 'Aura Pro', status: 'ativo', joinedAt: '01 Jan 2025', events: 0, revenue: 0, lastLogin: '30min', phone: '(11) 93456-7890', avatar: 'https://i.pravatar.cc/150?img=9', paymentMethod: 'Cartao Credito', planDueDate: '01 Jan 2026', planValue: 149, totalSpent: 1788, termsAccepted: '01 Jan 2025', features: ['tudo'] },
  { id: 'u5', name: 'Pedro Lima', email: 'pedro@email.com', role: 'participante', plan: 'Aura Plus', status: 'bloqueado', joinedAt: '20 Mar 2025', events: 0, revenue: 0, lastLogin: '15 dias', phone: '(11) 94567-8901', avatar: 'https://i.pravatar.cc/150?img=8', paymentMethod: 'Boleto', planDueDate: 'Vencido', planValue: 99, totalSpent: 297, termsAccepted: '20 Mar 2025', features: ['compra', 'mesa_coletiva', 'favoritos'] },
  { id: 'u6', name: 'Fernanda Rocha', email: 'fernanda@email.com', role: 'produtor', plan: 'Aura Pro', status: 'ativo', joinedAt: '05 Jan 2025', events: 8, revenue: 98000, lastLogin: '3h atras', phone: '(11) 95678-9012', avatar: 'https://i.pravatar.cc/150?img=20', paymentMethod: 'PIX', planDueDate: '05 Jun 2025', planValue: 149, totalSpent: 745, termsAccepted: '05 Jan 2025', features: ['tudo'] },
]

const plans: Plan[] = [
  { id: 'starter', name: 'Aura Starter', price: 49, period: 'mensal', color: '#8b5cf6', subscribers: 234, revenue: 11466,
    features: [{ name: '3 eventos/mes', enabled: true }, { name: '100 ingressos/evento', enabled: true }, { name: 'Financeiro basico', enabled: true }, { name: 'Caixinha', enabled: true }, { name: 'CRM', enabled: false }, { name: 'Afiliados', enabled: false }, { name: 'Cupons', enabled: false }, { name: 'Comunicacao', enabled: false }] },
  { id: 'plus', name: 'Aura Plus', price: 99, period: 'mensal', color: '#d97706', subscribers: 189, revenue: 18711,
    features: [{ name: '10 eventos/mes', enabled: true }, { name: '500 ingressos/evento', enabled: true }, { name: 'Financeiro completo', enabled: true }, { name: 'Caixinha + Calculadora', enabled: true }, { name: 'CRM + Afiliados', enabled: true }, { name: 'Cupons + Comunicacao', enabled: true }, { name: 'Banners + Galeria', enabled: false }, { name: 'Mesa Coletiva', enabled: false }] },
  { id: 'pro', name: 'Aura Pro', price: 149, period: 'mensal', color: '#7a3b69', subscribers: 412, revenue: 61388,
    features: [{ name: 'Eventos ilimitados', enabled: true }, { name: 'Ingressos ilimitados', enabled: true }, { name: 'Tudo do Plus', enabled: true }, { name: 'Mesa Coletiva', enabled: true }, { name: 'Banners + Galeria', enabled: true }, { name: 'Check-in App', enabled: true }, { name: 'Suporte prioritario', enabled: true }, { name: 'API access', enabled: false }] },
  { id: 'enterprise', name: 'Aura Enterprise', price: 349, period: 'mensal', color: '#1a0e14', subscribers: 47, revenue: 16403,
    features: [{ name: 'Tudo do Pro', enabled: true }, { name: 'Multiplos produtores', enabled: true }, { name: 'White label', enabled: true }, { name: 'API access', enabled: true }, { name: 'Gerente dedicado', enabled: true }, { name: 'SLA garantido', enabled: true }, { name: 'Custom integrations', enabled: true }, { name: 'Treinamento equipe', enabled: true }] },
]

const featureGates: FeatureGate[] = [
  { id: 'evt', name: 'Criar Eventos', description: 'Criar e publicar eventos', plans: { starter: true, plus: true, pro: true, enterprise: true }, freeTrial: 1 },
  { id: 'crm', name: 'CRM Completo', description: 'Gestao de leads e pipeline', plans: { starter: false, plus: true, pro: true, enterprise: true }, freeTrial: 7 },
  { id: 'aff', name: 'Sistema de Afiliados', description: 'Vendedores com codigo e comissao', plans: { starter: false, plus: true, pro: true, enterprise: true }, freeTrial: 7 },
  { id: 'cup', name: 'Cupons de Desconto', description: 'Criar cupons personalizados', plans: { starter: false, plus: true, pro: true, enterprise: true }, freeTrial: 3 },
  { id: 'com', name: 'Comunicacao', description: 'Email, SMS e Push', plans: { starter: false, plus: true, pro: true, enterprise: true }, freeTrial: 5 },
  { id: 'mc', name: 'Mesa Coletiva', description: 'Matchmaking de participantes', plans: { starter: false, plus: false, pro: true, enterprise: true }, freeTrial: 0 },
  { id: 'bnr', name: 'Banners + Galeria', description: 'Banners promocionais e fotos', plans: { starter: false, plus: false, pro: true, enterprise: true }, freeTrial: 7 },
  { id: 'chk', name: 'Check-in Scanner', description: 'Scanner QR na porta', plans: { starter: false, plus: false, pro: true, enterprise: true }, freeTrial: 3 },
]

export default function AdminDashboard() {
  const [tab, setTab] = useState<'overview' | 'users' | 'plans' | 'features'>('overview')
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
    const [period, setPeriod] = useState('month')
  const [userFilter, setUserFilter] = useState('all')

  const totalRevenue = plans.reduce((s, p) => s + p.revenue, 0)
  const totalUsers = mockUsers.length
  const activeUsers = mockUsers.filter(u => u.status === 'ativo').length
  const pendingPayments = mockUsers.filter(u => u.planDueDate === 'Vencido').length

  const filteredUsers = mockUsers.filter(u => {
    const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
    const matchFilter = userFilter === 'all' || u.role === userFilter || (userFilter === 'bloqueado' && u.status === 'bloqueado')
    return matchSearch && matchFilter
  })

  const toggleUserStatus = (id: string) => {
    const user = mockUsers.find(u => u.id === id)
    if (user) {
      user.status = user.status === 'ativo' ? 'bloqueado' : 'ativo'
      toast.success(`${user.name} ${user.status === 'ativo' ? 'ativado' : 'bloqueado'}`)
      setSelectedUser({ ...user })
    }
  }

  // Auxiliares de estilização dinâmica para evitar inline styles
  const getPlanKey = (planNameOrId: string): string => {
    const normalized = planNameOrId.toLowerCase();
    if (normalized.includes('starter')) return 'starter';
    if (normalized.includes('plus')) return 'plus';
    if (normalized.includes('pro')) return 'pro';
    if (normalized.includes('enterprise')) return 'enterprise';
    return 'starter';
  };

  // Validador seguro de acessos dinâmicos por chave para evitar riscos de bracket notation (Prototype Pollution)
  const hasPlanAccess = (fg: FeatureGate, planId: string): boolean => {
    const validPlanIds = ['starter', 'plus', 'pro', 'enterprise'];
    if (validPlanIds.includes(planId)) {
      return !!fg.plans[planId];
    }
    return false;
  };

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Administrativo</h1>
          <p className="text-sm text-espresso/50 mt-1">Gestao completa da plataforma Aura</p>
        </div>
        <div className="flex items-center gap-1 p-1 bg-white/60 border border-white/60 rounded-full">
          {[{ id: 'overview', label: 'Visao Geral', icon: BarChart3 }, { id: 'users', label: 'Usuarios', icon: Users }, { id: 'plans', label: 'Planos', icon: Crown }, { id: 'features', label: 'Funcionalidades', icon: Lock }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as typeof tab)} className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all ${tab === t.id ? 'bg-plum text-cream' : 'text-espresso/40 hover:text-espresso/70'}`}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ===== OVERVIEW ===== */}
      {tab === 'overview' && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Usuarios', value: totalUsers.toString(), sub: `${activeUsers} ativos`, icon: Users, change: '+12%', color: 'text-blue-600' },
              { label: 'Receita Mensal', value: `R$ ${totalRevenue.toLocaleString()}`, sub: 'Fee + Assinaturas', icon: DollarSign, change: '+23%', color: 'text-green-600' },
              { label: 'Assinantes', value: plans.reduce((s, p) => s + p.subscribers, 0).toString(), sub: '4 planos ativos', icon: Crown, change: '+8%', color: 'text-plum' },
              { label: 'Pagamentos Vencidos', value: pendingPayments.toString(), sub: 'Requer atencao', icon: AlertTriangle, change: '-2', color: 'text-red-500' },
            ].map(s => (
              <div key={s.label} className="p-5 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-3">
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-600">{s.change}</span>
                </div>
                <div className={`font-serif text-2xl ${s.color}`}>{s.value}</div>
                <div className="text-xs text-espresso/40 mt-1">{s.label}</div>
                <div className="text-[10px] text-espresso/25 mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Revenue */}
            <div className="lg:col-span-2 p-6 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-serif text-xl text-espresso">Faturamento</h2>
                  <p className="text-xs text-espresso/30 mt-0.5">Fee por transacao + Assinaturas</p>
                </div>
                <div className="flex items-center gap-1 p-1 bg-canvas rounded-full">
                  {['week', 'month', 'year'].map(p => (
                    <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1 text-[10px] font-medium rounded-full transition-all ${period === p ? 'bg-plum text-cream' : 'text-espresso/30'}`}>{p === 'week' ? '7D' : p === 'month' ? '30D' : '12M'}</button>
                  ))}
                </div>
              </div>
              <div className="h-48 flex items-end gap-2">
                {[25, 40, 35, 55, 45, 70, 60, 80, 65, 85, 75, 95].map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                    <div className="w-full rounded-t-xl transition-all duration-300 group-hover:opacity-80 bg-bar-gradient" style={{ height: `${h * 1.8}px` }} />
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-3">
                {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map(m => (
                  <span key={m} className="flex-1 text-center text-[10px] text-espresso/30">{m}</span>
                ))}
              </div>
            </div>

            {/* Plans Distribution */}
            <div className="p-6 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm">
              <h2 className="font-serif text-xl text-espresso mb-5">Distribuicao de Planos</h2>
              <div className="space-y-4">
                {plans.map(p => {
                  const pk = getPlanKey(p.id);
                  return (
                    <div key={p.id}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-espresso/60 flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full bg-plan-${pk}`} />
                          {p.name}
                        </span>
                        <span className={`text-xs font-medium text-plan-${pk}`}>{p.subscribers}</span>
                      </div>
                      <div className="w-full h-2 bg-canvas rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all bg-plan-${pk}`} style={{ width: `${(p.subscribers / 600) * 100}%` }} />
                      </div>
                      <div className="text-[10px] text-espresso/25 mt-0.5">R$ {p.revenue.toLocaleString()}/mes</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Top Producers + Recent */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm">
              <h2 className="font-serif text-xl text-espresso mb-4">Top Produtores</h2>
              <div className="space-y-3">
                {mockUsers.filter(u => u.role === 'produtor').sort((a, b) => b.revenue - a.revenue).slice(0, 4).map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/40 hover:bg-white/60 transition-all cursor-pointer" onClick={() => { setSelectedUser(p); setTab('users') }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium bg-plum-10-text-plum">{i + 1}</div>
                    <img src={p.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-espresso">{p.name}</div>
                      <div className="text-[10px] text-espresso/30">{p.events} eventos · {p.plan}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-espresso">R$ {(p.revenue / 1000).toFixed(0)}K</div>
                      <div className="text-[10px] text-green-600">+{p.events * 2}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm">
              <h2 className="font-serif text-xl text-espresso mb-4">Atividade Recente</h2>
              <div className="space-y-3">
                {[
                  { icon: Users, text: 'Novo usuario registrado', sub: 'Amanda Costa - ha 5 min', color: 'text-blue-600' },
                  { icon: Calendar, text: 'Evento publicado', sub: 'Noite Eletro 2025 - ha 15 min', color: 'text-plum' },
                  { icon: DollarSign, text: 'Pagamento de assinatura', sub: 'Aura Pro - R$ 149 - ha 30 min', color: 'text-green-600' },
                  { icon: Ticket, text: '50 ingressos vendidos', sub: 'Jazz Sunset Session - ha 1h', color: 'text-amber-600' },
                ].map((a, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/40">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-cream-color">
                      <a.icon className={`w-4 h-4 ${a.color}`} />
                    </div>
                    <div>
                      <div className="text-sm text-espresso">{a.text}</div>
                      <div className="text-[10px] text-espresso/30">{a.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ===== USERS ===== */}
      {tab === 'users' && (
        <>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-espresso/20" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, email ou telefone..." className="w-full pl-10 pr-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
            </div>
            <div className="flex items-center gap-1 p-1 bg-white/60 border border-white/60 rounded-full">
              {[{ id: 'all', label: 'Todos' }, { id: 'produtor', label: 'Produtores' }, { id: 'participante', label: 'Participantes' }, { id: 'bloqueado', label: 'Bloqueados' }].map(f => (
                <button key={f.id} onClick={() => setUserFilter(f.id)} className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${userFilter === f.id ? 'bg-plum text-cream' : 'text-espresso/40'}`}>{f.label}</button>
              ))}
            </div>
          </div>

          <div className="bg-white/60 border border-white/60 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-espresso/5">
                  <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Usuario</th>
                  <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase hidden lg:table-cell">Plano</th>
                  <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase hidden md:table-cell">Vencimento</th>
                  <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase hidden md:table-cell">Gasto</th>
                  <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u.id} className="border-b border-espresso/3 last:border-0 hover:bg-white/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img src={u.avatar} alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-canvas" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-espresso">{u.name}</div>
                          <div className="text-[10px] text-espresso/30">{u.email} · {u.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border bg-plan-${getPlanKey(u.plan)}-10 text-plan-${getPlanKey(u.plan)} border-plan-${getPlanKey(u.plan)}-20`}>{u.plan}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`text-xs ${u.planDueDate === 'Vencido' ? 'text-red-500' : 'text-espresso/40'}`}>{u.planDueDate}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-sm font-medium text-espresso">R$ {u.totalSpent.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleUserStatus(u.id)} className={`px-2.5 py-1 text-[10px] font-medium rounded-full border transition-all ${u.status === 'ativo' ? 'bg-green-50 border-green-100 text-green-600' : 'bg-red-50 border-red-100 text-red-500'}`}>
                        {u.status === 'ativo' ? 'Ativo' : 'Bloqueado'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setSelectedUser(u)} aria-label={`Visualizar detalhes do usuario ${u.name}`} className="p-1.5 rounded-lg hover:bg-canvas text-espresso/20 hover:text-espresso/60 transition-colors"><Eye className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ===== PLANS ===== */}
      {tab === 'plans' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {plans.map(p => {
              const pk = getPlanKey(p.id);
              return (
                <div key={p.id} className={`p-6 rounded-3xl border border-white/60 bg-white/55 backdrop-blur-sm transition-all hover:shadow-lg hover:-translate-y-0.5 cursor-pointer border-t-plan-${pk}`} >
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-plan-${pk}-15`}>
                      <Crown className={`w-5 h-5 text-plan-${pk}`} />
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full bg-plan-${pk}-10 text-plan-${pk}`}>{p.subscribers} assinantes</span>
                  </div>
                  <h3 className="font-serif text-lg text-espresso mb-1">{p.name}</h3>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className={`font-serif text-3xl text-plan-${pk}`}>R$ {p.price}</span>
                    <span className="text-xs text-espresso/30">/mes</span>
                  </div>
                  <div className="space-y-2">
                    {p.features.slice(0, 5).map(f => (
                      <div key={f.name} className="flex items-center gap-2 text-xs text-espresso/50">
                        {f.enabled ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <XCircle className="w-3 h-3 text-espresso/15" />}
                        {f.name}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-espresso/5">
                    <div className="text-xs text-espresso/40">Receita mensal</div>
                    <div className="text-sm font-medium text-espresso">R$ {p.revenue.toLocaleString()}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Plan Comparison Table */}
          <div className="p-6 rounded-2xl bg-white/60 border border-white/60">
            <h2 className="font-serif text-xl text-espresso mb-5">Comparativo de Funcionalidades</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-espresso/5">
                    <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Funcionalidade</th>
                    {plans.map(p => <th key={p.id} className={`text-center px-4 py-3 text-xs font-medium text-plan-${getPlanKey(p.id)}`}>{p.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {featureGates.map(fg => (
                    <tr key={fg.id} className="border-b border-espresso/3 last:border-0">
                      <td className="px-4 py-3">
                        <div className="text-sm text-espresso">{fg.name}</div>
                        <div className="text-[10px] text-espresso/30">{fg.description}</div>
                      </td>
                      {plans.map(p => (
                        <td key={p.id} className="text-center px-4 py-3">
                          {hasPlanAccess(fg, p.id) ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> : <XCircle className="w-4 h-4 text-espresso/15 mx-auto" />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===== FEATURES ===== */}
      {tab === 'features' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-amber-50/60 border border-amber-100 mb-6">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-amber-600" />
              <div>
                <div className="text-sm font-medium text-amber-800">Gestao de Funcionalidades</div>
                <div className="text-xs text-amber-600/70">Controle quais funcionalidades cada plano acessa e defina prazos de teste gratis</div>
              </div>
            </div>
          </div>

          <div className="bg-white/60 border border-white/60 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-espresso/5">
                  <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Funcionalidade</th>
                  <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase hidden md:table-cell">Descricao</th>
                  <th className="text-center px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Trial (dias)</th>
                  <th className="text-center px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {featureGates.map(fg => (
                  <tr key={fg.id} className="border-b border-espresso/3 last:border-0 hover:bg-white/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-espresso">{fg.name}</div>
                      <div className="flex items-center gap-1 mt-1 md:hidden">
                        <span className="text-[10px] text-espresso/30">{fg.description}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-espresso/40">{fg.description}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{fg.freeTrial} dias</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {plans.map(p => (
                          <span key={p.id} className={`w-2 h-2 rounded-full bg-plan-${getPlanKey(p.id)} ${hasPlanAccess(fg, p.id) ? '' : 'opacity-20'}`} title={p.name} />
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* User Detail Drawer */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSelectedUser(null)} />
          <div className="relative w-full max-w-md bg-canvas border-l border-espresso/10 h-full overflow-y-auto shadow-2xl">
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <img src={selectedUser.avatar} alt="" className="w-14 h-14 rounded-full object-cover ring-2 ring-plum/30" />
                  <div>
                    <h3 className="font-serif text-xl text-espresso">{selectedUser.name}</h3>
                    <span className="text-[10px] text-espresso/30 capitalize">{selectedUser.role} · {selectedUser.plan}</span>
                  </div>
                </div>
                <button onClick={() => setSelectedUser(null)} className="p-2 rounded-full bg-canvas text-espresso/40 hover:text-espresso transition-colors">X</button>
              </div>

              {/* Contact */}
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-sm text-espresso/50"><Mail className="w-4 h-4 text-espresso/30" />{selectedUser.email}</div>
                <div className="flex items-center gap-2 text-sm text-espresso/50"><Phone className="w-4 h-4 text-espresso/30" />{selectedUser.phone}</div>
                <div className="flex items-center gap-2 text-sm text-espresso/50"><Clock className="w-4 h-4 text-espresso/30" />Ultimo login: {selectedUser.lastLogin}</div>
              </div>

              {/* Plan Info */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="p-4 rounded-xl bg-white/60 border border-white/60 text-center">
                  <div className="font-serif text-xl text-plum">R$ {selectedUser.planValue}</div>
                  <div className="text-[10px] text-espresso/30">Valor do plano/mes</div>
                </div>
                <div className="p-4 rounded-xl bg-white/60 border border-white/60 text-center">
                  <div className={`font-serif text-xl ${selectedUser.planDueDate === 'Vencido' ? 'text-red-500' : 'text-espresso'}`}>{selectedUser.planDueDate}</div>
                  <div className="text-[10px] text-espresso/30">Vencimento</div>
                </div>
                <div className="p-4 rounded-xl bg-white/60 border border-white/60 text-center">
                  <div className="font-serif text-xl text-espresso">R$ {selectedUser.totalSpent.toLocaleString()}</div>
                  <div className="text-[10px] text-espresso/30">Total gasto</div>
                </div>
                <div className="p-4 rounded-xl bg-white/60 border border-white/60 text-center">
                  <div className="font-serif text-xl text-espresso">{selectedUser.events}</div>
                  <div className="text-[10px] text-espresso/30">Eventos criados</div>
                </div>
              </div>

              {/* Payment */}
              <div className="mb-6 p-4 rounded-xl bg-white/60 border border-white/60">
                <div className="text-[10px] text-espresso/30 uppercase tracking-wider mb-2">Pagamento</div>
                <div className="flex items-center gap-2 text-sm text-espresso"><CreditCard className="w-4 h-4 text-espresso/30" />{selectedUser.paymentMethod}</div>
                <div className="text-[10px] text-espresso/30 mt-1">Termos aceitos em: {selectedUser.termsAccepted}</div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <button onClick={() => toggleUserStatus(selectedUser.id)} className={`w-full py-2.5 rounded-full text-xs font-medium transition-all flex items-center justify-center gap-2 ${selectedUser.status === 'ativo' ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                  {selectedUser.status === 'ativo' ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  {selectedUser.status === 'ativo' ? 'Bloquear Usuario' : 'Desbloquear Usuario'}
                </button>
                <button onClick={() => { navigator.clipboard.writeText(selectedUser.email); toast.success('Email copiado!') }} className="w-full py-2.5 bg-plum text-cream text-xs font-medium rounded-full hover:shadow-glow transition-all flex items-center justify-center gap-2">
                  <Mail className="w-3.5 h-3.5" /> Enviar Email
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
