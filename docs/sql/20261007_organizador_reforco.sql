-- Reforço do bloco "Organizador" (Decisão 178; achados da auditoria de segurança e do revisor). Só banco, sem front.
-- Depende de 20261007_organizador_publico.sql (tabela producer_public e organizador_redes_ok).
-- O que faz: fecha no banco o que o front já recusa no navegador, para não dar para burlar chamando a API direto.
--   1) organizador_marca_ok(texto): minúsculas, sem acento, leetspeak (0→o 1→i 3→e 4→a 5→s @→a $→s), só letras;
--      reprova se sobrar 'evokaa' ou 'auratickets' ('Ev0kaa', 'E.v.o.k.a.a', 'Evokáa', 'Aura Tickets'). Vale para
--      nome_publico e para cada rótulo de outras_redes.
--   2) Rótulo de outras_redes também recusa as palavras inteiras 'pix' e 'pagamento' ('Pixel Art', 'Pixabay' passam).
--   3) URL (site e outras_redes.url): host sem label 'xn--' (punycode) e sem a marca (mesma normalização, só no host).
--   4) E-mail de contato sem ? & # % (impede 'oi@x.com?subject=…&body=…').
--   Recria os 4 CHECKs (mesmos nomes). salvar_organizador_publico NÃO muda: os CHECKs recusam com 23514 como antes.
-- Como aplicar: depois da fatia 1. Colar inteiro no SQL Editor (UTF-8 via pbcopy, NUNCA pelo TextEdit). Uma transação,
--   idempotente. O ADD CONSTRAINT valida as linhas existentes: se alguma já violar, a migração para com 23514 e nada
--   é gravado (ache a linha com select * from public.producer_public e corrija/oculte antes de reaplicar).
-- Como desfazer (volta ao estado da fatia 1):
--   alter table public.producer_public drop constraint producer_public_nome_check, drop constraint producer_public_site_check,
--     drop constraint producer_public_email_check, drop constraint producer_public_redes_check;
--   alter table public.producer_public
--     add constraint producer_public_nome_check check (nome_publico is null or (length(nome_publico) between 1 and 80 and nome_publico !~* 'evokaa')),
--     add constraint producer_public_site_check check (site is null or (length(site) <= 200 and site ~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(/[^\s"<>]*)?$')),
--     add constraint producer_public_email_check check (email_contato is null or (length(email_contato) <= 254 and email_contato ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'));
--   e recrie organizador_redes_ok com o corpo de 20261007_organizador_publico.sql (sem rotulo/xn--); depois
--   drop function public.organizador_url_ok(text), public.organizador_marca_ok(text);  (o CHECK de redes precisa existir antes: já está)
begin;
set local lock_timeout = '5s';

-- 1) Marca: false se, depois de normalizar, contiver evokaa ou auratickets. Texto null devolve true (o CHECK já trata null).
create or replace function public.organizador_marca_ok(p text) returns boolean
language sql immutable set search_path = '' as $$
  select regexp_replace(
           translate(translate(lower(coalesce(p, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'),
                     '01345@$', 'oieasas'),
           '[^a-z]', '', 'g') !~ '(evokaa|auratickets)';
$$;

-- 3) URL: formato atual + host sem 'xn--' em nenhum label e sem a marca.
create or replace function public.organizador_url_ok(p text) returns boolean
language sql immutable set search_path = '' as $$
  select p ~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(/[^\s"<>]*)?$'
     and length(p) <= 200
     and substring(p from '^https://([^/]+)') !~* '(^|\.)xn--'
     and public.organizador_marca_ok(substring(p from '^https://([^/]+)'));
$$;

-- outras_redes = lista de até 5 itens {"rotulo": "...", "url": "https://..."}, no máximo 1000 caracteres no total.
create or replace function public.organizador_redes_ok(p jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select p is null or (
    jsonb_typeof(p) = 'array' and jsonb_array_length(p) <= 5 and length(p::text) <= 1000
    and not exists (
      select 1 from jsonb_array_elements(p) e
      where jsonb_typeof(e) <> 'object'
         or jsonb_typeof(e -> 'rotulo') is distinct from 'string' or length(e ->> 'rotulo') not between 1 and 30
         or not public.organizador_marca_ok(e ->> 'rotulo')
         or translate(lower(e ->> 'rotulo'), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn') ~ '\m(pix|pagamento)\M'
         or jsonb_typeof(e -> 'url') is distinct from 'string'
         or not public.organizador_url_ok(e ->> 'url')));
$$;

-- 5) CHECKs recriados com os mesmos nomes
alter table public.producer_public
  drop constraint if exists producer_public_nome_check,
  drop constraint if exists producer_public_site_check,
  drop constraint if exists producer_public_email_check,
  drop constraint if exists producer_public_redes_check;
alter table public.producer_public
  add constraint producer_public_nome_check check (nome_publico is null or (length(nome_publico) between 1 and 80 and public.organizador_marca_ok(nome_publico))),
  add constraint producer_public_site_check check (site is null or public.organizador_url_ok(site)),
  add constraint producer_public_email_check check (email_contato is null or (length(email_contato) <= 254 and email_contato ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and email_contato !~ '[?&#%]')),
  add constraint producer_public_redes_check check (public.organizador_redes_ok(outras_redes));

commit;

-- Ensaio (rode à parte; nada fica gravado). Usa o primeiro produtor existente. Se o gatilho de proteção de
-- producer_profiles recusar algo, rode como dono do banco. Dica da fatia 1: não mexa em status/approval_status de events e
-- limpe request.jwt.claims antes de qualquer update em producer_profiles (este ensaio nem toca em producer_profiles/events).
-- begin;
--   do $$
--   declare a uuid; v text;
--   begin
--     select id into a from public.producer_profiles order by id limit 1;
--     if a is null then raise notice 'sem dados para ensaiar'; return; end if;
--     delete from public.producer_public where producer_id = a;
--     insert into public.producer_public (producer_id, nome_publico) values (a, 'Festa da Vovó');
--
--     -- nome: recusados
--       foreach v in array array['Ev0kaa', 'E.v.o.k.a.a', 'Evokáa', 'Aura Tickets', 'EVOKAA suporte'] loop
--         begin update public.producer_public set nome_publico = v where producer_id = a; raise exception 'nome aceito: %', v;
--         exception when check_violation then null; end;
--       end loop;
--       -- nome: aceitos
--       foreach v in array array['Evoka Eventos', 'Festa da Vovó'] loop
--         update public.producer_public set nome_publico = v where producer_id = a;
--       end loop;
--
--       -- rótulos recusados / aceitos
--       foreach v in array array['Pix oficial', 'PIX', 'Pagamento', 'Ev0kaa Oficial'] loop
--         begin update public.producer_public set outras_redes = jsonb_build_array(jsonb_build_object('rotulo', v, 'url', 'https://a.com/x')) where producer_id = a;
--           raise exception 'rótulo aceito: %', v; exception when check_violation then null; end;
--       end loop;
--       foreach v in array array['Pixel Art', 'Pixabay', 'Instagram'] loop
--         update public.producer_public set outras_redes = jsonb_build_array(jsonb_build_object('rotulo', v, 'url', 'https://a.com/x')) where producer_id = a;
--       end loop;
--
--       -- URLs (site e outras_redes.url) recusadas / aceita
--       foreach v in array array['https://xn--e1afmkfd.com', 'https://evokaa-suporte.com', 'https://pagamento.ev0kaa.io', 'https://www.xn--e1afmkfd.com/x'] loop
--         begin update public.producer_public set site = v where producer_id = a; raise exception 'site aceito: %', v;
--         exception when check_violation then null; end;
--         begin update public.producer_public set outras_redes = jsonb_build_array(jsonb_build_object('rotulo', 'Site', 'url', v)) where producer_id = a;
--           raise exception 'url de rede aceita: %', v; exception when check_violation then null; end;
--       end loop;
--       update public.producer_public set site = 'https://empresab.com.br/x',
--         outras_redes = jsonb_build_array(jsonb_build_object('rotulo', 'Site', 'url', 'https://empresab.com.br/x')) where producer_id = a;
--
--       -- e-mail
--       foreach v in array array['oi@x.com?subject=a', 'oi@x.com&a', 'oi@x.com#a', 'oi%40@x.com'] loop
--         begin update public.producer_public set email_contato = v where producer_id = a; raise exception 'email aceito: %', v;
--         exception when check_violation then null; end;
--       end loop;
--       update public.producer_public set email_contato = 'oi@x.com.br' where producer_id = a;
--     raise notice 'ENSAIO OK';
--   end $$;
--   -- idempotência: com a linha de ensaio ainda dentro desta transação, cole de novo o conteúdo entre o begin e o commit
--   -- da migração (sem esses dois) e ele deve rodar sem erro; depois o rollback desfaz tudo.
-- rollback;
