import { useEffect, type CSSProperties, type KeyboardEvent, type PointerEvent, type Ref } from 'react'
import { createPortal } from 'react-dom'
import { QRCodeSVG } from 'qrcode.react'
import { urlDoCertificado } from '../../lib/certificadoValidar'
import { PASSO, cssDaFonte, camposPadrao, resolverTexto, type Campo, type DadosCertificado, type Modelo } from '../../lib/certificados'

// Desenho único do certificado: serve à prévia do editor, às miniaturas da galeria e à impressão (PDF pelo navegador).
// Tudo escala com a largura da folha (unidades cqw), então texto e QR não saem do lugar em tela pequena nem na impressão.
// O texto vem só como texto do React (escapado); nada de HTML do template.

const BASE = 7 // fontSize é medido numa folha de 700 de largura: 700 / 100 cqw = 7

function Moldura({ m }: { m: Modelo }) {
  const a = m.accent
  const caixa = (estilo: CSSProperties, chave?: string) => <div key={chave} aria-hidden="true" className="pointer-events-none absolute" style={estilo} />
  switch (m.moldura) {
    case 'duplo': return <>
      {caixa({ inset: 0, border: `1.1cqw double ${a}` })}
      {caixa({ inset: '3.4cqw', border: `0.3cqw solid ${a}30`, borderRadius: '1.7cqw' })}
      {caixa({ inset: '5.7cqw', border: `0.15cqw solid ${a}15`, borderRadius: '1.7cqw' })}
    </>
    case 'lateral': return caixa({ top: 0, bottom: 0, left: 0, width: '1.2cqw', background: a })
    case 'topo': return <>{caixa({ inset: 0, border: `0.15cqw solid ${a}` })}{caixa({ top: 0, left: 0, right: 0, height: '1.2cqw', background: a })}</>
    case 'tracejado': return caixa({ inset: 0, border: `0.6cqw dashed ${a}` })
    case 'fino': return caixa({ inset: 0, border: `0.3cqw solid ${a}` })
    case 'grosso': return caixa({ inset: 0, border: `0.6cqw solid ${a}` })
    case 'moldura': return <>{caixa({ inset: '2.5cqw', border: `0.25cqw solid ${a}` })}{caixa({ inset: '3.5cqw', border: `0.1cqw solid ${a}` })}</>
    case 'faixa': return caixa({ left: 0, right: 0, bottom: 0, height: '1.6cqw', background: a })
    case 'duasfaixas': return <>{caixa({ top: 0, left: 0, right: 0, height: '0.8cqw', background: a })}{caixa({ left: 0, right: 0, bottom: 0, height: '0.8cqw', background: a })}</>
    case 'cantos': {
      const canto = { width: '7cqw', height: '7cqw' }
      const l = `0.6cqw solid ${a}`
      return <>
        {caixa({ ...canto, top: '2.5cqw', left: '2.5cqw', borderTop: l, borderLeft: l }, 'a')}
        {caixa({ ...canto, top: '2.5cqw', right: '2.5cqw', borderTop: l, borderRight: l }, 'b')}
        {caixa({ ...canto, bottom: '2.5cqw', left: '2.5cqw', borderBottom: l, borderLeft: l }, 'c')}
        {caixa({ ...canto, bottom: '2.5cqw', right: '2.5cqw', borderBottom: l, borderRight: l }, 'd')}
      </>
    }
  }
}

export interface DesenhoProps {
  modelo: Modelo
  campos: Campo[]
  logoUrl: string | null
  sigUrl: string | null
  dados: DadosCertificado
  /** Só no editor: seleção, arrastar e teclado */
  selecionado?: string | null
  onSelecionar?: (id: string) => void
  onMoverTeclado?: (id: string, dx: number, dy: number) => void
  onArrastar?: (id: string, e: PointerEvent<HTMLDivElement>) => void
  papelRef?: Ref<HTMLDivElement>
  className?: string
}

