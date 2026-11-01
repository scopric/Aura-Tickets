# Evokaa Design System v3.0

> Substitui o v2.0 (Linear/Vercel/Stripe, gradiente azul→roxo, Inter). Base: **Active Theory** (Refero, Decisão 245), com empréstimos fechados da DICE (cartaz tipográfico, preço total antes do botão) e da Berlin Biennale (data monumental). Regras do método em `Conhecimento/Modo Refero — design.md` (cofre) e reference lock v2 na entrega de 01/11/2026. Decisões 244, 245 e 246.
>
> Tokens em código: `src/tokens-v3.css` (variáveis `--ev3-*`) e `tailwind.config.js` (`ev3-*`; as cores são `var()` sem canal alfa, então `bg-ev3-acento/50` não existe: translucidez só por `--ev3-veu` e `--ev3-vidro`). Prova visual: `docs/identidade-v3/kitchen-sink/`. Este documento é a regra; o código só a repete.

## 0. Ideia que se lembra

Um palco preto absoluto. A cena 3D (o Evo, a luz do evento) é o herói; o chrome é um fantasma: fio de 1 px, pílula, texto pequeno, nada de sombra, nada de gradiente. Um único acento cromático, racionado à ação principal. O corpo do texto é uma serifa editorial com respiro de 1,88: quem lê sente que está lendo, não operando. A vitrine do evento é um cartaz: título comprimido em caixa-alta, data monumental, e o preço total dito antes do botão.

## 1. Cor

| Papel | Token | Valor | Contraste sobre #000 | Regra |
| --- | --- | --- | --- | --- |
| Fundo (canvas) | `--ev3-fundo` | `#000000` | — | o único fundo de página do site; nunca cinza |
| Texto | `--ev3-texto` | `#ffffff` | 21,00 | texto, ícone, rótulo do botão principal |
| Terciário | `--ev3-terciario` | `#c6c6c6` | 12,29 | metadado, link em repouso, rótulo secundário |
| Fio decorativo | `--ev3-fio` | `#4d4d4d` | 2,48 | borda de cartão e divisor; **nunca** em controle |
| Contorno de controle | `--ev3-contorno` | `#999999` | 7,37 | borda de campo e de botão fantasma (WCAG 1.4.11 ≥ 3) |
| Acento | `--ev3-acento` | `#8f33f5` | 3,96 (como texto: proibido) | **só** ação principal e seleção; rótulo por cima branco (5,30) |
| Acento como texto | `--ev3-acento-texto` | `#b57cf8` | 7,20 | link ativo, número em destaque, estado selecionado em texto |
| Foco | `--ev3-foco` | `#ffffff` | 21,00 | anel de 2 px fora do controle; nunca violeta |
| Erro | `--ev3-erro` | `#ef5a52` | 6,25 | texto e borda de campo com erro, sempre com texto (nunca só cor); o `--destructive-text` do v3.4 muda com o tema e no claro reprova sobre preto |
| Placa do QR | `--ev3-placa` | `#ffffff` | — | única superfície branca sólida; QR `#000` com margem de 4 módulos |
| Véu | `--ev3-veu` | `rgb(0 0 0 / 0.8)` | — | painel com texto sobre a cena (opacidade ≥ 0,8, desvio consciente *b*) |
| Vidro | `--ev3-vidro` | `rgb(255 255 255 / 0.1)` | — | preenchimento do botão fantasma em hover/ativo |
| Cor do evento | `--evento` | por evento | — | capa, cena e data da vitrine (Decisão 243); nunca em botão, borda ou fundo |

Violeta em todo o sistema (Decisão 246): site, app do participante, painel do produtor e admin usam o mesmo `#8f33f5` como ação principal. Sai o marinho `#0c2340` da Decisão 226 e o escopo "só produtor" da 223. Tema claro do produtor e do admin: em aberto para a Fase 6 (Decisão 245); até lá, os tokens claros do contrato v3.4 seguem com o violeta no lugar do marinho (§9).

