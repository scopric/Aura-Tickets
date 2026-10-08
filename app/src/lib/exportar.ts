import { supabase } from './supabase'

// Exportador do painel do produtor: PDF e XLSX já saem prontos (logo, cabeçalho, formatos), o produtor não arruma nada.
// CSV continua em exportCsv.ts. As bibliotecas de PDF entram por import dinâmico: só carregam quando o produtor clica.

export function baixarBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000) // Safari e Firefox cancelam o download se revogar antes
}

/** Mensagem que o servidor mandou (em error.context, uma Response) ou o texto padrão. */
async function mensagemDoServidor(error: unknown, padrao: string) {
  try {
    const corpo = await (error as { context?: Response }).context?.json()
    return typeof corpo?.error === 'string' ? corpo.error : padrao
  } catch { return padrao }
}

/** XLSX do Borderô: montado no servidor com o token do produtor (a RLS e o 2FA valem). Lança Error com texto para o produtor. */
export async function baixarBorderoXlsx(eventId: string, pessoais: boolean, nome: string) {
  const { data, error } = await supabase.functions.invoke('bordero-xlsx', { body: { eventId, pessoais } })
  if (error || !(data instanceof Blob)) throw new Error(await mensagemDoServidor(error, 'Não consegui gerar a planilha. Tente de novo em instantes.'))
  baixarBlob(data, nome)
}

export type ColunaPdf = { titulo: string; chave: string; direita?: boolean }
export type OpcoesPdf = {
  arquivo: string
  titulo: string
  evento: string
  produtora?: string
  /** URL pública da logo do produtor (producer_profiles.logo_url): vai no canto direito do cabeçalho */
  logoProdutor?: string | null
  resumo?: [string, string][]
  colunas: ColunaPdf[]
  linhas: Record<string, string>[]
  /** o arquivo leva nome ou e-mail de comprador: o cabeçalho avisa */
  pessoais?: boolean
}

const MARCA: [number, number, number] = [12, 35, 64]
const ACENTO: [number, number, number] = [29, 104, 196]

// Imagem (URL pública) como PNG em data URL, com as medidas. Passa pelo canvas: o jsPDF não lê WebP e o PNG mantém a transparência.
// Falha de rede, CORS ou formato = null: o PDF sai sem essa imagem.
async function imagemComoPng(url: string): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(5000) }) // Storage que trava não pode prender o botão
    if (!r.ok) return null
    // decodifica já reduzida (480 px de largura): arquivo que declara dezenas de milhares de pixels não estoura a memória
    const bmp = await createImageBitmap(await r.blob(), { resizeWidth: 480, resizeQuality: 'high' })
    try {
      const c = document.createElement('canvas')
      c.width = bmp.width; c.height = bmp.height
      c.getContext('2d')?.drawImage(bmp, 0, 0)
      return { dataUrl: c.toDataURL('image/png'), w: bmp.width, h: bmp.height }
    } finally { bmp.close() }
  } catch { return null }
}

/** PDF A4 em pé: logo e cabeçalho em toda página, resumo na primeira, tabela paginada com cabeçalho repetido e rodapé "Página X de Y". */
export async function baixarPdf(o: OpcoesPdf) {
  const [{ jsPDF }, { default: autoTable }, logoEvokaa, logoProd] = await Promise.all([import('jspdf'), import('jspdf-autotable'), imagemComoPng('/images/logo-evokaa-sm.png'), o.logoProdutor ? imagemComoPng(o.logoProdutor) : null])
  const logo = logoEvokaa?.dataUrl
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const larg = doc.internal.pageSize.getWidth()
  const alt = doc.internal.pageSize.getHeight()
  const gerado = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })

  const cabecalho = () => {
    if (logo) doc.addImage(logo, 'PNG', 40, 28, 38, 36)
    if (logoProd) { // até 110 x 36 pt, na proporção do arquivo, encostada na margem direita
      const esc = Math.min(1, 110 / logoProd.w, 36 / logoProd.h)
      doc.addImage(logoProd.dataUrl, 'PNG', larg - 40 - logoProd.w * esc, 28, logoProd.w * esc, logoProd.h * esc)
    }
    doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(...MARCA).text(o.titulo, 88, 44)
    doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(90, 100, 118).text([o.evento, o.produtora, `gerado em ${gerado}`].filter(Boolean).join(' · '), 88, 60)
    doc.setDrawColor(...ACENTO).setLineWidth(1.2).line(40, 74, larg - 40, 74)
  }
  cabecalho()
  const nasProximas = (d: { pageNumber: number }) => { if (d.pageNumber > 1) cabecalho() }

  let y = 92
  if (o.pessoais) {
    doc.setFillColor(255, 244, 214).rect(40, y - 10, larg - 80, 24, 'F')
    doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(122, 75, 0)
      .text('Contém dados pessoais de compradores. Uso restrito: não encaminhe nem publique (LGPD).', 48, y + 5)
    y += 30
  }
  if (o.resumo?.length) {
    autoTable(doc, {
      startY: y, body: o.resumo, theme: 'plain', margin: { left: 40, right: 40, top: 90 },
      styles: { fontSize: 10, cellPadding: { top: 3, bottom: 3, left: 0, right: 8 }, textColor: [30, 40, 60] },
      columnStyles: { 0: { textColor: [90, 100, 118], cellWidth: 200 }, 1: { halign: 'right', fontStyle: 'bold' } },
      didDrawPage: nasProximas,
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18
  }
  autoTable(doc, {
    startY: y,
    head: [o.colunas.map(c => c.titulo)],
    body: o.linhas.map(l => o.colunas.map(c => l[c.chave] ?? '')),
    margin: { left: 40, right: 40, top: 90, bottom: 40 },
    styles: { fontSize: 8.5, cellPadding: 4, textColor: [30, 40, 60], lineColor: [213, 218, 227], lineWidth: 0.3 },
    headStyles: { fillColor: MARCA, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [244, 246, 249] },
    columnStyles: Object.fromEntries(o.colunas.map((c, i) => [i, { halign: c.direita ? 'right' : 'left' }])),
    didDrawPage: nasProximas,
  })
  const paginas = doc.getNumberOfPages()
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(120, 128, 142)
    doc.text('Evokaa · evokaa.com.br', 40, alt - 22)
    doc.text(`Página ${p} de ${paginas}`, larg - 40, alt - 22, { align: 'right' })
  }
  baixarBlob(doc.output('blob'), o.arquivo)
}
