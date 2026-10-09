import { supabase } from './supabase'

// Certificado pelo código (docs/sql/20261101a_certificado_ver_e_envio.sql: certificado_ver, que devolve o mesmo de certificado_validar
// mais o modelo de desenho): quem tem o código confere nome, evento, data, organizador, emissão e carga horária, e vê o certificado. Código inexistente, mal formado, revogado, de evento não aprovado ou de titular sem ingresso
// válido voltam IGUAIS ({ valido: false }) de propósito: a página não diz qual dos casos foi.
export interface CertificadoValido {
  valido: true
  nome: string | null
  evento: string
  data_evento: string // AAAA-MM-DD
  organizador: string | null
  emitido_em: string // AAAA-MM-DD
  horas: string | null
  /** modelo de desenho (certificates.template, só as chaves conhecidas). BRUTO: passar por sanearTemplate antes de usar; null = só a validação */
  modelo: unknown | null
}
export type ResultadoValidacao = CertificadoValido | { valido: false }

/** Endereço que o QR do certificado leva. Fixo no domínio do app: o PDF impresso de uma prévia da Vercel não pode apontar para ela. */
export const BASE_VALIDACAO = 'https://app.evokaa.com.br'
export const urlDoCertificado = (codigo: string) => `${BASE_VALIDACAO}/certificado/${encodeURIComponent(codigo)}`

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const codigoValido = (c: string) => UUID.test(c)

const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : null)
const dia = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)

/** Consulta o banco e devolve só campos conhecidos e do tipo certo (o resto da resposta é ignorado). Erro de rede ou do banco lança. */
export async function validarCertificado(codigo: string): Promise<ResultadoValidacao> {
  const c = codigo.trim()
  if (!codigoValido(c)) return { valido: false } // nem chega ao banco
  // ponytail: os tipos do banco ainda não têm a função; cast até regenerar types/database.ts
  const { data, error } = await supabase.rpc('certificado_ver' as never, { p_code: c } as never)
  if (error) throw error
  const r = (data ?? {}) as Record<string, unknown>
  const evento = texto(r.evento), emitido = dia(r.emitido_em), data_evento = dia(r.data_evento)
  if (r.valido !== true || !evento || !emitido || !data_evento) return { valido: false }
  return {
    valido: true, nome: texto(r.nome), evento, data_evento, organizador: texto(r.organizador), emitido_em: emitido,
    horas: typeof r.horas === 'string' && /^\d{1,4}$/.test(r.horas) ? r.horas : null,
    modelo: r.modelo && typeof r.modelo === 'object' && !Array.isArray(r.modelo) ? r.modelo : null,
  }
}
