-- =============================================================================
-- Quadro, fatia F: vários quadros, porta única de permissão por quadro, membros por quadro e modelos de quadro (09/10/2026).
-- Só banco: a tela vem depois. É a mudança MAIS SENSÍVEL do quadro (mexe em quem vê o quê): tratada como segurança. Nada aqui
-- mexe em orders, coupons, ticket_types, preços, saques nem pagamentos. ESTENDE as fatias 1, 2A, 2B e 2C (create or replace de
-- funções, drop/create de regras); nenhum arquivo anterior foi editado.
-- 1) task_boards ganha kind (evento | equipe | pessoal), visibility (pessoal | equipe | escolhidas), description, color, archived_at,
--    template_key, position, created_by e is_default. O índice único task_boards_unico passa a valer SÓ para o quadro padrão (um por
--    produtor+evento, como sempre foi): pode haver quantos quadros extras se quiser. Todo quadro que já existe vira padrão.
-- 2) task_board_members: quem (membro ATIVO do produtor) entra num quadro "pessoas escolhidas", com nível ver | editar. Só funções gravam.
-- 3) quadro_acesso(quadro, pessoa, nível): a ÚNICA porta de permissão. board_pode, task_pode, checklist_pode e comment_pode (2A)
--    passam a delegar a ela; as regras de producer_tasks, task_boards e task_columns (fatia 1), as do Storage (2A), os avisos (2B),
--    botões, modelos de cartão, recorrência e papéis (2C) também. Lista completa abaixo.
-- 4) task_board_templates: modelos de quadro (colunas + cartões iniciais). 8 do sistema (somente leitura) e os do próprio produtor.
-- 5) Funções públicas, com 2FA e a porta DENTRO: quadro_criar, quadro_salvar_como_modelo, quadro_membros_definir, quadro_arquivar,
--    quadro_equipe_lista (só id e nome, NUNCA e-mail).
-- 6) Apagar um evento: só os cartões do quadro PADRÃO dele voltam ao quadro padrão da produtora (que é da equipe toda); os quadros EXTRAS
--    (pessoal, escolhidas, equipe) não somem: desligam-se do evento, com membros, colunas e cartões, e nunca passam a ser vistos por mais gente.
-- 7) Segurança: RLS ligada em toda tabela nova, gf_mfa_aal2 (2FA) restritiva, anon sem nenhum privilégio, authenticated sem escrita direta
--    nas tabelas novas. LGPD: nenhuma coluna de IP nem de e-mail.
--
-- Pré-requisito: a fatia 2C aplicada (20261107_quadro_f2c_botoes_modelos.sql). O bloco 0 aborta com mensagem clara se faltar.
-- Como aplicar: colar o arquivo inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA pelo TextEdit: erro 17). Fora do horário de pico
-- (set local lock_timeout faz desistir sem gravar nada se algo segurar a tabela; rodar de novo). Uma transação só: se a conferência
-- do fim falhar, nada é gravado. Idempotente (as sementes dos modelos do sistema são regravadas a cada rodada; o backfill só toca
-- quadro ainda não migrado). Sem pg_cron novo. O front atual funciona antes e depois deste SQL (o "modo antigo" segue pelo quadro padrão).
-- NÃO mover para supabase/migrations/ (motivo no cabeçalho de 20260927_security_hardening.sql).
-- Teste: supabase/tests/quadro_f2f.test.sql (pgTAP; banco local, nunca em produção). Testes antigos ajustados por causa desta fatia:
--   quadro_f2a.test.sql (conta as regras gf_mfa_aal2 das tabelas task_*: de 20 para 22, as 2 novas) e quadro_f2b.test.sql (o dono não
--   altera mais "o nome" do quadro pela API, porque agora altera; o teste passou a conferir que não altera is_default).
-- ATENÇÃO (SEGURANÇA): reaplicar 20261105, 20261106 ou 20261107 DEPOIS desta pode devolver as versões antigas de board_pode, task_pode,
--   checklist_pode, comment_pode, task_anexo_produtor, quadro_notificar, quadro_rodar_botao, quadro_aplicar_modelo, quadro_gerar_recorrente_interno,
--   quadro_papeis_sugerir, task_roles_tg, task_card_members_tg e task_comments_tg (que só olham a ferramenta quadro): um quadro "pessoal" ou
--   "escolhidas" passaria a aparecer para quem tem a ferramenta. O que de fato acontece (ensaiado no banco local):
--   - 20261106 e 20261107 abortam sozinhas depois desta (nada é regravado);
--   - 20261105 passa SEM erro e devolve as funções antigas da 2A e a lista curta de task_activity_kind_check (sem 'botao', 'modelo',
--     'recorrente', 'checklist_recusado');
--   - rodar ESTE arquivo de novo (é idempotente) restabelece tudo: ele recria as funções, a lista COMPLETA de task_activity_kind_check e as
--     regras/grants de task_comment_receipts e task_card_views (que a 20261105 devolveria com escrita direta).
--   Se alguém reaplicar a 20261105, rodar este arquivo logo em seguida. Reaplicar 20261103 aborta (regras de task_boards) e refaz os grants:
--   não reaplicar.
-- Ensaio antes de aplicar (só leitura): select count(*) from public.task_boards; select count(*) from public.producer_tasks;  -- depois do Run,
--   os totais de tarefas e de quadros têm de ser os mesmos (a conferência do fim aborta se mudarem).
--
-- Desfazer (só depois de voltar o front). Ordem: gatilhos, regras, tabelas, dados/índice/colunas, e só no fim as funções. Só roda com o papel
--   dono das tabelas (supabase_admin no banco local; no editor do Supabase é o papel padrão). Ensaiado em begin/rollback no banco local
--   (o teste faz exatamente isto). Os cartões dos quadros extras NÃO se perdem: vão para o quadro padrão do mesmo evento (ou da produtora);
--   os quadros extras, com colunas, etiquetas, botões, papéis e histórico próprio deles, são apagados.
--   AVISO: o quadro padrão é da EQUIPE (todo mundo com a ferramenta quadro). Os cartões de quadros extras PESSOAIS ou de PESSOAS ESCOLHIDAS,
--   ao desfazer, caem no padrão e passam a ser vistos por toda a equipe. Antes de desfazer, o dono deve olhar esses quadros e decidir (apagar
--   ou mover os cartões sensíveis à mão).
--   drop trigger if exists team_members_quadro_sai on public.team_members;
--   drop trigger if exists team_members_quadro_sai_upd on public.team_members;
--   drop trigger if exists task_board_members_quadro on public.task_board_members;
--   drop trigger if exists task_board_templates_limite on public.task_board_templates;
--   drop trigger if exists task_boards_limite on public.task_boards;
--   drop trigger if exists task_boards_guarda on public.task_boards;
--   drop trigger if exists task_boards_visib on public.task_boards;
--   drop policy if exists tasks_ver on public.producer_tasks;
--   drop policy if exists tasks_criar on public.producer_tasks;
--   drop policy if exists tasks_editar on public.producer_tasks;
--   create policy tasks_ver on public.producer_tasks as permissive for select to authenticated
--     using (public.equipe_pode(producer_id, 'quadro', 'ver'));
--   create policy tasks_criar on public.producer_tasks as permissive for insert to authenticated
--     with check (public.equipe_pode(producer_id, 'quadro', 'editar'));
--   create policy tasks_editar on public.producer_tasks as permissive for update to authenticated
--     using (public.equipe_pode(producer_id, 'quadro', 'editar')) with check (public.equipe_pode(producer_id, 'quadro', 'editar'));
--   drop policy if exists task_boards_ver on public.task_boards;
--   create policy task_boards_ver on public.task_boards as permissive for select to authenticated
--     using (public.equipe_pode(producer_id, 'quadro', 'ver'));
--   drop policy if exists task_columns_ver on public.task_columns;
--   drop policy if exists task_columns_criar on public.task_columns;
--   drop policy if exists task_columns_editar on public.task_columns;
--   create policy task_columns_ver on public.task_columns as permissive for select to authenticated
--     using (exists (select 1 from public.task_boards b where b.id = board_id and public.equipe_pode(b.producer_id, 'quadro', 'ver')));
--   create policy task_columns_criar on public.task_columns as permissive for insert to authenticated
--     with check (exists (select 1 from public.task_boards b where b.id = board_id and public.equipe_pode(b.producer_id, 'quadro', 'editar')));
--   create policy task_columns_editar on public.task_columns as permissive for update to authenticated
--     using (exists (select 1 from public.task_boards b where b.id = board_id and public.equipe_pode(b.producer_id, 'quadro', 'editar')))
--     with check (exists (select 1 from public.task_boards b where b.id = board_id and public.equipe_pode(b.producer_id, 'quadro', 'editar')));
--   drop policy if exists task_anexos_select on storage.objects;
--   create policy task_anexos_select on storage.objects as permissive for select to authenticated
--     using (bucket_id = 'task-attachments' and public.equipe_pode(public.task_anexo_produtor(name), 'quadro', 'ver'));
--   drop policy if exists task_anexos_insert on storage.objects;
--   create policy task_anexos_insert on storage.objects as permissive for insert to authenticated
--     with check (bucket_id = 'task-attachments' and public.equipe_pode(public.task_anexo_produtor(name), 'quadro', 'editar'));
--   drop policy if exists task_anexos_delete on storage.objects;
--   create policy task_anexos_delete on storage.objects as permissive for delete to authenticated
--     using (bucket_id = 'task-attachments' and public.equipe_pode(public.task_anexo_produtor(name), 'quadro', 'editar'));
--   drop table if exists public.task_board_members, public.task_board_templates;
--   select public.quadro_criar_interno(x.producer_id, x.event_id) from (select distinct producer_id, event_id from public.task_boards where not is_default) x;
--   update public.producer_tasks t set board_id = d.id, column_id = null
--     from public.task_boards b join public.task_boards d on d.producer_id = b.producer_id and d.event_id is not distinct from b.event_id and d.is_default
--     where t.board_id = b.id and not b.is_default;
--   delete from public.task_boards where not is_default;
--   alter table public.task_boards drop constraint if exists task_boards_nome_ck, drop constraint if exists task_boards_descricao_ck,
--     drop constraint if exists task_boards_kind_evento_ck, drop constraint if exists task_boards_pessoal_ck, drop constraint if exists task_boards_template_ck;
--   drop index if exists public.task_boards_unico;
--   drop index if exists public.task_boards_produtor_idx;
--   create unique index task_boards_unico on public.task_boards (producer_id, (coalesce(event_id, '00000000-0000-0000-0000-000000000000'::uuid)));
--   alter table public.task_boards drop column if exists kind, drop column if exists visibility, drop column if exists description, drop column if exists color,
--     drop column if exists archived_at, drop column if exists template_key, drop column if exists position, drop column if exists created_by,
--     drop column if exists is_default;
-- Funções antigas a restaurar (copiar, SEM mudar, o bloco "create or replace function public.<nome> ... $$;" de cada arquivo):
--   20261103_equipe_quadro_f01.sql: quadro_criar_interno, producer_tasks_quadro_tg, events_quadro_antes_apagar_tg (create or replace mantém os privilégios:
--     as 2 de gatilho seguem sem EXECUTE para authenticated, o que é melhor que na 1103)
--   (task_activity_kind_check continua com a lista COMPLETA ao desfazer: a da 2C; não voltar à curta da 2A)
--   20261105_quadro_f2a_cartao.sql: board_pode, task_pode, checklist_pode, comment_pode, task_card_members_tg, task_comments_tg, task_anexo_produtor
--   20261106_quadro_f2b_notificacoes.sql: quadro_notificar
--   20261107_quadro_f2c_botoes_modelos.sql: task_roles_tg, quadro_rodar_botao, quadro_aplicar_modelo, quadro_gerar_recorrente_interno, quadro_papeis_sugerir
-- (o teste supabase/tests/quadro_f2f.test.sql restaura exatamente esses blocos, tirados dos arquivos, e confere o resultado).
--   drop function if exists public.quadro_criar(text, text, uuid, text, text, jsonb), public.quadro_salvar_como_modelo(uuid, text, boolean),
--     public.quadro_membros_definir(uuid, text, jsonb), public.quadro_arquivar(uuid, boolean), public.quadro_equipe_lista(),
--     public.quadro_membros_validar(uuid, jsonb), public.task_anexo_pode(text, text), public.quadro_acesso(uuid, uuid, text),
--     public.quadro_acesso_direto(uuid, uuid, text), public.quadro_equipe_ativa(uuid, uuid), public.quadro_nome_padrao(uuid),
--     public.quadro_texto_ok(text, int, int), public.quadro_limpar_texto(text, int), public.quadro_modelo_ok(jsonb, jsonb),
--     public.team_members_quadro_sai_tg(),
--     public.quadro_modelo_carta_ok(jsonb, int), public.quadro_modelo_coluna_ok(jsonb), public.task_board_members_tg(),
--     public.task_boards_limite_tg(), public.task_boards_guarda_tg(), public.task_boards_visib_tg(), public.task_board_templates_limite_tg();
--
-- DECISÕES
-- 1. Duas portas. quadro_acesso_direto(quadro, pessoa, nível) é INTERNA (ninguém de fora a executa) e responde por QUALQUER pessoa, consultando
--    as tabelas direto: é a que avisos, papéis e cópia recorrente usam para o DESTINATÁRIO (a guarda de equipe_pode só responde por outra
--    pessoa a quem edita, e no cron não há login). quadro_acesso(quadro, pessoa, nível) é a PÚBLICA, usada pelas regras (RLS): quadro
--    inexistente ou pessoa nula => falso; anti-oráculo: perguntar por OUTRA pessoa só responde de verdade a quem EDITA o quadro, senão falso.
--    Revogada de public e anon; só authenticated executa. 'editar' vale como 'ver'; qualquer outro nível conta como 'ver' (como equipe_pode).
-- 2. Quem tem acesso a um quadro: o DONO (task_boards.producer_id) sempre. Os demais, só se forem membros ATIVOS do produtor (team_members
--    aceito e não bloqueado, consulta direta), e então: 'pessoal' => ninguém; 'equipe' => ferramenta quadro em team_member_tools (ver/editar);
--    'escolhidas' => linha em task_board_members com o nível (NÃO exige a ferramenta quadro; quem tem a ferramenta mas não está na lista não
--    vê). Quem sai da equipe ou é bloqueado perde o acesso na hora (e as linhas dele nas listas são apagadas por gatilho: ver 12b). Quadro arquivado segue legível por quem tinha acesso.
-- 3. Quadro padrão (is_default): é o que a fatia 1 sempre criou (um por produtor+evento; event_id nulo = quadro da produtora). Fica
--    sempre 'equipe' e não se arquiva (gatilho + função); quadro_criar_interno, quadro_garantir e o gatilho de producer_tasks (cartão sem
--    quadro) continuam funcionando: o ON CONFLICT casa com o índice parcial e o cartão sem quadro cai SEMPRE no padrão do evento.
-- 4. Backfill: quadro sem autor e ainda não padrão vira padrão, kind 'evento' (event_id) ou 'equipe', visibility 'equipe', nome
--    "Quadro do evento <título>" (título sem < >, controle e bidi, cortado para caber em 40) ou "Quadro da equipe". Quadro criado depois
--    por quadro_criar tem created_by e nunca é renomeado por este bloco.
-- 5. CHECKs: nome 1..40, descrição até 200 (quadro_texto_ok: sem < >, controle nem bidi); (kind = 'evento') = (event_id não nulo); kind
--    'pessoal' exige visibilidade 'pessoal'. Cor: violeta, azul, verde ou marinho. Teto de 30 quadros por produtor, ARQUIVADOS inclusos, por
--    gatilho com trava (pg_advisory_xact_lock, chave 'quadro:'||id, sem nome de tabela); o quadro PADRÃO, criado pelo sistema (um por
--    evento), não conta no teto, senão quem tem muitos eventos ficaria sem poder abrir um quadro.
-- 6. Escrita: task_boards não tem INSERT nem DELETE para authenticated (só quadro_criar e o sistema); o dono atualiza name, description,
--    color, archived_at (a hora é do banco) e visibility por grant de coluna, na regra task_boards_recibos da 2B (producer_id = auth.uid(),
--    que segue com esse nome histórico); kind, is_default, created_by, template_key e position nunca. Sair de 'escolhidas' (por função
--    ou por update) apaga a lista de pessoas, para ela não ressuscitar. task_board_members e task_board_templates: só SELECT; toda escrita
--    é por função (gatilhos validam de novo, por SQL também): membro tem de ser o dono ou ativo no produtor; teto de 50 pessoas por quadro e
--    de 20 modelos por produtor.
-- 7. Modelos de quadro (quadro_modelo_ok): colunas 2..12 {name 1..40, kind todo|doing|done}, ao menos uma todo e uma done; cartões até 60
--    {titulo 1..120, coluna (índice), papel?, dias -365..365?, vinculos? (lista fechada de task_links)}; sem HTML. As 8 sementes do sistema
--    pedidas: nenhum cartão inicial nasce em coluna de andamento ou concluída (nasceria com status errado), e o financeiro é só
--    acompanhamento (o sistema NUNCA paga nada). as 8 foram copiadas do protótipo (nome, descrição, colunas, títulos e prazos; evento_completo com os 9 cartões, o último com prazo -2); papéis: ver o comentário das sementes. Chave de modelo do
--    produtor: 'meu_' + 32 hex. quadro_salvar_como_modelo ganhou um 3º parâmetro, p_cartoes (padrão falso): o pedido dizia "cartões
--    (opcional)" e a assinatura só tinha dois; só título e coluna vão (sem membros, datas, papéis, vínculos, comentários nem anexos).
-- 8. quadro_criar: só quem chama vira dono; 'evento' exige evento do produtor (inexistente e alheio dão a mesma resposta); os outros tipos
--    NÃO levam evento; 'pessoal' força visibilidade 'pessoal'; a lista de pessoas só vale em 'escolhidas' (nas outras é ignorada, o que
--    dá menos acesso, nunca mais) e o dono na lista é ignorado; modelo nulo = A fazer / Em andamento / Feito; prazo do cartão = data do
--    evento menos os dias (se já passou, hoje); sem data do evento o prazo é ignorado e start_date NÃO é usado; o papel do cartão não grava
--    pessoa (papéis ficam sem pessoa); vínculos viram task_links; a coluna "Em revisão" vira a de revisão pelo gatilho da 2C; histórico: uma
--    linha 'modelo' (origem quadro_criar) no task_activity, sem tipo novo.
-- 9. Validação de PESSOA (responsável, membro do cartão, menção): estes três gatilhos (producer_tasks_quadro_tg, task_card_members_tg e
--    task_comments_tg) conferiam com equipe_pode(..., outra pessoa), cuja guarda só deixa responder quem edita a FERRAMENTA quadro do
--    produtor; com quadros 'escolhidas', um editor sem a ferramenta não conseguiria atribuir nem mencionar ninguém. Passam a usar
--    quadro_equipe_ativa (consulta direta: dono ou membro ativo, a mesma regra de antes) e só validam quando quem grava EDITA o quadro; os
--    demais saem (return new) e a RLS recusa com 42501, sem revelar quem é da equipe. Pessoa sem a ferramenta continua podendo ser membro do
--    cartão (comportamento da 2B), só não recebe aviso nem abre o quadro.
-- 10. Avisos e crons: quadro_notificar só entrega a quem tem acesso 'ver' ao QUADRO do cartão (consulta direta). Isso cobre atribuição,
--    menção, mensagem, movido, automação (botão) e o cron de prazos (quadro_avisar_prazos não mudou: passa por quadro_notificar). O cron de
--    recorrência (quadro_gerar_recorrentes_vencidas, que não mudou) usa quadro_gerar_recorrente_interno: responsável e membros da cópia só se
--    ainda têm acesso ao quadro (a cópia fica no MESMO quadro, nada sai de um quadro pessoal); quadro ARQUIVADO não gera cópia e o original só
--    avança a data. Botão (passos atribuir/avisar), modelo de cartão (papel) e papéis (gatilho e sugestão) conferem o acesso AO QUADRO.
-- 11. Storage (2A): as 3 regras do bucket task-attachments usam task_anexo_pode(nome, nível), que só devolve verdadeiro/falso (sem oráculo) e
--    olha o quadro do cartão do 2º segmento do caminho; task_anexo_produtor só revela o produtor a quem vê o cartão.
-- 12. Apagar evento (f01, revisado): os cartões do quadro PADRÃO do evento voltam ao padrão da produtora e só então ele some em cascata. Os
--    quadros EXTRAS não somem: ficam sem evento (event_id nulo; 'evento' vira 'equipe'), com visibilidade, membros, colunas e cartões, para
--    nada de pessoal ou de pessoas escolhidas ir parar num quadro visível à equipe toda. O histórico dos cartões movidos acompanha (2A).
-- 12b. Saída da equipe: apagar, bloquear ou desaceitar um membro (team_members) apaga as linhas dele em task_board_members dos quadros desse
--    produtor (gatilho team_members_quadro_sai); readmitido, não volta a ver nada sozinho.
-- 12c. Porta: quadro_acesso_direto e quadro_acesso são VOLATILE (enxergam o quadro padrão criado pelo gatilho na mesma instrução do primeiro
--    cartão); quadro_acesso exige 2FA (gf_mfa_ok) e recusa token logado sem identidade. Gatilho de producer_tasks: quadro inexistente e alheio
--    dão a mesma mensagem da regra (RLS).
-- 13. Mensagens de erro em português; SQLSTATE: 42501 permissão, 22023 parâmetro inválido, 23514 teto ou regra de dados.
--
-- O QUE MIGROU PARA A PORTA (e o que ficou de propósito)
--   Políticas (fatia 1): producer_tasks tasks_ver, tasks_criar, tasks_editar (pelo board_id da linha; linha sem board_id = regra de antes);
--     task_boards_ver; task_columns_ver, task_columns_criar, task_columns_editar.
--   Funções 2A: board_pode, task_pode, checklist_pode, comment_pode (levam consigo, sem mudar de nome: task_labels, task_card_labels,
--     task_card_members, task_watchers, task_checklists, task_checklist_items, task_links, task_dependencies, task_attachments, task_comments,
--     task_comment_receipts, task_card_views e task_activity (todas as regras), task_limite_tg, task_recibos_ligados, quadro_marcar_entregue,
--     quadro_marcar_lido, task_roles_*/task_buttons_* (regras e gatilhos que chamam board_pode)); task_anexo_produtor e as 3 regras do Storage
--     (via task_anexo_pode).
--   Gatilhos de pessoa: producer_tasks_quadro_tg (responsável), task_card_members_tg, task_comments_tg (menções): ver DECISÃO 9.
--   2B: quadro_notificar (destinatário). Pelo caminho dele: quadro_avisar_prazos e os gatilhos de aviso.
--   2C: task_roles_tg, quadro_rodar_botao, quadro_aplicar_modelo, quadro_gerar_recorrente_interno, quadro_papeis_sugerir.
--   Ficaram DE PROPÓSITO: equipe_pode (base: cartão sem quadro do modo antigo, ferramenta quadro, quadro_garantir); quadro_garantir (só devolve
--     o quadro padrão, que é sempre 'equipe'); tasks_apagar (só o dono do produtor apaga cartão: mais estrito, vale para todo quadro);
--     task_columns_apagar (só o dono do quadro); team_member_tools_dono; task_boards_recibos (update do dono); task_templates (modelos de
--     CARTÃO da 2C: textos fixos, sem dado de ninguém); quadro_tem_ferramenta (2C) ficou SEM USO: não usar para decidir acesso a quadro,
--     só quadro_acesso/quadro_acesso_direto; quadro_gerar_recorrentes_vencidas e quadro_avisar_prazos (passam pelas funções acima).
--
-- LIMITES CONHECIDOS
-- (a) Avisos que a pessoa JÁ recebeu antes de perder o acesso continuam no sino dela (só o título do cartão, entre aspas); o que muda é
--     que nenhum aviso novo chega e o link não abre mais nada. Apagá-los é decisão (Pendências).
-- (b) Quem perde o acesso continua gravado como membro do cartão, observador, papel, recibo e "visto por": sem efeito (nenhum aviso, nenhum
--     acesso, e os botões e a cópia recorrente pulam a pessoa), mas as linhas ficam. O cron de prazos ainda registra a linha de
--     task_prazo_avisos para esses membros (não entrega aviso).
-- (c) Qualquer conta logada pode criar quadros PRÓPRIOS (até 30), como já podia criar tarefas próprias; a lista de pessoas só aceita
--     a equipe ativa do próprio produtor.
-- (d) Não há função para apagar quadro nem modelo próprio: quadro só arquiva (e o teto de 30 conta arquivados) e o teto de 20 modelos não
--     tem saída. Sugestão para a F2 se o front precisar; não criei porque não foi pedido.
-- (e) Quadro arquivado ainda recebe avisos de prazo dos cartões abertos dele (só a recorrência para).
-- (f) O front antigo que lê task_boards por produtor+evento esperando UMA linha pode ver mais de uma quando existirem quadros extras no
--     evento: filtrar por is_default = true (a F2 resolve). quadro_garantir devolve sempre o padrão.
-- (g) Os crons 'quadro_prazos' e 'quadro_recorrentes' já existem (2B e 2C); este arquivo não os mexe. A conferência real no pg_cron
--     continua sendo a das fatias dele.
-- (h) Desempenho: as regras de producer_tasks chamam a porta uma vez por cartão lido (3 consultas por índice cada); NÃO medido
--     com volume real. Se a lista de um quadro com milhares de cartões ficar lenta, trocar por uma subconsulta única.
-- (j) Quem EDITA um quadro (inclusive só de pessoas escolhidas, sem a ferramenta quadro) ao escolher um responsável (assigned_to) recebe
--     um erro diferente se a pessoa não é da equipe ativa do produtor: dá para sondar, com ids de usuário já conhecidos, quem é da equipe.
--     Não restringi a "membros do próprio quadro" porque isso muda a regra da fatia 1 (qualquer pessoa ativa da equipe pode ser responsável,
--     mesmo sem a ferramenta). Decisão do Ricardo (Pendências): aceitar o limite ou restringir.
-- (k) Quadro ARQUIVADO ainda aceita gravação (cartões, colunas, comentários) de quem tem acesso de edição: arquivar só o tira da lista e para a
--     recorrência. Não mudei de propósito. DECISÃO EM ABERTO do Ricardo: arquivado deve ser somente leitura?
-- (l) Papéis dos modelos de quadro: o protótipo usa Produção, Operação, Comunicação, Atendimento, Gestão e Financeiro; o banco só tem portaria,
--     divulgacao, fornecedores, financeiro, juridico e revisao. Só Financeiro foi mapeado; os modelos não trazem os outros papéis nem vínculos.
--     DECISÃO EM ABERTO do Ricardo: o mapeamento (ou ampliar a lista do banco).
-- (i) Contagens de teto são garantidas por trava só entre gravações do mesmo produtor/quadro; duas transações do MESMO produtor
--     criando o 30º quadro ao mesmo tempo esperam uma pela outra (nenhuma passa do teto).
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- 0. Pré-requisitos -----------------------------------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.task_buttons') is null or to_regclass('public.task_roles') is null or to_regclass('public.task_templates') is null then
    raise exception 'Falta a fatia 2C do quadro (task_buttons, task_roles, task_templates): aplicar 20261107_quadro_f2c_botoes_modelos.sql antes';
  end if;
  if to_regprocedure('public.quadro_rodar_botao(uuid, uuid)') is null or to_regprocedure('public.quadro_aplicar_modelo(uuid, text, int[])') is null
     or to_regprocedure('public.quadro_gerar_recorrente_interno(uuid)') is null or to_regprocedure('public.quadro_papeis_sugerir(uuid)') is null
     or to_regprocedure('public.task_roles_tg()') is null then
    raise exception 'Faltam funções da 2C (quadro_rodar_botao, quadro_aplicar_modelo...): aplicar 20261107_quadro_f2c_botoes_modelos.sql antes';
  end if;
  if to_regprocedure('public.quadro_notificar(uuid, uuid, text, text, uuid)') is null then
    raise exception 'Falta public.quadro_notificar (20261106_quadro_f2b_notificacoes.sql): aplicar antes';
  end if;
  if to_regprocedure('public.board_pode(uuid, text)') is null or to_regprocedure('public.task_pode(uuid, text)') is null
     or to_regprocedure('public.task_anexo_produtor(text)') is null or to_regprocedure('public.task_log(uuid, uuid, text, jsonb)') is null then
    raise exception 'Falta a fatia 2A do quadro (board_pode, task_pode, task_anexo_produtor, task_log): aplicar 20261105_quadro_f2a_cartao.sql antes';
  end if;
  if to_regprocedure('public.equipe_pode(uuid, text, text, uuid)') is null or to_regprocedure('public.quadro_criar_interno(uuid, uuid)') is null then
    raise exception 'Falta a fatia 1 do quadro (equipe_pode, quadro_criar_interno): aplicar 20261103_equipe_quadro_f01.sql antes';
  end if;
  if to_regproc('public.gf_mfa_ok') is null then
    raise exception 'Falta public.gf_mfa_ok (20260930_2fa_no_banco.sql): aplicar antes';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'task_boards' and column_name = 'review_column_id') then
    raise exception 'Falta task_boards.review_column_id (20261107_quadro_f2c_botoes_modelos.sql): aplicar antes';
  end if;
