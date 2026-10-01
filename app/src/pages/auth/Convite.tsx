import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CheckCircle2, ClipboardList, Eye, EyeOff, KeyRound, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'
import { useAuth } from '../../hooks/useAuth'
import { useAuthStore } from '../../stores/authStore'
import { useTwoFactor } from '../../hooks/useTwoFactor'
import { chamarConvite, mensagemDe, motivoDe } from '../../lib/convite'
import { passwordError } from '../../lib/password'
import AuthPasswordStrength from '../../components/AuthPasswordStrength'
import { CamposFicha } from '../../components/FichaColaborador'
import { campo, fichaParaBanco, fichaVazia, rotulo, validarFicha, type Ficha } from '../../lib/fichaColaborador'

// Convite de colaborador da Evokaa (alpha.evokaa.com.br/convite#<token>), fora do ProtectedRoute.
// Etapas: boas-vindas → criar senha ou entrar → verificação em duas etapas (obrigatória) → cadastro → pronto.
// O token chega no # (não vai a servidor nenhum), passa para o sessionStorage da aba e sai da barra de endereço.
// Quem decide tudo é o banco (docs/sql/20261002_convite_colaborador.sql): convite_conferir diz se vale;
// convite_aceitar (pela ação aceitar da Edge Function admin-invite, que avisa os super_admins na mesma
// requisição) confere token, e-mail da conta, 2FA e campos, e aplica as funções gravadas no convite. A conta nova
// é criada pela mesma Edge Function (criar-conta).

type Etapa = 'conferindo' | 'invalido' | 'boas-vindas' | 'conta' | 'codigo' | '2fa' | 'cadastro' | 'pronto'

const ETAPAS = ['Acesso', 'Verificação', 'Cadastro'] as const
const PASSO: Partial<Record<Etapa, number>> = { conta: 0, codigo: 0, '2fa': 1, cadastro: 2, pronto: 3 }

const CHAVE_TOKEN = 'evokaa_convite'
// Lê o token do # (link do e-mail), guarda na aba e limpa a barra de endereço; sem #, usa o guardado (recarregar)
function lerToken(): string {
  const doLink = window.location.hash.slice(1)
  if (doLink) {
    sessionStorage.setItem(CHAVE_TOKEN, doLink)
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
    return doLink
  }
  return sessionStorage.getItem(CHAVE_TOKEN) ?? ''
}
// e-mail da conta parece o do convite? (primeira letra e domínio, que é o que o mascarado mostra)
function pareceOMesmo(email: string, mascarado: string) {
  const [local, dominio] = email.toLowerCase().split('@')
  const [mLocal, mDominio] = mascarado.toLowerCase().split('@')
  return !!local && !!mLocal && local[0] === mLocal[0] && dominio === mDominio
}
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/ // 32 bytes em base64url (Edge Function admin-invite)

const botao = 'w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-full text-sm font-semibold text-white bg-[linear-gradient(135deg,#1d68c4,#8f33f5)] shadow-[0_10px_30px_-10px_rgba(143,51,245,0.6)] hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-plum/50'
const link = 'text-sm text-plum-light hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum/40 rounded'

function Aviso({ texto }: { texto: string }) {
  return <div role="alert" className="mb-5 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">{texto}</div>
}

// Etapa da verificação em duas etapas: o mesmo cadastro do Perfil (useTwoFactor). Ao confirmar o código, a
// sessão já fica em aal2.
function AtivarDoisFatores({ onPronto }: { onPronto: () => void }) {
  const { enabled, loading, toggle, modal } = useTwoFactor()
  const avisou = useRef(false)
  useEffect(() => {
    if (enabled && !avisou.current) { avisou.current = true; onPronto() }
  }, [enabled, onPronto])
  return (
    <div>
      <ShieldCheck className="w-10 h-10 text-plum-light mb-4" aria-hidden />
      <h1 className="font-serif text-2xl sm:text-3xl text-espresso leading-tight text-balance">Ative a verificação em duas etapas</h1>
      <p className="text-sm text-espresso/75 mt-3 leading-relaxed">
        Toda conta de colaborador da Evokaa entra com a senha e um código de 6 dígitos que muda a cada 30 segundos.
        Tenha à mão o Google Authenticator ou o Microsoft Authenticator no celular.
      </p>
      <button type="button" onClick={toggle} disabled={loading || enabled} className={`${botao} mt-7`}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
        Ativar agora
      </button>
      {modal}
    </div>
  )
}

