import { useCallback, useEffect, useState } from "react";
import type { DadosCartola } from "@/lib/cartola/dados";

type Estado =
  { tipo: "carregando" } | { tipo: "erro"; mensagem: string } | { tipo: "ok"; dados: DadosCartola };

/** Lê data.json, publicado ao lado da página (ou servido pelo Vite em desenvolvimento). */
export function useDados() {
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });

  const carregar = useCallback(async () => {
    setEstado((e) => (e.tipo === "ok" ? e : { tipo: "carregando" }));
    try {
      const res = await fetch("data.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`Arquivo de dados indisponível (HTTP ${res.status}).`);
      const dados = (await res.json()) as DadosCartola;
      if (!dados?.status || !Array.isArray(dados.atletas)) {
        throw new Error("O arquivo de dados está em um formato inesperado.");
      }
      setEstado({ tipo: "ok", dados });
    } catch (e) {
      setEstado({ tipo: "erro", mensagem: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return { estado, recarregar: carregar };
}