end $$;

create temp table _f2f_antes on commit drop as
  select (select count(*) from public.producer_tasks) as tarefas, (select count(*) from public.task_boards) as quadros;

-- 1. Texto: validação e limpeza (imutáveis) -----------------------------------------------------------------------------------
-- Sem < >, sem caracteres de controle e sem formatação bidirecional (mesma regra do nome de botão da 2C). O CHECK roda com o
-- papel de quem grava: quadro_texto_ok precisa de EXECUTE para authenticated (nome do quadro é editado pelo dono).
create or replace function public.quadro_texto_ok(p text, p_min int, p_max int)
returns boolean language sql immutable set search_path = '' as $$
  select p is not null and char_length(p) between p_min and p_max and char_length(btrim(p)) >= p_min
    and p !~ '[<>]' and p !~ '[[:cntrl:]]' and p !~ '[‪-‮⁦-⁩]'
    and p !~ '[\u200B-\u200F\u061C\uFEFF\u2060\u3164\u00AD\u2028\u2029\u115F\u1160\u180E]' -- invisíveis (largura zero, direção, BOM, word joiner, hangul fillers, hífen suave, separadores de linha): o nome pareceria vazio
$$;
-- Interna: tira o que quadro_texto_ok recusa e corta (usada em nomes que vêm de outros textos: evento, cartão, coluna).
create or replace function public.quadro_limpar_texto(p text, p_max int)
returns text language sql immutable set search_path = '' as $$
  select btrim(left(btrim(regexp_replace(coalesce(p, ''), '[<>[:cntrl:]‪-‮⁦-⁩\u200B-\u200F\u061C\uFEFF\u2060\u3164\u00AD\u2028\u2029\u115F\u1160\u180E]', '', 'g')), p_max))
