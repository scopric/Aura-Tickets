-- =============================================================================
-- Quadro, fatia 2B: notificações, confirmação de leitura e local (09/10/2026). O cartão passa a avisar no sino
-- (public.notifications) quem foi atribuído, mencionado, recebeu comentário, teve cartão movido ou tem prazo chegando, e os
-- recibos de entrega/leitura e o "visto por" passam a ser gravados só por funções, respeitando a opção do dono do quadro.
-- Só banco: a tela vem depois. Nada aqui mexe em orders, coupons, ticket_types nem pagamentos.
-- 1) task_notification_prefs: preferências de cada pessoa (geral, som, e por tipo: app e e-mail). Cada um lê e grava só a sua.
-- 2) task_boards.show_receipts (padrão ligado): só o DONO do quadro altera. Desligado = nenhum recibo nem "visto por" é
--    gravado e os já gravados deixam de ser visíveis (LGPD). Nada é apagado.
-- 3) quadro_notificar(): única porta que grava aviso do quadro em notifications (interna: ninguém de fora a chama).
--    Tipos: atribuicao, mencao, mensagem, prazo, movido, automacao. Gatilhos AFTER chamam a função para atribuição (task_card_members),
--    menção e mensagem (task_comments) e cartão movido (producer_tasks). Falha de aviso NUNCA impede a operação principal.
-- 4) Prazos: task_prazo_avisos (para não repetir) e quadro_avisar_prazos(), agendada no pg_cron a cada 30 minutos
--    com o nome 'quadro_prazos'.
-- 5) Leitura: quadro_marcar_entregue() e quadro_marcar_lido(). A 2A deixava a pessoa gravar o próprio recibo e o "visto por"
--    direto na tabela; agora INSERT e UPDATE de authenticated em task_comment_receipts e task_card_views estão revogados e a
--    porta é só a função. As políticas de leitura dessas duas tabelas passam a respeitar show_receipts.
-- 6) Local: nada a fazer no banco. producer_tasks.location (texto, latitude e longitude) já existe desde a 2A.
-- 7) Segurança: RLS ligada em toda tabela nova, gf_mfa_aal2 (2FA) restritiva em task_notification_prefs, anon sem nenhum
--    privilégio. LGPD: nenhuma coluna de IP; o aparelho é só uma categoria (computador, celular, tablet, outro).
--
-- Pré-requisito: a fatia 2A aplicada (20261105_quadro_f2a_cartao.sql). O bloco 0 aborta com mensagem clara se faltar.
-- Como aplicar: colar o arquivo inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA pelo TextEdit: erro 17). Fora do horário
-- de pico (set local lock_timeout faz desistir sem gravar nada se algo segurar a tabela; rodar de novo). Uma transação só:
-- se a conferência do fim falhar, nada é gravado. Idempotente. Sem pg_cron (banco local) o agendamento é pulado com aviso.
-- O front atual não usa nada disto: aplicar antes ou depois do merge. NÃO mover para supabase/migrations/ (motivo no
-- cabeçalho de 20260927_security_hardening.sql).
-- Teste: supabase/tests/quadro_f2b.test.sql (pgTAP; banco local, nunca em produção). Os testes de supabase/tests/quadro_f2a.test.sql
-- que gravavam recibo e "visto por" direto foram ajustados para esta fatia; equipe_quadro_f01.test.sql ganhou a regra nova de task_boards.
-- ATENÇÃO: reaplicar a 20261105 (2A) DEPOIS desta devolve as políticas e permissões antigas de recibos e "visto por"
--   (a 2A refaz esses grants e políticas). Rodar este arquivo de novo (é idempotente) restabelece. Reaplicar a 20261103 (fatia 1)
--   aborta na conferência de regras de task_boards (agora há uma a mais) e refaz os grants de task_boards: não reaplicar.
-- Desfazer (só depois de voltar o front; ordem importa: agendamento, gatilhos, regras que usam show_receipts, tabelas, coluna, e só
--   no fim as funções). O Desfazer só roda com o papel dono das tabelas (supabase_admin no banco local; no editor do Supabase é o
--   papel padrão). Ensaiado em begin/rollback no banco local. Os avisos já gravados em notifications ficam.
--   select cron.unschedule('quadro_prazos') where exists (select 1 from cron.job where jobname = 'quadro_prazos');  -- só se houver pg_cron
--   drop trigger if exists task_card_members_notif on public.task_card_members;
--   drop trigger if exists task_comments_notif on public.task_comments;
--   drop trigger if exists producer_tasks_quadro_notif on public.producer_tasks;
--   drop policy if exists task_boards_recibos on public.task_boards;
--   revoke update (show_receipts) on table public.task_boards from authenticated;
--   drop policy if exists task_comment_receipts_ver on public.task_comment_receipts;
--   create policy task_comment_receipts_ver on public.task_comment_receipts as permissive for select to authenticated
--     using (public.comment_pode(comment_id, 'ver'));
--   create policy task_comment_receipts_criar on public.task_comment_receipts as permissive for insert to authenticated
--     with check (user_id = (select auth.uid()) and public.comment_pode(comment_id, 'ver'));
--   create policy task_comment_receipts_editar on public.task_comment_receipts as permissive for update to authenticated
--     using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.comment_pode(comment_id, 'ver'));
--   drop policy if exists task_card_views_ver on public.task_card_views;
--   create policy task_card_views_ver on public.task_card_views as permissive for select to authenticated
--     using (public.task_pode(task_id, 'ver'));
--   create policy task_card_views_criar on public.task_card_views as permissive for insert to authenticated
--     with check (user_id = (select auth.uid()) and public.task_pode(task_id, 'ver'));
--   create policy task_card_views_editar on public.task_card_views as permissive for update to authenticated
--     using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.task_pode(task_id, 'ver'));
--   grant insert (comment_id, user_id, read_at, device) on table public.task_comment_receipts to authenticated;
--   grant update (read_at, device) on table public.task_comment_receipts to authenticated;
--   grant insert (task_id, user_id, device) on table public.task_card_views to authenticated;
--   grant update (device) on table public.task_card_views to authenticated;
--   drop index if exists public.notifications_quadro_actor_idx;
--   drop table if exists public.task_prazo_avisos, public.task_notification_prefs;
--   alter table public.task_boards drop column if exists show_receipts;
--   drop function if exists public.quadro_avisar_prazos(), public.quadro_notificar(uuid, uuid, text, text, uuid),
--     public.quadro_marcar_entregue(uuid[], text), public.quadro_marcar_lido(uuid, text), public.task_recibos_ligados(uuid),
--     public.quadro_prefs_ok(jsonb), public.task_card_members_notif_tg(), public.task_comments_notif_tg(),
--     public.producer_tasks_notif_tg();
--
-- DECISÕES
-- 1. Quem escreve em notifications: só quadro_notificar() (SECURITY DEFINER, search_path vazio, sem EXECUTE para ninguém de fora:
--    gatilhos e rotinas rodam como dono). Mesmo padrão de gf_notificar_evento e gf_interesse_avisar. A tabela segue sem Realtime.
-- 2. type em notifications: 'reminder' para prazo e 'info' para os demais (o CHECK só aceita info, sale, reminder, promo, system);
--    o tipo do quadro vai em metadata.tipo, com metadata.kind = 'quadro'. metadata.url = '/producer/tasks?cartao=<id>' (caminho
--    interno, começa com uma barra: passa na regex de urlDoAviso do front).
-- 3. quadro_notificar() não avisa o próprio autor, só avisa quem TEM a ferramenta quadro no produtor do cartão (dono, ou membro aceito,
--    não bloqueado, com 'ver' ou 'editar'; membro só de outra ferramenta não recebe nem o título do cartão), respeita as preferências
--    (geral ligado e types[tipo].app, padrão ligado) e tem três freios (anti-spam; passou deles, ignora em silêncio): não repete a
--    mesma combinação tipo + cartão + destinatário em 10 minutos (exceto 'prazo', que tem task_prazo_avisos); teto de 200 avisos do
--    quadro por destinatário por hora; teto de 100 eventos por hora por quem dispara (metadata.actor; conta pares tipo + cartão distintos, então um comentário que avisa 100 pessoas conta 1; sem autor, como no cron, fica fora). O corte do teto é aproximado: duas gravações simultâneas podem passar de 200 por poucas unidades.
--    O texto vira texto puro (sem HTML, com link em markdown reduzido ao rótulo, sem javascript: nem data:) e é cortado em 200
--    caracteres. Os textos dos avisos trazem só o título do cartão (cortado em 60, entre aspas tipográficas) (e o
--    nome da coluna no "movido"), nunca o corpo do comentário nem nome de gente.
-- 4. Gatilhos AFTER e a exceção capturada: um aviso que falha (preferência corrompida, tabela travada...) vira WARNING no log e a
--    gravação principal (membro, comentário, mover cartão) segue. Menção: cada pessoa mencionada recebe 'mencao'; membros e
--    observadores do cartão que não foram mencionados nem são o autor recebem 'mensagem'. Movido: só observadores (task_watchers),
--    menos quem moveu, e só quando a coluna muda dentro do MESMO quadro (apagar evento troca de quadro e não avisa ninguém).
--    Trocar assigned_to pela tela antiga não avisa (atribuição é por task_card_members).
-- 5. Prazos: avisa membros do cartão (task_card_members) e o responsável (assigned_to) de cartões não arquivados e fora de coluna
--    'done'. '24h' quando o prazo é hoje ou amanhã (data de São Paulo); 'vencido' quando passou, mas só até 7 dias depois (o
--    primeiro ciclo não pode despejar aviso de cartão velho). A chave de task_prazo_avisos tem due_date: se o prazo muda, vale
--    avisar de novo. O registro é gravado mesmo que a preferência da pessoa silencie o aviso (não repete depois).
-- 6. Recibos: quadro_marcar_entregue(cartões, aparelho) cria o recibo (delivered_at = agora) dos comentários de OUTRAS pessoas
--    que ainda não têm recibo dela, em até 200 cartões onde ela tem 'ver'. quadro_marcar_lido(cartão, aparelho) marca read_at =
--    agora nos comentários alheios (nunca antes de delivered_at, nunca sobrescreve read_at já gravado: o gatilho da 2A garante) e
--    carimba o "visto por". Ambas exigem login e 2FA (gf_mfa_ok replicado dentro da função, porque a regra restritiva da RLS não vale
--    dentro de SECURITY DEFINER), 'ver' no cartão, e não gravam NADA se show_receipts do quadro for falso. Sem acesso ou opção
--    desligada: devolvem 0 em silêncio (não revelam nada). Aparelho fora da lista vira 'outro'. Nunca IP.
-- 7. Desligar show_receipts não apaga recibo antigo: as políticas de leitura devolvem nada enquanto estiver desligado, e ligar de
--    novo os mostra outra vez. Apagar de verdade é decisão jurídica (Pendências).
-- 8. task_boards: UPDATE só da coluna show_receipts (grant por coluna) e só o dono (producer_id = auth.uid()); membro, mesmo
--    'editar', não altera. Nome e produtor do quadro seguem imutáveis para a API.
-- 9. task_notification_prefs.types: objeto até 2 KB, chaves só entre atribuicao, mencao, mensagem, prazo, movido, automacao; cada valor
--    um objeto com exatamente app e email, booleanos (quadro_prefs_ok). O e-mail e o som são lidos pela tela e pela Edge Function
--    futura; o banco só guarda a escolha.
-- 10. LIMITES CONHECIDOS: (a) não há limite de frequência de comentários (herdado da 2A); a amplificação em avisos é limitada por
--    20 menções, 100 membros e 100 observadores por cartão e pelos três freios da decisão 3; (b) recibos antigos continuam gravados
--    quando show_receipts é desligado (só ficam invisíveis; apagar é decisão jurídica pendente); (c) o agendamento no pg_cron real
--    não foi testado localmente: depois do Run, conferir `select * from cron.job where jobname = 'quadro_prazos';`.
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 0. Pré-requisitos -----------------------------------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.task_comment_receipts') is null or to_regclass('public.task_card_views') is null
     or to_regclass('public.task_comments') is null or to_regclass('public.task_card_members') is null
     or to_regclass('public.task_watchers') is null then
    raise exception 'Falta a fatia 2A do quadro (task_comments, task_comment_receipts, task_card_views...): aplicar 20261105_quadro_f2a_cartao.sql antes';
  end if;
  if to_regprocedure('public.task_pode(uuid, text)') is null or to_regprocedure('public.comment_pode(uuid, text)') is null then
    raise exception 'Falta public.task_pode / comment_pode (20261105_quadro_f2a_cartao.sql): aplicar antes';
  end if;
  if to_regprocedure('public.equipe_pode(uuid, text, text, uuid)') is null then
    raise exception 'Falta public.equipe_pode (20261103_equipe_quadro_f01.sql): aplicar antes';
  end if;
  if to_regproc('public.gf_mfa_ok') is null then
    raise exception 'Falta public.gf_mfa_ok (20260930_2fa_no_banco.sql): aplicar antes';
  end if;
  if to_regclass('public.notifications') is null then
    raise exception 'Falta public.notifications (20261013_notificacoes.sql): aplicar antes';
  end if;
