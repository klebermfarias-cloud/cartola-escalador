// Dicas da rodada: leituras rápidas do modelo e do histórico para orientar a escalação.
import type { ModeloGols } from "./gols";
import type { ApiPartidas, AtletaProjetado, RodadaHistorica } from "./types";
import { STATUS } from "./types";

export interface DicaJogo {
  casa: number;
  fora: number;
  golsCasa: number;
  golsFora: number;
  favorito: number;
  /** Diferença de gols esperados a favor do favorito. */
  vantagem: number;
  /** Chance de o favorito não sofrer gol. */
  chanceSGFavorito: number;
}

export interface DicaDefesa {
  clube: number;
  /** Jogos seguidos sem sofrer gol, até a última rodada. */
  sequenciaSemSofrer: number;
  /** Jogos seguidos sofrendo gol, até a última rodada. */
  sequenciaSofrendo: number;
  /** Nos últimos 5 jogos: quantos sem sofrer gol, gols sofridos e gols marcados. */
  semSofrerUltimos5: number;
  sofridosUltimos5: number;
  marcadosUltimos5: number;
  jogos: number;
  /** Próximo adversário e mando, se o clube joga na rodada. */
  adversario: number | null;
  emCasa: boolean | null;
}

export interface DicaAtleta {
  atleta: AtletaProjetado;
  /** Valor que justifica a dica (ex.: pontos por cartoleta). */
  valor: number;
}

export interface DicasRodada {
  jogosFaceis: DicaJogo[];
  defesasSolidas: DicaDefesa[];
  defesasVazadas: DicaDefesa[];
  ataquesEmAlta: DicaDefesa[];
  destaques: DicaAtleta[];
  custoBeneficio: DicaAtleta[];
  emAlta: DicaAtleta[];
  /** Goleiros de maior projeção, com a chance de SG do time. */
  goleiros: DicaAtleta[];
  destaquesEmDuvida: AtletaProjetado[];
  jogosQueNaoValem: { casa: number; fora: number }[];
}

const POR_LISTA = 5;

/** Sequências e números recentes de gols de cada clube. */
export function resumoDefesas(
  rodadas: RodadaHistorica[],
  modelo: ModeloGols,
  partidas: ApiPartidas | null | undefined,
): DicaDefesa[] {
  const jogosPorClube = new Map<number, { rodada: number; pro: number; contra: number }[]>();
  for (const r of rodadas) {
    for (const [clube, c] of Object.entries(r.confrontos)) {
      if (!c.valida) continue;
      const pro = modelo.gols.get(`${r.rodada}:${clube}`);
      const contra = modelo.gols.get(`${r.rodada}:${c.adversario}`);
      if (pro == null || contra == null) continue;
      const l = jogosPorClube.get(Number(clube)) ?? [];
      l.push({ rodada: r.rodada, pro, contra });
      jogosPorClube.set(Number(clube), l);
    }
  }
  const proximo = new Map<number, { adversario: number; emCasa: boolean }>();
  for (const p of partidas?.partidas ?? []) {
    if (p.valida === false) continue;
    proximo.set(p.clube_casa_id, { adversario: p.clube_visitante_id, emCasa: true });
    proximo.set(p.clube_visitante_id, { adversario: p.clube_casa_id, emCasa: false });
  }

  const out: DicaDefesa[] = [];
  for (const [clube, jogos] of jogosPorClube) {
    jogos.sort((a, b) => b.rodada - a.rodada);
    let semSofrer = 0;
    for (const j of jogos) {
      if (j.contra > 0) break;
      semSofrer++;
    }
    let sofrendo = 0;
    for (const j of jogos) {
      if (j.contra === 0) break;
      sofrendo++;
    }
    const ult = jogos.slice(0, 5);
    out.push({
      clube,
      sequenciaSemSofrer: semSofrer,
      sequenciaSofrendo: sofrendo,
      semSofrerUltimos5: ult.filter((j) => j.contra === 0).length,
      sofridosUltimos5: ult.reduce((s, j) => s + j.contra, 0),
      marcadosUltimos5: ult.reduce((s, j) => s + j.pro, 0),
      jogos: ult.length,
      adversario: proximo.get(clube)?.adversario ?? null,
      emCasa: proximo.get(clube)?.emCasa ?? null,
    });
  }
  return out;
}