$$;
-- Interna: nome do quadro padrão (o que a fatia 1 cria). Cabe em 40 caracteres.
create or replace function public.quadro_nome_padrao(p_evento uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare v text;
begin
  if p_evento is null then return 'Quadro da equipe'; end if;
  select public.quadro_limpar_texto(e.title, 23) into v from public.events e where e.id = p_evento;
  return case when coalesce(v, '') = '' then 'Quadro do evento' else 'Quadro do evento ' || v end;
end $$;

-- 2. task_boards: colunas novas -------------------------------------------------------------------------------------------------
alter table public.task_boards add column if not exists kind text not null default 'equipe' check (kind in ('evento', 'equipe', 'pessoal'));
alter table public.task_boards add column if not exists visibility text not null default 'equipe' check (visibility in ('pessoal', 'equipe', 'escolhidas'));
alter table public.task_boards add column if not exists description text;
alter table public.task_boards add column if not exists color text check (color in ('violeta', 'azul', 'verde', 'marinho'));
alter table public.task_boards add column if not exists archived_at timestamptz;
alter table public.task_boards add column if not exists template_key text;
alter table public.task_boards add column if not exists position numeric;
alter table public.task_boards add column if not exists created_by uuid references public.profiles (id) on delete set null;
alter table public.task_boards add column if not exists is_default boolean not null default false;

-- Backfill: todo quadro que já existe é o quadro padrão (um por produtor+evento, como sempre foi). Só toca quem ainda não foi
-- migrado (is_default falso e sem autor); quadro criado depois por quadro_criar tem created_by e nunca é renomeado aqui.
update public.task_boards b set is_default = true, kind = case when b.event_id is null then 'equipe' else 'evento' end,
    visibility = 'equipe', name = public.quadro_nome_padrao(b.event_id)
  where not b.is_default and b.created_by is null;

alter table public.task_boards drop constraint if exists task_boards_nome_ck;
alter table public.task_boards add constraint task_boards_nome_ck check (public.quadro_texto_ok(name, 1, 40));
alter table public.task_boards drop constraint if exists task_boards_descricao_ck;
alter table public.task_boards add constraint task_boards_descricao_ck check (description is null or public.quadro_texto_ok(description, 0, 200));
alter table public.task_boards drop constraint if exists task_boards_kind_evento_ck;
alter table public.task_boards add constraint task_boards_kind_evento_ck check ((kind = 'evento') = (event_id is not null));
alter table public.task_boards drop constraint if exists task_boards_pessoal_ck;
alter table public.task_boards add constraint task_boards_pessoal_ck check (kind <> 'pessoal' or visibility = 'pessoal');
alter table public.task_boards drop constraint if exists task_boards_template_ck;
alter table public.task_boards add constraint task_boards_template_ck check (template_key is null or template_key ~ '^[a-z0-9_-]{1,40}$');

-- O índice único agora vale só para o quadro padrão (um por produtor+evento); os demais são livres. event_id nulo = quadro
-- da produtora (nulo não conflita num índice comum: daí o coalesce).
drop index if exists public.task_boards_unico;
create unique index task_boards_unico
  on public.task_boards (producer_id, (coalesce(event_id, '00000000-0000-0000-0000-000000000000'::uuid))) where is_default;
create index if not exists task_boards_produtor_idx on public.task_boards (producer_id, archived_at, position);

-- Tipos do histórico: a lista COMPLETA (2A + 2C). Reaplicar a 20261105 depois deste arquivo regrava a lista curta da 2A; rodar este arquivo
-- de novo a restabelece (por isso ela mora aqui também, e não só na 2C).
alter table public.task_activity drop constraint if exists task_activity_kind_check;
alter table public.task_activity add constraint task_activity_kind_check
  check (kind in ('criado', 'movido', 'arquivado', 'desarquivado', 'comentario', 'comentario_apagado', 'anexo',
                  'botao', 'modelo', 'recorrente', 'checklist_recusado'));

-- 3. A porta única de permissão -------------------------------------------------------------------------------------------------
-- Interna (sem anti-oráculo, consulta direta nas tabelas): responde por QUALQUER pessoa. Usada por funções e gatilhos que
-- decidem sobre o DESTINATÁRIO (avisos, papéis, cópia recorrente), onde a guarda de equipe_pode (só responde por outra pessoa a
-- quem edita) e a ausência de login (cron) atrapalhariam. Ninguém de fora a executa.
-- VOLATILE de propósito (as duas portas): uma função STABLE só enxerga o que existia quando a instrução começou, e o gatilho de
-- producer_tasks cria o quadro padrão NA MESMA instrução do primeiro cartão; a regra de inserir (tasks_criar) o recusaria. Volátil enxerga
-- o que a própria instrução já gravou, sem abrir exceção nenhuma na regra (nenhum caminho "board_id nulo" que ignore a visibilidade).
create or replace function public.quadro_acesso_direto(p_board uuid, p_user uuid, p_nivel text)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare v_b record;
begin
  if p_board is null or p_user is null then return false; end if;
  select b.producer_id, b.visibility into v_b from public.task_boards b where b.id = p_board;
  if not found then return false; end if;
  if v_b.producer_id = p_user then return true; end if;
  -- o resto só vale para membro ATIVO do produtor (aceito e não bloqueado)
  if not exists (select 1 from public.team_members m where m.producer_id = v_b.producer_id and m.user_id = p_user
                 and m.accepted_at is not null and m.blocked_at is null) then
    return false;
  end if;
  if v_b.visibility = 'equipe' then
    return exists (select 1 from public.team_members m join public.team_member_tools t on t.member_id = m.id
      where m.producer_id = v_b.producer_id and m.user_id = p_user and t.ferramenta = 'quadro'
        and (t.nivel = 'editar' or p_nivel is distinct from 'editar'));
  elsif v_b.visibility = 'escolhidas' then
    return exists (select 1 from public.task_board_members x where x.board_id = p_board and x.user_id = p_user
      and (x.nivel = 'editar' or p_nivel is distinct from 'editar'));
  end if;
  return false; -- 'pessoal': só o dono
end $$;

-- Pública: a ÚNICA porta que as regras (RLS) e as funções usam. 'editar' vale como 'ver'. Anti-oráculo: perguntar por OUTRA pessoa
-- só responde de verdade a quem edita o quadro; para os demais, falso (não se descobre quem é de qual quadro).
create or replace function public.quadro_acesso(p_board uuid, p_user uuid, p_nivel text)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if p_board is null or p_user is null then return false; end if;
  -- 2FA dentro da porta (as regras do Storage e as funções também passam por aqui, onde a regra restritiva da tabela não vale) e
  -- conta logada sem identidade (token sem sub): nunca responde. Dentro desta função o current_user é o dono, não o chamador:
  -- o papel do chamador vem do token (auth.role()); rotinas do banco (sem token) seguem sem login, como as outras portas.
  if v_uid is not null and not (select public.gf_mfa_ok()) then return false; end if;
  if v_uid is null and (select auth.role()) = 'authenticated' then return false; end if;
  if v_uid is not null and p_user <> v_uid and not public.quadro_acesso_direto(p_board, v_uid, 'editar') then
    return false;
  end if;
  return public.quadro_acesso_direto(p_board, p_user, p_nivel);
end $$;

-- 2A: as quatro funções que as regras do cartão usam (mesmas assinaturas e nomes) passam a delegar à porta. Cartão SEM quadro
-- (modo antigo, gatilho da fatia 1 desligado) segue pela regra de antes.
create or replace function public.board_pode(p_board uuid, p_nivel text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.quadro_acesso(p_board, (select auth.uid()), p_nivel)
$$;
create or replace function public.task_pode(p_task uuid, p_nivel text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.producer_tasks t where t.id = p_task
    and case when t.board_id is not null then public.quadro_acesso(t.board_id, (select auth.uid()), p_nivel)
             else public.equipe_pode(t.producer_id, 'quadro', p_nivel) end)
$$;
create or replace function public.checklist_pode(p_checklist uuid, p_nivel text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  return exists (select 1 from public.task_checklists c join public.producer_tasks t on t.id = c.task_id
                 where c.id = p_checklist
                   and case when t.board_id is not null then public.quadro_acesso(t.board_id, (select auth.uid()), p_nivel)
                            else public.equipe_pode(t.producer_id, 'quadro', p_nivel) end);
end $$;
create or replace function public.comment_pode(p_comment uuid, p_nivel text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  return exists (select 1 from public.task_comments c join public.producer_tasks t on t.id = c.task_id
                 where c.id = p_comment
                   and case when t.board_id is not null then public.quadro_acesso(t.board_id, (select auth.uid()), p_nivel)
                            else public.equipe_pode(t.producer_id, 'quadro', p_nivel) end);
end $$;

-- 3b. Gatilhos que validam uma PESSOA (responsável, membro do cartão, menção): a pessoa precisa ser do dono ou membro ATIVO da equipe
-- do produtor (como sempre foi; quem não tem a ferramenta quadro continua podendo ser membro do cartão, só não recebe aviso nem
-- abre o quadro). A consulta é direta (quadro_equipe_ativa), porque a guarda de equipe_pode só responde por OUTRA pessoa a quem
-- edita a ferramenta quadro do produtor, e quem edita só um quadro 'escolhidas' (sem a ferramenta) ficaria sem poder atribuir nem
-- mencionar ninguém. Como a consulta direta não tem essa guarda, cada gatilho só valida quando quem grava pode EDITAR o quadro; os
-- demais saem (return new) e a RLS recusa com a mesma mensagem 42501, sem revelar quem é da equipe. Sem login (rotinas) tudo é validado.
create or replace function public.quadro_equipe_ativa(p_produtor uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_user is not null and p_produtor is not null and (p_user = p_produtor or exists (
    select 1 from public.team_members m where m.producer_id = p_produtor and m.user_id = p_user
      and m.accepted_at is not null and m.blocked_at is null))
$$;
create or replace function public.producer_tasks_quadro_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_board public.task_boards;
  v_col public.task_columns;
  v_kind text;
begin
  if new.board_id is null then
    new.board_id := public.quadro_criar_interno(new.producer_id, new.event_id);
    new.column_id := null;
  end if;
  select * into v_board from public.task_boards b where b.id = new.board_id;
  -- quadro inexistente e quadro de outro produtor: a MESMA mensagem que a regra (RLS) dá para quadro existente sem permissão, para quem
  -- grava não descobrir pelo texto do erro que quadro existe (o gatilho roda antes da regra). Mesmo SQLSTATE 42501.
  if not found or v_board.producer_id <> new.producer_id then
    raise exception 'new row violates row-level security policy for table "producer_tasks"' using errcode = '42501';
  end if;
  new.event_id := v_board.event_id;

  -- Responsável tem de ser o dono ou membro ativo, mas só quando é escolhido agora: uma tarefa antiga cujo responsável
  -- saiu da equipe continua editável (status, título...) sem trocar o responsável.
  if new.assigned_to is not null and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to)
     and ((select auth.uid()) is null or public.quadro_acesso_direto(new.board_id, (select auth.uid()), 'editar'))
     and not public.quadro_equipe_ativa(new.producer_id, new.assigned_to) then
    raise exception 'O responsável não é da equipe deste produtor.' using errcode = '42501';
  end if;

  if new.column_id is not null then
    -- quem grava sem poder editar este quadro recebe a mesma mensagem da regra (RLS) ANTES de qualquer checagem de coluna: a mensagem
    -- de coluna não pode revelar que o quadro existe. Rotinas sem login seguem adiante (e a regra do apagar evento também, sem coluna).
    if (select auth.uid()) is not null and not public.quadro_acesso_direto(new.board_id, (select auth.uid()), 'editar') then
      raise exception 'new row violates row-level security policy for table "producer_tasks"' using errcode = '42501';
    end if;
    select * into v_col from public.task_columns c where c.id = new.column_id;
    if not found or v_col.board_id <> new.board_id then
      raise exception 'Coluna de outro quadro.' using errcode = '42501';
    end if;
  end if;

  if new.column_id is null
     or (tg_op = 'UPDATE' and new.column_id is not distinct from old.column_id and new.status is distinct from old.status) then
    -- sem coluna (INSERT sem coluna, ou tarefa que mudou de quadro) ou só o status mudou (tela antiga):
    -- primeira coluna do tipo do status
    v_kind := case new.status when 'in_progress' then 'doing' when 'done' then 'done' else 'todo' end;
    select c.id into new.column_id from public.task_columns c
      where c.board_id = new.board_id and c.kind = v_kind order by c.position limit 1;
    if new.column_id is null then raise exception 'O quadro não tem coluna do tipo %.', v_kind; end if;
  elsif tg_op = 'INSERT' or new.column_id is distinct from old.column_id then
    new.status := case v_col.kind when 'doing' then 'in_progress' else v_col.kind end;
  end if;

  if new.position is null or (tg_op = 'UPDATE' and new.column_id is distinct from old.column_id
                              and new.position is not distinct from old.position) then
    select coalesce(max(t.position), 0) + 1000 into new.position from public.producer_tasks t where t.column_id = new.column_id;
  end if;

  new.updated_at := now();
  if tg_op = 'INSERT' then new.created_by := (select auth.uid()); end if;
  return new;
end $$;

create or replace function public.task_card_members_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not public.task_pode(new.task_id, 'editar') then return new; end if; -- RLS recusa
  if not public.quadro_equipe_ativa((select t.producer_id from public.producer_tasks t where t.id = new.task_id), new.user_id) then
    raise exception 'Esse usuário não é da equipe deste produtor.' using errcode = '23514';
  end if;
  return new;
end $$;

create or replace function public.task_comments_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_t public.producer_tasks; v_m uuid;
begin
  if (select auth.uid()) is not null and not public.task_pode(new.task_id, 'editar') then return new; end if; -- RLS recusa
  select * into v_t from public.producer_tasks t where t.id = new.task_id;
  -- só revalida menções quando elas mudaram (o autor pode editar o texto de comentário antigo)
  if tg_op = 'INSERT' or new.mentions is distinct from old.mentions then
    if cardinality(new.mentions) > 20 then
      raise exception 'Máximo de 20 menções por comentário.' using errcode = '23514';
    end if;
    new.mentions := array(select distinct m from unnest(new.mentions) m);
    foreach v_m in array new.mentions loop
      if not public.quadro_equipe_ativa(v_t.producer_id, v_m) then
        raise exception 'Menção a quem não é da equipe deste produtor.' using errcode = '23514';
      end if;
    end loop;
  end if;
  if tg_op = 'INSERT' then
    perform public.task_log(v_t.board_id, new.task_id, 'comentario', jsonb_build_object('comment_id', new.id));
  end if;
  return new;
end $$;

-- 4. Membros por quadro ---------------------------------------------------------------------------------------------------------
create table if not exists public.task_board_members (
  board_id   uuid not null references public.task_boards (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  nivel      text not null check (nivel in ('ver', 'editar')),
  added_by   uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (board_id, user_id)
);
create index if not exists task_board_members_user_idx on public.task_board_members (user_id);

-- Só o dono do produtor ou membro ATIVO dele (consulta direta) entra; teto de 50 por quadro (trava por quadro: a contagem é a real).
-- Nenhum caminho de authenticated chega aqui (sem INSERT/UPDATE/DELETE direto): só quadro_criar e quadro_membros_definir.
create or replace function public.task_board_members_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_prod uuid;
begin
  select b.producer_id into v_prod from public.task_boards b where b.id = new.board_id;
  if v_prod is null or not (new.user_id = v_prod or exists (select 1 from public.team_members m where m.producer_id = v_prod
       and m.user_id = new.user_id and m.accepted_at is not null and m.blocked_at is null)) then
    raise exception 'Só o dono ou alguém ativo da equipe pode entrar no quadro.' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtext('quadro:' || new.board_id::text));
    if (select count(*) from public.task_board_members x where x.board_id = new.board_id) >= 50 then
      raise exception 'Limite de 50 pessoas por quadro.' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists task_board_members_quadro on public.task_board_members;
create trigger task_board_members_quadro before insert or update of user_id on public.task_board_members
  for each row execute function public.task_board_members_tg();

-- 5. Quadros: tetos e travas ------------------------------------------------------------------------------------------------------
-- Teto de 30 quadros por produtor, arquivados inclusos. O quadro padrão (um por evento, criado pelo sistema) não conta: o teto
-- é dos quadros que a pessoa cria. Só quadro_criar insere quadro de cliente; o padrão vem de quadro_criar_interno.
create or replace function public.task_boards_limite_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.is_default then return new; end if;
  perform pg_advisory_xact_lock(hashtext('quadro:' || new.producer_id::text));
  if (select count(*) from public.task_boards b where b.producer_id = new.producer_id and not b.is_default) >= 30 then
    raise exception 'Limite de 30 quadros por produtor (os arquivados contam).' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists task_boards_limite on public.task_boards;
create trigger task_boards_limite before insert on public.task_boards
  for each row execute function public.task_boards_limite_tg();

-- Update pelo dono (grant por coluna): o quadro padrão fica aberto à equipe e não se arquiva; arquivar carimba a hora pelo banco.
-- Sem return-new-por-papel: a regra de UPDATE só deixa o dono chegar aqui (quem não é dono não enxerga a linha para atualizar).
create or replace function public.task_boards_guarda_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.is_default and (new.visibility is distinct from 'equipe' or new.archived_at is not null) then
    raise exception 'O quadro padrão é da equipe toda e não pode ser arquivado.' using errcode = '23514';
  end if;
  if new.archived_at is distinct from old.archived_at and new.archived_at is not null then new.archived_at := now(); end if;
  return new;
end $$;
drop trigger if exists task_boards_guarda on public.task_boards;
create trigger task_boards_guarda before update on public.task_boards
  for each row execute function public.task_boards_guarda_tg();

-- Saiu de 'escolhidas' (por função ou por update direto): a lista de pessoas é apagada, para não ressuscitar se voltar a 'escolhidas'.
create or replace function public.task_boards_visib_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.task_board_members where board_id = new.id;
  return null;
end $$;
drop trigger if exists task_boards_visib on public.task_boards;
create trigger task_boards_visib after update of visibility on public.task_boards
  for each row when (new.visibility <> 'escolhidas' and old.visibility is distinct from new.visibility)
  execute function public.task_boards_visib_tg();

-- 6. Fatia 1: quadro padrão e apagar evento ------------------------------------------------------------------------------------
-- O quadro que a fatia 1 cria agora é marcado is_default (o ON CONFLICT casa com o índice parcial). Mesmas colunas padrão.
create or replace function public.quadro_criar_interno(p_produtor uuid, p_evento uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_evento is not null and not exists (select 1 from public.events e where e.id = p_evento and e.producer_id = p_produtor) then
    raise exception 'Esse evento não é deste produtor.' using errcode = '42501';
  end if;
  insert into public.task_boards (producer_id, event_id, name, kind, visibility, is_default)
    values (p_produtor, p_evento, public.quadro_nome_padrao(p_evento), case when p_evento is null then 'equipe' else 'evento' end, 'equipe', true)
    on conflict (producer_id, (coalesce(event_id, '00000000-0000-0000-0000-000000000000'::uuid))) where is_default do nothing
    returning id into v_id;
  if v_id is null then
    select b.id into v_id from public.task_boards b
      where b.producer_id = p_produtor and b.event_id is not distinct from p_evento and b.is_default;
  else
    insert into public.task_columns (board_id, name, kind, position) values
      (v_id, 'A fazer', 'todo', 1000), (v_id, 'Em andamento', 'doing', 2000),
      (v_id, 'Em revisão', 'doing', 3000), (v_id, 'Feito', 'done', 4000);
  end if;
  return v_id;
end $$;

-- Apagar evento: SÓ os cartões do quadro PADRÃO do evento (que é da equipe toda) voltam ao quadro padrão da produtora (event_id nulo); o
-- padrão do evento some em cascata. Os quadros EXTRAS do evento (pessoal, escolhidas ou equipe) NÃO somem nem mudam de dono nem de
-- visibilidade: desligam-se do evento (event_id nulo; o tipo 'evento' vira 'equipe', porque o CHECK exige evento para esse tipo), com
-- membros, colunas, cartões e histórico. Mover os cartões de um quadro pessoal ou de pessoas escolhidas para o padrão da produtora os
-- mostraria à equipe inteira. O histórico de cada cartão movido acompanha (a 2A move task_activity junto quando o cartão troca de quadro).
-- Os cartões dos extras perdem só o vínculo com o evento (o gatilho de producer_tasks copia o event_id do quadro; a chave estrangeira
-- também zera).
create or replace function public.events_quadro_antes_apagar_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_dest uuid;
begin
  update public.task_boards set event_id = null, kind = case when kind = 'evento' then 'equipe' else kind end
    where event_id = old.id and not is_default;
  if exists (select 1 from public.producer_tasks t where t.event_id = old.id
             and (t.board_id is null or t.board_id in (select b.id from public.task_boards b where b.event_id = old.id and b.is_default))) then
    v_dest := public.quadro_criar_interno(old.producer_id, null);
    update public.producer_tasks set event_id = null, board_id = v_dest, column_id = null
      where event_id = old.id
        and (board_id is null or board_id in (select b.id from public.task_boards b where b.event_id = old.id and b.is_default));
  end if;
  update public.producer_tasks set event_id = null where event_id = old.id; -- cartões dos quadros extras: só saem do evento
  return old;
end $$;

-- Saiu da equipe (apagado), foi bloqueado ou deixou de estar aceito: as linhas de task_board_members dessa pessoa nos quadros do produtor
-- se vão. Sem isso elas ficavam esperando e voltavam a valer, sem ninguém decidir, se a pessoa fosse readmitida. A porta já ignora quem
-- não é ativo; isto garante que a readmissão comece do zero (o dono escolhe de novo quem entra em cada quadro).
create or replace function public.team_members_quadro_sai_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.task_board_members x using public.task_boards b
    where x.board_id = b.id and b.producer_id = old.producer_id and x.user_id = old.user_id;
  return null;
end $$;
drop trigger if exists team_members_quadro_sai on public.team_members;
create trigger team_members_quadro_sai after delete on public.team_members
  for each row execute function public.team_members_quadro_sai_tg();
drop trigger if exists team_members_quadro_sai_upd on public.team_members;
create trigger team_members_quadro_sai_upd after update on public.team_members
  for each row when (new.blocked_at is not null or new.accepted_at is null
                     or new.user_id is distinct from old.user_id or new.producer_id is distinct from old.producer_id)
  execute function public.team_members_quadro_sai_tg();

-- 7. Anexos (2A): a regra do Storage passa a olhar o quadro do cartão ------------------------------------------------------------
-- task_anexo_produtor continua devolvendo o produtor do caminho, agora só a quem tem 'ver' NO CARTÃO (e sem login = rotina do banco:
-- valida só o formato). task_anexo_pode(nome, nível) é o que as regras do bucket usam: só devolve verdadeiro/falso (sem oráculo).
create or replace function public.task_anexo_produtor(p_name text)
returns uuid language sql stable security definer set search_path = '' as $$
  select t.producer_id from public.producer_tasks t
  where p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f-]{36}-[A-Za-z0-9_-][A-Za-z0-9_.-]{0,82}\.(png|jpe?g|webp|pdf)$'
    and p_name not like '%..%'
    and t.id::text = split_part(p_name, '/', 2) and t.producer_id::text = split_part(p_name, '/', 1)
    and ((select auth.uid()) is null or public.task_pode(t.id, 'ver'))
$$;
create or replace function public.task_anexo_pode(p_name text, p_nivel text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.producer_tasks t
  where p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f-]{36}-[A-Za-z0-9_-][A-Za-z0-9_.-]{0,82}\.(png|jpe?g|webp|pdf)$'
    and p_name not like '%..%'
    and t.id::text = split_part(p_name, '/', 2) and t.producer_id::text = split_part(p_name, '/', 1)
    and public.task_pode(t.id, p_nivel))
$$;

drop policy if exists task_anexos_select on storage.objects;
create policy task_anexos_select on storage.objects as permissive for select to authenticated
  using (bucket_id = 'task-attachments' and public.task_anexo_pode(name, 'ver'));
drop policy if exists task_anexos_insert on storage.objects;
create policy task_anexos_insert on storage.objects as permissive for insert to authenticated
  with check (bucket_id = 'task-attachments' and public.task_anexo_pode(name, 'editar'));
drop policy if exists task_anexos_delete on storage.objects;
create policy task_anexos_delete on storage.objects as permissive for delete to authenticated
  using (bucket_id = 'task-attachments' and public.task_anexo_pode(name, 'editar'));

-- 8. Avisos, botões, modelos de cartão, recorrência e papéis (2B e 2C): o DESTINATÁRIO precisa de acesso AO QUADRO do cartão -------------
-- quadro_notificar: consulta direta (a guarda de equipe_pode só responde por outra pessoa a quem edita, e no cron não há login).
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
  -- só quem TEM acesso 'ver' a ESTE quadro (dono, ou membro ativo conforme a visibilidade do quadro: ferramenta quadro em 'equipe',
  -- lista de pessoas em 'escolhidas', ninguém em 'pessoal'). Consulta direta e não quadro_acesso(..., p_user): a guarda dela só
  -- responde por OUTRA pessoa a quem edita, e no cron auth.uid() é nulo.
  if not public.quadro_acesso_direto(v_t.board_id, p_user, 'ver') then
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

-- 2C: papel só para quem tem acesso ao quadro
create or replace function public.task_roles_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not public.board_pode(new.board_id, 'editar') then return new; end if; -- RLS recusa
  if not public.quadro_acesso_direto(new.board_id, new.user_id, 'ver') then
    raise exception 'Essa pessoa não tem acesso ao quadro deste produtor.' using errcode = '23514';
  end if;
  return new;
end $$;

-- 2C: botão. Passos atribuir/avisar conferem o acesso da pessoa do papel AO QUADRO do botão.
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
              elsif not public.quadro_acesso_direto(v_b.board_id, v_user, 'ver') then
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

-- 2C: modelo de cartão. O responsável do papel só entra no cartão se tiver acesso ao quadro.
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
    if v_user is not null and public.quadro_acesso_direto(p_board, v_user, 'ver') then
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

-- 2C: cópia recorrente. Responsável e membros da cópia só se ainda têm acesso ao quadro; quadro arquivado não gera cópia (o original
-- só avança a data, para o cron não tentar de novo todo dia).
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
  -- quadro arquivado não gera cópia: o original só avança a data (senão o cron tentaria todo dia e tomaria uma das 10 vagas do produtor)
  if exists (select 1 from public.task_boards b where b.id = v_t.board_id and b.archived_at is not null) then
    update public.producer_tasks set recur_next = v_hoje + v_t.recur_days where id = p_task;
    return null;
  end if;
  select c.id into v_col from public.task_columns c where c.board_id = v_t.board_id order by c.position, c.id limit 1;
  insert into public.producer_tasks (producer_id, event_id, board_id, column_id, title, description, priority, cover, location, fields,
                                     assigned_to, due_date)
    values (v_t.producer_id, v_t.event_id, v_t.board_id, v_col, v_t.title, v_t.description, v_t.priority, v_t.cover, v_t.location, v_t.fields,
            case when public.quadro_acesso_direto(v_t.board_id, v_t.assigned_to, 'ver') then v_t.assigned_to end,
            (v_hoje + v_t.recur_days)::timestamp at time zone 'America/Sao_Paulo')
    returning id into v_new;
  insert into public.task_card_members (task_id, user_id)
    select v_new, m.user_id from public.task_card_members m
    where m.task_id = p_task and public.quadro_acesso_direto(v_t.board_id, m.user_id, 'ver');
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

-- 2C: quem pode ser escolhido para um papel = quem tem acesso a este quadro (id e nome; NUNCA e-mail)
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
          from public.team_members m join public.profiles p on p.id = m.user_id
          where m.producer_id = v_prod and m.accepted_at is not null and m.blocked_at is null
            and public.quadro_acesso_direto(p_board, m.user_id, 'ver')) x), '[]'::jsonb);
