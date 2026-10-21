import { describe, expect, it } from "vitest";
import {
  calcularEstatisticas,
  compactarRodada,
  median,
  nivelAdversario,
  resumirHistorico,
  stdDev,
} from "./stats";
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
      nivelAdversario: null,
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
    ajusteMando: 0,
    chanceMando: null,
    nivelAdversario: null,
    ajusteNivel: 0,
    chanceJogar: 1,
    golsPro: null,
    golsContra: null,
    chanceSG: null,
    ajusteGols: 0,
    recentes: { jogouUltima: true, ultimas5: 5, partidas: 5 },
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
    // 3ª opção: mesma posição, fora do time e diferente de todas as 2ªs opções
    const alts2 = Object.values(e.alternativas2).filter(Boolean).map((a) => a!.id);
    expect(new Set(alts2).size).toBe(alts2.length);
    for (const a of alts2) {
      expect(ids.has(a)).toBe(false);
      expect(alts.includes(a)).toBe(false);
    }
    for (const t of e.titulares) expect(e.alternativas2[t.id]?.posicaoId).toBe(t.posicaoId);
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

describe("mais escalados", () => {
  it("normaliza destaques com o atleta aninhado ou na raiz", async () => {
    const { normalizarDestaques } = await import("./dados");
    expect(
      normalizarDestaques([
        { Atleta: { atleta_id: 1, apelido: "A" }, escalacoes: 100 },
        { atleta_id: 2, escalacoes: 300 },
        { Atleta: { atleta_id: 1 }, escalacoes: 50 },
        { escalacoes: 10 },
        null,
      ]),
    ).toEqual([
      { atleta_id: 2, escalacoes: 300 },
      { atleta_id: 1, escalacoes: 100 },
    ]);
    expect(normalizarDestaques({ erro: true })).toEqual([]);
  });
});

describe("atribuição dos mais escalados", () => {
  it("mantém o titular que já é mais escalado e distribui os demais pela posição", async () => {
    const { atribuirMaisEscalados } = await import("./optimizer");
    const t1 = fakeAtleta(1, 5, 9, 10);
    const t2 = fakeAtleta(2, 5, 8, 10);
    const t3 = fakeAtleta(3, 1, 5, 5);
    const p1 = fakeAtleta(10, 5, 4, 12);
    const p2 = fakeAtleta(11, 4, 4, 12);
    const r = atribuirMaisEscalados([t1, t2, t3], [t1, t2, t3, p1, p2], [10, 2, 11, 999]);
    expect(r[2]?.id).toBe(2); // titular já é mais escalado
    expect(r[1]?.id).toBe(10);
    expect(r[3]).toBeNull(); // nenhum goleiro entre os mais escalados
  });
});

