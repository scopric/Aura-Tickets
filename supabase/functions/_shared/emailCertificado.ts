// E-mail de entrega do certificado (certificado-enviar): mesmo visual do e-mail do ingresso (logo da Evokaa, marinho e azul royal, cartão com
// bloco de data), levando à página /certificado/<código>, onde o participante vê, baixa e confere o certificado. Só tabelas e estilo
// inline (Outlook, Gmail, Apple Mail). Recebe texto CRU e escapa aqui dentro. Sem exclamação, sem violeta (o violeta vive só na logo).
import { blocoLogoProdutor, colors, escapeHtml } from "./email.ts";
import { partesDaData } from "./emailIngresso.ts";

export interface DadosEmailCertificado {
  nome: string; // participante (nome do ingresso)
  evento: string;
  data: string | null; // AAAA-MM-DD
  organizador: string | null;
  horas: string | null; // só dígitos
  codigo: string;
  ctaHref: string;
  logo?: { url: string; w: number; h: number } | null; // logo do organizador, já conferida por buscarLogo
  marcaUrl?: string; // logo da Evokaa (padrão: a do app); parâmetro só para o teste visual local
}

const FONTE = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const LOGO_EVOKAA = "https://app.evokaa.com.br/images/logo-evokaa-sm.png"; // 252x240, fundo transparente, texto marinho: só sobre fundo claro
const MUTED = "#5B6577"; // 4,5:1 também sobre o fundo claro do cartão
const rotulo = (t: string) => `<div style="font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: ${MUTED}; margin: 0 0 3px 0;">${t}</div>`;
const quebra = "word-break: break-word; overflow-wrap: break-word;";
const passo = (n: number, texto: string) => `
  <tr>
    <td width="40" valign="top" style="padding: 0 0 14px 0;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="26" height="26" align="center" valign="middle" bgcolor="${colors.marca}" style="width: 26px; height: 26px; background-color: ${colors.marca}; border-radius: 13px; color: #FFFFFF; font-family: ${FONTE}; font-size: 13px; font-weight: bold; line-height: 26px; text-align: center;">${n}</td></tr></table></td>
    <td valign="top" style="padding: 3px 0 14px 0; font-family: ${FONTE}; font-size: 14px; line-height: 1.5; color: ${colors.textDark};">${texto}</td>
  </tr>`;

