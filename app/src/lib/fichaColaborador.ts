import { cpfValido, maiorDeIdade, UFS } from './formatters'

// Ficha do colaborador da Evokaa (staff_profiles, docs/sql/20261002_convite_colaborador.sql): os mesmos campos e
// regras no cadastro do convite (pages/auth/Convite.tsx) e no Meu cadastro (pages/admin/MeuCadastro.tsx). Os campos
// estão em components/FichaColaborador.tsx.

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const TELEFONE_RE = /^\+[1-9]\d{9,14}$/
export const digitos = (s: string) => s.replace(/\D/g, '')
// Mesma regra do CHECK staff_nome_ok: letras latinas (com acento e as estendidas, como ễ e Ł), espaço, apóstrofo,
// ponto e hífen; ponto seguido de 2 letras é endereço de site ("golpe.com.br"), recusado ("J.R.R. Tolkien" passa)
const NOME_RE = /^[A-Za-zÀ-ÖØ-öø-ɏḀ-ỿ '.-]+$/
const SITE_RE = /\.[A-Za-zÀ-ÿ]{2}/
// Apóstrofo curvo do iPhone (’) vira reto e a forma decomposta vira composta (NFC), como no banco
const normalizarNome = (x: string) => x.replace(/’/g, "'").normalize('NFC').trim()

export const PIX = [
  { id: 'cpf', label: 'CPF' },
  { id: 'email', label: 'E-mail' },
  { id: 'telefone', label: 'Celular' },
  { id: 'aleatoria', label: 'Chave aleatória' },
] as const

export const fichaVazia = {
  nome_completo: '', cpf: '', rg: '', data_nascimento: '',
  cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '',
  email_secundario: '', telefone: '', whatsapp: '',
  emergencia_nome: '', emergencia_parentesco: '', emergencia_telefone: '',
  banco: '', agencia: '', conta: '', pix_tipo: 'cpf', pix_chave: '',
}
export type Ficha = typeof fichaVazia

// As mesmas regras dos CHECKs de staff_profiles: a tela avisa antes, o banco confere de novo
export function validarFicha(f: Ficha, emailPrincipal: string): string | null {
  const nome = normalizarNome(f.nome_completo)
  if (nome.length < 3 || !NOME_RE.test(nome) || SITE_RE.test(nome)) return 'Informe o nome completo, só com letras, espaço, apóstrofo, ponto ou hífen (sem endereço de site).'
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

// No formato que os CHECKs esperam, como o convite_aceitar grava: no UPDATE direto o banco só normaliza o nome
export function fichaParaBanco(f: Ficha) {
  const t = (s: string) => s.trim()
  const opcional = (s: string) => s.trim() || null
  const chave = f.pix_chave.trim()
  return {
    nome_completo: normalizarNome(f.nome_completo), cpf: digitos(f.cpf), rg: t(f.rg), data_nascimento: f.data_nascimento,
    cep: digitos(f.cep), rua: t(f.rua), numero: t(f.numero), complemento: opcional(f.complemento), bairro: t(f.bairro),
    cidade: t(f.cidade), uf: f.uf, email_secundario: f.email_secundario.trim().toLowerCase(),
    telefone: f.telefone, whatsapp: f.whatsapp, emergencia_nome: t(f.emergencia_nome),
    emergencia_parentesco: t(f.emergencia_parentesco), emergencia_telefone: f.emergencia_telefone,
    banco: opcional(f.banco), agencia: opcional(f.agencia), conta: opcional(f.conta), pix_tipo: f.pix_tipo,
    pix_chave: f.pix_tipo === 'cpf' ? digitos(chave) : f.pix_tipo === 'telefone' ? chave : chave.toLowerCase(),
  }
}

// Mesmas frases do convite_aceitar (SQL), pelo nome da regra que recusou
const MENSAGEM_CHECK: Record<string, string> = {
  staff_nome_ok: 'Informe o nome completo, só com letras, espaço, apóstrofo, ponto ou hífen (sem endereço de site).',
  staff_cpf_ok: 'CPF inválido.',
  staff_rg_ok: 'Informe o RG.',
  staff_nascimento_ok: 'Data de nascimento inválida: é preciso ter 18 anos ou mais.',
  staff_cep_ok: 'CEP: 8 dígitos.',
  staff_endereco_ok: 'Endereço incompleto (rua, número, bairro e cidade).',
  staff_uf_ok: 'Escolha o estado (UF).',
  staff_email_secundario_ok: 'E-mail secundário inválido ou igual ao e-mail principal.',
  staff_telefones_ok: 'Telefone ou WhatsApp inválido.',
  staff_emergencia_ok: 'Contato de emergência incompleto (nome, parentesco e telefone).',
  staff_banco_ok: 'Dados bancários longos demais.',
  staff_pix_ok: 'A chave Pix não confere com o tipo escolhido.',
}
export function mensagemDoBanco(e: { code?: string; message?: string }) {
  if (e.code === '23514') return MENSAGEM_CHECK[e.message?.match(/constraint "([^"]+)"/)?.[1] ?? ''] ?? 'Dados do cadastro inválidos.'
  return 'Não foi possível salvar agora. Tente de novo.'
}

export const campo = 'w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/60 focus:outline-none focus:border-plum/40 focus-visible:ring-2 focus-visible:ring-plum/30 transition-colors disabled:opacity-50'
export const rotulo = 'text-xs font-medium text-espresso/80 mb-1.5 block'
