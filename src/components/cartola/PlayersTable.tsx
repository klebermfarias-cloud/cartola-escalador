import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { AtletaProjetado } from "@/lib/cartola/types";
import { POSICOES } from "@/lib/cartola/types";
import { cn } from "@/lib/utils";
import {
  escudo,
  fmt,
  fmtEscalacoes,
  fmtPct,
  siglaClube,
  STATUS_NOMES,
  type Clubes,
} from "./format";

type Col = {
  key: string;
  label: string;
  title?: string;
  get: (a: AtletaProjetado) => number | string | null;
  render?: (a: AtletaProjetado) => ReactNode;
};

const LIMITE = 200;

export function PlayersTable({
  atletas,
  clubes,
  escaladosIds,
  onSelect,
}: {
  atletas: AtletaProjetado[];
  clubes: Clubes;
  escaladosIds: Set<number>;
  onSelect: (a: AtletaProjetado) => void;
}) {
  const [pos, setPos] = useState("0");
  const [busca, setBusca] = useState("");
  const [soElegiveis, setSoElegiveis] = useState(true);
  const [sort, setSort] = useState<{ key: string; desc: boolean }>({ key: "projecao", desc: true });

  const cols: Col[] = useMemo(
    () => [
      {
        key: "projecao",
        label: "Proj.",
        title: "Pontuação projetada para a rodada",
        get: (a) => a.projecao,
      },
      { key: "preco", label: "C$", get: (a) => a.preco },
      {
        key: "custoBeneficio",
        label: "Pts/C$",
        title: "Projeção por cartoleta",
        get: (a) => (a.preco > 0 ? a.projecao / a.preco : null),
      },
      { key: "media", label: "Média", get: (a) => a.stats.media },
      { key: "mediana", label: "Mediana", get: (a) => a.stats.mediana },
      { key: "desvio", label: "DP", title: "Desvio padrão", get: (a) => a.stats.desvio },
      { key: "casa", label: "Casa", get: (a) => a.stats.mediaCasa },
      { key: "fora", label: "Fora", get: (a) => a.stats.mediaFora },
      {
        key: "ultimas",
        label: "Últ. 5",
        title: "Média das últimas 5 rodadas em que pontuou",
        get: (a) => a.stats.mediaUltimas,
      },
      {
        key: "basica",
        label: "Básica",
        title: "Média sem gols e assistências",
        get: (a) => a.stats.mediaBasica,
      },
      { key: "jogos", label: "J", title: "Jogos", get: (a) => a.stats.jogos },
      {
        key: "participacao",
        label: "Part.",
        title: "% das rodadas do clube em que jogou",
        get: (a) => a.stats.participacao,
        render: (a) => fmtPct(a.stats.participacao),
      },
      {
        key: "cedidas",
        label: "Ced. adv.",
        title: "Média que o adversário cede para a posição",
        get: (a) => a.cedidasAdversario,
      },
      {
        key: "escalacoes",
        label: "Escal.",
        title: "Escalações na rodada (só para os mais escalados)",
        get: (a) => a.escalacoes ?? null,
        render: (a) => fmtEscalacoes(a.escalacoes),
      },
      {
        key: "minimo",
        label: "Mín. val.",
        title: "Mínimo para valorizar",
        get: (a) => a.minimoValorizar,
      },
    ],
    [],
  );
  // A coluna de escalações só aparece quando a coleta trouxe os mais escalados.
  const temEscalacoes = useMemo(() => atletas.some((a) => a.escalacoes != null), [atletas]);
  const colsVisiveis = useMemo(
    () => (temEscalacoes ? cols : cols.filter((c) => c.key !== "escalacoes")),
    [cols, temEscalacoes],
  );

  const linhas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const col = cols.find((c) => c.key === sort.key) ?? cols[0];
    return atletas
      .filter((a) => pos === "0" || String(a.posicaoId) === pos)
      .filter((a) => !soElegiveis || a.elegivel)
      .filter(
        (a) =>
          !q ||
          a.apelido.toLowerCase().includes(q) ||
          siglaClube(clubes, a.clubeId).toLowerCase().includes(q),
      )
      .sort((x, y) => {
        const vx = col.get(x);
        const vy = col.get(y);
        if (vx == null && vy == null) return 0;
        if (vx == null) return 1;
        if (vy == null) return -1;
        const d = vx < vy ? -1 : vx > vy ? 1 : 0;
        return sort.desc ? -d : d;
      });
  }, [atletas, busca, clubes, cols, pos, soElegiveis, sort]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          type="single"
          value={pos}
          onValueChange={(v) => v && setPos(v)}
          size="sm"
          variant="outline"
          className="flex-wrap justify-start"
        >
          <ToggleGroupItem value="0" className="h-7 px-2 text-xs">
            Todos
          </ToggleGroupItem>
          {Object.entries(POSICOES).map(([id, p]) => (
            <ToggleGroupItem key={id} value={id} className="h-7 px-2 text-xs">
              {p.curto}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Input
          placeholder="Buscar jogador ou clube…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="h-7 w-48 text-xs"
        />
        <div className="flex items-center gap-1.5">
          <Switch id="so-elegiveis" checked={soElegiveis} onCheckedChange={setSoElegiveis} />
          <Label htmlFor="so-elegiveis" className="text-xs">
            Só escaláveis
          </Label>
        </div>
        <span className="ml-auto text-xs text-muted-foreground">
          {linhas.length} jogadores{linhas.length > LIMITE ? ` (mostrando ${LIMITE})` : ""}
        </span>
      </div>

      <div className="max-h-[70vh] overflow-auto rounded-md border">
        <table className="w-full min-w-[960px] text-xs">
          <thead className="sticky top-0 z-10 bg-muted">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">Jogador</th>
              <th className="px-2 py-1.5 text-left font-medium">Pos</th>
              <th className="px-2 py-1.5 text-left font-medium">Jogo</th>
              {colsVisiveis.map((c) => (
                <th
                  key={c.key}
                  title={c.title}
                  onClick={() =>
                    setSort((s) =>
                      s.key === c.key ? { key: c.key, desc: !s.desc } : { key: c.key, desc: true },
                    )
                  }
                  className="cursor-pointer whitespace-nowrap px-2 py-1.5 text-right font-medium hover:text-primary"
                >
                  <span className="inline-flex items-center gap-0.5">
                    {c.label}
                    {sort.key === c.key &&
                      (sort.desc ? (
                        <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUp className="h-3 w-3" />
                      ))}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.slice(0, LIMITE).map((a) => (
              <tr
                key={a.id}
                onClick={() => onSelect(a)}
                className={cn(
                  "cursor-pointer border-t hover:bg-accent",
                  escaladosIds.has(a.id) && "bg-emerald-50 dark:bg-emerald-950/30",
                  !a.elegivel && "text-muted-foreground",
                )}
              >
                <td className="px-2 py-1">
                  <div className="flex items-center gap-1.5">
                    {escudo(clubes, a.clubeId) && (
                      <img
                        src={escudo(clubes, a.clubeId)!}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="h-4 w-4 object-contain"
                      />
                    )}
                    <span className="font-medium">{a.apelido}</span>
                    {a.statusId !== 7 && (
                      <span className="rounded bg-amber-100 px-1 text-[10px] text-amber-900">
                        {STATUS_NOMES[a.statusId] ?? "?"}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-2 py-1">{POSICOES[a.posicaoId]?.curto}</td>
                <td className="whitespace-nowrap px-2 py-1">
                  {a.proximo
                    ? `${a.proximo.mando === "C" ? "vs" : "@"} ${siglaClube(clubes, a.proximo.adversario)}`
                    : "–"}
                </td>
                {colsVisiveis.map((c) => {
                  const v = c.get(a);
                  return (
                    <td key={c.key} className="px-2 py-1 text-right tabular-nums">
                      {c.render
                        ? c.render(a)
                        : typeof v === "number"
                          ? fmt(v, c.key === "jogos" ? 0 : c.key === "custoBeneficio" ? 2 : 1)
                          : (v ?? "–")}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
