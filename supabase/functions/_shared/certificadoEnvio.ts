// Regras do envio do certificado por e-mail (certificado-enviar). Sem dependência de Deno, para o vitest.
export const LIMITE_POR_CERTIFICADO_POR_HORA = 1; // o mesmo certificado não sai duas vezes na mesma hora
export const LIMITE_POR_CERTIFICADO_POR_DIA = 3; // o mesmo participante não recebe e-mail do mesmo certificado a cada hora, para sempre
export const LIMITE_POR_PRODUTOR_POR_HORA = 30; // por produtor, em todos os certificados

/** Conta só as tentativas que valem ('pending' e 'sent'), INCLUINDO a que acabou de ser registrada: `noCertificado` e `doProdutor` na última hora, `noCertificadoDia` nas últimas 24 h. */
export function decidirLimite(noCertificado: number, doProdutor: number, noCertificadoDia = 0): null | { status: 429; erro: string } {
  if (noCertificado > LIMITE_POR_CERTIFICADO_POR_HORA) return { status: 429, erro: "Este certificado já foi enviado na última hora. Tente de novo mais tarde." };
  if (noCertificadoDia > LIMITE_POR_CERTIFICADO_POR_DIA) return { status: 429, erro: `Este certificado já foi enviado ${LIMITE_POR_CERTIFICADO_POR_DIA} vezes hoje. Tente de novo amanhã.` };
  if (doProdutor > LIMITE_POR_PRODUTOR_POR_HORA) return { status: 429, erro: `Limite de ${LIMITE_POR_PRODUTOR_POR_HORA} envios de certificado por hora atingido. Tente de novo mais tarde.` };
  return null;
}

export const uuidValido = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
/** Carga horária só se for um número curto (a mesma regra da função do banco). */
export const horasValidas = (v: unknown): string | null => (typeof v === "string" && /^[0-9]{1,4}$/.test(v) ? v : null);

/** Tira endereço de e-mail de mensagem de erro de terceiros (Resend) antes de gravar ou logar: o registro de envios não guarda dado pessoal. */
export const semEmail = (msg: string): string => msg.replace(/[^\s<>"'(),;:]+@[^\s<>"'(),;:]+/g, "[e-mail]");
