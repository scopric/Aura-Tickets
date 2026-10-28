import { useId } from 'react'
import { AvatarPessoa } from '@/components/producer/quadro/pecas'
import { selectNativo } from '@/components/producer/ui'
import { cn } from '@/lib/utils'
import type { NivelQuadro, PessoaEquipe } from '../../../hooks/useQuadros'

/** Pessoas da equipe com caixa de seleção e nível (pode ver / pode editar). `valor` = {id da pessoa: nível}. */
export default function SeletorPessoas({ equipe, valor, onChange, desligado }: {
  equipe: PessoaEquipe[]
  valor: Record<string, NivelQuadro>
  onChange: (v: Record<string, NivelQuadro>) => void
  desligado?: boolean
}) {
  const base = useId()
  if (!equipe.length) return <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">Sua equipe ainda não tem ninguém ativo. Convide pessoas em Equipe.</p>
  return (
    <div role="group" aria-label="Pessoas da equipe" className="max-h-64 overflow-auto rounded-lg border border-border bg-muted/30">
      {equipe.map((p, i) => {
        const marcado = p.id in valor, id = `${base}-${i}`
        return (
          <div key={p.id} className="flex min-h-14 flex-wrap items-center gap-3 border-b border-border px-3 py-1.5 last:border-b-0 sm:min-h-11">
            <input id={id} type="checkbox" checked={marcado} disabled={desligado} className="size-6 accent-[var(--brand-violet)] sm:size-[18px]"
              onChange={e => { const n = { ...valor }; if (e.target.checked) n[p.id] = 'ver'; else delete n[p.id]; onChange(n) }} />
            <AvatarPessoa nome={p.nome} decorativo />
            <label htmlFor={id} className={cn('min-w-0 flex-1 cursor-pointer truncate text-sm font-medium', desligado && 'cursor-default')}>{p.nome}</label>
            <select aria-label={`Nível de ${p.nome}`} disabled={desligado || !marcado} value={valor[p.id] ?? 'ver'}
              onChange={e => onChange({ ...valor, [p.id]: e.target.value as NivelQuadro })} className={cn(selectNativo, 'h-11 w-auto sm:h-8 sm:py-0 text-[13px]')}>
              <option value="ver">Pode ver</option>
              <option value="editar">Pode editar</option>
            </select>
          </div>
        )
      })}
    </div>
  )
}
