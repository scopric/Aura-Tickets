import { useState } from 'react'
import { Bell, FileText, Shield, Trash2, AlertTriangle, Check, Download, LogOut } from 'lucide-react'
import { toast } from 'sonner'

const termsText = `TERMOS E CONDICOES DE USO - PARTICIPANTE

1. ACEITACAO
Ao utilizar a Evokaa, voce aceita estes termos integralmente.

2. COMPRA DE INGRESSOS
2.1. Todos os ingressos sao emitidos digitalmente via QR Code.
2.2. O reembolso e permitido ate 7 dias antes do evento, salvo excecoes.
2.3. Em caso de cancelamento do evento pelo produtor, o reembolso e automatico e integral.
2.4. O prazo de reembolso e de ate 7 dias uteis apos a aprovacao.

3. POLITICA DE CANCELAMENTO
3.1. Reembolso 100%: ate 7 dias antes do evento.
3.2. Reembolso 50%: de 7 a 2 dias antes do evento.
3.3. Sem reembolso: menos de 48h antes do evento.
3.4. Reembolso pro-rata: aplicado em caso de adiamento ou mudanca significativa.

4. MESA COLETIVA
4.1. Ao optar por mesa coletiva, voce concorda em ser agrupado por afinidade de perfil.
4.2. O questionario de perfil deve ser respondido ate 48h antes do evento.
4.3. Nao ha garantia de mesa especifica, apenas de perfil compativel.

5. DADOS E PRIVACIDADE
5.1. Seus dados sao criptografados e nunca vendidos a terceiros.
5.2. Voce pode solicitar exclusao de dados a qualquer momento.

6. CANCELAMENTO DE CONTA
6.1. Voce pode cancelar sua conta a qualquer momento.
6.2. Ao cancelar, todos os seus dados serao excluidos em ate 30 dias.
6.3. Ingressos ativos devem ser utilizados ou cancelados antes do fechamento da conta.

Aceito em: 01 Mar 2025
Versao: 2.1.0`

