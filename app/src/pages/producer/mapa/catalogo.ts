// Tipos novos do catálogo (dados puros, sem importar o modelo para não criar ciclo).
// Linha: [categoria, tipo, nome, largura m, altura m, cor, capacidade, forma ('r' retângulo | 'c' círculo)]
// ponytail: tamanhos são referências de mercado/estimativas (palco, tendas, food truck, ambulância etc.);
// o produtor ajusta no editor. Capacidade só onde faz sentido (arquibancada, camarote, VIP).
export const NOVOS = [
  ['seating', 'bleacher', 'Arquibancada', 10, 3, '#64748b', 80, 'r'],

  ['structures', 'stage_large', 'Palco Grande', 16, 8, '#444444', 0, 'r'],
  ['structures', 'stage_round', 'Palco Circular', 8, 8, '#444444', 0, 'c'],
  ['structures', 'stage_ramp', 'Rampa de Palco', 2, 3, '#57534e', 0, 'r'],
  ['structures', 'vip_area', 'Área VIP', 10, 6, '#be185d', 40, 'r'],
  ['structures', 'box_elevated', 'Camarote Elevado', 8, 4, '#9333ea', 20, 'r'],
  ['structures', 'walkway', 'Passarela', 2, 10, '#78716c', 0, 'r'],
  ['structures', 'broadcast_booth', 'Cabine de Transmissão', 3, 2.5, '#0e7490', 0, 'r'],

  ['technical', 'pa_array', 'P.A. / Line Array', 2, 1.5, '#4f46e5', 0, 'r'],
  ['technical', 'light_tower', 'Torre de Iluminação', 1.5, 1.5, '#ca8a04', 0, 'r'],
  ['technical', 'stage_return', 'Retorno de Palco', 0.7, 0.5, '#6366f1', 0, 'r'],
  ['technical', 'monitor', 'Monitor (Side Fill)', 0.8, 0.8, '#6366f1', 0, 'r'],
  ['technical', 'backline', 'Backline', 3, 2, '#4338ca', 0, 'r'],
  ['technical', 'dj_booth', 'Cabine de DJ', 3, 1.5, '#4f46e5', 0, 'r'],
  ['technical', 'power_center', 'Central de Energia', 2, 1.2, '#ca8a04', 0, 'r'],
  ['technical', 'loading_area', 'Carga e Descarga', 8, 4, '#78716c', 0, 'r'],
  ['technical', 'generator_large', 'Gerador Grande', 4, 1.8, '#a16207', 0, 'r'],

  ['food', 'food_truck', 'Food Truck', 5.5, 2.2, '#ea580c', 0, 'r'],
  ['food', 'fair_stall', 'Barraca de Feira', 3, 2, '#f97316', 0, 'r'],
  ['food', 'bar_island', 'Ilha de Bar', 3, 3, '#7c3aed', 0, 'r'],
  ['food', 'water_point', 'Bebedouro', 0.6, 0.6, '#0ea5e9', 0, 'c'],
  ['food', 'snack_bar', 'Lanchonete', 4, 3, '#ea580c', 0, 'r'],
  ['food', 'tent_3', 'Tenda 3x3', 3, 3, '#6d28d9', 0, 'r'],
  ['food', 'tent_6', 'Tenda 6x6', 6, 6, '#6d28d9', 0, 'r'],
  ['food', 'tent_10', 'Tenda 10x10', 10, 10, '#6d28d9', 0, 'r'],
  ['food', 'support_tent', 'Tenda de Apoio', 5, 5, '#7c3aed', 0, 'r'],
  ['food', 'kitchen', 'Cozinha', 5, 3, '#c2410c', 0, 'r'],

  ['facilities', 'gate', 'Portão', 4, 0.3, '#0f766e', 0, 'r'],
  ['facilities', 'turnstile', 'Catraca', 0.8, 1, '#0f766e', 0, 'r'],
  ['facilities', 'accreditation', 'Credenciamento', 4, 2, '#0284c7', 0, 'r'],
  ['facilities', 'medical_post', 'Posto Médico', 4, 3, '#dc2626', 0, 'r'],
  ['facilities', 'ambulance', 'Ambulância', 6, 2.2, '#ef4444', 0, 'r'],
  ['facilities', 'fire_post', 'Bombeiro', 3, 2.5, '#b91c1c', 0, 'r'],
  ['facilities', 'security_post', 'Posto de Segurança', 2, 2, '#1d4ed8', 0, 'r'],
  ['facilities', 'double_exit', 'Saída de Emergência Dupla', 3.6, 0.3, '#dc2626', 0, 'r'],
  ['facilities', 'escape_route', 'Rota de Emergência', 6, 1.2, '#16a34a', 0, 'r'],
  ['facilities', 'wc_female', 'Banheiro Feminino', 4, 2.5, '#db2777', 0, 'r'],
  ['facilities', 'wc_male', 'Banheiro Masculino', 4, 2.5, '#2563eb', 0, 'r'],
  ['facilities', 'meeting_point', 'Ponto de Encontro', 4, 4, '#16a34a', 0, 'c'],
  ['facilities', 'parking', 'Estacionamento', 20, 10, '#64748b', 0, 'r'],
] as const

export type TipoNovo = (typeof NOVOS)[number][1]

export const rotulosNovos = Object.fromEntries(NOVOS.map(n => [n[1], n[2]])) as Record<TipoNovo, string>
export const defaultsNovos = Object.fromEntries(
  NOVOS.map(n => [n[1], { wMeter: n[3], hMeter: n[4], cap: n[6], color: n[5] }]),
) as Record<TipoNovo, { wMeter: number; hMeter: number; cap: number; color: string }>
export const formasNovas: Record<string, string> = Object.fromEntries(NOVOS.map(n => [n[1], n[7]]))