end $$;

-- 9. Modelos de quadro ----------------------------------------------------------------------------------------------------------------
-- Validação por funções imutáveis. Colunas: 2 a 12, {name, kind}, com ao menos uma 'todo' e uma 'done'. Cartões: até 60,
-- {titulo, coluna (índice), papel?, dias?, vinculos?}. CASE em cada passo: o cast só roda depois de a forma ser conferida.
create or replace function public.quadro_modelo_coluna_ok(c jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(c) <> 'object' then false
    else (c - array['name', 'kind']) = '{}'::jsonb
      and case when jsonb_typeof(c -> 'name') = 'string' then public.quadro_texto_ok(c ->> 'name', 1, 40) else false end
      and case when jsonb_typeof(c -> 'kind') = 'string' then (c ->> 'kind') in ('todo', 'doing', 'done') else false end
    end
$$;
create or replace function public.quadro_modelo_carta_ok(c jsonb, n int)
returns boolean language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(c) <> 'object' then false
    else (c - array['titulo', 'coluna', 'papel', 'dias', 'vinculos']) = '{}'::jsonb
      and case when jsonb_typeof(c -> 'titulo') = 'string' then public.quadro_texto_ok(c ->> 'titulo', 1, 120) else false end
      and case when jsonb_typeof(c -> 'coluna') = 'number' then
            case when (c ->> 'coluna') ~ '^[0-9]{1,2}$' then (c ->> 'coluna')::int < n else false end else false end
      and case when not c ? 'papel' then true when jsonb_typeof(c -> 'papel') = 'string' then
            (c ->> 'papel') in ('portaria', 'divulgacao', 'fornecedores', 'financeiro', 'juridico', 'revisao') else false end
      and case when not c ? 'dias' then true when jsonb_typeof(c -> 'dias') = 'number' then
            case when (c ->> 'dias') ~ '^-?[0-9]{1,3}$' then (c ->> 'dias')::int between -365 and 365 else false end else false end
      and case when not c ? 'vinculos' then true when jsonb_typeof(c -> 'vinculos') = 'array' then
            jsonb_array_length(c -> 'vinculos') <= 15 and not exists (select 1 from jsonb_array_elements(c -> 'vinculos') v
              where jsonb_typeof(v) <> 'string' or (v #>> '{}') <> all (array['ingresso', 'cupom', 'participantes', 'checkin', 'orcamento',
                'financeiro', 'bordero', 'parceiro', 'crm', 'equipe', 'mapa', 'divulgacao', 'certificados', 'cronograma', 'evento']))
          else false end
    end
