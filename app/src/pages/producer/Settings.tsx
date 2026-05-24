import { useState } from 'react'
import {
  User, CreditCard, Shield, Bell, FileText, ChevronRight,
  Save, Crown, Calendar, Clock, TrendingUp,
  CheckCircle2, Download
} from 'lucide-react'
import { toast } from 'sonner'

const termsLines = [
  'TERMOS E CONDICOES DE USO - PLATAFORMA AURA',
  '',
  '1. ACEITACAO DOS TERMOS',
  'Ao acessar e utilizar a plataforma Evokaa, voce concorda integralmente com estes Termos e Condicoes de Uso. Se nao concordar com qualquer parte destes termos, nao utilize a plataforma.',
  '',
  '2. DESCRICAO DO SERVICO',
  'A Evokaa e uma plataforma de gestao e comercializacao de eventos que conecta produtores, participantes e afiliados. Os servicos incluem: criacao e gestao de eventos, venda de ingressos, sistema de check-in, ferramentas de marketing, gestao financeira e relacionamento com clientes.',
  '',
  '3. PLANOS E ASSINATURAS',
  '3.1. A Evokaa oferece planos de assinatura (Starter, Plus, Pro e Enterprise) com diferentes funcionalidades e limites.',
  '3.2. O pagamento e processado mensalmente ou anualmente, conforme escolha do usuario.',
  '3.3. O cancelamento pode ser realizado a qualquer momento atraves das configuracoes da conta.',
  '3.4. O nao pagamento da assinatura resultara na suspensao temporaria das funcionalidades pagas.',
  '',
  '4. TAXAS E COMISSOES',
  '4.1. A Evokaa retem uma comissao de 5% sobre cada venda de ingresso realizada na plataforma.',
  '4.2. Valores adicionais podem ser cobrados por servicos especificos, como transacoes via cartao de credito.',
  '4.3. O repasse dos valores ao produtor ocorre em ate 2 dias uteis apos a conclusao do evento.',
  '',
  '5. RESPONSABILIDADES DO PRODUTOR',
  '5.1. O produtor e responsavel por todas as informacoes fornecidas sobre o evento.',
  '5.2. O produtor deve cumprir todas as leis e regulamentos aplicaveis a realizacao de eventos.',
  '5.3. O produtor e responsavel pela seguranca e bem-estar dos participantes no evento.',
  '',
  '6. PRIVACIDADE E DADOS',
  '6.1. Os dados pessoais dos usuarios sao tratados conforme nossa Politica de Privacidade.',
  '6.2. A Evokaa utiliza criptografia e medidas de seguranca para proteger os dados.',
  '',
  '7. PROPRIEDADE INTELECTUAL',
  '7.1. A marca, logotipo e interface da Evokaa sao propriedade exclusiva da Evokaa Tecnologia Ltda.',
  '7.2. O produtor mantem todos os direitos sobre o conteudo de seus eventos.',
  '',
  '8. SUSPENSAO E CANCELAMENTO',
  '8.1. A Evokaa reserva-se o direito de suspender contas que violem estes termos.',
  '8.2. Em caso de cancelamento, os dados do usuario serao mantidos por 90 dias.',
  '',
  '9. DISPOSICOES GERAIS',
  '9.1. Estes termos podem ser atualizados periodicamente.',
  '9.2. Em caso de divergencias, as partes concordam em submeter ao Foro da Comarca de Sao Paulo/SP.',
  '',
  'Data da ultima atualizacao: 15 de Maio de 2025',
  'Versao: 3.2.1',
]

