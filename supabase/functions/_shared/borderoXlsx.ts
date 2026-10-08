import ExcelJS from 'npm:exceljs@4.4.0'
import { LOGO_EVOKAA_PNG_B64 } from './logoEvokaa.ts'
import { AINDA_NAO, dataSP, diaBR, forma, n, porDia, porForma, porTipo, totais, type Ingresso, type Pedido, type Tipo } from './borderoDados.ts'

export type EntradaBordero = {
  evento: { titulo: string; local: string; data: string; status: string }
  produtora: string
  geradoEm: string
  pessoais: boolean
  pedidos: Pedido[] // só pagos
  ingressos: Ingresso[]
  tipos: Tipo[]
  cupons: Record<string, string> // coupon_id -> código
  reembolsados: { pedidos: number; total: number }
  totalBanco: { pedidos: number; total: number } // produtor_vendas_pagas: o mesmo número da Central e do Financeiro
}

const MARCA = 'FF0C2340', ACENTO = 'FF1D68C4', ZEBRA = 'FFF4F6F9', AVISO = 'FFFFF4D6', CINZA = 'FF5B6577'
const BRL = '"R$" #,##0.00;[Red]-"R$" #,##0.00'
const fino = { style: 'thin' as const, color: { argb: 'FFD5DAE3' } }