## 2. Tipografia

Três famílias, três papéis, nenhum cruzamento (Decisão 249, escolha do Ricardo entre três combinações em `docs/identidade-v3/fontes/`). Todas sob SIL Open Font License 1.1, sem Reserved Font Name: uso comercial, web e auto-hospedagem permitidos. Arquivos woff2 (variáveis, subset latin) e `OFL-*.txt` em `public/fonts/`; `@font-face` com `font-display: swap` em `src/tokens-v3.css`.

| Papel | Família (autor) | Token | Tamanho / entrelinha | Peso | Onde | Onde não |
| --- | --- | --- | --- | --- | --- | --- |
| Chrome | **Syne** (Bonjour Monde) | `--ev3-fonte-chrome` / `font-ev3-chrome` | 12 px / 1,5 · botão 14 px / 1,2 | 400 · botão 700 | navegação, rótulo, botão, metadado, tabela | prosa, título de evento |
| Corpo | **Newsreader** (Production Type, eixo óptico; romano e itálico, dois arquivos) | `--ev3-fonte-corpo` / `font-ev3-corpo` | 16 px / 1,88 | 400 (itálico verdadeiro só em ênfase real; `font-synthesis: none` no corpo) | descrição, texto legal, e-mail, campo de formulário | botão, rótulo, número |
| Display | **Big Shoulders** (Patric King) | `--ev3-fonte-display` / `font-ev3-display` | título 44–88 px / 0,92 · data 72–160 px / 0,9 · número 28 px | 700 | **só** título de evento, data monumental, preço e contagem | título de seção, texto corrido, botão, logotipo |

Descartadas: Fontshare (General Sans, Switzer, Sentient, Gambetta, Erode): a ITF Free Font License v2.0 proíbe subset, conversão de formato e repositório público; Tusker Grotesk: paga.

Regras: caixa-alta só no display e no chrome de 12 px; sem rótulo em caixa-alta em cima de todo título; sem palavra decorativa em itálico, serifa ou cor dentro do título; campo de texto nunca abaixo de 16 px (o iPhone amplia); `text-wrap: balance` em título. **Números:** a Big Shoulders não tem dígitos tabulares (`tnum` não existe no arquivo), então data e preço em display são valores fixos; contagem regressiva ou número que muda em tempo real vai em Syne (que tem `tnum`) ou em caixa de largura fixa por dígito. Nenhuma das três tem a seta → (U+2192): usar ícone ou texto. Recuo do display no celular é fonte do sistema: em rota de cartaz, `preload` da Big Shoulders.

## 3. Forma

| | Token | Valor | Uso |
| --- | --- | --- | --- |
| Raio de controle | `--ev3-raio-controle` | 5 px | campo, botão fantasma, caixa de seleção |
| Raio de cartão | `--ev3-raio-cartao` | 12 px | cartão, painel, folha, placa do QR |
| Raio de pílula | `--ev3-raio-pilula` | 500 px | botão principal, tag, pílula, avatar |

Nenhum outro raio. Sem sombra (o vazio não projeta sombra): profundidade só por translucidez (`--ev3-veu`) e desfoque (`--ev3-desfoque`, 4 px). Sem gradiente em chrome; a cena 3D carrega toda a riqueza cromática.

## 4. Espaço

`4 · 6 · 12 · 16 · 18 · 28` px (`--ev3-esp-*`). Entre seções 48 px; dentro do cartão 28 px; entre elementos 6 px. Alvo de toque ≥ 44 px (`--ev3-alvo`), com `.alvo-44` quando o desenho é menor. Margem lateral no celular 16 px; nenhuma rolagem lateral.

## 5. Movimento

