-- pgTAP de docs/sql/20261031c_qr_dinamico.sql. Banco com o baseline + docs/sql até este arquivo; `supabase test db`.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(5);

select has_column('public', 'tickets', 'qr_dinamico_desde', 'tickets.qr_dinamico_desde existe');
select col_type_is('public', 'tickets', 'qr_dinamico_desde', 'timestamp with time zone', 'é timestamptz');
select col_is_null('public', 'tickets', 'qr_dinamico_desde', 'aceita nulo (nulo = ainda no QR fixo)');
select col_hasnt_default('public', 'tickets', 'qr_dinamico_desde', 'sem valor padrão: só a função preenche');
-- o cliente não escreve em tickets: sem política PERMISSIVE de INSERT, UPDATE, DELETE ou ALL (a gf_mfa_aal2 é RESTRICTIVE e só restringe)
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'tickets' and permissive = 'PERMISSIVE' and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')), 0,
  'tickets não tem política de escrita para o cliente: o comprador não grava qr_dinamico_desde');

select * from finish();
rollback;
