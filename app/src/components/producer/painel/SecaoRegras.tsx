import * as I from '@/components/icones/evokaa16'
import * as RadioPrimitive from '@radix-ui/react-radio-group'
import { RadioGroup } from '@/components/ui/radio-group'
import { Faixa, Selo, type PropsSecao } from './campos'
import { CLASSIFICACOES, avisoEntrada } from '../../../lib/tipoEvento'

// Seção "Regras e idade": classificação (selo provisório), aviso de entrada gerado por ela e o resumo da bebida.
// A bebida alcoólica é por ingresso (Decisão 151): aqui só se lê, quem marca é a seção Ingressos.
export default function SecaoRegras({ f, set, bebidaN, ingressosN, ingSujo, faltam }: PropsSecao & { bebidaN: number; ingressosN: number; ingSujo: boolean }) {
  const esporte = f.category === 'esporte'
  const aviso = avisoEntrada(f.classificacao)

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <span id="r-cls" className="text-sm font-medium text-foreground">Classificação indicativa</span>
        {esporte ? (
          <>
            <p className="text-sm text-foreground">Evento esportivo não leva selo de classificação.</p>
            <Faixa tom="atencao" titulo="A venda de evento esportivo fica bloqueada por enquanto" />
          </>
        ) : (
          <>
            <RadioGroup id="f-class" aria-labelledby="r-cls" aria-invalid={!!faltam?.['f-class']} aria-describedby={faltam?.['f-class'] ? 'f-class-erro' : undefined} value={f.classificacao} onValueChange={v => set({ classificacao: v })} className="grid-cols-4 gap-2 sm:grid-cols-7">
              {CLASSIFICACOES.map(c => (
                <RadioPrimitive.Item
                  key={c.valor} value={c.valor}
                  className="alvo-44 grid justify-items-center gap-1.5 rounded-[10px] px-1 pb-2 pt-2.5 text-xs font-medium text-foreground outline-none ring-1 ring-inset ring-input transition-colors hover:bg-[var(--ev-tint-hover)] focus-visible:shadow-ev-foco data-[state=checked]:bg-[var(--ev-brand-soft)] data-[state=checked]:ring-2 data-[state=checked]:ring-[var(--ev-focus-field)]"
                >
                  <Selo c={c.valor} />{c.rotulo}
                </RadioPrimitive.Item>
              ))}
            </RadioGroup>
            {faltam?.['f-class'] && <p id="f-class-erro" role="alert" className="flex items-start gap-1.5 text-xs text-destructive"><I.Erro size={14} className="mt-px shrink-0" aria-hidden="true" />{faltam['f-class']}</p>}
            <p className="text-xs text-muted-foreground">Autoclassificação da Portaria MJSP 1.048. O selo aparece na página, no cartão e no checkout.</p>
          </>
        )}
      </div>
      {!esporte && aviso && (
        <div className="flex items-start gap-3 border-t border-border pt-3">
          <Selo c={f.classificacao} />
          <div>
            <p className="text-sm font-medium text-foreground">Aviso de entrada (gerado pela classificação)</p>
            <p className="text-[13px] text-foreground">{aviso}</p>
          </div>
        </div>
      )}
      <div className="rounded-[10px] bg-secondary px-4 py-3 text-sm">
        <p className="font-medium text-foreground">
          {bebidaN === 0 ? 'Nenhum ingresso inclui bebida alcoólica' : `Inclui bebida alcoólica em ${bebidaN} ${bebidaN === 1 ? 'ingresso' : 'ingressos'}`}
          <span className="font-normal text-muted-foreground"> (de {ingressosN} salvos)</span>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Quem marca é cada ingresso, na seção Ingressos. Com bebida, menor de 18 não compra, o ingresso e a página mostram o aviso, e você declara no aceite que vende a bebida e confere documento e idade na entrada.
          {ingSujo && ' Há ingressos com mudanças não salvas: salve para atualizar este resumo.'}
        </p>
      </div>
    </div>
  )
}
