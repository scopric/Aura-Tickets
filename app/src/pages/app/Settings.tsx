import { useState } from 'react'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
    <div className="max-w-2xl text-foreground">
      <h1 className="mb-6 text-2xl font-semibold tracking-[-0.015em]">Configurações</h1>

      {/* Terms */}
      <section aria-labelledby="t-termos" className="pb-6">
        <h2 id="t-termos" className="mb-3 flex items-center gap-2 text-[15px] font-semibold"><I.Documento size={16} aria-hidden="true" className="text-muted-foreground" /> Termos e Privacidade</h2>
        {/* Um único texto oficial: o da página /termos. (Antes havia aqui uma amostra fixa, com data de aceite fictícia.) */}
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><a href="/termos" target="_blank" rel="noopener noreferrer">Termos de Uso</a></Button>
          <Button asChild variant="outline" size="sm"><a href="/privacidade" target="_blank" rel="noopener noreferrer">Política de Privacidade</a></Button>
        </div>
      </section>

      {/* Danger Zone */}
      <section aria-labelledby="t-perigo" className="border-t border-border py-6">
        <h2 id="t-perigo" className="mb-2 flex items-center gap-2 text-[15px] font-semibold text-destructive"><I.Alerta size={16} aria-hidden="true" /> Zona de Perigo</h2>
        <p className="mb-3 text-sm leading-5 text-muted-foreground">Ao excluir sua conta, seus dados pessoais são apagados de forma permanente e o acesso é encerrado.</p>
        <Button variant="destructive" onClick={() => setShowDelete(true)}>
          <I.Lixeira aria-hidden="true" /> Excluir conta
        </Button>
      </section>

      {/* Delete Modal */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 glass-backdrop" onClick={() => setShowDelete(false)} />
          <div className="relative w-full max-w-sm rounded-ev-xl border border-border bg-card p-6 text-card-foreground shadow-ev-2">
            <div aria-hidden="true" className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-secondary text-destructive"><I.Lixeira size={24} /></div>
            <h3 className="mb-2 text-center text-xl font-semibold tracking-[-0.015em]">Excluir conta</h3>
            <p className="mb-4 text-center text-sm leading-5 text-muted-foreground">Esta ação é irreversível. Todos os seus dados, ingressos e histórico serão excluídos permanentemente.</p>
            <div className="mb-4 rounded-ev-lg bg-secondary p-3">
              <label htmlFor="excluir-confirma" className="mb-2 block text-[13px] leading-[18px]">Digite <strong>EXCLUIR</strong> para confirmar:</label>
              <Input id="excluir-confirma" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="EXCLUIR" className="bg-card" />
            </div>
            <div className="space-y-2">
              <Button variant="destructive" size="lg" className="w-full" onClick={handleDelete}>Confirmar exclusão</Button>
              <Button variant="ghost" size="lg" className="w-full" onClick={() => setShowDelete(false)}>Voltar</Button>
            </div>
          </div>
        </div>
      )}

      <Button variant="outline" size="lg" className="mt-2 w-full" onClick={() => { logout(); toast.success('Sessão encerrada') }}>
        <I.Sair aria-hidden="true" /> Encerrar Sessão
      </Button>
    </div>
  )
}
