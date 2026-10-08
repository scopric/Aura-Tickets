// deno test --allow-read supabase/functions/_shared/borderoXlsx.test.ts
import { montarBordero } from './borderoXlsx.ts'
import JSZip from 'npm:jszip@3.10.1'

const base = { evento: { titulo: 'Festa', local: '', data: '', status: 'Publicado' }, produtora: 'P', geradoEm: '2026-10-08T15:00:00Z', ingressos: [], tipos: [], cupons: {}, reembolsados: { pedidos: 0, total: 0 },
  pedidos: [{ id: 'abc12345-0000', status: 'paid', created_at: '2026-10-02T12:00:00Z', payment_method: 'pix', coupon_id: null, subtotal: 100, discount: 0, service_fee: 12, processing_fee: 3.5, total: 115.5, customer_name: 'Fulano Secreto', customer_email: 'x@y.invalid' }],
  totalBanco: { pedidos: 1, total: 115.5 } }
const textos = async (b: Uint8Array) => (await (await JSZip.loadAsync(b)).file('xl/sharedStrings.xml')!.async('string'))

Deno.test('sem a opção, nome e e-mail não entram no arquivo', async () => {
  const t = await textos(await montarBordero({ ...base, pessoais: false }))
  if (t.includes('Fulano Secreto') || t.includes('x@y.invalid') || t.includes('Comprador')) throw new Error('dado pessoal vazou')
})
Deno.test('com a opção, entram e o aviso LGPD aparece', async () => {
  const t = await textos(await montarBordero({ ...base, pessoais: true }))
  if (!t.includes('Fulano Secreto') || !t.includes('dados pessoais')) throw new Error('faltou')
})
