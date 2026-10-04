// RLS devolve sucesso com 0 linhas quando bloqueia o UPDATE/DELETE: só vale como feito se alguma linha mudou
export function exigirLinhas(error: unknown, data: unknown[] | null): void {
  if (error) throw error
  if (!data?.length) throw new Error('Nenhuma linha afetada')
}
