import type { ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  Coins,
  Flame,
  Hand,
  Lightbulb,
  Shield,
  ShieldAlert,
  Star,
  Swords,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DicaAtleta, DicaDefesa, DicasRodada as Dicas } from "@/lib/cartola/dicas";
import type { AtletaProjetado } from "@/lib/cartola/types";
import { POSICOES } from "@/lib/cartola/types";
import { escudo, fmt, fmtPct, nomeClube, siglaClube, type Clubes } from "./format";

function Escudo({ clubes, id }: { clubes: Clubes; id: number }) {
  const src = escudo(clubes, id);
  return src ? (
    <img src={src} alt="" className="h-4 w-4 shrink-0 object-contain" />
  ) : (
    <span className="h-4 w-4 shrink-0" />
  );
}

function Secao({
  icone,
  titulo,
  dica,
  children,
}: {
  icone: ReactNode;
  titulo: string;
  dica?: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-md border bg-background p-3">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
        {icone}
        {titulo}
      </h3>
      {dica && <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{dica}</p>}
      <ul className="mt-2 space-y-1.5 text-xs">{children}</ul>
    </section>
  );
}

function Vazio() {
  return <li className="text-muted-foreground">Nada de destaque nesta rodada.</li>;
}

type Marcacao = { noTime: Set<number>; noBanco: Set<number> };

function ItemAtleta({
  d,
  clubes,
  onSelect,
  detalhe,
  marcacao,
}: {
  d: DicaAtleta;
  clubes: Clubes;
  onSelect: (a: AtletaProjetado) => void;
  detalhe: string;
  marcacao: Marcacao;
}) {
  const a = d.atleta;
  const noTime = marcacao.noTime.has(a.id);
  const noBanco = !noTime && marcacao.noBanco.has(a.id);
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(a)}
        className="flex w-full min-w-0 items-center gap-1.5 rounded text-left hover:bg-accent"
      >
        <Escudo clubes={clubes} id={a.clubeId} />
        <span className="w-7 shrink-0 text-[10px] font-semibold text-muted-foreground">
          {POSICOES[a.posicaoId].curto}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">{a.apelido}</span>
        {noTime && (
          <span
            className="flex shrink-0 items-center gap-0.5 rounded bg-[var(--gramado)] px-1 text-[10px] font-semibold text-white"
            title="Já está no time escalado"
          >
            <Check className="h-2.5 w-2.5" /> no time
          </span>
        )}
        {noBanco && (
          <span
            className="shrink-0 rounded border px-1 text-[10px] font-semibold text-muted-foreground"
            title="Está no banco de reservas"
          >
            banco
          </span>
        )}
        <span className="shrink-0 tabular-nums text-muted-foreground">{detalhe}</span>
      </button>
    </li>
  );
}

function proximoTexto(d: DicaDefesa, clubes: Clubes) {
  if (d.adversario == null) return "";
  return `${d.emCasa ? "recebe" : "visita"} ${siglaClube(clubes, d.adversario)}`;
}

