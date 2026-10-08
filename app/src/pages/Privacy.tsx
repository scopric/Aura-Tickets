import { Link } from 'react-router-dom'
import { Shield, ArrowLeft } from 'lucide-react'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-espresso/70 hover:text-plum transition-colors mb-8">
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
          <p className="text-xs text-espresso/70">Última atualização: 5 de outubro de 2026 — Compatível com LGPD (Lei 13.709/2018)</p>

          <section>
            <h2 className="text-lg font-medium text-espresso mb-2">1. Introdução</h2>
            <p>A Evokaa (Evoka Soluções Ltda, CNPJ 68.076.437/0001-42, Curitiba/PR), controladora dos seus dados pessoais, respeita sua privacidade e está comprometida em protegê-los. Esta política explica como coletamos, usamos, armazenamos e protegemos suas informações.</p>
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
              <li>Eventos salvos: os eventos que você marca com o coração, ligados à sua conta, com a data em que marcou. A lista não é mostrada ao produtor do evento nem a outras pessoas</li>
              <li>Meia-entrada: a categoria do benefício que você declara na compra (seção 9)</li>
              <li>Aviso de abertura das vendas ("Avise-me"): quando você pede, o evento, o seu cadastro (nome, e-mail e cidade), a data e a versão do texto do seu consentimento. O produtor do evento recebe o seu nome, e-mail e cidade e pode incluir você no CRM dele</li>
              <li>Uso do Evo, o assistente de inteligência artificial (só para produtores): as mensagens e os dados de planejamento que você envia, a imagem da planta do local que você envia ao leitor de planta do Lugar marcado e o registro de cada uso, conforme a seção 8</li>
              <li>Registros de acesso: data, hora e endereço IP de cada login, guardados por 6 meses por obrigação legal (Marco Civil da Internet, art. 15) e depois apagados automaticamente; e o registro do seu aceite dos Termos de Uso e desta Política (versão, data e IP), mantido enquanto a conta existir e, depois, pelo prazo de defesa de direitos</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium text-espresso mb-2">3. Finalidade do Uso</h2>
            <p>Seus dados são utilizados para:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Criar e gerenciar sua conta</li>
              <li>Processar compras e emissão de ingressos</li>
              <li>Lembrar os eventos que você salvou, a seu pedido (base legal: execução do serviço a seu pedido, LGPD, art. 7º, V). A lista fica até você remover o evento dela ou excluir a conta. Se um evento salvo sair do ar, ele continua na tela Salvos como "fora do ar" e você pode removê-lo; a exclusão da conta apaga toda a lista</li>
              <li>Avisar você, no aplicativo e por e-mail, quando as vendas de um evento abrirem, a seu pedido (base legal: consentimento, LGPD, art. 7º, I). Você retira o aviso a qualquer momento em "Remover aviso" na página do evento; a conta excluída apaga a inscrição. Os dados já compartilhados com o produtor ficam com ele, que passa a ser o controlador: o pedido de exclusão é feito ao produtor</li>
              <li>Enviar comunicações sobre eventos e atualizações (com seu consentimento)</li>
              <li>Oferecer o Evo, o assistente de inteligência artificial que ajuda o produtor a planejar e criar eventos (seção 8)</li>
              <li>Melhorar a plataforma e prevenir fraudes</li>
              <li>Cumprir obrigações legais</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium text-espresso mb-2">4. Compartilhamento</h2>
            <p>Não vendemos seus dados. Compartilhamos apenas quando necessário:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Com produtores de eventos que você adquire ingressos</li>
              <li>Com o produtor do evento em que você pediu o aviso de abertura das vendas (nome, e-mail e cidade), conforme o seu consentimento</li>
              <li>Com processadores de pagamento para transações</li>
              <li>Com fornecedores de medição de audiência (Vercel e Google), que tratam os dados em nosso nome, conforme a seção 7</li>
              <li>Com o Google, que processa as conversas com o Evo e as plantas enviadas ao leitor de planta em nosso nome, conforme a seção 8</li>
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
            <p className="mt-2">Para exercer seus direitos, entre em contato pelo formulário em <Link to="/contato" className="text-plum-light hover:underline">/contato</Link>.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-espresso mb-2">6. Segurança</h2>
            <p>Utilizamos criptografia, firewalls e práticas de segurança da indústria para proteger seus dados. No entanto, nenhum sistema é 100% seguro.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-espresso mb-2">7. Cookies e Tecnologias Semelhantes</h2>
            <p>Usamos cookies essenciais para autenticação e funcionamento da plataforma. Eles não dependem de consentimento.</p>
            <p>Para entender como o site é usado, contamos com duas ferramentas de medição de audiência:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Vercel Web Analytics</strong> (Vercel Inc., Estados Unidos): registra páginas visitadas, origem do acesso, tipo de aparelho, navegador e cidade aproximada. Não usa cookies nem identificadores persistentes: o visitante é representado por um código temporário, descartado em 24 horas, e só vemos dados agregados. Base legal: legítimo interesse (LGPD, art. 7º, IX).</li>
              <li><strong>Google Analytics</strong> (Google LLC, Estados Unidos): mede páginas visitadas e origem do tráfego usando os cookies <code>_ga</code> e <code>_ga_*</code>, com validade de até 2 anos. Só é ativado com o seu consentimento, dado no aviso de cookies. Base legal: consentimento (LGPD, art. 7º, I).</li>
            </ul>
            <p>Esses fornecedores estão fora do Brasil; a transferência segue o art. 33 da LGPD, com garantias contratuais de proteção de dados. Não enviamos a eles nome, e-mail, CPF ou qualquer dado que identifique você diretamente.</p>
            <p>Além dessas ferramentas, a própria plataforma guarda um registro simples de uso, também só com o seu consentimento para cookies analíticos: início de sessão, páginas visitadas e login, com data e hora, um código temporário da aba do navegador, o tipo de aparelho, o tamanho da janela do navegador e a identificação técnica do navegador. Se você estiver logado, o registro fica ligado à sua conta e é apagado junto com ela. Esses dados ficam na base de dados da plataforma (Supabase, servidores na Suíça; transferência internacional nos termos do art. 33 da LGPD), servem apenas para estatísticas de uso e correção de problemas, e os registros já feitos permanecem se você retirar o consentimento.</p>
            <p>Você pode mudar sua escolha a qualquer momento pelo link <strong>Cookies</strong> no rodapé das páginas públicas do site. Ao retirar o consentimento, o Google Analytics é desligado e seus cookies são apagados deste site. Para bloquear o Google Analytics em todos os sites, existe a extensão oficial de desativação do Google.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-espresso mb-2">8. Assistente de Inteligência Artificial (Evo)</h2>
            <p>O Evo é o assistente de inteligência artificial da Evokaa. Ele ajuda o produtor a planejar e criar eventos: calcula referências de normas de segurança, estima consumo e lotes e monta uma proposta de rascunho. O Evo só sugere: nada é criado, publicado ou pago sem o seu clique, e ele não toma decisões sobre você nem sobre a sua conta. Participantes não usam a inteligência artificial; para eles, a central do Evo abre apenas o atendimento da nossa equipe.</p>
            <p><strong>O que é enviado para a inteligência artificial:</strong> o texto que você escreve no chat, as últimas mensagens da mesma conversa (para dar contexto), os dados do formulário de planejamento (tipo de evento, público, cidade e estado, data, duração, preço-alvo e orçamento) e, quando você pede, a lista dos seus eventos com números agregados (título, data, situação, capacidade, cidade e quantidade de ingressos). Não enviamos dados dos compradores dos seus eventos. Não escreva no chat dados pessoais de terceiros, como CPF, e-mail ou telefone.</p>
            <p><strong>Leitor de planta (Lugar marcado, só para produtores):</strong> quando você pede para ler a planta com IA, enviamos ao Google, pelo mesmo serviço, só a imagem da planta de fundo do editor; se você subiu um PDF, ela é apenas a página 1, convertida em imagem no seu navegador. Junto vai só uma instrução fixa da Evokaa: não enviamos o nome do evento nem dados da sua conta. A própria imagem pode trazer dados escritos nela, como nomes ou endereço: não envie planta com dados pessoais de terceiros.</p>
            <p><strong>Quem processa:</strong> o Google LLC (Estados Unidos), por meio da API paga do Gemini, como operador, tratando os dados em nosso nome e segundo as nossas instruções. Nesse serviço, o Google não usa as mensagens, as plantas nem as respostas para treinar ou melhorar os produtos dele e guarda esse conteúdo por 55 dias, só para detectar e impedir uso abusivo. O processamento pode ocorrer em qualquer país em que o Google mantenha instalações, inclusive nos Estados Unidos. Essa transferência internacional se apoia em cláusulas-padrão contratuais aprovadas pela Autoridade Nacional de Proteção de Dados, previstas no contrato de tratamento de dados do Google (LGPD, art. 33, II, “b”).</p>
            <p><strong>O que a Evokaa guarda:</strong> a conversa não fica gravada nos nossos servidores; ela existe só no seu navegador enquanto a central estiver aberta, e você pode baixá-la. Guardamos um registro de cada uso: data e hora, tipo de pedido, modelo usado, quantidade processada, custo, créditos descontados, ferramentas acionadas e um resumo de até 200 caracteres da sua mensagem, com e-mails, telefones, CPF e outros números longos mascarados; na leitura de planta, o resumo traz só a quantidade de peças encontradas ou o aviso de erro, e o leitor não guarda a imagem. A planta de fundo só fica gravada se você salvar o mapa do evento e, enquanto esse mapa estiver ativo, pode ser acessada por qualquer pessoa, como o resto do mapa. Esse registro serve para controlar créditos e custos, auditar o funcionamento do assistente e prevenir abusos, e fica guardado até você pedir a eliminação pelo contato da seção 11.</p>
            <p><strong>Base legal:</strong> execução do contrato de uso da plataforma, a seu pedido, quando você usa o Evo (LGPD, art. 7º, V).</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-espresso mb-2">9. Meia-Entrada e Dados Sensíveis</h2>
            <p>Para a meia-entrada, você declara na compra a categoria do benefício. A conferência do documento é feita na portaria pela equipe do organizador do evento. A Evokaa não pede o documento na compra e não guarda cópias de laudos, atestados ou outros documentos de saúde para a meia-entrada. Não envie esses documentos pelo atendimento da plataforma.</p>
            <p>Benefícios como o de pessoa com deficiência ou com transtorno do espectro autista podem revelar informação de saúde, que é dado pessoal sensível (LGPD, art. 5º, II). Esse tratamento se apoia no cumprimento de obrigação legal e no exercício regular de direitos (LGPD, art. 11, II, “a” e “d”) e usa só o necessário para a verificação do direito ao benefício (LGPD, art. 6º, III).</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-espresso mb-2">10. Alterações nesta Política</h2>
            <p>Podemos atualizar esta política periodicamente. Notificaremos alterações significativas por e-mail ou aviso na plataforma.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-espresso mb-2">11. Contato</h2>
            <p>Controladora: Evoka Soluções Ltda, CNPJ 68.076.437/0001-42.</p>
            <p>Encarregado de Dados (DPO): dpo@evokaa.com.br</p>
            <p>Formulário de contato: <Link to="/contato" className="text-plum-light hover:underline">/contato</Link></p>
          </section>
        </div>
      </div>
    </div>
  )
}