export function CertificadoDesenho({ modelo, campos, logoUrl, sigUrl, dados, selecionado, onSelecionar, onMoverTeclado, onArrastar, papelRef, className }: DesenhoProps) {
  const editando = !!onSelecionar
  const teclas = (c: Campo) => (e: KeyboardEvent<HTMLDivElement>) => {
    const passo = e.shiftKey ? PASSO.grande : PASSO.normal
    const delta: Record<string, [number, number]> = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] }
    const d = delta[e.key]
    if (d && onMoverTeclado) { e.preventDefault(); onMoverTeclado(c.id, d[0], d[1]) }
  }

  return (
    <div ref={papelRef} className={`relative w-full select-none overflow-hidden ${className ?? ''}`}
      style={{ aspectRatio: '1.414 / 1', background: modelo.bg, fontFamily: cssDaFonte(undefined, modelo.fonte), containerType: 'inline-size' }}>
      <Moldura m={modelo} />
      {campos.map(c => {
        const ehTexto = c.type === 'text' || c.type === 'date' || c.type === 'hours'
        const peso = c.bold === undefined ? (c.fontSize > 20 ? 600 : 400) : c.bold ? 700 : 400
        const estilo: CSSProperties = {
          left: `${c.x}%`, top: `${c.y}%`, width: `${c.width}%`, transform: 'translate(-50%, -50%)',
          ...(ehTexto ? { fontSize: `${c.fontSize / BASE}cqw`, lineHeight: 1.25, color: c.color, fontWeight: peso, textAlign: c.align ?? 'center', fontFamily: cssDaFonte(c.fontFamily, modelo.fonte), overflowWrap: 'anywhere' } : {}),
          ...(editando ? { touchAction: 'none', cursor: 'grab' } : {}),
        }
        const marca = editando && selecionado === c.id ? 'outline outline-2 outline-offset-2 outline-primary' : ''
        return (
          <div key={c.id} style={estilo}
            className={`absolute focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${marca}`}
            {...(editando ? {
              role: 'button', tabIndex: 0, 'aria-pressed': selecionado === c.id,
              'aria-label': `Campo ${c.label}. Setas movem, Shift move mais.`,
              onClick: () => onSelecionar?.(c.id), onFocus: () => onSelecionar?.(c.id), onKeyDown: teclas(c),
              onPointerDown: (e: PointerEvent<HTMLDivElement>) => onArrastar?.(c.id, e),
            } : {})}>
            {ehTexto && resolverTexto(c.value, dados)}
            {c.type === 'logo' && (logoUrl
              ? <img src={logoUrl} alt="Logo do evento no certificado" draggable={false} className="mx-auto block w-full object-contain" style={{ maxHeight: `${c.width * 0.8}cqw` }} />
              : editando && <div className="rounded border border-dashed border-neutral-400 py-1 text-center text-[1.4cqw] text-neutral-600">LOGO</div>)}
            {c.type === 'signature' && (sigUrl
              ? <img src={sigUrl} alt="Assinatura do produtor no certificado" draggable={false} className="mx-auto block w-full object-contain" style={{ maxHeight: `${c.width * 0.6}cqw` }} />
              : <div aria-hidden="true" style={{ borderTop: `0.2cqw solid ${modelo.suave}`, marginTop: '4cqw' }} />)}
            {c.type === 'qrcode' && (
              <QRCodeSVG value={urlDoCertificado(dados.codigo)} size={128} marginSize={1} bgColor="#ffffff" fgColor="#000000" title={`QR Code que leva à validação do certificado ${dados.codigo}`} style={{ display: 'block', width: '100%', height: 'auto' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

const DADOS_MINIATURA: DadosCertificado = { nome: 'Ana Beatriz Silva', evento: 'Workshop de Design', data: '15 de junho de 2026', horas: '8', emissao: '16/06/2026', codigo: 'EXEMPLO' }

/** Mini-prévia do próprio modelo (galeria): o mesmo desenho, em tamanho pequeno. */
export function MiniaturaModelo({ modelo, className }: { modelo: Modelo; className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none overflow-hidden rounded border border-border ${className ?? ''}`}>
      <CertificadoDesenho modelo={modelo} campos={camposPadrao(modelo)} logoUrl={null} sigUrl={null} dados={DADOS_MINIATURA} />
    </div>
  )
}

export interface ItemImpressao { dados: DadosCertificado }

/**
 * Contêiner só-impressão: fica escondido na tela (CSS .cert-print), vira A4 paisagem com uma folha por certificado
 * no @media print e esconde o resto da página (barra lateral, cabeçalho, janelas). Abre o diálogo de impressão do
 * navegador ao montar (depois de logo, assinatura e fontes carregarem); `onFim` roda quando ele fecha.
 * Quem usa deve passar uma `key` nova a cada pedido: no Safari do iPhone o `afterprint` pode não vir, e a `key` garante que o próximo clique imprima de novo.
 */
export function ImpressaoCertificados({ itens, modelo, campos, logoUrl, sigUrl, onFim }: {
  itens: ItemImpressao[]; modelo: Modelo; campos: Campo[]; logoUrl: string | null; sigUrl: string | null; onFim: () => void
}) {
  useEffect(() => {
    // @page não se limita por classe: o tamanho do papel entra só enquanto imprime
    const estilo = document.createElement('style')
    estilo.textContent = '@page { size: A4 landscape; margin: 0 }'
    document.head.appendChild(estilo)
    document.body.classList.add('imprimindo-cert')
    let vivo = true
    const limpar = () => { estilo.remove(); document.body.classList.remove('imprimindo-cert') }
    const fim = () => { limpar(); onFim() }
    window.addEventListener('afterprint', fim, { once: true })
    // espera logo, assinatura e fontes (no máximo 3 s) para o PDF não sair sem eles
    let relogio: ReturnType<typeof setTimeout> | undefined
    const imagens = [...(document.getElementById('cert-print')?.querySelectorAll('img') ?? [])]
    const prontas = Promise.all([document.fonts?.ready, ...imagens.map(i => (i.decode ? i.decode().catch(() => {}) : undefined))])
    Promise.race([prontas.catch(() => {}), new Promise(ok => { relogio = setTimeout(ok, 3000) })]).then(() => {
      clearTimeout(relogio)
      if (vivo) window.print()
    })
    return () => { vivo = false; clearTimeout(relogio); window.removeEventListener('afterprint', fim); limpar() }
    // roda uma vez por pedido de impressão: quem usa troca a `key` a cada clique, então um pedido novo remonta e imprime de novo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return createPortal(
    <div id="cert-print" className="cert-print" aria-hidden="true">
      {itens.map((it, i) => (
        <div key={i} className="cert-folha">
          <CertificadoDesenho modelo={modelo} campos={campos} logoUrl={logoUrl} sigUrl={sigUrl} dados={it.dados} />
        </div>
      ))}
    </div>,
    document.body,
  )
}
