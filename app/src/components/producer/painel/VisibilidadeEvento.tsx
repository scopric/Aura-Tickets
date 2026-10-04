import { useState } from 'react'
import * as RadioPrimitive from '@radix-ui/react-radio-group'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { RadioGroup } from '@/components/ui/radio-group'
import { supabase } from '../../../lib/supabase'
import { siteUrl } from '../../../lib/appHost'

export const OPCOES_VISIBILIDADE = [
  { valor: 'public', nome: 'Pública', texto: 'Aparece em Explorar e na busca. Qualquer pessoa abre e compra.' },
  { valor: 'unlisted', nome: 'Só com link', texto: 'Não aparece em Explorar nem na busca. Quem tem o link abre e compra.' },
  { valor: 'password', nome: 'Com senha', texto: 'Só entra quem tiver a senha.', breve: true },
  { valor: 'private', nome: 'Só para convidados', texto: 'Só entra quem você convidar.', breve: true },
] as const

// Seção Publicar: quem pode ver e comprar. Vale na hora e não volta o evento para análise (Decisão 165, D3).
// UPDATE sem .select() passa calado quando a regra não deixa gravar (erro 11): por isso o .select('id').single().
export default function VisibilidadeEvento({ eventoId, slug, visibilidade, onSalvo }: {
  eventoId: string; slug: string | null; visibilidade: string; onSalvo: () => void
}) {
  const [salvando, setSalvando] = useState(false)
  const atual = OPCOES_VISIBILIDADE.find(o => o.valor === visibilidade)
  const escolher = async (valor: string) => {
    if (valor === visibilidade || salvando) return
    setSalvando(true)
    const { error } = await supabase.from('events').update({ visibility: valor } as never).eq('id', eventoId).select('id').single()
    setSalvando(false)
    if (error) { toast.error('Não foi possível mudar quem vê o evento. Tente de novo.'); return }
    toast.success('Visibilidade atualizada.')
    onSalvo()
  }
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(siteUrl(`/event/${slug || eventoId}`))
      toast.success('Link do evento copiado.')
    } catch {
      toast.error('Não foi possível copiar o link.')
    }
  }
  return (
    <div className="grid gap-3">
      <div className="grid gap-0.5">
        <span id="v-grupo" className="text-sm font-medium text-foreground">Quem pode ver o evento</span>
        <span className="text-xs text-muted-foreground">Vale na hora e não manda o evento para nova análise.</span>
      </div>
      <RadioGroup aria-labelledby="v-grupo" value={visibilidade} onValueChange={v => void escolher(v)} disabled={salvando} className="gap-2">
        {OPCOES_VISIBILIDADE.map(o => {
          const breve = 'breve' in o && o.breve
          return (
            <RadioPrimitive.Item
              key={o.valor} value={o.valor} disabled={breve}
              className="alvo-44 grid gap-0.5 rounded-[10px] px-3 py-2.5 text-left outline-none ring-1 ring-inset ring-input transition-colors hover:bg-[var(--ev-tint-hover)] focus-visible:shadow-ev-foco disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent data-[state=checked]:bg-[var(--ev-brand-soft)] data-[state=checked]:ring-2 data-[state=checked]:ring-[var(--ev-focus-field)]"
            >
              <span className="text-sm font-medium text-foreground">{o.nome}{breve && <span className="ml-2 text-xs font-normal text-muted-foreground">em breve</span>}</span>
              <span className="text-xs text-muted-foreground">{o.texto}</span>
            </RadioPrimitive.Item>
          )
        })}
      </RadioGroup>
      {visibilidade !== 'private' && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={() => void copiar()}><I.Copiar aria-hidden="true" />Copiar link</Button>
          <span className="text-xs text-muted-foreground">{atual?.valor === 'unlisted' ? 'Mande este link a quem pode comprar.' : 'O endereço da página do evento.'}</span>
        </div>
      )}
    </div>
  )
}
