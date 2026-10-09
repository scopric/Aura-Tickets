/* Meus quadros: protótipo com dados fictícios. Nada é salvo nem enviado. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var LIMITE = 30, CORES = ['#6b7a93', '#8f33f5', '#c98a1e', '#2e9a76', '#d0527a'];
  var PASTAS = ['#8f33f5', '#1f9d8f', '#3f7fe0', '#0c2340', '#8f33f5', '#1f9d8f']; // 4 tons suaves das capas
  var TIPOS = { pessoal: 'Pessoal', equipe: 'Equipe e empresa', evento: 'Evento' };
  var SECOES = [['pessoal', 'Pessoais'], ['equipe', 'Equipe e empresa'], ['evento', 'Por evento']];
  var VIS = { eu: 'Só eu', equipe: 'Equipe toda', escolhidas: 'Pessoas escolhidas' };

  var PESSOAS = [
    { id: 'eu', nome: 'Marina Teixeira', papel: 'Produtora' },
    { id: 'p2', nome: 'Rafael Nogueira', papel: 'Gestor da equipe' },
    { id: 'p3', nome: 'Camila Duarte', papel: 'Financeiro' },
    { id: 'p4', nome: 'Bruno Almeida', papel: 'Operação' },
    { id: 'p5', nome: 'Larissa Campos', papel: 'Comunicação' },
    { id: 'p6', nome: 'Tiago Moreira', papel: 'Atendimento' }
  ];
  var EVENTOS = [
    { id: 'e1', nome: 'Festival Maré Alta', data: '2026-10-24' },
    { id: 'e2', nome: 'Noite do Samba Aberto', data: '2026-11-14' },
    { id: 'e3', nome: 'Feira Sabores do Sul', data: '2026-12-05' },
    { id: 'e4', nome: 'Encontro Horizonte', data: '2026-09-12' }
  ];
  function c(t, p, d) { return { t: t, p: p, d: d }; }
  var MODELOS = [
    { id: 'm1', cat: 'eventos', nome: 'Evento completo', ic: 'estrela', desc: 'Do alvará ao fechamento do caixa.', col: ['A fazer', 'Em andamento', 'Em revisão', 'Feito'],
      cartoes: [c('Confirmar local e contrato', 'Produção', 60), c('Pedir alvará e vistoria', 'Operação', 45), c('Fechar line-up e cachês', 'Produção', 40), c('Abrir venda de ingressos', 'Comunicação', 35), c('Contratar som e iluminação', 'Operação', 30), c('Plano de segurança e acessos', 'Operação', 20), c('Credenciar equipe e fornecedores', 'Atendimento', 7), c('Passagem de som e checagem final', 'Produção', 1), c('Conferir caixa e fechamento', 'Financeiro', -2)] },
    { id: 'm2', cat: 'pessoal', nome: 'Dia a dia do produtor', ic: 'sol', desc: 'Hoje, esta semana e o que espera resposta.', col: ['Hoje', 'Esta semana', 'Aguardando', 'Feito'],
      cartoes: [c('Responder fornecedores', 'Produção'), c('Revisar agenda da semana', 'Produção'), c('Cobrar retorno pendente', 'Produção')] },
    { id: 'm3', cat: 'eventos', nome: 'Fornecedores e contratos', ic: 'caminhao', desc: 'Da cotação ao contrato assinado.', col: ['Cotando', 'Negociando', 'Contratado', 'Pago'],
      cartoes: [c('Cotar buffet e bebidas', 'Produção', 50), c('Cotar segurança', 'Operação', 45), c('Assinar contrato de som', 'Produção', 30), c('Acompanhar pagamento do palco', 'Financeiro', 14)] },
    { id: 'm4', cat: 'eventos', nome: 'Divulgação', ic: 'megafone', desc: 'Ideias, produção e calendário de posts.', col: ['Ideias', 'Produzindo', 'Agendado', 'Publicado'],
      cartoes: [c('Teaser de anúncio', 'Comunicação', 40), c('Arte do cartaz', 'Comunicação', 38), c('Série de bastidores', 'Comunicação', 20), c('Lembrete de última semana', 'Comunicação', 7)] },
    { id: 'm5', cat: 'eventos', nome: 'Pós-evento', ic: 'bandeira', desc: 'Relatório, certificados e agradecimentos.', col: ['Relatório', 'Certificados', 'Agradecimentos', 'Pesquisa', 'Feito'],
      cartoes: [c('Relatório de público', 'Produção', -3), c('Emitir certificados', 'Atendimento', -5), c('Agradecer parceiros', 'Comunicação', -2), c('Enviar pesquisa de satisfação', 'Atendimento', -4)] },
    { id: 'm6', cat: 'equipe', nome: 'Reunião de equipe', ic: 'balao', desc: 'Pauta, decisões e ações com responsável.', col: ['Pauta', 'Em discussão', 'Decisões', 'Ações'],
      cartoes: [c('Resultados da semana', 'Gestão'), c('Pontos de atenção', 'Gestão'), c('Próximos passos', 'Gestão')] },
    { id: 'm7', cat: 'equipe', nome: 'Financeiro da equipe', ic: 'carteira', desc: 'Só acompanhamento: o sistema nunca paga.', col: ['A pagar', 'Em aprovação', 'Pago', 'Conciliado'],
      cartoes: [c('Acompanhar nota do fornecedor de som', 'Financeiro'), c('Acompanhar repasse da bilheteria', 'Financeiro'), c('Conferir conciliação do mês', 'Financeiro')] },
    { id: 'm8', cat: 'eventos', nome: 'Lançamento de vendas', ic: 'foguete', desc: 'Pré-venda, abertura de lotes e encerramento.', col: ['Preparar', 'Pré-venda', 'Vendas abertas', 'Encerrado'],
      cartoes: [c('Definir lotes e preços', 'Produção', 45), c('Montar lista de pré-venda', 'Comunicação', 38), c('Testar compra de ponta a ponta', 'Atendimento', 36), c('Abrir lote 1', 'Produção', 35), c('Encerrar lote 1', 'Produção', 21)] }
  ];
  var CATS = [['todos', 'Todos'], ['eventos', 'Eventos'], ['equipe', 'Equipe e empresa'], ['pessoal', 'Pessoal']];
  var COL3 = ['A fazer', 'Em andamento', 'Feito'];

  function q(id, nome, tipo, ev, vis, mem, n, atr, ok, extra) {
    var b = { id: id, nome: nome, tipo: tipo, evento: ev, vis: vis, mem: mem || {}, n: n, atr: atr, ok: ok, dono: 'eu', arq: false, col: COL3, prazo: null, ord: 0, cor: PASTAS[0] };
    for (var k in extra) b[k] = extra[k];
    return b;
  }
  var quadros = [
    q('q1', 'Minhas tarefas da semana', 'pessoal', null, 'eu', {}, 12, 1, 5, { prazo: '2026-10-16', ord: 5, cor: PASTAS[3] }),
    q('q2', 'Agenda da equipe 2026', 'equipe', null, 'equipe', {}, 18, 2, 9, { ord: 4, cor: PASTAS[1] }),
    q('q3', 'Parcerias e patrocínios', 'equipe', null, 'escolhidas', { eu: 'editar', p3: 'ver' }, 14, 0, 3, { dono: 'p2', ord: 3, cor: PASTAS[2], prazo: '2026-11-30' }),
    q('q4', 'Festival Maré Alta', 'evento', 'e1', 'escolhidas', { p2: 'editar', p3: 'ver', p4: 'editar', p5: 'editar' }, 31, 4, 14, { ord: 7, cor: PASTAS[0], col: MODELOS[0].col }),
    q('q5', 'Noite do Samba Aberto', 'evento', 'e2', 'equipe', {}, 22, 1, 6, { ord: 6, cor: PASTAS[4] }),
    q('q6', 'Feira Sabores do Sul', 'evento', 'e3', 'escolhidas', { p3: 'ver', p6: 'editar' }, 9, 0, 0, { ord: 2, cor: PASTAS[1], parado: 14 }),
    q('q7', 'Encontro Horizonte (2026)', 'evento', 'e4', 'equipe', {}, 40, 0, 40, { arq: true, ord: 1, cor: PASTAS[5] })
  ];
  var seq = 10, pessoa = function (id) { return PESSOAS.filter(function (p) { return p.id === id; })[0]; };
  var evento = function (id) { return EVENTOS.filter(function (e) { return e.id === id; })[0]; };
  var TIPO_IC = { evento: 'calendario', equipe: 'pessoas', pessoal: 'usuario' };
  var CAT_TIPO = { eventos: 'evento', equipe: 'equipe', pessoal: 'pessoal' }, TIPO_CAT = { evento: 'eventos', equipe: 'equipe', pessoal: 'pessoal' };

  /* ---------- funções puras ---------- */
  function validarNome(v) {
    var n = String(v).trim();
    if (!n) return 'Digite um nome para o quadro.';
    if (n.length > 40) return 'O nome pode ter no máximo 40 caracteres.';
    if (/[<>]/.test(n)) return 'O nome não pode ter os sinais < ou >.';
    if (/[\u0000-\u001f\u007f-\u009f]/.test(n)) return 'O nome não pode ter caracteres de controle.';
    return '';
  }
  function prazoDe(b) { return b.evento ? evento(b.evento).data : b.prazo; }
  var HOJE = Date.UTC(2026, 9, 9); // data fictícia fixa do protótipo
  var MES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'], SEM = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
  function infoData(iso) {
    var p = iso.split('-'), t = Date.UTC(+p[0], p[1] - 1, +p[2]);
    return { dia: +p[2], mes: MES[p[1] - 1], sem: SEM[new Date(t).getUTCDay()], falta: Math.round((t - HOJE) / 864e5) };
  }
  function dataBR(iso) { var p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function sem(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function ordenar(lista, modo, tipo) {
    var l = lista.slice();
    if (tipo === 'evento' && modo === 'recentes') modo = 'prazo';
    l.sort(function (a, b) {
      if (modo === 'az') return a.nome.localeCompare(b.nome, 'pt-BR');
      if (modo === 'prazo') {
        var x = prazoDe(a), y = prazoDe(b);
        return x && y ? (x < y ? -1 : x > y ? 1 : 0) : x ? -1 : y ? 1 : 0;
      }
      return b.ord - a.ord;
    });
    return l;
  }
  function visiveis(b) {
    if (b.vis === 'eu') return [b.dono];
    if (b.vis === 'equipe') return PESSOAS.map(function (p) { return p.id; });
    return [b.dono].concat(Object.keys(b.mem));
  }

  /* ---------- DOM ---------- */
  function el(tag, props, kids) {
    var e = document.createElement(tag);
    for (var k in props || {}) {
      if (k === 'dataset') for (var d in props[k]) e.dataset[d] = props[k][d];
      else if (k === 'attrs') for (var a in props[k]) e.setAttribute(a, props[k][a]);
      else e[k] = props[k];
    }
    [].concat(kids || []).forEach(function (n) { e.append(n); });
    return e;
  }
  var ICONES = {
    pasta: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    eu: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    equipe: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5a3 3 0 0 1 0 6M18 14a6 6 0 0 1 3 6"/>',
    escolhidas: '<circle cx="12" cy="8" r="3.2"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    calendario: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    pessoas: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5a3 3 0 0 1 0 6M18 14a6 6 0 0 1 3 6"/>',
    usuario: '<circle cx="12" cy="8" r="3.2"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    estrela: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    sol: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/>',
    caminhao: '<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
    megafone: '<path d="M4 10v4h3l8 4V6L7 10zM18 9a4 4 0 0 1 0 6"/>',
    bandeira: '<path d="M6 21V4M6 5h11l-2 4 2 4H6"/>',
    balao: '<path d="M4 5h11v8H9l-3 3v-3H4zM18 9h2v8h-2v3l-3-3h-5v-2"/>',
    carteira: '<path d="M4 7h15a1 1 0 0 1 1 1v10H5a1 1 0 0 1-1-1zM4 7l12-3v3M16 13h2"/>',
    foguete: '<path d="M12 3c4 2 6 6 5 11l-3 2h-4l-3-2C6 9 8 5 12 3zM9 17l-2 4M15 17l2 4"/><circle cx="12" cy="10" r="1.6"/>',
    mais: '<path d="M12 5v14M5 12h14"/>',
    tres: '<circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>'
  };
  function icone(n) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('class', 'i'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
    s.innerHTML = ICONES[n]; // só constantes do código, nunca texto do usuário
    return s;
  }
  var iniciais = function (n) { return n.split(' ').map(function (s) { return s[0]; }).slice(0, 2).join(''); };
  function avatar(id) {
    var i = PESSOAS.indexOf(pessoa(id));
    return el('span', { className: 'av', textContent: iniciais(pessoa(id).nome), title: pessoa(id).nome, style: 'background:' + PASTAS[(i + 1) % 6] });
  }

  var toastT;
  function aviso(txt, abrirLink) {
    var t = el('div', { className: 'toast' }, [el('span', { textContent: txt })]);
    if (abrirLink) t.append(el('a', { href: './index.html', textContent: 'Abrir' }));
    $('avisos').replaceChildren(t);
    clearTimeout(toastT); toastT = setTimeout(function () { t.remove(); }, 6000);
  }

  /* segmentado com setas */
  function seg(box, opcoes, onChange) {
    box.setAttribute('role', 'radiogroup');
    var bt = opcoes.map(function (o) {
      var b = el('button', { type: 'button', textContent: o[1], dataset: { v: o[0] }, attrs: { role: 'radio' } });
      box.append(b); return b;
    });
    var api = {
      valor: null,
      set: function (v) { api.valor = v; bt.forEach(function (b) { var on = b.dataset.v === v; b.setAttribute('aria-checked', on); b.tabIndex = on ? 0 : -1; }); },
      off: function (fn) { bt.forEach(function (b) { b.disabled = fn(b.dataset.v); }); }
    };
    bt.forEach(function (b, i) {
      b.addEventListener('click', function () { api.set(b.dataset.v); onChange(b.dataset.v); });
      b.addEventListener('keydown', function (e) {
        var d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!d) return;
        e.preventDefault();
        for (var k = 1; k < bt.length; k++) {
          var n = bt[(i + d * k + bt.length * k) % bt.length];
          if (!n.disabled) { n.focus(); n.click(); return; }
        }
      });
    });
    return api;
  }

  /* ---------- diálogos ---------- */
  var aberto = null, gatilho = null;
  var FOCO = 'button:not([disabled]),input:not([disabled]),select:not([disabled]),a[href]';
  function focaveis(d) { return [].filter.call(d.querySelectorAll(FOCO), function (e) { return !e.closest('[hidden]'); }); }
  function abrir(d, de, foco) {
    fechar(true);
    aberto = d; gatilho = de || document.activeElement;
    d.hidden = false; d.classList.add('on');
    var f = (foco && $(foco)) || focaveis(d).filter(function (e) { return !e.classList.contains('fechar'); })[0];
    if (f) f.focus();
  }
  function fechar(semFoco) {
    if (!aberto) return;
    aberto.hidden = true; aberto.classList.remove('on'); aberto = null;
    if (!semFoco) {
      var g = document.body.contains(gatilho) ? gatilho : $('criar');
      g.focus();
    }
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (!$('menu').hidden) { fecharMenu(true); return; }
      if (aberto) { e.preventDefault(); fechar(); }
    }
    if (e.key === 'Tab' && aberto) {
      var f = focaveis(aberto), p = f[0], u = f[f.length - 1];
      if (e.shiftKey && document.activeElement === p) { e.preventDefault(); u.focus(); }
      else if (!e.shiftKey && document.activeElement === u) { e.preventDefault(); p.focus(); }
      else if (f.indexOf(document.activeElement) < 0) { e.preventDefault(); p.focus(); }
    }
  });
  [].forEach.call(document.querySelectorAll('.veu,.gv'), function (v) {
    v.addEventListener('mousedown', function (e) { if (e.target === v) fechar(); });
    [].forEach.call(v.querySelectorAll('[data-fechar]'), function (b) { b.addEventListener('click', function () { fechar(); }); });
  });

  /* ---------- tela principal ---------- */
  var est = { busca: '', ordem: 'recentes', filtro: 'todos', aba: 'ativos', novo: null };
  var FILTROS = [['todos', 'Todos'], ['pessoal', 'Pessoais'], ['equipe', 'Equipe e empresa'], ['evento', 'Por evento']];

  function capa(ic, tom) { return el('span', { className: 'capa', style: '--t:' + tom, attrs: { 'aria-hidden': 'true' } }, [icone(ic)]); }
  function apoio(b, ev) {
    var q = b.vis === 'eu' ? 'Só você' : b.vis === 'equipe' ? 'Equipe toda · ' + PESSOAS.length + ' pessoas' : visiveis(b).length + ' pessoas';
    if (ev) { var d = infoData(ev.data); return d.dia + ' ' + d.mes.toLowerCase() + ' · ' + q; }
    return q;
  }
  function cartaoPasta(b, grande) {
    var vis = visiveis(b), ev = b.evento ? evento(b.evento) : null;
    var pilha = el('div', { className: 'pilha', attrs: { role: 'group', 'aria-label': 'Quem vê: ' + vis.map(function (i) { return pessoa(i).nome; }).join(', ') } },
      vis.slice(0, 3).map(avatar));
    if (vis.length > 3) pilha.append(el('span', { className: 'av mais', textContent: '+' + (vis.length - 3) }));
    var tres = el('button', { type: 'button', className: 'tres', attrs: { 'aria-label': 'Ações do quadro ' + b.nome, 'aria-haspopup': 'menu' } }, [icone('tres')]);
    tres.addEventListener('click', function () { abrirMenu(b, tres); });
    var dt, st = '';
    if (ev) {
      var d = infoData(ev.data);
      st = d.falta < 0 ? 'feito' : d.falta <= 14 ? 'logo' : '';
      dt = [el('b', { textContent: d.dia }), el('span', { textContent: d.mes }), el('small', { textContent: d.falta < 0 ? 'HÁ ' + (-d.falta) + ' D' : 'EM ' + d.falta + ' D' })];
    } else {
      st = b.atr ? 'vence' : '';
      dt = [el('b', { textContent: b.n - b.ok }), el('span', { textContent: 'abertos' })];
    }
    if (b.atr) dt.push(el('small', { className: 'atr', textContent: b.atr + (b.atr === 1 ? ' atrasado' : ' atrasados') }));
    return el('article', { className: 'cartao' + (grande ? ' grande' : '') + (b.arq ? ' arq' : '') + (est.novo === b.id ? ' novo-auto' : '') }, [
      el('div', { className: 'bilhete' }, [
        el('div', { className: 'principal' }, [
          el('div', { className: 'cab-c' }, [capa(TIPO_IC[b.tipo], b.cor), el('div', {}, [el('h3', {}, [el('a', { href: './index.html', textContent: b.nome, title: b.nome })]), el('div', { className: 'apoio', textContent: apoio(b, ev) })])]),
          pilha
        ]),
        el('div', { className: 'canhoto ' + (b.arq ? '' : st) }, [el('div', { className: 'data' }, dt)])
      ]),
      el('div', { className: 'acoes' }, [tres])
    ]);
  }

  var FILTRO_CAT = { todos: 'todos', pessoal: 'pessoal', equipe: 'equipe', evento: 'eventos' };
  function rotulo(tag, id, txt) { return el(tag, { id: id, className: 'rot-sec', textContent: txt }); }

  function render() {
    var termo = sem(est.busca.trim()), arqOn = est.aba === 'arquivados';
    var arq = quadros.filter(function (b) { return b.arq; }).length;
    $('arqLink').textContent = arqOn ? 'Voltar aos quadros ativos' : 'Ver arquivados (' + arq + ')';
    var chips = $('chips'); chips.replaceChildren();
    FILTROS.forEach(function (f) {
      var b = el('button', { type: 'button', textContent: f[1], attrs: { 'aria-pressed': est.filtro === f[0] } });
      b.addEventListener('click', function () { est.filtro = f[0]; render(); chips.querySelector('[aria-pressed=true]').focus(); });
      chips.append(b);
    });
    var rec = $('recentes'), box = $('todos'); rec.replaceChildren(); box.replaceChildren();
    var jaVistos = {};
    if (!arqOn && !termo && est.filtro === 'todos') {
      var ult = quadros.filter(function (b) { return !b.arq; }).sort(function (a, b) { return b.ord - a.ord; }).slice(0, 3);
      ult.forEach(function (b) { jaVistos[b.id] = 1; });
      rec.append(rotulo('h2', 'sec-recentes', 'Recentes'), el('div', { className: 'grade g' }, ult.map(function (b) { return cartaoPasta(b, true); })));
    }
    var bloco = el('div', { className: 'bloco-s' }, [rotulo('h2', 'sec-todos', arqOn ? 'Arquivados' : 'Todos os quadros')]);
    var gradeTile = null;
    function tile() {
      var t = el('button', { type: 'button', className: 'criar-tile' }, [icone('mais'), document.createTextNode('Criar quadro')]);
      t.addEventListener('click', function () { abrirCriar(t, FILTRO_CAT[est.filtro]); });
      return t;
    }
    var feitas = 0;
    SECOES.forEach(function (s) {
      if (est.filtro !== 'todos' && est.filtro !== s[0]) return;
      var lista = ordenar(quadros.filter(function (b) {
        return b.tipo === s[0] && b.arq === arqOn && !jaVistos[b.id] && (!termo || sem(b.nome).indexOf(termo) >= 0);
      }), est.ordem, s[0]);
      if (!lista.length) return;
      var cards = lista.map(function (b) { return cartaoPasta(b, false); });
      if (!feitas && !arqOn) cards.unshift(tile());
      feitas++;
      var sec = el('section', { attrs: { 'aria-labelledby': 'sec-' + s[0] } }, [rotulo('h3', 'sec-' + s[0], s[1]), el('div', { className: 'grade' }, cards)]);
      bloco.append(sec);
    });
    if (!feitas) {
      bloco.append(el('p', { className: 'vazio', textContent: arqOn ? 'Nenhum quadro arquivado.' : 'Nenhum quadro encontrado.' }));
      if (!arqOn) bloco.append(el('div', { className: 'grade' }, [tile()]));
    }
    box.append(bloco);
  }

  $('arqLink').addEventListener('click', function () { est.aba = est.aba === 'ativos' ? 'arquivados' : 'ativos'; render(); });
  $('busca').addEventListener('input', function (e) { est.busca = e.target.value; render(); });
  $('ordem').addEventListener('change', function (e) { est.ordem = e.target.value; render(); });
  $('criar').addEventListener('click', function () { abrirCriar($('criar')); });

  /* ---------- menu de 3 pontos ---------- */
  var menuBtn = null;
  function fecharMenu(foco) { var m = $('menu'); if (m.hidden) return; m.hidden = true; if (foco && menuBtn && document.body.contains(menuBtn)) menuBtn.focus(); }
  function abrirMenu(b, btn) {
    var m = $('menu'); menuBtn = btn; m.replaceChildren();
    var dono = b.dono === 'eu';
    var itens = [
      el('a', { href: './index.html', className: 'mb', textContent: 'Abrir', attrs: { role: 'menuitem' } }),
      item('Renomear', !dono, function () { abrirNome('Renomear quadro', 'Novo nome', b.nome, btn, function (n) { b.nome = n; render(); aviso('Quadro renomeado.'); }); }),
      item('Membros', false, function () { abrirMembros(b, btn); }),
      item('Salvar como modelo', false, function () {
        abrirNome('Salvar como modelo', 'Nome do modelo', ('Modelo ' + b.nome).slice(0, 40), btn, function (n) {
          MODELOS.push({ id: 'm' + (++seq), cat: TIPO_CAT[b.tipo], nome: n, ic: TIPO_IC[b.tipo], desc: 'Salvo a partir de um quadro seu.', col: b.col, cartoes: [], meu: true });
          aviso('Modelo salvo.');
        });
      }),
      item(b.arq ? 'Desarquivar' : 'Arquivar', !dono, function () { b.arq = !b.arq; render(); aviso(b.arq ? 'Quadro arquivado.' : 'Quadro desarquivado.'); })
    ];
    m.append.apply(m, itens); m.hidden = false;
    var r = btn.getBoundingClientRect();
    m.style.top = Math.min(r.bottom + 4, window.innerHeight - 220) + 'px';
    m.style.left = Math.max(8, Math.min(r.right - 210, window.innerWidth - 220)) + 'px';
    itens[0].focus();
  }
  function item(txt, off, fn) {
    var b = el('button', { type: 'button', className: 'mb', textContent: txt + (off ? ' (só o dono)' : ''), disabled: off, attrs: { role: 'menuitem' } });
    b.addEventListener('click', function () { fecharMenu(false); fn(); });
    return b;
  }
  $('menu').addEventListener('keydown', function (e) {
    var it = [].filter.call($('menu').querySelectorAll('[role=menuitem]'), function (x) { return !x.disabled; });
    var i = it.indexOf(document.activeElement), d = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (d) { e.preventDefault(); it[(i + d + it.length) % it.length].focus(); }
    if (e.key === 'Tab') { e.preventDefault(); fecharMenu(true); }
  });
  document.addEventListener('mousedown', function (e) { if (!$('menu').hidden && !$('menu').contains(e.target)) fecharMenu(false); });

  /* ---------- diálogo de nome (renomear / salvar modelo) ---------- */
  var nomeCb = null;
  function abrirNome(titulo, rotulo, valor, de, cb) {
    $('nomeT').textContent = titulo; $('nome2Rot').textContent = rotulo;
    $('nome2').value = valor; $('nome2Erro').textContent = ''; $('nome2').removeAttribute('aria-invalid');
    nomeCb = cb; abrir($('dlgNome'), de, 'nome2'); $('nome2').select();
  }
  function confirmarNome() {
    var e = validarNome($('nome2').value);
    $('nome2Erro').textContent = e; $('nome2').setAttribute('aria-invalid', !!e);
    if (e) { $('nome2').focus(); return; }
    var cb = nomeCb, v = $('nome2').value.trim(); fechar(); cb(v);
  }
  $('nomeOk').addEventListener('click', confirmarNome);
  $('nome2').addEventListener('keydown', function (e) { if (e.key === 'Enter') confirmarNome(); });

  /* ---------- membros ---------- */
  var mvis, membrosB = null;
  function abrirMembros(b, de) { membrosB = b; abrir($('dlgMembros'), de); renderMembros(); }
  function renderMembros() {
    var b = membrosB, dono = b.dono === 'eu', pessoal = b.tipo === 'pessoal', trava = !dono;
    $('memSub').textContent = b.nome;
    var av = $('memAviso');
    av.hidden = dono && !pessoal;
    av.textContent = pessoal ? 'Pessoal: fica só com você.' : 'Só ' + pessoa(b.dono).nome + ' (dono) altera os membros. Você só pode ver.';
    if (!mvis) mvis = seg($('mvisSeg'), Object.keys(VIS).map(function (k) { return [k, VIS[k]]; }), function (v) {
      membrosB.vis = v; if (v === 'escolhidas') membrosB.mem = membrosB.mem || {}; renderMembros(); render();
    });
    mvis.set(b.vis); mvis.off(function () { return trava || pessoal; });
    var lista = $('memLista'); lista.replaceChildren();
    lista.append(linhaPessoa(b.dono, el('span', { textContent: 'Dono' })));
    if (b.vis === 'equipe') lista.append(el('div', { className: 'pes', textContent: 'A equipe toda pode ver.' }));
    if (b.vis === 'escolhidas') Object.keys(b.mem).forEach(function (id) {
      var s = nivel(b.mem[id], 'Nível de ' + pessoa(id).nome, trava, function (v) { b.mem[id] = v; });
      var rm = el('button', { type: 'button', className: 'btn', textContent: 'Remover', disabled: trava, attrs: { 'aria-label': 'Remover ' + pessoa(id).nome } });
      rm.addEventListener('click', function () { delete b.mem[id]; renderMembros(); render(); });
      lista.append(linhaPessoa(id, s, rm));
    });
    var livres = PESSOAS.filter(function (p) { return p.id !== b.dono && !(p.id in b.mem); });
    var sel = $('memSel'); sel.replaceChildren();
    livres.forEach(function (p) { sel.append(el('option', { value: p.id, textContent: p.nome + ' (' + p.papel + ')' })); });
    var pode = b.vis === 'escolhidas' && !trava && livres.length > 0;
    $('memAdd').hidden = b.vis !== 'escolhidas'; sel.disabled = $('memBtn').disabled = !pode;
  }
  $('memBtn').addEventListener('click', function () {
    var b = membrosB, id = $('memSel').value;
    if (!id) return;
    b.mem[id] = 'ver'; renderMembros(); render(); $('memSel').focus();
  });
  function nivel(v, rotulo, off, fn) {
    var s = el('select', { className: 'campo', disabled: off, attrs: { 'aria-label': rotulo } }, [el('option', { value: 'ver', textContent: 'Pode ver' }), el('option', { value: 'editar', textContent: 'Pode editar' })]);
    s.value = v; s.addEventListener('change', function () { fn(s.value); });
    return s;
  }
  function linhaPessoa(id, ...extra) {
    return el('div', { className: 'pes' }, [avatar(id), el('div', { className: 'nm' }, [el('b', { textContent: pessoa(id).nome }), el('span', { textContent: pessoa(id).papel })])].concat(extra));
  }

  /* ---------- criar quadro ---------- */
  var cr, tipoSeg, visSeg;
  function abrirCriar(de, cat) {
    if (quadros.length >= LIMITE) { aviso('Limite de ' + LIMITE + ' quadros no protótipo.'); return; }
    cr = { passo: 1, cat: cat || 'todos', busca: '', modelo: 'zero', nome: '', nomeDe: null, tipo: 'equipe', ev: EVENTOS[0].id, vis: 'equipe', sel: {} };
    $('buscaMod').value = '';
    mostrarPasso(); abrir($('dlgCriar'), de, 'buscaMod'); renderPasso1();
  }
  function modeloAtual() { return MODELOS.filter(function (m) { return m.id === cr.modelo; })[0]; }
  function mostrarPasso() {
    var p1 = cr.passo === 1;
    $('passo1').hidden = !p1; $('passo2').hidden = p1; $('voltar').hidden = p1;
    $('passoTxt').textContent = 'Passo ' + cr.passo + ' de 2';
    $('avancar').textContent = p1 ? 'Continuar' : 'Criar quadro';
    $('resumoBox').hidden = p1;
  }
  function ingresso(cls, titulo, desc, ic, tom, rot, ativo, onClick) {
    var b = el('button', { type: 'button', className: 'mod ' + cls, attrs: { 'aria-pressed': ativo } }, [capa(ic, tom),
      el('span', {}, [el('strong', { textContent: titulo }), el('span', { className: 'd', textContent: desc }), el('span', { className: 'n', textContent: rot })])]);
    b.addEventListener('click', onClick);
    return b;
  }
  function renderPasso1() {
    var termo = sem(cr.busca.trim());
    var cats = $('cats'); cats.replaceChildren();
    CATS.forEach(function (k) {
      var n = MODELOS.filter(function (m) { return k[0] === 'todos' || m.cat === k[0]; }).length;
      var b = el('button', { type: 'button', attrs: { 'aria-pressed': cr.cat === k[0] } }, [document.createTextNode(k[1]), el('span', { className: 'ct', textContent: n })]);
      b.addEventListener('click', function () { cr.cat = k[0]; renderPasso1(); });
      cats.append(b);
    });
    var lista = MODELOS.filter(function (m) { return (cr.cat === 'todos' || m.cat === cr.cat) && (!termo || sem(m.nome + ' ' + m.desc).indexOf(termo) >= 0); });
    var itens = [ingresso('zero', 'Começar do zero', 'Quadro vazio com três colunas.', 'mais', PASTAS[3], COL3.join(' · '), cr.modelo === 'zero', function () { cr.modelo = 'zero'; renderPasso1(); })];
    $('modelos').replaceChildren.apply($('modelos'), itens.concat(lista.map(function (m, i) {
      return ingresso('', m.nome, m.desc, m.ic, PASTAS[i % 4], m.cartoes.length + (m.cartoes.length === 1 ? ' cartão inicial' : ' cartões iniciais'), cr.modelo === m.id, function () { cr.modelo = m.id; renderPasso1(); });
    })));
    $('semMod').hidden = lista.length > 0;
    var m = modeloAtual(), pv = $('previa'); pv.replaceChildren();
    var colP = m ? m.col : COL3;
    pv.append(el('b', { textContent: m ? m.nome : 'Quadro vazio' }), el('ol', { className: 'cols-l' }, colP.map(function (n) { return el('li', { textContent: n }); })));
    if (!m || !m.cartoes.length) return;
    pv.append(el('ul', { className: 'cards-l' }, m.cartoes.slice(0, 3).map(function (k) {
      return el('li', { textContent: k.t + (k.d == null ? '' : k.d >= 0 ? ' · D-' + k.d : ' · D+' + (-k.d)) });
    })));
    if (m.cartoes.length > 3) pv.append(el('p', { textContent: '+ ' + (m.cartoes.length - 3) + ' cartões' }));
  }
  $('cats').addEventListener('keydown', function (e) {
    var b = [].slice.call($('cats').querySelectorAll('button')), i = b.indexOf(document.activeElement), d = { ArrowDown: 1, ArrowUp: -1, ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (d && i >= 0) { e.preventDefault(); b[(i + d + b.length) % b.length].focus(); }
  });
  $('buscaMod').addEventListener('input', function (e) { cr.busca = e.target.value; renderPasso1(); });

  function padraoVis(t) { return t === 'pessoal' ? 'eu' : 'equipe'; }
  function irPasso2() {
    var m = modeloAtual(), id = m ? m.id : 'zero';
    if (cr.nomeDe !== id) {
      cr.nomeDe = id; cr.nome = m ? m.nome : '';
      cr.tipo = m ? CAT_TIPO[m.cat] : 'equipe'; cr.vis = padraoVis(cr.tipo);
    }
    cr.passo = 2; mostrarPasso();
    $('nome').value = cr.nome; $('nomeErro').textContent = ''; $('nome').removeAttribute('aria-invalid');
    if (!tipoSeg) {
      tipoSeg = seg($('tipoSeg'), [['evento', 'Evento'], ['equipe', 'Equipe e empresa'], ['pessoal', 'Pessoal']], function (v) { cr.tipo = v; cr.vis = padraoVis(v); atualizarPasso2(); });
      visSeg = seg($('visSeg'), Object.keys(VIS).map(function (k) { return [k, VIS[k]]; }), function (v) { cr.vis = v; atualizarPasso2(); });
      $('evento').append.apply($('evento'), EVENTOS.map(function (e) { return el('option', { value: e.id, textContent: e.nome + ' · ' + dataBR(e.data) }); }));
      $('evento').addEventListener('change', function (e) { cr.ev = e.target.value; });
      $('nome').addEventListener('input', function (e) { cr.nome = e.target.value; });
    }
    $('evento').value = cr.ev;
    atualizarPasso2(); $('nome').focus();
  }
  function atualizarPasso2() {
    var pessoal = cr.tipo === 'pessoal';
    if (pessoal) cr.vis = 'eu';
    tipoSeg.set(cr.tipo); visSeg.set(cr.vis); visSeg.off(function () { return pessoal; });
    $('visDica').textContent = pessoal ? 'Pessoal fica só com você.' : '';
    $('evBox').hidden = cr.tipo !== 'evento'; $('evErro').textContent = '';
    $('pesBox').hidden = cr.vis !== 'escolhidas'; $('pesErro').textContent = '';
    var box = $('pessoas'); box.replaceChildren();
    PESSOAS.filter(function (p) { return p.id !== 'eu'; }).forEach(function (p) {
      var cb = el('input', { type: 'checkbox', id: 'cb-' + p.id, checked: p.id in cr.sel });
      var s = nivel(cr.sel[p.id] || 'ver', 'Nível de ' + p.nome, !cb.checked, function (v) { cr.sel[p.id] = v; });
      cb.addEventListener('change', function () { if (cb.checked) cr.sel[p.id] = s.value; else delete cr.sel[p.id]; s.disabled = !cb.checked; resumir(); });
      s.addEventListener('change', resumir);
      box.append(el('div', { className: 'pes' }, [cb, avatar(p.id), el('label', { className: 'nm', htmlFor: 'cb-' + p.id, style: 'cursor:pointer' }, [el('b', { textContent: p.nome }), el('span', { textContent: p.papel })]), s]));
    });
    resumir();
  }
  function resumir() {
    var nomes = ['Você'];
    if (cr.vis === 'equipe') nomes = nomes.concat(PESSOAS.slice(1).map(function (p) { return p.nome; }));
    if (cr.vis === 'escolhidas') nomes = nomes.concat(Object.keys(cr.sel).map(function (i) { return pessoa(i).nome + ' (' + (cr.sel[i] === 'editar' ? 'edita' : 'vê') + ')'; }));
    $('resumo').textContent = nomes.length === 1 ? 'Só você.' : nomes.length + ' pessoas: ' + nomes.join(', ') + '.';
  }
  function criar() {
    var err = validarNome($('nome').value);
    $('nomeErro').textContent = err; $('nome').setAttribute('aria-invalid', !!err);
    if (err) { $('nome').focus(); return; }
    if (cr.vis === 'escolhidas' && !Object.keys(cr.sel).length) { $('pesErro').textContent = 'Escolha ao menos uma pessoa.'; return; }
    if (quadros.length >= LIMITE) { fechar(); aviso('Limite de ' + LIMITE + ' quadros no protótipo.'); return; }
    var m = modeloAtual();
    var b = q('q' + (++seq), $('nome').value.trim(), cr.tipo, cr.tipo === 'evento' ? cr.ev : null, cr.vis, cr.vis === 'escolhidas' ? Object.assign({}, cr.sel) : {}, m ? m.cartoes.length : 0, 0, 0,
      { col: m ? m.col : COL3, ord: ++seq, cor: PASTAS[seq % 6] });
    quadros.push(b);
    est.novo = b.id; est.aba = 'ativos'; est.filtro = 'todos'; est.busca = ''; $('busca').value = '';
    fechar(true); render(); aviso('Quadro criado: ' + b.nome + '.', true);
    var a = document.querySelector('.cartao.novo-auto a'); if (a) a.scrollIntoView({ block: 'nearest' });
  }
  $('avancar').addEventListener('click', function () { cr.passo === 1 ? irPasso2() : criar(); });
  $('voltar').addEventListener('click', function () { cr.passo = 1; mostrarPasso(); renderPasso1(); $('avancar').focus(); });

  /* ---------- tema ---------- */
  var tema = $('tema');
  var tseg = seg(tema, [['claro', 'Claro'], ['escuro', 'Escuro']], function (v) {
    document.documentElement.dataset.skin = v;
    try { localStorage.setItem('quadros-tema', v); } catch (e) { /* sem armazenamento */ }
  });
  var salvo = 'claro';
  try { salvo = localStorage.getItem('quadros-tema') === 'escuro' ? 'escuro' : 'claro'; } catch (e) { /* ok */ }
  tseg.set(salvo); document.documentElement.dataset.skin = salvo;

  render();
})();
