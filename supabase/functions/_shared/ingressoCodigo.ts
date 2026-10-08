// Código de entrada que muda a cada 30 s (Decisão 211, plano "página do ingresso e QR dinâmico"). Só WebCrypto, sem dependência de Deno.
//
//   chave do ingresso = HMAC-SHA256(INGRESSO_SEGREDO, "evk1|<ticket_id>|<transfer_count>")
//   código da janela w = 40 bits de HMAC-SHA256(chave do ingresso, w) em base32 (8 caracteres), com w = floor(unix_s / 30)
//   QR = "E1.<ticket_id sem hífens>.<código>"  (E1 = versão: permite girar o segredo ou o formato)
//
// O segredo mestre nunca sai do servidor. O celular recebe só a LISTA de códigos das próximas horas (função ingresso-codigo): sem segredo no aparelho.
// `transfer_count` entra na chave: transferir o ingresso invalida a lista de quem transferiu. Quem valida usa o relógio do servidor.
export const PASSO_S = 30;
export const TOLERANCIA = 1; // janelas para trás e para frente (validade efetiva ~90 s)
export const PREFIXO = "E1";
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const enc = new TextEncoder();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const importar = (chave: Uint8Array) => crypto.subtle.importKey("raw", new Uint8Array(chave), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
const assinar = async (k: CryptoKey, dado: string): Promise<Uint8Array> => new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(dado)));
const hmac = async (chave: Uint8Array, dado: string) => await assinar(await importar(chave), dado);

/** Chave do ingresso. O segredo precisa ter pelo menos 32 caracteres; falha alto em vez de gerar código fraco. */
export async function chaveDoIngresso(segredo: string, ticketId: string, transferCount: number): Promise<Uint8Array> {
  if (typeof segredo !== "string" || segredo.length < 32) throw new Error("INGRESSO_SEGREDO ausente ou curto demais");
  if (!UUID.test(ticketId) || !Number.isInteger(transferCount) || transferCount < 0) throw new Error("ingresso inválido");
  return await hmac(enc.encode(segredo), `evk1|${ticketId.toLowerCase()}|${transferCount}`);
}

export const janelaDe = (ms: number): number => Math.floor(ms / 1000 / PASSO_S);

// 5 bytes = 40 bits = 8 símbolos de 5 bits
function base32de40(h: Uint8Array): string {
  let bits = 0, acc = 0, out = "";
  for (let i = 0; i < 5; i++) {
    acc = (acc << 8) | h[i]; bits += 8;
    while (bits >= 5) { out += B32[(acc >>> (bits - 5)) & 31]; bits -= 5; }
    acc &= (1 << bits) - 1;
  }
  return out;
}

/** Código (8 caracteres base32) de uma janela. */
export async function codigoDaJanela(chave: Uint8Array, janela: number): Promise<string> {
  return base32de40(await hmac(chave, String(janela)));
}

/** Códigos de `quantas` janelas seguidas a partir da janela de `deMs`. A chave é importada uma vez. */
export async function listaDeCodigos(chave: Uint8Array, deMs: number, quantas: number): Promise<{ primeiraJanela: number; codigos: string[] }> {
  const k = await importar(chave);
  const primeiraJanela = janelaDe(deMs);
  const codigos: string[] = [];
  for (let i = 0; i < quantas; i++) codigos.push(base32de40(await assinar(k, String(primeiraJanela + i))));
  return { primeiraJanela, codigos };
}

export const prefixoDoQr = (ticketId: string): string => `${PREFIXO}.${ticketId.replaceAll("-", "").toLowerCase()}.`;

/** Lê o QR lido na portaria. null se não tem o formato. O id volta com hífens; o código em maiúsculas. */
export function lerQr(s: unknown): { ticketId: string; codigo: string } | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  if (t.length > 60) return null;
  const m = /^E1\.([0-9a-f]{32})\.([A-Za-z2-7]{8})$/i.exec(t);
  if (!m) return null;
  const h = m[1].toLowerCase();
  return { ticketId: `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`, codigo: m[2].toUpperCase() };
}

// Compara sem parar no primeiro erro (mesmo tamanho: 8).
function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** O código vale agora? Aceita a janela atual e `tolerancia` janelas para cada lado, e olha todas (sem parar no primeiro acerto). */
export async function verificar(segredo: string, ticketId: string, transferCount: number | null, codigo: unknown, agoraMs: number, tolerancia = TOLERANCIA): Promise<boolean> {
  if (typeof codigo !== "string") return false;
  const alvo = codigo.toUpperCase();
  const k = await importar(await chaveDoIngresso(segredo, ticketId, transferCount ?? 0)); // coluna sem NOT NULL: nulo = 0, como em ingresso-codigo
  const w = janelaDe(agoraMs);
  let ok = false;
  for (let d = -tolerancia; d <= tolerancia; d++) {
    if (iguais(base32de40(await assinar(k, String(w + d))), alvo)) ok = true;
  }
  return ok;
}