export async function montarBordero(e: EntradaBordero): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Evokaa'; wb.created = new Date(e.geradoEm)
  const logo = wb.addImage({ base64: LOGO_EVOKAA_PNG_B64, extension: 'png' })
  const pagos = e.pedidos
  const t = totais(pagos)

  // Cabeçalho comum: logo, título, evento, data e (se houver) aviso de dado pessoal. Devolve a primeira linha livre.
  const folha = (nome: string, larguras: number[]) => {
    const ws = wb.addWorksheet(nome, { views: [{ showGridLines: false }], properties: { tabColor: { argb: ACENTO } } })
    larguras.forEach((w, i) => { ws.getColumn(i + 1).width = w })
    ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 } }
    ws.headerFooter = { oddFooter: '&L&8Evokaa · Borderô&R&8Página &P de &N' }
    ws.addImage(logo, { tl: { col: 0, row: 0 }, ext: { width: 46, height: 44 } })
    ws.getRow(1).height = 24; ws.getRow(2).height = 20; ws.getRow(3).height = 18
    ws.getCell('B1').value = `Borderô · ${nome}`; ws.getCell('B1').font = { name: 'Calibri', size: 16, bold: true, color: { argb: MARCA } }
    ws.getCell('B2').value = e.evento.titulo; ws.getCell('B2').font = { size: 12, bold: true }
    ws.getCell('B3').value = `${e.produtora} · gerado em ${diaBR(dataSP(e.geradoEm).dia)}`; ws.getCell('B3').font = { size: 10, color: { argb: CINZA } }
    let prox = 5
    if (e.pessoais) {
      ws.mergeCells(4, 1, 4, Math.max(larguras.length, 4))
      const c = ws.getCell('A4')
      c.value = 'Este arquivo contém dados pessoais de compradores (nome e e-mail). Uso restrito: não encaminhe nem publique (LGPD).'
      c.font = { bold: true, size: 10, color: { argb: 'FF7A4B00' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AVISO } }
      c.alignment = { vertical: 'middle', wrapText: true }; ws.getRow(4).height = 30; prox = 6
    }
    return { ws, prox }
  }

  const titulo = (ws: ExcelJS.Worksheet, linha: number, texto: string) => {
    const c = ws.getCell(linha, 1); c.value = texto; c.font = { size: 12, bold: true, color: { argb: ACENTO } }
    ws.getRow(linha).height = 20
  }

  type Col = { h: string; w?: number; fmt?: string; soma?: boolean; centro?: boolean }
  // Tabela com cabeçalho na marca, zebrado, filtro, total em fórmula (com o resultado já calculado, para quem abre sem recalcular).
  const tabela = (ws: ExcelJS.Worksheet, linha: number, cols: Col[], linhas: unknown[][], opt: { total?: boolean; congelar?: boolean; barras?: number } = {}) => {
    const cab = ws.getRow(linha); cab.height = 22
    cols.forEach((c, i) => {
      const cell = cab.getCell(i + 1); cell.value = c.h
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MARCA } }
      cell.alignment = { vertical: 'middle', horizontal: c.fmt || c.soma ? 'right' : 'left', wrapText: true }
    })
    linhas.forEach((vals, r) => {
      const row = ws.getRow(linha + 1 + r)
      vals.forEach((v, i) => {
        const cell = row.getCell(i + 1); cell.value = v as ExcelJS.CellValue
        if (cols[i].fmt) cell.numFmt = cols[i].fmt!
        cell.alignment = { vertical: 'middle', horizontal: cols[i].centro ? 'center' : cols[i].fmt || cols[i].soma ? 'right' : 'left', indent: cols[i].fmt || cols[i].soma || cols[i].centro ? 0 : 1 }
        cell.border = { bottom: fino }
        if (r % 2) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } }
      })
    })
    const ultima = linha + linhas.length
    if (opt.total && linhas.length) {
      const row = ws.getRow(ultima + 1)
      row.getCell(1).value = 'Total'
      cols.forEach((c, i) => {
        if (!c.soma) return
        const letra = ws.getColumn(i + 1).letter
        row.getCell(i + 1).value = { formula: `SUBTOTAL(109,${letra}${linha + 1}:${letra}${ultima})`, result: linhas.reduce((a, l) => a + n(l[i]), 0) }
        row.getCell(i + 1).numFmt = c.fmt ?? '0'
      })
      row.eachCell({ includeEmpty: true }, (cell, i) => {
        if (i > cols.length) return
        cell.font = { bold: true, color: { argb: MARCA } }; cell.border = { top: { style: 'medium', color: { argb: ACENTO } } }
        cell.alignment = { horizontal: i === 1 ? 'left' : 'right' }
      })
    }
    if (linhas.length) ws.autoFilter = { from: { row: linha, column: 1 }, to: { row: ultima, column: cols.length } }
    if (opt.congelar) ws.views = [{ showGridLines: false, state: 'frozen', ySplit: linha, xSplit: 0 }]
    if (opt.barras != null && linhas.length) {
      const letra = ws.getColumn(opt.barras).letter
      ws.addConditionalFormatting({ ref: `${letra}${linha + 1}:${letra}${ultima}`, rules: [
        { type: 'dataBar', priority: 1, gradient: false, cfvo: [{ type: 'num', value: 0 }, { type: 'max' }], color: { argb: 'FF8DB4E8' } } as never,
      ] })
    }
    return ultima + (opt.total && linhas.length ? 1 : 0)
  }

  const par = (ws: ExcelJS.Worksheet, linha: number, rotulo: string, valor: ExcelJS.CellValue, fmt?: string, forte = false) => {
    const a = ws.getCell(linha, 1), b = ws.getCell(linha, 2)
    a.value = rotulo; a.font = { size: 10, color: { argb: CINZA } }; a.border = { bottom: fino }
    b.value = valor; b.alignment = { horizontal: 'right' }; b.border = { bottom: fino }; b.font = { bold: forte, size: forte ? 12 : 11 }
    if (fmt) b.numFmt = fmt
  }

  // 1. Resumo do evento
  {
    const { ws, prox } = folha('Resumo do evento', [34, 34, 18, 18])
    let l = prox
    titulo(ws, l++, 'Evento')
    par(ws, l++, 'Nome', e.evento.titulo); par(ws, l++, 'Local', e.evento.local || 'Não informado')
    par(ws, l++, 'Data do evento', e.evento.data ? diaBR(e.evento.data.slice(0, 10)) : 'Não informada'); par(ws, l++, 'Situação', e.evento.status)
    l++; titulo(ws, l++, 'Vendas')
    par(ws, l++, 'Pedidos pagos', e.totalBanco.pedidos, '0')
    par(ws, l++, 'Total pago pelos compradores', e.totalBanco.total, BRL, true)
    par(ws, l++, 'Ingressos válidos', e.ingressos.filter(i => i.status === 'active' || i.status === 'used').length, '0')
    par(ws, l++, 'Check-ins feitos', e.ingressos.filter(i => i.status === 'used' || i.checked_in_at).length, '0')
    par(ws, l++, 'Pedidos reembolsados (fora do total)', `${e.reembolsados.pedidos} · ${e.reembolsados.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`)
    // O total vem de produtor_vendas_pagas (igual ao da Central e do Financeiro); se as linhas somarem outra coisa, diz
    if (Math.abs(t.total - e.totalBanco.total) > 0.01 || t.pedidos !== e.totalBanco.pedidos) {
      l++; ws.mergeCells(l, 1, l, 4)
      const c = ws.getCell(l, 1)
      c.value = 'Atenção: entrou venda enquanto o arquivo era gerado e as abas de detalhe não somam o mesmo valor. Gere de novo.'
      c.font = { bold: true, size: 10, color: { argb: 'FF7A4B00' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AVISO } }; c.alignment = { wrapText: true }; ws.getRow(l).height = 30; l++
    }
    l++; titulo(ws, l++, 'Ainda não incluído neste arquivo')
    for (const x of AINDA_NAO) { ws.mergeCells(l, 1, l, 4); ws.getCell(l, 1).value = `• ${x}`; ws.getCell(l, 1).font = { size: 10, color: { argb: CINZA } }; ws.getCell(l, 1).alignment = { wrapText: true, vertical: 'top' }; ws.getRow(l).height = 28; l++ }
  }

  // 2. Finanças gerais
  {
    const { ws, prox } = folha('Finanças gerais', [38, 20, 20, 20])
    let l = prox
    titulo(ws, l++, 'Cascata do que o comprador pagou')
    par(ws, l++, 'Valor dos ingressos', t.ingressos, BRL)
    par(ws, l++, '(−) Descontos e cupons', -t.desconto, BRL)
    par(ws, l++, '(+) Taxa de serviço', t.taxaServico, BRL)
    par(ws, l++, '(+) Taxa de pagamento', t.taxaPagamento, BRL)
    par(ws, l++, 'Total pago pelos compradores', t.total, BRL, true)
    if (!t.taxasGravadas) {
      ws.mergeCells(l, 1, l, 4)
      const c = ws.getCell(l, 1); c.value = 'As taxas ainda não foram gravadas nos pedidos deste evento; por isso a cascata não fecha com o total.'
      c.font = { size: 10, italic: true, color: { argb: 'FF7A4B00' } }; c.alignment = { wrapText: true }; ws.getRow(l).height = 28; l++
    }
    par(ws, l++, 'Repasse ao produtor', 'Em breve'); par(ws, l++, 'Líquido do produtor', 'Em breve')
    l++; titulo(ws, l++, 'Por forma de pagamento')
    tabela(ws, l, [{ h: 'Forma' }, { h: 'Pedidos', soma: true, fmt: '0' }, { h: 'Total', soma: true, fmt: BRL }, { h: '% do total', fmt: '0.0%' }],
      porForma(pagos).map(f => [f.chave, f.pedidos, f.total, t.total ? f.total / t.total : 0]), { total: true, barras: 3 })
  }

  // 3. Canais de venda
  {
    const { ws, prox } = folha('Canais de venda', [30, 14, 18, 18, 18])
    tabela(ws, prox, [{ h: 'Canal' }, { h: 'Pedidos', soma: true, fmt: '0' }, { h: 'Total pago', soma: true, fmt: BRL }, { h: 'Descontos', soma: true, fmt: BRL }, { h: 'Taxa de serviço', soma: true, fmt: BRL }],
      [['Online (site Evokaa)', t.pedidos, t.total, t.desconto, t.taxaServico], ['Balcão, cortesia, afiliado e mesa coletiva', 'Em breve', null, null, null]], { total: false })
  }

  // 4. Tipos de ingresso  /  5. Disponíveis e check-ins
  const tipos = porTipo(e.tipos, e.ingressos)
  {
    const { ws, prox } = folha('Tipos de ingresso', [34, 16, 14, 14, 16])
    tabela(ws, prox, [{ h: 'Tipo' }, { h: 'Preço de tabela', fmt: BRL }, { h: 'Vendidos', soma: true, fmt: '0' }, { h: 'Check-ins', soma: true, fmt: '0' }, { h: '% presença', fmt: '0.0%' }],
      tipos.map(x => [x.nome, x.preco, x.vendidos, x.checkins, x.presenca]), { total: true, congelar: true })
  }
  {
    const { ws, prox } = folha('Disponíveis e check-ins', [34, 16, 14, 16, 14])
    // com tipo sem limite, somar "ofertado" e "disponíveis" não fecha com "vendidos": só soma quando todos têm limite
    const fecha = tipos.every(x => x.total != null)
    tabela(ws, prox, [{ h: 'Tipo' }, { h: 'Total ofertado', soma: fecha, fmt: '0' }, { h: 'Vendidos', soma: true, fmt: '0' }, { h: 'Disponíveis', soma: fecha, fmt: '0' }, { h: 'Check-ins', soma: true, fmt: '0' }],
      tipos.map(x => [x.nome, x.total ?? 'Sem limite', x.vendidos, x.disponiveis ?? 'Sem limite', x.checkins]), { total: true, congelar: true })
  }

  // 6. Vendas por dia (a Sympla não traz)
  {
    const { ws, prox } = folha('Vendas por dia', [16, 12, 18, 40])
    tabela(ws, prox, [{ h: 'Dia' }, { h: 'Pedidos', soma: true, fmt: '0' }, { h: 'Total', soma: true, fmt: BRL }],
      porDia(pagos).map(d => [diaBR(d.chave), d.pedidos, d.total]), { total: true, congelar: true, barras: 3 })
  }

  // 7. Detalhamento: um pedido por linha
  {
    const base: Col[] = [
      { h: 'Pedido', w: 12 }, { h: 'Data', fmt: 'dd/mm/yyyy', w: 12, centro: true }, { h: 'Hora', fmt: 'hh:mm', w: 8, centro: true }, { h: 'Forma de pagamento', w: 20 }, { h: 'Cupom', w: 14 },
      { h: 'Ingressos', soma: true, fmt: BRL, w: 14 }, { h: 'Desconto', soma: true, fmt: BRL, w: 14 }, { h: 'Taxa de serviço', soma: true, fmt: BRL, w: 14 },
      { h: 'Taxa de pagamento', soma: true, fmt: BRL, w: 14 }, { h: 'Total pago', soma: true, fmt: BRL, w: 14 },
    ]
    const cols: Col[] = e.pessoais ? [...base, { h: 'Comprador', w: 28 }, { h: 'E-mail', w: 32 }] : base
    const { ws, prox } = folha('Detalhamento', cols.map(c => c.w ?? 14))
    const ordenados = [...pagos].sort((a, b) => a.created_at.localeCompare(b.created_at))
    const linhas = ordenados.map(p => {
      const d = dataSP(p.created_at)
      const v = [p.id.slice(0, 8).toUpperCase(), d.serial, d.serial, forma(p.payment_method), p.coupon_id ? e.cupons[p.coupon_id] ?? 'Não visível' : '',
        n(p.subtotal), n(p.discount), n(p.service_fee), n(p.processing_fee), n(p.total)]
      return e.pessoais ? [...v, p.customer_name ?? '', p.customer_email ?? ''] : v
    })
    tabela(ws, prox, cols, linhas, { total: true, congelar: true })
  }

  // 8. Ingressos (com check-in)
  {
    const base: Col[] = [{ h: 'Pedido', w: 12 }, { h: 'Tipo', w: 30 }, { h: 'Situação', w: 14 }, { h: 'Check-in', fmt: 'dd/mm/yyyy hh:mm', w: 18 }]
    const cols: Col[] = e.pessoais ? [...base, { h: 'Portador', w: 28 }, { h: 'E-mail', w: 32 }] : base
    const { ws, prox } = folha('Ingressos', cols.map(c => c.w ?? 14))
    const nomeTipo = new Map(e.tipos.map(x => [x.id, x.name]))
    const situ: Record<string, string> = { active: 'Válido', used: 'Usado' }
    const linhas = e.ingressos.filter(i => i.status === 'active' || i.status === 'used').map(i => {
      const v = [i.order_id.slice(0, 8).toUpperCase(), nomeTipo.get(i.ticket_type_id) ?? 'Sem nome', situ[i.status] ?? i.status, i.checked_in_at ? dataSP(i.checked_in_at).serial : '']
      return e.pessoais ? [...v, i.buyer_name ?? '', i.buyer_email ?? ''] : v
    })
    tabela(ws, prox, cols, linhas, { congelar: true })
  }

  return new Uint8Array(await wb.xlsx.writeBuffer() as ArrayBuffer)
}
