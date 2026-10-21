import type {
  ApiPartidas,
  ApiPontuados,
  Confronto,
  EstatisticasAtleta,
  Jogo,
  NivelAdversario,
  RodadaHistorica,
} from "./types";
import { modeloGols, type ModeloGols } from "./gols";

/** Pontos de scout usados para a média básica (pontuação sem gols e assistências). */
export const PONTOS_GOL = 8;
export const PONTOS_ASSISTENCIA = 5;

export const ULTIMAS_N = 5;

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/** Desvio padrão amostral (n-1). */
export function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += (x - m) ** 2;
  return Math.sqrt(s / (xs.length - 1));
}

export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const a = [...xs].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

/** Encolhe uma média amostral em direção a uma média de referência (bayesiano simples). */
export function shrink(value: number | null, n: number, prior: number, k: number): number {
  if (value == null || n <= 0) return prior;
  return (n * value + k * prior) / (n + k);
}

export function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

// ---------------------------------------------------------------------------
// Conversão das respostas da API para o formato compacto

export function confrontosDaRodada(
  partidas: ApiPartidas | null | undefined,
): Record<string, Confronto> {
  const out: Record<string, Confronto> = {};
  for (const p of partidas?.partidas ?? []) {
    const valida = p.valida !== false;
    out[String(p.clube_casa_id)] = {
      mando: "C",
      adversario: p.clube_visitante_id,
      valida,
      posAdv: p.clube_visitante_posicao ?? null,
    };
    out[String(p.clube_visitante_id)] = {
      mando: "F",
      adversario: p.clube_casa_id,
      valida,
      posAdv: p.clube_casa_posicao ?? null,
    };
  }
  return out;
}

export function compactarRodada(
  rodada: number,
  pontuados: ApiPontuados | null | undefined,
  partidas: ApiPartidas | null | undefined,
): RodadaHistorica {
  const pontos: RodadaHistorica["pontos"] = {};
  for (const [id, a] of Object.entries(pontuados?.atletas ?? {})) {
    if (!a || a.entrou_em_campo === false) continue;
    const p = Number(a.pontuacao);
    if (!Number.isFinite(p)) continue;
    const g = Number(a.scout?.G ?? 0) || 0;
    const as = Number(a.scout?.A ?? 0) || 0;
    pontos[id] = [round2(p), g, as, a.clube_id, a.posicao_id];
  }
  return { rodada, pontos, confrontos: confrontosDaRodada(partidas) };
}

/** Faixa de dificuldade pela posição do adversário na tabela: 1-5, 6-10, 11-15, 16-20. */
export function nivelAdversario(posicaoTabela: number | null | undefined): NivelAdversario | null {
  if (posicaoTabela == null || !Number.isFinite(posicaoTabela) || posicaoTabela < 1) return null;
  if (posicaoTabela <= 5) return "muito-dificil";
  if (posicaoTabela <= 10) return "dificil";
  if (posicaoTabela <= 15) return "facil";
  return "muito-facil";
}

// ---------------------------------------------------------------------------
// Estatísticas por atleta

export function estatisticasVazias(): EstatisticasAtleta {
  return {
    jogos: 0,
    media: 0,
    desvio: 0,
    mediana: 0,
    mediaCasa: null,
    jogosCasa: 0,
    mediaFora: null,
    jogosFora: 0,
    mediaUltimas: null,
    jogosUltimas: 0,
    mediaBasica: 0,
    minimo: 0,
    maximo: 0,
    pctPositivos: 0,
    participacao: 0,
    tendencia: 0,
    pctAcimaCasa: null,
    pctAcimaFora: null,
    historico: [],
  };
}

