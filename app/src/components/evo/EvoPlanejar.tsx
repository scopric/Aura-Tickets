import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { GENEROS } from '../../lib/generos'
import { useCreateEvent } from '../../hooks/useEvents'
import { supabase } from '../../lib/supabase'

export interface PlanejarForm {
  genero: string
  publico: number
  cidade: string
  uf: string
  data?: string
  duracao_h: number
  preco_alvo?: number
  orcamento?: number
  layout?: 'em_pe' | 'mesas' | 'plateia'
}

export interface EventProposal {
  title: string
  description: string
  category: string
  genero: string
  date?: string
  time?: string
  venue_name?: string
  venue_city: string
  venue_state: string
  capacity: number
  tickets: { name: string; price: number; quantity: number }[]
}

const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']

const LAYOUTS = [
  { valor: 'em_pe', rotulo: 'Em pé' },
  { valor: 'mesas', rotulo: 'Mesas' },
  { valor: 'plateia', rotulo: 'Plateia' },
] as const

// Campos sobre o fundo escuro do painel: texto #fff sobre ~#1a2447 passa folgado do AA
const campo =
  'w-full rounded-lg bg-white/80 border border-slate-900/20 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-violet-600 focus-visible:ring-2 focus-visible:ring-violet-600/40 dark:bg-white/[0.07] dark:border-white/20 dark:text-white dark:placeholder:text-slate-400 dark:focus:border-violet-300 dark:focus-visible:ring-violet-300/60 disabled:opacity-60'
const rotulo = 'block text-xs font-medium text-slate-800 dark:text-slate-200 mb-1'

const inteiroEntre = (v: string, min: number, max: number) => {
  const n = Number(v)
  return Number.isInteger(n) && n >= min && n <= max ? n : null
}
// AAAA-MM-DD no fuso do navegador (o mesmo formato do <input type="date">)
const hojeLocal = () => new Date().toLocaleDateString('en-CA')
const opcionalNaoNegativo =(v: string) => (v.trim() === '' ? undefined : Number(v) >= 0 ? Number(v) : null)

export const FORM_PLANEJAR_VAZIO = { genero: '', publico: '', cidade: '', uf: '', data: '', duracao: '', preco: '', orcamento: '', layout: 'em_pe' }
export type CamposPlanejar = typeof FORM_PLANEJAR_VAZIO

/**
 * Formulário "Planejar meu primeiro evento": não usa IA até o envio; o servidor valida de novo.
 * Os campos (`f`) moram no EvoHub: fechar o painel não apaga o que foi digitado.
 */
