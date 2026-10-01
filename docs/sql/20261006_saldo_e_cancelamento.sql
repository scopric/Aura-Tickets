-- =============================================================================
-- B3b, duas partes (01/10/2026, aprovadas pelo Ricardo). Depende do B3 (docs/sql/20261005_produtor_acesso.sql).
--   Parte 1: saldo do "Orçamento do evento" (event_budget_boxes / piggy_transactions) só pela função do banco.
--   Parte 2 (Decisão 129, ampliada em 01/10/2026): evento com ingresso vendido não sai do ar pelo produtor
--   (cancelar, voltar a rascunho, encerrar antes da data) até existir reembolso (M12).
--
-- Como aplicar: colar o arquivo inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA pelo TextEdit: erro 17).
-- Uma transação só: se a conferência do fim falhar, nada é gravado. Idempotente (pode rodar de novo).
-- Testes: supabase/tests/orcamento_saldo.test.sql e supabase/tests/cancelar_evento.test.sql (pgTAP; banco
-- local, nunca em produção).
-- Ordem: o B3 (20261005) tem de estar aplicado antes (a guarda do início aborta se não estiver). Reaplicar o B3
-- depois deste arquivo é seguro: desde 01/10/2026 o B3 traz o mesmo corpo SECURITY DEFINER de
-- caixinha_movimentar (as duas cópias têm de ficar iguais) e não devolve os privilégios fechados aqui.
--
-- O que a tela faz hoje (main fbbe735, app/src/hooks/useProducerTools.ts e pages/producer/PiggyBank.tsx):
--   event_budget_boxes: SELECT *, INSERT (event_id, name, target, saved: 0, category, notes, producer_id) e
--   DELETE. Nenhum UPDATE. piggy_transactions: só SELECT. Movimento: rpc caixinha_movimentar.
--   Nenhuma tela do admin nem Edge Function lê ou grava estas tabelas (grep em app/src e supabase/functions).
--
-- DECISÕES
-- 1. caixinha_movimentar vira SECURITY DEFINER (search_path vazio): é o único caminho que grava saved e
--    piggy_transactions, então precisa de privilégio que o produtor não tem mais. Compensações: mesma
--    checagem explícita b.producer_id = auth.uid() com select ... for update, gf_mfa_ok() obrigatório,
--    mesma assinatura e mesmos códigos (22023, 23514, 42501). Como definer, a função não passa mais pela
--    regra gf_mfa_aal2 das tabelas; por isso a checagem de 2FA entra no corpo.
-- 2. gf_mfa_ok() não quebra o fluxo: devolve verdadeiro para conta SEM fator de 2FA confirmado e, para quem
--    tem, só com sessão aal2 (o login pede o código antes de abrir o painel). É exatamente o que a versão
--    INVOKER já exigia pela regra gf_mfa_aal2 das tabelas: antes, sem aal2, a linha sumia e vinha 42501
--    "Caixinha não encontrada"; agora vem 42501 "Confirme o código do 2FA". Mesmo código: a mensagem da
--    tela (lib/orcamento.ts, 42501) já cobre os dois casos.
-- 3. event_budget_boxes: sem UPDATE da tabela para a API; UPDATE só em name, target, category, notes,
--    event_id e updated_at (editar e renomear; a regra "Produtor gerencia budget boxes" continua exigindo
--    evento do produtor). saved e producer_id ficam fora. Vale também para o admin (gf_budget_boxes_all):
--    admin é authenticated como qualquer um, e nenhuma tela do admin grava saved; se precisar corrigir
--    saldo, é pelo SQL Editor (postgres) com o movimento correspondente.
-- 4. INSERT continua (a tela cria mandando saved: 0). Tirar saved do grant de INSERT quebraria a tela
--    (coluna enviada sem permissão = 42501); em vez disso, uma regra RESTRICTIVE só de INSERT exige
--    saved = 0. Restritiva porque soma (AND) com as permissivas do dono e do admin; só de INSERT para não
--    travar a edição de um item que já tem saldo.
-- 5. piggy_transactions: sem INSERT, UPDATE e DELETE para a API (só a função grava; apagar ou editar um
--    movimento deixaria o histórico diferente do saldo). SELECT continua (a tela lista os movimentos).
--    Apagar o item do orçamento continua funcionando: o ON DELETE CASCADE da FK roda com o privilégio do
--    dono da tabela, não do usuário (testado).
-- 6. anon perde INSERT/UPDATE/DELETE nas duas tabelas (já não passava por nenhuma regra; agora nem tem o
--    privilégio).
-- 7. (Decisão 129, ampliada) Gatilho gf_protect_event_cancel, BEFORE UPDATE OF status em events, com WHEN só
--    para as três saídas do ar. Para anon/authenticated que não é admin, havendo venda, recusa:
--      a) status passa a 'cancelled' (de qualquer status, inclusive de 'ended')         -> EV001
--      b) status passa a 'draft' vindo de 'published'                                   -> EV002
--      c) status passa a 'ended' com a data do evento ainda por vir                     -> EV002
--         ("data" = coalesce(end_date, start_date) da linha ANTIGA; start_date é NOT NULL. Usar a antiga impede
--         mudar a data e encerrar no mesmo update; mudar a data com venda já é barrado pela F0a.)
--    Encerrar depois da data continua permitido. Evento sem venda: tudo permitido.
--    "Vendido" = ingresso com status fora de ('cancelled', 'refunded'), inclusive 'transferred': o MESMO
--    critério da trava de data e local da F0a (gf_protect_event_moderation). A tela (useVendidosPorEvento)
--    conta só active/used; a diferença é a favor do bloqueio (o banco recusa e a tela mostra a mensagem).
--    Mesmo molde do gf_protect_event_moderation (F0a, "O que não pode quebrar" seção 17): SECURITY DEFINER,
--    search_path vazio, papel por current_setting('role') + claim role do JWT (NUNCA current_user, que numa
--    função definer é sempre o dono). Basta UM dos dois ser anon/authenticated para valer a trava: claim
--    service_role forjada numa sessão authenticated não passa (testado). service_role de verdade, postgres
--    (SQL Editor) e admin (gf_is_admin: fator confirmado + aal2) passam. Sem EXECUTE para a API.
--    Convivência com a F0a: os dois gatilhos são BEFORE e rodam em ordem alfabética (cancel antes de
--    moderation); o da F0a não olha status e este não altera a linha. A moderação do admin
--    (useModerateEvent: recusa/pausa grava 'draft' em evento 'published') passa porque é admin (testado).
--    Códigos (SQLSTATE próprios, fora das classes do Postgres; P0001 é o de qualquer "raise exception" sem
--    errcode e a tela confundiria): EV001 = cancelar ("Este evento tem ingressos vendidos. Para cancelar, fale
--    com o suporte da Evokaa."), EV002 = rascunho/encerrar antes ("Este evento tem ingressos vendidos e não
--    pode sair do ar. Fale com o suporte da Evokaa."). O PostgREST repassa o código em error.code (HTTP 400);
--    lib/eventoProdutor.ts (erroDeStatus) troca pela mensagem.
-- 8. Limites de texto: piggy_transactions.note <= 500 (e a função recusa antes, com 22023);
--    event_budget_boxes.name <= 120 e notes <= 1000. CHECK simples (valida as linhas existentes na hora):
--    as tabelas são pequenas, a validação é instantânea, e se alguma linha violar a transação inteira aborta
--    sem gravar nada (melhor que NOT VALID, que deixaria linha fora da regra). A tela limita os campos
--    (maxLength) com os mesmos números.
-- 9. Guarda no início: aborta se o B3 não estiver aplicado. lock_timeout de 5 s: se events ou as tabelas do
--    orçamento estiverem travadas por outra transação, falha rápido em vez de enfileirar a API atrás.
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 9. Guarda: o B3 (20261005_produtor_acesso.sql) tem de estar aplicado
do $$
begin
  if to_regprocedure('public.vincular_afiliado(text,uuid,numeric)') is null
     or exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'event_budget_boxes'
                and policyname = 'gf_budget_boxes_all' and coalesce(qual, '') like '%producer_id%') then
    raise exception 'Aplique antes docs/sql/20261005_produtor_acesso.sql (B3)';
  end if;
