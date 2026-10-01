-- =============================================================================
-- B3b: saldo do "Orçamento do evento" (event_budget_boxes / piggy_transactions) só pela função do banco
-- (01/10/2026, aprovado pelo Ricardo). Depende do B3 (docs/sql/20261005_produtor_acesso.sql) já aplicado.
--
-- Como aplicar: colar o arquivo inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA pelo TextEdit: erro 17).
-- Uma transação só: se a conferência do fim falhar, nada é gravado. Idempotente (pode rodar de novo).
-- Testes: supabase/tests/orcamento_saldo.test.sql (pgTAP; banco local, nunca em produção).
-- ATENÇÃO: reaplicar o B3 (20261005) recria caixinha_movimentar como SECURITY INVOKER; com os grants deste
-- arquivo ela passaria a falhar (42501) para o produtor. Depois de reaplicar o B3, reaplicar este arquivo.
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
-- =============================================================================
begin;

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
     or not has_table_privilege('authenticated', 'public.piggy_transactions', 'select') then
    raise exception 'piggy_transactions: privilégios fora do esperado (só SELECT para authenticated)';
  end if;
end $$;

commit;

-- Desfazer (volta ao estado do B3: produtor grava saved e piggy_transactions direto):
-- begin;
-- alter function public.caixinha_movimentar(uuid, text, numeric, text) security invoker;
-- grant update on public.event_budget_boxes to authenticated;
-- drop policy if exists gf_budget_boxes_insert_saldo_zero on public.event_budget_boxes;
-- grant insert, update, delete on public.piggy_transactions to authenticated;
-- commit;
