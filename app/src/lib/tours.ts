// Catálogo fechado dos tours do produtor. O alvo é o valor de data-tour no elemento da tela.
// Se o alvo não existir na tela (lista vazia, menu recolhido), o balão aparece centralizado.
export type PassoTour = { alvo: string; titulo: string; texto: string }
export type Tour = { rota: string; passos: PassoTour[] }

export const TOURS: Record<string, Tour> = {
  inicio: {
    rota: '/producer/dashboard',
    passos: [
      { alvo: 'inicio-numeros', titulo: 'Seus números', texto: 'Vendas, ingressos vendidos, ticket médio e eventos publicados. Contam só pedidos pagos.' },
      { alvo: 'inicio-checklist', titulo: 'Primeiro evento no ar', texto: 'Os passos para publicar seu primeiro evento. Cada item abre a tela certa com uma explicação.' },
      { alvo: 'inicio-proximos', titulo: 'Próximos eventos', texto: 'Os eventos com data pela frente, com a situação e quantos ingressos já foram vendidos.' },
      { alvo: 'evo', titulo: 'Evo, o assistente', texto: 'Tire dúvidas sobre a plataforma a qualquer momento por este botão.' },
    ],
  },
  'criar-evento': {
    rota: '/producer/planner',
    passos: [
      { alvo: 'planner-passos', titulo: 'Cinco passos', texto: 'Tipo do evento, informações, lotes de ingresso, custos e resumo. O passo atual fica destacado.' },
      { alvo: 'planner-cartao', titulo: 'Preencha cada passo', texto: 'Os campos marcados com asterisco são obrigatórios para avançar. No passo 3 você cria os lotes de ingresso, com preço e quantidade.' },
      { alvo: 'planner-navegacao', titulo: 'Voltar e avançar', texto: 'Use Voltar e Próximo. No último passo, Criar evento envia o evento para a análise da equipe.' },
    ],
  },
  eventos: {
    rota: '/producer/events',
    passos: [
      { alvo: 'eventos-criar', titulo: 'Novo evento', texto: 'Cria um evento do zero, em cinco passos.' },
      { alvo: 'eventos-busca', titulo: 'Buscar pelo nome', texto: 'Digite parte do nome para achar um evento na lista.' },
      { alvo: 'eventos-filtros', titulo: 'Filtrar por situação', texto: 'Escolha Todos, Publicado, Em análise, Rascunho, Recusado, Encerrado ou Cancelado.' },
      { alvo: 'eventos-lista', titulo: 'Seus eventos', texto: 'Cada linha mostra data, local e vendas. Os ícones à direita visualizam, editam, duplicam ou excluem.' },
    ],
  },
  configuracoes: {
    rota: '/producer/settings',
    passos: [
      { alvo: 'cfg-secoes', titulo: 'Seções', texto: 'Perfil, conta, pagamento e outras preferências ficam em abas separadas.' },
      { alvo: 'cfg-empresa', titulo: 'Dados da empresa', texto: 'Preencha a razão social. Ela conclui o passo do perfil da empresa no Início.' },
      { alvo: 'cfg-salvar', titulo: 'Salvar', texto: 'Salvar empresa grava os dados da empresa. Salvar perfil grava o restante.' },
    ],
  },
  checkin: {
    rota: '/producer/checkin',
    passos: [
      { alvo: 'checkin-evento', titulo: 'Escolha o evento', texto: 'Selecione qual evento publicado você vai validar na portaria. Sem evento publicado, o seletor aparece aqui depois da aprovação.' },
      { alvo: 'checkin-modo', titulo: 'Leitor ou lista', texto: 'O leitor valida pelo código do ingresso. A lista mostra os participantes.' },
      { alvo: 'checkin-numeros', titulo: 'Acompanhe a entrada', texto: 'Total emitido, check-ins feitos, pendentes e cancelados.' },
      { alvo: 'checkin-leitor', titulo: 'Valide um ingresso', texto: 'Aproxime o leitor ou digite o código do ingresso e confirme com Enter.' },
    ],
  },
}

// Só devolve o tour se o id existir e a tela atual for a dele
export function tourDaRota(id: string | null, pathname: string): Tour | null {
  const t = id && Object.hasOwn(TOURS, id) ? TOURS[id] : null
  if (!t) return null
  // sem barra final; /producer e /producer/dashboard são a mesma tela
  const limpo = pathname.replace(/\/+$/, '')
  const atual = limpo === '/producer' ? '/producer/dashboard' : limpo
  return atual === t.rota ? t : null
}
