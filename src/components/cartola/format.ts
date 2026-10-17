import type { ClubeDados } from "@/lib/cartola/dados";

export type Clubes = Record<string, ClubeDados>;

export function fmt(n: number | null | undefined, casas = 1): string {
  if (n == null || !Number.isFinite(n)) return "–";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/** 1234567 -> "1,2 mi"; 45300 -> "45 mil". */
export function fmtEscalacoes(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "–";
  if (n >= 1_000_000) return `${fmt(n / 1_000_000, 1)} mi`;
  if (n >= 1_000) return `${Math.round(n / 1_000).toLocaleString("pt-BR")} mil`;
  return String(n);
}

export function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "–";
  return `${Math.round(n * 100)}%`;
}

export function escudo(clubes: Clubes, id: number | null | undefined): string | null {
  if (id == null) return null;
  return clubes[String(id)]?.escudo ?? null;
}

export function siglaClube(clubes: Clubes, id: number | null | undefined): string {
  if (id == null) return "–";
  return clubes[String(id)]?.abreviacao ?? String(id);
}

export function nomeClube(clubes: Clubes, id: number | null | undefined): string {
  if (id == null) return "–";
  const c = clubes[String(id)];
  return c?.nome_fantasia ?? c?.nome ?? String(id);
}

export const STATUS_NOMES: Record<number, string> = {
  2: "Dúvida",
  3: "Suspenso",
  5: "Contundido",
  6: "Nulo",
  7: "Provável",
};

export const COR_POSICAO: Record<number, string> = {
  1: "bg-amber-500",
  2: "bg-sky-500",
  3: "bg-blue-600",
  4: "bg-emerald-600",
  5: "bg-rose-600",
  6: "bg-slate-600",
};

export const STATUS_MERCADO: Record<number, string> = {
  1: "Mercado aberto",
  2: "Mercado fechado",
  3: "Mercado em atualização",
  4: "Mercado em manutenção",
  6: "Temporada encerrada",
};
