import { calcularEstatisticas, estatisticasVazias, shrink, type ResumoHistorico } from "./stats";
import {
  STATUS,
  type ApiMercado,
  type ApiPartidas,
  type Atleta,
  type AtletaProjetado,
  type PosicaoId,
  type ProximoJogo,
} from "./types";

export type PerfilRisco = "conservador" | "equilibrado" | "arrojado";

export interface ModeloConfig {
  /** Pesos relativos dos componentes (normalizados internamente). */
  pesoMedia: number;
  pesoMando: number;
  pesoForma: number;
  pesoMediana: number;
  pesoBasica: number;
  /** Intensidade do ajuste pelo adversário (0 = ignora, 1 = total). */
  pesoAdversario: number;
  perfil: PerfilRisco;
  /** Nº mínimo de jogos para o atleta ser escalável. */
  minJogos: number;
  incluirDuvida: boolean;
  /** Força da regularização para amostras pequenas (em "jogos fictícios"). */
  k: number;
}

export const MODELO_PADRAO: ModeloConfig = {
  pesoMedia: 30,
  pesoMando: 25,
  pesoForma: 25,
  pesoMediana: 10,
  pesoBasica: 10,
  pesoAdversario: 50,
  perfil: "equilibrado",
  minJogos: 3,
  incluirDuvida: false,
  k: 3,
};

/** Quanto o desvio padrão pesa no score de cada perfil. */
export const LAMBDA_RISCO: Record<PerfilRisco, number> = {
  conservador: 0.3,
  equilibrado: 0,
  arrojado: -0.25,
};

/** Fator aplicado à projeção de atletas em dúvida. */
export const FATOR_DUVIDA = 0.75;

/** Reduz a projeção de quem joga menos da metade das partidas do clube (até -25%). */
export function fatorParticipacao(participacao: number): number {
  return 0.75 + 0.25 * Math.min(1, participacao / 0.5);
}

export function fotoUrl(foto: string | null | undefined, tamanho = "140x140"): string | null {
  if (!foto) return null;
  return foto.replace("FORMATO", tamanho);
}

export function proximosJogos(partidas: ApiPartidas | null | undefined): Map<number, ProximoJogo> {
  const out = new Map<number, ProximoJogo>();
  for (const p of partidas?.partidas ?? []) {
    const valida = p.valida !== false;
    out.set(p.clube_casa_id, {
      adversario: p.clube_visitante_id,
      mando: "C",
      valida,
      data: p.partida_data,
      posicaoTabela: p.clube_casa_posicao,
      posicaoTabelaAdversario: p.clube_visitante_posicao,
    });
    out.set(p.clube_visitante_id, {
      adversario: p.clube_casa_id,
      mando: "F",
      valida,
      data: p.partida_data,
      posicaoTabela: p.clube_visitante_posicao,
      posicaoTabelaAdversario: p.clube_casa_posicao,
    });
  }
  return out;
}

/** Junta mercado + histórico + confrontos da rodada em uma lista de atletas com estatísticas. */
export function montarAtletas(
  mercado: ApiMercado,
  resumo: ResumoHistorico,
  partidasRodada: ApiPartidas | null | undefined,
): Atleta[] {
  const proximos = proximosJogos(partidasRodada);
  return (mercado.atletas ?? []).map((a) => {
    const jogos = resumo.jogosPorAtleta.get(a.atleta_id) ?? [];
    let stats = calcularEstatisticas(jogos, resumo.rodadasPorClube.get(a.clube_id) ?? 0);
    // Sem histórico por rodada disponível: usa a média oficial do mercado.
    if (stats.jogos === 0 && a.jogos_num > 0) {
      stats = {
        ...estatisticasVazias(),
        jogos: a.jogos_num,
        media: a.media_num,
        mediana: a.media_num,
        mediaBasica: a.media_num,
      };
    }
    return {
      id: a.atleta_id,
      apelido: a.apelido,
      foto: fotoUrl(a.foto),
      clubeId: a.clube_id,
      posicaoId: a.posicao_id,
      statusId: a.status_id,
      preco: a.preco_num,
      variacao: a.variacao_num,
      minimoValorizar: a.minimo_para_valorizar ?? null,
      mediaOficial: a.media_num,
      jogosOficial: a.jogos_num,
      scoutTotal: a.scout ?? {},
      stats,
      proximo: proximos.get(a.clube_id) ?? null,
    };
  });
}

