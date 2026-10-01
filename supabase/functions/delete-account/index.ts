// Exclusão de conta pelo próprio usuário (LGPD, art. 18, VI).
//
// Por que anonimizar em vez de apagar: `profiles` cai em cascata com `auth.users`, mas
// `orders`, `tickets`, `transactions` (e mais 20 tabelas) apontam para `profiles` SEM cascata
// e precisam ser guardados (obrigação fiscal; LGPD, art. 16, I). Apagar de verdade falharia
// em qualquer conta com compra. Então: o perfil vira "Usuário removido" sem dado pessoal,
// o cadastro de produtor perde dados bancários e chaves, e-mail/telefone saem de pedidos,
// ingressos e saques (nome e CPF ficam para o fisco), as tabelas só pessoais são apagadas
// e, só se tudo isso deu certo, o login é desativado (soft delete do GoTrue: sessões
// encerradas, e-mail/telefone ofuscados, senha e identidades removidas). Se algo falhar
// antes, nada de login é tocado e o usuário pode tentar de novo: todos os passos são
// idempotentes.
//
// Chamada: POST com o JWT do próprio usuário (supabase.functions.invoke('delete-account')).
// Só age sobre o usuário do token: não lê nada do body.
//
// Colunas obrigatórias no banco (conferido em 27/09/2026): profiles.email e admin_permissions
// (text[]), producer_profiles.company_name, cnpj (único), bank_account e notification_settings
// (jsonb), tickets.buyer_email. Por isso valores vazios, não nulos.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"
import { corsHeaders } from "../_shared/cors.ts"
import { mfaOk } from "../_shared/mfa.ts"

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'Método não permitido' })

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'Não autenticado' })

  // 1. Quem está pedindo: o dono do token, validado no GoTrue; e só ele
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  const { data: { user }, error: userError } = await admin.auth.getUser(token)
  if (userError || !user) return json(401, { error: 'Não autenticado' })
  // Conta com 2FA: só com o código confirmado nesta sessão (quem tem só a senha não exclui a conta)
  if (!(await mfaOk(req))) return json(403, { error: 'Confirme o código do 2FA (saia e entre de novo) para excluir a conta.' })
  const uid = user.id
  const anonEmail = `removido-${uid}@anonimo.evokaa.com.br`

  // Produtor com evento publicado e ainda por acontecer: não some enquanto há venda em curso
  // (o repasse ficaria sem destino). Ele cancela ou encerra o evento e tenta de novo.
  const { data: ativos, error: eventsError } = await admin.from('events')
    .select('id').eq('producer_id', uid).eq('status', 'published')
    .gte('start_date', new Date().toISOString()).limit(1)
  if (eventsError) return json(500, { error: 'Não foi possível conferir seus eventos. Tente de novo.' })
  if (ativos && ativos.length) {
    return json(409, { error: 'Você tem evento publicado com data futura. Cancele ou encerre seus eventos antes de excluir a conta.' })
  }
  // Saque em andamento: o destino bancário seria apagado abaixo e o repasse ficaria sem para onde ir
  const { data: saques, error: wError } = await admin.from('withdrawals')
    .select('id').eq('producer_id', uid).in('status', ['pending', 'processing']).limit(1)
  if (wError) return json(500, { error: 'Não foi possível conferir seus saques. Tente de novo.' })
  if (saques && saques.length) {
    return json(409, { error: 'Você tem um saque em andamento. Aguarde a conclusão antes de excluir a conta.' })
  }

  // 2..5: cada passo é idempotente; a primeira falha interrompe ANTES de mexer no login
  const steps: Array<[string, () => PromiseLike<{ error: { message: string } | null }>]> = [
    // Perfil anonimizado (a linha fica: pedidos e ingressos apontam para ela)
    ['profiles', () => admin.from('profiles').update({
      email: anonEmail, full_name: 'Usuário removido', phone: null, cpf: null, avatar_url: null,
      bio: null, city: null, birth_date: null, instagram: null, tiktok: null, linkedin: null,
      website: null, stripe_customer_id: null, role: 'user', admin_permissions: [], is_verified: false,
    }).eq('id', uid)],
    // Cadastro de produtor: dados bancários e chaves fora (0 linhas se não for produtor)
    ['producer_profiles', () => admin.from('producer_profiles').update({
      company_name: 'Removido', cnpj: `REMOVIDO-${uid}`, stripe_account_id: null, woovi_account_id: null,
      bank_account: {}, pix_key: null, webhook_url: null, notification_settings: {}, is_verified: false,
    }).eq('id', uid)],
    // Compras: nome e CPF ficam (fisco); e-mail e telefone não são exigência fiscal
    ['orders', () => admin.from('orders').update({ customer_email: anonEmail, customer_phone: null }).eq('user_id', uid)],
    ['tickets', () => admin.from('tickets').update({ buyer_email: anonEmail }).eq('user_id', uid)],
    // Saques do produtor: destino bancário fora (sacar antes de excluir a conta)
    ['withdrawals', () => admin.from('withdrawals').update({ pix_key: null, bank_account: {} }).eq('producer_id', uid)],
    // CRM do produtor: ficha do participante sem base fiscal
    ['customers', () => admin.from('customers').update({ name: 'Usuário removido', email: anonEmail, phone: null, notes: null }).eq('user_id', uid)],
    // Conteúdo escrito pelo usuário (chat entre usuários, chat de atendimento e chat de suporte antigo)
    ['event_reviews', () => admin.from('event_reviews').update({ comment: null }).eq('user_id', uid)],
    ['messages', () => admin.from('messages').delete().eq('sender_id', uid)],
    // Chat de atendimento (conversations): só o que a pessoa escreveu como CLIENTE sai; se ela
    // atendeu (admin/produtor), as respostas dela nas conversas dos outros ficam. Arquivos: só os
    // que ELA subiu (owner) — anexos das mensagens dela de cliente e os nunca anexados
    // (chat_arquivos_a_apagar); arquivo de outra pessoa nunca é removido.
    // ponytail: remove() numa chamada só; em lotes se alguém passar de centenas de arquivos.
    ['chat_anexos', async () => {
      const { data, error } = await admin.rpc('chat_arquivos_a_apagar', { p_user: uid })
      if (error) return { error }
      const paths = (data ?? []) as string[]
      if (!paths.length) return { error: null }
      const { error: storageError } = await admin.storage.from('chat-anexos').remove(paths)
      return { error: storageError }
    }],
    ['conversation_messages', () => admin.from('conversation_messages').delete().eq('sender_id', uid).eq('sender_role', 'customer')],
    ['conversations', () => admin.from('conversations').update({ last_message_preview: null }).eq('user_id', uid)],
    ['chat_contacts', () => admin.from('chat_contacts').update({
      name: 'Usuário removido', email: anonEmail, phone: null, marketing_opt_in: false, marketing_opt_in_at: null,
    }).eq('user_id', uid)],
    ['support_messages', () => admin.from('support_messages').delete().eq('sender_id', uid)],
    ['support_sessions', () => admin.from('support_sessions').update({ user_id: null }).eq('user_id', uid)],
    // Convites de colaborador para o e-mail da conta (o banco guarda o e-mail em minúsculas)
    ['admin_invites', () => admin.from('admin_invites').delete().eq('email', (user.email ?? '').toLowerCase())],
    // Tabelas só pessoais, sem valor fiscal. ai_usage é o registro de uso do Evo, que a Política
    // (seção 8) guarda "até você pedir a eliminação": apagar, não anonimizar (o rascunho criado
    // pelo Evo guarda o id da linha em events.settings e religaria a pessoa).
    // ponytail: pergunta ao Evo nos segundos da exclusão ainda pode gravar 1 linha (ai_log); fechar exige barrar no SQL
    ...['user_activities', 'user_preferences', 'user_profiles_ext', 'user_custom_features',
        'user_course_progress', 'onboarding_logs', 'notifications', 'interest_lists',
        'ai_usage', 'ai_credit_grants', 'staff_profiles', 'staff_profiles_historico_pagamento']
      .map((t): [string, () => PromiseLike<{ error: { message: string } | null }>] =>
        [t, () => admin.from(t).delete().eq('user_id', uid)]),
  ]
  for (const [name, run] of steps) {
    const { error } = await run()
    if (error) {
      if (name === 'profiles' && /pelo menos um super_admin/.test(error.message)) {
        return json(409, { error: 'Você é o único Super Admin. Promova outra pessoa a Super Admin antes de excluir a conta.' })
      }
      console.error('[delete-account]', uid, name, error.message)
      return json(500, { error: `Não foi possível concluir (${name}). Tente de novo; se persistir, fale com dpo@evokaa.com.br.` })
    }
  }

  // 6. Login desativado por último: sessões encerradas, e-mail/telefone ofuscados, senha e identidades fora
  const { error: authError } = await admin.auth.admin.deleteUser(uid, true)
  if (authError) {
    console.error('[delete-account]', uid, 'auth', authError.message)
    return json(500, { error: 'Dados removidos, mas o login não pôde ser desativado. Tente de novo.' })
  }
  return json(200, { ok: true })
})
