// Catálogo fechado dos tours (produtor e participante). O alvo é o valor de data-tour no elemento da tela.
// Se o alvo não existir na tela (lista vazia, menu recolhido), o balão aparece centralizado.
export type PassoTour = { alvo: string; titulo: string; texto: string }
export type Tour = { nome: string; rota: string; passos: PassoTour[] }

export const TOURS: Record<string, Tour> = {
  inicio: {
    nome: 'Início',
    rota: '/producer/dashboard',
    passos: [
      { alvo: 'inicio-numeros', titulo: 'Seus números', texto: 'Receita bruta e ingressos vendidos do período, comparados com o período anterior. Contam só pedidos pagos e incluem a taxa do comprador.' },
      { alvo: 'inicio-checklist', titulo: 'Primeiro evento no ar', texto: 'Os passos para publicar seu primeiro evento. Cada item abre a tela certa com uma explicação.' },
      { alvo: 'inicio-proximos', titulo: 'Seus eventos', texto: 'Cada evento com a situação, quantos ingressos já foram vendidos e a receita bruta. Clique na linha para abrir.' },
      { alvo: 'evo', titulo: 'Evo, o assistente', texto: 'Tire dúvidas sobre a plataforma a qualquer momento por este botão.' },
    ],
  },
  'app-inicio': {
    nome: 'Início',
    rota: '/app/hub',
    passos: [
      { alvo: 'app-ingressos', titulo: 'Seus ingressos', texto: 'Os ingressos que você comprou ficam aqui, com o QR Code para entrar no evento.' },
      { alvo: 'app-explorar', titulo: 'Explorar eventos', texto: 'Veja os eventos à venda e escolha o seu.' },
      { alvo: 'evo', titulo: 'Evo, o assistente', texto: 'Tire dúvidas ou fale com a equipe da Evokaa por este botão.' },
    ],
  },
  'criar-evento': {
    nome: 'Criar evento',
    rota: '/producer/planner',
    passos: [
      { alvo: 'planner-passos', titulo: 'Cinco passos', texto: 'Tipo do evento, informações, lotes de ingresso, custos e resumo. O passo atual fica destacado.' },
      { alvo: 'planner-cartao', titulo: 'Preencha cada passo', texto: 'Os campos marcados com asterisco são obrigatórios para avançar. No passo 3 você cria os lotes de ingresso, com preço e quantidade.' },
      { alvo: 'planner-navegacao', titulo: 'Voltar e avançar', texto: 'Use Voltar e Próximo. No último passo, Criar evento envia o evento para a análise da equipe.' },
    ],
  },
  eventos: {
    nome: 'Eventos',
    rota: '/producer/events',
    passos: [
      { alvo: 'eventos-criar', titulo: 'Novo evento', texto: 'Cria um evento em um minuto: só o nome é obrigatório, o resto você completa no painel do evento.' },
      { alvo: 'eventos-busca', titulo: 'Buscar pelo nome', texto: 'Digite parte do nome para achar um evento na lista.' },
      { alvo: 'eventos-filtros', titulo: 'Filtrar por situação', texto: 'Escolha Todos, Publicado, Em análise, Rascunho, Recusado, Encerrado ou Cancelado.' },
      { alvo: 'eventos-lista', titulo: 'Seus eventos', texto: 'Cada linha mostra data, local e vendas. Os ícones à direita visualizam, editam, duplicam ou excluem.' },
    ],
  },
  configuracoes: {
    nome: 'Configurações',
    rota: '/producer/settings',
    passos: [
      { alvo: 'cfg-secoes', titulo: 'Seções', texto: 'Perfil, conta, pagamento e outras preferências ficam em abas separadas.' },
      { alvo: 'cfg-empresa', titulo: 'Dados da empresa', texto: 'Preencha a razão social. Ela conclui o passo do perfil da empresa no Início.' },
      { alvo: 'cfg-salvar', titulo: 'Salvar', texto: 'Salvar empresa grava os dados da empresa. Salvar perfil grava o restante.' },
    ],
  },
  checkin: {
    nome: 'Check-in',
    rota: '/producer/checkin',
    passos: [
      { alvo: 'checkin-evento', titulo: 'Escolha o evento', texto: 'Selecione qual evento publicado você vai validar na portaria. Sem evento publicado, o seletor aparece aqui depois da aprovação.' },
      { alvo: 'checkin-modo', titulo: 'Leitor ou lista', texto: 'O leitor valida pelo código do ingresso. A lista mostra os participantes.' },
      { alvo: 'checkin-numeros', titulo: 'Acompanhe a entrada', texto: 'Total emitido, check-ins feitos, pendentes e cancelados.' },
      { alvo: 'checkin-leitor', titulo: 'Valide um ingresso', texto: 'Aproxime o leitor ou digite o código do ingresso e confirme com Enter.' },
    ],
  },
}

// sem barra final; /producer e /producer/dashboard são a mesma tela
function rotaLimpa(pathname: string) {
  const limpo = pathname.replace(/\/+$/, '')
  return limpo === '/producer' ? '/producer/dashboard' : limpo
}

// Só devolve o tour se o id existir e a tela atual for a dele
export function tourDaRota(id: string | null, pathname: string): Tour | null {
  const t = id && Object.hasOwn(TOURS, id) ? TOURS[id] : null
  if (!t) return null
  return rotaLimpa(pathname) === t.rota ? t : null
}

// O tour da tela em que a pessoa está (para o Evo oferecer), ou null se a tela não tem tour
export function tourDoCaminho(pathname: string): { id: string; nome: string; passos: number } | null {
  const atual = rotaLimpa(pathname)
  const achado = Object.entries(TOURS).find(([, t]) => t.rota === atual)
  return achado ? { id: achado[0], nome: achado[1].nome, passos: achado[1].passos.length } : null
}