end $$;

-- 1 e 2. Função: SECURITY DEFINER com 2FA e dono conferidos no corpo
create or replace function public.caixinha_movimentar(p_box uuid, p_tipo text, p_valor numeric, p_nota text default null)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_saldo numeric;
  v_valor numeric := round(p_valor, 2);
begin
  if not public.gf_mfa_ok() then
    raise exception 'Confirme o código do 2FA' using errcode = '42501';
  end if;
  if p_tipo is null or p_tipo not in ('deposit', 'withdraw') then
    raise exception 'Tipo de movimento inválido' using errcode = '22023';
  end if;
  -- NaN é maior que tudo no Postgres; "not (... and ...)" recusa NaN, Infinity e nulo
  if v_valor is null or not (v_valor > 0 and v_valor < 1e9) then
    raise exception 'Valor inválido (entre 0,01 e 999.999.999,99)' using errcode = '22023';
  end if;
  if length(p_nota) > 500 then
    raise exception 'Observação com mais de 500 caracteres' using errcode = '22023';
  end if;
  -- trava a linha: outra movimentação da mesma caixinha espera esta terminar
  select coalesce(b.saved, 0) into v_saldo
    from public.event_budget_boxes b
   where b.id = p_box and b.producer_id = (select auth.uid())
     for update;
  if not found then
    raise exception 'Caixinha não encontrada' using errcode = '42501';
  end if;
  v_saldo := v_saldo + case when p_tipo = 'deposit' then v_valor else -v_valor end;
  if v_saldo < 0 then
    raise exception 'Saldo insuficiente' using errcode = '23514';
  end if;
  update public.event_budget_boxes set saved = v_saldo, updated_at = now() where id = p_box;
  insert into public.piggy_transactions (box_id, type, amount, note) values (p_box, p_tipo, v_valor, p_nota);
  return v_saldo;
