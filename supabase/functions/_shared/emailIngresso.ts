// E-mail de entrega do ingresso (ticket_delivery): cartão do evento com bloco de data, passos de entrada e botão.
// Só tabelas e estilo inline (Outlook, Gmail e Apple Mail); sem imagem além da logo do produtor. Recebe texto CRU e escapa aqui dentro.
import { blocoLogoProdutor, colors, escapeHtml } from "./email.ts";

export interface DadosEmailIngresso {
  nome: string; // comprador
  evento: string;
  data: string | null; // AAAA-MM-DD (events.date)
  hora: string; // já formatada ("22:00") ou ""
  local: string;
  tipos: string[]; // um nome de tipo por ingresso (repetido), na ordem das páginas do PDF
  logo?: { url: string; w: number; h: number } | null;
  ctaHref: string;
  marcaUrl?: string; // logo da Evokaa (padrão: a do app); parâmetro só para o teste visual local
}

// Cores da marca nas funções: azul royal (#1d68c4, branco por cima 5,5:1) e marinho (#0c2340). O violeta do ícone vive só na logo:
// o guia de estilo tirou o roxo da interface (contrato §2.7) e o teste de email_test.ts barra o azul-violeta e os roxos antigos.
const LOGO_EVOKAA = "https://app.evokaa.com.br/images/logo-evokaa-sm.png"; // 252x240, fundo transparente, texto marinho: só sobre fundo claro

const DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function partesDaData(data: string | null) {
  const m = data?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [ano, mes, dia] = [+m[1], +m[2], +m[3]];
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCDate() !== dia) return null; // 31 de fevereiro não existe
  return { ano, mes: MESES[mes - 1], dia, semana: DIAS[d.getUTCDay()] };
}

/** "2 × Pista · 1 × Camarote" (ordem da primeira aparição) */
export function resumoDosTipos(tipos: string[]): string {
  const n = new Map<string, number>();
  for (const t of tipos) n.set(t, (n.get(t) ?? 0) + 1);
  return [...n].map(([t, q]) => `${q} × ${t}`).join(" · ");
}

const FONTE = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
// Rótulo pequeno em caixa alta; cinza mais escuro que o do corpo para passar de 4,5:1 também sobre o fundo claro do rodapé do cartão.
const rotulo = (t: string) => `<div style="font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #5B6577; margin: 0 0 3px 0;">${t}</div>`;
// Número do passo: célula com bgcolor (o Outlook desktop ignora div com border-radius).
const passo = (n: number, texto: string) => `
  <tr>
    <td width="40" valign="top" style="padding: 0 0 14px 0;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="26" height="26" align="center" valign="middle" bgcolor="${colors.marca}" style="width: 26px; height: 26px; background-color: ${colors.marca}; border-radius: 13px; color: #FFFFFF; font-family: ${FONTE}; font-size: 13px; font-weight: bold; line-height: 26px; text-align: center;">${n}</td></tr></table></td>
    <td valign="top" style="padding: 3px 0 14px 0; font-family: ${FONTE}; font-size: 14px; line-height: 1.5; color: ${colors.textDark};">${texto}</td>
  </tr>`;