function cedidasAjustadas(
  resumo: ResumoHistorico,
  adversario: number,
  pos: number,
  mandoAdversario: "C" | "F",
  mediaPos: number,
  k: number,
): number | null {
  const geral = resumo.cedidas.get(`${adversario}:${pos}`);
  if (!geral) return null;
  const mediaGeral = shrink(geral.soma / geral.n, geral.n, mediaPos, k * 4);
  const porMando = resumo.cedidasMando.get(`${adversario}:${pos}:${mandoAdversario}`);
  if (!porMando) return mediaGeral;
  return shrink(porMando.soma / porMando.n, porMando.n, mediaGeral, k * 4);
}

export function projetarAtletas(
  atletas: Atleta[],
  resumo: ResumoHistorico,
  cfg: ModeloConfig,
): AtletaProjetado[] {
  const pesos = {
    media: Math.max(0, cfg.pesoMedia),
    mando: Math.max(0, cfg.pesoMando),
    forma: Math.max(0, cfg.pesoForma),
    mediana: Math.max(0, cfg.pesoMediana),
    basica: Math.max(0, cfg.pesoBasica),
  };
  const somaPesos = pesos.media + pesos.mando + pesos.forma + pesos.mediana + pesos.basica || 1;
  const alpha = Math.max(0, Math.min(1, cfg.pesoAdversario / 100));
  const lambda = LAMBDA_RISCO[cfg.perfil];

  // Média por posição — do histórico ou, sem histórico, da média oficial do mercado.
  const mediaPos = new Map<number, number>(resumo.mediaPorPosicao);
  for (const pos of [1, 2, 3, 4, 5, 6] as PosicaoId[]) {
    if (mediaPos.has(pos)) continue;
    const xs = atletas
      .filter((a) => a.posicaoId === pos && a.jogosOficial > 0)
      .map((a) => a.mediaOficial);
    mediaPos.set(pos, xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
  }

  return atletas.map((a) => {
    const s = a.stats;
    const prior = mediaPos.get(a.posicaoId) ?? 0;
    const k = cfg.k;

    const mGeral = shrink(s.media, s.jogos, prior, k);
    const mediaMando =
      a.proximo?.mando === "C" ? s.mediaCasa : a.proximo?.mando === "F" ? s.mediaFora : null;
    const nMando =
      a.proximo?.mando === "C" ? s.jogosCasa : a.proximo?.mando === "F" ? s.jogosFora : 0;
    const mMando = shrink(mediaMando, nMando, mGeral, k);
    const mForma = shrink(s.mediaUltimas, s.jogosUltimas, mGeral, k);
    const mMediana = shrink(s.mediana, s.jogos, prior, k);
    // A básica é o "piso" do atleta; somamos a contribuição média de G/A da posição
    // atenuada, para que ela fique na mesma escala dos demais componentes.
    const contribGA = Math.max(0, s.media - s.mediaBasica);
    const mBasica = shrink(s.mediaBasica + contribGA * 0.5, s.jogos, prior, k);

    const base =
      (pesos.media * mGeral +
        pesos.mando * mMando +
        pesos.forma * mForma +
        pesos.mediana * mMediana +
        pesos.basica * mBasica) /
      somaPesos;

    let cedidas: number | null = null;
    let ajuste = 0;
    if (a.proximo) {
      const mandoAdv = a.proximo.mando === "C" ? "F" : "C";
      cedidas = cedidasAjustadas(resumo, a.proximo.adversario, a.posicaoId, mandoAdv, prior, k);
      if (cedidas != null) ajuste = alpha * (cedidas - prior);
    }

    let projecao = base + ajuste;
    if (a.statusId === STATUS.DUVIDA) projecao *= FATOR_DUVIDA;
    // Quem entra em poucas partidas do clube tende a ser reserva: risco de não jogar.
    if (s.jogos > 0 && s.historico.length > 0) projecao *= fatorParticipacao(s.participacao);

    const score = projecao - lambda * s.desvio;

    let motivo: string | undefined;
    if (a.statusId !== STATUS.PROVAVEL && !(cfg.incluirDuvida && a.statusId === STATUS.DUVIDA)) {
      motivo = a.statusId === STATUS.DUVIDA ? "Dúvida" : "Não provável";
    } else if (!a.proximo) motivo = "Sem jogo na rodada";
    else if (!a.proximo.valida) motivo = "Partida não válida";
    else if (s.jogos < cfg.minJogos) motivo = `Menos de ${cfg.minJogos} jogos`;

    return {
      ...a,
      projecao,
      score,
      cedidasAdversario: cedidas,
      ajusteAdversario: ajuste,
      elegivel: !motivo,
      motivoInelegivel: motivo,
    };
  });
}
