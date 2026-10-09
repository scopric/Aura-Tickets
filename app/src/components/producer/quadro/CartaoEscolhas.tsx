import { useState, type FormEvent } from 'react'
import { ptBR } from 'react-day-picker/locale'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { mensagemSegura, type EtiquetaQuadro, type LocalCartao } from '../../../hooks/useCartao'
import { AvatarPessoa, ChipEtiqueta } from './pecas'
import { PALETA } from './cartaoLib'
import type { Pessoa } from './useEquipe'

const alvo = 'min-h-11 sm:min-h-8'
type Mut<V> = { mutate: (v: V, o: { onError: (e: Error) => void }) => void }

/** Linha de checkbox com rótulo clicável (alvo de 44 px no celular) */
function Linha({ id, marcado, onMudar, desabilitado, children }: { id: string; marcado: boolean; onMudar: (v: boolean) => void; desabilitado?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn('flex flex-1 items-center gap-2 rounded-md px-1', alvo)}>
      <Checkbox id={id} checked={marcado} disabled={desabilitado} onCheckedChange={v => onMudar(v === true)} />
      <Label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-1 font-normal">{children}</Label>
    </div>
  )
}

/** `pronto` = o resumo do cartão já chegou; antes disso ninguém pode ser ligado ou desligado */
export function EscolhaMembros({ pessoas, atuais, alternar, pronto }: { pessoas: Pessoa[]; atuais: string[]; alternar: (id: string, ligar: boolean) => void; pronto: boolean }) {
  return (
    <fieldset className="grid gap-1">
      <legend className="mb-1 text-sm font-medium">Membros do cartão</legend>
      {!pronto && <p role="status" className="text-sm text-muted-foreground">Carregando membros…</p>}
      {pessoas.map(p => (
        <Linha key={p.id} id={`membro-${p.id}`} marcado={atuais.includes(p.id)} desabilitado={!pronto}
          onMudar={on => alternar(p.id, on)}>
          <AvatarPessoa nome={p.nome} className="size-6" decorativo /><span className="truncate">{p.nome}</span>
        </Linha>
      ))}
      {pessoas.length === 0 && <p className="text-sm text-muted-foreground">Ninguém na equipe ainda.</p>}
    </fieldset>
  )
}

function Cores({ valor, onEscolher, nome }: { valor: string; onEscolher: (c: string) => void; nome: string }) {
  return (
    <div role="radiogroup" aria-label={nome} className="flex flex-wrap gap-2">
      {PALETA.map(c => (
        <button key={c} type="button" role="radio" aria-checked={valor.toLowerCase() === c} aria-label={c}
          onClick={() => onEscolher(c)} style={{ background: c }}
          className={cn('size-9 rounded-full ring-offset-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-7', valor.toLowerCase() === c && 'ring-2 ring-foreground')} />
      ))}
    </div>
  )
}