end $$;

-- 1. Funções de validação ------------------------------------------------------------------------------------------------
-- types: objeto cujas chaves são os 6 tipos do quadro e cujos valores são {app: bool, email: bool} (só essas duas chaves).
create or replace function public.quadro_prefs_ok(p jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'object' and not exists (
    select 1 from jsonb_each(p) e
    where e.key <> all (array['atribuicao', 'mencao', 'mensagem', 'prazo', 'movido', 'automacao'])
       or jsonb_typeof(e.value) <> 'object'
       or (e.value - array['app', 'email']) <> '{}'::jsonb
       or jsonb_typeof(e.value -> 'app') is distinct from 'boolean'
       or jsonb_typeof(e.value -> 'email') is distinct from 'boolean')
$$;
-- o CHECK roda com o papel de quem grava: a função precisa de EXECUTE para authenticated
revoke all on function public.quadro_prefs_ok(jsonb) from public, anon;
grant execute on function public.quadro_prefs_ok(jsonb) to authenticated;

-- 2. Tabelas e coluna ----------------------------------------------------------------------------------------------------
alter table public.task_boards add column if not exists show_receipts boolean not null default true;

create table if not exists public.task_notification_prefs (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  general boolean not null default true,
  sound   boolean not null default true,
  types   jsonb not null default '{}'
);
alter table public.task_notification_prefs drop constraint if exists task_notification_prefs_types_ck;
alter table public.task_notification_prefs add constraint task_notification_prefs_types_ck
  check (public.quadro_prefs_ok(types) and pg_column_size(types) < 2048);

-- avisos de prazo já enviados (só funções acessam). due_date na chave: prazo novo = aviso novo.
create table if not exists public.task_prazo_avisos (
  task_id    uuid not null references public.producer_tasks (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('24h', 'vencido')),
  due_date   date not null,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id, kind, due_date)
);
create index if not exists task_prazo_avisos_user_idx on public.task_prazo_avisos (user_id);
-- cota por quem dispara (quadro_notificar): sem este índice a contagem varreria notifications
create index if not exists notifications_quadro_actor_idx on public.notifications ((metadata ->> 'actor'), created_at)
  where metadata ->> 'kind' = 'quadro';

