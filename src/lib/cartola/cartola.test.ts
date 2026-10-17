import { describe, expect, it } from "vitest";
import { calcularEstatisticas, compactarRodada, median, resumirHistorico, stdDev } from "./stats";
import { MODELO_PADRAO, montarAtletas, projetarAtletas } from "./projection";
import { escalar, escolherBanco, FORMACOES, ganhoEsperado } from "./optimizer";
import type { ApiMercado, ApiPartidas, AtletaProjetado, Jogo, PosicaoId } from "./types";

describe("estatísticas básicas", () => {
  it("calcula mediana e desvio padrão amostral", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);
  });

  it("separa casa/fora, últimas 5 e média básica", () => {
    const jogos: Jogo[] = [1, 2, 3, 4, 5, 6, 7].map((r) => ({
      rodada: r,
      pontos: r,
      basica: r - 1,
      mando: r % 2 ? "C" : "F",
      adversario: 99,
    }));
    const s = calcularEstatisticas(jogos, 10);
    expect(s.jogos).toBe(7);
    expect(s.media).toBe(4);
    expect(s.mediaCasa).toBe(4); // 1,3,5,7
    expect(s.mediaFora).toBe(4); // 2,4,6
    expect(s.mediaUltimas).toBe(5); // 3..7
    expect(s.mediaBasica).toBe(3);
    expect(s.participacao).toBeCloseTo(0.7);
    expect(s.tendencia).toBe(1);
  });

  it("compacta rodada descontando gols e assistências na básica", () => {
    const r = compactarRodada(
      1,
      {
        atletas: {
          "10": {
            pontuacao: 15,
            scout: { G: 1, A: 1, DS: 2 },
            posicao_id: 5,
            clube_id: 1,
            entrou_em_campo: true,
          },
          "11": { pontuacao: 0, scout: {}, posicao_id: 5, clube_id: 1, entrou_em_campo: false },
        },
      },
      { partidas: [{ clube_casa_id: 1, clube_visitante_id: 2, valida: true }] },
    );
    expect(Object.keys(r.pontos)).toEqual(["10"]);
    const resumo = resumirHistorico([r]);
    const j = resumo.jogosPorAtleta.get(10)![0];
    expect(j.basica).toBe(2);
    expect(j.mando).toBe("C");
    expect(j.adversario).toBe(2);
    expect(resumo.cedidas.get("2:5")).toEqual({ soma: 15, n: 1 });
  });
});

function fakeAtleta(id: number, pos: PosicaoId, score: number, preco: number): AtletaProjetado {
  return {
    id,
    apelido: `A${id}`,
    foto: null,
    clubeId: 1,
    posicaoId: pos,
    statusId: 7,
    preco,
    variacao: 0,
    minimoValorizar: null,
    mediaOficial: score,
    jogosOficial: 5,
    scoutTotal: {},
    stats: calcularEstatisticas([], 0),
    proximo: { adversario: 2, mando: "C", valida: true },
    projecao: score,
    score,
    cedidasAdversario: null,
    ajusteAdversario: 0,
    elegivel: true,
  };
}

describe("otimizador", () => {
  const atletas: AtletaProjetado[] = [];
  let id = 1;
  for (const pos of [1, 2, 3, 4, 5, 6] as PosicaoId[]) {
    for (let i = 0; i < 12; i++) {
      // jogadores melhores são mais caros
      atletas.push(fakeAtleta(id++, pos, 2 + i, 3 + i * 1.5));
    }
  }

  it("respeita formação e orçamento", () => {
    for (const orc of [60, 100, 140, 1000]) {
      const e = escalar(atletas, "4-3-3", orc)!;
      expect(e).not.toBeNull();
      expect(e.titulares).toHaveLength(12);
      expect(e.custo).toBeLessThanOrEqual(orc + 1e-6);
      const f = FORMACOES.find((x) => x.nome === "4-3-3")!;
      const count = (p: number) => e.titulares.filter((a) => a.posicaoId === p).length;
      expect(count(1)).toBe(f.posicoes.gol);
      expect(count(2)).toBe(f.posicoes.lat);
      expect(count(3)).toBe(f.posicoes.zag);
      expect(count(4)).toBe(f.posicoes.mei);
      expect(count(5)).toBe(f.posicoes.ata);
      expect(count(6)).toBe(f.posicoes.tec);
    }
  });

  it("com orçamento ilimitado escolhe os melhores e sugere alternativas distintas", () => {
    const e = escalar(atletas, "auto", 10_000)!;
    const ids = new Set(e.titulares.map((a) => a.id));
    const alts = Object.values(e.alternativas)
      .filter(Boolean)
      .map((a) => a!.id);
    expect(new Set(alts).size).toBe(alts.length);
    for (const a of alts) expect(ids.has(a)).toBe(false);
    for (const t of e.titulares) expect(e.alternativas[t.id]?.posicaoId).toBe(t.posicaoId);
    expect(e.capitaoId).not.toBeNull();
  });

  it("retorna null quando nem o time mais barato cabe", () => {
    expect(escalar(atletas, "4-4-2", 10)).toBeNull();
  });
});