export function calcularEstatisticas(jogos: Jogo[], rodadasDoClube: number): EstatisticasAtleta {
  if (jogos.length === 0) return estatisticasVazias();
  const hist = [...jogos].sort((a, b) => a.rodada - b.rodada);
  const pts = hist.map((j) => j.pontos);
  const casa = hist.filter((j) => j.mando === "C").map((j) => j.pontos);
  const fora = hist.filter((j) => j.mando === "F").map((j) => j.pontos);
  const ultimas = hist.slice(-ULTIMAS_N).map((j) => j.pontos);
  const media = mean(pts);
  const mediaUltimas = ultimas.length ? mean(ultimas) : null;
  const pctAcima = (xs: number[]) =>
    xs.length ? xs.filter((p) => p > media).length / xs.length : null;
  return {
    jogos: hist.length,
    media,
    desvio: stdDev(pts),
    mediana: median(pts),
    mediaCasa: casa.length ? mean(casa) : null,
    jogosCasa: casa.length,
    mediaFora: fora.length ? mean(fora) : null,
    jogosFora: fora.length,
    mediaUltimas,
    jogosUltimas: ultimas.length,
    mediaBasica: mean(hist.map((j) => j.basica)),
    minimo: Math.min(...pts),
    maximo: Math.max(...pts),
    pctPositivos: pts.filter((p) => p > 0).length / pts.length,
    participacao: rodadasDoClube > 0 ? Math.min(1, hist.length / rodadasDoClube) : 1,
    tendencia: mediaUltimas != null ? mediaUltimas - media : 0,
    pctAcimaCasa: pctAcima(casa),
    pctAcimaFora: pctAcima(fora),
    historico: hist,
  };
}

export interface ResumoHistorico {
  /** atleta_id -> jogos */
  jogosPorAtleta: Map<number, Jogo[]>;
  /** clube_id -> nº de rodadas em que o clube jogou */
  rodadasPorClube: Map<number, number>;
  /** posição -> média de pontos por aparição na liga */
  mediaPorPosicao: Map<number, number>;
  /** `${clube}:${pos}` -> { soma, n } de pontos cedidos pelo clube à posição */
  cedidas: Map<string, { soma: number; n: number }>;
  /** `${clube}:${pos}:${mandoDoClube}` -> pontos cedidos separados por mando */
  cedidasMando: Map<string, { soma: number; n: number }>;
  /** `${pos}:${mando}` -> pontos da posição jogando em casa (C) ou fora (F) */
  porPosicaoMando: Map<string, { soma: number; n: number }>;
  /** `${pos}:${nivel}` -> pontos da posição contra cada faixa de adversário */
  porPosicaoNivel: Map<string, { soma: number; n: number }>;
  /** clube_id -> rodadas válidas em que o clube jogou, em ordem */
  rodadasDoClube: Map<number, number[]>;
  /** `${jogouUltima ? 1 : 0}:${ultimas5}` -> quantos estavam nessa situação e quantos jogaram */
  chanceJogarPorPadrao: Map<string, { n: number; jogou: number }>;
  modeloGols: ModeloGols;
}

/** Presença do atleta nas últimas `n` partidas válidas do clube (mais recente primeiro). */
export function presencaRecente(
  rodadasDoClube: number[] | undefined,
  rodadasJogadas: Set<number>,
  ate = Number.POSITIVE_INFINITY,
  n = 5,
): boolean[] {
  const out: boolean[] = [];
  const lista = rodadasDoClube ?? [];
  for (let i = lista.length - 1; i >= 0 && out.length < n; i--) {
    if (lista[i] >= ate) continue;
    out.push(rodadasJogadas.has(lista[i]));
  }
  return out;
}

export function chavePresenca(presenca: boolean[]): string {
  return `${presenca[0] ? 1 : 0}:${presenca.filter(Boolean).length}`;
}

function acumular(map: Map<string, { soma: number; n: number }>, key: string, v: number) {
  const cur = map.get(key);
  if (cur) {
    cur.soma += v;
    cur.n += 1;
  } else map.set(key, { soma: v, n: 1 });
}