export function emailIngresso(d: DadosEmailIngresso): string {
  const varios = d.tipos.length > 1;
  const p = partesDaData(d.data);
  const bloco = p
    ? `<div style="font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #C9D6EA;">${p.semana.split("-")[0].slice(0, 3)}</div>
       <div style="font-size: 44px; line-height: 1.05; font-weight: bold; color: #FFFFFF; margin: 4px 0;">${p.dia}</div>
       <div style="font-size: 13px; letter-spacing: 0.06em; text-transform: uppercase; color: #FFFFFF;">${p.mes} ${p.ano}</div>`
    : `<div style="font-size: 13px; letter-spacing: 0.06em; text-transform: uppercase; color: #FFFFFF; padding: 18px 0;">Data<br>a definir</div>`;
  const quando = [p ? p.semana.charAt(0).toUpperCase() + p.semana.slice(1) : "", d.hora && `às ${d.hora}`].filter(Boolean).join(", ");
  const quebra = "word-break: break-word; overflow-wrap: break-word;";

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${colors.cream}" style="background-color: ${colors.cream}; font-family: ${FONTE}; color: ${colors.textDark};">
   <tr><td align="center" style="padding: 40px 20px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" bgcolor="#FFFFFF" style="width: 100%; max-width: 600px; background-color: #FFFFFF; border-collapse: separate; border: 1px solid #E3E6EB; border-radius: 12px; overflow: hidden;">
      <tr><td style="padding: 0; font-size: 0; line-height: 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td width="70%" height="5" bgcolor="${colors.marca}" style="background-color: ${colors.marca}; font-size: 0; line-height: 0;">&nbsp;</td>
          <td width="30%" height="5" bgcolor="${colors.marinho}" style="background-color: ${colors.marinho}; font-size: 0; line-height: 0;">&nbsp;</td>
        </tr></table>
      </td></tr>
      <tr><td align="center" bgcolor="#FFFFFF" style="background-color: #FFFFFF; padding: 26px 30px 22px 30px; text-align: center;">
        <img src="${d.marcaUrl ?? LOGO_EVOKAA}" alt="Evokaa" width="84" height="80" style="display: block; margin: 0 auto; border: 0; width: 84px; height: 80px;">
      </td></tr>
      <tr><td align="center" bgcolor="${colors.marinho}" style="background-color: ${colors.marinho}; padding: 34px 30px 36px 30px; text-align: center; color: #FFFFFF;">
        <table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr><td bgcolor="${colors.marca}" style="background-color: ${colors.marca}; border-radius: 999px; padding: 6px 14px; color: #FFFFFF; font-size: 11px; font-weight: bold; letter-spacing: 0.12em; text-transform: uppercase;">${varios ? "Ingressos confirmados" : "Ingresso confirmado"}</td></tr></table>
        <h1 style="margin: 18px 0 0 0; font-size: 28px; line-height: 1.2; font-weight: bold; letter-spacing: -0.5px; color: #FFFFFF;">${varios ? "Seus ingressos estão prontos" : "Seu ingresso está pronto"}</h1>
        <p style="margin: 12px 0 0 0; font-size: 15px; line-height: 1.5; color: #C9D6EA;">O PDF vai em anexo neste e-mail${varios ? ", uma página por ingresso" : ""}.</p>
      </td></tr>
      <tr><td bgcolor="#FFFFFF" style="background-color: #FFFFFF; padding: 30px 30px 8px 30px;">
        ${d.logo ? `<div style="text-align: center; margin: 0 0 22px 0;"><div style="font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #5B6577; margin: 0 0 8px 0;">Organizado por</div>${blocoLogoProdutor(d.logo.url, d.logo).replace("margin: 0 0 20px 0", "margin: 0")}</div>` : ""}
        <p style="margin: 0 0 22px 0; font-size: 15px; line-height: 1.6; color: ${colors.textDark};">Olá, ${escapeHtml(d.nome)}. ${varios ? "Seus ingressos para o evento abaixo estão confirmados." : "Seu ingresso para o evento abaixo está confirmado."}</p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: separate; border: 1px solid #D5DAE3; border-radius: 12px; overflow: hidden;">
          <tr>
            <td width="112" align="center" valign="middle" bgcolor="${colors.marinho}" style="width: 112px; background-color: ${colors.marinho}; border-top: 4px solid ${colors.marca}; padding: 18px 8px 20px 8px; text-align: center;">${bloco}</td>
            <td valign="top" bgcolor="#FFFFFF" style="background-color: #FFFFFF; padding: 20px 22px; ${quebra}">
              <div style="font-size: 20px; line-height: 1.3; font-weight: bold; color: ${colors.marinho}; margin: 0 0 14px 0; ${quebra}">${escapeHtml(d.evento)}</div>
              ${rotulo("Quando")}<div style="font-size: 14px; font-weight: bold; margin: 0 0 12px 0;">${escapeHtml(quando || "A definir")}</div>
              ${rotulo("Onde")}<div style="font-size: 14px; font-weight: bold; margin: 0; ${quebra}">${escapeHtml(d.local)}</div>
            </td>
          </tr>
          <tr>
            <td colspan="2" bgcolor="${colors.rodape}" style="background-color: ${colors.rodape}; border-top: 2px dashed #C3CAD6; padding: 14px 22px; ${quebra}">
              ${rotulo(varios ? `Ingressos (${d.tipos.length})` : "Ingresso")}<div style="font-size: 14px; font-weight: bold; color: ${colors.marinho};">${escapeHtml(resumoDosTipos(d.tipos))}</div>
            </td>
          </tr>
        </table>

        <div style="font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: bold; color: ${colors.marinho}; margin: 30px 0 14px 0;">Como entrar</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${passo(1, varios ? "Abra o PDF em anexo ou o botão abaixo. Cada ingresso é uma página." : "Abra o PDF em anexo ou o botão abaixo.")}
          ${passo(2, "Entre com a conta usada na compra. O QR de entrada aparece no celular e muda a cada 30 segundos.")}
          ${passo(3, "Na entrada, mostre o QR na tela. O ingresso é nominal e pessoal.")}
        </table>

        <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin: 14px auto 8px auto;"><tr>
          <td align="center" bgcolor="${colors.marca}" style="background-color: ${colors.marca}; border-radius: 8px;"><a href="${escapeHtml(d.ctaHref)}" style="display: inline-block; padding: 15px 32px; font-size: 15px; font-weight: bold; color: #FFFFFF; text-decoration: none; border-radius: 8px;">Ver meus ingressos</a></td>
        </tr></table>
        <p style="margin: 14px 0 22px 0; text-align: center; font-size: 12px; line-height: 1.6; color: #5B6577;">Perdeu o PDF? Em Meus ingressos você baixa de novo. O QR do PDF só abre a página do ingresso: ele não vale na entrada.</p>
      </td></tr>
      <tr><td align="center" bgcolor="${colors.marinho}" style="background-color: ${colors.marinho}; padding: 24px 20px; text-align: center; font-size: 12px; line-height: 1.7; color: #C9D6EA;">
        <div style="font-weight: bold; letter-spacing: 0.12em; text-transform: uppercase; color: #FFFFFF;">Evokaa</div>
        <div style="margin-top: 4px;">Gestão de eventos e ingressos</div>
        <div style="margin-top: 4px;">Dúvidas? contato@evokaa.com.br</div>
      </td></tr>
    </table>
   </td></tr>
  </table>`;
}
