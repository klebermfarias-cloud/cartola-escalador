import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Home, Plane } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AtletaProjetado } from "@/lib/cartola/types";
import { POSICOES } from "@/lib/cartola/types";
import {
  escudo,
  fmt,
  fmtEscalacoes,
  fmtPct,
  nomeClube,
  siglaClube,
  STATUS_NOMES,
  type Clubes,
} from "./format";

const SCOUT_NOMES: Record<string, string> = {
  G: "Gols",
  A: "Assistências",
  FT: "Final. na trave",
  FD: "Final. defendidas",
  FF: "Final. para fora",
  FS: "Faltas sofridas",
  PS: "Pênaltis sofridos",
  DS: "Desarmes",
  SG: "Jogos sem sofrer gol",
  DE: "Defesas",
  DP: "Defesas de pênalti",
  GS: "Gols sofridos",
  FC: "Faltas cometidas",
  CA: "Cartões amarelos",
  CV: "Cartões vermelhos",
  GC: "Gols contra",
  PC: "Pênaltis cometidos",
  PP: "Pênaltis perdidos",
  I: "Impedimentos",
  V: "Vitórias",
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border bg-muted/40 px-2 py-1.5" title={hint}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function PlayerDetailDialog({
  atleta,
  clubes,
  onClose,
}: {
  atleta: AtletaProjetado | null;
  clubes: Clubes;
  onClose: () => void;
}) {
  const a = atleta;
  return (
    <Dialog open={!!a} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        {a && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted text-lg font-bold text-muted-foreground">
                  {a.foto ? (
                    <img
                      src={a.foto}
                      alt={a.apelido}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover object-top"
                    />
                  ) : (
                    a.apelido.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 text-left">
                  <DialogTitle className="flex items-center gap-2">
                    {a.apelido}
                    {escudo(clubes, a.clubeId) && (
                      <img
                        src={escudo(clubes, a.clubeId)!}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="h-5 w-5 object-contain"
                      />
                    )}
                  </DialogTitle>
                  <DialogDescription asChild>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span>
                        {POSICOES[a.posicaoId].nome} · {nomeClube(clubes, a.clubeId)}
                      </span>
                      <Badge variant={a.statusId === 7 ? "default" : "secondary"}>
                        {STATUS_NOMES[a.statusId] ?? "Sem status"}
                      </Badge>
                      {a.proximo && (
                        <span className="flex items-center gap-1">
                          {a.proximo.mando === "C" ? (
                            <Home className="h-3 w-3" />
                          ) : (
                            <Plane className="h-3 w-3" />
                          )}
                          {a.proximo.mando === "C" ? "em casa" : "fora"} contra{" "}
                          {nomeClube(clubes, a.proximo.adversario)}
                        </span>
                      )}
                    </div>
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {!a.elegivel && a.motivoInelegivel && (
              <p className="rounded-md bg-amber-100 px-2 py-1 text-xs text-amber-900">
                Fora da escalação automática: {a.motivoInelegivel}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat
                label="Projeção"
                value={`${fmt(a.projecao)} pts`}
                hint="Pontuação esperada na rodada"
              />
              <Stat label="Preço" value={`C$ ${fmt(a.preco, 2)}`} />
              <Stat label="Variação" value={fmt(a.variacao, 2)} />
              <Stat
                label="Mín. p/ valorizar"
                value={a.minimoValorizar != null ? fmt(a.minimoValorizar) : "–"}
              />
              {a.escalacoes != null && (
                <Stat
                  label="Escalações"
                  value={fmtEscalacoes(a.escalacoes)}
                  hint="Quantos times escalaram o jogador nesta rodada"
                />
              )}
              <Stat label="Média geral" value={fmt(a.stats.media, 2)} />
              <Stat label="Mediana" value={fmt(a.stats.mediana, 2)} />
              <Stat
                label="Desvio padrão"
                value={fmt(a.stats.desvio, 2)}
                hint="Quanto maior, mais irregular"
              />
              <Stat
                label="Média básica"
                value={fmt(a.stats.mediaBasica, 2)}
                hint="Pontuação sem gols e assistências"
              />
              <Stat label={`Casa (${a.stats.jogosCasa})`} value={fmt(a.stats.mediaCasa, 2)} />
              <Stat label={`Fora (${a.stats.jogosFora})`} value={fmt(a.stats.mediaFora, 2)} />
              <Stat
                label={`Últimas ${a.stats.jogosUltimas}`}
                value={fmt(a.stats.mediaUltimas, 2)}
                hint="Média das últimas 5 rodadas em que pontuou"
              />
              <Stat
                label="Tendência"
                value={`${a.stats.tendencia >= 0 ? "+" : ""}${fmt(a.stats.tendencia, 2)}`}
                hint="Últimas 5 menos a média geral"
              />
              <Stat label="Jogos" value={String(a.stats.jogos)} />
              <Stat
                label="Participação"
                value={fmtPct(a.stats.participacao)}
                hint="% das rodadas do clube em que jogou"
              />
              <Stat label="Mín / Máx" value={`${fmt(a.stats.minimo)} / ${fmt(a.stats.maximo)}`} />
              <Stat label="Jogos positivos" value={fmtPct(a.stats.pctPositivos)} />
              <Stat
                label="Cedidas pelo adv."
                value={fmt(a.cedidasAdversario, 2)}
                hint="Média que o adversário cede para esta posição (ajustada pelo mando)"
              />
              <Stat
                label="Ajuste do confronto"
                value={`${a.ajusteAdversario >= 0 ? "+" : ""}${fmt(a.ajusteAdversario, 2)}`}
              />
            </div>

            {a.stats.historico.length > 0 && (
              <div>
                <div className="mb-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Pontuação por rodada</span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm bg-emerald-600" /> casa
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm bg-sky-500" /> fora
                  </span>
                </div>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={a.stats.historico}
                      margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
                    >
                      <XAxis dataKey="rodada" tick={{ fontSize: 10 }} tickLine={false} />
                      <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip
                        formatter={(v) => [fmt(Number(v), 2), "Pontos"]}
                        labelFormatter={(r, payload) => {
                          const j = payload?.[0]?.payload as
                            { mando?: string; adversario?: number } | undefined;
                          const adv =
                            j?.adversario != null ? ` x ${siglaClube(clubes, j.adversario)}` : "";
                          const mando =
                            j?.mando === "C" ? " (casa)" : j?.mando === "F" ? " (fora)" : "";
                          return `Rodada ${r}${adv}${mando}`;
                        }}
                      />
                      <ReferenceLine y={a.stats.media} stroke="#64748b" strokeDasharray="4 3" />
                      <Bar dataKey="pontos" radius={[2, 2, 0, 0]}>
                        {a.stats.historico.map((j) => (
                          <Cell key={j.rodada} fill={j.mando === "F" ? "#0ea5e9" : "#059669"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {Object.keys(a.scoutTotal).length > 0 && (
              <div>
                <div className="mb-1 text-xs font-medium">
                  Scouts na temporada (total · por jogo)
                </div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(a.scoutTotal)
                    .sort((x, y) => y[1] - x[1])
                    .map(([k, v]) => (
                      <Badge
                        key={k}
                        variant="outline"
                        className="font-normal"
                        title={SCOUT_NOMES[k] ?? k}
                      >
                        <span className="font-semibold">{k}</span>&nbsp;{v}
                        {a.jogosOficial > 0 && (
                          <span className="text-muted-foreground">
                            &nbsp;· {fmt(v / a.jogosOficial, 2)}
                          </span>
                        )}
                      </Badge>
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
