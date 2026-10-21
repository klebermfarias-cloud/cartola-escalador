// Tipos da API pública do Cartola FC (api.cartola.globo.com) e do modelo interno.

export type PosicaoId = 1 | 2 | 3 | 4 | 5 | 6;
export type PosAbrev = "gol" | "lat" | "zag" | "mei" | "ata" | "tec";

export const POSICOES: Record<PosicaoId, { abrev: PosAbrev; nome: string; curto: string }> = {
  1: { abrev: "gol", nome: "Goleiro", curto: "GOL" },
  2: { abrev: "lat", nome: "Lateral", curto: "LAT" },
  3: { abrev: "zag", nome: "Zagueiro", curto: "ZAG" },
  4: { abrev: "mei", nome: "Meia", curto: "MEI" },
  5: { abrev: "ata", nome: "Atacante", curto: "ATA" },
  6: { abrev: "tec", nome: "Técnico", curto: "TEC" },
};

export const POS_ID_BY_ABREV: Record<PosAbrev, PosicaoId> = {
  gol: 1,
  lat: 2,
  zag: 3,
  mei: 4,
  ata: 5,
  tec: 6,
};

/** IDs de status do atleta no mercado. */
export const STATUS = {
  DUVIDA: 2,
  SUSPENSO: 3,
  CONTUNDIDO: 5,
  NULO: 6,
  PROVAVEL: 7,
} as const;

export interface ApiMercadoStatus {
  rodada_atual: number;
  status_mercado: number;
  temporada?: number;
  fechamento?: {
    dia: number;
    mes: number;
    ano: number;
    hora: number;
    minuto: number;
    timestamp?: number;
  };
  game_over?: boolean;
}

export interface ApiClube {
  id: number;
  nome: string;
  abreviacao: string;
  nome_fantasia?: string;
  escudos?: Record<string, string>;
}

export interface ApiAtletaMercado {
  atleta_id: number;
  apelido: string;
  nome?: string;
  foto?: string | null;
  clube_id: number;
  posicao_id: PosicaoId;
  status_id: number;
  pontos_num: number;
  media_num: number;
  preco_num: number;
  variacao_num: number;
  jogos_num: number;
  minimo_para_valorizar?: number | null;
  scout?: Record<string, number> | null;
}

export interface ApiMercado {
  atletas: ApiAtletaMercado[];
  clubes: Record<string, ApiClube>;
  posicoes?: Record<string, { id: number; nome: string; abreviacao: string }>;
  status?: Record<string, { id: number; nome: string }>;
}

export interface ApiPartida {
  partida_id?: number;
  clube_casa_id: number;
  clube_visitante_id: number;
  clube_casa_posicao?: number | null;
  clube_visitante_posicao?: number | null;
  aproveitamento_mandante?: string[];
  aproveitamento_visitante?: string[];
  placar_oficial_mandante?: number | null;
  placar_oficial_visitante?: number | null;
  partida_data?: string;
  local?: string;
  valida?: boolean;
}

export interface ApiPartidas {
  partidas: ApiPartida[];
  clubes?: Record<string, ApiClube>;
  rodada?: number;
}

export interface ApiPontuado {
  apelido?: string;
  pontuacao: number;
  scout?: Record<string, number> | null;
  posicao_id: number;
  clube_id: number;
  entrou_em_campo?: boolean;
}

export interface ApiPontuados {
  atletas: Record<string, ApiPontuado>;
  rodada?: number;
}

// ---------------------------------------------------------------------------
// Modelo interno (compacto, cacheável)

export type Mando = "C" | "F";

/** Faixa de dificuldade do adversário pela posição na tabela (4 níveis de 5 posições). */
export type NivelAdversario = "muito-dificil" | "dificil" | "facil" | "muito-facil";

export const NIVEIS_ADVERSARIO: Record<NivelAdversario, { rotulo: string; faixa: string }> = {
  "muito-dificil": { rotulo: "Muito difícil", faixa: "1º ao 5º" },
  dificil: { rotulo: "Difícil", faixa: "6º ao 10º" },
  facil: { rotulo: "Fácil", faixa: "11º ao 15º" },
  "muito-facil": { rotulo: "Muito fácil", faixa: "16º ao 20º" },
};

