import { useEffect, useState, useSyncExternalStore, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import ThemeToggle from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { assinarInstalacao, detectarSistema, esquecerEvento, eventoGuardado, jaInstalado } from '@/lib/instalar'
import '@/components/EventoCapa.css' // só as regras do duotone (.evcapa-duo)
import './Download.css'

// Instale o app (V11c; prancha App). Sem loja e sem download: é um atalho (PWA) na tela inicial.
// Sem service worker o app não abre sem internet; a página diz isso em vez de prometer.

const REPOUSO = { rx: 6, ry: -18 } // pose de repouso da prancha: y -18 graus, x 6 graus, sem rotateZ
const LIMITE = 25 // giro máximo para cada lado, em graus
const FATIAS = Array.from({ length: 13 }, (_, i) => i - 6) // corpo de 13 px; as de cima e de baixo claras fazem a aresta de metal

const DUO_FUNDO = { '--duo-luz': '#eaa2aa', '--duo-sombra': '#2e1519' } as CSSProperties
const DUO_INGRESSO = { '--duo-luz': '#a55c65', '--duo-sombra': '#2e1519' } as CSSProperties

function Celular({ furo }: { furo: boolean }) {
  const [ry, setRy] = useState(REPOUSO.ry)
  const [inicio, setInicio] = useState<{ x: number; ry: number } | null>(null)
  const arrastando = inicio !== null

  const pegar = (e: PointerEvent<HTMLDivElement>) => {
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* sem captura, o arraste segue enquanto o ponteiro estiver em cima */ }
    setInicio({ x: e.clientX, ry })
  }
  const mover = (e: PointerEvent<HTMLDivElement>) => {
    if (!inicio) return
    // 0,5 grau por px, só na horizontal: o gesto vertical é da rolagem da página
    setRy(Math.max(REPOUSO.ry - LIMITE, Math.min(REPOUSO.ry + LIMITE, inicio.ry + (e.clientX - inicio.x) * 0.5)))
  }
  const soltar = () => {
    if (!inicio) return
    setInicio(null)
    setRy(REPOUSO.ry)
  }

  const estiloAparelho = {
    transform: `rotateX(${REPOUSO.rx}deg) rotateY(${ry}deg)`,
    '--aro-ang': `${150 + ry * 1.6}deg`,
  } as CSSProperties

  return (
    <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center">
      {/* decorativo: o conteúdo da página não depende dele; sem foco por teclado */}
      <div
        aria-hidden="true"
        className={`cel-cena ${arrastando ? 'arrastando' : ''}`}
        onPointerDown={pegar}
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerCancel={soltar}
      >
        <div className="cel-camada cel-rola">
          <div className="cel-contato" />
          <div className="cel-camada cel-sub cel-entrada">
            <div className="cel-camada cel-sub cel-balanco">
              <div className={`cel-aparelho ${arrastando ? '' : 'volta'}`} style={estiloAparelho}>
                {FATIAS.map(z => (
                  <div key={z} className={`cel-fatia ${z === 6 ? 'luz' : z === 5 || z === -6 ? 'borda' : ''}`} style={{ transform: `translateZ(${z}px)` }} />
                ))}
                <span className="cel-botao" style={{ left: -3, top: 96, height: 22 }} />
                <span className="cel-botao" style={{ left: -3, top: 132, height: 44 }} />
                <span className="cel-botao" style={{ left: -3, top: 186, height: 44 }} />
                <span className="cel-botao" style={{ right: -3, top: 150, height: 66, boxShadow: 'inset 1px 0 0 rgb(255 255 255 / 0.25)' }} />
                <div className="cel-costas">
                  <div style={{ position: 'absolute', top: 16, left: 16, width: 64, height: 64, borderRadius: 20, background: '#15181d', boxShadow: 'inset 0 0 0 1px #5d636c' }} />
                </div>
                <div className="cel-frente">
                  <div className="cel-moldura">
                    <div className="cel-tela">
                      <div className={`cel-ilha ${furo ? 'furo' : ''}`} />
                      <TelaDeExemplo />
                      <div className="cel-reflexo" style={{ backgroundPosition: `${50 - ry * 2.2}% 0` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p aria-hidden="true" className="relative mt-2 text-center text-[13px] leading-[18px] text-muted-foreground">
        <span className="cel-dica-giro">Arraste o celular para girar</span>
        <span className="cel-dica-fixo">Tela de exemplo</span>
      </p>
    </div>
  )
}

// Ingresso ilustrativo: nenhum dado real (data, hora, local e titular são marcadores)
function TelaDeExemplo() {
  return (
    <div className="cel-390">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 34px 0 40px', fontWeight: 600, fontSize: 17, lineHeight: '22px' }}>
        <span>9:41</span>
        <span style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 12 }}>
          {[4, 6, 9, 12].map(h => <span key={h} style={{ width: 3, height: h, background: '#fff', borderRadius: 1 }} />)}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 56, padding: '8px 24px 0' }}>
        <I.SetaEsquerda size={22} />
        <span style={{ flex: 1, fontWeight: 600, fontSize: 16, lineHeight: '20px' }}>Evento de exemplo</span>
      </div>
      <div className="cel-recorte" style={{ position: 'relative', margin: '8px 27px 0', borderRadius: 20, overflow: 'hidden' }}>
        <div className="evcapa-duo" style={DUO_INGRESSO}><img src="/images/concert-1.jpg" alt="" /></div>
        <div style={{ position: 'relative', padding: '24px 20px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, fontSize: 15, lineHeight: '20px', paddingTop: 14 }}>Evokaa</span>
            <span style={{ textAlign: 'right' }}><span className="cel-rot">Ingresso</span><span className="cel-num">Setor · Inteira</span></span>
          </div>
          <span className="cel-rot" style={{ marginTop: 16 }}>Evento</span>
          <div className="cel-nome">Nome do evento</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', marginTop: 14 }}>
            <span><span className="cel-rot">Data</span><span className="cel-num">00/00</span></span>
            <span><span className="cel-rot">Portas</span><span className="cel-num">00h</span></span>
            <span style={{ textAlign: 'right' }}><span className="cel-rot">Lote</span><span className="cel-num">1º</span></span>
          </div>
          <div style={{ marginTop: 14 }}><span className="cel-rot">Local</span><span className="cel-num">Local do evento</span></div>
          <div style={{ marginTop: 18, background: '#fff', borderRadius: 12, padding: 12, textAlign: 'center', color: '#0b0d12' }}>
            <QRCodeSVG value="Exemplo: QR do ingresso Evokaa" size={224} marginSize={0} fgColor="#0b0d12" bgColor="#ffffff" style={{ display: 'block', margin: '0 auto' }} />
            <div style={{ marginTop: 6, fontFamily: "'Archivo', system-ui, sans-serif", fontWeight: 600, fontSize: 15, lineHeight: '20px', letterSpacing: '0.08em' }}>EVK-0000-0000</div>
          </div>
          <span className="cel-rot" style={{ marginTop: 14 }}>Titular</span>
          <div style={{ fontWeight: 600, fontSize: 15, lineHeight: '20px' }}>Seu nome</div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: '50%', bottom: 10, width: 134, height: 5, marginLeft: -67, borderRadius: 3, background: '#fff', opacity: 0.85 }} />
    </div>
  )
}

