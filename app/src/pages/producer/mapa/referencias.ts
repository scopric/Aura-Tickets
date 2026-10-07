// Referência de cada item da paleta: o que é (texto simples) e qual família de ilustração animada o representa. Dados puros.
export const FAMILIAS = ['onda', 'mesa', 'luz', 'amp', 'energia', 'fluxo', 'cruz', 'gota', 'vapor', 'carga', 'sombra', 'lugar', 'pisca'] as const
export type Familia = (typeof FAMILIAS)[number]
export interface Referencia { ilustracao: Familia; descricao: string }
const d = (ilustracao: Familia, descricao: string): Referencia => ({ ilustracao, descricao })

// Chave = id do item da paleta (navegação fica de fora). Textos genéricos, sem número de norma nem capacidade legal.
export const REFERENCIAS: Record<string, Referencia> = {
  // Assentos e mesas
  seat: d('lugar', 'Um lugar individual. Cada cadeira é um assento que o público pode comprar.'),
  table: d('lugar', 'Mesa com cadeiras em volta. Você define quantos lugares ela tem.'),
  buffet_table: d('vapor', 'Mesa comprida onde a comida fica exposta para o público se servir. Não vende ingresso.'),
  round_buffet: d('vapor', 'Mesa de buffet redonda, onde a comida fica exposta para o público se servir. Não vende ingresso.'),
  bistro: d('lugar', 'Mesa alta e pequena, sem cadeiras, onde o público fica em pé para conversar e apoiar a bebida.'),
  couch: d('lugar', 'Sofá para uma área de descanso e conversa, como num espaço lounge.'),
  vip_lounge: d('lugar', 'Área reservada e mais confortável para convidados ou público VIP, com sofás e mesas.'),
  bleacher: d('lugar', 'Arquibancada: fileiras de degraus onde o público assiste sentado, mais alto que o chão.'),
  poltrona: d('lugar', 'Assento estofado e fixo, como o de teatro e de cinema.'),
  cadeira_pne: d('lugar', 'Lugar reservado a pessoa com deficiência ou mobilidade reduzida, com espaço extra ao redor.'),
  espaco_cadeirante: d('lugar', 'Espaço livre no piso para quem usa cadeira de rodas assistir ao evento.'),
  banco_corrido: d('lugar', 'Banco comprido em que várias pessoas sentam lado a lado.'),
  camarote: d('lugar', 'Pequena área separada, com mesa e lugares para um grupo, em geral com vista privilegiada. Frisa é o nome do camarote nos teatros.'),
  mesa_oval: d('lugar', 'Mesa de formato oval, com cadeiras em volta.'),
  mesa_quadrada4: d('lugar', 'Mesa quadrada para quatro pessoas.'),

  // Estruturas de evento
  stage: d('pisca', 'Plataforma elevada onde acontecem as apresentações, vista por todo o público.'),
  runway_stage: d('pisca', 'Palco comprido e estreito por onde os modelos desfilam.'),
  dj_deck: d('pisca', 'Plataforma baixa onde fica o DJ, para ser visto pela pista.'),
  ledscreen: d('luz', 'Tela grande de LED que mostra imagens e vídeos, ou o show ao vivo, para quem está longe do palco.'),
  truss: d('luz', 'Estrutura de tubos de metal onde se penduram luzes, caixas de som e cenário.'),
  dancefloor: d('pisca', 'Área livre em frente ao palco ou ao DJ, onde o público fica em pé e dança.'),
  barricade: d('fluxo', 'Grade de metal na frente do palco que separa o público da área de trabalho e protege contra empurra-empurra.'),
  unifila_barrier: d('fluxo', 'Grades que formam um corredor estreito para organizar o público em uma fila só, por exemplo na entrada ou no bar.'),
  backdrop: d('pisca', 'Painel decorado com a marca do evento, usado como fundo para fotos.'),
  stage_large: d('pisca', 'Palco de grande porte para shows com muitos artistas ou muita estrutura.'),
  stage_round: d('pisca', 'Palco redondo, que pode ser visto de todos os lados.'),
  stage_ramp: d('carga', 'Plano inclinado que liga o chão ao palco, para subir equipamentos ou cadeira de rodas.'),
  vip_area: d('lugar', 'Área separada do restante, reservada ao público VIP.'),
  box_elevated: d('lugar', 'Camarote em nível mais alto que o chão, com vista privilegiada do palco.'),
  walkway: d('fluxo', 'Faixa estreita de circulação para o público ou a equipe atravessarem uma área.'),
  broadcast_booth: d('onda', 'Espaço da equipe que transmite o evento ao vivo, por rádio, TV ou internet.'),

  // Área técnica
  soundhouse: d('mesa', 'House Mix é a mixagem da casa: o som que a plateia escuta. Aqui fica a posição onde o técnico ajusta o volume e o equilíbrio das caixas voltadas ao público.'),
  foh_desk: d('mesa', 'FOH (Front of House) é a mesa de som principal, posicionada na plateia. O técnico que mixa o som para o público trabalha aqui.'),
  generator: d('energia', 'Máquina que produz energia elétrica quando não há tomada suficiente no local, ou como reserva se a luz cair.'),
  dressing_room: d('lugar', 'Área reservada aos artistas e à equipe, perto do palco, para se preparar e descansar.'),
  area: d('sombra', 'Espaço delimitado que você nomeia como quiser, por exemplo depósito ou zona de descanso.'),
  stairs: d('fluxo', 'Escada para subir ou descer de nível, como palco, camarote ou arquibancada.'),
  parking_spot: d('carga', 'Uma vaga para estacionar um veículo.'),
  pa_array: d('onda', 'P.A. / Line Array é o sistema principal de caixas de som que leva o som ao público. Line array é o conjunto de caixas penduradas ou empilhadas em coluna.'),
  light_tower: d('luz', 'Torre com refletores que iluminam o palco, a pista ou o entorno.'),
  stage_return: d('onda', 'Retorno de palco: caixa voltada para os músicos, para que eles se ouçam durante a apresentação.'),
  monitor: d('onda', 'Monitor de palco. Side fill são caixas grandes nas laterais do palco, voltadas para os músicos, para que se ouçam.'),
  backline: d('amp', 'Amplificadores, bateria e instrumentos do palco que ficam à disposição das bandas.'),
  dj_booth: d('mesa', 'Bancada com os equipamentos do DJ, como mesa de mixagem e controladoras.'),
  power_center: d('energia', 'Ponto onde a energia chega e é distribuída para som, luz e estruturas do evento.'),
  loading_area: d('carga', 'Área reservada para caminhões e veículos pararem e carregarem ou descarregarem equipamentos.'),
  generator_large: d('energia', 'Gerador de grande porte, para eventos que precisam de muita energia.'),

  // Alimentação e tenda
  bar: d('vapor', 'Balcão onde as bebidas são vendidas e servidas.'),
  l_bar: d('vapor', 'Bar com balcão em formato de L, que atende mais gente ao mesmo tempo.'),
  u_bar: d('vapor', 'Bar com balcão em formato de U, que atende mais gente ao mesmo tempo.'),
  food_court: d('vapor', 'Espaço com várias barracas de comida e mesas onde o público come.'),
  service: d('fluxo', 'Balcão de atendimento ao público.'), // ponytail: confirmar
  stand: d('sombra', 'Espaço de exposição de uma marca ou produto, onde o expositor atende o público.'),
  tent: d('sombra', 'Cobertura de lona montada sobre estrutura leve, que dá sombra e abrigo da chuva.'),
  large_tent: d('sombra', 'Tenda grande, de teto em ponta, que cobre uma área ampla.'),
  cloakroom: d('carga', 'Local onde o público deixa bolsas e pertences em guarda durante o evento.'),
  info: d('fluxo', 'Ponto de informação, onde o público tira dúvidas e se orienta.'),
  food_truck: d('vapor', 'Caminhão ou trailer equipado com cozinha para vender comida.'),
  fair_stall: d('sombra', 'Barraca simples com balcão para vender produtos ou comida.'),
  bar_island: d('vapor', 'Bar montado no meio do espaço, com atendimento pelos lados.'),
  water_point: d('gota', 'Ponto onde o público pode pegar água para beber.'),
  snack_bar: d('vapor', 'Pequeno ponto de venda de lanches e bebidas.'),
  tent_3: d('sombra', 'Tenda de 3 por 3 metros, que dá sombra e abrigo da chuva.'),
  tent_6: d('sombra', 'Tenda de 6 por 6 metros, que dá sombra e abrigo da chuva.'),
  tent_10: d('sombra', 'Tenda de 10 por 10 metros, que dá sombra e abrigo da chuva.'),
  support_tent: d('sombra', 'Tenda usada como apoio à operação, como equipe, estoque ou serviços.'),
  kitchen: d('vapor', 'Área onde a comida é preparada antes de ir para o público.'),

  // Paredes e acessos
  door: d('fluxo', 'Passagem por onde o público entra.'),
  emergency_exit: d('fluxo', 'Passagem usada para esvaziar o local com rapidez em caso de perigo. Deve ficar sempre livre.'),
  portico: d('fluxo', 'Estrutura de entrada em forma de portal, em geral com a marca do evento, por onde o público passa.'),
  ticket_office: d('fluxo', 'Local onde se compra ou se retira o ingresso e se confere a entrada.'),
  chemical_toilet: d('gota', 'Banheiro portátil individual, sem ligação com a rede de esgoto, comum em eventos.'),
  accessible_toilet: d('gota', 'Banheiro adaptado para pessoas com deficiência ou mobilidade reduzida.'),
  container_toilet: d('gota', 'Conjunto de banheiros montado dentro de um contêiner.'),
  restroom: d('gota', 'Banheiro para o público.'),
  extinguisher: d('cruz', 'Aparelho para apagar princípio de incêndio. Deve ficar visível e de fácil acesso.'),
  gate: d('fluxo', 'Passagem que pode ser aberta e fechada, para controlar a entrada e a saída.'),
  turnstile: d('fluxo', 'Roleta que libera uma pessoa por vez e ajuda a contar quem entra.'),
  accreditation: d('fluxo', 'Balcão onde equipe, imprensa e convidados retiram a credencial para entrar.'),
  medical_post: d('cruz', 'Local com equipe de saúde para os primeiros atendimentos ao público.'),
  ambulance: d('cruz', 'Veículo de emergência que fica no evento para transportar quem precisar de atendimento.'),
  fire_post: d('cruz', 'Ponto da equipe de bombeiros ou brigada de incêndio, que cuida da prevenção e do combate ao fogo.'),
  security_post: d('cruz', 'Ponto da equipe de segurança, para vigilância e ajuda ao público.'),
  double_exit: d('fluxo', 'Saída de emergência mais larga, para sair mais gente ao mesmo tempo.'), // ponytail: confirmar
  escape_route: d('fluxo', 'Caminho marcado que leva o público para fora, em caso de emergência. Deve ficar livre.'),
  wc_female: d('gota', 'Banheiro de uso feminino para o público.'),
  wc_male: d('gota', 'Banheiro de uso masculino para o público.'),
  meeting_point: d('fluxo', 'Local combinado onde as pessoas se reúnem, por exemplo após uma evacuação ou para se reencontrar.'), // ponytail: confirmar
  parking: d('carga', 'Área onde o público e a equipe estacionam os veículos.'),
}
