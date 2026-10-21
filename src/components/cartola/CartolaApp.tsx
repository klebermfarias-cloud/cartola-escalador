import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  Clock,
  Lightbulb,
  Loader2,
  Shuffle,
  Star,
  Users,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDados } from "@/hooks/useDados";
import { mercadoDe, type DadosCartola } from "@/lib/cartola/dados";
import {
  atribuirMaisEscalados,
  CAPITAO_MULT,
  escalar,
  escolherBanco,
  escolherCapitao,
  projecaoTime,
} from "@/lib/cartola/optimizer";
import {
  MODELO_PADRAO,
  montarAtletas,
  projetarAtletas,
  type ModeloConfig,
} from "@/lib/cartola/projection";
import { comBonusDasDicas } from "@/lib/cartola/dicas";
import { resumirHistorico } from "@/lib/cartola/stats";
import type { AtletaProjetado, NivelAdversario } from "@/lib/cartola/types";
import { NIVEIS_ADVERSARIO, POSICOES } from "@/lib/cartola/types";
import { COR_NIVEL } from "./Indicadores";
import { cn } from "@/lib/utils";
import { fmt, fmtEscalacoes, STATUS_MERCADO } from "./format";
import { DicasRodada } from "./DicasRodada";
import { PlayerDetailDialog } from "./PlayerDetailDialog";
import { PlayersTable } from "./PlayersTable";
import { SettingsPanel } from "./SettingsPanel";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { emCampo, SoccerField, type Escolha, type OpcaoCampo, type Slot } from "./SoccerField";

const PREFS_KEY = "cartola:prefs:v3";
/** Versões anteriores: aproveitamos formação e cartoletas, mas não os pesos (recalibrados). */
const PREFS_KEY_V2 = "cartola:prefs:v2";
const PREFS_KEY_V1 = "cartola:prefs:v1";

export type ModoOrcamento = "ideal" | "proprio";

interface Prefs {
  /** "ideal": time com as maiores pontuações, sem limite; "proprio": limitado às cartoletas. */
  modoOrcamento: ModoOrcamento;
  minhasCartoletas: number;
  formacao: string;
  cfg: ModeloConfig;
}

const PREFS_PADRAO: Prefs = {
  modoOrcamento: "ideal",
  minhasCartoletas: 100,
  formacao: "auto",
  cfg: MODELO_PADRAO,
};

function lerPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Prefs>;
      return {
        modoOrcamento: p.modoOrcamento === "proprio" ? "proprio" : "ideal",
        minhasCartoletas:
          typeof p.minhasCartoletas === "number"
            ? p.minhasCartoletas
            : PREFS_PADRAO.minhasCartoletas,
        formacao: typeof p.formacao === "string" ? p.formacao : PREFS_PADRAO.formacao,
        cfg: { ...MODELO_PADRAO, ...(p.cfg ?? {}) },
      };
    }
    // Versões anteriores: mantém formação e cartoletas; os pesos voltam ao padrão novo.
    const v2 = localStorage.getItem(PREFS_KEY_V2);
    if (v2) {
      const p = JSON.parse(v2) as Partial<Prefs>;
      return {
        ...PREFS_PADRAO,
        modoOrcamento: p.modoOrcamento === "proprio" ? "proprio" : "ideal",
        minhasCartoletas:
          typeof p.minhasCartoletas === "number"
            ? p.minhasCartoletas
            : PREFS_PADRAO.minhasCartoletas,
        formacao: typeof p.formacao === "string" ? p.formacao : PREFS_PADRAO.formacao,
      };
    }
    const antigo = localStorage.getItem(PREFS_KEY_V1);
    if (antigo) {
      const p = JSON.parse(antigo) as { orcamento?: unknown; formacao?: unknown };
      return {
        ...PREFS_PADRAO,
        minhasCartoletas:
          typeof p.orcamento === "number" ? p.orcamento : PREFS_PADRAO.minhasCartoletas,
        formacao: typeof p.formacao === "string" ? p.formacao : PREFS_PADRAO.formacao,
      };
    }
    return PREFS_PADRAO;
  } catch {
    return PREFS_PADRAO;
  }
}

function gravarPrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // sem armazenamento local: as preferências valem só nesta visita
  }
}

function dataHora(d: Date) {
  return d.toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fechamentoTexto(f?: {
  dia: number;
  mes: number;
  ano: number;
  hora: number;
  minuto: number;
}) {
  if (!f) return null;
  return dataHora(new Date(f.ano, f.mes - 1, f.dia, f.hora, f.minuto));
}

/** Acima disso os dados são destacados como desatualizados. */
const HORAS_DADOS_ANTIGOS = 12;

function tempoDecorrido(desde: Date): string {
  const min = Math.max(0, Math.round((Date.now() - desde.getTime()) / 60_000));
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.round(h / 24)} dias`;
}

export function CartolaApp() {
  const { estado, recarregar } = useDados();

  return (
    <div className="min-h-full bg-background">
      <header className="cartola-header sticky z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-3 gap-y-1 py-2">
          <h1 className="font-display text-xl font-bold uppercase tracking-wide">
            Escalador <span className="text-[var(--gramado)]">Cartola</span>
          </h1>
          {estado.tipo === "ok" && <StatusMercado dados={estado.dados} />}
          {estado.tipo === "ok" && <IdadeDados atualizadoEm={estado.dados.atualizadoEm} />}
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-4 py-4">
        {estado.tipo === "carregando" && (
          <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Carregando os dados do Cartola…
          </div>
        )}
        {estado.tipo === "erro" && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Não foi possível carregar os dados</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-2">
              {estado.mensagem}
              <Button size="sm" variant="outline" className="h-7" onClick={() => void recarregar()}>
                Tentar de novo
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {estado.tipo === "ok" && <Escalador dados={estado.dados} />}
        <ComoFunciona />
      </main>
    </div>
  );
}

function StatusMercado({ dados }: { dados: DadosCartola }) {
  const s = dados.status;
  const aberto = s.status_mercado === 1;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="rounded-full bg-secondary px-2 py-0.5 font-semibold tabular-nums">
        Rodada {s.rodada_atual}
      </span>
      <span
        className={cn(
          "rounded-full px-2 py-0.5 font-semibold",
          aberto ? "bg-[var(--gramado)] text-white" : "bg-muted text-muted-foreground",
        )}
      >
        {STATUS_MERCADO[s.status_mercado] ?? `Status ${s.status_mercado}`}
      </span>
      {aberto && fechamentoTexto(s.fechamento) && (
        <span className="text-muted-foreground">fecha {fechamentoTexto(s.fechamento)}</span>
      )}
    </div>
  );
}

function IdadeDados({ atualizadoEm }: { atualizadoEm: string }) {
  const quando = new Date(atualizadoEm);
  const antigo = Date.now() - quando.getTime() > HORAS_DADOS_ANTIGOS * 3_600_000;
  return (
    <span
      className={cn(
        "ml-auto flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs tabular-nums",
        antigo
          ? "border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          : "text-muted-foreground",
      )}
      title="A página é atualizada automaticamente todo dia às 8h47 e às 13h47 (horário de Brasília)."
    >
      <Clock className="h-3 w-3" />
      Dados de {dataHora(quando)} · {tempoDecorrido(quando)}
    </span>
  );
}

function Escalador({ dados }: { dados: DadosCartola }) {
  const [prefs, setPrefsState] = useState<Prefs>(PREFS_PADRAO);
  const [escolhas, setEscolhas] = useState<Record<number, Escolha>>({});
  const [opcao, setOpcao] = useState<OpcaoCampo>("alternativa");
  const [detalhe, setDetalhe] = useState<AtletaProjetado | null>(null);

  useEffect(() => setPrefsState(lerPrefs()), []);
  const setPrefs = (fn: (p: Prefs) => Prefs) =>
    setPrefsState((p) => {
      const n = fn(p);
      gravarPrefs(n);
      return n;
    });

  const clubes = dados.clubes;
  const resumo = useMemo(() => resumirHistorico(dados.rodadas), [dados.rodadas]);
  const maisEscalados = useMemo(() => dados.maisEscalados ?? [], [dados.maisEscalados]);
  const temMaisEscalados = maisEscalados.length > 0;
  const atletasBase = useMemo(
    () =>
      montarAtletas(
        mercadoDe(dados),
        resumo,
        dados.partidas,
        new Map(maisEscalados.map((m) => [m.atleta_id, m.escalacoes])),
      ),
    [dados, resumo, maisEscalados],
  );
  // Projeção do modelo e, em seguida, o bônus das dicas da rodada somado ao score.
  const { atletas: projetados, dicas } = useMemo(
    () =>
      comBonusDasDicas(
        projetarAtletas(atletasBase, resumo, prefs.cfg),
        dados.rodadas,
        resumo.modeloGols,
        dados.partidas,
        (prefs.cfg.pesoDicas ?? 0) / 100,
      ),
    [atletasBase, resumo, prefs.cfg, dados.rodadas, dados.partidas],
  );

  // Time ideal: as maiores pontuações prováveis, sem limite de cartoletas.
  const ideal = useMemo(
    () => escalar(projetados, prefs.formacao, Number.POSITIVE_INFINITY),
    [projetados, prefs.formacao],
  );
  const custoIdeal = ideal?.custo ?? null;
  const proprio = prefs.modoOrcamento === "proprio";
  const cartoletas = prefs.minhasCartoletas;
  const orcamentoValido = !proprio || (Number.isFinite(cartoletas) && cartoletas > 0);
  const escalacao = useMemo(() => {
    if (!proprio) return ideal;
    return orcamentoValido ? escalar(projetados, prefs.formacao, cartoletas) : null;
  }, [proprio, ideal, orcamentoValido, projetados, prefs.formacao, cartoletas]);

  useEffect(() => setEscolhas({}), [escalacao]);

  const populares = useMemo(
    () =>
      atribuirMaisEscalados(
        escalacao?.titulares ?? [],
        projetados,
        maisEscalados.map((m) => m.atleta_id),
      ),
    [escalacao, projetados, maisEscalados],
  );

  const slots: Slot[] = useMemo(
    () =>
      (escalacao?.titulares ?? []).map((t) => ({
        titular: t,
        alternativa: escalacao?.alternativas[t.id] ?? null,
        alternativa2: escalacao?.alternativas2[t.id] ?? null,
        popular: populares[t.id] ?? null,
        escolha: escolhas[t.id] ?? "titular",
      })),
    [escalacao, populares, escolhas],
  );

  const timeAtual = useMemo(() => slots.map(emCampo), [slots]);
  // O banco não repete quem está no campo nem quem aparece como opção de troca.
  const banco = useMemo(() => {
    const emCampoIds = new Set(timeAtual.map((a) => a.id));
    const opcoes = new Set(
      slots
        .flatMap((s) => [s.titular, s.alternativa, s.alternativa2, s.popular])
        .filter((a): a is AtletaProjetado => !!a && !emCampoIds.has(a.id))
        .map((a) => a.id),
    );
    return escolherBanco(projetados, timeAtual, opcoes);
  }, [projetados, timeAtual, slots]);

  const capitao = useMemo(() => escolherCapitao(timeAtual), [timeAtual]);
  const custoAtual = timeAtual.reduce((s, a) => s + a.preco, 0);
  const projAtual = projecaoTime(timeAtual, capitao?.id ?? null);
  const saldo = proprio ? cartoletas - custoAtual : null;
  const escaladosIds = useMemo(
    () => new Set([...timeAtual, ...banco.reservas].map((a) => a.id)),
    [timeAtual, banco],
  );

  const escolher = (titularId: number, escolha: Escolha) =>
    setEscolhas((e) => ({ ...e, [titularId]: escolha }));
  const escolherTodos = (escolha: Escolha) =>
    setEscolhas(Object.fromEntries(slots.map((s) => [s.titular.id, escolha])));
  const todosEm = (escolha: Escolha) =>
    slots.length > 0 && slots.every((s) => s.escolha === escolha);

  const status = dados.status;

  return (
    <>
      {status.status_mercado === 2 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Mercado fechado</AlertTitle>
          <AlertDescription>
            A rodada {status.rodada_atual} está em andamento. A escalação serve como referência e
            será recalculada quando o mercado reabrir.
          </AlertDescription>
        </Alert>
      )}
      {dados.rodadasIndisponiveis.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            As rodadas {dados.rodadasIndisponiveis.join(", ")} não puderam ser coletadas. As
            estatísticas usam as demais.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="escalacao">
        <TabsList>
          <TabsTrigger value="escalacao">Escalação</TabsTrigger>
          <TabsTrigger value="jogadores">Análise dos jogadores</TabsTrigger>
        </TabsList>

        <TabsContent value="escalacao" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_340px]">
            <Card className="order-2 lg:order-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Configuração</CardTitle>
              </CardHeader>
              <CardContent>
                <SettingsPanel
                  modo={prefs.modoOrcamento}
                  onModo={(modoOrcamento) => setPrefs((p) => ({ ...p, modoOrcamento }))}
                  cartoletas={cartoletas}
                  onCartoletas={(v) => setPrefs((p) => ({ ...p, minhasCartoletas: v }))}
                  custoIdeal={custoIdeal}
                  formacao={prefs.formacao}
                  onFormacao={(v) => setPrefs((p) => ({ ...p, formacao: v }))}
                  cfg={prefs.cfg}
                  onCfg={(cfg) => setPrefs((p) => ({ ...p, cfg }))}
                />
              </CardContent>
            </Card>

            <div className="order-1 min-w-0 space-y-3 lg:order-2">
              {escalacao ? (
                <>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        document.getElementById("dicas")?.scrollIntoView({ behavior: "smooth" })
                      }
                      className="flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium hover:bg-accent"
                    >
                      <Lightbulb className="h-3.5 w-3.5 text-amber-500" /> Dicas da rodada
                    </button>
                  </div>
                  <ResumoTime
                    formacao={escalacao.formacao}
                    custo={custoAtual}
                    cartoletas={proprio ? cartoletas : null}
                    saldo={saldo}
                    custoIdeal={custoIdeal}
                    projecaoIdeal={ideal?.projecao ?? null}
                    projecao={projAtual}
                    capitao={capitao}
                  />
                  <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
                    <span className="text-muted-foreground">Botão de troca no campo:</span>
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      size="sm"
                      value={opcao}
                      onValueChange={(v) => v && setOpcao(v as OpcaoCampo)}
                    >
                      <ToggleGroupItem value="alternativa" className="h-7 gap-1 px-2 text-xs">
                        <ArrowLeftRight className="h-3 w-3" /> 2ª opção
                      </ToggleGroupItem>
                      <ToggleGroupItem value="alternativa2" className="h-7 gap-1 px-2 text-xs">
                        <Shuffle className="h-3 w-3" /> 3ª opção
                      </ToggleGroupItem>
                      {temMaisEscalados && (
                        <ToggleGroupItem value="popular" className="h-7 gap-1 px-2 text-xs">
                          <Users className="h-3 w-3" /> Mais escalado
                        </ToggleGroupItem>
                      )}
                    </ToggleGroup>
                  </div>
                  <SoccerField
                    slots={slots}
                    opcao={opcao}
                    capitaoId={capitao?.id ?? null}
                    banco={banco}
                    clubes={clubes}
                    onEscolher={escolher}
                    onSelect={setDetalhe}
                  />
                  <p className="text-center text-xs text-muted-foreground">
                    Toque no jogador para ver as estatísticas e no botão embaixo dele para trocar{" "}
                    {opcao === "popular"
                      ? "pelo mais escalado"
                      : opcao === "alternativa2"
                        ? "pela 3ª opção"
                        : "pela 2ª opção"}{" "}
                    da posição.
                  </p>
                  <LegendaNivel />
                </>
              ) : (
                <Card>
                  <CardContent className="py-16 text-center text-sm text-muted-foreground">
                    {!orcamentoValido
                      ? "Informe quantas cartoletas você tem."
                      : "Não foi possível montar um time com essa formação e esse orçamento. Aumente as cartoletas, troque a formação ou reduza o mínimo de jogos."}
                  </CardContent>
                </Card>
              )}
            </div>

            <Card className="order-3">
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm">Opções por posição</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 p-3 pt-0">
                {escalacao && (
                  <div className="flex flex-wrap gap-1 pb-2">
                    <span className="mr-1 self-center text-[11px] text-muted-foreground">
                      Time todo:
                    </span>
                    <Button
                      size="sm"
                      variant={todosEm("titular") ? "default" : "outline"}
                      className="h-6 px-2 text-[11px]"
                      onClick={() => escolherTodos("titular")}
                    >
                      Titulares
                    </Button>
                    <Button
                      size="sm"
                      variant={todosEm("alternativa") ? "default" : "outline"}
                      className="h-6 gap-1 px-2 text-[11px]"
                      onClick={() => escolherTodos("alternativa")}
                    >
                      <ArrowLeftRight className="h-3 w-3" /> 2ª opção
                    </Button>
                    <Button
                      size="sm"
                      variant={todosEm("alternativa2") ? "default" : "outline"}
                      className="h-6 gap-1 px-2 text-[11px]"
                      onClick={() => escolherTodos("alternativa2")}
                    >
                      <Shuffle className="h-3 w-3" /> 3ª opção
                    </Button>
                    {temMaisEscalados && (
                      <Button
                        size="sm"
                        variant={todosEm("popular") ? "default" : "outline"}
                        className="h-6 gap-1 px-2 text-[11px]"
                        onClick={() => escolherTodos("popular")}
                      >
                        <Users className="h-3 w-3" /> Mais escalados
                      </Button>
                    )}
                  </div>
                )}
                {slots.map((s) => (
                  <AlternativaRow
                    key={s.titular.id}
                    slot={s}
                    onEscolher={(e) => escolher(s.titular.id, e)}
                    onSelect={setDetalhe}
                  />
                ))}
                {banco.reservas.length > 0 && (
                  <div className="pt-3">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Banco de reservas
                    </div>
                    {banco.reservas.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setDetalhe(r)}
                        className="flex w-full items-center gap-2 rounded px-1 py-1 text-left hover:bg-accent"
                      >
                        <span className="w-8 shrink-0 text-[10px] font-semibold text-muted-foreground">
                          {POSICOES[r.posicaoId].curto}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs font-medium">
                          {r.apelido}
                        </span>
                        {r.id === banco.luxoId && (
                          <span className="flex items-center gap-0.5 rounded bg-[var(--luxo)] px-1 text-[10px] font-semibold text-white">
                            <Star className="h-2.5 w-2.5 fill-current" /> Luxo
                          </span>
                        )}
                        <span className="text-[10px] tabular-nums text-muted-foreground">
                          {fmt(r.projecao)} pts · C$ {fmt(r.preco)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {escalacao && (
                  <p className="pt-2 text-[11px] leading-snug text-muted-foreground">
                    A 2ª opção é o melhor jogador da posição fora do time, e a 3ª, o melhor depois
                    dela (com “Minhas cartoletas”, o melhor que ainda cabe no valor se for trocado
                    sozinho). O mais escalado é o jogador da posição que mais cartoleiros escalaram
                    na rodada, sem considerar o preço. O capitão (×
                    {CAPITAO_MULT}) e o banco são recalculados a cada troca. Cada reserva custa no
                    máximo o mesmo que o titular mais barato da posição.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
          <div id="dicas" className="mt-4 scroll-mt-20">
            <DicasRodada
              dicas={dicas}
              clubes={clubes}
              onSelect={setDetalhe}
              noTime={new Set(timeAtual.map((a) => a.id))}
              noBanco={new Set(banco.reservas.map((a) => a.id))}
            />
          </div>
        </TabsContent>

        <TabsContent value="jogadores" className="mt-4">
          <Card>
            <CardContent className="p-3">
              <PlayersTable
                atletas={projetados}
                clubes={clubes}
                escaladosIds={escaladosIds}
                onSelect={setDetalhe}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <PlayerDetailDialog atleta={detalhe} clubes={clubes} onClose={() => setDetalhe(null)} />
    </>
  );
}

function ComoFunciona() {
  return (
    <details className="rounded-md border bg-card p-3 text-xs text-muted-foreground">
      <summary className="cursor-pointer font-medium text-foreground">
        Como a projeção é calculada
      </summary>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>
          Os dados vêm da API pública do Cartola: mercado, jogos da rodada e a pontuação de cada
          atleta em todas as rodadas já encerradas, com o mando (casa ou fora) de cada jogo.
        </li>
        <li>
          A projeção é uma média ponderada de: média geral, média no mando do próximo jogo, média
          das últimas 5 rodadas em que pontuou, mediana e média básica (sem gols e assistências).
        </li>
        <li>
          Quem jogou poucas partidas tem a média puxada para a média da posição, para não ser
          superestimado.
        </li>
        <li>
          O confronto ajusta a projeção pela média de pontos que o adversário cede para a posição,
          considerando o mando.
        </li>
        <li>
          Fator casa/fora: a média do jogador em casa ou fora (conforme o jogo da rodada) é
          combinada com a vantagem de mando da posição em toda a liga. A página mostra quantos
          pontos isso soma ou tira da média dele e a chance de ele pontuar acima da própria média
          nesse mando.
        </li>
        <li>
          Nível do adversário: pela posição na tabela, o adversário entra numa de 4 faixas (muito
          difícil do 1º ao 5º, difícil do 6º ao 10º, fácil do 11º ao 15º e muito fácil do 16º ao
          20º). O efeito de cada faixa é medido na temporada, por posição, e ajusta a projeção.
        </li>
        <li>O perfil conservador penaliza o desvio padrão; o arrojado o favorece.</li>
        <li>
          Chance de jogar: medida na temporada pela presença nas últimas 5 partidas do clube (quem
          jogou as 5 entra em campo em 84% das vezes; quem jogou só 1 e ficou fora da última, em
          20%). O status “Provável” resolve a maior parte dessa incerteza; jogadores em dúvida
          perdem mais 25%. A projeção é multiplicada por essa chance.
        </li>
        <li>
          Modelo de gols: o ataque e a defesa de cada clube (gols marcados e sofridos, com mais peso
          para os jogos recentes) dão os gols esperados de cada lado. Daí saem a chance de não
          sofrer gol (vale 5 pts para goleiro, lateral e zagueiro), os gols esperados do time (pesam
          nos gols e assistências) e o saldo esperado (pesa no técnico).
        </li>
        <li>
          Dicas da rodada: quem aparece nelas ganha até 1 ponto no score da escalação (em alta,
          destaque, goleiro em destaque, custo-benefício, time favorito, defesa que não sofre gol,
          ataque em alta ou adversário que sofre muitos gols). A pontuação provável exibida não
          muda; o bônus aparece na ficha do jogador. A intensidade se ajusta em “Bônus das dicas”.
        </li>
        <li>
          Os pesos foram calibrados por backtest: cada rodada passada foi prevista usando só as
          anteriores e comparada com o resultado real. O modelo de gols e a chance de jogar
          melhoraram a previsão; com eles, o nível pela tabela e os pontos cedidos quase não
          acrescentam e ficaram com peso baixo.
        </li>
        <li>
          O time é otimizado para a maior soma de pontos dentro das cartoletas. Na formação
          automática, todas as formações são testadas.
        </li>
        <li>
          O reserva de luxo é o reserva com maior ganho esperado sobre o titular mais fraco da mesma
          posição, considerando a média e a variação de cada um.
        </li>
      </ul>
    </details>
  );
}

function ResumoTime({
  formacao,
  custo,
  cartoletas,
  saldo,
  custoIdeal,
  projecaoIdeal,
  projecao,
  capitao,
}: {
  formacao: string;
  custo: number;
  /** null no modo ideal (sem limite de cartoletas). */
  cartoletas: number | null;
  saldo: number | null;
  custoIdeal: number | null;
  projecaoIdeal: number | null;
  projecao: number;
  capitao: AtletaProjetado | null;
}) {
  const item = "flex min-w-0 flex-col rounded-md border bg-card px-3 py-1.5";
  const rotulo = "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground";
  const valor = "font-display text-lg font-bold tabular-nums";
  const estourou = saldo != null && saldo < -1e-6;
  const usado = cartoletas ? Math.min(100, (custo / cartoletas) * 100) : 100;
  const faltaParaIdeal = cartoletas != null && custoIdeal != null ? custoIdeal - cartoletas : null;

  return (
    <div className="space-y-2">
      <div className="rounded-md border bg-card px-3 py-2">
        {cartoletas == null ? (
          <>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className={rotulo}>Valor do time ideal</span>
              <span className="font-display text-2xl font-bold tabular-nums text-[var(--gramado)]">
                C$ {fmt(custo, 2)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Time com as maiores pontuações prováveis, sem limite de cartoletas. Para montar com o
              que você tem, escolha “Minhas cartoletas” na configuração.
            </p>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className={rotulo}>Custo do time</span>
                <span
                  className={cn(
                    "font-display text-2xl font-bold tabular-nums",
                    estourou && "text-destructive",
                  )}
                >
                  C$ {fmt(custo, 2)}
                </span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  de C$ {fmt(cartoletas, 2)}
                </span>
              </div>
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  estourou ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {estourou ? "Faltam" : "Sobram"} C$ {fmt(Math.abs(saldo ?? 0), 2)}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full",
                  estourou ? "bg-destructive" : "bg-[var(--gramado)]",
                )}
                style={{ width: `${usado}%` }}
              />
            </div>
            {custoIdeal != null && projecaoIdeal != null && (
              <p className="mt-1 text-xs text-muted-foreground">
                {faltaParaIdeal != null && faltaParaIdeal > 0.005 ? (
                  <>
                    O time ideal custa <strong>C$ {fmt(custoIdeal, 2)}</strong> (C${" "}
                    {fmt(faltaParaIdeal, 2)} a mais) e projeta {fmt(projecaoIdeal)} pts,{" "}
                    {fmt(Math.max(0, projecaoIdeal - projecao))} a mais que este.
                  </>
                ) : (
                  <>Suas cartoletas já pagam o time ideal (C$ {fmt(custoIdeal, 2)}).</>
                )}
              </p>
            )}
          </>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className={item}>
          <span className={rotulo}>Formação</span>
          <span className={valor}>{formacao}</span>
        </div>
        <div className={item}>
          <span className={rotulo}>Projeção</span>
          <span className={valor}>{fmt(projecao)} pts</span>
        </div>
        <div className={cn(item, "col-span-2 sm:col-span-1")}>
          <span className={rotulo}>Capitão</span>
          <span className={cn(valor, "truncate")}>{capitao?.apelido ?? "–"}</span>
        </div>
      </div>
    </div>
  );
}

function AlternativaRow({
  slot,
  onEscolher,
  onSelect,
}: {
  slot: Slot;
  onEscolher: (escolha: Escolha) => void;
  onSelect: (a: AtletaProjetado) => void;
}) {
  const t = slot.titular;
  const alt = slot.alternativa;
  const alt2 = slot.alternativa2;
  const pop = slot.popular;
  const nome = (a: AtletaProjetado, ativo: boolean) => (
    <button
      type="button"
      onClick={() => onSelect(a)}
      className={cn(
        "min-w-0 flex-1 rounded px-1.5 py-1 text-left hover:bg-accent",
        ativo && "bg-[var(--gramado-suave)] ring-1 ring-[var(--gramado)]",
      )}
    >
      <div className="truncate text-xs font-medium">{a.apelido}</div>
      <div className="text-[10px] tabular-nums text-muted-foreground">
        {fmt(a.projecao)} pts · C$ {fmt(a.preco)}
      </div>
    </button>
  );
  const trocar = (escolha: Escolha) => onEscolher(slot.escolha === escolha ? "titular" : escolha);
  return (
    <div className="border-b py-0.5 last:border-b-0">
      <div className="flex items-center gap-1">
        <span className="w-8 shrink-0 text-[10px] font-semibold text-muted-foreground">
          {POSICOES[t.posicaoId].curto}
        </span>
        {nome(t, slot.escolha === "titular")}
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0"
          onClick={() => trocar("alternativa")}
          disabled={!alt}
          title="Alternar com a 2ª opção"
          aria-label={`Alternar ${t.apelido} com a 2ª opção`}
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
        </Button>
        {alt ? (
          nome(alt, slot.escolha === "alternativa")
        ) : (
          <span className="flex-1 text-xs text-muted-foreground">sem opção</span>
        )}
      </div>
      {alt2 && (
        <div className="flex items-center gap-1 pl-9 text-[10px] text-muted-foreground">
          <Shuffle className="h-3 w-3 shrink-0" />
          <button
            type="button"
            onClick={() => trocar("alternativa2")}
            className={cn(
              "min-w-0 truncate rounded px-1 text-left hover:bg-accent hover:text-foreground",
              slot.escolha === "alternativa2" &&
                "bg-[var(--gramado-suave)] text-foreground ring-1 ring-[var(--gramado)]",
            )}
            title={
              slot.escolha === "alternativa2" ? `Voltar para ${t.apelido}` : `Usar ${alt2.apelido}`
            }
          >
            3ª opção: <span className="font-medium">{alt2.apelido}</span> · {fmt(alt2.projecao)} pts
            · C$ {fmt(alt2.preco)}
          </button>
        </div>
      )}
      {pop && (
        <div className="flex items-center gap-1 pl-9 text-[10px] text-muted-foreground">
          <Users className="h-3 w-3 shrink-0" />
          {pop.id === t.id ? (
            <span className="truncate">
              É o mais escalado da posição ({fmtEscalacoes(pop.escalacoes)})
            </span>
          ) : (
            <button
              type="button"
              onClick={() => trocar("popular")}
              className={cn(
                "min-w-0 truncate rounded px-1 text-left hover:bg-accent hover:text-foreground",
                slot.escolha === "popular" &&
                  "bg-[var(--gramado-suave)] text-foreground ring-1 ring-[var(--gramado)]",
              )}
              title={
                slot.escolha === "popular" ? `Voltar para ${t.apelido}` : `Usar ${pop.apelido}`
              }
            >
              Mais escalado: <span className="font-medium">{pop.apelido}</span> ·{" "}
              {fmtEscalacoes(pop.escalacoes)} · {fmt(pop.projecao)} pts · C$ {fmt(pop.preco)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function LegendaNivel() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      <span>Nível do adversário (ponto ao lado do adversário):</span>
      {(Object.keys(NIVEIS_ADVERSARIO) as NivelAdversario[]).map((n) => (
        <span key={n} className="flex items-center gap-1">
          <span className={cn("inline-block h-2 w-2 rounded-full", COR_NIVEL[n])} />
          {NIVEIS_ADVERSARIO[n].rotulo}
        </span>
      ))}
    </div>
  );
}
