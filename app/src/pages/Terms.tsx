import { Link } from 'react-router-dom'
import { FileText, ArrowLeft } from 'lucide-react'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-espresso/50 hover:text-plum transition-colors mb-8">
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
          <p className="text-xs text-espresso/40">Última atualização: 24 de maio de 2026</p>

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
            <p>Para usar certos recursos, você deve criar uma conta fornecendo informações precisas e completas. Você é responsável por manter a confidencialidade de sua senha e por todas as atividades em sua conta.</p>
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
            <h2 className="text-lg font-medium text-espresso mb-2">6. Propriedade Intelectual</h2>
            <p>O conteúdo da plataforma, incluindo marcas, logotipos e software, é propriedade da Evokaa ou de seus licenciadores e está protegido por leis de propriedade intelectual.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-espresso mb-2">7. Limitação de Responsabilidade</h2>
            <p>A Evokaa não se responsabiliza por danos diretos, indiretos ou consequenciais resultantes do uso ou incapacidade de uso da plataforma, exceto quando exigido por lei.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-espresso mb-2">8. Modificações</h2>
            <p>Podemos atualizar estes termos periodicamente. Notificaremos os usuários sobre alterações significativas. O uso continuado da plataforma após as alterações constitui aceitação.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-espresso mb-2">9. Contato</h2>
            <p>Dúvidas sobre estes termos podem ser enviadas pelo formulário de contato em <Link to="/contato" className="text-plum hover:underline">/contato</Link>.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
