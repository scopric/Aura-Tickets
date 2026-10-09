-- =============================================================================
-- Quadro, fatia 2C: botões próprios, modelos por tipo de evento, papéis, recorrência e checklist que move o cartão (09/10/2026).
-- Só banco: a tela vem depois. Nada aqui mexe em orders, coupons, ticket_types, preços, saques nem pagamentos: os passos de um
-- botão são uma LISTA FECHADA (mover, atribuir, etiqueta, prazo, avisar, arquivar) conferida pelo banco.
-- 1) task_roles: quem é cada papel do quadro (portaria, divulgacao, fornecedores, financeiro, juridico, revisao). A pessoa tem de
--    ter a ferramenta quadro no produtor (dono, ou membro aceito e não bloqueado com 'ver' ou 'editar').
-- 2) task_buttons: botões do quadro (no cartão ou numa coluna). steps = lista de 1 a 6 passos, validada por quadro_steps_ok().
--    quadro_rodar_botao(botão, cartão) roda os passos, cartão por cartão, e devolve {afetados, ignorados, motivos}.
-- 3) task_templates: 4 modelos (show, festa, curso, congresso) com os mesmos títulos, papéis, dias e atalhos do v9, somente leitura.
--    quadro_aplicar_modelo(quadro, tipo, itens) cria os cartões na primeira coluna, com prazo contado a partir do evento.
-- 4) Recorrência: um gatilho preenche recur_next quando recur_days é ligado; quadro_gerar_recorrente(cartão) cria a cópia na hora;
--    quadro_gerar_recorrentes_vencidas() faz o mesmo todo dia às 06:00 de São Paulo (pg_cron 'quadro_recorrentes').
-- 5) Checklist que move: producer_tasks.ck_move e task_boards.review_column_id. Quando o último item de TODAS as listas do cartão é
--    marcado, o cartão vai para a coluna de revisão do quadro (se a regra não deixar, o item continua marcado e o motivo vai ao histórico).
-- 6) quadro_papeis_sugerir(quadro): quem pode ser escolhido para cada papel (id e nome; NUNCA e-mail).
-- 7) task_activity ganha os tipos 'botao', 'modelo', 'recorrente' e 'checklist_recusado'.
-- 8) Segurança: RLS ligada em toda tabela nova, gf_mfa_aal2 (2FA) restritiva, anon sem nenhum privilégio. As funções públicas
--    repetem a porta de 2FA da 2B (gf_mfa_ok dentro da função: a regra restritiva da RLS não vale em SECURITY DEFINER).
--    LGPD: nenhuma coluna de IP.
--
-- Pré-requisito: a fatia 2B aplicada (20261106_quadro_f2b_notificacoes.sql). O bloco 0 aborta com mensagem clara se faltar.
-- Como aplicar: colar o arquivo inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA pelo TextEdit: erro 17). Fora do horário
-- de pico (set local lock_timeout faz desistir sem gravar nada se algo segurar a tabela; rodar de novo). Uma transação só:
-- se a conferência do fim falhar, nada é gravado. Idempotente (as sementes dos modelos são regravadas a cada rodada). Sem pg_cron
-- (banco local) o agendamento é pulado com aviso. O front atual não usa nada disto: aplicar antes ou depois do merge.
-- NÃO mover para supabase/migrations/ (motivo no cabeçalho de 20260927_security_hardening.sql).
-- Teste: supabase/tests/quadro_f2c.test.sql (pgTAP; banco local, nunca em produção). Único ajuste em teste anterior: quadro_f2a.test.sql conta as regras gf_mfa_aal2 das tabelas task_* (de 17 para 20, as 3 novas).
-- ATENÇÃO: reaplicar a 20261103 (fatia 1) DEPOIS desta apaga as permissões por coluna de producer_tasks.ck_move e de
--   task_boards.review_column_id (a fatia 1 refaz os grants do zero) e aborta na conferência de regras: não reaplicar. Rodar este
--   arquivo de novo devolve os grants. Reaplicar a 20261105 (2A) refaz a regra de kind de task_activity sem os tipos novos e
--   falharia se já houver linhas deles: não reaplicar. Reaplicar este arquivo preenche review_column_id de quadro que ficou sem
--   (inclusive o que o dono limpou de propósito).
-- Desfazer (só depois de voltar o front; ordem importa: agendamento, gatilhos, histórico, tabelas, colunas, e só no fim as funções).
--   O Desfazer só roda com o papel dono das tabelas (supabase_admin no banco local; no editor do Supabase é o papel padrão).
--   Ensaiado em begin/rollback no banco local. Os cartões criados por botões e modelos ficam.
--   select cron.unschedule('quadro_recorrentes') where exists (select 1 from cron.job where jobname = 'quadro_recorrentes');  -- só se houver pg_cron
--   drop trigger if exists producer_tasks_quadro_rec on public.producer_tasks;
--   drop trigger if exists producer_tasks_quadro_limite on public.producer_tasks;
--   drop index if exists public.producer_tasks_recur_idx;
--   drop trigger if exists task_checklist_items_ckmove on public.task_checklist_items;
--   drop trigger if exists task_columns_review on public.task_columns;
--   drop trigger if exists task_boards_review on public.task_boards;
--   delete from public.task_activity where kind in ('botao', 'modelo', 'recorrente', 'checklist_recusado');
--   alter table public.task_activity drop constraint if exists task_activity_kind_check;
--   alter table public.task_activity add constraint task_activity_kind_check
--     check (kind in ('criado', 'movido', 'arquivado', 'desarquivado', 'comentario', 'comentario_apagado', 'anexo'));
--   drop table if exists public.task_buttons, public.task_roles, public.task_templates;
--   alter table public.task_boards drop column if exists review_column_id;
--   alter table public.producer_tasks drop column if exists ck_move;
--   drop function if exists public.quadro_rodar_botao(uuid, uuid), public.quadro_aplicar_modelo(uuid, text, int[]),
--     public.quadro_gerar_recorrente(uuid), public.quadro_gerar_recorrente_interno(uuid), public.quadro_gerar_recorrentes_vencidas(),
--     public.quadro_papeis_sugerir(uuid), public.quadro_steps_ok(jsonb), public.quadro_tem_ferramenta(uuid, uuid),
--     public.task_roles_tg(), public.task_buttons_tg(), public.producer_tasks_rec_tg(), public.task_checklist_items_ckmove_tg(),
--     public.task_columns_review_tg(), public.task_boards_review_tg();
--
-- DECISÕES
-- 1. Papéis em task_roles (PK quadro+papel): uma pessoa por papel. O gatilho confere que ela tem a ferramenta quadro no produtor
--    do quadro. Papel sem pessoa não é erro: o passo do botão (atribuir, avisar) é ignorado com motivo, e o modelo cria o cartão
--    sem responsável. Se a pessoa saiu da equipe depois, o passo também é ignorado (motivo "saiu da equipe").
-- 2. "Responsável" de um papel é um MEMBRO DO CARTÃO (task_card_members), como no v9. assigned_to não é preenchido por botão nem
--    por modelo. O aviso de atribuição da 2B sai pelo gatilho existente.
-- 3. Passos (lista fechada, nenhum toca em dinheiro): mover {v: id de coluna do mesmo quadro}; atribuir e avisar {v: um dos 6 papéis};
--    etiqueta {v: id de etiqueta do mesmo quadro}; prazo {v: inteiro de 1 a 30 = dias a partir de hoje, meia-noite de São Paulo};
--    arquivar (sem v: a chave v é recusada). Qualquer outra chave ou passo é recusado. Coluna e etiqueta são conferidas no
--    gatilho do botão (o CHECK só vê a forma). Se a coluna ou a etiqueta for apagada depois, o passo é ignorado com motivo.
-- 4. Rodar botão: cada cartão roda numa subtransação. Se qualquer passo dá erro (dependência aberta, teto de membros...), os passos
--    daquele cartão são desfeitos e ele conta como ignorado, com a mensagem como motivo; os outros seguem. Passo sem efeito por falta
--    de pessoa/coluna/etiqueta, ou que não muda nada (já na coluna, etiqueta/membro já existente, prazo igual: "Sem mudança."), é só
--    pulado com motivo; o cartão conta como afetado se ao menos um passo MUDOU algo, senão como ignorado. Erro nativo do banco não vaza
--    texto: o motivo é "Um passo falhou neste cartão." e o erro real vai ao histórico.
--    Botão de quadro age nos cartões não arquivados da coluna do botão (teto 200 por execução, em ordem de posição; os que passam
--    do teto contam como ignorados, com motivo). Um registro 'botao' no histórico por execução (nome e contagens). O aviso usa
--    quadro_notificar tipo 'automacao' ("Botão “<nome>” precisa da sua atenção."), com os freios da 2B (inclusive 100 pares
--    tipo+cartão por hora por quem dispara: um botão de quadro em 200 cartões avisa no máximo 100; o resto é cortado em silêncio).
-- 5. Modelos: índices de p_itens começam em 0 (a ordem dos itens do modelo, a mesma da tela). A data do evento é events.date;
--    se for nula, erro 22023 "Defina a data do evento antes de aplicar o modelo." (start_date NÃO serve: o baseline grava now()). Prazo = data − dias, e se já passou, hoje. Um título que já existe, não arquivado,
--    no quadro é pulado (conta em "existentes"). O quadro precisa ter evento. Teto de 60 índices por chamada. Cada modelo guarda
--    papel como texto (slug), dias antes do evento (negativo = depois), atalhos (kinds de task_links) e, se houver, checklist
--    (lista de textos; as sementes atuais não têm). Uma chamada trava o quadro (advisory) para duas chamadas juntas não duplicarem.
-- 6. Recorrência: recur_days já tem CHECK (1, 7, 14, 30). O gatilho preenche recur_next = hoje + dias (São Paulo) ao ligar, ao
--    trocar o intervalo, e zera ao desligar; um recur_next escolhido na mesma gravação é respeitado. A cópia: mesmo título,
--    descrição, prioridade, cor, local, campos, responsável, membros, etiquetas e atalhos (só quem ainda é da equipe), checklists com
--    itens desmarcados, na primeira coluna, prazo = hoje + dias, sem recorrência própria. Dependências e observadores não vão.
--    O original avança recur_next para hoje + dias (sem acumular atrasos). O cron gera até 10 cópias por produtor e 300 no total por execução (o resto sai no
--    dia seguinte); se uma cópia falhar, o original avança mesmo assim (um cartão com problema não trava as outras), com WARNING
--    e uma linha 'recorrente' com o erro no histórico.
-- 7. Checklist que move: o gatilho AFTER UPDATE de task_checklist_items só age quando done passa a verdadeiro. Exige ck_move no cartão,
--    cartão não arquivado, todos os itens de todas as listas marcados (lista vazia não bloqueia), quadro com review_column_id, cartão
--    fora da coluna de revisão e de coluna 'done'. Trava advisory por cartão antes de conferir, para dois itens marcados juntos
--    não deixarem os dois pensando que falta o outro. Mover recusado: captura a exceção, o item FICA marcado e o motivo vai
--    ao histórico ('checklist_recusado'). O aviso 'movido' aos observadores sai pelo gatilho da 2B.
-- 8. review_column_id: só o dono do quadro altera (mesma regra de show_receipts) e a coluna tem de ser do mesmo quadro. Ao criar este
--    SQL preenche-se com a coluna 'Em revisão' dos quadros existentes; quadros novos ganham pelo gatilho AFTER INSERT de task_columns
--    (quadro_criar_interno da fatia 1 não foi tocada). Apagar a coluna volta para nulo (ON DELETE SET NULL).
-- 9. LIMITES CONHECIDOS: (a) o agendamento no pg_cron real não foi testado localmente: depois do Run, conferir
--    `select * from cron.job where jobname = 'quadro_recorrentes';`; (b) botão cujo passo guarda id de coluna ou etiqueta apagada
--    continua existindo e só pula o passo; (c) a transação de um botão de quadro com 200 cartões faz até 200 subtransações: dentro do
--    teto, mas é a execução mais pesada; (d) os tetos de membros, etiquetas e atalhos da 2A valem também para cópias e modelos
--    (se bater, o cartão da cópia falha e o cron avança o original); (e) o texto do motivo vem do banco em português, mas erros
--    inesperados voltam ao cliente só como "Um passo falhou neste cartão." (o texto real vai ao histórico); (f) o checklist só move o
--    cartão quando um item é MARCADO (apagar o último item aberto, ou inserir item já marcado, não move); lista de checklist vazia não
--    bloqueia o mover; (g) a cópia recorrente que falha no cron é perdida, mas fica registrada no histórico; (h) avisos de botões em massa
--    acima de 100 pares por hora são cortados em silêncio pelos freios da 2B; (i) o aviso do passo "avisar" conta como mudança mesmo se
--    um freio da 2B o descartar; (j) uma cópia manual por cartão por dia (a do cron também conta para o dia); (k) 3000 cartões por quadro,
--    contando os arquivados; (l) 20261103 e 20261105 reaplicadas depois desta quebram grants e conferências (ver ATENÇÃO).
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 0. Pré-requisitos -----------------------------------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.task_notification_prefs') is null or to_regclass('public.task_prazo_avisos') is null then
    raise exception 'Falta a fatia 2B do quadro (task_notification_prefs, task_prazo_avisos): aplicar 20261106_quadro_f2b_notificacoes.sql antes';
  end if;
  if to_regprocedure('public.quadro_notificar(uuid, uuid, text, text, uuid)') is null then
    raise exception 'Falta public.quadro_notificar (20261106_quadro_f2b_notificacoes.sql): aplicar antes';
  end if;
  if to_regprocedure('public.task_log(uuid, uuid, text, jsonb)') is null or to_regprocedure('public.task_limite_tg()') is null
     or to_regprocedure('public.board_pode(uuid, text)') is null or to_regprocedure('public.task_pode(uuid, text)') is null then
    raise exception 'Falta a fatia 2A do quadro (task_log, task_limite_tg, board_pode, task_pode): aplicar 20261105_quadro_f2a_cartao.sql antes';
  end if;
  if to_regclass('public.task_links') is null or to_regclass('public.task_checklist_items') is null then
    raise exception 'Falta a fatia 2A do quadro (task_links, task_checklist_items): aplicar 20261105_quadro_f2a_cartao.sql antes';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'task_boards'
                 and column_name = 'show_receipts') then
    raise exception 'Falta task_boards.show_receipts (20261106_quadro_f2b_notificacoes.sql): aplicar antes';
  end if;
  if to_regprocedure('public.equipe_pode(uuid, text, text, uuid)') is null then
    raise exception 'Falta public.equipe_pode (20261103_equipe_quadro_f01.sql): aplicar antes';
  end if;
  if to_regproc('public.gf_mfa_ok') is null then
    raise exception 'Falta public.gf_mfa_ok (20260930_2fa_no_banco.sql): aplicar antes';
  end if;
