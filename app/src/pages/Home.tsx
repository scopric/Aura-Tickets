import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useSEO } from '../hooks/useSEO'
import { useFeaturedEvents } from '../hooks/useEvents'
import { appUrl } from '../lib/appHost'
import { registerUrl } from '../lib/affiliateRef'
import { TAXA_PERCENTUAL, TAXA_MINIMA, brl } from '../lib/taxa'
import { planName } from '../lib/plans'
import { diaMesDoCartaz, temFoto } from '../lib/corEvento'
import EvoCena from '../components/evo3d/EvoCena'
import EventoCapa from '../components/EventoCapa'
import FormContato from '../components/home/FormContato'

// Home v3.0 (Modo Refero, Fase 4, tela 1; Decisões 244–246, 248, 252 e 253): palco preto, o Evo 3D é o herói e o chrome é
// fantasma. Regras em DESIGN-SYSTEM.md; tokens ev3-* (tokens-v3.css). A 2ª passada (Decisão 253) trouxe de volta, na
// pele v3, as seções da Home antiga: recursos, como funciona, planos (números da Decisão 171), perguntas, contato e
// chamada final. Conteúdo só do que existe: taxa de lib/taxa.ts (a que o checkout cobra hoje, Decisão 111), eventos
// reais de useFeaturedEvents, Pix hoje (Decisão 228); nenhum número de volume.

const FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ev3-foco focus-visible:ring-offset-2 focus-visible:ring-offset-black'
const CHROME = 'font-ev3-chrome text-[14px] font-bold leading-[1.2] tracking-normal'
const SECAO = 'mx-auto max-w-6xl scroll-mt-[76px] px-4 py-12 lg:px-6'
const TITULO_PAGINA = 'font-ev3-chrome text-[clamp(28px,4vw,44px)] font-bold leading-[1.05] tracking-normal text-ev3-texto [text-wrap:balance]'
// Botão fantasma (DESIGN-SYSTEM §6): raio 5, contorno #999, vidro no hover; o principal (pílula violeta) aparece uma vez só
const BOTAO_FANTASMA = `inline-flex h-12 items-center justify-center rounded-ev3-controle border border-ev3-contorno px-[18px] text-ev3-texto transition-colors [transition-duration:var(--ev3-mov-micro)] [transition-timing-function:var(--ev3-curva-sai)] hover:bg-ev3-vidro ${CHROME} ${FOCO}`
const LINK_INLINE = `alvo-44 whitespace-nowrap text-ev3-terciario underline decoration-ev3-fio underline-offset-4 hover:text-ev3-texto ${FOCO}`

// Só o que está no ar (arquiteto, 02/11): Brand Studio, "comprovação social" e Marketing são páginas "em breve" e não entram
const RECURSOS: [string, string][] = [
  ['Criar', 'Só o nome é obrigatório para começar. O resto você completa no painel ou copia de um evento anterior.'],
  ['Ingressos', 'Lotes, meia-entrada, cupons de desconto e a lista de participantes de cada evento.'],
  ['Marca', 'Sua logo no ingresso e no certificado do participante.'],
  ['Divulgação', 'Link e QR Code do evento, banners e lista de interesse. Você já pode vincular afiliados aos seus eventos; o link de cada um chega em breve.'],
  ['Equipe', 'Sua equipe confere a entrada pelo próprio celular: câmera, código ou busca pelo nome.'],
  ['Vendas', 'Vendas, ingressos do período e ticket médio de cada evento, no painel.'],
]

const COMO_FUNCIONA: [string, string][] = [
  ['Crie', 'Tipo de evento, data, local e lotes. A taxa aparece no preço antes de publicar.'],
  ['Gerencie', 'Vendas, participantes, equipe e cronograma no mesmo painel.'],
  ['Venda', 'Publique, receba por Pix e confira na porta pelo QR Code.'],
]

// Decisão 171 (06/10): preço de lançamento e taxa de serviço por plano (+ 2,5 % de processamento). Fica aqui, e não em
// lib/plans.ts, porque o checkout, a assinatura e a base do Evo ainda leem os valores antigos (pendência 351); os créditos
// do Evo ficam de fora até a cota do banco (ai_settings) ser alinhada à 171.
const PLANOS = [
  { id: 'free', preco: 0, taxa: '9,7' },
  { id: 'starter', preco: 37, taxa: '7,7' },
  { id: 'plus', preco: 97, taxa: '5,7' },
  { id: 'pro', preco: 197, taxa: '3,7' },
  { id: 'enterprise', preco: 397, taxa: '2,7' },
]