end;
$$;
revoke all on function public.caixinha_movimentar(uuid, text, numeric, text) from public, anon;
grant execute on function public.caixinha_movimentar(uuid, text, numeric, text) to authenticated;

-- 3. event_budget_boxes: edição só nas colunas da tela; saved e producer_id fora
revoke update on public.event_budget_boxes from anon, authenticated;
revoke insert, delete on public.event_budget_boxes from anon;
grant update (name, target, category, notes, event_id, updated_at) on public.event_budget_boxes to authenticated;

-- 4. Item novo nasce com saldo zero
drop policy if exists gf_budget_boxes_insert_saldo_zero on public.event_budget_boxes;
create policy gf_budget_boxes_insert_saldo_zero on public.event_budget_boxes as restrictive for insert to authenticated
  with check (saved = 0);

-- 5 e 6. piggy_transactions: só leitura pela API
revoke insert, update, delete on public.piggy_transactions from anon, authenticated;

-- 8. Limites de texto
alter table public.piggy_transactions drop constraint if exists piggy_transactions_note_len;
alter table public.piggy_transactions add constraint piggy_transactions_note_len check (length(note) <= 500);
alter table public.event_budget_boxes drop constraint if exists event_budget_boxes_name_len;
alter table public.event_budget_boxes add constraint event_budget_boxes_name_len check (length(name) <= 120);
alter table public.event_budget_boxes drop constraint if exists event_budget_boxes_notes_len;
alter table public.event_budget_boxes add constraint event_budget_boxes_notes_len check (length(notes) <= 1000);

-- 7. (Decisão 129, ampliada) Evento com ingresso vendido não sai do ar pelo produtor
create or replace function public.gf_protect_event_cancel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not ((current_setting('role', true) in ('anon', 'authenticated')
           or coalesce(auth.jwt()->>'role', '') in ('anon', 'authenticated'))
          and not public.gf_is_admin()) then
    return new;
  end if;
  -- vendido: mesmo critério da trava de data e local da F0a (inclui 'transferred')
  if not exists (select 1 from public.tickets t
                 where t.event_id = old.id and coalesce(t.status, 'active') not in ('cancelled', 'refunded')) then
    return new;
  end if;
  if new.status = 'cancelled' then
    raise exception 'Este evento tem ingressos vendidos. Para cancelar, fale com o suporte da Evokaa.'
      using errcode = 'EV001';
  end if;
  if (new.status = 'draft' and old.status = 'published')
     or (new.status = 'ended' and coalesce(old.end_date, old.start_date) > now()) then
    raise exception 'Este evento tem ingressos vendidos e não pode sair do ar. Fale com o suporte da Evokaa.'
      using errcode = 'EV002';
  end if;
  return new;
end;
$$;
revoke execute on function public.gf_protect_event_cancel() from public, anon, authenticated;
drop trigger if exists gf_protect_event_cancel on public.events;
create trigger gf_protect_event_cancel
  before update of status on public.events
  for each row
  when (old.status is distinct from new.status and new.status in ('cancelled', 'draft', 'ended'))
  execute function public.gf_protect_event_cancel();

-- Conferência obrigatória: se algo faltar, nada deste arquivo é gravado.
do $$
declare
  c text;
