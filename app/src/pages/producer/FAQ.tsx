import { useState } from 'react'
import { PageHeader } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

// Respostas só sobre o que já funciona; o que depende do gateway de pagamento diz isso (Decisões 106 e 113).
const producerFAQs = [
  { question: 'Como criar um novo evento?', answer: 'Em "Criar evento", no menu Eventos, preencha nome, data, local e capacidade, configure os tipos de ingresso e os preços e envie. O evento passa pela análise da Evokaa antes de aparecer no site.' },
  { question: 'Como funciona o sistema de afiliados?', answer: 'Em "Afiliados", você vincula a um evento uma pessoa que já tem conta na Evokaa, é maior de 18 anos e tem a data de nascimento no perfil, e define a comissão. Na fase beta, a conferência das vendas e o pagamento da comissão são combinados entre você e o afiliado; o link de venda e o rastreamento automático chegam com o módulo de Promoters e a integração de pagamentos.' },
  { question: 'Como funciona o Orçamento do evento?', answer: 'Em "Orçamento do evento", no menu Dinheiro, você cria um item para cada gasto previsto (som, decoração, divulgação), com o valor previsto, e registra quanto já separou. É um controle seu: nenhum dinheiro é movimentado pela Evokaa.' },
  { question: 'Como faço o check-in na porta do evento?', answer: 'Use a tela "Check-in", no menu Público. No modo Scanner, digite o código do ingresso (um leitor de código que funcione como teclado também serve); no modo Lista, procure o participante e confirme a entrada.' },
  { question: 'O que é Mesa Coletiva?', answer: 'É um tipo de ingresso em que pessoas que não se conhecem dividem uma mesa. Elas respondem um questionário de perfil; a formação automática das mesas por afinidade chega em breve.' },
  { question: 'Como criar cupons de desconto?', answer: 'Em "Cupons", no menu Vendas, crie cupons percentuais (ex.: 20%) ou de valor fixo (ex.: R$ 50), com compra mínima, limite de usos e validade, para um evento ou para todos.' },
  { question: 'Como enviar comunicações em massa?', answer: 'Ainda não é possível. O envio de e-mail, SMS e push para os participantes chega com a ferramenta de e-mail do produtor; até lá, a tela "Comunicação" fica fora do menu.' },
  { question: 'Posso exportar relatórios financeiros?', answer: 'Sim, os pedidos pagos: em "Financeiro", o botão "Exportar CSV" baixa a lista com data, evento, forma de pagamento e valor bruto. Repasse, taxas e saque aparecem quando o pagamento estiver ligado.' },
  { question: 'Como funciona o cronograma do evento?', answer: 'Em "Cronograma", no menu Eventos, escolha o evento e monte a linha do tempo, do soundcheck ao encerramento. Cada item tem horário, título, responsável e local; toque no círculo do item para marcá-lo como concluído.' },
  { question: 'Quando posso sacar o dinheiro das vendas?', answer: 'O saque e o repasse dependem da integração de pagamentos, que ainda não está ligada. Por isso a Carteira mostra o saldo como indisponível e o botão "Sacar" fica desligado.' },
]

const affiliateFAQs = [
  // Programa em fase beta (Decisão 36): a venda pelo link ainda não é atribuída automaticamente.
  { question: 'Como começo a vender?', answer: 'Quem vincula você a um evento é o produtor, pelo seu e-mail de cadastro na Evokaa. O programa está em fase beta: a venda ainda não é ligada automaticamente a você, então combine com o produtor como ele vai conferir as suas vendas.' },
  { question: 'Quanto eu ganho por venda?', answer: 'A comissão é definida pelo produtor, em percentual. Exemplo: ingresso de R$ 150,00 com comissão de 10% rende R$ 15,00. O cálculo automático entra quando a integração de pagamentos estiver pronta.' },
  { question: 'Como recebo minha comissão?', answer: 'Na fase beta, o pagamento é combinado direto com o produtor. O acompanhamento automático do valor pendente e pago chega com a integração de pagamentos.' },
  { question: 'Onde vejo meu desempenho?', answer: 'Na fase beta, quem acompanha as vendas e a comissão de cada afiliado é o produtor, na tela Afiliados. Um painel próprio do afiliado chega com a integração de pagamentos.' },
]

export default function ProducerFAQ() {
  const [tab, setTab] = useState<'producer' | 'affiliate'>('producer')
  const items = tab === 'producer' ? producerFAQs : affiliateFAQs

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Ajuda" description="Perguntas frequentes sobre o painel" />

      <div role="group" aria-label="Para quem são as perguntas" className="mb-4 flex flex-wrap gap-1">
        {([['producer', 'Para produtores'], ['affiliate', 'Para afiliados']] as const).map(([id, rotulo]) => (
          <Button
            key={id}
            size="sm"
            variant={tab === id ? 'secondary' : 'ghost'}
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
            className={tab === id ? '' : 'text-muted-foreground hover:text-foreground'}
          >
            {rotulo}
          </Button>
        ))}
      </div>

      <Accordion type="single" collapsible className="rounded-[10px] border border-border bg-card px-4">
        {items.map((item, i) => (
          <AccordionItem key={item.question} value={`${tab}-${i}`}>
            <AccordionTrigger className="text-foreground">{item.question}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{item.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
