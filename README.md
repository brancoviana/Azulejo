# Azulejo

Jogo de quebra-cabeça com azulejos de cerâmica. Arraste as peças para o painel 8×8 e complete linhas ou colunas para limpá-las.

**Jogar:** https://brancoviana.github.io/Azulejo/

**Android (APK de teste):** https://github.com/brancoviana/Azulejo/releases/latest/download/azulejo.apk

Abra o link no celular, baixe o arquivo e toque nele para instalar. Na primeira vez, o Android pede para permitir "instalar apps desconhecidos" para o navegador. Cada versão nova instala por cima da anterior e mantém a partida salva.

## Regras

- A cada rodada chegam 3 peças. Novas peças só chegam depois que as três forem usadas.
- Cada azulejo colocado vale 1 ponto.
- Linhas e colunas completas são limpas. Limpar `n` de uma vez vale `10 × n(n+1)/2` pontos.
- Limpar em jogadas seguidas aumenta o multiplicador (até 8×). Uma jogada sem limpar zera a sequência.
- Esvaziar o painel inteiro dá +300 pontos.
- O jogo acaba quando nenhuma das peças restantes cabe no painel.
- A dificuldade sobe com a pontuação. No começo vêm mais peças pequenas; até 4000 pontos, as peças grandes (5 ou mais azulejos) passam de cerca de 5% para 35% das peças.

## Recursos

- **A partida fica salva.** Fechar ou recarregar a página não perde o jogo.
- **Recomeçar pede confirmação.** No meio de uma partida, o botão ↻ precisa de dois toques.
- **App instalável.** No celular, toque em "Instalar" (ou "Adicionar à tela inicial") para ter o Azulejo como app, em tela cheia e funcionando offline.

## Estrutura

| Arquivo | O que é |
| --- | --- |
| `index.html` | Interface: desenho em canvas, arrastar e soltar, sons, placar |
| `logic.js` | Regras do jogo, sem DOM: peças, pontos, dificuldade, salvar e restaurar |
| `sw.js` | Service worker: guarda os arquivos para jogar offline |
| `manifest.webmanifest`, `icons/` | Dados e ícones do app instalável |
| `android/` | App Android: abre o jogo numa WebView, com os arquivos dentro do APK |
| `fonts/` | Fontes locais (SIL Open Font License, em `fonts/OFL.txt`) |
| `test/logic.test.js` | Testes das regras (Node, sem dependências) |
| `test/site.test.js` | Confere os arquivos do app, o cache offline e o workflow |
| `test/e2e.test.js` | Testes no navegador com Playwright |

## Rodar localmente

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

`npm test` roda os testes de regras e de arquivos e não precisa instalar nada.

Ao adicionar ou remover arquivos do site, atualize a lista `FILES` em `sw.js`. O teste `site.test.js` avisa se você esquecer.

## Publicação

Cada push na `main` roda os testes no GitHub Actions. Se passarem, o jogo é publicado no GitHub Pages e um APK novo sai em [Releases](https://github.com/brancoviana/Azulejo/releases).

O APK é assinado com `android/app/teste.keystore`, uma chave **só para testes** que fica no repositório. Para publicar na Play Store, crie uma chave própria e guarde-a como segredo do GitHub, fora do repositório.
