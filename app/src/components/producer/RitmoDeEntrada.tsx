import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Mosaico, { Dica, semAnimacao } from '@/components/producer/central/Mosaico'

// Entradas por hora (Brasília) da lista já carregada, com "Ver como tabela". `parcial` = a lista chegou ao limite de linhas.
export default function RitmoDeEntrada({ dados, parcial, limite }: { dados: { rotulo: string; qtd: number }[]; parcial: boolean; limite: number }) {
  const total = dados.reduce((s, d) => s + d.qtd, 0)
  const pico = dados.reduce((m, d) => (d.qtd > m.qtd ? d : m), dados[0])
  return (
    <div>
      <Mosaico
        titulo="Ritmo de entrada por hora"
        altura={200}
        resumo={`${total} entradas${parcial ? ` dos ${limite.toLocaleString('pt-BR')} ingressos mais recentes` : ''}; a hora mais cheia foi ${pico.rotulo}, com ${pico.qtd}`}
        tabela={{ legenda: 'Entradas por hora (horário de Brasília)', colunas: ['Hora', 'Entradas'], linhas: dados.map(d => [d.rotulo, d.qtd]) }}
      >
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={dados} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="rotulo" tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--muted-foreground))" />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--muted-foreground))" />
            <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} content={<Dica formato={v => `${v} ${v === 1 ? 'entrada' : 'entradas'}`} />} />
            <Bar dataKey="qtd" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} isAnimationActive={!semAnimacao()} />
          </BarChart>
        </ResponsiveContainer>
      </Mosaico>
      {parcial && <p className="mt-2 text-xs text-muted-foreground">Calculado sobre os {limite.toLocaleString('pt-BR')} ingressos mais recentes da lista: entradas de ingressos mais antigos não aparecem aqui.</p>}
    </div>
  )
}
