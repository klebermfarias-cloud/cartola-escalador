import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeftRight, Clock, Loader2, Star, Users } from "lucide-react";
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
import { resumirHistorico } from "@/lib/cartola/stats";
import type { AtletaProjetado, NivelAdversario } from "@/lib/cartola/types";
import { NIVEIS_ADVERSARIO, POSICOES } from "@/lib/cartola/types";
import { COR_NIVEL } from "./Indicadores";
import { cn } from "@/lib/utils";
import { fmt, fmtEscalacoes, STATUS_MERCADO } from "./format";
import { PlayerDetailDialog } from "./PlayerDetailDialog";
import { PlayersTable } from "./PlayersTable";
import { SettingsPanel } from "./SettingsPanel";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { emCampo, SoccerField, type Escolha, type OpcaoCampo, type Slot } from "./SoccerField";

const PREFS_KEY = "cartola:prefs:v1";

interface Prefs {
  orcamento: number;
  formacao: string;
  cfg: ModeloConfig;
}

const PREFS_PADRAO: Prefs = { orcamento: 100, formacao: "auto", cfg: MODELO_PADRAO };

function lerPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return PREFS_PADRAO;
    const p = JSON.parse(raw) as Partial<Prefs>;
    return {
      orcamento: typeof p.orcamento === "number" ? p.orcamento : PREFS_PADRAO.orcamento,
      formacao: typeof p.formacao === "string" ? p.formacao : PREFS_PADRAO.formacao,
      cfg: { ...MODELO_PADRAO, ...(p.cfg ?? {}) },
    };
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
  const projetados = useMemo(
    () => projetarAtletas(atletasBase, resumo, prefs.cfg),
    [atletasBase, resumo, prefs.cfg],
  );

  const orcamentoValido = Number.isFinite(prefs.orcamento) && prefs.orcamento > 0;
  const escalacao = useMemo(
    () => (orcamentoValido ? escalar(projetados, prefs.formacao, prefs.orcamento) : null),
    [projetados, prefs.formacao, prefs.orcamento, orcamentoValido],
  );

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
        .flatMap((s) => [s.titular, s.alternativa, s.popular])
        .filter((a): a is AtletaProjetado => !!a && !emCampoIds.has(a.id))
        .map((a) => a.id),
    );
    return escolherBanco(projetados, timeAtual, opcoes);
  }, [projetados, timeAtual, slots]);

  const capitao = useMemo(() => escolherCapitao(timeAtual), [timeAtual]);
  const custoAtual = timeAtual.reduce((s, a) => s + a.preco, 0);
  const projAtual = projecaoTime(timeAtual, capitao?.id ?? null);
  const saldo = prefs.orcamento - custoAtual;
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
                  orcamento={prefs.orcamento}
                  onOrcamento={(v) => setPrefs((p) => ({ ...p, orcamento: v }))}
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
                  <ResumoTime
                    formacao={escalacao.formacao}
                    custo={custoAtual}
                    saldo={saldo}
                    projecao={projAtual}
                    capitao={capitao}
                  />
                  {temMaisEscalados && (
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
                        <ToggleGroupItem value="popular" className="h-7 gap-1 px-2 text-xs">
                          <Users className="h-3 w-3" /> Mais escalado
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                  )}
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
                    {opcao === "popular" ? "pelo mais escalado" : "pela 2ª opção"} da posição.
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
                {escalacao && !temMaisEscalados && (
                  <p className="pt-2 text-[11px] leading-snug text-muted-foreground">
                    Os mais escalados da rodada não vieram na última coleta da API do Cartola.
                  </p>
                )}
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
                    A 2ª opção é o melhor jogador da posição fora do time que ainda cabe nas
                    cartoletas se for trocado sozinho. O mais escalado é o jogador da posição que
                    mais cartoleiros escalaram na rodada, sem considerar o preço. O capitão (×
                    {CAPITAO_MULT}) e o banco são recalculados a cada troca. Cada reserva custa no
                    máximo o mesmo que o titular mais barato da posição.
                  </p>
                )}
              </CardContent>
            </Card>
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
        <li>
          O perfil conservador penaliza o desvio padrão; o arrojado o favorece. Jogadores em dúvida
          perdem 25% da projeção, e quem entrou em campo em menos da metade dos jogos do clube perde
          até 25%.
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
  saldo,
  projecao,
  capitao,
}: {
  formacao: string;
  custo: number;
  saldo: number;
  projecao: number;
  capitao: AtletaProjetado | null;
}) {
  const item = "flex min-w-0 flex-col rounded-md border bg-card px-3 py-1.5";
  const rotulo = "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground";
  const valor = "font-display text-lg font-bold tabular-nums";
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      <div className={item}>
        <span className={rotulo}>Formação</span>
        <span className={valor}>{formacao}</span>
      </div>
      <div className={item}>
        <span className={rotulo}>Custo</span>
        <span className={valor}>C$ {fmt(custo, 2)}</span>
      </div>
      <div className={item}>
        <span className={rotulo}>Saldo</span>
        <span className={cn(valor, saldo < -1e-6 && "text-destructive")}>C$ {fmt(saldo, 2)}</span>
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
