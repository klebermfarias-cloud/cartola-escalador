// Coleta os dados da API pública do Cartola FC e grava data/cartola.json,
// o arquivo que a página lê. Rodadas encerradas ficam em cache em data/rodadas/.
//
// Uso: npm run coletar
import fs from "node:fs";
import path from "node:path";
import { compactarRodada } from "../src/lib/cartola/stats";
import type {
  ApiAtletaMercado,
  ApiClube,
  ApiMercado,
  ApiMercadoStatus,
  ApiPartidas,
  ApiPontuados,
  RodadaHistorica,
} from "../src/lib/cartola/types";
import {
  normalizarDestaques,
  type DadosCartola,
  type MaisEscalado,
} from "../src/lib/cartola/dados";

const API = "https://api.cartola.globo.com";
const RAIZ = path.resolve(import.meta.dirname, "..");
const DIR_DADOS = path.join(RAIZ, "data");
const DIR_RODADAS = path.join(DIR_DADOS, "rodadas");
const ARQ_ESCUDOS = path.join(DIR_DADOS, "escudos.json");
const ARQ_SAIDA = path.join(DIR_DADOS, "cartola.json");

const HEADERS = {
  accept: "application/json",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
};

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function obter(
  url: string,
  tentativas = 4,
  extras: Record<string, string> = {},
): Promise<Response> {
  let ultimoErro: unknown;
  for (let i = 0; i < tentativas; i++) {
    try {
      const res = await fetch(url, { headers: { ...HEADERS, ...extras } });
      if (res.ok) return res;
      ultimoErro = new Error(`HTTP ${res.status} em ${url}`);
      if ([401, 403, 404].includes(res.status)) break;
    } catch (e) {
      ultimoErro = e;
    }
    await espera(1000 * 2 ** i);
  }
  throw ultimoErro;
}

async function json<T>(endpoint: string): Promise<T> {
  return (await (await obter(`${API}/${endpoint}`)).json()) as T;
}

function lerJson<T>(arquivo: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(arquivo, "utf8")) as T;
  } catch {
    return null;
  }
}

function gravarJson(arquivo: string, valor: unknown) {
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  fs.writeFileSync(arquivo, JSON.stringify(valor));
}

/** Escudos viram data URIs: a página publicada não pode carregar imagens de outros domínios. */
async function escudosEmbutidos(clubes: Record<string, ApiClube>): Promise<Record<string, string>> {
  const cache = lerJson<Record<string, string>>(ARQ_ESCUDOS) ?? {};
  for (const [id, c] of Object.entries(clubes)) {
    if (cache[id]) continue;
    const url = c.escudos?.["60x60"] ?? c.escudos?.["45x45"] ?? c.escudos?.["30x30"];
    if (!url) continue;
    try {
      const res = await obter(url, 2);
      const tipo = res.headers.get("content-type") ?? "image/png";
      const b64 = Buffer.from(await res.arrayBuffer()).toString("base64");
      cache[id] = `data:${tipo};base64,${b64}`;
    } catch (e) {
      console.warn(`Escudo do clube ${id} indisponível:`, (e as Error).message);
    }
  }
  gravarJson(ARQ_ESCUDOS, cache);
  return cache;
}

function enxugarAtleta(a: ApiAtletaMercado): ApiAtletaMercado {
  return {
    atleta_id: a.atleta_id,
    apelido: a.apelido,
    foto: null,
    clube_id: a.clube_id,
    posicao_id: a.posicao_id,
    status_id: a.status_id,
    pontos_num: a.pontos_num,
    media_num: a.media_num,
    preco_num: a.preco_num,
    variacao_num: a.variacao_num,
    jogos_num: a.jogos_num,
    minimo_para_valorizar: a.minimo_para_valorizar ?? null,
    scout: a.scout ?? {},
  };
}

