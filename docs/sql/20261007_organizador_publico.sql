-- Bloco "Organizador" na página pública do evento (Ricardo, 07/10/2026; fatia 1 do plano: só banco, sem front).
-- O que faz: cria public.producer_public (o que o produtor escolhe mostrar ao público) e 4 funções:
--   organizador_publico(p_evento)            leitura pública (anon/authenticated); só os campos ligados, só se o evento está visível
--   meu_organizador_publico()                o dono lê a própria linha para o formulário de Configurações
--   salvar_organizador_publico(...)          o dono grava (2FA como as demais; valida tudo)
--   admin_ocultar_organizador(produtor, bool) admin esconde/devolve o bloco (permissão manage_events, trilha de auditoria)
-- Segurança: RLS ligada e SEM nenhuma política nem GRANT de tabela para anon/authenticated; tudo passa pelas funções
--   (SECURITY DEFINER, search_path vazio, como evento_publico). Visibilidade: reaproveita public.evento_acesso()
--   (20261017_f1_pr3e_visibilidade.sql): só 'aberto' e 'link' mostram o organizador; senha, convidados, rascunho e
--   não aprovado devolvem null. Nenhuma alteração em evento_publico.
-- CNPJ e razão social NÃO são digitados nem copiados: organizador_publico lê producer_profiles do dono do evento NO
--   MOMENTO da leitura (saída pública por desenho). Produtor PJ = CNPJ do cadastro com 14 dígitos e dígito verificador
--   válido; PJ sempre sai com CNPJ + razão social (company_name), mesmo sem linha em producer_public e com tudo
--   desligado. Pessoa física nunca sai com CNPJ nem CPF. PF sem linha em producer_public: sem bloco (null).
--   A base legal do CNPJ obrigatório (Decreto 7.962/2013) NÃO foi verificada (pendência do jurídico).
-- PR7-PASSO2 (PR 7 / #234, cripto): organizador_cnpj_do_produtor() lê producer_profiles.cnpj (texto) e, se este não
--   servir, tenta pr7_dec(cnpj_enc) SOMENTE se a função e a coluna existirem (checagem em tempo de execução, sem
--   referência estática). Se o passo 2 dropar cnpj e a pr7_dec não existir, o produtor passa a contar como PF (sem
--   CNPJ, sem erro). Nada a ajustar aqui se o passo 2 mantiver cnpj_enc + pr7_dec(bytea).
-- Padrão: só o nome aparece (mostrar_nome = true); os demais campos nascem desligados.
-- Moderação: o conteúdo vale na hora (não passa por gf_protect_event_moderation); o admin pode ocultar o bloco inteiro
--   (oculto_por_admin). Nome com "evokaa" é recusado (não se passar pela plataforma).
-- Como aplicar: ANTES de mesclar o front (que chamará estas funções). Colar inteiro no SQL Editor (UTF-8 via pbcopy,
--   NUNCA pelo TextEdit). Uma transação, idempotente.
-- Como desfazer (só depois de tirar o front):
--   drop function if exists public.organizador_publico(uuid), public.meu_organizador_publico(),
--     public.admin_ocultar_organizador(uuid,boolean),
--     public.salvar_organizador_publico(text,text,text,text,text,jsonb,boolean,boolean,boolean,boolean,boolean,boolean);
--   drop table if exists public.producer_public;
--   drop function if exists public.organizador_cnpj_do_produtor(uuid), public.organizador_redes_ok(jsonb), public.organizador_cnpj_valido(text);
begin;
set local lock_timeout = '5s';

-- 1) Validadores (imutáveis, usados pelo CHECK e pelas funções) -------------------------------------------------------
create or replace function public.organizador_cnpj_valido(p text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  d int[]; s int; i int; dv1 int; dv2 int;
  w1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2];
  w2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
begin
  if p is null or p !~ '^[0-9]{14}$' or p ~ '^(.)\1{13}$' then return false; end if;
  d := array(select substr(p, g, 1)::int from generate_series(1, 14) g);
  s := 0; for i in 1..12 loop s := s + d[i] * w1[i]; end loop;
  dv1 := case when s % 11 < 2 then 0 else 11 - s % 11 end;
  s := 0; for i in 1..13 loop s := s + d[i] * w2[i]; end loop;
  dv2 := case when s % 11 < 2 then 0 else 11 - s % 11 end;
  return d[13] = dv1 and d[14] = dv2;
