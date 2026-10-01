import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowRight, CheckCircle2, ClipboardList, Eye, EyeOff, KeyRound, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useAuthStore } from '../../stores/authStore'
import { useTwoFactor } from '../../hooks/useTwoFactor'
import { chamarConvite, mensagemDe, motivoDe } from '../../lib/convite'
import { passwordError } from '../../lib/password'
import { searchAddressByPostalCode } from '../../lib/cepService'
import { cpfValido, formatCPF, formatPostalCode, maiorDeIdade, UFS } from '../../lib/formatters'
import AuthPasswordStrength from '../../components/AuthPasswordStrength'
import PhoneInput from '../../components/ui/PhoneInput'

// Convite de colaborador da Evokaa (alpha.evokaa.com.br/convite#<token>), fora do ProtectedRoute.
// Etapas: boas-vindas → criar senha ou entrar → verificação em duas etapas (obrigatória) → cadastro → pronto.
// O token fica no # (não vai a servidor nenhum). Quem decide tudo é o banco (docs/sql/20261002_convite_colaborador.sql):
// convite_conferir diz se vale; convite_aceitar confere token, e-mail da conta, 2FA e campos, e aplica as funções
// gravadas no convite. A conta nova é criada pela Edge Function admin-invite (criar-conta).

type Etapa = 'conferindo' | 'invalido' | 'boas-vindas' | 'conta' | 'codigo' | '2fa' | 'cadastro' | 'pronto'

const ETAPAS = ['Acesso', 'Verificação', 'Cadastro'] as const
const PASSO: Partial<Record<Etapa, number>> = { conta: 0, codigo: 0, '2fa': 1, cadastro: 2, pronto: 3 }

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const TELEFONE_RE = /^\+[1-9]\d{9,14}$/
const digitos = (s: string) => s.replace(/\D/g, '')
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/ // 32 bytes em base64url (Edge Function admin-invite)

const PIX = [
  { id: 'cpf', label: 'CPF' },
  { id: 'email', label: 'E-mail' },
  { id: 'telefone', label: 'Celular' },
  { id: 'aleatoria', label: 'Chave aleatória' },
] as const

const vazio = {
  nome_completo: '', cpf: '', rg: '', data_nascimento: '',
  cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '',
  email_secundario: '', telefone: '', whatsapp: '',
  emergencia_nome: '', emergencia_parentesco: '', emergencia_telefone: '',
  banco: '', agencia: '', conta: '', pix_tipo: 'cpf', pix_chave: '',
}
type Ficha = typeof vazio

// As mesmas regras dos CHECKs de staff_profiles: a tela avisa antes, o banco confere de novo
function validar(f: Ficha, emailPrincipal: string): string | null {
  if (f.nome_completo.trim().length < 3) return 'Informe o nome completo.'
  if (!cpfValido(f.cpf)) return 'CPF inválido.'
  if (f.rg.trim().length < 3) return 'Informe o RG.'
  if (!f.data_nascimento || !maiorDeIdade(f.data_nascimento)) return 'Data de nascimento inválida: é preciso ter 18 anos ou mais.'
  if (digitos(f.cep).length !== 8) return 'CEP: 8 dígitos.'
  if (f.rua.trim().length < 2 || !f.numero.trim() || f.bairro.trim().length < 2 || f.cidade.trim().length < 2) return 'Endereço incompleto (rua, número, bairro e cidade).'
  if (!UFS.includes(f.uf)) return 'Escolha o estado (UF).'
  const sec = f.email_secundario.trim().toLowerCase()
  if (!EMAIL_RE.test(sec)) return 'E-mail secundário inválido.'
  if (sec === emailPrincipal.toLowerCase()) return 'O e-mail secundário precisa ser diferente do e-mail da conta.'
  if (!TELEFONE_RE.test(f.telefone) || !TELEFONE_RE.test(f.whatsapp)) return 'Telefone ou WhatsApp inválido: DDD e número.'
  if (f.emergencia_nome.trim().length < 3 || f.emergencia_parentesco.trim().length < 2 || !TELEFONE_RE.test(f.emergencia_telefone)) {
    return 'Contato de emergência incompleto (nome, parentesco e telefone).'
  }
  const chave = f.pix_chave.trim()
  const pixOk = f.pix_tipo === 'cpf' ? cpfValido(chave)
    : f.pix_tipo === 'email' ? EMAIL_RE.test(chave)
    : f.pix_tipo === 'telefone' ? /^\+55\d{10,11}$/.test(chave)
    : /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chave)
  if (!pixOk) return 'A chave Pix não confere com o tipo escolhido.'
  return null
}

