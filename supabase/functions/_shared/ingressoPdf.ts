import { PDFDocument, PDFFont, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import qrcode from "npm:qrcode-generator@1.4.4";
import { formatarHora } from "./hora.ts";
import { caber, dimensoes } from "./logoProdutor.ts";

export interface IngressoPdf {
  evento: string;
  data: string; // já formatada (ex.: 16 de outubro de 2026)
  hora: string;
  local: string;
  tipo: string;
  portador: string;
  codigo: string; // valor do QR: é a credencial de check-in
}

const AZUL = rgb(0.114, 0.408, 0.769); // #1d68c4 (marca)
const TEXTO = rgb(0.047, 0.137, 0.251); // #0c2340
const MUTED = rgb(0.4, 0.45, 0.52);

// Fonte padrão do PDF só aceita Latin-1 (acentos do português cabem; emoji e outros não).
function seguro(font: PDFFont, texto: string): string {
  let saida = "";
  for (const ch of texto.replace(/[\r\n\t]+/g, " ")) {
    try {
      font.encodeText(ch);
      saida += ch;
    } catch {
      saida += "?";
    }
  }
  return saida;
}

// Corta com "..." para caber em uma linha.
function truncar(font: PDFFont, texto: string, tamanho: number, largura: number): string {
  if (font.widthOfTextAtSize(texto, tamanho) <= largura) return texto;
  let t = texto;
  while (t.length > 1 && font.widthOfTextAtSize(t + "...", tamanho) > largura) t = t.slice(0, -1);
  return t + "...";
}

function quebrar(font: PDFFont, texto: string, tamanho: number, largura: number): string[] {
  const linhas: string[] = [];
  let atual = "";
  // Palavra sem espaço maior que a linha (URL, por exemplo) é cortada para não sair da página.
  const palavras = texto.split(" ").map((w) => truncar(font, w, tamanho, largura));
  for (const palavra of palavras) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (atual && font.widthOfTextAtSize(tentativa, tamanho) > largura) {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = tentativa;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

// Uma página A4 por ingresso. QR desenhado como vetor, no servidor: o código não sai para terceiros.
// `logo` (opcional): logo do produtor, num selo branco no canto do topo azul (logo escura também lê bem). Imagem ilegível = sem logo.
export async function gerarPdf(ingressos: IngressoPdf[], logo?: { bytes: Uint8Array; ext: "png" | "jpeg" } | null): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  let imagem: Awaited<ReturnType<typeof pdf.embedPng>> | null = null;
  try {
    if (logo) imagem = logo.ext === "png" ? await pdf.embedPng(logo.bytes) : await pdf.embedJpg(logo.bytes);
  } catch {
    imagem = null;
  }
  const normal = await pdf.embedStandardFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedStandardFont(StandardFonts.HelveticaBold);

  for (const t of ingressos) {
    const page = pdf.addPage([595, 842]);
    const margem = 48;
    const largura = 595 - margem * 2;

    page.drawRectangle({ x: 0, y: 842 - 200, width: 595, height: 200, color: AZUL });
    if (imagem) {
      const selo = { w: 128, h: 46 }; // 595 - margem - 128 = 419
      page.drawRectangle({ x: 595 - margem - selo.w, y: 842 - 24 - selo.h, width: selo.w, height: selo.h, color: rgb(1, 1, 1) });
      const d = caber(dimensoes(logo!.bytes, logo!.ext), selo.w - 14, selo.h - 12);
      page.drawImage(imagem, { x: 595 - margem - selo.w + (selo.w - d.width) / 2, y: 842 - 24 - selo.h + (selo.h - d.height) / 2, width: d.width, height: d.height });
    }
    page.drawText(truncar(negrito, seguro(negrito, t.tipo.toUpperCase()), 11, imagem ? largura - 150 : largura), { x: margem, y: 842 - 56, size: 11, font: negrito, color: rgb(1, 1, 1) });
    let y = 842 - 92;
    for (const linha of quebrar(negrito, seguro(negrito, t.evento), 28, largura).slice(0, 3)) {
      page.drawText(linha, { x: margem, y, size: 28, font: negrito, color: rgb(1, 1, 1) });
      y -= 34;
    }

    y = 842 - 250;
    const campos: [string, string][] = [
      ["Data", t.data],
      ["Horário", t.hora || "--:--"],
      ["Local", t.local || "-"],
      ["Portador", t.portador || "-"],
    ];
    for (const [rotulo, valor] of campos) {
      page.drawText(seguro(normal, rotulo.toUpperCase()), { x: margem, y, size: 9, font: normal, color: MUTED });
      y -= 16;
      // Uma linha por campo (altura fixa): o bloco termina sempre acima do QR (y = 370).
      page.drawText(truncar(negrito, seguro(negrito, valor), 15, largura), { x: margem, y, size: 15, font: negrito, color: TEXTO });
      y -= 30;
    }

    // QR: módulos escuros como quadrados, com zona de silêncio de 4 módulos.
    const qr = qrcode(0, "M");
    qr.addData(t.codigo);
    qr.make();
    const n = qr.getModuleCount();
    const lado = 220;
    const modulo = lado / (n + 8);
    const qx = (595 - lado) / 2;
    const qy = 150;
    page.drawRectangle({ x: qx, y: qy, width: lado, height: lado, color: rgb(1, 1, 1), borderColor: rgb(0.88, 0.9, 0.93), borderWidth: 1 });
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (qr.isDark(r, c)) {
          page.drawRectangle({ x: qx + (c + 4) * modulo, y: qy + lado - (r + 5) * modulo, width: modulo + 0.2, height: modulo + 0.2, color: rgb(0, 0, 0) });
        }
      }
    }

    const aviso = "Apresente este QR na entrada. Ingresso nominal e pessoal.";
    page.drawText(aviso, { x: (595 - normal.widthOfTextAtSize(aviso, 9)) / 2, y: 60, size: 9, font: normal, color: MUTED });
    page.drawText("Evokaa", { x: (595 - negrito.widthOfTextAtSize("Evokaa", 10)) / 2, y: 44, size: 10, font: negrito, color: AZUL });
  }

  return await pdf.save();
}

// Pedido + ingressos do banco -> páginas do PDF. Só ingresso ativo (pago ou grátis confirmado) entra.
// deno-lint-ignore no-explicit-any
export function ingressosParaPdf(order: any, tickets: any[]): IngressoPdf[] {
  const ev = Array.isArray(order.events) ? order.events[0] : order.events;
  const data = ev?.date
    ? new Date(ev.date + "T00:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })
    : "A definir";
  return tickets.filter((t) => t.status === "active").map((t) => ({
    evento: ev?.title || "Evento",
    data,
    hora: formatarHora(ev?.time),
    local: ev?.venue_name || "Local a definir",
    tipo: (Array.isArray(t.ticket_types) ? t.ticket_types[0] : t.ticket_types)?.name || "Ingresso",
    portador: t.buyer_name || order.customer_name || "Participante",
    codigo: t.qr_code,
  }));
}
