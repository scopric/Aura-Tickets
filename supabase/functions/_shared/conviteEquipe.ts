// E-mail do convite da equipe (emailType 'team_invite' do send-email). Função pura: o teste em app/src/test cobre o nome e o escape.
import { colors, emailShell, escapeHtml } from "./email.ts";

const CARGOS: Record<string, string> = { admin: "Administrador", editor: "Editor", viewer: "Visualizador" };

// O nome do produtor é texto livre e o e-mail sai do domínio da Evokaa: lista de permissão, não de bloqueio. Ficam só letras
// latinas (com acento), espaço, hífen e apóstrofo; ponto, dígito, colchete, símbolo e letra de outro alfabeto (homóglifo) saem.
// NFKC antes: junta o acento decomposto e converte letras fullwidth/pequenas-capitais em letras comuns. Nada de URL, telefone ou quebra de linha passa.
function nomeSeguro(produtor: string) {
  const limpo = produtor.normalize("NFKC").replace(/[^\p{Script=Latin}\s'’-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 60).trim();
  return limpo || "Um produtor da Evokaa";
}

export function montarConviteEquipe(produtor: string, role: string, appUrl: string) {
  const nome = nomeSeguro(produtor);
  const cargo = CARGOS[role] ?? CARGOS.viewer;
  const html = emailShell(
    "Convite para a equipe",
    `<strong>${escapeHtml(nome)}</strong> convidou você para a equipe da portaria como <strong>${cargo}</strong>.`,
    `<p style="line-height: 1.6; font-size: 14px; color: ${colors.textMuted};">Para aceitar, entre na Evokaa com a conta deste e-mail (crie uma, se ainda não tiver) e ative a verificação em duas etapas no seu perfil. O convite não expira.</p>`,
    "Ver meu convite",
    `${appUrl}/equipe`,
  );
  return { subject: `${nome} convidou você para a equipe na Evokaa`, html };
}
