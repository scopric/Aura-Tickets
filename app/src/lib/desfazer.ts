import { toast } from 'sonner'

/**
 * "Desfazer em vez de confirmar" (NN/g): a ação já foi gravada; o aviso oferece o inverso por alguns segundos.
 * Só para ação de rotina REVERSÍVEL de verdade (liga/desliga). Excluir, enviar e-mail e mexer em dinheiro seguem com confirmação.
 * `inverso` regrava o valor anterior; se falhar, o aviso diz que não deu e o estado continua o da ação feita.
 * `id` (um por item): uma nova ação sobre o mesmo item SUBSTITUI o aviso anterior, para não desfazer um valor velho.
 */
export function avisarComDesfazer({ mensagem, inverso, ms = 8000, id }: { mensagem: string; inverso: () => Promise<unknown>; ms?: number; id?: string }) {
  toast.success(mensagem, {
    id,
    duration: ms,
    action: {
      label: 'Desfazer',
      onClick: () => { inverso().then(() => toast.success('Desfeito.'), () => toast.error('Não foi possível desfazer. Tente de novo.')) },
    },
  })
}