/** Confronto de um clube numa rodada. */
export interface Confronto {
  mando: Mando;
  adversario: number;
  valida: boolean;
  /** Posição do adversário na tabela naquela rodada (quando a API informa). */
  posAdv?: number | null;
}

/** Dados compactos de uma rodada já encerrada. */
export interface RodadaHistorica {
  rodada: number;
  /** atleta_id -> [pontos, gols, assistências, clube_id, posicao_id] */
  pontos: Record<string, [number, number, number, number, number]>;
  /** clube_id -> confronto */
  confrontos: Record<string, Confronto>;
}

export interface Jogo {
  rodada: number;
  pontos: number;
  basica: number;
  mando: Mando | null;
  adversario: number | null;
  nivelAdversario: NivelAdversario | null;
  gols?: number;
  assistencias?: number;
}

export interface EstatisticasAtleta {
  jogos: number;
  media: number;
  desvio: number;
  mediana: number;
  mediaCasa: number | null;
  jogosCasa: number;
  mediaFora: number | null;
  jogosFora: number;
  /** Média das últimas 5 rodadas em que pontuou. */
  mediaUltimas: number | null;
  jogosUltimas: number;
  mediaBasica: number;
  minimo: number;
  maximo: number;
  /** % de jogos com pontuação positiva. */
  pctPositivos: number;
  /** % das rodadas disputadas pelo clube em que o atleta entrou em campo. */
  participacao: number;
  /** Forma - média geral. */
  tendencia: number;
  /** % dos jogos em casa / fora em que pontuou acima da própria média geral. */
  pctAcimaCasa: number | null;
  pctAcimaFora: number | null;
  historico: Jogo[];
}

export interface ProximoJogo {
  adversario: number;
  mando: Mando;
  valida: boolean;
  data?: string;
  posicaoTabela?: number | null;
  posicaoTabelaAdversario?: number | null;
}

export interface Atleta {
  id: number;
  apelido: string;
  foto: string | null;
  clubeId: number;
  posicaoId: PosicaoId;
  statusId: number;
  preco: number;
  variacao: number;
  minimoValorizar: number | null;
  mediaOficial: number;
  jogosOficial: number;
  scoutTotal: Record<string, number>;
  /** Quantos times escalaram o atleta na rodada, quando ele está entre os mais escalados. */
  escalacoes?: number | null;
  stats: EstatisticasAtleta;
  proximo: ProximoJogo | null;
  /** Presença nas últimas partidas do clube (para a chance de jogar). */
  recentes: { jogouUltima: boolean; ultimas5: number; partidas: number };
}

export interface AtletaProjetado extends Atleta {
  /** Pontuação esperada na rodada. */
  projecao: number;
  /** Projeção ajustada ao perfil de risco (usada para ranquear). */
  score: number;
  /** Média de pontos que o adversário cede para a posição (ajustada). */
  cedidasAdversario: number | null;
  /** Ajuste (em pontos) aplicado pelo confronto. */
  ajusteAdversario: number;
  /** Fator casa/fora: diferença esperada (pts) em relação à média geral pelo mando do jogo. */
  ajusteMando: number;
  /** Chance estimada de pontuar acima da própria média geral, dado o mando do jogo. */
  chanceMando: number | null;
  /** Faixa de dificuldade do adversário pela tabela. */
  nivelAdversario: NivelAdversario | null;
  /** Ajuste (em pontos) aplicado pela faixa de dificuldade do adversário. */
  ajusteNivel: number;
  /** Chance estimada de entrar em campo (histórico recente + status). */
  chanceJogar: number;
  /** Modelo de gols: gols esperados a favor e contra, e chance de não sofrer gol. */
  golsPro: number | null;
  golsContra: number | null;
  chanceSG: number | null;
  /** Ajuste (em pontos) pelo contexto de gols do jogo. */
  ajusteGols: number;
  /** Bônus das dicas da rodada somado ao score (não muda a projeção exibida). */
  bonusDicas?: number;
  motivosDicas?: string[];
  elegivel: boolean;
  motivoInelegivel?: string;
}
