# AURA - Plano Completo do que Falta

## Status Geral do Projeto
O projeto tem **29 paginas** implementadas com design consistente, sistema de auth com 3 perfis, protecao de rotas, toast notifications, e dados mockados. O que segue sao as funcionalidades e paginas que ainda **nao existem** ou estao **incompletas**.

---

## 1. CONFIGURACOES (Prioridade Alta)

### 1.1 Configuracoes do Produtor (NOVA PAGINA)
Rota: `/producer/settings`

| Secao | Funcionalidades |
|-------|-----------------|
| **Perfil** | Editar nome, email, telefone, foto, bio, redes sociais (Instagram, TikTok, LinkedIn) |
| **Conta** | Alterar senha, verificacao em duas etapas (2FA), sessoes ativas |
| **Pagamento** | Cadastrar conta bancaria, chave Pix, historico de saques |
| **Notificacoes** | Email (vendas, mensagens, alertas), Push (app), SMS |
| **Evento Padrao** | Configuracoes default para novos eventos (taxa de servico, tipos de ingresso) |
| **Equipe** | Convitar membros, definir permissoes (admin, editor, visualizador) |
| **Integracoes** | Widget de vendas, API key, webhooks |

### 1.2 Configuracoes do Admin (EXPANDIR)
Rota: `/admin/settings` - Ja existe mas basico

| Secao | Funcionalidades |
|-------|-----------------|
| **Geral** | Nome da plataforma, logo, favicon, dominio customizado |
| **Email** | Configurar SMTP, templates de email (welcome, compra, lembrete) |
| **Moderacao** | Palavras proibidas, filtro de conteudo, denuncias |
| **Backup** | Exportar dados, agendar backups |
| **Logs** | Logs de acesso, logs de erro, auditoria |

### 1.3 Configuracoes do Participante (NOVA PAGINA / Modal)
Rota: `/app/settings` ou modal no Hub

| Secao | Funcionalidades |
|-------|-----------------|
| **Perfil** | Foto, nome, bio, cidade, data de nascimento |
| **Preferencias** | Generos musicais favoritos, tipo de evento, distancia maxima |
| **Pagamento** | Cartoes salvos, historico de compras, notas fiscais |
| **Notificacoes** | Eventos recomendados, lembretes, promocoes |
| **Privacidade** | Perfil publico/privado, visibilidade nas mesas coletivas |

---

## 2. MODULOS INCOMPLETOS

### 2.1 CRM (Completo visualmente, falta backend logic)
- [ ] Drag-and-drop real no pipeline (mover lead entre estagios)
- [ ] Criar novo lead manualmente
- [ ] Editar lead existente
- [ ] Arquivar lead
- [ ] Exportar leads para CSV/Excel
- [ ] Automação: regras (ex: se lead comprar 2x, mover para "Qualificado")
- [ ] Templates de mensagem rapida

### 2.2 Cardapio / Comandas (Menu)
- [ ] CRUD completo de itens (criar, editar, excluir)
- [ ] Upload de foto do item
- [ ] Categorias customizaveis
- [ ] Variacoes (tamanho P/M/G, com/sem adicional)
- [ ] Controle de estoque
- [ ] Pedidos em tempo real (notificacao quando compram)
- [ ] QR code do cardapio para imprimir

### 2.3 Calculadora de Mesas
- [ ] Salvar configuracoes de mesa por evento
- [ ] Layout visual da mesa (mapa de lugares)
- [ ] Compartilhar calculo
- [ ] Comparativo de fornecedores

### 2.4 Carteira
- [ ] Saldo real com calculo
- [ ] Solicitar saque (com valor input)
- [ ] Historico detalhado de transacoes com filtros
- [ ] Previsao de receita

### 2.5 Financeiro do Produtor
- [ ] Gerar relatorio PDF/Excel
- [ ] Graficos comparativos (mes a mes)
- [ ] Categorias de despesa
- [ ] Previsao de fluxo de caixa

### 2.6 Brand Studio
- [ ] Upload de imagem de capa do evento
- [ ] Seletor de fontes (Google Fonts)
- [ ] Preview responsivo (mobile/desktop)
- [ ] Salvar tema como template
- [ ] Gerar QR code do evento
- [ ] Link publico do evento (compartilhavel)

---

## 3. FUNCIONALIDADES FALTANTES

