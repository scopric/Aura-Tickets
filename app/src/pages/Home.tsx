import { Link } from 'react-router'
import { useSEO } from '../hooks/useSEO'
import { useFeaturedEvents } from '../hooks/useEvents'
import { appUrl } from '../lib/appHost'
import { registerUrl } from '../lib/affiliateRef'
import { TAXA_PERCENTUAL, TAXA_MINIMA, brl } from '../lib/taxa'
import { diaMesDoCartaz } from '../lib/corEvento'
import EvoCena from '../components/evo3d/EvoCena'
import EventoCapa from '../components/EventoCapa'

// Home v3.0 (Modo Refero, Fase 4, tela 1; Decisões 244–246 e 248): palco preto, o Evo 3D é o herói e o chrome é
// fantasma. Regras em DESIGN-SYSTEM.md; tokens ev3-* (tokens-v3.css). Conteúdo só do que existe: taxa de lib/taxa.ts,
// eventos reais de useFeaturedEvents, Pix hoje (Decisão 228). Sem número de volume, sem gradiente, sem sombra.

const FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ev3-foco focus-visible:ring-offset-2 focus-visible:ring-offset-black'
const CHROME = 'font-ev3-chrome text-[14px] font-bold leading-none tracking-normal'
// Botão principal: pílula violeta, rótulo branco (5,30:1), um por tela. Fantasma: raio 5, contorno #999, vidro no hover.
const BOTAO_PRINCIPAL = `inline-flex h-12 items-center justify-center rounded-ev3-pilula bg-ev3-acento px-[18px] text-white transition-opacity duration-[var(--ev3-mov-micro)] hover:opacity-85 ${CHROME} ${FOCO}`
const BOTAO_FANTASMA = `inline-flex h-12 items-center justify-center rounded-ev3-controle border border-ev3-contorno px-[18px] text-ev3-texto transition-colors duration-[var(--ev3-mov-micro)] hover:bg-ev3-vidro ${CHROME} ${FOCO}`
const TITULO_SECAO = 'font-ev3-chrome text-[14px] font-bold leading-none tracking-normal text-ev3-texto'
const DISPLAY_EVENTO = 'font-ev3-display font-bold uppercase leading-[0.92] tracking-normal [overflow-wrap:anywhere] [text-wrap:balance]'

