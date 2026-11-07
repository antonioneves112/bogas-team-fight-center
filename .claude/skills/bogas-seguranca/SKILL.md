---
name: bogas-seguranca
description: Arquitetura de segurança, regras de código e testes do site Bogas Team (Supabase + HTML/CSS/JS). Usar SEMPRE antes de mexer em JS/HTML/CSS, no Supabase (tabelas, RLS, funções), no portal do atleta, no login, ou quando o utilizador perguntar o que foi feito na revisão de segurança de novembro de 2026 e porque é que funciona.
---

# Bogas Team: segurança, regras e testes

Revisão feita em 2026-11-07. Corrigiu uma fuga de dados grave e vários bugs.
Lê esta skill toda antes de alterar código. Quando perguntarem "o que fizemos?" ou
"porque é que funciona?", responde com as secções 2 e 3.

## 1. Regras obrigatórias (pedidas pelo dono do projeto)

1. **Nunca misturar HTML com CSS nem HTML com JS.**
   - HTML: sem `style=""`, sem `<style>`, sem `<script>` com código lá dentro (só `<script src>`), sem `onclick=`/`onsubmit=`.
   - JS que gera HTML: sem `style="..."`. Usa classes definidas no CSS da página.
   - Mostrar/esconder: `classList.toggle("hidden", cond)` (a classe `.hidden` está no `theme.css`). Não uses `el.style.display`.
   - Se uma classe nova não "pega", é especificidade: outra regra ganha. Sobe a especificidade (ex.: `.dash-form input.input-leitura`, `#tabelaSocios td.celula-nome`, `.modal-content strong.texto-branco`). Usa `!important` só se a regra rival também o usar.
   - Tudo isto é verificado automaticamente por `tests/regras.test.mjs`.
2. **Mobile-first**: estilos novos escrevem-se para o telemóvel e alargam-se com `@media (min-width: ...)`.
3. **Todo o texto vindo da BD que entra em `innerHTML` passa por `escapeHTML()`** (`JS/helpers.js`).
4. **Todas as chamadas ao Supabase verificam erros**: usa `db(pedido)` de `JS/supabase.js`, que lança o erro. O supabase-js não lança sozinho, por isso sem isto aparece "Sucesso" quando a operação falhou.
5. **Botões de gravar ficam bloqueados (`disabled`) enquanto o pedido decorre**, para evitar duplicados com dois toques no telemóvel.
6. **Os eventos registam-se uma vez**, nunca dentro de funções que correm várias vezes. Para listas, usa delegação: um listener no contentor com `e.target.closest(...)`.
7. **URLs, chaves e emails ficam só em `JS/config.js`.** O aviso visual (toast) é `mostrarAviso` de `JS/toast.js`.

## 2. O que estava mal (e foi confirmado na BD real)

- A chave pública (está no código e é pública por natureza) lia **todos os sócios com password em texto, telemóvel e email** (71 sócios), 569 mensalidades, 1170 notificações e as aulas.
- O login do portal comparava a password **no browser**.
- O "login automático" confiava no `bogas_atleta_id` guardado no localStorage: bastava trocar o número para entrar na conta de outro atleta.
- Qualquer pessoa podia apagar ou criar notificações, e mudar a password de qualquer atleta (RPC `alterar_password_atleta(atleta_id, ...)`).
- Bugs: notificação com a coluna `message` em vez de `mensagem`; faturar 2 aulas no mesmo mês marcava a fatura errada ou duplicava-a; os eventos do histórico de despesas acumulavam (um clique apagava N vezes); pagamentos duplicados com toque duplo; erros mostrados como sucesso; a homepage descarregava cerca de 30 MB de vídeo; o ícone tinha 6,8 MB; o Eruda (consola de debug) estava ativo em produção.

## 3. Como funciona agora, e PORQUE é seguro