Por opacidade: as coisas aparecem e somem, não deslizam nem crescem. Micro (hover, foco, troca de estado) 200–400 ms `ease-out`; cena e herói 800 ms ou mais, `ease`. Sem mola. Única exceção, registrada no lock como desvio consciente (h): o confete da compra confirmada (Decisão 157), que também é partícula; vale só nessa tela e em conquista. `prefers-reduced-motion`: micro vira 0,01 ms (não 0, para `transitionend` disparar), painel vira esmaecer de 120 ms, cena fica no poster.

## 6. Componentes (cartas)

- **Botão principal:** pílula 500 px, fundo `--ev3-acento`, rótulo branco 14 px 700 em chrome, 12 × 18 px de preenchimento, altura ≥ 44 px; hover escurece por opacidade, nunca brilho; um por tela.
- **Desabilitado e "Esgotado":** nunca o acento apagado (gasta o violeta numa não-ação e o texto fica ilegível). Botão fantasma com borda `--ev3-fio`, texto `--ev3-terciario`, `aria-disabled="true"` e o motivo escrito ao lado ("Esgotado", "Vendas encerradas"); mantém 44 px.
- **Botão fantasma:** raio 5 px, borda 1 px `--ev3-contorno`, texto branco 12–14 px; hover `--ev3-vidro`; é o padrão para tudo o que não é a ação principal.
- **Campo:** raio 5 px, borda 1 px `--ev3-contorno`, texto 16 px em corpo, rótulo 12 px em chrome acima; foco: anel branco 2 px a 2 px do contorno; erro: borda e mensagem em `--ev3-erro`, com `aria-invalid` e `aria-describedby`, nunca só cor.
- **Cartão:** raio 12 px, borda 1 px `--ev3-fio`, 28 px de preenchimento, fundo transparente (ou `--ev3-veu` se há cena atrás); sem sombra.
- **Painel sobre cena:** `--ev3-veu` + `backdrop-filter: var(--ev3-desfoque)`; se a cena está pausada atrás, fundo pode ser `#000` opaco.
- **Pílula / tag:** 500 px, borda 1 px `--ev3-fio`, texto 12 px chrome, 28 px de altura quando é só rótulo. Se é selecionável (filtro), é `<button aria-pressed>` com alvo ≥ 44 px (`.alvo-44`); selecionada: fundo `--ev3-acento`, texto branco.
- **Link:** `--ev3-terciario` sem sublinhado, fio de 1 px `--ev3-fio` embaixo; hover branco. Link ativo ou selecionado: `--ev3-acento-texto`. Link de navegação (menu) tem alvo ≥ 44 px por preenchimento vertical ou `.alvo-44`.
- **Linha de informação (vitrine):** rótulo terciário à esquerda, valor branco à direita, fio `--ev3-fio` embaixo, 12 px de preenchimento vertical (empréstimo DICE).
- **Preço total:** número em display 28 px, seguido de "total, com a taxa" em chrome 14 px, **antes** do botão de compra (DICE).
- **Data monumental:** número em display 72–160 px, rótulo de mês/dia/hora em chrome 12 px caixa-alta embaixo (Berlin Biennale: só a escala).
- **Placa do QR:** `#fff` opaca, raio 12 px, QR `#000`, margem de 4 módulos, sem cena atrás, sem translucidez; vale para Pix e para o ingresso.

## 7. Caminho crítico (vale acima de qualquer regra visual)

Pagar (checkout Pix), entrar (login e 2FA) e validar (QR do ingresso e portaria) são **2D**: sem cena atrás, sem translucidez sob texto, QR escuro em placa clara opaca. A pele muda (fundo, fontes, violeta); a estrutura e a lógica, não (Decisões 228, 231, 243, 244). O ingresso offline (`public/sw.js`) ainda não guarda `/fonts`: quando a Fase 4 trocar a pele do ingresso, incluir as três fontes no service worker, ou o QR cai na fonte do sistema sem rede.

## 8. 3D e WebGL

