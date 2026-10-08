import { Link } from 'react-router-dom'
import { FileText, ArrowLeft } from 'lucide-react'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-espresso/70 hover:text-plum transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" />
          Voltar para o início
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-plum/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-plum" />
          </div>
          <h1 className="font-serif text-2xl text-espresso">Termos de Uso</h1>
        </div>

        <div className="prose prose-sm max-w-none text-espresso/70 space-y-6">
          <p className="text-xs text-espresso/70">Última atualização: 27 de setembro de 2026</p>

          <section>
            <h2 className="text-lg font-medium text-espresso mb-2">1. Aceitação dos Termos</h2>
            <p>Ao acessar e usar a plataforma Evokaa, você concorda em cumprir estes Termos de Uso. Se não concordar com qualquer parte destes termos, não utilize nossos serviços.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-espresso mb-2">2. Descrição do Serviço</h2>
            <p>A Evokaa é uma plataforma de ticketing e gestão de eventos que permite a produtores criarem, promoverem e venderem ingressos para eventos, e aos participantes descobrirem e comprarem ingressos.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-espresso mb-2">3. Cadastro e Conta</h2>
            <p><strong>3.1. Cadastro.</strong> Para usar certos recursos, você deve criar uma conta fornecendo informações precisas e completas. Você é responsável por manter a confidencialidade de sua senha e por todas as atividades em sua conta.</p>
            <p><strong>3.2. Exclusão da conta.</strong> Você pode excluir sua conta a qualquer momento em Configurações. A exclusão é imediata e irreversível: seus dados pessoais são apagados ou tornados anônimos, e o acesso à conta é encerrado.</p>
            <p><strong>3.3. Registros que permanecem.</strong> Os registros de compras já realizadas (pedidos, ingressos emitidos, pagamentos e repasses) são mantidos pelo prazo exigido pela legislação fiscal e para o cumprimento de obrigações legais, conforme o art. 16, I, da LGPD, e não podem ser excluídos a pedido. Nesses registros, dados de contato como e-mail e telefone e, nos repasses, os dados bancários são removidos; nome e CPF permanecem por exigência fiscal.</p>
            <p><strong>3.4. Condições para produtores.</strong> Produtores com evento publicado e ainda não realizado, ou com saque em andamento, precisam encerrar ou cancelar o evento e concluir o saque antes de excluir a conta.</p>
            <p><strong>3.5. Ingressos.</strong> Ingressos já emitidos para eventos futuros continuam válidos e registrados no nome do comprador, mas deixam de ser acessíveis pela conta. Salve ou compartilhe o QR Code de cada ingresso antes da exclusão, pois não será possível recuperá-lo depois.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-espresso mb-2">4. Responsabilidades do Produtor</h2>
            <p>Produtores de eventos são responsáveis pela veracidade das informações dos eventos, cumprimento das leis aplicáveis, políticas de reembolso e pela experiência oferecida aos participantes.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-espresso mb-2">5. Compras e Pagamentos</h2>
            <p>Todas as compras são processadas por gateways de pagamento parceiros. A Evokaa atua como intermediadora da transação e não é responsável por falhas nos processadores de pagamento.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-espresso mb-2">6. Ingressos com Meia-Entrada</h2>
            <p><strong>6.1. Quem pode comprar.</strong> A aquisição de ingressos na modalidade "Meia-Entrada" é restrita aos beneficiários previstos na legislação federal, estadual e municipal vigente, entre eles estudantes, idosos a partir de 60 anos, jovens de 15 a 29 anos de baixa renda, pessoas com deficiência e seus acompanhantes, e as categorias locais cadastradas na plataforma. A meia-entrada não é cumulativa com outras promoções.</p>
            <p><strong>6.2. Declaração na compra.</strong> Ao selecionar a meia-entrada, o usuário declara, sob as penas da lei, possuir o direito ao benefício e estar ciente de que deverá comprová-lo na portaria.</p>
            <p><strong>6.3. Conferência na portaria.</strong> A conferência é feita pela equipe do organizador do evento; a Evokaa atua como intermediadora e não confere o documento. A entrada fica condicionada à apresentação de documento oficial válido, com foto, juntamente com o comprovante do benefício previsto em lei.</p>
            <p><strong>6.4. Falta de comprovação.</strong> Se o portador não comprovar o direito na portaria, poderá pagar a diferença em relação ao valor da modalidade "Inteira" vigente na data do evento ou cancelar a compra e ser reembolsado do valor pago pelo ingresso de meia. Enquanto não houver comprovação nem pagamento da diferença, o acesso ao evento não é liberado.</p>
            <p><strong>6.5. Taxa de serviço.</strong> Na meia-entrada, a taxa de serviço é proporcional ao preço do ingresso, calculada sobre o valor da meia (Decreto 13.108/2026, art. 9º).</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-espresso mb-2">7. Propriedade Intelectual</h2>
            <p>O conteúdo da plataforma, incluindo marcas, logotipos e software, é propriedade da Evokaa ou de seus licenciadores e está protegido por leis de propriedade intelectual.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-espresso mb-2">8. Limitação de Responsabilidade</h2>
            <p>A Evokaa não se responsabiliza por danos diretos, indiretos ou consequenciais resultantes do uso ou incapacidade de uso da plataforma, exceto quando exigido por lei.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-espresso mb-2">9. Modificações</h2>
            <p>Podemos atualizar estes termos periodicamente. Notificaremos os usuários sobre alterações significativas. O uso continuado da plataforma após as alterações constitui aceitação.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-espresso mb-2">10. Contato</h2>
            <p>Dúvidas sobre estes termos podem ser enviadas pelo formulário de contato em <Link to="/contato" className="text-plum-light hover:underline">/contato</Link>.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
