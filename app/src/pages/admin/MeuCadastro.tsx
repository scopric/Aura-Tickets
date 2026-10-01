import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Info, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
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
    // .select(): sem ele, a RLS que barra devolve sucesso vazio (Erros que não se repetem, 11)
    const { data, error } = await supabase.from('staff_profiles' as never).update(novo as never).eq('user_id', linha.user_id).select().maybeSingle()
    setSalvando(false)
    if (error || !data) {
      setErro(error ? mensagemDoBanco(error) : 'Não foi possível salvar: confirme a verificação em duas etapas (saia e entre de novo com o código) e tente outra vez.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    onSalvo(data as Linha)
    toast.success(mudouPagamento ? 'Cadastro atualizado. A mudança de pagamento ficou registrada.' : 'Cadastro atualizado.')
  }

  return (
    <form onSubmit={salvar} noValidate className="space-y-9 mt-6">
      <p className="text-sm text-espresso/75 leading-relaxed">
        Estes dados servem só ao seu vínculo de trabalho com a Evokaa. Ficam visíveis para você e para a
        administração da equipe; os demais colaboradores veem apenas o seu nome, cargo e e-mail.
      </p>
      {erro && <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">{erro}</div>}

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="c-email" className={rotulo}>E-mail da conta</label>
          <input id="c-email" value={linha.email} readOnly disabled className={campo} />
        </div>
        <div>
          <label htmlFor="c-cargo" className={rotulo}>Cargo</label>
          <input id="c-cargo" value={linha.cargo} readOnly disabled className={campo} />
        </div>
        <p className="sm:col-span-2 text-xs text-espresso/70">E-mail e cargo vêm do convite; para mudar, fale com a administração da equipe.</p>
      </div>

      <CamposFicha f={f} setF={setF} disabled={salvando} />

      {mudouPagamento && (
        <div role="status" className="flex gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100 text-sm text-amber-800">
          <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
          <span>A mudança de Pix ou de dados bancários fica registrada, com data e com quem alterou.</span>
        </div>
      )}

      <button type="submit" disabled={salvando}
        className="inline-flex items-center gap-2 px-6 py-3 bg-plum text-cream text-sm font-semibold rounded-full hover:shadow-glow transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum/50">
        {salvando && <Loader2 className="w-4 h-4 animate-spin" />} Salvar alterações
      </button>
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
      <h1 className="font-serif text-3xl text-espresso">Meu cadastro</h1>

      {isLoading || (!uid && !isError) ? (
        <div className="flex items-center gap-2 mt-8 text-sm text-espresso/75" role="status">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
        </div>
      ) : isError ? (
        <p role="alert" className="mt-6 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
          Não foi possível carregar o seu cadastro agora. Recarregue a página em instantes.
        </p>
      ) : !linha ? (
        <p className="mt-6 p-4 rounded-xl bg-white/50 border border-white/60 text-sm text-espresso/80 leading-relaxed">
          Esta conta não tem cadastro de colaborador. O cadastro é feito ao aceitar o convite para a equipe.
        </p>
      ) : (
        <Formulario key={linha.updated_at} linha={linha} onSalvo={(l) => queryClient.setQueryData(chave, l)} />
      )}
    </div>
  )
}
