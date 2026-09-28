-- Compra real falhava ao gravar order_items: só existia policy de SELECT. A 1ª versão desta
-- migration também dava INSERT em tickets pro próprio cliente, mas só conferia dono do pedido
-- — sem checar status do pedido/ingresso nem se o ticket_type era do mesmo evento, o que abria
-- ingresso "active" de graça. Corrigido: cliente só grava order_items (de um pedido próprio,
-- pendente, com o tipo de ingresso do mesmo evento); a criação de tickets sai do cliente e fica
-- só para o webhook de pagamento (service_role), quando a Fase 4 publicar Stripe/Woovi.
create policy "Usuários inserem itens da própria compra"
on public.order_items for insert
to authenticated
with check (
  quantity > 0
  and exists (
    select 1 from public.orders o
    join public.ticket_types tt on tt.id = order_items.ticket_type_id and tt.event_id = o.event_id
    where o.id = order_items.order_id
      and o.user_id = auth.uid()
      and o.status = 'pending'
  )
);

-- orders já tinha policy de INSERT (auth.uid() = user_id), mas sem checar o status: o próprio
-- cliente podia gravar um pedido já 'paid' sem pagar nada. Substitui pela mesma policy + status.
drop policy if exists "Usuários criam próprias compras" on public.orders;
create policy "Usuários criam próprias compras"
on public.orders for insert
to authenticated
with check (auth.uid() = user_id and status = 'pending');

-- Trigger morto (formato de payload de Database Webhook que a função send-email não aceita mais
-- desde a v17 — todo disparo já falhava com 500) que carregava um JWT service_role na própria
-- definição, legível por qualquer role com SELECT em information_schema.triggers (anon e
-- authenticated tinham). A chave já foi invalidada em 27/09/2026 (chaves legadas desativadas,
-- segredo JWT antigo revogado — Segurança.md) — isto é limpeza, não mais uma exposição ativa.
drop trigger if exists send_order_emails on public.orders;

-- Limite de taxa no formulário de contato NÃO entra aqui: a 1ª tentativa (with_check comparando
-- a coluna com ela mesma) não filtrava nada, e a correção óbvia (policy de SELECT pro anon
-- contar as próprias mensagens) vira limite global do site inteiro e expõe a tabela. Rate limit
-- de canal público sem login pede IP, não e-mail (que quem ataca escolhe) — fica para uma Edge
-- Function dedicada, fora do escopo desta migration.
