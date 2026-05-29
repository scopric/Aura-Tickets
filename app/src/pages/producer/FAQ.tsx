import { useState } from 'react'
import { Users, Building } from 'lucide-react'
import FAQSection from '../../components/FAQSection'

const producerFAQs = import.meta.env.DEV ? [
  { question: 'Como criar um novo evento?', answer: 'Acesse o menu "Nova Festa" no painel lateral. Preencha as informacoes basicas como nome, data, local e capacidade. Em seguida, configure os tipos de ingresso, precos e a aparencia visual do evento. Depois e so publicar!' },
  { question: 'Como funciona o sistema de afiliados?', answer: 'No menu "Afiliados", voce pode cadastrar vendedores que divulgarao seu evento. Cada afiliado recebe um codigo unico e pode ter um cupom exclusivo. Voce define a comissao (ex: 10%), o limite de ingressos e acompanha as vendas em tempo real. O pagamento e feito via PIX.' },
  { question: 'Posso limitar a quantidade de ingressos por afiliado?', answer: 'Sim! Ao cadastrar ou editar um afiliado, voce define o "Limite de Ingressos". Quando o afiliado atinge o limite, ele nao consegue mais vender. Voce pode aumentar o limite a qualquer momento.' },
  { question: 'Como funciona a Caixinha?', answer: 'A Caixinha e um cofrinho virtual separado por categoria (Marketing, Decoracao, Emergencia, Lucro). Voce define uma meta para cada uma e vai depositando valores conforme recebe. Ajuda a organizar o orcamento do evento.' },
  { question: 'Como faco o check-in na porta do evento?', answer: 'Use a tela "Check-in" no menu. Existem dois modos: Scanner (digite o codigo do ingresso) e Lista (visualize todos os participantes). Ambos atualizam em tempo real.' },
  { question: 'O que e Mesa Coletiva?', answer: 'Mesa Coletiva e um tipo de ingresso onde 6 pessoas desconhecidas sao agrupadas por afinidade de perfil. Elas respondem um questionario e nosso algoritmo forma as mesas. Inclui welcome drink e finger food.' },
  { question: 'Como criar cupons de desconto?', answer: 'Va em "Cupons" no menu. Voce pode criar cupons percentuais (ex: 20% OFF) ou valor fixo (ex: R$50 OFF). Defina compra minima, limite de usos e validade.' },
  { question: 'Como enviar comunicacoes em massa?', answer: 'No menu "Comunicacao", voce cria campanhas de Email, SMS ou Push. Use os templates prontos ou crie do zero. Agende o envio e acompanhe as metricas (abertura, cliques).' },
  { question: 'Posso exportar relatorios financeiros?', answer: 'Sim! Na tela "Financeiro", clique em "Exportar" para baixar um CSV com todas as transacoes, formas de pagamento e status.' },
  { question: 'Como funciona o cronograma do evento?', answer: 'A "Timeline" mostra a linha do tempo completa do evento, do soundcheck ao encerramento. Cada item tem horario, responsavel e local. Clique no circulo para marcar como concluido.' },
]

const affiliateFAQs = import.meta.env.DEV ? [
  { question: 'Como comeco a vender?', answer: 'Assim que o produtor te cadastrar, voce recebe um codigo unico (ex: CARLOS20). Compartilhe o link https://evokaa.events/?ref=SEUCODIGO com seus contatos. Toda venda feita pelo seu link entra na sua comissao.' },
  { question: 'Quanto eu ganho por venda?', answer: 'A comissao e definida pelo produtor (geralmente 10% do valor do ingresso). Se voce vender um ingresso de R$ 150,00 e sua comissao for 10%, voce ganha R$ 15,00.' },
  { question: 'Como recebo minha comissao?', answer: 'O pagamento e feito via PIX para a chave cadastrada. Voce pode acompanhar o valor pendente e o ja pago no seu perfil de afiliado.' },
  { question: 'O que e o meu cupom exclusivo?', answer: 'O produtor pode criar um cupom de desconto exclusivo para voce (ex: CARLOSVIP 15% OFF). Isso ajuda a vender mais porque o comprador tambem ganha desconto!' },
  { question: 'Existe limite de vendas?', answer: 'Sim, o produtor define um limite de ingressos por afiliado. Voce pode ver seu limite e quantos ja vendeu no painel. Quando atingir o limite, avise o produtor para liberar mais.' },
  { question: 'Como subo de nivel?', answer: 'Voce sobe de nivel (Bronze → Prata → Ouro → Platina) vendendo mais ingressos. Cada nivel tem metas: Bronze (0), Prata (25), Ouro (75), Platina (150). Afiliados de nivel mais alto podem ter beneficios exclusivos.' },
  { question: 'Onde vejo meu desempenho?', answer: 'No painel de afiliado voce ve: ingressos vendidos, valor total em vendas, comissao acumulada, taxa de conversao e grafico de vendas por dia.' },
]

export default function ProducerFAQ() {
  const [tab, setTab] = useState<'producer' | 'affiliate'>('producer')

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="font-serif text-3xl text-espresso">Perguntas Frequentes</h1>
        <p className="text-sm text-espresso/50 mt-2">Tire suas duvidas sobre a plataforma</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-center gap-2 mb-10">
        <button onClick={() => setTab('producer')} className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all ${tab === 'producer' ? 'bg-plum text-cream' : 'bg-white/40 border border-white/60 text-espresso/50'}`}>
          <Building className="w-4 h-4" /> Para Produtores
        </button>
        <button onClick={() => setTab('affiliate')} className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all ${tab === 'affiliate' ? 'bg-plum text-cream' : 'bg-white/40 border border-white/60 text-espresso/50'}`}>
          <Users className="w-4 h-4" /> Para Afiliados
        </button>
      </div>

      {tab === 'producer' && (
        <FAQSection
          title="Central do Produtor"
          subtitle="Tudo que voce precisa saber para gerenciar seus eventos"
          items={producerFAQs}
        />
      )}

      {tab === 'affiliate' && (
        <FAQSection
          title="Central do Afiliado"
          subtitle="Aprenda a vender mais e maximizar seus ganhos"
          items={affiliateFAQs}
        />
      )}
    </div>
  )
}
