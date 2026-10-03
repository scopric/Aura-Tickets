import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Dialog, DialogClose, DialogDescription, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger } from './ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { useAuth } from '../hooks/useAuth'
import { publicoDoPapel, useMinhasConversas } from '../hooks/useConversas'
import { JanelaSuporte, SupportChatPanel } from './SupportChatWidget'
import { BotaoSom } from './chat/ChatThread'
import EvoChat, { type Mensagem } from './evo/EvoChat'
import type { CamposPlanejar } from './evo/EvoPlanejar'

// O modal segue o tema do app (classe .dark no <html>): vidro .glass-panel/.glass-backdrop em
// index.css e pares claro/escuro nas classes de dentro.
const aba =
  'rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 data-[state=active]:bg-white/80 data-[state=active]:text-slate-900 data-[state=active]:shadow-none dark:text-slate-300 dark:hover:text-white dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white dark:data-[state=active]:border-transparent focus-visible:ring-2 focus-visible:ring-violet-600 dark:focus-visible:ring-violet-300 focus-visible:outline-none'

// Balão de convite: some depois que a pessoa abre o Evo uma vez ou fecha o balão 3 vezes.
// Sem localStorage (modo privado, cota), vale só a memória desta carga: aparece uma vez.
const CHAVE_CONVITE = 'evo-convite-v1'
type Convite = { aberto: boolean; fechados: number }
function lerConvite(): Convite | null {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_CONVITE) ?? 'null')
    return v && typeof v === 'object' ? { aberto: !!v.aberto, fechados: Number(v.fechados) || 0 } : { aberto: false, fechados: 0 }
  } catch {
    return null
  }
}
function gravarConvite(mudar: (c: Convite) => Convite) {
  try {
    localStorage.setItem(CHAVE_CONVITE, JSON.stringify(mudar(lerConvite() ?? { aberto: false, fechados: 0 })))
  } catch {
    // sem storage: segue só em memória
  }
}

type Balao = 'convite' | 'resposta' | 'aviso' | null

/**
 * Evo flutuante de corpo inteiro no canto inferior direito (áreas do produtor e do participante)
 * + modal central de vidro. Produtor/admin: abas Evo e "Falar com a Evokaa"; participante: só o
 * "Falar com a Evokaa". Efeito 3D só com CSS (keyframes evo-* em index.css), parado com
 * prefers-reduced-motion. O Content do Radix fica dentro do overlay (padrão "scrollable overlay"
 * do Radix) porque o DialogContent do shadcn embute um overlay sem desfoque.
 */
