import type {
  ApiAtletaMercado,
  ApiMercado,
  ApiMercadoStatus,
  ApiPartidas,
  RodadaHistorica,
} from "./types";

/** Clube como gravado pelo coletor: escudo já embutido como data URI. */
export interface ClubeDados {
  id: number;
  nome: string;
  abreviacao: string;
  nome_fantasia?: string;
  escudo: string | null;
}

/** Formato de data/cartola.json, gerado por scripts/coletar.ts. */
export interface DadosCartola {
  atualizadoEm: string;
  temporada: number;
  status: ApiMercadoStatus;
  atletas: ApiAtletaMercado[];
  clubes: Record<string, ClubeDados>;
  partidas: ApiPartidas;
  rodadas: RodadaHistorica[];
  rodadasIndisponiveis: number[];
  /** Mais escalados da rodada (mercado/destaques), do mais para o menos escalado. */
  maisEscalados?: MaisEscalado[];
}

export interface MaisEscalado {
  atleta_id: number;
  escalacoes: number;
}

/**
 * Normaliza a resposta de mercado/destaques. Aceita o atleta aninhado em `Atleta`
 * ou com os campos na raiz do item.
 */
export function normalizarDestaques(brutos: unknown): MaisEscalado[] {
  if (!Array.isArray(brutos)) return [];
  const out: MaisEscalado[] = [];
  const vistos = new Set<number>();
  for (const item of brutos) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const atleta = (r.Atleta ?? r.atleta) as Record<string, unknown> | undefined;
    const id = Number(atleta?.atleta_id ?? r.atleta_id);
    const escalacoes = Number(r.escalacoes ?? atleta?.escalacoes);
    if (!Number.isFinite(id) || !Number.isFinite(escalacoes) || vistos.has(id)) continue;
    vistos.add(id);
    out.push({ atleta_id: id, escalacoes });
  }
  return out.sort((a, b) => b.escalacoes - a.escalacoes);
}

export function mercadoDe(d: DadosCartola): ApiMercado {
  return { atletas: d.atletas, clubes: d.clubes };
}
