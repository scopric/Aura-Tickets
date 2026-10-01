-- =============================================================================
-- B3 da área do produtor: regras de acesso "só o dono", afiliado seguro e caixinha atômica (01/10/2026).
-- Plano: Obsidian "Claude/Planos/polished-dreaming-plum.md", seção B3.
--
-- Como aplicar: colar o arquivo inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA pelo TextEdit: erro 17).
-- É uma transação só: se a conferência do fim falhar, nada é gravado. Idempotente (pode rodar de novo).
-- Testes: supabase/tests/produtor_acesso.test.sql (pgTAP; banco local, nunca em produção).
--
-- Estado da produção conferido em 01/10/2026 (só leitura):
--   crm_leads, crm_interactions, pipeline_stages, menu_items, affiliates e issued_certificates tinham SÓ a
--   gf_mfa_aal2 (RESTRICTIVE): nenhuma regra permissiva, ou seja, ninguém da API lia nem gravava nada nelas.
--   coupons e event_budget_boxes deixavam o produtor prender a linha ao evento de OUTRO produtor (o
--   with check só olhava producer_id). certificates e seating_maps: 0 event_id duplicados.
--   producer_profiles: 1 linha com cnpj = ''. affiliates: 0 linhas. pipeline_stages: 12 linhas.
--
-- DECISÕES
-- 1. Toda regra nova é "to authenticated", usa (select auth.uid()) (avaliado uma vez por consulta) e tem
--    using + with check. A gf_mfa_aal2 RESTRICTIVE de cada tabela fica intacta: sem 2FA, nada passa.
-- 2. Nomes de regra só em ASCII (erro 17: acento corrompido na colagem deixa a regra antiga no ar).
-- 3. "Evento do produtor" é conferido com exists em events; quem lê events ali é o próprio usuário (a regra
--    "Produtor gerencia eventos" deixa o dono ler os seus). Nenhuma regra de events lê estas tabelas: sem
--    recursão (42P17).
-- 4. crm_leads: além do dono, o with check exige que stage_id seja nulo ou etapa do próprio produtor (sem isso
--    um produtor prende o lead à etapa de outro e trava a exclusão dela pela FK).
-- 5. event_budget_boxes tinha DUAS regras permissivas para o dono ("Produtor gerencia budget boxes" e
--    gf_budget_boxes_all = dono OU admin). Permissivas somam (OR): consertar só uma deixava a brecha aberta pela
--    outra. A gf_budget_boxes_all vira gf_budget_boxes_admin (só admin); a do dono ganha a checagem do evento.
-- 6. coupons: só a regra do produtor muda (a do admin exige producer_id nulo e a do afiliado é só leitura).
-- 7. affiliates: o produtor NÃO grava direto. Inserir só pela vincular_afiliado (senão a trava de 18 anos e o
--    limite de chamadas viram enfeite: bastaria um insert pela API). UPDATE só nas colunas commission_percent e
--    status (grant por coluna): sales e total_earned são dinheiro do afiliado e não podem ser editados pelo
--    produtor pela API. CHECK de comissão entre 0,01 e 100 (0 linhas hoje) vale também para o update.
--    Índice único (affiliate_user_id, event_id): "já vinculado" sem corrida entre duas chamadas.
--    Hoje a tela de Afiliados grava direto e já não funciona (a tabela não tinha regra): nada piora; a tela
--    passa a usar as funções no B4.
-- 8. caixinha_movimentar é SECURITY INVOKER: roda com as regras de acesso de quem chama (2FA e dono pelas
--    regras), mais a checagem explícita producer_id = auth.uid(). O select ... for update trava a linha da
--    caixinha até o fim da transação: duas operações ao mesmo tempo esperam uma pela outra, sem sobrescrever.
--    ponytail: a gravação direta em event_budget_boxes.saved e piggy_transactions continua aberta para o
--    dono (a tela atual usa); fechar depois que o B4 passar a tela para a função.
-- 9. vincular_afiliado é SECURITY DEFINER porque precisa achar a pessoa pelo e-mail em auth.users e ler a data
--    de nascimento em profiles, que a regra de profiles esconde de outros usuários. Compensações: search_path
--    vazio, gf_mfa_ok() obrigatório, dono do evento conferido no corpo, e devolve só um código (nunca id/nome).
--    E-mail: procura em auth.users (o e-mail do login, confirmado). profiles.email não serve: o próprio usuário
--    pode editá-lo e se passar por outra pessoa.
-- 10. Enumeração (descobrir quem tem conta): "ok" revela que a conta existe, e isso é inevitável (o vínculo é
--    criado e aparece para o afiliado, deixando rastro). Para não criar um segundo oráculo sem rastro, conta
--    inexistente, e-mail não confirmado, menor de 18 e conta sem data de nascimento devolvem o MESMO código
--    'nao_encontrado' (a tela explica: "precisa ter conta na Evokaa, ser maior de 18 anos e ter a data de
--    nascimento no perfil"). Assim ninguém descobre pela API que um e-mail é de um menor de idade.
--    'ja_vinculado' e 'proprio' só revelam o que o produtor já sabe. Não há código 'menor' separado.
-- 11. Limite: 20 chamadas por produtor por hora, contadas numa tabela pequena (afiliado_tentativas), com RLS
--    ligada, sem regra permissiva e sem grant para a API. Contar vínculos criados em affiliates seria mais
--    curto, mas burlável: vincula, apaga, vincula de novo. A tabela conta toda tentativa que chega à busca.
-- 12. Idade: "18 anos" pela data de hoje do servidor (UTC). No dia do aniversário, entre 21h e 0h de Brasília,
--    ainda conta como 17. Aceito.
-- 13. listar_afiliados é SECURITY DEFINER para devolver primeiro nome e e-mail mascarado (jo***@gmail.com) que
--    a regra de profiles esconde; filtra por producer_id = auth.uid() e gf_mfa_ok() (como a
--    affiliate_my_producers). O produtor ainda lê affiliate_user_id na tabela (uuid, sem nome nem e-mail).
-- 14. Etapas do CRM: nada é criado ao abrir a tela. crm_criar_etapas_padrao() (botão) cria 5 etapas só se o
--    produtor não tiver nenhuma; trava por produtor (pg_advisory_xact_lock) para dois cliques não criarem 10.
-- 15. Funções: revoke de public e anon, grant só a authenticated.
-- =============================================================================
begin;

-- 1. "Só o dono" nas tabelas que só tinham a regra de 2FA ------------------------------------------------------

-- crm_leads (DECISÕES 4)
drop policy if exists gf_crm_leads_dono on public.crm_leads;
create policy gf_crm_leads_dono on public.crm_leads as permissive for all to authenticated
  using (producer_id = (select auth.uid()))
  with check (producer_id = (select auth.uid())
              and (stage_id is null or exists (select 1 from public.pipeline_stages s
                                               where s.id = stage_id and s.producer_id = (select auth.uid()))));

-- crm_interactions: pelo lead do produtor
drop policy if exists gf_crm_interactions_dono on public.crm_interactions;
create policy gf_crm_interactions_dono on public.crm_interactions as permissive for all to authenticated
  using (exists (select 1 from public.crm_leads l where l.id = lead_id and l.producer_id = (select auth.uid())))
  with check (exists (select 1 from public.crm_leads l where l.id = lead_id and l.producer_id = (select auth.uid())));

-- pipeline_stages
drop policy if exists gf_pipeline_stages_dono on public.pipeline_stages;
create policy gf_pipeline_stages_dono on public.pipeline_stages as permissive for all to authenticated
  using (producer_id = (select auth.uid()))
  with check (producer_id = (select auth.uid()));

-- menu_items: dono; e o evento, se houver, também é dele
drop policy if exists gf_menu_items_dono on public.menu_items;
create policy gf_menu_items_dono on public.menu_items as permissive for all to authenticated
  using (producer_id = (select auth.uid()))
  with check (producer_id = (select auth.uid())
              and (event_id is null or exists (select 1 from public.events e
                                               where e.id = event_id and e.producer_id = (select auth.uid()))));

-- affiliates (DECISÕES 7): dono lê, altera (só comissão e status) e apaga; afiliado só lê a própria linha
drop policy if exists gf_affiliates_dono_select on public.affiliates;
drop policy if exists gf_affiliates_dono_update on public.affiliates;
drop policy if exists gf_affiliates_dono_delete on public.affiliates;
drop policy if exists gf_affiliates_afiliado_select on public.affiliates;
create policy gf_affiliates_dono_select on public.affiliates as permissive for select to authenticated
  using (producer_id = (select auth.uid()));
create policy gf_affiliates_dono_update on public.affiliates as permissive for update to authenticated
  using (producer_id = (select auth.uid()))
  with check (producer_id = (select auth.uid()));
create policy gf_affiliates_dono_delete on public.affiliates as permissive for delete to authenticated
  using (producer_id = (select auth.uid()));
create policy gf_affiliates_afiliado_select on public.affiliates as permissive for select to authenticated
  using (affiliate_user_id = (select auth.uid()));
revoke insert, update on public.affiliates from anon, authenticated;
grant update (commission_percent, status) on public.affiliates to authenticated;
alter table public.affiliates drop constraint if exists affiliates_commission_percent_check;
alter table public.affiliates add constraint affiliates_commission_percent_check
  check (commission_percent >= 0.01 and commission_percent <= 100);
create unique index if not exists affiliates_afiliado_evento_key on public.affiliates (affiliate_user_id, event_id);

-- issued_certificates: o produtor dono do evento do certificado gerencia; o participante lê o próprio
drop policy if exists gf_issued_certificates_produtor on public.issued_certificates;
drop policy if exists gf_issued_certificates_participante on public.issued_certificates;
create policy gf_issued_certificates_produtor on public.issued_certificates as permissive for all to authenticated
  using (exists (select 1 from public.certificates c join public.events e on e.id = c.event_id
                 where c.id = certificate_id and e.producer_id = (select auth.uid())))
  with check (exists (select 1 from public.certificates c join public.events e on e.id = c.event_id
                      where c.id = certificate_id and e.producer_id = (select auth.uid())));
create policy gf_issued_certificates_participante on public.issued_certificates as permissive for select to authenticated
  using (user_id = (select auth.uid()));

-- 2. coupons e event_budget_boxes: o evento tem de ser do produtor ------------------------------------------------
drop policy if exists "Produtor gerencia coupons" on public.coupons;
create policy "Produtor gerencia coupons" on public.coupons as permissive for all to authenticated
  using (producer_id = (select auth.uid()))
  with check (producer_id = (select auth.uid())
              and (event_id is null or exists (select 1 from public.events e
                                               where e.id = event_id and e.producer_id = (select auth.uid()))));

-- DECISÕES 5
drop policy if exists "Produtor gerencia budget boxes" on public.event_budget_boxes;
drop policy if exists gf_budget_boxes_all on public.event_budget_boxes;
drop policy if exists gf_budget_boxes_admin on public.event_budget_boxes;
create policy "Produtor gerencia budget boxes" on public.event_budget_boxes as permissive for all to authenticated
  using (producer_id = (select auth.uid()))
  with check (producer_id = (select auth.uid())
              and (event_id is null or exists (select 1 from public.events e
                                               where e.id = event_id and e.producer_id = (select auth.uid()))));
create policy gf_budget_boxes_admin on public.event_budget_boxes as permissive for all to authenticated
  using ((select public.gf_is_admin()))
  with check ((select public.gf_is_admin()));

-- 3. Caixinha: movimento atômico (DECISÕES 8) ----------------------------------------------------------------------
create or replace function public.caixinha_movimentar(p_box uuid, p_tipo text, p_valor numeric, p_nota text default null)
returns numeric
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_saldo numeric;
begin
  if p_tipo is null or p_tipo not in ('deposit', 'withdraw') then
    raise exception 'Tipo de movimento inválido' using errcode = '22023';
  end if;
  if p_valor is null or p_valor <= 0 then
    raise exception 'O valor precisa ser maior que zero' using errcode = '22023';
  end if;
  -- trava a linha: outra movimentação da mesma caixinha espera esta terminar
  select coalesce(b.saved, 0) into v_saldo
    from public.event_budget_boxes b
   where b.id = p_box and b.producer_id = (select auth.uid())
     for update;
  if not found then
    raise exception 'Caixinha não encontrada' using errcode = '42501';
  end if;
  v_saldo := v_saldo + case when p_tipo = 'deposit' then p_valor else -p_valor end;
  if v_saldo < 0 then
    raise exception 'Saldo insuficiente' using errcode = '23514';
  end if;
  update public.event_budget_boxes set saved = v_saldo, updated_at = now() where id = p_box;
  insert into public.piggy_transactions (box_id, type, amount, note) values (p_box, p_tipo, p_valor, p_nota);
  return v_saldo;
end;
$$;

-- 4. Um certificado e um mapa de lugares por evento (0 duplicados em 01/10/2026) -----------------------------------
create unique index if not exists certificates_event_id_key on public.certificates (event_id);
create unique index if not exists seating_maps_event_id_key on public.seating_maps (event_id);

-- 5. CNPJ opcional: '' vira null (a UNIQUE continua; nulos não colidem) -------------------------------------------
alter table public.producer_profiles alter column cnpj drop not null;
update public.producer_profiles set cnpj = null where btrim(cnpj) = '';

-- 6. Afiliado de evento (DECISÕES 9 a 13) --------------------------------------------------------------------------
create table if not exists public.afiliado_tentativas (
  id bigint generated always as identity primary key,
  producer_id uuid not null references public.profiles (id) on delete cascade,
  criado_em timestamptz not null default now()
);
create index if not exists afiliado_tentativas_producer_idx on public.afiliado_tentativas (producer_id, criado_em);
alter table public.afiliado_tentativas enable row level security;
revoke all on public.afiliado_tentativas from anon, authenticated;

create or replace function public.vincular_afiliado(p_email text, p_evento uuid, p_comissao numeric)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_alvo uuid;
  v_nasc date;
begin
  if not public.gf_mfa_ok() then
    raise exception 'Confirme o código do 2FA' using errcode = '42501';
  end if;
  if v_uid is null
     or not exists (select 1 from public.profiles where id = v_uid and role = 'producer')
     or not exists (select 1 from public.events where id = p_evento and producer_id = v_uid) then
    return 'sem_permissao';
  end if;
  if p_comissao is null or p_comissao < 0.01 or p_comissao > 100 then
    return 'comissao_invalida';
  end if;

  -- limite: 20 tentativas por produtor por hora (DECISÕES 11); a trava serializa as chamadas do mesmo produtor
  perform pg_advisory_xact_lock(hashtextextended('vincular_afiliado:' || v_uid::text, 0));
  delete from public.afiliado_tentativas where producer_id = v_uid and criado_em < now() - interval '1 hour';
  if (select count(*) from public.afiliado_tentativas where producer_id = v_uid) >= 20 then
    return 'limite';
  end if;
  insert into public.afiliado_tentativas (producer_id) values (v_uid);

  select u.id, p.birth_date into v_alvo, v_nasc
    from auth.users u
    join public.profiles p on p.id = u.id
   where lower(u.email) = lower(btrim(p_email))
     and u.email_confirmed_at is not null
     and u.deleted_at is null
     and not u.is_anonymous
   limit 1;
  if v_alvo = v_uid then
    return 'proprio';
  end if;
  -- mesma resposta para "não existe" e "existe mas não pode" (DECISÕES 10)
  if v_alvo is null or v_nasc is null or v_nasc > (current_date - interval '18 years')::date then
    return 'nao_encontrado';
  end if;

  insert into public.affiliates (producer_id, event_id, affiliate_user_id, commission_percent)
  values (v_uid, p_evento, v_alvo, round(p_comissao, 2))
  on conflict (affiliate_user_id, event_id) do nothing;
  if not found then
    return 'ja_vinculado';
  end if;
  return 'ok';
end;
$$;

create or replace function public.listar_afiliados()
returns table (id uuid, primeiro_nome text, email_mascarado text, commission_percent numeric, status text,
               event_id uuid, evento text, sales integer, total_earned numeric, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id,
         nullif(split_part(btrim(coalesce(p.full_name, '')), ' ', 1), ''),
         left(split_part(u.email, '@', 1), case when length(split_part(u.email, '@', 1)) > 2 then 2 else 1 end)
           || '***@' || split_part(u.email, '@', 2),
         a.commission_percent, a.status, a.event_id, e.title, a.sales, a.total_earned, a.created_at
    from public.affiliates a
    join public.profiles p on p.id = a.affiliate_user_id
    join auth.users u on u.id = a.affiliate_user_id
    left join public.events e on e.id = a.event_id
   where a.producer_id = (select auth.uid()) and public.gf_mfa_ok()
   order by a.created_at desc;
$$;

-- 7. Etapas padrão do CRM, por botão (DECISÕES 14) -----------------------------------------------------------------
create or replace function public.crm_criar_etapas_padrao()
returns setof public.pipeline_stages
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Faça login' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('crm_etapas:' || v_uid::text, 0));
  if not exists (select 1 from public.pipeline_stages where producer_id = v_uid) then
    insert into public.pipeline_stages (producer_id, name, color, position) values
      (v_uid, 'Novo', '#3b82f6', 0),
      (v_uid, 'Contato feito', '#8b5cf6', 1),
      (v_uid, 'Interessado', '#f59e0b', 2),
      (v_uid, 'Negociando', '#f97316', 3),
      (v_uid, 'Fechado', '#22c55e', 4);
  end if;
  return query select * from public.pipeline_stages where producer_id = v_uid order by position, created_at;
end;
$$;

-- 8. Permissões das funções (DECISÕES 15) --------------------------------------------------------------------------
revoke all on function public.caixinha_movimentar(uuid, text, numeric, text) from public, anon;
revoke all on function public.vincular_afiliado(text, uuid, numeric) from public, anon;
revoke all on function public.listar_afiliados() from public, anon;
revoke all on function public.crm_criar_etapas_padrao() from public, anon;
grant execute on function public.caixinha_movimentar(uuid, text, numeric, text) to authenticated;
grant execute on function public.vincular_afiliado(text, uuid, numeric) to authenticated;
grant execute on function public.listar_afiliados() to authenticated;
grant execute on function public.crm_criar_etapas_padrao() to authenticated;

-- Conferência obrigatória: se algo faltar, nada deste arquivo é gravado.
do $$
declare
  t text;
  f text;
begin
  foreach t in array array['crm_leads', 'crm_interactions', 'pipeline_stages', 'menu_items', 'affiliates',
                           'issued_certificates', 'coupons', 'event_budget_boxes', 'afiliado_tentativas'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t
                   and policyname = 'gf_mfa_aal2' and permissive = 'RESTRICTIVE') then
      raise exception '% sem a regra gf_mfa_aal2', t;
    end if;
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then
      raise exception '% sem RLS', t;
    end if;
  end loop;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'afiliado_tentativas'
             and permissive = 'PERMISSIVE') then
    raise exception 'afiliado_tentativas tem regra permissiva';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public'
             and tablename in ('coupons', 'event_budget_boxes') and permissive = 'PERMISSIVE'
             and (coalesce(qual, '') || coalesce(with_check, '')) like '%producer_id%'
             and (coalesce(qual, '') || coalesce(with_check, '')) not like '%gf_is_admin%'
             and coalesce(with_check, qual) not like '%events e%') then
    raise exception 'coupons/event_budget_boxes: sobrou regra do produtor sem checar o evento';
  end if;
  if exists (select 1 from pg_policies where policyname like '%' || chr(8730) || '%') then
    raise exception 'regra com nome corrompido (erro 17)';
  end if;
  if has_table_privilege('authenticated', 'public.affiliates', 'insert')
     or has_column_privilege('authenticated', 'public.affiliates', 'total_earned', 'update')
     or has_table_privilege('authenticated', 'public.afiliado_tentativas', 'select') then
    raise exception 'affiliates/afiliado_tentativas: privilégio a mais para authenticated';
  end if;
  if (select attnotnull from pg_attribute where attrelid = 'public.producer_profiles'::regclass and attname = 'cnpj')
     or exists (select 1 from public.producer_profiles where btrim(cnpj) = '') then
    raise exception 'producer_profiles.cnpj ainda obrigatório ou com vazio';
  end if;
  foreach f in array array['public.caixinha_movimentar(uuid, text, numeric, text)',
                           'public.vincular_afiliado(text, uuid, numeric)',
                           'public.listar_afiliados()', 'public.crm_criar_etapas_padrao()'] loop
    if has_function_privilege('anon', f, 'execute') or not has_function_privilege('authenticated', f, 'execute') then
      raise exception '%: anon executa ou authenticated não executa', f;
    end if;
  end loop;
