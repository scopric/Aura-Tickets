import { Link } from 'react-router-dom'
import { Shield, ArrowLeft } from 'lucide-react'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-espresso/50 hover:text-plum transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" />
          Voltar para o início
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-plum/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-plum" />
          </div>
          <h1 className="font-serif text-2xl text-espresso">Política de Privacidade</h1>
        </div>

        <div className="prose prose-sm max-w-none text-espresso/70 space-y-6">
          <p className="text-xs text-espresso/40">Última atualização: 24 de maio de 2026 — Compatível com LGPD (Lei 13.709/2018)</p>

          <section>
            <h2 className="text-lg font-medium text-espresso mb-2">1. Introdução</h2>
            <p>A Evokaa respeita sua privacidade e está comprometida em proteger seus dados pessoais. Esta política explica como coletamos, usamos, armazenamos e protegemos suas informações.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-espresso mb-2">2. Dados Coletados</h2>
            <p>Coletamos informações necessárias para o funcionamento da plataforma:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Dados de cadastro: nome, e-mail, telefone</li>
              <li>Dados de perfil: avatar, preferências</li>
              <li>Dados de eventos: informações criadas por produtores</li>
              <li>Dados de transações: histórico de compras (processado por parceiros)</li>
              <li>Dados de navegação: cookies e logs para melhorar a experiência</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium text-espresso mb-2">3. Finalidade do Uso</h2>
            <p>Seus dados são utilizados para:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Criar e gerenciar sua conta</li>
              <li>Processar compras e emissão de ingressos</li>
              <li>Enviar comunicações sobre eventos e atualizações (com seu consentimento)</li>
              <li>Melhorar a plataforma e prevenir fraudes</li>
              <li>Cumprir obrigações legais</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium text-espresso mb-2">4. Compartilhamento</h2>
            <p>Não vendemos seus dados. Compartilhamos apenas quando necessário:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Com produtores de eventos que você adquire ingressos</li>
              <li>Com processadores de pagamento para transações</li>
              <li>Quando exigido por lei ou ordem judicial</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium text-espresso mb-2">5. Seus Direitos (LGPD)</h2>
            <p>Você tem os seguintes direitos sobre seus dados:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Acessar seus dados</li>
              <li>Corrigir dados incompletos ou desatualizados</li>
              <li>Solicitar anonimização, bloqueio ou eliminação</li>
              <li>Revogar consentimento a qualquer momento</li>
              <li>Solicitar portabilidade dos dados</li>
            </ul>
            <p className="mt-2">Para exercer seus direitos, entre em contato pelo formulário em <Link to="/contato" className="text-plum hover:underline">/contato</Link>.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-espresso mb-2">6. Segurança</h2>
            <p>Utilizamos criptografia, firewalls e práticas de segurança da indústria para proteger seus dados. No entanto, nenhum sistema é 100% seguro.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-espresso mb-2">7. Cookies e Tecnologias Semelhantes</h2>
            <p>Usamos cookies essenciais para autenticação e funcionalidade. Cookies analíticos e de marketing só são ativados com seu consentimento, gerenciado pelo banner de cookies.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-espresso mb-2">8. Alterações nesta Política</h2>
            <p>Podemos atualizar esta política periodicamente. Notificaremos alterações significativas por e-mail ou aviso na plataforma.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-espresso mb-2">9. Contato</h2>
            <p>Encarregado de Dados (DPO): dpo@evokaa.com.br</p>
            <p>Formulário de contato: <Link to="/contato" className="text-plum hover:underline">/contato</Link></p>
          </section>
        </div>
      </div>
    </div>
  )
}