async function main() {
  const status = await json<ApiMercadoStatus>("mercado/status");
  const temporada = status.temporada ?? new Date().getFullYear();
  const rodadaAtual = status.rodada_atual;
  console.log(
    `Temporada ${temporada}, rodada ${rodadaAtual}, status do mercado ${status.status_mercado}`,
  );

  const mercado = await json<ApiMercado>("atletas/mercado");
  const partidas = await json<ApiPartidas>(`partidas/${rodadaAtual}`);

  // Mais escalados da rodada: o endpoint exige login na conta Globo (token Bearer).
  // Sem CARTOLA_TOKEN a coleta segue sem eles e a página esconde essa opção.
  let maisEscalados: MaisEscalado[] = [];
  const token = process.env.CARTOLA_TOKEN?.trim();
  if (!token) {
    console.log("Mais escalados: CARTOLA_TOKEN não definido, pulando.");
  } else {
    try {
      const res = await obter(`${API}/auth/mercado/destaques`, 1, {
        authorization: `Bearer ${token}`,
      });
      maisEscalados = normalizarDestaques(await res.json());
      console.log(`Mais escalados: ${maisEscalados.length} atletas.`);
    } catch (e) {
      console.warn("Mais escalados indisponíveis:", (e as Error).message);
    }
  }
  console.log(
    `${mercado.atletas.length} atletas no mercado, ${partidas.partidas.length} partidas na rodada`,
  );

  // Rodadas encerradas: 1 .. rodada_atual - 1
  const rodadas: RodadaHistorica[] = [];
  const falhas: number[] = [];
  for (let r = 1; r < rodadaAtual; r++) {
    const arquivo = path.join(DIR_RODADAS, `${temporada}-${String(r).padStart(2, "0")}.json`);
    const cache = lerJson<RodadaHistorica>(arquivo);
    // Caches antigos não têm a posição do adversário na tabela: baixa de novo.
    const cacheCompleto = Object.values(cache?.confrontos ?? {}).every((c) => "posAdv" in c);
    if (cache && Object.keys(cache.pontos).length > 0 && cacheCompleto) {
      rodadas.push(cache);
      continue;
    }
    try {
      const [pontuados, partidasR] = await Promise.all([
        json<ApiPontuados>(`atletas/pontuados/${r}`),
        json<ApiPartidas>(`partidas/${r}`),
      ]);
      const compacta = compactarRodada(r, pontuados, partidasR);
      if (Object.keys(compacta.pontos).length > 0) gravarJson(arquivo, compacta);
      rodadas.push(compacta);
      console.log(`Rodada ${r}: ${Object.keys(compacta.pontos).length} atletas pontuados`);
    } catch (e) {
      falhas.push(r);
      console.warn(`Rodada ${r} indisponível:`, (e as Error).message);
    }
    await espera(250);
  }

  const clubes: Record<string, ApiClube> = { ...(partidas.clubes ?? {}), ...mercado.clubes };
  const escudos = await escudosEmbutidos(clubes);
  const clubesEnxutos: DadosCartola["clubes"] = {};
  for (const [id, c] of Object.entries(clubes)) {
    clubesEnxutos[id] = {
      id: c.id,
      nome: c.nome,
      abreviacao: c.abreviacao,
      nome_fantasia: c.nome_fantasia,
      escudo: escudos[id] ?? null,
    };
  }

  const saida: DadosCartola = {
    atualizadoEm: new Date().toISOString(),
    temporada,
    status,
    atletas: mercado.atletas.map(enxugarAtleta),
    clubes: clubesEnxutos,
    partidas: { rodada: rodadaAtual, partidas: partidas.partidas },
    rodadas,
    rodadasIndisponiveis: falhas,
    maisEscalados,
  };
  // Só regrava (e gera commit) quando algo além do horário mudou.
  const anterior = lerJson<DadosCartola>(ARQ_SAIDA);
  if (
    anterior &&
    JSON.stringify({ ...anterior, atualizadoEm: "" }) ===
      JSON.stringify({ ...saida, atualizadoEm: "" })
  ) {
    console.log("Nenhuma mudança nos dados.");
    return;
  }
  gravarJson(ARQ_SAIDA, saida);
  const kb = Math.round(fs.statSync(ARQ_SAIDA).size / 1024);
  console.log(`Gravado ${path.relative(RAIZ, ARQ_SAIDA)} (${kb} KB, ${rodadas.length} rodadas)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
