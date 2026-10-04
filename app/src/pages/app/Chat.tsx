import * as I from '@/components/icones/evokaa16'

// O chat com o produtor ainda não funciona (a tabela `messages` do banco é a do CRM do produtor e não há regra para o
// participante); a religação é a Onda 1 da auditoria. Até lá a página diz isso e aponta o canal que funciona: o Evo
// (botão flutuante), que fala com a equipe da Evokaa.
export default function AppChat() {
  return (
    <div className="max-w-3xl text-foreground">
      <h1 className="mb-6 text-2xl font-semibold tracking-[-0.015em]">Chat</h1>
      <div role="status" className="flex max-w-sm flex-col items-start gap-3">
        <I.Conversa size={40} className="text-muted-foreground" aria-hidden="true" />
        <p className="text-lg font-semibold">O chat com o produtor ainda não está disponível.</p>
        <p className="text-[15px] text-muted-foreground">Para tirar uma dúvida, fale com a equipe da Evokaa pelo botão do Evo, no canto da tela.</p>
      </div>
    </div>
  )
}
