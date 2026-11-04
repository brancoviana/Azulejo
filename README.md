# Azulejo

Jogo de quebra-cabeça com azulejos de cerâmica. Arraste as peças para o painel 8×8 e complete linhas ou colunas para limpá-las.

**Jogar:** https://brancoviana.github.io/Azulejo/

## Regras

- A cada rodada chegam 3 peças. Novas peças só chegam depois que as três forem usadas.
- Cada azulejo colocado vale 1 ponto.
- Linhas e colunas completas são limpas. Limpar `n` de uma vez vale `10 × n(n+1)/2` pontos.
- Limpar em jogadas seguidas aumenta o multiplicador (até 8×). Uma jogada sem limpar zera a sequência.
- Esvaziar o painel inteiro dá +300 pontos.
- O jogo acaba quando nenhuma das peças restantes cabe no painel.

## Estrutura

| Arquivo | O que é |
| --- | --- |
| `index.html` | Interface: desenho em canvas, arrastar e soltar, sons, placar |
| `logic.js` | Regras do jogo, sem DOM (usado pelo navegador e pelos testes) |
| `test/logic.test.js` | Testes das regras (Node, sem dependências) |
| `test/e2e.test.js` | Testes no navegador com Playwright |

## Rodar localmente

Abra `index.html` no navegador, ou:

```bash
npm start
```

## Testes

```bash
npm install
```

```bash
npx playwright install chromium
```

```bash
npm run test:all
```

`npm test` roda só os testes de regras e não precisa instalar nada.

## Publicação

Cada push na `main` roda os testes no GitHub Actions. Se passarem, o jogo é publicado no GitHub Pages.
