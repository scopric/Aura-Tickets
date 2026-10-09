// reCAPTCHA v3 do checkout Pix. A chave é PÚBLICA (VITE_RECAPTCHA_SITE_KEY); o segredo fica só na Edge Function.
// Cada tentativa de pagamento precisa de um token novo: o Google recusa token repetido. A ação tem de ser a que a função confere.
type Grecaptcha = { ready: (cb: () => void) => void; execute: (chave: string, o: { action: string }) => Promise<string> }
const ACAO = 'pagbank_checkout'
let carregando: Promise<void> | null = null

function carregar(chave: string): Promise<void> {
  carregando ??= new Promise<void>((ok, falha) => {
    const s = document.createElement('script')
    s.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(chave)}`
    s.async = true
    s.onload = () => ok()
    s.onerror = () => { carregando = null; s.remove(); falha(new Error('Não foi possível carregar a verificação de segurança. Confira a conexão e tente de novo.')) }
    document.head.appendChild(s)
  })
  return carregando
}

export async function tokenRecaptcha(): Promise<string> {
  const chave = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined
  if (!chave) throw new Error('Pagamento indisponível')
  await carregar(chave)
  const g = (window as unknown as { grecaptcha?: Grecaptcha }).grecaptcha
  if (!g) throw new Error('Pagamento indisponível')
  await new Promise<void>(r => g.ready(r))
  return g.execute(chave, { action: ACAO })
}
