import { useState } from 'react'
import { Bell, FileText, Shield, Trash2, AlertTriangle, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

export default function ParticipantSettings() {
  const [showDelete, setShowDelete] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const { logout, user } = useAuth()

  const handleDelete = async () => {
    if (deleteConfirm !== 'EXCLUIR') { toast.error('Digite EXCLUIR para confirmar'); return }
    if (!user?.id) { toast.error('Usuário não autenticado'); return }

    const toastId = toast.loading('Excluindo sua conta e dados do sistema...')
    try {
      // Função com chave de serviço: anonimiza o perfil, apaga os dados só pessoais e desativa o login.
      // (Apagar `profiles` daqui nunca funcionou: não há regra de DELETE, e pedidos apontam para o perfil.)
      const { data, error } = await supabase.functions.invoke('delete-account')
      if (error) {
        // Em 4xx/5xx o invoke não devolve o JSON: lê a mensagem real da função
        const body = await (error as { context?: Response }).context?.json?.().catch(() => null)
        throw new Error(body?.error || error.message)
      }
      if (!data?.ok) throw new Error(data?.error || 'A exclusão não foi concluída')

      toast.success('Conta excluída. Sentiremos sua falta!', { id: toastId })
      setShowDelete(false)
      // A sessão já foi encerrada no servidor; o logout local só limpa o navegador
      await Promise.resolve(logout()).catch(() => {})
    } catch (err: any) {
      console.error('[ParticipantSettings] Erro ao excluir conta:', err)
      toast.error(err.message || 'Erro ao processar o cancelamento da conta', { id: toastId })
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-3xl text-cream mb-6">Configurações</h1>

      {/* Notifications */}
      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-md mb-4">
        <h3 className="text-sm font-semibold text-cream mb-4 flex items-center gap-2"><Bell className="w-4 h-4 text-plum" /> Preferências de Notificação</h3>
        {[
          { label: 'Lembretes de evento', desc: '24h e 2h antes' },
          { label: 'Promoções e ofertas', desc: 'Cupons e descontos' },
          { label: 'Novos eventos', desc: 'Eventos na sua cidade' },
          { label: 'Atualizações de evento', desc: 'Mudanças de horário/local' },
        ].map((n, i) => {
          const [on, setOn] = useState(true)
          return (
            <div key={n.label} className="flex items-center justify-between py-3" style={{ borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
              <div><div className="text-sm text-cream">{n.label}</div><div className="text-xs text-white/30">{n.desc}</div></div>
              <button onClick={() => setOn(!on)} className={`w-11 h-6 rounded-full p-0.5 transition-colors ${on ? 'bg-plum' : 'bg-white/10'}`}>
                <div className={`w-5 h-5 rounded-full bg-cream shadow-sm transition-transform ${on ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          )
        })}
      </div>

      {/* Terms */}
      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-md mb-4">
        <h3 className="text-sm font-semibold text-cream flex items-center gap-2 mb-3"><FileText className="w-4 h-4 text-plum" /> Termos e Privacidade</h3>
        {/* Um único texto oficial: o da página /termos. (Antes havia aqui uma amostra fixa, com data de aceite fictícia.) */}
        <div className="flex flex-wrap gap-2">
          <a href="/termos" target="_blank" rel="noopener noreferrer" className="px-4 py-2 text-xs text-plum hover:bg-plum/10 rounded-full transition-colors">Termos de Uso</a>
          <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="px-4 py-2 text-xs text-plum hover:bg-plum/10 rounded-full transition-colors">Política de Privacidade</a>
        </div>
      </div>

      {/* Privacy */}
      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-md mb-4">
        <h3 className="text-sm font-semibold text-cream mb-3 flex items-center gap-2"><Shield className="w-4 h-4 text-plum" /> Privacidade</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div><div className="text-sm text-cream">Compartilhar dados com produtores</div><div className="text-xs text-white/30">Nome e email visíveis ao produtor</div></div>
            <button className="w-11 h-6 rounded-full p-0.5 bg-plum"><div className="w-5 h-5 rounded-full bg-cream shadow-sm translate-x-5" /></button>
          </div>
          <div className="flex items-center justify-between">
            <div><div className="text-sm text-cream">Histórico público</div><div className="text-xs text-white/30">Outros veem seus eventos favoritos</div></div>
            <button className="w-11 h-6 rounded-full p-0.5 bg-white/10"><div className="w-5 h-5 rounded-full bg-cream shadow-sm translate-x-0" /></button>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="p-6 rounded-2xl bg-red-500/5 border border-red-500/20">
        <h3 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Zona de Perigo</h3>
        <p className="text-xs text-red-400/60 mb-3">Ao excluir sua conta, seus dados pessoais são apagados de forma permanente e o acesso é encerrado.</p>
        <button onClick={() => setShowDelete(true)} className="px-5 py-2.5 bg-red-500 text-white text-xs font-medium rounded-full hover:bg-red-600 transition-all flex items-center gap-2">
          <Trash2 className="w-3.5 h-3.5" /> Excluir conta
        </button>
      </div>

      {/* Delete Modal */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDelete(false)} />
          <div className="relative w-full max-w-sm bg-slate-950 border border-white/10 rounded-3xl p-6 shadow-elevated">
            <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4"><Trash2 className="w-6 h-6 text-red-500" /></div>
            <h3 className="font-serif text-xl text-cream text-center mb-2">Excluir conta</h3>
            <p className="text-xs text-white/40 text-center mb-4">Esta ação é irreversível. Todos os seus dados, ingressos e histórico serão excluídos permanentemente.</p>
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-4">
              <p className="text-xs text-red-400 mb-2">Digite <strong>EXCLUIR</strong> para confirmar:</p>
              <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="EXCLUIR" className="w-full px-3 py-2 bg-white/[0.04] border border-red-500/20 rounded-lg text-sm text-red-400 placeholder:text-red-300 focus:outline-none focus:border-red-400/50" />
            </div>
            <div className="space-y-2">
              <button onClick={handleDelete} className="w-full py-3 bg-red-500 text-white text-sm font-medium rounded-full hover:bg-red-600 transition-all">Confirmar exclusão</button>
              <button onClick={() => setShowDelete(false)} className="w-full py-3 text-sm text-white/40 hover:text-white/80 transition-colors">Voltar</button>
            </div>
          </div>
        </div>
      )}

      <button onClick={() => { logout(); toast.success('Sessão encerrada') }} className="mt-6 w-full py-3 bg-white/[0.02] border border-white/[0.06] text-white/40 text-sm rounded-full hover:text-red-400 hover:bg-red-500/10 transition-all flex items-center justify-center gap-2">
        <LogOut className="w-4 h-4" /> Encerrar Sessão
      </button>
    </div>
  )
}
