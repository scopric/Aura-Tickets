import { supabase } from './supabase'

// Envio do certificado por e-mail (Edge Function certificado-enviar, docs/sql/20261101a_certificado_ver_e_envio.sql): o produtor manda; quem é dono,
// o destinatário e o conteúdo vêm do banco. 1 envio por certificado e 30 por produtor a cada hora.
export type ResultadoEnvio = { ok: true } | { ok: false; status: number; erro: string }

export async function enviarCertificadoPorEmail(issuedId: string): Promise<ResultadoEnvio> {
  const { error } = await supabase.functions.invoke('certificado-enviar', { body: { issuedId } })
  if (!error) return { ok: true }
  const resp = (error as { context?: Response }).context
  let erro = 'Não foi possível enviar o e-mail. Tente de novo em instantes.'
  try { const corpo = await resp?.json(); if (typeof corpo?.error === 'string') erro = corpo.error } catch { /* resposta sem JSON: fica o texto padrão */ }
  return { ok: false, status: resp?.status ?? 0, erro }
}

export interface ResumoLote { enviados: number; naoEnviados: number; motivo: string | null; parouNoLimite: boolean }

/** Envia um por vez. Problema de uma pessoa (sem ingresso, sem e-mail) não para o lote; limite (429), acesso (401/403) ou erro de servidor param. */
export async function enviarEmLote(ids: string[], enviar: (id: string) => Promise<ResultadoEnvio> = enviarCertificadoPorEmail): Promise<ResumoLote> {
  const r: ResumoLote = { enviados: 0, naoEnviados: 0, motivo: null, parouNoLimite: false }
  for (let i = 0; i < ids.length; i++) {
    const x = await enviar(ids[i])
    if (x.ok) { r.enviados++; continue }
    r.naoEnviados++
    r.motivo ??= x.erro
    if (x.status === 429 || x.status === 401 || x.status === 403 || x.status >= 500 || x.status === 0) {
      r.parouNoLimite = x.status === 429
      r.naoEnviados += ids.length - i - 1 // o que sobrou não foi tentado
      break
    }
  }
  return r
}