const campo = 'w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/60 focus:outline-none focus:border-plum/40 focus-visible:ring-2 focus-visible:ring-plum/30 transition-colors disabled:opacity-50'
const rotulo = 'text-xs font-medium text-espresso/80 mb-1.5 block'
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
  const { isAuthenticated, user, logout } = useAuth()
  // ponytail: o token fica no # durante o fluxo (recarregar a página continua de onde estava); some ao fechar a aba
  const [token] = useState(() => decodeURIComponent(window.location.hash.slice(1)))
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
  const [f, setF] = useState<Ficha>(vazio)
  const set = <K extends keyof Ficha>(k: K, v: Ficha[K]) => setF((x) => ({ ...x, [k]: v }))
  const [buscandoCep, setBuscandoCep] = useState(false)

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

  const buscarCep = async () => {
    const cep = digitos(f.cep)
    if (cep.length !== 8) return
    setBuscandoCep(true)
    const r = await searchAddressByPostalCode(cep, 'BR')
    setBuscandoCep(false)
    if (!r || r.error) { toast.error(r?.error || 'CEP não encontrado.'); return }
    setF((x) => (digitos(x.cep) === cep ? {
      ...x, rua: r.logradouro || x.rua, bairro: r.bairro || x.bairro, cidade: r.localidade || x.cidade, uf: UFS.includes(r.uf) ? r.uf : x.uf,
    } : x))
  }

  const enviarCadastro = (e: React.FormEvent) => {
    e.preventDefault()
    const problema = validar(f, user?.email ?? '')
    if (problema) { setErro(problema); window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    executar(async () => {
      const dados = {
        ...f,
        cpf: digitos(f.cpf), cep: digitos(f.cep), email_secundario: f.email_secundario.trim().toLowerCase(),
        pix_chave: f.pix_tipo === 'cpf' ? digitos(f.pix_chave) : f.pix_chave.trim(),
      }
      const { error } = await supabase.rpc('convite_aceitar' as never, { p_token: token, p_dados: dados } as never)
      if (error) { window.scrollTo({ top: 0, behavior: 'smooth' }); throw new Error(error.message) }
      // Aviso aos super_admins (Decisão 125): não segura a pessoa se falhar
      chamarConvite({ acao: 'avisar-aceite' }).catch((err) => console.error('[Convite] aviso aos super_admins falhou:', mensagemDe(err)))
      await useAuthStore.getState().fetchProfile({ force: true })
      setEtapa('pronto')
    })
  }

  const trocarConta = () => executar(async () => {
    await logout()
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
              <button type="button" className={`${botao} mt-7`} disabled={ocupado} onClick={() => executar(avancar)}>
                {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Continuar
              </button>
              <button type="button" className={`${link} block mx-auto mt-5`} disabled={ocupado} onClick={trocarConta}>
                Usar outra conta
              </button>
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

              <fieldset className="grid sm:grid-cols-2 gap-4" disabled={ocupado}>
                <legend className="font-serif text-lg text-espresso mb-3">Dados pessoais</legend>
                <div className="sm:col-span-2">
                  <label htmlFor="c-nome" className={rotulo}>Nome completo</label>
                  <input id="c-nome" autoComplete="name" value={f.nome_completo} onChange={(e) => set('nome_completo', e.target.value)} className={campo} />
                </div>
                <div>
                  <label htmlFor="c-cpf" className={rotulo}>CPF</label>
                  <input id="c-cpf" inputMode="numeric" value={f.cpf} onChange={(e) => set('cpf', formatCPF(e.target.value))} placeholder="000.000.000-00" className={campo} />
                </div>
                <div>
                  <label htmlFor="c-rg" className={rotulo}>RG</label>
                  <input id="c-rg" value={f.rg} maxLength={20} onChange={(e) => set('rg', e.target.value)} className={campo} />
                </div>
                <div>
                  <label htmlFor="c-nasc" className={rotulo}>Data de nascimento</label>
                  <input id="c-nasc" type="date" value={f.data_nascimento} onChange={(e) => set('data_nascimento', e.target.value)} className={campo} />
                </div>
              </fieldset>

              <fieldset className="grid sm:grid-cols-6 gap-4" disabled={ocupado}>
                <legend className="font-serif text-lg text-espresso mb-3">Endereço</legend>
                <div className="sm:col-span-2">
                  <label htmlFor="c-cep" className={rotulo}>CEP {buscandoCep && <Loader2 className="inline w-3 h-3 animate-spin ml-1" />}</label>
                  <input id="c-cep" inputMode="numeric" autoComplete="postal-code" value={f.cep} maxLength={9}
                    onChange={(e) => set('cep', formatPostalCode(e.target.value))} onBlur={buscarCep} placeholder="00000-000" className={campo} />
                </div>
                <div className="sm:col-span-4">
                  <label htmlFor="c-rua" className={rotulo}>Rua</label>
                  <input id="c-rua" autoComplete="address-line1" value={f.rua} onChange={(e) => set('rua', e.target.value)} className={campo} />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="c-numero" className={rotulo}>Número</label>
                  <input id="c-numero" value={f.numero} maxLength={20} onChange={(e) => set('numero', e.target.value)} className={campo} />
                </div>
                <div className="sm:col-span-4">
                  <label htmlFor="c-complemento" className={rotulo}>Complemento (opcional)</label>
                  <input id="c-complemento" autoComplete="address-line2" value={f.complemento} maxLength={100} onChange={(e) => set('complemento', e.target.value)} className={campo} />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="c-bairro" className={rotulo}>Bairro</label>
                  <input id="c-bairro" value={f.bairro} onChange={(e) => set('bairro', e.target.value)} className={campo} />
                </div>
                <div className="sm:col-span-3">
                  <label htmlFor="c-cidade" className={rotulo}>Cidade</label>
                  <input id="c-cidade" autoComplete="address-level2" value={f.cidade} onChange={(e) => set('cidade', e.target.value)} className={campo} />
                </div>
                <div className="sm:col-span-1">
                  <label htmlFor="c-uf" className={rotulo}>UF</label>
                  <select id="c-uf" value={f.uf} onChange={(e) => set('uf', e.target.value)} className={campo}>
                    <option value="">—</option>
                    {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </fieldset>

              <fieldset className="grid sm:grid-cols-2 gap-4" disabled={ocupado}>
                <legend className="font-serif text-lg text-espresso mb-3">Contatos</legend>
                <div className="sm:col-span-2">
                  <label htmlFor="c-email2" className={rotulo}>E-mail secundário (diferente do e-mail da conta)</label>
                  <input id="c-email2" type="email" autoComplete="email" value={f.email_secundario} onChange={(e) => set('email_secundario', e.target.value)} className={campo} />
                </div>
                <div>
                  <label htmlFor="c-telefone" className={rotulo}>Telefone</label>
                  <PhoneInput id="c-telefone" value={f.telefone} onChange={(v) => set('telefone', v)} />
                </div>
                <div>
                  <label htmlFor="c-whatsapp" className={rotulo}>WhatsApp</label>
                  <PhoneInput id="c-whatsapp" value={f.whatsapp} onChange={(v) => set('whatsapp', v)} />
                </div>
              </fieldset>

              <fieldset className="grid sm:grid-cols-2 gap-4" disabled={ocupado}>
                <legend className="font-serif text-lg text-espresso mb-3">Contato de emergência</legend>
                <div className="sm:col-span-2">
                  <label htmlFor="c-emerg-nome" className={rotulo}>Nome</label>
                  <input id="c-emerg-nome" value={f.emergencia_nome} onChange={(e) => set('emergencia_nome', e.target.value)} className={campo} />
                </div>
                <div>
                  <label htmlFor="c-emerg-parentesco" className={rotulo}>Parentesco</label>
                  <input id="c-emerg-parentesco" value={f.emergencia_parentesco} maxLength={50} onChange={(e) => set('emergencia_parentesco', e.target.value)} placeholder="Mãe, irmão, cônjuge…" className={campo} />
                </div>
                <div>
                  <label htmlFor="c-emerg-tel" className={rotulo}>Telefone</label>
                  <PhoneInput id="c-emerg-tel" value={f.emergencia_telefone} onChange={(v) => set('emergencia_telefone', v)} />
                </div>
              </fieldset>

              <fieldset className="grid sm:grid-cols-6 gap-4" disabled={ocupado}>
                <legend className="font-serif text-lg text-espresso mb-3">Pagamento</legend>
                <div className="sm:col-span-2">
                  <label htmlFor="c-pix-tipo" className={rotulo}>Tipo de chave Pix</label>
                  <select id="c-pix-tipo" value={f.pix_tipo} onChange={(e) => setF((x) => ({ ...x, pix_tipo: e.target.value, pix_chave: '' }))} className={campo}>
                    {PIX.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-4">
                  <label htmlFor="c-pix" className={rotulo}>Chave Pix</label>
                  {f.pix_tipo === 'telefone' ? (
                    <PhoneInput id="c-pix" apenasBrasil value={f.pix_chave} onChange={(v) => set('pix_chave', v)} />
                  ) : (
                    <input id="c-pix" value={f.pix_chave} inputMode={f.pix_tipo === 'cpf' ? 'numeric' : undefined}
                      onChange={(e) => set('pix_chave', f.pix_tipo === 'cpf' ? formatCPF(e.target.value) : e.target.value)}
                      placeholder={f.pix_tipo === 'cpf' ? '000.000.000-00' : f.pix_tipo === 'email' ? 'voce@email.com' : '00000000-0000-0000-0000-000000000000'}
                      className={campo} />
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="c-banco" className={rotulo}>Banco (opcional)</label>
                  <input id="c-banco" value={f.banco} maxLength={80} onChange={(e) => set('banco', e.target.value)} className={campo} />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="c-agencia" className={rotulo}>Agência (opcional)</label>
                  <input id="c-agencia" value={f.agencia} maxLength={20} onChange={(e) => set('agencia', e.target.value)} className={campo} />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="c-conta" className={rotulo}>Conta (opcional)</label>
                  <input id="c-conta" value={f.conta} maxLength={30} onChange={(e) => set('conta', e.target.value)} className={campo} />
                </div>
              </fieldset>

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
