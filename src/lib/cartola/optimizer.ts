import type { AtletaProjetado, PosAbrev, PosicaoId } from "./types";
import { POS_ID_BY_ABREV } from "./types";

export interface Formacao {
  nome: string;
  posicoes: Record<PosAbrev, number>;
}

export const FORMACOES: Formacao[] = [
  { nome: "3-4-3", posicoes: { gol: 1, lat: 0, zag: 3, mei: 4, ata: 3, tec: 1 } },
  { nome: "3-5-2", posicoes: { gol: 1, lat: 0, zag: 3, mei: 5, ata: 2, tec: 1 } },
  { nome: "4-3-3", posicoes: { gol: 1, lat: 2, zag: 2, mei: 3, ata: 3, tec: 1 } },
  { nome: "4-4-2", posicoes: { gol: 1, lat: 2, zag: 2, mei: 4, ata: 2, tec: 1 } },
  { nome: "4-5-1", posicoes: { gol: 1, lat: 2, zag: 2, mei: 5, ata: 1, tec: 1 } },
  { nome: "5-3-2", posicoes: { gol: 1, lat: 2, zag: 3, mei: 3, ata: 2, tec: 1 } },
  { nome: "5-4-1", posicoes: { gol: 1, lat: 2, zag: 3, mei: 4, ata: 1, tec: 1 } },
];

/** Multiplicador da pontuação do capitão. */
export const CAPITAO_MULT = 1.5;

const POOL_POR_POSICAO = 40;
const EPS = 1e-9;

export interface Escalacao {
  formacao: string;
  titulares: AtletaProjetado[];
  /** id do titular -> alternativa sugerida para a mesma vaga */
  alternativas: Record<number, AtletaProjetado | null>;
  custo: number;
  projecao: number;
  score: number;
  capitaoId: number | null;
}

function demanda(f: Formacao): Map<PosicaoId, number> {
  const m = new Map<PosicaoId, number>();
  for (const [abrev, n] of Object.entries(f.posicoes) as [PosAbrev, number][]) {
    if (n > 0) m.set(POS_ID_BY_ABREV[abrev], n);
  }
  return m;
}

function custoDe(xs: AtletaProjetado[]): number {
  let s = 0;
  for (const x of xs) s += x.preco;
  return s;
}

function scoreDe(xs: AtletaProjetado[]): number {
  let s = 0;
  for (const x of xs) s += x.score;
  return s;
}

/** Monta o pool de candidatos por posição: os melhores por score + os mais baratos (viabilidade). */
function montarPools(atletas: AtletaProjetado[], dem: Map<PosicaoId, number>) {
  const pools = new Map<PosicaoId, AtletaProjetado[]>();
  for (const pos of dem.keys()) {
    const elegiveis = atletas.filter((a) => a.elegivel && a.posicaoId === pos);
    const porScore = [...elegiveis].sort((a, b) => b.score - a.score).slice(0, POOL_POR_POSICAO);
    const baratos = [...elegiveis]
      .sort((a, b) => a.preco - b.preco || b.score - a.score)
      .slice(0, 10);
    const ids = new Set(porScore.map((a) => a.id));
    pools.set(pos, [...porScore, ...baratos.filter((a) => !ids.has(a.id))]);
  }
  return pools;
}

function escolherComLambda(
  pools: Map<PosicaoId, AtletaProjetado[]>,
  dem: Map<PosicaoId, number>,
  lambda: number,
): AtletaProjetado[] | null {
  const out: AtletaProjetado[] = [];
  for (const [pos, n] of dem) {
    const pool = pools.get(pos) ?? [];
    if (pool.length < n) return null;
    const ord = [...pool].sort(
      (a, b) => b.score - lambda * b.preco - (a.score - lambda * a.preco) || a.preco - b.preco,
    );
    out.push(...ord.slice(0, n));
  }
  return out;
}

