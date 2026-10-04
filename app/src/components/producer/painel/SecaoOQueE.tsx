import { useState } from 'react'
import * as I from '@/components/icones/evokaa16'
import { selectNativo } from '@/components/producer/ui'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ESTILOS, FORMATOS, MAX_ESTILOS, MAX_TEMAS, TEMAS } from '../../../lib/tipoEvento'
import { Campo, Chip, type PropsSecao } from './campos'

const MAX_TAGS = 10

const alterna = (lista: string[], v: string) => (lista.includes(v) ? lista.filter(x => x !== v) : [...lista, v])

// Seção "O que é": nome, subtítulo, formato, temas, estilos (só com o tema Música), etiquetas e descrição.
export default function SecaoOQueE({ f, set, erroNome }: PropsSecao & { erroNome: string }) {
  const [tag, setTag] = useState('')
  const formatoConhecido = FORMATOS.some(x => x.valor === f.category) // texto antigo de category não casa com a lista: mostra "Escolha"

  const poeTag = () => {
    const v = tag.trim()
    if (v && f.tags.length < MAX_TAGS && !f.tags.includes(v)) set({ tags: [...f.tags, v] })
    setTag('')
  }

  return (
    <div className="grid gap-4">
      <Campo id="f-nome" rotulo="Nome do evento" erro={erroNome || undefined}>
        <Input id="f-nome" aria-invalid={!!erroNome} aria-describedby={erroNome ? 'f-nome-erro' : undefined} value={f.title} onChange={e => set({ title: e.target.value })} maxLength={80} autoComplete="off" />
      </Campo>
      <Campo id="f-sub" rotulo="Subtítulo" opc="(opcional)">
        <Input id="f-sub" value={f.subtitle} onChange={e => set({ subtitle: e.target.value })} maxLength={120} placeholder="Uma linha que aparece abaixo do nome" />
      </Campo>
      <Campo id="f-formato" rotulo="Formato" ajuda="Um só. Ele decide os modelos prontos e o filtro do Explorar.">
        <select id="f-formato" aria-describedby="f-formato-ajuda" className={selectNativo} value={formatoConhecido ? f.category : ''} onChange={e => set({ category: e.target.value })}>
          <option value="">Escolha o formato</option>
          {FORMATOS.map(x => <option key={x.valor} value={x.valor}>{x.rotulo}</option>)}
        </select>
      </Campo>
      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-sm font-medium text-foreground">
          Temas <span className="font-normal text-muted-foreground">· até {MAX_TEMAS} · <span className="tabular-nums">{f.temas.length}</span> de {MAX_TEMAS}</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {TEMAS.map(t => (
            <Chip key={t.valor} ativo={f.temas.includes(t.valor)} desabilitado={!f.temas.includes(t.valor) && f.temas.length >= MAX_TEMAS} onClick={() => set({ temas: alterna(f.temas, t.valor) })}>{t.rotulo}</Chip>
          ))}
        </div>
      </fieldset>
      {f.temas.includes('musica') && (
        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-sm font-medium text-foreground">
            Estilo musical <span className="font-normal text-muted-foreground">· até {MAX_ESTILOS} · aparece porque o evento tem o tema Música</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {ESTILOS.map(t => (
              <Chip key={t.valor} ativo={f.estilos.includes(t.valor)} desabilitado={!f.estilos.includes(t.valor) && f.estilos.length >= MAX_ESTILOS} onClick={() => set({ estilos: alterna(f.estilos, t.valor) })}>{t.rotulo}</Chip>
            ))}
          </div>
        </fieldset>
      )}
      <Campo id="f-tag" rotulo="Etiquetas" opc={`(opcional, até ${MAX_TAGS})`}>
        <div className="flex flex-wrap items-center gap-2">
          {f.tags.map(t => (
            <span key={t} className="inline-flex h-8 items-center gap-1 rounded-full bg-secondary pl-3 pr-1 text-[13px] text-foreground">
              {t}
              <button type="button" aria-label={`Tirar a etiqueta ${t}`} onClick={() => set({ tags: f.tags.filter(x => x !== t) })} className="alvo-44 grid size-6 place-items-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:shadow-ev-foco">
                <I.Fechar size={12} aria-hidden="true" />
              </button>
            </span>
          ))}
          <Input
            id="f-tag" className="w-full sm:w-56" value={tag} disabled={f.tags.length >= MAX_TAGS} placeholder="Escreva e tecle Enter"
            onChange={e => setTag(e.target.value)} onBlur={poeTag}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); poeTag() } }}
          />
        </div>
      </Campo>
      <Campo id="f-desc" rotulo="Descrição" ajuda="Pelo menos 20 caracteres. Aparece na página do evento.">
        <Textarea id="f-desc" rows={4} value={f.description} onChange={e => set({ description: e.target.value })} aria-describedby="f-desc-ajuda" />
      </Campo>
    </div>
  )
}