$$;
create or replace function public.quadro_modelo_ok(p_cols jsonb, p_cards jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p_cols) <> 'array' or jsonb_typeof(p_cards) <> 'array' then false
    else jsonb_array_length(p_cols) between 2 and 12 and jsonb_array_length(p_cards) <= 60
      and not exists (select 1 from jsonb_array_elements(p_cols) c where not public.quadro_modelo_coluna_ok(c))
      and exists (select 1 from jsonb_array_elements(p_cols) c where c ->> 'kind' = 'todo')
      and exists (select 1 from jsonb_array_elements(p_cols) c where c ->> 'kind' = 'done')
      and not exists (select 1 from jsonb_array_elements(p_cards) k where not public.quadro_modelo_carta_ok(k, jsonb_array_length(p_cols)))
    end
$$;

create table if not exists public.task_board_templates (
  key           text primary key check (key ~ '^[a-z0-9_-]{1,40}$'),
  name          text not null check (public.quadro_texto_ok(name, 1, 40)),
  description   text check (description is null or public.quadro_texto_ok(description, 0, 120)),
  kind_sugerido text not null check (kind_sugerido in ('evento', 'equipe', 'pessoal')),
  columns       jsonb not null,
  cards         jsonb not null default '[]',
  owner_id      uuid references public.profiles (id) on delete cascade, -- nulo = modelo do sistema
  created_at    timestamptz not null default now(),
  check (public.quadro_modelo_ok(columns, cards) and pg_column_size(columns) + pg_column_size(cards) < 65536)
);
create index if not exists task_board_templates_owner_idx on public.task_board_templates (owner_id) where owner_id is not null;

