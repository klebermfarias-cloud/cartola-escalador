import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FORMACOES } from "@/lib/cartola/optimizer";
import { fmt } from "./format";
import { MODELO_PADRAO, type ModeloConfig, type PerfilRisco } from "@/lib/cartola/projection";

interface Props {
  modo: "ideal" | "proprio";
  onModo: (modo: "ideal" | "proprio") => void;
  cartoletas: number;
  onCartoletas: (v: number) => void;
  /** Custo do time ideal (maiores pontuações, sem limite de cartoletas). */
  custoIdeal: number | null;
  formacao: string;
  onFormacao: (v: string) => void;
  cfg: ModeloConfig;
  onCfg: (cfg: ModeloConfig) => void;
}

const PESOS: { key: keyof ModeloConfig; label: string; hint: string }[] = [
  { key: "pesoMedia", label: "Média geral", hint: "Média de todas as rodadas jogadas" },
  {
    key: "pesoMando",
    label: "Fator casa/fora",
    hint: "Desempenho do jogador em casa ou fora, conforme o jogo da rodada, somado à vantagem de mando da posição na liga",
  },
  {
    key: "pesoForma",
    label: "Momento (últimas 5)",
    hint: "Média das últimas 5 rodadas em que pontuou",
  },
  { key: "pesoMediana", label: "Mediana", hint: "Valor típico, menos sensível a mitadas isoladas" },
  {
    key: "pesoBasica",
    label: "Média básica",
    hint: "Pontuação sem gols e assistências (regularidade)",
  },
  {
    key: "pesoAdversario",
    label: "Pontos cedidos pelo adversário",
    hint: "Quanto o adversário cede de pontos para a posição",
  },
  {
    key: "pesoNivel",
    label: "Nível do adversário (tabela)",
    hint: "Faixa do adversário na tabela: muito difícil (1º-5º), difícil (6º-10º), fácil (11º-15º), muito fácil (16º-20º)",
  },
  {
    key: "pesoGols",
    label: "Modelo de gols do jogo",
    hint: "Gols esperados de cada time (ataque x defesa): chance de não sofrer gol, gols do time e saldo",
  },
  {
    key: "pesoDicas",
    label: "Bônus das dicas (até 1 pt)",
    hint: "Soma até 1 ponto no score de quem aparece nas dicas da rodada: destaques, em alta, goleiros, custo-benefício, time favorito, defesa sólida, ataque em alta ou adversário que sofre muitos gols",
  },
];

export function SettingsPanel({
  modo,
  onModo,
  cartoletas,
  onCartoletas,
  custoIdeal,
  formacao,
  onFormacao,
  cfg,
  onCfg,
}: Props) {
  const set = <K extends keyof ModeloConfig>(k: K, v: ModeloConfig[K]) => onCfg({ ...cfg, [k]: v });

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Cartoletas</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={modo}
          onValueChange={(v) => v && onModo(v as "ideal" | "proprio")}
          className="grid grid-cols-2"
        >
          <ToggleGroupItem value="ideal" className="text-xs">
            Time ideal
          </ToggleGroupItem>
          <ToggleGroupItem value="proprio" className="text-xs">
            Minhas cartoletas
          </ToggleGroupItem>
        </ToggleGroup>
        {modo === "ideal" ? (
          <p className="text-[11px] leading-snug text-muted-foreground">
            Sem limite: escolhe as maiores pontuações prováveis
            {custoIdeal != null && (
              <>
                {" "}
                e custa <strong className="text-foreground">C$ {fmt(custoIdeal, 2)}</strong>
              </>
            )}
            .
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">C$</span>
            <Input
              id="orcamento"
              type="number"
              inputMode="decimal"
              min={0}
              step={0.01}
              value={Number.isFinite(cartoletas) ? cartoletas : ""}
              onChange={(e) => onCartoletas(parseFloat(e.target.value.replace(",", ".")))}
              className="h-8"
              aria-label="Minhas cartoletas"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Formação</Label>
          <Select value={formacao} onValueChange={onFormacao}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Melhor automática</SelectItem>
              {FORMACOES.map((f) => (
                <SelectItem key={f.nome} value={f.nome}>
                  {f.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Perfil de risco</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={cfg.perfil}
          onValueChange={(v) => v && set("perfil", v as PerfilRisco)}
          className="grid grid-cols-3"
        >
          <ToggleGroupItem
            value="conservador"
            className="text-xs"
            title="Penaliza jogadores irregulares (alto desvio padrão)"
          >
            Conservador
          </ToggleGroupItem>
          <ToggleGroupItem value="equilibrado" className="text-xs" title="Usa apenas a projeção">
            Equilibrado
          </ToggleGroupItem>
          <ToggleGroupItem
            value="arrojado"
            className="text-xs"
            title="Favorece jogadores com potencial de mitar (alto desvio)"
          >
            Arrojado
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="duvida" className="text-xs">
          Incluir jogadores em dúvida
        </Label>
        <Switch
          id="duvida"
          checked={cfg.incluirDuvida}
          onCheckedChange={(v) => set("incluirDuvida", v)}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <Label>Mínimo de jogos</Label>
          <span className="tabular-nums text-muted-foreground">{cfg.minJogos}</span>
        </div>
        <Slider
          min={0}
          max={15}
          step={1}
          value={[cfg.minJogos]}
          onValueChange={([v]) => set("minJogos", v)}
        />
      </div>

      <div className="space-y-3 border-t pt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold">Pesos do modelo</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-xs"
            onClick={() =>
              onCfg({ ...MODELO_PADRAO, perfil: cfg.perfil, incluirDuvida: cfg.incluirDuvida })
            }
          >
            <RotateCcw className="h-3 w-3" /> Padrão
          </Button>
        </div>
        {PESOS.map((p) => (
          <div key={p.key} className="space-y-1.5" title={p.hint}>
            <div className="flex justify-between text-xs">
              <Label>{p.label}</Label>
              <span className="tabular-nums text-muted-foreground">{cfg[p.key] as number}</span>
            </div>
            <Slider
              min={0}
              max={100}
              step={5}
              value={[cfg[p.key] as number]}
              onValueChange={([v]) => set(p.key, v as never)}
            />
          </div>
        ))}
        <p className="text-[11px] leading-snug text-muted-foreground">
          Os pesos das médias são relativos entre si. Os dois ajustes de adversário vão de 0
          (ignora) a 100 (aplica todo o efeito medido na temporada).
        </p>
      </div>
    </div>
  );
}
