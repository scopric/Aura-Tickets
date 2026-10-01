// Exportação CSV do painel admin: monta o texto, baixa no navegador e pagina o PostgREST (1.000 linhas por consulta).

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  let text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  // Célula que começa com = + - @ (mesmo depois de espaços), tab ou CR vira fórmula no Excel/LibreOffice (injeção de fórmula): prefixar com apóstrofo
  if (/^\s*[=+\-@]|^[\t\r]/.test(text)) text = `'${text}`
  return /[",\n\r']/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Cabeçalho = nomes das colunas; BOM UTF-8 para o Excel abrir acentos corretamente. */
export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const lines = [columns.join(',')]
  for (const row of rows) lines.push(columns.map(c => escapeCell(row[c])).join(','))
  return '﻿' + lines.join('\r\n')
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/** `evokaa-<tabela>-AAAA-MM-DD.csv` */
export function csvFilename(table: string): string {
  return `evokaa-${table}-${new Date().toISOString().slice(0, 10)}.csv`
}

/** Busca todas as linhas em blocos de `step` até vir um bloco menor que `step`. Lança o erro real do Supabase. */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  step = 1000
): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += step) {
    const { data, error } = await page(from, from + step - 1)
    if (error) throw error
    const rows = data || []
    all.push(...rows)
    if (rows.length < step) return all
  }
}
