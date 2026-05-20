export type TicketType = 'individual' | 'coletiva' | 'vip' | 'mesa';

export interface Ticket {
  id: string;
  name: string;
  description: string;
  price: number;
  capacity: number;
  sold: number;
  perks: string[];
  type: TicketType;
}

export interface Event {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  date: string;
  time: string;
  location: string;
  address: string;
  image: string;
  gallery: string[];
  tickets: Ticket[];
  tags: string[];
  status: 'upcoming' | 'ongoing' | 'past';
}

export interface InterestedUser {
  id: string;
  name: string;
  avatar: string;
  action: string;
  time: string;
}

export interface TableStatus {
  id: string;
  name: string;
  capacity: number;
  filled: number;
  status: 'available' | 'filling' | 'full';
}

export const events: Event[] = [
  {
    id: 'noite-eletro-2025',
    title: 'Noite Eletro 2025',
    subtitle: 'Uma experiência sonora imersiva',
    description: 'Prepare-se para uma noite inesquecível onde a música eletrônica encontra a arte visual. DJs renomados, instalações imersivas e uma atmosfera única que vai transformar sua percepção de entretenimento.',
    date: '15 de Junho, 2025',
    time: '22:00 - 06:00',
    location: 'Warehouse Central',
    address: 'Av. Paulista, 1000 - São Paulo, SP',
    image: '/images/hero-bg.jpg',
    gallery: ['/images/concert-1.jpg', '/images/concert-2.jpg', '/images/concert-3.jpg', '/images/event-card-1.jpg', '/images/event-card-2.jpg', '/images/concert-1.jpg'],
    tags: ['Música', 'Eletrônica', 'Arte'],
    status: 'upcoming',
    tickets: [
      {
        id: 'ingresso-geral',
        name: 'Ingresso Geral',
        description: 'Acesso completo à pista principal e áreas comuns do evento.',
        price: 120,
        capacity: 500,
        sold: 342,
        perks: ['Acesso à pista principal', '1 drink incluso', 'Acesso aos banheiros VIP'],
        type: 'individual'
      },
      {
        id: 'ingresso-vip',
        name: 'Ingresso VIP',
        description: 'Experiência premium com áreas exclusivas e benefícios especiais.',
        price: 280,
        capacity: 150,
        sold: 89,
        perks: ['Acesso área VIP', 'Open bar premium', 'Entrada prioritária', 'Lounge exclusivo', 'Meet & Greet'],
        type: 'vip'
      },
      {
        id: 'mesa-coletiva',
        name: 'Mesa Coletiva',
        description: 'Ideal para quem quer conhecer novas pessoas. Lugares compartilhados com matchmaking por afinidade. Nosso algoritmo monta sua mesa baseado em interesses, temperamento e vibe.',
        price: 160,
        capacity: 48,
        sold: 31,
        perks: ['Assento em mesa curada por afinidade', 'Matchmaking algorítmico', 'Welcome drink coletivo', 'Icebreakers exclusivos', 'Acesso à área de networking'],
        type: 'coletiva'
      },
      {
        id: 'mesa-camarote',
        name: 'Mesa Camarote',
        description: 'Mesa privativa com atendimento exclusivo para grupos.',
        price: 1500,
        capacity: 10,
        sold: 6,
        perks: ['Mesa privativa para 8 pessoas', 'Garçom exclusivo', 'Champagne premium', 'Visão panorâmica', 'Estacionamento VIP'],
        type: 'mesa'
      }
    ]
  },
  {
    id: 'jazz-sunset',
    title: 'Jazz Sunset Session',
    subtitle: 'Tardes de jazz ao vivo',
    description: 'Uma experiência íntima de jazz com músicos talentosos, cocktails artesanais e o pôr do sol mais bonido da cidade.',
    date: '22 de Junho, 2025',
    time: '17:00 - 23:00',
    location: 'Rooftop Skyline',
    address: 'Rua Oscar Freire, 500 - São Paulo, SP',
    image: '/images/event-card-1.jpg',
    gallery: ['/images/concert-2.jpg', '/images/concert-3.jpg', '/images/event-card-2.jpg'],
    tags: ['Jazz', 'Música ao vivo', 'Gastronomia'],
    status: 'upcoming',
    tickets: [
      {
        id: 'ingresso-geral-jazz',
        name: 'Ingresso Geral',
        description: 'Acesso ao rooftop e área de shows.',
        price: 80,
        capacity: 200,
        sold: 156,
        perks: ['Acesso ao rooftop', '1 welcome drink'],
        type: 'individual'
      },
      {
        id: 'ingresso-vip-jazz',
        name: 'Ingresso VIP',
        description: 'Área frontal com mesa reservada.',
        price: 180,
        capacity: 50,
        sold: 32,
        perks: ['Mesa reservada', 'Open bar de cocktails', 'Acesso à área frontal'],
        type: 'vip'
      }
    ]
  },
  {
    id: 'feira-arte-contemporanea',
    title: 'Feira de Arte Contemporânea',
    subtitle: 'Arte, cultura e inovação',
    description: 'A maior feira de arte contemporânea do país reunindo artistas nacionais e internacionais em um espaço de diálogo e descoberta.',
    date: '10 de Julho, 2025',
    time: '10:00 - 20:00',
    location: 'Centro Cultural',
    address: 'Praça da Sé, 100 - São Paulo, SP',
    image: '/images/event-card-2.jpg',
    gallery: ['/images/event-card-1.jpg', '/images/concert-1.jpg', '/images/concert-3.jpg'],
    tags: ['Arte', 'Cultura', 'Workshop'],
    status: 'upcoming',
    tickets: [
      {
        id: 'ingresso-dia',
        name: 'Ingresso Diário',
        description: 'Acesso por um dia à feira completa.',
        price: 45,
        capacity: 1000,
        sold: 678,
        perks: ['Acesso às exposições', 'Catálogo digital'],
        type: 'individual'
      },
      {
        id: 'ingresso-premium',
        name: 'Ingresso Premium',
        description: 'Acesso ilimitado + workshops exclusivos.',
        price: 120,
        capacity: 200,
        sold: 145,
        perks: ['Acesso ilimitado', 'Workshops exclusivos', 'Visita guiada', 'Café de boas-vindas'],
        type: 'vip'
      }
    ]
  }
];

