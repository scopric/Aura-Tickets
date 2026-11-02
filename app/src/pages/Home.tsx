import { Link } from 'react-router'
import { useSEO } from '../hooks/useSEO'
import { useFeaturedEvents } from '../hooks/useEvents'
import { appUrl } from '../lib/appHost'
import { registerUrl } from '../lib/affiliateRef'
import { TAXA_PERCENTUAL, TAXA_MINIMA, brl } from '../lib/taxa'
import { diaMesDoCartaz, temFoto } from '../lib/corEvento'
import EvoCena from '../components/evo3d/EvoCena'
import EventoCapa from '../components/EventoCapa'

// Home v3.0 (Modo Refero, Fase 4, tela 1; Decisões 244–246, 248 e 252): palco preto, o Evo 3D é o herói e o chrome é
// fantasma. Regras em DESIGN-SYSTEM.md; tokens ev3-* (tokens-v3.css). Conteúdo só do que existe: taxa de lib/taxa.ts
// (a que o checkout cobra hoje, Decisão 111), eventos reais de useFeaturedEvents, Pix hoje (Decisão 228).

const FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ev3-foco focus-visible:ring-offset-2 focus-visible:ring-offset-black'
const CHROME = 'font-ev3-chrome text-[14px] font-bold leading-[1.2] tracking-normal'
// Botão fantasma (DESIGN-SYSTEM §6): raio 5, contorno #999, vidro no hover; o principal (pílula violeta) aparece uma vez só
const BOTAO_FANTASMA = `inline-flex h-12 items-center justify-center rounded-ev3-controle border border-ev3-contorno px-[18px] text-ev3-texto transition-colors [transition-duration:var(--ev3-mov-micro)] [transition-timing-function:var(--ev3-curva-sai)] hover:bg-ev3-vidro ${CHROME} ${FOCO}`
const LINK_INLINE = `alvo-44 whitespace-nowrap text-ev3-terciario underline decoration-ev3-fio underline-offset-4 hover:text-ev3-texto ${FOCO}`

export default function Home() {
  useSEO({
    title: 'Evokaa — ingressos e eventos',
    description: 'Crie o evento, venda o ingresso com Pix e confira na porta pelo QR Code. Taxa só no ingresso vendido.',
    image: '/images/logo-evokaa.png',
  })
  const { data: eventos = [], isLoading } = useFeaturedEvents()
  // o gancho ordena os destaques por data e o complemento por vendidos: a lista da Home volta à ordem cronológica
  const proximos = eventos.slice(0, 4).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))

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
          <p className="max-w-[44ch] text-[16px] leading-[1.88] text-ev3-terciario">
            Plataforma brasileira de ingressos. Taxa de serviço paga por quem compra, só no ingresso vendido; Pix hoje, cartão em breve.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to={registerUrl(appUrl, true)}
              className={`inline-flex h-12 items-center justify-center rounded-ev3-pilula bg-ev3-acento px-[18px] text-white transition-opacity [transition-duration:var(--ev3-mov-micro)] [transition-timing-function:var(--ev3-curva-sai)] hover:opacity-85 ${CHROME} ${FOCO}`}
            >
              Criar meu evento
            </Link>
            <Link to="/events" className={BOTAO_FANTASMA}>Ver eventos</Link>
          </div>
        </div>
      </section>

      {/* Eventos reais (aprovados, públicos, futuros); sem evento, o convite da Decisão 25 */}
      <section className="mx-auto max-w-6xl px-4 py-12 lg:px-6" aria-labelledby="agora">
        <h2 id="agora" className={`${CHROME} text-ev3-texto`}>Agora na Evokaa</h2>
        {isLoading ? (
          <p role="status" className="mt-4 border-b border-ev3-fio py-8 font-ev3-chrome text-[12px] text-ev3-terciario">Carregando eventos…</p>
        ) : proximos.length === 0 ? (
          <div className="mt-4 border-b border-ev3-fio py-12 text-[16px] leading-[1.88]" data-testid="vitrine-vazia">
            <p className="text-ev3-texto">Em breve os primeiros eventos.</p>
            <p className="mt-2 text-ev3-terciario">
              Os eventos aprovados aparecem aqui. Produtor?{' '}
              <Link to={registerUrl(appUrl, true)} className={LINK_INLINE}>Crie o seu</Link>.
            </p>
          </div>
        ) : (
          <ul className="m-0 mt-4 list-none p-0">
            {proximos.map(e => {
              const data = diaMesDoCartaz(e.date)
              const local = [e.venue_name, e.venue_city && (e.venue_state ? `${e.venue_city}/${e.venue_state}` : e.venue_city), e.time?.slice(0, 5)]
                .filter(Boolean).join(' · ')
              const comFoto = [e.cover_image, e.image_url].some(temFoto) // sem foto, o EventoCapa cai no cartaz do v3.4 (Archivo, grão): fica de fora
              return (
                <li key={e.id}>
                  {/* Linha de cartaz (desvio (l)): data 44–72 px e título 28–44 px, menores que os da vitrine (§2 e §6) */}
                  <Link
                    to={`/event/${e.id}`}
                    className={`grid grid-cols-[72px_1fr_auto] items-center gap-4 border-b border-ev3-fio py-5 sm:grid-cols-[112px_1fr_auto] sm:gap-6 ${FOCO}`}
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
                      <h3 className="font-ev3-display text-[clamp(28px,4vw,44px)] font-bold uppercase leading-[0.92] tracking-normal text-ev3-texto [overflow-wrap:anywhere] [text-wrap:balance]">{e.title}</h3>
                      {local && <p className="mt-2 font-ev3-chrome text-[12px] leading-[1.5] text-ev3-terciario">{local}</p>}
                    </div>
                    {comFoto && (
                      <div className="w-[96px] overflow-hidden rounded-ev3-cartao sm:w-[160px]" aria-hidden="true">
                        <EventoCapa evento={e} tamanho="cartao" />
                      </div>
                    )}
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

      {/* Para quem produz: só o que está decidido e no ar (Decisões 88, 111, 214 e 228) */}
      <section className="mx-auto max-w-6xl px-4 py-12 lg:px-6" aria-labelledby="produz">
        <h2 id="produz" className={`${CHROME} text-ev3-texto`}>Para quem produz</h2>
        <dl className="m-0 mt-4">
          {[
            ['Taxa', `Hoje quem compra paga ${TAXA_PERCENTUAL}% por ingresso, mínimo ${brl(TAXA_MINIMA)} na inteira; evento gratuito não tem taxa.`],
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
          <Link to="/planos" className={BOTAO_FANTASMA}>Planos</Link>
        </div>
      </section>

      {/* Empresa e contato (os mesmos dados de /contato) */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-4 lg:px-6" aria-label="Empresa e contato">
        <p className="font-ev3-chrome text-[12px] leading-[1.5] text-ev3-terciario">
          Evoka Soluções Ltda · Rua Treze de Maio, 336, salas 33 e 34, Curitiba/PR ·{' '}
          <a href="tel:+5541997585425" className={LINK_INLINE}>(41) 99758-5425</a> ·{' '}
          <Link to="/contato" className={LINK_INLINE}>Fale com a gente</Link>
        </p>
      </section>
    </div>
  )
}
