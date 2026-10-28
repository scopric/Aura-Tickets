import { Link } from 'react-router'
import * as I from '@/components/icones/evokaa16'
import { AvatarPessoa } from '@/components/producer/quadro/pecas'
import { cn } from '@/lib/utils'
import { diaBR } from '../../../lib/visaoEvento'
import { corDoQuadro, type ContagemQuadro, type KindQuadro, type MembroQuadro, type QuadroLinha } from '../../../hooks/useQuadros'
import MenuDoQuadro from './MenuDoQuadro'

const MES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']
const ICONE_KIND: Record<KindQuadro, typeof I.Eventos> = { evento: I.Eventos, equipe: I.Equipe, pessoal: I.Conta }

/** Dia, mês e quantos dias faltam (negativo = já passou) de um dia AAAA-MM-DD, contados a partir de `hoje` */
function dataDoQuadro(dia: string, hoje: string) {
  const d = new Date(`${dia}T00:00:00Z`)
  return { dia: d.getUTCDate(), mes: MES[d.getUTCMonth()], falta: Math.round((d.getTime() - Date.parse(`${hoje}T00:00:00Z`)) / 86_400_000) }
}

/** Quadro como ingresso: capa e nome à esquerda, canhoto à direita (data do evento ou cartões abertos). O nome é o link que abre o quadro. */
export default function CartaoQuadro({ quadro, eventoDia, eventoTitulo, contagem, membros, nomeDe, sou, grande }: {
  quadro: QuadroLinha
  /** Dia (AAAA-MM-DD) do evento do quadro, se houver */
  eventoDia: string | null
  eventoTitulo?: string
  contagem?: ContagemQuadro
  membros: MembroQuadro[]
  nomeDe: (userId: string) => string
  /** Sou o dono */
  sou: boolean
  grande?: boolean
}) {
  const hoje = diaBR(new Date())
  const cor = corDoQuadro(quadro)
  const Ic = ICONE_KIND[quadro.kind]
  const quem = quadro.visibility === 'pessoal' ? 'Só você' : quadro.visibility === 'equipe' ? 'Equipe toda' : `${membros.length + 1} pessoas`
  const apoio = [eventoTitulo, !sou && quadro.visibility !== 'pessoal' ? 'Compartilhado com você' : quem].filter(Boolean).join(' · ')
  const dt = eventoDia ? dataDoQuadro(eventoDia, hoje) : null
  const fio = quadro.archived_at ? null : dt ? (dt.falta >= 0 && dt.falta <= 14 ? 'var(--ev-warning)' : null) : contagem?.atrasados ? 'hsl(var(--destructive))' : null
  const pilha = sou && quadro.visibility === 'escolhidas' ? membros.slice(0, 3) : []
  return (
    <article className={cn('ev-ingresso !cursor-default', quadro.archived_at && 'opacity-65')}>
      <div className="ev-bilhete">
        <div className={cn('flex min-w-0 flex-col justify-between gap-3 py-3.5 pl-4 pr-3', grande ? 'min-h-32' : 'min-h-28')}>
          <div className="flex items-center gap-3 pr-10">
            <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-[10px]"
              style={{ background: `color-mix(in srgb, ${cor} 14%, hsl(var(--card)))`, color: `color-mix(in srgb, ${cor} 62%, hsl(var(--foreground)))` }}>
              <Ic size={22} />
            </span>
            <div className="min-w-0">
              <h3 className={cn('line-clamp-2 break-words font-semibold leading-tight tracking-[-0.015em]', grande ? 'text-[19px]' : 'text-[16.5px]')}>
                <Link to={`/producer/quadros/${quadro.id}`} title={quadro.name}
                  className="rounded outline-none after:absolute after:inset-0 after:z-0 after:content-[''] focus-visible:after:rounded-[14px] focus-visible:after:ring-2 focus-visible:after:ring-ring">{quadro.name}</Link>
              </h3>
              <p className="mt-0.5 line-clamp-2 text-[13px] text-muted-foreground">{apoio}</p>
            </div>
          </div>
          {pilha.length > 0 && (
            <div className="flex -space-x-1" role="group" aria-label={`Quem vê: ${membros.map(m => nomeDe(m.user_id)).join(', ')}`}>
              {pilha.map(m => <AvatarPessoa key={m.user_id} nome={nomeDe(m.user_id)} className="size-6 text-[10px] ring-2 ring-card" />)}
              {membros.length > 3 && <span className="grid size-6 place-items-center rounded-full bg-secondary text-[10px] ring-2 ring-card">+{membros.length - 3}</span>}
            </div>
          )}
        </div>
        {/* Canhoto discreto: fundo neutro; só um fio no topo e o texto "atrasados" carregam a cor do estado (vermelho = atraso, âmbar = evento perto) */}
        <div className="ev-canhoto" data-estado="normal" style={{ background: 'hsl(var(--muted) / 0.6)', color: 'hsl(var(--foreground))', boxShadow: fio ? `inset 0 2px 0 ${fio}` : undefined }}>
          <div className="ev-data">
            {dt ? <><b>{dt.dia}</b><span>{dt.mes}</span><small>{dt.falta < 0 ? `há ${-dt.falta} d` : dt.falta === 0 ? 'hoje' : `em ${dt.falta} d`}</small></>
              : <><b>{contagem ? contagem.abertos : '—'}</b><span>abertos</span>{!!contagem?.atrasados && <small style={{ color: 'hsl(var(--destructive))', background: 'transparent', padding: 0, boxShadow: 'none', textTransform: 'none', fontSize: 11 }}>{contagem.atrasados} {contagem.atrasados === 1 ? 'atrasado' : 'atrasados'}</small>}</>}
          </div>
        </div>
      </div>
      <div className="absolute right-[calc(var(--stub)+6px)] top-1.5 z-10"><MenuDoQuadro quadro={quadro} /></div>
    </article>
  )
}