begin
  if not exists (select 1 from pg_proc where oid = 'public.caixinha_movimentar(uuid, text, numeric, text)'::regprocedure
                 and prosecdef and proconfig @> array['search_path=""']) then
    raise exception 'caixinha_movimentar não é SECURITY DEFINER com search_path vazio';
  end if;
  if position('gf_mfa_ok' in pg_get_functiondef('public.caixinha_movimentar(uuid, text, numeric, text)'::regprocedure)) = 0
     or position('auth.uid()' in pg_get_functiondef('public.caixinha_movimentar(uuid, text, numeric, text)'::regprocedure)) = 0 then
    raise exception 'caixinha_movimentar sem checagem de 2FA ou de dono';
  end if;
  if has_function_privilege('anon', 'public.caixinha_movimentar(uuid, text, numeric, text)', 'execute')
     or not has_function_privilege('authenticated', 'public.caixinha_movimentar(uuid, text, numeric, text)', 'execute') then
    raise exception 'caixinha_movimentar: anon executa ou authenticated não executa';
  end if;
  foreach c in array array['saved', 'producer_id', 'id', 'created_at'] loop
    if has_column_privilege('authenticated', 'public.event_budget_boxes', c, 'update')
       or has_column_privilege('anon', 'public.event_budget_boxes', c, 'update') then
      raise exception 'event_budget_boxes.%: UPDATE aberto para a API', c;
    end if;
  end loop;
  foreach c in array array['name', 'target', 'category', 'notes', 'event_id'] loop
    if not has_column_privilege('authenticated', 'public.event_budget_boxes', c, 'update') then
      raise exception 'event_budget_boxes.%: a tela perdeu o UPDATE', c;
    end if;
  end loop;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'event_budget_boxes'
                 and policyname = 'gf_budget_boxes_insert_saldo_zero' and permissive = 'RESTRICTIVE' and cmd = 'INSERT') then
    raise exception 'event_budget_boxes sem a regra de saldo zero na criação';
  end if;
  if has_table_privilege('authenticated', 'public.piggy_transactions', 'insert')
     or has_table_privilege('authenticated', 'public.piggy_transactions', 'update')
     or has_table_privilege('authenticated', 'public.piggy_transactions', 'delete')
     or has_table_privilege('anon', 'public.piggy_transactions', 'insert')
     or has_table_privilege('anon', 'public.piggy_transactions', 'update')
     or has_table_privilege('anon', 'public.piggy_transactions', 'delete')
     or has_table_privilege('anon', 'public.event_budget_boxes', 'insert')
     or has_table_privilege('anon', 'public.event_budget_boxes', 'update')
     or has_table_privilege('anon', 'public.event_budget_boxes', 'delete')
     or not has_table_privilege('authenticated', 'public.piggy_transactions', 'select') then
    raise exception 'piggy_transactions/event_budget_boxes: privilégios fora do esperado';
  end if;
  -- gatilho ligado, só em UPDATE OF status (tgattr com a coluna) e com WHEN (tgqual)
  if not exists (select 1 from pg_trigger where tgrelid = 'public.events'::regclass and tgname = 'gf_protect_event_cancel'
                 and tgenabled = 'O' and tgqual is not null
                 -- int2vector começa no índice 0: comparar como texto ("24"), não como int2[]
                 and tgattr::text = (select attnum::text from pg_attribute
                                     where attrelid = 'public.events'::regclass and attname = 'status'))
     or not exists (select 1 from pg_trigger where tgrelid = 'public.events'::regclass
                    and tgname = 'gf_protect_event_moderation' and tgenabled = 'O') then
    raise exception 'events: falta o gatilho de cancelamento (Decisão 129) ou o de moderação (F0a)';
  end if;
  if not exists (select 1 from pg_proc where oid = 'public.gf_protect_event_cancel()'::regprocedure
                 and prosecdef and proconfig @> array['search_path=""'])
     or has_function_privilege('authenticated', 'public.gf_protect_event_cancel()', 'execute')
     or has_function_privilege('anon', 'public.gf_protect_event_cancel()', 'execute') then
    raise exception 'gf_protect_event_cancel: precisa ser SECURITY DEFINER, search_path vazio e sem EXECUTE para a API';
  end if;
  if exists (select 1 from pg_proc where oid in ('public.caixinha_movimentar(uuid, text, numeric, text)'::regprocedure,
                                                 'public.gf_protect_event_cancel()'::regprocedure)
             and proowner <> 'postgres'::regrole) then
    raise exception 'funções do B3b têm de pertencer ao postgres';
  end if;
  if (select count(*) from pg_constraint where conname in ('piggy_transactions_note_len', 'event_budget_boxes_name_len',
                                                           'event_budget_boxes_notes_len') and convalidated) <> 3 then
    raise exception 'faltam os limites de texto';
  end if;
end $$;

commit;

-- Desfazer (volta ao estado do B3: produtor grava saved e piggy_transactions direto e tira do ar evento com venda;
-- a função continua DEFINER, porque o B3 traz o mesmo corpo):
-- begin;
-- grant update on public.event_budget_boxes to authenticated;
-- drop policy if exists gf_budget_boxes_insert_saldo_zero on public.event_budget_boxes;
-- grant insert, update, delete on public.piggy_transactions to authenticated;
-- alter table public.piggy_transactions drop constraint if exists piggy_transactions_note_len;
-- alter table public.event_budget_boxes drop constraint if exists event_budget_boxes_name_len;
-- alter table public.event_budget_boxes drop constraint if exists event_budget_boxes_notes_len;
-- drop trigger if exists gf_protect_event_cancel on public.events;
-- drop function if exists public.gf_protect_event_cancel();
-- commit;
