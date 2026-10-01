import { test, expect, type Page, type Route } from '@playwright/test'

// Meu cadastro do colaborador (/admin/meu-cadastro, alpha) com a conta demo de admin e o PostgREST simulado por
// page.route nos formatos reais: leitura da ficha em staff_profiles e UPDATE direto (a RLS e os CHECKs estão no
// banco, docs/sql/20261002_convite_colaborador.sql; aqui é a tela e o que ela manda).

const BASE = process.env.PW_BASE_URL || 'http://localhost:3000'
const ALPHA = process.env.PW_ALPHA_URL || BASE.replace('//localhost', '//alpha.localhost')
const ADMIN_DEMO = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d'

const FICHA = {
  user_id: ADMIN_DEMO, invite_id: 'conv-1', email: 'admin@aura.teste', cargo: 'Atendimento', nome_completo: 'Clara Teste da Silva',
  cpf: '52998224725', rg: '12.345.678-9', data_nascimento: '1990-05-20', cep: '01310100', rua: 'Avenida Paulista', numero: '1000',
  complemento: 'Sala 2', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP', email_secundario: 'clara.pessoal@teste.invalid',
  telefone: '+5511987654321', whatsapp: '+5511987654321', emergencia_nome: 'Pedro Teste', emergencia_parentesco: 'Irmão',
  emergencia_telefone: '+5511912345678', banco: null, agencia: null, conta: null, pix_tipo: 'cpf', pix_chave: '52998224725',
  created_at: '2026-10-01T12:00:00Z', updated_at: '2026-10-01T12:00:00Z',
}
// Colunas que o GRANT de UPDATE deixa o colaborador gravar (nunca user_id, invite_id, email, cargo nem updated_at)
const EDITAVEIS = ['nome_completo', 'cpf', 'rg', 'data_nascimento', 'cep', 'rua', 'numero', 'complemento', 'bairro', 'cidade', 'uf',
  'email_secundario', 'telefone', 'whatsapp', 'emergencia_nome', 'emergencia_parentesco', 'emergencia_telefone', 'banco', 'agencia',
  'conta', 'pix_tipo', 'pix_chave'].sort()

type Resposta = { status: number; body: unknown }

async function simular(page: Page, ficha: typeof FICHA | null, aoGravar?: (body: Record<string, unknown>) => Resposta) {
  const gravados: { url: string; body: Record<string, unknown> }[] = []
  await page.route('**/rest/v1/**', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/staff_profiles?*', (r: Route) => {
    const req = r.request()
    if (req.method() === 'GET') return r.fulfill({ json: ficha ? [ficha] : [] })
    const body = req.postDataJSON() as Record<string, unknown>
    gravados.push({ url: req.url(), body })
    const resp = aoGravar?.(body) ?? { status: 200, body: [{ ...ficha, ...body, updated_at: '2026-10-01T13:00:00Z' }] }
    return r.fulfill({ status: resp.status, contentType: 'application/json', body: JSON.stringify(resp.body) })
  })
  return gravados
}

async function entrar(page: Page) {
  await page.goto(`${ALPHA}/auth/login`)
  await page.getByPlaceholder('seu@email.com').fill('admin@aura.teste')
  await page.getByPlaceholder('Sua senha').fill('senha123')
  await page.getByRole('button', { name: /Entrar/ }).first().click()
  await page.waitForURL((u) => !u.toString().includes('/auth/login'), { timeout: 20000 })
  await page.goto(`${ALPHA}/admin/meu-cadastro`)
  await expect(page.getByRole('heading', { name: 'Meu cadastro' })).toBeVisible()
}