- **three.js ainda não está no `package.json`**: entrar com a dependência é **decisão pendente do Ricardo** (a Decisão 239 adiou; a 248 aprova o modelo, não o pacote; o reference lock v2 errou ao dizer "three.js já instalado"). Quando entrar: chunk separado carregado só na rota que usa. Medido na prova (esbuild, só o que a cena importa): 576 KB bruto, 119 KB brotli, 144 KB gzip de código; o modelo `evo-web.glb` (Decisão 248: 34 mil triângulos, meshopt + quantização, textura 2K WebP) pesa 1,4 MB e exige `MeshoptDecoder` (vem nos addons do three); teto do código da cena: 150 KB brotli.
- DPR limitado a 2; pausa fora da tela (IntersectionObserver) e na aba oculta; **fica no poster estático** (padrão do HTML até a cena ficar pronta, cruzado por opacidade) com `prefers-reduced-motion`, `navigator.connection.saveData`, `deviceMemory < 4`, sem WebGL2, quando o modelo ou a textura não carregam e na perda de contexto; `dispose()` de tudo ao desmontar (geometrias, materiais, texturas com `ImageBitmap.close()`, listeners, intervalos, carregamentos pendentes). Ressalvas abertas da 248: borda do retalho do peito, marinho das luvas, costas inventadas (fora da pose), poster só coincide com a cena a 1280×800 e 390×844.
- Material e luz de estúdio (acetinado fosco, sem verniz, contraluz neutra); sem partículas, brilho, holograma ou foil; o acento violeta no objeto é fosco.
- Movimento de cena por opacidade e oscilação lenta (±17°, 14 s); nunca giro de 360° contínuo.
- O Evo em 3D é o herói da Home (Decisões 246 e 248); cena também em explorar e páginas de marketing; nunca na vitrine do evento (243) nem no caminho crítico.
- A capa do evento é foto real do produtor, chapada e sem filtro (243); pode ser iluminada na cena só na Home e no explorar. A cor do evento (`--evento`) como texto da data monumental passa por `derivarCor` (`src/lib/corEvento.ts`) com piso de 3:1 contra `#000` (hoje a função mira as superfícies do v3.4: ajustar na Fase 4).

## 9. O que muda no `index.css` (mapa v2.0 → v3.0)

Aplicado por tela na Fase 4, exceto o violeta, que entra já (Decisão 246, testes do §2.7).

| Hoje (`index.css`) | v3.0 | Quando |
| --- | --- | --- |
| `--primary` era marinho `#0c2340` (claro) / `#2f6aa8` (escuro) com bloco `.painel-produtor` violeta | **feito na Fase 2 (01/11):** `--primary` violeta `#8f33f5` nos dois temas em `:root`; `--primary-text` `#7f25e0` / `#b57cf8`; `--ev-brand-hover/press/soft` e `--ev-focus-field` globais; bloco `.painel-produtor` removido; `useCorProdutor` ficou sem efeito (apagar na Fase 6) | feito |
| `--plum`, `--plum-light`, `--plum-muted` (segundo violeta; 147 usos: `bg-plum` 73, `text-plum` 59, `text-plum-light` 15; `text-plum` é `#8f33f5` como texto, proibido no §10) | `--ev3-acento` em ação e seleção, `--ev3-acento-texto` em texto; o resto vira neutro | Fase 4, por tela |
| `.surface`, `.surface-elevated`, `.surface-dark` (raio 20 px, sombra, desfoque 20 px), utilitários de desfoque 20 px, `.glass-canvas` e as remapeações do tema escuro | cartão com fio `#4d4d4d` e raio 12; painel com `--ev3-veu` + desfoque 4 px | Fase 4 |
| `tailwind.config.js`: `boxShadow.glow` (`shadow-glow`, 27 usos) e `elevated`; keyframes `float` (deslocamento) e `pulse-glow` | sem sombra e sem brilho; movimento por opacidade | Fase 4 |
| `bg-gradient-*` (55 usos) e `bg-clip-text` (4 usos: texto em gradiente) | sem gradiente de chrome nem texto em gradiente; a riqueza cromática fica na cena | Fase 4, por tela |
| `font-display` (106 usos, Archivo) e `font-serif` (80 usos, Plus Jakarta) | `font-ev3-display` só em título de evento e número; `font-ev3-chrome` e `font-ev3-corpo` no resto | Fase 4, por tela |
| `--background` escuro `#0b0d12`, `--card` `#14171d` | site público: `#000` e cartão transparente com fio `#4d4d4d`; produtor e admin continuam com os tokens v3.4 até a Fase 6 | Fase 4 (site) |
| `--border` `#1f2025` (escuro) | `#4d4d4d` como fio decorativo; `--input` `#999` | Fase 4 |
| `--radius: 0.75rem` (12 px) e `rounded-xl/2xl/3xl` espalhados | 5 / 12 / 500 | Fase 4, por tela |
| `--ev-sombra-1/2`, `.surface` com sombra e desfoque de 20 px, `--gradient-*`, `.shadow-glow` | sem sombra, sem gradiente, desfoque só de 4 px atrás de painel | Fase 4 |
| Plus Jakarta Sans, Outfit, Archivo (Google Fonts por `<link>`), `body.home-outfit` | três famílias do Portão 2 em `public/fonts/` (woff2 + OFL), `@font-face` com `swap`; sai o `<link>` do `index.html` | Fase 2 → 4 |
| `--mov-*` e `--curva-*` do contrato §9 (deslocamento 8 px, escala 0,96, mola) | `--ev3-mov-*` por opacidade; o contrato §9 segue no produtor e no admin até a Fase 6 | Fase 4 |
| `::selection` azul `rgba(59,130,246,.25)` | branco a 25 % sobre preto | Fase 4 |

