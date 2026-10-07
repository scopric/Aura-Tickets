-- =============================================================================
-- TESTES de 20261028_limite_por_cpf.sql (o código fica lá; este arquivo não vai para produção).
-- Rodar só em banco descartável, DEPOIS de aplicar o arquivo de código. Um bloco begin … rollback.
-- Cada teste termina com "NOTICE: Tn OK"; falha = ERROR com o valor recebido.
-- CPFs FICTÍCIOS, só válidos pelo algoritmo dos dígitos: 529.982.247-25 (A) e 111.444.777-35 (B).
-- =============================================================================
begin;

create function pg_temp.como(p uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), true);
  perform set_config('request.jwt.claims', case when p is null then '' else json_build_object('sub', p, 'role', 'authenticated', 'aal', 'aal2')::text end, true);
  perform set_config('role', case when p is null then 'postgres' else 'authenticated' end, true);
end $f$;
create function pg_temp.erro(q text) returns text language plpgsql as $f$
begin execute q; return 'ok'; exception when others then return sqlstate || ' ' || sqlerrm; end $f$;
create function pg_temp.u(n int) returns uuid language sql as $f$ select ('a4000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $f$;
-- pedido (como o usuário n) e item; devolvem 'ok' ou 'SQLSTATE mensagem'
create function pg_temp.pedido(n int, o int, cpf text, total numeric default 50) returns text language plpgsql as $f$
declare r text;
begin
  perform pg_temp.como(pg_temp.u(n));
  r := pg_temp.erro(format('insert into public.orders (id, user_id, event_id, total, status, customer_cpf) values (%L, %L, %L, %s, %L, %L)',
                           pg_temp.u(o), pg_temp.u(n), pg_temp.u(10), total, 'pending', cpf));
  perform pg_temp.como(null);
  return r;
end $f$;
create function pg_temp.item(n int, o int, t int, q int, preco numeric default 50) returns text language plpgsql as $f$
declare r text;
begin
  perform pg_temp.como(pg_temp.u(n));
  r := pg_temp.erro(format('insert into public.order_items (order_id, ticket_type_id, quantity, unit_price) values (%L, %L, %s, %s)',
                           pg_temp.u(o), pg_temp.u(t), q, preco));
  perform pg_temp.como(null);
  return r;
end $f$;
grant execute on all functions in schema pg_temp to anon, authenticated;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
select pg_temp.u(n), 'cpf-' || n || '@teste.invalid', now(), '{}'::jsonb from generate_series(1, 9) n;
insert into public.events (id, producer_id, title, slug, status, approval_status, start_date)
values (pg_temp.u(10), pg_temp.u(9), 'Evento CPF', 'cpf-10', 'published', 'approved', now() + interval '7 days');
-- 20 sem limite; 21 limite 2 SEM lotação (0); 22 limite 2 (outro tipo); 23 grátis limite 3 (baixa para 2 no T12)
insert into public.ticket_types (id, event_id, name, price, quantity_total, max_por_cpf) values
  (pg_temp.u(20), pg_temp.u(10), 'Livre', 50, 100, null),
  (pg_temp.u(21), pg_temp.u(10), 'Limitado', 50, 0, 2),
  (pg_temp.u(22), pg_temp.u(10), 'Outro', 50, 100, 2),
  (pg_temp.u(23), pg_temp.u(10), 'Grátis', 0, 100, 3);

do $$
declare r text; h1 bytea; h2 bytea;
begin
  -- T1: tipo sem limite + pedido sem CPF passa
  r := pg_temp.pedido(1, 31, null);
  if r <> 'ok' then raise exception 'T1 pedido sem CPF: %', r; end if;
  r := pg_temp.item(1, 31, 20, 1);
  if r <> 'ok' then raise exception 'T1 item sem limite: %', r; end if;
  raise notice 'T1 OK';

  -- T2: tipo com limite e pedido sem CPF é recusado
  r := pg_temp.item(1, 31, 21, 1);
  if r <> '22023 Informe o CPF do comprador para este ingresso' then raise exception 'T2: %', r; end if;
  raise notice 'T2 OK';

  -- T3: CPF inválido
  r := pg_temp.pedido(2, 32, '529.982.247-24');
  if r not like '22023 CPF inválido%' then raise exception 'T3: %', r; end if;
  r := pg_temp.pedido(2, 32, '11111111111');
  if r not like '22023 CPF inválido%' then raise exception 'T3 repetido: %', r; end if;
  raise notice 'T3 OK';

  -- T4/T5/T6: CPF vira hash, CPF puro some; hash forjado sem CPF é descartado; formatado = só dígitos
  r := pg_temp.pedido(1, 33, '529.982.247-25');
  if r <> 'ok' then raise exception 'T4 pedido com CPF: %', r; end if;
  select customer_cpf_hmac into h1 from public.orders where id = pg_temp.u(33);
  if h1 is null or (select customer_cpf from public.orders where id = pg_temp.u(33)) is not null then
    raise exception 'T4 hash nulo ou CPF gravado';
  end if;
  perform pg_temp.como(pg_temp.u(3));
  r := pg_temp.erro(format('insert into public.orders (id, user_id, event_id, total, status, customer_cpf_hmac) values (%L, %L, %L, 50, %L, %L)',
                           pg_temp.u(34), pg_temp.u(3), pg_temp.u(10), 'pending', h1));
  perform pg_temp.como(null);
  if r <> 'ok' or (select customer_cpf_hmac from public.orders where id = pg_temp.u(34)) is not null then
    raise exception 'T5 hash forjado não foi descartado: %', r;
  end if;
  r := pg_temp.pedido(2, 35, '52998224725');
  select customer_cpf_hmac into h2 from public.orders where id = pg_temp.u(35);
  if r <> 'ok' or h1 is distinct from h2 then raise exception 'T6 formatado e só dígitos dão hash diferente: %', r; end if;
  raise notice 'T4/T5/T6 OK';

  -- T7: limite 2 (tipo sem lotação): conta 1 pede 2 e passa; conta 2, MESMO CPF, pede 1 e é recusada; mensagem sem contagem
  r := pg_temp.item(1, 33, 21, 2);
  if r <> 'ok' then raise exception 'T7 primeiro pedido de 2: %', r; end if;
  r := pg_temp.item(2, 35, 21, 1);
  if r <> '22023 Limite de 2 ingressos por CPF neste ingresso' then raise exception 'T7 segunda conta: %', r; end if;
  if substr(r, 7) ~ '[013-9]' or r ~* 'já' then raise exception 'T7 mensagem revela contagem: %', r; end if;
  raise notice 'T7 OK (vale sem lotação)';

  -- T8: outro tipo de ingresso não conta
  r := pg_temp.item(2, 35, 22, 2);
  if r <> 'ok' then raise exception 'T8 outro tipo: %', r; end if;
  raise notice 'T8 OK';

  -- T9: pendente com mais de 30 min não conta
  update public.orders set created_at = now() - interval '31 minutes' where id = pg_temp.u(33);
  r := pg_temp.item(2, 35, 21, 1);
  if r <> 'ok' then raise exception 'T9 pendente vencido contou: %', r; end if;
  delete from public.order_items where order_id = pg_temp.u(35) and ticket_type_id = pg_temp.u(21);
  raise notice 'T9 OK';

  -- T10: pago conta (mesmo antigo)
  update public.orders set status = 'paid' where id = pg_temp.u(33);
  r := pg_temp.item(2, 35, 21, 1);
  if r <> '22023 Limite de 2 ingressos por CPF neste ingresso' then raise exception 'T10 pago não contou: %', r; end if;
  raise notice 'T10 OK';

  -- T11: linhas do mesmo pedido somam uma vez só (CPF B: 1 + 1 passa, + 1 falha)
  r := pg_temp.pedido(4, 36, '111.444.777-35');
  if r <> 'ok' then raise exception 'T11 pedido: %', r; end if;
  if pg_temp.item(4, 36, 21, 1) <> 'ok' or pg_temp.item(4, 36, 21, 1) <> 'ok' then raise exception 'T11 1 + 1 deveria passar'; end if;
  r := pg_temp.item(4, 36, 21, 1);
  if r <> '22023 Limite de 2 ingressos por CPF neste ingresso' then raise exception 'T11 terceira linha: %', r; end if;
  raise notice 'T11 OK';

  -- T12: confirmar_pedido_gratis recusa acima do limite (contando 'paid' de outra conta do mesmo CPF)
  r := pg_temp.pedido(5, 37, '11144477735', 0);
  if r <> 'ok' or pg_temp.item(5, 37, 23, 2, 0) <> 'ok' then raise exception 'T12 montagem 1: %', r; end if;
  perform pg_temp.como(pg_temp.u(5));
  if public.confirmar_pedido_gratis(pg_temp.u(37)) <> 2 then raise exception 'T12 primeira confirmação'; end if;
  perform pg_temp.como(null);
  update public.ticket_types set max_por_cpf = 3 where id = pg_temp.u(23);
  r := pg_temp.pedido(6, 38, '11144477735', 0);
  if r <> 'ok' or pg_temp.item(6, 38, 23, 1, 0) <> 'ok' then raise exception 'T12 montagem 2: %', r; end if;
  update public.ticket_types set max_por_cpf = 2 where id = pg_temp.u(23);
  perform pg_temp.como(pg_temp.u(6));
  r := pg_temp.erro(format('select public.confirmar_pedido_gratis(%L)', pg_temp.u(38)));
  perform pg_temp.como(null);
  if r <> '22023 Limite de 2 ingressos por CPF neste ingresso' then raise exception 'T12: %', r; end if;
  raise notice 'T12 OK';

  -- T13: authenticated e anon não leem o hash; o cliente não consegue trocá-lo (sem regra de UPDATE em orders)
  if has_column_privilege('authenticated', 'public.orders', 'customer_cpf_hmac', 'select')
     or has_column_privilege('anon', 'public.orders', 'customer_cpf_hmac', 'select') then
    raise exception 'T13 hash legível pela API';
  end if;
  perform pg_temp.como(pg_temp.u(4));
  r := pg_temp.erro(format('select customer_cpf_hmac from public.orders where id = %L', pg_temp.u(36)));
  perform pg_temp.como(null);
  if r not like '42501%' then raise exception 'T13 select do hash: %', r; end if;
  perform pg_temp.como(pg_temp.u(4));
  r := pg_temp.erro(format('update public.orders set customer_cpf_hmac = null where id = %L', pg_temp.u(36)));
  perform pg_temp.como(null);
  if (select customer_cpf_hmac from public.orders where id = pg_temp.u(36)) is null then raise exception 'T13 cliente apagou o hash (%)', r; end if;
  raise notice 'T13 OK (update: %)', r;

  -- T14: o produtor edita max_por_cpf
  perform pg_temp.como(pg_temp.u(9));
  r := pg_temp.erro(format('update public.ticket_types set max_por_cpf = 5 where id = %L', pg_temp.u(20)));
  perform pg_temp.como(null);
  if r <> 'ok' or (select max_por_cpf from public.ticket_types where id = pg_temp.u(20)) is distinct from 5 then
    raise exception 'T14 produtor não gravou max_por_cpf: %', r;
  end if;
  raise notice 'T14 OK';
end $$;

rollback;
