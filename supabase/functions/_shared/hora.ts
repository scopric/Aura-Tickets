// Hora do evento como o banco entrega ("20:00:00") -> "20h" ou "20h30". Vazio ou fora do padrão -> "" (quem chama decide o que mostrar).
export function formatarHora(hora: string | null | undefined): string {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec((hora ?? "").trim());
  return m ? `${Number(m[1])}h${m[2] === "00" ? "" : m[2]}` : "";
}
