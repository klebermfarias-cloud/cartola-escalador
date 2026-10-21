// Modelo de gols por partida (Poisson com força de ataque e defesa de cada clube).
//
// Os gols de cada clube numa rodada são a soma do scout G dos seus jogadores (gols contra
// ficam de fora). Com isso estimamos, para o próximo jogo, quantos gols cada lado deve
// marcar (λ), a chance de não sofrer gol (e^-λ do adversário) e o saldo esperado.
import { mean } from "./stats";
import type { Jogo, Mando, PosicaoId, RodadaHistorica } from "./types";

/** Pontos do scout SG (jogo sem sofrer gol) para goleiro, lateral e zagueiro. */
export const PONTOS_SG = 5;
/** Pontos do scout GS (gol sofrido) para o goleiro. */
export const PONTOS_GS = -1;

/**
 * Parâmetros do modelo. Calibrados pelo backtest (scripts/backtest.ts): os pesos de cada
 * componente multiplicam o ajuste em pontos.
 */
export const CONFIG_GOLS = {
  /** Jogos fictícios na média da liga, para regularizar times com poucas partidas. */
  kTime: 4,
  /** Peso relativo de um jogo a cada rodada mais antiga (forma recente pesa mais). */
  decaimento: 0.96,
  sg: 1,
  gs: 1,
  ataque: 1,
  tecnico: 1,
};

export interface PrevisaoJogo {
  golsPro: number;
  golsContra: number;
  chanceSG: number;
}

export interface ModeloGols {
  /** Gols do clube em cada rodada: `${rodada}:${clube}` -> gols marcados. */
  gols: Map<string, number>;
  preverJogo: (clube: number, adversario: number, mando: Mando) => PrevisaoJogo | null;
  /** Pontos de técnico por gol de saldo, medido na temporada. */
  pontosTecnicoPorSaldo: number;
}

export function modeloGols(rodadas: RodadaHistorica[]): ModeloGols {
  const gols = new Map<string, number>();
  for (const r of rodadas) {
    for (const [clube, c] of Object.entries(r.confrontos)) {
      if (c.valida) gols.set(`${r.rodada}:${clube}`, 0);
    }
    for (const [, [, g, , clube]] of Object.entries(r.pontos)) {
      const k = `${r.rodada}:${clube}`;
      if (gols.has(k)) gols.set(k, (gols.get(k) ?? 0) + g);
    }
  }

  const ultima = rodadas.reduce((m, r) => Math.max(m, r.rodada), 0);
  // Somas ponderadas por clube e mando: gols marcados e sofridos.
  type Acum = { pro: number; contra: number; peso: number };
  const porClube = new Map<string, Acum>();
  const liga = { C: { gols: 0, peso: 0 }, F: { gols: 0, peso: 0 } };
  for (const r of rodadas) {
    const w = CONFIG_GOLS.decaimento ** (ultima - r.rodada);
    for (const [clube, c] of Object.entries(r.confrontos)) {
      if (!c.valida) continue;
      const pro = gols.get(`${r.rodada}:${clube}`);
      const contra = gols.get(`${r.rodada}:${c.adversario}`);
      if (pro == null || contra == null) continue;
      const k = `${clube}:${c.mando}`;
      const a = porClube.get(k) ?? { pro: 0, contra: 0, peso: 0 };
      a.pro += pro * w;
      a.contra += contra * w;
      a.peso += w;
      porClube.set(k, a);
      liga[c.mando].gols += pro * w;
      liga[c.mando].peso += w;
    }
  }
  const mediaLiga = {
    C: liga.C.peso ? liga.C.gols / liga.C.peso : 1.4,
    F: liga.F.peso ? liga.F.gols / liga.F.peso : 1.0,
  };

  // Força relativa (1 = média da liga), juntando os dois mandos e regularizando.
  const forca = (clube: number) => {
    let pro = 0;
    let contra = 0;
    let peso = 0;
    let esperadoPro = 0;
    let esperadoContra = 0;
    for (const m of ["C", "F"] as const) {
      const a = porClube.get(`${clube}:${m}`);
      if (!a) continue;
      pro += a.pro;
      contra += a.contra;
      peso += a.peso;
      esperadoPro += a.peso * mediaLiga[m];
      esperadoContra += a.peso * mediaLiga[m === "C" ? "F" : "C"];
    }
    const media = (mediaLiga.C + mediaLiga.F) / 2;
    return {
      ataque: (pro + CONFIG_GOLS.kTime * media) / (esperadoPro + CONFIG_GOLS.kTime * media),
      defesa: (contra + CONFIG_GOLS.kTime * media) / (esperadoContra + CONFIG_GOLS.kTime * media),
      jogos: peso,
    };
  };
  const cacheForca = new Map<number, ReturnType<typeof forca>>();
  const forcaDe = (clube: number) => {
    let f = cacheForca.get(clube);
    if (!f) {
      f = forca(clube);
      cacheForca.set(clube, f);
    }
    return f;
  };

  const preverJogo = (clube: number, adversario: number, mando: Mando): PrevisaoJogo | null => {
    if (liga.C.peso === 0) return null;
    const eu = forcaDe(clube);
    const ele = forcaDe(adversario);
    const golsPro = mediaLiga[mando] * eu.ataque * ele.defesa;
    const golsContra = mediaLiga[mando === "C" ? "F" : "C"] * ele.ataque * eu.defesa;
    return { golsPro, golsContra, chanceSG: Math.exp(-golsContra) };
  };

  // Quanto o técnico pontua por gol de saldo (regressão simples na temporada).
  const xs: number[] = [];
  const ys: number[] = [];
  for (const r of rodadas) {
    for (const [, [p, , , clube, pos]] of Object.entries(r.pontos)) {
      if (pos !== 6) continue;
      const c = r.confrontos[String(clube)];
      if (!c?.valida) continue;
      const pro = gols.get(`${r.rodada}:${clube}`);
      const contra = gols.get(`${r.rodada}:${c.adversario}`);
      if (pro == null || contra == null) continue;
      xs.push(pro - contra);
      ys.push(p);
    }
  }
  let pontosTecnicoPorSaldo = 0;
  if (xs.length > 10) {
    const mx = mean(xs);
    const my = mean(ys);
    let num = 0;
    let den = 0;
    for (let i = 0; i < xs.length; i++) {
      num += (xs[i] - mx) * (ys[i] - my);
      den += (xs[i] - mx) ** 2;
    }
    pontosTecnicoPorSaldo = den > 0 ? num / den : 0;
  }

  return { gols, preverJogo, pontosTecnicoPorSaldo };
}