export default function Home() {
  useSEO({
    title: 'Evokaa — ingressos e eventos',
    description: 'Crie o evento, venda o ingresso com Pix e confira na porta pelo QR Code. Taxa só no ingresso vendido.',
    image: '/images/logo-evokaa.png',
  })
  const { data: eventos = [], isLoading } = useFeaturedEvents()

  return (
    <div className="bg-ev3-fundo font-ev3-corpo text-ev3-texto">
      {/* Herói: a cena começa abaixo da pílula fixa do Header (68 px) para não cobrir a cabeça do Evo */}
      <section className="mx-auto flex min-h-[100svh] max-w-6xl flex-col px-4 pt-[76px] lg:flex-row lg:px-6">
        <div className="relative h-[46svh] min-h-[280px] lg:order-2 lg:h-auto lg:min-h-0 lg:flex-1">
          <EvoCena />
        </div>
        {/* No celular os botões ficam acima dos botões flutuantes de suporte e feedback (canto inferior direito): pb-28 */}
        <div className="flex flex-1 flex-col justify-start gap-6 pb-28 pt-8 lg:order-1 lg:max-w-[520px] lg:justify-center lg:py-12 lg:pr-10">
          {/* Título de página em Syne (desvio consciente (i), DESIGN-SYSTEM §2); as classes anulam o h1 global do index.css */}
          <h1 className="font-ev3-chrome text-[clamp(28px,4vw,44px)] font-bold leading-[1.05] tracking-normal text-ev3-texto [text-wrap:balance]">
            Crie o evento, venda o ingresso, confira na porta.
          </h1>
          <p className="max-w-[44ch] text-[18px] leading-[1.6] text-ev3-terciario">
            Plataforma brasileira de ingressos. Taxa só no ingresso vendido; Pix hoje, cartão em breve.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to={registerUrl(appUrl, true)} className={BOTAO_PRINCIPAL}>Criar meu evento</Link>
            <Link to="/events" className={BOTAO_FANTASMA}>Ver eventos</Link>
          </div>
        </div>
      </section>

      {/* Eventos reais (aprovados, públicos, futuros); sem evento, o convite da Decisão 25 */}
      <section className="mx-auto max-w-6xl px-4 py-12 lg:px-6" aria-labelledby="agora">
        <h2 id="agora" className={TITULO_SECAO}>Agora na Evokaa</h2>
        {isLoading ? (
          <p role="status" className="border-b border-ev3-fio py-8 font-ev3-chrome text-[12px] text-ev3-terciario">Carregando eventos…</p>
        ) : eventos.length === 0 ? (
          <div className="border-b border-ev3-fio py-12" data-testid="vitrine-vazia">
            <p className={`${DISPLAY_EVENTO} text-[clamp(28px,4vw,44px)]`}>Em breve os primeiros eventos</p>
            <p className="mt-3 text-[16px] leading-[1.88] text-ev3-terciario">
              Os eventos aprovados aparecem aqui. Produtor?{' '}
              <Link to="/auth/register?tipo=produtor" className={`alvo-44 text-ev3-texto underline decoration-ev3-fio underline-offset-4 hover:decoration-ev3-texto ${FOCO}`}>Crie o seu</Link>.
            </p>
          </div>
        ) : (
          <ul className="m-0 list-none p-0">
            {eventos.slice(0, 4).map(e => {
              const data = diaMesDoCartaz(e.date)
              const local = [e.venue_name, e.venue_city && (e.venue_state ? `${e.venue_city}/${e.venue_state}` : e.venue_city), e.time?.slice(0, 5)]
                .filter(Boolean).join(' · ')
              return (
                <li key={e.id}>
                  <Link
                    to={`/event/${e.id}`}
                    className={`grid grid-cols-[72px_1fr_96px] items-center gap-4 border-b border-ev3-fio py-5 sm:grid-cols-[112px_1fr_160px] sm:gap-6 ${FOCO}`}
                  >
                    <div className="text-center">
                      {data ? (
                        <>
                          <span className="block font-ev3-display text-[clamp(44px,8vw,72px)] font-bold leading-[0.9] tracking-normal">{data.dia}</span>
                          <span className="block font-ev3-chrome text-[12px] uppercase leading-[1.5] text-ev3-terciario">{data.mes}</span>
                        </>
                      ) : (
                        <span className="block font-ev3-chrome text-[12px] leading-[1.5] text-ev3-terciario">Data a definir</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className={`${DISPLAY_EVENTO} text-[clamp(28px,4vw,44px)] text-ev3-texto`}>{e.title}</h3>
                      {local && <p className="mt-2 font-ev3-chrome text-[12px] leading-[1.5] text-ev3-terciario">{local}</p>}
                    </div>
                    <div className="w-[96px] overflow-hidden rounded-ev3-cartao sm:w-[160px]">
                      <EventoCapa evento={e} tamanho="cartao" />
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
        <div className="pt-6">
          <Link to="/events" className={BOTAO_FANTASMA}>Ver todos os eventos</Link>
        </div>
      </section>

      {/* Para quem produz: só o que está decidido (Decisões 88, 111, 214 e 228) */}
      <section className="mx-auto max-w-6xl px-4 py-12 lg:px-6" aria-labelledby="produz">
        <h2 id="produz" className={TITULO_SECAO}>Para quem produz</h2>
        <dl className="m-0">
          {[
            ['Taxa', `Quem compra paga ${TAXA_PERCENTUAL}% por ingresso, mínimo ${brl(TAXA_MINIMA)} na inteira; evento gratuito não tem taxa. Você pode absorver a taxa.`],
            ['Pagamento', 'Pix hoje. Cartão de crédito em breve.'],
            ['Na porta', 'QR Code conferido na entrada. Seus dados tratados conforme a LGPD.'],
          ].map(([rotulo, valor]) => (
            <div key={rotulo} className="grid gap-2 border-b border-ev3-fio py-5 sm:grid-cols-[160px_1fr] sm:gap-6">
              <dt className="font-ev3-chrome text-[12px] uppercase leading-[1.5] text-ev3-terciario">{rotulo}</dt>
              <dd className="m-0 max-w-[60ch] text-[16px] leading-[1.88] text-ev3-texto">{valor}</dd>
            </div>
          ))}
        </dl>
        <div className="pt-6">
          <Link to="/planos" className={BOTAO_FANTASMA}>Planos e taxas</Link>
        </div>
      </section>

      {/* Empresa e contato (os mesmos dados de /contato) */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-4 lg:px-6" aria-label="Empresa e contato">
        <p className="font-ev3-chrome text-[12px] leading-[2] text-ev3-terciario">
          Evoka Soluções Ltda · Rua Treze de Maio, 336, salas 33 e 34 — Curitiba/PR ·{' '}
          <a href="tel:+5541997585425" className={`alvo-44 text-ev3-texto ${FOCO}`}>(41) 99758-5425</a> ·{' '}
          <Link to="/contato" className={`alvo-44 text-ev3-texto ${FOCO}`}>Fale com a gente</Link>
        </p>
      </section>
    </div>
  )
}