## 10. Don't (copiado do *reject* do reference lock v2)

- Fontes Inter, Plus Jakarta, Outfit, Space Grotesk, Fraunces, Instrument Serif; palavra decorativa em itálico, serifa ou cor dentro do título.
- Esqueleto hero → recursos → preços → FAQ → CTA.
- Glow e neon no chrome, texto em gradiente, "aurora", grade bento, rótulo pequeno em caixa-alta acima de todo título, seções numeradas 01/02, partículas e brilho como enfeite, holograma, foil, grão, ícones de biblioteca sem critério, mascote 3D "fofo".
- Sombras, gradientes de UI, raio fora de 5/12/500, cartão branco sólido fora da placa do QR.
- Tema claro no site público (painel do produtor e admin: Fase 6).
- Acento em mais de uma ação por tela; violeta como texto em `#8f33f5`; foco violeta; cor do evento em chrome.
- Cena 3D no caminho crítico; giro contínuo; "snappy", mola e deslocamento como movimento padrão.
- Reproduzir o portal/emblema do Active Theory ou "ingresso hologramático"; copiar tela de concorrente.

## 11. Acessibilidade e celular (não negociável)

AA em todo texto (tabela do §1); borda de controle e foco ≥ 3:1; `prefers-contrast: more` sobe o fio decorativo para `#999` e o véu para 0,95 (em `tokens-v3.css`); texto ≥ 16 px em campo e ≥ 12 px em chrome; alvo ≥ 44 px; navegação sempre visível no toque (o "aparece com o cursor" do Active Theory não vale no celular); painel com texto sobre cena a ≥ 0,8 de opacidade ou cena pausada; tudo operável por teclado com foco visível; `prefers-reduced-motion` e `prefers-contrast` respeitados; Playwright a 1280 e 390 sem rolagem lateral e sem erro de console antes de qualquer aprovação.

## 12. Histórico

- v1.0 (Lovable, 2026): Inter, gradiente azul-ciano→roxo.
- v2.0 (09/2026): Linear/Vercel/Stripe, Plus Jakarta Sans, marinho (Decisão 226), violeta só no produtor (223).
- **v3.0 (01/11/2026):** Modo Refero, Active Theory, violeta em tudo, 3D e WebGL, três famílias com licença, caminho crítico em 2D.