test.describe('Meu cadastro do colaborador', () => {
  test('mostra a ficha, grava só as colunas permitidas, já normalizadas, e avisa da mudança de Pix', async ({ page }) => {
    const gravados = await simular(page, FICHA)
    await entrar(page)

    // e-mail e cargo só para leitura; o resto vem preenchido
    await expect(page.getByLabel('E-mail da conta', { exact: true })).toHaveValue('admin@aura.teste')
    await expect(page.getByLabel('E-mail da conta', { exact: true })).toBeDisabled()
    await expect(page.getByLabel('Cargo', { exact: true })).toHaveValue('Atendimento')
    await expect(page.getByLabel('Cargo', { exact: true })).toBeDisabled()
    await expect(page.getByLabel('Nome completo')).toHaveValue('Clara Teste da Silva')
    await expect(page.getByLabel('CPF', { exact: true })).toHaveValue('529.982.247-25')
    await expect(page.getByLabel('CEP')).toHaveValue('01310-100')
    await expect(page.getByLabel('Chave Pix', { exact: true })).toHaveValue('529.982.247-25')

    // aviso do Pix só quando o pagamento muda
    const aviso = page.getByText('A mudança de Pix ou de dados bancários fica registrada')
    await page.getByLabel('Nome completo').fill('  Clara Teste Souza  ')
    await expect(aviso).toHaveCount(0)
    await page.getByLabel('Tipo de chave Pix').selectOption('email')
    await expect(aviso).toBeVisible()
    await page.getByLabel('Chave Pix', { exact: true }).fill('  Clara.Pix@Teste.Invalid ')
    await page.getByLabel('Complemento (opcional)').fill('')

    await page.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(page.getByText('Cadastro atualizado. A mudança de pagamento ficou registrada.')).toBeVisible()
    expect(gravados).toHaveLength(1)
    expect(gravados[0].url).toContain(`user_id=eq.${ADMIN_DEMO}`)
    expect(Object.keys(gravados[0].body).sort()).toEqual(EDITAVEIS)
    expect(gravados[0].body).toMatchObject({
      nome_completo: 'Clara Teste Souza', cpf: '52998224725', cep: '01310100', complemento: null,
      pix_tipo: 'email', pix_chave: 'clara.pix@teste.invalid', banco: null,
    })
    // depois de salvar, a tela mostra o que o banco gravou e o aviso some
    await expect(page.getByLabel('Chave Pix', { exact: true })).toHaveValue('clara.pix@teste.invalid')
    await expect(aviso).toHaveCount(0)
  })

  test('a tela recusa antes de enviar e traduz a recusa do banco', async ({ page }) => {
    let resposta: Resposta = { status: 400, body: { code: '23514', details: null, hint: null, message: 'new row for relation "staff_profiles" violates check constraint "staff_cpf_ok"' } }
    const gravados = await simular(page, FICHA, () => resposta)
    await entrar(page)

    await page.getByLabel('CPF', { exact: true }).fill('111.111.111-11')
    await page.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(page.getByRole('alert')).toHaveText('CPF inválido.')
    expect(gravados).toHaveLength(0)

    // CHECK do banco em português
    await page.getByLabel('CPF', { exact: true }).fill('529.982.247-25')
    await page.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(page.getByRole('alert')).toHaveText('CPF inválido.')
    expect(gravados).toHaveLength(1)

    // RLS barrou (sem 2FA nesta sessão): o PATCH devolve lista vazia (o maybeSingle vira null) e a tela não confirma
    resposta = { status: 200, body: [] }
    await page.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(page.getByRole('alert')).toContainText('confirme a verificação em duas etapas')
    await expect(page.getByText('Cadastro atualizado')).toHaveCount(0)
  })

  test('conta sem ficha vê um aviso, não o formulário', async ({ page }) => {
    await simular(page, null)
    await entrar(page)
    await expect(page.getByText('Esta conta não tem cadastro de colaborador.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Salvar alterações' })).toHaveCount(0)
  })

  test('item "Meu cadastro" no menu', async ({ page, isMobile }) => {
    test.skip(isMobile, 'no celular o menu é gaveta; a rota é a mesma')
    await simular(page, FICHA)
    await entrar(page)
    await page.goto(`${ALPHA}/admin/dashboard`)
    await page.getByRole('link', { name: 'Meu cadastro' }).click()
    await expect(page).toHaveURL(`${ALPHA}/admin/meu-cadastro`)
  })
})