describe("indicadores de mando e nível do adversário", () => {
  it("classifica o adversário em 4 faixas pela tabela", () => {
    expect(nivelAdversario(1)).toBe("muito-dificil");
    expect(nivelAdversario(5)).toBe("muito-dificil");
    expect(nivelAdversario(6)).toBe("dificil");
    expect(nivelAdversario(10)).toBe("dificil");
    expect(nivelAdversario(11)).toBe("facil");
    expect(nivelAdversario(15)).toBe("facil");
    expect(nivelAdversario(16)).toBe("muito-facil");
    expect(nivelAdversario(20)).toBe("muito-facil");
    expect(nivelAdversario(null)).toBeNull();
    expect(nivelAdversario(0)).toBeNull();
  });

  // Atleta 10 (clube 1) e 20 (clube 3), ambos atacantes, 8 rodadas alternando o mando.
  // Em casa fazem 8 pontos, fora 2. Os adversários alternam entre o 2º e o 18º da tabela.
  function cenario(proximo: { mando: "C" | "F"; posAdv: number }) {
    const rodadas = [1, 2, 3, 4, 5, 6, 7, 8].map((r) => {
      const casa = r % 2 === 1;
      const posAdv = r % 4 < 2 ? 2 : 18;
      const pts = casa ? 8 : 2;
      return compactarRodada(
        r,
        {
          atletas: {
            "10": { pontuacao: pts, posicao_id: 5, clube_id: 1, scout: {} },
            "20": { pontuacao: pts, posicao_id: 5, clube_id: 3, scout: {} },
          },
        },
        {
          partidas: [
            casa
              ? { clube_casa_id: 1, clube_visitante_id: 2, clube_visitante_posicao: posAdv }
              : { clube_casa_id: 2, clube_visitante_id: 1, clube_casa_posicao: posAdv },
            casa
              ? { clube_casa_id: 3, clube_visitante_id: 4, clube_visitante_posicao: posAdv }
              : { clube_casa_id: 4, clube_visitante_id: 3, clube_casa_posicao: posAdv },
          ],
        },
      );
    });
    const resumo = resumirHistorico(rodadas);
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
          jogos_num: 8,
        },
      ],
    };
    const partidas: ApiPartidas = {
      partidas: [
        proximo.mando === "C"
          ? {
              clube_casa_id: 1,
              clube_visitante_id: 9,
              clube_visitante_posicao: proximo.posAdv,
              valida: true,
            }
          : {
              clube_casa_id: 9,
              clube_visitante_id: 1,
              clube_casa_posicao: proximo.posAdv,
              valida: true,
            },
      ],
    };
    return projetarAtletas(montarAtletas(mercado, resumo, partidas), resumo, MODELO_PADRAO)[0];
  }

  it("dá vantagem a quem rende mais em casa quando joga em casa", () => {
    const casa = cenario({ mando: "C", posAdv: 12 });
    const fora = cenario({ mando: "F", posAdv: 12 });
    expect(casa.ajusteMando).toBeGreaterThan(1);
    expect(fora.ajusteMando).toBeLessThan(-1);
    expect(casa.chanceMando!).toBeGreaterThan(0.5);
    expect(fora.chanceMando!).toBeLessThan(0.5);
    expect(casa.projecao).toBeGreaterThan(fora.projecao);
  });

  it("projeta menos contra adversário do topo da tabela", () => {
    const dificil = cenario({ mando: "C", posAdv: 2 });
    const facil = cenario({ mando: "C", posAdv: 19 });
    expect(dificil.nivelAdversario).toBe("muito-dificil");
    expect(facil.nivelAdversario).toBe("muito-facil");
    expect(dificil.ajusteNivel).toBeLessThan(0);
    expect(facil.ajusteNivel).toBeGreaterThan(0);
    expect(facil.projecao).toBeGreaterThan(dificil.projecao);
  });
});

describe("modelo de gols", () => {
  it("dá mais gols ao ataque forte e mais chance de SG contra ataque fraco", async () => {
    const { modeloGols } = await import("./gols");
    // Rodízio entre 4 clubes. O clube 1 marca 3 por jogo, o clube 2 não marca, 3 e 4 marcam 1.
    const golsDe: Record<number, number> = { 1: 3, 2: 0, 3: 1, 4: 1 };
    const pares = [
      [1, 2, 3, 4],
      [1, 3, 2, 4],
      [1, 4, 2, 3],
    ];
    const rodadas = Array.from({ length: 6 }, (_, i) => {
      const [a, b, c, d] = pares[i % 3];
      const inv = i >= 3;
      const atletas = Object.fromEntries(
        [1, 2, 3, 4].map((cl) => [
          String(cl * 10 + 1),
          { pontuacao: 3, posicao_id: 5, clube_id: cl, scout: { G: golsDe[cl] } },
        ]),
      );
      return compactarRodada(
        i + 1,
        { atletas },
        {
          partidas: [
            { clube_casa_id: inv ? b : a, clube_visitante_id: inv ? a : b },
            { clube_casa_id: inv ? d : c, clube_visitante_id: inv ? c : d },
          ],
        },
      );
    });
    const m = modeloGols(rodadas);
    expect(m.preverJogo(1, 3, "C")!.golsPro).toBeGreaterThan(m.preverJogo(2, 3, "C")!.golsPro);
    // quem enfrenta o clube 2 (que não marca) tem mais chance de SG do que quem enfrenta o 1
    expect(m.preverJogo(3, 2, "C")!.chanceSG).toBeGreaterThan(m.preverJogo(3, 1, "C")!.chanceSG);
  });
});