-- Teto de 20 modelos por produtor (trava por produtor; só quadro_salvar_como_modelo grava)
create or replace function public.task_board_templates_limite_tg()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.owner_id is null then return new; end if;
  perform pg_advisory_xact_lock(hashtext('quadro:' || new.owner_id::text));
  if (select count(*) from public.task_board_templates t where t.owner_id = new.owner_id) >= 20 then
    raise exception 'Limite de 20 modelos de quadro por produtor.' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists task_board_templates_limite on public.task_board_templates;
create trigger task_board_templates_limite before insert on public.task_board_templates
  for each row execute function public.task_board_templates_limite_tg();

-- Sementes do sistema (regravadas a cada rodada; só as do sistema). Nome, descrição, colunas, títulos e prazos (dias antes do evento; negativo =
-- depois) copiados do protótipo (app/public/quadro-modelo/quadros.js, MODELOS m1..m8). Cartões só em colunas "a fazer": criar quadro não deve
-- nascer com cartão concluído ou em andamento. Nenhum cartão mexe com dinheiro: o financeiro é só acompanhamento.
-- PAPÉIS: o protótipo usa Produção, Operação, Comunicação, Atendimento, Gestão e Financeiro; o banco só aceita a lista fechada portaria,
-- divulgacao, fornecedores, financeiro, juridico, revisao. Só "Financeiro" tem correspondente exato e vira papel 'financeiro'; os demais
-- cartões ficam SEM papel. O mapeamento dos outros cinco é decisão do Ricardo (Pendências). O protótipo também não tem vínculos nos cartões.
insert into public.task_board_templates (key, name, description, kind_sugerido, columns, cards, owner_id) values
  ('evento_completo', 'Evento completo', 'Do alvará ao fechamento do caixa.', 'evento',
   '[{"name":"A fazer","kind":"todo"},{"name":"Em andamento","kind":"doing"},{"name":"Em revisão","kind":"doing"},{"name":"Feito","kind":"done"}]',
   '[{"titulo":"Confirmar local e contrato","coluna":0,"dias":60},{"titulo":"Pedir alvará e vistoria","coluna":0,"dias":45},{"titulo":"Fechar line-up e cachês","coluna":0,"dias":40},{"titulo":"Abrir venda de ingressos","coluna":0,"dias":35},{"titulo":"Contratar som e iluminação","coluna":0,"dias":30},{"titulo":"Plano de segurança e acessos","coluna":0,"dias":20},{"titulo":"Credenciar equipe e fornecedores","coluna":0,"dias":7},{"titulo":"Passagem de som e checagem final","coluna":0,"dias":1},{"titulo":"Conferir caixa e fechamento","coluna":0,"papel":"financeiro","dias":-2}]',
   null),
  ('dia_a_dia', 'Dia a dia do produtor', 'Hoje, esta semana e o que espera resposta.', 'pessoal',
   '[{"name":"Hoje","kind":"todo"},{"name":"Esta semana","kind":"todo"},{"name":"Aguardando","kind":"doing"},{"name":"Feito","kind":"done"}]',
   '[{"titulo":"Responder fornecedores","coluna":0},{"titulo":"Revisar agenda da semana","coluna":1},{"titulo":"Cobrar retorno pendente","coluna":1}]',
   null),
  ('fornecedores', 'Fornecedores e contratos', 'Da cotação ao contrato assinado.', 'evento',
   '[{"name":"Cotando","kind":"todo"},{"name":"Negociando","kind":"doing"},{"name":"Contratado","kind":"doing"},{"name":"Pago","kind":"done"}]',
   '[{"titulo":"Cotar buffet e bebidas","coluna":0,"dias":50},{"titulo":"Cotar segurança","coluna":0,"dias":45},{"titulo":"Assinar contrato de som","coluna":0,"dias":30},{"titulo":"Acompanhar pagamento do palco","coluna":0,"papel":"financeiro","dias":14}]',
   null),
  ('divulgacao', 'Divulgação', 'Ideias, produção e calendário de posts.', 'evento',
   '[{"name":"Ideias","kind":"todo"},{"name":"Produzindo","kind":"doing"},{"name":"Agendado","kind":"doing"},{"name":"Publicado","kind":"done"}]',
   '[{"titulo":"Teaser de anúncio","coluna":0,"dias":40},{"titulo":"Arte do cartaz","coluna":0,"dias":38},{"titulo":"Série de bastidores","coluna":0,"dias":20},{"titulo":"Lembrete de última semana","coluna":0,"dias":7}]',
   null),
  ('pos_evento', 'Pós-evento', 'Relatório, certificados e agradecimentos.', 'evento',
   '[{"name":"Relatório","kind":"todo"},{"name":"Certificados","kind":"todo"},{"name":"Agradecimentos","kind":"todo"},{"name":"Pesquisa","kind":"todo"},{"name":"Feito","kind":"done"}]',
   '[{"titulo":"Relatório de público","coluna":0,"dias":-3},{"titulo":"Emitir certificados","coluna":1,"dias":-5},{"titulo":"Agradecer parceiros","coluna":2,"dias":-2},{"titulo":"Enviar pesquisa de satisfação","coluna":3,"dias":-4}]',
   null),
  ('reuniao_equipe', 'Reunião de equipe', 'Pauta, decisões e ações com responsável.', 'equipe',
   '[{"name":"Pauta","kind":"todo"},{"name":"Em discussão","kind":"doing"},{"name":"Decisões","kind":"done"},{"name":"Ações","kind":"todo"}]',
   '[{"titulo":"Resultados da semana","coluna":0},{"titulo":"Pontos de atenção","coluna":0},{"titulo":"Próximos passos","coluna":3}]',
   null),
  ('financeiro_equipe', 'Financeiro da equipe', 'Só acompanhamento: o sistema nunca paga.', 'equipe',
   '[{"name":"A pagar","kind":"todo"},{"name":"Em aprovação","kind":"doing"},{"name":"Pago","kind":"done"},{"name":"Conciliado","kind":"done"}]',
   '[{"titulo":"Acompanhar nota do fornecedor de som","coluna":0,"papel":"financeiro"},{"titulo":"Acompanhar repasse da bilheteria","coluna":0,"papel":"financeiro"},{"titulo":"Conferir conciliação do mês","coluna":0,"papel":"financeiro"}]',
   null),
  ('lancamento_vendas', 'Lançamento de vendas', 'Pré-venda, abertura de lotes e encerramento.', 'evento',
   '[{"name":"Preparar","kind":"todo"},{"name":"Pré-venda","kind":"doing"},{"name":"Vendas abertas","kind":"doing"},{"name":"Encerrado","kind":"done"}]',
   '[{"titulo":"Definir lotes e preços","coluna":0,"dias":45},{"titulo":"Montar lista de pré-venda","coluna":0,"dias":38},{"titulo":"Testar compra de ponta a ponta","coluna":0,"dias":36},{"titulo":"Abrir lote 1","coluna":0,"dias":35},{"titulo":"Encerrar lote 1","coluna":0,"dias":21}]',
   null)
on conflict (key) do update set name = excluded.name, description = excluded.description, kind_sugerido = excluded.kind_sugerido,
  columns = excluded.columns, cards = excluded.cards where public.task_board_templates.owner_id is null;