export function resumirHistorico(rodadas: RodadaHistorica[]): ResumoHistorico {
  const jogosPorAtleta = new Map<number, Jogo[]>();
  const rodadasPorClube = new Map<number, number>();
  const somaPos = new Map<number, { soma: number; n: number }>();
  const cedidas = new Map<string, { soma: number; n: number }>();
  const cedidasMando = new Map<string, { soma: number; n: number }>();
  const porPosicaoMando = new Map<string, { soma: number; n: number }>();
  const porPosicaoNivel = new Map<string, { soma: number; n: number }>();

  for (const r of rodadas) {
    for (const [clube, c] of Object.entries(r.confrontos)) {
      if (!c.valida) continue;
      rodadasPorClube.set(Number(clube), (rodadasPorClube.get(Number(clube)) ?? 0) + 1);
    }
    for (const [id, [p, g, a, clube, pos]] of Object.entries(r.pontos)) {
      const conf = r.confrontos[String(clube)];
      const jogo: Jogo = {
        rodada: r.rodada,
        pontos: p,
        basica: round2(p - g * PONTOS_GOL - a * PONTOS_ASSISTENCIA),
        mando: conf?.mando ?? null,
        adversario: conf?.adversario ?? null,
        nivelAdversario: nivelAdversario(conf?.posAdv),
        gols: g,
        assistencias: a,
      };
      const atletaId = Number(id);
      const lista = jogosPorAtleta.get(atletaId);
      if (lista) lista.push(jogo);
      else jogosPorAtleta.set(atletaId, [jogo]);

      const sp = somaPos.get(pos);
      if (sp) {
        sp.soma += p;
        sp.n += 1;
      } else somaPos.set(pos, { soma: p, n: 1 });

      if (conf) {
        acumular(cedidas, `${conf.adversario}:${pos}`, p);
        // mando do adversário (quem cedeu): oposto ao do atleta
        const mandoAdv = conf.mando === "C" ? "F" : "C";
        acumular(cedidasMando, `${conf.adversario}:${pos}:${mandoAdv}`, p);
        acumular(porPosicaoMando, `${pos}:${conf.mando}`, p);
        if (jogo.nivelAdversario) acumular(porPosicaoNivel, `${pos}:${jogo.nivelAdversario}`, p);
      }
    }
  }

  const mediaPorPosicao = new Map<number, number>();
  for (const [pos, { soma, n }] of somaPos) mediaPorPosicao.set(pos, n ? soma / n : 0);

  // Rodadas de cada clube e, para cada rodada, quem estava no elenco recente e se jogou:
  // dá a chance empírica de jogar conforme a presença nas últimas 5 partidas.
  const rodadasDoClube = new Map<number, number[]>();
  const ordenadas = [...rodadas].sort((a, b) => a.rodada - b.rodada);
  for (const r of ordenadas) {
    for (const [clube, c] of Object.entries(r.confrontos)) {
      if (!c.valida) continue;
      const l = rodadasDoClube.get(Number(clube)) ?? [];
      l.push(r.rodada);
      rodadasDoClube.set(Number(clube), l);
    }
  }
  const chanceJogarPorPadrao = new Map<string, { n: number; jogou: number }>();
  const jogadas = new Map<number, Set<number>>();
  const clubeAtual = new Map<number, number>();
  for (const r of ordenadas) {
    for (const [id, clube] of clubeAtual) {
      const conf = r.confrontos[String(clube)];
      if (!conf?.valida) continue;
      const pres = presencaRecente(
        rodadasDoClube.get(clube),
        jogadas.get(id) ?? new Set(),
        r.rodada,
      );
      if (pres.length < 5 || !pres.some(Boolean)) continue;
      const k = chavePresenca(pres);
      const t = chanceJogarPorPadrao.get(k) ?? { n: 0, jogou: 0 };
      t.n++;
      if (String(id) in r.pontos) t.jogou++;
      chanceJogarPorPadrao.set(k, t);
    }
    for (const [id, [, , , clube]] of Object.entries(r.pontos)) {
      const s = jogadas.get(Number(id)) ?? new Set<number>();
      s.add(r.rodada);
      jogadas.set(Number(id), s);
      clubeAtual.set(Number(id), clube);
    }
  }

  return {
    jogosPorAtleta,
    rodadasPorClube,
    mediaPorPosicao,
    cedidas,
    cedidasMando,
    porPosicaoMando,
    porPosicaoNivel,
    rodadasDoClube,
    chanceJogarPorPadrao,
    modeloGols: modeloGols(rodadas),
  };
}