end $$;

commit;

-- Desfazer (as regras antigas de coupons/event_budget_boxes voltam com a brecha do evento):
-- begin;
-- drop policy if exists gf_crm_leads_dono on public.crm_leads;
-- drop policy if exists gf_crm_interactions_dono on public.crm_interactions;
-- drop policy if exists gf_pipeline_stages_dono on public.pipeline_stages;
-- drop policy if exists gf_menu_items_dono on public.menu_items;
-- drop policy if exists gf_affiliates_dono_select on public.affiliates;
-- drop policy if exists gf_affiliates_dono_update on public.affiliates;
-- drop policy if exists gf_affiliates_dono_delete on public.affiliates;
-- drop policy if exists gf_affiliates_afiliado_select on public.affiliates;
-- grant insert, update on public.affiliates to authenticated;
-- alter table public.affiliates drop constraint if exists affiliates_commission_percent_check;
-- drop index if exists public.affiliates_afiliado_evento_key;
-- drop policy if exists gf_issued_certificates_produtor on public.issued_certificates;
-- drop policy if exists gf_issued_certificates_participante on public.issued_certificates;
-- drop policy if exists "Produtor gerencia coupons" on public.coupons;
-- create policy "Produtor gerencia coupons" on public.coupons for all to authenticated
--   using (producer_id = auth.uid()) with check (producer_id = auth.uid());
-- drop policy if exists "Produtor gerencia budget boxes" on public.event_budget_boxes;
-- drop policy if exists gf_budget_boxes_admin on public.event_budget_boxes;
-- create policy "Produtor gerencia budget boxes" on public.event_budget_boxes for all to authenticated
--   using (producer_id = auth.uid()) with check (producer_id = auth.uid());
-- create policy gf_budget_boxes_all on public.event_budget_boxes for all to authenticated
--   using ((producer_id = auth.uid()) or public.gf_is_admin()) with check ((producer_id = auth.uid()) or public.gf_is_admin());
-- drop index if exists public.certificates_event_id_key;
-- drop index if exists public.seating_maps_event_id_key;
-- drop function if exists public.caixinha_movimentar(uuid, text, numeric, text);
-- drop function if exists public.vincular_afiliado(text, uuid, numeric);
-- drop function if exists public.listar_afiliados();
-- drop function if exists public.crm_criar_etapas_padrao();
-- drop table if exists public.afiliado_tentativas;
-- (cnpj: a volta do NOT NULL exige preencher os nulos antes; não desfazer sem decidir o valor)
-- commit;