export default function ParticipantSettings() {
  const [showDelete, setShowDelete] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')

  const handleDelete = () => {
    if (deleteConfirm !== 'CANCELAR') { toast.error('Digite CANCELAR para confirmar'); return }
    toast.success('Conta cancelada. Sentiremos sua falta!')
    setShowDelete(false)
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-3xl text-espresso mb-6">Configuracoes</h1>

      {/* Notifications */}
      <div className="p-6 rounded-2xl bg-white/60 border border-white/60 mb-4">
        <h3 className="text-sm font-medium text-espresso mb-4 flex items-center gap-2"><Bell className="w-4 h-4 text-plum" /> Preferencias de Notificacao</h3>
        {[
          { label: 'Lembretes de evento', desc: '24h e 2h antes' },
          { label: 'Promocoes e ofertas', desc: 'Cupons e descontos' },
          { label: 'Novos eventos', desc: 'Eventos na sua cidade' },
          { label: 'Atualizacoes de evento', desc: 'Mudancas de horario/local' },
        ].map((n, i) => {
          const [on, setOn] = useState(true)
          return (
            <div key={n.label} className="flex items-center justify-between py-3" style={{ borderBottom: i < 3 ? '1px solid rgba(26,14,20,0.05)' : 'none' }}>
              <div><div className="text-sm text-espresso">{n.label}</div><div className="text-xs text-espresso/30">{n.desc}</div></div>
              <button onClick={() => setOn(!on)} className={`w-11 h-6 rounded-full p-0.5 transition-colors ${on ? 'bg-plum' : 'bg-espresso/15'}`}>
                <div className={`w-5 h-5 rounded-full bg-cream shadow-sm transition-transform ${on ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          )
        })}
      </div>

      {/* Terms */}
      <div className="p-6 rounded-2xl bg-white/60 border border-white/60 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-espresso flex items-center gap-2"><FileText className="w-4 h-4 text-plum" /> Termos e Condicoes</h3>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600" />
            <span className="text-xs text-green-600">Aceito em 01 Mar 2025</span>
          </div>
        </div>
        <p className="text-xs text-espresso/40 mb-3">Versao 2.1.0 · Ultima atualizacao: 15 Mai 2025</p>
        <div className="flex gap-2">
          <button onClick={() => setShowTerms(!showTerms)} className="px-4 py-2 text-xs text-plum hover:bg-plum/10 rounded-full transition-colors">{showTerms ? 'Ocultar' : 'Ler Termos'}</button>
          <button onClick={() => toast.success('PDF baixado!')} className="px-4 py-2 text-xs text-espresso/40 hover:text-espresso transition-colors flex items-center gap-1"><Download className="w-3.5 h-3.5" /> PDF</button>
        </div>
        {showTerms && <div className="mt-3 p-4 rounded-xl bg-canvas text-xs text-espresso/60 leading-relaxed whitespace-pre-line max-h-64 overflow-y-auto">{termsText}</div>}
      </div>

      {/* Privacy */}
      <div className="p-6 rounded-2xl bg-white/60 border border-white/60 mb-4">
        <h3 className="text-sm font-medium text-espresso mb-3 flex items-center gap-2"><Shield className="w-4 h-4 text-plum" /> Privacidade</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div><div className="text-sm text-espresso">Compartilhar dados com produtores</div><div className="text-xs text-espresso/30">Nome e email visiveis ao produtor</div></div>
            <button className="w-11 h-6 rounded-full p-0.5 bg-plum"><div className="w-5 h-5 rounded-full bg-cream shadow-sm translate-x-5" /></button>
          </div>
          <div className="flex items-center justify-between">
            <div><div className="text-sm text-espresso">Historico publico</div><div className="text-xs text-espresso/30">Outros veem seus eventos favoritos</div></div>
            <button className="w-11 h-6 rounded-full p-0.5 bg-espresso/15"><div className="w-5 h-5 rounded-full bg-cream shadow-sm translate-x-0" /></button>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="p-6 rounded-2xl bg-red-50/60 border border-red-100">
        <h3 className="text-sm font-medium text-red-700 mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Zona de Perigo</h3>
        <p className="text-xs text-red-500/70 mb-3">Ao cancelar sua conta, todos os seus dados e ingressos serao permanentemente excluidos.</p>
        <button onClick={() => setShowDelete(true)} className="px-5 py-2.5 bg-red-500 text-white text-xs font-medium rounded-full hover:bg-red-600 transition-all flex items-center gap-2">
          <Trash2 className="w-3.5 h-3.5" /> Cancelar Conta
        </button>
      </div>

      {/* Delete Modal */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-espresso/20 backdrop-blur-sm" onClick={() => setShowDelete(false)} />
          <div className="relative w-full max-w-sm bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-elevated">
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4"><Trash2 className="w-6 h-6 text-red-500" /></div>
            <h3 className="font-serif text-xl text-espresso text-center mb-2">Cancelar Conta</h3>
            <p className="text-xs text-espresso/50 text-center mb-4">Esta acao e irreversivel. Todos os seus dados, ingressos e historico serao excluidos permanentemente.</p>
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 mb-4">
              <p className="text-xs text-red-600 mb-2">Digite <strong>CANCELAR</strong> para confirmar:</p>
              <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="CANCELAR" className="w-full px-3 py-2 bg-white border border-red-200 rounded-lg text-sm text-red-800 placeholder:text-red-300 focus:outline-none focus:border-red-400" />
            </div>
            <div className="space-y-2">
              <button onClick={handleDelete} className="w-full py-3 bg-red-500 text-white text-sm font-medium rounded-full hover:bg-red-600 transition-all">Confirmar Cancelamento</button>
              <button onClick={() => setShowDelete(false)} className="w-full py-3 text-sm text-espresso/40 hover:text-espresso transition-colors">Voltar</button>
            </div>
          </div>
        </div>
      )}

      <button onClick={() => toast.success('Sessao encerrada')} className="mt-6 w-full py-3 bg-canvas text-espresso/30 text-sm rounded-full hover:text-red-500 hover:bg-red-50 transition-all flex items-center justify-center gap-2">
        <LogOut className="w-4 h-4" /> Encerrar Sessao
      </button>
    </div>
  )
}