end $$;

-- outras_redes = lista de até 5 itens {"rotulo": "...", "url": "https://..."}, no máximo 1000 caracteres no total.
-- URL: https, host só ASCII (sem @, sem aspas, sem < >).
create or replace function public.organizador_redes_ok(p jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select p is null or (
    jsonb_typeof(p) = 'array' and jsonb_array_length(p) <= 5 and length(p::text) <= 1000
    and not exists (
      select 1 from jsonb_array_elements(p) e
      where jsonb_typeof(e) <> 'object'
         or jsonb_typeof(e -> 'rotulo') is distinct from 'string' or length(e ->> 'rotulo') not between 1 and 30
         or jsonb_typeof(e -> 'url') is distinct from 'string'
         or (e ->> 'url') !~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(/[^\s"<>]*)?$'
         or length(e ->> 'url') > 200));
$$;

-- CNPJ válido (14 dígitos) do cadastro do produtor, ou null (PF). Interna: só as funções abaixo a chamam.
create or replace function public.organizador_cnpj_do_produtor(p_producer uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare j jsonb; v text;
begin
  select to_jsonb(pp) into j from public.producer_profiles pp where pp.id = p_producer;
  if j is null then return null; end if;
  v := regexp_replace(coalesce(j ->> 'cnpj', ''), '\D', '', 'g');
  if public.organizador_cnpj_valido(v) then return v; end if;
  -- PR7-PASSO2: cnpj em texto pode ter sumido; tenta o cifrado só se pr7_dec(bytea) e a coluna existirem
  if to_regprocedure('public.pr7_dec(bytea)') is not null and j ->> 'cnpj_enc' is not null then
    execute 'select public.pr7_dec(decode(substr($1, 3), ''hex''))' into v using j ->> 'cnpj_enc';
    v := regexp_replace(coalesce(v, ''), '\D', '', 'g');
    if public.organizador_cnpj_valido(v) then return v; end if;
  end if;
  return null;
end $$;
revoke all on function public.organizador_cnpj_do_produtor(uuid) from public, anon, authenticated;

-- 2) Tabela -------------------------------------------------------------------------------------------------------
create table if not exists public.producer_public (
  producer_id uuid primary key references public.producer_profiles(id) on delete cascade,
  nome_publico text,
  whatsapp text,
  instagram text,
  site text,
  email_contato text,
  outras_redes jsonb,
  mostrar_nome boolean not null default true,
  mostrar_whatsapp boolean not null default false,
  mostrar_instagram boolean not null default false,
  mostrar_site boolean not null default false,
  mostrar_email boolean not null default false,
  mostrar_outras_redes boolean not null default false,
  oculto_por_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producer_public_nome_check check (nome_publico is null or (length(nome_publico) between 1 and 80 and nome_publico !~* 'evokaa')),
  constraint producer_public_whatsapp_check check (whatsapp is null or whatsapp ~ '^55[0-9]{10,11}$'),
  constraint producer_public_instagram_check check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  constraint producer_public_site_check check (site is null or (length(site) <= 200 and site ~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(/[^\s"<>]*)?$')),
  constraint producer_public_email_check check (email_contato is null or (length(email_contato) <= 254 and email_contato ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  constraint producer_public_redes_check check (public.organizador_redes_ok(outras_redes))
);
comment on table public.producer_public is 'O que o produtor escolheu mostrar na página do evento. Sem leitura direta: só pelas funções organizador_publico / meu_organizador_publico.';

alter table public.producer_public enable row level security;
drop policy if exists "Sem acesso direto" on public.producer_public; -- nenhuma política: negado por padrão
revoke all on table public.producer_public from public, anon, authenticated;

-- 3) Leitura pública ----------------------------------------------------------------------------------------------
create or replace function public.organizador_publico(p_evento uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with ev as (
    select e.producer_id, public.organizador_cnpj_do_produtor(e.producer_id) as cnpj
    from public.events e
    where e.id = p_evento and public.evento_acesso(p_evento) in ('aberto', 'link')
  )
  select case when ev.cnpj is null and pp.producer_id is null then null  -- PF sem linha: sem bloco
              when pp.oculto_por_admin then null
              else nullif(jsonb_strip_nulls(jsonb_build_object(
      'nome', case when pp.producer_id is null then (select pf.company_name from public.producer_profiles pf where pf.id = ev.producer_id)
                   when pp.mostrar_nome then pp.nome_publico end,
      'razao_social', case when ev.cnpj is not null then (select pf.company_name from public.producer_profiles pf where pf.id = ev.producer_id) end,
      'cnpj', ev.cnpj,                   -- só PJ (CNPJ do cadastro, válido): sai sempre
      'whatsapp', case when pp.mostrar_whatsapp then pp.whatsapp end,
      'instagram', case when pp.mostrar_instagram then pp.instagram end,
      'site', case when pp.mostrar_site then pp.site end,
      'email', case when pp.mostrar_email then pp.email_contato end,
      'outras_redes', case when pp.mostrar_outras_redes then pp.outras_redes end)), '{}'::jsonb) end
  from ev left join public.producer_public pp on pp.producer_id = ev.producer_id;
$$;
revoke all on function public.organizador_publico(uuid) from public, anon, authenticated;
grant execute on function public.organizador_publico(uuid) to anon, authenticated;

-- 4) Dono lê a própria linha --------------------------------------------------------------------------------------
create or replace function public.meu_organizador_publico() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'sem sessão' using errcode = '42501'; end if;
  if not public.gf_mfa_ok() then
    raise exception 'Reautenticação de dois fatores necessária.' using errcode = '42501';
  end if;
  -- cnpj/razao_social vêm do cadastro (somente leitura para o formulário); nunca são gravados em producer_public
  return (select to_jsonb(pp) - 'oculto_por_admin'
            || jsonb_build_object('cnpj', public.organizador_cnpj_do_produtor(pp.producer_id))
          from public.producer_public pp where pp.producer_id = (select auth.uid()));
end $$;
revoke all on function public.meu_organizador_publico() from public, anon, authenticated;
grant execute on function public.meu_organizador_publico() to authenticated;

-- 5) Dono grava ---------------------------------------------------------------------------------------------------
create or replace function public.salvar_organizador_publico(
  p_nome_publico text, p_whatsapp text, p_instagram text, p_site text,
  p_email_contato text, p_outras_redes jsonb,
  p_mostrar_nome boolean, p_mostrar_whatsapp boolean, p_mostrar_instagram boolean, p_mostrar_site boolean,
  p_mostrar_email boolean, p_mostrar_outras_redes boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_nome text := nullif(btrim(p_nome_publico), '');
  v_zap text := nullif(regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'), '');
  v_insta text := nullif(regexp_replace(btrim(coalesce(p_instagram, '')), '^@', ''), '');
  v_site text := nullif(btrim(p_site), '');
  v_email text := nullif(btrim(p_email_contato), '');
begin
  if v_uid is null then raise exception 'sem sessão' using errcode = '42501'; end if;
  if not public.gf_mfa_ok() then
    raise exception 'Reautenticação de dois fatores necessária.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.producer_profiles where id = v_uid) then
    raise exception 'Só produtores configuram o organizador.' using errcode = '42501';
  end if;
  if v_nome is null then raise exception 'Informe o nome do organizador.' using errcode = '23514'; end if;
  -- WhatsApp sem DDI (10-11 dígitos) ganha o 55; com DDI fica como está
  if v_zap is not null and length(v_zap) <= 11 then v_zap := '55' || v_zap; end if;

  -- formato: o CHECK da tabela recusa o que escapar (errcode 23514). oculto_por_admin nunca é tocado aqui.
  insert into public.producer_public (producer_id, nome_publico, whatsapp, instagram, site,
      email_contato, outras_redes, mostrar_nome, mostrar_whatsapp, mostrar_instagram, mostrar_site, mostrar_email,
      mostrar_outras_redes)
    values (v_uid, v_nome, v_zap, v_insta, v_site, v_email, p_outras_redes,
      coalesce(p_mostrar_nome, true), coalesce(p_mostrar_whatsapp, false), coalesce(p_mostrar_instagram, false),
      coalesce(p_mostrar_site, false), coalesce(p_mostrar_email, false), coalesce(p_mostrar_outras_redes, false))
  on conflict (producer_id) do update set
      nome_publico = excluded.nome_publico,
      whatsapp = excluded.whatsapp, instagram = excluded.instagram, site = excluded.site,
      email_contato = excluded.email_contato, outras_redes = excluded.outras_redes,
      mostrar_nome = excluded.mostrar_nome, mostrar_whatsapp = excluded.mostrar_whatsapp,
      mostrar_instagram = excluded.mostrar_instagram, mostrar_site = excluded.mostrar_site,
      mostrar_email = excluded.mostrar_email, mostrar_outras_redes = excluded.mostrar_outras_redes,
      updated_at = now();
end $$;
revoke all on function public.salvar_organizador_publico(text,text,text,text,text,jsonb,boolean,boolean,boolean,boolean,boolean,boolean) from public, anon, authenticated;
grant execute on function public.salvar_organizador_publico(text,text,text,text,text,jsonb,boolean,boolean,boolean,boolean,boolean,boolean) to authenticated;

-- 6) Admin oculta/devolve o bloco (mesma permissão da moderação de eventos: manage_events, que já inclui o 2FA) ---------
create or replace function public.admin_ocultar_organizador(p_producer uuid, p_ocultar boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_antes boolean;
begin
  if not (select public.gf_admin_can('manage_events')) then
    raise exception 'Sem permissão para moderar organizadores' using errcode = '42501';
  end if;
  if p_ocultar is null or not exists (select 1 from public.producer_profiles where id = p_producer) then
    raise exception 'Produtor ou decisão inválidos' using errcode = '22023';
  end if;
  select oculto_por_admin into v_antes from public.producer_public where producer_id = p_producer;
  insert into public.producer_public (producer_id, oculto_por_admin) values (p_producer, p_ocultar)
    on conflict (producer_id) do update set oculto_por_admin = p_ocultar, updated_at = now();
  -- trilha (S5) quando existir neste banco; mesmas colunas de 20261016_admin_s5_trilha.sql
  if to_regclass('public.admin_audit_log') is not null then
    execute 'insert into public.admin_audit_log (autor, tipo, acao, tabela, objeto_id, antes, depois)
             values ($1, ''acao'', $2, ''producer_public'', $3, $4, $5)'
      using (select auth.uid()), case when p_ocultar then 'ocultar_organizador' else 'mostrar_organizador' end,
            p_producer::text, jsonb_build_object('oculto_por_admin', coalesce(v_antes, false)),
            jsonb_build_object('oculto_por_admin', p_ocultar);
  end if;
end $$;
revoke all on function public.admin_ocultar_organizador(uuid, boolean) from public, anon, authenticated;
grant execute on function public.admin_ocultar_organizador(uuid, boolean) to authenticated;

commit;

-- Ensaio (rode à parte; nada fica gravado). Rodado em produção em 07/10/2026 com begin…rollback: 11 grupos OK, nada gravado. Usa 2 produtores e 1 evento do primeiro já existentes (precisa de 2 linhas em
-- producer_profiles e 1 evento do primeiro). Dentro da transação: o evento fica público/aprovado, o produtor A vira PF
-- (cnpj do cadastro com 11 dígitos) e o B vira PJ (company_name 'Empresa B Ltda'). Se o gatilho de proteção de
-- producer_profiles recusar o update de ensaio, rode como o dono do banco. gf_mfa_ok fica verdadeiro (sem fator de 2FA);
-- o bloqueio por aal1 e o caminho feliz do admin (gf_admin_can) NÃO são ensaiados aqui.
-- begin;
--   do $$
--   declare
--     a uuid; b uuid; ev uuid; r jsonb; n int;
--     claims_a text; claims_b text;
--   begin
--     select id into a from public.producer_profiles order by id limit 1;
--     select id into b from public.producer_profiles where id <> a order by id limit 1;
--     select id into ev from public.events where producer_id = a limit 1;
--     if a is null or b is null or ev is null then raise notice 'sem dados para ensaiar'; return; end if;
--     claims_a := json_build_object('sub', a, 'role', 'authenticated', 'aal', 'aal2')::text;
--     claims_b := json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal2')::text;
--     update public.events set visibility = 'public' where id = ev; -- não mexa em status/approval_status: o gatilho do aceite recusa voltar a 'published'
--     update public.producer_profiles set cnpj = '12345678901' where id = a;
--     update public.producer_profiles set cnpj = '11222333000181', company_name = 'Empresa B Ltda' where id = b;
--     delete from public.producer_public where producer_id in (a, b);
--
--     -- PF sem linha em producer_public: sem bloco
--     perform set_config('request.jwt.claims', '{"role":"anon"}', true); set local role anon;
--     assert public.organizador_publico(ev) is null, 'PF sem linha deveria dar null';
--
--     -- A (PF) grava o nome, WhatsApp desligado
--     reset role; perform set_config('request.jwt.claims', claims_a, true); set local role authenticated;
--     perform public.salvar_organizador_publico('Fulano Eventos', '(11) 99999-8888', '@fulano', null, null, null,
--       true, false, false, false, false, false);
--     assert (public.meu_organizador_publico() ->> 'cnpj') is null, 'PF com cnpj no formulário';
--     begin update public.producer_public set nome_publico = 'x'; raise exception 'dono atualizou a tabela direto';
--     exception when insufficient_privilege then null; end;
--
--     -- anon: não lê a tabela; a função devolve só o nome, sem cnpj, sem producer_id
--     reset role; perform set_config('request.jwt.claims', '{"role":"anon"}', true); set local role anon;
--     begin perform 1 from public.producer_public; raise exception 'anon leu a tabela';
--     exception when insufficient_privilege then null; end;
--     r := public.organizador_publico(ev);
--     assert r ->> 'nome' = 'Fulano Eventos', 'nome não saiu: ' || coalesce(r::text, 'null');
--     assert r = '{"nome": "Fulano Eventos"}'::jsonb, 'vazou campo desligado/producer_id: ' || r::text;
--
--     -- A liga o WhatsApp: sai com DDI 55
--     reset role; perform set_config('request.jwt.claims', claims_a, true); set local role authenticated;
--     perform public.salvar_organizador_publico('Fulano Eventos', '(11) 99999-8888', '@fulano', null, null, null,
--       true, true, false, false, false, false);
--     reset role; perform set_config('request.jwt.claims', '{"role":"anon"}', true); set local role anon;
--     r := public.organizador_publico(ev);
--     assert r ->> 'whatsapp' = '5511999998888' and not (r ? 'instagram') and not (r ? 'cnpj'), 'whatsapp/instagram errado: ' || r::text;
--
--     -- evento que não está aberto não vaza nada
--     reset role;
--     update public.events set visibility = 'private' where id = ev;
--     perform set_config('request.jwt.claims', '{"role":"anon"}', true); set local role anon;
--     assert public.organizador_publico(ev) is null, 'vazou evento privado';
--     reset role; update public.events set visibility = 'password' where id = ev;
--     set local role anon; assert public.organizador_publico(ev) is null, 'vazou evento com senha';
--     reset role; update public.events set visibility = 'unlisted' where id = ev;
--     set local role anon; assert public.organizador_publico(ev) is not null, 'evento só com link deveria abrir';
--
--     -- A: lixo recusado pelo banco; A não cria linha do B; não-admin não oculta
--     reset role; perform set_config('request.jwt.claims', claims_a, true); set local role authenticated;
--     begin perform public.salvar_organizador_publico('X', '123', null, null, null, null, true, false, false, false, false, false);
--       raise exception 'aceitou whatsapp curto'; exception when check_violation then null; end;
--     begin perform public.salvar_organizador_publico('X', null, null, 'http://inseguro.com', null, null, true, false, false, false, false, false);
--       raise exception 'aceitou http'; exception when check_violation then null; end;
--     begin perform public.salvar_organizador_publico('X', null, null, 'https://google.com@evil.com', null, null, true, false, false, false, false, false);
--       raise exception 'aceitou @ na URL'; exception when check_violation then null; end;
--     begin perform public.salvar_organizador_publico('Evokaa Oficial', null, null, null, null, null, true, false, false, false, false, false);
--       raise exception 'aceitou nome com evokaa'; exception when check_violation then null; end;
--     begin perform public.admin_ocultar_organizador(b, true);
--       raise exception 'não-admin ocultou'; exception when insufficient_privilege then null; end;
--     reset role; perform set_config('request.jwt.claims', '', true); select count(*) into n from public.producer_public where producer_id = b;
--     assert n = 0, 'A criou linha do B';
--
--     -- B (PJ) SEM linha em producer_public: CNPJ + razão social + nome vêm do cadastro
--     update public.events set producer_id = b, visibility = 'public' where id = ev;
--     perform set_config('request.jwt.claims', '{"role":"anon"}', true); set local role anon;
--     r := public.organizador_publico(ev);
--     assert r = '{"nome":"Empresa B Ltda","razao_social":"Empresa B Ltda","cnpj":"11222333000181"}'::jsonb, 'PJ sem linha: ' || coalesce(r::text, 'null');
--
--     -- B grava tudo desligado (inclusive o nome): CNPJ e razão continuam saindo; o resto some
--     reset role; perform set_config('request.jwt.claims', claims_b, true); set local role authenticated;
--     perform public.salvar_organizador_publico('Empresa B', '11988887777', 'empresa.b', 'https://empresab.com.br',
--       'oi@empresab.com.br', '[{"rotulo":"Facebook","url":"https://facebook.com/b"}]', false, false, false, false, false, false);
--     assert (public.meu_organizador_publico() ->> 'cnpj') = '11222333000181', 'formulário sem cnpj do cadastro';
--     reset role; perform set_config('request.jwt.claims', '{"role":"anon"}', true); set local role anon;
--     r := public.organizador_publico(ev);
--     assert r = '{"razao_social":"Empresa B Ltda","cnpj":"11222333000181"}'::jsonb, 'PJ tudo desligado: ' || r::text;
--
--     -- mudar o CNPJ no cadastro muda na leitura; CNPJ inválido no cadastro = PF (sem cnpj, sem erro)
--     -- (limpe os claims antes de mexer em producer_profiles: o gatilho gf_protect_producer_profile_privileges recusa claims de anon)
--     reset role; perform set_config('request.jwt.claims', '', true); update public.producer_profiles set cnpj = '00000000000191' where id = b;
--     perform set_config('request.jwt.claims', '{"role":"anon"}', true); set local role anon; assert (public.organizador_publico(ev) ->> 'cnpj') = '00000000000191', 'cnpj do cadastro não refletiu';
--     reset role; perform set_config('request.jwt.claims', '', true); update public.producer_profiles set cnpj = '123' where id = b;
--     perform set_config('request.jwt.claims', '{"role":"anon"}', true); set local role anon; assert not (coalesce(public.organizador_publico(ev), '{}') ? 'cnpj'), 'cnpj inválido saiu';
--     reset role; perform set_config('request.jwt.claims', '', true); update public.producer_profiles set cnpj = '11222333000181' where id = b;
--
--     -- ocultado pelo admin: null (aqui simulado direto; a função exige gf_admin_can)
--     update public.producer_public set oculto_por_admin = true where producer_id = b;
--     perform set_config('request.jwt.claims', '{"role":"anon"}', true); set local role anon; assert public.organizador_publico(ev) is null, 'oculto_por_admin vazou';
--     reset role; perform set_config('request.jwt.claims', '', true); update public.producer_public set oculto_por_admin = false where producer_id = b;
--
--     -- CHECKs do banco (como dono do banco, direto na tabela)
--     begin update public.producer_public set whatsapp = '11999998888' where producer_id = b; raise exception 'zap sem DDI'; exception when check_violation then null; end;
--     begin update public.producer_public set instagram = '@b' where producer_id = b; raise exception 'insta com @'; exception when check_violation then null; end;
--     begin update public.producer_public set instagram = repeat('a', 31) where producer_id = b; raise exception 'insta longo'; exception when check_violation then null; end;
--     begin update public.producer_public set site = 'javascript:alert(1)' where producer_id = b; raise exception 'site js'; exception when check_violation then null; end;
--     begin update public.producer_public set site = 'https://a.com/"x' where producer_id = b; raise exception 'site com aspas'; exception when check_violation then null; end;
--     begin update public.producer_public set site = 'https://bank.com@evil.com' where producer_id = b; raise exception 'site com @'; exception when check_violation then null; end;
--     begin update public.producer_public set email_contato = 'sem arroba' where producer_id = b; raise exception 'email lixo'; exception when check_violation then null; end;
--     begin update public.producer_public set nome_publico = 'EVOKAA suporte' where producer_id = b; raise exception 'nome evokaa'; exception when check_violation then null; end;
--     begin update public.producer_public set outras_redes = '[1]' where producer_id = b; raise exception 'redes lixo'; exception when check_violation then null; end;
--     begin update public.producer_public set outras_redes = (select jsonb_agg(jsonb_build_object('rotulo','r','url','https://a.com/'||g)) from generate_series(1,6) g) where producer_id = b; raise exception '6 redes'; exception when check_violation then null; end;
--     begin update public.producer_public set outras_redes = jsonb_build_array(jsonb_build_object('rotulo','r','url','https://x@a.com')) where producer_id = b; raise exception 'rede com @'; exception when check_violation then null; end;
--     raise notice 'ENSAIO OK';
--   end $$;
-- rollback;
