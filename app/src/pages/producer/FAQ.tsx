import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NAV, ROTA_CRIAR_EVENTO } from '../../lib/navegacaoProdutor'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

export interface Faq { question: string; answer: string; atualizado: string; links?: { rotulo: string; rota: string }[] }

// Rota da tela pelo nome em NAV: a mesma fonte da lateral, então o link não aponta para rota que não existe.
const tela = (nome: string) => ({ rotulo: nome, rota: NAV.find(t => t.tela === nome)!.rota })
// "atualizado": data em que a resposta foi conferida. As de 03/10/2026 são a data do último commit visível do arquivo
// (histórico raso); as de 04/10/2026 foram reescritas na L1. Atualize a data ao mudar o texto.
const D3 = '03/10/2026'
const D4 = '04/10/2026'

// Respostas só sobre o que já funciona; o que depende do gateway de pagamento diz isso (Decisões 106 e 113).
export const producerFAQs: Faq[] = [
  { question: 'Como criar um novo evento?', answer: 'Use o botão "+" (Criar evento) no topo da lateral e siga os passos: tipo, informações (nome, data, local e capacidade), lotes de ingresso, custos e resumo. Não existe rascunho: ao criar, o evento já entra em análise pela equipe da Evokaa e só aparece no site, e só vende, depois de aprovado. Depois de aprovado (ou recusado), mudar título, descrição, imagem, tipo, data, horário ou local o leva de volta para a análise; mudar só os ingressos não.', atualizado: D4, links: [{ rotulo: 'Criar evento', rota: ROTA_CRIAR_EVENTO }, tela('Meus eventos')] },
  { question: 'Como funciona o sistema de afiliados?', answer: 'Em "Afiliados", você vincula a um evento uma pessoa que já tem conta na Evokaa, é maior de 18 anos e tem a data de nascimento no perfil, e define a comissão. Na fase beta, a conferência das vendas e o pagamento da comissão são combinados entre você e o afiliado; o link de venda e o rastreamento automático chegam com o módulo de Promoters e a integração de pagamentos.', atualizado: D3, links: [tela('Afiliados')] },
  { question: 'Como funciona o Orçamento do evento?', answer: 'Em Financeiro › "Orçamento", você cria um item para cada gasto previsto (som, decoração, divulgação), com o valor previsto, e registra quanto já separou. É um controle seu: nenhum dinheiro é movimentado pela Evokaa.', atualizado: D3, links: [tela('Orçamento do evento')] },
  { question: 'Como faço o check-in na porta do evento?', answer: 'Use a tela "Check-in", no menu Público. No modo Scanner, digite o código do ingresso (um leitor de código que funcione como teclado também serve); no modo Lista, procure o participante e confirme a entrada.', atualizado: D3, links: [tela('Check-in')] },
  { question: 'O que é Mesa Coletiva?', answer: 'É um tipo de ingresso em que pessoas que não se conhecem dividem uma mesa. Elas respondem um questionário de perfil; a formação automática das mesas por afinidade chega em breve.', atualizado: D3 },
  { question: 'Como criar cupons de desconto?', answer: 'Em "Cupons", no menu Vendas, cadastre cupons percentuais (ex.: 20%) ou de valor fixo (ex.: R$ 50), com compra mínima, limite de usos e validade, para um evento ou para todos. Atenção: o checkout ainda não aplica cupom, então o desconto não vale na compra por enquanto; ele passa a valer quando a integração de pagamentos estiver ligada.', atualizado: D4, links: [tela('Cupons')] },
  { question: 'Como enviar comunicações em massa?', answer: 'Ainda não é possível. O envio de e-mail, SMS e push para os participantes chega com a ferramenta de e-mail do produtor; até lá, a tela "Comunicação" fica fora do menu.', atualizado: D3 },
  { question: 'Posso exportar relatórios financeiros?', answer: 'Sim, os pedidos pagos: em "Financeiro", o botão "Exportar CSV" baixa a lista com data, evento, forma de pagamento e valor bruto. Repasse, taxas e saque aparecem quando o pagamento estiver ligado.', atualizado: D3, links: [tela('Financeiro')] },
  { question: 'Como funciona o cronograma do evento?', answer: 'Em Operação › "Cronograma", escolha o evento e monte a linha do tempo, do soundcheck ao encerramento. Cada item tem horário, título, responsável e local; toque no círculo do item para marcá-lo como concluído.', atualizado: D3, links: [tela('Cronograma')] },
  { question: 'Quando posso sacar o dinheiro das vendas?', answer: 'O saque e o repasse dependem da integração de pagamentos, que ainda não está ligada. Por isso a Carteira mostra o saldo como indisponível e o botão "Sacar" fica desligado.', atualizado: D3, links: [tela('Carteira')] },
]

