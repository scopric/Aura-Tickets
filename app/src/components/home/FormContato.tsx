import { useEffect, useId, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useContact } from '../../hooks/useContact'

// Formulário de contato da Home v3 (Decisão 253). Mesmo envio de /contato: useContact → Edge Function send-email,
// que valida e limita por IP. Aqui o erro é marcado no próprio campo (aria-invalid + aria-describedby), não só no toast.
// Campos no DESIGN-SYSTEM §6: raio 5, contorno #999, 16 px em corpo, rótulo 12 px em chrome, foco em anel branco.

const FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ev3-foco focus-visible:ring-offset-2 focus-visible:ring-offset-black'
const CAMPO = `w-full rounded-ev3-controle border bg-transparent px-3 py-3 font-ev3-corpo text-[16px] leading-[1.5] text-ev3-texto ${FOCO}`
const ROTULO = 'mb-1.5 block font-ev3-chrome text-[12px] leading-[1.5] text-ev3-terciario'
const ASSUNTOS = [
  ['Quero criar um evento', 'Quero criar um evento'],
  ['Quero ser parceiro/afiliado', 'Quero ser afiliado'],
  ['Problemas com suporte técnico', 'Suporte técnico'],
  ['Proposta comercial ou parcerias', 'Proposta de parceria'],
  ['Outro assunto', 'Outro assunto'],
] as const

// Mesma regra de e-mail da Edge Function (supabase/functions/_shared/validar.ts): o servidor é a barreira; aqui é
// só para o erro aparecer no campo, e não voltar como aviso depois do envio
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/
// eslint-disable-next-line no-control-regex -- os caracteres de controle são o que se quer barrar
const EMAIL_PROIBIDO = /[?&#\u0000-\u001F\u007F]/

const VAZIO = { name: '', email: '', phone: '', subject: '', message: '' }
type Campo = keyof typeof VAZIO
type Erros = Partial<Record<Campo, string>>

const validar = (f: typeof VAZIO): Erros => {
  const e: Erros = {}
  if (!f.name.trim()) e.name = 'Informe seu nome.'
  const email = f.email.trim()
  if (!EMAIL_RE.test(email) || EMAIL_PROIBIDO.test(email) || email.length > 254) e.email = 'Informe um e-mail válido.'
  if (!f.phone.trim()) e.phone = 'Informe um celular.'
  if (!f.message.trim()) e.message = 'Escreva a mensagem.'
  return e
}

export default function FormContato() {
  const id = useId()
  const [form, setForm] = useState(VAZIO)
  const [erros, setErros] = useState<Erros>({})
  const [enviado, setEnviado] = useState(false)
  const okRef = useRef<HTMLParagraphElement>(null)
  const { mutateAsync: enviar, isPending } = useContact()
  // o botão que tinha o foco sai da tela com o envio: o foco vai para a confirmação, que o leitor de tela anuncia
  useEffect(() => { if (enviado) okRef.current?.focus() }, [enviado])

  const muda = (campo: Campo) => (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [campo]: ev.target.value }))
    if (erros[campo]) setErros(e => ({ ...e, [campo]: undefined }))
  }
  // id, estado de erro e ligação com a mensagem de erro de cada campo
  const a11y = (campo: Campo) => ({
    id: `${id}-${campo}`,
    'aria-required': campo !== 'subject' || undefined,
    'aria-invalid': erros[campo] ? true : undefined,
    'aria-describedby': erros[campo] ? `${id}-${campo}-erro` : undefined,
    className: `${CAMPO} ${erros[campo] ? 'border-ev3-erro' : 'border-ev3-contorno'}`,
  })
  const erro = (campo: Campo) =>
    erros[campo] ? <p id={`${id}-${campo}-erro`} className="mt-1.5 font-ev3-chrome text-[12px] leading-[1.5] text-ev3-erro">{erros[campo]}</p> : null

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (isPending) return
    const e = validar(form)
    setErros(e)
    const primeiro = (Object.keys(e) as Campo[])[0]
    if (primeiro) {
      document.getElementById(`${id}-${primeiro}`)?.focus()
      return
    }
    try {
      await enviar({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        subject: form.subject || 'Contato Geral (Home)',
        message: form.message.trim(),
      })
      setEnviado(true)
    } catch (err) {
      console.error('[FormContato]', err)
      toast.error((err as { mensagem?: string })?.mensagem || 'Não foi possível enviar. Tente de novo em instantes.')
    }
  }

  if (enviado) {
    return (
      <p ref={okRef} tabIndex={-1} role="status" className={`text-[16px] leading-[1.88] text-ev3-texto ${FOCO}`}>
        Mensagem enviada. Respondemos pelo e-mail que você informou.
      </p>
    )
  }

  return (
    // color-scheme escuro: no tema claro do site o index.css deixaria a lista do select branca sobre o preto
    <form onSubmit={onSubmit} noValidate className="grid gap-5 [color-scheme:dark]" aria-labelledby="contato-titulo">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-name`} className={ROTULO}>Nome</label>
          <input type="text" autoComplete="name" maxLength={120} value={form.name} onChange={muda('name')} {...a11y('name')} />
          {erro('name')}
        </div>
        <div>
          <label htmlFor={`${id}-email`} className={ROTULO}>E-mail</label>
          <input type="email" autoComplete="email" maxLength={254} value={form.email} onChange={muda('email')} {...a11y('email')} />
          {erro('email')}
        </div>
        <div>
          <label htmlFor={`${id}-phone`} className={ROTULO}>Celular</label>
          <input type="tel" autoComplete="tel" maxLength={30} value={form.phone} onChange={muda('phone')} {...a11y('phone')} />
          {erro('phone')}
        </div>
        <div>
          <label htmlFor={`${id}-subject`} className={ROTULO}>Assunto (opcional)</label>
          <select value={form.subject} onChange={muda('subject')} {...a11y('subject')} className={`${a11y('subject').className} h-[50px]`}>
            <option value="">Escolha, se quiser</option>
            {ASSUNTOS.map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor={`${id}-message`} className={ROTULO}>Mensagem</label>
        <textarea rows={5} maxLength={5000} value={form.message} onChange={muda('message')} {...a11y('message')} />
        {erro('message')}
      </div>
      <div>
        <button
          type="submit"
          aria-disabled={isPending || undefined}
          className={`inline-flex h-12 w-full items-center justify-center rounded-ev3-controle border px-[18px] font-ev3-chrome text-[14px] font-bold leading-[1.2] tracking-normal transition-colors [transition-duration:var(--ev3-mov-micro)] [transition-timing-function:var(--ev3-curva-sai)] sm:w-auto ${isPending ? 'border-ev3-fio text-ev3-terciario' : 'border-ev3-contorno text-ev3-texto hover:bg-ev3-vidro'} ${FOCO}`}
        >
          {isPending ? 'Enviando…' : 'Enviar mensagem'}
        </button>
      </div>
    </form>
  )
}