describe("projeção", () => {
  it("monta atletas e marca inelegíveis", () => {
    const mercado: ApiMercado = {
      clubes: {},
      atletas: [
        {
          atleta_id: 10,
          apelido: "X",
          clube_id: 1,
          posicao_id: 5,
          status_id: 7,
          pontos_num: 0,
          media_num: 5,
          preco_num: 10,
          variacao_num: 0,
          jogos_num: 3,
        },
        {
          atleta_id: 11,
          apelido: "Y",
          clube_id: 1,
          posicao_id: 5,
          status_id: 5,
          pontos_num: 0,
          media_num: 5,
          preco_num: 10,
          variacao_num: 0,
          jogos_num: 3,
        },
      ],
    };
    const partidas: ApiPartidas = {
      partidas: [{ clube_casa_id: 1, clube_visitante_id: 2, valida: true }],
    };
    const rodadas = [1, 2, 3].map((r) =>
      compactarRodada(
        r,
        { atletas: { "10": { pontuacao: 4 + r, posicao_id: 5, clube_id: 1, scout: {} } } },
        partidas,
      ),
    );
    const resumo = resumirHistorico(rodadas);
    const proj = projetarAtletas(montarAtletas(mercado, resumo, partidas), resumo, MODELO_PADRAO);
    expect(proj[0].elegivel).toBe(true);
    expect(proj[0].stats.mediaCasa).toBe(6);
    expect(proj[0].projecao).toBeGreaterThan(5);
    expect(proj[1].elegivel).toBe(false);
  });
});

describe("banco de reservas", () => {
  const atletas: AtletaProjetado[] = [];
  let id = 1;
  for (const pos of [1, 2, 3, 4, 5, 6] as PosicaoId[]) {
    for (let i = 0; i < 12; i++) atletas.push(fakeAtleta(id++, pos, 2 + i, 3 + i * 1.5));
    // opção barata que sempre cabe no banco
    atletas.push(fakeAtleta(id++, pos, 0.5, 1));
  }

  it("escolhe um reserva por posição, sem técnico, custando até o titular mais barato", () => {
    const e = escalar(atletas, "4-3-3", 120)!;
    const banco = escolherBanco(atletas, e.titulares);
    const titularIds = new Set(e.titulares.map((a) => a.id));
    expect(banco.reservas.map((r) => r.posicaoId).sort()).toEqual([1, 2, 3, 4, 5]);
    for (const r of banco.reservas) {
      expect(titularIds.has(r.id)).toBe(false);
      const maisBarato = Math.min(
        ...e.titulares.filter((t) => t.posicaoId === r.posicaoId).map((t) => t.preco),
      );
      expect(r.preco).toBeLessThanOrEqual(maisBarato);
    }
    expect(banco.reservas.some((r) => r.id === banco.luxoId)).toBe(true);
  });

  it("não tem reserva de lateral em formação sem laterais e respeita exclusões", () => {
    const e = escalar(atletas, "3-4-3", 120)!;
    const excluir = new Set([atletas[0].id]);
    const banco = escolherBanco(atletas, e.titulares, excluir);
    expect(banco.reservas.some((r) => r.posicaoId === 2)).toBe(false);
    expect(banco.reservas.some((r) => excluir.has(r.id))).toBe(false);
  });

  it("calcula o ganho esperado de uma normal truncada", () => {
    expect(ganhoEsperado(0, 1)).toBeCloseTo(0.3989, 3);
    expect(ganhoEsperado(5, 0)).toBe(5);
    expect(ganhoEsperado(-5, 0)).toBe(0);
  });
});
