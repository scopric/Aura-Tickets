// Contas de demonstração (*@aura.teste, ver hooks/useAuth.ts): existem só no navegador, em desenvolvimento.
// Dado de exemplo (eventos, pedidos, ingressos, cardápio) aparece SÓ para elas e SÓ em desenvolvimento;
// visitante e conta real veem o banco de verdade (Decisão 25 do cofre: vitrine vazia com convite).
export const DEMO_USER_IDS = new Set([
  'd3f6ab7a-b847-4aa4-af6c-033a738c2ce4', // produtor@aura.teste
  'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', // admin@aura.teste
  'b2c3d4e5-f6a7-8901-bcde-f23456789012', // user@aura.teste
])

export function isDemoAccount(userId?: string | null): boolean {
  return import.meta.env.DEV && !!userId && DEMO_USER_IDS.has(userId)
}