-- 3. Aviso: a única porta que grava em notifications para o quadro ------------------------------------------------------------
create or replace function public.quadro_notificar(p_user uuid, p_task uuid, p_tipo text, p_texto text, p_actor uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_t public.producer_tasks;
  v_pref public.task_notification_prefs;
  v_texto text;
  i int;
begin
  if p_tipo is null or p_tipo <> all (array['atribuicao', 'mencao', 'mensagem', 'prazo', 'movido', 'automacao']) then
    raise exception 'Tipo de aviso do quadro inválido.' using errcode = '22023';
  end if;
  if p_user is null or p_task is null or p_user is not distinct from p_actor then return; end if; -- ninguém, ou o próprio autor
  select * into v_t from public.producer_tasks t where t.id = p_task;
  if not found then return; end if;
  -- só quem TEM a ferramenta quadro (dono, ou membro aceito, não bloqueado, com 'ver' ou 'editar'). Consulta direta e não
  -- equipe_pode(..., p_user): a guarda dela só responde por OUTRA pessoa a quem edita, e no cron auth.uid() é nulo.
  if v_t.producer_id <> p_user and not exists (
       select 1 from public.team_members m join public.team_member_tools f on f.member_id = m.id
       where m.producer_id = v_t.producer_id and m.user_id = p_user and m.accepted_at is not null and m.blocked_at is null
         and f.ferramenta = 'quadro') then
    return;
  end if;
  -- preferências: sem linha = tudo ligado
  select * into v_pref from public.task_notification_prefs f where f.user_id = p_user;
  if found and (not v_pref.general or coalesce((v_pref.types -> p_tipo ->> 'app')::boolean, true) = false) then return; end if;
  -- anti-spam (passou, ignora em silêncio). ponytail: contagens sem trava, gravações simultâneas podem passar dos tetos por poucas unidades.
  -- (a) mesma combinação tipo + cartão + destinatário só de novo depois de 10 minutos (atribui e desatribui em laço não reenche).
  --     'prazo' fica de fora: já tem a sua própria chave em task_prazo_avisos.
  if p_tipo <> 'prazo' and exists (select 1 from public.notifications n
      where n.user_id = p_user and n.metadata ->> 'kind' = 'quadro' and n.metadata ->> 'tipo' = p_tipo
        and n.metadata ->> 'task_id' = p_task::text and n.created_at > now() - interval '10 minutes') then
    return;
  end if;
  -- (b) 200 avisos do quadro por destinatário por hora
  if (select count(*) from public.notifications n
      where n.user_id = p_user and n.metadata ->> 'kind' = 'quadro' and n.created_at > now() - interval '1 hour') >= 200 then
    return;
  end if;
  -- (c) 100 EVENTOS por hora por quem DISPARA, contados por (tipo, cartão) distintos: um comentário que avisa 100 pessoas conta 1.
  --     Um membro não esgota a cota alheia nem a própria. Sem autor (cron, serviço) fica de fora.
  if p_actor is not null and (select count(distinct (n.metadata ->> 'tipo', n.metadata ->> 'task_id')) from public.notifications n
      where n.metadata ->> 'kind' = 'quadro' and n.metadata ->> 'actor' = p_actor::text and n.created_at > now() - interval '1 hour') >= 100
     -- o par (tipo, cartão) que já conta na hora não é bloqueado: os outros destinatários do MESMO comentário ainda recebem
     and not exists (select 1 from public.notifications n2
      where n2.metadata ->> 'kind' = 'quadro' and n2.metadata ->> 'actor' = p_actor::text and n2.metadata ->> 'tipo' = p_tipo
        and n2.metadata ->> 'task_id' = p_task::text and n2.created_at > now() - interval '1 hour') then
    return;
  end if;
  -- texto puro: tira HTML, links em markdown (fica o rótulo), esquemas javascript: e data:, espaços repetidos, e corta em 200
  v_texto := regexp_replace(coalesce(p_texto, ''), '<[^>]*>', '', 'g');
  v_texto := regexp_replace(v_texto, '\[([^\]]*)\]\([^)]*\)', '\1', 'g');
  for i in 1..3 loop -- 3 passadas: "javajavascript:script:" não reconstrói o esquema
    v_texto := regexp_replace(v_texto, '(javascript|data)\s*:', '', 'gi');
  end loop;
  v_texto := left(btrim(regexp_replace(regexp_replace(v_texto, '[<>]', '', 'g'), '\s+', ' ', 'g')), 200);
  insert into public.notifications (user_id, title, body, type, metadata)
  values (p_user,
          case p_tipo when 'atribuicao' then 'Nova atribuição' when 'mencao' then 'Você foi mencionado'
                      when 'mensagem' then 'Nova mensagem' when 'prazo' then 'Prazo chegando'
                      when 'movido' then 'Cartão movido' else 'Automação' end,
          v_texto,
          case when p_tipo = 'prazo' then 'reminder' else 'info' end,
          jsonb_build_object('kind', 'quadro', 'tipo', p_tipo, 'task_id', p_task, 'board_id', v_t.board_id, 'actor', p_actor,
                             'url', '/producer/tasks?cartao=' || p_task));
end $$;

-- 4. Gatilhos AFTER. O aviso é secundário: qualquer erro nele vira WARNING e a operação principal segue. ---------------------------
create or replace function public.task_card_members_notif_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  begin
    perform public.quadro_notificar(new.user_id, new.task_id, 'atribuicao',
      'Você foi atribuído ao cartão “' || left((select t.title from public.producer_tasks t where t.id = new.task_id), 60) || '”.',
      (select auth.uid()));
  exception when others then
    raise warning 'aviso de atribuição do quadro falhou: %', sqlerrm;
  end;
  return null;
end $$;
drop trigger if exists task_card_members_notif on public.task_card_members;
create trigger task_card_members_notif after insert on public.task_card_members
  for each row execute function public.task_card_members_notif_tg();

create or replace function public.task_comments_notif_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_titulo text; v_u uuid;
begin
  begin
    select left(t.title, 60) into v_titulo from public.producer_tasks t where t.id = new.task_id;
    -- as menções já chegam sem repetição e em no máximo 20 (gatilho BEFORE da 2A)
    foreach v_u in array new.mentions loop
      perform public.quadro_notificar(v_u, new.task_id, 'mencao',
        'Você foi mencionado em um comentário do cartão “' || v_titulo || '”.', new.user_id);
    end loop;
    for v_u in
      select x.user_id from (select m.user_id from public.task_card_members m where m.task_id = new.task_id
                             union select w.user_id from public.task_watchers w where w.task_id = new.task_id) x
      where x.user_id <> new.user_id and x.user_id <> all (new.mentions)
    loop
      perform public.quadro_notificar(v_u, new.task_id, 'mensagem', 'Novo comentário no cartão “' || v_titulo || '”.', new.user_id);
    end loop;
  exception when others then
    raise warning 'aviso de comentário do quadro falhou: %', sqlerrm;
  end;
  return null;
end $$;
drop trigger if exists task_comments_notif on public.task_comments;
create trigger task_comments_notif after insert on public.task_comments
  for each row execute function public.task_comments_notif_tg();

create or replace function public.producer_tasks_notif_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_col text; v_u uuid;
begin
  begin
    select c.name into v_col from public.task_columns c where c.id = new.column_id;
    for v_u in select w.user_id from public.task_watchers w where w.task_id = new.id loop
      perform public.quadro_notificar(v_u, new.id, 'movido',
        'O cartão “' || left(new.title, 60) || '” foi movido para “' || coalesce(v_col, '?') || '”.', (select auth.uid()));
    end loop;
  exception when others then
    raise warning 'aviso de movimento do quadro falhou: %', sqlerrm;
  end;
  return null;
end $$;
drop trigger if exists producer_tasks_quadro_notif on public.producer_tasks;
create trigger producer_tasks_quadro_notif after update on public.producer_tasks
  for each row when (old.column_id is distinct from new.column_id and old.board_id is not distinct from new.board_id)
  execute function public.producer_tasks_notif_tg();

-- 5. Prazos -------------------------------------------------------------------------------------------------------------------
create or replace function public.quadro_avisar_prazos()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_n integer := 0;
  r record;
begin
  for r in
    select t.id, t.title, (t.due_date at time zone 'America/Sao_Paulo')::date as dia, u.user_id,
           case when (t.due_date at time zone 'America/Sao_Paulo')::date < v_hoje then 'vencido' else '24h' end as kind
    from public.producer_tasks t
    left join public.task_columns c on c.id = t.column_id
    cross join lateral (select m.user_id from public.task_card_members m where m.task_id = t.id
                        union select t.assigned_to where t.assigned_to is not null) u
    where t.archived_at is null and c.kind is distinct from 'done' and t.due_date is not null
      and (t.due_date at time zone 'America/Sao_Paulo')::date between v_hoje - 7 and v_hoje + 1
  loop
    begin
      insert into public.task_prazo_avisos (task_id, user_id, kind, due_date) values (r.id, r.user_id, r.kind, r.dia)
        on conflict do nothing;
      if found then
        perform public.quadro_notificar(r.user_id, r.id, 'prazo',
          case r.kind when 'vencido' then 'O prazo do cartão “' || left(r.title, 60) || '” já passou.'
                      else 'O prazo do cartão “' || left(r.title, 60) || '” é hoje ou amanhã.' end, null);
        v_n := v_n + 1;
      end if;
    exception when others then
      raise warning 'aviso de prazo do quadro falhou: %', sqlerrm; -- um cartão com problema não derruba os outros
    end;
  end loop;
  return v_n;
end $$;

-- pg_cron a cada 30 minutos; idempotente. Sem pg_cron (banco local) pula com aviso.
do $$
begin
  if to_regprocedure('cron.schedule(text, text, text)') is null then
    raise notice 'pg_cron ausente: agendamento quadro_prazos PULADO (rodar este arquivo de novo onde houver pg_cron)';
  else
    execute 'grant usage on schema cron to postgres';
    execute 'grant all privileges on all tables in schema cron to postgres';
    execute $c$select cron.unschedule('quadro_prazos') where exists (select 1 from cron.job where jobname = 'quadro_prazos')$c$;
    execute $c$select cron.schedule('quadro_prazos', '*/30 * * * *', $cron$ select public.quadro_avisar_prazos(); $cron$)$c$;
  end if;
end $$;

-- 6. Leitura: recibos e "visto por" só por função --------------------------------------------------------------------------------
-- true quando o quadro do cartão deixa registrar e mostrar recibos (usada pelas regras de leitura)
create or replace function public.task_recibos_ligados(p_task uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  -- só responde a quem tem 'ver' no cartão: cartão alheio e id inexistente dão a mesma resposta (false)
  select public.task_pode(p_task, 'ver') and exists (select 1 from public.producer_tasks t join public.task_boards b on b.id = t.board_id
                 where t.id = p_task and b.show_receipts)
$$;

create or replace function public.quadro_marcar_entregue(p_tasks uuid[], p_device text default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_dev text := case when p_device in ('computador', 'celular', 'tablet', 'outro') then p_device else 'outro' end;
  v_n integer;
begin
  if v_uid is null or not (select public.gf_mfa_ok()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if p_tasks is null then return 0; end if;
  insert into public.task_comment_receipts (comment_id, user_id, delivered_at, device)
  select c.id, v_uid, now(), v_dev
  from public.task_comments c
  where c.task_id in (select distinct x from unnest(p_tasks[1:200]) x)
    and c.user_id <> v_uid
    and public.task_pode(c.task_id, 'ver') and public.task_recibos_ligados(c.task_id)
  on conflict (comment_id, user_id) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function public.quadro_marcar_lido(p_task uuid, p_device text default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_dev text := case when p_device in ('computador', 'celular', 'tablet', 'outro') then p_device else 'outro' end;
  v_n integer;
begin
  if v_uid is null or not (select public.gf_mfa_ok()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if p_task is null or not public.task_pode(p_task, 'ver') or not public.task_recibos_ligados(p_task) then return 0; end if;
  -- read_at: o gatilho da 2A garante "nunca menor que delivered_at"; o WHERE garante "nunca sobrescreve"
  insert into public.task_comment_receipts (comment_id, user_id, delivered_at, read_at, device)
  select c.id, v_uid, now(), now(), v_dev from public.task_comments c where c.task_id = p_task and c.user_id <> v_uid
  on conflict (comment_id, user_id) do update set read_at = excluded.read_at, device = excluded.device
    where public.task_comment_receipts.read_at is null;
  get diagnostics v_n = row_count;
  insert into public.task_card_views (task_id, user_id, last_seen_at, device) values (p_task, v_uid, now(), v_dev)
    on conflict (task_id, user_id) do update set last_seen_at = excluded.last_seen_at, device = excluded.device;
  return v_n;
end $$;

-- 7. Funções: nenhuma para anon; as internas nem para authenticated -----------------------------------------------------------------
revoke all on function public.quadro_notificar(uuid, uuid, text, text, uuid), public.quadro_avisar_prazos(),
  public.task_card_members_notif_tg(), public.task_comments_notif_tg(), public.producer_tasks_notif_tg()
  from public, anon, authenticated, service_role;
revoke all on function public.quadro_marcar_entregue(uuid[], text), public.quadro_marcar_lido(uuid, text),
  public.task_recibos_ligados(uuid) from public, anon;
grant execute on function public.quadro_marcar_entregue(uuid[], text), public.quadro_marcar_lido(uuid, text),
  public.task_recibos_ligados(uuid) to authenticated;

-- 8. Regras (RLS) e permissões --------------------------------------------------------------------------------------------------------
alter table public.task_notification_prefs enable row level security;
alter table public.task_prazo_avisos enable row level security; -- sem regra permissiva para clientes: só funções (dono) acessam

drop policy if exists task_notification_prefs_ver on public.task_notification_prefs;
drop policy if exists task_notification_prefs_criar on public.task_notification_prefs;
drop policy if exists task_notification_prefs_editar on public.task_notification_prefs;
drop policy if exists task_notification_prefs_apagar on public.task_notification_prefs;
create policy task_notification_prefs_ver on public.task_notification_prefs as permissive for select to authenticated
  using (user_id = (select auth.uid()));
create policy task_notification_prefs_criar on public.task_notification_prefs as permissive for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy task_notification_prefs_editar on public.task_notification_prefs as permissive for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy task_notification_prefs_apagar on public.task_notification_prefs as permissive for delete to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists gf_mfa_aal2 on public.task_notification_prefs;
create policy gf_mfa_aal2 on public.task_notification_prefs as restrictive for all to authenticated
  using ((select public.gf_mfa_ok())) with check ((select public.gf_mfa_ok()));
-- (o Supabase já cria essa regra em tabela nova de public; recriar aqui deixa o resultado igual em qualquer banco)
drop policy if exists gf_mfa_aal2 on public.task_prazo_avisos;
create policy gf_mfa_aal2 on public.task_prazo_avisos as restrictive for all to authenticated
  using ((select public.gf_mfa_ok())) with check ((select public.gf_mfa_ok()));

-- task_boards: só o dono do quadro liga e desliga os recibos (grant só da coluna)
drop policy if exists task_boards_recibos on public.task_boards;
create policy task_boards_recibos on public.task_boards as permissive for update to authenticated
  using (producer_id = (select auth.uid())) with check (producer_id = (select auth.uid()));

-- recibos e "visto por": a leitura some quando o quadro desliga show_receipts; a escrita, só pelas funções acima
drop policy if exists task_comment_receipts_ver on public.task_comment_receipts;
drop policy if exists task_comment_receipts_criar on public.task_comment_receipts;
drop policy if exists task_comment_receipts_editar on public.task_comment_receipts;
create policy task_comment_receipts_ver on public.task_comment_receipts as permissive for select to authenticated
  using (public.comment_pode(comment_id, 'ver')
         and exists (select 1 from public.task_comments c where c.id = comment_id and public.task_recibos_ligados(c.task_id)));
drop policy if exists task_card_views_ver on public.task_card_views;
drop policy if exists task_card_views_criar on public.task_card_views;
drop policy if exists task_card_views_editar on public.task_card_views;
create policy task_card_views_ver on public.task_card_views as permissive for select to authenticated
  using (public.task_pode(task_id, 'ver') and public.task_recibos_ligados(task_id));

revoke all on table public.task_notification_prefs, public.task_prazo_avisos from public, anon, authenticated;
grant select, delete on table public.task_notification_prefs to authenticated;
grant insert (user_id, general, sound, types) on table public.task_notification_prefs to authenticated;
grant update (general, sound, types) on table public.task_notification_prefs to authenticated;
grant update (show_receipts) on table public.task_boards to authenticated;
-- revogar na tabela também tira as permissões por coluna que a 2A deu
revoke insert, update on table public.task_comment_receipts, public.task_card_views from authenticated;

-- 9. Conferência que aborta (tudo ou nada) ------------------------------------------------------------------------------------------------------
do $$
declare
  v_tab text;
  v_esperado jsonb := jsonb_build_object(
    'task_notification_prefs', array['gf_mfa_aal2', 'task_notification_prefs_apagar', 'task_notification_prefs_criar',
                                     'task_notification_prefs_editar', 'task_notification_prefs_ver'],
    'task_prazo_avisos', array['gf_mfa_aal2'],
    'task_comment_receipts', array['gf_mfa_aal2', 'task_comment_receipts_ver'],
    'task_card_views', array['gf_mfa_aal2', 'task_card_views_ver'],
    'task_boards', array['gf_mfa_aal2', 'task_boards_recibos', 'task_boards_ver']);
begin
  for v_tab in select jsonb_object_keys(v_esperado) loop
    if not (select relrowsecurity from pg_class where oid = ('public.' || v_tab)::regclass) then
      raise exception '% sem RLS', v_tab;
    end if;
    if coalesce((select array_agg(policyname::text order by policyname::text) from pg_policies
                 where schemaname = 'public' and tablename = v_tab), array[]::text[])
       is distinct from coalesce((select array_agg(x order by x) from jsonb_array_elements_text(v_esperado -> v_tab) x), array[]::text[]) then
      raise exception 'regras de % fora do esperado', v_tab;
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = v_tab
        and policyname = 'gf_mfa_aal2' and permissive = 'RESTRICTIVE' and cmd = 'ALL') then
      raise exception 'gf_mfa_aal2 sumiu ou deixou de ser restritiva em %', v_tab;
    end if;
    if has_table_privilege('anon', ('public.' || v_tab)::regclass, 'select,insert,update,delete') then
      raise exception 'anon ainda tem privilégio em %', v_tab;
    end if;
  end loop;
  if has_table_privilege('authenticated', 'public.task_prazo_avisos', 'select,insert,update,delete')
     or has_any_column_privilege('authenticated', 'public.task_prazo_avisos', 'select,insert,update') then
    raise exception 'authenticated com privilégio em task_prazo_avisos';
  end if;
  if has_any_column_privilege('authenticated', 'public.task_comment_receipts', 'insert,update')
     or has_any_column_privilege('authenticated', 'public.task_card_views', 'insert,update') then
    raise exception 'authenticated ainda grava recibo ou "visto por" direto';
  end if;
  if has_column_privilege('authenticated', 'public.task_boards', 'name', 'update')
     or not has_column_privilege('authenticated', 'public.task_boards', 'show_receipts', 'update') then
    raise exception 'permissão de coluna de task_boards fora do esperado';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public'
             and (table_name like 'task\_%' or table_name = 'producer_tasks') and column_name ~* '(^|_)ip(_|$)') then
    raise exception 'coluna de IP encontrada (LGPD)';
  end if;
  if has_function_privilege('authenticated', 'public.quadro_notificar(uuid, uuid, text, text, uuid)', 'execute')
     or has_function_privilege('anon', 'public.quadro_notificar(uuid, uuid, text, text, uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.quadro_avisar_prazos()', 'execute')
     or has_function_privilege('anon', 'public.quadro_avisar_prazos()', 'execute')
     or has_function_privilege('anon', 'public.quadro_marcar_lido(uuid, text)', 'execute')
     or has_function_privilege('anon', 'public.quadro_marcar_entregue(uuid[], text)', 'execute')
     or not has_function_privilege('authenticated', 'public.quadro_marcar_lido(uuid, text)', 'execute')
     or not has_function_privilege('authenticated', 'public.quadro_marcar_entregue(uuid[], text)', 'execute') then
    raise exception 'permissão de função fora do esperado';
  end if;
  if to_regprocedure('cron.schedule(text, text, text)') is not null then
    if (select count(*) from cron.job where jobname = 'quadro_prazos' and schedule = '*/30 * * * *') <> 1 then
      raise exception 'cron: job quadro_prazos ausente ou com horário errado';
    end if;
  end if;
end $$;

commit;

-- Conferência (só leitura). Esperado: 2 tabelas novas, show_receipts ligado nos quadros existentes, job quadro_prazos (1 se houver pg_cron).
select 'tabelas novas' as item, count(*)::text as valor from pg_tables where schemaname = 'public'
  and tablename in ('task_notification_prefs', 'task_prazo_avisos')
union all
select 'quadros com show_receipts', count(*) filter (where show_receipts)::text || ' de ' || count(*)::text from public.task_boards
union all
select 'gatilhos de aviso', count(*)::text from pg_trigger where not tgisinternal
  and tgname in ('task_card_members_notif', 'task_comments_notif', 'producer_tasks_quadro_notif');