export const interestedUsers: InterestedUser[] = [
  { id: '1', name: 'Ana Silva', avatar: 'https://i.pravatar.cc/150?img=1', action: 'confirmou presença', time: '2 minutos atrás' },
  { id: '2', name: 'Carlos Mendes', avatar: 'https://i.pravatar.cc/150?img=3', action: 'comprou ingresso VIP', time: '5 minutos atrás' },
  { id: '3', name: 'Mariana Costa', avatar: 'https://i.pravatar.cc/150?img=5', action: 'mostrou interesse', time: '8 minutos atrás' },
  { id: '4', name: 'Pedro Oliveira', avatar: 'https://i.pravatar.cc/150?img=8', action: 'confirmou presença', time: '12 minutos atrás' },
  { id: '5', name: 'Julia Santos', avatar: 'https://i.pravatar.cc/150?img=9', action: 'comprou ingresso Geral', time: '15 minutos atrás' },
  { id: '6', name: 'Lucas Ferreira', avatar: 'https://i.pravatar.cc/150?img=11', action: 'mostrou interesse', time: '20 minutos atrás' },
];

export const tableStatus: TableStatus[] = [
  { id: 'mesa-1', name: 'Mesa Premium 1', capacity: 8, filled: 8, status: 'full' },
  { id: 'mesa-2', name: 'Mesa Premium 2', capacity: 8, filled: 6, status: 'filling' },
  { id: 'mesa-3', name: 'Mesa Gold 1', capacity: 6, filled: 4, status: 'filling' },
  { id: 'mesa-4', name: 'Mesa Gold 2', capacity: 6, filled: 6, status: 'full' },
  { id: 'mesa-5', name: 'Mesa Silver 1', capacity: 4, filled: 2, status: 'available' },
];