export function DicasRodada({
  dicas,
  clubes,
  onSelect,
  noTime,
  noBanco,
}: {
  dicas: Dicas;
  clubes: Clubes;
  onSelect: (a: AtletaProjetado) => void;
  /** Jogadores no campo e no banco, para marcar nas listas. */
  noTime: Set<number>;
  noBanco: Set<number>;
}) {
  const marcacao = { noTime, noBanco };
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Lightbulb className="h-4 w-4 text-amber-500" /> Dicas da rodada
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Leituras do modelo de gols e do histórico da temporada. Quem aparece aqui ganha até 1
          ponto no score da escalação. “No time” marca quem já está escalado; toque num jogador para
          ver a ficha.
        </p>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Secao
          icone={<Swords className="h-3.5 w-3.5" />}
          titulo="Jogos mais fáceis"
          dica="Maior diferença de gols esperados a favor de um dos lados."
        >
          {dicas.jogosFaceis.length === 0 && <Vazio />}
          {dicas.jogosFaceis.map((j) => (
            <li key={`${j.casa}-${j.fora}`} className="space-y-0.5">
              <div className="flex items-center gap-1.5 font-medium tabular-nums">
                <Escudo clubes={clubes} id={j.casa} />
                {siglaClube(clubes, j.casa)} {fmt(j.golsCasa)} x {fmt(j.golsFora)}{" "}
                {siglaClube(clubes, j.fora)}
                <Escudo clubes={clubes} id={j.fora} />
              </div>
              <div className="text-[11px] text-muted-foreground">
                Favorito: {nomeClube(clubes, j.favorito)}
                {j.favorito === j.fora ? " (fora de casa)" : ""} · {fmtPct(j.chanceSGFavorito)} de
                chance de não sofrer gol
              </div>
            </li>
          ))}
        </Secao>

        <Secao
          icone={<Shield className="h-3.5 w-3.5" />}
          titulo="Defesas que não sofrem gol"
          dica="Sequência atual sem sofrer gol e jogos sem sofrer gol nos últimos 5."
        >
          {dicas.defesasSolidas.length === 0 && <Vazio />}
          {dicas.defesasSolidas.map((d) => (
            <li key={d.clube} className="flex min-w-0 items-start gap-1.5">
              <Escudo clubes={clubes} id={d.clube} />
              <div className="min-w-0">
                <span className="font-medium">{nomeClube(clubes, d.clube)}</span>
                <div className="text-[11px] text-muted-foreground">
                  {d.sequenciaSemSofrer > 0
                    ? `${d.sequenciaSemSofrer} ${d.sequenciaSemSofrer === 1 ? "jogo" : "jogos seguidos"} sem sofrer gol`
                    : "sofreu gol no último jogo"}{" "}
                  · {d.semSofrerUltimos5} dos últimos {d.jogos} · {proximoTexto(d, clubes)}
                </div>
              </div>
            </li>
          ))}
        </Secao>

        <Secao
          icone={<ShieldAlert className="h-3.5 w-3.5" />}
          titulo="Defesas que mais sofrem gol"
          dica="Bons adversários para escalar os atacantes de quem os enfrenta."
        >
          {dicas.defesasVazadas.map((d) => (
            <li key={d.clube} className="flex min-w-0 items-start gap-1.5">
              <Escudo clubes={clubes} id={d.clube} />
              <div className="min-w-0">
                <span className="font-medium">{nomeClube(clubes, d.clube)}</span>
                <div className="text-[11px] text-muted-foreground">
                  {d.sofridosUltimos5} gols sofridos nos últimos {d.jogos}
                  {d.sequenciaSofrendo >= 3
                    ? ` · ${d.sequenciaSofrendo} jogos seguidos sofrendo gol`
                    : ""}{" "}
                  · {proximoTexto(d, clubes)}
                </div>
              </div>
            </li>
          ))}
        </Secao>

        <Secao
          icone={<Flame className="h-3.5 w-3.5" />}
          titulo="Ataques em alta"
          dica="Gols marcados nos últimos 5 jogos."
        >
          {dicas.ataquesEmAlta.map((d) => (
            <li key={d.clube} className="flex min-w-0 items-center gap-1.5">
              <Escudo clubes={clubes} id={d.clube} />
              <span className="min-w-0 flex-1 truncate font-medium">
                {nomeClube(clubes, d.clube)}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {d.marcadosUltimos5} gols · {proximoTexto(d, clubes)}
              </span>
            </li>
          ))}
        </Secao>

        <Secao
          icone={<Star className="h-3.5 w-3.5" />}
          titulo="Destaques da rodada"
          dica="Maiores pontuações prováveis entre os escaláveis."
        >
          {dicas.destaques.length === 0 && <Vazio />}
          {dicas.destaques.map((d) => (
            <ItemAtleta
              key={d.atleta.id}
              d={d}
              clubes={clubes}
              onSelect={onSelect}
              marcacao={marcacao}
              detalhe={`${fmt(d.valor)} pts`}
            />
          ))}
        </Secao>

        <Secao
          icone={<Hand className="h-3.5 w-3.5" />}
          titulo="Goleiros em destaque"
          dica="Goleiros mais bem projetados e a chance de o time não sofrer gol."
        >
          {dicas.goleiros.length === 0 && <Vazio />}
          {dicas.goleiros.map((d) => (
            <ItemAtleta
              key={d.atleta.id}
              d={d}
              clubes={clubes}
              onSelect={onSelect}
              marcacao={marcacao}
              detalhe={`${fmt(d.valor)} pts · SG ${fmtPct(d.atleta.chanceSG)}`}
            />
          ))}
        </Secao>

        <Secao
          icone={<Coins className="h-3.5 w-3.5" />}
          titulo="Custo-benefício"
          dica="Mais pontos prováveis por cartoleta (com pelo menos 3 pts previstos)."
        >
          {dicas.custoBeneficio.length === 0 && <Vazio />}
          {dicas.custoBeneficio.map((d) => (
            <ItemAtleta
              key={d.atleta.id}
              d={d}
              clubes={clubes}
              onSelect={onSelect}
              marcacao={marcacao}
              detalhe={`${fmt(d.valor, 2)} pts/C$ · C$ ${fmt(d.atleta.preco)}`}
            />
          ))}
        </Secao>

        <Secao
          icone={<TrendingUp className="h-3.5 w-3.5" />}
          titulo="Em alta"
          dica="Média das últimas 5 rodadas bem acima da média da temporada."
        >
          {dicas.emAlta.length === 0 && <Vazio />}
          {dicas.emAlta.map((d) => (
            <ItemAtleta
              key={d.atleta.id}
              d={d}
              clubes={clubes}
              onSelect={onSelect}
              marcacao={marcacao}
              detalhe={`+${fmt(d.valor)} sobre a média`}
            />
          ))}
        </Secao>

        <Secao
          icone={<AlertTriangle className="h-3.5 w-3.5" />}
          titulo="Atenção"
          dica="Jogos sem pontuação e bons jogadores com status de dúvida."
        >
          {dicas.jogosQueNaoValem.length === 0 && dicas.destaquesEmDuvida.length === 0 && <Vazio />}
          {dicas.jogosQueNaoValem.map((j) => (
            <li key={`nv-${j.casa}`} className="flex items-center gap-1.5">
              <Escudo clubes={clubes} id={j.casa} />
              <span className="font-medium">
                {siglaClube(clubes, j.casa)} x {siglaClube(clubes, j.fora)}
              </span>
              <span className="text-muted-foreground">não vale pontos nesta rodada</span>
            </li>
          ))}
          {dicas.destaquesEmDuvida.map((a) => (
            <ItemAtleta
              key={a.id}
              d={{ atleta: a, valor: a.stats.media }}
              clubes={clubes}
              onSelect={onSelect}
              marcacao={marcacao}
              detalhe={`dúvida · média ${fmt(a.stats.media)}`}
            />
          ))}
        </Secao>
      </CardContent>
    </Card>
  );
}
