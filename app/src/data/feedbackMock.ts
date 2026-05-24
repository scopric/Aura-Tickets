type FeedbackType = 'melhoria' | 'bug' | 'duvida' | 'sugestao' | 'elogio'
type FeedbackRole = 'cliente' | 'produtor' | 'admin'
type FeedbackStatus = 'novo' | 'lido' | 'respondido' | 'resolvido'

export interface FeedbackItem {
  id: string
  type: FeedbackType
  role: FeedbackRole
  name: string
  email: string
  message: string
  rating: number
  page: string
  status: FeedbackStatus
  createdAt: string
}

export const feedbackMock: FeedbackItem[] = [
  { id: 'f1', type: 'melhoria', role: 'produtor', name: 'Joao Silva', email: 'joao@email.com', message: 'Gostaria de poder duplicar eventos para nao ter que criar tudo do zero.', rating: 0, page: '/producer/events', status: 'novo', createdAt: '17 Mai 2025' },
  { id: 'f2', type: 'bug', role: 'cliente', name: 'Ana Costa', email: 'ana@email.com', message: 'O botao de comprar ingresso nao funciona no celular.', rating: 0, page: '/event/noite-eletro-2025', status: 'lido', createdAt: '16 Mai 2025' },
  { id: 'f3', type: 'sugestao', role: 'produtor', name: 'Carlos Lima', email: 'carlos@email.com', message: 'Seria otimo ter um modo escuro no painel do produtor.', rating: 4, page: '/producer/dashboard', status: 'respondido', createdAt: '15 Mai 2025' },
  { id: 'f4', type: 'elogio', role: 'cliente', name: 'Maria Souza', email: 'maria@email.com', message: 'Achei a plataforma muito intuitiva. Parabens!', rating: 5, page: '/app/hub', status: 'resolvido', createdAt: '14 Mai 2025' },
  { id: 'f5', type: 'duvida', role: 'admin', name: 'Pedro Rocha', email: 'pedro@email.com', message: 'Como configuro o pagamento por PIX?', rating: 0, page: '/producer/finance', status: 'novo', createdAt: '13 Mai 2025' },
  { id: 'f6', type: 'bug', role: 'produtor', name: 'Fernanda Alves', email: 'fernanda@email.com', message: 'O relatorio de vendas nao atualiza em tempo real.', rating: 2, page: '/producer/events', status: 'lido', createdAt: '12 Mai 2025' },
  { id: 'f7', type: 'melhoria', role: 'cliente', name: 'Lucas Mendes', email: 'lucas@email.com', message: 'Gostaria de receber notificacao quando o evento comecar.', rating: 0, page: '/app/tickets', status: 'respondido', createdAt: '11 Mai 2025' },
  { id: 'f8', type: 'elogio', role: 'produtor', name: 'Julia Torres', email: 'julia@email.com', message: 'O check-in por QR code funcionou perfeitamente!', rating: 5, page: '/producer/checkin', status: 'resolvido', createdAt: '10 Mai 2025' },
]