-- 10. Funções públicas (2FA e porta dentro: a regra restritiva da RLS não vale dentro de SECURITY DEFINER) -----------------------------------
-- Interna: valida e normaliza a lista de pessoas de um quadro 'escolhidas' -> [{user_id, nivel}] sem o dono e sem repetidos.
-- Cada pessoa tem de ser membro ATIVO (aceito, não bloqueado) do produtor, conferido direto na tabela.
create or replace function public.quadro_membros_validar(p_produtor uuid, p_membros jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_e jsonb; v_u uuid; v_out jsonb := '[]'; v_vistos uuid[] := '{}';
begin
  if p_membros is null then return v_out; end if;
  if jsonb_typeof(p_membros) <> 'array' then raise exception 'Lista de pessoas inválida.' using errcode = '22023'; end if;
  if jsonb_array_length(p_membros) > 50 then raise exception 'Limite de 50 pessoas por quadro.' using errcode = '22023'; end if;
  for v_e in select e from jsonb_array_elements(p_membros) e loop
    if jsonb_typeof(v_e) <> 'object' or (v_e - array['user_id', 'nivel']) <> '{}'::jsonb
       or jsonb_typeof(v_e -> 'user_id') is distinct from 'string'
       or (v_e ->> 'user_id') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
       or jsonb_typeof(v_e -> 'nivel') is distinct from 'string' or (v_e ->> 'nivel') not in ('ver', 'editar') then
      raise exception 'Cada pessoa precisa de user_id e nível (ver ou editar).' using errcode = '22023';
    end if;
    v_u := (v_e ->> 'user_id')::uuid;
    if v_u = any (v_vistos) then raise exception 'Pessoa repetida na lista.' using errcode = '22023'; end if;
    v_vistos := v_vistos || v_u;
    if v_u = p_produtor then continue; end if; -- o dono já tem tudo
    if not exists (select 1 from public.team_members m where m.producer_id = p_produtor and m.user_id = v_u
                   and m.accepted_at is not null and m.blocked_at is null) then
      raise exception 'Só pessoas ativas da sua equipe podem entrar no quadro.' using errcode = '22023';
    end if;
    v_out := v_out || jsonb_build_object('user_id', v_u, 'nivel', v_e ->> 'nivel');
  end loop;
  return v_out;
end $$;

create or replace function public.quadro_criar(p_nome text, p_kind text, p_evento uuid, p_template text, p_visibilidade text, p_membros jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_nome text := btrim(p_nome);
  v_vis text;
  v_tpl public.task_board_templates;
  v_cols jsonb;
  v_cards jsonb := '[]';
  v_data date;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_membros jsonb := '[]';
  v_board uuid;
  v_ids uuid[] := '{}';
  v_col uuid;
  v_c jsonb;
  v_task uuid;
  v_k text;
  v_n int := 0;
begin
  if v_uid is null or not (select public.gf_mfa_ok()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if not public.quadro_texto_ok(v_nome, 1, 40) then
    raise exception 'O nome do quadro deve ter de 1 a 40 caracteres, sem < ou >.' using errcode = '22023';
  end if;
  if p_kind is null or p_kind not in ('evento', 'equipe', 'pessoal') then
    raise exception 'Tipo de quadro inválido.' using errcode = '22023';
  end if;
  if p_kind = 'evento' then
    if p_evento is null or not exists (select 1 from public.events e where e.id = p_evento and e.producer_id = v_uid) then
      raise exception 'Escolha um evento seu para o quadro.' using errcode = '22023'; -- inexistente e alheio dão a mesma resposta
    end if;
  elsif p_evento is not null then
    raise exception 'Só quadro de evento leva um evento.' using errcode = '22023';
  end if;
  v_vis := case when p_kind = 'pessoal' then 'pessoal' else coalesce(p_visibilidade, 'equipe') end;
  if v_vis not in ('pessoal', 'equipe', 'escolhidas') then
    raise exception 'Visibilidade inválida.' using errcode = '22023';
  end if;
  if v_vis = 'escolhidas' then v_membros := public.quadro_membros_validar(v_uid, p_membros); end if;

  if p_template is null then
    v_cols := '[{"name":"A fazer","kind":"todo"},{"name":"Em andamento","kind":"doing"},{"name":"Feito","kind":"done"}]';
  else
    select * into v_tpl from public.task_board_templates t where t.key = p_template and (t.owner_id is null or t.owner_id = v_uid);
    if not found then raise exception 'Modelo de quadro não encontrado.' using errcode = '22023'; end if;
    v_cols := v_tpl.columns;
    v_cards := v_tpl.cards;
  end if;
  if p_kind = 'evento' then select e.date into v_data from public.events e where e.id = p_evento; end if; -- sem data: prazos do modelo ignorados

  insert into public.task_boards (producer_id, event_id, name, kind, visibility, template_key, created_by, is_default, position)
    values (v_uid, p_evento, v_nome, p_kind, v_vis, p_template, v_uid, false,
            (select coalesce(max(b.position), 0) + 1000 from public.task_boards b where b.producer_id = v_uid))
    returning id into v_board; -- o teto de 30 quadros é do gatilho
  for v_c in select e from jsonb_array_elements(v_cols) e loop
    v_n := v_n + 1;
    insert into public.task_columns (board_id, name, kind, position) values (v_board, v_c ->> 'name', v_c ->> 'kind', v_n * 1000)
      returning id into v_col;
    v_ids := v_ids || v_col;
  end loop;
  v_n := 0;
  for v_c in select e from jsonb_array_elements(v_cards) e loop
    insert into public.producer_tasks (producer_id, event_id, board_id, column_id, title, due_date)
      values (v_uid, p_evento, v_board, v_ids[(v_c ->> 'coluna')::int + 1], v_c ->> 'titulo',
              case when v_data is not null and v_c ? 'dias'
                   then greatest(v_data - (v_c ->> 'dias')::int, v_hoje)::timestamp at time zone 'America/Sao_Paulo' end)
      returning id into v_task;
    for v_k in select jsonb_array_elements_text(coalesce(v_c -> 'vinculos', '[]'::jsonb)) loop
      insert into public.task_links (task_id, kind) values (v_task, v_k);
    end loop;
    v_n := v_n + 1;
  end loop;
  if v_vis = 'escolhidas' then
    insert into public.task_board_members (board_id, user_id, nivel, added_by)
      select v_board, (e ->> 'user_id')::uuid, e ->> 'nivel', v_uid from jsonb_array_elements(v_membros) e;
  end if;
  perform public.task_log(v_board, null, 'modelo', jsonb_build_object('origem', 'quadro_criar', 'modelo', coalesce(p_template, 'zero'), 'cartoes', v_n));
  return v_board;
end $$;

create or replace function public.quadro_salvar_como_modelo(p_board uuid, p_nome text, p_cartoes boolean default false)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_nome text := btrim(p_nome);
  v_b public.task_boards;
  v_cols jsonb;
  v_cards jsonb := '[]';
  v_key text := 'meu_' || replace(gen_random_uuid()::text, '-', '');
begin
  if v_uid is null or not (select public.gf_mfa_ok()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  select * into v_b from public.task_boards b where b.id = p_board and b.producer_id = v_uid;
  if not found then raise exception 'Sem permissão para este quadro.' using errcode = '42501'; end if; -- só o dono; inexistente e alheio dão a mesma resposta
  if not public.quadro_texto_ok(v_nome, 1, 40) then
    raise exception 'O nome do modelo deve ter de 1 a 40 caracteres, sem < ou >.' using errcode = '22023';
  end if;
  select jsonb_agg(jsonb_build_object('name', coalesce(nullif(public.quadro_limpar_texto(c.name, 40), ''), 'Coluna'), 'kind', c.kind) order by c.position, c.id)
    into v_cols from public.task_columns c where c.board_id = p_board;
  if v_cols is null or jsonb_array_length(v_cols) not between 2 and 12
     or not exists (select 1 from jsonb_array_elements(v_cols) e where e ->> 'kind' = 'todo')
     or not exists (select 1 from jsonb_array_elements(v_cols) e where e ->> 'kind' = 'done') then
    raise exception 'Este quadro não vira modelo: precisa de 2 a 12 colunas, com ao menos uma de "a fazer" e uma de "feito".' using errcode = '22023';
  end if;
  if p_cartoes then -- cartões abertos (não arquivados, fora de coluna "feito"), só o título e a coluna: sem membros, datas, comentários nem anexos
    select coalesce(jsonb_agg(jsonb_build_object('titulo', x.titulo, 'coluna', x.idx) order by x.idx, x.pos, x.id), '[]') into v_cards
      from (select t.id, t.position as pos, public.quadro_limpar_texto(t.title, 120) as titulo, o.idx
              from public.producer_tasks t
              join (select c.id, (row_number() over (order by c.position, c.id) - 1)::int as idx, c.kind
                      from public.task_columns c where c.board_id = p_board) o on o.id = t.column_id
             where t.board_id = p_board and t.archived_at is null and o.kind <> 'done'
             order by o.idx, t.position, t.id limit 60) x
      where x.titulo <> '';
  end if;
  insert into public.task_board_templates (key, name, description, kind_sugerido, columns, cards, owner_id)
    values (v_key, v_nome, null, v_b.kind, v_cols, v_cards, v_uid); -- o teto de 20 modelos é do gatilho
  return v_key;
end $$;

create or replace function public.quadro_membros_definir(p_board uuid, p_visibilidade text, p_membros jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_b public.task_boards;
  v_m jsonb;
begin
  if v_uid is null or not (select public.gf_mfa_ok()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  select * into v_b from public.task_boards b where b.id = p_board and b.producer_id = v_uid;
  if not found then raise exception 'Sem permissão para este quadro.' using errcode = '42501'; end if; -- só o DONO
  if v_b.is_default then raise exception 'O quadro padrão é da equipe toda e não muda.' using errcode = '22023'; end if;
  if p_visibilidade is null or p_visibilidade not in ('pessoal', 'equipe', 'escolhidas') then
    raise exception 'Visibilidade inválida.' using errcode = '22023';
  end if;
  if v_b.kind = 'pessoal' and p_visibilidade <> 'pessoal' then
    raise exception 'Quadro pessoal só pode ser pessoal.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('quadro:' || p_board::text));
  if p_visibilidade = 'escolhidas' then
    v_m := public.quadro_membros_validar(v_uid, p_membros);
    -- diferença: sai quem não está mais na lista, muda o nível de quem mudou, entra quem é novo
    delete from public.task_board_members x where x.board_id = p_board
      and x.user_id not in (select (e ->> 'user_id')::uuid from jsonb_array_elements(v_m) e);
    update public.task_board_members x set nivel = e.nivel
      from (select (e ->> 'user_id')::uuid as user_id, e ->> 'nivel' as nivel from jsonb_array_elements(v_m) e) e
      where x.board_id = p_board and x.user_id = e.user_id and x.nivel is distinct from e.nivel;
    insert into public.task_board_members (board_id, user_id, nivel, added_by)
      select p_board, (e ->> 'user_id')::uuid, e ->> 'nivel', v_uid from jsonb_array_elements(v_m) e
      where not exists (select 1 from public.task_board_members x where x.board_id = p_board and x.user_id = (e ->> 'user_id')::uuid);
  end if;
  -- a visibilidade nova corta o acesso na hora; ao sair de 'escolhidas' o gatilho apaga a lista
  update public.task_boards set visibility = p_visibilidade where id = p_board and visibility is distinct from p_visibilidade;
end $$;

create or replace function public.quadro_arquivar(p_board uuid, p_arquivar boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_b public.task_boards;
begin
  if v_uid is null or not (select public.gf_mfa_ok()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  select * into v_b from public.task_boards b where b.id = p_board and b.producer_id = v_uid;
  if not found then raise exception 'Sem permissão para este quadro.' using errcode = '42501'; end if;
  if v_b.is_default then raise exception 'O quadro padrão não pode ser arquivado.' using errcode = '22023'; end if;
  if p_arquivar is null then raise exception 'Diga se é para arquivar ou desarquivar.' using errcode = '22023'; end if;
  update public.task_boards set archived_at = case when p_arquivar then now() end where id = p_board;
end $$;

-- Só id e nome (NUNCA e-mail), só da equipe ATIVA do próprio produtor (o dono não entra). Quem não tem equipe recebe lista vazia.
create or replace function public.quadro_equipe_lista()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not (select public.gf_mfa_ok()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome) order by x.nome, x.id)
    from (select p.id, coalesce(nullif(btrim(p.full_name), ''), 'Sem nome') as nome
          from public.team_members m join public.profiles p on p.id = m.user_id
          where m.producer_id = v_uid and m.user_id <> v_uid and m.accepted_at is not null and m.blocked_at is null) x), '[]'::jsonb);
end $$;

-- 11. Funções: nenhuma para anon; as internas nem para authenticated -------------------------------------------------------------
revoke all on function public.quadro_acesso_direto(uuid, uuid, text), public.quadro_equipe_ativa(uuid, uuid), public.quadro_limpar_texto(text, int), public.quadro_nome_padrao(uuid),
  public.quadro_membros_validar(uuid, jsonb), public.task_board_members_tg(), public.task_boards_limite_tg(), public.task_boards_guarda_tg(),
  public.task_boards_visib_tg(), public.task_board_templates_limite_tg(), public.team_members_quadro_sai_tg(),
  public.producer_tasks_quadro_tg(), public.events_quadro_antes_apagar_tg(), public.quadro_modelo_coluna_ok(jsonb),
  public.quadro_modelo_carta_ok(jsonb, int), public.quadro_modelo_ok(jsonb, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.quadro_acesso(uuid, uuid, text), public.quadro_texto_ok(text, int, int), public.task_anexo_pode(text, text),
  public.quadro_criar(text, text, uuid, text, text, jsonb), public.quadro_salvar_como_modelo(uuid, text, boolean),
  public.quadro_membros_definir(uuid, text, jsonb), public.quadro_arquivar(uuid, boolean), public.quadro_equipe_lista()
  from public, anon;
grant execute on function public.quadro_acesso(uuid, uuid, text), public.quadro_texto_ok(text, int, int), public.task_anexo_pode(text, text),
  public.quadro_criar(text, text, uuid, text, text, jsonb), public.quadro_salvar_como_modelo(uuid, text, boolean),
  public.quadro_membros_definir(uuid, text, jsonb), public.quadro_arquivar(uuid, boolean), public.quadro_equipe_lista()
  to authenticated;
-- (as funções reescritas acima mantêm os privilégios que já tinham: create or replace não os altera)

-- 12. Regras (RLS) e permissões --------------------------------------------------------------------------------------------------------
alter table public.task_board_members enable row level security;
alter table public.task_board_templates enable row level security;

-- producer_tasks (fatia 1): a porta pelo board_id da linha; linha sem board_id = regra de antes. Apagar continua só do dono.
drop policy if exists tasks_ver on public.producer_tasks;
drop policy if exists tasks_criar on public.producer_tasks;
drop policy if exists tasks_editar on public.producer_tasks;
create policy tasks_ver on public.producer_tasks as permissive for select to authenticated
  using (case when board_id is not null then public.quadro_acesso(board_id, (select auth.uid()), 'ver')
              else public.equipe_pode(producer_id, 'quadro', 'ver') end);
create policy tasks_criar on public.producer_tasks as permissive for insert to authenticated
  with check (case when board_id is not null then public.quadro_acesso(board_id, (select auth.uid()), 'editar')
                   else public.equipe_pode(producer_id, 'quadro', 'editar') end);
create policy tasks_editar on public.producer_tasks as permissive for update to authenticated
  using (case when board_id is not null then public.quadro_acesso(board_id, (select auth.uid()), 'editar')
              else public.equipe_pode(producer_id, 'quadro', 'editar') end)
  with check (case when board_id is not null then public.quadro_acesso(board_id, (select auth.uid()), 'editar')
                   else public.equipe_pode(producer_id, 'quadro', 'editar') end);

-- task_boards: lê quem tem 'ver' no quadro. O UPDATE do dono é a regra task_boards_recibos da 2B (producer_id = auth.uid()), que vale
-- para toda coluna com permissão: ela segue com esse nome e agora cobre também nome, descrição, cor, arquivado e visibilidade.
drop policy if exists task_boards_ver on public.task_boards;
create policy task_boards_ver on public.task_boards as permissive for select to authenticated
  using (public.quadro_acesso(id, (select auth.uid()), 'ver'));

-- task_columns: pelo quadro. Apagar coluna continua só do dono do quadro (regra da fatia 1, sem mudança).
drop policy if exists task_columns_ver on public.task_columns;
drop policy if exists task_columns_criar on public.task_columns;
drop policy if exists task_columns_editar on public.task_columns;
create policy task_columns_ver on public.task_columns as permissive for select to authenticated
  using (public.board_pode(board_id, 'ver'));
create policy task_columns_criar on public.task_columns as permissive for insert to authenticated
  with check (public.board_pode(board_id, 'editar'));
create policy task_columns_editar on public.task_columns as permissive for update to authenticated
  using (public.board_pode(board_id, 'editar')) with check (public.board_pode(board_id, 'editar'));

-- Recibos e "visto por" (2B): iguais aos da 20261106, repetidos aqui só para que rodar este arquivo restabeleça tudo depois de reaplicar a 20261105
-- (que devolve as regras de escrita direta e o select sem a trava show_receipts, e os grants de coluna). Se nada foi reaplicado, nada muda.
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
revoke insert, update on table public.task_comment_receipts, public.task_card_views from authenticated;

-- membros do quadro: lê quem tem 'ver'; ninguém grava direto
drop policy if exists task_board_members_ver on public.task_board_members;
create policy task_board_members_ver on public.task_board_members as permissive for select to authenticated
  using (public.board_pode(board_id, 'ver'));
-- modelos de quadro: lê o dono do modelo ou todos (sistema, owner nulo); ninguém grava direto
drop policy if exists task_board_templates_ver on public.task_board_templates;
create policy task_board_templates_ver on public.task_board_templates as permissive for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));

-- 2FA: mesma regra RESTRICTIVE das outras tabelas do quadro
do $$
declare v_tab text;
begin
  foreach v_tab in array array['task_board_members', 'task_board_templates'] loop
    execute format('drop policy if exists gf_mfa_aal2 on public.%I', v_tab);
    execute format('create policy gf_mfa_aal2 on public.%I as restrictive for all to authenticated using ((select public.gf_mfa_ok())) with check ((select public.gf_mfa_ok()))', v_tab);
  end loop;
end $$;

revoke all on table public.task_board_members, public.task_board_templates from public, anon, authenticated;
grant select on table public.task_board_members, public.task_board_templates to authenticated;
-- task_boards: o dono altera estas colunas (insert e delete só por função; kind, is_default, created_by, template_key, position nunca)
grant update (name, description, color, archived_at, visibility) on table public.task_boards to authenticated;

-- 13. Conferência que aborta (tudo ou nada) ------------------------------------------------------------------------------------------------------
do $$
declare
  v_tab text;
  v_esperado jsonb := jsonb_build_object(
    'task_boards', array['gf_mfa_aal2', 'task_boards_recibos', 'task_boards_ver'],
    'task_board_members', array['gf_mfa_aal2', 'task_board_members_ver'],
    'task_board_templates', array['gf_mfa_aal2', 'task_board_templates_ver'],
    'producer_tasks', array['gf_mfa_aal2', 'tasks_apagar', 'tasks_criar', 'tasks_editar', 'tasks_ver'],
    'task_columns', array['gf_mfa_aal2', 'task_columns_apagar', 'task_columns_criar', 'task_columns_editar', 'task_columns_ver']);
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
  if has_any_column_privilege('authenticated', 'public.task_board_members', 'insert,update') or has_table_privilege('authenticated', 'public.task_board_members', 'delete')
     or has_any_column_privilege('authenticated', 'public.task_board_templates', 'insert,update') or has_table_privilege('authenticated', 'public.task_board_templates', 'delete')
     or has_table_privilege('authenticated', 'public.task_boards', 'insert') or has_table_privilege('authenticated', 'public.task_boards', 'delete') then
    raise exception 'authenticated grava direto em membros, modelos ou quadros';
  end if;
  if not has_column_privilege('authenticated', 'public.task_boards', 'name', 'update')
     or not has_column_privilege('authenticated', 'public.task_boards', 'visibility', 'update')
     or has_column_privilege('authenticated', 'public.task_boards', 'is_default', 'update')
     or has_column_privilege('authenticated', 'public.task_boards', 'kind', 'update')
     or has_column_privilege('authenticated', 'public.task_boards', 'producer_id', 'update') then
    raise exception 'permissão de coluna de task_boards fora do esperado';
  end if;
  if (select count(*) from public.task_board_templates where owner_id is null) <> 8 then
    raise exception 'sementes dos modelos de quadro fora do esperado';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public'
             and (table_name like 'task\_%' or table_name = 'producer_tasks') and column_name ~* '(^|_)(ip|email|e_mail)(_|$)') then
    raise exception 'coluna de IP ou e-mail encontrada (LGPD)';
  end if;
  if has_function_privilege('anon', 'public.quadro_acesso(uuid, uuid, text)', 'execute')
     or has_function_privilege('anon', 'public.quadro_criar(text, text, uuid, text, text, jsonb)', 'execute')
     or has_function_privilege('anon', 'public.quadro_salvar_como_modelo(uuid, text, boolean)', 'execute')
     or has_function_privilege('anon', 'public.quadro_membros_definir(uuid, text, jsonb)', 'execute')
     or has_function_privilege('anon', 'public.quadro_arquivar(uuid, boolean)', 'execute')
     or has_function_privilege('anon', 'public.quadro_equipe_lista()', 'execute')
     or has_function_privilege('anon', 'public.task_anexo_pode(text, text)', 'execute')
     or not has_function_privilege('authenticated', 'public.quadro_acesso(uuid, uuid, text)', 'execute')
     or not has_function_privilege('authenticated', 'public.quadro_criar(text, text, uuid, text, text, jsonb)', 'execute')
     or not has_function_privilege('authenticated', 'public.quadro_equipe_lista()', 'execute') then
    raise exception 'permissão das funções públicas fora do esperado';
  end if;
  if has_function_privilege('authenticated', 'public.quadro_acesso_direto(uuid, uuid, text)', 'execute')
     or has_function_privilege('anon', 'public.quadro_acesso_direto(uuid, uuid, text)', 'execute')
     or has_function_privilege('authenticated', 'public.quadro_equipe_ativa(uuid, uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.quadro_membros_validar(uuid, jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.quadro_nome_padrao(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.quadro_limpar_texto(text, int)', 'execute')
     or has_function_privilege('authenticated', 'public.task_board_members_tg()', 'execute')
     or has_function_privilege('authenticated', 'public.task_boards_guarda_tg()', 'execute')
     or has_function_privilege('authenticated', 'public.quadro_modelo_ok(jsonb, jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.producer_tasks_quadro_tg()', 'execute')
     or has_function_privilege('anon', 'public.producer_tasks_quadro_tg()', 'execute')
     or has_function_privilege('authenticated', 'public.events_quadro_antes_apagar_tg()', 'execute')
     or has_function_privilege('anon', 'public.events_quadro_antes_apagar_tg()', 'execute')
     or has_function_privilege('authenticated', 'public.team_members_quadro_sai_tg()', 'execute') then
    raise exception 'função interna executável por authenticated ou anon';
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.task_activity'::regclass and conname = 'task_activity_kind_check'
                 and pg_get_constraintdef(oid) like '%recorrente%' and pg_get_constraintdef(oid) like '%checklist_recusado%'
                 and pg_get_constraintdef(oid) like '%botao%' and pg_get_constraintdef(oid) like '%modelo%') then
    raise exception 'task_activity_kind_check fora do esperado';
  end if;
  if (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'task\_anexos\_%') <> 3 then
    raise exception 'regras do bucket task-attachments fora do esperado';
  end if;
  if exists (select 1 from public.task_boards b where b.is_default and (b.visibility <> 'equipe' or b.archived_at is not null)) then
    raise exception 'quadro padrão fora do esperado';
  end if;
  if exists (select 1 from public.task_boards b where not b.is_default and b.created_by is null) then
    raise exception 'sobrou quadro sem padrão e sem autor (backfill)';
  end if;
  if (select count(*) from public.producer_tasks) <> (select tarefas from _f2f_antes)
     or (select count(*) from public.task_boards) < (select quadros from _f2f_antes) then
    raise exception 'a contagem de tarefas ou quadros mudou (backfill)';
  end if;
end $$;

commit;

-- Conferência (só leitura). Esperado: 8 modelos do sistema, 2 tabelas novas, todo quadro padrão aberto à equipe.
select 'modelos do sistema' as item, count(*)::text as valor from public.task_board_templates where owner_id is null
union all
select 'tabelas novas', count(*)::text from pg_tables where schemaname = 'public' and tablename in ('task_board_members', 'task_board_templates')
union all
select 'quadros', count(*) filter (where is_default)::text || ' padrão de ' || count(*)::text from public.task_boards
union all
select 'índice parcial', (select (indexdef like '%WHERE is_default%')::text from pg_indexes where schemaname = 'public' and indexname = 'task_boards_unico');
