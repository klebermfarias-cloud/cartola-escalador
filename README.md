# Escalador Cartola FC

Monta a escalação do Cartola FC com os jogadores que têm mais chance de ir bem na rodada,
com uma 2ª opção por posição e o banco de reservas (incluindo o reserva de luxo).

## Como funciona

1. **Coleta** (`scripts/coletar.ts`): lê a API pública do Cartola (`api.cartola.globo.com`):
   status do mercado, jogadores, jogos da rodada e a pontuação de todas as rodadas já
   encerradas. Grava tudo em `data/cartola.json`. Rodadas encerradas ficam em cache em
   `data/rodadas/`, então só as novas são baixadas.
2. **Atualização automática** (`.github/workflows/coletar.yml`): o GitHub Actions roda a coleta
   a cada 2 horas e faz commit dos dados quando algo muda. Também pode ser disparada à mão em
   *Actions → Coletar dados do Cartola → Run workflow*.
3. **Página** (`src/`): React + Tailwind. Lê `data.json`, calcula as estatísticas e otimiza o time
   no próprio navegador, então mudar cartoletas, formação ou pesos é instantâneo.

## Estatísticas usadas

Média geral, desvio padrão, mediana, média em casa e fora, média das últimas 5 rodadas em que
pontuou, média básica (sem gols e assistências), participação nos jogos do clube, mínimo e
máximo, % de jogos positivos e pontos que o adversário cede para a posição (por mando).

## Regras assumidas

- Gol vale 8 pontos e assistência 5 (para a média básica).
- Capitão multiplica a pontuação por 1,5.
- Banco: um reserva por posição (sem técnico), custando no máximo o mesmo que o titular mais
  barato da posição. O reserva de luxo substitui o titular da mesma posição que pontuar menos,
  se pontuar mais.

As constantes ficam em `src/lib/cartola/stats.ts` e `src/lib/cartola/optimizer.ts`.

## Comandos

```bash
npm install
npm run coletar         # baixa os dados reais para data/cartola.json
npm run dev             # abre a página em http://localhost:5173 com os dados locais
npm test                # testes das estatísticas, projeção e otimizador
npm run build:artefato  # gera dist/artefato.html, a página publicada no claude.ai
```

A página publicada no claude.ai é `dist/artefato.html` com `data/cartola.json` publicado ao lado
como `data.json`.