export default function ProducerSettings() {
  const [activeTab, setActiveTab] = useState<'profile' | 'billing' | 'plan' | 'notifications' | 'terms'>('profile')
  const [profile, setProfile] = useState({ name: 'Joao Silva', email: 'joao@email.com', phone: '(11) 98765-4321', company: 'Evokaa Eventos', cpf: '123.456.789-00', bio: 'Produtor de eventos ha 5 anos.' })
  const [twoFactor, setTwoFactor] = useState(false)

  const tabs = [
    { id: 'profile' as const, icon: User, label: 'Perfil' },
    { id: 'billing' as const, icon: CreditCard, label: 'Pagamentos' },
    { id: 'plan' as const, icon: Crown, label: 'Meu Plano' },
    { id: 'notifications' as const, icon: Bell, label: 'Notificacoes' },
    { id: 'terms' as const, icon: FileText, label: 'Termos' },
  ]

  const payments = [
    { id: 1, date: '15 Mai 2025', desc: 'Assinatura Evokaa Pro', amount: 149, status: 'pago', method: 'Cartao Credito' },
    { id: 2, date: '15 Abr 2025', desc: 'Assinatura Evokaa Pro', amount: 149, status: 'pago', method: 'PIX' },
    { id: 3, date: '15 Mar 2025', desc: 'Assinatura Evokaa Pro', amount: 149, status: 'pago', method: 'Cartao Credito' },
    { id: 4, date: '15 Fev 2025', desc: 'Assinatura Evokaa Starter', amount: 49, status: 'pago', method: 'Boleto' },
    { id: 5, date: '15 Jan 2025', desc: 'Assinatura Evokaa Starter', amount: 49, status: 'pago', method: 'Cartao Credito' },
  ]

  const features = [
    { name: 'Eventos', value: 'Ilimitados' },
    { name: 'Ingressos', value: 'Ilimitados' },
    { name: 'CRM', value: 'Incluso' },
    { name: 'Afiliados', value: '50 ativos', limit: 'de 100' },
    { name: 'Comunicacao', value: '5.000 envios', limit: 'de 10.000/mes' },
    { name: 'Cupons', value: '12 ativos', limit: 'de 50' },
  ]

  const handleSave = () => { toast.success('Alteracoes salvas com sucesso!') }

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-espresso">Configuracoes</h1>
        <p className="text-sm text-espresso/50 mt-1">Gerencie sua conta, plano e preferencias</p>
      </div>

      <div className="flex items-center gap-1 p-1 bg-white/60 border border-white/60 rounded-2xl w-fit mb-8">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all ${activeTab === t.id ? 'bg-plum text-cream' : 'text-espresso/40 hover:text-espresso/70'}`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* Profile */}
      {activeTab === 'profile' && (
        <div className="max-w-2xl space-y-6">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-full bg-plum/10 flex items-center justify-center text-xl font-serif text-plum">JS</div>
            <div>
              <h3 className="text-sm font-medium text-espresso">Foto de Perfil</h3>
              <p className="text-xs text-espresso/30">JPG, PNG ate 2MB</p>
            </div>
            <button className="ml-auto px-4 py-2 bg-white/60 border border-white/60 rounded-full text-xs text-espresso/50 hover:text-plum transition-colors">Alterar</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'Nome Completo', key: 'name', value: profile.name },
              { label: 'Email', key: 'email', value: profile.email },
              { label: 'Telefone', key: 'phone', value: profile.phone },
              { label: 'Empresa', key: 'company', value: profile.company },
              { label: 'CPF/CNPJ', key: 'cpf', value: profile.cpf },
            ].map(f => (
              <div key={f.key}>
                <label className="text-[10px] font-medium text-espresso/40 uppercase tracking-wider mb-1.5 block">{f.label}</label>
                <input value={f.value} onChange={e => setProfile({ ...profile, [f.key]: e.target.value })} className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
              </div>
            ))}
          </div>
          <div>
            <label className="text-[10px] font-medium text-espresso/40 uppercase tracking-wider mb-1.5 block">Bio</label>
            <textarea value={profile.bio} onChange={e => setProfile({ ...profile, bio: e.target.value })} rows={3} className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30 resize-none" />
          </div>

          <div className="p-5 rounded-2xl bg-white/60 border border-white/60">
            <h3 className="text-sm font-medium text-espresso mb-4 flex items-center gap-2"><Shield className="w-4 h-4 text-plum" /> Seguranca</h3>
            <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid rgba(26,14,20,0.05)' }}>
              <div>
                <div className="text-sm text-espresso">Autenticacao de dois fatores</div>
                <div className="text-xs text-espresso/30">Adicione uma camada extra</div>
              </div>
              <button onClick={() => setTwoFactor(!twoFactor)} className={`w-11 h-6 rounded-full p-0.5 transition-colors ${twoFactor ? 'bg-plum' : 'bg-espresso/15'}`}>
                <div className={`w-5 h-5 rounded-full bg-cream shadow-sm transition-transform ${twoFactor ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <div className="text-sm text-espresso">Alterar senha</div>
                <div className="text-xs text-espresso/30">Ultima: 3 meses atras</div>
              </div>
              <button className="px-4 py-2 text-xs text-plum hover:bg-plum/10 rounded-full transition-colors">Alterar</button>
            </div>
          </div>

          <button onClick={handleSave} className="px-8 py-3 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all flex items-center gap-2">
            <Save className="w-4 h-4" /> Salvar Alteracoes
          </button>
        </div>
      )}

      {/* Billing */}
      {activeTab === 'billing' && (
        <div className="max-w-3xl space-y-6">
          <div className="p-6 rounded-2xl bg-white/60 border border-white/60">
            <h3 className="text-sm font-medium text-espresso mb-4 flex items-center gap-2"><CreditCard className="w-4 h-4 text-plum" /> Forma de Pagamento</h3>
            <div className="flex items-center gap-4 p-4 rounded-xl bg-canvas">
              <CreditCard className="w-5 h-5 text-plum" />
              <div className="flex-1">
                <div className="text-sm font-medium text-espresso">Cartao de Credito</div>
                <div className="text-xs text-espresso/30">**** 4242 · Vence 12/26</div>
              </div>
              <span className="px-3 py-1 text-[10px] font-medium rounded-full bg-green-50 text-green-600">Ativo</span>
              <button className="px-3 py-1.5 text-xs text-plum hover:bg-plum/10 rounded-lg transition-colors">Alterar</button>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white/60 border border-white/60">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-espresso flex items-center gap-2"><Calendar className="w-4 h-4 text-plum" /> Historico</h3>
              <button className="flex items-center gap-1.5 text-xs text-espresso/30 hover:text-plum transition-colors"><Download className="w-3.5 h-3.5" /> Exportar</button>
            </div>
            <div className="space-y-2">
              {payments.map(p => (
                <div key={p.id} className="flex items-center gap-4 p-3 rounded-xl bg-white/40">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-green-50">
                    <CreditCard className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-espresso">{p.desc}</div>
                    <div className="text-[10px] text-espresso/30">{p.date} · {p.method}</div>
                  </div>
                  <div className="text-sm font-medium text-espresso">R$ {p.amount}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white/60 border border-white/60">
            <h3 className="text-sm font-medium text-espresso mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-plum" /> Resumo</h3>
            <div className="grid grid-cols-3 gap-4">
              {[{ v: 'R$ 544', l: 'Total 2025' }, { v: 'R$ 149', l: 'Proximo' }, { v: '5 dias', l: 'Ate venc.' }].map(s => (
                <div key={s.l} className="p-4 rounded-xl bg-canvas text-center">
                  <div className="font-serif text-xl text-espresso">{s.v}</div>
                  <div className="text-[10px] text-espresso/30 mt-0.5">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Plan */}
      {activeTab === 'plan' && (
        <div className="max-w-3xl space-y-6">
          <div className="p-6 rounded-2xl bg-gradient-to-br from-plum/10 to-plum/5 border border-plum/20">
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-plum/20 flex items-center justify-center">
                  <Crown className="w-7 h-7 text-plum" />
                </div>
                <div>
                  <h3 className="font-serif text-xl text-espresso">Evokaa Pro</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-plum/20 text-plum">Plano Atual</span>
                </div>
              </div>
              <div className="text-right">
                <div className="font-serif text-2xl text-plum">R$ 149<span className="text-xs text-espresso/30">/mes</span></div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
              {features.map(f => (
                <div key={f.name} className="p-3 rounded-xl bg-white/60">
                  <div className="text-[10px] text-espresso/30 uppercase">{f.name}</div>
                  <div className="text-sm font-medium text-espresso">{f.value}</div>
                  {f.limit && <div className="text-[10px] text-espresso/20">{f.limit}</div>}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100">
              <Clock className="w-4 h-4 text-amber-600" />
              <div className="text-xs text-amber-700">Proximo vencimento: <strong>15 Jun 2025</strong></div>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white/60 border border-white/60 space-y-3">
            <h3 className="text-sm font-medium text-espresso mb-2">Gerenciar Assinatura</h3>
            {[
              { label: 'Mudar para Anual (20% OFF)', desc: 'Economize R$ 358/ano', icon: Calendar },
              { label: 'Trocar de Plano', desc: 'Ver outras opcoes', icon: Crown },
              { label: 'Historico de Cobrancas', desc: 'Todas as faturas', icon: FileText },
              { label: 'Cancelar Assinatura', desc: 'Ate o fim do periodo', icon: Calendar },
            ].map(a => (
              <button key={a.label} className="w-full flex items-center gap-4 p-4 rounded-xl bg-white/40 hover:bg-white/60 transition-all text-left group">
                <a.icon className="w-4 h-4 text-plum" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-espresso">{a.label}</div>
                  <div className="text-[10px] text-espresso/30">{a.desc}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-espresso/15 group-hover:text-plum transition-colors" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Notifications */}
      {activeTab === 'notifications' && (
        <div className="max-w-2xl space-y-4">
          {[
            { label: 'Novo ingresso vendido', desc: 'Alerta a cada venda' },
            { label: 'Check-in realizado', desc: 'Notificacao de entrada' },
            { label: 'Vencimento de plano', desc: '7 dias antes' },
            { label: 'Nova mensagem', desc: 'Suporte' },
            { label: 'Relatorio semanal', desc: 'Toda segunda' },
            { label: 'Nova avaliacao', desc: 'Avaliacao do evento' },
            { label: 'Limite de afiliado', desc: '80% do limite' },
          ].map((n, i) => {
            const [on, setOn] = useState(i < 5)
            return (
              <div key={n.label} className="flex items-center justify-between p-5 rounded-2xl bg-white/60 border border-white/60">
                <div>
                  <div className="text-sm font-medium text-espresso">{n.label}</div>
                  <div className="text-xs text-espresso/30">{n.desc}</div>
                </div>
                <button onClick={() => setOn(!on)} className={`w-11 h-6 rounded-full p-0.5 transition-colors ${on ? 'bg-plum' : 'bg-espresso/15'}`}>
                  <div className={`w-5 h-5 rounded-full bg-cream shadow-sm transition-transform ${on ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Terms */}
      {activeTab === 'terms' && (
        <div className="max-w-3xl">
          <div className="p-6 rounded-2xl bg-white/60 border border-white/60 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-espresso flex items-center gap-2"><FileText className="w-4 h-4 text-plum" /> Termos e Condicoes</h3>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-xs text-green-600">Aceito em 01 Mar 2025</span>
              </div>
            </div>
            <p className="text-xs text-espresso/40 mb-4">Versao 3.2.1 · 15 Mai 2025</p>
            <div className="max-h-96 overflow-y-auto p-4 rounded-xl bg-canvas text-xs text-espresso/60 leading-relaxed">
              {termsLines.map((line, i) => (
                line === '' ? <div key={i} className="h-2" /> : <p key={i} className={line.match(/^\d/) ? 'font-medium text-espresso/80 mt-3 mb-1' : ''}>{line}</p>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-5 rounded-2xl bg-green-50/60 border border-green-100">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <div>
                <div className="text-sm font-medium text-green-800">Termos aceitos</div>
                <div className="text-xs text-green-600/70">01 Mar 2025 as 14:32</div>
              </div>
            </div>
            <button className="px-4 py-2 rounded-full text-xs font-medium border hover:bg-green-100" style={{ borderColor: '#86efac', color: '#16a34a' }}>
              <Download className="w-3.5 h-3.5 inline mr-1" /> PDF
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