/** Busca local: trocas simples e duplas que aumentam o score sem estourar o orçamento. */
function melhorarLocal(
  time: AtletaProjetado[],
  pools: Map<PosicaoId, AtletaProjetado[]>,
  orcamento: number,
): AtletaProjetado[] {
  const t = [...time];
  for (let iter = 0; iter < 100; iter++) {
    const usados = new Set(t.map((a) => a.id));
    const custo = custoDe(t);
    let melhorGanho = EPS;
    let melhor: { i: number; c: AtletaProjetado; j?: number; d?: AtletaProjetado } | null = null;

    for (let i = 0; i < t.length; i++) {
      const ti = t[i];
      for (const c of pools.get(ti.posicaoId) ?? []) {
        if (usados.has(c.id)) continue;
        const ganho = c.score - ti.score;
        if (ganho > melhorGanho && custo - ti.preco + c.preco <= orcamento + EPS) {
          melhorGanho = ganho;
          melhor = { i, c };
        }
      }
    }

    for (let i = 0; i < t.length; i++) {
      const ti = t[i];
      const poolI = (pools.get(ti.posicaoId) ?? []).filter((c) => !usados.has(c.id));
      for (let j = i + 1; j < t.length; j++) {
        const tj = t[j];
        const poolJ = (pools.get(tj.posicaoId) ?? []).filter((d) => !usados.has(d.id));
        const base = custo - ti.preco - tj.preco;
        const scoreBase = ti.score + tj.score;
        for (const c of poolI) {
          for (const d of poolJ) {
            if (c.id === d.id) continue;
            const ganho = c.score + d.score - scoreBase;
            if (ganho > melhorGanho && base + c.preco + d.preco <= orcamento + EPS) {
              melhorGanho = ganho;
              melhor = { i, c, j, d };
            }
          }
        }
      }
    }

    if (!melhor) break;
    t[melhor.i] = melhor.c;
    if (melhor.j != null && melhor.d) t[melhor.j] = melhor.d;
  }
  return t;
}

function otimizarFormacao(
  atletas: AtletaProjetado[],
  formacao: Formacao,
  orcamento: number,
): AtletaProjetado[] | null {
  const dem = demanda(formacao);
  const pools = montarPools(atletas, dem);

  let time = escolherComLambda(pools, dem, 0);
  if (!time) return null;

  if (custoDe(time) > orcamento + EPS) {
    // Relaxação lagrangiana: penaliza preço até o time caber no orçamento.
    let lo = 0;
    let hi = 1;
    let viavel: AtletaProjetado[] | null = null;
    for (let i = 0; i < 20; i++) {
      const t = escolherComLambda(pools, dem, hi);
      if (t && custoDe(t) <= orcamento + EPS) {
        viavel = t;
        break;
      }
      lo = hi;
      hi *= 2;
    }
    if (!viavel) {
      // Último recurso: os mais baratos de cada posição.
      const baratos = escolherComLambda(pools, dem, 1e6);
      if (!baratos || custoDe(baratos) > orcamento + EPS) return null;
      viavel = baratos;
    } else {
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        const t = escolherComLambda(pools, dem, mid);
        if (t && custoDe(t) <= orcamento + EPS) {
          viavel = t;
          hi = mid;
        } else lo = mid;
      }
    }
    time = viavel;
  }

  return melhorarLocal(time, pools, orcamento);
}

const ORDEM_POS: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5 };

export function ordenarTime(xs: AtletaProjetado[]): AtletaProjetado[] {
  return [...xs].sort(
    (a, b) => ORDEM_POS[a.posicaoId] - ORDEM_POS[b.posicaoId] || b.score - a.score,
  );
}

/** Capitão sugerido: maior score entre os jogadores de linha/goleiro (técnico não pode ser capitão). */
export function escolherCapitao(titulares: AtletaProjetado[]): AtletaProjetado | null {
  let best: AtletaProjetado | null = null;
  for (const a of titulares) {
    if (a.posicaoId === 6) continue;
    if (!best || a.score > best.score) best = a;
  }
  return best;
}

export function projecaoTime(titulares: AtletaProjetado[], capitaoId: number | null): number {
  let s = 0;
  for (const a of titulares) s += a.id === capitaoId ? a.projecao * CAPITAO_MULT : a.projecao;
  return s;
}

/**
 * Para cada titular, sugere uma alternativa distinta da mesma posição.
 * Prioriza a melhor opção que mantém o time dentro do orçamento quando trocada isoladamente.
 */
export function sugerirAlternativas(
  atletas: AtletaProjetado[],
  titulares: AtletaProjetado[],
  orcamento: number,
): Record<number, AtletaProjetado | null> {
  const usados = new Set(titulares.map((a) => a.id));
  const custo = custoDe(titulares);
  const out: Record<number, AtletaProjetado | null> = {};
  const porPos = new Map<number, AtletaProjetado[]>();
  for (const a of atletas) {
    if (!a.elegivel || usados.has(a.id)) continue;
    const l = porPos.get(a.posicaoId);
    if (l) l.push(a);
    else porPos.set(a.posicaoId, [a]);
  }
  for (const l of porPos.values()) l.sort((a, b) => b.score - a.score);

  for (const t of [...titulares].sort((a, b) => b.score - a.score)) {
    const pool = porPos.get(t.posicaoId) ?? [];
    const cabe = pool.find(
      (c) => !usados.has(c.id) && custo - t.preco + c.preco <= orcamento + EPS,
    );
    const escolha = cabe ?? pool.find((c) => !usados.has(c.id)) ?? null;
    if (escolha) usados.add(escolha.id);
    out[t.id] = escolha;
  }
  return out;
}