### 3.1 Eventos
- [ ] Editar evento existente
- [ ] Duplicar evento
- [ ] Publicar/despublicar evento
- [ ] Controle de visibilidade (publico/privado/senha)
- [ ] Lista de convidados / Guest list
- [ ] Check-in na porta (validar QR code)
- [ ] Encerrar evento
- [ ] Relatorio pos-evento

### 3.2 Ingressos
- [ ] Transferencia de ingresso para outra pessoa
- [ ] Reembolso / cancelamento
- [ ] Lista de espera (quando esgotar)
- [ ] Ingresso com nome do comprador
- [ ] Lote de ingressos (Early Bird, 1o Lote, 2o Lote)

### 3.3 Mesa Coletiva
- [ ] Sistema real de matchmaking (algoritmo de compatibilidade)
- [ ] Visualizacao dos membros da mesa
- [ ] Chat exclusivo da mesa
- [ ] Troca de mesa
- [ ] Moderador da mesa

### 3.4 AppHub do Participante
- [ ] Ingresso com contagem regressiva
- [ ] Compartilhar evento nas redes sociais
- [ ] Convidar amigos
- [ ] Avaliar evento pos-ocorrencia
- [ ] Fotos do evento (galeria)
- [ ] Timeline do evento

### 3.5 Checkout
- [ ] Cupom de desconto
- [ ] Calcular taxas automaticamente
- [ ] Parcelamento (Cartao)
- [ ] Pix copia-e-cola com QR
- [ ] Boleto

---

## 4. MELHORIAS TECNICAS

### 4.1 Performance
- [ ] Code splitting por rota (lazy loading)
- [ ] Otimizar imagens (WebP, lazy loading)
- [ ] Reduzir bundle size

### 4.2 UX/UI
- [ ] Modais de confirmacao para acoes destrutivas
- [ ] Empty states (telas sem dados)
- [ ] Tooltips em icones
- [ ] Keyboard shortcuts
- [ ] Tema escuro (dark mode)

### 4.3 Dados
- [ ] Persistir configuracoes no localStorage
- [ ] Persistir carrinho no localStorage
- [ ] Sincronizar dados entre abas (BroadcastChannel)

### 4.4 Acessibilidade
- [ ] ARIA labels
- [ ] Navegacao por teclado
- [ ] Contraste WCAG AA
- [ ] Focus trapping em modais

---

## 5. PRIORIZACAO SUGERIDA

### Fase 1 - Essencial (usar agora)
1. Configuracoes do Produtor (perfil, pagamento, notificacoes)
2. CRUD Cardapio (criar/editar/excluir itens)
3. Configuracoes do Participante (perfil, pagamento)
4. Editar evento + duplicar
5. Cupom de desconto no checkout

### Fase 2 - Importante (usar em breve)
6. Drag-and-drop no CRM pipeline
7. Check-in na porta (validar QR)
8. Transferencia de ingresso
9. Lotes de ingresso (Early Bird)
10. Pix copia-e-cola no checkout

### Fase 3 - Diferencial (usar depois)
11. Algoritmo de matchmaking Mesa Coletiva
12. Dark mode
13. Relatorios PDF/Excel
14. Automacao de CRM
15. App PWA (instalavel)

---

## 6. PAGINAS QUE NAO EXISTEM (lista rapida)

| # | Pagina | Rota | Status |
|---|--------|------|--------|
| 1 | Configuracoes Produtor | `/producer/settings` | NAO EXISTE |
| 2 | Configuracoes Participante | `/app/settings` | NAO EXISTE |
| 3 | Perfil publico | `/profile/:id` | NAO EXISTE |
| 4 | Lista de convidados | `/producer/events/:id/guests` | NAO EXISTE |
| 5 | Check-in | `/producer/events/:id/checkin` | NAO EXISTE |
| 6 | Relatorio pos-evento | `/producer/events/:id/report` | NAO EXISTE |
| 7 | Meus pedidos (participante) | `/app/orders` | NAO EXISTE |
| 8 | Avaliacoes | `/app/reviews` | NAO EXISTE |
| 9 | Recuperar senha | `/auth/forgot` | NAO EXISTE |
| 10 | Redefinir senha | `/auth/reset` | NAO EXISTE |

---

## 7. ESTIMATIVA DE ESFORCO

| Fase | Itens | Estimativa |
|------|-------|-----------|
| Fase 1 | 5 itens | ~2-3 sessoes |
| Fase 2 | 5 itens | ~3-4 sessoes |
| Fase 3 | 5 itens | ~4-5 sessoes |

Total: 15 funcionalidades principais para tornar a plataforma completa e profissional.