export default function EvoHub() {
  const { user } = useAuth()
  const [aberto, setAberto] = useState(false)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  // Ficam aqui (e não no EvoChat) para sobreviver ao fechar o painel: sem envio duplo, sem perder o texto
  const [texto, setTexto] = useState('')
  const [pensando, setPensando] = useState(false)
  const [formPlanejar, setFormPlanejar] = useState<CamposPlanejar | null>(null)
  // Resposta que chegou com o painel fechado: selo, balão, pulinho e anúncio (zeram ao abrir; não persistem)
  const [naoLidas, setNaoLidas] = useState(0)
  const [balao, setBalao] = useState<Balao>(null)
  const [pulando, setPulando] = useState(false)
  const abertoRef = useRef(aberto)
  const mascoteRef = useRef<HTMLButtonElement>(null)
  const { pathname } = useLocation()
  const podeEvo = user?.role === 'producer' || user?.role === 'admin'
  // Respostas da equipe não lidas (a aba "Falar com a Evokaa"); o canal do Realtime fica aqui porque o EvoHub não desmonta
  const { naoLidas: naoLidasSuporte } = useMinhasConversas(true)

  useEffect(() => {
    abertoRef.current = aberto
  }, [aberto])

  // Convite ~2 s depois de carregar
  useEffect(() => {
    const t = setTimeout(() => {
      const c = lerConvite()
      if (!abertoRef.current && (!c || (!c.aberto && c.fechados < 3))) setBalao((b) => b ?? 'convite')
    }, 2000)
    return () => clearTimeout(t)
  }, [])

  // O aviso de resposta some sozinho em 8 s (o selo fica)
  useEffect(() => {
    if (balao !== 'resposta' && balao !== 'aviso') return
    const t = setTimeout(() => setBalao(null), 8000)
    return () => clearTimeout(t)
  }, [balao])

  const mudarAberto = (a: boolean) => {
    setAberto(a)
    if (!a) return
    gravarConvite((c) => ({ ...c, aberto: true }))
    setBalao(null)
    setNaoLidas(0)
  }

  const fecharBalao = () => {
    if (balao === 'convite') gravarConvite((c) => ({ ...c, fechados: c.fechados + 1 }))
    setBalao(null)
  }

  const aoResponder = (aviso: boolean) => {
    if (abertoRef.current) return
    setBalao(aviso ? 'aviso' : 'resposta')
    setNaoLidas((n) => n + 1)
    setPulando(true)
  }

  // Ajuste durante o render (sem efeito): ao seguir um link de dentro do painel (ex.: "Abrir
  // rascunho") ele fecha; ao trocar de conta, a conversa anterior não fica na tela.
  const [visto, setVisto] = useState({ pathname, dono: user?.id })
  if (visto.pathname !== pathname || visto.dono !== user?.id) {
    if (visto.dono !== user?.id) {
      setMensagens([])
      setTexto('')
      setFormPlanejar(null)
      setNaoLidas(0)
    }
    // o painel do participante é não modal: segue aberto ao navegar (só fecha ao trocar de conta)
    if (podeEvo || visto.dono !== user?.id) setAberto(false)
    setVisto({ pathname, dono: user?.id })
  }

  // Derivado do selo; o número muda a cada resposta porque o leitor de tela não reanuncia um
  // aria-live com o mesmo texto
  const anuncio = naoLidas === 0 ? '' : naoLidas === 1 ? 'Nova resposta do Evo' : `Nova resposta do Evo (${naoLidas})`
  const pensandoFechado = pensando && !aberto
  const selo = naoLidas + naoLidasSuporte
  const rotulo = pensandoFechado
    ? 'O Evo está pensando na sua resposta'
    : selo > 0 ? `Falar com o Evo (${selo} ${selo === 1 ? 'resposta nova' : 'respostas novas'})` : 'Falar com o Evo'
  const textoBalao = {
    convite: podeEvo ? 'Oi! Sou o Evo 👋 Posso te ajudar a\u00A0planejar seu evento.' : 'Oi! Sou o Evo 👋 Precisa de ajuda?',
    resposta: 'O Evo respondeu! Toque para ver.',
    aviso: 'O Evo tem um aviso para você',
  }

  return (
    // Produtor/admin: modal central com as abas Evo e "Falar com a Evokaa". Participante: janela
    // flutuante não modal (estilo Intercom) acima do mascote; a página segue rolável e clicável.
    <Dialog open={podeEvo && aberto} onOpenChange={mudarAberto}>
      {!podeEvo && aberto && (
        <JanelaSuporte
          publico={publicoDoPapel(user?.role)}
          aoFechar={() => {
            mudarAberto(false)
            mascoteRef.current?.focus()
          }}
          posicao="bottom-36 h-[min(620px,calc(100dvh-10rem))]"
        />
      )}
      {/* --barra-cel: topo da barra inferior do celular do produtor (BarraCelular); sem ela vale 0 */}
      <div data-tour="evo" className="fixed bottom-[calc(1.5rem+var(--barra-cel,0px))] right-6 z-50">
        <p className="sr-only" role="status" aria-live="polite">{anuncio}</p>

        {balao && !aberto && (
          // < 380 px o balão cobriria o conteúdo: não aparece (o selo e o anúncio continuam)
          <div
            className="glass-panel absolute bottom-14 right-full mr-3 flex w-max max-w-[min(260px,calc(100vw-7.5rem))] items-start gap-0.5 py-2 pl-3.5 pr-1 text-sm leading-snug max-[379px]:hidden rounded-[18px] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-2"
          >
            <button
              type="button"
              onClick={() => mudarAberto(true)}
              className="rounded-md text-left font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 dark:focus-visible:ring-violet-300"
            >
              {balao === 'convite' ? (
                <>
                  <span className="sm:hidden">Oi! Sou o Evo 👋</span>
                  <span className="hidden sm:inline">{textoBalao.convite}</span>
                </>
              ) : textoBalao[balao]}
            </button>
            <button
              type="button"
              onClick={fecharBalao}
              aria-label="Fechar aviso do Evo"
              className="shrink-0 rounded-md p-0.5 text-slate-700 hover:bg-slate-900/5 dark:text-slate-300 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 dark:focus-visible:ring-violet-300"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            {/* seta apontando para o Evo */}
            <span aria-hidden="true" className="glass-panel absolute -right-2 bottom-4 h-3.5 w-2 [clip-path:polygon(0_0,100%_50%,0_100%)] rounded-none" />
          </div>
        )}

        {/* sombra elíptica no "chão": encolhe e clareia quando o Evo sobe */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-1.5 left-0 right-0 mx-auto h-2.5 w-12 rounded-[50%] bg-black/45 blur-[3px] motion-safe:animate-[evo-sombra_3s_ease-in-out_infinite]"
        />
        <div className="[perspective:600px] motion-safe:animate-[evo-flutuar_3s_ease-in-out_infinite]">
          <Tooltip>
            <TooltipTrigger asChild>
              <DialogTrigger asChild>
                <button
                  ref={mascoteRef}
                  type="button"
                  aria-label={rotulo}
                  // participante: o clique alterna a janela flutuante; preventDefault impede o DialogTrigger de abrir o modal
                  {...(!podeEvo && {
                    'aria-expanded': aberto,
                    'aria-controls': undefined,
                    onClick: (e: React.MouseEvent) => {
                      e.preventDefault()
                      mudarAberto(!aberto)
                    },
                  })}
                  // Sem caixa no foco (o Radix devolve o foco aqui ao fechar e o anel desenhava uma moldura):
                  // o foco de teclado é o contorno no próprio Evo (group-focus-visible na <img>)
                  className="group relative block outline-none transition-transform duration-200 motion-safe:hover:[transform:rotateX(10deg)_rotateY(-10deg)_scale(1.08)] motion-safe:focus-visible:[transform:rotateX(10deg)_rotateY(-10deg)_scale(1.08)] motion-reduce:transition-none"
                >
                  {pensandoFechado && (
                    // anel "pensando" atrás do DJ
                    <span aria-hidden="true" className="pointer-events-none absolute inset-0 m-auto h-20 w-20 rounded-full border-2 border-violet-500/70 border-t-transparent motion-safe:animate-[spin_1.6s_linear_infinite]" />
                  )}
                  <span
                    className={`relative block ${pulando ? 'motion-safe:animate-[evo-pulinho_0.6s_ease-out]' : ''}`}
                    onAnimationEnd={(e) => e.animationName === 'evo-pulinho' && setPulando(false)}
                  >
                    <img
                      src={pensandoFechado ? '/evo/evo-corpo-dj.webp' : '/evo/evo-corpo-acenando.webp'}
                      alt=""
                      width={pensandoFechado ? 69 : 51}
                      height={92}
                      // drop-shadow não tem espessura: 4 sombras deslocadas 2 px fazem o contorno; animate-none
                      // porque o keyframe evo-brilho também mexe no filter e cobriria o foco
                      className="h-[92px] w-auto [filter:drop-shadow(0_0_8px_rgba(143,51,245,0.55))] motion-safe:animate-[evo-brilho_4s_ease-in-out_infinite] group-focus-visible:animate-none group-focus-visible:[filter:drop-shadow(2px_0_0_#4c1d95)_drop-shadow(-2px_0_0_#4c1d95)_drop-shadow(0_2px_0_#4c1d95)_drop-shadow(0_-2px_0_#4c1d95)_drop-shadow(0_0_10px_rgba(143,51,245,0.95))] dark:group-focus-visible:[filter:drop-shadow(2px_0_0_#fff)_drop-shadow(-2px_0_0_#fff)_drop-shadow(0_2px_0_#fff)_drop-shadow(0_-2px_0_#fff)_drop-shadow(0_0_10px_rgba(143,51,245,0.95))]"
                    />
                  </span>
                  {selo > 0 && (
                    <span aria-hidden="true" className="absolute -top-1 right-0 grid h-5 min-w-5 place-items-center rounded-full bg-plum px-1 text-[11px] font-bold text-[#fff] ring-2 ring-[#f8fafc] dark:ring-[#07080c]">
                      {selo}
                    </span>
                  )}
                </button>
              </DialogTrigger>
            </TooltipTrigger>
            {/* com o balão na tela o rótulo repetiria o convite por cima dele */}
            {!(balao && !aberto) && <TooltipContent side="left">Falar com o Evo</TooltipContent>}
          </Tooltip>
        </div>
      </div>

      <DialogPortal>
        <DialogOverlay className="glass-backdrop grid place-items-center overflow-y-auto p-3 duration-200 motion-reduce:animate-none">
          <DialogPrimitive.Content
            className="glass-panel relative flex h-full w-full max-w-2xl flex-col overflow-hidden outline-none duration-200 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.96] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.96] motion-reduce:animate-none sm:h-[min(82vh,760px)]"
          >
            <div className="flex items-center justify-between px-5 pb-3 pt-4">
              <DialogTitle className="text-base font-semibold">Central do Evo</DialogTitle>
              <DialogDescription className="sr-only">
                Assistente de IA e conversa com a equipe da Evokaa
              </DialogDescription>
              <BotaoSom className="ml-auto mr-1 text-slate-700 hover:bg-slate-900/5 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white" />
              <DialogClose
                aria-label="Fechar central do Evo"
                className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-900/5 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 dark:focus-visible:ring-violet-300"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </DialogClose>
            </div>

            <Tabs defaultValue="evo" className="min-h-0 flex-1 gap-0">
              <TabsList variant="pilula" className="mx-5 mb-3 h-auto w-auto justify-start gap-1 overflow-x-auto rounded-xl bg-slate-900/5 p-1 dark:bg-white/[0.05]">
                <TabsTrigger value="evo" className={aba}>Evo</TabsTrigger>
                <TabsTrigger value="suporte" className={aba}>Falar com a Evokaa</TabsTrigger>
              </TabsList>

              {/* forceMount + hidden: trocar de aba não apaga o que foi digitado (o suporte já guarda tudo no banco) */}
              <TabsContent value="evo" forceMount className="min-h-0 flex-col data-[state=active]:flex data-[state=inactive]:hidden">
                <EvoChat
                  mensagens={mensagens}
                  setMensagens={setMensagens}
                  texto={texto}
                  setTexto={setTexto}
                  pensando={pensando}
                  setPensando={setPensando}
                  formPlanejar={formPlanejar}
                  setFormPlanejar={setFormPlanejar}
                  onResposta={aoResponder}
                />
              </TabsContent>
              <TabsContent value="suporte" className="min-h-0 flex-col border-t border-slate-900/10 dark:border-white/10 data-[state=active]:flex data-[state=inactive]:hidden">
                <SupportChatPanel />
              </TabsContent>
            </Tabs>
          </DialogPrimitive.Content>
        </DialogOverlay>
      </DialogPortal>
    </Dialog>
  )
}
