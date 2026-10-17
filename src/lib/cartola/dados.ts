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
}

export function mercadoDe(d: DadosCartola): ApiMercado {
  return { atletas: d.atletas, clubes: d.clubes };
}
