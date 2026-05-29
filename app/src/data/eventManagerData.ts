export type EventProfile = 'balada' | 'casamento' | 'festival' | 'corporativo' | 'show' | 'aniversario' | 'formatura'

export interface EventBudget {
  id: string
  category: string
  item: string
  estimated: number
  actual: number
  paid: number
  status: 'pending' | 'paid' | 'overdue'
  vendor?: string
}

export interface EventVendor {
  id: string
  name: string
  category: string
  contact: string
  email: string
  price: number
  status: 'contacted' | 'negotiating' | 'confirmed' | 'cancelled'
  rating: number
  notes: string
}

export interface EventTask {
  id: string
  title: string
  category: string
  deadline: string
  assignedTo?: string
  status: 'todo' | 'doing' | 'done'
  priority: 'low' | 'medium' | 'high'
}

export interface EventTimeline {
  id: string
  time: string
  title: string
  description: string
  responsible: string
  status: 'pending' | 'done'
}

export interface EventTeam {
  id: string
  name: string
  role: string
  contact: string
  payment: number
  status: 'invited' | 'confirmed' | 'declined'
}

export interface EventCashFlow {
  id: string
  date: string
  description: string
  type: 'income' | 'expense'
  category: string
  amount: number
  balance: number
}

export interface ManagedEvent {
  id: string
  title: string
  profile: EventProfile
  date: string
  time: string
  location: string
  capacity: number
  sold: number
  status: 'planning' | 'selling' | 'ready' | 'happening' | 'finished' | 'cancelled'
  budget: EventBudget[]
  vendors: EventVendor[]
  tasks: EventTask[]
  timeline: EventTimeline[]
  team: EventTeam[]
  cashFlow: EventCashFlow[]
  ticketRevenue: number
  foodRevenue: number
  merchRevenue: number
}

export const eventProfiles: Record<EventProfile, { label: string; description: string; icon: string; defaultBudget: string[] }> = {
  balada: { label: 'Balada', description: 'Evento noturno com DJ, pista de danca e open bar', icon: 'Music', defaultBudget: ['Local', 'Som & Iluminacao', 'DJ', 'Seguranca', 'Open Bar', 'Marketing'] },
  casamento: { label: 'Casamento', description: 'Cerimonia e recepcao completa', icon: 'Heart', defaultBudget: ['Local', 'Buffet', 'Decoracao', 'Foto & Video', 'Banda', 'Convites'] },
  festival: { label: 'Festival', description: 'Multi-palcos, multi-artistas, grande publico', icon: 'Mic', defaultBudget: ['Estrutura', 'Palcos', 'Artistas', 'Som', 'Seguranca', 'Sanitarios', 'Alimentacao', 'Marketing'] },
  corporativo: { label: 'Corporativo', description: 'Evento empresarial, confraternizacao ou lancamento', icon: 'Building', defaultBudget: ['Local', 'Coffee Break', 'Palestrante', 'Material', 'Audio Visual', 'Brindes'] },
  show: { label: 'Show', description: 'Apresentacao de artista ou banda', icon: 'Guitar', defaultBudget: ['Local', 'Camarim', 'Backline', 'Som', 'Iluminacao', 'Seguranca'] },
  aniversario: { label: 'Aniversario', description: 'Festa de aniversario privada', icon: 'Cake', defaultBudget: ['Local', 'Buffet', 'Decoracao', 'DJ', 'Foto'] },
  formatura: { label: 'Formatura', description: 'Baile de formatura com cerimonia', icon: 'GraduationCap', defaultBudget: ['Local', 'Buffet', 'Banda', 'Decoracao', 'Foto & Video', 'Seguranca'] },
}

const defaultBudgetItems: EventBudget[] = [
  { id: 'b1', category: 'Local', item: 'Aluguel do espaco', estimated: 5000, actual: 5000, paid: 5000, status: 'paid', vendor: 'Warehouse Central' },
  { id: 'b2', category: 'Som & Iluminacao', item: 'Equipamento completo', estimated: 3000, actual: 3200, paid: 1600, status: 'pending', vendor: 'ProSound' },
  { id: 'b3', category: 'DJ', item: 'DJ residente', estimated: 2000, actual: 2000, paid: 0, status: 'pending', vendor: 'DJ Thiago' },
  { id: 'b4', category: 'Seguranca', item: 'Equipe de seguranca', estimated: 1500, actual: 1500, paid: 0, status: 'pending', vendor: 'Alpha Security' },
  { id: 'b5', category: 'Open Bar', item: 'Bebidas e bartenders', estimated: 4000, actual: 3800, paid: 1900, status: 'pending', vendor: 'Drink Masters' },
  { id: 'b6', category: 'Marketing', item: 'Divulgacao', estimated: 1000, actual: 800, paid: 800, status: 'paid', vendor: 'Evokaa Ads' },
  { id: 'b7', category: 'Decoracao', item: 'Tematica neon', estimated: 2000, actual: 0, paid: 0, status: 'pending' },
  { id: 'b8', category: 'Misc', item: 'Imprevistos', estimated: 1000, actual: 0, paid: 0, status: 'pending' },
]

