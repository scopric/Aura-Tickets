// E-mail do convite da equipe (emailType 'team_invite' do send-email). Função pura: o teste em app/src/test cobre o nome e o escape.
import { colors, emailShell, escapeHtml } from "./email.ts";

const CARGOS: Record<string, string> = { admin: "Administrador", editor: "Editor", viewer: "Visualizador" };

// O nome do produtor (empresa ou nome das configurações) é texto livre e o e-mail sai do domínio da Evokaa: lista de permissão,
// não de bloqueio. Ficam só letras latinas (com acento), dígitos, "&", espaço, hífen e apóstrofo; ponto, colchete, barra, símbolo
// e letra de outro alfabeto (homóglifo) saem, e, com mais de 4 dígitos no total (telefone, mesmo agrupado), todos os dígitos também. NFKC antes: junta o
// acento decomposto e converte letras fullwidth/pequenas-capitais em letras comuns. Nada de URL ou quebra de linha passa.
function nomeSeguro(produtor: string) {
  let limpo = produtor.normalize("NFKC").replace(/[^\p{Script=Latin}\d&\s'’-]/gu, "");
  // Telefone com dígitos agrupados ("11 9999 9999", "0800 123 4567"): mais de 4 dígitos no total, tira todos os dígitos.
  if ((limpo.match(/\d/g) ?? []).length > 4) limpo = limpo.replace(/\d/g, "");
  limpo = limpo.replace(/\s+/g, " ").trim().slice(0, 60).trim();
  return /\p{L}|\d/u.test(limpo) ? limpo : "Um produtor da Evokaa";
}

export function montarConviteEquipe(produtor: string, role: string, appUrl: string) {
  const nome = nomeSeguro(produtor);
  const cargo = CARGOS[role] ?? CARGOS.viewer;
  const html = emailShell(
    "Convite para a equipe",
    `Você foi convidado para a equipe de <strong>${escapeHtml(nome)}</strong> como <strong>${cargo}</strong>.`,
    `<p style="line-height: 1.6; font-size: 14px; color: ${colors.textMuted};">Para aceitar, entre na Evokaa com a conta deste e-mail (crie uma, se ainda não tiver) e ative a verificação em duas etapas no seu perfil. O convite não expira.</p>`,
    "Ver meu convite",
    `${appUrl}/equipe`,
  );
  return { subject: `Convite para a equipe de ${nome} na Evokaa`, html };
}
