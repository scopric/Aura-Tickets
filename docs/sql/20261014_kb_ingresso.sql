-- =============================================================================
-- P3 da fila de auditorias (participante): artigo "Onde vejo meus ingressos?" corrigido e publicado. 04/10/2026.
-- SÓ CONTEÚDO: atualiza uma linha de public.kb_articles (slug lev-a10, vinda do seed 20261003_kb_seed.sql como
-- RASCUNHO porque o texto antigo falava de "Todos, Ativos e Histórico" e a tela hoje tem Próximos e Anteriores).
-- Não cria tabela, função, política nem permissão.
--
-- Como aplicar: colar o arquivo inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA pelo TextEdit: erro 17). Uma transação.
-- Idempotente: só toca o artigo se ele ainda for o do seed, sem edição feita no admin (updated_at = created_at) e ainda
-- em rascunho. Se o admin já mexeu (ou excluiu o artigo), o arquivo não altera nada e avisa no painel de mensagens.
-- NÃO mover para supabase/migrations/ (motivo no cabeçalho de 20260927_security_hardening.sql).
-- Depende de: 20261003_chat_bot.sql e 20261003_kb_seed.sql (já em produção). Pode ser aplicado antes ou depois do front:
-- o botão "Não vejo meu ingresso" do front usa o assunto de chat "Não recebi ou não acho meu ingresso" (20261001_chat.sql),
-- que já existe; o artigo só melhora a resposta do bot e da busca.
-- Desfazer: o admin edita ou despublica o artigo em /admin/conhecimento.
-- =============================================================================
begin;
set local lock_timeout = '5s';

with alvo as (
  update public.kb_articles
     set title = 'Onde vejo meus ingressos?',
         body = 'Entre na sua conta e abra "Meus Ingressos" no menu (no celular, o botão "Ingressos" da barra de baixo). A tela tem duas abas: "Próximos", com o passe do próximo evento e os que vêm depois, e "Anteriores", com os eventos que já passaram. Toque no passe para abrir o ingresso; o botão quadrado com o QR abre o QR Code direto. O Início do app mostra o mesmo passe do próximo evento.'
                 || E'\n\n' ||
                 'O ingresso só aparece depois que o pagamento é confirmado. Um pedido ainda não pago aparece em "Compras", como Pendente, e a tela de Ingressos explica que está aguardando pagamento.'
                 || E'\n\n' ||
                 'Se o pagamento aparece como confirmado e o ingresso não está lá, toque em "Não vejo meu ingresso", na tela de Ingressos ou no Início: o chat com a equipe abre já no assunto "Não recebi ou não acho meu ingresso". Dica para a porta do evento: no QR ampliado, o botão "Salvar QR como imagem" guarda o código na galeria do celular.'
                 || E'\n\n' ||
                 'Aviso: enquanto o pagamento online não estiver ativo, a venda está em modo de teste e os pedidos ficam pendentes, sem ingresso emitido.',
         keywords = 'meus ingressos, onde está meu ingresso, não acho meu ingresso, não vejo meu ingresso, ver ingresso, ingresso sumiu, ingresso não apareceu, bilhete, entrada, salvar qr, qr code na galeria',
         status = 'published',
         review_note = null,
         updated_at = now()
   where slug = 'lev-a10'
     and origin = 'seed'
     and status = 'draft'
     and updated_at = created_at
  returning 1
)
select case when exists (select 1 from alvo)
            then 'lev-a10 atualizado e publicado'
            else 'lev-a10 NÃO alterado (já editado no admin, já publicado, excluído ou ausente): confira em /admin/conhecimento' end as resultado;

commit;