const defaultVendors: EventVendor[] = [
  { id: 'v1', name: 'ProSound', category: 'Som & Iluminacao', contact: '(11) 98765-0001', email: 'contato@prosound.com', price: 3200, status: 'confirmed', rating: 4.8, notes: 'Entrega 2h antes' },
  { id: 'v2', name: 'DJ Thiago', category: 'DJ', contact: '(11) 98765-0002', email: 'dj@thiago.com', price: 2000, status: 'negotiating', rating: 4.5, notes: 'Pediu deposito de 50%' },
  { id: 'v3', name: 'Alpha Security', category: 'Seguranca', contact: '(11) 98765-0003', email: 'alpha@sec.com', price: 1500, status: 'confirmed', rating: 4.7, notes: '10 segurancas + 1 supervisor' },
  { id: 'v4', name: 'Drink Masters', category: 'Open Bar', contact: '(11) 98765-0004', email: 'drink@masters.com', price: 3800, status: 'negotiating', rating: 4.3, notes: 'Inclui 4 bartenders' },
  { id: 'v5', name: 'Neon Decor', category: 'Decoracao', contact: '(11) 98765-0005', email: 'neon@decor.com', price: 2000, status: 'contacted', rating: 4.0, notes: 'Aguardando orcamento' },
]

const defaultTasks: EventTask[] = [
  { id: 't1', title: 'Confirmar local do evento', category: 'Local', deadline: '2025-05-01', status: 'done', priority: 'high' },
  { id: 't2', title: 'Contratar DJ', category: 'Entretenimento', deadline: '2025-05-10', assignedTo: 'Joao', status: 'doing', priority: 'high' },
  { id: 't3', title: 'Definir cardapio do open bar', category: 'Alimentacao', deadline: '2025-05-15', status: 'todo', priority: 'medium' },
  { id: 't4', title: 'Criar arte dos ingressos', category: 'Marketing', deadline: '2025-05-05', status: 'done', priority: 'medium' },
  { id: 't5', title: 'Contratar equipe de seguranca', category: 'Seguranca', deadline: '2025-05-20', status: 'doing', priority: 'high' },
  { id: 't6', title: 'Testar sistema de som', category: 'Tecnico', deadline: '2025-06-10', status: 'todo', priority: 'high' },
  { id: 't7', title: 'Publicar evento nas redes', category: 'Marketing', deadline: '2025-05-08', assignedTo: 'Maria', status: 'doing', priority: 'low' },
  { id: 't8', title: 'Montar decoracao', category: 'Decoracao', deadline: '2025-06-14', status: 'todo', priority: 'medium' },
  { id: 't9', title: 'Briefing da equipe', category: 'Equipe', deadline: '2025-06-13', status: 'todo', priority: 'high' },
]

const defaultTimeline: EventTimeline[] = [
  { id: 'tl1', time: '14:00', title: 'Chegada da equipe tecnica', description: 'Som, iluminacao e decoracao', responsible: 'ProSound / Neon Decor', status: 'pending' },
  { id: 'tl2', time: '16:00', title: 'Montagem completa', description: 'Testes de som e luz', responsible: 'ProSound', status: 'pending' },
  { id: 'tl3', time: '18:00', title: 'Briefing geral', description: 'Reuniao com toda equipe', responsible: 'Produtor', status: 'pending' },
  { id: 'tl4', time: '20:00', title: 'Abertura dos portoes', description: 'Inicio do check-in', responsible: 'Seguranca', status: 'pending' },
  { id: 'tl5', time: '21:00', title: 'Abertura da pista', description: 'DJ warmup', responsible: 'DJ Thiago', status: 'pending' },
  { id: 'tl6', time: '22:00', title: 'Show principal', description: 'Atracao principal', responsible: 'Artista', status: 'pending' },
  { id: 'tl7', time: '00:00', title: 'After party', description: 'DJ set ate 4h', responsible: 'DJ Thiago', status: 'pending' },
  { id: 'tl8', time: '04:00', title: 'Fechamento', description: 'Desmontagem e limpeza', responsible: 'Equipe geral', status: 'pending' },
]

const defaultTeam: EventTeam[] = [
  { id: 'tm1', name: 'Joao Silva', role: 'Produtor Executivo', contact: '(11) 98765-1111', payment: 0, status: 'confirmed' },
  { id: 'tm2', name: 'Maria Oliveira', role: 'Marketing', contact: '(11) 98765-2222', payment: 1500, status: 'confirmed' },
  { id: 'tm3', name: 'Pedro Costa', role: 'Operacoes', contact: '(11) 98765-3333', payment: 1200, status: 'confirmed' },
  { id: 'tm4', name: 'Ana Santos', role: 'Atendimento', contact: '(11) 98765-4444', payment: 800, status: 'invited' },
]