export const affiliateFAQs: Faq[] = [
  // Programa em fase beta (Decisão 36): a venda pelo link ainda não é atribuída automaticamente.
  { question: 'Como começo a vender?', answer: 'Quem vincula você a um evento é o produtor, pelo seu e-mail de cadastro na Evokaa. O programa está em fase beta: a venda ainda não é ligada automaticamente a você, então combine com o produtor como ele vai conferir as suas vendas.', atualizado: D3 },
  { question: 'Quanto eu ganho por venda?', answer: 'A comissão é definida pelo produtor, em percentual. Exemplo: ingresso de R$ 150,00 com comissão de 10% rende R$ 15,00. O cálculo automático entra quando a integração de pagamentos estiver pronta.', atualizado: D3 },
  { question: 'Como recebo minha comissão?', answer: 'Na fase beta, o pagamento é combinado direto com o produtor. O acompanhamento automático do valor pendente e pago chega com a integração de pagamentos.', atualizado: D3 },
  { question: 'Onde vejo meu desempenho?', answer: 'Na fase beta, quem acompanha as vendas e a comissão de cada afiliado é o produtor, na tela Afiliados. Um painel próprio do afiliado chega com a integração de pagamentos.', atualizado: D3 },
]

const semAcento = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** Filtro da busca: todas as palavras digitadas precisam aparecer na pergunta ou na resposta (sem acento, sem caixa). */
export function filtrarFaq(itens: Faq[], busca: string): Faq[] {
  const palavras = semAcento(busca).split(/\s+/).filter(Boolean)
  if (!palavras.length) return itens
  return itens.filter(i => {
    const texto = semAcento(`${i.question} ${i.answer}`)
    return palavras.every(p => texto.includes(p))
  })
}

export default function ProducerFAQ() {
  const [tab, setTab] = useState<'producer' | 'affiliate'>('producer')
  const [busca, setBusca] = useState('')
  const items = filtrarFaq(tab === 'producer' ? producerFAQs : affiliateFAQs, busca)

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Ajuda" description="Perguntas frequentes sobre o painel" />

      <Input
        type="search"
        value={busca}
        onChange={e => setBusca(e.target.value)}
        placeholder="Buscar nas perguntas e respostas"
        aria-label="Buscar nas perguntas e respostas"
        className="mb-4"
      />

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

      {items.length === 0 ? (
        <p role="status" className="rounded-[10px] border border-border bg-card p-4 text-sm text-muted-foreground">
          Nenhuma pergunta encontrada para "{busca.trim()}".
        </p>
      ) : (
        <Accordion type="single" collapsible className="rounded-[10px] border border-border bg-card px-4">
          {items.map(item => (
            <AccordionItem key={item.question} value={item.question}>
              <AccordionTrigger className="text-foreground">{item.question}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {item.answer}
                {item.links && (
                  <span className="mt-2 block text-xs">
                    Ir para:{' '}
                    {item.links.map((l, n) => (
                      <span key={l.rota}>
                        {n > 0 && ' · '}
                        <Link to={l.rota} className="font-medium text-foreground underline underline-offset-2">{l.rotulo}</Link>
                      </span>
                    ))}
                  </span>
                )}
                <span className="mt-1 block text-xs">Atualizado em {item.atualizado}</span>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  )
}