describe("dicas da rodada", () => {
  it("conta a sequência sem sofrer gol e os gols dos últimos 5 jogos", async () => {
    const { modeloGols } = await import("./gols");
    const { resumoDefesas } = await import("./dicas");
    // Clube 1 x 2 em 6 rodadas; o clube 2 marca nas rodadas 1 e 2 e depois zera.
    const rodadas = [1, 2, 3, 4, 5, 6].map((r) =>
      compactarRodada(
        r,
        {
          atletas: {
            "11": { pontuacao: 5, posicao_id: 5, clube_id: 1, scout: { G: 1 } },
            "21": { pontuacao: 2, posicao_id: 5, clube_id: 2, scout: { G: r <= 2 ? 1 : 0 } },
          },
        },
        { partidas: [{ clube_casa_id: 1, clube_visitante_id: 2 }] },
      ),
    );
    const defesas = resumoDefesas(rodadas, modeloGols(rodadas), {
      partidas: [{ clube_casa_id: 2, clube_visitante_id: 1 }],
    });
    const c1 = defesas.find((d) => d.clube === 1)!;
    const c2 = defesas.find((d) => d.clube === 2)!;
    expect(c1.sequenciaSemSofrer).toBe(4);
    expect(c1.semSofrerUltimos5).toBe(4);
    expect(c1.sofridosUltimos5).toBe(1);
    expect(c1.adversario).toBe(2);
    expect(c1.emCasa).toBe(false);
    expect(c2.sequenciaSofrendo).toBe(6);
    expect(c2.marcadosUltimos5).toBe(1);
  });
});

describe("bônus das dicas", () => {
  it("soma os motivos, respeita o teto de 1 ponto e só mexe no score", async () => {
    const { calcularBonusDicas, aplicarBonusDicas } = await import("./dicas");
    const ata = { ...fakeAtleta(1, 5, 8, 10), clubeId: 7 };
    const zag = { ...fakeAtleta(2, 3, 4, 6), clubeId: 7 };
    const outro = { ...fakeAtleta(3, 5, 3, 5), clubeId: 9 };
    const dicas = {
      jogosFaceis: [
        {
          casa: 7,
          fora: 8,
          golsCasa: 2,
          golsFora: 0.5,
          favorito: 7,
          vantagem: 1.5,
          chanceSGFavorito: 0.6,
        },
      ],
      defesasSolidas: [{ clube: 7 } as never],
      defesasVazadas: [{ clube: 8, adversario: 7 } as never],
      ataquesEmAlta: [{ clube: 7 } as never],
      destaques: [{ atleta: ata, valor: 8 }],
      custoBeneficio: [],
      emAlta: [{ atleta: ata, valor: 3 }],
      goleiros: [],
      destaquesEmDuvida: [],
      jogosQueNaoValem: [],
    };
    const bonus = calcularBonusDicas(dicas, [ata, zag, outro]);
    expect(bonus.get(1)!.pontos).toBe(1); // vários motivos, limitado a 1
    expect(bonus.get(2)!.pontos).toBeCloseTo(0.6); // favorito + defesa sólida
    expect(bonus.has(3)).toBe(false);
    const [a] = aplicarBonusDicas([ata], bonus);
    expect(a.score).toBe(ata.score + 1);
    expect(a.projecao).toBe(ata.projecao);
    expect(calcularBonusDicas(dicas, [ata], 0.5).get(1)!.pontos).toBe(0.5);
  });
});