export function escalar(
  atletas: AtletaProjetado[],
  formacaoNome: string | "auto",
  orcamento: number,
): Escalacao | null {
  const formacoes =
    formacaoNome === "auto" ? FORMACOES : FORMACOES.filter((f) => f.nome === formacaoNome);
  let melhor: { f: Formacao; time: AtletaProjetado[]; total: number } | null = null;
  for (const f of formacoes) {
    const time = otimizarFormacao(atletas, f, orcamento);
    if (!time) continue;
    const cap = escolherCapitao(time);
    // inclui o bônus do capitão na comparação entre formações
    const total = scoreDe(time) + (cap ? cap.score * (CAPITAO_MULT - 1) : 0);
    if (!melhor || total > melhor.total + EPS) melhor = { f, time, total };
  }
  if (!melhor) return null;

  const titulares = ordenarTime(melhor.time);
  const capitao = escolherCapitao(titulares);
  return {
    formacao: melhor.f.nome,
    titulares,
    alternativas: sugerirAlternativas(atletas, titulares, orcamento),
    custo: custoDe(titulares),
    projecao: projecaoTime(titulares, capitao?.id ?? null),
    score: scoreDe(titulares),
    capitaoId: capitao?.id ?? null,
  };
}

// ---------------------------------------------------------------------------
// Banco de reservas

/** Posições que têm reserva no banco (o técnico não tem). */
export const POSICOES_BANCO: PosicaoId[] = [1, 2, 3, 4, 5];

/** Desvio padrão usado quando o atleta ainda não tem histórico suficiente. */
const DESVIO_PADRAO_MINIMO = 3;

export interface Banco {
  reservas: AtletaProjetado[];
  /** Reserva de luxo: substitui o titular da mesma posição que pontuar menos, se ele pontuar mais. */
  luxoId: number | null;
}

function cdfNormal(z: number): number {
  // Aproximação de Abramowitz-Stegun para a função erro.
  const t = 1 / (1 + 0.3275911 * (Math.abs(z) / Math.SQRT2));
  const poly =
    t *
    (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

/** E[max(0, D)] para D ~ Normal(media, desvio). */
export function ganhoEsperado(media: number, desvio: number): number {
  if (desvio <= 0) return Math.max(0, media);
  const z = media / desvio;
  const pdf = Math.exp(-(z * z) / 2) / Math.sqrt(2 * Math.PI);
  return media * cdfNormal(z) + desvio * pdf;
}

/**
 * Um reserva por posição, custando no máximo o mesmo que o titular mais barato da posição.
 * O reserva de luxo é o que tem o maior ganho esperado sobre o pior titular da sua posição.
 */
export function escolherBanco(
  atletas: AtletaProjetado[],
  titulares: AtletaProjetado[],
  excluir: Set<number> = new Set(),
): Banco {
  const usados = new Set([...titulares.map((a) => a.id), ...excluir]);
  const reservas: AtletaProjetado[] = [];
  let luxo: { id: number; ganho: number } | null = null;

  for (const pos of POSICOES_BANCO) {
    const daPosicao = titulares.filter((a) => a.posicaoId === pos);
    if (daPosicao.length === 0) continue;
    const limite = Math.min(...daPosicao.map((a) => a.preco));
    let melhor: AtletaProjetado | null = null;
    for (const a of atletas) {
      if (a.posicaoId !== pos || !a.elegivel || usados.has(a.id) || a.preco > limite + EPS)
        continue;
      if (!melhor || a.score > melhor.score) melhor = a;
    }
    if (!melhor) continue;
    reservas.push(melhor);

    const pior = daPosicao.reduce((p, a) => (a.projecao < p.projecao ? a : p));
    const dp = (x: AtletaProjetado) => Math.max(x.stats.desvio, DESVIO_PADRAO_MINIMO);
    const ganho = ganhoEsperado(melhor.projecao - pior.projecao, Math.hypot(dp(melhor), dp(pior)));
    if (!luxo || ganho > luxo.ganho) luxo = { id: melhor.id, ganho };
  }

  return { reservas, luxoId: luxo?.id ?? null };
}
