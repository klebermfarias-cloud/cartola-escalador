import { Home, Plane } from "lucide-react";
import type { AtletaProjetado, NivelAdversario } from "@/lib/cartola/types";
import { NIVEIS_ADVERSARIO } from "@/lib/cartola/types";
import { cn } from "@/lib/utils";
import { fmt, fmtPct } from "./format";

/** Cor de cada faixa, do vermelho (muito difícil) ao verde (muito fácil). */
export const COR_NIVEL: Record<NivelAdversario, string> = {
  "muito-dificil": "bg-red-600 text-white",
  dificil: "bg-orange-500 text-white",
  facil: "bg-lime-500 text-lime-950",
  "muito-facil": "bg-emerald-600 text-white",
};

/** Ordem para ordenar do mais difícil ao mais fácil. */
export const ORDEM_NIVEL: Record<NivelAdversario, number> = {
  "muito-dificil": 1,
  dificil: 2,
  facil: 3,
  "muito-facil": 4,
};

export function textoNivel(a: AtletaProjetado): string {
  if (!a.nivelAdversario) return "Sem posição na tabela";
  const pos = a.proximo?.posicaoTabelaAdversario;
  return `${NIVEIS_ADVERSARIO[a.nivelAdversario].rotulo}: adversário ${pos}º na tabela`;
}

export function NivelBadge({
  nivel,
  className,
}: {
  nivel: NivelAdversario | null;
  className?: string;
}) {
  if (!nivel) return <span className="text-muted-foreground">–</span>;
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded px-1.5 text-[10px] font-semibold leading-4",
        COR_NIVEL[nivel],
        className,
      )}
    >
      {NIVEIS_ADVERSARIO[nivel].rotulo}
    </span>
  );
}

/** Ponto colorido com a faixa do adversário, para espaços pequenos (campo). */
export function NivelPonto({ a }: { a: AtletaProjetado }) {
  if (!a.nivelAdversario) return null;
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full ring-1 ring-white/70",
        COR_NIVEL[a.nivelAdversario],
      )}
      title={textoNivel(a)}
      aria-label={textoNivel(a)}
    />
  );
}

/** "+1,2" em verde ou "−0,8" em vermelho: efeito do mando em relação à média do jogador. */
export function AjusteMando({ a }: { a: AtletaProjetado }) {
  if (!a.proximo) return <span className="text-muted-foreground">–</span>;
  const v = a.ajusteMando;
  const Icone = a.proximo.mando === "C" ? Home : Plane;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 tabular-nums",
        v > 0.05
          ? "text-emerald-700 dark:text-emerald-400"
          : v < -0.05
            ? "text-red-600 dark:text-red-400"
            : "text-muted-foreground",
      )}
      title={
        a.chanceMando != null
          ? `${a.proximo.mando === "C" ? "Em casa" : "Fora"}: ${fmtPct(a.chanceMando)} de chance de pontuar acima da própria média`
          : undefined
      }
    >
      <Icone className="h-3 w-3" />
      {v >= 0 ? "+" : "−"}
      {fmt(Math.abs(v))}
    </span>
  );
}
