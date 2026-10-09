import { useState } from 'react'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { selectNativo, chipAviso } from '@/components/producer/ui'
import { cn } from '@/lib/utils'
import { mensagemSegura } from '../../../hooks/useCartao'
import type { ColunaQuadro } from '../../../hooks/useProducerTools'
import {
  PAPEIS, TIPOS_MODELO, nomeDoPapel, rotuloDias, useConfigAcoes, useModelos, usePapeis, usePessoasSugeridas, type Modelo, type TipoModelo,
} from '../../../hooks/useQuadroAcoes'

const alvo = 'min-h-11 sm:min-h-8'
const aoErro = (e: Error) => toast.error(mensagemSegura(e))

/** Banco sem o SQL da 2C (ou consulta que falhou): sem erro técnico, só o motivo */
export function Indisponivel({ erro }: { erro?: boolean }) {
  return <p role="status" className="text-sm text-muted-foreground">{erro ? 'Não foi possível carregar agora. Tente de novo mais tarde.' : 'Indisponível até a atualização do banco.'}</p>
}

// ─── Modelos por tipo de evento ───
function ListaModelo({ modelo, kind, pode, temEvento, aplicar }: {
  modelo: Modelo; kind: TipoModelo; pode: boolean; temEvento: boolean
  aplicar: ReturnType<typeof useModelos>['aplicar']
}) {
  const [marcados, setMarcados] = useState(() => new Set(modelo.items.map((_, i) => i)))
  const alternar = (i: number, v: boolean) => setMarcados(s => { const n = new Set(s); if (v) n.add(i); else n.delete(i); return n })
  const enviar = () => aplicar.mutate({ kind, itens: [...marcados].sort((a, b) => a - b) }, {
    onError: aoErro,
    onSuccess: r => toast.success(`${r.criados} ${r.criados === 1 ? 'cartão criado' : 'cartões criados'}${r.existentes ? `, ${r.existentes} já ${r.existentes === 1 ? 'existia' : 'existiam'}` : ''}.`),
  })
  return (
    <>
      <ul className="grid gap-1">
        {modelo.items.map((it, i) => (
          <li key={i} className="flex items-start gap-3 rounded-md px-1 py-1.5">
            <Checkbox id={`modelo-${kind}-${i}`} className="mt-0.5" checked={marcados.has(i)} disabled={!pode} onCheckedChange={v => alternar(i, v === true)} />
            <label htmlFor={`modelo-${kind}-${i}`} className="grid min-w-0 cursor-pointer text-sm">
              <span className="break-words">{it.titulo}</span>
              <small className="text-xs text-muted-foreground">{nomeDoPapel(it.papel)} · {rotuloDias(it.dias)}</small>
            </label>
          </li>
        ))}
      </ul>
      {!temEvento && (
        <p role="status" className={cn('rounded-md border px-3 py-2 text-sm', chipAviso)}>
          Este quadro não é de um evento. Os prazos do modelo contam a partir da data do evento: abra o quadro de um evento para aplicar.
        </p>
      )}
      {pode && (
        <div><Button size="sm" className={alvo} disabled={!pode || !temEvento || marcados.size === 0} loading={aplicar.isPending} onClick={enviar}><I.Criar aria-hidden="true" />Aplicar ao quadro</Button></div>
      )}
    </>
  )
}

