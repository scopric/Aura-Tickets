import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { PageHeader } from '@/components/producer/ui'
import { alertaAviso, alertaErro, painel } from '@/components/admin/ui'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { formatCPF, formatPostalCode } from '../../lib/formatters'
import { CamposFicha } from '../../components/FichaColaborador'
import { campo, fichaParaBanco, fichaVazia, mensagemDoBanco, rotulo, validarFicha, type Ficha } from '../../lib/fichaColaborador'

// O colaborador vê e corrige a própria ficha (staff_profiles). Quem decide é o banco
// (docs/sql/20261002_convite_colaborador.sql): UPDATE só nas colunas editáveis (e-mail e cargo ficam de fora),
// só da própria linha, com 2FA confirmado e sessão em aal2; o gatilho normaliza o nome e registra toda mudança de
// Pix ou banco em staff_profiles_historico_pagamento.

type Linha = Record<keyof Ficha, string | null> & { user_id: string; email: string; cargo: string; updated_at: string }

const PAGAMENTO = ['pix_tipo', 'pix_chave', 'banco', 'agencia', 'conta'] as const

function paraFormulario(l: Linha): Ficha {
  const f = { ...fichaVazia }
  for (const k of Object.keys(fichaVazia) as (keyof Ficha)[]) f[k] = l[k] ?? ''
  return {
    ...f,
    cpf: formatCPF(f.cpf),
    cep: formatPostalCode(f.cep),
    pix_chave: f.pix_tipo === 'cpf' ? formatCPF(f.pix_chave) : f.pix_chave,
  }
}

// Nasce com os dados salvos; depois de salvar, o updated_at novo remonta com o que o banco gravou
function Formulario({ linha, onSalvo }: { linha: Linha; onSalvo: (l: Linha) => void }) {
  const [f, setF] = useState<Ficha>(() => paraFormulario(linha))
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const novo = fichaParaBanco(f)
  const mudouPagamento = PAGAMENTO.some((k) => (novo[k] ?? null) !== (linha[k] ?? null))

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    const problema = validarFicha(f, linha.email)
    if (problema) { setErro(problema); window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    setErro('')
    setSalvando(true)
    // .select(): sem ele, a RLS que barra devolve sucesso vazio (Erros que não se repetem, 11). updated_at: aba antiga
    // não sobrescreve o que outra aba salvou (o Pix inclusive); nesse caso também volta vazio
    const { data, error } = await supabase.from('staff_profiles' as never).update(novo as never)
      .eq('user_id', linha.user_id).eq('updated_at', linha.updated_at).select().maybeSingle()
    setSalvando(false)
    if (error || !data) {
      setErro(error ? mensagemDoBanco(error) : 'Não foi possível salvar. O cadastro pode ter mudado em outra aba, ou a sessão precisa do código da verificação em duas etapas: recarregue a página (ou saia e entre de novo) e tente outra vez.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    onSalvo(data as Linha)
    toast.success(mudouPagamento ? 'Cadastro atualizado. A mudança de pagamento ficou registrada.' : 'Cadastro atualizado.')
  }

  return (
    <form onSubmit={salvar} noValidate className="space-y-9">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Estes dados servem só ao seu vínculo de trabalho com a Evokaa. Ficam visíveis para você e para a
        administração da equipe; os demais colaboradores veem apenas o seu nome, cargo e e-mail.
      </p>
      {erro && <div role="alert" className={alertaErro}>{erro}</div>}

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="c-email" className={rotulo}>E-mail da conta</label>
          <input id="c-email" value={linha.email} readOnly disabled className={campo} />
        </div>
        <div>
          <label htmlFor="c-cargo" className={rotulo}>Cargo</label>
          <input id="c-cargo" value={linha.cargo} readOnly disabled className={campo} />
        </div>
        <p className="text-xs text-muted-foreground sm:col-span-2">E-mail e cargo vêm do convite; para mudar, fale com a administração da equipe.</p>
      </div>

      <CamposFicha f={f} setF={setF} disabled={salvando} />

      {mudouPagamento && (
        <div role="status" className={alertaAviso}>
          <I.Info size={16} className="text-[var(--ev-warning)]" aria-hidden="true" />
          <span>A mudança de Pix ou de dados bancários fica registrada, com data e com quem alterou.</span>
        </div>
      )}

      <Button type="submit" loading={salvando}>
        <I.Guardar /> Salvar alterações
      </Button>
    </form>
  )
}

export default function MeuCadastro() {
  const { user } = useAuth()
  const uid = user?.id
  const queryClient = useQueryClient()
  const chave = ['meu-cadastro', uid]
  const { data: linha, isLoading, isError } = useQuery({
    queryKey: chave,
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from('staff_profiles' as never).select('*').eq('user_id', uid as string).maybeSingle()
      if (error) throw error
      return data as Linha | null
    },
  })

  return (
    <div className="p-6 lg:p-10 max-w-3xl">
      <PageHeader title="Meu cadastro" />

      {isLoading || (!uid && !isError) ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Spinner role="presentation" aria-hidden="true" /> Carregando…
        </div>
      ) : isError ? (
        <p role="alert" className={alertaErro}>
          Não foi possível carregar o seu cadastro agora. Recarregue a página em instantes.
        </p>
      ) : !linha ? (
        <p className={`${painel} p-4 text-sm leading-relaxed text-muted-foreground`}>
          Sua conta foi criada como administradora antes do convite, por isso ainda não tem ficha. Peça a quem tem Acesso total: em Equipe Evokaa, remover a sua conta da equipe (não dá para remover a própria conta nem a última com Acesso total, então tem de ser outra pessoa) e enviar um novo convite para o mesmo e-mail. Ao aceitar, a ficha aparece. O convite nunca dá Acesso total: depois, essa pessoa precisa devolvê-lo em Equipe Evokaa, editando as suas permissões. Entre a remoção e o aceite, você fica sem acesso ao painel.
        </p>
      ) : (
        <Formulario key={linha.updated_at} linha={linha} onSalvo={(l) => queryClient.setQueryData(chave, l)} />
      )}
    </div>
  )
}
