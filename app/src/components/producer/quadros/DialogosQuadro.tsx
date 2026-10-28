import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  COR_DO_QUADRO, NOME_MAX, ROTULO_COR, ROTULO_VIS, corDoQuadro, mensagemQuadro, validarNome,
  useAtualizarQuadro, useDefinirMembros, useEquipeQuadros, useMembrosQuadros, useSalvarComoModelo,
  type CorQuadro, type NivelQuadro, type QuadroLinha, type VisQuadro,
} from '../../../hooks/useQuadros'
import Segmentado from './Segmentado'
import SeletorPessoas from './SeletorPessoas'

const rotulo = 'font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground'
const Erro = ({ texto }: { texto?: string }) => (texto ? <p role="alert" className="text-[12.5px] font-medium text-destructive">{texto}</p> : null)

/** Renomear e trocar a cor (só o dono: UPDATE direto das colunas name e color) */
export function EditarQuadro({ quadro, onFechar }: { quadro: QuadroLinha; onFechar: () => void }) {
  const salvar = useAtualizarQuadro()
  const [nome, setNome] = useState(quadro.name)
  const [cor, setCor] = useState<CorQuadro | null>(quadro.color)
  const [erro, setErro] = useState('')
  const atual = cor ?? (Object.keys(COR_DO_QUADRO) as CorQuadro[]).find(c => COR_DO_QUADRO[c] === corDoQuadro(quadro))!
  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    const v = validarNome(nome)
    if (v) { setErro(v); return }
    const campos = { ...(nome.trim() !== quadro.name && { name: nome.trim() }), ...(cor && cor !== quadro.color && { color: cor }) }
    if (!Object.keys(campos).length) { onFechar(); return }
    try { await salvar.mutateAsync({ id: quadro.id, ...campos }); toast.success('Quadro atualizado.'); onFechar() } catch (err) { setErro(mensagemQuadro(err)) }
  }
  return (
    <Dialog open onOpenChange={a => { if (!a) onFechar() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Renomear e cor</DialogTitle><DialogDescription className="sr-only">Troque o nome e a cor do quadro.</DialogDescription></DialogHeader>
        <form id="form-editar-quadro" onSubmit={enviar} className="grid gap-4">
          <div className="grid gap-1.5">
            <label htmlFor="editar-nome" className={rotulo}>Nome</label>
            <Input id="editar-nome" value={nome} maxLength={NOME_MAX} autoComplete="off" aria-invalid={!!erro} onChange={e => { setNome(e.target.value); setErro('') }} />
          </div>
          <div className="grid gap-1.5">
            <span id="editar-cor" className={rotulo}>Cor</span>
            <div role="radiogroup" aria-labelledby="editar-cor" className="flex flex-wrap gap-2">
              {(Object.keys(COR_DO_QUADRO) as CorQuadro[]).map(c => (
                <button key={c} type="button" role="radio" aria-checked={c === atual} onClick={() => setCor(c)}
                  className={cn('inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8', c === atual && 'border-primary ring-2 ring-primary/30')}>
                  <span aria-hidden="true" className="size-3 rounded-full" style={{ background: COR_DO_QUADRO[c] }} />{ROTULO_COR[c]}
                </button>
              ))}
            </div>
          </div>
          <Erro texto={erro} />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button type="submit" form="form-editar-quadro" loading={salvar.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Quem vê o quadro e, em "pessoas escolhidas", quem entra e com que nível. Só o dono altera; os outros só veem. */
export function MembrosQuadro({ quadro, dono, onFechar }: { quadro: QuadroLinha; dono: boolean; onFechar: () => void }) {
  const definir = useDefinirMembros()
  const membros = useMembrosQuadros()
  const [vis, setVis] = useState<VisQuadro>(quadro.visibility)
  const [edit, setEdit] = useState<Record<string, NivelQuadro> | null>(null)
  const [erro, setErro] = useState('')
  const guardados = membros.data?.get(quadro.id) ?? []
  const sel = edit ?? Object.fromEntries(guardados.map(m => [m.user_id, m.nivel]))
  const travado = !dono || quadro.is_default
  const equipe = useEquipeQuadros(dono && vis === 'escolhidas')
  const nomes = new Map((equipe.data ?? []).map(p => [p.id, p.nome]))
  const salvar = async () => {
    if (vis === 'escolhidas' && !Object.keys(sel).length) { setErro('Escolha ao menos uma pessoa ou mude para "Só eu".'); return }
    try { await definir.mutateAsync({ id: quadro.id, visibilidade: vis, membros: sel }); toast.success('Quem vê o quadro foi atualizado.'); onFechar() } catch (err) { setErro(mensagemQuadro(err)) }
  }
  const aviso = quadro.is_default ? 'O quadro padrão é da equipe toda e não muda.' : quadro.kind === 'pessoal' ? 'Quadro pessoal fica só com você.' : !dono ? 'Só o dono altera quem vê o quadro. Você só pode ver.' : ''
  return (
    <Dialog open onOpenChange={a => { if (!a) onFechar() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Membros do quadro</DialogTitle><DialogDescription>{quadro.name}</DialogDescription></DialogHeader>
        <div className="grid gap-4">
          {aviso && <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[13px]">{aviso}</p>}
          <div className="grid gap-1.5">
            <span className={rotulo}>Quem vê</span>
            <Segmentado rotulo="Quem vê o quadro" valor={vis} onChange={v => { setVis(v); setErro('') }}
              opcoes={(['pessoal', 'equipe', 'escolhidas'] as const).map(v => [v, ROTULO_VIS[v]] as const)}
              desligadas={travado ? ['pessoal', 'equipe', 'escolhidas'].filter(v => v !== vis) as VisQuadro[] : quadro.kind === 'pessoal' ? ['equipe', 'escolhidas'] : []} />
          </div>
          {vis === 'escolhidas' && (
            <div className="grid gap-1.5">
              <span className={rotulo}>Pessoas</span>
              {dono ? (
                equipe.isPending ? <p role="status" className="text-sm text-muted-foreground">Carregando a equipe…</p>
                  : equipe.isError ? <p role="alert" className="text-sm text-destructive">Não foi possível carregar a equipe.</p>
                  : <SeletorPessoas equipe={equipe.data ?? []} valor={sel} onChange={setEdit} />
              ) : guardados.length ? (
                <ul className="rounded-lg border border-border bg-muted/30">
                  {guardados.map((m, i) => <li key={m.user_id} className="flex justify-between gap-3 border-b border-border px-3 py-2 text-sm last:border-b-0"><span>{nomes.get(m.user_id) ?? `Pessoa ${i + 1}`}</span><span className="text-muted-foreground">{m.nivel === 'editar' ? 'Pode editar' : 'Pode ver'}</span></li>)}
                </ul>
              ) : <p className="text-sm text-muted-foreground">Ninguém foi escolhido ainda.</p>}
            </div>
          )}
          <Erro texto={erro} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>{travado ? 'Fechar' : 'Cancelar'}</Button>
          {!travado && <Button onClick={salvar} loading={definir.isPending}>Salvar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Guarda as colunas do quadro (e, se quiser, os cartões abertos) como modelo do produtor */
export function SalvarModelo({ quadro, onFechar }: { quadro: QuadroLinha; onFechar: () => void }) {
  const salvar = useSalvarComoModelo()
  const [nome, setNome] = useState(`Modelo ${quadro.name}`.slice(0, NOME_MAX))
  const [cartoes, setCartoes] = useState(false)
  const [erro, setErro] = useState('')
  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    const v = validarNome(nome, 'modelo')
    if (v) { setErro(v); return }
    try { await salvar.mutateAsync({ id: quadro.id, nome, cartoes }); toast.success('Modelo salvo.'); onFechar() } catch (err) { setErro(mensagemQuadro(err)) }
  }
  return (
    <Dialog open onOpenChange={a => { if (!a) onFechar() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Salvar como modelo</DialogTitle><DialogDescription>As colunas deste quadro viram um modelo seu, para criar outros iguais.</DialogDescription></DialogHeader>
        <form id="form-modelo-quadro" onSubmit={enviar} className="grid gap-4">
          <div className="grid gap-1.5">
            <label htmlFor="modelo-nome" className={rotulo}>Nome do modelo</label>
            <Input id="modelo-nome" value={nome} maxLength={NOME_MAX} autoComplete="off" aria-invalid={!!erro} onChange={e => { setNome(e.target.value); setErro('') }} />
          </div>
          <label className="flex min-h-11 items-start gap-3 text-sm sm:min-h-0">
            <input type="checkbox" checked={cartoes} onChange={e => setCartoes(e.target.checked)} className="mt-0.5 size-6 accent-[var(--brand-violet)] sm:size-[18px]" />
            <span>Incluir os cartões abertos<span className="block text-[12.5px] text-muted-foreground">Só o título e a coluna: sem pessoas, datas, comentários nem anexos.</span></span>
          </label>
          <Erro texto={erro} />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button type="submit" form="form-modelo-quadro" loading={salvar.isPending}>Salvar modelo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