const defaultCashFlow: EventCashFlow[] = [
  { id: 'cf1', date: '2025-04-01', description: 'Venda - Ingresso VIP (Ana)', type: 'income', category: 'Ingressos', amount: 280, balance: 280 },
  { id: 'cf2', date: '2025-04-03', description: 'Venda - Mesa Coletiva (Bruno)', type: 'income', category: 'Ingressos', amount: 160, balance: 440 },
  { id: 'cf3', date: '2025-04-05', description: 'Pagamento - Aluguel do local', type: 'expense', category: 'Local', amount: -5000, balance: -4560 },
  { id: 'cf4', date: '2025-04-08', description: 'Venda - Ingresso Geral (5x)', type: 'income', category: 'Ingressos', amount: 400, balance: -4160 },
  { id: 'cf5', date: '2025-04-10', description: 'Entrada - Som (50%)', type: 'expense', category: 'Som', amount: -1600, balance: -5760 },
  { id: 'cf6', date: '2025-04-12', description: 'Venda - Ingresso VIP (3x)', type: 'income', category: 'Ingressos', amount: 840, balance: -4920 },
  { id: 'cf7', date: '2025-04-15', description: 'Pagamento - Marketing', type: 'expense', category: 'Marketing', amount: -800, balance: -5720 },
  { id: 'cf8', date: '2025-04-18', description: 'Venda - Mesa VIP (2x)', type: 'income', category: 'Ingressos', amount: 1200, balance: -4520 },
]

export const managedEvents: ManagedEvent[] = [
  {
    id: 'me1',
    title: 'Noite Eletro 2025',
    profile: 'balada',
    date: '15 Jun 2025',
    time: '22:00',
    location: 'Warehouse Central, SP',
    capacity: 2000,
    sold: 1247,
    status: 'selling',
    budget: defaultBudgetItems,
    vendors: defaultVendors,
    tasks: defaultTasks,
    timeline: defaultTimeline,
    team: defaultTeam,
    cashFlow: defaultCashFlow,
    ticketRevenue: 87450,
    foodRevenue: 12300,
    merchRevenue: 4500,
  },
  {
    id: 'me2',
    title: 'Jazz Sunset Session',
    profile: 'show',
    date: '22 Jun 2025',
    time: '17:00',
    location: 'Rooftop Skyline, SP',
    capacity: 500,
    sold: 342,
    status: 'selling',
    budget: defaultBudgetItems.map(b => ({ ...b, actual: b.actual * 0.4, paid: b.paid * 0.4 })),
    vendors: defaultVendors.slice(0, 3),
    tasks: defaultTasks.slice(0, 5),
    timeline: defaultTimeline.slice(0, 5),
    team: defaultTeam.slice(0, 3),
    cashFlow: defaultCashFlow.slice(0, 5),
    ticketRevenue: 28400,
    foodRevenue: 5600,
    merchRevenue: 0,
  },
  {
    id: 'me3',
    title: 'Casamento Lima & Costa',
    profile: 'casamento',
    date: '30 Ago 2025',
    time: '16:00',
    location: 'Sitio das Flores, SP',
    capacity: 150,
    sold: 0,
    status: 'planning',
    budget: [
      { id: 'cb1', category: 'Local', item: 'Aluguel sitio', estimated: 8000, actual: 0, paid: 0, status: 'pending' },
      { id: 'cb2', category: 'Buffet', item: 'Jantar 150 pessoas', estimated: 15000, actual: 0, paid: 0, status: 'pending' },
      { id: 'cb3', category: 'Decoracao', item: 'Rustico romantico', estimated: 5000, actual: 0, paid: 0, status: 'pending' },
      { id: 'cb4', category: 'Foto & Video', item: 'Cobertura completa', estimated: 4000, actual: 0, paid: 0, status: 'pending' },
      { id: 'cb5', category: 'Banda', item: 'Banda ao vivo', estimated: 3500, actual: 0, paid: 0, status: 'pending' },
      { id: 'cb6', category: 'Convites', item: 'Papelaria completa', estimated: 1500, actual: 0, paid: 0, status: 'pending' },
    ],
    vendors: [],
    tasks: [
      { id: 'ct1', title: 'Definir lista de convidados', category: 'Planejamento', deadline: '2025-05-01', status: 'doing', priority: 'high' },
      { id: 'ct2', title: 'Visitar o sitio', category: 'Local', deadline: '2025-05-05', status: 'todo', priority: 'high' },
      { id: 'ct3', title: 'Contratar buffet', category: 'Alimentacao', deadline: '2025-05-15', status: 'todo', priority: 'high' },
    ],
    timeline: [],
    team: [],
    cashFlow: [],
    ticketRevenue: 0,
    foodRevenue: 0,
    merchRevenue: 0,
  },
]