/** Página "Modelos por tipo de evento". Só aplica com evento; cartão com o mesmo título que já existe é pulado pelo banco */
export function PaginaModelos({ boardId, pode, temEvento }: { boardId: string; pode: boolean; temEvento: boolean }) {
  const m = useModelos(boardId)
  const [tipo, setTipo] = useState<TipoModelo>('show')
  if (m.carregando) return <p role="status" className="text-sm text-muted-foreground">Carregando…</p>
  if (!m.disponivel || m.erro) return <Indisponivel erro={m.erro} />
  const modelo = m.modelos.find(x => x.key === tipo)
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        Escolha o tipo do evento e marque o que quer: os cartões nascem com responsável por papel, prazo contado a partir do dia do evento e a página vinculada.
        {pode ? '' : ' Você só pode ver os modelos; para aplicar, peça acesso de edição.'}
      </p>
      <div role="group" aria-label="Tipo de evento" className="flex flex-wrap gap-1">
        {TIPOS_MODELO.map(t => (
          <Button key={t.chave} variant={t.chave === tipo ? 'secondary' : 'outline'} size="sm" className={alvo} aria-pressed={t.chave === tipo} onClick={() => setTipo(t.chave)}>{t.nome}</Button>
        ))}
      </div>
      {modelo ? <ListaModelo key={tipo} modelo={modelo} kind={tipo} pode={pode} temEvento={temEvento} aplicar={m.aplicar} /> : <p className="text-sm text-muted-foreground">Este modelo ainda não está disponível.</p>}
    </div>
  )
}

// ─── Papéis ───
/** Página "Papéis": quem é cada papel. Papel sem pessoa faz o passo de botão ou de modelo ser ignorado */
export function PaginaPapeis({ boardId, pode }: { boardId: string; pode: boolean }) {
  const p = usePapeis(boardId)
  const gente = usePessoasSugeridas(boardId, p.disponivel)
  if (p.carregando) return <p role="status" className="text-sm text-muted-foreground">Carregando…</p>
  if (!p.disponivel) return <Indisponivel erro={p.erro} />
  const pessoas = gente.data ?? []
  const negado = gente.isError
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        Cada papel tem uma pessoa do quadro. Os botões e os modelos usam o papel para atribuir cartões e avisar.
        {' '}<b className="font-medium text-foreground">Papel sem pessoa faz o passo ser ignorado.</b>
        {pode ? '' : ' Você só pode ver quem é cada papel.'}
      </p>
      {negado && <p role="status" className={cn('rounded-md border px-3 py-2 text-sm', chipAviso)}>Sem permissão para listar pessoas.</p>}
      <ul className="grid gap-2">
        {PAPEIS.map(x => {
          const atual = p.mapa[x.slug] ?? ''
          const nomeAtual = pessoas.find(q => q.id === atual)?.nome
          return (
            <li key={x.slug} className="grid gap-1 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center">
              <label htmlFor={`papel-${x.slug}`} className="text-sm font-medium">{x.nome}</label>
              {pode ? (
                <select id={`papel-${x.slug}`} className={`${selectNativo} text-base sm:text-sm`} value={atual}
                  onChange={e => p.definir.mutate({ papel: x.slug, userId: e.target.value || null }, { onError: aoErro })}>
                  <option value="">{negado ? 'Sem permissão' : 'Ninguém'}</option>
                  {atual && !nomeAtual && <option value={atual}>Pessoa que não está mais na lista</option>}
                  {pessoas.map(q => <option key={q.id} value={q.id}>{q.nome}</option>)}
                </select>
              ) : (
                <span id={`papel-${x.slug}`} className="text-sm text-muted-foreground">{atual ? nomeAtual ?? 'Definido' : 'Ninguém'}</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ─── Coluna de revisão (só o dono) ───
export function ColunaRevisao({ boardId, colunas }: { boardId: string; colunas: ColunaQuadro[] }) {
  const { config, definirRevisao } = useConfigAcoes(boardId)
  if (!config.disponivel || !config.dono) return null
  return (
    <div className="mt-1 grid gap-1 border-t border-border p-2 pt-3">
      <label htmlFor="coluna-revisao" className="text-sm font-medium">Coluna de revisão</label>
      <select id="coluna-revisao" aria-describedby="coluna-revisao-dica" className={`${selectNativo} text-base sm:text-sm`} value={config.revisaoId ?? ''}
        onChange={e => definirRevisao.mutate(e.target.value || null, { onError: aoErro })}>
        <option value="">Nenhuma</option>
        {colunas.filter(c => !c.dica).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <p id="coluna-revisao-dica" className="text-xs text-muted-foreground">Para onde vai o cartão quando o checklist fecha, nos cartões que ligarem essa opção.</p>
    </div>
  )
}
