// Backtest walk-forward: para cada rodada R, projeta usando só as rodadas anteriores e
// compara com o que aconteceu em R. Uso: npm run backtest [-- --de 8 --ate 31]
//
// Limitações: a API não guarda o status (provável/dúvida) nem o preço de rodadas passadas.
// Há dois cenários:
// - "sem status": candidatos são os que jogaram pelo menos uma das 2 últimas partidas do
//   clube, e quem não jogou a rodada conta 0 ponto (pior caso, sem saber quem é provável);
// - "com status": candidatos são só os que de fato jogaram a rodada, como se o status
//   "Provável" acertasse sempre (perto do uso real da página).
// O time avaliado é o time ideal (sem limite de cartoletas).
import fs from "node:fs";
import path from "node:path";
import type { DadosCartola } from "../src/lib/cartola/dados";
import { comBonusDasDicas } from "../src/lib/cartola/dicas";
import { escalar, escolherCapitao, CAPITAO_MULT } from "../src/lib/cartola/optimizer";
import {
  MODELO_PADRAO,
  montarAtletas,
  projetarAtletas,
  type ModeloConfig,
} from "../src/lib/cartola/projection";
import { mean, resumirHistorico } from "../src/lib/cartola/stats";
import type {
  ApiAtletaMercado,
  ApiPartidas,
  AtletaProjetado,
  PosicaoId,
  RodadaHistorica,
} from "../src/lib/cartola/types";

export interface ResultadoRodada {
  rodada: number;
  /** Pontos reais do time ideal sugerido (com capitão). */
  timeReal: number;
  timePrevisto: number;
  /** Correlação de Spearman entre projeção e pontos reais dos candidatos. */
  spearman: number;
  /** Média real dos 3 melhores projetados de cada posição, em relação à média da posição. */
  topPorPosicao: number;
  naoJogaram: number;
}

function ranks(v: number[]): number[] {
  const idx = v.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
  const r = new Array<number>(v.length);
  idx.forEach(([, i], k) => (r[i] = k));
  return r;
}

export function spearman(a: number[], b: number[]): number {
  const ra = ranks(a);
  const rb = ranks(b);
  const ma = mean(ra);
  const mb = mean(rb);
  let n = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < ra.length; i++) {
    n += (ra[i] - ma) * (rb[i] - mb);
    da += (ra[i] - ma) ** 2;
    db += (rb[i] - mb) ** 2;
  }
  return da && db ? n / Math.sqrt(da * db) : 0;
}

/** Reconstrói o "mercado" e os jogos da rodada R a partir do histórico. */
function cenarioDaRodada(rodadas: RodadaHistorica[], R: number) {
  const antes = rodadas.filter((r) => r.rodada < R);
  const alvo = rodadas.find((r) => r.rodada === R);
  if (!alvo || antes.length < 3) return null;

  // Última aparição de cada atleta e as 2 últimas rodadas de cada clube.
  const ultimo = new Map<number, { clube: number; pos: number }>();
  const rodadasDoClube = new Map<number, number[]>();
  for (const r of antes) {
    for (const [clube, c] of Object.entries(r.confrontos)) {
      if (!c.valida) continue;
      const l = rodadasDoClube.get(Number(clube)) ?? [];
      l.push(r.rodada);
      rodadasDoClube.set(Number(clube), l);
    }
    for (const [id, [, , , clube, pos]] of Object.entries(r.pontos)) {
      ultimo.set(Number(id), { clube, pos });
    }
  }
  const jogouEm = new Map<number, Set<number>>();
  for (const r of antes) {
    for (const id of Object.keys(r.pontos)) {
      const s = jogouEm.get(Number(id)) ?? new Set<number>();
      s.add(r.rodada);
      jogouEm.set(Number(id), s);
    }
  }

  const atletas: ApiAtletaMercado[] = [];
  for (const [id, { clube, pos }] of ultimo) {
    const conf = alvo.confrontos[String(clube)];
    if (!conf || !conf.valida) continue;
    const ultimas = (rodadasDoClube.get(clube) ?? []).slice(-2);
    const jogou = jogouEm.get(id) ?? new Set<number>();
    if (!ultimas.some((r) => jogou.has(r))) continue;
    atletas.push({
      atleta_id: id,
      apelido: String(id),
      clube_id: clube,
      posicao_id: pos as PosicaoId,
      status_id: 7,
      pontos_num: 0,
      media_num: 0,
      preco_num: 10,
      variacao_num: 0,
      jogos_num: 0,
    });
  }

  // Jogos da rodada R no formato da API (mando e posição do adversário na tabela).
  const partidas: ApiPartidas = { partidas: [] };
  for (const [clube, c] of Object.entries(alvo.confrontos)) {
    if (c.mando !== "C") continue;
    const visitante = alvo.confrontos[String(c.adversario)];
    partidas.partidas.push({
      clube_casa_id: Number(clube),
      clube_visitante_id: c.adversario,
      clube_visitante_posicao: c.posAdv ?? null,
      clube_casa_posicao: visitante?.posAdv ?? null,
      valida: c.valida,
    });
  }
  return { antes, alvo, atletas, partidas };
}