const PERGUNTAS: [string, string][] = [
  ['O que é a Evokaa?', 'Uma plataforma brasileira para criar eventos, vender ingressos e conferir a entrada.'],
  ['Quanto custa usar a Evokaa?', `Criar conta é gratuito. Hoje quem compra paga ${TAXA_PERCENTUAL}% de taxa de serviço por ingresso, mínimo ${brl(TAXA_MINIMA)}; evento gratuito não tem taxa. Os planos para quem produz estão na seção Planos, acima.`],
  ['Como funciona o Match de Mesa?', 'É um ingresso de mesa compartilhada. Você responde um perfil rápido, vê o primeiro nome e a faixa de idade de quem já está em cada mesa e escolhe a sua; a formação automática das mesas, 24 horas antes do evento, chega em breve.'],
  ['Posso ter afiliados vendendo meus ingressos?', 'Você já pode vincular afiliados a um evento, com o percentual de comissão de cada um. O link de divulgação do afiliado e o registro das vendas dele ainda estão em construção.'],
  ['Quais formas de pagamento são aceitas?', 'Na compra de ingressos, hoje aceitamos Pix. O pagamento por cartão de crédito chega em breve.'],
  ['Como funciona o check-in?', 'Na porta, sua equipe confere pelo celular: lê o QR Code com a câmera, digita o código do ingresso ou busca o nome na lista. Precisa de internet.'],
  ['A Evokaa funciona para qualquer tipo de evento?', 'Sim: festas, shows, workshops, palestras, eventos corporativos, networking, gastronomia, esportes e outros.'],
  ['Como entro em contato com o suporte?', 'Pelo botão de feedback no canto da página, pelo formulário abaixo ou pelo WhatsApp (41) 99758-5425.'],
]