end $$;

-- 1. Funções de apoio -----------------------------------------------------------------------------------------------------------
-- Passos de um botão: lista de 1 a 6; cada passo é um objeto {t, v} (arquivar: só {t}). Só a FORMA: que a coluna e a etiqueta sejam
-- do quadro é conferido no gatilho de task_buttons. coalesce: chave ausente dá nulo, e "not nulo" não pode deixar passar.
create or replace function public.quadro_steps_ok(p jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'array' and jsonb_array_length(p) between 1 and 6
    and not exists (
      select 1 from jsonb_array_elements(p) s
      where not coalesce(case when jsonb_typeof(s) <> 'object' then false else case s ->> 't'
        when 'arquivar' then (s - 't') = '{}'::jsonb
        when 'mover' then (s - array['t', 'v']) = '{}'::jsonb and jsonb_typeof(s -> 'v') = 'string'
                          and (s ->> 'v') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        when 'etiqueta' then (s - array['t', 'v']) = '{}'::jsonb and jsonb_typeof(s -> 'v') = 'string'
                          and (s ->> 'v') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        when 'atribuir' then (s - array['t', 'v']) = '{}'::jsonb and jsonb_typeof(s -> 'v') = 'string'
                          and (s ->> 'v') in ('portaria', 'divulgacao', 'fornecedores', 'financeiro', 'juridico', 'revisao')
        when 'avisar' then (s - array['t', 'v']) = '{}'::jsonb and jsonb_typeof(s -> 'v') = 'string'
                          and (s ->> 'v') in ('portaria', 'divulgacao', 'fornecedores', 'financeiro', 'juridico', 'revisao')
        when 'prazo' then (s - array['t', 'v']) = '{}'::jsonb and jsonb_typeof(s -> 'v') = 'number'
                          and (s ->> 'v') ~ '^([1-9]|[12][0-9]|30)$'
        else false end end, false))
$$;

-- Interna: o usuário tem a ferramenta quadro no produtor (é o dono, ou membro aceito, não bloqueado, com 'ver' ou 'editar').
-- Consulta direta (como em quadro_notificar): equipe_pode(..., outra pessoa) só responde a quem edita, e no cron não há login.
create or replace function public.quadro_tem_ferramenta(p_produtor uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_user is not null and p_produtor is not null and (p_user = p_produtor or exists (
    select 1 from public.team_members m join public.team_member_tools f on f.member_id = m.id
    where m.producer_id = p_produtor and m.user_id = p_user and m.accepted_at is not null and m.blocked_at is null
      and f.ferramenta = 'quadro'))
$$;

-- 2. Colunas novas e histórico --------------------------------------------------------------------------------------------------
alter table public.producer_tasks add column if not exists ck_move boolean not null default false;
alter table public.task_boards add column if not exists review_column_id uuid references public.task_columns (id) on delete set null;

alter table public.task_activity drop constraint if exists task_activity_kind_check;
alter table public.task_activity add constraint task_activity_kind_check
  check (kind in ('criado', 'movido', 'arquivado', 'desarquivado', 'comentario', 'comentario_apagado', 'anexo',
                  'botao', 'modelo', 'recorrente', 'checklist_recusado'));

-- 3. Tabelas --------------------------------------------------------------------------------------------------------------------
create table if not exists public.task_roles (
  board_id uuid not null references public.task_boards (id) on delete cascade,
  papel    text not null check (papel in ('portaria', 'divulgacao', 'fornecedores', 'financeiro', 'juridico', 'revisao')),
  user_id  uuid not null references public.profiles (id) on delete cascade,
  primary key (board_id, papel)
);
create index if not exists task_roles_user_idx on public.task_roles (user_id);

create table if not exists public.task_buttons (
  id         uuid primary key default gen_random_uuid(),
  board_id   uuid not null references public.task_boards (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 40 and name !~ '[<>]'),
  scope      text not null check (scope in ('card', 'board')),
  column_id  uuid references public.task_columns (id) on delete cascade,
  steps      jsonb not null check (public.quadro_steps_ok(steps)),
  position   numeric not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((scope = 'board') = (column_id is not null))
);
alter table public.task_buttons drop constraint if exists task_buttons_name_ck;
alter table public.task_buttons add constraint task_buttons_name_ck
  check (name !~ '[[:cntrl:]]' and name !~ '[\u202A-\u202E\u2066-\u2069]'); -- sem controle nem formatação bidirecional
create index if not exists task_buttons_board_idx on public.task_buttons (board_id, position);
create index if not exists task_buttons_column_idx on public.task_buttons (column_id) where column_id is not null;

create table if not exists public.task_templates (
  key   text primary key check (key in ('show', 'festa', 'curso', 'congresso')),
  name  text not null,
  items jsonb not null
);
-- Sementes do v9 (app/public/quadro-modelo/v9.js, MODELOS). Regravadas a cada rodada.
insert into public.task_templates (key, name, items) values
  ('show', 'Show', '[{"titulo":"Contratar som, luz e palco","papel":"fornecedores","dias":45,"vinculos":["parceiro"]},{"titulo":"Fechar o line-up e os cachês","papel":"fornecedores","dias":40,"vinculos":["parceiro"]},{"titulo":"Abrir a venda do primeiro lote","papel":"divulgacao","dias":40,"vinculos":["ingresso"]},{"titulo":"Conferir licenças e alvará","papel":"juridico","dias":30,"vinculos":["evento"]},{"titulo":"Definir o plano de segurança e brigada","papel":"portaria","dias":21,"vinculos":["equipe"]},{"titulo":"Montar o cronograma do dia","papel":"fornecedores","dias":14,"vinculos":["cronograma"]},{"titulo":"Credenciar imprensa e convidados","papel":"divulgacao","dias":10,"vinculos":["participantes"]},{"titulo":"Testar o check-in","papel":"portaria","dias":3,"vinculos":["checkin"]},{"titulo":"Ensaio geral e passagem de som","papel":"fornecedores","dias":1,"vinculos":["cronograma"]}]'::jsonb),
  ('festa', 'Festa', '[{"titulo":"Fechar o local e a data","papel":"fornecedores","dias":40,"vinculos":["evento"]},{"titulo":"Contratar bar, DJ e decoração","papel":"fornecedores","dias":30,"vinculos":["parceiro"]},{"titulo":"Abrir a venda de ingressos e lista","papel":"divulgacao","dias":30,"vinculos":["ingresso"]},{"titulo":"Definir regras de saída e brigada","papel":"portaria","dias":14,"vinculos":["equipe"]},{"titulo":"Montar a lista de convidados","papel":"divulgacao","dias":7,"vinculos":["participantes"]},{"titulo":"Briefing da portaria","papel":"portaria","dias":3,"vinculos":["checkin"]}]'::jsonb),
  ('curso', 'Curso', '[{"titulo":"Reservar a sala e o material","papel":"fornecedores","dias":30,"vinculos":["evento"]},{"titulo":"Publicar o conteúdo programático","papel":"divulgacao","dias":30,"vinculos":["evento"]},{"titulo":"Abrir as inscrições","papel":"divulgacao","dias":28,"vinculos":["ingresso"]},{"titulo":"Confirmar os instrutores","papel":"fornecedores","dias":14,"vinculos":["equipe"]},{"titulo":"Preparar a lista de presença","papel":"portaria","dias":3,"vinculos":["participantes"]},{"titulo":"Emitir os certificados","papel":"divulgacao","dias":-1,"vinculos":["certificados"]}]'::jsonb),
  ('congresso', 'Congresso', '[{"titulo":"Fechar o espaço e a infraestrutura","papel":"fornecedores","dias":90,"vinculos":["evento"]},{"titulo":"Abrir a chamada de palestrantes","papel":"divulgacao","dias":80,"vinculos":["divulgacao"]},{"titulo":"Abrir a venda do primeiro lote","papel":"divulgacao","dias":70,"vinculos":["ingresso"]},{"titulo":"Fechar patrocinadores","papel":"financeiro","dias":60,"vinculos":["parceiro"]},{"titulo":"Montar a grade e o cronograma","papel":"fornecedores","dias":30,"vinculos":["cronograma"]},{"titulo":"Credenciar imprensa e palestrantes","papel":"divulgacao","dias":14,"vinculos":["participantes"]},{"titulo":"Testar check-in e credenciais","papel":"portaria","dias":3,"vinculos":["checkin"]},{"titulo":"Enviar certificados e pesquisa","papel":"divulgacao","dias":-1,"vinculos":["certificados"]}]'::jsonb)
on conflict (key) do update set name = excluded.name, items = excluded.items;

-- 4. Gatilhos de validação -------------------------------------------------------------------------------------------------------
-- Pessoa de um papel: tem de ter a ferramenta quadro no produtor do quadro. Quem não edita o quadro sai sem validar (return new)
-- para a RLS recusar com a mesma mensagem e nada virar oráculo.
create or replace function public.task_roles_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not public.board_pode(new.board_id, 'editar') then return new; end if; -- RLS recusa
  if not public.quadro_tem_ferramenta((select b.producer_id from public.task_boards b where b.id = new.board_id), new.user_id) then
    raise exception 'Essa pessoa não tem acesso ao quadro deste produtor.' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists task_roles_quadro on public.task_roles;
create trigger task_roles_quadro before insert or update of user_id on public.task_roles
  for each row execute function public.task_roles_tg();

-- Botão: quem criou; coluna do botão e colunas/etiquetas dos passos são do mesmo quadro.
create or replace function public.task_buttons_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then new.created_by := (select auth.uid()); end if;
  if (select auth.uid()) is not null and not public.board_pode(new.board_id, 'editar') then return new; end if; -- RLS recusa
  if not public.quadro_steps_ok(new.steps) then
    raise exception 'Passos do botão inválidos.' using errcode = '23514'; -- antes dos casts abaixo: forma errada não vira erro de uuid
  end if;
  if new.column_id is not null and (select c.board_id from public.task_columns c where c.id = new.column_id) is distinct from new.board_id then
    raise exception 'Coluna de outro quadro.' using errcode = '23514';
  end if;
  if exists (select 1 from jsonb_array_elements(new.steps) s where s ->> 't' = 'mover' and not exists (
       select 1 from public.task_columns c where c.id = (s ->> 'v')::uuid and c.board_id = new.board_id)) then
    raise exception 'Passo mover com coluna de outro quadro.' using errcode = '23514';
  end if;
  if exists (select 1 from jsonb_array_elements(new.steps) s where s ->> 't' = 'etiqueta' and not exists (
       select 1 from public.task_labels l where l.id = (s ->> 'v')::uuid and l.board_id = new.board_id)) then
    raise exception 'Passo etiqueta com etiqueta de outro quadro.' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists task_buttons_limite on public.task_buttons;
create trigger task_buttons_limite before insert on public.task_buttons
  for each row execute function public.task_limite_tg('board_id', '50', 'botões por quadro');
drop trigger if exists task_buttons_quadro on public.task_buttons;
create trigger task_buttons_quadro before insert or update on public.task_buttons
  for each row execute function public.task_buttons_tg();

-- Coluna de revisão: do mesmo quadro; só o dono chega aqui (a regra de UPDATE de task_boards é do dono).
create or replace function public.task_boards_review_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and new.producer_id is distinct from (select auth.uid()) then return new; end if; -- RLS recusa
  if new.review_column_id is not null and (select c.board_id from public.task_columns c where c.id = new.review_column_id) is distinct from new.id then
    raise exception 'Coluna de revisão de outro quadro.' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists task_boards_review on public.task_boards;
create trigger task_boards_review before update of review_column_id on public.task_boards
  for each row execute function public.task_boards_review_tg();

-- Quadro novo: a coluna 'Em revisão' recém-criada vira a coluna de revisão (a quadro_criar_interno da fatia 1 fica como está).
create or replace function public.task_columns_review_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.name = 'Em revisão' then
    update public.task_boards set review_column_id = new.id where id = new.board_id and review_column_id is null;
  end if;
  return null;
end $$;
drop trigger if exists task_columns_review on public.task_columns;
create trigger task_columns_review after insert on public.task_columns
  for each row execute function public.task_columns_review_tg();

-- Quadros que já existem
update public.task_boards b set review_column_id = (select c.id from public.task_columns c
    where c.board_id = b.id and c.name = 'Em revisão' order by c.position, c.id limit 1)
  where b.review_column_id is null;

-- Recorrência: recur_next nasce preenchido ao ligar a repetição (e acompanha a troca de intervalo)
create or replace function public.producer_tasks_rec_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.recur_days is null then
    new.recur_next := null;
  elsif new.recur_next is null
     or (tg_op = 'UPDATE' and new.recur_days is distinct from old.recur_days and new.recur_next is not distinct from old.recur_next) then
    new.recur_next := (now() at time zone 'America/Sao_Paulo')::date + new.recur_days;
  end if;
  -- nunca no passado: uma data antiga (ex.: 0001-01-01) faria o cartão passar na frente de todos no cron
  if new.recur_next is not null then
    new.recur_next := greatest(new.recur_next, (now() at time zone 'America/Sao_Paulo')::date);
  end if;
  return new;
end $$;
drop trigger if exists producer_tasks_quadro_rec on public.producer_tasks;
create trigger producer_tasks_quadro_rec before insert or update of recur_days, recur_next on public.producer_tasks
  for each row execute function public.producer_tasks_rec_tg();

-- Teto de cartões por quadro (conta os arquivados também): modelo + arquivar + repetir não multiplica sem fim.
-- BEFORE INSERT: roda depois de producer_tasks_quadro (ordem alfabética), que já preencheu board_id.
drop trigger if exists producer_tasks_quadro_limite on public.producer_tasks;
create trigger producer_tasks_quadro_limite before insert on public.producer_tasks
  for each row execute function public.task_limite_tg('board_id', '3000', 'cartões por quadro');
-- o cron procura só cartões que repetem e não estão arquivados
create index if not exists producer_tasks_recur_idx on public.producer_tasks (recur_next)
  where recur_days is not null and archived_at is null;

-- Checklist que move o cartão (AFTER: o item já está gravado e o gatilho BEFORE da 2A já carimbou quem marcou)
create or replace function public.task_checklist_items_ckmove_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_t public.producer_tasks;
  v_review uuid;
begin
  select t.* into v_t from public.task_checklists c join public.producer_tasks t on t.id = c.task_id where c.id = new.checklist_id;
  if not found or not v_t.ck_move or v_t.archived_at is not null then return null; end if;
  -- uma conferência por cartão por vez: dois itens marcados juntos não podem achar, cada um, que falta o outro
  perform pg_advisory_xact_lock(hashtext('quadro:' || v_t.id::text));
  select t.* into v_t from public.producer_tasks t where t.id = v_t.id;
  select b.review_column_id into v_review from public.task_boards b where b.id = v_t.board_id;
  if v_review is null or v_t.column_id is not distinct from v_review
     or (select c.kind from public.task_columns c where c.id = v_t.column_id) = 'done' then
    return null;
  end if;
  if exists (select 1 from public.task_checklist_items i join public.task_checklists c on c.id = i.checklist_id
             where c.task_id = v_t.id and not i.done) then
    return null;
  end if;
  begin
    update public.producer_tasks set column_id = v_review where id = v_t.id;
  exception when others then
    perform public.task_log(v_t.board_id, v_t.id, 'checklist_recusado', jsonb_build_object('motivo', sqlerrm));
  end;
  return null;
end $$;
drop trigger if exists task_checklist_items_ckmove on public.task_checklist_items;
create trigger task_checklist_items_ckmove after update on public.task_checklist_items
  for each row when (new.done and not old.done) execute function public.task_checklist_items_ckmove_tg();

-- 5. Botões: rodar ------------------------------------------------------------------------------------------------------------------
create or replace function public.quadro_rodar_botao(p_button uuid, p_task uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_b public.task_buttons;
  v_ids uuid[];
  v_total int;
  v_id uuid;
  v_s jsonb;
  v_n int := 0;
  v_ign int := 0;
  v_motivos text[] := '{}';
  v_ok int;
  v_cm text[];
  v_user uuid;
  v_alvo uuid;
  v_prod uuid;
  v_rows int;
  v_rotulo text;
begin
  if v_uid is null or not (select public.gf_mfa_ok()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  select * into v_b from public.task_buttons b where b.id = p_button;
  if not found or not public.board_pode(v_b.board_id, 'editar') then
    raise exception 'Sem permissão para este botão.' using errcode = '42501'; -- botão inexistente e botão alheio dão a mesma resposta
  end if;
  -- o mesmo botão não roda duas vezes ao mesmo tempo (a segunda espera a primeira terminar)
  perform pg_advisory_xact_lock(hashtext('botao:' || p_button::text));
  select b.producer_id into v_prod from public.task_boards b where b.id = v_b.board_id;
  if v_b.scope = 'card' then
    if p_task is null or not exists (select 1 from public.producer_tasks t where t.id = p_task and t.board_id = v_b.board_id) then
      raise exception 'O cartão não é deste quadro.' using errcode = '22023';
    end if;
    v_ids := array[p_task];
    v_total := 1;
  else
    select count(*) into v_total from public.producer_tasks t
      where t.board_id = v_b.board_id and t.column_id = v_b.column_id and t.archived_at is null;
    v_ids := array(select t.id from public.producer_tasks t
      where t.board_id = v_b.board_id and t.column_id = v_b.column_id and t.archived_at is null
      order by t.position, t.id limit 200);
    if v_total > 200 then
      v_motivos := array['Limite de 200 cartões por execução: rode de novo para os demais.'];
    end if;
  end if;

  foreach v_id in array v_ids loop
    v_ok := 0;
    v_cm := '{}';
    begin -- subtransação: erro em um passo desfaz só este cartão
      if exists (select 1 from public.producer_tasks t where t.id = v_id and t.archived_at is not null) then
        v_cm := array['Cartão arquivado.'];
      else
        for v_s in select e from jsonb_array_elements(v_b.steps) e loop
          v_rows := null;
          v_rotulo := case v_s ->> 'v' when 'portaria' then 'Portaria' when 'divulgacao' then 'Divulgação' when 'fornecedores' then 'Fornecedores'
                        when 'financeiro' then 'Financeiro' when 'juridico' then 'Jurídico' when 'revisao' then 'Revisão' end;
          case v_s ->> 't'
            when 'mover' then
              select c.id into v_alvo from public.task_columns c where c.id = (v_s ->> 'v')::uuid and c.board_id = v_b.board_id;
              if v_alvo is null then
                v_cm := v_cm || 'A coluna de destino do passo mover não existe mais.'::text;
              else
                update public.producer_tasks set column_id = v_alvo where id = v_id and column_id is distinct from v_alvo; -- gatilhos da fatia 1 e 2A: dependência aberta recusa
                get diagnostics v_rows = row_count;
              end if;
            when 'atribuir', 'avisar' then
              select r.user_id into v_user from public.task_roles r where r.board_id = v_b.board_id and r.papel = v_s ->> 'v';
              if v_user is null then
                v_cm := v_cm || ('Papel “' || v_rotulo || '” sem pessoa definida.');
              elsif not public.quadro_tem_ferramenta(v_prod, v_user) then
                v_cm := v_cm || ('Papel “' || v_rotulo || '”: a pessoa saiu da equipe.');
              elsif v_s ->> 't' = 'atribuir' then
                insert into public.task_card_members (task_id, user_id) values (v_id, v_user) on conflict do nothing;
                get diagnostics v_rows = row_count;
              else
                perform public.quadro_notificar(v_user, v_id, 'automacao', 'Botão “' || v_b.name || '” precisa da sua atenção.', v_uid);
                v_rows := 1; -- o aviso pode ser descartado pelos freios da 2B; conta como feito
              end if;
            when 'etiqueta' then
              if not exists (select 1 from public.task_labels l where l.id = (v_s ->> 'v')::uuid and l.board_id = v_b.board_id) then
                v_cm := v_cm || 'A etiqueta do passo não existe mais.'::text;
              else
                insert into public.task_card_labels (task_id, label_id) values (v_id, (v_s ->> 'v')::uuid) on conflict do nothing;
                get diagnostics v_rows = row_count;
              end if;
            when 'prazo' then
              update public.producer_tasks set due_date = (v_hoje + (v_s ->> 'v')::int)::timestamp at time zone 'America/Sao_Paulo'
                where id = v_id and due_date is distinct from (v_hoje + (v_s ->> 'v')::int)::timestamp at time zone 'America/Sao_Paulo';
              get diagnostics v_rows = row_count;
            when 'arquivar' then
              update public.producer_tasks set archived_at = now() where id = v_id and archived_at is null;
              get diagnostics v_rows = row_count;
            else
              null; -- impossível: o CHECK da tabela só aceita os 6 passos
          end case;
          if v_rows = 0 then
            v_cm := v_cm || 'Sem mudança.'::text;
          elsif v_rows > 0 then
            v_ok := v_ok + 1;
          end if;
        end loop;
      end if;
    exception when others then
      v_ok := 0;
      -- nossas mensagens em português (P0001 e os 23514 dos gatilhos, que não citam constraint) voltam como estão; o resto
      -- (unicidade, check nativo...) vira texto genérico e o erro real vai ao histórico, para o dono investigar
      if sqlstate = 'P0001' or (sqlstate = '23514' and sqlerrm not like '%violates%') then
        v_cm := array[sqlerrm];
      else
        v_cm := array['Um passo falhou neste cartão.'];
        perform public.task_log(v_b.board_id, v_id, 'botao', jsonb_build_object('botao', v_b.name, 'erro', sqlerrm, 'sqlstate', sqlstate));
      end if;
    end;
    if v_ok > 0 then v_n := v_n + 1; else v_ign := v_ign + 1; end if;
    v_motivos := v_motivos || v_cm;
  end loop;

  v_ign := v_ign + (v_total - cardinality(v_ids)); -- cartões além do teto
  v_motivos := array(select m from (select distinct m from unnest(v_motivos) m) d order by m limit 20);
  perform public.task_log(v_b.board_id, case when v_b.scope = 'card' then p_task end, 'botao',
    jsonb_build_object('botao', v_b.name, 'afetados', v_n, 'ignorados', v_ign));
  return jsonb_build_object('afetados', v_n, 'ignorados', v_ign, 'motivos', to_jsonb(v_motivos));
end $$;

-- 6. Modelos: aplicar ---------------------------------------------------------------------------------------------------------------
create or replace function public.quadro_aplicar_modelo(p_board uuid, p_kind text, p_itens int[] default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_board public.task_boards;
  v_tpl public.task_templates;
  v_data date;
  v_col uuid;
  v_it jsonb;
  v_i int;
  v_task uuid;
  v_user uuid;
  v_cl uuid;
  v_k text;
  v_prazo date;
  v_criados int := 0;
  v_exist int := 0;
begin
  if v_uid is null or not (select public.gf_mfa_ok()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if p_board is null or not public.board_pode(p_board, 'editar') then
    raise exception 'Sem permissão para este quadro.' using errcode = '42501';
  end if;
  select * into v_board from public.task_boards b where b.id = p_board;
  if v_board.event_id is null then
    raise exception 'Escolha um evento: o modelo usa a data dele.' using errcode = '22023';
  end if;
  select * into v_tpl from public.task_templates t where t.key = p_kind;
  if not found then
    raise exception 'Modelo desconhecido.' using errcode = '22023';
  end if;
  if p_itens is not null and cardinality(p_itens) > 60 then
    raise exception 'No máximo 60 cartões por vez.' using errcode = '22023';
  end if;
  select e.date into v_data from public.events e where e.id = v_board.event_id;
  if v_data is null then
    raise exception 'Defina a data do evento antes de aplicar o modelo.' using errcode = '22023';
  end if;
  select c.id into v_col from public.task_columns c where c.board_id = p_board order by c.position, c.id limit 1;
  if v_col is null then
    raise exception 'O quadro não tem coluna.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('quadro:' || p_board::text)); -- duas chamadas juntas não duplicam

  for v_it, v_i in select e.value, (e.ordinality - 1)::int from jsonb_array_elements(v_tpl.items) with ordinality e loop
    continue when p_itens is not null and not coalesce(v_i = any (p_itens), false);
    if exists (select 1 from public.producer_tasks t where t.board_id = p_board and t.archived_at is null and t.title = v_it ->> 'titulo') then
      v_exist := v_exist + 1;
      continue;
    end if;
    v_prazo := greatest(v_data - (v_it ->> 'dias')::int, v_hoje);
    insert into public.producer_tasks (producer_id, event_id, board_id, column_id, title, description, due_date)
      values (v_board.producer_id, v_board.event_id, p_board, v_col, v_it ->> 'titulo',
              'Criado pelo modelo “' || v_tpl.name || '”.', v_prazo::timestamp at time zone 'America/Sao_Paulo')
      returning id into v_task;
    select r.user_id into v_user from public.task_roles r where r.board_id = p_board and r.papel = v_it ->> 'papel';
    if v_user is not null and public.quadro_tem_ferramenta(v_board.producer_id, v_user) then
      insert into public.task_card_members (task_id, user_id) values (v_task, v_user);
    end if;
    for v_k in select jsonb_array_elements_text(coalesce(v_it -> 'vinculos', '[]'::jsonb)) loop
      insert into public.task_links (task_id, kind) values (v_task, v_k);
    end loop;
    if jsonb_typeof(v_it -> 'checklist') = 'array' and jsonb_array_length(v_it -> 'checklist') > 0 then
      insert into public.task_checklists (task_id, title, position) values (v_task, 'Checklist', 1000) returning id into v_cl;
      insert into public.task_checklist_items (checklist_id, text, position)
        select v_cl, x.value, x.ordinality * 1000 from jsonb_array_elements_text(v_it -> 'checklist') with ordinality x;
    end if;
    v_criados := v_criados + 1;
  end loop;

  perform public.task_log(p_board, null, 'modelo', jsonb_build_object('modelo', v_tpl.key, 'criados', v_criados, 'existentes', v_exist));
  return jsonb_build_object('criados', v_criados, 'existentes', v_exist);
end $$;

-- 7. Recorrência -------------------------------------------------------------------------------------------------------------------
-- Interna (sem conferir quem chama): a cópia do cartão e o avanço do original. Usada pela pública e pelo cron.
create or replace function public.quadro_gerar_recorrente_interno(p_task uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_t public.producer_tasks;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_col uuid;
  v_new uuid;
  v_cl record;
  v_cl_new uuid;
begin
  select * into v_t from public.producer_tasks t where t.id = p_task for update; -- cron e clique juntos não duplicam o avanço
  if not found or v_t.recur_days is null or v_t.archived_at is not null then return null; end if;
  select c.id into v_col from public.task_columns c where c.board_id = v_t.board_id order by c.position, c.id limit 1;
  insert into public.producer_tasks (producer_id, event_id, board_id, column_id, title, description, priority, cover, location, fields,
                                     assigned_to, due_date)
    values (v_t.producer_id, v_t.event_id, v_t.board_id, v_col, v_t.title, v_t.description, v_t.priority, v_t.cover, v_t.location, v_t.fields,
            case when public.quadro_tem_ferramenta(v_t.producer_id, v_t.assigned_to) then v_t.assigned_to end,
            (v_hoje + v_t.recur_days)::timestamp at time zone 'America/Sao_Paulo')
    returning id into v_new;
  insert into public.task_card_members (task_id, user_id)
    select v_new, m.user_id from public.task_card_members m
    where m.task_id = p_task and public.quadro_tem_ferramenta(v_t.producer_id, m.user_id);
  insert into public.task_card_labels (task_id, label_id) select v_new, l.label_id from public.task_card_labels l where l.task_id = p_task;
  insert into public.task_links (task_id, kind, ref) select v_new, k.kind, k.ref from public.task_links k where k.task_id = p_task;
  for v_cl in select c.id, c.title, c.position from public.task_checklists c where c.task_id = p_task order by c.position, c.id loop
    insert into public.task_checklists (task_id, title, position) values (v_new, v_cl.title, v_cl.position) returning id into v_cl_new;
    insert into public.task_checklist_items (checklist_id, text, position, done)
      select v_cl_new, i.text, i.position, false from public.task_checklist_items i where i.checklist_id = v_cl.id;
  end loop;
  update public.producer_tasks set recur_next = v_hoje + v_t.recur_days where id = p_task;
  perform public.task_log(v_t.board_id, v_new, 'recorrente', jsonb_build_object('origem', p_task));
  return v_new;
end $$;

create or replace function public.quadro_gerar_recorrente(p_task uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_t public.producer_tasks;
begin
  if v_uid is null or not (select public.gf_mfa_ok()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if p_task is null or not public.task_pode(p_task, 'editar') then
    raise exception 'Sem permissão para este cartão.' using errcode = '42501'; -- cartão inexistente e alheio dão a mesma resposta
  end if;
  select * into v_t from public.producer_tasks t where t.id = p_task;
  if v_t.recur_days is null then
    raise exception 'Este cartão não se repete.' using errcode = '22023';
  end if;
  if v_t.archived_at is not null then
    raise exception 'Cartão arquivado não se repete.' using errcode = '22023';
  end if;
  -- no máximo uma cópia por cartão por dia (data de São Paulo); a trava evita dois cliques juntos passarem os dois
  perform pg_advisory_xact_lock(hashtext('recorrente:' || p_task::text));
  if exists (select 1 from public.task_activity a where a.kind = 'recorrente' and a.data ->> 'origem' = p_task::text
             and (a.created_at at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date) then
    raise exception 'Já foi gerada uma cópia hoje. A próxima pode ser gerada amanhã.' using errcode = '22023';
  end if;
  return public.quadro_gerar_recorrente_interno(p_task);
end $$;

-- Cron: cartões com recur_next vencido (data de São Paulo). Até 10 por produtor e 300 no total por execução; falha de um não trava os outros.
create or replace function public.quadro_gerar_recorrentes_vencidas()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_n integer := 0;
  v_id uuid;
begin
  for v_id in
    select x.id from (
      select t.id, t.recur_next,
             row_number() over (partition by t.producer_id order by t.recur_next, t.id) as rn
      from public.producer_tasks t
      where t.recur_days is not null and t.recur_next <= v_hoje and t.archived_at is null) x
    where x.rn <= 10 -- justo por produtor: quem tem muitos cartões não toma a vez dos outros
    order by x.recur_next, x.rn, x.id limit 300
  loop
    begin
      if public.quadro_gerar_recorrente_interno(v_id) is not null then v_n := v_n + 1; end if;
    exception when others then
      raise warning 'recorrência do quadro falhou para o cartão %: %', v_id, sqlerrm;
      begin -- a ocorrência é pulada (e registrada) para esse cartão não ocupar as 50 vagas todo dia
        update public.producer_tasks set recur_next = v_hoje + recur_days where id = v_id;
        perform public.task_log((select t.board_id from public.producer_tasks t where t.id = v_id), v_id, 'recorrente',
          jsonb_build_object('falhou', sqlerrm));
      exception when others then
        raise warning 'não foi possível registrar a falha da recorrência de %: %', v_id, sqlerrm;
      end;
    end;
  end loop;
  return v_n;
end $$;

-- pg_cron todo dia às 09:00 UTC = 06:00 em São Paulo; idempotente. Sem pg_cron (banco local) pula com aviso.
do $$
begin
  if to_regprocedure('cron.schedule(text, text, text)') is null then
    raise notice 'pg_cron ausente: agendamento quadro_recorrentes PULADO (rodar este arquivo de novo onde houver pg_cron)';
  else
    execute 'grant usage on schema cron to postgres';
    execute 'grant all privileges on all tables in schema cron to postgres';
    execute $c$select cron.unschedule('quadro_recorrentes') where exists (select 1 from cron.job where jobname = 'quadro_recorrentes')$c$;
    execute $c$select cron.schedule('quadro_recorrentes', '0 9 * * *', $cron$ select public.quadro_gerar_recorrentes_vencidas(); $cron$)$c$;
  end if;
end $$;

-- 8. Papéis: quem pode ser escolhido -------------------------------------------------------------------------------------------------
-- Só id e nome. Nunca e-mail. Sem nome cadastrado, aparece "Sem nome".
create or replace function public.quadro_papeis_sugerir(p_board uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_prod uuid;
begin
  if v_uid is null or not (select public.gf_mfa_ok()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if p_board is null or not public.board_pode(p_board, 'editar') then
    raise exception 'Sem permissão para este quadro.' using errcode = '42501';
  end if;
  select b.producer_id into v_prod from public.task_boards b where b.id = p_board;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome) order by x.nome, x.id)
    from (select p.id, coalesce(nullif(btrim(p.full_name), ''), 'Sem nome') as nome from public.profiles p where p.id = v_prod
          union
          select p.id, coalesce(nullif(btrim(p.full_name), ''), 'Sem nome')
          from public.team_members m join public.team_member_tools f on f.member_id = m.id and f.ferramenta = 'quadro'
               join public.profiles p on p.id = m.user_id
          where m.producer_id = v_prod and m.accepted_at is not null and m.blocked_at is null) x), '[]'::jsonb);
end $$;

-- 9. Funções: nenhuma para anon; as internas nem para authenticated ---------------------------------------------------------------------
revoke all on function public.quadro_tem_ferramenta(uuid, uuid), public.quadro_gerar_recorrente_interno(uuid),
  public.quadro_gerar_recorrentes_vencidas(), public.task_roles_tg(), public.task_buttons_tg(), public.producer_tasks_rec_tg(),
  public.task_checklist_items_ckmove_tg(), public.task_columns_review_tg(), public.task_boards_review_tg()
  from public, anon, authenticated, service_role;
revoke all on function public.quadro_steps_ok(jsonb), public.quadro_rodar_botao(uuid, uuid), public.quadro_aplicar_modelo(uuid, text, int[]),
  public.quadro_gerar_recorrente(uuid), public.quadro_papeis_sugerir(uuid) from public, anon;
-- o CHECK de task_buttons roda com o papel de quem grava: quadro_steps_ok precisa de EXECUTE para authenticated
grant execute on function public.quadro_steps_ok(jsonb), public.quadro_rodar_botao(uuid, uuid), public.quadro_aplicar_modelo(uuid, text, int[]),
  public.quadro_gerar_recorrente(uuid), public.quadro_papeis_sugerir(uuid) to authenticated;

-- 10. Regras (RLS) e permissões -----------------------------------------------------------------------------------------------------------
alter table public.task_roles enable row level security;
alter table public.task_buttons enable row level security;
alter table public.task_templates enable row level security;

drop policy if exists task_roles_ver on public.task_roles;
drop policy if exists task_roles_criar on public.task_roles;
drop policy if exists task_roles_editar on public.task_roles;
drop policy if exists task_roles_apagar on public.task_roles;
create policy task_roles_ver on public.task_roles as permissive for select to authenticated
  using (public.board_pode(board_id, 'ver'));
create policy task_roles_criar on public.task_roles as permissive for insert to authenticated
  with check (public.board_pode(board_id, 'editar'));
create policy task_roles_editar on public.task_roles as permissive for update to authenticated
  using (public.board_pode(board_id, 'editar')) with check (public.board_pode(board_id, 'editar'));
create policy task_roles_apagar on public.task_roles as permissive for delete to authenticated
  using (public.board_pode(board_id, 'editar'));

drop policy if exists task_buttons_ver on public.task_buttons;
drop policy if exists task_buttons_criar on public.task_buttons;
drop policy if exists task_buttons_editar on public.task_buttons;
drop policy if exists task_buttons_apagar on public.task_buttons;
create policy task_buttons_ver on public.task_buttons as permissive for select to authenticated
  using (public.board_pode(board_id, 'ver'));
create policy task_buttons_criar on public.task_buttons as permissive for insert to authenticated
  with check (public.board_pode(board_id, 'editar'));
create policy task_buttons_editar on public.task_buttons as permissive for update to authenticated
  using (public.board_pode(board_id, 'editar')) with check (public.board_pode(board_id, 'editar'));
create policy task_buttons_apagar on public.task_buttons as permissive for delete to authenticated
  using (public.board_pode(board_id, 'editar'));

-- modelos: todo mundo que entra logado lê (são textos fixos do produto); ninguém grava
drop policy if exists task_templates_ver on public.task_templates;
create policy task_templates_ver on public.task_templates as permissive for select to authenticated using (true);

-- 2FA: mesma regra RESTRICTIVE das outras tabelas do quadro
do $$
declare v_tab text;
begin
  foreach v_tab in array array['task_roles', 'task_buttons', 'task_templates'] loop
    execute format('drop policy if exists gf_mfa_aal2 on public.%I', v_tab);
    execute format('create policy gf_mfa_aal2 on public.%I as restrictive for all to authenticated using ((select public.gf_mfa_ok())) with check ((select public.gf_mfa_ok()))', v_tab);
  end loop;
end $$;

revoke all on table public.task_roles, public.task_buttons, public.task_templates from public, anon, authenticated;
grant select, delete on table public.task_roles, public.task_buttons to authenticated;
grant select on table public.task_templates to authenticated;
grant insert (board_id, papel, user_id) on table public.task_roles to authenticated;
grant update (user_id) on table public.task_roles to authenticated;
grant insert (board_id, name, scope, column_id, steps, position) on table public.task_buttons to authenticated;
grant update (name, column_id, steps, position) on table public.task_buttons to authenticated;
-- colunas novas das tabelas da fatia 1 (as permissões antigas continuam valendo)
grant insert (ck_move) on table public.producer_tasks to authenticated;
grant update (ck_move) on table public.producer_tasks to authenticated;
grant update (review_column_id) on table public.task_boards to authenticated; -- a regra task_boards_recibos (2B) já limita ao dono

-- 11. Conferência que aborta (tudo ou nada) ---------------------------------------------------------------------------------------------------
do $$
declare
  v_tab text;
  v_esperado jsonb := jsonb_build_object(
    'task_roles', array['gf_mfa_aal2', 'task_roles_apagar', 'task_roles_criar', 'task_roles_editar', 'task_roles_ver'],
    'task_buttons', array['gf_mfa_aal2', 'task_buttons_apagar', 'task_buttons_criar', 'task_buttons_editar', 'task_buttons_ver'],
    'task_templates', array['gf_mfa_aal2', 'task_templates_ver']);
begin
  for v_tab in select jsonb_object_keys(v_esperado) loop
    if not (select relrowsecurity from pg_class where oid = ('public.' || v_tab)::regclass) then
      raise exception '% sem RLS', v_tab;
    end if;
    if (select array_agg(policyname::text order by policyname::text) from pg_policies
        where schemaname = 'public' and tablename = v_tab)
       is distinct from (select array_agg(x order by x) from jsonb_array_elements_text(v_esperado -> v_tab) x) then
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
  if has_any_column_privilege('authenticated', 'public.task_templates', 'insert,update')
     or has_table_privilege('authenticated', 'public.task_templates', 'delete') then
    raise exception 'authenticated grava em task_templates';
  end if;
  if (select count(*) from public.task_templates) <> 4
     or exists (select 1 from public.task_templates where jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0) then
    raise exception 'sementes dos modelos fora do esperado';
  end if;
  if exists (select 1 from public.task_templates t, jsonb_array_elements(t.items) i
             where i ->> 'papel' <> all (array['portaria', 'divulgacao', 'fornecedores', 'financeiro', 'juridico', 'revisao'])
                or exists (select 1 from jsonb_array_elements_text(i -> 'vinculos') k
                           where k <> all (array['ingresso', 'cupom', 'participantes', 'checkin', 'orcamento', 'financeiro', 'bordero',
                                                 'parceiro', 'crm', 'equipe', 'mapa', 'divulgacao', 'certificados', 'cronograma', 'evento']))) then
    raise exception 'modelo com papel ou atalho fora da lista';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public'
             and (table_name like 'task\_%' or table_name = 'producer_tasks') and column_name ~* '(^|_)ip(_|$)') then
    raise exception 'coluna de IP encontrada (LGPD)';
  end if;
  if has_function_privilege('anon', 'public.quadro_rodar_botao(uuid, uuid)', 'execute')
     or has_function_privilege('anon', 'public.quadro_aplicar_modelo(uuid, text, int[])', 'execute')
     or has_function_privilege('anon', 'public.quadro_gerar_recorrente(uuid)', 'execute')
     or has_function_privilege('anon', 'public.quadro_papeis_sugerir(uuid)', 'execute')
     or has_function_privilege('anon', 'public.quadro_steps_ok(jsonb)', 'execute')
     or not has_function_privilege('authenticated', 'public.quadro_rodar_botao(uuid, uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.quadro_aplicar_modelo(uuid, text, int[])', 'execute')
     or not has_function_privilege('authenticated', 'public.quadro_gerar_recorrente(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.quadro_papeis_sugerir(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.quadro_steps_ok(jsonb)', 'execute') then
    raise exception 'permissão das funções públicas fora do esperado';
  end if;
  if has_function_privilege('authenticated', 'public.quadro_gerar_recorrentes_vencidas()', 'execute')
     or has_function_privilege('anon', 'public.quadro_gerar_recorrentes_vencidas()', 'execute')
     or has_function_privilege('authenticated', 'public.quadro_gerar_recorrente_interno(uuid)', 'execute')
     or has_function_privilege('anon', 'public.quadro_gerar_recorrente_interno(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.quadro_tem_ferramenta(uuid, uuid)', 'execute')
     or has_function_privilege('anon', 'public.quadro_tem_ferramenta(uuid, uuid)', 'execute') then
    raise exception 'função interna executável por authenticated ou anon';
  end if;
  if has_column_privilege('authenticated', 'public.task_boards', 'name', 'update')
     or not has_column_privilege('authenticated', 'public.task_boards', 'review_column_id', 'update')
     or not has_column_privilege('authenticated', 'public.producer_tasks', 'ck_move', 'update') then
    raise exception 'permissão de coluna fora do esperado';
  end if;
  if (select count(*) from pg_trigger where not tgisinternal
      and tgname in ('task_roles_quadro', 'task_buttons_limite', 'task_buttons_quadro', 'task_boards_review', 'task_columns_review',
                     'producer_tasks_quadro_rec', 'producer_tasks_quadro_limite', 'task_checklist_items_ckmove')) <> 8 then
    raise exception 'gatilhos da 2C fora do esperado';
  end if;
  if to_regprocedure('cron.schedule(text, text, text)') is not null then
    if (select count(*) from cron.job where jobname = 'quadro_recorrentes' and schedule = '0 9 * * *') <> 1 then
      raise exception 'cron: job quadro_recorrentes ausente ou com horário errado';
    end if;
  end if;
end $$;

commit;

-- Conferência (só leitura). Esperado: 3 tabelas novas, 4 modelos, quadros com coluna de revisão, 8 gatilhos, job quadro_recorrentes (1 se houver pg_cron).
select 'tabelas novas' as item, count(*)::text as valor from pg_tables where schemaname = 'public'
  and tablename in ('task_roles', 'task_buttons', 'task_templates')
union all
select 'modelos', count(*)::text from public.task_templates
union all
select 'quadros com coluna de revisão', count(*) filter (where review_column_id is not null)::text || ' de ' || count(*)::text from public.task_boards
union all
select 'gatilhos da 2C', count(*)::text from pg_trigger where not tgisinternal
  and tgname in ('task_roles_quadro', 'task_buttons_limite', 'task_buttons_quadro', 'task_boards_review', 'task_columns_review',
                 'producer_tasks_quadro_rec', 'producer_tasks_quadro_limite', 'task_checklist_items_ckmove');
