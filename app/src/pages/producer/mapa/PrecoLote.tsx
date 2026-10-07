import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { lerPreco } from './regras'

const moeda = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const comoTexto = (n: number) => String(n).replace('.', ',')

// Preço em R$: o lote só muda ao sair do campo ou no Enter, nunca por tecla ("1.2" a caminho de "1.200" não vira R$ 1,20).
// Durante a digitação mostra só a leitura. "1.200" (ambíguo) exige o botão Confirmar; sair do campo sem confirmar descarta o texto.
export default function PrecoLote({ valor, onChange }: { valor: number; onChange: (n: number) => void }) {
  const [txt, setTxt] = useState(comoTexto(valor))
  const caixa = useRef<HTMLDivElement>(null)
  const lido = lerPreco(txt)
  useEffect(() => { setTxt(comoTexto(valor)) }, [valor])
  const aplicar = () => {
    if (lido && !lido.ambiguo && lido.valor !== valor) onChange(lido.valor)
    else setTxt(comoTexto(valor)) // inválido, ambíguo ou igual: volta ao preço do lote
  }
  const vazio = txt.trim() === ''
  return (
    <div ref={caixa} onBlur={e => { if (!caixa.current?.contains(e.relatedTarget as Node | null)) aplicar() }}>
      <input
        type="text" inputMode="decimal" aria-label="Preço do lote em reais" aria-invalid={!lido} value={txt}
        onChange={e => setTxt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') aplicar() }}
        className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
      {lido && !lido.ambiguo && lido.valor !== valor && <p role="status" className="text-xs">Entendi {moeda(lido.valor)}. Enter ou sair do campo aplica.</p>}
      {lido?.ambiguo && (
        <p role="status" className="flex flex-wrap items-center gap-2 text-xs">
          Entendi {moeda(lido.valor)}.
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs max-lg:h-10" onMouseDown={e => e.preventDefault()} onClick={() => onChange(lido.valor)}>Confirmar {moeda(lido.valor)}</Button>
        </p>
      )}
      {!lido && <p role="alert" className="text-xs text-destructive">{vazio ? 'Digite um preço.' : 'Preço inválido.'} Use de 0 a 1.000.000, ex.: 80 ou 1.200,50.</p>}
    </div>
  )
}