export function emailCertificado(d: DadosEmailCertificado): string {
  const p = partesDaData(d.data);
  const bloco = p
    ? `<div style="font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #C9D6EA;">${p.semana.split("-")[0].slice(0, 3)}</div>
       <div style="font-size: 44px; line-height: 1.05; font-weight: bold; color: #FFFFFF; margin: 4px 0;">${p.dia}</div>
       <div style="font-size: 13px; letter-spacing: 0.06em; text-transform: uppercase; color: #FFFFFF;">${p.mes} ${p.ano}</div>`
    : `<div style="font-size: 13px; letter-spacing: 0.06em; text-transform: uppercase; color: #FFFFFF; padding: 18px 0;">Data<br>a definir</div>`;
  const linhas = [
    d.organizador ? `${rotulo("Organizador")}<div style="font-size: 14px; font-weight: bold; margin: 0 0 12px 0; ${quebra}">${escapeHtml(d.organizador)}</div>` : "",
    d.horas ? `${rotulo("Carga horária")}<div style="font-size: 14px; font-weight: bold; margin: 0;">${escapeHtml(d.horas)} h</div>` : "",
  ].join("");

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
        <table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr><td bgcolor="${colors.marca}" style="background-color: ${colors.marca}; border-radius: 999px; padding: 6px 14px; color: #FFFFFF; font-size: 11px; font-weight: bold; letter-spacing: 0.12em; text-transform: uppercase;">Certificado emitido</td></tr></table>
        <h1 style="margin: 18px 0 0 0; font-size: 28px; line-height: 1.2; font-weight: bold; letter-spacing: -0.5px; color: #FFFFFF;">Seu certificado está pronto</h1>
        <p style="margin: 12px 0 0 0; font-size: 15px; line-height: 1.5; color: #C9D6EA;">Abra pelo botão abaixo para ver e baixar o PDF.</p>
      </td></tr>
      <tr><td bgcolor="#FFFFFF" style="background-color: #FFFFFF; padding: 30px 30px 8px 30px;">
        ${d.logo ? `<div style="text-align: center; margin: 0 0 22px 0;"><div style="font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: ${MUTED}; margin: 0 0 8px 0;">Organizado por</div>${blocoLogoProdutor(d.logo.url, d.logo).replace("margin: 0 0 20px 0", "margin: 0")}</div>` : ""}
        <p style="margin: 0 0 22px 0; font-size: 15px; line-height: 1.6; color: ${colors.textDark};">Olá, ${escapeHtml(d.nome)}. O certificado de participação no evento abaixo foi emitido para você.</p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: separate; border: 1px solid #D5DAE3; border-radius: 12px; overflow: hidden;">
          <tr>
            <td width="112" align="center" valign="middle" bgcolor="${colors.marinho}" style="width: 112px; background-color: ${colors.marinho}; border-top: 4px solid ${colors.marca}; padding: 18px 8px 20px 8px; text-align: center;">${bloco}</td>
            <td valign="top" bgcolor="#FFFFFF" style="background-color: #FFFFFF; padding: 20px 22px; ${quebra}">
              <div style="font-size: 20px; line-height: 1.3; font-weight: bold; color: ${colors.marinho}; margin: 0 0 ${linhas ? "14px" : "0"} 0; ${quebra}">${escapeHtml(d.evento)}</div>
              ${linhas}
            </td>
          </tr>
          <tr>
            <td colspan="2" bgcolor="${colors.rodape}" style="background-color: ${colors.rodape}; border-top: 2px dashed #C3CAD6; padding: 14px 22px; ${quebra}">
              ${rotulo("Código do certificado")}<div style="font-family: 'SFMono-Regular', Menlo, Consolas, monospace; font-size: 13px; font-weight: bold; color: ${colors.marinho};">${escapeHtml(d.codigo)}</div>
            </td>
          </tr>
        </table>

        <div style="font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: bold; color: ${colors.marinho}; margin: 30px 0 14px 0;">Como usar</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${passo(1, "Abra o certificado pelo botão abaixo.")}
          ${passo(2, "Baixe o PDF na própria página.")}
          ${passo(3, "Quem receber o documento confere que é verdadeiro pelo QR ou pelo código.")}
        </table>

        <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin: 14px auto 8px auto;"><tr>
          <td align="center" bgcolor="${colors.marca}" style="background-color: ${colors.marca}; border-radius: 8px;"><a href="${escapeHtml(d.ctaHref)}" style="display: inline-block; padding: 15px 32px; font-size: 15px; font-weight: bold; color: #FFFFFF; text-decoration: none; border-radius: 8px;">Ver meu certificado</a></td>
        </tr></table>
        <p style="margin: 14px 0 22px 0; text-align: center; font-size: 12px; line-height: 1.6; color: ${MUTED};">O link é pessoal: quem o tiver vê o seu nome no certificado. Não o publique.</p>
      </td></tr>
      <tr><td align="center" bgcolor="${colors.marinho}" style="background-color: ${colors.marinho}; padding: 24px 20px; text-align: center; font-size: 12px; line-height: 1.7; color: #C9D6EA;">
        <div style="font-weight: bold; letter-spacing: 0.12em; text-transform: uppercase; color: #FFFFFF;">Evokaa</div>
        <div style="margin-top: 4px;">Gestão de eventos e ingressos</div>
        <div style="margin-top: 4px;">Dúvidas? <a href="mailto:contato@evokaa.com.br" style="color: #FFFFFF; text-decoration: underline;">contato@evokaa.com.br</a></div>
      </td></tr>
    </table>
   </td></tr>
  </table>`;
}