### Base de dados (`supabase/migracoes/`)
- **RLS ligado em todas as tabelas do schema `public`** (`02_fechar_acesso.sql`). Sem login (`anon`) não se lê nem escreve nada; a única exceção é `sistema_ping`, usada pelo `JS/ping.js`. **Porque funciona:** com RLS, o Postgres filtra cada linha pela política. Sem política para `anon`, a resposta vem vazia ou dá "permission denied", tenha o atacante a chave que tiver.
- **Treinadores = tabela `treinadores`** (user_id do Supabase Auth + nome). A política `treinador_total` usa `public.is_treinador()`. **Porque funciona:** não basta ter conta no Supabase Auth; o `auth.uid()` vem do JWT assinado pelo Supabase e tem de estar na tabela `treinadores`. O nome do treinador vem de `meu_treinador()` e já não do texto do email.
- **Atletas não usam Supabase Auth.** Usam funções `portal_*` com `SECURITY DEFINER` (correm com permissões do dono e ignoram o RLS), e cada uma:
  1. valida o token com `_socio_da_sessao(token)`, que procura o **hash SHA-256** do token em `sessoes_atleta` e confirma a validade (90 dias);
  2. só lê ou altera linhas desse `socio_id`.
  **Porque funciona:** o browser só tem um token aleatório de 256 bits. Não dá para adivinhar e não é um ID sequencial. Mesmo quem roube a tabela de sessões não fica com tokens utilizáveis, porque só lá estão hashes.
- **Passwords com bcrypt** (`password_hash`, pgcrypto `crypt()`), e a coluna `password` em texto é apagada na fase 2. A regra antiga mantém-se: sem password definida, a password é o telemóvel.
- **Anti-força-bruta**: 8 falhas por email em 15 minutos bloqueiam o login (`login_tentativas`). As respostas não revelam se o email existe.
- **`aprovar_aula` / `faturar_aula`** fazem tudo numa só transação ("tudo ou nada"), e a fatura fica ligada à aula pela coluna `mensalidades.aula_id`. As faturas antigas sem `aula_id` são encontradas pelo dia (`dia_aula`).
- As funções antigas `alterar_password_atleta` e `assinar_regulamento` deixaram de ser executáveis pelo público.

### Front-end
- `JS/portal.js`: **zero leituras diretas a tabelas**. Faz login com `portal_login`, guarda o token em `localStorage["bogas_portal_token"]` e usa `portal_resumo` (1 pedido traz tudo), `portal_historico`, `portal_pedir_aula`, etc. Se o token for inválido, volta ao login.
- `JS/login.js` e `JS/main.js`: os treinadores entram pelo Supabase Auth (como antes) e o nome vem de `meu_treinador`.
- O jsPDF só é descarregado quando se exporta um PDF (`carregarJsPDF` no `pdfManager.js`). Os vídeos da homepage têm `preload="none"` e só toca o vídeo do slide visível (`home.js`). Os ícones estão em `img/icones/icon-192.png` e `icon-512.png`. O `supabase-js` está fixo na versão `2.118.0`.
- Service worker: `CACHE_NAME` tem de subir de versão a cada publicação (`sw.js`).

## 3.1 Vendas e stock (acrescentado em 2026-11-07)

- **Onde está:** botão **€** no cabeçalho do dashboard, logo a seguir ao calendário. Abre `#view-vendas`.
  - Código: `JS/vendas.js` (registado em `main.js` com `initVendasEvents()`), `CSS/vendas.css` (mobile-first) e `supabase/migracoes/03_vendas_stock.sql`.
- **Modelo de dados:**
  - `produtos`: nome, categoria livre, `preco_compra`, `preco_venda`, `stock_minimo`, `ativo`.
  - `produto_variantes`: uma por tamanho, onças das luvas ou "Único", cada uma com o seu `stock`.
  - `vendas`: cliente sócio (`socio_id`) ou não sócio (`cliente_nome`); estado `Paga`, `Pendente` ou `Anulada`; método Dinheiro, MB Way, Transferência ou Multibanco.
  - `venda_itens`: guarda o nome e os preços **do momento da venda**.
  - `stock_movimentos`: auditoria de todas as entradas e saídas.
- **Porque é que o stock nunca fica errado:** só as funções da BD mexem em stock, e cada uma corre numa transação ("tudo ou nada"):
  - `registar_venda` bloqueia as linhas de stock (`FOR UPDATE`), por isso duas vendas ao mesmo tempo não vendem a mesma última unidade. Se faltar stock num artigo, nada é gravado.
  - `anular_venda` devolve o stock e recusa anular duas vezes.
  - `repor_stock` faz entradas e ajustes, e recusa deixar o stock negativo.
  - `guardar_produto` edita nomes e preços, mas nunca o stock das variantes que já existem. Também não deixa apagar uma variante que já foi vendida.
  - A coluna `stock` tem `check (stock >= 0)`: mesmo um bug no código não consegue pôr o stock negativo.