function Passo({ icone: Icone, n, children }: { icone: typeof I.Celular; n: number; children: ReactNode }) {
  return (
    <li className="flex min-h-16 items-center gap-3.5 border-b border-border">
      <span aria-hidden="true" className="grid size-10 flex-none place-items-center rounded-ev-xl bg-secondary text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))]">
        <Icone size={20} />
      </span>
      <span className="flex-1 text-[15px] leading-5 [&_b]:font-semibold">
        <span className="mr-1.5 font-display text-[13px] font-semibold tabular-nums text-muted-foreground">{n}</span>
        {children}
      </span>
    </li>
  )
}

function Nota({ icone: Icone, children }: { icone: typeof I.Info; children: ReactNode }) {
  return (
    <p className="mt-4 flex gap-2 text-sm leading-5 text-muted-foreground">
      <Icone size={16} className="mt-0.5 flex-none" />
      <span>{children}</span>
    </p>
  )
}

export default function AppDownload() {
  const sistema = detectarSistema(navigator.userAgent, navigator.maxTouchPoints)
  const instalado = jaInstalado()
  const [aba, setAba] = useState(sistema === 'ios' ? 'ios' : 'android')
  const evento = useSyncExternalStore(assinarInstalacao, eventoGuardado)
  const [abrindo, setAbrindo] = useState(false)
  const [feito, setFeito] = useState(false)

  // o Chrome avisa quando a instalação termina, venha ela do nosso botão ou do menu
  useEffect(() => {
    const aoInstalar = () => setFeito(true)
    window.addEventListener('appinstalled', aoInstalar)
    return () => window.removeEventListener('appinstalled', aoInstalar)
  }, [])

  const instalar = async () => {
    if (!evento || abrindo) return
    setAbrindo(true)
    try {
      await evento.prompt()
      if ((await evento.userChoice).outcome === 'accepted') setFeito(true)
    } catch {
      toast.error('Não foi possível abrir o aviso de instalação. Use o menu do Chrome: Instalar app.')
    } finally {
      esquecerEvento() // o evento só vale uma vez
      setAbrindo(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden supports-[overflow:clip]:overflow-x-clip bg-background text-foreground">
      <div aria-hidden="true" className="cel-fundo" style={DUO_FUNDO}>
        <div className="evcapa-duo"><img src="/images/concert-1.jpg" alt="" fetchPriority="low" /></div>
      </div>

      <div className="relative mx-auto grid max-w-[1100px] grid-cols-1 gap-x-12 px-5 pb-8 pt-6 lg:grid-cols-2 lg:px-8 lg:pt-16">
        <header className="lg:col-start-1 lg:row-start-1">
          <h1 className="text-2xl font-semibold leading-8 tracking-[-0.015em] lg:text-[32px] lg:leading-10">A Evokaa na sua tela inicial</h1>
          <p className="mt-2 text-base leading-6 text-muted-foreground">
            Um atalho que abre seus ingressos direto, com o QR pronto para a porta. Não tem loja nem download.
          </p>
        </header>

        <Celular furo={!instalado && aba === 'android'} />

        <section className="pt-6 lg:col-start-1 lg:row-start-2 lg:pt-8">
          {instalado || feito ? (
            <div role="status" className="flex flex-col gap-4">
              <p className="flex gap-2 text-base leading-6 text-[var(--ev-success)]">
                <I.Check size={20} className="mt-0.5 flex-none" />
                {instalado ? 'O app já está instalado neste aparelho.' : 'Pronto: o ícone da Evokaa está na tela inicial.'}
              </p>
              {instalado && (
                <Button asChild size="lg" className="w-full sm:w-auto">
                  <Link to="/app/tickets">Abrir meus ingressos</Link>
                </Button>
              )}
            </div>
          ) : (
            <>
              <Tabs value={aba} onValueChange={setAba} className="gap-0">
                <TabsList variant="pilula" aria-label="Seu celular" className="h-10 w-full rounded-ev-lg bg-secondary text-muted-foreground">
                  <TabsTrigger value="ios" className="text-[13px]">iPhone</TabsTrigger>
                  <TabsTrigger value="android" className="text-[13px]">Android</TabsTrigger>
                </TabsList>
                {sistema === 'outro' && !evento && (
                  <Nota icone={I.Celular}>Está no computador? Abra esta página no celular para instalar.</Nota>
                )}

                <TabsContent value="ios" className="mt-2">
                  <ol className="m-0 list-none p-0">
                    <Passo icone={I.Carregar} n={1}>No Safari, toque em <b>Compartilhar</b>, na barra de baixo</Passo>
                    <Passo icone={I.Criar} n={2}>Role e escolha <b>Adicionar à Tela de Início</b></Passo>
                    <Passo icone={I.Celular} n={3}>Toque em <b>Adicionar</b>: o ícone aparece na tela inicial</Passo>
                  </ol>
                  <Nota icone={I.Info}>Está no Chrome ou no Edge do iPhone? Abra esta página no Safari: só ele instala o atalho.</Nota>
                </TabsContent>

                <TabsContent value="android" className="mt-2 pt-3">
                  {evento && (
                    <Button size="lg" className="w-full" onClick={instalar} loading={abrindo}>
                      Instalar na tela inicial
                    </Button>
                  )}
                  <ol className="m-0 mt-2 list-none p-0">
                    {evento ? (
                      <>
                        <Passo icone={I.Baixar} n={1}>Toque em <b>Instalar na tela inicial</b>, acima</Passo>
                        <Passo icone={I.Tela} n={2}>No aviso do Chrome, confirme em <b>Instalar</b></Passo>
                      </>
                    ) : (
                      <>
                        <Passo icone={I.Mais} n={1}>No Chrome, toque no <b>menu</b> (os três pontos), no alto da tela</Passo>
                        <Passo icone={I.Baixar} n={2}>Escolha <b>Instalar app</b> ou <b>Adicionar à tela inicial</b> e confirme</Passo>
                      </>
                    )}
                    <Passo icone={I.Celular} n={3}>O ícone da Evokaa aparece na tela inicial</Passo>
                  </ol>
                </TabsContent>
              </Tabs>

              <h2 className="mt-7 text-[15px] font-semibold leading-5">O que muda</h2>
              <ul className="m-0 mt-1 list-none p-0 text-[15px] leading-5">
                <li className="border-b border-border py-3">Abre em tela cheia, sem a barra do navegador.</li>
                <li className="border-b border-border py-3">É um atalho: quase não ocupa espaço e se atualiza sozinho.</li>
                <li className="py-3 text-muted-foreground">Por enquanto, precisa de internet para abrir os ingressos.</li>
              </ul>
            </>
          )}

          <h2 className="mb-2 mt-7 text-[15px] font-semibold leading-5">Aparência</h2>
          <ThemeToggle />

          <Link to="/" className="mt-6 inline-block text-sm text-[hsl(var(--primary-text))] underline-offset-4 hover:underline">
            Voltar para o site
          </Link>
        </section>
      </div>
    </div>
  )
}