// Linha de informação (DESIGN-SYSTEM §6, empréstimo DICE): rótulo em chrome à esquerda, valor em corpo à direita, fio embaixo
function Linhas({ itens }: { itens: [string, ReactNode][] }) {
  return (
    <dl className="m-0 mt-4">
      {itens.map(([rotulo, valor]) => (
        <div key={rotulo} className="grid gap-2 border-b border-ev3-fio py-3 sm:grid-cols-[160px_1fr] sm:gap-6">
          <dt className="font-ev3-chrome text-[12px] uppercase leading-[1.5] text-ev3-terciario">{rotulo}</dt>
          <dd className="m-0 max-w-[60ch] text-[16px] leading-[1.88] text-ev3-texto">{valor}</dd>
        </div>
      ))}
    </dl>
  )
}

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
          <h1 className={TITULO_PAGINA}>
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
      <section className={SECAO} aria-labelledby="agora">
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

      {/* Recursos em linhas de informação, sem grade bento, sem ícone, sem número de volume */}
      <section className={SECAO} aria-labelledby="recursos">
        <h2 id="recursos" className={`${CHROME} text-ev3-texto`}>O que você tem</h2>
        <Linhas itens={RECURSOS} />
      </section>

      {/* Três passos, sem 01/02/03 (reference lock) */}
      <section className={SECAO} aria-labelledby="como">
        <h2 id="como" className={`${CHROME} text-ev3-texto`}>Como funciona</h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-3">
          {COMO_FUNCIONA.map(([titulo, texto]) => (
            <div key={titulo} className="border-t border-ev3-fio pt-5">
              {/* classe explícita: o index.css dá tamanho grande a todo h3 */}
              <h3 className={`${CHROME} text-ev3-texto`}>{titulo}</h3>
              <p className="mt-2 text-[16px] leading-[1.88] text-ev3-terciario">{texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Para quem produz: só o que está decidido e no ar (Decisões 88, 111, 214 e 228) */}
      <section className={SECAO} aria-labelledby="produz">
        <h2 id="produz" className={`${CHROME} text-ev3-texto`}>Para quem produz</h2>
        <Linhas
          itens={[
            ['Taxa', `Hoje quem compra paga ${TAXA_PERCENTUAL}% por ingresso, mínimo ${brl(TAXA_MINIMA)} na inteira; evento gratuito não tem taxa.`],
            ['Pagamento', 'Pix hoje. Cartão de crédito em breve.'],
            ['Na porta', 'QR Code conferido na entrada. Seus dados tratados conforme a LGPD.'],
          ]}
        />
      </section>

      {/* Planos (Decisão 171): grade de fios sobre o preto, preço em display (papel permitido, §2) */}
      <section id="planos" className={SECAO} aria-labelledby="planos-titulo">
        <h2 id="planos-titulo" className={`${CHROME} text-ev3-texto`}>Planos</h2>
        <p className="mt-4 max-w-[60ch] text-[16px] leading-[1.88] text-ev3-terciario">
          Valores de lançamento dos planos, que passam a valer quando a assinatura abrir; quem fechar até o lançamento comercial fica com o preço por um ano. Até lá, a conta é gratuita e quem compra paga a taxa de {TAXA_PERCENTUAL}%, mínimo {brl(TAXA_MINIMA)}. Nos planos, a taxa de serviço incide sobre cada ingresso vendido, mais 2,5% de processamento; evento gratuito não paga taxa.
        </p>
        <ul className="m-0 mt-6 list-none border-t border-ev3-fio p-0 lg:grid lg:grid-cols-5 lg:border-l">
          {PLANOS.map(p => (
            <li key={p.id} className="border-b border-ev3-fio py-6 lg:border-r lg:px-6">
              <h3 className={`${CHROME} text-ev3-texto`}>{planName(p.id)}</h3>
              <p className="mt-3">
                <span className="font-ev3-display text-[28px] font-bold leading-none tracking-normal text-ev3-texto">{p.preco ? `R$ ${p.preco}` : 'Grátis'}</span>
                {p.preco > 0 && <span className="ml-1.5 font-ev3-chrome text-[12px] leading-[1.5] text-ev3-terciario">/mês</span>}
              </p>
              <p className="mt-3 font-ev3-chrome text-[12px] leading-[1.5] text-ev3-terciario">Taxa de serviço {p.taxa}%</p>
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-[60ch] text-[16px] leading-[1.88] text-ev3-terciario">
          Durante o lançamento, todos os recursos estão liberados em todos os planos.
        </p>
        <div className="pt-6">
          <Link to="/planos" className={BOTAO_FANTASMA}>Ver os planos em detalhe</Link>
        </div>
      </section>

      {/* Perguntas frequentes: details/summary nativo, marcador em texto, sem animação */}
      <section id="faq" className={SECAO} aria-labelledby="faq-titulo">
        <h2 id="faq-titulo" className={`${CHROME} text-ev3-texto`}>Perguntas frequentes</h2>
        <div className="mt-4">
          {PERGUNTAS.map(([pergunta, resposta]) => (
            <details key={pergunta} className="group border-b border-ev3-fio">
              <summary className={`flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden ${FOCO}`}>
                <span className={`${CHROME} text-ev3-texto`}>{pergunta}</span>
                <span aria-hidden="true" className="font-ev3-chrome text-[20px] leading-none text-ev3-terciario">
                  <span className="group-open:hidden">+</span>
                  <span className="hidden group-open:inline">−</span>
                </span>
              </summary>
              <p className="max-w-[60ch] pb-5 text-[16px] leading-[1.88] text-ev3-terciario">{resposta}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Contato: dados à esquerda, formulário à direita (mesmo envio de /contato) */}
      <section id="contato" className={SECAO} aria-labelledby="contato-titulo">
        <h2 id="contato-titulo" className={`${CHROME} text-ev3-texto`}>Fale com a gente</h2>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <Linhas
            itens={[
              ['E-mail', <a href="mailto:contato@evokaa.com.br" className={LINK_INLINE}>contato@evokaa.com.br</a>],
              ['Telefone', <><a href="tel:+5541997585425" className={LINK_INLINE}>(41) 99758-5425</a>{' · '}<a href="https://wa.me/5541997585425" target="_blank" rel="noopener noreferrer" className={LINK_INLINE}>WhatsApp</a></>],
              ['Endereço', 'Rua Treze de Maio, 336, salas 33 e 34, Curitiba/PR'],
              ['Atendimento', 'Segunda a sexta, 9h às 18h; sábado, 10h às 14h.'],
              ['Empresa', 'Evoka Soluções Ltda'],
            ]}
          />
          <div className="mt-4 rounded-ev3-cartao border border-ev3-fio p-7">
            <FormContato />
          </div>
        </div>
      </section>

      {/* Chamada final em botões fantasma: o violeta da Home é só do herói (desvio (m)) */}
      <section className={`${SECAO} pb-28`} aria-labelledby="final">
        <h2 id="final" className={TITULO_PAGINA}>Crie o seu evento.</h2>
        <p className="mt-4 max-w-[44ch] text-[16px] leading-[1.88] text-ev3-terciario">Comece no plano gratuito. A taxa só existe no ingresso vendido.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to={registerUrl(appUrl, true)} className={BOTAO_FANTASMA}>Criar meu evento</Link>
          <a href="#contato" className={BOTAO_FANTASMA}>Falar com a gente</a>
        </div>
      </section>
    </div>
  )
}