export default function Convite() {
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  // ponytail: o token fica no sessionStorage da aba (recarregar continua de onde estava); some ao fechar a aba ou no fim
  const [token] = useState(lerToken)
  const [etapa, setEtapa] = useState<Etapa>(() => (TOKEN_RE.test(token) ? 'conferindo' : 'invalido'))
  const [emailMascarado, setEmailMascarado] = useState('')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)

  // Conta
  const [modo, setModo] = useState<'criar' | 'entrar'>('criar')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [verSenha, setVerSenha] = useState(false)
  const [desafio, setDesafio] = useState<{ factorId: string; challengeId: string } | null>(null)
  const [codigo, setCodigo] = useState('')

  // Cadastro
  const [f, setF] = useState<Ficha>(fichaVazia)

  useEffect(() => {
    if (!TOKEN_RE.test(token)) return
    let cancelado = false
    supabase.rpc('convite_conferir' as never, { p_token: token } as never).then(({ data, error }) => {
      if (cancelado) return
      const r = data as { valido?: boolean; email?: string } | null
      if (error) { setErro('Não foi possível conferir o convite agora. Recarregue a página em instantes.'); setEtapa('invalido'); return }
      if (!r?.valido) { setEtapa('invalido'); return }
      setEmailMascarado(r.email ?? '')
      setEtapa('boas-vindas')
    })
    return () => { cancelado = true }
  }, [token])

  // Depois de entrar: com o código já digitado vai ao cadastro; conta com 2FA pede o código; sem 2FA, ativa
  const avancar = async () => {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (error || !data) throw error ?? new Error('Não foi possível confirmar a sessão.')
    if (data.currentLevel === 'aal2') { setEtapa('cadastro'); return }
    if (data.nextLevel === 'aal2') {
      const fatores = await supabase.auth.mfa.listFactors()
      const fator = fatores.data?.totp?.[0]
      if (fatores.error || !fator) throw fatores.error ?? new Error('Esta conta usa um tipo de verificação que o painel não aceita.')
      const c = await supabase.auth.mfa.challenge({ factorId: fator.id })
      if (c.error) throw c.error
      setDesafio({ factorId: fator.id, challengeId: c.data.id })
      setCodigo('')
      setEtapa('codigo')
      return
    }
    setEtapa('2fa')
  }

  const executar = async (acao: () => Promise<void>) => {
    setErro('')
    setOcupado(true)
    try { await acao() } catch (e) { setErro(mensagemDe(e)) } finally { setOcupado(false) }
  }

  const entrar = (emailConta: string, senhaConta: string) => executar(async () => {
    // conta de outro e-mail nem entra: o convite só vale para a conta do e-mail que o recebeu
    if (!pareceOMesmo(emailConta.trim(), emailMascarado)) {
      throw new Error(`Esta conta não é a do convite, que foi enviado para ${emailMascarado}. Entre com a conta desse e-mail.`)
    }
    const { error } = await supabase.auth.signInWithPassword({ email: emailConta.trim().toLowerCase(), password: senhaConta })
    if (error) throw new Error(/invalid login/i.test(error.message) ? 'E-mail ou senha incorretos.' : error.message)
    await avancar()
  })

  const criarConta = (e: React.FormEvent) => {
    e.preventDefault()
    const fraca = passwordError(senha)
    if (fraca) { setErro(fraca); return }
    if (senha !== confirmar) { setErro('As senhas não coincidem.'); return }
    executar(async () => {
      try {
        const r = await chamarConvite<{ email: string }>({ acao: 'criar-conta', token, senha })
        const { error } = await supabase.auth.signInWithPassword({ email: r.email, password: senha })
        if (error) throw error
        await avancar()
      } catch (err) {
        if (motivoDe(err) !== 'conta_existe') throw err
        setModo('entrar')
        setSenha('')
        setConfirmar('')
        throw err
      }
    })
  }

  const confirmarCodigo = (e: React.FormEvent) => {
    e.preventDefault()
    if (codigo.length !== 6 || !desafio) { setErro('Digite o código de 6 dígitos do aplicativo.'); return }
    executar(async () => {
      const { error } = await supabase.auth.mfa.verify({ ...desafio, code: codigo })
      if (error) throw new Error('Código inválido ou expirado. Confira o aplicativo e tente de novo.')
      await avancar()
    })
  }


  const enviarCadastro = (e: React.FormEvent) => {
    e.preventDefault()
    const problema = validarFicha(f, user?.email ?? '')
    if (problema) { setErro(problema); window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    executar(async () => {
      const dados = fichaParaBanco(f)
      try {
        await chamarConvite({ acao: 'aceitar', token, dados })
      } catch (err) {
        window.scrollTo({ top: 0, behavior: 'smooth' })
        throw err
      }
      sessionStorage.removeItem(CHAVE_TOKEN)
      await useAuthStore.getState().fetchProfile({ force: true })
      setEtapa('pronto')
    })
  }

  // Sai só desta conta neste navegador; o convite segue na aba (sessionStorage)
  const trocarConta = () => executar(async () => {
    await useAuthStore.getState().setUser(null)
    await useAuthStore.getState().setSession(null)
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
    queryClient.clear() // nada em cache da conta anterior
    setEmail('')
    setSenha('')
    setModo('entrar')
    setEtapa('conta')
  })

  const passo = PASSO[etapa]
  const largo = etapa === 'cadastro'

  return (
    <div className="min-h-screen glass-canvas flex justify-center px-4 py-10 sm:py-16">
      <div className={`w-full ${largo ? 'max-w-2xl' : 'max-w-md'} transition-[max-width] duration-500`}>
        <div className="flex justify-center mb-8">
          <img src="/images/logo-evokaa-sm.png" alt="Evokaa" className="h-10 w-auto" />
        </div>

        {passo !== undefined && (
          <nav aria-label="Etapas do convite" className="mb-6">
            <ol className="flex gap-2">
              {ETAPAS.map((nome, i) => (
                <li key={nome} className="flex-1" aria-current={i === passo ? 'step' : undefined}>
                  <div className="h-1 rounded-full bg-espresso/10 overflow-hidden">
                    <div className={`h-full bg-[linear-gradient(90deg,#1d68c4,#8f33f5)] transition-[width] duration-700 ease-out ${i < passo ? 'w-full' : i === passo ? 'w-1/2' : 'w-0'}`} />
                  </div>
                  <span className={`block mt-2 text-[11px] font-medium ${i <= passo ? 'text-espresso' : 'text-espresso/60'}`}>{nome}</span>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <section className="bg-white/60 border border-white/60 rounded-3xl p-6 sm:p-9 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.5)]">
          {erro && etapa !== 'invalido' && <Aviso texto={erro} />}

          {etapa === 'conferindo' && (
            <div className="flex flex-col items-center gap-3 py-10 text-espresso/75" role="status">
              <Loader2 className="w-7 h-7 animate-spin text-plum-light" />
              <span className="text-sm">Conferindo o convite…</span>
            </div>
          )}

          {etapa === 'invalido' && (
            <div className="text-center py-4">
              <LockKeyhole className="w-10 h-10 text-espresso/50 mx-auto mb-4" aria-hidden />
              <h1 className="font-serif text-2xl text-espresso">Este convite não vale mais</h1>
              <p className="text-sm text-espresso/75 mt-3 leading-relaxed">
                {erro || 'O link pode ter expirado (vale 7 dias), já ter sido usado ou ter sido substituído por um novo. Peça um novo convite a quem convidou você.'}
              </p>
            </div>
          )}

          {etapa === 'boas-vindas' && (
            <div>
              <h1 className="font-serif text-3xl sm:text-[2.5rem] text-espresso leading-[1.1] tracking-tight text-balance">
                Você foi convidado para a equipe de colaboradores da Evokaa
              </h1>
              <p className="text-sm text-espresso/75 mt-4 leading-relaxed">
                O convite foi enviado para <strong className="text-espresso font-semibold">{emailMascarado}</strong>.
                São três passos; no fim, o painel abre para você.
              </p>
              <ol className="mt-8 space-y-5">
                {[
                  { icone: KeyRound, titulo: 'Crie a sua senha', texto: 'Ou entre com a conta que você já tem neste e-mail.' },
                  { icone: ShieldCheck, titulo: 'Ative a verificação em duas etapas', texto: 'Com um aplicativo autenticador no celular.' },
                  { icone: ClipboardList, titulo: 'Preencha o seu cadastro', texto: 'Dados pessoais, endereço, contatos e Pix.' },
                ].map(({ icone: Icone, titulo, texto }) => (
                  <li key={titulo} className="flex gap-4">
                    <span className="shrink-0 w-10 h-10 rounded-full bg-plum/10 text-plum-light flex items-center justify-center">
                      <Icone className="w-[18px] h-[18px]" aria-hidden />
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-espresso">{titulo}</div>
                      <div className="text-sm text-espresso/70 mt-0.5">{texto}</div>
                    </div>
                  </li>
                ))}
              </ol>
              <button type="button" className={`${botao} mt-9`} onClick={() => setEtapa('conta')}>
                Começar <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {etapa === 'conta' && isAuthenticated && (
            <div>
              <h1 className="font-serif text-2xl sm:text-3xl text-espresso leading-tight">Continuar com esta conta?</h1>
              <p className="text-sm text-espresso/75 mt-3 leading-relaxed">
                Você está conectado como <strong className="text-espresso font-semibold break-all">{user?.email}</strong>.
                O convite só vale para a conta do e-mail que o recebeu.
              </p>
              {pareceOMesmo(user?.email ?? '', emailMascarado) ? (
                <>
                  <button type="button" className={`${botao} mt-7`} disabled={ocupado} onClick={() => executar(avancar)}>
                    {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Continuar
                  </button>
                  <button type="button" className={`${link} block mx-auto mt-5`} disabled={ocupado} onClick={trocarConta}>
                    Usar outra conta
                  </button>
                </>
              ) : (
                <>
                  <div role="alert" className="mt-5 p-3 rounded-xl bg-amber-50 border border-amber-100 text-sm text-amber-800">
                    Esta conta não é a do convite, que foi enviado para <strong>{emailMascarado}</strong>. Entre com a conta desse e-mail.
                  </div>
                  <button type="button" className={`${botao} mt-7`} disabled={ocupado} onClick={trocarConta}>
                    {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Usar outra conta
                  </button>
                </>
              )}
            </div>
          )}

          {etapa === 'conta' && !isAuthenticated && modo === 'criar' && (
            <form onSubmit={criarConta} noValidate>
              <h1 className="font-serif text-2xl sm:text-3xl text-espresso leading-tight">Crie a sua senha</h1>
              <p className="text-sm text-espresso/75 mt-3 mb-6">A conta usa o e-mail do convite, <strong className="text-espresso font-semibold">{emailMascarado}</strong>.</p>
              <div className="space-y-4">
                <div>
                  <label htmlFor="convite-senha" className={rotulo}>Senha</label>
                  <div className="relative">
                    <input id="convite-senha" type={verSenha ? 'text' : 'password'} autoComplete="new-password" value={senha}
                      onChange={(e) => { setSenha(e.target.value); setErro('') }} disabled={ocupado} className={`${campo} pr-11`} />
                    <button type="button" onClick={() => setVerSenha((v) => !v)} aria-label={verSenha ? 'Esconder a senha' : 'Mostrar a senha'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-espresso/60 hover:text-espresso">
                      {verSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="convite-confirmar" className={rotulo}>Repita a senha</label>
                  <input id="convite-confirmar" type={verSenha ? 'text' : 'password'} autoComplete="new-password" value={confirmar}
                    onChange={(e) => { setConfirmar(e.target.value); setErro('') }} disabled={ocupado} className={campo} />
                </div>
                <AuthPasswordStrength password={senha} confirmPassword={confirmar} />
              </div>
              <button type="submit" className={`${botao} mt-7`} disabled={ocupado}>
                {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Criar conta e continuar
              </button>
              <button type="button" className={`${link} block mx-auto mt-5`} onClick={() => { setErro(''); setModo('entrar') }}>
                Já tenho conta com este e-mail
              </button>
            </form>
          )}

          {etapa === 'conta' && !isAuthenticated && modo === 'entrar' && (
            <form onSubmit={(e) => { e.preventDefault(); entrar(email, senha) }} noValidate>
              <h1 className="font-serif text-2xl sm:text-3xl text-espresso leading-tight">Entre com a sua conta</h1>
              <p className="text-sm text-espresso/75 mt-3 mb-6">Use a conta do e-mail que recebeu o convite, <strong className="text-espresso font-semibold">{emailMascarado}</strong>.</p>
              <div className="space-y-4">
                <div>
                  <label htmlFor="convite-email" className={rotulo}>E-mail</label>
                  <input id="convite-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    disabled={ocupado} className={campo} />
                </div>
                <div>
                  <label htmlFor="convite-senha-entrar" className={rotulo}>Senha</label>
                  <input id="convite-senha-entrar" type="password" autoComplete="current-password" value={senha}
                    onChange={(e) => setSenha(e.target.value)} disabled={ocupado} className={campo} />
                </div>
              </div>
              <button type="submit" className={`${botao} mt-7`} disabled={ocupado || !email || !senha}>
                {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Entrar e continuar
              </button>
              <button type="button" className={`${link} block mx-auto mt-5`} onClick={() => { setErro(''); setModo('criar') }}>
                Ainda não tenho conta
              </button>
            </form>
          )}

          {etapa === 'codigo' && (
            <form onSubmit={confirmarCodigo} noValidate>
              <h1 className="font-serif text-2xl sm:text-3xl text-espresso leading-tight">Digite o código</h1>
              <p className="text-sm text-espresso/75 mt-3 mb-6">Sua conta já tem a verificação em duas etapas. Abra o aplicativo autenticador e digite o código de 6 dígitos.</p>
              <label htmlFor="convite-codigo" className={rotulo}>Código</label>
              <input id="convite-codigo" autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} disabled={ocupado} placeholder="000000"
                className={`${campo} text-center text-lg font-mono tracking-[0.4em]`} />
              <button type="submit" className={`${botao} mt-7`} disabled={ocupado}>
                {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Confirmar
              </button>
            </form>
          )}

          {etapa === '2fa' && <AtivarDoisFatores onPronto={() => executar(avancar)} />}

          {etapa === 'cadastro' && (
            <form onSubmit={enviarCadastro} noValidate className="space-y-9">
              <div>
                <h1 className="font-serif text-2xl sm:text-3xl text-espresso leading-tight">Seu cadastro de colaborador</h1>
                <p className="text-sm text-espresso/75 mt-3 leading-relaxed">
                  Estes dados servem só ao seu vínculo de trabalho com a Evokaa. Ficam visíveis para você e para a
                  administração da equipe; os demais colaboradores veem apenas o seu nome, cargo e e-mail. Saiba mais
                  na <a href="https://www.evokaa.com.br/privacidade" target="_blank" rel="noreferrer" className="text-plum-light underline underline-offset-2">Política de Privacidade</a> ou
                  escreva para dpo@evokaa.com.br.
                </p>
              </div>

              <CamposFicha f={f} setF={setF} disabled={ocupado} />

              <button type="submit" className={botao} disabled={ocupado}>
                {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Concluir cadastro
              </button>
            </form>
          )}

          {etapa === 'pronto' && (
            <div className="text-center py-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-5" aria-hidden />
              <h1 className="font-serif text-3xl text-espresso leading-tight">Tudo pronto</h1>
              <p className="text-sm text-espresso/75 mt-3 leading-relaxed">
                Você agora faz parte da equipe de colaboradores da Evokaa. O painel mostra as áreas liberadas para você.
              </p>
              <button type="button" className={`${botao} mt-8`} onClick={() => navigate('/admin/dashboard', { replace: true })}>
                Ir para o painel <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