export interface AjusteGols {
  /** Ajuste total em pontos para o jogo da rodada. */
  pontos: number;
  previsao: PrevisaoJogo;
}

/**
 * Ajuste do jogador pelo contexto do jogo: compara o jogo da rodada com os jogos que ele
 * já disputou (chance de SG, gols do time e saldo), para não contar duas vezes o que a
 * média dele já reflete.
 */
export function ajustePorGols(
  modelo: ModeloGols,
  posicao: PosicaoId,
  clube: number,
  historico: Jogo[],
  proximo: { adversario: number; mando: Mando },
): AjusteGols | null {
  const previsao = modelo.preverJogo(clube, proximo.adversario, proximo.mando);
  if (!previsao) return null;

  // Contexto médio dos jogos que ele disputou.
  let sg = 0;
  let pro = 0;
  let contra = 0;
  let n = 0;
  let gols = 0;
  let assist = 0;
  for (const j of historico) {
    if (j.adversario == null) continue;
    const gp = modelo.gols.get(`${j.rodada}:${clube}`);
    const gc = modelo.gols.get(`${j.rodada}:${j.adversario}`);
    if (gp == null || gc == null) continue;
    n++;
    pro += gp;
    contra += gc;
    if (gc === 0) sg++;
    gols += j.gols ?? 0;
    assist += j.assistencias ?? 0;
  }
  if (n === 0) return { pontos: 0, previsao };
  const sgHist = sg / n;
  const proHist = pro / n;
  const contraHist = contra / n;

  let pontos = 0;
  if (posicao === 1 || posicao === 2 || posicao === 3) {
    pontos += CONFIG_GOLS.sg * PONTOS_SG * (previsao.chanceSG - sgHist);
  }
  if (posicao === 1) {
    pontos += CONFIG_GOLS.gs * PONTOS_GS * (previsao.golsContra - contraHist);
  }
  if (posicao !== 6 && proHist > 0) {
    // Gols e assistências do jogador escalam com os gols esperados do time.
    const contribuicao = (8 * gols + 5 * assist) / n;
    pontos += CONFIG_GOLS.ataque * contribuicao * (previsao.golsPro / proHist - 1);
  }
  if (posicao === 6) {
    const saldo = previsao.golsPro - previsao.golsContra;
    pontos += CONFIG_GOLS.tecnico * modelo.pontosTecnicoPorSaldo * (saldo - (proHist - contraHist));
  }
  return { pontos, previsao };
}
