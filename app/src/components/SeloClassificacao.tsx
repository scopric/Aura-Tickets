import { CLASSIFICACOES } from '../lib/tipoEvento'

// Selo PRÓPRIO e neutro da faixa etária (não imita o símbolo oficial da Classificação Indicativa). Decorativo: o texto
// "Classificação: N anos" é quem informa. O anel se desenha uma vez; em A14, A16 e A18 respira 3 vezes. CSS em EventoVitrine.css.
export default function SeloClassificacao({ valor }: { valor?: string | null }) {
  if (!CLASSIFICACOES.some((c) => c.valor === valor)) return null
  const n = valor === 'AL' ? 'L' : valor!.slice(1)
  const respira = valor === 'A14' || valor === 'A16' || valor === 'A18'
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 44 44" width="44" height="44" className="evv-selo shrink-0">
      {respira && <circle className="evv-selo-ar" cx="22" cy="22" r="20" fill="none" stroke="var(--evento-grafico)" strokeWidth="1" />}
      <circle className="evv-selo-anel" cx="22" cy="22" r="17" fill="none" stroke="var(--evento-grafico)" strokeWidth="2.5" strokeLinecap="round" transform="rotate(-90 22 22)" />
      <text className="evv-selo-n" x="22" y="27.5" textAnchor="middle" fontFamily="Archivo, sans-serif" fontWeight="800" fontSize={n.length > 1 ? 15 : 17} fill="currentColor">{n}</text>
    </svg>
  )
}