- **Porque é que o lucro das vendas antigas não muda:** o `venda_itens` guarda o `custo_unitario` e o `preco_unitario` da altura da venda. Mudar o preço do produto depois não altera o passado.
- **Relatório PDF:** tem uma secção "VENDAS DE MATERIAL". O balanço passa a ser receitas + **lucro das vendas pagas** − despesas. As vendas anuladas não contam e as pendentes aparecem na tabela, mas não entram no lucro.
- **Se a migração 03 ainda não tiver corrido:** a área de vendas mostra um aviso a dizer isso, e o resto do dashboard e o PDF continuam a funcionar (há teste para isso).

## 4. Ordem de publicação (não trocar!)

1. SQL Editor: `00_diagnostico.sql` (só leitura). Confirmar que `auth.users` só tem treinadores.
2. SQL Editor: `01_preparar.sql`. Só acrescenta coisas; o site antigo continua a funcionar.
3. Publicar o site novo (o código precisa das funções da fase 1).
4. SQL Editor: `02_fechar_acesso.sql`. Fecha a BD. A última query deve devolver 0 linhas.
5. Supabase → Authentication → desligar "Allow new users to sign up".
6. Se algo partir: `99_emergencia_reverter_fase2.sql` reabre as tabelas (é inseguro, serve só para ganhar tempo).
7. Os atletas têm de entrar de novo **uma vez** (as sessões antigas por ID deixam de valer).

## 5. Testes (correr SEMPRE depois de qualquer alteração)

```
cd tests
npm install        # só na primeira vez (playwright-core + PGlite; usa o Chrome instalado)
npm test           # regras + SQL + browser
```
- `regras.test.mjs`: regra HTML/CSS/JS separados.
- `sql.test.mjs`: corre as migrações num Postgres 17 real em memória (PGlite) que imita o Supabase (papéis `anon`/`authenticated`, `auth.uid()`), e testa os ataques (ler sem login, entrar pelo ID, token inventado, apagar dados de outro atleta, força bruta) e os bugs de faturação.
- `e2e-vendas.test.mjs`: vendas e stock no browser (criar produto, carrinho, limite de stock, pendente → paga, anular, não sócio, desconto, PDF, BD sem a migração 03, desktop).
- `e2e.test.mjs`: Chrome em ecrã de telemóvel com o Supabase simulado (`lib/mock-supabase.mjs` + `lib/mock-rpc.mjs`). Cobre os fluxos do portal, do login e do dashboard. **Nunca toca na BD real.**
- `visual.test.mjs <pasta-antiga>`: compara screenshots pixel a pixel com uma versão antiga (`git worktree add --detach <pasta> <commit>`). Prova que mexer no CSS não mudou o aspeto. Se falhar, as imagens `-antes`, `-depois` e `-diferencas` ficam em `tests/resultados/visual/`.
- `fotografia.mjs <nome>`: regista erros, 404 e KB por página, para comparar antes e depois.
- Se mudares uma função SQL, atualiza também a versão simulada em `tests/lib/mock-rpc.mjs`.

## 6. O que ficou por fazer (próximos passos)

- O webhook do Make continua visível no browser (`config.js`): qualquer pessoa o pode usar para enviar emails. Solução: passá-lo para uma Edge Function ou para um trigger com `pg_net`.
- Confirmar que as Edge Functions `notificar-alvo` e `notificar-todos` usam a `service_role` (se usarem a chave do pedido, deixam de ler `push_subscriptions` depois da fase 2).
- Comprimir os vídeos (`img/modal*.mp4`, `img/graduacoes*`) e as imagens PNG grandes (`equipa_*.png`, cerca de 6 MB cada; `equipa.html` pesa 20 MB).
- `img/mauro.png` não existe (dá 404 em `treinadores.html`; o problema já existia antes).
- O CSS antigo continua desktop-first (`max-width`). O CSS novo deve ser mobile-first.
- Ainda há `el.style.*` em JS para animações (opacidade, overflow). É JS a mexer em CSS, não HTML misturado; trocar por classes quando se mexer nesses ficheiros.