export function EscolhaEtiquetas({ etiquetas, ligadas, alternar, criar, editar, apagar, carregando }: {
  etiquetas: EtiquetaQuadro[]; ligadas: string[]; carregando: boolean
  alternar: (e: EtiquetaQuadro, ligar: boolean) => void
  criar: Mut<{ name: string; color: string }>; editar: Mut<{ id: string; name?: string; color?: string }>; apagar: Mut<string>
}) {
  const [nome, setNome] = useState('')
  const [cor, setCor] = useState(PALETA[0])
  const [editando, setEditando] = useState<string | null>(null)
  const [novoNome, setNovoNome] = useState('')
  const erro = (e: Error) => toast.error(mensagemSegura(e))
  const enviar = (e: FormEvent) => { e.preventDefault(); criar.mutate({ name: nome, color: cor }, { onError: erro }); setNome('') }
  const salvarNome = (e: FormEvent, id: string) => { e.preventDefault(); editar.mutate({ id, name: novoNome }, { onError: erro }); setEditando(null) }

  return (
    <div className="grid gap-3">
      <p className="text-sm font-medium">Etiquetas</p>
      {carregando && <p role="status" className="text-sm text-muted-foreground">Carregando etiquetas…</p>}
      {!carregando && etiquetas.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma etiqueta neste quadro. Crie a primeira abaixo.</p>}
      <ul className="grid gap-1">
        {etiquetas.map(e => (
          <li key={e.id} className="flex items-center gap-1">
            {editando === e.id ? (
              <form onSubmit={ev => salvarNome(ev, e.id)} className="flex flex-1 items-center gap-1">
                <Input aria-label={`Novo nome da etiqueta ${e.name}`} value={novoNome} maxLength={30} onChange={ev => setNovoNome(ev.target.value)} className="h-11 sm:h-8" autoFocus />
                <Button type="submit" size="sm" className={alvo}>Salvar</Button>
                <Button type="button" variant="ghost" size="sm" className={alvo} onClick={() => setEditando(null)}>Cancelar</Button>
              </form>
            ) : (
              <>
                <Linha id={`etq-${e.id}`} marcado={ligadas.includes(e.id)} onMudar={on => alternar(e, on)}><ChipEtiqueta nome={e.name} cor={e.color} /></Linha>
                <Button variant="ghost" size="icon-sm" className="size-11 sm:size-8" aria-label={`Renomear a etiqueta ${e.name}`} onClick={() => { setEditando(e.id); setNovoNome(e.name) }}><I.Editar aria-hidden="true" /></Button>
                <Button variant="ghost" size="icon-sm" className="size-11 sm:size-8" aria-label={`Apagar a etiqueta ${e.name}`} onClick={() => apagar.mutate(e.id, { onError: erro })}><I.Lixeira aria-hidden="true" /></Button>
              </>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={enviar} className="grid gap-2 border-t border-border pt-3">
        <Label htmlFor="etq-nova">Nova etiqueta</Label>
        <Input id="etq-nova" value={nome} maxLength={30} onChange={e => setNome(e.target.value)} placeholder="Ex.: Financeiro" className="h-11 text-base sm:h-9 sm:text-sm" />
        <Cores valor={cor} onEscolher={setCor} nome="Cor da etiqueta" />
        <Button type="submit" size="sm" className={alvo} disabled={!nome.trim()}>Criar etiqueta</Button>
      </form>
    </div>
  )
}

export function EscolhaChecklist({ criar }: { criar: (titulo: string) => void }) {
  const [t, setT] = useState('Checklist')
  return (
    <form onSubmit={e => { e.preventDefault(); criar(t) }} className="grid gap-2">
      <Label htmlFor="ck-novo">Título da lista</Label>
      <Input id="ck-novo" value={t} maxLength={80} onChange={e => setT(e.target.value)} className="h-11 text-base sm:h-9 sm:text-sm" />
      <Button type="submit" size="sm" className={alvo} disabled={!t.trim()}>Adicionar lista</Button>
    </form>
  )
}

const paraData = (dia: string | null | undefined) => (dia ? new Date(+dia.slice(0, 4), +dia.slice(5, 7) - 1, +dia.slice(8, 10)) : undefined)
const doDia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** `inicio` e `prazo` são dias AAAA-MM-DD (prazo no dia de Brasília) */
export function EscolhaDatas({ inicio, prazo, salvar }: { inicio: string | null; prazo: string | null; salvar: (campo: 'inicio' | 'prazo', dia: string | null) => void }) {
  const [campo, setCampo] = useState<'prazo' | 'inicio'>('prazo')
  const atual = campo === 'prazo' ? prazo : inicio
  return (
    <div className="grid gap-2">
      <div role="group" aria-label="Qual data" className="flex gap-1">
        {(['prazo', 'inicio'] as const).map(c => (
          <Button key={c} type="button" size="sm" variant={campo === c ? 'secondary' : 'ghost'} aria-pressed={campo === c} className={alvo} onClick={() => setCampo(c)}>{c === 'prazo' ? 'Prazo' : 'Início'}</Button>
        ))}
      </div>
      <Calendar mode="single" locale={ptBR} selected={paraData(atual)} defaultMonth={paraData(atual)} onSelect={d => salvar(campo, d ? doDia(d) : null)} />
      <Button type="button" variant="outline" size="sm" className={alvo} disabled={!atual} onClick={() => salvar(campo, null)}>Remover {campo === 'prazo' ? 'prazo' : 'início'}</Button>
    </div>
  )
}

export function EscolhaCapa({ capa, salvar }: { capa: string | null | undefined; salvar: (cor: string | null) => void }) {
  return (
    <div className="grid gap-3">
      <p className="text-sm font-medium">Cor da capa</p>
      <Cores valor={capa ?? ''} onEscolher={salvar} nome="Cor da capa" />
      <Button type="button" variant="outline" size="sm" className={alvo} disabled={!capa} onClick={() => salvar(null)}>Remover capa</Button>
    </div>
  )
}

/** Local em texto, com latitude e longitude opcionais (as duas juntas); com elas o verso mostra o mapa */
export function EscolhaLocal({ local, salvar }: { local: LocalCartao | null | undefined; salvar: (l: LocalCartao | null) => void }) {
  const [txt, setTxt] = useState(local?.txt ?? '')
  const [lat, setLat] = useState(local?.lat?.toString() ?? '')
  const [lng, setLng] = useState(local?.lng?.toString() ?? '')
  const [erro, setErro] = useState('')
  const envia = (e: FormEvent) => {
    e.preventDefault()
    const num = (s: string) => (s.trim() === '' ? undefined : Number(s.replace(',', '.')))
    const [la, lo] = [num(lat), num(lng)]
    if ((la !== undefined && !(la >= -90 && la <= 90)) || (lo !== undefined && !(lo >= -180 && lo <= 180))) { setErro('Latitude vai de -90 a 90 e longitude de -180 a 180.'); return }
    if ((la === undefined) !== (lo === undefined)) { setErro('Informe latitude e longitude juntas, ou deixe as duas em branco.'); return }
    if (!txt.trim() && la === undefined && lo === undefined) { salvar(null); return }
    setErro('')
    salvar({ ...(txt.trim() && { txt: txt.trim() }), ...(la !== undefined && { lat: la }), ...(lo !== undefined && { lng: lo }) })
  }
  const campo = 'h-11 text-base sm:h-9 sm:text-sm'
  return (
    <form onSubmit={envia} className="grid gap-2">
      <Label htmlFor="loc-txt">Local</Label>
      <Input id="loc-txt" value={txt} maxLength={200} onChange={e => setTxt(e.target.value)} placeholder="Endereço ou nome do lugar" className={campo} />
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1"><Label htmlFor="loc-lat">Latitude (opcional)</Label><Input id="loc-lat" inputMode="decimal" value={lat} onChange={e => setLat(e.target.value)} className={campo} /></div>
        <div className="grid gap-1"><Label htmlFor="loc-lng">Longitude (opcional)</Label><Input id="loc-lng" inputMode="decimal" value={lng} onChange={e => setLng(e.target.value)} className={campo} /></div>
      </div>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      <Button type="submit" size="sm" className={alvo}>Salvar local</Button>
    </form>
  )
}
