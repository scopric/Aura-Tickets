// Exportação da conversa com o Evo em Markdown (botão "Baixar conversa").
const dois = (n: number) => String(n).padStart(2, '0')

export function conversaParaMarkdown(mensagens: { role: 'user' | 'model'; text: string }[], agora: Date) {
  const quando = `${dois(agora.getDate())}/${dois(agora.getMonth() + 1)}/${agora.getFullYear()} ${dois(agora.getHours())}:${dois(agora.getMinutes())}`
  const corpo = mensagens.map((m) => `**${m.role === 'user' ? 'Você' : 'Evo'}:** ${m.text}`).join('\n\n')
  return `# Conversa com o Evo — ${quando}\n\n${corpo}\n`
}

export function nomeArquivoConversa(agora: Date) {
  return `evo-conversa-${agora.getFullYear()}-${dois(agora.getMonth() + 1)}-${dois(agora.getDate())}-${dois(agora.getHours())}${dois(agora.getMinutes())}.md`
}