export interface MesaMember {
  id: string;
  name: string;
  avatar: string;
  role: string;
  vibe: string;
  interests: string[];
  tableName: string;
  seatNumber: number;
}

export interface MesaColetiva {
  id: string;
  name: string;
  capacity: number;
  members: MesaMember[];
  theme: string;
  compatibility: number;
}

export const mesasColetivas: MesaColetiva[] = [
  {
    id: 'mesa-c-01',
    name: 'Mesa Aurora',
    capacity: 6,
    theme: 'Criativos Noturnos',
    compatibility: 94,
    members: [
      { id: 'm1', name: 'Você', avatar: 'https://i.pravatar.cc/150?img=12', role: 'Designer', vibe: 'Visionário', interests: ['Arte digital', 'Música eletrônica', 'Fotografia'], tableName: 'Mesa Aurora', seatNumber: 1 },
      { id: 'm2', name: 'Luna', avatar: 'https://i.pravatar.cc/150?img=5', role: 'Produtora Musical', vibe: 'Energética', interests: ['Techno', 'Festivais', 'Vinyl'], tableName: 'Mesa Aurora', seatNumber: 2 },
      { id: 'm3', name: 'Rafa', avatar: 'https://i.pravatar.cc/150?img=3', role: 'Arquiteto', vibe: 'Observador', interests: ['Design', 'Jazz', 'Café'], tableName: 'Mesa Aurora', seatNumber: 3 },
      { id: 'm4', name: 'Camila', avatar: 'https://i.pravatar.cc/150?img=9', role: 'Ilustradora', vibe: 'Sonhadora', interests: ['Arte', 'Literatura', 'Viagens'], tableName: 'Mesa Aurora', seatNumber: 4 },
      { id: 'm5', name: 'Thiago', avatar: 'https://i.pravatar.cc/150?img=11', role: 'Dev', vibe: 'Curioso', interests: ['Tech', 'Música', 'Games'], tableName: 'Mesa Aurora', seatNumber: 5 },
      { id: 'm6', name: 'Isa', avatar: 'https://i.pravatar.cc/150?img=20', role: 'Fotógrafa', vibe: 'Extrovertida', interests: ['Fotografia', 'Moda', 'Dança'], tableName: 'Mesa Aurora', seatNumber: 6 },
    ]
  },
  {
    id: 'mesa-c-02',
    name: 'Mesa Nebula',
    capacity: 6,
    theme: 'Exploradores Sonoros',
    compatibility: 89,
    members: [
      { id: 'm7', name: 'Você', avatar: 'https://i.pravatar.cc/150?img=12', role: 'Designer', vibe: 'Visionário', interests: ['Arte digital', 'Música eletrônica', 'Fotografia'], tableName: 'Mesa Nebula', seatNumber: 1 },
      { id: 'm8', name: 'Diego', avatar: 'https://i.pravatar.cc/150?img=8', role: 'DJ', vibe: 'Intenso', interests: ['House', 'Produção', 'Festivais'], tableName: 'Mesa Nebula', seatNumber: 2 },
      { id: 'm9', name: 'Marina', avatar: 'https://i.pravatar.cc/150?img=16', role: 'Jornalista', vibe: 'Analítica', interests: ['Cultura', 'Música', 'Cinema'], tableName: 'Mesa Nebula', seatNumber: 3 },
      { id: 'm10', name: 'Gabe', avatar: 'https://i.pravatar.cc/150?img=15', role: 'Empreendedor', vibe: 'Ambicioso', interests: ['Startups', 'Networking', 'House'], tableName: 'Mesa Nebula', seatNumber: 4 },
      { id: 'm11', name: 'Sofia', avatar: 'https://i.pravatar.cc/150?img=23', role: 'Stylist', vibe: 'Criativa', interests: ['Moda', 'Arte', 'Dança'], tableName: 'Mesa Nebula', seatNumber: 5 },
      { id: 'm12', name: 'Leo', avatar: 'https://i.pravatar.cc/150?img=13', role: 'Músico', vibe: 'Sensível', interests: ['Jazz', 'Piano', 'Poesia'], tableName: 'Mesa Nebula', seatNumber: 6 },
    ]
  }
];