export function FormPlanejar({ f, setF, onEnviar, onCancelar, desabilitado }: {
  f: CamposPlanejar
  setF: (f: CamposPlanejar) => void
  onEnviar: (form: PlanejarForm) => void
  onCancelar: () => void
  desabilitado: boolean
}) {
  const [erro, setErro] = useState('')
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })

  const enviar = (e: React.FormEvent) => {
    e.preventDefault()
    const publico = inteiroEntre(f.publico, 1, 200000)
    const duracao = inteiroEntre(f.duracao, 1, 48)
    const preco = opcionalNaoNegativo(f.preco)
    const orcamento = opcionalNaoNegativo(f.orcamento)
    const cidade = f.cidade.trim()
    if (!GENEROS.some((g) => g.valor === f.genero)) return setErro('Escolha o gênero do evento.')
    if (publico === null) return setErro('Público esperado: um número inteiro de 1 a 200.000.')
    if (cidade.length < 2 || cidade.length > 80) return setErro('Informe a cidade.')
    if (!UFS.includes(f.uf)) return setErro('Escolha o estado (UF).')
    if (duracao === null) return setErro('Duração: um número inteiro de 1 a 48 horas.')
    if (preco === null || orcamento === null) return setErro('Preço e orçamento não podem ser negativos.')
    setErro('')
    onEnviar({
      genero: f.genero, publico, cidade, uf: f.uf, duracao_h: duracao,
      layout: f.layout as PlanejarForm['layout'],
      ...(f.data && { data: f.data }),
      ...(preco !== undefined && { preco_alvo: preco }),
      ...(orcamento !== undefined && { orcamento }),
    })
  }

  return (
    <form onSubmit={enviar} className="space-y-3" aria-labelledby="evo-planejar-titulo">
      <div>
        <h3 id="evo-planejar-titulo" className="text-sm font-semibold">Planejar meu primeiro evento</h3>
        <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">Responda o básico e o Evo monta uma proposta de rascunho para você revisar.</p>
      </div>

      <div>
        <label htmlFor="evo-genero" className={rotulo}>Gênero</label>
        <select id="evo-genero" required value={f.genero} onChange={set('genero')} className={campo}>
          <option value="">Escolha…</option>
          {GENEROS.map((g) => <option key={g.valor} value={g.valor}>{g.rotulo}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="evo-publico" className={rotulo}>Público esperado</label>
          <input id="evo-publico" type="number" inputMode="numeric" required min={1} max={200000} step={1} value={f.publico} onChange={set('publico')} className={campo} />
        </div>
        <div>
          <label htmlFor="evo-duracao" className={rotulo}>Duração (horas)</label>
          <input id="evo-duracao" type="number" inputMode="numeric" required min={1} max={48} step={1} value={f.duracao} onChange={set('duracao')} className={campo} />
        </div>
      </div>

      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <div>
          <label htmlFor="evo-cidade" className={rotulo}>Cidade</label>
          <input id="evo-cidade" required maxLength={80} autoComplete="address-level2" value={f.cidade} onChange={set('cidade')} className={campo} />
        </div>
        <div>
          <label htmlFor="evo-uf" className={rotulo}>UF</label>
          <select id="evo-uf" required value={f.uf} onChange={set('uf')} className={campo}>
            <option value="">—</option>
            {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="evo-data" className={rotulo}>Data (opcional)</label>
          <input id="evo-data" type="date" min={hojeLocal()} value={f.data} onChange={set('data')} className={campo} />
        </div>
        <div>
          <label htmlFor="evo-layout" className={rotulo}>Formato</label>
          <select id="evo-layout" value={f.layout} onChange={set('layout')} className={campo}>
            {LAYOUTS.map((l) => <option key={l.valor} value={l.valor}>{l.rotulo}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="evo-preco" className={rotulo}>Preço-alvo R$ (opcional)</label>
          <input id="evo-preco" type="number" inputMode="decimal" min={0} step={0.01} value={f.preco} onChange={set('preco')} className={campo} />
        </div>
        <div>
          <label htmlFor="evo-orcamento" className={rotulo}>Orçamento R$ (opcional)</label>
          <input id="evo-orcamento" type="number" inputMode="decimal" min={0} step={0.01} value={f.orcamento} onChange={set('orcamento')} className={campo} />
        </div>
      </div>

      {erro && <p role="alert" className="text-xs text-rose-900 dark:text-rose-300">{erro}</p>}

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancelar} className="flex-1 rounded-full border border-slate-900/20 px-4 py-2 text-sm text-slate-800 hover:bg-slate-900/5 dark:border-white/20 dark:text-slate-100 dark:hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 dark:focus-visible:ring-violet-300">
          Voltar ao chat
        </button>
        <button type="submit" disabled={desabilitado} className="flex-1 rounded-full px-4 py-2 text-sm font-semibold text-[#fff] bg-gradient-to-r from-[#1d68c4] to-[#8f33f5] shadow-[0_4px_20px_rgba(59,130,246,0.3)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:ring-violet-600 dark:focus-visible:ring-offset-[#12142d] dark:focus-visible:ring-violet-300">
          Pedir proposta
        </button>
      </div>
    </form>
  )
}

const edicaoInicial = (proposta: EventProposal) => ({
  title: proposta.title ?? '',
  description: (proposta.description ?? '').slice(0, 2000),
  date: proposta.date ?? '',
  time: proposta.time ?? '',
  cidade: proposta.venue_city ?? '',
  uf: UFS.includes(proposta.venue_state) ? proposta.venue_state : '',
  capacity: String(proposta.capacity ?? ''),
  lotes: (proposta.tickets ?? []).map((t) => ({ name: t.name ?? '', price: String(t.price ?? ''), quantity: String(t.quantity ?? '') })),
})
export type EdicaoProposta = ReturnType<typeof edicaoInicial>
/** O que o card grava na própria mensagem (via setMensagens do EvoHub) */
export type MudancaProposta = { edicao?: EdicaoProposta; criando?: boolean; criadoId?: string; semLotes?: boolean }

/**
 * Proposta do Evo, editável; só vira rascunho no clique do produtor (regra: nada é criado sozinho).
 * Edições e "criando" ficam na mensagem, não no card: o Radix desmonta o conteúdo ao fechar o
 * painel, e estado local perderia as edições e deixaria criar o rascunho duas vezes.
 */
export function PropostaCard({ proposta, usageId, edicao, criando, criadoId, semLotes, onMudar }: {
  proposta: EventProposal
  usageId?: string
  edicao?: EdicaoProposta
  criando?: boolean
  criadoId?: string
  semLotes?: boolean
  onMudar: (m: MudancaProposta) => void
}) {
  const criar = useCreateEvent()
  const id = useId()
  const p = edicao ?? edicaoInicial(proposta)
  const lotes = p.lotes
  const [erro, setErro] = useState('')
  const set = (k: Exclude<keyof EdicaoProposta, 'lotes'>) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onMudar({ edicao: { ...p, [k]: e.target.value } })
  const setLote = (i: number, k: 'name' | 'price' | 'quantity') => (e: React.ChangeEvent<HTMLInputElement>) =>
    onMudar({ edicao: { ...p, lotes: lotes.map((l, j) => (j === i ? { ...l, [k]: e.target.value } : l)) } })

  if (criadoId) {
    return (
      <div className={`mt-2 flex items-center gap-3 rounded-2xl border p-3 ${semLotes ? 'border-amber-600/40 bg-amber-50/90 dark:border-amber-300/30 dark:bg-amber-400/10' : 'border-emerald-600/40 bg-emerald-50/90 dark:border-emerald-300/30 dark:bg-emerald-400/10'}`} role="status">
        <img src="/evo/evo-corpo-joinha.webp" alt="" width={47} height={78} className="h-[78px] w-auto shrink-0" />
        <div className="space-y-1">
          {semLotes ? (
            <p className="text-sm font-semibold">Rascunho criado sem os lotes — abra o evento para completar</p>
          ) : (
            <>
              <p className="text-sm font-semibold">Rascunho criado!</p>
              <p className="text-xs text-slate-700 dark:text-slate-200">Ele fica em rascunho até você revisar e enviar para aprovação.</p>
            </>
          )}
          <Link to={`/producer/events/${criadoId}/edit`} className="inline-block text-sm font-semibold text-violet-900 underline underline-offset-2 hover:text-violet-950 dark:text-violet-200 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 dark:focus-visible:ring-violet-300 rounded">
            Abrir rascunho
          </Link>
        </div>
      </div>
    )
  }

  const confirmar = async () => {
    if (criando) return
    const capacity = inteiroEntre(p.capacity, 1, 200000)
    const tickets = lotes.map((l) => ({ name: l.name.trim(), price: Number(l.price), capacity: inteiroEntre(l.quantity, 1, 200000) }))
    if (!p.title.trim()) return setErro('Dê um título ao evento.')
    if (p.description.length > 2000) return setErro('Descrição: no máximo 2.000 caracteres.')
    if (!p.cidade.trim() || !UFS.includes(p.uf)) return setErro('Confira cidade e UF.')
    if (p.date && p.date < hojeLocal()) return setErro('A data do evento já passou.')
    if (capacity === null) return setErro('Capacidade: um número inteiro de 1 a 200.000.')
    if (tickets.some((t) => !t.name || !(t.price >= 0) || t.capacity === null)) return setErro('Cada lote precisa de nome, preço (0 ou mais) e quantidade (1 ou mais).')
    setErro('')
    onMudar({ criando: true })
    // Evento e lotes em dois passos: se os lotes falharem, o id do evento já criado fica guardado
    // e o card não deixa criar outro (o useCreateEvent perderia o id ao lançar o erro dos lotes)
    let eventoId: string | null = null
    try {
      const evento = await criar.mutateAsync({
        event: {
          title: p.title.trim(),
          description: p.description.trim(),
          category: proposta.category,
          date: p.date || null,
          time: p.time || null,
          // sem isto o useCreateEvent grava a hora da criação como início do evento
          ...(p.date ? { start_date: new Date(`${p.date}T${p.time || '20:00'}`).toISOString() } : {}),
          venue_name: proposta.venue_name || null,
          venue_city: p.cidade.trim(),
          venue_state: p.uf,
          capacity,
          status: 'draft',
          settings: { genero: proposta.genero, uf: p.uf, origem: 'evo', ai_usage_id: usageId ?? null },
        },
        tickets: [],
      })
      // os tipos gerados do banco ainda devolvem `never` para events (erro herdado de useEvents)
      eventoId = (evento as { id: string }).id
      if (tickets.length > 0) {
        // mesmos campos do useCreateEvent (sem lot_number: Decisão 20); `as never`: os tipos gerados
        // do banco devolvem never para ticket_types (mesmo erro herdado em useEvents)
        const { error } = await supabase.from('ticket_types').insert(tickets.map((t) => ({
          event_id: eventoId!, name: t.name, description: null, price: t.price,
          capacity: t.capacity, quantity_total: t.capacity!, sold: 0, quantity_sold: 0,
          type: 'individual', perks: [], is_active: true,
        })) as never)
        if (error) throw error
      }
      onMudar({ criadoId: eventoId, semLotes: false, criando: false })
    } catch (e) {
      console.error('[Evo] criar rascunho', e)
      if (eventoId) onMudar({ criadoId: eventoId, semLotes: true, criando: false })
      else {
        onMudar({ criando: false })
        setErro('Não foi possível criar o rascunho. Tente de novo.')
      }
    }
  }

  return (
    <div className="mt-2 space-y-3 rounded-2xl border border-violet-600/25 bg-violet-50/90 p-3 dark:border-violet-300/25 dark:bg-[#1b1646]">
      <p className="text-sm font-semibold">Proposta de rascunho</p>
      <div>
        <label htmlFor={`evo-p-titulo-${id}`} className={rotulo}>Título</label>
        <input id={`evo-p-titulo-${id}`} value={p.title} onChange={set('title')} maxLength={120} className={campo} />
      </div>
      <p className="text-xs text-slate-700 dark:text-slate-200">
        <span className="font-medium">Categoria:</span> {proposta.category}
      </p>
      <div>
        <label htmlFor={`evo-p-desc-${id}`} className={rotulo}>Descrição</label>
        <textarea id={`evo-p-desc-${id}`} value={p.description} onChange={set('description')} maxLength={2000} rows={4} className={`${campo} resize-y`} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={`evo-p-data-${id}`} className={rotulo}>Data</label>
          <input id={`evo-p-data-${id}`} type="date" min={hojeLocal()} value={p.date} onChange={set('date')} className={campo} />
        </div>
        <div>
          <label htmlFor={`evo-p-hora-${id}`} className={rotulo}>Horário</label>
          <input id={`evo-p-hora-${id}`} type="time" value={p.time} onChange={set('time')} className={campo} />
        </div>
      </div>
      <div className="grid grid-cols-[1fr_5rem_6rem] gap-2">
        <div>
          <label htmlFor={`evo-p-cidade-${id}`} className={rotulo}>Cidade</label>
          <input id={`evo-p-cidade-${id}`} value={p.cidade} onChange={set('cidade')} maxLength={80} className={campo} />
        </div>
        <div>
          <label htmlFor={`evo-p-uf-${id}`} className={rotulo}>UF</label>
          <select id={`evo-p-uf-${id}`} value={p.uf} onChange={set('uf')} className={campo}>
            <option value="">—</option>
            {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`evo-p-cap-${id}`} className={rotulo}>Capacidade</label>
          <input id={`evo-p-cap-${id}`} type="number" inputMode="numeric" min={1} max={200000} step={1} value={p.capacity} onChange={set('capacity')} className={campo} />
        </div>
      </div>

      {lotes.length > 0 && (
        <fieldset className="space-y-1.5">
          <legend className={rotulo}>Lotes (preço sugerido: você decide)</legend>
          {lotes.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_5.5rem_4.5rem] gap-2">
              <input aria-label={`Nome do lote ${i + 1}`} value={l.name} onChange={setLote(i, 'name')} maxLength={60} className={campo} />
              <input aria-label={`Preço do lote ${i + 1} em reais`} type="number" inputMode="decimal" min={0} step={0.01} value={l.price} onChange={setLote(i, 'price')} className={campo} />
              <input aria-label={`Quantidade do lote ${i + 1}`} type="number" inputMode="numeric" min={1} step={1} value={l.quantity} onChange={setLote(i, 'quantity')} className={campo} />
            </div>
          ))}
        </fieldset>
      )}

      {erro && <p role="alert" className="text-xs text-rose-900 dark:text-rose-300">{erro}</p>}

      <button type="button" onClick={confirmar} disabled={criando} className="flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-[#fff] bg-gradient-to-r from-[#1d68c4] to-[#8f33f5] shadow-[0_4px_20px_rgba(59,130,246,0.3)] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:ring-violet-600 dark:focus-visible:ring-offset-[#1b1646] dark:focus-visible:ring-violet-300">
        {criando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Criar rascunho do evento
      </button>
      <p className="text-center text-[11px] text-slate-700 dark:text-slate-300">Nada é criado sem o seu clique.</p>
    </div>
  )
}
