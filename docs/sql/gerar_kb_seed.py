#!/usr/bin/env python3
"""Gera docs/sql/20261003_kb_seed.sql a partir do levantamento da base de conhecimento (só biblioteca padrão).

Uso: python3 docs/sql/gerar_kb_seed.py <levantamento.md> docs/sql/20261003_kb_seed.sql
O levantamento é a nota "2026-09-30 Base de conhecimento — levantamento inicial" do cofre (fora do repositório).
Regras (PR 3a): verdadeiro_hoje -> published; depende_de_algo -> draft com o motivo em review_note;
nao_publicar fica fora (não está nos blocos Axx).
"""
import re
import sys

SETOR = {'participante': 'atendimento_participante', 'produtor': 'suporte_produtor', 'tecnico': 'suporte_tecnico',
         'comercial': 'comercial', 'financeiro': 'financeiro', 'parcerias': 'parcerias', 'privacidade': 'privacidade',
         'geral': 'geral'}
PUBLICO = {'todos': 'all', 'participante': 'participant', 'produtor': 'producer', 'site': 'site'}


def limpar(s):
    return re.sub(r'\*\*|`', '', s).strip()


def q(s):
    return "'" + s.replace("'", "''") + "'" if s is not None else 'null'


def ler(caminho):
    texto = open(caminho, encoding='utf-8').read()
    # só a seção 1 (artigos); a 2 (nao_publicar) e a 3 (lacunas) ficam fora
    secao = texto.split('## 1. Artigos propostos', 1)[1].split('\n## 2.', 1)[0]
    blocos = re.split(r'^\*\*(A\d\d)\*\*\s*$', secao, flags=re.M)[1:]
    artigos = []
    for cod, corpo in zip(blocos[::2], blocos[1::2]):
        campo = {}
        for linha in corpo.splitlines():
            m = re.match(r'^- \*\*(\w+):\*\* (.*)$', linha)
            if m and m.group(1) not in campo:  # A21 tem duas linhas "fonte": vale a 1ª
                campo[m.group(1)] = m.group(2)
        pub, setor = re.match(r'^(\w+) · \*\*setor:\*\* (\w+)$', campo['publico']).groups()
        estado = campo['estado']
        if estado.startswith('verdadeiro_hoje'):
            status, nota = 'published', None
        elif estado.startswith('depende_de_algo'):
            status, nota = 'draft', limpar(estado[len('depende_de_algo'):].lstrip(' .:'))
        else:
            raise SystemExit(f'{cod}: estado desconhecido: {estado[:40]}')
        artigos.append({
            'slug': 'lev-' + cod.lower(), 'title': limpar(campo['titulo']), 'body': limpar(campo['corpo']),
            'keywords': limpar(campo['palavras_chave']), 'audience': PUBLICO[pub], 'setor': SETOR[setor],
            'status': status, 'review_note': (nota or None) and nota[:1000],
        })
    return artigos


def conferir(artigos):
    assert len(artigos) == 58, len(artigos)
    assert [a['slug'] for a in artigos] == [f'lev-a{i:02d}' for i in range(1, 59)]
    for a in artigos:
        assert 5 <= len(a['title']) <= 160, a['slug']
        assert 10 <= len(a['body']) <= 3500, a['slug']
        assert len(a['keywords']) <= 500, a['slug']
        assert (a['status'] == 'draft') == bool(a['review_note']), a['slug']
    pub = sum(a['status'] == 'published' for a in artigos)
    assert (pub, 58 - pub) == (39, 19), (pub, 58 - pub)  # 30/09: +A34, A53 e A17 publicados
    return pub


def gerar(artigos, pub):
    linhas = ',\n'.join(
        f"  ({q(a['slug'])}, {q(a['title'])},\n   {q(a['body'])},\n   {q(a['keywords'])}, {q(a['audience'])}, "
        f"{q(a['setor'])}, {q(a['status'])},\n   {q(a['review_note'])})" for a in artigos)
    return f"""-- =============================================================================
-- Base de conhecimento do atendimento (etapa 3, PR 3a) — seed dos 58 artigos do levantamento — 2026-10-03
-- GERADO por docs/sql/gerar_kb_seed.py a partir de Claude/Entregas/2026-09-30 Base de conhecimento —
-- levantamento inicial (blocos A01…A58). Não editar à mão: corrija o levantamento e gere de novo com
--   python3 docs/sql/gerar_kb_seed.py <levantamento.md> docs/sql/20261003_kb_seed.sql
-- Aplicar à mão no SQL Editor, DEPOIS de docs/sql/20261003_chat_bot.sql. NÃO vai para supabase/migrations.
-- {pub} publicados (verdadeiro_hoje) e {58 - pub} rascunhos (depende_de_algo, com o motivo em review_note).
-- Os textos marcados nao_publicar ficam fora.
-- Idempotente: artigo que já existe (mesmo slug) não é tocado, então a edição feita no admin fica; artigo
-- excluído no admin (kb_slugs_excluidos) não volta.
-- =============================================================================
begin;

insert into public.kb_articles (slug, title, body, keywords, audience, department_id, status, origin, review_note)
select v.slug, v.title, v.body, v.keywords, v.audience, d.id, v.status, 'seed', v.review_note
from (values
{linhas}
) as v(slug, title, body, keywords, audience, setor, status, review_note)
join public.chat_departments d on d.slug = v.setor
where not exists (select 1 from public.kb_slugs_excluidos x where x.slug = v.slug)
on conflict (slug) do nothing;

-- Conferência: os 58 estão na base ou foram excluídos pelo admin (setor que não casou também cai aqui)
do $$
declare
  v_n int := (select count(*) from public.kb_articles a where a.slug ~ '^lev-a[0-9]{{2}}$')
           + (select count(*) from public.kb_slugs_excluidos x where x.slug ~ '^lev-a[0-9]{{2}}$'
                and not exists (select 1 from public.kb_articles a where a.slug = x.slug));
begin
  if v_n <> 58 then
    raise exception 'seed da base: esperava 58 artigos (presentes + excluídos), achei %', v_n;
  end if;
end;
$$;

commit;
"""


if __name__ == '__main__':
    arts = ler(sys.argv[1])
    n = conferir(arts)
    open(sys.argv[2], 'w', encoding='utf-8').write(gerar(arts, n))
    print(f'ok: {len(arts)} artigos, {n} publicados, {58 - n} rascunhos -> {sys.argv[2]}')