export const profileQuestions = [
  {
    id: 'temperament',
    question: 'Como você descreveria seu temperamento em eventos?',
    options: [
      { value: 'extrovert', label: 'Extrovertido', desc: 'Adoro puxar conversa e conhecer gente nova' },
      { value: 'ambivert', label: 'Ambivertido', desc: 'Depende do momento e da energia do lugar' },
      { value: 'introvert', label: 'Introvertido', desc: 'Prefiro conversas profundas em grupos menores' },
    ]
  },
  {
    id: 'intent',
    question: 'Qual seu objetivo principal nesse evento?',
    options: [
      { value: 'social', label: 'Social', desc: 'Quero fazer novas amizades e conexões' },
      { value: 'professional', label: 'Profissional', desc: 'Busco networking e parcerias' },
      { value: 'experience', label: 'Experiência', desc: 'Quero viver algo único e memorável' },
    ]
  },
  {
    id: 'music',
    question: 'Qual estilo musical te define mais?',
    options: [
      { value: 'techno', label: 'Techno/House', desc: 'Batidas eletrônicas e pistas escuras' },
      { value: 'indie', label: 'Indie/Alternativo', desc: 'Som diferentão e vibe artística' },
      { value: 'eclectic', label: 'Eclético', desc: 'Curto de tudo, depende do momento' },
    ]
  },
  {
    id: 'energy',
    question: 'Como você curte viver a noite?',
    options: [
      { value: 'dance', label: 'Na pista', desc: 'Dançando do início ao fim' },
      { value: 'lounge', label: 'Na lounge', desc: 'Conversando com drinks' },
      { value: 'explore', label: 'Explorando', desc: 'Circulando e descobrindo o espaço' },
    ]
  },
];

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: 'bebida' | 'comida' | 'combo' | 'merchandise' | 'servico';
  image: string;
  available: boolean;
  eventId: string;
}

export interface ComandaOrder {
  id: string;
  userId: string;
  eventId: string;
  items: { itemId: string; qty: number; price: number }[];
  total: number;
  status: 'pending' | 'confirmed' | 'ready' | 'delivered';
  pickupTime: string;
  createdAt: string;
}

export const menuItems: MenuItem[] = [
  {
    id: 'menu-1',
    name: 'Gin Tonica Premium',
    description: 'Gin importado, agua tonica artesanal, limao siciliano, especiarias',
    price: 35,
    category: 'bebida',
    image: '/images/concert-2.jpg',
    available: true,
    eventId: 'noite-eletro-2025'
  },
  {
    id: 'menu-2',
    name: 'Cerveja Artesanal IPA',
    description: 'Cerveja local, 500ml, estilo India Pale Ale',
    price: 22,
    category: 'bebida',
    image: '/images/concert-2.jpg',
    available: true,
    eventId: 'noite-eletro-2025'
  },
  {
    id: 'menu-3',
    name: 'Balde de Corona (6 un)',
    description: '6 cervejas Corona com limao, servidas no balde de gelo',
    price: 95,
    category: 'combo',
    image: '/images/concert-2.jpg',
    available: true,
    eventId: 'noite-eletro-2025'
  },
  {
    id: 'menu-4',
    name: 'Hamburguer Smash',
    description: 'Duplo smash, queijo cheddar, bacon crocante, molho da casa',
    price: 38,
    category: 'comida',
    image: '/images/concert-2.jpg',
    available: true,
    eventId: 'noite-eletro-2025'
  },
  {
    id: 'menu-5',
    name: 'Batata Frita Trufada',
    description: 'Batata rustica, azeite trufado, parmesao, alecrim',
    price: 28,
    category: 'comida',
    image: '/images/concert-2.jpg',
    available: true,
    eventId: 'noite-eletro-2025'
  },
  {
    id: 'menu-6',
    name: 'Combo Noite Eletro',
    description: '2 drinks + 1 porcao + 2 aguas',
    price: 89,
    category: 'combo',
    image: '/images/concert-2.jpg',
    available: true,
    eventId: 'noite-eletro-2025'
  },
  {
    id: 'menu-7',
    name: 'Camiseta Oficial',
    description: 'Camiseta exclusiva do evento, 100% algodao',
    price: 65,
    category: 'merchandise',
    image: '/images/concert-2.jpg',
    available: true,
    eventId: 'noite-eletro-2025'
  },
  {
    id: 'menu-8',
    name: 'Workshop de Mixologia',
    description: 'Aula de 30min com bartender profissional, inclui 2 drinks',
    price: 60,
    category: 'servico',
    image: '/images/concert-2.jpg',
    available: true,
    eventId: 'noite-eletro-2025'
  }
];

