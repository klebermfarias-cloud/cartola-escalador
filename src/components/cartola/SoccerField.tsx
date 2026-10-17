import { ArrowLeftRight, Home, Plane, Star } from "lucide-react";
import type { Banco } from "@/lib/cartola/optimizer";
import type { AtletaProjetado } from "@/lib/cartola/types";
import { POSICOES } from "@/lib/cartola/types";
import { cn } from "@/lib/utils";
import { COR_POSICAO, escudo, fmt, siglaClube, type Clubes } from "./format";

export interface Slot {
  titular: AtletaProjetado;
  alternativa: AtletaProjetado | null;
  trocado: boolean;
}

interface Props {
  slots: Slot[];
  capitaoId: number | null;
  banco: Banco;
  clubes: Clubes;
  onToggle: (titularId: number) => void;
  onSelect: (a: AtletaProjetado) => void;
}

function emCampo(s: Slot) {
  return s.trocado && s.alternativa ? s.alternativa : s.titular;
}
function noBanco(s: Slot) {
  return s.trocado && s.alternativa ? s.titular : s.alternativa;
}

export function SoccerField({ slots, capitaoId, banco, clubes, onToggle, onSelect }: Props) {
  const porPos = (pos: number) => slots.filter((s) => s.titular.posicaoId === pos);
  const laterais = porPos(2);
  const defesa = [...laterais.slice(0, 1), ...porPos(3), ...laterais.slice(1)];
  const linhas: Slot[][] = [porPos(5), porPos(4), defesa, porPos(1)];
  const tecnico = porPos(6);

  return (
    <div className="relative mx-auto w-full max-w-[620px] select-none">
      <div
        className="relative aspect-[68/104] w-full sm:aspect-[68/90] overflow-hidden rounded-xl border-4 border-emerald-950/40 shadow-lg"
        style={{
          background:
            "repeating-linear-gradient(180deg, #2f8f3a 0, #2f8f3a 10%, #2a8034 10%, #2a8034 20%)",
        }}
      >
        <FieldLines />
        <div className="absolute inset-0 flex flex-col justify-around px-1 pb-[4%] pt-[3%]">
          {linhas.map((linha, i) => (
            <div key={i} className="flex items-start justify-evenly">
              {linha.map((s) => (
                <PlayerSpot
                  key={s.titular.id}
                  slot={s}
                  capitaoId={capitaoId}
                  clubes={clubes}
                  onToggle={onToggle}
                  onSelect={onSelect}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-lg border bg-card p-2">
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Técnico
          </span>
          {tecnico.map((s) => (
            <PlayerSpot
              key={s.titular.id}
              slot={s}
              capitaoId={capitaoId}
              clubes={clubes}
              onToggle={onToggle}
              onSelect={onSelect}
              claro
              largo
            />
          ))}
        </div>
        <div className="flex min-w-0 flex-col gap-1 border-l pl-3">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Banco de reservas
          </span>
          {banco.reservas.length === 0 ? (
            <span className="text-xs text-muted-foreground">
              Nenhum reserva cabe no limite de preço dos titulares.
            </span>
          ) : (
            <div className="flex flex-wrap justify-around gap-y-2">
              {banco.reservas.map((r) => (
                <ReservaSpot
                  key={r.id}
                  a={r}
                  luxo={r.id === banco.luxoId}
                  clubes={clubes}
                  onSelect={onSelect}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldLines() {
  const line = "absolute border-2 border-white/70";
  return (
    <div className="pointer-events-none absolute inset-[3%]">
      <div className={cn(line, "inset-0")} />
      <div className={cn(line, "left-0 right-0 top-1/2 h-0 border-b-0")} />
      <div
        className={cn(
          line,
          "left-1/2 top-1/2 aspect-square w-[26%] -translate-x-1/2 -translate-y-1/2 rounded-full",
        )}
      />
      {/* grande área / pequena área - topo */}
      <div className={cn(line, "left-1/2 top-0 h-[16%] w-[58%] -translate-x-1/2 border-t-0")} />
      <div className={cn(line, "left-1/2 top-0 h-[6%] w-[27%] -translate-x-1/2 border-t-0")} />
      {/* grande área / pequena área - base */}
      <div className={cn(line, "bottom-0 left-1/2 h-[16%] w-[58%] -translate-x-1/2 border-b-0")} />
      <div className={cn(line, "bottom-0 left-1/2 h-[6%] w-[27%] -translate-x-1/2 border-b-0")} />
    </div>
  );
}

function Avatar({ a, clubes }: { a: AtletaProjetado; clubes: Clubes }) {
  const esc = escudo(clubes, a.clubeId);
  return (
    <div className="relative h-10 w-10 sm:h-12 sm:w-12">
      <div className="h-full w-full overflow-hidden rounded-full border-2 border-white bg-slate-200 shadow">
        {a.foto ? (
          <img
            src={a.foto}
            alt={a.apelido}
            referrerPolicy="no-referrer"
            loading="lazy"
            className="h-full w-full object-cover object-top"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-600">
            {a.apelido.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      {esc && (
        <img
          src={esc}
          alt={siglaClube(clubes, a.clubeId)}
          referrerPolicy="no-referrer"
          className="absolute -bottom-1 -right-1 h-5 w-5 object-contain drop-shadow"
        />
      )}
    </div>
  );
}

function PlayerSpot({
  slot,
  capitaoId,
  clubes,
  onToggle,
  onSelect,
  claro,
  largo,
}: {
  slot: Slot;
  capitaoId: number | null;
  clubes: Clubes;
  onToggle: (id: number) => void;
  onSelect: (a: AtletaProjetado) => void;
  claro?: boolean;
  largo?: boolean;
}) {
  const a = emCampo(slot);
  const alt = noBanco(slot);
  const prox = a.proximo;
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col items-center gap-0.5",
        largo ? "w-[92px]" : "w-[19%] max-w-[110px] sm:w-[18%]",
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(a)}
        className="group relative flex flex-col items-center focus:outline-none"
        title={`${a.apelido} — ver estatísticas`}
      >
        <div className="relative">
          <Avatar a={a} clubes={clubes} />
          {a.id === capitaoId && (
            <span className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 text-[10px] font-black text-yellow-950 shadow">
              C
            </span>
          )}
          <span
            className={cn(
              "absolute -right-1 -top-1 rounded px-1 text-[9px] font-bold text-white shadow",
              COR_POSICAO[a.posicaoId],
            )}
          >
            {POSICOES[a.posicaoId].curto}
          </span>
        </div>
        <span className="mt-1 max-w-full truncate rounded bg-white/95 px-1.5 text-[11px] font-semibold leading-4 text-slate-900 shadow group-hover:bg-yellow-100">
          {a.apelido}
        </span>
        <span
          className={cn(
            "mt-0.5 whitespace-nowrap rounded px-1 text-[10px] font-medium leading-4",
            claro ? "bg-muted text-foreground" : "bg-emerald-950/70 text-white",
          )}
        >
          {fmt(a.projecao)} pts
        </span>
        <span
          className={cn(
            "flex flex-wrap items-center justify-center gap-x-1 text-[9px] leading-3",
            claro ? "text-muted-foreground" : "text-white/90",
          )}
        >
          <span>C$ {fmt(a.preco)}</span>
          {prox && (
            <span className="flex items-center gap-0.5">
              {prox.mando === "C" ? (
                <Home className="h-2.5 w-2.5" />
              ) : (
                <Plane className="h-2.5 w-2.5" />
              )}
              {siglaClube(clubes, prox.adversario)}
            </span>
          )}
        </span>
      </button>
      {alt && (
        <button
          type="button"
          onClick={() => onToggle(slot.titular.id)}
          className={cn(
            "mt-0.5 flex max-w-full items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] leading-3 shadow-sm transition-colors",
            slot.trocado
              ? "border-yellow-300 bg-yellow-300 text-yellow-950 hover:bg-yellow-200"
              : "border-white/40 bg-black/35 text-white hover:bg-black/55",
            claro && !slot.trocado && "border-border bg-muted text-foreground hover:bg-accent",
          )}
          title={`Alternar para ${alt.apelido} (${fmt(alt.projecao)} pts, C$ ${fmt(alt.preco)})`}
        >
          <ArrowLeftRight className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">
            {alt.apelido} {fmt(alt.projecao)}
          </span>
        </button>
      )}
    </div>
  );
}

function ReservaSpot({
  a,
  luxo,
  clubes,
  onSelect,
}: {
  a: AtletaProjetado;
  luxo: boolean;
  clubes: Clubes;
  onSelect: (a: AtletaProjetado) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(a)}
      className="flex w-[68px] min-w-0 flex-col items-center gap-0.5 rounded-md p-1 hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      title={`${a.apelido}${luxo ? " (reserva de luxo)" : ""} — ver estatísticas`}
    >
      <div className="relative">
        <Avatar a={a} clubes={clubes} />
        <span
          className={cn(
            "absolute -right-1 -top-1 rounded px-1 text-[9px] font-bold text-white shadow",
            COR_POSICAO[a.posicaoId],
          )}
        >
          {POSICOES[a.posicaoId].curto}
        </span>
        {luxo && (
          <span
            className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--luxo)] text-white shadow"
            title="Reserva de luxo"
          >
            <Star className="h-3 w-3 fill-current" />
          </span>
        )}
      </div>
      <span className="max-w-full truncate text-[11px] font-semibold leading-4">{a.apelido}</span>
      <span className="text-[10px] font-semibold leading-3 tabular-nums">
        {fmt(a.projecao)} pts
      </span>
      <span className="text-[10px] leading-3 tabular-nums text-muted-foreground">
        C$ {fmt(a.preco)}
      </span>
      {luxo && <span className="text-[9px] font-semibold uppercase text-[var(--luxo)]">Luxo</span>}
    </button>
  );
}