export function avaliarRodada(
  rodadas: RodadaHistorica[],
  R: number,
  cfg: ModeloConfig,
  comStatus = false,
  projetar = projetarAtletas,
): ResultadoRodada | null {
  const c = cenarioDaRodada(rodadas, R);
  if (!c) return null;
  const resumo = resumirHistorico(c.antes);
  const atletas = comStatus
    ? c.atletas.filter((a) => String(a.atleta_id) in c.alvo.pontos)
    : c.atletas;
  const base = montarAtletas({ atletas, clubes: {} }, resumo, c.partidas);
  const projBase: AtletaProjetado[] = projetar(base, resumo, {
    ...cfg,
    minJogos: 1,
    incertezaComStatus: comStatus ? cfg.incertezaComStatus : 1,
  });
  const proj = comBonusDasDicas(
    projBase,
    c.antes,
    resumo.modeloGols,
    c.partidas,
    (cfg.pesoDicas ?? 0) / 100,
  ).atletas;
  const real = (id: number) => c.alvo.pontos[String(id)]?.[0] ?? 0;

  const e = escalar(proj, "auto", Number.POSITIVE_INFINITY);
  if (!e) return null;
  const cap = escolherCapitao(e.titulares);
  const mult = (a: AtletaProjetado) => (a.id === cap?.id ? CAPITAO_MULT : 1);
  const timeReal = e.titulares.reduce((s, a) => s + real(a.id) * mult(a), 0);
  const timePrevisto = e.titulares.reduce((s, a) => s + a.projecao * mult(a), 0);

  const elegiveis = proj.filter((a) => a.elegivel);
  const rho = spearman(
    elegiveis.map((a) => a.projecao),
    elegiveis.map((a) => real(a.id)),
  );
  const tops: number[] = [];
  for (const pos of [1, 2, 3, 4, 5, 6]) {
    const daPos = elegiveis.filter((a) => a.posicaoId === pos);
    if (daPos.length < 6) continue;
    const mediaPos = mean(daPos.map((a) => real(a.id)));
    const top = [...daPos].sort((a, b) => b.score - a.score).slice(0, 3);
    tops.push(mean(top.map((a) => real(a.id))) - mediaPos);
  }
  return {
    rodada: R,
    timeReal,
    timePrevisto,
    spearman: rho,
    topPorPosicao: mean(tops),
    naoJogaram: e.titulares.filter((a) => !(String(a.id) in c.alvo.pontos)).length,
  };
}

export function backtest(
  rodadas: RodadaHistorica[],
  cfg: ModeloConfig,
  de: number,
  ate: number,
  comStatus = false,
  projetar = projetarAtletas,
) {
  const res: ResultadoRodada[] = [];
  for (let R = de; R <= ate; R++) {
    const r = avaliarRodada(rodadas, R, cfg, comStatus, projetar);
    if (r) res.push(r);
  }
  return {
    rodadas: res,
    timeReal: mean(res.map((r) => r.timeReal)),
    timePrevisto: mean(res.map((r) => r.timePrevisto)),
    spearman: mean(res.map((r) => r.spearman)),
    topPorPosicao: mean(res.map((r) => r.topPorPosicao)),
    naoJogaram: mean(res.map((r) => r.naoJogaram)),
  };
}

if (process.argv[1]?.endsWith("backtest.ts")) {
  const args = process.argv.slice(2);
  const arg = (nome: string, padrao: number) => {
    const i = args.indexOf(`--${nome}`);
    return i >= 0 ? Number(args[i + 1]) : padrao;
  };
  const dados = JSON.parse(
    fs.readFileSync(path.resolve(import.meta.dirname, "../data/cartola.json"), "utf8"),
  ) as DadosCartola;
  const ultima = dados.rodadas.at(-1)?.rodada ?? 0;
  const comStatus = args.includes("--com-status");
  const r = backtest(dados.rodadas, MODELO_PADRAO, arg("de", 8), arg("ate", ultima), comStatus);
  console.log(comStatus ? "Cenário com status (só quem jogou)" : "Cenário sem status");
  for (const x of r.rodadas) {
    console.log(
      `R${String(x.rodada).padStart(2)}  time ${x.timeReal.toFixed(1).padStart(5)} (prev ${x.timePrevisto.toFixed(1)})  ρ ${x.spearman.toFixed(3)}  top3 ${x.topPorPosicao >= 0 ? "+" : ""}${x.topPorPosicao.toFixed(2)}`,
    );
  }
  console.log(
    `\nMédia: time ${r.timeReal.toFixed(1)} pts (previsto ${r.timePrevisto.toFixed(1)}), ρ ${r.spearman.toFixed(3)}, top3 por posição ${r.topPorPosicao >= 0 ? "+" : ""}${r.topPorPosicao.toFixed(2)} pts sobre a média, não jogaram ${r.naoJogaram.toFixed(2)} por rodada`,
  );
}