export interface CRMLead {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  source: 'instagram' | 'indicacao' | 'orgânico' | 'evento' | 'tiktok' | 'google';
  status: 'novo' | 'qualificado' | 'proposta' | 'negociacao' | 'fechado' | 'perdido';
  score: number;
  lastActivity: string;
  tags: string[];
  assignedTo: string;
  value: number;
  eventInterest: string;
  notes: string;
  interactions: { date: string; type: 'email' | 'whatsapp' | 'call' | 'meeting' | 'event'; content: string }[];
  tasks: { id: string; title: string; done: boolean; due: string }[];
  createdAt: string;
  temperament: 'extrovert' | 'ambivert' | 'introvert';
  intent: 'social' | 'professional' | 'experience';
}

export interface PipelineStage {
  id: string;
  label: string;
  color: string;
  icon: string;
  leads: string[];
}

export interface CRMAnalytic {
  label: string;
  value: number;
  change: string;
  color: string;
}

export const crmLeads: CRMLead[] = [
  {
    id: 'lead-001',
    name: 'Ana Carolina Silva',
    email: 'ana.silva@email.com',
    phone: '(11) 98765-4321',
    avatar: 'https://i.pravatar.cc/150?img=5',
    source: 'instagram',
    status: 'proposta',
    score: 87,
    lastActivity: '2 horas atras',
    tags: ['VIP', 'Mesa Coletiva', 'Recorrente'],
    assignedTo: 'Joao Produtor',
    value: 480,
    eventInterest: 'Noite Eletro 2025',
    notes: 'Cliente fiel, comprou 3x anteriormente. Interesse em mesa coletiva. Extrovertida, curte techno.',
    interactions: [
      { date: '14 Mai 2025', type: 'event', content: 'Participou do Jazz Sunset' },
      { date: '13 Mai 2025', type: 'whatsapp', content: 'Enviou mensagem perguntando sobre mesa coletiva' },
      { date: '10 Mai 2025', type: 'email', content: 'Newsletter aberta 3x' },
    ],
    tasks: [
      { id: 't1', title: 'Enviar proposta de mesa VIP', done: false, due: '16 Mai' },
      { id: 't2', title: 'Ligar para confirmar interesse', done: true, due: '14 Mai' },
    ],
    createdAt: '01 Mai 2025',
    temperament: 'extrovert',
    intent: 'social',
  },
  {
    id: 'lead-002',
    name: 'Bruno Mendes Costa',
    email: 'bruno.costa@email.com',
    phone: '(11) 91234-5678',
    avatar: 'https://i.pravatar.cc/150?img=11',
    source: 'indicacao',
    status: 'negociacao',
    score: 92,
    lastActivity: '30 minutos atras',
    tags: ['Grupo', 'Empresa'],
    assignedTo: 'Joao Produtor',
    value: 1200,
    eventInterest: 'Noite Eletro 2025',
    notes: 'Quer reservar mesa para equipe de 8 pessoas. Veio por indicacao da Camila.',
    interactions: [
      { date: '15 Mai 2025', type: 'call', content: 'Call de 15min, interesse confirmado' },
      { date: '14 Mai 2025', type: 'whatsapp', content: 'Pediu orcamento para 8 pessoas' },
    ],
    tasks: [
      { id: 't3', title: 'Preparar contrato mesa corporativa', done: false, due: '17 Mai' },
      { id: 't4', title: 'Enviar link split payment', done: false, due: '16 Mai' },
    ],
    createdAt: '10 Mai 2025',
    temperament: 'ambivert',
    intent: 'professional',
  },
  {
    id: 'lead-003',
    name: 'Camila Rocha Oliveira',
    email: 'camila.rocha@email.com',
    phone: '(11) 99876-5432',
    avatar: 'https://i.pravatar.cc/150?img=9',
    source: 'tiktok',
    status: 'qualificado',
    score: 74,
    lastActivity: '5 horas atras',
    tags: ['Influencer', 'Gen Z'],
    assignedTo: 'Maria Produtora',
    value: 320,
    eventInterest: 'Noite Eletro 2025',
    notes: 'Micro-influencer com 15k seguidores. Pode fazer parceria de divulgacao.',
    interactions: [
      { date: '15 Mai 2025', type: 'event', content: 'Marcou amiga em post do evento' },
      { date: '12 Mai 2025', type: 'event', content: 'Clicou no link da bio' },
    ],
    tasks: [
      { id: 't5', title: 'Enviar proposta de parceria', done: false, due: '18 Mai' },
    ],
    createdAt: '05 Mai 2025',
    temperament: 'extrovert',
    intent: 'experience',
  },
  {
    id: 'lead-004',
    name: 'Diego Ferreira Lima',
    email: 'diego.lima@email.com',
    phone: '(11) 92345-6789',
    avatar: 'https://i.pravatar.cc/150?img=3',
    source: 'google',
    status: 'novo',
    score: 45,
    lastActivity: '1 dia atras',
    tags: ['Primeira Compra'],
    assignedTo: 'Nao atribuido',
    value: 120,
    eventInterest: 'Noite Eletro 2025',
    notes: 'Primeiro contato. Veio pelo Google. Visualizou pagina 2x mas nao adicionou ao carrinho.',
    interactions: [
      { date: '14 Mai 2025', type: 'email', content: 'Cadastrou email na landing' },
    ],
    tasks: [
      { id: 't6', title: 'Enviar email de boas-vindas', done: false, due: '16 Mai' },
    ],
    createdAt: '14 Mai 2025',
    temperament: 'introvert',
    intent: 'social',
  },
  {
    id: 'lead-005',
    name: 'Elisa Nakamura',
    email: 'elisa.nak@email.com',
    phone: '(11) 93456-7890',
    avatar: 'https://i.pravatar.cc/150?img=20',
    source: 'evento',
    status: 'fechado',
    score: 95,
    lastActivity: '10 minutos atras',
    tags: ['Mesa Coletiva', 'Matchmaking'],
    assignedTo: 'Joao Produtor',
    value: 160,
    eventInterest: 'Noite Eletro 2025',
    notes: 'COMPROU ingresso Mesa Coletiva! Fez o quiz de perfil. Match 94% com a Mesa Aurora.',
    interactions: [
      { date: '15 Mai 2025', type: 'event', content: 'Comprou ingresso Mesa Coletiva' },
      { date: '15 Mai 2025', type: 'whatsapp', content: 'Completou quiz de matchmaking' },
    ],
    tasks: [
      { id: 't7', title: 'Enviar confirmacao de mesa', done: true, due: '15 Mai' },
      { id: 't8', title: 'Compartilhar perfil da mesa', done: false, due: '13 Jun' },
    ],
    createdAt: '15 Mai 2025',
    temperament: 'ambivert',
    intent: 'experience',
  },
  {
    id: 'lead-006',
    name: 'Felipe Souza Andrade',
    email: 'felipe.sa@email.com',
    phone: '(11) 94567-8901',
    avatar: 'https://i.pravatar.cc/150?img=13',
    source: 'orgânico',
    status: 'perdido',
    score: 23,
    lastActivity: '7 dias atras',
    tags: ['Abandonou Carrinho'],
    assignedTo: 'Nao atribuido',
    value: 0,
    eventInterest: 'Jazz Sunset Session',
    notes: 'Adicionou ao carrinho mas nao completou. Precisa de remarketing.',
    interactions: [
      { date: '08 Mai 2025', type: 'event', content: 'Abandonou carrinho - ingresso VIP' },
    ],
    tasks: [
      { id: 't9', title: 'Enviar email de recuperacao', done: false, due: '16 Mai' },
    ],
    createdAt: '08 Mai 2025',
    temperament: 'introvert',
    intent: 'experience',
  },
  {
    id: 'lead-007',
    name: 'Gabriela Torres',
    email: 'gabi.torres@email.com',
    phone: '(11) 95678-9012',
    avatar: 'https://i.pravatar.cc/150?img=16',
    source: 'indicacao',
    status: 'proposta',
    score: 81,
    lastActivity: '1 hora atras',
    tags: ['VIP', 'Grupo'],
    assignedTo: 'Maria Produtora',
    value: 840,
    eventInterest: 'Jazz Sunset Session',
    notes: 'Grupo de 6 amigas. Quer mesa reservada no rooftop. Orcamento enviado.',
    interactions: [
      { date: '15 Mai 2025', type: 'email', content: 'Enviou orcamento para 6 pessoas' },
      { date: '14 Mai 2025', type: 'whatsapp', content: 'Perguntou sobre disponibilidade de mesa' },
    ],
    tasks: [
      { id: 't10', title: 'Confirmar reserva mesa rooftop', done: false, due: '16 Mai' },
    ],
    createdAt: '12 Mai 2025',
    temperament: 'extrovert',
    intent: 'social',
  },
  {
    id: 'lead-008',
    name: 'Henrique Almeida',
    email: 'henrique.a@email.com',
    phone: '(11) 96789-0123',
    avatar: 'https://i.pravatar.cc/150?img=8',
    source: 'instagram',
    status: 'qualificado',
    score: 68,
    lastActivity: '3 horas atras',
    tags: ['Mesa Coletiva'],
    assignedTo: 'Joao Produtor',
    value: 160,
    eventInterest: 'Noite Eletro 2025',
    notes: 'Interesse em Mesa Coletiva. Ja fez login no app. Ver perfil incompleto.',
    interactions: [
      { date: '15 Mai 2025', type: 'event', content: 'Criou conta na plataforma' },
      { date: '15 Mai 2025', type: 'whatsapp', content: 'Perguntou como funciona mesa coletiva' },
    ],
    tasks: [
      { id: 't11', title: 'Incentivar completar quiz', done: false, due: '17 Mai' },
    ],
    createdAt: '15 Mai 2025',
    temperament: 'ambivert',
    intent: 'social',
  },
];

export const pipelineStages: PipelineStage[] = [
  { id: 'novo', label: 'Novo Lead', color: '#3b82f6', icon: 'Zap', leads: [] },
  { id: 'qualificado', label: 'Qualificado', color: '#8b5cf6', icon: 'Target', leads: [] },
  { id: 'proposta', label: 'Proposta', color: '#f59e0b', icon: 'FileText', leads: [] },
  { id: 'negociacao', label: 'Negociacao', color: '#ec4899', icon: 'Handshake', leads: [] },
  { id: 'fechado', label: 'Fechado', color: '#22c55e', icon: 'CheckCircle', leads: [] },
  { id: 'perdido', label: 'Perdido', color: '#ef4444', icon: 'XCircle', leads: [] },
];

export const brandConfig = {
  primaryColor: '#7a3b69',
  secondaryColor: '#1a0e14',
  accentColor: '#f7f5f0',
  fontFamily: 'Instrument Serif',
  logo: null as string | null,
  backgroundPattern: 'none' as string,
  cardStyle: 'glass' as 'glass' | 'solid' | 'minimal',
  buttonStyle: 'pill' as 'pill' | 'rounded' | 'square',
};