export function gerarDicas(
  rodadas: RodadaHistorica[],
  modelo: ModeloGols,
  partidas: ApiPartidas | null | undefined,
  atletas: AtletaProjetado[],
): DicasRodada {
  // Jogos: favoritismo pela diferença de gols esperados.
  const jogos: DicaJogo[] = [];
  const jogosQueNaoValem: { casa: number; fora: number }[] = [];
  for (const p of partidas?.partidas ?? []) {
    if (p.valida === false) {
      jogosQueNaoValem.push({ casa: p.clube_casa_id, fora: p.clube_visitante_id });
      continue;
    }
    const x = modelo.preverJogo(p.clube_casa_id, p.clube_visitante_id, "C");
    if (!x) continue;
    const casaFavorita = x.golsPro >= x.golsContra;
    jogos.push({
      casa: p.clube_casa_id,
      fora: p.clube_visitante_id,
      golsCasa: x.golsPro,
      golsFora: x.golsContra,
      favorito: casaFavorita ? p.clube_casa_id : p.clube_visitante_id,
      vantagem: Math.abs(x.golsPro - x.golsContra),
      chanceSGFavorito: Math.exp(-(casaFavorita ? x.golsContra : x.golsPro)),
    });
  }
  jogos.sort((a, b) => b.vantagem - a.vantagem);

  const defesas = resumoDefesas(rodadas, modelo, partidas).filter((d) => d.adversario != null);
  const defesasSolidas = [...defesas]
    .filter((d) => d.sequenciaSemSofrer >= 2 || d.semSofrerUltimos5 >= 3)
    .sort(
      (a, b) =>
        b.sequenciaSemSofrer - a.sequenciaSemSofrer ||
        b.semSofrerUltimos5 - a.semSofrerUltimos5 ||
        a.sofridosUltimos5 - b.sofridosUltimos5,
    )
    .slice(0, POR_LISTA);
  const defesasVazadas = [...defesas]
    .sort(
      (a, b) =>
        b.sofridosUltimos5 - a.sofridosUltimos5 || b.sequenciaSofrendo - a.sequenciaSofrendo,
    )
    .slice(0, POR_LISTA);
  const ataquesEmAlta = [...defesas]
    .sort((a, b) => b.marcadosUltimos5 - a.marcadosUltimos5)
    .slice(0, POR_LISTA);

  // Jogadores: só os escaláveis pelo modelo.
  const elegiveis = atletas.filter((a) => a.elegivel);
  const top = (xs: DicaAtleta[]) => xs.sort((a, b) => b.valor - a.valor).slice(0, POR_LISTA);
  const destaques = top(elegiveis.map((a) => ({ atleta: a, valor: a.projecao })));
  const custoBeneficio = top(
    elegiveis
      .filter((a) => a.preco > 0 && a.projecao >= 3)
      .map((a) => ({ atleta: a, valor: a.projecao / a.preco })),
  );
  const emAlta = top(
    elegiveis
      .filter((a) => a.stats.jogos >= 8 && a.stats.jogosUltimas >= 5)
      .map((a) => ({ atleta: a, valor: a.stats.tendencia })),
  ).filter((d) => d.valor > 0);
  const goleiros = top(
    elegiveis.filter((a) => a.posicaoId === 1).map((a) => ({ atleta: a, valor: a.projecao })),
  ).slice(0, 3);

  // Bons jogadores em dúvida: vale acompanhar o status até o fechamento.
  const destaquesEmDuvida = atletas
    .filter((a) => a.statusId === STATUS.DUVIDA && a.stats.jogos >= 5)
    .sort((a, b) => b.stats.media - a.stats.media)
    .slice(0, POR_LISTA);

  return {
    jogosFaceis: jogos.slice(0, 3),
    defesasSolidas,
    defesasVazadas,
    ataquesEmAlta,
    destaques,
    custoBeneficio,
    emAlta,
    goleiros,
    destaquesEmDuvida,
    jogosQueNaoValem,
  };
}
